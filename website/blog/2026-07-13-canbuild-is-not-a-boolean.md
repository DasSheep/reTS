---
slug: canbuild-is-not-a-boolean
title: CanBuild Is Not a Boolean
date: 2026-07-13T10:27:44+07:00
authors: [rets-team]
tags: [devblog, production, rules, ai]
last_verified: 2026-07-15
---

“Can this house build this unit?” looks like a yes-or-no question. In Yuri's
Revenge, the answer is a three-state decision produced by an order-sensitive
control-flow graph.

Reconstructing that graph took a sequence of small, testable pieces. The final
composition is one of the clearest examples yet of why faithful behavior lives in
the route to an answer, not only in the answer itself.

{/* truncate */}

*Last verified against the project oracle: 2026-07-15.*

## Three answers, several routes

The engine distinguishes:

- buildable;
- unbuildable; and
- temporarily unbuildable, such as a currently reached positive build limit.

The full decision considers an explicit unbuildable flag, technology levels,
ownership and side restrictions, stolen-technology requirements, the skirmish
superweapon option, prerequisites, and per-type build limits. It also contains
shortcuts for special ownership cases.

Those checks are not a flat list. One ownership shortcut skips later technology
and prerequisite gates but still routes through the build-limit decision. By
contrast, once the decision reaches the prerequisite stage, the
non-human-controlled path returns buildable before the scan and final limit
check; earlier hard gates still apply. Moving either branch to a more “logical”
position changes game behavior.

## Testing the path, not just the result

Many rejection branches return the same numeric value. A test that checks only
“unbuildable” would still pass if two failures were accidentally reordered.

The reTS breakdown therefore records the stages that actually ran and the exact
terminal reason. The oracle cases deliberately combine multiple possible
failures to prove which one wins. They also pin shortcut-to-limit behavior and
the early non-human return.

## One version complete, differences kept honest

This composition is the complete Yuri's Revenge path. Red Alert 2 preserves the
broad shape but omits or changes several pieces. Tiberian Sun has a more
substantially different decision, including its own prerequisite vocabulary and
build-limit behavior.

Those versions will get complete composers of their own. reTS does not model an
older game by running the later path with a handful of fields switched off; that
would make the interface look finished before the behavior really is.
