// Production entrypoint for the Constellation registry. Unlike server.ts's
// import-guard (which only fires when run directly), this ALWAYS starts the server —
// so it survives bundling (esbuild → node dist/registry.mjs) without depending on
// import.meta.url matching argv. All config from env; no secrets in the repo.
//
// INVARIANTS: storage durable (STORE_DIR → mounted volume); reads public, writes
// gated by PUBLISH_TOKEN during beta; every signature verified server-side; HTTPS is
// terminated by the host; ops-only logging (LOG_REQUESTS), zero user telemetry.
import { createServer } from "./server.ts";
import { PlanetStore } from "./store.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);
const store = new PlanetStore(config.storeDir);

createServer(store, config).listen(config.port, () => {
  process.stderr.write(
    `constellation-registry on :${config.port} · store=${config.storeDir} · ` +
      `writes=${config.publishToken ? "gated(token)" : "open"} · ` +
      `rate=${config.rateLimitPerMin}/min · cors=${config.corsOrigin} · log=${config.logRequests}\n`,
  );
});
