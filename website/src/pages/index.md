---
title: reTS
description: An in-development, faithful reimplementation of the Command & Conquer TS/RA2 engine.
hide_table_of_contents: true
last_verified: 2026-07-16
---

# reTS

**reTS** is an early clean-room project rebuilding the classic Westwood isometric
real-time-strategy engine behind the **Command & Conquer** titles Tiberian Sun,
Red Alert 2, and Yuri's Revenge. The goal is a faithful, standalone, moddable
engine; every implemented slice is held to recovered behavior before modern
extensions can build on it.

*Last verified against the project charter and release state: 2026-07-16.*

> ⚠️ **Early and in active development.** There is no public engine source
> release, playable build, or native authoring tool yet. The public surface today
> is this documentation site, the growing Original Engine Reference, and the devblog.

## How far along is it?

<!-- progress:start -->
<!-- Generated from the project's progress tracker - do not hand-edit this block. -->

**≈21%** of the way to a fully-playable, faithful Red Alert 2 / Yuri's Revenge engine, end to end *(excludes mod-compatibility scope)*.

<progress className="tracker tracker-overall" value="21" max="100" />

| Area | | Done |
|------|---|----:|
| Foundations & harness | <progress className="tracker" value="85" max="100" /> | 85% |
| Primitives (math / RNG / coords / time) | <progress className="tracker" value="94" max="100" /> | 94% |
| Data & rules interpretation (INI / inheritance) | <progress className="tracker" value="34" max="100" /> | 34% |
| Asset formats (MIX / SHP / VXL / TMP / PAL / CSF / maps) | <progress className="tracker" value="23" max="100" /> | 23% |
| Object model & world grid | <progress className="tracker" value="33" max="100" /> | 33% |
| Movement & locomotion | <progress className="tracker" value="30" max="100" /> | 30% |
| Combat (weapons / projectiles / targeting / veterancy) | <progress className="tracker" value="40" max="100" /> | 40% |
| Unit & building sim (production / power / deploy / SW) | <progress className="tracker" value="18" max="100" /> | 18% |
| Economy (harvest / refine / tech tree) | <progress className="tracker" value="12" max="100" /> | 12% |
| House & skirmish AI (build order / teams / triggers) | <progress className="tracker" value="17" max="100" /> | 17% |
| Campaign / scenario (triggers / tags / objectives) | <progress className="tracker" value="15" max="100" /> | 15% |
| Presentation / rendering (iso / SHP / VXL / shroud) | <progress className="tracker" value="4" max="100" /> | 4% |
| Audio (SFX / EVA / music) | <progress className="tracker" value="12" max="100" /> | 12% |
| Shell / UI (menus / sidebar / build queue) | <progress className="tracker" value="6" max="100" /> | 6% |
| Multiplayer / netcode (lobby / lockstep / replay) | <progress className="tracker" value="3" max="100" /> | 3% |
| Save-load & game loop | <progress className="tracker" value="18" max="100" /> | 18% |

**Layered scope** — additive, opt-in on the faithful core *(not counted in the engine % above)*.

| Dimension | | Progress |
|-----------|---|----:|
| Tooling (workbench / map editor / viz / converters) | <progress className="tracker" value="7" max="100" /> | 7% |
| Parameterization (de-hardcoded reversed limits) | <progress className="tracker" value="0" max="100" /> | 0% |
| Modernization (code / assets / presentation / modding) | <progress className="tracker" value="1" max="100" /> | 1% |

<sub>A deliberately **conservative**, best-judgment estimate — only behavior that is fully recovered from the original engine, reimplemented, and verified against it counts; scaffolding, partial traces, and work-in-progress do not. It is an at-a-glance gauge, not an objective measure and not a schedule. Last updated: 2026-07-25.</sub>
<!-- progress:end -->

<!-- re-coverage:start -->
<!-- Generated from the project's function-coverage metric - do not hand-edit this block. -->

**Empirical function coverage.** Faithfulness means all three engines in the lineage are equal targets, so coverage is measured against every one. Together the 3 original binaries contain **23,808 functions**; filtering out compiler runtime and trivial accessor glue — absorbed by data-structure modeling rather than reversed function-by-function — leaves **9,015 substantive functions** the work actually has to conquer. Counted directly from the analysis record, as a complement to the judgment-based estimate above.

| Of all 23,808 functions across the lineage | | |
|---|---|----:|
| Located in the RE record | <progress className="tracker" value="9" max="100" /> | 2,093 (8.8%) |
| Analyzed in depth | <progress className="tracker" value="2" max="100" /> | 429 (1.8%) |
| In verified reimplementation code | <progress className="tracker" value="4" max="100" /> | 856 (3.6%) |

| Of the 9,015 substantive functions | | |
|---|---|----:|
| Located in the RE record | <progress className="tracker" value="12" max="100" /> | 1,126 (12.5%) |
| Analyzed in depth | <progress className="tracker" value="3" max="100" /> | 287 (3.2%) |
| In verified reimplementation code | <progress className="tracker" value="5" max="100" /> | 454 (5.0%) |

| Substantive surface located, per engine | | |
|---|---|----:|
| YR | <progress className="tracker" value="20" max="100" /> | 678 / 3,345 (20.3%) |
| RA2 | <progress className="tracker" value="7" max="100" /> | 231 / 3,181 (7.3%) |
| TS | <progress className="tracker" value="9" max="100" /> | 217 / 2,489 (8.7%) |
<!-- re-coverage:end -->

## Explore

- 📖 **[Introduction](/docs/intro)** — what reTS is and how it's built.
- 🎮 **[For players](/docs/users/overview)** — current release availability.
- 🛠️ **[For modders](/docs/modders/overview)** — the planned authoring direction.
- 🧩 **[For contributors](/docs/contributing/overview)** — architecture and source-release status.
- 🏺 **[Original Engine Reference](/reference)** — verified-only original-engine behavior.
- ✍️ **[Devblog](/devblog)** — the reverse-engineering → modernization journey.
