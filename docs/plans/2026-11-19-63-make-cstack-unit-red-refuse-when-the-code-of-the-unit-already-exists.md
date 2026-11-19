# Plan: #63 — M3-10: Make cstack unit red refuse when the code of the unit already exists

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/63
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/red-guard
Target branch: main
Conversation language: French
Status: ready for review
Approved at: 2026-11-19T20:48:15+01:00
Ready for review at: 2026-11-19T21:13:31+01:00

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** `cstack` refuses to record a test's first failure when the code of the unit was already written, so the rule "test first" no longer depends only on the agent obeying it.

- **What the title means**: The `resolve-issue` skill builds a ticket in small steps called units. Each unit writes a test first, sees it fail, then writes the code. `cstack unit red` is the command that runs the unit's test and saves the proof that it failed. `cstack unit green` runs the same test once the code exists and saves the proof that it passes.
- **Why we are doing it**: The first digest of the retrospectives found that implementers wrote the code before the test in 13 runs. In 5 of them, they then moved the code aside to get a failing run, and put it back afterwards. The saved proof then says only that a module was missing. A test that was never seen failing against the real code may check nothing. PR #62 added this rule to the implementer's prompt, but a prompt is only an instruction.
- **For the user**: The proof that each test failed first becomes trustworthy, so a green pull request means more.

**Goal.** This ticket makes `cstack unit red` refuse when a file of the unit, other than its tests, already changed. It also makes `cstack unit green` refuse when the code was written before the failing run and put back afterwards.

### Where things are today (read first)

* **The red command**: `cstack/src/commands/unit-red.ts` → `unitRed()` refuses only when the test passes (line 31, exit code `1`). It never looks at the other files of the unit.
* **The shared preparation**: `cstack/src/unit-test-command.ts` → `prepareUnitTest()` (line 33) reads the plan, the unit, its `Files` line and its test file, for both `red` and `green`.
* **The green command**: `cstack/src/commands/unit-green.ts` (line 82) compares the hash of the test file with the one that the red run saved, and warns when the test changed after the red run.
* **How the status of a unit's files is read today**: `cstack/src/commands/unit-commit.ts` → `checkUnit()` reads it with `git status --porcelain=v1 -z --untracked-files=all --no-renames -- <files>` (around line 105). Reuse the same reading rather than writing a second one.
* **The saved runs**: `cstack/src/unit-test-runs.ts` → `saveFailingRun()` writes `red.json`, with the time of the run. A second red run of the same unit replaces it.
* **The prompt rule**: `cstack/skills/resolve-issue/agents/implementer.md`, step 4, says to change only test files and their fixtures before `cstack unit red`, and never to move code aside. This ticket makes the command enforce it.
* **The evidence**: `docs/retros/reviewed/2026-11-19-digest.md`, proposal 10, lists the runs.
* **The tests**: `cstack/test/unit-red-green.test.ts` builds a small git repository with a plan and runs both commands.

### Scope

1. Before it runs the test, `cstack unit red` reads the git status of each file on the unit's `Files` line. A file counts as a test file when it is the file of the unit's `Test` line, or when its path has a `test`, `tests`, `__tests__` or `fixtures` folder, or when its name ends with `.test.<extension>` or `.spec.<extension>`. The question round can change this list.
2. When a file that is not a test file differs from `HEAD`, the command refuses with exit code `1` and saves nothing. A changed file, a new file and a deleted file all count. The message names each file. It says that the test must fail before any code of the unit exists, and that moving code aside is not allowed.
3. A new module that does not exist yet is fine. Its absence is the expected first failure, as the implementer's prompt says.
4. `cstack unit green` then looks at each file of the unit that is not a test file and that changed. When the file's modification time is older than the first failing run of the unit, the code existed before that run and was put back. `cstack unit green` then refuses with exit code `1` and names the file. Keep the time of the first failing run when a later red run replaces `red.json`, so that a second red run cannot hide the problem.
5. Decide in the question round what an implementer does when the test itself was wrong and must change after the code exists. Today `cstack unit green` only warns in that case. Keep that warning unless the question round decides otherwise.
6. Say in a code comment that the time check is a safety net, not a proof. A file copied back with a new modification time still passes it.

### Acceptance (TDD)

* `cstack/test/unit-red-green.test.ts`: write first a case where a source file of the unit is changed before `cstack unit red`. Expect exit code `1`, the file named in the message, and no `red.json`. See it fail on today's code, then pass.
* The same file: `cstack unit red` also refuses a new source file that is not a test file, and a deleted one.
* The same file: `cstack unit red` accepts a unit where only the test file and a fixture changed, and a unit whose new module does not exist yet.
* The same file: `cstack unit green` refuses when a changed source file is older than the first failing run, and accepts it when it is newer. Set the modification times in the test with `utimesSync`, never with a pause.
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

**Entry points.** `cstack/src/commands/unit-red.ts` → `unitRed()` calls `prepareUnitTest("red", …)`, then reads `HEAD` with `headCommit()`, hashes the test file, runs the test with `runTests()`, and refuses with exit code `1` only when the test passes (line 31). The new check of the unit's files goes after `prepareUnitTest()` and before `headCommit()`, so that a refusal runs no test and saves nothing. `cstack/src/commands/unit-green.ts` → `unitGreen()` reads `red.json` with `readSavedRun()` (line 22), refuses when the test command or the test file path changed (line 28), then runs the test, and warns at the end when the hash of the test file changed (line 82). The new time check goes after the test command check and before the test runs.

**Shared preparation.** `cstack/src/unit-test-command.ts` → `prepareUnitTest()` (line 33) returns `{ root, runDir, unit, testFile, commands, timeoutMs }`. `unit.files` is the list of paths of the `Files` line, relative to the repository root, and `unit.test.file` is the path of the `Test` line. The same file holds the small helpers `headCommit()`, `fileSha256()` and `printTestOutput()`. Git runs there with `spawnSync` and no shell.

**Reading the status of the unit's files.** `cstack/src/commands/unit-commit.ts` → `checkUnit()` (lines 105 to 111) runs `git status --porcelain=v1 -z --untracked-files=all --no-renames -- <files>` and splits the output on NUL. Each entry is `XY path`: `X` is the state in the index, `Y` the state in the working tree, and the path starts at the fourth character. `--untracked-files=all` lists each new file, also inside a new folder. A path that does not exist and is not tracked gives no entry, so a new module that does not exist yet is not a changed file. `checkUnit()` first drops the paths under a folder that is a symbolic link, because `git status` exits with an error on such a path. It compares paths in lower case, because git paths are compared without case on macOS. Ticket #64 changes `unit-commit.ts` in this wave, so the shared reading must live in a new file that only `unit-red.ts` and `unit-green.ts` import.

**Saved runs.** `cstack/src/unit-test-runs.ts` → `saveFailingRun()` deletes `green.json` and `green.log`, then writes `red.log` and `red.json` with `writeFileAtomic()`. A second red run of the same unit replaces `red.json`. The type `SavedUnitRun` extends `SavedTestRun` from `cstack/src/run-state.ts` (line 33: `time`, `command`, `exitCode`, `commit`, `testFile`) with `testFileSha256`. `cstack/src/saved-runs.ts` → `readSavedRun()` reads `red.json` or `green.json`, checks only `time`, and returns undefined when the file is missing. `deletePassingRun()` deletes the passing run of a unit. The run folder sits in the common git folder, so a child worktree and the ticket worktree share the saved runs of a unit.

