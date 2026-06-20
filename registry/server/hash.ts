// Content-addressing & hashing for Constellation planets.
//
// The anti-theft property (SPEC §5): a planet's `id` is derived from its
// canonical manifest content (minus the `id` and `signature` themselves) plus
// its body hash carried in `content_hash`. Identical content yields an
// identical id; copied text published under a new author still hashes
// differently because the author/star fields are part of the canonical form —
// so a thief's copy gets a *different* id with no lineage, and the original
// keeps the earliest `published_at`. First-publish wins on provenance.

import { createHash } from "node:crypto";
import type { NodeManifest } from "./types.ts";

// Fields that are NOT part of the content-addressed identity. `id` is the
// output we are deriving, and `signature` is computed over the same canonical
// form (so it cannot be an input to itself).
const IDENTITY_EXCLUDED = new Set<string>(["id", "signature"]);

// Excluded from the ID-DERIVATION payload: the above PLUS the per-publish-event
// metadata. The id is CONTENT-addressed (SPEC §5) — title, author, body (via
// content_hash), license, galaxy, links, origin — NOT *when* it was published or
// *which* version. So re-publishing the same body yields the SAME id
// (first-publish-wins; no duplicate), even across separate publish runs. The
// signature still covers published_at + version (they stay in canonicalManifest),
// so the timestamp can't be tampered with.
const ID_EXCLUDED = new Set<string>(["id", "signature", "published_at", "version"]);

// Length (in hex chars) of the id suffix. Long enough to be collision-safe for
// a content-addressed registry, short enough to stay human-glanceable.
const ID_HEX_LEN = 40;

/**
 * Deterministically serialise an arbitrary JSON value with object keys sorted
 * recursively. This is the canonical form everything (id, signature) is
 * computed over, so it must be stable across machines and runs.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortValue(obj[key]);
  }
  return out;
}

/**
 * Canonical JSON of a manifest with the identity-excluded fields removed.
 * Used as the signing payload (keys.ts) and the id-derivation payload.
 */
export function canonicalManifest(manifest: NodeManifest): string {
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(manifest)) {
    if (IDENTITY_EXCLUDED.has(key)) continue;
    clone[key] = val;
  }
  return canonicalize(clone);
}

/** sha256 of an arbitrary body string, formatted as "sha256:<64 hex>". */
export function contentHash(body: string): string {
  const digest = createHash("sha256").update(body, "utf8").digest("hex");
  return `sha256:${digest}`;
}

/**
 * Derive the content-addressed planet id from the canonical manifest (minus
 * id/signature). Because `content_hash` is part of the manifest, the body is
 * transitively bound into the id too.
 */
export function planetId(manifest: NodeManifest): string {
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(manifest)) {
    if (ID_EXCLUDED.has(key)) continue; // content identity only — not publish time/version
    clone[key] = val;
  }
  const digest = createHash("sha256")
    .update(canonicalize(clone), "utf8")
    .digest("hex");
  return `planet_${digest.slice(0, ID_HEX_LEN)}`;
}
