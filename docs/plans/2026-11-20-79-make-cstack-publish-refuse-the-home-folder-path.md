# Plan: #79 — M3-17: Make cstack publish refuse the home folder path before the push

Format: cstack-plan/1
Written by: cstack 0.3.1
Date: 2026-11-20
Ticket: https://github.com/gambitl/claude-code-stack/issues/79
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/publish-home-path
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T09:56:12+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** `cstack publish` stops before the push when the branch or the pull request text holds the path of the maintainer's home folder.

- **What the title means**: `cstack publish` is the command that pushes the ticket branch once and opens the pull request at the end of a `resolve-issue` run. The home folder is the personal folder of the person who runs it, such as `/Users/<name>` on a Mac or `/home/<name>` on Linux. Its path holds the user name of the machine.
- **Why we are doing it**: This repository is public, and its rules forbid any path from the maintainer's machine. Ticket #70 removed the paths that `cstack` itself writes in plan files, and added a test that scans `docs/plans/` and `docs/retros/` in continuous integration. That test only runs after the push, so the path is already public when it fails. Removing it then means rewriting the history of the repository. A path can also come from elsewhere: a sentence of the retrospective, a code comment, or the pull request text.
- **For the user**: The maintainer can trust that a run never publishes the home folder path, in this repository or in any other.

**Goal.** This ticket makes `cstack publish` refuse to push when the commits it would push, or the pull request title or body, hold the real home folder path of the machine.

### Where things are today (read first)

* **The rules before the push**: `cstack/src/commands/publish.ts` → `brokenRules()` (line 62) lists every broken rule, such as an open blocking question or uncommitted tracked files. `publish()` (line 150) prints them all and pushes nothing when the list is not empty. It exits with the code that the existing tests expect for a broken rule.
* **The pull request text**: `brokenRules()` already reads `plan.pullRequest.title` and `plan.pullRequest.body` from the `## Pull request` section of the plan file (line 90). These are the title and body that the pull request will get.
* **The existing detector**: `cstack/test/helpers/fixtures-public.ts` → `findHomePaths()` (line 11) finds any path under `/Users/` or `/home/`, except the sample names `user`, `someone` and `runner`. It is a test helper, and `cstack/test/fixtures-public.test.ts` (line 73) uses it on `docs/plans/` and `docs/retros/` of this repository.
* **Why not reuse that detector as it is**: `cstack publish` also runs in other repositories. Many of them hold legitimate paths such as `/home/user/app` in a Dockerfile. So the rule here looks only for the real home folder of the machine, not for any path under `/Users/` or `/home/`.
* **Ticket #70**: `cstack/src/plan/unit-line.ts` → `setUnitWorktree()` writes a worktree path inside the home folder as `~/...`. A path written as `~/...` never matches the rule of this ticket.
* **The tests**: `cstack/test/publish.test.ts` builds a ticket branch in a temporary repository and runs `publish()` with fake programs. Use it as the model for the new cases.

### Scope

1. Add a rule to `brokenRules()`. It reads the lines that the commits of the push add, compared with the target branch of the plan. It also reads the pull request title and body.
2. The rule matches the real home folder of the machine. That is the value of `os.homedir()`, and also its real path after symbolic links are resolved, when the two differ. A match must be followed by `/` or by the end of the path, so that a home folder `/Users/someone` does not match a longer name that starts with the same letters, such as `someone2`.
3. For each match, the message names where it is: the file and the line number in the branch, or "the pull request title" or "the pull request body". It writes the home folder as `~`, so the message never prints the user name.
4. Let the tests give a fake home folder, for example through the environment of `PublishDeps`, so that no test depends on the real machine.
5. Add one sentence to the `cstack publish` part of `README.md` that says this rule exists.

### Acceptance (TDD)

