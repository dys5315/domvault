# 10 — YottaGraph retriever + fusion

This doc specifies the **external knowledge source** and the **fused retriever** that layer on top
of the Observatory interfaces in doc [09](09-observatory-agent-query-endpoint.md). It is the
design for Prompt G. It is a **spec, not code** — the implementation is Prompt G, and it must not
be started until the prerequisites (A → C → F) exist.

The external source is **Lovelace YottaGraph** — a ~trillion-fact "world reference graph." Fusing
it lets an answer draw on global facts *and* the owner's own published planets, while keeping the
two strictly separated and correctly licensed.

---

## 0. Access reality (verified) — build REST-first, mock-developed

Before designing the adapter, the real access path was checked. Findings:

- **Transport: REST/HTTP, not MCP.** Public descriptions are consistent with a REST API ("any
  system that can call an API"). There is **no evidence YottaGraph speaks MCP.** Do not hardcode
  MCP. Build **REST-first**; keep an MCP impl as an unused alternate behind the same interface.
- **Free scope: a financial-query preview exists**, free online — but with **no confirmed
  self-serve REST endpoint or API key** today (access is currently web-UI preview + sales-gated
  API). So the exact endpoint/auth/return schema is **not yet known.**

**Consequence:** develop and test against a **mock**. Put the real endpoint/auth/params/return
schema behind **one config object + one mapping function**, both marked `<FILL-IN>`, so the real
REST schema drops in the moment access is provisioned — without touching the fused retriever or
the endpoint. Target the **free financial-preview scope** first (it's what you can sign up for).

---

## 1. Transport-agnostic external source

```ts
// One thin interface. Everything below it is swappable; everything above it
// (the fused retriever) never knows or cares which transport is live.
export interface ExternalSource {
  query(q: string, opts?: ExternalOpts): Promise<RawFact[]>;
}

export interface RawFact {
  summary: string;     // the fact text
  source: string;      // the source's own attribution string  → becomes citation
  license: string;     // the source's usage terms             → becomes license_note
  relevance: number;   // the source's native score             → becomes score (raw)
}

export interface YottaGraphConfig {
  transport: "mcp" | "rest";   // REST is the default (see §0)
  // <FILL-IN> — populated once Lovelace access is confirmed:
  endpoint?: string;           // REST base URL (financial-preview scope first)
  toolName?: string;           // MCP tool name, if MCP ever applies
  apiKey?: string;             // from env; never hardcode
  // ...exact params live here, behind the one mapping function below.
}
```

Two impls choose off `config.transport`:

- **`RestYottaGraph`** (default) — HTTP call to `endpoint`. Exact request params + response shape
  are isolated in **one `mapRawFact()` function** marked `<FILL-IN>`.
- **`McpYottaGraph`** (alternate) — same interface, MCP tool call; unused unless Lovelace turns
  out to expose MCP. Kept so the choice is config, not a rewrite.

Both produce `RawFact[]`. A single mapper turns each `RawFact` into an **external `Chunk`**:

```ts
// citation = fact.source ; provider = "yottagraph" ; license_note = fact.license
function toExternalChunk(f: RawFact): Extract<Chunk, { source: "external" }> {
  return {
    source: "external",
    provider: "yottagraph",
    citation: f.source,         // GATE 2 (doc 09 §2): provider + citation are mandatory
    license_note: f.license,
    text: f.summary,
    score: f.relevance,         // raw scale — normalized in §4 before fusion
  };
}
```

**Mock for development:** a `MockYottaGraph` returning `{summary, source, license, relevance}`
fixtures (including a deliberately poisoned one for the injection test, §6). All tests run against
the mock — no live dependency.

---

## 2. The fused retriever

`FusedRetriever implements Retriever` (doc 09 §3). It runs the internal retriever and the external
source **in parallel** and merges them — but every safety gate fires before anything reaches the
answer.

### 2.1 Graceful degradation (the endpoint must always answer)

```ts
const [internal, external] = await Promise.all([
  this.internal.retrieve(query, opts),
  this.allowExternal(opts)
    ? this.external.query(query).then(facts => facts.map(toExternalChunk))
        .catch(() => [])      // external failure → [], NEVER throws
    : Promise.resolve([]),
]);
```

If YottaGraph is **down, unauthed, over budget, or disabled**, `external` collapses to `[]` and
the endpoint still answers from the Constellation index. External knowledge is **additive, never
load-bearing.**

### 2.2 `allowExternal()` — defaults to **owner-only**

```ts
// External sources are EXCLUDED from paid third-party answers unless we actually
// hold redistribution rights. Reason (registry/SPEC §2, doc 06 §2): re-serving a
// third party's facts in something we SELL is redistribution — only permitted if
// config.redistributionRightsHeld === true. Default: owner's own use only.
allowExternal(opts?: RetrieveOpts): boolean {
  if (!this.config.externalEnabled) return false;        // master switch, default OFF
  if (opts?.paid && !this.config.redistributionRightsHeld) return false; // paid gate
  return true;
}
```

Default posture: **external is off**, and even when on, it is **excluded from paid answers**
unless redistribution rights are explicitly held.

### 2.3 External share cap

After fusion, external chunks may occupy at most `externalShare` of the result set (**default
0.4**). The answer stays *anchored in the owner's own knowledge*; YottaGraph enriches, it doesn't
dominate.

### 2.4 The two gates fire here

- **Gate 1 (internal):** drop any internal chunk whose `planet_id` doesn't resolve in the
  registry. (Private-leak guard — doc 09 §2.)
- **Gate 2 (external):** drop any external chunk missing `provider` **or** `citation`.

---

## 3. (reserved — see §4 for ranking)

---

## 4. Fusion ranking — done properly, not a stub

Internal and external scores are on **different scales** (a cosine similarity, a graph-relevance
number, a BM25 score — incomparable as raw values). Concatenating and applying a "small bias" to
raw scores is **wrong**: ordering would be an artifact of whichever source happens to emit bigger
numbers. The required algorithm:

1. **Normalize per source, before merging.** For each source independently, map its chunk scores
   to a common scale — **min-max** to `[0,1]` (default) or **z-score**. Internal is normalized
   against internal; external against external. Now the numbers are comparable.
2. **Apply the internal bias *after* normalization.** A small configurable `internalBias`
   (default e.g. `+0.05`, or a multiplier) nudges the owner's own knowledge up *on the normalized
   scale* — a deliberate, documented thumb on the scale, not a scale artifact.
3. **Dedupe across sources.** Two ways, both applied:
   - (a) **exact text hash** — identical text from two sources collapses to one chunk (keep the
     higher-normalized, prefer internal on ties so provenance stays with the owner);
   - (b) **optional embedding cosine** — if an embedder is configured, near-duplicates above
     `dedupeCosineThreshold` (default e.g. 0.95) also collapse. Off when no embedder is set.
4. **Sort by the final fused score**, then enforce the §2.3 external-share cap (trim lowest-ranked
   external chunks first if over cap).

```ts
function fuse(internal: Chunk[], external: Chunk[], cfg: FusionConfig): Chunk[] {
  const ni = normalize(internal, cfg.method);   // min-max | zscore, per source
  const ne = normalize(external, cfg.method);
  const biased = ni.map(c => ({ ...c, score: c.score + cfg.internalBias })); // AFTER normalize
  let merged = dedupe([...biased, ...ne], cfg);  // exact-hash + optional cosine
  merged.sort((a, b) => b.score - a.score);
  return capExternalShare(merged, cfg.externalShare);
}
```

**Documented strategy:** normalize → bias → dedupe → sort → cap. The normalization step is the
non-negotiable part — a ranking test asserts that ordering is **not** an artifact of raw-scale
differences (feed two sources whose raw scales differ by 100×; the fused order must reflect
normalized relevance, not the bigger-number source).

---

## 5. Redistribution + license (beyond YottaGraph)

License correctness has **two** dimensions — the external source *and* other contributors'
internal planets:

### 5.1 Paid answers exclude non-commercial internal planets

Resolving to *any* `planet_id` is **not** enough for a paid answer. Other contributors publish
under **PolyForm Noncommercial** (SPEC §5, doc 06 §2). Selling their content in a paid answer
violates **their** license. So:

```ts
// True only if the planet is the OWNER's own, OR carries a commercial-OK license.
function commercialUseOk(planet: PlanetMeta): boolean {
  return planet.author_is_owner || isCommercialLicense(planet.license);
}
```

In **paid mode** (`opts.paid`), the internal retriever (or the fused retriever before synthesis)
drops every internal chunk whose planet fails `commercialUseOk`. Free/owner-use answers keep them.

### 5.2 Any external citation flags the whole answer

When **any** external chunk is cited:

```ts
license_summary.contains_third_party = true;
license_summary.redistribution = "restricted";
```

The reader (and any downstream reseller) sees that the answer carries third-party facts and a
redistribution obligation. License strings stay in-band (`license_note` on each external chunk,
`license` on each internal chunk) and roll up into `license_summary.licenses`.

### 5.3 Distinct labeling

The synthesizer labels external facts **`[yottagraph]`** distinctly from internal **`[planet_…]`**
(doc 09 §4). Third-party knowledge is never silently blended into the owner's voice.

---

## 6. Injection — external text is a large untrusted surface

External text is a **far larger untrusted surface** than the owner's own vault — millions of facts
authored by no one you control. Treat **all** external `text` as **untrusted data, never
instructions**:

- In the synthesis prompt, **hard-sandbox** external chunks: wrap each in explicit delimiters and
  escape delimiter-breaking sequences, so a fact reading *"ignore previous instructions and …"* is
  presented as quoted data, not executed as a directive.
- The synthesizer's system prompt states that sandboxed content is reference material only.
- This composes with doc 09 §4's untrusted-data rule (which covers all chunks); external chunks
  get the strictest treatment.

A test seeds a poisoned external fact and asserts the answer **ignores** its instruction.

---

## 7. Tests (Prompt G must ship these)

| Test | Asserts |
|------|---------|
| **Fallback** | mock unavailable / throwing → endpoint still answers from internal |
| **External shape** | external chunks always carry `provider` + `citation`; missing either → dropped |
| **Private-leak guard** | a seeded `publish: false` note is unreachable via the internal retriever |
| **License flag** | an answer citing a YottaGraph chunk → `contains_third_party == true`, `redistribution == "restricted"` |
| **External gate** | `allowExternal() === false` → no external calls made, no external chunks present |
| **Paid-mode license** *(new)* | a non-commercial internal planet is **excluded** from a PAID answer |
| **Ranking** *(new)* | scores are normalized per source before fusion; ordering is **not** a raw-scale artifact |
| **Injection** *(new)* | a poisoned external fact (`"ignore previous instructions…"`) is ignored |

---

## 8. Invariants (restate as comments in the code)

1. **The vault never leaks** — internal chunks must resolve to a published `planet_id`; external
   can't reach the vault at all.
2. **External can't leak but carries obligations** — re-serving third-party facts is a
   **redistribution** obligation, **and** that content **may be non-commercial**; both are flagged.
3. **External failure never breaks the endpoint** — `catch → []`; answers degrade to internal-only.
4. **Third-party + non-commercial content is flagged** — `contains_third_party`,
   `redistribution: "restricted"`, and paid-mode exclusion of non-commercial internal planets.
5. **Retrieved content is data, not instructions** — all chunk text sandboxed; external strictest.
6. **External defaults to owner-only** — `externalEnabled` off by default; excluded from paid
   answers unless `redistributionRightsHeld === true`.

---

## Build order (corrected)

```
A  Registry backend        (registry/server/)          ─ planets have a home
│
C  Publish/pull client     (the /publish command)      ─ planets get published, private fields stripped
│
F  Observatory             (observatory/server/)        ─ retrieve + synthesize over published planets (doc 09)
│
G  YottaGraph + fusion     (retrievers/{yottagraph,fused}.ts) ─ fuse an external source (this doc)
```

**A → C → F → G.** G cannot precede F (nothing to fuse into), and F cannot precede A + C (the
internal retriever has no published index to read). Prompt G stays unwritten until F exists; this
doc is the contract it implements.

---

## Related

- [09 — Observatory agent query endpoint](09-observatory-agent-query-endpoint.md) — the Chunk /
  Retriever / Synthesizer interfaces this consumes.
- `registry/SPEC.md` — node manifest (§2), trust & license-in-band (§5), marketplace (§7).
- [06 — IP & licensing](06-ip-and-licensing.md) — why other contributors' Noncommercial content
  can't be resold.
