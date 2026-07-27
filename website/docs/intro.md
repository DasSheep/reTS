---
sidebar_position: 1
slug: /intro
last_verified: 2026-07-21
---

# Introduction

**reTS** is an in-development clean-room project to build a faithful,
standalone, moddable reimplementation of the Westwood isometric RTS engine behind
the **Command & Conquer** titles **Tiberian Sun**, **Red Alert 2**, and
**Yuri's Revenge**.

*Last verified against the project charter and release state: 2026-07-21.*

:::caution Current availability
The documentation site is public. The engine source, binaries, playable client,
and native modding tools are not publicly released yet.
:::

## What exists today

- A headless, deterministic simulation core: engine systems are reverse-engineered
  from the retail binaries, ported, and pinned by binary-derived oracle tests
  before anything is considered done.
- The verified slice of that work is published as it completes in the
  [Original Engine Reference](/reference), which now spans combat, data/rules
  interpretation, presentation and UI, and multiplayer synchronization systems.
- The [Devblog](/devblog) narrates the reverse-engineering and build work as it
  happens, system by system.
- None of this adds up to a playable game yet — there is no public client,
  engine source release, binaries, or modding tools. See
  [For players](/docs/users/overview) for exact availability.

## What makes reTS different

- **Accuracy is the bar.** Implemented systems are matched to recovered behavior
  and pinned by oracle tests so they cannot silently drift.
- **Standalone and clean-room is the destination.** The future release will run
  without original executable code and will ship no game assets; the standalone
  client is not complete today.
- **Multi-version by proof.** Confirmed differences are modelled rather than
  averaged away. Unverified versions remain explicitly pending.
- **Modern layers come after fidelity.** Tooling, configurable limits, modern
  presentation, and native scripting are additive roadmap layers. They are not
  presented as shipped features before their underlying engine systems land.

## Who this site is for

| Track | You are… | Start here |
|---|---|---|
| **Players** | Someone who wants to run and play reTS | [For players](/docs/users/overview) |
| **Modders** | A map/mission/game-mode/content author | [For modders](/docs/modders/overview) |
| **Contributors** | A developer who wants to build on reTS | [For contributors](/docs/contributing/overview) |
| **Engine researchers** | Someone looking for verified original-engine behavior | [Original Engine Reference](/reference) |
| **Project followers** | Someone following milestones and design decisions | [Devblog](/devblog) |

Each stream publishes only what its audience can use now. Player, modder, and
contributor guides expand when the corresponding capability ships; the Engine
Reference accepts only completed, verified systems; the Devblog records the
journey as it happens.
