---
slug: a-bridge-over-water
title: A Bridge Over Water
date: 2026-07-21T20:00:00+07:00
authors: [rets-team]
tags: [devblog, faithful-port, pathfinding, map, adversarial-verify]
last_verified: 2026-07-21
---

March a column of tanks across a bridge in Red Alert 2 and they cross without
a second thought. That "without a second thought" is doing a lot of work.
Underneath the bridge is water — impassable to a tank — and yet the two banks
behave as if they were one continuous stretch of land. This week we reversed
the routine that makes that true, and then spent the back half of the session
arguing with ourselves about whether we'd broken something along the way.

{/* truncate */}

*Last verified against the project oracle: 2026-07-21.*

## Zones, and the question they answer

Pathfinding in this engine doesn't ask "is there a route from A to B?" every
time something wants to move — that would be ruinously expensive on a big map.
Instead the map is pre-divided into **connectivity zones**: contiguous regions
a given kind of mover can travel within. Two cells in the same zone are
reachable from each other; two cells in different zones are not, at least not
without a special crossing. So the fast question a unit asks before it bothers
to plan a path is simply "are we in the same zone?" — one lookup, no search.

Every cell carries its zone id, indexed per movement type (what's one connected
zone for a hovercraft is several disconnected islands for a tank). The routine
we reversed this week is the one that answers "which zone is this cell in?" — the
lookup that gates every reachability check in the game.

## The bridge deck problem

For an ordinary cell the answer is a straight table read. Bridges are where it
gets interesting. A bridge deck sits *over* water. Taken at face value its cell
belongs to the water — impassable, disconnected, an island of one. If the lookup
returned that, no ground unit would ever agree to step onto a bridge, because the
deck would read as unreachable from either bank.

So the engine does something craftier. When the query lands on a bridge deck, it
doesn't return the deck's own zone. It consults a table of **zone connections** —
records that tie a bridge span to the land it joins — and, unless the connection
is already flagged as resolved, it **walks across the span**: east if the bridge
runs horizontally, south if it runs vertically, one cell at a time, until it
steps off the far end onto solid ground. It checks that the landing cell is real
terrain — a bridge or cliff tile, not bare rock or open water — and then borrows
*that* cell's zone. The deck inherits the connectivity of the shore it reaches.
Both banks, and the span between them, resolve to a single zone, and the tank
crosses without a second thought.

It's a small, self-contained piece of cleverness, and it's the kind of thing
that only survives a faithful port if you copy the *exact* rules: which direction
the walk goes, what counts as a valid landing, and — a detail the summary we
started from had quietly smoothed over — that the endpoint search is
axis-asymmetric. A vertical span measures distance one way; a horizontal span
measures it the other. Copy the summary and you swap them; copy the instructions
and you don't.

## Two grids that looked like one

Having landed the *reader*, we went looking for the *writer* — the routine that
fills in all those zone ids in the first place. We found the map's
pathfinding-rebuild code, and with it a genuinely alarming coincidence.

The rebuild pass walks a per-cell grid using the **same** indexing math the
reader uses — the same stride, and the same slightly-unusual "clamp to the last
valid slot" rule we'd carefully matched last week. Same formula, down to the
off-by-one. But the records it writes are *ten bytes wide*, and the records the
reader reads are *four*. Same index, different record size, on what appeared to
be the same array. If it really was the same array, then one of the two record
sizes was wrong — and the one we'd shipped was the reader's.

It wasn't the same array. The map keeps **two parallel grids**, one entry per
cell in each, sharing only a count and an index formula: a compact four-byte grid
holding the connectivity zone the reader returns, and a wider ten-byte grid the
pathfinding rebuild uses as scratch space. The writer zeroes and refills the
scratch grid; it never touches the field the reader reads. Two structures that
are trivial to conflate precisely because they're indexed identically — and that
share nothing else.

We didn't want to take our own word for that, because "the code you shipped is
fine, actually" is exactly the conclusion a tired reviewer wants to reach. So the
reconciliation ran as an adversarial exercise: independent passes re-derived both
record layouts from the raw instructions, from different starting assumptions,
each trying to prove a bug existed — cross-checked against the original engine's
own published structure names. They converged: last week's port is faithful, the
two grids are distinct, no bug. The review *confirmed* the earlier work instead
of overturning it, and named a new structure on the way through.

There was a bonus in the confusion. It corrected our roadmap. We'd assumed one
builder fed the zone reader; in fact the pathfinding chain we found builds the
*scratch* grid, and the reader's grid is filled by a different routine we haven't
located yet. That's two clean next steps instead of one tangled one — and the
shared indexing math is now a single tested primitive both grids, and both future
builders, will call.

## Why the fuss

None of this changes what a bridge looks like on screen. It changes whether a
faithful reimplementation *agrees* with the original about which cells can reach
which — the invisible substrate under every unit that has ever pathed around a
lake. Getting the bridge-borrow rule exactly right, and proving the grid
underneath it is modeled exactly right, is the difference between "our
pathfinding looks about the same" and "our pathfinding is the same." The second
one is the whole point.
