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

**≈20%** of the way to a fully-playable, faithful Red Alert 2 / Yuri's Revenge engine, end to end *(excludes mod-compatibility scope)*.

<progress className="tracker tracker-overall" value="20" max="100" />

| Area | | Done |
|------|---|----:|
| Foundations & harness | <progress className="tracker" value="85" max="100" /> | 85% |
| Primitives (math / RNG / coords / time) | <progress className="tracker" value="94" max="100" /> | 94% |
| Data & rules interpretation (INI / inheritance) | <progress className="tracker" value="34" max="100" /> | 34% |
| Asset formats (MIX / SHP / VXL / TMP / PAL / CSF / maps) | <progress className="tracker" value="23" max="100" /> | 23% |
| Object model & world grid | <progress className="tracker" value="30" max="100" /> | 30% |
| Movement & locomotion | <progress className="tracker" value="30" max="100" /> | 30% |
| Combat (weapons / projectiles / targeting / veterancy) | <progress className="tracker" value="40" max="100" /> | 40% |
| Unit & building sim (production / power / deploy / SW) | <progress className="tracker" value="18" max="100" /> | 18% |
| Economy (harvest / refine / tech tree) | <progress className="tracker" value="12" max="100" /> | 12% |
| House & skirmish AI (build order / teams / triggers) | <progress className="tracker" value="14" max="100" /> | 14% |
| Campaign / scenario (triggers / tags / objectives) | <progress className="tracker" value="13" max="100" /> | 13% |
| Presentation / rendering (iso / SHP / VXL / shroud) | <progress className="tracker" value="4" max="100" /> | 4% |
| Audio (SFX / EVA / music) | <progress className="tracker" value="12" max="100" /> | 12% |
| Shell / UI (menus / sidebar / build queue) | <progress className="tracker" value="3" max="100" /> | 3% |
| Multiplayer / netcode (lobby / lockstep / replay) | <progress className="tracker" value="2" max="100" /> | 2% |
| Save-load & game loop | <progress className="tracker" value="18" max="100" /> | 18% |

**Layered scope** — additive, opt-in on the faithful core *(not counted in the engine % above)*.

| Dimension | | Progress |
|-----------|---|----:|
| Tooling (workbench / map editor / viz / converters) | <progress className="tracker" value="7" max="100" /> | 7% |
| Parameterization (de-hardcoded reversed limits) | <progress className="tracker" value="0" max="100" /> | 0% |
| Modernization (code / assets / presentation / modding) | <progress className="tracker" value="1" max="100" /> | 1% |

<sub>A deliberately **conservative**, best-judgment estimate — only behavior that is fully recovered from the original engine, reimplemented, and verified against it counts; scaffolding, partial traces, and work-in-progress do not. It is an at-a-glance gauge, not an objective measure and not a schedule. Last updated: 2026-07-21.</sub>
<!-- progress:end -->

<!-- re-coverage:start -->
<!-- Generated from the project's function-coverage metric - do not hand-edit this block. -->

**Empirical function coverage.** Of the **9,539 functions** in the original engine binary, **1,258** have been located and identified in the reverse-engineering record, **301** are analyzed in depth, and **579** are reflected in verified reimplementation code.

Filtering out compiler runtime and trivial accessor glue — which get absorbed by data-structure modeling rather than reversed function-by-function — leaves **3,345 substantive functions** that the work actually has to conquer. Of those, **610 (18%) are located** and **280 (8%) are reflected in verified reimplementation code**. Counted directly from the analysis record — a complement to the judgment-based estimate above (a function is one tally whether it is three instructions or seven hundred).
<!-- re-coverage:end -->

## Explore

- 📖 **[Introduction](/docs/intro)** — what reTS is and how it's built.
- 🎮 **[For players](/docs/users/overview)** — current release availability.
- 🛠️ **[For modders](/docs/modders/overview)** — the planned authoring direction.
- 🧩 **[For contributors](/docs/contributing/overview)** — architecture and source-release status.
- 🏺 **[Original Engine Reference](/reference)** — verified-only original-engine behavior.
- ✍️ **[Devblog](/devblog)** — the reverse-engineering → modernization journey.
