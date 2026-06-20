---
title: "Production AI Is 10% Model, 90% Plumbing"
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ai-engineering, agents, mlops, production]
galaxy: [ai-engineering]
planet_id: planet_5457aa332138bf7b2ccc745b9070070729469a67
---

# Production AI Is 10% Model, 90% Plumbing

> Shipping AI is mostly engineering around the model, not the model itself. When evaluating a new
> AI feature, ask "where's the 90%?" first.

## The connection
Several independent sources argue the same thesis from different angles. Stitched together, they
form a single mental model of what it takes to put an AI system into production:

1. **The model is a commodity (the 10%).** Frontier APIs and fine-tuning are table stakes.
   Differentiation lives elsewhere.
2. **Plumbing = the 90%.** Retrieval and context, orchestration, tooling, deployment,
   observability, evals, security — these are the layers that actually decide whether the system
   works.
3. **Know what's under the hood.** Understanding what happens on an API call and how a model
   generates text keeps the abstraction honest.
4. **Agents are where it breaks.** Most failures are operational, not model quality — the silent
   killers of agents in production are infrastructure and control problems.
5. **System design tests exactly this.** AI system-design questions reward the plumbing mindset,
   not prompt cleverness.

## Why it matters
This is the backbone for anything built on agents. The model choice is the smallest decision; the
retrieval, evaluation, guardrails, and observability around it are where the work — and the
differentiation — actually lives.

## So what
- When evaluating a new AI feature, ask "where's the 90%?" before arguing about which model to use.
- Budget engineering time for evals, retries, guardrails, and observability up front, not as an
  afterthought.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*


