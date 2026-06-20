// Tests for the /agent/query endpoint. Spec: docs/09-observatory-agent-query-endpoint.md §5.
// Drives createObservatory() both directly (no port) and over real HTTP.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { IndexedPlanet, Chunk, Retriever, Answer } from "./types.ts";
import { FixturePlanetIndex } from "./index.ts";
import { InternalRetriever } from "./internal.ts";
import { createObservatory } from "./endpoint.ts";

const planets: IndexedPlanet[] = [
  {
    planet_id: "aaa111",
    title: "Funnel state machine",
    text: "Model the funnel as a one-way state machine.",
    license: "CC-BY-4.0",
    author_is_owner: true,
  },
  {
    planet_id: "bbb222",
    title: "Noncommercial growth playbook",
    text: "A growth playbook under a noncommercial license.",
    license: "PolyForm-Noncommercial-1.0.0",
    author_is_owner: false,
  },
];

function obsOverFixture() {
  const retriever = new InternalRetriever(new FixturePlanetIndex(planets));
  return createObservatory({ retriever });
}

test("query() returns an Answer over the fixture index", async () => {
  const obs = obsOverFixture();
  const ans = await obs.query("funnel state machine");
  assert.ok(ans.text.includes("[planet_aaa111]"));
  assert.ok(ans.citations.some((c) => c.ref === "aaa111"));
  assert.equal(ans.license_summary.redistribution, "open");
});

test("paid flag flows through retrieval (noncommercial dropped when paid)", async () => {
  const obs = obsOverFixture();
  const free = await obs.query("noncommercial growth playbook", {
    paid: false,
  });
  assert.ok(free.citations.some((c) => c.ref === "bbb222"));

  const paid = await obs.query("noncommercial growth playbook", { paid: true });
  assert.ok(!paid.citations.some((c) => c.ref === "bbb222"));
});

test("endpoint sets redistribution=restricted when an external chunk is cited", async () => {
  // Inject a stub fused retriever that returns one external chunk — proves the
  // injection seam works AND the endpoint's restricted-backstop fires.
  const fused: Retriever = {
    async retrieve(): Promise<Chunk[]> {
      return [
        {
          source: "external",
          provider: "yottagraph",
          citation: "yg#1",
          license_note: "YG-Terms",
          text: "An external fact.",
          score: 1,
        },
      ];
    },
  };
  const obs = createObservatory({ retriever: fused });
  const ans = await obs.query("anything");
  assert.equal(ans.license_summary.contains_third_party, true);
  assert.equal(ans.license_summary.redistribution, "restricted");
  assert.ok(ans.text.includes("[yottagraph]"));
});

test("POST /agent/query over real HTTP returns { answer }", async () => {
  const obs = obsOverFixture();
  const server = http.createServer(obs.handler);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const port = (addr as { port: number }).port;

  try {
    const res = await postJson(port, "/agent/query", {
      query: "funnel state machine",
    });
    assert.equal(res.status, 200);
    const answer = (res.body as { answer: Answer }).answer;
    assert.ok(answer.text.includes("[planet_aaa111]"));
    assert.ok(Array.isArray(answer.citations));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("POST with missing query → 400", async () => {
  const obs = obsOverFixture();
  const server = http.createServer(obs.handler);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  try {
    const res = await postJson(port, "/agent/query", { notquery: 1 });
    assert.equal(res.status, 400);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("unknown route → 404", async () => {
  const obs = obsOverFixture();
  const server = http.createServer(obs.handler);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  try {
    const res = await postJson(port, "/nope", { query: "x" });
    assert.equal(res.status, 404);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

function postJson(
  port: number,
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": payload.length,
        },
      },
      (res) => {
        const parts: Buffer[] = [];
        res.on("data", (c: Buffer) => parts.push(c));
        res.on("end", () => {
          const txt = Buffer.concat(parts).toString("utf8");
          let parsed: unknown = txt;
          try {
            parsed = JSON.parse(txt);
          } catch {
            /* leave as text */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}
