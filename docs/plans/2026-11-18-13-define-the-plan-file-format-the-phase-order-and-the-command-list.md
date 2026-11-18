# Plan: #13 — M2-1: Define the plan file format, the phase order and the command list of the build loop

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/13
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/plan-format
Conversation language: French
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Before several people build the parts of the new build loop at the same time, we write down the rules they all share, so that the parts fit together.

- **What the title means**: The plan file is the markdown file in which the `resolve-issue` skill records everything about one ticket. Its format is a fixed layout that a program can read without guessing. A phase is one step of a run, such as asking the questions or opening the pull request, which is the request to merge the work into the main code. The phase order says which phases must be finished before another one may start. The command list is one file in the code of `cstack`, the command-line tool of this project. It names every command with its options and its exit codes. An exit code is the number a command returns when it ends, and it tells the caller what happened. The build loop is the part of a run that turns an approved plan into tested commits, which are the saved steps of the code history, and then into a pull request.
- **Why we are doing it**: Milestone 2 splits the build loop into several tickets that people build in parallel. If each ticket read the plan file in its own way, or invented its own command names, the parts would not fit together. Today the plan file has no version number and no fixed layout, so no program can check it.
- **For the user**: A solution engineer gets runs whose steps cannot be skipped, and a plan file that always matches what git holds. Every later ticket of the milestone tests its work against these rules.

**Goal.** This ticket delivers the shared rules of milestone 2, which are the plan file format, the phase order, the command list and the decision record ADR-SIC-B (US-6 to US-12). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #7 creates the `cstack/` package with its tests and CI. Its entry point `cstack/src/cli.ts` returns an exit code, and each command lives in its own file under `cstack/src/commands/`. #7 does not create `cstack/src/manifest.ts`, because this ticket does. #9 adds `cstack skills install` and `cstack guide <phase>`, #10 adds `cstack doctor`, and #11 adds `cstack measure`. None of them is in the repository yet.
* **Plan header today**: `skills/resolve-issue/templates/plan.md` (lines 1 to 9): the title is followed by the lines Date, Ticket, Tracker, Documentation tool, Branch, Conversation language and Status. The header has no format version, no target branch and no timestamps.
* **Plan sections today**: `skills/resolve-issue/templates/plan.md` (lines 13 to 103): the level-2 sections are Ticket, Dependencies, Code mapping, Decisions, Architecture, Implementation units, Documentation duties, Review log, Briefing, Open questions after the build, Pull request, Documentation, Executor notes, Hand-off log and History. Line 15 copies the ticket "verbatim, every section", so the ticket's own `##` headings land at the same level as the plan's sections.
* **Headings that start with the same words**: `skills/resolve-issue/templates/plan.md` has "Decisions" (line 29) and "Decisions already taken upstream" (line 17). It also has "Architecture" (line 33) and "Architecture options" (line 101), and "Documentation" (line 77) and "Documentation duties" (line 49). A reader that matches on the first words picks the wrong one.
* **Units today**: `skills/resolve-issue/templates/plan.md` (lines 39 to 45): each unit heading carries a status written by hand ("todo | in progress | done | blocked"), which can drift from git. A unit does not list the files it touches, and it has no way to say that it has no test.
* **Blocking questions today**: `skills/resolve-issue/SKILL.md` (line 21) defines a blocking question, and line 124 says that no plan starts while one has no answer. The template keeps such questions in two places, "Open questions after the build" (lines 61 to 71) and "Open questions and answers" in the History part (lines 97 to 99).
* **Moments that a measure needs**: `skills/resolve-issue/agents/executor.md` (line 39) commits the plan file as the first commit of the branch right after approval, and line 99 commits the Status "ready for review". Neither moment is written as a time in the plan file.
* **Phases today**: `skills/resolve-issue/SKILL.md` has the headings of phases 0 to 5 at lines 52, 58, 70, 80, 97 and 128, phase 11 at line 165 and phase 12 at line 181. `skills/resolve-issue/agents/executor.md` has phases 6 to 9 at lines 35, 45, 51 and 55, and phase 10 at line 61. Phase 10 has four parts, the briefing (line 65), the questions after the build (line 69), the documentation (line 79) and "ready for review" (line 91). Phase 12 is at line 101. Today the briefing runs before the documentation.
* **Reports today**: `skills/resolve-issue/SKILL.md` (lines 158 to 163 and 185 to 189) and `skills/resolve-issue/agents/executor.md` (lines 123 to 126) describe the four reports done, needs-decision, failed and published.
* **Specification**: `docs/projects/skills-into-cli.md` (line 111) gives the example that the briefing waits for the documentation step. Line 112 asks that cstack name the version that can read an unknown plan format. Line 319 lists ADR-SIC-B as still open.

## Scope

1. **Write the plan file format, version 1.** Create `cstack/skills/resolve-issue/templates/plan.md` from today's template. Keep its sections and wording, and make the changes below.
   - After the title, the header lines are `Format: cstack-plan/1`, `Written by: cstack <version>`, `Date:`, `Ticket:`, `Tracker:`, `Documentation tool:`, `Branch:`, `Target branch:`, `Conversation language:`, `Status:`, `Approved at:` and `Ready for review at:`, in this order.
   - `Target branch` is the branch that the pull request goes into. cstack writes the `Written by` line when it registers the plan file, so that a later cstack knows which version can read the file.
   - `Approved at` and `Ready for review at` hold an ISO 8601 time with its offset, such as `2026-11-17T14:32:05+01:00`, or the words `not yet`. cstack writes them, as the phase list of step 5 says. `cstack measure` can then read both moments from the plan file, and #23 makes it do so.
   - Today's placeholder of `Conversation language` (line 8) says that every record stays in English. Write instead that every record uses the records language of the settings file of #14, which is English by default.
   - `Status` keeps today's values, which are draft, waiting for answers, questions answered, approved, in progress, review and ready for review.
   - The level-2 sections are Ticket, Dependencies, Code mapping, Decisions, Architecture, Implementation units, Documentation duties, Blocking questions, Review log, Briefing, Non-blocking questions, Pull request, Documentation, Executor notes, Hand-off log and History, in this order. No other level-2 heading is allowed.
   - The ticket is still copied word for word, but each of its headings moves down one level. So the ticket's `## Scope` becomes `### Scope` under `## Ticket`, next to `### Decisions already taken upstream`. The words of the ticket do not change.
   - Each unit has the heading `### Unit <n>: <name>`, numbered 1, 2, 3 and so on with no gap. The heading carries no status, because the status comes from git.
   - A unit starts with a `- Files:` line, which lists one or more paths in backticks, separated by commas. The next line is either `- Test:` or `- No test: <reason>`. A `Test` line holds one test file in backticks, then a colon, then the failing case it checks. Then come `- Minimum code:`, `- Refactor:`, `- Commit message:` on one line, and `- Depends on:`. The `Depends on` line holds unit numbers separated by commas, or the word `none`.
   - The optional `- Design specification:` line stays for user-interface units. The executor may add `- Blocked: <reason>` and free notes after the unit's lines.
   - The test file of a `Test` line must also appear in `Files`. A path is relative to the repository root. It may hold only letters, digits and the characters `.`, `_`, `-`, `/`, `@` and `+`. It may not start with `/` or `-`, and it may not contain a `..` part.
   - Each unit commit carries the git trailer `Cstack-Unit: <n>`. A git trailer is a `Key: value` line at the end of a commit message.
   - The new section `## Blocking questions` holds every blocking question of the run, from the question round and from after the build. Each one has the heading `### Question <n>: <a few words>`, then the question word for word. Then come a line `- For: <who can answer it>` and a line `- Answer: <the answer, its source and its date>`.
   - The answer line holds the single word `open` until someone answers. When the run has no blocking question, the section holds the single word `none`.
   - The section `## Non-blocking questions` replaces "Open questions after the build". It holds the questions that go into the pull request body, each with who it is for, or the word `none`.
   - The section `## Pull request` holds a line `Title: <title>`, then the body inside a fenced block that opens with four backticks and the word `markdown`. The four backticks let the body hold ordinary code blocks and headings without ending the section.
   - A section is filled when it holds at least one line that is not blank, not an HTML comment, and not a placeholder line of the template. A placeholder line starts with `<` and ends with `>`.
   - A done report needs the sections Ticket, Dependencies, Code mapping, Decisions, Architecture, Implementation units, Documentation duties, Blocking questions, Review log, Briefing, Non-blocking questions, Pull request, Documentation and Executor notes to be filled.
2. **Ship the plan file reader** in `cstack/src/plan/read.ts`. It returns the header, the sections with their line ranges, the units with their fields, and the blocking questions with their answers. Each error gives the line number and the rule that the line breaks.
   - The reader ignores every line inside a fenced code block when it looks for headings, because a ticket can hold a shell comment that starts with `#`.
   - A plan file with no `Format` line is refused. The message says that the prose skill wrote it before cstack existed, and that this cstack reads `cstack-plan/1`.
   - A plan file with another format version is refused (US-6 AC3). The message names the version this cstack reads. It also names the cstack version of the file's `Written by` line, which can read it.
3. **Ship the commit trailer reader** in `cstack/src/plan/commits.ts`. For each unit number, it lists the commits that carry `Cstack-Unit: <n>` and are on the current branch but not on the target branch. It uses `git log <target branch>..HEAD` with the trailer format of `git log`. #16, #17 and #18 all use it.
4. **Add example plan files** in `cstack/test/fixtures/plans/`. Write two valid files, one just after approval and one at "ready for review" with every section filled. Add one valid file whose ticket holds a fenced code block with a line that starts with `#`. Then write one broken file per rule of step 1. Examples are a missing `Format` line, `Format: cstack-plan/2`, a ticket heading left at level 2, a unit with neither `Test` nor `No test`, a test file missing from `Files`, a path with `..`, a gap in the unit numbers, and a blocking question without an answer line.
5. **Fix the phase list** in `cstack/src/phases.ts`. Each phase has a name, the phase of today's skill it replaces, the place where it runs, and the phases it depends on. It can also have a start condition and a done check. `cstack next --done <phase>` runs the done check (#15). The guide of each phase lives in `cstack/guides/resolve-issue/<phase>.md`.

   | Order | Phase | Today | Runs in | Depends on | Start condition | Done check |
   |---|---|---|---|---|---|---|
   | 1 | `ticket` | 0 and 1 | main conversation | none | none | The plan file reads as format 1 and Ticket is filled. cstack registers the run and writes `Written by`. |
   | 2 | `dependencies` | 2 | main conversation | `ticket` | none | Dependencies is filled. |
   | 3 | `code-map` | 3 | main conversation | `dependencies` | none | Code mapping is filled. |
   | 4 | `questions` | 4 | main conversation | `code-map` | none | Blocking questions is filled. |
   | 5 | `plan` | 5 | main conversation | `questions` | No blocking question is open. | Status is `approved`, no blocking question is open, and every unit is complete. cstack writes `Approved at`. |
   | 6 | `build` | 6 | executor | `plan` | none | none |
   | 7 | `review` | 7 | executor | `build` | none | Review log is filled. |
   | 8 | `independent-review` | 8 | executor | `review` | none | none |
   | 9 | `update-branch` | 9 | executor | `independent-review` | none | none |
   | 10 | `document` | 10.3 | executor | `update-branch` | none | Documentation is filled. |
   | 11 | `briefing` | 10.1 | executor | `document` | none | Briefing is filled. |
   | 12 | `after-build-questions` | 10.2 | executor | `briefing` | none | Non-blocking questions is filled. |
   | 13 | `ready` | 10.4 | executor | `after-build-questions` | No blocking question is open. | Pull request and Executor notes are filled. cstack writes Status `ready for review` and `Ready for review at`. |
   | 14 | `retro` | 11 | main conversation | none, because it runs after every ending | none | none |
   | 15 | `publish` | 12 | executor | `ready` and `retro` | none | none |

   The main conversation is the conversation with the user. The executor is the helper that runs the build. Today's phase 0 moves into the entry skill and the `ticket` guide. The briefing now runs after the documentation, as US-6 AC2 asks, so the briefing can say where the work was documented.
