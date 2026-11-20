# Plan: #66 — M3-13: Bring back the new commits of a unit that runs a second time in a child worktree

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-20
Ticket: https://github.com/gambitl/claude-code-stack/issues/66
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/collect-second-attempt
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-20T09:11:16+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** When a unit runs a second time in its own folder, `cstack` brings its new commits back to the ticket branch, instead of leaving them behind without a word.

- **What the title means**: The `resolve-issue` skill builds a ticket in small steps called units. When several units run at the same time, each one works in its own copy of the repository, called a child worktree, on its own branch. `cstack unit collect` then copies the commits of each child branch onto the ticket branch. A unit sometimes runs a second time after that, for example to add test cases that a review found missing.
- **Why we are doing it**: Today `cstack unit collect` skips any unit that already has a commit on the ticket branch. So the commits of a second attempt never come back. The command only prints that the unit "was skipped", and then removes the clean child worktree. The pull request then lacks a change that the run believes it made, and nobody is told.
- **For the user**: Every change that a unit commits reaches the pull request, however many times the unit runs.

**Goal.** This ticket makes `cstack unit collect` apply the commits of a child branch that the ticket branch does not have yet, even when the unit already has a commit there. A second collect of the same commits still applies nothing.

### Where things are today (read first)

* **The skip**: `cstack/src/unit/collect.ts` → `applyInto()` (line 85) skips a unit when `listUnitCommits()` finds one of its commits on the ticket branch. It prints "Unit <n> was skipped: the ticket branch already has a commit of this unit". It also counts the unit as collected, so `cleanUp()` releases its worker and removes its clean child worktree. The child branch itself stays, so no commit is deleted.
* **Why the skip exists**: `applyInto()` lists the commits to apply with `git rev-list --reverse HEAD..refs/heads/<child>` (line 101). A cherry-pick gives each applied commit a new hash. So after a first collect, that list still holds the commits already applied. The skip stops a second collect from applying them twice.
* **The checks on each commit**: `commitProblem()` (line 28) refuses a commit without the trailer `Cstack-Unit: <n>`, or one that changes a file outside the unit's `Files` line. Keep these checks.
* **How a second attempt starts**: `cstack/src/helper/start.ts` starts a child worktree from the current commit of the ticket branch (lines 264 and 282). A second attempt can also reuse the existing child worktree with `--worktree path:<path>`. In the first case, the child branch holds only the new commits. In the second case, it holds the commits already applied and the new ones.
* **When it happens**: The worker of #64 found it while reading the code. No run has hit it yet. It becomes more likely with 0.3.0, because #31 makes the executor use child worktrees in every batch of more than one unit, and #64 makes a second commit of a unit normal.
* **The tests**: `cstack/test/unit/collect.test.ts` and `cstack/test/unit/collect-cleanup.test.ts` build a ticket branch and child branches in a temporary repository.

### Scope

1. List only the commits of the child branch whose change is not on the ticket branch yet. A suggested way is `git rev-list --reverse --no-merges --right-only --cherry-pick HEAD...refs/heads/<child>`, which compares the changes and not the hashes. The question round can choose another way, such as keeping the hashes already applied in the unit's record.
2. Remove the skip of line 85. A unit whose child branch has nothing new prints the existing message that the branch has no commit that the ticket branch lacks.
3. Keep the order of the units, the checks of `commitProblem()`, and the single cherry-pick call per unit.
4. `cleanUp()` removes a child worktree only after its new commits are applied, as today.

### Acceptance (TDD)

* `cstack/test/unit/collect.test.ts`: write first a case where unit 1 is collected, then gets a second commit on the same child branch. A second `cstack unit collect 1` applies that commit, and only that one. See it fail on today's code, then pass.
* The same file: the same case with a new child worktree that starts from the ticket branch after the first collect.
* The same file: running `cstack unit collect` twice with no new commit applies nothing the second time, and changes no commit of the ticket branch.
* The tests of `cstack/test/unit/collect-cleanup.test.ts` still pass. A child worktree whose new commits were not applied is never removed.
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

**Entry point.** The whole change sits in `cstack/src/unit/collect.ts`, in `applyInto()` (lines 60 to 131). The command file `cstack/src/commands/unit-collect.ts` only parses the arguments and calls `collectUnits()`, so it does not change. The usage line in `cstack/src/manifest.ts` (line 275) and the exit codes do not change either.

