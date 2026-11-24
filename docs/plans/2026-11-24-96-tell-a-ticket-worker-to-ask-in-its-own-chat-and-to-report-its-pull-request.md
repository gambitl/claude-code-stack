# Plan: #96 — R2-5: Tell a ticket worker to ask in its own chat and to report its pull request

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/96
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/worker-chat-and-report
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T09:27:55+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Tell `resolve-issue` how to behave when Orca started it for one ticket: ask the user in its own chat, and tell the coordinator when the pull request is open.

- **What the title means**: In a wave, a coordinator session in the main Orca workspace starts one Orca worker per ticket. An Orca worker is a full Claude Code session that Orca starts and supervises. Orca gives each worker a preamble, a text before its task, that says to ask questions through the coordinator and to finish with a final report called `worker_done`.
- **Why we are doing it**: The maintainer answers each ticket's questions in that ticket's chat, and it works well. The guides must keep that habit, even though the Orca preamble says otherwise. The coordinator must also learn when a pull request is open, so it can tell the maintainer and check conflicts.
- **For the user**: A wave runs as it does today with the prose skill. The coordinator says "go to worker X, it has questions for you", and later "the workspace of ticket X is done, its pull request is open".

**Goal.** This ticket adapts the `questions`, `plan` and `publish` parts of the guides to a run that Orca started as a worker, and it checks the flow on a real worker.

### Where things are today (read first)

* **The questions**: `cstack/guides/resolve-issue/questions.md`, section "## Ask once" (line 48). Line 50 shows the short version and says "Then wait". Lines 54 to 56 handle the replies.
* **The approval gate**: `cstack/guides/resolve-issue/plan.md`, section "## The approval gate" (line 29). Line 33 already reads the new messages of a coordinator before the gate. Line 41 asks for approval.
* **The publication**: `cstack/guides/resolve-issue/publish.md`. After exit code 0 (lines 11 to 21), the executor moves the ticket to "in review" (line 15), adds the pull request link (line 19) and runs `cstack next --done publish` (line 20). It then reports "published" to the session of the ticket. `plan.md` (lines 72 to 74) handles that report in the session of the ticket.
* **The helpers**: #93 rewrites how the executor returns its report. Build on its version of these files.
* **Orca**: when a worker stops without `worker_done`, Orca wakes the coordinator with an escalation, which is a message that says the worker stopped. A worker in a new workspace stays open after it finishes, so the user keeps its chat. `orca skills get orchestration` prints Orca's guide.
* **The specification**: `docs/projects/refocus-and-quality-guards.md`, section 1 (the flow in seven steps) and US-5.

### Scope

1. In `questions.md` and `plan.md`, say that the user answers in this chat, also when the session is an Orca worker. Say why: the coordinator only tells the user that this worker waits for them.
2. In `plan.md`, after the "published" report, say what an Orca worker does. It sends `worker_done` once, with the link of the pull request, using the command that its preamble gives.
3. Say that a worker never sends `worker_done` before the pull request is open, and never twice.
4. Update the blocks of mandatory steps of the guides that change.
5. Check the flow once on a real Orca worker in this repository, with a small ticket. Check that the coordinator is woken when the worker waits for an answer, and when the worker sends `worker_done`. Write what you saw in the ticket.

### Acceptance (TDD)

* A guide test: `questions.md` and `plan.md` say that the user answers in the chat of the ticket, also for an Orca worker. Write it first and see it fail.
* A guide test: `plan.md` sends `worker_done` only after the "published" report, and only once.
* `cstack/test/manifest.test.ts` passes.
* The ticket records the check on a real worker: the coordinator was woken when the worker waited, and when it finished.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #93 · Feeds: #103

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

The epic also has an open question that this ticket answers. Orca's worker preamble says to ask questions through the coordinator, but the maintainer answers in each worker's chat. By default, the guides keep the maintainer's habit, and the ticket of US-5 checks it on a real worker.

The three ADRs that this block names now exist on `main`:

- [ADR-RQG-A: helpers and units inside a ticket](../decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md), which #93 wrote. It replaces [ADR-SIC-A: helpers](../decisions/ADR-SIC-A-helpers.md).
- [ADR-RQG-B: plan format version 2](../decisions/ADR-RQG-B-plan-format-version-2.md), which #98 wrote.
- [ADR-RQG-C: expected steps of a run](../decisions/ADR-RQG-C-expected-steps-of-a-run.md), which #86 wrote.

## Dependencies

clear

## Code mapping

The ticket was written before #93 merged. Its line numbers point to the old guides, so this section gives the lines of `main` at eff2cff.

**The three guides.**

