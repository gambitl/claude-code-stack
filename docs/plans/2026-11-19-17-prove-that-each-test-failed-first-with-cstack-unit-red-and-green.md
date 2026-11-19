# Plan: #17 — M2-5: Prove that each test failed first with cstack unit red and green

Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/17
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in `docs/projects/`), ADRs in `docs/decisions/`
Branch: gambitl/unit-red-green
Conversation language: French; the conversation uses it, and every record stays in English
Status: ready for review

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** `cstack` keeps proof that each test failed before its code was written, and it refuses the code of a piece of work that has no such proof.

- **What the title means**: A unit is one small piece of work in the plan, with its own test and its own commit. A test is a small program that checks that the code does what it should. "Failed first" is the test-first rule: you write the test, you see it fail because the code does not exist yet, and only then you write the code. `cstack unit red <n>` runs the test of unit `n` and saves the failing result, which developers call "red". `cstack unit green <n>` runs it again once the code exists, and saves the passing result, which developers call "green".
- **Why we are doing it**: The skill already asks for a failing test first, but nothing records it. The retrospectives of past runs show tests that were never seen failing before their code was written. Such a test may pass whatever the code does, so it proves nothing.
- **For the user**: A solution engineer gets tests that really check the new code. A reviewer can see, for every unit, the saved output of its failing run.

**Goal.** This ticket delivers `cstack unit red <n>` and `cstack unit green <n>`, which record the failing run and then the passing run of each unit, and the "no test" rule (US-8 AC1 to AC3). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #13 adds the plan file reader and the run state, and #14 adds the settings reader. None of them is in the repository yet.
* **Test-first today**: `skills/resolve-issue/agents/implementer.md` (line 23): the implementer writes the failing test, runs it, and sees it fail for the reason the unit expects. Line 24 then writes the minimum code and runs the test again, and line 33 runs the tests once more after the refactor. Nothing keeps a trace of the failing run.
* **The rule in the main skill**: `skills/resolve-issue/SKILL.md` (line 141): "Every new function, route or component starts with a failing test." The plan template has a "Failing test" line per unit, in `skills/resolve-issue/templates/plan.md` (line 40).
* **Test commands today**: `skills/resolve-issue/agents/implementer.md` (line 16) takes the test commands from the conventions file, which is prose. The settings file of #14 now holds them.
* **Specification**: `docs/projects/skills-into-cli.md` (line 15) names the problem of a test never seen failing. Lines 127 to 129 hold the three criteria of US-8. Line 311 keeps the default for units without a test: the plan marks them "no test" with a reason.
* **Contract**: from #13 and #14. A unit has either a line `- Test:` with one test file path in backticks, or a line `- No test: <reason>`. The reader of #13 refuses a unit with neither line, or with an empty reason, and the command then exits with `3`. A saved run goes into the run folder as `units/<n>/red.json` with `red.log`, or `units/<n>/green.json` with `green.log`. It holds the time, the command, the exit code, the commit and the test file. The commands are `cstack unit red <n> [--timeout <minutes>]` and `cstack unit green <n> [--timeout <minutes>]`, and each also takes `--plan <file>`. `cstack unit red` exits with `1` when the test passes or the unit has no test. `cstack unit green` exits with `1` when no failing run is saved or the test still fails. Both exit with `5` when the test command cannot start or runs past the timeout, and with `3` on an invalid plan file or settings file. The settings reader `cstack/src/settings.ts` of #14 gives `testCommands.all` and the optional `testCommands.file`, which holds the placeholder `{file}`. When `testCommands` is missing, a command that runs tests exits with `3` and names `testCommands.all`.

## Scope

1. Build `cstack unit red` in `cstack/src/commands/unit-red.ts` and `cstack unit green` in `cstack/src/commands/unit-green.ts`. Put the code that builds and runs a test command in one shared file, `cstack/src/test-run.ts`.
2. Build the test command of a unit. When `testCommands.file` is set and the unit has a `Test` line, use `testCommands.file`, with `{file}` replaced by the four characters `"$1"`. Otherwise use `testCommands.all`.
3. Run the command as `/bin/sh -c <script> cstack <test file>`, from the root of the repository, without any other shell. The test file path is then the first argument of the script, and it never becomes part of the script text. Capture standard output and standard error together. Stop the command at the timeout, which is ten minutes unless `--timeout` says otherwise.
4. `cstack unit red <n>` requires a failure.
   - When the unit has a `No test` line, exit with `1`. The message says that the unit has no test, gives its reason, and says to commit it directly.
   - When the test passes, exit with `1` and save nothing. The message says that a passing test proves nothing yet, and that the test must fail before the code exists.
   - When the shell returns `126` or `127`, the command could not start. Exit with `5` and save nothing, because that is not a failing test. Do the same at the timeout.
   - On any other failure, save `units/<n>/red.json` and `units/<n>/red.log`. Print the last 40 lines of the output and one line that says the failing run is saved. Exit with `0`.
5. A new failing run of a unit replaces the older one, and it deletes the passing run of that unit, if there is one. The passing run must always come after the failing run.
6. `cstack unit green <n>` requires a saved failing run first.
   - When the unit has no saved failing run, exit with `1` and save nothing (US-8 AC2). The message says to write the test, run `cstack unit red <n>`, and only then write the code.
   - When the unit has a `No test` line, exit with `1` with the same message as in step 4.
   - Otherwise, run the same test command. When it passes, save `units/<n>/green.json` and `units/<n>/green.log`, and exit with `0`. When it still fails, print the last 40 lines and exit with `1`, saving nothing. Exit with `5` in the same cases as in step 4.
7. Record in each saved run the current commit from `git rev-parse HEAD`, the command, the test file, the exit code and the time. Keep at most the last megabyte of output in the log file.
8. Write each file whole, through a temporary file and a rename, as the run state of #13 says. Two units that run their tests at the same time then never lose a saved run.

## Acceptance (TDD)

* `cstack/test/unit-red-green.test.ts`: write first the case of `cstack unit green 1` on a unit that has no saved failing run. It must exit with `1`, the message must say to run `cstack unit red 1` first, and nothing may be saved (US-8 AC2).
* `cstack/test/unit-red-green.test.ts`: in a temporary repository with a settings file, `cstack unit red 1` on a test that fails exits with `0`. It saves `red.json` and `red.log` with the output, the exit code, the command and the commit (US-8 AC1). On a test that passes, it exits with `1` and saves nothing. On a test command that does not exist, the shell returns `127`, and cstack exits with `5` and saves nothing.
* `cstack/test/unit-red-green.test.ts`: after a saved failing run, `cstack unit green 1` exits with `0` and saves `green.json` once the test passes. While the test still fails, it exits with `1` and saves nothing. A new `cstack unit red 1` after a green run deletes that green run.
* `cstack/test/unit-red-green.test.ts`: a unit with `- No test: documentation only` makes `cstack unit red` exit with `1` and give the reason (US-8 AC3). A unit with neither a `Test` line nor a `No test` line makes both commands exit with `3` and name the unit. So does a `No test` line with an empty reason.
* `cstack/test/unit-red-green.test.ts`: with `testCommands.file` set, the test command receives the unit's test file as its first argument. Without `testCommands.file`, `testCommands.all` runs. Without `testCommands`, both commands exit with `3` and name `testCommands.all`. A test that runs past `--timeout` makes the command exit with `5`.
* `cstack/test/unit-red-green.test.ts`: two units run `cstack unit red` at the same time, and both failing runs are saved.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* For any test file path, the script that cstack hands to `/bin/sh -c` equals the settings command with `{file}` replaced by `"$1"`. The path appears only in the argument list, never in the script text. The reader of #13 already refuses a path with `$`, `;`, a quote or a space, and this test proves the second line of defence.

**Size: M** · Blocked by: #13, #14 · Feeds: #23


### Ticket comments

