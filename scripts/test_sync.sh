#!/usr/bin/env bash
# Test of sync.sh. It works only in temporary folders, with a fake HOME and
# the fake name Acme. It never touches the real ~/.claude, the real working
# copy or the real private list, and it never passes --commit.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
fail=0
export PYTHONDONTWRITEBYTECODE=1

check() { # check <name> <command that must succeed>
  if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; fail=1; fi
}
g() { git -c user.name=Tester -c user.email=tester@example.invalid "$@"; }

# A clone of the working copy, with the scripts as they are now.
mkclone() { # mkclone <dir>
  g clone -q --no-local "$ROOT" "$1" 2>/dev/null
  cp "$ROOT/sync.sh" "$1/sync.sh"
  cp "$ROOT"/scripts/*.py "$ROOT"/scripts/*.sh "$1/scripts/"
  mkdir -p "$1/cstack"
  echo "unfinished work" > "$1/skills/sentinel.txt"
  echo "unfinished work" > "$1/cstack/sentinel.txt"
  echo "staged work" > "$1/cstack/staged.txt"
  g -C "$1" add cstack/staged.txt
  echo "a stray unchecked file" > "$1/config/stray.txt"
}

mkhome() { # mkhome <dir>
  local h="$1"
  mkdir -p "$h/.claude/plugins" "$h/.claude/skills/other" "$h/.config/claude-code-stack"
  echo "My notes about ACME projects" > "$h/.claude/CLAUDE.md"
  echo '{"permissions":{"allow":["Bash(acme-tool:*)"]},"env":"Acme"}' > "$h/.claude/settings.json"
  echo "echo status" > "$h/.claude/statusline-command.sh"
  echo '{"plugins":{}}' > "$h/.claude/plugins/installed_plugins.json"
  echo "different skill text" > "$h/.claude/skills/other/SKILL.md"
  mkdir -p "$h/.claude/skills/cstackskill"
  echo "a skill from cstack" > "$h/.claude/skills/cstackskill/SKILL.md"
  : > "$h/.claude/skills/cstackskill/.cstack-managed"
  echo '{"mcpServers":{}}' > "$h/.claude.json"
  echo "Acme" > "$h/.config/claude-code-stack/private-names.txt"
  chmod 600 "$h/.config/claude-code-stack/private-names.txt"
}

snapshot() { (cd "$1" && find config INVENTORY.md -type f 2>/dev/null | sort | xargs shasum 2>/dev/null); }

mkclone "$WORK/repo"
mkhome "$WORK/home"
before_skills="$(cd "$WORK/repo" && find skills -type f ! -name sentinel.txt | sort | xargs shasum)"
out="$(cd "$WORK/repo" && HOME="$WORK/home" bash ./sync.sh 2>&1)"; code=$?
check "sync succeeds" "[ $code -eq 0 ] || { echo \"\$out\"; false; }"
check "sentinel in skills survives" "[ -f $WORK/repo/skills/sentinel.txt ]"
check "sentinel in cstack survives" "[ -f $WORK/repo/cstack/sentinel.txt ]"
after_skills="$(cd "$WORK/repo" && find skills -type f ! -name sentinel.txt | sort | xargs shasum)"
check "skills matches the clone" "[ \"\$before_skills\" = \"\$after_skills\" ] && [ ! -e $WORK/repo/skills/other ]"
inv="$WORK/repo/INVENTORY.md"
check "the inventory has the heading My own skills" "grep -q '^### My own skills' $inv"
check "the inventory does not list the cstack skill under My own skills" \
  "! sed -n '/^### My own skills/,/^### Skills installed/p' $inv | grep -q cstackskill"
check "the inventory lists the cstack skill as installed by cstack" \
  "sed -n '/^### Skills installed/,\$p' $inv | grep -q 'cstackskill.*installed and updated by .cstack.'"
check "config holds the fake CLAUDE.md" "grep -q 'My notes about' $WORK/repo/config/CLAUDE.md"
check "config holds the fake settings.json" "grep -q '<private>-tool' $WORK/repo/config/settings.json"
check "no Acme in any case in config or INVENTORY.md" "! grep -riq acme $WORK/repo/config $WORK/repo/INVENTORY.md"
check "the placeholder is in config" "grep -q '<private>' $WORK/repo/config/settings.json"
staged="$(g -C $WORK/repo diff --cached --name-only | sort)"
check "sync stages only config, INVENTORY.md and the earlier cstack file" \
  "! echo \"\$staged\" | grep -v -E '^(config/|INVENTORY.md\$|cstack/staged.txt\$)' | grep -q ."
check "the staged cstack file is still staged" "echo \"\$staged\" | grep -qx cstack/staged.txt"
check "a stray file in config is not staged" "! echo \"\$staged\" | grep -q stray"
check "the unstaged sentinels are not staged" "! echo \"\$staged\" | grep -q sentinel"
extra="$(g -C "$WORK/repo" status --short | grep '^??' | grep -v -E 'cstack/|skills/|scripts/|config/stray.txt')"
check "the sync leaves no untracked file outside cstack, skills and scripts" "[ -z \"\$extra\" ]"

# A fake token stops the script and leaves config unchanged.
mkclone "$WORK/repo2"; mkhome "$WORK/home2"
(cd "$WORK/repo2" && HOME="$WORK/home2" bash ./sync.sh >/dev/null 2>&1)
snap="$(snapshot "$WORK/repo2")"
echo "my token ghp_abcdefghijklmnopqrstuvwxyz0123456789" >> "$WORK/home2/.claude/CLAUDE.md"
out="$(cd "$WORK/repo2" && HOME="$WORK/home2" bash ./sync.sh 2>&1)"; code=$?
check "a fake token stops the script" "[ $code -ne 0 ]"
check "a fake token leaves config unchanged" "[ \"\$snap\" = \"\$(snapshot $WORK/repo2)\" ]"
check "the message does not print the token" "! echo \"\$out\" | grep -q ghp_"

# A token that only the redaction would hide still stops the script.
mkclone "$WORK/repo4"; mkhome "$WORK/home4"
echo "key ghp_abcdefghijAcmeklmnopqrstuvwxyz0123456789" >> "$WORK/home4/.claude/CLAUDE.md"
(cd "$WORK/repo4" && HOME="$WORK/home4" bash ./sync.sh >/dev/null 2>&1); code=$?
check "a token that the redaction would break still stops the script" "[ $code -ne 0 ]"

# A missing list, then an empty list, stop the script and leave config unchanged.
mkclone "$WORK/repo3"; mkhome "$WORK/home3"
(cd "$WORK/repo3" && HOME="$WORK/home3" bash ./sync.sh >/dev/null 2>&1)
snap="$(snapshot "$WORK/repo3")"
echo "new line" >> "$WORK/home3/.claude/CLAUDE.md"
rm "$WORK/home3/.config/claude-code-stack/private-names.txt"
(cd "$WORK/repo3" && HOME="$WORK/home3" bash ./sync.sh >/dev/null 2>&1); code=$?
check "a missing list stops the script" "[ $code -ne 0 ]"
check "a missing list leaves config unchanged" "[ \"\$snap\" = \"\$(snapshot $WORK/repo3)\" ]"
printf '# only a comment\n\n' > "$WORK/home3/.config/claude-code-stack/private-names.txt"
(cd "$WORK/repo3" && HOME="$WORK/home3" bash ./sync.sh >/dev/null 2>&1); code=$?
check "an empty list stops the script" "[ $code -ne 0 ]"
check "an empty list leaves config unchanged" "[ \"\$snap\" = \"\$(snapshot $WORK/repo3)\" ]"

exit $fail