**Other readers of `red.json`.** `cstack/src/commands/unit-commit.ts` compares `green.time` with `red.time` (line 72). `cstack/src/report/reports.ts` (line 117) and `cstack/src/commands/plan-status.ts` (line 55) only check that `red.json` exists. A new field in `red.json` does not change any of them, as long as `time` stays the time of the latest failing run.

**Tests.** `cstack/test/unit-red-green.test.ts` builds a git repository in a temporary folder with `setup()`. The plan has units whose `Files` line is `src/a.ts`, `test/a.test.ts`, and whose `Test` line is `test/a.test.ts`. `src/a.ts` does not exist in that repository, and `test/a.test.ts` is a new untracked file. The settings `FILE_SETTINGS` run the test file with `sh`, so a test body like `test -f src/feature.txt` decides the result. The existing tests write `src/feature.txt`, which is not on the `Files` line, so the new checks do not see it. `saveRed()` writes a `red.json` by hand with the current time. The existing case "saves the passing run after the code is written" waits 20 milliseconds with `setTimeout`. New cases must set times with `utimesSync` instead. `cstack/test/unit-test-runs.test.ts` tests `saveFailingRun()` directly.

**Companions that describe the behaviour.** `README.md` lines 65 and 66 describe `cstack unit red` and `cstack unit green`, and changed with these files in two of the last commits. `cstack/src/manifest.ts` lines 146 to 175 give the exit codes of both commands; the text of exit code `1` lists the refusals. Ticket #64 changes the usage line of `cstack unit commit` at line 176 of the same file, and ticket #31 changes `README.md`, so an edit there risks a small merge conflict. `docs/projects/skills-into-cli.md` lines 127 and 128 hold the acceptance criteria AC1 and AC2 of the two commands. The implementer's prompt `cstack/skills/resolve-issue/agents/implementer.md`, step 4, and `cstack/skills/resolve-issue/settled-decisions.md` line 56 state the rule that this ticket enforces. Neither of them may change in this wave.

**Tests that check every command.** `cstack/test/cli.test.ts` and `cstack/test/manifest-implemented.test.ts` run each built command with an unknown flag, and `cstack/test/manifest.test.ts` checks that each exit code has a meaning. This ticket adds no command, no flag and no usage line, so these tests need no change. A change to the exit code texts of `manifest.ts` keeps them passing.

**Risks.** The checks compare a file's modification time with the time of the first failing run. A test that writes a file and saves a run in the same millisecond could see equal times, so the comparison must be strict: only a time strictly older than the first failing run is refused. The green message of a changed test command (line 30) tells the implementer to "set the code aside", which the new rule forbids. The run folder is shared by every worktree of the ticket, so a red run in a child worktree and a green run in the same child worktree see the same `red.json`. History: these files were fixed twice for the deletion of an old passing run (`65da54e`, `c4123fc`), so a new refusal in `cstack unit green` must also say what happens to an earlier passing run.

