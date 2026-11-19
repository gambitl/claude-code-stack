# Plan: #65 — M3-12: Stop report.test.ts from timing out on a busy machine

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/65
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/report-timeout
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T20:47:57+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** The test suite stops failing for no reason when the computer is busy, so a red test always means a real problem.

- **What the title means**: `report.test.ts` is one file of the automatic tests of `cstack`. The test tool, vitest, stops any single test case that runs longer than five seconds and counts it as failed. That is the timeout.
- **Why we are doing it**: When several runs work at the same time, the machine is busy, and some cases of `report.test.ts` take longer than five seconds. They then fail although the code is right. This happened in the runs of #15, #17, #24, #25, #26 and #45, and once with `publish.test.ts` in the run of #20. Each time, the agent lost time looking for a bug that did not exist.
- **For the user**: Runs that go in parallel no longer stop on false failures.

**Goal.** This ticket makes `cstack/test/report.test.ts` pass reliably on a busy machine, without checking less than today.

### Where things are today (read first)

* **The slow file**: `cstack/test/report.test.ts` builds a new git repository for many of its cases, with `makeRepo()` and `commitPlan()` from `cstack/test/helpers/plan-repo.js`. Each of these runs several `git` commands.
* **The timeout**: `cstack/package.json` (line 18) runs `vitest run`, and the repository has no vitest config file. So every case has the default timeout of five seconds.
* **The other file**: `cstack/test/publish.test.ts` went past the same timeout once.
* **The conventions file**: `CLAUDE.md`, in its test section, says that `report.test.ts` can pass its five-second timeout when the machine is busy, and that you should run it alone before you look for a bug. PR #62 added this sentence.
* **The evidence**: `docs/retros/reviewed/2026-11-19-digest.md`, proposal 19.

### Scope

1. Find which cases of `report.test.ts` take the most time, for example with `npx vitest run test/report.test.ts --reporter=verbose` while a second full test run goes on.
2. Make those cases faster when a small change does it. For example, build the git repository once in `beforeAll` and copy its folder for each case. Never remove a check to gain time.
3. When the cases stay slow after that, give this file a longer timeout, with a `WHY:` comment that says why.
4. Do the same for `publish.test.ts` only if it shows the same problem in your measures.
5. Update the sentence of `CLAUDE.md` about `report.test.ts`, so that it describes the new state.

### Acceptance (TDD)

* Before any change, write in the plan the time of the slowest cases of `report.test.ts`, alone and while a second full test run goes on.
* After the change, two full `npm test` runs started at the same time both pass. Write the times again in the plan.
* The number of test cases in `report.test.ts` and what each one checks stay the same.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none · Feeds: none

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

## Dependencies

clear

## Code mapping

**Entry points.** `cstack/test/report.test.ts` has 27 cases in four `describe` blocks. Almost every case calls the local function `setup()` (line 23). `setup()` builds a new temporary git repository with `makeRepo()` and `commitPlan()` from `cstack/test/helpers/plan-repo.ts`. Then it runs `git checkout -b feature` and calls `commitFiles()` once for each unit, units 1 to 10 by default. That is 26 `git` processes for one repository. The case "names a unit without a commit, and gives both reasons when both fail" (line 47) calls `setup()` twice, so it starts about 52 `git` processes before its own checks.

**What the cases ask of `setup()`.** The cases need eight different repositories. The default one holds the fixture plan `cstack/test/fixtures/plans/full.md` and units 1 to 10, and about 19 cases use it. The other seven are: the Briefing placeholder text with all units (lines 41 and 235), all units but unit 3 (line 48), the Briefing placeholder without unit 3 (line 51), a blocked unit 3 without unit 3 (line 58), an open blocking question (line 64), `Ready for review at: not yet` (line 70), and no unit at all (line 141). Many cases then change their repository: they write files, stage them, run `git reset --hard` or `git clean`, commit, or save reports in the run folder. So each case needs its own copy of the repository.

