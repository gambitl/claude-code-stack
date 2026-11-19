# Plan: #16 — M2-4: Read the plan and check the helper reports

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/16
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/plan-read-reports
Conversation language: French
Status: ready for review

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** `cstack` tells the true status of each piece of work from the saved code history, and it refuses a helper's "finished" report while something is still missing.

- **What the title means**: The plan is the plan file, the markdown file in which the `resolve-issue` skill records everything about one ticket. To read the plan means two things. `cstack` prints the status of each unit of work, and it prints one section of the plan on request. A helper is a fresh Claude agent that the skill starts for one job. The executor is the helper that runs the build, and it ends with a report such as "done". To check a report means that `cstack` accepts it only when the plan and the code history prove it.
- **Why we are doing it**: The retrospectives of past runs show two frequent problems. An executor sometimes reports "done" before its work is finished. The plan file also says a unit is done when git has no commit for it. Both problems stop a run halfway, and nobody notices until later.
- **For the user**: A solution engineer can trust a "done" report, because `cstack` refused it until it was true. Helpers also read only the section they need, which saves quota.

**Goal.** This ticket delivers `cstack plan status`, `cstack plan section`, `cstack report submit` and `cstack report check` (US-7 AC1 to AC3, US-9 AC1). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #13 adds the plan file reader, the commit trailer reader, the run state and the command list. None of them is in the repository yet.
* **Unit status written by hand**: `skills/resolve-issue/templates/plan.md` (line 39): each unit heading carries "status: todo | in progress | done | blocked". `skills/resolve-issue/agents/executor.md` (line 40) updates it from the implementer's report, so it can say "done" while git has no commit.
* **Sections found with grep**: `skills/resolve-issue/agents/implementer.md` (line 20) finds its sections with `grep -n '^#'`, and `skills/resolve-issue/agents/executor.md` (line 103) uses `grep -n '^## '`. The template has headings that start with the same words, such as "Decisions" (line 29) and "Decisions already taken upstream" (line 17), so a quick search can pick the wrong one.
* **Reports today**: `skills/resolve-issue/SKILL.md` (lines 158 to 163) lists the reports of the build, and lines 185 to 189 list the reports of the publish phase. `skills/resolve-issue/agents/executor.md` (line 123) says never to report done before the documentation is complete or while a blocking question is open. Nothing checks it.
* **The settled hand-off**: `skills/resolve-issue/SKILL.md` (line 200): the hand-off to the executor, with its fixed reports and no conversation with the user, is a settled decision. This ticket keeps it and adds the check.
* **Specification**: `docs/projects/skills-into-cli.md` (line 15) lists the mechanical problems this ticket targets. Lines 119 to 121 and line 135 hold the criteria it carries.
* **Contract**: from #13. A unit has the heading `### Unit <n>: <name>` and no status, and each unit commit carries the trailer `Cstack-Unit: <n>`. The trailer reader `cstack/src/plan/commits.ts` lists, for each unit, the commits between the `Target branch` and `HEAD`. A blocking question is open while its line is `- Answer: open`. A done report needs the sections Ticket, Dependencies, Code mapping, Decisions, Architecture, Implementation units, Documentation duties, Blocking questions, Review log, Briefing, Non-blocking questions, Pull request, Documentation and Executor notes to be filled. The reader of #13 decides what "filled" means. A heading matches a name when its text equals the name, or when the name is followed by `:`, ` (` or ` —`. The commands are `cstack plan status [--json]`, `cstack plan section <name>`, `cstack report submit <kind>` and `cstack report check`, with the exit codes of `cstack/src/manifest.ts`. Each one also takes `--plan <file>`, which names the run when the worktree's `current-run` names none. The four report kinds are `done`, `needs-decision`, `failed` and `published`. Accepted reports go to `reports/<time>-<kind>.json` in the run folder, with `readAt`. `cstack publish` records the pull request and each push in `publish.json` (#20).

## Scope

1. Build `cstack plan status` in `cstack/src/commands/plan-status.ts`. For each unit, print one line with its number, its name, and "done" with the short hashes of its commits, or "not done". Add "blocked" when the unit has a `Blocked` line. Add whether a failing or a passing test run is saved in the run state. `--json` prints the same data as JSON.
2. In `cstack plan status`, report every place where git and the plan disagree, and exit with `1`. A commit can name a unit that the plan does not have. A unit commit can also change a file that its unit does not list in `Files`. Print the statuses anyway, so the executor sees the whole picture.
3. Build `cstack plan section <name>` in `cstack/src/commands/plan-section.ts`. Use the section ranges of the reader of #13, so a heading inside a fenced code block never matches. Print the matching section, heading included, up to the next heading of the same or a higher level. Exit with `2` and list the section names when nothing matches. Exit with `3` when two headings match.
4. Build `cstack report submit <kind>` in `cstack/src/commands/report.ts`. Read the report text from standard input, up to 64 KB. Check it as the kind requires, and list every reason for a refusal at once, not only the first one.
   - For `done`, every required section must be filled, every unit must have a commit, and no blocking question may be open. `Ready for review at` must be set, and the plan file may have no uncommitted change.
   - For `published`, `publish.json` must hold a pull request link, and its last push must be the current commit.
   - For `needs-decision` and `failed`, the text must not be empty.
   - For any other kind, refuse with a message that lists the four allowed kinds (US-9 AC1).
5. When `cstack report submit` accepts a report, save its kind, its text and its time in `reports/<time>-<kind>.json`, with `readAt` empty. Print one line that says the report was accepted.
6. Build `cstack report check`. Print the kind and the text of the oldest accepted report whose `readAt` is empty, then set its `readAt`. When there is none, exit with `1`. The message then says that the executor returned without an accepted report, and that the main conversation should launch it again with the same inputs, because it resumes from the plan file.
7. Put the check itself in one exported function that takes a role, a kind, the report text and, for an implementer, a unit number. `cstack report submit` calls it with the role `executor`. #27 calls it for every helper that runs as an Orca worker.
   - The role `executor` allows the four kinds of step 4.
   - The roles `implementer` and `implementer-escalation` allow `done` and `stuck`, the two reports of `skills/resolve-issue/agents/implementer.md` (lines 55 and 56).
   - An implementer's `done` needs a commit with `Cstack-Unit: <n>` for its unit. When the unit has a `Test` line, it also needs a saved failing run.
   - An implementer's `stuck` needs a text that is not empty.
8. Reuse the reader and the trailer reader of #13. Do not write a second parser of the plan file.

## Acceptance (TDD)

* `cstack/test/plan-status.test.ts`: write first the case of a temporary repository where unit 2 has a commit with `Cstack-Unit: 2` and unit 1 has none. `cstack plan status` must say that unit 1 is not done and that unit 2 is done, with its hash (US-7 AC1). A commit with `Cstack-Unit: 1` on the target branch does not count.
* `cstack/test/plan-status.test.ts`: a commit with `Cstack-Unit: 7` in a plan of three units makes the command exit with `1` and name that commit. A commit of unit 2 that changes a file outside unit 2's `Files` also exits with `1` and names the file. A saved failing run shows on its unit. `--json` gives the same data.
* `cstack/test/plan-section.test.ts`: write first the case of `cstack plan section Decisions` on the full example plan of #13. It must print `## Decisions` with its body and nothing of `### Decisions already taken upstream` (US-7 AC2). The same holds for `Architecture` against `Architecture options`, and for `Documentation` against `Documentation duties`.
* `cstack/test/plan-section.test.ts`: in a plan with ten units, `Unit 1` prints unit 1 and not unit 10. `Scope` prints the ticket's `### Scope`, and `Acceptance` prints `### Acceptance (TDD)`. A heading inside a fenced code block is never matched. An unknown name exits with `2` and lists the names. Two headings `### Unit 3` exit with `3`.
* `cstack/test/report.test.ts`: write first the case of `cstack report submit done` on a plan where every unit has a commit but the Briefing section holds only its placeholder. It must exit with `1` and name Briefing (US-7 AC3). Then a plan where unit 3 has no commit exits with `1` and names unit 3 (US-7 AC3). When both are true, both reasons appear.
* `cstack/test/report.test.ts`: `done` is also refused with an open blocking question, without `Ready for review at`, or with an uncommitted change to the plan file. When everything is right, it exits with `0` and saves the report.
* `cstack/test/report.test.ts`: `cstack report submit complete` exits with `1`, and the message lists done, needs-decision, failed and published (US-9 AC1). `needs-decision` with an empty input exits with `1`. `published` exits with `1` when `publish.json` is missing or when its last push is older than the current commit.
* `cstack/test/report.test.ts`: after an accepted report, `cstack report check` prints its kind and text and exits with `0`. A second call exits with `1` and gives the message about launching the executor again. Two accepted reports come out oldest first.
* `cstack/test/report.test.ts`: the check function, called with the role `implementer` and unit 2, refuses `done` while unit 2 has no commit, and accepts it once the commit exists. It refuses the kind `needs-decision` for an implementer.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A report whose text holds `$(touch pwned)`, backticks and `; rm -rf ~` is saved and printed byte for byte, and no file named `pwned` appears. cstack never passes the text of a report to a shell or into a command line.

**Size: M** · Blocked by: #13 · Feeds: #23, #27


### Ticket comments

