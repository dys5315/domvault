// FixturePlanetIndex — an in-memory PlanetIndex for dev + tests (Prompt F).
// Spec: docs/09-observatory-agent-query-endpoint.md §1 (seed a fixture index) + §3.
//
// This is the DEFAULT index F runs against so the Observatory is testable
// standalone, before the real registry (Prompt A) exists. At integration, the real
// registry feeds this same interface — see the `fromRegistry` ADAPTER STUB below.
//
// CONTRACT (types.ts): a PlanetIndex searches the PUBLISHED index only. This fixture
// upholds that by construction — you can only seed it with IndexedPlanet rows, which
// are by definition published bodies (private fields already stripped at publish time
// by Prompt C). There is no path here to a raw vault file or a `publish: false` note;
// if a planet isn't in the seeded array, it is simply unreachable. That absence is
// exactly how the private-leak guard is exercised in tests.

import type { IndexedPlanet, PlanetIndex } from "./types.ts";

/** Lowercase alphanumeric word tokens. Shared by the scorer and query parsing. */
function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Simple lexical (term-overlap) score: how many distinct query terms appear in the
 * planet's title+text, lightly weighting title hits. Deterministic, dependency-free.
 * Real retrieval (BM25/embeddings) swaps in behind the same PlanetIndex interface.
 */
function lexicalScore(queryTerms: Set<string>, planet: IndexedPlanet): number {
  if (queryTerms.size === 0) return 0;
  const titleTerms = new Set(tokenize(planet.title));
  const bodyTerms = new Set(tokenize(planet.text));
  let score = 0;
  for (const term of queryTerms) {
    if (titleTerms.has(term)) score += 2; // title match weighted higher
    else if (bodyTerms.has(term)) score += 1;
  }
  return score;
}

export class FixturePlanetIndex implements PlanetIndex {
  // The seeded set IS the entire searchable universe for this index. Nothing
  // outside this array can ever be returned — that's the leak guard at fixture level.
  private readonly planets: readonly IndexedPlanet[];

  constructor(planets: readonly IndexedPlanet[]) {
    this.planets = planets;
  }

  async search(query: string, k: number): Promise<IndexedPlanet[]> {
    const queryTerms = new Set(tokenize(query));

    const scored = this.planets
      .map((planet) => ({
        planet,
        // Prefer any precomputed score; otherwise compute lexical overlap.
        score: planet.score ?? lexicalScore(queryTerms, planet),
      }))
      .filter((r) => r.score > 0) // only return planets with some relevance
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, k));

    // Stamp the computed score back onto the returned planet so the retriever can
    // copy it onto the chunk (retriever-native, raw scale — doc 10 §4).
    return scored.map((r) => ({ ...r.planet, score: r.score }));
  }
}

// ── ADAPTER STUB: real registry → PlanetIndex (integration only) ──────────────
//
// At integration the published index comes from the registry (Prompt A), via
// `GET /universe` (crawl the graph) or `GET /stars/{handle}` (one brain's planets)
// — see registry/SPEC §6. Each registry manifest + body maps to one IndexedPlanet.
//
// This stub is intentionally NOT wired in: F must stay testable standalone, so the
// FixturePlanetIndex above remains the default. When Prompt A is live, implement the
// fetch + map below (or back it with a real search service) and inject the resulting
// PlanetIndex into the retriever instead of the fixture — no other F code changes,
// because everything depends on the PlanetIndex *interface*, not this class.
//
// The map is the only interesting part:
//   manifest.id          → planet_id   (Gate-1 proof; must be present)
//   manifest.title       → title
//   <published body>     → text        (private fields already stripped by Prompt C)
//   manifest.license     → license     (in-band, SPEC §5)
//   author === ownerStar → author_is_owner  (drives paid-mode licensing, doc 10 §5)
export interface RegistryClient {
  // Mirrors registry/SPEC §6. Returns published manifests (+ bodies). Implemented
  // by Prompt A's client; only the shape matters here.
  fetchUniverse(): Promise<
    Array<{
      id: string;
      title: string;
      body: string;
      license: string;
      author: { star: string };
    }>
  >;
}

/**
 * STUB. Build a PlanetIndex from the live registry. Keep the FixturePlanetIndex as the
 * default until Prompt A is available; this shows the intended integration only.
 *
 * @param client    a registry client (Prompt A) exposing the published crawl API
 * @param ownerStar the star id of the brain running this Observatory — used to set
 *                  `author_is_owner` so paid-mode licensing (doc 10 §5) works.
 */
export async function fromRegistry(
  client: RegistryClient,
  ownerStar: string,
): Promise<PlanetIndex> {
  const manifests = await client.fetchUniverse();
  const planets: IndexedPlanet[] = manifests.map((m) => ({
    planet_id: m.id,
    title: m.title,
    text: m.body, // already private-stripped at publish time (Prompt C)
    license: m.license,
    author_is_owner: m.author.star === ownerStar,
  }));
  // A real deployment would back search() with a proper index/search service rather
  // than the in-memory lexical scorer; the fixture is sufficient for F's tests.
  return new FixturePlanetIndex(planets);
}
