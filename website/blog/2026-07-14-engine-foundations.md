---
slug: engine-foundations
title: Three Foundations in One Day
date: 2026-07-14T22:50:13+07:00
authors: [rets-team]
tags: [devblog, production, rules, roadmap, versions]
last_verified: 2026-07-16
---

July 14 produced three connected foundations: a verified factory heartbeat, an
executable rules-loading cascade, and a clearer boundary between faithful engine
work and everything that can be built above it.

{/* truncate */}

*Last verified against the project oracle, design, and tracker: 2026-07-16.*

## A factory advances in 54 steps

Classic factory production divides a build into exactly 54 progress steps. Cost
is not split into 54 identical payments. Each debit is calculated from the
remaining balance and remaining steps, carrying integer remainders forward so
the final result still equals the advertised cost.

Ordering matters. When a production timer expires, progress advances before the
next debit is calculated. If the house cannot pay, progress rolls back one step,
but the timer has already restarted. The final transition consumes the exact
balance left.

That shared heartbeat sits inside version-specific timing and power behavior.
The later games share the full spend state machine; Tiberian Sun does not write
the same automatic out-of-money hold state. Multiple-factory and low-power
arithmetic also differ, so reTS selects the matching versioned path and exposes
the intermediates rather than presenting one blended formula.

This is the numeric core, not the entire production experience. Sidebar queues,
placement, delivery, and wider object lifecycle work remain open.

## Rules arrive as a cascade

The engine does not load one definitive rules file. It repeatedly applies layers
to the same objects. A present key replaces the current value; an absent key
leaves the earlier value intact.

Red Alert 2 and Yuri's Revenge apply base rules, language rules, an eligible
session layer, and then the map. Tiberian Sun and Firestorm use a different
middle sequence, with expansion rules and expansion-language data controlled by
separate conditions before the map has the final opportunity to override keys.

This repeated overlay can resemble section inheritance from the outside, but
the verified Yuri's Revenge reader is re-reading sections across files rather
than following parent sections. The current model covers four representative
fields over caller-resolved layers; file discovery, ART and AI families, and the
full type surface remain future work.

## More ambition, separate ledgers

The roadmap now names four distinct layers. The faithful engine remains the
foundation and the compatibility oracle. Parameterization may turn a verified
hard limit into configuration while retaining the original value as the
default. Modernization covers opt-in code, assets, presentation, and modding.
Tooling covers editors, converters, workbenches, and inspection surfaces that
consume the engine.

Each layer has its own progress accounting. A useful tool or ambitious design
does not increase the faithful-engine completion figure; only recovered and
verified engine behavior does. That separation lets the project grow without
making its central accuracy claim easier.
