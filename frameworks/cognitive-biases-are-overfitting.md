---
title: Cognitive Biases Are Overfitting (Debiasing Is Regularization)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ml, decision-making, bias, regularization]
galaxy: [ai-engineering, leadership, systems]
planet_id: planet_fdb9ed876f21b3394ae93ae020d2694e0f2c5270
---

# Cognitive Biases Are Overfitting (Debiasing Is Regularization)

> Most cognitive biases are the mind overfitting to a small, vivid sample: low "training
> error" (it feels obviously right from where you stand), high "test error" (it's wrong about
> the world), and a refusal to check the gap. That gap *is* high variance.

## The connection
A model overfits when it has too much capacity and too little data: it fits the *noise* in a
small training sample, scores beautifully on what it has seen, and fails on anything new. The
signature is high variance — a large gap between training error and out-of-sample error.

A human mind does the same thing:
- **Availability heuristic** — fitting to the few dramatic, easy-to-recall examples; a handful
  of high-salience points treated as the whole distribution.
- **Confirmation bias** — refusing to evaluate on held-out data; you only ever score yourself
  on a training set you curated to agree with you.
- **Self-serving / attribution error** — a model that has memorized a flattering story about
  itself and generalizes it badly to new situations.
- **Curse of knowledge** — overfit to your own context; you can't predict the
  out-of-distribution mind of a beginner, or of someone who disagrees.

## Why it matters
ML already names the cures, and they map one-to-one onto decision hygiene:

| ML fix for overfitting | Decision-making equivalent |
|---|---|
| Add more / more representative data | Widen your sample — actively seek disconfirming and out-group cases |
| Regularization (penalize complexity) | Prefer the simpler explanation; tax elaborate self-justifying stories |
| Cross-validation / hold-out set | Test beliefs against people and data you didn't pick |
| Early stopping | Stop "training" a conviction before you've memorized your own noise |
| Drop outliers | Discount vivid one-off anecdotes driving the whole model |

The mirror image — underfitting / high bias — is the cousin of being so cautiously generic you
never commit to a real model of the situation. The goal in both worlds is to *generalize* to the
next case you haven't seen, not to fit your experience perfectly.

## So what
When a conviction feels obviously, strongly right, run a 30-second overfit check before acting:
1. **Sample size** — how many real, varied data points is this built on, or is it 2–3 vivid ones?
2. **Held-out test** — what's one source that didn't already agree with me, and have I scored against it?
3. **Regularize** — is there a simpler explanation I'm penalizing because the complex one flatters me?

If it can't survive an out-of-sample test, treat it like an overfit model: lower the confidence,
don't ship the decision.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*


