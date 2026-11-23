# Plan: #90 — R1-4: Check helper checks and not-applicable steps in cstack audit

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/90
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/audit-helper-checks
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T17:53:23+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Make the audit also check that the reviews and the advice that the skill asks for really happened, and make it skip the steps that do not apply to a given run.

- **What the title means**: The skill gives some checks to helpers. A helper is a fresh agent that does one job. Examples are the code map, the CTO advisor (a helper that raises the questions a technical lead would ask), the three code reviews and the independent review. "Not-applicable steps" are steps that the plan of a run makes useless. For example, a ticket with no negative criterion has no step that proves a negative test.
- **Why we are doing it**: In one of the earlier runs, the reviews found nothing and a flaw went through. The audit must at least show that each review happened. It must also not report a step as skipped when the run had no reason to do it.
- **For the user**: The audit report lists only real gaps, and it covers the checks where quality is decided.

**Goal.** This ticket adds the third level of `cstack audit`, the checks made by helpers, and the conditions that make a step not applicable.

### Where things are today (read first)

* **The audit**: #89 adds `cstack audit` with the phases and the required commands.
* **The helpers that the guides name**: `code-map.md` (line 18) names `resolve-issue:code-explorer`. `questions.md` (line 42), `plan.md` (line 13) and `briefing.md` (line 7) name `resolve-issue:cto-review`. `review.md` (lines 17 to 20) names the three code reviewers. `independent-review.md` (line 15) names `resolve-issue:pr-reviewer`, and its line 16 starts any other review agent through an Orca worker.
* **The helper transcripts**: `cstack/src/measure/sessions.ts` (lines 162 to 166) reads them from `<session id>/subagents/*.jsonl` and skips the `agent-*.meta.json` files. The fixtures `cstack/test/fixtures/measure/basic/.claude/projects/-repo/main1/subagents/agent-a1.meta.json` and `agent-a2.meta.json` hold an `agentType` field. No code reads it yet. Check on a real session of your own which field names the type of a sub-agent.
* **The launch of a helper**: in the parent session, an `Agent` tool call carries the type in `input.subagent_type`. Older Claude Code versions call this tool `Task`.
* **The plan**: `cstack/src/plan/read.ts` → `readPlan()` reads the sections and the units. The plan sections that the checks fill, such as the review log, give a second kind of evidence.
* **The conditions**: #86 defines the conditions that a step can carry, such as "for each unit" or "when the ticket has a negative criterion".
* **The settings**: `.cstack/settings.json` can name another review agent than Claude, as `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` explains.

### Scope

1. For each check that a block gives to a helper, look for evidence that it happened. The evidence is a launch of a helper of that type, or the plan section that the guide says the check fills.
2. Do not check which helper or which model did the check. Claude chooses its helpers.
3. When the settings name another review agent than Claude, accept an Orca worker as the evidence of the independent review.
4. Evaluate the conditions of each step against the plan and the settings. A step whose condition is false is not expected, and the audit does not list it as skipped.
5. A condition that needs data the plan does not have yet, such as the negative criteria of plan format version 2, counts as false for now. #98 adds that data.
6. Print the third level after the first two, with the same line format and the same exit codes.

### Acceptance (TDD)

* The audit test file: write first a fixture run where the CTO advisor ran at its three moments, and see the three steps say "done". Then make it pass.
* The same file: a run with no code review prints the three review steps as "skipped".
* The same file: a run whose plan has no unit with a condition that applies does not list the conditional step at all.
* The same file: when the settings name another review agent, an Orca worker counts as the evidence of the independent review.
* The same file, negative: the output still holds only fixed labels, step names and times, and no path.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #89 · Feeds: #91, #92, #108

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rule of the specification for every story.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

**Acceptance criteria of US-1 that this ticket carries.** The specification lists them in section 4, under "US-1: Audit the steps of a run". #89 built AC1, AC2, AC3, AC6, AC8 and the two negative criteria. This ticket carries AC4, AC5 and AC7, and it keeps the negative criterion "The audit never prints, copies or sends the content of a session".

- AC4: The third level is the checks that the skill gives to a helper. These are the code map, the CTO advisor at its three moments, the three code reviews and the independent review. The code map is the exploration of the code that the ticket touches. The CTO advisor is a helper that raises the questions a technical lead would ask.
- AC5: For the third level, the audit checks that the check happened. It does not check which helper or which model did it, because Claude chooses its helpers.
- AC7: A step that the plan makes not applicable is not expected. For example, a ticket with no negative criterion has no "break the rule" step.

The ADRs that this block names:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-D: The settings file and the review model](../decisions/ADR-SIC-D-settings-file-and-review-model.md), which the ticket names for a review agent other than Claude.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

The only blocker is #89, which is closed as completed. Its pull request #113 is merged into `main`. #112, which changed the matching code that this ticket builds on, is closed too, and its pull request #115 is merged.

## Code mapping

**Entry point.** `audit()` in `cstack/src/commands/audit.ts` reads the plan, the run state and the guides (lines 41 to 88). Then it finds the session files with `findRunFiles()` (line 96), reads the calls with `readCalls()` (line 105), finds the main conversation with `mainFiles()` (line 106), and evaluates the phases and the steps (lines 107 to 118). It prints the phase lines and then the step lines (lines 119 and 120). It exits with 1 when a line is not done, a file is unreadable, or the main conversation had to fall back (line 126).

**The blocks of the real guides.** Every guide in `cstack/guides/resolve-issue/` opens with a block. The blocks hold seven `helper` steps. `questions.md` (line 4) has `resolve-issue:cto-review before-plan`. `plan.md` (line 3) has `resolve-issue:cto-review plan-delta | new-structural-decision`. `briefing.md` (line 2) has `resolve-issue:cto-review after-build`. `review.md` (lines 3 to 6) has four reviewers: `resolve-issue:code-reviewer-deep correctness`, `resolve-issue:code-reviewer-deep security`, `resolve-issue:code-reviewer conventions` and `resolve-issue:code-reviewer-simplicity`. `independent-review.md` (line 3) has `resolve-issue:pr-reviewer`. The code map has no helper step, because ADR-RQG-C says a block never lists `resolve-issue:code-explorer`. The blocks also hold 27 `action` steps, and these conditions: `each-unit`, `each-unit-with-test`, `each-stuck-unit` (`build.md`, lines 11 and 12), `each-dependent-ticket` (`document.md`, line 3), `user-interface` (`build.md`, line 15, on an action) and `new-structural-decision` (`plan.md`, line 3). No real block uses `each-negative-criterion`.

**The reader of the blocks.** `cstack/src/guide-steps.ts` defines the three kinds (line 5), the seven conditions (lines 8 to 16) and the `Step` type (lines 19 to 22). A helper step has `helper` and an optional `word`. This ticket reads these types and changes nothing in this file.

