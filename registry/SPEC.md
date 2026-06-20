# Constellation — opt-in publishing & marketplace spec (v0.1 draft)

> **The one rule:** nothing leaves a brain without its owner explicitly publishing it, and
> attribution travels with every node forever. Constellation is GitHub for knowledge nodes,
> not a backdoor into private vaults.

## 1. The cosmology

| Scale | Object | Meaning | Who controls it |
|-------|--------|---------|-----------------|
| 🌌 Universe | the network | all public nodes everywhere | the registry (federatable) |
| ✨ Galaxy | cluster / org | a topic ("AI Engineering") or an organization | galaxy maintainers |
| ☀️ Solar system | a brain | one person's published nodes | the brain owner |
| 🪐 Planet | a node | one published note / framework | the author |
| 🌙 Moon | a version/fork | a derivative of a planet, linked to origin | the forker (origin credited) |

A planet appears in the Universe **only** if its owner published it. A brain's private notes
are invisible to the registry — they don't have manifests, so they can't be indexed.

## 2. What gets published (the node manifest)

Publishing a note produces a small JSON **manifest** plus the note body. The manifest is the
only thing the registry indexes. Schema: [`schema/node.schema.json`](schema/node.schema.json).

```json
{
  "id": "planet_8f2c…",            // content-addressed, stable
  "title": "Model the Funnel as a One-Way State Machine",
  "author": { "handle": "dom", "display": "Dom S.", "star": "star_dom" },
  "galaxy": ["ai-engineering", "product"],
  "license": "PolyForm-Noncommercial-1.0.0",
  "summary": "One-paragraph abstract shown in the universe view.",
  "links": ["planet_3a91…"],       // outbound wiki-links that resolve to other planets
  "origin": null,                   // set to a planet id if this is a fork (moon)
  "content_hash": "sha256:…",
  "published_at": "2026-06-19T00:00:00Z",
  "version": 1
}
```

Private/local-only fields (your raw frontmatter, backlinks to unpublished notes, attachments
you didn't include) are **stripped** before publish. The user sees the exact diff first.

## 3. The publish flow (consent by construction)

```
note (publish: true)
   │  user runs /publish
   ▼
build manifest  ──►  STRIP private fields  ──►  show DIFF to user  ──►  [confirm?]
                                                                          │ yes
                                                                          ▼
                                                              POST /planets  (signed)
                                                                          │
                                                                          ▼
                                                      registry returns planet id → write back to note
```

- Default frontmatter is `publish: false`. The engine never auto-flips it.
- Publishing is **signed** with the brain's keypair so authorship can't be spoofed.
- **Unpublish** = `DELETE /planets/{id}`; the planet disappears from the Universe. Forks
  already pulled keep their linked copy but show "origin withdrawn".

## 4. The pull flow (importing someone else's planet)

When you pull a planet into your brain, you get a **linked copy** (a moon): the note lands in
`70-learning/imported/` with frontmatter `origin: planet_…`, `author: …`, and a banner crediting
the source star. Your local edits create a new version; you may re-publish it as your own moon,
which still records `origin` → original. Credit is non-removable.

## 5. Trust & anti-theft properties

- **Content-addressed ids** — copying text without attribution produces a *different* id with no
  lineage; the original keeps the earliest `published_at`. First-publish wins on provenance.
- **Signed manifests** — you can prove you authored a node.
- **License carried in-band** — every planet states its license; commercial reuse of a
  Noncommercial planet is a visible violation.
- **Lineage graph** — moons point at their origin planet, so forks are traceable, not laundered.

## 6. Registry API (reference, v0)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/planets` | publish a node (signed manifest + body) |
| `GET`  | `/planets/{id}` | fetch a planet |
| `DELETE` | `/planets/{id}` | unpublish |
| `GET`  | `/galaxies/{slug}` | list planets in a galaxy |
| `GET`  | `/stars/{handle}` | list a brain's public planets |
| `GET`  | `/universe?since=…` | crawl/sync the graph for the visualization |

The reference implementation can be a thin service (Postgres + object store) or fully
**federated** (each brain serves its own `/stars/{handle}` and a hub aggregates) — federation is
preferred long-term so no single party owns everyone's knowledge.

## 7. Marketplace layer (later)

Once planets exist, the marketplace is mostly UI + policy on top:
- **Free planets** — browse/pull, attribution only.
- **Paid planets / galaxies** — author sets a price; buyers get pull rights. Requires a
  commercial license grant on that node (Noncommercial default would be overridden per-node).
- **Bundles** — a curated galaxy (a "playbook") sold as a set.
- **Reputation** — derived from lineage (how many moons your planets spawned) + endorsements.

Build order: publish/pull (this spec) → Universe visualization → search → payments.
