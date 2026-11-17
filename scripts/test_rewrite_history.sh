#!/usr/bin/env bash
# Test of scripts/rewrite_history.sh. Works only in temporary folders.
# It uses the fake name Acme, a fake HOME, and a throwaway source repository.
# It never touches the real working copy, the real private list or GitHub.
# Run it by hand: scripts/test_rewrite_history.sh

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/rewrite_history.sh"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
FAILS=0

ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; FAILS=$((FAILS + 1)); }
expect() { local d="$1"; shift; if "$@"; then ok "$d"; else fail "$d"; fi; }

export HOME="$T/home"
mkdir -p "$HOME"
export GIT_CONFIG_GLOBAL="$T/gitconfig" GIT_CONFIG_NOSYSTEM=1
git config --global user.name Tester
git config --global user.email tester@example.test
git config --global init.defaultBranch main

# A throwaway source: a working repository with three commits, a second
# branch and an annotated tag, pushed to a bare repository.
W="$T/work"; SRC="$T/source.git"
git init -q "$W"
echo "hello" > "$W/a.txt"
echo "Acme secret" > "$W/b.txt"
git -C "$W" add . && git -C "$W" commit -q -m "first" --author="Dev <dev@acme.example>"
echo "more" >> "$W/a.txt"
git -C "$W" commit -q -am "second for ACME"
git -C "$W" checkout -q -b side
echo "side" > "$W/c.txt"
git -C "$W" add . && git -C "$W" commit -q -m "third"
git -C "$W" tag -a v1 -m "tag of acme"
git -C "$W" checkout -q main
git init -q --bare "$SRC"
git -C "$W" push -q "$SRC" main side v1 2>/dev/null

LIST="$T/list.txt"
printf 'dev@acme.example==>dev@users.noreply.example\nAcme\n' > "$LIST"

refs() { git -C "$SRC" for-each-ref --format='%(refname) %(objectname)'; }
leak() { # leak <repo>: 0 if Acme is anywhere reachable
  local r="$1"
  { git -C "$r" for-each-ref --format='%(refname)'
    git -C "$r" log --all --format='%an %ae %cn %ce %B'
    git -C "$r" for-each-ref --format='%(contents)' refs/tags
    git -C "$r" log --all --name-only --format=
    git -C "$r" grep -I -h "" $(git -C "$r" rev-list --all) 2>/dev/null; } | grep -qi acme
}

noleak() { ! leak "$1"; }

# 1. without --push: the source is unchanged, a bundle is saved, counts are printed
BEFORE="$(refs)"
OUT="$("$SCRIPT" --source "$SRC" --list "$LIST" 2>&1)"; RC=$?
expect "no --push exits 0" [ $RC -eq 0 ]
expect "no --push leaves the source unchanged" [ "$BEFORE" = "$(refs)" ]
expect "a bundle is saved in the home folder" test -n "$(ls "$HOME"/claude-code-stack-old-history-*.bundle 2>/dev/null)"
expect "the output shows a count per list line" bash -c "grep -q 'line 1:' <<<\"\$1\" && grep -q 'line 2:' <<<\"\$1\"" _ "$OUT"
expect "the output never shows Acme" bash -c "! grep -qi acme <<<\"\$1\"" _ "$OUT"
expect "the source still holds Acme" leak "$SRC"

# 2. with --push
COUNT="$(git -C "$SRC" rev-list --all --count)"
OUT="$("$SCRIPT" --source "$SRC" --list "$LIST" --push 2>&1)"; RC=$?
expect "--push exits 0" [ $RC -eq 0 ]
expect "the output never shows Acme with --push" bash -c "! grep -qi acme <<<\"\$1\"" _ "$OUT"
expect "no Acme is left in the source" noleak "$SRC"
expect "the commit count is the same" [ "$COUNT" = "$(git -C "$SRC" rev-list --all --count)" ]
expect "the files hold <private>" bash -c "git -C '$SRC' show main:b.txt | grep -q '<private>'"
expect "the author email is the no-reply one" bash -c "git -C '$SRC' log --all --format=%ae | grep -q '^dev@users.noreply.example$'"
expect "the branches and the tag are still there" bash -c "git -C '$SRC' rev-parse -q --verify refs/heads/side >/dev/null && git -C '$SRC' rev-parse -q --verify refs/tags/v1 >/dev/null"

# 3. a missing list, then an empty list, stop before any change
BEFORE="$(refs)"
"$SCRIPT" --source "$SRC" --list "$T/missing.txt" --push >/dev/null 2>&1
expect "a missing list stops the script" [ $? -ne 0 ]
: > "$T/empty.txt"
"$SCRIPT" --source "$SRC" --list "$T/empty.txt" --push >/dev/null 2>&1
expect "an empty list stops the script" [ $? -ne 0 ]
expect "the source is unchanged after the refusals" [ "$BEFORE" = "$(refs)" ]

echo
if [ "$FAILS" -eq 0 ]; then echo "All checks passed."; else echo "$FAILS check(s) failed."; exit 1; fi
