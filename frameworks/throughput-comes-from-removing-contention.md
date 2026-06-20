---
title: "Throughput Comes From Removing Contention, Not From Tidiness"
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, systems, operations, concurrency, throughput]
galaxy: [systems, leadership]
planet_id: planet_d2d9c6f89f29447138c9f076e5374978e4d7fbec
---

# Throughput Comes From Removing Contention, Not From Tidiness

> A "tidy"-looking ordering optimizes for legibility, not throughput. Throughput is set by the
> *contended resource*.

## The connection
Back-to-front airplane boarding is the slowest method for the exact reason naive multithreading is
slow: everyone contends for one shared resource (the aisle and overhead bin) at the same time, so
the work *serializes* even though many people could be acting at once. That's concurrency without
parallelism — lots of "active" agents, one core. The fast boarding methods are **lock-free
parallelism**: order passengers so adjacent ones never touch the same resource simultaneously,
maximizing how many bags get stowed in parallel. The deep point: a tidy-looking ordering (strict
back-to-front) optimizes for legibility, not throughput. Throughput is set by the *contended
resource* — keep it busy with non-conflicting work and you go fast; pile everyone onto it at once
and ordering barely matters.

## Why it matters
This is one rule spanning cabins, cores, pipelines, and teams — practical anywhere a queue feels
slow despite "being organized."

## So what
- To speed any pipeline, don't sort it neatly — **identify the contended resource and schedule to
  keep it busy with non-conflicting work**. Tidiness is a red herring; contention is the
  constraint.
- Software: prefer lock-free / sharded designs where threads touch disjoint data over a single big
  lock everyone queues on. CI: parallelize jobs that don't share a runner/artifact rather than
  ordering them prettily.
- Teams and ops: batch and interleave work so people aren't all blocked on the same shared step
  (one reviewer, one system, one inbox). Find the single shared step and either shard it or stagger
  arrivals — controlled interleaving beats orderly queuing.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

