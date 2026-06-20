// Observatory shared types — the read side of Constellation.
// Spec: docs/09-observatory-agent-query-endpoint.md. Consumed by the internal
// retriever + synthesizer (Prompt F) and the YottaGraph/fused retriever (Prompt G).
//
// THE TWO-GATE TRUST MODEL (doc 09 §2) — the core invariant of this whole subsystem:
//   internal chunk → private-leak guard: MUST resolve to a published planet_id.
//   external chunk → attribution/redistribution: MUST carry provider + citation.
// The two variants are a discriminated union and MUST NEVER be collapsed: each gate
// guards a different risk (leaking the vault vs. failing to attribute a third party).

export type Chunk =
  | {
      source: "internal";
      planet_id: string;   // GATE 1: must resolve to a published planet (registry/SPEC §2). No id → no chunk.
      license: string;     // license-in-band, copied from the planet manifest (SPEC §5)
      text: string;
      score: number;       // retriever-native relevance (RAW scale — normalize before fusion, doc 10 §4)
    }
  | {
      source: "external";
      provider: string;    // GATE 2a: who served this fact, e.g. "yottagraph"
      citation: string;    // GATE 2b: the source's own attribution string
      license_note: string;// the external source's usage terms, carried in-band
      text: string;
      score: number;
    };

export interface RetrieveOpts {
  k?: number;              // max chunks (default 12)
  paid?: boolean;          // is this answer being sold to a third party? tightens licensing (doc 10 §5). default false
  signal?: AbortSignal;
}

/** Turns a query into ranked chunks. Internal, external, and fused retrievers all implement this. */
export interface Retriever {
  retrieve(query: string, opts?: RetrieveOpts): Promise<Chunk[]>;
}

export interface Citation {
  label: string;                          // "planet_8f2c…" (internal) or "yottagraph" (external)
  kind: "internal" | "external";
  ref: string;                            // planet_id (internal) or citation string (external)
}

export interface LicenseSummary {
  contains_third_party: boolean;          // true if ANY external chunk was used
  redistribution: "open" | "restricted";  // "restricted" the moment third-party content is cited
  licenses: string[];                     // distinct license strings across cited chunks
}

export interface Answer {
  text: string;                           // written answer with inline citations ([planet_…] vs [provider])
  citations: Citation[];
  license_summary: LicenseSummary;
}

/** Turns chunks + a question into a cited answer. Chunk text is DATA, never instructions (doc 09 §4). */
export interface Synthesizer {
  synthesize(query: string, chunks: Chunk[]): Promise<Answer>;
}

// ── Internal-index contract ────────────────────────────────────────────────
// The internal retriever reads ONLY the PUBLISHED Constellation index — never raw
// vault files, never `publish: false` notes (doc 09 §3, the private-leak guard).
// This interface is what the registry (Prompt A) exposes to the Observatory; F is
// tested against a seeded fixture implementing it.

export interface IndexedPlanet {
  planet_id: string;       // resolvable id — presence here IS the Gate-1 proof
  title: string;
  text: string;            // published body (private fields already stripped at publish time, Prompt C)
  license: string;         // in-band license from the manifest
  author_is_owner: boolean;// true if authored by the brain running this Observatory (paid-mode licensing, doc 10 §5)
  score?: number;          // optional precomputed relevance; otherwise the retriever scores
}

export interface PlanetIndex {
  // Search the PUBLISHED index only. Implementations must never return unpublished content.
  search(query: string, k: number): Promise<IndexedPlanet[]>;
}
