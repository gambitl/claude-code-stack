# ADR-SIC-C: How cstack ships its skills

Status: accepted, 2026-11-18. Ticket: #9.

## Context

The command-line tool `cstack` runs the workflow that the skills describe. A skill tells Claude which `cstack` command to run. So the skill and the tool must always match.

People need one simple way to get both. They also need a way to go back to an earlier version.

## Options

**`cstack` ships and serves the skills itself.** The package of `cstack` holds the skills and the phase guides. The command `cstack skills install` copies the skills into `~/.claude/skills/`. The command `cstack guide <phase>` prints a guide from the installed package. The skill and the tool come from one file, so they can never drift apart.

**A Claude Code plugin marketplace ships the skills.** People install `cstack` in one step and the skills in another. Each step has its own version. A person can end up with a new skill and an old tool, or the other way round. The cost is that the two can drift apart.

**The skill sharing link of Orca ships the skills.** This works only for people who use Orca. The link is not tied to the version of `cstack`. The cost is the same drift, and a tool that depends on one editor.

## Decision

`cstack` ships and serves its skills itself. The reason is simple. The skill and the tool can never drift apart, because they travel in one release file.

## How it works

The marker file is `.cstack-managed`. The command writes it into every skill folder that it installs. It holds the installed version. Only this file proves that `cstack` owns a folder. A symbolic link, a plain file, or a folder without the marker belongs to someone else. The command never replaces any of them by itself.

The option `--adopt <name>` is the only way to take over a folder without the marker. It accepts only a name that this version ships.

Every folder that the command replaces, removes or adopts is moved first to `~/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/<name>`. This folder sits outside `~/.claude/skills/`, so Claude Code never loads a backup as a skill. A hand edit inside an installed skill is therefore never lost.

The skill that `cstack` installs keeps the name `resolve-issue`. People keep typing `/resolve-issue`, and the agents keep their names `resolve-issue:<name>`. The older prose skill and the new skill cannot live side by side on one machine. So the ticket that installs the new skill waits until the baseline runs are done.

The command builds each skill in a temporary folder on the same disk. Then it moves the folder into place. A failure halfway never leaves a half-written skill.

## Package name and release

The package name is `@gambitl/cstack`. The command name stays `cstack`.

A package named only `cstack` already exists on the npm registry, and it belongs to someone else. If we used that name, the command `npm update -g` could replace our tool with that unrelated package. A name inside our own scope avoids this.

`cstack` is never published on the npm registry. People install it from a release file on GitHub. The file is named `gambitl-cstack-<version>.tgz`. Because the package is not on the registry, `npm update -g` cannot update it. You update by installing the newer release file. You go back by installing the earlier one, then running `cstack skills install` again.

## Release steps

The maintainer does these steps after the pull request is merged.

1. Claim the `gambitl` scope on npm, so nobody else can take the name.
2. Push the tag `v0.1.0`.
3. Check that the workflow `Release` creates the GitHub release with the packed file.

The workflow stops when the tag differs from `v` followed by the version in `cstack/package.json`.

## Consequences

One release gives people matching skills and tool. Going back is the same action as updating.

The cost is that the maintainer releases a new file every time a skill changes. People update by hand, because there is no registry to do it for them.
