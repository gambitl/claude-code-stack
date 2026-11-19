# Plan: #15 — M2-3: Show only the next phase with cstack next

Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/15
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/next-phase
Conversation language: French
Status: in progress (phase 6)

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Claude asks `cstack` what to do next, and `cstack` answers with the instructions of that one step only, and refuses to jump ahead.

- **What the title means**: A run of the `resolve-issue` skill goes through fifteen phases, one after the other, such as reading the ticket, asking the questions or opening the pull request. Each phase has a guide, which is a short page of instructions for that phase. `cstack next` is a command of `cstack`, the command-line tool of this project. It looks at which phases are finished and prints the guide of the next one, and nothing else.
- **Why we are doing it**: Today Claude reads the instructions of every phase at the start of a run, which is several thousand words. That costs quota, and nothing stops a phase from being skipped.
- **For the user**: A solution engineer's run reads less, so it uses less of the Claude subscription. The run also cannot start a phase before the phases it depends on are done.

**Goal.** This ticket delivers `cstack next`, which keeps the state of the run and prints only the guide of the next phase (US-6 AC1 and AC2). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #9 adds `cstack guide <phase>`, which prints the guide of one phase from `cstack/guides/`. #13 adds the phase list, the plan file reader and the run state. None of them is in the repository yet.
* **How a run tracks its phases today**: `skills/resolve-issue/SKILL.md` (line 11): the skill describes all phases up front and says "Track the phases with whatever task list the harness offers". Nothing checks the order.
* **What a run loads at its start today**: `skills/resolve-issue/SKILL.md` (line 56): the skill reads the writing guide in full before its first message. Together with `SKILL.md` itself, that is about 7,200 words, as `docs/projects/skills-into-cli.md` (line 278) says.
* **The closing notice today**: `skills/resolve-issue/SKILL.md` (line 193): at the very end of a run, the skill counts the files directly in `docs/retros/`, ignoring the `reviewed/` folder. With ten or more, it shows a notice headed "Digest due". This ticket moves that count into `cstack next`.
* **Contract**: from #13. The phases are, in order, `ticket`, `dependencies`, `code-map`, `questions`, `plan`, `build`, `review`, `independent-review`, `update-branch`, `document`, `briefing`, `after-build-questions`, `ready`, `retro` and `publish`. Each depends on the one before it, except `retro`, which depends on nothing, and `publish`, which depends on `ready` and `retro`. The first five phases and `retro` run in the main conversation, and the others run in the executor. `plan` and `ready` may start only when no blocking question has `- Answer: open`. The done checks are in the phase list of `cstack/src/phases.ts`. The `ticket` done check registers the run and writes `Written by: cstack <version>`. The `plan` done check needs Status `approved` and writes `Approved at`. The `ready` done check writes Status `ready for review` and `Ready for review at`. Times are ISO 8601 with their offset. The guide of a phase is `cstack/guides/resolve-issue/<phase>.md`. The command is `cstack next [--done <phase>] [--phase <phase>] [--plan <file>] [--new]`. It exits with `1` when a dependency, a start condition or a done check fails, with `2` on a usage error, and with `3` on an invalid plan file or run state. The run folder is `<common git folder>/cstack/runs/<plan file name>/state.json`, with `phases.<name>.startedAt` and `doneAt`. The worktree's run is named in `<worktree git folder>/cstack/current-run`.

## Scope

1. Build `cstack next` in `cstack/src/commands/next.ts`, with the flags and exit codes of its entry in `cstack/src/manifest.ts`.
2. Find the run in this order. With `--plan <file>`, use the run of that plan file: create its folder when it does not exist, and point the worktree's `current-run` at it. Without `--plan`, use the run named in `current-run`. When there is no run, the next phase is `ticket`, and cstack prints its guide without recording anything.
3. Without `--done` or `--phase`, pick the next phase. It is the first phase in the list that is not done and whose dependencies are done. Print one line that names the run and the phase, such as `Run: docs/plans/2026-11-17-42-add-export.md. Phase 6 of 15: build.`, then the guide, exactly as `cstack guide` prints it. Record `startedAt` for that phase. #23 later adds the settings of the repository between the run line and the guide.
4. With `--done <phase>`, refuse when a dependency or the start condition of that phase is not met, and name each missing part. Then run its done check. When the check passes, write the header lines that the phase list names, and mark the phase done.
   - Change only the value of the header lines that the phase list names. Leave every other byte of the plan file as it was.
   - When the next phase runs in the same place, print its guide as in step 3.
   - When the next phase runs in the other place, print one line instead of the guide. For example, after `plan`, print "The next phase, build, runs in the executor. Launch the executor with the plan file path." After `ready`, print "The next phase, retro, runs in the main conversation. Submit your report now."
5. With `--phase <phase>`, refuse when a dependency or the start condition is not met. Otherwise print the guide of that phase and record `startedAt`. The main conversation uses this to reach `retro` after a stop.
6. With `--new`, clear the worktree's `current-run` and print the `ticket` guide. Keep the folders of earlier runs.
7. When cstack creates a run for a plan file whose `Approved at` is already set, mark the five planning phases done, as the run state of #13 says.
8. Read the plan file with the reader of #13 each time. When the reader refuses the file, exit with `3` and print its message, including the message about an unknown format version.
9. After `--done retro`, say what comes next. When `ready` is done, say that `publish` runs in the executor. Otherwise, say that the run stopped and that `cstack next` resumes it later.
10. After `--done retro`, also count the files that sit directly in `docs/retros/`, ignoring every subfolder. When there are ten or more, print a blank line, the heading "Digest due", and two sentences. The sentences say how many retrospectives are waiting and that the user should run `digest-retros` in a fresh session, as `skills/resolve-issue/SKILL.md` (line 193) says today.
11. After `--done publish`, print "The run is finished." and tell the executor to submit its `published` report.
12. Reuse the guide lookup of `cstack guide` from #9, so that `cstack next` prints exactly what `cstack guide <phase>` prints. Give that lookup an input for the guides folder, so that the tests can use a fixture folder with one short guide per phase. The real guides arrive with #21 and #22.

## Acceptance (TDD)

* `cstack/test/next.test.ts`: write first the case of a run where `document` is not done, and call `cstack next --phase briefing`. It must exit with `1`, and the message must name `document` (US-6 AC2). `cstack next --done briefing` must do the same.
* `cstack/test/next.test.ts`: in a fresh worktree, `cstack next` prints the run line and the fixture guide of `ticket`, and nothing of any other guide (US-6 AC1). Each fixture guide holds its own marker word, and the test checks that exactly one marker appears in the output.
* `cstack/test/next.test.ts`: `cstack next --done ticket --plan docs/plans/x.md` creates the run folder under the common git folder. It writes the installed cstack version on the `Written by` line, and it prints only the `dependencies` guide.
* `cstack/test/next.test.ts`: `cstack next --done plan` exits with `1` and names the question when a blocking question has `- Answer: open`. It also exits with `1` when the Status is not `approved`. When everything is in order, it writes `Approved at` with an offset, and it prints the one line about the executor and no guide text.
* `cstack/test/next.test.ts`: `cstack next --done ready` writes the Status and `Ready for review at`. Every other line of the plan file stays the same, byte for byte.
* `cstack/test/next.test.ts`: a linked worktree joins the run with `--plan` and marks `build` done. The main worktree then sees `build` as done.
* `cstack/test/next.test.ts`: `cstack next --phase deploy` exits with `2` and lists the phase names. `cstack next --done ticket` without `--plan` exits with `2`.
* `cstack/test/next.test.ts`: a plan file with `Format: cstack-plan/2` makes `cstack next` exit with `3`. The message names the cstack version that can read the file.
* `cstack/test/next.test.ts`: with ten files directly in `docs/retros/` and three in `docs/retros/reviewed/`, `cstack next --done retro` prints the "Digest due" notice. With nine files, it prints no notice.
* `cstack/test/next.test.ts`: a new run for a plan file whose `Approved at` is set prints the `build` guide at once.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* `cstack next --plan` refuses, with exit code `2`, a path outside the repository, such as `../other/plan.md` or an absolute path elsewhere. After a whole test run, `git status` shows no change except the header lines of the plan file, so cstack writes nowhere else in the working tree.

