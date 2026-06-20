---
title: A Backtest Is a Double Pendulum (Deterministic ≠ Predictable)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, quant, chaos, backtesting, robustness]
galaxy: [quant-markets]
planet_id: planet_a948d1ec6cdc8e202a264f1171cad092e3009326
---

# A Backtest Is a Double Pendulum (Deterministic ≠ Predictable)

> A strategy that survives only one trajectory has fit the chaos, not the signal. Data-snooping is
> just exploiting sensitive dependence — finding the one initial condition where the pendulum
> happened to swing your way.

## The connection
Ten pendulums released one degree apart trace identical equations yet diverge into wildly
different paths within seconds — chaos: deterministic but not predictable, because the system has
*sensitive dependence on initial conditions*. A trading strategy fit to one historical path is the
same trap. The equity curve is the pendulum's trajectory; the chosen sample window, asset universe,
and parameter seeds are the initial conditions. Perturb them a hair — start the backtest a month
earlier, swap one delisted ticker back in, jitter a threshold — and the curve diverges just as
violently. That divergence is precisely *why* backtests lie.

## Why it matters
The chaos lens turns vague warnings about look-ahead, survivorship, and snooping into a concrete
robustness test: a real edge must be *stable under perturbed initial conditions*; a chaotic
artifact will not be.

## So what
- Before trusting any strategy, run **perturbed-start robustness checks**: vary the start date,
  universe, and parameter seeds; if the equity curve diverges chaotically, you fit noise.
- Mandate **walk-forward** (and purged cross-validation) as the default — it's the empirical test
  of whether performance survives shifted initial conditions, not just one lucky trajectory.
- Report the *spread* across perturbations, not a single backtest line. A tight bundle of curves =
  signal; a fan of divergent ones = a double pendulum.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

