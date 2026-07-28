---
slug: /
sidebar_position: 1
title: Original Engine Reference
description: >-
  The Engine Reference is withdrawn while every published claim is re-derived from the retail binaries.
last_verified: 2026-07-28
---

# Original Engine Reference — withdrawn pending re-verification

**Every entry in this section has been taken down.** Nothing here is being served
while we re-derive its claims from the retail executables.

## Why

This section is held to a stricter bar than the rest of the site: every statement
is supposed to trace to a finding verified against the original game binaries,
with an independent pass whose job is to *falsify* each claim before it ships.

On 28 July 2026 we found that a published entry had failed that bar. The
coordinate-system entry stated that *Yuri's Revenge* measures distance between
objects in 2D while *Tiberian Sun* and *Red Alert 2* measure it in 3D, and that
"every Yuri's Revenge range check therefore treats the world as flat."

**Both statements were false.** All three games ship both measures, with the same
code. The error came from comparing differently-named functions across the three
executables: in one game's symbol data the plain "distance" name sits on the 3D
routine, in another it sits on the height-ignoring one — so matching by name
compared two different operations and produced a difference that is not in the
games.

The claim had been public for a year.

## Why the whole section, and not just that entry

Because the process that let it through was followed correctly. The review
checked that the published page faithfully matched our internal research note —
which it did. What nobody re-checked was the research note against the binary.
Every entry on this site went through that same review, so correcting one page
would have been a guess about how far the problem goes.

When we went looking, the first three entries we re-derived each turned up
something: a second invented difference between games, a set of caller counts
that were wrong, and a claim about alliance behaviour that was not just published
but had been written into our reimplementation and locked in by a passing test.

We would rather serve nothing than serve claims we cannot currently stand behind.

## What happens now

Every entry is being re-derived from the disassembly of all three executables —
not re-read against our own notes. Alongside that we have added checks that block
publication when a claim rests only on a function name, when a statement covers
more ground than its evidence, when a cross-game comparison is not pinned by
addresses, or when a comparison never asks which code actually calls the routine.

Entries will return one at a time, as each is re-verified. There is no schedule;
an entry comes back when it is right.

## If you were relying on something here

The withdrawn entries remain in this site's git history, and the corrected
coordinate-system entry — including its retraction notice — is in the commit log.
If a specific entry matters to you, or you can falsify something we published,
please open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues).
Reports are treated as verification input and checked against the binaries.

The rest of the site — the [project documentation](/docs/intro) and the
[devblog](/devblog) — is unaffected.
