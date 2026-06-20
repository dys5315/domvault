---
title: Model the Funnel as a One-Way State Machine
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, state-machine, product, engineering, funnel]
galaxy: [product-growth, systems]
planet_id: planet_9d9feb83ce230320fd32768dd4a50b03513a277b
---

# Model the Funnel as a One-Way State Machine

> Modeling a lifecycle as states + allowed transitions (not flags) makes illegal states
> unrepresentable.

## The connection
"Gate N+1 is locked until gate N is approved" is not a set of independent booleans you AND together
at read time — it's sequential logic: a finite-state machine with an explicit enable line, the same
idea as a shift register where a bit only advances when the clock and enable both fire. Modeling a
lifecycle as states + allowed transitions makes illegal states unrepresentable. You can't be at gate
3 with gate 1 un-approved because no transition produces that state. A "void-on-edit re-locks
downstream gates" rule is exactly a state machine resetting on an input change — and when it's
enforced by ad-hoc booleans instead, that's the source of gate drift.

## Why it matters
Where a gated lifecycle *is* a product's integrity guarantee — approvals, signatures, sequenced
steps — booleans drift because nothing forbids the contradictory combination; a finite-state
machine forbids it structurally. This complements the rule that every gate emit an observable
event: the FSM's transition log *is* that event stream.

## So what
- Define the gate rail as an explicit state enum + a transition table (which states can move where,
  on which event). Reject any update that isn't a legal transition.
- Replace the cluster of `gateN_approved` booleans with a single `state` field; derive locks from
  state, never store them.
- Emit a transition event on every state change — that satisfies the observability rule for free.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