6. **Fix the run state** in `cstack/src/run-state.ts`, as ADR-SIC-B decides. The run state is what only cstack needs to know about a run, such as which phases are done.
   - Each run has a folder `<common git folder>/cstack/runs/<plan file name without .md>/`. The common git folder is the folder that `git rev-parse --git-common-dir` prints. Every worktree of the repository sees the same runs, and git never commits or pushes this folder. So a test run that a unit saves in a child worktree of the same repository is already visible from the ticket's worktree.
   - Each worktree records which run it works on in `<worktree git folder>/cstack/current-run`, which holds the plan file name. The worktree git folder is the folder that `git rev-parse --git-dir` prints.
   - `state.json` holds `format` (`cstack-run/1`), `writtenBy` (the cstack version), `plan` (the plan file path from the repository root), and `phases`. For each phase name, `phases` holds `startedAt` and `doneAt`.
   - `units/<n>/red.json` with `red.log`, and `units/<n>/green.json` with `green.log`, each hold one saved test run. A saved run has its time, its command, its exit code, its commit and its test file.
   - `reports/<time>-<kind>.json` holds one accepted report, with `readAt` once the main conversation was shown the report. `publish.json` holds the pull request link, each push with its commit and time, and the result of the checks on the last push.
   - cstack writes each file whole, through a temporary file and a rename. So two units that run in parallel never write the same file.
   - A state file with an unknown `format` is refused with exit code 3. The message names the cstack version in `writtenBy`.
   - When cstack creates a run for a plan file whose `Approved at` is set, it marks the five planning phases done. So an executor started in a fresh clone can continue.
   - The freshness stamp of the code graph is not run state. #19 keeps it in `<worktree git folder>/cstack/graph.json`, because the graph belongs to one worktree.
