// live-smoke.ts — verify a DEPLOYED registry end-to-end (re-runnable anytime).
//
// Full lifecycle against $CONSTELLATION_REGISTRY using $CONSTELLATION_TOKEN (the beta
// gate): publish one of MY frameworks (with the token) → it appears in /universe →
// GET /planets/:id signature verifies → simulate a SECOND star → both stars visible →
// DELETE/tombstone both → cleanup. Only frameworks/ is read (consent); keys come from
// ~/.constellation (never committed/transmitted beyond the signed manifest + token).
//
// Usage:
//   CONSTELLATION_REGISTRY=https://domvault-registry.fly.dev \
//   CONSTELLATION_TOKEN=<token> npx tsx scripts/live-smoke.ts
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { publishNote } from "../client/publish.ts";
import { generateKeypair, verify } from "../registry/server/keys.ts";

const REG = (process.env.CONSTELLATION_REGISTRY ?? "").replace(/\/+$/, "");
const TOKEN = process.env.CONSTELLATION_TOKEN;
const KEYDIR = join(homedir(), ".constellation");
if (!REG) { console.error("set CONSTELLATION_REGISTRY"); process.exit(1); }

async function universe(): Promise<{ id: string; author: { star: string } }[]> {
  const r = (await (await fetch(`${REG}/universe`)).json()) as { planets: { id: string; author: { star: string } }[] };
  return r.planets;
}

(async () => {
  const ok = (b: boolean) => (b ? "✓" : "✗ FAIL");
  console.log(`Live registry: ${REG}\n`);

  // 0. health
  const health = (await (await fetch(`${REG}/healthz`)).json()) as { ok: boolean };
  console.log(`0. /healthz ok: ${ok(health.ok)}`);

  // 1. publish one of MY frameworks (signed, with the beta token)
  const privateKey = await readFile(join(KEYDIR, "id_ed25519.pem"), "utf8");
  const publicKey = await readFile(join(KEYDIR, "id_ed25519.pub.pem"), "utf8");
  const raw = await readFile("frameworks/goodharts-law-is-overfitting.md", "utf8");
  const res = await publishNote(raw, {
    registryUrl: REG, author: { handle: "dom", star: "star_dom", display: "Dom S." },
    publicKey, privateKey, publishToken: TOKEN, confirm: async () => true,
  });
  const id = res.planet!.manifest.id;
  console.log(`1. published with token: ${ok(res.status === "published")}  (${id})`);

  // 2. appears in /universe; GET /planets/:id signature verifies over HTTPS
  console.log(`2. in /universe: ${ok((await universe()).some((p) => p.id === id))}`);
  const got = (await (await fetch(`${REG}/planets/${id}`)).json()) as { manifest: any };
  console.log(`   signature verifies server-published manifest: ${ok(verify(got.manifest, got.manifest.signature, publicKey))}`);

  // 3. simulate a SECOND star (throwaway keypair + note) — two solar systems
  const k2 = generateKeypair();
  const res2 = await publishNote(
    `---\ntitle: Throwaway\nlicense: PolyForm-Noncommercial-1.0.0\npublish: true\n---\nA throwaway note from a second brain.\n`,
    { registryUrl: REG, author: { handle: "friend", star: "star_friend", display: "Friend" },
      publicKey: k2.publicKey, privateKey: k2.privateKey, publishToken: TOKEN, confirm: async () => true });
  const id2 = res2.planet!.manifest.id;
  const stars = new Set((await universe()).map((p) => p.author.star));
  console.log(`3. two stars visible: ${ok(stars.has("star_dom") && stars.has("star_friend"))}  [${[...stars].join(", ")}]`);

  // 4. DELETE/tombstone both (cleanup) — they leave /universe
  for (const pid of [id2, id]) {
    await fetch(`${REG}/planets/${pid}`, { method: "DELETE", headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  }
  const after = await universe();
  console.log(`4. tombstone removed both (cleanup): ${ok(!after.some((p) => p.id === id || p.id === id2))}  (/universe now ${after.length})`);
  console.log("\nLive smoke complete.");
})().catch((e) => { console.error(e); process.exit(1); });
