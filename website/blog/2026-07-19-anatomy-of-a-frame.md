---
slug: anatomy-of-a-frame
title: Anatomy of a Frame
date: 2026-07-19T22:30:00+07:00
authors: [rets-team]
tags: [devblog, game-loop, verification, multi-game]
last_verified: 2026-07-19
---

Every real-time strategy game is secretly a metronome. Thirty times a second
the engine reads your inputs, advances the world one tick, and draws what
happened. This week we finished dissecting that heartbeat across all three
games we track — Tiberian Sun, Red Alert 2, and Yuri's Revenge — and then went
one level deeper, into the bodies of the subsystems the tick calls. Along the
way the engine handed us a genuinely strange discovery: one virtual call that
takes its arguments two different ways depending on which game you're playing.

{/* truncate */}

*Last verified against the project oracle: 2026-07-19.*

## The envelope

The outer frame loop — the envelope around the simulation — is now mapped
end-to-end in all three engines, and its spine is identical everywhere: read
input, log sync data, refresh the draw order, run the simulation tick, account
for frame rate, apply queued player commands, advance the frame counter, and
finally bury the dead.

Two placements in that sentence carry the whole multiplayer story. Queued
commands apply *after* the tick but *before* the frame counter advances — so
every player's order lands on exactly the same numbered frame everywhere. And
object destruction is deferred: things that "die" during a tick are only
flagged, then swept at the very end of the frame, after the counter has already
moved on. An object that dies on frame N is still present, in every list, for
all of frame N. Get either of those wrong in a reimplementation and two
machines playing the same game drift apart within seconds.

One detail is a lovely period piece: the "refresh the draw order" step is a
*single pass* of a bubble sort over one display layer per frame. Sorting
everything every frame was too expensive for 1990s hardware, so the engine
amortizes — each frame nudges the draw order a little closer to correct, and
because the pass runs before the tick, its progress is part of shared game
state, not just cosmetics.

## The letter inside

Inside the envelope is the simulation tick itself: an ordered sweep of over
twenty subsystems — triggers, timers, bombs, lighting, teams, radiation, the
full object walk, factories, houses. The *order* was pinned some time ago.
What we finished this week was naming every remaining mystery in it, then
reversing three complete subsystem bodies.

The mysteries first. A nameless routine the tick calls every frame with a
six-millisecond budget turned out to be the drain half of the dynamic lighting
system — cells whose light changed queue up, and the tick retints a budgeted
batch each frame so a big lighting event can't blow the frame time. An array
the tick only walks during real gameplay turned out to be a *second*,
undocumented animation registry — certain feedback animations are filed there
at birth, and their destructor checks a flag to know which of the two
registries to leave. Neither community header set knows this one exists.

And the smallest mystery had the best answer. Every object-update call in the
tick goes through the same slot in each object's virtual-function table —
except in Tiberian Sun, where the slot sits exactly one position later. We
walked the compiled type-information structures in all three binaries to dump
the base class's table from raw bytes: TS carries one extra virtual method
that the later games dropped, and its single insertion shifts every subsequent
slot down by one. Reproduce YR perfectly, forget this, and your TS build calls
the wrong function on every object, every frame.

## Three subsystems, dissected

With every callee named, we picked the three smallest and reversed them
end-to-end: the attached-bomb list, the kamikaze tracker, and the ion-blast
sweep.

**The bomb list** (Ivan's ticking presents — RA2-era only; TS has no such
class) is one function with three loops and three *different* iteration
disciplines. The first destroys bombs whose victim no longer exists — and
because the bomb's destructor doesn't remove it from the list, the loop
immediately re-runs its own compaction to sweep the dangling slot. The
invariant that falls out — every surviving bomb has a live target — is what
lets the later loops skip null checks entirely. The visibility rule is pure
Westwood charm: your own bombs you always see; enemy bombs need a
bomb-detecting unit within range, measured as a true 3-D floating-point
distance, re-evaluated on a timer that resets to 45 but — counting the sweep
frame itself — actually fires every 46 frames.

**The kamikaze tracker** manages aircraft on a one-way trip, and it taught our
verification pipeline some humility. A first reading claimed its 30-frame
timer counts down in memory; the assembly says the subtraction happens in a
register and is never written back — the timer is a pure "has enough time
elapsed" comparison against a fixed duration. Two behaviors any faithful
reimplementation must keep: every tracked plane has its ammo forced to 1 every
30 frames, so the crash always delivers its payload; and planes tracked
without an explicit target re-derive their crash point from their *current
facing* every cycle — the aim drifts as the plane banks — while planes with a
stored target keep it forever, even if the target is long gone.

