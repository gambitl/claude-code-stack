# Plan: #98 — R3-1: Version 2 of the plan format

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/98
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/plan-format-v2
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T20:56:18+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Give the plan file of a run new places for facts with their sources, for changes to what the ticket fixed, and for the test cases and negative criteria of each unit, so that `cstack` can check them.

- **What the title means**: The plan file is the markdown file in which `resolve-issue` records everything about one ticket. It states its format version in its header, today `cstack-plan/1`. Version 2 adds new sections and new unit lines. A negative criterion is an acceptance criterion that says what must be refused, such as "the wrong role cannot delete the record".
- **Why we are doing it**: Three quality guards come next. Each one needs data that the plan does not hold today: the named test cases of a unit, the negative criteria it covers, the facts with their sources and the changes to what the ticket fixed. Changing the format once, for all three, avoids three format versions.
- **For the user**: The plan shows, in fixed places, every fact the run relies on and every test that proves a rule. Reviewers and `cstack` can then check them.

**Goal.** This ticket defines version 2 of the plan format, makes `cstack` read it, and records the choice in ADR-RQG-B. It adds no check yet: #100, #101 and #102 add the checks.

### Where things are today (read first)

* **The format version**: `cstack/src/plan/read.ts` → `PLAN_FORMAT = "cstack-plan/1"` (line 1) is the only definition. `stopOnFormat()` (lines 202 to 222) refuses a missing `Format:` line (line 209) and an unknown version (lines 213 to 220). Its message names the version from `Written by: cstack <v>`. `readPlan()` calls it at line 526.
* **The sections**: `SECTION_NAMES` (lines 18 to 35) fixes their order. `readPlan()` (lines 567 to 605) refuses an unknown `##` heading. `PlanSection` is at lines 78 to 85, and `PlanRead` at lines 118 to 125.
* **The units**: `PlanUnit` (lines 87 to 101) has `test?: {file, case}`, so a unit names only one test case today. `UNIT_FIELDS` (lines 287 to 297), `FIELD_LINE` (line 299), `readUnit()` (lines 301 to 411) and `readUnits()` (lines 413 to 451) parse them. The Test line is parsed at lines 377 to 388.
* **The blocking questions**: `BlockingQuestion` (lines 103 to 111) and `readQuestions()` (lines 453 to 500).
* **The template**: `cstack/skills/resolve-issue/templates/plan.md`. `Format: cstack-plan/1` is at line 3. The Ticket section is at line 20, with "Decisions already taken upstream" at line 24. The comment that describes a unit is at lines 46 to 58, and the blocking question shape at lines 66 to 71. There is no Facts section.
* **The negative criteria**: `cstack/guides/resolve-issue/ticket.md` (line 40) copies the ticket word for word under `## Ticket`. No code parses the negative criteria of a ticket today.
* **The version string elsewhere**: `cstack/test/template.test.ts` (line 28), `cstack/test/plan/read.test.ts` (line 41), `cstack/test/plan/worktree-line.test.ts` (line 24), every fixture under `cstack/test/fixtures/plans/` and the `plan.md` of the end-to-end fixtures.
* **The decision**: `docs/decisions/ADR-SIC-B-run-state.md` explains why the plan carries its own format version.

### Scope

1. Raise the format to `cstack-plan/2`. A plan in version 1 is refused, and the message names the version of `cstack` that reads it.
2. Add a `## Facts` section. Each line states one fact and its source. A source is either a file path, a line number and the short text quoted from that line, or "the user, on <YYYY-MM-DD>". Define the exact line form.
3. Add a section for the changes to what the ticket fixes. Each item names the change and the number of the blocking question that settles it. The section may say "none".
4. Add a `## Negative criteria` section. It numbers the negative criteria of the ticket, copied word for word. It may say "none".
5. Let a unit name several new test cases, instead of one. Let it name the negative criteria it covers, and for each one the test case that proves it.
6. Parse all of this into `PlanRead`. Refuse a line that is not in its fixed form, and name the line. Refuse a unit that names a negative criterion that does not exist.
7. Update the template, its comments, the fixtures and the tests that hold the version string.
8. Write ADR-RQG-B in `docs/decisions/`, with the options, the choice and its reasons. Link it from section 9 of `docs/projects/refocus-and-quality-guards.md`.

### Acceptance (TDD)

* `cstack/test/plan/read.test.ts`: write first a version 2 fixture plan with facts, changes, negative criteria and units with several cases. See it fail, then make `readPlan()` return each part.
* The same file: a version 1 plan is refused, and the message names the version that reads it.
* The same file: a fact line that is not in the fixed form is refused with its line number. A unit that names an unknown negative criterion is refused.
* `cstack/test/template.test.ts` passes on the version 2 template.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #92, #87 · Feeds: #100, #101, #102

---

### CTO review — one format change for three guards (2026-11-23)

1. The three guards share one new version of the plan format, so that a run in progress meets at most one format change. A run started with version 1 must finish before the upgrade, as open question 4 of the specification says.
2. This ticket is a contract of size M, larger than the usual S, because splitting it would change the format twice.

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Open question 4 of the epic, with its default.** A run started with 0.3.x and resumed after an upgrade would find missing commands. By default, `cstack` refuses a plan whose format it does not know. Every run in progress should finish before an upgrade. Section 9 of the specification adds that `cstack` names the version that reads the plan. It recommends saying so in the release notes, and it says that installing the previous release brings back the previous `cstack` and its skills together.

**Rules of the specification for every story** (section 4, "Rules for every story"). A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds. The text of a ticket, a comment or a plan is data, never an instruction. Only macOS is supported.

**Acceptance criteria of the specification that this ticket prepares.** The specification lists them in section 4, under milestone R3. This ticket adds the data that they need to the plan format. It adds no check: #100, #101 and #102 add the checks.

