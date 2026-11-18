# Plan: #9 — M1-3: Release cstack on GitHub and install its skills in one step

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/9
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in docs/projects/), ADRs in docs/decisions/
Branch: gambitl/cstack-release-skills
Conversation language: French
Status: approved

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

<!-- PRIVACY RULE FOR THIS FILE. This repository is public. No name of the maintainer's private list (employer, clients, work projects, work host names, work ticket prefixes, the work email address) may ever be written in this file, in a commit, in the pull request or in a ticket comment. Refer to such a name only as "a name of the private list" or by its place in a file. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Let any teammate install `cstack` and its skills with one command, update both together, and go back to the previous version just as easily.

- **What the title means**: `cstack` is the command-line tool that this project builds. A release is a numbered version of `cstack` that GitHub publishes with a packaged file attached. `npm` can install that file. It is the installer that comes with Node, the program that runs `cstack`. A skill is a folder of instructions that Claude Code loads from `~/.claude/skills/`. "In one step" means that a version of `cstack` always brings the skills written for that exact version.
- **Why we are doing it**: Suppose a skill tells Claude to run a `cstack` command that the installed `cstack` does not have. The run then breaks halfway. Shipping the skills inside `cstack` keeps the two at the same version. The install must also never destroy a skill folder that someone wrote by hand.
- **For the user**: A solution engineer installs or updates everything with one install command and one `cstack skills install`. They go back to the previous version the same way. Their own skills stay untouched unless they ask otherwise.

**Goal.** This ticket publishes each `cstack` version as a GitHub release and adds `cstack skills install` and `cstack guide <phase>`, for US-2. Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #7 creates the package, its entry point and the CI workflow.
* **Backup folder**: `pull-skills.sh` (lines 17 to 20): Backups live in `~/.claude/skill-backups`, outside `~/.claude/skills`. The comment explains that Claude Code would otherwise load the backups as skills. Use the same folder.
* **How skills are replaced today**: `pull-skills.sh` (lines 85 to 94): The script moves each old skill folder into `~/.claude/skill-backups/<date-time>/<name>`, then copies the new one. Line 87 builds the date-time with `date +%Y-%m-%d-%H%M%S`. Use the same format. Lines 66 to 73 leave alone every local skill that the repository does not hold.
* **A marker file already exists for another tool**: `sync.sh` (line 52): Folders that carry the file `.superset-managed` belong to the Superset app, so the script skips them. The marker `.cstack-managed` follows the same idea.
* **How Claude Code loads agent prompts**: `skills/resolve-issue/.claude-plugin/plugin.json` (line 2): The skill folder declares a plugin named `resolve-issue`. Claude Code therefore loads the prompts in its `agents/` folder as agents named `resolve-issue:<name>`. Copying the whole folder, hidden folders included, is enough to install the agent prompts.
* **The pattern cstack copies**: `docs/projects/skills-into-cli.md` (line 294): Orca, a desktop app that runs several coding agents side by side, ships its skills through its own command-line tool. It uses `orca skills install` and `orca skills get`. The installed skill is a short entry point, and the full guide comes from the tool at its own version. `orca --help` lists both commands on the maintainer's machine.
* **The story**: `docs/projects/skills-into-cli.md` (lines 67 to 75): US-2 lists the acceptance criteria, and this ticket carries all of them. Line 320 describes ADR-SIC-C and its three options.

## Scope

1. Ship one example skill and one example guide, and nothing else. The real `resolve-issue` skill and its phase guides arrive in #21 and #22. Put the example skill in `cstack/skills/cstack-example/`, with a `SKILL.md`, a `.claude-plugin/plugin.json` and one prompt in `agents/`. Its description says that it only checks the install and must never be used for a task. Put the example guide in `cstack/guides/cstack-example/hello.md`.
2. In `cstack/package.json`, list `dist`, `skills` and `guides` under `files`, so that the packaged file holds them, hidden files included. Add a `prepack` script that runs the build.
3. Add `cstack skills install`. For each folder `skills/<name>/` of the installed package, it copies the folder to `~/.claude/skills/<name>/`. Then it writes the marker file `.cstack-managed` into that folder. The marker holds the `cstack` version. The command always reads the skills from the installed package, never from a clone of this repository.
4. Replace only folders that carry the marker. When `~/.claude/skills/<name>/` exists without the marker, skip it. Print its name and the reason, and say that `cstack skills install --adopt <name>` can take it over. Treat a symbolic link as a folder that `cstack` did not write, and never follow it.
5. Add the option `--adopt <name>`. It accepts only a name that this version ships. It first moves the existing folder to `~/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/<name>`, then it installs the new one. It prints where the backup went. Without this option, the command never moves a folder that has no marker.
6. When a folder carries the marker but this version no longer ships it, remove it and say so. Installing an older release then also removes the skills that only the newer release had.
7. Build each skill folder first in a temporary folder on the same disk, outside `~/.claude/skills/`, then move it into place. A failure halfway then never leaves a half-written skill. Such a skill would have no marker, so a later install would skip it.
8. Print one line per skill, which says installed, replaced, skipped with its reason, or removed. Exit with code 0 when every shipped skill is in place. Exit with code 1 when at least one was skipped.
9. Add `cstack guide <phase>`. It prints `guides/<skill>/<phase>.md` from the installed package, so the guide always matches the installed version. The skill is `resolve-issue`, unless the option `--skill <name>` names another one. Both names must match `^[a-z0-9][a-z0-9-]*$`, so that a name can never reach a file outside the guides folder. An unknown phase exits with code 1 and lists the phases of that skill.
10. Both commands take the home folder as an input. Tests then use a temporary folder and never touch the real `~/.claude`.
11. Write `.github/workflows/release.yml`. It runs on tags `v*`. It first checks that the tag equals `v` followed by the version in `cstack/package.json`, and it stops when they differ. Then, in `cstack/`, it runs `npm ci`, `npm test` and `npm pack`. Last, it creates a GitHub release for the tag with `cstack-<version>.tgz` attached. It needs the `contents: write` permission.
12. Add an "Install cstack" section to the README. You install with `npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/cstack-<version>.tgz`, then you run `cstack skills install`. To go back, you install the previous release the same way and run `cstack skills install` again. Explain `--adopt` and the backup folder.
13. Write ADR-SIC-C in `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`. Compare the three options of the specification. In the first, `cstack` ships and serves the skills itself. In the second, a Claude Code plugin marketplace ships them, and people install `cstack` separately. In the third, Orca's skill sharing link ships them. Record the choice of the first option, because the skill and the tool can then never drift apart. Record also the marker file, the option `--adopt` and the name `resolve-issue`. Link the ADR from the ADR-SIC-C line of section 9 of the specification.
14. Do not run `cstack skills install --adopt resolve-issue` on the maintainer's machine. Today's prose `resolve-issue` lives there without a marker, and the baseline runs of #12 need it unchanged. #23 installs the new one.

## Acceptance (TDD)

