---
title: Volatility Harvesting (Feedback Control You Want Disturbed)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, quant, control-theory, systems-thinking]
galaxy: [quant-markets, systems]
planet_id: planet_440af4105819abbbbd8c9ae6af278bc73071ab7a
---

# Volatility Harvesting (Feedback Control You Want Disturbed)

> Turn the disturbance you'd normally fight into the thing you harvest. It's a design pattern, not
> just a trade.

## The connection
Gamma scalping is textbook negative feedback. The trader holds long gamma, measures an error term
(net delta away from zero), and applies a proportional correction — sell underlying when price
rises, buy when it falls — driving delta back to a setpoint of zero. That's the same controller as
the inverted pendulum, the stop-loss, and the AI agent loop.

But it inverts the usual moral. Everywhere else, the disturbance is the enemy: you correct *against*
it and wish it would go away. In gamma scalping you **want the disturbance** — the underlying's
volatility is exactly what you're paid for. Each re-hedge locks in $\tfrac12\Gamma(dS)^2$; the
position is profitable whenever realized variance beats the theta you pay:
$\tfrac12\Gamma(dS)^2 > \Theta\,dt \Leftrightarrow \sigma_{\text{realized}} > \sigma_{\text{implied}}$.
So this is a controller that monetizes the very error it suppresses. The "cost of control" (theta)
is the premium, and the path variance you fight is the revenue.

## Why it matters
The general move — *turn the disturbance you'd normally fight into the thing you harvest* — is a
design pattern, not just a trade. Any self-correcting system that pays per correction (rebalancing,
market-making, even churn-driven re-engagement) is a volatility harvester. The question shifts from
"how do I eliminate variance?" to "is my correction cost lower than the variance I capture?"

## So what
- Frame any hedged position as a controller and ask the one question that decides P&L: realized vs.
  implied — is the gain (re-hedge frequency) tuned to capture variance without bleeding theta?
- Add a "disturbance polarity" axis when applying feedback control: for each system, is the
  disturbance a cost to suppress or a revenue to harvest? It changes whether you minimize or
  maximize loop gain.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

