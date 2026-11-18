# Plan: #21 — M2-9: Write the short resolve-issue skill and the guides of the planning phases

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/21
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/short-skill-planning
Conversation language: French
Status: approved

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Replace the long instructions that Claude reads at the start of every run with a short entry page, and give Claude the instructions of each planning step only when that step begins.

- **What the title means**: A skill is a page of instructions that Claude loads when a task matches it. `resolve-issue` is the skill that takes one ticket all the way to a pull request, which is the request to merge the work into the main code. The short skill is a new, much shorter version of its main page. A guide holds the instructions of one phase, which is one step of a run. The planning phases are the first steps of a run, from reading the ticket to the user's approval of the plan. `cstack`, the command-line tool of this project, prints each guide when its phase starts.
- **Why we are doing it**: Today Claude reads about 7,200 words of instructions before it does anything, and many of them describe steps that come much later. Reading them costs quota on every run. The rules of each repository also live only in prose, and the skill sometimes contradicts them.
- **For the user**: A solution engineer's run starts with far less reading, so it uses less of their Claude subscription. Every planning step follows the settings of the repository instead of a fixed default.

**Goal.** This ticket delivers the short entry skill, its writing guide and settled decisions, and the guides of the five planning phases, small enough for US-6 AC4 and applying the settings file as US-10 AC2 asks. Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #9 ships only an example skill and an example guide, and #13 adds the phase list and the plan template. None of them is in the repository yet. The files below are the prose that this ticket replaces.
* **The main skill file**: `skills/resolve-issue/SKILL.md` holds 6,133 words, as `wc -w` counts them. Its front matter (lines 1 to 5) gives the name, the description and the argument hint. Line 11 summarises the whole run and its planned stops. Lines 13 to 24 hold the vocabulary, lines 26 to 42 the models of the roles, and lines 44 to 50 the push rule.
* **The planning phases today**: `skills/resolve-issue/SKILL.md` holds phase 0 (lines 52 to 56), phase 1 (lines 58 to 68), phase 2 (lines 70 to 78), phase 3 (lines 80 to 95), phase 4 (lines 97 to 126) and phase 5 (lines 128 to 163). Line 84 checks for `graphify-out/graph.json` by hand. Lines 158 to 163 tell the main conversation how to handle each report of the executor.
* **The writing guide**: `skills/resolve-issue/writing.md` holds 1,128 words. Line 17 says that every record is written in English unless the conventions file says otherwise. Lines 27 and 41 use example ticket ids that come from a work tracker, which the public text rule of this repository forbids.
* **The settled decisions**: `skills/resolve-issue/SKILL.md` (lines 195 to 212) lists the decisions that the user fixed on purpose, and lines 214 to 218 list the lessons applied. Line 210 is the decision on the models, which ADR-SIC-D of #14 amends. Line 211 names a work ticket, which must not be copied.
* **The size limit**: the two files hold 7,261 words together. A fifth of that is 1,452.2 words, so the entry skill and the first guide may hold at most 1,452 words together. `docs/projects/skills-into-cli.md` (line 113) holds this criterion, line 145 holds US-10 AC2, and line 247 rules out a prose fallback when cstack is missing.
* **Contract**: from #13, #14 and #9. The planning phases are `ticket`, `dependencies`, `code-map`, `questions` and `plan`, in this order, and they run in the main conversation. Their guides live in `cstack/guides/resolve-issue/<phase>.md`, and `cstack guide <phase>` prints the same text. `cstack next` prints the guide of the next phase. `cstack next --done <phase>` checks and closes a phase and prints the next guide. `cstack next --phase retro` reaches the retrospective after a stop. `cstack next --done ticket --plan <file>` registers the plan file. `cstack next` refuses the `plan` phase while a blocking question has `- Answer: open`. `cstack next --done plan` needs the Status `approved` and writes `Approved at`. `cstack graph ensure` exits with `4` when Graphify is missing. `cstack report check` exits with `1` when the executor returned without an accepted report. The common exit codes are `1` refused, `2` usage error, `3` invalid input, `4` missing tool and `5` tool failed. In the plan file of format 1, the ticket's headings move down one level, and the header has a `Target branch` line. Each unit has `- Files:`, either `- Test:` or `- No test: <reason>`, `- Commit message:` and `- Depends on:`. Blocking questions live in `## Blocking questions`, each with `- For:` and `- Answer:`. Once #23 wires it, `cstack next` prints the values of `.cstack/settings.json` above each guide. #14 ships the example file `templates/settings.json`.

## Scope

1. Write the entry skill `cstack/skills/resolve-issue/SKILL.md`. Keep the front matter of today's file (lines 1 to 5). Aim for about 700 words, so that the first guide has room.
   - Say in a few sentences what a run does, and that cstack does every mechanical step.
   - Tell Claude to read the conventions file first, as phase 0 does today (line 54). Then Claude runs `cstack next`, follows the guide it prints, and runs `cstack next --done <phase>` at the end of the phase. Claude never reads a guide ahead, and never does by hand a step that a cstack command does.
   - Say what Claude does with each common exit code. On `1`, Claude reads the message, fixes the cause and runs the command again, and never works around the refusal. On `3`, Claude fixes the plan file or the settings file as the message says. On `4`, Claude tells the user what to install. On `5`, Claude reads the output, tries once more, and then reports the problem to the user.
   - Say that `cstack next` prints the settings of the repository above each guide, and that these values win over any default that a guide gives (US-10 AC2). When the repository has no `.cstack/settings.json`, Claude tells the user and points to the example `templates/settings.json`.
   - Keep a short vocabulary: the conventions file, the tracker, the forge, the plan file, a blocking question and a fresh sub-agent. Start from lines 15 to 24 of today's file.
   - Keep the rule of line 42 for launching helpers as named agents, such as `resolve-issue:cto-review`, without a model. Add the one exception of ADR-SIC-D: the independent review uses the agent and the model of the settings.
   - Say that the conversation follows the user's language, and that every record uses the records language of the settings.
   - Give the four or five core writing rules in a few lines, and say that a guide asks for the full `writing.md` when it is needed.
   - Name the planned stops of a run, as line 11 does today, in two or three sentences.
   - When `cstack` is missing, Claude says so, gives the install command of the README, and stops. The skill has no prose fallback, as the specification decides.
2. Copy `skills/resolve-issue/writing.md` to `cstack/skills/resolve-issue/writing.md`. Change line 17, so that records use the records language of the settings, which is English by default. Replace the example ticket ids of lines 27 and 41 with a neutral id, such as `ABC-123`. Change nothing else.
3. Move the settled decisions (lines 195 to 212), the models table (lines 30 to 40) and the lessons applied (lines 214 to 218) into `cstack/skills/resolve-issue/settled-decisions.md`. Claude does not load this file at the start of a run.
   - Amend the decision of line 210 as ADR-SIC-D says, with a link to the ADR.
   - Add to the decision of line 212 that `cstack publish` now enforces the single push.
   - Rewrite the decision of line 208 so that records use the records language of the settings, English by default.
   - Drop the work ticket of line 211, and keep the rest of that decision.
   - Add one decision: the guides come from cstack one phase at a time, and the skill has no prose fallback.
