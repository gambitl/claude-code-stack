# Plan: #59 — M3-9: Write the rules of a run's brief into the plan's Decisions

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/59
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/brief-rules
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T18:04:45+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** When someone starts the skill with extra rules for one run, the skill writes those rules where every helper agent reads them.

- **What the title means**: The `resolve-issue` skill takes one ticket all the way to a pull request. A run is one use of the skill on one ticket. The brief of a run is the message that starts the skill, when that message carries rules for this run. For example, the coordinator of a wave gives each worker the shared files, the merge order and the checks before a push. The plan file is the file in `docs/plans/` where the skill writes everything about the run. Its `## Decisions` section holds the rules that the run follows.
- **Why we are doing it**: The helpers of a run, which are the executor and the implementers, read only some sections of the plan file. `## Decisions` is one of them. No guide says where the rules of a brief go, so the main conversation put them under "Decisions already taken upstream", which no helper reads. In the runs of #26 and #28, the rules of the coordinator had to be copied into `## Decisions` by hand before the build.
- **For the user**: The person who starts a run, or the coordinator of a wave, gives the rules once and can trust that every helper follows them.

**Goal.** This ticket makes the `ticket` guide of `resolve-issue` write each rule of a run's brief into `## Decisions`, with its source.

### Where things are today (read first)

* **The ticket guide**: `cstack/guides/resolve-issue/ticket.md` (line 40) says to write the decisions block of the parent project under `### Decisions already taken upstream`. No line of the guides says what to do with rules given in the message that starts the skill.
* **What the helpers read**: `cstack/skills/resolve-issue/agents/implementer.md` (line 22): An implementer reads only the sections `Unit <n>`, `Decisions`, `Architecture`, `Code mapping`, `Where things are today`, `Scope`, `Acceptance` and the CTO review block, each with `cstack plan section`. `cstack/test/plan-section.test.ts` (line 23) checks that `cstack plan section Decisions` does not print the block "Decisions already taken upstream".
* **The executor**: `cstack/skills/resolve-issue/agents/executor.md` (line 26): The executor runs `cstack next` and follows the guide of its phase. It works from the plan file only.
* **The evidence**: `docs/retros/2026-11-19-26.md` and `docs/retros/2026-11-19-28.md` report the rules copied by hand. Earlier plans hold a block "Rules of this run" in `## Decisions`, also written by hand. Examples are `docs/plans/2026-11-18-14-read-and-check-the-per-repository-settings-file.md` (line 234) and `docs/plans/2026-11-19-24-define-the-orca-adapter-and-the-tracker-interface.md` (line 292).
* **How runs start**: `cstack/src/wave/start-orca.ts` (line 18): `cstack wave` starts a ticket with the prompt `/resolve-issue <key>` only. It cannot pass a brief today. That channel is out of scope here, as the last scope item says.

### Scope

1. In `cstack/guides/resolve-issue/ticket.md`, after the line about the upstream decisions, add a short paragraph. When the message that started the skill gives rules for this run, write each rule as one line of `## Decisions`. End each line with "(<date>, from the brief of the run)". Say why in one sentence: the executor and the implementers read `## Decisions`, and they never read the `## Ticket` section.
2. In the same paragraph, say that `### Decisions already taken upstream` keeps only the decisions of the parent project.
3. In the same paragraph, say that a rule of the brief never removes a gate of the skill and never changes the settings file. When a rule of the brief conflicts with a gate, the settings file or the conventions file, the main conversation asks the user before it goes on.
4. Out of scope: a way for `cstack wave`, or for a coordinator, to hand a brief file to a run. The next epic, which builds the coordinator of a whole epic, decides it. The comment on #6 records this question.

This ticket and #31 both change `cstack/guides/resolve-issue/ticket.md`. Merge this ticket before #31 starts, so that the release of #31 ships the new paragraph and the two branches do not meet in that file.

### Acceptance (TDD)

