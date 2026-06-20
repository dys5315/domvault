// End-to-end tests for the Constellation registry (node:test, zero deps).
// Drives the http server over a real loopback socket on port 0.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { NodeManifest, StoredPlanet } from "./types.ts";
import { PlanetStore } from "./store.ts";
import { createServer } from "./server.ts";
import { generateKeypair, sign } from "./keys.ts";
import { contentHash, planetId } from "./hash.ts";

// ---- fixtures ---------------------------------------------------------------

const keys = generateKeypair();

/** Build a fully valid, signed manifest for a given body. */
function makeManifest(
  body: string,
  overrides: Partial<NodeManifest> = {},
): NodeManifest {
  const base: NodeManifest = {
    id: "", // filled in below
    title: "Model the Funnel as a One-Way State Machine",
    summary: "Treat a funnel as a state machine.",
    author: { handle: "dom", display: "Dom S.", star: "star_dom" },
    galaxy: ["product", "growth"],
    license: "PolyForm-Noncommercial-1.0.0",
    links: [],
    origin: null,
    content_hash: contentHash(body),
    published_at: "2026-06-19T00:00:00Z",
    version: 1,
    price: null,
    ...overrides,
  };
  // content_hash must reflect the body unless an override deliberately broke it.
  if (overrides.content_hash === undefined) base.content_hash = contentHash(body);
  base.id = planetId(base);
  base.signature = sign(base, keys.privateKey);
  return base;
}

// ---- http harness -----------------------------------------------------------

async function withServer(
  fn: (
    base: string,
    store: PlanetStore,
  ) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "constellation-"));
  const store = new PlanetStore(dir);
  const server: Server = createServer(store);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  try {
    await fn(base, store);
  } finally {
    // fetch keeps connections alive; force idle sockets shut so close() is fast.
    server.closeIdleConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}

interface PublishBody {
  manifest: NodeManifest;
  body: string;
  publicKey: string;
}

function publishPayload(body: string, overrides?: Partial<NodeManifest>): PublishBody {
  return { manifest: makeManifest(body, overrides), body, publicKey: keys.publicKey };
}

