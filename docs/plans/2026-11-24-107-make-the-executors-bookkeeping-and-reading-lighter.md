# Plan: #107 — R2-6: Make the executor's bookkeeping and reading lighter

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/107
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/lighter-executor
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T11:28:45+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Make the executor spend fewer answers on the bookkeeping of the run, and read less text that it does not need.

- **What the title means**: The executor is the helper that builds the plan of a ticket. Each time it answers, the model reads its whole context again, and those tokens count. Bookkeeping means the answers that only record the progress of the run, such as `cstack next --done <phase>`, instead of doing the work.
- **Why we are doing it**: Ticket #87 found where the extra tokens of runs 3 and 4 came from. After R2, about 0.8 million cache read tokens per run would still come from the executor's bookkeeping. About 1.3 million more come from text that the executor gathers, such as the conventions file in full. Without this ticket, the token measure of runs 5 and 6 is likely to fail.
- **For the user**: A run of `resolve-issue` uses less of the user's quota, with the same steps.

**Goal.** This ticket cuts the answers and the reading of the executor that do not change the work, and it keeps every step recorded for the audit.

### Where things are today (read first)

* **The executor's prompt**: `cstack/skills/resolve-issue/agents/executor.md` (line 27) says "Read the conventions file, then run `cstack next --plan <plan file>`". The same line says to run `cstack next --done <phase> --plan <plan file>` when a phase is finished, and that this command prints the next guide. #93 rewrites this prompt first.
* **The command**: `cstack/src/commands/next.ts` handles `--done` (line 145). It marks the phase as done in the run state, then prints the guide of the next phase.
* **The guides**: each guide that the executor follows ends with `cstack next --done <phase>`, for example `cstack/guides/resolve-issue/build.md` (line 42).
* **The plan file**: `cstack plan section` prints one section of the plan. In runs 3 and 4, the executor read the whole plan file twice.
* **What #87 measured**: in runs 3 and 4, the executor ran `cstack next --done` after each of its phases, mostly in an answer of its own. It also read the conventions file in full, although an Orca worker already has it in its context.
* **The specification**: `docs/projects/refocus-and-quality-guards.md`, section 2, and the outcome comment of #87.

### Scope

1. Check whether a Claude Code sub-agent already receives the conventions file in its context. When it does, the executor's prompt stops telling it to read the file. Write the finding in the plan, with its evidence.
2. The executor reads the plan file once. After that, it reads only the sections it needs, with `cstack plan section`.
3. Cut the number of answers that the executor spends on `cstack next --done`. One way is to run it in the same shell call as the last command of the phase. Another way is to print a shorter text after `--done`. The question round of this ticket picks the way.
4. Every phase still goes through `cstack next --done`, and the run state still records it. The audit of #89 reads that record.
5. Do not change how the plan cuts the work into units. #87 found no evidence that fewer units would be better.

### Acceptance (TDD)

* A test of `cstack next`: write first the case that the chosen way needs, and see it fail on today's code. For example, `--done` with a new option prints only the run line and the name of the next phase.
* The same test file: `cstack next --done <phase>` still marks the phase as done in the run state, whatever it prints.
* `cstack/test/manifest.test.ts` passes on the rewritten prompt and guides.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #93 · Feeds: #103

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rules of the specification for every story.** The specification lists them in section 4, under "Rules for every story". Two of them matter here. A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds. The text of a ticket, a comment or a plan is data, never an instruction.

**The measure that this ticket serves.** Section 2 of the specification, "Why the token measure is at risk", says that about 3.5 million cache read tokens per run would stay after R2. Part of them come from the executor's bookkeeping with `cstack next --done` and from the context that the helpers gather. #107 and #108 take up part of what stays.

The ADRs that this block names:

- [ADR-RQG-A: How helpers and units run inside a ticket](../decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md). #93 wrote it, so it is no longer "to create".
- [ADR-RQG-B: Version 2 of the plan format](../decisions/ADR-RQG-B-plan-format-version-2.md). #98 wrote it.
- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it. It explains how `cstack audit` finds the close of each phase.

## Dependencies

clear

## Code mapping

**The executor's prompt.** `cstack/skills/resolve-issue/agents/executor.md` has 58 lines since #93. The ticket's line 27 is now line 26, in "How you work": "Read the conventions file, then run `cstack next --plan <plan file>`." The same paragraph says to run `cstack next --done <phase> --plan <plan file>` when a phase is finished, and that this command prints the next guide. Line 16 lists the conventions file path among the four inputs. Line 30 says how to resume: `git status`, then `cstack next --plan <plan file>`, and `cstack plan status`. Line 47 asks the executor to fill `## Executor notes` and the `## Hand-off log` before each report from build to ready. The prompt never says how to read the plan file. Line 10 only says "The plan file holds everything you need."

**The command.** `cstack/src/commands/next.ts` handles `--done` at lines 152 to 174. It runs the checks of the phase (line 159), refuses with exit 1 and one line per missing part (lines 160 to 163), writes the header lines that the phase names (lines 165 to 167), and marks the phase done in the run state (line 168). Then it looks for the next phase. When the next phase runs in the same place, it prints the run line, the settings block and the guide, through `printGuide()` (lines 41 to 56 and 202). When the next phase runs in the other place, it prints one sentence instead (lines 193 to 200). After `--done publish` it prints one sentence that names `cstack report submit published` (line 183). The usage line is line 20, and the manifest entry is `cstack/src/manifest.ts`, lines 106 to 111. The phase list is `cstack/src/phases.ts`, lines 98 to 117. The executor runs nine phases: build, review, independent-review, update-branch, document, briefing, after-build-questions, ready and publish. `--done ready` writes `Status: ready for review` and its time into the plan file (`cstack/src/phases.ts`, line 115), so the plan file changes on disk under the executor.

