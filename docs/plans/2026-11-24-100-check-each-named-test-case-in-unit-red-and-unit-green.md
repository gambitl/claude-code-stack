# Plan: #100 — R3-3: Check each named test case in unit red and unit green

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/100
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/per-case-red-green
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T11:17:30+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Make `cstack` refuse a unit when one of its new test cases already passed before the code that it tests existed.

- **What the title means**: A unit is one small piece of the plan, with its own test and its own commit. `cstack unit red` runs the test before the code and requires a failure. `cstack unit green` runs it after the code and requires a success. A named test case is a case that the plan lists for the unit.
- **Why we are doing it**: In the weakest branch of the earlier comparison, new negative tests passed before their route existed, because a missing route gives the same error. Another case of the same file failed, so `cstack unit red` accepted the unit. A test that passes before its code proves nothing.
- **For the user**: Every new test case of a run has really been seen failing first, so it really tests the new code.

**Goal.** This ticket makes `cstack unit red` and `cstack unit green` check each named test case on its own, when a per-case report is available.

### Where things are today (read first)

* **`cstack unit red`**: `cstack/src/commands/unit-red.ts` → `unitRed()` (lines 8 to 71) refuses an exit code of 0 at line 48. When the settings have no `file` command, lines 65 to 68 only tell the user to check `red.log` by hand.
* **`cstack unit green`**: `cstack/src/commands/unit-green.ts` → `unitGreen()` (lines 11 to 122) refuses any exit code other than 0, at lines 80 and 101.
* **Preparing the test**: `cstack/src/unit-test-command.ts` → `prepareUnitTest()` (lines 33 to 127) reads `unit.test.file` (line 109) and the test commands (line 100).
* **Saving the runs**: `cstack/src/unit-test-runs.ts` → `saveFailingRun()` (line 31) and `savePassingRun()` (line 37) write `units/<n>/red.json` and `green.json` in the run folder. `cstack/src/saved-runs.ts` → `readSavedRun()` (line 10) reads them back.
* **The named cases**: #98 lets a unit name several new test cases in plan format version 2.
* **The per-case results**: #99 makes `runTests()` return the result of each case when the settings declare a report.
* **Tests**: `cstack/test/unit-red-green.test.ts`. Its `setup()` (line 33) fakes the test command, and `planText()` (line 19) builds plans from `cstack/test/fixtures/plans/approved.md`.
* **The cause**: `docs/decisions/ADR-SIC-G-continue-or-stop.md`, cause 2 of the weakest branch.

### Scope

1. In `cstack unit red`, when a per-case report is available, require each named case of the unit to be in the report and to fail. "Fail" means the outcome is failed or error. Refuse the unit and name each case that passed or is missing.
2. When a case that the plan does not name passes in the red run, print a warning and write it in the plan file. The unit is not refused for it.
3. In `cstack unit green`, require each named case to be in the report and to pass.
4. Save the per-case results in `red.json` and `green.json`.
5. Without a per-case report, keep today's check of the whole file. Write in the plan file that the unit used this fallback, and record it in the saved run, so that the audit can report it.

### Acceptance (TDD)

* `cstack/test/unit-red-green.test.ts`: write first a unit with two named cases, where one passes before the code and the other fails. `cstack unit red` refuses the unit and names the case that passed, even though the file as a whole fails. This is cause 2 of ADR-SIC-G.
* The same file: when both named cases fail, `cstack unit red` accepts the unit. When a named case is missing from the report, it refuses the unit and names the case.
* The same file: an unnamed case that passes in the red run gives a warning in the plan, and the unit is accepted.
* The same file: `cstack unit green` refuses a unit when a named case still fails.
* The same file: without a per-case report, the result is the same as today, and the plan records the fallback.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #98, #99 · Feeds: #103


### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Acceptance criteria of US-6 that this ticket carries.** The specification lists them in section 4, under "US-6: Each new test case fails first".

- AC1: The settings file can declare a report per test case for each test command. The report uses the JUnit XML format, which pytest and vitest can both write.
- AC2: Each unit of the plan names its new test cases.
- AC3: `cstack unit red` requires each named case to fail. `cstack unit green` requires each named case to pass.
- AC4: When a case that the plan does not name passes in the red run, `cstack` writes a warning in the plan.
- AC5: Without a report per case, `cstack` falls back to today's check of the whole test file. It writes that fallback in the plan, and the audit reports it.
- AC (negative): A unit whose named case passes before the code exists is refused, even when another case of the same file fails. This is the second cause in ADR-SIC-G.

The ADRs that this block names:

- ADR-RQG-A: How helpers and units run inside a ticket. It does not exist yet, because #93 writes it in this wave.
- [ADR-RQG-B: Version 2 of the plan format](../decisions/ADR-RQG-B-plan-format-version-2.md). #98 wrote it, so it is no longer "to create".
- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards. Cause 2 of its weakest branch is the cause that this ticket fixes.

## Dependencies

clear. #98 and #99 are closed as completed, and their code is on `main`.

## Code mapping

**Entry points.** `cstack unit red` is `unitRed()` in `cstack/src/commands/unit-red.ts`. It runs the test at line 37 with `runTests(root, testScript(commands, testFile), testFile, timeoutMs)`, so it asks for no report today. It refuses an exit code of 0 at lines 48 to 53, and saves the failing run at lines 55 to 60. Lines 65 to 69 print a hint when the settings have no `file` command. `cstack unit green` is `unitGreen()` in `cstack/src/commands/unit-green.ts`. It runs the test at line 77, also without a report. It deletes an earlier passing run when the exit code is not 0 (lines 80 to 88), refuses a timeout or a command that cannot start with exit code 5 (lines 89 to 100), and refuses a failing run with exit code 1 (lines 101 to 106). It saves the passing run at lines 107 to 116. Both commands share `prepareUnitTest()` in `cstack/src/unit-test-command.ts` (lines 33 to 127). It returns `{ root, runDir, unit, testFile, commands, timeoutMs }` (line 123), and `unit.test.cases` holds the named cases.

**The per-case report of #99.** `usesReport(commands, testFile)` in `cstack/src/test-run.ts` (lines 38 to 40) is true only with a test file, a `file` command and `commands.report === "junit"`. `runTests()` takes `{ report: true }` as its fifth argument (line 116). Then `TestRun.report` (line 34) is a `ReportResult` (lines 15 to 17): either `{ cases }` or `{ problem: "missing" | "malformed" | "timed-out", message }`. `runTests()` never throws for a report problem. `testScript()` turns `{report}` into `"$2"` (line 49), so a settings file that declares a report gives an empty `"$2"` to both commands today. `TestCase` in `cstack/src/junit-report.ts` (lines 9 to 14) has `name`, optional `classname` and `file`, and `outcome`, which is `"passed" | "failed" | "error" | "skipped"` (line 7). Two cases with the same name stay as two entries.

**The named cases of #98.** `PlanUnit.test` is `{ file: string; cases: string[] }` (`cstack/src/plan/read.ts`, line 98). The reader gets one case from each `- Test:` line, and it refuses a case named twice in a unit (lines 446 to 460). It does not check that a case matches a name in a report. ADR-RQG-B says at line 57 that a case is written as the JUnit report names it. For vitest, that is the titles of the describe blocks and the title of the test, joined by ` > `.

**Writing into the plan file.** The plan format already allows free notes after the unit lines: the reader skips any line after `- Depends on:` that is not a unit line (`cstack/src/plan/read.ts`, line 391, "After Depends on, free notes and optional lines follow"). The unit lines are a fixed list (line 346). `cstack` writes into the plan file in one place today: `cstack helper start` writes the `- Worktree:` line with `setUnitWorktree()` (`cstack/src/plan/unit-line.ts`, lines 18 to 41), inside the commit lock, with `writeFileAtomic()` (`cstack/src/helper/start.ts`, lines 325 to 327). `cstack/src/plan/unit-line.ts` is not a file of this ticket.

