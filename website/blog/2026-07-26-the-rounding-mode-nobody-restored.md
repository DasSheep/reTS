---
slug: the-rounding-mode-nobody-restored
title: "The Rounding Mode Nobody Restored — and Three More Things That Weren't Missing"
date: 2026-07-26T02:30:00+07:00
authors: [rets-team]
tags: [devblog, movement, subterranean, tunnels, bridges, overlays, walls, floating-point, determinism, faithful-port, verification, multi-game, tiberian-sun, tooling]
last_verified: 2026-07-26
---

Deep in Tiberian Sun's executable there is a helper that converts a
floating-point number to an integer. Every game does this thousands of times a
second. This one begins by loading a specific x87 control word — the register
that tells the floating-point unit how to round — and then it never puts the old
one back.

That is not a bug you would ever notice. The control word it loads says *round
toward zero*, and a function whose entire job is truncation wants exactly that.
The helper works perfectly. It just leaves the machine in that state
afterwards, forever, for every other calculation the game does.

We spent two sessions finding out how much that costs.

<!-- truncate -->

## Building an oracle we didn't have

The subterranean units — the Devil's Tongue, the Subterranean APC — burrow out
of the world, travel underground, and surface somewhere else. Reversing the
state machine that drives them was straightforward. Verifying it was not.

The underground travel step chains an arctangent, a truncation to sixteen bits,
an off-by-one angle offset, a sine, a cosine, a multiply and two
float-to-integer conversions. Every link in that chain is individually plausible
and the whole thing is collectively unverifiable by reading. Our own workflow
has a rule for this: *if the port and the study could share the same misreading
and still agree, confirm it against the real thing.*

The route we'd built for that — driving the retail game live under emulation —
was unavailable. The host was down, and the tooling targeted a different
executable in the family anyway. So instead of waiting, we went one level down
and generalized something smaller: a harness that maps **the whole retail
executable into an emulator at its real addresses** and runs an arbitrary range
of its actual instructions. No virtual machine, no game process, no Wine. The
shipped constants are the shipped constants because they are being read out of
the shipped file.

Two things had to be true for that to be an oracle rather than a convincing
imitation, and both took a while to learn.

**First, the emulator's floating-point state has to be set by making the guest
execute the instruction that sets it.** Writing the control-word register
directly through the emulator's API sets the register field without
reconfiguring the emulator's actual float behaviour. It reads back exactly what
you wrote, while every result stays silently mis-rounded. We caught this only
because a value that should have been 256 × √2 came back at single-precision
grade.

**Second, you have to check that the range you're running is one the emulator
computes exactly.** The emulator implements the transcendental floating-point
instructions with host doubles rather than true 80-bit arithmetic. Anything
executing one is being approximated — plausibly, silently. So every capture now
sweeps its reachable code for those instructions first and refuses to proceed if
it finds any.

The engine turns out to dodge this entirely, for a reason that matters more than
the tooling.

## Their sine is not your sine

The four math routines this code calls look exactly like the C runtime's
`atan2`, `sin`, `cos` and `sqrt`. They are not. They are the engine's own
table-driven approximations — routines we had already reversed months earlier
for an unrelated system, sitting one folder away in our own tree, and nobody
connected them.

The gap is not small and not uniform. Their `atan2(1, 1)` is `0.7735` where the
real answer is `0.7854`. Their `sqrt(65025)` is `254.998`, not `255`.

We measured what a port built on the standard library's trigonometry would do:
across 720 evenly spaced headings, it produces **a different integer coordinate
on 118 of them — 16.4%** — always by exactly one unit. Coordinates are
synchronized state in a lockstep multiplayer game. That is a desync generator.

And it is nearly invisible. The same substitution agrees with the binary on
**eleven of the twelve** cases we'd picked by hand before running the sweep. A
reasonable test suite, written carefully by someone who understood the system,
would have certified the wrong implementation.

That is the argument for sweeping rather than spot-checking, in one number.

## What the rounding mode actually costs

Now back to that control word.

Because the truncation helper never restores it, *round toward zero* is the
state every floating-point instruction in the game runs under. It applies to the
arithmetic, not just to the conversions. And it changes answers.

For a unit heading due south, one term of the travel step works out to
`-0.00000000000000465`. Added to a coordinate of `32896`, rounding to nearest
gives back exactly `32896`. Rounding toward zero does not — it lands a hair
below, and truncation then takes the whole unit off. **The four compass
directions are asymmetric**: north and east step cleanly, south and west each
lose one unit sideways.

