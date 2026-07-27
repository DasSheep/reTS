---
slug: /
sidebar_position: 1
title: Original Engine Reference
last_verified: 2026-07-16
---

import DocCardList from '@theme/DocCardList';

# Original Engine Reference — digital archaeology of the original engine

A reference encyclopedia documenting the **original** Westwood isometric engine
for the **Command & Conquer** titles Tiberian Sun, Red Alert 2, and Yuri's
Revenge **exactly as it is** — its INI logic, tags, mechanics, and formulas.

This section is **not** about reTS usage or modding (see [For modders](/docs/modders/overview))
and **not** the project's story (see the [Devblog](/devblog)). It documents the
*original game engine as-is* — the way [ModEnc](https://modenc.renegadeprojects.com/)
does for the community.

*Last verified against the publication workflow and current reference catalog:
2026-07-16.*

## What makes this different

Every entry published here must be **binary-verified**. It describes only the
version coverage established by the underlying study; pending versions and
incomplete systems stay unpublished.

Reverse-engineering treats **Tiberian Sun, Red Alert 2, and Yuri's Revenge as
equal first-class targets** — because these are one engine evolved across the
three releases, a system is reversed from whichever release carries it most
completely (often the latest, but Tiberian-Sun-first where TS is the richer
implementation that later releases pared down), then reconciled against the
others. Each entry then states, on its own terms, whether all three were
separately confirmed, confirmed divergent, or are not yet checked. Never assume a
claim carries across games unless that entry's version-coverage line says so.

:::important Publishing gate
A system receives an entry only after it is fully reversed, implemented,
oracle-tested, and closed as complete. Each claim then receives an independent
skeptic pass whose job is to falsify it. Unsupported statements are removed, not
softened into guesses.
:::

## Published entries

The catalog below is generated from the section tree itself, so it is always
current — every card links a system area; each entry's card states its own
version coverage.

<DocCardList />

## How it's organized

- **By engine system** — combat, movement, economy, object/world, AI, presentation, …
- **Per entry** — the behavior, the relevant INI tag(s)/flag(s), the formula where
  one applies, cross-version notes (TS / RA2 / YR differences), and a verification
  confidence.

The goal: an accurate, approachable encyclopedia of how the original engine works —
useful to players, modders, and anyone curious about the machinery underneath.

## Accuracy & corrections

Every entry traces to reverse-engineering of the **retail binaries** — the binary
is the sole source of truth here. Community references (wikis, forums) are used only
to corroborate, never as the source. We document only systems we have **fully
reverse-engineered and reimplemented**, each claim is checked adversarially before
it ships, and where a finding **differs from long-held community understanding**,
it's because the behavior was verified directly against the game's own code.

We hold this section to a higher bar than the rest of the site precisely because
this community knows these games deeply. If you spot something wrong or incomplete,
please [open an issue](https://github.com/DasSheep/reTS/issues) — corrections are
re-verified against the binary, and well-founded ones are exactly how a reference
like this earns trust.
