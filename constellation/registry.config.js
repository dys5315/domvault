// Default registry the Explorer reads from. Override per-visit with ?registry=<url>.
//
// After you deploy the registry (PART 2), set this to your hosted HTTPS URL, e.g.
//   export const DEFAULT_REGISTRY = "https://domvault-registry.fly.dev";
// Until then it points at the local registry (npm run demo). If the registry is
// unreachable, the Explorer degrades to the offline mock (constellation/mock/data.json).
export const DEFAULT_REGISTRY = "http://localhost:8787";
