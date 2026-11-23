# Plan: #91 — R1-5: Run the audit in the retro phase

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/91
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/audit-in-retro
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T20:46:57+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** At the end of every run, have the skill run the audit of its steps and write the result into the run's retrospective.

- **What the title means**: The retro phase is the last phase before publication. In it, the skill writes a retrospective, a short file that records what went well and what went wrong in the run. The audit is the new command `cstack audit`, which says which steps the run did, skipped or did out of order.
- **Why we are doing it**: An audit that nobody runs finds nothing. When the retrospective holds its result, the skill that turns retrospectives into improvements reads it with everything else.
- **For the user**: After each run, the maintainer sees the skipped steps in the same place as the other lessons of the run.

**Goal.** This ticket makes the `retro` phase run `cstack audit` and write its result into the retrospective.

### Where things are today (read first)

* **The retro guide**: `cstack/guides/resolve-issue/retro.md`. The section "Write the retrospective" runs from line 5 to line 13, and line 7 gives the path `docs/retros/<YYYY-MM-DD>-<ticket id>.md`. "Commit it" is at lines 15 to 17. The guide ends at line 25 with `cstack next --done retro`.
* **The template**: `cstack/skills/resolve-issue/templates/retro.md` has a title (line 1), three header lines (lines 3 to 5) and the sections `## Protect` (line 7), `## Improve` (line 11) and `## Trap hit` (line 15).
* **The audit**: #89 and #90 build `cstack audit`. Its output holds only step names, verdicts and times.
* **The steps block of the retro guide**: #88 wrote it. The new step must appear in it.
* **The public text rule**: retrospectives are committed in `docs/retros/` of the repository. In this public repository, they must hold no path of the machine and no work content. `cstack publish` already refuses to push a line that holds the home folder path.

### Scope

1. In `retro.md`, before the retrospective is written, run `cstack audit <plan file>`.
2. Add a `## Steps` section to the retrospective template. It holds the audit lines as the command printed them.
3. For each step that the audit prints as skipped or out of order, also add an item under `## Improve`, which names the step and the phase.
4. Add the audit to the steps block of `retro.md`.

### Acceptance (TDD)

* `cstack/test/manifest.test.ts` passes: the retro guide names `cstack audit`, which exists.
* A template test: the retrospective template has a `## Steps` section between its header and `## Protect`. Write it first and see it fail.
* An end-to-end test with a recorded fixture run: the audit output that the guide asks to paste holds only step names, verdicts and times, and no path.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #88, #90 · Feeds: none

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rule of the specification for every story.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

**Acceptance criteria of US-1 that this ticket carries.** The specification lists them in section 4, under "US-1: Audit the steps of a run". #89 and #90 built the audit itself. This ticket carries AC9, and it keeps the negative criterion "The audit never prints, copies or sends the content of a session".

- AC9: The `retro` phase runs the audit and writes its result in the retrospective. `digest-retros` is the skill that turns retrospectives into improvements, and it then reads that result.
- AC (negative): The audit never prints, copies or sends the content of a session. It prints step names, verdicts and times only. A test checks this.

The ADRs that this block names:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

The two blockers are closed as completed. #88 is merged with pull request #111, and #90 is merged with pull request #117. Both are in `main`.

## Code mapping

**The line numbers of the ticket moved.** #88 added a block of mandatory steps at the top of `cstack/guides/resolve-issue/retro.md` (lines 1 to 7), so the sections that the ticket names moved down by eight lines. "Write the retrospective" now runs from line 13 to line 21, and line 15 gives the path `docs/retros/<YYYY-MM-DD>-<ticket id>.md`. Line 15 also says "Use four sources and no other", so the audit becomes a fifth source and that sentence must change. "Commit it" is at lines 23 to 25. The guide ends at line 33 with `cstack next --done retro --plan <plan file>`. Line 21 says "Keep the prose under fifteen lines", which the pasted audit lines must not count against.

**The block of the retro guide.** It is at `cstack/guides/resolve-issue/retro.md`, lines 1 to 7: `action: write-retrospective`, `action: commit-retrospective`, `command: cstack next --done retro --plan <plan file>`, `command: cstack helper start executor --plan <plan file>`, `command: cstack helper wait <helper id>`. The first comment on #91 asks to put the audit before `action: write-retrospective`. The rules for choosing steps are in `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, section "How a block chooses its steps" (line 50). A block writes each command as the prose writes it, with the same placeholders (line 64).

**The retrospective template.** `cstack/skills/resolve-issue/templates/retro.md` has the title (line 1), the three header lines `Date`, `Plan file` and `Outcome` (lines 3 to 5), then `## Protect` (line 7), `## Improve` (line 11) and `## Trap hit` (line 15). A closing comment at line 19 says "Keep the file under fifteen lines of prose". No code reads this template. Only `cstack/test/pack.test.ts` (line 35) names it, as a file of the package. `cstack/test/template.test.ts` tests only the plan template today, so a test of the retrospective template is new.

