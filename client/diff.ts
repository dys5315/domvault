// diff.ts — consent by construction (SPEC §3).
//
// Before anything is POSTed, the user is shown EXACTLY what will leave the
// machine and exactly what is being withheld. The diff is the consent surface:
// the user approves the published artifact itself, not a vague "publish this?".

import type { BuiltPlanet } from "./manifest.ts";
import type { StrippedNote } from "./strip.ts";

export interface DiffInput {
  stripped: StrippedNote;
  planet: BuiltPlanet;
}

/** Render a human-readable diff of published vs. withheld content. */
export function renderDiff({ stripped, planet }: DiffInput): string {
  const { manifest, body } = planet;
  const w = stripped.withheld;
  const out: string[] = [];

  out.push("╔══════════════════════════════════════════════════════════════╗");
  out.push("║  PUBLISH PREVIEW — review what leaves this machine            ║");
  out.push("╚══════════════════════════════════════════════════════════════╝");
  out.push("");

  // ── WILL PUBLISH ──────────────────────────────────────────────────────
  out.push("┌─ WILL PUBLISH (this is everything the registry receives) ─────");
  out.push(line("id", manifest.id));
  out.push(line("title", manifest.title));
  out.push(line("author", `${manifest.author.handle} (${manifest.author.star})`));
  if (manifest.summary) out.push(line("summary", manifest.summary));
  if (manifest.galaxy?.length) out.push(line("galaxy", manifest.galaxy.join(", ")));
  out.push(line("license", manifest.license));
  if (manifest.links?.length) out.push(line("links", manifest.links.join(", ")));
  out.push(line("origin", manifest.origin == null ? "(none — original work)" : manifest.origin));
  out.push(line("content_hash", manifest.content_hash));
  out.push(line("version", String(manifest.version)));
  out.push(line("published_at", manifest.published_at));
  out.push("│");
  out.push("│  body (" + countWords(body) + " words, " + body.length + " chars):");
  for (const bodyLine of preview(body, 12)) out.push("│  + " + bodyLine);
  out.push("└───────────────────────────────────────────────────────────────");
  out.push("");

  // ── WILL WITHHOLD ─────────────────────────────────────────────────────
  const withheldEmpty =
    w.privateFrontmatterKeys.length === 0 &&
    w.unpublishedBacklinks.length === 0 &&
    w.localPaths.length === 0 &&
    w.attachments.length === 0 &&
    w.secretLikeKeys.length === 0;

  out.push("┌─ WITHHELD (stays private — never sent) ───────────────────────");
  if (withheldEmpty) {
    out.push("│  (nothing detected to strip)");
  } else {
    pushWithheld(out, "private frontmatter keys", w.privateFrontmatterKeys);
    pushWithheld(out, "⚠ secret-looking keys", w.secretLikeKeys);
    pushWithheld(out, "links to UNPUBLISHED notes", w.unpublishedBacklinks);
    pushWithheld(out, "local file paths", w.localPaths);
    pushWithheld(out, "attachments / embeds (not included)", w.attachments);
  }
  out.push("└───────────────────────────────────────────────────────────────");
  out.push("");
  out.push("Confirm to sign and publish. Anything in WITHHELD will NOT be sent.");

  return out.join("\n");
}

function pushWithheld(out: string[], label: string, items: string[]): void {
  if (items.length === 0) return;
  out.push(`│  ${label}:`);
  for (const item of items) out.push(`│  - ${truncate(item, 70)}`);
}

function line(key: string, value: string): string {
  return `│  ${key.padEnd(13)}: ${truncate(value, 60)}`;
}

function preview(body: string, maxLines: number): string[] {
  const lines = body.split("\n");
  const shown = lines.slice(0, maxLines).map((l) => truncate(l, 62));
  if (lines.length > maxLines) shown.push(`… (+${lines.length - maxLines} more lines)`);
  return shown;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function countWords(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}