* `cstack/test/guides/brief-rules.test.ts`: Write first a case that reads `cstack/guides/resolve-issue/ticket.md` and expects a paragraph about the rules of a run's brief. The paragraph names `## Decisions` and the source "from the brief of the run". See the case fail on today's guide, then pass.
* The same test checks that the line about `### Decisions already taken upstream` still speaks only of the parent project, and that the paragraph says to ask the user when a rule of the brief conflicts with a gate or the settings file.
* The size tests of the skill, such as `cstack/test/skill-size.test.ts`, still pass.
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

**Entry point.** The only guide to change is `cstack/guides/resolve-issue/ticket.md`. Line 40 is the sentence about `### Decisions already taken upstream`. Line 42 says "From now on every phase writes its results into this file." The new paragraph goes between these two lines, in the section "Create the plan file".

**The size limit.** `cstack/test/skill-size.test.ts` adds the words of `cstack/skills/resolve-issue/SKILL.md` and of the first guide, which is `ticket.md` because `PHASES[0]` is `ticket`. The sum must stay under a fifth of the words of the frozen `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/writing.md`. It counts words like `wc -w`. On 2026-11-19, the entry skill holds 836 words and the ticket guide holds 508, so the sum is 1,344. The frozen files hold 7,259 words, so the sum must stay at 1,451 words or less. The new paragraph therefore has a budget of about 100 words. Ticket #31 will add to the same guide later and will share what is left.

**Other tests that read every guide.** `cstack/test/guides/settings-applied.test.ts` refuses a guide that contains "in English", "Co-Authored-By", "npm test", "vitest run" or another test command. It also refuses the word "rebase" in a file that does not name the `integration` setting. `cstack/test/prompts.test.ts` (the push rule) refuses any sentence of a guide that contains "git push". `cstack/test/no-graphify.test.ts` refuses the name of that tool. `cstack/test/pack.test.ts` lists `guides/resolve-issue/ticket.md` among the packed files, and the file name does not change. `cstack/test/guides/phases-have-guides.test.ts` and `planning-guides.test.ts` only check that the guide files exist.

**Test patterns.** The tests under `cstack/test/guides/` use vitest (`describe`, `it`, `expect`). They find the guides with `new URL("../../guides/resolve-issue/", import.meta.url)` and read them with `readFileSync`. `cstack/test/prompts.test.ts` splits a text into sentences with the pattern `/(?<=[.!?])\s+/`, which the new test can reuse to check that words appear in the same sentence or paragraph. The new test file is `cstack/test/guides/brief-rules.test.ts`.

**What the helpers read.** `cstack/skills/resolve-issue/agents/implementer.md` (line 22) reads `Unit <n>`, `Decisions`, `Architecture`, `Code mapping`, `Where things are today`, `Scope`, `Acceptance` and the CTO review block, and nothing else. `cstack/test/plan-section.test.ts` (line 23) checks that `cstack plan section Decisions` does not print the upstream block. The executor follows the guides of the build phases and works from the plan file only (`cstack/skills/resolve-issue/agents/executor.md`, line 26).

**Neighbouring guides.** `cstack/guides/resolve-issue/plan.md` (line 19) asks the plan phase to write `## Decisions` before the units, with every upstream decision that the work must respect. Its line 41 says that a later answer replaces the line of the decision it changes. The new paragraph writes lines into `## Decisions` earlier, at the ticket phase, and the plan phase keeps them. `cstack/guides/resolve-issue/questions.md` (line 3) reads the upstream block, and its line 19 writes defaults into `## Decisions` as "an assumption not asked". The template `cstack/skills/resolve-issue/templates/plan.md` lists the sources of a decision line as the user's answer, an assumption not asked, a tested answer, or the answer of someone else. It does not list "from the brief of the run", and the scope of the ticket does not change it.

**Recent history.** `ticket.md` changed twice: `a9c07b8` wrote it, and `c463522` stopped it from naming the arguments variable and split long sentences. It changed together with `questions.md` and `plan.md` once. The file has no history of repeated fixes, and nothing in the code depends on its wording apart from the tests above.

