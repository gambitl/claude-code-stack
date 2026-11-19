# Plan: #28 — M3-5: Give each parallel implementer its own child worktree

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/28
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/child-worktrees
Target branch: main
Conversation language: French
Status: ready for review
Approved at: 2026-11-19T16:58:06+01:00
Ready for review at: 2026-11-19T17:32:58+01:00

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** When several implementers work at the same time, each gets its own copy of the code, and cstack then gathers their work onto the ticket's branch in a fixed order.

- **What the title means**: cstack is the command-line tool that this project builds. The plan of a ticket splits the work into small units. An implementer is the helper agent that builds one unit of the plan. "Parallel" means that several implementers work at the same time. A worktree is a second working folder of the same git repository, with its own branch. A child worktree is a worktree that Orca creates for a helper and records under the worktree of the agent that started it. Orca is a desktop app that runs several coding agents side by side.
- **Why we are doing it**: The retrospectives report implementers that run in parallel and collide in the same folder. For example, one implementer's test run can pick up another one's half-written code.
- **For the user**: A solution engineer gets parallel units that cannot disturb each other. They still get one clean branch, where each unit's commits sit together, in the order of the plan.

**Goal.** This ticket gives each implementer that runs in parallel its own Orca child worktree, and brings its commits back onto the ticket branch in plan order (US-13). Greenfield: nothing exists yet.

### Where things are today (read first)

* **cstack**: Greenfield: no existing surface. When this ticket was written, cstack did not exist yet. #27 writes `cstack helper start`, `wait` and `done`. #18 writes `cstack unit commit` and `cstack unit order`. #17 saves the failing test run of each unit in the run folder of #13. #11 writes `cstack measure`, which finds the sessions of a run by their working folder.
* **The problem**: `docs/projects/skills-into-cli.md` (line 15): The retrospectives report implementers that run in parallel and collide in the same worktree. Line 172 holds US-13 AC2.
* **Parallel units today**: `skills/resolve-issue/agents/executor.md` (line 40): The executor runs each unit in a fresh sub-agent, and independent units run in parallel, all in the same folder. Line 41 relaunches a stuck unit with the same inputs and the stuck report. `skills/resolve-issue/SKILL.md` (line 146) asks for independent units to run in parallel.
* **What an implementer does with git**: `skills/resolve-issue/agents/implementer.md` (line 34): The implementer commits with the unit's commit message and does not push. Line 38 forbids it to update the plan file, because other units may write at the same time. Line 49 says that a stuck implementer leaves its uncommitted changes in place for the next agent.
* **Orca child worktrees, version 1.4.259 (from `orca orchestration worker-start --help`)**: `--worktree new-child` creates a new worktree recorded under the caller's workspace. `--base-branch <ref>` chooses the branch or commit it starts from. `--name <name>` gives it a name. The help says that a worker started in a new worktree is kept open, so the caller must release it. `orca orchestration worker-release --dispatch <id>` releases a finished worker. `orca worktree rm --worktree <selector>` removes a worktree and keeps its local branch unless `--delete-branch` is passed. It refuses the selectors `current` and `active`.
* **Contract**: #24 gives the feature "child worktrees", available when Orca workers are available. It adds the option `--child-worktree` to `cstack helper start` and the command `cstack unit collect <n>...` to `cstack/src/manifest.ts`. It also adds the optional unit line `- Worktree: <absolute path>` to the plan format of #13, which cstack writes and never a person. #27 starts a helper with `worker-start`, keeps a record of it in `<run folder>/helpers/<helper id>.json`, and ends it with `cstack helper done <kind> --helper <helper id>`, which sends `worker_done`. `cstack unit order` of #18 prints the units in batches. The units of one batch share no file and can run at the same time, and the batches run one after the other. #18 also makes `cstack unit commit` stage only the files of one unit and add the git trailer `Cstack-Unit: <n>` (decision 6). A git trailer is a `Key: value` line at the end of a commit message. From #13, the run folder is `<common git folder>/cstack/runs/<plan file name without .md>/`, which every worktree of the repository shares. Each worktree names its run in `<worktree git folder>/cstack/current-run`.

### Scope

1. Add `--child-worktree` to `cstack helper start implementer --plan <file> --unit <n>`, in `cstack/src/helper/start.ts`.
   - When child worktrees are available and the unit's batch in `cstack unit order` holds more than one unit, cstack runs `worker-start` with `--worktree new-child --base-branch <ticket branch> --name <ticket branch>-unit-<n>`. Everything else stays as in #27.
   - Before it starts, cstack checks that the ticket worktree has no uncommitted change, apart from the plan file. A child worktree starts from the last commit, so it would miss such a change. When there is one, cstack refuses with `1` and names the files. The plan file is left out of the check, because cstack itself writes the `Worktree` lines below while units run.
   - After the start, cstack writes the path and the branch of the child worktree into the helper record of #27. It reads them from the `worker-start` answer, or from `git worktree list --porcelain` when the answer does not hold them. Orca may add a prefix to the branch name, so cstack never guesses it.
   - cstack writes the run's name into the `current-run` file of the child worktree. The implementer's `cstack unit red`, `cstack unit green` and `cstack helper done` then use the same run folder as the ticket worktree.
   - cstack writes the line `- Worktree: <absolute path of the child worktree>` into the unit in the plan file of the ticket worktree. It writes the path with its symbolic links resolved, because the folder may be gone when someone reads the line. The line stays after the child worktree is removed, because #31 makes `cstack measure` count the sessions that ran in that folder. The executor commits the plan file with this line, at the latest before `cstack report submit done` of #16, which refuses a plan file with uncommitted changes.
   - When child worktrees are not available, or the unit must run alone, cstack starts the implementer in the current worktree, as #27 does. It says why in one sentence.
2. The implementer works in its child worktree as it does today. It commits with `cstack unit commit`, so each commit carries `Cstack-Unit: <n>`. It ends with `cstack helper done` of #27.
3. Write `cstack unit collect <n>...` in `cstack/src/unit/collect.ts`. The executor runs it in the ticket worktree, once every unit that ran at the same time has reported. It brings the units back in plan order, whatever the order of the numbers on the command line.
   - For each unit, it lists the commits of the child branch that the ticket branch does not have, oldest first, with `git rev-list --reverse <ticket branch>..<child branch>`.
   - It checks that each commit carries `Cstack-Unit: <n>` and touches only the files that the plan lists for unit `n`. When one commit fails a check, cstack applies nothing for that unit and names the commit.
   - It applies the commits onto the ticket branch with `git cherry-pick`, in their order. A cherry-pick copies a commit onto the current branch.
   - When a cherry-pick stops on a conflict, cstack runs `git cherry-pick --abort`. The ticket branch goes back to where it was before this unit. cstack stops and reports the unit and the files. This should not happen, because units that share a file never run at the same time.
   - It skips a unit that reported stuck or that has no commit, and names it in its output.
4. The saved test runs of #17 need no copy. ADR-SIC-B keeps them in the run folder under the common git folder, which the child worktree shares with the ticket worktree. Check that a failing run saved in a child worktree is visible from the ticket worktree after the collect.
5. After a unit is collected, cstack releases its worker with `worker-release` and removes its child worktree with `orca worktree rm --worktree path:<child path>`. The child branch stays. cstack never removes a child worktree that holds uncommitted changes.
6. A stuck unit keeps its child worktree. `cstack helper start implementer-escalation --plan <file> --unit <n>` starts the second attempt in that same worktree, with `--worktree path:<child path>`, so that it can continue from the changes that the first attempt left.
7. This item was removed on 2026-11-19. It checked `cstack graph ensure` of #19 in a child worktree. Graphify was dropped on that day, so that command will not be built (#45).
8. Record the choice below in the code, as a `WHY:` comment above `collect`. The specification does not say how the work of a child worktree comes back. cstack copies each unit's commits onto the ticket branch in plan order. The branch then reads as if the units had run one after the other, with each unit's commits together. Commit hashes change on the way, but `cstack plan status` of #16 finds a unit's commits by their trailer, not by their hash. A merge commit for each unit was rejected, because it would add one commit per unit that carries no change of its own.
9. Replace the placeholder handler of `cstack unit collect`.

### Acceptance (TDD)

* `cstack/test/helper/child-worktree.test.ts`: This test carries US-13 AC2: "When Orca is available, each implementer that runs in parallel works in its own child worktree." Write first a case with two units that `cstack unit order` of #18 puts in the same batch. See each `worker-start` call hold `--worktree new-child`, the ticket branch as `--base-branch`, and its own `--name`. Two units that share a file never start at the same time. When the ticket worktree has an uncommitted change outside the plan file, cstack refuses with `1` and starts nothing. Without child worktrees, the implementer starts in the current worktree.
* `cstack/test/unit/collect.test.ts`: This test uses real git in a temporary repository. Write first a case with two child branches, one commit each with its trailer, and the command `cstack unit collect 2 1`. See unit 1 applied before unit 2 on the ticket branch, and `cstack plan status` report both units done. A commit without the trailer is refused, and the ticket branch stays unchanged. A commit that touches a file of another unit is refused. A forced conflict ends with the cherry-pick aborted and the branch unchanged. A stuck unit is skipped and named.
* `cstack/test/unit/collect-test-runs.test.ts`: This test uses real git worktrees. Write first a case where unit 1 saves its failing test run in its child worktree. See `cstack plan status` in the ticket worktree report that run after `cstack unit collect 1`, without any copy.
* `cstack/test/helper/worktree-line.test.ts`: Write first a case where `cstack helper start implementer --unit 2 --child-worktree` starts a child worktree. See the plan file of the ticket worktree gain the line `- Worktree: <child path>` under unit 2, and see the child's `current-run` name the same run. The uncommitted plan file does not stop the start of unit 3. After the collect and the removal of the child worktree, the line is still there.
* `cstack/test/unit/collect-cleanup.test.ts`: Write first a case where the child worktree still holds an uncommitted file. See that cstack does not remove it. After a clean collect, cstack runs `worker-release` and `worktree rm`, without `--delete-branch`.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* `cstack unit collect` never pushes and never rewrites a commit that is already on the ticket branch. No `git push`, no `git reset --hard` and no `--force` appear among the recorded calls.

