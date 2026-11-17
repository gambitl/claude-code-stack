# Plan: #7 — M1-1: Scaffold the cstack command-line tool with tests and CI

Date: 2026-11-17
Ticket: https://github.com/gambitl/claude-code-stack/issues/7
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in `docs/projects/`), ADRs in `docs/decisions/`
Branch: gambitl/cstack-scaffold
Conversation language: French; the conversation uses it, and every record stays in English
Status: ready for review

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Set up the empty shell of the `cstack` program in this repository, so that every later change to it is checked automatically before anyone merges it.

- **What the title means**: To scaffold a project means to create its empty skeleton, with its folders, its settings and a first file that works. `cstack` is the command-line tool that this project builds, which is a program you run by typing its name in a terminal. Tests are small programs that check that the code does what it should. CI, short for continuous integration, is a GitHub service that runs those tests on every pull request, which is a proposed change waiting for review.
- **Why we are doing it**: Today the repository holds only text and two small scripts, and nothing checks a change before it lands. Every other ticket of this project adds code to `cstack`, and each one needs a place for that code and its tests.
- **For the user**: The maintainer can change `cstack` without fear. A change that breaks something shows a red check on its pull request before anyone merges it.

**Goal.** This ticket creates the `cstack` package with one working command, its tests, and a CI workflow that runs them on every pull request, which is AC1 of US-1. Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. The repository has no `cstack/` folder, no `package.json` and no `.github/` folder.
* **Conventions file**: `CLAUDE.md` (line 10): It says that `cstack` is the command-line tool this repository builds, and it defines the `cli`, `skill` and `tests` labels. It has no section that lists commands yet, so you add one.
* **Files that git ignores**: `.gitignore` (lines 1 to 2): It ignores only `.DS_Store` and `.repowise/`. The build output and the installed packages of `cstack` are not ignored yet.
* **Language and Node version**: `docs/projects/skills-into-cli.md` (line 297): `cstack` is written in TypeScript and runs on Node. Open question 6 (line 312) says that `cstack` targets the current long-term support release of Node, stated in `package.json` and in the README.
* **The story**: `docs/projects/skills-into-cli.md` (lines 57 to 65): US-1 lists five acceptance criteria. This ticket carries AC1. #8 carries AC2, AC3, AC4 and the negative criterion.

## Scope

1. Create the folder `cstack/` at the repository root. It holds the TypeScript package. The code goes in `cstack/src/` and the tests go in `cstack/test/`. Later tickets add the skills that `cstack` ships in `cstack/skills/<skill name>/` and the phase guides in `cstack/guides/<skill name>/<phase>.md`. A phase guide holds the instructions of one phase of a skill.
2. Write `cstack/package.json`. The package is named `cstack`, and its `bin` entry installs a command named `cstack`. Set `engines.node` to the current long-term support release of Node, as a minimum. Write that number only there. The README states it in words in its "Requirements" section, which #10 writes.
3. Add three scripts to `package.json`. `test` runs Vitest, the test runner, once. `typecheck` runs the TypeScript compiler without writing any file. `build` compiles `cstack/src/` into `cstack/dist/`. Commit `cstack/package-lock.json`, because `npm ci` needs it.
4. Use ES modules and strict TypeScript. Add no runtime dependency for now. Read the command-line arguments with `parseArgs` from Node's built-in `node:util` module.
5. Write the entry point `cstack/src/cli.ts`. It exports a function that takes the arguments and returns an exit code, so that tests can call it without starting a new process. The compiled file starts with the line `#!/usr/bin/env node`. Each command gets its own file under `cstack/src/commands/`. #13 later gathers every command into one list in `cstack/src/manifest.ts`, so do not create that file here.
6. Implement two behaviours. `cstack --version` prints the version written in `package.json` and exits with code 0. `cstack` with no command, or with a command it does not know, prints the usage on standard error and exits with code 2.
7. Add `cstack/node_modules/` and `cstack/dist/` to `.gitignore`.
8. Write `.github/workflows/ci.yml`. It runs on `macos-latest` for every pull request and for every push to `main`. It installs Node with `actions/setup-node` and `node-version: lts/*`, so the workflow holds no version number. In `cstack/`, it runs `npm ci`, `npm run typecheck`, `npm test` and `npm run build`. Then it runs `node dist/cli.js --version` to check that the built command starts. Any failure turns the check red.
9. Add a "Commands" section to `CLAUDE.md`. It says that you run these commands from `cstack/`: `npm ci` installs the packages, `npm test` runs the tests, and `npm run typecheck` checks the types. It also says where the code, the tests, the skills and the guides of `cstack` live.

## Acceptance (TDD)

* `cstack/test/cli.test.ts`: Write first the case where `--version` prints the version of `package.json`. It fails, because no code exists yet. Then it passes, and the exit code is 0.
* `cstack/test/cli.test.ts`: With no command, the function prints the usage on standard error and returns exit code 2. With an unknown command, it does the same.
* The code and the tests of `cstack` live in the one folder `cstack/`. `CLAUDE.md` says that the skills and guides of `cstack` live in that folder too, and #9 adds the first skill there. This is AC1 of US-1.
* The pull request of this ticket shows the CI check running on `macos-latest`, and the check is green.
* A reviewer reads `.github/workflows/ci.yml` and finds two triggers. One is every pull request, and the other is every push to `main`. The file holds no Node version number.
* `npm ci` works in a fresh clone, because `cstack/package-lock.json` is committed.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none · Feeds: #9, #10, #11, #13, #14


### Decisions already taken upstream

The parent epic is #6, "Epic: Skills into CLI" (https://github.com/gambitl/claude-code-stack/issues/6). Its specification page is `docs/projects/skills-into-cli.md`. Its block "Open questions and decisions" says, word for word:


**Open questions.** Each question has a default that applies if nobody decides.

1. The minimum Orca version is not set. By default, it is the version installed when milestone 3 starts.
2. Some tracker clients cannot link two tickets. By default, Claude creates the missing links with its own connection.
3. The token target has no percentage. By default, the new version must use fewer tokens than the baseline, for each kind of token.
4. The comparison ticket is not chosen. By default, the maintainer picks it at the start of milestone 1.
5. The plan of a ticket splits the work into units, and each unit starts with a failing test. Some units have no test. By default, the plan marks such a unit "no test" and gives a reason.
6. The minimum Node version is not set. By default, it is the current long-term support release.
7. The watch interval of `cstack wave --watch` is not set. By default, it is five minutes. Each repository has a settings file that states the rules a run must follow there, and that file can change the interval.
8. The sandbox for the comparison runs does not exist yet. By default, it is a private GitHub repository that the maintainer approves at the start of milestone 1.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`. Each one is written by the ticket named on its line.

- ADR-SIC-A, how the helpers run, is to create. The design chose Orca workers when Orca is available and Claude Code sub-agents otherwise. Ticket #27 writes it.
- ADR-SIC-B, where the run state lives and how its format is versioned, is to create. This choice is still open. Ticket #13 writes it.
- ADR-SIC-C, how `cstack` ships its skills, is to create. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 writes it.
- ADR-SIC-D, the settings file and the models of the agents, is to create. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 writes it.
- ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
- ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.


No ADR exists yet in `docs/decisions/`. None of the ADRs listed above is written by this ticket.

## Dependencies

Clear. The ticket footer says "Blocked by: none", and GitHub lists no blocking issue for #7.

Ticket #8 (M1-2, make the repository the source of the skills and of cstack) runs at the same time in another worktree. It changes `sync.sh`, `pull-skills.sh`, `skills/`, `config/`, `scripts/`, `INVENTORY.md`, `README.md` and adds `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. This ticket must not edit any of those. After #8 merges, the maintainer rewrites the whole git history of the repository to remove private names (#8, scope step 15). A branch that started before the rewrite must not be pushed as it is.

