// manifest.ts — assemble a content-addressed NodeManifest from a stripped note.
//
// The id is derived from the canonical manifest (minus id/signature) via the
// registry's shared hash.ts, so the client and server agree on identity. Because
// `content_hash` (the sha256 of the body) is part of the canonical manifest, the
// body is transitively bound into the id: same body + same metadata => same id;
// any change to the body => a different id (SPEC §5, anti-theft / provenance).

import type { Author, NodeManifest } from "../registry/server/types.ts";
import { contentHash, planetId } from "../registry/server/hash.ts";
import type { StrippedNote } from "./strip.ts";

export const DEFAULT_LICENSE = "PolyForm-Noncommercial-1.0.0";

export interface BuildManifestOptions {
  /** Defaults to 1. Bump when re-publishing edits to the same logical note. */
  version?: number;
  /** ISO-8601 publish time. Defaults to now (injectable for deterministic tests). */
  publishedAt?: string;
  /**
   * Lineage. If this note is a moon (a fork of a pulled planet), pass the origin
   * planet id; it is recorded in the manifest and is NON-REMOVABLE (SPEC §4).
   * A frontmatter `origin: planet_…` in the stripped note also sets this; the
   * explicit option wins, but neither can clear an existing lineage to null.
   */
  origin?: string | null;
  /** Override the license. Falls back to the note's, then the Noncommercial default. */
  license?: string;
}

/** The manifest plus the body the registry will store/serve (SPEC §6). */
export interface BuiltPlanet {
  manifest: NodeManifest;
  body: string;
}

/**
 * Build a complete, content-addressed manifest. The caller supplies the author
 * (the publishing brain's identity); everything else comes from the stripped,
 * privacy-cleaned note.
 */
export function buildManifest(
  stripped: StrippedNote,
  author: Author,
  opts: BuildManifestOptions = {},
): BuiltPlanet {
  const body = stripped.body;

  const title = stripped.fields.title;
  if (!title || title.trim() === "") {
    throw new Error("Cannot build manifest: note has no publishable `title`.");
  }

  // Lineage resolution: explicit option > frontmatter origin > none. Credit is
  // non-removable — a moon being re-published keeps pointing at the original.
  const origin = resolveOrigin(opts.origin, stripped.fields.origin);

  // Assemble the manifest WITHOUT id/signature first; those are derived from the
  // canonical form of everything else.
  const draft: NodeManifest = {
    id: "", // filled in after derivation
    title,
    author,
    license: opts.license ?? stripped.fields.license ?? DEFAULT_LICENSE,
    content_hash: contentHash(body),
    published_at: opts.publishedAt ?? new Date().toISOString(),
    version: opts.version ?? 1,
    origin,
  };

  // Optional manifest fields — only set when present (keep canonical form tight).
  if (stripped.fields.summary !== undefined) draft.summary = stripped.fields.summary;
  if (stripped.fields.galaxy !== undefined) draft.galaxy = stripped.fields.galaxy;
  if (stripped.links.length > 0) draft.links = stripped.links;

  draft.id = planetId(draft);
  return { manifest: draft, body };
}

function resolveOrigin(
  explicit: string | null | undefined,
  fromFrontmatter: string | null | undefined,
): string | null {
  if (typeof explicit === "string" && explicit.startsWith("planet_")) return explicit;
  if (typeof fromFrontmatter === "string" && fromFrontmatter.startsWith("planet_")) {
    return fromFrontmatter;
  }
  return null;
}
