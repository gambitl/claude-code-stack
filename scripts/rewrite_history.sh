#!/usr/bin/env bash
# Remove the names of the private list from the whole git history.
#
# Usage:
#   scripts/rewrite_history.sh [--source <url>] [--list <path>] [--push]
#
# Without --push, the script rewrites a fresh mirror clone in a temporary
# folder, checks it, and prints what it would push. Nothing changes in the
# source. With --push, it also force-pushes every branch and tag to the source.
#
# The source is the origin of this working copy by default. The list is
# ~/.config/claude-code-stack/private-names.txt by default. The script never
# touches this working copy, never pushes refs/pull/*, and never prints a name
# of the list. Before the rewrite, it saves a git bundle of the old history in
# your home folder, so that you can undo a failed push. The bundle still holds
# the names, so delete it once a fresh clone is clean.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SOURCE=""
LIST="$HOME/.config/claude-code-stack/private-names.txt"
PUSH=false
while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="${2:?--source needs a value}"; shift 2 ;;
    --list)   LIST="${2:?--list needs a value}"; shift 2 ;;
    --push)   PUSH=true; shift ;;
    *) echo "Unknown argument '$1'. See the header of this script." >&2; exit 2 ;;
  esac
done

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Stopped: neither python3 nor python is on PATH." >&2
  exit 1
fi
NAMES=("$PYTHON" "$HERE/private_names.py" --list "$LIST")

if ! git filter-repo --version >/dev/null 2>&1; then
  echo "Stopped: git filter-repo is not installed. Install it first, for example with 'brew install git-filter-repo'." >&2
  exit 1
fi
if [ -z "$SOURCE" ]; then
  SOURCE="$(git -C "$HERE" remote get-url origin)" || { echo "Stopped: no --source given and this working copy has no origin." >&2; exit 1; }
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# This also stops, before any change, when the list is missing or empty.
"${NAMES[@]}" expressions "$TMP/expressions.txt"
"${NAMES[@]}" mailmap "$TMP/mailmap.txt"

CLONE="$TMP/clone.git"
git clone -q --mirror --no-local "$SOURCE" "$CLONE"
COUNT_BEFORE="$(git -C "$CLONE" rev-list --all --count)"

BUNDLE="$HOME/claude-code-stack-old-history-$(date +%Y%m%d-%H%M%S).bundle"
git -C "$CLONE" bundle create "$BUNDLE" --all >/dev/null 2>&1
echo "Saved the old history in $BUNDLE"

echo "Matches per line of the list, before the rewrite:"
"${NAMES[@]}" scan "$CLONE" || true

git -C "$CLONE" filter-repo --quiet --force \
  --replace-text "$TMP/expressions.txt" \
  --replace-message "$TMP/expressions.txt" \
  --mailmap "$TMP/mailmap.txt"

echo "Matches per line of the list, after the rewrite:"
if ! "${NAMES[@]}" scan "$CLONE"; then
  echo "Stopped: a name of the list is still in the rewritten history. Nothing was pushed." >&2
  exit 1
fi
COUNT_AFTER="$(git -C "$CLONE" rev-list --all --count)"
if [ "$COUNT_BEFORE" != "$COUNT_AFTER" ]; then
  echo "Stopped: the number of commits changed ($COUNT_BEFORE before, $COUNT_AFTER after). Nothing was pushed." >&2
  exit 1
fi

echo "The rewrite would push these branches and tags to $SOURCE:"
git -C "$CLONE" for-each-ref --format='  %(refname)' refs/heads refs/tags

if [ "$PUSH" = true ]; then
  git -C "$CLONE" push --force "$SOURCE" 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'
  echo "Pushed. Delete $BUNDLE once a fresh clone shows no name of the list."
else
  echo "Dry run: nothing was pushed. Run again with --push to push."
fi
