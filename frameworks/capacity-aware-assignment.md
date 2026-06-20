---
title: Capacity-Aware Assignment (Round-Robin Is Naïve Staffing)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, operations, load-balancing, staffing, systems]
galaxy: [leadership, systems]
planet_id: planet_178614c495ce3b39a3bfe4136488e7a85d5485a4
---

# Capacity-Aware Assignment (Round-Robin Is Naïve Staffing)

> Round-robin only works when every server has identical capacity. The instant capacity is uneven,
> even distribution melts the weakest node while the strongest sits idle.

## The connection
Round-robin load balancing (turn 1 → 2 → 3) and "equal men-days" staffing are the *same* algorithm,
and they share the *same* failure. The men-days identity `M·D·H / W = constant` only holds when
every worker has identical throughput. Round-robin only works when every server has identical
capacity. The instant capacity is uneven — a fast server, a senior worker, a specialist who clears
3× the load — both distribute work evenly and **melt the weakest node while the strongest sits
idle**. The production fix in distributed systems is *weighted least-connections*: route to whoever
has the most free capacity, weighted by their rated throughput. That is also the correct staffing
rule.

## Why it matters
A naïve dispatcher that round-robins work across agents (human or machine) will queue everything
behind the slowest worker and create the equivalent of a 503: aged work, blown deadlines, dropped
tasks. The right primitive is a weighted-least-connections dispatcher — rate each agent's effective
throughput and route the next task to max free weighted capacity. The men-days math tells you the
*aggregate* budget; load balancing tells you *who gets the next unit*.

## So what
- Spec any task dispatcher as weighted least-connections, not round-robin: per-agent throughput
  weight × current queue depth.
- Instrument utilization per worker; a node pinned at 100% while others idle is the signal you're
  round-robining.
- Reuse the same rule for human team allocation — assign by free capacity, never equal splits.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*


