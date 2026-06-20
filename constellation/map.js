// map.js — turn the registry's /universe manifest list into the Explorer's render shape.
//
// Dependency-free ES module, imported by BOTH the browser Explorer (index.html,
// <script type="module">) and a Node test (map.test.ts) — so the mapping is verified.
//
// /universe returns manifests (SPEC §2). The renderer wants:
//   { galaxies: [ { id, name, color, stars: [ { handle, display, planets: [ {name, manifest} ] } ] } ] }
//   GALAXY  = manifest.galaxy[]   (a planet can sit in several)
//   STAR    = author.star/handle  (one solar system per brain)
//   PLANET  = the manifest itself (name = title; the full manifest rides along for the detail panel)

// Galaxy display catalog — id → { name, color }. Shared source of truth with
// scripts/publish-frameworks.ts (which assigns the ids from tags). Unknown ids fall
// back to a generated label so a new galaxy never disappears.
export const GALAXY_CATALOG = {
  "ai-engineering": { name: "AI Engineering", color: "#7c5cff" },
  "product-growth": { name: "Product & Growth", color: "#ff5ca8" },
  "quant-markets": { name: "Quant & Markets", color: "#39d0d8" },
  systems: { name: "Systems & Engineering", color: "#5cd6a8" },
  knowledge: { name: "Knowledge & Learning", color: "#f0b54d" },
  leadership: { name: "Leadership & Decisions", color: "#e85c5c" },
  frameworks: { name: "Frameworks", color: "#9aa0b5" },
};

const FALLBACK_COLORS = ["#7c5cff", "#ff5ca8", "#39d0d8", "#5cd6a8", "#f0b54d", "#e85c5c", "#9aa0b5"];

function galaxyMeta(id, index) {
  return (
    GALAXY_CATALOG[id] ?? {
      name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      color: FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    }
  );
}

/**
 * @param {Array<object>} planets - the `planets` array from GET /universe (manifests)
 * @returns {{galaxies: Array}} the renderer's data shape
 */
export function mapUniverseToData(planets) {
  // galaxyId -> { ...meta, starsByHandle: Map<handle, star> }
  const galaxies = new Map();

  for (const m of planets ?? []) {
    const galaxyIds = Array.isArray(m.galaxy) && m.galaxy.length ? m.galaxy : ["frameworks"];
    const handle = m.author?.star ?? m.author?.handle ?? "unknown";
    const display = m.author?.display ?? m.author?.handle ?? handle;

    for (const gid of galaxyIds) {
      if (!galaxies.has(gid)) {
        const meta = galaxyMeta(gid, galaxies.size);
        galaxies.set(gid, { id: gid, name: meta.name, color: meta.color, starsByHandle: new Map() });
      }
      const g = galaxies.get(gid);
      if (!g.starsByHandle.has(handle)) {
        g.starsByHandle.set(handle, { handle, display, planets: [] });
      }
      // Planet entry: name for the label, the full manifest for the click-to-inspect panel.
      g.starsByHandle.get(handle).planets.push({ name: m.title, manifest: m });
    }
  }

  return {
    galaxies: [...galaxies.values()].map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      stars: [...g.starsByHandle.values()],
    })),
  };
}
