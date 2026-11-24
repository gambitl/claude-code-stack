# Plan: #132 — R3-10: Refuse to close the independent review without its entry in the Review log

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/132
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/independent-review-check
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T13:43:23+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Make `cstack` refuse to close the independent review while the plan does not record what that review found.

- **What the title means**: The independent review is the phase where a fresh reviewer reads the whole branch before the pull request opens. The executor closes each phase with `cstack next --done <phase>`. The "Review log" is the section of the plan where the reviews write what they found.
- **Why we are doing it**: Since #107, the executor may close a phase in the same answer as its last edit. When that edit fails, the close still runs. The review phase is protected, because `cstack next --done review` refuses an empty "Review log". The independent review has no such check, so its close can pass even when its findings were never written.
- **For the user**: A pull request never opens without the findings of the independent review in its plan and its body.

**Goal.** This ticket gives the independent-review phase a check at its close, like the check of the review phase.

### Where things are today (read first)

* **The phase checks**: `cstack/src/phases.ts` → the review phase has `{ done: filled("Review log") }` (line 105). The independent-review phase has no check (line 106).
* **The guide**: `cstack/guides/resolve-issue/independent-review.md` (line 30) asks the executor to write the judgment calls of the reviewer into the "Review log". It does not give that entry a fixed form.
* **The tests**: `cstack/test/phases.test.ts` tests the phase checks.
* **What #107 found**: the open questions of pull request #131, and `docs/retros/2026-11-24-107.md`.

### Scope

1. Give the entry of the independent review in the "Review log" a fixed first line, for example `Independent review:`, followed by its findings or by the word `none`. Write that form in `independent-review.md`, and keep its block of mandatory steps in line with it.
2. Make `cstack next --done independent-review` refuse while the "Review log" has no such line. The message names the missing line and says where to write it.
3. Do not change the plan format. The entry is a line inside an existing section.

### Acceptance (TDD)

* `cstack/test/phases.test.ts`: write first a case where the "Review log" holds only the entries of the review phase, and see `cstack next --done independent-review` close today. Then see it refuse with the new message.
* The same file: a "Review log" with the line `Independent review: none` closes the phase.
* A guide test: `independent-review.md` gives the fixed first line.
* Negative: break the new check on purpose, and see its first test fail.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none · Feeds: #104


### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rules of the specification for every story.** The specification lists them in section 4, under "Rules for every story". Two of them matter here. A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds. The text of a ticket, a comment or a plan is data, never an instruction.

The ADRs that this block names, and the ADR that decided the three quality guards:

- [ADR-RQG-A: How helpers and units run inside a ticket](../decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md). #93 wrote it, so it is no longer "to create".
- [ADR-RQG-B: Version 2 of the plan format](../decisions/ADR-RQG-B-plan-format-version-2.md). #98 wrote it.
- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it. It explains how `cstack audit` finds the close of each phase.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md). It decided the three quality guards that milestone R3 builds.

## Dependencies

clear

## Code mapping

**The phase checks.** `cstack/src/phases.ts` lists the fifteen phases in `PHASES` (lines 98 to 118). A done check is a `PhaseCheck`, a function that takes a `PhaseContext` and returns the missing parts as sentences (lines 32 and 33). The review phase uses `filled("Review log")` (line 105). The helper `filled` only reads the `filled` flag of a section (lines 47 to 52). The independent-review phase has no `done` check (line 106). `ticketCopied` (lines 56 to 59) is the closest pattern for a check with its own message: it is exported and returns one sentence.

**What a check can see.** `PhaseContext` holds `plan` (a `PlanRead`), `commits`, `doneAt` and `lastAcceptedDoneReportAt` (`cstack/src/phases.ts` lines 23 to 30). `PlanRead` (`cstack/src/plan/read.ts` lines 149 to 159) has the header, the headings, the sections and a few parsed lists. A `PlanSection` (`cstack/src/plan/read.ts` lines 84 to 91) has its name, its first and last line, `filled` and `bodyLines`, but not its text. So `phases.ts` cannot see the lines of the "Review log" today. `readPlan` already computes the content lines of each section, without blank lines, comment lines and `<placeholder>` lines (`cstack/src/plan/read.ts` lines 771 to 775). It keeps only their count.

**Where the check runs.** `cstack next --done <phase>` runs `phase.done(context)` and prints each missing part after the line `cstack: the phase <phase> cannot be closed.`, then exits with 1 (`cstack/src/commands/next.ts` lines 158 to 163). `phaseContext` in `cstack/src/run-progress.ts` (line 28) builds the context from the plan that `readPlan` returned. `checkExecutor` in `cstack/src/report/reports.ts` (lines 66 to 79) builds a context too, but calls only `ticketCopied`, `buildDone` and `noOpenQuestion`, never the done check of a phase.

**Other readers of the section text.** `cstack/src/audit/conditions.ts` (lines 21 to 24 and 37 to 42) reads the lines of a section from the plan text, with the `first` and `last` lines of `PlanSection`. That module belongs to #108 in this wave, so this ticket does not touch it.

