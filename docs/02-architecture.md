# 02 — Architecture

```
domvault/
├── template/        the empty brain (folders, CLAUDE.md, SYNC.md, note templates, graph config)
├── plugin/          install.sh + Claude Code slash commands
├── scripts/         portable ingestion scripts (ChatGPT export → notes)
├── registry/        Constellation publish/pull SPEC + JSON schema + examples
├── constellation/   universe visualization (self-contained mock; future web app)
└── docs/            you are here
```

## The brain (template/)
A plain folder of Markdown that any Obsidian + agent setup can drive.

| Folder | Role |
|--------|------|
| `00-inbox/` | capture + `_templates/` + `_scripts/` |
| `10-projects/` | active ventures, one `_index.md` each |
| `20-research/` | theses, market analysis |
| `30-frameworks/` | reusable thinking tools |
| `40-personal/` | personal projects |
| `60-reference/` | cheatsheets |
| `70-learning/` | ingested knowledge + topic MOCs + `attachments/` |
| `80-synthesis/` | brain-generated neurons + `sparks/` |

`CLAUDE.md` is the **agent contract**: any Claude surface that opens the folder reads it and
knows the conventions and the exact repeatable workflows. `SYNC.md` is the **handoff board**
across Claude Code / web / Cowork.

## Data flow
```
capture ─► 70-learning (ingest)
                │
                ▼
        wiki-links connect notes
                │
                ▼
   synthesis loop ─► sparks ─► neurons (80-synthesis)
                │
                ▼  (opt-in)
        /publish ─► Constellation registry ─► Universe view
```

## Trust boundaries
- The base engine has **zero network calls**.
- The only thing that ever leaves the machine is a node you explicitly `/publish`, and you see
  the diff first.
- Constellation can be **centralized** (one hub) or **federated** (each brain self-serves);
  federation keeps any single party from owning everyone's knowledge.
