// publish-frameworks.ts — publish the genericized frameworks into a local registry.
//
// INVARIANTS (consent + safety):
//   • ONLY frameworks/*.md is ever read or published — NEVER the vault. The glob is
//     hardcoded; this script has no way to reach private notes.
//   • Every note is run through the publish client's fail-closed stripper (C) before POST.
//   • The brain's PRIVATE key lives OUTSIDE the repo (~/.constellation/) and is never committed.
//   • Zero telemetry.
//
// Frameworks carry `tags:` but no `galaxy:`, and the stripper consumes `tags`. Without a
// galaxy the universe is one undifferentiated blob — so we DERIVE galaxy from tags via the
// documented TAG_GALAXY map below, inject it into the manifest, and (idempotently) write it
// back into the note. content_hash is sha256 of the BODY only, so adding galaxy frontmatter
// does NOT change a planet's id — re-publishing stays a no-op (first-publish-wins).
import { readFile, writeFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { publishNote } from "../client/publish.ts";
import { PublishRefusedError } from "../client/strip.ts";
import type { Author } from "../registry/server/types.ts";

const FRAMEWORKS_DIR = "frameworks"; // ← the ONLY directory this script ever touches (consent gate)
const REGISTRY = process.env.CONSTELLATION_REGISTRY ?? "http://localhost:8787";
const KEYDIR = join(homedir(), ".constellation");

// ── tags → galaxy buckets ────────────────────────────────────────────────────
// Each tag maps to one galaxy id. A note's galaxies = the unique set its tags map to
// (manifest.galaxy is an array, so a note can sit in several). Galaxy display name + color
// live in constellation/galaxies.js so the Explorer and this script agree on the catalog.
const TAG_GALAXY: Record<string, string> = {
  // AI Engineering
  "ai-engineering": "ai-engineering", agents: "ai-engineering", ml: "ai-engineering",
  rag: "ai-engineering", retrieval: "ai-engineering", "knowledge-graph": "ai-engineering",
  evaluation: "ai-engineering", rubric: "ai-engineering", memory: "ai-engineering",
  // Product & Growth
  product: "product-growth", gtm: "product-growth", distribution: "product-growth",
  revenue: "product-growth", virality: "product-growth", ux: "product-growth",
  prioritization: "product-growth", validation: "product-growth",
  // Quant & Markets
  quant: "quant-markets", "control-theory": "quant-markets", control: "quant-markets",
  math: "quant-markets",
  // Systems & Engineering
  "systems-thinking": "systems", systems: "systems", engineering: "systems",
  "distributed-systems": "systems", networking: "systems", throughput: "systems",
  regularization: "systems", workflow: "systems",
  // Knowledge & Learning
  "second-brain": "knowledge", learning: "knowledge", productivity: "knowledge",
  // Leadership & Decisions
  leadership: "leadership", management: "leadership", "decision-making": "leadership",
  trust: "leadership", operations: "leadership", strategy: "leadership",
  "well-being": "leadership",
};
const DEFAULT_GALAXY = "frameworks";

function galaxiesForTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const g = TAG_GALAXY[t.trim().toLowerCase()];
    if (g) out.add(g);
  }
  return out.size ? [...out] : [DEFAULT_GALAXY];
}

// Minimal frontmatter helpers (read tags, inject galaxy) — body is left byte-identical.
function readTags(raw: string): string[] {
  const m = raw.match(/^tags:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim()).filter(Boolean);
}

function injectGalaxy(raw: string, galaxy: string[]): string {
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return raw;
  if (/^galaxy:/m.test(fm[1])) {
    return raw.replace(/^galaxy:.*$/m, `galaxy: [${galaxy.join(", ")}]`);
  }
  // insert galaxy right after the tags: line (or at the top of the frontmatter)
  const galaxyLine = `galaxy: [${galaxy.join(", ")}]`;
  const withGalaxy = fm[1].replace(/^tags:.*$/m, (m) => `${m}\n${galaxyLine}`);
  const block = withGalaxy === fm[1] ? `galaxy: [${galaxy.join(", ")}]\n${fm[1]}` : withGalaxy;
  return raw.replace(fm[0], `---\n${block}\n---`);
}

export async function publishAll() {
  const author: Author = {
    handle: process.env.CONSTELLATION_HANDLE ?? "dom",
    star: process.env.CONSTELLATION_STAR ?? "star_dom",
    display: process.env.CONSTELLATION_DISPLAY ?? "Dom S.",
  };
  const privateKey = await readFile(
    process.env.CONSTELLATION_PRIVKEY ?? join(KEYDIR, "id_ed25519.pem"), "utf8");
  const publicKey = await readFile(
    process.env.CONSTELLATION_PUBKEY ?? join(KEYDIR, "id_ed25519.pub.pem"), "utf8");

  const files = (await readdir(FRAMEWORKS_DIR))
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort();

  const published: { id: string; title: string; galaxy: string[] }[] = [];
  const skipped: { file: string; reason: string }[] = [];

  for (const file of files) {
    const path = join(FRAMEWORKS_DIR, file);
    const raw0 = await readFile(path, "utf8");
    const galaxy = galaxiesForTags(readTags(raw0));
    const raw = injectGalaxy(raw0, galaxy);
    try {
      const result = await publishNote(raw, {
        registryUrl: REGISTRY,
        author,
        privateKey,
        publicKey,
        confirm: async () => true, // batch: the diff was reviewed in the genericization step
      });
      if (result.status !== "published" || !result.planet) {
        skipped.push({ file, reason: "cancelled" });
        continue;
      }
      published.push({
        id: result.planet.manifest.id,
        title: result.planet.manifest.title,
        galaxy,
      });
      // Persist galaxy + planet_id back into the note (idempotent — body/id unchanged).
      if (result.updatedNote && result.updatedNote !== raw0) {
        await writeFile(resolve(path), result.updatedNote, "utf8");
      }
    } catch (err) {
      const reason = err instanceof PublishRefusedError ? `refused: ${err.message}`
        : err instanceof Error ? err.message : String(err);
      skipped.push({ file, reason });
    }
  }

  // ── report ──────────────────────────────────────────────────────────────────
  console.log(`\nPublished ${published.length}/${files.length} planets to ${REGISTRY}`);
  const byGalaxy = new Map<string, number>();
  for (const p of published) for (const g of p.galaxy) byGalaxy.set(g, (byGalaxy.get(g) ?? 0) + 1);
  console.log("By galaxy:", [...byGalaxy.entries()].map(([g, n]) => `${g}=${n}`).join("  "));
  console.log("Sample planet ids:");
  for (const p of published.slice(0, 5)) console.log(`  ${p.id}  ${p.title}`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    for (const s of skipped) console.log(`  ${s.file} — ${s.reason}`);
  }
}

// Auto-run only when invoked directly (not when imported by demo.ts).
if (import.meta.url === `file://${process.argv[1]}`) {
  publishAll().catch((err) => { console.error(err); process.exit(1); });
}
