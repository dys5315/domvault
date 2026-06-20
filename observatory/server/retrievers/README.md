# Retrievers — YottaGraph external source + fused retriever (Prompt G)

Implements the external knowledge source and the fused retriever specified in
[`docs/10-yottagraph-retriever-adapter.md`](../../../docs/10-yottagraph-retriever-adapter.md),
layered on the Observatory interfaces in
[`docs/09`](../../../docs/09-observatory-agent-query-endpoint.md). Zero runtime deps
(only `node:crypto`), zero telemetry, no real outbound network calls.

## Files

- **`yottagraph.ts`** — the transport-agnostic external source.
  - `ExternalSource` / `RawFact` / `YottaGraphConfig` (doc 10 §1).
  - `RestYottaGraph` (**default** transport, doc 10 §0) and `McpYottaGraph`
    (alternate, unused). Both isolate the wire shape behind the `<FILL-IN>` seam and
    **throw a clear "not configured" error** until a real endpoint/tool is set — they
    never make a live call in this repo.
  - `MockYottaGraph` — fixtures for dev/tests, including one **poisoned** fact
    (`POISONED_MOCK_FACT`, summary contains `"ignore previous instructions"`).
  - `toExternalChunk()` — `RawFact → external Chunk` (`provider:"yottagraph"`,
    `citation = source`, `license_note = license`, `text = summary`, raw `score`).
- **`fused.ts`** — `FusedRetriever implements Retriever`.
  - Runs `internal.retrieve()` + `external.query()` in parallel; external is wrapped
    in `.catch(() => [])` so failure degrades to internal-only (never throws).
  - `allowExternal()` — **default OFF / owner-only**; excluded from paid answers
    unless `redistributionRightsHeld`.
  - **Gate 2**: drops external chunks missing `provider` or `citation`.
  - **Fusion (doc 10 §4):** normalize per source (min-max default, z-score optional)
    → `internalBias` after normalization → dedupe (exact text hash + optional
    embedding cosine) → sort → `externalShare` cap (default 0.4, trims lowest external first).
- **`yottagraph.test.ts`, `fused.test.ts`** — `node:test`, all of doc 10 §7.

## The internal side is injected, not built here

`FusedRetriever` accepts **any** `Retriever` as `internal`. At integration the real
`InternalRetriever` (Prompt F) is injected; the tests use a tiny in-test mock that
returns canned internal `Chunk`s. Gate 1 (internal private-leak guard) is the internal
retriever's job — this layer never duplicates nor undermines it.

## `<FILL-IN>` seams for the real Lovelace schema

The exact YottaGraph endpoint/auth/return schema is not yet known (doc 10 §0: verified
REST-first, sales-gated API). Everything that touches the wire is behind **one config
object + one mapping function**, both marked `<FILL-IN>`:

1. `YottaGraphConfig` (`endpoint`, `toolName`, `apiKey`) in `yottagraph.ts`.
2. `mapRawFact(raw: unknown): RawFact` — the **single** function that knows the
   response shape.
3. The stubbed `fetch` block inside `RestYottaGraph.query()` (and the MCP equivalent
   in `McpYottaGraph.query()`).

Dropping in the real schema means editing only those seams — `fused.ts`, the endpoint,
and `types.ts` stay untouched.

## Run

```sh
npx tsx --test observatory/server/retrievers/yottagraph.test.ts observatory/server/retrievers/fused.test.ts
npx tsc --noEmit
```

(`tsx` does not glob-expand `*.test.ts` here — list the files explicitly, or use the
root `npm test` script which uses the shell glob.)

## Invariants (doc 10 §8)

1. The vault never leaks (internal Gate-1 owned by Prompt F; never undermined here).
2. External can't leak but carries a redistribution obligation **and** may be
   non-commercial — both flagged via `license_note` + downstream `license_summary`.
3. External failure never breaks the endpoint (`catch → []`).
4. Third-party + non-commercial content is flagged.
5. Retrieved content is **data, not instructions** — fusion only hashes/sorts/copies
   text; the poisoned fact rides through as an inert chunk.
6. External defaults to owner-only (`externalEnabled` off; excluded from paid answers
   unless rights held).
