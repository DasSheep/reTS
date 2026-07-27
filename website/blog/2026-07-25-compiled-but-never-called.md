---
slug: compiled-but-never-called
title: "Compiled, But Never Called"
date: 2026-07-25T01:00:00+07:00
authors: [rets-team]
tags: [devblog, campaign, carryover, ion-storm, firestorm, randomness, tiberian-sun, multi-game, faithful-port, verification, reference, tooling]
last_verified: 2026-07-25
---

Somewhere in Tiberian Sun's executable there is a function that does exactly
what you'd want it to do if you were trying to find out whether the Firestorm
expansion is installed. It checks for one of Firestorm's files, and it hands
back yes or no. It has the shape of an answer.

Nothing in an unmodified game ever calls it.

That turned out to be the shape of practically everything this week. A
campaign's win screen quietly picks between three endings depending on the
order two flags get checked, not the order you'd guess. A weather event's own
settings ship almost entirely switched off in the retail data — present, but
functionally dormant. Code built for one purpose gets recompiled, unrenamed,
into a completely different one. A tracking script we wrote ourselves was
quietly hiding more than half of our own finished work from the backlog it
reported. That Firestorm-detection question really does have an answer —
just not the one the perfectly-named function seemed to promise. A wall
we'd already reverse-engineered down to a tidy, four-function port contract
turned out to have a second, undocumented way of killing you. A tool we
were about to build, to read the game's sealed data archives, had already
been finished months ago and forgotten. And a burrowing-unit mechanic that
everyone including us assumed was Tiberian Sun's alone is sitting fully
alive in both sequels, which simply never shipped a unit that uses it.

One thread runs under all of it: the plausible-looking thing — a name, a
flag, a summary, a task description, our own inventory of our own work — is
not always the thing actually running, and the only way to tell is to read
the raw instructions instead of the label.

{/* truncate */}

*Last verified against the project oracle: 2026-07-25.*

## Three ways a win can go

When you win a campaign mission, the engine reads a handful of flags on the
scenario and takes one of a few paths. The campaign can simply end — silently,
or with a credits screen. It can hand you the interactive map room to pick your
next target. Or it can resolve the next mission automatically, with no screen at
all.

The order those flags are checked turns out to matter: one of them
short-circuits *before* another, and reading the two checks in the wrong order
inverts the whole meaning. This is the sort of detail intuition gets backwards,
so we read the raw instructions rather than trusting the plausible-looking
guess — the "end silently" flag wins, quietly skipping the screen the next flag
would have shown.

## The branch graph

The automatic path is the interesting one. Each side's campaign is a small graph
of *stages*. A stage knows the map it represents and carries a list of outgoing
options — edges to other stages. To advance, the engine takes a "next mission"
name, finds your current stage, and walks its options looking for one whose
target map matches that name. On a match, it writes the target's map name into
the field the loader reads and moves your position to that stage.

There's a sharp edge worth preserving: before it scans, the resolver blanks the
next-mission name. So if nothing matches, the name is left *empty* rather than
silently reusing whatever was there before. A naive reimplementation would skip
that reset and quietly carry the old value forward — a subtle divergence. We kept
the faithful behavior, and made it toggleable for anyone building on top who'd
rather it not.

That "next mission" name comes in two flavors — a primary and an alternate,
chosen by yet another flag. For a while we'd assumed those fields were
vestigial: data the map editor round-tripped but the engine never actually
read. Reading the win path settled it. They're live, and the alternate is a
real branch key the engine consults every time it resolves a mission
automatically.

## The myth about the map room

Here's the part that surprised us. Going in, the working theory was that the
cinematic map room — choose-your-next-mission on a painted campaign map — was a
*Tiberian Sun* luxury, and that Red Alert 2 and Yuri's Revenge had trimmed it
down to a plain linear "just load the next map."

The binaries disagree. The same branch machinery — the same map room, the same
stage-and-option graph, the same primary-and-alternate keys in the same places —
is compiled into all three games. It isn't a Tiberian Sun feature the later
games removed; it's shared engine code all three inherited. What actually differs
is how much the *shipped campaigns* use it — how many missions author real
branches — and how lavish the presentation is, not whether the mechanism exists.

That distinction matters for a faithful reimplementation: the bytes say the
capability is universal, and the linearity, where it exists, is a *content*
choice, not an engine limit. So the reimplementation models one branch engine
shared by all three, and treats the presentation — the movie, the painted
map, the voiceover — as a separate layer on top of it.

## What carries across