**How the audit decides and prints.** `cstack/src/commands/audit.ts` runs the whole command. It prints the phase lines of `evaluatePhases()` and then the step lines of `evaluateSteps()` (line 134), one per line with `formatLine()` (line 135). It exits with 1 when a line is not done, a session file is unreadable, or no session file holds the close of the ticket phase (line 141). `formatLine()` (`cstack/src/audit/evaluate.ts`, line 20) writes `<text>: <verdict>`, followed by the local time and the record (`session`, `run state` or `git`) when the line is not skipped. A step line reads `<phase>: <command as the guide writes it>` with its placeholders, so `<plan file>` stays a placeholder and never becomes a path. A unit step replaces `<n>` with the unit number (line 124). A helper line reads `<phase>: <helper>` and its word.

**Why a running phase gets a false verdict.** `evaluateSteps()` (`cstack/src/audit/evaluate.ts`, line 173) looks for the calls of a phase between the close of the phase before it (`earlier`, line 233) and the next close of a later phase that runs in the same place (`later`, line 234). While the retro phase runs, nothing after it is closed, so its window has no end, and the publish phase has none either. A call that the plan phase made after the close of `ready`, such as the main conversation's `cstack helper wait`, then sits in the window of the retro phase. This is what the run of #112 saw (`docs/retros/2026-11-23-112.md`, "Improve", fifth item). `evaluatePhases()` (line 39) prints `phase retro: skipped` and `phase publish: skipped` too, because the run state has no done time for them yet. So the audit exits with 1 inside the retro phase, as the second comment on #91 says.

**What the run state knows.** `isDone()` (`cstack/src/run-progress.ts`, line 12) says whether a phase is done, and a retro done before `ready` does not count. `nextPhase()` (line 21) gives the first phase that is not done and whose dependencies are done. Each phase depends only on phases before it (`checkPhaseList()`, `cstack/src/phases.ts`, line 122), so `nextPhase()` is also the first phase in the order of `PHASES` that is not done. The run state exists only after the approval: `cstack/src/run-state.ts`, line 165, marks the five planning phases done at that moment. So an approved run is at the build phase or later, and the audit refuses a plan with no approval (`readMoments()`, `cstack/src/measure/moments.ts`, line 77, "the plan file has no approval moment yet.").

**The refusals of the audit hold no path.** Every sentence of `fail()` in `cstack/src/commands/audit.ts` (lines 22 to 25) and every `MomentsError` of `cstack/src/measure/moments.ts` (lines 53 to 98) is a fixed sentence with no path. The tests "nothing private leaves the command" (`cstack/test/audit.test.ts`, line 1149) check that every printed line matches the allowed shape and that no folder and no session content leaks. They use a hand-built session file.

**The checks of the blocks and the mentions.** `cstack/test/manifest.test.ts` checks every `cstack` mention of the guides and skills against `cstack/src/manifest.ts` (`scan()`, line 52, and "passes on the real skills and guides", line 72). It also checks every block with `stepProblems()` ("passes on the real guides", line 230). The entry of `cstack audit` is at `cstack/src/manifest.ts`, line 78, with the usage `cstack audit <plan file> [--home <folder>] [--guides <folder>]`, so the mention `cstack audit <plan file>` matches it. `cstack/test/guides/steps-blocks.test.ts` checks that each block holds the close of its own phase and that `cstack guide` prints the prose after the block.

**The end-to-end test.** `cstack/test/e2e/resolve-issue.test.ts` runs the whole skill with the built `cstack` in child processes. Its `follow()` (line 94) checks that the guide or prompt names each command before it runs it, with `written()` (line 73) turning the plan path and the ids into placeholders and removing the extra flags of `EXTRA_FLAGS` (line 23). The retro phase is at line 411: it copies `cstack/test/fixtures/e2e/retro.md` and commits it. The case at line 467 checks that the home folder of the run never gets a `.claude` folder, so the session files of a recorded run must live in another folder, given with `--home`. Every call goes through `run()` (line 67), so the test can record each call with its time. The audit finds a session file by its `cwd` and the time window of the run state (`findRunFiles()`, `cstack/src/measure/sessions.ts`, line 69), and it reads a call from a `tool_use` item named `Bash` on an `assistant` line with a `timestamp`.

**The public text checks.** `cstack/test/fixtures-public.test.ts` fails on a home folder path in any file of `docs/plans/` or `docs/retros/` (line 72), and on a home path, an email or a private host in any fixture or end-to-end file (line 83).

**The digest skill.** `digest-retros` lives only in the frozen top-level `skills/digest-retros/SKILL.md`. It reads the "Improve" and "Protect" items (line 28) and knows no `## Steps` section. This ticket may not edit it, so the items under "Improve" are what the digest reads first.

**Risks.** Six of the last ten commits of `cstack/src/audit/evaluate.ts` are fixes (`git log --oneline -n 10`), mostly about the windows and the floors of the steps. A change there needs a test for each window. `cstack/test/audit.test.ts` is 1,185 lines long, and its cases rely on `fullPhases()`, where every phase is done. The README paragraph of `cstack audit` (`README.md`, line 54) is one long paragraph that must stay true.

