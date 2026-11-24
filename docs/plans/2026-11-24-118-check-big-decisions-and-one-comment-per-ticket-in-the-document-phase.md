# Plan: #118 — R3-9: Check big decisions and one comment per ticket in the document phase

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/118
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/document-big-decisions
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T07:47:28+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Let `cstack audit` check that a run recorded its big decisions, and make the document phase post one comment per dependent ticket, so that the audit can count them.

- **What the title means**: The document phase is the step of a run that writes down what happened, in the ticket, in the dependent tickets and in the documentation tool. A big decision is an architecture choice, or a decision that changed the design. Each one must become a decision record, which is a short page that explains one choice, and a `WHY:` comment in the code that names that record. The audit is `cstack audit`, which says which steps a run did or skipped.
- **Why we are doing it**: The block of mandatory steps of the document guide does not list the decision records or the `WHY:` comments, because no condition of the block format says "when the run has a big decision". So the audit cannot check them today. Also, in the run of #90, the document phase posted the comments of three dependent tickets in one shell loop. The audit saw one call, so two of the three lines showed as "skipped".
- **For the user**: The audit says whether a run recorded its big decisions, and it gives no false "skipped" in the document phase.

**Goal.** This ticket adds a condition for big decisions to the block format and to the audit, adds the matching steps to the block of the document guide, and makes that guide ask for one `cstack tracker comment` call per ticket.

### Where things are today (read first)

* **The document guide**: `cstack/guides/resolve-issue/document.md`. Its block (lines 1 to 6) lists the comment on the ticket, one comment per dependent ticket, and the places of the documentation. Line 26 defines a big decision. Line 28 asks for a `WHY:` comment next to the code. The guide does not say that each comment needs a call of its own.
* **The conditions**: `cstack/src/guide-steps.ts` → `CONDITIONS` (line 8) lists the seven conditions that a step can carry. A block with any other condition is refused (line 52).
* **How the audit reads them**: `cstack/src/audit/conditions.ts` → `readConditions()` (line 26) decides from the plan which conditions hold for a run.
* **The record of the choice**: `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md` (line 32) lists the seven conditions. Line 62 says that a block never lists a step for a condition that the format cannot say.
* **What the runs found**: the open questions of pull request #117, and `docs/retros/2026-11-23-90.md`. The notes on #90 explain the first question.

### Scope

1. Add a condition for a run that has a big decision, for example `big-decision`, to `CONDITIONS`, to the audit and to ADR-RQG-C. The question round decides what in the plan shows a big decision, for example a line of `## Decisions` that names a decision record.
2. Add to the block of `document.md` the steps that this condition makes mandatory: a decision record and a `WHY:` comment. Choose their kind in the question round. The kind `action` has no shell call to prove it, so prefer a step that the audit can check.
3. Make `document.md` say that each comment in the tracker is its own `cstack tracker comment` call, never a loop of the shell.
4. Keep the prose and the block of the guide in line with each other.

### Acceptance (TDD)

* The test of the conditions: write first a plan that names a decision record in `## Decisions`, and see the new condition hold. A plan with no big decision does not make it hold.
* The audit test: a run with a big decision and no decision record prints the new step as "skipped". A run with no big decision does not list it.
* The test of the blocks: the block of `document.md` uses the new condition, and the check of the blocks still passes.
* Negative: break the new condition on purpose, and see its first test fail.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #92 · Feeds: #103

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rule of the specification for every story.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

**Acceptance criteria of US-1 that this change must keep true.** The specification lists them in section 4, under "US-1: Audit the steps of a run". This ticket extends the audit that US-1 built, so these criteria still apply.

- AC6: The expected steps come from a block at the top of each phase guide that lists its mandatory steps. A CI test fails when a block names a command that does not exist. No second list of steps exists in the code.
- AC7: A step that the plan makes not applicable is not expected. For example, a ticket with no negative criterion has no "break the rule" step.
- AC (negative): The audit never prints, copies or sends the content of a session. It prints step names, verdicts and times only. A test checks this.

The ADRs that this block names:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create". This ticket changes it.
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

## Code mapping

**Entry points.**

- The list of conditions is `CONDITIONS` in `cstack/src/guide-steps.ts`, lines 8 to 16. `readSteps()` refuses any other condition at line 52, and its message lists every condition with `CONDITIONS.join(", ")` (line 53).
- The audit reads the conditions with `readConditions()` in `cstack/src/audit/conditions.ts`, lines 26 to 33. It returns the interface `Conditions` (lines 3 to 7), which has three fields today: `dependentTickets`, `userInterface` and `newStructuralDecision`. It reads only the plan text and the parsed plan, never a file.
- `cstack/src/commands/audit.ts` calls `readConditions(planText, plan)` at line 132. #98 changes that file in this wave, so this ticket does not touch it.
- `kindOf()` in `cstack/src/audit/evaluate.ts`, lines 94 to 103, decides which group a step joins, or leaves it out when its condition is false. Line 95 leaves out every `action` step. Lines 99 to 101 map the conditions `each-dependent-ticket`, `user-interface` and `new-structural-decision`. An unknown condition falls to `undefined` at line 102, so a new condition is left out until `kindOf()` names it.
- The audit already has one kind of proof from git. `otherEvidence()` (`evaluate.ts`, lines 196 to 210) proves `cstack unit commit <n>` with the time of the unit commit, which `commitTime()` (lines 176 to 188) finds with `listUnitCommits()`. The line then ends with the word `git` (`Evidence`, line 16).
- The block of the document guide is at lines 1 to 6 of `cstack/guides/resolve-issue/document.md`. It has two `command` steps for the tracker comments, one `action` step and the close of the phase. The section "Hand the context down" (line 22) says to post each dependent comment with `cstack tracker comment`, but it never says that each comment needs a call of its own. The section "Record every big decision" (lines 24 to 30) defines a big decision at line 26 and asks for the `WHY:` comment at line 28.

**Where a plan shows a big decision today.** The condition must come from a part of the plan that exists before the document phase. Otherwise a run that skipped the record would also skip the sign, and the audit would never print "skipped".

- `## Documentation duties` is written in the plan phase (`cstack/guides/resolve-issue/plan.md`, line 37). Each duty reads "applies, written to <place>" or "does not apply". In the 14 plans of `docs/plans/` dated from 2026-11-20 on, every duty about a decision record names the record before its first colon, and says "applies" or "does not apply" right after it. For example, #86 has "ADR-RQG-C: applies, written to `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md` by Unit 4", and #94 has "Architecture decision record: does not apply". The four plans whose duty says "applies" (#86, #88, #90 and #91) did write or extend ADR-RQG-C.
- `## Decisions` is a weak sign. Plans name an ADR there as a source very often. For example, the plan of #114 names an ADR six times in `## Decisions` and wrote no record: its duty says "A decision record in `docs/decisions/`: does not apply".
- The existing condition `new-structural-decision` holds when the plan lacks the sentence "No new decision since the question round" (`conditions.ts`, lines 9 and 31). The plan guide writes that sentence when the plan adds no structural decision after the question round (`plan.md`, line 25). So it says nothing about a big decision that the question round took, and it holds by default when the sentence is missing.

