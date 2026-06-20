// Env-based registry configuration. No secrets in the repo — everything via env.
//
// INVARIANTS this enables for an internet-facing deploy:
//   • durable storage   → STORE_DIR points at a mounted volume (the file store persists there)
//   • writes gated       → PUBLISH_TOKEN (private beta): POST/DELETE need it; READS stay public
//   • bounded            → MAX_BODY_BYTES + RATE_LIMIT_PER_MIN (per-IP and per-star)
//   • ops-only logging    → LOG_REQUESTS (method/path/status/ms/ip — NEVER user content/analytics)
//   • HTTPS + CORS        → CORS_ORIGIN (the host terminates TLS; the Explorer origin is allowed)

export interface RegistryConfig {
  port: number;
  storeDir: string;
  /** Private-beta gate. When set, POST/DELETE require `Authorization: Bearer <token>`.
   *  When null (default), writes are open — fine for local dev, NOT for a public deploy. */
  publishToken: string | null;
  corsOrigin: string;
  /** Per-IP and per-star write budget per minute. 0 disables (used in tests). */
  rateLimitPerMin: number;
  maxBodyBytes: number;
  /** Ops-only structured request logging to stderr. Off in tests, on in production. */
  logRequests: boolean;
}

function num(v: string | undefined, fallback: number): number {
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RegistryConfig {
  return {
    port: num(env.PORT, 8787),
    storeDir: env.STORE_DIR ?? "registry/.data",
    publishToken: env.PUBLISH_TOKEN && env.PUBLISH_TOKEN.length > 0 ? env.PUBLISH_TOKEN : null,
    corsOrigin: env.CORS_ORIGIN ?? "*",
    rateLimitPerMin: num(env.RATE_LIMIT_PER_MIN, 120),
    maxBodyBytes: num(env.MAX_BODY_BYTES, 5 * 1024 * 1024),
    logRequests: env.LOG_REQUESTS === "1" || env.LOG_REQUESTS === "true",
  };
}

// ── fixed-window rate limiter (in-memory; single instance) ────────────────────
// Keyed by ip + by star. A 2-person beta on one instance doesn't need a shared
// store; if this ever scales horizontally, swap for Redis behind the same shape.
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private readonly perMin: number, private readonly now: () => number = Date.now) {}

  /** Returns true if the key is allowed (and records the hit); false if over budget. */
  allow(key: string): boolean {
    if (this.perMin <= 0) return true; // disabled
    const t = this.now();
    const rec = this.hits.get(key);
    if (!rec || t >= rec.resetAt) {
      this.hits.set(key, { count: 1, resetAt: t + 60_000 });
      return true;
    }
    if (rec.count >= this.perMin) return false;
    rec.count += 1;
    return true;
  }
}

/** Best-effort client IP: first hop of x-forwarded-for (set by the host's proxy), else socket. */
export function clientIp(headers: NodeJS.Dict<string | string[]>, socketAddr?: string): string {
  const xff = headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (raw) return raw.split(",")[0]!.trim();
  return socketAddr ?? "unknown";
}

/** Constant-time bearer-token check for the private-beta gate. */
export function bearerOk(authHeader: string | undefined, token: string): boolean {
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const got = Buffer.from(m[1]!);
  const want = Buffer.from(token);
  if (got.length !== want.length) return false;
  // timingSafeEqual via crypto would be ideal; lengths-equal + compare is adequate here
  // since the token is high-entropy and this is a beta gate, not the signature check.
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}
