# Plan: #114 — R3-8: Make cstack publish refuse while a unit is not done

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/114
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/publish-units-done
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T20:53:06+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Make `cstack publish` refuse to push while a unit of the plan is not done and not blocked.

- **What the title means**: A unit is one small piece of the plan, with its own test and its own commit. A unit is done when a commit carries its `Cstack-Unit` trailer, which is a line at the end of the commit message that names the unit. A unit is blocked when the plan gives it a `- Blocked:` line with a reason. `cstack publish` pushes the branch and opens the pull request.
- **Why we are doing it**: In the run of #89, a question after the build added unit 9. The executor then ran `cstack publish` without building that unit, and `cstack publish` opened the pull request anyway. The missing unit needed a second push to the open pull request. The check that every unit is done exists, but only when the build phase closes, so a unit added later escapes it.
- **For the user**: A pull request never opens with a unit of the plan missing.

**Goal.** This ticket adds the check that every unit is done or blocked to the rules that `cstack publish` checks before any push.

### Where things are today (read first)

* **The rules of publish**: `cstack/src/commands/publish.ts` → `brokenRules()` (line 64) lists every broken rule before any push. It checks the open blocking questions (line 71), the `Status` line (line 73) and the `Ready for review at` line (line 76). It does not look at the units.
* **The check of the build phase**: `cstack/src/phases.ts` → `buildDone` (line 71) returns "Unit <n> has no commit with its trailer and no Blocked line." for each unit that has no commit and no `- Blocked:` line. `cstack next --done build` uses it (line 101). Reuse this check; do not write a second one.
* **The commits of a unit**: `cstack/src/plan/commits.ts` → `listUnitCommits()` (line 20) finds the commits of each unit by their trailer. `cstack/src/commands/plan-status.ts` (line 52) uses it to say whether a unit is done.
* **The tests**: `cstack/test/publish.test.ts` tests the refusals of `cstack publish` with fake programs, never the real `gh` or `git push`.
* **What #89 found**: `docs/retros/2026-11-23-89.md`, the last item of "Improve", tagged `[skill]`.

### Scope

1. `cstack publish` refuses, before any push, while a unit of the plan has no commit with its trailer and no `- Blocked:` line. Its message names each such unit, with the same words as the check of the build phase.
2. Reuse `buildDone` from `cstack/src/phases.ts`, or move it to a place that both commands can import. Do not copy it.
3. The refusal uses the exit code of the other broken rules of `cstack publish`, and it is listed with them.
4. The `publish` guide, `cstack/guides/resolve-issue/publish.md`, says what to do when this rule refuses: build the missing unit, or ask the user to block it. If you change the prose of a guide, keep its block of mandatory steps in line with it.

### Acceptance (TDD)

* `cstack/test/publish.test.ts`: write first a case where the plan has a unit with no commit and no `- Blocked:` line. See `cstack publish` push on today's code, then refuse with a message that names the unit. The fake `git` must never receive a push.
* The same file: a plan whose missing unit has a `- Blocked:` line is published.
* The same file: when every unit has its commit, `cstack publish` behaves as today.
* Negative: break the new rule on purpose, and see the first test fail.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #92 · Feeds: #104

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rule of the specification for every story.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

The ADRs that this block names, and those this ticket touches:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create". Its section "How a block chooses its steps" gives the rules for the block of mandatory steps of `publish.md`.
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three quality guards.
- [ADR-SIC-H: How a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md), which fixes the common exit codes that the refusal of `cstack publish` uses.

## Dependencies

clear

The only blocker is #92, "R1-6: Audit runs 3 and 4 in the private sandbox". It was closed as completed when this run started on 2026-11-23.

## Code mapping

The change is small and the ticket maps its files, so no wider exploration ran. The map below comes from reading the named lines, searching for the callers, and reading the git history of each file to change.

**Entry point.** `publish()` in `cstack/src/commands/publish.ts` (line 155) reads the plan (line 182) and the settings (line 183), then calls `brokenRules()` (line 184). When that list is not empty, it prints `cstack publish: nothing was pushed, because <n> rule(s) are broken.` followed by one `- <rule>` line per problem, and returns 1 (lines 185 to 187). Only after that does it look for the forge (line 189), update the branch (line 200), run the tests and push (line 219). So a rule added to `brokenRules()` stops the command before any fetch, rebase, test run, push or forge call.

**The rules today.** `brokenRules(root, plan, deps)` (line 64) checks, in this order: the open blocking questions (line 70), the `Status` line (line 73), the `Ready for review at` line (line 76), the tracked files with uncommitted changes (lines 80 to 90), the `## Pull request` section (line 92), the checked-out branch (lines 96 to 101), the two branch names (lines 103 to 108), and the home folder path (line 111). It runs git through `runProgram("git", …, { cwd: root, env: deps.env })` (line 65), so the tests can give it their own environment.