**The ion blast** is a 79-frame-lifetime effect that sweeps a 7×7 cell
neighborhood around itself each frame, looking for infantry and vehicles to
zap. Its bookkeeping is textbook-safe: the update loop snapshots the count
once and walks *backward*, so an effect deleting itself mid-walk can never
make the loop skip a neighbor. But it also yielded the week's two best
findings. First: its proximity check measures distance in *screen* pixels —
both positions go through the world-to-camera projection before the compare.
The zap radius is literally twice as large in YR as in RA2 and TS, and the
whole test is camera-relative by construction. Second, the strange one: the
per-frame hit-test call passes two extra values to its target — and in YR
they travel in CPU registers, while RA2 and TS push them on the stack. Same
call, same purpose, different calling convention per binary. We've been
burned twice before by convention misreads that only a live crash exposed;
this one was caught on paper, by stacking three independent readers against
each other and believing none of them until the bytes agreed.

## Evening addendum: five more stages, and a ghost feature

The same triple-reader discipline swept up the tick's middle stages by
evening, and each layer of it caught something the others missed.

The engine's dynamic lighting turns out to run on a genuinely clever budget
system. When a light source changes, the affected map cells go into a
backlog; each frame, the game grants the backlog a six-millisecond allowance
of real wall-clock time, walking it behind a cursor that *persists across
frames* — if time runs out mid-walk, the next frame resumes exactly where it
stopped. To keep the timing overhead itself cheap, the clock is only polled
every sixteenth cell. Only once the whole backlog is resolved does a second,
unbudgeted phase apply everything to the map at once and refresh the display
— once per batch, not once per cell. There's even a vestigial self-tuning
governor at the end: if lighting resolution takes too long, it consults a
hook that was compiled down to "always say no." A quality knob, wired up and
then unplugged before shipping.

Then the archaeology find of the day: the EMP pulse. All three engines run
its per-frame update in the same tick position — and in both RA2 and Yuri's
Revenge, the code that would ever *create* one has exactly zero callers.
Proven dead, not folklore: exhaustive cross-reference on both binaries. In
Tiberian Sun the same constructor has two live call sites gated by warhead
flags — Firestorm's EMP was real, shipped content, and the two later engines
carried the entire mechanism forward disconnected, faithfully executing an
empty loop every frame for two decades. Our port pins the mechanism *and* the
dead-in-two, alive-in-one verdict.

The remaining pair — transient light flashes and laser beams — are small
lifetime sweeps with personality. Both share a removal idiom where the loop,
already holding an item's position, politely asks the array to search for the
item anyway; both skip the class destructor and free memory raw. The laser
timer even reproduces the exact "write compiler padding with stack garbage"
quirk we first documented in the kamikaze tracker — same idiom, second
sighting, all three binaries. And the cross-version check earned its keep
one more time: the first reader claimed TS shares RA2's memory layout for
the laser record; the adversarial re-read of the actual bytes showed TS's
late fields sit a further eight bytes earlier. The ancestor engine is missing
two fields its descendants added — invisible unless you refuse to trust a
plausible answer.

## The evening shift: weather, tiberium, and loot

A second orchestrated pass the same day emptied most of what was left on the
tick's roster: the tiberium growth and spread sweeps, the lightning storm,
the crate system, an alpha-fade cleanup sweep, and a 120-frame full-map
shroud refresh. Fourteen of the tick's stage bodies are now reversed end to
end, and the evening's finds were some of the best yet.

Tiberium regrowth looks innocent — a timer per resource type, fire when due,
re-arm. The adversarial re-read killed the innocent version. The number of
cells processed per firing is a two-stage computation: first a deterministic
bound derived from how many cells are queued times the type's growth
percentage (clamped to 5–50), *then* a random draw modulo that bound, plus
one. And every candidate cell drawn after that consumes a *second* random
number to build a float-scored priority heap. None of this matters visually.
All of it matters for lockstep: consume one draw too few and two machines'
random streams diverge, and with them every combat roll for the rest of the
match. The re-arm interval itself runs through floating-point — an integer
growth rate times 0.3 (or 1.0, depending on a scenario flag), truncated —
one more place where the fidelity of a single rounding mode is load-bearing.

The lightning storm turned out to be a shared ticker for a whole family of
screen-state machines — the storm itself plus the nuke flash fade, and in
Yuri's Revenge two more siblings the earlier games don't wire in here. Its
best secret hid in a branch both readers missed and the final principal pass
caught: the storm's shutdown code is only *reachable* when the list of live
storm clouds is empty. A storm whose duration expires stops striking
immediately — but it keeps its stormy lighting until the last cloud
animation finishes playing, because the finalize block sits behind the
walk's early-out. And when it finally does shut down, control falls straight
through into the countdown for the *next* queued storm, which can promote on
that very tick. Timing like that is invisible in normal play and decisive in
a replay diff.