**Tests that this ticket touches.**

- `cstack/test/audit-conditions.test.ts` builds a `PlanRead` by hand (`planOf()`, line 9) and imports the module with a dynamic `import()` (line 4).
- `cstack/test/audit.test.ts`, the describe block that starts near line 850, runs the audit on the fixture plan `cstack/test/fixtures/audit/plan.md` with test guides. It has the helpers `run()`, `withFeeds()`, `withDesign()`, `withDecisionSentence()` and `only()`. The cases "prints a new-structural-decision step only when the plan lacks the sentence" (line 911) and "prints a user-interface step only when a unit has a design specification" (line 900) are the pattern for the new condition.
- `cstack/test/guide-steps.test.ts`, the case "accepts all seven conditions and the three kinds from the exported lists" (line 72), checks the exact list of `CONDITIONS`. It must change when a condition is added.
- `cstack/test/guides/steps-blocks.test.ts` reads the block of every real guide. `cstack/src/guide-steps.ts` also has `stepProblems()` (line 127), which a CI test runs on every block.
- `cstack/test/guides/tracker-writes.test.ts` cuts `document.md` at the headings "## Write back into the ticket", "## Hand the context down" and "## Record every big decision" (lines 11 and 12). Keep these headings.

**Documentation that lists the conditions.** ADR-RQG-C says "Only these seven are accepted" (line 32) and lists them at lines 34 to 40. Its line 86 says that the audit never prints a line for a step of the `action` kind, and its line 88 says how the audit treats each condition. The `cstack audit` paragraph of `README.md` (line 54) describes each condition too, and says that the audit never prints a step that only asks you to do something.

**Risks.**

- `cstack/src/audit/evaluate.ts` has 11 commits. Six of its last ten are fixes, and five of those change how a call is matched to a step or to its time window (for example `a4fb417`, `303264a` and `1be7d88`). `cstack/test/audit.test.ts` changed with it ten times. Keep the window logic as it is.
- #98 works in `cstack/src/plan/`, so the shape of `PlanRead` (`cstack/src/plan/read.ts`, line 118) may change in version 2. `readConditions()` uses `plan.sections` and `plan.units`. A condition that reads the plan text by section name needs to keep working on a version 1 plan, because `cstack audit` still reads version 1.
- The README paragraph of `cstack audit` is the only part of `README.md` that this ticket may change.

**Governing decisions.** ADR-RQG-C governs the block format, the conditions and how the audit treats them. The `WHY:` comment at `cstack/src/commands/audit.ts`, line 137, points to its section "How the audit treats the phases that are not over". No `WHY:` or `DECISION:` comment exists in `cstack/src/audit/` or in `cstack/src/guide-steps.ts`.

## Decisions

