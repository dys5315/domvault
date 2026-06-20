---
title: "Goodhart's Law Is Overfitting (Every Scored System Needs a Holdout)"
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ml, metrics, evaluation, rubric]
galaxy: [ai-engineering]
planet_id: planet_1680ce1bbebd75694e55688fc70d4a93506b6027
---

# Goodhart's Law Is Overfitting (Every Scored System Needs a Holdout)

> Overfitting a backtest and gaming a scoring rubric are the *same* failure: you optimize a
> proxy until it stops predicting the reality it stood for.

## The connection
A model tuned to ace one historical sample squeezes out a fake score by exploiting quirks of that
sample, not the underlying signal. A rubric gets gamed the moment people are rewarded against it —
they optimize the *metric* instead of the *quality* it was meant to measure. "When a measure
becomes a target, it ceases to be a good measure" (Goodhart) is just the social-systems
statement of overfitting: maximize the empirical score on the seen distribution and you degrade
on the unseen one.

## Why it matters
Any system that grades against a proxy — an eval suite, a trading strategy, a hiring scorecard, a
recommendation metric — is exposed. The defensive instinct is identical across domains:
hold out data the optimizer never sees, and watch for score-vs-reality drift on that holdout.

## So what
- Treat any rubric like a backtest: hold out a fraction of evaluations the optimizer never sees;
  watch for drift between the score and the real-world outcome it proxies.
- Keep the highest-stakes criteria partly opaque or rotating, so the metric can't be
  reverse-engineered into a target.
- Re-audit periodically: does a high score still predict the outcome it was built to proxy? If
  the correlation decays, the metric is being gamed — re-fit or re-spec.

---
*Genericized example from the Domvault engine. Original mental model © Dom Sadarangani, shared under PolyForm Noncommercial 1.0.0.*