Nine of our 732 captured vectors disagreed with the port until that was
modelled. With it, all 732 agree.

This session we found the same hazard in a second place. The dig-in duration
divides a constant by a speed value and by a rules key. At a modded speed of
`0.1`, the hardware produces **639** where round-to-nearest arithmetic produces
exactly `640.0` and truncates to **640**. One frame, on a synchronized timer.

Rust gives you no control over rounding mode, so the fix is arithmetic rather
than architectural: compute the ordinary quotient, recover the exact leftover
with a fused multiply-add, and step one representable value toward zero when the
leftover says the ordinary rounding overshot. Our lint configuration had already
gone out of its way *not* to ban fused multiply-add, with a note explaining it's
exactly specified and therefore safe across platforms. That note was written for
a portability reason. It paid for itself here.

## Divide by zero, get zero

While sweeping the duration formula across its inputs, we tried the degenerate
one: what if a mod sets the speed field to zero?

The division produces infinity. The engine's conversion helper is a bare
64-bit store instruction with no software clamp, so the floating-point unit's
masked error path writes its "integer indefinite" pattern — and the calling code
reads only the **low half of that pattern, which is zero**. The timer expires
instantly. No crash, no trap, no enormous number.

Rust's float-to-integer conversion *saturates*. A natural implementation returns
the maximum integer here and strands the unit underground permanently.

The part worth recording: our codebase already contained a helper built for
precisely this "the caller reads only the low half" shape, with a doc comment
explaining the mechanism correctly. That helper is **also wrong for this input**,
because the language's saturating conversion gives one extreme for positive
infinity and the other for negative, and only one of the two happens to have a
zero low half. A helper that models the right mechanism can still be wrong on
the input you actually have. We wrote a third one.

## Reading the notes before trusting the notes

With the numeric half confirmed, the integer half of the port — seven states,
the movement and abort entry points, the tunnel-network object, six cell
predicates — was ready to be written straight from our own reverse-engineering
notes.

We re-read those notes against the disassembly first. Four things were wrong.

The worst concerned the descent. Our notes said the descent checks a cached
height value against the burrow floor. It does — and then, on the other branch,
it **re-reads the coordinate fresh and checks that too**, against the same
number but with a *different comparison*: the cached value is tested for
equality, the fresh one for less-than-or-equal, and both jump into the same
transition. A port written from the notes keeps descending for one extra frame
whenever the two disagree, or whenever the unit is already below the floor
rather than exactly on it.

That correction also settled a question we'd logged as open for two sessions —
whether two different height accessors agree with each other. They don't need
to. The live code consults both.

Two of the cell predicates turned out to be misdescribed in a more interesting
way. We had them recorded as near-mirrors: one sweeps north and west, the other
sweeps southeast. In fact the first is a **pairwise edge detector** — it reports
true only where a tunnel cell is immediately followed by a non-tunnel one, which
means three consecutive tunnel cells in a row match *nothing*. It isn't asking
"is there a tunnel near me". It's asking "where does the tunnel end". And the
two functions disagree about map edges: in one, running off the map ends the
current search direction; in the other, it abandons the entire query and
answers no.

Neither of those is the kind of thing you find by reading a summary. Both are
the kind of thing that produces a port which looks right and drifts.

## Two loose ends, tied

The direction tables that all of this walks — the eight compass offsets — live
in a section of the executable that has no contents in the file. They're
zero-filled at load and populated by an initializer at startup, which means they
**cannot be compared across the three games statically**. We'd flagged that as
unresolvable without a live read.

The same whole-image emulation technique handles it: find the initializer, run
it, read the memory back. Identical in all three games, entry for entry. The
detail that mattered was that the two related tables **don't share a layout** —
one packs its pairs into four bytes, the other uses eight — and both had to be
determined from how consumers index them rather than assumed. A port that
guessed one layout for both would have read the second table as noise.

Then the recovered values turned out to match a table already in our tree, ported
from a completely unrelated piece of work. Two reverses from opposite directions,
same eight pairs.

The last loose end was a genuine risk to a conclusion we'd published to
ourselves. We'd established that every *consumer* of tunnel state is identical
across Tiberian Sun, Red Alert 2 and Yuri's Revenge — but never checked the
function that *produces* it. Identical consumers over a divergent producer still
diverge.

Two surprises there. The addresses in our own tracking issue pointed at a
basic block *inside* the function rather than the function; and the function
turns out to carry **two different names in two different reverse-engineering
communities**, which is why nobody had noticed it was already partially ported
from the other end of the family. Tiberian Sun's own debug symbols settle it.

