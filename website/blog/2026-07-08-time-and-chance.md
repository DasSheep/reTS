---
slug: time-and-chance
title: Making Time and Chance Deterministic
date: 2026-07-08T08:37:56+07:00
authors: [rets-team]
tags: [devblog, determinism, rng, timers]
last_verified: 2026-07-15
---

An RTS simulation cannot be reproduced exactly if “random” means whatever the
host platform happens to provide, or if timers depend on wall-clock time. The
second foundation milestone gave reTS its own faithful answers to both problems.

{/* truncate */}

*Last verified against the project oracle: 2026-07-15.*

## The same seed must mean the same game

The original randomizer maintains a 250-word state table. Each draw mutates that
table with wrapping integer operations; ranged draws use an inclusive interval
and a rejection mask rather than a simple remainder. Signed shifts also matter.
Replacing any of those details with a standard Rust generator would produce
perfectly good randomness—and the wrong match.

reTS now reproduces the raw stream, inclusive ranged values, and floating-point
draws from a known seed. The active sequence is the same across Tiberian Sun,
Red Alert 2, and Yuri's Revenge even though the older game's object layout is a
different size.

## A timer is frame state

The engine's common timers are compact state machines driven by the current
simulation frame. An inactive sentinel distinguishes a stopped timer from a
running one. Pausing first calculates and stores the remaining duration;
resuming records a new start frame. Expiration clamps the visible remainder at
zero, while the internal subtraction deliberately tolerates the signed frame
counter wrapping around.

Tiberian Sun names the freeze and thaw operations Stop and Start. The later games
call them Pause and Resume. The recovered state transition is otherwise the same.

## A useful save-game surprise

The research also found a behavior that future save/load work must preserve: the
scenario random stream is read from saved data and then reconstructed from seed
zero. reTS does not implement that complete save path yet, but the unexpected
reset is now a testable requirement rather than a tempting “bug fix.”

Randomness and time are invisible when they work. That is precisely why they had
to land early: movement choices, combat rolls, AI decisions, replays, and
multiplayer synchronization will all depend on them producing the same answer on
every machine.
