# 04 — Workflows

These are the repeatable loops the engine is built around. The agent contract (`CLAUDE.md` in
each brain) restates them so any Claude surface runs them consistently.

## Screenshot ingestion
For knowledge you save as images (infographics, cheatsheets):
1. Inventory + dedupe by md5 (AirDrop makes " 2"/"(1)" copies).
2. OCR/transcribe each into `70-learning/<topic>/<NNN>-<slug>.md`.
3. Frontmatter: `status: inbox`, dates, `type: reference`, `origin: ai-ingested`, `source`,
   `source-image: "[[attachment]]"`, `tags`.
4. Body: summary blockquote, Key points, Full extracted text, Equations (LaTeX), Why it
   matters, Related (link the topic MOC). Embed with `![[attachment]]`.
5. Downscaled image → `70-learning/attachments/`.
6. Update the MOC; re-derive your Interests Profile if themes shifted.

Run via `/ingest-screenshots <path-to-images>`.

## Chat ingestion (ChatGPT)
ChatGPT has no history API — use its **data export**.
1. ChatGPT → Settings → Data controls → Export → unzip → `conversations.json`.
2. `python3 00-inbox/_scripts/chatgpt_ingest.py conversations.json 70-learning/chats`
3. Enrichment pass: real summaries, key takeaways, topic tags, cross-link into MOCs.

Run via `/ingest-chats <conversations.json>`.

## Self-synthesis loop (the part that makes it a brain)
Two tiers, cheap → expensive:
- **Sparks** — 5–10 two-line candidate connections per run into `80-synthesis/sparks/`
  (`tag:#spark`, faint pink on the graph). Wide net, low cost.
- **Neurons** — promote the single best spark into a full synthesis note in `80-synthesis/`
  (`#ai-generated`, magenta).
You triage weekly: promote good sparks, delete dead ones.

Run via `/synthesize`, ideally on a weekly schedule.

## Cross-surface sync
`SYNC.md` is the single source of truth across Claude Code / web / Cowork. Read it at the start
of a session; update the relevant workstream at the end. Keep entries terse; overwrite stale
Now/Next instead of appending forever.

## Publishing (opt-in)
`/publish <note>` builds a manifest, strips private fields, shows you the diff, and only then
pushes to Constellation. Default frontmatter is `publish: false`. See `registry/SPEC.md`.