**Size: S** · Blocked by: #13, #9 · Feeds: #23


### Ticket comments

**Comment of 2026-11-18T08:30:55Z** (https://github.com/gambitl/claude-code-stack/issues/15#issuecomment-6973263543)

The work of ticket #9 gives you what you need to ship the command that shows only the next phase. Here is what to build on.

Where things go: a skill goes in `cstack/skills/<skill name>/`, with a `SKILL.md`, a `.claude-plugin/plugin.json` that names the plugin, and its prompts in `agents/`. A guide goes in `cstack/guides/<skill name>/<phase>.md`. `cstack/package.json` lists `dist`, `skills` and `guides` under `files`, so a new folder is packed without any change. The example `cstack-example` skill and `hello.md` guide show the shape.

How to check it: `cstack/test/pack.test.ts` runs `npm pack --dry-run --json` and expects a list of paths. Add the paths of your files to that list. `cstack guide <phase>` uses `resolve-issue` when `--skill` is not given, so the phase guides of `resolve-issue` belong in `cstack/guides/resolve-issue/`.

Things that constrain you: do not put a `.gitignore` or an `.npmrc` inside `cstack/skills/` or `cstack/guides/`, because npm never packs them, and it also drops files that a nested `.gitignore` lists. `cstack skills install` replaces only folders that hold `.cstack-managed`, and moves the old folder to `~/.claude/skill-backups/` first. The package is named `@gambitl/cstack` and is never published on the npm registry. Names of skills and phases must match `^[a-z0-9][a-z0-9-]*$`. Do not run `cstack skills install` on the maintainer's real home folder before the baseline runs of #12 are done.
Your command can read the guides the same way `cstack guide` does: from `<packageRoot>/guides/<skill>/<phase>.md`, with the `packageRoot` passed in an options object, as ADR-SIC-H describes.
The decision record is `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.


**Comment of 2026-11-18T09:23:14Z** (https://github.com/gambitl/claude-code-stack/issues/15#issuecomment-6974360311)

Ticket #13 built what `cstack next` needs. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

Use `cstack/src/phases.ts`. It holds the fifteen phases in order, each with its place, its dependencies, an optional start check and an optional done check. A check is a pure function over a context (the parsed plan, the commits of each unit, the done time of each phase, and the time of the last accepted done report). It returns the list of missing parts, which is empty when it passes. A phase also says what cstack must write when it is done, as data: `ticket` writes `Written by`, `plan` writes `Approved at`, and `ready` writes Status `ready for review` and `Ready for review at`. You perform those writes. `PLANNING_PHASES` names the five planning phases.

Use `cstack/src/run-state.ts` to create and read a run. `createRun` marks the five planning phases done when the plan has `Approved at`, and it keeps a run that already exists. It does not read the plan file, so you pass the plan path from the repository root and the parsed plan. Only `cstack next` writes `state.json`.

Two rules to keep. `retro` can be marked done again, and each time its done time is overwritten. The `publish` start condition needs the done time of `retro` to be later than the last accepted done report. To mark an entry of `cstack/src/manifest.ts` as built, set `built: true`, add its handler to the `HANDLERS` record in `cstack/src/cli.ts`, and a test will check that both agree.


**Comment of 2026-11-18T12:33:20Z** (https://github.com/gambitl/claude-code-stack/issues/15#issuecomment-6978675522)

The pull request of the ticket that reads the plan and checks the reports (#16) adds code you can reuse for `cstack next`. It is in `cstack/src/report/reports.ts`.

`lastAcceptedDoneReportAt(where)` returns the time of the latest saved `done` report, or nothing. Use it to fill the field of the same name in `PhaseContext`. `where` is `{ root, planFile }`, and `planFile` is the path from the repository root, as `locatePlan` returns it in `relative`.

A saved report lives in the run folder at `reports/<time>-<kind>.json`, with the time in UTC and `:` replaced by `-`. The file holds `kind`, `text` and `time`, and `readAt` appears once `cstack report check` has shown it.

`cstack/src/phases.ts` now exports `ticketCopied`, `noOpenQuestion` and `buildDone`. The done check calls them, so a change there changes both the phase and the report.


### Decisions already taken upstream

From the parent epic, "Epic: Skills into CLI" (https://github.com/gambitl/claude-code-stack/issues/6). Its block is copied word for word, with its heading moved down two levels.

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
- ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.






ADRs that govern this ticket:

- ADR-SIC-B, where the run state lives and how its formats are versioned: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how cstack ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-E, the new role of the repository (the prose skills under `skills/` are frozen at the tag `prose-skills-final`): `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.
- ADR-SIC-H, how a cstack command starts and ends (named by the first ticket comment): `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.

Rules from the brief of this wave (ticket #15 runs at the same time as #17, #19, #20 and #24):

- Every ticket of the wave touches `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/src/cli.ts`, and may touch `README.md` and `docs/projects/skills-into-cli.md`. Changes to those files stay small and in their own place.
- A helper that reads or writes a file of the run folder goes in a new file of this ticket, not in `cstack/src/run-state.ts`.
- When another ticket of the wave merged first, `origin/main` comes in with a merge commit, the counts of built and not-built commands in `cstack/test/manifest.test.ts` and `README.md` are updated, and the whole suite runs again. Watch for a function that git keeps twice without a conflict marker.
- Nothing under `skills/` is edited. New skill files go under `cstack/skills/` and `cstack/guides/`.
- Author dates of commits are kept on every update: never `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never push a tag that starts with `v`.
- Never run `cstack skills install` against the real home folder, never change `~/.claude/skills/`, never install Graphify. Tests use a temporary home folder.

## Dependencies

Dependencies: clear. The two blockers are closed as completed: #13 (M2-1, the plan file format, the phase order and the command list) and #9 (M1-3, the release and `cstack guide`). #16 (M2-4), named in a ticket comment, is also closed.

## Code mapping

Graphify is not installed on this machine, and the brief of this wave forbids installing it, so the mapping comes from file reads and `grep`. Ticket #45 removes Graphify from cstack, so this ticket neither builds on `cstack graph ensure` nor removes it. The code is small (about 3,300 lines in `cstack/src/`).

**Entry points and patterns.**

- `cstack/src/cli.ts` (lines 43 to 59): `HANDLERS` maps the first word of a built command to its call. `run` answers "not built in this version yet" with exit `2` for an entry of the manifest that is not built (line 69). `cstack/test/cli.test.ts` (lines 102 to 108) uses `next` as its example of a command that is not built, so that test must switch to a command that stays unbuilt, such as `graph`.
- `cstack/src/manifest.ts` (lines 84 to 91): the entry of `cstack next` already exists, with flags `--done`, `--phase`, `--new`, `--plan`, exit codes `0`, `1`, `2`, `3`, file `next.ts`, and `built: false`. `cstack/test/manifest.test.ts` (lines 116 to 118) counts ten built and five not built. `README.md` (line 40) says "cstack has ten commands" and lists one bullet per built command.
- Every command has the shape `name(args, io, options)` returning an exit code, parses with `node:util` `parseArgs` in strict mode, prints through `io`, and maps known errors with `failWith` from `cstack/src/commands/errors.ts` (PlanLocationError gives `2` or `3`, PlanFormatError and RunStateError give `3`). No `process.exit()` (ADR-SIC-H).
- `cstack/src/commands/guide.ts` (lines 23 to 62): reads `<packageRoot>/guides/<skill>/<phase>.md` and prints it unchanged. Unknown skill or phase gives exit `1`, bad names exit `2`. `packageRoot` already comes in an options object, so a test can point it at a fixture folder. Only this ticket changes this file in the wave.
- `cstack/src/phases.ts`: `PHASES` (lines 95 to 115) holds the fifteen phases in order, each with `runsIn`, `dependsOn`, an optional `start` check, an optional `done` check and `writes`. `writes` is data: `ticket` writes `Written by`, `plan` writes `Approved at`, and `ready` writes `Status: ready for review` and `Ready for review at`. The comment on line 42 says "#15 performs the writes". `PhaseContext` (lines 22 to 29) needs the parsed plan, the unit commits, `doneAt` per phase and `lastAcceptedDoneReportAt`. `publishStart` (lines 76 to 82) needs the done time of `retro` to be later than the last accepted done report.
- `cstack/src/run-state.ts`: `createRun(cwd, planFile, plan)` (lines 159 to 170) keeps an existing run, and otherwise marks the five planning phases done at `Approved at`. `readState`, `writeState`, `writeCurrentRun`, `readCurrentRun` (it returns the plan file name, not its path), `currentRunPath`, `runFolder`, `gitFolders` and `writeFileAtomic` are exported. `cstackVersion()` (line 61) is private.
- `cstack/src/plan/locate.ts` `locatePlan(cwd, planFlag)`: `--plan` wins, otherwise the current run's `state.json` gives the path. A path outside the repository exits `2` with `--plan` and `3` otherwise. A missing file exits `3`. No current run exits `2`.
- `cstack/src/plan/read.ts` `readPlan(text)`: throws PlanFormatError (exit `3`) on any problem, including an unknown `Format` (the message names the cstack version from `Written by`). The header values `Approved at` and `Ready for review at` must match `YYYY-MM-DDTHH:MM:SS±HH:MM` (line 244), so a `Z` time is refused. A header placeholder such as `<link>` is refused, so the plan file must have a filled header before `--done ticket`.
- `cstack/src/plan/commits.ts` `listUnitCommits(root, targetBranch)`: throws when the target branch does not exist locally. Only the `build` done check needs it.
- `cstack/src/report/reports.ts` `lastAcceptedDoneReportAt({ root, planFile })` (lines 204 to 210): the time of the latest saved done report.
- Tests: `cstack/test/helpers/plan-repo.ts` gives `makeRepo`, `commitPlan`, `commitFiles`, `git` and `collect`. `cstack/test/run-state.test.ts` (lines 26 to 40) shows how to build a main worktree and a linked worktree. Plan fixtures are in `cstack/test/fixtures/plans/` (`approved.md`, `ready-for-review.md`, `format-2.md`, `full.md`).

**What the guides of #21 and #22 already expect.** The real guides are already in `cstack/guides/resolve-issue/`, and the short skill is in `cstack/skills/resolve-issue/SKILL.md`. They call `cstack next --done <phase>` with and without `--plan`, `cstack next --phase retro` after a stop (`plan.md` lines 56 and 58, `questions.md` line 68, `dependencies.md` line 19), and `cstack next --new` when the run line names another ticket (`SKILL.md` line 20). The executor prompt (`cstack/skills/resolve-issue/agents/executor.md` line 26) repeats `--done` "until cstack says that the next phase runs in the main conversation". The `retro` guide (line 25) expects `--done retro` to say when `publish` comes next, and line 21 expects a possible "Digest due" notice. The guides also say that `cstack next` prints the settings above the guide; that part belongs to #23.

**Risks.**

- A retrospective marked done at an earlier stop stays done. After the executor's `--done ready`, no done report exists yet, so `publishStart` passes, and the next phase would be `publish`, in the executor. The executor would print the publish guide instead of stopping for the main conversation. See the first question below.
- Five tickets of the wave change `manifest.ts`, `cli.ts`, `manifest.test.ts` and `README.md`. Conflicts are certain on the counts. Wave 4 had a merge that silently kept a function twice in `cli.ts`.
- The plan file is written by cstack. Only the value of the named header lines may change, byte for byte, including Windows line endings, which the reader accepts.

**Governing decisions in the code.** `run-state.ts` line 1 and `read.ts` line 201 point to ADR-SIC-B. `report-submit.ts` line 1 says the report text is external input. `errors.ts` line 1 says the plan and report commands end the same way on an unusable plan or run.

## Decisions

**Choosing the next phase and checking a start**

- `retro` counts as done only when its done time is later than the done time of `ready`, once `ready` is done. Before `ready` is done, a done time on `retro` counts as usual. This rule applies when cstack picks the next phase, when it checks the dependencies of `publish`, and when it words the message after `--done retro`. Compare the times with `Date.parse`, never as strings. The start check `publishStart` in `cstack/src/phases.ts` does not change. (2026-11-19, the user's answer.)
- The next phase is the first phase of `PHASES` that is not done, by the rule above, and whose dependencies are all done. (2026-11-19, ticket scope step 3.)
- Every time cstack starts a phase, it checks the dependencies and the start condition of that phase first. This covers a plain `cstack next`, `--phase`, and the guide printed after a successful `--done`. When a check fails, cstack prints no guide and records no `startedAt`. It names each missing part on standard error and exits with `1`. (2026-11-19, accepted by default.)
- A missing dependency is named as "The phase <name> is not done.". A `retro` that was done before `ready` is named as "The phase retro was done before ready. Run cstack next --phase retro to do it again.". (2026-11-19, assumption not asked.)
- After a successful `--done`, when the next phase cannot start, the done mark stays. Standard output first says "<phase> is done.", and standard error then says why the next phase cannot start. The exit code is `1`. (2026-11-19, accepted by default.)

**The run line and the place of a phase**

- Before each guide, cstack prints one run line that names the plan file, the number of the phase and its place: `Run: docs/plans/2026-11-17-42-add-export.md. Phase 6 of 15: build, in the executor.`. The place is `in the main conversation` or `in the executor`, taken from `runsIn` in `cstack/src/phases.ts`. The number is the position in `PHASES`, and 15 is `PHASES.length`. (2026-11-19, the user's answer.)
- When there is no run, the run line reads `Run: none yet. Phase 1 of 15: ticket, in the main conversation.`. (2026-11-19, assumption not asked.)
- #23 will later print the settings between the run line and the guide, so print the run line and the guide as two separate writes. (2026-11-19, ticket scope step 3.)
- `cstack/skills/resolve-issue/SKILL.md` gets one sentence: when the run line says that the phase runs in the executor, do not follow that guide, but print the `plan` guide with `cstack guide plan` and launch the executor as its part "Hand off to the executor" says. (2026-11-19, the user's answer.)
- `cstack/skills/resolve-issue/agents/executor.md` gets one sentence: when the run line says that the phase runs in the main conversation, do not follow that guide, and submit a failed report that names that phase, because the main conversation must do it first. (2026-11-19, the user's answer.)
- The two prose sentences must keep `cstack/test/skill-size.test.ts` and `cstack/test/prompts.test.ts` green. The short skill and the first guide hold about 1,306 words today, and the limit is under 1,451. (2026-11-19, checked by counting the words.)

**Finding the run**

- With `--plan <file>`, cstack finds the plan file with `locatePlan` from `cstack/src/plan/locate.ts`, reads it with `readPlan`, creates the run with `createRun` when it does not exist, and points the worktree's `current-run` at it with `writeCurrentRun`. A path outside the repository exits with `2`, as `locatePlan` already does. (2026-11-19, ticket scope step 2.)
- Without `--plan`, cstack uses the run named in `current-run`, through `locatePlan`. When there is no `current-run`, a plain `cstack next` prints the run line for no run and the `ticket` guide, and records nothing. (2026-11-19, ticket scope step 2.)
- `--done` and `--phase` need a run, from `--plan` or from `current-run`. Without one, cstack prints the message of `locatePlan` and exits with `2`. `--done ticket` always needs `--plan`, even when a current run exists, and exits with `2` without it. (2026-11-19, assumption not asked.)
- cstack reads the plan file with `readPlan` on every call. When the reader refuses the file, cstack prints its message through `failWith` from `cstack/src/commands/errors.ts` and exits with `3`. That includes the message about an unknown `Format`, which names the cstack version that can read the file. (2026-11-19, ticket scope step 8.)
- `--done` together with `--phase` is a usage error with exit `2`. `--new` together with any other flag is a usage error with exit `2`. A phase name that is not one of the fifteen exits with `2` and lists the fifteen names in order. (2026-11-19, assumption not asked.)
- `--new` deletes the worktree's `current-run` file, keeps every run folder, prints the run line for no run and the `ticket` guide, and records nothing. (2026-11-19, ticket scope step 6.)
- When cstack creates a run for a plan file whose `Approved at` is set, `createRun` already marks the five planning phases done. A plain `cstack next --plan` on such a plan then prints the `build` guide. (2026-11-19, ticket scope step 7.)

**Closing a phase with `--done`**

- `--done <phase>` first checks the dependencies and the start condition of that phase, and refuses with exit `1` when one fails, naming each missing part. Only then does it run the done check of the phase, which also refuses with exit `1` and names each missing part. (2026-11-19, ticket scope step 4.)
- On a phase that is already done, `--done` runs no check and writes nothing, except for `retro`. It prints "<phase> is already done." and then the next phase as usual, with exit `0`. `retro` is checked and marked done again each time, with a new done time. (2026-11-19, accepted by default; the rule for `retro` is #13's.)
- When the done check passes, cstack first writes the header lines that the `writes` list of the phase names into the plan file, and only then marks the phase done in `state.json`. (2026-11-19, accepted by default.)
- The `writes` list is data. `Written by` gets `cstack <version>`, with the version read from `cstack/package.json` through `import.meta.url`, never from the `packageRoot` option. An entry of the form `Key: value`, such as `Status: ready for review`, gets that value. Any other entry, such as `Approved at` or `Ready for review at`, gets the current local time. (2026-11-19, ticket contract and assumption not asked.)
- cstack changes only the value of the header lines it writes. Every other byte of the plan file stays the same, including Windows line endings, comments and the text after the header. cstack never commits; the guides commit the plan file. (2026-11-19, ticket scope step 4 and checked in `cstack/guides/resolve-issue/ready.md` line 16.)
- After `--done`, when the next phase runs in the same place as the phase just closed, cstack prints the run line and the guide of the next phase, and records its `startedAt`. It prints no other line. (2026-11-19, ticket scope step 4 and acceptance.)
- After `--done`, when the next phase runs in the other place, cstack prints one line and no run line. Toward the executor, the line is "The next phase, <name>, runs in the executor. Launch the executor with the plan file path.". Toward the main conversation, the line is "The next phase, <name>, runs in the main conversation. Finish this guide, then submit your report.". (2026-11-19, ticket scope step 4, with the wording accepted by default.)
- After `--done retro`, when `ready` is done, the next phase is `publish` and the line toward the executor above applies. When `ready` is not done, cstack prints "The run stopped. Run cstack next later to resume it." (2026-11-19, ticket scope step 9.)
- After `--done retro`, cstack also counts the `.md` files that sit directly in `docs/retros/` of the repository root, ignoring every subfolder and every other file. With ten or more, it prints a blank line, the heading `## Digest due`, and two sentences: "<n> retrospectives are waiting in docs/retros/." and "Run the digest-retros skill in a fresh session.". The notice comes last. A missing `docs/retros/` folder counts as zero. (2026-11-19, ticket scope step 10 and accepted by default.)
- After `--done publish`, cstack prints "The run is finished. Submit your published report with cstack report submit published." (2026-11-19, ticket scope step 11.)
- A plain `cstack next` on a run where every phase is done prints the run line without a phase, "Run: <plan file>. The run is finished.", with exit `0`. (2026-11-19, assumption not asked.)

**Times and records**

- The plan header gets the local time with its offset, to the second, such as `2026-11-19T10:04:05+01:00`, because `readPlan` refuses a `Z` time and a fraction. `getTimezoneOffset()` returns minutes behind UTC, so its sign is the opposite of the offset to write. (2026-11-19, accepted by default.)
- `state.json` gets `toISOString()` times, which are UTC with milliseconds, like the saved reports. (2026-11-19, accepted by default.)
- The command takes its clock from an optional `now` in its options object, so tests can fix the time. The time helper takes an optional offset in minutes, so tests can check a negative offset and a half-hour offset without changing the time zone of the process. (2026-11-19, accepted by default.)
- Printing a guide always records a new `startedAt` for that phase. A phase marked done without a printed guide gets no `startedAt`. `--phase` on a phase that is already done prints its guide, records `startedAt`, and keeps its done time. (2026-11-19, assumption not asked.)
- The unit commits and the time of the last accepted done report are read only when a check needs them, so a missing local target branch only matters for the `build` done check. (2026-11-19, assumption not asked.)

**Code layout and the shared files of the wave**

- The guide lookup moves out of `guide()` into an exported function of `cstack/src/commands/guide.ts`, which both `cstack guide` and `cstack next` call. Its input is the `packageRoot`, and it reads `<packageRoot>/guides/<skill>/<phase>.md`. `cstack guide` prints exactly what it printed before. (2026-11-19, ticket scope step 12 and the first ticket comment.)
- Every helper that reads or writes a file of the run folder goes in a new file of this ticket, never in `cstack/src/run-state.ts`. The helpers of this ticket use the exported functions of `run-state.ts` as they are. (2026-11-19, rule of the wave.)
- `cstack next` follows ADR-SIC-H: it prints through `io`, returns its exit code, takes `cwd`, `packageRoot` and `now` in an options object, and never calls `process.exit()`. (2026-11-19, upstream decision.)
- The changes to `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts` and `README.md` stay small and in their own place, because four other tickets of the wave change the same files. In the manifest, only `built: true` is added to the entry of `cstack next`. In `cli.ts`, only one import and one line in `HANDLERS` are added. (2026-11-19, rule of the wave.)
- `cstack/test/cli.test.ts` uses `next` as its example of a command that is not built. Make that test take the first entry of `COMMANDS` that is not built, instead of naming a command, and skip it when every entry is built. Every other unbuilt command is being built or removed in this wave: #17 builds `unit red` and `unit green`, #20 builds `publish`, and #45 removes `graph ensure`. (2026-11-19, assumption not asked, after the coordinator's notice that #19 is closed.)
- Keep today's rule for an unbuilt command in this branch: it exits with `2`. Ticket #24 may change that rule, so that an unbuilt command exits with `1` and names its ticket. If #24 merges before this branch, take its rule when you update the branch, and keep the test that picks the first unbuilt entry of `COMMANDS`. (2026-11-19, coordinator's notice.)
- With this ticket alone, the manifest holds eleven built commands and four that are not built, and `README.md` says "`cstack` has eleven commands". When another ticket of the wave merges first, recount after the merge. (2026-11-19, rule of the wave.)
- The tests use temporary git repositories and a fixture `packageRoot` at `cstack/test/fixtures/next/`, with one short guide per phase in `guides/resolve-issue/<phase>.md`. Each fixture guide holds its own marker word, such as `marker-build`. No test touches the real home folder, `~/.claude/skills/` or the real guides. (2026-11-19, ticket scope step 12 and rule of the wave.)
- Nothing under the top-level `skills/` folder changes. (2026-11-19, ADR-SIC-E.)

**Commits, pushes and the public repository**

- Never change `user.email` in the git config of this repository, and never commit with another address. It is the maintainer's GitHub no-reply address. (2026-11-19, rule of the wave.)
- Never write the name of an employer or a client, a work ticket key, or a count taken from work retrospectives, in files, commits, the pull request or ticket comments. (2026-11-19, conventions file.)
- Before every push, run two checks and push only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the pull request title and body into a temporary file outside the repository, and run `python3 scripts/private_names.py check <that file>`. It must exit with `0`. It never prints a name, and you never print its private list. (2026-11-19, rule of the wave.)
- When the `cstack` check of the pull request is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, rule of the wave.)
- Never merge the pull request. The user merges it. (2026-11-19, rule of the wave.)
- Never run Graphify and never install it. Map the code with file reads and `grep`. (2026-11-19, rule of the wave.)

## Architecture

The approach is locked by the ticket, the contract of #13 and ADR-SIC-H, so no blueprint was drawn. The command lives in `cstack/src/commands/next.ts`. It uses four small parts, each in its own file with its own tests. The guide lookup is shared with `cstack guide`. A time helper writes a local time with its offset. A header writer changes the value of named header lines of a plan file. A run progress module picks the next phase, checks a start, and marks phases started and done in `state.json`. No new structural decision appeared since phase 4.

## Implementation units

Units 1, 2, 3, 4 and 8 share no file and can run in parallel. Unit 5 needs units 1 to 4. Units 6 and 7 follow in order.

Security: there is no endpoint, no database and no secret. The external inputs are the `--plan` path, the plan file, `state.json` and `current-run`. The existing readers already check them (`locatePlan`, `readPlan`, `readState`, `readCurrentRun`). Units 5 and 6 test the two rules that matter here: a `--plan` path outside the repository exits with `2`, and cstack writes nowhere in the working tree except the header lines of the plan file.

### Unit 1: Share the guide lookup of cstack guide — status: todo
- Files: `cstack/src/commands/guide.ts`, `cstack/test/guide.test.ts`
- Failing test: in `cstack/test/guide.test.ts`, the exported `readGuide(packageRoot, skill, phase)` with a temporary `packageRoot` that holds `guides/resolve-issue/ticket.md` returns `{ ok: true, text }` with the exact bytes of the file. An unknown phase returns `{ ok: false }` with a message that lists the known phases, and an unknown skill returns a message that lists the skills with guides. The existing tests of `cstack guide` keep passing unchanged.
- Minimum code: move the lookup out of `guide()` into the exported `readGuide`, and make `guide()` call it. The messages and exit codes of `cstack guide` stay the same.
- Refactor: none.
- Commit message: `refactor(cli): share the guide lookup of cstack guide`
- Depends on: none

### Unit 2: Write a local time with its offset — status: todo
- Files: `cstack/src/local-time.ts`, `cstack/test/local-time.test.ts`
- Failing test: in `cstack/test/local-time.test.ts`, `localTime(new Date("2026-11-19T09:04:05.678Z"), 60)` returns `2026-11-19T10:04:05+01:00`. With the offset `-150` it returns `2026-11-19T06:34:05-02:30`, with `330` it returns `2026-11-19T14:34:05+05:30`, and with `0` it returns `2026-11-19T09:04:05+00:00`. A date near midnight moves to the right day. Without the offset argument, the offset comes from `getTimezoneOffset()` with the opposite sign. Every result matches the pattern that `readPlan` accepts for `Approved at`, and `Date.parse` of the result gives back the same second.
- Minimum code: `localTime(date, offsetMinutes = -date.getTimezoneOffset())` in `cstack/src/local-time.ts`.
- Refactor: none.
- Commit message: `feat(cli): write a local time with its offset`
- Depends on: none

### Unit 3: Change the value of plan header lines and keep every other byte — status: todo
- Files: `cstack/src/plan/header-write.ts`, `cstack/test/plan/header-write.test.ts`
- Failing test: in `cstack/test/plan/header-write.test.ts`, `setHeaderValues(text, { "Approved at": "2026-11-19T10:04:05+01:00", Status: "ready for review" })` on the text of `cstack/test/fixtures/plans/approved.md` changes those two lines and no other line. The same call on a copy with Windows line endings keeps `\r\n` on every line. A line that starts with `Status:` inside a multi-line HTML comment of the header stays as it is, and so does a line that starts with `Status:` in a section below the header. A key that is not in the header throws an error. The result still passes `readPlan`.
- Minimum code: find the header lines before the first level-2 heading, skip HTML comment lines as `readPlan` does, and replace only the text after `Key: ` on the named lines.
- Refactor: none.
- Commit message: `feat(cli): change the value of plan header lines and keep every other byte`
- Depends on: none

### Unit 4: Pick the next phase and mark phases started and done — status: todo
- Files: `cstack/src/run-progress.ts`, `cstack/test/run-progress.test.ts`
- Failing test: in `cstack/test/run-progress.test.ts`, write first the case of a state where `retro` was done before `ready`: `isDone(state, "retro")` is false and `nextPhase(state)` is `retro`. When `retro` was done after `ready`, `nextPhase` is `publish`. Before `ready` is done, a done `retro` counts as done. An empty state gives `ticket`, and a state where every phase is done gives `undefined`. `missingToStart("briefing", ...)` names `document` when `document` is not done. `missingToStart("publish", ...)` names the stale `retro` with the sentence of "Decisions". `missingToStart("plan", ...)` includes the open blocking question of a plan read from a fixture. In a temporary repository, `markStarted` and `markDone` write `toISOString()` times into `state.json` and keep the other phases. `clearCurrentRun` removes `current-run` and keeps the run folder. The context builder reads the unit commits and the last done report only when a check asks for them.
- Minimum code: `isDone`, `nextPhase`, `missingToStart`, `phaseContext`, `markStarted`, `markDone` and `clearCurrentRun` in `cstack/src/run-progress.ts`, built on the exported functions of `cstack/src/run-state.ts`, `cstack/src/plan/commits.ts` and `cstack/src/report/reports.ts`. Add a `WHY:` comment on `isDone` that explains the rule for `retro`.
- Refactor: none.
- Commit message: `feat(cli): pick the next phase and mark phases started and done`
- Depends on: none

### Unit 5: Print the guide of the next phase with cstack next — status: todo
- Files: `cstack/src/commands/next.ts`, `cstack/test/next.test.ts`, and the fifteen fixture guides `cstack/test/fixtures/next/guides/resolve-issue/<phase>.md`
- Failing test: in `cstack/test/next.test.ts`, write first the case of a run where `document` is not done, and call `cstack next --phase briefing`. It exits with `1`, and the message names `document`. Then: in a fresh repository, a plain `cstack next` prints `Run: none yet. Phase 1 of 15: ticket, in the main conversation.` and the fixture guide of `ticket`, with exactly one marker word in the output, and records nothing. `cstack next --plan` on a copy of `approved.md` prints the run line `Phase 6 of 15: build, in the executor.` and the `build` guide at once. `--phase deploy` exits with `2` and lists the fifteen names. A plan file with `Format: cstack-plan/2` exits with `3`, and the message names the cstack version that can read it. `--plan ../other/plan.md` and an absolute path outside the repository exit with `2`. `--new` deletes `current-run`, keeps the run folder and prints the `ticket` guide. A plain `cstack next` and `--phase` record `startedAt`. A plain `cstack next` refuses with `1` when the start condition of the next phase fails. `--done` with `--phase`, and `--new` with another flag, exit with `2`.
- Minimum code: `next(args, io, { cwd, packageRoot, now })` in `cstack/src/commands/next.ts`, without `--done` yet. It parses the flags with `parseArgs` in strict mode, finds the run, prints the run line and the guide through `readGuide`, and maps errors with `failWith`.
- Refactor: none.
- Commit message: `feat(cli): print the guide of the next phase with cstack next`
- Depends on: 1, 2, 3, 4

### Unit 6: Close a phase with cstack next --done — status: todo
- Files: `cstack/src/commands/next.ts`, `cstack/test/next.test.ts`
- Failing test: in `cstack/test/next.test.ts`, write first `cstack next --done briefing` on a run where `document` is not done: it exits with `1` and names `document`. Then cover every acceptance line of the ticket for `--done`. `--done ticket --plan docs/plans/x.md` creates the run folder under the common git folder, writes `Written by: cstack <the version of cstack/package.json>`, and prints only the run line and the `dependencies` guide. `--done ticket` without `--plan` exits with `2`. `--done plan` exits with `1` and names the open question, and it also exits with `1` when the Status is not `approved`. Otherwise it writes `Approved at` with an offset and prints the line about the executor and no guide text. `--done ready` writes the Status and `Ready for review at`, keeps every other line byte for byte, and prints the line about the main conversation. A linked worktree joins the run with `--plan` and marks `build` done, and the main worktree then sees `build` as done. With ten `.md` files directly in `docs/retros/` and three in `docs/retros/reviewed/`, `--done retro` prints the "Digest due" notice, and with nine it prints none. Also test these rules of "Decisions": after `--done ready` on a run whose `retro` was done earlier, the line names `retro` in the main conversation. `--done retro` says that `publish` runs in the executor when `ready` is done, and that the run stopped otherwise. `--done publish` says that the run is finished. A second `--done plan` says "plan is already done." and leaves `Approved at` unchanged. `--done questions` with an open question prints "questions is done." and exits with `1` because `plan` cannot start. After the whole sequence, `git status --porcelain` lists only the plan file, and `git diff` changes only its header lines. Fix the clock with the `now` option.
- Minimum code: the `--done` path of `cstack/src/commands/next.ts`, with the header writes through `setHeaderValues` and `localTime`, the write order of "Decisions", the one-line messages and the digest count. Add a `WHY:` comment on the write order.
- Refactor: if `next.ts` grows past about 250 lines, move the message wording into small functions in the same file.
- Commit message: `feat(cli): close a phase with cstack next --done`
- Depends on: 5

### Unit 7: Register cstack next in the command list and the command line — status: todo
- Files: `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/test/cli.test.ts`, `cstack/test/manifest.test.ts`, `README.md`
- Failing test: in `cstack/test/manifest.test.ts`, the count becomes eleven built commands and four that are not built. In `cstack/test/cli.test.ts`, the example of a command that is not built becomes the first entry of `COMMANDS` that is not built, skipped when there is none, and a new case checks that `run(["next", "--phase", "deploy"], io)` exits with `2` and lists the phase names.
- Minimum code: set `built: true` on the entry of `cstack next` in `cstack/src/manifest.ts`. Add one import and one line to `HANDLERS` in `cstack/src/cli.ts`: `next: (args, io) => next(args, io, { cwd: process.cwd(), packageRoot })`. In `README.md`, change "ten commands" to "eleven commands" and add one bullet for `cstack next`, in plain sentences.
- Refactor: none.
- Commit message: `feat(cli): register cstack next`
- Depends on: 6

### Unit 8: Tell each side what to do when the run line names the other place — status: todo
- Files: `cstack/skills/resolve-issue/SKILL.md`, `cstack/skills/resolve-issue/agents/executor.md`, `cstack/test/prompts.test.ts`
- Failing test: in `cstack/test/prompts.test.ts`, the executor prompt has a sentence that tells the executor not to follow a guide whose run line says "in the main conversation", and the short skill has a sentence that tells the main conversation not to follow a guide whose run line says "in the executor". `cstack/test/skill-size.test.ts` stays green.
- Minimum code: add the two sentences written in "Decisions", one in each file, in plain words, near the existing lines about `cstack next` (`SKILL.md` around line 20, `executor.md` around line 26).
- Refactor: none.
- Commit message: `feat(skill): tell each side what to do when the run line names the other place`
- Depends on: none

## Documentation duties

- The `## Commands` section of `README.md`: applies, written to `README.md` in unit 7. Keep the change small, because other tickets of the wave edit the same lines.
- Code comments: applies, written to `cstack/src/run-progress.ts` (a `WHY:` comment on the rule for `retro`) and `cstack/src/commands/next.ts` (a `WHY:` comment on writing the plan file before `state.json`).
- The comment on this ticket, #15: applies, written to https://github.com/gambitl/claude-code-stack/issues/15. It says what was built, the files, and the rules that go beyond the ticket's text: the rule for a stale `retro`, the place on the run line, the start check on every start, the second `--done`, and the time formats.
- Comments on the tickets that build on this one: applies, written to #23 and #20. #23 gets the run line with its place, the point where it prints the settings (between the run line and the guide), `readGuide`, and the time formats of the plan header and of `state.json`. #20 gets the rule for a stale `retro`, and the fact that `cstack next --done publish` checks the start condition of `publish`.
- An architecture decision record: does not apply. The new rules are local to one command, and ADR-SIC-B does not change.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. No user story or criterion changes.
- The conventions file `CLAUDE.md`: does not apply.

## Review log

<phase 7 findings and fixes; phase 8 independent review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Open questions after the build

### Blocking

none

### Non-blocking

none

## Pull request

<phase 10.4>

## Documentation

<phase 10.3>

## Executor notes

<executor, before its report>

## Hand-off log

<one entry per executor run>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Does a retrospective written at an earlier stop still count once the build is ready?** A run can write its retrospective at a stop, before the build. After `--done ready`, cstack would see it as done and send the executor straight to `publish`. Nobody would write the final retrospective, and a plain `cstack next` in the main conversation would print the publish guide too. I recommend that `retro` counts as done only when its done time is later than the done time of `ready`. The start check of `publish` stays as it is.

**What does a plain `cstack next` print when the next phase runs on the other side?** cstack cannot tell who calls it. When the main conversation resumes a run that stopped during the build, it gets the `build` guide and may start building itself. The executor has the opposite problem when it resumes and the next phase is `retro`. I recommend that the run line always names the place, such as `Phase 6 of 15: build, in the executor.`. I would add one sentence to the short skill and one to the executor prompt: when the place is not yours, do not follow the guide. This changes the run line of the acceptance criteria and touches two prose files in `cstack/skills/resolve-issue/`.

**I will do this unless you say no.**

- Every time cstack starts a phase, even after a successful `--done`, it checks the dependencies and the start condition. When they fail, it prints no guide. The message says that the previous phase is done and names what is missing, with exit code `1`.
- A second `--done` on a phase that is already done writes nothing, except for `retro`. Otherwise `Approved at` and `Ready for review at` would move.
- On `--done`, I write the plan file first and `state.json` second. In the other order, a stop between the two would leave the phase done with no `Approved at` in the plan, for good.
- The plan header gets the local time with its offset, to the second. `state.json` keeps the UTC time with milliseconds, like the saved reports, so two marks in the same second still compare correctly. Tests inject the clock and run with a negative offset and a half-hour offset.
- The "Digest due" count takes only the `.md` files directly in `docs/retros/`.
- After `--done ready`, the line says "Finish this guide, then submit your report.", because the `ready` guide still commits the plan file after that command. Tests pin the phrases that the guides wait for.

**I checked it myself.**

- The `ready` guide commits the plan file after `--done ready` (line 16), so cstack writes the header and never commits.

#### Details

The stale retrospective is draft question 1, labelled blocking, and answered by reading the source, which I checked. `retro` has no dependency (`cstack/src/phases.ts` line 113) and keeps its done time. `publishStart` (lines 76 to 82) only compares that time with `lastAcceptedDoneReportAt`. Between the executor's `--done ready` and its `cstack report submit`, no done report exists, so a retrospective marked done at a needs-decision stop (`cstack/guides/resolve-issue/plan.md` line 56) passes. The first phase that is not done is then `publish`, which runs in the executor, and the executor prompt (`cstack/skills/resolve-issue/agents/executor.md` line 26) keeps going because cstack never says "runs in the main conversation". I keep the draft recommendation: when cstack picks the next phase, checks the dependencies of `publish`, or words the message after `--done retro` (scope step 9), `retro` counts as done only when its done time is later than the done time of `ready`. Before `ready` is done, it counts as usual. I rejected clearing the done time of `retro` when `ready` is marked done, because it destroys a fact that `cstack measure` of #23 or a later reader may want. I also rejected changing `publishStart`, because #16 reuses its helpers and its rule is about reports, not phases. The default if nobody decides is the ticket's literal wording, which ships the bug. The comparison must use `Date.parse`, never a string comparison, because the offsets can differ across a daylight saving change.

The place of a plain `cstack next` is a point of mine, labelled blocking, because it changes what the command prints and an acceptance line. It needs the user, not a test. The ticket covers the change of place only after `--done` (scope step 4), where the caller is known from the phase it just closed. A plain call has no such signal. The main conversation calls it at the start of every session (`cstack/skills/resolve-issue/SKILL.md` line 16) and after a done report (`plan.md` line 55). The executor calls `cstack next --plan` to resume (`executor.md` line 28). After a session that stopped during the build, the main conversation's plain call picks `build` and prints the build guide, whose first lines tell the reader to start the work. The reverse happens when the executor is relaunched for `publish` but `retro` is not done: it gets the retro guide. I considered three options. The first uses the presence of `--plan` as the signal, since today only the executor passes it on a plain call. I rejected it because it is a hidden coupling: the main conversation would break the day a guide asks it to pass `--plan`, for example in another worktree. The second adds a flag such as `--executor`. I rejected it because the manifest entry is the contract of #13 and a shared file of the wave. The third, which I recommend, makes the run line name the place for every phase, such as `Run: docs/plans/2026-11-17-42-add-export.md. Phase 6 of 15: build, in the executor.`, and adds one sentence to `cstack/skills/resolve-issue/SKILL.md` and one to `executor.md`: when the run line names the other place, do not follow the guide, and hand over as the `plan` guide says or stop with your report. It costs one wasted guide on a rare resume, and it is explicit. The default if nobody decides is today's wording, and the wrong side follows the wrong guide. `cstack/test/skill-size.test.ts` keeps the short skill and the first guide under a fifth of the frozen prose skill, and `cstack/test/prompts.test.ts` checks sentences of the executor prompt. Run both after the prose change.

The start check on every start is draft question 2, labelled blocking, and answered by reading the source. The `questions` done check only needs the section filled (`phases.ts` line 99), while `plan` starts only with no open blocking question (line 100). The same gap exists between `after-build-questions` and `ready` (lines 107 to 109). I keep the draft recommendation. The phase just closed stays done, the guide is not printed, no `startedAt` is recorded, and the exit code is `1`. A rerun of `--done` then lands on the "already done" path of the next item and checks the start again, which matches the instruction "fix the cause and run the command again" (`SKILL.md` line 26). The default if nobody decides is that the guide prints and the plan phase starts with an open question.

The repeated `--done` is draft question 3, labelled blocking, with no test needed. I keep the draft recommendation: for every phase except `retro`, a second `--done` runs no check, writes nothing, prints "<phase> is already done." and then the next phase as usual, with exit `0`. `retro` is checked and marked again with a new time, as #13 decided (second ticket comment). The default if nobody decides is that `Approved at` and `Ready for review at` move on each call, and the measure of #23 reads wrong durations.

The order of the two writes on `--done` is a point of mine, non-blocking, because both orders build the same feature. If `state.json` were written first and cstack stopped before the plan file, the phase would be done in the state. The next `--done` would say "already done" and never write `Approved at`. A fresh clone would then not mark the planning phases done (`run-state.ts` lines 162 to 166), and the measure of #23 would have no approval time. Writing the plan file first means a stop leaves the phase not done, and the next `--done` repeats the check and the write. `writeFileAtomic` writes a temporary file next to the plan file (`run-state.ts` line 107), so a crash in that window leaves a `.tmp` file in `docs/plans/`. That is acceptable, but the test that checks `git status` will show it if a test kills the process.

The time formats are a point of mine, non-blocking, and they change one of the unasked assumptions. The plan reader refuses a `Z` time and a fraction (`cstack/src/plan/read.ts` line 244), so the header gets `YYYY-MM-DDTHH:MM:SS±HH:MM`. That reason does not apply to `state.json`, which the plan reader never reads. Saved reports use `toISOString()`, which is UTC with milliseconds (`cstack/src/report/reports.ts` line 146). A done time cut to the second can look earlier than a report saved in the same second, and `publishStart` uses `<=`. So I keep milliseconds in `state.json`. `createRun` already stores `Approved at` there with an offset and no fraction, and `Date.parse` reads both. Node has no built-in formatter for a local time with its offset, and `getTimezoneOffset()` returns minutes behind UTC, so its sign is the opposite of the offset to write. The tests need an injected clock and at least one run with a negative offset and one with a half-hour offset, such as `TZ=America/St_Johns` and `TZ=Asia/Kolkata`. The default if nobody decides is the assumption as drafted, which works in practice but can flake in tests that mark two phases within the same second.

The count of the "Digest due" notice is draft question 4, labelled non-blocking. I keep the draft recommendation: only `.md` files directly in `docs/retros/` of the worktree root, ignoring every subfolder. The count runs on the current branch, as the prose skill does today, so retrospectives on other unmerged branches are not counted.

The wording of the one-line messages is a point of mine, non-blocking, but it is a hidden coupling with prose that already shipped. The executor stops only when cstack says that the next phase "runs in the main conversation" (`executor.md` line 26). The retro guide waits for cstack to say that `publish` comes next (`cstack/guides/resolve-issue/retro.md` line 25). The `ready` guide runs `--done ready` as step 1 and commits the plan file as step 2 (`cstack/guides/resolve-issue/ready.md` lines 15 and 16), and the done report is refused while the plan file has an uncommitted change. The ticket's example "Submit your report now." would push the executor to skip step 2. I recommend "The next phase, retro, runs in the main conversation. Finish this guide, then submit your report." The ticket gives its texts as examples, so this needs no change of scope. The tests should pin the phrase "runs in the main conversation" and the mention that `publish` comes next.

I checked by reading `ready.md` lines 15 and 16 and `build.md` line 9 that the guides commit the plan file themselves, so `cstack next` writes the header lines and never runs git. I also checked that `cstack measure` today reads only plan files without a `Format` line (`cstack/src/measure/moments.ts` line 41), so the new header times break nothing there yet.

A run folder is keyed by the plan file name only (`run-state.ts` line 96), and `createRun` keeps a run that exists (lines 160 and 161). If someone deletes a plan file and starts the same ticket again on the same day, the old phase marks come back after `--done ticket`. This is rare, because the name carries the date, and it needs no work in this ticket.

The locked decisions apply unchanged. ADR-SIC-B splits the facts between the plan file and the run state. ADR-SIC-C and ADR-SIC-H serve the guides from the package root through an options object, and ADR-SIC-H forbids `process.exit()`. #13 decided that `retro` is marked done again with a new time each time. I checked security and authorization, data model lock-in, scale and performance, user-facing edge cases, operations and cost, and reversibility, and found nothing beyond the points above. `locatePlan` already refuses paths outside the repository and resolves symbolic links. The run state format does not change. Every write is a header line of a committed file or a file under the git folder.

### Open questions and answers

Drafted in phase 4.1. Each question has its label and the recommended answer.

**Question 1 (blocking). When does an earlier retrospective stop counting as done?**
A run can mark `retro` done at an earlier stop, for example after a needs-decision round that ended the session (`cstack/guides/resolve-issue/plan.md` line 56). Checked by reading the source: `retro` has no dependency and keeps its done time (`cstack/src/phases.ts` line 113). `publishStart` (lines 76 to 82) compares that time only with the last accepted done report. When the executor later runs `cstack next --done ready`, it has not submitted its done report yet, so `publishStart` passes, and the first phase that is not done is `publish`, which runs in the executor. `cstack next` would then print the publish guide to the executor instead of sending it back to the main conversation, and a plain `cstack next` in the main conversation would also print the publish guide instead of the retro guide. The ticket's wording ("the first phase in the list that is not done") does not cover this.
Recommended answer: when cstack picks the next phase or checks the dependencies of `publish`, `retro` counts as done only when its done time is later than the done time of `ready`. Before `ready` is done, a retrospective counts as done as usual. `publishStart` stays as it is.

**Question 2 (blocking). Does cstack check the start condition when it picks the next phase by itself?**
The ticket asks for the check with `--done` and `--phase`. Plain `cstack next`, and the guide printed after a successful `--done`, start a phase too. Example: `--done questions` passes while a blocking question still has `- Answer: open`, because its done check only needs the section filled, and the next phase `plan` has the start condition "no open blocking question".
Recommended answer: every time cstack starts a phase, it checks the dependencies and the start condition. When the start condition fails, it prints no guide, records no start, names each missing part on standard error and exits with `1`. After a successful `--done`, the done mark stays, and the message first says that the phase is done, then why the next one cannot start.

**Question 3 (blocking). What does `--done` do on a phase that is already done?**
Running `--done plan` twice would write a new `Approved at`. Running `--done ready` twice would write a new `Ready for review at`. `cstack measure` of #23 will read those two times.
Recommended answer: for every phase except `retro`, a second `--done` runs no check and writes nothing. It prints "<phase> is already done." and then the next phase as usual, with exit `0`. `retro` is checked and marked done again each time, with a new done time, as #13 decided.

**Question 4 (non-blocking). Which files count for the "Digest due" notice?**
The ticket says "the files that sit directly in `docs/retros/`". On macOS, Finder can leave a `.DS_Store` file there.
Recommended answer: count only the `.md` files directly in `docs/retros/` of the repository root, and ignore every subfolder.

**Answers, 2026-11-19.** The user answered "ok pour les deux recommandations, vas-y" to the two questions the advisor kept for them, and did not object to any item of "I will do this unless you say no".

- Question 1, the stale retrospective: the user's answer is the recommendation. `retro` counts as done only when its done time is later than the done time of `ready`.
- The place of a plain `cstack next` (raised by the advisor): the user's answer is the recommendation. The run line always names the place, and one sentence goes into `cstack/skills/resolve-issue/SKILL.md` and one into `cstack/skills/resolve-issue/agents/executor.md`.
- Question 2, the start check on every start: accepted by default.
- Question 3, a second `--done`: accepted by default.
- Question 4, the digest count: accepted by default, `.md` files only.
- The advisor's other points are accepted by default: the plan file is written before `state.json`, `state.json` keeps UTC times with milliseconds while the plan header gets the local time with its offset, and the line after `--done ready` says "Finish this guide, then submit your report."

Assumptions not asked, because they have an obvious default (they go to "Decisions" in phase 5). The time assumption below was replaced by the advisor's point on time formats:

- When there is no run, the run line reads `Run: none yet. Phase 1 of 15: ticket.`
- When the next phase runs in the other place, `--done` prints that one line and no run line.
- Plain `cstack next` on a run where every phase is done prints the run line and "The run is finished.", with exit `0`.
- `--done` and `--phase` need a run, from `--plan` or from `current-run`. Without one, the message of `locatePlan` is printed with exit `2`. `--done ticket` always needs `--plan`, even when a current run exists.
- `--done` with `--phase`, or `--new` with any other flag, is a usage error with exit `2`. An unknown phase name exits `2` and lists the fifteen names.
- Times written by cstack, in the plan file and in `state.json`, use the local offset, such as `2026-11-19T10:04:05+01:00`, because the reader refuses a `Z` time.
- Printing a guide always records a new `startedAt` for that phase. A phase marked done without a printed guide gets no `startedAt`.
- `--phase` on a phase that is already done prints its guide and records `startedAt`, and keeps its done time.
- The unit commits are only read when a check needs them, so a missing local target branch only matters for `build`.
