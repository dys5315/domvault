// demo.ts — "see my graph" in one command. Dependency-free (node:http only).
//
//   1. start the registry            (registry:dev, in-process)
//   2. publish frameworks/*.md        (the genericized corpus; consent-gated)
//   3. serve the Constellation Explorer over http (so its fetch + module import work)
//
// Then open http://localhost:8080 → the Explorer renders the LIVE registry.
//
// INVARIANTS: only frameworks/ is published; the vault is never touched; the private
// key stays in ~/.constellation (never committed); zero telemetry; Ctrl-C stops both.
import { createServer as createRegistry } from "../registry/server/server.ts";
import { PlanetStore } from "../registry/server/store.ts";
import { publishAll } from "./publish-frameworks.ts";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const REGISTRY_PORT = Number(process.env.REGISTRY_PORT ?? 8787);
const EXPLORER_PORT = Number(process.env.EXPLORER_PORT ?? 8080);
const ROOT = join(process.cwd(), "constellation");

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".css": "text/css", ".svg": "image/svg+xml",
};

async function main() {
  // 1 — registry (persists to registry/.data so re-runs are idempotent: same ids, no dups)
  const registry = createRegistry(new PlanetStore());
  await new Promise<void>((r) => registry.listen(REGISTRY_PORT, r));
  console.log(`registry  → http://localhost:${REGISTRY_PORT}`);

  // 2 — publish the corpus (idempotent; re-running overwrites the same content-addressed ids)
  process.env.CONSTELLATION_REGISTRY = `http://localhost:${REGISTRY_PORT}`;
  process.env.CONSTELLATION_HANDLE ??= "dom";
  process.env.CONSTELLATION_STAR ??= "star_dom";
  process.env.CONSTELLATION_DISPLAY ??= "Dom S.";
  await publishAll();

  // 3 — static-serve the Explorer (dependency-free); path-normalized to block traversal
  const explorer = createServer(async (req, res) => {
    let rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (rel === "/") rel = "/index.html";
    const path = normalize(join(ROOT, rel));
    if (!path.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
    try {
      const data = await readFile(path);
      res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404); res.end("not found");
    }
  });
  await new Promise<void>((r) => explorer.listen(EXPLORER_PORT, r));
  console.log(`explorer  → http://localhost:${EXPLORER_PORT}   ← open this`);
  console.log("\nCtrl-C to stop.");
}

main().catch((err) => { console.error(err); process.exit(1); });
