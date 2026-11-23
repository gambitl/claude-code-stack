# Plan: #86 — R1-1: Define the block of mandatory steps at the top of a phase guide

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/86
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/mandatory-steps-block
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T12:23:48+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Give each instruction file of `resolve-issue` a short list, written in a fixed format that code can read, of the steps that are mandatory in that phase.

- **What the title means**: A run of `resolve-issue` goes through 15 phases, such as the plan, the build or the review. Each phase has a guide, which is the file of instructions that `cstack guide <phase>` prints. The block is a few lines at the top of that file. It lists the mandatory steps of the phase, in a format that code can read.
- **Why we are doing it**: A new command, `cstack audit`, will say which steps a run did or skipped. To do that, it must know the expected steps. Today they exist only in prose, which code cannot read reliably. A second list written in the code would drift away from the guides.
- **For the user**: The guides stay the only place where the steps are written. Continuous integration (CI), the service that runs the tests on every pull request, catches a block that names a command that does not exist.

**Goal.** This ticket defines the format of the block of mandatory steps, a reader for it, and the CI checks, and it records the choice in ADR-RQG-C. It writes no block for the real guides, because #88 does that.

### Where things are today (read first)

* **Reading a guide**: `cstack/src/commands/guide.ts` → `readGuide()` (line 25) reads `guides/<skill>/<phase>.md`, and `guide()` (line 49) prints it as it is. `cstack/src/commands/next.ts` → `printGuide()` (line 39) prints the run line, the settings block and the guide. No code reads a block or front matter today, and no guide has one.
* **The byte-for-byte test**: `cstack/test/guide.test.ts` (line 27), "prints the guide file byte for byte", will see any new block.
* **The command check**: `cstack/test/manifest.test.ts` → `extractMentions()` (line 17) reads the inline code and the fenced blocks of the skills and the guides. The test "passes on the real skills and guides" (line 71) checks each mention with `matchMention()` (`cstack/src/manifest.ts`, line 320).
* **The phases**: `cstack/src/phases.ts` → `PHASES` (line 95) lists the 15 phases.
* **The helpers that the guides name**: `code-map.md` (line 18) names `resolve-issue:code-explorer`. `questions.md` (line 42), `plan.md` (line 13) and `briefing.md` (line 7) name `resolve-issue:cto-review`. `plan.md` (line 7) names `resolve-issue:code-architect`. `review.md` (lines 17 to 20) names the three code reviewers, and `independent-review.md` (line 15) names `resolve-issue:pr-reviewer`. Their prompts live in `cstack/skills/resolve-issue/agents/`.
* **Conditional steps**: some steps apply only in some runs. For example, `code-map.md` (line 18) runs the wider exploration only when the ticket has no file map or the area is large.
* **The specification**: `docs/projects/refocus-and-quality-guards.md`, US-1 (AC6 and AC7) and ADR-RQG-C in section 9.

### Scope

1. Define the format of the block. It sits at the top of a phase guide and lists the mandatory steps of the phase, in order.
2. Each step has one of three kinds. The first kind is a `cstack` command, with placeholders such as `<n>` for a unit. The second kind is a check that a named helper makes, such as `resolve-issue:cto-review` at the moment `before-plan`. The third kind is another required action, written in a short fixed form.
3. A step can carry a condition that says when it applies. Examples are "for each unit", "when the ticket has a negative criterion", or "when the ticket has no file map". Define the small fixed list of conditions that the 15 guides need. #90 evaluates them.
4. Choose a form that renders as nothing in a markdown viewer, for example an HTML comment.
5. Make `cstack guide` and `cstack next` print the guide without its block. The prose already says the steps, so printing the block would only cost tokens.
6. Write a reader in `cstack/src/` that returns the ordered steps of a guide. It refuses a malformed block and names the guide and the line.
7. Extend the CI check. A block that names a command that does not exist fails it. A block that names a helper without a prompt in `cstack/skills/resolve-issue/agents/` fails it too.
8. Add one fixture guide with a block under `cstack/test/fixtures/`, for #89 and #90 to test against.
9. Write ADR-RQG-C in `docs/decisions/`. It gives the options (a list in the code, a reading of the prose, a block in each guide), the choice and its reasons. Link it from section 9 of the specification.

### Acceptance (TDD)

* A new test file for the reader: write first a case where the fixture guide's block becomes its ordered steps, with their kinds and conditions. See it fail on today's code, then pass.
* The same file: a block with an unknown kind, an unknown condition or a malformed line is refused, and the message names the guide and the line.
* `cstack/test/manifest.test.ts`: a block that names a command that does not exist fails the check. A block that names a helper without a prompt fails it too.
* `cstack/test/guide.test.ts`: `cstack guide <phase>` prints the fixture guide without its block. A guide without a block still prints byte for byte.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none · Feeds: #88, #89

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

## Dependencies

clear

## Code mapping

The ticket's file map was accurate, so no wider exploration was needed. Every line number below was checked on `main` at commit `efa61d5`.

**Entry points.**

