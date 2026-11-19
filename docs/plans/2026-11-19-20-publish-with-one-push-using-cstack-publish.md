# Plan: #20 — M2-8: Publish with one push using cstack publish

Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/20
Tracker: GitHub
Documentation tool: docs/ folder (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/publish-one-push
Target branch: main
Conversation language: French
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** The finished work leaves the computer in one single push, and only once every blocking question has an answer and the plan says the work is ready.

- **What the title means**: To push is to send the local commits to the server that hosts the code, such as GitHub or GitLab. That server is called the forge. To publish is to push the branch and open its pull request, which is the request to merge the work into the main code. The forge runs automatic checks, called CI, on every push. `cstack publish` is a command of `cstack`, the command-line tool of this project. It does the push, opens the pull request and waits for the checks.
- **Why we are doing it**: On many forges, every push to an open pull request starts all the checks again. Twenty pushes cost twenty runs of the checks. The skill already says to push only once at the end, but nothing enforces it. Nothing stops a push either while a blocking question is still open. A blocking question is a question whose answer can change what the ticket builds.
- **For the user**: A solution engineer's work leaves the machine only when it is finished, and the checks run once. The checks they read always belong to the last push, never to an older one.

**Goal.** This ticket delivers `cstack publish`, which refuses to publish too early, brings the branch up to date, pushes once, opens the pull request and waits for the checks, on GitHub and on GitLab (US-12 AC1 to AC4). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #13 adds the plan file reader, the run state and the command list, and #14 adds the settings reader. None of them is in the repository yet.
* **The push rule today**: `skills/resolve-issue/SKILL.md` (lines 44 to 50): nothing is pushed until the work is finished, and phase 12 then makes one push. Line 48 gives the reason, which is the cost of the checks. Line 50 allows two exceptions, a fix for a red check and a pipeline run that the plan asks for as evidence. Line 212 records the single push as a settled decision.
* **Phase 12 today**: `skills/resolve-issue/agents/executor.md` (lines 103 to 113): step 0 (line 105) refuses to push while a blocking question has no answer. Step 1 (line 106) does not open a second pull request when one exists. Step 2 (line 107) rebases onto the target branch and reruns the tests. Steps 3 and 4 (lines 108 and 109) push and open the pull request with the title and body drafted in the plan. Step 5 (line 110) waits for the checks, fixes a failing check in a new commit, and pushes again.
* **The drafted pull request**: `skills/resolve-issue/agents/executor.md` (line 95): the executor drafts the title and the body in the plan's "Pull request" section, with the closing reference that the tracker understands.
* **Forge clients on the maintainer's machine**: `gh pr create --help` lists `--base`, `--head`, `--title` and `--body-file`. `gh pr view --help` lists the JSON fields `headRefOid` and `url`. `gh pr checks --help` lists the JSON fields `name`, `state`, `bucket` and `link`. Its `bucket` is `pass`, `fail`, `pending`, `skipping` or `cancel`. `glab mr create --help` lists `--source-branch`, `--target-branch`, `--title`, `--description-file` and `--yes`. `glab mr list --help` lists `--source-branch` and `--output json`, and `glab ci get --help` lists `--branch` and `--output json`. `gh auth status` and `glab auth status` both take `--hostname`.
* **Specification**: `docs/projects/skills-into-cli.md` (lines 160 to 163) holds the four criteria of US-12. Line 284 says that `cstack publish` keeps and enforces the single push.
* **Contract**: from #13 and #14. A blocking question is open while its line is `- Answer: open`. The plan is ready when its `Status` is `ready for review` and its `Ready for review at` holds a time. The header gives `Branch` and `Target branch`. The `## Pull request` section holds a line `Title: <title>`, then the body inside a fenced block of four backticks marked `markdown`. The command is `cstack publish [--timeout <minutes>] [--poll <seconds>] [--grace <seconds>]`, and it also takes `--plan <file>`. It exits with `1` when it refuses before any push, and with `4` when no logged-in forge client serves the remote. It exits with `5` when the push or a forge call fails, and with `6` when a check failed on the pushed commit. It exits with `7` when checks still run at the timeout. It exits with `8` when the update onto the target branch conflicts, after it has put the branch back as it was. `publish.json` in the run folder holds the pull request link, each push with its commit and time, and the result of the checks on the last push. The settings reader of #14 gives `integration`, which is `merge` or `rebase`, and `testCommands.all`.

## Scope

1. Build `cstack publish` in `cstack/src/commands/publish.ts`.
2. Before anything else, check the rules below, and list every broken rule at once. When one is broken, exit with `1` and push nothing.
   - No blocking question is open (US-12 AC1). The message names each open question.
   - The plan is "ready for review", as the contract says (US-12 AC1).
   - The working tree has no uncommitted change to a tracked file, because such a change would not leave with the push.
   - The `Pull request` section has a title and a body.
   - The `Branch` line names the branch that is checked out.
   - `git check-ref-format --branch` accepts the branch and the target branch, and neither name starts with `-`.
3. Find the forge from the raw URL of the remote `origin`, read with `git config --get remote.origin.url` (US-12 AC4). A host `github.com` means GitHub and `gh`. For any other host, ask `gh auth status --hostname <host>` and then `glab auth status --hostname <host>`, and use the first client that is logged in. When none is, exit with `4`, and name the host and both clients.
4. When the branch is not on the remote yet, bring it up to date (US-12 AC2).
   - Run `git fetch origin <target branch>`. When `origin/<target branch>` is already in the history of the branch, there is nothing to do.
   - Otherwise, follow the `integration` setting. With `rebase`, run `git rebase origin/<target branch>`. With `merge`, run `git merge --no-edit origin/<target branch>`.
   - On a conflict, abort the rebase or the merge, so the branch is as it was. List the files in conflict, and exit with `8`.
   - When the update changed the branch, run `testCommands.all` as #17 runs test commands. When the tests fail, print the last 40 lines, push nothing, and exit with `1`.
5. When the branch is already on the remote, never rewrite its history. Skip the update. When the local branch does not simply extend the remote branch, exit with `1` and push nothing. cstack never pushes with `--force`.
6. Push once (US-12 AC2). Use `git push --set-upstream origin <branch>` the first time, and `git push origin <branch>` after that. When the remote already has every commit, do not push. Record each push in `publish.json`.
7. Open the pull request or merge request only when the branch has none yet (US-12 AC2). Ask with `gh pr view <branch> --json url,headRefOid` or `glab mr list --source-branch <branch> --output json`.
   - On GitHub, run `gh pr create --base <target> --head <branch> --title <title> --body-file <file>`.
   - On GitLab, run `glab mr create --source-branch <branch> --target-branch <target> --title <title> --description-file <file> --yes`.
   - Take the title and the body from the plan. Write the body into a temporary file, and pass every value as its own argument, without a shell. Record the link in `publish.json`.
8. Read the checks only after the last push, and only those of the pushed commit (US-12 AC3).
   - On GitHub, wait until `gh pr view --json headRefOid` gives the pushed commit. Then read `gh pr checks <branch> --json name,state,bucket,link` every `--poll` seconds (15 by default).
   - On GitLab, read `glab ci get --branch <branch> --output json` every `--poll` seconds, until its pipeline is for the pushed commit and has finished.
   - When no check appears for the pushed commit within `--grace` seconds (120 by default), say that no check ran and exit with `0`.
9. End with one result, and record it in `publish.json`. When a check failed or was cancelled, exit with `6` and print its name and link. When checks still run after `--timeout` minutes (30 by default), exit with `7` and name them. When every check passed or was skipped, exit with `0`. Print the pull request link and the number of pushes in every case.
10. Leave the tracker alone. Moving the ticket to "in review" and adding the link to the decision records stay in the publish guide of #22, with Claude's own connection.

## Acceptance (TDD)

* `cstack/test/publish.test.ts`: write first the case of a plan whose blocking question has `- Answer: open`. `cstack publish` must exit with `1` and name the question. The test's bare remote, which logs every push it receives, must have received nothing (US-12 AC1). The same holds for a plan whose Status is not "ready for review".
* `cstack/test/publish.test.ts`: on the GitHub path, with a fake `gh` on the `PATH`, the bare remote receives exactly one push. The fake receives `pr create` once, with the plan's title and a body file equal to the plan's body (US-12 AC2). The test sends pushes to the bare remote with git's `url.<path>.insteadOf` setting, so the raw remote URL still names `github.com`.
* `cstack/test/publish.test.ts`: when the target branch moved, the setting `rebase` puts the branch on top of it, the tests run, and one push follows. The setting `merge` adds a merge commit instead. A conflict makes the command exit with `8`, with the branch as it was and no push. Tests that fail after the update make it exit with `1`, with no push.
* `cstack/test/publish.test.ts`: the fake `gh` first reports an older head commit with a failed check, then the pushed commit with passing checks. cstack waits for the pushed commit, never reports the old failure, and exits with `0` (US-12 AC3).
* `cstack/test/publish.test.ts`: a second run after a new commit opens no second pull request and makes exactly one more push. A failed check makes the command exit with `6` and name it. A check still pending at the timeout gives `7`. No check within the grace period gives `0` and the words "no check ran".
* `cstack/test/publish.test.ts`: with a remote on another host and a fake `glab` that is logged in, the merge request is created with `glab mr create`. The pipeline of the pushed commit is read with `glab ci get` (US-12 AC4). With neither client logged in, the command exits with `4`.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A title that holds `$(touch pwned)` and a body with backticks reach the fake client byte for byte, and no file named `pwned` appears. When the remote branch has a commit that the local branch lacks, the command exits with `1` and pushes nothing, because cstack never forces a push.

**Size: M** · Blocked by: #13, #14 · Feeds: #23


### Ticket comments

**Comment by the maintainer, 2026-11-18T09:10:55Z:**

Ticket #14 adds `readSettings(root)` in `cstack/src/settings.ts`. The key `integration` is either `merge` or `rebase`, and it says how the branch catches up with its target branch. The default is `rebase`, which is what the skill does today. The result also tells you whether the value comes from the file or from the default.


**Comment by the maintainer, 2026-11-18T09:23:21Z:**

Ticket #13 fixed the data that `cstack publish` reads and writes. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

`cstack/src/run-state.ts` has the type of `publish.json`: the pull request link, each push with its commit and time, and the result of the checks on the last push. Writing it is yours. The `publish` phase in `cstack/src/phases.ts` has a start condition: the done time of `retro` must be later than the time of the last accepted done report. Because `retro` can be marked done again, a second run of the executor after a retrospective passes it only once the retrospective is redone.

The `## Pull request` section of the plan has a line `Title: <title>`, then the body in a fenced block that opens with four backticks and the word `markdown`. `readPlan` in `cstack/src/plan/read.ts` returns the title and the body, so you do not parse it again. The target branch is the `Target branch` header line. It is checked as a branch name that cannot become a git option. Still put `--end-of-options` before any revision you pass to git. Your exit codes `1`, `4`, `5`, `6`, `7` and `8` are in `cstack/src/manifest.ts`.



### Decisions already taken upstream

From the parent epic, "Epic: Skills into CLI" (https://github.com/gambitl/claude-code-stack/issues/6):

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






ADRs that exist in the repository and bear on this ticket:

- ADR-SIC-B, where the run state lives: `docs/decisions/ADR-SIC-B-run-state.md`
- ADR-SIC-D, the settings file and the review model: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`
- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`

Wave instructions from the coordinator of this wave (2026-11-19), which apply to this ticket:

- Five tickets run at the same time: #15, #17, #19, #20 and #24. Every one touches `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/src/cli.ts`, and any may touch `README.md` and `docs/projects/skills-into-cli.md`. Keep changes to those shared files small and in their own place.
- A helper that reads or writes a file of the run folder goes in a new file of this ticket, not in `cstack/src/run-state.ts`.
- When another ticket of the wave merges first, merge `origin/main` into the branch with a merge commit, keep both changes, update the counts of built and not-built commands in `cstack/test/manifest.test.ts` and `README.md`, and rerun the whole suite. Watch for a function that git keeps twice without a conflict marker in `cli.ts`.
- Never edit anything under the top-level `skills/` folder (frozen at the tag `prose-skills-final`, ADR-SIC-E).
- Keep the author dates of commits: never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never push a tag that starts with `v`.
- Ticket #17 owns `cstack/src/test-run.ts`, with the interface below. Ticket #20 writes a temporary copy with the same exports so it can test on its own. Whichever branch merges second keeps the copy of #17, deletes the other, and runs the tests of both tickets against it. In #20, any run that does not exit with `0` counts as failing tests.

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
export function runTests(root: string, script: string, testFile: string | undefined, timeoutMs?: number): Promise<TestRun>;

/** The last `count` lines of the output, 40 by default. */
export function lastLines(output: string, count?: number): string;
```

- Change from the coordinator on 2026-11-19: `runTests` is asynchronous and returns `Promise<TestRun>`, as in the interface above. It starts the shell in its own process group. At the timeout it kills the whole group. While the tests run, it catches SIGINT and SIGTERM, kills the whole group, then lets cstack exit. Ticket #17 writes and tests this behaviour. Ticket #20 keeps the same signature in its temporary copy, and the branch that merges second keeps the copy of #17.
- Note from the coordinator on 2026-11-19: no file of `cstack/src/` may go through a shell, except `cstack/src/test-run.ts`, which runs the user's `testCommands` through `/bin/sh -c` on purpose. Ticket #24 adds a test that checks it once it merges.
- Note from the coordinator on 2026-11-19: Graphify is dropped. Ticket #19 is closed as not planned, and ticket #45 removes Graphify and `cstack graph ensure`. Do not build on them and do not remove them.
- Tests never reach a real forge: a local bare repository is the remote, and fake `gh` and `glab` programs sit on the `PATH`. Never run `cstack publish` on this repository or any real repository.
- Ticket #24 builds the single program runner of cstack in parallel. Every call to `git`, `gh` and `glab` of `cstack publish` stays behind one small function in this ticket's own file, so a later ticket can switch it onto the runner of #24 in one place.

## Dependencies

clear: #13 and #14 are both closed as completed (checked 2026-11-19).

## Code mapping

Graphify is not installed on this machine, and this wave must not install it, so the code was mapped with search and file reads. Graphify is dropped from the new version of the skills: ticket #19 (`cstack graph ensure`) is closed as not planned, and ticket #45 removes Graphify from cstack. This ticket neither builds on it nor removes it. The cstack code is small (about 3,900 lines in `cstack/src/`).

**Entry points and patterns.**

- `cstack/src/cli.ts` (lines 40 to 57): `HANDLERS` maps the first word of a built command to its function. A command is listed in the usage text only when its entry in `cstack/src/manifest.ts` has `built: true`. The test `cstack/test/cli.test.ts` (lines 111 to 131) checks that every built entry has a handler, and that a built command given an unknown flag exits with `2` and prints its usage line.
- `cstack/src/manifest.ts` (lines 181 to 198): the entry of `cstack publish` already exists with `built: false`, its flags `--timeout`, `--poll`, `--grace` and `--plan`, and its exit codes `0`, `1`, `2`, `3`, `4`, `5`, `6`, `7` and `8`. Building the command means flipping `built` to `true`. `cstack/test/manifest.test.ts` (lines 116 to 119) counts ten built commands and five not built. `README.md` (line 40) says "`cstack` has ten commands" and lists each built command (lines 42 to 51).
- `cstack/src/commands/unit-commit.ts` is the closest example of a command that drives git. It parses its arguments with `parseArgs`, finds the plan with `locatePlan(cwd, --plan)`, reads it with `readPlan`, runs git through a small local `git(cwd, args)` function built on `spawnSync`, and turns `PlanFormatError`, `RunStateError` and `PlanLocationError` into their own exit codes. It takes `cwd` as an extra parameter so that tests can call it directly.
- `cstack/src/commands/errors.ts`: `failWith(error, io, prefix)` prints the known plan, location and run-state errors and returns their exit codes.
- `cstack/src/plan/read.ts`: `readPlan(text)` throws `PlanFormatError` (exit code 3) on any format problem. It returns the header (`Branch`, `Target branch`, `Status`, `Ready for review at`), the `blockingQuestions` (each with `number`, `title`, `open`), and `pullRequest` (`title` and `body`) when the `## Pull request` section is filled. `isBranchName` (line 137) already refuses a branch name that starts with `-`.
- `cstack/src/phases.ts` (line 60): `noOpenQuestion` lists the open blocking questions as messages. Line 80 holds `publishStart`, the start condition of the publish phase (the retro was done after the last accepted done report). `cstack next` (#15) enforces it.
- `cstack/src/settings.ts`: `readSettings(root)` returns `values.integration` (`merge` or `rebase`, default `rebase`) and `values.testCommands` (`{ all, file? }` or `undefined` by default). It throws `SettingsError` on a bad file. The header comment says test commands run through `/bin/sh -c`.
- `cstack/src/run-state.ts`: `runFolder(cwd, planFile)` gives the run folder under the common git folder. `writeFileAtomic(path, text)` writes through a temporary file and a rename. `PublishRecord` (lines 53 to 58) is the type of `publish.json`: `pullRequest: string`, `pushes: { commit, time }[]` and `checks?: string`.
- `cstack/src/report/reports.ts` (lines 55 to 103): `cstack report submit published` reads `publish.json`. It refuses when the file is missing, when `pullRequest` is empty, when there is no push, or when the last push is not the current `HEAD`. So `cstack publish` must write a non-empty `pullRequest` and record every push it makes.
- `cstack/src/doctor/runner.ts` runs programs asynchronously with `execFile`, for `cstack doctor`. Nothing else in cstack runs `gh` or `glab` yet.
- `cstack/guides/resolve-issue/publish.md` already tells the executor to run `cstack publish --plan <plan file>` and to act on its exit codes `0`, `1`, `4`, `5`, `6`, `7` and `8`. It expects exit code `8` to leave the branch as it was.

**Tests.** `cstack/test/helpers/plan-repo.ts` gives `makeRepo()`, `commitPlan()`, `commitFiles()`, a `git()` helper with a fixed test identity, and `collect()` for a fake `Io`. `cstack/test/fixtures/plans/ready-for-review.md` is a valid plan whose Status is `ready for review`, with a `## Pull request` section that has a title and a body. Tests call command functions directly with a `cwd` parameter. `cstack/test/doctor-runner.test.ts` writes small executable files with `chmodSync(file, 0o755)`, which is the pattern for fake `gh` and `glab` programs.

**Constraints and risks.**

- `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts` and `README.md` change in every ticket of this wave. They were changed together in the last merges (commit `fc0c4cd`, a merge of `origin/main`). The change in each must stay one small block.
- `cstack/src/test-run.ts` does not exist on any branch yet (checked with `git fetch` on 2026-11-19). This ticket writes the temporary copy at that same path, so that the merge of #17 replaces it without touching any import.
- `gh pr checks` behaves in a way the code must handle (checked on this repository on 2026-11-19, read-only): with passing checks it prints JSON and exits `0`; with no check it prints "no checks reported on the '<branch>' branch" on standard error and exits `1`; its help says that pending checks exit with `8`. So the exit code alone does not tell a failure of the call from a failing check.
- `gh pr view <branch>` with no pull request exits `1` with "no pull requests found for branch". `gh pr list --head <branch> --state open --json url,headRefOid` prints `[]` and exits `0` (checked on 2026-11-19).
- `glab ci get` prints "no pipeline found" or "No pipelines running or available on branch" when the branch has no pipeline yet (read from the strings of the `glab` 1.119.0 binary on 2026-11-19). `glab mr list` lists only open merge requests by default.
- The tools installed are git 2.55.0, gh 2.101.0 and glab 1.119.0. Git understands `--end-of-options`.

**Governing decisions.** ADR-SIC-H: a command prints through `io`, returns its exit code, and never calls `process.exit()`. ADR-SIC-B: `publish.json` lives in the run folder, not in the plan file. The epic rules: cstack never stores a credential and uses clients that are already logged in (ADR-SIC-F, still to write by #24); no ticket assumes one forge. The settled decision of `resolve-issue`: one push at the end, which `cstack publish` enforces (`cstack/skills/resolve-issue/settled-decisions.md` line 40).

## Decisions

- `cstack publish` turns a broken plan file, a missing plan file, a broken run state and a broken `.cstack/settings.json` into exit code `3` with the reader's message, as the other plan commands do. (2026-11-19, assumption not asked)
- `cstack publish` does not check the start condition of the publish phase (the retrospective done after the last accepted done report). `cstack next` enforces it. The rules that `cstack publish` checks are the ones its ticket lists. (2026-11-19, assumption not asked)
- `publish.json` keeps the type `PublishRecord` of `cstack/src/run-state.ts` unchanged. When a push succeeds before the pull request exists, the push is recorded with `pullRequest` set to an empty string, and the link is filled in once the pull request exists. (2026-11-19, assumption not asked)
- The code that reads and writes `publish.json` lives in a new file of this ticket, never in `cstack/src/run-state.ts`. It writes through `writeFileAtomic`. (2026-11-19, wave instruction)
- Every final message prints the pull request link (when one exists) and the number of pushes, as the total recorded in `publish.json` followed by the number made by this run. (2026-11-19, assumption not asked)
- `--timeout`, `--poll` and `--grace` take whole numbers. `--timeout` and `--poll` must be at least 1, and `--grace` may be 0. Any other value is a usage error, exit code `2`. The timeout counts from the start of the wait for checks, after the last push, not from the start of the command. (2026-11-19, assumption not asked)
- The host is read from the raw remote URL in its usual forms: `https://host/...`, `https://user@host:port/...`, `ssh://user@host:port/...` and `user@host:path`. A remote with no host, such as a local path or a `file://` URL, gives exit code `4` with a message that names the remote URL. On `github.com`, `gh auth status --hostname github.com` must succeed too, otherwise exit code `4`. (2026-11-19, assumption not asked)
- The target branch is fetched with an explicit refspec, `+refs/heads/<target>:refs/remotes/origin/<target>`, so that a clone with a narrow fetch setting still gets `origin/<target>`. (2026-11-19, assumption not asked)
- Every revision or branch name passed to git comes after `--end-of-options`, even though the plan reader already refuses names that start with `-`. (2026-11-19, upstream: comment of #13 on the ticket)
- Every call to `git`, `gh` and `glab` made by `cstack publish` goes through one small function in a file of this ticket, which runs the program with an argument list and no shell. Ticket #24 can then switch it onto the common program runner in one place. (2026-11-19, wave instruction)
- The temporary copy of `cstack/src/test-run.ts` has exactly the exports of the interface fixed for this wave, and lives at that same path so that the merge with #17 replaces it without changing any import. It has no test file of its own, because #17 owns `cstack/test/test-run.test.ts`. Its `runTests` is asynchronous and returns `Promise<TestRun>`: it starts `/bin/sh` in its own process group, kills the whole group at the timeout, and, while the tests run, catches SIGINT and SIGTERM, kills the group and lets cstack exit. The publish tests cover it. In `cstack publish`, any test run that does not exit with `0`, a timeout included, counts as failing tests. (2026-11-19, wave instruction and assumption not asked)
- On GitLab, the pipeline status `success` or `skipped` passes, `failed` or `canceled` fails, and every other status, `manual` included, counts as still running. (2026-11-19, assumption not asked)
- Tests never reach a real forge. They use a local bare repository as the remote, reached through git's `url.<path>.insteadOf` setting, and fake `gh` and `glab` programs on a `PATH` that the test passes to the command. Waiting is injected, so that a test does not sleep for real. No test and no step of this work runs `cstack publish` on this repository or any real repository. (2026-11-19, wave instruction)
- If the tests fail after `cstack publish` updated the branch, the update stays, nothing is pushed, the command prints the last 40 lines of the test output and exits with `1`. It also writes `publish-tests.json` in the run folder, with the `HEAD` commit and the time of the failure. Its message says that the branch now holds the update and that the next run will test again. (2026-11-19, the user's answer)
- While `publish-tests.json` exists, `cstack publish` runs `testCommands.all` before any push, even when nothing needs updating. It deletes the file when the tests pass, and rewrites it when they fail again (exit code `1`, no push). (2026-11-19, the user's answer)
- When the update changed the branch, or the marker file asks for tests, and `.cstack/settings.json` has no `testCommands`, `cstack publish` pushes anyway. It prints one line saying that the tests did not run because `.cstack/settings.json` has no `testCommands`, and it deletes the marker file if there is one. (2026-11-19, the user's answer)
- `cstack publish` refuses with exit code `1`, before any push, when the `Branch` line and the `Target branch` line name the same branch. This rule is listed with the other rules of the ticket. (2026-11-19, the user's answer)
- The rules checked before any push are, all listed at once: no blocking question is open (each open one is named with its number and title); `Status` is `ready for review` and `Ready for review at` holds a time; no tracked file has an uncommitted change (the files are named); the `## Pull request` section has a title and a body that is not empty; the checked-out branch is the `Branch` line (a detached `HEAD` breaks this rule); `git check-ref-format --branch` accepts both branch names and neither starts with `-`; and the two branch names differ. (2026-11-19, ticket scope item 2 and the user's answer)
- On GitHub, an existing pull request is found with `gh pr list --head <branch> --state open --json url,headRefOid,isCrossRepository`, keeping only the entries whose `isCrossRepository` is `false`. The wait on the pushed commit uses `gh pr view <url> --json headRefOid`, and the checks use `gh pr checks <url> --json name,state,bucket,link`. (2026-11-19, the user's answer)
- On GitLab, an existing merge request is found with `glab mr list --source-branch <branch> --output json`, keeping only the entries whose `source_project_id` equals `target_project_id`. Its `web_url` is the link and its `iid` is kept for the pipeline. The pipeline is read with `glab ci get --merge-request <iid> --output json`, never with `--branch`. (2026-11-19, the user's answer)
- Every `gh` call that is about the repository gets `--repo <host>/<owner>/<repo>`, and every such `glab` call gets `-R https://<host>/<path>`, both built from the raw URL of `origin` without its user information. The `auth status` calls take only `--hostname`. (2026-11-19, the user's answer)
- The pull request is created with `gh pr create --base <target> --head <branch> --title=<title> --body-file <file>` or `glab mr create --source-branch <branch> --target-branch <target> --title=<title> --description-file <file> --yes`. The body file lives in a fresh temporary folder that is deleted afterwards. The link is the last line of the client's standard output that starts with `http`, and on GitLab the `iid` is the number after `/-/merge_requests/` in that link. (2026-11-19, ticket scope item 7 and the user's answer)
- `gh pr checks` is judged by its standard output, not by its exit code. JSON on standard output is read whatever the exit code. A message "no checks reported" on standard error means no check yet. Any other failure without JSON is a failed forge call, exit code `5`. A failed `glab ci get` whose standard error matches "no pipeline" (in any case) means no pipeline yet, and any other failure is exit code `5`. A GitLab pipeline whose `sha` is not the pushed commit counts as no pipeline yet. (2026-11-19, tested answer)
- On GitHub, the checks bucket `pass` or `skipping` passes, `fail` or `cancel` fails, and `pending` is still running. (2026-11-19, ticket scope item 9)
- `cstack publish` waits until no check of the pushed commit is still running, then reports every failed or cancelled check at once with its name and link (exit code `6`). At the timeout, a known failure wins and gives exit code `6`, which also names the checks still running. Otherwise checks still running give exit code `7`, with their names. If the pull request never shows the pushed commit before the timeout, the command exits with `7` and says so. (2026-11-19, the user's answer)
- The grace period counts from the first moment the forge shows the pushed commit: on GitHub when `headRefOid` equals the pushed commit, on GitLab from the start of the wait. When no check appears within the grace period, the command prints "no check ran" and exits with `0`. It never exits with `0` for passing checks before the grace period has ended, even when every visible check has passed. (2026-11-19, the user's answer)
- The pushed commit is the local `HEAD` after the push. When no push was needed, it is the local `HEAD`, which then equals the remote branch. (2026-11-19, assumption not asked)
- Every push names the ref explicitly, `refs/heads/<branch>:refs/heads/<branch>`, with `--no-follow-tags`, so that a user setting `push.followTags` can never push a tag. The first push adds `--set-upstream`. cstack never pushes with `--force`, never pushes a tag and never pushes to the target branch. (2026-11-19, ticket scope items 5 and 6, and the wave rule on tags)
- When the branch is already on the remote, `cstack publish` fetches it, never updates or rewrites it, and exits with `1` without pushing when the remote branch head is not an ancestor of the local `HEAD`. When the two are equal, it does not push. (2026-11-19, ticket scope item 5)
- On a conflict during the update, `cstack publish` lists the files in conflict (`git diff --name-only --diff-filter=U`), runs `git rebase --abort` or `git merge --abort`, checks that `HEAD` is back on the commit it had before, and exits with `8`. Any other failure of the update is exit code `5`, after the same abort. (2026-11-19, ticket scope item 4)
- Any URL that cstack prints or forwards (the remote URL, the standard error of `git` or of a client) has its user information removed, which is everything between `://` and `@`. The remote URL is never written into `publish.json`. (2026-11-19, the user's answer)
- When the remote URL is an SSH URL and neither `gh` nor `glab` is logged in for its host, cstack runs `ssh -G <host>`, reads its `hostname` line, and asks both clients again with that host. The call goes through the same program function as the others, without a shell. (2026-11-19, the user's answer)
- A missing `gh` or `glab` program counts as a client that is not logged in. Exit code `4` names the host and both clients, with the reason for each. (2026-11-19, assumption not asked)
- `cstack publish` prints the pull request link, the result and the pushes on standard output when it exits with `0`, and on standard error with the reasons for any other exit code. (2026-11-19, assumption not asked)
- No file of `cstack/src/` runs a program through a shell, except `cstack/src/test-run.ts`, which runs the user's `testCommands` through `/bin/sh -c` on purpose. (2026-11-19, wave instruction)
- Do not build on Graphify or `cstack graph ensure`, and do not remove them: ticket #45 removes them. (2026-11-19, wave instruction)
- When the branch is brought up to date with `main` during this work, merge `origin/main` into it with a merge commit and keep both sides. Never rebase it, and never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the author dates of the plan commits. After the merge, update the counts of built and not-built commands in `cstack/test/manifest.test.ts` and in `README.md`, check `cstack/src/cli.ts` for a function that git kept twice without a conflict marker, and run the whole test suite again. (2026-11-19, wave instruction)
- If another branch of this wave adds `cstack/src/test-run.ts` to `main` first (ticket #17), the merge keeps the copy of #17, deletes the copy of this ticket, and the tests of both tickets run against it. (2026-11-19, wave instruction)
- Publish this branch with the steps of phase 12 (git push and the forge client), never with `cstack publish`. Before the push, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`. Also write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, and run `python3 scripts/private_names.py check <that file>`, which must exit with `0`. Never print the private list. Never change `user.email`. (2026-11-19, wave instruction)
- Never merge the pull request: the user merges it. If the `cstack` check is cancelled with "The job was not acquired by Runner", rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, wave instruction)
- Never run `cstack skills install` against the real home folder, never change anything under `~/.claude/skills/`, never install Graphify, and never read or change anything under `~/comparison/`. (2026-11-19, wave instruction)
- Never edit anything under the top-level `skills/` folder. (2026-11-19, upstream: ADR-SIC-E)
- Changes to `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts` and `README.md` stay one small block each, because the four other tickets of this wave change the same files. (2026-11-19, wave instruction)

## Architecture

The approach is locked by the ticket's contract and the answers of phase 4, so no blueprint was drawn. The command lives in `cstack/src/commands/publish.ts` and only orchestrates: it reads the flags, the plan and the settings, checks the rules, and then calls small modules under a new folder `cstack/src/publish/`, in the order of the ticket's scope. `program.ts` holds the one function that runs `git`, `gh`, `glab` and `ssh` with an argument list and no shell, so that ticket #24 can switch it onto its runner in one place. `remote.ts` reads the host and the repository path from the raw remote URL and removes credentials from any text. `record.ts` reads and writes `publish.json` and the marker file `publish-tests.json` in the run folder. `forge.ts` finds the forge and holds the GitHub and GitLab calls behind one small interface. `branch.ts` reads the remote branch, updates the branch onto its target and pushes. `checks.ts` holds the wait loop, with injected `sleep` and `now` so that tests never wait for real. The exported function is `publish(args, io, deps)`, where `deps` can give `cwd`, `env` (the `PATH` of the fake clients), `sleep` and `now`. `cstack/src/test-run.ts` is the temporary copy of the interface of ticket #17.

## Implementation units

### Unit 1: Temporary copy of the test runner of ticket #17 — status: done
- Failing test: no test. Ticket #17 owns `cstack/src/test-run.ts` and its test file `cstack/test/test-run.test.ts`, and a test file of the same name here would collide at the merge. Unit 7 covers this copy through `cstack/test/publish.test.ts` (passing tests, failing tests and the marker file).
- Minimum code: create `cstack/src/test-run.ts` with exactly the exports fixed for this wave: `DEFAULT_TEST_TIMEOUT_MS = 600_000`, the `TestRun` interface, `testScript(commands, testFile?)`, the asynchronous `runTests(root, script, testFile, timeoutMs?)` that returns `Promise<TestRun>`, and `lastLines(output, count = 40)`. `runTests` spawns `/bin/sh` with the arguments `-c`, the script, `cstack`, and the test file when one is given, with `cwd: root`, `detached: true` so that the shell leads its own process group, and standard output and standard error collected together in the order they arrive. At the timeout it kills the whole group with `process.kill(-pid, "SIGKILL")` and returns `timedOut: true` with `exitCode` undefined. While the tests run, it listens for SIGINT and SIGTERM; on either, it kills the whole group, removes its listeners, and sends the same signal to cstack again so that cstack exits. It removes its listeners when the run ends. Start the file with a `// WHY:` comment saying that it is the temporary copy for ticket #20, that the copy of ticket #17 replaces it at the merge, and that this is the one file of `cstack/src/` that runs a shell on purpose, because `testCommands` is a shell command line by design.
- Refactor: none.
- Commit message: `feat(cli): add a temporary copy of the test runner that ticket 17 owns`
- Depends on: none

### Unit 2: Run a program without a shell, and read the remote URL — status: done
- Failing test: `cstack/test/publish-remote.test.ts`. `parseRemote` gives the host and the repository path for `https://github.com/o/r.git`, `https://user:secret@example.org:8443/group/sub/r.git`, `ssh://git@example.org:2222/group/r.git` and `git@github.com:o/r.git`, with the `.git` suffix removed and the user information dropped, and says that it is an SSH URL for the last two. It gives no host for `/tmp/bare.git` and `file:///tmp/bare.git`. `redact` turns `fatal: unable to access 'https://user:secret-token@example.org/o/r.git/'` into a text with `https://example.org/o/r.git/` and no `secret-token`, and leaves `git@github.com:o/r.git` as it is. `runProgram` passes the argument `$(touch pwned)` to `printf '%s'` byte for byte and no file named `pwned` appears; it reports a program that does not exist as missing; it passes the given `env` to the program.
- Minimum code: `cstack/src/publish/program.ts` exports `runProgram(command, args, options: { cwd: string; env?: NodeJS.ProcessEnv }): { ok: boolean; code: number | undefined; stdout: string; stderr: string; missing: boolean }`, built on `spawnSync` with `encoding: "utf8"` and never `shell: true`. A header comment says that every `git`, `gh`, `glab` and `ssh` call of `cstack publish` goes through this function so that ticket #24 can switch it onto the common runner. `cstack/src/publish/remote.ts` exports `parseRemote(url): { host: string; path: string; ssh: boolean } | undefined` and `redact(text): string`, which removes everything between `://` and `@` in every URL of the text.
- Refactor: none.
- Commit message: `feat(cli): run publish programs without a shell and read the remote url`
- Depends on: none

### Unit 3: Read and write publish.json and the test marker — status: done
- Failing test: `cstack/test/publish-record.test.ts`. In a temporary repository with a plan, `writePublishRecord` then `readPublishRecord` keeps `pullRequest`, every push in order and `checks`. `checkReport` of `cstack/src/report/reports.ts` accepts a `published` report once the record has a link and its last push is `HEAD`, and refuses it while `pullRequest` is the empty string. `readPublishRecord` returns undefined when the file does not exist and throws a `RunStateError` when the file is not valid JSON. `writeTestMarker`, `readTestMarker` and `removeTestMarker` write, read and delete `publish-tests.json` with a `commit` and a `time`, and removing a marker that does not exist does nothing.
- Minimum code: `cstack/src/publish/record.ts` with those five functions, each taking the run folder. They use `PublishRecord` and `writeFileAtomic` from `cstack/src/run-state.ts` without changing that file.
- Refactor: none.
- Commit message: `feat(cli): read and write publish.json and the test marker of a publish run`
- Depends on: none

### Unit 4: The command and its refusals before any push — status: done
- Failing test: `cstack/test/publish.test.ts`, written first with the case of a plan whose blocking question has `- Answer: open`: `cstack publish` exits with `1`, names the question by its number and title, and the bare remote, which logs every push it receives, has received nothing (US-12 AC1). The same holds for a plan whose Status is not `ready for review`. Further cases: several broken rules are listed in one message (a modified tracked file named in the message, a `Branch` line that is not the checked-out branch, a `## Pull request` section with an empty body, `Branch` equal to `Target branch`), always with exit code `1` and no push. A broken `.cstack/settings.json` gives `3`. `--timeout 0`, `--poll abc` and an unknown positional argument give `2`. Also write the test helper `cstack/test/helpers/publish-env.ts`: it creates a repository on `main` with a ready plan committed on a feature branch, a bare repository that logs every push it receives through a `post-receive` hook, the raw `remote.origin.url` `https://github.com/o/r.git` with `url.<bare path>.insteadOf` pointing to the bare repository, `main` already on the bare repository before the log starts, and a folder of fake `gh`, `glab` and `ssh` programs written in Node. The fakes log each call with its arguments, copy any `--body-file` or `--description-file` they receive, and answer from a scenario file in the test folder. By default `gh auth status` succeeds, `gh pr list` and `glab mr list` answer `[]`, `gh pr view` answers the head of the branch in the bare repository, and `gh pr checks` answers "no checks reported" with exit code `1`. The helper returns the `deps` to pass to `publish`, with a `PATH` that starts with the fake folder, a fake `sleep` that moves a fake clock, and that clock as `now`.
- Minimum code: `cstack/src/commands/publish.ts` exports `publish(args, io, deps)`. It parses the flags with `parseArgs` (`--timeout`, `--poll`, `--grace`, `--plan`, defaults 30, 15 and 120), finds the plan with `locatePlan`, reads it with `readPlan`, reads `readSettings(root)`, checks every rule of "Decisions" and lists the broken ones at once. Known errors become their exit codes as in `cstack/src/commands/errors.ts`, and `SettingsError` becomes `3`. In `cstack/src/manifest.ts`, set `built: true` on the `cstack publish` entry and change nothing else in it. In `cstack/src/cli.ts`, import `publish` and add one line `publish: (args, io) => publish(args, io)` to `HANDLERS`. In `cstack/test/manifest.test.ts`, change the counts to eleven built commands and four not built, in the test name and in the two numbers.
- Refactor: none.
- Commit message: `feat(cli): add cstack publish, which refuses to push before the plan is ready`
- Depends on: 2

### Unit 5: Find the forge and a logged-in client — status: done
- Failing test: `cstack/test/publish.test.ts`. With a remote on `github.com` and a fake `gh` that is not logged in, the command exits with `4`, names `github.com` and `gh`, and pushes nothing. With a remote `https://user:secret-token@gitlab.example.org/group/r.git` and neither fake client logged in, it exits with `4`, names the host and both clients, prints the URL without `secret-token`, and pushes nothing. With a remote `git@work-alias:group/r.git`, a fake `ssh` whose `-G work-alias` prints `hostname gitlab.example.org`, and a fake `glab` logged in only for `gitlab.example.org`, the forge is GitLab (the test can stop it later with a rule or check the calls log). A remote that is a local path gives `4` and names the remote.
- Minimum code: `cstack/src/publish/forge.ts` exports `detectForge(root, env)`, which reads `git config --get remote.origin.url`, parses it, uses `gh` for `github.com` after `gh auth status --hostname github.com`, otherwise asks `gh auth status --hostname <host>` then `glab auth status --hostname <host>`, falls back on `ssh -G <host>` for an SSH URL, and returns the forge kind, the host and the repository argument (`<host>/<path>` for `gh`, `https://<host>/<path>` for `glab`), or the reasons for exit code `4`. The command calls it right after the rules.
- Refactor: none.
- Commit message: `feat(cli): find the forge of origin and a logged-in client for cstack publish`
- Depends on: 4

### Unit 6: Push once and open the pull request on GitHub — status: done
- Failing test: `cstack/test/publish.test.ts`. On the GitHub path with the fake `gh`, the bare remote receives exactly one push, of the feature branch, and the fake receives `pr create` once, with `--base main`, `--head <branch>`, the plan's title and a body file equal to the plan's body (US-12 AC2). Every repository call of `gh` carries `--repo github.com/o/r`. `publish.json` holds the link and one push whose commit is `HEAD`. A second run after a new commit, with the fake `gh pr list` now answering the open pull request, opens no second pull request and makes exactly one more push. A second run with no new commit makes no push. When the remote branch has a commit that the local branch lacks, the command exits with `1`, says that cstack never forces a push, and pushes nothing. A title that holds `$(touch pwned)` and a body with backticks reach the fake byte for byte, and no file named `pwned` appears. A local tag `v9.9.9` is never pushed, even with `push.followTags` set to `true`. A pull request listed with `isCrossRepository: true` is ignored, so a new one is created. These tests pass `--grace 0`, so that the default answer "no checks reported" ends the run with `0`.
- Minimum code: `cstack/src/publish/branch.ts` reads the remote branch with `git ls-remote --heads origin`, fetches it, checks that it is an ancestor of `HEAD`, and pushes as "Decisions" says. `cstack/src/publish/forge.ts` gets the GitHub calls to find and create the pull request. The command records each push and the link with `cstack/src/publish/record.ts`, and prints the link and the pushes. Push and forge failures give `5`, with their standard error passed through `redact`.
- Refactor: none.
- Commit message: `feat(cli): push the branch once and open its pull request on GitHub`
- Depends on: 3, 5

### Unit 7: Bring the branch up to date and run the tests — status: done
- Failing test: `cstack/test/publish.test.ts`. When `main` moved on the bare remote, the setting `rebase` puts the branch on top of it, the tests of `testCommands.all` run (a script that writes a file the test checks), and one push follows. The setting `merge` adds a merge commit instead. A conflict makes the command exit with `8`, names the file in conflict, leaves `HEAD` on the commit it had before with no rebase or merge in progress, and pushes nothing. Tests that fail after the update make it exit with `1` with no push, print the end of the test output, and write `publish-tests.json`. A second run without a fix runs the tests again and still pushes nothing. A second run after a fix commit runs the tests, deletes the marker, and pushes once. Without `testCommands`, a moved `main` still leads to one push, and the output says that the tests did not run because `.cstack/settings.json` has no `testCommands`. When `main` did not move, no test runs.
- Minimum code: in `cstack/src/publish/branch.ts`, the update for a branch that is not on the remote yet: fetch the target with an explicit refspec, skip when `origin/<target>` is an ancestor of `HEAD`, otherwise rebase or merge as the `integration` setting says, and abort on a conflict as "Decisions" says. The command then runs the tests through `testScript` and `runTests` of `cstack/src/test-run.ts` when the update changed the branch or the marker file exists, and handles the marker as "Decisions" says.
- Refactor: none.
- Commit message: `feat(cli): bring the branch up to date and run the tests before cstack publish pushes`
- Depends on: 1, 6

### Unit 8: Wait for the checks of the pushed commit on GitHub — status: done
- Failing test: `cstack/test/publish.test.ts`. The fake `gh` first reports an older head commit with a failed check, then the pushed commit with passing checks: cstack waits for the pushed commit, never reports the old failure, and exits with `0` (US-12 AC3). A failed check makes the command exit with `6` and print its name and link. A cancelled check gives `6` too. Checks still pending at the timeout give `7` and name them. One check failed and one still pending at the timeout gives `6` and names both. No check within the grace period gives `0` and the words "no check ran". Checks that all passed before the grace period ended do not end the run until it has ended. A pull request that never shows the pushed commit gives `7`. `publish.json` holds the result of the checks. The fake clock proves that the loop waited `--poll` seconds between two reads.
- Minimum code: `cstack/src/publish/checks.ts` exports the wait loop, which takes the forge, the pull request, the pushed commit, the three durations, `sleep` and `now`, and returns the outcome. The GitHub reading of `headRefOid` and of the checks goes in `cstack/src/publish/forge.ts`, as "Decisions" says. The command maps the outcome to `0`, `6` or `7`, records it, and prints the link, the result and the pushes in every case.
- Refactor: none.
- Commit message: `feat(cli): wait for the checks of the pushed commit before cstack publish ends`
- Depends on: 6

### Unit 9: Publish on GitLab — status: done
- Failing test: `cstack/test/publish.test.ts`. With a remote on another host and a fake `glab` that is logged in, the merge request is created with `glab mr create`, with `--source-branch`, `--target-branch`, the plan's title, a description file equal to the plan's body and `--yes`, and the pipeline of the pushed commit is read with `glab ci get --merge-request <iid> --output json` (US-12 AC4). A pipeline of an older commit is ignored, `success` gives `0`, `failed` gives `6` with the pipeline link and the names of the failed jobs, `running` at the timeout gives `7`, and "no pipeline found" for the whole grace period gives `0` with "no check ran". A merge request whose `source_project_id` differs from its `target_project_id` is ignored. Every repository call of `glab` carries `-R https://<host>/<path>`. With neither client logged in, the command exits with `4`.
- Minimum code: the GitLab calls in `cstack/src/publish/forge.ts`: find and create the merge request, and read the pipeline, with the status mapping of "Decisions".
- Refactor: none.
- Commit message: `feat(cli): publish on GitLab with glab`
- Depends on: 8

### Unit 10: Explain cstack publish in the README — status: done
- Failing test: no test. This unit changes prose only.
- Minimum code: in `README.md`, change "`cstack` has ten commands" to eleven, and add one bullet for `cstack publish` after the bullet of `cstack unit commit`, in the style of the other bullets. It says that the command refuses to publish while the plan is not ready or a blocking question is open, brings the branch up to date and runs the tests, pushes once, opens the pull request or merge request with `gh` or `glab`, and waits for the checks of the pushed commit. Write each fact in its own short sentence.
- Refactor: none.
- Commit message: `docs: explain cstack publish in the README`
- Depends on: 9

## Documentation duties

- The README entry of `cstack publish` and the command count: applies, written to `README.md` by unit 10.
- The closing comment on the ticket, which says what was built, the decisions taken in this run and the known limits: applies, written to issue #20.
- The comment on the ticket that this ticket feeds, the end-to-end run and release of the new skill (#23): applies, written to issue #23. It says how `cstack publish` behaves, its exit codes, the marker file that makes the next run test again, and that `cstack/guides/resolve-issue/publish.md` already matches it.
- An architecture decision record: does not apply. No new structural decision was taken; how cstack reaches forges belongs to ADR-SIC-F, which ticket #24 writes.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. US-12 already describes the behaviour, and the earlier tickets did not mark their stories there.
- The publish guide `cstack/guides/resolve-issue/publish.md`: does not apply. It already says to fix and run again on exit code `1`, and to stop on `4` and `5`.

## Review log

### Impact notes (phase 7)

Graphify is not installed, so the notes come from search and file reads. The branch only adds files, except four small edits: `cstack/src/cli.ts` (one import and one handler line), `cstack/src/manifest.ts` (`built: true` on the publish entry), `cstack/test/manifest.test.ts` (the counts) and `README.md` (the count and one bullet). Nothing outside the diff calls the new modules. `cstack/src/report/reports.ts` reads `publish.json`, and the test of unit 3 checks that it accepts what `record.ts` writes. `cstack/test/cli.test.ts` checks that every built command has a handler and passes. The full suite passes (446 tests) and typecheck is clean. `origin/main` has not moved since the branch was created.

### Findings of the four reviewers (phase 7)

Fixed in commit `bbc6482`, each with a test: the refusal message cut the name of a staged rename; an https remote lost its port for `glab -R`; the test output was printed without removing credentials; a host starting with a dash was accepted; check names could carry terminal control characters; the GitLab "no check ran" message now says that merged results pipelines are not recognised. Cheap simplifications applied: one shared options type, a shared helper to create the request, a JSON parsing helper, and no build-then-strip of the summary line. The conventions review found nothing that breaks a rule.

Left as follow-ups (low confidence or a design question for the maintainer, no change made):
- A branch pushed by hand before `cstack publish` leaves no push in `publish.json`, so `cstack report submit published` refuses. This is the first non-blocking question already recorded.
- `test-run.ts` installs signal handlers, which ADR-SIC-H keeps for `bin.ts`. Ticket #17 owns that file and should keep or remove the handlers on purpose.
- The three forge branches in `publish.ts` could become one forge interface. This is a preference.
- `ProgramResult.code` is not read by any code.
- On GitLab, merged results pipelines are still not matched, as the third non-blocking question says. The command now says so in its message instead of staying silent.

### Independent review and update (phases 8 and 9)

The independent reviewer made one fix (commit `40979ea`): `publish.json` kept the checks result of the previous push when a new push was recorded and the run stopped early, so the old result now goes away at the moment the new push is recorded. It met every acceptance criterion. Judgment calls for the pull request body: the grace period of 120 seconds may be short for a slow GitLab runner, and a stale pipeline then reads as "no check ran"; exit code 4 on `github.com` names only `gh`, because only `gh` is tried there; the code uses `gh pr list --head` and `glab ci get --merge-request`, as the recorded decisions say, and not the commands the ticket text names.

Phase 9: `origin/main` had moved by 49 commits. It was merged in with a merge commit. The conflicts were in `cstack/src/cli.ts` (both imports kept) and `cstack/test/manifest.test.ts` (counts now twelve built and twelve not built). `README.md` now says twelve commands. After the merge the whole suite passes (691 tests), typecheck and build are clean. `cstack/src/test-run.ts` is still not on `main`, so the temporary copy stays.

## Briefing

## Open questions after the build

### Blocking

none

### Non-blocking

These three come from phase 4. The user saw them on 2026-11-19 and agreed that they can wait.

- For the maintainer, later: when a branch was pushed by hand before `cstack publish` (for example the evidence push that a decision may ask for) and nothing new was committed since, `cstack publish` makes no push, so `publish.json` has no push and `cstack report submit published` refuses. Should `cstack publish` record the remote head as a push in that case? Today the retrospective commit always comes after such a push, so the case does not happen in a normal run.
- For the maintainer, later: with `integration: rebase`, a branch that holds a merge of its target branch (as this wave asks each ticket to do) can hit the same conflicts again when `git rebase` flattens that merge, and `cstack publish` then exits with `8`. Should `cstack publish` use `git rebase --rebase-merges`, or refuse to rebase a branch that holds merge commits?
- For the maintainer, later: with GitLab "merged results pipelines", the merge request pipeline runs on a temporary merge commit, so its `sha` is not the pushed commit and `cstack publish` would end with exit code `7`. Should a later ticket match the pipeline through the merge request instead? Nobody could check it without a GitLab account.

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-19: phase 6 started. Ticket #20 got the label `in progress` (GitHub has no states). The branch `gambitl/publish-one-push` already existed and is checked out.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**When the tests fail after the update of the branch, I keep the update and remember the failure, so the next run tests again.** The ticket says to push nothing, but not whether the branch stays updated. If we keep the update and remember nothing, a second run finds nothing to update, runs no test, and pushes broken code. If we put the branch back, the fix cannot be written on top of the update. I recommend keeping the update and writing a small file in the run folder: the next `cstack publish` reruns the tests until they pass.

**I will do this unless you say no**

- Without `testCommands` in `.cstack/settings.json`, I push anyway and say in the message that no test ran. Refusing would block every repository without a settings file, and the checks of the forge run anyway.
- I find the open pull request with `gh pr list --head <branch> --state open`, not `gh pr view`. `gh pr view` gives the same exit code for "no pull request" and a failed call, and it also returns closed ones. I ignore pull and merge requests that come from a fork with the same branch name, and I pass the repository of `origin` to every `gh` and `glab` call.
- I refuse when `Branch` and `Target branch` name the same branch, because cstack would push straight onto it.
- I wait until every check of the pushed commit has ended, then report all failures at once. I never report green before the grace period (`--grace`, 120 seconds) has passed since the push, because some GitHub checks register a few seconds after the first ones.
- On GitLab, I read the pipeline with `glab ci get --merge-request <iid>`, not `--branch`. The help of `glab` itself says that `--branch` misses merge request pipelines, and cstack would then wait until the timeout.
- I hide the user name and token of a remote URL like `https://user:token@host/...` in every message. Otherwise the token ends up in the logs and the retrospective.
- For an SSH alias like `git@github-personal:...`, I ask `ssh -G` for the real host before saying that no client is logged in.

**I checked it myself**

- `gh pr checks` exits with `1` when no check exists yet, like a failed call, so I read its JSON and its message, not its exit code.
- `glab ci get` says "no pipeline found" when no pipeline exists yet. I treat that as "nothing yet", and any other failure gives exit code `5`.

**Good to know**

- With GitLab's "merged results pipelines" (a paid feature), the pipeline runs on a merge commit, not on the pushed commit. I could not check this without a GitLab account.
- If the branch was pushed by hand and nothing is new, `cstack publish` pushes nothing, and `cstack report submit published` then refuses. The retrospective commit avoids this case today.
- With `integration: rebase`, a branch that holds a merge of `main`, as in this wave, can hit the same conflicts again and exit with `8`.

#### Details

The failed tests after an update (draft question 2) is blocking, and no test can answer it: it is a design choice for the developer. Both options in the draft share one gap. `cstack publish` runs `testCommands.all` only when its own update changed the branch (Scope item 4). After a failure, the next run finds `origin/<target>` already in the history, whichever option we take. Either the update was kept, or the executor redid it by hand to write the fix. So the next run tests nothing and pushes. With the update kept and no memory, a rerun without any fix pushes the broken branch. The forge's checks are then the only safety net, and they cost one extra push and exit code `6`. Putting the branch back keeps the contract symmetric with exit code `8`, but the executor then has to redo the update by hand, and the tests are skipped on the next run anyway. My recommendation closes the gap: keep the update, and write a small marker file in the run folder (for example `publish-tests.json` with the `HEAD` commit and the time of the failure), read and written by a new file of this ticket as the wave asks. While the marker exists, `cstack publish` runs `testCommands.all` before any push, even when nothing needs updating, and deletes the marker when the tests pass. The message of exit code `1` says that the branch now holds the update and that the next run will test again. The guide `cstack/guides/resolve-issue/publish.md` already tells the executor to fix and rerun on exit code `1`, so it needs no change. If nobody decides, the draft's default (keep the update, no marker) applies, and the gap stays.

No test command when the update changed the branch (draft question 1) is blocking but a careful developer would accept the recommendation, so it sits in the second group. The default of `testCommands` in `cstack/src/settings.ts` is `undefined`. I keep the draft answer: push, and print one line saying that the tests did not run because `.cstack/settings.json` has no `testCommands`.

Finding the open pull request with `gh pr list` (draft question 3) is blocking, because it changes a command the Scope names, and the draft's test on this repository answered it. Two specialist traps come on top. First, `gh pr list --head <branch>` matches the branch name only, so a pull request opened from a fork with the same branch name would be taken as ours. In a public repository, that can happen. The JSON field `isCrossRepository` tells them apart, so cstack asks for it and drops the ones where it is `true`. On GitLab, the merge request object has `source_project_id` and `target_project_id`, and cstack keeps only the ones where they are equal. Second, `gh` and `glab` choose their repository from the git remotes and from `gh repo set-default`, not from `origin` alone. In a clone with an `upstream` remote, `gh pr create` without `--repo` can target the other repository, or fail without a prompt because standard input is not a terminal. cstack already parses the host from `origin`, so it can build `<host>/<owner>/<repo>` and pass `--repo` to `gh` and `-R` to `glab` on every call. The tests keep working, because the fake clients ignore the flag and the raw URL still names `github.com`. Rejected option: rely on the clients' own choice, which works on the maintainer's clone and breaks silently on a fork clone. Pass the title as `--title=<title>` too, so that a title that starts with `-` can never be read as a flag.

Refusing when `Branch` equals `Target branch` (draft question 4) is blocking, because it adds a rule to the list in the Scope, and it cannot be tested. I keep the draft recommendation.

Waiting for all checks (draft question 5) is blocking, because it changes when exit code `6` happens, and it cannot be tested. I keep the draft recommendation and add one rule. On GitHub, checks register one by one: a fast status from an app can appear and pass before the GitHub Actions workflows have created their own check runs. A loop that stops as soon as "no check is pending" can then report green with half the checks missing. So cstack never ends with exit code `0` before `--grace` seconds have passed since the push, even when every visible check has passed. This costs at most two minutes and only when everything is green very fast. The same rule protects GitLab, where the pipeline of a new push appears a few seconds after it. Rejected option: `gh pr checks --watch`, which has the same race and blocks without the JSON cstack needs.

Reading the GitLab pipeline with `glab ci get --merge-request <iid>` is my own point. It is blocking, because it changes a command the Scope names, and I answered it by reading the client. The help of `glab ci get` in version 1.119.0 says that `--merge-request` targets the head pipeline of a merge request, and that this "differs from `--branch` when the MR's head pipeline diverges from the latest pipeline on its source branch — for example, forks or detached pipelines". Many GitLab projects run only merge request pipelines (rules on `merge_request_event`). On a second publish, `--branch` would then return the old branch pipeline of the first push, whose `sha` never equals the pushed commit, and cstack would wait until exit code `7` at the timeout. The merge request always exists when cstack reads the checks, because step 7 comes before step 8, and the `iid` is in the JSON of `glab mr list`. Acceptance criterion US-12 AC4 still holds, because the call is still `glab ci get`. The fake `glab` of the tests must answer `--merge-request` instead of `--branch`.

Hiding credentials in the remote URL is my own point, and it is not a question. The plan's Decisions say that exit code `4` prints the remote URL, and exit code `5` will usually forward the standard error of `git push` or of the client. A remote set as `https://user:token@host/owner/repo.git` is common on CI machines and with some credential setups. Its token would land in the terminal, in the executor's report, and from there in the retrospective, which this public repository commits. cstack removes the user-information part (everything between `//` and `@`) from any URL it prints or forwards. It also never writes the URL into `publish.json`, whose `pullRequest` holds only the link returned by the forge.

Resolving SSH host aliases is my own point, and it is not a question. People with two GitHub accounts often use an alias from `~/.ssh/config`, such as `git@github-personal:owner/repo.git`. The host parsed from that URL is `github-personal`, so neither `gh auth status --hostname` nor `glab auth status --hostname` succeeds, and cstack exits with `4` although the user is logged in. When the URL is an SSH URL and neither client accepts its host, cstack runs `ssh -G <host>`, reads its `hostname` line, and tries again with that host. The call goes through the same small program function as the others. If nobody objects, a user with an alias simply gets a working publish instead of exit code `4`.

The tested behaviour of `gh pr checks` (draft question 6) and the strings of `glab ci get` (draft question 7) are blocking questions that the draft answered with evidence. I checked the evidence against `gh pr checks --help` and the `glab` binary on 2026-11-19, and it holds. The string "no pipeline found for branch %s and failed to find associated merge request" also shows that `glab ci get --branch` looks for a merge request only when the branch has no pipeline at all, which supports the switch to `--merge-request` above.

GitLab merged results pipelines are a non-blocking known limit. With that feature, the merge request pipeline runs on a temporary merge commit, so its `sha` is not the pushed commit, and cstack would time out with exit code `7`. No GitLab account was available to check it. A later ticket can match the pipeline through the merge request's own `sha` and the pipeline's creation time. The work of this ticket stays complete and correct for the default GitLab setup.

The branch pushed by hand before `cstack publish` (draft question 8) and the rebase of a branch that holds a merge of its target (draft question 9) are non-blocking, for the developer, later. I keep the draft answers and list them only as facts to keep in mind.

Locked decisions I did not reopen: the single push (`cstack/skills/resolve-issue/settled-decisions.md` line 40), ADR-SIC-B for the place of `publish.json`, ADR-SIC-H for exit codes through `io`, and the wave instructions on the program function and the copy of `cstack/src/test-run.ts`.

I checked data model lock-in, scale and performance, and operations and cost, and found nothing: `publish.json` keeps its type, the polling is bounded by `--timeout`, and no new service or bill appears.

### Open questions and answers

1. **No test command is set, and the update changed the branch.** Label: blocking. It cannot be tested: it is a design choice. For the user. The default value of `testCommands` in `cstack/src/settings.ts` is `undefined`, so a repository without `.cstack/settings.json` has no test command. Recommended answer: push anyway, and print a line saying that the tests did not run because `.cstack/settings.json` has no `testCommands`. Refusing would block every publish in a repository without a settings file each time its target branch moved, and the checks of the forge still run on the push.

   Answer (2026-11-19, the user, who accepted the list "I will do this unless you say no"): push anyway, and print a line saying that the tests did not run because `.cstack/settings.json` has no `testCommands`.

2. **The tests fail after `cstack publish` updated the branch.** Label: blocking. It cannot be tested: it is a design choice. For the user. The ticket says to push nothing and exit with `1`, but not whether the update stays. Recommended answer: keep the updated branch, so that the fix goes on top of it, and say in the message that the branch now holds the update. The risk is a second run without a fix: it finds nothing to update, runs no test, and pushes; the checks then fail and the command exits with `6`. The other option is to put the branch back as it was, as after a conflict, so that a second run updates and tests again. Then the executor has to redo the update itself to fix the tests.

   Answer (2026-11-19, the user accepted the advisor's recommendation): keep the updated branch, and write a marker file `publish-tests.json` in the run folder with the `HEAD` commit and the time of the failure. While the marker exists, `cstack publish` runs `testCommands.all` before any push, even when nothing needs updating, and deletes the marker when the tests pass. The message of exit code `1` says that the branch now holds the update and that the next run will test again.

3. **Find an existing pull request with `gh pr list` instead of `gh pr view <branch>`.** Label: blocking, because it changes a command that the ticket names. Tested answer: on 2026-11-19, on this repository, `gh pr view no-such-branch-for-test-xyz --json url,headRefOid` printed "no pull requests found for branch" and exited with `1`, the same exit code as a failed call. `gh pr list --head no-such-branch-for-test-xyz --state open --json url,headRefOid` printed `[]` and exited with `0`. Also, `gh pr view <branch>` can return a closed or merged pull request of the same branch, and then cstack would not open a new one. Recommended answer: use `gh pr list --head <branch> --state open --json url,headRefOid`, then `gh pr view <url> --json headRefOid` for the wait on the pushed commit, and `gh pr checks <url> --json name,state,bucket,link` for the checks. On GitLab, `glab mr list --source-branch <branch> --output json` already lists only open merge requests.

   Answer (2026-11-19, the user): accepted, with the advisor's additions. Pull requests from a fork (`isCrossRepository` true) and merge requests whose `source_project_id` differs from `target_project_id` are ignored. Every `gh` call gets `--repo <host>/<owner>/<repo>` and every `glab` call gets `-R` with the repository of `origin`. The title is passed as `--title=<title>`.

4. **Refuse when the `Branch` line equals the `Target branch` line.** Label: blocking, because it adds a rule to the list of the ticket. It cannot be tested: it is a design choice. Recommended answer: add it to the rules checked before any push. Without it, a plan whose two lines both say `main` would make cstack push straight onto `main`, and the pull request would then fail.

   Answer (2026-11-19, the user): accepted.

5. **When several checks run, wait until all of them end before reporting.** Label: blocking, because it changes when exit code `6` happens. It cannot be tested: it is a design choice. Recommended answer: wait until no check of the pushed commit is pending, then report every failed or cancelled check at once, so the executor fixes them all in one push. At the timeout, a known failure wins over pending checks, so the command exits with `6` and also names the checks still running. Reporting at the first failure would save some waiting, but it can cost one more push for each check that fails later.

   Answer (2026-11-19, the user): accepted, with the advisor's addition: cstack never ends with exit code `0` before `--grace` seconds have passed since the pull request showed the pushed commit, even when every visible check has passed.

6. **Tested: `gh pr checks` does not tell a failed call from failing checks by its exit code.** Label: blocking, answered by a test. On 2026-11-19, `gh pr checks 42 --json name,state,bucket,link` printed JSON and exited with `0`. `gh pr checks 1 --json name,bucket` printed "no checks reported on the 'sync-graphify-rename' branch" on standard error and exited with `1`. Its help says that pending checks exit with `8`. Answer: the code reads the JSON on standard output whatever the exit code, treats the "no checks reported" message as "no check yet", and treats any other failure without JSON as a failed forge call (exit code `5`).

7. **Tested: what `glab ci get` says when the branch has no pipeline yet.** Label: blocking, answered by reading the `glab` 1.119.0 binary on 2026-11-19. Its messages are "no pipeline found. It might not exist yet. Check your pipeline configuration", "No pipelines running or available on branch: %s" and "no pipeline found for branch %s and failed to find associated merge request". Answer: a failed `glab ci get` whose standard error matches "no pipeline" (in any case) means "no pipeline yet". Any other failure is a failed forge call (exit code `5`). The JSON fields `sha`, `status`, `web_url` and `jobs` come from the GitLab pipeline object; no GitLab account was available to confirm them on a real server.

8. **A branch pushed by hand before `cstack publish`, whose remote head already equals `HEAD`.** Label: non-blocking. For the user, later. This happens after the evidence push that the executor may make when a decision asks for it. `cstack publish` then makes no push, `publish.json` has no push, and `cstack report submit published` refuses with "publish.json has no push". Recommended answer: leave it for now, because the retrospective commit always comes after such a push, so a later `cstack publish` has a new commit to push. Open, not needed for this ticket.

9. **With `integration: rebase`, a branch that holds a merge of its target branch.** Label: non-blocking. For the user, later. This wave asks each ticket to merge `origin/main` into its branch. If the target moves again afterwards, `git rebase origin/<target>` flattens that merge and can hit the same conflicts again, so `cstack publish` exits with `8`. Recommended answer: keep the ticket's plain `git rebase`, and note it as a known limit. Open, not needed for this ticket.

10. **Read the GitLab pipeline with `glab ci get --merge-request <iid>` instead of `--branch`.** Raised by the advisor. Label: blocking, answered by reading the help of `glab ci get` 1.119.0, which says that `--merge-request` targets the head pipeline of a merge request and differs from `--branch` for merge request pipelines. Answer (2026-11-19, the user): accepted.

11. **Hide the credentials of a remote URL.** Raised by the advisor. Answer (2026-11-19, the user): accepted. cstack removes the user information (everything between `//` and `@`) from any URL that it prints or forwards, and never writes the remote URL into `publish.json`.

12. **Resolve an SSH host alias with `ssh -G`.** Raised by the advisor. Answer (2026-11-19, the user): accepted. When the remote URL is an SSH URL and neither client accepts its host, cstack runs `ssh -G <host>`, reads its `hostname` line, and tries both clients again with that host.

13. **GitLab merged results pipelines.** Raised by the advisor. Label: non-blocking. With that feature, the merge request pipeline runs on a temporary merge commit, so its `sha` is not the pushed commit and cstack would end with exit code `7`. No GitLab account was available to check it. Open, not needed for this ticket.

### Architecture options

No real choice remained after phase 4, so no blueprint was drawn. No new decision since phase 4.
