# Plan: #108 — R2-7: Run every unit in an implementer, and report a unit that no implementer ran

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/108
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/audit-unit-implementer
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T13:43:26+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Make sure that every unit of a plan is built by an implementer, including a unit that only runs a check, and that the audit reports a unit that the executor built itself.

- **What the title means**: A unit is one small piece of the plan, with its own test and its own commit. An implementer is the helper that builds one unit, and it proves that its test failed first. The executor is the helper that starts the implementers. A unit with no test, such as a check on real data, has a `No test` line instead of a `Test` line.
- **Why we are doing it**: In one of runs 3 and 4, the executor ran a unit by itself, although the build guide says that it never does. That unit was a check with no test. #87 found it while it looked at the tokens. The executor's own work cost about 1.4 million cache read tokens per run, and this case was part of it.
- **For the user**: Each unit goes through the same steps, and the audit says when one did not.

**Goal.** This ticket makes the guides say who runs a unit with no test, and it makes the audit report a unit that no implementer ran.

### Where things are today (read first)

* **The build guide**: `cstack/guides/resolve-issue/build.md` (line 17) says "Never build a unit yourself, even one of a few lines, unless the harness cannot launch sub-agents." It does not say whether this holds for a unit with no test. #93 rewrites this guide first.
* **The plan guide**: `cstack/guides/resolve-issue/plan.md` (line 21) says that each unit has either a `Test` line or a `No test` line with a reason. Line 27 says that no unit is coded in the main conversation.
* **The block of mandatory steps**: #86 defines it, and #88 writes it at the top of each guide. A step can be a check that a named helper makes, such as `resolve-issue:implementer`, with a condition such as "for each unit".
* **The audit**: #90 makes `cstack audit` look for evidence of each helper check. The evidence is the launch of a helper of that type.
* **The specification**: `docs/projects/refocus-and-quality-guards.md`, US-1, and the outcome comment of #87.

### Scope

1. The build guide and the plan guide say that an implementer also runs a unit with no test. They say what the implementer does then: it runs the check, writes its result in its report, and makes the commit of the unit when the unit changes a file.
2. The block of mandatory steps of the build guide names a check by `resolve-issue:implementer` for each unit. Add it only if #88 has not already done so.
3. `cstack audit` reports a unit that no implementer ran, as a skipped step with its evidence. The evidence is the unit number and the absence of a launch of an implementer for it.
4. The audit accepts the escalation implementer for a unit that got stuck.

### Acceptance (TDD)

* A test of the audit: write first a fixture run where the executor's transcript holds the work of unit 2, and no implementer was launched for it. See the audit miss it on today's code. Then the audit prints unit 2 as skipped.
* The same test file: a unit run by `resolve-issue:implementer-escalation` after a stuck report is not reported.
* The same test file: a unit with a `No test` line, run by an implementer, is not reported.
* `cstack/test/manifest.test.ts` passes on the changed guides.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #93, #90 · Feeds: #103

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Acceptance criteria of US-1 that this ticket serves.** The specification lists them in section 4, under "US-1: Audit the steps of a run". This ticket adds one kind of skipped step to the audit, so AC2, AC4, AC5 and the first negative criterion apply to it.

- AC2: For each expected step, the audit prints "done", "skipped" or "out of order", with its evidence. The evidence is a time and the kind of record that shows the step.
- AC4: The third level is the checks that the skill gives to a helper.
- AC5: For the third level, the audit checks that the check happened. It does not check which helper or which model did it, because Claude chooses its helpers.
- AC (negative): The audit never prints, copies or sends the content of a session. It prints step names, verdicts and times only. A test checks this.

The ADRs that this block names, all written by now:

- [ADR-RQG-A: How helpers and units run inside a ticket](../decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md). #93 wrote it.
- [ADR-RQG-B: Version 2 of the plan format](../decisions/ADR-RQG-B-plan-format-version-2.md). #98 wrote it.
- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, and #90 added a section on the helper steps.
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A replaces.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

## Code mapping

**The guides.** The build guide gives the rule in step 3 of "Build the units" (`cstack/guides/resolve-issue/build.md`, line 33): "For each unit, start a fresh sub-agent of type `resolve-issue:implementer`. [...] Never build a unit yourself, even one of a few lines, unless the harness cannot launch sub-agents." It says nothing about a unit with a `No test` line. The plan guide gives the `Test` or `No test` rule in its "Tests." bullet (`cstack/guides/resolve-issue/plan.md`, line 32), and "No unit is coded in the main conversation" in its "Order." bullet (line 38). Neither sentence is near a sentence about the independent review, so the work of #132 is not touched.

**The block of mandatory steps.** It already holds `helper: resolve-issue:implementer | each-unit` and `helper: resolve-issue:implementer-escalation | each-stuck-unit` (`cstack/guides/resolve-issue/build.md`, lines 6 and 10). So scope item 2 needs no change.

**The implementer prompt.** `cstack/skills/resolve-issue/agents/implementer.md` (step 8) already says that "for a No test unit you make the change and go straight to `cstack unit commit <n> --plan <plan file>`". It says nothing about running a check or writing its result in the report. This file is not on the file list of this ticket.

**Every unit needs a commit.** The close of the build refuses a unit that has no commit with its trailer and no `Blocked` line (`cstack/src/phases.ts`, lines 74 to 77, `buildDone`). `cstack unit commit` refuses a unit with no changed file (`cstack/src/commands/unit-commit.ts`, line 129: "Unit ${n} has no changed file."). So a unit that changes no file can never close the build. Scope item 1 says the implementer commits "when the unit changes a file", which does not fit these two rules.