- `cstack/guides/resolve-issue/questions.md` asks the user in the section "## Ask once" (line 56). Line 58 shows the short version of the CTO advisor and says "Then wait". Lines 62 and 64 handle the replies. The guide never names the harness's question tool, Orca or a coordinator.
- `cstack/guides/resolve-issue/plan.md` has the section "## The approval gate" (line 40). Line 44 reads the new messages of a coordinator before the gate and writes them into `## Decisions`. Line 52 says "Ask for approval with the harness's question tool, or in plain chat." The section "## Hand off to the executor" (line 58) starts the executor as a sub-agent. The section "## The report of the publish phase" (line 77) handles the reports of the executor after publication, and its bullet "**published.**" (line 81) tells the user the pull request link and the result of the checks. The section "## Close the phase" (line 85) comes last.
- `cstack/guides/resolve-issue/publish.md` runs in the executor, which is a fresh sub-agent. It gets four inputs and nothing from the conversation (`plan.md`, line 62), so it never sees Orca's preamble. Step 4 of "## Exit code 0" (line 27) submits the published report and ends with it. The guide does not say what the report holds. The executor prompt says it: "Give the pull request link, the pipeline result on the last push, and every extra push with its reason" (`cstack/skills/resolve-issue/agents/executor.md`, line 54).
- After the `publish` phase, the main conversation reads the published report. The `retro` guide starts the executor for the publish phase and says "Handle its report as the `plan` guide says" (`cstack/guides/resolve-issue/retro.md`, line 56). So the retrospective exists before the pull request opens, and the main conversation is the last one to act.

**How Orca behaves.** Orca's own guide, printed by `orca skills get orchestration`, says these things.

- A worker asks its coordinator with `ask`, then ends its turn, and Orca wakes it with the answer (line 23 of the printed guide).
- "An `escalation` with `stopReason` means the worker stopped without `worker_done`" (line 102). So a worker that ends its turn without `worker_done` wakes the coordinator. A worker that waits inside a question tool has not ended its turn yet.
- "A `worker_done` settles its Task" (line 105).
- A message sent to a finished worker arrives "as a follow-up Task", and the worker "reports with `worker_done`" again (lines 81 and 82). So an update of the branch that the coordinator asks for after the pull request opens comes with its own `worker_done`.
- The preamble of a worker says "Never use a local question prompt such as AskUserQuestion; the coordinator cannot see or answer it." It also says "Finish: send exactly once", and "Use --outcome failed if the work is not done".

**The tests that read these guides.**

- `cstack/test/guides/executor-launch.test.ts` checks exact sentences in the sections "Hand off to the executor" and "The report of the publish phase" of `plan.md` (lines 19 to 56). It also checks that `publish.md` names `cstack report submit published` and `cstack report submit failed` (line 68), and the blocks of mandatory steps of `plan.md` and `publish.md` (lines 81 to 86). Its helper `section()` (line 8) cuts a section from its `## ` heading to the next one. A new test can reuse that pattern.
- `cstack/test/guides/helpers-are-sub-agents.test.ts` refuses a sentence that names "Orca worker" or "Orca workers" together with start, starts, started, starting, launch, launches, launched or launcher (lines 38 to 52). It cuts sentences on `.`, `!` or `?` followed by a space. So no new sentence may join "Orca worker" with one of those words. "A session that Orca started as a worker" does not match, because the words "Orca" and "worker" are not next to each other.
- `cstack/test/manifest.test.ts` scans every `cstack ...` mention in backticks in the guides, and fails when the command does not exist (line 72). It also checks the blocks of mandatory steps (line 227).
- `cstack/test/guides/steps-blocks.test.ts` checks that each block opens on line 1, holds the command that closes its phase, and that `cstack guide` prints the prose after the block.
- `cstack/test/skill-size.test.ts` counts only `SKILL.md` and `ticket.md`, so the three guides of this ticket have no size limit.

**The blocks of mandatory steps.** A `command:` step must start with "cstack " (`cstack/src/guide-steps.ts`, line 58), so `worker_done` cannot be a command step. Only the eight conditions of `CONDITIONS` exist (`cstack/src/guide-steps.ts`, lines 8 to 17), and none says "this session is an Orca worker". ADR-RQG-C says "A step that the prose makes conditional is left out" unless its condition is one of those eight (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 63). It also says that telling the user something without waiting is not a step (line 59). The audit prints no line for an `action:` step, except the two steps of a big decision (`cstack/src/audit/evaluate.ts`, lines 96 to 99).

**Governing decisions.** Epic #84 left an open question for this ticket: the guides keep the maintainer's habit of answering in each worker's chat, and the ticket of US-5 checks it on a real worker. `cstack/skills/resolve-issue/settled-decisions.md` keeps the tool-agnostic wording "the harness's question tool" (line 31) and the rule that the plan guide writes the coordinator's messages into `## Decisions` before the gate (line 52). None of the three guides holds a `WHY:` or `DECISION:` comment.

**History and risks.** `plan.md` changed seven times in its last 30 commits, most recently in #93 (2ac6b9a). It usually changes with `questions.md`, `ticket.md`, `retro.md` and `executor-launch.test.ts`. #95 runs in this wave and removes commands, but it does not touch these three guides. The risk is low. The main risk is wording: a sentence about an Orca worker that also says "start" fails the sub-agent test.

**Patterns to follow.** Guide tests read the guide with `readFileSync` and check exact sentences inside one section, as `executor-launch.test.ts` does. A new guide test goes under `cstack/test/guides/`.

## Decisions

