#!/usr/bin/env bash
# Copy my own skills from GitHub into ~/.claude/skills. This is the reverse
# of sync.sh: use it on a computer whose skills are older than the ones in
# the repository.
#
# Usage:
#   ./pull-skills.sh           show which skills would change, write nothing
#   ./pull-skills.sh --apply   replace those skills, after backing them up
#
# The skills are read from origin/main as it is on GitHub, not from the files
# in this folder, so the branch checked out here does not matter. Only the
# skills that the repository holds are touched. Skills installed by other
# tools, and local skills the repository does not know, stay as they are.

set -euo pipefail

DEST="$HOME/.claude/skills"
# Backups live outside ~/.claude/skills, or Claude Code would load them as
# skills too.
BACKUP_ROOT="$HOME/.claude/skill-backups"
REPO="$(cd "$(dirname "$0")" && pwd)"
BRANCH="origin/main"
APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

cd "$REPO"

# 1. Get the latest state of GitHub and extract its skills folder into a
#    temporary folder, which is removed when the script ends.
git fetch -q origin
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive "$BRANCH" skills | tar -x -C "$TMP"

# Print one line per file that differs between the GitHub copy and the local
# copy of a skill, saying what --apply will do to that file.
describe_changes() {
  local name="$1"
  (cd "$TMP/skills/$name" && find . -type f ! -name .DS_Store) | sort > "$TMP/github.txt"
  (cd "$DEST/$name" && find . -type f ! -name .DS_Store) | sort > "$TMP/local.txt"
  comm -23 "$TMP/github.txt" "$TMP/local.txt" | sed 's|^\./|    add     |'
  comm -13 "$TMP/github.txt" "$TMP/local.txt" | sed 's|^\./|    remove  |'
  comm -12 "$TMP/github.txt" "$TMP/local.txt" | while read -r file; do
    cmp -s "$TMP/skills/$name/$file" "$DEST/$name/$file" || echo "    update  ${file#./}"
  done
}

# 2. Compare each skill of the repository with the local copy.
changed=()
for dir in "$TMP"/skills/*/; do
  name="$(basename "$dir")"
  if [ ! -d "$DEST/$name" ]; then
    echo "New on this computer: $name"
    changed+=("$name")
  elif [ -n "$(describe_changes "$name")" ]; then
    echo "Different from GitHub: $name"
    describe_changes "$name"
    changed+=("$name")
  else
    echo "Already up to date: $name"
  fi
done

# Warn about local skills that sync.sh would copy but GitHub does not have.
# They are left alone. The filters are the same as in sync.sh.
for dir in "$DEST"/*/; do
  name="$(basename "$dir")"
  [ "$name" = "synced" ] && continue
  [ -e "$dir/.superset-managed" ] && continue
  case "$name" in *-workspace) continue ;; esac
  [ -d "$TMP/skills/$name" ] && continue
  echo "Only on this computer, left as is: $name"
done

if [ ${#changed[@]} -eq 0 ]; then
  echo "Your skills already match GitHub."
  exit 0
fi

if ! $APPLY; then
  echo "Nothing was written. Run ./pull-skills.sh --apply to replace these skills."
  exit 0
fi

# 3. Move each local skill that will be replaced into a dated backup folder,
#    then copy the GitHub version in its place.
backup="$BACKUP_ROOT/$(date +%Y-%m-%d-%H%M%S)"
for name in "${changed[@]}"; do
  if [ -d "$DEST/$name" ]; then
    mkdir -p "$backup"
    mv "$DEST/$name" "$backup/$name"
  fi
  cp -R "$TMP/skills/$name" "$DEST/$name"
done

echo "Skills updated from GitHub."
[ -d "$backup" ] && echo "The previous versions are saved in $backup"
exit 0