**How the audit reads launches today.** `readCalls()` (`cstack/src/audit/calls.ts`, lines 27 to 35) turns every `Agent` or `Task` tool call with a `subagent_type` into a launch with a time, a file index and a type. It keeps neither the tool call id nor the prompt. `findRunFiles()` lists the main session files and the sub-agent transcripts under `<session>/subagents/` (`cstack/src/measure/sessions.ts`, line 124). Each call keeps the index of the file it came from.

**How the audit judges the implementer step today.** `kindOf()` puts a helper step with `each-unit` into the unit group (`cstack/src/audit/evaluate.ts`, line 91 and line 95). So `nodesOf()` makes one node for each unit, before its `unit red`, `unit green` and `unit commit` nodes. The text of that node has no unit number (line 126). In `evaluateSteps()`, a helper node takes the first free launch of the same type in its window (lines 270 to 284). The launch is not tied to a unit. So with three units and two implementer launches, the audit prints three lines `build: resolve-issue:implementer`, two done and one skipped. It does not say which unit was skipped, and it can blame the wrong one. The escalation step has the condition `each-stuck-unit`, which `kindOf()` treats as false, so its line is never printed.

**What a real run writes.** In the session files of an earlier run of this repository, each sub-agent transcript `agent-<id>.jsonl` has a file `agent-<id>.meta.json` next to it. That file holds `agentType`, such as `resolve-issue:implementer`, and `toolUseId`, which is the id of the `Agent` tool call that launched it. The transcript of an implementer holds its own calls, such as `cstack unit red 2 --timeout 9 --plan <plan file>` and `cstack unit commit 2 --plan <plan file>`. The `description` of the launch, such as "Implement unit 2", is free text that the executor writes. Every sub-agent transcript of the earlier runs of this repository on this machine has its meta file. Nothing in `cstack/src/` reads these meta files yet. Only the fixtures of `cstack measure` hold two of them (`cstack/test/fixtures/measure/basic/`).

**Tests.** `cstack/test/audit.test.ts` (1436 lines) builds a run with `setup()`. By default it writes every call and every launch into one main session file. Its option `files` adds sub-agent transcripts under `s/subagents/`, but it writes no meta file. The default run launches three implementers from the main session, with no transcript of their own, and one case expects `build: resolve-issue:implementer: done ` (line 514). So any rule that ties a launch to its unit through the transcript needs the default run of `setup()` to write implementer transcripts. The build guide fixture `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md` holds the same two helper steps. `cstack/test/guides/build-helpers.test.ts` checks exact sentences of the build guide, among them the sentence of step 3 (line 22) and "Never build a unit yourself" (line 54). A change to step 3 must keep these sentences or change the test in the same unit.

**Risks.** `cstack/src/audit/evaluate.ts` changed in twelve of its last commits, often with `cstack/test/audit.test.ts` and `cstack/src/commands/audit.ts`, and three of them were fixes. Its helper branch serves every helper line, so a change there can move the verdict of the CTO advisor or the reviewers. The README paragraph of `cstack audit` (`README.md`, line 66) describes the helper lines as `<phase>: <helper>`, so it changes with the line text.

**Governing decisions.** ADR-RQG-C, section "How the audit judges helper steps and conditions": only a launch of the named sub-agent proves a helper step, one launch serves at most one line, and `each-stuck-unit` counts as false for now. ADR-RQG-C, section "How the audit reports the check of the whole test file": the line of #100 has no verdict, and `cstack/src/audit/whole-file.ts` (line 18) carries its `WHY:` comment. ADR-RQG-A says that inside a ticket, helpers are sub-agents and units run one after the other. The audit never prints the content of a session (US-1, first negative criterion).

## Decisions

