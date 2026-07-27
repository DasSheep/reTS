---
slug: three-engines-three-numbers
title: "Everything Fit, and We Were Still Wrong — Twice in One Day"
date: 2026-07-27T02:00:00+07:00
authors: [rets-team]
tags: [devblog, game-loop, frame-pacing, verification, multi-game, tiberian-sun, red-alert-2, yuris-revenge, headless, determinism, presentation, sprites, rounding]
last_verified: 2026-07-28
---

Run Tiberian Sun headless on a modern machine and it holds about thirty frames a
second, the rate it was always meant to run at. Run Red Alert 2 the same way, on
the same machine, in the same minute, and it runs about six hundred and fifty —
roughly twenty times too fast, finishing a skirmish before you can read the
loading screen.

Same hardware. Same emulation layer. Same kind of match. Two engines from the
same lineage, one of them apparently missing a brake.

We found the brake. Then we spent a day building an elegant explanation for why
Red Alert 2's was disengaged, and the explanation was wrong. The real answer was
a single line in a text file sitting next to the executable.

That was the morning. By evening we had moved to something entirely different —
how a unit's facing becomes the sprite frame you actually see — and walked into
the same shape of mistake from the opposite direction. There the code does its
rounding in two steps where one would obviously do, and "obviously" is doing a
lot of work in that sentence: fold the two steps into one and you draw the wrong
frame on one bearing in every eight, while every test you would naturally write
still passes.

Two unrelated systems, one lesson. An explanation that accounts for all your
evidence has not thereby been tested, and neither has a formula that reproduces
all your examples.

<!-- truncate -->

## A throttle configured to throttle nothing

Every one of these engines ends its frame the same way: work out how long the
frame took, compare that against a budget, and sleep off the difference. The
budget is a single number, and the sleep only happens if there is anything left
to sleep off.

Red Alert 2's budget was zero.

So the code runs. It reads the clock, does the subtraction, compares against the
budget, finds that *any* elapsed time is already greater than zero, and returns
without ever reaching the sleep. The engine is not skipping its throttle. It is
running a throttle that has been asked to wait for nothing.

That much has never been in doubt. Everything that follows is about where the
zero came from — and it took three attempts to get right.

## The number that predicts the other number

First, the part that survived everything. Here is what came back from three live
skirmishes, each value read out of a running match rather than a menu — a
distinction that has bitten us before, because at a main menu the game loop has
not run and these values still read whatever they were born with.

| engine | budget | frame rate this predicts | frame rate we measured |
|---|---|---|---|
| Tiberian Sun | 2 | 31.25 / sec | **31.2** |
| Red Alert 2 | 0 | unbounded | **655.6** |
| Yuri's Revenge | 3 | 20.83 / sec | **20.8** |

The budget is counted in units of sixteen milliseconds. Two units is thirty-two
milliseconds a frame, which is 31.25 frames a second. We measured 31.2. Three
units is forty-eight milliseconds, which is 20.83 a second. We measured 20.8.

This is the part worth pausing on. The budget and the frame rate are two
independent observations — one is a number sitting in memory, the other is a
counter sampled five seconds apart — and they agree to three significant
figures, in two different engines, without anything being fitted. A story that
merely *explains* a measurement is cheap. A story that *predicts* a second,
unrelated measurement is worth something.

There was a second check, and it is the kind that can come out wrong. Alongside
the budget, each limiter keeps a running total of whatever is *left over* — the
part of the budget the engine didn't need. If the throttle is genuinely running
and frames are finishing early, that total should climb by the whole budget
every frame. In Tiberian Sun it climbed by exactly 2 per frame. In Yuri's
Revenge, exactly 3. The budget, precisely, in both. Had the limiter been skipped
the total would have sat still; had frames been taking their full time it would
have climbed by less.

