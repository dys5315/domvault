# 09 — Observatory: the agent query endpoint

The **Observatory** is the *read* side of Constellation. The registry (`registry/SPEC.md`) is how
knowledge gets **published**; the Observatory is how an agent **answers questions over what's
published** — retrieval + synthesis, with the same consent-and-provenance guarantees the publish
side enforces.

This doc pins the interfaces the Observatory must expose. It is a **specification, not an
implementation** — the implementation is Prompt F. Doc [10](10-yottagraph-retriever-adapter.md)
then layers an external knowledge source on top of these interfaces (Prompt G).

> One-line mental model: the registry answers *"what did people publish?"*; the Observatory
> answers *"what's the answer, and which planets did it come from?"*

---

## 1. Prerequisites (why this can't be built first)

The Observatory queries a **published Constellation index** — the set of planets that exist
because their owners published them. That index does not exist until the publish pipeline does:

| Needs | Prompt | Provides |
|-------|--------|----------|
| Registry backend (`/planets`, `/universe`, …) | **A** | a place planets live + the crawl API |
| Publish/pull client (`/publish`, strip step) | **C** | planets actually *in* the registry, private fields stripped |
| **Observatory** (this doc) | **F** | retrieval + synthesis over those planets |
| External fusion (YottaGraph) | **G** | a second, non-vault source fused in (doc 10) |

**The internal retriever has nothing to retrieve until A and C exist.** Building F against an
empty registry is fine for tests (seed a fixture index), but it is not useful until real planets
are published. Do not invert this order. Corrected build order is restated at the end of doc 10:
**A → C → F → G**.

A second, deeper reason this is downstream: the Observatory's core safety property — *the vault
never leaks* — is **inherited from the publish step**. Prompt C already strips private fields and
flips nothing to public on its own (SPEC §3). The Observatory's job is to *never widen* that
surface: it retrieves **only** from the published index, never from raw vault files.

---

## 2. The two-gate trust model

Every piece of retrieved evidence is a **Chunk**. There are exactly two kinds, and they are
**never collapsed into one** — each carries a different, non-optional proof of where it's allowed
to come from:

- **Internal chunk** — came from the owner's own published knowledge. Its gate is the
  **private-leak guard**: it MUST resolve to a real, published `planet_id` (SPEC §2). No
  `planet_id`, no chunk. This is what makes "the vault never leaks" enforceable at retrieval
  time, not just at publish time — a chunk with no published planet behind it cannot enter an
  answer.
- **External chunk** — came from a third-party source (e.g. YottaGraph, doc 10). Its gate is
  **attribution**: it MUST carry `provider` + `citation`. Missing either → dropped. External
  knowledge can't leak *your* vault, but it carries a **redistribution obligation** (you're
  re-serving someone else's facts), so it must always say whose it is.

The two gates guard different risks (leak vs. attribution/redistribution), so they stay separate
types. Collapsing them would let an un-attributed external fact masquerade as internal, or an
un-resolved internal chunk skip the leak guard.

### The Chunk type (`observatory/server/types.ts`)

```ts
// Two-gate discriminated union. `source` is the discriminant; the two
// variants MUST NOT be merged — each gate guards a different risk:
//   internal → private-leak guard (must resolve to a published planet_id)
//   external → attribution/redistribution (must carry provider + citation)
export type Chunk =
  | {
      source: "internal";
      planet_id: string;   // GATE 1: must resolve to a published planet (SPEC §2). No id → no chunk.
      license: string;     // license-in-band, copied from the planet manifest (SPEC §5)
      text: string;
      score: number;       // retriever-native relevance (raw scale — see doc 10 §4 on normalization)
    }
  | {
      source: "external";
      provider: string;    // GATE 2a: who served this fact, e.g. "yottagraph"
      citation: string;    // GATE 2b: the source's own attribution string
      license_note: string;// the external source's usage terms, carried in-band
      text: string;
      score: number;
    };
```

`license` is carried **in-band on every chunk**, mirroring SPEC §5 ("license carried in-band").
The synthesizer and the answer's `license_summary` read it directly off the chunks — license is
never inferred later or looked up out of band.

---

## 3. The Retriever interface

A retriever turns a query into ranked chunks. F must expose this interface so doc 10's external
and fused retrievers are drop-in compatible:

