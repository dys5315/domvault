// Default registry the Explorer reads from. Override per-visit with ?registry=<url>.
//
// Hosted registry (deployed to Fly.io, ewr region, durable volume). Override per-visit
// with ?registry=<url> (e.g. ?registry=http://localhost:8787 for a local one). If the
// registry is unreachable, the Explorer degrades to the offline mock (mock/data.json).
export const DEFAULT_REGISTRY = "https://domvault-registry.fly.dev";
