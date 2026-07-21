---
draft: true
sidebar_position: 2
title: Map compression and pack sections
description: >-
  How the engine turns a map's IsoMapPack5, OverlayPack, and OverlayDataPack
  base64 sections into cell terrain and overlay - base64, chunk framing, LCW
  (Format80) and LZO (lzo1x) decode, and the cell record. Verified: Yuri's Revenge.
last_verified: 2026-07-21
---

# Map compression and pack sections

*Last verified: 2026-07-21. Version coverage: the **section semantics** — the `IsoMapPack5` cell record and the overlay planes — are verified on **Command & Conquer: Yuri's Revenge** only. The two **compression codecs** (LCW / "Format80" and LZO / "lzo1x") are additionally confirmed **byte-for-byte identical between Yuri's Revenge and Tiberian Sun** by instruction-level comparison; **Red Alert 2** codec confirmation is **pending**. The **Tiberian Sun** side of the `IsoMapPack5` record width — specifically whether the eleventh "ice growth" byte exists — is **not yet verified** and may be Yuri's Revenge-only.*

A map file stores its terrain and its overlay layer as base64 text inside three INI sections: `[IsoMapPack5]`, `[OverlayPack]`, and `[OverlayDataPack]`. Each section is a compressed binary blob wrapped in base64 and split across numbered keys. This entry describes the exact chain the engine runs to turn that text back into cell data, and the on-disk shape of the decompressed bytes.

The pipeline is the same for all three sections and has four stages:

```
INI section text  ──►  base64 decode  ──►  chunk framing  ──►  decompress  ──►  apply to cells
  1=BIACcgAA...          (per key)         {comp,uncomp}       LCW or LZO      terrain / overlay
  2=4CNgBACO...
```

Only the codec and the apply step differ between sections:

| Section | Codec | Decompressed payload |
|---|---|---|
| `IsoMapPack5` | LZO (lzo1x) | stream of 11-byte cell records |
| `OverlayPack` | LCW (Format80) | one 512x512 byte plane (overlay type per cell) |
| `OverlayDataPack` | LCW (Format80) | one 512x512 byte plane (overlay frame/data per cell) |

Older map revisions also define `IsoMapPack`, `IsoMapPack2`, `IsoMapPack3`, and `IsoMapPack4`. The engine tries **all five** IsoMapPack section names, in order, unconditionally — there is no version flag that selects one. Each is applied only if its base64 stage produced more than zero bytes, and each writes into the same cell grid additively. The newest packs use LZO; the original packs use LCW. This entry documents the **`IsoMapPack5`** record, which is the one shipped by the modern engine.

## Base64 layer and the numbered keys

Inside a section the value is chopped into numbered keys:

```ini
[IsoMapPack5]
1=BIACcgAA...
2=4CNgBACO...
```

Two facts about this layer are load-bearing:

- **The keys are read by position, not by name.** The engine walks the section's entries in order and concatenates their decoded bytes; it never parses the `1=`, `2=` numbers. The numbering is purely a writer convention. A missing or empty entry contributes zero bytes and does not stop the walk.
- **Each key value is capped at 127 base64 characters.** Every value is copied into a fixed 128-byte line buffer (with a forced terminator), so at most 127 base64 characters per key are consumed. Writers respect this by wrapping the blob at that width.

The base64 itself is the standard RFC 4648 alphabet with `=` padding. Decoding is **not** lenient: any character outside the alphabet — including whitespace — terminates that line's decode at that point rather than being skipped. This never matters in practice because INI values arrive already trimmed, but it means the format is not tolerant of embedded spacing the way some base64 readers are.

## Chunk framing

The concatenated base64 output is not a single compressed stream. It is a sequence of independently compressed chunks, each with a 4-byte little-endian header:

```
[u16 CompCount]  [u16 UncompCount]  [CompCount bytes of compressed data]
   bytes 0..1        bytes 2..3
```

`CompCount` (the compressed byte count) comes **first**, `UncompCount` (the decompressed byte count) second. The reader consumes exactly `CompCount` bytes and hands them to the decompressor; if fewer bytes remain than the header promises, it stops and returns what it has.

Two details are worth stating exactly because they are easy to get wrong:

- **There is no "stored / uncompressed chunk" shortcut.** The decompressor is always invoked, even when `CompCount` equals `UncompCount`. A chunk is never treated as raw bytes just because its two counts match — every chunk must be a valid LCW or LZO stream.
- **The production chunk payload is bounded at 8192 bytes.** The writer splits at that size, so `UncompCount` is at most 8192 in stock maps. The reader itself does not require that bound; it will accept any `UncompCount` its working buffer can hold.

## LCW decode ("Format80")

LCW — commonly called "Format80" in the community — is a byte-oriented LZ scheme. The decoder walks a command stream; the first byte of each command selects the operation:

| Command byte | Operation | Operands | Length | Copies from |
|---|---|---|---|---|
| `0x00`–`0x7F` | copy, **relative** | one following byte | `(b >> 4) + 3` → 3..18 | back from the **current write position**, distance `((b & 0x0F) << 8) \| next` |
| `0x80` | **end of stream** | — | — | — |
| `0x81`–`0xBF` | literal run | the next `b & 0x3F` bytes | `b & 0x3F` → 1..63 | copied straight from the input |
| `0xC0`–`0xFD` | copy, **absolute** | 16-bit little-endian offset | `(b & 0x3F) + 3` → 3..64 | from the **start of the output buffer** + offset |
| `0xFE` | fill (run of one value) | 16-bit count, then one value byte | the 16-bit count | that single value |
| `0xFF` | copy, **absolute, long** | 16-bit count, then 16-bit offset | the 16-bit count | from the **start of the output buffer** + offset |

Two properties of this decoder are faithful requirements:

