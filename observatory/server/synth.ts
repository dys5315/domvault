// TemplateSynthesizer — deterministic, dependency-free synthesis (Prompt F).
// Spec: docs/09-observatory-agent-query-endpoint.md §4 + §6.
//
// WHY a template (not an LLM): F must be zero-runtime-dep and testable. A template
// synthesizer composes the answer from the chunks deterministically — same chunks,
// same answer — so the labeling, license, and SANDBOX invariants are unit-testable.
// A real LLM synthesizer swaps in behind the SAME `Synthesizer` interface later; the
// sandbox + labeling rules below are exactly what its prompt-builder must also do.
//
// INVARIANTS THIS FILE ENFORCES (doc 09 §4 + §6):
//   - Distinct labeling: internal claims as [planet_<id>], external as [<provider>].
//     A reader can always tell the owner's published knowledge from a third party's.
//   - License travels: license_summary is read straight off the chunks' in-band
//     license fields; nothing is relicensed by omission. Any external chunk →
//     contains_third_party=true and redistribution="restricted".
//   - Retrieved text is DATA, not instructions: every chunk's text is wrapped in
//     explicit delimiters and delimiter-breaking sequences are escaped (sandbox()).
//     External chunks are the larger threat (doc 10 §6) but ALL text is sandboxed.

import type {
  Answer,
  Chunk,
  Citation,
  LicenseSummary,
  Synthesizer,
} from "./types.ts";

// Sandbox fence markers. Untrusted chunk text lives strictly between these; any
// occurrence of the markers inside the text is escaped so the data can never close
// its own fence and smuggle in trailing instructions.
const FENCE_OPEN = "<<<UNTRUSTED_DATA>>>";
const FENCE_CLOSE = "<<<END_UNTRUSTED_DATA>>>";

/**
 * Wrap untrusted chunk text so it is unambiguously DATA, never instructions
 * (doc 09 §4, §6.3). Two defenses:
 *   1. Escape any literal fence markers found in the text so the text cannot
 *      terminate its own sandbox and inject following content as a directive.
 *   2. Wrap the (escaped) text in explicit open/close fences.
 *
 * This neutralizes prompt-injection payloads like "ignore previous instructions":
 * they remain visible as quoted data inside the fence, never lifted out as commands.
 */
export function sandbox(text: string): string {
  const escaped = text
    // Neutralize our own fence tokens if they appear in the data.
    .split(FENCE_OPEN)
    .join("<<<U_DATA>>>")
    .split(FENCE_CLOSE)
    .join("<<<END_U_DATA>>>");
  return `${FENCE_OPEN}\n${escaped}\n${FENCE_CLOSE}`;
}

/** The inline citation label for a chunk: [planet_<id>] vs [<provider>] (doc 09 §4). */
function labelFor(chunk: Chunk): string {
  return chunk.source === "internal"
    ? `[planet_${chunk.planet_id}]`
    : `[${chunk.provider}]`;
}

function citationFor(chunk: Chunk): Citation {
  return chunk.source === "internal"
    ? {
        label: `planet_${chunk.planet_id}`,
        kind: "internal",
        ref: chunk.planet_id,
      }
    : { label: chunk.provider, kind: "external", ref: chunk.citation };
}

/** The in-band license string carried on a chunk (internal: `license`; external: `license_note`). */
function licenseOf(chunk: Chunk): string {
  return chunk.source === "internal" ? chunk.license : chunk.license_note;
}

export class TemplateSynthesizer implements Synthesizer {
  async synthesize(query: string, chunks: Chunk[]): Promise<Answer> {
    // Build the license summary straight off the chunks (in-band, never inferred).
    const containsThirdParty = chunks.some((c) => c.source === "external");
    const licenses = distinct(chunks.map(licenseOf));
    const license_summary: LicenseSummary = {
      contains_third_party: containsThirdParty,
      // "restricted" the moment ANY external content is cited — we're re-serving
      // someone else's facts and inherit their redistribution obligation (doc 09 §4).
      redistribution: containsThirdParty ? "restricted" : "open",
      licenses,
    };

    const citations = chunks.map(citationFor);

    // Compose the answer. Each chunk becomes one cited, sandboxed evidence block.
    // The chunk text is treated as DATA: it is rendered inside sandbox() fences and
    // never interpreted as an instruction by this (or a downstream LLM) synthesizer.
    const header =
      chunks.length === 0
        ? `No published planets matched: ${JSON.stringify(query)}.`
        : `Answer to ${JSON.stringify(query)}, composed from ${chunks.length} cited source(s):`;

    const body = chunks
      .map((chunk) => {
        const label = labelFor(chunk);
        return `${label} ${sandbox(chunk.text)}`;
      })
      .join("\n\n");

    const text = chunks.length === 0 ? header : `${header}\n\n${body}`;

    return { text, citations, license_summary };
  }
}

function distinct(values: string[]): string[] {
  return [...new Set(values)];
}
