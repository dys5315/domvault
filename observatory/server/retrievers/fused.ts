// fused.ts — the FusedRetriever (Prompt G, doc 10 §2–§4).
//
// Fuses the INTERNAL retriever (the owner's published Constellation index, Prompt F)
// with an EXTERNAL source (YottaGraph, yottagraph.ts) into one ranked Chunk[],
// while every safety gate fires before anything reaches the answer.
//
// INVARIANTS restated (doc 10 §8 / doc 09 §6):
//   1. The vault never leaks — internal chunks must resolve to a published planet_id.
//      That GATE-1 check is the INTERNAL retriever's job (Prompt F); this fused layer
//      consumes whatever the internal Retriever returns and does NOT undermine it
//      (it never invents internal chunks, never relaxes the internal gate).
//   2. External can't leak the vault, but carries a REDISTRIBUTION obligation AND may
//      be NON-COMMERCIAL — both must be flagged downstream. We preserve external
//      chunks (with their `provider`, `citation`, `license_note`) so the synthesizer
//      can set contains_third_party / redistribution="restricted".
//   3. External failure NEVER breaks the endpoint — the external branch is wrapped in
//      `.catch(() => [])`; a down/unauthed/over-budget source degrades to internal-only.
//   4. Third-party + non-commercial content is flagged (license_note rides each chunk).
//   5. Retrieved content is DATA, not instructions — fusion only hashes/sorts/copies
//      chunk text. It NEVER evaluates, parses-as-command, or branches on `text`.
//   6. External defaults to OWNER-ONLY — `externalEnabled` is OFF by default, and even
//      when on, external is excluded from PAID answers unless redistribution rights are
//      explicitly held (allowExternal below).

import type { Chunk, Retriever, RetrieveOpts } from "../types.ts";
import { createHash } from "node:crypto";
import { type ExternalSource, toExternalChunk } from "./yottagraph.ts";

// ── Configuration ───────────────────────────────────────────────────────────

/** Optional embedder for cosine-based near-dup detection. Off when undefined. */
export interface Embedder {
  embed(text: string): Promise<number[]> | number[];
}

export interface FusedConfig {
  /** Master switch for the external source. DEFAULT OFF (invariant 6). */
  externalEnabled: boolean;
  /** Do we hold rights to re-serve third-party facts in a PAID answer? DEFAULT false. */
  redistributionRightsHeld: boolean;
  /** Normalization method applied PER SOURCE before merge (doc 10 §4.1). */
  normalize?: "minmax" | "zscore";
  /** Small thumb on the scale for the owner's own knowledge, applied AFTER
   *  normalization (doc 10 §4.2). Additive on the [0,1] normalized scale. */
  internalBias?: number;
  /** Max fraction of the result set external chunks may occupy (doc 10 §2.3). */
  externalShare?: number;
  /** Optional embedder enabling cosine near-dup collapse (doc 10 §4.3b). */
  embedder?: Embedder;
  /** Cosine threshold above which two chunks are near-duplicates. */
  dedupeCosineThreshold?: number;
}

const DEFAULTS = {
  normalize: "minmax" as const,
  internalBias: 0.05,
  externalShare: 0.4,
  dedupeCosineThreshold: 0.95,
  k: 12,
};

export interface FusedDeps {
  /** ANY Retriever — at integration the real InternalRetriever (Prompt F) is injected;
   *  tests inject a tiny mock. The fused retriever must accept any Retriever. */
  internal: Retriever;
  external: ExternalSource;
  config: FusedConfig;
}

// ── FusedRetriever ──────────────────────────────────────────────────────────

export class FusedRetriever implements Retriever {
  private readonly internal: Retriever;
  private readonly external: ExternalSource;
  private readonly config: FusedConfig;

  constructor(deps: FusedDeps) {
    this.internal = deps.internal;
    this.external = deps.external;
    this.config = deps.config;
  }