**The loop of `applyInto()`, in order.** For each unit number, sorted and without duplicates, the loop does these steps. First it reads the latest helper record of the unit with `latestUnitRecord()`. When that record has no child worktree, it skips the unit. Then comes the skip of line 85: when `listUnitCommits()` finds a commit of the unit on the ticket branch, it adds the unit to `touched` as collected and skips it. Then it reads the latest report of that helper with `latestUnitReport(where, number, record.id)`. Without a report, it skips the unit. With a report, it adds the unit to `touched` as not collected. A stuck report is skipped. Then line 101 lists the commits with `git rev-list --reverse HEAD..refs/heads/<child> --`. An empty list prints "Unit <n> was skipped: the branch "<child>" has no commit that the ticket branch lacks." Each listed commit goes through `commitProblem()` (line 28). All the commits of the unit go into one `git cherry-pick` call (line 118). When the cherry-pick stops, the loop aborts it and returns 1. On success, line 127 marks the unit as collected.

**How `touched` drives the clean-up.** `cleanUp()` (line 147) runs only when the command gets an Orca runner. For each unit in `touched`, it releases every worker whose record points at the latest child worktree. Then, only for a unit marked as collected, and only when the latest record has no `collectedAt`, it removes the child worktree when it is clean. A unit that is not in `touched` gets no release and no removal.

**A second effect of the skip of line 85.** The skip runs before the report check. So when a second attempt of a unit is still running in a new child worktree, a collect marks the unit as collected. With Orca, `cleanUp()` then releases the running worker and removes its clean child worktree, before any of its commits is applied. The child branch stays, so no commit is lost. Removing the skip, and keeping the report check first, fixes this too.

**The empty list after a first collect.** Today, a second collect of a unit whose child branch has nothing new reaches the skip of line 85, so the unit counts as collected. The test "finishes the clean-up on a second run without applying anything again" in `cstack/test/unit/collect-cleanup.test.ts` (line 115) relies on it. The first collect applies the commit, but the fake Orca refuses to remove the worktree. The second collect must then remove it, with `worktree rm` as its only Orca call. Once the skip goes, an empty list must still count as collected in that case, or this test fails. Today, an empty list on a unit with no commit on the ticket branch counts as not collected, so its worktree is kept.

**What `git rev-list --cherry-pick` does.** Tested by hand on 2026-11-20 with git 2.55 in a temporary repository. `git rev-list --reverse --no-merges --right-only --cherry-pick HEAD...refs/heads/<child> --` compares the change of each commit, through its patch id, instead of its hash. After a first collect, it lists nothing for the same child branch. With a new commit on the same child branch, it lists only the new commit. With a new child branch that starts from the ticket branch after the first collect, it lists only the new commit. One limit showed up. When another commit of the ticket branch changes lines near the unit's change in the same file before the first collect, the copy gets another patch id. A second collect then lists the old commit again, and its cherry-pick becomes empty, so git stops and the collect aborts with exit 1. Nothing is lost. Two units that share a file cannot run in child worktrees at the same time (`checkChildStart()` in `cstack/src/helper/start.ts`, line 155), so this needs a commit made on the ticket branch outside the units, close to the same lines.

**How a second attempt starts today.** `cstack helper start` in `cstack/src/helper/start.ts` reuses the existing child worktree only when the latest record of the unit has a worktree without `collectedAt` (line 199). Only the escalation helper does that. A plain implementer gets a refusal there, which says to run `cstack unit collect` first (line 202). A new child worktree needs a unit of the first batch of `cstack unit order`. A unit that already has a commit on the ticket branch is not in that batch (line 152, "it already has a commit"). So today `cstack helper start` cannot start a second attempt of a collected unit in a new child worktree. The tests of this ticket build that case by hand, as the ticket asks.

**Test patterns.** `cstack/test/unit/collect.test.ts` builds a temporary repository with `makeRepo()` from `cstack/test/helpers/plan-repo.ts`. It switches to the ticket branch `gambitl/units`, commits a plan with three units (`src/a.ts`, `src/b.ts`, `src/c.ts`), and adds one child worktree per unit with `git worktree add -b child-<n>`. `helped()` (line 53) writes a helper record with the child worktree and a report. `commitFiles(dir, files, unit)` commits with `git` directly, with the trailer `Cstack-Unit: <n>`, so the `--message` of `cstack unit commit` from pull request #67 does not matter here. `run()` calls `unitCollect()` without Orca, so it applies the commits and does no clean-up. `subjects()` lists the subjects of `main..HEAD`. `cstack/test/unit/collect-cleanup.test.ts` uses the same pattern with two units (`src/1.ts`, `src/2.ts`), a `dispatchId` on each record, and a fake Orca runner that records its calls. Its `collectAll()` passes the fake runner. No test calls the real `orca`. `makeHelperId()` builds the id from the time in milliseconds. A second record of the same unit in the same test needs a later time, or it gets the same id.