**The check to reuse.** `buildDone` in `cstack/src/phases.ts` (lines 71 to 74) is a `PhaseCheck`, which takes a whole `PhaseContext` (lines 22 to 29: `plan`, `commits`, `doneAt` and an optional `lastAcceptedDoneReportAt`). It reads only `plan` and `commits`. It returns `Unit <n> has no commit with its trailer and no Blocked line.` for each unit with no `blocked` value and no commit in `commits.units[<n>]`. The build phase uses it as its done check (line 101). `cstack next` builds the context in `phaseContext()` (`cstack/src/run-progress.ts`, line 28), where `commits` is a getter that calls `listUnitCommits(cwd, plan.header["Target branch"])` (line 36).

**The commits of the units.** `listUnitCommits(repoDir, targetBranch)` (`cstack/src/plan/commits.ts`, line 20) lists the commits of `<base>..HEAD` with their `Cstack-Unit` trailers. The base is the upstream of the local target branch when it has one, and the local target branch otherwise (lines 28 to 34). It throws `PlanFormatError` (exit code 3, `cstack/src/plan/read.ts`, line 128) when the target branch name is not valid (line 22), when the local target branch does not exist (line 26), or when `git log` fails (line 42). It runs `git` with `spawnSync` and the environment of the process, not with `deps.env` (line 12). `readPlan()` already refuses a `Target branch` line that is not a valid name (`cstack/src/plan/read.ts`, line 237), so in `cstack publish` only the last two causes can happen. `cstack/src/plan/` belongs to #98 in this wave, so this ticket does not change `commits.ts`.

**A trap in the existing tests.** The case "refuses when there is no target ref to compare with" (`cstack/test/publish.test.ts`, line 853) deletes the local `main` and `origin/main`, then expects exit code 1 and the words `origin/main` and `git fetch origin main` from the home folder rule (`cstack/src/publish/home-folder.ts`, line 102). If `cstack publish` let the `PlanFormatError` of `listUnitCommits()` escape, this case would get exit code 3 instead. So the new rule must catch that error and report it as one more broken rule.

**The test helper.** `makePublishEnv()` (`cstack/test/helpers/publish-env.ts`, line 96) builds a real git repository with a bare remote, fake `gh`, `glab` and `ssh`, and a `post-receive` hook that logs every push (lines 115 to 117). It commits the plan fixture `cstack/test/fixtures/plans/ready-for-review.md` (line 120). That fixture has unit 1 and unit 2 with no commit, and unit 3 with a `- Blocked:` line (lines 37 to 62). So, once the new rule exists, every existing case that expects a push would be refused. The fixture is shared with `cstack/test/run-state.test.ts` (line 43) and `cstack/test/next.test.ts` (line 158), so it must not change. The helper must instead commit one file with the trailer `Cstack-Unit: 1` and one with `Cstack-Unit: 2` after the plan, with `commitFiles()` (`cstack/test/helpers/plan-repo.ts`, line 34). `cstack/test/e2e/resolve-issue.test.ts` imports only `writeFakePrograms()` from that helper (line 10), and its run builds all three units before it publishes, so it is not affected. The tests check that nothing was pushed with `env.pushes()` and that no forge client ran with `refused()` (`cstack/test/publish.test.ts`, line 21).

**The guide.** `cstack/guides/resolve-issue/publish.md` says under "Exit code 1" (line 43) that an open blocking question leads to a needs-decision report, and that any other reason is fixed before the command runs again. The guide limits what the executor reads to the header, "Blocking questions", "Pull request", "Documentation" and "Executor notes" (line 9). Its block of mandatory steps (lines 1 to 5) lists `cstack publish`, `cstack next --done publish` and `cstack helper done published`. ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, section "How a block chooses its steps", line 58) says that a block describes the normal path, and that a command that refuses belongs to another path. So prose about the exit code 1 path adds no step to the block. `cstack/guides/resolve-issue/after-build-questions.md` (line 28) already has a sentence for a unit added late: build it with an implementer as `cstack guide build` says, then run the reviews that the change calls for, as `cstack guide review` says, on the new commits only.

**The documentation.** The `cstack publish` paragraph of `README.md` (line 71) says that the command refuses while the plan is not ready or a blocking question is open. The `cstack publish` entry of `cstack/src/manifest.ts` (lines 200 to 218) already describes exit code 1 as "Refused before any push.", so it needs no change.

