---
status: active
created: 2026-01-01
updated: 2026-01-01
type: sync
tags: [sync, handoff]
---

# SYNC — Cross-Surface State Board

> Single source of truth for work in progress across **Claude Code** (terminal), **Claude web** (Projects), and **Cowork** (desktop). All surfaces read this FIRST and update it LAST. Protocol lives in `CLAUDE.md`.

## Entry format

```
### <Workstream name>
- **Surface / Updated:** <claude-code | web | cowork> · YYYY-MM-DD
- **Status:** <in progress | blocked | done>
- **Now:** what is being worked on right now
- **Next:** the immediate next 1–3 steps
- **Decisions:** key choices made (so they aren't relitigated)
- **Files / paths:** repos, files, or vault notes involved
- **Open questions:** anything unresolved
```

## Active workstreams

<!-- Newest on top. Add a ### section per workstream. -->

### Example — getting set up
- **Surface / Updated:** cowork · 2026-01-01
- **Status:** in progress
- **Now:** scaffolded the brain from Domvault; reading the docs.
- **Next:** capture first 5 notes; run the screenshot ingest once.
- **Decisions:** keeping origin-tracking colors as shipped.
- **Files / paths:** this vault.
- **Open questions:** which topics to seed first.

## Log
- 2026-01-01 — brain scaffolded from Domvault template.