- **Relative copies replicate.** The `0x00`–`0x7F` copy advances source and destination one byte at a time, so a copy that overlaps the write head repeats the tail it just wrote — the run-length trick used to encode long uniform stretches.
- **This engine has no relative-offset "extension" mode.** Some Format80 variants documented elsewhere reserve a leading `0x00` prefix to switch absolute copies into a relative-addressing mode. That prefix check **does not exist** in this engine. Absolute copies (`0xC0`–`0xFD`, `0xFF`) always address from the start of the output buffer; a stream that begins with `0x00` is decoded as an ordinary relative-copy command, not a mode switch. The end-of-stream is the exact byte `0x80`, not a zero-count literal.

## LZO decode ("lzo1x")

`IsoMapPack5` is compressed with stock **lzo1x** — the same public LZO variant used widely for fast decompression. The engine links the **unbounded** decompressor (the non-"safe" variant): on well-formed input it produces exactly the lzo1x output, but it performs **no bounds checks**. A truncated or corrupt stream therefore has undefined behavior in the original engine — it can read or write past the buffer and crash — rather than failing cleanly.

The recognizable markers of the format, all confirmed present here, are: a first byte greater than `0x11` opens the stream with a literal run of `first - 17` bytes; literal-length tokens below 16 encode `token + 3` bytes; back-reference offsets use the classic lzo1x split where the **first** match after a literal block carries a larger base bias than **subsequent** matches; and the stream ends on the 3-byte end marker `11 00 00`. Because it is unmodified lzo1x, any conformant lzo1x decoder reproduces the map data exactly.

## The IsoMapPack5 cell record

After decompression, `IsoMapPack5` is a flat array of **11-byte records**, one per placed cell:

```
byte 0   i16  X            cell X (signed, little-endian)
byte 2   i16  Y            cell Y (signed, little-endian)
byte 4   u32  TileIndex    tile-set slot (little-endian)
byte 8   u8   SubTileIndex sub-tile within the tile
byte 9   u8   Level        height level
byte 10  u8   IceGrowth    ice-growth state (the pack5-only 11th byte)
```

- **The stream ends on an all-zero coordinate.** Reading stops as soon as a record's `X` and `Y` are both `0` — that pair is the terminator sentinel, and writers append four zero bytes to mark the end. A real cell at map coordinate (0, 0) is therefore unreachable as data; the placeable grid excludes it.
- **Cell addressing is `Y x 512 + X`.** A record is applied only if that index is in range (`0` up to but not including `262144`) and the target cell exists. If it does not, the record's remaining 7 bytes are still consumed and discarded — the record is always 11 bytes wide regardless of validity.
- **`TileIndex` is remapped on load.** The value `0xFFFF` is a clear-tile marker and passes through unchanged. Any other value is adjusted by a piecewise-additive fixup: the engine holds a sorted table of `{start, delta}` ranges, and for every range whose `start` is at or below the index, it adds that range's `delta`. This shifts stored tile slots to their loaded positions.

The earlier packs differ in record shape: `IsoMapPack2` through `IsoMapPack4` use **10-byte** records (no ice-growth byte), and the original `IsoMapPack` uses a different layout again — a fixed walk over the cell array with a 2-byte tile index and no per-record coordinate header. Those legacy layouts are outside the verified scope of this entry.

## OverlayPack and OverlayDataPack

The overlay layer is stored as two LCW-compressed planes. The engine reads them **only when the map's `NewINIFormat` value is greater than 1** — that single check is the whole gate; there is no other format test. When it applies, both sections decode the same way:

- Each plane is a dense **512x512** grid, **one byte per cell**, walked in `Y` then `X` order (index `Y x 512 + X`). Each section therefore decompresses to exactly **262144 bytes**.
- **`OverlayPack`** holds the overlay **type** per cell. The value `0xFF` means "no overlay" and is skipped; any other value places that overlay type on the cell.
- **`OverlayDataPack`** is read **after** `OverlayPack`, through its own LCW stream, and holds the overlay **frame/data** byte per cell. It is stored directly onto the cell with no validation.

## Common misconceptions

- **"The numbered keys are meaningful."** They are a writer convention only. The engine concatenates the section's values in order and never reads the `1=`, `2=` numbers (see above).
- **"OverlayPack becomes two bytes per cell in newer formats."** Not in the original engine. It performs exactly one `NewINIFormat` comparison (greater-than-1) and always reads **one** byte per cell. Extended, wider overlay encodings are a mod-tools extension, not vanilla behavior.
- **"A Format80 literal ends on a zero count."** The end-of-stream is the specific byte `0x80`; the decoder tests for that exact value, which is the same effect stated more precisely.

## What this entry does not claim

- **That Tiberian Sun's `IsoMapPack5` record is 11 bytes.** The codecs are confirmed identical across Tiberian Sun and Yuri's Revenge, but the Tiberian Sun pack-apply step — and specifically whether the eleventh ice-growth byte exists there — has not been verified. It may be Yuri's Revenge-only.
- **That Red Alert 2's codecs are confirmed.** The Red Alert 2 comparison for both LCW and LZO is pending.
- **The legacy `IsoMapPack` through `IsoMapPack4` apply paths** beyond their record widths. Only the modern `IsoMapPack5` record and the overlay planes are fully verified here.
- **The compression (write) side.** This entry documents only what the engine does when **loading** a map; the encoder that produces these sections is a separate concern.
- **Any reTS-specific API.** This describes the **original engine's** parsing behavior recovered for the verified path.

## Corrections

If you can falsify a claim on this page against retail *Command & Conquer: Yuri's Revenge* behavior (or contribute a verified Tiberian Sun / Red Alert 2 comparison), open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues). Reports are treated as verification input and re-checked against the oracle before the page is updated.
