# Plan: #18 — M2-6: Commit one unit at a time and order the units that share files

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/18
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in `docs/projects/`), ADRs in `docs/decisions/`
Branch: gambitl/unit-commit-order
Conversation language: French; the conversation uses it, and every record stays in English
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Each piece of work is saved in the code history on its own, with only its own files, and two pieces that edit the same file never run at the same time.

- **What the title means**: A unit is one small piece of work in the plan, with its own test and its own commit. A commit is one saved step of the code history. To commit one unit at a time means that `cstack unit commit <n>` saves only the files that unit `n` planned to touch, and nothing else. To order the units that share files means that `cstack unit order` groups the units into batches. The units of one batch can run at the same time, because they touch different files. The batches run one after the other.
- **Why we are doing it**: The skill runs several units in parallel in the same working folder. The retrospectives of past runs show such units colliding: one unit's commit picked up the half-done changes of another. The history then lies about which unit changed what.
- **For the user**: A solution engineer gets a clean history, one commit per unit, that a reviewer can follow. Parallel work stays fast, and it no longer breaks.

**Goal.** This ticket delivers `cstack unit commit <n>`, which stages only the files of one unit, and `cstack unit order`, which runs the units that share a file one after the other (US-9 AC2, AC3 and the negative criterion). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #13 adds the plan file reader, the commit trailer reader and the run state. None of them is in the repository yet.
* **Parallel units today**: `skills/resolve-issue/agents/executor.md` (line 40): each unit runs in its own implementer, and "Independent units run in parallel". Nothing compares the files of two units before they start. `skills/resolve-issue/SKILL.md` (line 146) says the same when the plan is written.
* **The commit of a unit today**: `skills/resolve-issue/agents/implementer.md` (line 34): the implementer commits with the unit's commit message. Nothing says which files it stages, so a commit can take the files of another unit that runs at the same time.
* **Files that a unit does not mention**: `skills/resolve-issue/agents/implementer.md` (line 45): an implementer stops when its unit cannot be done without touching files it does not mention. The plan never lists those files, so nothing checks this either.
* **One commit per unit**: `skills/resolve-issue/SKILL.md` (line 145) asks for one commit per unit, in the Conventional Commits form, with the scopes of the conventions file. The plan template gives the order of units with "Depends on", in `skills/resolve-issue/templates/plan.md` (line 44).
* **Specification**: `docs/projects/skills-into-cli.md` (line 15) names the problem of parallel implementers colliding in the same worktree. Lines 136 to 138 hold the criteria that this ticket carries.
* **Contract**: from #13. A unit starts with `- Files:`, which lists its paths in backticks, separated by commas. It has a `- Commit message:` on one line and a `- Depends on:` line with unit numbers or `none`. It can have a `- Blocked: <reason>` line. A unit has either a `- Test:` line or a `- No test: <reason>` line. Each unit commit carries the trailer `Cstack-Unit: <n>`, and the trailer reader `cstack/src/plan/commits.ts` lists the commits of each unit on the branch. #17 saves `units/<n>/red.json` for a failing run and `units/<n>/green.json` for a passing run, in the run folder. The commands are `cstack unit order [--json]` and `cstack unit commit <n>`, and each also takes `--plan <file>`. `cstack unit order` exits with `1` when the `Depends on` lines form a cycle. `cstack unit commit` exits with `1` when it refuses and with `5` when `git commit` fails. Both exit with `3` on an invalid plan file. #23 adds the trailer lines of `commitAttribution` from the settings file to each unit commit.

## Scope

1. Build `cstack unit order` in `cstack/src/commands/unit-order.ts`. Leave out the units that already have a commit. Set aside the units with a `Blocked` line, and the units that depend on them, and say why.
2. Build the batches. Go through the remaining units in number order. Put a unit in the current batch when every unit it depends on is done or sits in an earlier batch, and when it shares no file with a unit already in this batch. Keep the other units for the next batch. Repeat until no unit is left.
3. Print one line per batch, such as `Batch 1: units 1, 3`. For each unit held back, print the reason, such as "unit 2 shares `src/a.ts` with unit 1". `--json` prints the same as JSON. When no unit can be placed because the `Depends on` lines form a cycle, exit with `1` and name the units of the cycle.
4. Build `cstack unit commit <n>` in `cstack/src/commands/unit-commit.ts`. Before it stages anything, it checks the rules below and lists every broken rule at once.
   - A unit with a `Test` line needs a saved passing run that is newer than its saved failing run. A unit with a `No test` line needs no saved run.
   - Every unit that unit `n` depends on already has a commit.
   - The index, which is git's list of staged changes, holds no file outside unit `n`'s `Files`. cstack never unstages such a file, because it may be another unit's work.
   - No other unit that shares a file with unit `n` has started without a commit. A unit has started when it has a saved failing run.
   - At least one file of unit `n` has a change.
5. Then stage each listed file that has a change, with `git add -- <path>`. This also stages a new file and a deleted file. Check once more that the staged files are all in unit `n`'s `Files`.
6. Write the commit message into a temporary file. It is the unit's commit message, a blank line, and the trailer `Cstack-Unit: <n>`. Run `git commit -F <file>`, without `--no-verify`, so the commit hooks of the repository still run. When `git commit` fails, exit with `5` and print its output.
7. Print the short hash of the new commit, and exit with `0`. A unit may get a second commit later, for example after a fix. It carries the same trailer.

## Acceptance (TDD)

* `cstack/test/unit-order.test.ts`: write first the case where units 1 and 2 both list `src/a.ts` and unit 3 lists `src/b.ts`. The order must give batch 1 with units 1 and 3, and batch 2 with unit 2, and say that unit 2 shares `src/a.ts` with unit 1 (US-9 AC2).
* `cstack/test/unit-order.test.ts`: a unit that depends on another one lands in a later batch. A unit that already has a commit is left out. A blocked unit and the units that depend on it are set aside with their reason. Units 1 and 2 that depend on each other make the command exit with `1` and name both units.
* `cstack/test/unit-commit.test.ts`: write first the case where units 1 and 2 have changed `src/a.ts` and `src/b.ts` in the same worktree. `cstack unit commit 1` must create one commit with only the files of unit 1, the message of unit 1 and the trailer `Cstack-Unit: 1` (US-9 AC3). `src/b.ts` must stay changed and unstaged (US-9 negative).
* `cstack/test/unit-commit.test.ts`: when a file of unit 2 is already staged, `cstack unit commit 1` exits with `1`, names that file, and commits nothing. The staged file stays staged.
* `cstack/test/unit-commit.test.ts`: a unit with a `Test` line and no passing run after its failing run is refused. A unit with a `No test` line commits without any saved run. A unit whose dependency has no commit is refused. A unit with no changed file is refused.
* `cstack/test/unit-commit.test.ts`: when units 1 and 2 share `src/a.ts` and unit 2 has a saved failing run but no commit, `cstack unit commit 1` exits with `1`. The message names unit 2 and `src/a.ts`.
* `cstack/test/unit-commit.test.ts`: a new file and a deleted file of the unit both land in its commit. A commit hook that fails makes the command exit with `5` and print the hook's output.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A commit message that holds `$(touch pwned)` and backticks lands in the commit byte for byte, and no file named `pwned` appears. The message reaches git only through the file given to `git commit -F`, never through a shell.

