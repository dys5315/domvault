// Filesystem-backed planet object store (SPEC §6: "Postgres + object store").
// One JSON file per planet under a configurable data dir, mirrored by an
// in-memory map for fast lookup/listing. Zero deps — node:fs + node:path only.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { StoredPlanet } from "./types.ts";

const DEFAULT_DIR = "registry/.data";

export class PlanetStore {
  private readonly dir: string;
  private readonly planets = new Map<string, StoredPlanet>();

  constructor(dir: string = DEFAULT_DIR) {
    this.dir = dir;
    mkdirSync(this.dir, { recursive: true });
    this.load();
  }

  /** Rehydrate the in-memory map from any JSON files already on disk. */
  private load(): void {
    if (!existsSync(this.dir)) return;
    for (const file of readdirSync(this.dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = readFileSync(join(this.dir, file), "utf8");
        const planet = JSON.parse(raw) as StoredPlanet;
        if (planet?.manifest?.id) this.planets.set(planet.manifest.id, planet);
      } catch {
        // Skip unreadable/corrupt files rather than crash the store.
      }
    }
  }

  private fileFor(id: string): string {
    // ids are content-addressed ("planet_<hex>") so they're filesystem-safe,
    // but encode defensively in case a caller persists an arbitrary id.
    return join(this.dir, `${encodeURIComponent(id)}.json`);
  }

  put(planet: StoredPlanet): void {
    const id = planet.manifest.id;
    this.planets.set(id, planet);
    writeFileSync(this.fileFor(id), JSON.stringify(planet, null, 2), "utf8");
  }

  get(id: string): StoredPlanet | undefined {
    return this.planets.get(id);
  }

  /** Unpublish. Returns true if a planet was removed. */
  del(id: string): boolean {
    const existed = this.planets.delete(id);
    const file = this.fileFor(id);
    if (existsSync(file)) rmSync(file);
    return existed;
  }

  /** All public planets by a given author handle (SPEC §6: GET /stars/{handle}). */
  listByStar(handle: string): StoredPlanet[] {
    return this.all().filter((p) => p.manifest.author.handle === handle);
  }

  /** All public planets tagged with a galaxy slug (SPEC §6: GET /galaxies/{slug}). */
  listByGalaxy(slug: string): StoredPlanet[] {
    return this.all().filter((p) => (p.manifest.galaxy ?? []).includes(slug));
  }

  /**
   * The whole universe, optionally only planets published at/after `since`
   * (ISO-8601). Sorted oldest-first so a crawler can page forward in time.
   */
  universe(since?: string): StoredPlanet[] {
    const sinceTs = since ? Date.parse(since) : undefined;
    return this.all()
      .filter((p) => {
        if (sinceTs === undefined || Number.isNaN(sinceTs)) return true;
        return Date.parse(p.manifest.published_at) >= sinceTs;
      })
      .sort(
        (a, b) =>
          Date.parse(a.manifest.published_at) -
          Date.parse(b.manifest.published_at),
      );
  }

  private all(): StoredPlanet[] {
    return [...this.planets.values()];
  }
}