* `cstack/test/publish.test.ts`: write first a case where a commit of the branch adds a line that holds `<fake home>/projects/x`. See `publish()` push nothing and name the file and the line. Then make it pass.
* The same file: the pull request body holds the fake home folder. `publish()` pushes nothing and names the pull request body. Do the same for the title.
* The same file: a line that holds `/home/user/app`, or a home folder that only starts with the same letters, such as `<fake home>2/x`, does not stop the push.
* The same file: a line that the target branch already had before the branch started does not stop the push. Only the added lines count.
* The same file: when the home folder is reached through a symbolic link, a line with its real path also stops the push.
* The message of every refusal writes `~` and never the fake user name.
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
- [ADR-SIC-B, where the run state lives and how its formats are versioned](../decisions/ADR-SIC-B-run-state.md).
- [ADR-SIC-C, how cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md). `cstack` ships the skills and their guides, and serves them at its own version.
- [ADR-SIC-D, the settings file and the model of the review agent](../decisions/ADR-SIC-D-settings-file-and-review-model.md).
- [ADR-SIC-E, the new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final` and are never edited.
- [ADR-SIC-F, how cstack reaches trackers and forges](../decisions/ADR-SIC-F-tracker-access.md).
- [ADR-SIC-G, continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md). The project continues, with a refocus and three quality guards that this run applies by hand.
- [ADR-SIC-H, how a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md).

## Dependencies

clear

The tracker lists no blocker for this ticket, and its footer says "Blocked by: none". Ticket #80 runs at the same time in another worktree. It is not a blocker, because the two tickets change different files.

## Code mapping

**Entry point.** `cstack/src/commands/publish.ts` holds the whole command. `brokenRules(root, plan, deps)` starts at line 62 and returns a list of sentences, one per broken rule. `publish()` starts at line 150. At lines 180 to 183 it prints every sentence of that list under "nothing was pushed, because N rule(s) are broken" and returns 1, before it detects the forge and before any push. So a new rule only has to push more sentences into the same list, and the exit code 1 and the "no push" behaviour come for free.

**Order of the steps.** `brokenRules()` runs before `updateBranch()` (line 195). So the new rule reads the branch as it is before the update onto the target. `updateBranch()` in `cstack/src/publish/branch.ts` (line 49) fetches `refs/remotes/origin/<target>` and then rebases or merges onto it. A rebase does not change the lines that the commits of the branch add, and a merge only brings in commits that the target already has. So reading the branch before the update is enough.

**How git runs.** Every git call of `cstack publish` goes through `runProgram()` in `cstack/src/publish/program.ts` (line 16). It never starts a shell, and the `WHY:` comment on lines 3 to 5 asks every git, gh, glab and ssh call of `cstack publish` to go through it. `brokenRules()` already wraps it as `git(args)` on line 63, with `deps.env`. The new rule uses the same wrapper.

**The pull request text.** `readPullRequest()` in `cstack/src/plan/read.ts` (line 502) gives `plan.pullRequest` as `{ title, body }`, or undefined when the section is not filled. `brokenRules()` already refuses a missing title or body on lines 90 to 92. The body comes from the plan file, which is committed on the branch. So a home folder path in the body also shows up as an added line of the plan file.

**The test environment.** `PublishDeps` (line 32 of `publish.ts`) has `cwd`, an optional `env`, `sleep` and `now`. `defaultPublishDeps()` (line 39) leaves `env` undefined, so production code inherits `process.env`. `makePublishEnv()` in `cstack/test/helpers/publish-env.ts` (line 94) builds a temporary repository on the branch `gambitl/units`, a bare remote with `main`, and `refs/remotes/origin/main`. Its `deps.env` copies `process.env` (line 121), so today it carries the real `HOME`. Its option `plan` rewrites the committed plan, which is how the existing tests change the pull request title and body. `commitFiles()` in `cstack/test/helpers/plan-repo.ts` (line 34) writes random contents, so a test that needs a chosen line writes the file and commits it with `git()` itself.

**Existing home folder code.** `worktreeValue(path, home)` in `cstack/src/plan/unit-line.ts` (line 57) already treats a home folder as given and with symbolic links resolved through `realpathSync`, and it skips an empty home and `/`. The new rule can follow the same pattern. `findHomePaths()` in `cstack/test/helpers/fixtures-public.ts` (line 11) is a test helper that matches any `/Users/<name>` or `/home/<name>`, so it is not reused, as the ticket explains.

**The README and the manifest.** The `cstack publish` paragraph of `README.md` is line 70. The manifest entry of `cstack publish` is in `cstack/src/manifest.ts`, lines 185 to 203, and its exit code 1 already reads "Refused before any push.", so the manifest needs no change.

**Risks.** `publish.ts` and `publish.test.ts` changed together in 8 of their last 8 commits, and the review of ticket #20 already led to a fix commit (`bbc6482`). `publish.test.ts` has 764 lines and about fifty cases, and every case starts fake programs, so new cases add to the 90 seconds of `npm test`. The continuous integration runs on `macos-latest` (`.github/workflows/`), where `HOME` is `/Users/runner`, a name that the test data may use as a sample. So every new test must give its own fake home folder. On macOS, `tmpdir()` sits under `/var/folders`, which is a symbolic link to `/private/var/folders`, so a fake home made with `mkdtempSync` already has a real path that differs from it. The end-to-end test `cstack/test/e2e/resolve-issue.test.ts` runs the built `cstack publish` with `HOME` set to a temporary folder (line 216), and its project folder sits next to that home, not inside it.

**Governing decisions.** ADR-SIC-F (`docs/decisions/ADR-SIC-F-tracker-access.md`) says that `cstack` never holds credentials. ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`) says how a command checks its arguments and returns its exit code, through `io` and never through `process.exit()`. The `WHY:` comment of `cstack/src/publish/program.ts` lines 3 to 5 keeps every git call in `runProgram()`. No `DECISION:` comment exists in the files to change.

## Decisions

- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. Ticket #80 raises it to 0.3.2. Nobody in this run pushes a tag, and never push a tag that starts with `v`. The coordinator pushes `v0.3.2` once both pull requests are merged. (2026-11-20, from the brief of the run)
- Ticket #80 runs at the same time in another worktree. It changes `cstack/src/tracker/`, the files `cstack/src/commands/tracker-*.ts`, the tests under `cstack/test/tracker/`, the guide `cstack/guides/resolve-issue/ticket.md` and the `cstack tracker` paragraph of `README.md`. Do not change any of them in this branch. (2026-11-20, from the brief of the run)
- This ticket works in `cstack/src/commands/publish.ts`, any new module under `cstack/src/publish/`, the publish tests in `cstack/test/`, such as `cstack/test/publish.test.ts`, and the `cstack publish` paragraph of `README.md`. In `README.md`, change only the `cstack publish` paragraph. If `cstack/src/manifest.ts` must change, change only the entry of `cstack publish`. (2026-11-20, from the brief of the run)
- A child worktree starts with no `node_modules`. An implementer there runs the setup command of the settings, `cd cstack && npm ci`, before its first test run. Never run `npm install`, because it can rewrite `package-lock.json`. (2026-11-20, from the brief of the run)
- When `cstack unit collect` keeps a child worktree, or fails, never remove a worktree or a branch with `git`. Follow step 7 of the build guide. When it asks for a decision, the main conversation tells the user in the chat and the coordinator with `ask`. (2026-11-20, from the brief of the run)
- `cstack helper start`, `cstack helper wait` and `cstack unit collect` call Orca themselves, and that is expected. Nobody runs `orca worktree create` or `orca worktree rm`. Only the main conversation runs `orca orchestration`, and only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-20, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-20, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-20, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-20, from the coordinator of the wave)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. The run waits for the user's explicit approval at the gate, and a French "oui", "ok" or "go" counts as approval. (2026-11-20, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-20, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-20, from the brief of the run)
- Never read, run or change anything under `~/comparison/` or `~/review-candidates/`, which hold private work data. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-20, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-20, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-20, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-20, from the brief of the run)
- When the skill or the installed `cstack` 0.3.1 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-20, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data uses the sample names `user`, `someone` or `runner`. (2026-11-20, from the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. That script never prints a name, and nobody prints the private list. (2026-11-20, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep both changes, and push with a plain `git push`, without force. (2026-11-20, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-20, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. (2026-11-20, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-20, from the brief of the run)
- When the run ends, whatever the ending, the main conversation reports to the coordinator once with `worker_done`. The report gives the pull request link and the state of its checks, or the reason the run stopped, and the path of the retrospective. It stays available afterwards, because the coordinator may ask for a branch update. (2026-11-20, from the brief of the run)
- The new rule lives in a new module, `cstack/src/publish/home-folder.ts`. `brokenRules()` in `cstack/src/commands/publish.ts` (line 62) calls it after its existing rules and adds what it returns to its list. `publish()` already prints that list and returns 1 before any push (lines 180 to 183), so the rule needs no new exit code, and the manifest entry of `cstack publish` stays as it is. The signature of `brokenRules()` does not change. (2026-11-23, assumption not asked, from the code mapping)
- The rule reads each commit of the push, one at a time. It never reads only the final state of the branch, because a path that one commit adds and a later commit removes is still pushed with the first commit. (2026-11-23, the user's answer)
- The commits of the push are the commits that `HEAD` has and that the target ref does not have. When `refs/remotes/origin/<branch>` exists, the commits it has are left out too, because they are already public and `cstack` never forces a push. `git push` updates that ref, so no network call is needed. (2026-11-23, the user's answer)
- The target ref is `refs/remotes/origin/<target>` when `git rev-parse --verify -q --end-of-options refs/remotes/origin/<target>^{commit}` succeeds. Otherwise it is `refs/heads/<target>` when the same check succeeds for it. When neither exists, the rule adds this refusal, with the target name in place of `<target>`: "cstack cannot tell which commits the push would send, because neither `origin/<target>` nor `<target>` exists. Run `git fetch origin <target>`, then run `cstack publish` again." The rule never fetches. (2026-11-23, accepted by default in the question round)
- The rule reads the commits with one call, through the `git()` wrapper of `brokenRules()`, which uses `runProgram()` of `cstack/src/publish/program.ts` (line 16) and never a shell. The arguments are exactly: `-c core.quotePath=off log -p -U0 --no-color --no-ext-diff --no-textconv --no-renames --no-show-signature --src-prefix=a/ --dst-prefix=b/ --format=%x00%h%x00%B%x00 --end-of-options HEAD ^<target ref>`, then `^refs/remotes/origin/<branch>` when that ref exists, then `--`. Each flag keeps a user's git configuration from changing the output, such as `color.ui=always`, `diff.noprefix` or a file name with an accent. (2026-11-23, accepted by default in the question round)
- `ProgramOptions` in `cstack/src/publish/program.ts` (line 6) gets an optional `maxBuffer`, which `runProgram()` passes to `spawnSync`. The `git log` call of the rule sets it to 256 MiB, because the default of Node cuts the output at 1 MiB, and one large change of `package-lock.json` can reach that. No other call changes. (2026-11-23, accepted by default in the question round)
- When the `git log` call fails, for any reason, the rule refuses instead of letting the push through. The refusal reads: "cstack could not read the commits of the push to look for a path in your home folder: <first line of the git error>." The git error goes through `redact()` of `cstack/src/publish/remote.ts` and through the same `~` replacement and control character removal as the paths. (2026-11-23, accepted by default in the question round)
- The output of the call holds, for each commit, a NUL byte, the short id (`%h`), a NUL byte, the full message (`%B`), a NUL byte, and then the patch. Split it on NUL bytes. The patch reader follows the hunk headers `@@ -a,b +c,d @@`, where a missing count means 1. Inside a hunk it reads exactly `b` removed lines and `d` added lines, and skips the lines that start with `\`. So an added line whose text starts with `++` is never taken for a file header. The file name comes from the `+++ b/<path>` line, written as git prints it, and `+++ /dev/null` means a deleted file with no added line. The line number of an added line is its line number in that commit, counted from `c`. (2026-11-23, accepted by default in the question round)
- git shows "Binary files ... differ" and no line for a binary file, so the rule does not read binary files. A merge commit shows no patch in `git log -p`, so a line written while resolving a conflict is not read. Both gaps are accepted. (2026-11-23, accepted by default in the question round)
- The rule also reads the full message of each commit of the push, and a match there names the commit. (2026-11-23, the user's answer)
- The rule also reads the pull request title and body, from `plan.pullRequest` (`cstack/src/plan/read.ts`, line 502), when the plan has them. The body is also committed in the plan file, so a path in the body is reported twice, once as a line of the plan file and once as the pull request body. That is expected. (2026-11-23, from the ticket)
- The home folder comes from `deps.env.HOME` when `deps.env` is defined, and from `os.homedir()` when it is not. A missing or empty `HOME` in `deps.env` means that there is no home folder to look for. `defaultPublishDeps()` (`cstack/src/commands/publish.ts`, line 39) leaves `env` undefined, so the real command uses `os.homedir()`. (2026-11-23, accepted by default in the question round)
- The rule looks for each form of the home folder. The first form is the value as given, without a final `/`. The second form is its real path from `realpathSync()`, when that call succeeds and gives another value. When `realpathSync()` throws, only the given form is used. An empty form and `/` are skipped, as `worktreeValue()` does in `cstack/src/plan/unit-line.ts` (line 58). Unit 4 adds the removal of the final `/` and the skip of an empty form and of `/`, so units 1 to 3 do not do them. (2026-11-23, accepted by default in the question round)
- A form matches in a text when the next character is `/`, the end of the text, or any character other than a letter, a digit, `_` or `-`. A `.` counts as an end only when no letter, digit, `_` or `-` follows it. So the home folder followed by a final `.` at the end of a sentence matches, and the home folder followed by `2` or by `.old` does not. The match is case-sensitive, and the character before the form does not matter. Find the matches with `matchAll()` and one global regular expression built from the escaped form and this lookahead, never with a hand-written loop, so that an empty form can never hang the command. (2026-11-23, accepted by default in the question round)
- For each match, the message shows the path from the start of the form up to the next space, tab, `"`, `'`, backtick, `<` or `>`, at most 80 characters, followed by `…` when it was longer. In that text every form of the home folder becomes `~`, and C0 and C1 control characters are removed. So `<home>/projects/x` shows as `~/projects/x`, and the user name is never printed. The rest of the line is never printed. (2026-11-23, accepted by default in the question round)
- Each added line, commit message, title or body gives at most one place, with the path of its first match. The rule adds one single entry to the list of `brokenRules()` for all the places it found. The entry is exactly this text, with one line per place, at most 20 places, and then the line `  - and <n> more places` when there are more: "These places hold a path in your home folder, which this push would make public. Remove the path from each place. A later commit that removes it is not enough, because the push still sends the commit that adds it, so rewrite that commit.", followed by lines such as "  - `notes.md` line 2, added by commit 1a2b3c4: `~/projects/x`", "  - the message of commit 1a2b3c4: `~/x`", "  - the pull request title: `~/x`" and "  - the pull request body: `~/x`". The places come in this order: the commits from the oldest to the newest, inside a commit its message first and then its lines in the order of the patch, then the title, then the body. (2026-11-23, accepted by default in the question round)
- No flag skips the rule. After a false positive, the user pushes by hand, and `cstack publish` then goes on, because the pushed commits no longer count. (2026-11-23, accepted by default in the question round)
- `makePublishEnv()` in `cstack/test/helpers/publish-env.ts` (line 94) creates a fake home folder `<base>/someone` with `mkdirSync`, puts it in `HOME` of `deps.env`, and returns it as `home` in `PublishEnv`. Every publish test then has a fake home, not only the new ones, because `HOME` is `/Users/runner` in continuous integration. The `plan` option becomes `plan?: (text: string, home: string) => string`, so a test can put the fake home in the pull request title or body. Existing callers keep working. (2026-11-23, accepted by default in the question round)
- Every new test case writes the home path from `env.home`, never a real path of the machine. Every refusal test checks that the standard error holds `~/...` and does not hold `someone` or `env.home`. A test that needs a legitimate path under `/home/` uses `/home/user/app`, as the edited ticket does. (2026-11-23, from the ticket and the brief of the run)
- A test that must show that a line does not stop the push also commits one line that does stop it, and checks that the refusal names only that line. A test that only expects a push would pass before the rule exists, so it could never fail first. (2026-11-23, assumption not asked, from the first quality guard)
- `README.md`: add one sentence to the `cstack publish` paragraph (line 70), after "It refuses to publish while the plan is not ready or a blocking question is open." The sentence is: "It also refuses to push when a commit of the push, a commit message, or the pull request title or body holds the path of your home folder." Change nothing else in `README.md`. (2026-11-23, from the ticket)

## Architecture

The approach is locked by the ticket and the answers of the question round. One new module, `cstack/src/publish/home-folder.ts`, finds the home folder path in the commits of the push and in the pull request text, and `brokenRules()` in `cstack/src/commands/publish.ts` adds what it finds to its list of broken rules. No new decision since the question round.

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

### Unit 1: Refuse a commit that adds a line with the home folder path
- Files: `cstack/src/publish/home-folder.ts`, `cstack/src/publish/program.ts`, `cstack/src/commands/publish.ts`, `cstack/test/helpers/publish-env.ts`, `cstack/test/publish.test.ts`
- Test: `cstack/test/publish.test.ts`: in a new `describe` block, "cstack publish refuses the home folder path", a commit adds `notes.md` whose line 2 holds `<env.home>/projects/x`. `publish()` exits with 1, pushes nothing, and its standard error names `notes.md`, line 2, the short id of that commit and `~/projects/x`, and holds neither `someone` nor `env.home`.
- Minimum code: create `cstack/src/publish/home-folder.ts` with the forms of the home folder, the matcher, the display of a path, the reading of the commits of the push and the patch reader, as `## Decisions` describes them, without the removal of a final `/` and without the skip of an empty form or `/`, which unit 4 adds. Read only the added lines in this unit, not the commit messages and not the pull request text. Leave out only the commits of the target ref in this unit, not those of `refs/remotes/origin/<branch>`. Add the optional `maxBuffer` to `ProgramOptions` and `runProgram()`. Call the rule at the end of `brokenRules()` with the home folder that `## Decisions` describes. Give every publish test the fake home of `makePublishEnv()`.
- Refactor: none.
- Commit message: feat(cli): refuse to publish a commit that adds the path of the home folder
- Depends on: none

Add these cases to the same `describe` block. Each one must fail before the code exists, so each one checks a refusal. First, one file holds, in this order, the lines `/home/user/app`, `<env.home>2/x`, `<env.home>.old/x`, `<env.home>/projects/x`, `see <env.home>.` and `cd <env.home>`: the refusal names lines 4, 5 and 6 of that file and none of lines 1, 2 and 3. Second, a commit adds `notes.md` with `<env.home>/projects/x`, and the next commit removes that line: the refusal still names the first commit. Third, a line that `main` already had: commit `old.md` with `<env.home>/projects/old` on `main`, push `main` to `origin`, rebase the branch onto `main`, then commit `new.md` with `<env.home>/projects/new` on the branch: the refusal names `new.md` and not `old.md`, and the branch is not pushed. Check the pushes of the branch only, because the test itself pushes `main`. Fourth, a home folder reached through a symbolic link: make a real folder and a link to it with `symlinkSync`, set `env.deps.env.HOME` to the link, and commit a line with the real path from `realpathSync` followed by `/projects/x`: the refusal names that line and shows `~/projects/x`. Fifth, with no target ref: delete `refs/remotes/origin/main` with `git update-ref -d` and the local branch `main` with `git branch -D`: the refusal names `origin/main` and `main` and says to run `git fetch origin main`. Sixth, a failing `git log`: add `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=log.date` and `GIT_CONFIG_VALUE_0=bogus` to `env.deps.env`, which makes only `git log` fail. The refusal says that cstack could not read the commits of the push. Seventh, more than 20 places: one commit adds a file with 22 lines that hold `<env.home>/x`: the refusal lists 20 places and then "and 2 more places".

### Unit 2: Read the commit messages and leave out the commits already on the remote branch
- Files: `cstack/src/publish/home-folder.ts`, `cstack/test/publish.test.ts`
- Test: `cstack/test/publish.test.ts`: a commit whose files hold no home path has the message `fix: move <env.home>/x`. `publish()` exits with 1, pushes nothing, and its standard error names "the message of commit <short id>" and `~/x`, and holds neither `someone` nor `env.home`.
- Minimum code: read the full message of each commit, as `## Decisions` describes, and report it before the lines of that commit. Leave out the commits of `refs/remotes/origin/<branch>` when that ref exists.
- Refactor: none.
- Commit message: feat(cli): read the commit messages and skip the pushed commits when cstack publish looks for the home folder path
- Depends on: 1

Add a second case to the same `describe` block. A commit adds `a.md` with `<env.home>/projects/a`, and the test pushes the branch by hand with `git push origin gambitl/units`, which updates `refs/remotes/origin/gambitl/units`. A second commit then adds `b.md` with `<env.home>/projects/b`. The refusal names `b.md` and not `a.md`. Before this unit, the refusal names both files, so the case fails first.

### Unit 3: Refuse a pull request title or body with the home folder path
- Files: `cstack/src/publish/home-folder.ts`, `cstack/src/commands/publish.ts`, `cstack/test/publish.test.ts`
- Test: `cstack/test/publish.test.ts`: with the `plan` option of `makePublishEnv()`, the pull request title of the plan becomes `feat(cli): read <home>/t`, where `<home>` is the second argument that the `plan` option receives. `publish()` exits with 1, pushes nothing, and its standard error names "the pull request title" and `~/t`, and holds neither `someone` nor `env.home`.
- Minimum code: pass `plan.pullRequest` to the rule, and look at the title and then the body, as `## Decisions` describes.
- Refactor: none.
- Commit message: feat(cli): refuse to publish a pull request title or body with the path of the home folder
- Depends on: 1

Add the same case for the body: the line "It reads the plan." of the plan body becomes "It reads `<home>/b`.", with the same `<home>`, and the refusal names "the pull request body" and `~/b`. Before this unit, both cases are refused only for the line of the plan file, so the check of "the pull request title" or "the pull request body" fails first.

### Unit 4: Ignore an empty home folder and the root folder, and document the rule
- Files: `cstack/src/publish/home-folder.ts`, `cstack/test/publish.test.ts`, `README.md`
- Test: `cstack/test/publish.test.ts`: with `env.deps.env.HOME` set to `/`, a commit adds a file with the line `a / b`. `publish()` does not refuse it, pushes the branch once and exits with 0, with the same fake `gh` scenario as the other cases that push.
- Minimum code: remove a final `/` from the home folder, and skip an empty form and `/`, as `## Decisions` describes. Add the sentence of `## Decisions` to the `cstack publish` paragraph of `README.md`.
- Refactor: none.
- Commit message: fix(cli): ignore an empty home folder and the root folder when cstack publish looks for the home folder path
- Depends on: 1

Add two more cases. With `env.deps.env.HOME` set to an empty string, the same commit pushes and exits with 0. With `env.deps.env.HOME` set to `env.home` followed by `/`, a commit that adds `<env.home>/projects/x` is refused and the message shows `~/projects/x`. Before this unit, the first two cases are refused and the third is not, so each case fails first.

## Documentation duties

- `README.md`, the `cstack publish` paragraph: applies, written by unit 4 with the sentence of `## Decisions`.
- The manifest entry of `cstack publish` in `cstack/src/manifest.ts`: does not apply. Its exit code 1 already reads "Refused before any push.", and the command gets no new flag.
- The guides under `cstack/guides/`: does not apply. No guide lists the rules that `cstack publish` checks.
- An ADR: does not apply. The choices of this ticket are small, and they are recorded under `## Decisions`.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. Its story about publishing (US-12) records the design of the project, and `README.md` holds the rules of the command.
- The ticket comment on #79: applies, written to the ticket in the document phase.
- Dependent tickets: does not apply. The ticket feeds no other ticket.

Security: the rule reads text from commits and from the plan file, which is outside input. Every git call goes through `runProgram()`, which never starts a shell, and the revisions come after `--end-of-options`. The branch names come from the plan header, which `brokenRules()` already checks with `git check-ref-format`. The message removes control characters from what it prints, never prints the user name, and passes a git error through `redact()`. No secret is involved.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Read each commit or only the final state
Should the rule read the lines that each commit of the branch adds, one commit at a time, instead of the final state of the branch compared with the target? The final state misses a path that one commit adds and a later commit removes, yet the push still makes that commit public. Reading each commit changes the message: it names the commit, and the line number is the line in that commit, which can differ from the line at the tip of the branch. It also means that a later commit that removes the path is not enough, and the user has to rewrite the commit that added it. Recommended answer: read each commit, from `origin/<target>` to `HEAD`, and name the short commit id, the file and the line number in that commit.
- For: the user
- Answer: read each commit of the push, one at a time, and name the short commit id, the file and the line number in that commit. The user's answer "ok go" to the recommendation, 2026-11-23.

### Question 2: Commit messages
Should the rule also read the message of each commit of the push? The ticket names only the added lines and the pull request title and body, but a commit message is pushed and becomes public too. Recommended answer: yes, read each commit message too, and name the commit in the refusal.
- For: the user
- Answer: yes, read the message of each commit of the push too, and name the commit in the refusal. The user's answer "ok go" to the recommendation, 2026-11-23.

### Question 3: Commits already on the remote branch
Should the rule leave out the commits that `refs/remotes/origin/<branch>` already has? When a commit with the path is already pushed, by hand or before this rule existed, the path is already public, and `cstack publish` would refuse at every run, because `cstack` never forces a push. A push updates `refs/remotes/origin/<branch>`, so the rule can leave those commits out without a network call. Recommended answer: leave them out, and add one test case for it.
- For: the user
- Answer: yes, leave out the commits that `refs/remotes/origin/<branch>` already has, and add one test case for it. The user's answer "ok go" to the recommendation, 2026-11-23.

### Question 4: The copy of the ticket fails the public-text test
The copy of the ticket under `## Ticket` holds two example paths that `cstack/test/fixtures-public.test.ts` refuses in `docs/plans/`. The first is a Docker path under `/home/` with the name `node`, on the lines of "Where things are today" and "Acceptance". The second is the fake home folder `/Users/someone` followed by `2`, in item 2 of "Scope". That test accepts only the names `user`, `someone` and `runner`, and it failed on this plan file when I ran it. The skill copies the ticket word for word, so the plan file cannot be committed as it is. Recommended answer: edit the text of ticket #79 on GitHub so that the first example uses the name `user`, and the second says "a longer name that starts with the same letters, such as `someone2`" without the `/Users/` prefix. Then copy the ticket again into the plan file.
- For: the user
- Answer: edit the text of ticket #79 on GitHub, so that the Docker example uses the name `user` and the second example says "a longer name that starts with the same letters, such as `someone2`". Then copy the ticket again into the plan file. The user's answer "ok go" to the recommendation, 2026-11-23. Done on 2026-11-23: the ticket was edited and copied again, and `cstack/test/fixtures-public.test.ts` passes on this plan file.

## Review log

Impact notes. The changed symbols are used only by `cstack/test/publish.test.ts`, by the helper `cstack/test/helpers/publish-env.ts` (also used by `cstack/test/e2e/resolve-issue.test.ts`, which keeps working), and by the callers of `runProgram()`, which are not affected because `maxBuffer` is optional. The files that usually change with these are all in the diff. No `WHY:` or `DECISION:` comment conflicts with the change.

Findings and fixes.
- Security, fixed: a NUL byte in a pushed file, placed after byte 8000, shifted the reading of the `git log` output, so later commits were never checked. The rule now splits the output on a random separator, and a new test covers it.
- Correctness, fixed: the git setting `diff.interHunkContext` added context lines that the patch reader did not count. The command now passes `--inter-hunk-context=0`, the reader also counts context lines, and a new test covers it.
- Conventions, fixed: the local function `escape` shadowed a global one, so it is now `escapeRegex`.
- Simplicity, not done: `matcher()` and `hideHome()` build the same expression twice. The gain is about three lines, so I left it.
- Follow-ups, not done: a file marked `-diff` in `.gitattributes` is read as binary, which is the accepted gap. A single-branch clone does not update `refs/remotes/origin/<branch>`, so pushing by hand would not clear a refusal there.


Independent review. The reviewer found one bug and fixed it in commit `cc0d3a3`. The path shown in a refusal did not stop at the end of a line, so a path at the end of the first line of a commit message ran into the next line. The path now ends at a line break, and a new test covers it. The full suite passed after the fix, and every acceptance criterion has a test.

Judgment calls for the pull request body.
- The rule runs before `cstack publish` fetches the target branch. A stale local copy of `origin/<target>` can make the rule read commits that are already public. That is safe, but it can confuse.
- The shown path can still hold the user name when it appears again after the home folder, as in `~/projects/someone-app`.
- The match is case-sensitive, so `/users/name` is not caught on a case-insensitive disk.
- When the `git log` output passes 256 MiB, the refusal ends with an empty reason.
- The helper `plain()` now exists in both `publish.ts` and `home-folder.ts`.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

none

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

- A comment on ticket #79 at https://github.com/gambitl/claude-code-stack/issues/79, posted with `cstack tracker comment`.
- The `cstack publish` paragraph of `README.md`, written by unit 4.
- No dependent ticket, no decision record and no other page, as the "Documentation duties" say.

## Executor notes

- The implementers of units 3 and 4 did not break the rule on purpose after the red run, as the negative-test decision asks. They relied on the saved red run, where the rule did not exist yet. Units 1 and 2 did the break.
- While I resolved the README conflict in the rebase, a `sed` range deleted the tracker paragraph of the other side. I saw it in `git diff origin/main -- README.md` and restored the paragraph in its own commit.
- `cstack helper start` ran the implementers as sub-agents because Orca was not running, so no child worktree was used and `cstack unit collect` skipped every unit.

## Hand-off log

- 2026-11-23, executor run 1: moved ticket #79 to "in progress" with `cstack tracker`, and committed the plan file on the branch `gambitl/publish-home-path`. Built units 1 to 4, reviewed, ran the independent review, and rebased the branch onto `main` (one README conflict).

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**Read each commit of the push, not only the final state of the branch?** A path that one commit adds and the next one removes does not show in the final diff, yet the push still makes that commit public. Reading each commit means the message names the commit, and the fix is to rewrite that commit, not to add another one. I recommend reading each commit, because it is the only way to keep the promise of the ticket.

**Read the commit messages too?** The ticket names only the added lines and the pull request text, but a commit message leaves with the push and becomes public. No diff shows a message, so it takes one more `git log` call. I recommend yes.

**Leave out the commits that are already on `origin/<branch>`.** The draft counts every commit that `HEAD` has and `origin/<target>` has not. When a bad commit is already pushed, by hand or before this rule existed, `cstack publish` would then refuse forever. The path is already public, and `cstack` never forces a push. I checked that a push updates `refs/remotes/origin/<branch>`, so the rule can leave those commits out without going to the network. I recommend leaving them out, with one more test case.

**Fix the text of ticket #79 on GitHub so that the plan file can be committed.** A test of this repository refuses any home folder path in `docs/plans/`, except under the sample names `user`, `someone` and `runner`. The copy of the ticket in the plan file holds two examples that break it: a Docker path under `/home/` with the name `node`, and the fake home folder followed by `2`. I copy the ticket word for word, so I cannot fix only the copy. I recommend editing the ticket so that the Docker example uses the name `user`, and the second one says "a longer name that starts with the same letters, such as `someone2`". Then I copy the ticket again. The meaning of the ticket does not change.

**I will do this unless you say no**

- The rule reads `HOME` from the environment of the deps when there is one, and `os.homedir()` otherwise. `makePublishEnv` gives a fake `HOME` to every publish test, not only the new ones, because `HOME` is `/Users/runner` in continuous integration. Accepted by default, 2026-11-23.
- `git log` runs with `--no-color --no-textconv --src-prefix=a/ --dst-prefix=b/` and `core.quotePath=off`. I checked that `color.ui=always`, `diff.noprefix` and a file name with an accent each change the output enough to break the reading. Accepted by default, 2026-11-23.
- `runProgram()` gets an optional `maxBuffer` for this call. I checked that Node cuts the output at 1 MiB, which one large `package-lock.json` change can reach. If git still fails, the rule refuses instead of letting the push through. This touches `cstack/src/publish/program.ts`, which the ticket that changes the tracker commands (#80) does not touch. Accepted by default, 2026-11-23.
- The home folder matches only when `/`, the end of the line or a final punctuation mark follows it, and the case counts. So `someone2` and `someone.old` do not match. Accepted by default, 2026-11-23.
- Each refusal writes `~` and the path it found up to the next space, never the rest of the line. Accepted by default, 2026-11-23.
- No flag skips the rule. For a false positive, you push by hand, and `cstack publish` then goes on because the pushed commits no longer count. Accepted by default, 2026-11-23.
- When `origin/<target>` is missing, the local target branch stands in. When both are missing, the rule refuses and asks for a `git fetch`. It never goes to the network itself. Accepted by default, 2026-11-23.

**I checked it myself**

- git shows no lines for a binary file, so the rule does not read binary files.

**Good to know**

- A merge commit shows no patch in `git log -p`, so a line written while resolving a conflict escapes the rule.
- The rule only guards `cstack publish`. The plain `git push` that this run makes after the pull request opens is not checked.

#### Details

Reading each commit is blocking. A test answered the facts, but the choice belongs to the user. The draft evidence holds: in a scratch repository with git 2.55.0, `git log -p -U0 main..HEAD` showed a line that a later commit removed, and `git diff -U0 main...HEAD` did not. I agree with the draft recommendation. The cost is that the line number is the line in that commit, and that the user must rewrite history to clear a refusal. The refusal message should say so in one sentence, for example "rewrite commit abc1234 so it no longer adds this line". If nobody decides, the plan would read the final state only, and a path added then removed would leave with the push.

Reading the commit messages is blocking, and a test answered it. A diff never carries the message, so the rule needs a second call such as `git log --format=%H%x00%B%x00` over the same range. I agree with the draft recommendation. The authorship fields (name and email) are out of scope: they never hold a path. If nobody decides, a path in a commit message is pushed silently.

Leaving out the commits already on the remote branch is blocking, because it changes the acceptance criteria. The draft non-blocking answer 3 counts the commits that `HEAD` has and `refs/remotes/origin/<target>` has not. On a second `cstack publish` after a first push, that range still holds the pushed commits. If one of them holds the home folder path, the rule refuses on every later run, and no fix commit helps when the rule reads each commit. `pushBranch()` in `cstack/src/publish/branch.ts` never forces a push, so the only way out would be a force push by hand. I checked in a scratch repository that `git push origin refs/heads/b:refs/heads/b` updates `refs/remotes/origin/b`, and that `git log HEAD --not refs/remotes/origin/main refs/remotes/origin/b` then leaves the pushed commit out. So the range should be `HEAD --not refs/remotes/origin/<target> refs/remotes/origin/<branch>`, with the second ref only when it exists. The same exclusion is the way out for a false positive, which is why I recommend no bypass flag. A stale remote-tracking ref only makes the rule read a few commits too many, which is safe. This adds one acceptance case to `cstack/test/publish.test.ts`: a commit with the fake home folder that is already on the remote branch does not stop the push. If nobody decides, a branch with one leaked commit on the remote can never be published again by `cstack`.

Fixing the text of ticket #79 is blocking, because the plan file cannot be committed until it is done. `findHomePaths()` in `cstack/test/helpers/fixtures-public.ts` line 11 reports any path under `/Users/` or `/home/` whose name is not `user`, `someone` or `runner`. `cstack/test/fixtures-public.test.ts` line 73 runs it on every file of `docs/plans/`, and it failed on this plan file. The failing lines are in the copy of the ticket: the Docker example under `/home/` with the name `node`, in "Where things are today" and in "Acceptance", and the fake home folder followed by `2`, in item 2 of "Scope". The skill copies the ticket word for word, so editing only the copy would make the plan disagree with the ticket. The recommended answer is to edit the ticket on GitHub, as Question 4 says, and to copy it again. Another option was to loosen `findHomePaths()` for these examples. I rejected it, because that test is the last guard of this public repository and this ticket does not own it. If nobody decides, the run cannot commit its plan file.

The fake home folder is non-blocking, and it extends draft answer 5. Draft answer 5 reads `HOME` from `deps.env` when the deps give one, and `os.homedir()` otherwise, skipping an empty home and `/` like `worktreeValue()` in `cstack/src/plan/unit-line.ts` line 57. `makePublishEnv()` in `cstack/test/helpers/publish-env.ts` copies `process.env` (line 121), so every existing case runs with the real `HOME`. On macOS continuous integration that is `/Users/runner`, a sample name the test data is allowed to use. Setting a fake `HOME` in `makePublishEnv()` for every case keeps the whole file independent of the machine. The setup git calls of the helper use the process environment, not `deps.env`, and the repository config sets the identity, so losing the global git config in `publish()` changes nothing the tests rely on. The end-to-end test `cstack/test/e2e/resolve-issue.test.ts` already sets `HOME` to a sibling of the project folder (line 216), so its project paths never start with that home.

Making the reading independent of the user's git config is blocking, and a test answered it. `git log -p` is a porcelain command, so its output follows the user's config. In a scratch repository, `-c color.ui=always -c diff.noprefix=true` added colour codes and removed the `a/` and `b/` prefixes, and the default `core.quotePath` printed a file named with an accent as `"caf\303\251.md"`. With `--no-color --src-prefix=a/ --dst-prefix=b/` and `-c core.quotepath=off` placed before `log`, the output was plain. `--no-textconv` matters too, because textconv is on by default for `git log` and a textconv filter would change the lines read. `--no-ext-diff` is the default for `git log`, but stating it costs nothing. Rename detection can stay on, because a pure rename adds no line. If nobody decides, the rule misses paths or fails on machines with such a config.

The output size is blocking, and a test answered it. `runProgram()` in `cstack/src/publish/program.ts` line 21 calls `spawnSync` with no `maxBuffer`. On Node 26.10.0, a child that writes 2 MiB came back with `status` null, the error `ENOBUFS` and 1 MiB of output. So `ok` is false, and a branch with a large generated file would either crash the rule or pass it unread. The recommendation is an optional `maxBuffer` field on `ProgramOptions`, set high (for example 256 MiB) for this call only, and a refusal that names the failure when git still fails. Every git call keeps going through `runProgram()`, as its `WHY:` comment asks. The run brief lists `publish.ts` and new modules under `cstack/src/publish/`. `program.ts` is an existing file there, and ticket #80 does not touch it, so the change stays inside the spirit of that decision. Another option was `git log -G<home>` to let git keep only the matching file pairs. I rejected it as the main answer because it needs the home folder escaped as a POSIX regex and two patterns for the two forms of the home folder. It stays a possible optimisation.

Where the home folder path ends is non-blocking, as in draft answer 4. I keep the draft rule. The implementation must escape the home folder before it builds a regular expression, because a macOS short name may hold a `.`, as in `first.last`. The match is case-sensitive, so a lowercase `/users/someone` on a case-insensitive disk is missed. That is rare and acceptable.

What the message prints is non-blocking, as in draft answer 7. I keep the draft rule. The printed fragment comes from the user's own files, so control characters are a small risk. Passing it through the `plain()` helper of `publish.ts` line 111 costs nothing.

Having no bypass flag is non-blocking. A flag such as `--allow-home-path` would add to the public usage line in `cstack/src/manifest.ts` and to the tests that run every command. The realistic false positive is a home folder that is also a common path, such as `HOME=/home/runner` inside a container, with a Dockerfile line `/home/runner/app`. With the exclusion of pushed commits, the user pushes by hand once and `cstack publish` continues. If that proves too rough, a later ticket can add the flag.

A missing target ref is non-blocking, as in draft answer 3. I keep the draft. The rule falls back to the local target branch and refuses when both are missing. It never fetches inside the rules.

Binary files are non-blocking, as in draft answer 6, and a test answered it. The draft evidence holds, because git prints "Binary files differ" and no lines.

Merge commits are non-blocking. By default `git log -p` prints no patch for a merge, so a line written while resolving a conflict is not read. `--cc` would show it, but its combined format has two prefix columns and another hunk header, which the parser would have to handle. The gap is small, and the draft already accepts it.

What the rule does not guard is non-blocking. One decision of this plan file says to push a branch update with a plain `git push` after the pull request opens. That push does not go through `cstack publish`, so the rule does not check it. The two checks that the decisions ask for before `cstack publish` still apply by hand.

The pull request body is also committed in the plan file, so a home folder path there produces two refusal lines, one for the plan file line and one for the pull request body. That is acceptable and needs no change.

I checked data model lock-in and operations and cost, and found nothing that this ticket touches.

### Open questions and answers

1. Blocking question 1: read each commit of the push, or only the final state of the branch compared with the target. I checked it in a scratch repository with git 2.55.0. A commit added `X /Users/someone/p` to `f.txt`, and the next commit removed it. `git log -p -U0 main..HEAD` showed the added line in the first commit. `git diff -U0 main...HEAD` did not show it at all. Recommended answer: read each commit and name the commit in the message. The user accepted it on 2026-11-23, see Blocking question 1.
2. Blocking question 2: also read the commit messages. Recommended answer: yes. The same scratch repository put `/Users/someone/msg` in a commit message, and neither diff shows a message, so the rule needs `git log` with the message in its format. The user accepted it on 2026-11-23, see Blocking question 2.
3. Non-blocking: which commits count. Recommended answer, accepted unless the user objects: the commits that `HEAD` has and `refs/remotes/origin/<target>` has not. When that ref is missing, the local branch `<target>` stands in. When both are missing, the rule refuses and asks the user to run `git fetch origin <target>`. The rule fetches nothing, because `updateBranch()` fetches later and the rules must stay offline. A merge commit shows no patch with `git log -p`, so its own lines are not read. The lines that a merge brings from the target are already on the target. Accepted by default, 2026-11-23.
4. Non-blocking: what "the end of the path" means. Recommended answer, accepted unless the user objects: the home folder matches when the next character is `/`, the end of the line, or any character other than a letter, a digit, `_` or `-`. A `.` counts as an end only when no letter, digit, `_` or `-` follows it. So the home folder followed by a final `.` at the end of a sentence matches. The home folder followed by `2`, or by `.old`, does not match. The match is case-sensitive. Accepted by default, 2026-11-23.
5. Non-blocking: where the fake home comes from. Recommended answer, accepted unless the user objects: the rule reads `HOME` from `deps.env` when the deps give an environment, as the ticket suggests, and calls `os.homedir()` otherwise. An empty home and `/` are skipped, as `worktreeValue()` does in `cstack/src/plan/unit-line.ts` line 58. When `realpathSync()` fails, only the given form is used. Accepted by default, 2026-11-23.
6. Non-blocking: binary files. Recommended answer, accepted unless the user objects: git shows "Binary files differ" for them and no lines, so the rule does not read them. The scratch repository showed this for a file with a NUL byte. Accepted by default, 2026-11-23.
7. Non-blocking: what the message prints. Recommended answer, accepted unless the user objects: each refusal names the place and prints the path it found up to the next space or quote, with `~` in place of the home folder, for example `~/projects/x`. It never prints the rest of the line. Accepted by default, 2026-11-23.
8. Blocking question 3: leave out the commits that are already on the remote branch. Raised by the CTO advisor. The user accepted it on 2026-11-23.
9. Blocking question 4: the copy of the ticket failed `cstack/test/fixtures-public.test.ts`. I checked it: the test reported the Docker path and the fake home folder followed by `2` on this plan file. The user accepted the edit of the ticket on 2026-11-23, and the test passed after the new copy.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