Choosing the next map is only half the story. The other half is what follows you
into it. Just before the game tears down the finished mission and loads the next,
it takes a small snapshot: the credits you finished with, the story flags you
tripped during the mission, the mission timer if one is running, and your
difficulty. It loads the new map — which wipes the world clean — and then pours
that snapshot back in. That's why your money and your progress don't reset between
missions of a campaign.

The money is the fussy part, and it's a tidy example of why we read the raw
instructions instead of the friendly decompiled version. Your carried-over credits
aren't handed back whole: they're scaled by the mission's carry-over percentage and
then clamped to a cap (unless the mission opts out of the cap entirely). The
decompiled code shows a bland "convert to integer" call and hides *how* it rounds.
The actual instructions round by **truncating toward zero** — always down. Reproduce
that with ordinary rounding and you'd quietly hand the player a credit too many on
any mission that scales or caps the carry-over. So we checked the arithmetic against
the real bytes and matched it exactly, down to the direction of the rounding.

Two smaller things fell out of the same read. The snapshot is written into
save games too, so a saved campaign remembers exactly what you were
carrying. And, echoing the map-room finding, the snapshot-and-restore code is
again the *same* in all three games — in two of them identical down to the
individual instruction, only the addresses shifted. One mechanism, three
engines, reversed once.

## A different kind of decision

Missions and carried-over credits are about state that *persists* — it survives
a level, a save, a reload. Not every decision the engine makes works that way.
Tiberian Sun's ion storm is one of those: decisions made and thrown away
within a single frame, in a system most players never consciously register.

The ion storm is a Tiberian Sun weather event with no counterpart in Red Alert 2
or Yuri's Revenge — or so it first appears. It darkens the map, cuts power to
the movement systems of units sensitive to it, grounds anything flying, and
blacks out radar. A countdown pings the EVA announcer roughly every fifteen
seconds while the storm builds, and once it hits, it runs for a duration the
mission itself sets — and periodically, while it's active, it strikes with
lightning.

## The dice the storm rolls

Per frame, while the storm is active, the strike logic is a two-stage gamble.
First roll: does anything get struck at all this frame? Second, only if the
first says yes, at odds modders will recognize as `IonLightningRandomness`:
hit a random visible-on-radar cell, or survey the whole map instead? The
survey path walks every object in play, skips anything flying (already
grounded, so off the target list entirely), and scores what's left — a
baseline weight for most things, higher for a ground unit of a
storm-favored type that still has power, and highest for a storm-favored
building. Then it rolls once for every object that survived the skip.

That last detail is the one worth sitting with. The number of random draws the
storm consumes in a given frame isn't fixed — it depends on how many objects
happen to be on the map when the frame runs. Get every formula in this system
exactly right — the weights, the odds, the rounding — and a reimplementation
can still end up out of sync with the original, for a reason that has nothing
to do with any formula being wrong: it drew a different number of times from
the same shared random sequence. So the port doesn't just reproduce the
outcome; it keeps an ordered ledger of every draw the storm takes in a frame —
what was drawn, the bounds it was drawn from, and why — and the tests check the
ledger, not just what got hit.

## Symmetry that isn't there

Starting a storm and ending one turn out to be handled by two routines that
look like they should mirror each other and, on inspection, deliberately
don't. They walk the list of affected objects in opposite directions. One of
them skips a whole category of object the other doesn't bother skipping. Only
the start routine special-cases aircraft. Only the stop routine checks whether
there's still a player around to check against. Six differences like that, in
a pair of routines a tidier design would have made into reflections of each
other. A reimplementation that "cleaned that up" — made start and stop mirror
images because that's obviously how it should work — would be faithfully wrong
in six different places at once.

## The weapon that used to be weather

The most striking find of the week showed up almost by accident, while
confirming that Red Alert 2 and Yuri's Revenge really don't have an ion storm.
They don't — there's no weather event, no countdown, no EVA warning. But both
executables still contain the compiled source file path of the code that
became their Lightning Storm superweapon, and it's the ion storm's own file.
Lightning Storm isn't a new system inspired by the ion storm; it's the ion
storm's code, recompiled and repurposed, and it was never even renamed on the
way over.

The difference between the two versions shows exactly what changed: what
calls what. The Tiberian Sun version answers only to its own internal clock
and scripted map triggers — a mission's script decided the moment was right,
or a timer ran out. The sequel version answers to the generic "a player or
the AI fired a superweapon" pipeline, the same machinery every other
superweapon uses. An autonomous weather event, something that happened *to*
the map, got turned into a weapon a side *owns and fires*. Same code,
opposite relationship to the player.

## What actually ships

