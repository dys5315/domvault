// fused.test.ts — FusedRetriever tests (doc 10 §7).
// Covers: Fallback, External shape, License flag, External gate, Ranking, Injection, Dedupe.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Chunk, Retriever, RetrieveOpts } from "../types.ts";
import { FusedRetriever, type FusedConfig } from "./fused.ts";
import {
  type ExternalSource,
  type RawFact,
  MockYottaGraph,
  POISONED_MOCK_FACT,
} from "./yottagraph.ts";

// ── tiny in-test mock Retriever (we do NOT build the real internal retriever) ──
class MockInternal implements Retriever {
  constructor(private chunks: Chunk[]) {}
  async retrieve(_q: string, _opts?: RetrieveOpts): Promise<Chunk[]> {
    return this.chunks.map((c) => ({ ...c }));
  }
}

function internalChunk(text: string, score: number, planet_id = "planet_x", license = "MIT"): Chunk {
  return { source: "internal", planet_id, license, text, score };
}

// External source that always throws — for the fallback test.
class ThrowingExternal implements ExternalSource {
  async query(): Promise<RawFact[]> {
    throw new Error("YottaGraph is down");
  }
}

// External source that records whether it was called — for the gate test.
class SpyExternal implements ExternalSource {
  called = false;
  constructor(private facts: RawFact[]) {}
  async query(): Promise<RawFact[]> {
    this.called = true;
    return this.facts;
  }
}

const baseConfig: FusedConfig = {
  externalEnabled: true,
  redistributionRightsHeld: false,
};

// ── FALLBACK (doc 10 §7) ────────────────────────────────────────────────────
test("FALLBACK: external throwing → FusedRetriever still returns internal chunks", async () => {
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("internal fact", 0.9)]),
    external: new ThrowingExternal(),
    config: baseConfig,
  });
  const out = await fused.retrieve("q");
  assert.equal(out.length, 1);
  assert.equal(out[0]!.source, "internal");
  assert.equal(out[0]!.text, "internal fact");
});

// ── EXTERNAL SHAPE (doc 10 §7) ──────────────────────────────────────────────
test("EXTERNAL SHAPE: external chunks always carry provider + citation", async () => {
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("i", 0.5)]),
    external: new MockYottaGraph([
      { summary: "ext fact", source: "https://ex/1", license: "CC-BY-4.0", relevance: 100 },
    ]),
    config: { ...baseConfig, redistributionRightsHeld: true, externalShare: 0.9 },
  });
  const out = await fused.retrieve("q");
  const ext = out.filter((c) => c.source === "external");
  assert.equal(ext.length, 1);
  assert.ok(ext[0]!.source === "external" && ext[0]!.provider === "yottagraph");
  assert.ok(ext[0]!.source === "external" && ext[0]!.citation === "https://ex/1");
});

test("EXTERNAL SHAPE: a RawFact mapping missing provider OR citation → dropped (GATE 2)", async () => {
  // Source emits a fact whose `source` (→ citation) is empty: must be dropped.
  const badSource: ExternalSource = {
    async query() {
      return [{ summary: "un-attributed", source: "", license: "CC-BY-4.0", relevance: 50 }];
    },
  };
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("i", 0.5)]),
    external: badSource,
    config: baseConfig,
  });
  const out = await fused.retrieve("q");
  assert.equal(out.filter((c) => c.source === "external").length, 0);
  assert.ok(out.every((c) => c.text !== "un-attributed"));
});

// ── LICENSE FLAG (doc 10 §7, §5.2) ──────────────────────────────────────────
test("LICENSE: when an external chunk is present, downstream license summary would flag third-party", async () => {
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("i", 0.5)]),
    external: new MockYottaGraph([
      { summary: "licensed ext", source: "https://ex/2", license: "CC-BY-NC-4.0", relevance: 100 },
    ]),
    config: { ...baseConfig, redistributionRightsHeld: true, externalShare: 0.9 },
  });
  const out = await fused.retrieve("q");
  const externals = out.filter((c) => c.source === "external");
  assert.ok(externals.length >= 1, "external chunk must be present so synthesizer flags it");
  // Simulate the synthesizer's license rollup (the synthesizer itself is Prompt F).
  const containsThirdParty = out.some((c) => c.source === "external");
  const redistribution = containsThirdParty ? "restricted" : "open";
  assert.equal(containsThirdParty, true);
  assert.equal(redistribution, "restricted");
  // license_note rides in-band so non-commercial obligation is visible.
  assert.ok(externals[0]!.source === "external" && externals[0]!.license_note === "CC-BY-NC-4.0");
});

