// The Observatory query endpoint (Prompt F).
// Spec: docs/09-observatory-agent-query-endpoint.md §5 + §6.
//
//   POST /agent/query  body: { query: string, k?: number, paid?: boolean }
//                      →    { answer: Answer }   (see types.ts / doc 09 §4)
//
// Behavior contract (doc 09 §5):
//   - Runs the configured retriever, then the synthesizer, then returns the Answer.
//   - Default retriever is the INTERNAL one (over a FixturePlanetIndex). Doc 10's
//     FUSED retriever (Prompt G) is injected via createObservatory({ retriever }) —
//     see the clearly-commented injection seam below. The endpoint must answer from
//     the internal index alone if the external source is disabled/unauthed/down/over
//     budget, so the DEFAULT here is internal-only and the fused path is opt-in.
//   - Never returns chunk text the caller isn't licensed to see: paid mode already
//     narrowed retrieval (§3.4 in internal.ts), and we additionally force
//     license_summary.redistribution="restricted" whenever third-party content is cited.

import http from "node:http";
import type { Answer, Chunk, Retriever, Synthesizer } from "./types.ts";
import { InternalRetriever } from "./internal.ts";
import { FixturePlanetIndex } from "./index.ts";
import { TemplateSynthesizer } from "./synth.ts";

export interface ObservatoryConfig {
  // ── FUSED-RETRIEVER INJECTION SEAM (Prompt G plugs in here) ────────────────
  // Any Retriever (internal, external, or fused). Defaults to the internal-only
  // retriever over an EMPTY fixture index so the server boots standalone. Prompt G
  // constructs its fused retriever (internal + YottaGraph, doc 10) and passes it in
  // here; no other endpoint code changes, because everything below depends on the
  // `Retriever` interface, not a concrete class. The fused retriever is expected to
  // default its external source OFF and degrade to internal-only on failure (doc 09 §5).
  retriever?: Retriever;
  synthesizer?: Synthesizer;
}

export interface Observatory {
  /** Drive the pipeline directly (no port) — used by tests and by the HTTP handler. */
  query(query: string, opts?: { k?: number; paid?: boolean }): Promise<Answer>;
  /** node:http request listener for POST /agent/query. */
  handler: http.RequestListener;
}

/**
 * Factory for the Observatory. Inject a retriever (e.g. Prompt G's fused one) and/or
 * synthesizer; both default to the dependency-free internal implementations so F runs
 * and tests standalone.
 */
export function createObservatory(config: ObservatoryConfig = {}): Observatory {
  const retriever =
    config.retriever ?? new InternalRetriever(new FixturePlanetIndex([]));
  const synthesizer = config.synthesizer ?? new TemplateSynthesizer();

  async function query(
    q: string,
    opts: { k?: number; paid?: boolean } = {},
  ): Promise<Answer> {
    const chunks: Chunk[] = await retriever.retrieve(q, {
      k: opts.k,
      paid: opts.paid,
    });
    const answer = await synthesizer.synthesize(q, chunks);

    // Endpoint-level safety backstop (doc 09 §5): if ANY external content was cited,
    // the answer is restricted for redistribution — regardless of how the synthesizer
    // computed it. Belt-and-suspenders over the synthesizer's own determination.
    const citedExternal = answer.citations.some((c) => c.kind === "external");
    if (citedExternal) {
      answer.license_summary.contains_third_party = true;
      answer.license_summary.redistribution = "restricted";
    }

    return answer;
  }

  const handler: http.RequestListener = (req, res) => {
    if (req.method !== "POST" || req.url !== "/agent/query") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }

    const parts: Buffer[] = [];
    let size = 0;
    const LIMIT = 1_000_000; // 1MB request cap — reject oversized bodies.
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > LIMIT) {
        res.writeHead(413, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "payload_too_large" }));
        req.destroy();
        return;
      }
      parts.push(c);
    });

    req.on("end", () => {
      void (async () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(Buffer.concat(parts).toString("utf8") || "{}");
        } catch {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_json" }));
          return;
        }

        const body = parsed as {
          query?: unknown;
          k?: unknown;
          paid?: unknown;
        };
        if (typeof body.query !== "string" || body.query.length === 0) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "query_required" }));
          return;
        }
        const k = typeof body.k === "number" ? body.k : undefined;
        const paid = body.paid === true;

        try {
          const answer = await query(body.query, { k, paid });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ answer }));
        } catch {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "internal_error" }));
        }
      })();
    });
  };

  return { query, handler };
}

// Standalone dev server (npm run observatory:dev). Seeds nothing by default — it's a
// shell; real planets arrive via fromRegistry() (index.ts) once Prompt A is live.
// Guarded so importing this module in tests never opens a port.
if (import.meta.url === `file://${process.argv[1]}`) {
  const obs = createObservatory();
  const port = Number(process.env.PORT ?? 8788);
  http.createServer(obs.handler).listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Observatory listening on :${port}  POST /agent/query`);
  });
}
