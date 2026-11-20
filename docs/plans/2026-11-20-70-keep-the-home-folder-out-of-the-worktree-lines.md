# Plan: #70 — M3-14: Keep the home folder out of the Worktree lines of committed plan files

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-20
Ticket: https://github.com/gambitl/claude-code-stack/issues/70
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/worktree-home-path
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-20T09:24:32+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Plan files that `cstack` writes no longer hold the path of the maintainer's home folder, so a run in this public repository never publishes it.

- **What the title means**: When two units of a ticket run at the same time with Orca, each one works in its own copy of the repository on the maintainer's disk, called a child worktree. `cstack` then writes a line such as `- Worktree: /Users/<name>/orca/workspaces/<repo>/<folder>` under the unit in the plan file. The plan file is the record of a run in `docs/plans/`, and it is committed with the pull request. The home folder is the part `/Users/<name>`, which holds the user name of the machine.
- **Why we are doing it**: This repository is public, and its rules forbid any path from the maintainer's machine. The private-names check does not catch these paths. Version 0.3.0 makes the executor start child worktrees for every batch of two units or more. So the first ticket of this repository that runs such a batch would push the home folder path. Removing it afterwards means rewriting the history of the repository again.
- **For the user**: The maintainer can run every ticket of this repository with Orca and child worktrees, without checking each plan file by hand before the push.

**Goal.** This ticket makes `cstack` write a `Worktree` path inside the home folder as `~/<rest of the path>`, makes every reader expand it again, and adds a test that fails when a committed plan file or retrospective holds a home folder path.

### Where things are today (read first)

This ticket builds on PR #69 of ticket #31. Start it only once PR #69 is merged, because PR #69 changes `cstack measure` to read the `Worktree` lines. Ticket #31 itself stays open after that merge, for the run by hand, so it is not a native blocker of this ticket.

* **The writer**: `cstack/src/helper/start.ts` (around line 315) calls `setUnitWorktree()` of `cstack/src/plan/unit-line.ts` (line 17) with the path of the new child worktree. #28 resolves the symbolic links of that path first.
* **The plan reader**: `cstack/src/plan/read.ts` (around line 394) accepts a `- Worktree:` value only when it starts with `/`. Otherwise it reports "`- Worktree:` holds one absolute path with no control character."
* **The only reader of the path today**: `cstack/src/measure/moments.ts` (line 79) collects the `Worktree` paths of the units. `cstack/src/commands/measure.ts` (line 53) passes them to `measureSessions()`, which compares them with the `cwd` of each session file. A session file of Claude Code always writes the real absolute path. `cstack/src/unit/collect.ts` uses the helper records in `.git`, not the plan file, so it is not affected.
* **The `--home` option**: `cstack measure --home <folder>` reads the session files from a copy of the home folder, for example in the comparison runs of #32. That copy is not where the worktrees were. Expand `~` with the real home folder from `os.homedir()`, never with the value of `--home`.
* **The template**: `cstack/skills/resolve-issue/templates/plan.md` (line 56) describes the line as `- Worktree: <absolute path>`.
* **The public test**: `cstack/test/fixtures-public.test.ts` and `cstack/test/helpers/fixtures-public.ts` report a path under `/Users/` in the files of `cstack/test/fixtures/` only. Today no file of `docs/` holds a real home folder path. The only matches are sentences that name the rule, such as "a path that starts with `/Users/`".
* **The stopgap until this ships**: `CSTACK_ORCA_WORKERS=off` makes `cstack helper start` skip child worktrees, so no `Worktree` line is written.

### Scope

1. `setUnitWorktree()`, or its caller, writes a path inside the home folder as `~/` followed by the rest of the path. It compares with the home folder after resolving its symbolic links, as #28 does for the worktree path. A path outside the home folder, such as a temporary folder in a test, stays absolute.
2. `readPlan()` accepts a `- Worktree:` value that starts with `~/` or with `/`, and still refuses control characters.
3. `cstack measure` expands a leading `~/` with `os.homedir()` before it compares the path with the `cwd` of the session files. It never uses `--home` for this, and it still prints no path.
4. Update the line of the plan template, and any guide sentence that says the path is absolute.
5. Extend the public test so that it also scans `docs/plans/` and `docs/retros/`. It fails on a real home folder path, which is `/Users/` or `/home/` followed by a name and a slash. A sentence that only names `/Users/` passes.
6. The question round may choose to keep these paths out of the plan file instead, in the run folder that `cstack` keeps under `.git`. If it does, write why in `## Decisions`, and keep scope item 5.

### Acceptance (TDD)