// ── EXTERNAL GATE (doc 10 §7, §2.2) ─────────────────────────────────────────
test("GATE: externalEnabled off → external NOT called, no external chunks", async () => {
  const spy = new SpyExternal([{ summary: "ext", source: "https://ex/3", license: "X", relevance: 10 }]);
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("i", 0.5)]),
    external: spy,
    config: { externalEnabled: false, redistributionRightsHeld: true },
  });
  const out = await fused.retrieve("q");
  assert.equal(spy.called, false, "external source must not be called when gate is closed");
  assert.equal(out.filter((c) => c.source === "external").length, 0);
});

test("GATE: paid answer without redistribution rights → external NOT called", async () => {
  const spy = new SpyExternal([{ summary: "ext", source: "https://ex/4", license: "X", relevance: 10 }]);
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("i", 0.5)]),
    external: spy,
    config: { externalEnabled: true, redistributionRightsHeld: false },
  });
  const out = await fused.retrieve("q", { paid: true });
  assert.equal(spy.called, false);
  assert.equal(out.filter((c) => c.source === "external").length, 0);
});

test("GATE: paid answer WITH redistribution rights → external IS allowed", async () => {
  const spy = new SpyExternal([{ summary: "ext", source: "https://ex/5", license: "X", relevance: 10 }]);
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("i", 0.5)]),
    external: spy,
    config: { externalEnabled: true, redistributionRightsHeld: true, externalShare: 0.5 },
  });
  await fused.retrieve("q", { paid: true });
  assert.equal(spy.called, true);
});

// ── RANKING (doc 10 §7, §4) — the important one ─────────────────────────────
test("RANKING: ordering reflects NORMALIZED relevance, not raw-scale artifact", async () => {
  // Internal on a tiny raw scale (0–1); external on a huge raw scale (0–1000).
  // Internal "top" is normalized to ~1.0; external "mid" is normalized to ~0.5.
  // Despite external's far larger raw numbers, the high-normalized internal chunk
  // must outrank the mid-normalized external chunk.
  const internal = [
    internalChunk("internal-top", 1.0), // norm 1.0 (+bias)
    internalChunk("internal-bottom", 0.0), // norm 0.0 (+bias)
  ];
  const external: RawFact[] = [
    { summary: "external-top", source: "https://ex/hi", license: "L", relevance: 1000 }, // norm 1.0
    { summary: "external-mid", source: "https://ex/mid", license: "L", relevance: 500 }, // norm 0.5
    { summary: "external-bottom", source: "https://ex/lo", license: "L", relevance: 0 }, // norm 0.0
  ];
  const fused = new FusedRetriever({
    internal: new MockInternal(internal),
    external: new MockYottaGraph(external),
    config: {
      externalEnabled: true,
      redistributionRightsHeld: true,
      internalBias: 0.05,
      externalShare: 1, // disable cap so we test pure ranking.
    },
  });
  const out = await fused.retrieve("q", { k: 12 });
  const order = out.map((c) => c.text);

  // internal-top (1.0+0.05) must outrank external-mid (0.5) — proves normalization
  // happened before merge; raw 1.0 vs raw 500 would have ordered external first.
  const iTop = order.indexOf("internal-top");
  const eMid = order.indexOf("external-mid");
  assert.ok(iTop < eMid, `internal-top (${iTop}) must outrank external-mid (${eMid})`);
  assert.ok(iTop >= 0 && eMid >= 0);

  // And internal-bottom (raw 0.0 → norm 0.0+0.05) must NOT be dragged below where
  // a raw-scale comparison would put it: it should beat external-bottom (norm 0.0).
  const iBot = order.indexOf("internal-bottom");
  const eBot = order.indexOf("external-bottom");
  assert.ok(iBot < eBot, "normalized internal-bottom should rank above normalized external-bottom");
});