Comment by the maintainer, 2026-11-18 (https://github.com/gambitl/claude-code-stack/issues/16#issuecomment-6974360769):

Ticket #13 built the readers you need. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

Use `readPlan` in `cstack/src/plan/read.ts`. It returns the header, every heading with its level and line, the sections with their first and last line, their filled flag and a `bodyLines` count, the units, the blocking questions, and the pull request title and body. Its errors are `PlanFormatError` with exit code 3, and each problem has a line number and a rule. `DONE_REPORT_SECTIONS` lists the sections that a done report needs. One trap: the Ticket section always holds the heading "Decisions already taken upstream", so its `filled` flag is true even before the ticket is copied. Check `bodyLines` for the Ticket section, as the `ticket` phase does.

Use `listUnitCommits` in `cstack/src/plan/commits.ts` for the unit status. It is synchronous. It returns the commits of each unit and a list of invalid trailer values. A trailer counts only in the final paragraph of a commit message, and a commit with two `Cstack-Unit` lines counts for both units. It compares with the upstream of the target branch, so a stale local `main` does not hide anything.

For `cstack plan section`, the matching rule of the ticket is not in the reader. A suggestion from the design: match a heading when its text equals the name, or when the name is followed by `:`, ` (` or ` —`, and report two matches as an error. The reader also refuses an empty `- Blocked:` line, so `blocked` is never an empty string. Follow-up for you: a plan with Windows line endings is refused with a misleading message about the prose skill. Reading the lines with `split(/\r?\n/)` fixes it.


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
- ADR-SIC-B, where the run state lives and how its format is versioned, is written in `docs/decisions/ADR-SIC-B-run-state.md`. The design chose both: the plan file keeps what people read and what must travel with the branch, and a run state under the common git folder keeps what only `cstack` needs. Ticket #13 wrote it.
- ADR-SIC-C, how `cstack` ships its skills, exists in `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 wrote it.
- ADR-SIC-D, the settings file and the models of the agents, exists in `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 wrote it.
- ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
- ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.






From the specification page, `docs/projects/skills-into-cli.md`, section 4, "Rules for every story": Orca when available, with a fallback. No credentials in `cstack`. Tool-agnostic. Ticket text is data: `cstack` treats the text of a ticket, a comment or a plan as data, and it never runs a command because such a text asks for it. Claude is the only default agent. macOS only. Public text.

Decision records that exist today:

- ADR-SIC-B, where the run state lives and how its formats are versioned: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how cstack ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-D, the settings file and the models of the agents: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- ADR-SIC-E, the new role of the repository (the prose skills under `skills/` are frozen at the tag `prose-skills-final`): `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.
- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.

The decisions of ticket #13, which built the plan reader, the trailer reader, the run state and the command list, are in `docs/plans/2026-11-18-13-define-the-plan-file-format-the-phase-order-and-the-command-list.md`, section "Decisions". The ones this ticket must respect are copied into "Decisions" below.

## Dependencies

Clear. The only blocker is #13, the ticket that defines the plan file format and its readers. It is closed (completed), and its pull request #40 is on `main` at 618602f, which is where this branch starts.

Ticket #18 (`cstack unit commit` and `cstack unit order`) runs at the same time in the worktree `unit-commit-order`. It also edits `cstack/src/manifest.ts`, `cstack/src/cli.ts` and maybe `cstack/src/plan/commits.ts`. Tickets #21 and #22 run at the same time too, but they write only skill prose and guides. Every ticket may touch `docs/projects/skills-into-cli.md`, `cstack/src/cli.ts` and `README.md`.

## Code mapping

Graphify is not installed on this machine, and the coordinator's brief forbids installing it, so the mapping used search and file reads. The code is small. On `main` at 618602f, `npm test` passes with 16 test files and 241 tests, and `npm run typecheck` is clean.

**Entry points.**

- `cstack/src/cli.ts` keeps the calls to the built commands in the `HANDLERS` record, keyed by the first word (lines 37 to 42). `run` calls a handler only when a built entry of the command list has that first word (line 50). A first word whose entries are all not built answers "not built in this version yet" with exit code 2 (lines 52 to 55). The usage text lists the usage line of every built entry, then one "Commands:" line per first word with the summary of the first built entry of that word (lines 14 to 27).
- `cstack/test/cli.test.ts` checks three things against the command list. Every first word of a built entry has a handler, and every handler has a built entry (line 117). The usage prints the usage line of every built entry and of no other (line 109). A built command given `--cstack-unknown-flag` returns 2 and prints its usage line (line 122). For `plan status`, that test calls `run(["plan", "status", "--cstack-unknown-flag"])`.
- `cstack/src/manifest.ts` (lines 92 to 120) holds the four entries of this ticket, not built. `plan status [--json]` exits with 1 when "A commit names a unit that the plan does not have". `plan section <name>` exits with 2 when no heading matches, and with 3 when two headings match or the plan is invalid. The entries of `report submit <kind>` and `report check` name the files `report-submit.ts` and `report-check.ts`, while scope 4 of the ticket says `report.ts`. `planCommand` adds the `--plan` flag to each of them.
- `cstack/test/manifest.test.ts` counts four built entries and eleven that are not built (line 116). It also requires the file of a built entry to exist under `cstack/src/commands/` (line 121).

**Readers to reuse.**

- `readPlan(text)` in `cstack/src/plan/read.ts` (line 511) returns the header, every heading with its level, line and text, the sections with `first`, `last`, `filled` and `bodyLines`, the units, the blocking questions with an `open` flag, and the pull request. Headings inside a fenced code block or an HTML comment are not in the list (`scan`, lines 156 to 199). It throws `PlanFormatError` with exit code 3 and every problem with its line. `DONE_REPORT_SECTIONS` is at line 37.
- `readPlan` splits the text with `text.split("\n")` (line 512). On a plan with Windows line endings, the `Format` pattern at line 205 cannot match a line that ends with `\r`. I checked it: the built reader answers "This plan file has no Format line. The prose skill wrote it before cstack existed." on `approved.md` converted to CRLF. This is the follow-up of the ticket comment.
- The Ticket section always holds the heading `### Decisions already taken upstream`, so its `filled` flag is true even before the ticket is copied. `ticketCopied` in `cstack/src/phases.ts` (line 55) checks `bodyLines` instead.
- `listUnitCommits(repoDir, targetBranch)` in `cstack/src/plan/commits.ts` (line 20) is synchronous. It returns `{ units: Record<number, string[]>, invalid: string[] }` with full hashes, and compares HEAD with `<target>@{upstream}` when the target branch has one. A bad or missing target branch throws `PlanFormatError` with exit code 3. It does not return the files that each commit changes, which scope 2 needs.
- `cstack/src/run-state.ts` gives `runFolder(cwd, planFile)` (line 95) and `readCurrentRun(cwd)` (line 117), which returns only the plan file name. `readState` returns `state.plan`, the plan file path from the repository root (line 29). The types `SavedTestRun` (line 34, `units/<n>/red.json` and `green.json`), `SavedReport` (line 43, kind limited to the four executor kinds, optional `readAt`) and `PublishRecord` (line 52, `pullRequest` and `pushes` with `commit` and `time`) are there, with `writeFileAtomic` (line 105). Errors are `RunStateError` with exit code 3. Nothing writes reports, saved test runs or `publish.json` yet. #15 writes `state.json` and `current-run`, #17 writes the saved test runs, and #20 writes `publish.json`.
- `buildDone` in `cstack/src/phases.ts` (line 71) does not require a commit for a unit that has a `Blocked` line. Scope 4 of the ticket says that a done report needs a commit for every unit.

**Patterns to follow.**

- Each command parses its own options with `parseArgs` in strict mode, prints through `io`, and returns its exit code (`cstack/src/commands/measure.ts`, `cstack/src/commands/guide.ts`). Git runs through `spawnSync` or `execFileSync` with an argument array, never a shell (`commits.ts` line 11).
- Tests use vitest, a `collect()` helper that builds a fake `Io`, and temporary git repositories made with `execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...])` (`cstack/test/plan/commits.test.ts`, lines 9 to 30).
- The `Io` type has `stdout` and `stderr` only (`cstack/src/io.ts`). `report submit` is the first command that reads standard input.

**How the other tickets use the same pieces.**

- #15 (`cstack next`, not in this wave) defines how a command finds its run. With `--plan <file>`, it uses the run of that plan file. Without `--plan`, it uses the run named in `current-run`. It refuses with exit code 2 a `--plan` path outside the repository, and `--done` with no `--plan` and no run.
- #18 (`unit commit` and `unit order`, in this wave) takes `--plan` too, so it needs the same lookup. Its worktree has no plan file yet.
- #27 calls the report check for the implementers and calls the save and the reading of executor reports, "by calling that code". It saves implementer reports itself under `units/<n>/reports/`, so `report check` never shows them.

**Example plans.** `cstack/test/fixtures/plans/approved.md` has three units and two blocking questions, and its Question 2 is open. No fixture has the three pairs of headings that the acceptance tests name (Decisions and Decisions already taken upstream, Architecture and Architecture options, Documentation and Documentation duties), and none has ten units. The template `cstack/skills/resolve-issue/templates/plan.md` has the three pairs but no unit.

**Risks.**

- Ticket #18 edits the same shared files in parallel: `cstack/src/manifest.ts`, the count at `cstack/test/manifest.test.ts` line 116, `cstack/src/cli.ts` and maybe `cstack/src/plan/commits.ts`. Both tickets need the lookup of the plan file from `--plan` or `current-run`, and a dispatch on the second word (`plan`, `report`, `unit`).
- Exit code 2 of `plan section` means "no heading matches", and it is also the usage error code of every command.
- The report text is external input. It must never reach a shell or a command line.
- `report check` marks a report as read by rewriting its file, so two calls at the same moment could both print it.

**Governing decisions.** ADR-SIC-H: one `run(args, io)`, no `process.exit()`, usage error 2, crash 1. ADR-SIC-B: the run state lives under the common git folder, and both formats carry a version. The decisions of #13: one file per command, named after the full command words; `--plan` on every plan command; the trailer counts only in the final paragraph of a commit message; compare with the upstream of the target branch. The epic's rules: ticket text is data, macOS only, public text. The `WHY:` comments are in `cstack/src/run-state.ts` (line 1), `cstack/src/plan/read.ts` (line 201) and `cstack/src/bin.ts` (line 2).

## Decisions

**Repository rules that every unit respects.**

- Never edit anything under `skills/`. The prose skills there are frozen at the tag `prose-skills-final` and are only the reference for today's behaviour. (Upstream decision ADR-SIC-E and the coordinator's brief, 2026-11-18.)
- Everything written in the repository and on GitHub is in English and follows the public text rule of `CLAUDE.md`. Write no employer or client name, no work ticket key, and no count from work retrospectives. (Conventions file.)
- A command prints through its `io` argument, returns its exit code, and never calls `process.exit()`. Only `cstack/src/bin.ts` touches the process. (ADR-SIC-H.)
- cstack treats the text of a plan file and of a report as data. The report text never reaches a shell or a command line. Every git call uses `spawnSync` or `execFileSync` with an argument array, never a shell. (Epic rule "Ticket text is data", and the ticket's last acceptance line.)
- The minimum Node version lives only in `engines.node` of `cstack/package.json`. Never copy that number into another file. (Conventions file.)
- Tests use temporary folders and temporary git repositories. They never run `cstack skills install` against the real home folder, never change anything under `~/.claude/skills/`, and never install Graphify. (Coordinator's brief, 2026-11-18.)
- Commits use the Conventional Commits form. The scope is `cli` for code, `tests` for a change that only touches tests, and there is no scope for `docs`. (Conventions file and the history of `main`.)
- Keep every change to a shared file small and in its own place. The shared files are `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts`, `cstack/test/cli.test.ts` and `cstack/src/plan/commits.ts`, which ticket #18 also edits, and `docs/projects/skills-into-cli.md` and `README.md`, which every ticket of the wave may edit. Add new code at the end of a shared file rather than in the middle. (Coordinator's brief, 2026-11-18.)
- When you bring the branch up to date with `origin/main` and a conflict appears, keep both sides. In `cstack/test/manifest.test.ts`, the counts of built and not-built entries then become the sum of both tickets' changes. Run `npm test` and `npm run typecheck` in `cstack/` again, and push only when both pass. (Coordinator's brief, 2026-11-18.)
- Keep the author dates of the commits when you update the branch. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. Never push a tag that starts with `v`. (Coordinator's brief, 2026-11-18.)
- Never change `user.email` in the git config. Before the push, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`. Then write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, and run `python3 scripts/private_names.py check <that file>`. It must exit 0. Never print the private list. (Coordinator's brief, 2026-11-18.)
- Never merge the pull request. When the `cstack` check is cancelled with "The job was not acquired by Runner", rerun it with `gh run rerun <run id>`. (Coordinator's brief, 2026-11-18.)

**Finding the plan file and the run (`cstack/src/plan/locate.ts`).**

- Every command of this ticket finds its plan file by calling `locatePlan` from `cstack/src/plan/locate.ts`. Ticket #18 writes that file. Never write a second lookup under another name. (Coordinator's answer, 2026-11-18.)
- `locatePlan` behaves as ticket #15 describes, with the interface the coordinator fixed for both tickets. `--plan <file>` wins, and its path is read from the current folder. A `--plan` path outside the repository, before or after symbolic links are resolved, throws `PlanLocationError` with exit code 2. A `--plan` file inside the repository that does not exist or cannot be read throws `PlanLocationError` with exit code 3. (Coordinator's answers, 2026-11-18.)
- Without `--plan`, `locatePlan` reads the plan name with `readCurrentRun`. No `current-run` throws `PlanLocationError` with exit code 2, and the message asks for `--plan <file>`. A run without `state.json` throws `PlanLocationError` with exit code 3. A `state.json` that `readState` rejects keeps throwing its own `RunStateError` with exit code 3. The plan path is the `plan` field of `state.json`, which is a path from the repository root. (Coordinator's answers, 2026-11-18.)
- `locatePlan` only reads. It never writes `current-run` or `state.json`. (Coordinator's answers, 2026-11-18.)
- The check "outside the repository" compares real paths, with `realpathSync`, because on macOS git returns `/private/var/...` where Node gives `/var/...`. (Advisor's tested answer and coordinator's answer, 2026-11-18.)
- The interface is exactly this, with no renaming: `export interface LocatedPlan { root: string; path: string; relative: string }`, `export class PlanLocationError extends Error { readonly exitCode: 2 | 3 }` with the constructor `(message, exitCode)`, and `export function locatePlan(cwd: string, planFlag: string | undefined): LocatedPlan`. `root` is the real path of `git rev-parse --show-toplevel`. `path` is the absolute real path of the plan file. `relative` is the path from `root`, with forward slashes. The messages hold no stack trace. (Coordinator's answer, 2026-11-18.)
- Ticket #18 writes `cstack/src/plan/locate.ts` too. Until #18 merges, this branch carries its own copy, with exactly that interface and behaviour, and the pull request says so. When #18 merged first, keep one copy of the file at the update onto `main`. (Coordinator's answers, 2026-11-18.)
- A command catches `PlanLocationError` and prints its message, then returns its `exitCode`. (Assumption not asked, 2026-11-18.)
- Each command function takes `(args, io, options)`, and `options.cwd` is the folder it works from. `cstack/src/cli.ts` passes `process.cwd()`. Tests pass the folder of a temporary repository. (Assumption not asked, 2026-11-18.)

**The dispatch on the second word (`cstack/src/cli.ts`).**

- `cstack/src/cli.ts` exports `dispatchSubcommand(group: string, args: string[], io: Io, handlers: Record<string, (args: string[], io: Io) => Promise<number>>): Promise<number>`. It sends the arguments after the second word to the handler of that second word. When the second word is missing or unknown, it prints on standard error a usage line that lists the known second words of the group, and returns 2. Ticket #18 uses it for `unit`, so do not change its signature without the coordinator. (Coordinator's answer, 2026-11-18.)
- Each group passes only its built commands in `handlers`. The `HANDLERS` record gets two new keys, `plan` and `report`, which call `dispatchSubcommand`. (Advisor's details, accepted by default, 2026-11-18.)

**The command list (`cstack/src/manifest.ts`).**

- The four entries of this ticket become built. Their files stay the ones the command list names: `plan-status.ts`, `plan-section.ts`, `report-submit.ts` and `report-check.ts`, under `cstack/src/commands/`. Scope 4 of the ticket says `report.ts`, but it was written before the command list. (User's answer, accepted by default, 2026-11-18.)
- Exit code 1 of `cstack plan status` now reads "Git and the plan disagree: a commit names a unit that the plan does not have, or a unit commit changes a file outside its Files." The other exit codes of the four entries do not change. (Ticket scope 2.)
- The count in `cstack/test/manifest.test.ts` becomes eight built entries and seven that are not built. (Consequence of the four built entries.)

**The plan reader (`cstack/src/plan/read.ts`).**

- `readPlan` splits the text with `/\r?\n/`, so a plan with Windows line endings reads like the same plan with Unix line endings. (Maintainer's comment on the ticket, 2026-11-18.)

**`cstack plan section <name>` (`cstack/src/commands/plan-section.ts`).**

- The command reads the plan with `readPlan` and uses its headings, so a heading inside a fenced code block or an HTML comment never matches. A plan that the reader refuses exits with 3 and prints the reader's problems. (Ticket scope 3 and the command list.)
- The name is the positional arguments joined by one space, so `cstack plan section Code mapping` and `cstack plan section "Code mapping"` both work. No name is a usage error with exit code 2. (Assumption not asked, 2026-11-18.)
- A heading matches the name when its text equals the name, or when its text starts with the name followed by `:`, ` (` or ` —`. The comparison is case-sensitive. The level-1 title never matches. (Ticket contract.)
- When several headings match and exactly one of them is level 2, the command prints that one. Otherwise, two or more matches exit with 3 and list the matching headings with their line numbers. So two `### Unit 3` headings still exit with 3, and a ticket heading `### Documentation` never hides `## Documentation`. (User's answer, 2026-11-18.)
- The printed section runs from its heading line to the line before the next heading of the same or a higher level, or to the end of the file. Trailing blank lines are dropped, and the output ends with one newline. (Ticket scope 3; dropping blank lines is an assumption not asked, 2026-11-18.)
- When no heading matches, the command exits with 2. Its message lists every heading of the file except the title, one per line, in file order. (User's answer, accepted by default, 2026-11-18.)

**`cstack plan status [--json]` (`cstack/src/commands/plan-status.ts`).**

- The unit commits come from `listUnitCommits(root, header["Target branch"])`. Never write a second trailer reader. (Ticket scope 8.)
- The command prints one line per unit, in unit order, such as `Unit 2: Read the reports: done (abc1234, def5678), failing run saved`. A unit with no commit says `not done`. When the unit has a `Blocked` line, the line adds `blocked: <reason>`. When `units/<n>/red.json` exists in the run folder, it adds `failing run saved`. When `units/<n>/green.json` exists, it adds `passing run saved`. A short hash is the first seven characters of the full hash. (Ticket scope 1; the line format is the user's answer, accepted by default, 2026-11-18.)
- The command then checks where git and the plan disagree, and prints each disagreement on standard error, one per line. The statuses are always printed first. Any disagreement makes the exit code 1. (Ticket scope 2.)
- A disagreement is one of three cases. A commit names a unit number that the plan does not have, and the message names the short hash and the number. A trailer value is not a positive whole number, such as `Cstack-Unit: abc`, and the message names the value. A unit commit changes a file that none of the units it names lists in `Files`, and the message names the short hash, the unit numbers and the file. (Ticket scope 2; the invalid value and the rule for a commit with two trailers are the user's answer, accepted by default, 2026-11-18.)
- The files of a commit come from git with `-z`, so a name with non-ASCII letters is never quoted or escaped. A renamed file counts with both its old and its new path. (Advisor's tested answer, accepted by default, 2026-11-18.)
- `--json` prints one JSON object on standard output: `{ "units": [...], "problems": [...] }`. Each unit holds `number`, `name`, `done`, `commits` (full hashes), `blocked` (the reason or `null`), `failingRunSaved` and `passingRunSaved`. Each problem holds `kind` (`unknown-unit`, `invalid-trailer` or `file-outside-unit`), `message`, and the fields that apply among `commit`, `units`, `value` and `file`. The exit code is the same as without `--json`. (Ticket scope 1; the field names are an assumption not asked, 2026-11-18.)
- A plan that the reader refuses, a target branch that does not exist, or an unusable run state exits with 3. (Command list and the readers of #13.)

**The report check, the save and the reading (`cstack/src/report/reports.ts`).**

- All the shared report code lives in `cstack/src/report/reports.ts`, so that #15 and #27 import it from one place. It exports `checkReport`, `saveReport`, `takeOldestUnreadReport` and `lastAcceptedDoneReportAt`, and the lists of allowed kinds per role. (User's answer, accepted by default, 2026-11-18; `lastAcceptedDoneReportAt` is the advisor's details, accepted by default.)
- `checkReport(report: { role, kind, text, unit? }, where: { root: string; planFile: string })` returns the list of every reason for a refusal. An empty list means that the report is accepted. It throws `PlanFormatError` or `RunStateError`, with exit code 3, when the plan or the run state cannot be read. The roles are `executor`, `implementer` and `implementer-escalation`. (Ticket scope 7; the exact signature is an assumption not asked, 2026-11-18.)
- The role `executor` allows `done`, `needs-decision`, `failed` and `published`. Any other kind is refused with a reason that lists these four kinds. (Ticket scope 4 and US-9 AC1.)
- An executor `done` report collects every reason below, not only the first one. (Ticket scope 4.)
  - Each section of `DONE_REPORT_SECTIONS` that is not filled is a reason that names it. The Ticket section counts as filled only when its `bodyLines` is above 0, as the `ticketCopied` check of `cstack/src/phases.ts` does. (Ticket scope 4 and the maintainer's comment.)
  - Each unit that has no commit with its trailer is a reason that names it, except a unit that has a `Blocked` line. (User's answer, 2026-11-18.)
  - Each open blocking question is a reason that names it. (Ticket scope 4.)
  - `Ready for review at` holding `not yet` is a reason. (Ticket scope 4.)
  - Any uncommitted change in the worktree is a reason, and the message names up to ten paths. This covers a modified, a staged or an untracked plan file, and also a review fix left uncommitted. Run `git status --porcelain=v1 -z --untracked-files=all`, so that files covered by `.gitignore` do not count. (User's answer, 2026-11-18.)
- The done check reuses the checks of `cstack/src/phases.ts`. Export `ticketCopied`, `noOpenQuestion` and `buildDone` from it, and call them, so that the build phase and the done report can never drift apart. (Advisor's details, accepted by default, 2026-11-18.)
- The done check does not refuse what `cstack plan status` reports, such as a commit that names an unknown unit or a file outside its unit. (User's answer, accepted by default, 2026-11-18.)
- An executor `published` report needs `publish.json` in the run folder, with a pull request link that is not empty. The commit of its last push must equal the current `HEAD`. A missing file, an empty link, no push or an older push is a reason. A `publish.json` that is not valid JSON exits with 3. (Ticket scope 4; the invalid JSON case is an assumption not asked, 2026-11-18.)
- An executor `needs-decision` or `failed` report needs a text that is not empty once trimmed. `done` and `published` accept an empty text. (Ticket scope 4.)
- The roles `implementer` and `implementer-escalation` allow `done` and `stuck`. Any other kind, `needs-decision` included, is refused with a reason that lists these two kinds. A report of these roles without a unit number, or with a unit that the plan does not have, is refused. (Ticket scope 7.)
- An implementer `done` needs a commit with `Cstack-Unit: <n>` for its unit. When the unit has a `Test` line, it also needs `units/<n>/red.json` in the run folder. A unit with a `No test` line needs no saved run. An implementer `stuck` needs a text that is not empty once trimmed. (Ticket scope 7.)
- `saveReport` writes `reports/<time>-<kind>.json` in the run folder. The time in the file name is the UTC ISO time with `:` replaced by `-`, such as `2026-11-18T10-15-30.123Z-done.json`. The file holds `kind`, `text` and `time`, where `time` is the real ISO time that `Date.parse` reads. `readAt` is absent until the report is shown. (Ticket scope 5; the name format is the user's answer, accepted by default, 2026-11-18.)
- `saveReport` never replaces an existing report. Write the content to a temporary file in the same folder, then link it to the final name, which fails when the name exists, and add a counter to the name in that case. (Advisor's details, accepted by default, 2026-11-18.)
- `takeOldestUnreadReport` reads every report file of the run, keeps the ones without `readAt`, and takes the oldest by `time`, then by file name. It sets `readAt` to the current ISO time, rewrites the file with `writeFileAtomic`, and returns the report. It returns nothing when there is none. A report file that is not valid JSON throws `RunStateError` with exit code 3. (Ticket scope 6.)
- `lastAcceptedDoneReportAt` returns the `time` of the latest saved `done` report, or nothing. Ticket #15 uses it to fill the field of the same name in `PhaseContext`. (Advisor's details, accepted by default, 2026-11-18.)
- Saved implementer reports are not this ticket's job. Ticket #27 saves them under `units/<n>/reports/`. (Ticket #27.)

**`cstack report submit <kind>` (`cstack/src/commands/report-submit.ts`).**

- The command parses its options before it reads anything, so an unknown flag gives the usage error with exit code 2 at once. It takes exactly one kind. (Command list and `cstack/test/cli.test.ts` line 122.)
- The function receives a `readInput` option that returns the bytes of standard input, or nothing when standard input is a terminal. `report-submit.ts` exports the reader that `cli.ts` passes, which reads `process.stdin`. When standard input is a terminal, the command exits with 2 and says to pipe the report text. (User's answer, accepted by default, 2026-11-18.)
- A text longer than 65,536 bytes is refused with exit code 1. A text that is not valid UTF-8 is refused with exit code 1, so that the saved text is exactly the input. (User's answer, accepted by default, 2026-11-18.)
- The command calls `checkReport` with the role `executor`. When the list of reasons is not empty, it prints every reason on standard error, one per line, and exits with 1. Otherwise it calls `saveReport`, prints one line that says the report was accepted, and exits with 0. (Ticket scope 4 and scope 5.)

**`cstack report check` (`cstack/src/commands/report-check.ts`).**

- The command calls `takeOldestUnreadReport`. It prints the kind on the first line, then the text exactly as it was saved, with no byte added or removed, and exits with 0. (Ticket scope 6; the output form is the user's answer, accepted by default, 2026-11-18.)
- When there is no report to show, it exits with 1. Its message says that the executor returned without an accepted report, and that the main conversation should launch it again with the same inputs, because the executor resumes from the plan file. (Ticket scope 6.)
- Two `report check` calls at the same moment could print the same report. This risk is accepted, because only the main conversation calls the command, once each time the executor returns. (Advisor's details, accepted by default, 2026-11-18.)

## Architecture

The approach is locked by the ticket, the command list of #13 and the answers of the question round, so there was no architecture choice to make. The ticket adds four command files under `cstack/src/commands/`, one shared report module `cstack/src/report/reports.ts`, and a temporary copy of `cstack/src/plan/locate.ts` until #18 merges. It changes existing code in five small places. `read.ts` accepts Windows line endings. `commits.ts` gains one function at its end that lists the files of a commit. `phases.ts` exports three of its checks. `cli.ts` gains `dispatchSubcommand` and two handlers. `manifest.ts` marks the four entries as built. The report module depends on the plan reader, the trailer reader, the phase checks and the run state. The commands depend on the report module, `locatePlan` and the readers.

The units run in four batches. Units 1, 2, 3, 4 and 5 share no file and can run in parallel. Units 6, 7 and 8 come next and can run in parallel. Unit 9 follows unit 8, because both edit `cstack/test/report.test.ts`. Unit 10 comes last, because it edits `cli.ts` after unit 2 and registers every command.

**Security.** The plan file and the report text are external input, because an agent writes them and a ticket's text lands in the plan. The report text is read from standard input, saved in JSON and printed back. It never reaches a shell or a command line, and unit 9 holds the test with `$(touch pwned)`, backticks and `; rm -rf ~`. Git runs with argument arrays only. Hashes passed to git come from git itself, and the target branch is checked by the reader and passed after `--end-of-options`. A `--plan` path outside the repository is refused, so a command never reads or names a run for a file elsewhere. The change has no endpoint, no database query and no secret.

## Implementation units

### Unit 1: Read a plan file with Windows line endings — status: done (1d9f2c9)
- Files: `cstack/src/plan/read.ts`, `cstack/test/plan/read.test.ts`
- Failing test: in `cstack/test/plan/read.test.ts`, `readPlan` on `cstack/test/fixtures/plans/approved.md` converted to CRLF returns the same header, sections, units, blocking questions and pull request as on the original file. Today it throws "This plan file has no Format line".
- Minimum code: in `readPlan`, split the text with `/\r?\n/` instead of `"\n"`.
- Refactor: none.
- Commit message: `fix(cli): read a plan file with Windows line endings`
- Depends on: none

### Unit 2: Send a two-word command to its handler by the second word — status: done (1714ad7)
- Files: `cstack/src/cli.ts`, `cstack/test/cli.test.ts`
- Failing test: in `cstack/test/cli.test.ts`, `dispatchSubcommand("plan", ["status", "--json"], io, { status: fake })` calls `fake` with `["--json"]` and returns its exit code. With `[]` and with `["nope"]`, it returns 2 and prints on standard error a usage line that names the group `plan` and lists `status`.
- Minimum code: export `dispatchSubcommand` from `cstack/src/cli.ts` with the signature written in "Decisions". Register no handler yet.
- Refactor: none.
- Commit message: `feat(cli): send a two-word command to its handler by the second word`
- Depends on: none

### Unit 3: Find the plan file from --plan or the current run — status: done (a25a566)
- Files: `cstack/src/plan/locate.ts`, `cstack/test/plan/locate.test.ts`
- Failing test: in `cstack/test/plan/locate.test.ts`, with a temporary repository under `os.tmpdir()`, `locatePlan(repo, "docs/plans/x.md")` returns the real root, the real absolute path and `docs/plans/x.md`. Called from a subfolder with `../docs/plans/x.md`, it returns the same file. `locatePlan(repo, "../outside.md")`, an absolute path outside the repository, and a symbolic link inside the repository that points outside it throw `PlanLocationError` with `exitCode` 2. A `--plan` file inside the repository that does not exist throws `PlanLocationError` with `exitCode` 3. Without `--plan`, after `writeCurrentRun` and `writeState` with `plan: "docs/plans/x.md"`, it returns that file, also from a subfolder. With no `current-run`, it throws `PlanLocationError` with `exitCode` 2, and the message asks for `--plan <file>`. With `current-run` but no `state.json`, it throws `PlanLocationError` with `exitCode` 3. It never writes `current-run` or `state.json`.
- Minimum code: `cstack/src/plan/locate.ts` with exactly the interface and behaviour of "Decisions", built on `gitFolders`, `readCurrentRun` and `readState` of `cstack/src/run-state.ts` and on `git rev-parse --show-toplevel`. This is this branch's copy of the file that #18 writes, so do not rename anything.
- Refactor: none.
- Commit message: `feat(cli): find the plan file from --plan or the current run`
- Depends on: none

### Unit 4: List the files that a unit commit changes — status: done (742eef2)
- Files: `cstack/src/plan/commits.ts`, `cstack/test/plan/commits.test.ts`
- Failing test: in `cstack/test/plan/commits.test.ts`, on a commit that renames `a.txt` to `b.txt` and adds `café.md`, `listCommitFiles(repo, [hash])` returns `{ [hash]: ["a.txt", "b.txt", "café.md"] }`, sorted, with the name `café.md` unquoted and unescaped.
- Minimum code: append `listCommitFiles(repoDir, hashes)` at the end of `cstack/src/plan/commits.ts`. For each hash, it runs `git diff-tree -r -z --name-only --no-renames --no-commit-id --end-of-options <hash>` with an argument array. A git failure throws `PlanFormatError`, as `listUnitCommits` does. Do not change `listUnitCommits`.
- Refactor: none.
- Commit message: `feat(cli): list the files that each unit commit changes`
- Depends on: none

### Unit 5: A full example plan and a helper that builds a test repository — status: done (dedfff2)
- Files: `cstack/test/fixtures/plans/full.md`, `cstack/test/helpers/plan-repo.ts`, `cstack/test/plan/full-example.test.ts`
- Failing test: in `cstack/test/plan/full-example.test.ts`, `readPlan` on `full.md` returns ten units, a `Ready for review at` time, every section of `DONE_REPORT_SECTIONS` filled, a Ticket section whose `bodyLines` is above 0, and no open blocking question. A repository made by the helper with `full.md` committed at `docs/plans/full.md` has a clean `git status` and no unit commit.
- Minimum code: `full.md` is a complete `cstack-plan/1` plan with Status `ready for review`, both times set, and `Target branch: main`. Its Ticket section copies a ticket with its headings moved down one level: `### Why this matters (plain language)`, `### Where things are today (read first)`, `### Scope` and `### Acceptance (TDD)`, then `### Decisions already taken upstream`. Inside the ticket, a fenced code block holds the lines `## Decisions` and `### Unit 3: fake`. It has `## Decisions`, `## Architecture`, ten units `### Unit 1` to `### Unit 10`, each with its own file under `src/` in `Files`, some with a `Test` line and some with a `No test` line, and none with a `Blocked` line. `## Blocking questions` holds one answered question. `## Briefing`, `## Documentation duties`, `## Documentation` and every other section are filled. `## Pull request` has `Title:` and a four-backtick `markdown` block. `## History` ends with `### Architecture options`, followed by two `#### Details` headings in two different level-3 parts. `cstack/test/helpers/plan-repo.ts` exports a `git(cwd, ...args)` helper with a test identity, a function that makes a temporary repository on `main` with a first commit, a function that writes and commits a plan file, a function that commits changes to given files with given `Cstack-Unit` trailers in the final paragraph, and a `collect()` helper that builds a fake `Io`.
- Refactor: none.
- Commit message: `test(tests): add a full example plan and a helper that builds a test repository`
- Depends on: none

### Unit 6: Print exactly one section with cstack plan section — status: done (763f281)
- Files: `cstack/src/commands/plan-section.ts`, `cstack/test/plan-section.test.ts`
- Failing test: in `cstack/test/plan-section.test.ts`, write first `cstack plan section Decisions` on `full.md` in a test repository. It prints `## Decisions` with its body, nothing of `### Decisions already taken upstream`, and exits with 0 (US-7 AC2). Then add the other cases. `Architecture` prints nothing of `### Architecture options`, and `Documentation` prints nothing of `## Documentation duties`. `Unit 1` prints unit 1 and not unit 10. `Scope` prints the ticket's `### Scope`, and `Acceptance` prints `### Acceptance (TDD)`. The `## Decisions` line inside the fenced block never matches. An unknown name exits with 2 and lists the headings. `Details` matches two `#### Details` headings and exits with 3. A plan whose Ticket section holds `### Documentation` still prints `## Documentation` for `Documentation`. `Code mapping` given as two arguments works. A plan with two `### Unit 3` headings exits with 3, because the reader refuses it. A plan that the reader refuses for another reason exits with 3.
- Minimum code: `planSection(args, io, { cwd })` in `cstack/src/commands/plan-section.ts`, as "Decisions" describes. It finds the plan with `locatePlan` and reads it with `readPlan`.
- Refactor: none.
- Commit message: `feat(cli): print exactly one section of the plan with cstack plan section`
- Depends on: 3, 5

### Unit 7: Print the status of each unit with cstack plan status — status: done (e01d41f)
- Files: `cstack/src/commands/plan-status.ts`, `cstack/test/plan-status.test.ts`
- Failing test: in `cstack/test/plan-status.test.ts`, write first a test repository where unit 2 has a commit with `Cstack-Unit: 2` and unit 1 has none. `cstack plan status` says that unit 1 is not done and that unit 2 is done with its short hash (US-7 AC1). A commit with `Cstack-Unit: 1` on `main` does not count. Then add the other cases. A commit with `Cstack-Unit: 7` in a plan of three units exits with 1 and names that commit, after the statuses. A commit of unit 2 that changes a file outside unit 2's `Files` exits with 1 and names the file. `Cstack-Unit: abc` exits with 1. A saved `units/1/red.json` in the run folder shows `failing run saved` on unit 1, and `green.json` shows `passing run saved`. A `Blocked` line shows with its reason. `--json` gives the same data and the same exit code.
- Minimum code: `planStatus(args, io, { cwd })` in `cstack/src/commands/plan-status.ts`, as "Decisions" describes. It uses `locatePlan`, `readPlan`, `listUnitCommits`, `listCommitFiles` and `runFolder`.
- Refactor: none.
- Commit message: `feat(cli): print the status of each unit from git with cstack plan status`
- Depends on: 3, 4, 5

### Unit 8: Check, save and read the reports of the helpers — status: done (0f9b5d3)
- Files: `cstack/src/report/reports.ts`, `cstack/src/phases.ts`, `cstack/test/report.test.ts`
- Failing test: in `cstack/test/report.test.ts`, write first `checkReport` with the role `executor` and the kind `done`, on a test repository where every unit of `full.md` has a commit but the Briefing section holds only its placeholder. The reasons name Briefing (US-7 AC3). Then add the other cases. Without a commit for unit 3, a reason names unit 3, and with both problems, both reasons appear (US-7 AC3). A unit with a `Blocked` line and no commit is accepted. An open blocking question, `Ready for review at: not yet`, an uncommitted change to the plan file, an untracked plan file and an untracked file elsewhere are each refused. A clean, complete repository gives no reason. The kind `complete` is refused with a reason that lists done, needs-decision, failed and published (US-9 AC1). `needs-decision` and `failed` with an empty or blank text are refused. `published` is refused without `publish.json` and when the last push is older than `HEAD`, and accepted when the last push is `HEAD` and the link is set. With the role `implementer` and unit 2, `done` is refused while unit 2 has no commit, and accepted once the commit exists and, for a unit with a `Test` line, `units/2/red.json` is saved. The kind `needs-decision` is refused for an implementer, and `stuck` with an empty text too. `saveReport` then `takeOldestUnreadReport` returns the report and sets `readAt`, and a second call returns nothing. Two reports come out oldest first. Two saves at the same fixed time give two files. `lastAcceptedDoneReportAt` returns the time of the latest done report.
- Minimum code: `cstack/src/report/reports.ts` as "Decisions" describes. Export `ticketCopied`, `noOpenQuestion` and `buildDone` from `cstack/src/phases.ts`, and call them from `checkReport`.
- Refactor: none.
- Commit message: `feat(cli): check, save and read the reports of the helpers`
- Depends on: 5

### Unit 9: Submit and read the executor's report with cstack report submit and report check — status: done (c71df6c)
- Files: `cstack/src/commands/report-submit.ts`, `cstack/src/commands/report-check.ts`, `cstack/test/report.test.ts`
- Failing test: in `cstack/test/report.test.ts`, `reportSubmit(["done", "--plan", "docs/plans/full.md"], io, { cwd, readInput })` on the plan whose Briefing holds only its placeholder exits with 1 and names Briefing on standard error. `cstack report submit complete` exits with 1 and the message lists done, needs-decision, failed and published (US-9 AC1). `needs-decision` with an empty input exits with 1. An input over 65,536 bytes exits with 1, and so does an input that is not valid UTF-8. A `readInput` that returns nothing, as for a terminal, exits with 2. An accepted report exits with 0, prints one line and saves its file. After it, `cstack report check` prints the kind and the text and exits with 0. A second call exits with 1 and gives the message about launching the executor again. Two accepted reports come out oldest first. A report whose text holds `$(touch pwned)`, backticks and `; rm -rf ~` is saved and printed byte for byte, and no file named `pwned` appears in the test repository or in the current folder.
- Minimum code: `reportSubmit(args, io, { cwd, readInput })` in `cstack/src/commands/report-submit.ts`, with the exported reader of `process.stdin`, and `reportCheck(args, io, { cwd })` in `cstack/src/commands/report-check.ts`, as "Decisions" describes. Both find the plan with `locatePlan` and the run folder with `runFolder`.
- Refactor: none.
- Commit message: `feat(cli): submit and read the executor's report with cstack report submit and report check`
- Depends on: 3, 8

### Unit 10: Register the four commands in the command list and the command line — status: done (0b7b7d5)
- Files: `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts`, `cstack/test/cli.test.ts`
- Failing test: `cstack/test/manifest.test.ts` expects eight built entries and seven that are not built. In `cstack/test/cli.test.ts`, `run(["plan"])` and `run(["report", "nope"])` return 2 and list the known second words of their group. The existing tests then check that every built entry has a handler, that the usage lists the four new usage lines, and that each new command answers `--cstack-unknown-flag` with its usage line and exit code 2.
- Minimum code: set `built: true` on the four entries of this ticket in `cstack/src/manifest.ts`, and write the new meaning of exit code 1 of `cstack plan status`. In `cstack/src/cli.ts`, add the keys `plan` and `report` to `HANDLERS`. Each calls `dispatchSubcommand` with its built commands, `{ cwd: process.cwd() }`, and for `report submit`, the reader of `process.stdin`.
- Refactor: none.
- Commit message: `feat(cli): register cstack plan status, plan section, report submit and report check`
- Depends on: 2, 6, 7, 9

## Documentation duties

- The `## Commands` section of `README.md`: applies, written to `README.md`. Add one line for each of the four commands, and update the sentence that counts the commands. Keep the change small, because #18 edits the same lines.
- The comment on this ticket, #16: applies, written to https://github.com/gambitl/claude-code-stack/issues/16. It says what was built, the files, and the rules that differ from the ticket's text: the files `report-submit.ts` and `report-check.ts`, the level-2 rule of `plan section`, the clean worktree and the blocked units in the done check.
- Comments on the tickets this one feeds and the ones that read its code: applies, written to #15, #22, #23 and #27. #15 gets `lastAcceptedDoneReportAt` and the shape of a saved report. #22 gets how a helper calls `cstack plan section` and `cstack report submit`, with a quoted heredoc (`<<'EOF'`) so that the agent's own shell never runs `$(...)` in the report text. #23 gets the commands it can now run. #27 gets `checkReport`, `saveReport` and `takeOldestUnreadReport` in `cstack/src/report/reports.ts`.
- Code comments: applies, written to `cstack/src/commands/plan-section.ts` and `cstack/src/report/reports.ts`. A `WHY:` comment explains the level-2 rule of `plan section`, and another explains why the done check refuses any uncommitted change.
- An architecture decision record: does not apply. The decisions of this ticket are local rules of four commands, and the plan file and the pull request record them. The shape of a saved report was already fixed by ADR-SIC-B and `cstack/src/run-state.ts`.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. No user story or criterion changes.
- The conventions file `CLAUDE.md`: does not apply.

## Review log

### Phase 7: impact notes and review

Impact notes: no code graph on this machine. By search, `readPlan` is used by `phases.ts`, `commands/measure.ts` and tests, and the new line split does not change LF files. `cli.test.ts` and `manifest.test.ts` check handlers against built entries and were updated. The README Commands section was updated. Ticket #18 also edits `locate.ts`, `cli.ts` and `manifest.ts`, so conflicts are expected at the update onto main.

Four reviewers (correctness, security, conventions, simplicity). Fixed in commit a04bcc9:
- `plan section` exited 1 on a broken `state.json`; it now exits 3, with a test.
- `report submit` read all of standard input before the size check; it now stops after 64 KB, with a test.
- An absolute `--plan` path through a symbolic link (macOS /var) was refused by mistake; the lexical check is gone and the real path decides, with a test.
- Simplicity: one shared error helper (`commands/errors.ts`), `parseArgs` in three commands, the `present` helper removed, clearer wording of the kind error.

Left as follow-ups (not needed now): a `publish.json` of the wrong shape crashes with exit 1 instead of a reason (#20 writes that file); a `reports` path that is not a folder gives a raw error; `report check` prints report text unchanged, so terminal escape sequences would reach a terminal (Claude reads the output, so it is accepted). `lastAcceptedDoneReportAt` and the implementer roles have no caller yet; they are for #15 and #27. ADR-SIC-H says only `bin.ts` touches the process; `cli.ts` and `readStdin` read `process.cwd()` and `process.stdin` and inject them, which matches the plan.

<phase 8 below>

## Briefing

### What you should know about what was built

The branch adds the four commands of the ticket: `cstack plan status`, `cstack plan section`, `cstack report submit` and `cstack report check`. The shared report code lives in `cstack/src/report/reports.ts`. The commands do what the ticket asks, with the three rules you accepted before the plan: a blocked unit needs no commit, a level-2 heading wins, and the worktree must be clean. I ran the tests again: 303 pass, and the type check is clean.

**What to watch**

- **The merge with the ticket that adds `cstack unit commit` (#18).** Each branch carries its own `locate.ts` and its own `dispatchSubcommand`, with the same interface but different code. I checked it: all the tests of this branch pass with the copies of #18, and the `locate.ts` tests of #18 pass with ours. So the branch that merges second can keep one copy safely. The counts in `manifest.test.ts` then become ten built and five not built, and the README says "ten commands".
- **The "work is finished" report now refuses any uncommitted file, not only the plan.** The "ready" guide written by the ticket that rewrites the guides (#22) still says "the plan file". I will say it in the comment on #22, together with the quoted heredoc (`<<'EOF'`). In another repository, a stray file such as an unignored `.DS_Store` will block the report, and the message names it.
- **Two rules for the files of a unit.** `cstack unit commit` (#18) compares paths without case, and `cstack plan status` compares them exactly. So a commit that one accepts, the other can flag. Align the two after the merge, along with how `red.json` is read: #18 checks its content, this ticket only checks that it exists.

**What changed since the plan**

- The review added a small shared error helper (`commands/errors.ts`), a read of standard input that stops after 64 KB, and support for an absolute `--plan` path through a symbolic link.
- The usage lines of the four commands now show `[--plan <file>]`. The ones of #18 do not show it yet.
- A `publish.json` with the wrong shape makes `report submit published` crash with exit code 1 instead of giving a reason. That is left to the ticket that writes this file (#20).

#### Details

What was built matches the scope of the ticket and the rules in "Decisions". The ten units each have one commit with its trailer, and the review fixes are in a04bcc9, bb61ad0 and 85ad83e. I ran `npm test` (21 files, 303 tests) and `npm run typecheck` in `cstack/` on 85ad83e, and both pass. The worktree was clean before I wrote this block. `origin/main` is still at 618602f, so neither this branch nor #18 has merged yet, and #18 has not pushed its branch.

The merge with #18 is the main thing to watch. Its worktree `unit-commit-order` (8f71d18) has its own `cstack/src/plan/locate.ts` and its own `dispatchSubcommand` in `cstack/src/cli.ts`, as the coordinator allowed. The interfaces match exactly. The code differs in three visible ways. First, #18's `dispatchSubcommand` lists the second words of the group from the command list, including entries that are not built, so `cstack unit red 1` answers "unknown command red" and then lists `red` in the usage line. This branch's version lists only the words that have a handler, which matches the decision "each group passes only its built commands". Second, the messages of `PlanLocationError` differ in wording, and both test suites only check that the message contains `--plan <file>`. Third, a `state.json` whose `plan` points outside the repository exits with 3 in #18's copy and with 2 in this branch's copy. The coordinator only fixed the exit code for a `--plan` path outside the repository, so both are within the agreement, and 3 is the better fit because nobody typed that path. I tested the swap in a copy of `cstack/` in the scratchpad. With #18's `locate.ts` and #18's `dispatchSubcommand`, every test of this branch passes and the type check is clean (the only failure was the README test, which cannot find `README.md` outside the repository). With this branch's `locate.ts`, the `locate.test.ts` of #18 passes too. I did not run #18's `cli.test.ts` against this branch's `dispatchSubcommand`, but its only check is that the usage of `cstack unit` contains `order` and `commit`, which the handler keys give. The other conflicts are mechanical. `manifest.ts` marks entries as built in two styles: this branch passes a `built` field to `planCommand`, and #18 uses a spread. The counts in `cstack/test/manifest.test.ts` become ten built and five not built. The README sentence becomes "ten commands". The decision "keep both sides" does not work for two definitions of one function, so the second branch must choose one copy of each file. If nobody chooses, the person who resolves the conflict picks one by hand, and the tests catch nothing either way.

New question, non-blocking, for the coordinator, in English: "Tickets #16 and #18 each carry a copy of `cstack/src/plan/locate.ts` and of `dispatchSubcommand` in `cstack/src/cli.ts`. The interfaces match, and I checked that the tests of #16 pass with #18's copies. Which copy should the branch that merges second keep? I suggest #18's `locate.ts`, because #18 owns that file and it answers 3 when `state.json` points outside the repository. I suggest #16's `dispatchSubcommand`, because #18's version lists `red` and `green` in the usage of `cstack unit` while they are not built yet." The work of this ticket is complete and correct whatever the answer.

The clean worktree rule reaches the guides. `reports.ts` refuses a done report while `git status --porcelain=v1 -z --untracked-files=all` prints anything, as the user accepted. The guide `cstack/guides/resolve-issue/ready.md` on the branch of #22 (`build-prompts-guides`, lines 17 and 18) tells the executor to commit the plan file, and says that the report is refused "while the plan file has an uncommitted change". An executor that follows it literally will hit a refusal for any other leftover file. The comment on #22, already in the documentation duties, should say "any uncommitted change in the worktree" and show the quoted heredoc. In this repository `.gitignore` covers `.DS_Store`. A repository where neither its `.gitignore` nor the user's global excludes cover it will see the report refused after someone opens a folder in Finder. The refusal names the path, so the executor can recover, but it costs one round.

The two rules for the files of a unit come from #18. `cstack/src/commands/unit-commit.ts` on its branch compares the paths of a unit in lower case (lines 52 to 86), because the macOS file system ignores case. `cstack plan status` compares the files of a commit with `Files` exactly (`plan-status.ts`, the `allowed` set). A unit whose `Files` says `Readme.md` while git records `README.md` passes `unit commit` and is then flagged by `plan status` with exit code 1. #18 also adds `readSavedRun` in `cstack/src/saved-runs.ts`, which refuses a `red.json` without a valid time. This branch checks only that the file exists, in `plan-status.ts` with `existsSync` and in `checkImplementer` with `readFileSync`. After both merge, a follow-up should make `plan status` and `checkReport` use `readSavedRun` and the same case rule. The default, if nobody does it, is a rare false alarm in `plan status` and an implementer `done` accepted with a broken `red.json`.

A few things changed since the plan, beyond the review fixes listed in the Review log. Unit 4 lists the files of a commit with one `git diff-tree -r -z --no-renames` call per commit, as the plan's unit says, and not with the single `git log -z -M` call that my earlier details suggested. Both paths of a rename still appear, so the rule holds, and one git process per unit commit is cheap at this size. The usage lines in `manifest.ts` gained `[--plan <file>]`, which "Decisions" did not mention, and the usage lines of #18's `unit order` and `unit commit` do not have it yet, so the usage text will be uneven after the merge. The review left three follow-ups: a `publish.json` of the wrong shape crashes with exit code 1 instead of a reason, a `reports` path that is not a folder gives a raw error, and `report check` prints the report text unchanged, terminal escape sequences included.

Every earlier question was resolved as the user accepted it. The blocked unit rule is built by calling `buildDone` from `phases.ts`, together with `ticketCopied` and `noOpenQuestion`, so the build phase and the done report share one rule. The level-2 rule is in `plan-section.ts` with its `WHY:` comment. The clean worktree rule is in `reports.ts` with its `WHY:` comment. The real path check is in `locate.ts`, and a review fix extended it to an absolute `--plan` path through a symbolic link. The files of a commit come from git with `-z`, and a test covers `café.md`. The saved report is created with an exclusive temporary file and a hard link, so two saves at the same millisecond keep both reports, and the JSON keeps the real ISO time. `lastAcceptedDoneReportAt` is exported for #15. Windows line endings are read, which closes the maintainer's follow-up. The concurrent `report check` risk stays accepted.

I cite these locked decisions and do not reopen them: ADR-SIC-H for the exit codes and `process.exit()`, ADR-SIC-B for the run state and the `cstack-run/1` format that now covers the saved report, the #13 command list for the file names and exit code 2 of `plan section`, and the settled executor hand-off in the frozen `skills/resolve-issue/SKILL.md`. I checked security and authorization (the report text never reaches a shell, and the test with `$(touch pwned)` passes), scale and performance, operations and cost, reversibility and UX edge cases, and found nothing beyond the points above.

## Open questions after the build


### Blocking

none

### Non-blocking

"Tickets #16 and #18 each carry a copy of `cstack/src/plan/locate.ts` and of `dispatchSubcommand` in `cstack/src/cli.ts`. The interfaces match, and I checked that the tests of #16 pass with #18's copies. Which copy should the branch that merges second keep? I suggest #18's `locate.ts`, because #18 owns that file and it answers 3 when `state.json` points outside the repository. I suggest #16's `dispatchSubcommand`, because #18's version lists `red` and `green` in the usage of `cstack unit` while they are not built yet." For: the coordinator.

## Pull request

Title: feat(cli): read the plan and check the helper reports with cstack plan and cstack report

```markdown
## What this adds

`cstack` now tells the true status of each unit of a plan from git, prints one section of a plan on request, and accepts a helper's report only when the plan and git prove it. There are four new commands: `cstack plan status [--json]`, `cstack plan section <name>`, `cstack report submit <kind>` and `cstack report check`. Each takes `--plan <file>`. The shared code is in `cstack/src/report/reports.ts`, and the commands are in `cstack/src/commands/`.

## Decisions that matter

- A done report is refused for any uncommitted change in the worktree, not only for the plan file. A forgotten review fix would otherwise stay out of the pull request.
- A unit with a `Blocked` line does not need a commit for a done report.
- When several headings match a name and exactly one is level 2, `plan section` prints that one. So a `### Documentation` heading in a ticket never hides `## Documentation`. Two other matches exit with 3.
- The command files are `report-submit.ts` and `report-check.ts`, as the command list says, not `report.ts`.
- The text of a report is read from standard input and never reaches a shell or a command line. A test with `$(touch pwned)`, backticks and `; rm -rf ~` checks it.
- `readPlan` now reads a plan with Windows line endings.
- This branch carries its own copy of `cstack/src/plan/locate.ts` and of `dispatchSubcommand`, with the interface that ticket #18 also uses. When #18 merges first, keep one copy.

## What the reviews changed

The review found that `plan section` exited with 1 on a broken run state, that `report submit` read all of standard input before checking its size, and that an absolute `--plan` path through a symbolic link was refused by mistake. All three are fixed with tests. It also led to one shared error helper and `parseArgs` in the commands.

## Judgment calls

- `report submit` waits until standard input closes. An agent that calls it without a pipe on an open input waits too.
- The usage lines of the four commands show `[--plan <file>]`. The ones of #18 do not yet.
- The exit code table of `plan section` in `manifest.ts` describes exit 2 only as "no heading matches". A usage error also exits with 2.

## Follow-ups, not done here

- A `publish.json` of the wrong shape crashes `report submit published` with exit 1 instead of giving a reason. The ticket that writes that file (#20) can tighten it.
- `cstack plan status` compares unit files exactly, while `cstack unit commit` (#18) ignores case. Align them after both merge.

## Open questions, not needed for this pull request

This pull request can be merged without these answers.

- For the coordinator: tickets #16 and #18 each carry a copy of `cstack/src/plan/locate.ts` and of `dispatchSubcommand`. The interfaces match, and the tests of #16 pass with #18's copies. Which copy should the branch that merges second keep? I suggest #18's `locate.ts` and #16's `dispatchSubcommand`.

Plan file: `docs/plans/2026-11-18-16-read-the-plan-and-check-the-helper-reports.md`.

Fixes #16
```


## Documentation

- Comment on #16: https://github.com/gambitl/claude-code-stack/issues/16#issuecomment-6978675006
- Comment on #15: https://github.com/gambitl/claude-code-stack/issues/15#issuecomment-6978675522
- Comment on #22: https://github.com/gambitl/claude-code-stack/issues/22#issuecomment-6978675983
- Comment on #23: https://github.com/gambitl/claude-code-stack/issues/23#issuecomment-6978676472
- Comment on #27: https://github.com/gambitl/claude-code-stack/issues/27#issuecomment-6978676961
- `README.md`, section Commands: four lines added and the count updated (committed).
- `WHY:` comments in `cstack/src/commands/plan-section.ts` and `cstack/src/report/reports.ts` (committed).
- ADR: none, as the plan says. The specification page and `CLAUDE.md` do not change.
- The pull request link is not in the comments yet: phase 12 does not edit them (no ADR to link), so the pull request body says `Fixes #16`.


## Executor notes

- Graphify is not installed, so the impact notes came from search and file reads.
- Implementer for unit 3 and for unit 5 wrote tests and code together and never saw the test fail first; the tests pass and cover the cases of the unit.
- The review reversed nothing, but it found three real bugs after the units were green (plan section exit code on a broken state.json, unbounded read of standard input, absolute --plan through a symlink); the plan's unit tests did not cover them.
- GitHub has no in-progress state or label for ticket #16 (labels: cli, tests), so the ticket was not moved.
- A BSD sed command failed on macOS during a one-line edit; I used the Edit tool instead.
- The plan did not say what the accepted-report line holds; the implementer added the allowed kinds and the independent review removed them.

## Hand-off log

- 2026-11-18, run 1: ticket #16 has no in-progress state or label on GitHub (labels: cli, tests), so it stays open. Branch `gambitl/plan-read-reports` already existed; the plan file is its first commit.


## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**A unit with a `Blocked` line does not stop the "work is finished" report.** The ticket asks for a commit on every unit before that report. But the end-of-build check (`buildDone` in `cstack/src/phases.ts`) already skips a unit that has a `Blocked` line. With the ticket's rule, a ticket with one unit waiting for its design could never be reported finished. I recommend the same exception, by calling that same code, so the two rules can never drift apart.

**When a ticket heading has the name of a plan section, the plan section wins.** A ticket written in Jira or Linear can have its own "Documentation" or "Decisions" heading. It lands as `### Documentation` under `## Ticket`. With the ticket's rule, `cstack plan section Documentation` then exits with 3, and nobody can read that section of the plan any more. I recommend this: when exactly one matching heading is a level-2 section, print it. That is the reason #13 moved the ticket headings down one level. Two `### Unit 3` headings still exit with 3.

**The "work is finished" report also refuses uncommitted code, not only an uncommitted plan.** Today only the plan file is checked. A review fix left uncommitted would pass, and the push would leave it out. I recommend refusing any tracked change and any untracked file, except what `.gitignore` covers.

**I will do this unless you say no.**

- I follow the draft answers for the file names, the dispatch on the second word in `cli.ts`, the output of `plan status`, the heading list of `plan section`, and Windows line endings.
- The commands find the plan by calling `locatePlan` from `cstack/src/plan/locate.ts`, which #18 writes. I add that file only if I push before #18 merges, with exactly its agreed name and behaviour. Whoever writes it, the "outside the repository" check must compare real paths.
- The "work is finished" report does not check what `plan status` reports, such as a commit of an unknown unit. Those stay visible in `plan status`.
- The files of each commit come from `git log` with `-z` and `-M`, so renamed and non-ASCII file names come out right.
- Each report file is created in exclusive mode, so two reports in the same millisecond never overwrite each other. The JSON keeps the real ISO time, because the publish phase compares it.

**I checked it myself.**

- In an agent's shell, standard input is `/dev/null`. The command gets an empty text at once and never waits.
- `git diff --quiet` sees neither an untracked nor a staged plan file, and `git status --porcelain` sees both. This plan file is untracked right now.
- In a repository under the macOS temporary folder, git answers `/private/var/...` while Node gives `/var/...`, so a plain path check calls the plan "outside the repository".

**Good to know.**

- #18 changes the same count in `cstack/test/manifest.test.ts` (line 116), so the second branch to merge gets a conflict there.
- The saved report shape is part of the run format `cstack-run/1`. Changing it later means a new run format.
- Nothing writes `Ready for review at` before `cstack next` (#15) lands, so the tests write it in their fixtures.

#### Details

The unit with a `Blocked` line is draft question 1. It stays blocking, because it changes the done rule of scope 4. No test can settle it, so the user decides. `buildDone` in `cstack/src/phases.ts` (line 71) skips the units whose `blocked` field is set. The reader refuses an empty `- Blocked:` line, so `blocked` always carries a reason. Suppose the done report keeps the ticket's wording. Then a ticket whose executor writes a `Blocked` line can only end with a needs-decision report, while the build phase says it is done. I agree with the draft recommendation, and I add one thing. Export `buildDone`, `noOpenQuestion` and `ticketCopied` from `phases.ts`, and build the done check from them. `ticketCopied` matters here too. `DONE_REPORT_SECTIONS` starts with Ticket, and the `filled` flag of Ticket is always true, because the section holds `### Decisions already taken upstream`. A check that reads `filled` for every name of the list would accept a plan whose ticket was never copied. I rejected a second copy of these rules in `cstack/src/report/reports.ts`, because the build phase and the done report would then drift apart. If nobody decides, the ticket's wording applies, and a blocked unit makes the done report impossible.

The heading collision is my own point. It is blocking, because it changes the matching rule of scope 3, and only the user can decide it. The reader keeps the ticket's headings at level 3 or deeper (`read.ts`, the rule "a heading of the ticket needs to move down one level"). Decision 3 of the #13 plan gives the reason: the reader must find the plan's own sections without any confusion with the ticket's. The tickets of this repository only use the headings Why this matters, Where things are today, Scope, Acceptance (TDD) and CTO review, so nothing collides today. But the epic says that no ticket assumes a tracker. A ticket written by a person in Jira or Linear often has a "Documentation" or "Architecture" heading, and a copied ticket comment can have one too. With the plain rule, `cstack plan section Documentation` then exits with 3 for the whole life of that plan. The helper that writes the documentation cannot read its section. The recommendation works in two steps. First, collect every matching heading. When exactly one of them is level 2, print it. Otherwise, a single match prints, and two or more matches exit with 3. Every acceptance test of the ticket still passes, including the case of two `### Unit 3` headings. I rejected matching level 2 only, because `Unit 1`, `Scope` and `Acceptance` would stop working. If nobody decides, the ticket's rule applies, and the collision shows up only on such a ticket.

The clean worktree is my own point. It is blocking, because it adds a condition to the done check of scope 4, and the user decides. The ticket and the #13 command list refuse a done report only while the plan file has uncommitted changes. The review fixes of phases 7 and 8 are commits without a unit trailer, so the unit check does not see them. A fix left in the worktree therefore passes every done condition. `cstack publish` (#20) pushes commits only, so that fix never reaches the pull request. Nobody notices until a reviewer asks. The recommendation is to run `git status --porcelain=v1 -z --untracked-files=all` on the whole worktree. The report is refused when it prints anything, and the message names up to ten paths. That command does not list ignored files, so build output and `graphify-out/` do not count. The cost is that a stray untracked file blocks the report until the executor removes it or ignores it. The message says so. If nobody decides, only the plan file is checked, as the ticket says. Either way, the plan file check must also catch an untracked or a staged plan file. The paragraph about the git check below gives the evidence.

The file names (draft question 2), the dispatch on the second word (question 4), the output of `plan status` (question 7), the heading list of `plan section` (question 8) and Windows line endings (question 11) are non-blocking. I keep their recommendations unchanged. The coordinator fixed the dispatch on 2026-11-18. #16 writes it as `dispatchSubcommand(group, args, io, handlers)`, exported from `cstack/src/cli.ts`, and #18 uses it. A missing or unknown second word prints a usage line with the known second words and returns 2. Each group passes only its built commands in `handlers`. So `unit red` and `unit green` (#17) get that usage error while #18's `unit order` and `unit commit` work. The test at `cstack/test/cli.test.ts` line 117 checks the handlers by first word only, so a unit test of `dispatchSubcommand` itself is the place to check the second words. I checked the answer about Windows line endings against the built reader. `readPlan` on `approved.md` converted to CRLF throws "This plan file has no Format line". The reason is that `.` in the `Format` pattern does not match `\r`.

How a command finds the plan file is draft question 3. The coordinator answered it on 2026-11-18. #18 writes the lookup as `locatePlan` in `cstack/src/plan/locate.ts`, and the commands of #16 call it. #16 must not write a second lookup. If #16 is ready to push before #18 merges, #16 adds `locate.ts` with exactly that name and behaviour, and says so in its pull request. The branch that merges second keeps one copy. One point still applies to whoever writes the file. The check "a `--plan` path outside the repository exits with 2" must compare real paths. I tested it in a repository created under `os.tmpdir()` on macOS. There, `git rev-parse --show-toplevel` returns `/private/var/folders/...`, and `path.resolve` gives `/var/folders/...`. A plain `path.relative` then says that the plan is outside the repository. Every test of this ticket runs in such a folder. Use `realpathSync` on the repository root and on the folder of the plan file, because the plan file itself may not exist yet. Also resolve `state.plan` from the repository root, not from the current folder. `state.json` stores it relative to the root (`run-state.ts` line 29). `runFolder` uses only the base name of the plan file, so two plans with the same name in different folders share one run. That is the design of #13, and I do not reopen it.

Draft question 5 asks whether the done report also refuses what `plan status` finds. It stays blocking, as labelled, and I keep the recommendation "no". The ticket lists the done conditions exactly. The unknown-unit check and the outside-`Files` check would refuse done reports for reasons that the reviews already judge. If the user wants them, each one is a single call to the functions that `plan status` uses.

The git check behind `plan status` is draft question 9. It is non-blocking, and I amend how it runs. I tested `git diff-tree`. Without `-z`, a file named `café.md` comes out as `"caf\303\251.md"`, quoted and escaped. `plan status` would then report it outside its unit, with a garbled name. Without `-M`, a rename comes out as a delete and an add. Both paths still appear, so the draft rule "count both the old and the new path" holds either way. `-M` only makes the message clearer. Plumbing commands ignore the user's `diff.renames` setting, so the output does not depend on the machine. One call to `git log -z --name-status -M --format=<marker>%H base..HEAD` gives the files of every commit at once. That replaces one `git diff-tree` per commit. A merge commit shows no files by default. That is fine, because a merge commit carries no unit trailer.

Standard input is draft question 6, and it is non-blocking. I checked it from an agent's Bash tool. There, file descriptor 0 is a character device, `isTTY` is undefined, and a read gives end of file with 0 bytes at once. So the command never hangs there. The rule "standard input is a terminal, exit with 2" only fires in a real terminal, such as an Orca terminal, which I did not test. An agent that forgets to pipe its text sends an empty report. The check refuses it for needs-decision and failed, and accepts it for done and published, as the ticket says. The guides of #22 should show a quoted heredoc (`<<'EOF'`). An unquoted heredoc lets the agent's own shell run `$(...)` before cstack sees the text. That belongs to #22, not to this ticket. It is one line for the comment on #22 at the documentation phase.

The saved report is draft question 10. It is non-blocking, and I amend it. The file name holds a time in milliseconds, so two reports written in the same millisecond get the same name. `writeFileAtomic` would then silently replace the first one. Create the file with the `wx` flag, and add a counter when the call fails with `EEXIST`. Keep the real ISO time in the `time` field of the JSON. `publishStart` in `phases.ts` (line 79) parses `lastAcceptedDoneReportAt` with `Date.parse`, and the form of the file name, with `-` instead of `:`, does not parse. Export a function that returns the time of the last accepted done report, because `cstack next` (#15) has to fill that field. The code mapping lists one more risk: two `report check` calls at the same moment could both print the same report. I accept that risk. Only the main conversation calls `report check`, once each time the executor returns.

An earlier version of this block proposed a note to the session of #18 about the lookup and the dispatch. The coordinator already settled both with #18 on 2026-11-18, so no message goes from this ticket.

The good-to-know items have their evidence here. `cstack/test/manifest.test.ts` line 116 hard-codes the counts of built and not-built entries, and both this ticket and #18 change them. ADR-SIC-B says that the run state carries a version. `SavedReport` (`run-state.ts` line 43) has no version of its own, so the format `cstack-run/1` covers its shape. #27 and #15 will read that shape. The `ready` phase writes `Ready for review at` (`phases.ts`, its `writes` list), and #15 performs that write. Until #15 lands, only a fixture or a person writes it, and the template says not to edit it by hand.

I cite these locked decisions and do not reopen them. ADR-SIC-H sets the exit codes and forbids `process.exit()`. ADR-SIC-B puts the run state under the common git folder. The #13 command list fixes the file names, `--plan` on every plan command, and exit code 2 for "no heading matches", which shares its code with usage errors. The executor hand-off in `skills/resolve-issue/SKILL.md` (line 200) is settled. I checked security and authorization, scale and performance, operations and cost, and UX edge cases beyond the points above, and found nothing more in them.

### Open questions and answers

Every question below is for the user. None needs someone outside the conversation.

1. **A unit with a `Blocked` line and the done report.** Blocking. Scope 4 says that a done report needs a commit for every unit. `buildDone` in `cstack/src/phases.ts` (line 71) does not ask a commit of a unit that has a `Blocked` line, for example a user-interface unit that waits for its design. With the ticket's rule, such a run can never report done. Recommendation: a done report does not need a commit for a unit that has a `Blocked` line, the same rule as the done check of the `build` phase.
2. **The file names of the report commands.** Non-blocking. The command list names `report-submit.ts` and `report-check.ts`, and its test requires the file of a built entry to exist. Scope 4 of the ticket says `report.ts`, because the ticket was written before the command list. Recommendation: follow the command list. Put the shared code, which is the check, the save and the reading of the oldest report not shown yet, in `cstack/src/report/reports.ts`, so that #27 imports it from one place.
3. **How a command finds the plan file.** Blocking, because #18 needs the same rule. Recommendation, as #15 defines it: `--plan <file>` wins. Without it, the plan path is the `plan` field of the `state.json` of the run named in `current-run`. When there is no `--plan` and no usable run, the command exits with 2 and asks for `--plan`. A `--plan` path outside the repository exits with 2, as in #15. The lookup lives in a new file, `cstack/src/plan/locate.ts`, and I ask the coordinator to tell #18 so that it reuses it.
   Coordinator's answer, 2026-11-18: ticket #18 writes this lookup as `locatePlan` in `cstack/src/plan/locate.ts`. Ticket #16 must not write a second one, and its commands call `locatePlan`. The behaviour follows #15. `--plan` wins and is read from the current folder. A `--plan` path outside the repository is refused with exit code 2. Without `--plan`, it uses the run named in `current-run`, then the plan path in that run's `state.json`. With neither, it exits with code 2 and asks for `--plan <file>`. It only reads and never changes `current-run`. If #16 is ready to push before #18 merges, #16 adds `locate.ts` with exactly that name and behaviour, and says so in its pull request. The branch that merges second keeps one copy.
   Second answer from the coordinator, 2026-11-18: #18 had planned small differences, so the coordinator merged both into one interface for both branches. The error class is `PlanLocationError` with exit code 2 or 3, and `LocatedPlan` holds `root`, `path` and `relative`. A missing `--plan` file and a run without `state.json` exit with 3. "Decisions" holds the full interface.
4. **The dispatch on the second word in `cli.ts`.** Non-blocking. Recommendation: one small generic function in `cli.ts` sends `plan status`, `plan section`, `report submit` and `report check` to their commands. #18 can use it for `unit`. The change to `cli.ts` stays at a few lines.
   Coordinator's answer, 2026-11-18: ticket #16 writes it, and #18 uses exactly this. It is exported from `cstack/src/cli.ts` as `dispatchSubcommand(group: string, args: string[], io: Io, handlers: Record<string, (args: string[], io: Io) => Promise<number>>): Promise<number>`. When the second word is missing or unknown, it prints on standard error a usage line that lists the known second words of the group, and returns 2. It uses the `Io` type that `cli.ts` already uses. A different signature needs the coordinator's agreement first, so that #18 can follow.
5. **Does the done report also check what `plan status` finds?** Blocking. `plan status` exits with 1 when a commit names a unit that the plan does not have, or when a unit commit changes a file outside its `Files`. The ticket does not ask the done check to refuse these cases. Recommendation: no. Keep the done check as the ticket lists it. The disagreements show in `plan status` and in the reviews.
6. **Standard input.** Non-blocking. Recommendation: the `report submit` function receives a function that reads the input, and `cli.ts` passes one that reads `process.stdin`. When standard input is a terminal, the command exits with 2 and says to pipe the text. More than 65,536 bytes exits with 1. A text that is not valid UTF-8 exits with 1, so that the saved text is exactly the input.
7. **Output of `plan status`.** Non-blocking. Recommendation: one line per unit, such as `Unit 2: <name>: done (abc1234, def5678), failing run saved`. "blocked: <reason>" is added when the unit has a `Blocked` line. A short hash is the first seven characters. The disagreements follow on standard error, one per line. `--json` prints `{ "units": [...], "problems": [...] }` with full hashes.
8. **`plan section` when nothing matches.** Non-blocking. Recommendation: list every heading of the file except the title, in file order. The printed section drops its trailing blank lines.
9. **Edge cases of the git check.** Non-blocking. Recommendation: a commit with two `Cstack-Unit` trailers changes a file outside its units only when neither unit lists that file. A trailer value that is not a number, such as `Cstack-Unit: abc`, is also a disagreement and exits with 1. A renamed file counts with both its old and its new path.
10. **The saved report.** Non-blocking. Recommendation: the file is `reports/<time>-<kind>.json`, where the time is the UTC ISO time with `:` replaced by `-`, such as `2026-11-18T10-15-30.123Z-done.json`. `readAt` is absent until the report is shown. `report check` prints the kind on the first line and the text unchanged after it.
11. **Windows line endings.** Not a question: the maintainer's comment asks for it. `readPlan` splits the text with `/\r?\n/`. I checked it: today the reader answers "This plan file has no Format line" on `approved.md` converted to CRLF.

**Answers, 2026-11-18.** The user answered "très bien, go" to the short version of "Questions you may not be asking". That accepts the three recommendations that needed an answer: a unit with a `Blocked` line needs no commit for a done report (question 1); when several headings match and exactly one is level 2, `plan section` prints that one (the advisor's heading point); and a done report is refused while the worktree holds any uncommitted change (the advisor's clean worktree point). It also accepts every item of "I will do this unless you say no", which covers questions 2, 4, 5, 6, 7, 8, 9 and 10 with their recommendations as amended in the advisor's details. Question 3 and question 4 were settled by the coordinator, as written under them. Each final answer is a rule in "Decisions".

### Architecture options

There was no real choice. The ticket, the command list of #13, the coordinator's answers and the question round fixed the approach. No new structural decision appeared while the plan was written, so the advisor was not called again.
- 2026-11-18, run 1 (phases 6 to 10): ten units built and committed (one commit each), four reviewers and the independent reviewer fixed seven points, main did not move so no rebase, briefing written, five ticket comments left. Returned done.