4. Write the guide `cstack/guides/resolve-issue/ticket.md` from today's phase 1 (lines 58 to 68).
   - Keep the stop on empty arguments, the ticket shape, and the hard stop on hand-written tickets that miss a section.
   - Create the plan file from `templates/plan.md` at `docs/plans/<YYYY-MM-DD>-<ticket-id>-<slug>.md`. Copy the ticket word for word, with each of its headings moved down one level. Fill `Target branch` with the default branch of the repository, unless the ticket or the conventions file names another one.
   - End with `cstack next --done ticket --plan <plan file>`. On a stop, tell the user why, then run `cstack next --phase retro`.
5. Write `dependencies.md` from today's phase 2 (lines 70 to 78). On a stop, the guide ends with `cstack next --phase retro`.
6. Write `code-map.md` from today's phase 3 (lines 80 to 95). It starts with `cstack graph ensure` instead of the check of line 84. When the command exits with `4`, Claude passes its install message to the user and maps the code with search and file reads.
7. Write `questions.md` from today's phase 4 (lines 97 to 126). It starts by asking Claude to read `writing.md` in full, because the question round is the first long text for the user.
   - Claude keeps the whole round in "Open questions and answers" in the History part, as today.
   - Claude also writes each blocking question into `## Blocking questions`, with `- Answer: open` until it has its answer, its source and its date.
   - The guide ends with `cstack next --done questions`. It says that cstack refuses the `plan` phase while an answer is open, and what to do when the session ends before the answer arrives.
8. Write `plan.md` from today's phase 5 (lines 128 to 163).
   - Each unit lists every file it will touch in `Files`, and has either a `Test` line or a `No test` line with a reason. Units that share a file are allowed, because `cstack unit order` runs them one after the other.
   - Keep the meaning of the approval gate of lines 148 to 154 unchanged.
   - On approval, Claude writes the Status `approved` and runs `cstack next --done plan`, which records the time.
   - Claude then launches `resolve-issue:executor` with the repository path, the plan file path, the conventions file path and the path of `writing.md`, and waits.
   - When the executor returns, Claude runs `cstack report check`. On exit code `1`, Claude launches the executor again with the same inputs. Otherwise Claude handles the report as lines 158 to 163 and 185 to 189 say today. After a done report, `cstack next` prints the guide of the retrospective. After a failed report, or a needs-decision round that ends the session, Claude runs `cstack next --phase retro`.
9. Make every planning guide refer to the settings printed by `cstack next` wherever it needs a value that the settings file owns, instead of writing the value. Examples are the records language and the test commands.
10. Add the tests below, and check that the skill and the guides pass the command list test of #13.

## Acceptance (TDD)

* `cstack/test/skill-size.test.ts`: write first a fixture entry skill of 1,500 words, and check that the test fails. The test counts words the way `wc -w` does. It adds the words of `cstack/skills/resolve-issue/SKILL.md` and of the guide of the first phase in the phase list of #13. It fails when the sum is a fifth or more of the words of the frozen `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/writing.md`. Today that is 7,261 words, so the limit is 1,452 words. The real files pass (US-6 AC4).
* `cstack/test/guides/settings-applied.test.ts`: write first a fixture guide that says "write the plan in English", and check that the test fails. Then the real entry skill names `.cstack/settings.json` and says that the settings printed by `cstack next` win over the guides (US-10 AC2).
* `cstack/test/guides/settings-applied.test.ts`: the entry skill, `writing.md` and every file under `cstack/guides/resolve-issue/` contain no value that the settings file owns. The test holds one list of such phrases, such as "in English", a `Co-Authored-By` line and a fixed test command such as `npm test`. A guide that says "rebase" must also name the `integration` setting. The same test later covers the build guides of #22.
* `cstack/test/guides/planning-guides.test.ts`: write first a fixture folder where `questions.md` is missing, and check that the test fails and names it. Then each of the five planning phases has its guide.
* The command list test of #13 passes over the entry skill and the five guides.
* A reviewer finds the settled decisions in `settled-decisions.md`, with the amended model decision and no work ticket. The reviewer finds no example ticket id from work in `writing.md`.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #13, #9 · Feeds: #23


#### Ticket comments

Comment by gambitl on 2026-11-18T08:30:56Z:

The work of ticket #9 gives you what you need to ship the short `resolve-issue` skill and its planning guides. Here is what to build on.

Where things go: a skill goes in `cstack/skills/<skill name>/`, with a `SKILL.md`, a `.claude-plugin/plugin.json` that names the plugin, and its prompts in `agents/`. A guide goes in `cstack/guides/<skill name>/<phase>.md`. `cstack/package.json` lists `dist`, `skills` and `guides` under `files`, so a new folder is packed without any change. The example `cstack-example` skill and `hello.md` guide show the shape.

How to check it: `cstack/test/pack.test.ts` runs `npm pack --dry-run --json` and expects a list of paths. Add the paths of your files to that list. `cstack guide <phase>` uses `resolve-issue` when `--skill` is not given, so the phase guides of `resolve-issue` belong in `cstack/guides/resolve-issue/`.

Things that constrain you: do not put a `.gitignore` or an `.npmrc` inside `cstack/skills/` or `cstack/guides/`, because npm never packs them, and it also drops files that a nested `.gitignore` lists. `cstack skills install` replaces only folders that hold `.cstack-managed`, and moves the old folder to `~/.claude/skill-backups/` first. The package is named `@gambitl/cstack` and is never published on the npm registry. Names of skills and phases must match `^[a-z0-9][a-z0-9-]*$`. Do not run `cstack skills install` on the maintainer's real home folder before the baseline runs of #12 are done.
The skill keeps the name `resolve-issue`, so its agents load as `resolve-issue:<name>`. It cannot live next to the old prose skill on one machine, which is why #23 waits for #12.
The decision record is `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.


Comment by gambitl on 2026-11-18T09:15:11Z:

The work of ticket #14 (the settings file reader) gives you what you need to point the guides at the example file and to record the amendment.

The example file is `cstack/skills/resolve-issue/templates/settings.json`. It holds `"version": 1` and the defaults of `integration`, `recordsLanguage`, `forbiddenTools`, `commitAttribution` and `watchIntervalMinutes`. It leaves out `review` on purpose, so a repository that copies it keeps the header of `pr-reviewer.md` as its default. It also leaves out `testCommands`, because a repository must write its own. Your guide should say that. When `testCommands` is missing, a command that runs tests exits with code 3 and names `testCommands.all`.

The amendment you record is in `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`. The settled decision of the model and thinking level in the headers stays. The settings file can override the review agent and its model only. The thinking level stays in the header. Please write it next to the other settled decisions and cite the ADR.

The version rule matters for any text you write about the file. A new key keeps `version` at 1. A rename, a removal or a change of meaning moves it to 2.


Comment by gambitl on 2026-11-18T09:23:22Z:

Ticket #13 wrote the plan template that the entry skill copies. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

The template is `cstack/skills/resolve-issue/templates/plan.md`. It has the format `cstack-plan/1`. Its `Written by` line holds `not yet`, and cstack writes its version when it registers the plan file. `Approved at` and `Ready for review at` also hold `not yet`. The ticket is copied word for word under `## Ticket`, with each of its headings moved down one level. Blocking questions now have their own section, and "Open questions after the build" became "Non-blocking questions". Read `cstack/src/plan/read.ts` for the exact rules, and run `readPlan` on your plan to check it.