- A close condition already exists. The condition `new-structural-decision` (`cstack/src/guide-steps.ts`, line 15) holds when the plan does not hold the sentence "No new decision since the question round". ADR-RQG-C explains it at line 40. The plan guide uses it for the second look of the CTO advisor (`cstack/guides/resolve-issue/plan.md`, line 3). It is not the same thing as a big decision of the document guide. The question round says how the new condition differs from it, or proposes to reuse it, and the user chooses. (2026-11-24, from the brief of the run)
- The plan format belongs to #98, which is about to raise it to version 2. Base the new condition on lines that a plan already has, such as a line of `## Decisions` that names a decision record. If the question round wants a new line in the plan format, that changes the format of #98. Put it to the user as a blocking question, and ask the coordinator before you plan it. (2026-11-24, from the brief of the run)
- Two tickets of epic #84 start now, each in its own worktree and with its own pull request, and a third, #98, is near its end in another worktree. #93 works in the guides `plan.md`, `build.md`, `publish.md`, `ready.md` and `retro.md` of `cstack/guides/resolve-issue/`, in the agent prompts `executor.md`, `implementer.md` and `implementer-escalation.md`, in `cstack/skills/resolve-issue/SKILL.md`, in `cstack/test/guides/`, in `cstack/test/prompts.test.ts`, in a new ADR-RQG-A, in ADR-SIC-A and in section 9 of the specification. #98 works in `cstack/src/plan/`, the plan template, the plan fixtures, `cstack/src/commands/audit.ts`, `cstack/src/measure/moments.ts`, ADR-RQG-B and section 9 of the specification. (2026-11-24, from the coordinator of the wave)
- This ticket changes only `cstack/guides/resolve-issue/document.md`, `cstack/src/guide-steps.ts`, `cstack/src/audit/conditions.ts`, `cstack/src/audit/evaluate.ts`, their tests and ADR-RQG-C. In `cstack/src/manifest.ts` and `README.md`, change only the entry and the paragraph of your own command or option. When you need a file of another ticket of this wave, ask the coordinator before you change it. (2026-11-24, from the coordinator of the wave)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and do not add a runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `cstack/skills/resolve-issue/SKILL.md` have almost no margin left, because `cstack/test/skill-size.test.ts` counts them together. If you add a sentence to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- After #98 merges, `cstack` refuses a plan in format `cstack-plan/1`, except in `cstack audit` and `cstack measure`. This plan file stays in version 1, because the installed 0.3.2 writes it. Reuse the plan fixtures that exist when you can. A plan fixture that this branch adds may have to move to version 2 when the coordinator asks for an update of the branch. (2026-11-24, from the brief of the run)
- #98 is merged, so `main` has version 2 of the plan format. After the user approves this plan, and before the build starts, bring `origin/main` into this branch. When the branch has no commit of its own yet, run `git merge --ff-only origin/main`. Otherwise run `git rebase origin/main`. Then run `npm test` in `cstack/` once, so that the build starts from a green state. (2026-11-24, from the coordinator of the wave)
- On `main`, the plan template and the plan fixtures are in format `cstack-plan/2`, and every command refuses a plan in version 1, except `cstack measure` and `cstack audit`. A plan fixture that this branch adds must be in version 2. This plan file stays in version 1, because the installed `cstack` 0.3.2 writes and reads it. (2026-11-24, from the coordinator of the wave)
- #98 moved `cstack/test/fixtures/audit/plan.md` to version 2, and `cstack/src/commands/audit.ts` now reads a plan with `acceptVersion1`. Build the audit tests of this ticket on the version on `main`. (2026-11-24, from the coordinator of the wave)
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
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. The installed 0.3.2 does not check it yet. (2026-11-24, from the retrospective of #89)
- Run each deliberate break of the code with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`, because a break can make a test loop forever. If a vitest process of this worktree still runs after that, stop it. Never stop a process of another worktree. (2026-11-24, from the runs of #91, #99 and #114)
- When the plan asks a test to check a message, the plan gives the exact words of that message. (2026-11-24, from the runs of #91, #99 and #114)
- A question for the user reaches a ticket only after the user saw it, word for word, in the chat. (2026-11-24, from the runs of #91, #99 and #114)
- If a result of a sub-agent reaches the main conversation instead of the executor that started it, the main conversation sends it to the executor in a message. (2026-11-24, from the runs of #91, #99 and #114)
- Three runs share this machine. If the full `npm test` fails on a 5-second timeout, run the failing test file alone before you conclude that the code is wrong. (2026-11-24, from the runs of #91, #99 and #114)
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the runs of #91, #99 and #114)
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
- Add the condition `big-decision` at the end of `CONDITIONS` in `cstack/src/guide-steps.ts`, after `new-structural-decision`. A step that carries it applies once when it holds, like `user-interface`. (2026-11-24, the user's answer in the question round)
- The condition `big-decision` holds when a line of the `Documentation duties` section names a decision record before its first colon and says "applies" right after that colon. The line names a record when the text before its first colon holds the word "ADR" or "ADRs" as a whole word, in any case, or the words "decision record" or "decision records", in any case. The line says "applies" when the text after that colon, without its leading spaces, starts with "applies", in any case. The section is the one that `plan.sections` delimits, without its heading line. (2026-11-24, the user's answer in the question round)
- A line of any section other than `Documentation duties` never makes `big-decision` hold, even when it names a record and says "applies". The placeholder of the template, `<phase document: each duty "applies, written to <place>" or "does not apply">`, never makes it hold either. Each of these two rules has its own test case. (2026-11-24, the user's answer in the question round and the advice before the plan)
- `readConditions()` in `cstack/src/audit/conditions.ts` returns three new fields in `Conditions`. `bigDecision` is true when at least one duty line matches. `recordFiles` lists the texts in backticks of the matching lines that end in `.md`, in the order they appear, each once. `recordNames` lists the names of the records, each once. `readConditions()` still reads no file. (2026-11-24, decided in the plan)
- The name of a record comes from each `.md` file of a matching line. It is the leading part of the base name of the file that is made of capital letters, digits and dashes, without its trailing dashes. For example, `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md` gives `ADR-RQG-C`. When a matching line names no `.md` file in backticks, or a file gives an empty name, the name is the text before the first colon of the line, without a leading `- ` or `* ` and without spaces at its ends. For example, "- ADR-157: applies, written to the wiki page of the team." gives `ADR-157`. (2026-11-24, the user's answer in the question round)
- The block of `document.md` gets two new `action` steps, `action: write-decision-record | big-decision` and `action: write-why-comment | big-decision`. They come after the step of the dependent-ticket comments and before `action: write-documentation-places`, in the order of the prose. (2026-11-24, the user's answer in the question round; the place accepted by default)
- `cstack audit` prints a line for the action `write-decision-record` and for the action `write-why-comment` only when the step carries `big-decision` and `bigDecision` is true. It prints no line for these two actions without that condition, and no line for any other action step, as today. This rule has its own test case. (2026-11-24, the user's answer in the question round)
- A `command` or `helper` step that carries `big-decision` is listed once when `bigDecision` is true, and not at all otherwise. (2026-11-24, decided in the plan)
- The two git lines take no part in the order of the phase. No earlier step sets a floor for them, they do not set the floor of any later step, and no time window of a phase limits them. So a record committed by a unit during the build still prints "done", and the `cstack next --done document` line keeps its own verdict. This rule has its own test case. The two lines print among the command lines, in the order of the block, before the helper lines. (2026-11-24, accepted by default in the question round)
- The commits of the branch are the commits of HEAD that are not on the target branch. The target branch is compared by its upstream when it has one, and by the local branch otherwise, as `listUnitCommits()` does (`cstack/src/plan/commits.ts`, lines 20 to 40). The target branch is the `Target branch` of the plan header, which `evaluateSteps()` already receives as `targetBranch` (`cstack/src/audit/evaluate.ts`, line 82). (2026-11-24, decided in the plan)
- The line of `write-decision-record` is not printed when `recordFiles` is empty, because the record then lives outside the repository and git cannot check it. Otherwise it is done when a commit of the branch adds or changes one of the files of `recordFiles`. It shows the author time of the oldest such commit and the word `git`. With no such commit, it is skipped. (2026-11-24, the user's answer in the question round)
- A path of `recordFiles` counts even when it does not exist at HEAD. The advice before the plan proposed to keep only the paths that exist at HEAD. That would hide the case of the acceptance criterion, a run that promised a record and never wrote it: the file does not exist, so the audit would print no line instead of "skipped". The `.md` rule alone already keeps code files out. (2026-11-24, decided in the plan, approved by the user at the approval gate)
- The line of `write-why-comment` is done when a commit of the branch adds a line that holds `WHY:` and, on the same line, one of the names of `recordNames`. The file of that line must not end in `.md`. A removed line never counts. It shows the author time of the oldest such commit and the word `git`. With no such commit, it is skipped. (2026-11-24, the user's answer in the question round)
- The audit prints these exact lines: `document: write-decision-record: done <local time> git`, `document: write-decision-record: skipped`, `document: write-why-comment: done <local time> git` and `document: write-why-comment: skipped`. `formatLine()` (`cstack/src/audit/evaluate.ts`, lines 20 to 23) writes them, with `localTime()` for the time. A skipped line makes the audit exit with 1, as any skipped line does. (2026-11-24, decided in the plan)
- When git fails, for example because the target branch does not exist, both lines are skipped. The audit never stops and never exits with 3 or 5 for that reason. (2026-11-24, decided in the plan)
- The git proof lives in a new module, `cstack/src/audit/records.ts`. It exports `GIT_ACTIONS`, which is `["write-decision-record", "write-why-comment"]`, `recordTime(root, targetBranch, files)` and `whyTime(root, targetBranch, names)`. Each function returns a time in milliseconds, or `undefined`. It runs git with `spawnSync` and no shell, and puts `--end-of-options` before the range of commits. The paths of `recordFiles` go to git as literal pathspecs after `--`. The names of `recordNames` are only searched in the output of git and never go to git. (2026-11-24, decided in the plan)
- `cstack/src/audit/evaluate.ts` holds a `WHY:` comment next to the code of the two git lines: `// WHY: ADR-RQG-C, section "How the audit checks the big decisions".` It follows the comment with one sentence that says why these lines take no part in the order of the phase. (2026-11-24, decided in the plan)
- Do not change `cstack/src/commands/audit.ts`, `cstack/src/plan/` or `cstack/src/phases.ts`. `evaluateSteps()` keeps its signature, because `StepInput` already has `root`, `targetBranch` and `conditions`. (2026-11-24, decided in the plan)
- In the section "Hand the context down" of `document.md`, write these two sentences right after the sentence that ends with "where `<key>` is the dependent ticket.": "Post each comment with its own `cstack tracker comment` call. Never post several comments in one loop of the shell, because the audit counts one call for each comment." The rule covers every comment, the one on the ticket included. The block does not change for this point. (2026-11-24, accepted by default in the question round)
- In the section "Record every big decision" of `document.md`, add this sentence after the sentence that asks for the `WHY:` comment: "Write the short name of the record on the same line as `WHY:`." Then add this paragraph before the paragraph that starts with "Then update the pages": "The audit of the run checks both from the commits of the branch. It does so when a line of the plan's \"Documentation duties\" names a decision record before its colon and says \"applies\". The record counts when a commit of the branch changes a `.md` file that this line names in backticks. The `WHY:` comment counts when a commit of the branch adds it in a file that is not a Markdown file." Keep the headings of the guide as they are, because `cstack/test/guides/tracker-writes.test.ts` cuts the guide at them (lines 11 and 12). (2026-11-24, decided in the plan)
- The audit still lists the `WHY:` step for a decision that governs no code, such as a change to a guide only. The retrospective judges a "skipped" there. (2026-11-24, accepted by default in the question round)
- ADR-RQG-C gets a new section at its end, "How the audit checks the big decisions". It says plainly that it changes two rules of the record: the list of conditions, which now has eight, and the rule that the audit never prints a line for an `action` step. It gives the condition, the two proofs from git, the name of a record, and why the two lines take no part in the order of the phase. Fix the list in place too: line 32 says "Only these eight are accepted", a bullet for `big-decision` follows the bullet of `new-structural-decision`, line 62 speaks of the conditions listed above without a number, and lines 86 and 88 point to the new section for the exception. (2026-11-24, accepted by default in the question round)
- The `cstack audit` paragraph of `README.md` is the paragraph of the command that this ticket changes, so this ticket updates it, and no other part of `README.md`. It says when a step for a big decision is printed, how git proves the two steps, and that the two lines take no part in the order of the phase. Its sentence "The audit never prints a step that only asks you to do something" gets the exception of these two steps. It lists one more limit: the words "applies", "ADR" and "decision record" are English, so a plan that writes its duties in another language shows no step of a big decision. (2026-11-24, accepted by default in the question round)
- The `cstack audit` entry of `cstack/src/manifest.ts` does not change, because its usage, its flags and its exit codes stay the same. (2026-11-24, decided in the plan)
- The new tests use the sample record names `ADR-SAMPLE-A` and `ADR-SAMPLE-B` and the sample folder `docs/decisions/`. They create their git repositories with the helpers of `cstack/test/helpers/plan-repo.ts` and set the author time with `GIT_AUTHOR_DATE`, as `cstack/test/audit.test.ts` does near line 571. (2026-11-24, decided in the plan)
- The audit tests of this ticket change the plan fixture `cstack/test/fixtures/audit/plan.md` in memory only, for example by replacing its line "Write the page of the command." under `## Documentation duties`. They add no plan fixture. (2026-11-24, decided in the plan)
- No security surface. The change reads the local git history and the plan file, and opens no endpoint. git runs without a shell, and the paths that come from the plan reach git only as literal pathspecs after `--`. (2026-11-24, decided in the plan)

## Architecture

The approach is locked by the answers of the question round. The block format gets the condition `big-decision`. `readConditions()` reads it, with the files and the names of the records, from the lines of `## Documentation duties`. A new module, `cstack/src/audit/records.ts`, finds the oldest commit of the branch that changes a record file, and the oldest one that adds a `WHY:` line naming a record. `evaluateSteps()` prints the two action steps of a big decision from these times, outside the order and the time windows of the phase, so that the window code stays as it is. The document guide lists the two steps in its block and asks for one `cstack tracker comment` call per comment. ADR-RQG-C and the README paragraph of `cstack audit` record the change.

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

### Unit 1: Accept the condition big-decision in a block of mandatory steps
- Files: `cstack/src/guide-steps.ts`, `cstack/test/guide-steps.test.ts`
- Test: `cstack/test/guide-steps.test.ts`: the case "accepts all seven conditions and the three kinds from the exported lists" is renamed "accepts all eight conditions and the three kinds from the exported lists" and expects `big-decision` last, so it fails. A new case "reads the condition big-decision on an action step" reads a block with `action: write-decision-record | big-decision` and expects the step `{ line: 2, kind: "action", action: "write-decision-record", condition: "big-decision" }`, so it fails while `readSteps()` refuses the condition.
- Minimum code: Add `"big-decision"` at the end of `CONDITIONS`.
- Refactor: None.
- Commit message: feat(cli): accept the condition big-decision in a block of mandatory steps
- Depends on: none

### Unit 2: Read the decision records of the documentation duties
- Files: `cstack/src/audit/conditions.ts`, `cstack/test/audit-conditions.test.ts`
- Test: `cstack/test/audit-conditions.test.ts`: each case below fails first, because `bigDecision`, `recordFiles` and `recordNames` do not exist yet.
- Minimum code: Add `bigDecision`, `recordFiles` and `recordNames` to `Conditions`, and read them from the lines of the `Documentation duties` section, as `## Decisions` says.
- Refactor: None.
- Commit message: feat(cli): read the decision records of the documentation duties in cstack audit
- Depends on: none

The test helpers `planOf()` and `textWith()` of this file build a `PlanRead` by hand. Extend them so that a test can give a `Documentation duties` section and a `Decisions` section, and keep every existing case passing. Write each case below as its own `it()`:
1. "sets bigDecision for a duty that names a record and says applies": the duty "- ADR-SAMPLE-A: applies, written to `docs/decisions/ADR-SAMPLE-A-sample.md` by unit 2." gives `bigDecision` true, `recordFiles` `["docs/decisions/ADR-SAMPLE-A-sample.md"]` and `recordNames` `["ADR-SAMPLE-A"]`.
2. "accepts the path of the record before the colon": the duty "- ADR-SAMPLE-A (`docs/decisions/ADR-SAMPLE-A-sample.md`): applies, a short section added." gives the same three values.
3. "accepts the words decision record in any case": the duty "- Decision Record: Applies, written to `docs/decisions/ADR-SAMPLE-B-other.md`." gives `bigDecision` true and `recordNames` `["ADR-SAMPLE-B"]`.
4. "clears bigDecision for a duty that does not apply": the duty "- Architecture decision record: does not apply." gives `bigDecision` false, `recordFiles` `[]` and `recordNames` `[]`.
5. "ignores a duty that names a record only after its colon": the duty "- The comment on this ticket: applies, it names ADR-SAMPLE-A." gives `bigDecision` false.
6. "ignores the word ADR inside a longer word": the duty "- The ADRESSE page: applies, written to the wiki." gives `bigDecision` false.
7. "ignores a matching line outside the Documentation duties section": the `Decisions` section holds "- ADR-SAMPLE-A: applies, written to `docs/decisions/ADR-SAMPLE-A-sample.md`.", and the duty is "- A decision record: does not apply.". `bigDecision` is false.
8. "ignores the placeholder of the template": the `Documentation duties` section holds only `<phase document: each duty "applies, written to <place>" or "does not apply">`. `bigDecision` is false.
9. "keeps only the paths in backticks that end in .md": the duty "- ADR-SAMPLE-A: applies, written to `docs/decisions/ADR-SAMPLE-A-sample.md`, with a comment in `src/a.ts`." gives `recordFiles` `["docs/decisions/ADR-SAMPLE-A-sample.md"]`.
10. "names the record by the text before the colon when the duty names no .md file": the duty "- ADR-157: applies, written to the wiki page of the team." gives `bigDecision` true, `recordFiles` `[]` and `recordNames` `["ADR-157"]`.
11. "lists each file and each name once over two duties": two duties name `docs/decisions/ADR-SAMPLE-A-sample.md`, and a third names `docs/decisions/ADR-SAMPLE-B-other.md`. `recordFiles` has the two files once each, in the order they appear, and `recordNames` is `["ADR-SAMPLE-A", "ADR-SAMPLE-B"]`.

### Unit 3: Find the commits that prove a decision record and its WHY comment
- Files: `cstack/src/audit/records.ts`, `cstack/test/audit-records.test.ts`
- Test: `cstack/test/audit-records.test.ts`: each case below fails first, because the module does not exist. Import it with a dynamic `import()` inside each case.
- Minimum code: Write `GIT_ACTIONS`, `recordTime()` and `whyTime()` in `cstack/src/audit/records.ts`, as `## Decisions` says.
- Refactor: None.
- Commit message: feat(cli): find the commits that prove a decision record and its WHY comment
- Depends on: none

Each case builds a repository with `makeRepo()` on `main`, then runs `git checkout -b feature` for the commits of the branch. Write each case as its own `it()`:
1. "exports the two actions that git proves": `GIT_ACTIONS` equals `["write-decision-record", "write-why-comment"]`.
2. "gives the author time of the oldest branch commit that changes a record file": two commits of the branch change `docs/decisions/ADR-SAMPLE-A-sample.md`, at two author times. `recordTime()` returns the earlier time.
3. "gives undefined when only the target branch changed the record file": the file is committed on `main` before the branch starts, and the branch changes another file.
4. "gives undefined when no branch commit changes a record file": the branch changes only `src/a.ts`.
5. "gives the author time of the oldest branch commit that adds a WHY line naming a record": a commit of the branch adds `// WHY: ADR-SAMPLE-A, the reason.` to `src/a.ts`. `whyTime(root, "main", ["ADR-SAMPLE-A"])` returns its author time.
6. "gives undefined for a WHY line that names no record": the branch adds `// WHY: a local reason.` to `src/a.ts`.
7. "gives undefined for a WHY line in a Markdown file": the branch adds `WHY: ADR-SAMPLE-A, the reason.` to `docs/notes.md`.
8. "gives undefined for a WHY line that the branch only removes": `main` holds `// WHY: ADR-SAMPLE-A, the reason.` in `src/a.ts`, and the branch removes that line.
9. "gives undefined when the name is on another line than WHY:": the branch adds `// WHY: the reason.` and, on the next line, `// See ADR-SAMPLE-A.` to `src/a.ts`.
10. "gives undefined from both functions when the target branch does not exist": both functions get the target branch `missing`, return `undefined` and throw nothing.

### Unit 4: Check the decision record and the WHY comment of a big decision in cstack audit
- Files: `cstack/src/audit/evaluate.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: each case below fails first, in the describe block of the conditions that starts near line 850.
- Minimum code: In `kindOf()`, list the two actions of `GIT_ACTIONS` that carry `big-decision` when `bigDecision` is true, and list a `command` or `helper` step that carries `big-decision` once when it is true. In `nodesOf()`, give the git nodes no floor and leave the floor of the next steps as it was. In `evaluateSteps()`, prove the git nodes with `recordTime()` and `whyTime()`, and skip the record line when `recordFiles` is empty. Add the `WHY:` comment that `## Decisions` gives.
- Refactor: None.
- Commit message: feat(cli): check the decision record and the WHY comment of a big decision in cstack audit
- Depends on: 1, 2, 3

The test guide of the document phase in these cases is: `command: cstack tracker comment '<key>' --body-file <file> --tracker <name>`, `action: write-decision-record | big-decision`, `action: write-why-comment | big-decision`, `action: write-documentation-places`, `command: cstack next --done document`. A plan with a big decision is the fixture with its line "Write the page of the command." replaced by "- ADR-SAMPLE-A (`docs/decisions/ADR-SAMPLE-A-sample.md`): applies, written in the document phase.". Write each case as its own `it()`:
1. "prints both steps of a big decision as skipped when the branch has no record and no WHY comment": the output holds `document: write-decision-record: skipped` and `document: write-why-comment: skipped` on lines of their own, and the exit code is 1.
2. "prints no step of a big decision when no duty says a record applies": with the fixture as it is, no line starts with `document: write-`.
3. "prints both steps done from git when the branch has the record and the WHY comment": on a branch `feature`, one commit changes `docs/decisions/ADR-SAMPLE-A-sample.md` and one adds `// WHY: ADR-SAMPLE-A, the reason.` to `src/a.ts`, each with its own author time. The output holds `document: write-decision-record: done <local time> git` and `document: write-why-comment: done <local time> git`, with the two author times.
4. "prints no record line when the duty names no .md file": the duty is "- ADR-157: applies, written to the wiki page of the team.". No line starts with `document: write-decision-record:`, and one line starts with `document: write-why-comment: `.
5. "prints no line for an action step other than the two of a big decision": the guide also holds `action: write-decision-record` without a condition. With a big decision, exactly one line starts with `document: write-decision-record:`, and no line holds `write-documentation-places`.
6. "keeps a record committed during the build out of the order of the phase": the record commit and the `WHY:` commit have an author time in the build phase, before the comment call of the document phase. Both lines say done with those times, and `document: cstack next --done document: done` keeps its time.
7. "lists a command step with big-decision once when it holds": the guide of the ready phase is `command: cstack next --done ready` and `command: cstack plan status --plan <plan file> | big-decision`. With a big decision, one line starts with `ready: cstack plan status --plan <plan file>: `. With the fixture as it is, none does.

### Unit 5: List the steps of a big decision in the document guide and ask for one call per comment
- Files: `cstack/guides/resolve-issue/document.md`, `cstack/test/guides/document-guide.test.ts`
- Test: `cstack/test/guides/document-guide.test.ts`: each case below fails first, because the guide has neither the steps nor the sentences.
- Minimum code: Write the two steps into the block and the sentences into the prose of `document.md`, as `## Decisions` says.
- Refactor: None.
- Commit message: feat(skill): list the steps of a big decision in the document guide and ask for one call per comment
- Depends on: 1, 3

The test reads the raw guide `cstack/guides/resolve-issue/document.md` and its block with `readSteps()`. Write each case as its own `it()`:
1. "lists each action of GIT_ACTIONS with the condition big-decision": for each id of `GIT_ACTIONS`, imported with a dynamic `import()` from `cstack/src/audit/records.ts`, the block has an `action` step with that id and the condition `big-decision`.
2. "puts the two steps after the dependent-ticket comments and before write-documentation-places": in the block, the step of the comments with `each-dependent-ticket` comes first, then `write-decision-record`, then `write-why-comment`, then `write-documentation-places`.
3. "asks for one call per comment": the section that starts at "## Hand the context down" holds "Post each comment with its own `cstack tracker comment` call." and "Never post several comments in one loop of the shell, because the audit counts one call for each comment.".
4. "says that the audit checks the record and the WHY comment from the commits of the branch": the section that starts at "## Record every big decision" holds "Write the short name of the record on the same line as `WHY:`." and "The audit of the run checks both from the commits of the branch.".

### Unit 6: Record in ADR-RQG-C and in the README how the audit checks the big decisions
- Files: `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, `README.md`
- No test: These are documentation files. The behaviour they describe is tested in units 1 to 5.
- Minimum code: Write the new section of ADR-RQG-C, fix its list of conditions in place, and update the `cstack audit` paragraph of `README.md`, as `## Decisions` says.
- Refactor: None.
- Commit message: docs: record in ADR-RQG-C and in the README how the audit checks the big decisions
- Depends on: 4, 5

## Documentation duties

- ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`): applies, written by unit 6. A new section "How the audit checks the big decisions", and the list of conditions fixed in place.
- The `cstack audit` paragraph of `README.md`: applies, written by unit 6.
- The `WHY:` comment that names ADR-RQG-C in `cstack/src/audit/evaluate.ts`: applies, written by unit 4.
- The document guide `cstack/guides/resolve-issue/document.md`: applies, written by unit 5.
- The `cstack audit` entry of `cstack/src/manifest.ts`: does not apply, because its usage, its flags and its exit codes stay the same.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply, because no story and no acceptance criterion changes, and section 9 already links to ADR-RQG-C.
- The comment on this ticket, #118: applies, written in the document phase.
- The comment on the dependent ticket #103: applies, written in the document phase. It says that the block of `document.md` now has two action steps that carry `big-decision` and that git proves, and that a change to the blocks must keep them.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: What in the plan shows a big decision

Which line of the plan should make the new condition `big-decision` hold? I recommend a line of `## Documentation duties` that names a decision record before its first colon, with the word "ADR" or the words "decision record", and that says "applies" right after the colon. The plan phase writes these lines before the approval gate, as "applies, written to <place>" or "does not apply" (`cstack/guides/resolve-issue/plan.md`, line 37). I checked it on the 14 plans of `docs/plans/` dated from 2026-11-20 on, and it is right for all of them. The four plans that say "applies" (#86, #88, #90 and #91) wrote or extended ADR-RQG-C, and the ten others wrote no record. The example of the ticket, a line of `## Decisions` that names a decision record, is wrong for five of these plans (#66, #70, #75, #99 and #114). They name an ADR in `## Decisions` as a source, and they wrote no record. The other choice is to reuse `new-structural-decision`. It holds when the plan lacks the sentence "No new decision since the question round" (`cstack/src/audit/conditions.ts`, line 31). It means that the plan added a structural decision after the question round, so it misses a big decision taken in the question round. It also holds by default, so every run that forgets the sentence would show the new steps as skipped. My recommendation changes the wording of the first acceptance criterion: the test plan says in `## Documentation duties` that a decision record applies, instead of naming a record in `## Decisions`.
- For: the user
- Answer: yes, as recommended. The condition `big-decision` holds when a line of `## Documentation duties` names a decision record before its first colon and says "applies" right after it. The first acceptance criterion changes accordingly. (the user, in the question round, 2026-11-24)

### Question 2: Which kind of step, and what proves it

How should the block of `document.md` write the two new steps, and what proves them? I recommend two `action` steps that carry the new condition: `action: write-decision-record | big-decision` and `action: write-why-comment | big-decision`. The audit proves these two actions from git, with the commits of the branch that are not on the target branch, as it already does for `cstack unit commit <n>` (`cstack/src/audit/evaluate.ts`, lines 176 to 210). The decision record is done when a commit of the branch adds or changes a file that the decision record duty names in backticks. Only the backticked paths that end in `.md` and exist at HEAD count, so a code file named in the same duty cannot prove the record. When that duty names no such file, the record lives outside the repository, so the audit cannot check it and prints no line for it. The `WHY:` comment is done when a commit of the branch adds a line that holds `WHY:` and, on the same line, the name of the record, in a file that is not a Markdown file. The name of the record is the leading part of its file name made of capital letters, digits and dashes, such as `ADR-RQG-C` for `ADR-RQG-C-expected-steps-of-a-run.md`. When the duty names no file, the name is the text before the colon of the duty. A line that holds `WHY:` alone is not enough, because `cstack/src` has 62 `WHY:` comments and only 15 name a record (added after the advice before the plan). Markdown files are left out because the plan file, the guide and the decision record often quote `WHY:`. These two lines take no part in the order of the phase, because a unit often writes the record during the build, as in #86 and #88. Each line shows the time of the first such commit and the word `git`. The other choices are worse. A plain `action` step is never printed by the audit (ADR-RQG-C, line 86), so the acceptance test "prints the new step as skipped" cannot pass. A new step kind, such as `record:`, changes the block format more for the same result. My recommendation changes one rule of ADR-RQG-C: the audit now prints a line for an action step when git can prove it, and today only these two actions can be proved.
- For: the user
- Answer: yes, as recommended, with the correction of the advice before the plan. Two `action` steps carry `big-decision`, and the audit proves them from the commits of the branch. The added `WHY:` line must name the record. (the user, in the question round, 2026-11-24)

## Review log

Impact notes. The new condition `big-decision` is named in the ADR-RQG-C, the README, `guide-steps.ts`, `conditions.ts` and `evaluate.ts`, and all of them are updated. No current file outside `docs/plans/` still says "seven conditions". The usual companions of `evaluate.ts` are `test/audit.test.ts`, `commands/audit.ts` and `match.ts`. The tests of `audit.test.ts` pass, and `commands/audit.ts` handles the new lines.

Reviewers. Correctness found one bug: the two git checks compared with the local target branch and not with its upstream, so a stale local `main` made the audit print "done" for work of other tickets. Fixed: `records.ts` now uses the upstream like `listUnitCommits()`, with a new test. Security found nothing; it suggested `--no-textconv`, which I added. Conventions found nothing at or above 80. Simplicity suggested `-G 'WHY:'`, which I added. Left as follow-ups because they are small or rare: use `Pick` for the `Records` type, use a `Set` in `records()`, inline `GIT_ACTIONS`, a record name that is a prefix of another name, and a `WHY:` line in a file whose name needs quoting.


Independent review. The reviewer changed nothing and found no bug or broken convention. Two timeouts in files this branch does not touch passed when run alone. Judgment calls for the pull request: the base-branch lookup `baseOf()` in `records.ts` copies the upstream logic of `listUnitCommits()`, and a shared helper would keep them together. A record file with a lowercase name gives no short name, so the audit uses the text before the colon as the name, as the plan decided. A `WHY:` scan reads an added line that begins with `++ ` as a file header, which is rare.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- The briefing phase can also write a decision record (`cstack/guides/resolve-issue/briefing.md`, line 18). Should the block of the briefing guide get the same two steps of a big decision? For: the maintainer.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

- Comment on ticket #118: https://github.com/gambitl/claude-code-stack/issues/118
- Comment on the dependent ticket #103: https://github.com/gambitl/claude-code-stack/issues/103
- Decision record: `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, new section "How the audit checks the big decisions" (commit 33eaaef).
- Page: the `cstack audit` paragraph of `README.md` (commit 33eaaef).
- `WHY:` comment naming ADR-RQG-C in `cstack/src/audit/evaluate.ts` (commit 2d25065).
- Guide: `cstack/guides/resolve-issue/document.md` (commit a41d316).

## Executor notes

- `cstack helper wait` for unit 1 exited with 1 ("finished without an accepted report") because I ran it before the sub-agent returned; running it after the return worked.
- The implementer of unit 4 reported that the local build refuses this plan (format version 1), so it used the installed `cstack` for `unit red` and `unit green`.

## Hand-off log

- 2026-11-24, executor run 1: moved ticket #118 to "in progress" with `cstack tracker move`. Started the build phase on branch gambitl/document-big-decisions.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

Two decisions before I plan. I do the rest by default.

**I need your answer before I plan**

**1. The new condition `big-decision` reads `## Documentation duties`, not `## Decisions`.** It holds when a duty names a decision record (ADR) before its colon and says "applies" right after. The ticket suggested `## Decisions`, but five recent plans name an ADR there without writing one. Reusing `new-structural-decision` does not work. It misses the decisions taken in the question round, and it holds by default, so it would give false "skipped" lines. This changes the wording of the first acceptance criterion: the test plan says it in its duties. I recommend it, because it is right on all 14 recent plans.

**2. Two `action` steps that git proves, with one change for the `WHY:` comment.** The record counts as done when a commit of the branch touches the file that the duty names. For the `WHY:` comment, a commit that adds any `WHY:` line outside Markdown is not enough. This repository also writes `WHY:` for small local reasons. `cstack/src` has 62 of them, and only 15 name an ADR. So the line would say "done" on almost every run that touches code. I recommend that the added `WHY:` line must name the record, such as `ADR-RQG-C`, as the guide already asks. This also changes one rule of ADR-RQG-C: the audit now prints an `action` step when git can prove it.

**I will do this unless you say no**

- In `evaluate.ts`, I handle these two lines in a branch of their own, outside the order of the phase and the time windows. Most recent fixes of that file were about those windows.
- I add a test that the real block of `document.md` carries the two action ids that the code knows. Otherwise a renamed id would drop the lines silently.
- The new section of ADR-RQG-C says plainly that it changes two rules: the list of conditions, and the rule on `action` steps. I fix the list in place, and the `cstack audit` paragraph of the README.
- I keep the proposed answers on the small points: one call for every comment, the place of the steps in the block, the `WHY:` step even for a guide-only decision, and the limit of the English words.

**I checked it myself**

- The branch of the plan format version 2 (#98) keeps `## Documentation duties` unchanged, so the condition needs no new line of the format.
- I re-read the duty lines of the 14 plans, and the result holds.
- The shell reader of the audit sees a `for ... do cstack tracker comment ...; done` loop as one call. The fix of the guide is enough.

**Good to know**

- The audit will check that a promised record was written, not that a decision deserved one. Two recent plans (#70, #79) said "does not apply" for a format choice.
- The proof from git has no phase window, so a record written later, in the briefing, also counts.

#### Details

**What shows a big decision (blocking, answered by a test, needs the user's choice).** The draft recommendation stands. I re-ran the check on the 14 plans of `docs/plans/` dated from 2026-11-20 on, reading the lines of `## Documentation duties` that mention "ADR" or "decision record". The four plans whose decision-record duty says "applies" (#86, #88, #90, #91) wrote or extended ADR-RQG-C, and the ten others say "does not apply". The rule "the name of a record before the first colon, then applies" also rejects the false friends I found. The plan of #90 has a duty "The comment on this ticket: applies ..." that mentions ADR-RQG-C after its colon, and the rule correctly ignores it. The plan of #90 also writes "ADR-RQG-C (`docs/decisions/...`): applies", with the path before the colon, which the rule must accept. The rejected option, reusing `new-structural-decision`, is wrong for two reasons that the draft gives: it is true by default (`cstack/src/audit/conditions.ts`, line 31) and it only covers decisions added after the question round (`cstack/guides/resolve-issue/plan.md`, line 25). A `## Decisions` line that names an ADR is wrong for #66, #70, #75, #99 and #114. The recommendation changes the first acceptance criterion, so it must stay with the user. If nobody decides, the plan cannot follow the ticket's wording without shipping a condition that is wrong on a third of the recent plans. The new condition is false when no duty matches, which is the opposite default of `new-structural-decision`. That is the right default here, because a missing duty must not produce a false "skipped" and an exit code 1. The plan should add one test case that the unfilled template placeholder of `## Documentation duties` ("<phase document: each duty ...>") does not make the condition hold; it does not today, because the text before its first colon names no record.

**How the two steps are proved (blocking, needs the user's choice).** I agree with two `action` steps carrying `big-decision` and proved from the commits of the branch, because a plain `action` step is never printed (ADR-RQG-C, line 86) and a new step kind costs more format for the same result. I disagree with the draft on the proof of the `WHY:` comment. `grep -rn "WHY:" cstack/src` finds 62 comments, for example in `cstack/src/test-run.ts`, lines 67 to 137, and `cstack/src/unit/collect.ts`, lines 55 to 219. Only 15 of them name a record. Each of those 15 writes the short name of the record right after `WHY:`, for example `WHY: ADR-SIC-F.` in `cstack/src/tracker/choose.ts`, line 1, or `WHY: ADR-RQG-C, section ...` in `cstack/src/commands/audit.ts`, line 137. The test files hold more of them (`cstack/test/report.test.ts`, line 27). The plan of #66 added a `WHY:` comment and wrote no record. So the draft's proof, "a commit of the branch adds a line that holds `WHY:` in a file that is not Markdown", would say "done" for nearly every run that changes code, and the step would prove nothing. The document guide already says that the comment names the record (`cstack/guides/resolve-issue/document.md`, line 28). My proposal: the added line holds `WHY:` and, on the same line, the name of the record. The name is the leading part of the record file name made of capital letters, digits and dashes, such as `ADR-RQG-C` for `ADR-RQG-C-expected-steps-of-a-run.md`, or the text before the colon of the duty when the duty names no file. Keeping the draft's exclusion of Markdown files is still right, because this very ticket edits `document.md` and ADR-RQG-C, which quote `WHY:`. For the record itself, the draft says "a commit adds or changes a file that the duty names in backticks". A duty can name other things in backticks, for example a code file or the word `WHY:` itself (the plan of #66 does the latter). I recommend counting only the backticked paths of that duty that end in `.md` and exist at HEAD. A code file named in the same duty then cannot prove the record. If nobody decides, the step is either never printed (the acceptance test "prints the new step as skipped" fails) or printed with a proof too weak to mean anything.

**Keep the git lines out of the window logic (non-blocking, accepted by default).** `kindOf()` leaves out every `action` step at `cstack/src/audit/evaluate.ts`, line 95, and `nodesOf()` chains every single step to the one before it through `tail`. If the two new steps became ordinary single nodes, they would get a floor from the dependent-ticket comments, and a record committed during the build would show "out of order". `chooseCall()` and the `taken` set would also see them. The safe shape is a branch of its own in `evaluateSteps()`, like the helper branch at lines 246 to 265, that never sets `tail`, never reads a call and never sets a floor. The existing cases of `cstack/test/audit.test.ts` then guard that nothing else moved. The proof can reuse `input.root` and `input.targetBranch`, which `StepInput` already carries, and the base of `listUnitCommits()` (`cstack/src/plan/commits.ts`, lines 20 to 39). So `cstack/src/commands/audit.ts`, which belongs to #98, needs no change. The `Conditions` interface gains a field that carries the record paths and names, not only a boolean.

**Guard the action ids (non-blocking, accepted by default).** The code will know two action ids, such as `write-decision-record` and `write-why-comment`. `kindOf()` returns `undefined` for anything it does not name (line 102), so a renamed id in the guide would make the lines vanish with no error. A test that reads the real block of `document.md` and finds both ids with the condition `big-decision` closes that gap. ADR-RQG-C's acceptance criterion AC6 says that no second list of steps exists in the code. A map from two action ids to their proof is a list of proofs, not of steps, the same as the proof of `cstack unit commit <n>` at lines 196 to 210. The new ADR section should say so in one sentence.

**ADR-RQG-C and README (non-blocking, accepted by default).** Every added section of ADR-RQG-C so far says that it "changes none of the decisions of the record". This one does change two: "Only these seven are accepted" (line 32) and "The audit never prints a line for a step of the `action` kind" (line 86). Update the list of conditions in the Decision section in place, so the record does not contradict itself, and write a new section that names both changes. The `cstack audit` paragraph of `README.md` (line 54) says "The audit never prints a step that only asks you to do something". That sentence becomes false and must change. That paragraph is the only part of the README this ticket may touch.

**The draft's non-blocking points.** I keep the draft recommendations on points 3, 4, 5 and 7 of "Open questions and answers". On point 5, the `WHY:` step of a guide-only decision will show "skipped" and make the audit exit with 1. That is a cost the retrospective has to read, and it is acceptable because the guide asks for the comment in every case. On point 6, the proof from git looks at all commits of the branch with no phase window, so a record written in the briefing phase also counts. Nothing more is needed for this ticket.

**What I checked.** The branch `origin/gambitl/plan-format-v2` changes the plan template (`cstack/skills/resolve-issue/templates/plan.md`) by adding "Negative criteria", "Facts" and "Changes to what the ticket fixes", and leaves `## Documentation duties` as it is. ADR-RQG-B on that branch says that `cstack audit` still reads a version 1 plan. So the condition reads a section that both versions have, and the coordinator does not need to be asked. The shell reader skips the word `do` (`cstack/src/audit/shell.ts`, line 6), so the body of a `for` loop gives one call, and the step `cstack tracker comment '<key>' ...` matches a `$k` key because `<key>` is a placeholder (`cstack/src/audit/match.ts`, lines 57 to 59). This explains the two false "skipped" lines of #90, and a change of the prose of `document.md` is the whole fix.

**Limits worth writing down.** The condition comes from the duties that the same run writes. So the audit checks that a promised record exists, not that a decision deserved one. The plans of #70 and #79 said "does not apply" for an ADR while they recorded a format choice in `## Decisions`. The README paragraph should name this limit next to the limit on English words. After the branch is merged and deleted, the proof from git finds no commit, as the proof of `cstack unit commit <n>` already does today.

I checked security, data model lock-in, scale, failure modes, user-facing edge cases, operations and cost, and found nothing to raise there beyond the points above.

### Open questions and answers

1. Blocking question 1: what in the plan shows a big decision. Recommended: a line of `## Documentation duties` that names a decision record and says "applies". Tested on the 14 plans of `docs/plans/` dated from 2026-11-20 on: right for all 14, while a line of `## Decisions` that names an ADR is wrong for five of them. Evidence: the duty lines and the decision lines of these plans, read with `awk` on their sections.
2. Blocking question 2: the kind of the two new steps and what proves them. Recommended: two `action` steps that the audit proves from the commits of the branch. The user said yes to both blocking questions on 2026-11-24. The points of the advice that start with "I will do this unless you say no" were accepted by default, because the reply did not object to them.
3. Non-blocking. Does the document guide ask for one `cstack tracker comment` call per comment for the ticket comment too, or only for the dependent tickets? Recommended: for every comment. The section "Hand the context down" says that each comment is its own call and never a loop of the shell, because the audit counts one call per comment. The section "Write back into the ticket" already posts one comment. The block does not change for this point.
4. Non-blocking. Where do the two new steps go in the block? Recommended: after the step of the dependent-ticket comments and before `action: write-documentation-places`, in the order of the prose of the guide.
5. Non-blocking. A decision that governs no code, such as a change to a guide only, has no natural place for a `WHY:` comment. Recommended: the audit still lists the `WHY:` step, and the retrospective judges a "skipped" there. This keeps the rule of the guide, which asks for a `WHY:` comment for each big decision (`document.md`, line 28).
6. Non-blocking. The briefing phase can also write a decision record (`cstack/guides/resolve-issue/briefing.md`, line 18). Recommended: open, not needed for this ticket. The ticket covers the document phase only.
7. Non-blocking. The words "applies", "ADR" and "decision record" are English, like the sentence of `new-structural-decision`. Recommended: the README paragraph of `cstack audit` says so as a limit, as it does for that sentence today.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn.
