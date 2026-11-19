# Conventions for this repository

This file tells Claude and the skills how work is organised in this repository. Read it before you plan or create anything here.

## Where things live

- **Tracker.** The tickets are GitHub issues in this repository. A project is an epic, which is a parent issue with the `epic` label. The tickets of an epic are its sub-issues. A wave is a set of tickets that can start at the same time. Each wave is a GitHub milestone. GitHub issues have no "in progress" or "in review" state. The labels `in progress` and `in review` play that role, and a ticket carries at most one of them.
- **Specification pages.** Each project has one specification page, at `docs/projects/<project-slug>.md`. The epic links to it, and it links back to the epic.
- **Architecture decision records.** An architecture decision record (ADR) explains one technical choice and its reasons. ADRs live in `docs/decisions/`.
- **Layer labels.** `cstack` is the command-line tool that this repository builds. The `cli` label marks work on its code. The `skill` label marks work on the prose of skills and agent prompts. The `tests` label marks work on tests and continuous integration.
- **Language.** Everything written in this repository and in its issues is in English.
- **Design.** No project here has a user interface. Every project is a command-line tool or prose. No design stage applies.

## Public text rule

This repository is public. Never write the name of an employer or a client in it or in its issues. Never quote a ticket key from work. Never give a count taken from work retrospectives. The token and time results of a comparison are the only figures from work that you may publish. Keep any copy of a work ticket in a private repository. Every commit carries the GitHub no-reply address, the one that ends in `@users.noreply.github.com`, as author and as committer. The shared `.git/config` of the maintainer's clone sets it, but a fresh clone falls back to the global address. So check `git log --format='%ae %ce'` before the first push.

## Commands

You run these commands from the `cstack/` folder. `npm ci` installs the packages. A new worktree has no `node_modules`, so run `npm ci` there before the first type check or test run. `npm test` runs the tests. `npm run typecheck` checks the types. `npm run build` compiles `cstack/src/` into `cstack/dist/`.

The full `npm test` takes about 90 seconds, so give it a shell timeout above two minutes. When the machine is busy, for example while several test runs go at once, `cstack/test/report.test.ts` can pass the five-second timeout of vitest. When only that file fails, run it alone before you look for a bug.

The code lives in `cstack/src/`. Each command has its own file in `cstack/src/commands/`. Every command also has an entry in `cstack/src/manifest.ts`, which defines the common exit codes. The tests live in `cstack/test/`. The skills that `cstack` ships live in `cstack/skills/<skill name>/`. The phase guides live in `cstack/guides/<skill name>/<phase>.md`.

Some tests check every command or every shipped skill, so a new one must pass them too. `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts` run each built command with an unknown flag. So a command checks its arguments before it reads git or starts another tool, and it prints its usage line exactly as `cstack/src/manifest.ts` writes it. `cstack/test/skills-install.test.ts` lists the shipped skills, so a new folder under `cstack/skills/` changes what it expects.

The minimum Node version is written in one place only, which is `engines.node` in `cstack/package.json`. Do not copy that number into any other file.

A command prints through the `io` argument of `run` and returns its exit code. No code calls `process.exit()`, because on macOS it can cut output that goes into a pipe. Set `process.exitCode` instead.

The maintainer works on macOS, whose `sed` is the BSD one. An in-place edit there needs `sed -i ''`, and the GNU form `sed -i` fails.
