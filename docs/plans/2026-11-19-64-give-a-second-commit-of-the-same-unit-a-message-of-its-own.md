# Plan: #64 — M3-11: Give a second commit of the same unit a message of its own

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/64
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/unit-commit-message
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T20:48:00+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** When one unit needs a second commit, that commit says what it changes, instead of repeating the message of the first one.

- **What the title means**: The `resolve-issue` skill builds a ticket in small steps called units. `cstack unit commit` commits the files of one unit, with the commit message that the plan gives to that unit. A unit sometimes needs a second commit, for example when an implementer skipped some tests and must add them.
- **Why we are doing it**: Today the second commit reuses the message of the first one. The history of the branch then shows two commits with the same subject, and a reviewer cannot tell what the second one changed. Three runs reported it: #26, #27 and #30.
- **For the user**: The history of a pull request reads clearly, one commit per change, each with its own subject.

**Goal.** This ticket makes `cstack unit commit` give a second commit of the same unit a message of its own.

### Where things are today (read first)

* **The commit command**: `cstack/src/commands/unit-commit.ts` → `commitUnit()` writes the message as the unit's `commitMessage` from the plan, then the trailer `Cstack-Unit: <n>` (around line 147). It does not look at earlier commits of the unit.
* **Finding a unit's commits**: `cstack/src/plan/commits.ts` → `listUnitCommits()` (line 20) groups the commits of the branch by their `Cstack-Unit` trailer. `checkUnit()` in the same command already calls it, to check the units this one depends on.
* **Who runs it**: `cstack/skills/resolve-issue/agents/implementer.md`, step 7, runs `cstack unit commit <n> --plan <plan file>`.
* **The usage line**: `cstack/src/manifest.ts` holds the usage line of each command, and `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts` check it.
* **The evidence**: `docs/retros/reviewed/2026-11-19-26.md`, `docs/retros/reviewed/2026-11-19-27.md` and `docs/retros/reviewed/2026-11-19-30.md`. The digest `docs/retros/reviewed/2026-11-19-digest.md` lists the subject under "Watching".
* **The tests**: `cstack/test/unit-commit.test.ts` builds a small git repository with a plan.

### Scope

1. Add a `--message <subject>` option to `cstack unit commit`. It replaces the subject of the plan for this commit only. The trailer `Cstack-Unit: <n>` and the attribution lines stay.
2. When the unit already has a commit on the branch and `--message` is missing, refuse with exit code `1` and commit nothing. The message says that this unit already has a commit, and asks for `--message` with a subject that says what this commit changes.
3. When `--message` gives the same subject as an earlier commit of the unit, refuse in the same way.
4. Update the usage line in `cstack/src/manifest.ts`, and add one sentence about `--message` to step 7 of `cstack/skills/resolve-issue/agents/implementer.md`.
5. The question round may choose an automatic subject instead, such as the plan's subject followed by "(follow-up 2)". If it does, drop items 1 to 4 and say why in `## Decisions`.

### Acceptance (TDD)

* `cstack/test/unit-commit.test.ts`: write first a case where unit 1 already has a commit and is committed again without `--message`. Expect exit code `1`, no new commit, and a message that names `--message`. See it fail on today's code, then pass.
* The same file: a second commit with `--message "fix: add the missing cases"` gets that subject, with the trailer `Cstack-Unit: 1`.
* The same file: a first commit without `--message` keeps the plan's subject, as today. A `--message` equal to an earlier subject of the unit is refused.
* `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts` pass with the new usage line.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none · Feeds: none

### Decisions already taken upstream

From the epic, issue #6 (https://github.com/gambitl/claude-code-stack/issues/6), section "Open questions and decisions", copied verbatim:

**Open questions.** Each question has a default that applies if nobody decides.

