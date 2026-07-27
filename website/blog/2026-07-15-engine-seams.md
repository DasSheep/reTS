---
slug: engine-seams
title: From the Harvest Route to New Ways In
date: 2026-07-15T04:46:54+07:00
authors: [rets-team]
tags: [devblog, economy, harvesting, lua, mcp, documentation, tooling]
last_verified: 2026-07-16
---

Today connected several kinds of access to the engine. The harvesting work
exposed more of a classic gameplay route as small, explainable contracts. In
parallel, the project changed how creators, AI agents, and readers each reach
those contracts without weakening the faithful core.

{/* truncate */}

*Last verified against the project oracle, designs, and live site: 2026-07-16.*

## Following resources to the refinery door

Harvesting is a relay rather than one calculation: inspect a resource cell,
remove an amount, store it on a unit, locate and contact a refinery, unload, and
update the owning house. reTS can now execute and explain the numeric core of
that relay through the refinery-range decision.

The engine generations share concepts but not storage. Red Alert 2 and Yuri's
Revenge keep multiple floating-point resource amounts on a harvester. Tiberian
Sun uses integer storage and distinct unload, silo, and weed paths. The port
keeps these as versioned contracts because the differences affect rounding,
clamping, and when resources become credits.

For the later games, refinery distance also contains a policy choice. Ordinary
harvesters use `HarvesterTooFarDistance`; types marked as teleporters use
`ChronoHarvTooFarDistance`. Both accept equality and use the same three-
dimensional distance arithmetic, including the original table-based square-root
approximation and integer conversion. The inspection record explains which rule
was selected and how the final route was chosen.

Tiberian Sun follows a different branch: refinery radio candidates are scanned
before this point, and a separate fixed three-cell check is used later when
rebuilding a path. That divergence remains explicit. Full refinery search,
pathfinding integration, world consumers, and the rest of the harvest mission
are still open.

## A planned native creation surface

Lua is planned as an opt-in extension layer beside the original Trigger, Tag,
Event, Action, Team, and Script systems—not as their replacement. Bindings may
only grow over engine behavior that has already been recovered and verified.

The design treats determinism as part of the interface. Simulation-facing
scripts receive controlled engine time and randomness, use typed numeric
boundaries, carry content hashes, and run within per-tick limits. With no Lua
loaded, the faithful vanilla path remains the reference.

This is roadmap and architecture work today, not a shipped Lua runtime. Mission
logic, custom modes, AI, abilities, persistence, UI, and audio hooks remain
planned tiers gated by their engine dependencies.

## A front door that no longer grows with the engine

Every previously reversed system had earned its own top-level tool in the MCP
server that AI agents use to query and run the engine's verified logic. That
rule scaled fine when there were a handful of systems. It stops working as
coverage grows: each addition is another schema every connecting client has to
load and pay context for, whether or not that session ever touches the
system, and the AI-facing surface would keep growing in lockstep with the very
engine coverage the project is trying to increase. A snapshot of the server
this week, with the faithful engine still early in its build-out, already
showed several dozen advertised tools compiling into a discovery listing large
enough to crowd a meaningful share of a working context window before an
agent had asked a single question.

The fix does not touch the engine itself. Every verified operation still
exists as the same faithful Rust, producing the same structured breakdown of
how it reached its answer. What changed is how an agent finds and calls them.
The default surface is now a small, fixed gateway: search a compact catalog
for the capability you need, load that one capability's full schema and
documentation only once you have picked it, then call it with validated
arguments. The high-frequency check against the project's binary-derived
oracle suite stays directly callable on its own, since it is used constantly
and costs little to keep advertised. Everything else — economy, presentation,
rules, and every future reversed system — moved into an internal registry
that the gateway searches on demand instead of announcing up front. Roughly
sixty existing operations made that move in one pass, and every one of them
remains reachable through the same three-step search-describe-run path.

The practical effect is a startup listing that stopped tracking engine
completeness. Discovering a capability now costs an agent a search and one
schema load instead of a share of everything the project has ever reversed,
and the project checks that boundary automatically rather than promising to
remember it by hand.

## A public explanation surface

The public website and devblog now live in a repository separate from the
project's private working evidence. Public pages are written fresh for their
audience instead of being copied from internal research notes. A blocking
leakage scan checks the output, and factual claims are reviewed against the same
evidence that supports the implementation.

The site, blog, and Engine Reference scaffold are live. The leakage scanner,
structural accuracy checks, and prepublication orchestrator are operational.
Technical meaning still receives a recorded agent claim audit: structural checks
cannot decide whether public prose has drifted from the recovered behavior. The
cross-repository commit and push also remain explicit rather than automatic.

The engine remains the center of all four stories. The harvest route is a
faithful gameplay surface, Lua is a future creation surface over verified
behavior, the gateway is how machines reach that same verified behavior
today, and the knowledge base is the explanation surface beside all of it.