**The code under test.** `checkReport()` in `cstack/src/report/reports.ts` (line 137) reads the plan from the working tree. For an executor `done` report, it runs `listUnitCommits()` from `cstack/src/plan/commits.ts` (line 20), which runs `git rev-parse` twice and `git log <target>..HEAD`. A commit without a `Cstack-Unit` trailer adds nothing to the result. Then it runs `git status --porcelain` to find uncommitted changes. `runFolder()` in `cstack/src/run-state.ts` (line 95) finds the common git folder with git. So the code under test starts only a few processes per call. The time goes into building the repositories.

**The helpers.** `cstack/test/helpers/plan-repo.ts` exports `git`, `makeRepo`, `commitPlan`, `commitFiles` and `collect`. Many other test files import them, so their behaviour must not change. A new helper function is allowed.

**The timeout today.** `cstack/package.json` runs `vitest run`, and the repository has no vitest config file. So each case has the default timeout of 5 seconds, and each hook such as `beforeAll` has the default of 10 seconds. `cstack/test/publish.test.ts` (line 12) already calls `vi.setConfig({ testTimeout: 30_000 })`, with a plain comment that explains why. Unit 8 of the run of #20 added it, in commit 0e0f964. That is the only time `publish.test.ts` timed out, according to the retrospective of #20. Other files give a single case a longer timeout as the third argument of `it`, for example `cstack/test/commit-lock.test.ts` (line 149) and `cstack/test/unit-red-green.test.ts` (line 320).

**A quick prototype, outside the repository.** Building the default repository of `setup()` took 512 ms on an idle machine. Copying the finished folder with `cpSync(..., { recursive: true })` took about 30 ms per copy. In the copy, `git status --porcelain` printed nothing and `git log` found the 10 unit trailers. A copied repository therefore behaves like the original one.

**Measures before the change.** Each line says what else ran at that moment. No vitest process of another worker of the wave showed in `ps` during these measures. An antivirus process used about 30% of one core during all of them, and it checks each new process.
- Alone, run 1, started at 20:24:43. The slowest cases took 1,515 ms ("refuses needs-decision and failed with a blank text"), 1,306 ms ("names a unit without a commit") and 1,023 ms. All 27 cases passed. The durations of the cases add up to 21.4 seconds. The load average went from 3.3 to 6.6 during the run.
- Alone, run 2, started at 20:25:13. The slowest cases took 1,273 ms ("names a unit without a commit"), 806 ms and 780 ms. All 27 cases passed, and the durations add up to 19.1 seconds.
- While a second full `vitest run` of this worktree went on, started at 20:25:48, eight seconds after that full run. The slowest cases took 2,210 ms ("names a unit without a commit"), 1,567 ms and 1,523 ms. All 27 cases passed, and the durations add up to 35.4 seconds. The load average was 16.5 at the end.
- Inside that full run, which passed its 1,222 cases, the slowest case of `report.test.ts` took 2,111 ms. The slowest case of `publish.test.ts` took 4,186 ms ("gives 7 when the pipeline is still running at the timeout"), far under its 30-second timeout.

**Evidence of the failures.** The retrospectives of #15, #17, #24, #25, #26 and #45 report the timeout of `report.test.ts`. They saw it when several full runs went at once, for example several implementers or several workers of a wave. Two of them name the case "names a unit without a commit". That is the case that builds two repositories, and it is the slowest one in the measures above.

**Constraints.** The number of cases (27) and what each case checks stay the same. Only `cstack/test/report.test.ts` and the sentence of `CLAUDE.md` about it change. `publish.test.ts` stays as it is, because the measures show no problem there and it already has a 30-second timeout. The ticket asks for a `WHY:` comment if this file gets a longer timeout.

**Risks.** `report.test.ts` changed five times, always together with `cstack/src/report/reports.ts` or the report commands. It was never fixed for flakiness before. A shared template repository that one case changes by mistake would leak into the next cases, so each case must work on its own copy. A `beforeAll` hook that builds many repositories could itself pass the 10-second hook timeout on a busy machine.

**Governing decisions.** No ADR covers the tests. No `WHY:` or `DECISION:` comment exists in `report.test.ts`, `publish.test.ts` or `cstack/test/helpers/`. The conventions file says how long the full suite takes and what to do when `report.test.ts` times out (`CLAUDE.md`, line 22).

