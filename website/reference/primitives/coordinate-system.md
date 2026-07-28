---
sidebar_position: 1
title: "Coordinate system: cells, leptons, and distance"
description: >-
  How the original engine measures space — map cells, sub-cell leptons, the cell↔world conversion, 16-bit facing, and the distance measure that feeds range checks. Verified across Tiberian Sun, Red Alert 2, and Yuri's Revenge.
last_verified: 2026-07-28
---

# Coordinate system: cells, leptons, and distance

*Last verified: 2026-07-28. Version coverage: everything on this page — the cell/lepton conversions, facing values, the distance measures and the building-footprint adjustment — is **identical across Tiberian Sun, Red Alert 2, and Yuri's Revenge**.*

:::warning Correction — 2026-07-28

**An earlier version of this page (2026-07-21) claimed that Yuri's Revenge measures object distance in 2D while Tiberian Sun and Red Alert 2 measure it in 3D, and that "every Yuri's Revenge range check treats the world as flat." That was wrong, and it has been retracted.**

All three games ship **both** a 3D distance measure and a height-ignoring one, and in all three the 3D measure is the general-purpose one that ordinary range checks call. The error came from comparing differently-named functions across the three executables: in the Tiberian Sun symbol data the *3D* routine carries the plain "distance" name, while in the Yuri's Revenge data that name lands on the *height-ignoring* routine — so matching by name compared two different operations and produced a divergence that is not in the binaries.

The corrected description is below, re-derived from the raw disassembly of all three executables and confirmed by executing the actual retail code.

:::

Every spatial system in the engine — movement, range, weapon reach, targeting, spread — is built on two units and the conversion between them. This entry documents those units, the exact conversion arithmetic (including where it does **not** round the way you might expect), the 16-bit facing value, and the distance function that range checks call.

## Two units: cells and leptons

The engine works in two spatial resolutions:

- A **cell** is one tile of the isometric map grid. A map position at cell resolution is a pair of 16-bit signed values, `(X, Y)` — a 2D grid coordinate with no height component.
- A **lepton** is the sub-cell world unit. A world position is a triple of 32-bit signed values, `(X, Y, Z)` — a full 3D coordinate. `X` and `Y` are horizontal leptons; `Z` is height.

**One cell is 256 leptons on a side.** This constant is not a documentation guess — the same `256` shows up independently in unrelated code (for example, the weapon spread radius in the damage pipeline is measured against this same cells-to-leptons factor).

## Cell ↔ world conversion

Converting a cell to a world coordinate places the point at the **center** of the cell:

```text
world.X = cell.X × 256 + 128
world.Y = cell.Y × 256 + 128
world.Z = (caller-supplied height, default 0)
```

The `+ 128` is exactly half a cell, so a cell coordinate always maps to its midpoint, never its corner.

Converting a world coordinate back to a cell drops the sub-cell remainder:

```text
cell.X = world.X / 256
cell.Y = world.Y / 256
```

### The rounding quirk (truncation toward zero)

That division is C-style **integer division, which truncates toward zero — it does not floor.** For non-negative coordinates the two agree, but for negative coordinates they diverge:

| World X | World X / 256 | Cell X |
|---:|---:|---:|
| `255` | `0` | `0` |
| `256` | `1` | `1` |
| `-1` | `0` | `0` |
| `-256` | `-1` | `-1` |
| `-257` | `-1` | `-1` |

Because of this, a cell→world→cell round trip is **not** always the identity for negative cells. Cell `-12` converts to world `-2944` (that is `-12 × 256 + 128`), and `-2944 / 256` truncates to `-11`, not `-12`. This is verified engine behavior, not a defect to be "corrected" to mathematical floor division — code that relies on floor semantics for negative cells would not match the original engine.

## Facing: a 16-bit compass

Direction is stored as a **16-bit value where a full turn is 65536 units** (2^16). The value wraps through unsigned 16-bit storage, so adding past a full turn naturally rolls over — there is no separate normalization step.

The engine reads that same 16-bit value at several coarser resolutions by taking the top bits:

| View | Bits | Range | Typical use |
|---|---|---|---|
| 8-direction | 3 | 0–7 | 8-facing sprite sets |
| 32-direction | 5 | 0–31 | 32-facing sprite sets |
| 256-direction | 8 | 0–255 | fine facing |

Down-scaling to a coarser view is **rounded** (it adds half a step before dropping the low bits), so a facing that is just past halfway between two sprite directions snaps to the nearer one rather than always truncating down. Up-scaling simply shifts the value into the wider field.

### Turning over time

A unit that is mid-turn does not jump to its target facing; it steps toward it at a fixed **rate of turn (ROT)**. The current facing is resolved like this:

