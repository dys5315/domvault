---
title: Agent Memory Is a Kalman Filter
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ai-engineering, agents, memory, estimation]
galaxy: [ai-engineering]
planet_id: planet_d58bccabb04040d1b1f0b2e035f1620a90b9fc6f
---

# Agent Memory Is a Kalman Filter

> Both maintain a belief about a hidden state from a stream of noisy inputs, and both do it the
> same way: **predict, then correct, weighting new evidence by how much you trust it.**

## The connection
The Kalman filter projects its prior estimate forward, observes, and folds in the measurement
scaled by the Kalman gain $K = \sigma^2_{model}/(\sigma^2_{model}+\sigma^2_{measurement})$ — trust
the model when it's certain, trust the observation when it's certain. An agent's memory is the same
loop in disguise: the prior is everything it already knows about the user and task; each turn
delivers a noisy observation; the "best practices" of good memory — *store only useful info,
dedupe, weight by relevance, keep it updated* — are an informal Kalman gain. A high gain overwrites
the prior with fresh context; a low gain ignores noise and keeps the stable belief. The covariance
the filter tracks is exactly the agent's (usually missing) sense of *how confident it is* in each
stored fact.

## Why it matters
Most agent memory is append-and-retrieve — open-loop. Reframing it as predict→correct gives a
principled rule for the hard parts: when a new note contradicts an old one, the right move isn't
"keep both" but a gain-weighted update toward the more trustworthy source. It also gives a place to
put confidence: store a freshness/reliability weight alongside each fact, decay it over time
(process noise $Q$), and raise the bar for low-confidence memories to override high-confidence
ones.

## So what
- Add an explicit trust weight to memory writes: new context vs. prior, not blind append. Decay
  stale facts; let contradictions trigger a weighted update.
- Track per-fact confidence (the covariance analog) so retrieval can prefer well-supported
  memories.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*




