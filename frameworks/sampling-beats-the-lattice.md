---
title: Sampling Beats the Lattice (Random Search Is Monte Carlo Over Configs)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, ml, math, monte-carlo, hyperparameters]
galaxy: [ai-engineering, quant-markets]
planet_id: planet_97b7706d7c8e886002340139f48fed3dadc93ad5
---

# Sampling Beats the Lattice (Random Search Is Monte Carlo Over Configs)

> Random hyperparameter search *is* Monte Carlo — uniform random sampling of a region you can't
> compute analytically, leaning on the law of large numbers.

## The connection
Estimating π by scattering random points in a square and counting hits inside the quarter-circle,
and finding good hyperparameters by scattering random configs across the search space and keeping
the best cross-validation score, are the same algorithm. The reason random search beats grid
search is the same reason darts beat a fixed lattice: in high dimensions most hyperparameters
barely matter, so a grid wastes its budget re-sampling the irrelevant axes at fixed values, while
random sampling explores the *important* axes at many distinct values for the same number of
trials. Bayesian optimization is the next step — importance sampling that bends the throws toward
where good models already appeared.

## Why it matters
For a fixed compute budget, random beats grid for tuning, and Bayesian/Hyperband beats random once
the space is large or trials are expensive. The shared intuition — sampling estimates the shape of
an intractable surface — also licenses Monte Carlo wherever a closed form is missing: option
pricing, risk simulation, integral estimation. One mental model, three domains.

## So what
- Make random (then Bayesian) the default tuner; reserve grid only for ≤2 cheap, known-important
  hyperparameters.
- Log-scale the sampling ranges for learning rate and regularization strength — sample the
  exponent uniformly, not the value.
- Reuse the "sample the surface" frame for any parameter sweep and any pricing/risk estimate
  without a closed form.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*