**Measures after the change.** Each line says what else ran. All 27 cases passed in every run, and the unit 1 implementer found no case over 5,000 ms. Its `ps` check showed only its own shell, but I saw seven vitest processes of other worktrees on the machine right after, so other workers probably ran too.
- Alone, started at 20:48:33. The slowest cases took 420 ms, 361 ms and 356 ms. Before the change, alone, the slowest took 1,515 ms, 1,306 ms and 1,023 ms (run 1).
- Beside a full `vitest run` of this worktree, started at 20:48:44, with `report.test.ts` about eight seconds later. The slowest cases took 975 ms, 886 ms and 668 ms. Before the change, under the same kind of load, they took 2,210 ms, 1,567 ms and 1,523 ms.
- Two full `npm test` runs at the same time, started at 20:50:39. Both passed. In the first, the slowest cases took 3,586 ms, 1,532 ms and 925 ms. In the second, they took 2,894 ms, 1,312 ms and 1,244 ms. This load is heavier than the two measures above, because two full suites ran together. There is no measure before the change under this load. The slowest case is still under the 5-second timeout, but the margin is smaller here, so the timeout can still happen on a very busy machine.

## Decisions

- When the plan gives a behaviour and its test, both go to the same unit. When an earlier unit already builds what a later unit's test checks, that test passes at once, and the later unit cannot prove that its test failed first. (2026-11-19, from the coordinator of the wave)
- Some tests check every command or every shipped skill: `cstack/test/cli.test.ts`, `cstack/test/manifest-implemented.test.ts` and `cstack/test/skills-install.test.ts`. When a unit adds or changes a command or a skill, read those tests, and put on the unit's `Files` line the files they make you change. (2026-11-19, from the coordinator of the wave)
- Each open non-blocking question of the question round is copied under `## Non-blocking questions`, word for word, with who it is for. (2026-11-19, from the coordinator of the wave)
- When the coordinator sends a new message before the approval gate, each rule or answer it gives is written into `## Decisions` too. (2026-11-19, from the coordinator of the wave)
- The executor never builds a unit itself, even one of a few lines. Each unit goes to an implementer, which runs `cstack unit red` and `cstack unit green`. (2026-11-19, from the coordinator of the wave)
- The executor writes each Hand-off log entry and each line of Executor notes only once. (2026-11-19, from the coordinator of the wave)
- Before `cstack unit red` has saved a failure, an implementer changes only test files and their fixtures. It writes no source code before that. It never moves code aside to get a failure. A new module that does not exist yet is a fine first failure. (2026-11-19, from the coordinator of the wave)
- An implementer writes a test case for each behaviour, exit code and message that the unit or a line of `## Decisions` asks for. (2026-11-19, from the coordinator of the wave)
- An implementer never runs `git add`, `git commit`, `git commit --amend` or `git stash`. The stash is shared by every worktree of this repository, so another run could take the changes. (2026-11-19, from the coordinator of the wave)
- Other test files use the helpers in `cstack/test/helpers/`. Never change what an existing helper function does. If you need a new helper, add a new function. (2026-11-19, from the coordinator of the wave)
- This ticket changes `cstack/test/report.test.ts` and one sentence of `CLAUDE.md`, the sentence about `report.test.ts`. It changes `cstack/test/publish.test.ts` only if the measures show the same problem there. It changes no other line of `CLAUDE.md`. (2026-11-19, from the coordinator of the wave)
- Three other tickets of the wave run at the same time, each in its own worktree. Ticket #31 works mostly in `cstack/guides/resolve-issue/`, `cstack/skills/resolve-issue/`, `cstack/src/measure/`, `cstack/test/e2e/`, `README.md` and `cstack/package.json`, and it may change `README.md` but not `CLAUDE.md`. Ticket #63 works in `cstack/src/commands/unit-red.ts`, `unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts` and `cstack/test/unit-red-green.test.ts`. Ticket #64 works in `cstack/src/commands/unit-commit.ts`, the usage line of `cstack/src/manifest.ts`, step 7 of `cstack/skills/resolve-issue/agents/implementer.md` and `cstack/test/unit-commit.test.ts`. Never change those files here. (2026-11-19, from the coordinator of the wave)
- Only ticket #31 changes the version in `cstack/package.json` and `cstack/package-lock.json`. Nobody in this run pushes a tag, and never push a tag that starts with `v`. (2026-11-19, from the coordinator of the wave)
- Three other workers run their test suites on this machine at the same time as this run, so every time measure varies because of them. Next to each number written in the plan, write what else ran at that moment, as far as you can tell. Never run more than two of this run's own test suites at once. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`. Run `npm ci` in `cstack/` before the first type check or test run. The full `npm test` takes about 90 seconds, so give the shell call a timeout above 120 seconds, or run it in the background. (2026-11-19, from the coordinator of the wave)
- On macOS, `sed -i` needs an empty argument, as in `sed -i ''`. (2026-11-19, from the coordinator of the wave)
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). Read them as the reference for the old behaviour, but never edit anything under `skills/`. (2026-11-19, from the coordinator of the wave)
- This run follows the skill and the guides of the installed `cstack` 0.2.0. This branch changes the source of `cstack`, not the installed command. Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-19, from the coordinator of the wave)
- Never change `.cstack/settings.json` in this branch. The test commands come from that file on `main`, and the independent review refuses a branch that changes it, because the file names the reviewer. (2026-11-19, from the coordinator of the wave)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, report it to the user, and write it in the retrospective with the tag `[skill]`. (2026-11-19, from the coordinator of the wave)
- The stops of the skill are the blocked ticket, the question round, the approval gate of the plan and the questions after the build. Each stop goes to the user in the chat of the main conversation, and never to the coordinator. Nobody answers a stop in the user's place. Only the main conversation talks to the coordinator, and only about coordination, such as the state of another ticket of the wave. (2026-11-19, from the coordinator of the wave)
- The conversation with the user is in French. Everything written in the repository and on GitHub stays in English. (2026-11-19, from the coordinator of the wave)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-19, from the coordinator of the wave)
- This repository is public. Never write the name of an employer or a client, a work ticket key, or a count from work retrospectives. Never write a path from this machine, such as one that starts with `/Users/`. This covers files, commits, the pull request, ticket comments, the plan file and the retrospective. (2026-11-19, from the coordinator of the wave)
- The history of this repository was rewritten on 2026-11-18 to remove private names, so do not undo that work. Every commit carries the GitHub no-reply address, the one that ends in `@users.noreply.github.com`, as author and as committer. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-19, from the coordinator of the wave)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, keep both changes, and push it with a plain `git push`, without force. (2026-11-19, from the coordinator of the wave)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. In wave 7, one branch pushed a commit that still held conflict markers. (2026-11-19, from the coordinator of the wave)
- When you update the branch, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates in the plan file and in the commits. (2026-11-19, from the coordinator of the wave)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)
- Never merge the pull request, because the user merges it. Never read, run or change anything under `~/comparison/`, which holds private work data. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-19, from the coordinator of the wave)
- Never run real `orca orchestration` commands that start, message or release workers. Never run `orca worktree create`, `orca worktree rm`, `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh` or `glab`. Run `git worktree add` only inside a temporary test repository. (2026-11-19, from the coordinator of the wave)
- `cstack/test/publish.test.ts` stays as it is. In the measures before the change, its slowest case took 4,186 ms beside a second full run, far under the 30-second timeout that the file already sets at line 12. (2026-11-19, assumption not asked)
- The new code stays in `cstack/test/report.test.ts`, as local functions. No file of `cstack/test/helpers/` changes, and no helper is added there. (2026-11-19, assumption not asked)
- Each case works on its own copy of a prepared repository, in a new temporary folder. No case ever changes a prepared repository itself, so a change made by one case never reaches the next case. (2026-11-19, assumption not asked)
- The prepared repositories and their copies stay in the temporary folder of the system after the run, as the repositories of today's `setup()` do. (2026-11-19, assumption not asked)
- The 27 cases of `cstack/test/report.test.ts` keep their names, their order and their assertions word for word. Only `setup()` and the code that prepares the repositories change. (2026-11-19, assumption not asked)
- The sentence of `CLAUDE.md` about `report.test.ts` (line 22) gets a new wording. It says that `report.test.ts` copies git repositories prepared once, so that its cases stay fast on a busy machine. It stays general about the other test files that build git repositories, because they keep the slow way and can still time out on a busy machine. It keeps the advice to run a single failing file alone before you look for a bug. The first sentence of that paragraph, about the 90 seconds of the full run, stays as it is. (2026-11-19, assumption not asked, wording point accepted by the user)
- After the change, start two full `npm test` runs at the same time in `cstack/`, and check that both pass. Then write the times of the slowest cases of `report.test.ts` in both runs, with what else ran at that moment, in a paragraph "Measures after the change" at the end of `## Code mapping`. The vitest option `--reporter=json --outputFile=<a file outside the repository>` gives the duration of each case. (2026-11-19, assumption not asked, from the acceptance of the ticket)
- `setup()` in `cstack/test/report.test.ts` commits the plan file last, on the `feature` branch, after the unit commits, and no longer on `main` before the branch. A commit without a `Cstack-Unit` trailer adds nothing to the result of `listUnitCommits()`, so every case keeps its result. (2026-11-19, the user's answer)
- The file prepares three repositories once, without a plan: units 1 to 10, all units but unit 3, and no unit. Each repository has the README commit on `main` and the unit commits on the `feature` branch. `setup()` copies the one it needs into a new temporary folder, then commits the plan text there. (2026-11-19, the user's answer)
- The preparation runs in one `beforeAll` hook at the top level of the file, outside the four `describe` blocks, so it runs once for all of them. That hook gets its own timeout of 60 seconds, as the second argument of `beforeAll`, with a `WHY:` comment. The comment says that the hook builds three repositories at once, and that a timeout of the hook fails all 27 cases together. (2026-11-19, accepted by the user)
- The 5-second timeout of the cases stays as it is. The file gets no `vi.setConfig({ testTimeout })` and no third argument to `it`. (2026-11-19, accepted by the user)
- Copy a prepared repository with `cpSync(<prepared folder>, <new folder>, { recursive: true })`. Never use `git clone`, because a clone has no local `main` branch and `listUnitCommits()` then refuses the target branch. Never use `git worktree add`, because a worktree shares the common git folder, where `runFolder()` saves the reports, so the reports of one case would reach the next case. (2026-11-19, accepted by the user)
- The paragraph "Measures after the change" compares the slowest cases of `report.test.ts` before and after the change, under the same kind of load, and says what else ran. Two runs at the same time already passed before the change, so a green result alone does not prove the fix. (2026-11-19, accepted by the user)
- This ticket leaves the other slow test files alone, such as `cstack/test/next.test.ts` and `cstack/test/unit-red-green.test.ts`. After this wave, I suggest to the user a separate ticket that applies the same pattern to them. (2026-11-19, accepted by the user)

## Architecture

The approach is locked by the question round, and the change is small. `cstack/test/report.test.ts` prepares three git repositories once, in a top-level `beforeAll` hook, and `setup()` copies one of them for each case before it commits the plan on the `feature` branch.

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

### Unit 1: Prepare the repositories of report.test.ts once and copy them for each case
- Files: `cstack/test/report.test.ts`
- No test: The unit changes only how the 27 existing cases of this file build their git repositories. A new failing case would change the number of cases, which must stay 27. The 27 cases, unchanged, are the check: they must all pass after the change, and the measures of this unit show the gain.
- Minimum code: Add one `beforeAll` hook at the top level of the file, outside the four `describe` blocks. It builds three repositories with the existing helpers `makeRepo()`, `git(dir, "checkout", "-b", "feature")` and `commitFiles(dir, [`src/u${unit}.ts`], unit)`. The first has units 1 to 10, the second has units 1, 2 and 4 to 10, and the third has no unit. None of them holds the plan file. Keep them in a `Map` keyed by the unit list. Give the hook a timeout of 60 seconds as its second argument, with a `WHY:` comment just above it. The comment says that the hook builds three repositories at once, and that a timeout of the hook would fail all 27 cases together. Then rewrite `setup()`. It creates a new folder with `mkdtempSync(join(tmpdir(), "cstack-plan-"))`, and copies into it the prepared repository of `options.units` (units 1 to 10 by default) with `cpSync(<prepared folder>, <new folder>, { recursive: true })`. Then it calls `commitPlan(dir, options.text ?? full)` and returns `{ dir, where: { root: dir, planFile: PLAN } }` as today. When a case asks for a unit list that was not prepared, `setup()` throws an error that names the list. Update the doc comment of `setup()` so that it says the plan is committed last, on the `feature` branch. Change no case: names, order and assertions stay word for word.
- Refactor: none
- Commit message: test(tests): copy git repositories prepared once in report.test.ts instead of building one per case
- Depends on: none

Measure before `cstack unit commit`, from the `cstack/` folder, and give each shell call that runs a full suite a timeout of 300 seconds. First run `npx vitest run test/report.test.ts --reporter=json --outputFile=<a file outside the repository>` alone. Then run it again while a full `npx vitest run` of this worktree goes on, started about eight seconds before. Then start two full `npm test` runs at the same time, and check that both pass. Never run more than two suites at once. For each of these runs, report the start time, the three slowest cases of `report.test.ts` with their durations, and what else ran at that moment. The vitest processes of other worktrees show in `ps -Ao pid,pcpu,command | grep vitest`. The executor writes these numbers in a paragraph "Measures after the change" at the end of `## Code mapping`, next to the measures before the change, so that both can be compared.

### Unit 2: Describe the new state of report.test.ts in CLAUDE.md
- Files: `CLAUDE.md`
- No test: The unit changes one passage of prose in the conventions file, and no test reads that file.
- Minimum code: In `CLAUDE.md`, find the paragraph that starts with "The full `npm test` takes about 90 seconds". Keep its first sentence. Replace the two sentences after it with these four sentences, word for word: "`cstack/test/report.test.ts` prepares its git repositories once and copies them for each case, so its cases stay fast on a busy machine. Other test files still build a new git repository for each case. When the machine is busy, for example while several test runs go at once, one of their cases can pass the five-second timeout of vitest. When only one file fails, run it alone before you look for a bug." Change no other line of `CLAUDE.md`.
- Refactor: none
- Commit message: docs: say that report.test.ts copies prepared repositories and that other test files can still time out
- Depends on: 1

## Documentation duties

- `CLAUDE.md`, the conventions file: applies, written by unit 2 to the paragraph about the full test run.
- A comment on ticket #65 that says what changed and gives the measures before and after: applies, written to https://github.com/gambitl/claude-code-stack/issues/65 in the `document` phase.
- The comments on dependent tickets: does not apply, because the ticket feeds no other ticket.
- `README.md`: does not apply, because no command and no behaviour of `cstack` changes.
- The specification page `docs/projects/skills-into-cli.md`: does not apply, because it does not describe the tests.
- An ADR in `docs/decisions/`: does not apply, because the change is local to one test file. The `WHY:` comment of the `beforeAll` hook records the one choice that needs a reason.
- Security: no security surface, skip. The change touches no endpoint, no query and no external input.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Plan commit on the branch
To share prepared repositories between the cases, can `setup()` commit the plan file last, on the `feature` branch, instead of on `main` before the branch is created? Each case keeps its assertions word for word.
- For: the user
- Answer: Yes, commit the plan on the `feature` branch. The user, in the conversation, 2026-11-19.

### Question 2: Timeouts after the speed-up
After the speed-up, should the 5-second timeout of the cases stay as it is, while the one-time preparation of the repositories in `beforeAll` gets its own 60-second timeout with a `WHY:` comment?
- For: the user
- Answer: Yes. The user accepted it in the conversation ("ok for the rest"), 2026-11-19.

## Review log

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

<phase after-build-questions: the questions raised by the reviews or the briefing that do not stop the pull request, word for word, each with who it is for, or "none". They go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them.>

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

- The unit 1 implementer made no measure before the change, because the unit text asked only for measures after it, and the plan already holds the earlier numbers. The measure of two full runs has no earlier number to compare with.

## Hand-off log

- 2026-11-19, executor run 1: added the label `in progress` to ticket #65 and started the build phase on the branch gambitl/report-timeout. Units 1 and 2 are done (commits 2b2a96a and 554c2ce).

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Can the fixture commit the plan file on the `feature` branch instead of on `main`?** This is what lets the cases share a few repositories prepared once. Each case keeps its name and its assertions word for word. But the plan commit now sits among the commits that the code under test reads. The ticket says that what each case checks must stay the same, so you decide whether this counts as a change. I recommend yes, because the code ignores a commit without a `Cstack-Unit` trailer. Real runs also commit their plan on the feature branch. The other way needs eight prepared repositories.

**I will do this unless you say no.**

- I will keep the 5-second timeout of the cases. Only the one-time preparation in `beforeAll` gets a 60-second timeout, with a `WHY:` comment. If that preparation fails, all 27 cases fail at once, so this insurance is cheap.
- I will copy the prepared folders with `cpSync`, never with `git clone` or `git worktree add`. A clone has no local `main` branch, so the code would refuse the target branch. A worktree shares the `.git` folder, where `cstack` saves its reports, so the reports of one case would reach the next one.
- I will prove the fix with the drop of the slowest case, not only with "two runs at once pass". Two runs at once already passed before the change, so a green result alone proves nothing.
- I will leave the other slow test files alone, such as `next.test.ts` and `unit-red-green.test.ts`. I will suggest a separate ticket after this wave, because the ticket that changes `unit red` and `unit green` (#63) and the one that changes `unit commit` (#64) edit two of those files right now.

**I checked it myself.**

- A throwaway version of the file passed all 27 cases. Its slowest case went from 1,515 ms to 413 ms alone, and from 2,210 ms to 647 ms beside a second full run.

**Good to know.**

- The advice in `CLAUDE.md` to run a failing file alone stays useful, because other test files still build their repositories the slow way.

#### Added after the plan was drafted

No new decision since the question round.

#### Details

The plan commit on the `feature` branch (draft blocking question 1) stays blocking, and the run answered it with a test. I kept it for the person because the acceptance says that "what each one checks" stays the same, and moving the plan commit changes the fixture that every executor `done` case runs against. The change only widens what the cases cover. `listUnitCommits()` in `cstack/src/plan/commits.ts` (lines 45 to 55) adds nothing for a commit without a trailer, so the plan commit in `main..HEAD` changes no result. The throwaway copy passed all 27 cases with no change to any assertion. The cases that run `git reset --hard` or `git clean -fd` (lines 86, 95 and 96 of `cstack/test/report.test.ts`) keep the plan, because it is committed on `HEAD`. No case checks out `main`. The rejected way keeps the plan on `main` and needs one prepared repository per pair of plan text and unit list. That is eight repositories, about four seconds of `beforeAll` on an idle machine, so it puts the hook timeout at risk for little gain. Another rejected way builds the default repository lazily and caches it. It leaves the slowest case, which builds two other repositories, as slow as today. If nobody decides, the plan cannot go ahead with the shared repositories.

The timeouts (draft blocking question 2) are blocking but tested, and I moved them to the points I will do unless the developer says no. The cases keep a margin of about seven times under 5 seconds with two suites at once. The `beforeAll` hook builds three repositories, and its default timeout is 10 seconds. A hook failure makes every case of the file fail with the hook error, so a 60-second timeout on that hook alone, with a `WHY:` comment, is the right place for the insurance. The hook must sit at the top level of the file, outside the four `describe` blocks, so that it runs once for all of them. By default, if nobody decides, the hook keeps 10 seconds and could fail the whole file on a very busy machine.

The copy method is my own point, from the traps of git. `git clone`, even with `--local`, creates only the checked-out branch as a local branch, and `main` exists only as `origin/main`. `listUnitCommits()` checks `refs/heads/<target>` first (line 24 of `cstack/src/plan/commits.ts`), so every executor `done` case would get "The target branch "main" does not exist". `git worktree add` shares the common git folder, and `runFolder()` in `cstack/src/run-state.ts` (lines 82 to 97) puts the run folder under that common folder. Saved reports and `publish.json` would then leak between cases, which breaks the assumption that each case works on its own copy. `cpSync` gives each copy its own `.git`. The copy's index holds stat data from the template, so the first `git status` in a copy compares content and refreshes the index. The prototype showed that `git status --porcelain` prints nothing in a copy, so this costs a few milliseconds and changes no result. The commit hashes are now the same in every copy, because the unit files are written once in the template. No case compares hashes between repositories, and the `published` case reads `HEAD` in its own copy (line 125). This point is non-blocking.

The proof of the fix is my own point, about the acceptance. The measures before the change show that two suites at once already passed: the slowest case took 2,210 ms. So the acceptance line "two full `npm test` runs started at the same time both pass" cannot tell a fixed file from an unfixed one on this machine today. The paragraph "Measures after the change" should compare the slowest cases before and after under the same load, and say what else ran. The ticket's own acceptance already asks for the times, so this changes no criterion. It is non-blocking.

The other slow test files (draft non-blocking question) stay non-blocking. I agree with leaving them out of this ticket, because tickets #63 and #64 change `unit-red-green.test.ts` and `unit-commit.test.ts` in this wave. The question for the user stays as drafted, word for word: "Other test files build git repositories the same way. Should a later ticket apply the same pattern to them?" It goes under `## Non-blocking questions`.

The tested answers hold against their evidence. The prototype numbers in "Code mapping" and in "Open questions and answers" match the slowest-case figures above, and each measure says what else ran. I agree with the assumptions not asked at the end of `## Decisions`, including leaving `cstack/test/publish.test.ts` as it is (its slowest case took 4,186 ms under a 30-second timeout) and keeping the new code local to `report.test.ts`. The new wording of the `CLAUDE.md` sentence should stay general about test files that build git repositories, because the other files keep the old pattern.

No locked decision was reopened. No ADR covers the tests, and the coordinator's rules in `## Decisions` limit the files this ticket may change. I checked security, data model lock-in, operations and cost, reversibility and user-facing edge cases, and found nothing there, because the change only touches one test file and one sentence of the conventions file.

### Open questions and answers

**Blocking question 1** (blocking). Recommended answer: yes. I checked it with a throwaway copy of `report.test.ts`, deleted right after the run. In that copy, `beforeAll` built three repositories without a plan: units 1 to 10, all units but unit 3, and no unit. `setup()` copied the one it needed with `cpSync` and then called `commitPlan()` on the `feature` branch. All 27 cases passed, with no change to any assertion. The reason is in `cstack/src/plan/commits.ts` (lines 45 to 55): `listUnitCommits()` adds nothing for a commit without a `Cstack-Unit` trailer, so the plan commit in `main..HEAD` changes no result. Real runs also commit their plan file on the feature branch. The other way keeps the plan on `main`, but it needs one prepared repository per pair of plan text and unit list. That makes eight repositories, and building them all at once would take about four seconds on an idle machine. Answer: yes, the user, 2026-11-19.

**Blocking question 2** (blocking). Recommended answer: yes. With the throwaway copy, the slowest case took 413 ms alone (20:30:53, no other vitest process seen) and 647 ms while a second full run of this worktree went on (20:31:18, no other worker's vitest process seen). Before the change, the same measures gave 1,515 ms and 2,210 ms. So the cases keep a margin of about seven times under 5 seconds with two suites at once, and they do not need a longer timeout. The `beforeAll` hook builds three repositories, about 66 `git` processes, and it has the default hook timeout of 10 seconds. When it times out, all 27 cases fail at once, so a longer timeout for that hook alone is cheap insurance. Answer: yes, accepted by the user ("ok for the rest"), 2026-11-19.

**Other test files** (non-blocking). Other test files build git repositories the same way, and in the full run before the change their cases added up to 15.3 seconds for `next.test.ts`, 14.0 for `unit-red-green.test.ts`, 13.5 for `helper/done.test.ts` and 11.9 for `unit-commit.test.ts`. The retrospective of #15 saw three test files time out in one run. Should a later ticket apply the same pattern to them? Recommended answer: yes, in a new ticket after this wave, because tickets #63 and #64 change `unit-red-green.test.ts` and `unit-commit.test.ts` right now. For: the user. Answer: yes, in a separate ticket that I suggest to the user after this wave. The user accepted it ("ok for the rest"), 2026-11-19.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
