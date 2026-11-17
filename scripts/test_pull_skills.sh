#!/usr/bin/env bash
# Test of pull-skills.sh. It works only in temporary folders, with a fake HOME,
# and never passes --apply.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail=0

g() { git -c user.name=Tester -c user.email=tester@example.invalid "$@"; }
check() { # check <name> <command that must succeed>
  if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi
}

# A throwaway origin: skills at the tag, then a later change on main.
mkorigin() { # mkorigin <dir> <tag yes|no>
  mkdir -p "$1/skills/demo"
  g -C "$1" init -q -b main
  echo "frozen text" > "$1/skills/demo/SKILL.md"
  g -C "$1" add -A && g -C "$1" commit -q -m "first"
  [ "$2" = yes ] && g -C "$1" tag prose-skills-final
  echo "newer text on main" > "$1/skills/demo/SKILL.md"
  g -C "$1" commit -q -am "later change"
}

mkorigin "$WORK/origin" yes
mkorigin "$WORK/origin-notag" no
git clone -q "$WORK/origin" "$WORK/clone"
git clone -q "$WORK/origin-notag" "$WORK/clone-notag"
for c in clone clone-notag; do cp "$ROOT/pull-skills.sh" "$WORK/$c/pull-skills.sh"; done

# Fake home whose skill equals the tagged version.
mkdir -p "$WORK/home/.claude/skills/demo"
echo "frozen text" > "$WORK/home/.claude/skills/demo/SKILL.md"
before="$(find "$WORK/home" | sort | xargs shasum 2>/dev/null)"

out="$(cd "$WORK/clone" && HOME="$WORK/home" bash ./pull-skills.sh 2>&1)"; code=$?
check "compares with the tag, not main" "[ $code -eq 0 ] && echo \"\$out\" | grep -q 'Already up to date: demo'"
after="$(find "$WORK/home" | sort | xargs shasum 2>/dev/null)"
check "writes nothing in the fake home" "[ \"\$before\" = \"\$after\" ]"

out="$(cd "$WORK/clone-notag" && HOME="$WORK/home" bash ./pull-skills.sh 2>&1)"; code=$?
check "stops without the tag" "[ $code -ne 0 ] && echo \"\$out\" | grep -q 'prose-skills-final'"

exit $fail