**Governing decisions.** ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`) decides the blocks, the conditions, the rule that a call serves one line (line 92), and that `action` steps are never printed (line 86). The specification rejected an audit that stops a run (`docs/projects/refocus-and-quality-guards.md`, section 10). No `WHY:` or `DECISION:` comment in `cstack/src/audit/` or `cstack/src/commands/audit.ts` touches this ticket. `isDone()` carries a `WHY:` about a retro done before `ready` (`cstack/src/run-progress.ts`, line 10).

## Decisions

- The question round asks the user how the audit treats the steps of a phase that is still running, such as the retro phase itself. In the run of #112, the line `retro: cstack helper wait <helper id>` showed a false "done" for that reason. The third comment on #91 raises this question. (2026-11-23, from the brief of the run)
- The output of the audit is public text, because a retrospective is committed in this public repository. The lines that the retro guide asks to paste hold only step names, verdicts, times and the kind of proof, never a path or the content of a session. The test of the ticket that checks this stays. (2026-11-23, from the brief of the run)
- The coordinator runs #92 at the same time, in a private sandbox, with the audit as it is on `main` now. #92 changes no file of this repository. (2026-11-23, from the brief of the run)
- Three more tickets of epic #84 now run at the same time, each in its own worktree. #98 raises the plan format to version 2 in `cstack/src/plan/`, the plan template, the plan fixtures and tests, a new ADR-RQG-B and section 9 of the specification. #99 reads a test report per case in `cstack/src/settings.ts`, `cstack/src/test-run.ts`, a new module and a new paragraph of `README.md`. #114 makes `cstack publish` refuse while a unit is not done, in `cstack/src/commands/publish.ts`, `cstack/src/phases.ts`, the publish guide and the `cstack publish` paragraph of `README.md`. None of them changes `retro.md`, the retrospective template, the audit code or ADR-RQG-C. (2026-11-23, from the coordinator of the wave)
- In `README.md` and `cstack/src/manifest.ts`, change only the paragraph and the entry of `cstack audit`, because other tickets of the wave change other parts of these files. This ticket reads `cstack/src/phases.ts` and `cstack/src/run-progress.ts` but does not change them, because #114 changes `phases.ts`. (2026-11-23, from the coordinator of the wave)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- This run follows the guides of the installed `cstack` 0.3.2, which do not ask for the audit yet. Before the pull request opens, the main conversation may try the audit of this branch on this run, with `npm run build` in `cstack/` and then `node cstack/dist/bin.js audit <plan file>`. It tells the user what the audit printed. Nobody reads the session folders of other runs. (2026-11-23, from the brief of the run)
- Write the plan file path literally in every `cstack` command of this run, never as a shell variable such as `$P`. The audit cannot read a file name from a variable, so it would print a false "skipped". (2026-11-23, from the retrospective of #90, `docs/retros/2026-11-23-90.md`)
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
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, and push with a plain `git push`, without force. (2026-11-23, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-23, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-23, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-23, from the brief of the run)
- `cstack audit` leaves out every line of the phases that are not over yet. These phases are the first phase, in the order of `PHASES` (`cstack/src/phases.ts`, line 95), that `isDone()` (`cstack/src/run-progress.ts`, line 12) says is not done, and every phase after it. A finished run, where every phase is done, is audited exactly as today. (2026-11-23, the user's answer in the question round)
- When at least one phase is left out, the audit prints exactly one sentence on standard error: `cstack audit: these phases are not over yet, so their lines are left out: retro, publish.` The names are the phases that are left out, in the order of `PHASES`, separated by ", ". The sentence uses the same words for one phase or for several. It holds no path. (2026-11-23, decided in the plan)
- The sentence about the phases that are not over comes on standard error before the two warnings that exist today, the one about unreadable session files and the one about the missing close of the ticket phase (`cstack/src/commands/audit.ts`, lines 136 to 140). (2026-11-23, decided in the plan)
- The audit filters the lines in `cstack/src/commands/audit.ts`, after `evaluatePhases()` and `evaluateSteps()` have computed them. Both functions get the same inputs as today, so `evaluateSteps()` still receives every phase line. Do not change `cstack/src/audit/evaluate.ts`: six of its last ten commits fix its time windows. Filtering after the evaluation is safe, because the phases are evaluated in the order of `PHASES` and a call serves one line only (`evaluate.ts`, line 228), so a later phase never takes a call away from an earlier one. (2026-11-23, accepted by default in the question round)
- A line belongs to the phase `<name>` when its text is `phase <name>` or `phase <name> started`, or when its text starts with `<name>: `. This covers the phase lines, the start lines, the step lines and the helper lines (`evaluate.ts`, lines 47, 48, 51 and 242). The match uses the colon and the space, so `review: ` never matches a line of `independent-review`. (2026-11-23, decided in the plan)
- The exit code of the audit looks only at the printed lines. It is 1 when a session file cannot be read, when no session file holds the close of the ticket phase, or when a printed line is not done. Otherwise it is 0. So a run audited inside its retro phase exits with 0 when every printed line is done. (2026-11-23, the user's answer in the question round)
- Do not change `cstack/src/phases.ts` or `cstack/src/run-progress.ts`. Import `PHASES` and `isDone()` from them, as `evaluate.ts` already does (lines 6 and 9). (2026-11-23, decided in the plan)
- The `cstack audit` entry of `cstack/src/manifest.ts` (line 78) keeps its usage, its summary, its flags, its file and its ticket. The text of exit code 0 becomes "Every phase that is over, with its required commands and helper checks, was done.". The text of exit code 1 starts with "A phase that is over, one of its commands or one of its helper checks was skipped or done out of order," and keeps the rest. (2026-11-23, decided in the plan)
- The existing case "prints retro as skipped when it was done before ready" of `cstack/test/audit.test.ts` (line 360) changes. Its run now leaves out retro and publish, so it expects no line of retro or publish and the sentence about the phases that are not over. (2026-11-23, decided in the plan)
- The retro guide runs `cstack audit <plan file>` before the retrospective is written. Its block holds the step `command: cstack audit <plan file>` before `action: write-retrospective`, as the first comment on #91 asks. (2026-11-23, from the ticket and its first comment)
- The retro guide relies on the lines that the audit printed on standard output, never on its exit code. Exit code 1 can also mean that another version of `cstack` wrote the run, and then the audit prints no line (`cstack/src/commands/audit.ts`, lines 75 to 78). The retrospective goes on in every case, because the specification rejects an audit that stops a run (`docs/projects/refocus-and-quality-guards.md`, section 10). (2026-11-23, accepted by default in the question round)
- The `## Steps` section of the retrospective holds every line that the audit printed, as printed, inside a fenced code block that opens with three backticks and the word `text`. Outside a code block, GitHub reads `<plan file>` and `<helper id>` as HTML tags and hides them. (2026-11-23, accepted by default in the question round)
- When the audit printed no line on standard output, `## Steps` holds one plain sentence that says the audit printed no line, and why, with no path. (2026-11-23, accepted by default in the question round)
- The retrospective copies a sentence that the audit printed on standard error under the code block of `## Steps`, as printed, only when it starts with `cstack audit: `. Every such sentence is fixed and holds no path. Any other text on standard error, such as a stack trace, can hold a path, so the retrospective then says only that the audit stopped with an unexpected error. (2026-11-23, decided in the plan)
- Each line of `## Steps` that says `skipped` or `out of order` also gives one item under `## Improve`. The item names the phase and the step. It says what the run did instead when the plan file or the git log shows it, and it ends with one tag, as every item does. The code block of `## Steps` and these items do not count toward the fifteen lines of prose. (2026-11-23, accepted by default in the question round)
- The retro guide names five sources for the retrospective. The fifth is the output of `cstack audit`. Its line 15 says "Use four sources and no other" today, so that sentence changes. (2026-11-23, decided in the plan)
- The retrospective template gets a `## Steps` section between its header lines and `## Protect`. The closing comment of the template says that the code block of `## Steps` and the items that come from its lines do not count toward the fifteen lines of prose. (2026-11-23, from the ticket)
- The tests of the retro guide go in a new file, `cstack/test/guides/retro-guide.test.ts`. The tests of the retrospective template go in a new file, `cstack/test/retro-template.test.ts`. #98 changes `cstack/test/template.test.ts` at the same time, so this ticket does not touch that file. (2026-11-23, decided in the plan)
- The end-to-end test runs `cstack audit <plan file> --home <folder>` in its retro phase, through `follow()`, so the retro guide must name `cstack audit <plan file>`. `written()` removes `--home` and its value before it compares the command with the guide. (2026-11-23, accepted by default in the question round)
- The end-to-end test writes a session file for the audit. `run()` records each call with its time. The session file has one `assistant` line per call, with the project folder as `cwd`, the time of the call as `timestamp`, and a `tool_use` item named `Bash` whose command is `cstack` followed by the arguments, as `findRunFiles()` and `readCalls()` read them (`cstack/src/measure/sessions.ts`, line 69, and `cstack/src/audit/calls.ts`, line 10). An argument that holds a space or a quote is quoted, so that `cstackCommands()` reads it back as one word. The file lives under `<folder>/.claude/projects/` in a folder of its own inside the temporary folder of the test, never in the home folder of the run. The case "never touched the home folder" stays as it is. (2026-11-23, accepted by default in the question round)
- The end-to-end test first checks that the audit printed lines, for example a line that starts with `phase ticket: done`. Only then does it check that no line holds a path. Without the first check, a refusal such as "no session file of this run was found" prints nothing, and the second check passes without proving anything. (2026-11-23, accepted by default in the question round)
- The end-to-end test writes the printed lines into the `## Steps` code block of its retrospective, as the guide asks, and commits it. It checks that the committed retrospective holds no path of the test: not the temporary folder, not the project folder, not the folder of the session file and not the home folder of the run. (2026-11-23, decided in the plan)
- A run that stops for good never shows the steps of its last phase, because that phase never closes. The sentence on standard error makes the gap visible. The README and ADR-RQG-C say so. (2026-11-23, accepted by default in the question round)
- Do not change the call `readPlan(planText)` in `cstack/src/commands/audit.ts` (line 54). #98 changes that one line so that the audit keeps reading a version 1 plan. If #98 merges first, the update-branch phase takes its line and keeps the changes of both sides. (2026-11-23, from the coordinator)
- No security surface: the change reads local files only and opens no endpoint. The output of the audit stays public text, with step names, verdicts, times and the kind of proof only. (2026-11-23, decided in the plan)