1. The minimum Orca version is not set. By default, it is the version installed when milestone 3 starts.
2. Some tracker clients cannot link two tickets. By default, Claude creates the missing links with its own connection.
3. The token target has no percentage. By default, the new version must use fewer tokens than the baseline, for each kind of token.
4. The comparison ticket is not chosen. By default, the maintainer picks it at the start of milestone 1.
5. The plan of a ticket splits the work into units, and each unit starts with a failing test. Some units have no test. By default, the plan marks such a unit "no test" and gives a reason.
6. The minimum Node version is not set. By default, it is the current long-term support release.
7. The watch interval of `cstack wave --watch` is not set. By default, it is five minutes. Each repository has a settings file that states the rules a run must follow there, and that file can change the interval.
8. The sandbox for the comparison runs does not exist yet. By default, it is a private GitHub repository that the maintainer approves at the start of milestone 1.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`. Each one is written by the ticket named on its line.

- ADR-SIC-A, how the helpers run, is to create. The design chose Orca workers when Orca is available and Claude Code sub-agents otherwise. Ticket #27 writes it.
- ADR-SIC-B, where the run state lives and how its format is versioned, is written in `docs/decisions/ADR-SIC-B-run-state.md`. The design chose both: the plan file keeps what people read and what must travel with the branch, and a run state under the common git folder keeps what only `cstack` needs. Ticket #13 wrote it.
- ADR-SIC-C, how `cstack` ships its skills, exists in `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 wrote it.
- ADR-SIC-D, the settings file and the models of the agents, exists in `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 wrote it.
- ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
- ADR-SIC-F, how `cstack` reaches trackers and forges, exists in `docs/decisions/ADR-SIC-F-tracker-access.md`. `cstack` never holds credentials. Ticket #24 wrote it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

ADRs that exist on `main` and that this ticket must respect:

- [ADR-SIC-A, how the helpers run](../decisions/ADR-SIC-A-helpers.md). Helpers run as Orca workers when Orca is available, and as Claude Code sub-agents otherwise.
- [ADR-SIC-B, where the run state lives and how its format is versioned](../decisions/ADR-SIC-B-run-state.md).
- [ADR-SIC-C, how cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md). `cstack` ships the skills and their guides, and serves them at its own version.
- [ADR-SIC-D, the settings file and the model of the review agent](../decisions/ADR-SIC-D-settings-file-and-review-model.md).
- [ADR-SIC-E, the new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final` and are never edited.
- [ADR-SIC-F, how cstack reaches trackers and forges](../decisions/ADR-SIC-F-tracker-access.md).
- [ADR-SIC-H, how a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md).

## Dependencies

clear

## Code mapping

**Entry point.** `cstack/src/commands/unit-commit.ts` holds the whole command. `unitCommit()` (line 163) parses the arguments with `parseArgs` from `node:util`, with `strict: true` and one option, `plan` (line 171). A parse error prints `cstack unit commit: <reason>` and the constant `UNIT_COMMIT_USAGE` (line 15), then returns 2. That constant reads `Usage: cstack unit commit <n> [--plan <file>]`. After the parse, the command finds the plan, reads the unit, reads the settings and takes the commit lock. Then `commitUnit()` (line 116) calls `checkUnit()` (line 54), which collects every broken rule in a list called `problems` before anything is staged. When the list is not empty, the command exits with 1 and prints every problem at once (line 119). Line 149 writes the message file: the unit's `commitMessage`, a blank line, `Cstack-Unit: <n>`, then the attribution lines of the settings with no blank line.

**Where the new rules fit.** `checkUnit()` already calls `listUnitCommits()` at line 63, and it keeps only the unit numbers that have a commit. The new refusals for a unit that already has a commit belong in the same `problems` list, so they come before any staging and are printed together with the other broken rules. `listUnitCommits()` in `cstack/src/plan/commits.ts` (line 20) returns the hashes of each unit's commits between the target branch and `HEAD`. It compares with the upstream of the target branch when there is one. It returns hashes only, so the earlier subjects need one more `git log --format=%s` call on those hashes. Git strips trailing spaces from a subject, so a comparison should trim both sides.

**The usage line and the flags list.** `cstack/src/manifest.ts` line 174 to 182 is the entry of `cstack unit commit`. Its usage is `cstack unit commit <n>`, and `planCommand()` (line 43) adds `--plan` to its `flags` list. Two kinds of tests read this entry. `cstack/test/cli.test.ts` (lines 213 to 232) and `cstack/test/manifest-implemented.test.ts` (around line 46) run the built command with an unknown flag and check that stderr contains `entry.usage`. Today the manifest usage is a prefix of `UNIT_COMMIT_USAGE`, so the check passes. The new usage must stay a substring of the printed line, for example `cstack unit commit <n> [--message <subject>]` in the manifest and `Usage: cstack unit commit <n> [--message <subject>] [--plan <file>]` in the command. `cstack/test/manifest.test.ts` (line 72) scans every mention of `cstack ...` in `cstack/skills/` and `cstack/guides/` with `matchMention()`. A mention with a flag that is not in the entry's `flags` list fails that test. So the sentence about `--message` in the implementer prompt needs `flags: ["--message"]` in the same manifest entry, next to the usage line.