**Size: S** · Blocked by: #13 · Feeds: #23, #28

### Ticket comments

Comment by the maintainer, 2026-11-18 (https://github.com/gambitl/claude-code-stack/issues/18#issuecomment-6974361815):

> Ticket #13 fixed the unit lines and the trailer rule that you use. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.
>
> The commit trailer `Cstack-Unit: <n>` counts only in the final paragraph of the commit message, together with any other trailer such as `Co-Authored-By`. Git does not read a trailer anywhere else. `cstack unit commit` must therefore write the trailer last. `listUnitCommits` in `cstack/src/plan/commits.ts` reads it back.
>
> For batches, `readPlan` in `cstack/src/plan/read.ts` returns every unit with its `Files` list and its `Depends on` numbers. The reader checks that a `Depends on` line names only units that exist and never the unit itself. It does not detect cycles, because that is yours: `cstack unit order` must exit with `1` when the lines form a cycle. A unit path is a text check only, so resolve symbolic links before you stage a file. The exit codes of your two commands are in `cstack/src/manifest.ts`.

Pull request #40 of branch `gambitl/plan-format` merged into `main` on 2026-11-18, so the code the comment names is on `main` (commit 618602f).

### Decisions already taken upstream

From the epic "Skills into CLI" (https://github.com/gambitl/claude-code-stack/issues/6), block "Open questions and decisions", copied word for word:

#### Open questions and decisions

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
- ADR-SIC-B, where the run state lives and how its format is versioned, is written in `docs/decisions/ADR-SIC-B-run-state.md`. The design chose both: the plan file keeps what people read and what must travel with the branch, and a run state under the common git folder keeps what only `cstack` needs. Ticket #13 wrote it.
- ADR-SIC-C, how `cstack` ships its skills, exists in `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 wrote it.
- ADR-SIC-D, the settings file and the models of the agents, exists in `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 wrote it.
- ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
- ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

ADRs that the block names and that exist on `main` today:

- [ADR-SIC-B: Where the run state lives and how its formats are versioned](../decisions/ADR-SIC-B-run-state.md). The status of a unit comes from the commits that carry `Cstack-Unit: <n>`. The run state lives under the common git folder, so every worktree of the repository sees the same run.
- [ADR-SIC-C: How cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md).
- [ADR-SIC-D: The settings file and the models of the agents](../decisions/ADR-SIC-D-settings-file-and-review-model.md).
- [ADR-SIC-E: The new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final`.
- [ADR-SIC-H: How a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md). A command prints through `io`, returns its exit code, and never calls `process.exit()`.

## Dependencies

Dependencies: clear. The only blocker, #13 (the plan file format, the phase order and the command list), was closed on 2026-11-18, and its pull request #40 is merged into `main`.

## Code mapping

Graphify is not installed on this machine, and the coordinator's brief forbids installing it. The code was mapped with text search and targeted reads.

**Entry points.** `cstack/src/cli.ts` keeps the calls to the built commands in `HANDLERS`, a record keyed by the first word of the usage line (lines 37 to 42). `run` (lines 44 to 72) sends a first word to its handler when the word has a handler and a built entry. When every entry of a first word is still not built, it answers "not built in this version yet" with exit code 2. `cstack/src/manifest.ts` holds the entries `cstack unit order [--json]` and `cstack unit commit <n>`, both with `built: false`, and `planCommand` adds `--plan` to their flags. The same file holds `EXIT`: 0 ok, 1 refused, 2 usage, 3 invalid input, 4 missing tool, 5 a tool failed. The first word `unit` is shared with `cstack unit red` and `cstack unit green`, which ticket #17 builds later.

**The plan reader.** `readPlan(text)` in `cstack/src/plan/read.ts` returns the header, which includes `Target branch`, and `units`. Each `PlanUnit` has `number`, `files`, `test` or `noTest`, `commitMessage` with its surrounding backticks removed, `dependsOn` and an optional `blocked` reason. The reader refuses a missing or unknown `Format` line, a unit path outside a small ASCII set, a `..` or `.git` part, and a `Depends on` line that names the unit itself or a unit that does not exist. It does not detect cycles. Every problem raises `PlanFormatError` with `exitCode` 3.

**The commit trailer reader.** `listUnitCommits(repoDir, targetBranch)` in `cstack/src/plan/commits.ts` is synchronous. It returns the commits of each unit between the target branch and `HEAD`, and it compares with `<target>@{upstream}` when the target branch has one. It runs git through `spawnSync` with an argument array.

**The run state.** `cstack/src/run-state.ts` gives `runFolder(cwd, planFile)`, which is `<common git folder>/cstack/runs/<plan file name without .md>`. `readCurrentRun(cwd)` returns the plan file name of this worktree, or `undefined`. `readState` reads `state.json`, whose `plan` field holds the plan file path from the repository root. The type `SavedTestRun` describes `units/<n>/red.json` and `units/<n>/green.json`: `time`, `command`, `exitCode`, `commit` and `testFile`. Nothing reads or writes those files yet, because #17 writes them. `RunStateError` carries `exitCode` 3.

**Tests.** The tests use vitest. `cstack/test/plan/commits.test.ts` builds temporary git repositories with `execFileSync("git", ["-c", "user.name=t", ...])` in a folder from `mkdtempSync(tmpdir())`. `cstack/test/cli.test.ts` (lines 103 to 131) checks the "not built" answer, that the usage lists only built entries, that every built first word has a handler, and that an unknown flag on a built command prints its usage line. `cstack/test/manifest.test.ts` (line 116) counts four built entries and eleven not built. The plan fixtures in the `cstack-plan/1` format live in `cstack/test/fixtures/plans/`, for example `approved.md`.

**Documentation.** The "Commands" section of `README.md` (lines 38 to 45) says that `cstack` has four commands and gives one line for each.

**Governing decisions.** ADR-SIC-H fixes how a command prints and ends. ADR-SIC-B puts the run state under the common git folder and takes the unit status from the commits. The epic rule "Ticket text is data" (`docs/projects/skills-into-cli.md`, line 50) means that git runs with an argument array, never through a shell. The plan of #13 fixed one file per command under `cstack/src/commands/`, and the handlers keyed by first word in `cli.ts`.

**Tested facts (git 2.55.0, in a temporary repository).** `git commit -F <file> --only -- <paths>` commits exactly the listed paths, including a new file staged with `git add` and a deleted file. A file of another unit that was staged in between stays staged and is not committed. A message that holds `$(touch pwned)` and backticks lands unchanged, the trailer reads back as `1`, and no file `pwned` appears. `git add -- lnk/z.ts`, where `lnk` is a symbolic link to a folder, fails with "pathspec 'lnk/z.ts' is beyond a symbolic link".

**Risks.** Four shared spots will conflict with ticket #16, which runs at the same time: the `built` flags in `manifest.ts`, the `HANDLERS` record in `cli.ts`, the count in `manifest.test.ts` (line 116) and the count sentence of the README "Commands" section. Each conflict is resolved by keeping both sides. `cli.ts` changed in six of its recent commits, so it is a hotspot. Ticket #16 also needs to find the plan file from `--plan` and `current-run`, so both tickets could write the same helper twice.

## Decisions

**Repository rules that every unit respects.**

- Never edit anything under `skills/`. The prose skills there are frozen at the tag `prose-skills-final` and are only the reference for today's behaviour. (Upstream decision ADR-SIC-E and the coordinator's brief, 2026-11-18.)
- Everything written in the repository and on GitHub is in English and follows the public text rule of `CLAUDE.md`: no employer or client name, no work ticket key, and no count from work retrospectives. (Conventions file.)
- A command prints through the `io` argument, returns its exit code, and never calls `process.exit()`. Only `cstack/src/bin.ts` touches the process. (ADR-SIC-H.)
- cstack treats the text of a plan file as data. Every git call uses `spawnSync` or `execFile` with an argument array, never a shell. (Epic rule "Ticket text is data".)
- The minimum Node version lives only in `engines.node` of `cstack/package.json`. Never copy that number into another file. (Conventions file.)
- Tests use temporary folders and temporary git repositories. They never run `cstack skills install` against the real home folder, never change anything under `~/.claude/skills/`, and never install Graphify. (Coordinator's brief, 2026-11-18.)
- Commits use the Conventional Commits form with the layer scopes of `CLAUDE.md`: `cli` for code and its tests, `tests` for test-only changes, and no scope for `docs`. (Conventions file and the history of `main`.)
- Ticket #16 runs at the same time and also edits `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts` and `README.md`. Keep each change to those files small and in its own place. Do not rename, move or reformat code that this ticket does not need to change. (Coordinator's brief, 2026-11-18.)
- In `cstack/src/manifest.ts`, mark the two entries of this ticket as built by wrapping each one as `{ ...planCommand({ ... }), built: true }`. Do not change the `planCommand` helper itself, because #16 marks its own entries at the same time. (Assumption not asked, 2026-11-18.)
- When the branch is brought up to date with `origin/main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. Never push a tag that starts with `v`. (Coordinator's brief, 2026-11-18.)
- When the update onto `origin/main` conflicts, keep both sides of each conflict. For `dispatchSubcommand` in `cli.ts`, keep exactly one copy. Then run `npm test` and `npm run typecheck` in `cstack/` again, and push only when both pass. (Coordinator's brief and coordinator's message, 2026-11-18.)
- Never change `user.email` in the git config. Before the push, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`. Then write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, and run `python3 scripts/private_names.py check <that file>`. It must exit 0. Never print the private list. (Coordinator's brief, 2026-11-18.)
- Never merge the pull request. When the `cstack` check is cancelled with "The job was not acquired by Runner", rerun it with `gh run rerun <run id>`. (Coordinator's brief, 2026-11-18.)

**Finding the plan file (`cstack/src/plan/locate.ts`).**

- One function, `locatePlan`, finds the plan file for every command that takes `--plan`. Ticket #16 writes the same file in its own branch, so the interface below must match it exactly, name for name. (Coordinator's messages, 2026-11-18.)
- The file exports exactly this interface: `export interface LocatedPlan { root: string; path: string; relative: string }`, `export class PlanLocationError extends Error { readonly exitCode: 2 | 3 }` with the constructor `(message, exitCode)`, and `export function locatePlan(cwd: string, planFlag: string | undefined): LocatedPlan`. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)
- `root` is the real path (`realpathSync`) of `git rev-parse --show-toplevel`. `path` is the absolute real path of the plan file. `relative` is the path from `root`, with forward slashes. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)
- `locatePlan` only reads. It never writes `current-run` or `state.json`, because pointing `current-run` at a plan is the job of `cstack next` (#15). (Coordinator's answer, 2026-11-18.)
- When `--plan <file>` is given, it wins. The path is read from `cwd`. (Coordinator's answer, aligned with ticket #15, 2026-11-18.)
- A `--plan` path outside the repository, before or after symbolic links are resolved, throws `PlanLocationError` with exit code 2. Compare real paths, because on macOS git gives `/private/var/...` and Node gives `/var/...`. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)
- A `--plan` file inside the repository that does not exist or cannot be read throws `PlanLocationError` with exit code 3. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)
- Without `--plan`, the function reads the plan file name with `readCurrentRun`. No `current-run` throws `PlanLocationError` with exit code 2, and the message asks for `--plan <file>`. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)
- With a `current-run`, the function reads that run's `state.json` with `readState`, and its `plan` field gives the plan path from the repository root. A run without `state.json` throws `PlanLocationError` with exit code 3. A `state.json` that `readState` rejects keeps throwing its own `RunStateError` (exit code 3), unchanged. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)
- Error messages hold no stack trace. (Coordinator's message msg_40f5ec72ec6c, 2026-11-18.)

**Routing the `unit` commands (`cstack/src/cli.ts`).**

- Use `dispatchSubcommand(group: string, args: string[], io: Io, handlers: Record<string, (args: string[], io: Io) => Promise<number>>): Promise<number>`, exported from `cstack/src/cli.ts`, for `unit order` and `unit commit`. Ticket #16 writes the same function for its own groups. Whichever branch pushes first adds it, and the other keeps one copy when it updates onto `main`. (Coordinator's message, 2026-11-18.)
- `dispatchSubcommand` routes on the second word. With a missing or unknown second word, it prints on stderr a usage line that lists the known second words of that group, and returns 2. So `cstack unit red` answers with that usage line and exit code 2 until #17 builds it. (Coordinator's message, 2026-11-18.)
- `HANDLERS` in `cli.ts` gets one new entry, `unit`, which calls `dispatchSubcommand("unit", args, io, { order, commit })`. (Coordinator's message, 2026-11-18.)

**`cstack unit order` (`cstack/src/commands/unit-order.ts` and `cstack/src/plan/order.ts`).**

- The batch logic is a pure function, `orderUnits`, in `cstack/src/plan/order.ts`. Ticket #28 will call it directly, so it must not read files or run git. It takes the units of the plan and the set of unit numbers that have a commit. (Accepted by default, 2026-11-18.)
- `orderUnits` returns `{ ok: true, order }` or `{ ok: false, cycle }`. `order` holds `batches` (lists of unit numbers), `waits` (each with `unit` and `reason`), `setAside` (each with `unit` and `reason`) and `committed` (unit numbers). `cycle` holds the unit numbers of one cycle, in order. (Accepted by default, 2026-11-18.)
- A unit with at least one commit that carries `Cstack-Unit: <n>`, between the plan's `Target branch` and `HEAD`, has a commit. Use `listUnitCommits` from `cstack/src/plan/commits.ts`. Such a unit is left out of the batches and listed under `committed`. (Ticket scope 1.)
- The command looks for a cycle in the `Depends on` lines of every unit, done and blocked units included, because a cycle means the plan is wrong. With a cycle, it exits with 1 and names the units of one cycle in order, such as "The Depends on lines form a cycle: unit 1 depends on unit 2, and unit 2 depends on unit 1." (Accepted by default, 2026-11-18.)
- A unit with a `Blocked` line and no commit is set aside with the reason "it is blocked: <reason>". A unit without a commit that depends on a unit set aside, directly or through other units, is set aside too, with the reason "it depends on unit <m>, which is set aside". (Ticket scope 1.)
- Build the batches in rounds. In each round, go through the remaining units in number order. A unit joins the current batch when each unit it depends on has a commit or sits in an earlier batch, and when it shares no file with a unit already in this batch. The other units wait for the next round. (Ticket scope 2.)
- Two units share a file when they list the same path, compared without case, because the macOS file system treats `src/A.ts` and `src/a.ts` as one file. Print each path as the waiting unit wrote it. (Accepted by default, 2026-11-18.)
- Each unit that is not in batch 1 gets one wait reason: the reason that kept it out of the batch just before its own. A shared file gives "it shares `<path>` with unit <m>", naming every path it shares with that unit. A dependency gives "it depends on unit <m>". (Accepted by default, 2026-11-18.)
- The text output prints one line per batch, such as `Batch 1: units 1, 3` or `Batch 2: unit 2`. Then it prints one line per wait, such as "Unit 2 waits: it shares `src/a.ts` with unit 1." Then it prints one line per unit set aside, such as "Unit 4 is set aside: it is blocked: waiting for the design." Then it prints one line for the committed units, such as "Units 5, 6 already have a commit." (Accepted by default, 2026-11-18.)
- When no unit is left to run, the command prints "No unit is left to run." with the set-aside and committed lines, and exits with 0. (Accepted by default, 2026-11-18.)
- `--json` prints the `order` object as JSON on one line, with the keys `batches`, `waits`, `setAside` and `committed`. With a cycle, `--json` prints nothing on stdout, and the message goes to stderr as in text mode. (Accepted by default, 2026-11-18; the cycle case is an assumption not asked.)

**`cstack unit commit <n>` (`cstack/src/commands/unit-commit.ts`).**

- `<n>` must be a positive whole number, and the plan must have unit `n`. Otherwise the command exits with 2, and the message names the units of the plan. (Accepted by default, 2026-11-18.)
- The command holds a lock from before its first check until `git commit` and any unstaging after a failure have ended. The lock file is `<worktree git folder>/cstack/unit-commit.lock`, where the worktree git folder comes from `git rev-parse --git-dir` (the `gitDir` of `gitFolders` in `run-state.ts`). It is not in the run folder, because the index it protects belongs to the worktree. (User's answer, 2026-11-18.)
- The lock file is created with an exclusive create (`open` with the flag `wx`). It holds the unit number, the process id and the time. It is removed in a `finally` block. (User's answer, 2026-11-18.)
- When the lock is taken, the command checks again every 200 milliseconds for up to two minutes. Then it exits with 1 and names the unit and the process that hold the lock. The wait limit is a parameter of the function, so that tests can use a short one. (User's answer, 2026-11-18; the interval and the parameter are assumptions not asked.)
- A lock whose process no longer runs is taken over. Check it with `process.kill(pid, 0)`, which fails with `ESRCH` when the process is gone. A lock file that cannot be parsed counts as taken over too. (User's answer, 2026-11-18; the unreadable lock file is an assumption not asked.)
- Before it stages anything, the command checks every rule below and lists every broken rule at once, then exits with 1. (Ticket scope 4.)
- The unit has no `Blocked` line. (Accepted by default, 2026-11-18.)
- A unit with a `Test` line needs a saved passing run that is newer than its saved failing run. Read `<run folder>/units/<n>/red.json` and `<run folder>/units/<n>/green.json` with the `SavedTestRun` type of `run-state.ts`, and compare their `time` fields as dates. The run folder is `runFolder(root, plan path)`. A unit with a `No test` line needs no saved run. (Ticket scope 4; reading the files is accepted by default, 2026-11-18.)
- A saved run file that exists but cannot be read, is not valid JSON, or has no valid `time` gives exit code 3 at once, not a refusal. The reader lives in a new file, `cstack/src/saved-runs.ts`, not in `run-state.ts`, so that it does not collide with #16 or #17. (Accepted by default, 2026-11-18.)
- Every unit that unit `n` depends on already has a commit. (Ticket scope 4.)
- The index holds no file outside unit `n`'s `Files`. Read it with `git diff --cached --name-only -z --no-renames`, and compare paths without case. The message names each such file and says that cstack never unstages it, because it may be another unit's work. (Ticket scope 4.)
- No other unit that shares a file with unit `n` has started without a commit. A unit has started when it has a saved failing run (`red.json`). The message names that unit and the shared file. (Ticket scope 4.)
- No parent folder of a unit path is a symbolic link. Check each folder of the path with `lstat`. The message names the path. A unit file that is itself a symbolic link is staged as a link, as git does. (Accepted by default, 2026-11-18.)
- No unit path is ignored by git. Check with `git check-ignore`, which does not report tracked files. The message names the path. (Accepted by default, 2026-11-18.)
- At least one file of unit `n` has a change: a modification, a new file or a deletion, staged or not. Read the changes with `git status --porcelain=v1 -z --untracked-files=all --no-renames -- <unit paths>`. (Ticket scope 4.)
- Run every git command from the repository root that `locatePlan` returns. (Assumption not asked, 2026-11-18.)
- Stage each changed path of the unit with `git add -- <paths>`. Before that, note which of these paths had no staged change. (Ticket scope 5; the note is the user's answer, 2026-11-18.)
- After staging, check once more that every staged file is in unit `n`'s `Files`. If not, unstage what this call staged and exit with 1. (Ticket scope 5.)
- Write the commit message into a file in a new temporary folder made with `mkdtemp` under `os.tmpdir()`. The content is the unit's commit message, a blank line, and `Cstack-Unit: <n>`, with a final newline. The trailer is the last line, because git reads trailers only in the last paragraph. Remove the folder afterwards. (Ticket scope 6 and the maintainer's comment.)
- Commit with `git commit -F <file> --only -- <changed paths>`, without `--no-verify`, so the commit hooks of the repository still run. `--only` commits only those paths, and any other staged file stays staged. (Ticket scope 6; `--only` accepted by default, 2026-11-18.)
- When `git add` or `git commit` fails, unstage with `git reset -q -- <paths>` exactly the paths that had no staged change before this call. Never unstage any other path. Then exit with 5 and print git's standard output and standard error. (User's answer, 2026-11-18, and ticket scope 6.)
- On success, print the short hash of the new commit from `git rev-parse --short HEAD`, and exit with 0. A unit may get a second commit later with the same trailer. (Ticket scope 7.)
- The trailer lines of `commitAttribution` from the settings file are out of scope. Ticket #23 adds them. (Ticket contract.)

**Errors and tests of both commands.**

- Both commands catch `PlanFormatError`, `RunStateError` and `PlanLocationError`, print `cstack unit <word>: <message>` on stderr, and return the error's `exitCode`. Any other error is thrown again, so that `bin.ts` turns it into exit code 1. (Assumption not asked, 2026-11-18, following the `measure` command.)
- A wrong command line, such as an unknown flag or a missing `<n>`, prints a problem line and the entry's usage line from the command list on stderr, and returns 2. (Existing test in `cstack/test/cli.test.ts`.)
- Each command function takes the folder to work in as a parameter, with `process.cwd()` as the default, so tests can point it at a temporary repository. (Assumption not asked, 2026-11-18.)
- Tests build temporary git repositories as `cstack/test/plan/commits.test.ts` does, with `-c user.name=t -c user.email=t@example.com -c commit.gpgsign=false`. A test plan file uses the `cstack-plan/1` format, for example from `cstack/test/fixtures/plans/approved.md`. (Assumption not asked, 2026-11-18.)

**After the build.**

- Leave a comment on #17 (`cstack unit commit` reads the `time` of `red.json` and `green.json`), #23 (where the commit message and its trailer are built), and #28 (`orderUnits` and the lock in the worktree git folder). The note for #22 was already sent through the coordinator on 2026-11-18. (Accepted by default, 2026-11-18.)

## Architecture

The approach is fixed by the ticket and by the answers of the question round. Two pure modules come first: `locatePlan` finds the plan file, and `orderUnits` computes the batches. Two small helpers follow: the commit lock and the reader of saved test runs. The two commands then use them, and `cli.ts` routes `cstack unit` through `dispatchSubcommand`. No new decision appeared since the question round.

## Implementation units

The test commands are `npm test` and `npm run typecheck`, run from `cstack/`. Units 1, 2 and 4 touch different files and can run in parallel. Unit 3 waits for units 1 and 2. Unit 5 waits for units 3 and 4. Unit 6 waits for unit 5, and unit 7 for unit 6.

### Unit 1: Find the plan file of a command — status: todo
- Files: `cstack/src/plan/locate.ts`, `cstack/test/plan/locate.test.ts`
- Failing test: in `cstack/test/plan/locate.test.ts`, a temporary repository with no `current-run` and no `--plan` makes `locatePlan` throw `PlanLocationError` with exit code 2, and a message that names `--plan <file>`. Then: `--plan docs/plans/x.md`, given from a subfolder, returns the real root, the absolute real path of the file, and `relative` with forward slashes. `--plan ../outside.md` and an absolute path outside the repository give exit code 2. A missing `--plan` file inside the repository gives exit code 3. With `current-run` and its `state.json` written by `writeCurrentRun` and `createRun` or `writeState`, no `--plan` returns the path from `state.json`. With both, `--plan` wins. A `current-run` whose run has no `state.json` gives exit code 3.
- Minimum code: `LocatedPlan`, `PlanLocationError` and `locatePlan(cwd, planFlag)`, with exactly the interface of the decisions on finding the plan file. Compare real paths.
- Refactor: none expected.
- Commit message: `feat(cli): find the plan file of a command from --plan or the current run`
- Depends on: none

### Unit 2: Compute the batches of the units — status: todo
- Files: `cstack/src/plan/order.ts`, `cstack/test/plan/order.test.ts`
- Failing test: in `cstack/test/plan/order.test.ts`, write first the case where units 1 and 2 both list `src/a.ts` and unit 3 lists `src/b.ts`. `orderUnits` gives the batches `[[1, 3], [2]]`, and a wait for unit 2 whose reason says it shares `src/a.ts` with unit 1 (US-9 AC2). Then: a unit that depends on another lands in a later batch, with the reason "it depends on unit <m>". A committed unit is left out and listed under `committed`, and a unit that depends only on it can join batch 1. A blocked unit and the units that depend on it, directly or not, are set aside with their reasons. Units 1 and 2 that depend on each other give `{ ok: false, cycle: [1, 2] }`. A cycle among committed units is still found. `src/A.ts` and `src/a.ts` count as one file. A unit that shares two files with unit 1 names both.
- Minimum code: `orderUnits(units, committed)` with the result types of the decisions, and a cycle search over every `Depends on` line.
- Refactor: none expected.
- Commit message: `feat(cli): compute the batches of units that can run in parallel`
- Depends on: none

### Unit 3: The cstack unit order command — status: todo
- Files: `cstack/src/commands/unit-order.ts`, `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/unit-order.test.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`
- Failing test: in `cstack/test/unit-order.test.ts`, a temporary repository on a branch off `main`, with a `cstack-plan/1` plan file whose units 1 and 2 list `src/a.ts` and unit 3 lists `src/b.ts`. `cstack unit order --plan <file>` exits with 0 and prints `Batch 1: units 1, 3`, `Batch 2: unit 2`, and the line that says unit 2 shares `src/a.ts` with unit 1. Then: a unit with a commit carrying `Cstack-Unit: 1` is listed as already committed. `--json` prints the same facts with the keys `batches`, `waits`, `setAside` and `committed`. A cycle exits with 1 and names both units. An invalid plan file exits with 3. With every unit committed, it prints "No unit is left to run." and exits with 0. In `cstack/test/cli.test.ts`: `cstack unit` and `cstack unit red 1` exit with 2, and stderr lists `order` and `commit`. In `cstack/test/manifest.test.ts`: the count becomes five built and ten not built.
- Minimum code: `unitOrder(args, io, cwd)` in `unit-order.ts`, which parses `--json` and `--plan`, calls `locatePlan`, `readPlan`, `listUnitCommits` and `orderUnits`, and prints as the decisions say. `dispatchSubcommand` in `cli.ts` with its exact signature, and the `unit` entry of `HANDLERS` with only `order` for now. Mark the `cstack unit order` entry of `manifest.ts` as built with `{ ...planCommand({ ... }), built: true }`.
- Refactor: none expected.
- Commit message: `feat(cli): add cstack unit order, which runs units that share a file one after the other`
- Depends on: 1, 2

### Unit 4: A lock for unit commits in one worktree — status: todo
- Files: `cstack/src/commit-lock.ts`, `cstack/test/commit-lock.test.ts`
- Failing test: in `cstack/test/commit-lock.test.ts`, write first the case where a lock file in a temporary folder holds unit 2 and the id of a process that runs (the test's own `process.pid`). A call for unit 1 with a wait limit of 300 milliseconds returns a refusal that names unit 2 and that process, and it never runs its function. Then: with no lock, the function runs, and the lock file exists while it runs and is gone afterwards, also when the function throws. A lock file whose process does not run (a spawned process that has ended) is taken over. A lock file that is not valid JSON is taken over. A lock that is released during the wait lets the waiting call run.
- Minimum code: one exported function that takes the lock file path, the unit number, the wait limit and the function to run, as the decisions on the lock say. It creates the folder of the lock file when it is missing.
- Refactor: none expected.
- Commit message: `feat(cli): add the lock that keeps two unit commits of one worktree apart`
- Depends on: none

### Unit 5: The cstack unit commit command: stage and commit one unit — status: todo
- Files: `cstack/src/commands/unit-commit.ts`, `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/unit-commit.test.ts`, `cstack/test/manifest.test.ts`
- Failing test: in `cstack/test/unit-commit.test.ts`, write first the case where units 1 and 2 have changed `src/a.ts` and `src/b.ts` in the same worktree, and both have `No test` lines. `cstack unit commit 1` exits with 0, prints the short hash, and creates one commit with only `src/a.ts`, the message of unit 1 and the trailer `Cstack-Unit: 1` as the last line (US-9 AC3). `src/b.ts` stays changed and unstaged (US-9 negative). Then: when `src/b.ts` of unit 2 is already staged, `cstack unit commit 1` exits with 1, names `src/b.ts`, commits nothing, and `src/b.ts` stays staged. A new file and a deleted file of the unit both land in its commit. A `pre-commit` hook that exits with 1 makes the command exit with 5 and print the hook's output, and afterwards the unit's files are no longer staged. A commit message that holds `$(touch pwned)` and backticks lands byte for byte, and no file named `pwned` appears. With a lock held by unit 2 and the test's own process, the command, given a short wait limit, exits with 1 and names unit 2. `<n>` that is not a number, or a unit the plan does not have, exits with 2.
- Minimum code: `unitCommit(args, io, cwd, lockWaitMs)` in `unit-commit.ts`, with the lock of unit 4, the index check, the change check, staging with the note of what this call staged, the message file, `git commit -F <file> --only -- <paths>`, and the unstage on failure. Add `commit` to the `unit` handlers in `cli.ts`, and mark the `cstack unit commit` entry of `manifest.ts` as built the same way as in unit 3. The count in `manifest.test.ts` becomes six built and nine not built.
- Refactor: none expected.
- Commit message: `feat(cli): add cstack unit commit, which commits only the files of one unit`
- Depends on: 1, 3, 4

### Unit 6: The refusals of cstack unit commit before staging — status: todo
- Files: `cstack/src/commands/unit-commit.ts`, `cstack/src/saved-runs.ts`, `cstack/test/unit-commit.test.ts`
- Failing test: in `cstack/test/unit-commit.test.ts`, write first the case where a unit with a `Test` line has a saved failing run and no passing run after it. `cstack unit commit` exits with 1 and says so, and nothing is staged. Then: a passing run older than the failing run is refused. A passing run newer than the failing run is accepted. A `red.json` that is not valid JSON exits with 3. A unit whose dependency has no commit is refused. A unit with no changed file is refused. When units 1 and 2 share `src/a.ts` and unit 2 has a saved failing run but no commit, `cstack unit commit 1` exits with 1, and the message names unit 2 and `src/a.ts`. A unit with a `Blocked` line is refused with its reason. A unit path under a folder that is a symbolic link is refused and named. A unit path that git ignores is refused and named. When two rules are broken, both appear in one message.
- Minimum code: the reader of saved runs in `cstack/src/saved-runs.ts`, and the checks of the decisions in `unit-commit.ts`, collected into one list before any staging.
- Refactor: if the checks make `unitCommit` long, move them into one function in the same file that returns the list of broken rules.
- Commit message: `feat(cli): refuse a unit commit while a rule of the plan or the test runs says no`
- Depends on: 5

### Unit 7: Explain the two commands in the README — status: todo
- Files: `README.md`
- No test: documentation only. The mention check of `cstack/test/manifest.test.ts` scans only `cstack/skills/` and `cstack/guides/`.
- Minimum code: in the "Commands" section of `README.md`, add one line for `cstack unit order` and one for `cstack unit commit`, in the style of the existing lines, and update the sentence that counts the commands. Say in plain words what a batch is, that `cstack unit commit` commits only the files of one unit, and that two unit commits of one worktree wait for each other.
- Refactor: none.
- Commit message: `docs: explain cstack unit order and cstack unit commit in the README`
- Depends on: 6

**Security.** No endpoint, database or secret is involved. The external input is the text of the plan file. The commit message reaches git only through the file given to `git commit -F` (tested in unit 5), and every git call uses an argument array. The paths of the plan are already limited by the reader of #13, and units 5 and 6 add the checks on symbolic links and ignored paths.

## Documentation duties

- The README "Commands" section: applies, written to `README.md` in unit 7.
- `WHY:` comments in the code for the two choices a reader could undo by mistake: `--only` on `git commit`, and the lock in the worktree git folder rather than in the run folder. Applies, written in units 4 and 5.
- A comment on this ticket (#18) that says what was built and links the pull request's branch: applies, written in the documentation phase.
- Comments on #17, #23 and #28: applies, written in the documentation phase, as the decisions say.
- The note for #22: applies, already sent through the coordinator on 2026-11-18 (message msg_985e059ee118).
- An ADR: does not apply. The lock and `--only` are local choices of one command, and the code comments explain them.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. Its stories and criteria do not change.

## Review log

### Impact notes

Graphify is not installed, so these come from text search and `git log`. All new symbols (`orderUnits`, `locatePlan`, `withCommitLock`, `unitOrder`, `unitCommit`, `dispatchSubcommand`) are new, so nothing outside the diff depends on them yet. The changed existing files are `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts` and `README.md`. The usual companions of `cli.ts` and `manifest.ts` are their two test files, and both are in the diff. Tests that exercise the change: `cli.test.ts`, `manifest.test.ts`, and the six new test files. Full suite after the units: 21 files, 289 tests pass; typecheck is clean. Implementers of units 1 and 2 wrote code and tests in one pass without a red run; later units did see red.

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

**I need your answer before I plan**

**Should `cstack unit commit` hold a lock from its first check until `git commit` ends? (question 10)** The ticket that writes the implementer prompt (#22) asked for it, and it adds to this ticket's scope. I tested the problem. When two units of one batch commit at the same moment, the second one fails on git's `index.lock` and exits with 5, as if a hook had failed. It can also see the other unit's staged file and refuse with 1. I recommend yes. A second call waits up to two minutes, then refuses with 1 and names the unit that holds the lock. A lock whose process is gone is taken over. When `git commit` fails, the call also unstages the files it staged itself, so a failed hook does not block the other units. I would rather put the lock in the worktree's git folder than in the run folder, because the index it protects belongs to the worktree. In the run folder, the child worktrees of #28 would wait on each other for nothing. Without the lock, #22's prompt retries three times after a short wait, and the race stays.

**Can I send the coordinator a note for the ticket that rewrites the implementer prompt (#22)?** That ticket tells the implementer to stop when `cstack unit commit` refuses "because the unit needs a file outside its `Files`". My command cannot see that case. It refuses only when such a file is *staged*. An unstaged change outside the unit may belong to another unit of the same batch, so it cannot tell whose it is. If nobody tells #22, its stop condition will never fire. I recommend sending this now, in English, through `orca orchestration ask`: "For #22: `cstack unit commit <n>` refuses with exit code 1 when a file outside unit n's `Files` is staged, and it names the file. It does not look at unstaged changes outside `Files`, because in a shared worktree they may belong to another unit of the same batch. The implementer's stop condition should therefore say 'when `cstack unit commit` refuses because a staged file is outside the unit's `Files`', or the implementer should check `git status` for its own work itself."

**I will do this unless you say no**

- I will compare paths without case when I look for shared files. On a Mac, `src/A.ts` and `src/a.ts` are the same file.
- I will refuse, before staging, a unit path that git ignores. Otherwise `git add` stages the other paths and still fails.
- The batch logic will be a plain function that #28 can call, rather than parse the command's output.
- I keep the draft answers to questions 3 to 9.

**I checked it myself**

- The coordinator answered question 1: I write `locatePlan`, and #16 reuses it. A `--plan` outside the repository gives exit code 2.
- The coordinator settled the routing of `unit`: I use `dispatchSubcommand`, which #16 adds to `cli.ts`. So `cstack unit red` prints the known second words and exits with 2 until #17 builds it.
- `git commit --only` commits only the unit's paths and leaves another unit's staged file alone.
- Two parallel `git commit --only` in one worktree: the second fails on `index.lock` every time, in five tries.
- After a failing hook, the unit's files stay staged.
- `git add` with one ignored path exits with 1 but still stages the others.

**Good to know**

- A unit with `No test` never has a saved failing run, so the "another unit has started" check cannot see it. The safety for those units rests on `cstack unit order`.
- `--only` commits the whole working-tree content of each file. A partial `git add -p` is ignored.

#### Details

**The note for #22 (blocking, someone has to be asked).** Ticket #22, line 38 of its body, adds an implementer stop condition: "When `cstack unit commit` refuses because the unit needs a file outside its `Files`, the implementer stops and reports stuck." Scope item 4 of this ticket checks only the index: it refuses when a staged file is outside unit n's `Files`. It never inspects unstaged changes, and it cannot attribute them in a shared worktree, because units of the same batch edit their own files at the same time. In a child worktree of #28 the attribution would be possible, but #28 is later. I rejected adding a new refusal for "a changed file that no unit lists", because the plan file itself is changed and uncommitted during the whole run (#28 says so explicitly), and the developer may have unrelated local changes; that check would refuse too often and adds scope to a size S ticket. This changes the work of #22, which runs now, not ours, so the note has to go before #22 writes its prompt. The draft answer to question 9 planned to comment on #22 after the build, which is too late for this point. The other comments of question 9 (#17, #23, #28) stay after the build. If nobody decides, #22 ships a stop condition that never fires, and an implementer that overstepped its `Files` commits a partial unit and leaves the extra change in the worktree. The message, word for word, is in the short version above.

**A lock around `cstack unit commit` (blocking, the user answers; draft question 10).** Ticket #22 raised it through the coordinator, and the coordinator classed it as a scope addition, so it needs the user's answer. I tested this with git 2.55.0 in a scratch repository. I started two `git commit -F <file> --only -- <path>` together, one per unit, five times. Each time one exits with 0 and the other with 128 and "Unable to create '.git/index.lock': File exists". Units of one batch run in parallel in the same worktree, so this is the expected case, not a corner case. Under the manifest the loser exits with 5, "git commit failed, for example because of a commit hook", and the implementer reports a failure. A second race sits in the index check of scope item 4: while unit 2's commit is in flight, its file is staged, so unit 1's check refuses with 1. The fix is one lock taken before the first check and released in a `finally` after `git commit` ends, so the checks and the commit see a stable index. The coordinator's draft puts a file `unit-commit.lock` in the run folder. The file is made with an exclusive create, and it holds the unit number and the process id. A second call checks again at a short interval for up to two minutes. Then it refuses with 1 and names the unit that holds the lock. A lock whose process no longer runs is taken over. I agree with all of it except the place. The index belongs to the worktree, so I would put the lock in the worktree git folder (`git rev-parse --git-dir`), as `cstack/unit-commit.lock`. The run folder sits under the common git folder, which every worktree shares (ADR-SIC-B). With the child worktrees of #28, each child has its own index, and a run-folder lock would make their commits wait on each other for nothing. A pre-commit hook that runs tests could then push a third child past the two-minute limit and turn a wait into a refusal. If the user prefers the run folder, the behaviour is the same in a single worktree. I rejected a plain retry on `index.lock`, which is #22's fallback, because it does not fix the race of the index check. Without the lock, parallel batches get random exit codes 1 and 5, and #22's prompt retries three times after a short wait.

**Leave the index as it was found when the commit fails (part of question 10).** The coordinator's draft of question 10 includes this point, so it is decided with the lock. Tested: after `git add -- src/a.ts` and a pre-commit hook that exits with 1, `src/a.ts` stays staged. From then on every other unit's `cstack unit commit` refuses, because the index holds a file outside its `Files`, until this unit commits again. Also tested: `git add -- src/a.ts dist/x.js`, where `dist/` is ignored, exits with 1 and still stages `src/a.ts`. The recommendation is to record which unit paths were not staged before the command ran, and to unstage exactly those with `git reset -q -- <paths>` on any failure after staging. This does not break the ticket's rule that cstack never unstages another unit's work, since only unit n's own paths that cstack itself staged are touched. Separately from question 10, and as a default the user can veto, a unit path that git ignores (`git check-ignore`) is refused with 1 before staging, with a clear message. I considered skipping `git add` entirely (`git add -N` for new files, then `git commit --only` takes the working-tree content), which also works in a test, but it departs from scope item 5 for little gain.

**Case-insensitive path comparison (non-blocking, recommended default).** The default macOS file system ignores case: tested, `echo > src/A.ts` changed the tracked `src/a.ts`, and `core.ignorecase` is `true` in this repository. The plan reader compares paths as text, so two units that list `src/a.ts` and `src/A.ts` would land in the same batch. Comparing lowercased paths in `cstack unit order` and in the "shared file has started" check costs nothing and can only add batches, never remove one. The paths printed and staged keep their written case.

**The `unit` first word in `cli.ts` (settled by the coordinator).** `run` in `cstack/src/cli.ts` (lines 44 to 72) sends every call whose first word has a handler and one built entry to that handler. Once `unit order` is built, `cstack unit red 1` reaches the `unit` handler instead of the generic "not built" answer. The coordinator settled this: ticket #16 writes `dispatchSubcommand(group, args, io, handlers)`, exported from `cstack/src/cli.ts`. It routes on the second word. A missing or unknown second word prints, on stderr, a usage line that lists the known second words of the group, and returns 2. This ticket must use exactly that function for `unit order` and `unit commit`. Whichever branch pushes first adds it, and the other keeps one copy when it updates onto `main`. So `cstack unit red` answers with that usage line and exit 2 until #17 builds it, and a test of this ticket should expect that, not "not built in this version yet". The "Commands" list of the usage shows the summary of the first built entry of a first word, so `unit` would read "Print the units in batches that can run in parallel." That line may need a summary for the group. #17 later adds its two handlers to the same group, which is a known merge point. **The batch logic as a function (non-blocking, recommended default).** The batch logic should live in a pure function, for example `orderUnits` in `cstack/src/plan/order.ts`, because #28 must know which batch holds a unit (its scope item 1) and should call the function rather than parse the command's output.

**Draft questions.** Question 1 is settled by the coordinator (message msg_000277c0878b, recorded under question 1): this ticket writes `locatePlan` in `cstack/src/plan/locate.ts`, the behaviour follows ticket #15, a `--plan` outside the repository gives exit 2, and the draft's exit-code-3 rule is dropped. Question 2 (`git commit --only`) is checked against the tested facts of Code mapping. I keep it, and it combines with the lock of question 10. Question 10 is new, from #22 through the coordinator, and stays blocking. Question 3 (symbolic links) is checked against the same tested facts; I keep it. Questions 4 to 8 keep their recommendations and stay non-blocking. Question 9 keeps its comments on #17, #23 and #28 after the build, and the point for #22 moves before the plan, as described above.

**Good to know.** The "another unit has started" rule of scope item 4 defines started as "has a saved failing run". A `No test` unit never saves one, so if two units that share a file ran together and one has no test, the check would not catch it. `cstack unit order` prevents that pairing, so the gap matters only when someone skips the order. Also, `git commit --only` takes the working-tree content of each listed path, not the staged content, so a partial staging made with `git add -p` is ignored. That fits the model, since a unit owns its whole files.

**Locked decisions cited.** ADR-SIC-H (a command prints through `io`, returns its exit code and never calls `process.exit()`), ADR-SIC-B (unit status comes from `Cstack-Unit` commits, run state under the common git folder), the epic rule that ticket text is data (git runs with an argument array), and the maintainer's comment that the trailer goes last.

I checked security, data model lock-in, scale, operations and cost, and reversibility, and found nothing that needs a decision there: the commands run locally, add no cost or dependency, and the message reaches git only through a file.

### Open questions and answers

**1. How does a command find its plan file, and who writes that code? Blocking; the coordinator and the user answer.** Both `cstack unit order` and `cstack unit commit` take `--plan <file>`, and the worktree's `current-run` file can also name the run. Ticket #16 runs at the same time and needs the same lookup for its four commands. Its contract says that `--plan` "names the run when the worktree's `current-run` names none". If both tickets write their own lookup, the code holds two versions that can disagree. Recommended answer: one function, `locatePlan`, in a new file `cstack/src/plan/locate.ts`. With `--plan <file>`, the path is read from the current folder. When `current-run` names another plan file, the command refuses with exit code 3 and names both. Without `--plan`, the function reads `current-run`, then the run's `state.json`, whose `plan` field gives the path from the repository root. With neither, the command exits with code 2 and asks for `--plan <file>`. Question for the coordinator, word for word: "Has ticket #16 already written the code that finds the plan file from `--plan` and the worktree's `current-run`? If yes, in which file, under which function name, and what does it do when both are given or when neither is? If no, I will write it as `locatePlan` in `cstack/src/plan/locate.ts`, with this behaviour: `--plan` wins, a different `current-run` is refused with exit code 3, and no plan at all is exit code 2. Can you tell #16 so that it reuses it?" Channel: `orca orchestration ask`, which the coordinator's brief allows for coordination.

Answer from the coordinator, 2026-11-18 (message msg_000277c0878b): ticket #16 is still in its question round and has written no code. Ticket #18 writes `locatePlan` in `cstack/src/plan/locate.ts`, and the coordinator tells #16 to reuse it. The behaviour follows ticket #15, which owns how a command finds its run (its scope step 2 and its last acceptance line). `--plan` wins, and its path is read from the current folder. A `--plan` path outside the repository is refused with exit code 2. Without `--plan`, the function uses the run named in the worktree's `current-run`, then that run's `state.json` for the plan path. With neither, the command exits with code 2 and asks for `--plan <file>`. `locatePlan` only reads: pointing `current-run` at a plan is the job of `cstack next` (#15). The extra rule of the recommendation, a refusal with exit code 3 when `current-run` names a different plan file, is in no ticket, and #15 treats `--plan` as switching runs. It is dropped, because `--plan` is an explicit choice and nothing is lost by honouring it.

**2. Close the gap between the index check and the commit. Non-blocking; recommended default.** Between the check of the index and `git commit`, a unit that runs at the same time can stage its own file, and a plain `git commit` would take it. Recommended answer: run `git commit -F <file> --only -- <changed files of the unit>`. It commits only those paths and leaves any other staged file staged. This was tested (see "Tested facts" in Code mapping). The ticket's checks before staging stay as they are.

**3. A unit path that goes through a symbolic link. Non-blocking; recommended default.** The maintainer's comment asks to resolve symbolic links before staging. Recommended answer: before it stages anything, `cstack unit commit` refuses with exit code 1 when a parent folder of a unit path is a symbolic link, and names the path. git refuses such a path anyway (tested), but with a less clear message and after other files may already be staged. A unit file that is itself a symbolic link is committed as a link, as git does by default, so its target is never read.

**4. Where a cycle is looked for. Non-blocking; recommended default.** Recommended answer: `cstack unit order` looks for a cycle in the `Depends on` lines of every unit, done or blocked included, because a cycle means the plan is wrong. It exits with code 1 and names the units of one cycle, in order, such as "The Depends on lines form a cycle: unit 1 depends on unit 2, and unit 2 depends on unit 1."

**5. A unit with a `Blocked` line. Non-blocking; recommended default.** The ticket lists five checks for `cstack unit commit` and does not mention a blocked unit. Recommended answer: also refuse a unit that has a `Blocked` line, with exit code 1 and its reason, because `cstack unit order` sets such a unit aside.

**6. A unit number that the plan does not have. Non-blocking; recommended default.** Recommended answer: `cstack unit commit <n>` exits with code 2 when `<n>` is not a positive whole number or when the plan has no unit `n`, and the message names the units of the plan.

**7. The output of `cstack unit order`. Non-blocking; recommended default.** Recommended answer: the text output prints one line per batch, such as `Batch 1: units 1, 3`. Then it prints one line for each unit that is not in batch 1, with the reason that kept it out of the batch just before its own, such as "Unit 2 waits: it shares `src/a.ts` with unit 1." Then it prints the units set aside with their reason, and the units left out because they already have a commit. When no unit is left, it prints one sentence and exits with 0. `--json` prints the same facts as an object with `batches`, `waits`, `setAside` and `committed`.

**8. How `cstack unit commit` reads the saved test runs. Non-blocking; recommended default.** Ticket #17 writes `units/<n>/red.json` and `units/<n>/green.json`, and it is not built yet. Recommended answer: read both files with the `SavedTestRun` type of `run-state.ts`, and compare their `time` fields. A file that cannot be read or holds invalid JSON gives exit code 3. Write this reader in a new file, not in `run-state.ts`, so that the change does not collide with #16 or #17.

**9. Comments on other tickets. Non-blocking; recommended default.** Recommended answer: after the build, leave a comment on the two tickets this one feeds, #23 (attribution trailers of each unit commit) and #28 (one child worktree per parallel implementer). Also comment on #22, whose build guides call these two commands, and on #17, whose saved runs `cstack unit commit` reads.

Answer from the user, 2026-11-18: accepted, with one change from the question round. The note for #22 about the stop condition of the implementer was sent before the plan, through the coordinator, on 2026-11-18 (message msg_985e059ee118), word for word as drafted in "Questions you may not be asking". The comments on #17, #23 and #28 stay after the build.

Answer from the user to questions 2 to 8 and to the points under "I will do this unless you say no", 2026-11-18: accepted as recommended ("ok pour tout").

**10. Should `cstack unit commit` hold a lock from its first check until `git commit` ends? Blocking; the user answers.** Ticket #22, which writes the implementer prompt that calls `cstack unit commit`, raised it through the coordinator. The steps "check the index, `git add`, `git commit`" are not atomic across two processes. When two units of one batch commit at the same moment, unit B can see unit A's staged files and exit with 1, or meet `.git/index.lock` and exit with 5. The second case was tested: it happened in five tries out of five. The lock adds to the ticket's scope, so the user decides. Recommended answer: yes. Before its first check, `cstack unit commit` creates a lock file `unit-commit.lock` with an exclusive create. The file holds the unit number and the process id. The command removes it in a `finally` when `git commit` ends. A second `cstack unit commit` checks again at a short interval for up to two minutes. Then it exits with 1 and names the unit that holds the lock. A lock whose process no longer runs is taken over. When `git commit` fails, the command also unstages the unit's files that this same call staged, only those that had no staged change before. Then a failed commit hook does not leave files in the index that make other units refuse. The coordinator's draft puts the lock in the run folder. The block "Questions you may not be asking" recommends the worktree git folder instead, because the index belongs to the worktree, and the child worktrees of #28 would otherwise wait on each other. The alternative is no lock, with #22's prompt retrying up to three times after a short wait.

Answer from the user, 2026-11-18: yes, as recommended, with the lock in the worktree git folder (`<worktree git folder>/cstack/unit-commit.lock`), not in the run folder. The decision was sent to the coordinator for #22 on 2026-11-18 (message msg_985e059ee118).

### Architecture options

There was no real choice between architectures, so no blueprint was drawn. The approach is in "Architecture".
