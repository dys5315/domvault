// publish.test.ts — the SAFETY suite. The non-negotiable assertion: nothing
// private ever reaches the serialized manifest or body (SPEC §3, §5). Plus:
// refuse non-publish notes, correct content hash, content-addressed ids, and
// non-removable lineage on pull / re-publish (SPEC §4).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { stripNote, PublishRefusedError } from "./strip.ts";
import { buildManifest } from "./manifest.ts";
import { publishNote, type PublishResponse } from "./publish.ts";
import { pull } from "./pull.ts";
import type { Author, NodeManifest, StoredPlanet } from "../registry/server/types.ts";

const AUTHOR: Author = { handle: "dom", display: "Dom S.", star: "star_dom" };

// A note loaded with private/local-only landmines we must NEVER leak.
const NOTE_WITH_SECRETS = `---
title: Model the Funnel as a State Machine
summary: A public abstract for the universe view.
galaxy: [product, ai-engineering]
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, product]
private: this whole field must never leave the machine
internal_id: NOTE-0042-LOCAL
secret_token: sk-live-ABC123DEADBEEF
api_key: AKIA-XXXXX-SHOULD-NOT-LEAK
password: hunter2
origin: ai-generated
related_local_path: /Users/dom/vault/40-personal/diary.md
---

# Model the Funnel as a State Machine

This connects to [[Some Unpublished Private Note]] and [[Another Local Draft]].

It also references [[Published Idea|a published idea]] which IS public.

See the raw file at /Users/dom/vault/40-personal/secret-plan.md for details,
and ~/Downloads/private-export.csv too.

![[diagram-not-shipped.png]]
![local screenshot](./screenshots/internal.png)
![remote ok](https://example.com/public.png)

The body's actual ideas are fine to publish.
`;

// Sensitive substrings that must appear in the RAW note but NEVER in any
// serialized publish artifact.
const FORBIDDEN_SUBSTRINGS = [
  "this whole field must never leave the machine",
  "NOTE-0042-LOCAL",
  "sk-live-ABC123DEADBEEF",
  "AKIA-XXXXX-SHOULD-NOT-LEAK",
  "hunter2",
  "ai-generated", // local provenance marker, not a planet origin
  "/Users/dom/vault/40-personal/diary.md",
  "/Users/dom/vault/40-personal/secret-plan.md",
  "~/Downloads/private-export.csv",
  "Some Unpublished Private Note",
  "Another Local Draft",
  "diagram-not-shipped.png",
  "internal.png",
  "private",
  "secret_token",
  "api_key",
  "password",
  "internal_id",
];

function resolveLink(target: string): string | undefined {
  // Only "Published Idea" resolves to a real planet.
  return target === "Published Idea" ? "planet_published000000000000000000000000000000000000" : undefined;
}

test("strip: NONE of the private fields appear in manifest or body", () => {
  const stripped = stripNote(NOTE_WITH_SECRETS, { resolveLink });
  const planet = buildManifest(stripped, AUTHOR, {
    publishedAt: "2026-06-19T00:00:00.000Z",
  });

  const serialized = JSON.stringify(planet.manifest) + "\n" + planet.body;
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    assert.ok(
      !serialized.includes(forbidden),
      `LEAK: forbidden substring "${forbidden}" appeared in the publish artifact`,
    );
  }
});

test("strip: forbidden substrings ARE present in the raw note (test is real)", () => {
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    assert.ok(
      NOTE_WITH_SECRETS.includes(forbidden),
      `test setup error: "${forbidden}" not in the raw note`,
    );
  }
});