The verdict needed scoping, and the scoping is the finding. The tunnel-specific
block is **47 instructions with zero differences across all three games**. The
enclosing function is *not* — the sequels diverge from Tiberian Sun in about 15%
of their instructions, in an overlay path, a vegetation special case, and a
drawing offset. All upstream or downstream of the tunnel logic; none of it on
that path. "The function is identical" would have been false. "The tunnel path
is" is true, and that's what discharges the risk.

The nicest corroboration of the two sessions came free: that block allocates an
object of one size in Tiberian Sun and a larger one in both sequels, and the
difference is *exactly* the growth we'd derived last session from an entirely
unrelated argument about object headers. Two independent routes, same number.

## Sixteen functions that were always one function

The second half of the day went at bridges — the biggest system in Tiberian Sun
we hadn't touched. Thirty-nine functions, and the original developers named them
so explicitly that the whole design reads straight off the list: damage and
destroy, times two bridge kinds, times two orientations, times two corners, all
hand-expanded into separate routines. Plus a repair for each kind.

Our own notes said this made it "one of the cheapest large systems still
unreversed". Three of the things those notes asserted turned out to be wrong.

**The first was the shape of the call graph.** The two public entry points were
described as the dispatchers over that matrix. They aren't. There are two *more*
dispatchers in between — neither of which has a name in any symbol database we
have — and the sixteen matrix routines are never reached directly from either
public entry point. The recon had every address right and the call graph wrong,
which is the recurring failure mode of working from a symbol list: it tells you
what exists, never what calls what.

**The second was whether the matrix is real.** The interesting question about
sixteen hand-expanded functions is whether they're genuinely different logic or
the same code pasted with different constants. That deserves a number, not an
impression. So: the two damage routines for the two bridge kinds are both the
same byte length, both ninety-five instructions, and differ in **exactly one
instruction** — which tileset they read from. The two destroy routines are both
the same length, both two hundred and eighty-five instructions, and differ in
**three**. Ninety-nine percent identical.

So the port is one routine parameterised by kind, not two implementations — and
that claim is licensed by a diff rather than by taste. The corner axis collapses
the same way: nineteen differing instructions out of ninety-three, every one of
them a constant, no new branches anywhere.

The axis that does *not* collapse is orientation. East-west and north-south are
a genuine shape difference: a different tileset for the middle sections, an
extra guard on every north-south routine, and — the one that would really hurt a
port — **the same byte read as a bit test on one axis and a magnitude comparison
on the other**. Same field, different question. Testing at one orientation would
never reveal it.

## Two numbers that were the entire design

The third wrong assumption was about an asymmetry our notes had flagged as
"itself a finding to pin". Two of the three bridge kinds get nine functions
each. The third gets two. Why?

Three hypotheses, all testable. *They're single-tile, so there's no orientation
to expand over* — refuted; the code walks up to three cells. *They're destroyed
by conversion rather than a state machine* — confirmed. *They aren't repairable*
— confirmed, and **actively** so: the repair scan marks a cell eligible on a
tileset match and then writes the flag **back to zero** when the cell turns out
to be one of these. It isn't an omission. It's a rejection.

Then the state machine itself fell out of a discrepancy we'd nearly filed as
noise. The *shape query* for these bridges accepts twenty-eight values. Every
*damage* path gates on twenty-six. We spent a while assuming one of the two
readings was a mistake — and the two extra values turned out to be exactly the
literals the destroy helpers write when they finish. So the lower range means
*damageable* and the top two mean *already destroyed*: re-damaging a wrecked
bridge is a no-op at the caller's gate, while a geometry query still sees a
bridge-shaped cell. Twenty-six versus twenty-eight **is** the design.

And the real answer to the asymmetry arrived last, from a completely different
direction. A field we'd been calling "the tile number" turned out — once we
found the code that *writes* it rather than the code that reads it — to be an
overlay id: an index into a separate type table entirely. Which means the small
bridges and the large ones **aren't stored in the same system at all**. One is a
flat per-cell overlay. The other is a placed multi-cell tile object carrying
sub-tile geometry, a height level, corner identity and a damage stage.

That is why the machinery can't be shared. Corner expansion, the end-cap state
propagation, the middle-section flood fill — all of those are operations on
placed tile objects, and an overlay simply has none of that structure. The
asymmetry isn't a design shortcut. It's two different data models meeting at one
function.

