---
draft: true
sidebar_position: 1
title: PAL palette files and palette conversion
description: >-
  The .pal file format, the 6-bit VGA to 8-bit expansion the engine applies on load, and the shadow, brightness, and tint tables it derives. Verified: Yuri's Revenge.
last_verified: 2026-07-21
---

# PAL palette files and palette conversion

*Last verified: 2026-07-21. Version coverage: **Command & Conquer: Yuri's Revenge**, binary-verified end to end. **Red Alert 2** is expected to be identical (same-generation palette machinery) but is not yet confirmed. **Tiberian Sun** uses the same 6-bit expansion convention per its published headers, but a direct comparison has not yet been made. Both are stated as expected-but-pending below.*

A `.pal` file holds a 256-color palette. The file itself is trivial; the engine value is in the exact expansion math the engine applies when it loads one, and in the lookup tables it builds on top of the loaded palette. This entry documents both.

:::note Publication bar
Everything stated with an exact number here was recovered from the retail Yuri's Revenge executable. Where a detail depends on machinery this study did not fully trace — the pixel-format packing globals and the individual per-format fast paths — it is called out under "What this entry does not claim" rather than guessed.
:::

## The file format

A `.pal` file is **headerless**: 256 consecutive `{Red, Green, Blue}` byte triples, so exactly **768 bytes**. Each channel is a **6-bit VGA value in the range 0–63**. Every stock palette shipped with the game contains only values up to 63.

There is **no header, no magic, no length field, and no palette count** — the size is fixed by convention. The engine relies entirely on the file being exactly 768 bytes.

## Load-time expansion: 6-bit to 8-bit

When the engine loads a `.pal`, it expands each 6-bit channel to a full 8-bit value by a **left shift of 2 bits** — that is, it multiplies each channel by 4. It does **not** rescale by `value × 255 / 63`.

```text
Red8   = Red6   << 2      (Red6   × 4)
Green8 = Green6 << 2      (Green6 × 4)
Blue8  = Blue6  << 2      (Blue6  × 4)
```

Two consequences follow directly and are the reason the exact operation matters:

- **Maximum channel brightness is 252, never 255.** A full 6-bit channel of 63 expands to `63 × 4 = 252`. No color loaded from a `.pal` ever reaches a true 255 in any channel. Tools that reconstruct palettes with a `× 255 / 63` stretch produce values that are off by up to 3 per channel and will not match the engine.
- **The source byte is not masked.** The engine does not clamp or mask a channel before shifting. A non-conforming value of 64 or more (which stock files never contain) simply wraps: the result is `(value × 4)` taken modulo 256. This is a property of the raw operation, not a validated code path.

Worked examples from a stock palette:

| Raw triple (6-bit) | Expanded triple (8-bit) |
|---|---|
| `{0, 63, 63}` | `{0, 252, 252}` |
| `{55, 39, 62}` | `{220, 156, 248}` |

### No size validation

The load routine always consumes exactly 768 bytes; it does not check the file's actual length first. A `.pal` shorter than 768 bytes therefore causes the original engine to **read past the end of the loaded data** — undefined behavior in retail rather than a defined error. This is worth knowing when authoring or repackaging palettes: the engine's tolerance for a malformed `.pal` is zero, and a truncated file does not fail cleanly.

## Derived tables built from the palette

Loading the palette is only the first step. The engine then builds lookup tables from it. These tables are what make in-game shadows, brightness ramps, and lighting tints work against a fixed 256-color palette. All of the following was recovered for the 8-bit (paletted) path.

### The shadow (half-brightness) remap table

For a paletted surface, the engine builds a 256-entry table that maps every palette index to "the same color at half brightness." Index 0 is hardcoded to 0. For every other index `i` from 1 to 255:

1. Convert the palette color at `i` from RGB to HSV.
2. **Halve the value component** (a right shift of 1 on V — i.e. 50% brightness).
3. Convert back from HSV to RGB.
4. Find the **nearest existing palette index** to that darkened color.

Nearest-match uses a **weighted color distance** that favors green, then blue, then red:

```text
distance = 2 × |ΔRed| + 4 × |ΔGreen| + 3 × |ΔBlue|
```

