# Plan: #94 — R2-4: Add --ready to cstack tracker list

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/94
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/tracker-list-ready
Target branch: main
Conversation language: French
Status: ready for review
Approved at: 2026-11-23T17:53:18+01:00
Ready for review at: 2026-11-23T18:07:01+01:00

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Let `cstack tracker list` show only the tickets that can start now, so that the coordinator never starts a ticket whose blockers are not merged yet.

- **What the title means**: `cstack tracker list` prints the tickets of a milestone or an epic, with their states and their blockers. A blocker is a ticket that must be finished first. A ticket is ready when it is open, nobody works on it yet, and all its blockers are finished. The coordinator is the Claude session in the main Orca workspace that starts one agent per ticket.
- **Why we are doing it**: `cstack wave` used to compute the ready tickets and start them. It leaves `cstack`, because Orca now starts the agents. The coordinator still needs the list of ready tickets, and computing it from the blockers is a mechanical step that code does right every time.
- **For the user**: When the maintainer asks for the next tickets, the coordinator starts exactly the ones whose blockers are merged.

**Goal.** This ticket adds the option `--ready` to `cstack tracker list`.

### Where things are today (read first)

* **The command**: `cstack/src/commands/tracker-list.ts` → `trackerList()` (line 8) reads its options at lines 9 to 14. Line 35 builds the output `{ format: "cstack-tracker/1", tracker, group, tickets }`. Its manifest entry is at `cstack/src/manifest.ts` (line 214).
* **The ticket type**: `cstack/src/tracker/types.ts` → `Ticket` (line 9) has `stateKind` (line 20) and `blockers` (line 21), which is a list or `"unknown"`.
* **The ready rule**: `cstack/src/tracker/ready.ts` → `readyState()` (lines 11 to 18) already decides it. A ticket is ready when it is not finished and its state is known (lines 12 and 13). It is not in progress, and it has no worktree (line 14). Its blockers are known (line 15), and every blocker is finished (lines 16 and 17). Its second argument says whether a worktree exists.
* **What "finished" means**: `cstack/src/tracker/states.ts` maps it per tracker. Jira uses the `done` category (line 10). Linear uses `completed` and `canceled` (line 16). GitHub and GitLab use a closed issue (line 31). On GitHub, an open blocker gets the kind "unknown" (`cstack/src/tracker/github-gh.ts`, line 95).
* **The wave**: `cstack/src/wave/groups.ts` → `groupTickets()` (line 40) calls `readyState()` with a worktree check from Orca. #95 removes the wave, but `ready.ts` stays.
* **Tests**: `cstack/test/tracker/ready.test.ts` (line 20), `github-gh.test.ts` (line 224) and `claude-file-fallback.test.ts` (line 60).

### Scope

1. Add `--ready` to `cstack tracker list`, with `--milestone <name>` and with `--epic <key>`.
2. Keep only the tickets that `readyState()` says are ready, without the worktree check. Whether a ticket already has a workspace is a question for Orca, through `orca reference find`.
3. Keep the same output format, with fewer tickets.
4. Update the usage line in the manifest and the `cstack tracker` part of the README.

### Acceptance (TDD)

