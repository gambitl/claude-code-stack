#!/usr/bin/env python3
"""Read the private list of names to hide, and apply it.

The list lives outside the repository, by default at
~/.config/claude-code-stack/private-names.txt. One entry per line.
Blank lines and lines that start with # are ignored. "name==>replacement"
sets the replacement. A line without "==>" (or with an empty replacement)
uses <private>. Entries apply from top to bottom. Matching ignores case.

Usage: private_names.py [--list PATH] <command> [arguments]

  redact FILE...      replace the names in each file, in place
  check PATH...       exit 1 if a name is left in a file or path (files or folders)
  expressions OUT     write the git filter-repo expressions file
  mailmap OUT         write the git mailmap file
  scan REPO           count matches per list line in every reachable object and
                      ref name of a git repository, exit 1 if any

This script never prints a name or the text it matched. It prints the
line number of the list entry and where the match was found.
"""

import os
import re
import subprocess
import sys

DEFAULT_LIST = "~/.config/claude-code-stack/private-names.txt"
PLACEHOLDER = "<private>"
EMAIL = re.compile(r"^[^@\s<>]+@[^@\s<>]+$")


class Entry:
    def __init__(self, line_no, name, replacement):
        self.line_no = line_no
        self.name = name
        self.replacement = replacement
        self.regex = re.compile(re.escape(name.encode("utf-8")), re.IGNORECASE)


def die(message):
    print(message, file=sys.stderr)
    sys.exit(2)


def load(path):
    path = os.path.expanduser(path)
    hint = (
        f"Stopped: the private list '{path}' is missing or has no entry.\n"
        "Create it with one name per line. A line may add ==> and a replacement,\n"
        "for example 'name==>replacement'. Lines that start with # are comments.\n"
        f"Then run: chmod 600 {path}"
    )
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except OSError:
        die(hint)
    entries = []
    for number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        name, sep, replacement = line.partition("==>")
        name, replacement = name.strip(), replacement.strip()
        if not name:
            continue
        entries.append(Entry(number, name, replacement if sep and replacement else PLACEHOLDER))
    if not entries:
        die(hint)
    return entries


def redact_bytes(data, entries):
    for e in entries:
        data = e.regex.sub(lambda _m, r=e.replacement.encode("utf-8"): r, data)
    return data


def matching_lines(data, entries):
    return [e.line_no for e in entries if e.regex.search(data)]


def cmd_redact(entries, files):
    for path in files:
        with open(path, "rb") as f:
            data = f.read()
        new = redact_bytes(data, entries)
        if new != data:
            with open(path, "wb") as f:
                f.write(new)


def cmd_check(entries, paths):
    found = False
    for top in paths:
        walk = [top] if os.path.isfile(top) else []
        if os.path.isdir(top):
            for root, dirs, names in os.walk(top):
                dirs[:] = [d for d in dirs if d != ".git"]
                walk.append(root)
                walk.extend(os.path.join(root, n) for n in names)
        for path in walk:
            for line in matching_lines(path.encode("utf-8", "surrogateescape"), entries):
                print(f"Found a name of the private list (line {line}) in the path {path}")
                found = True
            if os.path.isfile(path):
                with open(path, "rb") as f:
                    data = f.read()
                for line in matching_lines(data, entries):
                    print(f"Found a name of the private list (line {line}) in {path}")
                    found = True
    return 1 if found else 0


def cmd_expressions(entries, out):
    with open(out, "w", encoding="utf-8") as f:
        for e in entries:
            replacement = e.replacement.replace("\\", "\\\\")
            f.write(f"regex:(?i){re.escape(e.name)}==>{replacement}\n")


def cmd_mailmap(entries, out):
    with open(out, "w", encoding="utf-8") as f:
        for e in entries:
            if EMAIL.match(e.name) and EMAIL.match(e.replacement):
                f.write(f"<{e.replacement}> <{e.name}>\n")


def git(repo, *args):
    return subprocess.run(
        ["git", "-C", repo, *args], check=True, stdout=subprocess.PIPE
    ).stdout


def cmd_scan(entries, repo):
    counts = {e.line_no: 0 for e in entries}

    def add(data):
        for line in matching_lines(data, entries):
            counts[line] += 1

    for ref in git(repo, "for-each-ref", "--format=%(refname)").splitlines():
        add(ref)
    listing = git(repo, "rev-list", "--objects", "--all").splitlines()
    ids = []
    for row in listing:
        oid, _, path = row.partition(b" ")
        ids.append(oid)
        if path:
            add(path)  # file and folder names
    proc = subprocess.Popen(
        ["git", "-C", repo, "cat-file", "--batch"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
    )
    # Write the ids from a thread-free loop: feed all, then read all, in chunks.
    for start in range(0, len(ids), 500):
        chunk = ids[start:start + 500]
        proc.stdin.write(b"\n".join(chunk) + b"\n")
        proc.stdin.flush()
        for _ in chunk:
            header = proc.stdout.readline().split()
            size = int(header[2])
            body = proc.stdout.read(size)
            proc.stdout.read(1)
            if header[1] in (b"blob", b"commit", b"tag"):
                add(body)  # commit and tag bodies hold the author, committer, tagger and message
    proc.stdin.close()
    proc.wait()
    for line_no, count in counts.items():
        print(f"line {line_no}: {count}")
    return 1 if any(counts.values()) else 0


def main(argv):
    list_path = DEFAULT_LIST
    if len(argv) >= 2 and argv[0] == "--list":
        list_path, argv = argv[1], argv[2:]
    if len(argv) < 2 and not (argv and argv[0] in ("-h", "--help")):
        die(__doc__)
    if argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    command, args = argv[0], argv[1:]
    if command not in ("redact", "check", "expressions", "mailmap", "scan"):
        die(f"Unknown command '{command}'.\n{__doc__}")
    entries = load(list_path)
    if command == "redact":
        cmd_redact(entries, args)
    elif command == "check":
        return cmd_check(entries, args)
    elif command == "expressions":
        cmd_expressions(entries, args[0])
    elif command == "mailmap":
        cmd_mailmap(entries, args[0])
    elif command == "scan":
        return cmd_scan(entries, args[0])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