* `cstack/test/skills-install.test.ts`: Write first the case "install into an empty home". It fails, because the command does not exist yet. Then every shipped folder exists under `<home>/.claude/skills/`, with its hidden files and its `agents/` folder. Each one holds `.cstack-managed` with the version.
* Same file: a folder without the marker stays byte for byte the same. The output names it and gives the reason, and the exit code is 1.
* Same file: with `--adopt <name>`, the old folder moves to `<home>/.claude/skill-backups/<date-time>/<name>` with its content intact, and the new folder takes its place. `--adopt` with a name that this version does not ship is refused, and nothing moves.
* Same file: a symbolic link at the target is skipped, and the folder it points to is unchanged.
* Same file: the test installs from a fake package at version 1.0.0, then from a fake package at version 1.1.0 that changes one skill and adds another. Then it installs from version 1.0.0 again. The folders now match version 1.0.0 exactly, the added skill is gone, and every marker says 1.0.0. This proves AC4 of US-2.
* `cstack/test/guide.test.ts`: `cstack guide hello --skill cstack-example` prints the example guide exactly. An unknown phase exits with code 1 and lists the known phases. A phase such as `../../etc/passwd` is refused before any file is read.
* `cstack/test/pack.test.ts`: `npm pack --dry-run --json` lists `dist/cli.js`, `skills/cstack-example/.claude-plugin/plugin.json`, the example agent prompt and `guides/cstack-example/hello.md`.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* Negative: `cstack skills install` never overwrites, moves or deletes a folder that has no `.cstack-managed` marker, unless `--adopt` names it.
* After the merge, the maintainer pushes the tag `v<version>`. The release appears on GitHub with `cstack-<version>.tgz` attached. `npm install -g` with its link installs a `cstack` whose `--version` matches. After `cstack skills install`, a new Claude Code session lists the example skill and its agent.

**Size: M** · Blocked by: #7 · Feeds: #15, #21, #22

---

## CTO review — The new skill keeps the name resolve-issue, and only --adopt replaces a folder that cstack did not write (2026-11-17)

1. The skill that `cstack` installs keeps the name `resolve-issue`. People keep typing `/resolve-issue`, and the agents keep their names `resolve-issue:<name>`. The prose skill and the new skill therefore cannot live side by side on one machine. This is why #23, the ticket that installs the new skill, waits for the baseline runs of #12.
2. `cstack skills install` replaces only the folders that carry `.cstack-managed`. The option `--adopt <name>` is the only way to take over any other folder. It always moves that folder to `~/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/<name>` first. That backup folder sits outside `~/.claude/skills/`, so Claude Code never loads a backup as a skill.
3. The marker is the only proof that `cstack` owns a folder. A folder without it, or a symbolic link, counts as someone else's work, whatever its name and its content.


### Ticket comments

Comment of 2026-11-17 from the maintainer, copied verbatim:

> Ticket #7 is done, and it changes a few things you build on.
>
> The `bin` entry of `cstack/package.json` is `dist/bin.js`. The file `dist/cli.js` also exists, but it only holds the `run` function and has no shebang. The package says `"private": true`. The name `cstack` on the public npm registry belongs to an unrelated package, so no text you write may tell people to run `npm install -g cstack` or `npx cstack`. You add `files` and `prepack` to `cstack/package.json` as planned. Keep `dist` in `files`, and keep `tsconfig.build.json` with its `rootDir` set to `src`, so that `dist/bin.js` stays where `bin` expects it.

Comment of 2026-11-17 from the maintainer, copied verbatim:

> A note from ticket #8 for the ticket that ships the skills. Please mark every skill folder that `cstack` installs with an empty file named `.cstack-managed`. The inventory script now lists such a folder under "Skills installed by other tools", as installed and updated by `cstack`. The decision record `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md` names this marker.
>
> Also note that `pull-skills.sh` replaces a `resolve-issue` skill that `cstack` installed, after a backup, because it installs the frozen prose skills. The README says so.

### Decisions already taken upstream

