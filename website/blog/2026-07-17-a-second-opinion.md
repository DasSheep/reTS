---
slug: a-second-opinion
title: A Second Opinion From the Original Engine
date: 2026-07-17T05:12:30+07:00
authors: [rets-team]
tags: [devblog, verification, oracle, campaign, ai, teams, client]
last_verified: 2026-07-17
---

For months, every number in this project has been checked the same way: a person
reads the original engine's instructions, works out by hand what they must
produce, and writes that value into a test. It's rigorous — but it's one
person's arithmetic standing in for the CPU. Today the engine started checking
our work itself.

{/* truncate */}

*Last verified against the project oracle and live site: 2026-07-17.*

## The binary can answer for itself

The bar this project holds is that every expected value is derived from the
original engine, not guessed. The weak point was always the derivation: a subtle
misreading of the disassembly can hide in a test for a long time, because the
test and the reading share the same author and the same blind spot.

The new check removes the author from the loop. Take the *actual bytes* of a
function we've reversed, map just that code into a sandboxed processor emulator,
set up the calling convention the way the engine would, run to the return, and
read the result register. The reimplementation and the original are now handed
the same inputs, and their answers are compared directly. When they disagree,
the disagreement is the finding — no human transcription in between.

The first function put through it was deliberately boring: a pure predicate that
decides whether a given lobby slot is one of the multiplayer starting positions.
Our port models it as a simple range check — is the index within this band? The
original engine does something that *looks* different: a run of discrete equality
tests, one per start slot, falling through to "no." For every valid input the two
are identical, and the emulated original confirmed it across a batch of cases
that included both edges of the band and values just outside it. That is exactly
the question this tool exists to answer — *is our simplification sound?* — and now
it can be answered by the machine instead of by a careful reading of it. A second
target that reads fields off an object exercised the harder path, where the
emulator has to be handed a small synthetic object to read from; its inheritance
and pass-through cases agreed too.

None of this replaces reversing from the instructions — you still have to
understand the function to port it. What it replaces is the quiet risk that a
plausible-looking reimplementation and a plausible-looking hand-derived
expectation are wrong in the same direction. The loop that catches that now
closes at the level of the machine.

## Sixty-five ways to run a team

The other arc of the day was deep in the campaign AI. A *team* is the unit the
mission scripting commands — a squad handed a script, and each step of that
script is a *mission*: go here, guard this, load into that transport, unload,
attack, scatter, patrol, and sixty more. This was the payload of a long thread of
work: the full behaviour of every one of Yuri's Revenge's sixty-five mission
kinds is now reversed, ported, and pinned by tests, then diffed against the older
engines in the lineage.

The best find is another entry in the running case for reversing from the
instructions rather than a paraphrase of them. One family of missions is gated on
a power-level threshold, and an early reading declared that whole family dead
code, because the threshold constant read as zero. It isn't zero. The comparison the
engine performs consumes eight bytes, not four — it's a double, not a
single-precision float — and the value is one, not zero. The low four bytes of a
double holding 1.0 happen to be all zeroes, which is exactly what a four-byte
reading sees. One operand-size distinction decided whether an entire branch of
behaviour existed; it does, and it's live. A separate correction pulled a real
lifecycle coupling out of the noise: when a team successfully sends a member into
a structure, it unconditionally arms the flag that governs whether the team
disappears next tick — so a release and a disappearance that look independent are
actually chained. A port written to the obvious reading would drop that link
silently.

Cross-game, the tidy result held: the older engine's version of this dispatcher
has exactly fifty-three mission kinds, and the twelve that the newer engines add
on top are provably *absent* there — not merely unfound, but sitting behind
padding where their table entries would be. The lineage grew this system by
appending, never renumbering, which is the same pattern the scripting layer as a
whole turned out to follow.

## A direction for the playable half

A quieter decision this week settled how the *playable* side of the project will
be approached. A browser build is now a first-class parallel target alongside the
native client — both of them thin shells over the same shared simulation core,
eventually joined by a single input-agnostic command layer, so that the same
match logic runs behind a desktop window, a browser tab, or a touchscreen without
forking. Two facts made the browser path cheap rather than speculative: the core
that would have to compile to it already carries no external dependencies, and a
browser build's arithmetic is defined by a specification rather than by whatever
hardware it runs on — which makes it a genuinely independent witness that the
simulation stays deterministic. The in-game interface will come from the reversed
engine, faithfully; only the shell around it is new.
