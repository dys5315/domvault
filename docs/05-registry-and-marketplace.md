# 05 — Registry & marketplace

The full technical spec lives in [`../registry/SPEC.md`](../registry/SPEC.md). This page is the
plain-English version.

## The idea
Once people can **publish individual notes** (with consent + attribution), those notes become
shared building blocks. The collection of all published notes is a browsable graph — the
**Universe**. Within it:
- a **galaxy** is a topic or an organization,
- a **solar system** is one person's brain (only their published notes),
- a **planet** is a single published note,
- a **moon** is a fork of a planet that still credits the original.

## Why this is the right shape for a marketplace
- **Granular** — you sell/share a *node*, not your whole brain.
- **Attributed** — credit is content-addressed and carried in-band; copying without lineage is
  detectable.
- **Trustworthy** — nothing is published without the owner doing it on purpose.
- **Composable** — buyers pull planets into their own brains as linked copies.

## Build order
1. **Publish / pull** (the SPEC) — the consent-first primitive.
2. **Universe visualization** (the `constellation/` app) — make the graph explorable.
3. **Search & discovery** — find planets by topic, author, lineage.
4. **Payments** — free by default; authors may price individual planets or curated galaxies,
   which grants a per-node commercial license.

## Federation vs central hub
Start centralized for speed; design toward federation so each brain can self-serve its public
planets and no single company owns everyone's knowledge. The manifest + signing scheme in the
SPEC supports both.