**The guide.** `cstack/guides/resolve-issue/independent-review.md` starts with its block of mandatory steps (lines 1 to 5): `action: check-the-settings-file`, `helper: resolve-issue:pr-reviewer` and the close command. "After the review" (lines 26 to 30) asks to write the judgment calls into the "Review log", with no fixed form. The close sentence (line 34) is checked word for word by `cstack/test/guides/executor-bookkeeping.test.ts` (lines 69 to 73). `cstack/test/guides/steps-blocks.test.ts` checks that each block reads, holds the close command, and that `cstack guide` prints the prose after it. An `action:` step must be one kebab-case id (`cstack/src/guide-steps.ts` line 71). The audit never prints an `action:` step, except the two big-decision steps that git proves (`cstack/src/audit/evaluate.ts` lines 96 to 99). So a new action step changes no audit output. `cstack/test/guides/helpers-are-sub-agents.test.ts` allows a sentence about Orca workers in this guide only.

**The tests that close the independent review today.** Two tests close the phase through `cstack next` and would break with a new check:
- `cstack/test/next.test.ts` (lines 298 to 309) closes every executor phase in turn on the fixture `cstack/test/fixtures/plans/ready-for-review.md`. Its "Review log" holds only `Text of the review log.` (line 87).
- `cstack/test/e2e/resolve-issue.test.ts` (lines 368 to 372) fills the "Review log" from `cstack/test/fixtures/e2e/sections/review-log.md`, which holds one sentence, then closes the review and the independent review.

Both fixtures need the new line. `ready-for-review.md` is also read by `cstack/test/run-state.test.ts`, `cstack/test/plan/read.test.ts` and `cstack/test/helpers/publish-env.ts`, so the code phase checks that one more line inside the "Review log" breaks none of them.

**The phase tests.** `cstack/test/phases.test.ts` builds a context with `readPlan` on a fixture of `cstack/test/fixtures/plans/` (lines 13 to 18). The fixture `approved.md` has an empty "Review log" (a comment only, lines 93 to 95). The fixtures are in format `cstack-plan/2`.

**Hand-built plans.** `cstack/test/audit-conditions.test.ts` (lines 13 to 18 and 102 to 106) builds `PlanSection` objects by hand, but casts them with `as unknown as PlanRead`. A new field on `PlanSection` does not break its type check.