That field had been described wrongly in *two* places, in opposite directions:
an older piece of research called it an owner field, and this session's own
first pass called it a tile number. Both are now fixed, and the correct owner
field — one slot further into the structure — is pinned from the function that
writes it.

## The train bridges nobody thought were still there

Tiberian Sun has trains. Red Alert 2 and Yuri's Revenge don't. It is settled
community knowledge that the sequels kept the ordinary bridges and dropped the
rail ones, and our own tracking issue said so.

Both sequels contain the complete rail-bridge matrix. All eight routines, the
dedicated dispatcher, and the supporting cell function — compiled in and
**correctly wired**, byte-identical in control flow to Tiberian Sun's.

Finding them was the interesting part, because neither sequel's symbol data
names a single bridge function. For Yuri's Revenge there was one thread to pull:
a named function that we suspected — from nothing more than a plausible
alternative name — was the same routine. It diffs identically over sixty-nine
instructions. Then the corroboration that made it certain: the original's
reference count on that function is eighty, the sequel's is eighty, and the
eighty decomposes the same way in both — eight callers from one place,
twenty-four from another, twelve from a third, and so on. The remaining twelve
functions were then located by fingerprinting the *spacing between calls* inside
each routine, and every prediction was confirmed on first check.

Red Alert 2 gave up nothing at all by name, so that one was pure signature work.
A twenty-byte prologue pattern hit **exactly eight times** in four megabytes of
code, clustering into two groups of four with the same internal size gaps the
original has. And then the call graph confirmed the split without our help: one
cluster calls the rail-specific cell function, the other calls the ordinary one.
That wiring only exists if this is a working rail-bridge implementation.

This is the third time on this project that something "everyone knows" is
exclusive to Tiberian Sun has turned out to be present and live in all three
games. Three for three. Each time the *engine* was shared and only the *content*
was removed — and each time the received wisdom was actually about the unit
roster, not the code. It has stopped being a surprise and started being a rule:
when a system looks exclusive, go and look for the code before believing it.

## The number in the file is not the number in the engine

The bridge work left one loose thread that turned into the day's third piece of
work. Low bridges, it turned out, aren't tiles at all — they're *overlays*, the
flat one-byte-per-cell decorations that also carry walls, fences, train tracks,
tiberium, veins and crates. So we went after the overlay system itself.

An overlay has no object identity. A cell stores a single number — the overlay
type — and a single state byte, and that's the entire per-cell representation.
Everything else lives in a shared type object looked up by that number. The
numbers themselves come from a list in the rules file, and the list is
*numbered*, so the obvious reading is that the number in the file is the number
in the engine.

It isn't. The engine's id is the **position** at which a type gets appended to
its array, and Tiberian Sun's list skips two keys — 40 and 41 are simply absent.
So the id is the key minus one for the first thirty-nine entries and the key
minus **three** for the remaining hundred and forty-one.

What makes that dangerous is that it half-works. Read the key as the id and the
first block is off by one — wrong, but wrong in a way that still lands you
inside the right general neighbourhood. Past the gap it silently becomes three.

It nearly cost us a real result, too. One line of investigation reported that
entry 74 was a crate prop, sitting right in the middle of the range we'd
previously established — from the assembly, in an entirely separate piece of
work — as the destructible low bridges. That reads like a refutation. It was the
same numbering confusion: that check had been done in key space. In position
space, 74 is the first low bridge and 101 is the twenty-eighth, and the range is
*exactly* the twenty-eight low-bridge entries, no more and no less.

The nicest part came from the shipped data saying something on its own. The
assembly work had concluded that two specific ids mean "this span is already
destroyed". Reading the rules file with no knowledge of that conclusion, those
two ids turn out to be the only entries in the whole run that stop forcing their
terrain type and turn invisible on radar — which is exactly what a collapsed
bridge section should do. Two independent lines of evidence, neither able to see
the other, landing on the same two numbers.

## The default nobody passed

The parser that reads each overlay's settings looked like the most routine code
in the system, and we wrote down what we thought it did: for each setting, ask
the INI file for a value, and if it isn't there, use `false`.

That would mean two flags which the *constructor* deliberately sets to `true`
get quietly flipped to `false` for any type whose section doesn't mention them.

Here is what the code actually does, for each of eighteen settings in turn: load
the field's **current** value, push that as the lookup's default, call the
getter, store the answer back. The default isn't a constant at all — it's
whatever the field already holds. An absent setting **preserves** the
constructor's value rather than zeroing it. And there's a second guard in front
of the whole thing: if the type has no section in the rules file, the parser
exits before touching anything. Which matters more than it sounds, because
twenty-four of the hundred and eighty shipped entries have no section — including
four of the seven wall types.