**The prompt.** `cstack/skills/resolve-issue/agents/implementer.md` line 37 is step 7: "Run `cstack unit commit <n> --plan <plan file>`. It stages the files of the unit, commits them, and prints the commit hash." The new sentence about `--message` goes at the end of this step. Lines 45 to 49 list the refusals of `cstack unit commit` that the implementer knows. They are not in the scope, and #31 also edits this prompt. `cstack/skills/resolve-issue/agents/implementer-escalation.md` does not run `cstack unit commit` by name. No guide under `cstack/guides/resolve-issue/` names `cstack unit commit`.

**Test patterns.** `cstack/test/unit-commit.test.ts` builds a temporary git repository with `setup(units)` (line 43). The repository has a `main` branch with one commit and a `feature` branch with the plan in `plan.md`. `planText()` writes one unit per entry of `U`, and `message` sets the plan's commit message. The helper `commit(dir, n)` (line 61) calls `unitCommit([n, "--plan", "plan.md"], io, dir, wait)` and returns the code, stdout and stderr. A new case needs a variant that passes extra arguments such as `--message`. The first case (line 78) checks the full message with `git log -1 --format=%B` and the trailer with `%(trailers:key=Cstack-Unit,valueonly)`. A "No test" unit needs no saved run, so the new cases are simplest with `test` left out. To give a unit a second commit, the case commits once, writes the file again and commits again.

**Risks.** The file `unit-commit.ts` changed five times. One change was a fix (`faccd66`, stage only working-tree changes), and the others added rules. The test file and `unit-commit.ts` always change together, and the manifest changed with them once. Nothing else in `cstack/src/` reads the commit message of a unit except `cstack/src/plan/read.ts`, which parses the `Commit message` line. `README.md` line 67 describes `cstack unit commit <n>` and does not mention a second commit. Ticket #31 works in `README.md`, so a change there could meet #31 in a merge. `cstack/test/e2e/` of #31 may run `cstack unit commit` for real, and a second commit there would now need `--message`.