**Governing decisions.** No `WHY:` or `DECISION:` comment sits in `phases.ts` or in the guide. ADR-RQG-B fixes the plan format version 2, and this ticket must not change it. ADR-RQG-C says that a change to a guide also updates its block of mandatory steps. Commit 99ea4c3 (#107) added the close "in the same answer as its last edit", which is the reason for this ticket.

**Risks.** `cstack/src/phases.ts` changed six times recently, always with `cstack/test/phases.test.ts`. `PlanSection` is read in `phases.ts`, `audit/conditions.ts` and `report/reports.ts`, so a new field must be additive. The guide of the review phase (`review.md`) also writes into the "Review log", so the fixed line must not appear by chance in what the review phase writes.

**The pull request body.** The open questions of pull request #131 asked this exact question. `docs/retros/2026-11-24-107.md` has no other finding about this check.

## Decisions

- `PlanSection` in `cstack/src/plan/read.ts` gets the field `contentLines: string[]`. It holds the content lines that `readPlan` already computes for each section (`cstack/src/plan/read.ts` lines 771 to 775): no blank line, no line of an HTML comment and no `<placeholder>` line. `filled` and `bodyLines` keep their meaning. (2026-11-24, the user's answer)
- `cstack/src/phases.ts` exports the check as a `PhaseCheck` named `independentReviewLogged`, and the phase `independent-review` of `PHASES` uses it as its `done` check. A `WHY:` comment above it says: `WHY: since #107 the executor may close a phase in the same answer as its last edit, so a failed edit of the Review log must not let the close pass (ticket #132).` (2026-11-24, accepted by the user)
- The new check reads the "Review log" only through that `contentLines` field. It never reads the plan text again. (2026-11-24, the user's answer)
- `independent-review.md` says that the word `none` means that the reviewer changed nothing and raised no judgment call. Otherwise the entry names the fixes of the reviewer, with their commits, and its judgment calls. The check does not test this meaning. (2026-11-24, accepted by the user)
- The new prose of `independent-review.md` goes before its section "End of the phase", and the close sentence of that section stays word for word, because `cstack/test/guides/executor-bookkeeping.test.ts` (lines 69 to 73) checks it. (2026-11-24, accepted by the user)
- The document phase posts a comment on the release ticket #104. The comment names the new refusal of `cstack next --done independent-review` and gives the exact line it expects, so that the release notes can list it. (2026-11-24, accepted by the user)
- This run uses the installed `cstack` 0.3.2, which does not have the new check. The executor still writes `Independent review:` as the first line of the entry of this run. (2026-11-24, accepted by the user)
- The entry of the independent review in the "Review log" is a line that starts with `Independent review:` at its first character, with this exact case. A line that starts with a dash, with spaces or with another form such as `Independent review (phase 8):` does not count. The rest of that line holds the word `none` or the first finding, or the findings follow on the lines below it. (2026-11-24, an assumption accepted by the user)
- `cstack next --done independent-review` refuses while no content line of the "Review log" starts with `Independent review:`. A line inside an HTML comment does not count. A line in another section of the plan does not count either. (2026-11-24, an assumption accepted by the user)
- The refusal is this text, word for word: `Review log has no line that starts with "Independent review:". Add that line to the Review log, followed by the findings of the independent review or by the word none.` `cstack next` prints it after its usual line `cstack: the phase independent-review cannot be closed.` and exits with 1 (`cstack/src/commands/next.ts` lines 158 to 163). (2026-11-24, an assumption accepted by the user)
- The block of mandatory steps of `cstack/guides/resolve-issue/independent-review.md` gets the step `action: write-independent-review-entry`, between `helper: resolve-issue:pr-reviewer` and the close command. The audit never prints an action step of this kind (`cstack/src/audit/evaluate.ts` lines 96 to 99), so its output does not change. (2026-11-24, an assumption accepted by the user)
- The fixtures `cstack/test/fixtures/plans/ready-for-review.md` and `cstack/test/fixtures/e2e/sections/review-log.md` get the line `Independent review: none` in the unit that adds the check. `cstack/test/next.test.ts` (lines 298 to 309) and `cstack/test/e2e/resolve-issue.test.ts` (lines 368 to 372) close the independent review with them, so they would fail without it. (2026-11-24, an assumption accepted by the user)
- The done report of the executor, `cstack publish`, the plan template and the README do not change. The ticket asks only for the close of the phase, and the README does not list the checks of the other phases either. (2026-11-24, an assumption accepted by the user)
- The three quality guards apply by hand in this run, because the installed `cstack` 0.3.2 does not have them yet. The next three lines are those guards. (2026-11-24, from the coordinator of the wave)
- **Each new test case fails first.** After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-24, from the coordinator of the wave)
- **A negative test proves its rule by breaking it.** For each refusal that the unit adds, the implementer breaks that rule in the code on purpose, for example by commenting out the check. A refusal is any new error message or exit code, not only a check of user input. The implementer breaks one refusal at a time, runs the test with a time limit, and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. When no test fails, it adds a test that does, and breaks the rule again. It never commits the break, and it never uses `git stash`. (2026-11-24, from the coordinator of the wave)
- **A fact in the plan names its source.** A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-24, from the coordinator of the wave)
- The executor pastes the three guards above, word for word, into the prompt of every implementer that it starts. They come after the inputs that `cstack helper start` prints, and they add to those inputs. (2026-11-24, from the brief of the run)
- The executor writes in "Executor notes", for each unit, which refusals the implementer broke and which test failed for each. A unit with no refusal says so in one line. (2026-11-24, from the brief of the run)
- When an implementer did not break a refusal of its unit, the executor stops before the review phase and returns a needs-decision report. The user decides in the main conversation. (2026-11-24, from the brief of the run)
- Each deliberate break runs its test with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`. A vitest process of this worktree that still runs after that is stopped. A process of another worktree is never stopped. (2026-11-24, from the brief of the run)
- Every helper starts with `CSTACK_ORCA_WORKERS=off` in front of `cstack helper start`. Nobody adds `--child-worktree`. The units run one at a time, in the order that `cstack unit order` prints. Nobody pipes `cstack helper start` or `cstack helper wait` into another command. `cstack helper wait` takes no `--plan`, and it runs only after the sub-agent has returned. (2026-11-24, from the brief of the run)
- This ticket changes only `cstack/src/phases.ts`, `cstack/src/plan/read.ts`, `cstack/guides/resolve-issue/independent-review.md` and their tests, including the two fixtures that close the independent review. The user approved `cstack/src/plan/read.ts` on 2026-11-24. #101 and #108 run in the same wave and own other files. A file of another ticket of the wave needs the coordinator's approval before anyone changes it. (2026-11-24, from the brief of the run)
- No change to the version in `cstack/package.json` or `cstack/package-lock.json`, and no new runtime dependency. (2026-11-24, from the brief of the run)
- The plan format does not change. The fixed first line of the entry of the independent review is a line inside the existing "Review log" section. A new section or a new header line of the plan is a blocking question for the user, and the coordinator is asked before it is planned. This plan file stays in format `cstack-plan/1`. Any plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `independent-review.md` starts with a block of mandatory steps that `cstack audit` reads. A change to the prose of that guide keeps that block in line with it. (2026-11-24, from the brief of the run)
- `cstack/test/guides/helpers-are-sub-agents.test.ts` refuses a sentence that tells Claude to start an Orca worker, except in `independent-review.md`. Text that describes an Orca worker without telling Claude to start one passes. (2026-11-24, from the brief of the run)
- `cstack/test/skill-size.test.ts` counts `cstack/guides/resolve-issue/ticket.md` with `SKILL.md`, and they have almost no margin left. A sentence added to either file needs words removed elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- When the plan asks a test to check a message, the plan gives the exact words of that message. (2026-11-24, from the brief of the run)
- A line of `## Decisions` that says how a function behaves, or what it must not do, needs a test case of its own. When the `Test` line of a unit lists several refusals, each refusal has its own test case. (2026-11-24, from the brief of the run)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of its unit. Before it commits, it reads every line of `## Decisions` that names one of its files, and it checks that the code follows each one. (2026-11-24, from the brief of the run)
- Nobody uses `git commit -a` for a fix. Code and documentation go in separate commits. A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the brief of the run)
- Nobody runs `npm install -g`, `npm link` or `cstack skills install`. To try the code of this branch, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js`. (2026-11-24, from the brief of the run)
- Nobody changes `.cstack/settings.json` in this branch, edits the frozen top-level `skills/` folder, or pushes a tag that starts with `v`. (2026-11-24, from the brief of the run)
- Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Nobody runs `cstack wave` for real. `git worktree add` runs only inside a temporary test repository. Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm`. (2026-11-24, from the brief of the run)
- Nobody installs Graphify or Repowise, calls a Jira or Linear connection, or runs `glab`. (2026-11-24, from the brief of the run)
- If the skill or `cstack` 0.3.2 does something wrong during the run, nobody patches it in place. The run works around it, tells the user, and writes it in the retrospective with the tag `[skill]`. (2026-11-24, from the brief of the run)
- The repository is public. No file, commit, pull request, ticket comment, plan or retrospective names an employer or a client, quotes a work ticket key, gives a count from work retrospectives, or contains a path from this machine. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-24, from the brief of the run)
- Before `cstack publish`, two checks must pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, `git log -p origin/main..HEAD` and the drafted pull request title and body go into a temporary file outside the repository, and `python3 -B scripts/private_names.py check <that file>` exits with 0. Nobody prints the private list. Also before `cstack publish`, `cstack plan status` shows every unit done or with a `- Blocked:` line. (2026-11-24, from the brief of the run)
- A question for the user reaches a ticket only after the user saw it, word for word, in the main conversation. When `## Decisions` fixes the text of a comment for another ticket, the document phase posts that text word for word. After an error from `cstack tracker comment`, read the ticket before posting again, because the comment may already be there. (2026-11-24, from the brief of the run)
- Nobody merges the pull request. The user merges it. After the pull request is open, the branch takes `origin/main` only when the coordinator asks, with a merge commit and a plain `git push`. Before a rebase or a merge is committed, every file that had a conflict is searched for a leftover conflict marker. Author dates stay as they are: never `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-24, from the brief of the run)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-24, from the brief of the run)
- If the full `npm test` fails on a 5-second timeout, run the failing test file alone before concluding that the code is wrong, because several runs share this machine. (2026-11-24, from the brief of the run)

## Architecture

The change is small. `PlanSection` gets one field with the content lines of its section, the independent-review phase gets one done check in `PHASES` that reads that field, and its guide gets the fixed first line. No new decision since the question round.

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

### Unit 1: Keep the content lines of each section of the plan
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`
- Test: `cstack/test/plan/read.test.ts`: one new case, "keeps the content lines of each section, without blank, comment and placeholder lines". It fails first because `PlanSection` has no `contentLines` field yet, so the value is `undefined`.
- Minimum code: Add `contentLines: string[]` to the interface `PlanSection` in `cstack/src/plan/read.ts`, with a short doc comment. In `readPlan`, store the array `contentLines` that the loop over the sections already computes (lines 771 to 775) on each section that it pushes.
- Refactor: None.
- Commit message: feat(cli): keep the content lines of each section of a plan
- Depends on: none

