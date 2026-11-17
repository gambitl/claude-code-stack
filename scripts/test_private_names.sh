#!/usr/bin/env bash
# Test of scripts/private_names.py. Works only in a temporary folder.
# It uses the fake name Acme and never reads the real private list.
# Run it by hand: scripts/test_private_names.sh

set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
PY="python3"
command -v python3 >/dev/null 2>&1 || PY="python"
H="$PY $HERE/private_names.py"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
FAILS=0

ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; FAILS=$((FAILS + 1)); }
# expect <description> <condition command...>
expect() { local d="$1"; shift; if "$@"; then ok "$d"; else fail "$d"; fi; }

LIST="$T/list.txt"
cat > "$LIST" <<'EOF'
# a comment

 ACME-corp.com ==> example.com
Acme
dev@acme-corp.com==>noreply@example.com
Widget Co==>
EOF

# 1. comments and blank lines are ignored, no ==> gives <private>, replacement honoured
printf 'Hello acme and ACME and Acme.\nmail ACME-CORP.COM\n' > "$T/a.txt"
$H --list "$LIST" redact "$T/a.txt"
expect "replacement is honoured and entries apply top to bottom, ignoring case" \
  grep -qx 'mail example.com' "$T/a.txt"
expect "a line without ==> becomes <private>, for Acme, acme and ACME" \
  grep -qx 'Hello <private> and <private> and <private>.' "$T/a.txt"
expect "no Acme is left in the redacted file" bash -c "! grep -qi acme '$T/a.txt'"

# 2. an empty replacement after ==> also becomes <private>
printf 'Widget Co here\n' > "$T/w.txt"
$H --list "$LIST" redact "$T/w.txt"
expect "empty replacement becomes <private>" grep -qx '<private> here' "$T/w.txt"

# 3. check exits non-zero, prints the list line number, never the name
mkdir -p "$T/tree/sub"
printf 'clean\n' > "$T/tree/ok.txt"
printf 'x ACME y\n' > "$T/tree/sub/bad.txt"
OUT="$($H --list "$LIST" check "$T/tree" 2>&1)"; RC=$?
expect "check exits non-zero on a remaining name" test "$RC" -ne 0
expect "check prints the list line number" bash -c "grep -q 'line 4' <<<'$OUT'"
expect "check prints the file path" bash -c "grep -q 'bad.txt' <<<'$OUT'"
expect "check never prints the name" bash -c "! grep -qi acme <<<'$OUT'"
rm "$T/tree/sub/bad.txt"
$H --list "$LIST" check "$T/tree" >/dev/null 2>&1; RC=$?
expect "check exits zero on clean files" test "$RC" -eq 0

# 4. missing and empty list
OUT="$($H --list "$T/nope.txt" check "$T/tree" 2>&1)"; RC=$?
expect "a missing list exits non-zero" test "$RC" -ne 0
expect "a missing list message gives the path" grep -qF "$T/nope.txt" <<<"$OUT"
expect "a missing list message gives the chmod command" grep -qF 'chmod 600' <<<"$OUT"
printf '# only a comment\n\n' > "$T/empty.txt"
OUT="$($H --list "$T/empty.txt" check "$T/tree" 2>&1)"; RC=$?
expect "an empty list exits non-zero" test "$RC" -ne 0
expect "an empty list message gives the path" grep -qF "$T/empty.txt" <<<"$OUT"

# 5. expressions file and mailmap
$H --list "$LIST" expressions "$T/expr.txt"
expect "expressions file holds regex:(?i) lines in list order" bash -c \
  "[ \"\$(sed -n 1p '$T/expr.txt')\" = 'regex:(?i)ACME\\-corp\\.com==>example.com' ] && \
   [ \"\$(sed -n 2p '$T/expr.txt')\" = 'regex:(?i)Acme==><private>' ] && \
   [ \"\$(wc -l < '$T/expr.txt' | tr -d ' ')\" = 4 ]"
$H --list "$LIST" mailmap "$T/mailmap.txt"
expect "mailmap holds a line only for an email-to-email entry" bash -c \
  "[ \"\$(cat '$T/mailmap.txt')\" = '<noreply@example.com> <dev@acme-corp.com>' ]"

# 6. scan of a git repository
R="$T/repo"
git init -q "$R"
(
  cd "$R"
  git config user.email t@example.com; git config user.name t
  echo "file with Acme inside" > f.txt
  echo "other" > acme-notes.txt
  git add . && git commit -q -m "mentions ACME"
  git branch acme-branch
) >/dev/null 2>&1
OUT="$($H --list "$LIST" scan "$R" 2>&1)"; RC=$?
expect "scan exits non-zero when a name is found" test "$RC" -ne 0
expect "scan prints a count for list line 4" bash -c "grep -q 'line 4: [1-9]' <<<'$OUT'"
expect "scan prints a zero count for an unmatched line" bash -c "grep -q 'line 5: 0' <<<'$OUT'"
expect "scan never prints the name" bash -c "! grep -qi acme <<<'$OUT'"
CLEAN="$T/clean"
git init -q "$CLEAN"
( cd "$CLEAN"; git config user.email t@example.com; git config user.name t
  echo fine > f.txt; git add .; git commit -q -m "fine" ) >/dev/null 2>&1
$H --list "$LIST" scan "$CLEAN" >/dev/null 2>&1; RC=$?
expect "scan exits zero on a clean repository" test "$RC" -eq 0

echo
if [ "$FAILS" -ne 0 ]; then echo "$FAILS case(s) failed"; exit 1; fi
echo "all cases passed"
