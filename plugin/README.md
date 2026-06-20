# Domvault installer plugin

Scaffolds a new second brain from `../template` and (optionally) wires the workflows as
Claude Code slash commands.

## Install a brain
```bash
./install.sh ~/my-brain      # or any path; defaults to ~/my-brain
```
What it does: copies the template, stamps today's date, `git init`s the new brain as its
own repo, and prints next steps. It refuses to overwrite a non-empty folder.

## Slash commands (Claude Code)
Drop the `commands/` folder into your brain (or symlink it) so these are available:

| Command | What it does |
|---------|--------------|
| `/ingest-screenshots` | Run the screenshot OCR → `70-learning` workflow |
| `/ingest-chats`       | Parse a ChatGPT export into notes + MOC |
| `/synthesize`         | Run the sparks + neuron synthesis loop |
| `/publish`            | Review and opt-in publish selected notes to Constellation |

## Uninstall
A brain is just a folder. Delete it. Nothing is installed system-wide and nothing phones home.