One rule for you. Do not cut a `v*` release before this ticket merges. Until then `cstack skills install` would ship a `resolve-issue` folder that holds only templates. Every `cstack` command that your skill names inside code must match an entry of `cstack/src/manifest.ts`, because a CI test checks it.


### Decisions already taken upstream

From the "Open questions and decisions" block of the epic (#6) and of `docs/projects/skills-into-cli.md`:

- Open question 5 of the epic: some units have no test. By default, the plan marks such a unit "no test" and gives a reason.
- ADR-SIC-B, where the run state lives and how its format is versioned: `docs/decisions/ADR-SIC-B-run-state.md` (ticket #13).
- ADR-SIC-C, how `cstack` ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md` (ticket #9).
- ADR-SIC-D, the settings file and the model of the review agent: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` (ticket #14). The settings file can change the review agent and its model only. The thinking level stays in the header. Ticket #21 records this amendment next to the other settled decisions.
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md` (ticket #8). The prose skills in `skills/` are frozen at the tag `prose-skills-final`.
- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.
- Rules for every ticket of the epic: every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. Claude is the only default agent. The repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives.
- Scope item 9 of the specification: the new skill has no prose fallback for when `cstack` is missing.

## Dependencies

Dependencies: clear. The blockers #13 and #9 are closed as completed (checked on 2026-11-18). Ticket #14, which the Contract line also names, is closed as completed.

## Code mapping

Graphify is not installed on this machine, and the run must not install it, so I mapped the code with search and file reads.

**The frozen prose.** `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/writing.md` are identical to the tag `prose-skills-final` and to the copy installed in `~/.claude/skills/resolve-issue/`. They must never be edited. Today `wc -w` counts 6,131 words in `SKILL.md` and 1,128 in `writing.md`, so 7,259 together. The ticket says 7,261, because the history rewrite of 2026-11-18 replaced the work references (commit `2c14821`) and changed two words. A fifth of 7,259 is 1,451.8, so the entry skill and the first guide may hold at most 1,451 words together. Both frozen files already pass `scripts/private_names.py check`. `writing.md` lines 27 and 41 now hold the ids `PROJ-288` and `PROJ-301`. The settled decision at `SKILL.md` line 211 names the work ticket `PROJ-12`, which the copy must drop.

**Word counts of today's phases.** Phase 0 holds 68 words (lines 52 to 56). Phase 1 holds 403 words (lines 58 to 68). Phase 2 holds 128, phase 3 holds 516, phase 4 holds 862 and phase 5 holds 1,207. The handling of the publish reports (lines 185 to 189) holds 88. So an entry skill of about 700 words plus a ticket guide of about 450 words leaves a margin of about 300 words under the limit.

**The phase list.** `cstack/src/phases.ts` defines `PHASES`, whose first entry is `ticket`, and `PLANNING_PHASES` (`ticket`, `dependencies`, `code-map`, `questions`, `plan`). The done check of `ticket` needs a copied ticket. The done check of `questions` needs the section `Blocking questions` to be filled, so it must hold the word `none` when there is no blocking question. The `plan` phase cannot start while a blocking question is open. Its done check needs the Status `approved` and at least one unit, and it writes `Approved at`. The `retro` phase depends on nothing.

**The command list.** `cstack/src/manifest.ts` holds `EXIT` (0 ok, 1 refused, 2 usage, 3 invalid input, 4 missing tool, 5 tool failed) and `COMMANDS`. Every command that a guide names exists there: `cstack next` with `--done`, `--phase`, `--plan` and `--new`, `cstack graph ensure`, `cstack report check`, `cstack unit order` and `cstack publish`. Only `doctor`, `guide`, `measure` and `skills install` are built. The others come from #15 to #20, which are still open.

**The command list test.** `cstack/test/manifest.test.ts` scans every file under `cstack/skills/` and `cstack/guides/` for `cstack <word>` inside inline code and fenced blocks, and fails on a command or a flag that `COMMANDS` does not have. It covers the new files with no change. Paths such as `.cstack/settings.json` and package names such as `gambitl-cstack-<version>.tgz` are not mentions.

**How `cstack next` behaves (ticket #15, open).** With no run, `cstack next` prints the `ticket` guide and records nothing. `cstack next --done ticket --plan <file>` creates the run. `cstack next --new` clears the worktree's current run and prints the `ticket` guide. When the next phase runs in the other place, cstack prints one line instead of the guide, for example after `plan`. After `--done retro`, cstack says whether `publish` comes next or whether the run stopped, and that `cstack next` resumes a stopped run later. It also prints the "Digest due" notice. #23 later prints a block headed "Settings of this repository" above each guide.

**Shipping.** `cstack/package.json` packs `dist`, `skills` and `guides`. `cstack guide <phase>` (`cstack/src/commands/guide.ts`) reads `guides/<skill>/<phase>.md`, with `resolve-issue` as the default skill. `cstack/test/pack.test.ts` holds a list of expected paths, and the comment of #9 on this ticket asks to add the new files to it. A skill folder also needs `.claude-plugin/plugin.json` and its `agents/`, but ticket #22 copies those, together with `templates/retro.md`. Today `cstack/skills/resolve-issue/` holds only `templates/plan.md` and `templates/settings.json`.

**The settings.** `cstack/src/settings.ts` defines the keys `integration`, `recordsLanguage`, `forbiddenTools`, `commitAttribution`, `watchIntervalMinutes`, `testCommands` and `review`. The example `cstack/skills/resolve-issue/templates/settings.json` leaves out `testCommands` and `review` on purpose.

**Tests.** Vitest picks up every `*.test.ts` under `cstack/test/`, and `tsconfig.json` type-checks `src` and `test`. Existing tests keep their helpers inside the test file, as `manifest.test.ts` does with `scan`. Fixtures live under `cstack/test/fixtures/<area>/`.

**Shared with the other tickets of this wave.** Ticket #22 writes `cstack/skills/resolve-issue/agents/`, `.claude-plugin/plugin.json`, `templates/retro.md` and the build guides, including `retro.md` and `publish.md`. Its `skills-package.test.ts` expects `writing.md` and `settled-decisions.md` from this ticket. It also expects the settings test of this ticket to cover its prompts and its build guides. Ticket #22's `retro` guide sends the main conversation back to the `plan` guide of this ticket to handle the report of the publish phase. This ticket needs no change to `cstack/src/`, `README.md` or `docs/projects/skills-into-cli.md`.

**Risks.** The guides name commands that are not built yet, so only the end-to-end run of #23 proves that the options fit. The word limit leaves little room, so every sentence of the entry skill and of the ticket guide counts.

## Decisions

**Files and boundaries**

- Never edit anything under the top-level `skills/` folder. Read `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/writing.md` as the source text of today's behaviour, at the line numbers the ticket gives. (2026-11-18, ADR-SIC-E and the ticket.)
- This ticket writes only these files: `cstack/skills/resolve-issue/SKILL.md`, `cstack/skills/resolve-issue/writing.md`, `cstack/skills/resolve-issue/settled-decisions.md`, the five guides `ticket.md`, `dependencies.md`, `code-map.md`, `questions.md` and `plan.md` in `cstack/guides/resolve-issue/`, the three new test files with their fixtures, and the list of paths in `cstack/test/pack.test.ts`. (2026-11-18, assumption not asked.)
- Ticket #22 writes `cstack/skills/resolve-issue/agents/`, `cstack/skills/resolve-issue/.claude-plugin/plugin.json`, `cstack/skills/resolve-issue/templates/retro.md` and the build guides. This ticket creates none of them. (2026-11-18, assumption not asked, from the scope of #22.)
- This ticket changes nothing in `cstack/src/`, `README.md` or `docs/projects/skills-into-cli.md`. (2026-11-18, assumption not asked.)

**How every new text is written**

- Write every new sentence in plain English that reads well aloud: one idea per sentence, a subject and a verb in each, and sentences under about 25 words. When Claude has something to do, say it directly, for example "Run `cstack next`". (2026-11-18, the documentation writing rules of the session.)
- Name phases by their names in backticks, such as `ticket`, `dependencies`, `code-map`, `questions`, `plan`, `build`, `document`, `retro` and `publish`. Never use today's phase numbers, such as "phase 5.3". (2026-11-18, assumption not asked.)
- Every `cstack` command written inside backticks or a code block must match an entry of `cstack/src/manifest.ts`, with only the flags of that entry. The commands the planning texts may name are `cstack next`, `cstack next --done <phase>`, `cstack next --done ticket --plan <plan file>`, `cstack next --phase retro`, `cstack next --new`, `cstack guide <phase>`, `cstack guide retro`, `cstack graph ensure`, `cstack report check` and `cstack unit order`. A CI test checks this. (2026-11-18, comment of #13 on the ticket.)
- No new text states a value that the settings file owns. Never write "in English", a `Co-Authored-By` line, or a fixed test command such as `npm test`. Never write "rebase" without naming the `integration` setting in the same file. Write instead "the records language that `cstack next` prints from the settings", which is English by default. (2026-11-18, US-10 AC2 and the ticket's scope item 9.)
- A guide printed by cstack is command output, so Claude Code does not replace `$ARGUMENTS` in it, and "next to this file" means nothing there. The entry skill keeps the line "The user has provided: $ARGUMENTS" and names the folder of the skill once, which Claude Code gives when the skill loads. The guides then say "the skill folder" when they point to `writing.md`, `templates/plan.md` or `templates/settings.json`. (2026-11-18, accepted by default.)

**The entry skill `cstack/skills/resolve-issue/SKILL.md`**

- It keeps the front matter of today's file (lines 1 to 5) word for word, and it covers every bullet of the ticket's scope item 1. (2026-11-18, the ticket.)
- It holds at most 800 words, counted with `wc -w`, front matter included. The `ticket` guide holds at most 550 words. Together they must stay under 1,451 words, which is a fifth of the 7,259 words of the two frozen files today. (2026-11-18, tested answer.)
- When `cstack next` prints a run line that names the plan file of another ticket, Claude runs `cstack next --new`. Claude then tells the user which plan file was set aside, because that run may wait for an answer. (2026-11-18, accepted by default.)
- When a guide printed earlier is no longer in the conversation, for example after the conversation was compacted, Claude prints it again with `cstack guide <phase>`. That command changes nothing in the run. (2026-11-18, accepted by default.)
- The exit codes are handled as the ticket's scope item 1 says. On `1`, Claude reads the message, fixes the cause and runs the command again, and never works around the refusal. On `2`, Claude fixes the command line as the usage message says. On `3`, Claude fixes the plan file or the settings file as the message says. On `4`, Claude tells the user what to install. On `5`, Claude reads the output, tries once more, and then reports the problem to the user. (2026-11-18, the ticket, and an assumption not asked for code `2`.)
- The settings printed by `cstack next` above each guide win over any default that a guide gives. When the repository has no `.cstack/settings.json`, Claude tells the user and points to the example `templates/settings.json` in the skill folder. The example leaves out `testCommands` on purpose, because each repository writes its own, and without them a command that runs tests exits with `3` and names `testCommands.all`. (2026-11-18, the ticket and the comment of #14.)
- When `cstack` itself is missing, Claude says so, gives the install command of the README, and stops. The README's command is `npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/gambitl-cstack-<version>.tgz`, with the latest release as the version. The skill has no prose fallback. (2026-11-18, the ticket and scope item 9 of the specification.)
- Helpers are launched as named agents, such as `resolve-issue:cto-review`, without a model, so the header of the prompt decides. The one exception is the independent review, which uses the agent and the model of the `review` setting, as ADR-SIC-D decides. (2026-11-18, the ticket.)
- The entry skill drops today's sentence about the harness's task list, because cstack now tracks the phases. (2026-11-18, assumption not asked.)

**The copy of the writing guide `cstack/skills/resolve-issue/writing.md`**

- It is a copy of the frozen `skills/resolve-issue/writing.md` with exactly four changes. Line 17 says that every record uses the records language that `cstack next` prints from the settings, English by default, instead of "written in English, unless the conventions file says otherwise". `PROJ-288` at line 27 becomes `ABC-123`. `PROJ-301` at line 41 becomes `ABC-124`. `M4-8` at line 58 becomes `ABC-125`, because it is a work ticket key that the public text rule forbids. Nothing else changes. (2026-11-18, the ticket, and accepted by default for line 58.)

**The settled decisions `cstack/skills/resolve-issue/settled-decisions.md`**

- It holds the models table and its explanation (today's lines 28 to 42), the settled decisions (lines 195 to 212) and the lessons applied (lines 214 to 218). Claude does not load it at the start of a run. (2026-11-18, the ticket.)
- The decision on models (line 210) gets an amendment: the settings file can change the agent and the model of the independent review only, and its thinking level stays in the header. It links to ADR-SIC-D with the full address `https://github.com/gambitl/claude-code-stack/blob/main/docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`, because the file is installed outside the repository. (2026-11-18, the ticket and accepted by default.)
- The decision on the single push (line 212) adds that `cstack publish` now enforces it, and it refers to `cstack publish` instead of the "Pushes" section. (2026-11-18, the ticket and accepted by default.)
- The decision on languages (line 208) says that every record uses the records language of the settings, English by default. (2026-11-18, the ticket.)
- The decision on blocking questions (line 211) drops the work ticket `PROJ-12` and keeps the rest of its text. (2026-11-18, the ticket.)
- A new decision says that the guides come from cstack one phase at a time and that the skill has no prose fallback, settled on 2026-11-18, with what it protects. (2026-11-18, the ticket.)
- Today's phase numbers become phase names: phase 1 is `ticket`, phase 3 is `code-map`, phases 5.3 and 5.4 are the `plan` phase, and phase 12 is `publish`. Nothing else in the decisions changes. (2026-11-18, accepted by default.)

**The planning guides in `cstack/guides/resolve-issue/`**

- Each guide comes from today's phase of the same subject, keeps its meaning, and follows the ticket's scope items 4 to 9. Each guide ends with the command that closes its phase: `cstack next --done ticket --plan <plan file>`, `cstack next --done dependencies`, `cstack next --done code-map`, `cstack next --done questions` or `cstack next --done plan`. (2026-11-18, the ticket.)
- The plan file comes from `templates/plan.md` in the skill folder, which has the format `cstack-plan/1`. The ticket is copied word for word under `## Ticket`, with each of its headings moved down one level. `Target branch` holds the default branch of the repository, unless the ticket or the conventions file names another one. (2026-11-18, the ticket.)
- When a run stops before the build, the plan file is kept, uncommitted, and Claude tells the user its path, so that `cstack next` can resume the run later. No guide deletes the plan file. This covers a stop on an open blocker in `dependencies` and a session that ends while a blocking question waits for someone else in `questions`. (2026-11-18, the user's answer.)
- A stop in the `ticket` phase, on a malformed ticket, happens before any run exists. The `ticket` guide then tells Claude to print the retrospective guide with `cstack guide retro`, follow it, and skip its final `cstack next --done retro`. A stop in a later planning phase tells the user why, then runs `cstack next --phase retro`. An empty argument is not a stop: Claude asks for a ticket id or URL and goes on. (2026-11-18, accepted by default.)
- The `code-map` guide starts with `cstack graph ensure` instead of today's check of line 84. When the command exits with `4`, Claude passes its install message to the user and maps the code with search and file reads. Graphify stays the first source when it is installed. (2026-11-18, the ticket.)
- The `questions` guide starts by asking Claude to read `writing.md` from the skill folder in full. Claude keeps the whole round under "Open questions and answers" in the History part. Claude also writes each blocking question into `## Blocking questions`, in the shape of the template's comment, with `- Answer: open` until it has its answer, its source and its date. When there is no blocking question, that section holds the single word `none`, because `cstack next --done questions` needs it filled. The guide says that cstack refuses the `plan` phase while an answer is open. (2026-11-18, the ticket and the phase list.)
- The `plan` guide keeps the meaning of today's approval gate (lines 148 to 154) unchanged. Each unit follows the comment of the template under "Implementation units": `Files` lists every file it touches, and the unit has either a `Test` line or a `No test` line with a reason. Units that share a file are allowed, because `cstack unit order` runs them one after the other. (2026-11-18, the ticket.)
- Before the approval gate, when a unit has a `Test` line and the settings have no `testCommands`, the `plan` guide tells Claude to tell the user, because `cstack unit red` would exit with `3` during the build. (2026-11-18, accepted by default.)
- On approval, Claude writes the Status `approved`, runs `cstack next --done plan`, then launches `resolve-issue:executor` with the repository path, the plan file path, the conventions file path and the path of `writing.md`, and waits without touching the repository. (2026-11-18, the ticket.)
- When the executor returns, Claude runs `cstack report check`. On exit code `1`, Claude launches the executor again with the same inputs, once. When the second run also ends without an accepted report, Claude stops and tells the user. Otherwise Claude handles the report as today's lines 158 to 163 and 185 to 189 say. After a done report, `cstack next` prints the retrospective guide. After a failed report, or a round that needs a decision and ends the session, Claude runs `cstack next --phase retro`. The `plan` guide also covers the report of the `publish` phase, because the `retro` guide of #22 sends Claude back to it. (2026-11-18, the ticket, and accepted by default for the single relaunch.)

**Tests**

- `cstack/test/skill-size.test.ts` counts words like `wc -w`: it splits on ASCII whitespace only (`[ \t\n\r\f\v]+`), because JavaScript's `\s` also matches a non-breaking space. It adds `cstack/skills/resolve-issue/SKILL.md` and the guide of `PHASES[0].name` from `cstack/src/phases.ts`. It fails when five times that sum is equal to or greater than the words of the frozen `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/writing.md`, read from the working tree at each run. The fixture entry skill of 1,500 words is generated in a temporary folder. (2026-11-18, the ticket and tested answer.)
- `cstack/test/guides/settings-applied.test.ts` holds one list of phrases that the settings file owns: "in English", "Co-Authored-By", "npm test", "npm run test", "yarn test", "pnpm test", "vitest run", "pytest", "go test", "cargo test", "mvn test", "gradle test" and "make test", matched without regard to case. A file that holds the word "rebase" must also hold the word `integration`. It scans every file under `cstack/guides/resolve-issue/` and `cstack/skills/resolve-issue/`, except the `templates/` folder and `settled-decisions.md`, so that it covers the prompts and build guides of #22 with no later change. It also checks that the entry skill names `.cstack/settings.json` and `cstack next`, and holds the words "win over". Its first case is a fixture guide that says "write the plan in English", which the scan must report. (2026-11-18, the ticket and accepted by default.)
- `cstack/test/guides/planning-guides.test.ts` checks that each phase of `PLANNING_PHASES` has its guide `<phase>.md`. Its first case is a fixture folder where `questions.md` is missing, and the failure message must name `questions`. (2026-11-18, the ticket.)
- Test helpers stay inside their test file, as `cstack/test/manifest.test.ts` does. Fixtures go under `cstack/test/fixtures/guides/`. (2026-11-18, assumption not asked, from the existing tests.)
- `cstack/test/pack.test.ts` gets the eight new paths in its list: `skills/resolve-issue/SKILL.md`, `skills/resolve-issue/writing.md`, `skills/resolve-issue/settled-decisions.md` and `guides/resolve-issue/<phase>.md` for the five planning phases. (2026-11-18, comment of #9 and accepted by default.)
- Commit messages follow Conventional Commits with the scopes of this repository: `feat(skill)` for skill prose and guides, and `test(tests)` for tests. (2026-11-18, assumption not asked, from the git history.)

**Rules of this run, from the coordinator of the wave**

- Never copy anything into `~/.claude/skills/`, never run `cstack skills install` against the real home folder, and never load the new skill in a Claude Code session. A baseline measurement of today's prose skill runs on this machine for ticket #12. Tests use temporary folders and fakes. (2026-11-18, coordinator's brief.)
- Graphify is not installed on this machine, and nobody may install it. Where a step says to run `graphify update .` or to query the graph, use search and file reads instead. (2026-11-18, coordinator's brief.)
- Tickets #16, #18 and #22 run at the same time in other worktrees. Ticket #22 writes in the same folders `cstack/skills/resolve-issue/` and `cstack/guides/resolve-issue/`, and it edits the same array in `cstack/test/pack.test.ts`. When you bring the branch up to date with `origin/main` and another ticket merged first, keep both sides of every conflict, then run `npm test` and `npm run typecheck` in `cstack/` again, and go on only when both pass. (2026-11-18, coordinator's brief.)
- Keep the author dates of the commits when you update the branch, because `cstack measure` reads the dates of the plan commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never push a tag that starts with `v`. (2026-11-18, coordinator's brief.)
- The history of the repository was rewritten on 2026-11-18 to remove private names. Do not undo that work. Never change the `user.email` of the git config, and never commit with another address. (2026-11-18, coordinator's brief.)
- Before the push of the publish phase, run two checks and push only when both pass. First, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`, which must exit with 0. The script never prints a name, and you must never print the private list. (2026-11-18, coordinator's brief.)
- When the `cstack` check of the pull request is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say in your report if it still did not run. (2026-11-18, coordinator's brief.)
- Never merge the pull request. The user merges it. (2026-11-18, coordinator's brief.)

**Public text**

- No file, commit, comment or pull request names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. (2026-11-18, the conventions file.)

## Architecture

The approach is locked by the ticket's scope: the change is prose in `cstack/skills/resolve-issue/` and `cstack/guides/resolve-issue/`, guarded by three new test files and eight more paths in the pack test. The prose units run in parallel, and the test units run after the prose they check.

## Implementation units

### Unit 1: Copy the writing guide — status: todo
- Files: `cstack/skills/resolve-issue/writing.md`
- Failing test: none. This unit copies a prose file with four edits. The settings test of unit 9 and the reviewer check of the acceptance cover it.
- Minimum code: copy `skills/resolve-issue/writing.md` to `cstack/skills/resolve-issue/writing.md`. Rewrite line 17 so that every record uses the records language that `cstack next` prints from the settings, English by default, without the words "in English". Replace `PROJ-288` with `ABC-123`, `PROJ-301` with `ABC-124` and `M4-8` with `ABC-125`. Change nothing else, and check with `diff` that only these lines differ.
- Refactor: none.
- Commit message: `feat(skill): copy the writing guide and take the records language from the settings`
- Depends on: none

### Unit 2: Write the settled decisions file — status: todo
- Files: `cstack/skills/resolve-issue/settled-decisions.md`
- Failing test: none. The acceptance asks a reviewer to find the amended model decision and no work ticket. The command list test of #13 covers the `cstack publish` mention.
- Minimum code: start the file with a title and two sentences that say what it holds and that Claude does not load it at the start of a run. Move the models table with its explanation (today's lines 28 to 42), the settled decisions with their introduction (lines 195 to 212) and the lessons applied (lines 214 to 218). Apply the amendments that "Decisions" lists for this file, and nothing else.
- Refactor: none.
- Commit message: `feat(skill): move the settled decisions and the models table out of the entry skill`
- Depends on: none

### Unit 3: Write the entry skill — status: todo
- Files: `cstack/skills/resolve-issue/SKILL.md`
- Failing test: none in this unit. The size test of unit 8 and the settings test of unit 9 check it.
- Minimum code: write the entry skill from today's lines 1 to 50 and the ticket's scope item 1, following every line of "Decisions" about the entry skill. Keep the front matter word for word. Stay at or under 800 words with `wc -w`.
- Refactor: remove any sentence that a guide already says.
- Commit message: `feat(skill): write the short entry skill of resolve-issue`
- Depends on: none

### Unit 4: Write the `ticket` guide — status: todo
- Files: `cstack/guides/resolve-issue/ticket.md`
- Failing test: none in this unit. The size test of unit 8, the settings test of unit 9 and the guides test of unit 10 check it.
- Minimum code: write the guide from today's phase 1 (lines 58 to 68) and the ticket's scope item 4, following "Decisions". Stay at or under 550 words with `wc -w`.
- Refactor: none.
- Commit message: `feat(skill): write the guide of the ticket phase`
- Depends on: none

### Unit 5: Write the `dependencies` guide — status: todo
- Files: `cstack/guides/resolve-issue/dependencies.md`
- Failing test: none in this unit. The settings test of unit 9 and the guides test of unit 10 check it.
- Minimum code: write the guide from today's phase 2 (lines 70 to 78) and the ticket's scope item 5, following "Decisions". On a stop, the plan file is kept and the guide ends with `cstack next --phase retro`.
- Refactor: none.
- Commit message: `feat(skill): write the guide of the dependencies phase`
- Depends on: none

### Unit 6: Write the `code-map` guide — status: todo
- Files: `cstack/guides/resolve-issue/code-map.md`
- Failing test: none in this unit. The settings test of unit 9 and the guides test of unit 10 check it.
- Minimum code: write the guide from today's phase 3 (lines 80 to 95) and the ticket's scope item 6, following "Decisions". It starts with `cstack graph ensure`.
- Refactor: none.
- Commit message: `feat(skill): write the guide of the code-map phase`
- Depends on: none

### Unit 7: Write the `questions` and `plan` guides — status: todo
- Files: `cstack/guides/resolve-issue/questions.md`, `cstack/guides/resolve-issue/plan.md`
- Failing test: none in this unit. The settings test of unit 9 and the guides test of unit 10 check them.
- Minimum code: write `questions.md` from today's phase 4 (lines 97 to 126) and the ticket's scope item 7. Write `plan.md` from today's phase 5 (lines 128 to 163), the report handling of lines 185 to 189, and the ticket's scope item 8. Follow every line of "Decisions" about these two guides. One unit holds both, because the blocking questions written in `questions` are the ones that the `plan` guide waits for and that the executor's reports bring back.
- Refactor: none.
- Commit message: `feat(skill): write the guides of the questions and plan phases`
- Depends on: none

### Unit 8: Test the size of the entry skill — status: todo
- Files: `cstack/test/skill-size.test.ts`
- Failing test: `cstack/test/skill-size.test.ts`. First write the case where a generated entry skill of 1,500 words, plus a short first guide, must be reported over the limit, and see it fail before the counting code exists. Then add the case that the real entry skill and the guide of `PHASES[0].name` stay under a fifth of the frozen files (US-6 AC4).
- Minimum code: the word count and the limit check inside the test file, as "Decisions" describes them. The failure message gives the sum and the limit.
- Refactor: none.
- Commit message: `test(tests): check that the entry skill and the first guide stay under a fifth of the prose skill`
- Depends on: 3, 4

### Unit 9: Test that the texts leave the settings values to the settings file — status: todo
- Files: `cstack/test/guides/settings-applied.test.ts`, `cstack/test/fixtures/guides/owned-value/plan.md`
- Failing test: `cstack/test/guides/settings-applied.test.ts`. First write the fixture guide that says "write the plan in English" and the case that the scan must report it with the file and the phrase, and see it fail before the scan exists. Then add the case that the real files pass, and the case that the entry skill names `.cstack/settings.json` and `cstack next` and holds the words "win over" (US-10 AC2).
- Minimum code: the scan inside the test file, with the list of phrases and the folders that "Decisions" gives. If a real file breaks a rule, fix the wording of that file in this unit.
- Refactor: none.
- Commit message: `test(tests): check that the skill and the guides leave the settings values to the settings file`
- Depends on: 1, 3, 4, 5, 6, 7

### Unit 10: Test that every planning phase has its guide — status: todo
- Files: `cstack/test/guides/planning-guides.test.ts`, `cstack/test/fixtures/guides/planning-missing-questions/ticket.md`, `cstack/test/fixtures/guides/planning-missing-questions/dependencies.md`, `cstack/test/fixtures/guides/planning-missing-questions/code-map.md`, `cstack/test/fixtures/guides/planning-missing-questions/plan.md`
- Failing test: `cstack/test/guides/planning-guides.test.ts`. First write the case with the fixture folder where `questions.md` is missing, which must fail and name `questions`, and see it fail before the check exists. Then add the case that `cstack/guides/resolve-issue/` has a guide for each phase of `PLANNING_PHASES`.
- Minimum code: the check inside the test file.
- Refactor: none.
- Commit message: `test(tests): check that each planning phase has its guide`
- Depends on: 4, 5, 6, 7

### Unit 11: List the new files in the pack test — status: todo
- Files: `cstack/test/pack.test.ts`
- Failing test: none of its own. This unit adds eight expected paths to the existing pack test, which passes at once because units 1 to 7 created the files.
- Minimum code: add the eight paths that "Decisions" lists to the array of expected paths, and make the test title say that it lists the skills and the guides. Keep the change small, because #22 edits the same array.
- Refactor: none.
- Commit message: `test(tests): expect the resolve-issue skill files and guides in the package`
- Depends on: 1, 2, 3, 4, 5, 6, 7

**Security by design.** No security surface: the change adds prose and tests, with no endpoint, query or external input. Skip.

**User interface.** No unit creates or changes a user interface, so no design specification applies.

**Final check of the build.** `npm test` and `npm run typecheck` pass in `cstack/`, and `wc -w` on the entry skill and the `ticket` guide gives less than 1,451 words together.

## Documentation duties

- Ticket comment on #21: applies, written to GitHub issue #21. It says what was built, where each file is, and the decisions taken in this run that differ from the ticket's text, such as the plan file kept on a stop and `cstack guide retro` after a stop in the `ticket` phase.
- Dependent ticket comment on #23, which this ticket feeds: applies, written to GitHub issue #23. It gives what the end-to-end run must know: the commands and flags that the planning guides call, the plan file kept on a stop, `cstack next --new` when another run is current, and the single relaunch after `cstack report check` exits with `1`.
- Comment on #22, which shares the folders: applies, written to GitHub issue #22. It says that the settings test scans `agents/` and the build guides too, that the `ticket` guide skips `cstack next --done retro` after a stop, and that the `plan` guide handles the report of the `publish` phase.
- ADR-SIC-D: applies, written to `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`. One sentence under "Consequences" says that the amendment is recorded in `cstack/skills/resolve-issue/settled-decisions.md`.
- New ADR: does not apply. This ticket follows decisions that already exist.
- Specification page `docs/projects/skills-into-cli.md`: does not apply. Nothing in it changes.
- `README.md`: does not apply. The new skill is not released before #23.

## Review log

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

- 2026-11-18: phase 6 started. GitHub issues have no in-progress state, so the ticket stays open with no change. The branch gambitl/short-skill-planning was already checked out.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

One decision is needed before I plan. For everything else, I apply my recommendation unless you say no.

**I need your answer before I plan**

**When the skill stops before the build, keep the plan file instead of deleting it?** Today's skill deletes it after an open blocker, or when the session ends while an answer is awaited. With cstack, the run is already recorded in the git folder, and the worktree points at it. Without the file, the next `cstack next` in that worktree cannot read the plan until someone runs `cstack next --new`. I recommend keeping it, uncommitted, and telling the user its path, because that is what lets `cstack next` resume later.

**I will do this unless you say no**

- When `cstack next` names a run of another ticket, I run `cstack next --new` and say which plan file was set aside. The command keeps the old run's folder.
- A stop in the `ticket` phase happens before any run is recorded. So the `ticket` guide prints the retrospective guide with `cstack guide retro` and skips `cstack next --done retro`. The ticket that builds `cstack next` (#15) does not say what those commands do without a run.
- A guide printed by cstack is only command output. Claude Code does not replace `$ARGUMENTS` in it, and "next to this file" means nothing there. The entry skill keeps `$ARGUMENTS` and names the skill folder once, and the guides say "the skill folder" for `writing.md` and `templates/plan.md`.
- In a long conversation, compaction can summarise away a guide printed earlier. The entry skill says to print it again with `cstack guide <phase>`, which changes nothing.
- The settings test scans all of `cstack/guides/resolve-issue/` and `cstack/skills/resolve-issue/`, except `templates/` and `settled-decisions.md`. The prompts and build guides of the ticket that ships them (#22) are then covered with no change, as it expects.
- `writing.md` also holds a work ticket key at line 58, in its example. The copy replaces it, like the ids of lines 27 and 41.
- I relaunch `resolve-issue:executor` once at most. The settled decisions use phase names and a full GitHub link to ADR-SIC-D. The `plan` guide warns before approval when a unit has a test and the settings have no `testCommands`. The eight new files go into the list of `pack.test.ts`.

**I checked it myself**

The frozen files hold 7,259 words, so the limit is 1,451. A JavaScript split on whitespace gives exactly the `wc -w` counts on both files.

**Good to know**

- #22 adds its paths to the same list in `pack.test.ts`, so whoever merges second resolves a small conflict.
- The frozen `skills/resolve-issue/writing.md` keeps that work key at line 58, and this ticket must not touch it.

#### Details

Keeping the plan file on a stop before the build is blocking, and only the user can answer it, because it changes what the `ticket`, `dependencies` and `questions` guides tell Claude to do. Today's skill deletes the file at `skills/resolve-issue/SKILL.md` line 68 ("If the workflow stops before phase 6, delete it") and again in phase 4.3 (line 124). ADR-SIC-B puts the run state in `<common git folder>/cstack/runs/<plan file name>/` and points each worktree at it through `current-run`. Ticket #15 (scope step 8) makes `cstack next` exit with `3` when the plan reader refuses the file. A deleted plan file therefore leaves the worktree stuck until `cstack next --new`. I rejected committing the plan file instead. Before approval there may be no feature branch, and the push rule keeps commits for the build. The cost of keeping it is small. The file is lost if the user deletes the worktree, and the run folder then stays behind, unused and harmless. A resume must happen in the same worktree, because the file is not committed. If nobody decides, the guides would copy today's deletion, and resuming after a stop would break.

On `cstack next` naming a run of another ticket, which is non-blocking, I agree with the draft. Ticket #15 (scope step 6) says that `--new` clears only `current-run` and keeps the folders of earlier runs, so nothing is destroyed. I add one sentence that tells the user which plan file was set aside, because that run may be waiting for an answer. The same applies when the named run is already finished.

The retrospective after a stop in the `ticket` phase is blocking, because it changes the text of the `ticket` guide, and it cannot be tested, because #15 is not built. Today's skill runs the retrospective after a malformed ticket too (`SKILL.md` line 165), but at that point no plan file exists and `cstack next --done ticket --plan` has not run. Ticket #15 defines `--phase retro` and `--done retro` only for an existing run (scope steps 2 and 5). If `current-run` still pointed at an earlier ticket, the retrospective would be marked on the wrong run. Printing the guide with `cstack guide retro`, which is built and changes no state, avoids the dependency. The `ticket` guide then tells Claude to skip the final `cstack next --done retro` of the retrospective guide. The only loss is the "Digest due" notice for that one stop, and the next run shows it. The other option was to ask #15 to define the no-run case. If the user prefers it, this is the comment for #15: "When no run exists, what should `cstack next --phase retro` and `cstack next --done retro` do? The `ticket` guide of #21 needs it for a stop on a malformed ticket, before the plan file exists. Proposal: print the guide and record nothing, and still print the Digest due notice after `--done retro`." This departs from the ticket's scope item 4, which says `cstack next --phase retro` for every stop.

Guides printed by cstack lose two things that today's skill relies on, which is non-blocking but easy to miss. Claude Code replaces `$ARGUMENTS` only in the body of `SKILL.md`, and today's text uses it at lines 9 and 60. Claude Code gives Claude the base folder of a skill when the skill loads, so "next to this file" works in `SKILL.md` (lines 19 and 21) but not in a guide. ADR-SIC-C installs the skill into `~/.claude/skills/resolve-issue/`, while `cstack guide` reads the guide from the npm package. A relative path such as `templates/plan.md` inside a guide would resolve against the repository, where it exists only in this repository. The same holds for the example settings file that the entry skill points to. If nobody acts, a guide copied from today's text would test an empty `$ARGUMENTS` that is never filled and look for the template in the wrong place.

Reprinting a guide after compaction is non-blocking. Each guide reaches Claude as a Bash result, and Claude Code compaction summarises older results. The `plan` guide stays in force through the approval gate and every report of the executor, which can span a long session with several decision rounds. `cstack guide <phase>` is built (#9) and changes nothing. Running `cstack next` again would record a new `startedAt` (#15 scope step 3). The sentence costs about 30 of the 1,451 words.

The scope of the settings test is non-blocking. The acceptance criteria name the entry skill, `writing.md` and the guides, and the comment from #22 expects the same test to cover its prompts and build guides. Scanning both folders does that with no later change. The frozen prompts that #22 will copy say "in English" (`agents/cto-review.md` lines 29 and 31, `agents/executor.md` line 121) and "rebase" (`agents/executor.md` lines 57 and 107), so #22 must rewrite them, which is the point of the test. `templates/` is excluded because a template is data, not instructions. `settled-decisions.md` is excluded because it records past decisions and may need to name an old value. If #22 merges first, this branch sees its files on the update. If it merges second, #22 fixes them.

The work ticket key in `writing.md` is non-blocking, and it corrects the draft's check of the example ids. Line 58 ends with a milestone-style key in parentheses. No issue of this repository has that key: `gh issue list --state all` shows keys up to milestone 4, ticket 2. Line 52 says that the example comes from a real plan, so the key comes from work, which the public text rule forbids quoting. The copy replaces it with a neutral id such as `ABC-125`, or drops the parenthesis. The counts in the same example come from a work plan, not from a retrospective, so the rule allows them. The ticket's "change nothing else" yields to the public text rule here.

The remaining drafts are non-blocking, and I agree with each of them. Relaunching the executor once at most prevents a loop. Phase names in `settled-decisions.md`, and a full GitHub address for ADR-SIC-D, keep the file correct once it is installed outside the repository. The warning on a missing `testCommands` comes from the comment of #14, and it saves an exit code `3` from `cstack unit red` in the middle of the build. The paths in `pack.test.ts` come from the comment of #9.

The word limit was blocking and is answered by a test. `wc -w` gives 6,131 and 1,128 words, 7,259 in total, and a fifth is 1,451.8, so the limit is 1,451 words. A Node script using `split(/\s+/)` gave the same two counts, and neither file holds a non-breaking or other Unicode space. The test should still split on ASCII whitespace only (`[ \t\n\r\f\v]+`). JavaScript's `\s` also matches non-breaking spaces, which `wc -w` does not treat as separators in the C locale, so a pasted non-breaking space would make the two counts differ.

Ticket #22 edits the same array of expected paths in `cstack/test/pack.test.ts`, so a small merge conflict is certain. The frozen `writing.md` keeps the work key at line 58 publicly. Removing it from the frozen file would need another history rewrite, which is the user's call outside this ticket. This run must not edit `skills/`.

Locked decisions that I did not reopen are ADR-SIC-C (cstack ships the skills and serves the guides), ADR-SIC-D (only the review agent and its model can change), ADR-SIC-E (the prose skills stay frozen), scope item 9 of the specification (no prose fallback) and the settled decision "Graphify first in code mapping". I checked security and authorization, scale and performance, operations and cost, and reversibility, and found nothing that this ticket touches: the front matter stays the same, and no release is cut before #23.

### Open questions and answers

**Q1. Blocking. When a run stops before the build, do the guides keep the plan file or delete it?** Today's skill deletes the plan file when a run stops before phase 6: after an open blocker in phase 2, and when the session ends while a blocking question waits for someone else's answer (phase 4.3). With cstack, `cstack next --done ticket --plan <file>` records the run, and ticket #15 says that `cstack next` resumes a stopped run later. Deleting the file would leave a recorded run whose plan file is gone. Recommended answer: keep the plan file, uncommitted, and tell the user where it is, so that `cstack next` can resume the run when the blocker closes or the answer arrives. The stop on a malformed ticket is not concerned, because the plan file does not exist yet at that point. Only the user can answer this.

Answer: keep the plan file, uncommitted, and tell the user its path. The user accepted the whole block with "très bien" in the conversation on 2026-11-18. The answer is written in "Decisions".

**Q2. Non-blocking, accepted by default on 2026-11-18. What does the entry skill do when `cstack next` names a run of another ticket?** The ticket does not say. Recommended answer: Claude runs `cstack next --new`, which clears the current run of the worktree and prints the `ticket` guide, because the user asked for this ticket.

**Q3. Non-blocking, accepted by default on 2026-11-18. How many times does Claude relaunch the executor when `cstack report check` exits with `1`?** The ticket says to relaunch it with the same inputs. Recommended answer: relaunch it once. When the second run also ends without an accepted report, Claude stops and tells the user, so that a run never loops.

**Q4. Non-blocking, accepted by default on 2026-11-18. Does `settled-decisions.md` keep today's phase numbers?** The new skill names its phases instead of numbering them. Recommended answer: replace "phase 1", "phase 3", "phase 5.3", "phase 5.4" and "phase 12" with the phase names `ticket`, `code-map`, `plan` and `publish`, and replace the reference to the "Pushes" section with `cstack publish`. The link to ADR-SIC-D is a full GitHub address, because the file is installed outside the repository, where a relative link breaks.

**Q5. Non-blocking, accepted by default on 2026-11-18. Where does the skill say that the example settings file has no `testCommands`?** The comment of #14 on this ticket asks the guide to say it. Recommended answer: one sentence in the entry skill, next to the example file, and a check in the `plan` guide. Before the approval gate, when a unit has a `Test` line and the settings have no `testCommands`, Claude tells the user, because `cstack unit red` would exit with `3` during the build.

**Q6. Blocking, answered by a test. What is the word limit?** I checked it: `wc -w` counts 6,131 words in the frozen `skills/resolve-issue/SKILL.md` and 1,128 in `writing.md`, so 7,259, not the 7,261 of the ticket. The history rewrite of 2026-11-18 (commit `2c14821`) changed two words. A fifth is 1,451.8, so the limit is 1,451 words. The test computes the limit from the frozen files at each run, so the number is not written in the test.

**Q7. Non-blocking, answered by a test. Are the example ids of `writing.md` still from work?** I checked it: after the history rewrite they read `PROJ-288` and `PROJ-301`, and `scripts/private_names.py check` exits with 0 on both frozen files. The copy still replaces them with `ABC-123` and `ABC-124`, as the ticket asks.

**Q8. Non-blocking, accepted by default on 2026-11-18. Does this ticket add its files to `cstack/test/pack.test.ts`?** The comment of #9 on this ticket asks for it. Recommended answer: yes, add `skills/resolve-issue/SKILL.md`, `writing.md`, `settled-decisions.md` and the five guides to its list of expected paths.

The points that the advisor added under "I will do this unless you say no" were accepted by default on 2026-11-18: the `ticket` guide uses `cstack guide retro` after a stop, guides say "the skill folder", the entry skill tells Claude to print a guide again after compaction, the settings test scans both folders, and the copy of `writing.md` also replaces the key at line 58.

Assumptions not asked, written into "Decisions": the plugin file and the agent prompts come from #22; no change to `README.md`, `cstack/src/` or the specification page; the size test reads the first phase from `PHASES`; the settings test checks the entry skill for `.cstack/settings.json` and the words "win over"; the entry skill drops the sentence about the harness's task list, because cstack now tracks the phases.

### Architecture options

No real choice: the ticket's scope fixes the files and their content. No new decision since phase 4.