**The saved runs.** `SavedTestRun` in `cstack/src/run-state.ts` (lines 34 to 40) has `time`, `command`, `exitCode`, `commit` and `testFile`. `SavedUnitRun` adds `testFileSha256`, and `FailingUnitRun` adds `startedAt` (`cstack/src/unit-test-runs.ts`, lines 6 to 13). `write()` saves the log and then the JSON, with two spaces of indent (lines 17 to 21). `readSavedRun()` in `cstack/src/saved-runs.ts` checks only that `time` is a valid date (line 25), so a new optional field does not break any reader. The readers of the saved runs are `cstack unit commit` (`cstack/src/commands/unit-commit.ts`, lines 70, 71 and 105), `cstack plan status`, which checks only that the files exist (`cstack/src/commands/plan-status.ts`, lines 55 and 56), and `cstack report submit`, which checks only that the files exist (`cstack/src/report/reports.ts`, lines 117 to 127).

**Escaping.** `quote()` in `cstack/src/settings.ts` (lines 100 to 104) escapes a value with `JSON.stringify` and the C1 control characters, and it cuts the result at 60 characters. A vitest name such as `cstack unit red > refuses a unit when a named case passed before the code` is longer than 60 characters, so `quote()` would cut it in a message.

**Tests.** `cstack/test/unit-red-green.test.ts` has 627 lines. `planText()` (lines 19 to 30) builds a plan from `cstack/test/fixtures/plans/approved.md`, which is in format `cstack-plan/2`. `setup()` (lines 33 to 50) creates a git repository with a settings file, and the fake test file `test/a.test.ts` is a shell script that the `file` command runs with `sh "$1"`. A per-case test can make the fake script write a JUnit XML file to `"$2"`. One test starts two child processes on the TypeScript source (lines 282 to 321). Its loader hook maps a `.js` import to the `.ts` file, so the dynamic `import("./junit-report.js")` of `runTests()` can resolve there. The two child-process tests of `cstack/test/test-run.test.ts` (lines 140 to 160) import `cstack/src/test-run.ts` with no hook and ask for no report.

**Governing decisions.** ADR-SIC-G, cause 2 (`docs/decisions/ADR-SIC-G-continue-or-stop.md`, line 59), is the cause that this ticket fixes. ADR-RQG-B (`docs/decisions/ADR-RQG-B-plan-format-version-2.md`, lines 57 and 71) fixes how a case is named. The `WHY:` comments of the files to change are about the time of the run (`unit-red.ts` line 30, `unit-green.ts` line 70), the older `red.json` without a hash (`unit-green.ts` line 23), the modification time check (`unit-green.ts` lines 38 and 39) and the deletion of a passing run (`unit-green.ts` line 81). The comment at `cstack/src/test-run.ts` lines 96 and 97 explains the dynamic import of the JUnit reader.

**Risks.**
- The files to change were fixed several times: `unit-green.ts` has eight commits, four of them fixes about the passing run that must be deleted on every failure. A new refusal in `cstack unit green` must delete the earlier passing run too.
- An unnamed case that passes in the red run is normal for an old case of an existing test file. A test file such as `cstack/test/unit-red-green.test.ts` has more than 60 cases, so a warning for each passing unnamed case could add 60 warnings to the plan at each red run.
- Writing into the plan file during the build leaves the plan file changed in the work tree. `cstack unit commit` commits only the files of the unit, and `cstack plan status` refuses a commit that mixes code and documentation under one `Cstack-Unit` trailer.
- A name from the report is untrusted text. A name written into the plan file must stay on one line, so that it cannot add a heading or a unit line to the plan.
- AC5 of US-6 says that the audit reports the fallback. The audit is not a file of this ticket, so this ticket only records the fallback in the saved run and in the plan.
- The README paragraphs of `cstack unit red` and `cstack unit green` are at lines 66 and 67 of `README.md`.

## Decisions