test("strip: reports every private-field category it removed", () => {
  const stripped = stripNote(NOTE_WITH_SECRETS, { resolveLink });
  const w = stripped.withheld;

  for (const key of ["private", "internal_id", "secret_token", "api_key", "password", "related_local_path"]) {
    assert.ok(w.privateFrontmatterKeys.includes(key), `expected private key reported: ${key}`);
  }
  for (const key of ["secret_token", "api_key", "password"]) {
    assert.ok(w.secretLikeKeys.includes(key), `expected secret-like key flagged: ${key}`);
  }
  assert.ok(w.unpublishedBacklinks.includes("Some Unpublished Private Note"));
  assert.ok(w.unpublishedBacklinks.includes("Another Local Draft"));
  assert.ok(w.localPaths.some((p) => p.includes("secret-plan.md")));
  assert.ok(w.localPaths.some((p) => p.includes("private-export.csv")));
  assert.ok(w.attachments.includes("diagram-not-shipped.png"));
  assert.ok(w.attachments.some((a) => a.includes("internal.png")));
});

test("strip: published wiki-link is rewritten to its planet id (kept as link)", () => {
  const stripped = stripNote(NOTE_WITH_SECRETS, { resolveLink });
  assert.deepEqual(stripped.links, ["planet_published000000000000000000000000000000000000"]);
  assert.ok(stripped.body.includes("planet_published000000000000000000000000000000000000"));
});

test("strip: remote image is preserved, local embed stripped", () => {
  const stripped = stripNote(NOTE_WITH_SECRETS, { resolveLink });
  assert.ok(stripped.body.includes("https://example.com/public.png"));
  assert.ok(!stripped.body.includes("internal.png"));
});

test("strip: refuses notes that aren't publish:true", () => {
  const note = `---\ntitle: Draft\npublish: false\n---\n\nbody`;
  assert.throws(() => stripNote(note), PublishRefusedError);

  const noFlag = `---\ntitle: Draft\n---\n\nbody`;
  assert.throws(() => stripNote(noFlag), PublishRefusedError);
});

test("manifest: content_hash is sha256 of the cleaned body", () => {
  const stripped = stripNote(NOTE_WITH_SECRETS, { resolveLink });
  const planet = buildManifest(stripped, AUTHOR, { publishedAt: "2026-06-19T00:00:00.000Z" });
  const expected =
    "sha256:" + createHash("sha256").update(planet.body, "utf8").digest("hex");
  assert.equal(planet.manifest.content_hash, expected);
  assert.match(planet.manifest.content_hash, /^sha256:[a-f0-9]{64}$/);
});

test("manifest: id is content-addressed — same body => same id", () => {
  const opts = { publishedAt: "2026-06-19T00:00:00.000Z" } as const;
  const a = buildManifest(stripNote(NOTE_WITH_SECRETS, { resolveLink }), AUTHOR, opts);
  const b = buildManifest(stripNote(NOTE_WITH_SECRETS, { resolveLink }), AUTHOR, opts);
  assert.equal(a.manifest.id, b.manifest.id);
  assert.match(a.manifest.id, /^planet_[a-f0-9]{40}$/);
});

test("manifest: changed body => different id", () => {
  const opts = { publishedAt: "2026-06-19T00:00:00.000Z" } as const;
  const a = buildManifest(stripNote(NOTE_WITH_SECRETS, { resolveLink }), AUTHOR, opts);

  const changed = NOTE_WITH_SECRETS.replace(
    "The body's actual ideas are fine to publish.",
    "The body's actual ideas are fine to publish, with an EDIT.",
  );
  const b = buildManifest(stripNote(changed, { resolveLink }), AUTHOR, opts);
  assert.notEqual(a.manifest.id, b.manifest.id);
});

test("publish: full flow signs, posts, writes planet id back; confirm gate respected", async () => {
  let posted: { manifest: NodeManifest; body: string; publicKey: string } | undefined;
  const post = async (_url: string, payload: unknown): Promise<PublishResponse> => {
    posted = payload as typeof posted;
    return { id: posted!.manifest.id };
  };

  const result = await publishNote(NOTE_WITH_SECRETS, {
    registryUrl: "http://registry.test",
    author: AUTHOR,
    publicKey: "PUBKEY-PEM",
    confirm: () => true,
    sign: () => "test-signature",
    post,
    strip: { resolveLink },
    build: { publishedAt: "2026-06-19T00:00:00.000Z" },
  });

  assert.equal(result.status, "published");
  assert.ok(posted, "registry POST was called");
  assert.equal(posted!.manifest.signature, "test-signature");
  assert.equal(posted!.publicKey, "PUBKEY-PEM");

  // Write-back recorded the planet id and kept publish:true.
  assert.ok(result.updatedNote!.includes(`planet_id: ${result.planet!.manifest.id}`));
  assert.ok(result.updatedNote!.includes("publish: true"));

  // And the posted artifact still carries no secrets.
  const wire = JSON.stringify(posted) ;
  for (const forbidden of FORBIDDEN_SUBSTRINGS) {
    assert.ok(!wire.includes(forbidden), `LEAK over the wire: ${forbidden}`);
  }
});