* `cstack/test/plan-unit-line.test.ts`, or the existing test of `unit-line.ts`: write first a case where the worktree path is inside a fake home folder, and expect `- Worktree: ~/...`. See it fail on today's code, then pass. A path outside the home folder stays absolute.
* The test of `readPlan()` accepts `~/a/b` and `/a/b`, and still refuses a relative path and a control character.
* `cstack/test/measure-worktrees.test.ts`: a session whose `cwd` is inside the expanded `~/` path of a `Worktree` line is counted. The case passes `--home` with another folder and still expands `~` with the real home folder.
* `cstack/test/fixtures-public.test.ts`: write first a case with a plan text that holds `/Users/someone/orca/x`, and see it reported. The sentence "a path that starts with `/Users/`" is not reported. Every file of `docs/plans/` and `docs/retros/` on `main` passes.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: none (starts after PR #69 merges) · Feeds: none

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

The tracker lists no blocker for this ticket. Its footer says it starts once PR #69 of ticket #31 is merged. PR #69 was merged into `main` as commit 0c70a39, which this branch already holds. Ticket #31 stays open for a run by hand, so it is not a blocker.

## Code mapping

**The writer.** `cstack/src/plan/unit-line.ts` exports `setUnitWorktree(text, unit, path)`, which writes `- Worktree: <path>` as the last unit line of one unit, and `withoutWorktreeLines(text)`. Its only production caller is `cstack/src/helper/start.ts` (around line 315). That caller passes `found.path`, which `findChildWorktree()` in `cstack/src/helper/child.ts` (around line 90) has already resolved with `realpathSync`. The same `found` object also goes into the helper record under `.git` (`worktree: found`). `cstack/src/unit/collect.ts` reads that record to merge and remove the child worktree, so the record must keep the absolute path. Only the plan line changes.

**The plan reader.** `cstack/src/plan/read.ts` (around line 392) refuses a `- Worktree:` value that does not start with `/` or that holds a control character, with the rule "`- Worktree:` holds one absolute path with no control character." It stores the raw text in `unit.worktree`. Its tests are in `cstack/test/plan/worktree-line.test.ts`.

**The only reader of the path.** `cstack/src/measure/moments.ts` (line 79) collects `unit.worktree` of every unit into `worktrees`. `cstack/src/commands/measure.ts` (line 53) passes them to `measureSessions()` in `cstack/src/measure/sessions.ts`, as `planned`. `measureSessions()` resolves each planned path with `resolveLoose()` and compares it with the `cwd` of each session file. The `home` argument of `measureSessions()` is `--home` or `os.homedir()`, and it is only used to find `.claude/projects`. `cstack/test/measure-worktrees.test.ts` calls `run()` in the test process. So `os.homedir()` there reads `process.env.HOME`, and a test can set `HOME` to a temporary folder for one case with `vi.stubEnv`.

**The template and the guides.** `cstack/skills/resolve-issue/templates/plan.md` (line 56) describes the line as `- Worktree: <absolute path>`. The line sits inside an HTML comment, and `cstack/test/template.test.ts` does not check its words. No guide under `cstack/guides/` says the path is absolute. `cstack/guides/resolve-issue/build.md` line 24 only says that cstack writes the line. `README.md` line 82 says a session counts when its folder is a child worktree that a `- Worktree:` line names, which stays true, so the README needs no change.

**The public test.** `cstack/test/helpers/fixtures-public.ts` exports `findPrivateText(text)`. It reports every `/Users/` followed by any text, every email outside the reserved example domains, and every host that is not reserved. `cstack/test/fixtures-public.test.ts` runs it on every file of `cstack/test/fixtures/` and `cstack/test/e2e/`. Its first case expects a path under `/Users/` with a sample name to be reported.

**What the public test meets in the repository.** The fixtures use the placeholder home folder `/home/user/` in nine places, for example in `cstack/test/fixtures/orca/1.4.263/orchestration-worker-show.working.json`. Today they pass because only `/Users/` is checked. The committed plan of ticket #29 (`docs/plans/2026-11-19-29-launch-every-ready-ticket-of-a-milestone-with-cstack-wave.md`, lines 279 and 293) quotes `/home/user/work/example-worktrees/abc-12` from those fixtures. Many plan files name the rule with "`/Users/`" followed by a backtick, which holds no name and so passes a rule that needs a name and a slash. The copy of ticket #70 in this plan file holds `/Users/<name>/...`, which has no name. It also holds the sample path of its acceptance criteria, whose name is `someone`. No retrospective under `docs/retros/` holds `/Users/` or `/home/`.

**Tests that run cstack with a fake home folder.** The end-to-end tests set `HOME` to `<temp>/home`, but the fake `orca` creates child worktrees under `<temp>/fake/worktrees`, outside that home folder. `cstack/test/helper/worktree-line.test.ts` creates child worktrees next to a temporary repository. Both stay outside the home folder, so their `- Worktree:` lines stay absolute and their checks keep passing.

**Patterns to follow.** A command reads the home folder with `homedir()` from `node:os`, as `measure.ts` and `cli.ts` do. Symbolic links are resolved with `realpathSync` and a fallback to the given path, as in `child.ts`. Tests use `realpathSync(mkdtempSync(join(tmpdir(), ...)))` and remove their folders in `afterEach`.

**Risks.** `unit-line.ts` and `read.ts` have few dependents and no history of repeated fixes. `measure.ts` changed eight times recently, always together with `moments.ts` and `measure.test.ts`. The new public scan of `docs/plans/` also scans this plan file and the retrospective of this run, so neither may hold a home path with a real-looking name.

**Governing decisions.** ADR-SIC-B (`docs/decisions/ADR-SIC-B-run-state.md`) says the plan file keeps what people read and what must travel with the branch, and the run state under the common git folder keeps what only cstack needs. The epic rules say this repository is public, so no text holds a path from the maintainer's machine. No `WHY:` or `DECISION:` comment governs the files to change.

## Decisions

- The `- Worktree:` lines stay in the plan file, and cstack writes a path inside the home folder as `~/` followed by the rest of the path. They do not move to the run folder under `.git`, because ADR-SIC-B keeps in the plan file what travels with the branch, and `cstack measure` already reads them there. (2026-11-20, assumption not asked)
- `setUnitWorktree()` in `cstack/src/plan/unit-line.ts` takes the home folder as an argument. `cstack/src/helper/start.ts` passes `homedir()` from `node:os`. The helper record under `.git` keeps the absolute path, because `cstack unit collect` uses it to merge and remove the child worktree. (2026-11-20, assumption not asked)
- A path counts as inside the home folder when it starts with the home folder followed by `/`. The writer checks the home folder as given and its form with symbolic links resolved, with a fallback to the given form when it cannot be resolved. (2026-11-20, assumption not asked)
- A path equal to the home folder itself stays as it is, because a child worktree is always a new folder. A home folder that is empty or that is the root folder `/` never turns a path into `~/`. (2026-11-20, assumption not asked)
- `readPlan()` accepts a `- Worktree:` value that starts with `/` or with `~/`. It still refuses a relative path, `~` alone, `~name/...` and any control character. Its rule reads: "`- Worktree:` holds one path that starts with `/` or `~/`, with no control character." (2026-11-20, assumption not asked)
- `cstack measure` turns a leading `~/` of a `- Worktree:` value into the home folder from `os.homedir()` before it compares the path with the `cwd` of the session files. It never uses the value of `--home` for this, and it still prints no path. (2026-11-20, assumption not asked)
- The plan template line becomes `- Worktree: <path, with ~/ in place of the home folder>, optional, written by cstack when a unit runs in a child worktree, never by a person`. No guide says the path is absolute, and `README.md` stays unchanged. (2026-11-20, assumption not asked)
- The public test reports a home folder path, which is `/Users/` or `/home/` followed by a name. A name starts with a letter, a digit or `_`, and goes on with letters, digits, `.`, `_` or `-`. Dots at the end of a name are not part of it, so a path at the end of a sentence still counts. The path is reported whether a slash follows the name or not. A sentence that only names `/Users/`, `/Users/<name>` or `/Users/...` passes. (2026-11-20, assumption not asked, accepted by the user, relayed by the coordinator of the wave on 2026-11-20)
- The public test lets three reserved sample names pass: `user`, `someone` and `runner`. `runner` is the home folder of GitHub's macOS machines, so a path under it is public. Any other name is reported, for example `userx` or `user.name`. (2026-11-20, the user's answer, relayed by the coordinator of the wave on 2026-11-20)
- The acceptance case of the public test uses a plan text that holds a path under `/Users/` with the sample name `jane`, instead of `someone`. The existing case of `cstack/test/fixtures-public.test.ts` that expects a path under `/Users/someone` to be reported also changes to `jane`. (2026-11-20, the user's answer, relayed by the coordinator of the wave on 2026-11-20)
- The public test scans every file of `docs/plans/` and `docs/retros/` for home folder paths only, not for emails or hosts. The files of `cstack/test/fixtures/` and `cstack/test/e2e/` keep the full check of emails, hosts and home folder paths, with the same home folder rule. (2026-11-20, assumption not asked)
- In the tests, never use the real home folder of this machine. Give the code a fake home folder in a temporary folder, through a parameter or by setting `HOME` for one test only, for example with `vi.stubEnv`. (2026-11-19, from the coordinator of the wave)
- Never write a path from this machine in any file, commit or message, such as one that starts with `/Users/` followed by a real name. (2026-11-19, from the coordinator of the wave)
- In the plan file, the executor notes and the retrospective, write a sample home path only with `user`, `someone` or `runner` as the name, because the new test scans `docs/plans/` and `docs/retros/`. Describe any other case in words, without the full path. A test file under `cstack/test/` may use another sample name such as `jane`, because the test does not scan test files. (2026-11-20, the user's answer, relayed by the coordinator of the wave on 2026-11-20)
- The plan format stays `cstack-plan/1`. ADR-SIC-B asks for a decision on any format change, and this is it. A `- Worktree:` line may now start with `~/`. An older cstack that meets such a line refuses the plan with a clear plan problem, so it never misreads the file. Every plan file on `main` holds `/1`, and a second version for one optional line is not worth a reader of two formats. (2026-11-20, the user's answer, relayed by the coordinator of the wave on 2026-11-20)
- When `cstack helper start` writes a `- Worktree:` value that still starts with `/Users/` or `/home/`, it prints one warning line on standard error and keeps its exit code. This happens when `HOME` is not the folder that holds the worktree. The line does not print the path. It says that the plan file now holds a home folder path for that unit, and that you should check `HOME` before you commit the plan file. The standard output stays as it is, because the first line of the standard output is the helper id. (2026-11-20, the user's answer, relayed by the coordinator of the wave on 2026-11-20)
- This branch does not build a check in `cstack publish`. The follow-up, a check that refuses a home folder path in the diff, the plan file or the pull request text before the push, goes into the open questions of the pull request and into the retrospective. The coordinator creates that ticket after the tag `v0.3.0`. (2026-11-20, the user's answer, relayed by the coordinator of the wave on 2026-11-20)
- Do not change `CLAUDE.md`, `.cstack/settings.json`, the version in `cstack/package.json` or `cstack/package-lock.json`, or anything under the top-level `skills/` folder. Change `README.md` only if the change needs it, and then only the sentence about the `- Worktree:` line. (2026-11-19, from the coordinator of the wave)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js`. (2026-11-19, from the coordinator of the wave)
- Tests use fake programs, never the real `osascript`, `orca`, `gh` or `glab`. Run `git worktree add` only inside a temporary test repository. Never read, run or change anything under `~/comparison/`. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`, so run `npm ci` in `cstack/` before the first type check or test run. When a full `npm test` fails only in `cstack/test/report.test.ts`, run that file alone before you look for a bug. (2026-11-19, from the coordinator of the wave)
- Give each behaviour and its test to the same unit. When an earlier unit already builds what a later unit's test checks, that test passes at once, and the later unit cannot prove that its test failed first. (2026-11-19, from the coordinator of the wave)
- When a unit adds or changes a command or a skill, read `cstack/test/cli.test.ts`, `cstack/test/manifest-implemented.test.ts` and `cstack/test/skills-install.test.ts`, and put on the unit's `Files` line the files they make you change. (2026-11-19, from the coordinator of the wave)
- Copy each open non-blocking question of the question round under `## Non-blocking questions`, word for word, with who it is for. (2026-11-19, from the coordinator of the wave)
- When the coordinator sends a new message before the approval gate, write each rule or answer it gives into `## Decisions` too. (2026-11-19, from the coordinator of the wave)
- The executor never builds a unit itself, even one of a few lines. Each unit goes to an implementer, which runs `cstack unit red` and `cstack unit green`. (2026-11-19, from the coordinator of the wave)
- The executor writes each Hand-off log entry and each line of Executor notes only once. (2026-11-19, from the coordinator of the wave)
- Before `cstack unit red` has saved a failure, an implementer changes only test files and their fixtures. It writes no source code before that, and it never moves code aside to get a failure. A new module that does not exist yet is a fine first failure. (2026-11-19, from the coordinator of the wave)
- An implementer writes a test case for each behaviour, exit code and message that the unit or a line of `## Decisions` asks for. (2026-11-19, from the coordinator of the wave)
- An implementer never runs `git add`, `git commit`, `git commit --amend` or `git stash`. The stash is shared by every worktree of this repository, so another run could take the changes. (2026-11-19, from the coordinator of the wave)

## Architecture

The change is small and the approach is locked by the ticket and the answers. The plan reader accepts `~/`. A pure function in `cstack/src/plan/unit-line.ts` turns a path inside the home folder into `~/`, and `cstack helper start` passes it the result of `homedir()`. `cstack measure` turns `~/` back into a full path with `homedir()`. The public test gains one home folder rule, shared by the fixture scan and a new scan of `docs/plans/` and `docs/retros/`. No new decision since the question round.

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

### Unit 1: Read a Worktree line that starts with ~/
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/worktree-line.test.ts`
- Test: `cstack/test/plan/worktree-line.test.ts`: `readPlan()` accepts `- Worktree: ~/a/b` and returns `~/a/b` as the worktree of the unit, and still accepts `/a/b`. It refuses `a/b`, `~` alone, `~name/a` and a control character in both forms, with the rule "`- Worktree:` holds one path that starts with `/` or `~/`, with no control character."
- Minimum code: in `readUnit()` of `cstack/src/plan/read.ts`, accept a value that starts with `/` or `~/`, keep the control character check, and change the rule text to the one above.
- Refactor: none.
- Commit message: feat(cli): accept a Worktree line that starts with ~/ in the plan reader
- Depends on: none
The existing cases of this test file keep their meaning. Update their expected rule text only where they check its words.

### Unit 2: Turn a path inside the home folder into ~/
- Files: `cstack/src/plan/unit-line.ts`, `cstack/test/plan/unit-line.test.ts`, `cstack/skills/resolve-issue/templates/plan.md`
- Test: `cstack/test/plan/unit-line.test.ts`: with a fake home folder made in a temporary folder, `setUnitWorktree(text, 3, worktreeValue(path, home))` writes `- Worktree: ~/` followed by the rest of a path inside that home folder, and `readPlan()` reads it back. A path outside the home folder stays absolute. A path equal to the home folder stays as it is. A home folder that is empty or `/` never gives `~/`. A home folder given through a symbolic link still gives `~/` for a path inside its resolved form. Replacing an existing `~/` line works. `homePathWarning(2, value)` returns the one warning line for a value that starts with `/Users/` or `/home/`, and `undefined` for a `~/` value or a path under the temporary folder.
- Minimum code: export `worktreeValue(path: string, home: string): string` and `homePathWarning(unit: number, value: string): string | undefined` from `cstack/src/plan/unit-line.ts`. `worktreeValue()` compares the path with the home folder as given and with its form resolved by `realpathSync`, falling back to the given form when it cannot be resolved. `homePathWarning()` returns exactly "The Worktree line of unit <n> still starts with /Users/ or /home/, so the plan file holds a home folder path. Check HOME before you commit the plan file.\n", with the unit number in place of `<n>`. In the template, change the line to `- Worktree: <path, with ~/ in place of the home folder>, optional, written by cstack when a unit runs in a child worktree, never by a person`.
- Refactor: none.
- Commit message: feat(cli): write a Worktree path inside the home folder as ~/
- Depends on: 1
`setUnitWorktree()` keeps its signature and writes the value it gets. Its existing cases keep passing unchanged.

### Unit 3: Write the ~/ form from cstack helper start
- Files: `cstack/src/helper/start.ts`, `cstack/test/helper/worktree-line.test.ts`
- Test: `cstack/test/helper/worktree-line.test.ts`: with `HOME` set for this case only, with `vi.stubEnv`, to the resolved folder that holds both the temporary repository and its child worktrees, `cstack helper start implementer --unit 2 --plan <plan> --child-worktree` writes `- Worktree: ~/` followed by the folder name of the child worktree under unit 2. The helper record under `.git` keeps the absolute path, standard error stays empty, and the exit code is 0.
- Minimum code: in `cstack/src/helper/start.ts`, compute `const value = worktreeValue(found.path, homedir())`, pass `value` to `setUnitWorktree()`, and after a successful write print `homePathWarning(unit, value)` on standard error when it is defined. The record keeps `found`, with its absolute path. The standard output does not change.
- Refactor: none.
- Commit message: feat(cli): write the Worktree line of cstack helper start relative to the home folder
- Depends on: 2
A test cannot create a folder under `/Users/` or `/home/` without touching the machine, so the warning line itself is tested in unit 2 only. The existing cases of this file run with the real `HOME`, and their child worktrees are under the temporary folder, so they keep expecting an absolute line.

### Unit 4: Expand ~/ in cstack measure with the real home folder
- Files: `cstack/src/commands/measure.ts`, `cstack/test/measure-worktrees.test.ts`
- Test: `cstack/test/measure-worktrees.test.ts`: the plan names the child worktree as `- Worktree: ~/child`. `HOME` is set for this case only, with `vi.stubEnv`, to the temporary folder that holds the child worktree. `--home` points to another temporary folder that holds the copied session files. The session of the child worktree is counted, with the same totals as the case with an absolute line: `main sessions: 3` and `input tokens: 111`. Standard error is empty and the exit code is 0.
- Minimum code: in `cstack/src/commands/measure.ts`, before `measureSessions()`, turn each worktree path that starts with `~/` into `join(homedir(), rest)`. Never use the value of `--home` for this. Print no path.
- Refactor: none.
- Commit message: feat(cli): expand a ~/ Worktree line in cstack measure with the real home folder
- Depends on: 1
If the code used `--home` instead of `homedir()`, the child session would not be counted and the case would fail. Keep it that way.

### Unit 5: Scan the committed plans and retrospectives for home folder paths
- Files: `cstack/test/helpers/fixtures-public.ts`, `cstack/test/fixtures-public.test.ts`
- Test: `cstack/test/fixtures-public.test.ts`: `findPrivateText()` reports a plan text that holds a path under `/Users/` whose name is `jane`, followed by `/orca/x`. It also reports a `/home/` path with the name `jane`, a home folder with no slash after the name, the names `userx` and `user.name`, and a path whose name ends a sentence with a dot. It lets pass a sentence that only names `/Users/`, a path with the name `<name>`, the text `/Users/...`, and the reserved names `user`, `someone` and `runner`. The existing case that expects a path under `/Users/someone` to be reported uses the name `jane` instead. A new block checks that every file of `docs/plans/` and `docs/retros/` holds no home folder path.
- Minimum code: in `cstack/test/helpers/fixtures-public.ts`, export `findHomePaths(text)`, which applies the home folder rule of `## Decisions`, and use it in `findPrivateText()` in place of the old `/Users/` rule. In `cstack/test/fixtures-public.test.ts`, scan the files of `docs/plans/` and `docs/retros/` at the root of the repository with `findHomePaths()` only.
- Refactor: none.
- Commit message: test(tests): scan the committed plans and retrospectives for home folder paths
- Depends on: none
Write the sample paths of this test with the sample name `jane` or the reserved names only. The scan reads the plan file of this ticket too, which holds sample paths with the names `user` and `someone` only.

## Documentation duties

- The plan template line of `- Worktree:`: applies, written to `cstack/skills/resolve-issue/templates/plan.md` by unit 2.
- `README.md`: does not apply. Its sentence about the `- Worktree:` line stays true.
- The guides under `cstack/guides/`: does not apply. No guide says the path is absolute.
- An ADR: does not apply. The format decision that ADR-SIC-B asks for is recorded under `## Decisions`, and ADR-SIC-B itself stays unchanged.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. It does not describe the `- Worktree:` line.
- The ticket comment on #70: applies, written to the ticket in the document phase.
- Dependent tickets: does not apply. The ticket feeds no other ticket.

Security: no security surface, skip. The plan reader keeps refusing control characters, and the expanded path is only compared with the folders of session files, never opened for writing.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Sample names in the public scan
The new public scan reports `/Users/` or `/home/` followed by a name. But `user` and `someone` are used as sample names today: the fixtures and the committed plan of ticket #29 hold `/home/user/...`, and the copy of this ticket in its own plan file holds the sample path of its acceptance criteria, whose name is `someone`. Should the scan treat `user` and `someone` as reserved sample names that pass, like the reserved email domains, with the case that must be reported using another name such as `jane`?
- For: the user
- Answer: yes. The scan lets `user`, `someone` and `runner` pass. `runner` is the home folder of GitHub's macOS machines, so a path under it is public. The acceptance line and the existing test that use `someone` change to another sample name. The user's answer, relayed by the coordinator of the wave on 2026-11-20.

### Question 2: A leak found only after the push
The new test runs in the continuous integration after the branch is pushed, and this repository is public, so the push already publishes a leak. The retrospective, the build notes and the pull request text are written after the review, so only the continuous integration checks them. Do you accept that this ticket stays as it is, with a follow-up ticket that adds a check to `cstack publish` before the push?
- For: the user
- Answer: yes. This ticket stays as it is, with the test in the continuous integration. The follow-up, a check in `cstack publish` that refuses a home folder path in the diff, the plan file or the pull request text before the push, goes into the open questions of the pull request and into the retrospective. The coordinator creates that ticket after the tag `v0.3.0`, and this branch does not build it. The user's answer, relayed by the coordinator of the wave on 2026-11-20.

## Review log

Impact notes: `readPlan` and `unit-line.ts` are read for the Worktree line only by `cstack measure`, through `cstack/src/measure/moments.ts`. `cstack unit collect` and `helper/child.ts` use the helper record under `.git`, which keeps the absolute path, so they are unaffected. The tests of each changed file pass alone, and typecheck is clean.

Correctness reviewer: no finding. Two notes below the bar: `worktreeValue` is a separate function instead of an argument of `setUnitWorktree()`, with the same behaviour, and a relative `HOME` is unusual.

Security reviewer: no finding. The warning never prints the path. Two notes below the bar: the scan lets the three reserved names pass, and a `HOME` set to a parent such as `/Users` would keep the account name behind `~/`.

Conventions reviewer: no finding. Note below the bar: the `~/` expansion in `measure.ts` could sit next to `worktreeValue()`. Left as it is, because one caller reads it.

Simplicity reviewer: one line, the early return for an empty or `/` home folder, could go. Kept, because the plan names that case and the early return states it.

Independent reviewer: no finding, no change to the branch. The full tests and the type check pass. Three judgment calls for the pull request body. First, `cstack/src/helper/start.ts` reads the home folder with `os.homedir()`, so a test can only fake it by changing `HOME` for the process. The plan records this choice. Second, the README is unchanged, and it does not say that `cstack measure` expands a `~/` Worktree line with the home folder of the machine that runs the command, never with `--home`. One sentence there would help. Third, the template comment under `## Implementation units` of this plan still shows an absolute path for the Worktree line. It is harmless.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

- Should `cstack publish` refuse a home folder path in the diff, the plan file or the pull request text before the push? The test of this ticket runs only in the continuous integration, after the branch is public. For: the coordinator of the wave, who creates that ticket after the tag `v0.3.0`.
- Should the public scan also read the other folders of `docs/` and the README? Only the plan files and the retrospectives are written by runs, and the other pages are written by hand and reviewed. Open, not needed for this ticket. For: the maintainer.

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

- Ticket comment on #70: https://github.com/gambitl/claude-code-stack/issues/70#issuecomment-7034676629
- Dependent tickets, ADRs and pages: none apply, as "Documentation duties" says. The format decision lives under "Decisions".

## Executor notes

- The implementer of unit 4 had its first `cstack unit commit` refused because it passed a relative plan path from the wrong folder. It reran the command with the absolute path.
- In the full `npm test`, 18 tests in 8 files timed out at five seconds under load. The same folders passed alone (571 of 571).
- The full `npm test` took more than 180 seconds in the foreground, so the shell moved it to the background.

## Hand-off log

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

- 2026-11-20: moved ticket 70 to the `in progress` label on GitHub and started the build phase on the existing branch. Built units 1 to 5 with implementers, no escalation, no returned report yet.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

1. **Should the public scan let the sample names `user` and `someone` pass?** These names already sit in nine fixture files, in two committed plans (#24 and #29) and in the copy of this ticket. Without an exception, the new scan fails on `main` from day one. This changes an acceptance criterion: the case that must be reported can no longer use `someone`, and the existing test with `someone` changes too. I recommend yes, like the reserved email domains, because it is the simplest rule and needs no Markdown parsing.

2. **Do you accept that this test only catches a leak after the push?** The repository is public, so pushing the branch is enough to publish. `cstack publish` runs the tests before the push only when it has just merged `main`, or when a test failed just before. The retrospective, the notes of the build and the pull request text are written after the review, so CI checks them too late. Those are exactly the texts where Claude copies its working folder, which sits in the home folder. I recommend keeping this ticket as it is, and opening a follow-up ticket for a check before the push in `cstack publish`.

**I will do this unless you say no.**

- I keep the format version `cstack-plan/1`. ADR-SIC-B asks for a decision on any format change, so I record one: an old `cstack` refuses a `~/` line with a clear plan problem, and never misreads it. Accepted by the user, relayed by the coordinator of the wave on 2026-11-20.
- The plan, notes and retrospective of this ticket must hold no full path with a real-looking name, or our own new test fails. One sentence of the History of this plan already does, and must be rewritten. I will describe the reported case without writing the full path. Accepted by the user, relayed by the coordinator of the wave on 2026-11-20.
- `cstack` prints a one-line warning when it writes a `Worktree` line that still starts with `/Users/` or `/home/`. That happens when `HOME` differs at write time, and the fallback would otherwise be silent. Accepted by the user, relayed by the coordinator of the wave on 2026-11-20.

**I checked it myself.**

- No guide and no agent prompt reads the `Worktree` path to work in it, and `cstack unit collect` uses the record under `.git`, which keeps the absolute path.

**Good to know.**

- CI runs on macOS, where the home folder is `/Users/` followed by `runner`, so a retrospective that quotes a path from a CI log will be reported.

#### Details

**Sample names in the public scan (blocking, cannot be tested, for the user).** I agree with the draft recommendation to reserve `user` and `someone`. I rechecked the evidence with `git grep` on `origin/main`. `/home/user` appears on 40 lines of nine fixture files under `cstack/test/fixtures/orca/1.4.263/`. It also appears on five lines of two committed plans: the plan of #24 (lines 223, 625 and 659) and the plan of #29 (lines 279 and 293). The draft counted seven lines and named only the plan of #29, and the code mapping names only #29 too. The conclusion does not change. The answer changes an acceptance criterion, because the ticket asks for a first failing case built on the name `someone`. The first case of `cstack/test/fixtures-public.test.ts` also expects `/Users/someone/work` to be reported, so it must move to another name. I rejected the other way, which reserves only `user` and skips the `## Ticket` section of plan files. That way needs Markdown parsing, and retrospectives have no such section. If nobody decides, the new scan fails on `main` and on this branch.

**The scan detects a leak only after the push (blocking for the scope of this ticket, cannot be tested, for the user).** `cstack/src/commands/publish.ts` (lines 194 to 212) runs `testCommands` before the push only when `updateBranch` merged the target branch, or when a failed-test marker exists in the run folder. CI runs on `pull_request`, so after the push. In a public repository, the push itself publishes the text. Several texts are written after the tests of the review phase: the briefing, the pull request section, the documentation section, the executor notes and the retrospective. The `retro` guide (line 25) sends the run to the `publish` phase only after the retrospective is written. Once the writer uses `~/`, the main remaining source of a leak is an agent that quotes its own working folder in one of those texts, because that folder is inside the home folder. The right fix is a dedicated check in the rules that `cstack publish` checks before it pushes. I rejected two options. Running the full test suite on every publish costs about 90 seconds each time and is the wrong tool. Adding the check inside this ticket grows a size S ticket, and `cstack` also runs in private repositories, where the rule needs its own setting and its own decision. Suggested follow-up ticket title: "Refuse to push when a plan file or a retrospective holds a home folder path". If nobody decides, the scan stays a detector: it reports the leak in CI after the push, and fixing it means rewriting the history of the branch.

**The plan format version (non-blocking).** ADR-SIC-B (lines 27, 31 and 47) says that both formats carry a version, so that an old `cstack` never reads a file it does not understand, and that any format change needs a new version number and a decision. Accepting `~/` widens what a `- Worktree:` line may hold. An old `cstack` meets such a line only in a plan file that a newer `cstack` wrote. Its reader (`cstack/src/plan/read.ts`, line 394) then reports a plan problem and refuses the command, so the protection that ADR-SIC-B wants still holds. The refusal message speaks of an absolute path instead of naming the format, which is acceptable. I rejected a bump to `cstack-plan/2`, because every plan file on `main` holds `/1` and the reader would have to read both versions for one optional line. The planner should add one line to `## Decisions` that records this, so the decision that ADR-SIC-B asks for exists. I do not reopen ADR-SIC-B itself.

**The texts of this run must pass the new scan (non-blocking).** The new scan reads every file of `docs/plans/`, so it reads this plan file and the retrospective of this run. The paragraph of the History about a home folder path with no slash after the name (line 237 of this file before this block) holds a full sample path made of `/Users/` and the name `jane`. The scan will report it, so that sentence must be rewritten, for example as "`/Users/` followed by a name and nothing else". The units, the review log, the executor notes, the pull request body and the retrospective will all talk about the case that must be reported. They should describe it in that same split way. The full path may appear in `cstack/test/fixtures-public.test.ts`, because the scan does not read that file.

**A warning when the path stays absolute (non-blocking).** `os.homedir()` reads `HOME`. If `cstack helper start` runs with another `HOME` than the folder that holds the worktree, for example in a shell started by another tool, the writer keeps the absolute path, and nobody sees it. A one-line message on standard error from `cstack/src/helper/start.ts` (around line 313), printed when the written value still starts with `/Users/` or `/home/`, makes that case visible. The tests are not affected: the end-to-end tests create worktrees under the temporary folder, and on macOS that folder is under `/var/folders`. I rejected a refusal instead of a warning, because the child worktree already exists at that point, and refusing would leave it running without a record in the plan file.

**Other readers of the line, checked.** `withoutWorktreeLines()` is used only by `cstack/src/helper/child.ts` (line 36), which ignores the lines when it compares the committed plan with the plan on disk. `cstack/src/helper/start.ts` (lines 200 to 221) and `cstack/src/unit/collect.ts` read the helper record under `.git`, not the plan line. `cstack/src/wave/start-orca.ts` reads the answer of Orca. Among the guides and templates, only `cstack/guides/resolve-issue/build.md` (line 24) and the plan template mention the line, and neither tells an agent to work in that folder. The `Read` tool of an agent would not expand `~`, so this check matters.

**The CI runner (good to know).** `.github/workflows/ci.yml` runs on `macos-latest`. There the home folder is `/Users/` followed by `runner`, and the checkout lives inside it. The scan reads committed files only, so this does not affect the tests. But a retrospective that quotes a failing CI log with its full path will be reported, which is the intended behaviour.

I checked authorization, data model lock-in, scale, user experience edge cases, operations and cost, and found nothing that this ticket changes. The `~/` lines stay in committed history for good, but they are harmless and readable on any machine.

### Open questions and answers

Blocking question 1, sample names in the public scan. The user answered yes and added `runner`, relayed by the coordinator of the wave on 2026-11-20. Recommended answer: yes, reserve `user` and `someone`. I checked it: `git grep` on `origin/main` finds `/home/user` seven times in `docs/plans/` and nine times in `cstack/test/fixtures/`, and no other name after `/Users/` or `/home/`. The copy of ticket #70 in this plan file adds `someone` three times. Without an exception, the new scan fails on `main` and on this branch. The other way would reserve only `user` and skip the `## Ticket` section of a plan file, which keeps the acceptance wording but makes the scan parse Markdown.

Blocking question 2, a leak found only after the push, was raised by the review before the plan. The user answered yes, with a follow-up ticket after `v0.3.0`, relayed by the coordinator of the wave on 2026-11-20.

Non-blocking, where the paths live (scope item 6). Recommended answer: keep the `- Worktree:` lines in the plan file, written with `~/`. ADR-SIC-B keeps in the plan file what travels with the branch, and `cstack measure` already reads the lines there. Moving them under `.git` would need a new store and a second reader. Written as an assumption under `## Decisions`, and accepted by the user, relayed by the coordinator of the wave on 2026-11-20.

Non-blocking, a home folder path with no slash after the name. Recommended answer: report it too, for example a session `cwd` that is exactly the home folder of a user named `jane`, with no slash after the name. The ticket says "a name and a slash", but today the fixture check reports any text after `/Users/`, so requiring the slash would make that check weaker. A sentence that only names `/Users/` still passes, because a backtick, a `<` or a dot is not the start of a name. Written as an assumption under `## Decisions`, and accepted by the user, relayed by the coordinator of the wave on 2026-11-20.

Non-blocking, other folders of `docs/` and the README. Recommended answer: open, not needed for this ticket. Only the plan files and the retrospectives are written by runs. The other pages are written by hand and reviewed.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