The wrong reading had survived a first pass *and* an adversarial second pass. It
was an entire column of a table, uniformly wrong and uniformly plausible, and
the only way to catch it was to read the pushed argument rather than the call.

Then the same shape appeared again, in the opposite direction. Both passes over
the wall-damage routine described its final branch as *"returns zero, with the
owner, the overlay and the damage state all untouched."* The instruction in
question sets the **return value** to zero. The damage advance had already been
written to the cell, several instructions earlier, and the destroy test reads it
back afterwards.

Take the return literally and the whole `DamageLevels` setting becomes inert:
walls would only ever be destroyed outright or completely unaffected, never chip
down through stages the way they visibly do in the game. That build would look
almost right. Almost right is the worst kind of wrong, because nothing about it
prompts you to look.

## One byte, three meanings

Three separate lines of work converged on the same byte of cell state. The wall
code packs a damage stage and a four-way connection mask into it. The vein code
tests it against a threshold. The bridge work had already named it the bridge
damage stage.

A cell can't be a wall and a high bridge at the same time, so it isn't three
fields — it's one byte whose meaning is chosen by whatever happens to occupy the
cell. Modelling it per-system, which is what you'd do if each investigation
wrote up its own findings in isolation, would have produced three mutually
incompatible pictures of the same storage.

The wall machinery sitting on top of it is more characterful than we expected.
Connections are a four-bit cardinal mask — and walls connect to *buildings*, not
just to other walls, but only two of the seven wall types can reach the GDI gate
branch and only one can reach the Nod one. Wire fences, barbed wire and wooden
fences connect to no building at all. Damage carries a probabilistic roll off
the **synchronised** random number generator, which puts walls on the
determinism contract alongside bridge rubble. And the destroy rule has a real
asymmetry: at the second-to-last damage stage, an isolated section dies while a
connected one survives.

One wall type is also excluded, alone, from the "isolated sections vanish"
behaviour the other six get. We don't know why yet. It's in the binary.

## When the tool's silence isn't evidence

Nine functions in this system — including the settings parser, the single most
important function in it — have no entry in our disassembler's function
database. They're only ever reached through virtual dispatch, so the automatic
analysis never created records for them, and the standard query answers
"function not found" for addresses whose names we know and whose bytes are
sitting right there in the file.

This has now cost us five separate sessions, which is why there's a purpose-built
tool that reads the executable directly and ignores the analysis database
entirely. Taking the tool's silence as evidence of absence would have deleted
about a third of this class's behaviour from the write-up.

It is the same mistake as the rest of the day, wearing different clothes. A
control word that was never restored. Bridge machinery assumed removed because
the vehicles were. A setting absent from a file, read as a setting set to zero. A
tool that couldn't find something, read as the something not being there.

## The number we had to make smaller

One last note, on honesty about progress — and it got sharper as the day went
on.

Our coverage tracker counts references to binary addresses inside ported files.
The morning's port made it report a jump of thirty functions, which was wrong:
a port cites addresses for the *seams* it deliberately doesn't implement — the
animation system, the sound call, the checksum engine — and the tracker counted
every one as implemented. The real figure was eighteen. Twelve phantoms.

The bridge port then made it report thirty-two. We went through all thirty-two
one address at a time. **Fifteen are real. Seventeen are seams.**

That's worse than a rounding error, and the reason is structural rather than
accidental: the over-count scales with how *well* a module documents its own
boundaries. The bridge port is a well-behaved one — it lists what it models, and
then it lists the eight things it deliberately doesn't, with addresses, because
our own conventions require exactly that. Every one of those became a phantom.
The worst case isn't a sloppy port; it's a conscientious *partial* port of a
large system, because a partial port is precisely the one that has to name a lot
of seams.

The tempting fix — delete the addresses — would buy an accurate percentage by
destroying the traceability the addresses exist for. Those citations are how a
reader finds the *next* piece of work. So the number stays wrong in the tool for
now, the correction is recorded against it, and the real fix is a tag the
tracker can honour.

The overlay port, written later the same day with that lesson in hand, cites
addresses only for behaviour it actually implements and names its seams without
them. It contributed **five** newly counted functions and **zero** phantoms. The
problem was never that we were porting too little. It was where the addresses
were being written down.

---

