// Constellation node (planet) manifest types.
// MUST stay in sync with ../schema/node.schema.json — the schema is the source of
// truth; validate.ts (Prompt A) enforces it at the API boundary.
//
// Cosmology (registry/SPEC.md §1): a PLANET is one published note; a MOON is a fork
// of a planet that still credits its origin. A note appears in the Universe ONLY if
// its owner published it — private notes are never indexed (SPEC §5, the leak guard).

export interface Author {
  handle: string;            // the brain's public handle, e.g. "dom"
  display?: string;          // optional display name
  star: string;              // stable id for the author's brain ("solar system")
}

export interface Price {
  amount: number;            // >= 0
  currency: string;
  // Buying grants this license on the node, overriding the Noncommercial default
  // per-node (SPEC §7). This is the hook Observatory paid-mode reads to decide
  // commercial reuse (doc 10 §5: commercialUseOk).
  grants_license: string;
}

/**
 * The published manifest. Content-addressed `id`, license carried in-band,
 * signed so authorship can't be spoofed (SPEC §2, §5).
 */
export interface NodeManifest {
  id: string;                // content-addressed, stable: "planet_<hash>"
  title: string;
  summary?: string;          // public abstract shown in the universe view
  author: Author;
  galaxy?: string[];         // topic/org clusters
  license: string;           // SPDX-like id, e.g. "PolyForm-Noncommercial-1.0.0"
  links?: string[];          // outbound planet ids (resolved wiki-links)
  origin?: string | null;    // source planet id if this is a fork (moon); else null
  content_hash: string;      // "sha256:<64 hex>"
  signature?: string;        // author signature over the manifest
  published_at: string;      // ISO-8601
  version: number;           // >= 1
  price?: Price | null;      // omit/null for free planets
}

/** A stored planet = its manifest + the note body the registry serves on fetch. */
export interface StoredPlanet {
  manifest: NodeManifest;
  body: string;              // the published note markdown (private fields already stripped by Prompt C)
}