There's a retail surprise buried in the storm's own settings, too. In an
unmodified copy of Tiberian Sun, `IonStorms` ships set to off — and we haven't
found any code that reads it, so whether that setting is what suppresses random
storms, or whether the random-storm path simply isn't there to begin with, is
still open. Either way, no storm starts on its own. The crate pickup that's
supposed to summon one has a pick weight of zero, so it can never actually be
drawn. And `IonLightningRandomness`
is left at its default of 90, so nine times out of ten the storm just hits
empty ground instead of an object. Put those together and the ion storm, as
most players experience it, only ever happens because a mission's script
explicitly summons it — the "random weather" half of the system is present in
the shipped data and functionally switched off. `IonStormDuration` itself is
parsed out of the data file and then never consulted anywhere the storm
actually runs; the real duration comes from whatever the triggering mission set
instead.

Two claims made about this system during the week turned out to be wrong when
checked against the actual machine code — one of them would have "corrected"
code that was already right. Checking the raw instructions instead of the
plausible-looking read settled both, and it wasn't only new claims that
needed correcting; a couple of the fixes landed on assumptions from earlier
work, not just this week's.

## A backlog three times the size the list said

All of that — the mission graph above, the carryover snapshot, the storm's
own dice-roll ledger — plus three more systems this blog already covered,
needed writing down properly for a reader without a disassembler. That's
what the [Engine Reference](/reference) is for, and this week five entries
went live: the mission-and-carryover mechanics above, the ion storm, the AI
difficulty-behavior switchboard, the house-alliance system, and native
observer mode — the last three narrated here days ago, now given formal,
binary-verified write-ups. Catching up on that debt meant catching a
mistake in the tool meant to measure how much debt there was.

We keep a running list of finished, tested systems and cross-check it
against what's actually published. This week that list said fifty-three
systems were eligible. Looking closer said the real number was much bigger
— the list is generated by a small script matching a one-line confidence
rating against the exact wording used when the tool was built, and that
wording had since drifted: newer write-ups phrased the same judgment
slightly differently, and a literal text match didn't recognize it.
Fifty-one finished, fully verified
studies had been quietly excluded — more than half of everything on the
books — and thirty-eight of those already clear the reference section's own
bar: verified across all three games, or verified with an explicit
divergence. Publish-ready, and the tracker never said so.

The fix went in additively, not by loosening the check: a new section
listing exactly what the old wording missed, with its original confidence
text attached. It deliberately does *not* wave those fifty-one onto the
publish list — some genuinely need more scrutiny, and a strict filter's
whole point is to keep that visible rather than relax the pattern until
everything passes. All one hundred and twelve completed studies now sort
into three clean groups: fifty-three already correctly flagged as ready,
fifty-one the old check had been hiding, and eight that honestly aren't
ready yet.

## One author, two skeptics, twenty-three fixes

Every entry goes through the same gauntlet: one person writes the page fresh
from the research, then two independent readers go over it with different
jobs — one a pedant checking every number and rules-file key, the other a
skeptic hunting for any claim that doesn't hold across all three games.
Twenty-three required fixes came back across the five pages. All
twenty-three went in.

The single biggest category wasn't a wrong fact — it was the *scope* of a
true one. A finding earned by checking one game kept drifting, in drafts,
into language that reads as if it applies to all three. Observer mode was
the worst offender: the research fully verifies it for Yuri's Revenge and
separately confirms the identity mechanism and two statistics feeds for Red
Alert 2, and nothing more — Tiberian Sun has no such mode at all. An early
draft still described several consumers as though the whole family had been
checked everywhere. The fix isn't dramatic — narrower sentences, an explicit
version line — but it's the difference between an encyclopedia entry and
folklore with citations.

## Two corrections, and one near miss

Two of the twenty-three were real errors, not scope creep. The first lands
on ground this post already covered: when the mission resolver finds no
match, does the pending name come back blank, or keep whatever was already
there? A draft treated those as the same failure. They aren't. Miss because
nothing in the branch graph matches, and the reset that runs *before* the
scan leaves the name genuinely empty — as described earlier. Miss instead
because the current stage can't be located at all, and an earlier safety
check returns before that reset ever runs, leaving the stale old name in
place. Blank and stale are opposite failures with the same symptom.

The second was a claim repeated for weeks unchecked: that the campaign's
story-flag arrays are "never cleared when a new mission loads." Checked
against the code that sets up a fresh mission, that's false — both arrays
get unconditionally zeroed at that point. What's true, and narrower, is that
loading the mission's own data file doesn't clear them itself; they only
*look* untouched because the carryover step described earlier writes the
saved values straight back in immediately after the zeroing.