The three parts of this day were about completely unrelated things — a
floating-point register, a bridge, a fence — and they failed in the same
direction every time. Every capture we ran to *confirm* something corrected it
instead. Every premise we inherited about the bridge system was right about the
addresses and wrong about the structure. Twenty-six claims in the second part
needed fixing before a word of the write-up was written, and two more in the
third survived both a first pass and an adversarial second one.

Most of those were caught not by going back to the binary but by reading a
report against its own cited evidence — which remains the cheapest verification
available and the one that keeps paying. The ones that *did* need the binary
needed it for a specific reason: they were claims about what an instruction
means, not about whether two claims agree. "The default is `false`" and "the
function returns without effect" are both perfectly self-consistent. They're
just not what the bytes say.

If there's a single thread here, it's that **absence is the hardest thing to
read correctly**. A control word that was never restored looks like a control
word that doesn't matter. Bridge code compiled into a game with no trains looks
like code that was removed. A setting missing from a file looks like a setting
set to zero. A function the tool can't find looks like a function that isn't
there. In each case the wrong reading is the comfortable one, and in each case
it produces something that runs, looks plausible, and is quietly wrong.

Three of the morning's five findings are rounding-mode findings, and not one of
them is visible in an unmodified game. The rules key involved ships as `1`, so
the scaling asymmetry, the truncation hazard and the divide-by-zero path are all
dormant in retail and all live the moment a mod touches it. An engine tested
only against shipped values would carry three latent desync generators and pass
everything.

Which suggests the next piece of tooling: not "does this match the original at
the shipped value" but "does it match across the whole reachable range of the
knob". Today that sweep was done by hand. It shouldn't be.

## The question that answered itself wrong twice

The day ended by closing something it had opened. The bridge work had left one
disagreement standing: two separate parts of the engine appeared to say opposite
things about which way a particular kind of bridge runs. Both readings were
correct about the instructions they described. We wrote down what would settle
it — read a certain table of compass directions out of a *running* game, since
that table is built at startup and sits empty in the file — and moved on.

Both halves of that plan were wrong.

The table never needed a running game. It is built at startup, yes, but *by
code*, and code can be run on its own without the rest of the program around it.
We had already done exactly that, in a different investigation, two sessions
earlier. The eight values had been written down in another document the whole
time. Empty in the file does not mean unreadable — it means you have to run the
thing that fills it, and that thing is just a function.

Worse, the values wouldn't have settled the question. The rule we'd written
down — "if the first direction is vertical, then this label is backwards" —
quietly assumed the code in question was walking *along* the bridge. It isn't.
It's scanning *across* it. Reading a table of directions tells you what the
directions are; it cannot tell you what the loop using them is for. We had
planned an experiment whose result was already known and which decided nothing.

What settled it was reading one function completely. Four separate things inside
it agree, on each of its two branches: which piece of bridge artwork the branch
matches, which position within that artwork it tests, which compass direction it
steps in, and which way its own recursive call moves. Four signals, one function,
no dependence on what anything is *named* — which matters, because the names were
what everyone had been arguing about.

Then a better answer appeared by accident. Each branch turned out to push
**three** directions, not the one that had been quoted at us; we only noticed by
checking whether the single cited one was the whole story. Those three are the
cells whose height gets raised when a span is repaired, and their arrangement is
the giveaway: **one along the bridge, and the pair either side of it.** Repairing
a plank raises that plank and the deck to its left and right. The odd one out
names the direction the bridge runs. And the pair either side is precisely what
the *other* piece of code — the one that seemed to disagree — was scanning. The
two were never in conflict. They were describing two axes of the same tile, and
one of them had been written down under a name that read like the other.

The shipped code was right. The written description was wrong. That was the
outcome we'd predicted; we reached it by the route we'd ruled out.

There's a method note in this one too. The investigation ran six independent
readers over the code, then three adversarial checkers whose only job was to
break the consensus. The reader that examined the disputed function in isolation
reported the *opposite* conclusion at **high confidence** — and had not misread a
single instruction. It simply stopped reading a few hundred bytes before the part
that distinguishes "scanning across" from "walking along". A confidence rating
describes how well something was read, not whether the conclusion is true; a
flawlessly-read fragment will support a confident wrong answer about the whole.
The checker that threw out the consensus was right to do so as well, because at
the moment it ran, the one link everything depended on had genuinely not been
read by anybody — two readers had each hedged on a premise, and each had assumed
the other would check it.

Which is the same lesson as the rounding modes, arriving from the other
direction. There, the comfortable reading was that a thing which looks absent is
absent. Here, it was that a question you have already written down is a question
you have already understood.