**Governing decisions.** ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`) fixes the common exit codes. ADR-RQG-C fixes how a guide's block of mandatory steps follows its prose. No `WHY:` or `DECISION:` comment sits in `publish.ts` or `phases.ts` near the lines to change.

**Risks.** `publish.ts` and `publish.test.ts` changed together in 10 of their last 30 commits, often in review fixes, so the review should look hard at the refusal paths. `listUnitCommits()` compares with the local target branch when it has no upstream. If that local branch is older than the base of the ticket branch, commits of other tickets that carry a `Cstack-Unit` trailer could count as done. This weakness is shared with the build check and `cstack plan status`, and this ticket does not change it. `listUnitCommits()` reads the git settings of the real home folder in the tests, because it does not take `deps.env`. This is harmless for `git log` and `git rev-parse`. #98 works in `cstack/src/plan/` at the same time and may change the shape of `PlanRead` or `PlanUnit`. `buildDone` reads only `unit.number` and `unit.blocked`.

## Decisions

- This ticket works only in `cstack/src/commands/publish.ts`, `cstack/src/phases.ts`, the publish tests, the guide `cstack/guides/resolve-issue/publish.md`, and, when they need a change, the `cstack publish` entry of `cstack/src/manifest.ts` and the `cstack publish` paragraph of `README.md`. The plan file and the retrospective of this run are added too. Three other tickets of epic #84 run at the same time, each in its own worktree. #91 works in `cstack/guides/resolve-issue/retro.md`, the retrospective template, `cstack/src/commands/audit.ts`, the `cstack audit` paragraph of `README.md` and ADR-RQG-C. #98 works in `cstack/src/plan/`, the plan template, the plan fixtures and tests, a new ADR-RQG-B and section 9 of the specification. #99 works in `cstack/src/settings.ts`, `cstack/src/test-run.ts`, a new module for the test report, their tests and a new paragraph of `README.md` about its option. When this ticket needs a file of another ticket of the wave, the main conversation asks the coordinator before it changes that file. (2026-11-23, from the brief of the run)
- This ticket does not change the version in `cstack/package.json` or `cstack/package-lock.json`, and it adds no runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` is the first guide of a run, and `cstack/test/skill-size.test.ts` counts it with `SKILL.md`. It has almost no margin left. A sentence added there needs words removed elsewhere in the same file or in `SKILL.md`. (2026-11-23, from the brief of the run)
- If this ticket changes the prose of `cstack/guides/resolve-issue/publish.md`, it keeps the block of mandatory steps at the top of that guide in line with the prose. ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, section "How a block chooses its steps") gives the rules. (2026-11-23, from the brief of the run)
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
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. The installed `cstack` 0.3.2 runs this run, and its `cstack publish` does not check it yet. (2026-11-23, from the brief of the run and the retrospective of #89)
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
- `brokenRules()` checks the units right after the three rules about the plan, which are the open blocking questions, the `Status` line and the `Ready for review at` line (`cstack/src/commands/publish.ts`, lines 70 to 78). So its lines come before the rule about uncommitted files in the message. (2026-11-23, assumption not asked)
- The refusal prints exactly the strings that `buildDone` returns, one `- ` line for each unit, in the order of the plan. Each one reads `Unit <n> has no commit with its trailer and no Blocked line.` (`cstack/src/phases.ts`, line 74). (2026-11-23, from the ticket, item 1 of the scope)
- `cstack publish` reads the commits with `listUnitCommits(root, plan.header["Target branch"])` (`cstack/src/plan/commits.ts`, line 20), as the build phase does (`cstack/src/run-progress.ts`, line 36). This ticket does not change `cstack/src/plan/commits.ts`, which lies in the folder of #98. (2026-11-23, assumption not asked)
- `makePublishEnv()` (`cstack/test/helpers/publish-env.ts`, line 96) commits one file with the trailer `Cstack-Unit: 1` and one with `Cstack-Unit: 2` right after the plan, with `commitFiles()` (`cstack/test/helpers/plan-repo.ts`, line 34). So every existing case starts from a plan whose units are all done or blocked. The fixture `cstack/test/fixtures/plans/ready-for-review.md` does not change, because `cstack/test/run-state.test.ts` (line 43) and `cstack/test/next.test.ts` (line 158) read it too. (2026-11-23, assumption not asked)
- The `cstack publish` paragraph of `README.md` (line 71) gets one more sentence after "It refuses to publish while the plan is not ready or a blocking question is open.". The sentence says that it also refuses while a unit of the plan has no commit with its `Cstack-Unit` trailer and no `Blocked` line. The `cstack publish` entry of `cstack/src/manifest.ts` does not change, because exit code 1 already reads "Refused before any push." (line 205). (2026-11-23, assumption not asked)
- `buildDone` in `cstack/src/phases.ts` (line 71) takes `Pick<PhaseContext, "plan" | "commits">` instead of a whole `PhaseContext`. Its body and its message do not change, and the build phase still uses it as its done check (line 101). (2026-11-23, the user's answer)
- `brokenRules()` in `cstack/src/commands/publish.ts` reads the commits with `listUnitCommits(root, plan.header["Target branch"])` and passes them to `buildDone({ plan, commits })`. It never copies the check of `buildDone`, and it does not build a `PhaseContext` with a made-up `doneAt`. (2026-11-23, from the ticket, item 2 of the scope, and the user's answer)
- The refusal uses exit code 1 and the message of the other broken rules: `cstack publish: nothing was pushed, because <n> rule(s) are broken.`, followed by one `- <rule>` line per problem (`cstack/src/commands/publish.ts`, lines 185 to 187). Nothing is fetched, rebased, tested or pushed, and no forge client runs. (2026-11-23, from the ticket, item 3 of the scope)
- When `listUnitCommits()` throws a `PlanFormatError`, `brokenRules()` catches it and adds one rule: `cstack cannot tell which units have a commit: <the message of the error>`. When the local target branch does not exist, the rule then ends with `` Run `git branch --track <target> origin/<target>`, then run `cstack publish` again.``, where `<target>` is the value of the `Target branch` line. With `main`, the whole rule reads `` cstack cannot tell which units have a commit: The target branch "main" does not exist. Run `git branch --track main origin/main`, then run `cstack publish` again.``. `brokenRules()` checks that the local branch exists with `git rev-parse --verify --quiet refs/heads/<target>`, through its own `git` helper (line 65). Any other error is thrown again. (2026-11-23, the user's answer; the exact sentence decided in the plan)
- When the local target branch exists, the rule about commits that cannot be read never holds `git branch --track`. (2026-11-23, decided in the plan)
- This ticket does not add the check to `cstack next --done ready`, and it changes no other phase. (2026-11-23, the user's answer)
- A test case keeps `refs/remotes/origin/main`, deletes only the local `main`, and expects exit code 1, the whole rule about commits that cannot be read with its `git branch --track main origin/main` ending, and no push. On today's code this case is published, because the home folder rule falls back to `origin/main` (`cstack/src/publish/home-folder.ts`, line 99). (2026-11-23, accepted by the user)
- A test case makes `git log` fail for `listUnitCommits()` only. It calls `vi.stubEnv()` for `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=log.date` and `GIT_CONFIG_VALUE_0=bogus` right before it calls `publish()`, and `vi.unstubAllEnvs()` right after, in a `finally` block. This works because `listUnitCommits()` runs git with the environment of the process (`cstack/src/plan/commits.ts`, line 12), while every other git call of `cstack publish` uses `deps.env`, which `makePublishEnv()` copied earlier (`cstack/test/helpers/publish-env.ts`, line 124). With that setting, `git log` exits with "fatal: unknown date format bogus" and `git rev-parse` still works (checked in this worktree). The case expects exit code 1, a line that starts with `cstack cannot tell which units have a commit: git log failed:`, no `git branch --track` anywhere in the output, and no push. (2026-11-23, decided in the plan)
- The acceptance criterion "a plan whose missing unit has a `- Blocked:` line is published" is covered by the existing cases of `cstack/test/publish.test.ts` that publish, such as "makes one push, creates the pull request once and records both" (line 215). Unit 3 of the fixture has a `- Blocked:` line and no commit (`cstack/test/fixtures/plans/ready-for-review.md`, lines 54 to 62), and these cases publish that plan. The criterion "when every unit has its commit, `cstack publish` behaves as today" is covered the same way, by every existing case of the file. A new case that expects a push would pass on today's code, so it could never fail first. A new case checks instead that a blocked unit is never named in a refusal. (2026-11-23, decided in the plan)
- No existing case of `cstack/test/publish.test.ts` changes. When one of them fails after the change to `makePublishEnv()` or to `cstack/src/commands/publish.ts`, the implementer does not change it and reports the unit as stuck. (2026-11-23, decided in the plan)
- Under "Exit code 1" of `cstack/guides/resolve-issue/publish.md` (line 41), the guide says what to do when a reason says that a unit has no commit with its trailer and no Blocked line. The executor then also reads `## Decisions`, `## Implementation units`, "Review log" and "Briefing". It builds that unit with an implementer, as `cstack guide build` says. It runs the reviews that the change calls for on the new commits only, as `cstack guide review` says, and writes them into the "Review log". It corrects the body under `## Pull request` and the "Briefing", so that they describe the new unit, because both were written before the unit existed. In one more commit, it adds one line about it to "Executor notes" and one item to the "Improve" heading of the retrospective, following the rules of the retrospective template. Then it runs `cstack publish --plan <plan file>` again. When it cannot build the unit, it returns a needs-decision report that names the unit and asks the user whether to block it. (2026-11-23, the user's answer)
- The sentence of `cstack/guides/resolve-issue/publish.md` that limits the sections to read (line 9) says that the part "Exit code 1" names more sections for this one case. (2026-11-23, decided in the plan)
- The block of mandatory steps at the top of `cstack/guides/resolve-issue/publish.md` (lines 1 to 5) does not change. A refusal is not the normal path of the phase, so the steps of the exit code 1 path stay out of the block (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 58). (2026-11-23, decided in the plan, from ADR-RQG-C)

## Architecture

The change is small, and the ticket and the answers of the question round lock the approach. `cstack publish` reuses the check of the build phase inside its list of broken rules, and the publish guide says what to do on that refusal. No new decision since the question round.

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

### Unit 1: Refuse to publish while a unit is not done
- Files: `cstack/src/phases.ts`, `cstack/src/commands/publish.ts`, `cstack/test/helpers/publish-env.ts`, `cstack/test/publish.test.ts`
- Test: `cstack/test/publish.test.ts`: a new `describe` block "cstack publish refuses while a unit is not done" holds six cases, and each one fails on today's code. (1) A plan with an added unit 4 that has no commit and no `- Blocked:` line exits with 1, its standard error holds `- Unit 4 has no commit with its trailer and no Blocked line.`, nothing is pushed and no forge client runs. (2) With units 4 and 5 added and neither committed, both lines are there, unit 4 first. (3) With unit 4 added and no commit, the refusal never names unit 3, which has a `- Blocked:` line and no commit. (4) A plan whose `Status` line is broken, with unit 4 added and no commit, and with an uncommitted change to `README.md`, starts with `cstack publish: nothing was pushed, because 3 rule(s) are broken.` and lists the `Status` line, then the unit 4 line, then the `README.md` line. (5) With `origin/main` kept and the local `main` deleted, it exits with 1, holds the whole line `` cstack cannot tell which units have a commit: The target branch "main" does not exist. Run `git branch --track main origin/main`, then run `cstack publish` again.``, and pushes nothing. (6) With `git log` broken for the process environment only, it exits with 1, holds a line that starts with `cstack cannot tell which units have a commit: git log failed:`, holds no `git branch --track`, and pushes nothing.
- Minimum code: In `cstack/test/helpers/publish-env.ts`, make `makePublishEnv()` commit one file with the trailer `Cstack-Unit: 1` and one with `Cstack-Unit: 2` right after the plan, with `commitFiles()` from `cstack/test/helpers/plan-repo.ts`. Add a comment that says unit 3 of the fixture stays blocked with no commit. Write the six cases, which add their units through the `plan` option of `makePublishEnv()`. In `cstack/src/phases.ts`, narrow the parameter type of `buildDone` to `Pick<PhaseContext, "plan" | "commits">`. In `brokenRules()` of `cstack/src/commands/publish.ts`, right after the `Ready for review at` rule, call `buildDone({ plan, commits: listUnitCommits(root, target) })` and add its lines. Catch only `PlanFormatError`, and add the rule about commits that cannot be read, with the `git branch --track` ending only when `git rev-parse --verify --quiet refs/heads/<target>` fails.
- Refactor: None.
- Commit message: feat(cli): refuse to publish while a unit of the plan has no commit and no Blocked line
- Depends on: none
Unit 3 of the fixture keeps its `- Blocked:` line and no commit, so every existing case that publishes also shows that a blocked unit does not stop the push. Check before `cstack unit red` that each of the six refusals and limits above has its own case. For the rule "a negative test proves its rule by breaking it", break each of the two rules once: remove the line that adds the lines of `buildDone`, then the catch of `PlanFormatError`.

### Unit 2: Say in the publish guide and the README what to do when a unit is not done
- Files: `cstack/guides/resolve-issue/publish.md`, `README.md`
- No test: The unit changes prose only. The block of mandatory steps of the guide does not change.
- Minimum code: In `cstack/guides/resolve-issue/publish.md`, add the paragraph about a unit that has no commit and no Blocked line under "Exit code 1", as `## Decisions` describes it, and the exception to the sentence of line 9 about the sections to read. In the `cstack publish` paragraph of `README.md` (line 71), add after "It refuses to publish while the plan is not ready or a blocking question is open." one sentence saying that it also refuses while a unit of the plan has no commit with its `Cstack-Unit` trailer and no `Blocked` line. Follow the writing rules of the conventions file: one idea per sentence and plain words.
- Refactor: None.
- Commit message: docs(skill): say what to do when cstack publish refuses a unit that is not done
- Depends on: 1

## Documentation duties

- The part "Exit code 1" of `cstack/guides/resolve-issue/publish.md`: applies, written by unit 2.
- The `cstack publish` paragraph of `README.md`: applies, written by unit 2.
- The `cstack publish` entry of `cstack/src/manifest.ts`: does not apply, because exit code 1 already reads "Refused before any push.".
- The comment on this ticket, #114: applies, written in the document phase.
- The comment on the dependent ticket #104: applies, written in the document phase.
- A decision record in `docs/decisions/`: does not apply. No record covers the rules of `cstack publish`, and this ticket adds one rule that the ticket itself fixes.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply, because no story and no acceptance criterion changes.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: When cstack publish cannot read the commits of the units
`listUnitCommits()` throws a `PlanFormatError` when the local target branch does not exist, or when `git log` fails (`cstack/src/plan/commits.ts`, lines 26 and 42). Should `cstack publish` catch this error and list it as one more broken rule, with exit code 1 and nothing pushed? The proposed line is `cstack cannot tell which units have a commit: <the message of the error>`, for example `cstack cannot tell which units have a commit: The target branch "main" does not exist.`. When the local target branch is missing, the line also ends with the command that creates it, for example `git branch --track main origin/main`, as the home folder rule already ends with `git fetch origin main`. The other broken rules are still listed in the same message. If the error escaped instead, `cstack publish` would exit with 3 (`cstack/src/commands/errors.ts`, line 20), and the existing case "refuses when there is no target ref to compare with" (`cstack/test/publish.test.ts`, line 853), which expects exit code 1, would fail. With this rule, a run that has `origin/main` but no local `main` is refused, while today it is published.
- For: the user
- Answer: Yes. `cstack publish` lists the error as one more broken rule, with exit code 1 and nothing pushed. When the local target branch is missing, the line ends with the command that creates it, such as `git branch --track main origin/main`. The user, 2026-11-23.

### Question 2: buildDone takes only the plan and the commits
`buildDone` (`cstack/src/phases.ts`, line 71) has the type `PhaseCheck`, so it takes a whole `PhaseContext`, but it reads only `plan` and `commits`. Can its parameter type become `Pick<PhaseContext, "plan" | "commits">`? Its body, its messages and its use as the done check of the build phase (line 101) stay the same. `cstack publish` then calls `buildDone({ plan, commits })` without making up a `doneAt` value. The other way is to keep the signature and call `buildDone({ plan, commits, doneAt: {} })` from `cstack publish`.
- For: the user
- Answer: Yes. The parameter type of `buildDone` becomes `Pick<PhaseContext, "plan" | "commits">`, and its body and messages stay the same. The user, 2026-11-23.

### Question 3: What the publish guide tells the executor to do on this refusal
Should the part "Exit code 1" of `cstack/guides/resolve-issue/publish.md` (line 43) say the following? When a unit has no commit with its trailer and no `Blocked` line, the executor also reads `## Decisions` and `## Implementation units`. It builds that unit with an implementer, as `cstack guide build` says. It runs the reviews that the change calls for on the new commits only, as `cstack guide review` says, and writes them into the "Review log". In one more commit, it adds one line to "Executor notes" and one item to the "Improve" heading of the retrospective, as the part "Exit code 6" already asks for a failed check. It also corrects the body under `## Pull request` and the `## Briefing`, so that they describe the new unit, because both were written before the unit existed. Then it runs `cstack publish` again. When it cannot build the unit, it returns a needs-decision report that names the unit and asks the user whether to block it. The block of mandatory steps at the top of the guide stays the same, because a refusal is not the normal path (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 58).
- For: the user
- Answer: Yes, as the question says, including the correction of the pull request body and of the briefing. The user, 2026-11-23.

## Review log

### Impact notes

`buildDone` has two callers outside the diff: the build phase check in `cstack/src/phases.ts` and the report code in `cstack/src/report/reports.ts`, which passes a whole `PhaseContext`. The type check accepts both. The publish tests, the end-to-end test of the resolve-issue chain and the guide and README tests cover the other dependents. The usual companions of `publish.ts` are its test file, the test helper `publish-env.ts`, `README.md` and the publish guide, and all of them are in the diff. No `WHY:` or `DECISION:` comment conflicts with the change.

### Phase review

- Correctness: no bug found. One note below the threshold. When neither the local `main` nor `origin/main` exists, the new line advises `git branch --track main origin/main`, which then fails, while the home folder line gives the right first step. The advice text is fixed by the user's answer, so it stays. This is recorded as a follow-up, not fixed.
- Security: nothing found. The target branch name is checked by `readPlan` before the new code runs, and git starts without a shell.
- Conventions: nothing found.
- Simplicity: nothing to remove.
- Tests: typecheck passes. `cstack/test/publish.test.ts` passes, 85 cases. The full `npm test` shows only timeout failures of the 5-second limit on a busy machine, in other files each time. Those files pass when run alone, except `cstack/test/e2e/no-orca.test.ts`, which still times out in its Orca chain cases and does not touch publishing.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- Should `cstack next --done ready` refuse too while a unit is not done? It would catch a unit added late before the retrospective, so the reviews and the retrospective would see it. For: the user. Open, not needed for this ticket.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

- The full `npm test` failed on a busy machine with different timeout failures on each run (9 failed in the first run, 12 in the second, both with the vitest 5-second timeout, mostly in tests that build git repositories). Rerun alone, five of the six failing files passed. `cstack/test/e2e/no-orca.test.ts` still timed out at 5 seconds in its Orca chain cases, also alone, and it does not touch publishing.

## Hand-off log

- 2026-11-23, executor run of the build phase: moved #114 to "in progress" with `cstack tracker move`, committed the plan file, and built unit 1 (commit 26649aa) and unit 2 (commit 66ab586), one implementer after the other, with `CSTACK_ORCA_WORKERS=off` and no child worktree. Typecheck passes. The run goes on to the next phases.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**When `cstack publish` cannot read the unit commits, should it list that as one more broken rule, with exit code 1?** This happens when the local target branch is missing or `git log` fails. If the error escaped, the command would exit with 3, and the existing test that deletes `main` would break. I recommend yes. I would also end the line with the fix, `git branch --track main origin/main`, as the home folder rule already ends with `git fetch origin main`.

**Can `buildDone` take only the plan and the commits?** Today it takes the whole phase context, but it reads only those two fields. Narrowing its type lets `cstack publish` call it without inventing phase times. I recommend yes: its body, its messages and the build phase stay the same.

**What should the publish guide tell the agent that publishes to do on this refusal?** The draft says: build the unit, review its new commits, add a note and a retrospective item, then publish again, or ask you to block the unit. I agree, with one addition. Before publishing again, it must also correct the `## Pull request` body and the briefing. Both were written before the late unit existed, so the pull request would open without mentioning it. In the run of #89, that unit was a bug fix.

**I will do this unless you say no**

- I will not add the same check to `cstack next --done ready` in this ticket. The new refusal already stops the pull request, and that change would touch another phase.
- I will add one test case where `origin/main` exists but the local `main` does not. It proves that the new rule catches the error and refuses on its own.

**I checked it myself**

- The build phase reads the commits with the same function, so every run that reaches publishing already had a local `main`. The new refusal for a missing `main` only hits someone who deleted it later.
- The commit reading ignores the test environment, so the existing "git log fails" test still reaches only the home folder rule.

**Good to know**

- When neither `main` nor `origin/main` exists, the refusal shows two lines that say almost the same thing.
- The plan format ticket (#98) works in `cstack/src/plan/` in this wave. `buildDone` reads only the unit number, its Blocked line and the commits, so a conflict should stay small.

#### Details

Blocking question 1, about the error of `listUnitCommits()`, stays blocking, and nothing can answer it but the user, because it adds a new refusal case. I keep the draft recommendation. The evidence holds. `listUnitCommits()` throws `PlanFormatError` when the local target branch is missing or `git log` fails (`cstack/src/plan/commits.ts`, lines 26 and 42). An escaping error gives exit code 3 through `failWith()` (`cstack/src/commands/errors.ts`, line 20). The case "refuses when there is no target ref to compare with" (`cstack/test/publish.test.ts`, line 853) expects 1. My addition is a fix hint at the end of the line, such as `Run git branch --track main origin/main, then run cstack publish again.`, with the real target name. The home folder rule already ends its own refusal with a command (`cstack/src/publish/home-folder.ts`, line 102). I rejected a fallback to `origin/<target>` inside `cstack publish`, because it would give publishing a different idea of "done" from the build phase, and the base logic lives in `commits.ts`, which belongs to #98. If nobody decides, the error escapes and the test at line 853 fails, so the question cannot stay open.

Blocking question 2, about the parameter type of `buildDone`, stays blocking, because the coordinator rule makes any change to a function signature a question for the user. It cannot be settled by a test, although the type check will confirm it compiles. I keep the draft recommendation, `Pick<PhaseContext, "plan" | "commits">`. A function that takes this narrower type is still assignable to `PhaseCheck` for the build phase (`cstack/src/phases.ts`, line 101), because a `PhaseContext` holds both fields. The lazy `commits` getter of `phaseContext()` (`cstack/src/run-progress.ts`, lines 34 to 37) is still read when `buildDone` destructures it. I rejected the other option, `buildDone({ plan, commits, doneAt: {} })`, because an empty `doneAt` is a made-up value that a later check could misread. No other ticket of the wave works in `phases.ts`.

Blocking question 3, about the prose of the publish guide, stays blocking. I keep the draft and add one step. In the run of #89, unit 9 was added after the `ready` phase, when the main conversation ran the audit, and it fixed a bug (`docs/retros/2026-11-23-89.md`, line 11 and line 20). The `## Pull request` section is drafted in the `ready` phase, and `cstack publish` opens the pull request with that title and body. The briefing is written before that. So a unit built during publishing reaches the pull request without being described in it. The guide should say that, after the reviews of the new commits, the agent corrects each sentence of the pull request body and of the "Briefing" that the new unit makes wrong, in the same way as `cstack/guides/resolve-issue/after-build-questions.md`, line 28, already asks for the briefing. The guide also has to widen its list of sections to read (`cstack/guides/resolve-issue/publish.md`, line 9) for this path, which the draft already says for `## Decisions` and `## Implementation units`, and which now needs "Briefing" too. The independent review of phase 8 does not see the late unit. I accept that, because the reviews that the change calls for run on the new commits, and rerunning phase 8 would be a larger change than this ticket. The block of mandatory steps stays as it is, because a refusal is not the normal path (ADR-RQG-C, "How a block chooses its steps"). Prose that names `cstack guide build` and `cstack guide review` does not need them in the block, because the exit code 8 part already names `cstack guide update-branch` outside the block. If nobody decides, the guide keeps "fix any other reason", and the #89 failure stays possible at the prose level.

The non-blocking question 4, about `cstack next --done ready`, stays non-blocking and out of scope. I agree with the draft. The new rule stops the pull request, and checking at `ready` too would change the done check of another phase, which the scope of this ticket does not name. It stays open for a later ticket, as the plan already records.

I added one test case to the plan, and I treat it as accepted unless the user objects. The case keeps `refs/remotes/origin/main` and deletes only the local `main`. It expects exit code 1, the new line about the unit commits, and no push. Today this case is published, because the home folder rule falls back to `origin/main` (`cstack/src/publish/home-folder.ts`, line 99). This is the only case that proves the new catch on its own. The case at line 853 also loses `origin/main`, so the home folder rule refuses there anyway. The decision "each refusal needs its own test case", from the retrospective of #86, asks for it.

I checked that the refusal for a missing local `main` cannot surprise a normal run. `cstack next --done build` runs `buildDone` through `phaseContext()`, whose `commits` getter calls the same `listUnitCommits()` (`cstack/src/run-progress.ts`, line 36). So any run that closed its build phase had a local target branch at that time. In this worktree, the local `main` exists and tracks `origin/main`.

I checked that `listUnitCommits()` runs `git` with the environment of the process, not with `deps.env` (`cstack/src/plan/commits.ts`, line 12). So the existing case "refuses when git log fails" (`cstack/test/publish.test.ts`, line 870), which breaks `git log` through `GIT_CONFIG_*` in `deps.env`, still reaches only the home folder rule. The new rule reads the commits of the same repository, because `makePublishEnv()` sets no `GIT_DIR` or `GIT_WORK_TREE` (`cstack/test/helpers/publish-env.ts`, lines 124 to 130). The "git log failed" branch of the new catch cannot be reached through `deps.env`. The case above covers the catch, and both errors pass through the same code.

When neither `main` nor `origin/main` exists, the message lists two rules that say nearly the same thing: the new line about the unit commits and the home folder line. I accept this. Both are true, and merging them would couple the new rule to the home folder module.

#98 works in `cstack/src/plan/` in the same wave and may change `PlanRead`, `PlanUnit` or `UnitCommits`. `buildDone` reads only `unit.number`, `unit.blocked` and `commits.units`. A conflict should stay at the level of an import or a field name, and the type check will show it after the update of the branch.

Locked decisions that I did not reopen: the reuse of `buildDone` without a copy (scope item 2), the exit code 1 of the refusal (scope item 3, ADR-SIC-H), the shared fixture that must not change (code mapping), and the rule that a block of mandatory steps follows its prose (ADR-RQG-C). I checked security and authorization, data model lock-in, scale and performance, operations and cost, and reversibility, and found nothing in them for this ticket.

### Open questions and answers

1. Blocking. Blocking question 1, about the error of `listUnitCommits()`. Recommended answer: yes, list it as one more broken rule with exit code 1. I checked it by reading the code: an escaping `PlanFormatError` gives exit code 3 through `failWith()` (`cstack/src/commands/errors.ts`, lines 20 to 23), and the existing case at `cstack/test/publish.test.ts`, line 853, expects 1.
2. Blocking. Blocking question 2, about the parameter type of `buildDone`. Recommended answer: yes, narrow it to `Pick<PhaseContext, "plan" | "commits">`. The type checker accepts it for the build phase, because a `PhaseContext` holds both fields.
3. Blocking. Blocking question 3, about the prose of the publish guide. Recommended answer: yes, as written in the question. It follows the sentence that `cstack/guides/resolve-issue/after-build-questions.md` (line 28) already has for a unit added late, and the rule of "Exit code 6" for the notes and the retrospective.
4. Non-blocking. Should `cstack next --done ready` refuse too while a unit is not done? It would catch a unit added late before the retrospective, so the reviews and the retrospective would see it. Recommended answer: not in this ticket. The new rule of `cstack publish` already stops the pull request. Open, not needed for this ticket. The user agreed on 2026-11-23.
5. Added by the review of the question round, and accepted by the user on 2026-11-23: one test case where `origin/main` exists but the local `main` does not. It expects exit code 1, the new line about the unit commits, and no push.
6. Not asked, written as assumptions in `## Decisions`: where the new rule sits among the other rules, how the test helper gets commits for units 1 and 2, and the sentence added to the `README.md` paragraph.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn.
