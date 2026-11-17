# ADR-SIC-E: The new role of the repository

Status: accepted, 2026-11-17. Ticket: #8.

## Context

Until now this repository was only a copy of the maintainer's Claude Code setup. The script `sync.sh` copied everything from `~/.claude` into it. Editing a file here changed nothing on the maintainer's machine.

The project "skills into cli" changes that. The command-line tool `cstack` and the skills that it ships need a home. The maintainer has to decide where that home is.

## Options

**A separate repository for `cstack`.** The code and the skills would live in a new repository. This repository would stay a plain copy of the setup. The cost is two places to keep in step. The skills and the tool that runs them could drift apart.

**This repository as the source.** The code of `cstack` and its skills live here. The prose skills in `skills/` stay, frozen. The personal configuration is still copied into `config/`. There is one place, one history, and one pull request can change a skill and the tool together.

**A private repository.** The work would be hidden by making the repository private. The cost is that nobody else can read, install or reuse the tool. The maintainer wants it to be shared.

## Decision

This repository becomes the source of `cstack`, of the skills that `cstack` ships, and of the frozen prose skills. The reasons are the single place and the single history.

The repository stays public, by choice. Public text is safer than it looks only if we protect it, so two rules protect work information:

- The public text rule in `CLAUDE.md` says that nobody writes the name of an employer or a client here.
- The private list holds the names to hide. It lives outside the repository, at `~/.config/claude-code-stack/private-names.txt`. It is never committed.

The script `sync.sh` now copies the personal configuration only. It writes `config/` and `INVENTORY.md`, and it stages only those two paths. It never touches `cstack/` or `skills/`. It hides the names of the private list in what it copies. Because it copies into a public place, you read the diff before you run `./sync.sh --commit`.

The prose skills in `skills/` are frozen at the tag `prose-skills-final`. They are no longer improved. The script `pull-skills.sh` reads that tag, and it installs them for people who want them.

## Marker file

A skill that `cstack` installs carries the marker file `.cstack-managed`. The inventory lists such a skill under "Skills installed by other tools", the same way it treats `.superset-managed`. The ticket that ships the skills uses the same name.

## The history rewrite

Old commits already hold names from work. A force-push cannot remove them from the hidden references of closed pull requests. So the history is rewritten once, after this change is merged.

The script `scripts/rewrite_history.sh` does the rewrite. It works on a fresh mirror clone, saves a git bundle of the old history first, and pushes only when you pass `--push`. Delete the bundle once a fresh clone is clean, because the bundle still holds the names. Until GitHub Support removes the hidden references, old commits stay readable by their hash.

Branches and local copies made before the rewrite must be rebased onto the new `main` with `git rebase --onto`, or replaced by a fresh clone.

## Consequences

The repository is no longer a mirror. A change here can change what people install.

The maintainer has a few steps to run after the merge. The pull request lists them in order.
