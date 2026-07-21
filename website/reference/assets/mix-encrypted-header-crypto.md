---
draft: true
sidebar_position: 2
title: MIX archive encryption (Blowfish + RSA "fast key")
description: >-
  How the original engine decrypts the header and file index of an encrypted MIX archive: an RSA-recovered Blowfish key over the index, with the body left in the clear. Verified: Yuri's Revenge (identical across the lineage).
last_verified: 2026-07-21
---

# MIX archive encryption (Blowfish + RSA "fast key")

*Last verified: 2026-07-21. Version coverage: verified end-to-end on **Command & Conquer: Yuri's Revenge**. The public key is byte-identical across the whole Westwood lineage (Tiberian Dawn, Red Alert, Tiberian Sun, Red Alert 2, Yuri's Revenge), so the scheme is **identical cross-version**; **Red Alert 2** is confirmed by decrypting real RA2 archives with the same key. **Tiberian Sun** is expected identical from the shared archive code but is stated here as pending an actual encrypted-TS decrypt, not confirmed.*

A MIX archive is the original engine's flat package format: a small header, a file index, and a concatenated data body. Stock archives ship with the **header and index encrypted** while the **body stays in the clear**. This entry documents exactly what is encrypted, the two-layer key scheme that unlocks it, and the numbers a reader needs to decode it. Only the **read (decrypt) path** is described.

:::note Publication bar
This covers the decryption path that is fully reversed, implemented, and proven by decrypting real retail archives to byte-exact indices. The archive-writing (encrypt) path and checksum *validation* are called out under "What this entry does not claim."
:::

## What is encrypted, and what is not

An encrypted archive uses the newer MIX layout, marked by a leading zero word and a flags word:

```text
offset 0   u16   0x0000            new-format marker
offset 2   u16   flags             bit 0 = checksum present, bit 1 = encrypted
offset 4   80 bytes                RSA-encrypted key block
offset 84  Blowfish-encrypted:
             i16  count            number of index entries
             u32  data_size        total size of the data body
             count × 12-byte index entries
           (padded up to a whole 8-byte Blowfish block)
<body>     data body               NOT encrypted
[trailer]  20-byte checksum        present only if flags bit 0 is set
```

Only the header word pair, the RSA key block, and the count/size + index are encrypted. The **file data itself is stored plainly** — once the index is decrypted, every member is a plain byte range in the body.

The body begins immediately after the encrypted index, rounded up to a whole Blowfish block:

```text
body_base = 84 + ceil((6 + count × 12) / 8) × 8
```

The `6` is the two-byte count plus four-byte data size; each index entry is 12 bytes; the run is padded to a multiple of 8. This was checked byte-exact against the real file sizes of several stock archives — `body_base + data_size (+ 20 if a checksum is present)` equals the actual file length to the byte:

| Archive | flags | count | body_base | data_size | checksum | total | file size |
|---|---|---|---|---|---|---|---|
| MULTI.MIX | encrypted | 97 | 1260 | 18,665,328 | none | 18,666,588 | 18,666,588 |
| ra2.mix | checksum + encrypted | 21 | 348 | 281,888,112 | 20 | 281,888,480 | 281,888,480 |
| language.mix | checksum + encrypted | 6 | 164 | 53,115,856 | 20 | 53,116,040 | 53,116,040 |

The optional trailer (flags bit 0) is a **20-byte checksum appended after the data body**. It does not participate in header decryption.

## The two-layer key scheme

Decryption has two layers. The outer layer is RSA and runs once; the inner layer is Blowfish and covers the header/index:

1. **RSA "fast key" recovery.** The 80-byte block at offset 4 is RSA-decrypted with a fixed public key baked into the engine. The recovered plaintext's first **56 bytes are a Blowfish key**.
2. **Blowfish header decrypt.** That 56-byte key deciphers the `{count, data_size}` pair and the index in **ECB mode**, one 8-byte block at a time.

Once the index is in hand, reading a member is a plain seek-and-copy into the unencrypted body.

### The RSA layer

The engine carries one hardcoded public key, stored as a Base64 string under a `[PublicKey]` section (a single `1=` line). It is the same "fast key" Westwood shipped across every game in the lineage. Decoding it gives:

- a **319-bit modulus**, and
- the standard public exponent **65537**.

With a 319-bit modulus the RSA block math is fixed: each **cipher block is 40 bytes** and yields a **39-byte plaintext block**. The 80-byte key block is therefore exactly **two cipher blocks**, producing 78 plaintext bytes; the **first 56** of those are the Blowfish key (the remainder is unused padding for this purpose).

RSA here is ordinary modular exponentiation — `plaintext = cipher^exponent mod modulus` — so any correct big-integer implementation reproduces the engine's output exactly; there is nothing engine-specific to imitate in the math.

### The Blowfish layer

The inner cipher is **standard Blowfish** (Schneier, 1993): an 18-entry P-array and four 256-entry S-boxes seeded from the fractional hex digits of π, a 16-round Feistel network, 8-byte blocks, and a key of up to 56 bytes. The engine deciphers the header and index in **ECB** (each block independent, no chaining).

The original engine does not carry its own Blowfish code in the executable — it drives an external Blowfish component through a standard interface — but the algorithm on the wire is textbook Blowfish, verified against the published Blowfish known-answer test vectors.

### The endianness split (load-bearing)

The two layers disagree on byte order, and getting this wrong silently corrupts the output:

- The **RSA** layer treats the on-disk cipher bytes as **little-endian** big-integer limbs, and writes its plaintext **little-endian**.
- The **Blowfish** layer consumes its 8-byte blocks as **big-endian** words.

A decoder that picks one byte order for the whole scheme will fail. The decode sequence that matches retail is:

```text
1. modulus  = big-integer from the decoded public key
2. for each 40-byte cipher block (read little-endian):
       m = block ^ 65537 mod modulus
       emit the low 39 bytes, little-endian
3. blowfish_key = first 56 emitted bytes
4. Blowfish-ECB-decrypt (big-endian blocks) the count/size + index
```

## The decrypted index

Each of the `count` entries is **12 bytes**. Decrypted indices are **sorted by a signed 32-bit key**, and every member's `offset + size` stays within `data_size` — the same signed 32-bit ordering the unencrypted MIX format uses. This ordering, together with the byte-exact `body_base + data_size` match above, is what confirms the whole scheme rather than only the algorithm shapes: several different real archives all decrypt to internally consistent, file-size-exact indices.

## Cross-version notes

- **Yuri's Revenge** — verified end-to-end.
- **Red Alert 2** — confirmed: real RA2 archives decrypt with the same public key.
- **Tiberian Dawn / Red Alert / Tiberian Sun** — the public key string is byte-identical to the one above, so the scheme is the same construction; RA2 and YR are the two confirmed by actual decrypts. A live decrypt of an encrypted Tiberian Sun archive to promote it from "expected identical" to "confirmed" is still outstanding.

## What this entry does not claim

- **Checksum validation.** The trailing 20-byte checksum's location and size are confirmed, but whether the engine *verifies* it on load (versus merely skipping past it) is not established here.
- **The encrypt/write path.** Only decryption for reading is documented; how the engine *produces* an encrypted archive is out of scope.
- **Tiberian Sun by direct decrypt.** TS shares the key and is expected identical, but that has not been proven by decrypting an actual encrypted TS archive.
- **Any reTS-specific API.** This page describes the **original engine's** on-disk scheme, not a reimplementation's interface.

## Corrections

If you can falsify a claim on this page against retail behavior, open an issue on the [reTS repository](https://github.com/DasSheep/reTS/issues). Reports are treated as verification input and re-checked before the page is updated.
