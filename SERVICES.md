# Constellation services (registry + Observatory)

The runnable backend for Domvault's opt-in publishing + agent-query layer. Built from the
specs in [`registry/SPEC.md`](registry/SPEC.md), [`docs/09`](docs/09-observatory-agent-query-endpoint.md),
and [`docs/10`](docs/10-yottagraph-retriever-adapter.md), in dependency order **A → C → F → G**.

**Zero runtime dependencies** (Node built-ins only: `http`, `crypto`, `fs`, `test`), **zero
telemetry**. TypeScript, run with `tsx`.

## Components

| Prompt | Path | What it is |
|--------|------|------------|
| **A** | `registry/server/` | Constellation registry — publish/pull HTTP API (SPEC §6). Content-addressed ids, ed25519-signed manifests, schema validation, anti-theft + consent enforced at publish time. |
| **C** | `client/` | The `/publish` + `/pull` client. Strips private fields (fails closed), shows the publish diff, signs, POSTs. Reuses A's `hash.ts`/`keys.ts` so ids match. |
| **F** | `observatory/server/` | The Observatory — `POST /agent/query`, the internal retriever (published index only), and a sandboxing synthesizer. The two-gate trust model (doc 09). |
| **G** | `observatory/server/retrievers/` | YottaGraph external source (transport-agnostic, REST-first, mock-developed) + the fused retriever (normalize → bias → dedupe → cap, redistribution + injection safety). |

## Run

```bash
npm install                # tsx + typescript + @types/node (dev only)
npm test                   # 68 tests across A, C, F, G, the E2E pipeline, and the Explorer mapping
npm run typecheck          # tsc --noEmit, strict
npm run registry:dev       # registry on PORT (default 8787)
npm run observatory:dev    # Observatory on PORT (default 8080)
```

## See your graph — one command

```bash
npm run demo               # registry up → publish frameworks/ → serve the Explorer
```

Then open **http://localhost:8080** — the Constellation Explorer renders the **live** registry:
galaxies (topics) → solar systems (brains) → planets (your published frameworks). Click a planet
to inspect its manifest (title, author, license, lineage, version, signature). The legend shows
the data source (`🟢 Live` / `🟡 Mock` / `⚪ Offline`).

What `demo` does, and the guarantees it keeps:

1. **Registry up** (`registry/.data`, persisted so re-runs are idempotent).
2. **Publish** `frameworks/*.md` only — `scripts/publish-frameworks.ts` runs each note through the
   fail-closed stripper, signs it, and POSTs it. It **derives `galaxy` from each note's `tags`**
   (mapping in that file's `TAG_GALAXY`) so the universe isn't one blob, and writes the
   `planet_id` + `galaxy` back into the note. Re-running publishes the **same content-addressed
   ids** — no duplicates (first-publish-wins).
3. **Serve** `constellation/` over http so the Explorer's `fetch(/universe)` + module import work.

**Keys & consent:** the brain keypair lives in `~/.constellation/` (**outside the repo, never
committed**); the public key is your star. Only `frameworks/` is ever published — **the vault is
never touched**. Point the Explorer at any registry with `?registry=http://host:port`; if it's
unreachable the Explorer **degrades to the offline mock** (`constellation/mock/data.json`).

## The invariants (enforced + tested)

- **The vault never leaks** — the internal retriever reads only the *published* index; a chunk
  with no resolving `planet_id` can't enter an answer. The E2E test plants a private landmine in a
  note and asserts it never reaches a published answer.
- **Third-party content is attributed + flagged** — external chunks carry `provider` + `citation`;
  any external citation sets `contains_third_party` + `redistribution: "restricted"`.
- **External defaults to owner-only** — off by default; excluded from paid answers without
  redistribution rights; other contributors' Noncommercial planets are excluded from paid answers.
- **External failure never breaks the endpoint** — the external source degrades to `[]`; answers
  fall back to the internal index.
- **Retrieved content is data, not instructions** — all chunk text is sandboxed; a poisoned
  external fact is neutralized.
- **Fusion ranking is real** — scores are normalized per source *before* merging, so ordering
  isn't an artifact of incomparable raw scales.

## Tests: 63 passing

`A` 11 · `C` 14 · `F` 20 · `G` 16 · **E2E** 2 (the whole pipeline: publish → registry → crawl →
retrieve → fuse → synthesize, with every invariant asserted end-to-end).

## Going live with YottaGraph

The adapter is mock-developed and REST-first. When Lovelace access is provisioned, fill the three
`<FILL-IN>` seams in `observatory/server/retrievers/yottagraph.ts` (the `YottaGraphConfig`
endpoint/auth, the `mapRawFact()` wire-shape mapper, and the stubbed `fetch` in `RestYottaGraph`).
Nothing else changes.