**Governing decisions.** ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`) says that a command prints through `io`, returns its exit code, and returns 2 for a usage error. The manifest's exit code 1 for this command is `REFUSED`, "Refused: a rule said no, and the message names it", which fits the new refusals with no change to the exit codes. ADR-SIC-C says that `cstack` serves its own skills, so the new sentence of the implementer prompt reaches runs only after the next release. The `WHY:` comments in `unit-commit.ts` (lines 17, 128 and 150) explain the lock place, the `git add` filter and `git commit --only`. The change must keep all three.

## Decisions

- `cstack unit commit` gets a `--message <subject>` option. It replaces the plan's subject for this commit only. The trailer `Cstack-Unit: <n>` and the attribution lines of the settings stay as they are today. (2026-11-19, the user's answer)
- When unit `<n>` already has a commit on the branch and `--message` is missing, `cstack unit commit` refuses with exit code `1` and commits nothing. When `--message` gives the same subject as an earlier commit of the unit, it refuses in the same way. The automatic subject that item 5 of the scope allowed is not built. (2026-11-19, the user's answer)
- The refusal message says that unit `<n>` already has a commit. It quotes each subject that the unit already used. It shows the command to copy, `cstack unit commit <n> --message "<subject>"`, and asks for a subject that says what this commit changes. The message must be enough on its own, because the executor prompt does not change in this ticket. (2026-11-19, accepted by default)
- `cstack unit commit` trims the spaces at both ends of the `--message` value before it writes the subject, not only before it compares it. (2026-11-19, accepted by default)
- Step 7 of `cstack/skills/resolve-issue/agents/implementer.md` gets at most two sentences and nothing else in that prompt changes. The first sentence says to add `--message "<subject>"` when the unit already has a commit, with a subject that says what this commit changes. The second says to run the command again with `--message` when it refuses because the unit already has a commit. (2026-11-19, accepted by default)
- `README.md` gets one sentence about `--message` at the end of its bullet on `cstack unit commit` (line 67), and nothing else in that file changes. (2026-11-19, accepted by default)
- `cstack unit commit` compares the subjects after it trims the spaces at both ends, and it ignores case. So `--message "Fix: Add X"` counts as the same subject as an earlier `fix: add x`. (2026-11-19, an assumption not asked)
- An empty `--message`, a `--message` made only of spaces, and a `--message` that holds a line break are usage errors. The command exits with `2`, prints its usage line and commits nothing. (2026-11-19, an assumption not asked)
- `--message` is also accepted on the first commit of a unit. It then replaces the plan's subject for that commit only. (2026-11-19, an assumption not asked)
- The earlier commits of a unit are the commits that `listUnitCommits()` finds between the target branch and `HEAD` with the trailer `Cstack-Unit: <n>`. A commit with two `Cstack-Unit` trailers counts for both units. (2026-11-19, an assumption not asked)
- The two new refusals join the list of broken rules that `checkUnit()` collects before staging. So the command still prints every broken rule at once and stages nothing when one of them applies. (2026-11-19, an assumption not asked)
- The mention test in `cstack/test/manifest.test.ts` (line 72) refuses a mention of `cstack unit commit ... --message` in a prompt when `--message` is not in the `flags` list of the manifest entry. So the entry of `cstack unit commit` in `cstack/src/manifest.ts` gets `flags: ["--message"]` next to its new usage line, and nothing else in that file changes. (2026-11-19, a tested answer: `matchMention()` in `cstack/src/manifest.ts` and the scan of `cstack/skills/` and `cstack/guides/` in `cstack/test/manifest.test.ts`)
- Give each behaviour and its test to the same unit. When an earlier unit already builds what a later unit's test checks, that test passes at once, and the later unit cannot prove that its test failed first. (2026-11-19, from the coordinator of the wave)
- Some tests check every command or every shipped skill: `cstack/test/cli.test.ts`, `cstack/test/manifest-implemented.test.ts` and `cstack/test/skills-install.test.ts`. When a unit adds or changes a command or a skill, read those tests, and put on the unit's `Files` line the files they make you change. (2026-11-19, from the coordinator of the wave)
- Copy each open non-blocking question of the question round under `## Non-blocking questions`, word for word, with who it is for. (2026-11-19, from the coordinator of the wave)
- When the coordinator sends a new message before the approval gate, write each rule or answer it gives into `## Decisions` too. (2026-11-19, from the coordinator of the wave)
- The executor never builds a unit itself, even one of a few lines. Each unit goes to an implementer, which runs `cstack unit red` and `cstack unit green`. (2026-11-19, from the coordinator of the wave)
- The executor writes each Hand-off log entry and each line of Executor notes only once. (2026-11-19, from the coordinator of the wave)
- Before `cstack unit red` has saved a failure, an implementer changes only test files and their fixtures. It writes no source code before that. It never moves code aside to get a failure. A new module that does not exist yet is a fine first failure. (2026-11-19, from the coordinator of the wave)
- An implementer writes a test case for each behaviour, exit code and message that the unit or a line of `## Decisions` asks for. (2026-11-19, from the coordinator of the wave)
- An implementer never runs `git add`, `git commit`, `git commit --amend` or `git stash`. The stash is shared by every worktree of this repository, so another run could take the changes. (2026-11-19, from the coordinator of the wave)
- Three other tickets of the wave run at the same time, each in its own worktree and with its own pull request. Ticket #63 changes `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts` and `cstack/src/unit-test-runs.ts`, and this branch never edits those four files. Ticket #65 changes `cstack/test/report.test.ts` and one sentence of `CLAUDE.md`. (2026-11-19, from the coordinator of the wave)
- Ticket #31 changes the guides, the agent prompts and other parts of `cstack/src/manifest.ts`. In `cstack/src/manifest.ts`, this branch changes only the usage line of `cstack unit commit`. In `cstack/skills/resolve-issue/agents/implementer.md`, keep the change to one or two sentences in step 7, so that the merge with #31 stays simple. (2026-11-19, from the coordinator of the wave)
- Ticket #31 adds end-to-end tests that may run `cstack unit commit`. Whoever merges second runs the tests of both branches. (2026-11-19, from the coordinator of the wave)
- Only #31 changes the version in `cstack/package.json` and `cstack/package-lock.json`, so this branch never changes it. Nobody pushes a tag, and never push a tag that starts with `v`. The coordinator pushes `v0.3.0` once the four pull requests are merged. (2026-11-19, from the coordinator of the wave)
- This run follows the implementer prompt and the guides of the installed `cstack` 0.2.0. This branch changes the source of the implementer prompt in `cstack/skills/resolve-issue/agents/implementer.md`. Keep following the installed prompt during this run, and never install the branch's version. (2026-11-19, from the coordinator of the wave)
- Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. Any of these would change the tool and the skill that every worker of this wave runs right now. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-19, from the coordinator of the wave)
- Every sentence added to a prompt or a document follows the documentation writing rules of the session. Put one idea in each sentence, and give each sentence a subject and a verb. Keep sentences under about 25 words, and never follow a colon or a dash with a fragment. (2026-11-19, from the coordinator of the wave)
- Never change `.cstack/settings.json` in this branch. The test commands come from that file on `main`, and the independent review refuses a branch that changes it, because the file names the reviewer. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`, so run `npm ci` in `cstack/` before the first type check or test run. The full `npm test` takes about 90 seconds, so give the shell call a timeout above two minutes. When only `cstack/test/report.test.ts` fails on a busy machine, run it alone before you look for a bug. (2026-11-19, from the coordinator of the wave, after `CLAUDE.md`)
- On macOS, an in-place edit with `sed` needs an empty suffix, as in `sed -i ''`. (2026-11-19, from the coordinator of the wave, after `CLAUDE.md`)
- Tests use fake programs, never the real `osascript`, `orca`, `gh` or `glab`. Run `git worktree add` only inside a temporary test repository. Never run real `orca orchestration` commands that start, message or release workers, never run `orca worktree create` or `orca worktree rm`, and never run `cstack wave` for real. (2026-11-19, from the coordinator of the wave)
- Never call a Jira or Linear connection, and never run `glab`. (2026-11-19, from the coordinator of the wave)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, report it to the user, and write it in the retrospective with the tag `[skill]`. (2026-11-19, from the coordinator of the wave)
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). Read them as the reference for the old behaviour, but never edit anything under `skills/`. (2026-11-19, from the coordinator of the wave)
- The stops of the skill are the blocked ticket, the question round, the approval gate of the plan and the questions after the build. Each stop goes to the user in the chat of the main conversation, and never to the coordinator. Nobody answers a stop in the user's place. (2026-11-19, from the coordinator of the wave)
- The conversation with the user is in French. Everything written in the repository and on GitHub stays in English. (2026-11-19, from the coordinator of the wave)
- Never merge the pull request. The user merges it. (2026-11-19, from the coordinator of the wave)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-19, from the coordinator of the wave, after `CLAUDE.md`)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives, or a path from this machine such as one that starts with `/Users/`. This covers files, commits, the pull request, ticket comments, the plan file and the retrospective. (2026-11-19, from the coordinator of the wave)
- The history of this repository was rewritten on 2026-11-18 to remove private names, so do not undo that work. Every commit carries the GitHub no-reply address that ends in `@users.noreply.github.com`, as author and as committer. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-19, from the coordinator of the wave)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. (2026-11-19, from the coordinator of the wave)
- After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, and keep both changes. Push it with a plain `git push`, without force. (2026-11-19, from the coordinator of the wave)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. In wave 7, one branch pushed a commit that still held conflict markers. (2026-11-19, from the coordinator of the wave)
- When you update the branch, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates in the plan file and in the commits. (2026-11-19, from the coordinator of the wave)
- GitHub is short of macOS runners at times. If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)

## Architecture

The change is small and the approach is locked: `cstack unit commit` parses a new `--message` option, and `checkUnit()` adds the two new refusals to its list of broken rules. No new decision since the question round.

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
- Worktree: <absolute path>, optional, written by cstack when a unit runs in a child worktree, never by a person
Free notes come after these lines.
Each unit commit carries the trailer "Cstack-Unit: <n>" in the final paragraph of its message, together with any other trailer such as Co-Authored-By. git does not read a trailer outside the final paragraph. A commit with two Cstack-Unit lines counts for both units. -->

### Unit 1: Ask for a subject of its own on a second commit of a unit
- Files: `cstack/src/commands/unit-commit.ts`, `cstack/src/manifest.ts`, `cstack/test/unit-commit.test.ts`
- Test: `cstack/test/unit-commit.test.ts`: write first a case where unit 1 already has a commit and is committed again without `--message`. It expects exit code `1`, no new commit, nothing staged, and a message that names `--message`. Add a case for each other behaviour of this unit, listed under "Minimum code". The new cases fail on today's code, because today a second commit succeeds and `--message` is an unknown option that exits with `2`. Only the case of a first commit without `--message` passes today, and it guards the old behaviour.
- Minimum code: In `unit-commit.ts`, add the option `message` of type string to `parseArgs`. An empty value, a value made only of spaces, and a value with a line break are usage errors: exit `2`, print the usage line, stage nothing. Trim the value at both ends, and write the trimmed value as the subject of the commit instead of the plan's `Commit message`. Keep the trailer `Cstack-Unit: <n>` and the attribution lines exactly as today. In `checkUnit()`, reuse the result of `listUnitCommits()` that line 63 already reads, and read the subjects of the unit's earlier commits with one `git log --no-walk --format=%s` call on their hashes. When the unit has an earlier commit and `--message` is missing, add a problem to the list. When the trimmed `--message` equals an earlier subject of the unit, compared after trimming and without case, add a problem too. Both problems say that unit `<n>` already has a commit, quote each earlier subject, and show `cstack unit commit <n> --message "<subject>"` with a subject that says what this commit changes. They join the other broken rules, so the command still prints every problem at once and stages nothing. A first commit without `--message` keeps the plan's subject, as today, and a first commit with `--message` uses that subject. Change `UNIT_COMMIT_USAGE` to `Usage: cstack unit commit <n> [--message <subject>] [--plan <file>]`. In `cstack/src/manifest.ts`, in the entry of `cstack unit commit` only, change the usage to `cstack unit commit <n> [--message <subject>]` and add `flags: ["--message"]`. The test cases to write are these. A second commit without `--message` is refused as above. A second commit with `--message "fix: add the missing cases"` gets that subject, with the trailer `Cstack-Unit: 1` as the last paragraph. A first commit without `--message` keeps the plan's subject. A first commit with `--message` uses it. A `--message` equal to an earlier subject of the unit is refused with exit `1`, also when it differs only in case or in spaces at both ends. A refusal quotes the earlier subject and shows the command with `--message`. A `--message` with spaces at both ends is written trimmed. An empty `--message`, a `--message` of spaces only, and a `--message` with a line break exit with `2` and stage nothing. A second commit without `--message` that also breaks another rule lists both problems in one message. The command list accepts a mention of `cstack unit commit 1 --message "x" --plan plan.md`, which `matchMention()` from `cstack/src/manifest.ts` checks, and the usage line printed for an unknown flag contains `[--message <subject>]`.
- Refactor: None, unless the helper `commit()` of the test file needs a parameter for extra arguments. Keep the three `WHY:` comments of `unit-commit.ts`.
- Commit message: `feat(cli): ask for a subject of its own on a second commit of the same unit`
- Depends on: none

### Unit 2: Tell the implementer and the README about --message
- Files: `cstack/skills/resolve-issue/agents/implementer.md`, `README.md`
- No test: prose only. The existing mention scan in `cstack/test/manifest.test.ts` (line 72) checks the new mention of `cstack unit commit ... --message` against the flags that unit 1 adds to the manifest.
- Minimum code: At the end of step 7 of `cstack/skills/resolve-issue/agents/implementer.md`, add at most two sentences and change nothing else in that prompt. The first sentence says that when the unit already has a commit, for example when you add tests that you skipped, you add `--message "<subject>"` with a subject that says what this commit changes. The second sentence says that when `cstack unit commit` refuses because the unit already has a commit, you run it again with `--message`. At the end of the bullet on `cstack unit commit` in `README.md` (line 67), add one sentence: when the unit already has a commit on the branch, the command asks for `--message` with a subject of its own, and it refuses a subject that the unit already used. Follow the documentation writing rules of the session for each sentence.
- Refactor: None.
- Commit message: `docs(skill): ask for --message on a second unit commit in the implementer prompt and the README`
- Depends on: 1

## Documentation duties

- The README: applies, written to the bullet on `cstack unit commit` in `README.md` by unit 2.
- The implementer prompt: applies, written to step 7 of `cstack/skills/resolve-issue/agents/implementer.md` by unit 2.
- The ticket comment: applies, written to issue #64 after the build.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. Its line on `cstack unit commit` stays true.
- An ADR: does not apply. A new option of one command is not an architecture decision.
- Dependent tickets: does not apply. The ticket feeds no other ticket, and the coordinator of the wave runs the tests of both branches when #31 or this ticket merges second.
- Security: no security surface, skip. The subject goes into the message file that git reads with `-F`, never through a shell, as today.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: An option or an automatic subject
When a unit already has a commit, should `cstack unit commit` ask for a subject with a new `--message` option and refuse without it, as items 1 to 4 of the scope say? Or should it write an automatic subject on its own, such as the plan's subject followed by "(follow-up 2)", as item 5 allows?
- For: the user
- Answer: the `--message` option with the refusal, as items 1 to 4 of the scope say. Item 5 is dropped. (the user's answer, 2026-11-19)

## Review log

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- When a unit already collected from a child worktree is relaunched in a new child worktree, should `cstack unit collect` bring its new commits back, instead of skipping the unit because the ticket branch already has a commit of it? For: the user. Raised before the plan, open, not needed for this ticket.

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

**For a second commit of the same unit, do we require a `--message` option, or does cstack write an automatic subject?** With an automatic subject such as "(follow-up 2)", the reviewer sees that a second commit exists, but not what it changes. That is exactly what the retrospectives of #27 and #30 complain about. The option makes the agent that writes the code choose a subject, and the command refuses without it. `--message` then becomes part of the public command line, so removing it later would break callers. I recommend the `--message` option with the refusal, as the ticket's scope says, because it is the only way the subject says what the commit changes.

**I will do this unless you say no**

- The sentence in step 7 of the implementer prompt will also cover the refusal: "if the command says the unit already has a commit, run it again with `--message`". The list of known refusals (lines 45 to 49) is off limits because of #31. Without that sentence, an implementer that meets this unknown refusal may report itself stuck. Accepted by default (2026-11-19).
- The refusal message will quote the subjects the unit already used and give the command to copy. The executor prompt belongs to #31 and will not change, so the message has to be enough on its own. Accepted by default (2026-11-19).
- I trim the spaces at both ends of the subject before writing it, not only before comparing it. Accepted by default (2026-11-19).
- I add one sentence about `--message` at the end of line 67 of `README.md`. A conflict with #31 would then touch one line only. Accepted by default (2026-11-19).

**I checked it myself**

- The test of command mentions refuses `--message` in a prompt until the manifest entry lists it under `flags`. So the entry needs `flags: ["--message"]` as well as the new usage line.
- The second-attempt implementer follows the implementer prompt, so the same sentence covers it. Review fixes carry no `Cstack-Unit` trailer, so the new refusal never reaches them.
- The other readers of unit commits (plan status, the end of the build, the reports) only check that at least one commit exists. Two commits do not bother them.

**Good to know**

- The case from #26 was a documentation commit made by hand, with no unit trailer. This ticket does not fix it, so the subject should stay under "Watching" in the digest.
- `cstack unit collect` skips a unit that already has a commit on the ticket branch. A second commit made in a separate worktree after the first collection would never be brought back. I read this in the code without running it, and it is outside this ticket.

#### Details

The choice between a `--message` option and an automatic subject is blocking, and only the user can answer it; no test settles it. I agree with the draft recommendation. The evidence supports the option. In #27, commits `2198154` and `df1c653` share the subject "feat(cli): check, save and send the report of a helper with cstack helper done". The second one only adds two lines to `cstack/test/helper/fallback.test.ts`. In #30, commits `e6b5b08` and `65ad759` share a subject in the same way. Each second commit changed something specific that an automatic suffix would not describe. The option adds a flag to the public command line of `cstack`, which is hard to take back once runs depend on it, so it belongs with the user. The refusal turns today's silent second commit into exit code `1`, which matches the existing `REFUSED` meaning of the manifest entry, so no exit code changes. If nobody decides, items 1 to 4 of the scope apply, because they are the ticket as written.

The sentence in step 7 of `cstack/skills/resolve-issue/agents/implementer.md` is non-blocking, and the default is to write it. The coordinator limits this branch to one or two sentences in step 7, so the refusal list at lines 45 to 49 cannot grow. Today an implementer that meets an unlisted refusal has no rule except "When to stop" (line 51 onwards), so it may report stuck instead of retrying. Two sentences fit the limit. The first one tells the implementer to add `--message "<subject>"` when the unit already has a commit, for example when it adds tests it skipped. The second one tells it to run the command again with `--message` when the command refuses for that reason. `cstack/skills/resolve-issue/agents/implementer-escalation.md` (line 12) tells the second attempt to follow `implementer.md`, so it inherits the sentence. The rejected alternative was a new bullet under "When a cstack command refuses", which would collide with #31.

The wording of the refusal message is non-blocking, and the default is to make it self-sufficient. `cstack/skills/resolve-issue/agents/executor.md` line 40 tells the executor to read a refusal, fix the cause and run the command again. That prompt belongs to #31 and stays as it is. So the message should say that unit `<n>` already has a commit, quote each earlier subject, and show `cstack unit commit <n> --message "<subject>"` with a subject that says what this commit changes. Retrospective #27 shows a second unit commit whose author is unclear, so any caller may meet this message.

Trimming the subject before writing it is non-blocking, with trimming as the default. The decision line on comparison trims both sides. Git with `-F` and the default cleanup removes trailing spaces but keeps leading spaces on the subject line, so an untrimmed `--message "  fix: x"` would produce a subject with leading spaces that compares equal to `fix: x` but reads differently in the log. Writing the trimmed value keeps what is stored and what is compared the same.

The sentence in `README.md` was drafted as non-blocking. I relabel it blocking, because its answer changes what the ticket writes, but it can be settled by the user's reply with no test, and the default is to write it. Line 67 is one long bullet, so any edit by #31 on that line conflicts with ours. The coordinator's rule says whoever merges second runs both test suites, and a one-line conflict is easy to resolve. Leaving the README silent would describe a command that now refuses a second commit with no word about why.

I checked the claim about the mention test against its evidence. `matchMention()` in `cstack/src/manifest.ts` (lines 312 to 335) returns `ok: false` for any flag of a mention that is not in `best.flags`. `planCommand()` (line 43) appends `--plan` to whatever `flags` the entry gives, so `flags: ["--message"]` yields `["--message", "--plan"]`. The usage line in the manifest must stay a substring of `UNIT_COMMIT_USAGE` for `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts`. The only copies of the usage line are `cstack/src/manifest.ts` line 176, `cstack/src/commands/unit-commit.ts` line 15, `README.md` line 67 and `implementer.md` line 37.

I checked the other callers and readers. `cstack/guides/resolve-issue/review.md` line 28 says review fixes carry no `Cstack-Unit` trailer, so they never run into the refusal. `listUnitCommits()` is read by `cstack/src/phases.ts` line 73, `cstack/src/commands/plan-status.ts` lines 40 to 53, `cstack/src/report/reports.ts` line 115, `cstack/src/commands/unit-order.ts`, `cstack/src/helper/start.ts` line 125 and `cstack/src/unit/collect.ts` line 85. Each one only tests whether a unit has at least one commit, so a unit with two commits behaves as today.

Retrospective #26 cites commits `c4db082` and `d6cc4c1`. Both have the same subject and no `Cstack-Unit` trailer, so they were made outside `cstack unit commit`. This ticket does not prevent that case. The digest item under "Watching" in `docs/retros/reviewed/2026-11-19-digest.md` should therefore not be closed as fully resolved by this ticket.

`cstack/src/unit/collect.ts` lines 85 to 89 skip a unit when the ticket branch already has a commit of it, before looking at the child worktree. If a unit is relaunched in a new child worktree after its first commit was collected, its second commit would stay on the child branch. I found this by reading, not by running it, and it predates this ticket. It is non-blocking for this ticket, and the question is for the user: "When a unit already collected from a child worktree is relaunched in a new child worktree, should `cstack unit collect` bring its new commits back, instead of skipping the unit because the ticket branch already has a commit of it?"

I did not reopen three locked decisions. The first one is the coordinator's file limits in `## Decisions`. The second one is the rule that whoever merges second runs the end-to-end tests of #31. The third one is ADR-SIC-C, so the new prompt sentence reaches runs only with the release `v0.3.0` that the coordinator pushes. Prompt and binary ship together at that version, so no run sees the refusal without the sentence. I checked security and authorization, data model lock-in, scale and performance, and operations and cost, and found nothing: the change adds one `git log` call on a handful of hashes and touches no credential, tenant or recurring cost.