## Architecture

The approach is locked by the question round, so no blueprint was drawn. The audit command filters its lines after it computes them, the retro guide runs it and pastes its lines, and the template gets a `## Steps` section. No new decision since the question round.

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

### Unit 1: Leave out the phases that are not over in cstack audit
- Files: `cstack/src/commands/audit.ts`, `cstack/src/manifest.ts`, `cstack/test/audit.test.ts`
- Test: `cstack/test/audit.test.ts`: in a run where every phase up to `ready` is done and retro and publish have no done time, no line starts with `phase retro`, `retro: `, `phase publish` or `publish: `, and `phase ready: done` is still printed; in the same run with a `cstack helper wait` call of the main conversation after the close of `ready`, no line `retro: cstack helper wait <helper id>` is printed; the same run with every other line done exits with 0; the same run prints exactly `cstack audit: these phases are not over yet, so their lines are left out: retro, publish.` as its whole standard error; a run where the plan phase is done and the build phase has no done time prints no line of build or of any later phase, still prints `phase plan: done`, and its sentence names `build, review, independent-review, update-branch, document, briefing, after-build-questions, ready, retro, publish`; a run whose retro was done before `ready` leaves out retro and publish and names them in the sentence, which replaces the expectation of the existing case "prints retro as skipped when it was done before ready"; a run where only publish has no done time leaves out only publish, and its sentence ends with `left out: publish.`; a finished run still prints `phase retro: done` and `phase publish: done` and prints no sentence about the phases that are not over; a run inside the retro phase where a session file cannot be read prints the sentence about the phases that are not over first and the sentence about unreadable files second; the check "nothing private leaves the command" also runs on a run inside the retro phase, and its standard error holds no path.
- Minimum code: In `audit()`, after `evaluateSteps()`, find the first phase of `PHASES` that `isDone()` says is not done. Keep only the lines that belong to an earlier phase, as `## Decisions` defines it. Print the kept lines. Print the sentence about the phases that are not over when at least one phase is left out, before the two existing warnings. Compute the exit code from the kept lines. Change the texts of exit codes 0 and 1 of the `cstack audit` entry of `cstack/src/manifest.ts` as `## Decisions` says.
- Refactor: None.
- Commit message: feat(cli): leave out the phases that are not over in cstack audit
- Depends on: none

