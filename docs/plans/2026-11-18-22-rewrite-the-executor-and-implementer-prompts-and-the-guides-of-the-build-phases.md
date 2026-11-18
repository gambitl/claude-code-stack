# Plan: #22 — M2-10: Rewrite the executor and implementer prompts and the guides of the build phases

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/22
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/build-prompts-guides
Conversation language: French
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Rewrite the instructions of the two helpers that build the code, so that they call `cstack` for every mechanical step, and split the build instructions into one short guide per step.

- **What the title means**: A prompt is the page of instructions that a helper reads when it starts. The executor is the helper that runs the build from the approved plan. An implementer is the helper that builds one unit, which is one small piece of work with its own test and its own commit. The build phases are the steps that follow the user's approval of the plan. They build the units, review them, document them, and open the pull request, which is the request to merge the work into the main code. A guide holds the instructions of one phase, and `cstack`, the command-line tool of this project, prints it when its phase starts.
- **Why we are doing it**: Today the executor reads about 3,400 words of instructions for every phase at once. It also does by hand steps that a program does better, such as staging the files of a unit or checking a report. The retrospectives show that these hand steps go wrong.
- **For the user**: A solution engineer's build reads less, so it uses less of their Claude subscription. Each mechanical step now goes through a tested command, so the build stops less often halfway.

**Goal.** This ticket delivers the new executor and implementer prompts, the other agent prompts copied next to them, and the guides of the build phases, which use the commands of US-7 to US-12. Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #9 ships only an example skill, and #13 adds the phase list. None of them is in the repository yet. The files below are the prose that this ticket replaces.
* **The executor today**: `skills/resolve-issue/agents/executor.md` holds 3,425 words, as `wc -w` counts them. Lines 4 and 5 give its model and thinking level. Lines 12 to 17 list its inputs, and line 29 says how it resumes. Lines 31 to 33 hold the push rule. Lines 115 to 117 describe the executor notes, and lines 119 to 128 the four reports. Line 121 writes the report in English.
* **The build phases today**: `skills/resolve-issue/agents/executor.md` holds phase 6 (lines 35 to 43), phase 7 (lines 45 to 49), phase 8 (lines 51 to 53), phase 9 (lines 55 to 59), phase 10 (lines 61 to 99) and phase 12 (lines 101 to 113). Line 39 commits the plan file first. Line 40 runs independent units in parallel, and line 41 relaunches a stuck unit. Line 47 runs `graphify update .`, and line 57 always rebases.
* **The implementer today**: `skills/resolve-issue/agents/implementer.md`: line 20 finds the plan sections with `grep`. Line 23 writes the failing test and sees it fail, lines 24 to 36 hold the ladder of the minimum code, and line 34 commits. Line 38 forbids it to edit the plan file. Lines 40 to 49 list when to stop, and lines 51 to 56 hold its two reports.
* **The main conversation's build steps today**: `skills/resolve-issue/SKILL.md` holds phase 11, the retrospective (lines 165 to 179), the main conversation's side of phase 12 (lines 181 to 189), and the closing notice (line 193). `skills/resolve-issue/templates/retro.md` is the retrospective template.
* **The other prompts**: `skills/resolve-issue/agents/` also holds `code-architect.md`, `code-explorer.md`, `code-reviewer.md`, `code-reviewer-deep.md`, `code-reviewer-simplicity.md`, `cto-review.md`, `implementer-escalation.md` and `pr-reviewer.md`. `implementer-escalation.md` (line 12) reads `~/.claude/skills/resolve-issue/agents/implementer.md`, so it follows the new implementer. `pr-reviewer.md` (line 21) runs `graphify update .`. `cto-review.md` (lines 29 and 31) writes the plan file in English.
* **How Claude Code loads the prompts**: `skills/resolve-issue/.claude-plugin/plugin.json` (line 2) names the plugin `resolve-issue`. Claude Code therefore loads the prompts of `agents/` as agents named `resolve-issue:<name>`.
* **Contract**: from #13, #14 and #9. The build phases are `build`, `review`, `independent-review`, `update-branch`, `document`, `briefing`, `after-build-questions` and `ready`, then `retro` and `publish`. All run in the executor, except `retro`, which runs in the main conversation. Their guides live in `cstack/guides/resolve-issue/<phase>.md`. The executor joins the run with `cstack next --plan <file>`. `cstack next --done <phase>` closes a phase and prints the next guide, or one line when the next phase runs in the other place. `cstack next --done ready` needs the Pull request and Executor notes sections filled, and writes the Status `ready for review` and its time. The units use `cstack unit order`, `cstack unit red <n>`, `cstack unit green <n>` and `cstack unit commit <n>`, and each also takes `--plan <file>`. `cstack plan status` and `cstack plan section <name>` read the plan. The executor ends with `cstack report submit <kind>`, where the kind is `done`, `needs-decision`, `failed` or `published`. `cstack graph ensure` exits with `4` when Graphify is missing. `cstack publish` exits with `1` when it refuses before a push, `4` for a missing forge client, `5` when a push or forge call fails, `6` for a failed check, `7` for checks still running and `8` for a conflict. The plan has `## Blocking questions`, with `- Answer: open` until answered, and `## Non-blocking questions`. Its `## Pull request` section holds a `Title:` line and the body in a fenced block of four backticks marked `markdown`. Once #23 wires it, `cstack next` prints the settings above each guide, with `integration`, `recordsLanguage` and `review`. `cstack skills install` copies the whole skill folder, hidden files included.

## Scope

1. Rewrite `cstack/skills/resolve-issue/agents/executor.md`. Keep its front matter, with its model and thinking level. Aim for under 1,000 words.
   - Keep the inputs of lines 12 to 17, including the path of `writing.md`.
   - The executor runs `cstack next --plan <plan file>`, follows the guide, and runs `cstack next --done <phase>` at the end of the phase. It repeats this until cstack says that the next phase runs in the main conversation.
   - It then ends with `cstack report submit <kind>`, with the report on standard input. It ends only after cstack accepts the report. Its last message is one line that names the kind of the report.
   - To resume, `cstack next` already knows the next phase, and `cstack plan status` knows which units are done.
   - The executor never runs `git push`. Only `cstack publish` pushes, in the `publish` phase. Keep one exception from line 33: a pipeline run that a line of "Decisions" asks for as evidence.
   - Keep the executor notes of lines 115 to 117, and the content of the four reports of lines 123 to 126. Write the report in the records language of the settings instead of English (line 121).
2. Rewrite `cstack/skills/resolve-issue/agents/implementer.md`. Keep its front matter, the ladder of lines 24 to 36, the rule of line 38, the stop conditions of lines 40 to 49, and the reports of lines 51 to 56.
   - The implementer reads its sections with `cstack plan section`, instead of `grep` (line 20). The sections are its unit, "Decisions", "Architecture", "Code mapping", "Where things are today", "Scope", "Acceptance" and the CTO review block when there is one.
   - For a unit with a `Test` line, the implementer writes the test and runs `cstack unit red <n>`. The saved failure must show the reason the unit expects. It then writes the minimum code and runs `cstack unit green <n>`. After the refactor, it runs `cstack unit green <n>` again. Last, it runs `cstack unit commit <n>`.
   - For a unit with a `No test` line, the implementer makes the change and runs `cstack unit commit <n>` directly.
   - The implementer passes `--plan <plan file>` to each of these commands, because it receives the plan file path as an input. The commands then work the same in any worktree.
   - The implementer never runs `git add`, `git commit` or `git push` itself.
   - Add one stop condition. When `cstack unit commit` refuses because the unit needs a file outside its `Files`, the implementer stops and reports stuck.
   - Its done report gives the hash that `cstack unit commit` printed.
3. Copy the other eight prompts of `skills/resolve-issue/agents/` into `cstack/skills/resolve-issue/agents/`, with only two edits.
   - In `pr-reviewer.md` (line 21), replace `graphify update .` with `cstack graph ensure`.
   - In `cto-review.md` (lines 29 and 31), replace "in English" with the records language of the settings, which is English by default.