### Open questions and answers

1. Blocking question 1, an option or an automatic subject. The user chose the `--message` option with the refusal on 2026-11-19. Recommended answer: the `--message` option, as items 1 to 4 of the scope say. An automatic subject such as "(follow-up 2)" tells the reviewer that a second commit exists, but not what it changes. The retrospectives of #26, #27 and #30 complain about exactly that. The option also costs the implementer only one sentence in step 7. For: the user.
2. Non-blocking. Should `README.md` (line 67) get one sentence about `--message` at the end of its bullet on `cstack unit commit`? Recommended answer: yes, one sentence at the end of that bullet. Without it, the README describes a command that refuses a second commit with no word about why. The brief of the wave does not list `README.md` among the files of this ticket, and #31 also works in `README.md`. A sentence at the end of one bullet keeps the risk of a merge conflict small. For: the user. Answer: yes, accepted by default on 2026-11-19, because the user's reply did not object.
3. Non-blocking, checked. The coordinator's brief says to change only the usage line of `cstack unit commit` in `cstack/src/manifest.ts`. The mention test in `cstack/test/manifest.test.ts` (line 72) also needs `--message` in the `flags` list of the same entry, or the new sentence in the implementer prompt fails it. I checked `matchMention()` in `cstack/src/manifest.ts` and the scan in `cstack/test/manifest.test.ts`. The answer is written in `## Decisions`. For: the user, to know.
4. Non-blocking, from the review before the plan. When a unit already collected from a child worktree is relaunched in a new child worktree, should `cstack unit collect` bring its new commits back, instead of skipping the unit because the ticket branch already has a commit of it? Open, not needed for this ticket. For: the user.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