```mermaid
flowchart TD
  A[current facing requested] --> B{ROT ≤ 0,<br/>timer done, or<br/>no steps left?}
  B -- yes --> C[return target facing]
  B -- no --> D["diff = target − initial<br/>(signed 16-bit, wraps)"]
  D --> E["steps = |diff| / ROT"]
  E --> F{steps < 1?}
  F -- yes --> C
  F -- no --> G["current = target − (diff / steps) × steps_left<br/>(integer division, truncates toward zero)"]
```

The subtraction `target − initial` wraps in 16 bits, which is what lets a unit turn the **short way** around the compass rather than unwinding all the way through zero. When the configured rate is an ordinary non-negative value, the stored per-tick rate is that value multiplied by 256; rates above 127 are clamped before that scaling.

## Distance between objects

Range checks — "is the target in weapon range?", "is it close enough to attack?" — call a distance measure between two objects. There are **two** such measures, and each game has both. They share every step except one: whether the height delta enters the sum.

```mermaid
flowchart TD
  A[distance from A to target] --> B{target is null?}
  B -- yes --> Z[return 0]
  B -- no --> C[deltas from the two coordinates]
  C --> D{which measure did the caller ask for?}
  D -- "3D distance<br/>(the general-purpose one)" --> F["squared = dx² + dy² + dz²"]
  D -- "planar distance<br/>(aircraft mission checks)" --> E["squared = dx² + dy²<br/>(height ignored)"]
  E --> G[approximate square root]
  F --> G
  G --> H[truncate toward zero]
  H --> I{target is a building?}
  I -- yes --> J["subtract 64 × (foundation width + height),<br/>then clamp below zero to 0"]
  I -- no --> K[done]
  J --> K
```

The choice is made by the **call site**, not by the game. Both routines exist, unchanged, in Tiberian Sun, Red Alert 2 and Yuri's Revenge.

Several details of this measure are worth stating exactly:

- **A null target returns distance 0.**
- **The square root is approximate.** The engine does not call a precise square root; it uses a fast table-based approximation and then truncates the result toward zero. This is **gameplay-visible**: two objects separated by exactly 255 leptons along one axis report a distance of **254**, because the approximate root of `255 × 255` comes out just under 255 and truncation drops it. A separation of exactly 256 leptons (one full cell) reports exactly **256**. The error is small and bounded, but it is real and it is part of the engine's behavior.
- **Buildings are measured to their footprint, not their origin.** If the target is a building, the engine subtracts `64 × (foundation_width + foundation_height)` from the raw distance and clamps any negative result to 0 — so large structures are effectively "closer" than their reference point, by an amount that scales with their footprint. This building adjustment is identical in all three games and is applied after whichever raw distance the game computed.

### Where the planar measure is used

The height-ignoring measure is rare and deliberate. In every one of the three games, its callers are **aircraft mission handlers** — the approach and overfly checks that ask "has this plane reached the point it was sent to?" For an aircraft holding altitude, including the height delta would keep the reported distance permanently above the arrival threshold, so ignoring it is the point of the check.

Counting direct calls to each measure:

| measure | Tiberian Sun | Red Alert 2 | Yuri's Revenge |
|---|---|---|---|
| 3D distance | 30 | 26 | 26 |
| planar (height-ignoring) | 2 | 4 | 6 |

The planar set grows because each game adds aircraft missions the previous one did not have: Red Alert 2 adds the paradrop approach and overfly pair, and Yuri's Revenge adds the spy plane approach and overfly pair. Tiberian Sun contains no paradrop or spy plane mission at all. **No routine that exists in more than one game switches between the two measures** — this is a difference in which missions exist, not in how any given check is computed.

Ordinary weapon range, targeting and threat evaluation use the 3D measure in all three games, so **height genuinely counts toward range everywhere**, including in Yuri's Revenge.

### Two more members of the same family

Alongside the two measures above, each game carries **two further routines** that compute the *squared* planar distance in plain integer arithmetic — no square root, no truncation, no building adjustment. Callers that only need to compare distances use these and compare against squared thresholds, avoiding the approximate root entirely.

One detail is worth recording because it settles intent: both of these routines **read the height field and then discard it without using it**. They are planar by construction, not by an oversight that a later game might have corrected.

## What this entry does not claim

- **Not** that the approximate square root matches a true IEEE square root bit-for-bit. It is a deliberate fast approximation; only its truncated integer output is documented here.
- **Not** that any facing value beyond the compass storage, the 8/32/256-direction views, and the turn-toward-target stepping is covered — class-specific facing overrides (turret, barrel, and per-unit-type accessors) are a separate object-model topic.
- **Not** a complete catalogue of every cell and map helper. This entry covers the coordinate units, the two conversions, facing, and the object distance measure; other spatial helpers are documented as they are verified.
- **No** claim about any reTS-specific API. This page describes the **original engine's** behavior recovered for the verified path.

## Corrections

If you can falsify a claim on this page against retail *Tiberian Sun*, *Red Alert 2*, or *Yuri's Revenge* behavior, open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues). Reports are treated as verification input and re-checked against the oracle before the page is updated.
