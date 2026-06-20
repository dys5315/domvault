---
title: Dijkstra to the Money Node
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, algorithms, revenue, prioritization, gtm]
---

# Dijkstra to the Money Node

> The right build order is literally Dijkstra's shortest path from "idea" to the first-dollar node.
> The prettiest feature is usually a high-weight edge that doesn't lie on that path — so the
> algorithm skips it.

## The connection
The idea→revenue funnel is a weighted directed graph: nodes are funnel states (visitor, signup,
demo, approval, first dollar), edges are the build steps that connect them, and the weight on each
edge is the effort to ship it. The right build order is then literally Dijkstra's shortest path from
"idea" to the first-dollar node — relax edges by accumulated effort, always expand the cheapest
reachable state next, stop when you pop the money node. The prettiest feature is usually a
high-weight edge that doesn't lie on the shortest path to a real transaction, so Dijkstra skips it.

## Why it matters
This makes the missing-money-node audit *constructive*, not just diagnostic. That audit finds the
missing edge (the dead CTA, the placeholder, the unbound approval); Dijkstra tells you the cheapest
*order* to build the surviving edges so a real dollar can flow soonest. Non-negative weights hold
here — effort is never negative — so the algorithm is valid as-is.

## So what
- Sketch the funnel as a graph; weight each edge by honest build-effort (days), not excitement.
- Run the shortest path to the first-dollar node and build only those edges first; everything
  off-path is deferred by definition.
- Re-run after each ship: completed edges drop to weight 0, which can reroute the path —
  re-prioritize, don't assume the old order holds.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*