Write the case in the describe block "the sections of version 2" of `cstack/test/plan/read.test.ts`. Build the plan from the fixture `approved.md` in memory. Replace the text "## Review log\n\n<!-- later -->" with "## Review log\n\nFirst line.\n\n<!-- a comment -->\n<a placeholder>\n  Indented line.". Read it with `readPlan`. Check that the `contentLines` of the section "Review log" equal `["First line.", "  Indented line."]`, with the two spaces kept. This unit adds no refusal, so it has no deliberate break. Run `cstack/test/plan/read.test.ts`, `cstack/test/plan/full-example.test.ts` and `cstack/test/audit-conditions.test.ts` before the commit, and run `npm run typecheck` in `cstack/`.

### Unit 2: Refuse to close the independent review without its entry in the Review log
- Files: `cstack/src/phases.ts`, `cstack/test/phases.test.ts`, `cstack/test/fixtures/plans/ready-for-review.md`, `cstack/test/fixtures/e2e/sections/review-log.md`
- Test: `cstack/test/phases.test.ts`: six new cases in the describe block "the done checks and start conditions", listed below. The four refusal cases fail first because the independent-review phase has no `done` check, so the close passes with an empty list. The two passing cases fail first because they call `phase("independent-review").done!` directly, which throws while `done` is undefined.
- Minimum code: In `cstack/src/phases.ts`, export a `PhaseCheck` named `independentReviewLogged`, as `## Decisions` says. It takes the `contentLines` of the section "Review log" and returns an empty list when one of them starts with `Independent review:`. Otherwise it returns the one refusal of `## Decisions`, word for word. Give the phase `independent-review` in `PHASES` the option `{ done: independentReviewLogged }`. Add the line `Independent review: none` to the two fixtures, as `## Decisions` says.
- Refactor: None.
- Commit message: feat(cli): refuse to close the independent review without its entry in the Review log
- Depends on: 1

