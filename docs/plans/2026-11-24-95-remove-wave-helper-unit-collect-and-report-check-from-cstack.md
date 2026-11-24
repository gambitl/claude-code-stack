# Plan: #95 — R2-2: Remove wave, helper, unit collect and report check from cstack

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/95
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/remove-old-commands
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T09:30:54+01:00
Ready for review at: not yet

## Ticket

### Why this matters (plain language)

**In plain terms:** Delete from `cstack` the six commands that start, wait for or collect agents and tickets, because Orca and Claude Code already do that work.

- **What the title means**: `cstack wave` started a whole wave of tickets, each in its own workspace. `cstack helper start`, `wait` and `done` started helpers as Orca workers and waited for their reports. `cstack unit collect` brought work back from child worktrees. `cstack report check` showed reports like a mailbox. Orca is the desktop app that runs several coding agents side by side.
- **Why we are doing it**: The maintainer set a rule on 2026-11-23: everything that Orca already does leaves `cstack`. The only purpose of `cstack` is to turn the steps of `resolve-issue` into commands. These six commands do orchestration, which belongs to Orca.
- **For the user**: `cstack` becomes smaller and easier to understand. Nothing in a run depends on these commands any more, because #93 already changed the guides.

**Goal.** This ticket removes `cstack wave`, `cstack helper start`, `cstack helper wait`, `cstack helper done`, `cstack unit collect` and `cstack report check`, with their code, their tests and their documentation.

### Where things are today (read first)

* **The commands**: in `cstack/src/commands/`, the files are `wave.ts`, `helper-start.ts`, `helper-wait.ts`, `helper-done.ts`, `unit-collect.ts` and `report-check.ts`. Their entries in `cstack/src/manifest.ts` start at lines 291, 241, 258, 267, 276 and 126.
* **Their modules**: `cstack/src/helper/` (6 files), `cstack/src/wave/` (13 files) and `cstack/src/unit/collect.ts`.
* **Their tests**: `cstack/test/helper/`, `cstack/test/wave/`, `cstack/test/unit/collect*.test.ts`, `cstack/test/helpers/watch.ts`, the `build-helpers`, `executor-launch` and `build-start` tests in `cstack/test/guides/`, and `cstack/test/e2e/orca.test.ts`. `cstack/test/report.test.ts` (line 242) covers `report submit` and `report check` together. `cstack/test/cli.test.ts`, `next.test.ts` and `prompts.test.ts` also mention them.
* **Code that other modules still need**: `cstack/src/commands/measure.ts` (lines 7 and 48) imports `parseWorktreeList()` from `cstack/src/wave/worktrees.ts` (line 27). `cstack/src/commands/errors.ts` (lines 3 and 12) imports `HelperError` from `cstack/src/helper/record.ts`. Move both before you delete the folders.
* **The dispatcher**: `cstack/src/cli.ts` imports and dispatches the six commands (lines 5 to 7, 14, 21, 27, 69, 73, 75 to 79 and 95).
* **The reports**: `cstack/src/report/reports.ts` → `takeOldestUnreadReport()` (line 260) serves only `report check`. `saveUnitReport()`, `latestUnitReport()` and `latestStuckReportPath()` become unused, and so does the implementer refusal at line 115. `report submit` and its refusal of a "done" report at line 86 stay.
* **The Orca layer**: `cstack/src/orca/answer.ts` serves only the removed commands. In `cstack/src/orca/features.ts`, `WORKER_COMMANDS` (lines 20 to 25), `CHILD_WORKTREE_COMMANDS` (line 26), `TICKET_WORKTREE_COMMANDS` (line 27) and the feature names at lines 7 to 9 serve only them. `cstack/src/doctor/orca.ts` (lines 16 to 18) reports those three features. In `cstack/src/orca/shapes.ts`, the entries at lines 58 to 70 and 78 serve only them. `run.ts`, `call.ts`, `shapes.ts`, `version.ts` and the Jira and Linear parts of `features.ts` stay, because `cstack tracker` and `cstack doctor` use them.
* **`cstack unit order`**: `cstack/src/manifest.ts` (line 136) says "Print the units in batches that can run in parallel." `README.md` (line 64) says that the units of a batch "can run at the same time".
* **The README**: `README.md` "## Commands" starts at line 47, and line 49 says "twenty-three commands". Line 59 describes `report check`, lines 60 to 63 the `helper` commands and `CSTACK_ORCA_WORKERS`, line 68 `unit collect` and lines 71 and 72 `wave`.
* **The count**: `cstack/test/manifest.test.ts` (line 155) asserts the number of built commands.

### Scope

1. Move `parseWorktreeList()` next to `cstack measure`, with its tests. Move `HelperError`, or replace it, so that `errors.ts` no longer imports from `helper/`.
2. Remove the six commands: their files, their modules, their manifest entries, their handlers in `cli.ts` and their tests.
3. Remove the report functions that only the removed commands used. Keep `report submit` and its checks of the executor.
4. Remove from `cstack/src/orca/` and from `cstack doctor` what only served the removed commands. Keep what `cstack tracker` and `cstack doctor` need. The recorded Orca answers that the tests use must still load.
5. Change the summary of `cstack unit order` to "Print the units in the order they run", and fix line 64 of the README.
6. In the README, remove the sections of the six commands and `CSTACK_ORCA_WORKERS`, and fix the number of commands. Add a short paragraph that says what left and what to use instead: Orca's orchestration for waves, and Claude Code sub-agents for helpers.
7. Update the count of built commands in `cstack/test/manifest.test.ts`. It drops by six.

### Acceptance (TDD)

* `cstack/test/cli.test.ts`: write first a case for each removed command, which now gets the answer of an unknown command. See it fail, then make it pass.
* `cstack/test/manifest.test.ts` passes with six fewer built commands.
* The tests of `cstack measure`, including `cstack/test/measure-worktrees.test.ts`, still pass after the move.
* `cstack/test/report.test.ts`: `report submit` still refuses a "done" report while a unit has no commit.
* The tests of `cstack doctor` pass, and it no longer reports the worker, child worktree and ticket worktree features.
* `cstack/test/pack.test.ts` passes.
* Negative: no file in `cstack/src/` imports from `helper/`, `wave/` or `unit/collect`.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #93 · Feeds: #97, #104


### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

The ADRs that this block names now all exist:

- [ADR-RQG-A: helpers and units inside a ticket](../decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md), which #93 wrote. It replaces [ADR-SIC-A: helpers](../decisions/ADR-SIC-A-helpers.md).
- [ADR-RQG-B: plan format version 2](../decisions/ADR-RQG-B-plan-format-version-2.md), which #98 wrote.
- [ADR-RQG-C: expected steps of a run](../decisions/ADR-RQG-C-expected-steps-of-a-run.md), which #86 wrote.