**The guard test.** `cstack/test/unit/collect.test.ts` (line 167) refuses the words "push", "reset" and "--force" anywhere in `cstack/src/unit/collect.ts`, comments included.

**Other callers.** `listUnitCommits()` from `cstack/src/plan/commits.ts` has other callers: `plan-status.ts`, `unit-commit.ts`, `unit-order.ts`, `helper/start.ts`, `report/reports.ts` and `run-progress.ts`. This ticket does not change it.

**History of the file.** `git log` shows four commits on `cstack/src/unit/collect.ts`: the first collect (032d1ed), the clean-up (8b9be91), the shared reading of records (343f4ea) and the restore of the plan file in the child (ba6d6a8). Two of them are fixes. The file changes together with `cstack/test/unit/collect-cleanup.test.ts` and `cstack/src/commands/unit-collect.ts`.

**Governing decisions.** The `WHY:` comment above `applyUnits()` (line 46) says that the commits come back with `git cherry-pick`, one call per unit, in plan order, and that the hashes change on the way. The `WHY:` comment above `cleanUp()` (line 145) says that the child branch always stays and that no force is used. ADR-SIC-B (`docs/decisions/ADR-SIC-B-run-state.md`) puts the helper records under the common git folder, so a child worktree and the ticket worktree share them. ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`) says how a command starts and ends.

**Documentation.** `README.md` (line 68) says that running `cstack unit collect` twice is safe. That stays true. No guide under `cstack/guides/` and no prompt under `cstack/skills/` names the skip message.

## Decisions

- The executor never builds a unit itself, even one of a few lines. Each unit goes to an implementer, which runs `cstack unit red` and `cstack unit green`. (2026-11-19, from the coordinator of the wave)
- The executor writes each Hand-off log entry and each line of Executor notes only once. (2026-11-19, from the coordinator of the wave)
- Before `cstack unit red` has saved a failure, an implementer changes only test files and their fixtures. It writes no source code before that. It never moves code aside to get a failure. A new module that does not exist yet is a fine first failure. (2026-11-19, from the coordinator of the wave)
- An implementer writes a test case for each behaviour, exit code and message that the unit or a line of `## Decisions` asks for. (2026-11-19, from the coordinator of the wave)
- An implementer never runs `git add`, `git commit`, `git commit --amend` or `git stash`. The stash is shared by every worktree of this repository, so another run could take the changes. (2026-11-19, from the coordinator of the wave)
- Four other tickets of the wave run at the same time, each in its own worktree. Ticket #64 is pull request #67. It adds `--message` to `cstack unit commit`, and once it merges, a second commit of the same unit needs `--message`. If a test of this ticket makes a second commit of a unit with `cstack unit commit`, it passes `--message`. A test that commits with `git` directly is not affected. (2026-11-19, from the coordinator of the wave)
- Ticket #63 is pull request #68 and changes `cstack unit red` and `cstack unit green`. Ticket #65 changes `cstack/test/report.test.ts` and one sentence of `CLAUDE.md`. This ticket changes none of those files. (2026-11-19, from the coordinator of the wave)
- Pull requests #67 and #68 both change lines of `README.md` in the list of `cstack unit` commands. Do not change `README.md` unless the change needs it. If it does, change only the line of `cstack unit collect`. (2026-11-19, from the coordinator of the wave)
- Change `cstack/src/manifest.ts` only if the usage line or the exit codes of `cstack unit collect` change. (2026-11-19, from the coordinator of the wave)
- Ticket #31 adds end-to-end tests that run `cstack unit collect`, and it changes the guides and prompts that call it. This ticket changes no guide under `cstack/guides/` and no prompt under `cstack/skills/`. Whoever merges second runs the tests of both branches. (2026-11-19, from the coordinator of the wave)
- `cleanUp()` releases workers and removes worktrees through Orca. The tests give it a fake runner. Never let a test call the real `orca`. Build the ticket branch and the child branches in a temporary repository, as `cstack/test/unit/collect.test.ts` already does. (2026-11-19, from the coordinator of the wave)
- Tests use fake programs, never the real `osascript`, `orca`, `gh` or `glab`. Never run real `orca orchestration` commands that start, message or release workers, and never run `orca worktree create` or `orca worktree rm`. Never run `cstack wave` or `cstack wave --watch` for real. Run `git worktree add` only inside a temporary test repository. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`. Run `npm ci` in `cstack/` before the first type check or test run. (2026-11-19, from the coordinator of the wave)
- The full `npm test` takes about 90 seconds. Give the shell call a timeout above two minutes, or run it in the background. When only `cstack/test/report.test.ts` fails on its five-second timeout, run that file alone before you look for a bug. (2026-11-19, from the coordinator of the wave)
- A command prints through the `io` argument of `run` and returns its exit code. No code calls `process.exit()`. Set `process.exitCode` instead. (2026-11-19, from the coordinator of the wave)
- On macOS, `sed -i` needs an empty argument, as in `sed -i ''`. (2026-11-19, from the coordinator of the wave)
- This run follows the installed `cstack` 0.2.0 and its skill. This branch changes the source of `cstack`, not that global command. Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-19, from the coordinator of the wave)
- Never change `.cstack/settings.json` in this branch. The test commands come from that file on `main`, and the independent review refuses a branch that changes it, because the file names the reviewer. (2026-11-19, from the coordinator of the wave)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, report it to the user, and write it in the retrospective with the tag `[skill]`. (2026-11-19, from the coordinator of the wave)
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). Read them as the reference for the old behaviour, but never edit anything under `skills/`. (2026-11-19, from the coordinator of the wave)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, keep both changes, and push it with a plain `git push`, without force. (2026-11-19, from the coordinator of the wave)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. In wave 7, one branch pushed a commit that still held conflict markers. (2026-11-19, from the coordinator of the wave)
- When you update the branch, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates in the plan file and in the commits. Never push a tag that starts with `v`. (2026-11-19, from the coordinator of the wave)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives, or a path from this machine such as one that starts with `/Users/`. This covers files, commits, the pull request, ticket comments, the plan file and the retrospective. (2026-11-19, from the coordinator of the wave)
- The history of this repository was rewritten on 2026-11-18 to remove private names, so do not undo that work. Every commit carries the GitHub no-reply address that ends in `@users.noreply.github.com`, as author and as committer. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-19, from the coordinator of the wave)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-19, from the coordinator of the wave)
- The stops of the skill are the blocked ticket, the question round, the approval gate of the plan and the questions after the build. Each stop goes to the user in the chat of the main conversation, and never to the coordinator. Nobody answers a stop in the user's place. The conversation with the user is in French, and everything written in the repository and on GitHub stays in English. (2026-11-19, from the coordinator of the wave)
- Never merge the pull request, because the user merges it. Never read, run or change anything under `~/comparison/`, which holds private work data. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-19, from the coordinator of the wave)
- Remove the skip of `applyInto()` at line 85 of `cstack/src/unit/collect.ts`, and its message "the ticket branch already has a commit of this unit". The check of the report of the latest helper keeps its place, before the listing of the commits. So a second attempt that has not reported yet is skipped with "its helper has not reported", its worker is not released and its child worktree is not removed. (2026-11-20, assumption not asked)
- When the child branch has no commit that the ticket branch lacks, the unit counts as collected only when the ticket branch already has a commit of this unit, as `listUnitCommits()` finds it. Then `cleanUp()` removes the clean child worktree, as today. When the ticket branch has no commit of the unit, the unit counts as not collected and its worktree stays, as today. (2026-11-20, assumption not asked)
- Write a test case in `cstack/test/unit/collect-cleanup.test.ts` for a second attempt in a new child worktree that has not reported yet: the collect applies nothing, releases no worker and removes no worktree. (2026-11-20, assumption not asked)
- Update the `WHY:` comment above `applyUnits()` in `cstack/src/unit/collect.ts`. It says how the collect finds the commits that the ticket branch lacks, and why a list by hash is not enough after a first collect. Never write the words "push", "reset" or "--force" in that file, because a test refuses them, comments included. (2026-11-20, assumption not asked)
- `README.md` does not change. Its line about `cstack unit collect` says that running it twice is safe, and that stays true. (2026-11-20, assumption not asked)
- The tests make the commits of a child branch with `commitFiles()` from `cstack/test/helpers/plan-repo.ts`, which commits with `git` directly. A second helper record of the same unit in one test gets its id from `makeHelperId(role, unit, <a later date>)`, because the id is built from the time in milliseconds. (2026-11-20, assumption not asked)
- `applyInto()` lists the commits of the child branch in two ways. The first list goes by hash, with `git rev-list --reverse HEAD..refs/heads/<child> --`, as today. The second list goes by content, with `git rev-list --reverse --right-only --cherry-pick HEAD...refs/heads/<child> --`. It leaves out every commit whose change is already on the ticket branch. The collect applies only the commits of the second list, in its order, after the checks of `commitProblem()`, with one cherry-pick call per unit. (2026-11-20, the user's answer)
- The guard: the commits that the second list leaves out must all come at the start of the first list. When a left-out commit comes after a commit that the second list keeps, the collect applies nothing for that unit and exits with 1, before any cherry-pick. The message names the unit and the short hash of that left-out commit, and says that nothing was applied. This case happens when a second attempt removes a line and then puts it back exactly as before. Without the guard, only the removal would come back, with exit 0. (2026-11-20, the user's answer)
- The listing by content does not use `--no-merges`. A merge commit on a child branch then stays in the list, and the checks or the cherry-pick refuse it loudly, as today. (2026-11-20, accepted by default)
- In the tests, the copy of a collected commit must get a hash different from the original. When the child branch forks from the ticket branch and the collect runs on the same parent within the same second, `git cherry-pick` recreates the same commit with the same hash, and the case proves nothing. So put a commit on the ticket branch between the fork of the child and the first collect, or collect another unit first. Then assert that the hash of the copy differs from the hash of the original. (2026-11-20, accepted by default)
- Write a test case in `cstack/test/unit/collect.test.ts` for the guard. After a first collect, the same child branch gets a commit that removes a line, then a commit that puts it back exactly as before. The second collect exits with 1, applies nothing, leaves the ticket branch where it was, and names the commit that puts the line back. (2026-11-20, the user's answer)
- This ticket does not change `cstack helper start`. It still refuses to start a second attempt of a collected unit in a new child worktree. The tests build that case by hand. (2026-11-20, accepted by default)

## Architecture

The approach is locked by the question round, and the change is small. `applyInto()` in `cstack/src/unit/collect.ts` keeps its loop, its checks and its single cherry-pick call per unit. Only the way it lists the commits of a child branch changes. It lists them by content, so the commits already copied onto the ticket branch drop out, and a guard refuses the one case where that comparison could lose a change. The skip of line 85 goes away. No security surface, skip: the change reads no external input, touches no endpoint and no database.

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

### Unit 1: List the new commits of a child branch by content
- Files: `cstack/src/unit/collect.ts`, `cstack/test/unit/collect.test.ts`, `cstack/test/unit/collect-cleanup.test.ts`
- Test: `cstack/test/unit/collect.test.ts`: unit 1 is collected, then gets a second commit on the same child branch, and a second `cstack unit collect 1` applies that commit and only that one.
- Minimum code: In `applyInto()`, remove the skip of line 85 and its message. Keep the record check, the report check and the stuck check in their order. Replace the list of line 101 with `git rev-list --reverse --right-only --cherry-pick HEAD...refs/heads/<child> --`. When that list is empty, print the existing message that the branch has no commit that the ticket branch lacks. Count the unit as collected then only when `listUnitCommits()` finds a commit of the unit on the ticket branch. Rewrite the `WHY:` comment above `applyUnits()` so that it says the list compares changes, because a cherry-pick gives each copy a new hash.
- Refactor: None.
- Commit message: fix(cli): bring back the new commits of a unit that runs a second time
- Depends on: none

Write these cases before `cstack unit red`, and see the first three new ones fail on today's code. In every case where a commit is collected, make sure its copy gets a hash different from the original, and assert it. Put a commit on the ticket branch between the fork of the child and the first collect, or collect another unit first.

1. In `cstack/test/unit/collect.test.ts`, the same child branch: unit 1 is collected. Its child branch gets a second commit, and a second helper record of unit 1 points at the same child worktree, with a `done` report. The second collect exits with 0, adds exactly one commit to the ticket branch, and the file of that commit holds the content of the child.
2. The same file, a new child worktree: after the first collect, a new child worktree starts from the ticket branch on a new branch, gets one commit, and a new helper record points at it, with a `done` report. The second collect exits with 0 and adds exactly one commit.
3. The same file, the existing case "does not apply a unit again when the ticket branch already has its commit": a second collect with no new commit exits with 0. The commits of the ticket branch, listed with `git rev-list main..HEAD`, do not change. The output names the branch that has no commit that the ticket branch lacks. It never says "the ticket branch already has a commit of this unit".
4. In `cstack/test/unit/collect-cleanup.test.ts`, a second attempt that has not reported: unit 1 is collected and cleaned up with the fake Orca runner. A new child worktree then gets a commit, and a new helper record points at it with its own dispatch id and no report. A collect exits with 0, applies nothing, says that its helper has not reported, and the fake runner gets no `worker-release` for the new dispatch id and no `worktree rm`.
5. The existing cases of `cstack/test/unit/collect-cleanup.test.ts` still pass, including "finishes the clean-up on a second run without applying anything again".

### Unit 2: Refuse a collect that would leave out a change after a new commit
- Files: `cstack/src/unit/collect.ts`, `cstack/test/unit/collect.test.ts`
- Test: `cstack/test/unit/collect.test.ts`: after a first collect, the same child branch gets a commit that removes a line and then a commit that puts it back exactly as before, and the second collect exits with 1, applies nothing and names the commit that puts the line back.
- Minimum code: In `applyInto()`, also list the commits of the child branch by hash, with `git rev-list --reverse HEAD..refs/heads/<child> --`. The commits of that list that the list by content leaves out must all come at its start. When one of them comes after a commit that the list by content keeps, write to stderr that nothing was applied for the unit, with the unit number and the short hash of that commit, and return 1 before `commitProblem()` and before any cherry-pick. Add one sentence about the guard to the `WHY:` comment above `applyUnits()`.
- Refactor: None.
- Commit message: fix(cli): refuse a collect that would leave out a change after a new commit
- Depends on: 1

The case also checks that the ticket branch stays where it was, with `git rev-parse HEAD`. Make the removal and the putting back with `git` directly in the child worktree, each with the trailer `Cstack-Unit: 1`, because `commitFiles()` writes random content. As in unit 1, make sure the copy of the first commit gets a hash different from the original.

## Documentation duties

- Code comment: applies, written to the `WHY:` comment above `applyUnits()` in `cstack/src/unit/collect.ts` by units 1 and 2.
- Ticket comment: applies, written to #66 when the pull request is ready.
- Dependent tickets: does not apply. The ticket feeds no other ticket.
- `README.md`: does not apply. Its line about `cstack unit collect` stays true.
- Specification page `docs/projects/skills-into-cli.md`: does not apply. It does not describe how the collect lists the commits.
- Architecture decision record: does not apply. The choice is local to `cstack unit collect`, and the `WHY:` comment records it.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: How the collect finds the new commits
`cstack unit collect` must apply only the commits of a child branch whose change is not on the ticket branch yet. Should it find them by comparing changes with `git rev-list --reverse --no-merges --right-only --cherry-pick HEAD...refs/heads/<child>`, as the ticket suggests, or by keeping the hashes of the commits it already applied in the helper record of the unit?
- For: the user
- Answer: compare the changes with `git rev-list --cherry-pick`, and add the guard that the CTO advisor proposed. The commits that the comparison by content leaves out must all come first on the child branch. When one of them comes after a commit that is kept, the collect refuses with exit 1 before any cherry-pick and names that commit. (the user's answer, 2026-11-20)

## Review log

Impact notes. The only symbol that changed is `applyInto()` in `cstack/src/unit/collect.ts`. Its one caller is `applyUnits()`. `listUnitCommits()` is unchanged, and its other callers are not affected. The tests that exercise the change are `cstack/test/unit/collect.test.ts` and `cstack/test/unit/collect-cleanup.test.ts`. The old skip message now appears only in a test that asserts it is gone, and in older plan files, which are history. The files that usually change with `collect.ts` are its two test files and `cstack/src/commands/unit-collect.ts`, which needs no change.

Correctness reviewer: no finding at high confidence. Three small observations. A commit made on the ticket branch near the unit's lines before the first collect can make a plain second collect exit with 1, which the plan already accepts as a known limit and which loses nothing. A child branch deleted by hand now makes a second collect exit with 1. The guard runs after the `commitProblem()` checks, not before, so with two problems at once the user sees the trailer message first. Judgment call: none of the three is fixed, because they are accepted limits or cosmetic.

Security reviewer: no finding. Git runs without a shell, the range arguments start with `HEAD`, nothing pushes or forces. One older point, outside this ticket: the branch name in the helper record is not checked with `isBranchName`.

Conventions reviewer: no finding.

Simplicity reviewer: no finding.

Fix: one commit splits an over-long `WHY:` comment line that the unit 1 edit had glued to the next sentence.

Independent review (pr-reviewer). It added one test, in commit ec6ae3d, for the acceptance line that a child worktree whose new commits were not applied is never removed: a second attempt whose new commit the collect refuses keeps its worktree. It checked the five acceptance cases, saw every new case fail on the old code, and saw the full tests and the type check pass. A temporary merge with the current `main` had no conflict. Judgment calls for the pull request body: the guard runs after `commitProblem()` and not before, with the same exit code and the same result, so only the first message differs. Units 1 and 2 share one commit with two `Cstack-Unit` trailers. After a rebase of the ticket branch in which a commit was changed to solve a conflict, a second collect stops with exit 1 instead of skipping, and nothing is lost. A second collect of a unit whose child branch was deleted by hand now exits with 1.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

<phase after-build-questions: the questions raised by the reviews or the briefing that do not stop the pull request, word for word, each with who it is for, or "none". They go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them.>

- Should a later ticket let `cstack helper start` start a second attempt of a collected unit in a new child worktree? Today it refuses, because a unit with a commit on the ticket branch is not in the first batch of `cstack unit order` (`cstack/src/helper/start.ts`, line 152). For: the user. From the question round, open, not needed for this ticket.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

The implementer of unit 1 also built the guard of unit 2, because a line of Decisions asked for it. Unit 2 then had nothing left to write and no red run could be saved. I added the trailer `Cstack-Unit: 2` to the commit of unit 1 (amended before any push), as the plan allows for a commit that counts for two units. After the rebase onto `main`, the first full `npm test` showed one failed test (I had cut its output, so I do not know which). A second full run passed with 1350 tests, so I treated it as a load timeout.

## Hand-off log

- 2026-11-20: build phase. Added the label `in progress` to ticket 66. Committed the plan file. Unit 1 and unit 2 are both in commit d4ebe3c. The run continues with the next phases.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**How should `cstack unit collect` recognise the commits it already applied: by their content (the patch id of git) with a guard, or by hashes kept in the helper record?** I recommend the comparison by content with `git rev-list --cherry-pick`, but not on its own. I reproduced a case where it loses a change without a word. A second attempt in the same child worktree removes a line, then puts it back exactly as before. That second commit has the same content as the copy already applied, so git leaves it out. Only the removal is applied, the command exits with 0, and the line is gone from the ticket branch. That is the very silence this ticket wants to remove. The guard is simple, because the commits already applied always come first on the child branch. When a commit that git left out comes after a new one, the command refuses with exit 1 and says why. My recommendation is the comparison by content plus this guard. It changes no record format, and it also works for copies made by `cstack` 0.2.0, which kept no hashes.

**I will do this unless you say no**

- In the tests, I make sure the copy gets a hash different from the original, and I check it. Otherwise, within the same second, `git cherry-pick` recreates the exact same commit, and the test passes even without the comparison by content, depending on the clock.
- I leave out `--no-merges` from the suggested command. With it, a merge commit on a child branch would be dropped silently, while today it makes the collect fail loudly.
- I do not change `cstack helper start`, which still refuses a second attempt of a collected unit in a new child worktree. The tests build that case by hand, and the ticket that wires child worktrees into the executor (#31) will show whether a run needs it.

**I checked it myself**

- The silent loss above happens with git 2.55 in a temporary repository: exit 0, and the line is lost.
- No test, guide or prompt on any branch quotes the message "the ticket branch already has a commit of this unit", and no branch in progress changes the collect files or their tests.

**Good to know**

- The known limit, where an old commit is listed again and its cherry-pick becomes empty, stays loud. It only concerns a reused child worktree, because a new one starts from the ticket branch and has nothing to compare.
- Nothing stored changes, so reverting the commit is enough to roll back.

#### Details

The question of how the collect recognises the commits it already applied is blocking, and only the user can answer it. A test cannot make the choice, but a test showed the risk. I agree with the draft recommendation to compare by content, and I add a guard. On 2026-11-20, with git 2.55, I built a temporary repository with a base commit, a child branch with a commit "add X" carrying `Cstack-Unit: 1`, and a ticket branch with one more commit, so that the cherry-pick gives a new hash. After the cherry-pick, `git rev-list --reverse --no-merges --right-only --cherry-pick HEAD...child --` listed nothing, as expected. Then the child branch got "remove X" and "add X again", both with the trailer. The same command listed only "remove X", because git marks every commit of the other side whose patch id matches, not only one. Its cherry-pick exited with 0 and the file on the ticket branch no longer held X. The guard that I recommend compares two lists of the child branch. The first is `git rev-list --reverse HEAD..refs/heads/<child> --`, which lists by hash. The second is the comparison by content. The commits that the second list leaves out must form the start of the first list, because the first collect always applied every commit listed at that time, and a later attempt only adds commits after them. When a left-out commit comes after a kept one, the collect refuses before any cherry-pick, with exit 1 and a message that names that commit. Exit 1 already exists, so the usage line and the exit codes in `cstack/src/manifest.ts` do not change. The guard needs one more test case in `cstack/test/unit/collect.test.ts`, which reproduces the removal and the putting back. I rejected keeping the hashes in the helper record. It adds a field to a record format that ADR-SIC-B versions, it needs every record of the unit to be read, and the copies made by `cstack` 0.2.0 have no such field. I also rejected `git cherry-pick -x`, which writes the hash of the original into each copy's message. It would be exact and stateless, but it adds a line to every collected commit of a public history, and it does not help the copies already made by 0.2.0. If nobody decides, the draft recommendation applies without the guard, and the silent loss stays possible in the path of a reused child worktree.

The tests can hit a trap with identical hashes. This point is non-blocking, and I checked it by test. In my first temporary repository, the ticket branch had no commit after the fork. The cherry-pick then ran on the same parent, in the same second, with the same author, message and tree, and git produced the same commit hash as the original. So the ticket branch and the child branch shared that commit, and the comparison by content had nothing to do. The `setup()` function of `cstack/test/unit/collect.test.ts` forks each child from the current ticket commit, so a test that collects only unit 1 is in exactly that situation. Today's `HEAD..child` list would then pass the acceptance cases when the test runs within one second, and fail when it crosses a second. The tests must put a commit on the ticket branch between the fork and the first collect, or collect another unit first, and assert that the copy's hash differs from the original's.

I recommend leaving out `--no-merges`, and this point is non-blocking. The comparison by content skips merge commits anyway, because a merge has no patch id, so it never leaves one out. With `--no-merges`, a merge commit on a child branch would vanish from the list without a word. Without it, the merge is listed, and `commitProblem()` or the cherry-pick refuses it loudly, as today. A child branch should never hold a merge, so this only keeps today's loud failure.

Starting a second attempt of a collected unit in a new child worktree is draft question 2. It is non-blocking, and it is for the user. I keep the draft recommendation. `checkChildStart()` in `cstack/src/helper/start.ts` (line 145) refuses a unit that already has a commit, so only a test can build that case today. Ticket #31 is the place to decide whether a run needs it.

I also checked the other branches. `git grep` over every local and remote branch finds the message "the ticket branch already has a commit of this unit" only in `cstack/src/unit/collect.ts`, so no test, guide or prompt depends on it. `git diff --stat main...<branch>` is empty for `cstack/src/unit/collect.ts`, both collect test files and `cstack/test/helpers/plan-repo.ts` on the branches of #31, #63 and #64 (`gambitl/wire-orca-guides`, `origin/gambitl/child-worktrees`, `gambitl/red-guard`, `origin/gambitl/unit-commit-message`), so no merge conflict is expected there.

The limit described in "Code mapping" stays: when the copy got another patch id, the old commit is listed again, its cherry-pick becomes empty, and the collect aborts with exit 1. The existing abort message then shows the stderr of git, which says that the cherry-pick is now empty. A new child worktree starts from the ticket branch, so its `HEAD...child` left side holds no commit of the unit, and the limit cannot hit it. The change stores nothing new, so reverting its commit restores today's behaviour. The decisions dated 2026-11-20 in "Decisions" (removing the skip, keeping the report check first, counting an empty list as collected only when the ticket branch has a commit of the unit) are consistent with this, and I do not reopen them.

I checked security and authorization, scale and performance, operations and cost, and the edge cases of a user interface, and found nothing for this ticket.

#### Added after the plan was drafted

No new decision since the question round.

### Open questions and answers

1. Blocking question 1 (how the collect finds the new commits). Label: blocking, for the user. Recommended answer: compare changes with `git rev-list --reverse --no-merges --right-only --cherry-pick HEAD...refs/heads/<child>`. It is a one-line change with no new state, and it works the same for a reused child worktree and for a new one. I checked it on 2026-11-20 with git 2.55 in a temporary repository, as "Code mapping" describes. It has one known limit. When a commit made on the ticket branch outside the units changes lines near the unit's change, in the same file, before the first collect, the copy gets another patch id. A later collect then lists the old commit again, its cherry-pick becomes empty, and the collect stops with exit 1. Nothing is lost, and the existing abort message names the problem. Keeping the hashes in the helper record has no such limit. But it adds a field to the record format, it needs every record of the unit to be read, and a collect run by `cstack` 0.2.0 left no hashes behind.
   The user's answer, on 2026-11-20: compare by content, with the guard that the commits left out by that comparison come first on the child branch. See Blocking question 1.
2. Should a later ticket let `cstack helper start` start a second attempt of a collected unit in a new child worktree? Today it refuses, because a unit with a commit on the ticket branch is not in the first batch of `cstack unit order` (`cstack/src/helper/start.ts`, line 152). Label: non-blocking, for the user. This ticket makes `cstack unit collect` handle that case anyway, as its acceptance asks. Recommended answer: open, not needed for this ticket. Ticket #31, which wires child worktrees into the executor, is the place to see whether a run ever needs it.
   Answer: open, not needed for this ticket. This ticket does not change `cstack helper start`. (accepted by default, 2026-11-20)

### Architecture options

No real choice remained after the question round, so no blueprint was drawn.
