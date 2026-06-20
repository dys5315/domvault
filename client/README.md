# Constellation publish/pull client

The `/publish` and `/pull` flow for the Constellation registry (see
[`../registry/SPEC.md`](../registry/SPEC.md)). Zero runtime dependencies —
Node built-ins only (`node:crypto`, `node:fs`, `node:path`, `node:http`,
`node:test`). No telemetry.

> **The one rule (SPEC §3):** nothing leaves a brain without its owner explicitly
> publishing it, and attribution travels with every node forever.

## Flow

```
note (publish: true)
  └─ stripNote ──► buildManifest ──► renderDiff ──► [confirm?] ──► sign ──► POST /planets ──► write planet id back
```

1. **strip** (`strip.ts`) — the privacy gate. An **allowlist**, not a blacklist:
   only publishable manifest fields survive; everything else is dropped and the
   body is scrubbed. Fails closed. Refuses any note that isn't `publish: true`.
2. **build** (`manifest.ts`) — content-addressed `id` + `content_hash` via the
   registry's shared `hash.ts`, so client and server agree on identity.
3. **diff** (`diff.ts`) — shows EXACTLY what will be published vs. withheld, so
   the user consents to the artifact itself.
4. **publish** (`publish.ts`) — orchestrates the above; **confirm**, **sign**,
   and the registry **POST** are all injectable (tests need no live server/TTY).
5. **pull** (`pull.ts`) — imports a planet as a linked copy ("moon") into
   `70-learning/imported/` with a non-removable `origin` + credit banner.
6. **cli** (`cli.ts`) — thin filesystem wiring.

## What the stripper removes (private-field categories)

The allowlist keeps only: `title`, `summary`, `galaxy`, `license`, and a real
`planet_…` `origin`. **Everything below is withheld and reported in the diff:**

| Category | What | Example |
|----------|------|---------|
| Private frontmatter keys | any key not on the publish allowlist | `private:`, `internal_id:`, `related_local_path:` |
| Secret-looking keys | keys matching token/secret/password/api-key/credential/bearer | `secret_token:`, `api_key:`, `password:` (dropped **and** flagged ⚠) |
| Unpublished backlinks | `[[wiki-links]]` to notes that aren't published planets (the title text itself is private) | `[[Some Unpublished Note]]` → `[an unpublished note]` |
| Local file paths | absolute/home/Windows/`file://` paths in the body | `/Users/…`, `~/Downloads/…`, `C:\…` → `[redacted-local-path]` |
| Attachments / embeds | `![[file]]` and local `![alt](path)` not shipped (remote `https://` images kept) | `![[diagram.png]]`, `![x](./local.png)` |
| Local provenance markers | `origin:` values that aren't real planet ids | `origin: ai-generated` |
| Control metadata | `publish:`, `tags:`, raw `author:` — consumed, never serialized into the manifest as-is | |

Published wiki-links (those resolving to a real planet id via `resolveLink`) are
**kept**, rewritten to the planet id, and recorded in `manifest.links`.

## Lineage (SPEC §4, §5)

- `pull()` writes `origin: planet_…` into both frontmatter and a visible banner.
- Re-publishing an edited moon keeps `origin` → the original. Credit is
  **non-removable**: passing `origin: null` to `buildManifest` cannot clear an
  existing lineage carried in the note's frontmatter.
- Content-addressing means copied text under a new author gets a **different**
  `id` with no lineage; the original keeps the earliest `published_at`.

## CLI usage

```bash
export CONSTELLATION_REGISTRY=http://localhost:8787
export CONSTELLATION_HANDLE=dom
export CONSTELLATION_STAR=star_dom
export CONSTELLATION_DISPLAY="Dom S."
export CONSTELLATION_PRIVKEY=~/.constellation/id_ed25519.pem
export CONSTELLATION_PUBKEY=~/.constellation/id_ed25519.pub.pem

npx tsx client/cli.ts publish frameworks/my-note.md   # strip → diff → confirm → publish → write-back
npx tsx client/cli.ts pull planet_8f2c…                # fetch → write a moon under 70-learning/imported/
```

## Test

```bash
npx tsx --test client/publish.test.ts
```

The suite asserts the safety property directly: a note seeded with private
frontmatter, secret-looking keys, unpublished backlinks, local paths, and
un-shipped attachments is published, and **none** of those substrings appear in
the serialized manifest, the body, or the wire payload.