- This ticket builds on #99 and #98, which are both merged. #99 added the report per test case, and #98 lets a unit name its test cases on several `- Test:` lines. The comments on #100 say how to call `runTests()` with a report and how the names of the cases are written. (2026-11-24, from the brief of the run)
- A comment from #99 asks what this ticket does with the tests that start a child process. That question goes to the user in the question round. (2026-11-24, from the brief of the run)
- #101 comes after this ticket. It adds a command that breaks a rule on purpose to prove a negative test. It will add a hash of each file of the unit to the saved green run, and it will read the result of each case. So keep the format of `red.json` and `green.json` easy to extend, and describe that format in this plan. Build nothing of #101. (2026-11-24, from the brief of the run)
- Two tickets of milestone R3 of epic #84 start now, each in its own worktree and with its own pull request. A third ticket, #93, is in its build in another worktree. #102 works in `cstack/src/phases.ts`, the check of the plan phase in `cstack/src/commands/next.ts`, a new module for its checks if it needs one, their tests, and the paragraph of `cstack next` in `README.md`. #93 works in the guides, the agent prompts, the plan template, the tests of `cstack/test/guides/`, `cstack/test/prompts.test.ts`, the end-to-end tests of `cstack/test/e2e/`, ADR-RQG-A and section 9 of the specification. (2026-11-24, from the coordinator of the wave)
- This ticket changes only `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/saved-runs.ts`, their tests, and the paragraphs of `cstack unit red` and `cstack unit green` in `README.md`. In `cstack/src/manifest.ts` and `README.md`, change only the entry and the paragraph of your own command. When you need a file of another ticket of this wave, ask the coordinator before you change it. For example, if a change breaks an end-to-end test, ask first, because #93 changes those tests right now. (2026-11-24, from the coordinator of the wave)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and do not add a runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- Do not change the plan format. #98 defined version 2 in ADR-RQG-B, and `readPlan()` in `cstack/src/plan/read.ts` already returns the named test cases, the negative criteria, the facts and the changes. When this ticket needs a new line or a new section in the plan, put it to the user as a blocking question, and ask the coordinator before you plan it. (2026-11-24, from the brief of the run)
- This plan file stays in format `cstack-plan/1`, because the installed `cstack` 0.3.2 writes and reads it. Any plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `cstack/skills/resolve-issue/SKILL.md` have almost no margin left, because `cstack/test/skill-size.test.ts` counts them together. If you add a sentence to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 64. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-24, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-24, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-24, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. The main conversation puts those three rules, word for word, in the prompt of the executor. (2026-11-24, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-24, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-24, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-24, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-24, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-24, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must not do needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-24, from the retrospective of #86, `docs/retros/2026-11-23-86.md`)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-24, from the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-24, from the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-24, from the retrospective of #86)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-24, from the retrospective of #89, `docs/retros/2026-11-23-89.md`)
- `cstack helper wait` takes no `--plan`. Run it only after the sub-agent has returned. (2026-11-24, from the retrospective of #89)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-24, from the retrospective of #89)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-24, from the retrospective of #89)
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. #114 added this check to `cstack publish` on `main`, but the installed 0.3.2 does not have it. (2026-11-24, from the retrospective of #89)
- Run each deliberate break of the code with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`, because a break can make a test loop forever. If a vitest process of this worktree still runs after that, stop it. Never stop a process of another worktree. (2026-11-24, from the runs of #91, #99 and #114)
- When the plan asks a test to check a message, the plan gives the exact words of that message. Otherwise the implementer chooses its own words. (2026-11-24, from the runs of #91, #99 and #114)
- A question for the user reaches a ticket only after the user saw it, word for word, in the chat. (2026-11-24, from the runs of #91, #99 and #114)
- If a result of a sub-agent reaches the main conversation instead of the executor that started it, the main conversation sends it to the executor in a message. (2026-11-24, from the runs of #91, #99 and #114)
- Three runs share this machine. If the full `npm test` fails on a 5-second timeout, run the failing test file alone before you conclude that the code is wrong. (2026-11-24, from the runs of #91, #99 and #114)
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the runs of #91, #99 and #114)
- A line of `## Decisions` that says how a function behaves needs a test case of its own too, not only a line that says what it must not do. (2026-11-24, from the runs of #98 and #118)
- When a unit has several refusals, the implementer breaks each refusal on its own, one at a time, and sees its own test fail. (2026-11-24, from the runs of #98 and #118)
- A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the runs of #98 and #118)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-24, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-24, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-24, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. Never read the private work data of the comparison runs or their session files. (2026-11-24, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-24, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-24, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-24, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-24, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-24, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-24, from the conventions file and the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-24, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep every change of both sides, and push with a plain `git push`, without force. (2026-11-24, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-24, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-24, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-24, from the brief of the run)
- A named case matches every case of the report whose `name` is exactly the text of its `- Test:` line. In the red run, every matching case must have the outcome `failed` or `error`. In the green run, every matching case must have the outcome `passed`. A case with the outcome `skipped` neither fails nor passes, so it is refused in both runs. The four outcomes are listed in `cstack/src/junit-report.ts`, line 7. (2026-11-24, an assumption not asked)
- The checks of the exit code stay as they are today. A timeout and an exit code of 126 or 127 still exit with 5, an exit code of 0 is still refused in the red run (`cstack/src/commands/unit-red.ts`, lines 40 to 53), and an exit code other than 0 is still refused in the green run (`cstack/src/commands/unit-green.ts`, lines 89 to 106). The check of each named case comes on top of them. (2026-11-24, an assumption not asked)
- A refused run saves nothing and writes nothing in the plan file, as the refusals of today do. When the check of the named cases refuses a green run, it deletes the earlier passing run first, as the comment at `cstack/src/commands/unit-green.ts`, line 81, asks for any failing green run. (2026-11-24, an assumption not asked)
- Without a `file` command or without `"report": "junit"` in the settings, `usesReport()` is false (`cstack/src/test-run.ts`, lines 38 to 40). Then both commands ask for no report and use the check of the whole test file, as today. (2026-11-24, an assumption not asked)
- The tests that start a child process stay without a report, and nothing changes in how they load the source. The new per-case tests call `unitRed()` and `unitGreen()` inside the vitest process. Keep the dynamic `import("./junit-report.js")` of `cstack/src/test-run.ts` (line 98). (2026-11-24, the user's answer in the question round, accepted by default)
- `cstack unit red` and `cstack unit green` write their warning and their fallback as one free note line at the end of the unit, after its unit lines. The reader of the plan skips such a line (`cstack/src/plan/read.ts`, line 391), so the plan format does not change. The note has one fixed sentence form that the tests check word for word, and no command parses it. Each command keeps at most one note in each unit, and its next accepted run replaces or removes it. A refused run leaves the note as it was. (2026-11-24, the user's answer in the question round, accepted by the coordinator of the wave)
- cstack writes the plan file with `writeFileAtomic()` inside `withCommitLock()`, as `cstack helper start` writes the `- Worktree:` line (`cstack/src/helper/start.ts`, lines 325 to 327). It never commits the plan file. The changed plan file goes into a documentation commit of the run before `cstack publish`, because `cstack publish` refuses tracked files with uncommitted changes (`cstack/src/commands/publish.ts`, lines 91 to 101). (2026-11-24, the user's answer in the question round)
- In the red run, a case that the plan does not name and that passes gives a warning only when its test title does not appear in the version of the test file at HEAD. The test title is the part of the case name after the last ` > `. When the test file does not exist at HEAD, every passing unnamed case gets a warning. The warning never refuses the unit. (2026-11-24, the user's answer in the question round)
- When the settings declare a report and the run gives none, because the report is missing or malformed, both commands fall back to the check of the whole test file. They print a warning with the reason, and they record the fallback and its reason in the saved run and in the note of the unit. A missing report usually means that the test tool was not told to write one, so the warning names `testCommands.file` as the place to check. (2026-11-24, the user's answer in the question round)
- This ticket adds a unit for `cstack audit`. The audit prints one more line for each unit whose saved red or green run used the check of the whole test file, and that line names the unit and the reason. The line does not change the exit code of `cstack audit`. This unit may change `cstack/src/audit/`, the `cstack audit` paragraph of `README.md`, and ADR-RQG-C if its rules need it, because no other ticket of the wave changes them now. (2026-11-24, the user's answer in the question round, on the proposal of the coordinator of the wave)
- A named case with the outcome `skipped` is refused in both runs. The message says that the case never ran, and that a failing `beforeAll` hook is a common cause. (2026-11-24, the user's answer in the question round, accepted by default)
- Case names are printed whole and escaped, never cut. `quote()` cuts its result at 60 characters (`cstack/src/settings.ts`, lines 100 to 104), so a small helper in `cstack/src/unit-test-command.ts` escapes the same way without the cut. `cstack/src/settings.ts` does not change. (2026-11-24, the user's answer in the question round, accepted by default)
- When `red.json` holds the result of each case, `cstack unit green` also requires each named case to be among those cases with the outcome `failed` or `error`. Otherwise it deletes any earlier passing run, refuses the unit and prints the restart text. When `red.json` has no result of each case, because it is older or used the fallback, this comparison is skipped. (2026-11-24, the user's answer in the question round, accepted by default)
- `red.json` and `green.json` get optional fields: how the cases were checked, the reason of a fallback, and each case of the report with its name and its outcome. They never hold the failure message of a case, because vitest puts absolute paths in it. (2026-11-24, the user's answer in the question round, accepted by default)
- Both commands ask for the report with `runTests(root, script, testFile, timeoutMs, { report: usesReport(commands, testFile) })`. `usesReport()` and `runTests()` are in `cstack/src/test-run.ts` (lines 38 and 111), and this ticket does not change that file. (2026-11-24, decided in the plan)
- The format of `units/<n>/red.json` and `units/<n>/green.json` keeps every field of today: `time`, `command`, `exitCode`, `commit`, `testFile` and `testFileSha256`, plus `startedAt` in `red.json` (`cstack/src/unit-test-runs.ts`, lines 6 to 13). Every new run adds `caseCheck`, which is `"cases"` when the report was checked case by case, and `"file"` when the whole test file was checked. With `"file"`, the run adds `fallback`, which is `"no-report"`, `"missing"` or `"malformed"`. With `"cases"`, the run adds `cases`, the list of every case of the report in report order, each as `{ "name": <name>, "outcome": <outcome> }`. The new fields are optional in the type `SavedUnitRun`, because older files lack them. (2026-11-24, decided in the plan)
- The format stays easy to extend for #101. A later field, such as a hash of each file of the unit, is one more optional key of the same JSON object. `readSavedRun()` checks only that `time` is a valid date (`cstack/src/saved-runs.ts`, line 25), so every reader ignores a key that it does not know. Build nothing of #101. (2026-11-24, decided in the plan)
- `cstack/src/unit-test-runs.ts` exports the three reasons of a fallback, as one object `FALLBACK_REASONS`. `"no-report"` reads "the settings declare no per-case report". `"missing"` reads "the test command wrote no report file". `"malformed"` reads "the report file is not a JUnit report that cstack can read". The messages, the notes and the audit use these words, and only these. (2026-11-24, decided in the plan)
- `caseName(name)` in `cstack/src/unit-test-command.ts` writes a case name for a message or a note. It returns `JSON.stringify(name)` with each character from U+007F to U+009F written as `\u` and four hexadecimal digits, as `quote()` does (`cstack/src/settings.ts`, lines 100 to 104), but it never cuts the result. So the name keeps its double quotes, and a line break inside it becomes `\n`. (2026-11-24, decided in the plan)
- The order of the checks in `cstack unit red` is: the timeout and the exit codes 126 and 127, as today, then the named cases when the report holds cases, then the exit code 0, as today, then the save. A named case is not failing when a case of the report with its name passed, when it is missing from the report, or when its cases were skipped. When a case of the report with its name passed, the message says "passed", even if another case with that name was skipped. (2026-11-24, decided in the plan)
- When the named cases refuse a red run, `cstack unit red` prints these exact lines on standard error and exits with 1. The first line is `cstack unit red: These cases that unit <n> names do not fail before the code exists:`. Then comes one line for each named case that does not fail, in the order of the plan: `  <name> passed.`, `  <name> is not in the test report.` or `  <name> was skipped, so it never ran. A failing beforeAll hook is a common cause.`, where `<name>` is written by `caseName()`. The last line is `Each case that the plan names must fail before the code exists. Write each case name exactly as the test report names it. For vitest, that is the titles of the describe blocks and the title of the test, joined by " > ". Nothing is saved.` (2026-11-24, decided in the plan)
- The order of the checks in `cstack unit green` is: the checks of today before the test runs, then the comparison of the named cases with `red.json`, then the test run, then the deletion of the passing run when the exit code is not 0, as today, then the timeout and the exit codes 126 and 127, as today, then the named cases when the report holds cases, then the exit code other than 0, as today, then the save. (2026-11-24, decided in the plan)
- When `red.json` holds `cases`, each named case must be among them with the outcome `failed` or `error`. Otherwise `cstack unit green` deletes the earlier passing run, prints this exact text on standard error and exits with 1: `cstack unit green: These cases that unit <n> names are not among the failing cases of its saved failing run: <name>, <name>. Each named case must be seen failing before the code exists. No test ran, nothing is saved, and any earlier passing run is deleted.` It is followed by a line break and the text of `restartText(n)` (`cstack/src/unit-files.ts`, lines 43 to 49). (2026-11-24, decided in the plan)
- When the named cases refuse a green run, `cstack unit green` deletes the earlier passing run, prints these exact lines on standard error and exits with 1. The first line is `cstack unit green: These cases that unit <n> names do not pass:`. Then comes one line for each named case that does not pass, in the order of the plan: `  <name> failed.`, `  <name> is not in the test report.` or `  <name> was skipped, so it never ran. A failing beforeAll hook is a common cause.` A case with the outcome `error` counts as "failed". The last line is `Nothing is saved, and any earlier passing run is deleted.` (2026-11-24, decided in the plan)
- After an accepted red run with a report, `cstack unit red` looks for the cases that the unit does not name and that passed. It keeps those whose test title does not appear in the version of the test file at HEAD. It reads that version with `git show HEAD:<test file>`, run without a shell. When git fails, for example because the file is new, every passing unnamed case is kept. When it keeps at least one case, it prints on standard output, after the line that says the unit fails as it should: `cstack unit red: Warning: these cases of <test file> are not named in unit <n>, and they passed before the code existed:`, then one line `  <name>` for each case, then `If one of them is new, name it on a \`- Test:\` line of the unit and make it fail first. The plan file notes this under unit <n>.` (2026-11-24, decided in the plan)
- When the settings declare no per-case report, both commands print on standard output, after their usual result line: `cstack unit <red or green>: The settings declare no per-case report, so cstack checked the whole test file. The plan file notes this under unit <n>.` The hint of today about `red.log` (`cstack/src/commands/unit-red.ts`, lines 65 to 69) stays. (2026-11-24, decided in the plan)
- When the settings declare a report and the run gives none, both commands print on standard error, after their usual result line: `cstack unit <red or green>: Warning: <reason>, so cstack checked the whole test file. Check that testCommands.file in .cstack/settings.json makes the test tool write a JUnit report to {report}. The plan file notes this under unit <n>.` The reason is the text of `"missing"` or `"malformed"` in `FALLBACK_REASONS`. For a malformed report, the next line is `The reader of the report says: <message>`, with the message of the report problem. (2026-11-24, decided in the plan)
- The note of `cstack unit red` for the unnamed passing cases is one line: `Note of cstack unit red: these cases are not named in this unit, and they passed before the code existed: <name>, <name>.` It holds at most ten names, in report order. With more, it ends with `, and <k> more.` in place of the final period, where `<k>` is the count of the other cases. (2026-11-24, decided in the plan)
- The note of a fallback is one line: `Note of cstack unit <red or green>: the whole test file was checked, because <reason>.` The reason is one of the three texts of `FALLBACK_REASONS`. (2026-11-24, decided in the plan)
- The note of a command is the line of the unit that starts with `Note of cstack unit red: ` or with `Note of cstack unit green: `. After an accepted run, the command removes its own note from the unit, and then adds its new note, if it has one, after the last line of the unit that is not empty. The unit runs from its heading to the line before the next heading of the plan. The note of the other command and every other line stay as they are. A red run with a report and no unnamed passing case, and a green run with a report, have no note. (2026-11-24, decided in the plan)
- The functions that write the note live in `cstack/src/unit-test-runs.ts`. `setUnitNote()` changes the text of the plan, and `writeUnitNote()` writes the plan file with `writeFileAtomic()` inside `withCommitLock()`, on the lock file `plan-file.lock` in the folder `cstack` of the git folder of the work tree, with a wait of 60 seconds. This is the lock that `cstack helper start` uses for the plan file (`cstack/src/helper/start.ts`, lines 323 to 327). `prepareUnitTest()` adds the path of the plan file to the context that it returns. (2026-11-24, decided in the plan)
- Each command writes its note after it saved the run. When the note cannot be written, it prints `cstack unit <red or green>: The <failing or passing> run is saved, but cstack could not write the note of unit <n> into the plan file: <message>. Run \`cstack unit <red or green> <n>\` again.` on standard error and exits with 5. (2026-11-24, decided in the plan)
- The exit codes of `cstack unit red` and `cstack unit green` in `cstack/src/manifest.ts` keep their numbers. The text of code 1 of `cstack unit red` adds that a named case does not fail. The text of code 1 of `cstack unit green` adds that a named case does not pass or was not seen failing in the saved failing run. The text of code 5 of both commands adds that cstack cannot write the note into the plan file. The usage lines do not change. (2026-11-24, decided in the plan)
- `cstack audit` prints its new lines after all its other lines, in the order of the units of the plan. For each unit whose `red.json` or `green.json` holds `"caseCheck": "file"`, it prints one line. With only the red run, the line is `build: unit <n>: the whole test file was checked in the red run, because <reason>`. With only the green run, it ends with `in the green run, because <reason>`. With both runs and the same reason, it is `build: unit <n>: the whole test file was checked in the red run and the green run, because <reason>`. With two different reasons, it is `build: unit <n>: the whole test file was checked in the red run, because <red reason>, and in the green run, because <green reason>`. (2026-11-24, decided in the plan)
- The audit reads the saved runs with a small module of its own, `cstack/src/audit/whole-file.ts`, and it takes the reasons from `FALLBACK_REASONS`. It ignores a saved run that it cannot read, a run without `caseCheck` and a `fallback` value that it does not know. The lines are left out while the build phase is not over, like every line that starts with `build: ` (`cstack/src/commands/audit.ts`, lines 137 to 140). They have no verdict, so they never change the exit code of `cstack audit`. (2026-11-24, decided in the plan)
- `cstack/src/audit/whole-file.ts` holds this comment above its function: `// WHY: ADR-RQG-C, section "How the audit reports the check of the whole test file".` It follows it with one sentence that says why the line has no verdict. (2026-11-24, decided in the plan)
- The tests of the per-case report use a settings file with `"file":"sh {file} {report}"` and `"report":"junit"`, so the fake test file gets the path of the report as its own first argument. The fake test file copies a JUnit file that the test wrote, for example `cp test/report.xml "$1"`, and then exits with the code that the case needs. A small helper of the test file builds the XML from a list of names and outcomes, and escapes `&`, `<`, `>` and `"`. (2026-11-24, decided in the plan)
- Each unit lists its new test cases in its notes. Each of them must fail before the code of the unit exists. The executor gives the list to the implementer, together with the three guards. (2026-11-24, decided in the plan)
- The notes in the plan file change the plan file of a test repository at each accepted run. If a test of `cstack/test/e2e/` fails because of it, the implementer does not change that test. It reports the unit as stuck, and the main conversation asks the coordinator of the wave first, because #93 changes those tests now. A test outside `cstack/test/e2e/` that fails because of the notes is fixed in the same unit, and the report says so. (2026-11-24, decided in the plan and from the brief of the run)
- No security surface of the usual kind: no endpoint, no database and no secret. The names from a report are untrusted text. They reach a message or the plan file only through `caseName()`, so a note always stays on one line and cannot add a heading or a unit line. git runs without a shell, and the test file path reaches it as one argument. (2026-11-24, decided in the plan)

## Architecture

The approach is locked by the ticket and the answers of the question round, so no architecture options were drawn. `cstack unit red` and `cstack unit green` ask `runTests()` for the report, compare the named cases with one shared function, and save the result of each case in their saved run. Without a usable report, they keep the check of today and record why. The notes in the plan file and the audit line only read what the saved run and the run already know.

No new decision since the question round.

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
- Worktree: <path, with ~/ in place of the home folder>, optional, written by cstack when a unit runs in a child worktree, never by a person
Free notes come after these lines.
Each unit commit carries the trailer "Cstack-Unit: <n>" in the final paragraph of its message, together with any other trailer such as Co-Authored-By. git does not read a trailer outside the final paragraph. A commit with two Cstack-Unit lines counts for both units. -->

### Unit 1: Check each named case in cstack unit red
- Files: `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/commands/unit-red.ts`, `cstack/src/manifest.ts`, `cstack/test/unit-red-green.test.ts`
- Test: `cstack/test/unit-red-green.test.ts`: cstack unit red with a per-case report > refuses a unit whose named case passed, even though the file fails, and names the case
- Minimum code: Ask `runTests()` for the report when `usesReport()` is true. Add `caseName()` and a function that compares the named cases with the cases of the report, in `cstack/src/unit-test-command.ts`. Refuse the red run with the exact message of the decisions, and save `caseCheck` and `cases` in `red.json`. Change the text of exit code 1 of `cstack unit red` in `cstack/src/manifest.ts`.
- Refactor: Keep the comparison as one pure function that `cstack unit green` can reuse in unit 2.
- Commit message: `feat(cli): check each named test case in cstack unit red`
- Depends on: none

New test cases, in the describe block "cstack unit red with a per-case report". Each one must fail before the code exists.
- refuses a unit whose named case passed, even though the file fails, and names the case
- accepts a unit when both named cases fail, and saves each case of the report in red.json
- refuses a unit whose named case is missing from the report, and names the case
- refuses a unit whose named case was skipped, and says that it never ran
- counts a named case with the outcome error as a failure
- refuses a named case when one of two report cases with its name passed
- prints a case name longer than 60 characters whole

### Unit 2: Check each named case in cstack unit green
- Files: `cstack/src/unit-test-command.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/manifest.ts`, `cstack/test/unit-red-green.test.ts`
- Test: `cstack/test/unit-red-green.test.ts`: cstack unit green with a per-case report > refuses a unit whose named case still fails, names the case and deletes the earlier passing run
- Minimum code: Ask `runTests()` for the report when `usesReport()` is true. Before the test runs, compare the named cases with the `cases` of `red.json` when it has them. After the run, check each named case with the function of unit 1. Refuse with the exact messages of the decisions, delete the earlier passing run on each refusal, and save `caseCheck` and `cases` in `green.json`. Change the text of exit code 1 of `cstack unit green` in `cstack/src/manifest.ts`.
- Refactor: None.
- Commit message: `feat(cli): check each named test case in cstack unit green`
- Depends on: 1

New test cases, in the describe block "cstack unit green with a per-case report". Each one must fail before the code exists.
- refuses a unit whose named case still fails, names the case and deletes the earlier passing run
- refuses a unit whose named case is missing from the report, even though the test command exits with 0
- refuses a unit whose named case was skipped, even though the test command exits with 0
- accepts a unit when every named case passes, and saves each case of the report in green.json
- refuses a named case that is not among the failing cases of red.json, runs no test and deletes the earlier passing run
- skips the comparison with red.json when red.json holds no case, and saves the cases in green.json

### Unit 3: Record the check of the whole test file in the saved runs
- Files: `cstack/src/unit-test-runs.ts`, `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/test/unit-red-green.test.ts`
- Test: `cstack/test/unit-red-green.test.ts`: the check of the whole test file > cstack unit red without a per-case report saves the fallback and its reason in red.json and says so
- Minimum code: Export `FALLBACK_REASONS` from `cstack/src/unit-test-runs.ts`. In both commands, when `usesReport()` is false or the report has a problem, save `"caseCheck": "file"` and the `fallback` code, and print the exact sentences of the decisions. Keep every result of today.
- Refactor: None.
- Commit message: `feat(cli): record the check of the whole test file in the saved runs`
- Depends on: 2

New test cases, in the describe block "the check of the whole test file". Each one must fail before the code exists.
- cstack unit red without a per-case report saves the fallback and its reason in red.json and says so
- cstack unit green without a per-case report saves the fallback and its reason in green.json and says so
- cstack unit red falls back when the declared report is missing, warns and names testCommands.file
- cstack unit red falls back when the declared report is malformed, warns and gives the problem
- cstack unit green falls back when the declared report is missing, warns and saves the reason

### Unit 4: Note the unnamed passing cases and the fallback in the plan file
- Files: `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/manifest.ts`, `cstack/test/unit-red-green.test.ts`
- Test: `cstack/test/unit-red-green.test.ts`: the note of a unit in the plan file > writes a note for an unnamed case that passed in the red run, and accepts the unit
- Minimum code: Add the path of the plan file to the context of `prepareUnitTest()`. Add `setUnitNote()` and `writeUnitNote()` to `cstack/src/unit-test-runs.ts`. Find the passing unnamed cases whose title is not in the test file at HEAD. Print the warning and write the notes with the exact words of the decisions, after the run is saved. Change the text of exit code 5 of both commands in `cstack/src/manifest.ts`.
- Refactor: None.
- Commit message: `feat(cli): note the unnamed passing cases and the fallback in the plan file`
- Depends on: 3

New test cases, in the describe block "the note of a unit in the plan file". Each one must fail before the code exists. After the code, run the end-to-end tests of `cstack/test/e2e/` once, and follow the decision about them if one fails.
- writes a note for an unnamed case that passed in the red run, and accepts the unit
- notes only the passing unnamed case whose title is not in the test file at HEAD
- notes every passing unnamed case when the test file is not in HEAD
- writes at most ten names in the note and counts the others
- writes the fallback note of cstack unit red
- writes the fallback note of cstack unit green
- replaces its own note at the next accepted run, and keeps the note of the other command
- removes its own note when the next accepted run has nothing to note
- leaves the note as it was after a refused run
- keeps a case name with a line break on one line, and the plan still reads

### Unit 5: Show the check of the whole test file in cstack audit
- Files: `cstack/src/audit/whole-file.ts`, `cstack/src/commands/audit.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: cstack audit, the check of the whole test file > prints a line for a unit whose red run checked the whole test file, and exits with 0
- Minimum code: Add `cstack/src/audit/whole-file.ts`, which reads the saved runs of each unit and returns the exact lines of the decisions. Print them in `cstack/src/commands/audit.ts` after the other lines, and leave them out while the build phase is not over. Add the `WHY:` comment of the decisions.
- Refactor: None.
- Commit message: `feat(cli): show the check of the whole test file in cstack audit`
- Depends on: 3

New test cases, in the describe block "cstack audit, the check of the whole test file". Each one must fail before the code exists. The tests write `units/<n>/red.json` and `green.json` in the run folder of the audit fixture.
- prints a line for a unit whose red run checked the whole test file, and exits with 0
- prints one line for both runs when they fell back for the same reason
- prints both reasons when the red run and the green run fell back for different reasons
- prints a line for one unit and none for a unit whose runs checked each case
- leaves the line out while the build phase is not over, and prints it once the build phase is closed

### Unit 6: Document the check of each named case and its fallback
- Files: `README.md`, `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`
- No test: documentation only.
- Minimum code: Update the paragraphs of `cstack unit red`, `cstack unit green` and `cstack audit` in `README.md`, and no other paragraph. Add the section "How the audit reports the check of the whole test file" at the end of ADR-RQG-C.
- Refactor: None.
- Commit message: `docs: describe the check of each named test case and its fallback`
- Depends on: 4, 5

The paragraph of `cstack unit red` says how it checks each named case when the settings declare a report, when a case counts as failing, what the warning about unnamed passing cases is and when it appears, how it falls back to the whole test file, and that it writes a note in the plan file. The paragraph of `cstack unit green` says the same for passing cases, and adds the comparison with the saved failing run. Both say that the saved runs hold the result of each case. The paragraph of `cstack audit` says that the audit prints one line for each unit that used the check of the whole test file, with the reason, and that this line has no verdict and does not change the exit code. Its sentence "The exit code looks only at the printed lines" must stay true, so say that these lines are not verdict lines. The section of ADR-RQG-C says that these lines are a new kind of line, outside the blocks of mandatory steps, and why they have no verdict: a repository without a per-case report would otherwise fail every audit.

## Documentation duties

- The paragraphs of `cstack unit red`, `cstack unit green` and `cstack audit` in `README.md`: applies, written by unit 6.
- ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`): applies, written by unit 6. A new section "How the audit reports the check of the whole test file".
- The `WHY:` comment that names ADR-RQG-C in `cstack/src/audit/whole-file.ts`: applies, written by unit 5.
- The entries of `cstack unit red` and `cstack unit green` in `cstack/src/manifest.ts`: applies, written by units 1, 2 and 4. Only the texts of exit codes 1 and 5 change.
- The `cstack audit` entry of `cstack/src/manifest.ts`: does not apply, because its usage, its flags and its exit codes stay the same.
- ADR-RQG-B: does not apply, because the plan format does not change. The notes are free notes, which the format already allows.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply, because no story and no acceptance criterion changes.
- The comment on this ticket, #100: applies, written in the document phase.
- The comments on the dependent tickets: applies, written in the document phase. #103 hears about the per-case report in the settings, the notes in the plan and the audit line. #101 hears about the format of `red.json` and `green.json` and how to extend it.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Child-process tests and the per-case report
A comment from #99 asks this. `runTests()` loads the JUnit reader with a dynamic `import("./junit-report.js")` (`cstack/src/test-run.ts`, line 98). A child process that imports `cstack/src/test-run.ts` as TypeScript source, with no loader hook, fails with `ERR_MODULE_NOT_FOUND` when it asks for a report. Will this ticket keep its child-process tests without a report, or change how they load the source so that a static import works?
- For: the user
- Answer: keep the child-process tests without a report, and change nothing in how they load the source. The user accepted it by default on 2026-11-24, when the question round listed it under "I will do this unless you say no" and the user answered "go".

### Question 2: Where cstack writes the warning and the fallback in the plan file
The ticket asks `cstack unit red` and `cstack unit green` to write two things in the plan file. One is a warning when a case that the plan does not name passes in the red run. The other is the fact that a unit used the check of the whole test file. The plan format has no line for them. Where does cstack write them: in a free note at the end of the unit, which the format already allows, in a new optional unit line, which changes the plan format of ADR-RQG-B, or in a section outside the units?
- For: the user, and the coordinator of the wave for any change of the plan format
- Answer: one free note line at the end of the unit, after its unit lines, with one fixed sentence form. The user accepted the recommended answer on 2026-11-24 ("go"). The coordinator of the wave accepted it as no change of the plan format on 2026-11-24.

### Question 3: Which passing unnamed cases get a warning
The ticket says that a case that the plan does not name, and that passes in the red run, gives a warning. In a test file that already exists, every old case passes in the red run too. For example, `cstack/test/unit-red-green.test.ts` has more than 60 cases. Does cstack warn about every passing unnamed case, or only about the ones whose test title does not appear in the version of the test file at HEAD?
- For: the user
- Answer: warn only about a passing unnamed case whose test title, the part of its name after the last ` > `, does not appear in the version of the test file at HEAD. When the test file does not exist at HEAD, every passing unnamed case gets a warning. The user accepted the recommended answer on 2026-11-24 ("go").

### Question 4: A report that the settings declare but the run does not give
The settings can declare a report, and a run can still give none, because the report file is missing or malformed (`cstack/src/test-run.ts`, lines 15 to 17). In that case, do `cstack unit red` and `cstack unit green` fall back to the check of the whole test file and record the reason, or do they refuse the unit?
- For: the user
- Answer: fall back to the check of the whole test file, print a warning with the reason, and record the fallback and its reason in the saved run and in the note of the unit. The user accepted the recommended answer on 2026-11-24 ("go").

### Question 5: The audit reports the fallback
US-6, AC5 says that the audit reports a unit that used the check of the whole test file. No other ticket of milestone R3 does it, and the coordinator of the wave proposes a unit of this ticket for it, in `cstack/src/audit/`, the `cstack audit` paragraph of `README.md` and ADR-RQG-C if its rules need it. Does this ticket add that unit? If it does, how does the audit show the fallback, and does that line change the exit code of `cstack audit`?
- For: the user, after the proposal of the coordinator of the wave
- Answer: yes, this ticket adds a unit for the audit. The audit prints one more line for each unit whose saved red or green run used the check of the whole test file, with the unit and the reason, and that line does not change the exit code. The user accepted the recommended answer on 2026-11-24 ("go"), after the proposal of the coordinator of the wave.

## Review log

Impact notes (phase review): The branch changed unit-red.ts, unit-green.ts, unit-test-command.ts, unit-test-runs.ts, audit.ts and the exit code text in manifest.ts. Outside callers of the changed helpers are `cstack/src/test-run.ts` (the report reader, unchanged), `cstack/src/commands/publish.ts` (reads saved runs, extra fields are optional so it still works) and the tests `cstack/test/unit-test-runs.test.ts` and `cstack/test/test-run.test.ts`. The usual companions are `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts` and the README, and the branch updated the README and the manifest text. The full test run in unit 4 passed. The ADR `ADR-RQG-C-expected-steps-of-a-run.md` was read and its audit sentence was aligned.

Reviewer findings and fixes (phase review):
- Correctness: in a child worktree the note of `cstack unit red` and `cstack unit green` went into the child's copy of the plan file, and `cstack unit collect` restored that copy, so the note was lost. Fixed: collect now copies the notes of the unit into the ticket plan before it restores the file, with a test.
- Correctness, minor: the message of exit code 5 could end with two periods. Fixed, with a test.
- Security: no finding. Low-confidence notes, not fixed: `caseName` does not escape bidirectional control characters, and `readSavedRun` does not check the type of `cases` in a hand-edited `red.json`. Both are cosmetic or still refuse.
- Conventions: no finding. Minor: `caseName` lives in `unit-test-command.ts` and `unit-test-runs.ts` imports it, and `audit.ts` calls `runFolder` twice. Left as they are.
- Simplicity: the shared report code and message texts of the two commands moved into two helpers in `unit-test-runs.ts`, and `buildNote` uses `noteStart` everywhere. Fixed.
- Found by running the tests: the end-to-end audit check rejected the new audit lines about the whole test file. The test now exempts those lines, because they carry no verdict. The full `npm run typecheck && npm test` passes (132 files, 1986 tests).
- Note: the first fix commit does not compile alone, because it imports a helper that the next commit adds. The branch tip is fine.

Independent review (phase independent-review): pending.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- A comment from #99 says that pytest gives `error`, not `failed`, for a broken fixture. `cstack unit red` counts `error` as a failure, as the ticket asks, so a case can fail first for the wrong reason. Should a later ticket treat `error` differently in the red run? For: the maintainer of `cstack`.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

- Unit 2 did not run the deliberate-break check that the wave rules ask for, and unit 4 skipped it too. The implementer reports say so.
- `cstack helper wait` for unit 1 exited with 1 when I ran it right after starting the sub-agent, because the sub-agent had not returned yet. I ran it again after it returned.
- The README sentence about the audit exit code was reworded in unit 6, and the ADR still quoted the old wording. I fixed the ADR line.

## Hand-off log

2026-11-24 (executor, build): moved ticket #100 to "in progress" with cstack tracker move. Built units 1 to 6 one at a time with implementer sub-agents. Fixed one ADR sentence to match the README.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Where `cstack` writes the warning and the fallback in the plan file.** The plan format has no line for them. I propose one free note line at the end of the unit. The reader already skips such lines after `- Depends on:`, so the format does not change and the coordinator does not need to agree. Each command keeps at most one note per unit, replaces it at its next run, and writes under the same lock as `cstack helper start`. The plan file then stays changed, so it needs its own documentation commit before `cstack publish`.

**Which unnamed cases that pass in the red run get a warning.** Read literally, AC4 warns about every old case of an existing test file: more than 60 lines at each red run of `unit-red-green.test.ts`. I propose to warn only about a case whose title does not appear in the test file at HEAD. This narrows an acceptance criterion, so you decide. A title built at run time, as with `test.each`, can still give a false warning.

**A report that the settings declare but the run does not give.** I propose to fall back to the whole-file check, print the reason, and record it in the saved run and in the note. A refusal would stop the implementer on a settings problem it cannot fix in its branch. The cost is that the guard is off for that unit, and only the note shows it.

**I will do this unless you say no.**

- The tests that start a child process stay without a report, which answers the question from the ticket that added the report (#99).
- A skipped case is refused in both runs, and the message says that it never ran, often because a `beforeAll` hook failed.
- Case names are printed whole and escaped. `quote()` cuts at 60 characters, so two vitest names of one describe block would print the same.
- In the green run, each named case must also be among the failures saved in `red.json`. Otherwise a case added to the plan after the red run is never seen failing.
- `red.json` and `green.json` get optional fields: how the cases were checked, the reason of a fallback, and each case with its name and outcome. They never hold the failure message, which carries absolute paths.

**I checked it myself.**

- With vitest 5.1, a failing `beforeAll` marks its cases as skipped and adds one failing case named after the describe block.
- A test file whose import fails gives one failing case named after the file, so the named cases are missing and the unit is refused.

**A question for someone else, which can wait.**

For the coordinator of the wave: "US-6 AC5 says that the audit reports the fallback to the whole-file check. No ticket of milestone R3 changes `cstack audit` for it. Which ticket should add it?"

**Good to know.**

- In a child worktree, `cstack unit collect` discards a note written into that worktree's copy of the plan. Milestone R2 removes that mode, so this ticket does not handle it.

#### Details

Where the warning and the fallback go is the draft blocking question 2. It is blocking, because the place decides whether AC4 and AC5 are met, and no test can answer it: the user decides. I keep the draft recommendation, a free note line after the unit lines. `readUnit()` skips any line that is not a unit line once `- Depends on:` is read (`cstack/src/plan/read.ts`, line 391). `setUnitWorktree()` inserts `- Worktree:` after the last unit line (`cstack/src/plan/unit-line.ts`, lines 24 to 39), so it lands before the note, and a later `- Blocked:` line still reads, because a unit line with a later place in the fixed order is accepted after free notes. The note line must start with a fixed prefix, such as `Case check (cstack unit red):`, so that it never starts with `#` or with `- ` and a unit label. Each name from the report is escaped with `JSON.stringify`, so the note stays on one line. The command writes the plan file with `writeFileAtomic()` inside `withCommitLock()` on `plan-file.lock` in the worktree git folder, as `cstack helper start` does (`cstack/src/helper/start.ts`, lines 322 to 326). Without the lock, a note and a `- Worktree:` line written at the same moment lose one of the two. `cstack publish` refuses tracked files with uncommitted changes (`cstack/src/commands/publish.ts`, lines 91 to 101), so the plan file needs a documentation commit, as the other plan changes of a run already do. I rejected a new unit line, because it changes the format of ADR-RQG-B and the brief asks to put any format change to the coordinator first. I rejected a section outside the units, because an implementer reads its unit, not that section. Child worktrees are a known gap. `cstack unit collect` restores the plan file of a child worktree with `git checkout --` before it removes it (`cstack/src/unit/collect.ts`, lines 292 to 297), so a note written there is lost. `ticketWorktreeProblems()` refuses to start a child worktree while the plan file differs from its committed version outside the `- Worktree:` lines (`cstack/src/helper/child.ts`, lines 23 to 40), so an uncommitted note blocks the next child start. The specification says that milestone R2 removes `cstack/src/helper/` and `cstack/src/unit/collect.ts` (`docs/projects/refocus-and-quality-guards.md`, line 256), and that parallel units in child worktrees were refused (line 304). So this ticket does not handle them. The saved run lives in the shared git folder (`runFolder()` in `cstack/src/run-state.ts`, lines 95 to 97), so the record survives in every mode. If nobody decides, the plan waits, because the question is blocking.

Which unnamed passing cases get a warning is the draft blocking question 3. It is blocking, because the recommendation narrows AC4, and only the user can accept that. I keep the draft recommendation: warn only about a passing unnamed case whose test title, the part of the name after the last ` > `, does not appear in the test file at HEAD, and warn about all of them when the file is new. Two limits remain. A title built at run time, such as a `test.each` title with `%s` or a template literal, never appears in the file as written, so it gives a warning at each red run. A title that holds ` > ` itself is cut at the wrong place. I would also keep the note short, with at most ten names and the count of the others, so that one red run cannot add dozens of lines. The literal reading of AC4 was rejected, because a warning on every old case is noise that people learn to skip.

A declared report that the run does not give is the draft blocking question 4. It is blocking and needs the user. I keep the draft recommendation, the fallback with a printed reason, recorded in the saved run and in the note, in both commands. A timeout never reaches this check, because both commands exit with 5 on a timeout before they look at the report (`cstack/src/commands/unit-red.ts`, lines 40 to 43, and `cstack/src/commands/unit-green.ts`, lines 89 to 94). The settings reader already requires `{report}` exactly once in `testCommands.file` when `report` is `junit` (`cstack/src/settings.ts`, lines 271 to 288). So a missing report usually means that the test tool was not told to write one, for example a vitest command without `--reporter=junit --outputFile`. Every unit of the ticket then falls back, so the warning should name `testCommands.file` as the place to check. A refusal was rejected, because the implementer cannot change `.cstack/settings.json` in its branch.

The child-process tests are the draft blocking question 1. I label it non-blocking, because the answer changes only how the tests are written, not what the ticket builds. The draft checked it, and its evidence is item 1 of "Open questions and answers". I agree with keeping those tests without a report. The new per-case tests call `unitRed()` and `unitGreen()` inside the vitest process, so they need no child process.

A skipped case is refused in both runs, as the assumption about outcomes in `## Decisions` says. This is non-blocking, because it follows the ticket, which counts only `failed` and `error` as a failure. I checked what makes a case skipped with vitest 5.1.0, the version installed in `cstack/node_modules`, in a throwaway folder outside the repository. A describe block whose `beforeAll` throws gives its two cases `<skipped/>`, plus one extra `<testcase>` named after the describe block, with a `<failure>`. The reporter writes `<skipped/>` for the modes skip and todo, and `<failure>` for a failed case, and never `<error>` (`writeTasks()` of `JUnitReporter` in `cstack/node_modules/vitest/dist/chunks/cli-api.COfZo8lK.js`). So an implementer who loads the new module in a `beforeAll` hook gets refused for skipped cases. That outcome is right, because the case never ran its own check, but the message must say why. The plan should give its exact words, as the decision about messages asks.

Case names are printed whole. `quote()` cuts its result at 60 characters (`cstack/src/settings.ts`, lines 100 to 104). The vitest names of this repository share long prefixes, such as `cstack unit red > refuses a unit when`, so two refused cases could print the same text. A small helper in `cstack/src/unit-test-command.ts` escapes the same way without the cut. `cstack/src/settings.ts` is not a file of this ticket, so the helper does not go there. This is non-blocking.

The green run also compares the named cases with the saved red run. Today it compares only the command and the test file with `red.json` (`cstack/src/commands/unit-green.ts`, lines 30 to 36). When `red.json` holds per-case results, each named case must be among its cases with the outcome `failed` or `error`. Otherwise `cstack unit green` deletes any earlier passing run, refuses the unit, and prints the restart text. When `red.json` has no per-case results, because it is older or used the fallback, the comparison is skipped. This adds a refusal that the ticket does not list. It is non-blocking, and the developer accepts it by not objecting.

The saved runs get optional fields on `SavedUnitRun` (`cstack/src/unit-test-runs.ts`, lines 6 to 13). The proposed fields are a check mode, per case or whole file, a fallback reason, and a list of the report cases with `name`, `classname` and `outcome`. `readSavedRun()` checks only that `time` is a valid date (`cstack/src/saved-runs.ts`, line 25), so older readers keep working. The list holds every case of the report, because #101 reads the result of each case. It never holds a failure message, because vitest puts absolute paths in it, as the check above showed. This is non-blocking.

The audit question comes from draft item 5. It is non-blocking, because this ticket records the fallback either way. It goes to the coordinator of the wave, in English, word for word: "US-6 AC5 says that the audit reports the fallback to the whole-file check. No ticket of milestone R3 changes `cstack audit` for it. Which ticket should add it?"

The pytest point of draft item 6 stays a known limit. A broken pytest fixture gives `error`, and the ticket counts `error` as a failure in the red run, so a case can fail first for the wrong reason. The ticket fixed this rule, so this ticket follows it.

I checked security and authorization, data model lock-in, scale, failure modes and rollback, operations and cost, and reversibility beyond the points above, and found nothing more. The change adds no dependency, no recurring cost and no credential, and the new JSON fields are optional and easy to remove.

### Open questions and answers

1. Blocking question 1, the child-process tests and the per-case report. Recommended answer: keep the child-process tests without a report, and change nothing in how they load the source. I checked it. With the loader hook of `cstack/test/unit-red-green.test.ts` (lines 289 to 300), a child that imports `cstack/src/test-run.ts` and asks for a report gets `{"cases":[{"name":"a > b","outcome":"failed"}]}`. Without a hook, the same child fails with `ERR_MODULE_NOT_FOUND`. The two child-process tests of `cstack/test/test-run.test.ts` (lines 140 to 160) use no hook and ask for no report. `cstack/src/commands/unit-red.ts` already imports other modules with `.js` paths (lines 1 to 6), so a child on it needs the hook anyway. The new per-case tests run inside the vitest process, so no child needs a report.
2. Blocking question 2, where cstack writes the warning and the fallback. Recommended answer: one free note line at the end of the unit. The reader skips any line after `- Depends on:` that is not a unit line (`cstack/src/plan/read.ts`, line 391), so the plan format does not change. Each command keeps at most one note in each unit, and its next accepted run replaces or removes it. cstack writes the plan file with `writeFileAtomic()`, as `cstack helper start` writes the `- Worktree:` line (`cstack/src/helper/start.ts`, lines 325 to 327), and it does not commit it. The other options are a new optional unit line, such as `- Case check:`, which changes the plan format and needs the coordinator, or a section outside the units, which the implementers do not read with the unit. The coordinator of the wave answered on 2026-11-24 through `orca orchestration`. The coordinator accepts the free note as no change of the plan format, and would not choose a new `- Case check:` line. A parsed unit line is only needed when a command must read the fact back from the plan, and the audit should read the fallback from `red.json` or `green.json`. So the note is for people, no command parses it, and it has one fixed sentence form that the tests can check word for word. If the user prefers the new unit line, the coordinator must hear it before the plan.
3. Blocking question 3, which passing unnamed cases get a warning. Recommended answer: warn only about a passing unnamed case whose test title does not appear in the version of the test file at HEAD. The test title is the part of the name after the last ` > `. When the test file does not exist at HEAD, every passing unnamed case gets a warning. This misses a new case whose title is already written somewhere in the old file. The literal reading warns about every old case of an existing test file at each red run, so the warning would be noise.
4. Blocking question 4, a report that the settings declare but the run does not give. Recommended answer: fall back to the check of the whole test file, print a warning with the reason, and record the fallback and its reason in the saved run and in the note of the unit. The goal of the ticket says "when a per-case report is available". A refusal would stop an implementer on a problem of the settings, which it cannot fix in its branch. The cost is that the guard is off for that unit, and only the note and the saved run show it. I checked what vitest writes for a test file that cannot import its module: the report holds one failing case named after the file, so the named cases are missing and the unit is refused, which is the wanted result.
5. Blocking question 5, the audit reports the fallback. This started as a question for the coordinator of the wave. The coordinator answered on 2026-11-24 through `orca orchestration`: this ticket should add it as a unit of its own, if the user agrees. The audit already reads `units/<n>/red.json` and `green.json` (`cstack/src/audit/evaluate.ts`, line 202), and no other ticket of the wave changes `cstack/src/audit/` now. If the user prefers another ticket, the coordinator proposes a new ticket. Recommended answer: add the unit. The audit prints one more line on standard output for each unit whose saved red or green run used the check of the whole test file, with the unit and the reason. That line does not change the exit code. A repository without a per-case report, such as this one, would otherwise make every correct run exit with 1, because the audit exits with 1 as soon as a line is not done (`cstack/src/commands/audit.ts`, line 150).
6. Non-blocking. A comment from #99 says that pytest gives `error`, not `failed`, for a broken fixture. The ticket counts `error` as a failure in the red run, so a case can fail first for the wrong reason. The ticket fixed this rule, so this ticket follows it. Open, not needed for this ticket.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
