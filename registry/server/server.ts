// Constellation registry HTTP service (SPEC §6, v0). node:http only — zero
// runtime deps, zero telemetry, zero outbound network calls.
//
// Consent by construction (SPEC §3): a planet is only ever in the universe
// because a client POSTed it. Anti-theft (SPEC §5) is enforced at publish time:
//   - the signature must verify against the supplied public key (authorship),
//   - content_hash must equal sha256(body) (body integrity),
//   - id must equal the derived planetId (no spoofed/borrowed ids).

import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { NodeManifest, StoredPlanet } from "./types.ts";
import { PlanetStore } from "./store.ts";
import { validateManifest } from "./validate.ts";
import { contentHash, planetId } from "./hash.ts";
import { verify } from "./keys.ts";
import { loadConfig, RateLimiter, clientIp, bearerOk, type RegistryConfig } from "./config.ts";

interface PublishRequest {
  manifest: unknown;
  body: unknown;
  publicKey: unknown;
}

// Active CORS origin for the running server (set per createServer call). The public
// read API is crawlable by design (SPEC §6), so "*" is the correct default; a deploy
// may pin it to the Explorer origin via CORS_ORIGIN.
let CORS_ORIGIN = "*";

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
    "access-control-allow-origin": CORS_ORIGIN,
    vary: "origin",
  });
  res.end(data);
}

function sendError(res: ServerResponse, status: number, error: string, detail?: string[]): void {
  sendJson(res, status, detail ? { error, detail } : { error });
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function summarize(p: StoredPlanet) {
  // The universe/listing views index the manifest only (SPEC §2), never the body.
  return p.manifest;
}

/**
 * Build the request handler bound to a given store. Exported as a factory so
 * tests can drive it without binding a port (createServer().listen(0)).
 *
 * The optional config carries the production hardening (durable dir, beta gate,
 * rate limits, CORS, logging). Defaults (loadConfig with no env) keep writes OPEN,
 * a generous rate limit, and logging OFF — so existing tests run unchanged.
 */
export function createServer(
  store: PlanetStore = new PlanetStore(),
  config: RegistryConfig = loadConfig({}),
): Server {
  CORS_ORIGIN = config.corsOrigin;
  const writeLimiter = new RateLimiter(config.rateLimitPerMin);
  return createHttpServer(async (req, res) => {
    const started = Date.now();
    res.on("finish", () => {
      if (config.logRequests) {
        // OPS-ONLY structured log — method/path/status/ms/ip. NEVER request bodies,
        // manifest content, or anything that resembles user analytics (zero telemetry).
        const ip = clientIp(req.headers, req.socket?.remoteAddress);
        process.stderr.write(
          JSON.stringify({ m: req.method, p: (req.url ?? "/").split("?")[0], s: res.statusCode, ms: Date.now() - started, ip }) + "\n",
        );
      }
    });
    try {
      await route(req, res, store, config, writeLimiter);
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      sendError(res, 500, message);
    }
  });
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  store: PlanetStore,
  config: RegistryConfig,
  writeLimiter: RateLimiter,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const segments = url.pathname.split("/").filter(Boolean);

  // CORS preflight — browsers send OPTIONS before a cross-origin POST with Authorization.
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": config.corsOrigin,
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
    });
    res.end();
    return;
  }

  // GET /healthz — liveness/readiness probe (no auth, no body).
  if (method === "GET" && segments.length === 1 && segments[0] === "healthz") {
    return sendJson(res, 200, { ok: true, service: "constellation-registry" });
  }

  // ── WRITE gating (POST/DELETE): private-beta token + per-IP/per-star rate limit ──
  const isWrite =
    (method === "POST" && segments.length === 1 && segments[0] === "planets") ||
    (method === "DELETE" && segments.length === 2 && segments[0] === "planets");
  if (isWrite) {
    // Private-beta gate: when a PUBLISH_TOKEN is configured, writes require it.
    // Reads (/universe, /planets, /stars, /galaxies) are ALWAYS public. Easy to
    // open up later by unsetting the token (SPEC: reads public, writes gated in beta).
    if (config.publishToken && !bearerOk(req.headers["authorization"], config.publishToken)) {
      return sendError(res, 401, "publishing is in private beta — a publish token is required");
    }
    const ip = clientIp(req.headers, req.socket?.remoteAddress);
    if (!writeLimiter.allow(`ip:${ip}`)) {
      return sendError(res, 429, "rate limit exceeded (per-IP write budget)");
    }
  }

  // POST /planets
  if (method === "POST" && segments.length === 1 && segments[0] === "planets") {
    return handlePublish(req, res, store, config, writeLimiter);
  }

  // GET /planets/:id   ·   DELETE /planets/:id
  if (segments.length === 2 && segments[0] === "planets") {
    const id = decodeURIComponent(segments[1] ?? "");
    if (method === "GET") return handleGet(res, store, id);
    if (method === "DELETE") return handleDelete(res, store, id);
  }

  // GET /galaxies/:slug
  if (method === "GET" && segments.length === 2 && segments[0] === "galaxies") {
    const slug = decodeURIComponent(segments[1] ?? "");
    return sendJson(res, 200, { galaxy: slug, planets: store.listByGalaxy(slug).map(summarize) });
  }

  // GET /stars/:handle
  if (method === "GET" && segments.length === 2 && segments[0] === "stars") {
    const handle = decodeURIComponent(segments[1] ?? "");
    return sendJson(res, 200, { star: handle, planets: store.listByStar(handle).map(summarize) });
  }

  // GET /universe?since=…
  if (method === "GET" && segments.length === 1 && segments[0] === "universe") {
    const since = url.searchParams.get("since") ?? undefined;
    return sendJson(res, 200, { planets: store.universe(since).map(summarize) });
  }

  sendError(res, 404, "not found");
}