- `cstack/src/commands/guide.ts`, `readGuide()` (line 25), reads `guides/<skill>/<phase>.md` and returns `{ ok: true, text }` with the raw file text (line 46). `guide()` (line 49) prints `result.text` as it is (line 73). `cstack/src/commands/next.ts`, `printGuide()` (line 39), calls the same `readGuide()` (line 40) and prints `guide.text` (line 47). So a change inside `readGuide()`, or one small function that both callers use, covers `cstack guide` and `cstack next` together.
- `readGuide()` has three unit tests in `cstack/test/guide.test.ts`. The case "returns the exact bytes of the guide file" (line 98) writes a guide with `\r\n` and a non-ASCII letter and expects the same bytes back. A guide without a block must keep passing it.
- `cstack/test/guide.test.ts`, "prints the guide file byte for byte" (line 27), runs `cstack guide hello --skill cstack-example` and compares the output with `cstack/guides/cstack-example/hello.md`. That guide has no block today.
- `cstack/test/manifest.test.ts`, `extractMentions()` (line 17), only reads inline code spans and fenced blocks. Text inside an HTML comment that is not inside backticks is never scanned. So today a block in an HTML comment would escape the command check completely. `scan()` (line 52) walks folders and calls `matchMention()` (`cstack/src/manifest.ts`, line 320) on each mention.
- The case "reports the file and the line of a command that is not in the list" (`cstack/test/manifest.test.ts`, line 63) scans the whole folder `cstack/test/fixtures/manifest/` and expects exactly one failure, from `guides/example/frobnicate.md` line 5. A new failing fixture in that folder would change that count. So the new negative fixtures for the block check go in a folder of their own.
- `matchMention()` (`cstack/src/manifest.ts`, lines 320 to 343) takes the words before the first token that starts with `-`. It already accepts placeholders such as `<n>` and `<plan file>`, because the guides use them in backticks today, for example `cstack unit red <n>`. It refuses an unknown command and an unknown flag.
- The helpers that the guides name are written `resolve-issue:<name>`, for example `resolve-issue:cto-review` (`cstack/guides/resolve-issue/questions.md`, line 42). Their prompts are `cstack/skills/resolve-issue/agents/<name>.md`. Ten prompts exist today: `code-architect`, `code-explorer`, `code-reviewer`, `code-reviewer-deep`, `code-reviewer-simplicity`, `cto-review`, `executor`, `implementer`, `implementer-escalation` and `pr-reviewer`.
- `cstack/src/helper/spec.ts`, `findInputs()` (line 66), already builds the path `skills/resolve-issue/agents/<role>.md`. Milestone R2 removes `cstack/src/helper/` (`docs/projects/refocus-and-quality-guards.md`, section 7). So the new reader must not import from it.
- `cstack/src/phases.ts`, `PHASES` (line 95), lists the 15 phases. Their names are the guide file names.
- The CTO advisor has three moments: `before-plan`, `plan-delta` and `after-build` (`cstack/skills/resolve-issue/agents/cto-review.md`, line 19).

**Patterns to follow.**

- A command prints through `io` and returns its exit code. No code calls `process.exit()` (ADR-SIC-H, `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`). The exit codes live in `EXIT` (`cstack/src/manifest.ts`, line 3): `3` means invalid input.
- Errors that name a file and a line already exist for the plan file: `cstack/src/plan/read.ts` (line 616) joins `line <n>: <rule>` messages. The reader's refusals can follow the same shape, with the guide's name in front.
- Guide fixtures live under `cstack/test/fixtures/guides/<case>/` (`extra-guide`, `owned-value`, `planning-missing-questions`). Each existing test scans only its own case folder there (`cstack/test/guides/phases-have-guides.test.ts` line 7, `cstack/test/guides/settings-applied.test.ts` line 53). So a new case folder disturbs none of them.
- `cstack/test/fixtures-public.test.ts` (line 8) scans every file under `cstack/test/fixtures/` for a home folder path, an email address or a private host. A new fixture must pass it.
- `cstack/package.json` ships `dist`, `skills` and `guides` only (lines 6 to 10). Test fixtures are not shipped.

**What the 15 guides need from the conditions.** A read of the guides shows these conditional steps today. `code-map.md` line 18 launches `resolve-issue:code-explorer` only when the ticket has no file map or the area is large. `plan.md` line 7 launches `resolve-issue:code-architect` only when a real architecture choice remains, and line 13 launches `resolve-issue:cto-review` at `plan-delta` only when the plan adds a structural decision. `build.md` line 17 starts one implementer for each unit, and the implementer runs `cstack unit red` and `cstack unit green` only for a unit with a `Test` line (`cstack/skills/resolve-issue/agents/implementer.md`). `build.md` line 28 starts `implementer-escalation` only when a unit is stuck. `build.md` line 38 checks a user interface only when a unit changed one. `independent-review.md` line 15 launches `resolve-issue:pr-reviewer` only when the `review` agent of the settings is `claude`. `update-branch.md` line 9 rebases or merges only when the target branch moved. US-7 of the specification adds a step for each negative criterion of a unit, which milestone R3 builds.

**Risks.**

- `cstack/test/skill-size.test.ts` (line 41) counts the raw words of `cstack/guides/resolve-issue/ticket.md` together with the entry skill. This ticket adds no block to a real guide, so nothing changes now. When #88 adds a block to `ticket.md`, that test will count the block's words too, unless it counts what `cstack guide` prints.
- `cstack/test/e2e/no-orca.test.ts` (line 11) and `cstack/test/e2e/orca.test.ts` (line 11) read the raw guide files and check that a command appears in them (`cstack/test/e2e/chain.ts`, line 207). A block that names the same commands would make those checks pass on the block alone. That matters only once #88 writes real blocks.
- `cstack/src/commands/guide.ts` changed only twice in its history (`git log`), so it is stable. `cstack/test/manifest.test.ts` changes often, mostly to count commands, so a merge conflict there is possible later in this epic.

