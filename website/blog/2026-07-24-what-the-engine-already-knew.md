---
slug: what-the-engine-already-knew
title: What the Engine Already Knew
date: 2026-07-24T22:00:00+07:00
authors: [rets-team]
tags: [devblog, faithful-port, ai, campaign, multi-game, verification]
last_verified: 2026-07-24
---

A lot of what a twenty-five-year-old game "does" lives in community memory as
much as in the executable — house rules, remembered quirks, features everyone is
sure were mods. Spend a day reading the binary of that game and a pattern
emerges: the engine already knew. The rule you half-remember is there, usually
more precise and stranger than the memory of it. Today was seven passes over the
selection, command, alliance, AI, spectator, and campaign-scripting layers, and
the throughline was the same each time — the machinery was already present, and
our job was to state exactly what it does rather than what we assumed.

{/* truncate */}

*Last verified against the project oracle: 2026-07-24.*

## The cursor already knows what you mean

Two of the day's passes were about the moment a pointer position becomes an
*intention*. The first: when you drag a selection box over a mixed group and one
unit becomes the "primary" — the one the command cursor and voice lines answer
to — which unit wins? The intuitive guess is "the one you own" or "the first one
clicked." The binary says neither. The tie-breaker is whether a unit's *type*
has a usable primary weapon. An armed unit leads a mixed box; unarmed units just
come along. It is the classic behavior every player has felt and few could state,
and the field it reads is not a house flag at all but a computed property of the
unit type — an identity we pinned four independent ways before letting the name
stand.

The second pass reversed the function that decides, as you sweep the pointer
across the map, which action the cursor is offering — attack, move, sell, repair,
place a beacon, plan a waypoint. This is the exact seam a standalone engine needs
to get right, because it is where input stops being a mouse and becomes an
abstract command — the same seam a touch or gamepad control scheme has to drive
without a mouse existing at all. The surprise was structural: a value we had
pencilled in as an exotic "mode" flag is simply *how many units are selected*.
That reframes the whole thing. With units selected, the cursor is decided by the
selected unit itself; only on an *empty* selection does the engine fall through to
the sticky command modes. A whole ladder of behavior collapses into one early
branch — and the fall-through even still emits one action code the community
headers literally name after a Tiberian-Sun-era bug, a fossil the retail build
never tidied away. We preserved it rather than fixing it; faithful means faithful.

## The opponent's real rules, and the ones it doesn't have

Three passes went at the computer opponent, and each replaced a piece of folklore
with a smaller, sharper fact.

Alliances first. The whole system is a single row of bits living in the *asking*
player's memory — which is why the relationship is one-directional under the
hood. Forming an alliance sets only your own bit toward the other side; breaking
one tears down both directions at once. Buried in the "can I ally this player"
check was a rule intuition gets backwards: you may not form an alliance that would
leave you allied to *everyone*. You cannot ally your last enemy — and, as a
corollary, in a one-on-one you cannot ally at all. Our first oracle test caught
this the honest way: it tried to ally in a two-player world and the port correctly
refused. An adversarial re-read then turned up a genuine defect — the alliance
break clears a secondary mask with an idiom that wipes the whole thing instead of
one bit — and the three-engine reconcile found that same defect sitting
byte-identically in all three games. Not a late regression; an inherited flaw
that shipped in every version.

Then the difficulty ladder — the little block of numbers that decides which
things the AI is *allowed* to do on its own: fire a superweapon, build a base,
crush infantry, scatter from grenades. Each behavior unlocks when the house's
difficulty rating clears that behavior's rung. The catch a naive rebuild gets
wrong: ask for a rating *above* the maximum and the engine does not clamp it to
the top — it resets it to nearly the lowest setting. Write the value expecting a
genius and you get a near-idiot. And one rung in the list is read by nothing at
all — a dead rule, faithfully dead in all three engines.

The third AI pass was a sweep of the "cheats" — the structural advantages the
engine grants a computer house that a human never gets. The reconcile came back
with thirty-seven genuine ones and, just as usefully, four popular "cheats" the
binary does not actually gate to the AI. The flagship correction was vision. The
folklore says the AI sees through the fog of war. The bytes say something
stranger: there is no fog *for* the AI to see through. Shroud and discovery exist
only for the one local viewing player; there is nowhere to store a per-house fog
even in principle. The AI isn't defeating a visibility check — no such check was
ever placed on its path, while the human's identical scan is gated to skip what it
hasn't scouted. The most iconic advantage — the coalition that force-allies every
computer house against the humans in one sweep — now ships as a toggle you can
switch off, so the AI has to build its alliances one relationship at a time, like
a person.

## Machinery that was always there

The last two passes were the purest archaeology. Spectator mode has been treated
as mod territory for twenty years; the retail game ships it — a dedicated
observer slot, a spectator sidebar that draws a roster instead of a build queue,
an elapsed-game clock where the credits counter goes, and a scoreboard that
quietly excludes the watching player. The compiler even left the original
observer source filename sitting in the string table. The mechanism decomposed
into three *different* "is this an observer" tests that the community patch layer
usually flattens into one — and keeping them apart mattered, because two of the
flattened claims tested false against the retail image. The end-of-match
scorecard that tools scrape is *computed* by the retail build and then handed to a
logging function whose body is empty — the release compiled the logging out, so
those famous stats lines only exist because patches re-enable the sink. Present
in one sibling engine, provably absent in the older one: the observer is a later
addition, and we said so with a search thorough enough to earn the word "absent"
rather than "not found."

The final pass reversed the store behind every campaign that ever *remembered*
something — the named 0/1 flags a mission's triggers set and test to branch the
story. Two little arrays on the scenario: a set of *global* flags that persist
across a whole campaign, and a larger set of *local* flags that reset every map.
Three earlier studies had each touched a corner of this from their own side — the
trigger that writes a flag, the trigger that reads one, the loader that first
parses them — but nobody had built the thing they all operate on. Consolidating it
turned up how persistence actually splits. The flags are not in the save file at
all. Local flags round-trip only within one map's own text. And the global flags
— the ones that survive from mission two into mission five — persist by an
*explicit* hand-off: a routine at the win/lose boundary bulk-copies all of them
into the next mission before it pays out carryover money and starts the clock.
They persist because something deliberately carries them, not by accident. The
reconcile pinned one clean divergence — two of the three engines cap the local
flags at fifty; the last doubled them — and we captured a faithful sharp edge
along the way: an unguarded name copy that a pathological map could overflow,
documented as a quirk rather than silently hardened.

## The method under all of it

Seven passes, one discipline. The disassembly is the only oracle; community lore,
reference headers, and even our own earlier notes are corroboration that has to
survive an adversarial re-read whose only job is to *disprove* the claim. Every
finding is reconciled across all three engines, because a behavior that is
identical in three binaries is a shared-source fact and a behavior that differs is
a documented divergence — and today's differences were small and precise: an
inherited alliance defect, a doubled flag array, an observer feature that arrived
one engine later. The parts of a game that live in memory are worth checking
against the parts that live in the executable. Most of the time, the engine
already knew.
