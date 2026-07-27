---
sidebar_position: 1
last_verified: 2026-07-16
---

# For modders

reTS is designed to become extensible through both classic-ecosystem compatibility
and a native content-authoring path. Neither surface is publicly shipped today.

*Last verified against the implementation and public release state: 2026-07-16.*

:::caution Design, not a usable authoring surface
There is no public Lua runtime, mutator API, map-mode API, or compatibility layer
to target yet. This page separates approved direction from implemented features;
examples and API guides will publish only when the corresponding surface lands.
:::

## What's inspectable today

There's no runtime or API to write mods against yet, but the underlying research
is already publishing as binary-verified, human-readable material a mod author or
researcher can use right now:

- **[Engine Reference](/reference)** is a ModEnc-style encyclopedia of the
  *original* engine's behavior — published only once a system is fully reversed,
  ported, and oracle-tested against retail. The section index always lists the
  current catalog; coverage grows entry by entry as systems clear that bar.
- The **[Warhead rules interpretation](/reference/data-rules/warhead-rules)** entry
  is a concrete example of the cross-version rules divergences this project can now
  pin: field-by-field, it documents which `[Warhead]` keys exist on each of
  Tiberian Sun, Red Alert 2, and Yuri's Revenge, their constructor defaults, and a
  Tiberian Sun-only session-type override — exactly the kind of compatibility
  question that comes up when carrying a `Verses=`/`CellSpread=`/`PercentAtMax=`
  warhead definition between games.
- That reference material is backed by a **fixed four-tool MCP capability gateway**
  (`find_capabilities` / `describe_capability` / `run_capability` / `verify_spec`)
  the project's own tooling uses to search, describe, and run every verified engine
  capability, and to re-run the full spec-as-oracle suite on demand. The gateway
  itself isn't public yet — see the
  [contributor architecture writeup](/docs/contributing/mcp-gateway) — but it's the
  mechanism behind the claims published on this site: every entry traces to a
  capability that passes `verify_spec` against the retail binary, not a guess.

## Approved direction

- **Lua scripting is planned** as an opt-in layer beside the faithful native
  mission system, gated on the engine behavior it exposes.
- **Rules and mutators are planned** as explicit, shareable overlays that leave
  faithful vanilla behavior as the default.
- **Maps and modes are planned** to grow with verified world, scenario, and
  scripting surfaces.

The design rationale is covered in
**[From the Harvest Route to New Ways In](/devblog/engine-seams)**.

## Design principles

- **Faithful by default.** Vanilla behavior remains the baseline; modern behavior
  is explicit and opt-in.
- **Determinism is a gate.** Simulation-affecting scripting is designed to use
  engine time, engine randomness, typed numeric boundaries, content hashing, and
  bounded execution. These are requirements for future implementation, not a
  claim that multiplayer scripting works today.
- **Guides follow code.** No placeholder API or Lua example is published before a
  real, tested binding exists.
