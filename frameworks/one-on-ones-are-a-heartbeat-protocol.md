---
title: "1:1s Are a Team's Heartbeat Protocol"
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, management, distributed-systems, observability, leadership]
galaxy: [leadership, systems]
planet_id: planet_f0e6e29f8a316ffc73d71bac19d35a5997077bdc
---

# 1:1s Are a Team's Heartbeat Protocol

> Liveness isn't a question you ask, it's a signal you monitor. Engagement is read from the cadence
> and texture of routine contact, not from asking "are you engaged?"

## The connection
A distributed system never asks a node "are you healthy?" — it watches for periodic heartbeats and
infers death from their *absence*. The only signal is silence. A timeout plus a missed-probe counter
(e.g., 3 strikes) declares the node dead and triggers failover. A recurring 1:1 is exactly this
liveness probe for a person: a scheduled, periodic check-in whose cadence is the heartbeat interval
and whose content (energy 1–5, "do you feel heard?", blockers, stress) is the payload.
Disengagement, like a dying node, rarely announces itself — it shows up as missed or hollow
check-ins. N skipped or flat 1:1s should fire the same alarm a missed heartbeat does: the node is
going dark, intervene *before* it fully fails.

## Why it matters
This reframes attrition from a surprise event into a monitorable failure mode with a leading
indicator. It converts the soft art of "knowing your people" into an observability problem: define
the heartbeat (1:1 cadence), the payload (a couple of tracked sentiment signals), and the alert
threshold (missed-probe counter). The expensive failure — someone quietly checking out and then
quitting — is precisely the one heartbeat monitoring is designed to catch early.

## So what
- Treat 1:1 cadence as a liveness SLA: a missed or perfunctory 1:1 is a missed probe, not a
  scheduling hiccup — log it.
- Track 2–3 lightweight payload signals each 1:1 (energy 1–5, "feel heard?" 1–5, open blockers); a
  downward trend over N probes = attrition-risk alert.
- A simple manager dashboard (cadence + sentiment + missed-probe counter) operationalizes this;
  build it before scaling headcount.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

