---
slug: the-field-that-was-never-a-pointer
title: "The Field That Was Never a Pointer"
date: 2026-07-23T22:00:00+07:00
authors: [rets-team]
tags: [devblog, map-grid, connectivity, bridges, tunnels, pathfinding, multi-game, faithful-port, verification, tiberian-sun, red-alert-2, yuris-revenge]
last_verified: 2026-07-28
---

A tile-based map does not need to be told what connects to what. Cells are laid
out on a grid; the cell to your north is the one at your coordinates minus a
row. Adjacency is arithmetic, not data, and that is most of why grid games are
cheap to path through.

Bridges and tunnels break that for a living. A bridge deck runs *over* the
terrain beneath it, so the cells a unit can actually reach from the middle of a
span are not the cells geometrically beside it. A tunnel mouth connects to
another tunnel mouth that may be most of a map away. These are the exceptions to
the arithmetic, and an engine that wants them has to write them down.

Tiberian Sun writes them down. The map keeps an explicit list of connections
that ordinary adjacency cannot express, and today we found the code that builds
it.

<!-- truncate -->

*Last verified against the project oracle: 2026-07-28.*

## Three systems standing on an input nobody produced

We had already ported the consumers. The bridge resolver uses this list to
decide which bank a given piece of deck belongs to. Both of the connectivity-zone
builders — the passes that work out which regions of a map are mutually
reachable — use it to stitch together regions that are genuinely connected while
being nowhere near each other.

All three read the list. None of our code wrote it. Every test constructed the
records by hand and handed them in, which meant every test was making the same
assumption at the same time: that the records we invented looked like the
records the game builds. That is a comfortable position to be in and a bad one
to stay in, because a shared wrong assumption between a system and its tests is
invisible from inside.

So the builder was the next thing to reverse, and this time it was reversed in
all three executables at once rather than one and a diff.

## Identical, to the byte

The rebuild has the same shape in Tiberian Sun, Red Alert 2 and Yuri's Revenge —
the same instruction sequence, the same structure, the same decisions in the
same order. More usefully, the three small fixed tables that describe where a
span can start, which directions it can run, and what counts as a far end are
**byte-identical across all three games**.

That kind of finding is worth more than it looks. These engines share a
codebase, and when a reversed structure turns out to be byte-identical across
the lineage, one careful read certifies three binaries instead of one. It also
runs the other way as a check: if a table had differed, that difference would
itself be a finding worth chasing rather than a rounding error to smooth over.
We now log these matches deliberately.

The algorithm emits two kinds of record:

- **Tunnel links.** These require tunnel cells on opposite sides of an axis. A
  tunnel pair could obviously be discovered twice — once walking out from each
  end — so the code leans on the map's own cell ordering to let only one of the
  two endpoints emit the record. The deduplication is not a separate pass; it
  falls out of which endpoint gets there first in the traversal order.
- **Bridge and cliff spans.** These walk across the map, remembering whether
  every gap crossed so far has stayed on the bridge deck, and record the first
  far end that matches the table.

## The field with a name and no job

Each record has a field that community headers — the accumulated reverse
engineering of two decades of modders, and a genuinely valuable resource — label
as a pointer to an owning cell. It is a sensible name. Records like this
routinely carry a back-reference to whatever produced them, and if you were
writing this structure yourself you would probably put one there.

The vanilla builder never writes a pointer into it. It writes a literal `1` for
tunnel links and a literal `0` for bridge and cliff spans, and nothing else,
ever. It is a type tag wearing a pointer's name.

The correction immediately explained something that had looked arbitrary. The
bridge resolver skips one class of record entirely while the zone builders
happily consume both — behaviour that reads as an inconsistency if you believe
the field is a pointer, and as the obvious thing to do if you know it is a tag.
The resolver is not ignoring records; it is filtering on a discriminator that
was hiding in plain sight under the wrong label.

We keep relearning the same lesson in different costumes: **community headers
are corroboration, never the oracle.** They are frequently right, which is
exactly what makes them dangerous — a name that is right nine times in a row
buys enough credibility to get the tenth one waved through. The binary is the
only thing that gets a vote. A plausible name attached to a field is a
hypothesis in a very good disguise.

## What it buys

The port landed with ten hand-computed expected values derived from the traced
code, and the builder is now reachable through the project's inspection gateway
alongside the systems that consume it.

The real payoff is in the tests. Until today, a test for the zone builders
supplied its own connection records, which meant it could only ever check that
the consumer handled *some* input correctly. Now a test can build the topology
the way the game builds it and feed the genuine article downstream. That closes
a loop: the producer and its three consumers are checked against each other, not
just individually against our idea of what passes between them.

An input you invent can only test one side of an interface. An input you derive
tests the seam.
