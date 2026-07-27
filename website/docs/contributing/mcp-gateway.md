---
sidebar_position: 2
last_verified: 2026-07-16
---

# The MCP capability gateway

reTS exposes its verified engine systems to AI agents over the Model Context
Protocol (MCP). This page documents how that surface is shaped and how a new
system joins it. It describes architecture and behavior only — there is no
public build of the server yet (see the [contributor overview](./overview)).

:::caution Source not released
The public repository currently contains this website, not the engine source
or a runnable server. This page documents the design so future contributors
understand the contract before the source release.
:::

## Why a fixed four-tool gateway, not one tool per system

The obvious design is to give every reversed engine system its own MCP tool:
`compute_damage`, `simulate_pathfind`, `mix_retrieve`, and so on, one per
capability. reTS tried that first, and it does not scale.

Every tool a server advertises has to be serialized into the client's context
on session start, whether or not that tool is ever called. As of a
2026-07-15 measurement, the project had reached about five dozen individually
advertised tools, serializing to roughly 157,000 characters of `tools/list`
JSON — an estimated 39,000 tokens paid before any actual work happens.
Descriptions alone were about a fifth of that (roughly 35,000 characters);
input schemas — the dominant cost — made up nearly all of the rest, and the
single largest tool definition ran past 18,000 characters by itself. Because tool count
tracks engine coverage, a simple linear projection put a fully-covered engine
past a quarter-million characters of startup payload — an unusable amount of
context spent purely on *discovery*.

Shortening descriptions, merging operations into one large tagged-union tool,
or splitting tools across multiple servers only rearrange that cost; they
don't remove it, and several make individual tool definitions larger, not
smaller. The fix that actually works is to stop advertising every capability
by default and instead advertise a small, constant-size **control plane**
that can search and load capability metadata on demand:

- `find_capabilities` — search a compact catalog by intent, engine area, game
  lineage, kind, or reconciliation status.
- `describe_capability` — load one capability's exact input schema (and
  optionally its documentation) only when it's actually being considered.
- `run_capability` — execute a named capability with validated arguments.
- `verify_spec` — run the project's spec-as-oracle test suite and report
  pass/fail against the original engine's verified behavior.

After moving to this four-tool surface, the same startup call serialized to
a few kilobytes — roughly a 98% reduction — while every one of the previously
advertised capabilities remained fully reachable through the gateway. The
key property is that this discovery cost is now **constant**: it does not
grow as more engine systems are reversed, ported, and verified. A capability
added today costs the same context at startup as a capability added after a
hundred more systems are done, because its schema and documentation only load
when a caller asks for it by name.

## The discover → describe → run flow

A worked example: an agent wants to compute a damage result.

**1. Discover.** Search the catalog by intent rather than guessing an exact
name:

```json
{ "name": "find_capabilities", "arguments": { "query": "damage", "limit": 5 } }
```

The response returns compact matches only — no schemas yet — each with a
name, a one-sentence summary, its engine area, which games it's reconciled
for, and its reconciliation status:

```json
{
  "count": 1,
  "capabilities": [
    {
      "name": "compute_damage",
      "summary": "Resolve a full faithful damage calculation (firer firepower → target armor → warhead falloff/Verses/MaxDamage) and return the stage-by-stage breakdown.",
      "area": "combat",
      "kind": "compute",
      "games": ["YR"],
      "status": "verified"
    }
  ]
}
```

**2. Describe.** Load the exact input schema for the one capability the agent
actually intends to call:

```json
{ "name": "describe_capability", "arguments": { "name": "compute_damage", "detail": "schema" } }
```

This returns the capability's metadata plus its full JSON Schema — weapon
damage, `Verses`, cell spread and falloff shape, warhead flags, firer
multipliers, and so on. That schema is paid for once, on demand, instead of
being carried by every session regardless of use.

**3. Run.** Call it with arguments matching the schema:

```json
{
  "name": "run_capability",
  "arguments": {
    "name": "compute_damage",
    "arguments": {
      "weapon_damage": 100,
      "verses": 0.75,
      "cell_spread": 2.0,
      "distance": 128
    }
  }
}
```

The result is the capability's structured breakdown: each stage of the
pipeline (fire-side multipliers, target armor, warhead falloff and `Verses`,
the `MaxDamage` clamp, the final value) labeled and inspectable, not a bare
number. That introspectable-breakdown contract is a project-wide invariant
that predates the gateway — the gateway changes how a capability is
discovered and called, not the shape of what it returns.

## `verify_spec`: the oracle-suite check

