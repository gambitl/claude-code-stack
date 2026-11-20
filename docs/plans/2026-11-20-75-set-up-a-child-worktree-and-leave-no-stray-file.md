# Plan: #75 — M3-16: Set up a child worktree for its implementer and leave no stray file in it

Format: cstack-plan/1
Written by: cstack 0.3.0
Date: 2026-11-20
Ticket: https://github.com/gambitl/claude-code-stack/issues/75
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/child-setup
Target branch: main
Conversation language: French
Status: ready for review
Approved at: 2026-11-20T12:04:42+01:00
Ready for review at: 2026-11-20T12:30:17+01:00

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** An implementer that works in its own copy of the repository can install what the tests need, and it leaves nothing behind in that copy.

- **What the title means**: When two units of a ticket run at the same time, each implementer works in its own copy of the repository, called a child worktree. `cstack helper start` creates it through Orca with `--setup skip`, so nothing is installed in it: no `node_modules`, no virtual environment. "Setup" is the command that installs the dependencies, such as `npm ci`.
- **Why we are doing it**: In the run by hand of #31 on 2026-11-20, the implementer of one unit ran `npm install` in its child worktree. That command wrote a new `package-lock.json`, which git did not track. So `cstack unit collect` could not remove the worktree, and the run failed (see #74 for the collect side). In a real repository with dependencies, an implementer in a child worktree has no installed packages at all, so it must install them before it can run any test.
- **For the user**: Parallel units work in any repository, and they never leave stray files that stop the run.

**Goal.** This ticket tells the implementer how to set up a child worktree, and makes `cstack helper done implementer` refuse a child worktree that holds files outside the unit.

### Where things are today (read first)

* **The child worktree**: `cstack/src/helper/start.ts` (line 283) starts the implementer with `--worktree new-child ... --setup skip`.
* **The settings file**: `.cstack/settings.json` of a repository names the test commands under `testCommands`. It names no setup command.
* **The implementer prompt**: `cstack/skills/resolve-issue/agents/implementer.md`, step 6, asks the implementer to run `git status` and to check that it changed no file outside its `Files` line. It does not say what to do with an untracked file that a command created. Line 71 ends the work with `cstack helper done <kind> --helper <helper id> --plan <plan file>`.
* **The end of a helper**: `cstack/src/commands/helper-done.ts` checks the report before it sends it.

### Scope

1. Add an optional `setupCommand` to `.cstack/settings.json`, such as `"npm ci"`. Read it with the other settings, and document it in `README.md`.
2. Choose in the question round who runs it in a new child worktree: `cstack helper start`, before the implementer starts, or the implementer, as its first step. Record the choice in `## Decisions`. When the settings have no `setupCommand`, nothing is installed, as today.
3. In the implementer prompt, say that the implementer never runs an install command other than the `setupCommand`. Say that before `cstack helper done`, it deletes every untracked file that it created outside its `Files` line, unless git ignores that file.
4. `cstack helper done implementer`, when the helper worked in a child worktree, refuses the `done` report while that worktree holds an untracked or changed file outside the unit's `Files` line that git does not ignore. The message names each file. A `stuck` report is still accepted.

### Acceptance (TDD)

* The settings tests: write first a case where `setupCommand` is read, and one where its absence changes nothing. See them fail, then pass.
* The helper done tests: a `done` report from a child worktree with an untracked `package-lock.json` outside the unit is refused, and the message names the file. An ignored file, such as one under `node_modules/`, is accepted. A `stuck` report is accepted.
* The test of the setup choice of item 2 uses fake programs, never the real `orca` or `npm`.
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

The tracker lists no blocker for this ticket, and its footer says "Blocked by: none". Ticket #74 runs at the same time in another worktree. It is not a blocker, because the two tickets change different files.

## Code mapping

**The settings file.** `readSettings` in `cstack/src/settings.ts` reads `.cstack/settings.json`. Each key has a type in `SettingValues` (line 37), a default in `DEFAULTS` (line 56) and a block of checks in `readSettings` (lines 227 to 290). `testCommands` is the model for an optional key, because its default is `undefined`. `checkTestCommand` (line 104) already refuses an empty command, a line break, a control character and a first word that `forbiddenTools` lists. `quote()` (line 98) escapes a value before it goes into a message. Every key in `DEFAULTS` is printed by `settingsBlock` in `cstack/src/settings-block.ts` (line 10), which prints "not set" only for `testCommands`. So a new optional key also needs that line, or `cstack next` prints `undefined`.

The settings tests are in `cstack/test/settings.test.ts`. Three cases list every key, so a new key changes them: the file with only the version (lines 57 to 70), the full file (lines 71 to 87) and the example settings file (lines 223 to 234). The example file `cstack/skills/resolve-issue/templates/settings.json` holds every key except `testCommands` and `review`, and that test checks it. `cstack/test/next-settings.test.ts` (lines 48 to 57) checks the printed keys in their order.

ADR-SIC-D says that a new key keeps the settings at version 1, and that a reader refuses an unknown key. So cstack 0.3.0 refuses a settings file that holds `setupCommand`. A repository can add the key only once everyone who runs it has 0.3.1.

**The start of a child worktree.** `startHelper` in `cstack/src/helper/start.ts` decides at lines 254 to 269 whether the implementer gets a child worktree. The `worker-start` call at lines 276 to 286 passes `--setup skip`. Ticket #28 chose `--setup skip`, so that Orca's own project setup never installs packages beside the worker. The help of `worker-start` in the installed Orca app (read in its source, never run) gives `--setup <run|skip|inherit>`. These values run the project's own Orca setup. They cannot run a command that cstack passes. One `worker-start` call creates the child worktree and starts the agent, so cstack has no moment between the two. Ticket #28 rejected creating the worktree first with `orca worktree create`, because a failed second call would leave a worktree with no worker.

The spec is the task text that Orca gives the worker. `buildSpec` in `cstack/src/helper/spec.ts` (lines 99 to 137) writes it from fixed text and paths only, as its `WHY:` comment on line 1 says. For a child worktree, lines 122 to 127 add this sentence: "This worktree is new and has no installed packages. Install the packages as the conventions file says before your first test run." That sentence is what the implementer of #31 followed when it ran `npm install`. `cstack/test/helper/spec.test.ts` (lines 74 to 86) checks the sentence, and `cstack/test/helper/child-worktree.test.ts` (line 58) checks `--setup skip`. A second attempt reuses the child worktree (start.ts lines 199 to 243) and gets the same spec sentence, because `inputs.childWorktree` is also set there.

**The end of a helper.** `cstack/src/commands/helper-done.ts` only reads the command line and standard input. The checks live in `doneHelper` in `cstack/src/helper/done.ts` (lines 90 to 127). It reads the helper record, checks the report with `checkReport`, saves it and sends it to Orca. A refusal prints the reasons on standard error and returns 1. The record (`cstack/src/helper/record.ts`, line 24) has a `worktree` field with `path` and `branch` when the helper worked in a child worktree. Both `implementer` and `implementer-escalation` records can have it (start.ts line 307, and `fallback` with a reused worktree). The escalation prompt `implementer-escalation.md` follows `implementer.md`, so a rule in `implementer.md` covers both roles.

