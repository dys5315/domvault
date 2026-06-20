// strip.ts — THE privacy boundary of the publish flow (SPEC §2, §3).
//
// "Nothing leaves a brain without its owner explicitly publishing it." This
// module is the gate that enforces that rule by CONSTRUCTION: instead of trying
// to enumerate and blacklist every private thing (impossible, fragile), it uses
// an ALLOWLIST. Only the small set of publishable manifest fields survive; every
// other frontmatter key is dropped, and the body is scrubbed of links/paths that
// point at things the user did not publish.
//
// If you are tempted to "just pass through" a field — don't. A blacklist leaks;
// an allowlist fails closed. The tests in publish.test.ts assert that arbitrary
// private fields never reach the manifest or body.

import { parseNote } from "./frontmatter.ts";

/** Frontmatter keys the publisher is allowed to read into the manifest. */
const PUBLISHABLE_FRONTMATTER_KEYS = new Set<string>([
  "title",
  "summary",
  "galaxy",
  "license",
  // `origin` is read from frontmatter ONLY to preserve a pulled moon's lineage
  // (SPEC §4: credit is non-removable). It is never invented here.
  "origin",
]);

/** Frontmatter keys that are meaningful to the flow but are NOT manifest fields. */
const CONTROL_KEYS = new Set<string>(["publish", "tags", "author"]);

export interface StrippedNote {
  /** Publishable manifest fields harvested from frontmatter (allowlist only). */
  fields: {
    title?: string;
    summary?: string;
    galaxy?: string[];
    license?: string;
    origin?: string | null;
  };
  /** Outbound links that resolve to already-published planets (planet ids). */
  links: string[];
  /** The cleaned, publishable body markdown. */
  body: string;
  /** Categories of private content that were removed (for the diff / report). */
  withheld: WithheldReport;
}

export interface WithheldReport {
  /** Frontmatter keys dropped because they aren't on the publish allowlist. */
  privateFrontmatterKeys: string[];
  /** Wiki-links to notes that are NOT published planets (unresolved). */
  unpublishedBacklinks: string[];
  /** Local filesystem paths found in the body. */
  localPaths: string[];
  /** Embedded attachments/transclusions not included in the publish. */
  attachments: string[];
  /** Frontmatter keys that look secret-bearing (token/key/secret/password…). */
  secretLikeKeys: string[];
}

/**
 * Map of local wiki-link target -> published planet id. Provided by the caller
 * (the vault knows which of its notes are already published). A target absent
 * from this map is treated as an UNPUBLISHED backlink and stripped.
 */
export type PublishedLinkResolver = (target: string) => string | undefined;

export interface StripOptions {
  /** Resolve a [[wiki-link]] target to a planet id, if it's published. */
  resolveLink?: PublishedLinkResolver;
}

// Heuristic: a frontmatter key whose name suggests it carries a secret. We drop
// it regardless (it's not on the allowlist) but ALSO flag it loudly in the diff.
const SECRET_KEY_PATTERN =
  /(secret|token|password|passwd|api[_-]?key|apikey|private[_-]?key|credential|bearer|access[_-]?key)/i;

// Matches Obsidian-style embeds (`![[file]]`) and markdown image/file embeds
// pointing at local files we are not shipping.
const EMBED_PATTERN = /!\[\[([^\]]+)\]\]/g;
const MD_LOCAL_EMBED_PATTERN = /!\[[^\]]*\]\(([^)]+)\)/g;

// Matches [[wiki-links]] (non-embed). Capture the link target (before any `|alias`).
const WIKILINK_PATTERN = /(?<!!)\[\[([^\]]+)\]\]/g;

// Local filesystem paths: absolute unix (`/Users/...`), home (`~/...`),
// windows (`C:\...`), or `file://` URLs.
const LOCAL_PATH_PATTERN =
  /(?:file:\/\/[^\s)]+|~\/[^\s)]+|\/(?:Users|home|var|tmp|private|mnt|opt)\/[^\s)]+|[A-Za-z]:\\[^\s)]+)/g;

/**
 * The privacy gate. Given the RAW note text (frontmatter + body), emit only the
 * publishable manifest fields and a cleaned body. Throws if the note is not
 * `publish: true` — default is false and the engine never auto-flips it (SPEC §3).
 */