7. **Create the command list** `cstack/src/manifest.ts`. It is the single list of commands, and every other file refers to it. Each entry gives the words of the command, its usage line, a one-sentence summary, its flags, its exit codes, and the file under `cstack/src/commands/` that implements it. Later contract tickets, such as #24, add their commands to this file.

   List first the four commands of milestone 1, with the flags and exit codes that their tickets define. Check each one against its code on `main`.
   - `cstack skills install [--adopt <name>]` (#9). It copies each skill folder of the installed package to `~/.claude/skills/<name>/` and writes the marker `.cstack-managed`. It exits with `0` when every shipped skill is in place, and with `1` when at least one folder was skipped. `--adopt <name>` first moves a folder without the marker to `~/.claude/skill-backups/<YYYY-MM-DD-HHMMSS>/<name>`. It refuses a name that this version does not ship.
   - `cstack guide <phase> [--skill <name>]` (#9). It prints `guides/<skill>/<phase>.md` from the installed package, and the skill is `resolve-issue` unless `--skill` names another one. It refuses a phase or a skill name that does not match `^[a-z0-9][a-z0-9-]*$`. It exits with `1` for an unknown phase and lists the known phases.
   - `cstack doctor` (#10). It checks the machine. It exits with `0` when every required item is present, and with `1` otherwise.
   - `cstack measure <plan file>` (#11). It prints the four kinds of tokens and the minutes from approval to "ready for review". It exits with `1` when a moment is missing. In milestone 1 it refuses a plan file with a `Format` line, and #23 lifts that refusal.

   The commands of milestone 1 keep their exit codes. `cstack guide` exits with `1` for an unknown phase, while the common codes below would call that a usage error. Changing it is not part of this ticket.

   Every command of milestone 2 uses the same common exit codes.
   - `0` means that the command did its job.
   - `1` means refused. A rule that cstack enforces said no, and the message names the rule and what to do.
   - `2` means a usage error. The command line is wrong, for example with an unknown command, flag, phase, section or unit number.
   - `3` means invalid input. The plan file, the settings file or the run state is missing, cannot be read, breaks its format, or has a format version this cstack does not read.
   - `4` means a missing tool. A tool that the command needs is not installed or not logged in, such as Graphify, `gh` or `glab`.
   - `5` means a tool failed. A tool that cstack ran failed for a reason outside cstack's rules, such as a rejected push or a crash.
   - Codes `6` and above belong to one command, and that command lists them.

   These are the commands of milestone 2, with the ticket that builds each one. Every one of them except `cstack graph ensure` works on a run. Each of those also takes `--plan <file>`, which names the run when the worktree has none, for example in a fresh child worktree. Without `--plan`, the command uses the run named in the worktree's `current-run`, and it exits with `3` when there is none.
   - `cstack next [--done <phase>] [--phase <phase>] [--plan <file>] [--new]` (#15). Without a flag, it prints the guide of the next phase and records that the phase started. The next phase is the first one in the list that is not done and whose dependencies are done. `--done <phase>` runs the done check, marks the phase done, and prints the next guide. When the next phase runs in the other place, it prints one line that says where, instead of the guide. `--phase <phase>` prints the guide of that phase, and it refuses when a dependency is not done. `--plan <file>` names the plan file of the run. It is required with `--done ticket`, and it lets the executor join the run. `--new` starts a new run in this worktree and keeps the old run folder. The command exits with `1` when a dependency, a start condition or a done check fails, and the message names each missing phase or part.
   - `cstack plan status [--json]` (#16). It prints one line per unit. The status comes from the commits that carry `Cstack-Unit: <n>`, so a unit is either done, with its short commit hashes, or not done. The line also says "blocked" when the unit has a `Blocked` line, and whether a failing or a passing test run is saved. `--json` prints the same as JSON. The command exits with `1` when a commit of the branch names a unit that the plan does not have.
   - `cstack plan section <name>` (#16). It prints exactly one section, heading included, up to the next heading of the same or a higher level. A heading matches when its text equals the name, or when the name is followed by `:`, ` (` or ` —`. So `Unit 3` matches `### Unit 3: Parse the header` and not `### Unit 30: …`, and `Decisions` does not match `### Decisions already taken upstream`. The command exits with `2` when no heading matches, and it lists the section names. It exits with `3` when two headings match.
   - `cstack report submit <kind>` (#16). The executor runs it as its last step, with the text of its report on standard input. The four allowed kinds are `done`, `needs-decision`, `failed` and `published`. It refuses `done` while a required section is not filled, a unit has no commit, a blocking question is open, `Ready for review at` is not set, or the plan file has uncommitted changes. It refuses `published` while `cstack publish` has recorded no pull request for the last push. It refuses `needs-decision` and `failed` when the text is empty. It saves each accepted report in the run state. The command exits with `1` when it refuses, including for any other kind, and the message lists the four allowed kinds. The same check also knows the two reports of an implementer, `done` and `stuck`, so that #27 can check every helper the same way.
   - `cstack report check` (#16). The main conversation runs it when the executor returns. It prints the kind and the text of the oldest accepted report not shown yet, and it marks that report shown. It exits with `1` when there is none. That means the executor stopped without an accepted report, so the main conversation launches it again with the same inputs.
   - `cstack unit order [--json]` (#18). It prints the units in batches. The units of one batch share no file, and each one depends only on units of earlier batches. The units of a batch can run in parallel, and the batches run one after the other. The command exits with `1` when the `Depends on` lines form a cycle.
   - `cstack unit red <n> [--timeout <minutes>]` (#17). It runs the test of unit `n`, requires a failure, and saves the run. It exits with `1` when the test passes or the unit has a `No test` line. It exits with `5` when the test command cannot start or runs past the timeout.
   - `cstack unit green <n> [--timeout <minutes>]` (#17). It refuses a unit that has no saved failing run. Otherwise it runs the same test, requires success, and saves the run. It exits with `1` when no failing run is saved or the test still fails. It exits with `5` in the same cases as `cstack unit red`.
   - `cstack unit commit <n>` (#18). It stages only the files of unit `n`, and it commits them with the unit's commit message and the trailer `Cstack-Unit: <n>`. It exits with `1` when it refuses, and the message gives every reason. It exits with `5` when `git commit` fails, for example because of a commit hook.
   - `cstack graph ensure` (#19). It compares the code graph with the current branch and commit, and it runs `graphify update .` when they differ. It exits with `4` when Graphify is missing, and it prints the install command. It exits with `5` when the update fails.
   - `cstack publish [--timeout <minutes>] [--poll <seconds>] [--grace <seconds>]` (#20). It checks that the plan allows publishing, brings the branch up to date, pushes once, opens the pull request, and waits for the checks of the pushed commit. It exits with `1` when it refuses before any push, and with `4` when no logged-in forge client serves the remote. It exits with `5` when the push or a forge call fails. It exits with `6` when a check failed on the pushed commit, and with `7` when checks still run at the timeout. It exits with `8` when the update onto the target branch conflicts, after it has put the branch back as it was.
8. **Add the CI test that keeps the skills and the guides in line with the command list.** The test reads every file under `cstack/skills/` and `cstack/guides/`. Inside inline code and fenced code blocks, it finds each `cstack` followed by a word. The fixed words of an entry are the words of its usage line before the first `<` or `[`. A mention matches an entry when it starts with the entry's fixed words. Each flag of the mention must also be a flag of that entry. The test fails with the file and the line when a mention matches no entry. It ignores the word cstack in plain prose.
9. **Write ADR-SIC-B** in `docs/decisions/ADR-SIC-B-run-state.md`. It weighs three options. The run state can live in a header of the plan file, in a separate state file, or in both.
   - The ADR records the choice of both, split by who reads the data. The plan file keeps what people read and what must travel with the branch. That means the format version, the two timestamps, the units with their files, and the blocking questions. The unit status is not written anywhere, because it comes from the commits.
   - The run state keeps what only cstack needs, under the common git folder, with its own format version `cstack-run/1`.
   - The ADR gives four reasons. The plan file stays readable. Test output never enters the repository. Parallel units write separate files. Every worktree of the repository sees the same run.
   - The ADR also gives the cost. When someone deletes the clone, the saved test runs and the phase marks are lost. Only the planning phases come back, from `Approved at`.
   - Link the ADR to this ticket and to the specification.

## Acceptance (TDD)

* `cstack/test/plan/read.test.ts`: write first the case of a plan file with `Format: cstack-plan/2` and `Written by: cstack 9.0.0`. It must be refused. The message must say that this cstack reads `cstack-plan/1` and that cstack 9.0.0 can read the file (US-6 AC3). Then a plan file with no `Format` line is refused with the message about the prose skill.
* `cstack/test/plan/read.test.ts`: each example file of `cstack/test/fixtures/plans/` gives its expected result. The valid files give their units, files, test lines, questions and timestamps. Each broken file fails with its line number and its rule. A line that starts with `#` inside a fenced code block of the ticket is not read as a heading.
* `cstack/test/plan/commits.test.ts`: in a temporary git repository, a commit with `Cstack-Unit: 2` on the target branch is ignored. The same trailer on the current branch is found. A commit without a trailer is ignored.
* `cstack/test/phases.test.ts`: write first a phase list in which `briefing` does not depend on `document`, and check that the test fails. Then the real list passes. Every dependency names a known phase, the order respects every dependency, there is no cycle, and every name is a valid file name.
* `cstack/test/template.test.ts`: the header keys and the level-2 headings of `cstack/skills/resolve-issue/templates/plan.md` are exactly the ones the reader expects, in the same order.
* `cstack/test/run-state.test.ts`: the run folder is the same from the main worktree and from a linked worktree, while the `current-run` file is different in each. A state file whose `format` is `cstack-run/2` is refused with exit code 3, and the message names the cstack version that wrote it.
* `cstack/test/manifest.test.ts`: write first a fixture guide that names `cstack frobnicate`, and check that the test fails with the file and the line. Then the real folders pass. `cstack unit red 3` matches the entry `cstack unit red <n>`. `cstack next --finish plan` fails, because `--finish` is not a flag of `cstack next`. The word cstack in plain prose is ignored. The list holds the four commands of milestone 1 with their flags, and every entry names the file under `cstack/src/commands/` that implements it, or will implement it.
* A reviewer finds `docs/decisions/ADR-SIC-B-run-state.md` with the three options, the choice, the reasons and the cost.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* The reader refuses a unit path that starts with `/` or `-`, holds a `..` part, or holds a character outside the allowed set, such as `;`, `$` or a space. So a path taken from a plan can never become a command option, a piece of shell, or a file outside the repository.

**Size: M** · Blocked by: #7 · Feeds: #15, #16, #17, #18, #19, #20, #21, #22, #23, #24

---

## CTO review — The plan file format is a one-way door, so it carries its version and changes two habits of today's skill on purpose (2026-11-17)

1. Every plan file written after this ticket uses `cstack-plan/1`, and every command of #15 to #20 reads it. Changing the format later means a new version number and a reader for the old one. So the reader refuses an unknown version and names the cstack version that can read it, and ADR-SIC-B records why the run state lives where it does.
2. The briefing now runs after the documentation step, which reverses today's order. US-6 AC2 asks for this, so that the briefing can say where the work was documented. The guides of #22 follow the new order.
3. The ticket is still copied into the plan word for word, but its headings move down one level, under `## Ticket`. This keeps the settled rule "copy the ticket verbatim" for its words, and it lets the reader find the plan's own sections without any confusion with the ticket's.


### Ticket comments

Comment by the maintainer on 2026-11-17:

Ticket #7 is done. Here is what you build on.

A command is a function that prints through an `io` argument and returns its exit code. The top-level function is `run(args, io)` in `cstack/src/cli.ts`. It reads only the command name and `--version`. Today every command name is unknown, so you add the lookup there when you create `cstack/src/manifest.ts`. Each command gets its own file in `cstack/src/commands/` and parses its own options. Exit code 2 means a usage error and exit code 1 means a crash. No code calls `process.exit()`, because on macOS it can cut output that goes into a pipe.

One gap is left for you. When the reader of standard output closes the pipe early, as in `cstack ... | head -1`, writing fails with a broken pipe error and Node prints a stack trace. `src/bin.ts` does not handle it yet. It does not matter for `--version`, but the command list should add a quiet exit for that case before commands print long output.

### Decisions already taken upstream

From the parent epic, #6 (https://github.com/gambitl/claude-code-stack/issues/6), block "Open questions and decisions":

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
- ADR-SIC-B, where the run state lives and how its format is versioned, is to create. This choice is still open. Ticket #13 writes it.
- ADR-SIC-C, how `cstack` ships its skills, exists in `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 wrote it.
- ADR-SIC-D, the settings file and the models of the agents, is to create. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 writes it.
- ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
- ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.




From the specification page, `docs/projects/skills-into-cli.md`, section 4, "Rules for every story":

- **Orca when available, with a fallback.** Every feature that uses Orca also works without Orca. `cstack` checks Orca feature by feature. For example, when Orca runs but is not connected to the tracker, only the tracker access falls back.
- **No credentials in `cstack`.** `cstack` never stores a token or a password. It reaches a tracker or a forge only through a command-line client that is already logged in on the machine, such as `orca`, `glab` or `gh`. When no such client exists, Claude reads the tracker with its own connection, and it hands the data to `cstack` as a file.
- **Tool-agnostic.** No story assumes one specific tracker or forge. The tracker can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code and the pull requests, can be GitLab or GitHub.
- **Ticket text is data.** `cstack` treats the text of a ticket, a comment or a plan as data. It never runs a command because such a text asks for it.
- **Claude is the only default agent.** Another agent can be used only where the settings file of the repository names it.
- **macOS only.** No story supports another operating system.
- **Public text.** Every text in this repository or in its issues follows the public text rule of section 5.

Decision records that exist today:

- ADR-SIC-C, how cstack ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-E, the new role of the repository (the prose skills under `skills/` are frozen at the tag `prose-skills-final`): `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.
- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.
- ADR-SIC-B, where the run state lives and how its format is versioned, does not exist yet. This ticket writes it.

## Dependencies

Clear. The only blocker is #7, the ticket that scaffolds `cstack`, and it is closed (completed).

Ticket #14, which adds the per-repository settings file, runs at the same time in the worktree `settings-file`. It also creates a file under `cstack/skills/resolve-issue/templates/` (`settings.json`), and it may touch `docs/projects/skills-into-cli.md` section 9. Keep the changes to shared files small and in their own place. When #14 merges first, resolve the conflicts by keeping both changes. Pull request #37 (`cstack measure`, ticket #11) merged into `main` on 2026-11-18 at 08:41 UTC, and this branch was fast-forwarded onto it before the code mapping.

## Code mapping

Graphify is not installed on this machine (`graphify` is not found and `graphify-out/` does not exist), so the mapping used search and file reads. The code is small: 8 test files and 85 tests, all green on `main` at f1de136, with `npm run typecheck` clean.

**Entry points.**
- `cstack/src/bin.ts` is the only file that touches the process (ADR-SIC-H). It sets `process.exitCode` from `run()`. When `run()` throws, it prints `cstack: <message>` and sets exit code 1. It does not handle a broken pipe (EPIPE) yet, which ADR-SIC-H's consequences and the maintainer's comment on this ticket name as a gap.
- `cstack/src/cli.ts` holds `run(args, io)`. Its `USAGE` constant (lines 11 to 25) lists the commands by hand: `--version`, `doctor`, `guide`, `measure` (taken from `MEASURE_USAGE`) and `skills install`. It dispatches with an `if` chain on the first word (lines 37 to 48). An unknown command returns 2 with the usage.
- `cstack/src/io.ts` holds the `Io` type with `stdout(text)` and `stderr(text)`.

**The four commands of milestone 1, as the code on `main` has them.**
- `cstack doctor` (`cstack/src/commands/doctor.ts`): no argument; `cli.ts` refuses any argument with code 2. Exit 0 when every required item is present, 1 otherwise.
- `cstack guide <phase> [--skill <name>]` (`cstack/src/commands/guide.ts`): `NAME = /^[a-z0-9][a-z0-9-]*$/` checks the phase and the skill. Usage errors return 2. An unknown skill or phase returns 1 and lists the known ones. It prints `guides/<skill>/<phase>.md` of the package root.
- `cstack measure <plan file> [--home <folder>]` (`cstack/src/commands/measure.ts`, `MEASURE_USAGE`): the `--home` flag is not in the ticket's list, but the code has it. Usage errors return 2. A plan file that cannot be used, a missing moment or incomplete numbers return 1. `cstack/src/measure/moments.ts` refuses a plan file whose header has a `Format` line, and reads `Status` from each commit of the plan file.
- `cstack skills install [--adopt <name>]...` (`cstack/src/commands/skills.ts`): `--adopt` can repeat. Usage errors return 2. Exit 1 when a shipped skill was skipped or when it runs as root. It copies every folder under `cstack/skills/` into `~/.claude/skills/<name>/` with the marker `.cstack-managed`.

**Patterns to follow.**
- Each command parses its own options with `node:util` `parseArgs` in strict mode, prints through `io`, and returns its exit code. No code calls `process.exit()`.
- Tests use vitest, call `run()` or the command function with a collecting `Io`, and build temporary folders with `mkdtempSync(join(tmpdir(), ...))`. Git tests in `cstack/test/measure.test.ts` create temporary repositories.
- Errors whose text must not leak file content use a class with fixed sentences (`MomentsError` in `moments.ts`).
- Git calls go through `execFile` with an argument array, never a shell (`moments.ts` lines 9 to 15).

**What this ticket adds, and what reads it later.**
- `cstack/skills/resolve-issue/` does not exist yet. Ticket #14 creates `cstack/skills/resolve-issue/templates/settings.json` in parallel. `cstack skills install` ships every folder under `cstack/skills/`, so a release cut before the entry skill of #21 would install a `resolve-issue` folder that holds only templates. Releases run only on a `v*` tag (`.github/workflows/release.yml`).
- `cstack/test/pack.test.ts` checks that `npm pack` lists the example skill and guide. It does not forbid new folders.
- The CI workflow (`.github/workflows/ci.yml`) runs `npm ci`, `npm run typecheck`, `npm test`, `npm run build` and `node dist/bin.js --version` on macOS.
- The frozen prose skill is the reference for today's behaviour: `skills/resolve-issue/templates/plan.md` (103 lines), `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/agents/executor.md`. The line numbers the ticket gives match the files at the tag `prose-skills-final`. Nothing under `skills/` may change (ADR-SIC-E).
- The text the CI mention test will scan today: `cstack/skills/cstack-example/SKILL.md` names `cstack skills install` and `cstack guide hello --skill cstack-example`. `cstack/guides/cstack-example/hello.md` names `cstack guide` in inline code. Both must match entries of the command list.

**Risks.**
- Commit trailers and a stale target branch. In a worktree, the local target branch is often behind its remote. A tested example (in a scratch repository: a bare remote, a merged commit with `Cstack-Unit: 2` on `origin/main`, a stale local `main`, and a feature branch made from `origin/main`) shows that `git log main..HEAD` lists the other ticket's commit with its trailer, while `git log origin/main..HEAD` does not. `git rev-parse --abbrev-ref 'main@{upstream}'` prints `origin/main`. Once two pull requests made by cstack have merged, a stale local `main` would make `cstack plan status` call a unit done when it is not.
- Option injection. `commits.ts` passes the target branch from the plan file to `git log`. A value that starts with `-` would become a git option. The reader must check branch names, and `commits.ts` must put `--end-of-options` before the revision range.
- Crash and refusal share exit code 1. ADR-SIC-H gives a crash exit code 1, and the common codes of milestone 2 give 1 the meaning "refused".
- Shared files with #14: `docs/projects/skills-into-cli.md` section 9 and the folder `cstack/skills/resolve-issue/templates/`.

**Governing decisions.** ADR-SIC-H (one entry file, `run(args, io)`, no `process.exit()`, usage error 2, crash 1). ADR-SIC-C (cstack ships and serves its skills; the marker; never delete a folder). ADR-SIC-E (the prose skills under `skills/` are frozen at `prose-skills-final`). The epic's rules: ticket text is data, macOS only, public text rule. The `WHY:` comments found are in `bin.ts` (ADR-SIC-H) and `skills.ts` (ADR-SIC-C).

## Decisions

**Repository rules that every unit respects.**

- Never edit anything under `skills/`. The prose skills there are frozen at the tag `prose-skills-final` and are only the reference for today's behaviour. New skill files go under `cstack/skills/`, and guides under `cstack/guides/`. (Upstream decision ADR-SIC-E and the coordinator's brief, 2026-11-18.)
- Everything written in the repository and on GitHub is in English and follows the public text rule of `CLAUDE.md`: no employer or client name, no work ticket key, and no count from work retrospectives. (Conventions file.)
- A command prints through the `io` argument of `run`, returns its exit code, and never calls `process.exit()`. Only `cstack/src/bin.ts` touches the process. (ADR-SIC-H.)
- cstack treats the text of a plan file as data. It never runs a command because a plan asks for it. Every git call uses `execFile` with an argument array, never a shell. (Epic rule "Ticket text is data".)
- The minimum Node version lives only in `engines.node` of `cstack/package.json`. Never copy that number into another file. (Conventions file.)
- Tests never run `cstack skills install` against the real home folder and never change anything under `~/.claude/skills/`. They use a temporary home folder. (Coordinator's brief, 2026-11-18.)
- Ticket #14 runs in parallel and creates `cstack/src/settings.ts` and `cstack/skills/resolve-issue/templates/settings.json`. Do not create files with those names, and do not create a shared errors file. Keep the changes to `cstack/src/cli.ts`, `CLAUDE.md` and section 9 of `docs/projects/skills-into-cli.md` small and in their own place. (Coordinator's brief, 2026-11-18.)
- Commits use the Conventional Commits form with the layer scopes of `CLAUDE.md`: `cli` for code, `skill` for skill prose and templates, `tests` for test-only changes, and no scope for `docs`. (Conventions file and the history of `main`.)
- When the branch is brought up to date with `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. (Coordinator's brief, 2026-11-18.)
- Never change `user.email` in the git config. Before the push, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`. Then write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, and run `python3 scripts/private_names.py check <that file>`. It must exit 0. Never print the private list. (Coordinator's brief, 2026-11-18.)
- Never merge the pull request. When the `cstack` check is cancelled with "The job was not acquired by Runner", rerun it with `gh run rerun <run id>`. (Coordinator's brief, 2026-11-18.)
- Do not tag a `v*` release before the entry skill of #21 merges, because `cstack skills install` would ship a `resolve-issue` folder that holds only templates. The pull request body says so. (Accepted by default, 2026-11-18.)

**Exit codes and the command list (`cstack/src/manifest.ts`).**

- `manifest.ts` exports the common exit codes as named constants: 0 the command did its job, 1 refused, 2 usage error, 3 invalid input, 4 missing tool, 5 a tool failed. Codes 6 and above belong to one command, and that command's entry lists them. (Ticket scope 7.)
- A crash keeps exit code 1, as ADR-SIC-H decided. The command list says that a crash also exits with 1 and prints one line that starts with `cstack:` and names no rule. (Accepted by default, 2026-11-18.)
- The errors of the plan reader (`PlanFormatError`) and of the run state (`RunStateError`) carry the field `exitCode` set to 3. Their messages never hold a stack trace. (Assumption not asked, 2026-11-18.)
- Each entry gives its usage line, a one-sentence summary, its flags in long form, its exit codes with their meaning, the file under `cstack/src/commands/` that implements it or will implement it, the ticket that builds it, and whether it is built in this version. The command words of an entry are the words of its usage line before the first `<` or `[`. (Ticket scope 7.)
- The four entries of milestone 1 match the code on `main` and keep their exit codes. They are `cstack doctor` (no argument; exit 0, 1 or 2; `doctor.ts`), `cstack guide <phase> [--skill <name>]` (exit 0, 1 for an unknown skill or phase, 2; `guide.ts`), `cstack measure <plan file> [--home <folder>]` (exit 0, 1 or 2; `measure.ts`) and `cstack skills install [--adopt <name>]...` (exit 0, 1 when a skill was skipped or the user is root, 2; `skills.ts`). They are built. (Ticket scope 7; the `--home` flag is an assumption not asked, because the code on `main` has it, 2026-11-18.)
- The eleven entries of milestone 2 are the commands of ticket scope 7, with exactly the flags and exit codes written there, and they are not built. Every one of them except `cstack graph ensure` also takes `--plan <file>`. Their files are named after the full command words: `next.ts`, `plan-status.ts`, `plan-section.ts`, `report-submit.ts`, `report-check.ts`, `unit-order.ts`, `unit-red.ts`, `unit-green.ts`, `unit-commit.ts`, `graph-ensure.ts` and `publish.ts`, all under `cstack/src/commands/`. One file per command lets #15 to #20 work in parallel without editing the same file. (Ticket scope 7; the file names are an assumption not asked, 2026-11-18.)
- `--version` stays a global option of `cli.ts`. It is not an entry of the command list. (Assumption not asked, 2026-11-18.)
- `cli.ts` takes its usage text from the built entries only, and the usage still starts with `Usage: cstack`. A first word that no entry has gives `unknown command` and exit code 2. A first word whose entries are all not built answers that the command is not built in this version yet, with exit code 2. The calls to the built commands stay in `cli.ts`, in a record keyed by the first word. A test checks that every built entry has a handler and that every handler has a built entry. (Accepted by default, 2026-11-18.)
- A test gives each built command an unknown flag and checks that its usage error contains its usage line from the command list, so the list and the commands cannot drift apart. (Assumption not asked, 2026-11-18.)

**The check that keeps skills and guides in line with the command list.**

- The test reads every file under `cstack/skills/` and `cstack/guides/`, and looks only inside inline code spans and fenced code blocks. Plain prose is ignored. (Ticket scope 8.)
- A mention is the whole word `cstack` followed by one space and a word made of lowercase letters, digits and `-`. So `cstack/src`, `gambitl-cstack-<version>.tgz`, `cstack-plan/1` and `` `cstack` `` alone are not mentions. (Assumption not asked, 2026-11-18.)
- A mention runs to the end of its code span or line, or to the first `|`, `;`, `&`, `>`, `)` or ` #`. Its words are the tokens before the first token that starts with `-`. Its flags are the tokens that start with `-`, cut at the first `=`. (Assumption not asked, 2026-11-18.)
- A mention matches an entry when its first words equal the entry's command words, word by word, and the entry with the most command words wins. Each flag of the mention must be a flag of that entry. A failure names the file, the line and the mention. (Ticket scope 8.)
- The matching function `matchMention` lives in `manifest.ts`. The file scan lives in `cstack/test/manifest.test.ts`. The fixture guide that names `cstack frobnicate` lives in `cstack/test/fixtures/manifest/`. (Assumption not asked, 2026-11-18.)

**The plan file format `cstack-plan/1` and its reader (`cstack/src/plan/read.ts`).**

- The first line is the title, `# Plan: <ticket id> — <ticket title>`. The header keys come right after it, one per line, in this order: Format, Written by, Date, Ticket, Tracker, Documentation tool, Branch, Target branch, Conversation language, Status, Approved at, Ready for review at. Blank lines and HTML comments may follow them. Any other line before the first level-2 heading is an error. (Ticket scope 1.)
- `Written by` holds `cstack <version>` or `not yet`. The template writes `not yet`, and cstack writes its version when it registers the plan file. (Assumption not asked, 2026-11-18.)
- `Date` holds `YYYY-MM-DD`. `Status` holds one of: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. `Approved at` and `Ready for review at` hold `YYYY-MM-DDTHH:MM:SS±HH:MM` or `not yet`. (Ticket scope 1; the offset-only form is an assumption not asked, because cstack is the only writer, 2026-11-18.)
- `Branch` and `Target branch` hold a git branch name made of ASCII letters, digits, `.`, `_`, `-`, `/` and `+`. It never starts with `-`, `/` or `.`. It never ends with `/`, `.` or `.lock`. It never holds `..` or `//`. The reader exports this check as `isBranchName`. (Assumption not asked, to stop option injection, 2026-11-18.)
- Every other header value is not empty and is not a placeholder, which is a value that starts with `<` and ends with `>`. (Assumption not asked, 2026-11-18.)
- The reader checks `Format` first. With no `Format` line, it stops at once. Its message says that the prose skill wrote the file before cstack existed, and that this cstack reads `cstack-plan/1`. (Ticket scope 2.)
- With another format version, it also stops at once. Its message names `cstack-plan/1` as the version this cstack reads. It names the cstack version of the `Written by` line as the one that can read the file, or says that the file does not name one. (Ticket scope 2, US-6 AC3.)
- Otherwise the reader lists every problem of the file, each with its line number and the rule the line breaks. (Assumption not asked, 2026-11-18.)
- Headings follow the ATX rules of CommonMark. A heading has up to three leading spaces, one to six `#`, then a space or the end of the line, and optional closing `#` signs. A line indented by four spaces or more is never a heading. (Accepted by default, 2026-11-18.)
- A fenced code block opens with three or more backticks or tildes, after up to three spaces. It closes with the same character repeated at least as many times and nothing else on the line. Lines inside it are never headings. A fence that never closes is an error that names the line where it opened. (Ticket scope 2; the unclosed fence error was accepted by default, 2026-11-18.)
- Lines inside a multi-line HTML comment, from `<!--` to `-->`, are never headings. (Assumption not asked, 2026-11-18.)
- The only level-1 heading is the title. The level-2 headings are exactly Ticket, Dependencies, Code mapping, Decisions, Architecture, Implementation units, Documentation duties, Blocking questions, Review log, Briefing, Non-blocking questions, Pull request, Documentation, Executor notes, Hand-off log and History, each once and in this order. The reader exports this list as `SECTION_NAMES`, and the header keys as `HEADER_KEYS`. (Ticket scope 1.)
- The ticket is copied word for word under `## Ticket`, with each of its headings moved down one level. `### Decisions already taken upstream` follows it. (Ticket scope 1 and the ticket's CTO review block.)
- A section is filled when it holds at least one line that is not blank, not an HTML comment, and not a placeholder line. A placeholder line starts with `<` and ends with `>` once trimmed. Headings below level 2 count as content. (Ticket scope 1.)
- The reader returns the header values, every section with its first and last line (1-based, inclusive) and whether it is filled, every heading with its level and line, the units, the blocking questions, and the pull request title and body. (Ticket scope 2; the heading levels were accepted by default, 2026-11-18.)
- The sections that a done report needs filled are Ticket, Dependencies, Code mapping, Decisions, Architecture, Implementation units, Documentation duties, Blocking questions, Review log, Briefing, Non-blocking questions, Pull request, Documentation and Executor notes. The reader exports this list. (Ticket scope 1.)

**Units in the plan file.**

- Under `## Implementation units`, every level-3 heading is `### Unit <n>: <name>`, numbered from 1 with no gap. The heading carries no status. (Ticket scope 1.)
- The lines after the heading come in this order. `- Files:` lists one or more paths in backticks, separated by `, `. Then comes `- Test: `<test file>`: <failing case>` or `- No test: <reason>`. Then come `- Minimum code:`, `- Refactor:`, `- Commit message:` on one line only, and `- Depends on:`, which holds unit numbers separated by `, ` or the word `none`. (Ticket scope 1.)
- After `Depends on`, the optional lines `- Design specification:` and `- Blocked: <reason>` may follow, in this order. Free notes come after them. (Ticket scope 1.)
- Before `Depends on`, a blank line or a line that starts with two spaces or more continues the field above it, except after `Commit message`. Any other line is an error. (Assumption not asked, 2026-11-18.)
- The test file of a `Test` line also appears in `Files`. A `Depends on` line names only units that exist, and never the unit itself. Cycles are left to #18. (Ticket scope 1; the existence check is an assumption not asked, 2026-11-18.)
- A unit path is relative to the repository root. It holds only ASCII letters, digits and `.`, `_`, `-`, `/`, `@`, `+`. It never starts with `/` or `-`, never ends with `/`, and has no empty, `.` or `..` part. (Ticket scope 1; ASCII only and the empty or `.` parts are assumptions not asked, 2026-11-18.)
- Each unit commit carries the trailer `Cstack-Unit: <n>` in the final paragraph of its message, together with any other trailer such as `Co-Authored-By`. git does not read a trailer outside the final paragraph. A commit with two `Cstack-Unit` lines counts for both units. The template says this in its comment on units. (Tested answer, accepted by default, 2026-11-18.)

**Questions and the pull request in the plan file.**

- `## Blocking questions` holds either the single word `none`, or questions with the heading `### Question <n>: <a few words>`, numbered from 1 with no gap. Each question has its text word for word, then `- For: <who can answer it>`, then `- Answer: <the answer, its source and its date>` or `- Answer: open`. A missing `For` or `Answer` line is an error, and so is `none` next to a question. The section holds every blocking question of the run, from the question round and from after the build. (Ticket scope 1.)
- In the History part, `### Open questions and answers` keeps each question of the question round with its label and its recommendation. The text and the answer of a blocking question live only under `## Blocking questions`, and History refers to them as "Blocking question <n>". (Assumption not asked, 2026-11-18.)
- `## Non-blocking questions` replaces "Open questions after the build". It holds the questions that go into the pull request body, each with who it is for, or the word `none`. (Ticket scope 1.)
- `## Pull request`, once filled, holds a line `Title: <title>`, then a fenced block that opens with exactly four backticks and the word `markdown` and closes with four backticks. The reader returns the title and the lines between the fences as the body. (Ticket scope 1.)

**The template (`cstack/skills/resolve-issue/templates/plan.md`).**

- It starts from `skills/resolve-issue/templates/plan.md` at `prose-skills-final`, keeps its sections and wording, and makes only the changes of ticket scope 1 and these decisions. (Ticket scope 1.)
- The `Status` line holds `draft`, and an HTML comment lists the allowed values. `Approved at` and `Ready for review at` hold `not yet`. (Assumption not asked, 2026-11-18.)
- The placeholder of `Conversation language` says that the conversation uses the user's language and that every record uses `recordsLanguage` of `.cstack/settings.json`, which is English by default. (Ticket scope 1; the key name comes from ticket #14.)
- The placeholders name the new phases, such as `code-map`, `plan` or `after-build-questions`, instead of today's phase numbers. (Assumption not asked, 2026-11-18.)
- `## Implementation units` holds no `### Unit` heading. An HTML comment describes the unit format, so that a plan file read before the `plan` phase has no broken unit. (Assumption not asked, 2026-11-18.)
- Every `cstack` command that the template names in code must match an entry of the command list, because the mention check scans it. (Ticket scope 8.)

**The commit trailer reader (`cstack/src/plan/commits.ts`).**

- It compares HEAD with the upstream of the target branch (`<target>@{upstream}`, usually `origin/main`) when the target branch has one, and with the local target branch otherwise. It runs `git log` with `--end-of-options` before the range `<base>..HEAD`, and reads the `Cstack-Unit` trailers with the trailer format of `git log`. (User's answer, 2026-11-18, after a tested answer.)
- It returns, for each unit number, the commits that name it. A trailer value that is not a positive whole number is returned in a separate list of invalid values. (Ticket scope 3; the invalid list is an assumption not asked, 2026-11-18.)
- It checks the target branch with `isBranchName` before any git call. A bad name or a target branch that does not exist is an error with exit code 3. (Assumption not asked, 2026-11-18.)

**The phase list (`cstack/src/phases.ts`).**

- It holds the fifteen phases of ticket scope 5, in that order, each with its name, the phase of today's skill it replaces, where it runs (main conversation or executor), its dependencies, and an optional start condition and done check. The guide of a phase is `cstack/guides/resolve-issue/<phase>.md`. A phase name matches `^[a-z0-9][a-z0-9-]*$`. (Ticket scope 5.)
- `briefing` depends on `document`, so the briefing runs after the documentation. (Ticket's CTO review block and US-6 AC2.)
- Start conditions and done checks are pure functions over a context. The context holds the parsed plan, the commits of each unit, the done time of each phase, and the time of the last accepted done report. Each check returns the list of missing parts, which is empty when it passes. (Assumption not asked, 2026-11-18.)
- What cstack writes when a phase is done is described as data, and #15 performs the writes. `ticket` registers the run and writes `Written by`. `plan` writes `Approved at`. `ready` writes Status `ready for review` and `Ready for review at`. (Ticket scope 5; the split with #15 is an assumption not asked, 2026-11-18.)
- The `plan` done check passes when Status is `approved`, no blocking question is open, and the plan has at least one unit. The reader already refuses an incomplete unit. (Ticket scope 5; "at least one unit" is an assumption not asked, 2026-11-18.)
- `build` has a done check: every unit without a `Blocked` line has at least one commit with its trailer. (Accepted by default, 2026-11-18.)
- `retro` can be marked done again, and each time its done time is overwritten. `publish` has a start condition: the done time of `retro` is later than the time of the last accepted done report. (Accepted by default, 2026-11-18.)
- `phases.ts` exports `PLANNING_PHASES`, the five phases that run before approval: `ticket`, `dependencies`, `code-map`, `questions` and `plan`. (Assumption not asked, 2026-11-18.)

**The run state (`cstack/src/run-state.ts`).**

- It finds the git folders with `git rev-parse --path-format=absolute --git-dir --git-common-dir`, so that it works from a subfolder and from a linked worktree. (Tested answer, accepted by default, 2026-11-18.)
- The run folder is `<common git folder>/cstack/runs/<plan file name without .md>/`. The file `<worktree git folder>/cstack/current-run` holds the plan file name of the run this worktree works on. (Ticket scope 6.)
- The plan file name ends with `.md`, and the name without `.md` matches `^[A-Za-z0-9][A-Za-z0-9._-]*$`. Any other name is an error with exit code 3. (Assumption not asked, 2026-11-18.)
- `state.json` holds `format` (`cstack-run/1`), `writtenBy` (the cstack version), `plan` (the plan file path from the repository root) and `phases`. For each phase name, `phases` holds `startedAt` and `doneAt` as ISO times. (Ticket scope 6.)
- A state file with another `format` is refused with exit code 3, and the message names the cstack version in its `writtenBy`. (Ticket scope 6.)
- Every file is written whole through a temporary file in the same folder and a rename. Only `cstack next` writes `state.json`. (Ticket scope 6; the same folder is a tested answer, 2026-11-18.)
- Creating a run for a plan whose `Approved at` is set marks the five planning phases done at that time. Creating a run that already exists reads it and keeps it. (Ticket scope 6; keeping an existing run is an assumption not asked, 2026-11-18.)
- `run-state.ts` exports the paths and the JSON types of the other run files. A saved test run (`units/<n>/red.json` with `red.log`, `units/<n>/green.json` with `green.log`) has its time, command, exit code, commit and test file. A report (`reports/<time>-<kind>.json`) has its kind, text, time and `readAt`. `publish.json` has the pull request link, each push with its commit and time, and the result of the checks on the last push. The code that writes these files belongs to #15 to #20. (Ticket scope 6; the split is an assumption not asked, 2026-11-18.)
- The freshness stamp of the code graph is not run state. #19 keeps it in `<worktree git folder>/cstack/graph.json`. (Ticket scope 6.)

**The broken pipe.**

- `cstack/src/bin.ts` registers an `error` listener on `process.stdout` before it calls `run`. The listener ignores `EPIPE`, rethrows any other error, and keeps the command's exit code. It is a small exported function in `cstack/src/io.ts`, so that a test can call it. (Maintainer's comment on this ticket, 2026-11-17; accepted by default, 2026-11-18.)

**The decision record.**

- `docs/decisions/ADR-SIC-B-run-state.md` weighs three options: a header in the plan file, a separate state file, or both. It records the choice of both, split by who reads the data, with the four reasons and the cost of ticket scope 9. It also says how both formats are versioned: `cstack-plan/1` with `Written by`, `cstack-run/1` with `writtenBy`, and the refusal of an unknown version with the cstack version that can read it. It links this ticket and the specification. (Ticket scope 9.)

## Architecture

The approach is locked by the ticket and the answers of the question round, so there was no architecture choice to make. The ticket adds five modules to `cstack/src/`, each with its own test file: the command list (`manifest.ts`), the plan reader (`plan/read.ts`), the commit trailer reader (`plan/commits.ts`), the phase list (`phases.ts`) and the run state (`run-state.ts`). It also adds the plan template under `cstack/skills/resolve-issue/templates/`, the example plan files under `cstack/test/fixtures/plans/`, and ADR-SIC-B. The only changes to existing code are in `cli.ts`, which now reads the command list, and in `bin.ts` and `io.ts`, which end quietly on a broken pipe. The modules depend on each other in one direction: the phase list uses the plan reader's types, and the run state uses the phase list's `PLANNING_PHASES`.

The units run in five batches. Units 1, 3 and 4 share no file and can run in parallel. Units 2, 5, 6 and 7 come next and can run in parallel. Unit 8 follows, then unit 9, then unit 10.

**Security.** The plan file is external input, because a person or an agent writes it and a ticket's text lands in it. Units 4, 5 and 7 hold the negative tests: a unit path that could become an option, a piece of shell or a file outside the repository is refused; a branch name that starts with `-` is refused; and `git log` gets `--end-of-options` before the range. The change has no endpoint, no database query and no secret.

## Implementation units

### Unit 1: The command list, its exit codes and the mention check — status: done
- Files: `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/fixtures/manifest/guides/example/frobnicate.md`
- Failing test: In `cstack/test/manifest.test.ts`, write first the scan of the fixture folder `cstack/test/fixtures/manifest/`, whose guide names `cstack frobnicate` in inline code. Check that the scan reports that file and that line. Then add these cases. `cstack unit red 3` matches the entry `cstack unit red <n>`. `cstack next --finish plan` fails because `--finish` is not a flag of `cstack next`. `cstack guide hello --skill=cstack-example` matches. The word cstack in plain prose, `cstack/src/cli.ts`, `gambitl-cstack-<version>.tgz` and `cstack-plan/1` are not mentions. In `cstack plan status --json | jq --raw-output`, the mention stops at `|`. The list holds the four commands of milestone 1 with their flags and exit codes, and they are built. Every entry names a file under `cstack/src/commands/`, every built entry's file exists, and no two entries have the same command words. The real folders `cstack/skills/` and `cstack/guides/` pass.
- Minimum code: `manifest.ts` exports the exit code constants, the type of an entry, the fifteen entries (four built, eleven not built), a function that returns the command words of an entry, and `matchMention`. The test file scans the folders as the Decisions say.
- Refactor: none expected.
- Commit message: `feat(cli): add the command list of cstack with its common exit codes`
- Depends on: none

### Unit 2: The command line reads the command list — status: done
- Files: `cstack/src/cli.ts`, `cstack/test/cli.test.ts`
- Failing test: In `cstack/test/cli.test.ts`, write first the case `cstack next`. It must answer that the command is not built in this version yet, on standard error, with exit code 2. Then add these cases. The usage printed with no argument holds the usage line of every built entry and of no other entry. Every built entry has a handler in `cli.ts`, and every handler has a built entry. Each built command, given the unknown flag `--cstack-unknown-flag`, prints a usage error that contains its usage line from the command list. The existing tests of `cli.test.ts` still pass unchanged.
- Minimum code: `cli.ts` builds its usage text from the built entries of `manifest.ts`, replaces the `if` chain with a record of handlers keyed by the first word, and answers a not-built command as the Decisions say. It no longer imports `MEASURE_USAGE`.
- Refactor: none expected.
- Commit message: `feat(cli): find the commands and their usage in the command list`
- Depends on: 1

### Unit 3: End quietly when the reader of the output closes the pipe — status: done
- Files: `cstack/src/io.ts`, `cstack/src/bin.ts`, `cstack/test/io.test.ts`
- Failing test: In `cstack/test/io.test.ts`, write first the case of a stream that gets the listener and then emits an error with the code `EPIPE`. Nothing is thrown. Then a stream with the listener that emits an error with another code rethrows it.
- Minimum code: `io.ts` exports a function that adds this `error` listener to a writable stream. `bin.ts` calls it on `process.stdout` before it calls `run`, and keeps setting `process.exitCode` as today. Keep the `WHY: ADR-SIC-H` comment of `bin.ts`, and add one line that says why the listener exists.
- Refactor: none expected.
- Commit message: `fix(cli): end quietly when the reader of the output closes the pipe`
- Depends on: none

### Unit 4: Read the header and the sections of a plan file — status: done
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`, `cstack/test/fixtures/plans/`
- Failing test: In `cstack/test/plan/read.test.ts`, write first the case of a plan file with `Format: cstack-plan/2` and `Written by: cstack 9.0.0`. It is refused. The message says that this cstack reads `cstack-plan/1` and that cstack 9.0.0 can read the file. Then a plan file with no `Format` line is refused with the message about the prose skill. Then add example files under `cstack/test/fixtures/plans/` and their expected results. The valid file `ticket-with-code-block.md` has a ticket with a fenced block that holds a line starting with `#`, and that line is not read as a heading. Its header values, section ranges and filled flags come out as expected. Each broken file fails with its line number and its rule: a ticket heading left at level 2, two sections in the wrong order, a fence that never closes, an unknown Status, a malformed `Approved at`, a `Target branch` that starts with `-`, and a header value left as a placeholder. Also check `isBranchName` on good and bad names.
- Minimum code: `read.ts` exports `PLAN_FORMAT`, `HEADER_KEYS`, `SECTION_NAMES`, the list of sections a done report needs, `PlanFormatError` with `exitCode` 3 and its list of problems, `isBranchName`, and `readPlan(text)`. At this step it returns the header, the headings and the sections, with their ranges and filled flags.
- Refactor: none expected.
- Commit message: `feat(cli): read the header and the sections of a cstack-plan/1 file`
- Depends on: none

### Unit 5: Read the units, the blocking questions and the pull request of a plan file — status: done
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`, `cstack/test/fixtures/plans/`
- Failing test: In `cstack/test/plan/read.test.ts`, write first the valid file `approved.md`, a plan just after approval. It gives its units with their files, test lines, a `No test` reason and their `Depends on` lists. It gives its blocking questions, one open and one answered, and its two timestamps. Then add the valid file `ready-for-review.md`, with every section filled. Its pull request body holds an ordinary fenced code block and a line that starts with `## `, and the reader returns that title and body. Then add one broken file for each of these rules, each failing with its line number and its rule: a unit with neither `Test` nor `No test`, a test file missing from `Files`, a path with a `..` part, a path that starts with `/`, a path that starts with `-`, a path that holds `;`, `$` or a space, a gap in the unit numbers, a `Depends on` line that names a missing unit, a blocking question without an `Answer` line, `none` next to a question, and a pull request section without its four-backtick block.
- Minimum code: `readPlan` also returns the units, the blocking questions and the pull request, as the Decisions describe.
- Refactor: Split `read.ts` into small functions per part if it grows past about 400 lines, and keep `readPlan` as the one entry point.
- Commit message: `feat(cli): read the units, the blocking questions and the pull request of a plan file`
- Depends on: 4

### Unit 6: The plan template in the cstack-plan/1 format — status: done
- Files: `cstack/skills/resolve-issue/templates/plan.md`, `cstack/test/template.test.ts`
- Failing test: In `cstack/test/template.test.ts`, write first the check that the header keys of `cstack/skills/resolve-issue/templates/plan.md` equal `HEADER_KEYS`, in the same order. Then check that its level-2 headings equal `SECTION_NAMES`, in the same order. Check also that its `Format` line is `cstack-plan/1`, that `Written by`, `Approved at` and `Ready for review at` hold `not yet`, and that it has no `### Unit` heading.
- Minimum code: Write the template from `skills/resolve-issue/templates/plan.md` at `prose-skills-final`, with the changes of ticket scope 1 and of the Decisions. Do not edit the file under `skills/`.
- Refactor: none expected.
- Commit message: `feat(skill): add the plan template in the cstack-plan/1 format`
- Depends on: 1, 4

### Unit 7: List the commits of each unit from their trailer — status: done
- Files: `cstack/src/plan/commits.ts`, `cstack/test/plan/commits.test.ts`
- Failing test: In `cstack/test/plan/commits.test.ts`, write first, in a temporary git repository, a commit with `Cstack-Unit: 2` on the target branch, which is ignored. Then the same trailer on the current branch is found, and a commit without a trailer is ignored. Then add these cases. With a bare remote and a stale local `main`, the trailer of a commit that is on `origin/main` but not on the local `main` is ignored. A repository without a remote compares with the local branch. A `Cstack-Unit` line followed by a blank line and a `Co-Authored-By` paragraph is not found. A commit with two `Cstack-Unit` lines counts for both units. A trailer value `abc` comes back in the list of invalid values. A target branch named `--output=x` is refused with exit code 3 before any git call. A target branch that does not exist is refused with exit code 3.
- Minimum code: `commits.ts` exports one function that takes the repository folder and the target branch, and returns the commits of each unit and the invalid values, as the Decisions say.
- Refactor: none expected.
- Commit message: `feat(cli): list the commits of each unit from their Cstack-Unit trailer`
- Depends on: 4

### Unit 8: Fix the phase order with its checks — status: done
- Files: `cstack/src/phases.ts`, `cstack/test/phases.test.ts`
- Failing test: In `cstack/test/phases.test.ts`, write first a phase list in which `briefing` does not depend on `document`, and check that the check of the list fails. Then the real list passes. Every dependency names a known phase. The order respects every dependency. There is no cycle. Every name is a valid file name. The names, the order, the phases of today's skill, the places and the dependencies are exactly those of ticket scope 5. Then test the checks with the fixtures of unit 5. The `plan` done check fails while a blocking question is open, and passes on `approved.md`. The `build` done check fails for a unit without a commit and passes when that unit has a `Blocked` line. The `ready` done check needs Pull request and Executor notes. The `publish` start condition fails when `retro` was done before the last accepted done report, and passes when it was done after.
- Minimum code: `phases.ts` exports the phase type, the fifteen phases, `PLANNING_PHASES`, the context type of the checks, and a function that checks a phase list and returns its problems.
- Refactor: none expected.
- Commit message: `feat(cli): fix the phase order of the build loop with its checks`
- Depends on: 5, 7

### Unit 9: Keep the run state under the common git folder — status: done
- Files: `cstack/src/run-state.ts`, `cstack/test/run-state.test.ts`
- Failing test: In `cstack/test/run-state.test.ts`, write first, in a temporary repository with a linked worktree, the check that the run folder is the same from the main worktree, from a subfolder and from the linked worktree, while the `current-run` file is different in each. Then a state file whose `format` is `cstack-run/2` is refused with exit code 3, and the message names the cstack version that wrote it. Then add these cases. Creating a run for a plan whose `Approved at` is set marks the five planning phases done at that time. Creating a run that already exists keeps it. A write leaves no temporary file behind. A plan file name with a space or without `.md` is refused with exit code 3.
- Minimum code: `run-state.ts` exports `RUN_FORMAT`, `RunStateError` with `exitCode` 3, the paths, the reading and writing of `current-run` and `state.json`, the atomic write, the creation of a run, and the JSON types of the other run files, as the Decisions say.
- Refactor: none expected.
- Commit message: `feat(cli): keep the run state under the common git folder`
- Depends on: 8

### Unit 10: Write ADR-SIC-B and link it from the specification — status: done
- Files: `docs/decisions/ADR-SIC-B-run-state.md`, `docs/projects/skills-into-cli.md`
- No test: a decision record and one line of the specification are prose.
- Minimum code: Write the record in the shape of `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md` (Status, Ticket, Context, Options, Decision, Consequences), as the Decisions say. Add `WHY: ADR-SIC-B` comments at the top of `run-state.ts` and next to the format check of `read.ts`. In section 9 of `docs/projects/skills-into-cli.md`, change only the ADR-SIC-B line: it says that ticket #13 chose both, and it links the record the way the ADR-SIC-C line does.
- Refactor: none.
- Commit message: `docs: record where the run state lives and how its formats are versioned (ADR-SIC-B)`
- Depends on: 9

## Documentation duties

- ADR-SIC-B: applies, written to `docs/decisions/ADR-SIC-B-run-state.md` in unit 10, with `WHY: ADR-SIC-B` comments in `cstack/src/run-state.ts` and `cstack/src/plan/read.ts`.
- The specification page: applies, written to the ADR-SIC-B line of section 9 of `docs/projects/skills-into-cli.md` in unit 10.
- The epic #6: applies, written to the body of https://github.com/gambitl/claude-code-stack/issues/6. Its ADR-SIC-B line says that the choice is still open. It changes to say that the record exists, with its path.
- The comment on ticket #13: applies. It says what was built and what differs from the ticket: the upstream base of the commit reader, the quiet exit on a broken pipe, the not-built entries in `cli.ts`, the `build` done check, the `publish` start condition, and the one-file-per-command names.
- The comments on the dependent tickets: applies, written to #15, #16, #17, #18, #19, #20, #21, #22, #23 and #24. Each comment says which module of this ticket the dependent uses, and which decision touches it. #15 gets the phase list, the check context, the writes it performs, the run creation, the repeatable `retro` and how to mark an entry built. #16 gets the reader, the commit reader and the suggestion on heading collisions, word for word from the History part. #17 gets the `Test` line and the saved test run type. #18 gets the trailer rule of the final paragraph and the `Files` and `Depends on` lines. #19 gets its entry and `graph.json`. #20 gets `publish.json`, the `publish` start condition and the pull request section. #21 gets the template, `Written by: not yet` and the rule of no release before it merges. #22 gets the phase names, the guide paths and the mention check. #23 gets the two timestamps and the fact that `cstack measure` refuses a plan file with a `Format` line until then. #24 gets how to add a command to the list.
- The conventions file: applies, written to the "Commands" paragraph of `CLAUDE.md`. Add one sentence: every command has an entry in `cstack/src/manifest.ts`, which also defines the common exit codes.
- The README: does not apply. No new command can be run, and the four commands of milestone 1 do not change.

## Review log

### Impact notes (phase 7)

Graphify is not installed, so these notes come from search and git history. Existing code that the branch changed: `run` in `cstack/src/cli.ts` (callers: `bin.ts`, `test/cli.test.ts`, `test/guide.test.ts`, `test/measure.test.ts`), `cstack/src/bin.ts`, `cstack/src/io.ts` (user: `commands/version.ts`), and one line of `test/skills-install.test.ts`. The usual companions of `cli.ts` are `test/cli.test.ts` (changed) and the measure files (`commands/measure.ts` still exports `MEASURE_USAGE`, which `cli.ts` no longer imports, and its own tests still pass). `cstack measure` refuses a plan with a `Format` line until #23, which is the planned behaviour. The full suite passed on the branch head with 187 tests and a clean typecheck.

<phase 7 findings and fixes; phase 8 independent review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Open questions after the build

### Blocking

<none yet>

### Non-blocking

<none yet>

## Pull request

<phase 10.4>

## Documentation

<phase 10.3>

## Executor notes

<executor, before its report>

## Hand-off log

- 2026-11-18 run 1, phase 6: GitHub has no in-progress state for issue #13 (no project board, only labels), so the ticket stays open and nothing was changed in the tracker. Branch `gambitl/plan-format` already existed. Units 1 to 10 are done and committed. Departures: unit 1's implementer wrote test and code together and did not see the red step. Unit 8: `approved.md` has an open Question 2, so the `plan` done check fails on it as shipped. The test replaces that answer and checks the pass. Unit 5 edited the unit 4 fixture `ticket-with-code-block.md` (placeholder lines replaced). Unit 6 made `cstack/test/skills-install.test.ts` break (a second shipped skill), fixed in a separate commit (835c553).

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**The commit trailer reader compares the branch with `origin/main`, not with the local `main`.** The ticket writes `git log <target branch>..HEAD`, which reads the local `main`. In an Orca worktree, that local `main` is often behind. I tested it: with a stale local `main`, the commits of another ticket that already merged come back with their `Cstack-Unit` trailer. The command that shows the unit status (#16) would then call a unit done when it is not. This reader is what #16, #17 and #18 build on, so I want your yes. I recommend comparing with the upstream of the target branch (`main@{upstream}`) when it has one, and with the local branch otherwise, with `--end-of-options` before the range.

**I will do this unless you say no**

- `cli.ts` takes its help text from the command list and refuses a command that the list does not have. A planned command that is not built yet answers "not in this version yet" with exit code 2, and the help shows only the built commands.
- A crash keeps exit code 1 from ADR-SIC-H, like a refusal. Its message starts with `cstack:` and names no rule, and the command list says so.
- `publish` will require a retrospective marked done after the last "work finished" report. Otherwise a retrospective written when a session stopped early would still count when the work finishes later, because a phase stays done forever.
- The `build` phase gets a done check: every unit without a `Blocked` line has at least one commit. Today it has none, so the review could start on empty work.
- When a code block opened in the ticket never closes, the reader says so with its line number. Otherwise the rest of the file reads as code, and you get thirteen "missing section" errors without the real cause.
- I will leave a comment on the ticket that builds `cstack plan section` (#16): when two headings match, the level-2 one wins.
- Nobody tags a `v*` release before the entry skill of #21 merges. Otherwise `cstack skills install` would ship a `resolve-issue` folder that holds only templates. On your machine, it would also hit your current prose `resolve-issue` folder, which has no marker.

**I checked it myself**

- git reads a trailer only from the last paragraph of the message. A `Cstack-Unit` line separated from `Co-Authored-By` by a blank line is invisible, so the format requires it in the final block, with an example file.
- `git rev-parse --git-common-dir` prints a relative path (`../../.git` from a subfolder), so the run folder uses `--path-format=absolute`.
- With `| head -1`, a `try/catch` does not catch the broken pipe error: Node prints a stack trace and exits with 1. An `error` listener on `process.stdout` in `bin.ts` fixes it and keeps the exit code, and I add it with a test.

**Good to know**

- Once this ticket merges, `cstack measure` refuses every new plan file, because of its `Format` line, until #23 lands.

#### Details

**The base of the commit trailer reader.** This question is blocking. A test already answers it, but the answer changes the literal text of the ticket's scope step 3, which #16, #17 and #18 consume, so it needs the developer's yes. The test of the code mapping is sound: in a scratch repository with a bare remote, a merged commit carrying `Cstack-Unit: 2` on `origin/main`, a stale local `main` and a feature branch made from `origin/main`, `git log main..HEAD` lists the foreign commit and `git log origin/main..HEAD` does not. In this worktree today, `git rev-parse --abbrev-ref 'main@{upstream}'` prints `origin/main`, and local `main` is level with it, so the problem is latent until the first two cstack pull requests merge. I rejected two options. The first is the literal local branch (false "done" once units of other tickets are on the remote but not in the local `main`). The second is the commit that first added the plan file (it breaks as soon as `update-branch` merges `main` into the branch, because those merged commits sit after it). The fallback to the local branch covers a repository with no remote, such as the temporary repositories of the tests. `--end-of-options` goes before the range in every case, as the code mapping's option-injection risk asks. If nobody decides, the literal reading ships and the false status appears in production only after two merged cstack pull requests, which is hard to trace back.

**How far the command list reaches into `cli.ts`.** This question is blocking, because it decides what `cli.ts` becomes. The developer can still accept it without discussion. The maintainer's comment asks for the lookup in `cli.ts`. I keep the draft recommendation and add one change: the usage text lists only the commands built in this version, because a list that shows `cstack next` before #15 ships invites people and agents to run a command that only answers "not built". The `if` chain that calls each built command stays, and a test checks that every built entry is dispatched and every dispatched command has an entry. If nobody decides, the same applies.

**Crash and refusal share exit code 1.** This question is non-blocking. ADR-SIC-H is a locked decision (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`, lines 20 and 22), so I do not reopen it. The risk is an agent that reads a crash as "refused, fix the input and retry" and loops. The fixed `cstack:` prefix without a rule name lets a guide tell the two apart. Revisit only if a retrospective shows such a loop.

**The retrospective and the publish phase.** This question is non-blocking for this ticket. It still changes the phase table that #15 implements, so it is decided here. Today's phase 11 (`skills/resolve-issue/SKILL.md`, "Phase 11: Retrospective") runs after every ending, including a needs-decision round that ends the session and a stop in phase 1 or 2. So `retro` rightly has no dependency, and it can run several times in one run. But the run state keeps one `doneAt` per phase, and `publish` depends on `retro`. A retrospective marked done at an earlier ending would satisfy `publish` after a later "work finished" report, so the final outcome would never be recorded. The recommendation is a start condition on `publish`: the `doneAt` of `retro` is later than the time of the last accepted `done` report, and `cstack next --done retro` may be run again and overwrites `doneAt`. I rejected a start condition on `retro` that requires an accepted report, because a stop in phase 1 or 2 has no report. If nobody decides, the table stays as written, with the gap above.

**A done check for `build`.** This question is non-blocking. The ticket's user value is "runs whose steps cannot be skipped", yet `build` has no done check, so `cstack next --done build` passes with zero commits and the reviews run on nothing. `cstack report submit done` catches it, but only at the very end. The check costs one call to the trailer reader that this ticket already ships: every unit without a `Blocked` line has at least one commit with its trailer. If nobody decides, there is no check, and the gap is caught late.

**An unclosed fenced block in the ticket.** This question is non-blocking. The reader ignores lines inside fenced blocks, as scope step 2 asks, and the assumptions already follow CommonMark, where an unclosed fence runs to the end of the document. Ticket bodies pasted from a tracker do sometimes leave a fence open. Every plan section after the ticket then disappears, and the reader would report every required section as missing. The reader should report one error that names the line where the fence opened, and a broken example file covers it. The same reader has related CommonMark traps. An ATX heading may have up to three leading spaces, needs a space or the end of the line after the `#` signs, and may end with closing `#` signs; a line indented by four spaces is never a heading.

**Heading collisions in `cstack plan section`.** This question is non-blocking for this ticket. The reader returns the level of each heading, and the comment on #16 suggests that a level-2 match wins over deeper ones. Here is the exact text of the comment to post on #16 after approval. "The plan reader of #13 returns the level of every heading. A ticket copied into the plan can hold its own `### Decisions` under `## Ticket`, so `cstack plan section Decisions` can match two headings. I suggest that a level-2 match wins over deeper matches, and that exit code 3 stays for two matches at the same level."

**A release before the entry skill.** This question is non-blocking. `cstack skills install` copies every folder under `cstack/skills/`, and after this ticket and #14 `cstack/skills/resolve-issue/` holds only `templates/`. Releases run only on a `v*` tag (`.github/workflows/release.yml`), so the rule is simply not to tag before #21 merges. On the maintainer's own machine, `~/.claude/skills/resolve-issue/` already holds the prose skill without the `.cstack-managed` marker, so an install from this branch would skip it and exit with 1, and `--adopt resolve-issue` would move the working prose skill into a backup folder. This ticket adds no code guard.

**Where git reads a trailer.** A test answered this blocking question, because it changes the format text. In a scratch repository, `git log --format='%(trailers:key=Cstack-Unit,valueonly,separator=%x2C)'` found the trailer when it shared the last paragraph with `Co-Authored-By`, and found nothing when `Co-Authored-By` sat in its own paragraph after it or when a sentence followed it. The key matched without regard to case, and a commit with two `Cstack-Unit` lines gave both values. So the format says that `Cstack-Unit` sits in the final paragraph of the message, together with any other trailer, and a fixture commit in `cstack/test/plan/commits.test.ts` proves that a trailer outside the final paragraph is not found. A commit that names two units counts for both. #18 writes the messages and must follow this rule, so it goes into the format text it reads.

**The run folder path.** A test answered this non-blocking question. From a subfolder of a main worktree, `git rev-parse --git-common-dir` printed `../../.git`, while `--git-dir` printed an absolute path, and from the root both print `.git`. With `--path-format=absolute` (git 2.31 and later, this machine has 2.55.0) both are absolute in every case, including a linked worktree, where the git folder is `.git/worktrees/<name>`. `run-state.ts` uses that flag, and the run-state test also runs from a subfolder. A second trap of the same module: the temporary file of the atomic write lives in the same folder as its target, because a rename across volumes fails, and a rename makes each write whole but does not serialise two writers of `state.json`. Only `cstack next` writes that file, so it is safe today.

**The broken pipe.** This question is non-blocking, and the maintainer asked for the fix. I tested it with Node 26.10.0 on macOS: writing 200,000 lines into `| head -1` inside a `try/catch` printed an unhandled `'error'` event with a stack trace and exit code 1. The write to a pipe is asynchronous on macOS, so the error never reaches the `catch`. With `process.stdout.on('error', ...)` that ignores `EPIPE`, the same script ended quietly with exit code 0. So `bin.ts` registers the listener before it calls `run`, ignores only `EPIPE`, rethrows anything else, and keeps the exit code of the command. The test runs `dist/bin.js` or a small child process, because `run` alone cannot show it.

**`cstack measure` after this ticket.** `cstack/src/measure/moments.ts` refuses a plan file whose header has a `Format` line, as #11 decided, and the new template writes one. Every plan written with the new template cannot be measured until #23 makes `cstack measure` read `Approved at` and `Ready for review at`.

Already settled and not reopened: the plan file format as a one-way door with its version, the briefing after the documentation, and the ticket headings moved down one level (CTO review block of this ticket); the run state split between the plan file and the common git folder (scope step 6, written into ADR-SIC-B by this ticket); one entry file and no `process.exit()` (ADR-SIC-H). Areas checked with nothing to add: scale and performance, because plan files and branches stay small, and operations and cost, because the ticket adds no service, bill or external dependency.

### Open questions and answers

Draft of phase 4.1. Each question has its label and the recommended answer. Questions that the ticket, its CTO review block, the epic's decisions or an ADR already answer were dropped.

1. **Which branch does the commit trailer reader compare against?** Label: blocking. The ticket says `git log <target branch>..HEAD`, read literally as the local branch named on the `Target branch` line. Tested answer: in a scratch repository with a bare remote, a merged commit with `Cstack-Unit: 2` on `origin/main`, a stale local `main` and a feature branch made from `origin/main`, `git log main..HEAD` lists the other ticket's commit and its trailer, while `git log origin/main..HEAD` lists only the branch's own commit. `git rev-parse --abbrev-ref 'main@{upstream}'` prints `origin/main`. In an Orca worktree the local target branch is often stale, so the literal reading gives a false "done" once two pull requests made by cstack have merged. Recommended answer: compare against the upstream of the target branch (`<target>@{upstream}`, usually `origin/main`) when it has one, and against the local branch otherwise. Put `--end-of-options` before the revision range. This changes the contract that #16, #17 and #18 use, so it needs the user's yes.
2. **How far does the command list reach into `cstack/src/cli.ts`?** Label: blocking (it changes what `cli.ts` becomes). The maintainer's comment on this ticket says to add the command lookup in `cli.ts` when creating `manifest.ts`. Recommended answer: `cli.ts` takes its usage text from the command list and refuses a command that the list does not have. Each entry says whether it is built in this version. A planned command of milestone 2 answers that it is not built in this version yet, with exit code 2. The `if` chain that calls each built command stays, and a test checks that every built entry is dispatched and every dispatched command is in the list.
3. **Should this ticket add the quiet exit on a broken pipe?** Label: non-blocking, but the maintainer's comment asks for it. When the reader of standard output closes the pipe early, as in `cstack ... | head -1`, Node prints a stack trace. Recommended answer: yes, in `cstack/src/bin.ts`, an EPIPE error on standard output ends the command quietly and keeps its exit code, with a test.
4. **Crash and refusal both exit with code 1.** Label: non-blocking. ADR-SIC-H gives a crash exit code 1, and the common codes of milestone 2 give code 1 the meaning "refused". Recommended answer: keep ADR-SIC-H, and write in the command list that a crash also exits with 1 and prints one line that starts with `cstack:` and names no rule. Revisit only if agents misread crashes as refusals.
5. **A release cut before the entry skill would ship a half `resolve-issue` skill.** Label: non-blocking. `cstack skills install` ships every folder under `cstack/skills/`. After this ticket and #14, `cstack/skills/resolve-issue/` holds only `templates/`. Recommended answer: do not tag a `v*` release until the entry skill of #21 is merged. No code guard in this ticket.
6. **Heading collisions for `cstack plan section`.** Label: non-blocking for this ticket. A ticket that holds `## Decisions` becomes `### Decisions` under `## Ticket`, so `cstack plan section Decisions` would match two headings and exit with 3. Recommended answer: the reader returns the level of each heading, and the comment left on #16 suggests that a level-2 match wins.

Assumptions not asked, written into "Decisions" when the plan is written: the `--home <folder>` flag of `cstack measure` goes into the command list because the code on `main` has it; the template writes `Written by: not yet` until cstack registers the plan file; the reader lists every problem of a file, except an unknown or missing format, which stops the reading at once; the template's placeholders name the new phases instead of today's phase numbers; the History part keeps each phase-4 question with its label and recommendation, while the text and the answer of a blocking question live only under `## Blocking questions`; unit paths allow ASCII letters only and refuse empty, `.` and `..` parts and a trailing `/`; the `Branch` and `Target branch` values follow git's branch-name rules and never start with `-`; fenced blocks follow CommonMark (three or more backticks or tildes, closed by the same character at least as many times), and lines inside a multi-line HTML comment are skipped; timestamps take the form `YYYY-MM-DDTHH:MM:SS±HH:MM` only, because cstack is their only writer; done checks are pure functions over the parsed plan that return the missing parts, and #15 performs the header writes they describe; the common exit codes are named constants in `manifest.ts`, and the errors of the reader and of the run state carry exit code 3, with no shared errors file, so that nothing collides with #14; `run-state.ts` provides the paths, `current-run`, `state.json`, the atomic write and the creation of a run, while the writers of test runs, reports and `publish.json` belong to #15 to #20, which use the types fixed here; blocking questions and units are numbered from 1 with no gap; a `Depends on` line naming a missing unit or the unit itself is a reader error, and cycles are left to #18.

Answers of the question round, 2026-11-18. The user answered "ok super" to the short version of "Questions you may not be asking".

- Question 1, the base of the commit trailer reader: the user accepted the recommendation. `commits.ts` compares HEAD with the upstream of the target branch when it has one, and with the local target branch otherwise, with `--end-of-options` before the range.
- Question 2, the reach of the command list into `cli.ts`: accepted by default, with the advisor's change that the usage lists only the built commands.
- Question 3, the quiet exit on a broken pipe: accepted by default.
- Question 4, crash and refusal sharing exit code 1: accepted by default. ADR-SIC-H stays, and the command list says so.
- Question 5, no `v*` release before the entry skill of #21: accepted by default.
- Question 6, heading collisions in `cstack plan section`: accepted by default. The reader returns heading levels, and a comment on #16 carries the suggestion.
- The advisor's other points were accepted by default: the `publish` start condition on the retrospective, the `build` done check, the error on an unclosed fence, the trailer in the final paragraph, and `--path-format=absolute` for the git folders.
- Every assumption listed above stands, because the reply did not object to any of them.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. No new decision since phase 4, so the advisor was not called again.