test("publish: declining the diff cancels — nothing is POSTed", async () => {
  let postCalled = false;
  const result = await publishNote(NOTE_WITH_SECRETS, {
    registryUrl: "http://registry.test",
    author: AUTHOR,
    publicKey: "PUBKEY-PEM",
    confirm: () => false,
    sign: () => "sig",
    post: async () => {
      postCalled = true;
      return { id: "x" };
    },
    strip: { resolveLink },
    build: { publishedAt: "2026-06-19T00:00:00.000Z" },
  });

  assert.equal(result.status, "cancelled");
  assert.equal(postCalled, false);
  assert.equal(result.updatedNote, undefined);
});

// ── pull / lineage ──────────────────────────────────────────────────────────

const ORIGIN_PLANET: StoredPlanet = {
  manifest: {
    id: "planet_origin00000000000000000000000000000000000000",
    title: "An Original Framework",
    author: { handle: "alice", display: "Alice A.", star: "star_alice" },
    license: "PolyForm-Noncommercial-1.0.0",
    summary: "Alice's idea.",
    galaxy: ["product"],
    content_hash: "sha256:" + "a".repeat(64),
    published_at: "2026-01-01T00:00:00.000Z",
    version: 1,
    origin: null,
  },
  body: "# An Original Framework\n\nThe original body text.",
};

test("pull: produces a moon crediting origin in frontmatter and banner", () => {
  const moon = pull(ORIGIN_PLANET);
  assert.ok(moon.path.startsWith("70-learning/imported/"));
  assert.equal(moon.origin, ORIGIN_PLANET.manifest.id);
  assert.ok(moon.contents.includes(`origin: ${ORIGIN_PLANET.manifest.id}`));
  assert.ok(moon.contents.includes("Alice A."));
  assert.ok(moon.contents.includes("@alice"));
  assert.ok(moon.contents.includes("Imported moon"));
  // Pulled notes default to publish:false (opt-in, SPEC §3).
  assert.ok(moon.contents.includes("publish: false"));
});

test("re-publish: a moon keeps origin pointing at the original (non-removable)", () => {
  // Simulate the user editing the moon and flipping publish:true, then republish.
  const moon = pull(ORIGIN_PLANET);
  const edited = moon.contents
    .replace("publish: false", "publish: true")
    .replace("The original body text.", "The original body text, with my own additions.");

  const stripped = stripNote(edited);
  const republished = buildManifest(stripped, AUTHOR, {
    publishedAt: "2026-06-19T00:00:00.000Z",
  });

  // Origin is preserved from the moon's frontmatter — credit cannot be removed.
  assert.equal(republished.manifest.origin, ORIGIN_PLANET.manifest.id);
  // It's a NEW planet (different id) but lineage is intact.
  assert.notEqual(republished.manifest.id, ORIGIN_PLANET.manifest.id);
  assert.equal(republished.manifest.author.handle, "dom");
});

test("re-publish: explicit origin option cannot be cleared to null when one exists", () => {
  const moon = pull(ORIGIN_PLANET);
  const edited = moon.contents.replace("publish: false", "publish: true");
  const stripped = stripNote(edited);
  // Even if a caller passes origin:null, the frontmatter lineage wins.
  const republished = buildManifest(stripped, AUTHOR, {
    publishedAt: "2026-06-19T00:00:00.000Z",
    origin: null,
  });
  assert.equal(republished.manifest.origin, ORIGIN_PLANET.manifest.id);
});
