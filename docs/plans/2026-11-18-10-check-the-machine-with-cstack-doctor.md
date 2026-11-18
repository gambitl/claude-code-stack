# Plan: #10 — M1-4: Check the machine with cstack doctor

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/10
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/cstack-doctor
Conversation language: French
Status: ready for review

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Give every teammate one command that says what is missing on their Mac, before a run fails because of it.

- **What the title means**: `cstack` is the command-line tool that this project builds. `cstack doctor` is one of its commands, and it checks the computer the way a doctor checks a patient. It looks for each program that `cstack` and the skills need. It says which ones are there, at which version, and how to install the missing ones.
- **Why we are doing it**: `resolve-issue` is the set of instructions that Claude follows to take a ticket to finished code. Each run of it uses several programs. Among them are Graphify, the tool that maps the code of a repository, and Orca, a desktop app that runs several coding agents side by side. Today a missing program shows up only when a run stops halfway, after it has already spent part of the Claude subscription.
- **For the user**: A solution engineer runs one command after the install. They get a short list of what to fix, with the install command for each missing program.

**Goal.** This ticket adds `cstack doctor` and a "Requirements" section in the README, and a test keeps the two lists identical, for US-3. Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #7 creates the package and its entry point.
* **README**: `README.md` has no "Requirements" section. Its sections start at lines 7, 18, 31, 45 and 55. #8 rewrites some of them in parallel, so expect a small merge.
* **Node version**: `docs/projects/skills-into-cli.md` (line 312): Open question 6 says that `cstack` targets the current long-term support release of Node, stated in `package.json` and in the README. #7 writes the minimum in `engines.node` of `cstack/package.json`. Read it from there, and never write the number a second time.
* **Graphify**: `skills/resolve-issue/SKILL.md` (line 84): The skill reads `graphify-out/graph.json`. When the `graphify` command is missing, it suggests `uv tool install graphifyy` and maps the code with search and file reads instead. Graphify is therefore optional. It is not installed on the machine where this ticket was written, so check its version flag with `graphify --help` before you rely on it.
* **Orca**: `docs/projects/skills-into-cli.md` (line 293): `orca status` says whether Orca runs. On the maintainer's machine, `orca --version` prints `1.4.259`, and `orca status --help` documents `--json`. `orca jira connection --help` says that the command lists saved Jira site connections, not verified access. `orca linear team list --help` gives the example `orca linear team list --workspace all --json`, which lists the connected Linear teams.
* **Other version commands**: On the maintainer's machine, the first line of `gh --version` reads `gh version <x.y.z> (<date>)`. `glab --version` prints `glab <x.y.z> (<commit>)`, `claude --version` prints `<x.y.z> (Claude Code)`, and `git --version` prints `git version <x.y.z>`. `sw_vers -productVersion` prints the macOS version.
* **Minimum Orca version**: `docs/projects/skills-into-cli.md` (line 307): Open question 1 says that the minimum Orca version is the one installed when milestone 3 starts. This ticket therefore prints the Orca version but does not judge it.
* **The story**: `docs/projects/skills-into-cli.md` (lines 77 to 83): US-3 lists three acceptance criteria. This ticket carries AC1 and AC3. It carries AC2 except the check that the Orca version is supported, which #24 adds.

## Scope

1. Keep the list of requirements in one file, `cstack/src/doctor/requirements.ts`. Each item has a name, says whether it is required or optional, says how to read its version, and says how to install it. The items are macOS, Node, git, Graphify, the forge client, Claude Code and Orca. A forge client is the command-line client of the service that hosts the code, `gh` for GitHub or `glab` for GitLab. Either one satisfies the item, and doctor reports both.
2. Add `cstack doctor`. For each item, it prints whether the item is present and its version. When an item is missing, it prints how to install it. For Node, it compares the running version with `engines.node` and reports a version that is too old.
3. macOS, Node, git, one forge client and Claude Code are required. Graphify and Orca are optional, because `resolve-issue` maps the code with search when Graphify is missing, and every Orca feature has a fallback. Exit with code 0 when every required item is present, and with code 1 otherwise.
4. Report Orca in three parts. First, say whether Orca is available, which means that the `orca` command exists and `orca status --json` says that Orca answers. Second, print the version that `orca --version` gives. Third, list the trackers that Orca is connected to. A tracker is the tool that holds the tickets. Jira counts when `orca jira connection --json` lists a saved connection. Linear counts when `orca linear team list --workspace all --json` lists a team.
5. Print only the tracker names. Never print a site, a workspace, a team or an account that an Orca answer holds.
6. Do not judge whether the Orca version is supported. #24 adds that check, because the minimum version is set when milestone 3 starts.
7. Run every external command with a time limit of a few seconds. Report a command that does not answer in time, then go on with the next item.
8. Doctor only reads. It runs version, status and list commands, and nothing else. It never installs anything, and it never starts Orca.
9. Send every external command through one small runner, which tests replace with a fake. Record the real output of each command as a test fixture. Before you commit a recorded Orca answer, replace every site name, workspace, team, account and email in it with a neutral placeholder.
10. Add a "Requirements" section to the README with the same items in the same order. Each item is one bullet that starts with its name in bold, such as `- **Node**: ...`. Say which items are optional and how to install each one. For Node, write "the current long-term support release" and point to `engines` in `cstack/package.json`.

## Acceptance (TDD)

* `cstack/test/doctor.test.ts`: Write first the case "every item is present", with the fake runner. It fails, because the command does not exist yet. Then doctor prints one line per item with its version, and it exits with code 0.
* Same file: when Graphify is missing, doctor prints `uv tool install graphifyy` and still exits with code 0. When git is missing, it prints how to install git and exits with code 1. When neither `gh` nor `glab` is present, it exits with code 1. A Node version below `engines.node` is reported as too old.
* Same file: when Orca is missing, doctor says that Orca is not available and exits with code 0. When Orca is present, doctor prints its version and lists Jira and Linear from the recorded answers. An empty connection list adds no tracker.
* Same file: a command that never answers is reported after the time limit, and doctor still checks the other items.
* Same file, negative: the fake runner records every command that doctor runs. The list holds only version, status and list commands. It never holds `orca open`, `orca serve` or an install command.
* Same file, negative: a recorded Orca answer that holds a site name and an email gives an output that holds neither.
* `cstack/test/readme-requirements.test.ts`: It reads `README.md` at the repository root and takes the bold names under `## Requirements`. It compares them with the names in `requirements.ts`. Write it first. It fails today, because the section does not exist. Then it passes. It also fails when someone adds an item to only one of the two lists.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #7 · Feeds: #24

### Ticket comments

Comment by the maintainer on 2026-11-17, after ticket #7 closed:

Ticket #7 is done. Two facts matter for this ticket.

The minimum Node version is `">=26"`, written in `engines.node` of `cstack/package.json`. That is the only place with the number. The CI workflow uses `lts/*` and the conventions file does not repeat it, so you should read the number from `engines.node` and write it in words in the README.

A command is a function that prints through an `io` argument and returns its exit code. The top-level function is `run(args, io)` in `cstack/src/cli.ts`, and `io` has `stdout` and `stderr`. Each command gets its own file in `cstack/src/commands/`, and parses its own options. Exit code 2 means a usage error and exit code 1 means a crash. No code calls `process.exit()`, because on macOS it can cut output that goes into a pipe. Tests call `run` with a fake `io`, as `cstack/test/cli.test.ts` shows.

### Decisions already taken upstream

From the specification page, `docs/projects/skills-into-cli.md`, section 4:

- **Orca when available, with a fallback.** Every feature that uses Orca also works without Orca. `cstack` checks Orca feature by feature. For example, when Orca runs but is not connected to the tracker, only the tracker access falls back.
- **No credentials in `cstack`.** `cstack` never stores a token or a password. It reaches a tracker or a forge only through a command-line client that is already logged in on the machine, such as `orca`, `glab` or `gh`. When no such client exists, Claude reads the tracker with its own connection, and it hands the data to `cstack` as a file.
- **Tool-agnostic.** No story assumes one specific tracker or forge. The tracker can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code and the pull requests, can be GitLab or GitHub.
- **Ticket text is data.** `cstack` treats the text of a ticket, a comment or a plan as data. It never runs a command because such a text asks for it.
- **Claude is the only default agent.** Another agent can be used only where the settings file of the repository names it.
- **macOS only.** No story supports another operating system.
- **Public text.** Every text in this repository or in its issues follows the public text rule of section 5.

From section 9 of the same page, the items that touch this ticket:

- Open question 1. **Minimum Orca version.** Orca changes fast, and some of its commands are already marked as retired. If nobody decides, the minimum is the version installed when milestone 3 starts. The recommendation is to pin that version in `cstack doctor` and to keep the tests on recorded Orca answers.
- Open question 6. **Node version.** If nobody decides, `cstack` targets the current long-term support release of Node. The recommendation is to state the minimum in `package.json` and in the README.
- **ADR-SIC-F, how `cstack` reaches trackers and forges.** `cstack` uses command-line clients that are already logged in, or data that Claude hands over in a file. It never holds credentials.
- **ADR-SIC-H, how a `cstack` command starts and ends.** The options are one entry file that does everything, or a separate entry file with an asynchronous `run` function that other code and tests can call. Ticket #7 chose the separate entry file. The record is `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.

Decision records:

- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.
- ADR-SIC-E, the new role of the repository (the repository is public): `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.
- ADR-SIC-F, how cstack reaches trackers and forges, is a candidate and is not written yet.

## Dependencies

Clear. The only blocker is #7, the ticket that scaffolds `cstack`, and it is closed.

Two other tickets of milestone M1 run at the same time in other worktrees. Ticket #9 adds the release and `cstack skills install`. It edits `cstack/package.json` (the `files` list and a `prepack` script) and `README.md` (a new "Install cstack" section). Ticket #11 adds `cstack measure`. All three tickets register a command in `cstack/src/cli.ts`. Keep the changes to these shared files small and in their own section. When another ticket of the wave merges first, resolve the conflicts by keeping both changes.

## Code mapping

Graphify is not installed on this machine, so the code was mapped with file reads. The `cstack` package is small: four source files and one test file.

**The code.**

- `cstack/src/cli.ts` (lines 18 to 40) holds `run(args, io)`. Today it refuses any first argument that does not start with `-` (line 24, "unknown command"). It parses only `--version`, with `parseArgs` in strict mode. The usage text (lines 5 to 11) says "No command exists yet." Doctor is the first subcommand, so `run` must send `doctor` to its command before line 24, and the usage text must list it. Tickets #9 and #11 change the same lines.
- `cstack/src/bin.ts` is the only file that touches the process (ADR-SIC-H). This ticket does not change it.
- `cstack/src/io.ts` defines the `Io` type, with `stdout` and `stderr`.
- `cstack/src/commands/version.ts` shows the pattern of a command. It is an async function that takes `io` and returns an exit code. It reads `package.json` at run time with `new URL("../../package.json", import.meta.url)`. That path works from `src/commands/` in the tests and from `dist/commands/` after the build. Doctor reads `engines.node` the same way.
- `cstack/test/cli.test.ts` has a `collect()` helper that builds a fake `io`. Tests call `run` directly and never start a process.
- `cstack/package.json` sets `engines.node` to `">=26"`. The package has no runtime dependency. Its development dependencies are TypeScript 7, Vitest 5 and `@types/node` 26.
- `cstack/tsconfig.json` includes `src` and `test`, in strict mode with `nodenext` modules.
- `.github/workflows/ci.yml` runs on a macOS runner with Node `lts/*`. It runs `npm run typecheck`, `npm test`, `npm run build`, then `node dist/bin.js --version`.
- `README.md` has sections at lines 7, 22, 37, 57 and 67, and no "Requirements" section. Line 35 says that the install steps of `cstack` come later. Ticket #9 replaces that line.

**The external commands, checked on this machine.** Their real output stays out of this repository.

- `sw_vers -productVersion` prints one line, the macOS version.
- Doctor runs on Node, so it reads the running version from `process.versions.node` and does not start `node`.
- `git --version` prints `git version <x.y.z>`.
- The first line of `gh --version` is `gh version <x.y.z> (<date>)`, and the second line is a link.
- `glab --version` prints `glab <x.y.z> (<commit>)`.
- `claude --version` prints `<x.y.z> (Claude Code)`. On this machine `claude` is a zsh wrapper script.
- `orca --version` prints `<x.y.z>`. The `orca` command is a bash script that runs Orca's Electron binary in Node mode. Each `orca` call took about 0.3 seconds.
- `orca status --json` answers `{ id, ok, result: { target, app: { running, pid, desktopWindowStatus }, runtime: { state, reachable, connectionState, runtimeId, appVersion, ... }, graph: { state } }, _meta }`. Orca's command-line code (`app.asar.unpacked/out/cli/runtime/status.js`, lines 16 to 36, Orca 1.4.259) answers even when the app is closed. It then sets `app.running` to false, `runtime.reachable` to false and `runtime.state` to `not_running` or `stale_bootstrap`.
- `orca jira connection --json` answers `{ id, ok, result: { connected, viewer, sites: [], activeSiteId, selectedSiteId, credentialProtection, supportsScopedTokens }, _meta }`. Orca's code sets `connected` to `sites.length > 0`. A site holds `id`, `siteUrl`, `email`, `displayName`, `accountId`, `authType` and sometimes `apiBaseUrl`. The viewer holds `accountId`, `displayName` and `email`. Orca has no Jira connection on this machine.
- `orca linear team list --workspace all --json` answers `{ id, ok, result: { teams: [], meta: { workspaceId, returned, partial, workspaceErrors: [] } }, _meta }`. A team holds `key`, `name` and sometimes `workspace: { name }`. For each entry of `workspaceErrors`, Orca's command prints a warning on stderr that names a Linear workspace (`cli/linear/linear-format.js`). Orca has no Linear team on this machine.
- Graphify is not installed here. Version 0.9.112 of the `graphifyy` package on PyPI was read without running it. In `graphify/__main__.py`, lines 846 to 867, the flags `-v`, `--version` and `version` print `graphify <version>` on stdout. The comment there says that version and help "only report, so they leave installed files alone". Its warnings about stale skill copies go to stderr.
- Node's `execFile` with a time limit of 300 ms returned after 307 ms, even when the child had started a grandchild that kept the output pipe open (Node 26.10, `sh -c "sleep 4 & wait"`). The grandchild keeps running until it ends on its own.

**Risks.**

- Tickets #9 and #11 edit `cli.ts` and `README.md` at the same time.
- Orca's JSON answers can change, because Orca moves fast (open question 1 of the specification). The tests use recorded answers, so CI does not see a change of format.
- The Orca answers and the stderr of `orca` commands hold private names, such as a Jira site, an email or a Linear workspace. The output of doctor must never repeat them.

**Governing decisions.** ADR-SIC-H sets how a command starts and ends: `run` and `io`, exit code 2 for a usage error and 1 for a crash, no `process.exit()`, and `package.json` read at run time. The conventions file says that `engines.node` is the only place that holds the minimum Node version. Section 4 of the specification sets the rules for every story: macOS only, no credentials in `cstack`, no tracker or forge assumed, and every Orca feature with a fallback.

## Decisions

**Shape of the command and shared files**

- `cstack doctor` lives in `cstack/src/commands/doctor.ts`, and its helpers live in `cstack/src/doctor/`. The command follows ADR-SIC-H: it prints through `io`, returns its exit code, and never calls `process.exit()`. (2026-11-18, upstream decision.)
- `run` in `cstack/src/cli.ts` sends `doctor` to its command with one `if` line placed before the "unknown command" check, and the usage text gains one line for `cstack doctor`. Keep this change that small, because tickets #9 and #11 edit the same lines. When they merge first, keep both changes. (2026-11-18, wave instruction.)
- `cstack doctor` takes no option. Any argument after `doctor` is a usage error: doctor prints the problem and the usage on stderr, returns exit code 2, and runs no external command. (2026-11-18, assumption not asked.)
- This ticket does not change `cstack/package.json` and adds no dependency. Ticket #9 also edits that file. (2026-11-18, user's answer, accepted by default.)
- Never write the minimum Node number in any file other than `engines.node` of `cstack/package.json`. Doctor reads it at run time from `package.json`, the same way `cstack/src/commands/version.ts` does. The README writes it in words. (2026-11-18, conventions file and ticket comment.)

**The list of requirements**

- `cstack/src/doctor/requirements.ts` holds the one list of requirements. Each item has a name, says whether it is required or optional, says how to read its version, and says how to install it. (2026-11-18, ticket scope.)
- The item names, in this order, are `macOS`, `Node`, `git`, `Graphify`, `Forge client`, `Claude Code` and `Orca`. The README uses exactly these names, in the same order. (2026-11-18, ticket scope.)
- macOS, Node, git, the forge client and Claude Code are required. Graphify and Orca are optional. (2026-11-18, ticket scope.)
- Doctor exits with code 0 when every required item is present and working. It exits with code 1 when at least one required item is missing, too old, failed, or did not answer in time. Optional items never change the exit code. (2026-11-18, ticket scope and user's answer, accepted by default.)

**How each item is read**

- macOS: doctor runs `sw_vers -productVersion` and prints the first line. When the command is missing, macOS is missing and the hint says that `cstack` runs only on macOS. (2026-11-18, ticket.)
- Node: doctor does not start `node`. It reads the running version from `process.versions.node`, passed in as an input so that tests can change it. It compares that version with `engines.node`. A lower version is reported as too old, with the minimum read from `engines.node`, and counts as a problem. (2026-11-18, ticket scope.)
- Doctor understands only the `engines.node` form `>=<major>`, `>=<major>.<minor>` or `>=<major>.<minor>.<patch>`. Any other form makes the comparison function throw an error. A test reads the real `cstack/package.json` and fails when `engines.node` has another form. (2026-11-18, user's answer, accepted by default.)
- git: doctor first runs `xcode-select -p`. When it fails and the first `git` on the PATH is `/usr/bin/git`, doctor reports git as missing with the hint `xcode-select --install`, and it never runs git. On a Mac without the developer tools, `/usr/bin/git` opens a system window that offers an install, and doctor must only read. Any other git, such as Homebrew's, runs as usual with `git --version`. Doctor finds the first `git` on the PATH by reading the PATH folders itself, through an input that tests replace. (2026-11-18, user's answer, accepted by default.)
- Graphify: doctor runs `graphify --version` and reads the version from the stdout line `graphify <version>`. (2026-11-18, tested answer: graphifyy 0.9.112 source.)
- Forge client: doctor runs `gh --version` and `glab --version` and reports both. The item is present when at least one of them answers. `gh` prints `gh version <x.y.z> (<date>)` on its first line, and `glab` prints `glab <x.y.z> (<commit>)`. Doctor does not check whether either client is logged in. (2026-11-18, ticket scope.)
- Claude Code: doctor runs `claude --version`, which prints `<x.y.z> (Claude Code)`. (2026-11-18, ticket.)
- Orca has three parts. First, Orca is available when the `orca` command exists and `orca status --json` exits with code 0 and its `result.runtime.reachable` is true. Second, doctor prints the version from `orca --version`, whatever the state of the app. Third, doctor lists the trackers. (2026-11-18, tested answer: Orca 1.4.259 command-line code.)
- When the `orca` command is missing, doctor says that Orca is not installed and gives the download hint. When the command exists but the app does not answer, doctor says that Orca is installed but not running and that the trackers were not checked. In that case it never runs the Jira and Linear commands. (2026-11-18, user's answer, accepted by default.)
- Jira counts as connected when `result.sites` of `orca jira connection --json` holds at least one site. Linear counts when `result.teams` of `orca linear team list --workspace all --json` holds at least one team. When the Linear team list is empty and `result.meta.workspaceErrors` holds at least one entry, doctor prints "Linear (connection error)" instead. An empty list with no error adds no tracker. An answer that is not valid JSON, or has `ok` false, adds no tracker. (2026-11-18, tested answer and user's answer, accepted by default.)
- Doctor never judges whether the Orca version is supported. Ticket #24 adds that check. (2026-11-18, ticket scope.)

**What doctor may run and print**

- Doctor runs only these commands: `sw_vers -productVersion`, `xcode-select -p`, `git --version`, `graphify --version`, `gh --version`, `glab --version`, `claude --version`, `orca --version`, `orca status --json`, `orca jira connection --json` and `orca linear team list --workspace all --json`. It never installs anything, and it never starts Orca. (2026-11-18, ticket scope.)
- Doctor prints only the versions it parsed, the tracker names `Jira` and `Linear`, the minimum Node version read from `engines.node`, and fixed sentences. It never prints the raw output or the stderr of a command, never a path, and never a site, workspace, team, account or email. (2026-11-18, ticket scope and user's answer, accepted by default.)
- When a command answers but doctor cannot find a version in its output, the item is present with an unknown version. (2026-11-18, assumption not asked.)

**The runner and the time limit**

- Every external command goes through one runner, in `cstack/src/doctor/runner.ts`. The runner takes a command and its arguments and returns one of four results: ok with the stdout, failed with the exit code, missing when the command is not found, or timeout. Tests replace it with a fake. (2026-11-18, ticket scope.)
- The real runner uses `execFile` from `node:child_process`, with no shell and with its `timeout` option. A command that is not found gives the error code `ENOENT`, which means missing. (2026-11-18, tested answer: Node 26.10.)
- Each command gets 5 seconds. The commands run one after another, in the order of the list. When a command does not answer in time, doctor reports that it did not answer within 5 seconds and goes on with the next item. (2026-11-18, user's answer, accepted by default.)
- On a timeout, the runner does not kill the process group. A grandchild process can outlive doctor for a short time. (2026-11-18, user's answer, accepted by default.)

**Output**

- Doctor prints one line per item, in the order of the list, then one summary line. The line format is `<name>: <details>`. The name of an optional item is followed by ` (optional)`. (2026-11-18, user's answer, accepted by default.)
- Examples of lines: `git: 2.55.0`. `Graphify (optional): missing. Install it with "uv tool install graphifyy". This needs uv ("brew install uv"). If the command is still not found, run "uv tool update-shell".` `Forge client: gh 2.101.0, glab missing`. `Claude Code: did not answer within 5 seconds`. `Node: 24.1.0 is too old. cstack needs >=26. Install the current long-term support release from https://nodejs.org.` `Orca (optional): 1.4.259, running. Trackers: Jira, Linear`. `Orca (optional): 1.4.259, installed but not running. Trackers were not checked.` (2026-11-18, assumption not asked.)
- The summary line says `Every required item is present.` when the exit code is 0. Otherwise it says how many required items need attention, for example `2 required items need attention.` (2026-11-18, assumption not asked.)
- The install hints are these. macOS: `cstack runs only on macOS.` Node: install the current long-term support release from https://nodejs.org. git: `xcode-select --install`. Graphify: `uv tool install graphifyy`, which needs uv (`brew install uv`), then `uv tool update-shell` if the command is still not found. Forge client: `brew install gh` for GitHub or `brew install glab` for GitLab. Claude Code: `curl -fsSL https://claude.ai/install.sh | bash`. Orca: download it from https://github.com/stablyai/orca/releases. (2026-11-18, user's answer, accepted by default.)
- Doctor has no `--json` output in this ticket. (2026-11-18, user's answer, accepted by default.)

**Fixtures and privacy**

- The recorded command outputs live in `cstack/test/fixtures/doctor/`. Record each real output on this machine with the real command. (2026-11-18, ticket scope.)
- For the Orca answers, record the real answers of this machine, then replace every id, `runtimeId`, `pid` and `workspaceId` value with a neutral placeholder. Orca has no Jira connection and no Linear team on this machine. Build the connected Jira answer, the connected Linear answer and the Linear answer with a workspace error from the real empty answers. Add exactly the fields that Orca's code writes: a Jira site has `id`, `siteUrl`, `email`, `displayName`, `accountId` and `authType`, and the viewer has `accountId`, `displayName` and `email`. A Linear team has `key`, `name` and `workspace: { name }`. A workspace error has `workspace: { name }` and `message`. Use placeholders such as `example.atlassian.net` and `person@example.com`. Build the answer of a closed Orca from Orca's code: `app.running` false, `pid` null, `runtime.state` `not_running`, `runtime.reachable` false, `runtimeId` null, and `graph.state` `not_running`. (2026-11-18, user's answer, accepted by default.)
- Graphify is not installed on this machine. Its fixture is the line `graphify 0.9.112`, which its code prints. (2026-11-18, tested answer.)
- Never copy the output of a real `cstack doctor` run on this machine into the repository, the pull request, the plan file or the retrospective. It can name local tools and folders. (2026-11-18, wave instruction.)
- Before each commit that adds or changes a fixture, run `python3 scripts/private_names.py check <file>` on each fixture file from the repository root. It must exit with code 0. Never print the private list. (2026-11-18, conventions file.)

**README**

- Add a `## Requirements` section to `README.md`, right after the two introduction paragraphs and before `## How to update the copy of my configuration`. Each item is one bullet that starts with its name in bold, such as `- **Node**: ...`. Say which items are optional and how to install each one. For Node, write "the current long-term support release" and point to `engines.node` in `cstack/package.json`. Mention `cstack doctor` as the way to check the list. (2026-11-18, ticket scope and user's answer, accepted by default.)
- Ticket #9 adds an "Install cstack" section to the README at the same time. If it merged first, keep both sections, with "Requirements" first. (2026-11-18, wave instruction.)
- Never run `cstack skills install` against the real home folder, and never change anything under `~/.claude/skills/`. (2026-11-18, wave instruction.)

**Commits, the push and the pull request**

- The repository is public. Never write an employer or client name, a work ticket key, or a count from work retrospectives in a file, a commit, the pull request, a ticket comment, this plan file or the retrospective. (2026-11-18, conventions file.)
- The history of this repository was rewritten on 2026-11-18 to remove private names. Never undo that work. (2026-11-18, wave instruction.)
- The repository's git config sets `user.email` to the maintainer's GitHub no-reply address. Never change it, and never commit with another address. (2026-11-18, wave instruction.)
- Before the push of phase 12, run two checks, and push only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`. Second, write the output of `git log -p origin/main..HEAD`, followed by the drafted pull request title and body, into a temporary file outside the repository. Then run `python3 scripts/private_names.py check <that file>` from the repository root. It must exit with code 0. It never prints a name, and you must never print the private list yourself. (2026-11-18, wave instruction.)
- Before the push, bring the branch up to date with `origin/main`. Tickets #9 and #11 may have merged first. Resolve every conflict in `cstack/src/cli.ts`, `cstack/package.json` and `README.md` by keeping both changes. (2026-11-18, wave instruction.)
- GitHub is sometimes short of macOS runners. When the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say in the report if it still did not run. (2026-11-18, wave instruction.)
- Never merge the pull request. The maintainer merges it. (2026-11-18, wave instruction.)

## Architecture

The change is small and the approach is locked by the ticket. One runner hides the external commands, so tests replace it with a fake. One list in `requirements.ts` describes each item and how to check it, and the Orca checks sit in their own file because they have three parts. The command reads each item in order through an input object that holds the runner, the running Node version, the minimum from `engines.node` and the PATH lookup. The real command builds that object, and tests pass their own.

## Implementation units

### Unit 1: The command runner — status: done (8c00739)
- Failing test: `cstack/test/doctor-runner.test.ts`, which uses the real runner with short time limits. `echo hello` gives ok with the stdout `hello\n`. `sh -c "exit 3"` gives failed with exit code 3. A command name that does not exist gives missing. `sh -c "sleep 5"` with a 200 ms limit gives timeout and returns in under 2 seconds. `sh -c "sleep 5 & wait"` with a 200 ms limit also gives timeout in under 2 seconds. The tests fail first, because `runner.ts` does not exist.
- Minimum code: `cstack/src/doctor/runner.ts` exports the `Runner` type, the `RunResult` type with its four kinds (ok with stdout, failed with exit code, missing, timeout), and a function that builds the real runner from a time limit in milliseconds. It uses `execFile` with `timeout` and no shell. It also exports the PATH lookup function used for git: it takes a command name and the PATH string, and returns the first folder entry that exists and can be run, or nothing. Add one test of the PATH lookup with a temporary folder that holds an executable file.
- Refactor: none expected.
- Commit message: `feat(cli): add the command runner that cstack doctor uses`
- Depends on: none

### Unit 2: The requirements list and the doctor command — status: done (b391c70)
- Failing test: `cstack/test/doctor.test.ts`. Write first the case "every item is present", with a fake runner that answers from the fixtures and records each call. It fails, because the command does not exist yet. Then add the cases of the ticket acceptance that do not involve Orca. When Graphify is missing, doctor prints `uv tool install graphifyy` and exits with code 0. When git is missing, it prints how to install git and exits with code 1. When neither `gh` nor `glab` is present, it exits with code 1. A Node version below `engines.node` is reported as too old and exits with code 1. A command that never answers, such as `claude --version`, is reported after the time limit, and doctor still checks the items after it. When `xcode-select -p` fails and the first git on the PATH is `/usr/bin/git`, git is missing and `git --version` is never run. When `xcode-select -p` fails and git is elsewhere, `git --version` runs. The comparison function reads the real `cstack/package.json` and accepts its `engines.node` form. Add one test in `cstack/test/cli.test.ts`: `run(["doctor", "--nope"])` returns 2 and prints the usage. In this unit the Orca item can be a stub that the fake runner reports as missing, so that the tests run.
- Minimum code: record the real outputs of `sw_vers -productVersion`, `xcode-select -p`, `git --version`, `gh --version`, `glab --version` and `claude --version` into `cstack/test/fixtures/doctor/`, and add `graphify --version` as `graphify 0.9.112`. Write `cstack/src/doctor/requirements.ts` with the seven items and their install hints, the Node comparison, and `cstack/src/commands/doctor.ts`. Register `doctor` in `cstack/src/cli.ts` with one `if` line and one usage line.
- Refactor: keep the version parsing of the simple items as data in the list (command, arguments and a pattern), not as one function per item.
- Commit message: `feat(cli): add cstack doctor, which checks what cstack needs on the machine`
- Depends on: 1

### Unit 3: The Orca item — status: done (614c8e7)
- Failing test: in `cstack/test/doctor.test.ts`, write first the case "Orca is running and connected to Jira and Linear". It fails while the Orca item is a stub. Then add the other cases. When the `orca` command is missing, doctor says that Orca is not installed and exits with code 0. When Orca is installed but not running, doctor prints its version, says that the trackers were not checked, and never runs the Jira or Linear command. An empty connection list adds no tracker. A Linear answer with no team and a workspace error prints "Linear (connection error)". An answer that is not valid JSON adds no tracker. Negative: the fake runner records every command that doctor runs, and every recorded call is in the list of allowed commands of "Decisions". The list never holds `orca open`, `orca serve` or an install command. Negative: a recorded Orca answer that holds a site name, an email, a team name and a workspace name, and a fake stderr that holds a workspace name, give an output that holds none of them.
- Minimum code: record the real answers of `orca --version`, `orca status --json`, `orca jira connection --json` and `orca linear team list --workspace all --json`, and neutralize them as "Decisions" says. Build the connected, error and closed answers as "Decisions" says. Write `cstack/src/doctor/orca.ts`, and replace the stub in `requirements.ts` with it.
- Refactor: none expected.
- Commit message: `feat(cli): report Orca and the trackers it is connected to in cstack doctor`
- Depends on: 2

### Unit 4: The Requirements section of the README — status: done (b7205ec)
- Failing test: `cstack/test/readme-requirements.test.ts`. It reads `README.md` at the repository root and takes the bold names of the bullets under `## Requirements`, up to the next `## ` heading. It compares them, in order, with the names in `requirements.ts`. It fails today, because the section does not exist. Add a second case on a small sample text that has one extra bullet, to show that an item added to only one list fails the comparison.
- Minimum code: add the `## Requirements` section to `README.md`, as "Decisions" says. Follow the documentation writing rules of this repository: one idea per sentence, every sentence with a subject and a verb, and short sentences.
- Refactor: none expected.
- Commit message: `docs: add the Requirements section of the README, checked against cstack doctor`
- Depends on: 3

There is no security surface beyond what the units already cover: doctor has no endpoint, no database and no credentials. Its only input from outside is the output of local commands, and the privacy tests of unit 3 cover it. There is no user interface, so no design specification applies.

## Documentation duties

- The README "Requirements" section: applies, written to `README.md` in unit 4.
- The usage text of `cstack`: applies, written to `cstack/src/cli.ts` in unit 2.
- A comment on this ticket (#10) that says what was built and where: applies, written to the GitHub issue.
- A comment on ticket #24, which adds the Orca version check: applies. It says where the Orca item lives (`cstack/src/doctor/orca.ts`), how the fixtures are built, and that the minimum version must come from one place.
- An architecture decision record: does not apply. This ticket takes no structural decision beyond ADR-SIC-H.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. Nothing in US-3 or in its open questions changes.

## Review log

### Impact notes

Graphify is not installed, so the impact was checked by reading. The only existing symbol the branch changed is `run` in `cstack/src/cli.ts`. Its callers are `cstack/src/bin.ts` and `cstack/test/cli.test.ts`, and the new `doctor` branch sits before the "unknown command" check, so those paths are unchanged. The usage text lost the line "No command exists yet." No test checked that text. `README.md` gained a section and the usual companions of `cli.ts` (`bin.ts`, `package.json`) need no change. No `WHY:` or `DECISION:` comment exists in the changed files.

### Findings of the four reviewers (phase 7)

Conventions, correctness and security: no finding. Correctness noted that a command that ignores the polite stop signal would block doctor, so the runner now uses SIGKILL (commit 4227f03, with a test). Simplicity proposed removing the "Linear (connection error)" branch and simplifying the Node comparison. Both are recorded user decisions, so they stay. Follow-ups, not done: share the "did not answer" and "failed with exit code" sentences between `orca.ts` and `requirements.ts`; let each check close over its own install hint.

### Independent review (phase 8)

It changed one test (commit d446703) so that the "every item is present" case also checks the Orca version line. Judgment calls for the pull request: the privacy test cannot include a fake stderr because the runner result has no stderr field, which is safe by construction; `cli.ts` refuses arguments after `doctor` instead of `doctor.ts` parsing its own options, to keep the shared file change small; the output buffer limit of 1 MB would be reported as a timeout, which is unlikely for these commands. The recorded Orca version is 1.4.262, not 1.4.259.

### Phase 9

origin/main did not move since the branch was created, so no rebase was needed. Tests, typecheck and build pass. No formatter or linter is configured.

## Briefing

### What you should know about what was built

`cstack doctor` is built, and it does what the ticket asked. It checks the seven items in the same order as the new README section. It prints one line for each, with the version or the install command, and exits with code 1 only when a required item needs attention. The 38 tests pass, and a real run on this machine took about one second and exited with code 0.

**What you need to do.**

- Merge the pull request yourself once the `cstack` check is green. If the ticket that adds the release (#9) or the one that adds `cstack measure` (#11) merges first, the usage text in `cstack/src/cli.ts` will conflict, because all three replace the line "No command exists yet." Keep a single "Commands:" list that holds every command. In the README, keep "Requirements" above "Install cstack".

**What to watch.**

- The Orca check relies on three fields of Orca's JSON answers. If a new Orca version renames one, doctor will quietly say "installed but not running" or "Trackers: none". The tests will not notice, because they use recorded answers. Run `cstack doctor` by hand after an Orca update. The ticket that checks the Orca version (#24) is the right place to guard this.
- The rule that avoids running `/usr/bin/git` on a Mac without the developer tools was tested only with a fake. The first teammate on a fresh Mac is the real test: they should see "git: missing" and no system window.
- On a timeout, doctor stops the command but not the programs it started. `orca` and `claude` are wrapper scripts, so their real process can keep running for a short while. It is harmless.

**What changed since the plan.**

- On a timeout, doctor now stops the command with SIGKILL, the signal a program cannot ignore, so a stubborn command can no longer block it.
- `cstack/src/cli.ts` refuses any argument after `doctor`, instead of `doctor.ts` reading its own options. This keeps the change to that shared file at two lines.
- The runner never keeps the stderr of a command at all, so doctor cannot print it. The planned test with a fake stderr was dropped, because there is nothing left to test.

#### Details

**What was built and how I know it works.** The branch adds `cstack/src/doctor/runner.ts`, `cstack/src/doctor/requirements.ts`, `cstack/src/doctor/orca.ts` and `cstack/src/commands/doctor.ts`, registers `doctor` in `cstack/src/cli.ts`, and adds the `## Requirements` section to `README.md`. I ran `npm test` in `cstack/` on 2026-11-18: 4 test files and 38 tests pass. I built the package and ran `node dist/bin.js doctor` on this machine. It printed 8 lines (seven items and the summary), exited with code 0 and took about one second. I did not copy that output anywhere, as the plan requires. `origin/main` has not moved since the branch was created, and neither #9 nor #11 has merged yet.

**Merging after #9 or #11.** All three tickets of the wave replace the line "No command exists yet." in the `USAGE` constant of `cstack/src/cli.ts` (lines 5 to 14 on this branch). This branch replaced it with a `Commands:` header and one line for `doctor`. A careless "keep both" resolution can leave two `Commands:` headers, or bring the old sentence back. No test checks the usage text, so CI would not catch it. In `README.md`, #9 adds "Install cstack". The README test reads the bold bullets under `## Requirements` until the next `## ` heading, so a new `##` section after it is safe. A `###` subsection with bold bullets inside "Requirements" would break the test, which is the intended behaviour. The plan already says to keep both changes and to put "Requirements" first. The maintainer merges, so the maintainer may be the one who resolves the conflict if this pull request is not the first to merge.

**Orca answers can drift.** `cstack/src/doctor/orca.ts` reads `result.runtime.reachable` from `orca status --json`, `result.sites` from `orca jira connection --json`, and `result.teams` and `result.meta.workspaceErrors` from `orca linear team list --workspace all --json`. Every unusual answer, such as an answer that is not JSON, has `ok` false, or lacks a field, falls back to "not running" or to no tracker. That fallback is correct for privacy and for the exit code, because Orca is optional. The cost is that a format change in Orca looks like a normal state and not like an error. The fixtures were recorded with Orca 1.4.262, while the plan was written with 1.4.259, so Orca already moved during this ticket. The specification accepts this risk (open question 1). By default nobody notices until a teammate wonders why their trackers are missing. The ticket that checks the Orca version (#24) can pin the version that the fixtures come from. The comment planned on #24 should say so.

**The git rule on a fresh Mac.** `requirements.ts` runs `xcode-select -p` and, when it fails and the first `git` on the PATH is `/usr/bin/git`, reports git as missing without running it. The fake runner covers both branches. No real machine without the developer tools was available. `xcode-select -p` itself does not open any window when the tools are missing; it only exits with a non-zero code. The open risk is a PATH where `/usr/bin/git` is reached through another folder, for example a symbolic link. In that case doctor would run the Apple shim and the system window would appear. This is unlikely, and the window only offers an install, which the user can refuse.

**Processes left behind on a timeout.** `createRunner` uses `execFile` with `timeout` and `killSignal: "SIGKILL"` (commit 4227f03, with a test of a command that ignores SIGTERM). Node sends the signal only to the direct child. `orca` is a bash script that starts Orca's Electron binary, and `claude` is a zsh wrapper on this machine, so a killed wrapper can leave its real process running until that process ends on its own. The plan accepted this (question 4 and the decision on process groups). Killing the process group would need `detached: true`, which also stops Ctrl+C from reaching the child, so I would still not do it. In the worst case, where every command hangs, a doctor run takes 11 times 5 seconds, which is 55 seconds.

**Options parsed in `cli.ts`.** The comment on #7 said that each command parses its own options. On this branch, `run` in `cli.ts` refuses any argument after `doctor` with exit code 2, and `doctor(io)` takes no arguments. ADR-SIC-H does not require one form or the other. The choice keeps the shared file change at two lines, which matters while #9 and #11 edit the same function. The day `doctor` gains an option, such as `--json`, the check has to move into `doctor.ts`.

**Stderr and the privacy test.** `RunResult` has no stderr field, and the runner ignores the stderr that `execFile` gives. Doctor therefore cannot print a workspace name that Orca writes on stderr. The plan asked for a negative test with a fake stderr. The independent review dropped it, because the fake runner cannot return a stderr. The negative test on a recorded answer that holds a site name, an email, a team name and a workspace name is in place and passes.

**A buffer limit reported as a timeout.** `execFile` stops a command whose output passes 1 MB and sets `killed`, so the runner reports it as a timeout. None of the eleven commands prints anything close to that, so this is a wording issue only. A non-numeric error code other than `ENOENT`, such as `EACCES` for a file on the PATH that cannot run, is reported as "failed with exit code 1". This is also only a wording issue.

**How the earlier questions were resolved.** Question 1 (how Orca and its trackers are detected) is built as answered, in `orca.ts`. Question 2 (connected Orca answers) is built from the real empty answers with placeholders, in `cstack/test/fixtures/doctor/orca-*.json`. Question 3 (Graphify version flag) is built as `graphify --version` with the fixture `graphify 0.9.112`. Question 4 (time limit with a grandchild) is built and tested in `cstack/test/doctor-runner.test.ts`, now with SIGKILL. Question 5 (a required item that times out counts as a problem) is built and tested. Questions 6, 7, 9, 10 and 11 are built as drafted. Question 12 (`--json`) stays open, and it is already in "Open questions after the build" as non-blocking. Question 13 (Orca installed but closed) is built: doctor skips the Jira and Linear commands, and a test checks that they never run. Question 14 (the `/usr/bin/git` shim) is built, tested only with a fake. Question 15 (Linear connection error) is built as "Linear (connection error)".

**New questions.** I found no new question. The open `--json` question stays as it is.

I checked security and authorization, data model lock-in, scale, failure modes, user-facing edge cases, operations and cost, reversibility and hidden coupling. Beyond the points above, I found nothing in security, data model lock-in, scale, operations and cost, or reversibility, because doctor only reads, stores nothing, holds no credentials and adds no dependency.

## Open questions after the build

### Blocking

none

### Non-blocking

- Carried from the question round, for the maintainer: "Should `cstack doctor` offer a machine-readable output, such as `--json`, so that a skill can read its result? This pull request does not add one, because nothing reads it yet."

## Pull request

Title: `feat(cli): add cstack doctor, which checks what cstack needs on the machine`

Body:

This adds `cstack doctor`, a command that checks the machine for the programs that `cstack` and the skills need. It prints one line per item with its version, or the command that installs it when it is missing. It exits with code 1 only when a required item needs attention. The README has a new "Requirements" section with the same items, and a test fails when the two lists differ.

The items are macOS, Node, git, Graphify, a forge client (`gh` or `glab`), Claude Code and Orca. Graphify and Orca are optional. For Orca, doctor also lists the trackers it is connected to, and prints only the names Jira and Linear. Doctor only reads: it never installs anything, never starts Orca, and never prints a site, workspace, team, account or email.

Key decisions. Every outside command goes through one runner with a 5 second limit, which tests replace with a fake. The minimum Node version is read from `engines.node` at run time, and the README says "the current long-term support release" in words. On a Mac without the developer tools, doctor never runs `/usr/bin/git`, because that file opens a system install window. Doctor does not judge the Orca version, because ticket #24 sets the minimum.

Files: `cstack/src/commands/doctor.ts`, `cstack/src/doctor/` (`runner.ts`, `requirements.ts`, `orca.ts`), a small change in `cstack/src/cli.ts`, new tests and recorded answers in `cstack/test/`, and `README.md`. If #9 or #11 merges first, keep both changes in `cli.ts` and in the README, with one "Commands:" list and "Requirements" above "Install cstack".

Judgment calls from the independent review. The runner drops stderr, so the planned privacy test with a fake stderr was not written. `cli.ts` refuses any argument after `doctor`, to keep the shared file change small. The recorded Orca version is 1.4.262. Follow-ups not done: share two error sentences between `orca.ts` and `requirements.ts`, and let each check hold its own install hint.

Plan file: `docs/plans/2026-11-18-10-check-the-machine-with-cstack-doctor.md`.

### Open questions, not needed for this pull request

This pull request can be merged without these answers. For the maintainer: should `cstack doctor` offer a machine-readable output, such as `--json`, so that a skill can read its result? This pull request does not add one, because nothing reads it yet.

Fixes #10

## Documentation

- Comment on ticket #10: https://github.com/gambitl/claude-code-stack/issues/10#issuecomment-6973129971
- Comment on ticket #24: https://github.com/gambitl/claude-code-stack/issues/24#issuecomment-6973130356
- README "Requirements" section and the usage text of `cstack`: committed on the branch.
- No ADR: no structural decision beyond ADR-SIC-H.

## Executor notes

- Graphify is not installed, so impact notes came from reading the code.
- Unit implementers wrote code before tests in units 1 to 4, so no test was seen failing first.
- The plan expected Orca 1.4.259, the recorded version is 1.4.262.
- The planned stderr privacy test could not be written: the runner result has no stderr field.
- Correctness review found a command that ignores SIGTERM could block doctor, fixed with SIGKILL (4227f03).
- The independent review changed one test to check the Orca line (d446703).
- GitHub has no in-progress state for the ticket, so none was set.

## Hand-off log

2026-11-18: phases 6 to 10 finished. Four units done, reviews done, ticket and #24 commented, pull request drafted. Nothing pushed.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

I need no answer from you before I plan. Every point below has a safe default.

**I will do this unless you say no.**

- For the tests where Orca is connected to Jira or Linear, I start from the real empty answers of this machine. I add one Jira site or one Linear team with exactly the fields that Orca's code writes, filled with neutral values. You do not need to connect anything in Orca.
- When Orca is installed but closed, doctor says so in those words and skips the Jira and Linear commands. Those two commands talk to the running app, so with the app closed they can only fail.
- Before `git --version`, doctor runs `xcode-select -p`. On a Mac without the developer tools, `/usr/bin/git` opens a window that offers to install them, and doctor must only read. I could not test it here, because the tools are installed.
- When the Linear team list is empty but Orca reports workspace errors, doctor prints "Linear: connection error" with no name, instead of "not connected".
- A required command that runs past the time limit counts as missing, so doctor exits with code 1. Doctor prints only the version it parsed and the words "Jira" and "Linear", never raw output or stderr.
- I keep the other choices of the draft: 5 seconds per command, one after another, only the `>=` form of `engines.node`, the install hints listed, one line per item, "Requirements" right after the introduction, and no `--json` for now.

**I checked it myself.**

- `orca status --json` answers even when the app is closed, with `reachable` set to false. Jira counts with at least one site, and Linear with at least one team.
- Only `orca open` starts the app. The `status`, `jira connection` and `linear team list` commands never start it.
- `graphify --version` prints `graphify <version>` and changes nothing.
- The `execFile` time limit holds even when the command started another process.
- The three Orca answers of this machine hold no path, no email and no user name.

**Good to know.**

- Doctor exits with code 1 when something is missing, and the shared command rules (ADR-SIC-H) also use 1 for a crash. Only the output tells them apart.
- Doctor looks for commands on the PATH, not in shell aliases. A `claude` defined by an alias, or a Graphify that `uv` put in `~/.local/bin` outside the PATH, shows as missing.
- Doctor says that `gh` or `glab` is present, not that it is logged in.

#### Details

**Connected Orca answers for the tests (draft question 2).** This question is blocking, because it decides what the fixtures hold. It has a safe default, so I moved it out of the questions for the developer. Orca on this machine has no Jira connection and no Linear team, so the only real answers hold empty lists. The default is to record the real empty answers and to build each connected answer by adding one site or one team with the fields that Orca's code writes. A Jira site gets `id`, `siteUrl`, `email`, `displayName`, `accountId` and `authType`. A Linear team gets `key`, `name` and `workspace.name`. Every value is a neutral placeholder, such as `example.atlassian.net` and `person@example.com`. The rejected option is to ask the maintainer to connect Jira or Linear in Orca for a moment. It gives a truer shape, but it puts private names on disk that must then be cleaned by hand before a commit to a public repository, and it adds a step that only a person can do. If nobody objects, the built answers are used. A later Orca version could add a field, and the tests would not see it. The specification already accepts that risk (open question 1).

**Orca installed but closed.** The draft did not cover this case. It is blocking, because it changes what doctor runs and prints. I answered it by reading Orca's code. In the Orca command-line code installed here, `out/cli/jira/jira.js` (lines 27 to 34) sends `jira connection` as the `jira.status` call to the running app, and `out/cli/linear/linear.js` (lines 44 to 52) sends `linear team list` as `linear.agentTeamList`. `out/cli/runtime/client.js` (lines 57 to 146) sends a call over the local transport and throws when the answer has `ok: false`. That code never starts the app. With the app closed, these two commands can only fail. So doctor runs them only when `orca status --json` says `runtime.reachable` is true. When the `orca` command exists but the app does not answer, doctor prints that Orca is installed but not running, and that the trackers were not checked. When the command is missing, it prints that Orca is not installed. A test covers each case. The default without this rule would be two failed commands and a confusing tracker line on every machine where Orca is closed.

**Only `orca open` starts Orca.** Checked by reading `out/cli/runtime/commands/cli-lifecycle-handlers.js` (around line 72), where the `open` handler is the caller of `client.openOrca()`, and `out/cli/runtime/launch.js`, which holds the launch code. A search for `launchOrcaApp` and `openOrca` finds them only in the launch files, the client and the lifecycle handlers. So the three commands that doctor runs cannot start the app, which keeps scope item 8 true. The negative test of the ticket already refuses `orca open` and `orca serve` in the list of commands run.

**The git shim on a Mac without developer tools.** The draft did not cover this case. It is blocking, because the ticket says that doctor never installs anything and runs only version commands. On macOS, `/usr/bin/git` is a small Apple program that forwards to the developer tools. When the Command Line Tools are not installed, running it prints an `xcrun` error and opens a system window that offers to install them. That is the very situation doctor exists for: a new teammate on a fresh Mac. I could not test it here, because the developer tools are installed (`xcode-select -p` exits with code 0) and Homebrew's git comes first on the PATH. The recommendation is to run `xcode-select -p` first. When it fails and the git found on the PATH is `/usr/bin/git`, doctor reports git as missing with the hint `xcode-select --install`, and it does not run git. A git from Homebrew or elsewhere is run as usual. The fake runner covers both cases.

**Linear errors that look like "not connected".** The draft did not cover this case. It is non-blocking, but it changes one line of output, so I state the default. The answer of `orca linear team list --workspace all --json` has `meta.partial` and `meta.workspaceErrors`, which shows that Orca asks each connected Linear workspace. I did not read the app side, so I cannot say whether it uses a cache or calls Linear each time. With an expired token, the team list can be empty while a connection exists. By default, at least one team gives "Linear". No team and at least one workspace error give "Linear: connection error". No team and no error give nothing. No workspace name is ever printed, which matches draft question 8. A call to Linear can also be slow, so the 5-second limit matters most here.

**Time limit on a required item, and what doctor prints (draft questions 5 and 8).** Both questions are blocking, both have an obvious default, and I keep them as drafted. A required item whose command does not answer in time counts as a problem, so the exit code is 1. Doctor prints only parsed versions, the tracker names and fixed sentences. It never prints raw output, stderr, a path, or the `credentialError` field of the Jira answer.

**Other draft defaults (draft questions 6, 7, 9, 10, 11 and 12).** These questions are non-blocking, and I keep their drafted answers. Each command gets 5 seconds, and the commands run one after another. Doctor reads only the `>=<major>[.<minor>[.<patch>]]` form of `engines.node`, and a test fails on another form. The install hints are those of question 9. The output has one line per item and a summary line. The "Requirements" section goes right after the two introduction paragraphs of the README. This ticket adds no `--json` output.

**Checked answers (draft questions 1, 3 and 4).** I relied on them after checking the evidence. For question 1, the status code at `status.js` lines 16 to 36 and the field shapes in "Code mapping" match the three tests proposed. For question 3, the `graphifyy` 0.9.112 source read from PyPI prints `graphify <version>` and skips the skill refresh. For question 4, the `execFile` test with a grandchild holding the pipe returned after 307 ms for a 300 ms limit. One side effect remains: on a timeout, Node kills only the direct child. For `orca`, a bash script, the Electron process that the script started can outlive doctor for a short time. Killing the whole process group would need `detached: true`, which also stops Ctrl+C from reaching the child. I would not do it in this ticket.

**Privacy of the recorded Orca answers.** Checked on this machine. A script walked the three JSON answers and listed every field whose value holds a `/`, an `@` or the login name. It found none, and only the field names were printed. `_meta` holds only `runtimeId`. Scope item 9 still applies: the answers built for the connected cases use placeholders only.

**Exit code 1 for both "missing" and "crash".** ADR-SIC-H is accepted and the ticket sets exit code 1 for a missing required item, so I do not reopen either. A crash in doctor also gives 1, through `bin.ts`. A caller that reads only the exit code cannot tell the two apart, but the summary line on stdout can. A later ticket that reads doctor from a skill should match the summary line or ask for a distinct code.

**PATH and aliases.** Node's `execFile` looks up the PATH and does not see shell aliases or functions. Older local installs of Claude Code were reached through an alias to `~/.claude/local/claude`. `uv tool install` puts Graphify in `~/.local/bin`, and `uv` warns when that folder is not on the PATH. In both cases doctor reports the item as missing while the shell may find it. This is acceptable, because the skills and `cstack` will look up the PATH the same way. The Graphify hint can add `uv tool update-shell` at no cost.

**Forge client logged in or not.** US-3 asks for presence and version only, so doctor does not run `gh auth status` or `glab auth status`. Both call the network and would widen the scope. A teammate whose client is not logged in passes doctor and fails later at the first tracker or forge call. A later ticket can add the check.

I checked security and authorization, data model lock-in, scale, failure modes, user-facing edge cases, operations and cost, reversibility and hidden coupling. Beyond the points above, I found nothing in data model lock-in, scale, operations and cost, or reversibility, because doctor stores nothing, adds no dependency and only reads.

### Open questions and answers

1. **How does doctor decide that Orca answers, and that Jira or Linear counts as connected?** Blocking. I checked it by reading Orca's command-line code, version 1.4.259 (see "Code mapping"). Orca answers when `orca status --json` exits with code 0 and its `result.runtime.reachable` is true. When the app is closed, the command still answers, with `reachable` set to false. Jira counts when `result.sites` of `orca jira connection --json` holds at least one site, which is also what sets `connected`. Linear counts when `result.teams` of `orca linear team list --workspace all --json` holds at least one team. Recommended: use these three tests.

2. **This machine's Orca has no Jira connection and no Linear team, so the real answers hold empty lists. Where do the recorded answers with a connection come from?** Blocking, and no test can answer it. It is a question for the user. Recommended: record the real empty answers of this machine. Then build each connected answer from the real empty one, by adding one site or one team with exactly the fields that Orca's code writes, filled with neutral placeholders. The other way is that the maintainer connects Jira or Linear in Orca for a moment, so that a real connected answer can be recorded and then neutralized.

3. **Which flag gives the Graphify version, and is it safe to run?** Blocking. I checked it by reading `graphifyy` 0.9.112 from PyPI without running it. `graphify --version` prints `graphify <version>` on stdout. It skips the refresh of installed skill copies, so it changes nothing on the machine. Its warnings go to stderr. Recommended: run `graphify --version` and read the version from the line that starts with `graphify `. Graphify is not installed here, so its recorded answer is the line that its code prints.

4. **Does the time limit still work when the command started another process?** Blocking, because the acceptance criteria ask for a report after the time limit. I checked it with Node 26.10. `execFile` with a 300 ms limit returned after 307 ms, even with a grandchild that kept the output pipe open. Recommended: use `execFile` with its `timeout` option, and add one test of the real runner on a command that sleeps.

5. **When a required item's command does not answer in time, does doctor exit with code 1?** Blocking, because it changes the exit code. It has an obvious default. Recommended: yes. Doctor cannot confirm that the item works, so it counts as a problem.

6. **How long is the time limit, and do the commands run one after another?** Non-blocking. Recommended: 5 seconds for each command, run one after another. Each `orca` call took about 0.3 seconds here, and a full run takes about two seconds on a healthy machine.

7. **How does doctor compare the Node version with `engines.node` without a new dependency?** Non-blocking. Recommended: understand only the form `>=<major>[.<minor>[.<patch>]]`, which is what `engines.node` holds today. A test reads the real `cstack/package.json` and fails when someone writes another form there. This keeps `cstack/package.json` unchanged, which ticket #9 also edits.

8. **What may doctor print from a command's answer?** Blocking, because of the privacy rule of the ticket. Recommended: doctor prints only the version it parsed, the tracker names "Jira" and "Linear", and fixed sentences. It never prints the raw output or the stderr of a command, and never a path. Orca's stderr can name a Linear workspace, and a path can name a work folder.

9. **What does doctor say to install each missing item?** Non-blocking. Recommended: macOS says that `cstack` runs only on macOS. Node says to install the current long-term support release from nodejs.org. Git says `xcode-select --install`. Graphify says `uv tool install graphifyy`, and adds that this needs `uv` (`brew install uv`). The forge client says `brew install gh` or `brew install glab`. Claude Code says `curl -fsSL https://claude.ai/install.sh | bash`. Orca says to download it from https://github.com/stablyai/orca/releases, the source named in Orca's own update file.

10. **What does the output look like?** Non-blocking. Recommended: one line for each item, in the order of the list, with its name, its state and its version or its install hint. Optional items say "optional". A last line says either that every required item is present, or how many are missing.

11. **Where does the "Requirements" section go in the README?** Non-blocking. Recommended: right after the two introduction paragraphs, before "How to update the copy of my configuration". A reader needs the requirements before anything else, and this spot is away from line 35, which ticket #9 replaces.

12. **Should doctor also offer a machine-readable output, such as `--json`, for skills to read later?** Non-blocking. Recommended: no, not in this ticket. Nothing reads it yet, and a later ticket can add it when a skill needs it.

13. **What does doctor do when Orca is installed but closed?** Blocking, added by the advisor. I checked it by reading Orca's code: the Jira and Linear commands talk to the running app and never start it. Recommended: say that Orca is installed but not running, and skip the Jira and Linear commands.

14. **What does doctor do with `/usr/bin/git` on a Mac without the developer tools?** Blocking, added by the advisor. No test could run here, because the developer tools are installed. Recommended: run `xcode-select -p` first, and report git as missing without running it when that fails and the first git on the PATH is `/usr/bin/git`.

15. **What does doctor print when the Linear team list is empty but Orca reports workspace errors?** Non-blocking, added by the advisor. Recommended: print "Linear (connection error)" with no name.

**Answers.** On 2026-11-18 the user read the short version of "Questions you may not be asking" and answered "ok top go". No item was challenged, so every recommendation above is accepted, by default for the items under "I will do this unless you say no". Questions 1, 3 and 4 keep their tested answers. Question 2 is answered by building the connected answers from the real empty ones. Question 12 stays open, not needed for this ticket. Each answer is written as a rule in "Decisions".

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. No new decision since phase 4.