4. Copy `skills/resolve-issue/.claude-plugin/plugin.json` and `skills/resolve-issue/templates/retro.md` into the same places under `cstack/skills/resolve-issue/`. `cstack skills install` of #9 then ships every prompt, and Claude Code loads them as `resolve-issue:<name>`.
5. Write the guide `build.md` from today's phase 6 (lines 35 to 43).
   - Keep the move of the ticket to "in progress", the branch named on the `Branch` line, and the plan file as the first commit.
   - Run `cstack unit order`. Launch the units of one batch in parallel, one `resolve-issue:implementer` per unit, with the plan file path, the unit number and the conventions file path. Wait for every report of the batch, run `cstack plan status`, then start the next batch.
   - A stuck unit goes to `resolve-issue:implementer-escalation`, as line 41 says. When the second attempt needs a file outside the unit's `Files`, add the file to that line with a note, but only when no unfinished unit lists it. Then run `cstack unit order` again. Otherwise, return a needs-decision report.
   - Keep the check of user-interface units (line 42). A blocked unit gets a `- Blocked:` line, and the executor finishes the other units first (line 43).
6. Write `review.md` from today's phase 7 (lines 45 to 49). It starts with `cstack graph ensure` instead of `graphify update .`. The fixes of the review are ordinary commits, without the trailer `Cstack-Unit`.
7. Write `independent-review.md` from today's phase 8 (lines 51 to 53). Launch `resolve-issue:pr-reviewer` with the agent and the model of the `review` setting, as ADR-SIC-D decides. Pass a model only when it differs from the prompt's header. When the setting names an agent other than Claude and the harness cannot start it, return a needs-decision report that names the agent.
8. Write `update-branch.md` from today's phase 9 (lines 55 to 59). Follow the `integration` setting: rebase onto the target branch, or merge the target branch in. Keep the rule for a conflict that is ambiguous, which ends with a needs-decision report.
9. Write `document.md` from today's 10.3 (lines 79 to 89), and `briefing.md` from today's 10.1 (lines 65 to 67). The briefing now runs after the documentation, so it can name the places where the work was documented. When the advisor raises a trade-off here that needs a decision record, the executor writes that record in this phase.
10. Write `after-build-questions.md` from today's 10.2 (lines 69 to 77). A blocking question goes into `## Blocking questions` with `- Answer: open`. A non-blocking question goes into `## Non-blocking questions`.
11. Write `ready.md` from today's 10.4 (lines 91 to 99).
    - The executor drafts the `Pull request` section as a `Title:` line and the body in a fenced block of four backticks marked `markdown`.
    - It writes the executor notes and the hand-off log, then runs `cstack next --done ready`, which writes the Status and the time.
    - It commits the plan file, then runs `cstack report submit done`.
12. Write `retro.md` from today's phase 11 (lines 165 to 179), for the main conversation.
    - Claude writes the retrospective from `templates/retro.md` and commits it with a `docs` commit, then runs `cstack next --done retro`.
    - Claude keeps the "Digest due" notice that cstack may print, and shows it as the very last thing of the run, as line 193 says.
    - When cstack says that `publish` comes next, Claude launches the executor with the same inputs. When it returns, Claude runs `cstack report check` and handles the report as the `plan` guide of #21 says.
13. Write `publish.md` from today's phase 12 (lines 103 to 113). The executor runs `cstack publish` and acts on its exit code.
    - On `0`, it moves the ticket to "in review" when the forge did not (line 109), and adds the pull request link to the decision records (line 111). Then it runs `cstack next --done publish` and `cstack report submit published`.
    - On `6`, it fixes the check test-first in a new commit. The same commit adds a line to "Executor notes" and an item to the retrospective's "Improve" heading (line 110). Then it runs `cstack publish` again.
    - On `7`, it submits `published` and says that checks still run.
    - On `8`, it resolves the conflict as the `update-branch` guide says, commits, and runs `cstack publish` again.
    - On `1`, it reads the reasons. An open blocking question leads to a needs-decision report. On `4` or `5`, it submits `failed` and names the problem.
    - Keep the rule of line 113: in this phase, the executor writes to the plan file only inside a fix commit that it pushes.

## Acceptance (TDD)

* `cstack/test/guides/build-guides.test.ts`: write first a fixture folder where `publish.md` is missing, and check that the test fails and names it. Then each phase from `build` to `publish`, `retro` included, has its guide.
* `cstack/test/prompts.test.ts`: write first a fixture implementer prompt that names `cstack unit commit` before `cstack unit green`, and check that the test fails. Then the real implementer prompt names `cstack unit red`, `cstack unit green` and `cstack unit commit` in this order. It says that a `No test` unit goes straight to `cstack unit commit`.
* `cstack/test/prompts.test.ts`: the real executor prompt names `cstack next` and `cstack report submit`, and the four report kinds, and no other kind. `git push` appears in no build guide and in no prompt, except the one sentence of the executor prompt about a pipeline run that a line of "Decisions" asks for.
* `cstack/test/skills-package.test.ts`: `cstack skills install` into a temporary home installs `resolve-issue` with its ten agent prompts, the files of `templates/`, `writing.md`, `settled-decisions.md` and `.claude-plugin/plugin.json`.
* The command list test of #13 and the settings test of #21 pass over the two prompts and every build guide.
* A reviewer counts the words of the new `executor.md` with `wc -w` and finds fewer than 1,000, down from 3,425.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #13, #9 · Feeds: #23


### Ticket comments

Comment by the maintainer on 2026-11-18:

The work of ticket #9 gives you what you need to ship the build prompts and guides. Here is what to build on.

Where things go: a skill goes in `cstack/skills/<skill name>/`, with a `SKILL.md`, a `.claude-plugin/plugin.json` that names the plugin, and its prompts in `agents/`. A guide goes in `cstack/guides/<skill name>/<phase>.md`. `cstack/package.json` lists `dist`, `skills` and `guides` under `files`, so a new folder is packed without any change. The example `cstack-example` skill and `hello.md` guide show the shape.

How to check it: `cstack/test/pack.test.ts` runs `npm pack --dry-run --json` and expects a list of paths. Add the paths of your files to that list. `cstack guide <phase>` uses `resolve-issue` when `--skill` is not given, so the phase guides of `resolve-issue` belong in `cstack/guides/resolve-issue/`.

Things that constrain you: do not put a `.gitignore` or an `.npmrc` inside `cstack/skills/` or `cstack/guides/`, because npm never packs them, and it also drops files that a nested `.gitignore` lists. `cstack skills install` replaces only folders that hold `.cstack-managed`, and moves the old folder to `~/.claude/skill-backups/` first. The package is named `@gambitl/cstack` and is never published on the npm registry. Names of skills and phases must match `^[a-z0-9][a-z0-9-]*$`. Do not run `cstack skills install` on the maintainer's real home folder before the baseline runs of #12 are done.
Follow the same layout as ticket #21 for the skill folder, so that both tickets add files to the same `cstack/skills/resolve-issue/` folder without moving each other's files.
The decision record is `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.


Comment by the maintainer on 2026-11-18:

The work of ticket #14 (the settings file reader) gives you what you need to launch the review from the settings.

Use `readSettings(root)` from `cstack/src/settings.ts`. It returns each value with its source, either the file or a default. Pass a model to the review only when the source of `review` is the file. When the file says nothing, launch the named agent without a model, so the header of `pr-reviewer.md` decides. The example file leaves out `review` on purpose, so a repository that copies it still follows the header.

Do not run `review.agent` as a program name. The reader only checks its shape, `^[a-z][a-z0-9-]{0,31}$`, so any lowercase name passes, such as `codex` or `rm`. Map the name to a list of agents you know and refuse the others with exit code 3. The thinking level of the review stays in the header. ADR-SIC-D explains this in `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.

The reader reads the file on disk, not the committed copy. A build that edits `.cstack/settings.json` changes what the review uses. Tell the executor about that when you write its guide.


Comment by the maintainer on 2026-11-18:

Ticket #13 fixed the phase names and the check on your guides. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

The fifteen phase names are in `cstack/src/phases.ts`: `ticket`, `dependencies`, `code-map`, `questions`, `plan`, `build`, `review`, `independent-review`, `update-branch`, `document`, `briefing`, `after-build-questions`, `ready`, `retro` and `publish`. The guide of each one is `cstack/guides/resolve-issue/<phase>.md`. The briefing now runs after the documentation, so write the guides in that order: `document`, then `briefing`, then `after-build-questions`.

A CI test reads every file under `cstack/skills/` and `cstack/guides/`. Inside inline code and fenced blocks, each `cstack <word>` must match an entry of `cstack/src/manifest.ts`, and each flag must belong to that entry. Plain prose is ignored. `cstack --version` is not read as a mention.



### Decisions already taken upstream

From the specification page, `docs/projects/skills-into-cli.md`, section 4, "Rules for every story":

