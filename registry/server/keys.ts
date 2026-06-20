// Ed25519 signing for Constellation manifests (SPEC §5: authorship can't be
// spoofed). Signatures are computed over the canonical, id+signature-excluded
// JSON of the manifest — the same payload that derives the id — so a signature
// binds the author to the exact content and id of their planet.

import {
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import type { NodeManifest } from "./types.ts";
import { canonicalManifest } from "./hash.ts";

export interface Keypair {
  // PEM-encoded keys (SPKI public / PKCS8 private). Self-contained, no deps.
  publicKey: string;
  privateKey: string;
}

/** Generate a fresh ed25519 keypair as PEM strings. */
export function generateKeypair(): Keypair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

/**
 * Sign the canonical manifest with a PEM-encoded ed25519 private key.
 * Returns a base64 signature string (what goes in `manifest.signature`).
 * Ed25519 in Node uses a null algorithm argument (it hashes internally).
 */
export function sign(manifest: NodeManifest, privateKey: string): string {
  const payload = Buffer.from(canonicalManifest(manifest), "utf8");
  const sig = cryptoSign(null, payload, privateKey);
  return sig.toString("base64");
}

/**
 * Verify a base64 signature over the manifest's canonical form against a
 * PEM-encoded ed25519 public key. Returns false on any failure (bad signature,
 * malformed key, malformed base64) rather than throwing.
 */
export function verify(
  manifest: NodeManifest,
  signature: string,
  publicKey: string,
): boolean {
  try {
    const payload = Buffer.from(canonicalManifest(manifest), "utf8");
    const sig = Buffer.from(signature, "base64");
    return cryptoVerify(null, payload, publicKey, sig);
  } catch {
    return false;
  }
}