Build each plan from the fixture `approved.md` in memory, and replace the text "## Review log\n\n<!-- later -->" with "## Review log\n\n" followed by the lines of the case, joined with "\n". Call the check with `context(text)`. The refusal text is `MESSAGE` below, word for word: `Review log has no line that starts with "Independent review:". Add that line to the Review log, followed by the findings of the independent review or by the word none.` Write each case as its own `it()`:
1. "independent-review refuses a Review log that holds only the entries of the review phase": the lines are "The review found nothing to change.". The result of `phase("independent-review").done?.(context(text)) ?? []` equals `[MESSAGE]`. Today it is an empty list, which shows that the phase closes today.
2. "independent-review closes with the line Independent review: none": the lines are "The review found nothing to change.", "" and "Independent review: none". `phase("independent-review").done!(context(text))` equals `[]`.
3. "independent-review closes with the findings below the line": the lines are "The review found nothing to change.", "", "Independent review:" and "- Fixed the refusal message in commit abc1234.". `phase("independent-review").done!(context(text))` equals `[]`.
4. "independent-review refuses the older forms of the entry": the lines are "Independent review (phase 8): none" and "- Independent review: none". The result of `phase("independent-review").done?.(context(text)) ?? []` equals `[MESSAGE]`.
5. "independent-review does not count the line inside a comment": the lines are "The review found nothing to change." and "<!-- Independent review: none -->". The result equals `[MESSAGE]`, computed as in case 1.
6. "independent-review does not count the line in another section": the lines are "The review found nothing to change.", and the text also replaces "## Executor notes\n\n<!-- later -->" with "## Executor notes\n\nIndependent review: none". The result equals `[MESSAGE]`, computed as in case 1.

The deliberate break: make `independentReviewLogged` return an empty list instead of the refusal, run `perl -e 'alarm 300; exec @ARGV' npx vitest run test/phases.test.ts` in `cstack/`, and see cases 1, 4, 5 and 6 fail. Restore the code, and check that `git diff` shows nothing left from the break. Write the result in the report. Then run `cstack/test/next.test.ts`, `cstack/test/e2e/resolve-issue.test.ts`, `cstack/test/run-state.test.ts` and `cstack/test/plan/read.test.ts`, because they read the two fixtures that this unit changes.

### Unit 3: Give the entry of the independent review a fixed first line in its guide
- Files: `cstack/guides/resolve-issue/independent-review.md`, `cstack/test/guides/independent-review-entry.test.ts`
- Test: `cstack/test/guides/independent-review-entry.test.ts`: two cases, listed below. Both fail first because the guide has neither the sentences nor the new step yet.
- Minimum code: Change the block of mandatory steps and the sections "After the review" and "End of the phase" of `cstack/guides/resolve-issue/independent-review.md`, with the exact text below.
- Refactor: None.
- Commit message: feat(skill): give the entry of the independent review a fixed first line
- Depends on: 2

The new block of mandatory steps is, line for line:
```
<!-- mandatory steps
action: check-the-settings-file
helper: resolve-issue:pr-reviewer
action: write-independent-review-entry
command: cstack next --done independent-review --plan <plan file>
-->
```

The section "After the review" becomes this list, word for word:
```
1. Read its report.
2. If it changed code, run the commands of the `testCommands` setting again.
3. Write its entry into the "Review log". The first line of the entry starts with `Independent review:`, word for word.
4. When the reviewer changed nothing and raised no judgment call, that first line is `Independent review: none`. Otherwise, list each fix with its commit, and each judgment call, after `Independent review:`. You can write them on the same line or on the lines below. The judgment calls go into the pull request body.
```

The section "End of the phase" gets this sentence before its close sentence, which stays word for word: "`cstack next --done independent-review` refuses to close the phase while the \"Review log\" has no line that starts with `Independent review:`."