**Governing decisions.**

- US-1, AC6 of the specification: the expected steps come from a block at the top of each phase guide, a CI test fails when a block names a command that does not exist, and no second list of steps exists in the code.
- US-1, AC5: the audit checks that a helper's check happened, not which helper or model did it. AC7: a step that the plan makes not applicable is not expected.
- The rule for every story (section 4): a change to a phase guide also updates its block.
- `cstack/src/commands/next.ts` line 118 (`WHY:`): the settings are read before any state is written. This ticket does not change that order.
- ADR-RQG-C does not exist yet. This ticket writes it, and section 9 of the specification links to it.

## Decisions

- This wave has one code ticket, #86. The other ready ticket, #87, has no code and changes no file of this repository, so no other branch touches the files of this ticket during this run. (2026-11-23, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-23, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-23, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. A run of ticket #79 did that and started the same unit twice. Read their whole output instead. (2026-11-23, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. (2026-11-23, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-23, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-23, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-23, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-23, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-23, from the coordinator of the wave)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-23, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-23, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-23, from the brief of the run)
- Never read, run or change anything under `~/comparison/` or `~/review-candidates/`, which hold private work data. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-23, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-23, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. A change to `cstack guide` or `cstack next` in this branch does not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-23, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-23, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-23, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file, the ADR and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-23, from the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-23, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit and push with a plain `git push`, without force. (2026-11-23, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-23, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-23, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-23, from the brief of the run)
- This ticket writes no block in a real guide under `cstack/guides/`. #88 writes them. (2026-11-23, from the ticket)
- The block sits at the very top of a phase guide. Line 1 is exactly `<!-- mandatory steps`. Each following line is one step, written `<kind>: <text>`, with an optional ` | <condition>` at its end. The first later line that is exactly `-->` closes the block. Lines are compared after removing one trailing `\r`, and nothing else is trimmed. (2026-11-23, the user's answer)
- A step has one of three kinds. A `command` step's text starts with `cstack ` and keeps the placeholders that the guides use, such as `<n>`, `<plan file>` and `'<key>'`. A `helper` step's text is `<skill>:<name>`, such as `resolve-issue:cto-review`, optionally followed by one space and one word for its moment or its focus, such as `before-plan` or `security`. An `action` step's text is one id, such as `approval-gate`. The skill, the name, the word, the action id and the condition are each kebab-case, which means they match `^[a-z0-9][a-z0-9-]*$`. (2026-11-23, the user's answer)
- The commands of a block are written without backticks. So the existing mention scan (`cstack/test/manifest.test.ts`, `extractMentions()`, line 17) never reads them, and the new check of this ticket is the only check of the blocks. (2026-11-23, the user's answer)
- The fixed list of conditions has seven entries, and no other condition is accepted. `each-unit` repeats the step once for each unit of the plan. `each-unit-with-test` repeats it for each unit that has a `Test` line. `each-stuck-unit` repeats it for each unit that an implementer reported stuck. `each-negative-criterion` repeats it for each negative criterion that a unit covers. `each-dependent-ticket` repeats it for each ticket that the "Feeds" part of the ticket footer names. `user-interface` applies the step once when a unit has a `Design specification` line. `new-structural-decision` applies the step once when the plan does not hold the sentence "No new decision since the question round" (`cstack/guides/resolve-issue/plan.md`, line 13). (2026-11-23, the user's answer)
- In an `each-` step, `<n>` stands for the number of the unit. `each-negative-criterion` needs the plan format that #98 builds, so it matches nothing until then. This ticket only defines the names and their meaning. #90 evaluates them. (2026-11-23, the user's answer)
- The blocks will name no `resolve-issue:code-explorer` and no `resolve-issue:code-architect` step, because US-1 AC4 does not list them and their need is a judgment. The independent review is written with no condition, because AC5 expects it whatever the reviewer. ADR-RQG-C records this rule for #88. (2026-11-23, the user's answer)
- The reader is `readSteps(text: string, name: string)` in a new module, `cstack/src/guide-steps.ts`. It takes the text of a guide and a name for its messages, never a path, so the audit can later read a guide from an older commit. It returns `{ ok: true; steps: Step[] }` or `{ ok: false; message: string }`, in the style of `GuideResult` (`cstack/src/commands/guide.ts`, line 23). (2026-11-23, accepted by default in the question round)
- A step is `{ line, kind: "command", command, condition? }`, `{ line, kind: "helper", helper, word?, condition? }` or `{ line, kind: "action", action, condition? }`. `line` is the line number of the step in the file, counted from 1. `command` holds the text as written, starting with `cstack `. `helper` holds `<skill>:<name>`, and `word` holds the moment or the focus. The module also exports the list of kinds and the list of conditions as constants, and the `Step` and `Condition` types. (2026-11-23, assumption not asked)
- A guide whose line 1 is not the opening line, and whose other lines never start with `<!-- mandatory steps`, has no block, and `readSteps()` returns an empty list of steps. An empty block is refused, because every phase ends with at least `cstack next --done <phase>`. So an empty list always means that the guide has no block. (2026-11-23, accepted by default in the question round)
- `readSteps()` stops at the first problem. Its message is `<name>, line <n>: <rule>`, where `<n>` is the line of the problem in the file. It refuses an unknown kind, an unknown condition, a line with no `: ` after its kind, a blank line inside the block, a line with more than one ` | `, a `command` step that does not start with `cstack `, a `helper` step or an `action` step that is not in its form, a line inside the block that contains `-->` but is not exactly `-->`, a block that never closes (line 1), an empty block (the line of `-->`), and a line that starts with `<!-- mandatory steps` anywhere other than an exact line 1. Each rule says in a full sentence what is wrong and what the right form is. (2026-11-23, accepted by default in the question round)
- `readGuide()` keeps returning the raw file (`cstack/src/commands/guide.ts`, line 46), and its exact-bytes test (`cstack/test/guide.test.ts`, line 98) keeps its meaning. (2026-11-23, accepted by default in the question round)
- `withoutBlock(text: string, name: string)` in `cstack/src/guide-steps.ts` removes the block before a guide is printed. When line 1 is not exactly `<!-- mandatory steps`, it returns the text unchanged. Otherwise it removes line 1 through the first line that is exactly `-->`, and also the next line when that line is empty. It returns the rest of the text byte for byte. It does not check the steps. When no line closes the block, it returns `{ ok: false, message }` with the message `<name>, line 1: the block of mandatory steps never closes. Its last line must be "-->".` (2026-11-23, accepted by default in the question round)
- `guide()` (`cstack/src/commands/guide.ts`, line 49) and `printGuide()` (`cstack/src/commands/next.ts`, line 39) call `withoutBlock()` on the text that `readGuide()` returns, with the name `guides/<skill>/<phase>.md`. When it fails, they print `cstack: <message>` and a newline on standard error, print nothing on standard output, and return 3. `printGuide()` checks this before it prints the run line. (2026-11-23, accepted by default in the question round)
- The entry of `cstack guide` in `cstack/src/manifest.ts` (line 63) gains the exit code 3, "A guide opens a block of mandatory steps that never closes.". The entry of `cstack next` already has 3 (line 95), so it does not change. The usage lines do not change. (2026-11-23, assumption not asked)
- The check of the blocks is `stepProblems(steps: Step[], name: string, skillsRoot: string): string[]` in `cstack/src/guide-steps.ts`. For a `command` step, it calls `matchMention()` (`cstack/src/manifest.ts`, line 320) on the text after `cstack `. For a `helper` step `<skill>:<name>`, it requires the file `<skillsRoot>/<skill>/agents/<name>.md`. When the step has a word, that word must appear in the prompt as a whole word, not inside a longer kebab-case word. Each problem is `<name>, line <n>: <rule>`. A missing prompt names `skills/<skill>/agents/<name>.md`, and a missing word names the word and that prompt. (2026-11-23, decided in the plan: the question round put this check in the test file, but then its test could not fail first)
- `cstack/test/manifest.test.ts` gets a scan next to `scan()` (line 52). It reads each `.md` file under the folders it gets with `readSteps()`, then `stepProblems()`, and returns every refusal and every problem. It runs on the real `cstack/guides/` folder, with `cstack/skills/` as the skills root, and on the fixture guide of this ticket. Both give no problem. Its negative fixtures live in `cstack/test/fixtures/steps-check/`, because the case at line 63 expects exactly one failure from `cstack/test/fixtures/manifest/`. (2026-11-23, accepted by default in the question round)
- A helper's skill and name are kebab-case before any path is built from them, so a block can never make the check read a file outside the skills folder. The reader itself reads no file. (2026-11-23, assumption not asked)
- The fixture guide for #89 and #90 is `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md`, so that the folder `cstack/test/fixtures/steps-block` works as a package root for `guide()`. Its block uses the three kinds and all seven conditions, and only commands that milestone R2 keeps. Its exact block is written under Unit 1. Its prose after the block says in one sentence that it is a test fixture, not a real guide. (2026-11-23, decided in the plan)
- The new test file `cstack/test/guide-steps.test.ts` loads `cstack/src/guide-steps.ts` with a dynamic `import()` inside each case, through one small helper. Before the module exists, each case then fails on its own, as the rule "each new test case fails first" asks. A later unit that adds an export to an existing module may import it statically, because vitest then gives `undefined` to each case. (2026-11-23, decided in the plan)
- No unit adds a test case that already passes before its code exists. A guide without a block already prints byte for byte in `cstack/test/guide.test.ts`, at line 27 for `cstack guide` and at line 98 for `readGuide()`, so those cases cover that criterion of the ticket. (2026-11-23, decided in the plan)
- ADR-RQG-C lives in `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, with the title "ADR-RQG-C: How the audit knows the expected steps". It follows the sections of the other ADRs: Status, Ticket, Context, Options, Decision and Consequences. Its options are a list in the code, a reading of the prose of the guides, and a block in each guide. It records the format, the three kinds, the seven conditions with their meaning, the rule that blocks name no code explorer and no code architect, and why the printed guide leaves the block out. Section 9 of `docs/projects/refocus-and-quality-guards.md` (line 295) links to it. (2026-11-23, from the ticket)
- `README.md` says in the paragraphs of `cstack guide` (line 52) and `cstack next` (line 54) that they leave out the block of mandatory steps at the top of a guide. It says that `cstack guide` exits with code 3 when that block never closes. The rest of those paragraphs does not change. (2026-11-23, decided in the plan)
- In the document phase, the comment for #88 names four tests that read the raw guides and will see its blocks. They are `cstack/test/skill-size.test.ts` (line 41), the end-to-end checks of `cstack/test/e2e/chain.ts` (line 207), `cstack/test/guides/settings-applied.test.ts`, and the "git push" rule of `cstack/test/prompts.test.ts` (line 101). The comment for #89 says that the reader takes text, so the audit can read the guides of an older commit, and it carries the open question about the guides of runs 3 and 4. (2026-11-23, decided in the plan)

## Architecture

The approach is locked by the ticket and the answers of the question round. One new module, `cstack/src/guide-steps.ts`, reads a block, removes it before a guide is printed, and checks what it names. `cstack guide`, `cstack next` and the CI test call it. No new decision since the question round.

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

### Unit 1: Read the block of mandatory steps

- Files: `cstack/src/guide-steps.ts`, `cstack/test/guide-steps.test.ts`, `cstack/test/fixtures/steps-block/guides/resolve-issue/build.md`
- Test: `cstack/test/guide-steps.test.ts`: `readSteps()` turns the block of the fixture guide into its 13 ordered steps, each with its line, its kind, its text fields and its condition. A guide without a block gives an empty list. A block with `\r\n` line ends gives the same steps. Each refusal named in `## Decisions` (unknown kind, unknown condition, no `: `, blank line, two ` | `, command without `cstack `, malformed helper, malformed action, `-->` inside a step, block that never closes, empty block, opening line after line 1) returns `ok: false`, and its message holds the guide's name and the right line, such as `build.md, line 4:`.
- Minimum code: `readSteps()`, the `Step` and `Condition` types, and the constant lists of kinds and conditions in `cstack/src/guide-steps.ts`, as `## Decisions` describes them.
- Refactor: none planned.
- Commit message: feat(cli): read the block of mandatory steps at the top of a phase guide
- Depends on: none

The fixture guide is exactly this text, with one empty line after `-->`:

```
<!-- mandatory steps
command: cstack tracker move '<key>' --to "in progress" --tracker <name>
command: cstack unit order --plan <plan file>
helper: resolve-issue:implementer | each-unit
command: cstack unit red <n> | each-unit-with-test
command: cstack unit green <n> | each-unit-with-test
action: break-the-rule | each-negative-criterion
command: cstack unit commit <n> | each-unit
helper: resolve-issue:implementer-escalation | each-stuck-unit
action: check-the-user-interface | user-interface
helper: resolve-issue:cto-review plan-delta | new-structural-decision
helper: resolve-issue:code-reviewer-deep security
command: cstack tracker comment '<key>' --body-file <file> --tracker <name> | each-dependent-ticket
command: cstack next --done build --plan <plan file>
-->

# Phase `build`: a fixture guide with a block of mandatory steps

This file is a test fixture, not a real guide. Tests read its block of mandatory steps.
```

The test loads the module with a dynamic `import()` inside each case, as `## Decisions` says.

### Unit 2: Print a guide without its block

- Files: `cstack/src/guide-steps.ts`, `cstack/src/commands/guide.ts`, `cstack/src/commands/next.ts`, `cstack/src/manifest.ts`, `cstack/test/guide.test.ts`, `cstack/test/next.test.ts`
- Test: `cstack/test/guide.test.ts`: `guide(["build"], io, { packageRoot })`, with the package root `cstack/test/fixtures/steps-block`, prints exactly the fixture text that follows the `-->` line and the empty line after it, and exits with 0. A guide in a temporary package root whose line 1 opens a block that never closes makes `guide()` exit with 3, print nothing on standard output, and name `guides/resolve-issue/<phase>.md` and `line 1` on standard error. `cstack/test/next.test.ts`: in a fresh repository, `next()` with a temporary package root whose `ticket.md` has a block prints the run line, the settings and the guide without the block. With a `ticket.md` whose block never closes, `next()` exits with 3, prints nothing on standard output, and names the guide on standard error.
- Minimum code: `withoutBlock()` in `cstack/src/guide-steps.ts`. `guide()` and `printGuide()` call it after `readGuide()`. The `cstack guide` entry of `cstack/src/manifest.ts` gains the exit code 3.
- Refactor: none planned.
- Commit message: feat(cli): leave the block of mandatory steps out of cstack guide and cstack next
- Depends on: 1

### Unit 3: Check the commands and helpers that a block names

- Files: `cstack/src/guide-steps.ts`, `cstack/test/manifest.test.ts`, `cstack/test/fixtures/steps-check/guides/example/broken-steps.md`
- Test: `cstack/test/manifest.test.ts`: a new `describe` block. The scan of `cstack/test/fixtures/steps-check` reports exactly three problems, each with `broken-steps.md` and its line: `cstack frobnicate` at line 3 is not a command, `resolve-issue:no-such-helper` at line 4 has no prompt, and the word `befor-plan` at line 5 is not in the prompt of `resolve-issue:cto-review`. The scan of the real `cstack/guides/` folder and the scan of `cstack/test/fixtures/steps-block` report no problem.
- Minimum code: `stepProblems()` in `cstack/src/guide-steps.ts`, and the scan of the blocks in `cstack/test/manifest.test.ts`, as `## Decisions` describes them.
- Refactor: none planned.
- Commit message: test(tests): fail CI when a block of mandatory steps names a missing command or helper
- Depends on: 1

The negative fixture is exactly this text:

```
<!-- mandatory steps
command: cstack next --done build --plan <plan file>
command: cstack frobnicate --plan <plan file>
helper: resolve-issue:no-such-helper
helper: resolve-issue:cto-review befor-plan
-->

# Broken steps

This fixture guide has a block whose steps name a command, a helper and a word that do not exist.
```

### Unit 4: Record the choice in ADR-RQG-C and the README

- Files: `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md`, `docs/projects/refocus-and-quality-guards.md`, `README.md`
- No test: these are documentation files, and no test reads them.
- Minimum code: the ADR, the link in section 9 of the specification page, and the README sentences, as `## Decisions` describes them. Write them in plain English, with one idea per sentence, and with no path of this machine.
- Refactor: none planned.
- Commit message: docs: record ADR-RQG-C, the block of mandatory steps in each phase guide
- Depends on: 1, 2, 3

## Documentation duties

- ADR-RQG-C: applies, written to `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md` by Unit 4.
- The specification page: applies, section 9 of `docs/projects/refocus-and-quality-guards.md` links to ADR-RQG-C, written by Unit 4.
- The README: applies, the paragraphs of `cstack guide` and `cstack next` in `README.md`, written by Unit 4.
- The ticket comment on #86: applies, written in the document phase.
- The comments on the dependent tickets #88 and #89: applies, written in the document phase, with the points that `## Decisions` names.
- The epic #84: does not apply, because the epic links to the specification page, and that page carries the link to ADR-RQG-C.
- Release notes: do not apply, because the version does not change in this ticket. The release at the end of milestone R3 writes them.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: The exact form of the block

Is this the form of the block you want? Line 1 of the guide is `<!-- mandatory steps`. Each following line is one step, `<kind>: <text>`, with an optional ` | <condition>` at the end. The kinds are `command`, `helper` and `action`. A line that holds only `-->` closes the block. For example:

```
<!-- mandatory steps
command: cstack unit order --plan <plan file>
command: cstack unit red <n> | each-unit-with-test
helper: resolve-issue:cto-review before-plan
helper: resolve-issue:code-explorer | no-file-map
action: approval-gate
-->
```

A `command` step starts with `cstack ` and keeps the placeholders that the guides already use, such as `<n>` and `<plan file>`. A `helper` step names the helper as the guides write it, `resolve-issue:<name>`, and can add one word for its moment or its focus, such as `before-plan` or `security`. An `action` step is one kebab-case id, such as `approval-gate`. No blank line, numbering or comment is allowed inside the block. The commands are written without backticks, so the existing mention scan does not count them twice and the end-to-end checks of `cstack/test/e2e/chain.ts` (line 207) cannot be satisfied by the block alone.
- For: the user
- Answer: yes, the form as written above: an HTML comment that opens on line 1 with `<!-- mandatory steps`, one `<kind>: <text>` line per step with an optional ` | <condition>`, and a closing line that holds only `-->`. The user, in the chat, on 2026-11-23, accepting the recommendation of the question round.

### Question 2: The fixed list of conditions

Is this the list of conditions you want, and do the two steps that depend on Claude's judgment get a condition? The recommended list is `each-unit`, `each-unit-with-test`, `each-stuck-unit`, `each-negative-criterion`, `each-dependent-ticket`, `no-file-map`, `user-interface`, `architecture-choice` and `new-structural-decision`. An `each-` condition repeats the step once for each matching item, and `<n>` takes the unit's number. The other conditions apply the step once, only when they hold. Each one is decided from a record: the units of the plan, a stuck report, the ticket's footer, the ticket's "Where things are today" section, or a unit's `Design specification` line. `each-negative-criterion` needs the format 2 of the plan, so it applies to nothing until #98 builds it. The last two conditions cover the code architects (`cstack/guides/resolve-issue/plan.md`, line 7) and the second call of the CTO advisor (`plan.md`, line 13). Both depend on a judgment, so the audit can only decide them from what the plan says, such as the sentence "No new decision since the question round". The other choice is to leave those two steps out of the blocks, so that the audit never checks them.
- For: the user
- Answer: seven conditions, without `no-file-map` and `architecture-choice`: `each-unit`, `each-unit-with-test`, `each-stuck-unit`, `each-negative-criterion`, `each-dependent-ticket`, `user-interface` and `new-structural-decision`. The blocks do not list the code explorers or the code architects. The independent review is written with no condition. The user, in the chat, on 2026-11-23, accepting the recommendation of the question round.

## Review log

<phase review>

## Briefing

<phase briefing>

## Non-blocking questions

- At milestone R4, which guides does the audit use to judge runs 3 and 4: the guides as they are at the end of milestone R1, or the result of US-1 AC10? For: the maintainer.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document>

## Executor notes

<executor>

## Hand-off log

<executor>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Is the form of the block the right one?** This is question 1 above: an HTML comment on line 1, then one `<kind>: <text>` line per step, with an optional ` | <condition>`. Tickets #88, #89 and #90 all build on this form, so changing it later means changing three tickets. I recommend it as written, because it stays invisible on GitHub and the existing command scan does not count it twice.

**Which conditions go in the fixed list?** This is question 2 above. I would rather drop two of the nine: `no-file-map` and `architecture-choice`, and leave the code explorers and the code architects out of the blocks. The specification lists the checks that the audit must see: the code map, the CTO advisor at its three moments, the three code reviews and the independent review (US-1, AC4). It also says that the audit checks that a check happened, not who did it (AC5). The code map always happens, because it is a phase, and the architects are not in that list. Seven conditions remain. The only one that depends on judgment, `new-structural-decision`, can be decided from the sentence "No new decision since the question round", which the plan guide already requires. Two conditional steps are missing from the draft list, and neither needs a condition. The independent review is expected whatever the reviewer, because of AC5. A rebase is not a `cstack` command.

**I will do this unless you say no.**

- `readGuide()` keeps returning the raw file. One small function removes the block, and both `cstack guide` and `cstack next` call it. The audit and the CI check need the raw block from the same reader.
- The reader takes the text of a guide and its name, not a path. Then the audit can read a guide from an older commit.
- The CI check also checks that a helper's word, such as `before-plan` or `security`, appears in that helper's prompt. Without this, a typo such as `befor-plan` passes CI, and the audit reports the step as skipped on every run.
- The reader refuses `-->` inside a step. GitHub closes the comment there and would show the remaining steps as text.

**I checked it myself.** The words `before-plan`, `plan-delta`, `after-build` and `security` are all in the matching prompts, so that extra check passes on today's prompts.

**Good to know.**

- The specification also runs the audit on runs 3 and 4 at the end of the project (US-9, AC5). By then the refocus and the guards will have changed the guides. I will say so in the comment for the audit ticket (#89).
- No user writes a guide, and `cstack guide` only reads the guides of the package. So the format is not a public interface, and changing it later means editing files of this repository only.

#### Details

Question 1, the form of the block, is blocking, and only the user can answer it. I keep the draft recommendation. I checked the claim that the existing scan ignores the block: `extractMentions()` in `cstack/test/manifest.test.ts` (lines 17 to 42) scans only fenced blocks and inline code spans, so a line of an HTML comment without backticks is never read. The scan also cuts a mention at `|` and `>` (line 23), so the CI check of the blocks must remove the ` | <condition>` part itself before it calls `matchMention()` (`cstack/src/manifest.ts`, line 320). `matchMention()` already accepts placeholders such as `<n>` as positional words. I considered a format version in the opening line, such as `<!-- mandatory steps v1`, and rejected it. The reader and the blocks always ship in the same package, and the absence of a version can mean version 1 later if the format changes. If nobody decides, the run stops at the question round.

Question 2, the list of conditions, is blocking, and only the user can answer it. I change the draft recommendation. US-1 AC4 names the checks of the third level: the code map, the CTO advisor at its three moments, the three code reviews and the independent review. AC5 says that the audit checks that the check happened, not which helper did it. The code map is the phase `code-map`, which the first level already checks through `PHASES`, so the launch of `resolve-issue:code-explorer` (`cstack/guides/resolve-issue/code-map.md`, line 18) is a choice of helper, which AC5 puts outside the audit. That launch also depends on "the area is large", which no record shows, so `no-file-map` would only cover half of its rule. The code architects (`cstack/guides/resolve-issue/plan.md`, line 7) are not in the AC4 list, and their condition is pure judgment. Dropping both leaves `each-unit`, `each-unit-with-test`, `each-stuck-unit`, `each-negative-criterion`, `each-dependent-ticket`, `user-interface` and `new-structural-decision`. The last one is decidable, because `plan.md` line 13 tells the session to write "No new decision since the question round" under `## Architecture` when it does not launch the second CTO call. The code mapping names two more conditional steps that the draft list does not cover. `cstack/guides/resolve-issue/independent-review.md` line 15 launches `resolve-issue:pr-reviewer` only when the review agent is `claude`. Under AC5 the independent review is expected in every run, so the block writes it with no condition, and #90 must accept a review by an Orca worker as evidence. `cstack/guides/resolve-issue/update-branch.md` lines 7 to 9 rebase or merge only when the target moved. That is not a `cstack` command, so no block lists it, and no condition is needed. The other option, keeping all nine conditions, makes #90 evaluate two conditions that no record can decide. If nobody decides, the run stops at the question round.

Keeping `readGuide()` raw is non-blocking. `cstack/src/commands/guide.ts` line 46 returns the raw text, and `cstack/test/guide.test.ts` line 98 checks the exact bytes. Both printers go through `readGuide()`: `guide()` at line 68 and `printGuide()` in `cstack/src/commands/next.ts` at line 40. #89 needs the block, so a `readGuide()` that removed it would force a second file reader. I recommend one exported function that removes the block, called by `guide()` and `printGuide()` before they print. The other option, removing the block inside `readGuide()`, changes the meaning of the test at line 98 and hides the block from the audit.

A reader that takes text is non-blocking. US-9 AC5 runs the audit on runs 3 and 4 at milestone R4. By then R2 and R3 have changed the guides, and the version number does not change during R1 (see `## Decisions`), so no tag holds the blocks that match runs 3 and 4. #89 may need to read the guides of an older commit with `git show`, so the reader should take the text of a guide and a name for its messages. This costs nothing now. The point itself goes into the comment for #89 in the document phase, as a non-blocking question for the maintainer: "At R4, which guides does the audit use for runs 3 and 4: the guides at the end of R1, or the result of AC10?"

Checking a helper's word against its prompt is non-blocking. The draft leaves the word after the helper name unchecked, because the moments and the focuses are prose. An unchecked typo would pass CI, and #90 would then never find evidence for that step. I recommend that the CI check requires the word to appear in `cstack/skills/<skill>/agents/<name>.md`. This adds no second list, because the prompt stays the only place where the word is defined. I tested it with grep: `before-plan`, `plan-delta` and `after-build` are in `cstack/skills/resolve-issue/agents/cto-review.md` (lines 19, 78, 88 and 94), and `security` and `correctness` are in `cstack/skills/resolve-issue/agents/code-reviewer-deep.md` (lines 3, 8 and 10).

Refusing `-->` inside a step is non-blocking. In CommonMark, an HTML comment block ends on the first line that contains `-->`, and the lines after it render as Markdown. A step that contains `-->` would therefore show the rest of the block on GitHub, while the reader still sees an open block. The reader refuses any line inside the block that contains `-->` and is not the closing line. I also add two tests to the comment for #88, next to the two that the draft names. `cstack/test/guides/settings-applied.test.ts` scans the raw guides for words that belong to the settings and for "rebase" without the integration setting. The push rule in `cstack/test/prompts.test.ts` (line 101) scans the raw guides for a sentence with "git push". A block with a kebab-case action id such as `push-branch` passes both, but a command or an action written with spaces might not.

Reversibility: the block is read only from `cstack/guides/`, which only this package ships (`cstack/package.json`, lines 6 to 10), and `cstack guide` never reads a guide from the user's repository. So the format is internal, and a later change touches only the guides and the reader of this repository.

The decisions already taken are not reopened. ADR-RQG-C chose a block in each guide (specification, section 9). The ticket fixes the three kinds, the CI checks, the removal of the block from the printed guide and the fixture. The R1 milestone fixes that the audit judges runs 3 and 4 against the steps of the current guides (specification, section 6).

I checked security and authorization, scale and performance, operations and cost, and user interface edge cases, and found nothing that applies to this ticket.

### Open questions and answers

- **Blocking question 1**, the exact form of the block. Recommended answer: the form written under `## Blocking questions`, an HTML comment on line 1 with one `<kind>: <text> [| <condition>]` line per step. Answered: see Blocking question 1.
- **Blocking question 2**, the fixed list of conditions. Recommended answer: the nine conditions written under `## Blocking questions`, with the two conditions that depend on judgment kept and decided from what the plan says. The advisor changed the recommendation to seven conditions, and the user accepted it. Answered: see Blocking question 2.
- **Non-blocking: what `cstack guide` and `cstack next` do with a malformed block.** Recommended answer, an assumption not asked: they only remove the block, from line 1 to its closing `-->` line and the one blank line after it, without checking its steps. A run never gets stuck on a guide that it cannot print. The CI check parses every real guide's block, so a malformed block cannot ship. When line 1 opens a block that never closes, the guide is refused with exit code 3, and the message names the guide.
- **Non-blocking: the form of an `action` step.** Recommended answer, an assumption not asked: one kebab-case id, such as `approval-gate` or `commit-plan-file`. The list of ids stays open, because US-1 AC3 and AC4 never ask the audit to check an action. ADR-RQG-C records that rule.
- **Non-blocking: the moment or focus of a helper step.** Recommended answer, an assumption not asked: one optional kebab-case word after the helper name. The reader does not check it against a list, because the CTO advisor's moments (`cstack/skills/resolve-issue/agents/cto-review.md`, line 19) and the review focuses (`cstack/guides/resolve-issue/review.md`, lines 17 to 20) are prose today.
- **Non-blocking: where the CI check of the blocks lives.** Recommended answer, an assumption not asked: an exported function in `cstack/test/manifest.test.ts`, next to `scan()` (line 52). It reads each guide's block with the new reader, checks each command with `matchMention()` (`cstack/src/manifest.ts`, line 320), and checks that each helper `<skill>:<name>` has `cstack/skills/<skill>/agents/<name>.md`. The negative fixtures go in a new folder, because the case at line 63 expects exactly one failure from `cstack/test/fixtures/manifest/`.
- **Non-blocking: an empty block, a block further down the file, and Windows line ends.** Recommended answer, an assumption not asked: an empty block is refused, because every phase ends with at least `cstack next --done <phase>`. A line `<!-- mandatory steps` anywhere after line 1 is refused, with its line. The reader accepts `\r\n` line ends, and the printed guide keeps the rest of the file byte for byte.
- **Non-blocking: what #88 must watch.** `cstack/test/skill-size.test.ts` (line 41) counts the raw words of `ticket.md`, and the end-to-end checks read the raw guide files. Both will see the blocks that #88 writes. This is not a question for this ticket. It goes into the comment for #88 in the document phase.

- **The user's reply.** On 2026-11-23 the user answered "ok" to the short version. Both blocking questions take the advisor's recommendation. Every non-blocking item above, and every item of the advisor's "I will do this unless you say no" list, is accepted by default.

### Architecture options

No real choice remained after the question round, so no blueprint was written.
