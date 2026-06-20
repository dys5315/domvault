---
title: Run Attention Like a Leaky Bucket
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, productivity, systems-thinking, attention]
---

# Run Attention Like a Leaky Bucket

> The leaky-bucket rate limiter and most good time-management advice are the same control law
> applied to two overloaded servers — an API gateway and a human. Dropping is a feature, not a
> failure.

## The connection
The bucket converts **bursty input into fixed-rate output**: requests pour in unevenly, the bucket
drains at a constant rate, and once it overflows the excess is *dropped on purpose* to protect the
downstream service. Read common time-management techniques through that lens and they collapse into
one rule. Timeboxing, Pomodoro, and task batching are the **constant drain rate** — you process
work at a fixed cadence regardless of how fast it arrives. A capture inbox is the **bucket itself**
— a queue that absorbs bursts so they don't hit the processor live. The 80/20 rule and the
"delete" quadrant are **overflow handling** — deliberate, designed dropping of excess load. The
whole menu is traffic shaping for a person.

## Why it matters
The reframe replaces willpower with a system property. Burnout is what happens when you run
open-loop: every inbound request gets processed live at arrival rate, so output rate equals input
rate and the buffer (you) saturates. The engineering insight is that *dropping is a feature, not a
failure* — a rate limiter that never drops isn't protecting anything. "Saying no" stops being a
character flaw and becomes the overflow policy that keeps throughput stable.

## So what
- Set a fixed daily processing rate (timeboxed deep-work blocks); treat it as the drain, not a
  target to exceed.
- Route all inbound to one capture bucket; never process at arrival time.
- Pre-decide the overflow policy so "no" is automatic, not agonized.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*
