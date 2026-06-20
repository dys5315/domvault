// Tests for the production hardening (Prompt I, STEP 1): healthz, CORS preflight,
// the private-beta publish gate, and per-IP/per-star rate limiting. The base registry
// behavior is covered by server.test.ts; this asserts the internet-facing guards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";

import { createServer } from "./server.ts";
import { PlanetStore } from "./store.ts";
import { loadConfig, RateLimiter, bearerOk, clientIp } from "./config.ts";
import { generateKeypair, sign } from "./keys.ts";
import { contentHash, planetId } from "./hash.ts";
import type { NodeManifest } from "./types.ts";

function tmpStore() {
  const dir = mkdtempSync(join(tmpdir(), "reg-hard-"));
  return { store: new PlanetStore(dir), dir };
}

// Build a valid signed publish payload for `star`.
function signedPayload(star: string) {
  const { publicKey, privateKey } = generateKeypair();
  const body = `# Note for ${star}\n\nContent.`;
  const base: NodeManifest = {
    id: "", title: "T", author: { handle: star, star },
    license: "PolyForm-Noncommercial-1.0.0", content_hash: contentHash(body),
    published_at: "2026-06-20T00:00:00Z", version: 1,
  };
  const id = planetId(base);
  const withId = { ...base, id };
  const signature = sign(withId, privateKey);
  return { manifest: { ...withId, signature }, body, publicKey };
}

async function serve(config: Parameters<typeof createServer>[1]) {
  const { store, dir } = tmpStore();
  const server = createServer(store, config);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  return {
    url,
    async close() {
      server.closeIdleConnections?.();
      await new Promise<void>((r) => server.close(() => r()));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("GET /healthz responds ok (no auth)", async () => {
  const s = await serve(loadConfig({}));
  try {
    const r = await fetch(`${s.url}/healthz`);
    assert.equal(r.status, 200);
    const body = (await r.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  } finally { await s.close(); }
});

test("CORS preflight (OPTIONS) returns 204 with allow headers", async () => {
  const s = await serve(loadConfig({}));
  try {
    const r = await fetch(`${s.url}/planets`, { method: "OPTIONS" });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("access-control-allow-origin"), "*");
    assert.match(r.headers.get("access-control-allow-methods") ?? "", /POST/);
  } finally { await s.close(); }
});

test("private-beta gate: writes require the token; reads stay public", async () => {
  const s = await serve(loadConfig({ PUBLISH_TOKEN: "secret-beta", RATE_LIMIT_PER_MIN: "0" }));
  try {
    const payload = signedPayload("star_a");
    // no token → 401
    const noTok = await fetch(`${s.url}/planets`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal(noTok.status, 401, "write without token is rejected");
    // reads stay public even with the gate on
    assert.equal((await fetch(`${s.url}/universe`)).status, 200, "reads are public");
    // correct token → published
    const ok = await fetch(`${s.url}/planets`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer secret-beta" },
      body: JSON.stringify(payload),
    });
    assert.equal(ok.status, 201, "write with the token succeeds");
    // wrong token → 401
    const bad = await fetch(`${s.url}/planets`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer wrong" },
      body: JSON.stringify(signedPayload("star_b")),
    });
    assert.equal(bad.status, 401, "wrong token rejected");
  } finally { await s.close(); }
});

test("per-IP rate limit returns 429 once the budget is exhausted", async () => {
  // budget of 2 writes/min; the 3rd is throttled.
  const s = await serve(loadConfig({ RATE_LIMIT_PER_MIN: "2" }));
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${s.url}/planets`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(signedPayload(`star_${i}`)),
      });
      statuses.push(r.status);
    }
    assert.equal(statuses[2], 429, `3rd write throttled (got ${statuses.join(",")})`);
  } finally { await s.close(); }
});

// ── unit tests for the pure helpers ──────────────────────────────────────────
test("RateLimiter: fixed window with injectable clock", () => {
  let now = 0;
  const rl = new RateLimiter(2, () => now);
  assert.equal(rl.allow("k"), true);
  assert.equal(rl.allow("k"), true);
  assert.equal(rl.allow("k"), false); // over budget
  now += 60_001; // window rolls over
  assert.equal(rl.allow("k"), true);
  assert.equal(new RateLimiter(0).allow("k"), true); // 0 disables
});

test("bearerOk: exact match only", () => {
  assert.equal(bearerOk("Bearer abc", "abc"), true);
  assert.equal(bearerOk("Bearer abc", "abcd"), false);
  assert.equal(bearerOk("abc", "abc"), false); // missing scheme
  assert.equal(bearerOk(undefined, "abc"), false);
});

test("clientIp: prefers first x-forwarded-for hop", () => {
  assert.equal(clientIp({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, "9.9.9.9"), "1.1.1.1");
  assert.equal(clientIp({}, "9.9.9.9"), "9.9.9.9");
});
