---
slug: damage-is-a-pipeline
title: Damage Is a Pipeline
date: 2026-07-07T15:59:33+07:00
authors: [rets-team]
tags: [devblog, combat, verification]
last_verified: 2026-07-15
---

The first end-to-end piece of reTS was not a menu or a moving unit. It was a
number: the exact amount of health removed when one object hits another.

That sounds modest. It turned out to be the right foundation for the whole
project, because the original engine does not calculate damage in one neat
formula. It passes the value through a sequence of rules, and the integer result
can change if even two apparently equivalent stages are swapped.

{/* truncate */}

*Last verified against the project oracle: 2026-07-15.*

## Why order matters

The current verified path begins on the firing side, where weapon damage is
adjusted by house, unit, and veterancy effects. The target then applies its armor
modifiers. After that, the warhead handles distance falloff, its armor-versus
table, and the global damage ceiling. Only then is the result applied to health.

Several of those stages truncate a fractional result toward zero. Multiplication
is normally commutative on paper; multiplication with an integer conversion
between stages is not. reTS therefore keeps the stages separate instead of
collapsing them into an elegant but inaccurate expression.

The health application has its own details. Crossing half health and crossing
the configurable red-health threshold are distinct events. Lethal damage is
capped to the health that remained. Those transitions matter to triggers and
presentation, not only to the final hit-point counter.

## Healing takes a different road

Negative damage is treated as healing, but it does not simply run the normal
pipeline backward. The original takes a special short-range path that skips
normal distance falloff and the armor-versus table, then clamps the restored
health to the unit type's maximum.

It is exactly the kind of rule a clean rewrite might “simplify” and quietly get
wrong. In reTS it is explicit, tested, and visible in the result breakdown.

## More than a final number

Every damage query can return the intermediate stages that produced its answer.
The same functions are exercised by hand-derived examples, and the inspection
surface is exposed to tools as well as normal code. That pattern—calculate,
explain, and verify—became the template for every system that followed.

This first vertical is currently anchored to Yuri's Revenge behavior. The
cross-version comparison for Tiberian Sun and Red Alert 2 remains separate work;
the post does not assume that similar-looking combat rules are identical.