Each case of the `Test` line is its own `it()`, so each one can fail first. A case that checks that a line is absent also checks a line that is present, in the same `it()`. Build the runs with `fullPhases()` and delete or move the done times of the phases that the case needs. The full-run case "prints every command line as done for a full run" (line 464) must stay green. The negative rule to break on purpose is the filter itself: comment it out, and the cases that expect a line to be absent must fail.

### Unit 2: Run the audit in the retro guide
- Files: `cstack/guides/resolve-issue/retro.md`, `cstack/test/guides/retro-guide.test.ts`
- Test: `cstack/test/guides/retro-guide.test.ts`: the block of the retro guide, read with `readSteps()`, holds the command step `cstack audit <plan file>`; that step comes before the action step `write-retrospective`; the prose of the retro guide, without its block, names `cstack audit <plan file>`; the prose names the section `## Steps`; the prose asks for a code block that opens with three backticks and the word `text`.
- Minimum code: Add `command: cstack audit <plan file>` to the block of `cstack/guides/resolve-issue/retro.md`, as its first step. Add a section "Run the audit" before "Write the retrospective". It says to run `cstack audit <plan file>`. It says that the audit leaves out retro and publish at this point, because they are not over. It says to paste every line of standard output into `## Steps`, inside a code block that opens with three backticks and the word `text`. It says what to write when no line came out, which sentences of standard error to copy under the block, and that the run goes on whatever the exit code, as `## Decisions` says. In "Write the retrospective", change "four sources" to five, with the output of the audit as the fifth. Add the rule of one `## Improve` item for each line that is skipped or out of order. Say that the code block and these items do not count toward the fifteen lines of prose.
- Refactor: None.
- Commit message: feat(skill): run cstack audit in the retro phase and paste its lines
- Depends on: none

Each case is its own `it()`. Read the guide from `cstack/guides/resolve-issue/retro.md` and import `readSteps()` and `withoutBlock()` from `cstack/src/guide-steps.ts`. `cstack/test/manifest.test.ts` and `cstack/test/guides/steps-blocks.test.ts` must pass unchanged. Write the prose as the documentation rules of this repository ask: one idea per sentence, short sentences, plain words.