`verify_spec` stays a direct, always-on tool rather than a registry entry,
because it's a small, high-frequency trust check rather than an engine
operation: it runs the project's spec-as-oracle test suite — checks whose
expected values are hand-derived from the original engine's verified
behavior — and reports which systems still match ground truth. Its default
response is a pass/fail summary plus any failing cases; verbose detail on
passing cases is opt-in, so a routine trust check doesn't itself become a
large response by default.

## `response_detail`: bounding what `run_capability` returns

Some capabilities can return large structured results — a full pathfinding
route, a multi-stage economy simulation, a decoded asset's record list.
`run_capability` accepts an optional `response_detail` argument that controls
how much of that result comes back:

- **`breakdown`** (the default) — the capability's complete structured
  result, exactly as the underlying faithful function produced it.
- **`full`** — an explicitly lossless result; for capabilities whose
  breakdown already *is* the complete result, `full` and `breakdown` are
  identical.
- **`summary`** — bounds heavy top-level fields so a large result can't blow
  the caller's context by default. Any top-level array collapses to its
  count plus a short sample (the first few entries) with a `truncated` flag;
  any top-level string past a length threshold is capped. Scalars and
  already-small nested objects pass through untouched — summary mode only
  guards against unbounded top-level collections, it doesn't re-summarize
  data that's small to begin with.

For example, a capability like `simulate_pathfind` can return a route with
many cells. Called with `response_detail: "summary"`, that route field comes
back as, say, `{ "count": 47, "sample": [...three cells...], "truncated":
true }` (illustrative numbers, not a measured oracle result) instead of all
N entries, while small fields on the same result (a status code, a
final-cost scalar) are returned as-is.

## Capability metadata: games, status, and `find_capabilities` filters

Every capability in the registry carries metadata beyond its name and
schema, and `find_capabilities` can filter on all of it:

- **`area`** — engine area (combat, movement, economy, assets, rules, ui, and
  so on).
- **`kind`** — `compute`, `inspect`, `simulate`, `decode`, `verify`, or
  `other`.
- **`games`** — which of TS, RA2, and YR the capability's behavior has
  actually been reconciled against. This list is deliberately conservative:
  a capability lists a game only once its behavior has been checked against
  that game specifically, not merely inherited by assumption from whichever
  game it was originally reversed from. A capability reversed from one game
  and not yet diffed against the others lists only that one game, even if the
  systems look likely to match.
- **`status`** — `verified` or `partial`. A capability reports `verified`
  only when the research backing it has reached the project's verified
  confidence tier; every other confidence level — high-confidence,
  in-progress, initial, or anything short of that top tier — is
  conservatively reported as `partial`, even when the underlying evidence
  reads as strong. This mirrors the project's general rule of undercounting
  rather than overcounting completion.

`find_capabilities` accepts `query` (free-text intent or keyword), `area`,
`kind`, `games` (an array; a capability matches if its reconciled coverage
includes any listed game), `status`, and `limit` (default 10, maximum 25) —
so an agent can ask for, say, verified `combat` capabilities that cover `YR`
without pulling in every capability in the catalog.

## Adding a new system: the contributor workflow

When a reversed engine system is ready to become machine-callable, it never
becomes a new top-level MCP tool. The contract is:

1. **Reverse** the system's behavior against the original engine and record
   the findings.
2. **Port** it as a pure, deterministic Rust function.
3. Have that function return a structured **breakdown** — each computation
   stage labeled and inspectable — not a bare scalar.
4. Pin it with **spec-as-oracle tests**: expected values hand-derived from
   the original engine's verified behavior, so a test failure means the
   port drifted, not that the test is stale.
5. Register it as an **internal capability**: a summary, engine area, kind,
   game coverage, reconciliation status, input schema, and handler in the
   registry — never a new top-level tool or a new branch added to one of the
   four gateway schemas.

That last point is enforced, not just documented convention. Two automated
guard checks run against the server:

- A **surface-budget guard** that pins the default tool list at exactly four
  entries, caps the serialized `tools/list` response at roughly 12 KiB, caps
  combined tool descriptions at roughly 2 KiB, keeps the initialization
  instructions self-contained within 512 bytes, and forbids detailed
  research provenance from appearing in the always-on tool definitions. A
  pull request that grows the default surface fails this check.
- A **dispatch guard** that walks every registered capability and confirms
  it declares an engine area and resolves to a working handler, so a
  registry entry can't silently exist without anything behind it.

The result is a project-wide invariant: every verified system stays fully
machine-callable, but none of them are ever *always present* in a client's
context. Discovery cost is decoupled from engine completeness by
construction, not by discipline that has to be remembered on every addition.
