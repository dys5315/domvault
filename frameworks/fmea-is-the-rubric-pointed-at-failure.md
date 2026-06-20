---
title: FMEA Is the Rubric Pointed at Failure
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, risk, rubric, fmea, detection]
galaxy: [ai-engineering]
planet_id: planet_cc38cf9fa84c18c16580aeab7c35aaf97d03b87e
---

# FMEA Is the Rubric Pointed at Failure

> Severity and Occurrence are obvious. **Detection** is the sharp, transferable axis: a
> high-severity failure you can't *see coming* is worse than one you can, because you lose the
> chance to intervene.

## The connection
FMEA's Risk Priority Number — RPN = Severity × Occurrence × Detection — is a rubric: a structured,
multi-axis score that forces you to rate each failure mode *before* it happens. Where one
discipline keeps reinventing the rubric to manufacture *trust*, manufacturing has had a mature
rubric for *failure* for decades. The sharp, transferable axis is **Detection**. Severity and
Occurrence are obvious; Detection encodes that a high-severity failure you can't *see coming* is
worse than one you can, because you lose the chance to intervene. That is exactly why a funnel gate
should emit an observable event — undetectable failure is unbounded failure.

## Why it matters
Kill-criteria are usually scored on impact and likelihood and stop there. Adding the Detection axis
closes the gap: a failure mode that's severe, likely, *and* invisible until too late should rank
above a severe one you'd catch the moment it starts. Wherever an error can surface long after it
occurred, Detection is the difference between a kill threshold that fires in time and one that fires
post-mortem.

## So what
- Score kill-criteria as Severity × Occurrence × Detection (RPN), borrowing the FMEA template
  directly.
- Add an explicit Detection column: "can we even see this failing, and how fast?" High RPN from low
  detectability should trigger instrumentation work, not just risk-acceptance.
- Tie Detection to observability: if a step can fail silently, that's a Detection score demanding an
  observable event before launch.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

