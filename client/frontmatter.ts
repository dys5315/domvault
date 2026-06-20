// Minimal YAML-frontmatter parser/serializer — ZERO runtime deps (Node built-ins
// only). We deliberately support only the small subset of YAML that vault notes
// use: a leading `---` fenced block of `key: value` pairs, where values are
// scalars (string / number / boolean / null) or flow-style arrays (`[a, b, c]`).
//
// This is intentionally NOT a general YAML engine. The publish flow's privacy
// guarantee (strip.ts) depends on the parser being predictable: anything it
// can't classify stays a raw string and is treated as private by default.

export interface ParsedNote {
  /** Raw frontmatter key/value pairs, in file order. */
  frontmatter: Record<string, unknown>;
  /** Everything after the closing `---` fence (the note markdown). */
  body: string;
  /** True if a frontmatter block was present at all. */
  hadFrontmatter: boolean;
}

const FENCE = "---";

/** Parse a note's leading YAML frontmatter and its body. */
export function parseNote(raw: string): ParsedNote {
  // Normalise newlines so CRLF files behave identically.
  const text = raw.replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  if (lines[0]?.trim() !== FENCE) {
    return { frontmatter: {}, body: text, hadFrontmatter: false };
  }

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === FENCE) {
      end = i;
      break;
    }
  }
  if (end === -1) {
    // No closing fence — treat the whole thing as body (don't guess).
    return { frontmatter: {}, body: text, hadFrontmatter: false };
  }

  const frontmatter: Record<string, unknown> = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue; // not a key: value pair — skip (e.g. block list lines)
    const key = line.slice(0, colon).trim();
    if (key === "") continue;
    const rawValue = line.slice(colon + 1).trim();
    frontmatter[key] = parseScalarOrArray(rawValue);
  }

  const body = lines.slice(end + 1).join("\n").replace(/^\n+/, "");
  return { frontmatter, body, hadFrontmatter: true };
}

function parseScalarOrArray(value: string): unknown {
  if (value === "") return null;
  // Flow array: [a, b, c]
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((part) => parseScalar(part.trim()));
  }
  return parseScalar(value);
}

function parseScalar(value: string): unknown {
  // Strip matching surrounding quotes.
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d*\.\d+$/.test(value)) return Number(value);
  return value;
}

/** Serialize a frontmatter object back into a `---` fenced block. */
export function serializeFrontmatter(fm: Record<string, unknown>): string {
  const lines: string[] = [FENCE];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${serializeValue(value)}`);
  }
  lines.push(FENCE);
  return lines.join("\n");
}

function serializeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((v) => serializeScalar(v)).join(", ")}]`;
  }
  return serializeScalar(value);
}

function serializeScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  const str = String(value);
  // Quote if the value could be misparsed (contains special chars / looks typed).
  if (/[:#\[\]{}",']/.test(str) || /^(true|false|null|~)$/.test(str) || /^-?\d/.test(str)) {
    return JSON.stringify(str);
  }
  return str;
}

/** Reassemble a full note from frontmatter + body. */
export function serializeNote(fm: Record<string, unknown>, body: string): string {
  return `${serializeFrontmatter(fm)}\n\n${body.replace(/^\n+/, "")}\n`;
}