**The steps that the audit lists today.** `nodesOf()` (`cstack/src/audit/evaluate.ts`, line 88) keeps only the `command` steps with no condition or with `each-unit` or `each-unit-with-test` (line 89). It groups the consecutive conditional steps into one segment (lines 90 to 95). Today that grouping takes any condition, so a step with `new-structural-decision` would join a unit group. Each node has the ids of the nodes that must come before it (`before`). `evaluateSteps()` (line 129) walks the phases in the order of `PHASES`. For each node it takes the calls in the window of the phase that match the step (lines 196 to 198). Then `chooseCall()` (line 30) takes the first call at or after the floor, or else the latest call before it as "out of order". Nothing stops two nodes from taking the same call. That is the problem of the third comment on the ticket: one `cstack helper wait` call served the wait of several units.

**What the calls hold.** `Call` is `{ time, args, file, helper }` (`cstack/src/audit/calls.ts`, line 4). `readCalls()` (line 7) reads only the `tool_use` items named `Bash` with a string `input.command` (lines 20 to 22), and keeps each tool call id once (lines 23 to 26). It passes the command to `cstackCommands()` (`cstack/src/audit/shell.ts`, line 33), which keeps only the simple commands whose program is the word `cstack` (line 22). So today the audit sees no sub-agent launch and no `orca` command.

**The main conversation.** `mainFiles()` (`cstack/src/audit/main-session.ts`, line 23) returns the files of the main conversation. A step of a phase whose `runsIn` is "main conversation" takes only the calls of those files (`evaluate.ts`, line 188). The questions and plan phases run there, so the launches of the CTO advisor before the plan and after the plan draft must come from those files too.

**A launch of a sub-agent.** The ticket says the parent session holds an `Agent` tool call with the type in `input.subagent_type`, and that older versions of Claude Code name the tool `Task`. The retrospective of #112 says that the transcripts of helpers started by the executor lie directly in `<session id>/subagents/`. So the executor's own transcript holds the launches of the reviewers and of the CTO advisor after the build. The shape of a real launch is checked on a session of this run before the approval gate.

**The data for the conditions.** `PlanUnit` has `designSpecification` (`cstack/src/plan/read.ts`, line 99) for `user-interface`. The plan guide writes "No new decision since the question round" when there is no new structural decision (`cstack/guides/resolve-issue/plan.md`, line 25), which ADR-RQG-C uses for `new-structural-decision`. The ticket footer that the plan copies under `## Ticket` holds `Feeds: …`, for example `Feeds: #91, #92, #108`, or `Feeds: none` as in #91. No module reads this footer yet. A stuck unit has a report `units/<n>/reports/<time>-stuck.json` in the run folder, and `latestStuckReportPath()` finds it (`cstack/src/report/reports.ts`, line 233). That function throws `RunStateError` with a path in its message when a report is not valid JSON (line 215).

**The settings.** `readSettings(root)` (`cstack/src/settings.ts`, line 169) returns the `review` setting with its `agent` (line 35). It throws `SettingsError` when the file is not valid. The default agent is `claude` (line 66).

**The action steps.** No `cstack` call proves an action step. Most of them write a plan section that the close of the phase already checks. `cstack next --done` refuses to close `dependencies`, `code-map`, `questions`, `review`, `document`, `briefing`, `after-build-questions` and `ready` while their section is empty, and refuses to close `plan` while the status is not `approved` (`cstack/src/phases.ts`, lines 95 to 115).

**Tests.** `cstack/test/audit.test.ts` builds a repository, a run state, a home folder with session files and a folder of guides by hand (`setup()`, line 142). Its build guide is the fixture `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md`, which holds helper steps and conditional steps. The tests of the shape of the blocks also read that fixture, so this ticket adds its own fixture instead of changing it. Four existing cases will change on purpose, because they check today's behaviour that this ticket replaces. "prints every command line as done for a full run" (line 449) expects exit 0 with no launch in the sessions. "does not print helper steps, action steps or steps with another condition" (line 492) expects no helper line. "never takes the wait of the main conversation for a unit whose wait was never run" (line 800) expects one wait call to serve units 2 and 3. The cases of "nothing private leaves the command" (line 807) allow only the lines of command steps.

**Recent changes and companions.** `cstack/src/audit/evaluate.ts` changed in seven commits of #89 and #112. Four of them were fixes of the windows and the floors (`a4fb417`, `d4ccb41`, `303264a`, `0b8eb96`). Its usual companions are `cstack/test/audit.test.ts`, `cstack/src/commands/audit.ts`, `cstack/src/audit/match.ts` and the `cstack audit` paragraph of `README.md` (line 54).

**Risks.** The floor rules are where the last fixes landed, so every change to `nodesOf()` and `evaluateSteps()` needs a test where the order of the calls and the order of the block disagree. A rule that one call serves only one step changes which call a step takes, so the existing tests of #89 and #112 must run after each unit. The `each-stuck-unit` steps come after `cstack unit commit <n>` and `cstack helper wait <helper id>` in the block of `build.md`, but a real escalation starts before the unit's commit. A plain floor rule would print them "out of order" on the normal path of a stuck unit.

**Governing decisions.** ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`) defines the kinds, the seven conditions and what each one means. It says the audit checks exactly `cstack unit red`, `cstack unit green` and `cstack unit commit` for each unit. It says milestone R2 replaces the `cstack helper start` commands with `helper:` steps. The specification says the audit never checks orchestration and never prints the content of a session (US-1, negative criteria). The interfaces of #89 stay: the format of a line and the exit codes 0, 1 and 3. The files of this ticket hold no `WHY:` or `DECISION:` comment.

## Decisions

- Build on what #112 changed. Each call keeps its origin as a file number and a "sub-agent" flag, never as a path. The steps of the main conversation match only the calls of the main conversation's sessions. Keep the tests of #112 passing. (2026-11-23, from the brief of the run)
- Every test fixture is built by hand. To check the shape of a real session file, read only a session file of this run. Never copy any part of a real session into the repository, and never read the session files of another run. (2026-11-23, from the brief of the run)
- This ticket works only in `cstack/src/audit/`, `cstack/src/commands/audit.ts`, its own test files and fixtures, and, when they need a change, the `cstack audit` entry of `cstack/src/manifest.ts` and the `cstack audit` paragraph of `README.md`. The plan file and the retrospective of this run are added too. #94 works on `cstack tracker list` at the same time, in its own worktree, so never change its entry or its paragraph. (2026-11-23, from the brief of the run)
- This ticket changes no guide in `cstack/guides/` and nothing under `cstack/src/measure/`. Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-23, from the brief of the run)
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
- The review phase prints four reviewer lines, not three, because the block of `review.md` has four helper steps (`cstack/guides/resolve-issue/review.md`, lines 3 to 6). The comment of #88 on the ticket says so. (2026-11-23, assumption not asked)
- The lines of the helper steps print after all the lines of the command steps, in the order of `PHASES` and of each block. `evaluateSteps()` returns the command lines first and the helper lines after them, so `cstack/src/commands/audit.ts` keeps printing the phase lines and then the step lines (line 119). A helper step still takes part in the order of its block: it takes its floor from the steps before it, and it gives a floor to the steps after it. (2026-11-23, assumption not asked, from item 6 of the scope)
- The line of a helper step reads `<phase>: <helper>`, followed by one space and its word when it has one, for example `review: resolve-issue:code-reviewer-deep security`. Then come the colon, the verdict, the time and the kind of proof, as `formatLine()` writes them (`cstack/src/audit/evaluate.ts`, line 19). (2026-11-23, assumption not asked)
- The conditions follow the meanings of ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, section "Decision"). `user-interface` applies once when a unit of the plan has a `Design specification` line (`designSpecification` in `PlanUnit`, `cstack/src/plan/read.ts`, line 99). `new-structural-decision` applies once when the plan file does not hold the sentence "No new decision since the question round". `each-dependent-ticket` repeats the step once for each ticket that the `Feeds:` part of the ticket footer names. `each-negative-criterion` counts as false, so its steps are never listed, until #98 adds the data. A step whose condition is false is not listed at all. (2026-11-23, from ADR-RQG-C and item 5 of the scope)
- `each-dependent-ticket` reads the last line of the `## Ticket` section of the plan that holds `Feeds:`. It splits the text after `Feeds:` on commas, trims each item and removes `**`. It drops the empty items and the item `none`, in any case. The number of the items left is the number of dependent tickets. A ticket with no such line has none. (2026-11-23, assumption not asked, from the footer of #90 and of #91)

