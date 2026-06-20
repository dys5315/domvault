# Registry terms (operator note)

Short and plain — this is what the hosted Constellation registry does and doesn't do. It exists so
people can share knowledge they **choose** to publish; it is not a backdoor into anyone's vault.

## What it stores

- **Only deliberately-published planets.** A note reaches the registry only when its author
  set `publish: true` and confirmed the publish diff. The registry stores that planet's
  **manifest** (title, author handle/star, license, lineage, version, signature) and its
  **published body** — nothing else.
- **No private data.** Private notes, raw frontmatter, unpublished backlinks, local file paths,
  and un-shipped attachments are stripped by the client *before* anything is sent (fail-closed). A
  vault is never read or transmitted by this system.
- **No telemetry.** There is **zero** user analytics or tracking. The server keeps only
  operational request logs (method, path, status, latency, IP) for reliability/abuse handling —
  never content or behavioral profiling.

## What the operator can do

- **Remove / tombstone any planet.** As the host, the operator can unpublish (`DELETE`) a planet —
  e.g. on the author's request, or if content is unlawful or abusive. Tombstoned planets leave the
  universe.
- **Gate publishing.** During the private beta, writes require a publish token (reads —
  `/universe`, `/planets/:id` — stay public). This keeps the network to invited people.
- **Authors retain their rights.** Content is published under each planet's stated license
  (default **PolyForm Noncommercial 1.0.0**). Hosting it here grants no extra rights to the
  operator or to other users beyond that license. Authorship is provable (signed, content-
  addressed) and lineage is preserved on forks.

## Your control

- **Unpublish removes it.** You can tombstone your own planets anytime (see [`CONNECT.md`](CONNECT.md)).
- **First-publish-wins.** Content-addressed ids mean copying your text without attribution
  produces a *different* id with no lineage — your original keeps provenance.

## Contact

Operator: **<your-name>** — `<your-contact-email>`.
For takedown/removal requests, include the `planet_id`.

---

*This is a small, good-faith beta between a few people, not a commercial service. The engine is
open source under PolyForm Noncommercial 1.0.0; you can always self-host your own registry instead
(see [`SERVICES.md`](SERVICES.md)).*
