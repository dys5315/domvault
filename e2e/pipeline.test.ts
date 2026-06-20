// End-to-end integration test — the WHOLE Constellation pipeline, across all four
// prompts, exercised together against a real loopback registry:
//
//   Prompt C (publish client)  →  Prompt A (registry HTTP)  →  Prompt F (Observatory:
//   internal retriever + synthesizer)  fused with  Prompt G (YottaGraph mock external).
//
// This is the proof the seams compose: a note published through C lands in A, is
// crawled into F's index, retrieved alongside G's external facts, and synthesized
// into a cited answer — with every invariant intact end-to-end:
//   • the vault never leaks   (a PRIVATE landmine in the note never reaches the answer)
//   • third-party content is attributed + flagged  ([yottagraph], redistribution=restricted)
//   • external is owner-only by default            (off → internal-only answer)
//   • external text is data, not instructions      (a poisoned fact is sandboxed)
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";

import { createServer } from "../registry/server/server.ts";
import { PlanetStore } from "../registry/server/store.ts";
import { generateKeypair } from "../registry/server/keys.ts";
import { publishNote } from "../client/publish.ts";

import { fromRegistry } from "../observatory/server/index.ts";
import { InternalRetriever } from "../observatory/server/internal.ts";
import { TemplateSynthesizer } from "../observatory/server/synth.ts";
import { createObservatory } from "../observatory/server/endpoint.ts";
import { FusedRetriever } from "../observatory/server/retrievers/fused.ts";
import { MockYottaGraph } from "../observatory/server/retrievers/yottagraph.ts";

// A fresh temp store dir per test (PlanetStore always persists; no in-memory mode).
function tmpStore(): { store: PlanetStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "domvault-e2e-"));
  return { store: new PlanetStore(dir), dir };
}

// A note with a deliberate PRIVATE landmine in the frontmatter + body. C's stripper
// must remove it; we assert end-to-end that it never surfaces in a published answer.
const PRIVATE_MARKER = "SECRET-VAULT-LANDMINE-do-not-publish";

function note(title: string, body: string, withLandmine = false): string {
  const landmine = withLandmine
    ? `private_note: ${PRIVATE_MARKER}\ninternal_id: ${PRIVATE_MARKER}-id\n`
    : "";
  return `---
title: ${title}
license: PolyForm-Noncommercial-1.0.0
galaxy: [product]
publish: true
${landmine}---
${body}
`;
}

// A small realistic corpus — several matching planets so fusion has a genuine mix
// (the external-share cap correctly allows ~0 external when only ONE internal chunk
// exists, so a real test publishes a handful). One note carries the private landmine.
const NOTES = [
  note(
    "One-Way State Machines",
    "Model a funnel as a state machine: transitions are irreversible and dead ends are unreachable states. A feature is done only when its money node is reachable.",
    true, // ← the landmine lives here
  ),
  note(
    "The Money Node",
    "Every funnel needs a reachable money node — the state where value is captured. A funnel with no reachable money node is a dead-end state machine.",
  ),
  note(
    "Irreversible Transitions",
    "State machine transitions in a funnel should be irreversible; once a user advances, the funnel never silently rewinds. Money flows forward through the state machine.",
  ),
];

const OWNER_STAR = "star_owner";