async function post(base: string, payload: unknown): Promise<Response> {
  return fetch(`${base}/planets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---- tests ------------------------------------------------------------------

test("publish → fetch round-trip", async () => {
  await withServer(async (base) => {
    const body = "# A note\n\nfunnel as state machine";
    const payload = publishPayload(body);
    const res = await post(base, payload);
    assert.equal(res.status, 201);
    const { id } = (await res.json()) as { id: string };
    assert.equal(id, payload.manifest.id);

    const fetched = await fetch(`${base}/planets/${id}`);
    assert.equal(fetched.status, 200);
    const planet = (await fetched.json()) as StoredPlanet;
    assert.equal(planet.body, body);
    assert.equal(planet.manifest.title, payload.manifest.title);
  });
});

test("valid signed manifest verifies and publishes", async () => {
  await withServer(async (base) => {
    const res = await post(base, publishPayload("signed content"));
    assert.equal(res.status, 201);
  });
});

test("tampered signature → 400", async () => {
  await withServer(async (base) => {
    const payload = publishPayload("content to sign");
    // Flip the signature to a different (still-valid base64) value.
    payload.manifest.signature = Buffer.from(
      "x".repeat(64),
    ).toString("base64");
    const res = await post(base, payload);
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string };
    assert.match(err.error, /signature/);
  });
});

test("content_hash mismatch → 400", async () => {
  await withServer(async (base) => {
    const body = "real body";
    // Force a content_hash for *different* content, then re-derive id+sig so
    // only the hash-vs-body check should fail.
    const wrongHash = contentHash("some other body");
    const payload = publishPayload(body, { content_hash: wrongHash });
    const res = await post(base, payload);
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string };
    assert.match(err.error, /content_hash/);
  });
});

test("spoofed id (id does not match content) → 400", async () => {
  await withServer(async (base) => {
    const body = "original work";
    const payload = publishPayload(body);
    // Overwrite the id with a borrowed/forged one. Re-sign so the signature is
    // valid for the forged manifest — only the id-derivation check should fail.
    payload.manifest.id = "planet_deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    payload.manifest.signature = sign(payload.manifest, keys.privateKey);
    const res = await post(base, payload);
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string };
    assert.match(err.error, /id/);
  });
});

test("identical content yields identical id; copy-without-lineage differs", async () => {
  const body = "the same words";
  const a = makeManifest(body);
  const b = makeManifest(body);
  assert.equal(a.id, b.id, "same content + same author → same id");

  // A thief copies the text but publishes under their own star.
  const thief = makeManifest(body, {
    author: { handle: "thief", star: "star_thief" },
  });
  assert.notEqual(a.id, thief.id, "different author → different id, no lineage");
});

test("unpublish removes from universe and 404s on fetch", async () => {
  await withServer(async (base) => {
    const payload = publishPayload("ephemeral");
    await post(base, payload);
    const id = payload.manifest.id;

    let uni = await (await fetch(`${base}/universe`)).json() as { planets: NodeManifest[] };
    assert.ok(uni.planets.some((p) => p.id === id));

    const del = await fetch(`${base}/planets/${id}`, { method: "DELETE" });
    assert.equal(del.status, 200);

    uni = await (await fetch(`${base}/universe`)).json() as { planets: NodeManifest[] };
    assert.ok(!uni.planets.some((p) => p.id === id), "gone from universe");

    const fetched = await fetch(`${base}/planets/${id}`);
    assert.equal(fetched.status, 404);
  });
});

test("schema rejects manifest missing a required field", async () => {
  await withServer(async (base) => {
    const payload = publishPayload("body");
    delete (payload.manifest as unknown as Record<string, unknown>).title;
    const res = await post(base, payload);
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string; detail?: string[] };
    assert.match(err.error, /validation/);
    assert.ok(err.detail?.some((d) => /title/.test(d)));
  });
});

test("schema rejects manifest with an extra property", async () => {
  await withServer(async (base) => {
    const payload = publishPayload("body");
    (payload.manifest as unknown as Record<string, unknown>).evil = "extra";
    const res = await post(base, payload);
    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: string; detail?: string[] };
    assert.ok(err.detail?.some((d) => /unexpected property: evil/.test(d)));
  });
});

test("listByStar / galaxy / universe filtering", async () => {
  await withServer(async (base) => {
    const p1 = publishPayload("note one", {
      author: { handle: "alice", star: "star_alice" },
      galaxy: ["ai"],
      published_at: "2026-01-01T00:00:00Z",
    });
    const p2 = publishPayload("note two", {
      author: { handle: "bob", star: "star_bob" },
      galaxy: ["ai", "product"],
      published_at: "2026-03-01T00:00:00Z",
    });
    await post(base, p1);
    await post(base, p2);

    const star = await (await fetch(`${base}/stars/alice`)).json() as { planets: NodeManifest[] };
    assert.equal(star.planets.length, 1);
    assert.equal(star.planets[0]?.author.handle, "alice");

    const galaxy = await (await fetch(`${base}/galaxies/ai`)).json() as { planets: NodeManifest[] };
    assert.equal(galaxy.planets.length, 2);

    const product = await (await fetch(`${base}/galaxies/product`)).json() as { planets: NodeManifest[] };
    assert.equal(product.planets.length, 1);
    assert.equal(product.planets[0]?.author.handle, "bob");

    const since = await (await fetch(`${base}/universe?since=2026-02-01T00:00:00Z`)).json() as { planets: NodeManifest[] };
    assert.equal(since.planets.length, 1);
    assert.equal(since.planets[0]?.author.handle, "bob");
  });
});

test("store persists across reload", () => {
  const dir = mkdtempSync(join(tmpdir(), "constellation-persist-"));
  try {
    const body = "persisted body";
    const manifest = makeManifest(body);
    const s1 = new PlanetStore(dir);
    s1.put({ manifest, body });

    const s2 = new PlanetStore(dir); // rehydrate from disk
    const got = s2.get(manifest.id);
    assert.ok(got);
    assert.equal(got?.body, body);

    assert.equal(s2.del(manifest.id), true);
    const s3 = new PlanetStore(dir);
    assert.equal(s3.get(manifest.id), undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
