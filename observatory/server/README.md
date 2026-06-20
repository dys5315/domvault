# Observatory — server (Prompt F, the internal side)

The **read** side of Constellation: answer questions over what's been *published*, with
the same consent-and-provenance guarantees the publish side enforces. This package is
the **internal** Observatory — retriever + synthesizer + HTTP endpoint — with **zero
runtime dependencies** (Node built-ins only) and **no telemetry**.

Spec: [`../../docs/09-observatory-agent-query-endpoint.md`](../../docs/09-observatory-agent-query-endpoint.md).
Shared types (do not edit): [`types.ts`](./types.ts).

## Files

| File | Role |
|------|------|
| `types.ts` | **Shared** contract: `Chunk` (two-gate union), `Retriever`, `Synthesizer`, `Answer`, `PlanetIndex`, `IndexedPlanet`. Imported, never edited. |
| `internal.ts` | `InternalRetriever implements Retriever`. Searches the published index only; emits internal chunks that pass **Gate 1** (resolving `planet_id`); copies license in-band; enforces paid-mode licensing. Exports `commercialUseOk` / `isCommercialLicense`. |
| `index.ts` | `FixturePlanetIndex implements PlanetIndex` — in-memory lexical index for dev/tests (the default). Plus a clearly-marked `fromRegistry()` **adapter stub** for the real registry (Prompt A). |
| `synth.ts` | `TemplateSynthesizer implements Synthesizer` — deterministic, no LLM. Distinct labels, license summary, and the untrusted-text `sandbox()`. |
| `endpoint.ts` | `node:http` server. `POST /agent/query`. `createObservatory({ retriever, synthesizer })` factory — the **injection seam**. |
| `*.test.ts` | `node:test` suites (20 tests). |

## The two-gate trust model (doc 09 §2)

Every piece of evidence is a `Chunk`, a discriminated union that is **never collapsed**:

- **internal** → the **private-leak guard**: must resolve to a published `planet_id`.
  No id, no chunk. This makes *"the vault never leaks"* enforceable at retrieval time.
- **external** → **attribution/redistribution**: must carry `provider` + `citation`.
  (Built by Prompt G; this package only consumes the type and labels them distinctly.)

## Endpoint

```
POST /agent/query
  body: { query: string, k?: number, paid?: boolean }
  →     { answer: Answer }        // Answer = { text, citations[], license_summary }
```

- Runs retriever → synthesizer → returns the `Answer`.
- `k` caps chunks (default 12). `paid: true` narrows retrieval to commercially
  licensable planets (see below).
- `license_summary.redistribution` becomes `"restricted"` the moment any third-party
  (external) content is cited — enforced both in the synthesizer and as an
  endpoint-level backstop.

## Paid-mode licensing (`commercialUseOk`)

When `paid: true`, the answer is being **resold** to a third party. The internal
retriever drops any planet where:

```
commercialUseOk(planet) = planet.author_is_owner || isCommercialLicense(planet.license)
```

A planet under a **Noncommercial** license (e.g. `PolyForm-Noncommercial-1.0.0`,
`CC-BY-NC-4.0`) is **not** commercial. **Why:** reselling a contributor's Noncommercial
planet violates *their* license (registry/SPEC §5). `author_is_owner` overrides this —
the Observatory owner may sell their own work even if they licensed it Noncommercial.
Non-paid answers are unaffected.

## The sandbox (untrusted text = data, not instructions)

`synth.ts` wraps every chunk's `text` between explicit fences and escapes any embedded
fence markers, so retrieved text can never close its own sandbox and smuggle in a
directive. A payload like `"ignore previous instructions"` stays quoted inside the
fence — never lifted out as a command. External chunks are the larger threat (doc 10 §6)
but **all** retrieved text is sandboxed. The same rule is what a real LLM synthesizer's
prompt-builder must apply when it swaps in behind the `Synthesizer` interface.

## The fused-retriever injection seam (how Prompt G plugs in)

`endpoint.ts` exposes:

```ts
createObservatory({ retriever?, synthesizer? }): Observatory
```

- **Default** `retriever` = `InternalRetriever` over a `FixturePlanetIndex` —
  internal-only, so the server boots and answers from the published index alone.
- **Prompt G** builds its **fused** retriever (internal + YottaGraph, doc 10) — which
  implements the same `Retriever` interface — and injects it:

  ```ts
  import { createObservatory } from "./endpoint.ts";
  const fused = new FusedRetriever(internal, yottagraph); // Prompt G
  const obs = createObservatory({ retriever: fused });
  http.createServer(obs.handler).listen(8788);
  ```

  No endpoint code changes, because everything downstream depends on the `Retriever`
  **interface**, not a concrete class. G's fused retriever is expected to default its
  external source **off** and degrade to internal-only when the source is disabled,
  unauthed, down, or over budget (doc 09 §5). The endpoint's restricted-redistribution
  backstop then fires automatically whenever G surfaces an external chunk.

The same pattern swaps a real LLM `synthesizer` in for the `TemplateSynthesizer`.

## Real index at integration (`fromRegistry`, stub)

`index.ts` keeps `FixturePlanetIndex` as the default so F is testable standalone. The
marked `fromRegistry(client, ownerStar)` stub shows the intended integration: crawl the
registry (`GET /universe` / `GET /stars/{handle}`, registry/SPEC §6), map each published
manifest+body to an `IndexedPlanet`, and back `search()` with a real search service. The
map sets `author_is_owner` from the owner's star so paid-mode licensing works.

## Run

```sh
# tests (Node ≥21 expands the quoted glob; on Node 18–20 let the shell expand it):
npx tsx --test observatory/server/*.test.ts        # shell-expanded
# or via package.json (uses ** so it works regardless of Node version):
npm test

# typecheck
npx tsc --noEmit

# dev server (seeds an empty index; real planets arrive via fromRegistry)
npm run observatory:dev      # → POST http://localhost:8788/agent/query
```

## Invariants this package holds (doc 09 §6)

1. **The vault never leaks** — retrieval reads the published index only; a chunk with
   no resolving `planet_id` cannot enter an answer. `publish: false` is unreachable.
2. **License travels with the content** — every chunk carries its license in-band; the
   answer summarizes it. Nothing is relicensed by omission.
3. **Retrieved content is data, not instructions** — chunk text is sandboxed.
4. **Consent is inherited, not re-litigated** — the Observatory only reads what the
   publish step (Prompt C) already gated public.