(That total also killed one of our own leads. From its shape it looked like it
might be a wall-clock timer, and we had been hunting for a wall-clock timer for
other reasons. It isn't one. Tiberian Sun's build carries symbol names for these
variables and its name for this one translates to "spare ticks" — leftover
budget, not elapsed time. The other two engines have the same variable in the
same slot of the same function, unnamed. One engine's symbols labelling
another's unknowns has now happened often enough that we plan for it.)

## The answer we published, and why it was so convincing

Tiberian Sun and Yuri's Revenge both take their budget from a persistent options
object — the thing that remembers your game-speed setting between runs. Red
Alert 2, we said, takes its budget from somewhere else: a plain global variable
that starts life zeroed by the operating system when the program loads, and that
nothing on our path ever filled in.

We had real evidence for the second half of that. There is code in the main-menu
path that writes a sensible default into the variable, and it is guarded by a
flag with a useful property: if the flag is clear, the code writes the default.
So a state where the flag is clear *and* the variable is still zero is a state
that code makes impossible — if it had ever executed, one or the other would be
different. We read both at the menu. Flag clear. Variable zero. That code had
not run.

That reading was correct, and it is still correct today. The mistake was the
sentence we wrote after it: *therefore nothing had written the variable.* We had
ruled out one writer and concluded there were none.

There is a mechanical reason we believed it. To find everything that writes a
given variable, we sweep the executable for instructions that spell its address
out literally. That sweep found fifteen writers, and we read all fifteen. But
there is a whole class of write it structurally cannot see: load the address
into a register once, then store through the register. Nothing in that second
instruction contains the address, so there is nothing to match. We knew this
class existed — we had even counted four of them for this exact variable and
written them down as unexamined.

One of those four was the answer.

## The contradiction we couldn't wave away

What broke the story open was not a better search. It was a table.

Before `main` runs, a C++ program walks a list of pointers to constructors — the
code that builds every global object with a constructor, in order, automatically.
Red Alert 2's list has 3,610 entries. Entry nine constructs an object, and the
constructor writes **3** into the very variable we had just finished describing
as never written.

So the static reading said the variable holds 3 before the game starts. The live
capture, taken at the menu, said 0. Both were anchored. Neither was obviously
wrong.

The tempting move is to reconcile that in prose — to find a form of words where
both are sort of true. We published it instead as an open contradiction with a
resolving experiment attached, because one of two things had to be true and both
were worth knowing: either the constructor doesn't really run, or something
between it and the menu changes the value back.

## Sample a window, not an instant

The experiment was the easy part once the question was framed properly. We had
been reading memory at moments we chose — at the menu, in the match. Chasing the
instant of program startup that way is a race that finishes in milliseconds, and
a snapshot taken at a guessed moment can miss the thing entirely and give you a
clean-looking answer for its trouble.

So instead of a snapshot, a window. A probe attaches as early as the operating
system will let it read the process at all, samples continuously, and prints
nothing except *transitions*. Over 75 seconds it took 18.8 million samples and
reported three states:

```
t+0.828 s    0, 0, 0      zeroed by the loader
t+1.000 s    3, 1, 3      the constructor — the static reading, confirmed live
t+1.661 s    0, 1, 4      something rewrites part of it
```

Both readings were right about their own moment. There was never a conflict
between them; there was a step missing between them.

## The control that named the object

The three columns are the interesting part, and they are the reason this counts
as evidence rather than as a story that fits.

The constructor writes three neighbouring values, not one. Two of them have
nothing to do with pacing — nothing in the frame limiter reads them, and no
theory we had involved them. That makes them a control, and a control made of
specific values rather than of counts.

Watch the middle column. It goes to 1 at the constructor and **stays** 1 through
the second transition. That single fact kills, with no further reading required,
every story in which something wholesale clobbers the region: a bulk zero, a
memory wipe, the object being rebuilt, the loader relocating something over it.
All of those would have taken the 1 with them. What happened at t+1.661 was
narrow and deliberate — a targeted partial rewrite.

Then the third column, which went from 3 to 4. That is what named the object.
Because `RA2.INI` — the plain text settings file sitting next to the game —
contains, in its `[Options]` section:

```
GameSpeed=0
Difficulty=1
ScrollMethod=0
ScrollRate=4
```

Our three columns are the first, the second and the last of those. Zero, one,
four — in the file's own order.

Once you see it, the rest confirms itself. Every non-zero value in that 172-byte
block turned out to be an entry from that file, in the file's own order, right
down to the four key bindings at the end — the modifier keys for force-move,
force-attack, select and queued movement, sitting there as raw virtual key codes.

## What the zero actually was

The variable is not a plain global and never was. It is a field of the options
object — the same class, the same member, the same position within it as the one
Tiberian Sun and Yuri's Revenge use. All three engines read their frame budget
out of the identical place. All three fill that object by the identical routine,
reading the identical key from an INI file. All three of those routines still
print the same startup banner announcing that they are loading *SUN.INI*
settings, eight years and two games after that was the name of the file.

And the routine that does it writes through a register it loaded once — one of
the four writes our sweep was structurally unable to see. The blind spot and the
answer were the same instruction.

So here is the corrected chain, start to finish:

1. The loader zeroes the memory.
2. A startup initialiser samples the clock and leaves the budget at zero.
3. The constructor runs and sets game speed to **3**.
4. The settings load runs and overwrites it from `RA2.INI`, which on our capture
   machine said **0**.
5. The menu's seeding code doesn't run — our discriminating read was right about
   that — so the loaded value stands.
6. The skirmish copies it into the limiter's budget.
7. The limiter finds zero and never sleeps.

Three things we had said in public are wrong, and they are worth stating
individually rather than blurring together.

**It is not a different mechanism.** We had explained the Red Alert 2 / Yuri's
Revenge difference structurally — one engine seeding its real settings object,
the other seeding a private shadow copy. There is no shadow. There is one object
and one mechanism.

**It is not an uninitialised variable.** It is initialised twice, deliberately,
by two different pieces of code, and ends up at zero because that is what it was
told to be.

**It is not a default, and Red Alert 2 does not pace differently.** The
constructor's default is 3 — which is Yuri's Revenge's measured budget, about
20.8 frames a second. A Red Alert 2 that nobody has configured paces exactly
like Yuri's Revenge. The dialog arithmetic that turns a slider position into a
budget is identical in all three engines and has been since Tiberian Sun: the
budget is six minus the slider position. Zero is not a broken state. Zero is the
slider pushed all the way to the fast end, saved to disk by a previous run.

The 655-frames-a-second skirmish was a machine with its game speed set to
maximum and no renderer attached to slow it down. Nothing about it was
characteristic of the engine.

Which is, in hindsight, exactly what anyone who has played the game would have
said. Red Alert 2 does not behave like a runaway when you play it, and it never
has. We had a twenty-times-too-fast measurement and reached for an explanation
inside the executable without first checking whether the two machines we were
comparing had been configured the same way. They had not — the two games'
settings files carried different game speeds — and we wrote a difference in
engine architecture to account for the gap.

## The clock that runs four percent fast

One finding from all this came through untouched, and it is the one nobody was
looking for.

That runaway skirmish burned **12,870 frames** — and the score screen at the end
reported a match duration of **twenty-two seconds**.

Twelve thousand frames at thirty a second is seven minutes. Twenty-two seconds
is roughly how long the match actually took in the real world at its runaway
speed. So either the displayed clock measures wall time, or the frame counter
isn't counting what we think it counts.

Both halves settled, in opposite directions. The frame counter is exactly what
it looks like: across the entire executable there is precisely one place that
reads it, adds one and writes it back, and that place sits in the main loop on
the same straight line as the simulation step — which itself has exactly one
caller in the whole program. No second counter, no conditional skip. 12,870
frames means 12,870 simulation steps.

And the score screen never looks at it. The match timer is a separate wall-clock
stopwatch, started when the scenario starts, which is why a match that ran twenty
times too fast still reported an honest twenty-two seconds.

Then, while reading the formatting code, a small surprise fell out.

The stopwatch ticks at **62.5 times a second** — the system millisecond clock,
divided by sixteen. The display code converts ticks to seconds by dividing by
**60**.

Sixty, not 62.5.

So a displayed "second" on that score screen is 960 milliseconds long, and the
match timer runs about **4.17% fast**. A ten-minute game reports roughly ten
minutes and twenty-five seconds.

That is a bold thing to assert from a disassembly, so we went and measured it.

The divisor half is arithmetic, and it is the easy half. Compilers don't divide
by constants; they multiply by a magic number and shift. Those magic numbers are
self-checking — you can work backwards from the constant to the only divisor
that could have produced it. The two in the formatter come back as **exactly 60**
and **exactly 3600**, the seconds and minutes of an hours-minutes-seconds
breakdown. There is no ambiguity available there.

The tick rate is the half that needed a real clock, and the obvious experiment
failed. We tried to watch the engine's timer advance and measure its rate — and
it doesn't advance, not at the main menu, where the frame limiter isn't running.
Zero movement in a full second.

But a frozen clock still tells you something: *when* it stopped. That value is a
snapshot of the system millisecond clock taken during startup, and the system
clock counts from boot, so the number itself says how long after boot the
snapshot was taken. We know independently when the process started. Over a
fifteen-minute uptime the two candidate tick sizes put that moment about
thirty-five seconds apart — an enormous gap to aim at.

We ran it twice, changing only how long we waited before looking:

| waited | at 16.000 ms per tick | at 16.667 ms per tick |
|---|---|---|
| 40 s | **+0.80 s** into startup | +36.00 s |
| 150 s | **+0.81 s** into startup | +38.92 s |

The answer is in the second column, and specifically in the fact that there are
*two* rows. Under the 16-millisecond reading the snapshot lands at the same
moment — within ten milliseconds — whether we looked forty seconds in or a
hundred and fifty. That is what a value written once at startup has to look
like, and it independently agrees with the startup timeline we measured for a
completely different reason earlier in the week. Under the rival reading the
moment *moves*, which no write-once value can do, and it lands where nothing is
writing anyway.

Sixteen milliseconds. 62.5 a second. The clock really does run 4.17% fast.

There was a corroboration hiding in our own table, too. Those frame rates further
up are themselves a measurement of the same tick: two units per frame at 31.2
frames a second is 62.4 ticks a second, and three units at 20.8 frames is also
62.4. A 60-per-second tick would have produced 30.0 and 20.0. Two engines, one
night, landing four percent off the rival answer to a question nobody was asking.

Would anyone have noticed? Almost certainly not — 4% on a match clock nobody is
timing against a stopwatch is invisible. But we should be careful about the
stronger claim that nobody ever *has*, because we only went looking afterwards
and found something adjacent rather than nothing. The community has documented
timers running fast in these games — but those are the **campaign countdown
timers**, which are frame-derived and run roughly twice as fast at campaign
speeds. Different timer, different cause, much bigger error. It is the sort of
near-miss that would be very easy to file as agreement, and it isn't.

What we can say is narrower and still worth saying: we were looking for something
else entirely, and this was sitting in the middle of the answer.

## The same mistake, from the other side

With the clock settled we started somewhere unrelated: the first step of the
rendering path. A unit is facing some direction; a sprite has a fixed, small
number of drawn directions. Something has to turn the first into the second, and
it happens on every object in every frame, so it is the kind of arithmetic where
being off by one is both trivially cheap to get wrong and permanently visible.

The facing itself is stored with far more precision than the art can use — a full
turn divided into 65,536 steps. The sprite might have eight drawn directions, or
thirty-two. Turning 65,536 into 8 sounds like a division, and if you were writing
this yourself it would be a division.

It isn't one. There is no divisor anywhere in the code — not a constant, not a
field, nothing. The number of directions is encoded **in a shift amount**, which
means it isn't a value the engine can look up at runtime; it is baked into the
instruction. Thirty-two directions and eight directions are not the same code
path with a different number in it. They are different instructions. That is
worth knowing before you design a port around a configurable direction count,
because there is nothing there to configure.

The rounding also isn't a plain truncation. Sitting between the two shifts is a
single increment, and that increment is the entire difference between "round
down" and "round to nearest" — drop it and every sprite in the game is one frame
off across half of all bearings.

### Two roundings are not one rounding

Here is the part that nearly cost us something real. For the eight-direction
case, the code does **not** round 65,536 down to 8. It rounds down to 32, and
then feeds that through a 32-entry lookup table whose contents map 32 down to 8.

Two stages where one would do. The obvious reading is that this is a historical
artifact — the table was needed once, the code got simpler, nobody removed the
step. So you fold it: round straight to 8, drop the table, same answer, less
work.

It is not the same answer. Rounding twice is not rounding once, and the reason is
mundane: a bearing that lands exactly on a boundary between two of the 32 buckets
gets nudged up to the next one, and then that nudged value lands on a boundary
between two of the 8 and gets nudged up *again*. Round straight to 8 and it never
moves at all. The two versions disagree on 8,192 of the 65,536 possible bearings
— exactly one in eight.

One in eight is not a rare edge case. It is a unit facing slightly the wrong way,
in a game where you watch units turn constantly, and it would look like nothing
in particular. Not a glitch, not a flicker — just a sprite that is subtly wrong
in a way you would never localise to a rounding stage.

### The test you would have written passes

The genuinely uncomfortable part is what this does to verification, which is
supposed to be the thing that catches exactly this.

Write down what the function does — facing in, frame out — and then write tests
from that description. Pick some bearings, work out the expected frames, check
them. Every one of those tests passes on the folded version. Of course it does:
you derived the expectations from the same understanding that produced the fold.
The tests confirm that your code matches your model of the code. They say nothing
about whether either matches the binary.

The only test that catches it is one written from the **staging** — asserting the
intermediate value, the one a folded implementation never computes and a
"simplification" makes unobservable. So that is what we now write: not the
formula, but the shape of the machine that evaluates it. Where the original does
something in two steps for no visible reason, the two steps are the specification
until proven otherwise, and the burden of proof sits on the person who wants one
step.

It is the morning's lesson wearing different clothes. There, an explanation
accounted for every number we had and was still wrong. Here, a formula reproduces
every example you would think to check and is still wrong. In both cases the
evidence fit — and fitting is not the same as being tested.

## What this cost us to learn

Every measurement in this post stands. The three budgets, the two frame rates
they predict, the leftover-budget check, the frame counter, the match clock —
none of it moved. What fell was the *explanation*, and the explanation is the
part that travels. Nobody quotes a table of frame rates onward; they quote "Red
Alert 2 has an uninitialised pacing variable," and that sentence was ours.

Three things we are taking from it.

**A structural explanation for a difference that lives in a config file is the
most dangerous kind of wrong, because it fits the data perfectly.** It explained
every number we had. It made a testable-sounding claim about engine lineage. It
was invented to account for two text files that disagreed. Before explaining a
difference between two versions structurally, check whether the two machines
were set up the same way — it is the cheapest experiment available and we
skipped it for three sessions.

**A prediction that comes true confirms; a control discriminates.** The probe
predicted an early 3 and found one, which felt conclusive and wasn't — several
different stories would each have produced that 3. The decisive evidence was the
two neighbouring values that had nothing to do with pacing. One of them holding
steady ruled out four competing explanations in a single reading.

**Ruling out one writer is not ruling out all writers.** Especially when your
search has a known blind spot and you have already written the blind spot down.
The instruction we couldn't see was on our own list of instructions we couldn't
see.

And from the evening, a fourth that generalises the other three:

**Where the original computes something in stages, the stages are the
specification.** A folded version that agrees with the original on every case you
thought to check has not been shown to be equivalent — it has been shown to agree
with your reasoning. Two roundings composed are not one rounding, and the
difference showed up on an eighth of all inputs while every test derived from the
formula stayed green. Faithfulness is not "same answer"; it is same answer *for
the same reason*, and the second half is the only part that keeps holding when you
find the input you didn't think of.