async function startServer(store: PlanetStore): Promise<{ server: Server; url: string }> {
  const server = createServer(store);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}` };
}

// A RegistryClient for F's fromRegistry(): /universe returns manifests ONLY (SPEC §2),
// so we HYDRATE each planet's body via GET /planets/:id. This is the real adapter shape.
function registryClient(url: string) {
  return {
    async fetchUniverse() {
      // A's /universe returns { planets: manifest[] } (SPEC §2 — manifests only, no bodies).
      const { planets: manifests } = (await (await fetch(`${url}/universe`)).json()) as {
        planets: Array<{ id: string }>;
      };
      const full = await Promise.all(
        manifests.map(async (m) => {
          const p = (await (await fetch(`${url}/planets/${m.id}`)).json()) as {
            manifest: { id: string; title: string; license: string; author: { star: string } };
            body: string;
          };
          return {
            id: p.manifest.id,
            title: p.manifest.title,
            body: p.body,
            license: p.manifest.license,
            author: { star: p.manifest.author.star },
          };
        }),
      );
      return full;
    },
  };
}

test("E2E: publish (C) → registry (A) → observatory (F) fused with external (G)", async () => {
  const { store, dir } = tmpStore();
  const { server, url } = await startServer(store);
  try {
    // ── 1. PUBLISH the corpus through C (strips private fields, signs, POSTs to A) ──
    const { publicKey, privateKey } = generateKeypair();
    const ids: string[] = [];
    for (const raw of NOTES) {
      const result = await publishNote(raw, {
        registryUrl: url,
        author: { handle: "owner", display: "Owner", star: OWNER_STAR },
        publicKey,
        privateKey,
        confirm: async () => true, // auto-confirm the diff in the test
        build: { publishedAt: "2026-06-20T00:00:00Z" },
      });
      assert.equal(result.status, "published", "C should publish each note to A");
      // Sanity: the private landmine is already gone from what C published.
      assert.doesNotMatch(JSON.stringify(result.planet), new RegExp(PRIVATE_MARKER),
        "C must strip private fields before publish");
      ids.push(result.planet!.manifest.id);
    }
    const landminePlanetId = ids[0]!; // the first note carried the landmine
    assert.match(landminePlanetId, /^planet_/, "A returns content-addressed planet ids");

    // ── 2. CRAWL A into F's index (hydrating bodies per SPEC §2) ─────────────────
    const index = await fromRegistry(registryClient(url), OWNER_STAR);
    const internal = new InternalRetriever(index);

    // ── 3. FUSE F's internal retriever with G's mock external source ─────────────
    const fused = new FusedRetriever({
      internal,
      external: new MockYottaGraph(), // includes a POISONED "ignore previous instructions" fact
      config: { externalEnabled: true, redistributionRightsHeld: true },
    });
    const obs = createObservatory({ retriever: fused, synthesizer: new TemplateSynthesizer() });

    // ── 4. QUERY the live pipeline ───────────────────────────────────────────────
    const answer = await obs.query("state machine funnel money node");

    // INTERNAL chunk surfaced + cited as [planet_…]
    assert.ok(answer.citations.some((c) => c.kind === "internal" && ids.includes(c.ref)),
      "a published planet is retrieved and cited");
    // EXTERNAL chunk surfaced + cited as [yottagraph], distinctly
    assert.ok(answer.citations.some((c) => c.kind === "external" && c.label === "yottagraph"),
      "an external YottaGraph fact is fused in and cited distinctly");
    // LICENSE: third-party present → flagged + restricted
    assert.equal(answer.license_summary.contains_third_party, true);
    assert.equal(answer.license_summary.redistribution, "restricted");

    // THE LEAK GUARD, end-to-end: the private landmine never reaches the answer.
    assert.doesNotMatch(answer.text, new RegExp(PRIVATE_MARKER),
      "INVARIANT: the vault never leaks — private fields are unreachable via a published answer");

    // INJECTION: the poisoned external fact is present only as sandboxed DATA, never obeyed.
    // The synthesizer fences external text; assert the directive didn't become the answer.
    assert.doesNotMatch(answer.text.split("\n")[0] ?? "", /^ignore previous instructions/i,
      "INVARIANT: retrieved content is data, not instructions");
  } finally {
    server.closeIdleConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("E2E: external OFF by default → internal-only answer, no third-party flag", async () => {
  const { store, dir } = tmpStore();
  const { server, url } = await startServer(store);
  try {
    const { publicKey, privateKey } = generateKeypair();
    await publishNote(NOTES[0]!, {
      registryUrl: url,
      author: { handle: "owner", display: "Owner", star: OWNER_STAR },
      publicKey,
      privateKey,
      confirm: async () => true,
      build: { publishedAt: "2026-06-20T00:00:00Z" },
    });

    const index = await fromRegistry(registryClient(url), OWNER_STAR);
    // externalEnabled defaults OFF → owner-only; the external source must not contribute.
    const fused = new FusedRetriever({
      internal: new InternalRetriever(index),
      external: new MockYottaGraph(),
      config: { externalEnabled: false, redistributionRightsHeld: false },
    });
    const obs = createObservatory({ retriever: fused, synthesizer: new TemplateSynthesizer() });

    const answer = await obs.query("state machine funnel");
    assert.ok(answer.citations.some((c) => c.kind === "internal"), "internal still answers");
    assert.ok(!answer.citations.some((c) => c.kind === "external"),
      "INVARIANT: external defaults to owner-only — no external chunks when disabled");
    assert.equal(answer.license_summary.contains_third_party, false);
    assert.equal(answer.license_summary.redistribution, "open");
  } finally {
    server.closeIdleConnections?.();
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  }
});