One more thing didn't survive the skeptic pass. A draft of the ion storm
entry cited Firestorm's own rules values under a filename that turned out to
belong to nothing but our own internal research notes — not a confirmed name
in any retail install. Firestorm's rule data ships sealed inside its own
game archive, not as a loose text file, and nobody had actually confirmed
what name, if any, it carries on disk. A modder chasing that citation would
have gone looking for a file that doesn't exist. We caught it before
publishing and pulled the invented filename rather than let it stand. The
risk was never the number. It was the name attached to it.

One of those five entries was the ion storm, correctly billed as exclusive to
Tiberian Sun and Firestorm — which raised a question none of the underlying
studies had answered: how does the game *know* Firestorm is there? That's
the question the function from the top of this post was supposed to answer.
It doesn't. So we went and found what actually does.

## The predicate that never runs

The function is a plain, ordinary one: it builds a handle to a specific
Firestorm file, asks whether it exists, and hands back yes or no — exactly
the mechanism a curious modder would go looking for. A search through the
entire executable — every relative call, every literal reference to its own
address, anywhere a table of function pointers might quietly be pointing at
it — turns up nothing. Nothing calls it. The one specific filename it checks
for is referenced exactly once anywhere in the whole image: from inside that
same dead function. Its neighbor in memory is blunter still — three bytes of
machine code that unconditionally answer "yes," whose one caller throws the
answer away without even looking at it.

Both were written for a real question, and neither one is how the game
actually answers it.

## The bitmask that does the job

The real mechanism is smaller than either of those functions, and has no
name attached to it at all — just one bit inside a general-purpose flags
value. At startup, the game sweeps two separate families of numbered archive
files looking for expansion content, checking each family from slot
ninety-nine down to slot zero, a hundred slots apiece, mounting whatever it
finds along the way. Only after that sweep does one routine decide what it
found: it sets the Firestorm bit if, and only if, *both* the first numbered
Firestorm archive, `EXPAND01.MIX`, and Firestorm's own `FIRESTRM.INI` are
present together. Either alone isn't enough.

That distinction matters: this bit tracks whether Firestorm is *installed*,
not whether you're currently playing a Firestorm campaign. Boot a base copy
of Tiberian Sun with the expansion files sitting alongside it, and the bit is
set the moment the game starts — whether or not you've ever launched a
Firestorm mission that session.

A handful of small accessor functions read and flip that bit, and the
shipped game checks it in seventy-three separate places: rules loading,
scenario parsing, the campaign-selection screen, side and speech
preparation, the random map generator, the shell's own menus, modem
multiplayer, even Westwood Online. World Domination Tour turns out to be
gated on this same bit.

Of those seventy-three, only two sit inside the simulation itself — the part
of the engine that has to produce identical results, frame for frame.
Everywhere else the bit governs presentation, data loading, and menus:
right, but not deterministic. And one of the two simulation branches is a
genuine hazard. When Firestorm is enabled, the routine that lays out a
house's starting base draws an extra number from the map's shared random
sequence to pick one of three possible buildings. With Firestorm off, that
draw never happens — so a Firestorm game and a base game pull from
different positions in the same shuffled sequence from the first building
placement onward, even with everything else identical. Same fix as the
storm's own dice: pin the ordered record of what got drawn, not just the
outcome.

## Six dead functions, one live kill

The Firestorm Wall — the barrier the rules file calls `FirestormWall` —
turned up the densest patch of finished, uncalled code we've found in the
project: a frame lookup, an off-switch that treats it like a superweapon,
both handlers for the mission-scripting actions that turn it on and off, and
two menu wrappers around those actions. Six complete functions, and the
retail build never reaches one of them. The compiler had also placed the
same logic inline wherever it's actually called from, leaving the
free-standing copy stranded — and reference material built independently of
this project, years ago, points its labels straight at those stranded
copies.

The wall itself isn't dead code, and its kill test deserves precision,
because the honest version is less dramatic than the myth. It isn't a huge
damage number overwhelming a health bar. The call that kills you hands over
a pointer to your own current remaining health as the damage amount, and
marks the hit in a way that tells the game's general damage-resolution
code — the same code every attack funnels through — to skip the armor step
entirely. Armor is never consulted. It still plays a burn animation, split
by altitude: something flying burns in place, in the air; anything on the
ground burns wherever the wall is standing. And — worth saying plainly,
since it'd be easy to assume otherwise — neither the wall's flag nor the
code that makes it block projectiles is exclusive to Tiberian Sun. Both
carry into Yuri's Revenge as live options, not fossils.

The kill test's simplicity made it look useful beyond just this wall, too:
integer arithmetic throughout, no randomness anywhere in it, and seemingly
only one point of contact with anything outside the wall itself — the cell
it occupies. That made it look like a clean early candidate for proving out
running the simulation across multiple threads, the kind of small,
self-contained system you'd reach for first. Two of those three claims turned
out to be wrong, in ways worth the rest of this section to explain.