async function handlePublish(
  req: IncomingMessage,
  res: ServerResponse,
  store: PlanetStore,
  config: RegistryConfig,
  writeLimiter: RateLimiter,
): Promise<void> {
  let parsed: PublishRequest;
  try {
    const raw = await readBody(req, config.maxBodyBytes);
    parsed = JSON.parse(raw) as PublishRequest;
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid JSON";
    return sendError(res, 400, message);
  }

  const { manifest, body, publicKey } = parsed;
  if (typeof body !== "string") {
    return sendError(res, 400, "body must be a string");
  }
  if (typeof publicKey !== "string") {
    return sendError(res, 400, "publicKey must be a string");
  }

  // 1. Schema validation (mirrors node.schema.json).
  const validation = validateManifest(manifest);
  if (!validation.ok) {
    return sendError(res, 400, "manifest validation failed", validation.errors);
  }
  const m: NodeManifest = validation.manifest;

  // Per-STAR write budget (in addition to per-IP, checked in route()) — one brain
  // can't flood the registry even from many IPs.
  if (!writeLimiter.allow(`star:${m.author?.star ?? "unknown"}`)) {
    return sendError(res, 429, "rate limit exceeded (per-star write budget)");
  }

  // A signature is required to publish (SPEC §3: publishing is signed).
  if (typeof m.signature !== "string" || m.signature.length === 0) {
    return sendError(res, 400, "manifest.signature is required to publish");
  }

  // 2. Body integrity: content_hash must match the actual body.
  const expectedHash = contentHash(body);
  if (m.content_hash !== expectedHash) {
    return sendError(res, 400, "content_hash does not match body");
  }

  // 3. Authorship: signature must verify against the supplied public key over
  //    the canonical (id+signature-excluded) manifest.
  if (!verify(m, m.signature, publicKey)) {
    return sendError(res, 400, "signature verification failed");
  }

  // 4. Anti-theft: id must be the content-addressed id derived from the
  //    manifest. A spoofed/borrowed id is rejected.
  const expectedId = planetId(m);
  if (m.id !== expectedId) {
    return sendError(res, 400, "id does not match content-addressed planet id", [
      `expected ${expectedId}`,
    ]);
  }

  store.put({ manifest: m, body });
  return sendJson(res, 201, { id: m.id });
}

function handleGet(res: ServerResponse, store: PlanetStore, id: string): void {
  const planet = store.get(id);
  if (!planet) return sendError(res, 404, "planet not found");
  sendJson(res, 200, planet);
}

function handleDelete(res: ServerResponse, store: PlanetStore, id: string): void {
  const removed = store.del(id);
  if (!removed) return sendError(res, 404, "planet not found");
  sendJson(res, 200, { id, unpublished: true });
}

// The runnable entrypoint lives in main.ts (single place that calls listen, so a
// production bundle never double-binds). Run it via `npm run registry:dev` (tsx) or
// `node dist/registry.mjs` (bundled). server.ts stays import-only: factory + handlers.
