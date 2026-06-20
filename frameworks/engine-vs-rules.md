---
title: "Engine vs Rules (One Boundary, Three Jobs)"
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, architecture, multi-tenant, ip-strategy, design]
galaxy: [frameworks]
planet_id: planet_23cfcacf2b9bd2f227d821181cb0bb875f093581
---

# Engine vs Rules (One Boundary, Three Jobs)

> Draw the line between configurable Rules and the underlying Engine explicitly, once — and the
> ownership boundary, the multi-tenancy model, and the legal clarity all fall out for free.

## The connection
One architectural line keeps getting drawn from different directions:
- **IP split** — the client owns the data; the vendor owns the platform, logic, and code.
- **Configurable exceptions** — the business rules (what counts as an exception, thresholds,
  policies, mappings) must be tenant-editable.
- **Multi-tenancy** — one product serving many customers.

These are **the same line**: the boundary between the **configurable Rules/config** (the *business
logic*) and the underlying **Engine** (the intelligence, models, code). Drawn once, it does **three
jobs simultaneously**:
1. **Ownership boundary** — rules + data belong to the client; the engine stays the vendor's. The
   split is structural, not just legal.
2. **Multi-tenant config layer** — per-tenant *rules* are exactly how one engine serves N customers
   without forking the *engine*.
3. **Clean partnership line** — "business rules = client's domain, platform = ours" keeps IP clean
   even as accounts scale.

## Why it matters
Draw the line explicitly, once — a rules/config layer over a shared engine — and the ownership
boundary, the tenancy model, and the legal clarity all fall out. Blur it (hardcode rules into the
engine, or let clients touch the engine) and **all three break at once**: the boundary leaks,
tenants need code forks, and the IP gets muddy. It's the same discipline as making structure carry
the guarantee.

## So what
- Build the rules/config layer as the canonical seam: *everything client-tunable lives there;
  nothing client-tunable lives in the engine.*
- Use "is this Rules or Engine?" as the test for every new feature and every ownership conversation.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*




