---
title: Feedback & Control (One Pattern, Four Domains)
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, control-theory, systems-thinking, cross-domain]
---

# Feedback & Control (One Pattern, Four Domains)

> The same abstract pattern — **negative feedback toward a setpoint** — hides in control theory,
> markets, biology, and AI agents. They're the same math wearing different clothes.

## The pattern
A system measures its distance from a desired state and applies a correction proportional to the
error, pulling itself back toward equilibrium. That single idea shows up across domains:

1. **Control theory** — an inverted pendulum on a cart. PID/LQR/MPC are formal recipes for "sense
   the error, push back, don't overshoot." The cleanest, most explicit version of the pattern.
2. **Markets / risk** — a stop-loss *is* a controller: it senses capital drawdown past a setpoint
   and forces a corrective action (exit) before the error compounds. Discipline = obeying the
   control law instead of overriding it emotionally.
3. **Biology** — endocrine homeostasis is negative feedback in wetware: glands sense a level,
   release or suppress hormones to correct it; disease is often a broken feedback loop.
4. **AI agents** — an agent loop (observe → evaluate → act → re-observe) is the same controller,
   and production AI lives or dies on its feedback layers (evals, guardrails, retries). An agent
   without feedback is open-loop — it drifts, exactly like an un-corrected pendulum.

## The insight
These aren't analogies for flavor — they're the *same math* wearing different clothes, so intuition
transfers:
- The failure mode is universal: **no feedback → drift; too much gain → oscillation/overshoot.** A
  trader who moves their stop, a thermostat that's too aggressive, and an AI agent that
  over-corrects on every token are the same bug.
- Contrast it with the *other* pattern — **positive feedback / compounding** (network effects,
  viral growth): runaway instead of self-correcting. Most real systems are a fight between the two.

## So what
- Design products as control systems. Anything with "grade vs. target, then correct" is a feedback
  controller — name it; it's a unifying design language.
- Use it as a diagnostic. For any misbehaving system — a bot, a trade, a team, a launch — ask:
  *Where's the feedback loop, what's the setpoint, and is the gain too high or too low?*

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*
