#!/usr/bin/env bash
# Copy my Claude Code setup from ~/.claude into this repository.
#
# Usage:
#   ./sync.sh            copy the files, rebuild INVENTORY.md, show what changed
#   ./sync.sh --commit   same, then commit and push if anything changed
#
# The script only reads from ~/.claude. It never writes there.

set -euo pipefail

SRC="$HOME/.claude"
REPO="$(cd "$(dirname "$0")" && pwd)"
COMMIT=false
[ "${1:-}" = "--commit" ] && COMMIT=true

# The two helper scripts below need Python. macOS and Linux install it as
# python3, while a Windows install usually only provides python, so take
# whichever one is on PATH.
if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Stopped: neither python3 nor python is on PATH." >&2
  exit 1
fi

cd "$REPO"

# 1. Global config files.
mkdir -p config
cp "$SRC/CLAUDE.md" config/CLAUDE.md
cp "$SRC/settings.json" config/settings.json
cp "$SRC/statusline-command.sh" config/statusline-command.sh
cp "$SRC/plugins/installed_plugins.json" config/installed-plugins.json

# 2. MCP servers declared at user level live in ~/.claude.json, next to
#    login state we must never publish. Export only the server list, with
#    every env and header value replaced by a placeholder.
"$PYTHON" scripts/export_mcp_servers.py "$HOME/.claude.json" > config/mcp-servers.json

# 3. My own skills. Skills installed by other tools are skipped:
#    "synced" comes from claude.ai, folders marked .superset-managed come
#    from the Superset app, and "*-workspace" folders are skill-creator
#    evaluation runs, not skills.
rm -rf skills
mkdir -p skills
for dir in "$SRC"/skills/*/; do
  name="$(basename "$dir")"
  [ "$name" = "synced" ] && continue
  [ -e "$dir/.superset-managed" ] && continue
  case "$name" in *-workspace) continue ;; esac
  cp -R "$dir" "skills/$name"
done
find skills -name .DS_Store -delete

# 4. Human-readable summary of hooks, plugins, MCP servers and skills.
"$PYTHON" scripts/build_inventory.py "$SRC" > INVENTORY.md

# 5. Safety net: refuse to continue if anything looks like a token or key.
if grep -rEn \
  'gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abpr]-[A-Za-z0-9-]+|lin_api_[A-Za-z0-9]+|glpat-[A-Za-z0-9_-]+|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY' \
  config skills INVENTORY.md; then
  echo "Stopped: the lines above look like secrets. Nothing was committed." >&2
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "Nothing changed since the last sync."
  exit 0
fi

git diff --cached --stat

if $COMMIT; then
  git commit -q -m "Sync my Claude Code setup on $(date +%Y-%m-%d)"
  git push -q
  echo "Committed and pushed."
else
  echo "Review the changes with 'git diff --cached', then commit, or run ./sync.sh --commit."
fi
