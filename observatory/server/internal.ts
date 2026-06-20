// InternalRetriever — the read side's private-leak guard, implemented (Prompt F).
// Spec: docs/09-observatory-agent-query-endpoint.md §3 + §6.
//
// ISOLATION INVARIANTS THIS FILE ENFORCES (doc 09 §6):
//   1. The vault never leaks. We search the PUBLISHED index only (the injected
//      PlanetIndex), never raw vault files, never `publish: false` notes. A chunk
//      with no resolving planet_id cannot enter an answer — that IS Gate 1.
//   2. License travels with the content. Each planet's license is copied onto its
//      chunk in-band (registry/SPEC §5); nothing is relicensed by omission.
//   4. Consent is inherited, not re-litigated. We only read what the publish step
//      (Prompt C) already gated public; we never widen that surface.
//
// This retriever emits ONLY `internal` chunks. External/fused retrieval is Prompt G
// (doc 10); it implements the SAME `Retriever` interface and is injected at the
// endpoint, never welded in here.

import type {
  Chunk,
  IndexedPlanet,
  PlanetIndex,
  RetrieveOpts,
  Retriever,
} from "./types.ts";

const DEFAULT_K = 12;

/**
 * Is this planet's content OK to resell in a PAID third-party answer? (doc 10 §5)
 *
 * Two ways to clear the bar:
 *   - `author_is_owner` — it's the Observatory owner's OWN planet; they may sell it.
 *   - `isCommercialLicense(license)` — a contributor explicitly granted commercial use.
 *
 * WHY this gate exists: in paid mode we are *reselling* retrieved knowledge to a
 * third party. A contributor who published under a Noncommercial license did NOT
 * consent to that resale — surfacing their planet in a sold answer would violate
 * THEIR license (registry/SPEC §5: "commercial reuse of a Noncommercial planet is a
 * visible violation"). So paid answers narrow to owner-authored or commercial-OK
 * planets. Unpaid answers are unaffected.
 */
export function commercialUseOk(planet: IndexedPlanet): boolean {
  return planet.author_is_owner || isCommercialLicense(planet.license);
}

/**
 * A license is commercial-OK unless it is explicitly Noncommercial.
 * Conservative by construction: anything that *looks* Noncommercial is treated as
 * NOT commercial. Case-insensitive; tolerates "Noncommercial", "Non-Commercial",
 * "non commercial" spellings (e.g. "PolyForm-Noncommercial-1.0.0", "CC-BY-NC-4.0").
 */
export function isCommercialLicense(license: string): boolean {
  const l = license.toLowerCase();
  if (l.includes("noncommercial")) return false;
  if (l.includes("non-commercial")) return false;
  if (l.includes("non commercial")) return false;
  // CC "-NC" / "-NC-" token (e.g. cc-by-nc, cc-by-nc-sa).
  if (/(^|[-_\s])nc([-_\s]|$)/.test(l)) return false;
  return true;
}

export class InternalRetriever implements Retriever {
  // The retriever holds ONLY the published index. It has no path to raw files;
  // that absence is the structural guarantee behind "the vault never leaks".
  constructor(private readonly index: PlanetIndex) {}

  async retrieve(query: string, opts: RetrieveOpts = {}): Promise<Chunk[]> {
    const k = opts.k ?? DEFAULT_K;
    const paid = opts.paid === true;

    // Search the PUBLISHED index only. Whatever this returns is, by the
    // PlanetIndex contract, already-published content.
    const planets = await this.index.search(query, k);

    const chunks: Chunk[] = [];
    for (const planet of planets) {
      // GATE 1 (private-leak guard): a chunk exists ONLY if it resolves to a real
      // published planet_id. Defensive even though the index should never hand us
      // an idless planet — the gate is enforced at retrieval, not trusted upstream.
      if (!planet.planet_id) continue;

      // PAID MODE: drop planets that aren't commercially licensable. See
      // commercialUseOk() above for why reselling a Noncommercial planet is a
      // license violation.
      if (paid && !commercialUseOk(planet)) continue;

      chunks.push({
        source: "internal",
        planet_id: planet.planet_id,
        license: planet.license, // license-in-band, copied off the planet (SPEC §5)
        text: planet.text,
        score: planet.score ?? 0,
      });

      if (chunks.length >= k) break;
    }

    return chunks;
  }
}
