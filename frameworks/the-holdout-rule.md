---
title: The Holdout Rule (Graded Systems Need Out-of-Sample)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, evaluation, rubric, overfitting, anti-gaming]
galaxy: [ai-engineering]
planet_id: planet_89fc9fdbd876d071c225990ec48f43a0e967c77c
---

# The Holdout Rule (Graded Systems Need Out-of-Sample)

> Anything that grades against a metric needs a holdout — an out-of-sample check the optimizer
> never saw. It's the difference between a score that *looks* rigorous and one that *is*.

## The connection
A quant strategy tuned until it aces its **backtest** and a document tuned until it aces a **scoring
rubric** suffer the identical failure: **optimizing the proxy until it stops predicting reality**
(overfitting / Goodhart's law — "when a measure becomes a target, it ceases to be a good measure").
Every graded product is exposed to this:
- An idea success-score could be gamed by phrasing ideas to score well without being better ideas.
- A compliance rubric could be satisfied by a packet tuned to pass while missing the real risk.
- A citation verifier could be satisfied by a document that's still misleading in aggregate.

## The rule
**Anything that grades against a metric needs a holdout — an out-of-sample check the optimizer never
saw.** In trading that's walk-forward / out-of-sample testing; in ML it's the test set; for any
graded product it means a second, independent signal the score can't be gamed against:
- Validate a sample of high-scoring outputs against *real outcomes*, not just re-scoring.
- Use an independent human review as the holdout the rubric is measured against — and periodically
  re-audit "passing" results for real deficiencies.
- Spot-check a random sample, and track real-world error escapes.

## So what
Add a "holdout / anti-gaming" section to any rubric spec: every graded product ships with (1) a
metric, and (2) an independent out-of-sample validation that catches when the metric is being gamed.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