## The wall's second sweep

The Firestorm Wall already had a finished reverse-engineering write-up, and
that write-up carried something better than most: an explicit port
contract, distilled down to exactly what an implementation has to
reproduce. Two bits of state. No randomness. No floating point. Four short
functions. On paper it was the cheapest item left on the list — read the
contract, write the port, pin the tests, done by the end of the afternoon.

Before writing any of it, the raw instructions got read again anyway,
function by function, straight from the disassembly rather than the
write-up's summary of it. Not because the write-up was suspected of
anything — because an implementation built from a summary can agree with
the summary and both still be wrong, and there's no way to catch that from
inside the summary itself.

The wall does not have one lethal sweep. It has two, and they use different
warheads.

The write-up's version is the one that's easy to picture: the wall's own
cell has an occupant list, the wall walks it, and whatever it finds dies to
the Firestorm warhead with armor skipped entirely. That much is correct.
What the write-up never describes is the second half of the same routine.
After that walk finishes, the wall looks outward — a five-by-five block of
cells centered on itself — and checks every walking unit it finds there.
For each one, it asks that unit's own movement controller a direct
question: are you, right now, moving through my cell? Every unit that
answers yes takes a forced, full-strength hit — not from the Firestorm
warhead, but from the demolition-charge warhead, the same one used for
planted explosives. And unlike the kill described earlier, this one is
completely silent: no burn animation, no flash, none of the visual feedback
the wall's own cell produces. The unit simply dies.

That second sweep is the wall players actually experience. It doesn't only
kill what's standing inside it the moment it switches on; it reaches out
and kills what's walking into it from up to two cells away. A port built
strictly to the contract would have shipped a wall roughly half as lethal
as the retail one — and every test for it would have passed, because the
tests would have been written from the same description that left the
second sweep out.

Three smaller things came out of the same pass. The routine opens with a
guard the write-up doesn't mention: hand it a building that isn't actually
a firestorm wall, and it returns immediately, before it computes anything.
The sweep of the wall's own cell only kills units — vehicles, infantry, and
aircraft — never a building that happens to share the cell. And the spark
animation has a shape that looks wrong until you know the context: a
corner segment that's already sparking, when the triggering event fires
again, destroys its own spark instead of leaving it alone, so repeated
events alternate rather than settle into a steady state. That's tolerable
only because the whole routine fires on scripted events rather than running
every frame — which is exactly why pinning down that it wasn't a per-tick
system mattered earlier in the reverse.

One piece of the contract turned out simpler than advertised. The write-up
had flagged a coordinate conversion inside the routine as an unusual
rounding trick, worth a caution. It isn't unusual — it's exactly what the
compiler produces for an ordinary signed divide by 256. The port reuses the
conversion already sitting elsewhere in the codebase instead of carrying a
second, bespoke version, and pins the two as equivalent across the sign
boundary as a test.

That leaves two things to walk back, and the second one stings more.

A few sections ago, this same wall's simplicity got called a clean early
candidate for proving out multi-threaded simulation, on the strength of it
having "only one point of contact with anything outside the wall itself."
The five-by-five sweep makes that wrong. The wall reaches into up to
twenty-five neighboring cells and interrogates the movement controller of
every unit inside them — a single-cell occupant walk was never an accurate
description of what the function does, only of the half of it the port
contract described.

The same paragraph also called the wall free of randomness. That was
checked, and it's true of the four functions themselves — every instruction
in all four was scanned for floating-point math and for calls into the
random-number generator, and there are none. But "this function contains no
randomness" and "this behavior involves no randomness" are different
claims, and the gap between them is one call deep. Every animation these
functions spawn — the spark on a corner segment, the flash when something
dies crossing the wall — is built by a shared animation constructor, and
that constructor pulls several numbers from the game's synchronized random
sequence, varying by animation type.

That matters more than it sounds. In a lockstep multiplayer game every
machine has to draw the same random numbers in the same order forever, so
anything that consumes one is game state, not decoration. A port that
treated the spark as cosmetic and skipped it would pull one fewer number
than the original — and from that instant every subsequent random decision
in the match, on that machine only, would differ. The same trap was already
documented earlier this month for a weather effect's lightning bolts,
where the visual had to be modeled as a *count* of draws for exactly this
reason. It got missed here anyway. The implementation now pins how many
animations each path creates, with a test that fails loudly if anyone
decides they're just graphics.

The cheap-to-verify half of the original claim does survive: the wall's own
arithmetic is whole numbers, so its expected values can be worked out by
hand with no floating-point emulation. The narrow-interaction half and the
no-randomness half don't.

