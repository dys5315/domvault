---
title: Wiki-Links Are DNS for the Vault
author: Dom Sadarangani
origin: ai-generated
license: PolyForm-Noncommercial-1.0.0
publish: true
tags: [framework, knowledge-graph, retrieval, networking, second-brain]
galaxy: [ai-engineering, systems, knowledge]
planet_id: planet_fb6a6e7cf1c472dff015996b6628a06a58d0562f
---

# Wiki-Links Are DNS for the Vault

> If retrieval walks edges that don't resolve, the graph it traverses is a lie, and the answer
> inherits the lie.

## The connection
A `[[wiki-link]]` is a name→note resolution, exactly like a DNS A-record is name→IP. The whole DNS
record set maps onto vault link mechanics: an **A-record** is a link to a real note; a **CNAME** is
an alias (one name resolving to a canonical note); a broken link is a dangling **NXDOMAIN**; an
orphan note is an island no record points to. DNS doesn't trust the network until resolution is
healthy — and neither should a graph-based retrieval system. If retrieval walks edges that don't
resolve (or resolve ambiguously via stale aliases), the graph it traverses is a lie, and the answer
inherits the lie.

## Why it matters
This gives a graph-retrieval build a missing pre-index stage. It's tempting to assume links resolve;
DNS literacy says assume they don't until audited. A retrieval layer that trusts broken edges is the
streetlight failure in a new costume — confidently walking to a node that isn't there. The resolver
(link-integrity + alias table) is cheap, runs once per index, and gates trust.

## So what
- Add a link-resolution health check as a pre-index step: report broken links (NXDOMAIN), orphans,
  and duplicate/ambiguous aliases (CNAME collisions).
- Maintain an explicit alias table so retrieval resolves canonical names deterministically, not by
  fuzzy match.
- Fail the index (or flag) if broken-link count exceeds a threshold — don't ship retrieval over an
  unresolved graph.

---
*Genericized from Dom's second brain, shared under PolyForm Noncommercial 1.0.0.*