**Governing decisions.** ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`) says how a command starts and ends: it checks its arguments first, prints through `io`, returns its exit code, and never calls `process.exit()`. The common exit codes are `1` for a refusal and `5` for a tool that failed, as in `headCommit()`. The `WHY:` comments of `unit-red.ts` and `unit-green.ts` say that the commit and the fingerprint are read just before the test runs. The epic's rule says that `cstack` works with any tracker and forge, which this ticket does not touch.

## Decisions

- When you plan, give each behaviour and its test to the same unit. When an earlier unit already builds what a later unit's test checks, that test passes at once, and the later unit cannot prove that its test failed first. (2026-11-19, from the coordinator of the wave)
- Some tests check every command or every shipped skill: `cstack/test/cli.test.ts`, `cstack/test/manifest-implemented.test.ts` and `cstack/test/skills-install.test.ts`. When a unit adds or changes a command or a skill, read those tests, and put on the unit's `Files` line the files they make you change. (2026-11-19, from the coordinator of the wave)
- Copy each open non-blocking question of the question round under `## Non-blocking questions`, word for word, with who it is for. (2026-11-19, from the coordinator of the wave)
- When the coordinator sends a new message before the approval gate, write each rule or answer it gives into `## Decisions` too. (2026-11-19, from the coordinator of the wave)
- The executor never builds a unit itself, even one of a few lines. Each unit goes to an implementer, which runs `cstack unit red` and `cstack unit green`. (2026-11-19, from the coordinator of the wave)
- The executor writes each Hand-off log entry and each line of Executor notes only once. (2026-11-19, from the coordinator of the wave)
- Before `cstack unit red` has saved a failure, an implementer changes only test files and their fixtures. It writes no source code before that. It never moves code aside to get a failure. A new module that does not exist yet is a fine first failure. (2026-11-19, from the coordinator of the wave)
- An implementer writes a test case for each behaviour, exit code and message that the unit or a line of `## Decisions` asks for. (2026-11-19, from the coordinator of the wave)
- An implementer never runs `git add`, `git commit`, `git commit --amend` or `git stash`. The stash is shared by every worktree of this repository, so another run could take the changes. (2026-11-19, from the coordinator of the wave)
- Never edit `cstack/src/commands/unit-commit.ts` in this branch, because ticket #64 changes it in the same wave. To reuse its way of reading the git status, put the shared function in a new file, and use it only from `cstack unit red` and `cstack unit green`. A later ticket can make `cstack unit commit` use it too. (2026-11-19, from the coordinator of the wave)
- Do not change any guide under `cstack/guides/` or any prompt under `cstack/skills/`, because tickets #31 and #64 change them in this wave. The messages of `cstack unit red` and `cstack unit green` must say by themselves what the implementer has to do. (2026-11-19, from the coordinator of the wave)
- Only ticket #31 changes the version in `cstack/package.json` and `cstack/package-lock.json`. This branch leaves the version as it is. (2026-11-19, from the coordinator of the wave)
- The implementers of this run use the installed `cstack unit red` and `cstack unit green` 0.2.0, not this branch's version. That is expected. Try this branch's code with the tests, or with `npm run build` in `cstack/` and then `node cstack/dist/bin.js` in a temporary test repository. (2026-11-19, from the coordinator of the wave)
- In the tests, set the modification times of files with `utimesSync`. Never wait in a test to make time pass. (2026-11-19, from the coordinator of the wave)
- Tests use fake programs, never the real `osascript`, `orca`, `gh` or `glab`. Run `git worktree add` only inside a temporary test repository. (2026-11-19, from the coordinator of the wave)
- Never run real `orca orchestration` commands that start, message or release workers. Never run `orca worktree create`, `orca worktree rm`, `cstack wave` or `cstack wave --watch` for real. Never call a Jira or Linear connection, and never run `glab`. (2026-11-19, from the coordinator of the wave)
- Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. Any of these would change the tool and the skill that every worker of this wave runs right now. (2026-11-19, from the coordinator of the wave)
- Never change `.cstack/settings.json` in this branch. The test commands come from that file on `main`, and the independent review refuses a branch that changes it, because the file names the reviewer. (2026-11-19, from the coordinator of the wave)
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). Read them as the reference for the old behaviour, but never edit anything under `skills/`. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`. Run `npm ci` in `cstack/` before the first type check or test run. The full `npm test` takes about 90 seconds, so give the shell call a timeout above two minutes. When only `cstack/test/report.test.ts` fails on a timeout, run it alone before you look for a bug. (2026-11-19, from the coordinator of the wave)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, report it to the user, and write it in the retrospective with the tag `[skill]`. (2026-11-19, from the coordinator of the wave)
- The stops of the skill are the blocked ticket, the question round, the approval gate of the plan and the questions after the build. Each stop goes to the user in the chat of the main conversation, and never to the coordinator. Nobody answers a stop in the user's place. The coordinator only hears about coordination, such as the state of another ticket of the wave. (2026-11-19, from the coordinator of the wave)
- The conversation with the user is in French. Everything written in the repository and on GitHub stays in English. (2026-11-19, from the coordinator of the wave)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-19, from the coordinator of the wave)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives, or a path from this machine such as one that starts with `/Users/`. This covers files, commits, the pull request, ticket comments, the plan file and the retrospective. (2026-11-19, from the coordinator of the wave)
- The history of this repository was rewritten on 2026-11-18 to remove private names, so do not undo that work. Every commit carries the GitHub no-reply address, the one that ends in `@users.noreply.github.com`, as author and as committer. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-19, from the coordinator of the wave)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. (2026-11-19, from the coordinator of the wave)
- After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, and keep both changes. Push it with a plain `git push`, without force. (2026-11-19, from the coordinator of the wave)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. In wave 7, one branch pushed a commit that still held conflict markers. (2026-11-19, from the coordinator of the wave)
- When you update the branch, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates in the plan file and in the commits. Never push a tag that starts with `v`. (2026-11-19, from the coordinator of the wave)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)
- Never merge the pull request, because the user merges it. Never read, run or change anything under `~/comparison/`, which holds private work data. Never install Graphify or Repowise. (2026-11-19, from the coordinator of the wave)
- `cstack unit red` refuses before it runs the test when a file of the unit that is not a test file differs from `HEAD`. A changed file, a new file and a deleted file all count. It exits with `1`, runs no test, writes nothing in the run folder, and leaves an earlier `red.json` and `green.json` as they were. A new module that does not exist yet is not a changed file, so it never causes this refusal. (2026-11-19, from the ticket)
- A file counts as a test file when it is the file of the unit's `Test` line, when its path has a folder named `test`, `tests`, `__tests__`, `fixtures`, `spec`, `specs`, `__mocks__`, `__snapshots__` or `testdata`, or when its name ends with `.test.<extension>`, `.spec.<extension>`, `_test.<extension>` or `_spec.<extension>`, or starts with `test_`. Every other file counts as code, Markdown included. (2026-11-19, the ticket's list widened, accepted by default after the user saw it)
- The refusal message of `cstack unit red` names each file and says whether it is changed, new or deleted. It says that the test must fail before any code of the unit exists, and that moving code aside to get a failure is not allowed. (2026-11-19, from the ticket)
- Three refusals tell the implementer what to do with the same text: the new refusal of `cstack unit red`, the new time refusal of `cstack unit green`, and the existing refusal of `cstack unit green` when the test command changed. That last message no longer says "Set the code aside". The text says this: if you made these changes yourself in this unit, discard them, with `git restore -- <file>` for a changed or deleted file and by deleting a new file. Then run `cstack unit red <n>` again, and write the code only after it saved the failure. If you did not make these changes, they may be the work of another unit, so do not discard them, and report the unit as stuck with this message. Write the text once in the code and use it in the three messages. (2026-11-19, the user's answer)
- `cstack unit green` refuses when a file of the unit that is not a test file differs from `HEAD`, still exists, and has a modification time more than two seconds older than the start of the latest saved failing run of the unit. It names each such file. The margin of two seconds avoids false refusals on file systems that keep times to the second and on Linux, whose file times can lag the clock by a few milliseconds. (2026-11-19, the user's answer on the reference time, and the margin accepted by default)
- The start of a failing run is the moment when `cstack unit red` reads the git status of the unit's files, just before its test runs. Every saved red run writes it in `red.json`, in a new field `startedAt`, as an ISO 8601 time. When `cstack unit green` reads a `red.json` without `startedAt`, because cstack 0.2.0 wrote it, it uses the field `time` instead. A file that the test run itself writes, such as a snapshot, then counts as newer than the reference. (2026-11-19, the user's answer on the reference time)
- The field `time` of `red.json` keeps its meaning, which is the time at which the failing run was saved, because `cstack unit commit` compares it with the time of the passing run. (2026-11-19, assumption not asked)
- The new field does not change the format version of the run state, `RUN_FORMAT` in `cstack/src/run-state.ts`. `red.json` gained `testFileSha256` the same way, and a version change would make cstack 0.2.0 refuse every run in progress. (2026-11-19, accepted by default after the user saw it)
- A deleted file has no modification time, so `cstack unit green` skips it in the time check. (2026-11-19, assumption not asked)
- `cstack unit green` runs the time check after its check of the test command, and before it runs the test. When it refuses, it runs no test, saves nothing, deletes any earlier passing run of the unit, and exits with `1`. The message says that any earlier passing run is deleted. (2026-11-19, assumption not asked)
- When the test file changed since the failing run and the test passes, `cstack unit green` keeps today's warning and still saves the passing run. The warning gets one more sentence, which asks the implementer to say in its report what changed in the test and why. (2026-11-19, the user's answer)
- A code comment next to the time check says that it is a safety net, not a proof. A file written back with a new modification time, for example by `git stash pop`, `git checkout` or a plain `cp`, still passes it. Only `mv` and copies that keep the time are caught. (2026-11-19, from the ticket and the advice before the plan)
- The paths of the `Files` line and of the `Test` line are compared with the paths that git prints without regard to case, as `cstack unit commit` does. (2026-11-19, assumption not asked)
- When `git status` fails, for example because the index file of git is damaged, `cstack unit red` and `cstack unit green` run no test, save nothing, print the message of git, and exit with `5`. A path under a folder that is a symbolic link does not make `git status` fail: git 2 exits with `0` and prints nothing for it. (2026-11-19, assumption not asked, and the behaviour of git checked in a temporary repository)
- `git status` prints `??` for a new untracked file, an `A` in either column for a new file that was added or marked with `git add -N`, and a `D` in either column for a deleted file. Every other entry is a changed file. (2026-11-19, the behaviour of git checked in a temporary repository)
- The reading of the git status of the unit's files lives in a new file, `cstack/src/unit-files.ts`. It runs the same git command as `checkUnit()` in `cstack/src/commands/unit-commit.ts`, which is `git status --porcelain=v1 -z --untracked-files=all --no-renames -- <files>`. Only `unit-red.ts` and `unit-green.ts` import it. (2026-11-19, assumption not asked)
- Update the text of exit code `1` of `cstack unit red` and of `cstack unit green` in `cstack/src/manifest.ts`, and the lines of the two commands in `README.md`. Touch nothing else in those two files, because tickets #64 and #31 change them in this wave. (2026-11-19, accepted by default after the user saw it)
## Architecture

The change is small, and the decisions lock the approach. A new file, `cstack/src/unit-files.ts`, reads the git status of the unit's files, tells test files apart, and holds the one text that tells the implementer how to start the unit again. `cstack unit red` notes its start time, reads the status of the unit's files, and refuses before it runs the test when a code file changed. Otherwise it runs as today, and it saves the start time in `red.json` as `startedAt`. `cstack unit green` keeps its check of the test command, then compares the modification time of each changed code file with `startedAt`, and refuses before it runs the test when a file is more than two seconds older. `cstack/src/commands/unit-commit.ts` does not change. The change touches no endpoint, no database query and no input from outside the machine. Git runs with `spawnSync`, with no shell, and the paths come after `--`. No security surface, skip.

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

### Unit 1: Read the changed files of a unit and tell its test files apart
- Files: `cstack/src/unit-files.ts`, `cstack/test/unit-files.test.ts`
- Test: `cstack/test/unit-files.test.ts`: `isTestFile()` accepts the file of the `Test` line without regard to case, a path with each listed folder at any depth, and a name with each listed pattern, and it rejects `src/a.ts`, `cstack/src/test-run.ts`, `src/contest.ts` and `docs/testing.md`; the status reading, run in a temporary git repository, reports a changed tracked file as changed, an untracked file as new (also inside a new folder), a file marked with `git add -N` as new, a deleted tracked file as deleted, nothing for an unchanged file, nothing for a path that does not exist and is not tracked, and git's message when `git status` fails because `.git/index` is damaged.
- Minimum code: Create `cstack/src/unit-files.ts`. Export `isTestFile(path, testFile)`, which applies the list of test files of `## Decisions`, compares in lower case, and matches a folder only on a whole folder name of the path. Export a function that runs `git status --porcelain=v1 -z --untracked-files=all --no-renames -- <files>` in the given root with `spawnSync` and no shell, splits the output on NUL, and returns each path with its state, `changed`, `new` or `deleted`, following the line of `## Decisions` about what git prints. When git exits with an error, the function returns git's message instead of a list, so that the callers can exit with `5`.
- Refactor: None.
- Commit message: `feat(cli): read the changed files of a unit and tell its test files apart`
- Depends on: none

