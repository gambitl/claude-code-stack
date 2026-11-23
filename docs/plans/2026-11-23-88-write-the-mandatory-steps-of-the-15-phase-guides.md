# Plan: #88 — R1-2: Write the mandatory steps of the 15 phase guides

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/88
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/guide-steps-blocks
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T13:49:49+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Write, at the top of each of the 15 instruction files of `resolve-issue`, the list of the steps that are mandatory in that phase.

- **What the title means**: A run of `resolve-issue` goes through 15 phases. Each phase has a guide, which is its file of instructions. #86 defines a short block, readable by code, that lists the mandatory steps of a phase. This ticket writes that block in each of the 15 guides.
- **Why we are doing it**: The new command `cstack audit` reads these blocks to know which steps a run should have done. Without them, the audit has nothing to compare a run with.
- **For the user**: The maintainer can see, phase by phase, what a run must do. Writing the blocks also shows where the prose of a guide is unclear about what is mandatory.

**Goal.** This ticket adds the block of mandatory steps to the 15 phase guides of `resolve-issue`, in the format of #86.

### Where things are today (read first)

* **The guides**: the 15 files in `cstack/guides/resolve-issue/` are `ticket`, `dependencies`, `code-map`, `questions`, `plan`, `build`, `review`, `independent-review`, `update-branch`, `document`, `briefing`, `after-build-questions`, `ready`, `retro` and `publish`. `cstack/src/phases.ts` → `PHASES` (line 95) gives their order and their dependencies.
* **The format**: #86 defines the block, its three kinds of steps and its conditions, and it adds a fixture guide under `cstack/test/fixtures/`.
* **The commands that the guides require**: for example, `build.md` (line 17) runs `cstack unit red` and `cstack unit green` through the implementers. Every guide asks for `cstack next --done <phase>` when its phase is done.
* **The helpers that the guides name**: `code-map.md` (line 18), `questions.md` (line 42), `plan.md` (lines 7 and 13), `briefing.md` (line 7), `review.md` (lines 17 to 20) and `independent-review.md` (line 15).
* **Conditional steps**: `code-map.md` (lines 9 and 18) has steps that apply only in some runs.
* **The version**: these blocks describe the guides of 0.3.2. Runs 3 and 4 used 0.3.1. Since `v0.3.1`, only `ticket.md` changed, by #80, and that change does not add or remove a step. #92 relies on this.

### Scope

1. For each of the 15 guides, write the block at its top. List every step that the prose makes mandatory, in order, with its condition when it has one.
2. Do not change the prose of a guide. When the prose is unclear about whether a step is mandatory, write a blocking question in the plan and ask the user.
3. Keep the commands that version 0.3.2 still has, such as `cstack helper start`. Milestone R2 removes them and updates the blocks.

### Acceptance (TDD)

* A test checks that every phase of `PHASES` has a guide with a block. Write it first and see it fail on today's guides.
* `cstack/test/manifest.test.ts` passes on the real guides with their blocks. Every command and every helper that a block names exists.
* `cstack/test/guide.test.ts` passes: `cstack guide <phase>` prints each real guide without its block.
* A reviewer reads each block next to its guide and finds no mandatory step missing and no optional step marked as mandatory.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #86 · Feeds: #91, #92

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rule of the specification for every story.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

The ADRs that this block names:

- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.
- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md), which #86 wrote and accepted on 2026-11-23. It fixes the format of the blocks that this ticket writes.

## Dependencies

clear

## Code mapping

**The files to change.** The 15 guides live in `cstack/guides/resolve-issue/`, one per phase of `PHASES` (`cstack/src/phases.ts`, line 95). None of them has a block today. Each guide opens with a level-1 heading on line 1.

