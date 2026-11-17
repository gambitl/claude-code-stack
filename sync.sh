#!/usr/bin/env bash
# Copy my personal Claude Code configuration from ~/.claude into config/ and
# rebuild INVENTORY.md.
#
# The script replaces every name of the private list with its replacement
# before it writes a file. It never touches cstack/ or skills/. A sync commit
# holds only config/ and INVENTORY.md.
#
# Usage:
#   ./sync.sh            copy the files, rebuild INVENTORY.md, show what changed
#   ./sync.sh --commit   same, then commit and push if anything changed
#
# The private list is at ~/.config/claude-code-stack/private-names.txt. The
# script stops before any change when the list is missing or empty.
# The script only reads from ~/.claude. It never writes there.

set -euo pipefail

SRC="$HOME/.claude"
REPO="$(cd "$(dirname "$0")" && pwd)"
COMMIT=false
[ "${1:-}" = "--commit" ] && COMMIT=true

# The helper scripts below need Python. macOS and Linux install it as
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

# Build everything in a temporary folder first. The working tree changes only
# when every check has passed.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/config"

# 0. The private list must exist and have an entry. Checking an empty folder
#    makes the helper read the list and stop with a message if it is unusable.
"$PYTHON" scripts/private_names.py check "$TMP/config"

# 1. Global config files.
cp "$SRC/CLAUDE.md" "$TMP/config/CLAUDE.md"
cp "$SRC/settings.json" "$TMP/config/settings.json"
cp "$SRC/statusline-command.sh" "$TMP/config/statusline-command.sh"
cp "$SRC/plugins/installed_plugins.json" "$TMP/config/installed-plugins.json"

# 2. MCP servers declared at user level live in ~/.claude.json, next to
#    login state we must never publish. Export only the server list, with
#    every env and header value replaced by a placeholder.
"$PYTHON" scripts/export_mcp_servers.py "$HOME/.claude.json" > "$TMP/config/mcp-servers.json"

# 3. Human-readable summary of hooks, plugins, MCP servers and skills.
"$PYTHON" scripts/build_inventory.py "$SRC" > "$TMP/INVENTORY.md"

# 4. Secret check on the raw files. The redaction below can break a token
#    that holds a name, so the check also runs after it.
SECRETS='gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|xox[abpr]-[A-Za-z0-9-]+|lin_api_[A-Za-z0-9]+|glpat-[A-Za-z0-9_-]+|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY'
if grep -rEn "$SECRETS" "$TMP" >/dev/null; then
  echo "Stopped: the generated files look like they hold secrets. Nothing was changed." >&2
  exit 1
fi

# 5. Replace the names of the private list.
"$PYTHON" scripts/private_names.py redact "$TMP"/config/* "$TMP/INVENTORY.md"

# 5b. Safety nets: refuse to continue if anything looks like a token or key,
#    or if a name of the private list is left.
if grep -rEn "$SECRETS" "$TMP" >/dev/null; then
  echo "Stopped: the generated files look like they hold secrets. Nothing was changed." >&2
  exit 1
fi
if ! "$PYTHON" scripts/private_names.py check "$TMP"; then
  echo "Stopped: a name of the private list is left. Nothing was changed." >&2
  exit 1
fi

# 6. Copy into place.
mkdir -p config
cp "$TMP"/config/* config/
cp "$TMP/INVENTORY.md" INVENTORY.md

# Stage and commit only the files this run wrote, never a stray file in config/.
FILES=(INVENTORY.md)
for f in "$TMP"/config/*; do FILES+=("config/$(basename "$f")"); done

git add -- "${FILES[@]}"
if git diff --cached --quiet -- "${FILES[@]}"; then
  echo "Nothing changed since the last sync."
  exit 0
fi

git diff --cached --stat -- "${FILES[@]}"

if $COMMIT; then
  git commit -q -m "Sync my Claude Code setup on $(date +%Y-%m-%d)" -- "${FILES[@]}"
  git push -q
  echo "Committed and pushed."
else
  echo "Review the changes with 'git diff --cached', then commit, or run ./sync.sh --commit."
fi