From the epic "Skills into CLI" (#6), block "Open questions and decisions", copied verbatim:

> **Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`. Each one is written by the ticket named on its line.
>
> - ADR-SIC-A, how the helpers run, is to create. The design chose Orca workers when Orca is available and Claude Code sub-agents otherwise. Ticket #27 writes it.
> - ADR-SIC-B, where the run state lives and how its format is versioned, is to create. This choice is still open. Ticket #13 writes it.
> - ADR-SIC-C, how `cstack` ships its skills, is to create. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 writes it.
> - ADR-SIC-D, the settings file and the models of the agents, is to create. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 writes it.
> - ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
> - ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
> - ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.
>
> **Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

The epic's open questions 1 to 8 concern other tickets. Question 6, the Node version, is already settled by `engines.node` in `cstack/package.json`.

Epic comment of 2026-11-17, change from the specification that concerns this ticket: "Ticket #23 installs the new `resolve-issue` skill on the maintainer's machine. It waits for the baseline runs of #12, and the rest of milestone 2 does not."

ADRs that exist and govern this ticket:

- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. Its section "Marker file" says that a skill that `cstack` installs carries the marker file `.cstack-managed`, and that ticket #9 uses the same name.
- ADR-SIC-H, how a `cstack` command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`. `src/bin.ts` is the only file that touches the process. Each command prints through `io` and returns its exit code. A usage error returns 2, a crash gives 1. No code calls `process.exit()`. `tsconfig.build.json` keeps `rootDir` set to `src`. `cstack` reads its version at run time from `package.json`.

The specification is `docs/projects/skills-into-cli.md`: US-2 at lines 67 to 75, the Orca pattern at line 294, and ADR-SIC-C at line 320 of section 9.

## Dependencies

Dependencies: clear. The only blocker, #7 (scaffold the `cstack` command-line tool), is closed (checked through GitHub's "blocked by" relation on 2026-11-18). Tickets #10 (`cstack doctor`) and #11 (`cstack measure`) run at the same time in other worktrees. All three edit `cstack/src/cli.ts`, and #10 also edits `cstack/package.json` and `README.md`. Their branches have no commit yet (checked 2026-11-18).

## Code mapping

Graphify is not installed on this machine (`graphify` is not on the path), so the code was mapped with file reads and `git log`. The `cstack` code is small: five source files and one test file.

**Entry points and patterns.**

- `cstack/src/bin.ts` is the only file that touches the process. It calls `run(process.argv.slice(2))` and sets `process.exitCode` (ADR-SIC-H).
- `cstack/src/cli.ts` exports `run(args, io = processIo)`. Line 24 is the only place where a command name is handled today: any first argument that does not start with `-` gives `unknown command`. The decisions of ticket #7 say that the command then parses its own options. The `USAGE` constant (lines 5 to 11) says "No command exists yet." Tickets #10 and #11 change the same two places at the same time.
- `cstack/src/commands/version.ts` reads `package.json` at run time with `new URL("../../package.json", import.meta.url)`. The same relative path works from `src/commands/` under the tests and from `dist/commands/` in the installed package. A new command can find the package root the same way, with `new URL("../..", import.meta.url)`.
- `cstack/src/io.ts` defines `Io` with `stdout(text)` and `stderr(text)`.
- `cstack/test/cli.test.ts` calls `run` with an `Io` that collects the text into strings. Tests never start a process. Vitest runs the TypeScript files directly, with no configuration file.
- `cstack/package.json` has version `0.1.0`, `"private": true`, `bin` set to `dist/bin.js`, no `files` field and no `prepack` script. It has no runtime dependency.
- `.github/workflows/ci.yml` runs one job named `cstack` on `macos-latest`, with `actions/checkout@v7` (credentials not kept) and `actions/setup-node@v7` on `lts/*`. It holds no Node version number. There is no release workflow.

**Things the new code must agree with.**

- `pull-skills.sh` keeps backups in `$HOME/.claude/skill-backups` (lines 20 to 22) and names each backup folder with `date +%Y-%m-%d-%H%M%S`, which is local time (line 93). The ticket's line numbers predate ticket #8; the content is the same.
- `scripts/build_inventory.py` (lines 138 to 143) lists a skill folder as installed by `cstack` when `.cstack-managed` exists in it. It only checks that the file exists, so the content of the marker does not matter to it. `scripts/test_sync.sh` line 42 creates an empty marker for its test.
- `pull-skills.sh` lines 70 to 79 warn about every local skill folder that the frozen tag does not hold. They skip `synced`, folders with `.superset-managed` and `*-workspace` folders, but not folders with `.cstack-managed`. Once `cstack` installs `cstack-example`, the script would print "Only on this computer, left as is: cstack-example". Its comment on line 71 says that skills of other tools are not reported.
- `README.md` ends its `pull-skills.sh` section with the sentence "The install steps of `cstack` itself are documented separately, when that part of the tool ships." The "Install cstack" section replaces it.
- `docs/projects/skills-into-cli.md` line 320 holds the ADR-SIC-C line of section 9, with no link yet. The ADR-SIC-E and ADR-SIC-H lines show the format of a link.

**What the real home folder looks like.** On this machine, `~/.claude/skills/` is a real folder. It holds two symbolic links, `orca-cli` and `orchestration`, which Orca installed, a `.DS_Store` file, the `synced` folder and the prose skills without a marker. So the rule "a symbolic link is someone else's" protects real folders here. The `resolve-issue` agents of this session load from `~/.claude/skills/resolve-issue/.claude-plugin/plugin.json`: that plugin is not in `installed_plugins.json`, and the session lists the agents as `resolve-issue:<name>`. A skill folder with a `.claude-plugin/plugin.json` is therefore enough for Claude Code to load its agents.

**Tested behaviour of `npm pack` (npm 11.19.1, Node 26.10.0).** A throwaway package with `files: ["dist", "skills", "guides"]` and a `prepack` script was packed with `npm pack --dry-run --json`, inside a git repository whose root `.gitignore` lists `pkg/dist/`. The result: `npm pack --dry-run` runs `prepack`, so `dist/` is built first. The hidden folder `skills/ex/.claude-plugin/` and a hidden file were listed. `.DS_Store` was left out. The parent `.gitignore` did not remove `dist/`. The lifecycle output did not pollute the JSON on standard output.

**Risks.**

- `cstack/src/cli.ts`, `cstack/package.json` and `README.md` are edited by tickets #10 and #11 at the same time. Keep each change to these files small and in its own place.
- The pack test starts `npm`, which runs `prepack` and therefore the TypeScript build. It takes several seconds, so it needs a longer timeout than Vitest's default of 5 seconds.
- A test that forgets the home folder input would write into the real `~/.claude/skills/`, which the baseline runs of ticket #12 need unchanged.

## Decisions

**Package and release**

- The package name in `cstack/package.json` is `@gambitl/cstack`. In `cstack/package-lock.json`, change the two `"name": "cstack"` fields to `@gambitl/cstack` by hand, and change nothing else in that file. The command name stays `cstack`, so `bin` stays `{ "cstack": "dist/bin.js" }`. (2026-11-18, user's answer)
- The release file that `npm pack` writes is `gambitl-cstack-<version>.tgz`. This replaces `cstack-<version>.tgz` in scope steps 11 and 12 and in the last acceptance criterion of the ticket. (2026-11-18, user's answer)
- The version stays `0.1.0`. This pull request does not change it. After the merge, the maintainer pushes the tag `v0.1.0`. (2026-11-18, accepted by default)
- `cstack/package.json` gets `"files": ["dist", "skills", "guides"]` and the script `"prepack": "npm run build"`. Keep `"private": true`, keep `dist` in `files`, and keep `rootDir` set to `src` in `tsconfig.build.json`. (2026-11-18, ticket scope step 2 and comment from ticket #7)
- `cstack` is never published on the npm registry. No text may tell people to run `npm install -g cstack`, `npx cstack` or `npm install -g @gambitl/cstack`. The only install command is `npm install -g` followed by the link of a release file. (2026-11-18, comment from ticket #7 and user's answer)
- Write the minimum Node version nowhere else than `engines.node` in `cstack/package.json`. Texts refer to "the Node version that `engines.node` in `cstack/package.json` names", without the number. (2026-11-18, conventions file)

**Example skill and guide**

- Ship exactly one skill, `cstack/skills/cstack-example/`, with three files: `SKILL.md`, `.claude-plugin/plugin.json` and `agents/check.md`. `plugin.json` holds `"name": "cstack-example"` and a one-sentence description, so the agent loads as `cstack-example:check`. (2026-11-18, ticket scope step 1; the agent file name is an assumption not asked)
- The descriptions of the example skill and of its agent are one short sentence each. Each says that it only checks the install of `cstack` and must never be used for a task. Claude Code puts these descriptions into every session, so keep them short. (2026-11-18, ticket scope step 1 and accepted by default)
- Ship exactly one guide, `cstack/guides/cstack-example/hello.md`, with a few plain sentences. (2026-11-18, ticket scope step 1)
- Never put a `.gitignore` or an `.npmrc` inside `cstack/skills/` or `cstack/guides/`. npm never packs these files, and it also drops the files that a nested `.gitignore` lists. (2026-11-18, tested answer by the advisor)

**How the commands get their inputs**

- Do not change the signature of `run` in `cstack/src/cli.ts`. Each new command function takes its own arguments, the `io`, and an options object. For `skills install`, the options are `home` and `packageRoot`, plus two optional inputs for tests, `uid` and `now`. For `guide`, the only option is `packageRoot`. (2026-11-18, accepted by default)
- `cli.ts` passes `home: os.homedir()` and `packageRoot: fileURLToPath(new URL("..", import.meta.url))`. That URL is the package root both from `src/cli.ts` and from `dist/cli.js`. The defaults of `uid` and `now` are `process.getuid()` and the current time. (2026-11-18, accepted by default)
- Keep the change to `cli.ts` small, because tickets #10 and #11 edit the same file at the same time. Add one dispatch line per command, next to the existing command-name check, and add the two commands to the `USAGE` constant. Do not reorganise the file. (2026-11-18, coordinator's brief)
- The top level of `run` still reads only the command name and `--version`. The rest of the arguments belong to the command, which parses them itself with `parseArgs` from `node:util` and `strict: true`. (2026-11-17, decisions of ticket #7)
- `cstack skills install` reads the skills from `<packageRoot>/skills/` and the version from `<packageRoot>/package.json`. It never reads a clone of the repository. (2026-11-18, ticket scope step 3)

**Names and exit codes**

- A skill name or a phase name must match `^[a-z0-9][a-z0-9-]*$`. This applies to the phase and to `--skill` of `cstack guide`, and to every name given to `--adopt`. A name that does not match is refused with exit code 2, before any file is read. (2026-11-18, ticket scope step 9 and accepted by default)
- Every usage error returns 2. It writes one line that names the problem on standard error, followed by the usage. Usage errors include an unknown option, `cstack skills` without `install`, a missing phase, an extra argument, a bad name, and an `--adopt` name that this version does not ship. (2026-11-18, ADR-SIC-H and accepted by default)
- A command never catches a crash of its own. The crash reaches `bin.ts`, which prints one line and sets exit code 1. (2026-11-17, ADR-SIC-H)

**`cstack guide <phase>`**

- `cstack guide <phase> [--skill <name>]` prints the file `<packageRoot>/guides/<skill>/<phase>.md` on standard output, byte for byte, and returns 0. The default skill is `resolve-issue`. (2026-11-18, ticket scope step 9)
- When the folder `<packageRoot>/guides/<skill>/` does not exist, the command says on standard error that this version of `cstack` has no guides for that skill. It lists the skills that have guides and returns 1. With this version, `cstack guide <phase>` with the default skill ends this way. (2026-11-18, accepted by default)
- When the phase file does not exist, the command says on standard error that the phase is unknown for that skill. It lists the known phases, sorted, which are the `.md` file names without `.md`, and returns 1. (2026-11-18, ticket scope step 9)

**`cstack skills install`: what it may touch**

- The command writes only in three places: `<home>/.claude/skills/`, `<home>/.claude/skill-backups/` and its own temporary folder. It creates `<home>/.claude/skills/` when that folder is missing. (2026-11-18, ticket scope and assumption not asked)
- The marker file is `.cstack-managed`. It holds the version of the installed package followed by one newline. Only its existence counts as proof that `cstack` owns a folder. (2026-11-18, tested answer, ADR-SIC-E and this ticket's CTO review block)
- A target counts as owned by `cstack` only when it is a real folder, not a symbolic link, and holds `.cstack-managed`. Use `lstat`, or `readdir` with file types, and never follow a symbolic link at `<home>/.claude/skills/<name>`. A symbolic link, a plain file, or a folder without the marker belongs to someone else, whatever its name or content. (2026-11-18, ticket scope step 4 and CTO review block)
- When the command runs as root, which means `uid` is 0, it says on standard error that it must run without `sudo`. It writes nothing anywhere and returns 1. (2026-11-18, accepted by default)

**`cstack skills install`: what it does**

- The command first decides what to do with every folder. Then it checks that every backup target is free. Only then does it move anything. If a backup target already exists, it stops with a message on standard error and exit code 1, and nothing moves. (2026-11-18, assumption not asked)
- For each shipped skill, the command copies `<packageRoot>/skills/<name>/`, hidden files included, into its temporary folder. Then it writes the marker into the copy. Only then does it move the copy into `<home>/.claude/skills/<name>/` with a rename. (2026-11-18, ticket scope steps 3 and 7)
- The temporary folder is a new hidden folder, created with `mkdtemp` in the parent of the real path of `<home>/.claude/skills/`, found with `realpath`. It is never inside the skills folder. The command removes it at the end, also after a failure. (2026-11-18, accepted by default)
- When the target does not exist, the copy moves into place, and the line says `installed`. (2026-11-18, ticket scope step 8)
- When the target is owned by `cstack` and is identical to the new copy, marker included, the command leaves it untouched, and the line says `unchanged`. Two folders are identical when they hold the same entries with the same types and every file has the same bytes. (2026-11-18, consequence of the user's answer on backups, shown at the approval gate)
- When the target is owned by `cstack` and differs, the old folder moves to `<home>/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/<name>`, then the copy moves into place. The line says `replaced` and gives the backup path. (2026-11-18, user's answer)
- When the target belongs to someone else and `--adopt` does not name it, the command leaves it exactly as it is. The line says `skipped` and gives the reason: no marker, a symbolic link, or not a folder. It also says that `cstack skills install --adopt <name>` can take the folder over after a backup. (2026-11-18, ticket scope step 4)
- When the target belongs to someone else and `--adopt` names it, the target first moves to the backup folder, then the copy moves into place. A symbolic link moves as a link, and the folder it points to is never touched. The line says `replaced` and gives the backup path. (2026-11-18, ticket scope step 5 and assumption not asked)
- `--adopt <name>` may be given several times. Every name must be a skill that this version ships, or the command returns 2 before anything moves. Without `--adopt`, the command never moves a target that belongs to someone else. (2026-11-18, ticket scope step 5 and accepted by default)
- A real folder in `<home>/.claude/skills/` that holds the marker, but that this version does not ship, moves to the backup folder. The line says `removed` and gives the backup path. (2026-11-18, ticket scope step 6 and user's answer)
- All backups of one run go into one folder, `<home>/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/`, named with the date and time of the run in local time, like `pull-skills.sh`. The command creates it only when something moves into it. (2026-11-18, ticket scope step 5 and accepted by default)
- A move into the backup folder uses a rename. If the rename fails with `EXDEV`, because the two folders are on different disks, the command copies the source, then deletes it, as `mv` does. A move into the skills folder always comes from the temporary folder, on the same disk. (2026-11-18, accepted by default)
- A replace takes two renames, the old folder out and the copy in, because a rename onto a folder that is not empty fails with `ENOTEMPTY`. If the process stops between the two, the skill is missing, and the next install puts it back. (2026-11-18, tested answer by the advisor)
- The command prints one line per skill on standard output. Shipped skills come first, in name order, then removed skills, in name order. Each line starts with its status word, `installed`, `replaced`, `unchanged`, `skipped` or `removed`, followed by the skill name. (2026-11-18, ticket scope step 8 and accepted by default)
- The exit code is 0 when every shipped skill is in place, and 1 when at least one was skipped. (2026-11-18, ticket scope step 8)
- Put a `WHY: ADR-SIC-C` comment in `cstack/src/commands/skills.ts` where the marker check lives, and another where the backup move lives. (2026-11-18, documentation duty of the skill)

**Tests**

- No test may ever read or write the real `~/.claude`. Tests of `skills install` call the command function directly, with a temporary home folder. When a test needs other versions, it builds fake packages in a temporary folder. (2026-11-18, ticket scope step 10 and coordinator's brief)
- The only test that goes through `run` for `skills install` sets `process.env.HOME` to a temporary folder first. It checks that `os.homedir()` returns that folder before it calls `run`, and it restores the old value afterwards. (2026-11-18, assumption not asked)
- The pack test runs `npm pack --dry-run --json` in `cstack/` with `execFile`, with a timeout of 120 seconds, because `prepack` runs the TypeScript build. It reads the version from `cstack/package.json` and expects the file name `gambitl-cstack-<version>.tgz`. (2026-11-18, ticket acceptance and user's answer)
- Never run `npm install -g` or `npm link` on this machine, and never run `cstack skills install` against the real home folder, not even by hand. The baseline runs of ticket #12 need today's prose skills unchanged. (2026-11-18, coordinator's brief)

**Release workflow**

- `.github/workflows/release.yml` has the workflow name `Release` and runs on `push` of tags `v*`. It sets `permissions: contents: read` at the top, and gives `contents: write` only to its one job. (2026-11-18, ticket scope step 11 and accepted by default)
- The job runs on `macos-latest`, with `defaults.run.working-directory: cstack`. Its steps are, in this order: `actions/checkout@v7` with `persist-credentials: false`; `actions/setup-node@v7` with `node-version: lts/*`, `cache: npm` and `cache-dependency-path: cstack/package-lock.json`; the tag check; `npm ci`; `npm test`; `npm pack --json`; and `gh release create`. (2026-11-18, accepted by default)
- The tag check reads the tag from `github.ref_name` through an environment variable, and never puts `${{ }}` inside the script itself. It compares the tag with `v` followed by the version in `cstack/package.json`. When they differ, it stops with a message that gives both values. (2026-11-18, ticket scope step 11)
- The workflow reads the file name from the `filename` field of the JSON that `npm pack --json` prints, and never builds the name by hand. (2026-11-18, accepted by default)
- Only the step that runs `gh release create` receives `GH_TOKEN: ${{ github.token }}`. It creates the release for the tag, attaches the packed file, and passes `--generate-notes` and `--repo "$GITHUB_REPOSITORY"`. The workflow uses no third-party action. (2026-11-18, accepted by default)
- Never push a tag that starts with `v`, and never create a GitHub release in this run. The maintainer does both after the merge. (2026-11-18, coordinator's brief)

**Other files**

- In `pull-skills.sh`, the loop that warns about local skills skips folders that hold `.cstack-managed`. Add the line `[ -e "$dir/.cstack-managed" ] && continue` next to the `.superset-managed` line. `scripts/test_pull_skills.sh` gets one case that proves it. (2026-11-18, accepted by default)
- `README.md` gets a section `## Install cstack`, right after the two introduction paragraphs. It also loses one sentence: "The install steps of `cstack` itself are documented separately, when that part of the tool ships." Change nothing else in the README, because ticket #10 edits it at the same time. (2026-11-18, ticket scope step 12 and assumption not asked)
- The README section says these things, in this order. You install with `npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/gambitl-cstack-<version>.tgz`, then you run `cstack skills install`. You run it without `sudo`. You update the same way, with the newer link. `npm update -g` cannot update `cstack`, because `cstack` is not on the npm registry, and it stops with a 404 error. You go back by installing the previous release the same way and running `cstack skills install` again. A folder without the marker is skipped, and `--adopt <name>` takes it over. Every folder that the command replaces, removes or adopts is saved first in `~/.claude/skill-backups/<date-time>/<name>`, which sits outside the skills folder so that Claude Code does not load it. The section also gives the Node version rule and `cstack guide <phase>`, in one sentence each. (2026-11-18, ticket scope step 12 and user's answers)
- ADR-SIC-C goes in `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`, in the format of ADR-SIC-E and ADR-SIC-H. It compares the three options of the specification and records the choice of the first. It also records the marker, `--adopt`, the backups before a replace or a removal, the name `resolve-issue` kept for the new skill, the package name `@gambitl/cstack` with its reason, and the release steps of the maintainer. The ADR-SIC-C line in section 9 of `docs/projects/skills-into-cli.md` links to it, the way the ADR-SIC-E line does. (2026-11-18, ticket scope step 13 and user's answers)
- Do not edit `CLAUDE.md`, `sync.sh`, `scripts/build_inventory.py` or `.github/workflows/ci.yml`. (2026-11-18, assumption not asked)

**How the work runs**

- Use the branch `gambitl/cstack-release-skills`, which is already checked out in this worktree. Do not create another branch. (2026-11-18, assumption not asked)
- Commit messages use the Conventional Commits form, with the scopes `cli`, `tests` or `docs` or no scope, followed by a plain English sentence. (2026-11-18, the repository's history)
- The repository's git config sets `user.email` to the maintainer's GitHub no-reply address. Never change it, and never commit with another address. (2026-11-18, coordinator's brief)
- This repository is public. No file, commit, pull request, ticket comment or decision record names an employer or a client, quotes a work ticket key, or gives a count from work retrospectives. (2026-11-18, conventions file)
- Before the push of phase 12, run two checks, and push only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 scripts/private_names.py check <that file>`, which must exit 0. Never print the private list. (2026-11-18, coordinator's brief)
- Before the push, bring the branch up to date with `origin/main`. When ticket #10 or #11 merged first, resolve the conflicts in `cstack/src/cli.ts`, `cstack/package.json`, `cstack/package-lock.json` and `README.md` by keeping both changes. (2026-11-18, coordinator's brief)
- Never force-push. Never merge the pull request, because the user merges it. (2026-11-18, coordinator's brief)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-18, coordinator's brief)
- GitHub issues in this repository have no "in progress" or "in review" state. Skip those moves in the tracker. (2026-11-17, decisions of ticket #7)
- Claiming the `gambitl` scope on npm is a step for the maintainer after the merge. The pull request lists it next to pushing the tag `v0.1.0`. (2026-11-18, user's answer)

## Architecture

The approach is locked by the ticket, its CTO review block and the answers of phase 4, so no architecture options were drawn. Two new command files, `cstack/src/commands/guide.ts` and `cstack/src/commands/skills.ts`, each take an options object, so tests can pass a temporary home folder and fake packages. `cli.ts` only gains one dispatch line per command and two usage lines. `skills install` works in two steps: it first decides what to do with every folder and checks the backup targets, then it acts, building each skill in a temporary folder on the same disk and moving it into place with renames.

## Implementation units

### Unit 1: Package files, example skill and guide, package name — status: todo
- Failing test: `cstack/test/pack.test.ts` runs `npm pack --dry-run --json` in `cstack/` with `execFile` and a timeout of 120 seconds. It expects the file name `gambitl-cstack-<version>.tgz`, with the version read from `cstack/package.json`. It expects these paths in the file list: `dist/bin.js`, `dist/cli.js`, `skills/cstack-example/SKILL.md`, `skills/cstack-example/.claude-plugin/plugin.json`, `skills/cstack-example/agents/check.md` and `guides/cstack-example/hello.md`. It fails today because the package has no `files` field and its name is `cstack`.
- Minimum code: in `cstack/package.json`, set the name, `files` and `prepack`. In `cstack/package-lock.json`, change the two name fields. Write the three files of the example skill and the example guide.
- Refactor: none.
- Commit message: `feat(cli): pack the example skill and guide into a package named @gambitl/cstack`
- Depends on: none.

### Unit 2: `cstack guide <phase>` — status: todo
- Failing test: `cstack/test/guide.test.ts`. First case: `run(["guide", "hello", "--skill", "cstack-example"], io)` prints exactly the content of `cstack/guides/cstack-example/hello.md` and returns 0. Then these cases. An unknown phase returns 1 and lists `hello`. The default skill `resolve-issue` returns 1 and lists `cstack-example`. The phase `../../etc/passwd`, and the same value given to `--skill`, return 2, even when the function gets a `packageRoot` that does not exist; that proves that no file was read. `cstack guide` with no phase returns 2, and so does an extra argument.
- Minimum code: `cstack/src/commands/guide.ts` exports `guide(args, io, { packageRoot })`. `cli.ts` gets one dispatch line and one usage line.
- Refactor: none.
- Commit message: `feat(cli): add cstack guide to print a phase guide of the installed version`
- Depends on: Unit 1.

### Unit 3: `cstack skills install` for the folders that cstack owns — status: todo
- Failing test: `cstack/test/skills-install.test.ts`. Write "install into an empty home" first. It uses the real package root and a temporary home. Every folder of `cstack/skills/` then exists under `<home>/.claude/skills/`, with its hidden files and its `agents/` folder, and holds `.cstack-managed` with the version and a newline. The exit code is 0, with one `installed` line per skill. Then, with fake packages, these cases. A second install of the same package says `unchanged` and creates no backup folder. The rollback case installs 1.0.0, then 1.1.0, which changes one skill and adds another, then 1.0.0 again. The folders then match 1.0.0 exactly, the added skill is gone, every marker says 1.0.0, and the replaced and removed folders are in the backup folder. A folder without the marker stays byte for byte the same, the output names it with the reason, and the exit code is 1. A symbolic link at the target is skipped, and the folder it points to is unchanged. A plain file at the target is skipped. A marked folder that the package no longer ships moves into the backup folder. At the end, the temporary folder is gone, and nothing new exists inside the skills folder except the skill folders.
- Minimum code: `cstack/src/commands/skills.ts` exports `skills(args, io, options)` with the subcommand `install`. It decides first, then checks the backup targets, then acts.
- Refactor: keep the helpers for moving and comparing folders small and named for what they do.
- Commit message: `feat(cli): add cstack skills install, which replaces only the folders that cstack wrote`
- Depends on: Unit 1.

### Unit 4: `--adopt`, the root refusal, backup collisions and moves across disks — status: todo
- Failing test: in `cstack/test/skills-install.test.ts`, these cases. `--adopt <name>` moves the old folder to `<home>/.claude/skill-backups/<date-time>/<name>` with its content intact, installs the new folder, and prints the backup path. `--adopt` given twice adopts both folders into one backup folder. `--adopt` with a name that this version does not ship returns 2, and the whole home tree stays unchanged. `--adopt ../x` returns 2. `--adopt` on a symbolic link moves the link and leaves the folder it points to unchanged. With `uid: 0`, the command returns 1 and the home folder stays empty. With a fixed `now` and a backup target that already exists, the command returns 1 and nothing moves. The move helper copies, then deletes, when the rename throws an `EXDEV` error; test the helper with an injected rename function.
- Minimum code: in `cstack/src/commands/skills.ts`.
- Refactor: none.
- Commit message: `feat(cli): let cstack skills install adopt a folder after a backup`
- Depends on: Unit 3.

### Unit 5: Register `cstack skills install` in the command line — status: todo
- Failing test: in `cstack/test/cli.test.ts`, set `process.env.HOME` to a temporary folder, check that `os.homedir()` returns it, and restore the old value after the test. `run(["skills", "install"], io)` then installs `cstack-example` into the temporary home and returns 0. `run(["skills"], io)` and `run(["skills", "nope"], io)` return 2 and print the usage.
- Minimum code: one dispatch line and one usage line in `cstack/src/cli.ts`.
- Refactor: none.
- Commit message: `feat(cli): register cstack skills install in the command line`
- Depends on: Units 2 and 4.

### Unit 6: `pull-skills.sh` stops reporting the skills that cstack installed — status: todo
- Failing test: a new case in `scripts/test_pull_skills.sh`. The fake home holds a folder `cstackskill` with `.cstack-managed` and a `SKILL.md`, and an unmarked local folder. The output of `pull-skills.sh` does not contain "Only on this computer, left as is: cstackskill", and it still reports the unmarked folder.
- Minimum code: one line in `pull-skills.sh`.
- Refactor: none.
- Commit message: `fix: stop pull-skills.sh from reporting the skills that cstack installed`
- Depends on: none.

### Unit 7: The release workflow — status: todo
- Failing test: no test. The workflow only runs when a `v` tag is pushed, and this run must never push one. Check it by hand instead. Run the tag check script locally with a matching and a non-matching tag, and see it pass and stop. Run `npm pack --json --pack-destination <temporary folder>` in `cstack/`, and read `filename` with the same command as the workflow. Delete the temporary folder afterwards.
- Minimum code: `.github/workflows/release.yml` as the "Release workflow" decisions say.
- Refactor: none.
- Commit message: `ci(tests): publish a GitHub release with the packed file when a v tag is pushed`
- Depends on: Unit 1.

### Unit 8: The README section "Install cstack" — status: todo
- Failing test: no test, because this unit is prose.
- Minimum code: the section and the removed sentence, as the "Other files" decisions say. Write it as the existing README is written: full sentences, one idea per sentence.
- Refactor: none.
- Commit message: `docs: explain how to install, update and roll back cstack and its skills`
- Depends on: Units 4 and 7.

### Unit 9: ADR-SIC-C and the link from the specification — status: todo
- Failing test: no test, because this unit is prose.
- Minimum code: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md` and the link in section 9 of `docs/projects/skills-into-cli.md`.
- Refactor: none.
- Commit message: `docs: record how cstack ships its skills as ADR-SIC-C`
- Depends on: Unit 4.

Security: the change has no endpoint, database or secret, but it takes names from the command line and writes into the home folder. The tests that refuse a bad name before any file is read (Unit 2 and Unit 4), the symbolic link cases (Units 3 and 4), the root refusal (Unit 4) and the token given to one step only (Unit 7) cover it. Each of these tests is written before its code, inside its unit.

Design specification: no unit has a user interface.

## Documentation duties

- The comment on ticket #9: applies, written to https://github.com/gambitl/claude-code-stack/issues/9. It says what was built, and what differs from the ticket: the package name `@gambitl/cstack`, the release file name, the backups before a replace or a removal, the `unchanged` status, and the change to `pull-skills.sh`.
- The comments on the dependent tickets: applies, written to #15 (show only the next phase with `cstack next`), #21 (the short `resolve-issue` skill and the planning guides) and #22 (the build prompts and guides). Each comment says where a skill and a guide go, what the pack test checks and how to extend it, that `cstack guide` defaults to `resolve-issue`, and that a nested `.gitignore` or `.npmrc` never reaches the package.
- ADR-SIC-C: applies, written to `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md` in Unit 9, with `WHY: ADR-SIC-C` comments in `cstack/src/commands/skills.ts`.
- The specification page: applies, written to the ADR-SIC-C line of section 9 in `docs/projects/skills-into-cli.md` in Unit 9.
- The epic #6: applies, written to the body of https://github.com/gambitl/claude-code-stack/issues/6. Its ADR-SIC-C line says "is to create". It changes to say that the record exists, with its path.
- The README: applies, written to `README.md` in Unit 8.
- The conventions file: does not apply. The rules for new commands do not change.

## Review log

## Briefing

## Open questions after the build

### Blocking

### Non-blocking

## Pull request

## Documentation

## Executor notes

## Hand-off log

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Rename the package to `@gambitl/cstack` before the first release.** The name `cstack` belongs to an unrelated package on the public npm registry. I checked it in a temporary folder. After installing our tarball, `npm outdated -g` offers "cstack 0.3.4", and `npm update -g` silently replaces our tool with that package and removes the `cstack` command. A scoped name avoids that, and the command stays `cstack`. In exchange, `npm update -g` stops on a 404 error, which is loud and harmless, and the README says to update through the release link. Renaming later is costly: installing the new name over the old one fails with `EEXIST` until each teammate uninstalls by hand. I recommend the rename now, and that you claim the `gambitl` name on npm (a free account) so nobody else can publish under it. The release file becomes `gambitl-cstack-<version>.tgz`, which changes the text of two acceptance criteria.

**Back up a folder that cstack installed before replacing or removing it, instead of deleting it.** The ticket deletes these folders with no copy. Someone who edited a skill by hand, or copied a cstack folder with its marker to start their own skill, loses that work on the next install, and nothing brings it back. Moving it into the same dated folder as `--adopt` costs one rename, and `pull-skills.sh` already backs up on every run. I recommend the backup.

**I will do this unless you say no.**

- Each command takes `home` and `packageRoot` in an options object, so `cli.ts` barely changes while the tickets that add `cstack doctor` (#10) and `cstack measure` (#11) edit it too.
- `--adopt` can repeat, every usage error returns 2, `cstack guide` without a shipped `resolve-issue` returns 1 and lists the skills that have guides, and the first release is `0.1.0`.
- The release runs on `macos-latest` with `gh release create`. Only that step receives the token, and the checkout keeps no credentials.
- The temporary folder sits next to the real skills folder, so the final move never crosses disks. Putting a folder in place takes two renames, because macOS refuses to rename onto a folder that is not empty.
- `cstack skills install` refuses to run as root, and the README says never to use `sudo` for it. Otherwise the skills land in root's home folder, or belong to root in yours.
- `pull-skills.sh` stops reporting folders that carry `.cstack-managed`, with one line and one test case.

**I checked it myself.**

- The marker can hold the version, because the inventory script only checks that the file exists.
- `npm pack` keeps `.claude-plugin/` and builds `dist/` first, even with `--dry-run`.
- Claude Code loads the agents of a skill folder from its `.claude-plugin/plugin.json`.

**Good to know.**

- A `.gitignore` inside a skill folder is never packed, and the files it lists vanish from the package. That matters for the tickets that ship the real skill and its guides (#21, #22).
- Every teammate who installs this version sees the example skill and its agent in each session, until a later version stops shipping it.

#### Details

Locked decisions, not reopened: the name `resolve-issue`, the marker as the only proof of ownership, and `--adopt` as the only way to take over a foreign folder (this ticket's CTO review block of 2026-11-17); the marker name `.cstack-managed` (ADR-SIC-E, section "Marker file"); the start and end of a command, exit code 2 for usage errors and `rootDir` set to `src` (ADR-SIC-H); skills shipped and served by `cstack` itself (epic decisions, ADR-SIC-C line of the specification).

The package name is blocking, and the run answered the technical part with a test, but only a person can choose the name and claim the npm account. The test ran in a throwaway folder of the scratchpad, with a temporary npm prefix and cache, and with `--ignore-scripts` on every install. A fake `cstack@0.1.0` tarball with a `cstack` bin was installed globally into the temporary prefix. `npm outdated -g` then listed `cstack 0.1.0 → 0.3.4`, where 0.3.4 is the unrelated public package (last modified in 2023, no install script today, but its owner can add one at any time). `npm update -g` replaced our package with it, and the `bin/` folder of the prefix became empty, so the `cstack` command was gone. The same fake package renamed `@gambitl/cstack` gave no line in `npm outdated -g`, and `npm update -g` stopped with `E404` without updating the other global package of the prefix (`is-number@6` stayed at 6.0.0). So a scoped name trades a silent replacement by foreign code for a loud failure of `npm update -g`, which the README must explain. Last, installing `gambitl-cstack-0.1.0.tgz` into a prefix that already held the unscoped `cstack` failed with `EEXIST` on `bin/cstack`. That is why the name must be chosen before the tag `v0.1.0` is pushed. The rename touches `name` in `cstack/package.json`, the release asset name in scope steps 11 and 12 and in the last acceptance criterion, the README link, and the pack test. `bin`, the command name, `version.ts` and the package root found from `import.meta.url` do not change. Rejected options: keeping `cstack` and only telling people never to run `npm update -g`, because the trap is silent and that habit is common; publishing `@gambitl/cstack` on the npm registry, because it changes AC1 of US-2 and adds a publish token to manage, although the ADR-SIC-C record should name it as the way to make `npm update -g` work later. Claiming the scope matters because, without it, anyone can create the `gambitl` user or organisation on npm and publish `@gambitl/cstack`, which brings the same trap back. I could not check whether the name is free, because npmjs.com refuses automated requests. Default if nobody decides: the package keeps the name `cstack`, and the first teammate who runs `npm update -g` loses the tool.

The backup of folders that `cstack` owns is blocking and needs your decision, because it changes what scope step 6 does and because a delete cannot be undone. Draft question 11 recommended keeping the delete, and I disagree. The case that worries me most is a teammate who copies `~/.claude/skills/cstack-example` (or later `resolve-issue`) to start their own skill: the copy carries `.cstack-managed`, this version does not ship that name, so step 6 deletes it with no copy. Hand edits inside a folder that `cstack` installed are lost the same way on every replace. The fix moves the old folder into `<home>/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/<name>`, the same dated folder that `--adopt` uses in that run, and prints where it went. `pull-skills.sh` lines 93 to 99 already move every replaced folder into a dated backup on each run, so teammates know the pattern. The cost is a backup folder on every install that replaces anything, a few kilobytes each. The rollback test of the acceptance still holds, because it checks `~/.claude/skills/` only. A test should check that the removed and the replaced folders appear in the backup folder. A rejected option is a content hash in the marker, to back up only modified folders, because it adds a format for little gain. Default if nobody decides: the ticket's delete, which loses work with no way back.

Draft questions 4 to 7 and 9 are non-blocking, and I keep their recommendations. The options object with `home` and `packageRoot` keeps the signature of `run` unchanged. It lets tests use a temporary home and fake packages at versions 1.0.0 and 1.1.0. `--adopt` can repeat, all names are checked before anything moves, and one run shares one dated backup folder. A bad name, an `--adopt` name that this version does not ship, and a missing subcommand or argument return 2, as ADR-SIC-H says for usage errors. `cstack guide` with the default skill `resolve-issue` returns 1, because this version ships no guides for it, and lists the skills that have guides. The first release is `0.1.0`, the version already in `cstack/package.json`.

Draft question 8 is non-blocking, and I keep its recommendation with two additions. `.github/workflows/release.yml` should set `persist-credentials: false` on checkout, as `ci.yml` does. It should pass `GH_TOKEN: ${{ github.token }}` only to the step that runs `gh release create`, so that the install scripts that `npm ci` runs never see a token with `contents: write`. It should read the file name from `npm pack --json` instead of building it by hand, which also covers the rename. Checking that the tagged commit is on `main` was considered and left out: only the maintainer can push tags to this repository, and that check needs a full clone.

The temporary folder and the moves are non-blocking. The assumption in the draft puts the temporary folder under `<home>/.claude/`. If `~/.claude/skills` is a symbolic link to another disk, `fs.rename` from `~/.claude/` fails with `EXDEV`. The fix resolves the skills folder with `realpath` and creates the temporary folder in its parent, outside the skills folder, as the ticket requires. A backup move into `~/.claude/skill-backups` can cross disks in the same case, so it falls back to a copy followed by a delete on `EXDEV`, as `mv` does in `pull-skills.sh`. I checked on Node 26.10.0 that `fs.renameSync` onto a folder that is not empty fails with `ENOTEMPTY`. So a replace moves the old folder aside (into the backup), then moves the new folder into place. If the process stops between the two moves, the skill is simply missing, and the next install puts it back, since nothing stands in its way. On this machine, `~/.claude/skills`, `~/.claude/skill-backups` and the temporary folder are on the same disk.

Running as root is non-blocking. A teammate whose global npm folder needs `sudo` may type `sudo cstack skills install` by reflex. Depending on how `sudo` treats `HOME`, the skills then land in root's home folder, where Claude Code never looks, or they land in the teammate's folder but belong to root, so later installs fail. The command stops with a clear message when `process.getuid()` returns 0, and the README says to run it without `sudo`. This adds one small case to scope step 3 and one test.

Draft question 10 is non-blocking, and I keep its recommendation. Once `cstack-example` is installed, `pull-skills.sh` lines 70 to 79 print "Only on this computer, left as is: cstack-example", although its comment on line 71 says that skills of other tools are not reported. One line `[ -e "$dir/.cstack-managed" ] && continue` and one case in `scripts/test_pull_skills.sh` fix it.

Draft question 1 is blocking, and the run answered it with a test, which I re-checked. `scripts/build_inventory.py` lines 138 to 143 only test that `.cstack-managed` exists, so a marker that holds the version followed by one newline works with the inventory, as the ticket's scope and acceptance say. The comment from ticket #8 asked for an empty file, but nothing reads its content. The ticket that adds `cstack doctor` (#10) does not read the marker either, according to its body.

Draft questions 2 and 3 are blocking, and the run answered them with tests. I accept both answers. `npm pack --dry-run` runs `prepack`, keeps `.claude-plugin/` and leaves out `.DS_Store` (code mapping, last paragraph but one). The session's `resolve-issue:<name>` agents come from `~/.claude/skills/resolve-issue/.claude-plugin/plugin.json`, with no matching entry in `installed_plugins.json`.

The `.gitignore` point is non-blocking and concerns later tickets. I packed a throwaway package with `files: ["skills"]` and a folder `skills/ex/` holding `SKILL.md`, `notes.md`, `.npmrc` and a `.gitignore` that lists `notes.md`. The dry run listed only `package.json` and `skills/ex/SKILL.md`. So npm applies a nested `.gitignore` as ignore rules, and it never packs `.gitignore` or `.npmrc` themselves. The pack test of this ticket lists the expected files, so the tickets that ship the real skill and its guides (#21, #22) should extend that list.

The example skill and its agent are non-blocking. Claude Code puts the description of every installed skill and agent into each session. Keep both descriptions to one short sentence that says they only check the install. Once a later version stops shipping `cstack-example`, scope step 6 removes it from every machine at the next install.

I checked and found nothing to raise on scale and performance, operations and recurring cost (the release workflow runs on public-repository minutes, which are free), user experience beyond the exit codes and the root case, and tenant isolation.

### Open questions and answers

Draft of phase 4.1, with the recommended answer for each question.

1. **What does the marker file hold: the `cstack` version, or nothing?** Blocking, because it changes what the command writes. The ticket's scope step 3 and its acceptance say that `.cstack-managed` holds the version. The comment from ticket #8 asks for "an empty file". Tested answer: `scripts/build_inventory.py` lines 138 to 143 only check that the file exists, and `scripts/test_sync.sh` line 42 is the only place that creates one. A marker that holds the version therefore works with the inventory. Recommendation: write the version followed by one newline, as the ticket's scope and acceptance say.
2. **Does `npm pack` keep the hidden folder `.claude-plugin/`, and does `npm pack --dry-run` build `dist/` first?** Blocking, because the pack test and the release depend on it. Tested answer: yes to both, on npm 11.19.1 with a throwaway package (see "Code mapping", last paragraph but one). `.DS_Store` is left out, and the root `.gitignore` of the repository does not remove `dist/`.
3. **Will Claude Code load the example agent from the installed skill folder?** Blocking, because the last acceptance criterion depends on it. Tested answer: yes. This session lists the agents `resolve-issue:<name>`, and they come from `~/.claude/skills/resolve-issue/.claude-plugin/plugin.json`, since no `resolve-issue` plugin appears in `~/.claude/plugins/installed_plugins.json`.
4. **How do the two commands receive the home folder and the package root?** Non-blocking. Tickets #10 and #11 edit `cli.ts` at the same time, and #11 will also need the home folder. Recommendation: do not change the signature of `run`. Each command function takes an options object with `home` and `packageRoot`. `cli.ts` passes `os.homedir()` and the package root found from `import.meta.url`. Tests call the command functions directly with temporary folders and fake packages. This keeps the change to `cli.ts` to a few lines.
5. **May `--adopt` be given several times in one run?** Non-blocking. Recommendation: yes. Every name is checked before anything moves, and all backups of one run share one dated folder.
6. **Which exit codes for the cases the ticket does not fix?** Non-blocking. Recommendation, following ADR-SIC-H, where a usage error returns 2: a skill or phase name that does not match the pattern returns 2, `--adopt` with a name that this version does not ship returns 2, and a missing subcommand or argument returns 2. The ticket fixes the rest: an unknown phase returns 1, and a skipped skill returns 1.
7. **What does `cstack guide <phase>` do with the default skill `resolve-issue`, which this version does not ship?** Non-blocking. Recommendation: return 1, say that this version has no guides for `resolve-issue`, and list the skills that have guides.
8. **Where does the release workflow run, and how does it create the release?** Non-blocking. Recommendation: on `macos-latest`, like the CI workflow, because `cstack` targets macOS only. It creates the release with `gh release create` and the built-in `GITHUB_TOKEN`, with no third-party action, and lets GitHub generate the notes.
9. **Which version does the first release carry?** Non-blocking. Recommendation: `0.1.0`, the version already in `cstack/package.json`. This pull request does not change the version. After the merge, the maintainer pushes the tag `v0.1.0`.
10. **Should `pull-skills.sh` stop reporting the folders that `cstack` installed as "Only on this computer"?** Non-blocking, and outside the ticket's scope. Recommendation: yes, with one line in its warning loop and one case in `scripts/test_pull_skills.sh`, because this ticket makes the warning appear and the script's own comment says that skills of other tools are not reported.
11. **What happens to changes that someone makes by hand inside a folder that `cstack` installed?** Non-blocking. The marker means that `cstack` owns the folder, so the next install replaces it or removes it without a backup. Recommendation: keep that behaviour, which the ticket and its CTO review block describe, and say it in one sentence of the README.

**Answers of 2026-11-18.** The user answered "ok go" to the block "Questions you may not be asking". That accepts its two recommendations that needed an answer, and every item under "I will do this unless you say no", with no objection.

- The package is renamed `@gambitl/cstack` before the first release. The release file becomes `gambitl-cstack-<version>.tgz`. Claiming the `gambitl` scope on npm is a step for the maintainer, outside the repository. (User's answer.)
- A folder that `cstack` installed is moved into the dated backup folder before it is replaced or removed, instead of being deleted. This replaces the recommendation of question 11 above. (User's answer.)
- Questions 4 to 10 keep their recommendations, with the advisor's additions: only the release step gets the token, the checkout keeps no credentials, the release reads the file name from `npm pack --json`, the temporary folder sits next to the real skills folder, a backup move falls back to copy and delete across disks, and `cstack skills install` refuses to run as root. (Accepted by default.)
- Questions 1 to 3 have tested answers, which the user saw in the block. (Tested answers.)

Consequence found while writing the plan, and shown at the approval gate: with backups on every replace, an install that changes nothing would still create a backup folder on every run. So a skill whose installed folder is already identical to the new one, marker included, is left untouched and reported as "unchanged".

Assumptions not asked, with obvious defaults: the command creates `<home>/.claude/skills/` when it is missing. It builds each skill in a hidden temporary folder under `<home>/.claude/`, which it removes at the end, even after a failure. Backup folder names use local time, like `pull-skills.sh`. If the backup target already exists, the command stops before it moves anything. With `--adopt`, a symbolic link is moved as a link, and the folder it points to is never touched. The README section "Install cstack" comes right after the introduction, because installing `cstack` is now the main use of the repository.

### Architecture options

No real choice remained after phase 4, so no blueprints were drawn. No new structural decision appeared while writing the plan. The one consequence found, the `unchanged` status, follows from the answer on backups and is shown at the approval gate.