### Unit 2: Refuse cstack unit red when the code of the unit already changed
- Files: `cstack/src/unit-files.ts`, `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/test/unit-red-green.test.ts`
- Test: `cstack/test/unit-red-green.test.ts`: write first a case where `src/a.ts`, committed in the test repository, is changed before `cstack unit red`; expect exit code `1`, `src/a.ts` named as changed, the sentences that the test must fail before any code of the unit exists and that moving code aside is not allowed, the restart text with `git restore` and with the stuck case, and no `red.json`. Add the same refusal for a new `src/a.ts` and for a deleted one, each named with its state; an earlier `red.json` and `green.json` that stay unchanged after a refusal; exit code `5` with git's message and nothing saved when `.git/index` is damaged; acceptance of a unit where only its test file and a fixture on its `Files` line changed, such as `test/fixtures/a.json`; acceptance of a unit whose new module `src/a.ts` does not exist yet. Also check that the refusal of `cstack unit green` when the test command changed no longer says "Set the code aside", and gives the same restart text.
- Minimum code: In `cstack/src/unit-files.ts`, add the function that returns the restart text of `## Decisions` for a unit number. In `cstack/src/commands/unit-red.ts`, after `prepareUnitTest()` and before `headCommit()`, read the status of `unit.files`, drop the test files, and refuse when any file is left, with one line per file and the restart text. Exit with `5` and git's message when the status cannot be read. In `cstack/src/commands/unit-green.ts`, replace the sentence "Set the code aside, run `cstack unit red <n>` again, then bring the code back." with the restart text. The helper `planText()` of the test file can take a `Files` line as an argument.
- Refactor: None.
- Commit message: `feat(cli): refuse cstack unit red when the code of the unit already changed`
- Depends on: 1

### Unit 3: Refuse cstack unit green when the code is older than the latest failing run
- Files: `cstack/src/unit-test-runs.ts`, `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/test/unit-red-green.test.ts`, `cstack/test/unit-test-runs.test.ts`
- Test: `cstack/test/unit-red-green.test.ts`: write first a case where `cstack unit red` saves `startedAt`, a valid ISO time no later than `time`. Then a case where a changed `src/a.ts` has a modification time 60 seconds before `startedAt`, set with `utimesSync`; expect exit code `1` from `cstack unit green`, `src/a.ts` named, the restart text, no test run, no `green.json`, and an earlier `green.json` and `green.log` deleted with a message that says so. Add acceptance when the file is 60 seconds newer than `startedAt`, and when it is one second older, inside the margin. Add a `red.json` written by hand without `startedAt`, where `time` is the reference; and a `red.json` written by hand where `startedAt` is older than `time`, with a file between the two, which is accepted. Add a deleted `src/a.ts`, which the time check skips, and an old test file and an old fixture, which it ignores. Check that the warning about a test file that changed since the failing run now also asks the implementer to say in its report what changed in the test and why. Never wait in a test: set every time with `utimesSync`.
- Minimum code: In `cstack/src/unit-test-runs.ts`, add a type for a failing run, which is `SavedUnitRun` with `startedAt`, and make `saveFailingRun()` take it. Update the helper of `cstack/test/unit-test-runs.test.ts` that builds the saved runs. In `cstack/src/commands/unit-red.ts`, take the time just before the status of the unit's files is read, and save it as `startedAt`. In `cstack/src/commands/unit-green.ts`, after the check of the test command and before the test runs, read the status of `unit.files`, drop the test files and the deleted files, and compare each file's `mtimeMs` with `Date.parse(startedAt ?? time)` of `red.json`. Refuse when a file is more than 2,000 milliseconds older, after you delete any earlier passing run with `deletePassingRun()`. Exit with `5` and git's message when the status cannot be read. Put the code comment of `## Decisions` about the safety net next to the check. Add the sentence of `## Decisions` to the warning about a changed test file.
- Refactor: None.
- Commit message: `feat(cli): refuse cstack unit green when the code is older than the latest failing run`
- Depends on: 2

### Unit 4: Describe the new refusals in the manifest and the README
- Files: `cstack/src/manifest.ts`, `README.md`
- No test: the unit only rewrites descriptions of exit codes and two bullets of prose. `cstack/test/manifest.test.ts` already checks that every exit code has a meaning that is not empty.
- Minimum code: In `cstack/src/manifest.ts`, in the entry of `cstack unit red`, add to the meaning of exit code `1` that a file of the unit that is not a test changed before the run, and to exit code `5` that git cannot read the status of the unit's files. In the entry of `cstack unit green`, add to exit code `1` that a changed code file is older than the latest failing run, and the same addition to exit code `5`. In `README.md`, add two or three short sentences to the bullet of `cstack unit red`, which say that it refuses when a file of the unit other than a test file differs from `HEAD`, and which files count as test files. Add one or two short sentences to the bullet of `cstack unit green`, which say that it refuses a changed code file older than the start of the latest failing run, and that this check is a safety net, not a proof. Touch nothing else in these two files, and follow the documentation writing rules: one idea per sentence, a subject and a verb in each, and under about 25 words.
- Refactor: None.
- Commit message: `docs: describe the new refusals of cstack unit red and cstack unit green`
- Depends on: none

## Documentation duties