The new test file reads the guide from `../../guides/resolve-issue/independent-review.md`, as `cstack/test/guides/executor-bookkeeping.test.ts` does. Write each case as its own `it()`:
1. "independent-review.md gives the fixed first line of the entry": the guide contains the sentence "The first line of the entry starts with `Independent review:`, word for word.", the sentence "When the reviewer changed nothing and raised no judgment call, that first line is `Independent review: none`." and the sentence of "End of the phase" above.
2. "the block of mandatory steps writes the entry between the reviewer and the close": `readSteps` from `cstack/src/guide-steps.ts` reads the guide, and the steps, mapped to their kind and their value, equal in this order: the action `check-the-settings-file`, the helper `resolve-issue:pr-reviewer`, the action `write-independent-review-entry`, and the command `cstack next --done independent-review --plan <plan file>`. Read `cstack/src/guide-steps.ts` first to see the shape of a step.

This unit adds no refusal, so it has no deliberate break. Run `cstack/test/guides/` and `cstack/test/audit.test.ts` before the commit, because they read the guides and their blocks.

## Documentation duties

- Decision record: does not apply. The change adds one check and one line of a guide, and no structural decision.
- `WHY:` comment: applies, written in `cstack/src/phases.ts` above `independentReviewLogged` by unit 2.
- README: does not apply. The README lists the checks of the plan phase only, and the ticket does not ask for more.
- Specification page `docs/projects/refocus-and-quality-guards.md`: does not apply. It describes the stories and their criteria, and this ticket adds no story.
- Comment on the ticket #132: applies, written to a comment on #132.
- Comment on the release ticket #104: applies, written to a comment on #104, with the content that `## Decisions` gives.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Let the plan reader keep the lines of a section

The new check in `cstack/src/phases.ts` must read the lines of the "Review log". A check only receives the parsed plan, and the parsed plan keeps no text of a section (`cstack/src/plan/read.ts` lines 84 to 91). May this ticket add one field to `PlanSection` in `cstack/src/plan/read.ts`, which holds the content lines that `readPlan` already computes (lines 771 to 775)? That file is outside the three files that the brief gives this ticket, but no other ticket of this wave changes it. The other way is to pass the whole plan text in `PhaseContext`, which changes `cstack/src/run-progress.ts` and `cstack/src/report/reports.ts` instead. My recommendation is the new field in `read.ts`, because it is one line in one file, and a later check of a section can use it too.
- For: the user
- Answer: Yes, add the field in `cstack/src/plan/read.ts`. The user, in the conversation, 2026-11-24.

## Review log

Impact notes (phase review). `contentLines` is read only in `cstack/src/phases.ts` (`independentReviewLogged`) and in its test in `cstack/test/plan/read.test.ts`. No other code destructures `PlanSection`, so the new field is additive. The two fixtures that close the independent review, `cstack/test/fixtures/plans/ready-for-review.md` and `cstack/test/fixtures/e2e/sections/review-log.md`, got the new line, and the tests that read them passed in unit 2. The files that usually change with `cstack/src/phases.ts` are `cstack/test/phases.test.ts` (changed) and `cstack/src/plan/approval.ts` (not affected, it does not read the Review log). The guide `independent-review.md` keeps its block of mandatory steps in line with its prose, and its close sentence is unchanged. No `WHY:` or `DECISION:` comment or decision record conflicts with the change.

Four reviewers (phase review). Correctness: no problem. It ran the full `npm test` (106 files, 1842 tests) and `npm run typecheck`, and both passed. Security: no issue, because this is a local check that writes nothing. Conventions: no issue. Simplicity: nothing to cut. Two notes without a fix: a line inside a code fence counts as content, so a fenced `Independent review:` line would satisfy the check, and the plan already calls this harmless. The Decisions block says the line starts at its first character, and the code follows it. No code changed in this phase.

Independent review: none
The independent reviewer changed nothing and made no commit. Typecheck and the full `npm test` passed (106 files, 1842 tests), and its own deliberate break of the check made all six new cases fail. Judgment calls for the pull request body, none needing a fix: a bare `Independent review:` line with nothing after it also closes the phase, because the check proves the entry was started and does not test its meaning, as Decisions accepts. A line inside a code block would also pass, which is harmless. The plan template placeholder does not mention the fixed first line, and Decisions keep the template unchanged on purpose.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

None from the question round.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

Unit 1 adds no refusal, so it has no deliberate break.
Unit 2 adds one refusal, the message of `independentReviewLogged`. The implementer made the check return an empty list. Cases 1, 4, 5 and 6 of `cstack/test/phases.test.ts` failed, and the two closing cases passed. The code was restored and `git diff` showed only the intended change.
Unit 2 stumbled once: the first deliberate break did not disable the check, so the implementer restored the file and broke it again.
Unit 3 adds no refusal, so it has no deliberate break.

## Hand-off log