**Rules of the specification for every story** (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story"). No story adds a `cstack` command that starts an agent, waits for it, sends it a message, or watches the tracker. Inside a ticket, Claude Code starts its helpers as sub-agents, as the skill guides it. When the settings file of the repository names another agent than Claude for the independent review, that helper runs as an Orca worker, because only Orca can start another agent. The units of a ticket run one after the other, and each unit runs in a sub-agent, in the workspace of the ticket. Every `cstack` command works without Orca. A change to a phase guide also updates the block of mandatory steps of that guide.

**The story that this ticket carries in part.** The specification lists it in section 4, under "US-3: Remove the orchestration layer from cstack". This ticket carries the part about the code. #93 carried the guides and the prompts, and #97 carries the `setupCommand` setting.

- AC1: `cstack wave`, `cstack helper start`, `cstack helper wait`, `cstack helper done`, `cstack unit collect` and `cstack report check` leave the manifest, the code and the tests.
- AC4: `cstack unit order` prints the order of the units. It no longer speaks of batches that can run in parallel.
- AC5: `cstack report submit` stays. The executor runs it before it returns, and it still refuses a "done" report while a unit has no commit.
- AC8: The README and the release notes list what left, and they say what to use instead. #104 writes the release notes.

## Dependencies

clear. The only blocker, #93, is closed and merged into `main`.

## Code mapping

The map below was made on 2026-11-24 from `main` at eff2cff. Line numbers are those of that commit. Some line numbers of the ticket moved since it was written, and the map gives the current ones.

**What leaves, as whole files.** About 2,450 lines of source leave with the six commands.

- The command files `cstack/src/commands/wave.ts`, `helper-start.ts`, `helper-wait.ts`, `helper-done.ts`, `unit-collect.ts` and `report-check.ts`.
- The folders `cstack/src/helper/` (6 files), `cstack/src/wave/` (13 files) and `cstack/src/unit/` (only `collect.ts`).
- `cstack/src/orca/answer.ts`. Its only export, `parseAnswer()`, is used only inside `helper/`, `wave/` and `unit/`.
- The test folders `cstack/test/helper/` (10 files), `cstack/test/wave/` (17 files) and `cstack/test/unit/` (3 files).
- The test helpers `cstack/test/helpers/wave.ts` and `cstack/test/helpers/watch.ts`. Only the removed tests import them. `watch.ts` imports `WatchDeps` from `src/wave/watch.ts` (line 3).
- The end-to-end tests `cstack/test/e2e/orca.test.ts` and `cstack/test/e2e/no-orca.test.ts`, their shared helper `cstack/test/e2e/chain.ts`, the fake programs `cstack/test/e2e/bin/orca` and `cstack/test/e2e/bin/gh`, and the fixture folder `cstack/test/fixtures/e2e-orca/`. Only `chain.ts` reads `e2e/bin/` and `fixtures/e2e-orca/` (`chain.ts`, lines 2 and 14). `cstack/test/e2e/resolve-issue.test.ts` keeps `cstack/test/fixtures/e2e/`, which `chain.ts` also reads (line 15).

**Code that kept modules still take from the removed folders.** A search of `cstack/src/` outside the removed files finds exactly two imports.

- `cstack/src/measure/moments.ts` (line 7) imports `parseWorktreeList()` from `cstack/src/wave/worktrees.ts` (line 27). `worktreeFolders()` (`moments.ts`, line 118) calls it. The ticket says `cstack/src/commands/measure.ts`, but the import moved to `moments.ts` since then. The only test of `parseWorktreeList()` is the case "parses blocks" of `cstack/test/wave/worktree-check.test.ts` (lines 18 to 25). `cstack/test/measure-worktrees.test.ts` runs `cstack measure` through `run()` and never imports the function.
- `cstack/src/commands/errors.ts` (line 3) imports `HelperError` from `cstack/src/helper/record.ts` (line 32). `failWith()` tests it at line 12. Only files under `helper/` throw `HelperError`, so once they leave, `failWith()` never sees one. `failWith()` serves `next.ts`, `plan-section.ts`, `plan-status.ts`, `publish.ts`, `report-submit.ts`, `unit-red.ts`, `unit-green.ts` and `cstack/src/unit-test-command.ts`. Three of these are files of #100, and none of them imports a removed module.

**A module that becomes dead.** `cstack/src/plan/unit-line.ts` writes and removes `- Worktree:` lines in a plan file. Only `cstack/src/helper/start.ts` (line 18) and `cstack/src/helper/child.ts` (line 5) import it, and its test is `cstack/test/plan/unit-line.test.ts`. The plan reader still accepts a `- Worktree:` line (`cstack/src/plan/read.ts`, lines 342, 346 and 479 to 487), and `cstack measure` still reads the paths of those lines (`moments.ts`, line 29). Those two stay, because the plan format does not change.

**The dispatcher.** `cstack/src/cli.ts` imports the six command functions at lines 5 to 7, 15, 22 and 28. It dispatches `wave` at line 71, `report check` at line 75, the group `helper` at lines 77 to 82 and `unit collect` at line 97. After the change, `cstack wave` and `cstack helper ...` fall to `fail(io, \`unknown command "<word>"\`)` in `run()`, which prints `cstack: unknown command "<word>"` and the usage and returns 2. `cstack unit collect` and `cstack report check` keep a known first word, so `dispatchSubcommand()` answers `cstack: usage: cstack unit <order|commit|red|green>` or `cstack: usage: cstack report <submit>` and returns 2. The usage text of `cstack` is built from the built entries of the manifest (`cli.ts`, lines 33 to 48), so it drops the six lines by itself.

**The manifest.** `cstack/src/manifest.ts` holds the entries of `report check` (lines 140 to 147), `helper start` (lines 255 to 271), `helper wait` (lines 272 to 280), `helper done` (lines 281 to 289), `unit collect` (lines 290 to 304) and `wave` (lines 305 to 313). The summary of `unit order` is at line 151. `cstack/test/manifest.test.ts` names the removed commands in five places. These are the case "reads the command words of a usage line that has a group in parentheses" (line 111, which uses the `wave` entry), two cases about unbuilt flags (lines 143, 144 and 148 to 151), the count of twenty-four built commands (line 156) and the case "gives --plan to the new commands that work on a run" (line 173). After the change, eighteen commands are built.

**The reports.** In `cstack/src/report/reports.ts`, `saveUnitReport()` (line 193), `latestUnitReport()` (line 225), `latestStuckReportPath()` (line 233) and `takeOldestUnreadReport()` (line 260) are used only by the removed files. So are the type `UnitReport` (line 182) and the private helpers `unitReportsFolder`, `readUnitReports()` and `byTime`. `report submit` checks only the role `executor` (`report-submit.ts`, line 65). So the implementer part of `checkReport()`, `checkImplementer()` (lines 107 to 131), and the kinds `IMPLEMENTER_KINDS` (line 13) become unused too. `saveReport()`, `checkReport()` for the executor, `readReports()` and `lastAcceptedDoneReportAt()` stay. `phases.ts` and `run-progress.ts` use `lastAcceptedDoneReportAt()`. The refusal of a "done" report while a unit has no commit is `buildDone()`, called at line 86. `cstack/test/report.test.ts` tests the removed functions in "checkReport, implementer" (line 159) and "saving and reading reports" (lines 186 to 230), and `report check` in "cstack report submit and report check" (line 242, with cases at lines 303 and 317). The field `readAt` of `SavedReport` (`cstack/src/run-state.ts`, line 48) is written only by `takeOldestUnreadReport()`.

**The Orca layer.** In `cstack/src/orca/features.ts`, the feature names `workers`, `child-worktrees` and `ticket-worktrees` (lines 7 to 9), `WORKER_COMMANDS` (lines 20 to 25), `CHILD_WORKTREE_COMMANDS` (line 26), `TICKET_WORKTREE_COMMANDS` (line 27) and their three detectors (lines 128 to 130) serve only the removed commands. `cstack/src/tracker/open.ts` (line 95) asks only for `jira` and `linear`. `cstack/src/doctor/orca.ts` prints the three labels at lines 16 to 18. In `cstack/src/orca/shapes.ts`, the shapes of `orca orchestration worker-start`, `worker-show`, `send` and `check` (lines 58 to 69), `orca reference find` (line 70) and `orca worktree create` (line 78) serve only the removed commands. `run.ts`, `call.ts`, `version.ts`, `record.ts`, the rest of `shapes.ts` and the Jira and Linear parts of `features.ts` stay. `cstack tracker`, `cstack doctor` and `npm run record:orca` use them. `record.ts` records only `status`, `agent-context`, `jira connection` and `linear team list` (lines 121 to 125).

**The recorded Orca answers.** The case "accepts every recorded JSON file" of `cstack/test/orca/shapes.test.ts` (line 38) checks every JSON file of `cstack/test/fixtures/orca/1.4.263/` against a shape, and `commandOfFixture()` throws for a file with no shape (`shapes.ts`, line 122). So each removed shape takes its fixture files with it. These are the fourteen `orchestration-*.json` files, the three `reference-find.*.json` files and `worktree-create.started.json`. Only removed tests and `shapes.test.ts` read them. The case "checks the answers of orca reference find and orca worktree create" (`shapes.test.ts`, line 46) leaves too. `cstack/test/fixtures/orca/README.md` describes those files in two sections. `cstack/test/orca/features.test.ts` names the three features (line 33) and uses `workers` in four cases (lines 55 to 71, 96 to 103 and 105 onwards). `cstack/test/doctor-orca.test.ts` expects the three lines (lines 82 to 84).

**`cstack unit order`.** Its manifest summary is at `manifest.ts`, line 151. Its output still prints batches (`cstack/src/commands/unit-order.ts`, line 17), and a unit that shares a file with an earlier unit of a batch goes to the next batch (`cstack/src/plan/order.ts`, lines 80 to 86). The build guide reads that output as "the units of batch 1 from left to right, then those of batch 2" (`cstack/guides/resolve-issue/build.md`, line 32). So only the summary and the README paragraph change, not the output.

**The message after `--done publish`.** `cstack/src/commands/next.ts`, line 181, prints "The run is finished. Submit your published report with cstack helper done published --helper <helper id>." `cstack/test/next.test.ts` checks it word for word at line 297. The publish guide now says `cstack report submit published --plan <plan file>` (`cstack/guides/resolve-issue/publish.md`, lines 4 and 27). #102 changes the check of the plan phase in the same file, around `missingToStart()` (line 185).

**Other mentions of the removed commands in kept files.**

- `cstack/test/e2e/resolve-issue.test.ts` still turns `unit collect` and `helper start` calls into placeholders in `written()` (lines 78 and 80), and it sets `CSTACK_ORCA_WORKERS: "off"` with a comment that names `cstack helper start` (lines 231 and 232). No guide names those commands now, so those lines never run.
- `cstack/src/audit/main-session.ts` (line 7) matches the call `helper start executor` to find a second session file of the main conversation. The ticket comment says no run writes it any more. But `cstack audit` still reads the sessions of runs made with 0.3.x, such as this run, and those sessions hold that call. The audit folder belongs to #100 in this wave. The `README.md` paragraph of `cstack audit` (line 54) names `cstack helper start executor` for the same reason.
- `cstack/test/prompts.test.ts` (lines 60 to 105) checks that the agent prompts never name `cstack helper`. These checks stay true.
- `cstack/src/tracker/ready.ts` (line 11) still takes a `hasWorktree` argument, which `cstack wave` used. `cstack tracker list` always passes `false` (`tracker-list.ts`, line 48).
- The settings key `watchIntervalMinutes` (`cstack/src/settings.ts`, lines 45, 67 and 313 to 316) serves only `cstack wave --watch`. The settings template `cstack/skills/resolve-issue/templates/settings.json` (line 7) holds it, and `cstack next` prints it above each guide. `cstack` refuses a settings file with an unknown key, so removing it would break a settings file that holds it.
- The plan template `cstack/skills/resolve-issue/templates/plan.md` (line 71) says that cstack writes the `- Worktree:` line "when a unit runs in a child worktree".

**The README.** In `README.md`, "## Commands" starts at line 47. Line 49 says "twenty-four commands", not twenty-three as the ticket says. Line 60 describes `report check`, lines 61 to 63 the `helper` commands, line 64 `CSTACK_ORCA_WORKERS`, line 66 `unit order`, line 69 `unit collect` and lines 72 and 73 `wave`. Line 59 describes `report submit` as reading "a helper's report", which stays. The "Measure a run" section (line 117) still describes the `- Worktree:` lines of older plans, which `cstack measure` still reads. No test reads the list of commands in the README.

**Tests that check every command.** `cstack/test/cli.test.ts` (line 227) and `cstack/test/manifest-implemented.test.ts` (line 34) run each built command with an unknown flag, so they shrink by themselves. `cstack/test/cli.test.ts` already has the cases "names an unknown command, prints the usage and returns 2" (line 43) and "sends cstack tracker and an unknown tracker word to the tracker usage, not to a refusal" (line 158), which show the two answers above. Its comment at line 140 says "since cstack wave is built", which stops being the reason. `cstack/test/pack.test.ts` names no removed file.

**Governing decisions.** ADR-RQG-A (`docs/decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md`) says that "Ticket #95 removes the old commands that started and waited for helpers", that no child worktree and no collect step remain, and that the executor reports with `cstack report submit`. ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 69) still describes the `cstack helper start` commands as standing in until milestone R2. The `WHY:` comment of `errors.ts` (line 1) speaks of "the four plan and report commands", and the one of `reports.ts` (line 1) is about the done check of the executor, which stays. `cstack/src/measure/moments.ts` (line 61) names ADR-SIC-B for version 1 plans. No `DECISION:` comment exists in these files.

