// yottagraph.test.ts — external-source adapter tests (doc 10 §7: External shape).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MockYottaGraph,
  RestYottaGraph,
  McpYottaGraph,
  toExternalChunk,
  POISONED_MOCK_FACT,
  type RawFact,
} from "./yottagraph.ts";

test("toExternalChunk maps RawFact → external Chunk with provider + citation (GATE 2)", () => {
  const fact: RawFact = {
    summary: "A world fact.",
    source: "https://example.org/a",
    license: "CC-BY-4.0",
    relevance: 42,
  };
  const c = toExternalChunk(fact);
  assert.equal(c.source, "external");
  assert.equal(c.provider, "yottagraph");
  assert.equal(c.citation, "https://example.org/a");
  assert.equal(c.license_note, "CC-BY-4.0");
  assert.equal(c.text, "A world fact.");
  assert.equal(c.score, 42); // raw — normalized later in fusion.
});

test("MockYottaGraph returns fixtures including the poisoned one", async () => {
  const facts = await new MockYottaGraph().query("anything");
  assert.ok(facts.length >= 3);
  assert.ok(facts.some((f) => f.summary === POISONED_MOCK_FACT.summary));
  // Poisoned text is carried as DATA — the adapter never acts on it (invariant 5).
  const poisoned = facts.find((f) => f.summary === POISONED_MOCK_FACT.summary)!;
  assert.match(poisoned.summary, /ignore previous instructions/i);
});

test("RestYottaGraph is the default transport but throws 'not configured' until endpoint set", async () => {
  const rest = new RestYottaGraph({ transport: "rest" });
  await assert.rejects(() => rest.query("q"), /not configured/);
  // Even WITH an endpoint, the live call is stubbed (no real network in this repo).
  const restWithEndpoint = new RestYottaGraph({ transport: "rest", endpoint: "https://example.org" });
  await assert.rejects(() => restWithEndpoint.query("q"), /stubbed/);
});

test("McpYottaGraph alternate impl exists with same interface and throws until configured", async () => {
  const mcp = new McpYottaGraph({ transport: "mcp" });
  await assert.rejects(() => mcp.query("q"), /not configured/);
});