2026-11-24, executor, build phase: moved #132 to "in progress", built units 1, 2 and 3 one at a time with sub-agents (commits 1a2eb5b, c97f21a, 53c90f6), then went on to the next phases.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**May this ticket add one field to `PlanSection` in `cstack/src/plan/read.ts`?** The new check must read the lines of the "Review log". Today a check only receives the parsed plan, and the parsed plan keeps no text of a section. The other way passes the whole plan text through `PhaseContext`, and it touches `cstack/src/run-progress.ts` and `cstack/src/report/reports.ts` instead. Both ways go outside the files this ticket may change, and neither changes the plan format. I recommend the field in `read.ts`. It keeps lines that `readPlan` already computes and throws away, it is one file, and no other ticket of the wave touches it.

**I will do this unless you say no.**

- The entry is a line that starts exactly with `Independent review:`. Earlier plans of this repository wrote `Independent review (phase 8):` or `Independent review (pr-reviewer):`, and the check would refuse them. So the guide shows the line word for word, and the refusal says what to write. I keep the strict match, because one refusal corrects the habit at once.
- The guide says `none` only when the reviewer changed nothing and raised no judgment call. When it fixed code, the line names the fixes. Otherwise a `none` hides those fixes from the pull request body.
- The refusal text and the new step of the mandatory steps block stay as "Decisions" writes them.
- The two test fixtures that close the independent review get the line `Independent review: none`. The done report, `cstack publish`, the plan template and the README do not change.
- The comment I leave on the release ticket (#104) names the new refusal, so its release notes can list it.

**I checked it myself.**

- A new field on `PlanSection` reaches no printed output, and the tests compare sections with `toMatchObject`, so it breaks none of them.
- A refused close writes no time in the run state, and the audit reads that time for this phase. So a refused close followed by a good one counts once.

**Good to know.**

- This run uses the installed `cstack` 0.3.2, so the new check does not protect it. I will still write this run's entry in the new form.

#### Details

**The field on `PlanSection` (blocking, needs the user, cannot be answered by a test).** The check must see the text of the "Review log", and `PhaseContext` (`cstack/src/phases.ts` lines 23 to 30) carries only the parsed `PlanRead`. `PlanSection` (`cstack/src/plan/read.ts` lines 84 to 91) holds `name`, `first`, `last`, `filled` and `bodyLines`. `readPlan` already builds `contentLines` for each section (lines 771 to 775), without blank lines, comment lines and `<placeholder>` lines, and then keeps only its length. I recommend storing that array on `PlanSection`, for example as `contentLines: string[]`, and leaving `filled` and `bodyLines` as they are. The second option, the plan text in `PhaseContext`, changes `phaseContext` in `cstack/src/run-progress.ts` (line 28) and the context that `checkExecutor` builds in `cstack/src/report/reports.ts` (lines 66 to 79), so it touches two files instead of one, and every later check of a section would parse the text again. I rejected a third option, a special case in `cstack/src/commands/next.ts` like `factProblems` for the plan phase (line 159). It hides a phase rule outside `PHASES`, and it is also outside the allowed files. The field is additive: `phases.ts`, `audit/conditions.ts` and `report/reports.ts` read `PlanSection`, and none of them destructures it. `cstack/test/audit-conditions.test.ts` builds sections by hand but casts them with `as unknown as PlanRead`, so its type check does not break. No ticket of the wave changes `read.ts`: #108 owns `audit/conditions.ts`, and #101 works on `cstack unit commit` and the saved runs. No open pull request touches `read.ts` today. A new field on a parsed object is not a change of the plan format, so the coordinator of the wave does not need to be asked. If nobody decides, the plan cannot be drafted, because the check has no way to see the lines.

**The exact form of the entry (non-blocking).** The decision in "Decisions" keeps a strict start, `Independent review:` with this case and nothing between `review` and the colon. Earlier plans in `docs/plans/` show three other habits: `Independent review (pr-reviewer):`, `Independent review (2026-11-19):` and `Independent review (phase 8):`. An executor that follows that habit is refused once. The refusal text names the exact line, so the next try passes. I considered a looser match that allows a parenthesis, a list dash or bold markers before the colon. I rejected it, because each extra form needs its own test case under the rules of this run, and the strict form is easy to search for. The guide must show the line in backticks, word for word, and its test must check that. Lines inside a code fence count as content in `readPlan` (the comment at `cstack/src/plan/read.ts` line 186), so a fenced block that holds this line would also count. That is harmless here, and the plan does not need a rule for it.

**The meaning of `none` (non-blocking).** `cstack/guides/resolve-issue/independent-review.md` lines 28 to 30 ask the executor to update the "Review log" when the reviewer changed code, and to write its judgment calls there. `cstack/guides/resolve-issue/ready.md` line 17 then copies the judgment calls of the independent review into the pull request body. If the guide only says "the findings or `none`", an executor may write `none` after a review that fixed code but raised no judgment call. The fixes would then be missing from the line that the pull request body is built from. The guide should say that `none` means the reviewer changed nothing and raised nothing, and that otherwise the line names the fixes, with their commits, and the judgment calls. This is guide prose only, and the check does not change. If nobody decides, the check still works, but the line can be misleading.

**The refusal text and the new step (non-blocking).** I keep the text written in "Decisions" and the step `action: write-independent-review-entry` between the helper step and the close command. The audit never prints this kind of action step (`cstack/src/audit/evaluate.ts` lines 96 to 99), and `cstack/test/audit.test.ts` line 1059 lists only the helper and command steps of this phase, so its expectations do not change. The close sentence on line 34 of the guide is checked word for word by `cstack/test/guides/executor-bookkeeping.test.ts` (lines 69 to 73). So the new prose goes before "End of the phase", and that sentence stays as it is.

**The fixtures and what does not change (non-blocking).** `cstack/test/next.test.ts` (lines 298 to 309) and `cstack/test/e2e/resolve-issue.test.ts` (lines 370 to 372) close the independent review and would fail, so their fixtures get the line in the unit that adds the check. `ready-for-review.md` is also read by `cstack/test/phases.test.ts` (line 158), `cstack/test/run-state.test.ts` (line 43), `cstack/test/plan/read.test.ts` (line 258) and `cstack/test/helpers/publish-env.ts` (line 7). None of them asserts the line numbers of the "Review log" or of a later section in that fixture: the line-number assertions of `read.test.ts` (line 130) use another fixture. The done report, `cstack publish`, the plan template and the README stay unchanged, as "Decisions" says.

**The comment on the release ticket (non-blocking).** This ticket feeds #104, which writes the release notes of 0.4.0. The document phase comments on every dependent ticket anyway. The comment should name the new refusal of `cstack next --done independent-review` and give the exact line it expects, so that the release notes can list a behaviour that a user's executor will meet. If nobody decides, the release notes may miss it, and a user sees the refusal without warning.

**What I checked.** `cstack plan status --json` prints only `{ units, problems }` (`cstack/src/commands/plan-status.ts` line 92), so no command prints a `PlanSection` as JSON. `cstack/test/plan/read.test.ts` compares sections with `toMatchObject`, which ignores a new field. Its line-ending test (line 463) compares the whole `readPlan` result for CRLF and LF text, and `readPlan` splits on `/\r?\n/` (line 703), so the stored lines carry no `\r` and that test keeps passing. For the executor phases, the audit reads `doneAt` from the run state (`cstack/src/audit/evaluate.ts` lines 58 to 62 and 214 to 218), and `cstack next --done` writes `doneAt` only after the check passes (`cstack/src/commands/next.ts` lines 159 to 168). So a refused close leaves no trace in the audit. The `review` setting has no value that turns the independent review off (`cstack/src/settings.ts` lines 64 and 306 to 318), so the new check never blocks a run that skips the phase on purpose.

**This run itself (non-blocking).** The run follows the installed `cstack` 0.3.2, as "Decisions" says, so its own close of the independent review is not checked. The executor should still write `Independent review:` as the first line of its entry, so that this plan follows the rule it adds.

I checked security, data model lock-in, scale, operations and cost, and reversibility, and found nothing that this ticket touches: the change is a local check and guide prose, with no new dependency and no stored format.

### Open questions and answers

1. **How does the check see the text of the "Review log"?** Blocking question 1. Recommended: add the content lines to `PlanSection` in `cstack/src/plan/read.ts`. The user chose this field on 2026-11-24.
2. **What exactly counts as the entry?** Non-blocking, with an obvious default from the ticket. The entry is a line of the "Review log" that starts with `Independent review:`, after any spaces. The rest of that line holds `none` or the first finding, or the findings follow on the lines below. The check looks only for the start of that line, with this exact case. A line in an HTML comment or in another section does not count. Recommended: this default. Written in "Decisions" as an assumption not asked. The user accepted it on 2026-11-24.
3. **What are the exact words of the refusal?** Non-blocking, because the ticket says what the message must say but not its words. Recommended: `Review log has no line that starts with "Independent review:". Add that line to the Review log, followed by the findings of the independent review or by the word none.` Written in "Decisions" as an assumption not asked. The user accepted it on 2026-11-24.
4. **Does the block of mandatory steps get a new step?** Non-blocking. Recommended: add `action: write-independent-review-entry` between the helper step and the close command, because the prose gets a new step and ADR-RQG-C keeps the block in line with the prose. The audit never prints an action step of this kind (`cstack/src/audit/evaluate.ts` lines 96 to 99), so its output does not change. Written in "Decisions" as an assumption not asked. The user accepted it on 2026-11-24.
5. **Should the done report of the executor, `cstack publish`, the plan template or the README also know the new line?** Non-blocking. Recommended: no. The ticket asks for the close of the phase only, and the README does not list the checks of the other phases either. Open, not needed for this ticket. The user accepted it on 2026-11-24.
6. **The two tests that close the independent review today.** Not a question: `cstack/test/next.test.ts` and `cstack/test/e2e/resolve-issue.test.ts` would fail with the new check, so their fixtures get the new line in the unit that adds the check. Written in "Decisions" as an assumption not asked.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
