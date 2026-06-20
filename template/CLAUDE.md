# Brain Context

> This is YOUR second brain. Replace this file's specifics with your own ventures,
> research, and conventions. The structure and workflows below are the Domvault engine —
> keep them; the content is yours to fill.

A Markdown-native knowledge base spanning your projects and research, designed to be
driven by an AI agent (Claude Code / web / Cowork).

## Structure
- 00-inbox/ — Capture zone; `_templates/` holds note templates, `_scripts/` holds ingestion scripts
- 10-projects/ — Active ventures (one folder each, with an `_index.md`)
- 20-research/ — Investment theses and market analysis
- 30-frameworks/ — Reusable thinking tools and methodologies
- 40-personal/ — Personal projects and notes
- 60-reference/ — Technical cheatsheets
- 70-learning/ — Knowledge ingested from saved screenshots/exports; organized by topic with MOCs; images in attachments/
- 80-synthesis/ — Brain-GENERATED frameworks that connect existing notes ("neurons") + `sparks/` (half-ideas)

## Conventions
- Each project has an `_index.md` as entry point
- [[wiki-links]] connect concepts across projects
- Frontmatter: `status` (active|paused|archived), `tags`, `updated`
- Evidence and decisions get timestamped entries

## Origin tracking (graph coloring)
Every note carries an `origin` field so the graph can distinguish authorship:
- `origin: ai-ingested` — transcribed from a screenshot/export you saved (lives in 70-learning). Graph color: amber.
- `origin: ai-generated` — produced by the brain itself: MOCs, hubs, synthesis frameworks (tag `#ai-generated` + path 80-synthesis). Graph color: purple.
- *(no origin field)* — written by you. Graph color: default.
Color groups are configured in `.obsidian/graph.json`. Preserve this scheme.

## Screenshot ingestion workflow (repeatable)
When you add new screenshots to ingest:
1. Inventory + dedupe images (by md5; AirDrop creates " 2"/"(1)" duplicates).
2. For each substantive image, OCR/transcribe into a note in `70-learning/<topic>/` named `<NNN>-<slug>.md`.
3. Frontmatter: status: inbox, created/updated (date), type: reference, origin: ai-ingested, source (instagram|tiktok|screenshot|...), source-image: "[[attachment]]", tags: [learning, ...].
4. Body sections: summary blockquote, ## Key points, ## Full extracted text, ## Equations (LaTeX if any), ## Why it matters, ## Related (link the topic MOC). Embed the image with ![[attachment]].
5. Topic subfolders you create as needed. Low-value/junk images → misc + tag `review`.
6. Copy the (downscaled) image into `70-learning/attachments/`.
7. Update the relevant MOC and re-derive your Interests Profile if themes shifted.

## Chat ingestion workflow (repeatable)
ChatGPT has no read-your-history API; the input is ChatGPT's **data export**.
1. In ChatGPT: Settings → Data controls → Export data → unzip the emailed `.zip` → `conversations.json`.
2. Run `00-inbox/_scripts/chatgpt_ingest.py <json> 70-learning/chats`.
3. The parser writes one note per conversation (frontmatter: origin: ai-ingested, source: chatgpt, type: chat; Summary + Key takeaways + collapsible full transcript) and a MOC. All start `status: inbox`, tagged `#review`.
4. Enrichment pass (agent): generate real summaries + key takeaways + topic tags, then route/cross-link into topic MOCs.

## Self-synthesis loop
A scheduled task (weekly) runs two tiers:
- **Sparks (half-ideas)** — 5–10 cheap, 2-line candidate connections per run, written to `80-synthesis/sparks/` (type: spark, tags [spark, ai-generated, half-idea], status: seed). Each links two notes + a one-line hypothesis. Faint-pink scatter on the graph (`tag:#spark`).
- **Neurons** — promote/expand the single best spark into one full synthesis note in `80-synthesis/` (magenta, `#ai-generated`).
Both tagged `#synthesis-review` for you to triage. See `docs/04-workflows.md` in the Domvault repo.

## Cross-surface sync protocol
`SYNC.md` (vault root) is the single source of truth for work in progress across surfaces.
- **Start of session:** read `SYNC.md`, continue from the relevant workstream's latest entry.
- **End of session:** update that workstream's section — Surface/Updated, Status, Now, Next, Decisions, Files, Open questions — and add a dated Log line.
- Keep entries terse; overwrite stale Now/Next rather than appending forever.

## Constellation (opt-in publishing)
Notes you choose to publish go to the shared Constellation registry as "planets". Publishing is
explicit, attributed, and revocable. See the Domvault repo `registry/SPEC.md`. Nothing is shared
automatically. Add `publish: false` (default) in frontmatter; flip to `true` only on notes you
intend to make public.

## Entry points (create these as you go)
- `70-learning/Learning Hub.md` — all ingested knowledge
- `80-synthesis/Synthesis Hub.md` — brain-generated frameworks
- `Interests Profile.md` — what you're mastering (use to aim research/synthesis)
- `SYNC.md` — cross-surface state board