## Code mapping

**Greenfield.** The repository holds no code of `cstack`: no `cstack/` folder, no `package.json`, no `.github/` folder, no `docs/decisions/` folder. The only existing files this ticket changes are `.gitignore` (2 lines: `.DS_Store` and `.repowise/`) and `CLAUDE.md` (the conventions file, 18 lines, no "Commands" section). Their history is three commits (9d7a5f4, 3e1843c, e686ca0), with no bug fix. Graphify is not installed on this machine (`graphify` is not on the PATH), so the mapping used `git log`, the ticket, the sibling tickets and file reads. A code graph would have added nothing, because no code exists yet.

**Facts checked by running them** (2026-11-17):

- The current long-term support release of Node is 26 ("Lithium"). It became active LTS on 2026-10-28. Node 24 entered maintenance on 2026-10-20 and ends on 2028-04-30. Source: `https://nodejs.org/dist/index.json` (v26.13.1 marked `lts: Lithium`) and `nodejs/Release` `schedule.json`. The maintainer's machine runs Node v26.10.0 and npm 11.19.1.
- The latest versions on npm are `typescript` 7.0.2 (the native compiler), `vitest` 5.1.0 (engines `^22.12.0 || ^24.0.0 || >=26.0.0`) and `@types/node` 26.6.6.
- The latest releases of the official actions are `actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0.
- A throwaway package in the scratchpad, with `typescript@7`, `vitest@5` and `@types/node@26`, `module: nodenext`, `strict: true`, passed `tsc --noEmit`, `vitest run` and `tsc -p tsconfig.build.json`. The compiled `dist/cli.js` kept `#!/usr/bin/env node` as its first line, `node dist/cli.js --version` printed the version from `../package.json` and exited 0, and no argument printed the usage and exited 2.
- `tsc` does not make `dist/cli.js` executable. `npm install -g` sets the executable bit on `bin` files itself, and CI runs `node dist/cli.js`, so this needs no change.
- When the compiled file runs through a symlink, which is what `npm install -g` and `npm link` create, `process.argv[1]` is the path of the link and `import.meta.url` is the real file. A plain comparison of the two is false, so the command would silently do nothing. Comparing `realpathSync(process.argv[1])` with `fileURLToPath(import.meta.url)` works through the link (checked in the scratchpad).
- The name `cstack` on the public npm registry belongs to an unrelated package (version 0.3.4, last changed 2023-07-15). So `npm install -g cstack` or `npx cstack` would fetch someone else's code. US-2 installs `cstack` from a GitHub release link instead.

**Patterns and constraints for the new code**, from the ticket and the tickets it feeds:

