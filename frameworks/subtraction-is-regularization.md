---
title: Subtraction Is Regularization (Fewer Parameters Generalize Better)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ml, product, simplicity, regularization]
galaxy: [ai-engineering, product-growth, systems]
planet_id: planet_15aa12ceb45d8233975db2b9fa14b5af08807fa4
---

# Subtraction Is Regularization (Fewer Parameters Generalize Better)

> Subtracting a feature or a commitment is regularization: fewer moving parts, lower variance
> (fragility), better generalization to the futures you didn't plan for.

## The connection
A model's complexity is its parameter count; past the sweet spot, each extra parameter buys lower
bias but rising variance — it fits noise and generalizes worse. Regularization deliberately
*removes* effective parameters (L1 zeros weights, dropout deletes units, pruning cuts trees) to
slide back down the variance side of the U-curve. Human systems make the same mistake in reverse:
we instinctively *add* features, commitments, and process, almost never subtract — so products,
schedules, and orgs accrete "parameters" until they overfit their original context and turn
fragile. Cutting one is regularization — as long as you don't cut so far you raise bias (drop the
actual need).

## Why it matters
Feature and process creep is the default failure mode of most systems, and addition is the
instinct. Framing subtraction as regularization gives it a precise stopping rule from a trusted
domain — the bias-variance curve — instead of a vague "keep it simple."

## So what
- Add a **subtract pass** to every product / roadmap review: name what to remove to lower variance
  (fragility, surface area, maintenance) *without* raising bias (missing the core need). The cut
  is justified when it trims a parameter the system was overfitting on.
- Watch the same U-curve in commitments and process: more rituals = lower bias on edge cases but
  higher variance (overhead, brittleness). Tune to the sweet spot, don't maximize coverage.
- Treat "what would we delete?" as the regularization knob λ — turn it up when the system feels
  brittle, down when it's missing real cases.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