The general shape of the mistake is the same one this whole post keeps
running into, just one layer further removed each time. A port contract is a
summary of a study, and a study is a summary of a function. Distill twice
and whatever the first read missed stays missed, however carefully each
distillation was done — that's how the second sweep went unnoticed. And a
function is itself a summary of everything it calls, which is how the
randomness went unnoticed one level below that. What caught the first was
reading the function through to its last instruction instead of stopping
where the existing description stopped. What caught the second was someone
refusing to stop at the function's edge either. The rule that actually falls
out of both isn't "read the function" — it's read until you reach something
you've already verified, not until you reach something that looks finished.

## Two more near misses

Two more things almost went wrong this week — not in the game, but in our
own tools and our own claims, caught before they became part of the record.

The first: a small search tool built this week, meant to scan the
executable for anything that might call a given function, has a flag meant
to widen its search across every section. As a side effect nobody had
noticed, that flag silently switched off the part of the search that
follows ordinary direct calls — the most common kind there is. Run against a
function that plainly is called, the tool cheerfully reports back that
nothing calls it. It came within one command of reporting the
addon-detection routine's own bit-setter as dead code, right alongside the
genuinely dead predicate this post opened with. The fix made the flag
strictly additive — it can only widen a search now, never narrow it — and
every earlier search that used it was re-run against something already
known to be alive. Same species of mistake as the backlog script above:
when a tool encodes a judgment call, what it silently excludes needs to stay
visible.

The second: an early draft of this very story overreached, describing the
startup archive-mounting routine as "present and live in all three
engines" — true only in the weakest sense. All three executables reference
the same internal format string, but a reference and a reachable function
are different claims. Red Alert 2's own copy has nothing anywhere in its
image that calls it — compiled in, permanently unreachable. The same code
in Yuri's Revenge is very much alive. Finding a string proves a function
exists; it says nothing about whether the game ever runs it.

## The reader we already had

One item on the list was a small tool: Tiberian Sun keeps its rules data
sealed inside its own archive format, and without a reader for those
archives, a write-up can prove what a setting is *called* — by watching the
game parse that exact name and store it in that exact place — but not what
value the shipped game actually gives it. Every claim about a value had to
be hedged on outside sources.

Writing that reader took no time at all, because it already existed. It had
been built months earlier as part of the archive-format work, it already
handled the encryption those archives use, and it read the retail files
without a single change. Archives nested inside other archives, which
looked like the hard part, needed nothing special either — every command
already took a plain file path, so reaching a file two archives deep is
just doing it twice. The only new code was one lookup command. The gap was
never a missing tool. It was a missing look.

What it bought was worth the embarrassment. The wall's second sweep — the
one described above, the one that kills things moving through the wall's
neighbourhood — turns out to use the game's ordinary high-explosive
warhead, while the wall's own occupants die to a dedicated Firestorm one.
Two different weapons for two different ways of being in the wrong place.
That was visible as two adjacent settings before; now it's a fact about
what the game does.

And then the detail that quietly settled an argument. The Firestorm
expansion ships its own complete copy of the rules file. Compared against
the base game's copy, it differs by **three lines** — a guard-range value
on the GDI wall, the Nod wall, and the Firestorm defence structure.
Everything else is identical. Every Firestorm setting the wall needs is
already sitting in the unmodified base game's rules, shipped to everyone
who ever bought Tiberian Sun without the expansion.

That matters because of what it rules out. The earlier work concluded, from
the instructions alone, that the expansion gate is a bit in a bitmask and
nothing else — not a check for whether the data is present. Reading the
instructions could never have distinguished those two possibilities; both
would compile to the same thing. The data can. The content was always
there; only the switch was missing.

## One field, two doors

Two loose ends were left dangling on the wall write-up: both of its lethal
sweeps skip a candidate whose *type* has a particular flag set, and each
sweep reaches that flag through a different entry in the object's function
table. Different entries strongly suggest different questions being asked.
The obvious guess — recorded as a guess — was that one of them asked about
the owning player, since a nearby field on the player object tracks whether
Firestorm is currently active.

Both entries turn out to be the same accessor. One of them is a
three-instruction forwarder whose entire body is "look up this object's
function table and jump to the other entry." Two doors, one room. The flag
they both read is a per-unit-type setting the game parses out of the rules
under the name `IgnoresFirestorm` — a documented modder-facing switch, sitting
in plain sight the whole time, and the guess about the owning player was
simply wrong.

The other loose end was more interesting, because naming it changed what
the wall does. The sweep asks each nearby mover's movement system a
question, and the write-up had described that question as "are you headed
through my cell." It isn't. It's "are you *in* my cell" — the mover's
current destination-in-progress gets converted to a cell and compared
against the query. Present tense, not intent. A small correction to one
sentence, and it makes the next finding possible.

