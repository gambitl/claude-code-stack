# Plan: #112 — R1-8: Stop two false verdicts of cstack audit on the helper steps of a real run

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/112
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/audit-helper-verdicts
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T15:20:38+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Stop `cstack audit` from giving two false verdicts on the `cstack helper` steps of a real run.

- **What the title means**: `cstack audit` (#89) prints, for each phase and each required command of a run, whether the run did it, skipped it or did it out of order. Before #89 merged, it was run once on its own run, with the guides of `main` that #88 filled. Two of its verdicts were wrong.
- **First false verdict**: the `plan` guide asks the main conversation to run `cstack helper wait <helper id>` after it starts the executor. When the executor runs as a sub-agent, the executor itself runs `cstack helper wait` for each implementer, much earlier. The audit takes the first of those waits as the wait of the `plan` phase, so it prints "done" with a time that belongs to the executor.
- **Second false verdict**: when a blocking question after the build adds a unit, the executor builds that unit during a later phase. The audit looks for the steps of the `build` phase only inside the window of that phase. So the `cstack helper wait <helper id>` step of the new unit shows as "out of order", and its other steps only pass through the run state and git.
- **For the user**: #92 audits runs 3 and 4 with the guides of the end of milestone R1, which still hold these `cstack helper` steps. Without this fix, its report holds a false "done" and a false "out of order".

**Goal.** This ticket makes the audit tell the calls of the main conversation from the calls of a helper, and accept the steps of a unit that was added after the build.

### Where things are today (read first)

* **The calls**: `cstack/src/audit/calls.ts` → `readCalls()` returns each call with its time and arguments only. It does not keep which file the call came from, so a call of the main session and a call of a helper transcript look the same.
* **The files**: `cstack/src/measure/sessions.ts` → `findRunFiles()` returns each file with a `helper` flag, which says whether it is a helper transcript under `<session id>/subagents/`.
* **The windows**: `cstack/src/audit/evaluate.ts` → `evaluateSteps()` (line 124) builds the window of the steps of a phase. The window ends at the next close of a phase that runs in the same place (line 167), and a call counts only inside it (line 174).
* **The places**: `cstack/src/phases.ts` → `runsIn` on each entry of `PHASES` says whether a phase runs in the main conversation or in the executor.
* **The guides**: `cstack/guides/resolve-issue/plan.md` and `retro.md` list `cstack helper start executor` and `cstack helper wait <helper id>` in their blocks. `build.md` lists `cstack helper wait <helper id> | each-unit`.
* **When the executor is an Orca worker**: its calls are in a main session file of its own, not in a helper transcript. So the `helper` flag alone cannot say which agent made a call.

### Scope

1. Keep, for each call, which session file it came from and whether that file is a helper transcript.
2. A step of a guide that runs in the main conversation matches only the calls of the main conversation's session. Find that session as the one that holds the `cstack next --done ticket --plan <plan file>` call. Decide in the question round what happens when no session holds it.
3. A step of a unit that the plan added after the build phase closed is looked for until the close of the phase in which that unit was built.
4. Keep the format of the lines and the exit codes of #89.
5. Build every test fixture by hand. Never copy a real session into the repository.

### Acceptance (TDD)

* The audit test file: a run whose executor is a sub-agent, and whose executor runs `cstack helper wait` for its implementers before the main conversation's own wait. Write this fixture first. The plan line `cstack helper wait <helper id>` must take the main conversation's wait, not the executor's.
* The same file: a run where unit 3 was added and built after the build phase closed. Its line `cstack helper wait <helper id>` says "done" with the time of its own wait.
* The same file: a run whose executor is an Orca worker, with its own main session, still gives "done" for every step of the executor phases.
* The same file, negative: the output still holds only fixed labels, step names and times, and no path.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #89 · Feeds: #92

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rule of the specification for every story.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

**Acceptance criteria of US-1 that this ticket touches.** The specification lists them in section 4, under "US-1: Audit the steps of a run". #89 built AC1, AC2, AC3, AC6, AC8 and the two negative criteria. This ticket makes the verdicts of AC2 right for the steps of the `cstack helper` commands, and it keeps the negative criterion "The audit never prints, copies or sends the content of a session". #90 carries AC4, AC5 and AC7.

The ADRs that this block names:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

The only blocker is #89, which is closed as completed. Its pull request #113 is merged into `main`.

## Code mapping

**The path of a call.** `cstack/src/commands/audit.ts` drives the audit. It calls `findRunFiles()` at lines 95 to 102, which returns `{ path, helper }` for each session file. It refuses at line 103 when no file is a main session. Then it calls `readCalls()` at line 104 with the paths only, so the `helper` flag is dropped there. `readCalls()` (`cstack/src/audit/calls.ts`, line 7) returns `Call = { time: number; args: string[] }` (line 4), sorted by time, with each tool call id counted once across all files (lines 23 to 26). The phase lines come from `evaluatePhases(state, calls)` (`cstack/src/audit/evaluate.ts`, line 38). The step lines come from `evaluateSteps(input)` (line 124), whose input type `StepInput` is at line 68.

**Where the session files come from.** `findRunFiles()` (`cstack/src/measure/sessions.ts`, line 69) scans `<home>/.claude/projects/<folder>/*.jsonl`. A main session counts when its times overlap the window and one of its `cwd` values sits in the repository or a worktree of the plan (lines 119 to 122). It is pushed with `helper: false` (line 123), followed by every `.jsonl` of `<session id>/subagents/` with `helper: true` (lines 124 to 127). So a helper transcript always comes right after its main session in the list. An executor that runs as an Orca worker has its own main session in the same worktree, so it also arrives with `helper: false`. `cstack measure` calls the same function through `measureSessions()` (line 133), so any change there must keep its results.

**How the steps are judged today.** `nodesOf()` (`evaluate.ts`, lines 85 to 121) turns the listed steps of a guide into nodes. A step with no condition is a segment of its own. Consecutive repeated steps (`each-unit`, `each-unit-with-test`) form one group, expanded for every unit of the plan in plan order. The step after a group has every unit's last node of that group as predecessors (`tail = next`, lines 107 to 118). The floor of a node is the latest result among its predecessors (lines 170 and 171). A skipped node passes its own floor on (line 184). The window of a phase starts at the nearest earlier close of any phase (line 166). It ends at the nearest later close of a phase with the same `runsIn` (line 167). A call counts only inside the window (lines 173 to 175). `chooseCall()` (lines 30 to 35) takes the first call at or after the floor. When all calls come before the floor, it takes the latest one as "out of order". When no call matches and the phase is not a planning phase, `otherEvidence()` (lines 147 to 161) uses `units/<n>/red.json` and `green.json`, the author date of the oldest commit with `Cstack-Unit: <n>` (`commitTime()`, lines 127 to 139), or the `doneAt` of a `next --done <phase>` step.

**The places of the phases.** `PHASES` (`cstack/src/phases.ts`, lines 95 to 115) gives `runsIn` for each phase. The main conversation runs ticket, dependencies, code-map, questions, plan and retro. The executor runs build, review, independent-review, update-branch, document, briefing, after-build-questions, ready and publish. `PLANNING_PHASES` is at line 117.

**The steps that cause the two false verdicts.** The real guides list `cstack helper start executor --plan <plan file>` and `cstack helper wait <helper id>` at the end of the blocks of `plan.md` and `retro.md`. `build.md` lists `cstack helper start implementer --plan <plan file> --unit <n> | each-unit`, then `unit red`, `unit green`, `unit commit` and `cstack helper wait <helper id> | each-unit` in one group, followed by `cstack unit collect <n>... --plan <plan file>`, `cstack plan status --plan <plan file>` and `cstack next --done build --plan <plan file>`. The step `cstack helper wait <helper id>` carries no unit number, so for the plan phase it matches the first wait of the window, which is an executor wait for an implementer when the executor is a sub-agent. For a unit built after the build phase closed, the window of the build phase (from the close of plan to the close of review) misses its calls.

**A new false verdict to avoid.** Once the late unit's steps are found, its last step gets a late time. That time becomes the floor of `cstack unit collect`, `cstack plan status` and `cstack next --done build`, which come after the group (lines 116 and 118). Their calls happened during the build phase, before that floor, so they would turn "out of order". The fix must keep a late unit out of the predecessors of the steps that follow its group.

**How the main conversation can be found.** `cstack next --done ticket` needs `--plan <file>` (`cstack/src/commands/next.ts`, lines 118 and 119), so the close of the ticket phase always names the plan file. It is the first call of a run that `cstack` records. A helper id names its role and its unit, such as `20261119-143205123-implementer-3` (`cstack/src/helper/record.ts`, lines 39 to 50), but the ticket asks for the origin of the call, not for a rule about helper ids.

**Tests and fixtures.** `cstack/test/audit.test.ts` builds every fixture by hand. Its `setup()` (line 138) writes one main session `p/s.jsonl` with one assistant line per call. `fullCalls()` (line 116) places one call per step. `BLOCKS` (line 30) gives the plan and retro blocks with the two helper steps, and the build guide comes from `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md`, which has no `cstack helper` step. So the new cases need their own build block with the helper steps of the real guide, a helper transcript under `p/s/subagents/`, and a second main session for the Orca-worker case. The plan fixture `cstack/test/fixtures/audit/plan.md` has units 1 and 2 with a test and unit 3 with no test. The negative test "nothing private leaves the command" (line 546) checks every line against an allowed pattern and checks that no path appears. `cstack/test/audit-calls.test.ts` tests `readCalls()` directly with paths, so a change of its signature changes that file too. `cstack/test/measure.test.ts` and `cstack/test/measure-worktrees.test.ts` protect `cstack measure` and must pass unchanged.

**Governing decisions.** ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`) says the expected steps come from the block of each guide. The plan of #89 decided the window rule and its extension to the next close in the same place (its Blocking question 3, commit `a4fb417`). It also decided that the audit prints only fixed labels, step names, verdicts and times, and that a session holding two runs mixes their calls. No `WHY:` or `DECISION:` comment sits in `cstack/src/audit/`. The README describes the audit and its limits at line 54, so a change of behaviour changes that paragraph.

**Risks.** `evaluate.ts` changed four times during #89, and its window rule was fixed after the build once already (unit 8 of #89). #90 changes the same file next, so the change should stay small and leave a clear origin on each call. `findRunFiles()` is shared with `cstack measure`, so this ticket should not change it at all.

## Decisions

- The fix of the window for a unit that the plan added after the build phase closed covers every repeated step of that unit, not only `cstack helper wait <helper id>`. That includes `cstack helper start implementer --plan <plan file> --unit <n>`. The audit of the run of #89 showed this line as skipped for its units 8 and 9, which were built after the build phase closed. (2026-11-23, from the comment of the ticket owner on #112)
- Every test fixture is built by hand. Never copy any part of a real session into the repository. (2026-11-23, from the ticket and the brief of the run)
- Keep `cstack measure` unchanged. When this ticket changes anything under `cstack/src/measure/`, the output of `cstack measure` stays the same, and its existing tests pass without any change to them. `cstack measure` reads the same session files, and it will measure runs 5 and 6 for comparison with runs 1 to 4. (2026-11-23, from the brief of the run)
- #90 also changes the matching code of the audit, mainly `cstack/src/audit/evaluate.ts`. It runs after this ticket merges, and it builds on what this ticket changes, for example on the origin of each call. (2026-11-23, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-23, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. Never edit anything under the top-level `skills/` folder, which is frozen. (2026-11-23, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-23, from the conventions file and the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-23, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-23, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-23, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-23, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must not do needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-23, from the retrospective of #86, `docs/retros/2026-11-23-86.md`)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-23, from the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-23, from the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-23, from the retrospective of #86)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-23, from the retrospective of #89, `docs/retros/2026-11-23-89.md`)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-23, from the retrospective of #89)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-23, from the retrospective of #89)
- This ticket changes nothing under `cstack/src/measure/`. `findRunFiles()` (`cstack/src/measure/sessions.ts`, line 69) already returns `{ path, helper }` for each session file, in an order where each main session comes right before its helper transcripts (lines 123 to 127). (2026-11-23, decided in the plan)
- `Call` in `cstack/src/audit/calls.ts` (line 4) becomes `{ time: number; args: string[]; file: number; helper: boolean }`. `file` is the index of the session file in the list that `readCalls()` received, and `helper` is the flag of that file. A `Call` never holds a path. (the user, on 2026-11-23, accepted by default)
- `readCalls()` (`cstack/src/audit/calls.ts`, line 7) takes the `files` list that `findRunFiles()` returns, `{ path: string; helper: boolean }[]`, instead of a list of paths. It still returns `{ calls, unreadableFiles }`, sorted by time. `cstack/src/commands/audit.ts` (line 104) passes `found.files` to it. (the user, on 2026-11-23, accepted by default)
- When the same tool call id appears in several files, `readCalls()` keeps the call once, with the origin of the first file of the list that holds it. Today it already keeps the first one it reads (`cstack/src/audit/calls.ts`, lines 23 to 26). (2026-11-23, decided in the plan)
- A new module `cstack/src/audit/main-session.ts` exports `mainFiles(calls: Call[], planFile: string): { files: Set<number>; fallback: boolean }`. It returns the indexes of the session files that count as the main conversation, and whether it had to fall back. It reads only the calls, never a file. (2026-11-23, decided in the plan)
- The close of the ticket phase of this run is a call that matches the step `next --done ticket`, in a file that is not a helper transcript, and whose `--plan` value has the same file name as the plan file of the audit. The file name is the last part of the path, so `docs/plans/a.md` and an absolute path that ends with `/a.md` both match `a.md`. Both `--plan <value>` and `--plan=<value>` count. `cstack next --done ticket` always carries `--plan` (`cstack/src/commands/next.ts`, lines 118 and 119). (the user, on 2026-11-23)
- When at least one file holds the close of the ticket phase of this run, the main conversation is every file that is not a helper transcript and that holds a call that only the main conversation makes. Such a call matches `next --done <phase>` or `next --phase <phase>` for a phase whose `runsIn` is "main conversation" in `PHASES` (`cstack/src/phases.ts`, lines 95 to 115), or it matches `helper start executor`. When such a call carries `--plan`, its file name must be the file name of the plan of the audit, or the call does not count. A call with no `--plan` counts, because the plan guide's own step `cstack next --done plan` has none. So a main conversation that resumed in a second session counts too. (the user, on 2026-11-23)
- A call of `cstack next --done <phase>` for a phase that the executor runs, such as `build`, never makes a file count as the main conversation. A call in a helper transcript never makes it count either. The session of an executor that runs as an Orca worker therefore stays out. (the user, on 2026-11-23)
- When no file holds the close of the ticket phase of this run, `mainFiles()` falls back: the main conversation is every file that is not a helper transcript, and `fallback` is true. (the user, on 2026-11-23)
- In `evaluateSteps()` (`cstack/src/audit/evaluate.ts`, line 124), a step of a guide whose phase has `runsIn` "main conversation" takes only the calls whose `file` is in the main conversation set. These phases are ticket, dependencies, code-map, questions, plan and retro. `StepInput` (line 68) gets a field `mainFiles: Set<number>` for it, and `cstack/src/commands/audit.ts` fills it from `mainFiles()`. (the user, on 2026-11-23)
- The steps of the phases that the executor runs keep taking the calls of every file, helper transcripts included, as today. The phase lines of `evaluatePhases()` (`cstack/src/audit/evaluate.ts`, line 38) do not change: they keep taking the calls of every file. (the user, on 2026-11-23, accepted by default)
- When `mainFiles()` falls back, the audit still prints every line. Then it prints `cstack audit: no session file holds the close of the ticket phase, so the steps of the main conversation may show the calls of another agent.` on standard error, and it exits with 1. When a session file also could not be read, the sentence about unreadable files comes first (`cstack/src/commands/audit.ts`, line 119), and this sentence comes after it. (the user, on 2026-11-23; the order of the two sentences decided in the plan)
- The format of the lines and the exit codes of #89 do not change. The audit adds no line and no label on standard output. The only new output is the sentence on standard error when it falls back, with its exit code 1. (2026-11-23, from the ticket)
- The build time of a unit is the time of the first session call, in any file and at any time of the run, that matches the step `unit commit <n>` for that unit. When no call matches, it is the `time` of `units/<n>/red.json` in the run folder, which `savedTime(unit, "red")` reads (`cstack/src/audit/evaluate.ts`, lines 140 to 146). When that file is missing, it is the author date of the oldest commit with `Cstack-Unit: <n>`, which `commitTime(unit)` reads (lines 127 to 139). Without any of the three, the unit has no build time. (the user, on 2026-11-23)
- A unit is late when it has a build time and the build phase has a close time, and the build time comes after that close. The close time of the build phase is the time of its line `phase build` (`closes` in `evaluateSteps()`, line 125). A unit with no build time is never late. (the user, on 2026-11-23)
- Every repeated step of a late unit, in any guide, is looked for in a window that starts as the window of its phase starts today (line 166). The window ends at the earliest close of any phase that is at or after the build time of the unit. When no phase closed at or after the build time, the window has no end. The steps of a unit that is not late keep the window of their phase. (the user, on 2026-11-23)
- A late unit is not a predecessor of the step that follows its group. So in `build.md`, the steps `cstack unit collect <n>... --plan <plan file>`, `cstack plan status --plan <plan file>` and `cstack next --done build --plan <plan file>` take their floor only from the units that are not late (`nodesOf()`, `cstack/src/audit/evaluate.ts`, lines 107 to 118). (the user, on 2026-11-23)
- The test fixtures of the new cases of `cstack/test/audit.test.ts` use a build guide whose block lists the command steps of the real `cstack/guides/resolve-issue/build.md` in its order: `cstack tracker move '<key>' --to "in progress" --tracker <name>`, `cstack unit order --plan <plan file>`, `cstack helper start implementer --plan <plan file> --unit <n> | each-unit`, `cstack unit red <n> | each-unit-with-test`, `cstack unit green <n> | each-unit-with-test`, `cstack unit commit <n> | each-unit`, `cstack helper wait <helper id> | each-unit`, `cstack unit collect <n>... --plan <plan file>`, `cstack plan status --plan <plan file>` and `cstack next --done build --plan <plan file>`. A helper transcript is a file `<session id>/subagents/agent-<id>.jsonl` next to its main session `<session id>.jsonl`, and its lines carry `isSidechain: true`. (2026-11-23, decided in the plan, from the shape of a session of this run)
- In a repeated step whose text holds no `<n>`, such as `cstack helper wait <helper id>`, every unit prints the same text. A test that checks the line of unit 3 takes the third such line of the `build` phase, in the order of the units of the plan. (2026-11-23, decided in the plan, from `nodesOf()`, `cstack/src/audit/evaluate.ts`, line 98)
- Before the pull request opens, the main conversation runs the built audit on this run, with `node cstack/dist/bin.js audit <plan file>`. It checks that the line `plan: cstack helper wait <helper id>` shows the time of its own wait, after the close of `ready`, and that the `build` lines are done. It also lists the `subagents` folder of this run's session and checks that the transcripts of the implementers lie directly in it, because `findRunFiles()` reads only that level. When they do not, that is a new question for the user, because `findRunFiles()` stays unchanged. (2026-11-23, decided in the plan, from the retrospective of #89)

## Architecture

The approach is locked by the ticket and the answers of the question round, and the change is small. A call keeps the index of its session file and its helper flag. A new function finds the session files of the main conversation from the calls alone. `evaluateSteps()` uses that set for the phases of the main conversation, and it finds the units built after the build phase from the session, the run folder and git. Nothing under `cstack/src/measure/` changes.

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

### Unit 1: Keep the origin of each call

- Files: `cstack/src/audit/calls.ts`, `cstack/src/commands/audit.ts`, `cstack/test/audit-calls.test.ts`
- Test: `cstack/test/audit-calls.test.ts`: `readCalls()` takes `{ path, helper }[]`; a call of a main session has `file` 0 and `helper` false; a call of a helper transcript has the index of that file and `helper` true; a tool call id that appears in a main session and in a helper transcript is kept once, with the origin of the first file of the list; the keys of a call are exactly `args`, `file`, `helper` and `time`, so no path is kept
- Minimum code: Change `Call` and `readCalls()` in `cstack/src/audit/calls.ts` as `## Decisions` says, and pass `found.files` from `cstack/src/commands/audit.ts`. Update the existing cases of `cstack/test/audit-calls.test.ts` to the new argument and the new fields.
- Refactor: none
- Commit message: feat(cli): keep the session file and the helper flag of each call in cstack audit
- Depends on: none

Each new case is its own `it()`. The existing cases change only their argument and their expected objects.

### Unit 2: Find the sessions of the main conversation

- Files: `cstack/src/audit/main-session.ts`, `cstack/test/audit-main-session.test.ts`
- Test: `cstack/test/audit-main-session.test.ts`: `mainFiles()` counts a main session that holds `next --done ticket --plan docs/plans/a.md` for the plan `a.md`; it counts a second main session that holds only `next --done plan` with no `--plan`; it counts a second main session that holds only `next --phase retro --plan <absolute path ending with /a.md>`; it counts a second main session that holds only `helper start executor --plan=docs/plans/a.md`; it does not count a main session that holds only `next --done build --plan docs/plans/a.md`; it does not count a main session whose only main-conversation call is `next --done ticket --plan docs/plans/b.md`; it does not count a main session whose only main-conversation call is `next --done plan --plan docs/plans/b.md`; it does not count a helper transcript that holds `next --done plan`; with no close of the ticket phase for `a.md`, it returns every file that is not a helper transcript and `fallback` true; with a close, `fallback` is false
- Minimum code: The new module `cstack/src/audit/main-session.ts` with `mainFiles()`, as `## Decisions` says. It reuses `matchesStep()` and `stepWords()` of `cstack/src/audit/match.ts` and `PHASES` of `cstack/src/phases.ts`, and `basename()` of `node:path`.
- Refactor: none
- Commit message: feat(cli): find the session files of the main conversation of a run in cstack audit
- Depends on: 1

The test file imports the module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does, so that each case fails on its own before the module exists. The test builds `Call` values by hand, with no file on disk.

### Unit 3: Give the steps of the main conversation only its own calls

- Files: `cstack/src/audit/evaluate.ts`, `cstack/src/commands/audit.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: a run whose executor is a sub-agent, whose helper transcript holds a `cstack helper wait` for each implementer during the build phase, and whose main session holds its own `cstack helper wait` after the close of `ready`: the line `plan: cstack helper wait <helper id>` shows the time of the main session's wait (write this fixture first); a run whose executor is an Orca worker, with its executor calls in a second main session: every step line of the executor phases is done, and the line `plan: cstack helper wait <helper id>` shows the time of the first main session's wait, not of an executor wait; a run whose main conversation resumed in a second main session that holds `cstack next --done plan`, `cstack helper start executor` and `cstack helper wait`, while a helper transcript holds earlier waits: the plan and retro lines show the times of the second session; a run with a main session of another plan (`--plan docs/plans/other.md`) that holds an earlier `cstack helper wait`: the plan line does not take it; a run where no session holds the close of the ticket phase, with an early wait in a helper transcript: the plan line shows the main session's wait, standard error is exactly the fallback sentence of `## Decisions`, the exit code is 1, every output line matches the allowed lines of the test "nothing private leaves the command", and no folder of the fixture appears in the output
- Minimum code: Add `mainFiles` to `StepInput` and filter the calls of the main-conversation phases in `evaluateSteps()`. In `cstack/src/commands/audit.ts`, call `mainFiles(read.calls, planArgument)`, pass its set, print the fallback sentence after the sentence about unreadable files, and count the fallback in the exit code.
- Refactor: Move the building of session lines in `setup()` of the test into a helper that can write a call into a chosen file, if that keeps the new cases short.
- Commit message: fix(cli): match the steps of the main conversation only with its own calls in cstack audit
- Depends on: 2

The fallback case is the negative case of the ticket: it is the only case whose output holds a new text, so it also checks that the output holds no path. Each case is its own `it()`.

The existing cases need one fixture change. `fullCalls()` replaces every placeholder with `x`, so its close of the ticket phase is `cstack next --done ticket --plan x`, whose file name is not `audit.md`. After this unit, every existing case would then fall back and print the new sentence. So `fullCalls()` must write `docs/plans/audit.md` in place of `<plan file>`, and keep `x` for the other placeholders. The existing cases keep their expectations. Only the two literal strings `cstack next --done build --plan x` of the case "takes the second cstack next --done build, the one after the unit steps" (`cstack/test/audit.test.ts`, lines 500 and 501) change to `cstack next --done build --plan docs/plans/audit.md`.

### Unit 4: Look for the steps of a unit built after the build phase until the phase that built it

- Files: `cstack/src/audit/evaluate.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: unit 3 is built during `after-build-questions`, its `cstack unit commit 3` call comes after the close of `build`, and git holds a commit of unit 3 dated inside the build phase: the lines `build: cstack helper start implementer --plan <plan file> --unit 3`, `build: cstack unit commit 3` and the third line `build: cstack helper wait <helper id>` are done with the times of their own calls; unit 2 has no `cstack unit commit 2` call, its `units/2/red.json` time comes after the close of `build`, git holds a commit of unit 2 dated inside the build phase, and its calls come after the close of `build`: the lines of unit 2 are done with their own times; unit 3 has no session commit call and no `red.json`, git holds its oldest commit dated after the close of `build`, and its implementer start comes after that close: its line `build: cstack helper start implementer --plan <plan file> --unit 3` is done with its own time; unit 3 is built after the close of `publish`, the last phase: its lines are done with their own times; unit 3 is built during `after-build-questions` but the executor never ran its `cstack helper wait`, while the main conversation ran a wait after the close of `ready`: the third line `build: cstack helper wait <helper id>` is exactly `out of order <time of the wait of unit 2> session`, and never takes the main conversation's wait
- Minimum code: In `evaluateSteps()`, compute the build time of each unit and the set of late units, as `## Decisions` says. For a node of a late unit, end its window at the earliest close at or after its build time, or give it no end.
- Refactor: none
- Commit message: fix(cli): look for the steps of a unit built after the build phase until the close of its own phase in cstack audit
- Depends on: 3

Each source of the build time has its own case. The case with the missing wait checks the end of the window. The fixtures write the git commits with `GIT_AUTHOR_DATE`, as the existing case "uses a commit with the Cstack-Unit trailer when no call shows it" does.

### Unit 5: Keep a late unit out of the floor of the steps after its group

- Files: `cstack/src/audit/evaluate.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: unit 3 is built during `after-build-questions`, and the calls of `cstack unit collect`, `cstack plan status` and `cstack next --done build` happen during the build phase, after the steps of units 1 and 2: the lines `build: cstack unit collect <n>... --plan <plan file>`, `build: cstack plan status --plan <plan file>` and `build: cstack next --done build --plan <plan file>` are done with their build-phase times, not out of order
- Minimum code: Give `nodesOf()` the set of late units, and leave a late unit out of `next` when the group ends.
- Refactor: none
- Commit message: fix(cli): keep a unit built after the build phase out of the floor of the steps after its group in cstack audit
- Depends on: 4

This case fails after unit 4 and before this unit, because unit 4 gives the late unit its own late times.

### Unit 6: Describe the new rules of cstack audit in the README

- Files: `README.md`
- No test: documentation only.
- Minimum code: In the paragraph on `cstack audit` (`README.md`, line 54), say that the steps of the main conversation count only the calls of its own session files, how the audit finds them, what it prints when no session holds the close of the ticket phase, and that the steps of a unit built after the build phase are looked for until the close of the phase that built it. Follow the documentation writing rules: one idea per sentence, every sentence with a subject and a verb.
- Refactor: none
- Commit message: docs(cli): describe how cstack audit tells the main conversation apart and finds a late unit
- Depends on: 3, 5

## Documentation duties

- README: applies, written to the paragraph on `cstack audit` in `README.md` by Unit 6.
- Comment on this ticket (#112): applies, written to #112 in the document phase. It says how the audit now tells the main conversation apart, what it does when no session holds the close of the ticket phase, and how it finds a unit built after the build phase.
- Comment on the ticket that adds the helper checks to the audit (#90): applies, written to #90 in the document phase. It names the new fields `file` and `helper` of `Call`, the function `mainFiles()` in `cstack/src/audit/main-session.ts`, the field `mainFiles` of `StepInput`, and the late units in `evaluateSteps()`, which #90 builds on.
- Comment on the ticket that audits runs 3 and 4 (#92): applies, written to #92 in the document phase. It says that the build time of a late unit comes from the session, then from `units/<n>/red.json`, then from git, and that git shows no unit commit once the branch is merged into its target. It also names the sentence that the audit prints when no session holds the close of the ticket phase.
- Architecture decision record: does not apply. These are rules of one command, as the window rule of #89 was, and the README and this plan record them.
- Specification page: does not apply. This ticket changes no command, flag or output format that `docs/projects/refocus-and-quality-guards.md` describes.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: No session holds the close of the ticket phase
The steps of the main conversation will count only the calls of the session that holds `cstack next --done ticket --plan <plan file>`. What should the audit do when no session file holds that call? I recommend this: the steps of the main conversation then take the calls of every main session file, never of a helper transcript. The audit still prints every line. Then it prints `cstack audit: no session file holds the close of the ticket phase, so the steps of the main conversation may show the calls of another agent.` on standard error and exits with 1. The other choices are to refuse with exit code 3 before any line, or to print every step of the main conversation as skipped.
- For: the user
- Answer: yes, as recommended. When no session file holds the close of the ticket phase, the steps of the main conversation take the calls of every main session file, never of a helper transcript. The audit prints every line, then `cstack audit: no session file holds the close of the ticket phase, so the steps of the main conversation may show the calls of another agent.` on standard error, and exits with 1. The user, in the chat, on 2026-11-23.

### Question 2: How the audit knows that a unit was built after the build phase
A unit added after the build phase has no mark in the plan, so the audit must find out from the run when it was built. I recommend this rule. The time a unit was built is the time of the first session call `cstack unit commit <n>` for that unit, anywhere in the run. When no call shows it, it is the author date of the oldest commit with `Cstack-Unit: <n>` in git, which the audit already reads (`cstack/src/audit/evaluate.ts`, lines 127 to 139). A unit is late when that time comes after the close of the build phase. Every repeated step of a late unit is looked for until the first close of any phase at or after that time, or with no end when no phase closed after it. A late unit is also left out of the steps that must come before `cstack unit collect`, `cstack plan status` and `cstack next --done build`. Otherwise its late time would turn those three lines into a new false "out of order" (`evaluate.ts`, lines 116, 118 and 170). The simpler choice is git only, but git shows no unit commit once the branch is merged into its target, which may be the case for the runs that #92 audits.
- For: the user
- Answer: yes, as recommended, with one more source between the session and git. The build time of a unit is the time of its first session call `cstack unit commit <n>`. Without one, it is the `time` of `units/<n>/red.json` in the run folder. Without one, it is the author date of its oldest commit with `Cstack-Unit: <n>`. The user, in the chat, on 2026-11-23.

### Question 3: A main conversation that continues in a second session
The ticket counts as the main conversation only the session that holds `cstack next --done ticket --plan <plan file>`. The guides plan for a run that stops and resumes later with `cstack next` in a new session (`cstack/guides/resolve-issue/questions.md`, line 78, and `dependencies.md`, line 24). A `/clear` also starts a new session file. The calls of that second session, such as `cstack next --done plan`, `cstack helper start executor` and `cstack helper wait`, would then show as "skipped", with no warning. Should the main conversation also cover such a session? The recommended rule counts as main conversation every main session file, never a helper transcript, that holds a call that only the main conversation makes: `cstack next --done <phase>` or `cstack next --phase <phase>` for a phase whose `runsIn` is the main conversation (`cstack/src/phases.ts`, lines 95 to 115), or `cstack helper start executor`. When such a call carries `--plan`, its file name must match the audited plan. An executor never makes these calls, so the session of an executor that runs as an Orca worker stays out. This changes item 2 of the scope of the ticket.
- For: the user
- Answer: yes, as recommended. Every main session file that holds a call that only the main conversation makes counts as the main conversation, with a test that has two main sessions. The user, in the chat, on 2026-11-23.

## Review log

<phase review>

## Briefing

<CTO advisor, moment after-build>

## Non-blocking questions

none

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request>

## Documentation

<phase document>

## Executor notes

<executor, before its report>

## Hand-off log

<one entry per executor run>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

1. **What should the audit do when no session holds the close of the ticket phase?** This case is rare, because `cstack next --done ticket` has always needed `--plan`, in version 0.3.1 too. When it happens, the audit must either guess or refuse. I agree with the draft: take the calls of every main session file, never of a helper transcript, print every line, warn on standard error and exit with 1. The output stays useful, and it says plainly that it may be wrong.

2. **How does the audit know that a unit was built after the build phase?** Without a rule, the steps of that unit stay "out of order" or "skipped". I agree with the draft: use the first `cstack unit commit <n>` call of the run, else the oldest commit of the unit in git. The late unit also drops out of the steps that follow its group. I would add one source between the two: the time that `cstack unit red` saved for that unit. It sits in the run folder. So a merge of the branch does not hide it, while a merge hides the unit commits from the audit.

3. **Should the main conversation also cover a session that resumed the run without the close of the ticket phase?** The ticket says to take only the session that holds that close. But the questions guide lets a session end while it waits for an answer, and `cstack next` resumes the run later in a new session. That new session runs `cstack helper start executor` and `cstack helper wait`, so their lines would turn "skipped", with no warning at all. I recommend counting every main session file that runs a phase of the main conversation (`cstack next --done` or `--phase` with ticket, dependencies, code-map, questions, plan or retro) or `cstack helper start executor`. I would add a test with two main sessions for it.

**I will do this unless you say no.**

- Each call keeps its origin as the position of its file in the list, plus the helper flag, and never as a path. So no later change, the next audit ticket (#90) included, can print a path by mistake.
- The steps of the executor phases and the lines of the five planning phases keep counting every file, as today. That is what gives "done" to an executor that runs as an Orca worker.
- The README paragraph on `cstack audit` gets the new rules and the fallback. No decision record.
- Before the pull request opens, I run the built audit on this run. I also check that the implementers' transcripts sit directly in the `subagents` folder of the main session, because the file search reads only that level.

**I checked it myself.**

- In this run, a sub-agent's transcript sits in `<session id>/subagents/`, each of its lines carries `isSidechain: true`, and the main session file has no such line.
- Version 0.3.1, which made the runs that #92 audits, already refused `cstack next --done ticket` without `--plan`.

**Good to know.**

- The main conversation runs its `cstack helper wait` only after the executor sub-agent has returned. So a correct line `plan: cstack helper wait <helper id>` shows a time after the close of `ready`, and that is not a bug.

#### Details

The first point is blocking question 1 of the draft, and it needs the user. The ticket asks to decide it in this round (scope, item 2). The case is rare. `cstack next` refuses `--done ticket` without `--plan` (`cstack/src/commands/next.ts`, lines 118 and 119), and the tag `v0.3.1` holds the same refusal at line 113 of that file. So a run of any version that the audit will see has this call, unless its main session file is missing or unreadable. The draft recommendation stands. Falling back to every main session file keeps every line and warns that a helper's call may stand in for one of the main conversation. It does not count helper transcripts, which removes the first false verdict for a run whose executor is a sub-agent. The fallback cannot remove it for an executor that runs as an Orca worker, and the warning says so. Exiting with 1 matches how #89 treats an unreadable session file (`cstack/src/commands/audit.ts`, lines 118 to 120), so the exit codes of #89 keep their meaning. I rejected refusing with exit code 3, because that would hide every phase line that is right. I also rejected printing every main-conversation step as skipped, because that turns a doubt into a false verdict. The default if nobody decides is the draft recommendation.

The second point is blocking question 2 of the draft, and it needs the user. The draft rule is sound, including the part that keeps a late unit out of the predecessors of `cstack unit collect`, `cstack plan status` and `cstack next --done build`. Without that part, the floor at `evaluate.ts`, lines 116, 118 and 170, would turn those three lines "out of order". I add one source of the build time, between the session call and git. `savedTime(unit, "red")` (`evaluate.ts`, lines 140 to 146) already reads `units/<n>/red.json` in the run folder. That folder sits in the git folder of the repository, not in the branch, so it survives a merge of the branch, while `listUnitCommits()` lists only the commits between the target branch and `HEAD`. This source exists only for a unit with a test. The git author date also survives a rebase and an amend, so it stays a fair fallback. When every unit of a plan is late, the steps after the group have no predecessor and no floor. That case is not worth a rule. The default if nobody decides is the draft rule without the extra source.

The third point is mine, and it is blocking because it changes item 2 of the ticket's scope. Only the user can answer it. The guides plan for a main conversation that spans several sessions. `cstack/guides/resolve-issue/questions.md`, line 78, says that when the session has to end before the answer arrives, `cstack next` resumes the run later. `dependencies.md`, line 24, says the same. A Claude Code `/clear` also starts a new session file. The resumed session does not hold `cstack next --done ticket --plan <plan file>`. Under the rule of the ticket, its calls `cstack next --done plan`, `cstack helper start executor --plan <plan file>` and `cstack helper wait <helper id>`, and the three command steps of `retro.md`, would all show "skipped". The fallback of the first point would not fire, because one session does hold the close, so nothing would warn. The rule I recommend counts as main conversation every main session file, never a helper transcript, that holds a call only the main conversation makes. Those calls are `cstack next --done <phase>` or `cstack next --phase <phase>` for a phase whose `runsIn` is the main conversation (`cstack/src/phases.ts`, lines 95 to 115), and `cstack helper start executor`. When the call carries `--plan`, its file name must match the audited plan, as draft point 3 already asks. The plan guide's own step `cstack next --done plan` carries no `--plan` (`cstack/guides/resolve-issue/plan.md`, line 8), so the check cannot require it. An executor never runs these calls, so an Orca worker's session stays out. The test needs a fixture with a first main session that holds the ticket close and a second main session, with no ticket close, that holds the plan close and the two `cstack helper` steps. The default if nobody decides is the rule of the ticket, which keeps this silent false "skipped".

The position of the file is a non-blocking choice with a default, and it refines draft point 6. `readCalls()` gets the `{ path, helper }[]` list of `findRunFiles()`, and each `Call` gets the index of its file in that list and its helper flag. The rule of the main conversation groups calls by that index. A path inside `Call` would work too, but the negative criterion forbids any path in the output, and #90 builds on `Call` next. An index cannot leak. `cstack/test/audit-calls.test.ts` changes with the signature, as draft point 6 says. Nothing under `cstack/src/measure/` changes.

Draft points 4 and 5 are non-blocking, and I keep their defaults. Draft point 8 is non-blocking, and I keep its default: the README paragraph at line 54 changes, and no decision record is written, as for the window rule of #89.

Draft point 7 is non-blocking. I add one check to the run after the build. `findRunFiles()` lists only the `.jsonl` files directly under `<session id>/subagents/` (`cstack/src/measure/sessions.ts`, lines 124 to 127). When the executor runs as a sub-agent, the implementers are sub-agents of a sub-agent. The metadata file next to a transcript of this run has a `spawnDepth` field, which suggests that nesting is recorded, but this run has no nested sub-agent yet. If Claude Code wrote nested transcripts one folder deeper, the implementers' calls would be missing, and their steps would fall back on the run state and git. The check is to list that folder after the build and confirm that the implementers' transcripts are there. If they are not, that is a new question, because `findRunFiles()` must stay unchanged.

I checked two things myself, both by reading files of this run and of the repository. The transcript of this round's sub-agent sits at `<home>/.claude/projects/<folder>/<session id>/subagents/agent-<id>.jsonl`, with a `.meta.json` file next to it that names the agent type. Every line of that transcript carries `isSidechain: true`, and no line of the main session file does. So, with the current Claude Code, the `helper` flag of `findRunFiles()` tells a sub-agent's call from a call of the main conversation. I did not check where older Claude Code versions kept sub-agent transcripts. The rule of the third point looks at the calls themselves, so it does not depend on that layout. Second, `git show v0.3.1:cstack/src/commands/next.ts` holds the refusal of `--done ticket` without `--plan`. Issue #92 says that runs 3 and 4 used 0.3.1, so their main sessions hold the ticket close.

The point about the late time of the main conversation's wait comes from `cstack/guides/resolve-issue/plan.md`, which tells the main conversation to run `cstack helper wait` only after the executor sub-agent has returned. Its window ends at the close of `retro`, the next phase that runs in the main conversation (`evaluate.ts`, line 167), so the call is inside it.

I found nothing to raise on security, scale, operations and cost, or reversibility. The change reads local files only, adds no dependency, and changes no stored format.

### Open questions and answers

1. What happens when no session holds the close of the ticket phase? Blocking question 1. The ticket asks to decide it in this round. Recommended answer: fall back to every main session file, print every line, warn on standard error and exit with 1. The user accepted it.
2. How does the audit know that a unit was built after the build phase, and where does the window of its steps end? Blocking question 2. Recommended answer: the first session call `cstack unit commit <n>`, or else the oldest commit of the unit in git; the window ends at the first phase close at or after that time; a late unit is not a predecessor of the steps that follow its group. The user accepted it, with the time of `units/<n>/red.json` as a second source before git.
3. Which session is the main conversation? Non-blocking, with a default, later widened by Blocking question 3, which the user accepted. Every main session file, never a helper transcript, that holds a call `cstack next --done ticket` whose `--plan` value has the same file name as the audited plan. When several files hold it, all of them count. The file-name check keeps out another ticket's session in the same repository during the same hours. `cstack next --done ticket` always carries `--plan` (`cstack/src/commands/next.ts`, lines 118 and 119).
4. Do the steps of the executor phases also lose the calls of the main conversation? Non-blocking, with a default: no. They keep taking the calls of every file, as today. This is what lets an executor that runs as an Orca worker, with a main session of its own, get "done" on every step.
5. Do the phase lines of the five planning phases also count only the main session? Non-blocking, with a default: no. They stay as #89 built them, because only the main conversation runs `cstack next --done` for a planning phase, and the ticket names only the steps of a guide.
6. How does a call keep its origin? Non-blocking, with a default. `readCalls()` takes the `files` list that `findRunFiles()` returns, `{ path, helper }[]`, instead of a list of paths. Each `Call` gets `file` and `helper`. When one tool call id appears in several files, the call keeps the origin of the first file in that list, which puts each main session before its helper transcripts. `findRunFiles()` and everything under `cstack/src/measure/` stay unchanged.
7. Can the rules be checked against the real order of a run in the same mode before the approval gate? Non-blocking. Not fully. The only run whose sessions I may read is this one, and its executor has not started yet. I checked where this session writes the transcript of a sub-agent: under `<session id>/subagents/agent-<id>.jsonl`, and the main session file holds no line of the sub-agent. The order of the waits will be checked after the build: before the pull request opens, I run the built audit on this run, with the guides of this branch, and look at the line `plan: cstack helper wait <helper id>` and the `build` lines.
8. Where are the decisions documented? Non-blocking, with a default. The README paragraph on `cstack audit` (`README.md`, line 54) gets the two rules and the fallback. No decision record, because these are rules of one command, as the window rule of #89 was.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn.
