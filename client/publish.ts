// publish.ts — orchestrates the consent-by-construction publish flow (SPEC §3):
//
//   stripNote  →  buildManifest  →  renderDiff  →  [confirm?]  →  sign  →  POST  →  write-back
//
// Confirmation, signing, and the registry POST are all INJECTABLE so the flow is
// unit-testable without a live server, a real keypair prompt, or a TTY.

import type { Author, NodeManifest } from "../registry/server/types.ts";
import { sign as signManifest } from "../registry/server/keys.ts";
import { parseNote, serializeNote } from "./frontmatter.ts";
import { stripNote, type StripOptions } from "./strip.ts";
import { buildManifest, type BuildManifestOptions, type BuiltPlanet } from "./manifest.ts";
import { renderDiff } from "./diff.ts";

/** What the registry returns from POST /planets (SPEC §6). */
export interface PublishResponse {
  id: string;
}

/** Injectable transport: POST a JSON payload to a URL, get JSON back. */
export type PostFn = (url: string, payload: unknown) => Promise<PublishResponse>;

/** Injectable confirmation gate; receives the rendered diff, returns approval. */
export type ConfirmFn = (diff: string) => Promise<boolean> | boolean;

/** Injectable signer (defaults to ed25519 over the canonical manifest). */
export type SignFn = (manifest: NodeManifest) => string;

export interface PublishConfig {
  /** Base URL of the registry, e.g. "http://localhost:8787". */
  registryUrl: string;
  /** The publishing brain's identity. */
  author: Author;
  /** The brain's PEM private key (used by the default signer). */
  privateKey?: string;
  /** The brain's PEM public key (sent alongside the manifest, SPEC §6). */
  publicKey: string;
  /** Confirmation gate (interactive in the CLI, scripted in tests). */
  confirm: ConfirmFn;
  /** Override the registry POST (defaults to node:http). */
  post?: PostFn;
  /** Private-beta publish token (the registry's PUBLISH_TOKEN). Sent as
   *  `Authorization: Bearer`. Authenticates the WRITE only — never signed into the
   *  manifest, never written to the vault. Omit when the registry's gate is off. */
  publishToken?: string;
  /** Override signing (defaults to keys.ts ed25519 sign over the manifest). */
  sign?: SignFn;
  /** Link resolution + other strip options. */
  strip?: StripOptions;
  /** Manifest build options (version, publishedAt, origin, license). */
  build?: BuildManifestOptions;
}

export interface PublishResult {
  /** "published" if confirmed & POSTed; "cancelled" if the user declined. */
  status: "published" | "cancelled";
  planet?: BuiltPlanet;
  /** The note text with `planet_id`/`published` written back into frontmatter. */
  updatedNote?: string;
  diff: string;
}

/**
 * Run the full publish flow against a raw note string. Returns the result plus
 * the rewritten note text (with the planet id written back). Does NOT touch the
 * filesystem — cli.ts wires that in.
 */
export async function publishNote(raw: string, config: PublishConfig): Promise<PublishResult> {
  // 1. STRIP — the privacy gate (throws if not publish:true).
  const stripped = stripNote(raw, config.strip);

  // 2. BUILD — content-addressed manifest.
  const planet = buildManifest(stripped, config.author, config.build);

  // 3. DIFF — show exactly what leaves the machine.
  const diff = renderDiff({ stripped, planet });

  // 4. CONFIRM — consent gate.
  const approved = await config.confirm(diff);
  if (!approved) {
    return { status: "cancelled", planet, diff };
  }

  // 5. SIGN — authorship can't be spoofed (SPEC §5).
  const sign = config.sign ?? defaultSigner(config.privateKey);
  const signature = sign(planet.manifest);
  const signedManifest: NodeManifest = { ...planet.manifest, signature };

  // 6. POST — publish the signed manifest + body + public key (SPEC §6).
  //    config.publishToken (if set) gates the write during private beta.
  const post = config.post ?? makeDefaultPost(config.publishToken);
  const resp = await post(`${trimSlash(config.registryUrl)}/planets`, {
    manifest: signedManifest,
    body: planet.body,
    publicKey: config.publicKey,
  });

  // The registry is the authority on the final id; trust its response.
  const publishedId = resp.id || signedManifest.id;
  const signedPlanet: BuiltPlanet = {
    manifest: { ...signedManifest, id: publishedId },
    body: planet.body,
  };

  // 7. WRITE BACK — record planet id in the note frontmatter (SPEC §3).
  const updatedNote = writeBackPlanetId(raw, publishedId);

  return { status: "published", planet: signedPlanet, updatedNote, diff };
}

function defaultSigner(privateKey: string | undefined): SignFn {
  if (!privateKey) {
    throw new Error("publishNote: no `sign` fn and no `privateKey` provided to sign the manifest.");
  }
  return (manifest) => signManifest(manifest, privateKey);
}

/** Record the assigned planet id (and confirm published flag) in frontmatter. */
export function writeBackPlanetId(raw: string, planetId: string): string {
  const parsed = parseNote(raw);
  const fm: Record<string, unknown> = { ...parsed.frontmatter };
  fm["planet_id"] = planetId;
  fm["publish"] = true;
  return serializeNote(fm, parsed.body);
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Default registry POST over node:http (no fetch/runtime deps). When a publish
 *  token is supplied (the private-beta gate), it rides as `Authorization: Bearer`.
 *  The token authenticates the WRITE; it is NOT part of the signed manifest and never
 *  touches the vault — it's a beta access credential, set via env on the publisher. */
export function makeDefaultPost(token?: string): PostFn {
  return async (url, payload) => {
    const { request } = await import("node:http");
    const { request: requestHttps } = await import("node:https");
    return new Promise<PublishResponse>((resolve, reject) => {
      const u = new URL(url);
      const data = Buffer.from(JSON.stringify(payload), "utf8");
      const headers: Record<string, string | number> = {
        "content-type": "application/json",
        "content-length": data.length,
      };
      if (token) headers["authorization"] = `Bearer ${token}`;
      const req = (u.protocol === "https:" ? requestHttps : request)(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port,
          path: u.pathname + u.search,
          method: "POST",
          headers,
        },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(new Error(`Registry POST failed (${status}): ${text}`));
            return;
          }
          try {
            resolve(JSON.parse(text) as PublishResponse);
          } catch {
            reject(new Error(`Registry returned non-JSON response: ${text}`));
          }
        });
      },
    );
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  };
}