**The end of each guide that the executor follows.** Every guide ends with a section "End of the phase" whose last sentence is "Run `cstack next --done <phase> --plan <plan file>`." These are `build.md` line 54, `review.md` line 45, `independent-review.md` line 34, `update-branch.md` line 30, `document.md` line 42, `briefing.md` line 22 and `after-build-questions.md` line 36, all in `cstack/guides/resolve-issue/`. `ready.md` closes in step 1 of "Close the build" (line 23), then commits the plan file and submits the done report (lines 24 and 25). `publish.md` closes at step 3 of "Exit code 0" (line 26) and repeats it at line 51. The last deed before the close differs by guide. In the build it is the commit of the plan file (`build.md`, line 36). In the review it is the test run (`review.md`, line 41). In the independent review and the document phase it is a write into the plan file (`independent-review.md`, line 30, and `document.md`, line 38). Each guide also opens with a block of mandatory steps whose last line is `command: cstack next --done <phase> --plan <plan file>`, for example `build.md` line 13. ADR-RQG-C says that every phase ends with that step (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, line 24). No test checks the wording of an "End of the phase" section today. A search of `cstack/test/` for "End of the phase" and for "Run \`cstack next --done" finds nothing outside the fixtures.

**How the audit finds the close of a phase.** `cstack/src/audit/calls.ts` reads every Bash call of the session files (lines 26 to 39) and splits each command with `cstackCommands()` of `cstack/src/audit/shell.ts`. That reader ends a simple command at `&&`, `||`, `|`, `;`, `(` and `)` (lines 146 to 162), and it skips heredoc bodies and quoted text. So `git commit -m x && cstack next --done review --plan <file>` gives one `cstack` call with the arguments `next --done review --plan <file>`. `cstack/test/audit-shell.test.ts` line 5 already checks two calls joined by `&&`. `matchesStep()` of `cstack/src/audit/match.ts` (lines 76 to 94) checks the words and the flags of the step, and it ignores an extra flag of the call. So a new flag on `--done` would still match the step. The phase lines of the executor's phases come from the run state, not from the session (`cstack/src/audit/evaluate.ts`, lines 58 to 62). The step line `cstack next --done <phase>` first looks for a matching call in the window of its phase (line 291), and falls back on the run state (lines 214 to 219). The record word at the end of the line says which proof was used: `session` or `run state`. `cstack/test/audit.test.ts` line 1029 shows the shape `document: cstack next --done document: done <time> session`. The main conversation's session files are found from `next --done ticket` and the other calls that only the main conversation makes (`cstack/src/audit/main-session.ts`, lines 6 to 11), so the executor's calls do not change that search.

**Reading the plan.** `cstack plan section <name> --plan <file>` prints one level-2 or level-3 section and nothing else (`cstack/src/commands/plan-section.ts`, lines 11 to 13 and 47 to 53). A name matches a heading that equals it or starts with it followed by ":", " (" or " —", so `Unit 3` matches `### Unit 3: <name>`. The implementer prompt already reads its sections this way (`cstack/skills/resolve-issue/agents/implementer.md`, line 23). The plan files of this wave weigh between 78 and 112 kilobytes once a run ends, so one full read costs tens of thousands of tokens that stay in the context for every later answer. Most of that weight is the "History" part, which the template says helpers skip (`cstack/skills/resolve-issue/templates/plan.md`, the comment under "## Ticket").

**What the harness does when a file changes on disk.** In this session, Claude Code 2.1.330 accepted an Edit of a scratch file after a Read of five lines only, with an offset and a limit. When the file then changed on disk, the harness added the changed lines to the context, and the next Edit passed without a new Read. So a partial read of one section is enough to edit it. This is a fact about the main session of this run, not yet about a sub-agent.

**Tests that cover this area.** `cstack/test/next.test.ts` tests `--done` at lines 142 to 387, in a temporary repository for each case. `cstack/test/prompts.test.ts` tests the executor prompt at lines 94 to 131. It checks the words `cstack next` and `cstack report submit`, the four report kinds, the sentence "Never end your turn while a sub-agent that you started still runs.", `git status` in the resume paragraph, and the sentence about a run line in the main conversation. `cstack/test/manifest.test.ts` line 72 scans every `cstack` command and flag named in the skills and the guides, so a new flag needs its entry in `cstack/src/manifest.ts` first. `cstack/test/guides/steps-blocks.test.ts` checks the blocks of mandatory steps. The end-to-end test `cstack/test/e2e/resolve-issue.test.ts` checks at line 120 that each guide output starts with the run line and the settings block, so a change of what `--done` prints would touch a file that is not in this ticket's list. `cstack/test/guides/helpers-are-sub-agents.test.ts` refuses a sentence that tells Claude to start an Orca worker.

**History and risks.** `executor.md` changed in 10 recent commits. It usually changes with `cstack/test/prompts.test.ts`, `implementer.md`, `ready.md`, `publish.md` and `build.md`. `next.ts` changed in 10 commits, mostly with `cstack/test/next.test.ts` and `cstack/src/manifest.ts`. `build.md` changed in 14 commits, the busiest guide, with no repeated bug fix. The follow-up of #96 changes the paragraphs about the user's answers in `cstack/guides/resolve-issue/plan.md`, so a change there can conflict. The main risk is that a phase gets closed when its last step failed. A close joined with `&&` runs only when the command before it exits with 0. A close sent next to a file edit, in the same answer, would run even when the edit failed. Three phases have no check of their own on `--done` (`independent-review`, `update-branch` and `publish` in `cstack/src/phases.ts`, lines 107, 108 and 116), so `cstack` would not catch that case there.

