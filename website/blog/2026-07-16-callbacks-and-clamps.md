---
slug: callbacks-and-clamps
title: A Callback That Changes the Question, and a Clamp That Wasn't Signed
date: 2026-07-16T04:46:54+07:00
authors: [rets-team]
tags: [devblog, economy, missions, audio, mcp, reference, documentation, triggers, campaign]
last_verified: 2026-07-16
---

Two stories today, both about the same discipline: trust the binary over the
story you'd expect it to tell.

{/* truncate */}

*Last verified against the project oracle and live site: 2026-07-16.*

## The callback that changes the question

The next slice of the harvester mission looked, at first glance, like a
boolean: did the move succeed or not? It isn't. A successful move commits
four things at once: the movement flag goes up, a two-frame animation timer
starts, the animation stage resets, and the mission steps into gather.

The interesting part is what happens on failure, because failure here is
*stateful*. The engine doesn't just branch on the move result — it re-reads
the harvester's destination and focus **after** the movement callback runs,
which means a model built from their values going into the call would already
be wrong by the time the branch is taken. A destination that's still set
clears the recovery flag and resumes polling. A focus with no destination
becomes the new destination, and the recovery flag is left untouched. Only
the genuine no-target case enters recovery, returns the longer retry delay,
and — for ordinary harvester types — conditionally signals the owning house
that something needs attention.

That action order holds across Tiberian Sun, Firestorm, Red Alert 2, and
Yuri's Revenge, even though each engine keeps the relevant flags at different
struct offsets, calls a differently-named movement helper, and returns the
result in a different register. The port now exposes that order as
a deterministic, inspectable step, while deliberately leaving the live
target search, object mutation, and polling machinery outside of it. That
seam matters beyond just matching the original: it means a future world
implementation can change *how* a harvester finds its next target without
silently changing what the mission does with the callback's result — the two
concerns stay separated instead of tangled into one function.

## The clamp that wasn't signed

Every few days the project runs a conformity sweep: a review pass over
everything landed since the last one, with every flagged item independently
re-verified before anything changes. This round covered eleven separate work
streams from the last two days, and most of it came back clean — economy,
tactical projection, the sidebar, skirmish preferences, and the sync log all
survived untouched.

One genuine bug turned up, and it's a good story about *why* you reverse from
the actual instructions rather than a plausible paraphrase of them.

The sound engine converts a floating-point volume into an integer value the
audio device understands, then clamps it into range. The port had that clamp
written as an ordinary signed range check: negative values fold to zero,
silence. Reasonable code. It reads exactly like what any volume clamp should
do. The reviewer even flagged it as slightly suspicious, in the way you flag
something that looks a little too clean.

The binary disagreed. The comparison the original engine actually uses is
**unsigned** — not the signed-less-than a range clamp would need, but an
unsigned above-or-equal check. A negative volume, reinterpreted as an
unsigned 32-bit value, doesn't sit near zero — it sits at the very top of the
unsigned range. So retail's clamp doesn't produce silence for a negative
input. It produces **maximum volume**. Both the global and positional
playback paths were re-derived independently from the instruction stream to
confirm it wasn't a one-off artifact — the same unsigned comparison shows up
in both, byte for byte. Both source studies were corrected, and the port now
carries oracle tests that pin the negative-input case and the exact clamp
boundary, not just the values that used to look reasonable.

Nobody involved — not the port, not the reviewer flagging the smell —
expected "clamps to max" as the answer. That's the whole case for reversing
from what the binary actually does instead of trusting a transcription that
merely sounds right. A signed clamp and an unsigned clamp read almost
identically at a glance; only the instruction stream tells you which one you
actually have.

## The rest of the sweep, briefly

The remainder of the pass hardened seams rather than changing behavior: the
capability gateway closed out its two remaining unshipped surface items —
bounded summary responses so large results don't blow past sane limits, and
conservative per-capability metadata (game coverage, status, with filtering)
so callers can ask what a capability actually covers before running it. A
trigger-event regression test that had quietly become tautological now
parses its expected values out of the source study at test time instead of
duplicating them, so drift actually fails the build again. Asset-format
detection stopped promoting ambiguous, magic-less files without filename
corroboration.

And four new completed systems went live on the [Engine
Reference](/reference) today, joining the growing binary-verified catalog
alongside the site's Engine Reference introduction: how draw layers are
filed and sorted before a frame renders, how the tactical view projects
world space to screen space, how the sidebar routes its commands, and how
warhead rules are resolved. Each one only publishes once a system is fully
reversed, ported, and oracle-verified — the same bar that caught today's
volume clamp before it could quietly ship.

## Sixty-two ways for an event to happen

The day's third arc opened the campaign scripting engine. Map triggers are
the machinery every mission is written in: a tag listens for raised events,
sweeps its attached triggers, each trigger keeps a bitmask of which of its
conditions have been met, and a sprung trigger fires its chain of actions.
That spine — the sweep, the latch, the three-way persistence mode that
decides whether a fired trigger dies, waits for its siblings, or lives
forever — is now reversed, ported, and oracle-pinned across Tiberian Sun,
Red Alert 2, and Yuri's Revenge.

Then the two big boundaries fell. The first is the event evaluator itself:
the sixty-two-kind switch that answers "did this specific event actually
occur." It turns out to be two machines wearing one function. A handful of
kinds — timers, scenario variables, credit and light thresholds, a pair of
"does this unit type exist on the map" scans — answer directly. Everything
else flows through a pipeline of vetoes: a gate that matches the raised
event's kind, an object stage, a stage keyed on the house the event is
about, a stage keyed on the house the event *names*, and then — if nothing
objected — an ambient **true**. Events don't prove they happened; they
survive. That inversion explains a piece of mapper folklore: a trigger
whose named house doesn't exist in the scenario simply fires, because the
failed lookup skips the last veto stage entirely.

The decompiler lied twice in that one function, and both lies only came out
under the instruction stream. Four build-event kinds bypass the raised-kind
gate entirely — they re-evaluate on *every* event sweep, whatever was
raised — but the decompiled C shows only three of the four exclusions,
leaving a case that reads as live code and is actually unreachable. And two
success-flag writes appear in the decompile as stores through two different
parameters when the instructions write the same caller-supplied out-byte
both times. A third find was the engine's own quirk, faithfully preserved
behind a toggle: the "does this tech type exist" check answers *false* on an
empty battlefield even when the threshold is zero, because the empty-world
short-circuit runs before the threshold is ever compared. The community's
long-standing headers lost one too — the evaluator takes six arguments, not
the five they declare, and the sixth is the attacking unit that exactly one
event kind inspects.

Cross-game, the expected chaos never showed up: event and action numbering
is *preserved* across the whole lineage. The later engines append new kinds
at the top instead of renumbering — Yuri's Revenge adds nine event kinds and
twenty-eight action kinds over Red Alert 2 — under uniform struct-layout
shifts. The one genuine behavioral fork is ownership propagation: only
Yuri's Revenge records which house triggered an object event and forwards
that house onto the trigger itself, and the field it lands in turns out to
be the very struct member whose insertion caused the offset shift we'd been
noting all along. Yesterday's "these two functions are identical across
games" verdict is corrected accordingly, and the action dispatcher's
skeleton is pinned as well — including the detail that a failed action never
aborts the rest of its chain. The per-action handler bodies, all
hundred-and-forty-five of them, are the next atoms.