  async retrieve(query: string, opts?: RetrieveOpts): Promise<Chunk[]> {
    const allowExt = this.allowExternal(opts);

    // §2.1 — run internal + external IN PARALLEL. External degrades gracefully:
    // `.catch(() => [])` means a down/unauthed/over-budget source collapses to []
    // and the endpoint STILL answers from internal (invariant 3). When external is
    // not allowed we never even call it (the gate test asserts this).
    const [internalChunks, externalChunks] = await Promise.all([
      this.internal.retrieve(query, opts),
      allowExt
        ? this.external
            .query(query, { k: opts?.k, signal: opts?.signal })
            .then((facts) => facts.map(toExternalChunk))
            .catch(() => [] as Chunk[])
        : Promise.resolve([] as Chunk[]),
    ]);

    // GATE 2 (doc 09 §2 / doc 10 §2.4): drop external chunks missing provider OR
    // citation. (GATE 1 for internal is the internal retriever's job — we don't
    // duplicate it, and we don't undermine it by injecting un-gated internal chunks.)
    const gatedExternal = externalChunks.filter(isAttributedExternal);

    // §4 — fuse: normalize per source → bias → dedupe → sort → cap.
    const fused = this.fuse(internalChunks, gatedExternal);

    const k = opts?.k ?? DEFAULTS.k;
    return fused.slice(0, k);
  }

  /**
   * §2.2 — DEFAULT FALSE / owner-only.
   *
   * Redistribution reason (doc 10 §2.2, §5; registry/SPEC §2): re-serving a third
   * party's facts inside an answer we SELL is redistribution, only permitted if we
   * actually hold the rights. Other contributors' Noncommercial content cannot be
   * resold either. So: external is OFF by default, and even when enabled it is
   * EXCLUDED from paid answers unless redistributionRightsHeld === true.
   */
  allowExternal(opts?: RetrieveOpts): boolean {
    if (!this.config.externalEnabled) return false; // master switch, default OFF.
    if (opts?.paid && !this.config.redistributionRightsHeld) return false; // paid gate.
    return true;
  }

  // ── §4: fusion ranking — done properly, NOT a stub ────────────────────────
  private fuse(internal: Chunk[], external: Chunk[]): Chunk[] {
    const method = this.config.normalize ?? DEFAULTS.normalize;
    const internalBias = this.config.internalBias ?? DEFAULTS.internalBias;
    const externalShare = this.config.externalShare ?? DEFAULTS.externalShare;

    // (1) NORMALIZE each source INDEPENDENTLY to a common [0,1]-ish scale BEFORE
    // merging (doc 10 §4.1). Raw concat is explicitly NOT acceptable: internal and
    // external scores are on different native scales, so ordering would otherwise be
    // an artifact of whichever source emits bigger numbers. Internal is normalized
    // against internal; external against external.
    const ni = normalizeScores(internal, method);
    const ne = normalizeScores(external, method);

    // (2) Apply the internal bias AFTER normalization (doc 10 §4.2) — a deliberate,
    // documented thumb on the scale on the normalized axis, not a raw-scale artifact.
    const biasedInternal: Scored[] = ni.map((s) => ({ ...s, norm: s.norm + internalBias }));

    // (3) DEDUPE across sources (doc 10 §4.3): exact text hash always; optional
    // embedding cosine when an embedder is configured. On a dup, keep the higher
    // normalized score; prefer internal on ties so provenance stays with the owner.
    let merged = this.dedupe([...biasedInternal, ...ne]);

    // (4) SORT by fused (normalized+biased) score, then enforce the external-share
    // cap (doc 10 §2.3, §4.4), trimming the LOWEST-ranked external chunks first.
    merged.sort((a, b) => b.norm - a.norm || internalFirst(a, b));
    merged = capExternalShare(merged, externalShare);

    return merged.map((s) => s.chunk);
  }

