---
title: Tesla-Valve the Workflow (Irreversibility by Construction)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, engineering, workflow, event-sourcing, state]
galaxy: [systems]
planet_id: planet_a1e2add50f4969024fbe6258b84f622d902e41c4
---

# Tesla-Valve the Workflow (Irreversibility by Construction)

> Irreversibility-by-construction beats irreversibility-by-policy the same way the Tesla valve
> beats a check valve with a spring: no part to fail.

## The connection
A Tesla valve enforces flow direction with **geometry alone** — fluid passes freely one way; the
reverse direction routes itself into opposing loops and chokes. A rectifier diode does the same for
current. Neither has a moving part, a setting, or a policy: directionality is a property of the
structure, so there is nothing to misconfigure, override, or wear out.

That is exactly the property an approval or funnel gate wants. The drift failure is a gate that
*can* flow backward — an approved stage that gets silently un-approved because state lives in a
mutable flag someone (or some retry, or some race) can flip back. The fix isn't a stricter policy
guarding the flag; it's making backward flow **structurally impossible**: model the gate as a
ratchet over an append-only event log, where state can only advance because "approved" is an
emitted, immutable event, not a field.

## Why it matters
An event log isn't just for analytics — it's what makes a conversion path a Tesla valve: once the
"signed" or "paid" event is written, the workflow physically cannot regress to unsigned. Where a
process's gate transitions are the thing that must be trusted and quotable later, modeling gates as
append-only ratchets means the audit trail and the irreversibility are the same artifact.

## So what
- Build approval and funnel gates as append-only events (state advances by emitting), never as
  mutable boolean flags.
- Test the reverse direction explicitly: there should be no code path that un-approves a gate —
  only a new compensating forward event.
- Reuse the rule anywhere order matters: any workflow whose sequence must hold gets "Tesla-valved" —
  directionality from structure, not from discipline.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*