* A tracker list test: write first a milestone with one ready ticket, one ticket with an open blocker and one ticket in progress. `--ready` prints only the first one. See it fail, then pass.
* The same test, negative: a ticket whose blocker is still open, for example because its pull request is not merged, is never listed. A ticket whose blockers are "unknown" is never listed.
* Without `--ready`, the output does not change.
* The option works for the four trackers, through the existing fake clients.
* `cstack/test/cli.test.ts` and `cstack/test/manifest.test.ts` pass with the new usage line.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #87 · Feeds: #104

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Rules of the specification for every story.** No story adds a `cstack` command that starts an agent, waits for it, sends it a message, or watches the tracker. Every `cstack` command works without Orca. A change to a phase guide also updates the block of mandatory steps of that guide (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story").

**The story that this ticket carries.** The specification lists it in section 4, under "US-4: List the ready tickets". This ticket carries all of it:

- AC1: `cstack tracker list --milestone <name> --ready` prints only the tickets that are open, that are not "in progress", and whose blockers are all done, cancelled or duplicates. `--epic <key> --ready` works the same way.
- AC2: It works for the four trackers that `cstack tracker list` supports.
- AC3: Whether a ticket already has a workspace is a question for Orca, through `orca reference find`. This option does not answer it.
- AC (negative): A ticket with one open blocker is never listed. A blocker whose pull request is open but not merged still counts as open.

The specification also defines the term in its glossary: "A ready ticket is open and not "in progress", and all its blockers are done, cancelled or duplicates." It records that a new command for the ready tickets was dropped, because listing tickets is a tracker read, so it became an option of `cstack tracker list`.

The ADRs that this block names:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

## Code mapping

**Entry point.** `trackerList()` in `cstack/src/commands/tracker-list.ts` (line 8) is the whole command. It reads its four string options through `parseTrackerArgs()` (lines 9 to 14). It refuses a positional argument (line 16), and it refuses zero or two of `--milestone` and `--epic` (line 18). It opens the tracker with the `list` capability (lines 26 to 33), calls `listGroup()` once (line 34) and prints `{ format: "cstack-tracker/1", tracker, group, tickets }` with two spaces of indentation (line 35). The `--ready` filter fits between line 34 and line 35, because every client, the file from Claude included, returns its tickets through that one `listGroup()` call.

**The option parser.** `parseTrackerArgs()` in `cstack/src/commands/tracker-common.ts` (lines 32 to 42) is shared by the four tracker commands. Its type accepts only `{ type: "string" }` options (line 32), so a boolean option such as `--ready` does not type-check today. Node's `parseArgs` itself accepts `{ type: "boolean" }`. The file starts with a `WHY:` comment (line 1): the four tracker commands share it so that their messages and exit codes stay equal. `usageError()` (lines 26 to 29) prints `cstack tracker <word>: <problem>` and the usage line from the manifest, and returns 2. This file is outside the list of files that the brief gives this ticket.

**The ready rule.** `readyState(ticket, hasWorktree)` in `cstack/src/tracker/ready.ts` (lines 11 to 18) decides in a fixed order. A finished ticket is `left-out` (line 12). A ticket whose own state is unknown is `blocked` with reason `unknown-state` (line 13). A ticket in progress, or with a worktree, is `started` (line 14). A ticket whose blockers are `"unknown"` is `blocked` with reason `unknown-blockers` (line 15). A ticket with any blocker that is not `finished` is `blocked` with reason `blocked-by` (lines 16 and 17). Only then is it `ready` (line 18). A blocker whose own kind is `unknown` is not finished, so it blocks. The only other caller is `groupTickets()` in `cstack/src/wave/groups.ts` (line 40, call at line 44), which #95 removes with the wave. `cstack/test/tracker/ready.test.ts` (lines 20 to 61) covers the five outcomes.

**What "finished" means per tracker.** `cstack/src/tracker/states.ts` maps it. Jira's status category `done` is finished (line 10). Linear's state types `completed` and `canceled` are finished (line 16). A closed GitHub or GitLab issue is finished, whatever its reason (line 31), so a duplicate or a "not planned" issue counts too. An open GitHub or GitLab issue with the label `in progress` or `in review` is `in-progress` (lines 32 and 33), otherwise `todo`.

**How GitHub fills the blockers.** In `cstack/src/tracker/github-gh.ts`, an open blocker of the same repository first gets the kind `unknown` (line 95). `settleBlockers()` in `cstack/src/tracker/forge.ts` (lines 35 to 64) then gives it the kind of the ticket of the group with that key, or looks it up once. A lookup that fails leaves `unknown` and warns. A blocker issue stays open until the pull request that closes it merges, so a blocker with an open pull request is `todo` or `in-progress`, never `finished`. When gh returns fewer blocker nodes than `totalCount`, or a blocker is an open issue of another repository, the whole `blockers` field becomes `"unknown"` (lines 78 to 81 and 89 to 97).

**What each tracker lists.** GitHub lists a milestone and an epic (`cstack/src/tracker/github-gh.ts`, lines 115 to 135). GitLab refuses an epic with exit 1 before any call (`cstack/src/tracker/gitlab-glab.ts`, lines 101 to 104). Linear sends a milestone back to Claude with exit 4 (`cstack/src/tracker/linear-orca.ts`, lines 81 to 86). Jira lists both, through `parent = <key>` for an epic (`cstack/src/tracker/jira-orca.ts`, lines 36 to 40 and 87 to 114). The file from Claude (`cstack/src/tracker/claude-file.ts`, lines 31 to 40) returns the tickets of its file when its group matches. `checkedTracker()` (`cstack/src/tracker/checked.ts`, lines 73 to 82) drops a ticket with a bad key, URL or blocker key, with a warning, before `trackerList()` sees it.

**The manifest and the README.** The entry of `cstack tracker list` is in `cstack/src/manifest.ts`, lines 228 to 236, not at line 214 as the ticket says. Its usage line (line 229) is `cstack tracker list (--milestone <name> | --epic <key>) [--tracker <name>] [--from-file <path>]`. Its `flags` list (line 231) is `["--milestone", "--epic", "--tracker", "--from-file"]`. Its `ticket` field is `[25, 26]` (line 234). Other entries keep the ticket that first built them, so this ticket keeps `[25, 26]`. The README describes the four tracker commands in one bullet, at `README.md` line 70.

**Tests that must keep passing.** `cstack/test/cli.test.ts` checks that every built entry prints its usage line (lines 213 to 218) and that an unknown flag gives exit 2 with the usage line (lines 226 to 232). `cstack/test/manifest-implemented.test.ts` (lines 40 to 55) runs each built command with an unknown flag. `cstack/test/manifest.test.ts` refuses a mention of a flag that the entry does not list (lines 103 to 106), so `--ready` must go into `flags`. `trackerUsage()` (`cstack/src/commands/tracker-common.ts`, lines 21 to 23) finds the usage line by its prefix `cstack tracker list `, so the new usage line must keep that prefix.

**Existing fake clients and test patterns.** Each test file builds its own fake `Runner`, which maps a joined command line to a canned `RunResult` and records every call. `cstack/test/tracker/github-gh.test.ts` has a `cstack tracker list` block (lines 224 to 241) that calls `trackerList()` with a fake runner and the fixture `cstack/test/fixtures/gh/2.101.0/issue-list.milestone.json`. That fixture holds four open issues, #3, #4, #5 and #6, with no labels. #5 and #6 are blocked by the open #4, so #3 and #4 are ready and #5 and #6 are not. `cstack/test/tracker/gitlab-glab.test.ts` builds issues inline with `issue()` and `link()` (lines 15 to 21) and a fake runner (lines 24 to 36). `cstack/test/tracker/orca-wiring.test.ts` drives `trackerRead()` through the Jira and Linear adapters with the Orca feature answers `FEATURES` (lines 11 to 18) and the fixtures in `cstack/test/fixtures/orca/1.4.263/`. `cstack/test/tracker/claude-file-fallback.test.ts` calls `trackerList()` with `--from-file` (line 60). No test drives `trackerList()` through GitLab, Jira or Linear today.

**Risks.** The files to change have a short history and no repeated fixes: `tracker-list.ts` has two commits, `tracker-common.ts` two and `ready.ts` one. `tracker-common.ts` is shared by four commands, so a change to the type of `parseTrackerArgs()` reaches `tracker read`, `move` and `comment`, at least at type level. The four tracker clients answer with different shapes, so a test per tracker needs its own fake answers. Linear and GitLab each support only one kind of group, so the per-tracker tests use an epic on Linear and a milestone on GitLab. #90 runs at the same time and edits other parts of `cstack/src/manifest.ts` and `README.md`, so a rebase may meet a conflict there.

**Governing decisions.** ADR-SIC-F (`docs/decisions/ADR-SIC-F-tracker-access.md`) decides how `cstack` reaches each tracker, and it says that the ready rule needs the real state of each blocker (line 38). ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`) says that a command prints through `io`, returns its exit code, and that a usage error returns 2 (lines 20 to 23). The `WHY:` comment of `tracker-common.ts` (line 1) keeps the parsing of the four tracker commands in one place. The specification defines a ready ticket as open, not "in progress", with all blockers done, cancelled or duplicates (`docs/projects/refocus-and-quality-guards.md`, line 323). US-4 AC3 leaves the workspace check to Orca (line 142).

## Decisions

- This ticket changes no guide in `cstack/guides/`. The user decided on 2026-11-23 that it starts before the end of milestone R1 for that reason. (2026-11-23, from the brief of the run)
- This ticket works only in `cstack/src/commands/tracker-list.ts`, in `cstack/src/tracker/`, in its tests under `cstack/test/tracker/`, in the `cstack tracker list` entry of `cstack/src/manifest.ts` and in the `cstack tracker list` paragraph of `README.md`. It also widens the type of `parseTrackerArgs()` in `cstack/src/commands/tracker-common.ts`, and changes nothing else in that file. In `cstack/src/manifest.ts` and `README.md`, it changes only the entry and the paragraph of `cstack tracker list`. (2026-11-23, from the brief of the run; `tracker-common.ts` added by the user, on 2026-11-23)
- This ticket changes nothing under `cstack/src/measure/`, and it does not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- #90 runs at the same time, in its own worktree and with its own pull request. It works in `cstack/src/audit/`, `cstack/src/commands/audit.ts`, its own test files, and the `cstack audit` entry of `cstack/src/manifest.ts` and paragraph of `README.md`. (2026-11-23, from the brief of the run)
- The tests use the existing fake clients of `gh`, `glab`, Jira and Linear, never the real ones. Never run `glab`, and never call a Jira or Linear connection, not even to check a format. (2026-11-23, from the brief of the run)
- Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Never run `cstack wave` or `cstack wave --watch` for real. Run `git worktree add` only inside a temporary test repository. (2026-11-23, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs. (2026-11-23, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-23, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-23, from the brief of the run)
- The executor starts the implementers, so it needs the same three rules about helpers. The main conversation puts the three rules above, word for word, in the prompt of the executor. (2026-11-23, from the brief of the run)
- Never run `orca orchestration`, `orca worktree create` or `orca worktree rm` from this run. (2026-11-23, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, may read only the session files of this run. Its prompt says so. (2026-11-23, from the brief of the run)
- Never install Graphify or Repowise. (2026-11-23, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`. To try the code of this branch, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-23, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. Never edit anything under the top-level `skills/` folder, which is frozen. Never push a tag that starts with `v`. (2026-11-23, from the brief of the run)
- If the skill or `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-23, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-23, from the conventions file and the brief of the run)
- Before `cstack publish`, two checks must pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, `git log -p origin/main..HEAD` and the drafted pull request title and body go into a temporary file outside the repository, and `python3 -B scripts/private_names.py check <that file>` exits with 0. Never print the private list. (2026-11-23, from the brief of the run)
- Before `cstack publish`, run `cstack plan status` and check that every unit is done or has a `- Blocked:` line, because `cstack publish` does not check it yet. (2026-11-23, from the retrospective of #89 and the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-23, from the brief of the run)
- After the pull request is open, update the branch only when the coordinator asks. Then take `origin/main` into the branch with a merge commit, keep both changes, and push with a plain `git push`, without force. Before the pull request opens, the update-branch phase rebases, as the settings say. (2026-11-23, from the brief of the run)
- Before committing a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits: never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-23, from the brief of the run)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-23, from the brief of the run)
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
- `--ready` filters the list that `listGroup()` returns, between line 34 and line 35 of `cstack/src/commands/tracker-list.ts`. So it works the same with every client: `gh`, `glab`, Orca for Jira and Linear, and the file from Claude given with `--from-file`. (2026-11-23, an assumption not asked)
- `--ready` keeps a ticket only when `readyState(ticket, false)` returns `{ kind: "ready" }` (`cstack/src/tracker/ready.ts`, lines 11 to 18). The second argument is always `false`, because the workspace check belongs to Orca (US-4 AC3). `readyState()` and its signature do not change. (2026-11-23, an assumption not asked)
- `--ready` never looks for a worktree or a workspace. It runs no `git worktree list` and no `orca` command of its own. (2026-11-23, an assumption not asked, from US-4 AC3)
- With `--ready`, the output keeps the format `{ format: "cstack-tracker/1", tracker, group, tickets }` of line 35 of `cstack/src/commands/tracker-list.ts`. It adds no key. `group` is the group of the command line, as today. The kept tickets keep the order and the content that `listGroup()` gave them. (2026-11-23, an assumption not asked, from the ticket)
- When no ticket is ready, `--ready` prints the same format with `"tickets": []` and exits with 0. (2026-11-23, an assumption not asked)
- Without `--ready`, the command does exactly what it does today, and its standard output does not change by one byte. (2026-11-23, from the ticket)
- `--ready` is an option without a value. `--ready=<value>` is a usage error with exit code 2, because Node's `parseArgs` throws `Option '--ready' does not take an argument` for it. Giving `--ready` twice is the same as giving it once. (2026-11-23, an assumption not asked, checked with `parseArgs` of Node 26)
- The usage line of the manifest entry (`cstack/src/manifest.ts`, line 229) becomes `cstack tracker list (--milestone <name> | --epic <key>) [--ready] [--tracker <name>] [--from-file <path>]`. Its `flags` list (line 231) becomes `["--milestone", "--epic", "--ready", "--tracker", "--from-file"]`. Its summary, its exit codes and its `ticket` field `[25, 26]` do not change. (2026-11-23, an assumption not asked)
- The type of `parseTrackerArgs()` (`cstack/src/commands/tracker-common.ts`, lines 32 to 42) accepts `{ type: "string" }` and `{ type: "boolean" }` options. Each value is typed from its own option: `boolean | undefined` for a boolean option, `string | undefined` otherwise. The runtime code of the function does not change, and `tracker read`, `tracker move` and `tracker comment` keep their behaviour. This is the only change to `tracker-common.ts`. (the user, on 2026-11-23)
- `--no-ready` is a usage error with exit code 2, because Node's `parseArgs` throws `Unknown option '--no-ready'` when `allowNegative` is off. Both `--ready=x` and `--no-ready` print the usage line of `cstack tracker list`, as `usageError()` does (`cstack/src/commands/tracker-common.ts`, lines 26 to 29). (2026-11-23, checked by the advisor with `parseArgs` of Node 26.10)
- With `--ready`, each ticket that is left out because something is unknown gives one warning line on standard error, in the order of the list. When `readyState(ticket, false)` returns the reason `unknown-state`, the line is `cstack: left out <key>, because its state is unknown.`. When it returns the reason `unknown-blockers`, the line is `cstack: left out <key>, because its blockers are unknown.`. When it returns the reason `blocked-by` and at least one blocker of `ticket.blockers` has the kind `unknown`, the line is `cstack: left out <key>, because the state of its blocker <blocker key> is unknown.`, once for each such blocker, in the order of `ticket.blockers`. `<key>` and `<blocker key>` are the keys as the tracker gave them. (the user, on 2026-11-23; one line per blocker decided in the plan)
- With `--ready`, a ticket that is finished, started, or blocked only by blockers whose kind is known gives no warning line. Without `--ready`, the command prints none of the three new lines. The exit code stays 0 whatever the warnings. (the user, on 2026-11-23)
- The adapters keep their own warnings. On GitHub and GitLab, a ticket can then get two lines on standard error: the warning of the adapter that gives the cause, then the line of `--ready`. (2026-11-23, an assumption not asked, from the advisor)
- The test of the rule "`--ready` adds no call" records the calls of the fake runner for one run with `--ready` and one run without it, on the same answers, and expects the same list in the same order. It does this on each of the four trackers. It never refuses every `orca` call, because Jira and Linear read the list through Orca. (2026-11-23, accepted by default)

## Architecture

The change is small, and the approach is locked by the ticket and the answers: `cstack tracker list` filters the result of `listGroup()` with the existing `readyState()`, and prints the same format. No new decision since the question round.

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

### Unit 1: List only the ready tickets with --ready

- Files: `cstack/src/commands/tracker-common.ts`, `cstack/src/commands/tracker-list.ts`, `cstack/src/manifest.ts`, `cstack/test/tracker/tracker-list-ready.test.ts`
- Test: `cstack/test/tracker/tracker-list-ready.test.ts`: on a GitHub milestone with one ready ticket, one ticket blocked by an open blocker and one ticket in progress, `cstack tracker list --milestone <name> --ready` exits with 0 and prints only the ready ticket, while the same run without `--ready` prints all three
- Minimum code: Widen the type of `parseTrackerArgs()` in `cstack/src/commands/tracker-common.ts` as `## Decisions` says, with no change to its runtime code. In `trackerList()`, add the option `ready: { type: "boolean" }`. After the call to `listGroup()`, when `ready` is true, keep only the tickets for which `readyState(ticket, false).kind === "ready"`, in their order. Print them in the same format as today. In `cstack/src/manifest.ts`, change only the usage line and the `flags` list of the `cstack tracker list` entry, as `## Decisions` says.
- Refactor: none
- Commit message: feat(cli): add --ready to cstack tracker list to keep only the tickets that can start now
- Depends on: none

The test file is new. It imports `trackerList()` statically, because that module already exists. Each case below is its own `it()`, and each one drives `trackerList()` with a fake runner, never a real program. The fake runner answers `git`, the login checks and the tracker calls from a map of joined command lines, and records every call, as `cstack/test/tracker/github-gh.test.ts` (lines 224 to 241), `cstack/test/tracker/gitlab-glab.test.ts` (lines 24 to 36) and `cstack/test/tracker/orca-wiring.test.ts` (lines 11 to 32) do. Use `cstack/test/fakes/orca-run.ts` or the `FEATURES` answers of `orca-wiring.test.ts` for the Orca feature check, and build the tracker answers inline in the shape of the fixtures of `cstack/test/fixtures/gh/2.101.0/`, `cstack/test/fixtures/glab/1.119.0/` and `cstack/test/fixtures/orca/1.4.263/`. Sample names in the data are `user`, `someone` or `runner`.

The cases of this unit:

1. GitHub, milestone: one ready ticket, one ticket blocked by an open blocker, and one ticket with the label `in progress`. With `--ready`, the command exits with 0 and prints only the ready ticket. Without `--ready`, on the same answers, its standard output is exactly `JSON.stringify({ format: "cstack-tracker/1", tracker: "github", group, tickets }, null, 2) + "\n"` with all three tickets.
2. GitHub, epic: `--epic '#<n>' --ready` keeps the ready sub-issue and drops a sub-issue blocked by an open blocker.
3. A ticket whose only blocker is an open issue with the label `in review`, which is how a blocker whose pull request is open but not merged looks, is never listed with `--ready`.
4. A ticket whose blockers are `"unknown"` is never listed with `--ready`. On GitHub, use a ticket blocked by an open issue of another repository, which makes its blockers unknown (`cstack/src/tracker/github-gh.ts`, lines 89 to 97).
5. A ticket whose own state is unknown is never listed with `--ready`. Use `--from-file` with a ticket whose `stateKind` is `"unknown"`.
6. A finished ticket is never listed with `--ready`.
7. When no ticket is ready, `--ready` exits with 0 and prints the same format with `"tickets": []`.
8. GitLab, milestone, through the fake `glab` runner: one ready ticket, one ticket blocked by an open blocker, one ticket with the label `in progress`. Only the ready ticket is printed.
9. Jira, milestone, through the fake Orca runner: one ready ticket whose footer says `Blocked by: none`, one ticket whose footer names a blocker in the status category `indeterminate`, and one ticket in the status category `indeterminate`. Only the ready ticket is printed.
10. Linear, epic, through the fake Orca runner: one ready ticket, one ticket blocked by a ticket of type `started`, one ticket of type `started`. Only the ready ticket is printed.
11. `--from-file` with `--ready`: the command keeps only the ready tickets of the file.
12. `--ready` adds no call: for each of the four trackers, on the same answers, the list of calls that the fake runner records with `--ready` is the same, in the same order, as the list without it. This case never refuses every `orca` call, because Jira and Linear read the list through Orca.
13. `--ready=x` exits with 2. Its standard error holds `Usage: cstack tracker list (--milestone <name> | --epic <key>) [--ready] [--tracker <name>] [--from-file <path>]`. The fake runner records no tracker call.
14. `--no-ready` exits with 2, with the same usage line on standard error, and no tracker call.

Cases 13 and 14 are two refusals, so each one is its own `it()`. Before the code exists, case 13 and case 14 already exit with 2, because `--ready` is unknown. They fail first on the usage line, which does not hold `[--ready]` yet.

### Unit 2: Warn about the tickets that --ready leaves out because something is unknown

- Files: `cstack/src/commands/tracker-list.ts`, `cstack/test/tracker/tracker-list-ready.test.ts`
- Test: `cstack/test/tracker/tracker-list-ready.test.ts`: with `--ready`, a ticket whose state is unknown gives exactly the line `cstack: left out <key>, because its state is unknown.` on standard error, and the command exits with 0
- Minimum code: In `trackerList()`, when `ready` is true, look at the result of `readyState(ticket, false)` for each ticket of the list, in order. For the reason `unknown-state` and for the reason `unknown-blockers`, print the line that `## Decisions` gives, through `warnTo(io)` of `cstack/src/commands/tracker-common.ts` or `io.stderr`. For the reason `blocked-by`, print one line for each blocker of `ticket.blockers` whose kind is `unknown`, in the order of `ticket.blockers`. Print nothing for any other result, and nothing without `--ready`.
- Refactor: When the filter and the warnings make `trackerList()` long, move them into one small function in `cstack/src/commands/tracker-list.ts` that takes the tickets and a warn function and returns the kept tickets.
- Commit message: feat(cli): say on standard error which tickets tracker list --ready leaves out because a state is unknown
- Depends on: 1

The keys in the lines are safe to print. `checkedTracker()` drops a ticket whose key or blocker key is not valid before `trackerList()` sees it (`cstack/src/tracker/checked.ts`, lines 55 to 64 and 73 to 82). The cases use `--from-file`, because the file from Claude can hold every kind of state and prints no warning of its own, except case 6. Each case is its own `it()`:

1. A ticket whose `stateKind` is `"unknown"` gives exactly `cstack: left out <key>, because its state is unknown.\n` on standard error, and the exit code is 0.
2. A ticket whose `blockers` is `"unknown"` gives exactly `cstack: left out <key>, because its blockers are unknown.\n`.
3. A ticket with two blockers whose `stateKind` is `"unknown"`, and one finished blocker, gives two lines `cstack: left out <key>, because the state of its blocker <blocker key> is unknown.`, one per unknown blocker, in the order of the blockers.
4. A group with a finished ticket, a ticket in progress, a ticket blocked only by a known open blocker and one ticket whose state is unknown gives exactly one line on standard error, the line of the ticket whose state is unknown.
5. The same group as cases 1 to 3, run without `--ready`, prints nothing on standard error, while the run with `--ready` prints the three kinds of lines.
6. On GitHub, a ticket blocked by an open issue of another repository gives the warning of the adapter first, then `cstack: left out <key>, because its blockers are unknown.`.

Cases 4 and 5 check what the command must not print, and each one also holds a ticket that must give a line, so each fails before the code exists.

### Unit 3: Describe --ready in the README

- Files: `README.md`
- No test: this unit changes only the paragraph of the README that describes the four `cstack tracker` commands. The tests of units 1 and 2 check the behaviour it describes.
- Minimum code: In the bullet of `README.md` that starts with `` `cstack tracker read '<key>'` `` (line 70), add sentences that say what `--ready` does. They say that `cstack tracker list` with `--ready` keeps only the tickets that are open, not in progress, and whose blockers are all finished. They say that the output keeps the same format. They say that a ticket left out because its state, its blockers or the state of one of its blockers is unknown gives one line on standard error. They say that `--ready` does not check whether a ticket already has a workspace, and that Orca answers that with `orca reference find`. Follow the documentation writing rules: one idea per sentence, a subject and a verb in each, under about 25 words. Change no other paragraph.
- Refactor: none
- Commit message: docs: describe the --ready option of cstack tracker list in the README
- Depends on: 1, 2

## Documentation duties

- README: applies, written to the paragraph on the `cstack tracker` commands in `README.md` by Unit 3.
- Comment on this ticket (#94): applies, written to #94 in the document phase. It gives the new usage line, says that the output format does not change, and gives the three warning lines.
- Comment on the release ticket (#104): applies, written to #104 in the document phase. It gives the new usage line and the three warning lines, so that the release notes of 0.4.0 can describe `--ready`.
- Architecture decision record: does not apply. `--ready` reuses the ready rule of `cstack/src/tracker/ready.ts`, and ADR-SIC-F already covers how `cstack` reads the trackers.
- Specification page: does not apply. `docs/projects/refocus-and-quality-guards.md` already describes `--ready` in US-4, and this ticket follows it.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Change the shared option parser
`--ready` is an option without a value. `parseTrackerArgs()` in `cstack/src/commands/tracker-common.ts` (line 32) accepts only options with a value in its type, so `--ready` does not type-check through it. That file is shared by the four tracker commands, and it is not in the list of files that the brief gives this ticket. May this ticket widen the type of `parseTrackerArgs()` so that it also accepts an option without a value? The code of `tracker read`, `tracker move` and `tracker comment` stays the same, and Node's `parseArgs` already reads such an option. The other way is to parse the options of `tracker list` alone in `cstack/src/commands/tracker-list.ts`, which copies the shared parsing that the `WHY:` comment of line 1 of `tracker-common.ts` wants in one place.
- For: the user
- Answer: yes. Widen only the type of `parseTrackerArgs()` so that it also accepts an option without a value. Its runtime code does not change. (the user, on 2026-11-23)

### Question 2: Warn about the tickets left out because something is unknown
With `--ready`, a ticket whose own state is unknown, or whose blockers are unknown, is never listed, as the ticket asks. On Jira, `cstack` reads the blockers only from the footer line of the ticket (`cstack/src/tracker/jira-orca.ts`, line 1). A Jira ticket without that footer gets unknown blockers (`cstack/src/tracker/blockers.ts`, line 12), and the Jira and Linear adapters print no warning about it. So on a Jira project whose tickets have no footer, `--ready` would list nothing, and nothing would say why. A blocker whose state cannot be read also keeps the kind `unknown` without a warning, on Jira (`cstack/src/tracker/jira-orca.ts`, lines 64 to 68) and on Linear (`cstack/src/tracker/linear-orca.ts`, lines 57 to 62). Should `--ready` print one warning line on standard error for each ticket that it leaves out in one of three cases: its own state is unknown, its blockers are unknown, or the state of one of its blockers is unknown? The proposed lines are `cstack: left out <key>, because its state is unknown.`, `cstack: left out <key>, because its blockers are unknown.` and `cstack: left out <key>, because the state of its blocker <blocker key> is unknown.`. The exit code stays 0, and standard output keeps the same format either way.
- For: the user
- Answer: yes, with the three cases: the state of the ticket is unknown, its blockers are unknown, or the state of one of its blockers is unknown. (the user, on 2026-11-23)

## Review log

Impact notes: the changed symbols are parseTrackerArgs (type only, used by tracker read, move, comment and list), trackerList, the manifest entry of cstack tracker list, and the README bullet on cstack tracker. Callers and tests found: cstack/test/tracker/*, manifest.test.ts, cli.test.ts and manifest-implemented.test.ts. All pass. The usual companions of the changed files are manifest.ts, manifest.test.ts, cli.ts and README.md. cli.ts needs no change, because it reads the manifest. The manifest field `ticket: [25, 26]` names the tickets that built the command, so it stays.

Correctness reviewer: no finding. Security reviewer: no finding. Keys in the warnings are validated by checkedTracker() before they are printed.
Conventions reviewer: two README findings, both fixed. The sentence on unknown states was wrong (one line per unknown blocker, not one line per ticket) and too long, and the word "workspace" was not explained, so the text now says "worktree" and tells the reader to run orca reference find.
Simplicity reviewer: two cheap findings, both fixed. The value type of parseTrackerArgs is now named once, and the nested if in keepReady is gone.
Follow-ups: none. Full test run after the fixes: typecheck clean, 1730 tests pass.

Independent review: no change, no bug, no security problem. Typecheck clean and 1730 tests pass. Judgment calls for the pull request body:
- The review fix commit changes code and the README together, so it is one mixed commit. It carries no Cstack-Unit line. Splitting it would rewrite history, so it stays.
- A ticket with both a known open blocker and a blocker of unknown state gets only the unknown-blocker warning. The plan chose this format.
- The test file defines two small helpers twice, in two describe blocks. One test title says "three lines" but expects four, and the in review test ends with an assertion on unrelated tickets. These are style points that are left as they are.

## Briefing

### What you should know about what was built

`cstack tracker list` now takes `--ready`. It keeps only the tickets that are open, not in progress, and whose blockers are all finished. The output format stays the same. When a ticket is left out because a state or its blockers are unknown, the command prints one line on standard error that says why. It does what the ticket asks. The 22 new test cases cover GitHub, GitLab, Jira, Linear and the file from Claude, through fake clients. The type check is clean and the 1730 tests pass. `main` has not moved since the branch started.

**What you need to do.**

- Merge the pull request yourself once its checks are green. Nothing else is waiting on you.

**What to watch.**

- The rule trusts the closed state of each blocker issue. If someone closes a blocker by hand before its pull request merges, its dependents show up as ready too early. If a pull request lacks "Closes #n", the blocker stays open and its dependents never show up. During the first waves, compare the list with what you expect.
- A ticket whose agent has started, but whose `in progress` label is not set yet, is still listed. The coordinator must keep asking `orca reference find` before it starts a ticket, or two agents can take the same ticket.
- Jira and Linear were tested only with fake answers. On a Jira project whose tickets have no "Blocked by:" footer, `--ready` prints an empty list. You will then see one line per ticket that says its blockers are unknown.

**What changed since the plan.**

- After the review, one commit changes both code and the README, and it carries no unit line. It stays as it is, because splitting it would rewrite the history.

### Details

The build matches the plan. `trackerList()` in `cstack/src/commands/tracker-list.ts` reads `--ready` as a boolean option and, when it is set, passes the result of `listGroup()` through a new private function `keepReady()`. That function calls `readyState(ticket, false)` for each ticket and keeps only `{ kind: "ready" }`, in list order. For a `blocked` result, it prints the `unknown-state` line, the `unknown-blockers` line, or, for `blocked-by`, one line per blocker whose `stateKind` is `unknown`, through `warnTo(io)`. The output object and its two-space indentation are unchanged, and the exit code stays 0. The manifest entry (`cstack/src/manifest.ts`, lines 229 and 231) gained `[--ready]` and `"--ready"`, and its `ticket` field stays `[25, 26]`. `git log HEAD..origin/main` was empty when I checked, so the rebase onto `main` should meet no conflict with #90 for now.

The first earlier question, about the shared option parser, was answered yes and built as decided. `cstack/src/commands/tracker-common.ts` now has a `TrackerValues<T>` type that gives `boolean` for a boolean option and `string` otherwise. The runtime body of `parseTrackerArgs()` did not change, so `tracker read`, `move` and `comment` behave as before. The conditional type reads `T[K]["type"]`, which is not a bare type parameter, so it does not distribute over a union, and an option typed `"string" | "boolean"` would fall to `string`. No caller declares such an option, so this has no effect today.

The second earlier question, about warnings for tickets left out because something is unknown, was answered yes with three cases and built with the exact lines of `## Decisions`. A ticket that has one known open blocker and one blocker of unknown state gets only the line for the unknown blocker. That follows the decided format, and the independent review recorded it as a judgment call.

The two points accepted by default were built too. The filter sits between `listGroup()` and the print. The test "adds no call, on each of the four trackers" (`cstack/test/tracker/tracker-list-ready.test.ts`, line 210) compares the recorded calls with and without `--ready`, instead of refusing every `orca` call.

The first point to watch is the trust in a closed blocker issue (`cstack/src/tracker/states.ts`, line 31). It was already raised before the plan, and it becomes real now that the coordinator will rely on `--ready` instead of the wave, which the ticket that removes the wave (#95) deletes. The second point is the gap between an agent starting and the `in progress` label being set. US-4 AC3 assigns that check to `orca reference find`, and the README now tells the reader to run it. The third point is that no test touched a real Jira or Linear connection, by the rule of this run. The Jira blockers come only from the footer line (`cstack/src/tracker/jira-orca.ts`, line 1, and `cstack/src/tracker/blockers.ts`, line 12), so a project without footers will list nothing and print one `unknown-blockers` line per open ticket. That is the decided behaviour, but its first real run is the moment to confirm it reads well.

The only change from the plan is the review fix commit `ab6360e`. It changes `tracker-common.ts`, `tracker-list.ts` and `README.md` together and carries no `Cstack-Unit` trailer. `cstack plan status` still shows the three units as done, so it does not block the publish. The README also says "worktree" where the plan said "workspace", after the conventions review. The test file has small style points that the independent review left as they are: one test title says "three lines" and expects four, and the "in review" case ends with an assertion on another list.

I checked the commit addresses of `origin/main..HEAD`, and all of them end in `@users.noreply.github.com`. I found no new question, blocking or not. I checked security and authorization (the keys printed in the warnings are validated by `checkedTracker()` first), the data model, scale and performance, operations and cost, reversibility and UX edge cases, and found nothing new there.

## Non-blocking questions

none

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

Title: feat(cli): add --ready to cstack tracker list

````markdown
## What this changes

`cstack tracker list` has a new option, `--ready`. With it, the command prints only the tickets that can start now. A ticket can start when it is open, nobody works on it, and all its blockers are finished. The output keeps the same format, and the command makes no extra call to the tracker.

When `--ready` leaves out a ticket because something is unknown, it prints one line on standard error and still exits with 0. The lines say that the state of the ticket is unknown, that its blockers are unknown, or that the state of one blocker is unknown. A ticket with several unknown blockers gets one line for each of them.

## Key decisions

The option uses the same ready rule as `cstack wave`, so both commands agree. The user agreed to two choices. First, the type of the shared option parser `parseTrackerArgs()` now also accepts an option without a value, and its runtime code did not change. Second, the warning lines exist, because without them an empty list on a Jira project without footers would have no explanation. The option does not check whether a ticket already has a worktree, because Orca answers that with `orca reference find`.

## Files touched

- `cstack/src/commands/tracker-list.ts` holds the option and the filter.
- `cstack/src/commands/tracker-common.ts` has the wider parser type.
- `cstack/src/manifest.ts` has the new usage line and flag.
- `cstack/test/tracker/tracker-list-ready.test.ts` is new, with 20 cases for the four trackers and the file input.
- `README.md` describes the option.

## Judgment calls from the independent review

- One review fix commit changes code and the README together, so it has no unit trailer. Splitting it would rewrite history, so it stays.
- A ticket with a known open blocker and also a blocker of unknown state gets only the unknown-blocker warning. The plan chose this format.
- The test file defines two small helpers twice, and two test titles are a little loose. These are style points that stay as they are.

## Checks

The type check passes and all 1730 tests pass. The plan file is `docs/plans/2026-11-23-94-add-ready-to-cstack-tracker-list.md`.

Fixes #94
````

## Documentation

- Comment on ticket #94: posted. It gives the new usage line, says the output format does not change, and gives the three warning lines. https://github.com/gambitl/claude-code-stack/issues/94
- Comment on the release ticket #104: posted, with the usage line and the three warning lines for the 0.4.0 release notes. https://github.com/gambitl/claude-code-stack/issues/104
- README: the paragraph on the cstack tracker commands in README.md describes --ready (committed on the branch).
- Architecture decision record: none, as the plan says. Specification page: none, as the plan says.

## Executor notes

- I ran `cstack helper wait` for the unit 1 helper before its sub-agent had returned. It exited with 1 and said the helper ended without an accepted report. I waited for the sub-agent notice and ran the wait again, and then it worked.

## Hand-off log

- 2026-11-23, executor run (build): moved '#94' to "in progress" with cstack tracker move. The work stays on the branch gambitl/tracker-list-ready.
- 2026-11-23, executor run (build to ready): built units 1 to 3, reviewed with four reviewers and fixed their findings, ran the independent review, documented #94 and #104, and drafted the pull request. Report: done.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

1. **May this ticket change the shared option parser in `cstack/src/commands/tracker-common.ts`?** `--ready` takes no value, and `parseTrackerArgs()` accepts only options with a value in its type. That file serves the four tracker commands, and it is outside the list of files that the brief gives this ticket. Parsing `tracker list` on its own would copy the shared parsing, which the comment at the top of the file wants in one place. I recommend widening the type only. The runtime code stays the same, and `tracker read`, `move` and `comment` behave as before.

2. **Should `--ready` say on standard error why it left a ticket out when something is unknown?** I recommend yes, and for one more case than the draft. On Jira and Linear, a blocker whose state cannot be read stays "unknown" without any warning. The ticket then looks blocked like any other ticket. On a Jira project, that can give an empty list with no reason at all. So I would print one line for a ticket whose state is unknown, one for unknown blockers, and one for a blocker whose state is unknown. The exit code stays 0, and standard output does not change.

**I will do this unless you say no.**

- `--ready` filters what `listGroup()` returns with the existing ready rule, without the worktree check. The output format stays the same, an empty list exits with 0, and the usage line gains `[--ready]`. Accepted by default (2026-11-23).
- The test that `--ready` checks no worktree compares the commands that the fake runner records with and without `--ready`. They must be the same. A simple "no `orca` call" test would fail on Jira and Linear, because they read through Orca. Accepted by default (2026-11-23).

**I checked it myself.**

- With Node 26.10, `--ready` works before or after `--milestone` and given twice, and `--ready=x` and `--no-ready` are refused, so both give exit 2.

**Good to know.**

- The rule trusts the closed state of the blocker issue. GitHub closes it only when a pull request with "Closes #n" merges into the default branch.
- A ticket whose agent has started, but whose `in progress` label is not set yet, is still listed. That is why the coordinator still asks Orca.

#### Details

The shared option parser is a blocking question, and only the user can answer it, because it changes the list of files that the brief fixes for this ticket. `parseTrackerArgs()` (`cstack/src/commands/tracker-common.ts`, lines 32 to 42) constrains its options to `{ type: "string" }` and types every value as `string`. I agree with the draft recommendation. The type parameter becomes `Record<string, { type: "string" } | { type: "boolean" }>`, and each value is typed from its own option, `boolean` for a boolean option and `string` otherwise. The call to Node's `parseArgs` does not change. I rejected two other ways. Parsing the options of `tracker list` alone in `tracker-list.ts` duplicates what the `WHY:` comment on line 1 of `tracker-common.ts` keeps in one place. Removing `--ready` from `args` before the shared parser runs would bypass `parseArgs`. It would then accept `--ready=x` silently and change how a value that starts with `--` is read. If nobody answers, the plan cannot touch `tracker-common.ts`, and the only clean way out is the duplicated parser.

The warning for tickets left out because something is unknown is a blocking question, and only the user can answer it, because it adds messages and their tests. I agree with the draft, and I widen it to a third case that the draft misses. On Jira, a footer blocker whose own read fails keeps the kind `unknown`, and the `catch` prints nothing (`cstack/src/tracker/jira-orca.ts`, lines 64 to 68). Linear does the same (`cstack/src/tracker/linear-orca.ts`, lines 57 to 62). A file from Claude can also write a blocker with `"stateKind": "unknown"` (`cstack/src/tracker/claude-file.ts`, lines 99 to 105). In those cases, `readyState()` returns `blocked` with reason `blocked-by` (`cstack/src/tracker/ready.ts`, lines 16 and 17), not `unknown-blockers`. So the draft's two messages would stay silent there. I recommend a third line, printed when the reason is `blocked-by` and at least one of the listed blockers has the kind `unknown` in `ticket.blockers`: `cstack: left out <key>, because the state of its blocker <blocker key> is unknown.` On GitHub and GitLab, the adapters already warn when a blocker lookup fails (`cstack/src/tracker/forge.ts`, line 49) or when the blockers become unknown (`cstack/src/tracker/github-gh.ts`, lines 79 and 91; `cstack/src/tracker/gitlab-glab.ts`, line 67). With `--ready`, the user then sees two lines for one ticket. The first line gives the cause, and the second says what the filter did. I accept that repetition, because the filter cannot tell which adapter already warned. If nobody answers, `--ready` stays silent, and on a Jira project without footers it prints an empty list with exit 0.

The filter and its place need no question. `--ready` applies `readyState(ticket, false)` to the result of `listGroup()`, between lines 34 and 35 of `cstack/src/commands/tracker-list.ts`. The format, the empty list with exit 0, the parsing of `--ready` and the new usage line all follow the lines of `## Decisions` marked "an assumption not asked". I agree with each of them. US-4 AC3 decides that the workspace check belongs to Orca, so I do not reopen it.

The line of `## Decisions` that says `--ready` runs no `git worktree list` and no `orca` command of its own is a "must not" rule. The retrospective of #86 says that such a rule needs its own test case. The trap is that the Jira and Linear adapters call `orca jira` and `orca linear` for the list itself. So a test that refuses every `orca` call would fail for a correct reason. The test should instead record the calls of the fake runner for one run with `--ready` and one run without it, and expect the same list in the same order. That proves that `--ready` adds no call, whatever the tracker.

I ran Node 26.10's `parseArgs` with `{ ready: { type: "boolean" } }` and `strict: true`. `--ready --milestone R2` and `--milestone R2 --ready` both give `ready: true`. Giving `--ready` twice gives `ready: true`. `--ready=x` throws `Option '--ready' does not take an argument`. `--no-ready` throws `Unknown option '--no-ready'`, because `allowNegative` is off by default. Both errors go through the `problem` branch of `parseTrackerArgs()`, so they become exit 2 with the usage line. `engines.node` in `cstack/package.json` is `>=26`, and six other commands already use boolean options, for example `cstack/src/commands/plan-status.ts`, line 29.

The ready rule trusts the closed state of each blocker issue on GitHub and GitLab (`cstack/src/tracker/states.ts`, line 31). GitHub closes an issue when a pull request that says "Closes #n" merges into the default branch. A pull request without that line, or one that merges into another branch, leaves the blocker open, so its dependents never appear with `--ready`. The opposite case is worse: an issue closed by hand before its pull request merges makes its dependents ready too early. In this repository, `cstack` cannot close an issue, because a move accepts only `in progress` and `in review` (`cstack/src/tracker/states.ts`, line 5). So only a person can close one early.

On GitHub and GitLab, the only sign that a ticket has started is the `in progress` or `in review` label (`cstack/src/tracker/states.ts`, lines 32 and 33). Between the moment an agent opens a workspace and the moment it sets the label, `--ready` still lists the ticket. The spec leaves that check to `orca reference find` (US-4 AC3), and this ticket keeps it that way.

I checked whether an epic issue could appear as ready inside a GitHub milestone, because it is open, has no label of work and has no blockers. In this repository, the two epics, #84 and #6, have no milestone, and the GitHub epic list reads only sub-issues (`cstack/src/tracker/github-gh.ts`, lines 130 to 145). So nothing applies here.

Two tickets depend on this code. The release ticket (#104) lists `--ready` among the changes of 0.4.0, and it needs nothing more than the option. The ticket that removes the wave (#95) deletes `cstack/src/wave/groups.ts`, the only other caller of `readyState()`. After it, every caller passes `false` as the second argument. A later cleanup could drop that argument, but this ticket keeps the signature, as `## Decisions` says.

I checked security and authorization, the data model, scale and performance, operations and cost, and reversibility, and found nothing. The option adds no tracker call, no stored data and no new dependency, and removing a command-line option later is cheap.

### Open questions and answers

- Blocking question 1, the shared option parser. Label: blocking, because it decides which files the branch changes, and the brief fixes that list. The user answered yes on 2026-11-23, as recommended. Recommended answer: widen the type of `parseTrackerArgs()` to accept `{ type: "boolean" }` options too, and type the values so that a boolean option gives `boolean | undefined`. The runtime code of the function does not change, and the three other tracker commands keep their behaviour. I checked that Node 26's `parseArgs` reads `--ready` before or after `--milestone`, and refuses `--ready=x` with `Option '--ready' does not take an argument`. Who answers: the user.
- Blocking question 2, the warning for tickets left out because something is unknown. Label: blocking, because it adds a message and its tests. The user answered yes on 2026-11-23, with the third case that the advisor added: a blocker whose own state is unknown. Recommended answer: yes. With `--ready` only, print on standard error `cstack: left out <key>, because its state is unknown.` for a ticket whose `readyState()` reason is `unknown-state`, and `cstack: left out <key>, because its blockers are unknown.` for the reason `unknown-blockers`. Print nothing for a ticket that is finished, started or blocked by a known open blocker, because those are the normal cases. The exit code stays 0. Who answers: the user.
- Answered without asking: the filter, its place, the empty list, the output format, the parsing of `--ready` and the new usage line. Each one is a line of `## Decisions` marked "an assumption not asked".

### Architecture options

No real choice remained, so no blueprint was drawn.
