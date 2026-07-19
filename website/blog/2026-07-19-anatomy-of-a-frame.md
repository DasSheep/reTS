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

## Why this order of work

Everything above feeds one goal: a playable skirmish that stays bit-identical
with the original, frame by frame. The frame envelope tells us *when* things
happen; the tick order tells us *what* happens when; the stage bodies tell us
*how*. All of it is pinned by tests whose expected values were hand-derived
from the machine code, so any drift in our implementation fails loudly. Next
up: driving the live original through single frames and diffing its state
against ours at each boundary — the dispatch order, confirmed by the only
witness that can't be wrong.
