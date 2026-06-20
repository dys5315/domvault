#!/usr/bin/env -S npx tsx
// cli.ts — thin CLI entry wiring the publish/pull flow to the filesystem.
//
//   tsx client/cli.ts publish <note.md>     — strip → diff → confirm → publish
//   tsx client/cli.ts pull <planet_id>       — fetch a planet → write a moon note
//
// Identity/keys are read from env (no telemetry, no hidden state):
//   CONSTELLATION_REGISTRY   registry base URL (default http://localhost:8787)
//   CONSTELLATION_HANDLE     author handle (e.g. "dom")
//   CONSTELLATION_STAR       author star id (e.g. "star_dom")
//   CONSTELLATION_DISPLAY    optional display name
//   CONSTELLATION_PRIVKEY    path to PEM private key
//   CONSTELLATION_PUBKEY     path to PEM public key

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import type { Author, StoredPlanet } from "../registry/server/types.ts";
import { publishNote } from "./publish.ts";
import { pull, IMPORTED_DIR } from "./pull.ts";
import { PublishRefusedError } from "./strip.ts";

async function main(argv: string[]): Promise<number> {
  const [cmd, arg] = argv;
  switch (cmd) {
    case "publish":
      if (!arg) return usage("publish <note.md>");
      return runPublish(arg);
    case "pull":
      if (!arg) return usage("pull <planet_id>");
      return runPull(arg);
    default:
      return usage();
  }
}

async function runPublish(notePath: string): Promise<number> {
  const abs = resolve(notePath);
  const raw = await readFile(abs, "utf8");
  const author = authorFromEnv();
  const registryUrl = env("CONSTELLATION_REGISTRY") ?? "http://localhost:8787";
  const privateKey = await maybeReadKey(env("CONSTELLATION_PRIVKEY"));
  const publicKey = (await maybeReadKey(env("CONSTELLATION_PUBKEY"))) ?? "";

  try {
    const result = await publishNote(raw, {
      registryUrl,
      author,
      privateKey,
      publicKey,
      confirm: async (diff) => {
        process.stdout.write(diff + "\n\n");
        return askYesNo("Publish this to the registry?");
      },
    });

    if (result.status === "cancelled") {
      process.stdout.write("Cancelled. Nothing was sent.\n");
      return 0;
    }
    if (result.updatedNote) {
      await writeFile(abs, result.updatedNote, "utf8");
    }
    process.stdout.write(`Published: ${result.planet?.manifest.id}\n`);
    process.stdout.write(`Wrote planet id back into ${notePath}\n`);
    return 0;
  } catch (err) {
    if (err instanceof PublishRefusedError) {
      process.stderr.write(`Refused: ${err.message}\n`);
      return 2;
    }
    throw err;
  }
}

async function runPull(planetId: string): Promise<number> {
  const registryUrl = (env("CONSTELLATION_REGISTRY") ?? "http://localhost:8787").replace(/\/+$/, "");
  const planet = await fetchPlanet(`${registryUrl}/planets/${encodeURIComponent(planetId)}`);
  const moon = pull(planet);
  const dest = resolve(join(process.cwd(), moon.path));
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, moon.contents, "utf8");
  process.stdout.write(`Pulled moon of ${moon.origin} → ${join(IMPORTED_DIR, dest.split("/").pop()!)}\n`);
  return 0;
}

// ── env / io helpers ────────────────────────────────────────────────────────

function authorFromEnv(): Author {
  const handle = env("CONSTELLATION_HANDLE");
  const star = env("CONSTELLATION_STAR");
  if (!handle || !star) {
    throw new Error("Set CONSTELLATION_HANDLE and CONSTELLATION_STAR to publish.");
  }
  const display = env("CONSTELLATION_DISPLAY");
  return display ? { handle, star, display } : { handle, star };
}

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v : undefined;
}

async function maybeReadKey(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  return readFile(resolve(path), "utf8");
}

async function fetchPlanet(url: string): Promise<StoredPlanet> {
  const { request } = await import("node:http");
  const { request: requestHttps } = await import("node:https");
  return new Promise<StoredPlanet>((resolveP, reject) => {
    const u = new URL(url);
    const req = (u.protocol === "https:" ? requestHttps : request)(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: "GET",
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`GET ${url} failed (${status}): ${text}`));
            return;
          }
          try {
            resolveP(JSON.parse(text) as StoredPlanet);
          } catch {
            reject(new Error(`Registry returned non-JSON: ${text}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolveP) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolveP(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

function usage(specific?: string): number {
  const msg = specific
    ? `usage: tsx client/cli.ts ${specific}\n`
    : "usage: tsx client/cli.ts <publish <note.md> | pull <planet_id>>\n";
  process.stderr.write(msg);
  return 1;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