export function stripNote(raw: string, opts: StripOptions = {}): StrippedNote {
  const parsed = parseNote(raw);
  const fm = parsed.frontmatter;

  // ── Consent gate ────────────────────────────────────────────────────────
  if (fm["publish"] !== true) {
    throw new PublishRefusedError(
      "Refusing to build a manifest: note is not `publish: true`. " +
        "Publishing is opt-in by construction (SPEC §3).",
    );
  }

  // ── Frontmatter allowlist ───────────────────────────────────────────────
  const fields: StrippedNote["fields"] = {};
  const privateFrontmatterKeys: string[] = [];
  const secretLikeKeys: string[] = [];

  for (const key of Object.keys(fm)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      // Flag AND drop. Belt-and-suspenders: even if someone adds such a key to
      // the allowlist by mistake, it gets reported.
      secretLikeKeys.push(key);
    }
    if (PUBLISHABLE_FRONTMATTER_KEYS.has(key)) continue;
    if (CONTROL_KEYS.has(key)) continue; // consumed elsewhere, not "leaked"
    privateFrontmatterKeys.push(key);
  }

  const title = fm["title"];
  if (typeof title === "string" && title.trim() !== "") fields.title = title;

  const summary = fm["summary"];
  if (typeof summary === "string" && summary.trim() !== "") fields.summary = summary;

  const license = fm["license"];
  if (typeof license === "string" && license.trim() !== "") fields.license = license;

  const galaxy = fm["galaxy"];
  if (Array.isArray(galaxy)) {
    const clean = galaxy.filter((g): g is string => typeof g === "string" && g.trim() !== "");
    if (clean.length > 0) fields.galaxy = clean;
  }

  const origin = fm["origin"];
  // Only carry forward a real planet-id origin (lineage). `origin: ai-generated`
  // and similar local provenance markers are private metadata — strip them.
  if (typeof origin === "string" && origin.startsWith("planet_")) {
    fields.origin = origin;
  }

  // ── Body scrub ──────────────────────────────────────────────────────────
  const resolveLink = opts.resolveLink ?? (() => undefined);
  const links: string[] = [];
  const unpublishedBacklinks: string[] = [];
  const localPaths: string[] = [];
  const attachments: string[] = [];

  let body = parsed.body;

  // 1. Attachments / embeds (`![[...]]`, `![alt](local)`): never shipped.
  body = body.replace(EMBED_PATTERN, (_m, target: string) => {
    attachments.push(target.split("|")[0]?.trim() ?? target);
    return ""; // remove the embed entirely
  });
  body = body.replace(MD_LOCAL_EMBED_PATTERN, (m, url: string) => {
    if (isRemoteUrl(url)) return m; // remote images are fine to keep
    attachments.push(url);
    return "";
  });

  // 2. Wiki-links: keep only those resolving to a published planet (rewrite to
  //    its planet id); strip links to unpublished notes (backlink leak).
  body = body.replace(WIKILINK_PATTERN, (_m, inner: string) => {
    const target = (inner.split("|")[0] ?? inner).trim();
    const alias = inner.includes("|") ? inner.split("|").slice(1).join("|").trim() : target;
    const planet = resolveLink(target);
    if (planet) {
      if (!links.includes(planet)) links.push(planet);
      // Render as a readable reference to the published planet.
      return `[${alias}](${planet})`;
    }
    unpublishedBacklinks.push(target);
    // Strip the entire reference. We do NOT leave the alias/title text behind:
    // an unpublished note's title is itself private (it can reveal what's in the
    // vault). If the author had an alias different from the target, keep ONLY a
    // generic alias that doesn't echo the private note's name.
    const aliasLeaksTitle = alias === target;
    return aliasLeaksTitle ? "[an unpublished note]" : alias;
  });

  // 3. Local filesystem paths: scrub them out of the published body.
  body = body.replace(LOCAL_PATH_PATTERN, (m) => {
    localPaths.push(m);
    return "[redacted-local-path]";
  });

  // Tidy whitespace introduced by removals.
  body = body.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return {
    fields,
    links,
    body,
    withheld: {
      privateFrontmatterKeys,
      unpublishedBacklinks,
      localPaths,
      attachments,
      secretLikeKeys,
    },
  };
}

function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Thrown when a note isn't `publish: true`. */
export class PublishRefusedError extends Error {
  override name = "PublishRefusedError";
}
