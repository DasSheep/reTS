# reTS brand kit

Brand assets for **reTS**. Everything here is original artwork — clean recreations
in the spirit of the classic Westwood isometric-RTS presentation, not lifted game
files.

> **Work in progress.** These assets are still evolving; platform-tuned icon
> variants (macOS / iOS / Android) are in the pipeline. Geometry may be refined,
> but the canonical letterforms below are considered stable.

## Canonical wordmark

`rets-wordmark.svg` is the source of truth for the stacked **RE / TS** lettering;
`rets-wordmark.png` is its 1024 × 1024 transparent raster export. The mark reads as
**reTS** — gold `RE` over ember-orange `TS`, beveled metal with a soft drop shadow.

`rets-wordmark-compact.svg` / `.png` is the same artwork with the surrounding
padding cropped away (750 × 579). Prefer it for **small sizes and tight layouts** —
site navbar, favicons, inline badges — where the padded square would render too
small. The full-canvas `rets-wordmark.svg` is better when you want breathing room
around the mark (splash art, social cards).

The following are locked and should not change unless the wordmark itself is
revisited:

- the four glyph silhouettes;
- the letter spacing within `RE` and `TS`;
- the line spacing and centering of the two rows.

Color, material, shadow, and any surrounding emblem are **separate layers** and may
evolve without touching the letter geometry — which is exactly what the themed and
game lockups below do.

### Single-color variants

For contexts where gradients and depth are unsuitable (stamps, print, monochrome
UI), reproduction variants inherit the canonical geometry unchanged:

| File | Use |
|------|-----|
| `rets-wordmark-outline-black.svg` / `.png` | outline, light backgrounds |
| `rets-wordmark-outline-white.svg` / `.png` | outline, dark backgrounds |
| `rets-wordmark-solid-black.svg` / `.png` | flat fill, light backgrounds |
| `rets-wordmark-solid-white.svg` / `.png` | flat fill, dark backgrounds |

All SVGs are self-contained vector paths (no embedded fonts, no external
references), so they render identically everywhere and are safe to inline.

## Themed lockups (`themes/`)

One wordmark geometry, many skins. A themed lockup keeps the `RE` / `TS` glyphs and
their spacing untouched, and adapts only the surrounding emblem, colors, materials,
and depth to an active UI theme:

| Theme | Treatment |
|-------|-----------|
| `themes/gdi/` | gold + gunmetal circular medallion, eagle-and-ring insignia |
| `themes/nod/` | silver + crimson angular hex plate, segmented scorpion |
| `themes/allied/` | polished silver + blue winged eagle crest |
| `themes/soviet/` | gold star behind a red industrial pentagon, hammer & sickle |
| `themes/yuri/` | blackened steel + violet psychic-energy field |

Each ships `rets-lockup.svg` (vector) + `rets-lockup.png` (1024 × 1024).

**Selection model.** UI should pick a lockup from its resolved visual theme rather
than hard-coding artwork into screens. Recommended fallback order:

1. an explicit user-selected UI theme;
2. a theme derived from the loaded content;
3. the neutral canonical wordmark (`../rets-wordmark.svg`).

## Game lockups (`games/`)

Where a *theme* signals the active faction/UI skin, a *game lockup* identifies a
title at a glance. These mirror the two-faction hierarchy of the classic retail
icons while keeping the neutral wordmark as the foreground identity:

| Game | Composition |
|------|-------------|
| `games/tiberian-sun/` | GDI medallion (rear) + Nod badge (front) |
| `games/red-alert-2/` | Soviet star/pentagon (rear) + Allied eagle (front) |
| `games/yuris-revenge/` | layered Yuri insignia, wordmark foreground |

Their emblem geometry is derived from the matching `themes/` sources; refinements
should preserve layer order, emblem geometry, and the locked wordmark spacing.