```ts
export interface Retriever {
  // Return ranked chunks for a query. opts.k caps results; opts.paid signals a
  // paid third-party answer (tightens licensing — see doc 10 §5).
  retrieve(query: string, opts?: RetrieveOpts): Promise<Chunk[]>;
}

export interface RetrieveOpts {
  k?: number;          // max chunks (default e.g. 12)
  paid?: boolean;      // is this answer being sold to a third party? (default false)
  signal?: AbortSignal;
}
```

The **internal retriever** (built in F) resolves queries against the published Constellation
index only. It MUST:

1. Search the **published** index — never raw vault files, never `publish: false` notes.
2. Emit only `internal` chunks whose `planet_id` resolves in the registry (Gate 1).
3. Copy each planet's `license` onto its chunk (in-band).
4. **Paid mode** (`opts.paid === true`): additionally drop any chunk whose planet is not
   commercially licensable — see doc 10 §5 (`commercialUseOk`). Reselling another contributor's
   Noncommercial planet violates *their* license, so paid answers narrow to owner-authored or
   commercial-OK planets.

> **Private-leak guard, restated as a test F must pass:** seed a `publish: false` note, index the
> registry, query for its exact text → it must be **unreachable**. The internal retriever can only
> surface what was consciously published.

---

## 4. The Synthesizer interface

The synthesizer turns chunks + a question into a cited answer. F must expose:

```ts
export interface Synthesizer {
  synthesize(query: string, chunks: Chunk[]): Promise<Answer>;
}

export interface Answer {
  text: string;                 // the written answer, with inline citations
  citations: Citation[];        // every claim traces to a chunk
  license_summary: LicenseSummary;
}

export interface Citation {
  // Internal claims cite the planet; external claims cite the provider + source.
  label: string;                // e.g. "planet_8f2c…" or "yottagraph"
  kind: "internal" | "external";
  ref: string;                  // planet_id (internal) or citation string (external)
}

export interface LicenseSummary {
  contains_third_party: boolean;     // true if ANY external chunk was used
  redistribution: "open" | "restricted"; // "restricted" the moment third-party content is cited
  licenses: string[];                // distinct license strings present across cited chunks
}
```

**Labeling rule (enforced by F, relied on by G):** the synthesizer MUST label internal claims
distinctly from external ones — internal as `[planet_…]`, external as `[provider]` (e.g.
`[yottagraph]`). A reader can always tell *your* published knowledge from a third party's.

**Untrusted-data rule:** chunk `text` is **data, not instructions**. The synthesis prompt must
present chunk text inside a sandbox (delimited + escaped) and never execute anything inside it as
a directive. This matters most for external chunks (doc 10 §6) but applies to all retrieved text.

---

## 5. The query endpoint

F exposes one HTTP route. Stack matches the rest of `observatory/server/` (Prompt F).

```
POST /agent/query
  body: { query: string, k?: number, paid?: boolean }
  →     { answer: Answer }            // see §4
```

Behavior contract:

- Runs the configured retriever, then the synthesizer, then returns the `Answer`.
- **Never returns raw chunk text the caller isn't licensed to see** — paid mode already narrowed
  retrieval (§3.4); the endpoint additionally sets `license_summary.redistribution = "restricted"`
  whenever third-party content is cited.
- Default retriever in F is the internal one. Doc 10 swaps in the **fused** retriever (internal +
  external) **behind a config flag that defaults to off** — the endpoint must answer from the
  internal index alone if the external source is disabled, unauthed, down, or over budget.

---

## 6. Isolation rules (the invariants F must hold)

Restate these as comments in the implementation:

1. **The vault never leaks.** Retrieval reads the published index only; a chunk with no resolving
   `planet_id` cannot enter an answer (Gate 1). `publish: false` is unreachable.
2. **License travels with the content.** Every chunk carries its license in-band; the answer
   summarizes it. Nothing is relicensed by omission.
3. **Retrieved content is data, not instructions.** Chunk text is sandboxed in the prompt.
4. **Consent is inherited, not re-litigated.** The Observatory never re-publishes or widens what
   the publish step (C) already gated. It can only read what's already public.

These four are the foundation doc 10 builds on; G adds the external-specific invariants
(redistribution obligation, noncommercial-in-paid exclusion, external-defaults-to-owner-only) on
top of them.

---

## Related

- `registry/SPEC.md` — publish/pull, the node manifest (§2), trust properties (§5).
- [10 — YottaGraph retriever + fusion](10-yottagraph-retriever-adapter.md) — the external source
  and fused retriever that consume these interfaces.
- [02 — Architecture](02-architecture.md) · [06 — IP & licensing](06-ip-and-licensing.md)