### Unit 3: Add a Steps section to the retrospective template
- Files: `cstack/skills/resolve-issue/templates/retro.md`, `cstack/test/retro-template.test.ts`
- Test: `cstack/test/retro-template.test.ts`: the level-2 headings of the template are `Steps`, `Protect`, `Improve` and `Trap hit`, in this order; `## Steps` comes after the three header lines `Date`, `Plan file` and `Outcome`; the `## Steps` section holds a code block that opens with three backticks and the word `text`; the closing comment says that the code block of `## Steps` does not count toward the fifteen lines of prose.
- Minimum code: Add `## Steps` between the header lines and `## Protect`, with a placeholder code block that says the lines of `cstack audit` go there, as printed. Add a placeholder sentence for a run where the audit printed no line. Change the closing comment as `## Decisions` says.
- Refactor: None.
- Commit message: feat(skill): add a Steps section to the retrospective template
- Depends on: none

Each case is its own `it()`. Do not change `cstack/test/template.test.ts`, because #98 changes it at the same time.

### Unit 4: Run the audit in the retro phase of the end-to-end test
- Files: `cstack/test/e2e/resolve-issue.test.ts`, `cstack/test/fixtures/e2e/retro.md`
- Test: `cstack/test/e2e/resolve-issue.test.ts`: in the retro case, `cstack audit <plan file> --home <folder>` runs through `follow()` with the retro guide; its standard output holds a line that starts with `phase ticket: done`; every line of its standard output is a phase line, a start line, a step line or a helper line, with a verdict, and with a time and a record when the verdict is not `skipped`; no line starts with `phase retro`, `retro: `, `phase publish` or `publish: `; its standard error holds the sentence about the phases that are not over, naming retro and publish, and every line of standard error starts with `cstack audit: `; neither output holds the temporary folder, the project folder, the folder of the session file or the home folder of the run; the committed retrospective holds the printed lines inside the `## Steps` code block and holds none of these paths.
- Minimum code: `run()` records each call with its time. Before the audit, the test writes these calls into one session file, as `## Decisions` says. `written()` removes `--home` and its value. The test fills the `## Steps` code block of the retrospective with the printed lines before it commits the retrospective. Give the fixture `cstack/test/fixtures/e2e/retro.md` a `## Steps` section with a code block that holds one placeholder line, which the test replaces.
- Refactor: None.
- Commit message: test(cli): run cstack audit in the retro phase of the end-to-end test
- Depends on: 1, 2, 3

The case "never touched the home folder" must stay green, so the session file lives in a folder of its own. `cstack/test/fixtures-public.test.ts` must pass, so the fixture and the test hold no home path, no email and no private host. Only the sample names `user`, `someone` or `runner` appear in new test data.

### Unit 5: Describe the phases that are not over in the README
- Files: `README.md`
- No test: this unit changes only the `cstack audit` paragraph of the README.
- Minimum code: In the `cstack audit` paragraph (`README.md`, line 54), say that the audit prints lines only for the phases that are over. Say which phases are not over, that one sentence on standard error names them, and that a run audited inside its retro phase leaves out retro and publish. Say that the exit code looks only at the printed lines, so "The audit exits with 0 when every line is done" becomes true of the printed lines. Add to its limits that a run that stops for good never shows the steps of its last phase. Change no other paragraph of `README.md`, because other tickets of the wave change other parts of it.
- Refactor: None.
- Commit message: docs: describe the phases that are not over in the cstack audit paragraph of the README
- Depends on: 1

Write it as the documentation rules of this repository ask: one idea per sentence, short sentences, plain words.

## Documentation duties

- The `cstack audit` paragraph of `README.md`: applies, written by unit 5.
- The `cstack audit` entry of `cstack/src/manifest.ts`: applies, written by unit 1.
- The retro guide `cstack/guides/resolve-issue/retro.md` and the retrospective template `cstack/skills/resolve-issue/templates/retro.md`: applies, written by units 2 and 3.
- ADR-RQG-C (`docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`): applies, a short section added in the document phase. It records that the audit leaves out the phases that are not over, why the filter comes after the evaluation, and that a run that stops for good never shows the steps of its last phase. It changes none of the decisions of the record.
- The comment on this ticket, #91: applies, written in the document phase. It says what the retro phase now does with the audit, and that the audit leaves out the phases that are not over.
- The comments on dependent tickets: does not apply, because the ticket says "Feeds: none".
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply. Its acceptance criteria do not change.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: The steps of a phase that is still running

The retro phase runs `cstack audit` before the retro phase and the publish phase are over. Today the audit prints `phase retro: skipped` and `phase publish: skipped`, so it exits with 1, and a step of the retro phase can show a false "done". In the run of #112, `retro: cstack helper wait <helper id>` showed "done" with the time of the plan phase's wait. How should the audit treat the phases that are not over yet? The options are these. First, `cstack audit` leaves out every line of the phases that are not over: the first phase that the run state says is not done, and every phase after it. It prints one fixed sentence on standard error that names those phases, and its exit code looks only at the lines it printed. A finished run is audited as today. Second, the audit prints those lines with a new verdict, "not checked yet", which the exit code ignores. Third, the audit does not change, and the retro guide asks to remove the lines of the retro and publish phases by hand before pasting. The recommendation is the first option.
- For: the user
- Answer: the first option. `cstack audit` leaves out every line of the phases that are not over yet, prints one fixed sentence on standard error that names them, and its exit code looks only at the printed lines. Source: the user, in the conversation of this run, on 2026-11-23.