**Governing decisions.** ADR-SIC-C says that `cstack` ships the guides and serves them at its own version, so this change reaches runs only after the next release. ADR-SIC-E freezes the top-level `skills/` folder, so the frozen `skills/resolve-issue/` files stay untouched even though the size test reads them. ADR-SIC-D makes `.cstack/settings.json` the owner of the review agent and of other values, which supports the rule that a brief never changes the settings file. No `WHY:` or `DECISION:` comment exists in the files to change.

## Decisions

- This ticket changes `cstack/guides/resolve-issue/ticket.md` and adds one test file, `cstack/test/guides/brief-rules.test.ts`. It should not need `cstack/src/manifest.ts`, `cstack/src/cli.ts` or the counts of built commands. If it touches `README.md` or `docs/projects/skills-into-cli.md`, keep the change small and in its own place. (2026-11-19, from the coordinator of the wave)
- Two other tickets of the wave run at the same time, each in its own worktree. Ticket #30 (`cstack wave --watch`) works in `cstack/src/wave/`. Ticket #28 is already merged on `main` through pull request #58. Neither of them changes `cstack/guides/` or `cstack/test/guides/`. Ticket #31 will change the same `ticket` guide later, so this pull request should be ready soon, before #31 starts. (2026-11-19, from the coordinator of the wave)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. (2026-11-19, from the coordinator of the wave)
- After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, and keep both changes. Push it with a plain `git push`, without force. (2026-11-19, from the coordinator of the wave)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. In wave 7, one branch pushed a commit that still held conflict markers. (2026-11-19, from the coordinator of the wave)
- When you update the branch onto `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates in the plan file and in the commits. Never push a tag that starts with `v`. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`. Run `npm ci` in `cstack/` before the first type check or test run. (2026-11-19, from the coordinator of the wave)
- The full suite takes about 90 to 100 seconds. Give the shell call a timeout above 120 seconds, or run it in the background, so that the shell limit does not cut it. (2026-11-19, from the coordinator of the wave)
- The test "names a unit without a commit" in `cstack/test/report.test.ts` sometimes goes past its 5-second timeout in a full run, and it passes when you run it again. When several workers run their suites at the same time on this machine, other slow tests can fail once too. Run the suite again before you look for a bug. (2026-11-19, from the coordinator of the wave)
- On macOS, `sed -i` needs an empty argument, as in `sed -i ''`. (2026-11-19, from the coordinator of the wave)
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). Read them as the reference for today's behaviour, but never edit anything under `skills/`. New skill files go under `cstack/skills/` and `cstack/guides/`. (2026-11-19, from the coordinator of the wave)
- This run follows the guides of the installed `cstack` 0.2.0, which `cstack next` prints. This branch changes the source of those guides in `cstack/guides/resolve-issue/`. Keep following the installed guides during this run. (2026-11-19, from the coordinator of the wave)
- Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. Any of these would change the tool and the skill that every worker of this wave is running right now. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-19, from the coordinator of the wave)
- The new paragraph of the guide is prose that agents read. Put one idea in each sentence, and give each sentence a subject and a verb. Keep sentences under about 25 words, and never follow a colon or a dash with a fragment. Keep the paragraph short, because the size tests of the skill limit the guides. (2026-11-19, from the coordinator of the wave and the documentation writing rules of the session)
- Never change `.cstack/settings.json` in this branch. The test commands come from that file on `main`, and the independent review refuses a branch that changes it, because the file names the reviewer. (2026-11-19, from the coordinator of the wave)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, report it to the user, and write it in the retrospective with the tag `[skill]`. (2026-11-19, from the coordinator of the wave)
- The stops of the skill are the blocked ticket, the question round, the approval gate of the plan and the questions after the build. Each stop goes to the user in the chat of the main conversation, and never to the coordinator. Nobody answers a stop in the user's place. Only the main conversation talks to the coordinator, and only about coordination, such as the state of another ticket of the wave. (2026-11-19, from the coordinator of the wave)
- The conversation with the user is in French. Everything written in the repository and on GitHub stays in English. (2026-11-19, from the coordinator of the wave)
- GitHub issues have no state for work in progress or in review. To move this ticket to "in progress", add the label `in progress`. To move it to "in review", remove `in progress` and add `in review`. (2026-11-19, from the coordinator of the wave)
- This repository is public. Never write the name of an employer or a client, a work ticket key, or a count from work retrospectives. This covers files, commits, the pull request, ticket comments, the plan file and the retrospective. (2026-11-19, from the coordinator of the wave)
- The history of this repository was rewritten on 2026-11-18 to remove private names, so do not undo that work. The git config of the repository sets `user.email` to the maintainer's GitHub no-reply address. Never change it, and never commit with another address. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-19, from the coordinator of the wave)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)
- Never merge the pull request, because the user merges it. Never read, run or change anything under `~/comparison/`, which holds private work data. Never install Graphify or Repowise. (2026-11-19, from the coordinator of the wave)
- The new paragraph says "each rule of the brief", as the scope of the ticket says. It does not limit the copy to the rules that a helper needs, because a copied rule that only the main conversation uses does no harm. (2026-11-19, accepted by default)
- This ticket changes neither the plan template `cstack/skills/resolve-issue/templates/plan.md` nor the entry skill `cstack/skills/resolve-issue/SKILL.md`. The template's list of decision sources stays as it is, and so does the list of planned stops in the entry skill. (2026-11-19, accepted by default)
- The new paragraph does not repeat that a copied rule is written in the records language, or that it follows the public text rule of the conventions file. The entry skill and the conventions file already say both, and the guide has little room left. (2026-11-19, assumption not asked)
- Asking the user about a conflict between a rule of the brief and a gate, the settings file or the conventions file is not a stop of the run. The run goes on with the user's answer, as it does when the user gives a missing ticket id. (2026-11-19, accepted by default)
- The new paragraph tells the reader never to copy a secret of the brief, such as a token, into the plan file, and to say where to find it instead. The plan file is committed and pushed, and a pushed secret can only be removed by rewriting the history. (2026-11-19, the user's answer)
- The new paragraph lists four things that a rule of the brief cannot override without asking the user first: a gate of the skill, the ticket, the settings file and the conventions file. A rule of the brief that narrows the scope or the acceptance of the ticket goes to the user. (2026-11-19, accepted by default)
- `cstack/test/skill-size.test.ts` allows at most 1,451 words for the entry skill plus the ticket guide, and they hold 1,344 words today. The new paragraph must therefore stay at 107 words or less, counted like `wc -w`, and should leave a few words of margin. This ticket does not shorten any other sentence of the ticket guide to make room. (2026-11-19, accepted by default)
- In the `document` phase, leave a comment on #31 that gives the number of words left under the size test, and names `cstack/test/skill-size.test.ts`. Ticket #31 adds a step to the same guide and will have to make room. (2026-11-19, accepted by default)
- `cstack/test/guides/brief-rules.test.ts` splits `cstack/guides/resolve-issue/ticket.md` on blank lines and finds the paragraph that contains "brief". It checks key words inside that paragraph, not whole sentences, so that a later ticket can reword it without breaking the test. The key words are `## Decisions`, "from the brief of the run", "secret", "ask the user", "gate" and "settings file". (2026-11-19, accepted by default)
- The same test finds every sentence of the guide that contains "Decisions already taken upstream". It checks that each one names the parent project and does not contain the word "brief". (2026-11-19, accepted by default)
- In the `document` phase, add one paragraph to the existing comment on epic #6 titled "Input for the next epic: a way to hand a brief to a run" (comment id 7015808563). The paragraph says, word for word: "Rules can reach a run after its first message, for example when a coordinator restarts a worker or sends a new rule once the pull request is open. The ticket guide copies only the rules of the first message into `## Decisions`, and a resumed run never goes back to the ticket phase. How should a coordinator hand these later rules to a run, so that its helpers see them?" (2026-11-19, accepted by default)

## Architecture

The change is small: one paragraph in `cstack/guides/resolve-issue/ticket.md` and one new test file, with no real choice of approach. The change touches no endpoint, no database query and no external input, so the security unit does not apply: no security surface, skip.

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

### Unit 1: Write the rules of a run's brief into the plan's Decisions
- Files: `cstack/test/guides/brief-rules.test.ts`, `cstack/guides/resolve-issue/ticket.md`
- Test: `cstack/test/guides/brief-rules.test.ts`: the case that reads `cstack/guides/resolve-issue/ticket.md` fails, because no paragraph of today's guide contains "brief", `## Decisions`, "from the brief of the run", "secret", "ask the user", "gate" and "settings file"
- Minimum code: add one paragraph to `cstack/guides/resolve-issue/ticket.md`, right after the sentence about `### Decisions already taken upstream` (line 40) and before "From now on every phase writes its results into this file."
- Refactor: none
- Commit message: feat(skill): write the rules of a run's brief into the plan's Decisions
- Depends on: none

The test has two cases. The first case splits the guide on blank lines and finds the one paragraph that contains "brief". It expects that paragraph to contain `## Decisions`, "from the brief of the run", "secret", "ask the user", "gate" and "settings file". The second case splits the guide into sentences with the pattern `/(?<=[.!?])\s+/`, as `cstack/test/prompts.test.ts` does. It finds every sentence that contains "Decisions already taken upstream", expects at least one, and expects each one to contain "parent project" and not "brief". On today's guide the first case fails and the second one passes. Find the guide with `new URL("../../guides/resolve-issue/ticket.md", import.meta.url)`, as the other tests under `cstack/test/guides/` do.

A draft of the paragraph, which holds 105 words when counted with `wc -w`:

> The brief is the message that started the skill, when it sets rules for this run. Write each of its rules as one line of `## Decisions`, ending with "(<date>, from the brief of the run)". The executor and the implementers read `## Decisions`, never `## Ticket`. Never copy a secret, such as a token. Say where to find it instead. `### Decisions already taken upstream` keeps only the parent project's decisions. No rule of the brief removes a gate or changes the settings file. When a rule conflicts with a gate, the ticket, the settings file or the conventions file, ask the user first.

You may reword the draft, but keep every rule of it and stay at 105 words or less. Do not shorten any other sentence of the guide. The paragraph must not contain "in English", "git push", "rebase", a test command or the name of a code graph tool, because other tests refuse them in a guide.

`cstack unit green` runs only the test file of this unit. Before the commit, also run `cstack/test/skill-size.test.ts`, `cstack/test/guides/settings-applied.test.ts`, `cstack/test/prompts.test.ts` and `cstack/test/no-graphify.test.ts` by hand, with the `file` test command of the settings, and check that they pass.

## Documentation duties

- Ticket comment on #59: applies, written to issue #59 on GitHub. It says what the guide now asks and where the paragraph sits.
- Comment on #31: applies, written to issue #31 on GitHub. It gives the number of words left under `cstack/test/skill-size.test.ts` after this change, and says that #31 must make room in the ticket guide or the entry skill.
- The existing comment on epic #6 about handing a brief to a run: applies, written to that comment on issue #6 (comment id 7015808563). One paragraph adds the question about rules that reach a run after its first message, word for word as `## Decisions` gives it.
- Architecture decision record: does not apply. The change adds one paragraph of prose and makes no new technical choice.
- Specification page `docs/projects/skills-into-cli.md`: does not apply. The page does not describe the ticket guide, and the change adds no user story.
- `README.md`: does not apply. It does not describe the phases of a run in this detail.
- The guide itself is the documentation of the new behaviour, and Unit 1 writes it.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: secrets in the brief
Should the new paragraph forbid copying a secret of the brief into the plan file? The paragraph copies each rule of the brief into `## Decisions`. The plan file is committed and pushed with the branch, and this repository is public. A brief that holds a token or an internal address would put it into the git history, and only a rewrite of the history could take it out. The recommended answer is to add one sentence of about ten words: "Never copy a secret, such as a token. Write where to find it instead."
- For: the user
- Answer: yes. The new paragraph says never to copy a secret of the brief, such as a token, and to say where to find it instead. (2026-11-19, the user's answer)

## Review log

**Impact notes.** Only `cstack/guides/resolve-issue/ticket.md` (one paragraph) and the new test `cstack/test/guides/brief-rules.test.ts` changed. No symbol changed. The usual companions of the guide are `questions.md` and `plan.md`. Both write into `## Decisions` and do not depend on the wording of the new paragraph. No `WHY:` or `DECISION:` comment is involved. Typecheck passes.

**Correctness.** No finding. The full suite passed (1172 tests).

**Security.** One finding, not fixed. The paragraph forbids copying a secret, but other private text of a brief, such as a client name, would also be pushed with the plan file. A fix needs about 15 more words and the size test leaves 2. The entry skill and the conventions file already carry the public text rule, and the plan records that choice in `## Decisions`. Follow-up: ticket #31 or a later digest can widen the sentence when it makes room.

**Conventions.** No finding. One minor note: the test finds the first paragraph that contains "brief", so an earlier mention in the guide would break it with a misleading message.

**Simplicity.** No finding.

**Fixes.** None, so no fix commit.

**Independent review.** The reviewer changed nothing and found no bug, security problem or broken convention. Full suite and typecheck pass. The new test fails on the guide of `main` and passes on the branch. Judgment calls for the pull request body: (1) the `plan` guide and the plan template do not list rules of the brief among the things `## Decisions` holds, so a later ticket could add them; (2) the `<date>` placeholder sits in plain quotes and GitHub may hide it as an HTML tag, while agents read the raw text; (3) only 2 words are left under the size test, so #31 must make room.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

<phase after-build-questions: the questions raised by the reviews or the briefing that do not stop the pull request, word for word, each with who it is for, or "none". They go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them.>

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**Should the new paragraph forbid copying a secret from the brief into the plan file?** The paragraph copies "each rule" of the brief into `## Decisions`. The plan file is committed and pushed with the branch, and this repository is public. A brief that holds a token or an internal address would land in the git history, and only a history rewrite removes it. I recommend one more sentence of about ten words: "Never copy a secret, such as a token. Write where to find it instead." It uses part of the room left in the guide, but the risk is worth it.

**I will do this unless you say no**

- I write the paragraph as short as the rules allow, and I do not free room elsewhere in the ticket guide. The size test leaves 107 words, and the paragraph will take about 100. I leave a comment on the ticket that wires the Orca features into the guides (#31) with the words left and the name of the test, because it will have to make room.
- The paragraph says "each rule", as the ticket does, and not only the rules that matter during the build. A rule copied for nothing does no harm.
- I add "the ticket" to the list of things a brief rule cannot override without asking you, next to the gates, the settings file and the conventions file. A brief that drops an acceptance criterion should go through you. It costs two words.
- Asking you about such a conflict is not a stop. The work goes on with your answer, as when the ticket id is missing.
- I change neither the plan template nor the entry skill. The template does not list "from the brief of the run" among the sources of a decision line, but no agent breaks on that.
- The new test looks for its key words inside one paragraph, not for exact sentences. So #31 can shorten the wording without breaking it.

**A question for later**

For the design of the next epic, added to the existing comment on the epic (#6):

> Rules can reach a run after its first message, for example when a coordinator restarts a worker or sends a new rule once the pull request is open. The ticket guide copies only the rules of the first message into `## Decisions`, and a resumed run never goes back to the ticket phase. How should a coordinator hand these later rules to a run, so that its helpers see them?

The work of this ticket is correct whatever the answer.

**Good to know**

- This branch is built with the guides of the installed cstack 0.2.0, so the new paragraph acts only after the release that #31 publishes. That is why this ticket must merge before #31 starts.
- Existing tests refuse "in English", any test command and "git push" in a guide, so the paragraph must not contain them.

#### Details

**Secrets in copied rules (blocking, needs the user; it changes the text of the paragraph).** Scope item 1 copies each rule of the brief into `## Decisions`. ADR-SIC-B keeps the plan file in the repository so that it travels with the branch. `git ls-files docs/plans` shows that every earlier plan is committed. The phase `publish` pushes it, and in this repository the push is public. The conventions file of this repository has a public text rule. But `cstack` ships the guide to other teams, whose repositories may have no such rule. Neither the entry skill `cstack/skills/resolve-issue/SKILL.md` nor any guide says that a secret must stay out of the plan file. A search for "secret", "credential" and "public" in the guides and the entry skill finds nothing. So the assumption in `## Decisions` that relies on the entry skill and the conventions file does not cover secrets. A coordinator's brief can name a sandbox token or an internal address, and a pushed secret can only be removed with a history rewrite, which this repository already had to do once on 2026-11-18. The recommended sentence is "Never copy a secret, such as a token or a password. Write where to find it instead." It costs about twelve words of the 107 left. The rejected option is to rely on the conventions file of each repository, which is not always there. By default, if nobody decides, the paragraph has no such sentence and a secret in a brief is copied.

**Room in the ticket guide (non-blocking).** `cstack/test/skill-size.test.ts` counts `cstack/skills/resolve-issue/SKILL.md` (836 words) plus the first guide, `cstack/guides/resolve-issue/ticket.md` (508 words), against a fifth of the frozen `skills/resolve-issue/SKILL.md` and `skills/resolve-issue/writing.md` (6,131 plus 1,128, so 7,259 words). The sum must stay at 1,451 words or less, so 107 words are left today. The paragraph of the scope, with the two additions recommended here, takes about 100. Ticket #31, scope item 1, adds `cstack tracker read` with its fallback on exit code 4 to the same guide, which needs far more. I agree with the draft: keep this ticket's scope, and leave a comment on #31 that gives the words left and names the size test. The rejected option is to shorten other sentences of `ticket.md` now. It would mix an unrelated rewrite into this pull request and guess at what #31 needs. I also rejected moving the paragraph to the `questions` or `plan` guide, which the size test does not count. The scope names `ticket.md`. The ticket phase is also the earliest point, so the rules are on file before the `dependencies` and `code-map` phases start their helpers.

**Which rules to copy (non-blocking, already an assumption not asked).** I keep the draft. Copying each rule follows the ticket, and a rule that only the main conversation uses does no harm in `## Decisions`.

**Conflicts with the ticket (non-blocking, the work is correct either way, but the paragraph is safer with it).** Scope item 3 lists the gates, the settings file and the conventions file. A brief can also contradict the ticket itself, for example "do not touch the README" when the scope asks for a README change. Such a rule changes the acceptance criteria, which only the user can change. Adding "the ticket" to the list costs two words. By default the paragraph lists only the three sources of the scope, and a brief could quietly narrow the ticket.

**The conflict question is not a stop (non-blocking, already an assumption not asked).** I keep the draft. It mirrors line 5 of `ticket.md`, where a missing ticket id is asked without a stop, and the planned stops of the entry skill (lines 59 to 61) stay unchanged.

**The plan template and the entry skill (non-blocking, already an assumption not asked).** I keep the draft, with one caveat recorded here. `cstack/skills/resolve-issue/templates/plan.md` (line 38) lists four sources for a decision line, and "from the brief of the run" is not one. Adding it would cost no room under the size test, because the test does not count the template. I did not push for it, because no command parses the source of a decision line. A search of `cstack/src` for the source words finds nothing. The new paragraph also states the source explicitly. A later digest of retrospectives can add it if an agent stumbles on it.

**How the new test reads the guide (non-blocking).** The acceptance asks the test to find a paragraph that names `## Decisions` and "from the brief of the run". It also checks the upstream line and the question on conflict. A test that matches whole sentences would break on every rewording, and #31 will likely shorten this paragraph to make room. The test should split `ticket.md` on blank lines, find the paragraph that contains "brief", and check its key words there. For the upstream line, it should find the sentence that contains "Decisions already taken upstream" and check that it names the parent project and does not contain "brief".

**Rules that reach a run later (non-blocking, open, not needed for this ticket).** I keep the draft and add one case. `cstack next` resumes a run at its current phase, so a run restarted with a new brief never goes back to the `ticket` phase, and the new rules are not copied. This belongs to the next epic, together with the hand-over channel of scope item 4. The question goes word for word into the existing comment on epic #6, for whoever designs the coordinator of a whole epic: "Rules can reach a run after its first message, for example when a coordinator restarts a worker or sends a new rule once the pull request is open. The ticket guide copies only the rules of the first message into `## Decisions`, and a resumed run never goes back to the ticket phase. How should a coordinator hand these later rules to a run, so that its helpers see them?"

**When the change takes effect.** ADR-SIC-C serves the guides at the version of the installed `cstack`, and the decisions of this run keep it on the installed 0.2.0. The new paragraph therefore reaches runs only with the release of #31, scope item 8. The ticket already asks to merge before #31 starts.

**Other guide tests.** `cstack/test/guides/settings-applied.test.ts` refuses "in English" and every test command in a guide, and the word "rebase" without "integration". `cstack/test/prompts.test.ts` refuses any sentence with "git push". The paragraph speaks of the settings file, so it must name it without quoting one of its values.

Locked decisions cited and not reopened: ADR-SIC-B (the plan file travels with the branch), ADR-SIC-C (guides served at the installed version), ADR-SIC-D (the settings file owns the reviewer), ADR-SIC-E (the frozen `skills/` folder), and scope item 4 (the hand-over channel belongs to the next epic). I checked data model lock-in, scale and performance, user interface edge cases, and operations and cost, and found nothing: the change is one paragraph of prose and one test, and a revert undoes it until the release.

### Open questions and answers

**Secrets in the brief, for the user.** The advisor raised it before the plan. It is Blocking question 1, because its answer changes the wording of the paragraph. The user answered yes on 2026-11-19.

**The room left in the ticket guide, for the user. Non-blocking: the work of this ticket is correct whatever the answer.** `cstack/test/skill-size.test.ts` limits the entry skill plus the ticket guide to 1,451 words, and today they hold 1,344. The new paragraph needs about 90 words, so about 15 words will be left. Ticket #31 later adds the step `cstack tracker read`, with its fallback, to the same guide, and that step needs far more than 15 words. Should this ticket also free room, for example by shortening other sentences of the ticket guide? Recommended answer: no. Keep the scope of this ticket, write the paragraph as short as the rules allow, and leave a comment on #31 that gives the words left and names the size test. Answer: accepted by default on 2026-11-19, after the user saw it in the round.

**Rules that arrive after the first message, for the user. Non-blocking: open, not needed for this ticket.** A coordinator can send new rules later in the run, for example "update the branch with a merge commit once the pull request is open". The new paragraph covers only the message that started the skill. The `plan` guide already writes every answer of the user into `## Decisions`, but it says nothing about a later message from a coordinator. Recommended answer: leave it out of this ticket, because the next epic decides how a coordinator hands rules to a run (the fourth item of the scope). Answer: open, not needed for this ticket. The question goes word for word into the existing comment on epic #6, accepted by default on 2026-11-19.

**Which rules of the brief to copy.** The ticket says "each rule". The brief of this run asks for each rule that the executor or an implementer needs. The default follows the ticket, and it is written in `## Decisions` as an assumption not asked.

**The plan template and the entry skill.** The template lists four sources for a decision line, and "from the brief of the run" is not one of them. The scope of the ticket names only the ticket guide and one test, so the default changes neither file. It is written in `## Decisions` as an assumption not asked.

**Whether the question about a conflict is a stop.** The default treats it like the question about a missing ticket id, which is not a stop. It is written in `## Decisions` as an assumption not asked.

### Architecture options

No real choice of approach remained after the question round, so no blueprint was drawn. No new decision since the question round.