- Ticket comment on #63: applies, written to issue #63 on GitHub. It says what the two commands now refuse, what the implementer is told to do, and the limits of the time check.
- Comment on #31: applies, written to issue #31 on GitHub. Its end-to-end tests may run `cstack unit red` and `cstack unit green`. The comment says that a test must change the code files of a unit only after `cstack unit red` saved its failure, and that `red.json` gains the field `startedAt`.
- `README.md` and the exit codes of `cstack/src/manifest.ts`: applies, written by Unit 4.
- Specification page `docs/projects/skills-into-cli.md`: does not apply. The page holds the acceptance criteria of the stories of the epic, and this ticket adds a refusal to two commands that the README and the manifest describe.
- Architecture decision record: does not apply. The new field of `red.json` is optional and follows the precedent of `testFileSha256`, so the format of the run state keeps its version, as ADR-SIC-B allows for a change that old readers accept.
- The implementer's prompt and `cstack/skills/resolve-issue/settled-decisions.md`: does not apply in this branch, because no prompt or skill file may change in this wave. The ticket comment says that a later ticket can record there that the commands now enforce the rule.
- Epic #6 and the conventions file: do not apply.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: what a refusal tells the implementer to do
When `cstack unit red` refuses because a file of the unit that is not a test already changed, what does its message tell the implementer to do? The same question holds for the new refusal of `cstack unit green`, when a changed file is older than the first failing run. It also holds for today's refusal of `cstack unit green` when the test command changed, whose message says "Set the code aside, run `cstack unit red <n>` again, then bring the code back". That last message asks for what the new rule forbids. No guide or prompt can change in this wave, so the message is the only instruction the implementer gets. The recommended answer is that all three messages say the same thing. Discard your changes to the named files: run `git restore -- <file>` for a changed or deleted file, and delete a new file. Then run `cstack unit red <n>` again, and write the code only after it saved the failure. The test then fails against the code of `HEAD`, which is the failure the rule asks for. The other answer is that the messages say to stop, report the unit as stuck and quote the message, so that someone else decides.
- For: the user
- Answer: yes, with one condition. All three messages tell the implementer to discard the changes to the named files, with `git restore -- <file>` for a changed or deleted file and by deleting a new file, only when it made those changes itself in this unit. It then runs `cstack unit red <n>` again and writes the code only after the failure is saved. When it did not make those changes, they may be the work of another unit, so it does not discard them and reports the unit as stuck. (2026-11-19, the user's answer, on the advice given before the plan)

### Question 2: a test that must change after the code exists
When the test itself was wrong and must change after the code exists, what does the implementer do? Today `cstack unit green` saves the passing run and prints a warning that the test file changed since the failing run. With the new rule, `cstack unit red` refuses to run again once the code exists, so nobody can see the new version of the test fail without the code. The recommended answer is to keep the warning and add one sentence to it, which asks the implementer to say in its report what changed in the test and why. The other answer is that `cstack unit green` refuses, and asks the implementer to discard its code, run `cstack unit red` again and write the code again.
- For: the user
- Answer: keep the warning of `cstack unit green`, and add one sentence to it that asks the implementer to say in its report what changed in the test and why. (2026-11-19, the user's answer)

### Question 3: which files count as test files
The ticket counts a file as a test file when it is the file of the `Test` line, when its path has a `test`, `tests`, `__tests__` or `fixtures` folder, or when its name ends with `.test.<extension>` or `.spec.<extension>`. A test file that this list misses counts as code, so `cstack unit red` refuses an honest implementer and blocks the unit. A code file that the list takes for a test only weakens a safety net. The recommended answer is to add the folders `spec`, `specs`, `__mocks__`, `__snapshots__` and `testdata`, and the names that end with `_test.<extension>` or `_spec.<extension>` or that start with `test_`. These cover the usual layouts of Go, Python and Ruby, and the snapshots and mocks of JavaScript test runners. The other answer is to keep the list of the ticket.
- For: the user
- Answer: widen the list. The folders `spec`, `specs`, `__mocks__`, `__snapshots__` and `testdata` are added, and so are the names that end with `_test.<extension>` or `_spec.<extension>` or that start with `test_`. (2026-11-19, accepted by default after the user saw it in the round)

### Question 4: the reference time of the check in cstack unit green
The ticket says that `cstack unit green` refuses a changed file that is older than the first failing run. With the new check of `cstack unit red`, every red run starts with the unit's code files equal to `HEAD`. So the start of the latest failing run is a stronger reference: it also refuses code written between two red runs, moved aside before the second one and moved back afterwards. It never refuses an honest implementer, who writes the code after the latest red run. Should the reference be the start of the latest failing run instead of the first one? This changes one acceptance line of the ticket.
- For: the user
- Answer: yes. The reference is the start of the latest saved failing run of the unit. (2026-11-19, the user's answer)

## Review log

Impact notes (executor, 2026-11-19): The new helpers `isTestFile`, `readUnitStatus` and `restartText` and the new type `FailingUnitRun` are used only by `unit-red.ts`, `unit-green.ts` and their tests. `saveFailingRun` has one caller, `unit-red.ts`. Older `red.json` files have no `startedAt`, and `unit-green.ts` falls back to `time`. The text "Set the code aside" no longer appears in the source, and a test checks that. The usual companions of `unit-red.ts` and `unit-green.ts` are `unit-test-runs.ts`, `unit-test-command.ts`, `manifest.ts`, `README.md` and `unit-red-green.test.ts`. All of them are in the branch except `unit-test-command.ts`, which needs no change. The prose in `cstack/guides/resolve-issue/build.md`, `cstack/skills/resolve-issue/settled-decisions.md` and `cstack/skills/resolve-issue/agents/implementer.md` mentions `unit red` and is not in the diff, so the reviewers check whether it still tells the truth.

Review findings (2026-11-19): The correctness reviewer and the security reviewer found nothing at or above the confidence bar. The conventions reviewer and the simplicity reviewer found the points below.

- Fixed: `unit-green.ts` uses `Partial<FailingUnitRun>` instead of a second inline type. The comment of `restartText` says two refusals use it.
- Reverted by the independent review: my first fix gave the changed-test-command refusal its own short text, and I edited the implementer prompt and the build guide. The reviewer put back the shared restart text, because Question 1 says the refusals share it. The reviewer also restored both prose files, because the plan forbids changing guides and prompts in this branch (tickets #31 and #64 change them in the same wave). The stop conditions for exit codes 1 and 5 are therefore a follow-up.
- Follow-up, not done: share the `git status` call between `checkUnit` and `readUnitStatus`, move the age check into `unit-files.ts` with a named constant, add a dated line to `settled-decisions.md`, and clean up the temporary repositories in `unit-files.test.ts`. They are cleanups, and the first one touches `unit-commit.ts`, which is outside the plan.
- Known limit, documented in the code comment: the age check reads the modification time only, so a `chmod` or a plain `mv` is not caught or may be reported wrongly. It is a safety net.


Independent review (2026-11-19): The reviewer checked all five acceptance criteria, each with a test, and found no security problem. It made two commits, described above. Judgment calls for the pull request: `manifest.ts` also changes the text of exit code 5, which adds a small merge risk with #64 or #31. A rename with `git mv` keeps the old modification time, so `cstack unit green` refuses an honest rename until the file is edited or touched. The restart text says "these changes" while the changed-command message names no files, so a later ticket could reword it. The test "ignores an old test file and an old fixture" sets the time of the test file only.

## Briefing

### What you should know about what was built

`cstack unit red` now refuses to run when a file of the unit that is not a test already differs from `HEAD`, and it saves nothing. `cstack unit green` now refuses when a changed code file is more than two seconds older than the start of the latest failing run. The branch does what the ticket asked, with the four answers of the question round. I ran the four changed test files again (101 tests pass) and the type check, and both are clean.

**What to watch**

- The guard only starts to work once the version bump of the release ticket (#31) ships and cstack is installed again. Until then, every run still uses cstack 0.2.0, which has no guard.
- `cstack unit green` refuses honest work when a code file keeps an old modification time. A rename with `git mv` does that, and so does a copy with `cp -p`, `rsync -a`, `tar` or `unzip`. Following the message does not help, because doing the same thing again gives the same old time. If a unit gets stuck on this, the way out is to edit or `touch` the file after the failing run.
- The implementer's prompt has no stop condition yet for these refusals, so the message alone guides it. When a blocked unit leaves uncommitted changes, every later unit that lists one of those files now stops as stuck. We chose that, but expect more stuck units in such a wave. Check the first retrospectives after the release for units stuck on these refusals.

### Details

The branch adds `cstack/src/unit-files.ts`, which holds `isTestFile()`, `readUnitStatus()` and `restartText()`. `cstack/src/commands/unit-red.ts` takes `startedAt` just before it reads the git status of `unit.files`. It refuses with exit code 1 when a file that is not a test is changed, new or deleted. It exits with 5 when git fails. It saves `startedAt` in `red.json` through the new type `FailingUnitRun` of `cstack/src/unit-test-runs.ts`. `cstack/src/commands/unit-green.ts` runs the time check after its check of the test command and before the test. When it refuses, it deletes any earlier passing run. The safety-net comment that the ticket asked for sits next to the check. I ran `npx vitest run` on `test/unit-red-green.test.ts`, `test/unit-files.test.ts`, `test/unit-test-runs.test.ts` and `test/manifest.test.ts` (4 files, 101 tests, all pass) and `npm run typecheck` (clean) on 2026-11-19. The full suite passed during the build, apart from the known timeout of `test/report.test.ts`, which passed alone.

The earlier questions are all resolved in the code. Blocking question 1 is resolved: `restartText()` is the one text used by the refusal of `cstack unit red`, the time refusal of `cstack unit green` and the changed-test-command refusal, and it carries the condition "only if you made these changes yourself in this unit". The sentence "Set the code aside" is gone, and a test checks that. Blocking question 2 is resolved: the warning about a changed test file now asks the implementer to say in its report what changed and why. Blocking question 3 is resolved: `TEST_FOLDERS` and `TEST_NAME` in `unit-files.ts` hold the widened list. Blocking question 4 is resolved: the reference is `startedAt` of the latest `red.json`, with a fallback to `time` for a file that cstack 0.2.0 wrote. The defaults accepted in the round also hold: the margin is 2,000 milliseconds, `RUN_FORMAT` in `cstack/src/run-state.ts` is unchanged, and only the entries of the two commands changed in `cstack/src/manifest.ts` and `README.md`. The independent review reverted a first fix that had given the changed-test-command refusal its own text and had edited the implementer prompt and the build guide, so the final branch follows the plan and no trade-off departs from it.

The guard is not live for anybody yet. The decisions of the wave say that implementers use the installed cstack 0.2.0, and only the release ticket (#31) changes the version in `cstack/package.json`. The behaviour change therefore lands for every repository at once when that version ships and is installed. A run that is in progress at that moment and has a `red.json` written by 0.2.0 keeps working, because of the fallback to `time`. A run whose implementer wrote code before the failing run is refused at that point, which is the purpose of the ticket. Nobody needs to act on this before the merge.

The time check of `cstack unit green` gives a false refusal when an honest implementer produces a code file whose modification time is older than the latest failing run. A rename with `git mv` keeps the time, as the independent review found, and so do `cp -p`, `cp -a`, `rsync -a`, and extracting with `tar` or `unzip`. The restart text then sends the implementer around a loop, because discarding, failing again and redoing the same rename or copy gives the same old time. I rejected changing the check now: comparing content with `HEAD` cannot detect a rename because the status runs with `--no-renames`, and telling the implementer to `touch` the file in the message would teach it to defeat the guard. By default, such a unit reports stuck, and the escalation or the person reading the report edits or touches the file after the failing run. This is rare in this repository, where units mostly edit TypeScript and Markdown with the editing tools of the agent.

The implementer prompt (`cstack/skills/resolve-issue/agents/implementer.md`, step 4 and the stop conditions at lines 47 to 49) has no stop condition for the new exit code 1 of `cstack unit red`, for the new exit code 1 of `cstack unit green`, or for the new exit code 5 when git cannot read the status. The plan forbade any prompt change in this wave, so the message is the only instruction. Two consequences follow. First, a blocked unit leaves its uncommitted changes in place (`cstack/guides/resolve-issue/build.md` line 24), so a later unit that lists one of the same files and does not depend on it is now refused, and its implementer follows the "not my changes" branch and reports stuck. That is the answer to Blocking question 1, and it protects uncommitted work, but a wave with one blocked unit can now produce several stuck ones. Second, the escalation agent (`implementer-escalation.md` line 14) takes over the uncommitted changes of a first implementer. If it decides to rewrite the test and run `cstack unit red` again, the restart text asks whether it made the changes "yourself in this unit", which it did not do personally. It may then report stuck instead of discarding. Its own prompt says to discard changes that are wrong, which makes this less likely. By default, both cases show up as stuck units in the retrospectives, which is where to look after the release.

The branch changes the texts of exit codes 1 and 5 of both commands in `cstack/src/manifest.ts` (lines 151 to 169) and the two bullets of `README.md` (lines 65 and 66). The ticket that changes `cstack unit commit` (#64) edits `manifest.ts` at the next entry, and the release ticket (#31) edits `README.md`. Whoever merges second may meet a conflict of a few lines. The fix is to keep both changes, as the decisions of the wave say.

A new question came up, and it is non-blocking, for the user: "After this wave, should a follow-up ticket finish the work around the red guard? It would add to the implementer prompt and to the escalation prompt what to do when `cstack unit red` or `cstack unit green` refuses because a code file of the unit changed, or exits with 5 because git cannot read the status. It would add a dated line to `cstack/skills/resolve-issue/settled-decisions.md` that says the two commands now enforce the test-first rule. It would make `cstack unit commit` use the `git status` reading of `cstack/src/unit-files.ts`, once the ticket that changes `unit-commit.ts` (#64) is merged. It would also reword the restart text of the changed-test-command refusal, which says 'these changes' but names no file." The work of this branch is complete and correct whatever the answer.

I checked security and authorization (git runs with `spawnSync`, no shell, paths after `--`), data model lock-in (one optional field in `red.json`, no format version change), scale and performance (one `git status` on a few paths per run), operations and cost, and the other readers of `red.json` (`unit-commit.ts`, `reports.ts`, `plan-status.ts`, which read only `time` or the presence of the file), and found nothing else.

## Non-blocking questions

- For the user: After this wave, should a follow-up ticket finish the work around the red guard? It would add to the implementer prompt and to the escalation prompt what to do when `cstack unit red` or `cstack unit green` refuses because a code file of the unit changed, or exits with 5 because git cannot read the status. It would add a dated line to `cstack/skills/resolve-issue/settled-decisions.md` that says the two commands now enforce the test-first rule. It would make `cstack unit commit` use the `git status` reading of `cstack/src/unit-files.ts`, once the ticket that changes `unit-commit.ts` (#64) is merged. It would also reword the restart text of the changed-test-command refusal, which says 'these changes' but names no file.

## Pull request

Title: feat: make cstack unit red refuse when the code of the unit already exists

````markdown
## What this does

The test-first rule no longer depends only on the implementer obeying it. Two commands now enforce it.

`cstack unit red` refuses to run the test when a file of the unit that is not a test file already differs from `HEAD`. It counts a changed, a new and a deleted file. It saves nothing and exits with 1. If git cannot read the status, it exits with 5.

`cstack unit green` refuses when a code file of the unit is more than two seconds older than the start of the latest failing run. It runs no test, deletes any earlier passing run and exits with 1.

## Key decisions

- A new field `startedAt` in `red.json` marks the start of a failing run. An older `red.json` without it falls back to `time`. The format version of the run state does not change.
- The three refusals share one restart text, in `restartText()`. It tells the implementer to discard its own changes and start again, and to report stuck when the changes are not its own.
- The git status reader lives in a new file, `cstack/src/unit-files.ts`, because ticket #64 changes `unit-commit.ts` in the same wave.
- The time check is a safety net, not a proof. A file written back with a new time, for example by `git stash pop` or `cp`, still passes it.

## Files

New: `cstack/src/unit-files.ts` and its test. Changed: `unit-red.ts`, `unit-green.ts`, `unit-test-runs.ts`, `manifest.ts`, `README.md` and the tests of red and green. The plan file is `docs/plans/2026-11-19-63-make-cstack-unit-red-refuse-when-the-code-of-the-unit-already-exists.md`.

## Judgment calls from the review

- `manifest.ts` also changes the text of exit code 5, which adds a small merge risk with #64 and #31.
- A rename with `git mv` keeps the old modification time, so `cstack unit green` refuses it until the file is edited or touched.
- Left as follow-ups: stop conditions for the new exit codes in the implementer prompt, a dated line in `settled-decisions.md`, one shared `git status` call with `checkUnit`, and tidying the temporary repositories in `unit-files.test.ts`. Guides and prompts stay untouched here because tickets #31 and #64 change them.

## Open questions, not needed for this pull request

This pull request can be merged without these answers.

- For the user: After this wave, should a follow-up ticket finish the work around the red guard? It would add to the implementer prompt and to the escalation prompt what to do when `cstack unit red` or `cstack unit green` refuses because a code file of the unit changed, or exits with 5 because git cannot read the status. It would add a dated line to `cstack/skills/resolve-issue/settled-decisions.md` that says the two commands now enforce the test-first rule. It would make `cstack unit commit` use the `git status` reading of `cstack/src/unit-files.ts`, once the ticket that changes `unit-commit.ts` (#64) is merged. It would also reword the restart text of the changed-test-command refusal, which says 'these changes' but names no file.

Fixes #63
````

## Documentation

- Ticket comment on #63: https://github.com/gambitl/claude-code-stack/issues/63#issuecomment-7020901015
- Comment on #31: https://github.com/gambitl/claude-code-stack/issues/31#issuecomment-7020901601
- `README.md` and the exit codes in `cstack/src/manifest.ts`: updated by unit 4, in the branch.
- No decision record, no specification page change, as "Documentation duties" says.

## Executor notes

- The full `npm test` run failed once on `test/report.test.ts` ("names a unit without a commit") with a 5000 ms timeout. It passed when run alone (27 of 27), as the conventions file predicts.

## Hand-off log

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

- 2026-11-19: The executor moved issue #63 to "in progress" by adding the `in progress` label, then started the build.
- 2026-11-19: The build phase finished. Units 1 and 4 ran in parallel, then units 2 and 3 in order. All four are committed. Typecheck passes and the full test run passes, apart from one timeout that passed alone.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

1. **What the refusal messages tell the implementer to do.** In this wave, these messages are the only instruction the implementer gets. I would keep the drafted answer with one change. The message says to discard the changes with `git restore` only when the implementer wrote them in this unit. When it did not write them, it stops and reports the unit as stuck. Two units that share a file never run in the same batch, but a stuck or blocked unit leaves its changes in place. A later unit that lists one of the same files would then be told to wipe that work, and uncommitted work cannot be recovered. I recommend the same message, with this condition, in all three refusals.

2. **The time that `cstack unit green` compares with.** The ticket says "the first failing run". I would rather take the start of the latest failing run. With the new check, a second red run can only happen when the unit's code files equal `HEAD`. So a code file older than that run was put back after it. The first run is a weaker reference: code written after it, moved aside with `mv` before a second red run and moved back, passes. The latest run catches that case and never refuses an honest implementer. It also removes the copying of a field from one `red.json` to the next. This changes one acceptance line of the ticket, so I need your ok.

3. **A test that must change after the code exists.** `cstack unit red` cannot run again once the code exists. I recommend keeping today's warning of `cstack unit green`, and adding one sentence to it: say in your report what changed in the test and why. The other choice makes the implementer throw its code away and write it again.

**I will do this unless you say no.**

- I will widen the list of test files with the folders `spec`, `specs`, `__mocks__`, `__snapshots__` and `testdata`, and the names `*_test.*`, `*_spec.*` and `test_*`. A test file that the list misses blocks an honest implementer.
- I will refuse only a file that is more than two seconds older than the reference. Some file systems keep times to the second, and Linux stamps files from a clock that can lag a few milliseconds, so a strict comparison can refuse by chance.
- I will add the new field to `red.json` without changing the format version of the run state, as was done for the hash of the test file. A version change would make cstack 0.2.0 refuse every run in progress.
- I will update the exit code texts of the two commands in `cstack/src/manifest.ts` and their two lines in `README.md`, and touch nothing else in those files.

**I checked it myself.**

- `cstack unit order` never puts two units that share a file in the same batch.
- The retrospective of ticket #30 shows that one implementer moved its code aside with `git stash`.

**Good to know.** The time check cannot catch `git stash pop` or a plain copy, because both write the file with a new time. Only the rule in the implementer's prompt stops them.

#### Details

The refusal messages are a blocking question that only the user can answer (Blocking question 1). The drafted recommendation tells the implementer to run `git restore -- <file>` or to delete a new file. That is right for the case the ticket targets. It is unsafe in one case that the draft does not consider. `cstack/src/plan/order.ts` (lines 80 to 86) keeps units that share a file in separate batches. Each implementer commits its own unit before the batch ends. So in the normal flow, a non-test file of a unit differs from `HEAD` only because this unit's implementer changed it. The exception is a unit that got stuck or blocked. The implementer prompt says "leave your uncommitted changes in place". `cstack/guides/resolve-issue/build.md` tells the executor to finish every unit that does not depend on a blocked one. A later unit can list the same file without depending on the blocked unit. Its implementer then reaches `cstack unit red`, gets refused, and is told to discard work that is not its own. Uncommitted work has no copy anywhere, so this cannot be undone. The recommended message therefore says: "If you changed these files in this unit, discard your changes (`git restore -- <file>` for a changed or deleted file, delete a new file), run `cstack unit red <n>` again, and write the code only after it saved the failure. If you did not change them, they may be another unit's work: do not discard them, and report the unit as stuck." The same text replaces the "Set the code aside" sentence of the test-command refusal in `cstack/src/commands/unit-green.ts` (line 30), and is used by the new time refusal. I rejected the other drafted answer (always stop and report stuck), because it sends every honest mistake to an escalation agent that will do exactly the `git restore` anyway. If nobody decides, the drafted message ships without the condition, and the risk above stays.

The reference time of the check in `cstack unit green` is blocking, because it changes the acceptance line "refuses when a changed source file is older than the first failing run, and accepts it when it is newer", and the user must accept that change. The assumption at line 160 of `## Decisions` keeps the start of the first failing run and copies it into every later `red.json`. Once `cstack unit red` refuses any changed non-test file, every red run starts with the unit's non-test files equal to `HEAD`. Take a non-test file that differs at green time and is older than the start of the latest red run. It held its new content before that run and came back afterwards with its old time. That is what `mv` or `cp -p` produce. The start of the latest run is never before the start of the first, so the newer reference refuses every case the older one refuses. It also refuses code written between two red runs and moved aside before the second one. The first-run reference lets that code through. An honest implementer writes or rewrites its code after the latest red run, so the newer reference never refuses it. The ticket's reason for keeping the first run ("so that a second red run cannot hide the problem") assumed that a second red run could happen with the code present, which the new check of `cstack unit red` forbids. The recommended field is the start of the latest red run (for example `startedAt`), written by every red run; when `cstack unit green` reads a `red.json` that lacks it, because cstack 0.2.0 wrote it, it falls back to `time`. If nobody decides, the first-run reference ships as the ticket wrote it, which is weaker but not wrong.

The test that must change after the code exists is blocking (Blocking question 2), because the ticket asks the question round to decide it. I agree with the drafted recommendation: keep the warning at line 83 of `cstack/src/commands/unit-green.ts` and add a sentence asking the implementer to say in its report what changed in the test and why. The executor reads that report and can raise it in the review. Forcing a discard and a rewrite of the code costs a full unit for a case that the warning and the code review already expose. If nobody decides, the warning stays as it is today, which is the ticket's own default.

The list of test files is blocking by its nature (it changes which files `cstack unit red` refuses), but the ticket already lets the question round widen it, and I expect the user to accept the drafted widening without discussion. A test file that the list misses makes `cstack unit red` refuse an honest implementer and stops the unit, while a code file taken for a test only weakens a safety net, so the list should err on the side of test. The added folders `spec`, `specs`, `__mocks__`, `__snapshots__` and `testdata`, and the names that end with `_test.<extension>` or `_spec.<extension>` or start with `test_`, cover Ruby, Go, Python and the snapshot and mock folders of JavaScript runners. None of them matches a source file of this repository (for example `cstack/src/test-run.ts` uses a dash). If the user says no, the ticket's list ships.

The tolerance on modification times is non-blocking for the user but changes the behaviour, so it is a default I will apply. The assumption at line 162 refuses any time strictly older than the reference. Two effects make that comparison fragile. Linux takes file times from a coarse clock that can lag the clock behind `new Date()` by a tick, a few milliseconds, so a file written just after the reference can carry an earlier time. Some file systems and mounts keep times to the second or to two seconds, and a network or container mount can have its own clock. A margin of two seconds removes these false refusals and keeps every real case, because code that was moved aside was written well before the red run. The tests set times with `utimesSync` far on either side of the margin, so they stay exact. If the user says no, the strict comparison of line 162 ships, with a rare false refusal on continuous integration or on unusual file systems.

The new field in `red.json` is non-blocking. ADR-SIC-B says that changing a run state format needs a new version and a decision, but the version lives in `state.json` (`RUN_FORMAT` in `cstack/src/run-state.ts`), and `red.json` already gained an optional field, `testFileSha256`, without a version change; `unit-green.ts` line 20 handles a file that lacks it. An optional field with a fallback follows the same precedent and needs no decision. Bumping `RUN_FORMAT` would make every cstack 0.2.0 in this wave refuse the run folders it is writing right now.

The README and the exit code texts are non-blocking, as drafted. I agree with updating both, inside the lines of the two commands only: `cstack/src/manifest.ts` lines 146 to 175 (the change of ticket #64 is at line 176, so a conflict, if any, is one line wide) and `README.md` lines 65 and 66. `cstack/src/manifest.ts` is the single list of commands and their exit codes. A text that no longer lists every refusal would mislead the next ticket that reads it.

I checked two facts myself. `cstack/src/plan/order.ts` lines 80 to 86 move a unit to a later batch when it shares a file with a unit already in the batch. `docs/retros/reviewed/2026-11-19-30.md` line 18 reports that one implementer used `git stash`, and the other retrospectives that report code moved aside do not say how. `git stash pop`, `git checkout` and a plain `cp` all write the file with the current time, so the time check of `cstack unit green` cannot see them; only `mv` and copies that keep the time are caught. The code comment of scope item 6 should name these cases. I rejected a check of the stash stack, because the stack is shared by every worktree of the repository, and a parallel ticket that touches the same path would cause false refusals.

I also checked security and authorization, data model lock-in beyond the `red.json` field, scale and performance (one `git status` on a few paths), operations and cost, and hidden coupling with the other readers of `red.json` (`unit-commit.ts`, `reports.ts`, `plan-status.ts` only read `time` or the file's presence), and found nothing else.

### Open questions and answers

**What a refusal tells the implementer to do, for the user.** This is Blocking question 1. The advice before the plan added a condition to the drafted answer: discard only changes made in this unit, and otherwise report the unit as stuck. The user accepted it on 2026-11-19.

**A test that must change after the code exists, for the user.** This is Blocking question 2. The ticket asks the question round to decide it. The user accepted the recommendation on 2026-11-19: keep the warning, and ask in it for a sentence in the implementer's report.

**Which files count as test files, for the user.** This is Blocking question 3. The ticket says the question round can change the list. The widening was accepted by default on 2026-11-19, after the user saw it in the round.

**The reference time of the check in `cstack unit green`, for the user.** This is Blocking question 4. The advice before the plan raised it. The user accepted the start of the latest failing run on 2026-11-19.

**The README and the exit code texts, for the user. Non-blocking: the code works whatever the answer.** `README.md` lines 65 and 66 and the text of exit code `1` in `cstack/src/manifest.ts` describe the refusals of the two commands, and they would be out of date after this ticket. Ticket #31 changes `README.md` and ticket #64 changes `cstack/src/manifest.ts` in the same wave, so whoever merges second may meet a small conflict on nearby lines. Recommended answer: update both in this pull request, and keep each edit inside the lines of the two commands. Answer: accepted by default on 2026-11-19, after the user saw it in the round.

**A margin on modification times, and the format version of the run state.** The advice before the plan proposed a margin of two seconds and no change of the format version. Both were accepted by default on 2026-11-19, after the user saw them in the round.

**Deleted files, case of paths, and a failing `git status`.** Each has an obvious default, written in `## Decisions` as an assumption not asked.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. No new decision since the question round.
