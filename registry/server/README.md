# Constellation registry — server (v0)

Reference implementation of the Constellation publish/pull registry described in
[`../SPEC.md`](../SPEC.md). Zero runtime dependencies (Node built-ins only),
zero telemetry, zero outbound network calls.

## Run

```bash
npm run registry:dev            # serves on :8787 (override with PORT=…)
```

Or embed the handler in your own process:

```ts
import { createServer } from "./server.ts";
import { PlanetStore } from "./store.ts";

createServer(new PlanetStore("registry/.data")).listen(8787);
```

## Test

```bash
npx tsx --test registry/server/server.test.ts
npx tsc --noEmit          # type-check
```

## Endpoints (SPEC §6)

| Method   | Route                | Purpose                                   |
|----------|----------------------|-------------------------------------------|
| `POST`   | `/planets`           | publish a node (signed manifest + body)   |
| `GET`    | `/planets/{id}`      | fetch a planet (manifest + body)          |
| `DELETE` | `/planets/{id}`      | unpublish (removes it from the universe)  |
| `GET`    | `/galaxies/{slug}`   | list planet manifests in a galaxy         |
| `GET`    | `/stars/{handle}`    | list a brain's public planet manifests    |
| `GET`    | `/universe?since=…`  | crawl the graph (manifests, oldest-first) |

### Publish request body

```json
{ "manifest": { /* NodeManifest, signed */ }, "body": "<note markdown>", "publicKey": "<PEM ed25519 public key>" }
```

Returns `201 { "id": "planet_…" }` on success, `400 { "error", "detail?" }` on
any validation/trust failure.

## Trust properties enforced at publish

Consent by construction (SPEC §3): a planet only ever exists in the universe
because a client explicitly `POST`ed it. Private notes have no manifest, so they
are never indexed.

`POST /planets` rejects (400) unless **all** of these hold (SPEC §5):

1. **Schema** — the manifest validates against
   [`../schema/node.schema.json`](../schema/node.schema.json) (required fields,
   `content_hash` matches `^sha256:[a-f0-9]{64}$`, `version >= 1`, no extra
   properties — checked by `validate.ts`, no ajv).
2. **Body integrity** — `content_hash === sha256(body)`.
3. **Authorship** — the ed25519 `signature` verifies against the supplied
   `publicKey`, over the canonical (sorted-key, `id`+`signature`-excluded) JSON.
   Authorship cannot be spoofed.
4. **Content-addressed id (anti-theft)** — `id` must equal the id derived from
   the manifest content. Identical content yields the same id; text copied
   under a different author/star hashes differently, so a thief's copy gets a
   *different* id with no lineage. Spoofed/borrowed ids are rejected.

`DELETE /planets/{id}` is unpublish: the planet leaves the universe immediately.

## Files

- `hash.ts` — canonical JSON, `contentHash(body)`, `planetId(manifest)`.
- `keys.ts` — ed25519 `generateKeypair` / `sign` / `verify`.
- `validate.ts` — hand-written schema validator.
- `store.ts` — filesystem-backed JSON object store (`registry/.data/`, gitignored).
- `server.ts` — `node:http` service + `createServer(store?)` factory.
- `server.test.ts` — `node:test` coverage of the round-trip + trust checks.