## The tunnellers

The last item was subterranean movement: the Subterranean APC, the Devil's
Tongue, units that vanish into the ground and come up somewhere else. The
task description laid it out clearly — one system, tying together a
burrowing movement mode, a tunnel object a map can declare, and a handful
of terrain checks. It named the function that hands a cell its tunnel, and
reasoned from there that the burrowing units travel through those declared
tunnels.

They don't. Not once, anywhere. Across the entire burrowing movement
system there is not a single reference to the tunnel object, to the terrain
checks, or to the pair of fields that tunnel traversal actually runs on.
There are **two** systems here, and they never touch:

One is a movement mode. A unit dives out of the world, travels to any
coordinate you like, and comes back up. Free-form; no tunnel required, none
consulted.

The other is a map feature. A scenario author declares an entrance cell, a
direction to enter from, and an ordered list of hops — and units walk that
fixed path one waypoint per tick. It is a scripted route, not a place a
burrowing unit can go.

They meet in exactly one place, and it's cosmetic: an object standing near
a declared tunnel gets its draw depth nudged so it doesn't look wrong.
Building an implementation on the task description's model would have
produced a game where you cannot burrow unless the mapmaker drew you a
tunnel first — which is not the game.

The movement mode itself is a seven-state cycle, and the symbol names
gave that away before a single instruction was read: seven separately-named
state handlers sitting in a row. Turn to face the destination. Play the dig
sound and start burrowing. Sink until you are exactly one cell-height below
the surface. Travel. Rise until you meet the terrain. Finish emerging. Plus
one more state that exists only to unwind a cancelled trip.

A few things about it that a player would recognise but never be able to
articulate. You cannot fire at any point in the cycle — including the very
first state, where the unit is still standing on the surface turning
around, having done nothing yet. The unit only counts as underground during
the travel state proper; while sinking and rising it is still, as far as the
rest of the engine is concerned, on the ground layer. It casts no shadow
while sinking, travelling, or rising, and casts one again the instant it
finishes. And the dig sound plays on the way down *and* on the way up, at
the exact frame the unit crosses fifty units of depth.

The dispatcher that picks between those seven states decrements its state
value before checking whether it's in range. Which means the state numbers
and the table positions are off by one from each other — the same trap the
trigger-action work hit earlier this week, caught the same way: by reading
the arithmetic rather than trusting a table of names to line up.

## Nineteen units at a time, and one unit of angle

The travel step is the part an implementation has to get exactly right, and
it is more delicate than it looks. Each tick, the game computes the bearing
from where the unit is to where it's going, converts that angle into the
compact integer form the engine uses for facings, converts it *back* to a
real angle, and steps nineteen units along it. Arrival is declared at
twenty units — which is why the step is nineteen and not twenty; the unit
can never overshoot the band.

Two details in that round trip are not incidental. The angle gets truncated
to sixteen bits partway through, so it wraps rather than clamping. And when
it's converted back, the value subtracted is one unit short of a perfect
quarter turn. Not a quarter turn. A quarter turn minus one.

The error that introduces is about five thousandths of a degree. Nobody
will ever see it. But the coordinates it feeds are integers, and over a
nineteen-unit step, five thousandths of a degree is occasionally enough to
land on a different integer — and integers are exactly what a lockstep
multiplayer game and a replay file agree on. Reproducing the *intent* here
would be wrong; the only correct implementation is the one that also
subtracts one unit short.

This is why that step doesn't get hand-computed. A chain of trigonometry,
a truncation, an off-by-one, and two round-toward-zero conversions is the
textbook case where a careful implementation and a careful reading of the
original can share a misunderstanding and agree with each other perfectly.
The expected values will come from the original binary running under
instrumentation, not from anyone's arithmetic.

Two more things worth knowing about tunnellers, both of which a player has
probably experienced without explanation. **A burrowing unit can be killed
by having nowhere to surface.** If it arrives underneath a spot where the
map offers no legal place to come up — after two separate attempts to find
one nearby — it takes lethal damage on the spot, from the ordinary
high-explosive warhead. And the check the game supposedly uses to decide
whether a unit may enter a tunnel is five bytes long: it ignores the cell,
ignores the unit, and returns yes. Whatever gating exists, it isn't there.

The other one connects back to the wall. Because a burrowing unit's
movement mode never implements the question the wall's sweep asks — it
inherits a default that always answers "no" — **a burrowing unit is never
killed by a Firestorm Wall's outer sweep.** It walks under the wall's
neighbourhood untouched. Neither piece of work could have found that alone;
it took naming one function in one system and reading the vacancy in the
other.

