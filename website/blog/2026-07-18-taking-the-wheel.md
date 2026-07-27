---
slug: taking-the-wheel
title: Taking the Wheel of the Original Engine
date: 2026-07-18T21:45:00+07:00
authors: [rets-team]
tags: [devblog, verification, oracle, determinism, rng, netcode]
last_verified: 2026-07-18
---

Last time, the original engine gave us a second opinion: we ran small pieces of
its actual code in a sandboxed emulator and compared answers. That was the
engine as a witness. Today it became something more — a car we can drive. Code
of ours now runs *inside* the live game, steps its simulation forward frame by
frame on command, reads its state between steps, and hands us ground truth no
amount of careful reading can match. It promptly caught two real mistakes that
every static check had blessed.

{/* truncate */}

*Last verified against the project oracle: 2026-07-18.*

## Owning the clock

The setup sounds like a heist and mostly is one. A small helper library is
injected into a running, unmodified copy of the game on an isolated Linux box —
nothing on disk is patched, and the game itself is not aware of the passenger.
The library opens a tiny local control channel and waits for instructions.

The first hard problem was time. A running game advances its own frame counter
about thirty times a second, which swamps any attempt to "step ten frames and
look around." Freezing everything isn't right either — a frozen game can't
advance at all. The answer is a gate on the engine's own main loop: the loop
runs exactly as retail wrote it, but the gate holds it at a target frame until
asked for more. Ask for fifty frames and the counter moves by exactly fifty,
then freezes again, with the game alive the whole time. Stepping is
deterministic, repeatable, and headless.

The second hard problem was reading state that isn't mid-change. Because the
gate freezes the loop *between* frames, a read taken while frozen is coherent
by construction. Between steps we capture a snapshot: the frame counter, both
of the engine's random-number streams, and a walk over the live object arrays
folding each unit's position and facing — the same kind of quantized digest
the engine itself uses to detect desyncs in multiplayer.

## Two launches, one bit pattern

With driving and reading in hand, the flagship experiment became possible.
Launch the game fresh, pin the match seed, let a real skirmish load, then step
to fixed absolute frame numbers and capture at each. Quit everything. Do it
again from scratch.

Two completely independent launches with the same seed produced **byte-identical
capture sequences** across a five-hundred-frame span — every random draw in
perfect agreement. A third run with a different seed diverged immediately,
which matters just as much: an oracle that always says "identical" is
worthless. Same seed in, same simulation out, provable to the bit. That is the
property the whole project stands on, demonstrated end to end on the original
engine itself.

## The oracle's first catch

Then we pointed it at our own code, and it earned its keep the same day.

Our reimplementation of the engine's random-number generator was pinned by
hand-derived tests, and those tests were green. But the live engine disagreed:
seeding the real generator in-process and comparing its internal table against
ours revealed that our constructor expanded the seed using a loop counter where
the original chains the *previous internal states*. The subtle part is why the
tests hadn't caught it — the hand-derived expected values had been worked out
with the same misreading. Implementation and test agreed with each other and
were both wrong. A shared blind spot is invisible to self-consistency; it took
the running engine to break the tie. One fix later, our generator matches the
retail one byte for byte for every seed we've checked.

## The crash that corrected the notebook

The second catch arrived as a crash. While extending the state snapshot to walk
the engine's display layers, our code called a small engine routine to ask each
object what type it is — and the game faulted. The disassembly told the story:
of two neighboring virtual calls, one passes its object in a register, the
other — a COM-style interface method — expects its pointer *on the stack*.
Decompiled output renders both identically, so nothing short of the machine
code (or a live crash) distinguishes them. Our notes had assumed the first
convention for both.

That's now a standing rule in the workflow: for every indirect call a port
replicates, pin the calling convention from the call site's machine code, never
from decompiled pseudocode. It has caught two real bugs in as many sessions.

With the convention corrected, the *full* snapshot — object positions and
facings included, not just the random streams — passed the same two-launch
test: byte-identical across independent runs at the same seed, divergent on a
different one.

## From experiment to routine

The final step was making all this boring. Live confirmation is now a
first-class part of the verification workflow: while reversing a function, we
can call the retail original in-process with chosen arguments and bake its
answer into the ordinary test suite as a tagged literal. The live setup is
needed only at reversing time — the test suite stays fully hermetic and keeps
passing on every machine we check determinism on, including the ARM boxes,
with no game installation anywhere in the loop.

The rule of thumb we adopted for when to bother: **if the port and the study
could share a misread and still agree, get a live confirmation.** Numeric code,
anything random-number-derived, state machines, and indirect-call conventions
all qualify. Both of this week's catches were exactly that class.

## What the engine checks every frame

A bonus from the same work: to know what state is worth capturing, we reversed
the engine's own multiplayer sync checksum — the digest each peer computes per
frame to detect desyncs. What the original engine considers "the game state
that must match" turns out to be lean: quantized object positions, unit
facings, object types, one flag per player house, and a draw from the shared
random stream — no health, no credits, no targets. Its ancestor in earlier
Westwood engines checksummed health and money too; this engine's generation
dropped them. The full breakdown is now written up as a reference entry, next
to the damage pipeline.

The oracle has a steering wheel now. The next stretch of work goes back to the
engine itself — the world model, the main loop, and the road toward a playable
skirmish — with the live engine riding along as examiner.
