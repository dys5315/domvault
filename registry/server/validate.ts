// Hand-written validator for the node manifest, mirroring
// ../schema/node.schema.json exactly (the schema is the source of truth).
// No ajv, no deps. Enforced at the API boundary (server.ts POST /planets).

import type { NodeManifest } from "./types.ts";

type Result =
  | { ok: true; manifest: NodeManifest }
  | { ok: false; errors: string[] };

const CONTENT_HASH_RE = /^sha256:[a-f0-9]{64}$/;

// Mirrors the schema's `additionalProperties: false` at each object level.
const MANIFEST_KEYS = new Set([
  "id",
  "title",
  "summary",
  "author",
  "galaxy",
  "license",
  "links",
  "origin",
  "content_hash",
  "signature",
  "published_at",
  "version",
  "price",
]);
const AUTHOR_KEYS = new Set(["handle", "display", "star"]);
const PRICE_KEYS = new Set(["amount", "currency", "grants_license"]);

// schema.required for the manifest
const REQUIRED = [
  "id",
  "title",
  "author",
  "license",
  "content_hash",
  "published_at",
  "version",
] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function validateManifest(obj: unknown): Result {
  const errors: string[] = [];

  if (!isObject(obj)) {
    return { ok: false, errors: ["manifest must be a JSON object"] };
  }

  // additionalProperties: false
  for (const key of Object.keys(obj)) {
    if (!MANIFEST_KEYS.has(key)) {
      errors.push(`unexpected property: ${key}`);
    }
  }

  // required
  for (const key of REQUIRED) {
    if (!(key in obj)) errors.push(`missing required property: ${key}`);
  }

  // id
  if ("id" in obj && typeof obj.id !== "string") {
    errors.push("id must be a string");
  }

  // title (minLength 1)
  if ("title" in obj) {
    if (typeof obj.title !== "string") errors.push("title must be a string");
    else if (obj.title.length < 1) errors.push("title must be non-empty");
  }

  // summary (optional string)
  if ("summary" in obj && typeof obj.summary !== "string") {
    errors.push("summary must be a string");
  }

  // author (object, required handle + star, additionalProperties:false)
  if ("author" in obj) validateAuthor(obj.author, errors);

  // galaxy (optional string[])
  if ("galaxy" in obj && !isStringArray(obj.galaxy)) {
    errors.push("galaxy must be an array of strings");
  }

  // license (required string)
  if ("license" in obj && typeof obj.license !== "string") {
    errors.push("license must be a string");
  }

  // links (optional string[])
  if ("links" in obj && !isStringArray(obj.links)) {
    errors.push("links must be an array of strings");
  }

  // origin (string | null)
  if ("origin" in obj && obj.origin !== null && typeof obj.origin !== "string") {
    errors.push("origin must be a string or null");
  }

  // content_hash (required, pattern)
  if ("content_hash" in obj) {
    if (typeof obj.content_hash !== "string") {
      errors.push("content_hash must be a string");
    } else if (!CONTENT_HASH_RE.test(obj.content_hash)) {
      errors.push("content_hash must match ^sha256:[a-f0-9]{64}$");
    }
  }

  // signature (optional string)
  if ("signature" in obj && typeof obj.signature !== "string") {
    errors.push("signature must be a string");
  }

  // published_at (required string; schema format: date-time)
  if ("published_at" in obj) {
    if (typeof obj.published_at !== "string") {
      errors.push("published_at must be a string");
    } else if (Number.isNaN(Date.parse(obj.published_at))) {
      errors.push("published_at must be an ISO-8601 date-time");
    }
  }

  // version (required integer >= 1)
  if ("version" in obj) {
    if (typeof obj.version !== "number" || !Number.isInteger(obj.version)) {
      errors.push("version must be an integer");
    } else if (obj.version < 1) {
      errors.push("version must be >= 1");
    }
  }

  // price (object | null, additionalProperties:false)
  if ("price" in obj && obj.price !== undefined) {
    validatePrice(obj.price, errors);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: obj as unknown as NodeManifest };
}

function validateAuthor(author: unknown, errors: string[]): void {
  if (!isObject(author)) {
    errors.push("author must be an object");
    return;
  }
  for (const key of Object.keys(author)) {
    if (!AUTHOR_KEYS.has(key)) errors.push(`author: unexpected property: ${key}`);
  }
  if (!("handle" in author)) errors.push("author: missing required property: handle");
  else if (typeof author.handle !== "string") errors.push("author.handle must be a string");

  if (!("star" in author)) errors.push("author: missing required property: star");
  else if (typeof author.star !== "string") errors.push("author.star must be a string");

  if ("display" in author && typeof author.display !== "string") {
    errors.push("author.display must be a string");
  }
}

function validatePrice(price: unknown, errors: string[]): void {
  if (price === null) return; // null allowed
  if (!isObject(price)) {
    errors.push("price must be an object or null");
    return;
  }
  for (const key of Object.keys(price)) {
    if (!PRICE_KEYS.has(key)) errors.push(`price: unexpected property: ${key}`);
  }
  if ("amount" in price) {
    if (typeof price.amount !== "number") errors.push("price.amount must be a number");
    else if (price.amount < 0) errors.push("price.amount must be >= 0");
  }
  if ("currency" in price && typeof price.currency !== "string") {
    errors.push("price.currency must be a string");
  }
  if ("grants_license" in price && typeof price.grants_license !== "string") {
    errors.push("price.grants_license must be a string");
  }
}