`ticketWorktreeProblems` in `cstack/src/helper/child.ts` (lines 23 to 40) already reads `git status --porcelain=v1 -z --untracked-files=all` and skips the second path of a rename or a copy. That status leaves out the files that git ignores. The new check of `helper done` can reuse this parsing. `readPlan` gives each unit its `files`. The plan file can differ from its committed version in a child worktree, because a second attempt copies the plan file of the ticket worktree over it (start.ts line 240). The `current-run` file of cstack lives in the git folder (`currentRunPath` in `cstack/src/run-state.ts`, line 100), and the saved test runs live under the common git folder, so cstack itself leaves no file in the working tree of the child.

The tests of `helper done` are in `cstack/test/helper/done.test.ts`. Their `setup()` builds a repository with one commit per unit, writes a helper record and answers the Orca calls with a fake runner. `cstack/test/helper/child-worktree.test.ts` shows how a test creates a real child worktree with `git worktree add` inside the temporary repository.

**The implementer prompt.** In `cstack/skills/resolve-issue/agents/implementer.md`, step 6 (line 37) runs `git status` and checks the `Files` line, and line 71 ends with `cstack helper done`. `cstack/test/prompts.test.ts` checks that the prompt names `cstack unit red`, `green`, `commit` and then `cstack helper done`, in that order. The three end-to-end tests under `cstack/test/e2e/` look for the exact line `cstack helper done <kind> --helper <helper id> --plan <plan file>`.

**The README.** `README.md` has no section that lists the settings keys. Line 59 describes `cstack helper start` and its `--child-worktree` flag. Line 72 is the `--watch` paragraph. Line 68 is the `cstack unit collect` line, which #74 changes, so this branch does not touch it.

**Risks.** `start.ts` was fixed six times in its last ten commits, so a change there needs care around the child start and the reuse of a worktree. `settings.ts` was hardened three times, mostly about quoting values in messages. `settings.ts` always changes together with `settings.test.ts`, and `spec.ts` with `spec.test.ts`.

**Governing decisions.** ADR-SIC-A says how helpers run, with a fallback to sub-agents. ADR-SIC-D says how the settings file grows. ADR-SIC-H says how a command starts and ends, so a command returns its exit code and never calls `process.exit()`. Ticket #28 chose `--setup skip` and relative paths in the spec of a child worktree.

## Decisions