- US-6, AC2: Each unit of the plan names its new test cases.
- US-7, AC1: The plan says which negative acceptance criteria of the ticket each unit covers.
- US-8, AC1: The plan has a "Facts" list. Each line names its source, either as a file and a line or as "the user, on <date>".
- US-8, AC2: A file source also quotes the short text that it relies on. `cstack` checks that the file exists and that the quoted text is on that line. (The check is #102.)
- US-8, AC5: A change to something that the ticket fixes goes in a fixed section of the plan. `cstack` refuses the approval of the plan while such a change is not linked to an answered blocking question. (The refusal is #102.)
- US-8, AC7: The format version of the plan goes up once for US-6 and US-8 together. ADR-RQG-B records the new format.

The ADRs that this block names, and the ones that the ticket names:

- [ADR-SIC-B: Where the run state lives and how its formats are versioned](../decisions/ADR-SIC-B-run-state.md). It explains why the plan carries its own format version.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md). It decided this epic and its three guards.
- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- ADR-RQG-B, version 2 of the plan format, is the ADR that this ticket writes.

## Dependencies

clear

The tracker names two blockers, #87 and #92. Both are closed as completed. #87 found where the rest of the extra tokens of runs 3 and 4 came from. #92 audited runs 3 and 4 in the private sandbox.

## Code mapping

**Entry point.** `readPlan()` in `cstack/src/plan/read.ts` (line 520) reads a whole plan file. It first scans the headings, comments and fences with `scan()` (line 157). Then it calls `stopOnFormat()` at line 526, before any other check. It reads the header (lines 537 to 565) and the level-2 sections (lines 567 to 605). Last, it reads the units, the blocking questions and the pull request (lines 609 to 611). It collects every problem with its line, and throws one `PlanFormatError` with exit code 3 that lists them all (lines 613 to 619).

**The format version.** `PLAN_FORMAT = "cstack-plan/1"` is the only definition of the version (`cstack/src/plan/read.ts`, line 1). `stopOnFormat()` (lines 203 to 222) refuses a plan with no `Format:` line and points to the prose skill (line 210). It refuses any other version with "This plan file has the format <x>. This cstack reads <current>." and then names the reader (line 219). The reader comes only from the `Written by: cstack <v>` line (line 214). When that line says `not yet`, the message says "The file does not name the cstack version that can read it." (line 217). The comment at line 202 cites ADR-SIC-B.

**The sections.** `SECTION_NAMES` (lines 18 to 35) fixes the 16 level-2 sections and their order. `readPlan()` refuses an unknown `##` heading (line 576), a section out of order (line 583) and a missing section (line 603). A section is `filled` when it holds a line that is not blank, not a comment and not a `<placeholder>` (lines 588 to 597). `DONE_REPORT_SECTIONS` (lines 37 to 52) lists the sections that a done report of the executor needs filled. `checkExecutor()` in `cstack/src/report/reports.ts` (line 82) loops over it.

**The units.** `PlanUnit` (lines 87 to 101) has `test?: { file: string; case: string }`, so a unit names one test case today. `UNIT_FIELDS` (lines 287 to 297) fixes the order of the unit lines, and the first six are required (`REQUIRED_FIELDS = 6`, line 298). `FIELD_LINE` (line 299) matches a unit line. `readUnit()` (lines 301 to 411) refuses a repeated or out-of-order line (line 314), so no unit line can repeat today. A line that starts with two spaces continues the field above it (lines 331 to 334). The Test line must match `` `<file>`: <case> `` (line 379), and its file must appear in `Files` (line 384). `readUnits()` (lines 413 to 451) checks the numbering and the `Depends on` targets.

**The questions.** `BlockingQuestion` (lines 103 to 111) and `readQuestions()` (lines 453 to 500) read `### Question <n>: <a few words>` blocks with `- For:` and `- Answer:` lines. The section may hold the single word `none` (line 462). The numbering from 1 with no gap is checked at line 478. These give the pattern for the new numbered lists and for the word `none`.

**Who reads `PlanRead`.** `cstack/src/` calls `readPlan()` 15 times, among them in `next.ts` (line 139), `unit-test-command.ts` (line 76), `unit-commit.ts` (line 200), `publish.ts` (line 182), `audit.ts` (line 54) and `measure/moments.ts` (lines 66 and 81). Only three places read the Test line of a unit. `unit-test-command.ts` reads `unit.test.file` (line 109). `unit-commit.ts` (line 69), `report/reports.ts` (line 116) and `audit/evaluate.ts` (line 158) only check that `unit.test` exists. Nothing in `cstack/src/` reads `unit.test.case`. The only reader of `case` is the test `cstack/test/plan/read.test.ts` (line 137).

**The unit line writer.** `cstack/src/plan/unit-line.ts` writes the `- Worktree:` line as the last unit line. Its `ANY_FIELD` pattern (line 5) lists the unit line labels. A new unit line label needs to be added there, so that a Worktree line is never written above it.

**The template.** `cstack/skills/resolve-issue/templates/plan.md` holds `Format: cstack-plan/1` at line 3. The comment that describes a unit is at lines 46 to 58, with the Test line form at line 48. The shape of a blocking question is at lines 66 to 71. No guide and no agent prompt describes the `- Test:` line. Only the template does. `cstack/test/template.test.ts` checks that the template has the header keys and the sections of `SECTION_NAMES` in order (lines 17 to 24), and that `Format` equals `PLAN_FORMAT` (line 28). It also fills the header placeholders and checks that `readPlan()` accepts the template (lines 39 to 58). So every new section of the template must parse while it still holds only a placeholder or a comment.

**The fixtures and the tests that hold the version.** 25 fixtures in `cstack/test/fixtures/plans/` hold `Format: cstack-plan/1`. So do `cstack/test/fixtures/e2e/plan.md`, `cstack/test/fixtures/e2e-orca/plan.md` and `cstack/test/fixtures/audit/plan.md`. The fixture `format-2.md` holds `Format: cstack-plan/2` and `Written by: cstack 9.0.0`, to test the refusal of an unknown version (`cstack/test/plan/read.test.ts`, lines 26 to 31). In version 2 it becomes the known version, so this fixture needs another version. `cstack/test/plan/read.test.ts` (line 41) and `cstack/test/plan/worktree-line.test.ts` (line 24) expect `PLAN_FORMAT` to be `cstack-plan/1`. `cstack/test/e2e/resolve-issue.test.ts` (line 304) turns the e2e plan into `cstack-plan/2` to test the refusal of another format. In version 2 that line would build a valid plan, so it needs another version too.

**How the tests build plans.** Many tests build a plan from `approved.md` or `full.md`. `cstack/test/unit-order.test.ts` (lines 29 to 39) keeps the text before `## Implementation units` and the text from `## Documentation duties`, and writes its own units between them. `cstack/test/unit/collect.test.ts` (lines 18 to 28) does the same. Three test files write v1 Test lines of their own: `cstack/test/unit-red-green.test.ts` (line 31), `cstack/test/unit-commit.test.ts` (line 38) and `cstack/test/unit/collect-test-runs.test.ts` (line 22). The fixtures hold 32 v1 Test lines in 19 files. `cstack/test/plan/read.test.ts` checks many exact line numbers of the fixtures, such as unit 1 at line 37 (line 132), the Ticket section from line 15 to 27 (line 66) and the problems at lines 38 to 85 (lines 205 to 218).

**Version 1 plans outside a run.** `cstack measure` reads the header of a plan that has a `Format:` line with `readPlan()` (`cstack/src/measure/moments.ts`, line 66). On a `PlanFormatError` it stops with "the plan file is not a valid cstack plan file." (line 69). `cstack audit` does the same (`cstack/src/commands/audit.ts`, lines 54 to 57). The plans in `docs/plans/` and the plans of runs 3 and 4 are all in version 1. No test reads the real plans of `docs/plans/` with `readPlan()`.

**The negative criteria today.** `cstack/guides/resolve-issue/ticket.md` (line 40) copies the ticket word for word under `## Ticket`. No code reads the negative criteria of a ticket. `cstack/src/guide-steps.ts` (line 12) defines the condition `each-negative-criterion`, and no other file of `cstack/src/` uses it.

**The tickets that use this format next.** #100 checks the named test cases in `cstack unit red` and `cstack unit green`. It needs the list of cases of each unit, matched against a JUnit report. #101 adds a command that breaks a rule for a negative criterion `<k>` of a unit. It needs the criteria of each unit and the case that proves each one. #102 checks each fact line at approval: the file exists, the quoted text is on the line, and a user source has a date. It also checks that each change to what the ticket fixes names an answered blocking question. #103 changes the guides and agent prompts to fill the new sections.

**Recent changes and companions.** `cstack/src/plan/read.ts` changed in 8 commits. Five of them were fixes or small additions to the unit lines (`799c9c0`, `3b5bec2`, `1d9f2c9`, `b9ec93d`, `1830283`). Its usual companions are `cstack/test/plan/read.test.ts`, `cstack/test/plan/worktree-line.test.ts`, the plan fixtures and `cstack/test/template.test.ts`. The template changed last in `60004c2`.

**Risks.** The plan reader has 15 calls in the code, so a change to a required section or a required unit line breaks every test that builds a plan. A new section placed between `## Implementation units` and `## Documentation duties` would be lost by the tests that cut a plan there. A required change to the Test line would touch the three test files above, which belong to the commands of other tickets. Moving every fixture to version 2 shifts no line when only the `Format:` line changes, but each new required section shifts the lines below it. After version 2, `cstack measure` and `cstack audit` refuse every version 1 plan, including the plans of runs 3 and 4.

**Governing decisions.** ADR-SIC-B (`docs/decisions/ADR-SIC-B-run-state.md`, lines 27 to 31) says that the plan carries its format version, and that a `cstack` that meets an unknown format refuses it with exit code 3. The message names the format it reads and, when the file says it, the version that can read the file. Open question 4 of the specification (`docs/projects/refocus-and-quality-guards.md`, section 9) says that `cstack` refuses a plan whose format it does not know and names the version that reads it. The ADR candidate of section 9 says that the design chose a fixed "Facts" list that `cstack` checks, plus the named test cases of US-6. The only `WHY:` comment in the files to change is at `cstack/src/plan/read.ts`, line 202, and it cites ADR-SIC-B.

## Decisions

- The plan file of this run stays in format `cstack-plan/1`, because this run uses the installed `cstack` 0.3.2, which writes and reads version 1. This branch never changes this plan file to version 2. Only the code, the template and the fixtures of this branch move to version 2. (2026-11-23, from the brief of the run)
- The refusal of a version 1 plan follows open question 4 of section 9 of the specification: its message names the version of `cstack` that reads that plan. (2026-11-23, from the brief of the run)
- This ticket works only in `cstack/src/plan/`, the plan template `cstack/skills/resolve-issue/templates/plan.md`, the plan fixtures and their tests, a new ADR-RQG-B in `docs/decisions/`, and section 9 of `docs/projects/refocus-and-quality-guards.md`. The plan file and the retrospective of this run are added too. (2026-11-23, from the brief of the run)
- Three other tickets of epic #84 run at the same time, each in its own worktree. #91 works in `cstack/guides/resolve-issue/retro.md`, the retrospective template, `cstack/src/commands/audit.ts`, the `cstack audit` paragraph of `README.md` and ADR-RQG-C. #99 works in `cstack/src/settings.ts`, `cstack/src/test-run.ts`, a new module for the test report, their tests and a new paragraph of `README.md`. #114 works in `cstack/src/commands/publish.ts`, `cstack/src/phases.ts`, the publish tests, `cstack/guides/resolve-issue/publish.md` and the `cstack publish` paragraph of `README.md`. Never change a file of these tickets. When this ticket needs one, ask the coordinator first. (2026-11-23, from the brief of the run)
- In `cstack/src/manifest.ts` and `README.md`, change only the entry and the paragraph of this ticket's own command or option. Never change the version in `cstack/package.json` or `cstack/package-lock.json`, and never add a runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- `cstack/test/skill-size.test.ts` counts `cstack/guides/resolve-issue/ticket.md` together with `SKILL.md`, and it has almost no margin left. When a sentence is added to `ticket.md`, remove words elsewhere in the same file or in `SKILL.md`. (2026-11-23, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 64 (`README.md`, line 64: "If you set `CSTACK_ORCA_WORKERS=off`"). The brief says line 63, but the switch is on line 64 in this branch. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-23, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-23, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-23, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. The main conversation puts those three rules, word for word, in the prompt of the executor. (2026-11-23, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-23, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-23, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-23, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-23, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-23, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must not do needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-23, from the retrospective of #86, `docs/retros/2026-11-23-86.md`)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-23, from the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-23, from the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-23, from the retrospective of #86)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-23, from the retrospective of #89, `docs/retros/2026-11-23-89.md`)
- `cstack helper wait` takes no `--plan`. Run it only after the sub-agent has returned. (2026-11-23, from the retrospective of #89)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-23, from the retrospective of #89)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-23, from the retrospective of #89)
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. `cstack publish` does not check it yet. (2026-11-23, from the retrospective of #89)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-23, from the brief of the run)
- The coordinator of the wave is asked only about coordination, for example when this ticket needs a file of another ticket of the wave. (2026-11-23, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-23, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-23, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. Never read the private work data of the comparison runs or their session files. (2026-11-23, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-23, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-23, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-23, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-23, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-23, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-23, from the conventions file and the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-23, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep both changes, and push with a plain `git push`, without force. (2026-11-23, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-23, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-23, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-23, from the brief of the run)
- This ticket adds no check of the new data. `DONE_REPORT_SECTIONS` (`cstack/src/plan/read.ts`, lines 37 to 52) stays as it is, so a done report never needs the new sections filled. No phase check changes, and `cstack/src/phases.ts` is not touched. (2026-11-23, assumption not asked, from the goal of the ticket)
- The three new sections are required headings in a version 2 plan, like every other section. A new section that holds only a placeholder or a comment reads as empty, with no problem, as the template test needs (`cstack/test/template.test.ts`, lines 39 to 58). (2026-11-23, assumption not asked)
- The format of the run state stays `cstack-run/1`. Only the plan format changes. (2026-11-23, assumption not asked)
- The reader checks the form of a fact line only. Whether the file exists, whether the quoted text is on that line, and whether the path leaves the repository are the checks of #102. (2026-11-23, assumption not asked, from the scope of #102)
- `README.md` has no paragraph about the plan format, so this ticket does not change it. (2026-11-23, assumption not asked, from `grep -n -i format README.md`)
- `cstack/src/plan/unit-line.ts` needs no change. `setUnitWorktree()` writes the Worktree line after the last unit line it finds (lines 25 to 40). A `- Negative criterion <k>:` line always comes before the required `- Minimum code:` line, so the last unit line is never a criterion line. (2026-11-23, decided in the plan, from `cstack/src/plan/unit-line.ts`, line 5: "const ANY_FIELD")
- This ticket may change one line of `cstack/src/commands/audit.ts`, a file of #91: the call `readPlan(planText)` at line 54 becomes the call with the option that accepts a version 1 plan. Change nothing else in that file. If #91 merges first, the update-branch phase takes its changes and keeps both sides. (2026-11-23, from the coordinator)
- The draft plan of #99 uses the default JUnit reporter of vitest, with no `titleTemplate` and no `ancestorSeparator`. Each testcase has `classname` set to the test file path relative to the vitest root, and `name` set to the titles of the `describe` blocks and the test title joined by ` > `. The plan of #99 is not approved yet, so this can still change. (2026-11-23, from the coordinator)
- The format version becomes `cstack-plan/2`. `PLAN_FORMAT` in `cstack/src/plan/read.ts` stays the only place that defines the current version. (2026-11-23, the user's answer)
- A version 2 plan has three new level-2 sections. `## Negative criteria` comes right after `## Ticket`. `## Facts` comes right after `## Code mapping`. `## Changes to what the ticket fixes` comes right after `## Blocking questions`. The full order is Ticket, Negative criteria, Dependencies, Code mapping, Facts, Decisions, Architecture, Implementation units, Documentation duties, Blocking questions, Changes to what the ticket fixes, Review log, Briefing, Non-blocking questions, Pull request, Documentation, Executor notes, Hand-off log, History. (2026-11-23, the user's answer)
- Each of the three new sections holds its lines, or the single word `none`, or only a placeholder or a comment. A placeholder or a comment reads as an empty list. The word `none` reads as an empty list too. The word `none` next to another line is refused on the line of `none`. Any other content line that is not in the fixed form is refused, and the problem names its line. (2026-11-23, the user's answer)
- A negative criterion line is `<k>. <the criterion, word for word>`, with `<k>` a number from 1. The criteria are numbered from 1 with no gap, and a number out of place is refused on its line. A criterion fits on one line. (2026-11-23, the user's answer)
- A fact line is ``- <the fact> Source: `<path>`, line <n>: "<the quoted text>"`` or `- <the fact> Source: the user, on <YYYY-MM-DD>`. `<n>` is a number from 1. The quoted text runs from the `"` after `line <n>: ` to the last `"` of the line, with no escaping, and it is not empty. The fact text is not empty. A fact names one line, never a range, and it fits on one line. Spaces at the end of a fact line are ignored. (2026-11-23, the user's answer)
- The reader finds the source of a fact at the first ` Source: ` of the line whose rest is a whole valid source. So a fact text may hold the word "Source:", and a quoted text may hold ` Source: `, as when a fact quotes a line of this reader. This replaces the rule "the source starts at the last ` Source: `", which breaks on such a quote. (2026-11-23, decided in the plan, refines the user's answer, and the user approved it at the approval gate)
- The path of a fact source goes through `pathProblem()` (`cstack/src/plan/read.ts`, line 270: "function pathProblem(path: string)"), so an absolute path, a `..` part or a `.git` part is refused when the plan is read. Whether the file exists and whether the quoted text is on that line stay the checks of #102. (2026-11-23, the user's answer, accepted by default)
- A user source holds a date in the form `YYYY-MM-DD`. The reader checks the form only. (2026-11-23, the user's answer)
- A change line is `- <the change> Blocking question: <n>`, with `<n>` a number from 1. The reader checks the form only. Whether question `<n>` exists and has an answer is the check of #102 at approval. (2026-11-23, the user's answer)
- A unit names each new test case on a Test line of its own: ``- Test: `<test file>`: <the case>``. A unit may have several Test lines, one after the other. All the Test lines of a unit name the same test file, and another file is refused on its line. The same case named twice in one unit is refused on the second line. A version 1 unit with one Test line stays valid. A line that starts with two spaces after a Test line continues the case of that line, as today. (2026-11-23, the user's answer)
- A case is written exactly as the JUnit report of the test names it. For vitest, that is the titles of the `describe` blocks and the title of the test, joined by ` > `. The template and ADR-RQG-B say so. The reader does not check this rule. (2026-11-23, the user's answer)
- A unit names each negative criterion that it covers with `- Negative criterion <k>: <the case that proves it>`. These lines come right after the Test lines and before `- Minimum code:`. A unit may have several of them. The reader refuses, each on its own line: a criterion `<k>` that is not in `## Negative criteria`, a case that is not one of the cases of the unit's Test lines, a Negative criterion line in a unit with a `- No test:` line, and the same `<k>` twice in one unit. (2026-11-23, the user's answer and the scope of the ticket)
- In the code, `PlanUnit.test` becomes `{ file: string; cases: string[] }` instead of `{ file: string; case: string }`. `PlanUnit` gets `negativeCriteria: { criterion: number; case: string }[]`, an empty list when the unit covers none. `PlanRead` gets `negativeCriteria: { number: number; line: number; text: string }[]`, `facts` and `ticketChanges`. A fact holds its plan line, its text and its source. A file source holds `kind: "file"`, `path`, `line` and `quote`. A user source holds `kind: "user"` and `date`. A change holds its plan line, its text and `question`, the number of its blocking question. (2026-11-23, the user's answer)
- This ticket adds no check that every negative criterion of the ticket is covered by a unit. (2026-11-23, the user's answer, accepted by default)
- This ticket does not wire the audit condition `each-negative-criterion` (`cstack/src/guide-steps.ts`, line 12: "\"each-negative-criterion\","). (2026-11-23, the user's answer, accepted by default)
- `readPlan(text, { acceptVersion1: true })` reads a plan in format `cstack-plan/1`. Under this option, the three new sections are not required. Every other rule is the rule of version 2. Without the option, `readPlan()` refuses a version 1 plan. (2026-11-23, the user's answer)
- Only two places pass `acceptVersion1`: both calls of `readPlan()` in `cstack/src/measure/moments.ts` (lines 66 and 81), and the call at `cstack/src/commands/audit.ts`, line 54. Every other caller of `readPlan()` stays as it is, so every other command refuses a version 1 plan. (2026-11-23, the user's answer)
- The refusal of a version 1 plan whose `Written by` line names a version reads exactly: "This plan file has the format cstack-plan/1. This cstack reads cstack-plan/2. cstack <version> can read it. To finish this run, install that release, then run `cstack skills install` again." (2026-11-23, the user's answer)
- The refusal of a version 1 plan whose `Written by` line holds `not yet`, or anything that is not `cstack <version>`, reads exactly: "This plan file has the format cstack-plan/1. This cstack reads cstack-plan/2. cstack 0.3.2 is the last version that reads cstack-plan/1. To finish this run, install that release, then run `cstack skills install` again." The version 0.3.2 is a constant of `cstack/src/plan/read.ts`. (2026-11-23, the user's answer)
- A plan of any other unknown format keeps today's message, with the new current version: "This plan file has the format <x>. This cstack reads cstack-plan/2." followed by "cstack <version> can read it." or "The file does not name the cstack version that can read it." It never names cstack 0.3.2. A plan with no `Format:` line keeps today's message too. All these refusals keep exit code 3. (2026-11-23, the user's answer)
- The plan of this run stays in version 1, so the `cstack` built from this branch refuses it with exit code 3. Never test the branch's build on this plan file. (2026-11-23, from the advisor's block)
- Every plan fixture moves to version 2 with the three new sections, except `cstack/test/fixtures/plans/no-format.md`, which keeps no `Format:` line. A fixture that tests one problem still holds only that problem. `format-2.md` becomes `format-3.md`, with `Format: cstack-plan/3` and `Written by: cstack 9.0.0`. A new fixture `version-1.md` is a valid version 1 plan written by `cstack 0.3.1`, with the sections of version 1 only. A new fixture `version-2.md` is the full version 2 example of the ticket, and it grows unit by unit. The fixture of the audit tests (`cstack/test/fixtures/audit/plan.md`) moves to version 2 too. (2026-11-23, decided in the plan)
- `cstack/test/measure.test.ts` (line 412) replaces the Format line of its plan to test an invalid plan. It must replace `Format: cstack-plan/2` after the move, or the case stops testing anything. `cstack/test/e2e/resolve-issue.test.ts` (line 304) builds a plan of another format to test the refusal of `cstack next`. It uses `cstack-plan/1` after the move, so it tests the refusal of a version 1 plan from end to end. (2026-11-23, decided in the plan)
- The new sections stay outside the part between `## Implementation units` and `## Documentation duties`, because tests cut that part out and write it again (`cstack/test/unit-order.test.ts`, line 30: "const head = approved.slice(0, approved.indexOf(\"## Implementation units\"));"). (2026-11-23, decided in the plan)

## Architecture

The approach is locked by the answers of the question round. All the parsing stays in `cstack/src/plan/read.ts`, next to the reading of the blocking questions, which already reads a numbered list and the word `none`. `readPlan()` reads the three new sections into `PlanRead`, and `readUnit()` learns several Test lines and the Negative criterion lines. One option of `readPlan()` lets `cstack measure` and `cstack audit` read a version 1 plan. The first unit changes the version, the sections and every fixture at once, so the line numbers of the fixtures move only once. The later units add one part of the format each, and the template and the decision record come last.

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

### Unit 1: Raise the plan format to version 2 and refuse a version 1 plan
- Files: `cstack/src/plan/read.ts`, `cstack/skills/resolve-issue/templates/plan.md`, `cstack/test/plan/read.test.ts`, `cstack/test/plan/worktree-line.test.ts`, `cstack/test/template.test.ts`, `cstack/test/measure.test.ts`, `cstack/test/next.test.ts`, `cstack/test/e2e/resolve-issue.test.ts`, `cstack/test/fixtures/e2e/plan.md`, `cstack/test/fixtures/e2e-orca/plan.md`, `cstack/test/fixtures/audit/plan.md`, `cstack/test/fixtures/plans/approved.md`, `cstack/test/fixtures/plans/bad-approved-at.md`, `cstack/test/fixtures/plans/depends-missing.md`, `cstack/test/fixtures/plans/fence-never-closes.md`, `cstack/test/fixtures/plans/format-2.md`, `cstack/test/fixtures/plans/format-3.md`, `cstack/test/fixtures/plans/full.md`, `cstack/test/fixtures/plans/path-absolute.md`, `cstack/test/fixtures/plans/path-dash.md`, `cstack/test/fixtures/plans/path-dollar.md`, `cstack/test/fixtures/plans/path-dotdot.md`, `cstack/test/fixtures/plans/path-dotgit.md`, `cstack/test/fixtures/plans/path-semicolon.md`, `cstack/test/fixtures/plans/path-space.md`, `cstack/test/fixtures/plans/placeholder-value.md`, `cstack/test/fixtures/plans/pr-no-block.md`, `cstack/test/fixtures/plans/question-no-answer.md`, `cstack/test/fixtures/plans/question-none-with-question.md`, `cstack/test/fixtures/plans/ready-for-review.md`, `cstack/test/fixtures/plans/sections-wrong-order.md`, `cstack/test/fixtures/plans/target-branch-option.md`, `cstack/test/fixtures/plans/ticket-heading-level-2.md`, `cstack/test/fixtures/plans/ticket-with-code-block.md`, `cstack/test/fixtures/plans/unit-gap.md`, `cstack/test/fixtures/plans/unit-no-test.md`, `cstack/test/fixtures/plans/unit-test-not-in-files.md`, `cstack/test/fixtures/plans/unknown-status.md`, `cstack/test/fixtures/plans/version-1.md`, `cstack/test/fixtures/plans/version-2.md`
- Test: `cstack/test/plan/read.test.ts`: the cases "exports the format name" (now `cstack-plan/2`), "refuses a version 1 plan and names the version that wrote it, with the two steps to go back", "refuses a version 1 plan that was never registered and names cstack 0.3.2", "refuses another unknown version and names the cstack that can read it" (with `format-3.md`), "never names cstack 0.3.2 for another unknown version that was never registered", "refuses a file with no Format line" (now names `cstack-plan/2`), "gives the range and the filled flag of every section" (with the three new sections), one case for each new section that a version 2 plan refuses when it is missing, and "reads the version 2 example" (`version-2.md`, with its three new sections filled and one Test line per unit)
- Minimum code: Set `PLAN_FORMAT` to `cstack-plan/2`. Add the three new names to `SECTION_NAMES` at their places. Add a constant for the last version that reads `cstack-plan/1`, which is `0.3.2`. In `stopOnFormat()`, give a version 1 plan the two exact messages of the decisions, and keep today's message for any other unknown format. Do not parse the content of the new sections yet. In the template, write `Format: cstack-plan/2` and add the three headings at their places, each with a one-line placeholder. Move every fixture listed above to version 2 with the three new sections, as the decisions say. Write `version-1.md`, `version-2.md` and `format-3.md`, and remove `format-2.md` with `git mv`. Update the line numbers that `read.test.ts` checks, the expected version in `worktree-line.test.ts` (line 24), the Format line that `measure.test.ts` replaces (line 412) and the Format line that `e2e/resolve-issue.test.ts` builds (line 304).
- Refactor: None, unless the two version 1 messages share one sentence builder.
- Commit message: `feat(cli): raise the plan format to version 2 and refuse a version 1 plan`
- Depends on: none
Write the fixtures and the test cases first, and run `cstack unit red 1` before you change `read.ts` or the template. The template is not a test file, so it changes after the red run. Run the full test command at the end of the unit, because many test files build plans from these fixtures. Fix any other test that checks a line number of a fixture, and add its file to this Files line in the plan file before you commit.

### Unit 2: Let cstack measure read a version 1 plan
- Files: `cstack/src/plan/read.ts`, `cstack/src/measure/moments.ts`, `cstack/test/measure.test.ts`
- Test: `cstack/test/measure.test.ts`: "reads both moments from the header of a cstack-plan/1 plan that cstack 0.3.1 wrote" (it measures `cstack/test/fixtures/plans/version-1.md` with its Approved at and Ready for review at times, and expects the minutes line and exit code 0)
- Minimum code: Add the option `{ acceptVersion1?: boolean }` to `readPlan()`. Under it, `stopOnFormat()` accepts `cstack-plan/1`, and the three new sections are not required. Pass the option in both calls of `readPlan()` in `cstack/src/measure/moments.ts` (lines 66 and 81).
- Refactor: None.
- Commit message: `feat(cli): let cstack measure read a plan in format cstack-plan/1`
- Depends on: 1

### Unit 3: Let cstack audit read a version 1 plan
- Files: `cstack/src/commands/audit.ts`, `cstack/test/audit-version-1.test.ts`
- Test: `cstack/test/audit-version-1.test.ts`: "reads a cstack-plan/1 plan and stops only because the plan has no run state" (an approved `version-1.md` committed in a temporary git repository; `cstack audit` exits with 3 and prints "this plan file has no run state, so cstack next never ran it.", never "the plan file is not a valid cstack plan file.")
- Minimum code: Change only the call `readPlan(planText)` at `cstack/src/commands/audit.ts`, line 54, to pass `{ acceptVersion1: true }`. Change nothing else in that file.
- Refactor: None.
- Commit message: `feat(cli): let cstack audit read a plan in format cstack-plan/1`
- Depends on: 2
The new test file keeps the audit tests of #91 out of this ticket's diff. It builds its repository by hand, as `cstack/test/helpers/plan-repo.ts` does.

### Unit 4: Let a unit name several test cases
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`, `cstack/test/fixtures/plans/version-2.md`
- Test: `cstack/test/plan/read.test.ts`: the cases "reads every Test line of a unit as one case of the same test file" (unit 1 of `version-2.md` gets a second Test line), "reads a unit with one Test line as a list of one case" (the existing case on `approved.md`, now with `cases`), "continues the case of a Test line on a line that starts with two spaces", "refuses a Test line that names another test file than the first one" and "refuses the same case named twice in one unit"
- Minimum code: Let `readUnit()` accept several consecutive Test lines, and store them as `test: { file, cases }`. Refuse another file and a repeated case, each on its own line. Keep every other rule of the unit lines.
- Refactor: Replace the fixed index `REQUIRED_FIELDS` and the check `slot >= 5` (`cstack/src/plan/read.ts`, lines 298 and 330) with a description of each unit line that says whether it is required and whether it repeats, if that makes unit 5 simpler.
- Commit message: `feat(cli): let a plan unit name several test cases`
- Depends on: 3

### Unit 5: Read the negative criteria and the units that cover them
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`, `cstack/test/fixtures/plans/version-2.md`
- Test: `cstack/test/plan/read.test.ts`: the cases "reads the numbered negative criteria", "reads the word none as no negative criterion", "refuses a criterion line that is not in the form <k>. <criterion>", "refuses a criterion whose number is out of place", "refuses the word none next to a criterion", "reads the criteria that a unit covers, with the case that proves each one", "refuses a unit that names a negative criterion that does not exist", "refuses a Negative criterion line whose case is not a case of the unit", "refuses a Negative criterion line in a unit with no test" and "refuses the same criterion twice in one unit"
- Minimum code: Read `## Negative criteria` into `PlanRead.negativeCriteria` before the units. Add the `- Negative criterion <k>:` unit line after the Test lines, store it in `PlanUnit.negativeCriteria`, and apply the four refusals of the decisions.
- Refactor: None.
- Commit message: `feat(cli): read the negative criteria of a plan and the units that cover them`
- Depends on: 4
Each refusal has its own test case, and each one proves its rule by breaking it.

### Unit 6: Read the facts and their sources
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`, `cstack/test/fixtures/plans/version-2.md`
- Test: `cstack/test/plan/read.test.ts`: the cases "reads a fact with a file source, its line and its quoted text", "reads a fact with a user source and its date", "reads the word none as no fact", "reads a quoted text that holds Source: and double quotes", one refused case for each of these fact lines (a line with no source, a file source with no quoted text, a source line number of 0, a user source with no date, a user date that is not YYYY-MM-DD, an absolute source path, a source path with a `..` part), each checked at its line number, and "refuses the word none next to a fact"
- Minimum code: Read `## Facts` into `PlanRead.facts`, with the source rule of the decisions: the first ` Source: ` whose rest is a whole valid source. Check the path of a file source with `pathProblem()`.
- Refactor: Share the reading of "a list of lines or the word none" with unit 5, if it stays short.
- Commit message: `feat(cli): read the facts of a plan with their sources`
- Depends on: 5

### Unit 7: Read the changes to what the ticket fixes
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`, `cstack/test/fixtures/plans/version-2.md`
- Test: `cstack/test/plan/read.test.ts`: the cases "reads each change with the number of its blocking question", "reads the word none as no change", "refuses a change line with no blocking question number" (checked at its line number) and "refuses the word none next to a change"
- Minimum code: Read `## Changes to what the ticket fixes` into `PlanRead.ticketChanges`, in the form `- <the change> Blocking question: <n>`.
- Refactor: None.
- Commit message: `feat(cli): read the changes to what the ticket fixes`
- Depends on: 6

### Unit 8: Describe the version 2 lines in the plan template
- Files: `cstack/skills/resolve-issue/templates/plan.md`, `cstack/test/template.test.ts`
- Test: `cstack/test/template.test.ts`: "describes every line form of version 2 in its comments" (the template holds the fact line with a file source and with a user source, the change line, the negative criterion line, the Test line of one case, the Negative criterion unit line, and the rule that a case is written as the JUnit report names it)
- Minimum code: Write a comment under each new section that gives its line form, says that it may hold `none`, and says who fills it. Rewrite the unit comment (today at lines 46 to 58) for several Test lines and the Negative criterion lines. Keep every placeholder on one line, so that the template still reads as a plan.
- Refactor: None.
- Commit message: `docs(skill): describe the version 2 lines in the plan template`
- Depends on: 7

### Unit 9: Record the plan format in ADR-RQG-B and link it from the specification
- Files: `docs/decisions/ADR-RQG-B-plan-format-version-2.md`, `docs/projects/refocus-and-quality-guards.md`
- No test: The unit writes a decision record and changes one section of the specification. Both are prose.
- Minimum code: Write ADR-RQG-B in the shape of `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`: the context, the options for the facts, the test cases and the version 1 plans, the decision with every line form, the reasons and the consequences. Say that it replaces the line of ADR-SIC-B about `cstack-plan/1` (`docs/decisions/ADR-SIC-B-run-state.md`, line 29). In section 9 of the specification, say that #98 wrote ADR-RQG-B, with a link, as the line of ADR-RQG-C does. In open question 4, add that `cstack audit` and `cstack measure` still read a version 1 plan.
- Refactor: None.
- Commit message: `docs: record version 2 of the plan format in ADR-RQG-B`
- Depends on: 8

## Documentation duties

- The decision record ADR-RQG-B: applies, written to `docs/decisions/ADR-RQG-B-plan-format-version-2.md` by unit 9.
- Section 9 of the specification: applies, written to `docs/projects/refocus-and-quality-guards.md` by unit 9.
- The plan template and its comments: applies, written to `cstack/skills/resolve-issue/templates/plan.md` by units 1 and 8.
- The comment on this ticket: applies, written to #98 in the document phase.
- The comments on the tickets that use this format next: applies, written to #100, #101, #102 and #103 in the document phase. Each one gets the exact forms that it builds on.
- The release notes: does not apply to this ticket. The release ticket (#104) says to finish every run in progress before the upgrade, as open question 4 of the specification recommends. The comment on #104 reminds it.
- `README.md`: does not apply. It has no paragraph about the plan format, and the paragraph about `cstack measure` (line 89) stays true.
- The guides and the agent prompts: do not apply. #103 changes them to fill the new sections.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: The sections and line forms of version 2
The ticket asks this run to define the exact form of each new line. #100, #101, #102 and #103 will build on these forms. Do you accept them?
The three new sections are `## Negative criteria` right after `## Ticket`, `## Facts` right after `## Code mapping`, and `## Changes to what the ticket fixes` right after `## Blocking questions`. Each one holds its lines or the single word `none`, including `## Facts`.
A fact line is ``- <the fact> Source: `<path>`, line <n>: "<the quoted text>"``, or `- <the fact> Source: the user, on <YYYY-MM-DD>`.
A change line is `- <the change> Blocking question: <n>`.
A negative criterion line is `<k>. <the criterion, word for word>`, numbered from 1 with no gap.
A unit names each new test case on a Test line of its own, ``- Test: `<test file>`: <the case>``. All the Test lines of a unit name the same file. So a version 1 unit with one Test line stays valid.
A unit names each negative criterion that it covers with `- Negative criterion <k>: <the case that proves it>`, right after its Test lines. That case is one of the cases of its Test lines.
A case is written exactly as the JUnit report of the test names it. For vitest, that is the titles of the `describe` blocks and the title of the test, joined by ` > `. The template and ADR-RQG-B say so.
In the code, `PlanUnit.test` becomes `{ file, cases }` instead of `{ file, case }`. `PlanUnit` gets `negativeCriteria`, a list of `{ criterion, case }`. `PlanRead` gets `facts`, `ticketChanges` and `negativeCriteria`.
- For: the user
- Answer: Yes, as recommended, including the rule that a case is written exactly as the JUnit report names it. The user, in the conversation, 2026-11-23.

### Question 2: Version 1 plans in cstack audit and cstack measure
After this change, every command refuses a version 1 plan. That includes `cstack audit` and `cstack measure`, which read finished runs. US-9 audits runs 3 and 4 again, and their plans are in version 1. Should these two commands keep reading a version 1 plan, while every other command refuses it? If yes, this ticket also changes the call to `readPlan()` in `cstack/src/commands/audit.ts` (line 54), a file of #91, after asking the coordinator. If no, I propose a follow-up ticket before the release ticket #104.
- For: the user
- Answer: Yes, as recommended. `cstack audit` and `cstack measure` keep reading a version 1 plan, and every other command refuses it. The change to `cstack/src/commands/audit.ts` waits for the coordinator. The user, in the conversation, 2026-11-23.

### Question 3: The message that refuses a version 1 plan
Today the message names the reader only from the `Written by` line, and says nothing when that line holds `not yet` (`cstack/src/plan/read.ts`, lines 214 to 217). I propose this rule for a version 1 plan. When `Written by` names a version, the message keeps naming it, because the version that wrote a plan can always read it again. When `Written by` holds `not yet`, the message names cstack 0.3.2, the last version that reads cstack-plan/1. The message then gives the two steps to go back: install that release, then run `cstack skills install` again, as `README.md` says at line 31. A plan of another unknown version keeps today's message. Do you accept it?
- For: the user
- Answer: Yes, as recommended, with the two corrections of the advisor: keep the version that `Written by` names, name 0.3.2 only for `not yet`, and give the two steps to go back. The user, in the conversation, 2026-11-23.

## Review log

### Phase review

Impact notes. Only four places read `unit.test`: `cstack/src/unit-test-command.ts` (line 109), `cstack/src/audit/evaluate.ts` (line 158), `cstack/src/report/reports.ts` (line 116) and `cstack/src/commands/unit-commit.ts` (line 69). They check that it exists or read `.file`, and none reads the old `.case`. Twelve calls of `readPlan()` stay strict, so they refuse a version 1 plan. Only `cstack/src/measure/moments.ts` and `cstack/src/commands/audit.ts` pass `acceptVersion1`. `cstack/src/plan/unit-line.ts` needs no change, because a Negative criterion line always comes before `- Minimum code:`.

Findings of the four reviewers, and what was done.
- Correctness: a change line accepted `Blocking question: 0`. Fixed in 50d7743, with a new refused row in the test. The ADR said that the guides fill the new sections, which is not true yet. Fixed in f6a7b2c.
- Security: nothing at 80 or above. The fact paths go through `pathProblem()`, and the new patterns run fast on long lines.
- Conventions: nothing at 80 or above. Follow-ups: ADR-SIC-B line 29 has no pointer to ADR-RQG-B. The refusal message of a Test line in `read.ts` (line 446) still says `<failing case>`. The name `stopOnFormat` now also returns a boolean.
- Simplicity: follow-ups only. `stopOnFormat` could throw once, `readSource` could use one regex per source form, and `seen.add` could move into the last branch. None was done, because the first two would change exact messages.
- Follow-up: the message for a Negative criterion line in a unit whose Test line is malformed says that the unit has a `- No test:` line, which may mislead.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- "Who checks that every negative criterion of the ticket is covered by a unit? This ticket adds no such check. The plan check of #102 or the guides of #103 could add it." For the maintainer.
- "Who wires the audit condition `each-negative-criterion` to the new data? This ticket does not. The ticket that adds the break step to the guides (#103) uses it." For the maintainer.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

- `cstack unit red` and the full `npm test` hit the 5 second timeout of vitest under machine load in `wave/*`, `helper/*`, `unit-commit` and `e2e/no-orca`. Each file passed when run alone (units 2, 3, 4, 5, 6).
- Implementer of unit 6 did not break the "no source" and "user source with no date" refusals one by one, as the break rule asks. Their tests pass.
- Implementer of unit 4 skipped the optional refactor of `REQUIRED_FIELDS`. Unit 5 did not need it.
- The brief said the switch is at README line 63, but it is at line 64.

## Hand-off log

- 2026-11-23: The executor moved #98 to "in progress" with `cstack tracker move`, and started the build.
- 2026-11-24: The executor built units 1 to 9 one at a time with sub-agents, ran the four reviewers, and fixed two findings (50d7743, f6a7b2c).

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**1. The line forms of version 2 (question 1), with one more rule: what a test case name is.** I keep the proposal as it stands: three sections, one `- Test:` line per case, and one `- Negative criterion <k>:` line per covered criterion. One thing is missing, which is the exact string that "the case" holds. The ticket that checks the named cases (#100) will compare them with a JUnit report. Vitest 5.1.0 writes there the full name, with the `describe` titles and the test title joined by ` > `. If a plan holds only the title of the `it()`, nothing will match. I recommend writing in the template and in ADR-RQG-B that a case is written exactly as the JUnit report names it.

**2. `cstack audit` and `cstack measure` keep reading a version 1 plan (question 2).** Without this, the audit of runs 3 and 4 and the token and time measures of the comparison fail as soon as this merges. I recommend yes. I change `cstack/src/measure/moments.ts` myself. For `cstack/src/commands/audit.ts`, I ask the coordinator first, because the audit ticket (#91) works in that file.

**3. The message that refuses a version 1 plan (question 3), with two corrections.** When the `Written by` line names a version, I keep naming it, because the version that wrote a plan can always read it. I name 0.3.2 only for a plan that says `not yet`. Also, "installing its release brings back its skills too" is wrong. The README (line 31) says that you run `cstack skills install` again. The message will name both steps.

**I will do this unless you say no.**

- I read a fact line from its end: the last ` Source: `, then the quoted text up to the last `"` of the line, with no escaping. A fact quotes one line, never a range of lines. (Accepted by default, the user, 2026-11-23.)
- I check the path of a fact with the existing `pathProblem()` (`cstack/src/plan/read.ts`, lines 270 to 285). This repository is public, and this refuses an absolute path from a machine or a `..` as soon as the plan is read. Whether the file exists stays the job of #102. (Accepted by default, the user, 2026-11-23.)
- I add no check that every negative criterion is covered, and I do not wire the audit condition `each-negative-criterion`. The plan check (#102) and the guides (#103) do that. (Accepted by default, the user, 2026-11-23.)
- I leave ADR-SIC-B as it is. ADR-RQG-B says that it replaces its line about the format. (Accepted by default, the user, 2026-11-23.)

**I checked it myself.**

- Nothing in `cstack/src/` reads `unit.test.case`, so the move to a list of cases breaks no command.

**Questions for other people that can wait.**

For the coordinator of the wave: "Does the test report module of #99 set a JUnit `titleTemplate` or `ancestorSeparator` for vitest? The plan format of #98 says that a test case is written exactly as the JUnit report names it."

**Good to know.**

- The plan file of this run stays in version 1, so the `cstack` built on this branch refuses it with exit code 3. Do not try `node cstack/dist/bin.js` on it.
- `## Negative criteria` right after `## Ticket` shifts every line below it in the fixtures, and `cstack/test/plan/read.test.ts` checks many exact line numbers.

#### Details

The line forms of question 1 are blocking, and only the user can answer. I keep the drafted recommendation and add the rule for the case name. Vitest 5.1.0 (the `vitest` dependency of `cstack/package.json`, line 27) builds the JUnit `name` of a test case from the titles of its `describe` blocks and its own title, joined by `ancestorSeparator`, which defaults to ` > ` (`cstack/node_modules/vitest/dist/chunks/cli-api.COfZo8lK.js`, lines 10189 to 10203 and line 10403). It writes that full name unless a `titleTemplate` is set (same file, line 10315). The v1 Test lines hold prose, such as "the case 1 fails" in the fixtures, and nothing reads them, so this never mattered before. In version 2, #100 matches each case against the report. I rejected two other options. The first was the leaf title alone: it is ambiguous when two `describe` blocks hold a test of the same title, and #100 would have to rebuild the full name. The second was leaving the rule to #100: the guides of #103 and the check of #100 could then disagree, and plans written in between would hold names that never match. The rule "exactly as the JUnit report names it" stays neutral about the language, because pytest or another runner writes its own names. If nobody decides, the template keeps saying "the failing case it checks", and plan writers keep writing prose that #100 cannot match. Two smaller facts belong to this question. A unit keeps one test file, because `cstack/src/unit-test-command.ts` (line 109) runs only `unit.test.file`. `ANY_FIELD` in `cstack/src/plan/unit-line.ts` (line 5) needs a pattern such as `Negative criterion \d+`, not a fixed label. Otherwise a Worktree line lands above a criterion line, and `readUnit()` refuses the unit as out of order (`cstack/src/plan/read.ts`, lines 313 to 314).

Question 2, about `cstack audit` and `cstack measure`, is blocking, and only the user can answer. I agree with the drafted recommendation, and I add a second reason. `cstack/src/measure/moments.ts` (lines 63 to 69) reads the header of any plan that has a `Format:` line through `readPlan()`, and it stops on a `PlanFormatError`. After this ticket it would refuse every version 1 plan, including the plans of the comparison runs. The token and time results of that comparison are the only work figures this repository publishes. `cstack/src/measure/moments.ts` is not in the list of files of the other tickets of the wave (Decisions, the line about #91, #99 and #114), so this ticket can change it. `cstack/src/commands/audit.ts` (line 54) belongs to #91, so its one-line change waits for the coordinator. I prefer an option of `readPlan()`, such as a list of accepted formats, over a second reader, so that the two readers can never drift apart. If nobody decides, both commands refuse every older plan, and US-9 needs a build from before this ticket.

Question 3, about the refusal message, is blocking, and only the user can answer. I agree with its goal, but I disagree with two parts of the draft. Today's code names the reader from the `Written by` line (`cstack/src/plan/read.ts`, lines 213 to 220), and that is always exact, because the version that wrote a plan can read it. Writing 0.3.2 into the message of every version 1 plan would become wrong if a 0.3.x release were cut from `main` before this merges. So I keep the writer from `Written by`, and I use a constant `0.3.2` only when the line says `not yet`. The sentence "Installing its release brings back its skills too" contradicts `README.md`. Line 27 says that `cstack skills install` copies the skills, and line 31 says that going back to an older release needs that command again. The message says to install that release and then run `cstack skills install`. If nobody decides, the drafted message ships with a wrong instruction.

The fact line is read from its end, which is non-blocking. Its source starts at the last ` Source: ` of the line, and the quoted text runs from `: "` to the last `"` of the line, with no escaping. I rejected splitting on the first ` Source: `, because a fact may mention that word. I rejected escaped quotes, because a writer would forget them and #102 compares the raw text with the file. A fact names one line, as US-8 AC1 says ("a file and a line"). A range would make the check of #102 vague. Many lines of this plan cite ranges, such as "lines 37 to 52", so the guides of #103 must say to quote one line of the range. A fact has no continuation line.

The form of a fact path is checked by the reader, which is non-blocking. `pathProblem()` (`cstack/src/plan/read.ts`, lines 270 to 285) refuses a path that starts with `/`, a `..` part and a `.git` part, and its character set has no `~` (line 271). This moves one part of the assumption "the path leaves the repository is the check of #102" (Decisions) into this ticket. It is a check of the form only, and the function already exists. This repository is public, and a test already fails on a home folder path in `docs/plans/`. Refusing such a path at read time names the line much earlier. Whether the file exists and whether the quoted text is on the line stay the checks of #102. If nobody objects, I do it.

Draft questions 4 and 5 are non-blocking, and I leave them to later tickets. The coverage of every negative criterion is a check, so it belongs to #102 or #103. The audit condition `each-negative-criterion` is defined in `cstack/src/guide-steps.ts` (line 12) and wired by #103. The audit paragraph of `README.md` (line 54, a paragraph of #91) says that the audit "has no data for the criteria yet". After this ticket the format holds that data, but the audit still does not read it, so the sentence stays true and this ticket does not touch it.

Draft question 6 is non-blocking. ADR-SIC-B keeps the words of its time (`docs/decisions/ADR-SIC-B-run-state.md`, line 29), and ADR-RQG-B says that it replaces that line.

I checked that nothing in `cstack/src/` reads `unit.test.case`. The readers of `unit.test` are `cstack/src/unit-test-command.ts` (lines 92 and 109), `cstack/src/audit/evaluate.ts` (line 158), `cstack/src/report/reports.ts` (line 116) and `cstack/src/commands/unit-commit.ts` (line 69). They only check that the line exists or read its file.

The question for the coordinator is non-blocking, because the format rule stays true whatever the reporter settings are. Only the guides of #103 depend on the answer. Word for word, in English: "Does the test report module of #99 set a JUnit `titleTemplate` or `ancestorSeparator` for vitest? The plan format of #98 says that a test case is written exactly as the JUnit report names it."

This run's plan stays in version 1 (Decisions, first line). So the `cstack` built from this branch refuses it with exit code 3, and trying `node cstack/dist/bin.js` on this plan proves nothing. The new section right after `## Ticket` shifts the lines below it in every fixture, and `cstack/test/plan/read.test.ts` checks exact line numbers at lines 66, 132 and 205 to 218. The version change and the new sections are best done in the same unit, so the line numbers move once.

I checked scale and performance, operations and cost, and the user experience of the messages beyond question 3, and found nothing in them for this ticket.

### Open questions and answers

1. **The sections and line forms of version 2.** Blocking question 1. Recommended answer: yes, as written there. Repeating the Test line keeps the 32 Test lines of the fixtures and the Test lines of `cstack/test/unit-red-green.test.ts` (line 31), `cstack/test/unit-commit.test.ts` (line 38) and `cstack/test/unit/collect-test-runs.test.ts` (line 22) valid. Those three files belong to the commands of other tickets. A case name runs to the end of its line, so it needs no separator and no escaping. The other option was a ``- Test: `<file>` `` line followed by one `- Case: <case>` line per case. It reads a little better, but it changes every Test line of the tests and fixtures. The new sections stay outside the part between `## Implementation units` and `## Documentation duties`, which some tests cut out and write again (`cstack/test/unit-order.test.ts`, lines 29 to 39).
2. **Version 1 plans in `cstack audit` and `cstack measure`.** Blocking question 2. Recommended answer: yes. The reader then has one option that only these two commands pass. Under it, a version 1 plan is read with the version 1 rules: the three new sections are not required. With the Test line form of question 1, the rest of a version 1 plan already reads as version 2. Without it, the audit of runs 3 and 4 that US-9 needs would have to use a build from before this ticket.
3. **The message that refuses a version 1 plan.** Blocking question 3. Recommended answer: yes. The ticket and open question 4 of the specification ask that the message names the version that reads the plan. A version 1 plan that was never registered has `Written by: not yet`, and today's message names nobody for it.
4. **Who checks that every negative criterion of the ticket is covered by a unit?** Non-blocking: this ticket adds no check, and the format works whatever the answer. Recommended answer: the plan check of #102 or the guides of #103. Open, not needed for this ticket.
5. **The audit condition `each-negative-criterion`.** Non-blocking. `cstack/src/guide-steps.ts` (line 12) defines it, and the audit counts it as false until this ticket adds the data. Recommended answer: this ticket does not wire it. The ticket that adds the break step to the guides (#103) uses it. Open, not needed for this ticket.
6. **ADR-SIC-B still says that the plan starts with `Format: cstack-plan/1`** (`docs/decisions/ADR-SIC-B-run-state.md`, line 29). Non-blocking. Recommended answer: leave ADR-SIC-B as it is, because a decision record keeps the words of its time. ADR-RQG-B says that it replaces this line. I will do this unless you say no.
7. **How #99 names a test case in its report.** Non-blocking, for the coordinator of the wave: "Does the test report module of #99 set a JUnit `titleTemplate` or `ancestorSeparator` for vitest? The plan format of #98 says that a test case is written exactly as the JUnit report names it." Answer from the coordinator, on 2026-11-23: the draft plan of #99 sets neither and uses the default JUnit reporter of vitest. In vitest 5.1.0, each testcase has `classname` set to the test file path relative to the vitest root, and `name` set to the titles of the `describe` blocks and the test title joined by ` > `. The reader of #99 keeps these values after it decodes the XML entities. The plan of #99 is not approved yet, so this can still change, and the coordinator told #99 that this format relies on these names.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
