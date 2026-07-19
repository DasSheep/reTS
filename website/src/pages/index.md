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

**≈18%** of the way to a fully-playable, faithful Red Alert 2 / Yuri's Revenge engine, end to end *(excludes mod-compatibility scope)*.

<progress className="tracker tracker-overall" value="18" max="100" />

| Area | | Done |
|------|---|----:|
| Foundations & harness | <progress className="tracker" value="85" max="100" /> | 85% |
| Primitives (math / RNG / coords / time) | <progress className="tracker" value="90" max="100" /> | 90% |
| Data & rules interpretation (INI / inheritance) | <progress className="tracker" value="34" max="100" /> | 34% |
| Asset formats (MIX / SHP / VXL / TMP / PAL / CSF / maps) | <progress className="tracker" value="23" max="100" /> | 23% |
| Object model & world grid | <progress className="tracker" value="24" max="100" /> | 24% |
| Movement & locomotion | <progress className="tracker" value="27" max="100" /> | 27% |
| Combat (weapons / projectiles / targeting / veterancy) | <progress className="tracker" value="40" max="100" /> | 40% |
| Unit & building sim (production / power / deploy / SW) | <progress className="tracker" value="17" max="100" /> | 17% |
| Economy (harvest / refine / tech tree) | <progress className="tracker" value="11" max="100" /> | 11% |
| House & skirmish AI (build order / teams / triggers) | <progress className="tracker" value="5" max="100" /> | 5% |
| Campaign / scenario (triggers / tags / objectives) | <progress className="tracker" value="13" max="100" /> | 13% |
| Presentation / rendering (iso / SHP / VXL / shroud) | <progress className="tracker" value="4" max="100" /> | 4% |
| Audio (SFX / EVA / music) | <progress className="tracker" value="12" max="100" /> | 12% |
| Shell / UI (menus / sidebar / build queue) | <progress className="tracker" value="3" max="100" /> | 3% |
| Multiplayer / netcode (lobby / lockstep / replay) | <progress className="tracker" value="2" max="100" /> | 2% |
| Save-load & game loop | <progress className="tracker" value="14" max="100" /> | 14% |

**Layered scope** — additive, opt-in on the faithful core *(not counted in the engine % above)*.

| Dimension | | Progress |
|-----------|---|----:|
| Tooling (workbench / map editor / viz / converters) | <progress className="tracker" value="7" max="100" /> | 7% |
| Parameterization (de-hardcoded reversed limits) | <progress className="tracker" value="0" max="100" /> | 0% |
| Modernization (code / assets / presentation / modding) | <progress className="tracker" value="1" max="100" /> | 1% |

<sub>A deliberately **conservative**, best-judgment estimate — only behavior that is fully recovered from the original engine, reimplemented, and verified against it counts; scaffolding, partial traces, and work-in-progress do not. It is an at-a-glance gauge, not an objective measure and not a schedule. Last updated: 2026-07-19.</sub>
<!-- progress:end -->

## Explore

- 📖 **[Introduction](/docs/intro)** — what reTS is and how it's built.
- 🎮 **[For players](/docs/users/overview)** — current release availability.
- 🛠️ **[For modders](/docs/modders/overview)** — the planned authoring direction.
- 🧩 **[For contributors](/docs/contributing/overview)** — architecture and source-release status.
- 🏺 **[Original Engine Reference](/reference)** — verified-only original-engine behavior.
- ✍️ **[Devblog](/devblog)** — the reverse-engineering → modernization journey.