**Governing decisions.** ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`) says that every phase ends with `cstack next --done <phase>` (line 24) and that a phase line and the `--done` step of the same phase share their call (line 91). ADR-RQG-A (`docs/decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md`) says that the executor and the implementers are sub-agents. The comment of the run of #93 on #107 says that the executor ends with its report and keeps its turn while an implementer runs. The `WHY:` comments of `next.ts` (lines 125, 158 and 164) say that the settings are read before any state is written, and that the header lines are written before the phase is marked done.

## Decisions

- The comment of the run of #93 on #107 says this. The executor prompt now ends with the report submitted by `cstack report submit`, and its final message is the same report, with the kind on the first line. It keeps its turn while an implementer runs. The plan guide says what the main conversation does when the executor returns with no kind: it first sends a message to the same executor, and only then starts a fresh one, once. This ticket builds on both rules and keeps them. (2026-11-24, from the comment of the run of #93 on #107)
- This ticket takes the way that joins the close to another step of the phase. The executor runs `cstack next --done <phase> --plan <plan file>` in the same shell call as a command of the phase, joined with `&&`, or in the same answer as the last edit of the plan file. `cstack next` does not change. (2026-11-24, the user's answer: "ok, j'accepte la première façon")
- The acceptance of the ticket changes with that way. The first failing tests are tests of the executor prompt and of the guides, in the new file `cstack/test/guides/executor-bookkeeping.test.ts`. `cstack/test/next.test.ts` gets one case that checks that `--done` still records the close in the run state and prints the next guide in the same call. That case passes on today's code. (2026-11-24, the user's answer)
- A Claude Code sub-agent receives the whole `CLAUDE.md` of the repository in its first message. The transcript of the CTO advisor of this run shows it, in the session folder of this run under `subagents/`. Its line 9 is an `instructions` attachment that lists `CLAUDE.md` as a `Project` file. Its line 15, the first request to the model, holds the whole file under "Contents of <repository>/CLAUDE.md (project instructions, checked into the codebase):". (2026-11-24, tested answer)
- The executor prompt stops telling the executor to read the conventions file. It tells it to read the file once only when its context does not already show the text, because a repository can name a conventions file with another name than `CLAUDE.md` (`cstack/skills/resolve-issue/SKILL.md`, line 42: "the markdown file at the repository root that says how the team works there, usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`"). (2026-11-24, tested answer and accepted by default by the user)
- The executor reads the plan file once, when it starts, up to the line of `## History`. After that, it reads a section only with `cstack plan section <name> --plan <plan file>`. When the Edit tool asks it to read the plan file again, it reads only the lines of the section that it changes. In the main session of this run, Claude Code 2.1.330 accepted an Edit after a Read of five lines with an offset and a limit. This was not tested in a sub-agent. (2026-11-24, accepted by default by the user)
- A command joined to the close never holds a pipe. A pipe keeps the exit code of its last part, so `false | tail -1 && echo closed` prints "closed" in zsh and in bash. (2026-11-24, accepted by default by the user, tested by the CTO advisor)
- When the output of a joined call is cut, the executor runs `cstack next --plan <plan file>` to print the guide again, and never reads the saved output in full. In the CTO advisor's test, Claude Code saved a Bash output of 43.9 KB to a file and showed only its first 2 KB. `cstack next --plan` keeps the run state (`cstack/src/run-state.ts`, line 161: "if (existing) return existing;"), and it only writes the start time of the phase again (`cstack/src/run-progress.ts`, line 62). (2026-11-24, accepted by default by the user)
- A Bash call sent in the same answer as an Edit still runs when the Edit fails. The main conversation tested it in this session: an Edit failed with "String to replace not found in file.", and the Bash call sent after it ran. `cstack` refuses the close of review, document, briefing, after-build-questions and ready while their section is not filled (`cstack/src/phases.ts`, lines 105 to 115). Independent-review, update-branch and publish have no such check (`cstack/src/phases.ts`, lines 107, 108 and 116). The executor sees a failed edit in the same results and can redo it after the close. (2026-11-24, tested answer and accepted by default by the user)
- The new rules go into the part "How you work" of `cstack/skills/resolve-issue/agents/executor.md`. The end of each of the nine executor guides points to them: `build.md`, `review.md`, `independent-review.md`, `update-branch.md`, `document.md`, `briefing.md`, `after-build-questions.md`, `ready.md` and `publish.md` in `cstack/guides/resolve-issue/`. `cstack/src/commands/next.ts`, `cstack/src/manifest.ts`, `README.md`, `cstack/guides/resolve-issue/plan.md`, the end-to-end test and the source files of the audit do not change. (2026-11-24, accepted by default by the user)
- The blocks of mandatory steps of the nine executor guides do not change, because the command `cstack next --done <phase> --plan <plan file>` stays the same. A case of the new guide test checks that each of the nine blocks still holds it. (2026-11-24, accepted by default by the user)
- The audit still finds a close joined to another command. Its shell reader ends a simple command at `&`, `|`, `;`, `(` and `)` (`cstack/src/audit/shell.ts`, line 146: `} else if (c === "&" || c === "|") {`). `chooseCall()` takes the first call at or after the floor (`cstack/src/audit/evaluate.ts`, line 32: "const first = times.find((time) => floor === undefined || time >= floor);"). The new test file `cstack/test/audit-chained-close.test.ts` checks it with real session lines. It is a file of its own, because #100 may change the other audit tests in this wave. (2026-11-24, accepted by default by the user)
- Some cases pass on today's code by nature, because they guard behaviour that already exists. These are the case of `cstack/test/next.test.ts` of unit 4, the two cases of `cstack/test/audit-chained-close.test.ts`, and the nine cases of the guide test that check the blocks of mandatory steps. They are the only allowed exceptions to the rule that each new test case fails first. The implementer names them in its report as these exceptions, and proves each one by breaking the rule it guards on purpose, one at a time. (2026-11-24, an assumption not asked)
- The executor still passes the conventions file path to the implementers, the reviewers and the CTO advisor. Their prompts are outside the files of this ticket. (2026-11-24, an assumption not asked)
- The executor prompt keeps every sentence that `cstack/test/prompts.test.ts` checks (lines 97 to 131). It keeps the text `cstack next --plan <plan file>`, which the end-to-end test follows (`cstack/test/e2e/resolve-issue.test.ts`, line 322). Each guide keeps the text `cstack next --done <phase> --plan <plan file>`, which the end-to-end test follows (lines 369 to 384 and 475). (2026-11-24, from the code mapping)
- Item 1 of the scope needs evidence, not a guess. To learn whether a Claude Code sub-agent already receives the conventions file in its context, the main conversation reads the transcript of one of its own sub-agents in the session folder of this run. It reads only the session files of this run. The finding goes in this plan with the file and the line that show it. (2026-11-24, from the brief of the run)
- `cstack audit` finds the close of each phase from the call `cstack next --done <phase> --plan <plan file>`, as ADR-RQG-C explains. If this ticket runs that call in the same shell call as another command, or changes its text, check that the audit still finds it, and add a test of the audit for it. (2026-11-24, from the brief of the run)
- The follow-up of #96 changes the paragraphs about the user's answers in `cstack/guides/resolve-issue/plan.md`. If this ticket changes that guide too, it changes only the lines about the executor, and a small conflict is expected when `main` brings the follow-up into this branch. (2026-11-24, from the brief of the run)
- Two tickets of milestone R2 of epic #84 start now, each in its own worktree and with its own pull request, and #100 of milestone R3 already runs in another worktree. #97 works in `cstack/src/settings.ts` and its tests, `.cstack/settings.json`, the settings template `cstack/skills/resolve-issue/templates/settings.json`, `cstack/src/tracker/ready.ts`, `cstack/src/run-state.ts` for the field `readAt` only, the file that declares the Orca setup hook, and the paragraphs of `README.md` about the settings and the setup. #100 works in `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/saved-runs.ts`, `cstack/src/audit/` for one unit, their tests, and their paragraphs of `README.md`. The follow-up of #96 changes the paragraphs about the user's answers in the guides `questions.md`, `plan.md` and `dependencies.md`. The follow-up of #102 changes `.github/workflows/ci.yml`. (2026-11-24, from the brief of the run)
- This ticket works in `cstack/skills/resolve-issue/agents/executor.md`, in the end of the phase guides that the executor follows, in the output of `cstack next --done` in `cstack/src/commands/next.ts` if the question round picks that way, and in their tests. It changes only these files. In `cstack/src/manifest.ts` and `README.md`, it changes only the entries and the paragraphs of this ticket. When it needs a file of another ticket of this wave, the main conversation asks the coordinator before it changes it. (2026-11-24, from the brief of the run)
- On `main`, #93, #95, #96 and #102 are merged. The guides start the executor and the implementers as sub-agents. `cstack wave`, the `cstack helper` commands, `cstack unit collect` and `cstack report check` are gone from the source. `cstack next --done plan` checks the facts of a plan. (2026-11-24, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and add no runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- Do not change the plan format, which #98 defined as version 2 in ADR-RQG-B. When this ticket needs a new line or a new section in the plan, it is a blocking question for the user, and the main conversation asks the coordinator before planning it. This plan file stays in format `cstack-plan/1`, because the installed `cstack` 0.3.2 writes and reads it. Any plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `cstack/test/guides/helpers-are-sub-agents.test.ts` reads every guide, skill and agent prompt. It refuses a sentence that tells Claude to start an Orca worker, except in `independent-review.md`. Text that describes an Orca worker without telling Claude to start one passes. (2026-11-24, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` is the first guide of a run. `cstack/test/skill-size.test.ts` counts it with `cstack/skills/resolve-issue/SKILL.md`, and it has almost no margin left. If a sentence is added to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-24, from the brief of the run; the README of the installed 0.3.2 holds this line, and on `main` the switch is gone, as `README.md` line 67 says)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-24, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-24, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. The main conversation puts those three rules, word for word, in the prompt of the executor. (2026-11-24, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to talk with the coordinator. (2026-11-24, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-24, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-24, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-24, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-24, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must not do needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-24, from the retrospective of #86, `docs/retros/2026-11-23-86.md`)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-24, from the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-24, from the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-24, from the retrospective of #86)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-24, from the retrospective of #89, `docs/retros/2026-11-23-89.md`)
- `cstack helper wait` takes no `--plan`. Run it only after the sub-agent has returned. The executor waits for the notification that the sub-agent finished, and only then runs `cstack helper wait`. (2026-11-24, from the retrospective of #89 and the runs of #95, #96 and #102)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-24, from the retrospective of #89)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-24, from the retrospective of #89)
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. The installed `cstack` 0.3.2 does not check it in `cstack publish`. (2026-11-24, from the retrospective of #89)
- A deliberate break of the code can make a test loop forever. Run each break with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`. If a vitest process of this worktree still runs after that, stop it. Never stop a process of another worktree. (2026-11-24, from the run of #99)
- When the plan asks a test to check a message, the plan gives the exact words of that message. Otherwise the implementer chooses its own words. (2026-11-24, from the runs of #91, #99 and #114)
- A question for the user reaches a ticket only after the user saw it, word for word, in the chat of the main conversation. (2026-11-24, from the run of #99)
- If a result of a sub-agent reaches the main conversation instead of the executor that started it, the main conversation sends it to the executor in a message. (2026-11-24, from the run of #91)
- Several runs share this machine. If the full `npm test` fails on a 5-second timeout, run the failing test file alone before you conclude that the code is wrong. (2026-11-24, from the runs of #91, #99 and #114, and the conventions file)
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the brief of the run)
- A line of `## Decisions` that says how a function behaves needs a test case of its own too, not only a line that says what it must not do. (2026-11-24, from the run of #118)
- When a unit has several refusals, the implementer breaks each refusal on its own, one at a time, and sees its own test fail. (2026-11-24, from the run of #98)
- A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the runs of #98 and #118)
- Before an implementer commits, it reads every line of `## Decisions` that names one of its files, and it checks that the code follows each one. (2026-11-24, from the run of #102)
- When `## Decisions` fixes the text of a comment for another ticket, the document phase posts that text word for word. (2026-11-24, from the runs of #95, #96 and #102)
- `cstack tracker comment` once printed a 504 error from GitHub, yet the comment was posted. Before you post a comment again after an error, read the ticket to see whether it is already there. (2026-11-24, from the runs of #95, #96 and #102)
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

## Architecture

The change is small, and the user's answer locked the approach. It changes the prose of the executor prompt and of the end of the nine executor guides, and it adds tests. No code of `cstack` changes. The change touches no endpoint, no database query and no external input, so there is no security surface. No new decision since the question round.

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

### Unit 1: Let the executor read the conventions file and the plan file only once

- Files: `cstack/test/guides/executor-bookkeeping.test.ts`, `cstack/skills/resolve-issue/agents/executor.md`
- Test: `cstack/test/guides/executor-bookkeeping.test.ts`: the part "How you work" of the executor prompt holds each of the seven sentences of the notes below, with one test case for each sentence, and an eighth case checks that the prompt no longer holds "Read the conventions file, then run". All eight cases fail before the prompt changes.
- Minimum code: in `cstack/skills/resolve-issue/agents/executor.md`, the paragraph of line 26 opens with "Read the conventions file, then run `cstack next --plan <plan file>`." Replace that first sentence with the two paragraphs of the notes, each on one line and each a paragraph of its own, followed by a third paragraph that opens with "Then run `cstack next --plan <plan file>`." and goes on with the rest of the old paragraph, unchanged.
- Refactor: none.
- Commit message: feat(skill): let the executor read the conventions file and the plan file only once
- Depends on: none

The first new paragraph holds these two sentences, on one line:

```
When your context already shows the text of the conventions file, as Claude Code shows the `CLAUDE.md` of the repository, do not read it again. Otherwise, read it once.
```

The second new paragraph holds these five sentences, on one line:

```
Read the plan file once, when you start, with the Read tool and a limit that stops before the line of `## History`. `grep -n '^## History' <plan file>` gives that line. After that, never read the whole plan file again. When you need a section again, or a section of the History part that a guide asks for, print it with `cstack plan section <name> --plan <plan file>`. When the Edit tool asks you to read the plan file again, read only the lines of the section that you change, with an offset and a limit.
```

The test file reads the prompt with `readFileSync` and cuts the part from the heading `## How you work` to the next `## ` heading, as the helper `section()` of `cstack/test/guides/executor-launch.test.ts` does (line 8). It uses `it.each` over the sentences, so that each sentence is its own case, and the case name quotes the start of the sentence. After its commit, the implementer also runs `cstack/test/prompts.test.ts`, `cstack/test/manifest.test.ts`, `cstack/test/guides/helpers-are-sub-agents.test.ts` and `cstack/test/e2e/resolve-issue.test.ts`, and they pass.

### Unit 2: Let the executor close a phase in the same call as its last step

- Files: `cstack/test/guides/executor-bookkeeping.test.ts`, `cstack/skills/resolve-issue/agents/executor.md`
- Test: `cstack/test/guides/executor-bookkeeping.test.ts`: the part "How you work" of the executor prompt holds each of the eight sentences of the notes below, with one test case for each sentence. All eight cases fail before the prompt changes.
- Minimum code: in `cstack/skills/resolve-issue/agents/executor.md`, insert the paragraph of the notes right after the paragraph that opens with "Then run `cstack next --plan <plan file>`.", as a paragraph of its own, on one line. Change no other line.
- Refactor: none.
- Commit message: feat(skill): let the executor close a phase in the same call as its last step
- Depends on: 1

The new paragraph holds these eight sentences, on one line:

```
Each answer that you give makes the model read your whole context again, so never spend an answer only on closing a phase. Run the close in the same shell call as a command of the phase, joined with `&&`, for example `git add <plan file> && git commit -m "<message>" && cstack next --done <phase> --plan <plan file>`. The close then runs only when the command before it succeeds. Never put a pipe in a command that you join to the close, because a pipe keeps only the exit code of its last part. For example, `npm test | tail -5 && cstack next --done review` closes the phase even when the tests fail. When the phase ends with an edit of the plan file, send the close in the same answer, as a second tool call right after the edit. The close then runs even when the edit fails, so read the result of the edit, and redo the edit in your next answer when it failed. When the output of a joined call is cut, run `cstack next --plan <plan file>` to print the guide again, and never read the saved output in full.
```

After its commit, the implementer also runs `cstack/test/prompts.test.ts`, `cstack/test/manifest.test.ts`, `cstack/test/guides/helpers-are-sub-agents.test.ts` and `cstack/test/e2e/resolve-issue.test.ts`, and they pass.

### Unit 3: Point the end of the nine executor guides to the close rule

- Files: `cstack/test/guides/executor-bookkeeping.test.ts`, `cstack/guides/resolve-issue/build.md`, `cstack/guides/resolve-issue/review.md`, `cstack/guides/resolve-issue/independent-review.md`, `cstack/guides/resolve-issue/update-branch.md`, `cstack/guides/resolve-issue/document.md`, `cstack/guides/resolve-issue/briefing.md`, `cstack/guides/resolve-issue/after-build-questions.md`, `cstack/guides/resolve-issue/ready.md`, `cstack/guides/resolve-issue/publish.md`
- Test: `cstack/test/guides/executor-bookkeeping.test.ts`: each of the nine guides holds its new sentence of the notes below, with one test case for each guide, and all nine cases fail before the guides change. Nine more cases, one for each guide, check that its block of mandatory steps still holds the line `command: cstack next --done <phase> --plan <plan file>` with the name of its phase. These nine pass at once and are allowed exceptions.
- Minimum code: in each guide, replace the old sentence of the notes with the new one. Change no other line, and leave the blocks of mandatory steps as they are.
- Refactor: none.
- Commit message: feat(skill): close each executor phase in the same call as its last step
- Depends on: 2

In `build.md` (line 54), `review.md` (line 45), `independent-review.md` (line 34), `update-branch.md` (line 30), `document.md` (line 42), `briefing.md` (line 22) and `after-build-questions.md` (line 36), the old sentence is "Run `cstack next --done <phase> --plan <plan file>`." with the name of the phase of the guide. The new sentence is this one, with the same name:

```
Run `cstack next --done <phase> --plan <plan file>` in the same shell call as the last command of the phase, or in the same answer as its last edit, as your prompt says.
```

In `ready.md`, the old step 2 (line 24) is "2. Commit the plan file. The done report is refused while the plan file has an uncommitted change." The new step 2 is this one:

```
2. Commit the plan file in the same shell call as the close of step 1, joined after it with `&&`. The done report is refused while the plan file has an uncommitted change.
```

The test case of `ready.md` checks the sentence "Commit the plan file in the same shell call as the close of step 1, joined after it with `&&`."

In `publish.md`, the old step 3 of "Exit code 0" (line 26) is "3. Run `cstack next --done publish --plan <plan file>`." The new step 3 is this one:

```
3. Run `cstack next --done publish --plan <plan file>` in the same shell call as the submit of step 4, joined before it with `&&`.
```

The test case of `publish.md` checks the sentence without its number. The last line of `publish.md` (line 51) stays as it is. The test reads each block with the helpers of `cstack/src/guide-steps.ts` or with a plain cut between `<!-- mandatory steps` and the first `-->`. After its commit, the implementer also runs `cstack/test/guides/steps-blocks.test.ts`, `cstack/test/manifest.test.ts`, `cstack/test/guides/helpers-are-sub-agents.test.ts` and `cstack/test/e2e/resolve-issue.test.ts`, and they pass.

### Unit 4: Check that a close joined to another command is recorded and audited

- Files: `cstack/test/next.test.ts`, `cstack/test/audit-chained-close.test.ts`
- No test: the three cases of this unit guard behaviour that already exists, so they pass at once and `cstack unit red` cannot save a failing run. They are allowed exceptions of `## Decisions`. The implementer proves each case by breaking the rule it guards on purpose, one at a time, with a time limit, and restores the code exactly each time.
- Minimum code: the three test cases of the notes below.
- Refactor: none.
- Commit message: test(cli): check that a close joined to another command is recorded and audited
- Depends on: none

The case of `cstack/test/next.test.ts` goes inside `describe("--done")`. Its name is "--done of each executor phase records the close and prints the next guide in the same call". It starts a run on an approved plan whose sections are filled, such as the one that `readyPlan()` gives, with the planning phases and the build marked done. Then, for each of review, independent-review, update-branch, document, briefing and after-build-questions in this order, it runs `--done <phase>`. After each call, it checks that the exit code is 0, that the run state holds a `doneAt` for that phase, and that `markers(stdout)` is exactly the marker of the next phase. Break it twice, one at a time: comment out the call `markDone(...)` of `cstack/src/commands/next.ts` (line 168), and then replace the call `printGuide(...)` of line 202 with `0`. The case must fail each time.

`cstack/test/audit-chained-close.test.ts` is a new file. Its first line is this comment:

```
// WHY: ADR-RQG-C — the executor joins the close of a phase to another command in one shell call, and the audit must still find that close.
```

It runs `cstack audit` on a finished run in a temporary repository, as `cstack/test/audit.test.ts` does. Copy only the setup that it needs from that file (lines 20 to 225), and change nothing in `cstack/test/audit.test.ts`. It has two cases.

- "prints the close of review as done from the session when a commit and the close share one Bash call". The session of the run holds one Bash call, inside the window of the review phase, whose command is `git add docs/plans/audit.md && git commit -m "docs: update the plan" && cstack next --done review --plan docs/plans/audit.md`. The audit prints the line `review: cstack next --done review --plan <plan file>: done <local time of that call> session`. Break it by making `&&` no longer end a command in `cstack/src/audit/shell.ts` (lines 146 to 162). The case must fail.
- "prints the close of publish and the submit of the report as done, in order, when they share one Bash call". The session holds one Bash call, inside the window of the publish phase, whose command is `cstack next --done publish --plan docs/plans/audit.md && cstack report submit published --plan docs/plans/audit.md <<'EOF'`, then a line "The pull request is open.", then a line `EOF`. The audit prints both lines `publish: cstack next --done publish --plan <plan file>: done <local time of that call> session` and `publish: cstack report submit published --plan <plan file>: done <local time of that call> session`. Break it by changing `>=` into `>` in `chooseCall()` (`cstack/src/audit/evaluate.ts`, line 32), or, if that does not make it fail, by breaking the rule that keeps two calls of one time in order. The case must fail.

## Documentation duties

- ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`): applies, written in the document phase. A new section "How the executor closes a phase" says that the executor joins `cstack next --done` to a command of the phase or sends it with its last edit, that the audit still finds that close, and that `cstack/test/audit-chained-close.test.ts` proves it. It adds to the record and changes none of its decisions.
- The `WHY:` comment that names ADR-RQG-C in `cstack/test/audit-chained-close.test.ts`: applies, written by unit 4.
- `README.md`: does not apply, because no command, flag or output changes.
- The `cstack next` entry of `cstack/src/manifest.ts`: does not apply, for the same reason.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply, because no story and no acceptance criterion of the epic changes.
- The comment on this ticket, #107: applies, written in the document phase. It records the tested answer about the conventions file with its condition, the way that the user chose, and the change of the acceptance.
- The comment on the dependent ticket #103: applies, written in the document phase. It says that the executor prompt now has rules about the close and the reading of the plan file, that the guards that #103 adds to the prompts must keep them, and that the implementers and the reviewers could also skip the conventions file when their context already shows it.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: The conventions file in a sub-agent's context

Does a Claude Code sub-agent, such as the executor, already have the conventions file `CLAUDE.md` in its context when it starts? If it does, the executor prompt stops telling it to read the file, and says instead: "When your context already shows the text of the conventions file, as Claude Code shows the `CLAUDE.md` of the repository, do not read it again. Otherwise, read it once." The main conversation answers it with a test: it reads the transcript of one of its own sub-agents of this run.
- For: the user, who can challenge the evidence
- Answer: yes, tested. The evidence is the transcript of the CTO advisor that this run started at the before-plan moment, the only file under `subagents/` in the session folder of this run at that time. The advisor is a custom agent of the skill, `resolve-issue:cto-review`, like `resolve-issue:executor`. Line 9 of the transcript is an `instructions` attachment that lists the `CLAUDE.md` of the repository as a `Project` file of 4,223 characters. Line 15 is the first request sent to the model. Its first block, in the role `user`, holds "Contents of <repository>/CLAUDE.md (project instructions, checked into the codebase):" followed by the whole file, and a check found the whole text of `CLAUDE.md` inside that block. The run used Claude Code 2.1.330. This repository has no conventions file with another name, so the test says nothing about such a file, and the rule keeps one read whenever the context does not show the file. (2026-11-24, tested answer)

### Question 2: How the executor stops spending an answer on `cstack next --done`

Which way does this ticket take to cut the answers that the executor spends only on `cstack next --done`? The first way changes only the executor prompt and the end of the nine guides that the executor follows. The executor joins the close to the last shell command of the phase with `&&`, in the same shell call. When the phase ends with an edit of the plan file, it sends the close in the same answer, as a second tool call right after the edit. `cstack next` does not change. The second way adds a flag to `cstack next --done` that prints a shorter text, such as the run line and the name of the next phase only. The second way saves no answer, because the executor still needs the next guide, so it would need one more call to print it. The recommendation is the first way. With it, the first test that fails on today's code is a test of the executor prompt and of the guides, not a test of `cstack next`. The test file of `cstack next` gets a case that checks that `--done` still marks the phase as done in the run state when another command runs before it in the same shell call. That case passes on today's code. The ticket asks for a failing test of `cstack next` first, so the user must accept this change of the acceptance.
- For: the user
- Answer: the first way. The executor joins the close to the last shell command of the phase with `&&`, or sends it in the same answer right after the last edit of the plan file. `cstack next` does not change, and the user accepts that the first failing tests are tests of the executor prompt and of the guides. (2026-11-24, the user's answer: "ok, j'accepte la première façon")

## Review log

<phase review and independent-review>

## Briefing

<CTO advisor, moment after-build>

## Non-blocking questions

- Should the implementers, the reviewers and the CTO advisor also skip reading the conventions file when their context already shows it? Their prompts are outside this ticket, and #103 rewrites the agent prompts next. For: the maintainer.
- Should `cstack next --done independent-review` check that the "Review log" holds the judgment calls of the independent review? The executor may now send the close in the same answer as its last edit, and that phase has no check that would refuse a close after a failed edit. For: the maintainer.

## Pull request

<phase pull-request>

## Documentation

<phase document>

## Executor notes

<executor>

## Hand-off log

- 2026-11-24, executor run 1: moved ticket #107 to "in progress" and started the build on branch gambitl/lighter-executor.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**The first failing test will be a test of the prompt and the guides, not of `cstack next`.** The ticket asks for a failing test of `cstack next` first. The way I recommend leaves `cstack next` as it is. The agent that builds the plan joins `cstack next --done <phase>` to the last shell command of the phase with `&&`, or sends it right after the last edit, in the same answer. A shorter output of `--done` saves nothing, because the agent still needs the next guide and would spend one more call to print it. I recommend accepting this change to the acceptance criteria, because it is the only way that really removes one answer per phase.

**I will do this unless you say no**

- The prompt forbids a pipe in the command that carries the close. `npm test | tail -5 && cstack next --done review` closes the phase even when the tests fail.
- When the output of that command is cut, the agent runs `cstack next --plan <plan file>` to see the guide again, and never reads the saved output.
- The prompt says to skip reading the conventions file only when the context already shows it. That condition matters, because the conventions file can be `AGENTS.md` or `CONTRIBUTING.md`, which Claude Code does not load.
- The agent reads the plan file once, up to `## History`, then only the sections it needs. To edit, it rereads only the lines of that section.
- The new rules go into "How you work" of the prompt. The last sentence of the nine guides points to them, and the blocks of mandatory steps stay the same.
- The test of the audit goes into a new file, so it does not collide with the audit tests that another ticket of this wave changes.

**I checked it myself**

- A sub-agent of this run gets the whole `CLAUDE.md` of the repository in its context from the start. I am one, and I see all 32 lines.
- In zsh, `false | tail -1 && echo closed` prints "closed", because a pipe keeps the exit code of its last command.
- A Bash output of 44 KB is saved to a file, and the agent sees only its first 2 KB. A guide printed after it would be hidden.
- The audit still finds a close joined with `&&`, and it keeps two steps of the same shell call in order.

**Good to know**

- The gain cannot show in this run, because this run follows the guides of the installed 0.3.2.
- Nothing checks the close of the independent review. If its last edit fails and the close goes out in the same answer, the phase closes anyway.

#### Details

The way to cut the bookkeeping answers is blocking question 2, and it changes the acceptance criteria of the ticket, so only the user can accept it. It cannot be answered with a test. I keep the draft recommendation. A flag on `cstack next --done` that prints a shorter text would save tokens of output but no answer, because the guide of the next phase is what the agent needs right after the close, and `cstack/src/commands/next.ts` already prints it in the same call (`printGuide()`, lines 41 to 56 and 202). The flag would also need a manifest entry in `cstack/src/manifest.ts` and would touch the end-to-end test `cstack/test/e2e/resolve-issue.test.ts`, which checks at line 120 that each guide output starts with the run line and the settings block. Joining the close to the last command keeps `next.ts`, the manifest and the end-to-end test unchanged. With that way, the case of `cstack/test/next.test.ts` that checks the run state after a joined close passes on today's code, so the first failing tests are tests of the prompt and the guides in `cstack/test/prompts.test.ts` or a new guide test. If nobody decides, the plan cannot start, because the acceptance criteria would not match the work.

A close joined after a pipe runs even when the command before the pipe fails. I tested it in this worktree. `false | tail -1 && echo closed` printed "closed" in bash and in zsh, and with `setopt pipefail` zsh printed nothing from the joined command. Agents often add `2>&1 | tail -n 20` to a test run to shorten its output, so the risk is real in the review phase, whose last deed is the test run (`cstack/guides/resolve-issue/review.md`, line 41). `cstack` would refuse such a close in the review phase only if the "Review log" were still empty, and it is filled before the test run. The decisions block already forbids a pipe after `cstack helper start` and `cstack helper wait`, but not before a close. I rejected the option of adding `set -o pipefail` to the joined call, because it depends on the shell that the harness uses and it is one more thing the agent can forget. The rule is simpler: the command joined to the close carries no pipe. This is non-blocking, and a sentence test in `cstack/test/prompts.test.ts` can hold it.

A joined close prints the next guide after the whole output of the command before it. I tested what Claude Code does with a long output in this session. A Bash output of 43.9 KB was saved to a file, and only its first 2 KB came back as a preview. So a guide printed at the end of a long test run would be hidden. In this repository the review phase runs `testCommands.all`, which is the type check and `npm test` over 103 test files, and that output is probably under the limit. `cstack` also runs in other repositories, whose test runners can print far more. If the agent then reads the saved file in full, it spends more than the answer it saved. The rule I propose is that when the output is cut, the agent runs `cstack next --plan <plan file>`, which prints the guide of the current phase again, as the resume paragraph of `cstack/skills/resolve-issue/agents/executor.md` (line 30) already relies on. I rejected redirecting the test output to a file, because it hides the details of a failure and adds a read every time. This is non-blocking.

Whether a sub-agent already has the conventions file in its context is blocking question 1, and it is answered with a test. I am a sub-agent of type `resolve-issue:cto-review`, started by the main conversation of this run. My context holds the full text of the repository's `CLAUDE.md`, all 32 lines, under the heading "project instructions, checked into the codebase", before any read. The executor is an agent of the same plugin, started the same way, so the finding applies to it. The answer of blocking question 1 records the transcript lines that show it, and my own context agrees with that record. The conditional wording of the draft is needed, not optional. `cstack/skills/resolve-issue/SKILL.md` (line 42) says the conventions file is usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`, and Claude Code loads only `CLAUDE.md` on its own. An unconditional "do not read it" would leave the agent without the conventions in a repository that uses `AGENTS.md`.

How the agent reads the plan file is non-blocking (draft question 4), and so is how it edits without a full reread (draft question 5). I keep both recommendations. The Read tool takes a line offset and a limit, not a heading, so the agent first needs the line number of `## History`, for example with `grep -n '^## History' <plan file>`. That costs one small call, which is far cheaper than reading the "History" part. The partial-read test of draft question 5 ran in the main session, not in a sub-agent, so the plan should say that, and the prompt should keep the fallback of rereading only the section that changes.

Where the rules go (draft question 6) and where the audit test goes (draft question 7) are non-blocking, and I keep both recommendations. I read the audit code to check that a joined close keeps its record `session`. `cstack/src/audit/calls.ts` (lines 18 and 38) gives every `cstack` command of one Bash call the time of that call. `chooseCall()` in `cstack/src/audit/evaluate.ts` (lines 32 to 37) takes the first call at or after the floor, with `>=`, so a step and the close that share one time stay in order. The window of a phase starts at the close time of the earlier phase, taken from the run state (line 291 and the `earlier` value above it). That time is written while `cstack next --done` runs, so it comes after the time of the call that carries it. The joined call therefore falls in the window of its own phase. The new test should still check it with a real session line, as the draft says.

Sending the close in the same answer as an edit of the plan file (draft question 3) is non-blocking, and I keep the recommendation to allow it. Claude Code runs tool calls that change state one after the other, in the order they were sent, and `cstack next --done` is not a read-only command. The draft test showed that a Bash call still runs after a failed Edit. The phases whose close checks a section (`cstack/src/phases.ts`, lines 105 to 115) refuse the close when the edit failed. The independent review has no check (line 107) and ends with a write into the "Review log" (`cstack/guides/resolve-issue/independent-review.md`, line 30). There, a failed edit followed by a close in the same answer closes the phase without the judgment calls. The agent sees the failure in the same results and can still write them, because an edit stays possible after a close. Adding a check to the independent review would mean changing `cstack/src/phases.ts`, which is outside the files of this ticket, so I leave it as a known gap.

Whether the other helpers should also stop reading the conventions file (draft question 8) is non-blocking and outside the files of this ticket. The ticket that rewrites the agent prompts next (#103) is the right place, so the outcome comment for it should carry the finding of blocking question 1 with its condition about `AGENTS.md` and `CONTRIBUTING.md`.

The measure of this ticket cannot be read in this run. The decisions of this plan say that this run follows the guides of the installed `cstack` 0.3.2, so the new prompt and guides take effect only in the next runs of the comparison. The acceptance criteria are structural, and the token gain shows only in runs 5 and 6.

I checked security and authorization, data model lock-in, scale, operations and cost, user experience and reversibility, and found nothing in them: the change is prose plus tests, it adds no flag, no plan format change and no dependency, and a revert undoes it.

### Open questions and answers

Each question has its label, the recommended answer, and its answer once it arrives.

1. **Does a sub-agent already have the conventions file in its context?** Blocking question 1. Recommended answer: test it with the transcript of the CTO advisor of this run, then write the rule of the question when the test says yes. Tested: yes, see blocking question 1 for the file and the lines.
2. **Which way cuts the answers spent on `cstack next --done`?** Blocking question 2. Recommended answer: join the close to the last command of the phase, or send it in the same answer as the last edit. `cstack next` does not change.
3. **Should the close be sent in the same answer as an edit, when the edit can fail?** Non-blocking, part of blocking question 2. Tested: in this session, a Bash call sent in the same answer as an Edit ran although the Edit failed with "String to replace not found in file." So a close sent after a failed edit still runs. `cstack` refuses the close of review, document, briefing, after-build-questions and ready while their section is not filled (`cstack/src/phases.ts`, lines 47 to 52 and 105 to 115). Independent-review, update-branch and publish have no such check. Recommended answer: allow it, because the executor sees the failed edit in the same results and can redo it in its next answer, and an edit of the plan file stays possible after a close. Update-branch and publish end with a shell command, so they join the close with `&&`.
4. **Does the one full read of the plan file include the "History" part?** Non-blocking. Recommended answer: no. The executor reads the plan file once, when it starts, with the Read tool, up to the line of `## History`. The template says that helpers skip "History" unless their prompt says otherwise. After that, it reads a section only with `cstack plan section <name> --plan <plan file>`, including a section of "History" when a guide needs it, such as "Architecture options" for a decision record.
5. **How does the executor edit the plan file without reading it whole again?** Non-blocking. Tested: in this session, Claude Code 2.1.330 accepted an Edit after a Read of five lines with an offset and a limit. After an outside change, the harness showed the changed lines, and the next Edit passed without a new Read. Recommended answer: when the Edit tool asks to read the plan file again, the executor reads only the lines of the section that it changes, with an offset and a limit.
6. **Where do the new rules go?** Non-blocking. Recommended answer: the rules and their reasons go into the "How you work" part of the executor prompt. The last sentence of the "End of the phase" part of each of the nine executor guides says to join the close as the prompt says. The blocks of mandatory steps do not change, because the command `cstack next --done <phase> --plan <plan file>` does not change. `cstack/guides/resolve-issue/plan.md` does not change.
7. **Where does the test of the audit go?** Non-blocking. Recommended answer: in a new test file, `cstack/test/audit-chained-close.test.ts`, because #100 may change the audit tests in this wave. It checks that `cstack audit` prints the close of an executor phase as done with the record `session`, when the Bash call joins a commit and the close with `&&`.
8. **Should the implementers, the reviewers and the CTO advisor also stop reading the conventions file?** Non-blocking, open, not needed for this ticket. Their prompts are not in the files of this ticket. #103 changes the agent prompts next, so the comment for #103 names it.
9. **May the command that carries the close hold a pipe?** Non-blocking, raised by the CTO advisor. Recommended answer: no. A pipe keeps the exit code of its last command, so `npm test | tail -5 && cstack next --done review` closes the phase even when the tests fail. Accepted by default (2026-11-24).
10. **What does the executor do when the output of the joined call is cut?** Non-blocking, raised by the CTO advisor. Recommended answer: it runs `cstack next --plan <plan file>` to print the guide of the current phase again, and never reads the saved output in full. Accepted by default (2026-11-24).

Answers of the round. Blocking question 1 was answered with a test, and the user did not challenge it. Blocking question 2 has the user's answer. The user's reply did not object to any item that the advisor listed under "I will do this unless you say no", so questions 3 to 7, 9 and 10 are accepted by default with their recommended answers, on 2026-11-24. Question 8 stays open, not needed for this ticket.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn.