- Add one sentence to the `--watch` paragraph of `README.md`. It says that macOS shows the notification of `cstack wave --watch` only when notifications are allowed for Script Editor, in System Settings, then Notifications. (2026-11-20, from the comment of the maintainer on the ticket)
- A child worktree starts with no `node_modules`. An implementer there runs `npm ci` in `cstack/` before its first test, and never `npm install`, because `npm install` can rewrite `package-lock.json`. (2026-11-20, from the brief of the run)
- Ticket #74 runs at the same time in another worktree. It changes `cstack/src/unit/collect.ts`, its tests in `cstack/test/unit/`, step 7 of `cstack/guides/resolve-issue/build.md`, the `cstack unit collect` entry of `cstack/src/manifest.ts` and the `cstack unit collect` line of `README.md`. Do not change any of them in this branch. (2026-11-20, from the brief of the run)
- This ticket works in `cstack/src/settings.ts`, `cstack/src/helper/start.ts`, `cstack/src/commands/helper-done.ts`, `cstack/skills/resolve-issue/agents/implementer.md` and their tests. In `README.md`, change only the lines about the settings file and the lines about `--watch`. (2026-11-20, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. Ticket #74 raises it to 0.3.1. Never push a tag, and never push a tag that starts with `v`. The coordinator pushes `v0.3.1` once both pull requests are merged. (2026-11-20, from the brief of the run)
- When `cstack unit collect` keeps a child worktree, or fails, never remove a worktree or a branch with `git`. Stop with a needs-decision report. The main conversation then tells the user in the chat and the coordinator with `ask`. (2026-11-20, from the brief of the run)
- `cstack helper start`, `cstack helper wait` and `cstack unit collect` call Orca themselves, and that is expected. Nobody runs `orca worktree create` or `orca worktree rm`. Only the main conversation runs `orca orchestration`, and only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-20, from the brief of the run)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-20, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-20, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-20, from the brief of the run)
- Never read, run or change anything under `~/comparison/`, which holds private data. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-20, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. This includes the test of the setup command, which runs a fake program instead of `npm ci`. Run `git worktree add` only inside a temporary test repository. (2026-11-20, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-20, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. So this repository gets no `setupCommand` in this branch. (2026-11-20, from the brief of the run)
- When the skill or the installed `cstack` 0.3.0 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-20, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. (2026-11-20, from the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-20, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep both changes, and push with a plain `git push`, without force. (2026-11-20, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-20, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. (2026-11-20, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-20, from the brief of the run)
- `.cstack/settings.json` gets an optional key `setupCommand`, such as `"npm ci"`. Its default is "not set". The settings format stays at version 1, as ADR-SIC-D says for a new key. (2026-11-20, from the ticket)
- `setupCommand` must be a non-empty command on one line, with no control character. Its first word must not be in `forbiddenTools`. The `{file}` placeholder of the test commands has no meaning here, so the reader does not look for it. A value that breaks a rule makes every command that reads the settings exit with 3, and the message names `setupCommand`. (2026-11-20, accepted by default in the question round)
- In `SettingValues` and `DEFAULTS` of `cstack/src/settings.ts`, `setupCommand` comes right after `testCommands`. `cstack next` prints `- setupCommand: not set (default)` when the key is missing, as it does for `testCommands`. The example file `cstack/skills/resolve-issue/templates/settings.json` stays without `setupCommand`. (2026-11-20, accepted by default in the question round)
- The implementer runs the setup command itself, as its first step, before its first test run. `cstack helper start` never runs it. The reason is that one `orca orchestration worker-start` call creates the child worktree and starts the agent, so cstack has no moment between the two. (2026-11-20, the user's answer)
- `cstack helper start` passes `--setup skip` to `worker-start`, as today. So Orca's own project setup never runs in a child worktree. (2026-11-20, kept from ticket #28)
- `cstack helper start` gives the setup command to an implementer as one input line, `- Setup command: <the command>`. The line goes into the spec of an Orca worker and into the inputs that it prints for a sub-agent. (2026-11-20, the user's answer)
- The setup command is given only when the helper really works in a child worktree. That is a start with `--worktree new-child`, after the checks that keep the start in a child, or a start that reuses the child worktree of a unit. The `childWorktree` flag alone does not decide it. A sub-agent that falls back to the ticket worktree after Orca refused a new child gets no setup command. A unit that runs in the current worktree, because it is alone in its batch or because Orca lacks child worktrees, gets none either. (2026-11-20, accepted by default in the question round)
- `cstack helper start` reads the settings only when the helper will work in a child worktree, and before any Orca call. An invalid settings file then makes the start exit with 3, and it starts nothing. Other starts do not read the settings. (2026-11-20, accepted by default in the question round)
- The spec of an implementer in a child worktree with a setup command says this: "This worktree is new and has no installed packages. Before your first test run, run the setup command of your inputs once, from the root of this worktree. Never run another install command, such as `npm install`." (2026-11-20, the user's answer)
- The spec of an implementer in a child worktree without a setup command keeps today's sentence: "Install the packages as the conventions file says before your first test run." It adds: "Use a command that does not change the lock file, such as `npm ci`, and never `npm install`." So when the key is missing, the implementer still installs, as the conventions file says. (2026-11-20, the user's answer)
- The `WHY:` comment on line 1 of `cstack/src/helper/spec.ts` says that the spec also holds the setup command. That command comes from the committed settings file, which the team writes like a script of `package.json`, and the settings reader refuses a line break or a control character in it. (2026-11-20, accepted by default in the question round)
- `cstack helper done` checks the child worktree when the helper record has a `worktree` and the kind is `done`. It runs `git status --porcelain -z --untracked-files=all --no-renames` in the folder of the record, which is the same status that `cstack unit collect` reads. Every entry except the plan file makes it refuse the report with exit code 1. It then saves nothing and sends nothing to Orca. This covers changes inside the `Files` line of the unit too, because `cstack unit collect` keeps a child worktree for any of them. (2026-11-20, the user's answer)
- The check of `cstack helper done` covers the roles `implementer` and `implementer-escalation`, because both can work in a child worktree. A `stuck` report is always accepted. A helper without a `worktree` in its record is never checked, because the files of other units are legitimately changed in the ticket worktree. A file that git ignores, such as one under `node_modules/`, never appears in the status, so it always passes. (2026-11-20, accepted by default in the question round)
- The refusal message names each file, with the command that fixes it. An untracked file outside the `Files` line gets `rm -- '<file>'`. A tracked file outside the `Files` line that is changed or deleted gets `git restore -- '<file>'`. A file of the unit gets "commit it with `cstack unit commit <n> --message "<subject>"`, or undo it". The message lists at most twenty files, then says how many more there are. It escapes control characters in each name, as `quote()` in `cstack/src/settings.ts` does. It also says that a file that git ignores can stay. (2026-11-20, accepted by default in the question round)
- When git cannot read the child worktree of the record, for example because the folder no longer exists, `cstack helper done` exits with 5. The message says why, and the report is not saved. Exit code 1 would make the implementer believe that it must fix its work. (2026-11-20, accepted by default in the question round)
- The implementer prompt says this. When your inputs give a setup command, run it once from the root of your worktree before your first test run. Never run another install command, such as `npm install`. When your inputs give no setup command and the text that started you asks you to install, use a command that does not change the lock file, such as `npm ci`. (2026-11-20, the user's answer)
- The implementer prompt says this too, in its step that runs `git status`. Delete with `rm -- <file>` every untracked file that you created outside your `Files` line, unless git ignores it. Restore with `git restore -- <file>` every tracked file that a command changed outside your `Files` line. Never run `git clean` or `git restore .`, because they would delete `node_modules` or the work of the unit. A file that the unit needs outside its `Files` line is still a reason to report stuck. When `cstack helper done` refuses a `done` report because of such files, clean them up as its message says and run it again. (2026-11-20, the user's answer)
- In `README.md`, add two sentences about `setupCommand` to the line of `cstack helper start`, where `--child-worktree` is explained. Do not change the line of `cstack helper done` or the line of `cstack unit collect`. (2026-11-20, accepted by default in the question round)
- `.cstack/settings.json` of this repository stays unchanged in this branch, and cstack 0.3.0 would refuse the new key anyway. The pull request and the comment on the ticket say that `"setupCommand": "cd cstack && npm ci"` goes into it in a separate commit once 0.3.1 is installed. The same holds for the settings of the comparison sandbox of #32. (2026-11-20, accepted by default in the question round)
- In the tests, the setup command is a plain string, such as `npm ci`, that no test ever runs. The tests use the fake Orca runner and the temporary repositories of `cstack/test/helpers/plan-repo.ts`. A temporary repository commits its `.cstack/settings.json`, because a child start refuses uncommitted files. (2026-11-20, assumption not asked)

## Architecture

The approach is locked by the answers of the question round, so I wrote no architecture options. The settings reader learns one more optional key. `cstack helper start` reads it only for a helper that works in a child worktree, and passes it as one input line in the spec or in the printed sub-agent inputs. The implementer runs it as its first step. `cstack helper done` refuses a `done` report while the child worktree holds any change that would make `cstack unit collect` keep it. The implementer prompt tells it how to clean up before that check. No new decision since the question round.

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

### Unit 1: Read setupCommand from the settings file
- Files: `cstack/src/settings.ts`, `cstack/src/settings-block.ts`, `cstack/test/settings.test.ts`, `cstack/test/next-settings.test.ts`
- Test: `cstack/test/settings.test.ts`: a settings file with `"setupCommand": "npm ci"` gives `setupCommand` the value `npm ci`, marked as from the file. A file without the key gives `undefined`, marked as default, and every other value stays as before. An empty value, a value with a line break and a value whose first word is in `forbiddenTools` are each refused with a problem on the path `setupCommand`.
- Minimum code: add `setupCommand: string | undefined` to `SettingValues`, right after `testCommands`, with the default `undefined` in `DEFAULTS`. In `readSettings`, check the value with the same rules as a test command, without the `{file}` rules: a non-empty string on one line, with no control character, whose first word is not in `forbiddenTools`. Reuse the parts of `checkTestCommand` that apply, and keep `quote()` for the value in messages. In `cstack/src/settings-block.ts`, print `not set` for any value that is `undefined`, so `setupCommand` prints like `testCommands`.
- Refactor: none.
- Commit message: feat(cli): read an optional setupCommand from the settings file
- Depends on: none
- Worktree: ~/orca/workspaces/claude-code-stack/child-setup-unit-1-110503

The existing cases that list every key change with this unit. They are the file with only the version, the full file, and the example settings file, which now holds every key except `testCommands`, `setupCommand` and `review`. In `cstack/test/next-settings.test.ts`, the printed key list gains `setupCommand` after `testCommands`, and a file without the key prints `- setupCommand: not set (default)`.

### Unit 2: Give the setup command to an implementer that works in a child worktree
- Files: `cstack/src/helper/start.ts`, `cstack/src/helper/spec.ts`, `cstack/test/helper/child-worktree.test.ts`, `cstack/test/helper/child-escalation.test.ts`, `cstack/test/helper/spec.test.ts`
- Test: `cstack/test/helper/child-worktree.test.ts`: with `"setupCommand": "npm ci"` committed in `.cstack/settings.json`, the spec file of an implementer started with `--worktree new-child` holds the line `- Setup command: npm ci` and the sentence to run it before the first test run, and `worker-start` still gets `--setup skip`. Without the key, the spec holds the install sentence that asks for a command that does not change the lock file, and no `- Setup command:` line. When Orca refuses the new child start with a clear error, the printed sub-agent inputs hold no `- Setup command:` line. An invalid `setupCommand` makes the start exit with 3 before any `worker-start` call.
- Minimum code: add an optional `setupCommand` to `HelperInputs` in `cstack/src/helper/spec.ts`. `buildSpec` writes `- Setup command: <command>` in the input list when it is set, and picks the child worktree sentence from the two texts that `## Decisions` gives. Update the `WHY:` comment on line 1 as `## Decisions` says. In `startHelper`, read `readSettings(located.root).values.setupCommand` only when the helper will work in a child worktree: when a reused child worktree is found, and when a new child start passed the checks that keep it a child. Do it before any Orca call. Set the setup command on the inputs of the spec for these starts only. Make sure that the inputs of `fallback()` after a refused new child start do not carry it, because that sub-agent works in the ticket worktree. `fallback()` prints `- Setup command: <command>` when its inputs carry one, which happens only for a reused child worktree.
- Refactor: none.
- Commit message: feat(cli): give the setup command to an implementer that works in a child worktree
- Depends on: 1

Add a case to `cstack/test/helper/child-escalation.test.ts`: with the key committed, a second attempt that reuses the child worktree with `CSTACK_ORCA_WORKERS=off` prints `- Setup command: npm ci` among its sub-agent inputs. In `cstack/test/helper/spec.test.ts`, update the case that checks the install sentence of a child worktree. Never run the real `orca` or `npm`.

### Unit 3: Refuse a done report while the child worktree holds uncommitted changes
- Files: `cstack/src/helper/done.ts`, `cstack/test/helper/done.test.ts`
- Test: `cstack/test/helper/done.test.ts`: an implementer record whose `worktree` is a real child worktree, made with `git worktree add` inside the temporary repository. A `done` report while the child holds an untracked `package-lock.json` exits with 1, names `package-lock.json` with `rm -- 'package-lock.json'` on standard error, saves no report and calls no Orca command. A file under `node_modules/` that the child's `.gitignore` covers is accepted. A `stuck` report with the stray `package-lock.json` is accepted.
- Minimum code: in `doneHelper` of `cstack/src/helper/done.ts`, after the branch that only sends a saved report again and before `checkReport`, run the check that `## Decisions` describes when `record.worktree` is set and the kind is `done`. Read the `Files` line of the unit with `readPlan` from the plan file that `locatePlan` found. Parse the `-z` status locally: each entry is two status letters, a space and a path, and `--no-renames` gives one path per entry. Leave out the plan file, whose path relative to the root is `located.relative`. Build the message as `## Decisions` says, with at most twenty files, and throw a `HelperError` with exit code 1. When git cannot read the folder, throw a `HelperError` with exit code 5.
- Refactor: none.
- Commit message: feat(cli): refuse a done report while the child worktree holds uncommitted changes
- Depends on: none
- Worktree: ~/orca/workspaces/claude-code-stack/child-setup-unit-3-110509

Add these cases to the same test file. A tracked file outside the `Files` line that is changed gets `git restore -- '<file>'`. A changed file of the unit gets the hint to commit it with `cstack unit commit` or to undo it. A changed plan file alone is accepted. An `implementer-escalation` record with a `worktree` is checked the same way. More than twenty stray files list twenty and say how many more. A record whose worktree folder does not exist exits with 5. An implementer record without a `worktree` is not checked. Do not change `cstack/src/helper/child.ts` or `cstack/src/unit/collect.ts`.

### Unit 4: Tell the implementer how to set up and clean up its worktree
- Files: `cstack/skills/resolve-issue/agents/implementer.md`, `cstack/test/prompts.test.ts`
- Test: `cstack/test/prompts.test.ts`: the implementer prompt names the setup command of its inputs and says to run it before the first test run. It forbids `npm install`. It says to delete with `rm --` the untracked files it created outside its `Files` line, and to restore with `git restore --` the tracked files that a command changed there. It forbids `git clean`. The existing checks of the order of `cstack unit red`, `green`, `commit` and `cstack helper done` still pass.
- Minimum code: in `implementer.md`, add the setup command to the `## Inputs` list, as an input given only in a child worktree. Add the install rules of `## Decisions` before the first test run. Extend step 6 with the clean-up rules of `## Decisions`. Add one sentence to `## Your report` about a refusal of `cstack helper done` because of uncommitted files. Keep the line `cstack helper done <kind> --helper <helper id> --plan <plan file>` exactly as it is, because the end-to-end tests look for it.
- Refactor: none.
- Commit message: docs(skill): tell the implementer how to set up and clean up its worktree
- Depends on: none
- Worktree: ~/orca/workspaces/claude-code-stack/child-setup-unit-4-110515

### Unit 5: Document setupCommand and the Script Editor setting in the README
- Files: `README.md`
- No test: the change is two sentences of prose in the README, and no test reads them.
- Minimum code: in the line of `cstack helper start`, after the sentence about `--child-worktree`, add two sentences. The first says that when `.cstack/settings.json` has a `setupCommand`, such as `npm ci`, the implementer runs it first in its child worktree. The second says that without it, the implementer installs the packages as the conventions file says, with a command that does not change the lock file. In the `--watch` paragraph, add one sentence that says that macOS shows the notification only when you allow notifications for Script Editor, in System Settings, then Notifications.
- Refactor: none.
- Commit message: docs: document setupCommand and the Script Editor setting in the README
- Depends on: none
- Worktree: ~/orca/workspaces/claude-code-stack/child-setup-unit-5-110529

Follow the documentation writing rules of this repository: one idea per sentence, plain words, and sentences under about twenty-five words. Do not touch the line of `cstack unit collect` or the line of `cstack helper done`.

**Security.** No endpoint or database is involved. Two inputs come from outside cstack. `setupCommand` is checked by the settings reader in unit 1 before unit 2 writes it into the spec. File names from `git status` are escaped in unit 3 before they reach the terminal.

## Documentation duties

- README: applies, written to `README.md` by unit 5. It covers `setupCommand` in the line of `cstack helper start`, and the Script Editor setting in the `--watch` paragraph.
- Code comments: applies, written to the `WHY:` comment of `cstack/src/helper/spec.ts` by unit 2.
- Decision record: does not apply. ADR-SIC-D already says how the settings file grows, and the choice of who runs the setup command is recorded in this plan file and in the ticket comment.
- Specification page `docs/projects/skills-into-cli.md`: check in the document phase whether it describes the install in a child worktree. Change it only if it says something that this branch makes wrong.
- Ticket comment on #75: applies. It says what was built, the answers of the question round, and the follow-up commit that adds `setupCommand` to this repository's settings once 0.3.1 is installed.
- Comment on the ticket that this one feeds, the comparison runs (#32): applies. It says that the settings of the comparison sandbox need a `setupCommand` once 0.3.1 is installed, or the implementers of parallel units install as the conventions file says.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: who runs the setup command
Who runs the `setupCommand` in a new child worktree: `cstack helper start`, before the implementer starts, or the implementer, as its first step?
- For: the user
- Answer: the implementer runs it, as its first step. `cstack helper start` reads `setupCommand` and gives it in the inputs of the implementer. Source: the user's answer "go" in the conversation on 2026-11-20, which accepted the recommended answer.

### Question 2: a repository with no setup command
When `.cstack/settings.json` has no `setupCommand`, does an implementer in a child worktree install nothing at all, even when the conventions file says how to install the packages?
- For: the user
- Answer: no. When the key is missing, the implementer still installs the packages as the conventions file says, but only with a command that does not change the lock file, such as `npm ci` instead of `npm install`. This changes item 3 of the ticket for repositories without the key. Source: the user's answer "go" in the conversation on 2026-11-20, which accepted the recommended answer of the review before the plan.

### Question 3: which files make `cstack helper done` refuse
Should `cstack helper done` refuse a `done` report while the child worktree holds any uncommitted change other than the plan file, or only while it holds a change outside the `Files` line of the unit?
- For: the user
- Answer: refuse every uncommitted change in the child worktree except the plan file, which is the rule of `cstack unit collect`. The message gives one hint for a file of the unit and another for a file outside it. Source: the user's answer "go" in the conversation on 2026-11-20, which accepted the recommended answer.

## Review log

Impact notes. The branch changes `readSettings`, `checkTestCommand`, the settings block printer, `buildSpec`, `startHelper` and `doneHelper`. I searched their callers and tests. The usual companions are the settings tests, the next-settings tests and the helper tests, and the branch updates all of them. No recorded decision conflicts with the change.

Correctness reviewer. One real bug: `git status` in `cstack helper done` stopped at Node's one megabyte output limit, so a child worktree with thousands of untracked files made the command exit with 5 instead of listing the files. I fixed it with a larger `maxBuffer` and added a test with 9000 long file names that fails without the fix. Two smaller notes were left: a staged file outside the unit gets a restore hint that does nothing, which only happens if an agent ran `git add`, and the settings are read after two read-only Orca checks, which changes nothing.

Security reviewer. Nothing serious. A file name with a control character shows an escaped name in the hint, so the `rm` command in the hint would not match that file. I accepted this trade-off for terminal safety.

Conventions reviewer. Nothing broken. It noted three copies of `shellQuote` and a status check that repeats the one in `cstack unit collect`. I left both as follow-ups.

Simplicity reviewer. It suggested sharing `shellQuote` and the git status parsing, dropping the twenty-file cap, and reading the settings once in `start.ts`. I kept the cap and the unit-file hint because the question round decided them. The rest are small follow-ups.

Tests. After the fix, `npm run typecheck` and the whole `npm test` pass (116 files, 1456 tests). One earlier run had two timeouts while other test runs went on at the same time, and the next runs were clean.

Independent reviewer. It changed nothing and found no bug, no security problem, no broken convention and no missing acceptance criterion. Typecheck and the full test suite pass. Judgment calls for the pull request body: a staged file outside the unit gets a restore hint that does nothing, but agents never run `git add`. The README line of `cstack helper done` does not mention the new refusal, on purpose, because ticket #74 edits that area, so a short follow-up fits after both merge. The settings are read after two read-only Orca checks, which changes nothing. `shellQuote` has three copies and the git status parsing repeats `cstack unit collect`, both recorded as follow-ups.

## Briefing

### What you should know about what was built

The branch does what the ticket asks. An implementer in a child worktree now gets the `setupCommand` of the settings as an input. When the key is missing, it installs with a command that does not change the lock file. `cstack helper done` refuses a finished report while the child worktree holds any uncommitted file other than the plan file, and its message gives the exact command that fixes each file. Typecheck and the full test suite pass.

**What you need to do**

**Add `setupCommand` to this repository's settings only once every machine that runs cstack here has 0.3.1.** cstack 0.3.0 refuses an unknown key. So if the key arrives too early, every cstack command exits with 3 on a machine that has not updated. Once 0.3.1 is installed, commit `"setupCommand": "cd cstack && npm ci"` to `.cstack/settings.json` on `main`. The settings of the comparison sandbox (#32) need the same key. Until then, implementers install as the conventions file says, and that works.

Once this pull request and the one that fixes the collect (#74) are both merged, the README line of `cstack helper done` needs one sentence about the new refusal. I left it out on purpose, because #74 edits that area.

**What to watch**

On the first run with parallel units after the merge, check that each implementer ran `npm ci` and not `npm install`, and that `cstack unit collect` removed the child worktrees. Every child now holds a full `node_modules`. I checked that `git worktree remove`, which Orca runs without `--force`, removes a worktree whose only extra files are ignored ones.

A file outside the unit that someone staged with `git add` gets a `git restore` hint that does nothing, so the implementer could loop on it. Implementers never run `git add`, so fix it only if you see it happen.

**What changed since the plan**

The correctness review found that `git status` stopped at Node's one-megabyte output limit. A child with thousands of untracked files then exited with 5 instead of listing them. That is fixed, with a test of 9000 file names.

#### Details

What was built matches the ticket and the answers of the question round. Unit 1 adds the optional key `setupCommand` to `cstack/src/settings.ts`, checked with the rules of a test command minus the `{file}` rules, and `cstack/src/settings-block.ts` now prints "not set" for any missing value. Unit 2 reads the key in `startHelper` (`cstack/src/helper/start.ts`) only for a reused child worktree and for a new child start that passed its checks, and writes `- Setup command: <command>` into the spec or the printed sub-agent inputs. Unit 3 adds `checkChildWorktree` to `cstack/src/helper/done.ts`, with the same `git status` flags as `cstack unit collect` and the same exception for the plan file. Unit 4 adds the install and clean-up rules to `cstack/skills/resolve-issue/agents/implementer.md`. Unit 5 adds the README sentences. Every acceptance item is met: the settings cases, the refused `package-lock.json` with its name in the message, the accepted ignored file, the accepted stuck report, fake programs only, and a green `npm test` and `npm run typecheck`. Item 3 of the scope was changed on purpose by the answer to Question 2, so a repository without the key still installs as its conventions file says.

The settings key must wait for 0.3.1 on every machine. ADR-SIC-D says a reader refuses an unknown key, and that decision is locked. A machine still on 0.3.0 that reads a settings file with `setupCommand` makes every command that reads the settings exit with 3. The coordinator pushes the tag `v0.3.1` once this branch and #74 are merged, as `## Decisions` says. After that, the follow-up commit adds `"setupCommand": "cd cstack && npm ci"` to `.cstack/settings.json` on `main`, and the comment on #32 asks for the same key in the sandbox settings. If nobody adds the key, nothing breaks in this repository, because its conventions file says to run `npm ci` in `cstack/`. A repository whose conventions file says nothing about installing would leave the implementer of a child with no packages, and it would report stuck when its first test cannot run. The command runs from the worktree root, as `testCommands` do, which is why it needs `cd cstack`.

The README line of `cstack helper done` does not mention the new refusal. The independent review accepted this, because #74 changes the neighbouring README lines and a conflict there is not worth it. It is a one-sentence follow-up after both merges. If nobody writes it, the prompt of the implementer and the refusal message still say what to do, so only a human reader of the README misses it.

Every child worktree now holds a full `node_modules` until `cstack unit collect` removes it. I checked that this does not block the removal. Orca's main process (read in `app.asar` of the installed app, never run) removes a worktree with `git worktree remove`, and adds `--force` only when asked. Git checks that a worktree is clean with a status that leaves ignored files out. I confirmed it in a scratch repository: a child that held only an ignored `node_modules/` was removed with exit code 0. In this repository, `.gitignore` covers `cstack/node_modules/` and `cstack/dist/`. A child that the collect keeps, for example after a stuck unit, keeps its `node_modules` and its disk space until someone removes it. A second attempt in a reused child gets the setup command again, and `npm ci` deletes and reinstalls `node_modules`. That is slower but correct. The first parallel run after the merge is the real test, because no test runs the real `npm` or `orca`.

The hint for a staged file is wrong in one rare case. The check reads the two status letters and gives `git restore -- <file>` for any tracked or staged entry outside the unit. For a file that was staged with `git add`, `git restore` restores the working copy from the index and changes nothing, so the refusal repeats. The prompt forbids `git add`, and `cstack unit commit` stages only the files of the unit, so this happens only if an agent breaks that rule. The fix would be a `git restore --staged --worktree -- <file>` hint for an entry whose first letter is not a space. The correctness and independent reviewers both recorded it as a follow-up.

The settings are read after two read-only Orca feature checks, not before any Orca call as line 154 of `## Decisions` says. They are still read before `worker-start` and before the plan file is copied into a reused child, so an invalid `setupCommand` still starts nothing and changes nothing. The reviewers judged this harmless, and so do I.

The correctness review found one real bug after the build. `spawnSync` keeps at most one megabyte of output by default, so a child with thousands of untracked files made `git status` fail and `cstack helper done` exit with 5. The fix raises `maxBuffer` to 256 megabytes, and a test with 9000 long file names fails without it. `cstack unit collect` reads the same status with the default limit (`git` in `cstack/src/unit/collect.ts`, line 16). There, the limit can only matter for a child that ended with a stuck report, because `cstack helper done` now refuses a finished report from such a child. The collect then keeps the child with a confusing "git cannot read" message, and loses nothing. That file belongs to #74, so this branch does not touch it, and it is a small follow-up.

The first word of `setupCommand` is checked against `forbiddenTools`, as for the test commands. A value such as `cd cstack && <tool>` passes that check whatever the tool is. This is not a security boundary, because the team commits the settings file itself, and the `WHY:` comment of `cstack/src/helper/spec.ts` says so. Nobody needs to act on it.

The earlier questions are all resolved. Question 1 was answered "the implementer runs it", and the build gives the command as an input line and passes `--setup skip` as before. Question 2 was answered "install as the conventions file says, with a command that does not change the lock file", and the spec sentence and the prompt say exactly that. Question 3 was answered "the rule of `cstack unit collect`", and the check uses the same status flags and the same plan file exception. The shared `childWorktree` flag that I raised before the plan is handled. A refused new child start now gets a copy of the inputs taken before the setup command is set, and `cstack/test/helper/child-worktree.test.ts` checks that its printed inputs hold no setup line. The refusal gives `rm --`, `git restore --` or the `cstack unit commit` hint per file, the prompt forbids `git clean` and `git restore .`, an unreadable child exits with 5, the list stops at twenty with a count, and control characters are escaped.

I found no new question, blocking or not. I cite these locked decisions and do not reopen them: ADR-SIC-D for the settings key, ticket #28 for `--setup skip`, and ADR-SIC-A for the fallback to sub-agents. I checked security, data model lock-in, scale, failure modes, user-facing edge cases, operations and cost, reversibility and hidden coupling, and found nothing beyond the points above in data model lock-in, scale, and operations and cost.

## Non-blocking questions

none

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

Title: feat(cli): set up a child worktree for its implementer and leave no stray file in it

````markdown
## What this does

When two units of a ticket run at the same time, each implementer works in its own child worktree. That worktree starts with no installed packages. This pull request lets the implementer install them, and it keeps stray files out of the worktree.

The settings file `.cstack/settings.json` now accepts an optional `setupCommand`, such as `npm ci`. It follows the same rules as a test command. `cstack helper start` puts the command in the implementer's inputs, and the implementer runs it first, before its first test run. `cstack helper start` does not run it. Without the key, the implementer installs as the conventions file says, with a command that does not change the lock file.

`cstack helper done` now refuses a `done` report while the child worktree holds any uncommitted change, except the plan file. This is the rule that `cstack unit collect` already uses. The message names each file, gives the command that fixes it, and lists at most twenty files. A `stuck` report is never checked.

The implementer prompt explains the install and clean-up rules. The README has two new sentences about `setupCommand` and one about the Script Editor notification setting on macOS.

## Decisions

The implementer runs the setup command, not `cstack helper start`, so cstack never runs a command from a settings file by itself. The refusal covers every uncommitted file, so it agrees with `cstack unit collect`. During review I fixed one bug: `git status` stopped at Node's one megabyte output limit, so a worktree with thousands of untracked files made the command exit with 5. A test with 9000 file names now covers it.

## Judgment calls from the independent review

A staged file outside the unit gets a `git restore` hint that does nothing, but implementers never run `git add`. The README line of `cstack helper done` does not mention the new refusal, because #74 edits that area. A short follow-up fits after both merge. The settings are read after two read-only Orca checks, which changes nothing.

## Follow-ups

`shellQuote` now exists in three places, and the git status parsing repeats the one in `cstack unit collect`. This repository's own settings file still needs a `setupCommand`. Add it only after version 0.3.1 is installed on every machine that runs cstack here, because version 0.3.0 refuses an unknown key.

## Checks

`npm run typecheck` and the whole `npm test` pass.

The plan file is `docs/plans/2026-11-20-75-set-up-a-child-worktree-and-leave-no-stray-file.md`.

Fixes #75
````

## Documentation

- Comment on #75 (https://github.com/gambitl/claude-code-stack/issues/75): what was built, the answers of the question round, and the follow-ups.
- Comment on #32, the comparison runs: the sandbox settings need a `setupCommand` once 0.3.1 is installed.
- README: written by unit 5.
- Code comment: the `WHY:` comment of `cstack/src/helper/spec.ts`, written by unit 2.
- Decision record: none, because ADR-SIC-D already covers how the settings file grows.
- Specification page `docs/projects/skills-into-cli.md`: checked, and nothing in it is made wrong by this branch.

## Executor notes

Nothing this time.

## Hand-off log

- 2026-11-20: I moved #75 to "in progress" with `cstack tracker move`, committed the plan file, and built units 1, 3, 4 and 5 in child worktrees, then unit 2 in the ticket worktree. All five units are committed.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**Who runs the setup command in a child worktree: the implementer, as its first step.** Orca creates the child worktree and starts the agent in one call. Its `--setup` flag only runs Orca's own project setup. So cstack has no moment to run the command itself without racing the agent. The implementer is also the only option that works without Orca, when a sub-agent continues in a reused child worktree. I recommend the implementer.

**With no `setupCommand`, I would keep "install as the conventions file says", instead of installing nothing.** The ticket says the implementer installs nothing in that case. But no repository has the key today, this one included, and this branch may not add it. Without packages, `cstack unit red` saves a "vitest not found" failure that the implementer may take for the expected one. The new check of `cstack helper done` catches a rewritten lock file anyway. I recommend keeping today's sentence when the key is missing, with "use a command that does not change the lock file". This changes item 3 of the ticket.

**`cstack helper done` refuses every uncommitted change except the plan file, not only the changes outside the `Files` line.** This is the exact rule of `cstack unit collect`. With the rule of the ticket, a forgotten file of the unit would pass the check and still block the collect, as in the run of #31. I recommend the collect rule, with a different hint for a file inside the unit and a file outside it.

**I will do this unless you say no**

- I keep the five detail points of the draft: both implementer roles, the checks on `setupCommand`, where the implementer reads it, the prompt and the README.
- I decide on the setup line from the folder where the agent really works, not from the `childWorktree` flag. That flag is shared. When Orca refuses to start a child, the fallback sub-agent runs in the ticket worktree with the flag still true. It would then run `npm ci` under the tests of the other units.
- The refusal gives the exact command for each file, `rm` or `git restore -- <file>`. The prompt forbids `git clean` and `git restore .`, which would delete `node_modules` or the work of the unit.
- When git cannot read the child worktree, the command exits with 5, not 1. With 1, the implementer believes it must fix its work and retries in a loop.
- The refusal lists at most twenty files, and each name goes through `quote()`.

**I checked it myself**

I read the rule of `cstack unit collect` (`collect.ts`, lines 177 to 187). It keeps the worktree for any uncommitted change except the plan file. Reports and run state live in the git folder, so cstack itself leaves no file in a child worktree.

**Good to know**

cstack 0.3.0 refuses a settings file that holds `setupCommand`. So `"setupCommand": "cd cstack && npm ci"` goes into this repository's settings in a separate commit, once 0.3.1 is installed. The check of `cstack helper done` covers only child worktrees. In the ticket worktree, only the prompt rule protects.

#### Details

Who runs the setup command is blocking, and only the user can choose it, because the ticket asks the question round to choose. I keep the draft recommendation: the implementer runs it as its first step, and `cstack helper start` passes it in the inputs. The draft states that `orca orchestration worker-start` creates the worktree and starts the agent in one call, and that `--setup <run|skip|inherit>` only runs Orca's own project setup. I did not re-read the Orca source, because this run may not run `orca`, so that statement rests on the draft's reading. Running the command from cstack after the start would race the worker. Creating the worktree first with `orca worktree create` was rejected by ticket #28, because a failed second call leaves a worktree with no worker. Mapping `setupCommand` onto Orca's own project setup and passing `--setup run` would reopen the choice of #28, which locked `--setup skip`, and it would not work in the sub-agent fallback. ADR-SIC-A and the epic rule say that every feature that uses Orca also works without Orca. A sub-agent that continues in a reused child worktree (`fallback` with `reuse` in `cstack/src/helper/start.ts`, lines 237 to 243) needs the same install, and only the implementer can run it there. If nobody decides, the draft default applies.

What happens with no `setupCommand` is blocking, and I disagree with the draft. The draft follows scope items 2 and 3 of the ticket: with no key, the implementer installs nothing. Today no repository has the key, and ADR-SIC-D means cstack 0.3.0 refuses a settings file that holds it, so the key can only arrive after 0.3.1 is installed. This branch may not change `.cstack/settings.json`. So, right after the merge, every parallel unit in this repository and in the comparison sandbox of #32 starts with no packages. The implementer would then run `cstack unit red`, which saves a failure caused by a missing `vitest`, and step 4 of `implementer.md` only asks it to check that the failure "shows the reason the unit expects". A tired agent can take that failure for the expected one. My recommendation is a fallback: when the key is missing, the spec keeps today's sentence of `cstack/src/helper/spec.ts` (line 124), with one addition that asks for a command that does not change the lock file, such as `npm ci`. When the key is set, the spec names only that command, and the prompt forbids any other install command. The original failure cannot come back silently, because the new check of `cstack helper done` refuses a rewritten or new lock file. This changes the wording of scope item 3, which is an acceptance change, so the user must confirm it. If the user keeps the strict reading, the spec must say instead that this worktree has no packages and no setup command, and that a test command that fails for missing packages is a reason to report stuck. The test of `spec.test.ts` (line 83) checks the current sentence, so it changes either way.

Which files make `cstack helper done` refuse is blocking, and I keep the draft recommendation. I confirmed the rule of `cstack unit collect` in `cstack/src/unit/collect.ts`, lines 177 to 187. It runs `git status --porcelain -z --untracked-files=all --no-renames` in the child worktree and keeps the worktree for any entry other than the plan file. The ticket's rule, "outside the unit's `Files` line", would accept a `done` report with an uncommitted file of the unit, and the collect would still keep the worktree. That is the failure of #31 by another road. The check should use the same `git status` flags as the collect, including `--no-renames`, so that the two can never disagree. `ticketWorktreeProblems` in `cstack/src/helper/child.ts` does not pass `--no-renames`, so reusing it as is would differ. This rule changes the acceptance wording of scope item 4, which is why it stays a question for the user.

The `childWorktree` flag is shared between the Orca start and the fallback, and that is a hidden coupling. In `startHelper`, `fallbackInputs` is the same object as `inputs` when no worktree is reused (start.ts line 237). Line 267 then sets `inputs.childWorktree = true` before the `worker-start` call. When Orca refuses that call, line 294 calls `fallback(role, fallbackInputs, ...)`, and the sub-agent runs in the ticket worktree with the flag still true. Today `fallback` does not print that flag, so nothing breaks. Once the flag decides whether the inputs carry the setup command, that sub-agent would run `npm ci` in the ticket worktree. `npm ci` deletes `node_modules` first, so the tests of other running units would fail at random. The plan should decide the setup line from the real folder: a new child for an Orca worker, or `reuse` for a fallback. It should add a test where Orca refuses a new-child start and the sub-agent inputs carry no setup command.

The hints of the refusal need exact commands. An agent told to "delete the stray files" may reach for `git clean -fdx`, which also deletes ignored files such as `node_modules`, or for `git checkout .` or `git restore .`, which wipe the uncommitted work of the unit. The refusal should name, for each file, `rm -- <file>` for an untracked file and `git restore -- <file>` for a tracked one outside the unit, and "commit it with `cstack unit commit`" for a file of the unit. The prompt should forbid `git clean` and a `git restore` or `git checkout` of a whole folder.

The exit code when git cannot read the child worktree should be 5, not 1. `cstack/src/manifest.ts` defines 1 as "a rule that cstack enforces said no" and 5 as "a tool that cstack ran failed". The spec tells the implementer to fix its work when the command refuses, and to run the command once more and then stop when it exits with 5. With 1, an implementer whose worktree git cannot read would loop on a problem it cannot fix. The draft says 1, and I would change it. The default if nobody decides is 5.

The refusal message must stay readable and safe. In a repository that does not ignore its installed packages, `--untracked-files=all` can list tens of thousands of files. The message should list the first twenty and give the count of the rest. File names come from the working tree, so each name goes through `quote()` of `cstack/src/settings.ts` (line 98) or the same escaping, so that a control character cannot reach the terminal.

I checked that cstack leaves no file in a child worktree. `saveUnitReport` writes under `runFolder`, which is in the common git folder (`cstack/src/report/reports.ts`, lines 189 to 200, and `cstack/src/run-state.ts`, line 96). `current-run` is in the git folder of the worktree. So a clean child stays clean after `cstack helper done`.

Adding the key to this repository is a follow-up that nobody owns yet. cstack 0.3.0 refuses an unknown key, as ADR-SIC-D decides (locked, not reopened). Once 0.3.1 is installed, `"setupCommand": "cd cstack && npm ci"` must go into `.cstack/settings.json` in a separate commit on `main`. The settings of the comparison sandbox of #32 need the same key. The command runs from the worktree root, as `testCommands` do. I would write this in the ticket comment for the ticket that feeds the comparison (#32). This is non-blocking, because the work of this ticket is correct whatever the answer.

The check of `cstack helper done` covers only child worktrees. A unit that runs alone in the ticket worktree is not checked, so there only the prompt rule prevents a stray file. A stray change there would make the next child start refuse, through `checkTicketWorktree`, so it is caught later, with a less clear message.

I cite these locked decisions and do not reopen them: ADR-SIC-D (a new key keeps version 1, and an unknown key is refused), ticket #28 (`--setup skip`, and no `orca worktree create` before the start), ADR-SIC-A (every Orca feature works without Orca) and ADR-SIC-H (exit codes, no `process.exit()`). I checked security, data model lock-in, scale, failure modes, user-facing edge cases, operations and cost, reversibility and hidden coupling. I found nothing beyond the points above in scale, operations and cost, and reversibility.

### Open questions and answers

**Blocking question 1** (blocking). The ticket asks the question round to choose who runs the setup command. I recommend the implementer, as its first step. `cstack helper start` reads `setupCommand` and gives it in the inputs of the implementer, in place of today's sentence "Install the packages as the conventions file says". I checked the other way. One `orca orchestration worker-start` call creates the child worktree and starts the agent, so cstack has no moment between the two. Its `--setup <run|skip|inherit>` flag only runs Orca's own project setup, never a command that cstack passes (help text of `worker-start` in the installed Orca app, read in its source and not run). A setup that cstack runs after the start would race the worker. Creating the worktree first with `orca worktree create` was rejected by #28, because a failed second call leaves a worktree with no worker. With the implementer, parallel units also install at the same time, and a failed install comes back as a stuck report with its output.

**Blocking question 2** (blocking). I recommend that the implementer installs nothing when there is no `setupCommand`, as the ticket says in scope items 2 and 3. The spec then stops telling it to install as the conventions file says. The cost is real: this repository has no `setupCommand` today, and this branch may not add one. So right after 0.3.1 is installed, `"setupCommand": "cd cstack && npm ci"` must go into `.cstack/settings.json` of this repository, and into the settings of the comparison sandbox of #32. Otherwise the next parallel units have no `node_modules`, and their implementers report stuck. cstack 0.3.0 refuses the unknown key, so the key can only be added once every machine runs 0.3.1.

**Blocking question 3** (blocking). The ticket says "outside the unit's `Files` line". `cstack unit collect` keeps a child worktree for any uncommitted change except the plan file, including a change to a file of the unit (`cstack/src/unit/collect.ts`, lines 177 to 187). A `done` report with uncommitted changes inside the `Files` line would pass the check and still make the collect keep the worktree, which is the failure of #31 by another road. I recommend the same rule as the collect: every uncommitted change except the plan file is refused, with a different hint for a file of the unit (commit it or restore it) and for a file outside it (delete it or restore it).

**The check of `cstack helper done` covers both implementer roles** (non-blocking, I will do this unless you say no). The check runs whenever the helper record has a child worktree, so it also covers the second attempt, which works in the same folder and follows `implementer.md`. A helper that worked in the ticket worktree is not checked, because the files of other units are legitimately changed there. A `stuck` report is always accepted. A file that git ignores always passes. When git cannot read the child worktree, the `done` report is refused with exit code 1 and a message that says why.

**How `setupCommand` is checked** (non-blocking, I will do this unless you say no). It is optional, and its default is "not set". It must be a non-empty command on one line, with no control character, and its first word must not be in `forbiddenTools`. `cstack next` prints "not set" for it when it is missing, as it does for `testCommands`. The example settings file of the skill stays without it.

**Where the implementer learns the setup command** (non-blocking, I will do this unless you say no). Whenever an implementer works in a child worktree, its inputs give the setup command. This holds for the spec of an Orca worker and for the inputs printed for a sub-agent, and for a second attempt too, because the first attempt may have stopped before its install ended. cstack reads the settings only when the helper works in a child worktree, so an invalid settings file makes only that start exit with 3, before any Orca call.

**What the implementer prompt says** (non-blocking, I will do this unless you say no). The implementer runs the setup command once, from the root of its worktree, before its first test run. It never runs another install command, such as `npm install`. Before `cstack helper done`, it deletes every untracked file that it created outside its `Files` line, unless git ignores that file. It also runs `git restore` on every tracked file that a command changed outside its `Files` line. A file that the unit needs outside its `Files` line stays a reason to report stuck, as today.

**Where the README documents `setupCommand`** (non-blocking, I will do this unless you say no). The README has no list of settings keys. I add two sentences to the `cstack helper start` line, where `--child-worktree` is explained. I also add the Script Editor sentence to the `--watch` paragraph. Neither line is the `cstack unit collect` line that #74 changes.

**Answers of the round, 2026-11-20.** The user answered "go" to the short version. Blocking questions 1, 2 and 3 take the recommended answers of the review before the plan, which are written under "Blocking questions". For Blocking question 2, the recommendation of that review replaced the draft one. Every point under "I will do this unless you say no", in the draft above and in the block "Questions you may not be asking", is accepted by default.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