Comment by the maintainer, 2026-11-18 (https://github.com/gambitl/claude-code-stack/issues/17#issuecomment-6974091983):

> Ticket #14 adds `readSettings(root)` in `cstack/src/settings.ts`. It reads `<root>/.cstack/settings.json` and never runs a command. Your command finds the root with `git rev-parse --show-toplevel`.
>
> `testCommands` is an object. `all` is the command that runs the whole suite. `file` is optional, and it holds the placeholder `{file}` exactly once. The reader refuses a `file` without the placeholder, an `all` that contains it, and a command whose first word is in `forbiddenTools`.
>
> When `testCommands` is missing, the result has no value for it. Your command should then exit with code 3 and name `testCommands.all`.
>
> The test commands are code of the repository, like a script in `package.json`. Run them through `/bin/sh -c`. Never replace `{file}` with a path. Replace it with `"$1"` and pass the path as a separate argument.
>
> One warning: the reader reads the file as it is on disk. A build that edits `.cstack/settings.json` can change the test commands and defeat the red-then-green proof. Consider refusing a run whose diff touches that file, or reading the copy on the target branch.
>

Comment by the maintainer, 2026-11-18 (https://github.com/gambitl/claude-code-stack/issues/17#issuecomment-6974361273):

> Ticket #13 fixed the plan lines and the saved run shape that you use. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.
>
> A unit in the plan has a `- Files:` line, then either `- Test: `<test file>`: <failing case>` or `- No test: <reason>`. `readPlan` in `cstack/src/plan/read.ts` returns both, and it guarantees that the test file is also in `Files`. A unit path is checked as text only: it never starts with `/` or `-`, has no `..` part, no `.git` part, and only safe characters. It cannot see symbolic links, so before you run or write a file from a unit path, resolve its real path and check that it stays inside the work tree.
>
> Use the types in `cstack/src/run-state.ts` for the saved runs: `units/<n>/red.json` with `red.log`, and `units/<n>/green.json` with `green.log`. A saved run has its time, command, exit code, commit and test file. The run folder is shared by every worktree of the repository, so a test run saved in a child worktree is visible from the ticket's worktree. The exit codes of `cstack unit red` and `cstack unit green` are in `cstack/src/manifest.ts`.
>

Comment by the maintainer, 2026-11-18 (https://github.com/gambitl/claude-code-stack/issues/17#issuecomment-6978725728):

> Ticket #18 (`cstack unit commit`) reads the files you will write, so their format matters. It uses `readSavedRun` in `cstack/src/saved-runs.ts`, which reads `units/<n>/red.json` and `units/<n>/green.json` from the run folder and compares their `time` fields as dates. A file that cannot be read, is not valid JSON, or has no valid `time` makes `cstack unit commit` exit with 3.
>
> A unit with a `Test` line is accepted when its passing run is newer than its failing run. It is also accepted when only `green.json` exists, because the commit command does not require a failing run. The specification says that `cstack unit green` must refuse a unit without a saved failing run, so that check has to be in your command. The commit command is not a second guard.
>
> The commit command also uses `red.json` as the sign that a unit has started. If another unit shares a file with the unit being committed, and it has a `red.json` but no commit, the commit is refused. Please keep deleting `green.json` when a new `red.json` is saved, as your scope says, so the two files always tell the true order.
>


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

- [ADR-SIC-B: Where the run state lives and how its formats are versioned](../decisions/ADR-SIC-B-run-state.md). The run state lives under the common git folder, so every worktree of the repository sees the same run. Each unit saves its test runs in its own folder, and test output never enters the repository.
- [ADR-SIC-C: How cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md).
- [ADR-SIC-D: The settings file and the models of the agents](../decisions/ADR-SIC-D-settings-file-and-review-model.md). The settings file `.cstack/settings.json` holds the test commands.
- [ADR-SIC-E: The new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final`.
- [ADR-SIC-H: How a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md). A command prints through `io`, returns its exit code, and never calls `process.exit()`.

Rules from the coordinator of this wave (wave of #15, #17, #19, #20 and #24, which run at the same time):

- Every ticket of the wave touches `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/src/cli.ts`, and any of them may touch `README.md` and `docs/projects/skills-into-cli.md`. Changes to those shared files stay small and in their own place.
- A helper that reads or writes a file of the run folder goes into a new file of this ticket, never into `cstack/src/run-state.ts`.
- When another ticket of the wave merges first, `origin/main` comes into this branch with a merge commit that keeps both changes. The counts of built and not-built commands in `cstack/test/manifest.test.ts` and `README.md` are then updated, and the whole test suite runs again. A merge can silently keep two definitions of the same function in `cli.ts`, so that file is checked after each merge.
- Nothing under `skills/` is edited. New skill files go under `cstack/skills/` and `cstack/guides/`.
- When the branch is updated onto `main`, the author dates of its commits stay as they are: never `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. No tag that starts with `v` is pushed.
- Ticket #17 owns `cstack/src/test-run.ts`. Ticket #20 runs the tests after it updates the branch, and it codes against the same interface, fixed by the coordinator:

```ts
import type { TestCommands } from "./settings.js";

/** Ten minutes, the default timeout of a test run. */
export const DEFAULT_TEST_TIMEOUT_MS = 600_000;

export interface TestRun {
  /** The script given to `/bin/sh -c`. */
  script: string;
  /** The exit code of `/bin/sh`. It is undefined when the run was stopped at the timeout. */
  exitCode: number | undefined;
  timedOut: boolean;
  /** Standard output and standard error together, in the order they were written. */
  output: string;
}

/** `testCommands.file` with `{file}` replaced by `"$1"` when it is set and `testFile` is given. Otherwise `testCommands.all`. */
export function testScript(commands: TestCommands, testFile?: string): string;

/** Runs `/bin/sh -c <script> cstack [testFile]` from `root`, with no other shell, and waits until it ends or times out. */
export function runTests(root: string, script: string, testFile: string | undefined, timeoutMs?: number): TestRun;

/** The last `count` lines of the output, 40 by default. */
export function lastLines(output: string, count?: number): string;
```

  The coordinator changed one line of this interface on 2026-11-19 (message `msg_5642a1c6daa3`): `runTests` is asynchronous and returns `Promise<TestRun>`. The rest of the interface stays as above. The reason is that the tests run in their own process group, so that the timeout can stop every process of the tests. A Ctrl-C on cstack then no longer reaches the tests, and only an asynchronous cstack can catch the signal. `runTests` starts the shell in its own process group. At the timeout, it kills the whole group. While the tests run, it also catches SIGINT and SIGTERM: it kills the whole group, then lets cstack exit. Ticket #17 writes this behaviour and tests it. Ticket #20 keeps the same signature in its temporary copy.

  Exit code 126 or 127 from the shell means that the command could not start; #17 turns that case and the timeout into its exit code `5`.
- The coordinator added a rule on 2026-11-19 (message `msg_2f6e0ceff93c`). `cstack/src/test-run.ts` is the one place in cstack where a shell runs on purpose, because the script is the user's own `testCommands` value. Every other program, git included, runs without a shell, with a program name and a list of arguments. Ticket #24 adds a test that refuses a shell in every other file of `cstack/src/`, and that test names `test-run.ts` as the one allowed file. In #20, any run that does not exit with `0` counts as failing tests. Ticket #20 writes a temporary copy of this file with the same exports. Whichever branch merges second keeps the copy of #17, deletes the other, and runs the tests of both tickets against it.

## Dependencies

Dependencies: clear. Both blockers are closed as completed: #13 (the plan file format, the phase order and the command list) and #14 (the settings file reader). Their code is on `main`. Ticket #18 (`cstack unit commit`), which reads the saved runs, is closed too.

## Code mapping

Graphify is not installed on this machine, and the coordinator's brief forbids installing it. The code was mapped with text search and targeted reads. The user dropped Graphify from the new skills on 2026-11-19: #19 is closed, and #45 removes Graphify from cstack, its doctor check and its guides and prompts. This ticket does not touch them.

**Entry points.** `cstack/src/cli.ts` keeps the calls to the built commands in `HANDLERS`, keyed by the first word (lines 39 to 55). The `unit` handler (line 54) sends `order` and `commit` through `dispatchSubcommand`; `red` and `green` join it there. `run` only sends a first word to its handler when an entry of that word is built. `cstack/src/manifest.ts` already holds the entries `cstack unit red <n> [--timeout <minutes>]` (line 155) and `cstack unit green <n> [--timeout <minutes>]` (line 168), each with `--plan` and `--timeout`, exit codes 0, 1, 2, 3 and 5, files `unit-red.ts` and `unit-green.ts`, and `built: false`. `EXIT` in the same file gives 0 ok, 1 refused, 2 usage, 3 invalid input, 4 missing tool, 5 a tool failed.

**The most similar command.** `cstack/src/commands/unit-commit.ts` reads its arguments with `parseArgs`, accepts exactly one positional unit number, and answers a number that is not a unit of the plan with exit 2 and the list of units. It finds the plan with `locatePlan(cwd, --plan)` from `cstack/src/plan/locate.ts`, which returns the real worktree root (`git rev-parse --show-toplevel`), the plan path and its path from the root. It reads the plan with `readPlan`, and turns `PlanFormatError`, `RunStateError` and `PlanLocationError` into their exit codes. `cstack/src/commands/errors.ts` has `failWith(error, io, prefix)`, which prints those three errors (with the line of each plan problem) and returns their exit code. Neither helper knows `SettingsError`.

**The plan reader.** `readPlan` in `cstack/src/plan/read.ts` gives each unit `test?: { file, case }` or `noTest?: string`. It already refuses a unit with neither line, a `No test` line with an empty reason (rule "`- No test:` is empty."), and a test file that is not in `Files`. A unit path is checked as text only: ASCII letters, digits and `. _ - / @ +`, never a leading `/` or `-`, no `..` or `.git` part. Every problem raises `PlanFormatError` with exit code 3, with the problems listed one per line.

**The settings reader.** `readSettings(root)` in `cstack/src/settings.ts` reads `<root>/.cstack/settings.json`. A missing file gives `found: false` and `values.testCommands === undefined`. An invalid file raises `SettingsError`, whose `problems` name each bad key; it has no `exitCode` field. `TestCommands` is `{ all: string; file?: string }`. The reader already guarantees that `file` holds `{file}` exactly once, that `all` does not hold it, that no command has a control character, and that no command starts with a forbidden tool.

**The run state.** `cstack/src/run-state.ts` gives `runFolder(cwd, planFile)`, which is `<common git folder>/cstack/runs/<plan file name without .md>`, the same folder for every worktree. `writeFileAtomic(path, content)` writes through `<path>.<pid>.tmp` and a rename, and creates the folder. The type `SavedTestRun` is `{ time, command, exitCode, commit, testFile }`. `cstack/src/saved-runs.ts` has `readSavedRun(runDir, unit, "red" | "green")`, which returns undefined when the file is missing and raises `RunStateError` when it cannot be read, is not JSON or has no valid `time`.

**Readers of the saved runs.** `cstack unit commit` (`unit-commit.ts`, lines 62 to 68) accepts a unit with a `Test` line only when `green.json` exists and, when `red.json` exists, is newer than it, comparing `time` with `Date.parse`. It also treats `red.json` as the sign that a unit has started (lines 81 to 87). `cstack/src/report/reports.ts` (line 117) refuses an implementer's done report when the unit has a `Test` line and no `red.json`. `cstack/src/commands/plan-status.ts` (lines 55 and 56) shows whether `red.json` and `green.json` exist.

**The guides and prompts that call the commands.** `cstack/skills/resolve-issue/agents/implementer.md` (lines 25, 26, 35 and 47) runs `cstack unit red <n> --plan <plan file>` after writing the test and `cstack unit green <n> --plan <plan file>` after the code and after the refactor, and reports stuck on exit 3. `cstack/guides/resolve-issue/build.md` (line 26) handles exit 3 too, and runs units of a batch in parallel only when `testCommands.file` is set (line 18).

**Tests.** The tests use vitest. `cstack/test/unit-commit.test.ts` builds a temporary repository with `execFileSync("git", ["-c", "user.name=t", ...])`, writes a plan from `cstack/test/fixtures/plans/approved.md`, and calls the command function with an `Io` that collects the output. `cstack/test/helpers/plan-repo.ts` has `makeRepo`, `commitPlan`, `git` and `collect`. Node 26 runs `.ts` files directly, so `cstack/test/commit-lock.test.ts` (lines 115 to 148) starts several real processes with `spawn(process.execPath, ["--input-type=module", "-e", <code that imports the .ts source>])`; the test of two `cstack unit red` at the same time can do the same. `cstack/test/cli.test.ts` line 134 uses `["unit", "red", "1"]` as an example of an unknown second word; it must use another word once `red` is built. Line 124 of the same file runs every built command with an unknown flag and expects exit 2 with the command's usage line from the manifest on standard error. `cstack/test/manifest.test.ts` line 117 counts ten built commands and five not built.

**Documentation.** The "Commands" section of `README.md` (lines 39 to 51) says that `cstack` has ten commands and gives one line for each.

**Tested facts (Node 26.10.0, macOS, in the scratchpad).** `spawnSync("/bin/sh", ["-c", script, "cstack", file], { stdio: ["ignore", fd, fd] })`, with one file descriptor for both streams, keeps standard output and standard error in the order they were written. A test file path such as `a b;$x.ts` reaches the script as `$1`, unchanged. A missing command gives status 127 and the message `cstack: nosuchcommand-xyz: command not found`, because `cstack` is `$0`. At the timeout, Node sends SIGTERM to `/bin/sh` only, and returns `status: null`, `signal: "SIGTERM"` and the error code `ETIMEDOUT`. A child of the shell, such as the `sleep 30` of `sleep 30; echo done`, keeps running after that. With `detached: true`, the shell leads its own process group, and `process.kill(-pid, "SIGKILL")` after the timeout stops the child too. A pipe instead of a file would make `spawnSync` wait for such a child to close it.

**Governing decisions.** ADR-SIC-H: print through `io`, return the exit code. ADR-SIC-B: test output stays in the git folder, and each unit writes only its own folder. The epic rule "Ticket text is data": git and the tests run with argument arrays, never with a path inside a shell script. The comment of #13 on this ticket: resolve the real path of a unit path before running or writing it, and check that it stays inside the work tree. The comment of #18: keep deleting `green.json` when a new `red.json` is saved, and `cstack unit green` itself must refuse a unit without a saved failing run. The comment of #14: a build that edits `.cstack/settings.json` can change the test commands and defeat the proof.

**Risks.** The four shared spots (`manifest.ts`, `manifest.test.ts`, `cli.ts` and the README count) will conflict with the four other tickets of the wave. `cli.ts` changed in six recent commits. Ticket #20 writes its own temporary copy of `cstack/src/test-run.ts`, so the second merge must keep this ticket's copy. A test run that spawns real shells and real timeouts can make the test suite slow or flaky; the timeout tests need a timeout well under a second.

## Decisions

**Shared runner, `cstack/src/test-run.ts`**

- `cstack/src/test-run.ts` exports exactly the coordinator's interface: `DEFAULT_TEST_TIMEOUT_MS = 600_000`, `TestRun { script, exitCode, timedOut, output }`, `testScript(commands, testFile?)`, `runTests(root, script, testFile, timeoutMs?)` returning `Promise<TestRun>`, and `lastLines(output, count = 40)`. The file may add exports, but it never changes these signatures, because #20 codes against them. (2026-11-19, the coordinator's interface and its change in message `msg_5642a1c6daa3`)
- `testScript` returns `testCommands.file` with `{file}` replaced by the four characters `"$1"` when `file` is set and a test file is given. Otherwise it returns `testCommands.all`. The test file path never appears in the script text. (2026-11-19, ticket scope 2)
- `runTests` starts `/bin/sh` with the arguments `-c`, the script, `cstack`, and then the test file when one is given. It runs from `root`, with `spawn` from `node:child_process`, never with `shell: true` and never through another shell. Standard input is `"ignore"`. (2026-11-19, ticket scope 3)
- `runTests` sends standard output and standard error to one temporary file, opened once and given as `stdio: ["ignore", fd, fd]`, so the output keeps the order in which it was written. The file lives in a folder made with `mkdtempSync` under `os.tmpdir()`, and that folder is deleted in a `finally` block. A pipe is not used, because a stray child of the shell would keep a pipe open. (2026-11-19, tested answer)
- `runTests` starts the shell with `detached: true`, so the shell leads its own process group. At the timeout, it kills the whole group with `process.kill(-pid, "SIGKILL")`, and the result has `timedOut: true` and `exitCode: undefined`. (2026-11-19, tested answer and the coordinator)
- Every `process.kill(-pid, …)` call first checks that `pid` is a whole number above 1. `process.kill(-0)` or a missing pid would kill the process group of cstack itself. A kill that fails with `ESRCH` is ignored, because the group may already be gone. (2026-11-19, assumption not asked)
- While the shell runs, `runTests` listens for SIGINT and SIGTERM. On either signal, it kills the whole group with SIGKILL, removes its own two listeners, and sends the same signal to its own process with `process.kill(process.pid, signal)`. cstack then ends the usual way for that signal, and nothing is saved. It never calls `process.exit()`. In every other case, the two listeners are removed once the shell ends. (2026-11-19, the coordinator, message `msg_5642a1c6daa3`)
- When the shell ends on a signal that is not the timeout, `exitCode` is 128 plus the signal number from `os.constants.signals`, and `timedOut` is `false`. The commands decide on a timeout from `timedOut`, never from `exitCode === undefined`. (2026-11-19, accepted by default)
- `output` keeps at most the last 1,048,576 bytes of the output, given by the exported constant `MAX_OUTPUT_BYTES`. `runTests` reads only that part of the temporary file. When the output is longer, the kept part starts just after the first line break inside that last megabyte. The doc comment of `output` says so. (2026-11-19, accepted by default)
- `lastLines` returns the last `count` lines of the output. A final line break does not count as an extra empty line. An output with fewer lines comes back whole. (2026-11-19, assumption not asked)

**Saved runs, `cstack/src/unit-test-runs.ts`**

- The code that writes into the run folder lives in the new file `cstack/src/unit-test-runs.ts`. `cstack/src/run-state.ts`, `cstack/src/saved-runs.ts` and `cstack/src/commands/errors.ts` are imported but never edited, because other tickets of the wave touch them. (2026-11-19, the coordinator)
- A saved run is JSON with six fields: `time`, `command`, `exitCode`, `commit`, `testFile` and `testFileSha256`. Its type extends `SavedTestRun` of `run-state.ts` with `testFileSha256: string`. (2026-11-19, ticket scope 7 and the user's answer)
- `command` holds the exact script handed to `/bin/sh -c`, with `"$1"` in it. `testFile` is the path of the unit's `Test` line, as the plan writes it. (2026-11-19, the user's answer)
- `time` is the end of the test run, from `new Date().toISOString()`. (2026-11-19, accepted by default)
- `commit` is the output of `git rev-parse HEAD`, read just before the test runs. Git runs with `spawnSync("git", [...])`, without a shell. When that git call fails, the command exits with 5 and saves nothing. (2026-11-19, ticket scope 7, accepted by default)
- `testFileSha256` is the hexadecimal SHA-256 of the test file content, read just before the test runs. (2026-11-19, the user's answer)
- The log file, `red.log` or `green.log`, holds the `output` of the run, which is at most the last megabyte. (2026-11-19, ticket scope 7)
- Every file of the run folder is written with `writeFileAtomic` from `run-state.ts`. Two units that run at the same time write into different `units/<n>/` folders, so neither loses its run. (2026-11-19, ticket scope 8)
- A saved failing run is written in this order: delete `green.json`, delete `green.log`, write `red.log`, then write `red.json` last. A saved passing run is written as `green.log`, then `green.json`. (2026-11-19, accepted by default, and the comment of #18)
- A red run that is refused, because the test passes, the command cannot start or the timeout is reached, saves nothing and deletes nothing. A passing run that already exists stays. (2026-11-19, accepted by default)
- `red.json` is read with `readSavedRun` from `saved-runs.ts`. A file that cannot be read makes the command exit with 3. (2026-11-19, assumption not asked)

**The two commands**

- `cstack unit red` lives in `cstack/src/commands/unit-red.ts` and `cstack unit green` in `cstack/src/commands/unit-green.ts`. The checks they share live in the new file `cstack/src/unit-test-command.ts`. (2026-11-19, ticket scope 1 and conventions)
- Each command prints through the `io` argument and returns its exit code. Its signature is `(args: string[], io: Io, cwd: string = process.cwd()) => Promise<number>`. (2026-11-19, ADR-SIC-H)
- The usage lines are `Usage: cstack unit red <n> [--timeout <minutes>] [--plan <file>]` and `Usage: cstack unit green <n> [--timeout <minutes>] [--plan <file>]`. A command line with no unit number, two unit numbers or an unknown flag exits with 2, with the usage line on standard error. (2026-11-19, `cstack/test/cli.test.ts` line 124)
- `--timeout` takes a positive number of minutes, decimals allowed, at most 1440. Anything else exits with 2. Without `--timeout`, the timeout is `DEFAULT_TEST_TIMEOUT_MS`. (2026-11-19, accepted by default)
- The plan is found with `locatePlan(cwd, --plan)` and read with `readPlan`. Their errors go through `failWith` of `cstack/src/commands/errors.ts`. An invalid plan, a unit with neither a `Test` line nor a `No test` line, and a `No test` line with an empty reason all exit with 3, and the printed problem names the unit. (2026-11-19, ticket contract)
- A number that is not a unit of the plan exits with 2 and lists the units of the plan, as `cstack unit commit` does. (2026-11-19, assumption not asked)
- `cstack unit red` checks in this order: the arguments, the plan, the unit, the `No test` line, the settings, the test file, the commit, then it runs the test. (2026-11-19, assumption not asked)
- `cstack unit green` checks in this order: the arguments, the plan, the unit, the `No test` line, the saved failing run, the settings, the test file, the same script and test file as the saved failing run, the commit, then it runs the test. (2026-11-19, the user's answer and the comment of #18)
- A unit with a `No test` line makes both commands exit with 1. The message names the unit, gives its reason, and says to commit it directly with `cstack unit commit <n>`. (2026-11-19, ticket scope 4)
- The settings come from `readSettings(root)`, where `root` is the worktree root that `locatePlan` returns. A `SettingsError` exits with 3 and prints one line per problem. That handling lives in this ticket's code, not in `errors.ts`. (2026-11-19, accepted by default)
- When `testCommands` is missing, both commands exit with 3. The message names `testCommands.all` and `.cstack/settings.json`. (2026-11-19, ticket contract)
- Before running anything, both commands resolve the real path of the test file under the worktree root. When the file does not exist, they exit with 1, name the file, and say to write the test first. When its real path is outside the worktree root, they exit with 1 and say that the path leads outside the work tree. (2026-11-19, accepted by default, and the comment of #13)
- The tests run from the worktree root that `locatePlan` returns. A child worktree that works on one unit runs its own code and saves into the run folder that every worktree shares. (2026-11-19, accepted by default)
- The commands work without a `state.json`. They create the `units/<n>/` folder when it is missing. (2026-11-19, accepted by default)
- `cstack unit red` ends as follows. A run that reached the timeout exits with 5, and the message gives the timeout in minutes. Exit code 126 or 127 exits with 5, and the message says that the test command could not start, with the code. Exit code 0 exits with 1, and the message says that a passing test proves nothing yet, and that the test must fail before the code exists. Any other exit code saves the failing run and exits with 0. (2026-11-19, ticket scope 4)
- When the settings have no `testCommands.file`, the success message of `cstack unit red` adds one line. It says that the whole test suite ran, and that you need to check in `red.log` that the test of this unit is the one that fails. (2026-11-19, accepted by default)
- `cstack unit green` ends as follows. With no saved failing run, it exits with 1 and saves nothing, and the message says to write the test, run `cstack unit red <n>`, and only then write the code. When its script or the unit's test file differs from `command` or `testFile` in `red.json`, it exits with 1, runs nothing and saves nothing. That message says that the test command changed since the failing run. It tells you to set the code aside, run `cstack unit red <n>` again, then bring the code back. A timeout, or exit code 126 or 127, exits with 5. Exit code 0 saves the passing run and exits with 0. Any other exit code exits with 1 and saves nothing. (2026-11-19, ticket scope 6 and the user's answer)
- When `cstack unit green` saves a passing run and `testFileSha256` differs from the one in `red.json`, it prints a warning on standard error. The warning says that the test file changed since the failing run, and the exit code stays 0. A `red.json` without `testFileSha256` gives no warning. (2026-11-19, the user's answer)
- Whenever the test ran, the last 40 lines of its output go to standard output. On exit 0, the verdict line goes to standard output too, and it names the saved file. Every refusal and error goes to standard error, with the prefix `cstack unit red: ` or `cstack unit green: `. (2026-11-19, accepted by default)
- Every program other than the `/bin/sh` of `test-run.ts` runs without a shell, with a program name and a list of arguments. (2026-11-19, the coordinator, message `msg_2f6e0ceff93c`)

**Shared files, documentation and limits**

- In `cstack/src/manifest.ts`, the entries `cstack unit red` and `cstack unit green` get `built: true` with the same pattern as `cstack unit commit`. The text of exit code 1 becomes "The test passes, the unit has no test, or its test file cannot be used." for red, and "No failing run is saved, the test command changed since it, or the test still fails." for green. Nothing else in that file changes. (2026-11-19, the coordinator)
- `cstack/src/cli.ts` adds `red` and `green` to the `unit` handlers of `HANDLERS`, next to `order` and `commit`, and nothing else. After any merge of `origin/main`, check that `cli.ts` holds one definition of each function. (2026-11-19, the coordinator)
- `cstack/test/manifest.test.ts` counts twelve built commands and three not built. After a merge of another ticket of the wave, the counts follow the merged list, and the whole suite runs again. (2026-11-19, the coordinator)
- `cstack/test/cli.test.ts` line 134 uses an unknown second word, such as `frobnicate`, instead of `red`, and the test expects `order`, `commit`, `red` and `green` in the message. (2026-11-19, code mapping)
- `cstack/skills/resolve-issue/agents/implementer.md` gets one sentence in step 4. It tells the implementer to run `cstack unit red` and `cstack unit green` with `--timeout 9`, in a shell call whose own timeout is ten minutes. cstack then stops the tests and saves its result before the shell tool of Claude Code stops cstack. The first `cstack unit red` of the file must stay before the first `cstack unit green`, which `cstack/test/prompts.test.ts` checks. (2026-11-19, the user's answer to the open question after the build, through the coordinator)
- Nothing under the top-level `skills/` folder is edited. Graphify code and `cstack graph ensure` are not touched, because #45 removes them. (2026-11-19, the coordinator)
- When #20 merges first with its own copy of `cstack/src/test-run.ts`, this branch keeps its own copy, deletes the other, and runs the tests of both tickets against it. (2026-11-19, the coordinator)
- `cstack skills install` never runs against the real home folder, and nothing under `~/.claude/skills/` changes. Tests use a temporary home folder. Nothing under `~/comparison/` is read or run. (2026-11-19, the coordinator)
- No text in the repository, a commit, the pull request or a ticket comment names an employer or a client, or quotes a ticket key from work. (2026-11-19, conventions file)
- Commits use Conventional Commits with the scopes of the conventions file, such as `feat(cli)`, `test(tests)` and `docs`. The author dates of the commits are never rewritten: never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. (2026-11-19, conventions file and the coordinator)
- The branch is brought up to date with `origin/main` through a merge commit that keeps both sides, never through a rebase. (2026-11-19, the coordinator)
- The git config of the repository sets `user.email` to the maintainer's GitHub no-reply address. Never change it, and never commit with another address. (2026-11-19, the coordinator)
- Before the push of phase 12, run two checks, and push only when both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>` from the repository root. It must exit with 0. It never prints a name, and nobody prints the private list. (2026-11-19, the coordinator)
- Never push a tag that starts with `v`. Never merge the pull request: the user merges it. (2026-11-19, the coordinator)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, the coordinator)

## Architecture

The approach is fixed by the ticket, the coordinator's interface and the answers of the question round. The shared runner `test-run.ts` comes first, in three steps: the pure functions, the run in its own process group, then the signal handling. The writer of saved runs is a separate small file. The two commands share their checks in `unit-test-command.ts`, and each command file only decides what its exit codes and saved files are. The registration in `cli.ts` and `manifest.ts` comes last, so the shared files change in one small commit. No new decision appeared since the question round.

## Implementation units

The test commands are `npm test` and `npm run typecheck`, run from `cstack/`. This repository has no `.cstack/settings.json`, so the implementers run the tests with npm, as the conventions file says. Units 1 and 4 can run in parallel. Units 2 and 3 follow unit 1. Unit 5 follows unit 1. Unit 6 follows units 3, 4 and 5, then units 7, 8 and 9 follow one after the other.

The tests of the commands build a temporary git repository, as `cstack/test/unit-commit.test.ts` does, with a plan file from `cstack/test/fixtures/plans/approved.md`, a `.cstack/settings.json` and small shell test files. A test file such as `test/one.sh` that runs `test -f src/feature.txt` fails before `src/feature.txt` exists and passes after, without any change to the test file.

### Unit 1: Build the test script and cut the output to its last lines — status: done
- Files: `cstack/src/test-run.ts`, `cstack/test/test-run.test.ts`
- Failing test: in `cstack/test/test-run.test.ts`, write first the case of `testScript({ all: "npm test", file: "npx vitest run {file}" }, "test/a.test.ts")`, which returns `npx vitest run "$1"`. Then: without `file` in the settings, or without a test file, it returns `testCommands.all`. For each path of a list that holds `a b;$x.ts`, `$(touch pwned).ts`, `it's.ts`, a path with backticks and `--help.ts`, the script equals the setting with `{file}` replaced by `"$1"`, and it never contains the path. `lastLines` of 50 lines returns the last 40. `lastLines(text, 3)` returns the last 3. A final line break does not count as a line. A text with fewer lines comes back whole.
- Minimum code: `DEFAULT_TEST_TIMEOUT_MS`, `TestRun`, `testScript` and `lastLines`, with the doc comments of the coordinator's interface. `runTests` comes in unit 2.
- Refactor: none expected.
- Commit message: `feat(cli): build the test script of a unit with the test file as its first argument`
- Depends on: none

### Unit 2: Run the tests in their own process group — status: done
- Files: `cstack/src/test-run.ts`, `cstack/test/test-run.test.ts`
- Failing test: in `cstack/test/test-run.test.ts`, write first the case of `runTests` in a temporary folder with the script `echo one; echo two >&2; echo three; printf '%s\n' "$1"` and the test file `a b;$x.ts`. The result has `exitCode` 0, `timedOut` false, the given `script`, and the output `one\ntwo\nthree\na b;$x.ts\n` in that order. Then: `pwd` prints the real path of the folder. `exit 3` gives 3. A command that does not exist gives 127. `cat` ends at once with 0, because standard input is closed. The script `sleep 30 & echo $! > pid; wait` with a timeout of 300 ms gives `timedOut` true and `exitCode` undefined within a few seconds, and soon after, the process whose id is in `pid` no longer runs (`process.kill(pid, 0)` throws `ESRCH`). `kill -TERM $$` gives 143 with `timedOut` false. An output of about three megabytes of short lines comes back with at most `MAX_OUTPUT_BYTES` bytes, ends with the last line, and starts at the beginning of a line.
- Minimum code: `MAX_OUTPUT_BYTES` and the asynchronous `runTests`, as the decisions on the shared runner say, without the signal listeners. Add `WHY:` comments for the process group, for the file instead of a pipe, and for `"$1"`.
- Refactor: none expected.
- Commit message: `feat(cli): run the tests of a unit in their own process group and stop them at the timeout`
- Depends on: 1

### Unit 3: Stop the tests when cstack is interrupted — status: done
- Files: `cstack/src/test-run.ts`, `cstack/test/test-run.test.ts`
- Failing test: in `cstack/test/test-run.test.ts`, write first the case of a child Node process. Start it with `spawn(process.execPath, ["--input-type=module", "-e", <code>])`, where the code imports `test-run.ts` by its URL and calls `runTests` with the script `sleep 30 & echo $! > pid; wait`, as `cstack/test/commit-lock.test.ts` (lines 115 to 148) does. Wait until the `pid` file exists, then send SIGINT to the child. The child ends with the signal `SIGINT`, and soon after, the `sleep` process no longer runs. Then: the same with SIGTERM. In the test process itself, `process.listenerCount("SIGINT")` and `process.listenerCount("SIGTERM")` are the same before and after a `runTests` that ends normally.
- Minimum code: the SIGINT and SIGTERM listeners of the decisions on the shared runner.
- Refactor: none expected.
- Commit message: `feat(cli): stop the whole test run when cstack is interrupted`
- Depends on: 2

### Unit 4: Save the failing run and the passing run of a unit — status: done
- Files: `cstack/src/unit-test-runs.ts`, `cstack/test/unit-test-runs.test.ts`
- Failing test: in `cstack/test/unit-test-runs.test.ts`, write first the case of a failing run saved into a temporary run folder that does not exist yet. `units/1/red.json` and `units/1/red.log` exist, the log holds the given output, and `readSavedRun(runDir, 1, "red")` returns all six fields. Then: saving a failing run when `green.json` and `green.log` exist deletes both. Saving a passing run keeps `red.json` and `red.log`. No `.tmp` file stays in the folder. Saving unit 2 does not touch the folder of unit 1.
- Minimum code: the saved run type and one function that saves a failing or a passing run of one unit, as the decisions on saved runs say.
- Refactor: none expected.
- Commit message: `feat(cli): save the failing run and the passing run of a unit in the run folder`
- Depends on: none

### Unit 5: Refuse cstack unit green without a saved failing run — status: done
- Files: `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/test/unit-red-green.test.ts`
- Failing test: in `cstack/test/unit-red-green.test.ts`, write first the case of `cstack unit green 1` on a unit with a `Test` line and no saved failing run, in a temporary repository with a settings file. It exits with 1, standard error says to run `cstack unit red 1` first, and the run folder holds no file for unit 1 (US-8 AC2). Then, for `cstack unit green`: a unit with `- No test: documentation only` exits with 1 and gives the reason. A plan whose unit has neither a `Test` line nor a `No test` line exits with 3 and names the unit, and so does a `No test` line with an empty reason. With a saved failing run, no settings file exits with 3 and names `testCommands.all`, and an invalid settings file exits with 3. Unit 9 of a plan without unit 9 exits with 2. `--timeout 0`, `--timeout abc` and `--timeout 1441` exit with 2. With a saved failing run, a missing test file exits with 1 and names it, and a test file that is a symbolic link to a file outside the repository exits with 1.
- Minimum code: the shared checks in `unit-test-command.ts`, and `unitGreen` with the refusals above. Running the test comes in unit 7.
- Refactor: none expected.
- Commit message: `feat(cli): refuse cstack unit green on a unit with no saved failing run`
- Depends on: 1

### Unit 6: Run cstack unit red and save the failing run — status: done
- Files: `cstack/src/commands/unit-red.ts`, `cstack/src/unit-test-command.ts`, `cstack/test/unit-red-green.test.ts`
- Failing test: in `cstack/test/unit-red-green.test.ts`, write first the case of `cstack unit red 1` on a test that fails, with `testCommands.file` set to `sh {file}`. It exits with 0. `red.json` holds the command `sh "$1"`, a non-zero exit code, the commit of `HEAD`, the test file, a time and the fingerprint. `red.log` holds the output of the test, and standard output holds its last lines and the line that says the run is saved (US-8 AC1). Then: a test that passes exits with 1, says that a passing test proves nothing yet, and saves nothing. A test command that does not exist exits with 5 and saves nothing. A test that runs past `--timeout 0.01` exits with 5 and saves nothing. A unit with `- No test: documentation only` exits with 1 and gives the reason (US-8 AC3). A unit with neither line exits with 3 and names the unit. Without `testCommands`, it exits with 3 and names `testCommands.all`. With `testCommands.file`, the test command receives the test file as `$1`. Without it, `testCommands.all` runs, and standard output says that the whole suite ran. A new failing run after a saved passing run deletes `green.json` and `green.log`. A refused red run keeps a saved passing run. Two units run `cstack unit red` at the same time, in two child processes, and both failing runs are saved.
- Minimum code: `unitRed` as the decisions on the two commands say.
- Refactor: if `unit-red.ts` and `unit-green.ts` repeat the same lines to print the last lines and the verdict, move them into `unit-test-command.ts`.
- Commit message: `feat(cli): add cstack unit red, which saves the failing run of a unit`
- Depends on: 3, 4, 5

### Unit 7: Run cstack unit green and save the passing run — status: done
- Files: `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/test/unit-red-green.test.ts`
- Failing test: in `cstack/test/unit-red-green.test.ts`, write first the case of a unit whose failing run was saved by `cstack unit red 1`, then whose code was written (`src/feature.txt` created). `cstack unit green 1` exits with 0 and saves `green.json` with exit code 0 and a time later than the one in `red.json`. Then: while the test still fails, it exits with 1, prints the last lines, and saves nothing. When `testCommands.file` changed in the settings since the failing run, it exits with 1, runs nothing, saves nothing, and the message says to run `cstack unit red 1` again. When the test file content changed but the test passes, it exits with 0 and prints a warning on standard error. A test command that exits with 127 exits with 5, and so does a test that runs past `--timeout 0.01`.
- Minimum code: the rest of `unitGreen`, as the decisions on the two commands say.
- Refactor: none expected.
- Commit message: `feat(cli): add cstack unit green, which saves the passing run after a saved failing run`
- Depends on: 6

### Unit 8: Register cstack unit red and cstack unit green — status: done
- Files: `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts`
- Failing test: in `cstack/test/manifest.test.ts`, the count becomes twelve built commands and three not built. In `cstack/test/cli.test.ts`, `cstack unit` and `cstack unit frobnicate` exit with 2, and standard error lists `order`, `commit`, `red` and `green`. The existing test of line 124 then also checks that both new commands print their usage line on an unknown flag.
- Minimum code: `built: true` and the two new texts of exit code 1 in `manifest.ts`, and the `red` and `green` handlers in `cli.ts`, as the decisions on shared files say.
- Refactor: none.
- Commit message: `feat(cli): register cstack unit red and cstack unit green`
- Depends on: 7

### Unit 9: Explain the two commands in the README and the implementer prompt — status: done
- Files: `README.md`, `cstack/skills/resolve-issue/agents/implementer.md`
- No test: documentation and prompt prose. `cstack/test/prompts.test.ts` and the mention scan of `cstack/test/manifest.test.ts` already check the prompt, and they must still pass.
- Minimum code: in the "Commands" section of `README.md`, add one line for `cstack unit red <n>` and one for `cstack unit green <n>`, in the style of the existing lines, and change the count of commands from ten to twelve. Say in plain words what a failing run and a passing run are, that green needs a saved failing run, and that green refuses when the test command changed since the failing run. In step 4 of the implementer prompt, add the sentence of the decisions on the ten-minute shell timeout.
- Refactor: none.
- Commit message: `docs: explain cstack unit red and cstack unit green`
- Depends on: 8

**Security.** No endpoint, database or secret is involved. The external inputs are the text of the plan file and the settings file. The test file path reaches the shell only as `$1`, never inside the script, and unit 1 proves it for hostile paths. Every other program runs without a shell. Units 5 and 6 check that the test file exists and that its real path stays inside the work tree. `process.kill(-pid)` is guarded against a pid of 0 or 1, which would kill cstack's own group.

## Documentation duties

- The README "Commands" section: applies, written to `README.md` in unit 9.
- The implementer prompt: applies, one sentence written to `cstack/skills/resolve-issue/agents/implementer.md` in unit 9.
- `WHY:` comments in `cstack/src/test-run.ts` for the process group, the file instead of a pipe, and `"$1"`: applies, written in units 2 and 3.
- A comment on this ticket (#17) that says what was built: applies, written in the documentation phase.
- A comment on #23 (Feeds), which runs the new skill end to end: applies, written in the documentation phase. It says what the two commands refuse and that the shell call needs at least ten minutes.
- A comment on #20, which uses `cstack/src/test-run.ts`: applies, written in the documentation phase. It gives the final interface, the one-megabyte limit of `output`, the signal handling, and which copy of the file to keep.
- An ADR: does not apply. The choices are local to one module, and the `WHY:` comments and the README explain them. The new field `testFileSha256` is an added optional field with no change of meaning for the readers of the saved runs.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. US-8 does not change.

## Review log

### Impact notes (phase 7)

Graphify is not installed, so text search was used. The changed existing symbols are the `unit` entry of `HANDLERS` in `cstack/src/cli.ts` and the two manifest entries. Their dependents outside the diff are `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`, `cstack/test/prompts.test.ts` and the README command count, and all were checked. The readers of `red.json` and `green.json` (`unit-commit.ts`, `report/reports.ts`, `plan-status.ts`) are unaffected, because the only change to the format is the added field `testFileSha256`.

### Findings of the four reviewers (phase 7)

- Correctness, important: a failing `cstack unit green` left an older `green.json`, so `cstack unit commit` could accept code whose test now fails. Fixed in commit 65da54e: green deletes the passing run when it fails, with a test.
- Correctness, minor: the verdict line could stick to test output with no final line break. Fixed with `printTestOutput`, with tests.
- Security, minor: a `Test` path that is a directory crashed with a stack trace. Fixed: exit 1 with a message, with a test.
- Simplicity: removed one cast and kept the other items as follow-ups below.
- Conventions and the rest of security: no finding.

### Follow-ups left open

- `unit-red.ts` and `unit-green.ts` repeat the commit read, hash read, test run and timeout branches. A shared helper would remove about 25 lines.
- The `beforeSettings` hook of `prepareUnitTest` exists only for green. Reading the saved run after the call would remove it, but it changes the order of the refusal messages that the plan fixed.
- If cstack is stopped by a signal, the temporary output folder stays in the system temporary folder. Processes the shell leaves behind after a normal end are not killed, and SIGHUP is not caught.
- A log of more than 1 MB with no line break at all is saved empty.

## Briefing

### What you should know about what was built

`cstack unit red` and `cstack unit green` are built and do what the ticket asks, including the three criteria of US-8. Green refuses a unit with no saved failing run, and it refuses when the test command changed since that run. I ran the 57 new tests myself: they pass in about ten seconds. No question blocks the pull request.

**What to watch.**

- The shell tool of Claude Code accepts at most ten minutes, which is also cstack's default timeout. With a suite close to ten minutes, the tool cuts cstack first. If it kills cstack hard, the tests keep running in their own process group with no timeout left. I would add `--timeout 9` to the sentence in the implementer prompt. After such a cut, check `ps` for leftover test processes.
- Two other pull requests of the wave touch the same spots. The one that adds `cstack next` (#46) changes the command counts in `manifest.test.ts` and the README. The one that runs the whole suite (#20) has its own temporary copy of `test-run.ts`. Whichever merges second must keep this copy, where `runTests` is asynchronous.

**What changed since the plan.**

- When green's test fails, times out or cannot start, green now deletes the earlier passing run. The plan said "save nothing". The review showed that `cstack unit commit` would otherwise accept code whose test fails now. As a side effect, a flaky test during the run after the refactor makes the commit refuse until green passes again.
- A `Test` line that names a folder now exits with 1 and a clear message, instead of crashing.
- `runTests` became asynchronous and catches Ctrl-C. So the trade-off I raised before the plan is gone: Ctrl-C on cstack stops the tests too.

#### Details

**What was built and how I checked it.** The branch adds five source files. `cstack/src/test-run.ts` is the shared runner, with the coordinator's interface plus `MAX_OUTPUT_BYTES`. `cstack/src/unit-test-runs.ts` writes the saved runs. `cstack/src/unit-test-command.ts` holds the checks both commands share. The two commands live in `cstack/src/commands/unit-red.ts` and `cstack/src/commands/unit-green.ts`. `cli.ts` and `manifest.ts` changed only in the `unit` handlers and the two entries. On 2026-11-19 I ran `npx vitest run test/test-run.test.ts test/unit-red-green.test.ts test/unit-test-runs.test.ts` from `cstack/`: 3 files, 57 tests, all passing in 9.8 seconds. The test names cover every case of the acceptance list: US-8 AC1 (`saves a failing run and prints the last lines and the verdict`), AC2 (`refuses a unit with no saved failing run and saves nothing`), AC3 (`refuses a unit with a No test line`), the hostile paths of `testScript`, the timeout of the process group, 127 and 126, and two units in two processes at the same time. Continuous integration runs on `macos-latest` with `lts/*`, the same platform the process-group tests were written on. `origin/main` is already merged into the branch, as of the fetch on 2026-11-19.

**The shell timeout of the agent against cstack's own timeout.** The sentence added to step 4 of `cstack/skills/resolve-issue/agents/implementer.md` asks for a shell timeout of "at least ten minutes". The Claude Code shell tool accepts at most 600,000 ms, and `DEFAULT_TEST_TIMEOUT_MS` is also 600,000 ms. Since cstack spends some time on git and the settings before the test starts, a suite that runs close to ten minutes is cut by the tool, not by cstack. When the tool sends SIGTERM or SIGINT, the listeners of `runTests` kill the whole group and nothing is saved, which is acceptable. When it sends SIGKILL, no listener runs. The shell was started with `detached: true`, so it leads its own group and survives cstack, and the timer that would kill it died with cstack. A hanging test then runs forever. I could not check which signal the tool sends. The cheap fix is to change the sentence so that it asks for a ten-minute shell call and `--timeout 9`, or to run long suites with the shell tool's background mode. This is a new non-blocking question, given below. If nobody decides, the prompt stays as it is, and only suites longer than about nine minutes are exposed.

**Merges with the rest of the wave.** Pull request #46, which adds `cstack next` for #15, is open and touches `manifest.ts`, `manifest.test.ts`, `cli.ts` and the README count. This branch says "twelve commands" and counts twelve built and three not built. Whichever pull request merges second has to update both counts and check that `cli.ts` holds one definition of each function, as the coordinator's rules say. Ticket #20 has no pull request yet. It keeps a temporary copy of `cstack/src/test-run.ts` with the same exports. This copy is the one to keep, and it differs from the first interface in two ways that #20 must follow: `runTests` returns a promise, and `output` holds at most the last megabyte. The comment on #20 that the documentation phase writes must say both.

**Green deletes the earlier passing run when it does not pass.** The plan said that a green whose test still fails "saves nothing". The correctness reviewer found that this left an older `green.json`, and `cstack unit commit` (`unit-commit.ts`, lines 62 to 70) would then accept a unit whose test fails now. Commit 65da54e deletes `green.json` and `green.log` when the test fails, and commit c4123fc does the same at the timeout and when the command cannot start. The README says so. I agree with the change: it keeps the rule of the comment of #18, that the saved files always tell the true state. The cost is that the implementer runs green twice (after the code, then after the refactor), and a flaky second run removes the first passing run. `cstack unit commit` then refuses until green passes again, which is the right answer for a flaky test. A refused red still deletes nothing, as the plan says.

**A `Test` path that is a folder.** The security reviewer found that `fileSha256` crashed with a stack trace on a folder. `prepareUnitTest` now checks `statSync(real).isFile()` after the real-path check and exits with 1. The manifest text of exit code 1 for red ("its test file cannot be used") covers it.

**Signals.** The coordinator made `runTests` asynchronous (message `msg_5642a1c6daa3`). It catches SIGINT and SIGTERM, kills the whole group with SIGKILL, removes its own listeners and sends the same signal again to cstack. The tests `stops the sleep process and ends with SIGINT` and `... with SIGTERM` prove it in a child process, and `removes its signal listeners after a normal run` proves that no listener leaks. This settles the Ctrl-C trade-off of the block before the plan. No other file of `cstack/src/` listens for these signals, so the re-sent signal ends cstack with the default action.

**Follow-ups left open by the review.** Four small points stay open and are listed in the review log: about 25 lines repeated between the two commands, the `beforeSettings` hook that only green uses, the temporary output folder left in the system temporary folder when cstack is stopped by a signal (and SIGHUP not caught), and a log of more than one megabyte with no line break at all, which is saved empty. None of them changes what a saved run proves. The SIGHUP point has the same effect as the SIGKILL case above: closing the terminal during a test run leaves the tests running.

**Earlier questions and how they ended.** Question 1, the guard between red and green, is built as answered: green exits with 1 and runs nothing when the script or the test file path differs from `red.json`, and it warns without refusing when `testFileSha256` changed (tests `exits with 1 and runs nothing when the settings changed since the failing run` and `warns when the test file changed but the test passes`). A `red.json` without the fingerprint gives no warning. Question 2, a missing test file or a path outside the work tree, is built, and the folder case was added by the review. Question 3, the `--timeout` format, is built with a regular expression that accepts digits and one decimal part, above 0 and at most 1440. Question 4, the timeout, is built with the process group and a file instead of a pipe, and the coordinator's asynchronous change settled the Ctrl-C point. Question 5, the one-megabyte limit, is built and tested; the case with no line break is the open follow-up above. Questions 6 to 12 are built as recommended: where each line prints, the end time of the run, the worktree root, 128 plus the signal number, the order of the writes, exit 5 when `git rev-parse HEAD` fails, and no need for `cstack next`. The points of question 13 are built: the "whole suite ran" line when `testCommands.file` is missing, the sentence in the implementer prompt, the check on `timedOut` rather than on `exitCode`, and the cut output that starts at a line break. The reading of ADR-SIC-B, where an added optional field such as `testFileSha256` is not a format change, stands, and no reader of the saved runs broke.

**New question after the build (non-blocking).** For the developer, in the conversation, in French: « La phrase ajoutée au prompt de l'implementer demande un délai d'au moins dix minutes pour l'appel shell, mais l'outil shell de Claude Code plafonne à dix minutes, comme le délai par défaut de cstack. Est-ce que je change la phrase pour demander un appel shell de dix minutes avec `cstack unit red <n> --timeout 9` (et pareil pour green) ? » In English: the sentence asks for at least ten minutes, but the tool caps at ten, the same as cstack's default; should the sentence ask for a ten-minute shell call with `--timeout 9`? It is non-blocking, because the ticket's criteria are met either way, and only suites longer than about nine minutes are affected.

I checked authorization, data model lock-in, scale, failure and rollback, edge cases of the terminal messages, operations and cost, reversibility and hidden coupling, and found nothing beyond the points above in authorization, scale, operations and cost, and reversibility.

## Open questions after the build

### Blocking

none

### Non-blocking

The sentence added to the implementer prompt asks for a shell timeout of at least ten minutes, but the shell tool of Claude Code stops at ten minutes, the same as the default timeout of cstack. Should the sentence ask for a ten-minute shell call with `cstack unit red <n> --timeout 9` (and the same for green)? For: the maintainer. If nobody decides, the prompt stays as it is, and only suites longer than about nine minutes are exposed. Answered on 2026-11-19: yes, the sentence now asks for `--timeout 9` in a ten-minute shell call (see "Decisions").

## Pull request

Title: feat(cli): add cstack unit red and cstack unit green to prove that each test failed first

Body:

This adds two commands. `cstack unit red <n>` runs the test of unit `n` and saves the failing run. `cstack unit green <n>` runs it again once the code exists and saves the passing run, but only when a failing run is saved first. A unit marked "no test" is refused by red, with its reason.

Key decisions and why:
- The test file path reaches the shell only as the first argument (`"$1"`), never inside the script text, so a hostile path cannot run code.
- The tests run in their own process group. The timeout and Ctrl-C then stop every process of the tests, not only the shell.
- Green refuses, without running anything, when the test command changed since the failing run. It only warns when the test file content changed but the test passes.
- When green fails, times out or cannot start, it deletes an older passing run. Otherwise `cstack unit commit` could accept code whose test no longer passes. The review found this, and it differs from the plan, which said "save nothing".
- Every saved run keeps the exact script, the commit, the exit code, the time and a SHA-256 fingerprint of the test file.

Files touched: the shared runner `cstack/src/test-run.ts`, the writer of saved runs `cstack/src/unit-test-runs.ts`, the shared checks `cstack/src/unit-test-command.ts`, the two commands in `cstack/src/commands/`, the registration in `cli.ts` and `manifest.ts`, their tests, the README and one sentence in the implementer prompt. The plan is `docs/plans/2026-11-19-17-prove-that-each-test-failed-first-with-cstack-unit-red-and-green.md`.

Judgment calls from the independent review:
- Green compares its command with the one of the failing run. A change to `.cstack/settings.json` made before the failing run goes unnoticed, so the warning of the maintainer is only partly covered.
- A file system error, such as an unreadable test file, is not caught and ends with a stack trace. This matches the rest of `cstack`.
- A refused red run keeps an older passing run, because a refused run says nothing about the current code.

Follow-ups left open: about 25 lines are repeated between the two commands. The temporary output folder stays when cstack is stopped by a signal. A log of more than one megabyte with no line break is saved empty.

Another pull request of the wave may merge first. Then the counts of commands in `manifest.test.ts` and the README must follow the merged list, and the copy of `test-run.ts` of this branch is the one to keep.

Fixes #17

## Documentation

- Ticket #17 comment: https://github.com/gambitl/claude-code-stack/issues/17#issuecomment-7004459251
- Ticket #23 comment (dependent): https://github.com/gambitl/claude-code-stack/issues/23#issuecomment-7004459721
- Ticket #20 comment (uses test-run.ts): https://github.com/gambitl/claude-code-stack/issues/20#issuecomment-7004460102
- README "Commands" section and the implementer prompt: committed in unit 9 and the review fixes.
- `WHY:` comments in `cstack/src/test-run.ts`: committed in units 2 and 3.
- No ADR, as the plan says. The specification page does not change.

## Executor notes

- The tests of unit 7 passed on their first run, so nobody saw them fail first. The unit was written after the stub of unit 5 returned exit 5 for everything.
- The first full `npm test` of unit 5 hit a 5 second timeout in `report.test.ts` while other units ran tests at the same time. It passed on every later run.
- The correctness reviewer found that green left an older passing run when the test failed. The independent reviewer found the same gap for the timeout and for exit 126 or 127. Both were fixed in new commits.
- `graphify` is not installed, so the impact notes came from text search only.
- `npm test` prints "Switched to a new branch 'feature'" twice. Nobody looked for the cause.

## Hand-off log

2026-11-19: phases 6 to 10 done. Nine units built, two review rounds, nothing pushed. Ticket labelled "in progress". Comments written on #17, #20 and #23. One non-blocking question open (the `--timeout 9` sentence).

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Should `cstack unit green` refuse when the test command or the test file changed since the failing run?** A build can edit `.cstack/settings.json` between the two runs, and the passing run then proves nothing. The same is true when the test itself is weakened after the failing run. I recommend this: green exits with 1 when the script or the test file path differs from the one in `red.json`. I would also save a SHA-256 fingerprint of the test file with each run. Green then prints a warning when the test changed, without refusing. A refusal there would block any honest edit of the test, because the failing run cannot be made again once the code exists.

**I will do this unless you say no.**

- Both commands exit with 1, before running anything, when the test file does not exist or its real path leaves the work tree. Without this, "no test files found" would be saved as a failing run.
- When the settings only give `testCommands.all`, the red message says that the whole suite failed, not necessarily this unit's test. I add no refusal, because the acceptance criteria say `all` runs.
- I add one sentence to the implementer prompt: give the shell call at least ten minutes. Claude Code's shell tool stops a command after two minutes by default, long before cstack's own timeout. cstack then dies without saving anything.
- I take the recommended answers for the nine small points in the plan file: timeout format, output limit, where each line prints, saved time, test root, signals, file order, missing commit, and runs without `cstack next`.

**I checked it myself.**

- At the timeout, Node stops only `/bin/sh`, and a test it started keeps running. Starting the shell in its own process group and killing the whole group fixes it.
- `npm test` returns 127 when the test tool is not installed, so a new worktree without `npm ci` gives exit 5, not a false failing run.

**Good to know.**

- Because the shell runs in its own group, Ctrl-C on cstack no longer reaches the tests: I checked that they keep running. The synchronous interface agreed with the ticket that runs the whole suite (#20) leaves no clean fix.
- cstack proves that the test failed, not that it failed for the right reason. `npx` with a missing package returns 1 and would be saved as a failing run. The implementer's reading of `red.log` stays the real check.

#### Details

**The guard between the failing run and the passing run (open question 1, blocking, someone has to decide).** The comment of #14 on this ticket warns that a build that edits `.cstack/settings.json` can change the test commands and defeat the proof. I keep the draft's recommendation: `cstack unit green` exits with 1 when the script it would run, or the unit's test file path, differs from `command` and `testFile` in `red.json`. For this to work, `command` must hold the exact script handed to `/bin/sh -c`, with `"$1"` in it, not the expanded command. I add the content check because the same hole exists for the test file: an implementer can weaken the test after the failing run and get a passing run. A hard refusal on content would deadlock the unit, because once the code exists, `cstack unit red` refuses a test that passes. The implementer would have to stash the code, run red again and restore it. So I recommend a warning only: save `testFileSha256` in `red.json` and `green.json`, and print a line on green when they differ. The field is optional and additive. `readSavedRun` in `cstack/src/saved-runs.ts` ignores unknown fields, and `cstack unit commit` reads only `time`, so no reader breaks. ADR-SIC-B says a format change needs a new version and a decision. I read an optional added field as no change of meaning, which is the rule `cstack/src/settings.ts` states for the settings format. If the developer reads ADR-SIC-B more strictly, the fingerprint is dropped and the script check stays. The same deadlock applies to the script check: when a ticket legitimately changes `testCommands` while a unit is between red and green, the message must say to set the code aside, run red again, and bring the code back. I rejected reading the settings from the target branch and refusing any branch that touches the settings file, for the reasons the draft gives: both refuse every ticket that adds or changes the test commands. If nobody decides, there is no guard, and the saved runs only record the command for a reviewer.

**A missing test file or a path outside the work tree (open question 2, blocking, the run can settle it).** I agree with the draft and move it to the points I will do unless told otherwise. The comment of #13 asks for the real-path check explicitly, because `readPlan` in `cstack/src/plan/read.ts` checks unit paths as text only. The existence check closes the case where `testCommands.file` points a runner at a file that does not exist: vitest answers "No test files found" with exit 1, which `cstack unit red` would save as proof. Both checks run before any test command, and both exit with 1 with a message that names the file.

**A failing run of the whole suite.** When the settings give only `testCommands.all`, `cstack unit red` saves a failing run whenever any test of the suite fails. That includes a test already broken on the target branch, or a flaky one. `cstack/guides/resolve-issue/build.md` (line 15) already runs units one at a time in that case, which removes interference between units but not pre-existing failures. Refusing red without `testCommands.file` would change the acceptance criteria, which say that `testCommands.all` runs. Searching the output for the test file path is unreliable across runners: Go reports packages and pytest reports test ids. So the red success message says that the run covered the whole suite, and that `red.log` must show the unit's own test failing. A side effect follows: when the target branch already has a failing test, green can never pass, and the implementer reports stuck with the log.

**The shell timeout of the agent.** The Claude Code shell tool stops a command after 120,000 ms by default, and accepts at most 600,000 ms. `DEFAULT_TEST_TIMEOUT_MS` is 600,000, fixed by the coordinator's interface, so I do not reopen it. When a suite runs longer than two minutes, the harness stops cstack before cstack's own timeout. Nothing is saved, the implementer sees an unexplained failure, and it may retry while the first suite still runs, depending on how the harness stops processes. I could not check how the harness stops a process tree. The fix is one sentence in `cstack/skills/resolve-issue/agents/implementer.md` near lines 25 and 26: give the shell call of `cstack unit red` and `cstack unit green` a timeout of at least ten minutes, or pass a smaller `--timeout`. The file is under `cstack/skills/`, which the wave rules allow. It is outside the scope list, so the plan must name it in a unit's `Files`. Default if nobody objects: I add the sentence.

**The small points (open questions 3 and 5 to 12, non-blocking).** I keep every draft recommendation. One addition to open question 9: when `/bin/sh` itself is killed by a signal that is not the timeout, `spawnSync` returns `status: null` with a signal name. `TestRun.exitCode` is then undefined, although the interface comment says undefined means a timeout. `cstack unit red` must check `timedOut`, not `exitCode === undefined`. It saves such a run as failing with 128 plus the signal number from `os.constants.signals`, because `SavedTestRun.exitCode` is a number. For open question 10, the deletion of `green.json` and `green.log` happens only after the test ran and failed. A refused red, where the test passes, must not delete a valid passing run. For open question 5, cutting the output at one megabyte can split a multi-byte character. Start the kept part at the next line break so the log starts clean. The temporary output file goes in a folder made with `mkdtemp`, and it is deleted in a `finally` block.

**The timeout stops only the shell (open question 4, blocking, settled by a test).** The draft's tested facts in the code mapping show it on Node 26.10.0: `spawnSync` sends SIGTERM to `/bin/sh` only, and a child such as `sleep 30` survives. With `detached: true`, the shell leads its own group, and `process.kill(-pid, "SIGKILL")` stops the child. Output goes to a file, because with a pipe `spawnSync` would wait for the surviving child to close it. I did not repeat that test. My own test below is consistent with it.

**A missing test tool returns 127 through npm (checked).** In the scratchpad, with npm 11.19.1, a `package.json` whose `test` script calls a missing binary made `npm test` exit with 127, and `npm run` of `vitest run` without vitest installed also gave 127. A new worktree without `npm ci` therefore gives cstack exit 5 and no saved run, which is right. `npx --no-install` of a missing package exited with 1. A setting such as `npx vitest run {file}` in a worktree without packages would then save a false failing run. Other runners have other codes: pytest exits with 4 when a file is missing. The 126 and 127 rule therefore only catches a shell that cannot find the command.

**Ctrl-C no longer reaches the tests (checked).** I started a Node process that runs `spawnSync("/bin/sh", ["-c", "sleep 47.5; echo done"])` in its own group, and sent SIGINT to that whole group, which is what Ctrl-C does. Without `detached`, the sleep stopped. With `detached: true`, it kept running. `detached` calls `setsid`, so the shell leaves the terminal's foreground group. Signal handlers cannot help, because `spawnSync` blocks the event loop until the child ends, and Node's default SIGINT action stops cstack at once. I accept the trade-off. Every timeout would otherwise leave a test running, while an interrupt is rare. The synchronous signature is fixed with #20, so I do not reopen it. The doc comment of `runTests` should say it.

**What cstack does not prove.** A saved failing run proves that the test command exited with a failure. It does not prove the failure came from the unit's new assertion. Examples are an import error in the test file, `npx` without the package, or a runner configuration error. The implementer prompt (line 25) already asks the implementer to check the reason in the saved failure, and that stays the real guard. The pull request reviewer can read `red.log` only on the machine of the run, because ADR-SIC-B keeps logs under the git folder.

**Already settled, cited and not reopened.** The synchronous `runTests` interface and its ten-minute default come from the coordinator of the wave. Running the commands through `/bin/sh -c` with `"$1"` comes from the comment of #14. The location and shape of the saved runs come from ADR-SIC-B and the comment of #13. Deleting `green.json` on a new failing run comes from the comment of #18.

I checked authorization, data model lock-in, scale, failure and rollback, user experience at the edges, operations and cost, reversibility and hidden coupling. I found nothing in scale, because each call runs one test command. I found nothing in operations and cost, because there is no new service or bill. I found nothing in user experience beyond the terminal messages above.

### Open questions and answers

1. **How does `cstack unit green` guard against a change of the test commands between the failing run and the passing run?** Blocking, because the answer adds or removes a refusal. The comment of #14 on this ticket warns that a build that edits `.cstack/settings.json` can change the test commands and defeat the proof, and asks to consider a guard. There are four choices. First, no guard: the saved runs record the command, and a reviewer can compare them. Second, `cstack unit green` refuses with exit 1 when the script it would run, or the unit's test file, differs from the one saved in `red.json`, and the message says the failing run must be made again with the new command. Third, the commands read the settings from the target branch with `git show`; this refuses every ticket that adds or changes the test commands, and `readSettings` only reads from disk. Fourth, both commands refuse when the branch changes `.cstack/settings.json`; this also refuses such tickets. Recommended answer: the second choice. It is cheap, it makes the failing run and the passing run of one unit use the very same command, and it never blocks a ticket that changes the settings before its units run.

   Answer (the user, 2026-11-19): the recommendation of the advisor, as written in "Questions you may not be asking". `cstack unit green` exits with 1 when its script or the unit's test file path differs from `command` or `testFile` in `red.json`. Each saved run also holds a SHA-256 fingerprint of the test file, and green prints a warning, without refusing, when the fingerprint changed since the failing run.

2. **Do both commands refuse a unit whose test file does not exist, or whose real path leaves the work tree?** Blocking, because it adds a refusal that the ticket does not list. When `testCommands.file` is set and the test file is missing, the test runner fails with a message such as "no test files found". `cstack unit red` would save that failure as the proof, although the test was never written. The comment of #13 also asks to resolve the real path of a unit path before running it, because the plan reader cannot see symbolic links. Recommended answer: yes. Both commands exit with 1 before running anything, and the message names the file and says to write the test first, or that the path leads outside the work tree.

   Answer: accepted by default on 2026-11-19, as an item of "I will do this unless you say no".

3. **What does `--timeout` accept?** Non-blocking: any sensible rule leaves the ticket correct. Recommended answer, an assumption not asked: a positive number of minutes, decimals allowed, at most 1440. Anything else is a usage error with exit 2. Decimals let the test of the timeout finish in under a second, with `--timeout 0.01`.

   Answer: accepted by default on 2026-11-19.

4. **How is a test run stopped at the timeout?** Blocking, because a test left running after the timeout keeps using the machine and can write into the work tree. Tested answer (see "Tested facts" in the code mapping): Node stops only `/bin/sh`, and a child of the shell keeps running. The shell starts in its own process group, and the whole group is killed at the timeout. Output goes to a temporary file, not to a pipe, so that `spawnSync` does not wait for a stray child.

   Answer: tested, see above. On 2026-11-19 the coordinator made `runTests` asynchronous (message `msg_5642a1c6daa3`). While the tests run, it catches SIGINT and SIGTERM, kills the whole group, then lets cstack exit. This settles the Ctrl-C point of the advisor's block.

5. **How much output does `runTests` keep in memory?** Non-blocking. The fixed interface says `output` holds standard output and standard error together, but it gives no limit. A test that prints gigabytes would fill the memory. Recommended answer: `runTests` keeps at most the last megabyte (1,048,576 bytes) of the output, reads only that part from the temporary file, and says so in its doc comment. The signature does not change, and #20 only prints the last lines. The log file keeps the same last megabyte, as the scope asks.

   Answer: accepted by default on 2026-11-19.

6. **Where does each command print?** Non-blocking. Recommended answer, an assumption not asked: the last 40 lines of the test output go to standard output whenever the test ran. The verdict line goes to standard output on exit 0. A refusal or an error goes to standard error, with the prefix `cstack unit red: ` or `cstack unit green: `, as `cstack unit commit` does.

   Answer: accepted by default on 2026-11-19.

7. **Which time does a saved run hold?** Non-blocking. Recommended answer, an assumption not asked: the time the test run ended, written with `new Date().toISOString()`. `cstack unit commit` compares the two times, and the end of the failing run always comes before the passing run starts.

   Answer: accepted by default on 2026-11-19.

8. **Where do the tests run, and which settings file applies?** Non-blocking. Recommended answer, an assumption not asked: the root of the current worktree, from `locatePlan`, and the settings file of that root. A child worktree that works on one unit then runs its own code, and saves into the run folder that every worktree shares.

   Answer: accepted by default on 2026-11-19.

9. **What happens when the shell ends on a signal other than the timeout?** Non-blocking. Recommended answer, an assumption not asked: the exit code is 128 plus the signal number, as a shell reports it, and the run counts as a failing test.

   Answer: accepted by default on 2026-11-19.

10. **In which order are the files written?** Non-blocking. Recommended answer, an assumption not asked: `cstack unit red` first deletes `green.json` and `green.log`, then writes `red.log`, then `red.json` last. `cstack unit green` writes `green.log`, then `green.json`. A crash between two writes then never leaves a passing run newer than a failing run that it does not match.

   Answer: accepted by default on 2026-11-19.

11. **What if `git rev-parse HEAD` fails?** Non-blocking. Recommended answer, an assumption not asked: the command exits with 5 and saves nothing. The plan file is committed as the first commit of the branch, so this only happens in a repository with no commit.

   Answer: accepted by default on 2026-11-19.

12. **Do the commands need a run started by `cstack next`?** Non-blocking. Recommended answer, an assumption not asked: no. Like `cstack unit commit`, they write into the run folder and create it when needed. `cstack next` is built by #15 at the same time.

   Answer: accepted by default on 2026-11-19.

13. **Points the advisor added before the plan.** The red message says that the whole suite ran when the settings only give `testCommands.all`. One sentence in `cstack/skills/resolve-issue/agents/implementer.md` asks the implementer to give the shell call of `cstack unit red` and `cstack unit green` at least ten minutes. When the shell itself ends on a signal, `cstack unit red` checks `timedOut`, never `exitCode === undefined`. A refused red never deletes a passing run. A cut output starts at the next line break.

   Answer: accepted by default on 2026-11-19.

### Architecture options

No real choice: the ticket, the coordinator's interface and the answers above fix the approach.