**Risks.**

- `cstack/src/manifest.ts`, `cstack/src/cli.ts` and `README.md` change in almost every ticket. #100 and #102 run at the same time and change the entries and paragraphs of `unit red`, `unit green` and `next` in the same two files. A textual conflict is likely when `main` moves.
- The removal touches about 75 files. A forgotten import makes `npm run typecheck` fail, which is the main safety net.
- `cstack/test/report.test.ts` builds its git repositories once and copies them, as the conventions file says. A removed case must not take a shared setup with it that a kept case needs.

## Decisions

- This branch removes `cstack wave`, `cstack helper start`, `cstack helper wait`, `cstack helper done`, `cstack unit collect` and `cstack report check` from the source only. This run still uses the installed `cstack` 0.3.2, which keeps them, so the run goes on using `cstack helper start` and `cstack helper wait` as the rules below say. To try the code of this branch, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-24, from the brief of the run)
- This ticket works only in the six command files and their modules, their tests, `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/src/report/`, `cstack/src/orca/`, `cstack/src/doctor/`, the move of `parseWorktreeList()` next to `cstack measure`, `cstack/src/commands/errors.ts`, the message after `--done publish` in `cstack/src/commands/next.ts`, and the sections of those commands in `README.md`. In `cstack/src/manifest.ts` and `README.md`, change only the entries and the paragraphs of the commands that this ticket names. (2026-11-24, from the brief of the run)
- Three other tickets of epic #84 run at the same time, each in its own worktree. #96 works in the guides `questions.md`, `plan.md` and `publish.md` of `cstack/guides/resolve-issue/` and in their guide tests. #100 works in `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/saved-runs.ts`, `cstack/src/audit/` for one unit, their tests and their paragraphs of `README.md`. #102 works in `cstack/src/phases.ts`, the check of the plan phase in `cstack/src/commands/next.ts`, their tests and the paragraph of `cstack next` in `README.md`. (2026-11-24, from the brief of the run)
- In `cstack/src/commands/next.ts`, this ticket changes only the message after `--done publish` and its test, because #102 changes the check of the plan phase in the same file. (2026-11-24, from the brief of the run)
- When this ticket needs a file of another ticket of this wave, the main conversation asks the coordinator before anyone changes it. This covers any file of #100 or #102 that imports one of the removed modules. (2026-11-24, from the brief of the run)
- Do not write a changelog entry, because #104 writes the release notes. The new paragraph of `README.md` that says what left and what replaces it is enough. (2026-11-24, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and add no runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- Do not change the plan format, which #98 defined as version 2 in ADR-RQG-B. When the plan needs a new line or a new section, put it to the user as a blocking question, and ask the coordinator before you plan it. This plan file stays in format `cstack-plan/1`, because the installed `cstack` 0.3.2 writes and reads it. Any plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `cstack/test/guides/helpers-are-sub-agents.test.ts` reads every guide, skill and agent prompt. It refuses a sentence that tells Claude to start an Orca worker, except in `independent-review.md`. Text that describes an Orca worker without telling Claude to start one passes. (2026-11-24, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `cstack/skills/resolve-issue/SKILL.md` have almost no margin left in `cstack/test/skill-size.test.ts`. If a sentence is added to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-24, from the brief of the run)
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
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. The installed `cstack` 0.3.2 does not check it in `cstack publish`. (2026-11-24, from the retrospective of #89)
- A deliberate break of the code can make a test loop forever. Run each break with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`. If a vitest process of this worktree still runs after that, stop it. Never stop a process of another worktree. (2026-11-24, from the run of #99)
- When the plan asks a test to check a message, the plan gives the exact words of that message. Otherwise the implementer chooses its own words. (2026-11-24, from the runs of #91, #99 and #114)
- A question for the user reaches a ticket only after the user saw it, word for word, in the chat of the main conversation. (2026-11-24, from the run of #99)
- If a result of a sub-agent reaches the main conversation instead of the executor that started it, the main conversation sends it to the executor in a message. (2026-11-24, from the run of #91)
- Four runs share this machine. If the full `npm test` fails on a 5-second timeout, run the failing test file alone before you conclude that the code is wrong. (2026-11-24, from the runs of #91, #99 and #114, and the conventions file)
- A line of `## Decisions` that says how a function behaves needs a test case of its own too, not only a line that says what it must not do. (2026-11-24, from the run of #118)
- When a unit has several refusals, the implementer breaks each refusal on its own, one at a time, and sees its own test fail. (2026-11-24, from the run of #98)
- A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the runs of #98 and #118)
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the brief of the run)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-24, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-24, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-24, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. Never read the private work data of the comparison runs or their session files. (2026-11-24, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-24, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-24, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-24, from the brief of the run)
- Never change `.cstack/settings.json` in this branch. The independent review refuses a branch that changes it. (2026-11-24, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-24, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-24, from the brief of the run and the conventions file)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and nobody prints the private list. (2026-11-24, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep every change of both sides, and push with a plain `git push`, without force. (2026-11-24, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-24, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-24, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-24, from the brief of the run)
- Delete `cstack/test/e2e/orca.test.ts`. Keep `cstack/test/e2e/no-orca.test.ts` with only its tracker cases: "reads, comments and moves the ticket through the fake gh" in each Orca state (line 90) and "the tracker commands with no gh on the PATH" (lines 104 to 125). They are the only end-to-end proof that every command works without Orca. Its cases about `cstack wave`, the helpers and `cstack unit collect` (lines 36 to 88) leave. Keep `cstack/test/e2e/chain.ts`, `cstack/test/e2e/bin/gh`, `cstack/test/e2e/bin/orca` and `cstack/test/fixtures/e2e-orca/plan.md`, cut down to what the kept cases use. (2026-11-24, from the user's answer in the question round, which changes the comment of the #93 run on the ticket)
- Keep the three guide tests that #93 rewrote, `cstack/test/guides/build-helpers.test.ts`, `cstack/test/guides/executor-launch.test.ts` and `cstack/test/guides/build-start.test.ts`, even though the ticket lists them among the tests to remove. (2026-11-24, from the comment of the #93 run on the ticket)
- Keep `writeFileAtomic()` (`cstack/src/run-state.ts`, line 105) and `withCommitLock()` (`cstack/src/commit-lock.ts`, line 88) unchanged when `cstack/src/helper/` leaves. #100 will use both, with a lock file named `plan-file.lock` in the `cstack` folder of the git folder, as `cstack/src/helper/start.ts` does today (line 323), to write a note line into a unit of the plan file. (2026-11-24, from the coordinator of the wave)
- Beyond the files that the brief names, the user approved these files for this ticket on 2026-11-24: `cstack/src/plan/unit-line.ts` and its test `cstack/test/plan/unit-line.test.ts`, line 71 of `cstack/skills/resolve-issue/templates/plan.md`, the recorded Orca answers under `cstack/test/fixtures/orca/` with their `README.md`, the end-to-end files `cstack/test/e2e/orca.test.ts`, `cstack/test/e2e/no-orca.test.ts`, `cstack/test/e2e/chain.ts`, `cstack/test/e2e/bin/orca` and `cstack/test/fixtures/e2e-orca/`, and `cstack/test/e2e/resolve-issue.test.ts`. (2026-11-24, from the user's answers in the question round)
- `cstack wave` and each `cstack helper` command answer like any unknown command. Standard error starts with the line `cstack: unknown command "wave"` or `cstack: unknown command "helper"`, followed by the usage of `cstack`. Standard output stays empty, and the exit code is 2. This comes from `fail()` in `run()` of `cstack/src/cli.ts` (line 119) once the entries and handlers leave. (2026-11-24, from the user's answer in the question round)
- `cstack unit collect` and `cstack report check` answer with the usage of their group, as any unknown word of a known group does today. Standard error is exactly `cstack: usage: cstack unit <order|commit|red|green>` or `cstack: usage: cstack report <submit>`, followed by a newline. Standard output stays empty, and the exit code is 2. This comes from `dispatchSubcommand()` in `cstack/src/cli.ts` (lines 138 to 148). No new message is added. (2026-11-24, from the user's answer in the question round)
- Delete the manifest entries of the six commands. Never keep one with `built: false`, because `unbuiltRefusal()` (`cstack/src/manifest.ts`, line 372) would then answer "is not built in this version yet" with exit code 1. (2026-11-24, from the code map)
- Each new case of `cstack/test/cli.test.ts` for a removed command calls it with the unknown flag `--cstack-unknown-flag`. On today's code, the old handler then refuses before it reads a report or standard input, so the case fails first for the right reason and touches no real run folder. (2026-11-24, accepted by default in the question round)
- The message that `cstack next --done publish` prints when the run has no phase left is exactly "The run is finished. Submit your published report with cstack report submit published --plan <plan file>." followed by a newline. The text `<plan file>` is written as is, not replaced by the path. Today the message is at `cstack/src/commands/next.ts`, line 181, and its check is in `cstack/test/next.test.ts`, line 297. (2026-11-24, from the user's answer in the question round)
- The setting `watchIntervalMinutes` stays in `cstack/src/settings.ts` and in `cstack/skills/resolve-issue/templates/settings.json`. The documentation phase leaves this comment on #97, word for word: "Please remove `watchIntervalMinutes` in the same change as `setupCommand`. Only `cstack wave --watch` read it, and #95 removed that command. The key is in `cstack/src/settings.ts` and in `cstack/skills/resolve-issue/templates/settings.json`." (2026-11-24, from the user's answer in the question round)
- Delete `cstack/src/plan/unit-line.ts` and `cstack/test/plan/unit-line.test.ts`, because only `cstack/src/helper/start.ts` (line 18) and `cstack/src/helper/child.ts` (line 5) import the module. Do not change how the plan reader accepts a `- Worktree:` line (`cstack/src/plan/read.ts`, lines 342, 346 and 479 to 487), nor how `cstack measure` reads it (`cstack/src/measure/moments.ts`, line 29). `cstack/test/plan/worktree-line.test.ts` and `cstack/test/measure-worktrees.test.ts` keep covering both and stay unchanged. (2026-11-24, from the user's answer in the question round)
- Line 71 of `cstack/skills/resolve-issue/templates/plan.md` becomes exactly "- Worktree: <path, with ~/ in place of the home folder>, optional, written by older versions of cstack when a unit ran in a child worktree, never by a person". No other line of the template changes. (2026-11-24, from the user's answer in the question round and the coordinator of the wave)
- `cstack unit order` keeps its output, including the `Batch <n>:` lines and the JSON, because the build guide reads them (`cstack/guides/resolve-issue/build.md`, line 32). Only its summary in `cstack/src/manifest.ts` (line 151) becomes exactly "Print the units in the order they run.", and its README paragraph changes. (2026-11-24, from the ticket and accepted by default in the question round)
- `parseWorktreeList()` and the type `WorktreeEntry` move unchanged from `cstack/src/wave/worktrees.ts` (lines 13 to 39) into `cstack/src/measure/moments.ts`, next to `worktreeFolders()`, their only caller. The case "parses blocks" of `cstack/test/wave/worktree-check.test.ts` (lines 18 to 25) moves to `cstack/test/measure-worktrees.test.ts`. (2026-11-24, assumption not asked, shown in the question round)
- `HelperError` leaves with `cstack/src/helper/`, and `failWith()` in `cstack/src/commands/errors.ts` stops testing for it (line 12). No kept file throws it. Every other branch of `failWith()` stays as it is. (2026-11-24, assumption not asked, shown in the question round)
- In `cstack/src/report/reports.ts`, remove `saveUnitReport()`, `latestUnitReport()`, `latestStuckReportPath()`, `takeOldestUnreadReport()`, the type `UnitReport`, `unitReportsFolder`, `readUnitReports()`, `byTime`, `checkImplementer()`, `IMPLEMENTER_KINDS`, `KINDS_BY_ROLE`, the type `Role`, and the fields `role` and `unit` of `Report`. `checkReport()` then checks `EXECUTOR_KINDS` and the executor rules only. Its refusal of an unknown kind keeps its words exactly: "The kind <kind> is not allowed for the role executor. Allowed kinds: done, needs-decision, failed, published." `saveReport()`, `readReports()`, `lastAcceptedDoneReportAt()` and `checkExecutor()` stay unchanged. (2026-11-24, from the ticket and the code map)
- `cstack report submit` keeps refusing a done report while a unit has no commit. The case "names a unit without a commit, and gives both reasons when both fail" of `cstack/test/report.test.ts` (line 67) proves it and stays, apart from the removal of `role` from its report. (2026-11-24, from the ticket)
- `cstack doctor` prints, after its Orca line, only the two lines `  Jira through Orca: <state>` and `  Linear through Orca: <state>`, in that order. The type `OrcaFeatureName` in `cstack/src/orca/features.ts` becomes `"jira" | "linear"`. (2026-11-24, from the ticket)
- In `cstack/src/orca/shapes.ts`, remove the shapes of `orca orchestration worker-start --json`, `orca orchestration worker-show --full --json`, `orca orchestration send --json`, `orca orchestration check --json`, `orca reference find --json` and `orca worktree create --json`. Delete their eighteen recorded answers under `cstack/test/fixtures/orca/1.4.263/`, because the case "accepts every recorded JSON file" of `cstack/test/orca/shapes.test.ts` refuses a fixture with no shape. Every other recorded answer stays and must still load. (2026-11-24, from the ticket and the code map)
- `cstack/src/audit/main-session.ts` keeps its clue `helper start executor` (line 7), and the README paragraph of `cstack audit` keeps naming `cstack helper start executor`. `cstack audit` still reads the sessions of runs made with 0.3.x, which hold that call, and the audit folder belongs to #100 in this wave. (2026-11-24, assumption not asked, shown in the question round)
- `cstack/src/tracker/ready.ts` keeps its argument `hasWorktree`, and `cstack/src/run-state.ts` keeps the field `readAt` of `SavedReport`. Neither file belongs to this ticket, and both are harmless. (2026-11-24, assumption not asked, shown in the question round)
- The negative criterion "no file in `cstack/src/` imports from `helper/`, `wave/` or `unit/collect`" is proved by the deletion itself. `npm run typecheck` fails on any import of a module that does not exist. Unit 10 also runs `grep -rnE "(helper|wave)/|unit/collect" cstack/src --include=*.ts` and expects no match. No test case is added for it. (2026-11-24, shown at the approval gate, and the user approved the plan with "go" without asking for a test)

## Architecture

The change is a removal, and the ticket and the answers of the question round lock the approach. No new decision since the question round.

## Implementation units

### Unit 1: Keep only the tracker cases of the end-to-end tests without Orca

- Files: `cstack/test/e2e/orca.test.ts`, `cstack/test/e2e/no-orca.test.ts`, `cstack/test/e2e/chain.ts`, `cstack/test/e2e/bin/orca`, `cstack/test/fixtures/e2e-orca/units/1/src/square.js`, `cstack/test/fixtures/e2e-orca/units/1/test/square.test.js.fixture`, `cstack/test/fixtures/e2e-orca/units/2/src/cube.js`, `cstack/test/fixtures/e2e-orca/units/2/test/cube.test.js.fixture`, `cstack/test/e2e/resolve-issue.test.ts`
- No test: this unit only deletes end-to-end cases of commands that later units remove, with the code that only those cases use. The kept tracker cases do not change, and they must still pass.
- Minimum code: Delete `cstack/test/e2e/orca.test.ts` and the four files under `cstack/test/fixtures/e2e-orca/units/`. In `cstack/test/e2e/no-orca.test.ts`, delete the cases at lines 36 to 88 ("creates one git worktree after the answer yes...", "answers the helpers with the sub-agent and its inputs...", "skips both units in the collect...") and whatever only they use. Keep the case "reads, comments and moves the ticket through the fake gh" in each Orca state, and the block "the tracker commands with no gh on the PATH", unchanged. In `cstack/test/e2e/chain.ts`, remove the members that no kept case uses, such as `wave`, `dispatchOf`, `sentDispatches`, `childPath` and `copyUnitFile`, the lines of `written()` for `helper wait`, `helper done`, `unit collect` and `helper start`, and every import that becomes unused. Keep the copy of `cstack/test/fixtures/e2e-orca/plan.md`. Rewrite its first comment so that it describes the end-to-end tests without Orca. In the fake `cstack/test/e2e/bin/orca`, remove the answers to `reference find`, `worktree create`, `worktree rm` and every `orchestration` command, so that it reads no recorded answer that unit 7 deletes. Keep its answers to `--version`, `status --json` and `agent-context --json`, its modes `old` and `closed`, and its call log. In `cstack/test/e2e/resolve-issue.test.ts`, delete the line of `written()` for `unit collect` (line 78), the line for `helper start` (line 80, with the line `const unitAt` above it when nothing else uses it), and the variable `CSTACK_ORCA_WORKERS` with its comment (lines 231 and 232). Keep `ORCA_CLI_COMMAND`.
- Refactor: none.
- Commit message: test(tests): keep only the tracker cases of the end-to-end tests without Orca
- Depends on: none

Before the commit, run `cd cstack && npx vitest run test/e2e/no-orca.test.ts test/e2e/resolve-issue.test.ts`. Both compile cstack first, so give the shell call a timeout of ten minutes. Both must pass. Then run `cd cstack && npm run typecheck`.

### Unit 2: Move parseWorktreeList next to cstack measure

- Files: `cstack/src/measure/moments.ts`, `cstack/src/wave/worktrees.ts`, `cstack/test/measure-worktrees.test.ts`, `cstack/test/wave/worktree-check.test.ts`
- Test: `cstack/test/measure-worktrees.test.ts`: a new case "parseWorktreeList reads the path, the branch and the bare mark of each block" loads the module with `await import("../src/measure/moments.js")` inside the case. It calls `parseWorktreeList()` on the text of the case "parses blocks" of `cstack/test/wave/worktree-check.test.ts` (lines 18 to 25), and expects the same three entries. It fails first, because `moments.ts` does not export the function yet.
- Minimum code: Move `WorktreeEntry` and `parseWorktreeList()` unchanged from `cstack/src/wave/worktrees.ts` (lines 13 to 39) into `cstack/src/measure/moments.ts`, exported, and delete its import from `../wave/worktrees.js` (line 7). In `cstack/src/wave/worktrees.ts`, import both from `../measure/moments.js` and export them again, so that `cstack/src/commands/wave.ts` keeps working until unit 3 deletes it. Delete the case "parses blocks" from `cstack/test/wave/worktree-check.test.ts`.
- Refactor: none.
- Commit message: refactor(cli): move parseWorktreeList next to cstack measure
- Depends on: none

### Unit 3: Remove cstack wave

- Files: `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/src/commands/wave.ts`, `cstack/src/wave/answers.ts`, `cstack/src/wave/confirm.ts`, `cstack/src/wave/errors.ts`, `cstack/src/wave/groups.ts`, `cstack/src/wave/names.ts`, `cstack/src/wave/notify.ts`, `cstack/src/wave/orca-error.ts`, `cstack/src/wave/start-git.ts`, `cstack/src/wave/start-orca.ts`, `cstack/src/wave/start.ts`, `cstack/src/wave/title.ts`, `cstack/src/wave/watch.ts`, `cstack/src/wave/worktrees.ts`, `cstack/test/wave/answers.test.ts`, `cstack/test/wave/confirm.test.ts`, `cstack/test/wave/groups.test.ts`, `cstack/test/wave/names.test.ts`, `cstack/test/wave/notify.test.ts`, `cstack/test/wave/open-from-file.test.ts`, `cstack/test/wave/start-git.test.ts`, `cstack/test/wave/start-orca.test.ts`, `cstack/test/wave/start.test.ts`, `cstack/test/wave/title.test.ts`, `cstack/test/wave/watch-confirm.test.ts`, `cstack/test/wave/watch-errors.test.ts`, `cstack/test/wave/watch-interval.test.ts`, `cstack/test/wave/watch-no-client.test.ts`, `cstack/test/wave/watch-ready.test.ts`, `cstack/test/wave/watch-start.test.ts`, `cstack/test/wave/worktree-check.test.ts`, `cstack/test/helpers/wave.ts`, `cstack/test/helpers/watch.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`
- Test: `cstack/test/cli.test.ts`: a new case "answers cstack wave as an unknown command" runs `run(["wave", "--cstack-unknown-flag"], io)`. It expects exit code 2 and an empty standard output. It expects the first line of standard error to be exactly `cstack: unknown command "wave"`, the rest to hold `Usage: cstack`, and standard error not to hold `cstack wave`.
- Minimum code: Delete `cstack/src/commands/wave.ts`, the folder `cstack/src/wave/`, the folder `cstack/test/wave/`, `cstack/test/helpers/wave.ts` and `cstack/test/helpers/watch.ts`. In `cstack/src/cli.ts`, remove the import of `wave` (line 28) and the handler `wave` (line 71). In `cstack/src/manifest.ts`, delete the entry of `cstack wave` (lines 305 to 313). In `cstack/test/manifest.test.ts`, the case "reads the command words of a usage line that has a group in parentheses" (line 111) uses the entry of `cstack tracker list` instead, whose usage has the group `(--milestone <name> | --epic <key>)`, and expects `["tracker", "list"]`. Remove the two `wave` lines of the case "names the ticket of the flag once the command is built" (lines 143 and 144), and the two `wave` lines of the case "names the ticket of the command while the command is not built" (lines 150 and 151). The count of the case at line 156 becomes 23, and its title says "twenty-three". In `cstack/test/cli.test.ts`, the comment at line 140 becomes "Its own list, because every real first word has at least one built command."
- Refactor: none.
- Commit message: feat(cli): remove cstack wave
- Depends on: 1, 2

### Unit 4: Remove cstack unit collect

- Files: `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/src/commands/unit-collect.ts`, `cstack/src/unit/collect.ts`, `cstack/test/unit/collect-cleanup.test.ts`, `cstack/test/unit/collect-test-runs.test.ts`, `cstack/test/unit/collect.test.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`
- Test: `cstack/test/cli.test.ts`: a new case "answers cstack unit collect with the usage of the unit group" runs `run(["unit", "collect", "--cstack-unknown-flag"], io)`. It expects exit code 2, an empty standard output, and a standard error of exactly `cstack: usage: cstack unit <order|commit|red|green>` followed by a newline.
- Minimum code: Delete `cstack/src/commands/unit-collect.ts`, `cstack/src/unit/collect.ts` and the folder `cstack/test/unit/`. In `cstack/src/cli.ts`, remove the import of `unitCollect` (line 22) and the handler `collect` of the group `unit` (line 97). In `cstack/src/manifest.ts`, delete the entry of `cstack unit collect` (lines 290 to 304). In `cstack/test/manifest.test.ts`, remove the line `expect(unbuiltRefusal(["unit", "collect"])).toBeUndefined();` (line 148) and the words "unit collect" from the list of the case "gives --plan to the new commands that work on a run" (line 173). The count of built commands becomes 22, and the title says "twenty-two".
- Refactor: none.
- Commit message: feat(cli): remove cstack unit collect
- Depends on: 1, 3

### Unit 5: Remove the cstack helper commands

- Files: `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/src/commands/helper-start.ts`, `cstack/src/commands/helper-wait.ts`, `cstack/src/commands/helper-done.ts`, `cstack/src/helper/child.ts`, `cstack/src/helper/done.ts`, `cstack/src/helper/record.ts`, `cstack/src/helper/spec.ts`, `cstack/src/helper/start.ts`, `cstack/src/helper/wait.ts`, `cstack/src/plan/unit-line.ts`, `cstack/src/commands/errors.ts`, `cstack/test/helper/child-escalation.test.ts`, `cstack/test/helper/child-worktree.test.ts`, `cstack/test/helper/done.test.ts`, `cstack/test/helper/fallback.test.ts`, `cstack/test/helper/find-child.test.ts`, `cstack/test/helper/record.test.ts`, `cstack/test/helper/spec.test.ts`, `cstack/test/helper/start.test.ts`, `cstack/test/helper/wait.test.ts`, `cstack/test/helper/worktree-line.test.ts`, `cstack/test/plan/unit-line.test.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`
- Test: `cstack/test/cli.test.ts`: three new cases, one for each command: "answers cstack helper start as an unknown command", "answers cstack helper wait as an unknown command" and "answers cstack helper done as an unknown command". Each runs `run(["helper", "<word>", "--cstack-unknown-flag"], io)`, with `start`, `wait` or `done` as the word. Each expects exit code 2 and an empty standard output. Each expects the first line of standard error to be exactly `cstack: unknown command "helper"`, the rest to hold `Usage: cstack`, and standard error not to hold `cstack helper`.
- Minimum code: Delete the three command files, the folder `cstack/src/helper/`, `cstack/src/plan/unit-line.ts`, the folder `cstack/test/helper/` and `cstack/test/plan/unit-line.test.ts`. In `cstack/src/cli.ts`, remove the three imports (lines 5 to 7) and the group `helper` of `HANDLERS` (lines 77 to 82). In `cstack/src/manifest.ts`, delete the entries of `cstack helper start`, `cstack helper wait` and `cstack helper done` (lines 255 to 289). In `cstack/src/commands/errors.ts`, remove the import of `HelperError` (line 3) and its test in `failWith()` (line 12). In `cstack/test/manifest.test.ts`, delete the case "names the ticket of the command while the command is not built" and the case "gives --plan to the new commands that work on a run", which have nothing left to check. The count of built commands becomes 19, and the title says "nineteen".
- Refactor: none.
- Commit message: feat(cli): remove the cstack helper commands
- Depends on: 4

### Unit 6: Remove cstack report check and the report functions that only the removed commands used

- Files: `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/src/commands/report-check.ts`, `cstack/src/report/reports.ts`, `cstack/src/commands/report-submit.ts`, `cstack/test/report.test.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`
- Test: `cstack/test/cli.test.ts`: a new case "answers cstack report check with the usage of the report group" runs `run(["report", "check", "--cstack-unknown-flag"], io)`. It expects exit code 2, an empty standard output, and a standard error of exactly `cstack: usage: cstack report <submit>` followed by a newline.
- Minimum code: Delete `cstack/src/commands/report-check.ts`. In `cstack/src/cli.ts`, remove the import of `reportCheck` (line 15) and the handler `check` of the group `report` (line 75). In `cstack/src/manifest.ts`, delete the entry of `cstack report check` (lines 140 to 147). In `cstack/src/report/reports.ts`, remove what the line of `## Decisions` about the report functions lists, and the import of `writeFileAtomic` once nothing uses it. `checkReport()` keeps the exact refusal "The kind <kind> is not allowed for the role executor. Allowed kinds: done, needs-decision, failed, published." In `cstack/src/commands/report-submit.ts`, call `checkReport({ kind, text }, where)` (line 65). In `cstack/test/report.test.ts`, delete the block "checkReport, implementer" (lines 159 to 184). Delete the cases "saves unit reports apart from the run reports and finds the latest of a helper" (line 189), "saves, then takes a report once and sets readAt" (line 205), "returns two reports oldest first" (line 216) and "shows two accepted reports oldest first" (line 317). In "never replaces a report saved at the same time" (line 224), read the two saved files from the reports folder instead of calling `takeOldestUnreadReport()`. The block at line 242 is named "cstack report submit". The case at line 303 is named "accepts a report and saves it", keeps its checks of `report submit`, and drops its calls to `report check`. Remove `role: "executor"` from every report of the file. The count of built commands in `cstack/test/manifest.test.ts` becomes 18, and the title says "eighteen".
- Refactor: none.
- Commit message: feat(cli): remove cstack report check
- Depends on: 5

`cstack/test/report.test.ts` prepares its git repositories once and copies them for each case. Keep every shared setup that a kept case still uses. Run the whole file before the commit.

### Unit 7: Stop detecting the Orca features of the removed commands

- Files: `cstack/src/orca/features.ts`, `cstack/src/orca/shapes.ts`, `cstack/src/orca/answer.ts`, `cstack/src/doctor/orca.ts`, `cstack/test/doctor-orca.test.ts`, `cstack/test/orca/features.test.ts`, `cstack/test/orca/shapes.test.ts`, `cstack/test/fixtures/orca/1.4.263/orchestration-check.empty.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-check.worker-done.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-send.sent.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.completed.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.exited.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.failed.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.not-found.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.waiting.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.working.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-start.failed-stage.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-start.model-refused.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-start.new-child.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-start.ready.json`, `cstack/test/fixtures/orca/1.4.263/orchestration-worker-start.refused.json`, `cstack/test/fixtures/orca/1.4.263/reference-find.archived.json`, `cstack/test/fixtures/orca/1.4.263/reference-find.none.json`, `cstack/test/fixtures/orca/1.4.263/reference-find.one-worktree.json`, `cstack/test/fixtures/orca/1.4.263/worktree-create.started.json`, `cstack/test/fixtures/orca/README.md`
- Test: `cstack/test/doctor-orca.test.ts`: the case "prints the minimum, supported, and one line per feature" (line 78) expects exactly three lines: "Orca (optional): 1.4.263, minimum 1.4.259, supported, running.", "  Jira through Orca: available" and "  Linear through Orca: available". The cases "says that an older version is not supported" (line 98) and "gives every feature as not available when Orca is closed" (line 106) expect a length of 3 instead of 6. All three fail on today's code.
- Minimum code: In `cstack/src/orca/features.ts`, `OrcaFeatureName` becomes `"jira" | "linear"`. Remove `WORKER_COMMANDS`, `CHILD_WORKTREE_COMMANDS`, `TICKET_WORKTREE_COMMANDS` and the detectors `workers`, `child-worktrees` and `ticket-worktrees` (lines 128 to 130). In `cstack/src/doctor/orca.ts`, `FEATURE_LABELS` keeps only the Jira and Linear lines. In `cstack/src/orca/shapes.ts`, remove the six shapes that the line of `## Decisions` about the shapes lists. Delete `cstack/src/orca/answer.ts` and the eighteen recorded answers. In `cstack/test/orca/features.test.ts`, `ALL` becomes `["jira", "linear"]`. Delete the case "makes only child worktrees unavailable without the worktree rm command". Drop the check of `workers` in "makes only Jira unavailable with no Jira site" (line 60) and in "runs only what is needed, and each command once" (line 111). In "names a renamed field" (line 101), ask for `linear` instead of `workers`. In `cstack/test/orca/shapes.test.ts`, delete the case "checks the answers of orca reference find and orca worktree create" (line 46) and the block "orchestration shapes" (line 95). In `cstack/test/fixtures/orca/README.md`, delete the paragraph that starts "These four files hold the answers of `orca reference find` and `orca worktree create`" with its list, and the whole section "## Orchestration files in `1.4.263/`".
- Refactor: none.
- Commit message: feat(cli): stop detecting the Orca features of the removed commands
- Depends on: 1, 3, 4, 5

Run `cstack/test/orca/`, `cstack/test/doctor-orca.test.ts`, `cstack/test/doctor.test.ts` and `cstack/test/tracker/` before the commit. The case "accepts every recorded JSON file" of `shapes.test.ts` must still pass.

### Unit 8: Name cstack report submit in the message after --done publish

- Files: `cstack/src/commands/next.ts`, `cstack/test/next.test.ts`
- Test: `cstack/test/next.test.ts`: the case "--done publish says that the run is finished" (line 290) expects the standard output to be exactly "The run is finished. Submit your published report with cstack report submit published --plan <plan file>." followed by a newline.
- Minimum code: Change only the string at `cstack/src/commands/next.ts`, line 181. Change nothing else in that file, because #102 changes the check of the plan phase in it.
- Refactor: none.
- Commit message: fix(cli): name cstack report submit in the message after --done publish
- Depends on: none

### Unit 9: Describe cstack unit order as the order the units run

- Files: `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`
- Test: `cstack/test/manifest.test.ts`: a new case "summarises cstack unit order as the order the units run" finds the entry whose command words are `unit order`, and expects its summary to be exactly "Print the units in the order they run."
- Minimum code: Change the summary of `cstack unit order` in `cstack/src/manifest.ts` (line 151). Its output does not change.
- Refactor: none.
- Commit message: fix(cli): describe cstack unit order as the order the units run
- Depends on: 6

### Unit 10: Remove the six commands from the README and say what replaces them

- Files: `README.md`
- No test: this unit changes documentation only, and no test reads the list of commands of the README.
- Minimum code: In "## Commands" of `README.md`, line 49 becomes "`cstack` has eighteen commands. Run `cstack` with no argument to see how to call each one." Delete the paragraphs of `cstack report check` (line 60), of the three `cstack helper` commands (lines 61 to 63), of `CSTACK_ORCA_WORKERS` (line 64), of `cstack unit collect` (line 69) and of `cstack wave` (lines 72 and 73). The paragraph of `cstack unit order` (line 66) becomes exactly: "- `cstack unit order [--json]` reads the plan file and prints the units in the order they run. It prints them in batches. A unit comes after the units it depends on, and after an earlier unit that shares a file with it. Run the units of batch 1 from left to right, then those of batch 2, and so on. Units that already have a commit, and units that are blocked, are listed apart." After the list, before "## A test report per case", add exactly this paragraph: "Six commands left `cstack`, because Orca and Claude Code already do their work. These are `cstack wave`, `cstack helper start`, `cstack helper wait`, `cstack helper done`, `cstack unit collect` and `cstack report check`. The variable `CSTACK_ORCA_WORKERS` left with them. To start the tickets of a wave, each in its own workspace, use the orchestration of Orca. A helper is a second Claude that does one job of your run, such as building one unit of the plan. Inside a ticket, Claude Code now starts each helper as a sub-agent, and the units run one after the other. The helper that runs the build still reports with `cstack report submit`." Change no other paragraph, because #100 and #102 change the paragraphs of `cstack unit red`, `cstack unit green` and `cstack next`.
- Refactor: none.
- Commit message: docs(cli): remove the six commands from the README and say what replaces them
- Depends on: 3, 4, 5, 6, 7, 9

Before the commit, run `grep -rnE "(helper|wave)/|unit/collect" cstack/src --include=*.ts` from the repository root and check that it prints nothing. Write its result in the report.

### Unit 11: Say that only older versions of cstack wrote the Worktree line of a unit

- Files: `cstack/skills/resolve-issue/templates/plan.md`
- No test: one line of the comment of the template changes, and no test reads that line. `cstack/test/guides/helpers-are-sub-agents.test.ts` scans the templates and must still pass.
- Minimum code: Line 71 of `cstack/skills/resolve-issue/templates/plan.md` becomes exactly "- Worktree: <path, with ~/ in place of the home folder>, optional, written by older versions of cstack when a unit ran in a child worktree, never by a person". Change no other line.
- Refactor: none.
- Commit message: fix(skill): say that only older versions of cstack wrote the Worktree line of a unit
- Depends on: 5

## Documentation duties

- Decision records: do not apply. ADR-RQG-A (`docs/decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md`) already records that this ticket removes the old commands, and this ticket adds no new decision.
- The README: applies, written to `README.md` by unit 10.
- The plan template: applies, line 71 of `cstack/skills/resolve-issue/templates/plan.md`, written by unit 11.
- The description of the recorded Orca answers: applies, written to `cstack/test/fixtures/orca/README.md` by unit 7.
- The specification page: does not apply, because `docs/projects/refocus-and-quality-guards.md` describes the removal in US-3 already and links ADR-RQG-A.
- The ticket comment on #95: applies, written in the document phase.
- The comments on the dependent tickets: applies, written in the document phase. The comment on #97 asks, word for word, to remove `watchIntervalMinutes` with `setupCommand`. The comment on #104 lists the six commands that left, the variable `CSTACK_ORCA_WORKERS`, and what replaces them, for the release notes.
- The epic #84: does not apply, because the epic links to the specification page.
- Release notes: do not apply, because #104 writes them at the end of milestone R3.

## Blocking questions

### Question 1: The message after `--done publish`
When the executor runs `cstack next --done publish`, `cstack` prints "The run is finished. Submit your published report with cstack helper done published --helper <helper id>." (`cstack/src/commands/next.ts`, line 181). That command leaves with this ticket. I propose this exact new message, which repeats the command of the publish guide word for word: "The run is finished. Submit your published report with cstack report submit published --plan <plan file>." Do you agree with these exact words?
- For: the user
- Answer: yes, the message is "The run is finished. Submit your published report with cstack report submit published --plan <plan file>." Source: the user answered "go" in the chat on 2026-11-24, which accepts the recommended answer.

### Question 2: What `cstack unit collect` and `cstack report check` answer after the removal
The ticket says that each removed command "now gets the answer of an unknown command". `cstack wave` and `cstack helper ...` lose their first word, so they get `cstack: unknown command "wave"` with the usage, and exit 2. `unit` and `report` stay, so `cstack unit collect` gets `cstack: usage: cstack unit <order|commit|red|green>` and `cstack report check` gets `cstack: usage: cstack report <submit>`, and both exit 2. That is what any unknown word of a known group gets today. I propose to keep those two existing answers and to add no new message. Is that the answer the ticket wants?
- For: the user
- Answer: yes, keep the two existing answers and add no new message. Source: the user answered "go" in the chat on 2026-11-24, which accepts the recommended answer.

### Question 3: The setting `watchIntervalMinutes`
Only `cstack wave --watch` reads the setting `watchIntervalMinutes` (`cstack/src/settings.ts`, lines 45, 67 and 313 to 316). Neither the ticket nor the epic says to remove it. `cstack` refuses a settings file with an unknown key, so removing it would break every settings file that still holds it, including the settings template (`cstack/skills/resolve-issue/templates/settings.json`, line 7). I propose to keep the key in this ticket, and to leave a comment on the ticket that removes `setupCommand` (#97), so that it removes both keys in the same change. Do you agree?
- For: the user
- Answer: yes, keep the key, and leave the comment on #97. Source: the user answered "go" in the chat on 2026-11-24, which accepts the recommended answer.

### Question 4: The `- Worktree:` line of a unit
`cstack helper start --child-worktree` was the only writer of the `- Worktree:` line of a unit, through `cstack/src/plan/unit-line.ts`. I propose to delete `unit-line.ts` and its test, because only the removed commands use it. The plan reader keeps accepting the line, and `cstack measure` keeps reading it in older plans, so the plan format does not change. The plan template still says that cstack writes the line "when a unit runs in a child worktree" (`cstack/skills/resolve-issue/templates/plan.md`, line 71). I propose to reword only that line to: "- Worktree: <path, with ~/ in place of the home folder>, optional, written by older versions of cstack when a unit ran in a child worktree, never by a person". Do you agree with both changes?
- For: the user, and the coordinator of the wave for the plan template
- Answer: yes to both changes. Source: the user answered "go" in the chat on 2026-11-24, which accepts the recommended answer. The coordinator of the wave answered on 2026-11-24 that no other ticket of this wave plans to change `cstack/skills/resolve-issue/templates/plan.md`, after reading the plans of #96, #100 and #102, so line 71 may change if the user approves. The coordinator also said that #100 does not import `cstack/src/plan/unit-line.ts`, so the module may leave.

### Question 5: The tracker cases of `cstack/test/e2e/no-orca.test.ts`
The comment of the #93 run says to delete `cstack/test/e2e/no-orca.test.ts` with the helper code. But that file also holds the only end-to-end cases that run the built `cstack tracker read`, `comment` and `move` with a fake `gh`, without Orca, and with no `gh` on the PATH (lines 90 to 126). They are the only end-to-end proof of the rule "every cstack command works without Orca". I propose to keep the file with only those cases, and to keep `cstack/test/e2e/chain.ts` and the fake programs `gh` and `orca` that they need, cut down to what those cases use. The cases about `cstack wave`, the helpers and `cstack unit collect` (lines 36 to 88) leave, and so does `cstack/test/e2e/orca.test.ts`. Do you agree?
- For: the user
- Answer: yes, keep the tracker cases with what they need. Source: the user answered "go" in the chat on 2026-11-24, which accepts the recommended answer.

## Review log

Impact notes (executor, 2026-11-24):

- I searched the whole repository for the names of the six removed commands, `CSTACK_ORCA_WORKERS`, `parseWorktreeList`, `HelperError`, `unit-line` and `orca/answer`. Outside the diff, only old plan files under `docs/plans/` and the command strings that `cstack/test/audit.test.ts` reads from guides and session logs still name them. Old plans are history, and the audit tests only match text, so both are fine.
- `parseWorktreeList` now lives in `cstack/src/measure/moments.ts`, and its callers and its test moved with it in unit 2.
- The full suite passes: type check clean, 101 test files and 1677 tests. A first full run showed two failures in one file while another test run went at the same time. A second run alone passed.
- I found no `WHY:` or `DECISION:` comment in the deleted files that conflicts with the removal. Decisions of this plan cover the removal.

Reviewer findings (executor, 2026-11-24):

- Correctness: no bug found. The reviewer ran the type check and the full suite, and both passed. Minor note: the file-name assertion of `saveReport` went away with a deleted test. I left it as it is.
- Security: no finding. The branch only deletes code that started other programs.
- Conventions: no finding. Authors and committers use the no-reply address, and the public text rule holds. Minor note: `checkReport` still says "role executor" in one message, and tests may match those words, so I left it.
- Simplicity: I fixed two findings in commit 45c4646, the `--child-worktree` filter in `written()` and the comment about waves in `chain.ts`. I did not shrink the fake `bin/orca` script or drop an `export`, because the gain is small. `hasWorktree`, `readAt` and `watchIntervalMinutes` stay on purpose, as the Decisions say.

## Briefing

## Non-blocking questions

1. `cstack/src/tracker/ready.ts` keeps an argument `hasWorktree` that only `cstack wave` set, and `cstack/src/run-state.ts` keeps the field `readAt` of `SavedReport`, which only `cstack report check` wrote. Should a later ticket remove both? This pull request leaves them, because neither file belongs to it and both are harmless.
   - For: the maintainer.

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-24, executor, build phase: moved ticket #95 to "in progress" with cstack tracker move. Branch gambitl/remove-old-commands is checked out.

## History

### Questions you may not be asking

**I need your answer before I plan**

1. **The new words of the message after `cstack next --done publish`.** Today it says to run `cstack helper done published --helper <helper id>`, and this ticket deletes that command. I propose "The run is finished. Submit your published report with cstack report submit published --plan <plan file>." These are the exact words of the publish guide. A test checks the message word for word, so the words must be fixed before the plan. "ok" keeps them.

2. **`cstack unit collect` and `cstack report check` answer with the usage of their group, not with "unknown command".** The ticket says that each removed command gets the answer of an unknown command. That is true for `cstack wave` and `cstack helper`. But the words `unit` and `report` stay, so these two get `cstack: usage: cstack unit <order|commit|red|green>` or `cstack: usage: cstack report <submit>`, with exit code 2. Any unknown word of a known group gets that answer today. I recommend keeping it and adding no special message.

3. **`watchIntervalMinutes` stays in the settings for now.** Only `cstack wave --watch` read it. If it leaves now, `cstack` refuses every settings file that still holds it, the template included. I recommend this comment on the ticket that removes `setupCommand` (#97): "Please remove `watchIntervalMinutes` in the same change as `setupCommand`. Only `cstack wave --watch` read it, and #95 removed that command. The key is in `cstack/src/settings.ts` and in `cstack/skills/resolve-issue/templates/settings.json`."

4. **Delete `cstack/src/plan/unit-line.ts`, and reword the `- Worktree:` line of the plan template.** Only the removed commands use that module. The plan reader and `cstack measure` keep reading the line, so the plan format does not change. The template is outside the files of this ticket, so I would first ask the coordinator of the wave: "#95 would like to reword line 71 of `cstack/skills/resolve-issue/templates/plan.md`, which says that cstack writes the `- Worktree:` line. After #95, no cstack command writes it. Does another ticket of this wave change that file?" I recommend both changes.

5. **Keep the tracker cases of `cstack/test/e2e/no-orca.test.ts` instead of deleting the whole file.** The comment of #93 says to delete it with the helper code. But it is the only test that runs `cstack tracker read`, `comment` and `move` as the built program, with a fake `gh`. It runs them with Orca missing, too old or closed, and once with no `gh` on the PATH. I recommend trimming the file to those cases, and keeping `chain.ts` and the fake `gh` and `orca` that they need.

**I will do this unless you say no**

- The new cases that must fail first call each removed command with an unknown flag. Without a flag, today's `cstack report check` marks a real report of this ticket as read, and `cstack helper done` waits on standard input. Accepted by default: the user answered "go" on 2026-11-24 with no objection.
- `cstack unit order` keeps its output, the `Batch n:` lines and the JSON included. Only its summary and the README change, as the ticket says, because the build guide reads those lines. Accepted by default: the user answered "go" on 2026-11-24 with no objection.

**I checked it myself**

- `cstack audit` never reads the command list, so it still audits runs made with 0.3.x after the entries leave.
- No skill and no guide names a removed command any more, so the test that checks every command they name stays green.

**Good to know**

- After this ticket, nothing in `cstack` checks that Orca can start a reviewer other than Claude. The independent review guide asks you for a decision instead.

#### Details

The message after `cstack next --done publish` is blocking, and only the user can answer it, because the coordinator's guard says that a change to a message that the ticket fixes is a question for the user. The current text is at `cstack/src/commands/next.ts`, line 181, and `cstack/test/next.test.ts` checks it word for word at line 297. The proposed words copy step 4 of `cstack/guides/resolve-issue/publish.md` (line 27) and its mandatory steps block (line 4). I considered printing the real plan path instead of `<plan file>`, because `next` knows it as `located.relative`. I rejected it, because that path is relative to the repository root. It would be wrong when someone runs the command from a subfolder. The guide also gives the full command already. If nobody decides, the message keeps naming a command that no longer exists.

What `cstack unit collect` and `cstack report check` answer is blocking, and only the user can answer it, because it decides whether the ticket's acceptance line ("now gets the answer of an unknown command") is met. The behaviour itself was checked with the installed 0.3.2 and matches `dispatchSubcommand()` in `cstack/src/cli.ts` (lines 137 to 148). `cstack wave` and `cstack helper ...` reach `fail(io, "unknown command ...")` in `run()` once their entries and handlers leave. They do not reach `unbuiltRefusal()`, because that function returns nothing when no entry has their first word. The entries must therefore be deleted, never kept with `built: false`, or the answer becomes "is not built in this version yet" with exit code 1. A special message for the two group words would need a list of removed words outside the manifest, which the ticket does not ask for. If nobody decides, the group usage stays, which I recommend anyway.

The setting `watchIntervalMinutes` is blocking, because it changes what this ticket deletes, and only the user can answer it. `unknownKeys()` in `cstack/src/settings.ts` refuses an unknown key, so removing the key breaks every settings file that holds it, including `cstack/skills/resolve-issue/templates/settings.json` (line 7). This repository's `.cstack/settings.json` does not hold it. The ticket that removes `setupCommand` (#97) already chose to refuse its removed key in its own acceptance, so asking it to remove both keys together gives users one break instead of two. Both edits of the settings file are outside this ticket's file list. If nobody decides, the key stays and keeps being printed above each guide, which is harmless noise.

The deletion of `cstack/src/plan/unit-line.ts` and the rewording of line 71 of the plan template are blocking. The deletion can be checked by a search: only `cstack/src/helper/start.ts` and `cstack/src/helper/child.ts` import the module, and only `cstack/test/plan/unit-line.test.ts` tests it. The template change needs the coordinator, because `cstack/skills/resolve-issue/templates/plan.md` is not in the file list of this ticket's decisions. The template is already in format version 2, and the reader (`cstack/src/plan/read.ts`, lines 333 to 345 and 479 to 487) still accepts the line in both versions. Removing the field from the reader would change the plan format, which a decision forbids. If the coordinator says no, the module still goes, and the template keeps a sentence that is no longer true.

Keeping the tracker cases of `cstack/test/e2e/no-orca.test.ts` is blocking, and only the user can answer it, because it partly reverses the decision taken from the comment of the #93 run, which says to remove both end-to-end files. The file runs `describe.each` over three Orca states (none, older than 1.4.259, closed). Its case "reads, comments and moves the ticket through the fake gh" (line 90) runs in each state, and "the tracker commands with no gh on the PATH" (lines 104 to 125) checks exit code 4 with a PATH that holds only `git` and `node`. `cstack/test/e2e/resolve-issue.test.ts` never calls `cstack tracker`. The unit tests under `cstack/test/tracker/` check exit code 4 in process with fake runners, but none runs the built `bin.js` as a child process that looks up `gh` on a real PATH. Since `cstack/src/tracker/open.ts` (line 95) asks Orca only about Jira and Linear, the three Orca states add little for GitHub. The main value is the end-to-end proof of the epic rule that every command works without Orca. Trimming deletes the helper, implementer and collect cases. It also deletes the `wave` member and the helper-record reader of `chain.ts` (line 267). It keeps `cstack/test/e2e/bin/gh` and `cstack/test/e2e/bin/orca`, which the old and closed modes need. It keeps the files of `cstack/test/fixtures/e2e-orca/` that `createChain()` reads. The cheaper option of deleting everything loses that proof. Writing a new, smaller end-to-end test costs more than trimming. If nobody decides, the decision as written applies and the whole file goes.

The red-first cases in `cstack/test/cli.test.ts` are non-blocking, and reading the code answered them. `cli.test.ts` calls `run()` in process, with the real handlers and with the working directory of the vitest process, which is inside this worktree. On today's code, `cstack report check` with no argument calls `locatePlan()` and then `takeOldestUnreadReport()`. That function writes `readAt` into a report of the live run folder, which sits under the shared git folder (`cstack/src/run-state.ts`, line 96). The installed 0.3.2 `cstack helper wait` reads the same unread reports (`v0.3.2:cstack/src/helper/wait.ts`, line 41). `cstack helper done` reads standard input (`helper-done.ts`, line 32), so a case with a kind and a helper id could hang. An unknown flag such as `--cstack-unknown-flag` makes every old handler refuse before it reads anything, as the existing case at `cli.test.ts`, line 226 already shows. Each case then asserts the exact new standard error text, which differs from today's refusal, so it fails first for the right reason.

The output of `cstack unit order` is non-blocking. Scope item 5 of the ticket limits the change to the summary at `cstack/src/manifest.ts`, line 151, and to the README paragraph at line 65. The output still prints `Batch n:` lines (`cstack/src/commands/unit-order.ts`, line 17), and `cstack/guides/resolve-issue/build.md` (line 32) reads them in order. The split into batches still follows the shared-file rule of `cstack/src/plan/order.ts` (lines 80 to 86), which only mattered for parallel units. That is harmless for sequential units. The specification's AC4 could be read as asking for a flat order. Changing the text output or the JSON shape would touch the build guide and the readers of `--json`, which belong to no ticket of this wave. A later ticket can flatten it.

I checked that `cstack audit` keeps working on runs made with 0.3.x. `cstack/src/commands/audit.ts` imports only `readSteps()` from `cstack/src/guide-steps.ts`. The only use of `matchMention()` in `guide-steps.ts` is in `stepProblems()`, which only the tests call. So a 0.3.x guide folder passed with `--guides`, whose build block still lists `cstack helper start` and `cstack unit collect`, is not checked against the shrinking manifest. `cstack/src/audit/main-session.ts` (line 7) matches `helper start executor` as plain words, so it keeps finding the second session file of 0.3.x runs.

I checked that the mention scan stays green. The case "passes on the real skills and guides" of `cstack/test/manifest.test.ts` (line 72) scans only `cstack/skills/` and `cstack/guides/`. A search of both folders finds no mention of a removed command, only the key `watchIntervalMinutes` in the settings template. The README is not scanned, so its audit paragraph (line 54) can keep naming `cstack helper start executor` for old runs. Three other cases of `manifest.test.ts` name the removed entries. The case at line 111 can use the entry of `cstack tracker list`, whose usage line also has a group in parentheses (`manifest.ts`, line 229). The cases at lines 143 to 151 lose their `wave`, `unit collect` and `helper start` lines. The case at line 173 goes entirely.

Nothing in `cstack` will check any more that Orca can start a reviewer other than Claude. Today, `cstack doctor` prints the `workers` feature (`cstack/src/doctor/orca.ts`, line 16), and nothing else reads it. The ticket's acceptance asks to remove that line, and the independent review guide (`cstack/guides/resolve-issue/independent-review.md`, line 22) returns a needs-decision report when the harness offers no launcher. So no question arises, only a later surprise for a user who sets `review.agent` to another agent.

Some points need no action. The release-notes ticket (#104) already has comments asking users to finish runs in progress and to run `cstack skills install` again after the upgrade. That matters here, because the 0.3.2 executor prompt that users have installed ends with `cstack helper done`, and the new binary answers that with exit code 2. Old run folders keep their `helpers/` and `units/<n>/reports/` folders under `.git/cstack/runs/`, and no kept code reads them. `npm run build` does not empty `cstack/dist/`, so a local build keeps stale files of the removed modules. Nothing reaches them, and the release job packs from a fresh checkout. `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md` (line 69) still says that the helper commands stand in until milestone R2. That line is history now, and ADR-RQG-A already records the change. The removal of these public commands is itself locked by the epic decisions block and ADR-RQG-A, so I did not reopen it.

I checked security and authorization, data model lock-in, scale and performance, and operations and cost, and found nothing that this ticket touches.

### Open questions and answers

Each question below has my recommended answer. The run checked the current answers of `cstack` with the installed 0.3.2 on 2026-11-24: `cstack unit nope` prints `cstack: usage: cstack unit <order|commit|red|green|collect>` and exits 2, `cstack report nope` prints `cstack: usage: cstack report <submit|check>` and exits 2, and `cstack nope` prints `cstack: unknown command "nope"` with the usage and exits 2.

1. Blocking question 1. The exact words of the message after `cstack next --done publish`. Recommended: "The run is finished. Submit your published report with cstack report submit published --plan <plan file>."
2. Blocking question 2. What `cstack unit collect` and `cstack report check` answer. Recommended: the usage of their group, as for any unknown word of a known group, with exit code 2.
3. Blocking question 3. Whether `watchIntervalMinutes` leaves the settings. Recommended: it stays in this ticket, and a comment on #97 asks to remove it with `setupCommand`.
4. Blocking question 4. Whether `cstack/src/plan/unit-line.ts` leaves, and how the plan template describes the `- Worktree:` line. Recommended: delete the module and its test, keep the reader, and reword line 71 of the template.
5. Non-blocking, answered by the code map. `cstack/src/audit/main-session.ts` keeps its clue `helper start executor` (line 7). `cstack audit` still reads the sessions of runs made with 0.3.x, which hold that call, and the audit folder belongs to #100 in this wave. The README paragraph of `cstack audit` keeps naming that call for the same reason. Recommended: change neither.
6. Non-blocking. Where `parseWorktreeList()` goes. Recommended: into `cstack/src/measure/moments.ts`, next to `worktreeFolders()`, its only caller. Its test case "parses blocks" moves to `cstack/test/measure-worktrees.test.ts`.
7. Non-blocking. Whether `HelperError` moves or leaves. Recommended: it leaves with `helper/`, and `failWith()` stops testing for it, because no kept code throws it.
8. Non-blocking. The recorded Orca answers of the removed commands. Recommended: delete the fourteen `orchestration-*.json` files, the three `reference-find.*.json` files and `worktree-create.started.json`, with their two sections of `cstack/test/fixtures/orca/README.md`, because the shape check refuses a fixture with no shape.
9. Non-blocking. The dead lines of `cstack/test/e2e/resolve-issue.test.ts`. Recommended: remove the two lines of `written()` for `unit collect` and `helper start` (lines 78 and 80), and the variable `CSTACK_ORCA_WORKERS` with its comment (lines 231 and 232).
10. Non-blocking, open, not needed for this ticket. `cstack/src/tracker/ready.ts` keeps an argument `hasWorktree` that only `cstack wave` set, and `cstack/src/run-state.ts` keeps the field `readAt`, which only `report check` wrote. Recommended: leave both, because neither file belongs to this ticket and both are harmless.
11. Blocking question 5. Whether the tracker cases of `cstack/test/e2e/no-orca.test.ts` stay. Recommended: keep them with the parts of `chain.ts` and of the fake programs that they need.

### Architecture options
