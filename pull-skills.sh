#!/usr/bin/env bash
# WHY: ADR-SIC-E. The prose skills are frozen at the tag prose-skills-final.
# Install the prose skills that the repository froze at the tag
# prose-skills-final into ~/.claude/skills. Use it on a computer whose skills
# are older than the frozen ones.
#
# Usage:
#   ./pull-skills.sh           show which skills would change, write nothing
#   ./pull-skills.sh --apply   replace those skills, after backing them up
#
# The skills are read from the tag prose-skills-final as it is on GitHub, not
# from the files in this folder, so the branch checked out here does not
# matter. The tag is created after the history rewrite. Only the skills that
# the tag holds are touched. Skills installed by other tools, and local skills
# the tag does not know, stay as they are.

set -euo pipefail

DEST="$HOME/.claude/skills"
# Backups live outside ~/.claude/skills, or Claude Code would load them as
# skills too.
BACKUP_ROOT="$HOME/.claude/skill-backups"
REPO="$(cd "$(dirname "$0")" && pwd)"
TAG="prose-skills-final"
APPLY=false
[ "${1:-}" = "--apply" ] && APPLY=true

cd "$REPO"

# 1. Get the tags of GitHub and extract the skills folder of the frozen tag
#    into a temporary folder, which is removed when the script ends.
git fetch -q --tags origin
if ! git rev-parse -q --verify "refs/tags/$TAG^{commit}" > /dev/null; then
  echo "The tag $TAG does not exist yet. It is created after the history rewrite." >&2
  exit 1
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive "refs/tags/$TAG" skills | tar -x -C "$TMP"

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

# Warn about local skills that the tag does not hold. They are left alone.
# Skills of other tools, skills that cstack installed and workspace folders are
# not reported.
for dir in "$DEST"/*/; do
  name="$(basename "$dir")"
  [ "$name" = "synced" ] && continue
  [ -e "$dir/.superset-managed" ] && continue
  [ -e "$dir/.cstack-managed" ] && continue
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