The crate system is the most determinism-hostile stage so far. Placing one
crate may burn up to a thousand retry attempts, two random draws each, then
one final draw to arm the respawn timer — uniform over a window from 450 to
1800 times a rules constant, computed in doubles. The oracle test for that
window failed on first run: we had hand-derived the top of the range as
unreachable, the way the formula reads on paper. The actual byte pattern of
the scale constant is not exactly the power of two it plays on TV — it's
larger by one part in a billion, just enough that the maximum draw rounds up
to the full upper bound. The failing test is the workflow doing its job:
the binary is the spec, and it disagreed with our arithmetic until we read
the constant's actual bytes.

Cross-version, the evening delivered two clean negative results. Tiberian
Sun's ion storm is not an earlier draft of the lightning storm — it is a
different machine entirely: a per-tick probability roll instead of fixed
strike cadences, target selection that scans live units first and falls back
to random cells, and none of the cloud-then-bolt choreography. The lineage
rewrote the weather wholesale. And the 120-frame map refresh simply does not
exist in Tiberian Sun — it is a RA2-era addition, one more entry in the
growing list of things the descendants bolted onto the same tick spine.

## Night: the last unnamed stages

By the end of the day the tick had four stages left with no reversed body
behind them: two odd loops that iterate their arrays *backward*, the
production sweep, and the camera update. A final pass — five reverse lanes,
five dedicated skeptics, and a principal read of every instruction in the
longest body — closed all four.

The Floating Disc's laser turned out to be a wound-up toy rather than a
weapon. Firing computes the bearing to the target, rotates it a half turn,
and hands the rest to a nine-beat state machine: two beam arms sweep around
the disc in opposite directions, one step per activation, and geometry does
the scheduling — the arms land on the same facing exactly at step eight.
That converged beat draws the single real beam, applies the single damage
event, plays the report sound, and marks the object for the end-of-frame
grave we mapped this morning. Every intermediate beam is a purely visual
object with its own lifetime sweep — and every beam allocation is guarded
so that an out-of-memory frame silently drops the *visual* while damage and
state march on. The renderer is allowed to fail; the simulation is not.

The backward loops finally explained themselves. Radiation sites count
their lifetime down every frame, and when it hits zero the site deletes
itself *right there*, mid-walk — and the destructor compacts the array by
shifting every later element down one slot. Walk that array forward and a
self-deletion makes you skip a neighbor; walk it backward and every shifted
element is already behind you. The engine's two backward walks are exactly
the two subsystems whose members die mid-iteration. We had the shift-down
mechanism only as community folklore until the destructor's disassembly
showed the literal copy loop. The same site fades its glow as it decays —
and the fade's skip-if-unchanged check carries a genuine retail bug: it
compares the stored red channel against the incoming red *and* the incoming
blue, and never looks at green. Faithfully reproduced, quirk toggle and all.

The production stage is the answer to a trivia question every fan knows:
the build clock has 54 steps. Now it's not trivia — the constant sits in
the comparison instruction in all three games. Each due tick charges the
remaining balance divided by the remaining steps, rounding down, and the
final step sweeps the exact remainder, so a completed build never over- or
under-pays by a cent. If your funds run dry the step quietly rolls back —
but the progress-changed flag stays raised and the timer has already been
rewound, so a stall costs a full interval and briefly lies to the sidebar.
The money check itself goes through a COM interface embedded inside the
house object, with a calling convention the decompiler renders identically
to a normal method call — the exact trap our call-site discipline exists
to catch. And Tiberian Sun's version never touches the on-hold flag at
all: an actual behavioral gap between the generations, not just the usual
field reshuffling.

The camera stage closed as a verdict rather than a port. The class behind
it has no runtime type information anywhere, so the lanes chased the
singleton's construction to recover its method tables in all three games —
and found the per-frame body is pure presentation: smooth-scroll easing,
viewport clamping, dirty-flag bookkeeping, and a screen-shake timer driven
by the *wall clock*. That last fact matters enormously for lockstep: it is
the only nondeterminism in the stage, and it can never touch game state.
The simulation spine now records that stage as a documented client-side
no-op instead of an unexamined hole.

With that, every stage in the per-frame dispatch has either a reversed,
test-pinned body or a pinned classification. The frame is no longer a
list of mysteries in a known order — it is a list of mechanisms.

## Why this order of work

Everything above feeds one goal: a playable skirmish that stays bit-identical
with the original, frame by frame. The frame envelope tells us *when* things
happen; the tick order tells us *what* happens when; the stage bodies tell us
*how*. All of it is pinned by tests whose expected values were hand-derived
from the machine code, so any drift in our implementation fails loudly. Next
up: driving the live original through single frames and diffing its state
against ours at each boundary — the dispatch order, confirmed by the only
witness that can't be wrong.
