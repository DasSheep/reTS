---
sidebar_position: 2
title: CSF stringtable format
description: >-
  The CSF localization container - header, label and value records, the bitwise-NOT wide-string obfuscation, whitespace normalization, and key lookup. Verified: Yuri's Revenge.
last_verified: 2026-07-21
---

# CSF stringtable format

*Last verified: 2026-07-21. Version coverage: **Command & Conquer: Yuri's Revenge**, verified. Red Alert 2 is expected to use the identical format (RA2 and YR share the CSF stringtable) but its loader has not yet been separately checked, so RA2 is **pending**. Tiberian Sun **has no CSF** — it uses a different string mechanism entirely; that divergence is described below, not a TS format to document here.*

CSF is the container that holds the game's on-screen text, keyed by label so that a single build can ship in many languages. The engine loads it once (a guard prevents re-loading), decodes and normalizes every string in place, sorts the labels, and thereafter answers text lookups by key. This entry documents the on-disk layout and the decode/lookup behavior as the original engine performs them.

:::note Publication bar
Every structure and rule below is recovered from the retail Yuri's Revenge loader and is oracle-tested. Two behaviors are easy to miss when reading the format casually and are stated explicitly: the per-character **bitwise-NOT** obfuscation of wide strings, and the **in-place whitespace normalization** applied after decoding.
:::

## File header (24 bytes)

The file opens with a fixed 24-byte, little-endian header:

| Field | Type | Meaning |
|-------|------|---------|
| Signature | 4 bytes | Reads `" FSC"` — a space followed by the ASCII letters F, S, C. A file whose signature does not match is rejected and the load fails. |
| Version | `u32` | Format version. When the version is **less than 2**, the language field (below) is forced to 0. |
| Label count | `u32` | Number of label records that follow; drives the label array allocation. |
| String count | `u32` | Total number of value (string) records across all labels; drives the value array allocation. |
| Reserved | `u32` | Read as part of the header but never referenced. |
| Language | `u32` | Language identifier (masked to 0 for versions below 2). |

## Records

Immediately after the header come exactly **label-count** label records, read in order.

### Label record

```
signature   " LBL"        (4 bytes)
value_count u32           number of value records under this label
name_len    u32           length of the label name in bytes
name        name_len bytes ANSI label name, NOT null-terminated on disk
```

The label name is stored without a terminator; its length is given explicitly. Each label is immediately followed by its `value_count` value records.

### Value record

```
signature   " RTS" or "WRTS"   (4 bytes)
value_len   u32                 length in CHARACTERS
value       value_len * 2 bytes wide (16-bit) characters, obfuscated (see below)
```

`value_len` is a **character** count, so the number of bytes occupied on disk is `value_len × 2`. Reading it as a byte count is the classic mistake with this format.

If — and only if — the signature is `"WRTS"` rather than `" RTS"`, the value is followed by an additional ANSI "extra value" string:

```
extra_len   u32              length in bytes
extra       extra_len bytes  ANSI string
```

The `" RTS"` variant has no extra string.

## Wide-string obfuscation (bitwise NOT)

Each 16-bit character of a value is stored **bit-inverted** on disk: the file holds the bitwise complement of the real character, and the loader inverts every bit again to recover it. This is the canonical Westwood CSF obfuscation; it is a fixed transform, not encryption, and applies to the wide value strings only. The ANSI **extra** string of a `"WRTS"` record is stored plainly and is **not** inverted.

## Whitespace normalization

After a value is decoded, the engine normalizes its whitespace in place before storing it. The observed rules are:

1. Leading spaces (`U+0020`) are stripped.
2. Runs of consecutive spaces are collapsed to a single space.
3. TAB (`U+0009`) and LINE FEED (`U+000A`) are treated as a whitespace category: a space immediately preceding one is dropped, and they break a run of spaces.
4. A trailing space is stripped.

This changes the exact spacing of in-game text, so it is a genuine part of the engine's observable behavior rather than a cosmetic reader convenience.

## Storage and lookup

The loader keeps the decoded data in parallel arrays indexed by a flat string position: one array of label entries, one of decoded wide strings, and one of the optional ANSI extra strings (empty for `" RTS"` values). Values from every label are stored **flat, in file order**; each label entry records the flat index of its first value plus how many values it owns.

Each label entry holds the label name (kept as a null-terminated string of up to 32 bytes of the on-disk name), its value count, and that starting flat index.

Once all records are read, the engine **sorts the label entries by name, case-insensitively**, and thereafter resolves a lookup with a **binary search** over that sorted array — there is no hash table. A successful lookup returns the decoded wide string at the label's starting index (and its extra string when present).

### Missing keys never return null

A lookup for a key that is not present does not fail silently or return null. Instead the engine allocates a small node, writes the text `MISSING:<key>` into it, links it into an internal list, and returns that placeholder string. A consequence worth noting: repeated lookups of absent keys keep allocating and appending to that list.

## Language selection

The engine derives the actual filename to open from a base name plus a per-language suffix: it strips the base name's extension and inserts a language-specific suffix before reopening (for example, a base `ra2.csf` becomes `ra2md.csf`). Language identifiers are held in an internal table terminated by a sentinel entry (identifier 10). The full mapping of every language identifier to its filename suffix was not exhaustively recovered.

## Cross-version notes

- **Yuri's Revenge** — verified, as documented above.
- **Red Alert 2** — expected to be **identical** (RA2 and YR share the CSF stringtable). This has not been separately confirmed against the RA2 binary; treat RA2 as pending until it is.
- **Tiberian Sun** — **no CSF at all.** Tiberian Sun does not use this container; it stores its localized text through a different mechanism. There is no `" FSC"` loader in the TS lineage. This is a genuine cross-version divergence (an absence), not a variant of the format.

## What this entry does not claim

- The exact adjacency semantics of TAB and LINE FEED during whitespace normalization at every boundary — the general rules above hold, but the precise edge behavior when they sit directly against spaces has not been pinned to a crafted test case.
- The complete language-identifier-to-filename-suffix table. Only the mechanism (strip extension, append per-language suffix) and one worked example are established.
- That Red Alert 2 matches byte-for-byte; that expectation is stated as pending, not verified.
- Any reTS-specific API. This page describes the **original engine's** on-disk format and load behavior, not the reimplementation.

## Corrections

If you can falsify a claim on this page against retail *Command & Conquer: Yuri's Revenge* behavior — or supply the missing TAB/LINE FEED edge cases or the full language-suffix table from your own testing — open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues). Reports are re-checked against the binary before the page is updated.