**Size: M** · Blocked by: #27, #18 · Feeds: #31

### Decisions already taken upstream

From the epic, issue #6 (https://github.com/gambitl/claude-code-stack/issues/6), section "Open questions and decisions", copied verbatim:

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
- ADR-SIC-F, how `cstack` reaches trackers and forges, exists in `docs/decisions/ADR-SIC-F-tracker-access.md`. `cstack` never holds credentials. Ticket #24 wrote it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

ADRs that exist on `main` and that this ticket must respect:

- [ADR-SIC-A, how the helpers run](../decisions/ADR-SIC-A-helpers.md). Helpers run as Orca workers when Orca is available, and as Claude Code sub-agents otherwise.
- [ADR-SIC-B, where the run state lives and how its format is versioned](../decisions/ADR-SIC-B-run-state.md). The run folder sits under the common git folder, which every worktree of the repository shares.
- [ADR-SIC-C, how cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md).
- [ADR-SIC-D, the settings file and the model of the review agent](../decisions/ADR-SIC-D-settings-file-and-review-model.md).
- [ADR-SIC-E, the new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final` and are never edited.
- [ADR-SIC-F, how cstack reaches trackers and forges](../decisions/ADR-SIC-F-tracker-access.md). `cstack` never holds credentials, and it calls Orca only through its own runner, without a shell.
- [ADR-SIC-H, how a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md). A command prints through `io` and returns its exit code. No code calls `process.exit()`.

The instructions of the coordinator of this wave, given on 2026-11-19:

- This ticket starts while the end of wave 7 is still open. Tickets #25, #26 and #27 are merged on `main`. Ticket #29 (`cstack wave`) has its pull request #56 open. The worker of #26 is opening a small pull request that wires the Jira and Linear adapters into `cstack/src/tracker/open.ts`. No other open branch changes `cstack/src/helper/`.
- This ticket touches `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/src/cli.ts`, as #29 does. It may also touch `README.md` and `docs/projects/skills-into-cli.md`. Keep the changes to those shared files small and in their own place. Change only the manifest entries of this ticket, which are `cstack unit collect` and the flag `--child-worktree` of `cstack helper start`. Today `notBuiltFlags` still names that flag.
- Today `main` has 21 built commands and 2 that are not built yet, which are `cstack unit collect` and `cstack wave`. When #56 merges first, `main` will have 22 built and 1 not built. Update the counts in `cstack/test/manifest.test.ts` and in `README.md` from what `main` says when the branch is updated.
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, keep both changes, and push with a plain `git push`, without force. In both cases, update the counts of built and not-built commands and run the whole test suite again. Before committing a rebase or a merge, search every file that had a conflict for a leftover conflict marker, and for a function or a shape that git kept twice.
- A new worktree has no `node_modules`, so run `npm ci` in `cstack/` before the first type check or test run. The full suite takes about 90 to 100 seconds, so give it a timeout above 120 seconds or run it in the background. The test "names a unit without a commit" in `cstack/test/report.test.ts` sometimes goes past its 5-second timeout in a full run, and passes when run again.
- `cstack/test/manifest-implemented.test.ts` compares the usage line that a built command prints with its line in `cstack/src/manifest.ts`, word for word. A unit that sets `built: true` must list the command file and `cstack/test/cli.test.ts` in its `Files` line. `cstack unit green` runs only the test file of the unit's `Test` line, so a unit that changes two test files runs the second one by hand before the commit.
- Never edit anything under `skills/`. New skill files go under `cstack/skills/` and `cstack/guides/`. This ticket may change the agent prompts under `cstack/skills/resolve-issue/agents/`.
- When the branch is updated onto `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never push a tag that starts with `v`.
- Tests use the fake run function of #24 and the recorded answers for `orca`. A test never runs the real `orca`, `gh` or `glab`, and never reaches the network. The tests that need real git run only in temporary folders that the test creates and deletes.
- The run of this ticket is itself an Orca worker of the coordinator's run. Never run `cstack helper start`, `wait`, `done` or `cstack unit collect` against Orca for real. Never run `orca orchestration` or `orca worktree` commands that start, send, release, create or remove something. Never run `git worktree add` or `git worktree remove` on this repository or on its worktrees, only inside the temporary repositories that the tests create.
- The ticket quotes the help of Orca 1.4.259, and the installed Orca is 1.4.263. If an answer that #24 and #27 did not record is needed, ask the user before running any `orca` command for real. Run only commands that read, and scrub every path of this machine before an answer goes into a fixture.
- Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or `npm run build` in `cstack/` and then `node cstack/dist/bin.js`.
- Never change `.cstack/settings.json` in this branch.
- Never merge the pull request. The user merges it. Never read, run or change anything under `~/comparison/`. Never install Graphify or Repowise.
- Follow the public text rule of the conventions file in files, commits, the pull request, ticket comments, the plan file and the retrospective. Never change the git `user.email`, and never commit with another address.
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`. It must exit 0. Never print the private list.
- GitHub issues have no "in progress" or "in review" state. Use the labels `in progress` and `in review` instead.
- If the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", rerun it with `gh run rerun <run id>`.

## Dependencies

clear

Both blockers are done. #18 (commit one unit at a time and order the units that share files) and #27 (run the helpers as Orca workers) were closed as completed, and their code is on `main`.

## Code mapping

The helper commands of #27 live in `cstack/src/helper/`, with thin command files in `cstack/src/commands/helper-*.ts`. This ticket adds to them. Line numbers are those of `main` at `21521d3`.

### Entry points

- `startHelper` in `cstack/src/helper/start.ts` (line 108) reads the plan and refuses a plan that is not approved. It then finds the inputs, asks Orca whether workers are available, writes the spec file and runs `orca orchestration worker-start ... --worktree current` (line 149). When Orca answers with a Dispatch id, it creates the helper record with `mode: "orca-worker"` (line 169). When workers are off or Orca refuses clearly, `fallback` (line 67) creates a record with `mode: "sub-agent"` and exits with 6.
- `helperStart` in `cstack/src/commands/helper-start.ts` reads the command line. Its usage line already names `[--child-worktree]`, but `parseArgs` does not accept that flag yet (line 22).
- `HelperRecord` in `cstack/src/helper/record.ts` (line 12) has no field for a worktree yet. `createRecord` never replaces a record. `updateRecord` merges new fields into one.
- `findInputs` and `buildSpec` in `cstack/src/helper/spec.ts` build the spec text that the worker receives. The spec holds absolute paths: the repository root, the plan file, the conventions file, and the `--plan` of the `cstack helper done` command line.
- In `cstack/src/manifest.ts`, the entry of `cstack helper start` (lines 239 to 254) names `--child-worktree` in `notBuiltFlags` with ticket 28. The entry of `cstack unit collect <n>...` (lines 275 to 281) has `built: false` and the command file `unit-collect.ts`.
- In `cstack/src/cli.ts`, the `unit` dispatch (lines 87 to 91) holds `order`, `commit`, `red` and `green`. The new `collect` goes there.
- `orderUnits` in `cstack/src/plan/order.ts` is pure and returns the `batches` of `cstack unit order`. `cstack/src/commands/unit-order.ts` reads the plan and the units that already have a commit, then calls it.
- `listUnitCommits` in `cstack/src/plan/commits.ts` finds the commits of `HEAD` that the target branch does not have, grouped by their `Cstack-Unit` trailer. `listCommitFiles` lists the files of each commit.
- `readPlan` in `cstack/src/plan/read.ts` already reads the optional `- Worktree:` line of a unit (line 392). It must hold one absolute path. The unit lines come in a fixed order, and `Worktree` comes last, after `Blocked` (lines 286 to 299). No code writes a unit line yet. The only writer of the plan file is `setHeaderValues` in `cstack/src/plan/header-write.ts`, and it changes header lines only.
- `runFolder`, `gitFolders`, `currentRunPath`, `writeCurrentRun` and `readCurrentRun` are in `cstack/src/run-state.ts`. `locatePlan` in `cstack/src/plan/locate.ts` finds the plan from `--plan`, or else from the `current-run` file of the worktree. It joins the plan path to the root of the current worktree (line 62), and it refuses a plan path outside that root.
- `saveUnitReport`, `latestUnitReport` and `latestStuckReportPath` in `cstack/src/report/reports.ts` (lines 193 to 238) keep the unit reports in `<run folder>/units/<n>/reports/`.
- `orcaFeatures` in `cstack/src/orca/features.ts` detects the Orca features. The feature `child-worktrees` (line 128) checks only the four worker commands. It does not check `orchestration worker-release` or `worktree rm`, which the recorded `agent-context` answer of Orca 1.4.263 lists.

### Patterns to follow

- A command prints through `io` and returns its exit code, as ADR-SIC-H says. Command files turn the known errors into exit codes with `failWith` of `cstack/src/commands/errors.ts`.
- git runs through `spawnSync` with a list of arguments, never through a shell. Orca runs through `callOrca` and a runner, which adds `--json`. Orca answers go through `parseAnswer` and `checkShape` of `cstack/src/orca/shapes.ts`.
- The logic of a command lives in a folder of its area, such as `cstack/src/helper/`, behind a thin command file in `cstack/src/commands/`. The ticket names `cstack/src/unit/collect.ts`. That folder does not exist yet, but it follows the same pattern.
- The tests of #27 in `cstack/test/helper/start.test.ts` build a temporary repository with `makeRepo` and `commitPlan` of `cstack/test/helpers/plan-repo.ts`. They answer Orca calls from the recorded files in `cstack/test/fixtures/orca/1.4.263/`. `commitFiles` in the same helper file commits files with a `Cstack-Unit` trailer. `cstack/test/fakes/orca-run.ts` is the fake run function of #24, which records every call.

### Constraints found in the code

- The spec of a worker holds the absolute paths of the ticket worktree. A worker in a child worktree must get paths inside its own worktree, or it would read and edit the files of the ticket worktree. But Orca creates the child worktree during `worker-start`, so its path is known only after the spec is written.
- `locatePlan` refuses a `--plan` path outside the root of the current worktree. An implementer in a child worktree therefore cannot use the plan file path of the ticket worktree.
- A child worktree starts from the last commit of the ticket branch, so its plan file is the committed version. The `Worktree` lines and any later change to the plan file in the ticket worktree do not reach it. This matters when the executor adds a file to the `Files` line of a stuck unit before the second attempt, which then runs in the same child worktree.
- A new worktree has no installed packages, such as `node_modules`. The test command of a unit fails in a child worktree until someone installs them. The ticket does not say who does it.
- Orca adds its own prefix to branch names. The Orca worktrees of this repository have branches named `gambitl/<name>` and folders named `<workspace folder>/<name>`. The ticket branch already holds a slash, so `--name <ticket branch>-unit-<n>` could give the branch `gambitl/gambitl/child-worktrees-unit-2` and a nested folder. The recorded `worker-start` answer was written by hand and holds no worktree path or branch.
- The WHY comment at the top of `cstack/src/helper/start.ts` says that no plan text reaches an Orca command line. The ticket branch for `--base-branch` and `--name` comes from the plan header, unless cstack reads it from git.
- `checkExecutor` in `cstack/src/report/reports.ts` (line 88) refuses a done report while the worktree has any uncommitted change. So the executor must commit the `Worktree` lines before its done report.
- `checkImplementer` (line 107) looks for the unit commit from the root of the worktree where `cstack helper done` runs. In a child worktree, that is the child branch, which has the commit.
- No code compares the `commit` field of a saved test run with the branch. The new hashes after a cherry-pick break no check.
- The guides and agent prompts under `cstack/guides/resolve-issue/` and `cstack/skills/resolve-issue/agents/` do not call `cstack helper start` yet. Ticket #31 wires the Orca features into the guides.

### Risks

- `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/src/cli.ts` change in almost every ticket, and #29 changes them now. A rebase of `cstack/test/manifest.test.ts` already left conflict markers once (commit `d25c775`).
- `cstack/src/helper/start.ts` is new: #27 wrote it in three commits. Its tests in `cstack/test/helper/start.test.ts` and `cstack/test/helper/fallback.test.ts` must keep passing.
- `cherry-pick` and `cherry-pick --abort` run in the ticket worktree while the plan file there has uncommitted changes. The tests must show that the abort keeps those changes.

### Governing decisions

- ADR-SIC-A: helpers run as Orca workers when Orca is available, and as sub-agents otherwise.
- ADR-SIC-B: the run folder sits under the common git folder, so a child worktree finds the same run as the ticket worktree.
- ADR-SIC-F: cstack calls Orca only through its runner, without a shell.
- ADR-SIC-H: a command prints through `io`, returns its exit code and never calls `process.exit()`.
- The WHY comments of `cstack/src/helper/start.ts` (line 1) and `cstack/src/helper/spec.ts` (line 1): the spec is built from fixed text and paths only.
- The WHY comments of `cstack/src/commands/unit-commit.ts`: the commit lock belongs to one worktree (line 17), and `git commit --only` commits exactly the files of the unit (line 150).
- Decision 6 of #18: each unit commit carries the trailer `Cstack-Unit: <n>`.

## Decisions

- The Orca feature "child worktrees" also needs `orchestration worker-release` and `worktree rm` in the command list of `orca agent-context`, because `cstack unit collect` runs both. (2026-11-19, assumption not asked)
- `cstack helper start --child-worktree` reads the ticket branch from git, as the branch checked out in the ticket worktree. It refuses with 1 when that branch differs from the `Branch` line of the plan. No text of the plan reaches the Orca command line. (2026-11-19, assumption not asked)
- `--child-worktree` is accepted for the roles `implementer` and `implementer-escalation`. With the role `executor`, it is a usage error with exit code 2. (2026-11-19, assumption not asked)
- After the start, cstack takes the path of the child worktree from the `workspace` field of the `worker-start` answer, which Orca 1.4.263 writes as `<repository id>::<absolute path>`, when that path is a worktree that `git worktree list --porcelain` lists. Otherwise it takes the one new worktree in that list whose branch ends with the name it passed. It always reads the branch from that list. When it finds no single worktree, it exits with 5 and says that the worker runs but has no child worktree on record. (2026-11-19, assumption not asked, from the code of the installed Orca 1.4.263)
- cstack writes the `- Worktree:` line into the plan file under a lock in the git folder of the ticket worktree, because two starts can run at the same time. The line goes last among the unit lines, after `- Blocked:`, and before the free notes. A second start for the same unit replaces the line. (2026-11-19, assumption not asked)
- `cstack unit collect` refuses with 1, and changes nothing, when the ticket worktree is not on the ticket branch, or when it has an uncommitted change outside the plan file. (2026-11-19, assumption not asked)
- `cstack unit collect` names and skips a unit that has no child worktree on record, because its commits are already on the ticket branch. (2026-11-19, assumption not asked)
- `cstack unit collect` applies nothing again for a unit that already has a commit with its trailer on the ticket branch. It only finishes the release and the removal, so running it twice is safe. (2026-11-19, assumption not asked)
- `cstack unit collect` never passes `--force` or `--delete-branch` to `orca worktree rm`, and never runs `git push`, `git reset --hard` or `git cherry-pick -x`. (2026-11-19, from the ticket)
- The logic of the collect lives in `cstack/src/unit/collect.ts`, behind the thin command file `cstack/src/commands/unit-collect.ts` that the manifest names. (2026-11-19, assumption not asked)
- The tests simulate Orca with the fake run function of #24. To simulate the creation of a child worktree, the fake runs `git worktree add` inside the temporary repository of the test. No test runs the real `orca`. (2026-11-19, from the instructions of the coordinator)
- A worker in a child worktree receives a spec with the plan file and the conventions file as paths relative to its own worktree, which is the folder where Orca starts it. The `cstack helper done` line of the spec keeps `--plan` with the relative path of the plan file. The spec says that the worktree is new and has no installed packages, so the worker installs them as the conventions file says before its first test run. cstack still writes the run's name into the `current-run` file of the child worktree right after the start. (2026-11-19, the user's answer)
- `cstack helper start` passes `--setup skip` to `worker-start` when it creates a child worktree, so that Orca's project setup never installs packages at the same time as the worker. (2026-11-19, the user's answer)
- `--base-branch` receives the hash of the last commit of the ticket worktree, not the branch name. Orca turns a name with a slash into a remote branch first, which could be a stale copy. The first real run must confirm that Orca accepts a hash. (2026-11-19, accepted by default)
- `--name` receives the last part of the ticket branch, then `-unit-<n>`, then a short suffix taken from the time part of the helper id, such as `child-worktrees-unit-2-143205`. Orca adds its own prefix to the branch. (2026-11-19, accepted by default)
- When cstack creates a new child worktree, it first checks two things in the ticket worktree. The worktree has no uncommitted change apart from the plan file. The plan file differs from its committed version at `HEAD` only in `- Worktree:` lines, and it is tracked at `HEAD`. Otherwise it refuses with 1, names the files, and tells the executor to commit them first. (2026-11-19, accepted by default)
- `cstack helper start --child-worktree` refuses with 1 a unit that is not in the first batch of `cstack unit order`, and prints the reason that `cstack unit order` gives. This is how two units that share a file never start at the same time. When the first batch holds only that unit, cstack starts it in the current worktree, as #27 does, and says why in one sentence. (2026-11-19, accepted by default)
- `cstack helper start` refuses with 1 a new start of a unit whose latest helper record has a child worktree that `cstack unit collect` has not finished. The role `implementer-escalation` is the exception. (2026-11-19, accepted by default)
- `cstack helper start implementer-escalation` reuses the child worktree of the unit's latest helper record, with or without `--child-worktree`, through `--worktree path:<child path>`. It copies the plan file of the ticket worktree over the plan file of the child worktree before it starts the worker. When Orca workers are not available at that moment, the sub-agent fallback names the child worktree as the repository root. (2026-11-19, accepted by default)
- `cstack unit collect <n>...` works through the units in plan order, whatever the order on the command line. It applies all the commits of one unit with a single `git cherry-pick` call, because `git cherry-pick --abort` then puts the branch back to where it was before that unit. It stops at the first unit that fails a check, stops on a conflict, or stops in any other way, and exits with 1. The units before it stay applied, and that unit and the units after it are not touched. Before it aborts, it checks that a cherry-pick is in progress, because git may refuse a cherry-pick before it starts. (2026-11-19, accepted by default, tested by the review before the plan)
- `cstack unit collect` releases the Orca worker of every unit it names, including the units it skips because they are stuck or have no commit. It removes the child worktree only of a unit it collected, and only when that worktree has no uncommitted change apart from the plan file. A stuck unit keeps its child worktree. (2026-11-19, accepted by default)
- This ticket changes no guide and no agent prompt. The ticket that wires the Orca features into the guides (#31) makes the executor use `--child-worktree` and `cstack unit collect`. I leave a comment on #31 that says what the executor must do. (2026-11-19, accepted by default)
- When the branch is updated onto `main`, count the built and not-built commands again from the manifest of `main`. On 2026-11-19, `main` (at `9658d72`) holds 22 built commands and 1 not built, which is `cstack unit collect`, so this ticket makes it 23 built and 0 not built. (2026-11-19, from the coordinator of the wave)
- Ticket #30 (`cstack wave --watch`) runs at the same time and shares `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts`, `cstack/test/cli.test.ts` and `README.md`. Each ticket removes only its own case from the test that names the ticket of an unbuilt flag. When no real unbuilt flag is left in the list, that test gets its own small list of made-up commands, as #29 did for the test of unbuilt first words. (2026-11-19, from the coordinator of the wave)
- Before the first type check or test run in this worktree, run `npm ci` in `cstack/`. The full suite takes about 90 to 100 seconds, so give the shell call a timeout above 120 seconds or run it in the background. The test "names a unit without a commit" in `cstack/test/report.test.ts` sometimes passes its 5-second timeout in a full run and passes when run again. When that happens, say so in the executor notes. (2026-11-19, from the coordinator of the wave)
- Never run a real `orca` command that starts, sends, releases, creates or removes something, and never run `cstack helper start`, `wait`, `done` or `cstack unit collect` against the real Orca. Never run `git worktree add` or `git worktree remove` on this repository or its worktrees. The tests run them only inside the temporary repositories they create and delete. (2026-11-19, from the coordinator of the wave)
- Never change `.cstack/settings.json`, anything under `skills/`, or anything under `~/.claude/skills/`. Never run `npm install -g`, `npm link` or `cstack skills install`. To try the code, use the tests, or `npm run build` in `cstack/` and then `node cstack/dist/bin.js`. (2026-11-19, from the coordinator of the wave)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-19, from the coordinator of the wave)
- When the branch is updated onto `main`, keep the author dates of the commits, and never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker, and for a function or a shape that git kept twice. Then recount the built and not-built commands and run the whole test suite again. Never push a tag that starts with `v`. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. Never change the git `user.email`. (2026-11-19, from the coordinator of the wave)
- This repository is public. Never write the name of an employer or a client, a work ticket key, or a count from work retrospectives, in files, commits, the pull request, ticket comments, the plan file or the retrospective. Never merge the pull request: the user merges it. (2026-11-19, from the conventions file and the coordinator of the wave)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)

## Architecture

The approach is locked by the ticket and by the answers of the question round, so there was no real choice to compare. The new logic of `cstack helper start` goes into a new file `cstack/src/helper/child.ts`, which `cstack/src/helper/start.ts` calls. It reuses the Orca adapter of #24, the helper record and spec of #27, `orderUnits` and `listUnitCommits` of #18, and the commit lock of `cstack/src/commit-lock.ts` with its own lock file for the plan file. A new pure function in `cstack/src/plan/unit-line.ts` writes the `- Worktree:` line. `cstack unit collect` keeps its logic in `cstack/src/unit/collect.ts`, behind the thin command file `cstack/src/commands/unit-collect.ts`. It applies each unit with one `git cherry-pick` call in the ticket worktree, then releases the worker and removes the child worktree through Orca. The tests simulate Orca with a fake runner that creates and removes real git worktrees inside the temporary repository of the test.

## Implementation units

<!-- Phase plan writes the units here. Until then this section holds no unit. Every unit has the heading "### Unit <n>: <name>", numbered 1, 2, 3 with no gap. The heading carries no status, because the status comes from git. The lines of a unit come in this order:
- Files: one or more paths in backticks, separated by ", ". A path is relative to the repository root.
- Test: `<test file>`: <the failing case it checks>   or   - No test: <reason>
  The test file of a Test line also appears in Files.
- Minimum code:
- Refactor:
- Commit message: on one line only
- Depends on: unit numbers separated by ", ", or the word none
- Design specification: optional, for user-interface units only
- Blocked: <reason>, optional, written by the executor
- Worktree: <absolute path>, optional, written by cstack when a unit runs in a child worktree, never by a person
Free notes come after these lines.
Each unit commit carries the trailer "Cstack-Unit: <n>" in the final paragraph of its message, together with any other trailer such as Co-Authored-By. git does not read a trailer outside the final paragraph. A commit with two Cstack-Unit lines counts for both units. -->

### Unit 1: Require the release and removal commands for child worktrees
- Files: `cstack/src/orca/features.ts`, `cstack/test/orca/features.test.ts`
- Test: `cstack/test/orca/features.test.ts`: an `agent-context` answer without `worktree rm` makes the feature `child-worktrees` unavailable, with a reason that names the missing command, while the feature `workers` stays available.
- Minimum code: Add `orchestration worker-release` and `worktree rm` to the commands that the feature `child-worktrees` needs, in a constant next to `WORKER_COMMANDS`. The feature `workers` keeps its four commands.
- Refactor: none.
- Commit message: feat(cli): require worker-release and worktree rm for the child worktree feature
- Depends on: none

### Unit 2: Write the worktree line of a plan unit
- Files: `cstack/src/plan/unit-line.ts`, `cstack/test/plan/unit-line.test.ts`
- Test: `cstack/test/plan/unit-line.test.ts`: `setUnitWorktree(text, 2, path)` adds `- Worktree: <path>` as the last unit line of unit 2, after `- Blocked:` when the unit has one and before the free notes, and `readPlan` then reads that path for unit 2.
- Minimum code: Write two pure functions. `setUnitWorktree(text, unit, path)` uses the line numbers that `readPlan` gives to find the unit. It inserts the line after the last unit line of that unit, which is `Depends on`, `Design specification` or `Blocked` with their continued lines. It replaces the `- Worktree:` line when the unit already has one. Every other byte stays the same, including Windows line endings. It throws when the plan has no such unit. `withoutWorktreeLines(text)` returns the text without any `- Worktree:` line of a unit, for the comparison with the committed plan. Add one case each for the replacement, for a unit without a `Blocked` line, and for `withoutWorktreeLines`.
- Refactor: none.
- Commit message: feat(cli): write the worktree line of a plan unit
- Depends on: none

### Unit 3: Record the child worktree of a helper and tell its worker where it works
- Files: `cstack/src/helper/record.ts`, `cstack/src/helper/spec.ts`, `cstack/test/helper/spec.test.ts`
- Test: `cstack/test/helper/spec.test.ts`: the spec of an implementer in a child worktree gives the plan file and the conventions file as paths relative to its own worktree, holds no absolute path of the ticket worktree, keeps `--plan` with the relative plan path on the `cstack helper done` line, and tells the worker to install the packages as the conventions file says before its first test run.
- Minimum code: `HelperRecord` gains three optional fields: `worktree`, with the string fields `path` and `branch`; `released`, a boolean; and `collectedAt`, a time. `HelperInputs` gains an optional field `childWorktree: true`. For such inputs, `buildSpec` writes the plan file and the conventions file relative to `repoRoot`. Its root line says, in fixed text, that the repository root is the folder where Orca starts the worker, which is its own worktree. It adds one sentence in fixed text: this worktree is new and has no installed packages, so install them as the conventions file says before your first test run, and run every cstack command from the root of this worktree. The spec of a helper without `childWorktree` stays exactly as it is.
- Refactor: none.
- Commit message: feat(cli): record a helper's child worktree and give its worker relative paths
- Depends on: none

### Unit 4: Start a parallel implementer in a new child worktree
- Files: `cstack/src/helper/child.ts`, `cstack/src/helper/start.ts`, `cstack/src/commands/helper-start.ts`, `cstack/test/helper/child-worktree.test.ts`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-start.new-child.json`, `cstack/test/fixtures/orca/README.md`
- Test: `cstack/test/helper/child-worktree.test.ts`: with a committed plan whose units 1 and 2 share no file and form the first batch of `cstack unit order`, `cstack helper start implementer --unit 1 --child-worktree` and the same command for unit 2 each run `worker-start` with `--worktree new-child`, `--setup skip`, the hash of the ticket worktree's last commit as `--base-branch`, and its own `--name`, such as `full-example-unit-1-143205`.
- Minimum code: `helperStart` accepts the boolean flag `--child-worktree`, and refuses it with 2 for the role `executor`. In `cstack/src/helper/child.ts`, write the git checks and the name. `ticketWorktreeProblems` lists the uncommitted changes outside the plan file, and reports a plan file that is not tracked at `HEAD` or that differs from `git show HEAD:<plan>` outside `- Worktree:` lines (use `withoutWorktreeLines`). `childName` builds `<last part of the branch>-unit-<n>-<first six digits of the time part of the helper id>`. In `startHelper`, when the flag is set and the role is `implementer`, do these steps in this order, all before the start command. Order the units with `orderUnits` and the units that have a commit (`listUnitCommits`). Refuse with 1 a unit that is not in the first batch, with the reason that the order gives. Refuse with 1 when the branch checked out in the ticket worktree differs from the `Branch` line of the plan. Refuse with 1 and name the files when `ticketWorktreeProblems` finds any, and start nothing. Then check the feature `child-worktrees`. When the first batch holds only this unit, or the feature is not available, start the helper as #27 does and print one sentence that says why, on the line after the helper id, so that the helper id stays the first line. Otherwise run `worker-start` with `--worktree new-child --base-branch <hash> --name <name> --setup skip` in place of `--worktree current`. Read the hash and the branch from git, never from the plan, so no plan text reaches the Orca command line. Add the answer file `orchestration-worker-start.new-child.json`, written by hand like `orchestration-worker-start.ready.json`, with a `workspace` field `repo_000000000001::<placeholder path>` that the test replaces with the path of the worktree it creates. Its path must not start with `/Users/`. Describe it in the fixture README. In the test, the fake runner answers `worker-start` by running `git worktree add -b <branch> <path> <base>` inside the temporary repository. Add cases: unit 2 sharing a file with unit 1 is not in the first batch, so its start is refused with 1 and runs no `worker-start`; an uncommitted file outside the plan file makes the start refuse with 1 and run no Orca command; without the feature, or with `CSTACK_ORCA_WORKERS=off`, the implementer starts in the current worktree.
- Refactor: none.
- Commit message: feat(cli): start a parallel implementer in its own child worktree
- Depends on: 1, 2, 3

### Unit 5: Record the child worktree after the start
- Files: `cstack/src/helper/start.ts`, `cstack/src/helper/child.ts`, `cstack/test/helper/worktree-line.test.ts`
- Test: `cstack/test/helper/worktree-line.test.ts`: after `cstack helper start implementer --unit 2 --child-worktree` starts a child worktree, the plan file of the ticket worktree holds `- Worktree: <real path of the child>` under unit 2, the helper record holds the path and the branch of the child, the `current-run` file of the child worktree names the same run, and a following start of unit 3 is not stopped by the uncommitted plan file.
- Minimum code: After a successful `worker-start`, find the child worktree. Take the part after the first `::` of the `workspace` field when `git worktree list --porcelain` lists that path. Otherwise take the one worktree of that list that was not in the list read before the start and whose branch ends with the name that cstack passed. Always read the branch from that list, without `refs/heads/`. When no single worktree is found, create the record without `worktree`, and exit with 5 with a message that says the worker runs but has no child worktree on record. Otherwise create the record with `worktree`, holding the path with its symbolic links resolved. Write the run's name into the `current-run` file of the child worktree with `writeCurrentRun`. Write the `- Worktree:` line with `setUnitWorktree` into the plan file of the ticket worktree, under a lock taken with `withCommitLock` on the lock file `plan-file.lock` in the git folder of the ticket worktree, and write the file through `writeFileAtomic`.
- Refactor: none.
- Commit message: feat(cli): record the child worktree in the helper record, the plan and the child's current run
- Depends on: 2, 4

### Unit 6: Run the second attempt of a stuck unit in the same child worktree
- Files: `cstack/src/helper/start.ts`, `cstack/src/helper/child.ts`, `cstack/test/helper/child-escalation.test.ts`
- Test: `cstack/test/helper/child-escalation.test.ts`: when the latest helper record of unit 2 has a child worktree without `collectedAt` and unit 2 has a stuck report, `cstack helper start implementer-escalation --unit 2` copies the plan file of the ticket worktree over the plan file of the child worktree, then runs `worker-start` with `--worktree path:<child path>` and no creation flag (`--name`, `--base-branch`, `--setup`).
- Minimum code: Find the latest helper record of the unit by `startedAt`. When it has a `worktree` and no `collectedAt`: the role `implementer` is refused with 1, with a message that says to run `cstack unit collect` first; the role `implementer-escalation` reuses that worktree, with or without `--child-worktree`. When the recorded folder no longer exists, refuse with 1 and name the path. The escalation record keeps the same `worktree`, and its spec is the child spec of unit 3. When Orca workers are not available, the sub-agent fallback prints the child worktree as the repository root and the plan file inside it. Add one case for the refused `implementer` start and one for the fallback.
- Refactor: none.
- Commit message: feat(cli): run the second attempt of a stuck unit in its child worktree
- Depends on: 5

### Unit 7: Bring the commits of parallel units back with cstack unit collect
- Files: `cstack/src/unit/collect.ts`, `cstack/src/commands/unit-collect.ts`, `cstack/test/unit/collect.test.ts`
- Test: `cstack/test/unit/collect.test.ts`: in a temporary repository with real git, two child worktrees each hold one commit with its trailer, for units 1 and 2. `cstack unit collect 2 1` puts the commit of unit 1 before the commit of unit 2 on the ticket branch, and `cstack plan status` reports both units done.
- Minimum code: `unitCollect(args, io, deps)` reads the unit numbers and `--plan`, and refuses with 2 a number that is not a unit of the plan. Its usage line holds `cstack unit collect <n>...`. `collectUnits` refuses with 1, before any change, when the ticket worktree is not on the `Branch` of the plan or has an uncommitted change outside the plan file. It then works through the units in ascending order. A unit whose latest helper record has no `worktree` is named and skipped. A unit that already has a commit with its trailer on the ticket branch gets nothing applied again. A unit whose latest report from that helper is stuck, or that has no report, is named and skipped. A unit with no commit in `git rev-list --reverse HEAD..<child branch>` is named and skipped. Each commit must carry `Cstack-Unit: <n>` and touch only files of the unit's `Files` line in the ticket worktree's plan, compared without case. When a commit fails a check, apply nothing for that unit, name the commit and the reason, and stop with 1. Otherwise apply all the commits of the unit with one `git cherry-pick <c1> ... <ck>` call, without `-x`. When the call fails, list the conflicting files with `git diff --name-only --diff-filter=U`, run `git cherry-pick --abort` only when `CHERRY_PICK_HEAD` exists, name the unit and the files, and stop with 1. Write the `WHY:` comment of scope item 8 of the ticket above the collect function. Add cases: a commit without the trailer is refused and the branch does not move; a commit that touches a file of another unit is refused; a forced conflict ends with the cherry-pick aborted, the branch unchanged and the uncommitted plan change kept; a stuck unit is skipped and named; the source of `cstack/src/unit/collect.ts` holds no `push`, no `reset` and no `--force`.
- Refactor: none.
- Commit message: feat(cli): bring the commits of parallel units back with cstack unit collect
- Depends on: 3

### Unit 8: Show that the saved test runs need no copy
- Files: `cstack/test/unit/collect-test-runs.test.ts`
- No test: this unit is itself a test of a behaviour that ADR-SIC-B already gives, so it passes on its first run and `cstack unit red` would refuse it. Run it by hand with `cd cstack && npx vitest run test/unit/collect-test-runs.test.ts` before the commit. The case: in a temporary repository with real git worktrees and a `.cstack/settings.json` whose test command fails, `cstack unit red 1` runs in the child worktree of unit 1. After a commit of unit 1 in the child and `cstack unit collect 1` in the ticket worktree, `cstack plan status --json` in the ticket worktree reports a saved failing run for unit 1, and no file was copied.
- Minimum code: the test only.
- Refactor: none.
- Commit message: test(cli): show that a failing run saved in a child worktree is visible after the collect
- Depends on: 7

### Unit 9: Release the workers and remove the clean child worktrees after the collect
- Files: `cstack/src/unit/collect.ts`, `cstack/src/commands/unit-collect.ts`, `cstack/test/unit/collect-cleanup.test.ts`, `cstack/test/helper/worktree-line.test.ts`
- Test: `cstack/test/unit/collect-cleanup.test.ts`: after a clean collect of unit 1, cstack runs `orca orchestration worker-release --dispatch <id>` and then `orca worktree rm --worktree path:<child path>`, with neither `--delete-branch` nor `--force`, and the record of the helper gets `released` and `collectedAt`.
- Minimum code: For every unit it names, collected or skipped, except a unit with no report, release each Orca worker record of the unit that holds this child worktree and is not released yet. Mark it `released` when Orca answers with `ok: true`. Then, for a collected unit only, check the child worktree with `git status --porcelain`, ignoring the plan file. When it holds another change, keep it, name the files, and exit with 1 at the end. Otherwise remove it with `orca worktree rm --worktree path:<child path>`, and set `collectedAt` on the latest record. The child branch always stays. When an Orca call fails, report it, go on with the other units, and exit with 5 at the end. A second run of the collect then finishes the clean-up without applying anything again. Add cases: a child worktree with an uncommitted file is not removed; a stuck unit's worker is released and its worktree is kept; a second run applies nothing twice. In `cstack/test/helper/worktree-line.test.ts`, add the case where the `- Worktree:` line is still in the plan file after the collect and the removal of the child worktree, and run that file by hand before the commit.
- Refactor: none.
- Commit message: feat(cli): release the workers and remove the clean child worktrees after the collect
- Depends on: 5, 7

### Unit 10: List cstack unit collect and --child-worktree as built
- Files: `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts`, `README.md`, `cstack/src/commands/unit-collect.ts`
- Test: `cstack/test/manifest.test.ts`: the list holds as many built commands as `main` has plus one, one fewer command that is not built, and `unbuiltRefusal` refuses neither `cstack unit collect` nor `cstack helper start --child-worktree`.
- Minimum code: In `cstack/src/manifest.ts`, set `built: true` on `cstack unit collect` and remove `notBuiltFlags` from `cstack helper start`. Change nothing else in the list. Add `collect` to the `unit` dispatch of `cstack/src/cli.ts`. Update the cases of `cstack/test/cli.test.ts` that name `--child-worktree` or `cstack unit collect` as not built, and run that file by hand before the commit. Count the built and not-built commands from the manifest of the branch at the time of this unit: today `main` holds 21 built and 2 not built, which gives 22 and 1. In the "Commands" section of `README.md`, update the number of commands, add one bullet for `cstack unit collect <n>...` and one sentence about `--child-worktree` to the bullet of `cstack helper start`.
- Refactor: none.
- Commit message: feat(cli): add cstack unit collect and --child-worktree to the command list
- Depends on: 6, 8, 9

## Documentation duties

- README: applies, the "Commands" section of `README.md` (unit 10).
- Recorded Orca answers: applies, `cstack/test/fixtures/orca/README.md` describes the new hand-written answer of `worker-start` (unit 4).
- The choice of `git cherry-pick` over a merge commit: applies, written as a `WHY:` comment above the collect function in `cstack/src/unit/collect.ts`, as the ticket asks (unit 7).
- Decision record: does not apply. The ticket asks for a `WHY:` comment, and no new architecture decision came up.
- Specification page: does not apply. US-13 AC2 already describes the behaviour, and nothing in the page changes.
- Ticket comments: applies, a comment on #28 and on the ticket it feeds (#31), written in the document phase. The comment on #31 says what the executor must do: start the units of a batch with `--child-worktree`, run `cstack unit collect` after each batch, and commit the plan file with its `Worktree` lines before its final report.
- Guides and prompts of the skill: does not apply, because #31 wires the Orca features into them.

## Blocking questions

### Question 1: What a worker in a child worktree is told
A worker that starts in a child worktree must work on the files of that worktree, not on the files of the ticket worktree. Today the spec that `cstack helper start` writes holds absolute paths of the ticket worktree. Orca creates the child worktree during `worker-start`, so cstack learns its path only after it sent the spec. I recommend this: for a worker in a child worktree, the spec gives the plan file and the conventions file as paths relative to the worker's own worktree, which is the folder where Orca starts it. The `cstack helper done` line of the spec has no `--plan`. It finds the plan through the `current-run` file that cstack writes into the child worktree right after the start. The spec also says that the worktree is new and may have no installed packages, so the worker prepares it as the conventions file says before its first test run. The other way is to create the worktree first with `orca worktree create --parent-worktree`, then to start the worker in it with `--worktree path:<child path>`. The spec could then keep absolute paths. But the ticket names `worker-start --worktree new-child`, and a failed second call would leave a worktree with no worker. Do you agree with the first way?
- For: the user
- Answer: yes, the first way, with the two changes that the review before the plan proposed. The spec keeps `--plan` on the `cstack helper done` line, with the relative path of the plan file. `worker-start` gets `--setup skip`, and the spec tells the worker to install the packages as the conventions file says. Source: the user's answer "ok go" in the conversation, 2026-11-19.

## Review log

Impact notes (executor, 2026-11-19):
- `buildSpec`, `startHelper` and `HelperRecord` changed. Callers are `helper/start.ts`, `commands/helper-start.ts`, `helper/done.ts` and `helper/wait.ts`. The new `HelperRecord` fields are optional, so `done.ts` and `wait.ts` need no change. `test/helper/start.test.ts` and `spec.test.ts` exercise the old paths and still pass in the full suite.
- `notBuiltFlags` is removed from `helper start` in `manifest.ts`. Its only other users are `cli.test.ts` and `manifest.test.ts`, both updated in unit 10.
- Usual companions of `manifest.ts` are `cli.ts`, `README.md` and the two test files. All are in the diff.
- No `WHY:` or `DECISION:` comment in the changed files conflicts with the branch.

Phase review (2026-11-19): four reviewers ran.
- Correctness: one bug. The first-batch check forgot units still running in a child worktree. Fixed in 7fde273.
- Security: no finding above the bar. Two hardening points fixed: the child path from Orca is never an existing worktree or the ticket worktree (5f85e68), and the plan copy refuses a symbolic link and an unlisted path (d0221fb).
- Correctness note: after a second attempt the copied plan file made `worktree rm` refuse. Fixed in 1209d63.
- Conventions: no violation.
- Simplicity: the duplicated reader of the latest helper record is merged in fd22d48. Not done, as follow-ups: make the Orca runner of `unitCollect` required and drop the sync overload, merge `applyUnits` into `applyInto`, split the plan text once in `withoutWorktreeLines`, reuse the unit order between `checkChildStart` and `firstBatchIsOneUnit`, and drop the name fallback of `findChildWorktree`. They only save lines.
- Tests: full `npm run typecheck && npm test` passes, 87 files and 1102 tests.

Phase independent-review (2026-11-19): one bug found and fixed in 6953a55. With `--child-worktree`, the branch and dirty-folder checks ran before cstack knew whether a child worktree would be created, so the fallbacks (no Orca, no feature, unit alone) were refused. The checks now run just before the worktree is created. Full suite passes, 87 files and 1104 tests. All acceptance criteria are met.
Judgment calls for the pull request body:
- A unit that reported done but made no commit gets its worker released, but its child worktree is not removed and it is never marked collected. A new implementer start for it is refused until the escalation role runs.
- When Orca exits with 0 but prints text that is not JSON, the collect clean-up counts the release or removal as a success.
- `--base-branch` gets a commit hash, as decided. The first real run must confirm that Orca accepts a hash.
- After the rebase onto `main`, the command counts must become 23 built and 0 not built in `cstack/test/manifest.test.ts` and `README.md`.

## Briefing

### What you should know about what was built

The branch does what the ticket asked. With `--child-worktree`, each implementer of a batch starts in its own Orca child worktree. `cstack unit collect` then brings its commits back onto the ticket branch in plan order, releases the worker and removes the clean worktree. Every acceptance criterion is met, and the full suite passes after the update onto `main`. I ran the seven new test files again myself, and they pass.

What to watch:

- Nothing changes in real runs until the ticket that wires Orca into the guides (#31) uses these commands. Its first real run checks three guesses about Orca: a commit hash as `--base-branch`, the child path in the `workspace` field of the answer, and `--setup skip`. If Orca refuses the hash with a clear error, cstack falls back to a sub-agent in the shared folder, which is exactly the collision this ticket removes. Exit code 6 on a parallel start is the sign.
- If cstack does not find the child worktree after a start, it exits with 5 while the worker keeps running. The collect then says that the unit's commits "are already on the ticket branch". That is wrong: they sit on a child branch that nothing tracks, and the worker is never released. It should be rare, but the recovery is by hand.
- A unit whose child worktree is never collected cannot start again. A new implementer start is refused until the collect, and a second attempt needs a stuck report. `cstack helper done` refuses a finished report without a commit, so I expect this to be very rare.

What changed since the plan:

- The branch check and the clean-folder check now run only when a child worktree is really created. In the plan they ran first, which refused the cases that should fall back to the current worktree.
- A parallel start is also refused when the unit shares a file with a unit that still runs in a child worktree. The first batch alone misses those, because they have no commit yet.
- Before it removes a child worktree, the collect restores the plan file that a second attempt copied into it, because Orca refuses to remove a worktree that is not clean.
- After the update onto `main`, the command list holds 23 built commands and none left to build.

### Details

The build matches scope items 1 to 9 of the ticket. Item 7 was removed upstream. The independent review found every acceptance criterion met. The hand-off log records a full suite of 96 files and 1170 tests after the rebase onto `main` at `9658d72`. On 2026-11-19 I fetched `origin/main`, and it has not moved since that rebase. No other pull request is open, so the counts of 23 built and 0 not built still hold. I ran `test/helper/child-worktree.test.ts`, `test/helper/child-escalation.test.ts`, `test/helper/worktree-line.test.ts`, the three files under `test/unit/` and `test/manifest.test.ts` with vitest: 7 files and 54 tests pass. Each of the ten unit commits carries its `Cstack-Unit` trailer. The repository merges pull requests with merge commits, as the last five merges show, so the merge button needs no special instruction.

All the questions of the question round are resolved as answered. The worker in a child worktree gets relative paths, keeps `--plan` on its `cstack helper done` line, and installs its own packages after `--setup skip` (`cstack/src/helper/spec.ts`, `cstack/src/helper/start.ts` line 282). `--base-branch` gets the hash of the ticket worktree's last commit, and `--name` gets the short name with a six-digit suffix (`childName` in `cstack/src/helper/child.ts`). The plan file must match its committed version outside the `- Worktree:` lines (`ticketWorktreeProblems`). The second attempt copies the plan file into the child, and a second `implementer` start of an uncollected unit is refused. The collect applies each unit in one `git cherry-pick` call, checks `CHERRY_PICK_HEAD` before it aborts, and releases the worker of every unit it names. The guides were left to #31, and the comment on #31 is posted.

The first point to watch is that three behaviours of Orca rest on reading the source of Orca 1.4.263 and on a hand-written fixture, because no test may run the real Orca. They are the acceptance of a commit hash by `--base-branch`, the `<repository id>::<path>` format of the `workspace` field, and the value `skip` of `--setup`. The comment on #31 (https://github.com/gambitl/claude-code-stack/issues/31#issuecomment-7015261914) asks the first real run to check the first two, and it does not name `--setup skip`. When Orca refuses `worker-start` with a clear error code, `startHelper` calls `fallback` (`cstack/src/helper/start.ts`, around line 293). The implementer then starts as a sub-agent in the ticket worktree, beside its siblings, with one line of reason and exit code 6. That is correct as a fallback, but it silently brings back the collision this ticket removes. If nobody watches, a refusal of the hash would make every parallel start fall back, and the run would still look normal.

The second point is the exit with 5 when `findChildWorktree` finds nothing (`cstack/src/helper/start.ts` lines 306 to 310). The record is then created without `worktree`, while the Orca worker runs in a child worktree that cstack did not record. `collectUnits` skips such a unit with the message "it has no child worktree on record, so its commits are already on the ticket branch" (`cstack/src/unit/collect.ts` line 82). In this case the message is false: the commits are on the child branch, and the worker is never released, because the clean-up only handles records with a `worktree`. `cstack unit order` and `cstack plan status` would still show the unit without a commit, so the work is not lost silently. Recovery means finding the branch with `git worktree list` and cherry-picking it by hand. A cheap follow-up is to word the skip message so that it does not claim the commits are on the branch, or to record the dispatch id so that the collect can release the worker.

The third point is a dead end for a unit whose latest record has a `worktree` and no `collectedAt`, when its report is not stuck and the collect cannot finish it. This happens when the helper reported done but the child branch has no commit that the ticket branch lacks. The collect releases the worker and keeps the worktree. A new `implementer` start is refused with "Run `cstack unit collect` first" (`cstack/src/helper/start.ts` line 202). `implementer-escalation` is refused without a stuck report (line 192). `cstack helper done` already refuses a done report without a unit commit (`checkImplementer` in `cstack/src/report/reports.ts`), so this needs an unusual path. The way out by hand is to set `collectedAt` in the unit's helper record under `<run folder>/helpers/`. This is the first judgment call of the review log, and the pull request body will carry it.

Two smaller facts need no action. `orcaOk` in `cstack/src/unit/collect.ts` (line 136) counts an exit code 0 with an answer that is not JSON as a success, so a worker could be marked released while Orca kept it open. This is the second judgment call of the review log. The `- Worktree:` line holds an absolute path of the developer's machine, and the executor commits it. The format is locked by the contract ticket (#24), so I do not reopen it. In this public repository the private-names check before publishing scans that line like any other text.

What changed since the plan is recorded in the review log. Commit `954c8e4` moved the branch check and the clean-folder check to the moment a child worktree is really created. Before that, a start that should fall back (no Orca, no feature, a unit alone in its batch) was refused. Commit `031f645` refuses a parallel start that shares a file with a unit still running in a child worktree, because `orderUnits` counts a unit as done only when the ticket branch has its commit. Commit `ba6d6a8` restores the copied plan file in the child before `orca worktree rm`. Commits `dd98966` and `45762e2` harden the reading of the child path and the plan copy. The counts became 23 built and 0 not built after the update onto `main`, against the 22 and 1 in the plan's unit 10.

No new question came up after the build, so nothing new needs an answer before the pull request. I checked security and authorization, data model lock-in, scale, user-facing edge cases, recurring cost and reversibility, and found nothing beyond the points above.

## Non-blocking questions

- Does Orca accept a commit hash as the value of `--base-branch` of `worker-start`? The help of Orca 1.4.263 says "Base branch/ref to create the worktree from", so a hash should work, but nobody started a real worker to check it. The first real run of ticket 31 will show it. If Orca refuses, cstack starts a sub-agent in the shared folder, which is the collision this ticket removes. For: the person who runs ticket 31 on a real machine.
- Should a unit that reported done without a commit get its child worktree removed, or marked as collected, by `cstack unit collect`? Today its worker is released, but its folder stays and a new implementer start for that unit is refused until the escalation role runs. For: the owner of the cstack design, in ticket 31 or a follow-up.
- Should the small simplifications of the review be done? They are: make the Orca runner of `unitCollect` required and drop the synchronous overload, merge `applyUnits` into `applyInto`, split the plan text once in `withoutWorktreeLines`, and reuse the unit order between `checkChildStart` and `firstBatchIsOneUnit`. For: the owner of the cstack design.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

Title: feat(cli): give each parallel implementer its own child worktree

````markdown
## What this does

Until now, implementers that ran at the same time shared one folder and could get in each other's way. Now `cstack helper start implementer --unit <n> --child-worktree` starts an implementer in its own child worktree, which Orca creates from the ticket branch. cstack records the folder in the helper record and in a `- Worktree:` line under the unit in the plan file.

When the implementers are done, `cstack unit collect <n>...` copies their commits onto the ticket branch with `git cherry-pick`, in plan order. It refuses a commit that has no `Cstack-Unit` trailer or that touches a file the unit does not list. It stops at the first conflict and leaves the branch as it was. After a successful collect, it releases the workers and removes the clean child worktrees. It never pushes and never uses `--force`.

## Key decisions

- The work comes back by cherry-pick, not by a merge commit, because `cstack plan status` reads the unit trailers. The reason is a `WHY:` comment in `cstack/src/unit/collect.ts`.
- The worker gets paths relative to its own worktree, because Orca creates the worktree after the spec is written. The start passes `--setup skip`, and the spec tells the worker to install the packages.
- When only one unit can run, or Orca lacks the feature, the helper starts in the current worktree and says so.
- A start is refused when its files overlap a unit that still runs in a child worktree.
- The feature `child-worktrees` also needs `worker-release` and `worktree rm` in the Orca command list.

## Files touched

The code is in `cstack/src/helper/` (`start.ts`, `child.ts`, `spec.ts`, `record.ts`), `cstack/src/unit/collect.ts`, `cstack/src/commands/unit-collect.ts`, `cstack/src/plan/unit-line.ts`, `cstack/src/orca/features.ts`, `cstack/src/manifest.ts` and `cstack/src/cli.ts`. The tests are in `cstack/test/`. `README.md` lists the new command. The plan is `docs/plans/2026-11-19-28-give-each-parallel-implementer-its-own-child-worktree.md`.

## Review

Four reviewers and one independent reviewer found three bugs, and all are fixed: a new unit could start next to a running one, the fallbacks were refused too early, and a second attempt blocked the removal of its worktree. Two hardening points on the child path and on a symbolic link are fixed too. The full suite passes after the update onto `main`.

Judgment calls from the independent review:

- A unit that reported done without a commit gets its worker released, but its child worktree stays and the unit is not marked collected. A new implementer start for it is refused until the escalation role runs.
- When Orca exits with 0 but prints text that is not JSON, the clean-up counts the release or the removal as a success.
- `--base-branch` gets a commit hash, as decided. The first real run must confirm that Orca accepts a hash.

Review findings left as follow-ups: make the Orca runner of `unitCollect` required, merge `applyUnits` into `applyInto`, split the plan text once in `withoutWorktreeLines`, and reuse the unit order in the start checks. They only save lines.

The guides of the skill do not use the new flag yet. Ticket #31 does that.

## Open questions, not needed for this pull request

You can merge this pull request without an answer to these questions.

- Does Orca accept a commit hash as the value of `--base-branch` of `worker-start`? The help of Orca 1.4.263 says "Base branch/ref to create the worktree from", but nobody started a real worker to check it. For: the person who runs ticket #31 on a real machine.
- Should a unit that reported done without a commit get its child worktree removed, or marked as collected, by `cstack unit collect`? For: the owner of the cstack design.
- Should the small simplifications of the review be done? For: the owner of the cstack design.

Fixes #28
````

## Documentation

- Comment on ticket 28: https://github.com/gambitl/claude-code-stack/issues/28#issuecomment-7015261373
- Comment on ticket 31, which this ticket feeds: https://github.com/gambitl/claude-code-stack/issues/31#issuecomment-7015261914
- `WHY:` comment above the collect function in `cstack/src/unit/collect.ts` (choice of `git cherry-pick`).
- `cstack/test/fixtures/orca/README.md` and `README.md` ("Commands" section) updated in units 4 and 10.
- No decision record and no specification change, as the plan's duties say.

## Executor notes

- Unit 2 and unit 5 wrote their code before the failing run, so `cstack unit green` and `cstack unit commit` refused. They moved the source aside, ran red, and restored it.
- Unit 3, unit 7 and unit 4 found `tsc` unable to run until `npm ci` was done in `cstack/`. Unit 7 ran it, and unit 4 also built `cstack/dist`.
- Unit 9 made the Orca runner of `unitCollect` optional, so the real command skipped the cleanup until unit 10 wired it. Unit 10 had to be told in its prompt.
- Unit 10 reports that `main` may now hold more built commands than the 21 and 2 in the unit text. The counts need a re-check after the rebase.
- During the rebase onto main, a `sed -i` call failed on macOS because BSD needs `-i ''`, so the count fix was missing from the rebased commit until a follow-up commit.

## Hand-off log

2026-11-19: build phase. Moved ticket 28 to the label `in progress`, committed the plan file, and built units 1 to 10 in five batches. All units have a commit. No unit was escalated or blocked.
2026-11-19: update-branch. Rebased onto main (9658d72). Conflicts in README.md, cli.test.ts and manifest.test.ts were resolved by keeping main's lines for tickets 29 and 30 and adding ours. The command count is now 23 built and 0 not built. Full suite passes, 96 files and 1170 tests.
2026-11-19: document, briefing, after-build-questions and ready phases done. Returned a done report.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

I need your answer before I plan:

**What an implementer is told when it starts in its own child worktree.** I keep the drafted answer, with two changes. First, I keep `--plan` on the `cstack helper done` line, with the plan's relative path. That path works in both worktrees, and the implementer could run its first cstack command before cstack has written `current-run`. Second, the packages. By default, Orca runs the project's own setup in every new worktree, and depending on the project's setting it runs it beside the agent. If the spec also says "install the packages", two installs can run in the same folder at once. I recommend `--setup skip`, and the spec tells the implementer to install the packages as the conventions file says. cstack cannot know whether the project's setup runs before the agent or beside it, and the conventions file is already the rule for installing.

I will do this unless you say no:

- For `--base-branch`, I pass the hash of the ticket branch's last commit, not its name. Orca prefers `refs/remotes/<name>` when the name holds a slash. A remote called `gambitl` would make the child start from a stale copy. The hash also pins the commit that cstack just checked.
- I refuse the start when the plan file differs from its committed version anywhere other than the `- Worktree:` lines. The child reads the committed plan, and `cstack unit commit` takes the unit's `Files` line from it.
- Before a second attempt in the same child worktree, I copy the ticket's plan file into the child, and the clean-up check ignores that one file. Otherwise a file added to `Files` for the second attempt could not be committed.
- I refuse a second start of a unit while `cstack unit collect` has not brought its child back. I also add a short suffix to `--name`, because child branches stay after the clean-up and a name could come back.
- `cstack unit collect` releases the worker of every unit it handles, stuck units included. Orca keeps these workers open until someone releases them.
- I keep the other drafted answers: the short name without the prefix, only the first batch of `cstack unit order`, the stop at the first failing unit, and the guides left to the ticket that wires Orca into them (#31).

I checked it myself:

- With real git, one `git cherry-pick` call for all the commits of a unit, then `--abort` on a conflict, puts the branch back before the unit and keeps the modified plan file. One call per commit leaves the first commit in place, so I will apply each unit in one call.

Good to know:

- The child branches are never deleted, as the ticket asks. One stays for every unit that ran in parallel.
- Each child worktree installs its own packages, so time and disk grow with the number of units in a batch.

#### Details

The drafted question about what a worker in a child worktree is told is blocking, and only the user can answer it. I agree with relative paths in the spec, and I change two things. The draft drops `--plan` from the `cstack helper done` line and relies on the `current-run` file that cstack writes right after `worker-start` returns. `locatePlan` in `cstack/src/plan/locate.ts` resolves a relative `--plan` against the current folder, and the plan file sits at the same relative path in the child worktree. The run folder is keyed by the plan's file name under the common git folder (`runFolder` in `cstack/src/run-state.ts`), so a relative `--plan` reaches the same run from either worktree. Keeping it removes a small race: Orca delivers the spec before cstack parses the answer, runs `git worktree list` and writes `current-run`. cstack still writes `current-run`, because scope item 1 asks for it. The second change is about installing packages. The help of `worker-start` in Orca 1.4.263 (`out/cli/specs/orchestration-worker-specs.js`) says that a new worktree runs the project's setup unless `--setup` says otherwise, and that "start-immediately" runs that setup beside the agent. A spec that also tells the worker to install could start a second install in the same folder while the first one runs, which breaks `node_modules` in ways that look like flaky tests. I recommend `--setup skip` and an install step in the spec that follows the conventions file. I rejected the opposite choice, which keeps the project's setup and tells the worker to install only if packages are missing, because the worker cannot tell a finished setup from one still running. The cost of skipping is that a project whose setup does more than install, such as copying an environment file, loses that step in child worktrees. If nobody decides, the drafted answer applies without `--setup`, and the race stays possible in repositories whose Orca setup installs packages beside the agent. The other way of the draft, which creates the worktree first with `orca worktree create`, stays rejected for the reason the draft gives.

Passing the commit hash to `--base-branch` is blocking, because it changes the command line, and I answered it by reading the source of the installed Orca. `resolveWorktreeAddBaseRef` in `out/shared/worktree/base-refs/base-ref.js` turns a name that holds a slash into `refs/remotes/<name>` first, and into `refs/heads/<name>` only when the remote ref does not exist. The ticket branch `gambitl/child-worktrees` holds a slash. This repository has only the remote `origin`, so today the local branch wins. Some team repositories have a remote named after a person, which is a common setup for forks. There, the child would start from that remote's copy and silently miss the local unit commits. `out/shared/worktree/base-refs/local-base-branch-fast-forward.js` shows a second behaviour. Orca may fast-forward a local base branch that is strictly behind its remote. It does so even in the worktree that has the branch checked out, when that worktree has no tracked change. A hash avoids both, and it pins the exact commit that the clean check of scope item 1 looked at. The help of 1.4.259 quoted in the ticket says that `--base-branch` takes a branch or a commit, and `resolveWorktreeAddBaseRef` returns an unknown name unchanged, so a hash reaches `git worktree add` as it is. No test may run the real Orca here, so the first real run should confirm that Orca accepts a hash. The recorded `worker-start` call in the fixtures must then hold a hash. The decision already recorded, which reads the ticket branch from git and compares it with the plan's `Branch` line, stays. If nobody decides, the branch name goes to Orca.

The stale plan in the child is blocking, and the code answers it. A child worktree starts from the last commit, so it sees the committed plan file. `cstack unit commit` (`cstack/src/commands/unit-commit.ts`, lines 178 to 190) reads the unit's `Files` line and its `Blocked` line from the plan of the worktree where it runs. Scope item 1 leaves the plan file out of the clean check, so any uncommitted change to it, not only the `Worktree` lines, would be invisible to the child. The guide `cstack/guides/resolve-issue/build.md` (line 9) commits the plan file first, so the plan is tracked in normal runs. I recommend that `cstack helper start --child-worktree` compares the working plan with `git show HEAD:<plan>` and refuses with 1 when they differ outside `- Worktree:` lines, or when the plan is not tracked at `HEAD`. The message tells the executor to commit the plan file first. If nobody decides, a change to a unit's `Files` line made after the last plan commit makes the child's `cstack unit commit` refuse a file the plan now allows.

The second attempt in the same child worktree is blocking, and the code answers it. The code mapping already names the problem (constraint 3). The child branch never receives later plan commits from the ticket branch, so committing the plan file in the ticket worktree does not help. I recommend that `cstack helper start implementer-escalation`, when it reuses a child worktree, copies the ticket worktree's plan file over the child's copy before it starts the worker. `cstack unit commit` uses `git commit --only` with the unit's files, so the copied plan file is never committed in the child. The clean-up check of scope item 5 must then ignore the plan file in the child, and only that file. I rejected a fresh child worktree for the second attempt, because the ticket wants the second attempt to continue from the changes the first one left. If nobody decides, a second attempt that needs a file added to `Files` ends stuck again.

The second start of the same unit is blocking, and the code answers it. `orderUnits` treats a unit as done only when the ticket branch has a commit with its trailer. A unit running in a child worktree has no such commit yet, so it stays in the first batch, and the check of drafted question 3 would accept a second start. I recommend that `cstack helper start --child-worktree` refuses with 1 a unit whose latest helper record has a child worktree that `cstack unit collect` has not finished, except for the role `implementer-escalation`. Scope item 5 keeps child branches, so a name can come back across runs of the same plan. I add a short suffix taken from the helper id to `--name`, such as `child-worktrees-unit-2-1432`. The decision already recorded finds the new worktree first from the `workspace` field of the answer, so the suffix matters mostly for the fallback that matches the branch name. If nobody decides, a repeated start can make Orca refuse the name or pick another one.

Releasing the worker at collect time is non-blocking for correctness, but it changes drafted question 5. The help of `worker-start` says that a worker started in a new worktree is kept open until someone releases it. Scope item 5 releases only collected units, and the draft releases a stuck unit's worker only when its second attempt starts. A unit that ends blocked would keep its worker open for good. I recommend that `cstack unit collect` releases the worker of every unit it names, including stuck and skipped ones, and keeps the worktree of a stuck unit. The second attempt then has nothing to release. The help says that `worker-release` never deletes the worktree.

The cherry-pick behaviour is blocking, and I tested it with git 2.55 in a temporary repository. A unit had two commits, and the second one conflicted with the ticket branch, which also had an uncommitted change to `plan.md`. One `git cherry-pick <c1> <c2>` call stopped on the second commit. `git cherry-pick --abort` put `HEAD` back on the commit from before the unit and kept the change to `plan.md`. A loop with one call per commit, with an abort on the failing one, left the first commit on the branch. Scope item 3 says the branch goes back to where it was before the unit, and `git reset --hard` is forbidden, so the collect must apply each unit in one call. A cherry-pick that git refuses before it starts, for example because a commit touches a file with local changes, exits with 128 and leaves no cherry-pick in progress. `--abort` then fails with "no cherry-pick or revert in progress". The code must check for a cherry-pick in progress before it aborts. A cherry-pick that becomes empty also stops without a conflict, so the code should treat any stop as a failure, not only a conflict.

The remaining drafted questions keep their drafted answers and their non-blocking labels. Question 2, the name passed to `--name`, gets the suffix described above. Question 3, only the first batch, gets the guard against a second start. Question 4, the stop at the first failing unit, is right, and it relies on the one-call cherry-pick. Question 5, the second attempt in the same worktree, gets the plan copy and the earlier release. Question 6 leaves the guides and the executor prompt to the ticket that wires the Orca features into the guides (#31), with a comment on that ticket.

Two facts need no decision. Scope item 5 keeps every child branch, so a repository gains one local branch for each unit that ran in parallel, and nothing in cstack deletes them. Every child worktree needs its own install, so a batch of four units costs four installs in time and disk.

I checked security and authorization, the data model, user-facing edge cases and recurring cost, and found nothing that needs a decision. The spec is still built from fixed text and paths, the `- Worktree:` line format is locked by the contract ticket (#24), and the change of commit hashes is locked by scope item 8.

#### Added after the plan was drafted

No new decision since the question round.

### Open questions and answers

1. Blocking question 1: what a worker in a child worktree is told. Recommended answer: relative paths in the spec, the `current-run` file for `cstack helper done`, and one sentence about installing the packages.
   Answer: see Blocking question 1. The user said yes on 2026-11-19, with `--plan` kept and `--setup skip`.

2. Non-blocking. Which name does cstack pass to `--name`? The Orca worktrees of this repository have the branch `gambitl/<name>` and the folder `<workspace folder>/<name>`, so Orca adds its own prefix. The ticket branch `gambitl/child-worktrees` already holds a slash. Passing `gambitl/child-worktrees-unit-2` could give the branch `gambitl/gambitl/child-worktrees-unit-2` and a nested folder. Recommended answer: pass only the last part of the ticket branch, such as `child-worktrees-unit-2`. cstack reads the real branch from git anyway.
   Answer: accepted by default on 2026-11-19, with a short suffix taken from the helper id, as the review before the plan proposed.

3. Non-blocking. How does cstack make sure that two units that share a file never start at the same time? Recommended answer: with `--child-worktree`, `cstack helper start` refuses with 1 a unit that is not in the first batch of `cstack unit order`, and it prints the reason that `cstack unit order` gives, such as the shared file.
   Answer: accepted by default on 2026-11-19. cstack also refuses a second start of a unit whose child worktree was not collected yet.

4. Non-blocking. What does `cstack unit collect` do when one unit fails a check or meets a conflict? Recommended answer: it works through the units in plan order and stops at the first unit that fails. The units before it stay applied. That unit and the units after it are not touched, and the command exits with 1. The ticket branch then still reads in plan order.
   Answer: accepted by default on 2026-11-19. Each unit is applied with one `git cherry-pick` call, as the review before the plan tested.

5. Non-blocking. How does the second attempt of a stuck unit reuse the child worktree? Recommended answer: `cstack helper start implementer-escalation` finds the child worktree of the unit in its last helper record, with or without `--child-worktree`. It first releases the worker of the first attempt with `worker-release`. When Orca workers are not available at that moment, the sub-agent fallback prints the child worktree as the repository root, so the second attempt still continues from the changes of the first.
   Answer: accepted by default on 2026-11-19, with two changes from the review before the plan. `cstack unit collect` releases the worker of the first attempt, so the second start has nothing to release. The second start copies the plan file of the ticket worktree into the child worktree.

6. Non-blocking. Who changes the build guide and the executor prompt so that they use `--child-worktree` and `cstack unit collect`? Recommended answer: the ticket that wires the Orca features into the guides (#31). This ticket changes no guide and no agent prompt. I leave a comment on #31 that says what the executor must do: run `cstack unit collect` after each batch that ran in child worktrees, and commit the plan file with its `Worktree` lines before its final report.
   Answer: accepted by default on 2026-11-19.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn.
