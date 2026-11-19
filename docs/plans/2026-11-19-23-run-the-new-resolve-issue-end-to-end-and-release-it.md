# Plan: #23 — M2-11: Run the new resolve-issue end to end and release it

Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/23
Tracker: GitHub
Documentation tool: docs/ folder (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/end-to-end-release
Target branch: main
Conversation language: French
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Connect the parts of milestone 2, prove that a whole run of the new `resolve-issue` works from the first step to the pull request, then publish it and install it on the maintainer's computer.

- **What the title means**: `resolve-issue` is the skill that takes one ticket all the way to a pull request, which is the request to merge the work into the main code. The new version is the short skill and the `cstack` commands that the other tickets of milestone 2 built. To run it end to end means to go through every step of a real run, from reading the ticket to opening the pull request. To release it means to publish a new numbered version of `cstack` on GitHub, which installs the skill with it.
- **Why we are doing it**: Each ticket of milestone 2 tested its own part. Only a whole run shows that the parts fit together, for example that the guides call the commands with the right options. The baseline runs are two runs of today's skill that serve as the reference of the comparison. They must finish before the new skill replaces today's skill on the maintainer's computer.
- **For the user**: Solution engineers get a release they can install with one command, and that has already completed a real run.

**Goal.** This ticket wires the settings file and the new plan format into the commands that still lack them, adds the last automatic tests of milestone 2, runs the new `resolve-issue` end to end, releases it, and installs it on the maintainer's machine (US-6 to US-10, and US-12). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. Every part comes from the tickets that block this one. #13 gives the format, the phase list and the command list, and #14 the settings reader. #15 to #18 and #20 give the commands, and #21 and #22 give the skill, the prompts and the guides. #9 gives the release workflow and `cstack skills install`, and #11 gives `cstack measure`. None of them is in the repository yet.
* **What is not wired yet**: #15 and #18 are not blocked by #14, so they cannot use its settings reader. When they land, `cstack next` does not print the settings yet, and `cstack unit commit` does not add the attribution lines yet. `cstack measure` of #11 reads the two moments of a run from the git history of the plan file, and it refuses a plan file that has a `Format:` line. Without a change, the comparison runs of #32 cannot be measured.
* **The prose skill on the maintainer's machine**: `pull-skills.sh` (lines 85 to 94) copies the prose skills into `~/.claude/skills/` and keeps the old ones in a dated backup folder. A folder that it wrote has no `.cstack-managed` marker, so `cstack skills install` of #9 skips it unless you pass `--adopt resolve-issue`.
* **The order with the baseline**: `docs/projects/skills-into-cli.md` (line 256) says that the baseline runs must happen before milestone 2 changes the skill. #12 makes those two runs with the prose skill.
* **Specification**: `docs/projects/skills-into-cli.md` (line 30) asks that every cstack command has tests, and that CI fails when a skill or a guide names a command that does not exist. Lines 106 to 163 hold US-6 to US-12. US-11 was dropped on 2026-11-19, together with Graphify, and #45 removes it from `cstack`.

## Scope

1. Wire the settings into `cstack next`. Each call reads `.cstack/settings.json` with the reader of #14.
   - An invalid settings file makes `cstack next` exit with `3` before it prints any guide. The message of the reader names the wrong key, so a run stops at its very first command.
   - Above each guide, `cstack next` prints a short block headed "Settings of this repository". It lists every key with its value, and marks a value that comes from the default.
2. Wire `commitAttribution` into `cstack unit commit` of #18. Add each trailer line of the setting after `Cstack-Unit: <n>`.
3. Make `cstack measure` of #11 read the plan format of #13.
   - When the plan file has a `Format:` line, read it with the plan reader of #13. Take the approval moment from `Approved at` and the "ready for review" moment from `Ready for review at`. Stop refusing such a file.
   - A plan file without a `Format:` line keeps the method of #11, which reads both moments from the git history of the file.
   - A version 1 plan file whose `Ready for review at` still says `not yet` counts as a missing moment. `cstack measure` then prints the tokens and exits with `1`, as it does today.
4. Add the CI test that every command of the list is implemented, in `cstack/test/manifest-implemented.test.ts`. For each entry of `cstack/src/manifest.ts`, it imports the file that the entry names under `cstack/src/commands/`, and checks that the file exports a handler. It also checks that the entry point `cstack/src/cli.ts` sends the words of the command to that handler, so `cstack <command>` never answers "unknown command".
5. Add the CI test `cstack/test/guides/phases-have-guides.test.ts`. Every phase of the list has a guide in `cstack/guides/resolve-issue/`, and every guide there belongs to a phase.
6. Add the scripted end-to-end test `cstack/test/e2e/resolve-issue.test.ts`. It needs no Claude and no network.
   - It creates, in a temporary folder, a small Node project as a git repository, with a `main` branch and two tested functions.
   - It adds a bare repository as `origin`. Pushes reach it through git's `url.<path>.insteadOf` setting, so the remote URL still names `github.com`. A `pre-receive` hook in the bare repository logs every push it receives.
   - It writes `.cstack/settings.json` with `testCommands`, one `commitAttribution` line and no `review` key. It puts a fake `gh` on the `PATH`, and it uses a temporary home folder.
   - It writes a plan file of format 1 with three units. Units 1 and 2 share a file, and unit 3 has a `No test` line. One blocking question has its answer.
   - It then runs the commands in the order that the real guides of #21 and #22 give. It writes the code of each unit from fixture files, as an implementer would.
7. Publish a release. Raise the version in `cstack/package.json` to the next minor version, merge, and push the tag `v<version>`. The release workflow of #9 then attaches `cstack-<version>.tgz` to the GitHub release.
8. Install the release on the maintainer's machine, but only after #12 has recorded both baseline runs. Run `npm install -g` with the release link, then `cstack doctor`, then `cstack skills install --adopt resolve-issue`.
   - Check that the prose skill moved to `~/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/resolve-issue`.
   - Check that `~/.claude/skills/resolve-issue/.cstack-managed` holds the new version.
   - Check that a new Claude Code session lists `/resolve-issue` and the agent `resolve-issue:executor`.
9. Run the new skill end to end with Claude, on a small test repository created for this test. Never use a work repository for it.
   - Create a new private GitHub repository under the maintainer's account, such as `resolve-issue-e2e`. Give it a tiny Node library with a few tests, a GitHub Actions workflow that runs them, a `CLAUDE.md`, and a `.cstack/settings.json`.
   - Write one GitHub issue there, in the standard ticket shape, small enough for two or three units. Make one of the units a change to the documentation only.
   - In a fresh clone, start a new Claude Code session and run `/resolve-issue <issue>`. Answer the questions and approve the plan as a user would.
10. When the run with Claude finds a bug, fix it with a test, release again, and run `cstack skills install`. The `--adopt` option is not needed any more, because the folder now carries the marker. Then run the skill again on a new issue of the test repository.
11. Add to the README how to go back. You install the previous release with `npm install -g` and run `cstack skills install`. To return to the prose skill, you move the backup folder back into `~/.claude/skills/`, or you run `pull-skills.sh --apply`, which reads the frozen prose skills.

## Acceptance (TDD)

* `cstack/test/next-settings.test.ts`: write first the case of a settings file with the unknown key `reviewer`. `cstack next` must exit with `3`, name `reviewer`, and print no guide. Then a valid file prints the block "Settings of this repository" above the guide, with every key and the defaults marked.
* `cstack/test/unit-commit.test.ts`: a commit made by `cstack unit commit` ends with `Cstack-Unit: <n>` followed by each line of `commitAttribution`. With an empty list, the trailer `Cstack-Unit` is the last line.
* `cstack/test/measure.test.ts`: write first the case of a version 1 plan file whose header holds both times. `cstack measure` must stop refusing it, and print the minutes between the two times without reading the git history. A plan file without a `Format:` line still gives its moments from the git history. A version 1 plan file whose `Ready for review at` says `not yet` prints the tokens, says that the moment is missing, and exits with `1`.
* `cstack/test/manifest-implemented.test.ts`: write first a fixture list with an entry `cstack frobnicate` whose file does not exist, and check that the test fails and names it. Then every real entry is implemented.
* `cstack/test/guides/phases-have-guides.test.ts`: write first a fixture folder with an extra guide `deploy.md` that belongs to no phase, and check that the test fails. Then the real folder passes.
* `cstack/test/e2e/resolve-issue.test.ts` checks US-6 end to end. Each `cstack next` prints exactly one real guide, with the settings block above it. `cstack next --phase briefing` before `document` is done exits with `1`. A copy of the plan file with `Format: cstack-plan/2` exits with `3`.
* `cstack/test/e2e/resolve-issue.test.ts` checks US-7. `cstack plan status` follows the commits. `cstack plan section Decisions` prints one section. `cstack report submit done` is refused before the last unit is committed, and accepted after.
* `cstack/test/e2e/resolve-issue.test.ts` checks US-8. `cstack unit green 1` before `cstack unit red 1` exits with `1`. Unit 3, which has no test, commits without any saved run.
* `cstack/test/e2e/resolve-issue.test.ts` checks US-9. `cstack unit order` puts units 1 and 2 in different batches. Each unit commit holds only its own files, its trailer and the attribution line. `cstack report submit complete` exits with `1`, and `cstack report check` prints the accepted done report.
* `cstack/test/e2e/resolve-issue.test.ts` checks US-10. An unknown key in the settings file stops the first `cstack next` with `3`. The settings block shows the review agent `claude`.
* `cstack/test/e2e/resolve-issue.test.ts` checks US-12. `cstack publish` exits with `1` while a blocking question is set back to `open`, and the bare repository logs no push. Once the plan is ready, it logs exactly one push. The fake `gh` receives one `pr create` with the plan's title, and the checks cstack reads belong to the pushed commit.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A reviewer finds the GitHub release with `cstack-<version>.tgz` attached. On the maintainer's machine, the reviewer finds the backup folder of the prose skill and the marker with the new version.
* A reviewer reads the outcome of the run with Claude, which the maintainer adds as a comment on this ticket. The run went through every phase with `cstack next`, and its plan file has format 1. Every unit commit carries its trailer, and each unit with a test has a saved failing run. The branch was pushed once, and the pull request opened with the title of the plan. The checks were read on the pushed commit, and a retrospective was written. `cstack measure` on the plan file printed the four kinds of tokens and the minutes. The comment holds figures from the test repository only.
* The scripted test never touches the real `~/.claude`, because it uses a temporary home folder. Nobody runs `cstack skills install --adopt resolve-issue` on the maintainer's machine before #12 has recorded both baseline runs.

**Size: M** · Blocked by: #14, #15, #16, #17, #18, #20, #21, #22, #45, #12 · Feeds: #31, #32

---

## CTO review — The new skill is installed on the maintainer's machine only after the baseline runs (2026-11-17)

1. The new `resolve-issue` goes onto the maintainer's machine only after both baseline runs of #12 are measured and recorded. That is why this ticket is blocked by #12, while the rest of milestone 2 is not.
2. Until then, milestone 2 is tested only in CI and in temporary folders. Nobody runs `cstack skills install --adopt resolve-issue` on the maintainer's machine before step 8 of this ticket, as #9 also says.
3. The install uses `--adopt`, which first moves the prose skill to `~/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/resolve-issue`. Moving that folder back restores the prose skill, and the tag `prose-skills-final` of #8 keeps it in the repository.

### Ticket comments

#### Comment of 2026-11-18

Ticket #14 adds `readSettings(root)` in `cstack/src/settings.ts`. Each command that calls it finds the root with `git rev-parse --show-toplevel`. The reader throws a `SettingsError` for every failure, and the command should return exit code 3. A missing file is not an error: the result then holds every default and `found` is false.

The result gives each value with its source, `file` or `default`. `commitAttribution` is a list of trailer lines, empty by default.

Two notes for the release. Until #21 adds `SKILL.md`, the package ships a `resolve-issue` folder that holds only templates. Then `cstack skills install` skips it on a machine with the prose skill and exits with code 1, and `--adopt resolve-issue` would replace that working skill with a backup.

Also, the reader follows a symbolic link at `.cstack/settings.json`. A link to a device such as `/dev/zero` would make it hang. The first command that calls the reader should refuse anything that is not a regular file.

#### Comment of 2026-11-18

Ticket #13 put the two moments that `cstack measure` needs into the plan file. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

A plan file in format `cstack-plan/1` has the header lines `Approved at:` and `Ready for review at:`. Each holds an ISO 8601 time with its offset, such as `2026-11-17T14:32:05+01:00`, or `not yet`. `readPlan` in `cstack/src/plan/read.ts` returns both. Until your ticket lifts the refusal, `cstack measure` still refuses a plan file that has a `Format` line, as it does today.

#### Comment of 2026-11-18

Hand-down from ticket #22, the build prompts and guides.

Where things are: the prompts are in cstack/skills/resolve-issue/agents/ (executor.md, implementer.md and eight more, loaded by Claude Code as resolve-issue:<name>). The guides build, review, independent-review, update-branch, document, briefing, after-build-questions, ready, retro and publish are in cstack/guides/resolve-issue/.

What they need that is not built yet: cstack next, plan status, plan section, report submit and check, unit order, red, green and commit, graph ensure and publish. The tests only check the text, so nothing ran these commands.

What your run needs: .cstack/settings.json must give testCommands, and testCommands.file when units run in parallel. Without it, cstack unit red exits with 3 and the build returns a needs-decision report.

Left to add: when ticket #21 is on main, add writing.md and settled-decisions.md to cstack/test/skills-package.test.ts, and add the two new prompts to the files that cstack/test/guides/settings-applied.test.ts checks. Also note that the executor fills the existing Executor notes heading of the plan and never adds a second one.

#### Comment of 2026-11-18

The work of #21 gives you the planning guides and the entry skill that your end-to-end run will use. Here is what to build on.

The guides call these commands: `cstack next`, with `--done <phase>`, `--done ticket --plan <plan file>`, `--phase retro` and `--new`, plus `cstack guide <phase>`, `cstack guide retro`, `cstack graph ensure`, `cstack report check` and `cstack unit order`. Only the guide command is built today, so your run is the first proof that the flags fit.

When a run stops before the build, the guides keep the plan file in the worktree, uncommitted, and then run `cstack next --phase retro`. A stop in the `ticket` phase happens before any run exists, so that guide runs `cstack guide retro` and skips the final `cstack next --done retro`. When `cstack next` names the plan file of another ticket, the entry skill runs `cstack next --new` and tells the user which plan file it set aside. After `cstack report check` exits with `1`, the `plan` guide launches the executor again once. If the second run also ends without an accepted report, Claude stops and tells the user.

The entry skill says that the settings printed above each guide win over any default of a guide. It expects a block of those settings from your work. The example settings file has no `testCommands`, and the `plan` guide warns the user about it before the approval gate, because `cstack unit red` exits with `3` without them.

The entry skill and the `ticket` guide hold 1,306 words together. The planning guides are longer than today's phases: 3,714 words against 3,204. If your measurement against the baseline of #12 disappoints, `plan.md` is the first guide to shorten.

#### Comment of 2026-11-18

The pull request of the ticket that reads the plan and checks the reports (#16) gives you four commands to run in the end-to-end test: `cstack plan status [--json]`, `cstack plan section <name>`, `cstack report submit <kind>` and `cstack report check`. Each takes `--plan <file>`. `plan status` exits with 1 when git and the plan disagree, so a clean run should end with exit code 0.

#### Comment of 2026-11-18

Ticket #18 built `cstack unit commit`, so you know where to add the attribution lines. The commit message is built in `commitUnit` in `cstack/src/commands/unit-commit.ts`. It writes the unit's commit message, a blank line, and the trailer `Cstack-Unit: <n>` into a file in a private temporary folder. It then runs `git commit -F <file> --only -- <paths>`.

Git reads trailers only in the last paragraph of the message. Add each `commitAttribution` line directly after the `Cstack-Unit` line, with no blank line between them. That keeps them in the same paragraph as the trailer, and `listUnitCommits` in `cstack/src/plan/commits.ts` still reads the unit number back. The message never goes through a shell, and you should keep it that way: the test `cstack/test/unit-commit.test.ts` checks that a message holding `$(touch pwned)` lands byte for byte.

The settings reader of #14 is not a dependency of #18, so `cstack unit commit` does not read the settings file yet. You will need to read it there. Also, the README sentence in the "Commands" section counts the commands. It says six after this ticket, so change it if your branch adds a command.

#### Comment of 2026-11-19

I updated this ticket on 2026-11-19, because the maintainer dropped Graphify from the new version. The end-to-end test no longer puts a fake `graphify` on the `PATH`. It no longer checks `cstack graph ensure` or US-11 either. #45 replaces #19 among the blockers: it removes Graphify and that command from `cstack`.

#### Comment of 2026-11-19

Ticket #15 built `cstack next`, and your end-to-end run uses it. The code is in the branch `gambitl/next-phase` until its pull request merges.

What to know before you run it. The tests of `cstack next` use fifteen short fixture guides, never the real guides in `cstack/guides/resolve-issue/`. Your run is the first one that uses the real guides. The two sentences that hand work between the main conversation and the executor are prose, and no test runs them. Watch that handoff.

The run line has this form: `Run: <plan file>. Phase 6 of 15: build, in the executor.`. When the run line says the phase runs in the other place, the skill or the executor must not follow that guide. `--done` prints one line instead of the guide in that case.

Watch one case. If the executor stops after `cstack next --done ready` and before its done report, a plain `cstack next` shows it the `retro` guide. The executor prompt has one sentence for this case: commit the plan file and submit the done report. The pull request of #15 has a non-blocking question about solving this in the code.

The settings of the repository are not printed yet. When they are, they go between the run line and the guide: `printGuide` in `cstack/src/commands/next.ts` writes the two as separate writes. The plan header gets a local time with its offset, and `state.json` gets UTC times.

#### Comment of 2026-11-19

Context from ticket #17, for whoever runs the new skill end to end.

`cstack unit red <n>` and `cstack unit green <n>` are built. Red needs a test that fails and saves it. Green needs a saved failing run and a test that now passes. The files are `units/<n>/red.json` and `green.json`, with `red.log` and `green.log`, in the run folder.

What the commands refuse, in plain words. Red refuses a passing test (exit 1), a unit with a `No test` line (exit 1, commit it directly), a missing test file (exit 1) and a command that cannot start or times out (exit 5). Green refuses a unit with no saved failing run (exit 1), a changed test command since the failing run (exit 1) and a test that still fails (exit 1). Both exit 3 for an invalid plan or settings file, and when `testCommands` is missing.

Please keep in mind: the shell call that runs these commands needs a timeout of at least ten minutes, as the implementer prompt now says. The Claude Code shell tool caps at ten minutes, which is also the default timeout of cstack, so a very long suite may be cut by the tool first. A green run that fails also deletes an earlier passing run, so the implementer has to run green again after any change.

#### Comment of 2026-11-19

Heads-up from #45, which removes Graphify. When this ticket starts, the shipped guides, agent prompts and settled decisions no longer name Graphify. The guides tell the agent to map the code by searching the whole repository and reading only the lines that the search points to.

`cstack doctor` has no Graphify item any more, and `cstack graph ensure` is gone from the command list in `cstack/src/manifest.ts`. Do not add either back. The test `cstack/test/no-graphify.test.ts` fails if a file under `cstack/guides/` or `cstack/skills/` names Graphify, except the one line of `settled-decisions.md` that records the decision. That decision says agents map the code with search and file reads and that no code graph tool is used.

If your work touches `manifest.ts`, `manifest.test.ts` or the README "Requirements" section, expect a small merge conflict in the command counts.

#### Comment of 2026-11-19

Ticket #20 built `cstack publish`. This is what the end-to-end run can rely on.

The command is `cstack publish [--timeout <minutes>] [--poll <seconds>] [--grace <seconds>] [--plan <file>]`. The defaults are 30, 15 and 120. The code is in `cstack/src/commands/publish.ts`, with helpers in `cstack/src/publish/`.

Exit codes: 0 when the checks passed, were skipped, or none ran. 1 when a rule refuses the publish, or when the tests fail after the branch update. 2 for a usage error. 3 for a broken plan or settings file. 4 when no logged-in client serves the remote. 5 when a push or a forge call fails. 6 when a check failed. 7 when checks still run at the timeout. 8 when the update onto the target branch conflicts, after the branch was put back as it was.

When the tests fail after an update, the update stays on the branch, and a marker file `publish-tests.json` appears in the run folder. The next run tests again before it pushes, and it deletes the marker when the tests pass. `cstack/guides/resolve-issue/publish.md` already says to fix and run again on exit code 1, and to stop on 4 and 5, so it matches. It did not need a change.

Things the end-to-end run should watch. This is the first time the command meets a real forge, and the GitLab JSON fields (`sha`, `status`, `jobs`) were only assumed. Exit 0 with "no check ran" can hide checks that a slow forge had not registered yet, so read that message with care on a repository that has a CI. The pull request must be merged with a merge commit, not a squash, because `cstack measure` reads the author date of each commit. Both this ticket and #17 add `cstack/src/test-run.ts`: the branch merged second keeps the copy of #17, deletes the other, and fixes the command counts in `README.md` and `cstack/test/manifest.test.ts`.

### Decisions already taken upstream

From the parent epic, "Epic: Skills into CLI" (https://github.com/gambitl/claude-code-stack/issues/6):

#### Open questions and decisions

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

ADRs that exist in the repository and bear on this ticket:

- ADR-SIC-B, where the run state lives: `docs/decisions/ADR-SIC-B-run-state.md`
- ADR-SIC-C, how cstack ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`
- ADR-SIC-D, the settings file and the review model: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`
- ADR-SIC-F, how cstack reaches trackers and forges: `docs/decisions/ADR-SIC-F-tracker-access.md`
- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`

Instructions from the coordinator of this run (2026-11-19), which apply to this ticket:

- This ticket runs alone: no other ticket of the epic is in progress. Milestone 2 is otherwise complete on `main`. Graphify was dropped by #45. Ticket #24 changed the rule for commands that are not built: they exit with `1` and name their ticket.
- This run delivers the code half of the ticket as one pull request: scope steps 1 to 6 and step 11, plus the first part of step 7, which raises the version in `cstack/package.json` to the next minor version, `0.2.0`, with `package-lock.json` kept in step.
- After the merge, the coordinator and the user do the rest: push the tag `v0.2.0` (the rest of step 7), install the release on the maintainer's machine (step 8), create the private test repository and run the new skill there with Claude (step 9), and fix and release again if needed (step 10). The run does none of these. It never pushes a tag, never runs `npm install -g`, never runs `cstack skills install` against the real home folder, and never creates a GitHub repository.
- The plan writes steps 7 to 10 as after-merge steps. The pull request lists them under a heading such as "After the merge", and closes with `Part of #23`, not `Fixes #23`, so that the merge does not close the ticket.
- The end-to-end test of step 6 needs no Claude and no network. It uses a temporary folder, a bare repository as `origin`, a fake `gh` on the `PATH` and a temporary home folder. It never reaches GitHub.
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). They are the reference for today's behaviour, and nothing under `skills/` is edited.
- When the branch is updated onto `main`, the author dates of its commits are kept: never `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits.
- The repository is public: no employer or client names, no work ticket keys, no counts from work retrospectives, in files, commits, the pull request, ticket comments, the plan file or the retrospective. The repository's git config sets `user.email` to the maintainer's GitHub no-reply address, and nobody changes it.
- Before the push, two checks must pass. `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. And `git log -p origin/main..HEAD`, with the drafted pull request title and body, written to a temporary file outside the repository, passes `python3 scripts/private_names.py check <that file>` with exit code 0.
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure: rerun it with `gh run rerun <run id>`.
- Nobody merges the pull request except the user. Nothing under `~/.claude/skills/` changes during the run, and Graphify is never installed.


## Dependencies

Dependencies: clear. Every blocker is closed as completed on 2026-11-19: #14, #15, #16, #17, #18, #20, #21, #22, #45 and #12. The two baseline runs of #12 are recorded, so the after-merge install of step 8 is no longer held back by them.

## Code mapping

Graphify is not used: #45 dropped it, the command is not installed, and the coordinator asked that it never be installed. The map below comes from search and file reads. The whole suite passed on `main` before the run: 56 test files, 749 tests, about 90 seconds (`npm test` in `cstack/`, 2026-11-19).

**Settings reader.** `readSettings(root)` in `cstack/src/settings.ts` (line 165) returns `{ found, values, sources }`, with each source `file` or `default`. It throws `SettingsError` for every problem, and the caller turns it into exit code 3. Today it calls `readFileSync` on `.cstack/settings.json` directly (line 168), so a link to a device such as `/dev/zero` would make it hang (comment of #14 on this ticket). It is called in two places today, which serve three commands: `cstack/src/commands/publish.ts` (line 178), and `cstack/src/unit-test-command.ts` (line 100), which serves `cstack unit red` and `cstack unit green`. `DEFAULTS` (line 56) gives the order of the seven keys: `integration`, `recordsLanguage`, `forbiddenTools`, `commitAttribution`, `testCommands`, `review`, `watchIntervalMinutes`.

**`cstack next`.** `cstack/src/commands/next.ts`. `printGuide` (line 36) writes the run line and the guide as two separate writes, so the settings block goes between them (comment of #15). The function `next` (line 75) finds the root through `locatePlan` (`cstack/src/plan/locate.ts`, line 43, which runs `git rev-parse --show-toplevel`) when a run exists. Without a run it still needs a git repository, because `readCurrentRun` calls `gitFolders` (`cstack/src/run-state.ts`, line 82). It writes state in three places: `clearCurrentRun` for `--new`, `createRun` and `writeCurrentRun` for `--plan`, and `markDone` with the header writes for `--done`. The settings must be read before all of them. Its errors go through `failWith` (`cstack/src/commands/errors.ts`), which does not know `SettingsError` yet. Tests: `cstack/test/next.test.ts` with fifteen fixture guides in `cstack/test/fixtures/next/guides`. Line 160 of that test expects `Written by: cstack 0.1.0`, so it breaks when the version moves to `0.2.0`.

**`cstack unit commit`.** `commitUnit` in `cstack/src/commands/unit-commit.ts` (line 115) writes the message file at line 141: `${unit.commitMessage}\n\nCstack-Unit: ${unit.number}\n`. The attribution lines go right after the trailer line, with no blank line, so that git still reads them as trailers and `listUnitCommits` (`cstack/src/plan/commits.ts`) still finds the unit number. The message never goes through a shell. `cstack/test/unit-commit.test.ts` checks that a message holding `$(touch pwned)` lands byte for byte. The command does not read the settings file yet. Its catch block (line 194) maps `PlanFormatError`, `RunStateError` and `PlanLocationError` to their exit codes, but not `SettingsError`.

**`cstack measure`.** `cstack/src/commands/measure.ts` calls `readMoments` in `cstack/src/measure/moments.ts`. `readMoments` refuses any plan file with a `Format:` header line (line 43), then takes the approval moment from the author date of the commit that added the plan file, and the ready moment from the first commit whose plan file says `Status: ready for review`. `MomentsError` holds a fixed sentence only, so that no path or text of a plan file leaks into the output (line 17). The command exits with 1 when the ready moment is missing, when it is less than a minute after the approval, when files are unreadable, or when no main session is found. The plan reader `readPlan` in `cstack/src/plan/read.ts` (line 520) returns `header["Approved at"]` and `header["Ready for review at"]`, each an ISO 8601 time with its offset or `not yet`. Tests: `cstack/test/measure.test.ts`, whose case at line 351 expects the refusal of a plan with a `Format:` line. The README section "Measure a run" says that such a plan is refused.

**Command list and entry point.** `COMMANDS` in `cstack/src/manifest.ts` holds fourteen built entries and nine that are not built. The nine belong to milestone 3 (tickets #25 to #30), and their files do not exist. `unbuiltRefusal` (line 352) makes them exit with 1 and name their tickets, the rule that #24 set. `HANDLERS` in `cstack/src/cli.ts` is keyed by the first word, and `dispatchSubcommand` routes the second word of `plan`, `report` and `unit`. Existing coverage in `cstack/test/cli.test.ts`: one handler per first word of a built entry (line 192), and every built entry prints its own usage line when it gets an unknown flag (line 197). `cstack/test/manifest.test.ts` (line 167) only checks that the file of a built entry exists.

**Phases and guides.** `PHASES` in `cstack/src/phases.ts` lists fifteen phases. `cstack/guides/resolve-issue/` holds exactly fifteen guides with the same names. `cstack/test/guides/planning-guides.test.ts` and `cstack/test/guides/build-guides.test.ts` check that each phase has a guide, but nothing checks that each guide belongs to a phase.

**Order of the commands in the real guides.** The ticket guide calls `cstack next --done ticket --plan <plan file>`. Each planning guide ends with `cstack next --done <phase>`, and the plan guide also calls `cstack unit order` and `cstack report check`. The executor prompt starts with `cstack next --plan <plan file>`. The build guide calls `cstack unit order --plan`, then for each unit `cstack unit red`, `cstack unit green` and `cstack unit commit` (implementer prompt), then `cstack plan status --plan` and `cstack next --done build --plan`. The phases review, independent-review, update-branch, document, briefing and after-build-questions each end with `cstack next --done <phase> --plan`. The ready guide calls `cstack next --done ready --plan`, which writes `Status: ready for review` and `Ready for review at`, then `cstack report submit done --plan`. The retro guide calls `cstack report check --plan` and `cstack next --done retro --plan`. The publish guide calls `cstack publish --plan`, `cstack report submit published --plan` and `cstack next --done publish --plan`.

**Publish and the fake forge.** `cstack publish` (`cstack/src/commands/publish.ts`) refuses before any push when a blocking question is open, when the Status is not `ready for review`, or when tracked files have uncommitted changes. It pushes once, finds or creates the pull request with `gh`, then reads `gh pr view` for the head commit and `gh pr checks` for the checks. It waits for the grace period even when the checks passed (`cstack/src/publish/checks.ts`), 120 seconds by default, so a test passes `--grace 0`. `cstack/test/helpers/publish-env.ts` already builds a bare repository with `url.<path>.insteadOf`, a hook that logs pushes, and a fake `gh`, `glab` and `ssh` written in Node (the `FAKE` constant, not exported). `cstack/test/helpers/plan-repo.ts` has `git`, `makeRepo`, `commitPlan` and `collect`.

**How tests can start cstack.** `cstack/tsconfig.json` has `noEmit`, and the sources import each other with `.js` names, so Node cannot run `cstack/src/bin.ts` directly. CI runs `npm test` before `npm run build` (`.github/workflows/ci.yml`), so `dist/` does not exist while the tests run. `cstack/test/pack.test.ts` runs `npm pack --dry-run`, which builds into the real `dist/` during the suite. The handlers in `cstack/src/cli.ts` use `process.cwd()` and `homedir()`. `cstackVersion` and the package root are found from `import.meta.url` (`cstack/src/run-state.ts` line 61, `cstack/src/cli.ts` line 40).

**Release.** `cstack/package.json` and `cstack/package-lock.json` (lines 3 and 9) say `0.1.0`. The tag `v0.1.0` exists. `.github/workflows/release.yml` runs on tags `v*` and checks that the tag matches `package.json`. No other file holds the version, apart from fixture plans, `cstack/test/next.test.ts` line 160, and the release steps of `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md` line 48, which are history.

**README.** `README.md` "Install cstack" (line 18) already says how to go back to the previous release (line 31) and where `cstack` saves backups (line 35). It says nothing about going back to the prose skill. The "Commands" section describes `cstack next` and `cstack unit commit` without the settings. The "Measure a run" section says a plan file with a `Format:` line is refused.

**Leftovers handed down to this ticket.** The comment of #22 asked to add `writing.md` and `settled-decisions.md` to `cstack/test/skills-package.test.ts` and to cover the two new prompts in `cstack/test/guides/settings-applied.test.ts`. Both are already done on `main`: the first test lists the two files (lines 58 and 59), and the second scans the whole `cstack/skills/resolve-issue/` folder. The comment of #20 says the pull request must be merged with a merge commit, because `cstack measure` reads the author date of each commit.

**Risks.** `cstack/src/commands/next.ts`, `cstack/src/manifest.ts` and `README.md` changed in almost every ticket of milestone 2. This ticket runs alone, so a conflict is unlikely. The end-to-end test starts many processes, and the suite already takes 90 seconds on a macOS runner.

## Decisions

- Graphify is not used and never installed. Where a step asks for `graphify` (mapping, impact notes of the review), use `git grep` and file reads instead. (2026-11-19, upstream: #45 and the coordinator)
- The branch `gambitl/end-to-end-release` already exists and is checked out in this worktree. Work on it and create no other branch. GitHub issues have no "in progress" state, so the ticket stays open as it is. (2026-11-19, assumption not asked)
- This pull request covers scope steps 1 to 6, step 11, and the first part of step 7: the version moves to `0.2.0` in `cstack/package.json` and `cstack/package-lock.json`. Steps 7 (push the tag `v0.2.0`), 8 (install the release on the maintainer's machine), 9 (create the private test repository and run the new skill there with Claude) and 10 (fix and release again if needed) happen after the merge, done by the coordinator and the user. (2026-11-19, the coordinator)
- Never push a tag, never run `npm install -g`, never run `cstack skills install` against the real home folder, never create a GitHub repository, and never change anything under `~/.claude/skills/`. Tests use a temporary home folder. (2026-11-19, the coordinator)
- Nothing under the top-level `skills/` folder changes, because it is frozen at the tag `prose-skills-final` (ADR-SIC-E). The guides and prompts that `cstack` ships live under `cstack/guides/` and `cstack/skills/`. (2026-11-19, the coordinator)
- Every call of `cstack next` finds the repository root with `git rev-parse --show-toplevel` from its working folder and reads `.cstack/settings.json` with `readSettings` first, before it writes any state, any current run or any header line. This holds for `--new`, `--done`, `--phase`, `--plan` and the plain call. An invalid settings file makes the call exit with `3`, print the reader's message, which names the wrong key, and print no run line and no guide. A folder outside a git repository keeps today's message and exit code. (2026-11-19, ticket scope step 1 and the user's answer)
- `cstack next` prints a settings block between the run line and the guide, each time it prints a guide, and only then. A one-line answer, such as the hand-off to the executor, has no block. The block starts with the line `Settings of this repository (.cstack/settings.json):`. Then comes one line per key, in the order of `DEFAULTS` in `cstack/src/settings.ts`, written `- <key>: <value as JSON>`, with ` (default)` at the end when the value comes from the default. A `testCommands` value that is not set prints `- testCommands: not set (default)`. When the file is missing, the first line is `Settings of this repository: there is no .cstack/settings.json, so every value is the default.`. A blank line separates the block from the guide. (2026-11-19, the user's answer)
- `readSettings` refuses a `.cstack/settings.json` that is not a regular file after following links, such as a folder, a named pipe or a device, with a `SettingsError` that says it is not a regular file. It must never block on such a path: open it without blocking, check the opened file, then read it. A missing file still means every value is the default. (2026-11-19, the user's answer, from the comment of #14)
- `readSettings` refuses a `commitAttribution` line whose key is `Cstack-Unit`, in any case, with a `SettingsError` that names the line, because that key belongs to cstack. (2026-11-19, the user's answer)
- `cstack unit commit` reads the settings before it takes the lock or stages anything. An invalid settings file exits with `3`, prints the reader's message after `cstack unit commit: `, and stages nothing. The commit message is the unit's message, a blank line, `Cstack-Unit: <n>`, then each `commitAttribution` line on its own line right after it, with no blank line, so that git reads them all as trailers. With an empty list, `Cstack-Unit: <n>` stays the last line. The message never goes through a shell. (2026-11-19, ticket scope step 2 and the comment of #18)
- `cstack measure` reads a plan file that has a `Format:` header line with `readPlan`, and takes the approval moment from `Approved at` and the ready moment from `Ready for review at`, without reading the git history. It still finds the repository root with `git rev-parse --show-toplevel`, because the session search needs it. A plan file without a `Format:` line keeps the method of #11, which reads both moments from the git history. (2026-11-19, ticket scope step 3)
- For a plan file with a `Format:` line, `cstack measure` exits with `1` and prints a fixed sentence, never a text from the plan file, in these cases: the plan reader refuses the file, `Approved at` says `not yet`, or the ready moment comes before the approval moment. A `Ready for review at` that says `not yet` is a missing moment: the command prints the token lines, says on standard error that the ready moment is missing, and exits with `1`, as it does today. The "less than a minute, so the history looks rewritten" check applies only to plan files without a `Format:` line. For a plan file with a `Format:` line, the minutes line is printed whenever the ready moment is not before the approval moment. (2026-11-19, the user's answer)
- `cstack/test/manifest-implemented.test.ts` checks the built entries and the entries that are not built. For each built entry, the file it names exists under `cstack/src/commands/`, it can be imported, it exports at least one function, and `cstack <words of the entry>` reaches that command: with an unknown flag it prints the entry's own usage line, never "unknown command" and never the usage of a command group. For each entry that is not built, `cstack <words of the entry>` exits with `1` and names every ticket of the entry. The test does not copy the cases of `cstack/test/cli.test.ts`. (2026-11-19, the user's answer)
- The end-to-end test builds `cstack/src` once, at the start, into a temporary folder with the repository's TypeScript compiler (`tsc -p tsconfig.build.json --outDir <temporary folder>/dist`). It puts links to the real `cstack/guides`, `cstack/skills` and `cstack/package.json` next to that `dist` folder, and runs each command as `node <temporary folder>/dist/bin.js <arguments>` in a child process. It never uses or writes the real `cstack/dist/`. (2026-11-19, the user's answer)
- The end-to-end test builds the environment of its child processes from scratch, not from a copy of the test process. It keeps `PATH`, with the folder of fake programs first, and sets `HOME` to a temporary home folder, a fixed `TZ` and `LANG`, `GIT_CONFIG_NOSYSTEM=1` and `GIT_ALLOW_PROTOCOL=file`, plus what the fake programs need. No `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE`, `XDG_CONFIG_HOME` or `GIT_CONFIG_GLOBAL` reaches them. The test repository has its own `user.name`, `user.email` (at `example.com`) and `commit.gpgsign=false` in its local config, because cstack runs `git commit` itself. (2026-11-19, the user's answer)
- The end-to-end test never reaches the network and never needs Claude. The small project runs its tests with `node --test`, so it needs no `npm install`. The remote is a bare repository reached through `url.<path>.insteadOf`, so the remote URL still names `github.com`, and a `pre-receive` hook in it logs every push it receives. The fake `gh` comes from `cstack/test/helpers/publish-env.ts`, which exports the code that writes the fake programs instead of having it copied. (2026-11-19, ticket scope step 6 and the user's answer)
- For each `cstack` command it runs, the end-to-end test checks that the guide or prompt it follows names that command, with the numbers and paths written back as the placeholders `<n>` and `<plan file>`. The guide is the text that the previous `cstack next` printed. The unit commands are checked against `cstack/skills/resolve-issue/agents/implementer.md`, and the report commands against the guide or the prompt that names them. Extra flags that the guides do not name are allowed only from a short list in the test, which holds `--grace 0` for `cstack publish`. Git commands and file writes, which Claude does by hand, are not checked this way. (2026-11-19, the user's answer)
- The end-to-end test calls `cstack publish --grace 0 --plan <plan file>`, because `cstack publish` waits for the grace period even when the checks passed, and the fake `gh` reports one passing check on the pushed commit. (2026-11-19, the user's answer)
- If the end-to-end test shows that a guide or a prompt under `cstack/` and a command do not fit, fix the side that is wrong, in its own commit with the test that showed it, and record it in the unit's notes and in the pull request body. If it is unclear which side is wrong, stop and report it as a decision to take. (2026-11-19, the user's answer)
- The fixtures of the end-to-end test live under `cstack/test/fixtures/e2e/`, so that `cstack/test/fixtures-public.test.ts` scans them. They hold no home path, no email outside `example.com` and no host other than `github.com`. (2026-11-19, assumption not asked)
- The version moves to `0.2.0` without a tag and without a commit made by npm, for example with `npm version 0.2.0 --no-git-tag-version` from `cstack/`. `cstack/test/next.test.ts` line 160 reads the expected version from `cstack/package.json` instead of writing it. (2026-11-19, the user's answer)
- The README gives the full way back. Installing `0.1.0` and running `cstack skills install` removes the `resolve-issue` skill, because `0.1.0` does not ship it, after saving it in `~/.claude/skill-backups/`. To get the prose skill back, run `pull-skills.sh --apply`, which copies the frozen prose skill, or move the saved prose folder back by hand, but only after moving the current `~/.claude/skills/resolve-issue` away, because `mv` into an existing folder puts the backup inside it. After either way, a later `cstack skills install` needs `--adopt resolve-issue` again. (2026-11-19, the user's answer)
- The README section "Measure a run" says how a plan file with a `Format:` line is measured, and that its approval moment is written before the executor starts, while the old method takes the first commit of the plan, made after it started. So a run of the new skill is measured over a slightly longer window, to its disadvantage. The comment left on the comparison ticket (#32) says the same. (2026-11-19, the user's answer)
- README text follows the documentation rules of this session: one idea per sentence, every sentence with a subject and a verb, sentences under about 25 words, and the reader addressed directly. (2026-11-19, the user's instructions)
- No new architecture decision record is written. The settings block applies ADR-SIC-D, and the moments of `cstack measure` apply ADR-SIC-B. The branch of `readMoments` that reads the header gets a `WHY:` comment that names ADR-SIC-B. (2026-11-19, the user's answer)
- The pull request body starts with the line "Merge this pull request with a merge commit, not a squash, because `cstack measure` reads the author dates of the plan commits." It lists steps 7 to 10 under the heading "After the merge", and it ends with `Part of #23`, never `Fixes #23`, so that the merge does not close the ticket. (2026-11-19, the coordinator and the comment of #20)
- When the branch is updated onto `main`, the author dates of its commits are kept: never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never change `user.email` in the git config. (2026-11-19, the coordinator)
- Before the push of phase 12, two checks must pass. `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. And a temporary file outside the repository, holding `git log -p origin/main..HEAD` and the drafted pull request title and body, passes `python3 scripts/private_names.py check <that file>` with exit code `0`. Never print the private list. (2026-11-19, the coordinator)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure: rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, the coordinator)
- No text written by this run names an employer or a client, quotes a work ticket key, or gives a count from work retrospectives. Never read anything under `~/comparison/`. (2026-11-19, the conventions file and the coordinator)

## Architecture

The approach is locked by the ticket and the answers of phase 4, so no blueprint was drawn, and no new decision appeared since phase 4. The settings reader gets two refusals (unit 1). `cstack next` reads the settings first and prints them through a small formatting function in a new file, `cstack/src/settings-block.ts` (unit 2). `cstack unit commit` adds the attribution lines after its trailer (unit 3). `cstack measure` gets a second way to find its two moments, chosen by the presence of a `Format:` line (unit 4). Two new tests guard the command list and the guides (units 5 and 6). The version moves to `0.2.0` (unit 7). The end-to-end test then runs the whole skill as Claude would, with the built `cstack` in child processes (unit 8), and the README describes the result (unit 9).

## Implementation units

### Unit 1: Refuse a settings file that is not a regular file, and an attribution line with the Cstack-Unit key — status: todo
- Files: `cstack/src/settings.ts`, `cstack/test/settings.test.ts`
- Failing test: in `cstack/test/settings.test.ts`, write first the case of a `.cstack/settings.json` that is a symbolic link to a folder. `readSettings` must throw a `SettingsError` that says `.cstack/settings.json` is not a regular file. Today it says "cannot be read (EISDIR)", so the case fails. Then the case of `commitAttribution: ["cstack-unit: 2"]`, and the same with `CSTACK-UNIT: 2`: a `SettingsError` that names `commitAttribution[0]` and says that the key `Cstack-Unit` belongs to cstack. Do not write a case with a named pipe or `/dev/zero` before the fix. A synchronous read of either blocks the test worker for ever, and no test timeout can stop it.
- Minimum code: in `readSettings`, open the file with `O_RDONLY | O_NONBLOCK`, check the opened file with `fstatSync`, and refuse it when it is not a regular file. Then read from that file descriptor and close it in a `finally` block. `ENOENT` at the open still returns every default with `found: false`. In the check of each `commitAttribution` line, refuse a key equal to `Cstack-Unit` in any case.
- Refactor: once the fix passes, add a case with a named pipe made by `mkfifo` in a temporary folder, which must be refused at once.
- Commit message: `fix(cli): refuse a settings file that is not a regular file and an attribution line with the Cstack-Unit key`
- Depends on: none

### Unit 2: Print the settings above each guide of cstack next, and stop on an invalid settings file — status: todo
- Files: `cstack/src/settings-block.ts`, `cstack/src/commands/next.ts`, `cstack/src/commands/errors.ts`, `cstack/test/next-settings.test.ts`
- Failing test: `cstack/test/next-settings.test.ts`, written first with the case of a `.cstack/settings.json` that holds the unknown key `reviewer`. `cstack next` must exit with `3`, name `reviewer` on standard error, print nothing on standard output, and write no current run. Use a temporary package root with the fixture guides of `cstack/test/fixtures/next/guides`, as `cstack/test/next.test.ts` does. Then: a valid file with `testCommands` and one `commitAttribution` line prints the run line, then the settings block, then the guide. The block holds every key of `DEFAULTS` in order, the values from the file without a mark, and the other values with ` (default)`. A file without `testCommands` prints `- testCommands: not set (default)`. A missing file prints the block whose first line says there is no `.cstack/settings.json`. `--done <phase>` with an invalid file exits with `3`, does not mark the phase done, and writes no header line. `--new` with an invalid file exits with `3` and does not clear the current run. A one-line answer, such as the hand-off to the executor, has no block.
- Minimum code: `cstack/src/settings-block.ts` exports `settingsBlock(settings: Settings): string`, written as "Decisions" says. In `next`, at the start of the `try` block and before any other step, find the root with `git rev-parse --show-toplevel` from `options.cwd`, run without a shell, and call `readSettings(root)`. A failure of `git rev-parse` throws the same `RunStateError` message as `gitFolders` in `cstack/src/run-state.ts`. `printGuide` takes the block and writes it between the run line and the guide, as a write of its own. `failWith` in `cstack/src/commands/errors.ts` turns a `SettingsError` into exit code `3` with its message.
- Refactor: none.
- Commit message: `feat(cli): print the settings of the repository above each guide of cstack next`
- Depends on: none

### Unit 3: Add the commit attribution lines in cstack unit commit — status: todo
- Files: `cstack/src/commands/unit-commit.ts`, `cstack/test/unit-commit.test.ts`
- Failing test: in `cstack/test/unit-commit.test.ts`, write first the case of a `.cstack/settings.json` whose `commitAttribution` holds one line, such as `Assisted-by: test agent <agent@example.com>`. The commit that `cstack unit commit` makes ends with `Cstack-Unit: <n>` followed directly by that line. `git log -1 --format=%(trailers:key=Cstack-Unit,valueonly)` still gives the unit number, and `listUnitCommits` of `cstack/src/plan/commits.ts` still finds the unit. Then: with no settings file, and with `commitAttribution: []`, `Cstack-Unit: <n>` is the last line. An invalid settings file exits with `3` and stages nothing. The existing case with `$(touch pwned)` keeps passing.
- Minimum code: in `unitCommit`, after the plan is read and before the lock, call `readSettings(located.root)`. Turn a `SettingsError` into `cstack unit commit: <message>` and exit code `3`. Pass the attribution lines to `commitUnit`, which writes them right after the `Cstack-Unit` line, each followed by a line break.
- Refactor: none.
- Commit message: `feat(cli): add the commit attribution lines of the settings after the unit trailer`
- Depends on: none

### Unit 4: Read the two moments of a version 1 plan file in cstack measure — status: todo
- Files: `cstack/src/measure/moments.ts`, `cstack/src/commands/measure.ts`, `cstack/test/measure.test.ts`
- Failing test: in `cstack/test/measure.test.ts`, write first the case of a version 1 plan file whose header holds `Approved at: 2026-03-01T10:00:00+01:00` and `Ready for review at: 2026-03-01T12:30:00+01:00`. The file sits inside a git repository but is never committed, which proves that no git history is read. Give it one main session inside that window, as the other cases do. `cstack measure` must stop refusing it, print `minutes from approval to ready for review: 150`, and exit with `0`. This replaces the case "refuses a plan with a Format line in its header, but not one after a heading" (line 351), and keeps its second half: a `Format:` line after the first heading does not count. Then: a plan file without a `Format:` line still gives its moments from the git history, so the existing cases stay. A version 1 plan file whose `Ready for review at` says `not yet` prints the token lines, says that the ready moment is missing, and exits with `1`. A version 1 plan file whose `Approved at` says `not yet`, one that the plan reader refuses, and one whose ready moment comes before its approval moment each exit with `1` and print a fixed sentence that holds no text of the plan file.
- Minimum code: in `readMoments`, when the header has a `Format:` line, read the file with `readPlan`. Turn a `PlanFormatError` into a `MomentsError` with a fixed sentence. Take both moments from the header, with `not yet` as a missing moment. Find the root with `git rev-parse --show-toplevel`. Add a field to `Moments` that says where the moments came from, the header or the history. In `measure`, apply the "less than a minute" check only to moments from the history. For moments from the header, refuse a ready moment earlier than the approval moment, and print the minutes line otherwise. Add a `WHY:` comment that names ADR-SIC-B on the header branch.
- Refactor: none.
- Commit message: `feat(cli): read the approval and ready moments from the header of a version 1 plan in cstack measure`
- Depends on: none

### Unit 5: Check that every built command is implemented and every other one names its ticket — status: todo
- Files: `cstack/test/manifest-implemented.test.ts`
- Failing test: write first a function in the test file, for example `implementationProblems(entries)`, and the case that runs it on a fixture list written in the test. The list holds a built entry `cstack frobnicate` whose file `frobnicate.ts` does not exist. The result must name `cstack frobnicate` and its missing file. Then the case on the real `COMMANDS`, which must give no problem. The checks are the ones "Decisions" gives for built entries and for entries that are not built. The routing check calls `run` of `cstack/src/cli.ts` with the fixture list as its third argument where it matters.
- Minimum code: none in `cstack/src/`. The function lives in the test file.
- Refactor: none.
- Commit message: `test(tests): check that every built command is implemented and every other one names its ticket`
- Depends on: none

### Unit 6: Check that every phase has a guide and every guide has a phase — status: todo
- Files: `cstack/test/guides/phases-have-guides.test.ts`, `cstack/test/fixtures/guides/extra-guide/ticket.md`, `cstack/test/fixtures/guides/extra-guide/deploy.md`
- Failing test: write first a function in the test file, for example `guideProblems(phaseNames, folder)`, and the case that runs it on the fixture folder with the phase list `["ticket"]`. The folder holds `ticket.md` and an extra `deploy.md` that belongs to no phase. The result must name `deploy.md`. A phase without a guide is reported too. Then the case on the real `PHASES` and `cstack/guides/resolve-issue/`, which must give no problem.
- Minimum code: none in `cstack/src/`. The function lives in the test file.
- Refactor: none.
- Commit message: `test(tests): check that every guide of resolve-issue belongs to a phase`
- Depends on: none

### Unit 7: Raise the version of cstack to 0.2.0 — status: todo
- Files: `cstack/package.json`, `cstack/package-lock.json`, `cstack/test/next.test.ts`
- No test: the unit changes the version number only. The change to `cstack/test/next.test.ts` makes line 160 read the expected version from `cstack/package.json`, so that this release and the next ones do not break it.
- Minimum code: set the version to `0.2.0` in `cstack/package.json` and in both version fields of `cstack/package-lock.json` (the top level and the `""` package), with no tag and no commit made by npm. Run `npm test` and `npm run typecheck` in `cstack/` before the commit.
- Refactor: none.
- Commit message: `chore(cli): raise the version of cstack to 0.2.0`
- Depends on: none

### Unit 8: Run the whole resolve-issue skill end to end in a scripted test — status: todo
- Files: `cstack/test/e2e/resolve-issue.test.ts`, `cstack/test/helpers/publish-env.ts`, `cstack/test/fixtures/e2e/` (the small project, the code of each unit, the plan file and the texts that the test writes into the plan)
- Failing test: this unit tests code that units 1 to 4 and the earlier tickets built, so most steps may pass at the first run. Write the whole scenario first and run it. Record in the unit's notes which steps failed at the first run and why. A step that fails because a guide or a prompt and a command do not fit is handled as "Decisions" says.
- Minimum code, the setup: the build into a temporary folder, the environment from scratch and the fake `gh`, as "Decisions" says. Export from `cstack/test/helpers/publish-env.ts` the function that writes the fake programs, and use it. The fake `gh` answers `gh pr create` with a pull request link on `github.com`, and `gh pr checks` with one passing check. Its `gh pr view` keeps giving the head of the branch in the bare repository. The small project is a git repository with a `main` branch, a `package.json`, a file `src/math.js` with two functions, and one test file per function, run with `node --test`. `main` also holds `.cstack/settings.json` with `testCommands` (`all`: `node --test`, `file`: `node --test {file}`), one `commitAttribution` line, and no `review` key. The plan file is a fixture of format `cstack-plan/1` with three units: units 1 and 2 each add a function to `src/math.js`, each with its own new test file, and unit 3 changes `README.md` and has a `No test` line. It has one blocking question with its answer. Its Status is `draft`, and the test sets it to `approved` just before `cstack next --done plan`, as the plan guide does after the user's approval.
- Minimum code, the scenario: it runs the commands in the order of the real guides and prompts, writes the code of each unit from fixture files, fills each section of the plan when the guide asks for it, and commits as the guides say. Use explicit timeouts, because Vitest gives 5 seconds per test and 10 seconds per hook by default. It checks:
  - US-6: each `cstack next` that prints a guide prints the run line, then the settings block, then exactly the text of one real guide file of `cstack/guides/resolve-issue/`, and no other guide. `cstack next --phase briefing` before the `document` phase is done exits with `1`. A copy of the plan file with `Format: cstack-plan/2` given with `--plan` exits with `3` and leaves the current run unchanged.
  - US-7: `cstack plan status --plan <plan file>` follows the unit commits and exits with `0` at the end of the build. `cstack plan section Decisions --plan <plan file>` prints the Decisions section and nothing else. `cstack report submit done --plan <plan file>` is refused before unit 3 is committed, and its message names unit 3. It is accepted after the `ready` phase.
  - US-8: `cstack unit green 1 --plan <plan file>` before `cstack unit red 1` exits with `1`. Unit 3 commits with `cstack unit commit 3` without any saved run.
  - US-9: `cstack unit order --plan <plan file>` puts units 1 and 2 in different batches. Each unit commit holds only the files of its unit, and its message ends with `Cstack-Unit: <n>` followed by the attribution line. `cstack report submit complete --plan <plan file>` exits with `1`. `cstack report check --plan <plan file>` prints the accepted done report.
  - US-10: with an unknown key added to `.cstack/settings.json`, the first `cstack next` exits with `3`, names the key and prints no guide. With the real file, the settings block shows the review agent `claude` from the default.
  - US-12: with the answer of the blocking question set back to `open` in the working tree, `cstack publish --grace 0 --plan <plan file>` exits with `1`, names the question, and the bare repository logs no push. Once the plan is restored and ready, the same command exits with `0` and the bare repository logs exactly one push. The fake `gh` receives exactly one `pr create`, whose title is the title of the plan's "Pull request" section. The commit that `gh pr view` returned before the checks were read is the pushed commit.
  - For each `cstack` command it runs, the guide or prompt it follows names that command, as "Decisions" says.
  - The temporary home folder holds no `.claude` folder at the end.
- Refactor: if `cstack/test/publish.test.ts` and the new test now share the fake programs, make sure `cstack/test/publish.test.ts` still passes unchanged.
- Commit message: `test(tests): run the whole resolve-issue skill end to end with the built cstack, a bare remote and a fake gh`
- Depends on: 1, 2, 3

### Unit 9: Explain the new behaviour and the way back in the README — status: todo
- Files: `README.md`
- No test: the unit changes documentation only.
- Minimum code: in "Install cstack", add the full way back to the prose skill, as "Decisions" says. In "Commands", say that `cstack next` prints the settings of the repository above each guide and stops with exit code `3` on an invalid settings file, and that `cstack unit commit` adds the `commitAttribution` lines after its `Cstack-Unit` line. In "Measure a run", replace the sentence that says a plan file with a `Format:` line is refused. Say how such a plan file is measured, and that its window is slightly longer than with the old method, as "Decisions" says. The command count stays fourteen.
- Refactor: none.
- Commit message: `docs: explain the settings block, the attribution lines, the new measure and the way back to the prose skill`
- Depends on: 2, 3, 4

## Documentation duties

- The README: applies, written to `README.md` by unit 9.
- The comment on this ticket (#23): applies, written to issue #23. It says what this pull request delivered, what differs from the ticket (the reading of the command list test, the two refusals added to the settings reader), and that steps 7 to 10 happen after the merge, so the ticket stays open.
- The comment on the ticket that wires the Orca features into the guides and tests them end to end (#31): applies, written to issue #31. It says where the end-to-end test lives, how it builds and runs `cstack`, and how it ties each command to its guide, so that #31 can extend it.
- The comment on the ticket that runs the new version twice on the comparison ticket (#32): applies, written to issue #32. It says how `cstack measure` reads a version 1 plan file, and that its approval moment comes earlier than with the old method, so the new skill is measured over a slightly longer window.
- An architecture decision record: does not apply. No new structural decision was taken, as "Decisions" says.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. US-6 to US-12 already describe the behaviour, and the earlier tickets did not mark their stories there.
- The guides and prompts under `cstack/`: apply only if the end-to-end test shows a mismatch, written by unit 8 in a commit of its own.

## Review log

## Briefing

## Open questions after the build

### Blocking

### Non-blocking

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-19: phase 6 started. Ticket stays open (GitHub has no in-progress state). Branch gambitl/end-to-end-release was already checked out.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

Only one point needs your answer. I will do the rest unless you say no.

**I need your answer before I plan**

**The test "every command of the list is implemented" checks only the fourteen built commands.** The acceptance criterion says "every real entry is implemented". But nine entries belong to milestone 3 (tickets #25 to #30) and have no file, so the criterion cannot pass as written. I propose this: each built command has a file that exports its function, and `cstack <words>` reaches it. Each of the nine others exits with 1 and names its ticket. This changes the wording of a criterion, so I want your yes.

**I will do this unless you say no**

- The README way back will say that installing 0.1.0 and then running `cstack skills install` removes `resolve-issue`, because 0.1.0 does not ship it. It will also say to move the current folder away before putting the backup back. Otherwise `mv` puts the backup inside it.
- `cstack measure` will not mark exactly the same moments for old and new plan files. The old approval moment is the first commit of the plan, made after the build helper has started. `Approved at` is written before that start. So the new skill is measured over a slightly longer window, to its disadvantage. I will write this in the README and in the comment for the comparison ticket (#32).
- The end-to-end test will build its environment from scratch instead of copying the current one. It will drop inherited variables such as `GIT_DIR`, because a run from a git hook would otherwise hit the real repository. It will give the test repository its own git identity. It will set `GIT_ALLOW_PROTOCOL=file`, so a wrongly routed push fails instead of reaching GitHub. It will reuse the fake `gh` of `publish-env.ts`.
- For each command it runs, the test will check that the guide or prompt it follows names that command. Without this, it proves the order I read, not that the guides and the commands fit.
- The settings block will print `testCommands: not set (default)`, because its default is `undefined`.
- The settings reader will refuse a `commitAttribution` line whose key is `Cstack-Unit`. Otherwise a commit could count for another unit.
- The other draft answers stay as written (questions 2 to 10 and 12).

**I checked it myself**

- I simulated the way back to 0.1.0 with a temporary home folder: it printed "removed resolve-issue" and moved the skill into `skill-backups`.
- Building `cstack/src` into a separate folder takes 0.35 seconds.
- The settings reader already accepts only `Key: value` lines in `commitAttribution`, so git keeps reading the unit trailer.

**Good to know**

- Merge this pull request with a merge commit, not a squash, because `cstack measure` reads the author dates of the plan commits.

#### Details

**The command list test (draft question 1).** Blocking, answered by checking. `COMMANDS` in `cstack/src/manifest.ts` holds fourteen built entries and nine entries with `built: false` (lines 204 to 285), all for tickets #25 to #30, and none of their files exists in `cstack/src/commands/`. Read word for word, "every real entry is implemented" fails on main today and stays failing until milestone 3 ends. The reading I recommend checks the built entries for a file that exports a function and for routing through `HANDLERS` in `cstack/src/cli.ts`, and checks that every unbuilt entry is refused with exit 1 and its ticket, through `unbuiltRefusal` (line 352). Part of the routing check already exists in `cstack/test/cli.test.ts` (lines 192 and 197), so the new test should add the file and export check and the unbuilt refusal, not copy those cases. It goes in the first group because it changes how an acceptance criterion is read. If nobody decides, the plan uses this reading and says so in the pull request.

**The way back in the README (scope step 11).** Non-blocking. The release `v0.1.0` ships only `cstack/skills/cstack-example` (`git ls-tree v0.1.0 -- cstack/skills`). `cstack skills install` removes every marked folder that the installed version does not ship, after a backup (`cstack/src/commands/skills.ts`, lines 186 to 195 and 234 to 235, and the same code at `v0.1.0`, line 193). I built the current code into the scratch folder and ran it with a package root that ships only `cstack-example` and a home folder whose `resolve-issue` has a `.cstack-managed` marker. It printed `removed resolve-issue, backup in .../skill-backups/<stamp>/resolve-issue` and exited with 0. So the README's general sentence "install the previous release, then run `cstack skills install`" leaves the maintainer with no `resolve-issue` skill at all when the previous release is 0.1.0. The README must give the full sequence. Install 0.1.0, run `cstack skills install`, which moves the new skill to a backup. Then run `pull-skills.sh --apply`, which finds `resolve-issue` missing and copies the frozen prose skill. Or move the prose backup back by hand, which works only when `~/.claude/skills/resolve-issue` no longer exists, because `mv` into an existing folder nests the backup inside it. `pull-skills.sh --apply` also works while the new skill is still there: it sees a different folder, moves it with its marker into a dated backup, and copies the prose skill (lines 55 to 66 and 98 to 105). After that, the prose folder has no marker, so a later `cstack skills install` needs `--adopt resolve-issue` again. If nobody acts, the README gives a way back that silently removes the skill.

**The two methods of `cstack measure` mark different moments.** Non-blocking. The method of #11 takes the approval moment from the author date of the commit that added the plan file (`cstack/src/measure/moments.ts`, lines 52 to 59). In the prose skill, that commit is the first step of the executor (`skills/resolve-issue/agents/executor.md`, line 39), after it has started and read the conventions and the plan in full. In the new skill, `Approved at` is written by `cstack next --done plan` (`cstack/src/phases.ts`, line 100), before the executor is launched. The ready moment differs the other way, but only by seconds. `Ready for review at` is written by `cstack next --done ready` (line 111), just before the commit that the old method would read. `measureSessions` counts tokens inside the same window (`cstack/src/commands/measure.ts`, line 44), so both published figures carry the difference: the executor's start and first reads fall inside the window of the new skill and outside that of the baseline. The bias is against the new skill, so a measured win stays a win. Reading both moments from the plan file is locked by US-4 AC2 of the specification and by ADR-SIC-B, so I do not propose to change the method. I recommend one sentence in the README section "Measure a run", and one paragraph in the comment that this ticket leaves on the comparison ticket (#32). If nobody does it, the comparison of #32 may read a small gap as a real difference. When the plan file has a `Format:` line, `cstack measure` still needs the repository root from `git rev-parse --show-toplevel`, because `measureSessions` uses it to find the sessions. That call does not read the history, so it does not conflict with the acceptance criterion.

**Isolation of the end-to-end test.** Non-blocking. `cstack/test/helpers/publish-env.ts` builds its child environment as `{ ...process.env, PATH: ... }` (line 115). For the end-to-end test, which runs about forty real `cstack` and `git` processes, I recommend a clean environment: `PATH` with the fakes first, `HOME` set to the temporary home folder, a fixed `TZ` and `LANG`, and nothing else from the parent. The reasons come from git. `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` are set when the suite runs from a git hook, and they would point every git call of the test at the real repository. `XDG_CONFIG_HOME` and `GIT_CONFIG_GLOBAL` would bring the user's git config back even with a temporary `HOME`. Without the user's `~/.gitconfig`, git has no identity, and `cstack unit commit` runs its own `git commit`, so the test repository needs `user.name` and `user.email` in its own config, as `publish-env.ts` does (lines 95 and 96). The `-c` flags of the `git` helper in `cstack/test/helpers/plan-repo.ts` do not reach the commits that cstack makes. `GIT_ALLOW_PROTOCOL=file` makes any push that misses the `url.<path>.insteadOf` rule fail at once, so the "no network" promise is enforced and not only intended. The fake `gh`, `glab` and `ssh` live in the `FAKE` constant of `publish-env.ts`, which is not exported. Export it, or a function that writes the fakes, rather than copying the script. The small project inside the test should run its tests with `node --test`, so it needs no `npm install` and no network.

**The test must tie each command to the text that names it.** Non-blocking. The ticket exists because "only a whole run shows that the parts fit together, for example that the guides call the commands with the right options". A scripted test that hard-codes the order proves only the order its author read. The guides and prompts name every command in backticks with fixed placeholders, such as `cstack unit green <n> --plan <plan file>` and `cstack next --done build --plan <plan file>`. So the test can keep the text that the previous `cstack next` printed, and check that the command it is about to run, with `<n>` and `<plan file>` put back as placeholders, appears in that text. The commands of a unit are named in `cstack/skills/resolve-issue/agents/implementer.md`, not in the build guide, so the test checks those against that prompt. Extra flags that the test needs and the guides do not name, such as `--grace 0` for `cstack publish`, are allowed by a short list in the test. If nobody does it, a guide that later changes a flag keeps passing this test.

**The settings block and `testCommands` (draft question 5).** Non-blocking. `DEFAULTS.testCommands` is `undefined` (`cstack/src/settings.ts`, line 61), and `JSON.stringify(undefined)` returns `undefined`, not a string. The draft format "`- <key>: <value as JSON>`" would then print the word `undefined` or nothing. The block should print `- testCommands: not set (default)`. The plan guide already warns about a missing `testCommands`, so the wording should match that warning. The rest of draft question 5 stands.

**A `Cstack-Unit` key in `commitAttribution`.** Non-blocking. The reader accepts any line of the form `Key: value` (`cstack/src/settings.ts`, the `commitAttribution` check). `listUnitCommits` reads `%(trailers:key=Cstack-Unit)` (`cstack/src/plan/commits.ts`, line 36), and git matches trailer keys without regard to case. So a settings line `cstack-unit: 2` would make every unit commit also count for unit 2. That would let `cstack next --done build` pass for a unit that has no commit. I recommend that the reader refuse that key, in any case, with a `SettingsError`, so that every command exits with 3. If nobody does it, the risk stays small but silent.

**Draft answers kept.** Draft question 2 (non-blocking): build `cstack/src` once into a temporary folder and run `node <folder>/dist/bin.js`. I checked the cost: `tsc -p tsconfig.build.json --outDir <scratch>/dist` took 0.35 seconds with the TypeScript 7 compiler of the repository. `cstack/package.json` has no runtime dependency, so the built files need no `node_modules` next to them. `packageRoot` and `cstackVersion` come from `import.meta.url`, so links to `guides`, `skills` and `package.json` in that folder are enough. Vitest's default limits are 5 seconds per test and 10 seconds per hook, so the test and its setup need explicit limits, as `cstack/test/pack.test.ts` sets 120 seconds. Draft question 3 (non-blocking): refuse anything that is not a regular file in `readSettings`, which covers `cstack publish`, `cstack unit red` and `cstack unit green` at once. A named pipe would hang in the same way as a device. Draft questions 4, 6, 7, 8, 9, 10 and 12 (non-blocking) stay as drafted. Draft question 11 is answered by the timing above: the compilation costs almost nothing, and the cost of the test comes from the processes it starts.

**Checked: attribution lines stay trailers.** `commitAttribution` items must match `^[A-Za-z0-9][A-Za-z0-9-]*: [^ \p{Cc}][^\p{Cc}]*$` (`cstack/src/settings.ts`). Lines added directly after `Cstack-Unit: <n>` therefore form a paragraph made only of trailers, and git keeps reading the unit number from it.

**Merge with a merge commit.** This plan file has no `Format:` line, so `cstack measure` reads its moments from the author dates of its commits. The comment of #20 on this ticket asks for a merge commit for that reason. The pull request body should say it on its first line, because the user clicks the button.

I checked authorization and tenant isolation, scale and performance, operations and recurring cost, and user interface edge cases, and found nothing that this ticket touches. The release tag, the install on the maintainer's machine and the run with Claude happen after the merge, as the coordinator decided, so this block does not reopen them.

### Open questions and answers

1. **Blocking, answered by checking.** The ticket asks `cstack/test/manifest-implemented.test.ts` to check that every entry of `cstack/src/manifest.ts` is implemented. Nine entries are not built, so how can "every real entry is implemented" pass? Recommended answer: the test checks the fourteen built entries. For each one, the file it names exports a function, and `cstack <words of the entry>` reaches that command instead of answering "unknown command". For each entry that is not built, the test checks that `cstack <words>` exits with 1 and names its ticket, the rule that #24 set. Checked: `COMMANDS` holds fourteen built entries and nine that are not built, all for tickets #25 to #30 of milestone 3, and none of their nine files exists in `cstack/src/commands/` (`cstack/test/manifest.test.ts` line 156 counts them). Ticket #24 made the refusal exit with 1 and name the ticket (`unbuiltRefusal`, `cstack/src/manifest.ts` line 352). **Answer (the user, 2026-11-19): approved as recommended.**
2. **Non-blocking, with a default.** How does the end-to-end test start `cstack`? Recommended answer: it builds `cstack/src` once, at the start of the test, into a temporary folder, with links to the real `guides`, `skills` and `package.json` next to it. It then runs `node <temporary folder>/dist/bin.js` as a child process for each command, with the test repository as the working folder, the temporary home folder as `HOME`, and the fake `gh` first on the `PATH`. This is what Claude runs: the real exit codes, the real standard output and error, the real `process.cwd()` and `homedir()`. It never touches the real `dist/` that `cstack/test/pack.test.ts` builds during the suite. The other way is to call `run()` of `cstack/src/cli.ts` inside the test process, changing its working folder and its environment. It is faster, but it changes global state of the test process and skips `bin.ts`.
3. **Non-blocking, with a default.** The comment of #14 says a link from `.cstack/settings.json` to a device such as `/dev/zero` makes the reader hang, and asks the first command that calls the reader to refuse anything that is not a regular file. Three commands already call it. Recommended answer: fix it once in `readSettings`. A path that is not a regular file after following links is refused with a `SettingsError`, so every command exits with 3 and names the file.
4. **Non-blocking, assumption.** What does `cstack measure` do with a version 1 plan file that is broken, or whose `Approved at` says `not yet`? Assumption: it exits with 1, the exit code that `cstack/src/manifest.ts` gives measure for a plan file it cannot use. It prints a fixed sentence and never a text from the plan file, as `MomentsError` does today. A missing approval moment, or a ready moment earlier than the approval, is refused the same way. The "less than a minute, so the history looks rewritten" check stays only for plan files without a `Format:` line, because header times are not changed by a rebase.
5. **Non-blocking, assumption.** What does the settings block look like? Assumption: a first line `Settings of this repository (.cstack/settings.json):`, then one line per key, in the order of `DEFAULTS`, written as `- <key>: <value as JSON>`, with ` (default)` at the end when the value comes from the default. When the file is missing, the first line says that the repository has no `.cstack/settings.json` and that every value is the default.
6. **Non-blocking, assumption.** Does every call of `cstack next` read the settings, including `--new`, `--done` and the calls that print only a one-line hand-off? Assumption: yes. Each call reads the settings first, before it writes any state or any header line, so an invalid file stops the call with 3 and changes nothing.
7. **Non-blocking, assumption.** When does `cstack unit commit` read the settings? Assumption: before it stages anything. An invalid file exits with 3 and stages nothing.
8. **Non-blocking, assumption.** `cstack/test/next.test.ts` line 160 expects `Written by: cstack 0.1.0`. Assumption: the version unit changes that test to read the version from `cstack/package.json`, so that the next release does not break it again.
9. **Non-blocking, with a default.** What if the end-to-end test shows that a real guide gives an order or a flag that the commands refuse? Recommended answer: fix the guide under `cstack/guides/resolve-issue/` in its own commit, with the test that showed it, and say so in the pull request. Nothing under the top-level `skills/` folder changes.
10. **Non-blocking, assumption.** `cstack publish` waits for the grace period of 120 seconds even when the checks passed. Assumption: the end-to-end test calls `cstack publish --grace 0 --plan <plan file>`, and the fake `gh` reports one passing check.
11. **Non-blocking, can wait.** The end-to-end test adds about half a minute to a suite that already takes 90 seconds on a macOS runner. Recommended answer: accept it. Nothing to do now.
12. **Non-blocking, assumption.** Where is the documentation written? Assumption: the conventions file names the `docs/` folder and `docs/decisions/` for ADRs. The README gets the changes of `cstack next`, `cstack unit commit` and `cstack measure`, and the way back to the prose skill. No new ADR is planned, because the settings block applies ADR-SIC-D and the moments of measure apply ADR-SIC-B.

**Answers to questions 2 to 12 (the user, 2026-11-19):** the user accepted every other point of the block "Questions you may not be asking" as recommended, so questions 2 to 12 keep their recommended answers, with the changes the block made: the settings block prints `testCommands: not set (default)`, the settings reader also refuses a `commitAttribution` line whose key is `Cstack-Unit`, and the end-to-end test builds its environment from scratch and checks that each command it runs is named by the guide or prompt it follows. The README gives the full way back to the prose skill, and the README and the comment on #32 say that the two methods of `cstack measure` mark slightly different moments.

### Architecture options
