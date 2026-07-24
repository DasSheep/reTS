---
slug: choosing-the-next-mission
title: How the Campaign Chooses What's Next
date: 2026-07-25T01:00:00+07:00
authors: [rets-team]
tags: [devblog, campaign, multi-game, faithful-port, verification]
last_verified: 2026-07-25
---

You finish a campaign mission. The screen fades, maybe a victory movie plays,
and then the game decides what you play next. Sometimes that's a single fixed
mission; sometimes it's a painted map room where you choose from branching
targets. How does the engine actually *make* that choice? Today was a pass over
exactly that — the machinery that turns "you won" into "here's the next map" —
and it came with a surprise that overturned an assumption we'd been carrying.

{/* truncate */}

*Last verified against the project oracle: 2026-07-25.*

## Three ways a win can go

When you win a campaign mission, the engine reads a handful of flags on the
scenario and takes one of a few paths. The campaign can simply end — silently,
or with a credits screen. It can hand you the interactive map room to pick your
next target. Or it can resolve the next mission automatically, with no screen at
all.

The order those flags are checked turns out to matter: one of them
short-circuits *before* another, and reading the two checks in the wrong order
inverts the whole meaning. This is the sort of detail intuition gets backwards,
so we read the raw instructions rather than trusting the plausible-looking
guess — the "end silently" flag wins, quietly skipping the screen the next flag
would have shown.

## The branch graph

The automatic path is the interesting one. Each side's campaign is a small graph
of *stages*. A stage knows the map it represents and carries a list of outgoing
options — edges to other stages. To advance, the engine takes a "next mission"
name, finds your current stage, and walks its options looking for one whose
target map matches that name. On a match, it writes the target's map name into
the field the loader reads and moves your position to that stage.

There's a sharp edge worth preserving: before it scans, the resolver blanks the
next-mission name. So if nothing matches, the name is left *empty* rather than
silently reusing whatever was there before. A naive reimplementation would skip
that reset and quietly carry the old value forward — a subtle divergence. We kept
the faithful behavior (and made it toggleable for anyone building on top who'd
rather it not).

That "next mission" name comes in two flavors — a primary and an alternate,
chosen by yet another flag. For a while we'd assumed those two fields were
vestigial: data the map editor round-tripped but the engine never actually read.
Reading the win path settled it. They're live. The alternate is a real branch
key the engine consults every time it resolves a mission automatically.

## The myth about the map room

Here's the part that surprised us. Going in, the working theory was that the
cinematic map room — choose-your-next-mission on a painted campaign map — was a
*Tiberian Sun* luxury, and that Red Alert 2 and Yuri's Revenge had trimmed it
down to a plain linear "just load the next map."

The binaries disagree. The same branch machinery — the same map room, the same
stage-and-option graph, the same primary-and-alternate keys in the same places —
is compiled into all three games. It isn't a Tiberian Sun feature the later
games removed; it's shared engine code all three inherited. What actually differs
is how much the *shipped campaigns* use it — how many missions author real
branches — and how lavish the presentation is, not whether the mechanism exists.

That distinction matters for a faithful reimplementation. It would have been easy
to write "Tiberian Sun branches, the others are linear" into the design and move
on. The bytes say the capability is universal; the linearity, where it exists, is
a *content* choice. So the reimplementation models one branch engine shared by
all three, and treats the presentation — the movie, the painted map, the
voiceover — as a separate layer sitting on top of it.

## Why it's worth the care

The resolver is a small piece of code, but it's exactly the kind that has to be
*exactly* right for campaigns to replay faithfully: the same win produces the
same next mission, every time, on every platform. Modeling it as a plain data
graph has a bonus — a modder can describe a branching campaign as data rather
than code, the same shape the engine already uses, just legible.

And getting here this week leaned on a quieter win. We taught our tooling to
recover the engine's own names for its parts, turning one of the three games from
a wall of anonymous functions into something you can read. It is a great deal
easier to say exactly what the machinery does when the machinery is finally
willing to tell you its names.
