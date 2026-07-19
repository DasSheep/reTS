---
slug: where-the-turrets-go
title: Where the Turrets Go
date: 2026-07-20T21:30:00+07:00
authors: [rets-team]
tags: [devblog, ai, determinism, multi-game, mathematics]
last_verified: 2026-07-20
---

If you've ever watched a skirmish AI in Red Alert 2 quietly ring its base
with prism towers on exactly the side you were massing tanks, you've seen
this week's subject in action. We finished dissecting the routine that
decides *where defensive structures go* — the last unmapped piece of the
AI's base-building brain, and until now the one function standing between us
and a bit-exact port of that entire decision path.

{/* truncate */}

*Last verified against the project oracle: 2026-07-20.*

## A compass around the base

The placement engine thinks in compass quadrants. Every candidate cell gets
classified into one of four directions around the base center — the engine
computes a bearing with its own table-driven arctangent (more on that
below), squashes it to a 16-bit "binary angle," and keeps just the top three
bits' worth: north-ish, east-ish, south-ish, west-ish.

Then it asks: which direction am I weakest? Every building the AI owns
reports three numbers — how good it is against infantry, against armor, and
against aircraft — and those get stamped into three threat heat-maps with a
gentle falloff: full value on the building's cell, fading over a six-cell
radius. Sum each quadrant, pick the smallest total, and that's where the
next gun goes. There's a subtle eligibility rule our adversarial review pass
caught: a numerically weaker direction is *skipped* if no candidate cells
were actually offered on that side. The math says "build north," but if
north has nowhere to build, the second-weakest side wins.

## Counting the dice rolls

Deterministic lockstep multiplayer means every random number matters. Both
players' machines run the same simulation and only exchange inputs, so if
one machine draws three random numbers where the other draws four, the game
desyncs — not crashes, just quietly diverges until the "reconnection error"
box appears. That's why an AI routine with a *variable* number of internal
dice rolls was a blocker: we couldn't port anything downstream of it until
every roll was accounted for.

The full census turned out to be beautifully finite. In Yuri's Revenge the
routine makes zero to four draws per call: up to three to add fuzz to the
AI's "what mix of defenses do I want" targets (skipped entirely when the AI
has no elected enemy — and, in a path our verification pass flagged, still
*burned* even when the fuzz drives the totals negative and the result gets
thrown away), plus at most one for a weighted lottery over eligible defense
types (skipped when there's only one candidate).

Then came the genuine surprise: **Red Alert 2 doesn't make the fuzz draws at
all.** Its version of the same routine hardcodes the target mix to a flat
one-third each and never touches the random stream for it. Same function,
same shape, three fewer dice rolls — the second confirmed case where the two
sibling engines disagree about *when randomness happens*, after the
dispatch-cadence difference we wrote about earlier. For anyone dreaming of
cross-game compatibility layers: this is why you can't just swap rules files
and hope.

## The square root that time forgot

Underneath all the bearing math sits something delightful: the engine
doesn't compute square roots or arctangents the way any modern program
would. It ships lookup tables — a sixteen-thousand-entry table for square
roots and a four-thousand-entry one for arctangents — and does a few bit
tricks on the floating-point representation to index them. Classic 1990s
speed engineering, shared byte-for-byte across Tiberian Sun, Red Alert 2,
and Yuri's Revenge, and used by nearly three hundred call sites across the
whole engine: bullets, pathfinding, rendering, everything.

For our port this is a gift and a trap. The square-root table we managed to
regenerate *bit-exactly* from a closed-form formula — every one of 16,384
entries matches — because it only needs operations the IEEE floating-point
standard guarantees to the last bit on every platform. The arctangent table
is the trap: it was baked decades ago by whatever C runtime the original
compiler shipped, and modern math libraries land up to 14 units-in-the-
last-place away from it. No formula we can responsibly write reproduces it;
the shipped data *is* the specification. So the port treats that table as
an injectable dependency with witness values pinned in tests, and we've
filed the decision about embedding the whole thing as follow-up work.

One more entry for the "one percent is never one percent" file: the fuzz
magnitude scales a difficulty setting by a floating-point 0.01 — which, as
binary fractions go, doesn't exist. The nearest representable value is
0.00999999977..., so a difficulty of 50 against a base of 3000 fuzzes by
±1499, not the ±1500 you'd compute on paper. Our first hand-derived test
said 1500; the port said 1499; the port was right. We keep catching our own
arithmetic with this class of bug, which is exactly why every expected value
gets computed twice, two different ways, before it becomes an oracle.

## Housekeeping with a growth habit

Two smaller routines fell alongside the main event. One is the AI's
base-plan maintenance pass, which has a charming permanent side effect:
every time it runs, it grows the AI's notion of its own base footprint by
one cell in every direction, then walks the perimeter looking for stretches
of five or more buildable cells to reserve as future expansion nodes. Run
it enough times and the AI's "base" is most of the map. The other seeds
placeholder nodes for power plants around an existing one — and our review
pass proved it draws no random numbers anywhere in its call tree, upgrading
an earlier "probably clean" into a certainty.

The adversarial review wave earned its keep beyond that: it overturned six
claims from the first-pass analysis, including one where a dispatch
helper's call into the base-construction brain — the only path to the random
stream in that neighborhood — turned out to be *conditional*, not
unconditional as first read. A ported version built on the first reading
would have drawn dice on ticks where the original didn't. That's the whole
reason every finding gets a hostile second pass before it becomes code.

## Where this leaves us

The AI's build-order brain is now decision-complete for Yuri's Revenge:
what to build, where to put it, and exactly when the dice get rolled, all
pinned by tests whose expected values were hand-computed from the original
machine code. The Tiberian Sun counterparts we'd been hunting for two
sessions are finally located too — same rearm delays, same two-draw lottery
order in its team picker — with full verification queued behind the
reconnaissance. Next up: the map-wide placement scanner's interior, the
remaining callee sweeps on the Tiberian Sun side, and wiring the live-binary
oracle at the handful of spots where only a running original can settle the
last doubts.