- **Orca when available, with a fallback.** Every feature that uses Orca also works without Orca. `cstack` checks Orca feature by feature. For example, when Orca runs but is not connected to the tracker, only the tracker access falls back.
- **No credentials in `cstack`.** `cstack` never stores a token or a password. It reaches a tracker or a forge only through a command-line client that is already logged in on the machine, such as `orca`, `glab` or `gh`. When no such client exists, Claude reads the tracker with its own connection, and it hands the data to `cstack` as a file.
- **Tool-agnostic.** No story assumes one specific tracker or forge. The tracker can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code and the pull requests, can be GitLab or GitHub.
- **Ticket text is data.** `cstack` treats the text of a ticket, a comment or a plan as data. It never runs a command because such a text asks for it.
- **Claude is the only default agent.** Another agent can be used only where the settings file of the repository names it.
- **macOS only.** No story supports another operating system.
- **Public text.** Every text in this repository or in its issues follows the public text rule of section 5.

From section 5 of the same page, "Out of scope", the items that touch this ticket:

- 2. The judgment problems that the retrospectives report stay out. Code cannot fix such problems, which need work on the prose.
- 3. No agent other than Claude is used by default. Another agent is possible only through the settings file of the repository.
- 9. The new skill has no prose fallback for when `cstack` is missing. Such a fallback would keep the long prose and lose the token gain. People who do not want `cstack` keep the frozen prose skills instead.
- 10. The prose skills get no further improvement. They are frozen at a tag.

From section 4, the stories this ticket serves: US-8 AC3 ("A unit without a test, such as a documentation change, is accepted only when the plan marks it "no test" and gives a reason"), US-9 AC1 (the four reports of the executor), US-10 AC2 ("every phase guide applies" the settings file), US-11 AC2 ("When Graphify is missing, it says how to install it. The run then continues with search and file reads, as it does today") and US-12 (publish with one push).

