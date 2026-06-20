// pull.ts — importing someone else's planet as a linked copy / "moon" (SPEC §4).
//
// A pulled planet lands in `70-learning/imported/` with frontmatter `origin:
// planet_…`, `author: …`, and a credit banner. Local edits create a new version
// you MAY re-publish as your own moon — which still records `origin` → the
// original. Credit is non-removable: re-publishing keeps the lineage.

import type { StoredPlanet } from "../registry/server/types.ts";
import { serializeNote } from "./frontmatter.ts";

/** Where pulled moons land, by convention (SPEC §4). */
export const IMPORTED_DIR = "70-learning/imported";

export interface MoonNote {
  /** Suggested relative path under the vault (IMPORTED_DIR/<slug>.md). */
  path: string;
  /** Full note text (frontmatter + credit banner + body) ready to write. */
  contents: string;
  /** The origin planet id this moon credits (non-removable). */
  origin: string;
}

/**
 * Produce a linked-copy ("moon") note from a fetched planet. The origin and
 * author credit are baked into both the frontmatter and a visible banner.
 */
export function pull(planet: StoredPlanet): MoonNote {
  const { manifest, body } = planet;
  const author = manifest.author;
  const authorLabel = author.display ?? author.handle;

  // The moon's lineage points at THIS planet. If the planet is itself a moon
  // (has its own origin), we still credit the planet we pulled from directly —
  // the registry's lineage graph chains the rest (SPEC §5).
  const origin = manifest.id;

  const frontmatter: Record<string, unknown> = {
    title: manifest.title,
    origin,                      // ← non-removable lineage pointer
    author: authorLabel,
    handle: author.handle,
    star: author.star,
    license: manifest.license,
    // Default to NOT re-publishing on import — the pull is for your own use
    // until you explicitly opt back in (SPEC §3 default).
    publish: false,
  };
  if (manifest.summary) frontmatter["summary"] = manifest.summary;
  if (manifest.galaxy?.length) frontmatter["galaxy"] = `[${manifest.galaxy.join(", ")}]`;

  const banner = creditBanner(manifest.id, authorLabel, author.handle);
  const contents = serializeNote(frontmatter, `${banner}\n\n${body}`);

  return {
    path: `${IMPORTED_DIR}/${slugify(manifest.title)}.md`,
    contents,
    origin,
  };
}

/**
 * Build the manifest-build options that preserve a moon's lineage when it is
 * re-published. Pass the result's `origin` into buildManifest so credit is kept
 * (SPEC §4: credit non-removable). The frontmatter `origin` also carries it, so
 * this is a belt-and-suspenders helper for callers that build manifests directly.
 */
export function republishOriginFor(moonOrigin: string): string {
  return moonOrigin;
}

function creditBanner(planetId: string, display: string, handle: string): string {
  return [
    `> 🌙 **Imported moon** — linked copy of planet \`${planetId}\``,
    `> Original by **${display}** (@${handle}). Credit travels with this node and`,
    "> cannot be removed: re-publishing your edits keeps `origin` pointing here.",
  ].join("\n");
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "imported-planet"
  );
}