- #13 (M2-1) later adds `cstack/src/manifest.ts`, the one list of commands with their options and exit codes. This ticket must not create it. #14 says every command turns a settings failure into exit code 3, so exit codes 0, 2 and later 1 and 3 have meanings.
- #9 (M1-3) later adds `files` (`dist`, `skills`, `guides`) and a `prepack` script to `cstack/package.json`, and ships releases as packaged files on GitHub.
- #10 (M1-4) later reads the minimum Node version from `engines.node` of `cstack/package.json` and writes the README "Requirements" section. The number is written only in `engines.node`.
- #8 adds a CI step that runs `scripts/test_sync.sh` if `.github/workflows/ci.yml` exists on `main` when it starts.
- Later commands such as `cstack doctor` (#10) run other programs and read files, which is asynchronous work in Node.

**Risks.** The history rewrite after #8 can happen before this branch merges. The workflow file is new, so its first run happens only on the pull request.

## Decisions

**What gets built**

- `cstack/package.json` names the package `cstack`, starts at version `0.1.0`, and says `"private": true` and `"type": "module"`. (2026-11-17, accepted by default in the question round)
- `"private": true` stays because the name `cstack` on the public npm registry belongs to an unrelated package, and `cstack` ships through GitHub releases. Never run `npm publish`. (2026-11-17, tested answer: `npm view cstack` shows version 0.3.4 by someone else)
- `engines.node` in `cstack/package.json` is `">=26"`. Node 26 is the current long-term support release since 2026-10-28. Write this number nowhere else: not in the workflow, not in the README, not in `CLAUDE.md`. (2026-11-17, tested answer, accepted by default)
- The `bin` entry is `{ "cstack": "dist/bin.js" }`. This replaces `dist/cli.js` in step 5 and step 8 of the ticket's scope. (2026-11-17, accepted by default)
- The only dependencies are dev dependencies: `typescript` `^7.0.2`, `vitest` `^5.1.0` and `@types/node` `^26`. Add no runtime dependency. (2026-11-17, tested answer, accepted by default)
- Commit `cstack/package-lock.json`, made by `npm install` with the npm on this machine (11.19.1, Node 26.10.0). Its lists of native packages for other platforms must stay as npm writes them; never prune them. (2026-11-17, tested answer)
- The three scripts are `"test": "vitest run"`, `"typecheck": "tsc --noEmit"` and `"build": "tsc -p tsconfig.build.json"`. (2026-11-17, ticket scope step 3)
- `cstack/tsconfig.json` sets `"strict": true`, `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"target": "es2024"`, `"types": ["node"]`, `"skipLibCheck": true` and `"noEmit": true`, and includes both `src` and `test`. So `npm run typecheck` checks the tests too. (2026-11-17, accepted by default)
- `cstack/tsconfig.build.json` extends `tsconfig.json`, sets `"noEmit": false`, `"rootDir": "src"` and `"outDir": "dist"`, and includes only `src`. Keep `rootDir` explicit: without it, TypeScript 7 can silently write `dist/src/cli.js`, and `bin` then points at a missing file. (2026-11-17, tested answer by the advisor)
- Never import `package.json` with an `import ... with { type: "json" }` statement. Read it at run time with `readFileSync(new URL(<relative path to cstack/package.json>, import.meta.url), "utf8")`. From `src/commands/version.ts` and `dist/commands/version.js`, that path is `../../package.json`. (2026-11-17, tested answer by the advisor)
- `cstack/src/io.ts` exports the type `Io`, which has two functions, `stdout(text: string): void` and `stderr(text: string): void`. It also exports `processIo`, whose functions write to `process.stdout` and `process.stderr`. (2026-11-17, accepted by default)
- `cstack/src/cli.ts` exports `async function run(args: string[], io: Io = processIo): Promise<number>`. `args` is the list of arguments after the program name. `run` prints only through `io` and returns the exit code. Importing `cli.ts` runs nothing. (2026-11-17, accepted by default)
- `cstack/src/cli.ts` has no shebang and never checks whether it was started as the command. (2026-11-17, accepted by default, replacing the real-path check of the draft)
- `cstack/src/bin.ts` is the command's entry file. Its first line is `#!/usr/bin/env node`, and `tsc` keeps that line in `dist/bin.js`. It calls `run(process.argv.slice(2))` and sets `process.exitCode` to the result. If `run` throws, it prints one line `cstack: <error message>` on standard error, with no stack trace, and sets `process.exitCode` to 1. (2026-11-17, accepted by default)
- No file of `cstack` ever calls `process.exit()`. Set `process.exitCode` instead. On macOS, `process.exit()` cut the output of a script piped into `wc -c` at 65,536 bytes out of 1,000,001, and agents read `cstack` through pipes. (2026-11-17, tested answer by the advisor)
- The top level of `run` reads only two things: the command name and `--version`. If the first argument does not start with `-`, it is a command name, and the rest of the arguments belong to that command, which parses its own options later. No command exists yet, so every command name is unknown. If the first argument starts with `-`, parse the arguments with `parseArgs` from `node:util`, with `strict: true`, `allowPositionals: false` and the single boolean option `version`. (2026-11-17, accepted by default)
- `cstack --version` writes the `version` field of `cstack/package.json` followed by one newline to standard output, writes nothing on standard error, and returns 0. (2026-11-17, ticket scope step 6)
- `cstack` with no argument writes the usage on standard error, writes nothing on standard output, and returns 2. (2026-11-17, ticket scope step 6)
- An unknown command, an unknown option such as `--nope` or `--help`, or any other error that `parseArgs` throws writes one line that names the problem, then the usage, on standard error. It writes nothing on standard output and returns 2. Example of the first line: `cstack: unknown command "nope"`. (2026-11-17, accepted by default)
- The usage text starts with `Usage: cstack`, names the `--version` option, and says that no command exists yet. Keep it in one constant in `cli.ts`. (2026-11-17, assumption not asked)
- `--version` is handled by `cstack/src/commands/version.ts`, which exports `async function version(io: Io): Promise<number>`. Each later command gets its own file in `cstack/src/commands/`. Do not create `cstack/src/manifest.ts`: ticket #13 creates it. (2026-11-17, ticket scope step 5)
- Tests live in `cstack/test/cli.test.ts`. They call `run` with an `Io` whose functions collect the text in strings, and they never start a process or patch `process.stdout`. The `--version` test reads the expected version from `cstack/package.json` itself. (2026-11-17, ticket acceptance and accepted by default)
- Add `cstack/node_modules/` and `cstack/dist/` to `.gitignore`, after the two lines already there. (2026-11-17, ticket scope step 7)

**The CI workflow**

- `.github/workflows/ci.yml` has the workflow name `CI` and two triggers: `pull_request` with no filter, and `push` on the branch `main`. Never use `pull_request_target`, and never add a `paths` filter: a skipped required check would block merges. (2026-11-17, ticket scope step 8 and accepted by default)
- The workflow sets `permissions: contents: read` at its top. (2026-11-17, accepted by default)
- The workflow has a `concurrency` group keyed on the workflow name and the pull request number, or the ref for a push. It cancels an older run only for pull requests: `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. (2026-11-17, accepted by default)
- The workflow has one job with the id `cstack` and the name `cstack`. Keep that name stable, because GitHub uses it as the name of the check, and renaming a required check blocks every merge. (2026-11-17, accepted by default)
- The job runs on `macos-latest` and sets `defaults.run.working-directory: cstack` on the job, not on the whole workflow. (2026-11-17, accepted by default)
- The job's steps are, in this order: `actions/checkout@v7`; `actions/setup-node@v7` with `node-version: lts/*`, `cache: npm` and `cache-dependency-path: cstack/package-lock.json`; `npm ci`; `npm run typecheck`; `npm test`; `npm run build`; `node dist/bin.js --version`. The workflow holds no Node version number. (2026-11-17, ticket scope step 8 and accepted by default)
- Do not add a step or a job for `scripts/test_sync.sh`. That script belongs to ticket #8. (2026-11-17, assumption not asked)

**The conventions file**

- Add a section `## Commands` to `CLAUDE.md`, at its end. It says that you run these commands from `cstack/`: `npm ci` installs the packages, `npm test` runs the tests, `npm run typecheck` checks the types, and `npm run build` compiles `cstack/src/` into `cstack/dist/`. (2026-11-17, ticket scope step 9)
- The same section says where things live: the code in `cstack/src/`, with one file per command in `cstack/src/commands/`; the tests in `cstack/test/`; the skills that `cstack` ships in `cstack/skills/<skill name>/`; the phase guides in `cstack/guides/<skill name>/<phase>.md`. It says that the minimum Node version is written only in `engines.node` of `cstack/package.json`. (2026-11-17, ticket scope step 9)
- The same section says, in plain sentences, that a command prints through the `io` argument of `run` and returns its exit code, and that no code calls `process.exit()`, because on macOS it can cut output that goes into a pipe. (2026-11-17, assumption not asked)
- Write `CLAUDE.md` as its existing text is written: full sentences, one idea per sentence, no fragments after a colon. (2026-11-17, conventions file and the user's writing rules)

**How the work runs**

- Use the existing branch `gambitl/cstack-scaffold`, which is checked out in this worktree and starts at commit c4becce. Do not create another branch. (2026-11-17, assumption not asked)
- Never edit `sync.sh`, `pull-skills.sh`, `skills/`, `config/`, `scripts/`, `INVENTORY.md` or `README.md`. Ticket #8 changes them at the same time in another worktree. (2026-11-17, coordinator's brief)
- Never run `cstack skills install`, never write anything under `~/.claude/skills/`, and never install `cstack` on this machine with `npm install -g` or `npm link`. Baseline runs of ticket #12 need today's prose skills unchanged. (2026-11-17, coordinator's brief)
- Just before the first push, check that `origin/main` still contains commit c4becce, with `git merge-base --is-ancestor c4becce origin/main` after a fetch. If it does not, the history rewrite of ticket #8 has happened: push nothing, do not rebase, and return a needs-decision report. The branch must then move onto the new `main` with `git rebase --onto`, and the user decides. (2026-11-17, coordinator's brief, accepted by default)
- Never force-push. Never merge the pull request; the user merges it. (2026-11-17, coordinator's brief)
- GitHub issues in this repository have no "in progress" or "in review" state. Skip those moves in the tracker. (2026-11-17, assumption not asked)
- This repository is public. No file, commit, pull request, ticket comment or decision record names an employer or a client, quotes a work ticket key, or gives a count from work retrospectives. (2026-11-17, conventions file)
- Commit messages use the Conventional Commits form with the scopes `cli`, `tests` or `docs`, followed by a plain English sentence. (2026-11-17, assumption not asked)
- Making the CI check required on `main` is a GitHub setting for the maintainer after the merge. Do not change repository settings. (2026-11-17, accepted by default)

## Architecture

The approach is locked by the ticket and the question round. `cstack/` is a small ES module package with no runtime dependency. `src/cli.ts` holds `run`, which reads the command name or `--version` and returns an exit code. `src/commands/version.ts` holds the one behaviour that exists. `src/bin.ts` is the only file that touches the process: it calls `run` and sets the exit code. A GitHub Actions workflow checks types, runs the tests, builds and starts the built command on macOS for every pull request and every push to `main`. No new decision appeared since phase 4.

## Implementation units

### Unit 1: Package, toolchain and `--version` — status: done
- Files: `cstack/package.json`, `cstack/package-lock.json`, `cstack/tsconfig.json`, `cstack/tsconfig.build.json`, `cstack/src/io.ts`, `cstack/src/cli.ts`, `cstack/src/commands/version.ts`, `cstack/test/cli.test.ts`, `.gitignore`
- Failing test: `cstack/test/cli.test.ts`: `await run(["--version"], io)` collects the `version` field of `cstack/package.json` plus a newline on standard output, nothing on standard error, and returns 0. Write the package files and the test first, run `npm install` then `npm test` in `cstack/`, and see it fail because `src/cli.ts` does not exist.
- Minimum code: `package.json`, both `tsconfig` files, the lockfile from `npm install`, `src/io.ts`, `src/commands/version.ts`, and a `run` in `src/cli.ts` that handles `--version`, all as "Decisions" says. Add the two lines to `.gitignore`. Check that `npm test`, `npm run typecheck` and `npm run build` pass, and that `git status` shows no file under `cstack/node_modules/` or `cstack/dist/`.
- Refactor: none expected.
- Commit message: `feat(cli): add the cstack package with a working --version flag`
- Depends on: none

### Unit 2: Usage and exit code 2 — status: done
- Files: `cstack/src/cli.ts`, `cstack/test/cli.test.ts`
- Failing test: `cstack/test/cli.test.ts`: three cases, written first and seen failing. With no argument, `run([], io)` collects text that starts with `Usage: cstack` on standard error, nothing on standard output, and returns 2. With `["nope"]`, it collects a first line that names `nope`, then the usage, on standard error, nothing on standard output, and returns 2. With `["--nope"]`, it does the same and names `--nope`.
- Minimum code: the usage constant and the top-level reading of `run`, as "Decisions" says. A command name that does not start with `-` is unknown; anything else goes through `parseArgs` in strict mode, and its errors become the usage and exit code 2.
- Refactor: none expected.
- Commit message: `feat(cli): print the usage and exit with code 2 on a missing or unknown command`
- Depends on: 1

### Unit 3: The command's entry file — status: done
- Files: `cstack/src/bin.ts`, `cstack/package.json` (only if `bin` is not already `dist/bin.js`)
- Failing test: no test. `bin.ts` only connects the process to `run`, and tests cannot start it before the build. The CI step `node dist/bin.js --version` checks it on every pull request. Instead, run `npm run build` in `cstack/`, then check by hand that the first line of `dist/bin.js` is `#!/usr/bin/env node`, that `node dist/bin.js --version` prints `0.1.0` with exit code 0, and that `node dist/bin.js` and `node dist/bin.js nope` exit with code 2. Write those outputs into the unit's report.
- Minimum code: `src/bin.ts` as "Decisions" says: shebang, `process.exitCode = await run(process.argv.slice(2))`, and a `catch` that prints `cstack: <message>` and sets exit code 1. No `process.exit()`.
- Refactor: none.
- Commit message: `feat(cli): add the entry file that starts the cstack command`
- Depends on: 2

### Unit 4: The CI workflow — status: done
- Files: `.github/workflows/ci.yml`
- Failing test: no test. A workflow only runs on GitHub, and the pull request's check is the evidence the ticket asks for. Instead, in `cstack/`, delete `node_modules` and `dist`, then run the same commands in the same order as the workflow: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `node dist/bin.js --version`. All must succeed. If `actionlint` is installed, run it on the file; if not, say so in the report.
- Minimum code: the workflow exactly as "Decisions" says.
- Refactor: none.
- Commit message: `ci(tests): run the cstack type check, tests and build on every pull request`
- Depends on: 3

### Unit 5: The "Commands" section of the conventions file — status: done
- Files: `CLAUDE.md`
- Failing test: no test. This unit changes prose only.
- Minimum code: the `## Commands` section at the end of `CLAUDE.md`, as "Decisions" says. Change no other line of the file.
- Refactor: none.
- Commit message: `docs(cli): say in CLAUDE.md how to run and where to find the cstack code`
- Depends on: 4

## Documentation duties

- The conventions file: applies, written to `CLAUDE.md` by unit 5.
- A comment on ticket #7: applies, written to https://github.com/gambitl/claude-code-stack/issues/7. It says what was built, that `bin` and the CI step use `dist/bin.js` instead of `dist/cli.js`, and that making the check required on `main` is left to the maintainer.
- Comments on the tickets this one feeds: applies, one comment each on #9, #10, #11, #13 and #14. #9 learns that `bin` is `dist/bin.js`, that `dist/cli.js` still exists, that `package.json` says `"private": true`, and that the npm name `cstack` belongs to someone else, so no text may tell people to run `npm install -g cstack` or `npx cstack`. #10 learns that `engines.node` is `">=26"` and is the only place with that number. #10, #11, #13 and #14 learn the shape of `run(args, io)`, that each command parses its own options, that exit code 2 means a usage error and 1 means a crash, and that no code calls `process.exit()`.
- A comment on ticket #8, which this ticket does not feed: applies. It says that `.github/workflows/ci.yml` now exists with one job named `cstack`, set on the `cstack/` folder, so the step for `scripts/test_sync.sh` belongs in a new job at the repository root, added by #8 if it merges second, or by a follow-up if #8 merges first.
- An ADR: applies, one record at `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`, committed on the branch. It records the separate entry file, the asynchronous `run` with its `io` argument, the rule against `process.exit()` and the explicit `rootDir`, with the options rejected. Add a line for it at the end of the ADR list in section 9 of `docs/projects/skills-into-cli.md`, after the ADR-SIC-G line, and change no other line of that page. Put `WHY: ADR-SIC-H` comments in `src/bin.ts` and `tsconfig.build.json`.
- The README: does not apply. Ticket #8 rewrites it now, and ticket #10 writes its "Requirements" section.
- The specification page, beyond the ADR line: does not apply. Its section 7 describes the repository as it was when the project was designed.

## Review log

### Impact notes

Graphify is not installed, so `graphify update` and `graphify affected` were not run. Every changed symbol is new, so nothing outside the diff depends on it. The only existing files changed are `.gitignore` and `CLAUDE.md`, which have no code dependents. Usual companions (git log of those two files): none that this ticket should touch; `README.md` is owned by #8 and the plan forbids editing it. The `WHY:`/`DECISION:` comments and ADRs in the repository: none exist yet; ADR-SIC-H is written in phase 10.3.

### Phase 7 review (four reviewers)

- Correctness: no bug. One fragile spot: `version(io)` was inside the `try` of `run`, so a later `await` there would turn a crash into a usage error. Fixed: the call now sits outside the `try`, with a comment.
- Security: no finding at 80 or more. Fixed the optional hardening: `persist-credentials: false` on checkout. `npm audit` could not run in the sandbox; CI or the maintainer can run it once.
- Conventions: the comments cite ADR-SIC-H, which does not exist yet. Expected; phase 10.3 writes it and the line in section 9 of the specification page.
- Simplicity: two suggestions, not applied. Folding the top level into one `parseArgs` call with `allowPositionals: true` contradicts the Decisions (a command parses its own options; only a first argument that starts with `-` goes to `parseArgs`). Making `run` and `version` synchronous contradicts the Decisions (later commands are asynchronous). `"private": true` stays on purpose.
- Tests rerun after the fixes: typecheck, 4 tests and build pass.

### Phase 8: independent review

No code change. Judgment calls: (1) the crash path had no test; a test was added after the review. (2) ADR-SIC-H is cited by two comments and is written in phase 10.3. (3) If the reader of the output closes the pipe early, Node crashes with a stack trace on the write error; a later ticket may handle it. (4) `npm ci` warns that the `fsevents` install script is blocked; harmless. (5) The plan commits use `docs:` with no scope.

### Phase 9

`origin/main` is still at c4becce, so no rebase was needed. The repository asks for no formatter or linter before a push. Typecheck, 5 tests and build pass.

## Briefing

### What you should know about what was built

I built the `cstack` package in `cstack/`. `cstack --version` prints 0.1.0 and exits with code 0. With no command or an unknown one, it prints the usage and exits with code 2. The CI workflow runs on `macos-latest` for every pull request and every push to `main`. Everything the ticket asks for is done and checked on this machine: 5 tests, the type check and the build pass. One point remains: the green check on the pull request only exists once the pull request is open.

**What you need to do**

- **Merge this pull request before you run the history rewrite of the ticket that makes the repository the source of the skills (#8).** This branch starts from the old `main`, which still holds the private names. If the rewrite runs while the pull request is open, you must move the branch with `git rebase --onto` and force-push it. If you merge first, the rewrite cleans it along with everything else. In both cases, add its number to the request to GitHub Support: like #1 to #5, a pull request keeps a hidden reference to the old commits.
- **After the merge, make the `cstack` check required on `main`** in the branch rules. Then keep the job name as it is, because renaming it would block every merge.

**What to watch**

- The first CI run on the pull request is the only real test of the workflow file. The `npm ci` warning about the blocked install script of `fsevents` is expected and harmless.
- CI follows `lts/*`, so it moves to the next long-term support release of Node with no commit. A red check on that day can come from Node, not from the change under test.
- If the program that reads the output closes the pipe early, as in `cstack … | head -1`, Node crashes with a full stack trace. It does not matter for `--version`, but I add a sentence about it to the comment for the ticket that creates the command list (#13).

**What changed since the plan**

- The CI checkout no longer keeps the git token (`persist-credentials: false`), a hardening that the security review suggested.
- The command call moved out of the `try` block of `run`, so a crash gives exit code 1 and not a usage error, and a test checks it.

#### Details

I checked the result myself on 2026-11-17. In `cstack/`, `npm test` ran 5 tests and all passed. `npm run build` succeeded. `node dist/bin.js --version` printed `0.1.0` and exited 0. `node dist/bin.js --` printed `cstack: no command given` and the usage, and exited 2. The code matches every line of "Decisions". `engines.node` is `">=26"`, and the number appears nowhere else. `bin` is `dist/bin.js`. `run(args, io = processIo)` returns `Promise<number>`, and no file calls `process.exit()`. `tsconfig.build.json` sets `rootDir: "src"`. `src/commands/version.ts` reads `../../package.json` with `readFileSync`. The workflow in `.github/workflows/ci.yml` has the two triggers, `permissions: contents: read` and the concurrency group. Its job `cstack` sets the working folder on the job and runs the seven steps in the planned order. The workflow holds no Node version number. The acceptance criterion "the pull request shows the CI check on `macos-latest`, and it is green" cannot be checked before the pull request opens. ADR-SIC-H does not exist yet: `src/bin.ts` and `tsconfig.build.json` cite it, and the documentation phase writes it with its line in section 9 of `docs/projects/skills-into-cli.md`. Ticket #8 links its own ADR from the ADR-SIC-E line of that section, and this ticket adds a line after ADR-SIC-G. The two edits are separated by unchanged lines, so no merge conflict is expected.

The merge order against the history rewrite is the main action for the maintainer. Scope step 15 of #8 rewrites every branch and tag after #8 merges. It then asks GitHub Support to remove the cached views and the hidden pull request references, and the request lists pull request numbers. Item 3 of the CTO review of #8 says that a branch made before the rewrite must be rebased onto the new `main` before it is pushed. On 2026-11-17, `git merge-base --is-ancestor c4becce origin/main` still succeeds, #8 is still open, and this branch is not pushed yet, so pushing it now brings back nothing that is not already on GitHub. Its own commits follow the public text rule. Three orders are possible. Merging this pull request before the rewrite needs no rebase and no force-push, and the rewrite covers its commits; I recommend it. Leaving it open during the rewrite needs a `git rebase --onto` and a force-push, which the plan leaves to the user. Opening it only after the rewrite would delay the five tickets that this one feeds (#9, #10, #11, #13, #14). Whatever the order, the pull request's hidden reference `refs/pull/<number>/head` keeps the old ancestors of c4becce reachable, and a force-push cannot change that reference once the pull request is merged. So its number joins #1 to #5 in the request to GitHub Support. If nobody decides and the rewrite runs first, GitHub sees two unrelated histories: it refuses the merge, or a merge commit brings the old history back. This is not a new question, because the maintainer who runs the rewrite is the person reading this.

Making the check required answers question 9 of the question round, which stayed open on purpose. The maintainer adds the check `cstack` to the branch rule or ruleset of `main` after the merge, once the check has run at least once so that GitHub offers it in the list. GitHub uses the job name as the check name. A renamed job would leave the old required check "Expected" forever and block every merge until someone edits the rule. If nobody does it, CI still runs and shows red or green, but nothing stops a merge on red.

The first CI run is the only real test of the workflow. The tags `actions/checkout@v7` and `actions/setup-node@v7` were checked to exist when the code was mapped. The review log does not say whether `actionlint` ran on the file, so the first run is the first syntax check too. Phase 8 recorded that `npm ci` warns that the install script of `fsevents` is blocked. `fsevents` is an optional macOS file watcher that Vitest does not need for `vitest run`, so the warning is harmless. If the first run is red, the likely causes are the npm cache step or the runner image, not the code, because the same commands pass on this machine in the same order.

The Node version in CI can change without any commit. `node-version: lts/*` resolves to whatever release is long-term support on the day of the run. That keeps the workflow free of a version number, as the ticket asks. The cost is that a red check can appear on a pull request that changed nothing, on the day a new Node release becomes long-term support. `engines.node` stays `">=26"`, so no install breaks. If this happens, read the Node version in the log of the setup step first.

The broken pipe crash was judgment call 3 of the independent review, and it is not blocking. When the reader of standard output closes the pipe early, the next `process.stdout.write` fails with `EPIPE`. Node raises it as an unhandled `error` event, so the process prints a stack trace and exits 1. This does not happen with `--version`, which writes a few bytes. It will matter for commands that print long output, such as `cstack wave`. One fix is a listener on `process.stdout` in `src/bin.ts` that ends quietly on `EPIPE`, and it belongs with the command list of #13. So the comment planned for #13 gains one sentence: "When the reader closes the pipe early, writing to standard output fails with EPIPE and Node prints a stack trace; `src/bin.ts` does not handle it yet, so the command list should add a quiet exit for that case." If nobody passes this on, the first long command shows a stack trace when piped into `head`, and nothing else breaks.

Two changes came after the plan, both from the code review of phase 7 (commits 1e33181 and 93f53c7). The checkout step now sets `persist-credentials: false`, so the git token is not written into `.git/config` for later steps. This changes nothing for the steps that exist. A future step that pushes from CI would need to set the credentials itself. The call to `version(io)` moved out of the `try` block that wraps `parseArgs` in `src/cli.ts`, with a comment. A crash inside a command now reaches `src/bin.ts` and gives exit code 1, instead of being printed as a usage error with exit code 2. The fifth test checks it by giving `run` an `io` whose `stdout` throws.

The earlier questions are all resolved. Questions 1 to 8, 11 and 12 were built as answered, and the code matches. Question 9 became the action above about the required check. Question 10, the history rewrite rule, passed in phase 9 and still passes now, and it stays in force until the push. Its follow-up after the pull request opens is the merge order above. The sync test of #8 is still outside CI: the comment planned on #8 says that whichever ticket merges second adds a job at the repository root. I found no new question for anyone, blocking or not.

I checked data model lock-in, scale and performance, security beyond the workflow token, operations and cost, and reversibility, and found nothing: the ticket stores no data, adds no paid service (macOS runners are free for public repositories), and a revert of the pull request undoes it completely.

## Open questions after the build

### Blocking

None.

### Non-blocking

None.

## Pull request

Title: feat(cli): scaffold the cstack command-line tool with tests and CI

Body:

This pull request creates the `cstack` command-line tool as an empty shell. It has one working command, its tests and a CI check. It is the first ticket of the "Skills into CLI" project.

**What was built.** The package lives in `cstack/`. `cstack --version` prints the version from `package.json` and exits with code 0. Running `cstack` with no command, or with an unknown one, prints the usage on standard error and exits with code 2. The workflow `.github/workflows/ci.yml` runs on `macos-latest` for every pull request and every push to `main`. It checks types, runs the tests, builds, and starts the built command. `CLAUDE.md` has a new "Commands" section.

**Key decisions, and why.** A small entry file, `src/bin.ts`, is the only file that touches the process. The command starts from `dist/bin.js`, not `dist/cli.js` as the ticket said. This keeps `run` in `src/cli.ts` easy to test. No code calls `process.exit()`, because on macOS it cut piped output at 65,536 bytes. The package is `"private": true`, because the npm name `cstack` belongs to an unrelated package. `engines.node` is `">=26"`, and the number is written nowhere else. The CI uses `lts/*`. The record is `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`, and its line is added to section 9 of the specification page.

**Files touched.** `cstack/` (new), `.github/workflows/ci.yml` (new), `docs/decisions/ADR-SIC-H-...md` (new), `docs/projects/skills-into-cli.md` (one line), `CLAUDE.md`, `.gitignore`, and the plan file `docs/plans/2026-11-17-7-scaffold-the-cstack-command-line-tool.md`.

**Review.** Four reviewers and one independent reviewer found no bug. Two changes came from them: the checkout step no longer keeps the git token, and a crash inside a command now gives exit code 1 and not a usage error, with a test. Judgment calls: if the reader of the output closes the pipe early, Node prints a stack trace. This is left to ticket #13, which has a comment about it. `npm ci` prints a harmless warning about a blocked install script of `fsevents`. The plan commits use `docs:` with no scope. No risk was accepted at the dependency gate.

**After the merge.** Merge this pull request before the history rewrite of ticket #8, and add its number to the request to GitHub Support. Then make the check named `cstack` required on `main`, and keep the job name. The closing line below fires only when the pull request merges into the default branch, which is `main`.

Fixes #7

## Documentation

- Ticket comment on #7: https://github.com/gambitl/claude-code-stack/issues/7#issuecomment-6953961463
- Dependent tickets: #9 https://github.com/gambitl/claude-code-stack/issues/9#issuecomment-6953963340, #10 https://github.com/gambitl/claude-code-stack/issues/10#issuecomment-6953964255, #11 https://github.com/gambitl/claude-code-stack/issues/11#issuecomment-6953964784, #13 https://github.com/gambitl/claude-code-stack/issues/13#issuecomment-6953965443 (with the broken pipe sentence), #14 https://github.com/gambitl/claude-code-stack/issues/14#issuecomment-6953966049
- Related ticket #8: https://github.com/gambitl/claude-code-stack/issues/8#issuecomment-6953961945
- ADR: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`, with its line in section 9 of `docs/projects/skills-into-cli.md`; `WHY: ADR-SIC-H` comments in `cstack/src/bin.ts` and `cstack/tsconfig.build.json`. Phase 12 adds the pull request link to the ADR (committed in a fix push only if a check fails; otherwise the link is not added to avoid a second push, stated in the published report).
- Conventions file: `CLAUDE.md`, section "Commands".

## Executor notes

- `graphify` and `actionlint` are not installed, so the impact check and the workflow lint were skipped; the first CI run is the first syntax check of the workflow.
- Two edits ran in the same worktree while a reviewer was reading it; one reviewer noticed an uncommitted change. No harm, but reviewers and edits should not overlap.
- The deep reviewer could not run `npm audit` (no network in its sandbox).

## Hand-off log

2026-11-17: phases 6 to 10 done. Five units built, two review rounds, ADR-SIC-H written, tickets #7 to #11, #13 and #14 commented. No blocking question. Not pushed; waiting for the retrospective, then phase 12.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

Nothing here needs your answer before I plan. The draft answers hold up, and I add four traps that I checked on this machine.

**I will do this unless you say no.**

- I write `engines.node: ">=26"`, as the specification's default says. CI only tests the current long-term support release, so a lower minimum would be a promise nobody checks. Lowering it later breaks nobody.
- `run(args, io?)` returns `Promise<number>` and prints through the two `io` functions, because `cstack doctor` (#10) and later commands do asynchronous work.
- I would rather not detect "was I started as the command" at all. `src/cli.ts` exports `run`, and a three-line `src/bin.ts` with the shebang always calls it and turns a crash into exit code 1. The `bin` entry and the CI step point to `dist/bin.js`. This removes the symlink trap instead of testing around it. It changes two lines of the ticket's scope, and `dist/cli.js` still exists for the packaging ticket (#9).
- The entry file sets `process.exitCode` and never calls `process.exit()`. I checked it: on macOS, `process.exit()` after 1 MB written into a pipe delivered only 65,536 bytes. Agents read `cstack` through pipes.
- I read `package.json` with `readFileSync`, and the build config sets `rootDir: "src"` explicitly. I checked it: with TypeScript 7, a JSON import without `rootDir` silently builds `dist/src/cli.js`, so `bin` points at nothing.
- I read the command name first, and each command parses its own options. Otherwise `parseArgs` in strict mode would reject `cstack doctor --json` at the top level. Its errors become the usage and exit code 2.
- The workflow sets the `cstack/` folder on the job, not on the whole workflow. A step at the repository root, such as the sync test, can then go in its own job.
- The other draft answers stay as they are. That covers `private: true`, version 0.1.0, a type check that covers the tests, and the actions on their `v7` tags with read-only permissions. Before the push, I check that `origin/main` still contains c4becce, and I never force-push.

**I checked it myself.**

- The lockfile lists the native binaries of TypeScript 7 and of Vitest's bundler for every platform, so `npm ci` also works on Linux or on an Intel Mac.

**Good to know.**

- The job name becomes the check name. Once the check is required on `main`, renaming the job blocks every merge, so I pick a stable name now.
- The ticket that makes the repository the source of the skills (#8) adds its sync test to CI only if `ci.yml` was on `main` when it started. It started first, so someone has to add that step after both merge.

#### Details

The minimum Node version is draft question 1. It is blocking, and a test answered it. Node 26 became the active long-term support release on 2026-10-28. Open question 6 of the specification defaults to the current long-term support release, so `>=26` follows an upstream default. The draft kept it as a question for the person. I moved it to the "unless you say no" group because the workflow uses `lts/*`, so no check ever runs Node 24. Declaring `>=24` would spare teammates on Node 24 an `EBADENGINE` warning, but it would promise a version that nobody tests. Lowering the minimum later breaks no install, while raising it does, so starting high is the safe direction. If nobody objects, `cstack/package.json` holds `">=26"`, and the README requirements of #10 read the number from there.

The shape of `run` covers draft questions 2 and 4. Question 2 is blocking, question 4 is not, and both are decided by reasoning. `cstack doctor` (#10) and `cstack measure` (#11) run programs and read files. With a synchronous `run(args): number`, every test and every command would change once they land. So `run` returns `Promise<number>`. Its optional `io` argument holds a `stdout` and a `stderr` function, which default to the process streams. Tests pass functions that collect the text, so no test patches a global. If nobody decides, this is what gets built.

I disagree with the draft's answer to question 3, which is blocking and was answered by a test. The draft checked that comparing `realpathSync(process.argv[1])` with `fileURLToPath(import.meta.url)` works through the symlink that `npm install -g` and `npm link` create. The scratchpad link `tsprobe/cstack-link` shows it. The check works, but it stays fragile. `realpathSync` throws when `argv[1]` names no file, for example under `node -e`. A bundling step in #9 would change `import.meta.url`. The check also needs its own symlink test. A separate bin file removes the problem. `src/cli.ts` exports `run` and does nothing when a test imports it. `src/bin.ts` starts with `#!/usr/bin/env node` and awaits `run(process.argv.slice(2))`. It sets `process.exitCode` with the result. On an unexpected error, it prints one line on standard error and sets exit code 1, instead of a Node stack trace. Scope step 5 says the compiled `cli.js` carries the shebang, and scope step 8 runs `node dist/cli.js --version`. Both now name `dist/bin.js` instead. The acceptance criteria do not name the file, so they stay as written. The test of #9 expects `npm pack` to list `dist/cli.js`, and that file still exists. #13 calls `cstack/src/cli.ts` the entry point that returns an exit code, and that stays true. I rejected the realpath check because it works with more code and one more test to maintain. If nobody objects, the plan uses the separate bin file.

The rule on `process.exitCode` is a new point, and I checked it. Node writes to pipes asynchronously on macOS, so `process.exit()` can drop output that is still buffered. In `scratchpad/probe2/exit.mjs`, a script writes 1,000,001 bytes and then calls `process.exit(0)`. Piped into `wc -c`, it delivered 65,536 bytes. The same script with `process.exitCode = 0` delivered all 1,000,001 bytes. Agents read `cstack` through pipes, and later commands such as `cstack wave` print long output. So this rule protects every command, and it lives in the bin file only. If nobody decides, someone will likely write `process.exit(code)`, the usual idiom, and long output will be cut on macOS without any error.

How the code reads its version is a new point, and I checked it. In `scratchpad/probe2`, the source used `import pkg from "../package.json" with { type: "json" }` and the config set no `rootDir`. TypeScript 7 compiled it with exit code 0. The output was `dist/src/cli.js` plus a copy at `dist/package.json`. The `bin` entry would then point at a missing file, and only the CI smoke step would notice. Without the JSON import and without `rootDir`, TypeScript 7 stops with error TS5011 and asks for an explicit `rootDir`. So the build config sets `"rootDir": "src"`. The code reads the version at run time with `readFileSync(new URL("../package.json", import.meta.url))`. That path reaches `cstack/package.json` from `src/` under Vitest and from `dist/` after the build. The draft's scratchpad package already does both, and the plan should state them. I rejected the JSON import because it ties the output layout to a file outside `src/`.

Argument parsing extends draft question 7, which is not blocking. In strict mode, `parseArgs` from `node:util` throws a `TypeError` with code `ERR_PARSE_ARGS_UNKNOWN_OPTION`. It also rejects positionals unless `allowPositionals` is set. Suppose the top level parses the whole line strictly and declares only `--version`. Then every option of a later command fails before the command runs. So the top level takes the first positional as the command name and handles only `--version`. It passes the rest to the command, which parses its own options. A parse error prints the usage on standard error and returns exit code 2. `--help` stays a usage error for now, as the draft says, until the command list of #13 exists.

The workflow layout extends draft question 8, which is not blocking. Suppose the workflow sets `defaults.run.working-directory: cstack` at its top. Then a later step at the repository root, such as `scripts/test_sync.sh` from #8, runs in the wrong folder. Setting the folder on the `cstack` job keeps that job self-contained, and another job can run at the root. The draft's other workflow choices stay. The trigger is `pull_request`, not `pull_request_target`, so a pull request from a fork runs with a read-only token and no secrets. Pushes to `main` also trigger it. Permissions are `contents: read`. `actions/checkout@v7` and `actions/setup-node@v7` stay on major tags. They are official actions, and pinning them by commit hash would add upkeep for little gain. The npm cache uses `cache-dependency-path: cstack/package-lock.json`. A `concurrency` group cancels an older run of the same pull request. macOS runners are free for public repositories, so the workflow adds no recurring cost. The specification keeps the repository public by choice.

Draft questions 5, 6, 9, 11 and 12 are not blocking, and I keep their answers. The tool versions are `typescript` ^7.0.2, `vitest` ^5.1.0 and `@types/node` ^26, tested together. `package.json` says `"private": true`, because the npm name `cstack` belongs to an unrelated package. The maintainer makes the check required after this pull request merges. `tsconfig.json` covers `src/` and `test/` with no output. `tsconfig.build.json` compiles only `src/`. The version starts at `0.1.0`.

Draft question 10 is blocking for the push, and a rule decides it. I keep the draft's rule. Just before the push, check that `origin/main` still contains c4becce. If it does not, stop and never force-push. The plan file under `docs/plans/` follows the public text rule, so the history rewrite of #8 has nothing to remove from it.

The lockfile check is a new point. npm used to leave the optional platform packages of other systems out of a lockfile, and `npm ci` then failed on another platform. The draft's lockfile is `scratchpad/tsprobe/package-lock.json`, made on this Mac with npm 11.19.1. It lists `@typescript/typescript-*`, `@rolldown/binding-*` and `lightningcss-*` for Linux, Windows, FreeBSD and both Mac architectures. So `npm ci` works on `macos-latest` and on any machine a teammate uses.

The job name is worth fixing now. GitHub uses the job name as the name of the status check. When a required check's job is renamed, the old check stays "Expected" forever, and every merge is blocked until someone edits the branch rule. So the plan gives the job a plain, stable name, such as `cstack`. A `paths` filter on the workflow would cause the same hang on pull requests it skips. So the workflow runs on every pull request, as the ticket says.

The sync test may never reach CI, and this is not blocking. The scope of #8 adds a step for `scripts/test_sync.sh` only if `.github/workflows/ci.yml` exists on `main` when it starts. Both tickets run at the same time, so #8 will most likely say in its pull request that the script runs by hand. This ticket must not add the step, because the script belongs to #8. If nobody acts, the sync test never runs in CI. A follow-up after both merges can add a job at the repository root.

I checked four more areas and found nothing to add: data model lock-in, scale and performance, interface edge cases beyond the usage error, and security beyond the workflow token. This ticket stores no data, has no users yet, and exposes only `--version` and the usage line.

### Open questions and answers

1. **Which minimum Node version goes into `engines.node`?** Blocking, because it is the number the ticket writes. Recommended: `>=26`. Tested answer: Node 26 is the current long-term support release since 2026-10-28 (see "Code mapping"). Node 24 is still maintained until 2028-04-30, so teammates on Node 24 would get an `EBADENGINE` warning from npm, and `cstack doctor` (#10) would call their Node too old.
   Answer (2026-11-17, accepted by default in the question round): `>=26`.
2. **Should `run` be synchronous or asynchronous?** Blocking, because it fixes the signature that every later command and test uses. The ticket says only that it "returns an exit code". Recommended: `run(args, io?)` returns `Promise<number>`. Commands such as `cstack doctor` (#10) and `cstack measure` (#11) run programs and read files, so a synchronous signature would have to change in every caller and every test later.
   Answer (2026-11-17, accepted by default): `run(args, io?)` returns `Promise<number>`.
3. **How does the compiled file know it was started as the command?** Blocking, because a wrong check makes the installed command print nothing. Tested answer: through the symlink that `npm install -g` creates, `process.argv[1]` is the link path. Recommended: compare real paths, and test that check with a temporary symlink.
   Answer (2026-11-17, accepted by default, replacing the draft's recommendation after the advisor's review): no "started as the command" check. `src/cli.ts` exports `run` and runs nothing on import. A separate `src/bin.ts` with the shebang always calls `run`, and `bin` and the CI step point to `dist/bin.js`.
4. **How do tests read what `run` prints?** Non-blocking. Recommended: `run` takes an optional second argument with two functions, `stdout` and `stderr`, that default to writing on the process streams. Tests pass functions that collect the text, so no test patches a global.
   Answer (2026-11-17, accepted by default): an optional `io` argument with `stdout` and `stderr` functions.
5. **Which tool versions?** Non-blocking. Recommended: `typescript` ^7.0.2, `vitest` ^5.1.0 and `@types/node` ^26 as dev dependencies, all tested together in the scratchpad.
   Answer (2026-11-17, accepted by default): as recommended.
6. **Should `package.json` say `"private": true`?** Non-blocking. Recommended: yes. The name `cstack` on npm belongs to an unrelated package, and US-2 ships through GitHub releases, so nobody should run `npm publish`. `private` does not stop `npm pack` or an install from a release link.
   Answer (2026-11-17, accepted by default): yes.
7. **What does `cstack --help` or an unknown option do?** Non-blocking. Recommended: an unknown option, `--help` included, prints the usage on standard error and exits 2, like an unknown command. A friendly `--help` can come with the command list of #13.
   Answer (2026-11-17, accepted by default): as recommended. The top level reads only the command name and `--version`, and each command parses its own options.
8. **How are the GitHub actions pinned, and what else goes into the workflow?** Non-blocking. Recommended: major tags `actions/checkout@v7` and `actions/setup-node@v7`, `permissions: contents: read`, the npm cache keyed on `cstack/package-lock.json`, and a `concurrency` group that cancels an older run of the same pull request.
   Answer (2026-11-17, accepted by default): as recommended, with the `cstack/` folder set on the job and a stable job name.
9. **Should the CI check be required before a merge on `main`?** Non-blocking, because it is a repository setting and not code. Recommended: the maintainer turns it on in the GitHub settings after this pull request merges, once the check has run once.
   Answer (2026-11-17): open, not needed for this ticket. It is a GitHub setting for the maintainer after the merge.
10. **What happens if the history rewrite of #8 lands first?** Blocking for the push. Recommended rule: just before the push, check that `origin/main` still contains commit c4becce, where this branch starts. If it does not, stop and tell the user, and never force-push. After the pull request opens, a rewrite before the merge means the user moves the branch with `git rebase --onto` and decides on the force-push.
   Answer (2026-11-17, accepted by default): as recommended.
11. **Does `npm run typecheck` check the tests too?** Non-blocking. Recommended: yes. `tsconfig.json` covers `src/` and `test/` with no output, and `tsconfig.build.json` compiles only `src/` into `dist/`.
   Answer (2026-11-17, accepted by default): yes.
12. **What version does `package.json` start at?** Non-blocking. Recommended: `0.1.0`. #9 decides how versions move with releases.
   Answer (2026-11-17, accepted by default): `0.1.0`.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. The question of how the compiled file starts the command was settled in phase 4: a separate entry file instead of a real-path check.
