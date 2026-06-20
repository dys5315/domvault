// Tests for InternalRetriever — the private-leak guard + paid-mode licensing.
// Spec: docs/09-observatory-agent-query-endpoint.md §3.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { IndexedPlanet } from "./types.ts";
import { FixturePlanetIndex } from "./index.ts";
import {
  InternalRetriever,
  commercialUseOk,
  isCommercialLicense,
} from "./internal.ts";

// A small published universe. The SECRET planet below is deliberately NOT seeded
// into the index that the retriever searches — it stands in for a `publish: false`
// note that was never published. Its exact text must be unreachable.
const SECRET_TEXT = "the launch codes are hunter2 and the safe combo is 1234";

const publishedPlanets: IndexedPlanet[] = [
  {
    planet_id: "aaa111",
    title: "Funnel state machine",
    text: "Model the funnel as a one-way state machine to avoid backflow bugs.",
    license: "CC-BY-4.0",
    author_is_owner: true,
  },
  {
    planet_id: "bbb222",
    title: "Noncommercial growth playbook",
    text: "A growth playbook contributed under a noncommercial license.",
    license: "PolyForm-Noncommercial-1.0.0",
    author_is_owner: false, // a contributor's planet, NOT the owner's
  },
];

test("private-leak guard: an unpublished note's text is unreachable", async () => {
  // The index contains ONLY published planets — the secret was never seeded.
  const index = new FixturePlanetIndex(publishedPlanets);
  const retriever = new InternalRetriever(index);

  // Query for the secret's exact words.
  const chunks = await retriever.retrieve(
    "launch codes hunter2 safe combo 1234",
  );

  // No chunk may contain the secret text.
  for (const c of chunks) {
    assert.ok(
      !c.text.includes(SECRET_TEXT),
      "secret/unpublished text must never surface",
    );
    assert.ok(
      !c.text.includes("hunter2"),
      "no fragment of the unpublished note may leak",
    );
  }
});

test("Gate 1: every returned chunk has a resolving planet_id", async () => {
  const index = new FixturePlanetIndex(publishedPlanets);
  const retriever = new InternalRetriever(index);

  const chunks = await retriever.retrieve("funnel state machine growth");

  assert.ok(chunks.length > 0, "expected some matches");
  const ids = new Set(publishedPlanets.map((p) => p.planet_id));
  for (const c of chunks) {
    assert.equal(c.source, "internal");
    if (c.source === "internal") {
      assert.ok(c.planet_id, "chunk must carry a planet_id");
      assert.ok(
        ids.has(c.planet_id),
        "planet_id must resolve to a published planet",
      );
      // License carried in-band, copied off the planet.
      assert.equal(typeof c.license, "string");
      assert.ok(c.license.length > 0);
    }
  }
});

test("license is copied in-band onto each chunk", async () => {
  const index = new FixturePlanetIndex(publishedPlanets);
  const retriever = new InternalRetriever(index);
  const chunks = await retriever.retrieve("funnel state machine");
  const hit = chunks.find(
    (c) => c.source === "internal" && c.planet_id === "aaa111",
  );
  assert.ok(hit);
  if (hit && hit.source === "internal") {
    assert.equal(hit.license, "CC-BY-4.0");
  }
});

test("paid mode EXCLUDES a noncommercial contributor planet", async () => {
  const index = new FixturePlanetIndex(publishedPlanets);
  const retriever = new InternalRetriever(index);

  // Query that matches the noncommercial planet ("growth playbook").
  const paid = await retriever.retrieve("noncommercial growth playbook", {
    paid: true,
  });
  assert.ok(
    !paid.some((c) => c.source === "internal" && c.planet_id === "bbb222"),
    "noncommercial contributor planet must be dropped when paid",
  );
});

test("non-paid mode INCLUDES the same noncommercial planet", async () => {
  const index = new FixturePlanetIndex(publishedPlanets);
  const retriever = new InternalRetriever(index);

  const free = await retriever.retrieve("noncommercial growth playbook", {
    paid: false,
  });
  assert.ok(
    free.some((c) => c.source === "internal" && c.planet_id === "bbb222"),
    "noncommercial planet is fine in a free (non-resold) answer",
  );
});

test("paid mode KEEPS an owner-authored noncommercial planet", async () => {
  // author_is_owner overrides the noncommercial check — the owner may sell their own.
  const ownerNc: IndexedPlanet = {
    planet_id: "ccc333",
    title: "Owner noncommercial note",
    text: "owner authored under noncommercial but may resell their own work",
    license: "PolyForm-Noncommercial-1.0.0",
    author_is_owner: true,
  };
  const index = new FixturePlanetIndex([ownerNc]);
  const retriever = new InternalRetriever(index);
  const paid = await retriever.retrieve("owner noncommercial note", {
    paid: true,
  });
  assert.ok(
    paid.some((c) => c.source === "internal" && c.planet_id === "ccc333"),
  );
});

test("commercialUseOk / isCommercialLicense", () => {
  assert.equal(isCommercialLicense("CC-BY-4.0"), true);
  assert.equal(isCommercialLicense("PolyForm-Noncommercial-1.0.0"), false);
  assert.equal(isCommercialLicense("CC-BY-NC-4.0"), false);
  assert.equal(isCommercialLicense("Non-Commercial-1.0"), false);

  assert.equal(
    commercialUseOk({
      planet_id: "x",
      title: "",
      text: "",
      license: "PolyForm-Noncommercial-1.0.0",
      author_is_owner: true,
    }),
    true,
    "owner overrides noncommercial",
  );
  assert.equal(
    commercialUseOk({
      planet_id: "x",
      title: "",
      text: "",
      license: "PolyForm-Noncommercial-1.0.0",
      author_is_owner: false,
    }),
    false,
  );
});

test("opts.k caps the number of returned chunks", async () => {
  const many: IndexedPlanet[] = Array.from({ length: 20 }, (_, i) => ({
    planet_id: `p${i}`,
    title: `widget ${i}`,
    text: `a note about widget number ${i}`,
    license: "CC-BY-4.0",
    author_is_owner: true,
  }));
  const retriever = new InternalRetriever(new FixturePlanetIndex(many));
  const chunks = await retriever.retrieve("widget note", { k: 3 });
  assert.ok(chunks.length <= 3);
});