**The format and its reader.** `cstack/src/guide-steps.ts` holds `readSteps()` (line 75), `withoutBlock()` (line 118) and `stepProblems()` (line 127). The seven conditions are at lines 8 to 16. `cstack guide` and `cstack next` call `withoutBlock()`, so they print a guide without its block and without the empty line after it. ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`) fixes the format. The fixture guide `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md` shows a full block, but its steps are made up for tests: it lists `break-the-rule` and a security review in the build phase, which the real 0.3.2 guides do not ask for.

**The check that already exists.** `cstack/test/manifest.test.ts` → `scanSteps()` (line 200) runs `readSteps()` and `stepProblems()` on every `.md` file under `cstack/guides/`, in the case "passes on the real guides" (line 227). So a block that names a missing command, a helper without a prompt, or a word that the prompt lacks already fails CI. That check accepts a guide with no block, because `readSteps()` returns an empty list for it. Nothing fails today when a guide has no block.

**A pattern to copy for the new test.** `cstack/test/guides/phases-have-guides.test.ts` loops over `PHASES` and reads `cstack/guides/resolve-issue/<phase>.md`. `cstack/test/guide.test.ts` (line 93) checks that `guide()` prints the fixture guide without its block.

**The words that the helper prompts hold.** `cstack/skills/resolve-issue/agents/cto-review.md` (line 19) names the moments `before-plan`, `plan-delta` and `after-build`. `code-reviewer-deep.md` holds `correctness` and `security`. `code-reviewer.md` holds `conventions`. `code-reviewer-simplicity.md` and `pr-reviewer.md` need no word.

**What `cstack next --done` already enforces.** `planDone()` (`cstack/src/phases.ts`, line 63) requires the Status `approved` and at least one unit. `buildDone()` (line 71) only requires a commit with a `Cstack-Unit` trailer, or a `Blocked` line, for each unit. Nothing checks the commits of the plan file during the build. The `retro` phase has no done check at all (line 113).

**Three tests break when a block is added, tested in a copy.** I added draft blocks to all 15 guides in a copy of the repository, outside the worktree, and ran the whole suite. Ten cases failed, in three files, and all other files passed, `cstack/test/manifest.test.ts` included.

- `cstack/test/skill-size.test.ts` (line 41) counts the words of `SKILL.md` plus the raw `ticket.md`. The sum is 1,450 words and the limit is under 1,451.8, so any block of two words or more fails it. Commit `e3a1569` already had to shorten `ticket.md` for this limit.
- `cstack/test/guides/ticket-read.test.ts` (lines 11, 19 and 27) takes the first paragraph of the raw `ticket.md` that holds `cstack tracker read '<key>' --tracker <name>`. With a block, that paragraph is the block, so three cases fail.
- `cstack/test/e2e/resolve-issue.test.ts` → `expectGuide()` (line 97) checks that the output of `cstack next` ends with the raw guide file (line 101). With a block, it does not, because `cstack next` leaves the block out. Six cases fail: three on this check, and three later cases that start from a guide that a failed case left behind.

In the copy, reading the guide through `withoutBlock()` in those three files made all of them pass, with the draft blocks still in place. The size test keeps its meaning, because it then counts the guide as the agent reads it.

**Tests that read the raw guides and still pass.** `cstack/test/e2e/chain.ts` (line 184) only checks that a guide contains a command. `cstack/test/guides/settings-applied.test.ts` (line 37) fails on the words `npm test`, `in English` and a few others, and on any word starting with `rebas` in a guide that never names the `integration` setting. So no block may hold those words. `cstack/test/prompts.test.ts` (line 101) fails on any sentence of a guide that holds `git push`. `cstack/test/guides/brief-rules.test.ts` (line 8) takes the first paragraph of `ticket.md` that holds the word `brief`, so the block of `ticket.md` must not hold that word. The tests that cut a guide at its headings, such as `cstack/test/guides/tracker-writes.test.ts` and `build-start.test.ts`, are not affected.

**Risks.** The guides change often: of the last 30 commits that touched `cstack/guides/resolve-issue/`, `ticket.md` and `build.md` changed in seven each, and `plan.md` and `publish.md` in five each. Milestone R2 rewrites `build.md`, `plan.md`, `publish.md`, `ready.md` and `retro.md`, and must update their blocks then. #89 builds `cstack audit` at the same time and reads these blocks. Its draft plan does not yet say how it treats an `action` step, and #89 and #90 cover only commands and helpers.

**Governing decisions.** ADR-RQG-C decides the format, the seven conditions, the rule that no block names `resolve-issue:code-explorer` or `resolve-issue:code-architect`, and the rule that the independent review has no condition. The comment of #86 on this ticket adds these rules: commands are written without backticks, line 1 is exactly `<!-- mandatory steps`, and a condition is written ` | <condition>` with a space on each side of the bar. Section 4 of the specification says that a change to a phase guide also updates its block. No `WHY:` or `DECISION:` comment sits in the files to change.

## Decisions

- Two tickets of epic #84 run at the same time in this wave, each in its own worktree and with its own pull request. #88 writes the blocks of the 15 guides. #89 adds `cstack audit`, which reads these blocks through the reader of `cstack/src/guide-steps.ts`. (2026-11-23, from the brief of the run)
- Do not change `cstack/src/guide-steps.ts`. The one exception is a guide that needs a condition that the format lacks. Then change only the list of conditions in that file, and ask the coordinator before you commit that change. (2026-11-23, from the brief of the run)
- Do not change `README.md`, `cstack/src/manifest.ts` or `cstack/test/manifest.test.ts`, because #89 changes them in this wave. (2026-11-23, from the brief of the run)
- The new test of this ticket lives in a new test file. (2026-11-23, from the brief of the run)
- #89 never changes the guides in `cstack/guides/`. When #89 needs something new from `cstack/src/guide-steps.ts`, it adds a new export and changes no existing one. (2026-11-23, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- This ticket adds a CI test that fails when a phase guide of `resolve-issue` has no block of mandatory steps, and that test runs in `npm test`. (the user, on 2026-11-23)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-23, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-23, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-23, from the brief of the run)
- The executor starts the implementers, so it needs the same rules. The prompt of the executor holds the three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes, word for word. (2026-11-23, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-23, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-23, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-23, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-23, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-23, from the coordinator of the wave)
- A line of `## Decisions` that says what a function or a test must not do needs a test case of its own, so that something fails when a later unit breaks it. (2026-11-23, from the brief of the run, a lesson of the retrospective of #86)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-23, from the brief of the run, a lesson of the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-23, from the brief of the run, a lesson of the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-23, from the brief of the run, a lesson of the retrospective of #86)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-23, from the brief of the run)
- The main conversation uses the coordinator's `ask` only for coordination, for example to learn the state of #89. (2026-11-23, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-23, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-23, from the brief of the run)
- Never read, run or change anything under `~/comparison/` or `~/review-candidates/`, which hold private work data. Never read the session folders of the comparison runs. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-23, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-23, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. A change to the guides in this branch does not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-23, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-23, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-23, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-23, from the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-23, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep both changes, and push with a plain `git push`, without force. (2026-11-23, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-23, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-23, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-23, from the brief of the run)
- `cstack audit` (#89) looks for the steps of a phase only between the close of the phase before it and the close of the phase after it. So the same command in the blocks of `plan.md` and `retro.md` matches two different calls. (2026-11-23, from the coordinator)
- `cstack audit` (#89) gives each step the first matching call that comes after the steps that must precede it. So a step listed after the units, such as `cstack unit collect` or `cstack plan status`, takes the final call of the build. A placeholder followed by `...`, such as `<n>...`, matches one or more words. (2026-11-23, from the coordinator)
- In a block, write a flag with a fixed value only when a run must pass that exact value, such as `--done build` or `--to "in progress"`. The audit treats a flag whose value is a placeholder, such as `--plan <plan file>`, as optional, and it requires every flag that has a fixed value. (2026-11-23, from the coordinator)
- The note for #90 about the action steps and the four reviewers is already posted, at https://github.com/gambitl/claude-code-stack/issues/90#issuecomment-7101330224. The coordinator posted it with the user's approval. Do not post it again, and do not ask the user for it. (2026-11-23, from the coordinator)
- This ticket writes a block of mandatory steps at line 1 of each of the 15 guides in `cstack/guides/resolve-issue/`. One empty line follows the closing `-->`, and then the guide continues exactly as it is today. Do not change any word of the prose of a guide. (2026-11-23, from the ticket)
- Line 1 of a block is exactly `<!-- mandatory steps`, with no space before it and no byte-order mark. A reader that sees anything else finds no block, and CI does not warn about it. Write commands without backticks. Write a condition as ` | <condition>`, with one space on each side of the bar, because without the spaces the condition is lost without an error. (2026-11-23, from the comment of #86 on the ticket)
- A block uses only the seven conditions of `cstack/src/guide-steps.ts` (lines 8 to 16). It names no `resolve-issue:code-explorer` step and no `resolve-issue:code-architect` step. It writes the independent review, `helper: resolve-issue:pr-reviewer`, with no condition. A helper's extra word, such as `before-plan` or `security`, must appear in that helper's prompt, or `cstack/test/manifest.test.ts` fails (line 227). (2026-11-23, from ADR-RQG-C and the comment of #86 on the ticket)
- A block lists every `cstack` command and every named helper that the prose of its guide requires. It also lists one `action` step for each other deed that the prose requires and that leaves a trace. A deed leaves a trace when it writes something (a plan section, a file or a commit), runs a check that the guide requires (the tests, the check of the settings file, the fetch of the target branch), or stops and waits for the user's answer. (the user, on 2026-11-23)
- Reading, searching and looking at the history are not steps, because they leave nothing behind and how much to read is a judgment. Telling the user something without waiting for an answer is not a step. A note that records another step, such as the line of the Hand-off log after the move of the ticket, belongs to that step. (the user, on 2026-11-23)
- A block describes a run that reaches the end of its phase on the normal path. On that path, each command succeeds, no unit is stuck and the user approves. A step that belongs to another path is left out: another exit code, a refusal, a stop, a hand-written ticket, an open blocker, or the messages of a coordinator. (the user, on 2026-11-23)
- A step that the prose makes conditional is left out, unless one of the seven conditions describes its condition. This ticket adds no condition and does not change `cstack/src/guide-steps.ts`. (the user, on 2026-11-23)
- The block of `update-branch.md` does not list the second test run (line 11), because step 2 says that there is nothing to update when the target branch did not move (line 8). It does not list the checks before the push (line 21) either, because they depend on what the conventions file asks for. (the user, on 2026-11-23)
- The block of `publish.md` does not list the move of the ticket to "in review" (line 15), because the prose runs it only "if the forge did not do it already". (the user, on 2026-11-23)
- The block of `build.md` lists the first commit of the plan file (line 12) and not the second one at the end of the build (line 24). When the units run one after the other as sub-agents, the plan file often has nothing left to commit at the end, and `cstack next --done build` does not check it (`cstack/src/phases.ts`, line 71). (the user, on 2026-11-23)
- The block of `review.md` lists `action: run-test-commands` (line 30) even when there was nothing to fix, because the impact notes list the tests that exercise the change. (the user, on 2026-11-23)
- The blocks list the `cstack helper start` commands of `plan.md`, `build.md` and `retro.md`, and no `helper:` step for the executor or the implementers. A sub-agent starts only when `cstack helper start` exits with 6 (`plan.md`, line 53, and `build.md`, line 18), and with Orca the helper is a worker instead. Milestone R2 replaces these commands with `helper:` steps, as the fixture guide of #86 shows. (the user, on 2026-11-23)
- The block of `build.md` lists `cstack unit red <n>`, `cstack unit green <n>` and `cstack unit commit <n>`, although the full commands with `--timeout 9` and `--plan <plan file>` come from `cstack/skills/resolve-issue/agents/implementer.md` (lines 27, 28 and 39). They are written in the short form, with `<n>` and without the extra flags, because #89 checks exactly these three commands for each unit. The block does not list the other commands that only the implementer prompt names, such as `cstack helper done`. (the user, on 2026-11-23)
- A block writes each command exactly as the prose of its guide writes it, with the same placeholders. So `dependencies.md`, `code-map.md`, `questions.md` and `plan.md` get `cstack next --done <phase>` without `--plan`, because their prose has none. (the user, on 2026-11-23)
- A block lists its steps in the order in which a run does them. The escalation of a stuck unit, which `build.md` describes at line 28, comes right after the wait for that unit. (the user, on 2026-11-23)
- When two guides name the same step for the same moment, the step goes only into the block of the guide that the run follows at that moment. The start and the wait of the executor of the `publish` phase go into the block of `retro.md` (line 25), and not a second time into the block of `plan.md`. (the user, on 2026-11-23)
- No block lists `cstack next` without `--done`, because the audit checks the start of each phase from `PHASES`. (the user, on 2026-11-23)
- The block of `review.md` has four helper steps, one per reviewer of lines 17 to 20, although US-1 AC4 speaks of three code reviews. The guide is the source of the steps. (the user, on 2026-11-23)
- No block holds a word that a test refuses in a raw guide. The block of `ticket.md` must not hold the word `brief`, because `cstack/test/guides/brief-rules.test.ts` (line 8) takes the first paragraph that holds it. No block holds a word that starts with `rebas` (`cstack/test/guides/settings-applied.test.ts`, line 44), a phrase of the `OWNED` list of that file (line 10), such as `npm test` or `in English`, or the words `git push` (`cstack/test/prompts.test.ts`, line 109). (2026-11-23, from the code mapping)
- The tests that check the prose of a real guide read it as `cstack guide` prints it, through `withoutBlock()` (`cstack/src/guide-steps.ts`, line 118). When `withoutBlock()` returns `ok: false`, the test fails with its message. This applies to `checkSize()` in `cstack/test/skill-size.test.ts`, which counts the guide without its block, and to the `guide` text of `cstack/test/guides/ticket-read.test.ts`. (the user, on 2026-11-23)
- The end-to-end checks that a guide names a command also use the text without its block, so that a command that only the block names never satisfies them. This applies to `check()` in `cstack/test/e2e/chain.ts` (line 184), and to `follow()` (line 86) and `expectGuide()` (lines 100 and 107) in `cstack/test/e2e/resolve-issue.test.ts`. The text of an agent prompt has no block, so `withoutBlock()` returns it unchanged. (the user, on 2026-11-23)
- The tests that look for forbidden words keep reading the raw guide, because the block must obey the same rules as the prose. These are `cstack/test/guides/settings-applied.test.ts`, `cstack/test/prompts.test.ts` and `cstack/test/guides/brief-rules.test.ts`. (the user, on 2026-11-23)
- The new tests live in one new file, `cstack/test/guides/steps-blocks.test.ts`. It imports `PHASES` from `cstack/src/phases.ts`, `readSteps` from `cstack/src/guide-steps.ts` and `guide` from `cstack/src/commands/guide.ts` with static imports, because these modules already exist. `cstack/test/guide.test.ts` does not change. (the user, on 2026-11-23)
- The first case of the new file checks that, for each phase of `PHASES`, `readSteps()` on the raw guide returns `ok: true` with at least one step. The second case checks that each block has a `command` step that equals `cstack next --done <phase>` for its own phase, or starts with it followed by a space. The third case checks that `guide([<phase>], io, { packageRoot })`, with the real package root, exits with 0, prints nothing on standard error, and prints the raw guide after its first line that is exactly `-->` and the empty line after it. The third case also checks that the raw guide starts with `<!-- mandatory steps` and a newline. All three cases fail on today's guides. (the user, on 2026-11-23)
- ADR-RQG-C gets a new section, "How a block chooses its steps", placed before "Consequences". It says which steps a block lists, which ones it leaves out, and in what order and form it writes them. It adds to the accepted record and changes none of its decisions. The section is written in plain English, with one idea per sentence, and it names no plan file. (the user, on 2026-11-23)
- In the document phase, the comment for #91 says where the retro block stands and that #91 adds `cstack audit` to it, before `action: write-retrospective`. It points to the new section of ADR-RQG-C. The comment for #92 says that the blocks describe the guides of 0.3.2, so they keep the `cstack helper start` commands and list no `helper:` step for the executor or the implementers, which matches runs 3 and 4 that used Orca workers. It also says that #89 checks no `action` step. Do not post anything on #90, because the coordinator already posted the note there. (2026-11-23, decided in the plan)
- The version of `cstack` does not change, so no release note is written. The epic #84 and the specification page do not change, because section 9 of the specification already links to ADR-RQG-C (`docs/projects/refocus-and-quality-guards.md`, line 299). (2026-11-23, decided in the plan)

## Architecture

The change is small and locked by the ticket and the answers of the question round. The 15 guides get a block at line 1, five test files read a guide as `cstack guide` prints it, and a new test file checks that every phase has a block. No new decision since the question round.

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

### Unit 1: Read a guide without its block in the tests that check its prose

- Files: `cstack/test/skill-size.test.ts`, `cstack/test/guides/ticket-read.test.ts`, `cstack/test/e2e/chain.ts`, `cstack/test/e2e/resolve-issue.test.ts`
- No test: these tests already pass on today's guides and must keep passing. `withoutBlock()` returns a guide without a block unchanged, so no case can fail before Unit 2 adds the blocks. Unit 2 runs them with the blocks in place.
- Minimum code: `checkSize()` in `cstack/test/skill-size.test.ts` counts the first guide through `withoutBlock()`. `cstack/test/guides/ticket-read.test.ts` checks the text of `ticket.md` without its block. `check()` in `cstack/test/e2e/chain.ts` looks for the command in the source without its block. In `cstack/test/e2e/resolve-issue.test.ts`, `follow()` does the same, and `expectGuide()` compares the output with the guides without their blocks, at lines 100 and 107. Each of them fails with the message of `withoutBlock()` when it returns `ok: false`.
- Refactor: none planned.
- Commit message: test(tests): read a guide without its block of mandatory steps where a test checks its prose
- Depends on: none

### Unit 2: Write the block of mandatory steps at the top of the 15 phase guides

- Files: `cstack/test/guides/steps-blocks.test.ts`, `cstack/guides/resolve-issue/ticket.md`, `cstack/guides/resolve-issue/dependencies.md`, `cstack/guides/resolve-issue/code-map.md`, `cstack/guides/resolve-issue/questions.md`, `cstack/guides/resolve-issue/plan.md`, `cstack/guides/resolve-issue/build.md`, `cstack/guides/resolve-issue/review.md`, `cstack/guides/resolve-issue/independent-review.md`, `cstack/guides/resolve-issue/update-branch.md`, `cstack/guides/resolve-issue/document.md`, `cstack/guides/resolve-issue/briefing.md`, `cstack/guides/resolve-issue/after-build-questions.md`, `cstack/guides/resolve-issue/ready.md`, `cstack/guides/resolve-issue/retro.md`, `cstack/guides/resolve-issue/publish.md`
- Test: `cstack/test/guides/steps-blocks.test.ts`: for each phase of `PHASES`, `readSteps()` on the raw guide returns `ok: true` with at least one step. Each block has a `command` step that is `cstack next --done <phase>` for its own phase, alone or followed by a space. `guide([<phase>], io, { packageRoot })` with the real package root exits with 0, prints nothing on standard error, and prints the raw guide after its first `-->` line and the empty line after it, and the raw guide starts with `<!-- mandatory steps` and a newline. All three cases fail on today's guides, which have no block.
- Minimum code: put the block of each guide, exactly as written below, at line 1 of that guide, followed by one empty line. The prose of the guide follows unchanged, from its first heading to its last line.
- Refactor: none planned.
- Commit message: feat(skill): write the block of mandatory steps at the top of the 15 phase guides
- Depends on: 1

Before you run `cstack unit green`, check that `cstack/test/manifest.test.ts`, `cstack/test/skill-size.test.ts`, `cstack/test/guides/ticket-read.test.ts`, `cstack/test/guides/settings-applied.test.ts`, `cstack/test/guides/brief-rules.test.ts`, `cstack/test/prompts.test.ts` and the three files under `cstack/test/e2e/` pass with the blocks. Check also that each guide still prints byte for byte after its block, with `git diff` showing only added lines at the top of each guide.

The blocks follow. Each one is exact: copy it line by line, with no backticks, no trailing space and no blank line inside it.

`cstack/guides/resolve-issue/ticket.md`:

```
<!-- mandatory steps
command: cstack tracker read '<key>' --tracker <name>
action: create-plan-file
command: cstack next --done ticket --plan <plan file>
-->
```

`cstack/guides/resolve-issue/dependencies.md`:

```
<!-- mandatory steps
action: write-dependencies
command: cstack next --done dependencies
-->
```

`cstack/guides/resolve-issue/code-map.md`:

```
<!-- mandatory steps
action: write-code-mapping
command: cstack next --done code-map
-->
```

`cstack/guides/resolve-issue/questions.md`:

```
<!-- mandatory steps
action: write-open-questions
action: write-blocking-questions
helper: resolve-issue:cto-review before-plan
action: question-round
command: cstack next --done questions
-->
```

`cstack/guides/resolve-issue/plan.md`:

```
<!-- mandatory steps
action: write-architecture
helper: resolve-issue:cto-review plan-delta | new-structural-decision
action: write-decisions
action: write-implementation-units
action: write-documentation-duties
action: approval-gate
command: cstack next --done plan
command: cstack helper start executor --plan <plan file>
command: cstack helper wait <helper id>
-->
```

`cstack/guides/resolve-issue/build.md`:

```
<!-- mandatory steps
command: cstack tracker move '<key>' --to "in progress" --tracker <name>
action: check-out-branch
action: commit-plan-file
command: cstack unit order --plan <plan file>
command: cstack helper start implementer --plan <plan file> --unit <n> | each-unit
command: cstack unit red <n> | each-unit-with-test
command: cstack unit green <n> | each-unit-with-test
command: cstack unit commit <n> | each-unit
command: cstack helper wait <helper id> | each-unit
command: cstack helper start implementer-escalation --plan <plan file> --unit <n> | each-stuck-unit
command: cstack unit collect <n>... --plan <plan file>
command: cstack plan status --plan <plan file>
action: check-the-user-interface | user-interface
command: cstack next --done build --plan <plan file>
-->
```

`cstack/guides/resolve-issue/review.md`:

```
<!-- mandatory steps
action: write-impact-notes
helper: resolve-issue:code-reviewer-deep correctness
helper: resolve-issue:code-reviewer-deep security
helper: resolve-issue:code-reviewer conventions
helper: resolve-issue:code-reviewer-simplicity
action: write-review-findings
action: run-test-commands
command: cstack next --done review --plan <plan file>
-->
```

`cstack/guides/resolve-issue/independent-review.md`:

```
<!-- mandatory steps
action: check-the-settings-file
helper: resolve-issue:pr-reviewer
command: cstack next --done independent-review --plan <plan file>
-->
```

`cstack/guides/resolve-issue/update-branch.md`:

```
<!-- mandatory steps
action: fetch-the-target-branch
command: cstack next --done update-branch --plan <plan file>
-->
```

`cstack/guides/resolve-issue/document.md`:

```
<!-- mandatory steps
command: cstack tracker comment '<key>' --body-file <file> --tracker <name>
command: cstack tracker comment '<key>' --body-file <file> --tracker <name> | each-dependent-ticket
action: write-documentation-places
command: cstack next --done document --plan <plan file>
-->
```

`cstack/guides/resolve-issue/briefing.md`:

```
<!-- mandatory steps
helper: resolve-issue:cto-review after-build
command: cstack next --done briefing --plan <plan file>
-->
```

`cstack/guides/resolve-issue/after-build-questions.md`:

```
<!-- mandatory steps
action: write-non-blocking-questions
command: cstack next --done after-build-questions --plan <plan file>
-->
```

`cstack/guides/resolve-issue/ready.md`:

```
<!-- mandatory steps
action: draft-pull-request
action: write-executor-notes
command: cstack next --done ready --plan <plan file>
action: commit-plan-file
command: cstack helper done done --helper <helper id> --plan <plan file>
-->
```

`cstack/guides/resolve-issue/retro.md`:

```
<!-- mandatory steps
action: write-retrospective
action: commit-retrospective
command: cstack next --done retro --plan <plan file>
command: cstack helper start executor --plan <plan file>
command: cstack helper wait <helper id>
-->
```

`cstack/guides/resolve-issue/publish.md`:

```
<!-- mandatory steps
command: cstack publish --plan <plan file>
command: cstack next --done publish --plan <plan file>
command: cstack helper done published --helper <helper id> --plan <plan file>
-->
```

### Unit 3: Record in ADR-RQG-C how a block chooses its steps

- Files: `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`
- No test: this is a documentation file, and no test reads it.
- Minimum code: add the section "How a block chooses its steps" before "Consequences", as `## Decisions` describes it. It says that a block lists the commands, the named helpers, and one action for each deed that writes something, runs a required check, or waits for the user's answer. It says that reading, searching and telling the user something are not steps, and that a block follows the normal path and leaves out a step whose condition is not one of the seven. It says that a command is written as the prose writes it, in the order a run does it, and that a step that two guides name goes only in the block of the guide that the run follows then. It says that the `cstack helper start` commands stand for the executor and the implementers until milestone R2, and that the block of `build.md` lists `cstack unit red`, `green` and `commit` in their short form. Write it in plain English, with one idea per sentence, and with no path of this machine.
- Refactor: none planned.
- Commit message: docs: record in ADR-RQG-C how a block of mandatory steps chooses its steps
- Depends on: 2

## Documentation duties

- ADR-RQG-C: applies, a new section "How a block chooses its steps" in `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, written by Unit 3.
- The ticket comment on #88: applies, written in the document phase.
- The comments on the dependent tickets #91 and #92: applies, written in the document phase, with the points that `## Decisions` names.
- The comment on #90: does not apply, because the coordinator already posted it with the user's approval.
- The specification page: does not apply, because section 9 already links to ADR-RQG-C.
- The README: does not apply, because the commands and their output do not change, and #89 changes the README in this wave.
- The epic #84: does not apply, because it links to the specification page.
- Release notes: do not apply, because the version does not change in this ticket. The release at the end of milestone R3 writes them.

## Blocking questions

### Question 1: Which steps go in a block

The guides hold many instructions, and not all of them are steps that an audit can check. Which ones go in a block? I recommend this rule. A block lists every `cstack` command and every named helper that the prose requires. It also lists one `action` step for each other deed that the prose requires and that leaves a trace: it writes something (a plan section, a file or a commit), it runs a check that the guide requires (the tests, the check of the settings file, the fetch of the target branch), or it stops and waits for the user's answer. Reading, searching and looking at the history are not steps, because they leave nothing behind and how much to read is a judgment. Telling the user something without waiting for an answer is not a step either. A note that records another step, such as the line of the Hand-off log after the move of the ticket, belongs to that step. With this rule, the 15 blocks hold about 25 action steps. The other choice is to list only the commands and the helpers, plus three actions: the question round, the approval gate and the check of a user interface. That gives shorter blocks, but a reviewer would then find mandatory steps missing, which the fourth acceptance item of the ticket forbids.
- For: the user
- Answer: the recommended rule. The blocks list the commands, the named helpers, and one action for each deed that writes something, runs a required check, or waits for the user's answer. (the user, on 2026-11-23)

### Question 2: How to read the places where the prose is unclear

The ticket says that each place where the prose is unclear about a mandatory step is a question for you. I recommend one general rule and five readings. The rule: a block describes a run that reaches the end of the phase on its normal path, where each command succeeds, no unit is stuck and you approve. A step that belongs to another path (another exit code, a refusal, a stop, a hand-written ticket, an open blocker, a coordinator's messages) is left out. A step that the prose makes conditional is left out too, unless one of the seven conditions of ADR-RQG-C describes its condition. This is how #86 dropped the conditions `no-file-map` and `architecture-choice`, because no record can decide them. So this ticket adds no condition and leaves `cstack/src/guide-steps.ts` unchanged. The five readings follow.

1. In `update-branch.md`, step 5 runs the tests again, but step 2 says that there is nothing to update when the target branch did not move (lines 8 and 11). I read the test run as part of the update, so it is left out.
2. In `publish.md`, line 15 moves the ticket to "in review" only "if the forge did not do it already". That is a condition that no record decides, so the move is left out.
3. In `build.md`, line 24 commits the plan file at the end of the build. When the units run one after the other as sub-agents, the plan file often has no change left to commit at that point, and `cstack next --done build` does not check it (`cstack/src/phases.ts`, line 71). So that second commit is left out, and the first commit of the plan file (line 12) stays.
4. In `review.md`, line 30 runs the tests after the fixes. I read it as mandatory even when there was nothing to fix, because the impact notes list the tests that exercise the change. So it is listed.
5. In `plan.md` (line 53) and `build.md` (line 18), the sub-agent of the executor or of an implementer starts only when `cstack helper start` exits with 6. With Orca, the helper is a worker instead. So the blocks list the `cstack helper start` commands, which every run of 0.3.2 runs, and no `helper:` step for the executor or the implementers. Milestone R2 replaces these commands with `helper:` steps, as the fixture guide of #86 already shows.
- For: the user
- Answer: the general rule and the five readings as recommended, with no new condition. (the user, on 2026-11-23)

### Question 3: How to keep the three tests that break

Three test files read a raw guide where they mean the text that the agent reads, so they fail once a block is added. They are `cstack/test/skill-size.test.ts`, `cstack/test/guides/ticket-read.test.ts` and `cstack/test/e2e/resolve-issue.test.ts`. I recommend that they read the guide through `withoutBlock()` from `cstack/src/guide-steps.ts`, which is what `cstack guide` and `cstack next` print. The other way would be to shorten the prose of `SKILL.md` or `ticket.md`, or to raise the size limit, and the ticket forbids changes to the prose. I checked it: in a copy of the repository with draft blocks in all 15 guides, the three files failed with ten cases. With the change, those three files, `cstack/test/manifest.test.ts` and `cstack/test/guide.test.ts` pass, with 49 cases out of 49. The size test then counts 1,450 words against a limit under 1,451.8, as today.
- For: the user
- Answer: the three test files read the guide through `withoutBlock()`, checked in a copy of the repository and accepted. (the user, on 2026-11-23)

## Review log

### Impact notes

- The branch changes no symbol of the source code. It adds a block at line 1 of the 15 guides, one new test file, and changes how four test files read a guide. Their readers are `cstack guide`, `cstack next` and `readSteps()`, which already skip or read the block.
- Outside dependents that read the raw guides: `cstack/test/manifest.test.ts` (`scanSteps()`, passes with the blocks), `settings-applied.test.ts`, `prompts.test.ts` and `brief-rules.test.ts` (forbidden words, still read the raw file on purpose), and `cstack/test/guide.test.ts`. The full suite passes: 119 files, 1600 tests, and the type check is clean.
- Usual companions: `README.md`, `cstack/src/manifest.ts` and `cstack/test/manifest.test.ts` are left untouched on purpose, because #89 changes them in this wave. `cstack/src/guide-steps.ts` is untouched, as decided.
- No `WHY:` or `DECISION:` comment sits in the changed files. The branch follows ADR-RQG-C, and Unit 3 adds a section to it without changing a decision.
- Tests that exercise the change: `cstack/test/guides/steps-blocks.test.ts`, `cstack/test/manifest.test.ts`, `cstack/test/skill-size.test.ts`, `cstack/test/guides/ticket-read.test.ts`, `cstack/test/e2e/`.

## Briefing

## Non-blocking questions

none

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-23, executor: moved the ticket #88 to "in progress" with `cstack tracker move`.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

1. **Which steps go in a block.** I keep the proposed rule: the `cstack` commands, the named helpers, and one `action` step for each deed that leaves a trace. A deed leaves a trace when it writes a section, a file or a commit, runs a check that the guide requires, or waits for your answer. Reading and searching are not steps. With only the commands and the helpers, a reviewer would find mandatory steps missing, which the fourth acceptance item forbids. I recommend the rule as written, which gives about 25 `action` steps in all.
2. **How to read the prose where it is unclear.** A block describes the normal path. A step whose condition is not one of the seven conditions of ADR-RQG-C is left out. The five readings of blocking question 2 follow this rule. If we get it wrong, the audit reports steps as skipped when they were not, or misses some. I recommend the rule and the five readings as written, with no new condition.

**I will do this unless you say no**

- The block of `build.md` keeps `cstack unit red <n>`, `cstack unit green <n>` and `cstack unit commit <n>`, although only the implementer prompt names them in full. `build.md` never names `cstack unit commit` at all. I keep them because the audit of #89 checks exactly these three commands for each unit.
- Two end-to-end checks go silent once the blocks exist. `check()` in `cstack/test/e2e/chain.ts` would be satisfied by the block alone, and the "must not be printed" check of `cstack/test/e2e/resolve-issue.test.ts` (line 107) could never fail again. I make both read the text without the block.
- I write the rule for choosing the steps in a new section of ADR-RQG-C. The next person who edits a guide must keep its block true, and they will not read this plan.

**I checked it myself**

- I read each guide through `withoutBlock()` in the three test files that break. With the draft blocks in place, they pass, 49 cases out of 49.
- The draft plan of #89 compares the words before the first flag, treats a flag whose value is a placeholder as optional, and leaves the `helper` and `action` steps to #90. So writing the commands as the guide writes them works with it.

**Questions for other people that can wait**

For the coordinator of the wave, about the ticket that adds `cstack audit` (#89):

> "Three steps of the #88 blocks will look wrong under the draft matching rule of #89. First, `build.md` holds `cstack unit collect <n>... --plan <plan file>`, and a run passes one or more unit numbers there. Second, `cstack unit collect` and `cstack plan status` run after every batch, so their earliest call comes before the steps of later units and shows as out of order. Third, `plan.md` and `retro.md` both list `cstack helper start executor --plan <plan file>` and `cstack helper wait <helper id>`, so the earliest call matches the plan phase in both. Can the audit look for a step only inside its own phase, and take the last call for a step that comes after the units?"

As a comment on the ticket that checks helpers and conditions (#90), which is not in the "Feeds" list of this ticket:

> "The blocks of #88 hold about 25 `action` steps, such as `approval-gate` and `write-decisions`. No shell call proves them, and #89 leaves them out, so this ticket decides how the audit treats them. Also, US-1 AC4 speaks of three code reviews, but `review.md` launches four reviewers, so its block has four `helper` steps."

#### Details

Blocking question 1, which steps go in a block, is blocking and cannot be tested. Only the user can choose how strict the blocks are. I agree with the drafted rule. The rejected alternative, commands and helpers plus three actions, gives shorter blocks but fails the fourth acceptance item, because a reviewer reading the guide next to its block would find mandatory writes and checks missing. The cost of the drafted rule is that #89 checks none of the `action` steps and #90 has not yet said how it will. Until then they serve human readers only, which the ticket's "For the user" line already counts as a benefit. If nobody decides, the run cannot plan, because the question is under `## Blocking questions`.

Blocking question 2, how to read the unclear prose, is blocking and cannot be tested. I agree with the general rule and with the five readings. The general rule is consistent with how #86 dropped the conditions `no-file-map` and `architecture-choice` (ADR-RQG-C, locked, not reopened here). It also leaves out some steps that a reviewer may first see as missing, so the reviewer must know the rule. Examples are "Checks before the push" in `update-branch.md` (line 21), which depends on what the conventions file asks for, and the test run after a reviewer's code change in `independent-review.md` (line 23), which depends on whether the reviewer changed code. On reading 3, the second commit of the plan file in `build.md` (line 24), I agree: a commit that has nothing to commit cannot be a mandatory step.

Blocking question 3, how to keep the three tests that break, is blocking and was answered with a test in a copy of the repository. I checked the evidence against the code. `skill-size.test.ts` should count what the agent reads, and only `cstack/src/commands/next.ts` (line 46) and `cstack/src/commands/guide.ts` (line 74) read a guide for an agent, both through `withoutBlock()`. No skill or agent prompt points an agent at a raw guide file. So counting the block-free text keeps the meaning of the size limit. The head regex of `expectGuide()` (`cstack/test/e2e/resolve-issue.test.ts`, line 103) still fails if `cstack next` ever prints the block, so the e2e test keeps that guarantee after the change.

This new point is about steps that only a helper prompt names. It is non-blocking, and it counts as accepted unless the user objects. The draft block of `build.md` lists `cstack unit red <n> | each-unit-with-test`, `cstack unit green <n> | each-unit-with-test` and `cstack unit commit <n> | each-unit`. The guide prose names `cstack unit red` and `cstack unit green` only in passing (`build.md`, line 17) and never names `cstack unit commit`. The full commands, with `--timeout 9` and `--plan <plan file>`, come from `cstack/skills/resolve-issue/agents/implementer.md` (lines 27, 28 and 39). This departs from scope item 1 ("every step that the prose makes mandatory") and from draft answer 5 ("exactly as the prose of the guide writes it"). I keep the three steps because scope item 5 of #89 checks exactly these commands per unit, and the fixture of #86 lists them too. The rule to record is this: a block may list a `cstack` command that a helper started in this phase must run, written in the short form the guide uses, with `<n>` and without the extra flags. The rejected option is to drop them, which would leave #89 nothing to check in the build.

This new point is about two tests that would stop checking anything. It is non-blocking, and it counts as accepted unless the user objects. `cstack/test/e2e/chain.ts` (line 184) builds the command text from the call arguments and checks that the source guide contains it. The callers pass the raw guide, such as `TICKET_GUIDE` in `cstack/test/e2e/no-orca.test.ts` (line 11) and `cstack/test/e2e/orca.test.ts` (line 11). The block of `ticket.md` holds `cstack tracker read '<key>' --tracker <name>` without backticks, which is exactly what `written()` produces. So the check would pass even if the prose stopped naming the command, while the agent, which never sees the block, would no longer be told to run it. The same holds for the commands that `document.md`, `publish.md`, `plan.md`, `ready.md` and `retro.md` name. In `cstack/test/e2e/resolve-issue.test.ts` (line 107), `not.toContain(read(GUIDES, other))` compares the output with a raw file that holds a block that `cstack next` never prints, so the check always passes. Both should use the block-free text, best in one place: `check()` in `chain.ts` and the `read` used by `expectGuide()`. Draft answer 9 keeps the raw text for the tests that look for forbidden words, and that stays right: a forbidden word must not appear in the block either. Section-based tests such as `build-helpers.test.ts`, `executor-launch.test.ts`, `build-start.test.ts` and `tracker-writes.test.ts` cut after a heading, so the block never reaches them.

This new point is about where the rule lives. It is non-blocking, and it counts as accepted unless the user objects. Section 4 of the specification says that a change to a phase guide also updates its block. The person who does that later needs the inclusion rule of questions 1 and 2 and the helper rule above, and the plan file of this ticket is not where they will look. ADR-RQG-C already holds the format, so a short new section there ("How a block chooses its steps") is the natural place. This adds to the accepted record and changes none of its decisions. The decisions of the run do not list ADR-RQG-C among the files that #89 changes, so the risk of a conflict is low. This also counts as a documentation duty of the plan. The rejected option is the specification page, which describes the project and not the format.

This point is about the matching rule of #89, and I answered it by reading its draft plan. I read the draft plan of #89 in its worktree (draft answers 3 to 7). A call counts even inside a compound command or after an assignment such as `CSTACK_ORCA_WORKERS=off`. A call matches a step when the words before the first flag are equal. A placeholder matches any word. A flag with a fixed value, such as `--done build`, must be present. A flag with a placeholder value, such as `--plan <plan file>`, is optional. Extra flags in the call are allowed. The audit of #89 lists only the `command` steps with no condition, `each-unit` or `each-unit-with-test`, and leaves the `helper` and `action` steps to #90. This answers part of draft answer 10: #89 will not check the `action` steps, so nothing needs to reach #89 about them. It also answers the question that the review of #89 drafted for this ticket, about flags with a fixed value. The draft blocks hold a fixed value only where a run must pass it, which means `--done <phase>` and `--to "in progress"`.

This new question is for the coordinator of the wave, about #89, and it is non-blocking for this ticket. The draft rule of #89 says that "a command step takes the earliest matching session call" and that "a step after the units must come after the last step of every unit" (draft answers 6 and 7). Three steps of the draft blocks break that. First, `cstack unit collect <n>... --plan <plan file>` has no condition, so #89 lists it, and `<n>...` must match one or more numbers, or every run shows it as skipped. Second, `build.md` (lines 22 and 23) runs `cstack unit collect` and `cstack plan status` after every batch. With more than one batch, their earliest call comes before the steps of the later units and shows as out of order. Third, the blocks of `plan.md` and `retro.md` both hold `cstack helper start executor --plan <plan file>` and `cstack helper wait <helper id>`, as their prose requires (`plan.md`, lines 51 and 55; `retro.md`, line 25). The earliest call is the one of the plan phase, which comes before `cstack next --done retro`, so the retro steps show as out of order. This ticket stays correct whatever the answer, because the blocks follow the guides, and the fix belongs to the matcher of #89. The question goes word for word as in the short version, in English, through the coordinator's `ask`, which the decisions allow for coordination. It should go now, because #89 is being built.

Draft answer 11 and the rest of draft answer 10 need a different channel, and they stay non-blocking. The document phase comments only on the tickets of the "Feeds" footer (`document.md`, line 15), which for this ticket are #91 and #92. #90 is not among them, so a comment on #90 is an extra write to another ticket, and the user sees it word for word in the short version. Without it, #90 starts without knowing that the `action` steps are unchecked and that `review.md` (lines 17 to 20) has four reviewers, not the three of US-1 AC4.

The other draft answers, 4 to 9, stay as written. One detail for answer 4: the second case of the new test should check the prefix `cstack next --done <phase>` followed by a space or the end of the line, because `dependencies.md`, `code-map.md`, `questions.md` and `plan.md` write the command without `--plan`.

I checked security and authorization, scale and performance, operations and cost, and the user-facing output, and found nothing there. The change is text in guides and tests, the printed guides do not change, and a plain revert undoes it.

### Open questions and answers

1. Which steps go in a block. Blocking question 1. Recommended: commands, named helpers, and one action for each deed that writes something, runs a required check, or waits for the user's answer.
2. How to read the places where the prose is unclear. Blocking question 2. Recommended: the normal path only, no step whose condition is outside the seven, and the five readings written under the question.
3. How to keep the three tests that break. Blocking question 3. Recommended: read the guide through `withoutBlock()`. Checked in a copy of the repository: the three files pass with the draft blocks.
4. Where the new tests live, non-blocking. Recommended: one new file, `cstack/test/guides/steps-blocks.test.ts`, with three cases that all fail on today's guides. The first case checks that each phase of `PHASES` has a guide with a block of at least one step. The second checks that each block names `cstack next --done <phase>` for its own phase, which catches a block copied into the wrong guide. The third checks that `cstack guide <phase>` prints each real guide as the text that follows its block and the empty line after it. `cstack/test/guide.test.ts` does not change, because it already passes.
5. How a command is written, non-blocking. Recommended: exactly as the prose of the guide writes it, with the same placeholders. So `dependencies.md` gets `cstack next --done dependencies` without `--plan`, because its prose has none.
6. The order of the steps, non-blocking. Recommended: the order in which a run does them. Where the prose describes a step after the moment it happens, such as the escalation of a stuck unit in `build.md`, the block puts it where it happens: after the wait for that unit.
7. A step that two guides name, non-blocking. Recommended: it goes only into the block of the guide that the run follows at that moment. The wait for the executor of the `publish` phase goes into the block of `retro.md`, whose prose names it, and not into the block of `plan.md`.
8. The start of a phase, non-blocking. Recommended: no block lists `cstack next` without `--done`, because the audit checks the phases from `PHASES`.
9. The other tests that read the raw guides, non-blocking. Recommended: they keep reading the raw file. `settings-applied.test.ts`, `prompts.test.ts` and `brief-rules.test.ts` look for forbidden words, and the block must obey the same rules as the prose.
10. How the audit checks an action step, non-blocking, for #89 and #90. Neither ticket says how `cstack audit` checks an `action` step. #89 checks the phases and the commands, and #90 checks the helpers and the conditions. Recommended: tell the coordinator of the wave now, because #89 is being built at the same time, and let #90 decide. Until then, the action steps of the blocks are written but not checked.
11. The number of code reviews, non-blocking, for #90. US-1 AC4 speaks of three code reviews, but `review.md` (lines 17 to 20) launches four reviewers. The block follows the guide, with four helper steps. Recommended: say so in the comment for #90.

The answers of the round, on 2026-11-23. The user agreed with everything: blocking questions 1, 2 and 3, draft answers 4 to 9, and the three points that the advisor listed under "I will do this unless you say no". Draft answer 10 and the question for the coordinator about the matching of #89 got their answer from #89 through the coordinator, and it is written in `## Decisions`. The coordinator posted the note for #90, which covers draft answers 10 and 11, with the user's approval.

The draft blocks below follow the recommended answers. Each block sits at line 1 of its guide, followed by one empty line and then the prose, unchanged. They passed `readSteps()` and `stepProblems()` in the copy of the repository.

- `ticket.md`: `command: cstack tracker read '<key>' --tracker <name>`, `action: create-plan-file`, `command: cstack next --done ticket --plan <plan file>`.
- `dependencies.md`: `action: write-dependencies`, `command: cstack next --done dependencies`.
- `code-map.md`: `action: write-code-mapping`, `command: cstack next --done code-map`.
- `questions.md`: `action: write-open-questions`, `action: write-blocking-questions`, `helper: resolve-issue:cto-review before-plan`, `action: question-round`, `command: cstack next --done questions`.
- `plan.md`: `action: write-architecture`, `helper: resolve-issue:cto-review plan-delta | new-structural-decision`, `action: write-decisions`, `action: write-implementation-units`, `action: write-documentation-duties`, `action: approval-gate`, `command: cstack next --done plan`, `command: cstack helper start executor --plan <plan file>`, `command: cstack helper wait <helper id>`.
- `build.md`: `command: cstack tracker move '<key>' --to "in progress" --tracker <name>`, `action: check-out-branch`, `action: commit-plan-file`, `command: cstack unit order --plan <plan file>`, `command: cstack helper start implementer --plan <plan file> --unit <n> | each-unit`, `command: cstack unit red <n> | each-unit-with-test`, `command: cstack unit green <n> | each-unit-with-test`, `command: cstack unit commit <n> | each-unit`, `command: cstack helper wait <helper id> | each-unit`, `command: cstack helper start implementer-escalation --plan <plan file> --unit <n> | each-stuck-unit`, `command: cstack unit collect <n>... --plan <plan file>`, `command: cstack plan status --plan <plan file>`, `action: check-the-user-interface | user-interface`, `command: cstack next --done build --plan <plan file>`.
- `review.md`: `action: write-impact-notes`, `helper: resolve-issue:code-reviewer-deep correctness`, `helper: resolve-issue:code-reviewer-deep security`, `helper: resolve-issue:code-reviewer conventions`, `helper: resolve-issue:code-reviewer-simplicity`, `action: write-review-findings`, `action: run-test-commands`, `command: cstack next --done review --plan <plan file>`.
- `independent-review.md`: `action: check-the-settings-file`, `helper: resolve-issue:pr-reviewer`, `command: cstack next --done independent-review --plan <plan file>`.
- `update-branch.md`: `action: fetch-the-target-branch`, `command: cstack next --done update-branch --plan <plan file>`.
- `document.md`: `command: cstack tracker comment '<key>' --body-file <file> --tracker <name>`, `command: cstack tracker comment '<key>' --body-file <file> --tracker <name> | each-dependent-ticket`, `action: write-documentation-places`, `command: cstack next --done document --plan <plan file>`.
- `briefing.md`: `helper: resolve-issue:cto-review after-build`, `command: cstack next --done briefing --plan <plan file>`.
- `after-build-questions.md`: `action: write-non-blocking-questions`, `command: cstack next --done after-build-questions --plan <plan file>`.
- `ready.md`: `action: draft-pull-request`, `action: write-executor-notes`, `command: cstack next --done ready --plan <plan file>`, `action: commit-plan-file`, `command: cstack helper done done --helper <helper id> --plan <plan file>`.
- `retro.md`: `action: write-retrospective`, `action: commit-retrospective`, `command: cstack next --done retro --plan <plan file>`, `command: cstack helper start executor --plan <plan file>`, `command: cstack helper wait <helper id>`.
- `publish.md`: `command: cstack publish --plan <plan file>`, `command: cstack next --done publish --plan <plan file>`, `command: cstack helper done published --helper <helper id> --plan <plan file>`.

### Architecture options