## Review log

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

<phase plan: the non-blocking questions of the question round that stay open. Phase after-build-questions: the questions raised by the reviews or the briefing that do not stop the pull request. Each one word for word, with who it is for, or "none". They go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them.>

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

- 2026-11-23, executor run 1: moved the ticket #91 to "in progress" with `cstack tracker move`. The branch `gambitl/audit-in-retro` was already checked out. The build starts now.

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**During the retrospective, `cstack audit` leaves out the phases that are not over yet.** When the retrospective is written, the retro and publish phases are not closed. Today the audit prints them as "skipped" and exits with 1. A step of the retro phase can also show a false "done", as it did in #112. I recommend that the audit leaves out the first phase that the run state does not mark as done, and every phase after it, with one fixed sentence on standard error that names them. A finished run is audited exactly as today. This adds code to a ticket that was only prose, but the audit is in no released version (0.3.2 does not have it), so changing its output breaks nobody. A new verdict "not checked yet" would change the line format that the digest will read, and a sorting by hand before the paste is fragile.

**I will do this unless you say no.**

- I filter the lines in `cstack/src/commands/audit.ts`, after they are computed, and I do not touch the time windows of `cstack/src/audit/evaluate.ts`. Six of its last ten commits fix those windows. I also update the README paragraph and ADR-RQG-C, which say today that the audit prints one line per phase. (Accepted by default, 2026-11-23.)
- The guide relies on the printed lines, never on the exit code. Exit code 1 also means "another version of cstack wrote this run", and then no line comes out. Without a line, `## Steps` gets one sentence that says why, and the retrospective goes on in every case. (Accepted by default, 2026-11-23.)
- The end-to-end test first checks that the audit printed lines, then that none holds a path. Without a session file, the audit refuses with 3 and prints nothing, so a "no path" check alone would pass without proving anything. The test writes its session file in a separate folder given with `--home`, and `--home` joins the flags that the test removes before it compares a command with the guide. (Accepted by default, 2026-11-23.)
- `## Steps` keeps every line, inside a code block, because GitHub hides `<plan file>` as an HTML tag. Each "skipped" or "out of order" line also gives an item under `## Improve`, outside the fifteen-line limit. A warning of the audit is copied under the block as printed. (Accepted by default, 2026-11-23.)

**Good to know.**

- A run that stops for good will never show the steps of its last phase, because that phase never closes. This is the price of the option I recommend.

#### Details

The audit and the phases that are still running. This point is blocking, and only the user can answer it, because it decides whether the ticket changes code. `evaluatePhases()` (`cstack/src/audit/evaluate.ts`, line 39) prints a phase as skipped when the run state has no done time for it, and `audit()` exits with 1 when any line is not done (`cstack/src/commands/audit.ts`, line 141). The window of a phase ends at the next close of a later phase that runs in the same place (`evaluate.ts`, line 234). The retro phase runs in the main conversation and publish runs in the executor, so the retro window never has an end, even after a finished run. While retro runs, a call of the plan phase made after the close of `ready` can then serve a retro step, which is what `docs/retros/2026-11-23-112.md` records. I keep the recommendation of the question round: leave out the first phase in the order of `PHASES` that `isDone()` (`cstack/src/run-progress.ts`, line 12) says is not done, and every phase after it. `isDone()` already treats a retro done before `ready` as not done, so a resumed run is handled. `cstack audit` is not in `v0.3.2`: `git show v0.3.2:cstack/src/manifest.ts` has no audit entry. So the change of output is reversible and touches no user. I reject a fourth verdict, because the second comment on #91 calls the line format an interface that `digest-retros` will read. I also reject a removal by hand in the guide. It breaks item 2 of the scope ("the audit lines as the command printed them"), and it depends on an agent that copies seventy lines correctly. If nobody decides, the ticket can only paste the output as it is, with exit code 1 on every run and the false "done" of #112. The plan needs five test cases. A finished run gives the same lines and exit code as today. A run inside retro leaves out retro and publish, and it exits with 0 when every other line is done. A run stopped inside build leaves out build and every later phase. A retro done before `ready` counts as not done. The sentence on standard error holds no path.

Where to implement it. This is non-blocking, and I will do it unless the user objects. The lines carry no phase field today (`Line` in `evaluate.ts`, line 17), so the filter needs either a phase on each line or a match on the `phase <name>` and `<name>:` prefixes. Filtering after the evaluation is safe, because the phases are evaluated in the order of `PHASES` and a call serves one line only (line 229): calls taken by retro and publish can never take a call away from an earlier phase. Changing the windows instead would touch the code where six of the last ten commits are fixes (`git log --oneline -n 10 -- cstack/src/audit/evaluate.ts`). The README paragraph (`README.md`, line 54) says the audit "prints one line for each phase" and "exits with 0 when every line is done", and ADR-RQG-C describes the lines and the exit code (lines 84 to 92). Both need a sentence about the phases that are not over. If this is left out, the README and the ADR become false after the merge.

