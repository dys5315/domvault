# 03 — Getting started

## Requirements
- [Obsidian](https://obsidian.md) (or any Markdown editor)
- An AI agent that can read a folder: Claude Code, or Claude Cowork (desktop)
- `git` and `python3` (for the install script + ingestion)

## 1. Clone Domvault
```bash
git clone https://github.com/<you>/domvault.git
cd domvault
```

Enable the safety guard that stops real notes ever landing in this public repo:
```bash
git config core.hooksPath .githooks
```

## 2. Scaffold your brain (kept separate from this repo)
```bash
./plugin/install.sh ~/my-brain
```
This copies the empty template, stamps today's date, and `git init`s `~/my-brain` as its own
repo. It will refuse to overwrite a non-empty folder.

## 3. Open it
- In Obsidian: *Open folder as vault* → `~/my-brain` (click *Trust author and enable plugins*
  if prompted). Graph colors, the **Templates** folder (`00-inbox/_templates`), and **Daily
  Notes** are pre-configured, so they work immediately.
- Point your agent at it. Claude reads `CLAUDE.md` automatically. The slash commands
  (`/ingest-screenshots`, `/ingest-chats`, `/synthesize`, `/publish`) are installed in
  `.claude/commands/`.

## 4. First hour
1. Read `How to Use Your Brain.md`.
2. Capture 3–5 notes with the templates in `00-inbox/_templates/`.
3. Run an ingest: `python3 00-inbox/_scripts/chatgpt_ingest.py <export.json> 70-learning/chats`.
4. Connect notes with `[[wiki-links]]`.

## 5. Turn on the synthesis loop (optional)
Add a weekly cron that asks your agent to run the loop in `CLAUDE.md`:
```
0 9 * * 0  cd ~/my-brain && <your-agent-cmd> "run the synthesis loop in CLAUDE.md"
```

## 6. Publish to Constellation (optional)
Off by default. When you want to share a note: set `publish: true`, run `/publish`, review the
diff. See `registry/SPEC.md`.