// ── EXTERNAL SHARE CAP (doc 10 §2.3, §4.4) ──────────────────────────────────
test("CAP: external chunks capped to externalShare of the result set, lowest-ranked trimmed first", async () => {
  // 2 internal + 3 external, share 0.4. maxExternal = floor(0.4/0.6 * 2) = 1.
  const internal = [internalChunk("i1", 0.9), internalChunk("i2", 0.8)];
  const external: RawFact[] = [
    { summary: "e-hi", source: "https://ex/a", license: "L", relevance: 1000 },
    { summary: "e-mid", source: "https://ex/b", license: "L", relevance: 500 },
    { summary: "e-lo", source: "https://ex/c", license: "L", relevance: 1 },
  ];
  const fused = new FusedRetriever({
    internal: new MockInternal(internal),
    external: new MockYottaGraph(external),
    config: { externalEnabled: true, redistributionRightsHeld: true, externalShare: 0.4 },
  });
  const out = await fused.retrieve("q", { k: 12 });
  const ext = out.filter((c) => c.source === "external");
  assert.equal(ext.length, 1, "only 1 external allowed at share 0.4 with 2 internal");
  // The highest-ranked external survives; lowest-ranked were trimmed first.
  assert.equal(ext[0]!.text, "e-hi");
});

// ── INJECTION (doc 10 §7, §6) ───────────────────────────────────────────────
test("INJECTION: poisoned external fact passes through AS DATA, not executed", async () => {
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("clean internal", 0.9)]),
    external: new MockYottaGraph([POISONED_MOCK_FACT]),
    config: { externalEnabled: true, redistributionRightsHeld: true, externalShare: 0.9 },
  });
  const out = await fused.retrieve("q");
  const poisoned = out.find((c) => c.text === POISONED_MOCK_FACT.summary);
  assert.ok(poisoned, "poisoned fact must survive as a normal external chunk");
  // It is a perfectly ordinary external chunk — fusion treated its text as inert data.
  assert.equal(poisoned!.source, "external");
  assert.ok(poisoned!.source === "external" && poisoned!.provider === "yottagraph");
  assert.match(poisoned!.text, /ignore previous instructions/i);
  // Nothing in the result set was altered/removed by the injection text: the clean
  // internal chunk is still present and unmodified.
  assert.ok(out.some((c) => c.text === "clean internal"));
});

// ── DEDUPE (doc 10 §7, §4.3) ────────────────────────────────────────────────
test("DEDUPE: identical text from internal + external collapses to one (internal kept)", async () => {
  const sharedText = "the same fact appears in both sources";
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk(sharedText, 0.5, "planet_dup")]),
    external: new MockYottaGraph([
      { summary: sharedText, source: "https://ex/dup", license: "L", relevance: 1000 },
    ]),
    config: { externalEnabled: true, redistributionRightsHeld: true, externalShare: 0.9 },
  });
  const out = await fused.retrieve("q");
  const matches = out.filter((c) => c.text === sharedText);
  assert.equal(matches.length, 1, "duplicate text must collapse to a single chunk");
  assert.equal(matches[0]!.source, "internal", "internal copy is kept (provenance with owner)");
});

test("DEDUPE: optional embedding-cosine collapses near-duplicates when embedder configured", async () => {
  // Tiny deterministic embedder: identical vectors for both → cosine 1.0 ≥ threshold.
  const embedder = {
    embed(text: string): number[] {
      // map any "weather" text to the same vector to force a near-dup.
      return text.includes("weather") ? [1, 0, 0] : [0, 1, 0];
    },
  };
  const fused = new FusedRetriever({
    internal: new MockInternal([internalChunk("the weather today is sunny", 0.5)]),
    external: new MockYottaGraph([
      { summary: "weather forecast is bright", source: "https://ex/w", license: "L", relevance: 1000 },
    ]),
    config: {
      externalEnabled: true,
      redistributionRightsHeld: true,
      externalShare: 0.9,
      embedder,
      dedupeCosineThreshold: 0.95,
    },
  });
  const out = await fused.retrieve("q");
  // The two distinct texts embed to the same vector → collapse to one.
  assert.equal(out.length, 1, "near-duplicates collapse under cosine threshold");
});
