---
draft: true
sidebar_position: 2
title: MIX archives and filename resolution
description: >-
  The MIX container format, how filenames become archive lookups, and the exact order the engine searches archives versus loose files. Verified: Yuri's Revenge.
last_verified: 2026-07-21
---

# MIX archives and filename resolution

*Last verified: 2026-07-21. Version coverage: **Command & Conquer: Yuri's Revenge** only. Red Alert 2 and Tiberian Sun are **pending** — the archive machinery is shared across the lineage, so the same parsing is expected, but neither has been separately verified and neither is claimed here.*

The original engine keeps almost all of its data — art, audio, rules, maps — inside **MIX** archives: flat, unindexed-by-name container files. When any code asks for a file by name, the engine turns that name into a numeric key, searches the mounted archives for it, and only then looks on disk. This entry documents the container layout, the name-to-key step, and the search order, as recovered from the retail engine.

:::note Publication bar
This entry covers the plaintext container format, the filename-resolution order, and the boot-time archive list — all fully reversed, implemented, and oracle-tested. The encrypted-header path is reversed and summarized below. A few edges (cross-archive precedence, checksum validation) are **not** established and are called out explicitly at the end rather than guessed.
:::

## What a MIX is

A MIX file is a small header, a sorted table of entries, and then a run of raw file bodies concatenated together. There are **no filenames stored in the archive.** Each entry identifies its file by a 32-bit hash of the (uppercased) name. Lookups are therefore hash lookups: the engine hashes the requested name and binary-searches the table.

## On-disk layout

The container begins by reading the first 16-bit word, which selects one of two header formats.

### Plain header (first word ≠ 0)

If the first 16-bit word is non-zero, **that word is the entry count** and there are no flags — this format is never encrypted and never carries a checksum:

```text
u16  entry_count        ; the leading non-zero word
u32  body_size          ; total bytes of all file bodies
; header = 6 bytes
```

### Extended header (first word == 0)

If the leading word is zero, it is a marker and the next 16-bit word holds **flags**:

```text
u16  marker = 0x0000
u16  flags              ; bit 0 = checksum, bit 1 = encrypted
[ u8[80]  key block ]   ; present only when the encrypted flag is set
u16  entry_count
u32  body_size
```

Two flag bits are defined:

| Bit | Meaning |
|-----|---------|
| 0 | **Checksum** — a 20-byte digest is appended after the file bodies. |
| 1 | **Encrypted** — the entry count, table, and (when present) key block are encrypted; see [Encryption](#encryption-and-checksum). |

When the encrypted flag is set, an 80-byte key block follows the flags, and the count/table are read through the decryption path. When it is clear, the count and table are read directly.

The on-disk entry count is a **signed 16-bit** field; the engine sign-extends it to a 32-bit count internally.

### The entry table

Immediately after the header is the table: `entry_count` records of **12 bytes each**, sorted in ascending order by their id:

```text
u32  id       ; hash of the uppercased filename
u32  offset   ; start of this file's body, relative to the body base
u32  size     ; length of this file's body, in bytes
```

The **body base** is the file position immediately after the table. A file's bytes are read at `body_base + offset` for `size` bytes. There is no extra padding between the table and the bodies.

## Filename → lookup key

To find a file, the engine converts its name to the 32-bit `id` used in the table:

1. **Uppercase the name** in place: ASCII `a`–`z` become `A`–`Z`.
2. **Hash it** with the engine's internal name hash — a reflected CRC-style function. This is the *same* hash the engine uses for rules-file entry names, **not** a standard CRC-32. The only difference from the rules-name path is the uppercase fold: rules entry names are hashed as-is (case-sensitive), while MIX names are always uppercased first.

Because the table is sorted by id, the lookup is a **binary search**: hash once, then bisect. Case therefore does not matter for MIX lookups — `Art.ini` and `ART.INI` resolve to the same id.

## Search order: archives first, then loose files

When the engine is asked whether a file exists (or to load it), it walks a fixed ladder and stops at the first rung that answers. The order recovered from the retail engine is:

1. **Existence cache** — a per-name tri-state (present / absent / unknown) short-circuits repeat queries.
2. **Open handle** — if the file is already open, it is present.
3. **MIX archives** — hash the name and search the mounted archives.
4. **Loose file on disk** — a direct filesystem probe for a matching file in the search path.
5. Otherwise the file is absent (and that result is cached).

The load-cache in front of this ladder is keyed by the same name hash, so a file already loaded is returned from memory without touching an archive or disk.

The load-bearing fact here: **archives are consulted before loose files.** A file packed into a MIX is found *before* a same-named file sitting loose on disk — the opposite of the common assumption that loose files always override archive contents. (How a mod actually overrides packed data — for example via an expansion MIX — depends on cross-archive precedence, which this entry does **not** settle; see below.)

## Boot-time archive list

At startup the engine mounts a fixed list of archives, opening each one that exists in this order:

1. `EXPANDMD99.MIX` down through `EXPANDMD00.MIX` — the expansion slots, opened in **descending** numeric order.
2. `RA2MD.MIX`, then `RA2.MIX`
3. `CACHEMD.MIX`, then `CACHE.MIX`
4. `LOCALMD.MIX`, then `LOCAL.MIX`

The `EXPANDMD##.MIX` names are formed with a two-digit, zero-padded number, giving the slots `00` through `99`. Each archive that is present is added to the engine's global archive list; the expansion archives are additionally tracked as a group.

## Encryption and checksum

When the encrypted flag is set, the 80-byte key block is an **RSA-encrypted Blowfish key**. The engine decrypts the block with a fixed public key (built once at startup from a hardcoded key string) to recover a Blowfish key of at most 56 bytes, then uses **Blowfish** — a 16-round Feistel cipher operating on 8-byte blocks — to decrypt the entry count and the table. The file bodies themselves are stored in the clear; only the header/table are encrypted. This scheme has been reversed end to end and confirmed by decrypting real stock archives.

When the checksum flag is set, a **20-byte digest** is appended after the file bodies. Its presence and position are established; whether the engine *validates* it on load is not (see below).

## What this entry does not claim

- **Cross-archive precedence.** When the same filename exists in more than one mounted archive, which archive wins is **not** established here. In particular, this entry does not claim that expansion (`EXPANDMD##`) archives override the base archives, nor the reverse. Mount order and search-within-archives order were recovered; the tie-break *between* archives was not, and is not asserted.
- **Checksum validation.** The 20-byte digest's location is known; whether it is checked against the bodies at load time is unverified.
- **The open/load handle path vs. the existence path.** The existence ladder above is confirmed; whether the file-open path walks the archives in the same order has not been separately confirmed.
- **Tiberian Sun and Red Alert 2 parity.** Only Yuri's Revenge was verified. The other two games are expected to parse identically but are not confirmed, and no per-game divergence is claimed either way.
- **Any reTS-specific API.** This page describes the **original engine** behavior; it is not a description of how reTS exposes it.

## Corrections

If you can falsify a claim on this page against retail *Command & Conquer: Yuri's Revenge* behavior, open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues). Reports are treated as verification input and re-checked against the oracle before the page is updated.
