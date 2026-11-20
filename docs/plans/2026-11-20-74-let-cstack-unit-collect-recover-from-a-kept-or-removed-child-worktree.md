# Plan: #74 — M3-15: Let cstack unit collect recover from a kept or removed child worktree

Format: cstack-plan/1
Written by: cstack 0.3.0
Date: 2026-11-20
Ticket: https://github.com/gambitl/claude-code-stack/issues/74
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/collect-recover
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-20T12:01:24+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** When `cstack unit collect` cannot remove the folder of a finished unit, the run can still finish cleanly, without anyone deleting folders by hand.

- **What the title means**: When two units of a ticket run at the same time, each one works in its own copy of the repository, called a child worktree. `cstack unit collect` brings the commits of each unit back to the ticket branch, then removes the child worktrees that are clean. "Recover" means finishing the collect when a child worktree is left over, or was already removed by hand.
- **Why we are doing it**: The run by hand of #31 on the private test repository hit this on 2026-11-20. An implementer left an untracked `package-lock.json` in its child worktree. `cstack unit collect` applied both commits, kept that worktree and exited with `1`, which is the careful choice. But no command of `cstack` could then finish the job. The executor removed the worktree and its branch with plain `git`. After that, `cstack unit collect` failed once with "bad revision" and then twice with exit code `5`, because its record still named the removed worktree. The run ended as failed, although both commits were already on the ticket branch.
- **For the user**: A run that hits a leftover file asks one clear question and then goes on, instead of failing at the end of the build.

**Goal.** This ticket lets `cstack unit collect` finish when a child worktree is gone, and gives the executor a `cstack` way to remove a child worktree that holds only untracked leftovers.

### Where things are today (read first)

* **The cleanup**: `cstack/src/unit/collect.ts` → `cleanUp()` (around line 160) releases the workers, then reads `git status` in each child worktree. When the worktree has changes, it keeps it and prints "was kept, because it has uncommitted changes" (line 186), and the command exits with `1` (line 203). When `git status` cannot run because the folder is gone, it prints "git cannot read the child worktree" (line 180), and the command exits with `5`.
* **The list of commits**: `applyInto()` exits with `1` when git cannot list the commits of the child branch (line 103), for example when the branch was deleted.
* **The records**: each helper record under `.git/cstack/runs/<plan>/helpers/` keeps the path and the branch of its child worktree, and `collectedAt` once the unit is collected.
* **The guide**: `cstack/guides/resolve-issue/build.md`, step 7, tells the executor to run `cstack unit collect`. It says nothing about a worktree that is kept.
* **The evidence**: the plan and the retrospective of issue 7 in the private test repository. The outcome is summed up in a comment on #31.

### Scope

1. When the child worktree folder of a unit no longer exists, and the ticket branch already has the commits of that unit, `cstack unit collect` treats the worktree as removed. It releases the worker if needed, records the unit as collected, prints one line that says so, and does not fail.
2. When the child branch no longer exists, and the ticket branch already has the commits of that unit, it does the same. When the ticket branch has no commit of that unit, it still refuses as today.
3. Add an option to `cstack unit collect`, for example `--discard-untracked`. With it, a child worktree whose only changes are untracked files is removed, after its commits are applied. A child worktree with a changed or staged tracked file is never removed. The question round chooses the name of the option.
4. When a worktree is kept, the message names the untracked files and the exact command to run with the new option.
5. In `build.md`, step 7: when `cstack unit collect` keeps a child worktree, the executor asks the user with a needs-decision report. It never removes a worktree or a branch with `git` itself. Update the usage line and the exit codes in `cstack/src/manifest.ts`, and `README.md`.

### Acceptance (TDD)

* `cstack/test/unit/collect-cleanup.test.ts`: write first a case where the child worktree folder was removed after its commits reached the ticket branch. Expect exit code `0` and the unit recorded as collected. See it fail on today's code, then pass.
* The same file: a removed child branch with the commits already applied gives `0`. A removed child branch with no commit of the unit on the ticket branch still fails.
* The same file: with the new option, a child worktree with only an untracked file is removed. A child worktree with a changed tracked file is kept, even with the option.
* The tests never call the real `orca`. They use the fake runner that the collect tests already use.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none · Feeds: #32

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

**Entry points.** `cstack/src/cli.ts:95` wires `cstack unit collect` and always passes an Orca runner, so the clean-up always runs in a real call. `cstack/src/commands/unit-collect.ts` parses the arguments with `parseArgs` and `strict: true`, so a new flag must be added to its `options`. Its usage constant `UNIT_COLLECT_USAGE` (line 10) must keep the usage of the manifest entry as a substring, because `cstack/test/cli.test.ts:226` and `cstack/test/manifest-implemented.test.ts:49` check that the command prints the manifest usage line on an unknown flag. The manifest entry is at `cstack/src/manifest.ts:275`. It uses `planCommand`, which adds `--plan` to the flags by itself.

**How the collect works today.** `cstack/src/unit/collect.ts` has two steps. `applyInto()` (line 64) loops over the units in number order. For each unit it reads the latest helper record. It skips a unit with no child worktree or with no report. It then lists the commits of the child branch with `git rev-list`, twice: once by hash and once with `--cherry-pick`, which compares changes instead of hashes. When that listing fails, for example because the branch was deleted, the whole command stops with exit code `1` (line 102). When the child branch has no commit that the ticket branch lacks, it marks the unit as collected only if `listUnitCommits()` finds commits with the trailer of that unit on the ticket branch (line 108). `listUnitCommits()` in `cstack/src/plan/commits.ts:20` reads the commits from the target branch, or its upstream, up to `HEAD`.