- The audit never prints a line for a step of the `action` kind, whatever its condition. #89 already leaves them out. The `cstack audit` paragraph of `README.md` says so, and says that the close of most phases already refuses an empty plan section (`cstack/src/phases.ts`, lines 95 to 115). (the user, on 2026-11-23, accepted by default)
- This ticket adds no condition for the big decisions of the document phase, and it changes nothing in `cstack/src/guide-steps.ts`. The pull request and the comment on this ticket name it as a follow-up for the user to decide. (the user, on 2026-11-23, accepted by default)
- A call or a launch serves at most one line of the whole audit. The step lines and the helper lines take part in this rule. The phase lines of `evaluatePhases()` (`cstack/src/audit/evaluate.ts`, line 38) do not take part and take no call, so a phase line and the `cstack next --done <phase>` step of the same phase still share their call. (the user, on 2026-11-23)
- The lines take their evidence one after the other, in the order of `PHASES` and then in the order in which `nodesOf()` returns the nodes of each block. A line looks only at the calls or launches that no earlier line took. Among them, the first one at or after its floor gives "done". When there is none, the latest one before its floor gives "out of order". The chosen call or launch is then taken, in both cases. A line whose evidence comes from the run state or from git takes no call. (2026-11-23, decided in the plan, from the answer of the user)
- With that rule, the existing case "never takes the wait of the main conversation for a unit whose wait was never run" (`cstack/test/audit.test.ts`, line 800) expects the third wait line to be exactly `build: cstack helper wait <helper id>: skipped`. Units 1 and 2 already took the two wait calls of the build phase. (the user, on 2026-11-23)
- Only a launch proves a helper step, and a plan section never does. A launch of a sub-agent is a `tool_use` item named `Agent` or `Task` on a line whose `type` is "assistant" and whose `timestamp` parses as a date, with a string `input.subagent_type`. It counts for a helper step when `input.subagent_type` equals the helper name of the step, such as `resolve-issue:cto-review`. The audit checks neither the model, nor the prompt, nor the description. (the user, on 2026-11-23)
- A launch of another type, such as `general-purpose`, never counts for a helper step. A `tool_use` named `SendMessage` is never a launch, even when it reaches a sub-agent of the right type, because the guides ask for a fresh launch (`cstack/guides/resolve-issue/plan.md`, line 25). (the user, on 2026-11-23, accepted by default)
- `each-stuck-unit` counts as false for now, like `each-negative-criterion`, so its steps are never listed. The `cstack audit` paragraph of `README.md` lists this as a limit. The audit never reads the stuck reports of the run folder. (the user, on 2026-11-23)
- A run of consecutive listed helper steps that do not repeat forms one group whose steps are not ordered among themselves. This covers the four reviewers of `review.md` (lines 3 to 6). Each step of the group follows the segment before the group. The segment after the group follows every step of the group, so its floor is the latest time among them. The two `resolve-issue:code-reviewer-deep` steps take the launches of that type in time order, because each one takes the first launch that is free and at or after its floor. (the user, on 2026-11-23, accepted by default)
- When `review.agent` in `.cstack/settings.json` is not `claude`, the helper step `resolve-issue:pr-reviewer` also accepts an Orca worker launch. An Orca worker launch is a simple command of a Bash call whose program is `orca`, `orca-dev` or `orca-ide` and whose first two arguments are `orchestration` and `worker-start`. The audit does not check its `--agent` value. When `review.agent` is `claude`, an Orca worker launch never counts. A launch of `resolve-issue:pr-reviewer` counts in both cases. (the user, on 2026-11-23, accepted by default)
- The audit reads the settings with `readSettings(root)` (`cstack/src/settings.ts`, line 169), on the root of the repository that `readMoments()` returns, as the file is on disk when the audit runs. A missing file gives the defaults, so the review agent is `claude` (line 66). It reads them after the guides and before it looks for the session files. When `readSettings()` throws `SettingsError`, the audit prints `cstack audit: the settings file of the repository cannot be used.` on standard error and exits with 3. It never prints the message of `SettingsError`. (the user, on 2026-11-23, accepted by default; the sentence decided in the plan)
- A helper step of a phase whose `runsIn` is "main conversation" takes only the launches of the main conversation's files, as the command steps do (`cstack/src/audit/evaluate.ts`, line 188). These phases are ticket, dependencies, code-map, questions, plan and retro. A helper step of a phase that the executor runs takes the launches of every file, helper transcripts included. (2026-11-23, decided in the plan, from the rule of #112)
- In a session of this run, the launch of the CTO advisor is a `tool_use` item named `Agent`, on an "assistant" line with a `timestamp`. Its input keys are `description`, `prompt` and `subagent_type`, and `subagent_type` is `resolve-issue:cto-review`. Its transcript lies in `<session id>/subagents/`, and its `agent-<id>.meta.json` holds `agentType` with the same value. When one message holds several tool calls, each call has its own transcript line and its own `timestamp`, in the order in which the calls were written. The name `Task` was not seen in this run, and it comes from the ticket. (2026-11-23, checked on a session of this run)
- `readCalls()` (`cstack/src/audit/calls.ts`, line 7) returns `{ calls, launches, unreadableFiles }`. `calls` and `unreadableFiles` do not change. A launch is `{ time: number; file: number; helper: boolean; kind: "sub-agent"; type: string }` or `{ time: number; file: number; helper: boolean; kind: "orca worker" }`. `file` and `helper` mean the same as in `Call` (line 4). A launch never holds a prompt, a description, a command or a path. The same set of tool call ids covers the Bash items and the launch items, so a tool call id that appears in several files gives one call or one launch, with the origin of the first file of the list. `launches` is sorted by time, like `calls`. (2026-11-23, decided in the plan)
- `mainFiles()` (`cstack/src/audit/main-session.ts`, line 23) does not change. It still reads the `cstack` calls only, so an Orca worker launch or a sub-agent launch never makes a file count as the main conversation. (2026-11-23, decided in the plan)
- `cstack/src/audit/shell.ts` exports a new function `commandsOf(command: string, programs: readonly string[]): string[][]`. It returns the arguments after the program word of every simple command whose program is one of `programs` and is not quoted. It follows the same rules as `cstackCommands()` for quotes, comments, heredocs, separators, skipped words and redirections. `cstackCommands(command)` (line 33) keeps its signature and returns exactly what it returns today, and `cstack/test/audit-shell.test.ts` passes unchanged. (2026-11-23, decided in the plan)
- A new module `cstack/src/audit/conditions.ts` exports `readConditions(planText: string, plan: PlanRead): { dependentTickets: number; userInterface: boolean; newStructuralDecision: boolean }`. It reads only the text and the parsed plan, never a file. `newStructuralDecision` is false when the plan text holds "No new decision since the question round", ignoring case and treating any run of spaces and line breaks as one space. `dependentTickets` reads only the lines of the `Ticket` section, from `first` to `last` of its `PlanSection` (`cstack/src/plan/read.ts`, lines 80 and 81). (2026-11-23, decided in the plan)
- The audit lists the `command` steps and the `helper` steps of each guide. A step with no condition is listed once. `each-unit` repeats it for every unit of the plan, blocked units included. `each-unit-with-test` repeats it for every unit that has a `Test` line. `each-dependent-ticket` repeats it once for each dependent ticket. `user-interface` and `new-structural-decision` list it once when they hold, and not at all otherwise. `each-stuck-unit` and `each-negative-criterion` never list it. The steps that are not listed are removed before the segments are built. (2026-11-23, from ADR-RQG-C and the answers of the user)
- The listed steps of one guide form segments in the order of the block. A run of consecutive steps with `each-unit` or `each-unit-with-test` is one unit group, as today. A run of consecutive steps with `each-dependent-ticket` is one ticket group. A run of consecutive helper steps that are listed once is one helper group, whose steps are not ordered among themselves. Every other step is a segment of its own. A step listed once because `user-interface` or `new-structural-decision` holds never joins a unit group, so it prints once and not once per unit. (2026-11-23, decided in the plan)
- In a ticket group, the steps of the first dependent ticket come first, then those of the second, and so on. Inside one ticket, a step follows the step of the same ticket just before it, and the first one follows the segment before the group. The segment after the group follows the last step of every ticket. The text of each line is the text of the step, the same for every ticket, and `<n>` is not replaced. A line of a ticket group never prints the key of the ticket. (2026-11-23, decided in the plan)
- The text of a helper line is `<phase>: <helper>`, with one space and the word of the step after it when the step has a word. A helper line uses `formatLine()` (`cstack/src/audit/evaluate.ts`, line 19) unchanged, with the record `session` when a launch proves it. The audit exits with 1 when any line is not done, the helper lines included. The exit codes 0, 1, 2, 3 and 5 keep their meaning. (2026-11-23, from item 6 of the scope)
- The `cstack audit` entry of `cstack/src/manifest.ts` (lines 77 to 91) keeps its usage, its flags, its file and its ticket. Its summary becomes "Say which phases, required commands and helper checks of one run were done, skipped or done out of order.". The text of exit code 0 becomes "Every phase, every required command and every helper check was done.". The text of exit code 1 starts with "A phase, a command or a helper check was skipped or done out of order," and keeps the rest. The text of exit code 3 becomes "The plan file, the run state, a guide, the settings file or the session files cannot be used.". (2026-11-23, decided in the plan)
- The fixture `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md` does not change, because the tests of the shape of the blocks read it too. The new cases of this ticket write their own guides and plans inside `cstack/test/audit.test.ts`, with `writeGuides()` and the `plan` option of `setup()`. (2026-11-23, decided in the plan)
- Four existing cases of `cstack/test/audit.test.ts` change on purpose. "prints every command line as done for a full run" (line 449) gets a launch for every helper step, so it still exits with 0. "does not print helper steps, action steps or steps with another condition" (line 492) becomes a case that action steps and steps whose condition is false are never printed. "never takes the wait of the main conversation for a unit whose wait was never run" (line 800) expects `skipped`. The cases of "nothing private leaves the command" (line 807) also allow the helper lines. When any other existing case of the audit tests fails, the implementer does not change it, and reports the unit as stuck. (2026-11-23, decided in the plan)
- Before the pull request opens, the main conversation builds the code and runs `node cstack/dist/bin.js audit <plan file>` on this run. It checks four things. `questions: resolve-issue:cto-review before-plan` is done at the time of the launch of the CTO advisor in the questions phase. The four review lines and `briefing: resolve-issue:cto-review after-build` are done. `independent-review: resolve-issue:pr-reviewer` is done. No line `plan: resolve-issue:cto-review plan-delta` is printed, because this plan holds the sentence of the plan guide. When one of these checks fails, that is a new question for the user before the pull request opens. (2026-11-23, decided in the plan, from the retrospective of #89)
## Architecture

The approach is locked by the answers of the question round, and it extends the modules of #89 and #112. The session reader also keeps the launches of sub-agents and of Orca workers, apart from the `cstack` calls. A new module reads the conditions from the plan. `nodesOf()` expands each listed step by its condition and adds helper nodes, with an unordered group for consecutive helpers. `evaluateSteps()` keeps a record of the calls and launches that lines already took, and returns the helper lines after the command lines. The command reads the settings to know the review agent. No new decision since the question round.

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

### Unit 1: Read the launches of helpers from the session files
- Files: `cstack/src/audit/shell.ts`, `cstack/src/audit/calls.ts`, `cstack/test/audit-calls.test.ts`
- Test: `cstack/test/audit-calls.test.ts`: `readCalls()` returns a sub-agent launch for an `Agent` call and for a `Task` call with a string `subagent_type`, holding exactly `time`, `file`, `helper`, `kind` and `type`; it returns no launch for a `SendMessage` call, for an `Agent` call whose `subagent_type` is missing or not a string, and for an `Agent` call on a line with no valid timestamp; it returns an Orca worker launch for a Bash call that runs `orca orchestration worker-start`, one for `orca-dev orchestration worker-start` and one for `orca-ide orchestration worker-start`; it returns no launch for `echo orca orchestration worker-start`, for `orca orchestration check` and for `'orca' orchestration worker-start`; a launch whose tool call id appears in two files is returned once, with the origin of the first file; a file that holds one Bash `cstack` call and one launch gives the same `calls` as before and exactly one launch.
- Minimum code: Add `commandsOf(command, programs)` to `cstack/src/audit/shell.ts`, and make `cstackCommands(command)` return `commandsOf(command, ["cstack"])`. Add the type `Launch` and the list `launches`, sorted by time, to `readCalls()` in `cstack/src/audit/calls.ts`.
- Refactor: None.
- Commit message: feat(cli): read the launches of helpers from the session files in cstack audit
- Depends on: none

Each case of the `Test` line is its own `it()`, so each one can fail first. `cstack/test/audit-shell.test.ts` must pass unchanged.

### Unit 2: Read the conditions of the steps from the plan
- Files: `cstack/src/audit/conditions.ts`, `cstack/test/audit-conditions.test.ts`
- Test: `cstack/test/audit-conditions.test.ts`: `readConditions()` gives 3 dependent tickets for a ticket footer `**Size: M** · Blocked by: #89 · Feeds: #91, #92, #108`; 0 for `Feeds: none` and for `Feeds: None`; 0 when the `Ticket` section has no `Feeds:` line; 0 when the only `Feeds:` line is outside the `Ticket` section; the count of the last `Feeds:` line when the section holds two; 1 for `Feeds: #91**`; `userInterface` true when a unit has a `Design specification` line and false otherwise; `newStructuralDecision` false when the plan holds "No new decision since the question round", false when it holds "no new decision since the\nquestion  round", and true when it holds neither.
- Minimum code: Write `cstack/src/audit/conditions.ts` with `readConditions(planText, plan)`.
- Refactor: None.
- Commit message: feat(cli): read the conditions of the mandatory steps from the plan in cstack audit
- Depends on: none

The test imports the new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does, and builds each plan text by hand.

### Unit 3: Let one call serve only one line of the audit
- Files: `cstack/src/audit/evaluate.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: with a build block whose units each have their start, red, green and commit calls and only one `cstack helper wait` call after the commit of unit 1, the wait line of unit 1 is done and the wait lines of units 2 and 3 are skipped; with only one wait call that comes before the commit of unit 1, the wait line of unit 1 is out of order and the wait lines of units 2 and 3 are skipped; when the main conversation has its plan wait and no retro wait, `retro: cstack helper wait <helper id>` is skipped; and the existing case "never takes the wait of the main conversation for a unit whose wait was never run" expects `build: cstack helper wait <helper id>: skipped` for unit 3.
- Minimum code: In `evaluateSteps()`, keep the set of the calls that lines already took. Give `chooseCall()` only the calls that no line took, and mark the call it chooses as taken, for "done" and for "out of order".
- Refactor: None.
- Commit message: fix(cli): let one call serve only one line in cstack audit
- Depends on: none

The full-run case "prints every command line as done for a full run" guards the rule that a phase line and the `cstack next --done <phase>` step of the same phase share their call. It must stay green.

### Unit 4: List the command steps whose condition holds
- Files: `cstack/src/audit/evaluate.ts`, `cstack/src/commands/audit.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: with `Feeds: #91, #92` in the ticket of the plan and a document block with a ticket comment and a dependent-ticket comment, the document phase prints the line of the ticket comment and then two dependent-ticket lines, and with three `cstack tracker comment` calls all three lines are done; with one call, only the first of those three lines is done and the two others are skipped; with `Feeds: #91` one dependent-ticket line is printed, and with `Feeds: none` in a second run none is; a command step with `user-interface` is printed when a unit has a `Design specification` line, and not printed in a second run where no unit has one; a command step with `new-structural-decision` is printed when the plan does not hold the sentence, and not printed in a second run where it does; a command step with `new-structural-decision` right after a step with `each-unit` prints exactly once; in a block with a dependent-ticket step, an `each-stuck-unit` step and an `each-negative-criterion` step, and with `Feeds: #91` and a stuck report saved for unit 1 in the run folder, only the dependent-ticket line of those three steps is printed.
- Minimum code: `cstack/src/commands/audit.ts` reads the conditions with `readConditions()` and passes them in `StepInput`. `nodesOf()` expands each command step by its condition and builds the unit groups, the ticket groups and the single steps.
- Refactor: None.
- Commit message: feat(cli): list the command steps whose condition holds in cstack audit
- Depends on: 2, 3

Each case of the `Test` line is its own `it()`. A case that checks that a line is not printed also checks a line that is printed, in the same `it()`, so it fails before the code exists. The stuck report is a hand-written file `units/1/reports/<time>-stuck.json` in the run folder of the fixture.

### Unit 5: Check the helper steps of each phase
- Files: `cstack/src/audit/evaluate.ts`, `cstack/src/commands/audit.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: in a fixture run where the CTO advisor was launched in the questions phase and in the plan phase by the main conversation, and in the briefing phase from a helper transcript, the three lines of `resolve-issue:cto-review` print as done; a run with no launch of a code reviewer prints the four review lines as skipped; one launch of `resolve-issue:code-reviewer-deep` makes `review: resolve-issue:code-reviewer-deep correctness` done and `review: resolve-issue:code-reviewer-deep security` skipped; the four reviewers launched in the reverse order of the block all print as done; a launch of `resolve-issue:cto-review` in a helper transcript, inside the window of the questions phase, leaves `questions: resolve-issue:cto-review before-plan` skipped; a launch of `general-purpose` in that window leaves the same line skipped; a `SendMessage` call in the plan phase leaves `plan: resolve-issue:cto-review plan-delta` skipped; every helper line comes after every command line; in a block with a helper step, an action step and a helper step whose condition is false, only the line of the first helper step is printed; the output holds at least one helper line, every line is a phase line, a step line or a helper line with a fixed text, a verdict, a time and a record, and the output never holds a marker or a path that a launch's prompt, description or `subagent_type` holds.
- Minimum code: `nodesOf()` adds helper nodes and the helper groups. `evaluateSteps()` matches a helper node with the free launches of its type in the window, taking only the main conversation's launches in its phases, and returns the command lines before the helper lines. `cstack/src/commands/audit.ts` passes the launches in `StepInput`. Update the four existing cases named in `## Decisions`.
- Refactor: None.
- Commit message: feat(cli): check the helper steps of each phase in cstack audit
- Depends on: 1, 4

Each case of the `Test` line is its own `it()`, and a case that checks that a line is absent also checks a line that is present. The launches of the fixtures are hand-written `Agent` tool calls in the session files of `setup()`, with sample prompts only.

### Unit 6: Accept an Orca worker as the independent review
- Files: `cstack/src/audit/evaluate.ts`, `cstack/src/commands/audit.ts`, `cstack/src/manifest.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: with `{"review": {"agent": "codex", "model": "x"}}` in `.cstack/settings.json`, a Bash call `orca orchestration worker-start --agent codex` in the window of the independent-review phase makes `independent-review: resolve-issue:pr-reviewer` done, and in a second run with no settings file the same call leaves the line skipped; the same call with `orca-dev` makes the line done, and with `"agent": "claude"` in a second run it leaves it skipped; the same call with `orca-ide` makes the line done; a `.cstack/settings.json` that is not valid JSON makes the audit exit with 3, print exactly `cstack audit: the settings file of the repository cannot be used.` on standard error, print nothing on standard output, and name no path.
- Minimum code: `cstack/src/commands/audit.ts` reads the settings after the guides and passes `review.agent` in `StepInput`. `evaluateSteps()` lets an Orca worker launch prove `resolve-issue:pr-reviewer` when that agent is not `claude`. Update the text of the `cstack audit` entry of `cstack/src/manifest.ts` as `## Decisions` says.
- Refactor: None.
- Commit message: feat(cli): accept an Orca worker as the independent review in cstack audit
- Depends on: 5

Each case of the `Test` line is its own `it()`, and the check of a refusal compares the whole standard error with the sentence.

### Unit 7: Describe the helper checks and the conditions in the README
- Files: `README.md`
- No test: this unit changes only the `cstack audit` paragraph of the README.
- Minimum code: Add to the `cstack audit` paragraph (`README.md`, line 54) what the helper lines are and what proves them, the Orca worker for another review agent, the conditions that make a step not listed, the rule that one call serves only one line, and that action steps are not listed. Add to its limits that a stuck unit is not evaluated, that a `SendMessage` does not count, that a program named by `ORCA_CLI_COMMAND` is not recognised, that the settings are read as they are when the audit runs, and that `new-structural-decision` looks for an English sentence. Write it as the documentation rules of this repository ask: one idea per sentence, short sentences, plain words.
- Refactor: None.
- Commit message: docs: describe the helper checks and the conditions of cstack audit in the README
- Depends on: 6

## Documentation duties

- The `cstack audit` paragraph of `README.md`: applies, written by unit 7.
- The comment on this ticket: applies, written in the document phase. It says what the audit now checks, that the code map has no helper line because ADR-RQG-C keeps `resolve-issue:code-explorer` out of the blocks, and the follow-up about a `big-decision` condition.
- The comments on the dependent tickets #91, #92 and #108: applies, written in the document phase.
- ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`): applies, a short section added in the document phase. It records how the audit judges the helper steps and the conditions, that action steps stay out, that one call serves one line, and that `each-stuck-unit` counts as false for now. It changes none of the decisions of the record.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply. Its acceptance criteria do not change.
- The `cstack audit` entry of `cstack/src/manifest.ts`: applies, written by unit 6.

## Blocking questions

### Question 1: How the audit treats the action steps
The blocks hold 27 steps of the `action` kind, such as `approval-gate` and `write-decisions`, and no `cstack` call proves them. #89 leaves them out of the audit. Should the audit keep leaving them out? My recommendation is yes, with a sentence in the `cstack audit` paragraph of the README that says so. The close of most phases already refuses an empty plan section, and it refuses to close the plan phase while the status is not `approved` (`cstack/src/phases.ts`, lines 95 to 115). The other choice is to judge some of them from the final plan file, with no time, so with no check of their order.
- For: the user
- Answer: keep the action steps out of the audit, and add a sentence to the `cstack audit` paragraph of `README.md` that says so. Accepted by default by the user, on 2026-11-23.

### Question 2: A condition for the big decisions of the document phase
The block of `document.md` does not list the decision records or the `WHY:` comments, because the guide asks for them only when a run takes a big decision. Should this ticket add a condition such as `big-decision`? My recommendation is no. That condition would change the list of conditions in `cstack/src/guide-steps.ts`, the block of `document.md` and ADR-RQG-C, and the brief of this wave forbids changes to the guides. I would write it as a follow-up in the pull request and in the comment on this ticket, so you can decide whether it gets its own ticket.
- For: the user
- Answer: no `big-decision` condition in this ticket. It goes into the pull request and the comment on this ticket as a follow-up. Accepted by default by the user, on 2026-11-23.

### Question 3: One call serves only one line
Today two lines of the audit can take the same call. In the run of #112, one `cstack helper wait` call served the wait of units 1 to 4. Should a call, or a launch of a helper, serve at most one line of the whole audit? My recommendation is yes. Each line takes, in the order of the phases and of each block, the first call that it can use and that no earlier line took. This also stops the retro phase from taking the wait of the plan phase, which the retrospective of #112 found. One test of #112 changes with it: "never takes the wait of the main conversation for a unit whose wait was never run" (`cstack/test/audit.test.ts`, line 800). Today it expects the wait of unit 3 to be "out of order", with the time of the wait of unit 2. With this rule, that wait is "skipped", because unit 2 already took the call. The brief asks to keep the tests of #112 passing, so I need your yes to change that one expected line. The narrower choice is to apply the rule only between the units of one step that repeats for each unit. It changes the same test.
- For: the user
- Answer: yes. A call or a launch serves at most one step line or helper line of the whole audit. The phase lines do not take part, so a phase line and the `next --done` step of the same phase may share their call. The expected line of the test at line 800 of `cstack/test/audit.test.ts` changes from "out of order" to "skipped". The user, on 2026-11-23.

### Question 4: What proves that a helper did its check
Item 1 of the scope accepts two kinds of evidence: a launch of a helper of that type, or the plan section that the check fills. My recommendation is to accept only the launch. A launch is a tool call named `Agent`, or `Task` in older versions of Claude Code, whose `subagent_type` is the name of the helper, such as `resolve-issue:cto-review`. It must sit in the window of the phase. The audit checks neither the model nor the prompt. When a phase has two steps with the same helper, such as the two `resolve-issue:code-reviewer-deep` steps of the review phase, each step needs its own launch, and the first launch goes to the first step of the block. I would drop the plan section as evidence for two reasons. The four code reviewers and the independent review all write into the same "Review log", so a filled section would make a missing review look done. And the close of each phase already refuses an empty section. This changes item 1 of the scope, so I need your answer.
- For: the user
- Answer: yes. Only a launch of a sub-agent of the right type proves a helper step, and a plan section never does. The user, on 2026-11-23.

### Question 5: How an Orca worker proves the independent review
Item 3 of the scope accepts an Orca worker as the evidence of the independent review when the settings name another review agent than Claude. My recommendation is this. When `review.agent` in `.cstack/settings.json` is not `claude`, a shell call that runs `orca orchestration worker-start` in the window of the independent-review phase also counts for the step `resolve-issue:pr-reviewer`. The audit does not check the `--agent` value. A launch of `resolve-issue:pr-reviewer` still counts too. The audit reads the settings file as it is on disk when the audit runs.
- For: the user
- Answer: yes, as recommended, with the programs `orca`, `orca-dev` and `orca-ide`. An invalid settings file makes the audit exit with 3. Accepted by default by the user, on 2026-11-23.

### Question 6: The steps of a stuck unit
The block of `build.md` lists `cstack helper start implementer-escalation` and a second `cstack helper wait` with the condition `each-stuck-unit`. Should the audit evaluate that condition now? My recommendation is no: count it as false for now, like `each-negative-criterion`, so these two steps are never listed. Item 4 of the scope evaluates the conditions against the plan and the settings, but a stuck report lives in the run folder, as `units/<n>/reports/<time>-stuck.json`. The block lists the escalation after the unit's commit and wait, while a real escalation starts before the commit, so it would need a special order rule in `cstack/src/audit/evaluate.ts`. `latestStuckReportPath()` also throws an error whose message holds a path (`cstack/src/report/reports.ts`, line 215). Milestone R2 replaces these commands. A stuck unit that nobody escalated never reaches its commit, so its `cstack unit commit <n>` line already prints "skipped". The other choice is to evaluate it from the stuck reports, and to check the order of a stuck unit only against its first step.
- For: the user
- Answer: count `each-stuck-unit` as false for now, like `each-negative-criterion`. The user, on 2026-11-23.

## Review log

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- Should the block of `document.md` get a condition such as `big-decision`, so that the audit can check that a run recorded its big decisions in a decision record and in `WHY:` comments? It would change the list of conditions in `cstack/src/guide-steps.ts`, the block of `document.md` and ADR-RQG-C, so it needs a ticket of its own. For: the maintainer.
- Should the condition `new-structural-decision` also accept the sentence "No new decision since the question round" written in another records language? Today the audit looks for the English sentence, so a run whose `recordsLanguage` is not English always expects a second launch of the CTO advisor after the plan draft. A fix would change ADR-RQG-C. For: the maintainer.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**1. One call serves only one step line, and one expected line of a test of #112 changes.** In the run of #112, one `cstack helper wait` call served units 1 to 4. Without this rule, the lines of the dependent tickets prove nothing either. `<key>` matches any key, so the comment on the ticket itself would fill all of them. The case at line 800 of `audit.test.ts` goes from "out of order" to "skipped" for unit 3. I recommend yes, between step lines only. A phase line and the `next --done` step of the same phase may still share their call.

**2. Only the launch of a sub-agent of the right type proves a check, and the plan section does not.** This changes item 1 of the scope. The four reviewers all write into the same "Review log", so a filled section would hide a missing review. The cost is that a check made by a general-purpose agent prints "skipped". I still recommend the launch alone, because it has a time, so its order can be checked.

**3. I would rather not evaluate the steps of a stuck unit for now, unlike the draft.** The scope evaluates the conditions against the plan and the settings, but the stuck reports live in the run folder. It would need a special order rule in `evaluate.ts`, where the last four fixes landed. `latestStuckReportPath()` also throws an error that holds a path. Milestone R2 replaces these commands, and a unit that never finished already shows a skipped commit.

**I will do this unless you say no**

- The `action` steps stay out of the audit, and the README says so, because closing a phase already refuses an empty section.
- No condition for the big decisions: it would change the guides, which the brief of the run forbids. I will propose it as a follow-up in the pull request.
- When `review.agent` is not `claude`, a call to `orca orchestration worker-start` in the window of the independent review counts too. I also accept `orca-dev` and `orca-ide`, which the orchestration skill uses on some machines. An invalid settings file makes the audit exit with 3.
- The four reviewers are not ordered among themselves. Claude often launches them in one message, in any order, and the block order would print them "out of order" by mistake.
- A `SendMessage` to a sub-agent that is already running does not count, because the plan guide asks for a new launch.

**I checked it myself**

In a session of this run, a launch is an `Agent` tool call whose `input.subagent_type` is `resolve-issue:cto-review`. The `.meta.json` file of the sub-agent holds the same type in `agentType`.

**Good to know**

- AC4 names the code map, but ADR-RQG-C keeps it out of the blocks. No line will cover it, and the comment on the ticket should say so.
- `new-structural-decision` looks for an English sentence. When the settings choose another records language, the audit will always expect the second launch of `resolve-issue:cto-review`.

#### Details

**One call serves only one step line (draft blocking question 3).** Blocking, and only the user can answer it, because it changes an expected line of a test that the brief of the run asks to keep passing. I keep the draft recommendation and narrow it. Today `chooseCall()` (`cstack/src/audit/evaluate.ts`, line 30) can give the same call to any number of nodes, and nothing records which calls are taken. The rule matters beyond the units. `matchHead()` (`cstack/src/audit/match.ts`, line 57) lets a placeholder such as `<key>` match any word. So in the block of `document.md` (line 3), the comment on the ticket itself and every `each-dependent-ticket` line match the same `cstack tracker comment` call, and the dependent-ticket condition would print "done" for comments that were never posted. The rule must cover the step lines and the helper lines only. `evaluatePhases()` (`evaluate.ts`, lines 38 to 66) proves the phase lines of the planning phases with the `cstack next --done <phase>` calls, and the blocks list that same command as their last step. If the phase lines took part, the step `questions: cstack next --done questions` would print "skipped" on every run. The lines take calls in the order they are evaluated, which is the order of `PHASES` and of each block. A line that falls back to "out of order" also takes the call it shows. The draft's narrower option, a rule only between the units of one repeated step, is rejected: it leaves the dependent-ticket lines and the plan and retro waits sharing calls. If nobody decides, the work stops there. The build cannot keep the test at line 800 unchanged and also fix the shared wait.

**Only a launch proves a helper step (draft blocking question 4).** Blocking, and only the user can answer it, because it narrows item 1 of the scope. I keep the draft recommendation. There is a tension with item 2 of the scope and with AC5, which say the audit does not check which helper did the check. I read AC5 as "not which model and not which instance": ADR-RQG-C says a helper step names a helper prompt, so the type of the launch is the identity of the check. The consequence is that a check done with `general-purpose`, a fork, or inline by the main conversation prints "skipped". The plan-section fallback is rejected for three reasons. The four reviewers and the independent review share the "Review log". A plan section has no time, so it cannot take part in the order of a block. And the main conversation can write the History block of the before-plan moment itself, which no close of a phase checks. The reader takes a `tool_use` item named `Agent` or `Task` and reads only `input.subagent_type`. It never keeps `input.prompt` or `input.description`, which hold paths and text of the run, so the negative criterion of the ticket stays true. If nobody decides, the scope item stays as written and the review lines can be proved by a filled section.

**The steps of a stuck unit (draft blocking question 6).** Blocking, and only the user can answer it. I disagree with the draft and recommend counting `each-stuck-unit` as false for now, like `each-negative-criterion`. Item 4 of the scope evaluates the conditions "against the plan and the settings". A stuck report lives in the run folder instead, as `units/<n>/reports/<time>-stuck.json`. The draft needs an exception to the floor rule for the units of the build block, and `nodesOf()` and `evaluateSteps()` are where the four last fixes landed (`a4fb417`, `d4ccb41`, `303264a`, `0b8eb96`). `latestStuckReportPath()` (`cstack/src/report/reports.ts`, line 233) throws `RunStateError` with a path in its message (line 215). So every call site would have to catch it before anything reaches the output. ADR-RQG-C says milestone R2 replaces the `cstack helper start` commands with `helper:` steps, so this work would be thrown away soon. The loss is small: a stuck unit that nobody escalated never reaches its commit, and the `cstack unit commit <n>` line already prints "skipped". The README paragraph lists the stuck unit as a limit. If nobody decides, the draft recommendation applies.

**The action steps (draft blocking question 1).** I relabel it non-blocking. The scope and the acceptance criteria of the ticket are met whatever the answer, and judging the actions from the final plan would be new scope for its own ticket. #89 already leaves them out, and `cstack next --done` refuses to close most phases while their section is empty (`cstack/src/phases.ts`, lines 95 to 115). The default is to keep them out and to add one sentence to the `cstack audit` paragraph of `README.md`.

**A `big-decision` condition (draft blocking question 2).** I relabel it non-blocking. A yes would change `cstack/src/guide-steps.ts`, the block of `document.md` and ADR-RQG-C, and the brief of the run forbids changes to the guides. So the only possible outcome in this ticket is the follow-up that the draft proposes, in the pull request and in the comment on the ticket.

**An Orca worker for the independent review (draft blocking question 5).** I relabel it non-blocking, because it only says how item 3 of the scope is built, and its acceptance case passes either way. I keep the draft recommendation and add three points. First, `worker-start` is the Orca subcommand that `cstack` itself uses to start a worker (`cstack/src/helper/start.ts`, line 286). Second, `toArguments()` (`cstack/src/audit/shell.ts`, line 20) accepts only the program word `cstack`. The orchestration skill picks the Orca program in this order: the value of `ORCA_CLI_COMMAND`, then `orca-dev`, `orca-ide` or `orca`. The audit accepts the last three names. The value of the environment variable cannot be known from the session, and the README lists it as a limit. The new calls must stay apart from the `cstack` calls, because `mainFiles()` (`cstack/src/audit/main-session.ts`, line 23) finds the main conversation from the `cstack` calls alone. Third, `readSettings()` (`cstack/src/settings.ts`, line 169) returns the defaults when the file is missing and throws `SettingsError` when it is invalid. Its messages name only `.cstack/settings.json`, never a full path (lines 178 to 210). The audit exits with 3 on that error, as it does for its other unusable inputs. The audit reads the settings on disk when it runs, so a settings change after the run changes the verdict, and the README says so.

**The order of the four reviewers.** Non-blocking, and it changes the assumption not asked in `## Decisions` that every helper step takes part in the order of its block. The review guide says "Launch four fresh reviewers" and gives no order between them (`cstack/guides/resolve-issue/review.md`, section "Four reviewers"). Claude often launches them in one message. Each launch then usually sits on its own transcript line, in the order in which the model wrote the calls. That order is not checked in this run. With the strict block order, launching `resolve-issue:code-reviewer-simplicity` before `resolve-issue:code-reviewer` prints a false "out of order" and makes the audit exit with 1 on a normal run. The rule is this. Consecutive helper steps of one block form a group, like the unit groups of `nodesOf()`. Each step of the group takes the floor of the step before the group, and the step after the group takes the latest time of the group. The two `resolve-issue:code-reviewer-deep` lines take the launches of that type in time order. The strict order is rejected because of the false alarm.

**A message to a sub-agent that is already running.** Non-blocking. The `Agent` tool of Claude Code tells the model to continue an existing agent with `SendMessage`, so the plan-delta moment could reuse the before-plan sub-agent. The plan guide asks for a new launch (`cstack/guides/resolve-issue/plan.md`, line 25). Counting a message would mean tying the recipient of the message to an earlier launch, for example through the `toolUseId` of the meta file, for one rare conditional step. That is rejected. The default is that a message does not count, and the README lists it as a limit.

**The shape of a real launch, checked.** The ticket asked to check on a real session which field names the type of a sub-agent. I read only the session files of this run. The main session holds one `Agent` `tool_use` on an `assistant` line, with the input keys `description`, `prompt` and `subagent_type`, and `subagent_type` is `resolve-issue:cto-review`. The helper's transcript lies in `<session id>/subagents/`, and its `agent-<id>.meta.json` holds `agentType` with the same value, plus `toolUseId` and `spawnDepth`. `cstack/src/measure/sessions.ts` (lines 162 to 166) skips that meta file today. The `Task` name of older Claude Code versions was not seen in this run, and it comes from the ticket.

**AC4 and the code map.** ADR-RQG-C keeps `resolve-issue:code-explorer` out of every block, and that decision is locked. So AC4 is met for the code map only through the phase line of `code-map`, and the comment on the ticket in the document phase should say it.

**The records language and `new-structural-decision`.** Non-blocking. ADR-RQG-C locks the meaning: the condition is true when the plan does not hold "No new decision since the question round". The settings accept another `recordsLanguage` (`cstack/src/settings.ts`, lines 39 and 235), and the plan guide asks for the sentence in that language. With another records language, the condition is always true and the plan-delta line prints "skipped". This ticket matches the English sentence while ignoring case and extra spaces. A fix belongs to a follow-up on ADR-RQG-C.

Already locked and not reopened: the kinds and the seven conditions of ADR-RQG-C, the line format and the exit codes 0, 1 and 3 of #89, and the rule of the brief that this ticket changes no guide. I checked security and authorization, data model lock-in, scale and performance, operations and cost, and reversibility, and found nothing beyond the points above.

### Open questions and answers

The round has six questions that change what this ticket builds. They are Blocking questions 1 to 6. The first three come from the comments on the ticket that the user approved.

- Blocking question 1, how the audit treats the action steps. Recommended answer: keep leaving them out, and say so in the README.
- Blocking question 2, a `big-decision` condition for the document phase. Recommended answer: not in this ticket, and a follow-up in the pull request and the ticket comment.
- Blocking question 3, one call serves only one line. Recommended answer: yes, across the whole audit, and the one test of #112 changes its expected line.
- Blocking question 4, what proves a helper step. Recommended answer: only a launch of a sub-agent of that type, and no plan section.
- Blocking question 5, how an Orca worker proves the independent review. Recommended answer: a shell call that runs `orca orchestration worker-start`, when the settings name another review agent.
- Blocking question 6, the steps of a stuck unit. Recommended answer, changed after the review of the questions: count the condition as false for now, like `each-negative-criterion`.

The user answered on 2026-11-23: "oui pour les trois, ok pour le reste". The three are the points that the review of the questions put first: Blocking questions 3, 4 and 6, each with its recommended answer. "The rest" accepts by default Blocking questions 1, 2 and 5, and the other points of the block "Questions you may not be asking": the four reviewers are not ordered among themselves, and a `SendMessage` to a running sub-agent does not count.

These points have an obvious default, so they are written under `## Decisions` as assumptions not asked.

- The review phase prints four reviewer lines, not three. The block of `review.md` has four helper steps, and the comment of #88 on the ticket says so.
- The helper lines print after all the command lines, as item 6 of the scope says. A helper step still takes part in the order of its block, like a command step.
- The conditions `user-interface`, `new-structural-decision` and `each-dependent-ticket` follow the meanings that ADR-RQG-C gives them. `each-negative-criterion` counts as false, as item 5 of the scope says.
- `each-dependent-ticket` counts the items after `Feeds:` in the ticket footer that the plan copies, and `Feeds: none` counts as zero.
- The line of a helper step reads `<phase>: <helper>`, followed by its word when it has one, such as `review: resolve-issue:code-reviewer-deep security`.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