## Four more that are never called

The dead-code theme did not let up. Four of those seven state handlers are
never called by anything. The dispatcher handles those four states with
inlined copies of their code, and the compiler left the standalone versions
behind — named, complete, unreachable.

That claim was checked the way this week taught: the three handlers that
*are* reached were run through the identical scan first, and each showed
exactly one caller. Three live, one caller each; four dead, none. Without
the live three as a control the four zeros would have proved nothing about
the code and everything about the scan.

Three of the four orphans match their inlined twins exactly. One doesn't,
and the difference is a small window into how the original was written.
Where the live inlined version reads a unit's height once per tick before
deciding which state to run, the orphan reads it fresh, inside the state,
where the logic actually needs it. The orphan is the shape the source was
written in; the live copy is the shape the optimiser left behind after
hoisting that read out of the switch. The abandoned function is the more
faithful record of the programmer's intent, and the unreachable one is the
only place that intent survives.

## Expected exclusive, found everywhere

The task description called subterranean movement a Tiberian Sun mechanism
that the later games don't carry in this form. It seemed safe. Nothing in
Red Alert 2 or Yuri's Revenge burrows.

The engine is in all three, alive. The identifier the movement mode
registers itself under is byte-for-byte identical across the three
executables, and all three actually perform that registration at startup —
checked against the other movement modes as a control, so "it's in there" is
not being mistaken for "it runs." Red Alert 2 has a complete function table
for it and a factory that allocates it at the same size Yuri's Revenge
does. All three parse the map section that declares tunnels. The routine
that hands a cell its tunnel is byte-identical between Red Alert 2 and
Yuri's Revenge and structurally identical in Tiberian Sun — differing only
in *where* the field sits in the cell, which grew by a fixed amount between
the games. Same instructions, shifted field: the signature of one codebase
compiled three times.

So what's Tiberian Sun-exclusive isn't the machinery. It's the content —
the units that use it, and the tunnel artwork. The later games kept the
whole mechanism and shipped nothing that employs it.

That's the second time this has happened. Earlier work expected a Tiberian
Sun campaign feature to have been demoted in the sequels and found the same
live code in all three there too. Two for two, in the same direction: a
feature that *looks* exclusive because only one game shipped anything using
it. The absence of a unit is not the absence of an engine, and the only way
to tell them apart is to go read the other two executables instead of
noticing what isn't in the box.

One honest limit, written down rather than glossed: what's been shown is
that the machinery exists and runs in all three, not that it *behaves*
identically. The state handlers themselves were never compared across the
three games. Until they are, "present in all three" is the whole claim.

## Why it's worth the care

None of this is behavior a player consciously tracks. Nobody counts which
flag decided whether a campaign ending was silent or came with a credits
screen, or notices a Firestorm game drawing from a different point in the
random sequence than a base game would. That's exactly why it has to be
exact — faithfulness isn't measured by the moments people notice, it's
measured by the ones they don't, where a small deviation compounds quietly
until a saved game or a replay stops matching the game it came from.

Every story this week shared the same shape underneath. Something that
looked like the answer — a well-named function, a rounding call, a routine
that mirrors its own opposite, a port contract, a checklist, a filename we
half-remembered — wasn't quite it, or wasn't all of it. The fix was never
cleverness, just going back to the raw instructions or the raw list and
checking what was actually there instead of what the label promised. That
held for the game's own code and, four times this week, for our own tools
and our own claims in exactly the same way — a search flag that quietly
narrowed what it looked at, a checklist that quietly excluded finished
work, a claim about how narrowly a wall's effects reached, and a claim that
the same wall involved no randomness at all. The last two were both offered
before we'd read far enough to know better, and the last one had already
been written into working code by the time it was caught. All four were
caught the same way: by making the exclusion visible, or by rereading the
thing itself, instead of trusting the summary. A mission resolver, a storm's
dice, a bit that never got a name of its own, a wall that kills from two
cells away instead of one and quietly rolls dice while it does — none of it
is worth documenting accurately if the tools and the claims doing the
documenting are the next thing that needs auditing.

By the end of the week the shape had turned up one more time, and from the
opposite direction. Twice now, a feature we expected to be exclusive to one
game turned out to be running in all three, with only the content that uses
it missing from the sequels. And twice, a task description we wrote ourselves
turned out to describe a system that doesn't exist — one mechanic where there
are really two, tied together by a connection the code never makes. Both were
settled the same way as everything else here: not by arguing about the
description, but by scanning the actual code for whether the connection was
there at all, and by opening the other two executables instead of trusting
what wasn't in the box. The label is the hypothesis. The instructions are the
answer.