**The clean-up.** `cleanUp()` (line 159) runs for every unit that `applyInto()` touched. It releases each worker of the same child worktree that is not released yet, through `orca orchestration worker-release`. Then, for a collected unit without `collectedAt`, it reads `git status` in the child worktree. A missing folder makes `git status` fail, and the unit ends with exit code `5` (line 178). Any change other than the copy of the plan file keeps the worktree, and the command exits with `1` (line 184). A clean worktree is removed with `orca worktree rm --worktree path:<path>`, with no force flag, and the record gets `collectedAt`. The message then says "Its branch stays." The final exit code is `1` when a worktree was kept, else `5` when Orca or git failed, else `0`.

**The records.** `cstack/src/helper/record.ts` defines `HelperRecord`, with `worktree: { path, branch }`, `released` and `collectedAt`. `latestUnitRecord()` returns the newest start. An escalation reuses the child worktree of the first attempt, so two records can share one worktree path. `cstack/src/helper/start.ts:202` refuses a new implementer for a unit whose child worktree is not collected yet, and refuses an escalation when the folder no longer exists. Ticket #75 changes `start.ts`, so this ticket must not touch it.

**What git does, tested in a scratch repository with git 2.55.0.** `git worktree remove` refuses a worktree with an untracked file, and says to use `--force`. It removes a worktree whose only extra files are ignored, such as `node_modules`. When a worktree folder was deleted with `rm -rf`, git still lists it as "prunable", and `git branch -D` refuses to delete its branch while that entry exists. `git worktree remove <missing path>` then drops only that entry and exits with `0`. After a cherry-pick, `git branch -d` refuses to delete the child branch as "not fully merged", because it compares hashes and the cherry-pick gave the commits new hashes. So `git branch -d` alone can never delete a child branch after the collect.

**Tests and patterns.** `cstack/test/unit/collect-cleanup.test.ts` builds a ticket worktree and one child worktree per unit in a temporary repository, writes a helper record with a dispatch id, saves a report, and passes a fake Orca runner that records the calls. Its `setup()` writes the record `startedAt` after the child commits, which matters if a check compares dates. `cstack/test/unit/collect.test.ts` covers the apply step. `cstack/test/e2e/orca.test.ts:151` runs the whole collect with a fake `orca` in `cstack/test/e2e/bin/orca`, whose `worktree rm` runs `git worktree remove`. `cstack/test/guides/build-helpers.test.ts:34` requires the build guide to keep the text `cstack unit collect <n>... --plan <plan file>`, and a sentence that holds both "exit code `1`" and "cstack unit collect" and also "needs-decision". The size test `cstack/test/skill-size.test.ts` counts only the first guide, so `build.md` has no word limit.

**Governing decisions.** The `WHY:` comment at `collect.ts:157` says that the child branch always stays and that no force is used, so nothing that is not applied is lost. Deleting a child branch changes that comment and that rule. The `WHY:` comment at line 46 explains the cherry-pick and the listing by change. ADR-SIC-A says that helpers run as Orca workers when Orca is available, and the epic says that every Orca feature also works without Orca. Child worktrees exist only with Orca, so a run without Orca never reaches the clean-up.

**Risks.** `collect.ts` changed in six of its last ten commits, through tickets #28, #66 and their review fixes, so its clean-up has many small rules. The tests of #66 cover a second attempt in a new child worktree after a first collect. A check that treats a missing branch as collected must not wrongly accept that second attempt when its branch is gone. Ticket #75 changes the implementer prompt and `cstack helper done` at the same time, so this ticket keeps out of those files.

## Decisions

