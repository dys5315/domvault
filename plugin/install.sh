#!/usr/bin/env bash
# Domvault installer — scaffold a brand-new second brain from the template.
# Usage: ./plugin/install.sh [target-dir]
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$REPO_DIR/template"
TARGET="${1:-$HOME/my-brain}"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }

bold "🧠  Domvault installer"
echo "    source : $TEMPLATE"
echo "    target : $TARGET"
echo

if [ ! -d "$TEMPLATE" ]; then
  echo "✗ template/ not found. Run this from inside the domvault repo." >&2
  exit 1
fi

if [ -e "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null || true)" ]; then
  echo "✗ '$TARGET' already exists and is not empty. Choose another path." >&2
  exit 1
fi

mkdir -p "$TARGET"
# copy template content (including dotfiles) but never the .git of the repo
cp -R "$TEMPLATE"/. "$TARGET"/

# wire the Claude Code slash commands into the new brain (local tooling)
if [ -d "$REPO_DIR/plugin/commands" ]; then
  mkdir -p "$TARGET/.claude/commands"
  cp -R "$REPO_DIR/plugin/commands/." "$TARGET/.claude/commands/"
fi

# stamp today's date into the sync board + hubs
TODAY="$(date +%F)"
if command -v sed >/dev/null; then
  # portable in-place sed (macOS + GNU)
  find "$TARGET" -name '*.md' -maxdepth 2 -print0 | xargs -0 -I{} sh -c \
    "sed -i.bak 's/2026-01-01/$TODAY/g' '{}' && rm -f '{}.bak'" 2>/dev/null || true
fi

# init git so the brain is versioned from day one (separate repo from Domvault)
if command -v git >/dev/null; then
  ( cd "$TARGET" && git init -q && git add -A && \
    git -c user.email="brain@localhost" -c user.name="Domvault" \
      commit -qm "scaffold brain from Domvault" ) || \
    echo "  (note: git commit skipped — set git user.name/email and commit when ready)"
fi

bold "✓ Brain scaffolded."
cat <<NEXT

Next steps:
  1. Open the folder in Obsidian (File → Open folder as vault → $TARGET).
     Graph colors, Templates (00-inbox/_templates), and Daily Notes are pre-configured.
  2. Point your agent at it (Claude Code / Cowork): it reads CLAUDE.md automatically.
     Slash commands (/ingest-screenshots, /ingest-chats, /synthesize, /publish) are
     installed in .claude/commands/.
  3. Read:  "How to Use Your Brain.md"
  4. Optional weekly synthesis loop:
       crontab -e   →   0 9 * * 0  cd "$TARGET" && <your-agent-cmd> "run the synthesis loop in CLAUDE.md"
  5. Publishing to Constellation is OFF by default. See registry/SPEC.md to opt in.

Your notes stay on YOUR machine. Domvault never phones home.
NEXT