- Scope item 2 is already done on `main`, so this ticket does not add it. The block of mandatory steps of the build guide holds `helper: resolve-issue:implementer | each-unit` (`cstack/guides/resolve-issue/build.md`, line 6) and `helper: resolve-issue:implementer-escalation | each-stuck-unit` (`cstack/guides/resolve-issue/build.md`, line 10). (2026-11-24, from the comment of 2026-11-24 on #108)
- The audit ties an implementer launch to its unit through the transcript of the launched sub-agent. Claude Code writes each sub-agent transcript as `<session>/subagents/agent-<id>.jsonl`, with a file `agent-<id>.meta.json` next to it. The `toolUseId` of that meta file is the id of the `Agent` or `Task` tool call that launched the sub-agent. This was seen in the sub-agent files of an earlier run of this repository on 2026-11-24. The fixture `cstack/test/fixtures/measure/basic/.claude/projects/-repo/main1/subagents/agent-a1.meta.json` (line 1) shows the shape of such a file. (2026-11-24, the user's answer)
- `readCalls()` in `cstack/src/audit/calls.ts` reads the meta file of each transcript that it reads as a helper transcript. The path of the meta file is the path of the transcript with `.jsonl` replaced by `.meta.json`. It reads only the `toolUseId` value, and only when it is a string. It gives each sub-agent launch a field `transcript`, which is the index of the transcript file whose meta file holds the id of that launch. A launch with no such transcript has no `transcript` field. (2026-11-24, the user's answer)
- A meta file that is missing, that is not valid JSON, or whose `toolUseId` is not a string links no launch. It never counts as an unreadable session file, so it never changes the count `unreadableFiles`. (2026-11-24, the user's answer)
- The audit never prints anything that it reads from a meta file. The `description` and `agentType` values are free text or names that the audit never reads into a line. (2026-11-24, assumption accepted by default)
- A helper step with the condition `each-unit` prints one line for each unit, with the text `<phase>: <helper> for unit <n>`. For the build guide this gives `build: resolve-issue:implementer for unit <n>`, followed by its verdict as `formatLine()` writes it today. For example: `build: resolve-issue:implementer for unit 2: skipped`. It replaces the line `build: resolve-issue:implementer`, which named no unit. (2026-11-24, assumption accepted by default)
- A launch proves the implementer line of unit `<n>` only when its transcript holds a call `cstack unit red <n>`, `cstack unit green <n>` or `cstack unit commit <n>`, with the number of that unit. A launch whose transcript names only other units never proves the line of unit `<n>`. A launch with no `transcript` field never proves it. The rules of today still apply on top: the launch has the right type, it lies in the window of the build phase, it comes at or after the floor of the line, and one launch serves at most one line. So one implementer that built units 1 and 2 proves only one of the two lines. (2026-11-24, the user's answer)
- A launch of any type other than `resolve-issue:implementer` and `resolve-issue:implementer-escalation` never proves the implementer line of a unit, even when its transcript names the unit. This covers `general-purpose`, `claude` and `resolve-issue:executor`. (2026-11-24, from ADR-RQG-C, section "How the audit judges helper steps and conditions")
- A launch of `resolve-issue:implementer-escalation` proves the implementer line of unit `<n>` under the same rule as a launch of `resolve-issue:implementer`. The step `helper: resolve-issue:implementer-escalation | each-stuck-unit` stays unprinted, because the condition `each-stuck-unit` still counts as false. (2026-11-24, assumption accepted by default, as scope item 4 of the ticket asks)
- When at least one launch of type `resolve-issue:implementer` or `resolve-issue:implementer-escalation` has no `transcript` field, and the build phase is over, the audit prints this exact sentence on standard error: "cstack audit: some implementer launches have no sub-agent transcript with a meta file, so the units they built may show as skipped." It ends with a new line. It comes after every sentence that the audit prints on standard error today. It is not printed while the build phase is not over. It never changes the exit code by itself, so the rules of the exit code stay as they are. (2026-11-24, assumption accepted by default, and the coordinator's answer)
- This ticket may change `cstack/src/commands/audit.ts`, only to print that sentence. No other running ticket changes that file. (2026-11-24, from the coordinator)
- The test helper `setup()` of `cstack/test/audit.test.ts` writes the default run with every call and every launch in one main session file. Change it so that each of the three implementer launches of the default run has its own transcript under `s/subagents/`, with a meta file whose `toolUseId` is the id of that launch. The calls `cstack unit red <n>`, `cstack unit green <n>` and `cstack unit commit <n>` of unit `<n>` move into that transcript, at the same times. Every existing case keeps passing. Change an existing expectation only where the implementer line now names its unit. (2026-11-24, from the code mapping)
- Scope item 1 of the ticket changes. A check that changes no file, such as a run on real data, is never a unit of its own. It goes into the unit whose code it checks, and the implementer runs it before the commit of that unit and gives the result in its report. A check of the whole build goes into the last unit. The reason is that `cstack next --done build` refuses a unit with no commit and no `Blocked` line (`cstack/src/phases.ts`, lines 74 to 77), and `cstack unit commit` refuses a unit with no changed file (`cstack/src/commands/unit-commit.ts`, line 129). (2026-11-24, the user's answer)
- In step 3 of "Build the units" of `cstack/guides/resolve-issue/build.md`, keep every sentence of today, and add these two sentences at the end of the step: "An implementer also builds a unit with a `No test` line, which has no test to fail first. When a unit asks for a check, such as a run on real data, its implementer runs the check before the commit of the unit and gives the result in its report." (2026-11-24, the user's answer)
- In the "Tests." bullet of `cstack/guides/resolve-issue/plan.md`, keep every sentence of today, and add these three sentences at the end of the bullet: "A check that changes no file, such as a run on real data, is never a unit of its own, because every unit needs a commit. Put the check in the unit whose code it checks, before the commit of that unit. When it checks the whole build, put it in the last unit." (2026-11-24, the user's answer)
- Do not change `cstack/skills/resolve-issue/agents/implementer.md`. It is not on the file list of this ticket, and the ticket that wires the guards into the prompts (#103) rewrites it. Its step 8 already sends a unit with a `No test` line straight to `cstack unit commit`. (2026-11-24, assumption accepted by default)
- Do not change the block of mandatory steps of any guide, nor the `cstack audit` entry of `cstack/src/manifest.ts`. The usage, the flags and the exit codes of `cstack audit` stay the same. (2026-11-24, from the code mapping)
- No security surface beyond the reading of local session files. A meta file is data written by another program: read only its `toolUseId`, never follow a path from it, and never print it. (2026-11-24, from the plan)
- The line numbers that the ticket gives for the guides are out of date, because #93 rewrote them. The sentence "Never build a unit yourself, even one of a few lines, unless the harness cannot launch sub-agents." is now in step 3 of `cstack/guides/resolve-issue/build.md`, line 33. The `Test` or `No test` rule is now in `cstack/guides/resolve-issue/plan.md`, line 32. (2026-11-24, read on `main` during the ticket phase)
- Since #93, the executor starts each implementer as a Claude Code sub-agent of type `resolve-issue:implementer`. The audit finds such a launch in the transcript of the executor. The audit check of this ticket works with the launches of a sub-agent, and it does not read Orca workers. (2026-11-24, from the brief of the run)
- The audit already prints a helper line of the form `<phase>: <helper>`, proved only by a launch of that sub-agent type. One call or one launch serves at most one line. Steps of the `action` kind are never printed. A step whose condition is false is not printed. The audit reads the settings file, and it exits with 3 when that file cannot be used. Do not break these rules. (2026-11-24, from the comment of 2026-11-23 on #108)
- #100 added one audit line for each unit that was checked on the whole test file, with no verdict. Keep that line exactly as it is. The new line of this ticket has a verdict. (2026-11-24, from the brief of the run)
- Three tickets of epic #84 start now, each in its own worktree and with its own pull request. #101 works in a new command file and its module, `cstack/src/commands/unit-commit.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/saved-runs.ts`, `cstack/src/manifest.ts` and `cstack/src/cli.ts` for its own entry, their tests, and its own paragraph of `README.md`. #132 works in `cstack/src/phases.ts`, `cstack/guides/resolve-issue/independent-review.md` and their tests. (2026-11-24, from the brief of the run)
- This ticket changes only `cstack/guides/resolve-issue/build.md`, `cstack/guides/resolve-issue/plan.md`, the files of `cstack/src/audit/`, their tests, and the `cstack audit` paragraph of `README.md`. In `cstack/src/manifest.ts` and `README.md`, change only the entries and the paragraphs of this ticket. When you need a file of another ticket of this wave, ask the coordinator before you change it. (2026-11-24, from the brief of the run)
- This ticket may add a short section to `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`. The section says that a launch of `resolve-issue:implementer-escalation` that names the unit proves the implementer line of that unit. In that file, change only the new section and the sentence about a launch of another type, so that a later merge stays simple. Neither #101 nor #132 changes this record. (2026-11-24, from the coordinator)
- #132 changes `cstack/guides/resolve-issue/independent-review.md`. Before you change a sentence of `build.md` or `plan.md` that is near a sentence about the independent review, ask the coordinator. (2026-11-24, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and do not add a runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- Do not change the plan format. #98 defined version 2 in ADR-RQG-B. When the run needs a new line or a new section in the plan, put it to the user as a blocking question, and ask the coordinator before you plan it. (2026-11-24, from the brief of the run)
- This plan file stays in format `cstack-plan/1`, because the installed `cstack` 0.3.2 writes and reads it. A plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `cstack/test/guides/helpers-are-sub-agents.test.ts` reads every guide, skill and agent prompt. It refuses a sentence that tells Claude to start an Orca worker, except in `independent-review.md`. A sentence that describes an Orca worker without telling Claude to start one passes. (2026-11-24, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `cstack/skills/resolve-issue/SKILL.md` have almost no margin left, because `cstack/test/skill-size.test.ts` counts them together. If you add a sentence to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The installed `cstack` 0.3.2 reads this switch in `dist/helper/start.js` of its package. The README on `main` says at line 79 that the switch left with the old commands, so the brief's line 63 refers to the README of 0.3.2. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-24, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-24, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-24, from the brief of the run)
- The executor starts the implementers, so it needs the same rules. When the main conversation starts the executor, it puts the three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes, word for word, in its prompt. (2026-11-24, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-24, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-24, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each refusal that the unit adds, the implementer breaks that rule in the code on purpose, for example by commenting out the check. A refusal is any new error message or exit code, not only a check of user input. The implementer breaks one refusal at a time, runs the test with a time limit, and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. When no test fails, it adds a test that does, and breaks the rule again. It never commits the break, and it never uses `git stash`. (2026-11-24, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-24, from the coordinator of the wave)
- The executor pastes the three guards above, word for word, into the prompt of every implementer that it starts. They come after the inputs that `cstack helper start` prints. They add to those inputs and do not replace them. (2026-11-24, from the coordinator of the wave)
- The executor writes in "Executor notes", for each unit, which refusals the implementer broke and which test failed for each. A unit with no refusal says so in one line. (2026-11-24, from the coordinator of the wave)
- The executor stops before the review phase and returns a needs-decision report when an implementer did not break a refusal of its unit. The user decides in the main conversation. (2026-11-24, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must do, or must not do, needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-24, from the brief of the run)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-24, from the brief of the run)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the brief of the run)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-24, from the brief of the run)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-24, from the brief of the run)
- `cstack helper wait` takes no `--plan`. The executor runs it only after the notification that the sub-agent finished, never while the sub-agent still runs. (2026-11-24, from the brief of the run)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-24, from the brief of the run)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-24, from the brief of the run)
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. (2026-11-24, from the brief of the run)
- A deliberate break of the code can make a test loop forever. Run each break with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`. If a vitest process of this worktree still runs after that, stop it. Never stop a process of another worktree. (2026-11-24, from the brief of the run)
- When the plan asks a test to check a message, the plan gives the exact words of that message. (2026-11-24, from the brief of the run)
- Before an implementer commits, it reads every line of `## Decisions` that names one of its files, and it checks that the code follows each one. (2026-11-24, from the brief of the run)
- When `## Decisions` fixes the text of a comment for another ticket, the document phase posts that text word for word. Before you post a comment again after an error of `cstack tracker comment`, read the ticket to see whether it is already there. (2026-11-24, from the brief of the run)
- A question for the user reaches a ticket only after the user saw it, word for word, in the main conversation. If a result of a sub-agent reaches the main conversation instead of the executor that started it, the main conversation sends it to the executor in a message. (2026-11-24, from the brief of the run)
- Several runs share this machine. The full `npm test` takes about 90 seconds, so give it a shell timeout above two minutes. If it fails on a 5-second timeout, run the failing test file alone before you conclude that the code is wrong. (2026-11-24, from the brief of the run)
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the brief of the run)
- Every stop of the skill goes to the user in the main conversation. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-24, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-24, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-24, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. Never read the private work data of the comparison runs or their session files. (2026-11-24, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-24, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-24, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-24, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-24, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-24, from the brief of the run)
- Follow the public text rule of `CLAUDE.md`. Never write an employer or client name, a work ticket key, a count from work retrospectives or a path from this machine, in files, commits, the pull request, ticket comments, this plan or the retrospective. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-24, from the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-24, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep every change of both sides, and push with a plain `git push`, without force. (2026-11-24, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-24, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-24, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-24, from the brief of the run)

## Architecture

The approach is locked by the answers of the question round. `readCalls()` links each sub-agent launch to the transcript whose meta file holds the id of that launch. `evaluateSteps()` then lets a launch prove the implementer line of a unit only when its transcript names that unit in a `cstack unit red`, `cstack unit green` or `cstack unit commit` call. The line names its unit. The escalation implementer is accepted for the same line. The audit command prints one more sentence on standard error when an implementer launch has no transcript. The two guides say that an implementer builds every unit, and that a check that changes no file goes inside a unit.

No new decision since the question round.

## Implementation units

### Unit 1: Link each sub-agent launch to its transcript
- Files: `cstack/src/audit/calls.ts`, `cstack/test/audit-calls.test.ts`
- Test: `cstack/test/audit-calls.test.ts`: a launch gets the index of the transcript whose meta file holds the id of its tool call. Also one case each for a transcript with no meta file, a meta file that is not valid JSON, and a meta file whose `toolUseId` is not a string: each links no launch and leaves `unreadableFiles` at 0. Also a case where two launches each get their own transcript.
- Minimum code: in `readCalls()`, keep the tool call id of each sub-agent launch while reading. For each file with `helper: true`, read the meta file next to it and keep its `toolUseId` when it is a string. After the loop, give each sub-agent launch the field `transcript` with the index of the file whose meta file holds its id. Add `transcript?: number` to the sub-agent member of the `Launch` type.
- Refactor: none
- Commit message: feat(cli): link each sub-agent launch to its transcript in cstack audit
- Depends on: none

### Unit 2: Tie the implementer line of each unit to the unit that the implementer built
- Files: `cstack/src/audit/evaluate.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: in a run where the transcript of the executor holds the calls of unit 2 and implementers with their own transcripts built units 1 and 3, the audit prints exactly `build: resolve-issue:implementer for unit 2: skipped`, and the lines of units 1 and 3 are done. Also these cases: unit 3, which has a `No test` line, run by an implementer whose transcript holds `cstack unit commit 3`, prints its line as done; a launch whose transcript names only unit 1 does not prove the line of unit 2; a launch of `general-purpose` whose transcript holds the calls of unit 2 does not prove its line; one implementer whose transcript holds the calls of units 1 and 2 proves only one of the two lines; the implementer line holds only its fixed text, its verdict, a time and a record, and never the `description` or the `agentType` of the meta file.
- Minimum code: in `nodesOf()`, a helper node with a unit gets the text `<helper> for unit <n>`. In `evaluateSteps()`, a helper node with a unit takes only a free launch whose `transcript` holds a call that matches `unit red <n>`, `unit green <n>` or `unit commit <n>` for its unit, with `matchesStep()`. Add a `WHY:` comment above that filter that names ADR-RQG-C, section "How the audit ties an implementer to its unit". Change the default run of `setup()` in the test file as the line of `## Decisions` about `setup()` says.
- Refactor: none
- Commit message: feat(cli): tie the implementer line of cstack audit to the unit that the implementer built
- Depends on: 1

### Unit 3: Accept the escalation implementer for the implementer line of a unit
- Files: `cstack/src/audit/evaluate.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: unit 2 was first given to an implementer whose transcript holds no call of unit 2, because it got stuck, and then to an escalation implementer whose transcript holds `cstack unit red 2`, `cstack unit green 2` and `cstack unit commit 2`. The audit prints `build: resolve-issue:implementer for unit 2` as done, with the time of the escalation launch, and prints no line that holds `implementer-escalation`.
- Minimum code: for the implementer step, the type filter of a launch also accepts `resolve-issue:implementer-escalation`.
- Refactor: none
- Commit message: feat(cli): accept the escalation implementer for the implementer line of a unit in cstack audit
- Depends on: 2

### Unit 4: Say when an implementer launch has no transcript
- Files: `cstack/src/commands/audit.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: a run where one implementer launch has no transcript prints the sentence of `## Decisions` on standard error, after every other sentence. Also these cases: no sentence when every implementer launch has its transcript; no sentence while the build phase is not over; a run where the sentence is printed but every printed line is done still exits with 0, because the sentence never changes the exit code.
- Minimum code: after the existing sentences on standard error, print the sentence when the build phase is over and a launch of type `resolve-issue:implementer` or `resolve-issue:implementer-escalation` has no `transcript` field.
- Refactor: none
- Commit message: feat(cli): say in cstack audit when an implementer launch has no transcript
- Depends on: 2

### Unit 5: Run every unit in an implementer, including a check
- Files: `cstack/guides/resolve-issue/build.md`, `cstack/guides/resolve-issue/plan.md`, `cstack/test/guides/every-unit-in-an-implementer.test.ts`
- Test: `cstack/test/guides/every-unit-in-an-implementer.test.ts`: step 3 of "Build the units" in the build guide holds the two new sentences of `## Decisions`, word for word, and still holds "Never build a unit yourself". The "Tests." bullet of the plan guide holds the three new sentences of `## Decisions`, word for word.
- Minimum code: add the sentences to the two guides, exactly as `## Decisions` gives them.
- Refactor: none
- Commit message: feat(skill): run every unit in an implementer, a unit with no test included
- Depends on: none

### Unit 6: Document how cstack audit ties an implementer to its unit
- Files: `README.md`, `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`
- No test: documentation only.
- Minimum code: in the `cstack audit` paragraph of `README.md`, say that a helper step for each unit prints `<phase>: <helper> for unit <n>`, how a launch proves the implementer line of a unit, that the escalation implementer also proves it, the new sentence on standard error, and the two limits: a transcript with no meta file, and a unit call that uses a shell variable in place of the number. In ADR-RQG-C, add the section "How the audit ties an implementer to its unit", and change the sentence about a launch of another type in the section "How the audit judges helper steps and conditions" so that it names this one exception. Change nothing else in ADR-RQG-C.
- Refactor: none
- Commit message: docs: document how cstack audit ties an implementer to its unit
- Depends on: 2, 3, 4

## Documentation duties

- The `cstack audit` paragraph of `README.md`: applies, written by unit 6.
- ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`): applies, written by unit 6. A new section "How the audit ties an implementer to its unit", and the sentence about a launch of another type.
- The `WHY:` comment that names ADR-RQG-C in `cstack/src/audit/evaluate.ts`: applies, written by unit 2.
- The `cstack audit` entry of `cstack/src/manifest.ts`: does not apply, because its usage, its flags and its exit codes stay the same.
- The implementer prompt `cstack/skills/resolve-issue/agents/implementer.md`: does not apply, because #103 rewrites it.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply, because no story and no acceptance criterion changes.
- The comment on this ticket, #108: applies, written in the document phase. It says that scope item 1 changed: a check that changes no file goes inside a unit.
- The comment on the dependent ticket #103: applies, written in the document phase. It says that the implementer line now names its unit, that it is proved through the transcript and its meta file, and that the implementer prompt was left for #103.

## Blocking questions

### Question 1: How the audit ties a launch to its unit
Today the audit counts the implementer launches, but it does not know which unit each launch was for. So it cannot name the unit that no implementer ran, and it can blame the wrong unit. Which evidence should tie an implementer launch to its unit? I recommend the transcript of the launched sub-agent. Claude Code writes a small file next to each sub-agent transcript that holds the id of the call that launched it. The audit would then look in that transcript for a `cstack unit red`, `cstack unit green` or `cstack unit commit` call that names the unit. The other choices are a unit number that the build guide asks the executor to write in a fixed form in the launch prompt, or a pairing by time, where each unit takes the last free launch before its first call.
- For: the user
- Answer: the user chose the recommendation. The audit ties an implementer launch to its unit through the transcript of the launched sub-agent, found by the `toolUseId` of its meta file, and through the `cstack unit red`, `cstack unit green` or `cstack unit commit` call in that transcript that names the unit. (the user, 2026-11-24)

### Question 2: What a unit with no test commits
The ticket says that the implementer of a unit with no test commits "when the unit changes a file". But `cstack next --done build` refuses a unit that has no commit and no `Blocked` line, and `cstack unit commit` refuses a unit with no changed file. So a check that changes no file can never close the build. I recommend that the plan guide never makes a check that changes no file into a unit of its own. The check goes into the unit whose code it checks, and the implementer runs it before the commit of that unit and gives the result in its report. A check of the whole build goes into the last unit. A second choice is a unit that writes the result of the check into a file of the repository, which adds noise to a public repository and could leak a path or a name from real data. A third choice keeps the ticket's words and leaves the gap, which a later ticket would fix in `cstack/src/phases.ts`, a file of another ticket of this wave.
- For: the user
- Answer: the user chose the recommendation. A check that changes no file is never a unit of its own. It goes into the unit whose code it checks, and the implementer runs it before the commit of that unit and gives the result in its report. A check of the whole build goes into the last unit. (the user, 2026-11-24)

## Review log

## Briefing

## Non-blocking questions

none

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-24, executor run 1: moved #108 to "in progress" with cstack tracker move. Started the build on the branch gambitl/audit-unit-implementer.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

Two decisions come before the plan. I will do the rest unless you say no.

**I need your answer before I plan**

**1. The audit ties an implementer launch to its unit through the transcript of that sub-agent.** Today the audit counts the launches without knowing which unit each one was for. With three units and two launches, it prints one skipped line with no unit number, and it can blame the wrong unit. Claude Code writes an `agent-<id>.meta.json` file next to each sub-agent transcript, with its type and the id of the call that launched it. The audit would look in that transcript for `cstack unit red`, `green` or `commit` with the unit number. I recommend it, because it proves that the implementer did the unit's work, not only that it was asked to. The weak spot is that Claude Code does not document this file, so an update can change it.

**2. A check that changes no file should not be a unit of its own.** The close of the build refuses a unit with no commit, and `cstack unit commit` refuses a unit with no changed file, so such a unit blocks the build. Writing the result into a file of the repository would fix that. I would rather have the plan guide put the check inside the unit whose code it checks, before its commit. When the check covers the whole build, it goes inside the last unit. A result file adds noise to a public repository, and the result of a check on real data can leak a path or a name there. This changes the words of scope item 1 of the ticket, so you decide.

**I will do this unless you say no**

- The line becomes `build: resolve-issue:implementer for unit <n>`, and the README paragraph follows. Accepted by default (the user, 2026-11-24).
- A launch of `resolve-issue:implementer-escalation` whose transcript names the unit also proves its line, as the ticket asks. ADR-RQG-C says today that a launch of another type never counts, so I add a short section to it. Accepted by default (the user, 2026-11-24).
- When an implementer transcript has no meta file, its unit stays skipped, and the audit says why in one sentence on standard error. Accepted by default (the user, 2026-11-24).
- The `description` field of the meta file is free text, so I add a test case that checks the audit never prints it. Accepted by default (the user, 2026-11-24).
- I leave the implementer prompt alone, because it is not on the file list and the ticket that wires the guards into the prompts (#103) rewrites it. Accepted by default (the user, 2026-11-24).

**I checked it myself**

The meta files of this run hold `agentType`, `toolUseId` and `description`. The two refusals of question 2 are in the code as quoted.

**Questions for other people that can wait**

For the coordinator: "May #108 add a short section to `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`? The audit will accept a launch of `resolve-issue:implementer-escalation` as proof of the implementer line of a unit, and the record says today that a launch of another type never counts. That file is not on the file list of #108."

Answer of the coordinator, 2026-11-24: yes, #108 may add that section. Change only the new section and the sentence about a launch of another type. Neither #101 nor #132 changes the record. The coordinator answered on its own, after the question was drafted, so the user sees the answer in the chat. It is a rule under `## Decisions`.

**Good to know**

- On the fixture of the first test, today's code already prints one skipped line with no unit number, so the test must check the exact line with "for unit 2" to fail first.
- The retrospectives already written keep the old line, and ADR-RQG-C says that `digest-retros` will read this format.

#### Details

How the audit ties a launch to its unit is blocking, because it decides what the audit code reads and what the tests build, and someone has to choose. The run can test the format but not the choice. The draft recommendation stands. `readCalls()` in `cstack/src/audit/calls.ts` (lines 27 to 35) keeps neither the tool call id of a launch nor anything about the unit, and `evaluateSteps()` in `cstack/src/audit/evaluate.ts` (lines 270 to 284) gives each implementer node the first free launch of the same type. So the bug of the ticket is real. I read the meta file of a sub-agent of this run: it holds `agentType`, `toolUseId`, `description`, `spawnDepth` and other keys. The fixture `cstack/test/fixtures/measure/basic/` also holds a meta file with `parentAgentId` and `spawnDepth: 2`, which is the shape of an implementer that the executor launched. I rejected the two other ties. A unit number written in a fixed form in the launch prompt depends on the executor writing it, and it only proves what the executor asked, not what the implementer did. A pairing by time breaks exactly in the case the ticket targets, where the executor works on a unit between two launches. If nobody decides, the plan cannot name the evidence and the first unit cannot be written. The risk is that the meta file is an undocumented file of Claude Code. A change of its name or keys would make every implementer line skipped. The stderr sentence below makes that visible instead of silent.

What a check that changes no file commits is blocking, because the answer changes the text of the plan guide and departs from the words of scope item 1, and only the user can change the ticket. I confirmed both refusals: `buildDone` in `cstack/src/phases.ts` (lines 74 to 77) and "Unit ${n} has no changed file." in `cstack/src/commands/unit-commit.ts` (line 129). I disagree with the draft recommendation, which asks a check unit to write its result into a file that the unit names. That file would be committed to a public repository, and a check on real data, such as a run of `cstack audit` or `cstack measure` on real session files, can print paths of this machine or private names. The public text rule of the conventions file forbids both. Naming the plan file on the `Files` line does not work either, because the executor edits the plan file during the build, and `cstack unit commit` would commit those edits under the unit's trailer. My recommendation is a sentence in the "Tests." or "Order." bullet of `cstack/guides/resolve-issue/plan.md`. It says that a check that changes no file is not a unit of its own. The check goes into the unit whose code it checks, as a step before that unit's commit. When it checks the whole build, it goes into the last unit. The implementer gives its result in its report. The build guide then says that the implementer runs every unit, with no exception for a unit with a `No test` line. This way every unit still has a commit, and an implementer still runs the check. It also needs no change to `cstack/src/phases.ts`, which another ticket of this wave changes. If nobody decides, the guides would keep a gap where a planned check unit can never close the build.

The text of the new line is non-blocking. `build: resolve-issue:implementer for unit <n>` names the unit, as the ticket asks for the evidence. The README paragraph of `cstack audit` (`README.md`, line 66) describes a helper line as `<phase>: <helper>` followed by a word, so it needs one sentence for this third shape. ADR-RQG-C, section "How the audit treats the phases that are not over", says that the line format is an interface that `digest-retros` will read. Retrospectives under `docs/retros/` already copy the old line `build: resolve-issue:implementer: done`. Nothing reads these lines by program today, so the change is safe, but a later digest will meet both shapes.

The escalation implementer is non-blocking for the work, with one wrinkle. ADR-RQG-C, section "How the audit judges helper steps and conditions", says that a launch of another type never counts, and that `each-stuck-unit` counts as false. Both stay locked. In the usual stuck path, the first implementer already ran `cstack unit red <n>`, so its own launch proves the line, and the escalation is not needed. The escalation matters only when the first implementer stopped before any call that names the unit. Accepting it then is what scope item 4 asks, but it is an exception to the record's rule, so the record needs a short section that says so. `docs/decisions/` is not on the file list of `## Decisions`, hence the question for the coordinator, which is non-blocking. If the coordinator says no, the code still follows the ticket and the record lags behind it.

The missing meta file is non-blocking. I keep the draft answer, a skipped line and a known limit in the README, and I add one sentence on standard error that starts with "cstack audit:" and says how many implementer transcripts had no meta file. The retro guide (`cstack/guides/resolve-issue/retro.md`, line 31) copies such sentences into the retrospective, so the reader learns why the lines are skipped. The audit can build the meta path from the transcript path inside `cstack/src/audit/`. `findRunFiles()` in `cstack/src/measure/sessions.ts` (line 124) lists only `.jsonl` files and is shared with `cstack measure`, and that file is not on the file list.

The privacy of the meta file is non-blocking. Its `description` is free text that the executor writes. The test file `cstack/test/audit.test.ts` already checks a marker in the launch description (line 1218 onward). A new case should put the same kind of marker in the meta file's `description` and check that the output never shows it, which serves the first negative criterion of US-1.

The implementer prompt is non-blocking, and the draft answer stands. `cstack/skills/resolve-issue/agents/implementer.md`, step 8, already sends a `No test` unit to `cstack unit commit`. With the check folded into a unit, the implementer reads the check in the unit text. The ticket that wires the three guards into the guides and prompts (#103) rewrites this prompt later.

The failing-first trap is a fact for the implementer of the audit unit. With units 1 to 3 and launches for units 1 and 3 only, today's code prints one line `build: resolve-issue:implementer: skipped` and exits with 1. A case that checks only the exit code, or only the word "skipped", passes before the change. It must check the exact line `build: resolve-issue:implementer for unit 2: skipped`, and the done lines of units 1 and 3.

Two facts did not earn a point above. When the harness cannot launch sub-agents, the build guide lets the executor build units itself, and the audit will then report every unit as skipped, which is the truth. A unit with a `No test` line is proved only by `cstack unit commit <n>` in its implementer transcript, so a blocked `No test` unit shows a skipped line.

I checked security and authorization, data model lock-in, scale and performance, operations and cost, and failure modes and rollback, and found nothing beyond the points above. The change reads one small file per transcript and adds no command, dependency or stored data.

### Open questions and answers

1. Blocking question 1, how the audit ties an implementer launch to its unit. Recommended answer: through the transcript of the launched sub-agent. I checked it on the session files of an earlier run of this repository: every sub-agent transcript `agent-<id>.jsonl` has an `agent-<id>.meta.json` next to it, with `agentType` and `toolUseId`. The `toolUseId` equals the id of the `Agent` call in the transcript of the executor. The implementer of unit 2 ran `cstack unit red 2`, `cstack unit green 2` and `cstack unit commit 2` in its own transcript. The `description` of its launch was "Implement unit 2", which is free text.
2. Blocking question 2, what a unit with no test commits. Recommended answer, changed after the review of the CTO advisor: a check that changes no file is never a unit of its own. It goes into the unit whose code it checks, before its commit, or into the last unit when it checks the whole build. The first draft recommended a file for the result of the check. I checked it in the code: `buildDone` refuses a unit with no commit and no `Blocked` line (`cstack/src/phases.ts`, lines 74 to 77), and `cstack unit commit` refuses "Unit ${n} has no changed file." (`cstack/src/commands/unit-commit.ts`, line 129).
3. Non-blocking: the text of the new line. Accepted by default (the user, 2026-11-24). Recommended answer: the implementer line of each unit names its unit, as `build: resolve-issue:implementer for unit <n>`, followed by its verdict as today. It replaces the line `build: resolve-issue:implementer`, which names no unit. A skipped line ends with `skipped`, so the evidence is the unit number in the text, as the ticket asks.
4. Non-blocking: the escalation implementer. Accepted by default (the user, 2026-11-24), and the coordinator allowed the new section of ADR-RQG-C. Recommended answer: a launch of `resolve-issue:implementer-escalation` proves the implementer line of a unit in the same way, when its transcript names that unit. The step `helper: resolve-issue:implementer-escalation | each-stuck-unit` stays unprinted, because ADR-RQG-C says that the condition `each-stuck-unit` counts as false for now.
5. Non-blocking: the implementer prompt. Accepted by default (the user, 2026-11-24). Recommended answer: leave `cstack/skills/resolve-issue/agents/implementer.md` unchanged, because it is not on the file list of this ticket. Its step 8 already sends a unit with no test straight to `cstack unit commit`. The plan guide makes the unit of a check say what to run and where to write the result, and the build guide says that an implementer runs that unit too.
6. Non-blocking: an implementer launch whose transcript has no meta file, or a unit whose calls use a shell variable in place of the number. Accepted by default (the user, 2026-11-24), with the change of the CTO advisor: the line of that unit is skipped, the audit says why in one sentence on standard error when an implementer transcript has no meta file, and the README lists both cases among the known limits of the audit.

### Architecture options