- This ticket works only in the guides `questions.md`, `plan.md` and `publish.md` of `cstack/guides/resolve-issue/`, and in their guide tests under `cstack/test/guides/`. The plan file and the retrospective of this run are added too. (2026-11-24, from the brief of the run)
- Three other tickets of epic #84 run at the same time, each in its own worktree. #95 works in the command files and modules of `cstack wave`, `cstack helper`, `cstack unit collect` and `cstack report check`, their tests, `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/src/report/`, `cstack/src/orca/`, `cstack/src/doctor/`, `cstack/src/commands/errors.ts`, the message after `--done publish` in `cstack/src/commands/next.ts`, and the sections of those commands in `README.md`. #100 works in `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/saved-runs.ts`, `cstack/src/audit/`, their tests and their paragraphs of `README.md`. #102 works in `cstack/src/phases.ts`, the check of the plan phase in `cstack/src/commands/next.ts`, their tests and the paragraph of `cstack next` in `README.md`. Never change their files. When this ticket needs one of them, the main conversation asks the coordinator first. (2026-11-24, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and add no runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- Do not change the plan format, which #98 defined as version 2 in ADR-RQG-B. When this ticket needs a new line or a new section in the plan, it is a blocking question for the user, and the main conversation asks the coordinator before planning it. This plan file stays in format `cstack-plan/1`, because the installed `cstack` 0.3.2 writes and reads it. Any plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `cstack/test/guides/helpers-are-sub-agents.test.ts` reads every guide, skill and agent prompt. It refuses a sentence that tells Claude to start an Orca worker, except in `cstack/guides/resolve-issue/independent-review.md`. So the text that this ticket adds describes an Orca worker without telling Claude to start one. (2026-11-24, from the comment of the maintainer on the ticket and the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `cstack/skills/resolve-issue/SKILL.md` have almost no margin left in `cstack/test/skill-size.test.ts`. If a sentence is added to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- This run is the check on a real Orca worker that item 5 of the scope asks for. The main conversation is that worker: it runs in an Orca workspace of this repository, it asks the user in its own chat, and it sends `worker_done` at the end. Nobody starts another Orca worker for the check. The coordinator tells the main conversation, by a message, when Orca woke it during the question round and at the approval gate. Those facts go in this plan file and in the outcome comment of the ticket. The coordinator confirms the `worker_done` side in a comment on the ticket after the pull request opens. (2026-11-24, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation. It uses `orca orchestration` only to read the messages of the coordinator when Orca says that some wait, to ask the coordinator about coordination, and to send the final `worker_done`. (2026-11-24, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-24, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-24, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-24, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. The main conversation puts those three rules, word for word, in the prompt of the executor. (2026-11-24, from the brief of the run)
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
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the brief of the run)
- A line of `## Decisions` that says how a function behaves needs a test case of its own too, not only a line that says what it must not do. (2026-11-24, from the run of #118)
- When a unit has several refusals, the implementer breaks each refusal on its own, one at a time, and sees its own test fail. (2026-11-24, from the run of #98)
- A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the runs of #98 and #118)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-24, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-24, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-24, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. (2026-11-24, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-24, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-24, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-24, from the brief of the run)
- Never change `.cstack/settings.json` in this branch. The independent review refuses a branch that changes it. (2026-11-24, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-24, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-24, from the conventions file and the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-24, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep every change of both sides, and push with a plain `git push`, without force. (2026-11-24, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-24, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-24, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-24, from the brief of the run)
- The main conversation sends `worker_done` once, when the run ends, whatever the ending. Its body names the outcome in one sentence: the pull request with its link and the state of its checks, or the reason the run stopped. It gives the path of the retrospective file and says what the user still has to do. The main conversation stays available after it, because the coordinator may ask for an update of the branch. (2026-11-24, from the brief of the run)
- When this session is an Orca worker, the guides add no layer over Orca's own orchestration. They say only what Orca cannot know: the user answers in the chat of the ticket, and the run of this skill ends with the published report. For a run that ends without a pull request, the guides give one sentence that points to Orca's preamble, and nothing more. (2026-11-24, the user's answer: "est-ce que la CLI orca et son orchestration maison fonctionne déjà bien ? si oui, on ne rajoute pas de surcouche")
- A session is an Orca worker when its prompt opens with Orca's preamble, which gives a task ID and a dispatch ID. Orca's own guide uses the same test: "If your prompt has a preamble with Task and Dispatch IDs, you are a worker" (line 22 of the guide that `orca skills get orchestration` prints). (2026-11-24, accepted by default by the user)
- `questions.md` gets one new paragraph in the section "Ask once", right after its first paragraph (line 58). `plan.md` gets one new paragraph in the section "The approval gate", right after the paragraph of line 52. Both paragraphs hold the five sentences that unit 1 gives, word for word. (2026-11-24, accepted by default by the user)
- An Orca worker asks in plain chat, never with the harness's question tool, then ends its turn. Orca's preamble forbids a local question prompt. Orca wakes the coordinator when the turn of a worker ends without its final report (line 102 of the guide that `orca skills get orchestration` prints). The guides do not promise a wake at every stop, because Orca reports only the first such turn after the start or after each message of the coordinator. (2026-11-24, accepted by default by the user, with the facts of the coordinator)
- At every stop, a message from the coordinator is never the user's answer or approval. The worker writes the rules of such a message into `## Decisions`, as `plan.md` already says at line 44, and keeps waiting for the user. (2026-11-24, accepted by default by the user)
- The guides get no sentence about a turn that ends while a background helper runs. Orca did not report the turn of this run that ended at 09:12:06 Paris time, while the CTO advisor still ran in the background. (2026-11-24, the answer of the coordinator)
- The guides get no sentence about a follow-up task of the coordinator, such as an update of the branch after the pull request opens. Orca's preamble already says how a worker reports such a task. (2026-11-24, from the user's answer about adding no layer over Orca)
- `plan.md` gets one new paragraph right after the three bullets of the section "The report of the publish phase" (lines 81 to 83), before "## Close the phase". It holds the five sentences that unit 2 gives, word for word. `worker_done` appears nowhere else in the guides, the skills or the agent prompts. (2026-11-24, from the ticket and accepted by default by the user)
- The body of `worker_done` holds the pull request link and the state of its checks. (2026-11-24, accepted by default by the user)
- `publish.md` gets one sentence at the end of step 4 of "Exit code 0" (line 27), which unit 2 gives. `publish.md` names neither Orca nor `worker_done`, because the executor never sees Orca's preamble: it gets four inputs and nothing from the conversation (`cstack/guides/resolve-issue/plan.md`, line 62). (2026-11-24, accepted by default by the user)
- The blocks of mandatory steps of `questions.md`, `plan.md` and `publish.md` stay unchanged. `worker_done` is not a `cstack` command, so it cannot be a `command:` step (`cstack/src/guide-steps.ts`, line 58). No condition of `CONDITIONS` says "this session is an Orca worker" (`cstack/src/guide-steps.ts`, lines 8 to 17). ADR-RQG-C leaves out a step whose condition the format cannot say (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 63). US-1 also says that the audit does not check orchestration. (2026-11-24, accepted by default by the user)
- No new sentence may name "Orca worker" together with start, starts, started, starting, launch, launches, launched or launcher, because `cstack/test/guides/helpers-are-sub-agents.test.ts` refuses it (lines 38 to 52). The sentences of units 1 and 2 already pass that test. (2026-11-24, from the code mapping)
- The new test file `cstack/test/guides/orca-worker.test.ts` reads the guides with `readFileSync` and checks exact sentences inside one section. It cuts a section from its `## ` heading to the next `## ` heading, as the helper `section()` of `cstack/test/guides/executor-launch.test.ts` does (line 8). Each sentence has its own test case. (2026-11-24, an assumption not asked)
- Three cases of unit 2 pass on the files before that unit by nature, because they guard what must not appear: no other guide, skill or agent prompt names `worker_done`, the blocks of the three guides name no Orca step, and `publish.md` names no Orca. These are the only allowed exceptions to the rule that each new test case fails first. The implementer names them in its report as these exceptions, and it proves each one by breaking its rule on purpose, one at a time. (2026-11-24, an assumption not asked)
- The outcome comment of the ticket records the check on a real worker with these facts. This run is the Orca worker of the check. The first turn that ended without `worker_done` ended at 09:12:06 Paris time, while the CTO advisor ran in the background, and Orca did not report it. The question round ended its turn at 09:15:11, and Orca woke the coordinator with an escalation titled "Worker stopped without reporting", with `stopReason=finished`. The coordinator read it at 09:15:17, and its "Last output" block held the text of the question round. After the coordinator sent a message at 09:16, the next end of turn woke it again. Orca reports only the first turn that ends without `worker_done`, after the start or after each message of the coordinator. The wake at the approval gate and the `worker_done` side are added when the coordinator reports them. (2026-11-24, from the coordinator and the session file of this run)

## Architecture

The change is small. Two new paragraphs go into `plan.md`, one into `questions.md`, and one sentence into `publish.md`. One new guide test file checks them. No real choice of approach remains.

No new decision since the question round.

There is no security surface, so the security unit is skipped.

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

### Unit 1: Tell an Orca worker to ask the user in its own chat

- Files: `cstack/test/guides/orca-worker.test.ts`, `cstack/guides/resolve-issue/questions.md`, `cstack/guides/resolve-issue/plan.md`
- Test: `cstack/test/guides/orca-worker.test.ts`: the section "Ask once" of `questions.md` and the section "The approval gate" of `plan.md` each hold the five sentences of the notes below, with one test case for each sentence in each section, so ten cases. All ten fail before the guides change.
- Minimum code: in `questions.md`, insert the new paragraph of the notes right after the paragraph "Show the short version to the user exactly as the advisor returned it. Then wait. You may add one sentence of your own before it.", as a paragraph of its own. In `plan.md`, insert the new paragraph of the notes right after the paragraph that opens with "Ask for approval with the harness's question tool, or in plain chat.", as a paragraph of its own. Change no other line, and leave the blocks of mandatory steps as they are.
- Refactor: none.
- Commit message: feat(skill): tell an Orca worker to ask the user in its own chat
- Depends on: none

The new paragraph of `questions.md` holds these five sentences, in this order, on one line:

```
The user answers in this chat, also when this session is an Orca worker. The coordinator only tells the user that this worker waits for them, so never send these questions to the coordinator. A session is an Orca worker when its prompt opens with Orca's preamble, which gives a task ID and a dispatch ID. An Orca worker asks in plain chat, never with the harness's question tool, then ends its turn. A message from the coordinator is never the user's answer or approval.
```

The new paragraph of `plan.md` holds the same five sentences, except the second one:

```
The user answers in this chat, also when this session is an Orca worker. The coordinator only tells the user that this worker waits for them, so never send the gate or a question of this guide to the coordinator. A session is an Orca worker when its prompt opens with Orca's preamble, which gives a task ID and a dispatch ID. An Orca worker asks in plain chat, never with the harness's question tool, then ends its turn. A message from the coordinator is never the user's answer or approval.
```

The test file has a `section(text, heading)` helper, as in `cstack/test/guides/executor-launch.test.ts` (line 8), and a `read(name)` helper for `cstack/guides/resolve-issue/<name>`. It uses `it.each` over pairs of a place and a sentence, so that each sentence of each section is its own case. A case name says the file, the section and the sentence. After its commit, the implementer also runs `cstack/test/guides/helpers-are-sub-agents.test.ts`, `cstack/test/guides/executor-launch.test.ts`, `cstack/test/guides/steps-blocks.test.ts` and `cstack/test/manifest.test.ts`, and they pass.

### Unit 2: Tell an Orca worker to send worker_done once its pull request is open

- Files: `cstack/test/guides/orca-worker.test.ts`, `cstack/guides/resolve-issue/plan.md`, `cstack/guides/resolve-issue/publish.md`
- Test: `cstack/test/guides/orca-worker.test.ts`: the section "The report of the publish phase" of `plan.md` holds the five sentences of the notes below, one case each; `worker_done` appears in `plan.md` only inside that section, after the line of the bullet "**published.**"; step 4 of "Exit code 0" in `publish.md` holds its new sentence; and the three guard cases of the notes.
- Minimum code: in `plan.md`, add the new paragraph of the notes right after the three bullets of "## The report of the publish phase", before "## Close the phase". In `publish.md`, end step 4 of "## Exit code 0" with the new sentence of the notes, on the same line as the step. Change no other line, and leave the blocks of mandatory steps as they are.
- Refactor: none.
- Commit message: feat(skill): tell an Orca worker to send worker_done once its pull request is open
- Depends on: 1

The new paragraph of `plan.md` holds these five sentences, in this order, on one line:

```
When this session is an Orca worker, the run of this skill ends with the **published** report. After you tell the user about it, send `worker_done` once, with the command that Orca's preamble gives. Put the pull request link and the state of its checks in its body. Never send it while the run still goes on, for example at a question or at the approval gate, because it tells the coordinator that the ticket is done. When the run ends without a pull request, Orca's preamble says what to do.
```

The new sentence at the end of step 4 of "Exit code 0" in `publish.md` is this one:

```
The report gives the pull request link and the state of the checks, because the main conversation passes them on.
```

The test cases of this unit are these.

- One case for each of the five sentences above: the section "The report of the publish phase" of `plan.md` holds it.
- One case: `plan.md` names `worker_done` on at least one line, and every such line comes after the line that starts with "- **published.**" and before the line "## Close the phase".
- One case: the line of step 4 of "## Exit code 0" in `publish.md`, which starts with "4. Submit the report", holds the new sentence.
- Guard case 1: no `.md` file under `cstack/guides/` or `cstack/skills/`, in any subfolder, names `worker_done`, except `guides/resolve-issue/plan.md`. Its message lists each place as `<path relative to cstack/>:<line>`.
- Guard case 2: the blocks of mandatory steps of `questions.md`, `plan.md` and `publish.md` hold neither "orca" nor "worker", in any case. The block is the text before the first "-->".
- Guard case 3: `publish.md` does not hold the word "Orca", in any case.

The three guard cases pass before this unit by nature. They are the allowed exceptions to the rule that each new test case fails first. The implementer proves each one on its own by breaking its rule on purpose, with a time limit, and sees that case fail. For guard case 1, it adds `worker_done` to another guide for a moment. For guard case 2, it adds a step line that names a worker to one block. For guard case 3, it adds the word "Orca" to `publish.md`. Then it restores the file exactly, and `git diff` shows nothing left from the break. After its commit, the implementer also runs `cstack/test/guides/helpers-are-sub-agents.test.ts`, `cstack/test/guides/executor-launch.test.ts`, `cstack/test/guides/steps-blocks.test.ts` and `cstack/test/manifest.test.ts`, and they pass.

## Documentation duties

- The comment on ticket #96: applies, written in the document phase. It records the outcome and the check on a real worker, with the facts of `## Decisions` and the wake at the approval gate. It says that the coordinator confirms the `worker_done` side in its own comment.
- The comments on the dependent tickets: applies, written in the document phase. The comment on #103 names the new paragraphs of `questions.md` ("Ask once"), of `plan.md` ("The approval gate" and "The report of the publish phase") and the new sentence of `publish.md`. It says that `cstack/test/guides/orca-worker.test.ts` checks their exact words, so a change of those sentences must change the test too.
- The decision record: does not apply, because adding no layer over Orca follows the rule of epic #84 that orchestration stays with Orca, which the specification already records.
- The specification page: does not apply, because this ticket works only in the three guides and their tests. The comment on #96 gives the answer to the open question of epic #84 about where a worker asks.
- The README: does not apply, because it describes the commands and not the guides.
- Release notes: do not apply, because the version does not change in this ticket. The release at the end of milestone R3 writes them.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: worker_done when the run ends without a pull request

When a run that is an Orca worker ends without a pull request, does it send `worker_done`? This happens when the executor returns a failed report, or when the user decides to stop the ticket. The ticket says that a worker never sends `worker_done` before its pull request is open. Orca's preamble says the opposite: finish with `worker_done` exactly once, with `--outcome failed` when the work is not done. The recommended answer follows the ticket. Such a run sends no `worker_done`. Orca then wakes the coordinator with an escalation, because the worker stopped without its final report, and the coordinator sends the user to the chat of the ticket. A failed run of this skill can often resume in the same chat, for example after a usage limit, and its pull request then opens later. A `worker_done` with a failed outcome would settle the task too early, and the later `worker_done` would be a second one.
- For: the user
- Answer: add no layer over Orca when its own orchestration already works well. The user answered in French: "est-ce que la CLI orca et son orchestration maison fonctionne déjà bien ? si oui, on ne rajoute pas de surcouche". The facts of this run say that it works: Orca woke the coordinator when the question round ended, with the text of the questions, and a wait for a background helper woke nobody. So the guides say nothing about a run that ends without a pull request, and the worker follows Orca's preamble there. The guides keep only what Orca cannot know: the user answers in the chat of the ticket, and the run of this skill ends when the pull request is open. (2026-11-24, the user's answer in the chat, read this way by the main conversation, which shows this reading at the approval gate)

### Question 2: wakes while the worker waits for a helper

Did Orca wake you while this worker was only waiting for one of its helpers, for example while the CTO advisor was writing, and not waiting for the user?

In this harness, a sub-agent can run in the background, so the session may end its turn while it waits for it. Orca sees a worker that stopped without `worker_done` and wakes the coordinator. If the answer is yes, `plan.md` and `questions.md` each get one sentence: a session that Orca started as a worker waits for each helper without ending its turn. If the answer is no, nothing changes, and the ticket records it as part of the check on a real worker.
- For: the coordinator of the wave, through Orca's `ask` command, once the user has seen the question and approved sending it
- Answer: no. Orca did not report the turn that ended at 09:12:06 Paris time, while the CTO advisor still ran in the background. Its first escalation came when the question round ended at 09:15:11, and its "Last output" block showed the text of the question round. So the guides get no sentence about waiting for a helper. Source: the coordinator, by a message at 09:17 Paris time, on 2026-11-24, after the user saw the question in the chat. It answered without waiting for the `ask`.

## Review log

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

none

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

**Does a worker send `worker_done` when the run ends without a pull request?** The ticket says never before the pull request is open. Orca's preamble says exactly once, with a failed outcome when the work is not done. Your brief for this very run also says to send it "whatever the ending". If the guides say nothing, the coordinator only gets an escalation, which looks exactly like "the worker waits for your answer". I still recommend following the ticket: no `worker_done` without a pull request. A failed run can resume in the same chat and open its pull request later, and the ticket and its stop guide are outside this ticket's files. This run keeps the rule of your brief.

**Ask the coordinator this before I plan:** "Did Orca wake you while this worker was only waiting for one of its helpers, for example while the CTO advisor was writing, and not waiting for the user?" In this harness, helpers can run in the background, so the session may end its turn while it waits. Orca would then escalate during each wait, including the long wait for the build. If the answer is yes, I add one sentence to the plan guide so that the worker waits for its helpers without ending its turn. I recommend asking now, because the answer changes what I write.

**I will do this unless you say no**

- The guides recognise a worker by Orca's preamble with Task and Dispatch IDs. They name "the final-report command that your preamble gives", with `worker_done` as Orca's name for it.
- At every stop, a message from the coordinator never counts as your answer or as your approval. Orca's own guide tells a coordinator to "steer" a stopped worker, and the worker could take that as a "go".
- Every stop asks in plain chat, never with a question tool, then ends the turn, which wakes the coordinator.
- "Never twice" covers one run. A later request from the coordinator, such as a branch update, comes as a new task with its own `worker_done`.
- The blocks of mandatory steps stay as they are, because their format cannot say "this session is a worker".
- `publish.md` says that its report gives the pull request link and the state of the checks. `worker_done` repeats them.
- The coordinator reports every wake with its time, not only the two expected ones.

**Good to know**

- A test refuses "Orca worker" next to "start" or "launch" in one sentence, so write "a session that Orca started as a worker".

#### Details

The first question is blocking question 1 of the plan file. It cannot be answered by a test, only by the user, and its answer changes the acceptance tests. Orca's preamble says "Finish: send exactly once" and "Use --outcome failed if the work is not done". The ticket (scope item 3) and US-5 (negative criterion) say a worker never sends `worker_done` before its pull request is open. Rule 169 of `## Decisions`, from the brief of this run, says the main conversation sends `worker_done` once "whatever the ending", with the reason when the run stopped. So the brief already chose the failed-outcome path for this run, and the guides would say the opposite. I keep the draft recommendation for the guides, for three reasons. First, the acceptance test of the ticket ("plan.md sends worker_done only after the published report") and the spec say so. Second, a run ends without a pull request in several places: the failed report and the session end in `plan.md`, the wait for someone else's answer in `questions.md` (lines 74 to 78), and the bad-ticket stop in `ticket.md` (line 36 and "When you stop", line 56). `ticket.md` and `retro.md` are outside the files of this ticket (rule 120), and `ticket.md` has almost no margin in the size test (rule 125). A failed-outcome rule would miss that path. Third, a failed run can resume in the same chat, and a later successful `worker_done` would be a second one. The cost of the draft is that an escalation does not say why the worker stopped. If the user picks the failed-outcome path instead, the acceptance test of item 2 changes, and the plan must decide where the rule lives for each ending. By default, if nobody decides, cstack refuses the plan phase, because the question is open.

The second question is new and blocking. Only the coordinator can answer it, by looking at the wakes it received, so the run cannot test it. The Agent tool of this harness says that sub-agents run in the background and that the caller is notified when one completes. If the main conversation ends its turn while it waits for a helper, Orca sees a worker that stopped without `worker_done`. Orca's guide says: "An `escalation` with `stopReason` means the worker stopped without `worker_done`: steer it with `send`, stop and retry it, or tell the user" (line 102 of the guide that `orca skills get orchestration` prints). So the coordinator could be woken during the code mapping, during this advisor call and during the whole build, and it could tell the maintainer that the worker has questions when it has none. It could also retry the worker. The question for the coordinator, word for word in English: "Did Orca wake you while this worker was only waiting for one of its helpers, for example while the CTO advisor was writing, and not waiting for the user?" If yes, the plan adds one sentence to `plan.md` ("Hand off to the executor", line 64) and to `questions.md` ("Call the CTO advisor", line 50): a session that Orca started as a worker waits for each helper in the foreground, without ending its turn. If no, nothing changes, and the ticket records it as part of the check on a real worker. The rejected option is to send a status message to the coordinator before each wait, because the spec dropped any coordinator protocol other than the escalation and `worker_done` (spec, section on rejected options, line 305 and 306).

The guides need a test that tells a worker it is one. Orca's guide says "If your prompt has a preamble with Task and Dispatch IDs, you are a worker" (line 22). The guides should use that test, so that a session without Orca never changes its behaviour. This keeps the rule of epic #84 that every `cstack` command works without Orca. It also keeps the tool-agnostic wording of `cstack/skills/resolve-issue/settled-decisions.md` (line 31). The guides then name "the final-report command that the preamble gives" and give `worker_done` as Orca's name for it, because the ticket names `worker_done`. `plan.md` line 44 already says "When a coordinator started this run", so the new sentences should use the same subject.

A coordinator message is not the user's answer. Because the default reaction of a coordinator to an escalation is to "steer it with `send`" (Orca guide, line 103), and a message sent to a worker arrives when its turn ends (line 81), a coordinator's "please continue" can land in the chat while the run waits at the question round or at the approval gate. `plan.md` line 52 accepts "explicit approval only", but it does not say whose. Rule 154 of `## Decisions` says this for this run, from the brief, but the guides do not. One sentence in "Ask once" of `questions.md` and one in "The approval gate" of `plan.md` say that a message from the coordinator is never the user's answer or approval, and that the worker writes the coordinator's rules into `## Decisions` as line 44 already says, then keeps waiting. This needs its own test case in the new guide test, as rule 151 asks for a behaviour line.

The draft defaults 2 to 8 of "Open questions and answers" are non-blocking, and I keep each recommendation. Plain chat at every stop, then end the turn (draft 2): Orca's preamble forbids a local question prompt, and the escalation only fires when the turn ends. The scope of "never twice" (draft 3) follows Orca's guide, lines 81 and 82. The blocks of mandatory steps (draft 4) stay, because `worker_done` cannot be a `command:` step (`cstack/src/guide-steps.ts`, line 58) and ADR-RQG-C leaves out a step whose condition the format cannot say (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 63). The report of `publish.md` (draft 5) and the body of `worker_done` (draft 6) carry the pull request link and the state of the checks, including a pending state after exit code 7 (`publish.md`, line 35). Draft 7 places the sentences: I add the sentence about coordinator messages from the point above. Draft 8 records the check: I add that the coordinator reports every wake with its time, not only the two expected ones, so the second question above gets its evidence too.

The wording has one trap. `cstack/test/guides/helpers-are-sub-agents.test.ts` (lines 38 to 52) refuses a sentence that has "Orca worker" or "Orca workers" with start, started, launch or a related word. The code mapping already shows this, and "a session that Orca started as a worker" passes.

I checked security and authorization, data model lock-in, scale and performance, operations and cost, and reversibility, and found nothing: this ticket changes prose and guide tests only, and `worker_done` stays on the local machine.

### Open questions and answers

1. **worker_done when the run ends without a pull request.** Blocking question 1.
2. **How an Orca worker asks the user.** Non-blocking, accepted by default. Recommended answer: when the session is an Orca worker, every stop of the skill asks in plain chat, never with the harness's question tool, and then ends the turn. Evidence: Orca's guide says "An `escalation` with `stopReason` means the worker stopped without `worker_done`" (line 102 of the guide that `orca skills get orchestration` prints). So the coordinator is woken when the worker's turn ends. The preamble of a worker also says "Never use a local question prompt such as AskUserQuestion". This run checks the plain-chat path on a real worker, and the coordinator reports when Orca woke it. The tool-agnostic wording "the harness's question tool" of `settled-decisions.md` (line 31) stays.
3. **The scope of "never twice".** Non-blocking, dropped after the user's answer to blocking question 1: Orca's preamble already handles a follow-up task, so the guides add no sentence about it. Recommended answer: the rule covers one run of the skill. A message that the coordinator sends to a finished worker arrives as a follow-up task, and the worker reports it with its own `worker_done` (lines 81 and 82 of Orca's guide). `plan.md` says so in one sentence, so that a worker asked to update its branch after the pull request opens does not refuse to report.
4. **The blocks of mandatory steps.** Non-blocking, accepted by default. Recommended answer: the blocks of `questions.md`, `plan.md` and `publish.md` stay as they are. `worker_done` is not a `cstack` command, so it cannot be a `command:` step (`cstack/src/guide-steps.ts`, line 58). "This session is an Orca worker" is not one of the eight conditions (`cstack/src/guide-steps.ts`, lines 8 to 17), and ADR-RQG-C leaves out a step whose condition the format cannot say (line 63). Adding a condition would change `cstack/src/guide-steps.ts` and the audit, which are outside this ticket, and US-1 says that the audit does not check orchestration. Item 4 of the scope is met by checking that each block stays true after the change.
5. **What changes in `publish.md`.** Non-blocking, accepted by default. Recommended answer: one sentence in step 4 of "Exit code 0" says that the report gives the pull request link and the state of the checks, because the main conversation passes them on. The executor prompt already asks for both (`cstack/skills/resolve-issue/agents/executor.md`, line 54), but the guide that the executor follows at that moment does not. `publish.md` names neither Orca nor `worker_done`, because the executor never sees Orca's preamble.
6. **What the body of `worker_done` holds.** Non-blocking, accepted by default. Recommended answer: the pull request link and the state of its checks, sent with the command that Orca's preamble gives. A check that still runs or is red is said plainly, as the "published" bullet already asks for the user.
7. **Where each new sentence goes.** Non-blocking, accepted by default. Recommended answer: `questions.md` gets one paragraph in "Ask once". `plan.md` gets one paragraph in "The approval gate", which covers the gate and every question that an executor report brings back. `plan.md` also gets one paragraph after the bullets of "The report of the publish phase", for `worker_done`. One new test file, `cstack/test/guides/orca-worker.test.ts`, checks exact sentences in those sections, as `executor-launch.test.ts` does.
8. **How the ticket records the check on a real worker.** Non-blocking, accepted by default. Recommended answer: the coordinator tells this run, by a message, when Orca woke it during the question round and at the approval gate. The main conversation writes those facts into `## Decisions`, and the outcome comment of the ticket repeats them. The coordinator confirms the `worker_done` side in its own comment on the ticket after the pull request opens.
9. **Wakes while the worker waits for a helper.** Blocking question 2, raised by the advisor.
   - Facts from the coordinator, by a message at 09:15 Paris time on 2026-11-24, before the user approved sending the question. Orca woke the coordinator at about 09:14 with an escalation titled "Worker stopped without reporting", with `stopReason=finished`. The coordinator linked it to the end of the question round. The escalation also says: "If it is idle on purpose, leave it: its later idle turns are not reported until you write to it." So Orca reports only the first turn that ends without `worker_done`, after the start or after each message of the coordinator. In the runs of #93 and #118, the coordinator got an escalation at their question rounds, and none while their executors ran in the background during the build. They did not wake it at their approval gates either, because it had not written to them since their last escalation. The coordinator's message re-arms the report for the next stop of this run.
   - Facts from the session file of this run. The first turn of this run that ended without `worker_done` ended at 09:12:06 Paris time, while the main conversation waited for the CTO advisor in the background. A second turn ended at 09:12:09, after a background install finished. The question round ended its turn at 09:15:11. The main conversation first guessed that the escalation came from the wait for the advisor, and asked the user to approve a sharper question for the coordinator.
   - The exact facts from the coordinator, by a second message at 09:17 Paris time. Its "about 09:14" was an estimate. It read the first escalation at 09:15:17. Orca's command line shows no time on its messages. The escalation holds a "Last output" block, which is the end of the worker's terminal. That block held the text of the question round, so Orca built the escalation when the question round ended at 09:15:11. The turn that ended at 09:12:06, during the wait for the background advisor, was not reported. A second escalation came after the coordinator's message of 09:16, and its "Last output" block showed the reply of this run. In the runs of #93 and #118, the builds woke the coordinator only with `worker_done`.
10. **A message of the coordinator at a stop.** Non-blocking, accepted by default. Recommended answer: at every stop, a message from the coordinator never counts as the user's answer or approval. The worker writes the rules of that message into `## Decisions`, as `plan.md` line 44 already says, and keeps waiting for the user.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