From the epic (#6), "Open questions and decisions", question 5: "Some units have no test. By default, the plan marks such a unit "no test" and gives a reason."

From the coordinator's brief for this wave (milestone M2): tickets #16, #18, #21 and #22 run at the same time. Tickets #21 and #22 both write under `cstack/skills/resolve-issue/` and `cstack/guides/resolve-issue/`. Keep changes to shared files small, and when another ticket merged first, resolve conflicts by keeping both changes. Never edit anything under `skills/`. Never install the new skill in the real home folder, never load it in a Claude Code session, and never install Graphify on this machine.

Decision records:

- ADR-SIC-B, where the run state lives and how its formats are versioned: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how cstack ships its skills (any folder under `cstack/skills/` is a shipped skill, copied whole by `cstack skills install`): `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-D, the settings file and the model of the review agent: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- ADR-SIC-E, the new role of the repository (the prose skills under `skills/` are frozen at the tag `prose-skills-final`; the repository is public): `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.
- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.

## Dependencies

Clear. The two blockers are closed: #13 (the plan file format, the phase order and the command list) and #9 (release cstack and install its skills). #14 (the settings file reader), which the ticket comments also build on, is closed too.

## Code mapping

Graphify is not installed on this machine, and the coordinator's brief forbids installing it, so the code was mapped with search and file reads. This ticket is mostly prose: ten agent prompts, ten phase guides and two copied files. The code it touches is three tests.

**The source prose (frozen, read only).** `skills/resolve-issue/agents/executor.md` (3,425 words) and `skills/resolve-issue/agents/implementer.md` (1,017 words) are the texts to rewrite. The line numbers that the ticket gives match the file today. The copy installed in `~/.claude/skills/resolve-issue/` is identical to the frozen folder (`diff -rq` prints nothing). `implementer-escalation.md` (line 12) and `code-reviewer-deep.md` (line 12) read their base prompt at `~/.claude/skills/resolve-issue/agents/`, which is where `cstack skills install` puts the new copies, so they need no edit. Only `cto-review.md` (lines 29 and 31, "in English") and `pr-reviewer.md` (line 21, `graphify update .`) contain text that the new tests or settings reject.

**The command list.** `cstack/src/manifest.ts` holds every command with its flags and exit codes. `cstack next`, `plan status`, `plan section`, `report submit`, `report check`, `unit order`, `unit red`, `unit green`, `unit commit` and `publish` all take `--plan`. `cstack graph ensure` takes no flag at all, so a guide must never write `cstack graph ensure --plan`. None of these eleven commands is built yet (`built: false`); tickets #15 to #20 build them. The exit codes match the ticket's Contract line.

**The mention check.** `cstack/test/manifest.test.ts`, test "passes on the real skills and guides", scans every file under `cstack/skills/` and `cstack/guides/`. Inside inline code and fenced blocks, every `cstack <word>` must match an entry and each flag must belong to it. A mention ends at `|`, `;`, `&`, `>`, `)` or ` #`, so `cstack unit red <n> --plan <plan file>` is read as `unit red <n`, which passes. The new prompts and guides are checked by this test with no change to it.

**The phase list.** `cstack/src/phases.ts` exports `PHASES`, with `runsIn` set to `"executor"` or `"main conversation"`, and `PLANNING_PHASES`. The build phases are `build` to `ready`, then `retro` (main conversation) and `publish` (executor). Done checks that the guides must satisfy: `build` needs a commit with the trailer `Cstack-Unit: <n>` or a `Blocked` line for every unit; `review` needs "Review log" filled; `document` needs "Documentation"; `briefing` needs "Briefing"; `after-build-questions` needs "Non-blocking questions" (the word "none" counts); `ready` cannot start while a blocking question is open, and needs "Pull request" and "Executor notes" filled; `publish` cannot start before `retro` is done after the last accepted done report. `independent-review` and `update-branch` have no done check.

**The reports (ticket #16, in progress).** `cstack report submit <kind>` reads the report from standard input. For `done`, it refuses while a required section is empty, a unit has no commit, a blocking question is open, `Ready for review at` is not set, or the plan file has an uncommitted change. So the `ready` guide must commit the plan file after `cstack next --done ready` and before `cstack report submit done`. `published` is refused when `publish.json` is missing or older than the current commit. `cstack report check` exits with `1` when the executor returned without an accepted report. `cstack plan section "Unit 3"` prints unit 3 and not unit 30; `Scope` and `Acceptance` print the ticket's level-3 headings.

**The settings (ticket #14, done).** `cstack/src/settings.ts` has the keys `integration` (`merge` or `rebase`, default `rebase`), `recordsLanguage`, `forbiddenTools`, `commitAttribution`, `testCommands`, `review` (`agent` and `model`, default `claude` and `opus`) and `watchIntervalMinutes`. A comment there (line 63) says that this ticket passes a review model only when it differs from the header. Ticket #21's future test `cstack/test/guides/settings-applied.test.ts` will reject, in every file under `cstack/guides/resolve-issue/`, the phrase "in English", a `Co-Authored-By` line and a fixed test command such as `npm test`. It will also require that a guide that says "rebase" names the `integration` setting.

**The tests this ticket touches.**

- `cstack/test/guide.test.ts`, test "lists the skills that have guides when the default skill has none", calls `cstack guide hello` on the real package and expects the message that lists skills with guides. As soon as `cstack/guides/resolve-issue/` exists, the command takes the "unknown phase" path instead, and the test fails. Ticket #21 adds guides in the same folder and hits the same test, so this is a likely merge conflict.
- `cstack/test/pack.test.ts` lists the paths that `npm pack --dry-run` must contain. The comment of #9 on this ticket asks to add the new paths to that list. `npm pack` keeps the hidden `.claude-plugin/` folder (the example skill proves it).
- `cstack/test/skills-install.test.ts` expects the output `installed cstack-example\ninstalled resolve-issue\n` on the real package. This ticket adds files to the existing `resolve-issue` folder and no new skill, so that line does not change. The retrospective of #13 records that a new skill folder breaks this line.
- The new test files are `cstack/test/guides/build-guides.test.ts`, `cstack/test/prompts.test.ts` and `cstack/test/skills-package.test.ts`. Vitest finds every `*.test.ts`, and `cstack/tsconfig.json` includes `test`, so a subfolder needs no setting.

**What ticket #21 writes in the same folders.** It writes `cstack/skills/resolve-issue/SKILL.md`, `writing.md` and `settled-decisions.md`, and the guides `ticket.md`, `dependencies.md`, `code-map.md`, `questions.md` and `plan.md`. Its `plan` guide launches the executor with the repository path, the plan file path, the conventions file path and the path of `writing.md`, and handles the executor's report with `cstack report check`. This ticket writes none of those files, so the two tickets add files side by side. The skills-package test of this ticket's acceptance names `writing.md` and `settled-decisions.md`, which only #21 creates.

**Risks.** The guide test above and the pack test list are shared with #21. The prompts must not contain the literal text `git push`, except one sentence of the executor prompt, so the implementer's "never push" rule must be written without that literal. Eleven commands that the guides name are not built yet, so nothing in this ticket can run them; the tests check the text only.

## Decisions

**Rules for every unit**

- Never edit anything under the top-level `skills/` folder. It is frozen at the tag `prose-skills-final`. Read the prompts there as the source text, and write new files under `cstack/skills/resolve-issue/` and `cstack/guides/resolve-issue/` only. (2026-11-18, coordinator's brief and ADR-SIC-E)
- Never run `cstack skills install` against the real home folder, never write under `~/.claude/`, and never install Graphify. Tests use a temporary home folder made with `mkdtempSync`. (2026-11-18, coordinator's brief)
- This ticket changes no file under `cstack/src/`. The comment at line 63 of `cstack/src/settings.ts` stays as it is. (2026-11-18, advisor's recommendation accepted by default)
- Every file written by this ticket is in English. Every sentence follows the documentation writing rules: one idea per sentence, a subject and a verb in every sentence, sentences under about 25 words, and "you" for the reader who has something to do. (2026-11-18, conventions file and the user's writing rules)
- No text names an employer or a client, quotes a work ticket key, or gives a count from work retrospectives. (2026-11-18, conventions file)
- The literal text `git push` appears in no prompt and no guide, except in exactly one sentence of `cstack/skills/resolve-issue/agents/executor.md`. That sentence is the exception for a pipeline run that a line of "Decisions" asks for as evidence. Everywhere else, write the rule in other words, such as "never push" or "only `cstack publish` pushes". (2026-11-18, ticket acceptance)
- Prompts and guides never write a value that the settings file owns. That means no "in English", no `Co-Authored-By` line, and no fixed test command such as `npm test`. Refer instead to the settings that `cstack next` prints above each guide: `integration`, `recordsLanguage`, `testCommands`, `commitAttribution`, `forbiddenTools` and `review`. A text that says "rebase" also names the `integration` setting. Ticket #21's future test `cstack/test/guides/settings-applied.test.ts` checks these rules over every guide. (2026-11-18, ticket comments and ticket #21's acceptance)
- Every `cstack <command>` written in inline code or in a fenced block must match an entry of `cstack/src/manifest.ts`, with only that entry's flags. `cstack graph ensure` takes no flag at all. Every other command that the executor or the implementer runs gets `--plan <plan file>`, so that it works the same in any worktree. (2026-11-18, ticket Contract and the command list)
- The prompts and guides describe the new plan format of `cstack/skills/resolve-issue/templates/plan.md` (format `cstack-plan/1`). Blocking questions live under `## Blocking questions`, each with `- Answer: open` until it is answered. Non-blocking questions live under `## Non-blocking questions`. The `## Pull request` section holds a `Title:` line, then the body in a fenced block of four backticks marked `markdown`. A unit has a `Files` line, a `Test` or `No test` line, and the executor may add a `- Blocked:` line. Never refer to the old heading "Open questions after the build". (2026-11-18, ticket Contract)
- Each guide starts with a level-1 heading that names the phase, such as `# Build`. It speaks to Claude as "you", in short steps. It ends by naming the `cstack next --done <phase>` command to run, or the report to submit. Aim for under 600 words per guide. (2026-11-18, assumption not asked, following the shape of `cstack/guides/cstack-example/hello.md`)
- Each guide uses the settings printed above it by `cstack next`. These values win over any default that a guide or the conventions file gives. (2026-11-18, US-10 AC2)

**The executor prompt, `cstack/skills/resolve-issue/agents/executor.md`**

- Keep the front matter of the frozen prompt byte for byte, with `model: sonnet` and `effort: medium`. The body has fewer than 1,000 words as `wc -w` counts the whole file. (2026-11-18, ticket Scope 1)
- The inputs stay those of the frozen lines 12 to 17: the repository path, the plan file path, the conventions file path and the path of `writing.md`. (2026-11-18, ticket Scope 1)
- The loop: run `cstack next --plan <plan file>`, follow the guide it prints, and run `cstack next --done <phase> --plan <plan file>` at the end of the phase. Repeat until cstack says that the next phase runs in the main conversation. To resume after an interruption, the same command already knows the next phase, and `cstack plan status --plan <plan file>` knows which units are done. (2026-11-18, ticket Scope 1)
- The executor ends with `cstack report submit <kind> --plan <plan file>`, with the report text on standard input. It ends only after cstack accepts the report. Its last message is one line that names the kind of the report. (2026-11-18, ticket Scope 1)
- The four report kinds are `done`, `needs-decision`, `failed` and `published`, and no other kind follows `cstack report submit` anywhere. Keep the content of each report from the frozen lines 123 to 126. Write the report in the records language of the settings, except the short briefing, which stays in the conversation language. Keep the report under thirty lines apart from the briefing. (2026-11-18, ticket Scope 1)
- Before any report from the `build` phase to the `ready` phase, the executor writes its executor notes and a dated entry in "Hand-off log", then commits the plan file. In the `publish` phase, it writes to the plan file only inside a fix commit that it pushes. (2026-11-18, assumption accepted by default)
- Keep the executor notes of the frozen lines 115 to 117: at most ten lines, one per thing that stumbled, each with its evidence, or "nothing this time". (2026-11-18, ticket Scope 1)
- The executor never pushes. Only `cstack publish` pushes, in the `publish` phase. The one exception is a pipeline run that a line of "Decisions" asks for as evidence. (2026-11-18, ticket Scope 1)
- The executor prompt says in one short paragraph what to do with the common exit codes of cstack. On `1`, read the message, fix the cause and run the command again, and never work around the refusal. On `3`, fix the plan file as the message says; when the message is about the settings file, such as a missing `testCommands`, return a needs-decision report. On `4`, the guide says what to do, and otherwise return a failed report that names the tool to install. On `5`, read the output, try once more, then return a failed report. (2026-11-18, assumption accepted by default)
- Keep a short vocabulary: the tracker, the forge, the documentation tool, and a fresh sub-agent. The helpers are launched as named agents, such as `resolve-issue:implementer`, without a model, so the header of each prompt decides. The only exception is the independent review, which follows the review settings. The executor cannot talk to the user, and returns a needs-decision report instead of guessing an answer that belongs to the user. (2026-11-18, frozen lines 19 to 29 and ADR-SIC-D)

**The implementer prompt, `cstack/skills/resolve-issue/agents/implementer.md`**

- Keep the front matter byte for byte, the ladder of the frozen lines 24 to 36, the rule of line 38 (never edit the plan file), the stop conditions of lines 40 to 49, and the two reports of lines 51 to 56. (2026-11-18, ticket Scope 2)
- The implementer reads only these sections, each with `cstack plan section <name> --plan <plan file>`: `Unit <n>`, `Decisions`, `Architecture`, `Code mapping`, `Where things are today`, `Scope`, `Acceptance`, and the CTO review block when the ticket has one. (2026-11-18, ticket Scope 2)
- For a unit with a `Test` line: write the test, run `cstack unit red <n> --plan <plan file>`, and check that the saved failure shows the reason the unit expects. Then write the minimum code and run `cstack unit green <n> --plan <plan file>`. After the refactor, run `cstack unit green` again. Last, run `cstack unit commit <n> --plan <plan file>`. The prompt names `cstack unit red`, `cstack unit green` and `cstack unit commit` in this order, and names no `cstack unit commit` before the first `cstack unit green`. (2026-11-18, ticket Scope 2 and acceptance)
- For a unit with a `No test` line, the implementer makes the change and runs `cstack unit commit` directly. The prompt says this in one sentence that contains both "No test" and `cstack unit commit`. (2026-11-18, ticket Scope 2 and acceptance)
- The implementer never runs `git add` or `git commit`, and never pushes. (2026-11-18, ticket Scope 2)
- Before `cstack unit commit`, the implementer runs `git status` and checks that it changed no file outside its unit's `Files`. If the unit needs such a file, it stops and reports stuck, and names the file. It also stops and reports stuck when `cstack unit commit` refuses with exit code `1` because a staged file is outside the unit's `Files`; the message names that file. (2026-11-18, ticket Scope 2 and the answer of #18)
- `cstack unit commit` holds a lock while it commits, so the implementer never retries a refused commit, with one exception. When the command exits with `1` after two minutes and names the unit that holds the lock, the implementer runs it once more, and reports stuck if it is refused again. (2026-11-18, answer of #18, which replaces the retry accepted by default earlier)
- When `cstack unit red` or `cstack unit green` exits with `3` because the settings have no test command, the implementer reports stuck with that message. (2026-11-18, assumption not asked)
- The Graphify steps of the frozen lines 21 and 22 stay in a shorter form, and only when the repository has a `graphify-out/` folder. Otherwise the implementer finds the code with search and file reads. (2026-11-18, assumption accepted by default)
- The done report gives the commit hash that `cstack unit commit` printed. (2026-11-18, ticket Scope 2)

**The eight copied prompts and the two copied files**

- Copy `code-architect.md`, `code-explorer.md`, `code-reviewer.md`, `code-reviewer-deep.md`, `code-reviewer-simplicity.md`, `cto-review.md`, `implementer-escalation.md` and `pr-reviewer.md` from `skills/resolve-issue/agents/` byte for byte, with two edits only. In `pr-reviewer.md` line 21, replace `graphify update .` with `cstack graph ensure`. In `cto-review.md` lines 29 and 31, replace "in English" with "in the records language of the settings, which is English by default". (2026-11-18, ticket Scope 3)
- Copy `skills/resolve-issue/.claude-plugin/plugin.json` and `skills/resolve-issue/templates/retro.md` byte for byte to the same places under `cstack/skills/resolve-issue/`. (2026-11-18, ticket Scope 4)
- The executor and implementer prompts are first copied byte for byte with the others, so that the units that rewrite them show a reviewable diff against the frozen text. (2026-11-18, assumption not asked)

**The guides, under `cstack/guides/resolve-issue/`**

- `build.md` follows ticket Scope 5. It launches the units of one batch of `cstack unit order` in parallel only when the settings give `testCommands.file`. Otherwise it launches one unit at a time. It says why in one sentence: units of a batch share one folder, so a whole-suite test run sees the test of another unit that is red on purpose. (2026-11-18, the user's answer)
- `build.md`: when `cstack unit red` or `cstack unit green` stops a unit because the settings have no test command, the executor returns a needs-decision report instead of escalating the unit. (2026-11-18, assumption accepted by default)
- `review.md` follows ticket Scope 6. It starts with `cstack graph ensure`. When that command exits with `4`, the executor keeps its install message for the report, and continues with search and file reads. The fixes of the review are ordinary commits without the `Cstack-Unit` trailer. The tests run with the test commands of the settings. (2026-11-18, ticket Scope 6 and US-11 AC2)
- `independent-review.md` follows ticket Scope 7. It first runs `git diff --name-only <target branch> -- .cstack/settings.json` (the working tree, so uncommitted changes show) and `git status --porcelain -- .cstack/settings.json`. When the branch changed that file, the executor returns a needs-decision report that names the change, because the settings are read from disk and the branch could choose its own reviewer. (2026-11-18, advisor's recommendation accepted by default)
- `independent-review.md`: when the review agent is `claude`, the executor launches `resolve-issue:pr-reviewer`. It passes a model only when `.cstack/settings.json` has a `review` key, as ADR-SIC-D decides. Any other agent name is started only through a launcher that the harness offers for that exact agent, such as an Orca worker, and is never run as a command. When the harness offers none, the executor returns a needs-decision report that names the agent. (2026-11-18, ADR-SIC-D and assumptions accepted by default)
- `update-branch.md` follows ticket Scope 8 and names the `integration` setting: `rebase` means rebase onto the target branch, and `merge` means merge the target branch in. Nothing is pushed yet, so a rebase needs no force push. (2026-11-18, ticket Scope 8)
- `document.md` follows the frozen lines 79 to 89, and `briefing.md` follows lines 65 to 67. The briefing runs after the documentation and names the places documented. The executor passes the records language of the settings to the advisor with its other inputs. When the advisor raises a trade-off that needs a decision record, the executor writes that record during the briefing phase. (2026-11-18, ticket Scope 9 and assumption accepted by default)
- `after-build-questions.md` follows ticket Scope 10. A new blocking question gets the next free number under `## Blocking questions`. When there is no non-blocking question, the section holds the word "none". (2026-11-18, ticket Scope 10 and the plan template)
- `ready.md`, `retro.md` and `publish.md` follow ticket Scopes 11, 12 and 13. In `ready.md`, the plan file is committed after `cstack next --done ready` and before `cstack report submit done`, because that report is refused while the plan file has an uncommitted change. In `retro.md`, when the run stopped before a branch existed, the retrospective stays uncommitted and Claude says so. (2026-11-18, ticket and the scope of #16)

**The tests**

- `cstack/test/skills-package.test.ts` installs the real package into a temporary home. It checks that every file of `cstack/skills/resolve-issue/` in the package, hidden files included, is installed byte for byte. It also names explicitly the ten prompts, `templates/plan.md`, `templates/settings.json`, `templates/retro.md` and `.claude-plugin/plugin.json`. It does not name `writing.md` or `settled-decisions.md` while ticket #21 is not on `main`. (2026-11-18, the user's answer)
- At the update before the push, when `cstack/skills/resolve-issue/writing.md` exists on `main` because #21 merged, the executor adds `writing.md` and `settled-decisions.md` to the names of the skills-package test. In the same commit, it adds the two new prompts to the files that `cstack/test/guides/settings-applied.test.ts` checks. Then it runs the whole suite again. When #21 is not on `main`, the comment on #23 says what is left to add. (2026-11-18, the user's answer)
- In `cstack/test/guide.test.ts`, the case "lists the skills that have guides when the default skill has none" uses a temporary package root that holds guides for `cstack-example` only. When the update before the push meets #21's own fix of the same case, keep one of the two fixes. (2026-11-18, assumption accepted by default)
- In `cstack/test/prompts.test.ts`, the check of the report kinds reads only the word that follows each `cstack report submit`. The set of those words must be exactly `done`, `needs-decision`, `failed` and `published`. (2026-11-18, advisor's recommendation accepted by default)
- The word count of the executor prompt is a reviewer check with `wc -w`, as the ticket says. The review records the number in "Review log". (2026-11-18, ticket acceptance)
- Changes to shared files stay small and in their own place: `cstack/test/pack.test.ts` only gets new paths at the end of its list, and `cstack/test/guide.test.ts` changes only the one case above. `README.md`, `cstack/src/cli.ts` and `docs/projects/skills-into-cli.md` do not change. (2026-11-18, coordinator's brief)

**How this run builds the units**

- Units 1 to 4 run one after the other. Units 5, 6 and 7 hold prose only and run at the same time after unit 4. Each of them runs only `npx vitest run test/manifest.test.ts` from `cstack/` before it commits, and stages only its own files. Unit 8 runs after all the others. (2026-11-18, assumption not asked, because the whole suite of one unit would see the red test of another unit in the same folder)

## Architecture

The approach is locked by the ticket. The ten prompts and the two plain files are copied first, so that the rewrite of the executor and the implementer shows a diff against the frozen text. Ten short guides then replace the phases of the frozen executor, one file per phase. Three new tests check the text: which guides exist, what the two prompts say, and what `cstack skills install` puts in a home folder. No code under `cstack/src/` changes.

## Implementation units

### Unit 1: Ship the ten prompts, the plugin file and the retrospective template — status: done
- Failing test: write `cstack/test/skills-package.test.ts`. It runs `skills(["install"], io, { home, packageRoot })` from `cstack/src/commands/skills.ts`, with a temporary home and the real package root (`new URL("..", import.meta.url).pathname`). It checks that the installed `resolve-issue` folder holds `agents/<name>.md` for the ten names `code-architect`, `code-explorer`, `code-reviewer`, `code-reviewer-deep`, `code-reviewer-simplicity`, `cto-review`, `executor`, `implementer`, `implementer-escalation` and `pr-reviewer`, plus `templates/plan.md`, `templates/settings.json`, `templates/retro.md` and `.claude-plugin/plugin.json`. It also walks every file of `cstack/skills/resolve-issue/` in the package, hidden files included, and checks that the installed copy has the same bytes. Run it and see it fail because `agents/` and `templates/retro.md` are missing.
- Minimum code: copy the ten prompts of `skills/resolve-issue/agents/` into `cstack/skills/resolve-issue/agents/` byte for byte, with the two edits that "Decisions" names for `pr-reviewer.md` and `cto-review.md`. Copy `skills/resolve-issue/.claude-plugin/plugin.json` and `skills/resolve-issue/templates/retro.md` byte for byte. Add the paths of the ten prompts, `skills/resolve-issue/.claude-plugin/plugin.json` and `skills/resolve-issue/templates/retro.md` at the end of the list in `cstack/test/pack.test.ts`. Run the whole suite.
- Refactor: none.
- Commit message: `feat(skill): ship the agent prompts, the plugin file and the retrospective template of resolve-issue`
- Depends on: none
- Files: `cstack/test/skills-package.test.ts`, `cstack/test/pack.test.ts`, `cstack/skills/resolve-issue/agents/` (ten files), `cstack/skills/resolve-issue/.claude-plugin/plugin.json`, `cstack/skills/resolve-issue/templates/retro.md`.

### Unit 2: Rewrite the implementer prompt — status: done
- Failing test: write `cstack/test/prompts.test.ts` with a function that returns the problems of an implementer prompt. First, a fixture `cstack/test/fixtures/prompts/implementer-commit-before-green.md` names `cstack unit red`, then `cstack unit commit`, then `cstack unit green`. The test checks that the function reports a problem for it. Then the test checks that the real `cstack/skills/resolve-issue/agents/implementer.md` has no problem: it names `cstack unit red`, `cstack unit green` and `cstack unit commit` in this order, with no `cstack unit commit` before the first `cstack unit green`. It also has one sentence that holds both "No test" and `cstack unit commit`. Run it and see the real-prompt case fail, because the copy of unit 1 names none of these commands.
- Minimum code: rewrite `cstack/skills/resolve-issue/agents/implementer.md` as the implementer lines of "Decisions" say. Run `cstack/test/prompts.test.ts` and `cstack/test/manifest.test.ts`, then the whole suite.
- Refactor: none.
- Commit message: `feat(skill): make the implementer run each step of a unit through cstack`
- Depends on: 1
- Files: `cstack/test/prompts.test.ts`, `cstack/test/fixtures/prompts/implementer-commit-before-green.md`, `cstack/skills/resolve-issue/agents/implementer.md`.

### Unit 3: Rewrite the executor prompt — status: done
- Failing test: in `cstack/test/prompts.test.ts`, check that the real `cstack/skills/resolve-issue/agents/executor.md` names `cstack next` and `cstack report submit`. The words that follow every `cstack report submit` in the prompt must form exactly the set `done`, `needs-decision`, `failed` and `published`. Run it and see it fail, because the copy of unit 1 names no cstack command.
- Minimum code: rewrite `cstack/skills/resolve-issue/agents/executor.md` as the executor lines of "Decisions" say, under 1,000 words by `wc -w`. Run `cstack/test/prompts.test.ts` and `cstack/test/manifest.test.ts`, then the whole suite. Give the word count in the report.
- Refactor: none.
- Commit message: `feat(skill): make the executor follow the cstack guides one phase at a time`
- Depends on: 2
- Files: `cstack/test/prompts.test.ts`, `cstack/skills/resolve-issue/agents/executor.md`.

### Unit 4: Write the build guide and keep the guide test independent of the real guides — status: done
- Failing test: write `cstack/guides/resolve-issue/build.md`, then run `cstack/test/guide.test.ts`. The case "lists the skills that have guides when the default skill has none" fails, because the default skill `resolve-issue` now has a guide.
- Minimum code: give that one case a temporary package root that holds only `guides/cstack-example/hello.md`, made with `mkdtempSync`, and keep its assertions. The other cases do not change. `build.md` follows the build lines of "Decisions" and ticket Scope 5. Run `cstack/test/guide.test.ts` and `cstack/test/manifest.test.ts`, then the whole suite.
- Refactor: none.
- Commit message: `feat(skill): add the build guide of resolve-issue`
- Depends on: 3
- Files: `cstack/guides/resolve-issue/build.md`, `cstack/test/guide.test.ts`.

### Unit 5: Write the guides of the two reviews and of the branch update — status: done
- No test: prose only. The mention check of `cstack/test/manifest.test.ts` already scans these files, and unit 8 checks that they exist and hold no `git push`.
- Minimum code: write `review.md`, `independent-review.md` and `update-branch.md` under `cstack/guides/resolve-issue/`, as their lines of "Decisions" and ticket Scopes 6, 7 and 8 say. Run `npx vitest run test/manifest.test.ts` from `cstack/`.
- Refactor: none.
- Commit message: `feat(skill): add the guides of the reviews and of the branch update`
- Depends on: 4
- Files: `cstack/guides/resolve-issue/review.md`, `cstack/guides/resolve-issue/independent-review.md`, `cstack/guides/resolve-issue/update-branch.md`.

### Unit 6: Write the guides from the documentation to the ready state — status: done
- No test: prose only. The mention check of `cstack/test/manifest.test.ts` already scans these files, and unit 8 checks that they exist and hold no `git push`.
- Minimum code: write `document.md`, `briefing.md`, `after-build-questions.md` and `ready.md` under `cstack/guides/resolve-issue/`, as their lines of "Decisions" and ticket Scopes 9, 10 and 11 say. Run `npx vitest run test/manifest.test.ts` from `cstack/`.
- Refactor: none.
- Commit message: `feat(skill): add the guides of the documentation, the briefing, the questions and the ready state`
- Depends on: 4
- Files: `cstack/guides/resolve-issue/document.md`, `cstack/guides/resolve-issue/briefing.md`, `cstack/guides/resolve-issue/after-build-questions.md`, `cstack/guides/resolve-issue/ready.md`.

### Unit 7: Write the guides of the retrospective and of the publication — status: done
- No test: prose only. The mention check of `cstack/test/manifest.test.ts` already scans these files, and unit 8 checks that they exist and hold no `git push`.
- Minimum code: write `retro.md` and `publish.md` under `cstack/guides/resolve-issue/`, as their lines of "Decisions" and ticket Scopes 12 and 13 say. `retro.md` is for the main conversation. Run `npx vitest run test/manifest.test.ts` from `cstack/`.
- Refactor: none.
- Commit message: `feat(skill): add the guides of the retrospective and of the publication`
- Depends on: 4
- Files: `cstack/guides/resolve-issue/retro.md`, `cstack/guides/resolve-issue/publish.md`.

### Unit 8: Check that every build guide exists and that only the executor may name a push — status: done
- Failing test: write `cstack/test/guides/build-guides.test.ts` with a function that takes a guides folder and returns the build phases that have no guide. The build phases are the entries of `PHASES` from `cstack/src/phases.ts`, from `build` to `publish`, `retro` included. First, a fixture folder `cstack/test/fixtures/build-guides/` holds every build guide except `publish.md`. The test checks that the function returns `publish` and that the failure message names `publish.md`. Then the real folder `cstack/guides/resolve-issue/` returns nothing. In `cstack/test/prompts.test.ts`, add the check that `git push` appears in no file of `cstack/guides/resolve-issue/` and of `cstack/skills/resolve-issue/agents/`, except in exactly one sentence of `executor.md`, and that this sentence speaks of a pipeline run and of "Decisions". Run both files and see the fixture case fail before the function exists.
- Minimum code: the function in the test file, with the fixture guides as one-line files. Add the paths of the ten guides at the end of the list in `cstack/test/pack.test.ts`. Run the whole suite and `npm run typecheck`.
- Refactor: none.
- Commit message: `test(tests): check that every build phase has its guide and that only the executor names a push`
- Depends on: 3, 4, 5, 6, 7
- Files: `cstack/test/guides/build-guides.test.ts`, `cstack/test/fixtures/build-guides/` (nine one-line guides), `cstack/test/prompts.test.ts`, `cstack/test/pack.test.ts`.

Security: no security surface, skip. The ticket adds prose and tests, and no endpoint, query or external input.

## Documentation duties

- The comment on ticket #22: applies, written to the ticket on GitHub. It says what was built, the parallel rule of the build guide, and what differs from the ticket: the skills-package test does not name the two files of #21 unless #21 merged first, and the implementer checks its own files with `git status`.
- The hand-down comment on ticket #23, the end-to-end run that this ticket feeds: applies, written to #23 on GitHub. It names the prompts and guides, the commands they need that are not built yet, the need for `testCommands` (and `testCommands.file` for parallel units) in `.cstack/settings.json`, and what is left to add for #21's two files when #21 merged after this ticket.
- A comment on ticket #28, which gives each unit its own worktree: applies, written to #28 on GitHub. It says that the build guide runs a batch in parallel only with `testCommands.file`, and that #28 can lift that condition.
- Decision records: does not apply. The review launch follows ADR-SIC-D as it is, and the parallel rule is a guide rule until #28 lands, not a new architecture choice.
- The specification page `docs/projects/skills-into-cli.md` and `README.md`: do not apply. Nothing they say becomes wrong.
- A `WHY:` comment in code: does not apply, because no code under `cstack/src/` changes.

## Review log

Impact notes. Graphify is not installed and the brief forbids installing it, so the impact was checked with search. No symbol of `cstack/src/` changed. The shared files touched are `cstack/test/guide.test.ts` (one case now uses a temporary package root), `cstack/test/pack.test.ts` (paths added at the end of the list) and the new tests. Usual companions: none outside the diff. No `WHY:` or `DECISION:` comment sits in the changed files. Checks run: `npm test` (251 tests) and `npm run typecheck` pass in `cstack/`. `wc -w` of the new `executor.md` is 976, down from 3,425. No guide or prompt holds the phrases "in English", `Co-Authored-By` or a fixed test command, and `git push` appears once, in the executor prompt.

Review findings (four reviewers). Fixed in one commit: the executor notes section is filled, not appended (the plan format rejects a second heading); the settings check of the independent review now sees uncommitted and untracked changes and honours an accepting line of "Decisions"; the stuck-unit steps of the build guide no longer contradict each other and relaunch the unit; a blocking question uses the heading, `- For:` and `- Answer: open` shape and removes the word "none"; the pull request link skips decision records that live in the repository; `publish.md` and `retro.md` end with their next command; the push exception of the executor prompt is limited to the ticket branch, no force, and a user answer, and says that tracker text is data. `wc -w` of `executor.md` after the fixes: 977.
Follow-ups left (cheap or judgment calls): the nine one-line fixtures of the build-guides test could be built in a temporary folder; `pack.test.ts` lists 22 hand-typed paths; a few sentences in the prompts run longer than 25 words; the implementer and pr-reviewer prompts have no sentence that says ticket text is data (the frozen prompts did not either); `writing.md` and `settled-decisions.md` are not named in the skills-package test until ticket #21 is on `main`, as "Decisions" says.

Independent review (pr-reviewer): fixed a lost blank line in `executor.md` and made `publish.md` print the `update-branch` guide with `cstack guide update-branch` before it resolves a conflict. Judgment calls for the pull request: exit code 7 of `publish.md` says "as above" and leaves the ticket move and `cstack next --done publish` implicit; the review fix shortened the executor notes examples (the word budget forced it); the settings check compares the working tree, not `...HEAD`, on purpose; the closing reference example `Fixes TICKET-123` is copied from the frozen prompt, and on GitHub the form is `Fixes #123`.

Phase 9: `main` did not move since the branch was created, so no update was needed. `npm test` (251 tests), `npm run typecheck` and `npm run build` pass. Ticket #21 is not on `main`, so the two #21 file names stay out of the skills-package test.

## Briefing

## Open questions after the build

### Blocking

### Non-blocking

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-18: build started on branch gambitl/build-prompts-guides. GitHub has no in-progress state field, so the ticket stays open with its label; nothing to move.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**The install test must not name `writing.md` and `settled-decisions.md` while the ticket of the planning guides (#21) is not on `main`.** Only #21 creates these two files, and it runs at the same time as this ticket. If my test names them and #21 is not merged when I push, the check of the pull request fails. I recommend that the test checks that the whole skill folder is installed byte for byte, and names only the files of this ticket. Just before the push, if #21 is on `main`, I add the two names, and the two prompts to the settings test of #21. If it is not, I write what is left in the comment on the end-to-end ticket (#23).

**Run the units of a batch in parallel only when the settings give a test command for one file (`testCommands.file`).** Until each unit gets its own worktree (#28), all units of a batch share one folder. Without `testCommands.file`, `cstack unit green` runs the whole suite. Unit A then fails because the test of unit B is red on purpose at that moment, and unit A is escalated for nothing. I recommend parallel units with `testCommands.file`, and one unit at a time otherwise. The ticket says "in parallel" with no condition, so this is a change to its scope.

**I will do this unless you say no.**

- In the implementer, when `cstack unit commit` refuses because of a file of another unit, or because git's index is locked, it waits and retries up to three times before it reports stuck. Two units that commit at the same moment hit exactly these two cases.
- The new stop condition of the ticket ("refuses because the unit needs a file outside its `Files`") matches no refusal of `cstack unit commit`. So the implementer checks by itself that it changed nothing outside its `Files`.
- When the branch changes `.cstack/settings.json`, the independent-review guide stops and asks for a decision. The settings are read from disk, so the branch could change which agent reviews it.
- For the model of the review, I follow the rule of ADR-SIC-D: pass a model only when the settings file names one. The result is the same as the rule of the ticket, and I leave the comment of `cstack/src/settings.ts` alone.
- The test "no other report kind" reads only the word after `cstack report submit`. Otherwise the word "stuck" of the implementer would make it fail.
- I keep the six other assumptions of the plan as they are.

**Questions for other people that can wait.**

For the ticket that builds `cstack unit commit` (#18), as a comment there: "Could `cstack unit commit` hold a lock in the run folder from its first check until `git commit` ends? Two units of one batch that commit at the same moment would then never see each other's staged files."

**Good to know.**

- The settings template has no `testCommands`, and without it `cstack unit red` exits with `3`. The first real run (#23) will need it.
- None of the eleven commands that the guides name exists yet, so the tests of this ticket check the text only.

#### Details

**Install test and the files of #21 (blocking, cannot be tested, the user decides).** The acceptance line of `cstack/test/skills-package.test.ts` names `writing.md` and `settled-decisions.md`, which only #21 creates (Code mapping, "What ticket #21 writes"). The branch `gambitl/short-skill-planning` has no commit yet, so the merge order is unknown. I keep the draft answer of Question 1: the test compares every file of `cstack/skills/resolve-issue/` in the package with the installed copy, hidden files included, and names explicitly the ten prompts, the files of `templates/` and `.claude-plugin/plugin.json`. The same applies to the acceptance line that asks the settings test of #21 (`cstack/test/guides/settings-applied.test.ts`) to cover the two prompts: that file belongs to #21, and editing it before #21 merges creates a conflict. This changes an acceptance criterion, so the user must approve it. If nobody decides, the executor writes the test as the ticket says, and the pull request check fails whenever #21 is not merged first.

**Parallel units in one folder (blocking, cannot be tested now because `cstack unit red`, `green` and `commit` are not built; the user decides).** Ticket #17 (scope step 2) runs `testCommands.file` with the unit's test file when it is set, and `testCommands.all` otherwise. `cstack/src/settings.ts` makes `file` optional, and `cstack/skills/resolve-issue/templates/settings.json` has no `testCommands` at all. Ticket #28 states the problem itself: "one implementer's test run can pick up another one's half-written code", and it fixes it only in milestone 3 with child worktrees. In milestone 2, the units of one batch of `cstack unit order` share no file but share the folder. With `testCommands.all`, unit A's `cstack unit green` fails while unit B sits between its red and green runs. Unit A's `cstack unit red` can also pass for B's reason, which the implementer catches only if it reads the saved failure. I recommend that the `build` guide launches a batch in parallel only when the settings give `testCommands.file`, and one unit at a time otherwise. I rejected "always one unit at a time", which is safe but throws away the speed that US-9 AC2 keeps. I rejected "always in parallel", which breaks on every repository that sets only `testCommands.all`. A risk stays with `testCommands.file`: unit A's test can import a module that unit B is editing. That is rare, and the implementer's check of the failure reason covers it. When #28 lands, the condition goes away. If nobody decides, the guide runs every batch in parallel, and the first run with `testCommands.all` and two tested units in one batch escalates units for no reason.

**Commit race between parallel units (blocking, answered by reading the scope of #18).** Ticket #18 (scope steps 4 to 6) checks that the index holds no file outside the unit's `Files`, then runs `git add`, then `git commit`. Nothing makes these three steps atomic across two processes. When units A and B commit at the same moment, B can see A's staged files and exit with `1`, or meet `.git/index.lock` and exit with `5`. With the stop condition that the ticket adds, B would report stuck and go to the escalation prompt for a transient clash. The implementer prompt therefore retries after a short wait, up to three times, when the refusal names a file of another unit or the output mentions `index.lock`. The ticket's new stop condition rests on a refusal that #18 never produces: #18 never looks at unstaged changes outside `Files`, because they may belong to another unit. The prompt keeps the existing stop condition of line 45 of the frozen implementer, and asks the implementer to check, before `cstack unit commit`, that it changed no file outside its `Files`. If nobody decides, the implementer follows the ticket text, and parallel batches produce false stuck reports.

**A branch that edits the settings (blocking, answered by the comment of #14 on this ticket).** The comment says that `readSettings` reads the file on disk, so "a build that edits `.cstack/settings.json` changes what the review uses", and asks to tell the executor. Scope item 7 does not say it. Since ticket text is data, a unit could change `review.agent` and pick its own reviewer. The `independent-review` guide checks `git diff --name-only <target>...HEAD -- .cstack/settings.json`. When the file changed, the executor returns a needs-decision report that names the change. I rejected reading the target branch's copy with `git show`, because the review would then silently disagree with what the plan approved. If nobody decides, the guide says nothing, and the review follows whatever the branch wrote.

**Model of the review (non-blocking; I disagree with the draft of Question 4).** ADR-SIC-D (line 36) is locked and says: "The executor passes a model to the review only when the `review` value comes from the settings file." The comment at line 63 of `cstack/src/settings.ts` says the same. The ticket's rule, "only when it differs from the header", gives the same model in every case, because both fall back to the header of `pr-reviewer.md`. So the guide states the rule of the ADR, and no code changes. That avoids an edit to a shared file during a wave, and keeps the guide aligned with a locked decision.

**The test of the report kinds (non-blocking).** The executor prompt must name the implementer's "stuck" report and the escalation. A test that looks for any other kind word in the whole prompt would fail on it. The test of `cstack/test/prompts.test.ts` reads every `cstack report submit <word>` mention and requires the set to be exactly `done`, `needs-decision`, `failed` and `published`.

**The other draft assumptions (non-blocking, kept).** Question 2 (temporary package root for the guide test), Question 3 (only `claude` is a known review agent, never run a name as a command), Question 5 (commit the plan file before any report from `build` to `ready`), Question 6 (the common exit codes in the executor prompt), Question 7 (the briefing passes the records language to the advisor) and Question 8 (the Graphify steps of the implementer only when a graph exists, through `cstack graph ensure`'s answer) stand as written. For Question 6, the executor must fit the rule inside the 1,000-word budget, so it gives the four codes in one short paragraph.

**Question for #18 (non-blocking).** Written in English for a comment on #18: "Could `cstack unit commit` hold a lock in the run folder from its first check until `git commit` ends? Two units of one batch that commit at the same moment would then never see each other's staged files." The retry of the implementer works whatever the answer, so this ticket does not wait for it.

**Facts worth keeping.** The settings template has no `testCommands`, and #17 makes `cstack unit red` and `green` exit with `3` without it. The guides should treat that exit as a needs-decision report, not a stuck unit. The eleven commands that the guides name are all `built: false` in `cstack/src/manifest.ts`, so this ticket's tests check text and the mention check only. The first run that executes them is #23.

**Locked decisions cited and not reopened.** ADR-SIC-C (the whole skill folder ships), ADR-SIC-D (the review settings), ADR-SIC-E (`skills/` frozen at `prose-skills-final`), and out-of-scope item 9 of the specification (no prose fallback when `cstack` is missing).

I checked security beyond the review agent, data model lock-in, scale, user-interface cases, operations and cost, and reversibility, and found nothing there: the ticket ships prose and tests, a revert undoes it, and nothing is installed on a real home folder.

### Open questions and answers

**Question 1 (blocking): how to test the two files that ticket #21 creates.** The acceptance of this ticket asks `cstack/test/skills-package.test.ts` to check that `cstack skills install` installs `writing.md` and `settled-decisions.md`. Only ticket #21 creates those two files, and it runs in parallel with no branch pushed yet. The merge order of #21 and #22 is unknown. If the test names the two files and #21 is not on `main` when this branch is pushed, the check fails on the pull request. The same holds for the acceptance line that asks #21's settings test (`cstack/test/guides/settings-applied.test.ts`) to cover the two new prompts. Recommended answer: the test checks that every file of `cstack/skills/resolve-issue/` in the package, hidden files included, is installed byte for byte, and it names explicitly the files that this ticket ships (the ten prompts, the files of `templates/` and `.claude-plugin/plugin.json`). That covers #21's files as soon as they exist. At the update before the push, if #21 is already on `main`, the executor adds the two names to the test and adds the two prompts to #21's settings test, in the same commit. If #21 is not on `main` yet, the comment left on #23 (the end-to-end ticket that both feed) says what is left to add. This cannot be tested now: it depends on the merge order. It goes to the user.

**Question 2 (non-blocking, assumption): the test of `cstack guide` that breaks.** `cstack/test/guide.test.ts`, test "lists the skills that have guides when the default skill has none", assumes that the real package has no guide for `resolve-issue`. The first guide of this ticket breaks it. Recommended answer, taken as an assumption: the test uses a temporary package root that holds guides for `cstack-example` only. Ticket #21 hits the same test, so the update before the push may meet a conflict there; keep one of the two fixes.

**Question 3 (non-blocking, assumption): a review agent other than Claude.** The ticket says to return a needs-decision report "when the setting names an agent other than Claude and the harness cannot start it". The comment of #14 adds that the name must never be run as a program. Recommended answer, taken as an assumption: the guide knows one agent, `claude`, which launches `resolve-issue:pr-reviewer`. For any other name, the executor starts it only through a launcher that the harness offers for that exact agent name, such as an Orca worker of that agent, and never runs the name as a command. Otherwise it returns a needs-decision report that names the agent.

**Question 4 (non-blocking, assumption): the review model and the comment in `cstack/src/settings.ts`.** The comment at line 63 of `cstack/src/settings.ts` says that this ticket passes a model "only when the source of `review` is "file"". The ticket says to pass a model only when it differs from the header of `pr-reviewer.md`. The two agree in practice, because the default is the header's model. Recommended answer, taken as an assumption: follow the ticket, and change that comment so it states the same rule.

**Question 5 (non-blocking, assumption): the plan file before a report other than done.** `cstack report submit done` refuses a plan file with an uncommitted change, but the other kinds do not. Recommended answer, taken as an assumption: before any report from the build to the ready phase, the executor writes its executor notes and a dated entry in "Hand-off log", then commits the plan file, so that the next run resumes from a committed file. In the publish phase, the rule of today's line 113 stays: the plan file changes only inside a fix commit that is pushed.

**Question 6 (non-blocking, assumption): the common exit codes in the executor.** Ticket #21 puts the handling of the common exit codes (`1`, `3`, `4`, `5`) in the entry skill, which the executor never reads. Recommended answer, taken as an assumption: the executor prompt carries the same rule in a few lines.

**Question 7 (non-blocking, assumption): the records language for the CTO advisor.** The advisor's prompt now writes the plan file in "the records language of the settings", but the advisor never sees the settings that `cstack next` prints. Recommended answer, taken as an assumption: the briefing guide passes the records language to the advisor with its inputs.

**Question 8 (non-blocking, assumption): the Graphify steps of the implementer.** The ticket does not list the implementer's steps 2 and 3 (lines 21 and 22), which use `graphify affected`, `graphify explain` and `graphify query`. Recommended answer, taken as an assumption: keep them in a shorter form, and only when the repository has a graph; otherwise the implementer uses search and file reads.

**Answers of the question round (2026-11-18).** The user answered "ok top" to the short version above. The two items that needed an answer take the recommended answer. The install test checks the whole skill folder byte for byte, names only the files of this ticket, and gets the two names of #21 at the update before the push when #21 is on `main`. The units of a batch run in parallel only when the settings give `testCommands.file`, and one at a time otherwise. Every item under "I will do this unless you say no" is accepted by default, except the retry of the implementer, which the answer of #18 below replaced.

**Answer of ticket #18 on the commit lock (2026-11-18, relayed by the coordinator, approved by the user).** The question for #18 is answered, so no comment goes to #18. Word for word: "Yes, cstack unit commit holds a lock from its first check until git commit ends. The lock file is <worktree git folder>/cstack/unit-commit.lock (from git rev-parse --git-dir), not the run folder: the index it protects belongs to the worktree, and the child worktrees of #28 would otherwise wait on each other. It is made with an exclusive create and holds the unit number and the process id. A second call checks again at a short interval for up to two minutes, then exits with 1 and names the unit that holds the lock. A lock whose process no longer runs is taken over. When git add or git commit fails, the command unstages the unit's files that this same call staged (only those that had no staged change before), so a failed hook does not leave files that make other units refuse. So #22's prompt no longer needs the retry on index.lock or on another unit's staged file; an exit 1 that names a lock holder after two minutes is the only wait case left. Second point for #22, also approved: cstack unit commit <n> refuses with exit code 1 when a file outside unit n's Files is staged, and it names the file. It does not look at unstaged changes outside Files, because in a shared worktree they may belong to another unit of the same batch. The implementer's stop condition should therefore say 'when cstack unit commit refuses because a staged file is outside the unit's Files', or the implementer should check git status for its own work itself."

### Architecture options

No real choice: the ticket's Scope fixes every file and its content. No new decision since phase 4.