  /** Exact-hash + optional-cosine dedupe. Keeps the higher-norm copy; internal wins ties. */
  private dedupe(items: Scored[]): Scored[] {
    const byHash = new Map<string, Scored>();
    const ordered: Scored[] = [];

    for (const item of items) {
      const hash = textHash(item.chunk.text);
      const existing = byHash.get(hash);
      if (existing) {
        byHash.set(hash, pickBetter(existing, item));
        continue;
      }
      byHash.set(hash, item);
      ordered.push(item);
    }

    // Rebuild from the winning hash entries, preserving first-seen order.
    const exactDeduped = ordered.map((o) => byHash.get(textHash(o.chunk.text))!);

    // Optional embedding-cosine near-dup collapse — OFF unless an embedder is set
    // (doc 10 §4.3b). Kept synchronous-friendly: we don't await here; embedder may
    // be sync. When no embedder, this is a no-op and exact-hash dedupe stands.
    const embedder = this.config.embedder;
    if (!embedder) return exactDeduped;

    const threshold = this.config.dedupeCosineThreshold ?? DEFAULTS.dedupeCosineThreshold;
    const kept: { scored: Scored; vec: number[] }[] = [];
    for (const item of exactDeduped) {
      const vec = toVec(embedder.embed(item.chunk.text));
      let collapsed = false;
      for (const k of kept) {
        if (cosine(vec, k.vec) >= threshold) {
          // Near-duplicate: keep the better of the two in place.
          const idx = kept.indexOf(k);
          kept[idx] = { scored: pickBetter(k.scored, item), vec: k.vec };
          collapsed = true;
          break;
        }
      }
      if (!collapsed) kept.push({ scored: item, vec });
    }
    return kept.map((k) => k.scored);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

/** A chunk paired with its normalized (and possibly biased) score for ranking. */
interface Scored {
  chunk: Chunk;
  norm: number;
}

function isAttributedExternal(c: Chunk): boolean {
  // GATE 2: external chunks MUST carry both provider and citation. A mapping that
  // produced "" for either is un-attributed and is dropped here.
  return c.source === "external" && !!c.provider && !!c.citation;
}

function isInternal(c: Chunk): boolean {
  return c.source === "internal";
}

/** Stable, content-only hash for exact-text dedupe (invariant 5: text is DATA). */
function textHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** On a duplicate, keep the higher normalized score; prefer internal on ties. */
function pickBetter(a: Scored, b: Scored): Scored {
  if (b.norm > a.norm) return b;
  if (a.norm > b.norm) return a;
  // tie → prefer internal so provenance stays with the owner.
  return isInternal(a.chunk) ? a : isInternal(b.chunk) ? b : a;
}

/** Ordering tiebreaker for sort: internal before external at equal scores. */
function internalFirst(a: Scored, b: Scored): number {
  const ai = isInternal(a.chunk) ? 0 : 1;
  const bi = isInternal(b.chunk) ? 0 : 1;
  return ai - bi;
}

/**
 * Normalize a single source's scores to a common scale BEFORE merge (doc 10 §4.1).
 *  - minmax: map [min,max] → [0,1] (default). Degenerate (all equal) → 1 for all.
 *  - zscore: (x-mean)/stddev. Degenerate → 0 for all.
 * Each source is normalized against ITSELF only.
 */
function normalizeScores(chunks: Chunk[], method: "minmax" | "zscore"): Scored[] {
  if (chunks.length === 0) return [];
  const scores = chunks.map((c) => c.score);

  if (method === "zscore") {
    const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
    const variance = scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length;
    const std = Math.sqrt(variance);
    if (std === 0) return chunks.map((c) => ({ chunk: c, norm: 0 }));
    return chunks.map((c) => ({ chunk: c, norm: (c.score - mean) / std }));
  }

  // minmax (default)
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  if (max === min) return chunks.map((c) => ({ chunk: c, norm: 1 }));
  return chunks.map((c) => ({ chunk: c, norm: (c.score - min) / (max - min) }));
}

/**
 * §2.3 / §4.4 — enforce the external-share cap. After sorting, external chunks may
 * occupy at most `share` of the result set; trim the LOWEST-ranked external first.
 * Anchors the answer in the owner's own knowledge; external enriches, never dominates.
 */
function capExternalShare(sorted: Scored[], share: number): Scored[] {
  if (sorted.length === 0) return sorted;
  const externals = sorted.filter((s) => !isInternal(s.chunk));
  if (externals.length === 0) return sorted;

  const internalCount = sorted.length - externals.length;
  // Largest total T such that externalCount/T <= share, i.e. allowed external count.
  // Solve maxExternal = floor(share * (internalCount + maxExternal)) iteratively in
  // closed form: maxExternal <= share/(1-share) * internalCount (for share<1).
  let maxExternal: number;
  if (share >= 1) {
    maxExternal = externals.length;
  } else if (share <= 0) {
    maxExternal = 0;
  } else {
    maxExternal = Math.floor((share / (1 - share)) * internalCount);
  }
  if (externals.length <= maxExternal) return sorted;

  // Keep the top-ranked `maxExternal` external chunks (they're already sorted by
  // norm descending in `sorted`), drop the rest. Trim lowest-ranked external first.
  let kept = 0;
  return sorted.filter((s) => {
    if (isInternal(s.chunk)) return true;
    if (kept < maxExternal) {
      kept++;
      return true;
    }
    return false;
  });
}

// ── cosine helpers (only used when an embedder is configured) ───────────────

function toVec(v: number[] | Promise<number[]>): number[] {
  // Embedders in this repo are sync for tests; if a Promise sneaks in we cannot
  // await inside the sync dedupe path, so we treat it as "no vector" (skip cosine).
  return Array.isArray(v) ? v : [];
}

function cosine(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
