// Tests for the Explorer's /universe → render-shape mapping (Prompt H, STEP 7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapUniverseToData, GALAXY_CATALOG } from "./map.js";

// A representative /universe payload: two brains, overlapping + multi-galaxy planets.
const UNIVERSE = [
  {
    id: "planet_aaa", title: "Backtest Is a Double Pendulum",
    author: { handle: "dom", display: "Dom S.", star: "star_dom" },
    galaxy: ["quant-markets"], license: "PolyForm-Noncommercial-1.0.0", version: 1,
  },
  {
    id: "planet_bbb", title: "Agent Memory Is a Kalman Filter",
    author: { handle: "dom", display: "Dom S.", star: "star_dom" },
    galaxy: ["ai-engineering"], license: "PolyForm-Noncommercial-1.0.0", version: 1,
  },
  {
    id: "planet_ccc", title: "A Ranking Function for Trust",
    author: { handle: "ava", display: "Ava", star: "star_ava" },
    // multi-galaxy planet → must appear under BOTH
    galaxy: ["ai-engineering", "leadership"], license: "PolyForm-Noncommercial-1.0.0", version: 2,
    origin: "planet_zzz", // a moon — lineage must survive into the manifest the panel reads
  },
];

test("buckets planets by galaxy and by star", () => {
  const { galaxies } = mapUniverseToData(UNIVERSE);
  const byId = Object.fromEntries(galaxies.map((g) => [g.id, g]));

  // galaxies present
  assert.ok(byId["quant-markets"], "quant-markets galaxy exists");
  assert.ok(byId["ai-engineering"], "ai-engineering galaxy exists");
  assert.ok(byId["leadership"], "leadership galaxy exists (from the multi-galaxy planet)");

  // catalog name/color applied
  assert.equal(byId["ai-engineering"].name, GALAXY_CATALOG["ai-engineering"].name);
  assert.equal(byId["ai-engineering"].color, GALAXY_CATALOG["ai-engineering"].color);

  // ai-engineering has two stars (dom + ava); dom→Kalman, ava→Ranking
  const ai = byId["ai-engineering"];
  const handles = ai.stars.map((s) => s.handle).sort();
  assert.deepEqual(handles, ["star_ava", "star_dom"]);
  const domPlanets = ai.stars.find((s) => s.handle === "star_dom").planets.map((p) => p.name);
  assert.deepEqual(domPlanets, ["Agent Memory Is a Kalman Filter"]);
});

test("a multi-galaxy planet lands under EVERY galaxy it declares", () => {
  const { galaxies } = mapUniverseToData(UNIVERSE);
  const inAi = galaxies.find((g) => g.id === "ai-engineering")
    .stars.find((s) => s.handle === "star_ava").planets.some((p) => p.manifest.id === "planet_ccc");
  const inLead = galaxies.find((g) => g.id === "leadership")
    .stars.find((s) => s.handle === "star_ava").planets.some((p) => p.manifest.id === "planet_ccc");
  assert.ok(inAi && inLead, "planet_ccc appears under both ai-engineering and leadership");
});

test("planet entry carries the full manifest for the detail panel (incl. lineage)", () => {
  const { galaxies } = mapUniverseToData(UNIVERSE);
  const ccc = galaxies.find((g) => g.id === "leadership")
    .stars.find((s) => s.handle === "star_ava").planets.find((p) => p.manifest.id === "planet_ccc");
  assert.equal(ccc.name, "A Ranking Function for Trust");
  assert.equal(ccc.manifest.origin, "planet_zzz", "lineage/origin survives into the panel data");
  assert.equal(ccc.manifest.version, 2);
  assert.equal(ccc.manifest.license, "PolyForm-Noncommercial-1.0.0");
});

test("planets with no galaxy fall back to 'frameworks' (never an undifferentiated void)", () => {
  const { galaxies } = mapUniverseToData([
    { id: "planet_x", title: "Untagged", author: { star: "star_dom", display: "Dom" } },
  ]);
  assert.equal(galaxies.length, 1);
  assert.equal(galaxies[0].id, "frameworks");
});

test("empty / missing input yields an empty universe (no throw)", () => {
  assert.deepEqual(mapUniverseToData([]).galaxies, []);
  assert.deepEqual(mapUniverseToData(undefined).galaxies, []);
});
