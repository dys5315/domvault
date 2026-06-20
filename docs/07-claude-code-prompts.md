# 07 — Claude Code prompts (build the heavy pieces)

The repo ships the **design** (specs, schema, mock). These are copy-paste prompts to hand
Claude Code so it builds the actual running backend and app. Run each from the repo root.
Work one prompt at a time; review the diff before moving on.

---

## Prompt A — Registry backend (publish/pull)
```
Read registry/SPEC.md and registry/schema/node.schema.json. Build a small, production-lean
registry service that implements the v0 API in SPEC §6:
- Language: Node/TypeScript (Fastify) OR Python (FastAPI) — pick one and stay consistent.
- Storage: Postgres for manifests + an object store (local disk in dev) for note bodies.
- Endpoints: POST/GET/DELETE /planets, GET /galaxies/{slug}, GET /stars/{handle},
  GET /universe?since=.
- Enforce: manifest validates against node.schema.json; content-addressed ids
  (id = "planet_" + sha256(canonical-body)[:20]); reject unsigned manifests; first-publish-wins
  on provenance.
- Include: signature verification (ed25519), a /healthz, OpenAPI docs, and integration tests
  for publish → fetch → unpublish and for fork lineage (moon.origin set correctly).
Put it in a new top-level folder registry/server/. Do NOT add telemetry. Write a README with
run instructions.
```

## Prompt B — Constellation web app (from the mock)
```
Read constellation/index.html (the mock), constellation/mock/data.json, and registry/SPEC.md.
Turn the mock into a real app:
- Stack: Vite + your choice of canvas/WebGL (keep it dependency-light; the mock is vanilla).
- Replace the mock fetch with a live call to the registry GET /universe, mapping its response
  to the galaxy→star→planet layout already in the mock.
- Keep the zoom levels (universe → galaxy → solar system) and the credit-first labeling.
- Clicking a planet opens a panel: title, author (linked to their star), license, lineage
  (origin/moons), and a "Pull into my brain" action that calls the local publish/pull client.
- Add search by topic/author. Keep it fast at 1k+ planets (cluster/LOD as needed).
Put it in constellation/app/. Preserve the privacy framing in the UI copy.
```

## Prompt C — Publish/pull client (the /publish command, for real)
```
Read registry/SPEC.md §3 and §4 and plugin/commands/publish.md. Build a CLI + library that a
brain uses to publish and pull:
- `domvault publish <note.md>`: refuse unless frontmatter publish:true; build the manifest; STRIP
  private fields and unresolved/unpublished backlinks; print a colored DIFF of exactly what will
  leave the machine; require interactive confirm; sign with the brain's ed25519 key; POST to the
  registry; write the returned planet id back into the note frontmatter.
- `domvault pull <planet-id>`: fetch, write a linked copy into 70-learning/imported/ with
  origin/author frontmatter and a credit banner.
- `domvault keygen`: create the brain's keypair (store private key outside the vault).
Language: match Prompt A. Add tests for the strip step (assert no private field ever serializes)
and for round-trip publish→pull. This is the trust-critical component — be conservative.
```

## Prompt D — (optional) Federation
```
Read registry/SPEC.md §6. Add a federated mode: each brain can run a tiny read-only server that
serves its own GET /stars/{handle} and signed planet bodies; a hub periodically crawls a list of
brain endpoints to build GET /universe. Document how to register a brain endpoint and how the hub
verifies signatures. Goal: no single party must hold everyone's knowledge.
```

---

### Tips
- Tell Claude Code to keep the **zero-telemetry / opt-in** invariants from the README — restate
  them in each prompt if needed.
- Build order: A → C → B → D. (Backend, then the client that proves the consent flow, then the
  visualization, then federation.)
- After each, run the tests and skim the diff before committing.

---

## Prompt E — Use the brain's own frameworks to decide what to publish
```
Read docs/08-what-to-publish-rubric.md. Then read the five frameworks in my PRIVATE vault that
back the rubric (do NOT copy their content or titles into this public repo) — find them in
80-synthesis/ by theme:
  - my rubric-pattern note            (the weighted/explainable scoring structure)
  - my FMEA note                      (RPN = Severity × Occurrence × Detection)
  - my moat-analysis note             (commodity layers vs defensible assets)
  - my value-based-pricing note       (the community-lift axis)
  - my Goodhart / holdout notes       (the anti-gaming gate)

Task:
1. If the rubric in docs/08 can be sharpened by these frameworks, propose edits to docs/08
   (keep it generic — no venture names, numbers, or client info).
2. Score EVERY note in 30-frameworks/ and 80-synthesis/ on S, O, D, L, G per the rubric.
   Compute RPN = S*O*D. Apply the auto-fail triggers.
3. Write the scored inventory to a PRIVATE file OUTSIDE this public repo (e.g.
   ~/domvault-publish-report.md): a table of note | S | O | D | RPN | L | G | verdict | why,
   grouped PUBLISH / GENERICIZE / HOLD, with a confidence flag per row.
4. For every GENERICIZE verdict, produce a stripped version (no client/patient names, no live
   pricing, no JV splits, no infra) and place those — and only those plus the PUBLISH ones —
   into this repo's frameworks/ folder with frontmatter publish:true and attribution.
5. Respect the HOLDOUT GATE: do NOT git-add or push anything. Stop and present the report +
   the staged frameworks/ files for human review first. The rubric is advisory; I confirm.

Invariant: nothing leaves the private vault except notes I approve after reading the report.
```

### Note
Prompt E is the one to run inside the actual vault (it needs read access to the private notes).
Prompts A–D build the network; E curates the content. A first pass of E has already been run —
see `frameworks/` for the seeded examples and the private report it generated.