The exit code is not a signal for the guide. This is non-blocking. `audit()` exits with 1 and prints no line when the run state was written by another cstack version and no `--guides` is given (`audit.ts`, lines 75 to 78). `writtenBy` is set once in `createRun()` (`cstack/src/run-state.ts`, line 167) and never updated, so a cstack upgrade in the middle of a run produces this case. Exit code 3 also prints no line. So the retro guide decides on whether standard output holds lines, not on the exit code. This merges with item 4 of the question round: without lines, `## Steps` holds one plain sentence with the reason and no path, and the run goes on, as section 10 of the specification requires.

The end-to-end test must not pass on an empty output. This is non-blocking. `findRunFiles()` (`cstack/src/measure/sessions.ts`, line 69) reads `<home>/.claude/projects/`, and the case at line 467 of `cstack/test/e2e/resolve-issue.test.ts` forbids a `.claude` folder in the test home. So the test writes a session file, built from the calls that `run()` recorded with their times, under another folder, and passes `--home <that folder>`. `follow()` compares the command with the guide through `written()`, which removes only the flags of `EXTRA_FLAGS` (line 23), so `--home` and its value must join that list. The case asserts that at least one known line, such as `phase ticket: done`, is printed before it asserts that no line holds a path. Without that first assertion, a refusal with "no session file of this run was found" would satisfy the acceptance criterion while proving nothing.

The shape of `## Steps` and the items under `## Improve`. These are items 2, 3, 5 and 6 of the question round, all non-blocking, and I keep their recommendations. Every line is kept, inside a fenced code block, because `<plan file>` and `<helper id>` are read as HTML tags outside one. Each "skipped" or "out of order" line gives one `## Improve` item that names the phase and the step and ends with a tag. These items do not count toward the fifteen lines of prose (`cstack/guides/resolve-issue/retro.md`, line 21, and the comment at line 19 of the template). Line 15 of the guide ("Use four sources and no other") changes to five sources. The `digest-retros` skill is frozen (`skills/digest-retros/SKILL.md`, line 28) and reads only "Improve" and "Protect", so the items under `## Improve` are what it acts on.

A run that stops for good. With the recommended option, a run abandoned in the build phase never shows the build steps, because the build phase never closes. Its lines would be unreliable anyway, since that window has no end either. I accept this trade-off, and the stderr sentence makes the gap visible.

Locked decisions I did not reopen: ADR-RQG-C on the blocks of mandatory steps, the rule that `action` steps are never printed and that a call serves one line, and the rejection of an audit that stops a run (`docs/projects/refocus-and-quality-guards.md`, section 10). I checked security, data model lock-in, scale, operations and cost, and hidden coupling beyond the README, the ADR and `digest-retros`, and found nothing more in them for this ticket.

### Open questions and answers

1. Blocking question 1, the steps of a phase that is still running. Recommended answer: `cstack audit` leaves out every line of the phases that are not over yet, which are the first phase that `isDone()` says is not done (`cstack/src/run-progress.ts`, line 12) and every phase after it. It prints one fixed sentence on standard error, and its exit code looks only at the printed lines. This keeps the three verdicts that `digest-retros` will read, and a finished run is audited exactly as today. A new verdict would change the format of a line, which the second comment on #91 calls an interface. A removal by hand would break "the audit lines as the command printed them" of item 2 of the scope, and an agent can get it wrong. Answer: the user chose the recommended answer on 2026-11-23.
2. Non-blocking. Does `## Steps` hold every line that the audit printed, or only the lines that are not done? Item 2 of the scope says "the audit lines as the command printed them". A run with five units gives about seventy lines once the retro and publish phases are left out. Recommended answer: every line, as the ticket says. The lines that are done tell a step that was done from a step that did not apply, and their times show where the run spent its time. The lines that are not done also become items under `## Improve`, so the digest finds them first. Accepted by default on 2026-11-23.
3. Non-blocking, an assumption not asked. The lines go inside a fenced code block. Outside a code block, GitHub would read `<plan file>` and `<helper id>` as HTML tags and hide them. Accepted by default on 2026-11-23.
4. Non-blocking, an assumption not asked. When the audit prints no line at all, for example because it found no session file or the plan was never approved, `## Steps` holds one plain sentence that says the audit could not run and why, with no path. The run goes on in every case, whatever the exit code, because the specification rejected an audit that stops a run (`docs/projects/refocus-and-quality-guards.md`, section 10). Accepted by default on 2026-11-23.
5. Non-blocking, an assumption not asked. When the audit also prints a warning on standard error, the retrospective copies that sentence under the block, as the audit printed it. Every warning is a fixed sentence with no path (`cstack/src/commands/audit.ts`, lines 137 to 140). Accepted by default on 2026-11-23.
6. Non-blocking, an assumption not asked. Each line that is skipped or out of order gives one item under `## Improve`. The item names the phase and the step, says what the run did instead when the plan file or the git log shows it, and ends with one tag, as every item does. These items do not count toward the fifteen lines of prose, because a run with many skipped steps would otherwise break that rule. Accepted by default on 2026-11-23.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. No new decision since the question round.