On a tie, the **lower palette index wins** (first match encountered). The result, `table[i]`, is the palette index that best represents color `i` drawn at 50% brightness — the classic shadow remap the engine uses for infantry shadows and darkened terrain.

### Per-level brightness tables

The engine can also build a stack of brightness "levels" for a palette. The shape depends on how many levels are requested:

- **One level** (the case used when a palette is loaded on its own, paletted): a single 256-entry table. Entry 0 is 0; every other entry is the nearest-match of a palette color against the palette itself. This is a near-identity map — it only differs from the identity where the palette contains duplicate colors, in which case the earlier index wins.
- **Multiple levels**, paletted: `levels × 256` entries. Level `L` scales the value component by `L × 2 / (levels − 1)`, byte-truncated. Brightness therefore spans **0 up to 2×** across the level stack, and the **midpoint level reproduces the palette exactly** (scale factor 1.0).
- **Multiple levels**, non-paletted (16-bit surfaces): `levels × 256` 16-bit pixels. Each level applies a fixed-point factor of `2 × L / (levels − 1)` running from 0 to 2.0×, clamps each channel to 255, and packs the result to the surface's pixel format. The packing is **format-agnostic** — it is driven by runtime shift amounts, not a hardcoded 5-5-5 or 5-6-5 layout.

### Lighting tint (colored light) tables

On top of brightness, the engine can bake a **colored tint** into a level stack — this is how map lighting and colored light sources tint everything drawn through the palette. The recovered rules:

- Each tint channel is clamped to the range **0 to 2000 permille**, i.e. **0% to 200%**.
- The tint ramps **linearly across the level stack**, from no tint at the bottom to twice the requested tint at the top, in fixed point.
- There is an **anti-banding ease-in** applied to the achromatic (brightness) component. Only the **darkest levels** ramp in gradually; above a threshold the brightness factor is flat at 1.0×. The threshold is

  ```text
  threshold = clamp( levels × 30 / 200 − 1,  min 0,  max (levels − 1) / 2 )
  ```

  and for a level `L` at or below the threshold the brightness factor is `L / threshold`, otherwise it is 1.0. In practice only roughly the darkest sixth of the level range eases in; the rest is flat. This ease-in is specific to the lighting path — the plain brightness fill above has no such ramp.
- **Index 0 is forced to 0.** Palette indices that are marked protected receive **uniform brightness only, with no tint applied**; all other indices receive the full per-channel tint ramp. (The protected set exists so specific colors are excluded from the colored tint while still following the brightness ramp.)

## Cross-version notes

- **Yuri's Revenge:** everything above is binary-verified.
- **Red Alert 2:** expected to be identical. It is the same engine generation with the same palette machinery layout, but a direct comparison has not yet been performed, so treat RA2 as expected-but-unconfirmed.
- **Tiberian Sun:** its published headers use the same 6-bit, shift-by-2 expansion convention, which strongly implies the load-time math matches. This has not yet been confirmed against Tiberian Sun's own code, so it is stated as expected-but-pending.

## What this entry does not claim

- **Exact pixel-format packing on 16-bit surfaces.** The non-paletted path packs channels using runtime shift amounts. The math (clamp, scale, pack) is verified, but where those shift amounts originate — the surface/display initialization that sets them — was not traced, so this entry does not claim a specific 5-5-5 vs 5-6-5 layout.
- **The individual per-format fast paths for lighting fills.** The lighting-tint routine dispatches to several format-specialized fills. The overall math is verified; the individual specialized variants are assumed to compute the same result but were not each traced separately.
- **Blitter selection.** The engine's blit-mode dispatch that sits alongside these tables performs no palette math and is a separate presentation topic; it is not covered here.
- **That Tiberian Sun or Red Alert 2 match every step.** See the cross-version notes above — those comparisons are pending.
- **Any reTS-specific API.** This page describes the **original engine** behavior recovered for the verified path, not a reimplementation's interface.

## Corrections

If you can falsify a claim on this page against retail *Command & Conquer: Yuri's Revenge* behavior, open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues). Reports are treated as verification input and re-checked before the page is updated.