- Besides the scope of the ticket, this ticket also decides how a child branch goes away once the collect is done. Today the branch of a removed child worktree stays in the repository, and no `cstack` command removes it. The question round picks the command that deletes it. (2026-11-20, from the comment on #74)
- Raise the version of `cstack` to `0.3.1` in `cstack/package.json` and `cstack/package-lock.json`. Run `npm version 0.3.1 --no-git-tag-version` in `cstack/` to do it. (2026-11-20, from the brief of the run)
- Only this ticket changes the version. Nobody pushes a tag from this branch. The coordinator pushes the tag `v0.3.1` once both pull requests of the wave are merged. (2026-11-20, from the brief of the run)
- Ticket #75 runs at the same time, in its own worktree and its own pull request. It changes `cstack/src/settings.ts`, `cstack/src/helper/start.ts`, `cstack/src/commands/helper-done.ts` and `cstack/skills/resolve-issue/agents/implementer.md`. This ticket never changes those four files. (2026-11-20, from the brief of the run)
- This ticket works in `cstack/src/unit/collect.ts`, its tests in `cstack/test/unit/`, step 7 of `cstack/guides/resolve-issue/build.md`, the `cstack unit collect` entry of `cstack/src/manifest.ts`, and the `cstack unit collect` line of `README.md`. In `README.md`, change only that line. In `cstack/src/manifest.ts`, change only that entry. (2026-11-20, from the brief of the run)
- A child worktree starts with no `node_modules`. An implementer there runs `npm ci` in `cstack/` before its first test. It never runs `npm install`, because `npm install` can rewrite `package-lock.json`. (2026-11-20, from the brief of the run)
- When `cstack unit collect` keeps a child worktree, or fails, never remove a worktree or a branch with `git`. Stop with a needs-decision report. The main conversation then tells the user and asks the coordinator, which can help the run go on. (2026-11-20, from the brief of the run)
- `cstack helper start`, `cstack helper wait` and `cstack unit collect` call Orca themselves, and that is expected. Never run `orca orchestration`, `orca worktree create` or `orca worktree rm` yourself. (2026-11-20, from the brief of the run)
- Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Never run `cstack wave` or `cstack wave --watch` for real. Run `git worktree add` only inside a temporary test repository. (2026-11-20, from the brief of the run)
- This run follows the installed `cstack` 0.3.0 and its skill. This branch changes the source of `cstack`, not that global command. Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. (2026-11-20, from the brief of the run)
- To try the code of this branch, use the tests. You can also run `npm run build` in `cstack/`, then `node cstack/dist/bin.js` from the worktree. (2026-11-20, from the brief of the run)
- Never change `.cstack/settings.json` in this branch. The independent review refuses a branch that changes it. (2026-11-20, from the brief of the run)
- If the skill or `cstack` 0.3.0 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-20, from the brief of the run)
- The prose skills in the top-level `skills/` folder are frozen. Never edit anything under `skills/`. New skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-20, from the brief of the run)
- Never read, run or change anything in the folder of the home folder that holds the private data of the comparison runs. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-20, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives, or a path from this machine such as one that starts with `/Users/`. This covers files, commits, the pull request, ticket comments, the plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. (2026-11-20, from the brief of the run)
- Every commit carries the GitHub no-reply address that ends in `@users.noreply.github.com`, as author and as committer. (2026-11-20, from the brief of the run)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-20, from the brief of the run)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, keep both changes, and push it with a plain `git push`, without force. (2026-11-20, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. (2026-11-20, from the brief of the run)
- When you update the branch, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-20, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-20, from the brief of the run)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-20, from the brief of the run)
- The full `npm test` takes about 90 seconds. Give the shell call a timeout above two minutes, or run it in the background. When only one test file fails on the five-second timeout, run that file alone before you look for a bug. (2026-11-20, from the conventions file)
- A command prints through the `io` argument of `run` and returns its exit code. No code calls `process.exit()`. Set `process.exitCode` instead. (2026-11-20, from the conventions file)
- On macOS, `sed -i` needs an empty argument, as in `sed -i ''`. (2026-11-20, from the conventions file)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-20, from the conventions file)
- The new option of `cstack unit collect` is named `--discard-untracked`. (2026-11-20, the user's answer)
- After `cstack unit collect` removes a child worktree, or finds that its folder is gone, it deletes the child branch in the same call. It first checks that `git rev-list --right-only --cherry-pick HEAD...refs/heads/<child>` prints nothing, which means every change of the branch is on the ticket branch. Then it deletes the branch with `git branch -D`. Never use `git branch -d`, because it always refuses after a cherry-pick. (2026-11-20, the user's answer)
- The line that reports a deleted child branch names its old tip hash, so that `git branch <name> <hash>` brings it back. Rewrite the `WHY:` comment above `cleanUp()` and the message "Its branch stays.", because the branch no longer stays. (2026-11-20, the user's answer)
- When the child branch is already gone at the moment of the deletion, treat it as deleted and still record the unit as collected. Nobody knows yet whether `orca worktree rm` deletes the branch itself. (2026-11-20, accepted by default)
- Add an optional field `appliedAt` to `HelperRecord` in `cstack/src/helper/record.ts`, with an ISO 8601 time. `applyInto()` writes it into the latest helper record of the unit after a successful cherry-pick. It also writes it when the child branch has no new commit and the ticket branch already holds commits of that unit. The format name `cstack-helper/1` does not change. (2026-11-20, the user's answer)
- When the child branch of a unit no longer exists, the unit counts as collected only when its latest helper record, or a record that shares the same child worktree path, has `appliedAt`. Otherwise the command exits with `1`, as today, and nothing is applied for that unit. (2026-11-20, the user's answer)
- A child worktree is gone when its folder does not exist on disk. Then cstack never runs `git status` for it. When `git worktree list --porcelain` still names that path, cstack drops git's entry with `git worktree remove <path>`, with the path exactly as git lists it. Use `listWorktrees()` from `cstack/src/helper/child.ts` and compare paths as `cstack/src/helper/start.ts` does, but never change `start.ts`. (2026-11-20, accepted by default)
- When the folder of a child worktree exists but `git worktree list` does not name it, cstack keeps the folder, runs no `git status` in it, and reports it with exit code `1`. (2026-11-20, accepted by default)
- With `--discard-untracked`, cstack still keeps the child worktree when an untracked file is one of the `Files` of the unit, because that is most likely work that was not committed. It also keeps it when `git status` lists a whole folder, with a path that ends in `/`, such as a nested git repository. The message names those entries. (2026-11-20, accepted by default)
- When the child branch still holds a change that the ticket branch lacks at the moment of the deletion, keep the branch, say why in the output, and keep the exit code as it would be without it. (2026-11-20, an assumption not asked)
- When `git branch -D` fails on a child branch, print the git error on standard error and end with exit code `5`. The unit stays recorded as collected. (2026-11-20, an assumption not asked)
- When the child worktree folder of a unit no longer exists, `cstack unit collect` never calls `orca worktree rm` for it. If `git worktree list` still names that path, cstack drops git's entry with `git worktree remove <path>`, which on a missing folder only deletes the entry. (2026-11-20, an assumption not asked)
- With `--discard-untracked`, cstack deletes the untracked files that `git status --untracked-files=all` lists, one by one, and names them in its output. Then it calls `orca worktree rm` without any force flag, as today. A file that git ignores, such as `node_modules`, is not listed and does not stop the removal. (2026-11-20, an assumption not asked)
- The new option acts only on a unit whose commits were applied in this call or before. It never touches the worktree of a unit that is stuck, skipped or refused. (2026-11-20, an assumption not asked)
- A child worktree with any changed, staged or deleted tracked file is always kept, with or without the new option. Its message lists those files and says that the option cannot remove it. (2026-11-20, an assumption not asked)
- When a worktree is kept only because of untracked files, the message lists them and gives the exact command to run, as `cstack unit collect <n> <option> --plan <plan file>` with the real unit number, option name and plan path. (2026-11-20, an assumption not asked)
- A kept worktree still makes the command exit with `1`, as today. A worktree whose folder is gone, with the commits already on the ticket branch, gives `0`. (2026-11-20, an assumption not asked)
- When the child branch is gone and the ticket branch holds no commit of that attempt, the command still exits with `1`. Its message says that the branch is gone and that no commit of the unit from that attempt is on the ticket branch. (2026-11-20, an assumption not asked)

## Architecture

The approach is locked by the answers of the question round, so there was no real choice to compare. All the new behaviour stays in `cstack/src/unit/collect.ts`, in its two existing steps. The apply step learns to accept a child branch that is gone, thanks to a new optional field `appliedAt` in the helper record. The clean-up step learns three things: a child worktree folder that is gone, the deletion of the child branch, and the new option `--discard-untracked`. The command file only parses the new option and passes it on. No new decision since the question round.

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

### Unit 1: Finish the collect when the folder of a child worktree is gone

- Files: `cstack/src/unit/collect.ts`, `cstack/test/unit/collect-cleanup.test.ts`
- Test: `cstack/test/unit/collect-cleanup.test.ts`: a child worktree whose folder was deleted after its commits reached the ticket branch gives exit code `0`, its record gets `collectedAt`, and no `orca worktree rm` call is made.
- Minimum code: In `cleanUp()`, before `git status`, check whether the folder of the child worktree exists. When it does not exist, never run `git status`. Drop git's entry for that path with `git worktree remove <path>`, run in the ticket worktree, when `listWorktrees()` from `cstack/src/helper/child.ts` still names it. Compare the paths as `cstack/src/helper/start.ts` does, with `realpathSync` and a fallback to plain equality. Then write `collectedAt` and print one line on standard output, such as "Unit 1: the child worktree <path> no longer exists, so it counts as removed." When the folder exists but `listWorktrees()` does not name it, keep it, run no `git status` in it, print a line on standard error that says it is not a git worktree of this repository, and end with exit code `1`.
- Refactor: none.
- Commit message: `fix(cli): let cstack unit collect finish when a child worktree folder is gone`
- Depends on: none
- Worktree: ~/orca/workspaces/claude-code-stack/collect-recover-unit-1-110151

Write three cases. In each one, first run the collect with a fake Orca whose `worktree rm` fails, so that the commits reach the ticket branch and the worktree stays. Then change the folder, and run the collect again with the recording fake. The first case deletes the folder with `rmSync`, so git still lists it, and checks that `git worktree list` no longer names it afterwards. The second case removes the worktree with `git worktree remove --force`. The third case removes the worktree with `git worktree remove --force`, then creates the folder again with a file in it, and expects exit code `1` and the folder kept. Each case also checks that the worker was released.

### Unit 2: Accept a child branch that is gone once cstack has applied its commits

- Files: `cstack/src/helper/record.ts`, `cstack/src/unit/collect.ts`, `cstack/test/unit/collect-cleanup.test.ts`
- Test: `cstack/test/unit/collect-cleanup.test.ts`: after a first collect that applied the commits and kept the worktree, the test removes the worktree and deletes the child branch with `git`, and a second collect gives exit code `0` and writes `collectedAt`.
- Minimum code: Add the optional field `appliedAt?: string` to `HelperRecord`. In `applyInto()`, write `appliedAt` into the latest record of the unit after a successful cherry-pick. Write it too when the child branch has no new commit and `listUnitCommits()` finds commits of the unit. Use the same clock as `collectedAt`, which is `orca.now` when the call has one. Before the two `git rev-list` calls, check the child branch with `git rev-parse --verify --quiet refs/heads/<child>`. When the branch is gone, look for `appliedAt` in the latest record and in every record that shares its child worktree path. When one has it, count the unit as collected and print one line on standard output, such as "Unit 1: the branch "child-1" no longer exists, and its commits were applied before." When none has it, print on standard error that the branch is gone and that cstack has no record that its commits were applied, and return `1`, as today.
- Refactor: none.
- Commit message: `fix(cli): let cstack unit collect accept a gone child branch once its commits were applied`
- Depends on: 1

Write three cases. The first one runs a first collect where the child worktree holds an untracked file, so the commits are applied and the worktree is kept with exit code `1`. It checks that the record now has `appliedAt`. It then runs `git worktree remove --force` and `git branch -D` on the child, and a second collect gives `0`. The second case builds a second attempt in a new child worktree after a first collected attempt, as the existing test "skips a second attempt that has not reported" does, with a saved report. It removes that new worktree and its branch before any collect of it. The collect then gives exit code `1`, `HEAD` does not move, and the new record has no `collectedAt`. The third case checks that a collect without Orca, through `unitCollect` with no `orca` in the deps, also writes `appliedAt`.

### Unit 3: Delete the child branch once its worktree is gone

- Files: `cstack/src/unit/collect.ts`, `cstack/test/unit/collect-cleanup.test.ts`
- Test: `cstack/test/unit/collect-cleanup.test.ts`: after a clean collect, the child branch no longer exists, and the output line names the branch and its old tip hash.
- Minimum code: In `cleanUp()`, after Orca removed the child worktree, or after the folder was found gone, read the child branch with `git rev-parse --verify --quiet refs/heads/<child>`. When it is already gone, say so in the line and go on. Otherwise run `git rev-list --right-only --cherry-pick HEAD...refs/heads/<child>`. When it prints nothing, run `git branch -D <child>` and print one line with the old tip hash, such as "Unit 1: the child worktree <path> was removed, and its branch child-1 was deleted. It pointed to abc1234." When the listing prints a commit, keep the branch and say why in the line. Rewrite the `WHY:` comment above `cleanUp()`, which says today that the child branch always stays.
- Refactor: none.
- Commit message: `feat(cli): delete the child branch after cstack unit collect removes its worktree`
- Depends on: 2

Write four cases. The first one is the clean collect above. The second one deletes the folder of the child with `rmSync` after a first collect that kept it, and checks that the second collect deletes the branch too. The third one uses a fake Orca whose `worktree rm` removes the worktree and deletes the branch itself, and expects exit code `0` and `collectedAt`. The fourth one uses a fake Orca whose `worktree rm` first commits a new change in the child worktree and then removes it. It expects the branch to stay and the line to say that the branch holds a change that the ticket branch lacks. Update the existing cases that print "Its branch stays." if one of them checks it.

### Unit 4: Add the option --discard-untracked to cstack unit collect

- Files: `cstack/src/commands/unit-collect.ts`, `cstack/src/unit/collect.ts`, `cstack/src/manifest.ts`, `cstack/test/unit/collect-cleanup.test.ts`
- Test: `cstack/test/unit/collect-cleanup.test.ts`: with `--discard-untracked`, a child worktree whose only change is an untracked file is removed, and the output names the deleted file.
- Minimum code: Add the boolean option `discard-untracked` to the `parseArgs` options of `unit-collect.ts`, and pass it to `collectUnits()`. Change `UNIT_COLLECT_USAGE` to `Usage: cstack unit collect <n>... [--discard-untracked] [--plan <file>]`. In `cleanUp()`, read the two-letter status code of each `git status --porcelain` entry. An entry with `??` is untracked. Any other entry is a tracked change. A tracked change always keeps the worktree, and the message lists those files and says that `--discard-untracked` cannot remove it. Without the option, untracked files keep the worktree, and the message lists them and gives the exact command `cstack unit collect <n> --discard-untracked --plan <plan file>`, with the real unit number and the plan path relative to the repository root. With the option, the worktree is still kept when an untracked entry is one of the `Files` of the unit, compared without case as `commitProblem()` does, or when an entry ends with `/`. Otherwise delete each untracked file with `rmSync`, print the deleted files, and go on with the removal. In `cstack/src/manifest.ts`, change only the entry of `cstack unit collect`. Its usage becomes `cstack unit collect <n>... [--discard-untracked]`, its flags list `--discard-untracked`, and its exit codes `1` and `5` say what they mean now.
- Refactor: none.
- Commit message: `feat(cli): add --discard-untracked to cstack unit collect`
- Depends on: 3

Write five cases. The first one is the removal above, with the branch deleted afterwards. The second one changes a tracked file of the child worktree and expects exit code `1` and the worktree kept, even with the option. The third one runs without the option and expects the message to name the untracked file and the exact command. The fourth one, with the option, leaves an untracked file whose path is in the `Files` of the unit, and expects the worktree kept. The fifth one, with the option, runs `git init` in a sub-folder of the child worktree, and expects the worktree kept. Run `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts` too, because they check the usage line and the unknown-flag answer of every command.

### Unit 5: Tell the executor what to do when a child worktree is kept

- Files: `cstack/guides/resolve-issue/build.md`, `cstack/test/guides/build-helpers.test.ts`, `README.md`
- Test: `cstack/test/guides/build-helpers.test.ts`: step 7 says that when `cstack unit collect` keeps a child worktree, the executor returns a needs-decision report that quotes the message, never removes a worktree or a branch with `git`, and runs the printed `--discard-untracked` command only when `## Decisions` says so.
- Minimum code: Rewrite step 7 of `cstack/guides/resolve-issue/build.md`. Keep the text `cstack unit collect <n>... --plan <plan file>` and the sentence that holds both "exit code `1`" and "needs-decision", because the existing test needs them. In `README.md`, change only the line of `cstack unit collect`. It must say that the command finishes when a child worktree folder or branch is gone after the apply, that it deletes the child branch once every change is on the ticket branch, and what `--discard-untracked` does.
- Refactor: none.
- Commit message: `docs(skill): tell the executor to ask before a kept child worktree goes`
- Depends on: 4

### Unit 6: Raise the version of cstack to 0.3.1

- Files: `cstack/package.json`, `cstack/package-lock.json`
- No test: the unit changes only the version number, and `npm version` writes both files.
- Minimum code: Run `npm version 0.3.1 --no-git-tag-version` in `cstack/`. Check that only the two version lines changed.
- Refactor: none.
- Commit message: `chore(cli): raise the version of cstack to 0.3.1`
- Depends on: none
- Worktree: ~/orca/workspaces/claude-code-stack/collect-recover-unit-6-110157

## Documentation duties

- The line of `cstack unit collect` in `README.md`: applies, written by unit 5.
- Step 7 of the build guide `cstack/guides/resolve-issue/build.md`: applies, written by unit 5.
- The manifest entry of `cstack unit collect`: applies, written by unit 4.
- A decision record: does not apply. The helper record gains one optional field, as `released` and `collectedAt` did before, and ADR-SIC-B versions only the plan and run formats.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. The page does not describe the clean-up of child worktrees.
- A comment on this ticket, #74: applies, written in the document phase.
- A comment on the ticket that feeds on this one, #32: applies, written in the document phase. It says that 0.3.1 lets a run finish after a kept or removed child worktree.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: The name of the new option

Which name should the new option of `cstack unit collect` have? It deletes the untracked files of a child worktree, after the commits of the unit are applied, so that the worktree can be removed. I recommend `--discard-untracked`, the name the ticket suggests, because "discard" says that the files are lost on purpose.

- For: the user
- Answer: `--discard-untracked`, as recommended. The user answered "go" to the recommendations on 2026-11-20.

### Question 2: How the child branches go away

Which command should delete a child branch once all its work is on the ticket branch? I recommend that `cstack unit collect` deletes it right after it removes the child worktree, in the same call. It first checks that every change of the branch is already on the ticket branch, with `git rev-list --cherry-pick`, and only then deletes the branch with `git branch -D`. The ticket comment suggested `git branch -d`, but I checked it: after a cherry-pick, `git branch -d` always refuses with "not fully merged", because the commits on the ticket branch have new hashes. The other choice is that `cstack publish` deletes the child branches before the push, but publish does not read the helper records today.

- For: the user
- Answer: `cstack unit collect` deletes the child branch with `git branch -D` right after it removes the child worktree, in the same call, and only when the listing by change is empty. The output line names the old tip hash, so that `git branch <name> <hash>` brings the branch back. The user answered "go" to the recommendations on 2026-11-20.

### Question 3: A child branch that is gone

When the child branch of a unit no longer exists, what proves that the ticket branch already has its commits? The ticket says to look for commits of that unit on the ticket branch. That is not enough after a second attempt in a new child worktree: the first attempt's commits are on the ticket branch, so a deleted second branch would look collected, and its new commits would be lost without a word. One way is to count only the commits of the unit whose author date is at or after the start of the attempt that used that child worktree. The other way is that `cstack unit collect` writes the time in the helper record when it has applied the commits of that attempt. A gone branch is then accepted only when that time is written. I recommend the second way, because a fix commit with the same unit number cannot fool it, and dates rounded to the second do not matter. It costs one optional field in `cstack/src/helper/record.ts`, a file that #75 does not change.

- For: the user
- Answer: the second way. `cstack unit collect` writes the time of the apply into the helper record, and a gone branch counts as collected only when that time is written. The user answered "go" to the recommendations on 2026-11-20.

## Review log

### Impact notes

- `collectUnits()` in `cstack/src/unit/collect.ts` is called from `cstack/src/commands/unit-collect.ts` and from the tests `cstack/test/unit/collect.test.ts`, `cstack/test/unit/collect-cleanup.test.ts` and `cstack/test/helper/child-worktree.test.ts`. The new `options` parameter is optional, so the old callers still compile.
- `HelperRecord` gains the optional field `appliedAt`. `cstack/src/helper/start.ts` reads only `collectedAt`, so it is not affected. The tests `cstack/test/helper/record.test.ts` and `cstack/test/helper/spec.test.ts` use the record and have no check on its exact set of fields.
- The usage line changed in `cstack/src/manifest.ts` and in `UNIT_COLLECT_USAGE`. `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts` check that both agree, and the implementer ran them.
- The message "Its branch stays." was removed. A search of the repository finds it only in older plan files, which are history and stay as they are.
- Files that usually change with `collect.ts` are its two test files and `unit-collect.ts`. All three are in the diff. Files that usually change with `manifest.ts` are `cstack/test/manifest.test.ts` and `README.md`. The manifest test is run by the full test command in this phase.
- The comments `WHY:` above `cleanUp()` and in `applyInto()` were rewritten on purpose, as the plan decided.

### Reviewer findings

The four reviewers read the whole diff. Here is what they found and what I did.

- Correctness: when `git worktree remove` failed for a missing folder, the record was still marked collected, so a later run could never delete the branch. Git also refuses `git branch -D` while an entry of a missing worktree remains. Fixed: the command now checks that call, reports the git error, exits with 5 and leaves the unit open. It also runs `git worktree prune` before `git branch -D`. A new test covers an Orca that removes the folder but leaves git's entry.
- The full test run showed one more failure, in `cstack/test/helper/worktree-line.test.ts`. Its fake Orca did not remove the worktree, so the branch could not be deleted and the exit code was 5. Fixed: the fake now removes the worktree, as Orca does.
- Security: no finding. Two low remarks stay open as follow-ups. The suggested command prints the plan path without quotes, and a process inside the child worktree could race `git status` and the deletion. Neither crosses a permission boundary.
- Conventions: the README line said that `--discard-untracked` deletes the untracked files without saying when it refuses, and did not explain "untracked". Fixed, with shorter sentences.
- Simplicity: the three pairs that mark a unit as collected and applied became one small function. I left the second remark open (one clock function passed around), because it saves about three lines and touches the fallback of the clean-up step.


### Independent review

The independent reviewer found no defect in the code. It added one test, which checks that a gone child branch is refused when the ticket branch holds no commit of the unit. The full test run and the type check pass. The reviewer raised these judgment calls, which stay as they are:

- The ticket asks to accept a gone branch when the ticket branch has commits of the unit. The code trusts the time that cstack writes in the helper record after the apply instead, as the user decided. If someone resets the ticket branch after the collect and then deletes the child branch, the collect still answers 0. Checking that the ticket branch still holds commits of the unit would close that gap, and it is a possible follow-up.
- Before it deletes a branch, the code runs `git worktree prune`. That drops git's entries for every worktree whose folder is missing, not only the entry of this unit. It is harmless in practice, but wider than needed.
- When a branch is kept because it holds a change that is not applied, the unit is still recorded as collected, so no later call deletes that branch. This follows a recorded decision.
- Two small wording issues remain. The message says "because it is" for a list of several entries, and the suggested command prints the plan path without quotes.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- "When a child worktree folder was removed with git or by hand, does Orca still show that worktree in its list?" For the maintainer, during the next run with a real Orca.
- "When `orca worktree rm` removes a child worktree, does it also delete the branch of that worktree?" For the maintainer, during the next run with a real Orca.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

- A comment on ticket #74 on GitHub, posted with `cstack tracker comment`. It sums up what changed, the review fixes, the open questions and the follow-ups.
- A comment on ticket #32 on GitHub, posted the same way. It says that 0.3.1 lets a run finish after a kept or removed child worktree, and names the files to build on.
- The README line of `cstack unit collect`, step 7 of the build guide and the manifest entry were written in the units and are in the diff.
- No decision record was written, as the plan's "Documentation duties" say. The specification page needs no change.

## Executor notes

nothing this time

## Hand-off log

- 2026-11-20, build phase: I moved the ticket to "in progress" with `cstack tracker move`. I built units 1 and 6 in child worktrees and collected them with exit code 0. I then built units 2, 3, 4 and 5 one after the other in the main worktree, because they depend on each other. All six units have a commit.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**The name of the new option: `--discard-untracked`.** It becomes a public option of `cstack unit collect`, written in the README and in the messages, so renaming it later is costly. It deletes files for good, and "discard" says so. I recommend `--discard-untracked`, the name the ticket suggests.

**`cstack unit collect` deletes the child branch right after it removes the child worktree.** Once the worktree and the branch are both gone, the original commits are unreachable, and git prunes them after a few weeks. This cannot be undone. The check before the deletion compares changes with `git rev-list --cherry-pick`, because `git branch -d` refuses after a cherry-pick. I recommend this, and the message also prints the old tip hash, so that `git branch <name> <hash>` brings the branch back.

**How to prove that a child branch that is gone was already applied.** If this is wrong, the commits of a second attempt are lost without a word. The draft compares the author date of the unit's commits with the start of the attempt. I would rather have `cstack unit collect` write the time it applies the commits into the helper record, and accept a missing branch only when that field is there. A later fix commit with the same unit trailer cannot fool it, and it does not depend on dates rounded to the second. It costs one optional field in `cstack/src/helper/record.ts`, which ticket #75 does not touch.

**I will do this unless you say no**

- I decide that a child worktree is gone from `git worktree list`, as `cstack helper start` already does. I never run `git status` in a folder that is no longer a worktree, because git would climb to a parent repository. Accepted by default (2026-11-20).
- With the new option, I still keep the worktree when an untracked file is one of the unit's files, because that is most likely forgotten work. I also keep it when git lists a whole folder, such as a nested git repository. Accepted by default (2026-11-20).
- When the child branch is already gone at deletion time, I treat it as done. We do not know yet whether `orca worktree rm` deletes the branch itself. Accepted by default (2026-11-20).

**I checked it myself**

- With git 2.55.0, every git fact in the draft holds: `git branch -d` refuses after a cherry-pick, `git branch -D` refuses while git keeps the entry of a deleted folder, and `git worktree remove` on that missing folder only drops the entry.
- A nested git repository shows as one `nested/` line even with all untracked files listed, and git then refuses to remove the worktree. Empty folders left after deleting the files do not block the removal.

**Questions for other people that can wait**

For the maintainer, during the next run with a real Orca:

- "When a child worktree folder was removed with git or by hand, does Orca still show that worktree in its list?"
- "When `orca worktree rm` removes a child worktree, does it also delete the branch of that worktree?"

**Good to know**

- `cstack unit collect` stops at the first refused unit. A gone branch with nothing applied also blocks the units after it in the same call.

#### Details

The name of the option (blocking question 1, needs the user). A command-line option is a public interface once it ships in `0.3.1` and appears in `README.md`, in the manifest usage line and in the message that the kept worktree prints. The draft recommendation `--discard-untracked` stands. The rejected alternatives are `--force`, which suggests that tracked changes could go too, and `--clean`, which hides that files are deleted. Default if nobody decides: the ticket's own suggestion, `--discard-untracked`.

How the child branches go away (blocking question 2, needs the user). The ticket comment on #74 asks this ticket to decide it, and the "Decisions" section records that this ticket picks the command, so the `WHY:` rule at `cstack/src/unit/collect.ts:157` ("The child branch always stays") is changed on purpose by that upstream request, not reopened here. The implementer must rewrite that comment and the message "Its branch stays." at line 197. The deletion cannot be undone in practice. When the worktree is removed, its own HEAD reflog goes with it. `git branch -D` also deletes the reflog of the branch. The original commits then become unreachable, and `git gc` prunes them after `gc.pruneExpire`, which is two weeks by default. I agree with the draft. The same `cstack unit collect` call deletes the branch with `git branch -D`, after the worktree is removed. It does so only when `git rev-list --right-only --cherry-pick HEAD...<child>` is empty. I add one cheap safeguard. The output line names the old tip hash that `git branch -D` prints, as in "Deleted branch x (was abc1234)". A person can then restore the branch with `git branch <name> <hash>` while the objects still exist. The option where `cstack publish` deletes the branches is rejected, because publish does not read the helper records and would delete branches long after the evidence of the collect is gone. The same deletion applies on the recovery path for a missing folder, after git's entry for that folder is dropped. Default if nobody decides: the branches stay, as today.

A child branch that is gone (blocking question 3, needs the user, cannot be settled by a test because it is a design choice). I disagree with the draft. The draft counts the unit's commits on the ticket branch whose author date is at or after the `startedAt` of the oldest record sharing the worktree path. It works in the common case, but it has two weak spots. First, any later commit on the ticket branch that carries `Cstack-Unit: <n>`, such as a review fix, makes a deleted second-attempt branch look collected, and the second attempt's commits are lost in silence. Second, git author dates have a one-second resolution while `startedAt` has milliseconds, so the comparison must floor `startedAt` to the second. I recommend another way. `applyInto()` writes an `appliedAt` field into the latest helper record right after a successful cherry-pick (line 139). It writes it too when the child has no new commit and `listUnitCommits()` finds the unit (line 108). A missing child branch then counts as collected only when the latest record has `appliedAt`, or a record that shares its worktree path has it. This field records a fact that cstack itself produced, so nothing has to be guessed. It adds one optional field to `HelperRecord` in `cstack/src/helper/record.ts`. The fields `released` and `collectedAt` were added the same way, without a new `cstack-helper` format version. The versioning rule of ADR-SIC-B covers the `cstack-plan` and `cstack-run` formats. Ticket #75 does not list `record.ts` among its files. The acceptance test "a removed child branch with the commits already applied gives `0`" then applies the commits through `cstack unit collect` before it deletes the branch. It does not apply them with a cherry-pick by hand. Records written by `cstack` 0.3.0 have no such field, so a run started on 0.3.0 would still refuse a gone branch. That is acceptable, because that run is over. Default if nobody decides: the draft's date check, with `startedAt` floored to the second.

How a missing folder is detected (non-blocking, I will do it). `cleanUp()` today runs `git status` with the child path as working folder (line 177). When the folder is gone, spawn fails and the unit ends with `5`. When the folder still exists but is no longer a worktree, for example after a partial removal, git climbs to the nearest parent repository and could report the status of some other repository. The fix should decide "gone" from `git worktree list --porcelain` run in the ticket worktree, with the `listWorktrees()` helper of `cstack/src/helper/child.ts` and the realpath comparison that `cstack/src/helper/start.ts:215` already uses. A folder that exists but is not a listed worktree should be kept and reported, not treated as gone. On macOS the test temporary folder sits behind the `/var` to `/private/var` symbolic link, and a missing folder cannot be resolved with `realpathSync`, so the tests must register and record the same spelling of the path. `git worktree remove <path>` must receive the path exactly as git lists it.

What the new option refuses to delete (non-blocking, I will do it). `git status --porcelain --untracked-files=all` lists files, except for a nested git repository, which it lists as one entry ending with `/`. `rmSync` on that entry without `recursive` throws, and recursive deletion of a nested repository is too much for this option, so such an entry keeps the worktree with a clear message. An untracked file whose path is in the unit's `Files` line is most likely a file the implementer forgot to `git add`, so the option also keeps the worktree and names that file. This narrows the assumption in "Decisions" that the option deletes every untracked file. Ignored files such as `node_modules` are not listed and do not block `git worktree remove`, which the draft already checked.

A child branch that is already gone at deletion time (non-blocking, I will do it). The e2e fake Orca in `cstack/test/e2e/bin/orca` runs only `git worktree remove`, and the current message says the branch stays, but nobody has checked whether the real `orca worktree rm` deletes the branch. The deletion step must therefore treat "branch not found" as success and still record the unit as collected.

What I checked with a scratch repository and git 2.55.0. After a cherry-pick onto a ticket branch that has moved, `git rev-list --right-only --cherry-pick HEAD...c4` was empty and `git branch -d c4` exited with 1 and "not fully merged". When the ticket branch had not moved, the cherry-pick produced the same hash and `git branch -d` succeeded, which does not change the recommendation. With the folder deleted by `rm -rf`, `git branch -D` exited with 1 ("used by worktree"), `git worktree remove <missing path>` exited with 0, and `git branch -D` then succeeded and printed the old tip. A nested repository showed as `?? nested/`, and `git worktree remove` refused it with "contains modified or untracked files". A worktree whose only leftovers were empty folders was removed with exit code 0.

Questions for the maintainer (both non-blocking, to check during the next run with a real Orca, because this run must not call the real `orca worktree rm`). "When a child worktree folder was removed with git or by hand, does Orca still show that worktree in its list?" "When `orca worktree rm` removes a child worktree, does it also delete the branch of that worktree?" Neither answer changes the code, because cstack never calls Orca for a missing folder and tolerates a branch that is already gone.

Good to know. `applyInto()` returns at the first refused unit (lines 102 to 137), so a gone branch with nothing applied also stops the units with higher numbers in the same call. `README.md` already says that the command stops at the first unit that fails, so the behaviour is documented and stays.

Locked decisions cited and not reopened: the files that ticket #75 owns, the version `0.3.1`, the rule that the executor never removes a worktree or a branch with `git`, and ADR-SIC-A and ADR-SIC-B. I checked security and authorization, scale and performance, user-facing edge cases, operations and cost, and hidden coupling with `cstack helper start` (which only reads `collectedAt` and gains nothing new to break), and found nothing more to raise there.

### Open questions and answers

1. **The name of the option.** Blocking question 1. Recommended answer: `--discard-untracked`.
2. **How the child branches go away.** Blocking question 2. Recommended answer: `cstack unit collect` deletes the child branch after it removes the worktree, once `git rev-list --right-only --cherry-pick HEAD...<child>` is empty, with `git branch -D`. Tested in a scratch repository with git 2.55.0: after `git cherry-pick c4`, the listing by change was empty, and `git branch -d c4` exited with 1 and "the branch 'c4' is not fully merged". Also tested: `git branch -D` refuses a branch that a missing but still registered worktree uses, so git's entry for a missing folder must go first.
3. **A child branch that is gone.** Blocking question 3. First recommended answer: count only the commits of the unit on the ticket branch whose author date is at or after the `startedAt` of the oldest record that shares the child worktree path of the latest record. Recommended answer after the advice before the plan: record the time of the apply in the helper record, and accept a gone branch only when that time is recorded.
4. **Orca and a folder removed outside Orca.** Non-blocking. When a child worktree folder was removed with `git` or by hand, does Orca still show that worktree in its list? The run cannot test it, because it must not call the real `orca worktree rm`. The maintainer can look during the next run with a real Orca. Open, not needed for this ticket: cstack does not call Orca for a missing folder, so the answer does not change the code.
5. **Orca and the child branch.** Non-blocking, from the advice before the plan. When `orca worktree rm` removes a child worktree, does it also delete the branch of that worktree? For the maintainer, during the next run with a real Orca. Open, not needed for this ticket: cstack treats a branch that is already gone as deleted.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
