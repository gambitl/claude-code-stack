# Plan: #45 — M2-12: Remove Graphify from cstack and the skills it ships

Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/45
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in `docs/projects/`), ADRs in `docs/decisions/`
Branch: gambitl/remove-graphify
Conversation language: French
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** The new version of the project no longer uses Graphify. Agents map the code themselves with search and file reads, and nothing that `cstack` builds or ships mentions Graphify any more.

- **What the title means**: Graphify is a tool that builds a map of the code, called the code graph. Today the skills that `cstack` ships tell Claude to read this map before it opens files, and `cstack doctor` checks whether Graphify is installed. Removing Graphify means taking out each of these mentions. It also means removing `cstack graph ensure` from the command list. Ticket #19 was going to build that command.
- **Why we are doing it**: On 2026-11-19, the maintainer decided to drop Graphify from the new version of the project. Nothing replaces it. Ticket #19 is closed as not planned. As long as the guides and the prompts name Graphify, an agent tries to run commands that the new version does not support. The command list also keeps a command that nobody will build.
- **For the user**: A solution engineer installs and runs `cstack` without Graphify, and no step of a run asks for it.

**Goal.** This ticket removes Graphify and `cstack graph ensure` from the code of `cstack`, its guides, the skill it ships and the specification page. After it, agents map the code with search and file reads only. The frozen prose skills in `skills/` keep their text.

## Where things are today (read first)

* **The command list**: `cstack/src/manifest.ts` (lines 174 to 181) holds the entry of `cstack graph ensure`, which is not built. `cstack/test/manifest.test.ts` (line 116) counts the built entries and the entries that are not built. Every ticket of milestone 2 changes these two files, so expect conflicts when you update the branch onto `main`.
* **cstack doctor**: `cstack/src/doctor/requirements.ts` checks Graphify as an optional item. The install text is on lines 24 and 25, and the item is on lines 155 to 162. `cstack/test/doctor.test.ts` tests it on lines 25, 48, 100, 109 to 113 and 158 to 161, with the fixture `cstack/test/fixtures/doctor/graphify.txt`. `README.md` (line 14) lists Graphify under "Requirements".
* **The guides**: `cstack/guides/resolve-issue/code-map.md` (lines 5 to 23) starts with `cstack graph ensure` and makes Graphify the first source, with `graphify query`, `graphify explain` and `graphify affected`. Its path for a machine without Graphify is already search and file reads. `cstack/guides/resolve-issue/review.md` (lines 7 and 8) runs `cstack graph ensure` and `graphify affected`.
* **The agent prompts**: in `cstack/skills/resolve-issue/agents/`, these files name Graphify commands: `code-explorer.md` (lines 9 and 19), `code-architect.md` (line 16), `code-reviewer-simplicity.md` (lines 25 and 32), `implementer.md` (lines 23 and 28) and `pr-reviewer.md` (line 21).
* **The settled decision**: `cstack/skills/resolve-issue/settled-decisions.md` (line 30) holds "Graphify first in code mapping", settled on 2026-10-05.
* **The specification**: `docs/projects/skills-into-cli.md` holds US-11 "Keep the code graph fresh" (lines 149 to 154). Graphify also appears in the first criterion of the `cstack doctor` story (line 81) and in the list of tools (line 291). Lines 98, 310 and 329 describe past choices and the baseline runs.
* **The frozen skills**: `skills/` holds the prose skills, frozen at the tag `prose-skills-final` (ADR-SIC-E). They name Graphify, and they stay as they are.
* **Other tickets**: #23, #28 and #32 were updated on 2026-11-19. They no longer ask for Graphify or for `cstack graph ensure`, so you have nothing to change there.

## Scope

1. Remove the entry of `cstack graph ensure` from `cstack/src/manifest.ts`. Update the counts of built and not-built entries in `cstack/test/manifest.test.ts`.
2. Remove the Graphify item from `cstack doctor`, with its install text, its tests and its fixture. Remove the Graphify line from the "Requirements" section of `README.md`.
3. Rewrite the start of `cstack/guides/resolve-issue/code-map.md` so that the agent maps the code with search and file reads, from the cheapest step to the most expensive. Keep the steps that never needed Graphify: the governing decisions, the `git log` history of each file to modify, and reading only the lines that answer the question.
4. In `cstack/guides/resolve-issue/review.md`, replace `cstack graph ensure` and `graphify affected` with a search of the code for the callers and the tests of each changed or deleted symbol.
5. In the five agent prompts listed above, replace each Graphify command with a search of the code, and remove the mentions of node IDs.
6. In `settled-decisions.md`, replace the line "Graphify first in code mapping" with a line that records the new choice. Agents map the code themselves with search and file reads, and no code graph tool is used (settled 2026-11-19, replacing the Graphify-first decision of 2026-10-05).
7. In `docs/projects/skills-into-cli.md`, mark US-11 as dropped on 2026-11-19, with one sentence that says why. Remove Graphify from the `cstack doctor` criterion and from the list of tools. Leave the lines that describe the past.
8. Never edit anything under `skills/`.

## Acceptance (TDD)

* `cstack/test/manifest.test.ts`: write first the case that no entry of the command list has the command words `graph ensure`. The counts of built and not-built entries match the new list.
* `cstack/test/doctor.test.ts`: `cstack doctor` never runs `graphify`, and its output never contains the word "Graphify".
* A new test checks that no file under `cstack/guides/` or `cstack/skills/` contains the word `graphify`, ignoring case. The only exception is `cstack/skills/resolve-issue/settled-decisions.md`, which names the decision that it replaces.
* The mention scan of `cstack/test/manifest.test.ts` still passes on the real skills and guides. So no guide and no prompt names `cstack graph ensure` any more.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* `git diff origin/main --stat -- skills/` prints nothing.

**Size: M** · Blocked by: none · Feeds: #23

### Decisions already taken upstream

Parent epic: [Epic: Skills into CLI (#6)](https://github.com/gambitl/claude-code-stack/issues/6). Specification: `docs/projects/skills-into-cli.md`.

The epic's block "Open questions and decisions", copied verbatim:

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

The ADRs that exist today in `docs/decisions/` and that bear on this ticket:

- [ADR-SIC-C, how cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md). The skills that `cstack` ships live in `cstack/skills/`, and the guides in `cstack/guides/`.
- [ADR-SIC-E, the new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final` and are never edited.
- [ADR-SIC-H, how a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md). A command prints through `io` and returns its exit code; no code calls `process.exit()`.

The instructions of the coordinator of this wave, given on 2026-11-19:

- Four other tickets run at the same time, each in its own worktree: #15 (`cstack next`), #17 (`cstack unit red` and `cstack unit green`), #20 (`cstack publish`) and #24 (the Orca adapter and the tracker interface). All of them touch `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/src/cli.ts`. Any of them may touch `README.md` and `docs/projects/skills-into-cli.md`. Keep the changes to those shared files small and in their own place.
- When another ticket of the wave merged first, take `origin/main` into the branch with a merge commit and keep both changes. Then update the counts of built and not-built commands in `manifest.test.ts` and in `README.md`, and run the whole test suite again. Check `cli.ts` for a function that git kept twice without a conflict marker, as happened in wave 4.
- When the branch is updated onto `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. Never push a tag that starts with `v`.
- At the start of the build, run `git cherry-pick 1131c63`. It adds `docs/retros/2026-11-19-19.md`, the retrospective of #19. Do not change that file. One sentence of the pull request description says that it carries the retrospective of #19.
- Ticket #24 also changes `cstack doctor` and the "Requirements" section of `README.md`. Limit this ticket's changes there to the Graphify item and its line. If #24 merges first, keep both changes.
- Ticket #15 changed the case of `cstack/test/cli.test.ts` that needs an unbuilt command. It now takes the first unbuilt command of the list instead of `next`. Removing the entry of `cstack graph ensure` must keep that case working.
- Ticket #24 may change the rule for unbuilt commands, so that each one exits with `1` and names its ticket instead of exiting with `2`. If it merges first, take its rule.
- Never install Graphify and never run it. This ticket only removes text and code that call it.
- Never merge the pull request. The user merges it.
- Never run `cstack skills install` against the real home folder, and never change anything under `~/.claude/skills/`. Tests use a temporary home folder. Never read, run or change anything under `~/comparison/`.
- Follow the public text rule of the conventions file in files, commits, the pull request, ticket comments, the plan file and the retrospective. Never change the git `user.email`, and never commit with another address.
- Before the push, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`. It must exit 0. Never print the private list.
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run.

## Dependencies

Clear. The ticket's footer says "Blocked by: none", and GitHub lists no blocking relation for #45. Ticket #19 is closed as not planned, and this ticket replaces its work.

## Code mapping

Graphify was not used: this ticket removes it, the coordinator brief forbids running it, the repository has no `graphify-out/` folder, and `graphify` is not on the PATH (checked with `command -v`, without running it). The mapping used text search and file reads.

**The command list.** `cstack/src/manifest.ts` lines 174 to 182 hold the entry of `cstack graph ensure`: ticket 19, `built: false`, file `graph-ensure.ts`, exit code `4` "Graphify is missing" and `5` "The update failed". The file `cstack/src/commands/graph-ensure.ts` does not exist. `cstack/test/manifest.test.ts` lines 114 to 117 expect ten built entries and five not built. After the removal, the list holds ten built and four not built: `next` (#15), `unit red` and `unit green` (#17), and `publish` (#20). `cstack/test/cli.test.ts` lines 103 to 108 run `next` as the unbuilt command on `main`; ticket #15 changes that case to the first unbuilt entry of the list. Both keep working after the removal. The "Commands" section of `README.md` (line 40) counts only built commands ("ten commands"), so this ticket does not change that number.

**The mention scan constrains the order of the work.** The case "passes on the real skills and guides" of `cstack/test/manifest.test.ts` (around line 66) fails for every `cstack <words>` mention in `cstack/skills/` and `cstack/guides/` that matches no entry. Today `code-map.md` line 5, `review.md` line 7 and `pr-reviewer.md` line 21 name `cstack graph ensure`. So the entry can leave the list only in the same commit as, or after, the commits that remove those mentions.

**cstack doctor.** `cstack/src/doctor/requirements.ts` lines 24 and 25 define `GRAPHIFY_HINT`, and lines 155 to 162 add the Graphify item with `simple(...)`. After the removal, `simple()` is used by macOS and Claude Code, which are both required. Orca stays the only optional item, with its own check in `cstack/src/doctor/orca.ts`. `cstack/src/commands/doctor.ts` does not name Graphify. `cstack/test/doctor.test.ts` names Graphify on line 25 (the answers table), line 48 (the `ALLOWED` set of commands doctor may run), line 100 (the expected output of the first case), lines 109 to 114 (the case "prints how to install Graphify when it is missing") and lines 157 to 162 (the case "reports an answer without a version as present", which uses `graphify --version`). The fixture is `cstack/test/fixtures/doctor/graphify.txt`. The optional-and-missing path stays tested by the Orca case "says that Orca is not installed and returns 0".

**README and doctor must change together.** `cstack/test/readme-requirements.test.ts` checks that the bold names under "## Requirements" in `README.md` equal the names of `requirements`, in order. So the README line 14 and the doctor item leave in the same commit.

**The guides.** `cstack/guides/resolve-issue/code-map.md` lines 5 to 23 start with `cstack graph ensure` and make Graphify the main source (steps 1 to 5 use `GRAPH_REPORT.md`, `graphify query`, `graphify explain`, `graphify affected`, node IDs, and "the graph" in steps 3 and 5). Step 6 (wider exploration with `resolve-issue:code-explorer`), the `git log` commands of step 3 and the governing decisions of step 4 never needed Graphify. `cstack/guides/resolve-issue/review.md` lines 7 and 8 run `cstack graph ensure` and `graphify affected`. No test reads the Graphify text of these guides. The skill-size test counts only `SKILL.md` and the first guide, which is not `code-map.md`.

**The agent prompts** in `cstack/skills/resolve-issue/agents/`: `code-explorer.md` lines 9 and 19 (Graphify commands, node IDs); `code-architect.md` line 16 (`graphify query`); `code-reviewer-simplicity.md` lines 25 and 32 (`graphify query`, `graphify affected`); `implementer.md` line 23 (`graphify affected` and `graphify explain`), line 24 (the sentence "The graph does not follow edits made during the session, …") and line 28 (`graphify query`); `pr-reviewer.md` line 21 (`cstack graph ensure`, `graphify affected`). `cstack/test/prompts.test.ts` checks that `implementer.md` names `cstack unit red`, `cstack unit green` and `cstack unit commit` in that order, and has a sentence with "No test" and "cstack unit commit"; the edit must keep those. The other prompts and `SKILL.md` do not name Graphify.

**The settled decision.** `cstack/skills/resolve-issue/settled-decisions.md` line 30 holds "Graphify first in code mapping, in the `code-map` phase (settled 2026-10-05, replacing repowise). It protects the context budget, …". Each line of that list says what the decision protects.

**The specification.** `docs/projects/skills-into-cli.md`: line 81 (US-3 AC1 names Graphify and explains it), lines 149 to 154 (US-11 "Keep the code graph fresh"), line 291 (the Graphify bullet under "External tools"). Lines 98, 310 and 329 describe the baseline and past choices and stay. Section 10 "Challenged choices" (from line 327) lists other dropped ideas, each in one bullet.

**Mentions that stay.** The frozen skills under `skills/`. Past plans under `docs/plans/` and past retrospectives under `docs/retros/`, which describe the past. `config/settings.json` line 137, which is a copy of the personal configuration and not part of `cstack`.

**History of the files.** `requirements.ts` and `doctor.test.ts` last changed for the Orca line (d446703). `code-map.md` was written once (167efbe). `manifest.ts` and `manifest.test.ts` change with every ticket of milestone 2 (fc0c4cd, e2a2ac0, 0b7b7d5, 6c4238b, 68c1d92), so expect conflicts there when `main` moves.

**Risks.** Four tickets of this wave run at the same time (#15, #17, #20, #24) and all touch `manifest.ts`, `manifest.test.ts` and `cli.ts`; any may touch `README.md` and the specification. #24 also changes `cstack doctor` and the README "Requirements" section, and may change the rule for unbuilt commands. In wave 4 a merge silently kept two definitions of the same function in `cli.ts`.

**Governing decisions.** ADR-SIC-E (never edit `skills/`). The settled decision "Tool-agnostic wording" in `settled-decisions.md`, which asks guides and prompts to name roles and not specific tools. No `WHY:` or `DECISION:` comment exists in the files to change.

**Carried commit.** The local branch `gambitl/graph-ensure` holds commit `1131c63`, which adds `docs/retros/2026-11-19-19.md`, the retrospective of #19. It was never pushed.

## Decisions

The reason, the wording and the scope:

- Graphify is dropped because nothing has shown that a code graph tool finds code better than an agent that searches and reads files on its own, or that it saves tokens. Use this reason, and no other, wherever the ticket asks for one. (2026-11-19, the user's answer)
- In `cstack/skills/resolve-issue/settled-decisions.md`, replace the line "Graphify first in code mapping, …" in place, at the same position in the list, with exactly this line: "- Agents map the code themselves with search and file reads, and no code graph tool is used (settled 2026-11-19, replacing the Graphify-first decision of 2026-10-05). Nothing has shown that a code graph tool finds code better than an agent that searches and reads files on its own, or that it saves tokens. It protects the runs and the install from a tool whose benefit was never proven." (2026-11-19, the ticket's wording with the user's reason)
- In `docs/projects/skills-into-cli.md`, add " (dropped on 2026-11-19)" to the end of the heading of US-11. Right under the heading, add this one sentence: "This story was dropped on 2026-11-19, because nothing has shown that a code graph tool such as Graphify finds code better than an agent that searches and reads files on its own, or that it saves tokens." Keep the rest of US-11 as it is, because it records what was planned. (2026-11-19, the user's answer)
- In the same page, remove "Graphify, " and the sentence "Graphify is the code graph tool that `resolve-issue` reads to map the code." from US-3 AC1, and remove the Graphify bullet from "External tools". Keep lines 310 and 329, which describe past choices. (2026-11-19, the ticket)
- In the same page, keep US-5 AC1 (line 98) as it is, and add this sentence at the end of that same bullet: "In fact, the baseline runs of #12 used no Graphify graph, because the original work on that ticket had none." (2026-11-19, accepted by the user; the closing comment of #12 says the runs used no graph)
- Write no ADR for dropping Graphify, and add no bullet for it in section 10 "Challenged choices" of the specification. The new line of `settled-decisions.md` and the note on US-11 record the decision. (2026-11-19, accepted by the user)
- Guides and prompts say "search the code" or "search the whole repository" and never name a specific search tool or command, as the settled decision "Tool-agnostic wording" asks. The `git log` commands that they already name stay. (2026-11-19, accepted by the user)
- Where a guide or a prompt used `graphify affected` to find what depends on a symbol, the replacement tells the agent to search the whole repository for the symbol's name, including its callers, its tests, fixtures, and mentions inside strings and Markdown files. Reuse the wording of `code-reviewer-simplicity.md`, which already says "search the whole repository for the symbol, including tests, fixtures and references inside strings". (2026-11-19, accepted by the user)
- Remove every mention of node IDs, of "the graph" as a source, of `graphify-out/` and of `GRAPH_REPORT.md` from `cstack/guides/` and `cstack/skills/`. After the edits, search those two folders for `graph` and `node ID`, ignoring case, and fix every hit that is not ordinary English. (2026-11-19, accepted by the user)
- Past plans in `docs/plans/`, past retrospectives in `docs/retros/` and `config/settings.json` keep their mentions of Graphify. They describe the past or copy the personal configuration, and they are not part of `cstack`. (2026-11-19, assumption not asked)

The tests:

- The new test that looks for the word "graphify" lives in its own new file, `cstack/test/no-graphify.test.ts`. It reads every file under `cstack/guides/` and `cstack/skills/`, looks for "graphify" ignoring case, and fails with the file and line of each hit. Its only exception is the one line of `cstack/skills/resolve-issue/settled-decisions.md` that starts with "- Agents map the code themselves". Any other line of that file that names Graphify is a failure. (2026-11-19, accepted by the user)
- In `cstack/test/doctor.test.ts`, add a case that runs `cstack doctor` with the answers where every item is present, and checks that no command it ran starts with `graphify` and that its standard output and standard error never match `/graphify/i`. (2026-11-19, the ticket)
- In `cstack/test/doctor.test.ts`, rewrite the case "reports an answer without a version as present" with `claude --version` answering `hello`, and expect "Claude Code: present, version unknown". Do not delete it, so that the fallback of `parse()` stays tested. (2026-11-19, accepted by the user)
- Delete the case "prints how to install Graphify when it is missing and still returns 0". The Orca case "says that Orca is not installed and returns 0" already tests a missing optional item. Remove `graphify --version` from the answers table and from the `ALLOWED` set, remove the Graphify line from the expected output of the first case, and delete the fixture `cstack/test/fixtures/doctor/graphify.txt`. (2026-11-19, assumption not asked)
- Keep the `required` parameter of `simple()` in `cstack/src/doctor/requirements.ts`, even though every caller now passes `true`. Removing it would widen the diff in a file that #24 also changes. (2026-11-19, accepted by the user)
- In `cstack/test/manifest.test.ts`, add the case "has no entry with the command words graph ensure" right after the counts case, and change the counts case to ten built and four not built, with its title to match. Change nothing else in that file. (2026-11-19, the ticket and the coordinator brief)

How the build runs:

- Never install `graphify`, never run it, and never run `cstack graph ensure`, even where a prompt or a guide of the skill says to. Graphify is not installed on this machine. Find code and what depends on it with a text search over the whole repository and with file reads. (2026-11-19, the coordinator brief)
- Never edit anything under the top-level `skills/` folder. `git diff origin/main --stat -- skills/` must print nothing. (2026-11-19, the ticket and ADR-SIC-E)
- The branch `gambitl/remove-graphify` already exists and is checked out in this worktree. Work on it, and create no other branch. (2026-11-19, assumption not asked)
- Right after the plan file's first commit, and before the first unit, run `git cherry-pick 1131c63`. It adds `docs/retros/2026-11-19-19.md`, the retrospective of #19. Use a plain cherry-pick, which keeps the author date, and never change that file. (2026-11-19, the coordinator brief)
- Run the units one at a time, even the independent ones. They share one worktree and commit with plain git, so two units staging files at once could mix their commits. (2026-11-19, assumption not asked)
- The commit format is Conventional Commits with the scopes `cli`, `skill` and `tests` of the conventions file. Commits that only touch documentation use `docs:` without a scope, as the history of this repository does. (2026-11-19, the conventions file and the git history)
- When `origin/main` has moved, take it into the branch with a merge commit and keep both sides. Never rebase the branch. Then update the counts of built and not-built commands in `cstack/test/manifest.test.ts` and in `README.md`, run the whole test suite again, and search `cstack/src/cli.ts` for a function defined twice. (2026-11-19, the coordinator brief)
- Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. Never push a tag that starts with `v`. (2026-11-19, the coordinator brief)
- If ticket #24 has merged first and changed `cstack doctor` or the "Requirements" section of `README.md`, keep its changes and remove only the Graphify item and its line. If it changed the rule for unbuilt commands so that they exit with `1` and name their ticket, take its rule. (2026-11-19, the coordinator brief)
- The case of `cstack/test/cli.test.ts` that needs an unbuilt command must keep working. On `main` it runs `next`; after #15 merges, it takes the first unbuilt entry of the list. Both still exist after the removal. (2026-11-19, the coordinator brief)
- Never run `cstack skills install` against the real home folder, and never change anything under `~/.claude/skills/`. Tests use a temporary home folder. Never read, run or change anything under `~/comparison/`. (2026-11-19, the coordinator brief)
- Follow the public text rule of the conventions file in files, commits, the pull request, ticket comments, this plan file and the retrospective. Never change the git `user.email`. (2026-11-19, the conventions file and the coordinator brief)
- Before the push, run the two checks below and push only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`, which must exit 0. Never print the private list. (2026-11-19, the coordinator brief)
- The pull request description has one sentence that says it carries the retrospective of #19. It ends with `Fixes #45`. Never merge the pull request; the user merges it. (2026-11-19, the coordinator brief)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, the coordinator brief)
- GitHub issues in this repository have no "in progress" or "in review" state. Skip those tracker moves and say so in the Hand-off log. (2026-11-19, assumption not asked)

## Architecture

The change is small and the approach is locked by the ticket. It removes text and one unbuilt entry; it adds two test cases and one test file. One order matters. The mention scan of `cstack/test/manifest.test.ts` fails for any `cstack graph ensure` left in a guide or a prompt once the entry is gone, so unit 3 removes the entry only after unit 1 has removed those mentions. Units 2 and 4 are independent of the others.

## Implementation units

### Unit 1: Map the code with search and file reads in the guides and the prompts — status: todo
- Files: `cstack/test/no-graphify.test.ts` (new), `cstack/guides/resolve-issue/code-map.md`, `cstack/guides/resolve-issue/review.md`, `cstack/skills/resolve-issue/agents/code-explorer.md`, `cstack/skills/resolve-issue/agents/code-architect.md`, `cstack/skills/resolve-issue/agents/code-reviewer-simplicity.md`, `cstack/skills/resolve-issue/agents/implementer.md`, `cstack/skills/resolve-issue/agents/pr-reviewer.md`, `cstack/skills/resolve-issue/settled-decisions.md`.
- Failing test: write `cstack/test/no-graphify.test.ts` as the Decisions describe it. Run it: it fails and lists the current hits, in `code-map.md`, `review.md`, the five prompts and line 30 of `settled-decisions.md`.
- Minimum code:
  - `code-map.md`: replace the three paragraphs from line 5 to line 9 with one short paragraph that says to map the code with search and file reads, and that no code graph tool is used. Keep "Work from the cheapest call to the most expensive." Rewrite steps 1 to 5 without Graphify. Step 1, orientation, only if the area is unfamiliar: list the files of the area by name and read its README once. Step 2, questions: search the code for the names and words that the ticket's question uses, and open only the lines that the matches point to; a "why is Z like this" question still goes to step 4. Step 3, the symbols to change: search the whole repository for each name, as the Decisions describe it, then keep the two `git log` commands and the risk sentence; drop "The graph holds no history." Step 4: keep it, and replace the sentence about `graphify explain` with "A text search for `WHY:`, `DECISION:` and the names of the ADRs finds them." Step 5: "Read the lines that the search pointed to, with an offset and a limit." Keep step 6 as it is. In the closing line, say "come back to these steps" instead of "these tools".
  - `review.md`: replace steps 1 and 2 of "Impact notes" with one step that searches the whole repository for every symbol the branch changed or deleted, as the Decisions describe it. Keep its two sentences about what breaks and which tests exercise the change. Renumber the steps that follow.
  - `code-explorer.md` line 9: replace the Graphify commands with a search of the code, as the Decisions describe it; keep the sentence about `WHY:` and `DECISION:` comments; end with "Read a file directly only for the lines the search pointed to, and never a whole file when a few symbols would do." Line 19: end after "with their source lines, so the caller can read exactly those", without node IDs.
  - `code-architect.md` line 16: "look for it with a search of the code, and reuse what is there."
  - `code-reviewer-simplicity.md` line 25: "Find it with a search of the code, and name its file and line." Line 32: remove the clause about `graphify affected`.
  - `implementer.md` line 23: replace step 2 with one sentence that searches the whole repository for every symbol the unit will change, as the Decisions describe it, and one sentence that opens only the lines needed. Line 24: remove the last sentence, "The graph does not follow edits made during the session, …". Line 28: "Does the codebase already have it? Search the code. Reuse an existing helper, type or pattern." Keep `cstack unit red`, `cstack unit green` and `cstack unit commit` in that order, and keep the sentence that names "No test" and `cstack unit commit`, because `cstack/test/prompts.test.ts` checks them.
  - `pr-reviewer.md` line 21: replace the Graphify sentence with the search described in the Decisions, and run the tests that the search found in addition to the full suite. Keep the `git log --full-diff` sentence.
  - `settled-decisions.md` line 30: replace the line in place with the exact line given in the Decisions.
  - Then search `cstack/guides/` and `cstack/skills/` for `graph` and `node ID`, ignoring case, and fix every hit that is not ordinary English.
- Refactor: none.
- Commit message: `feat(skill): map the code with search and file reads instead of Graphify`
- Depends on: none.

### Unit 2: Remove the Graphify item from cstack doctor and from the README — status: todo
- Files: `cstack/test/doctor.test.ts`, `cstack/src/doctor/requirements.ts`, `cstack/test/fixtures/doctor/graphify.txt` (deleted), `README.md`.
- Failing test: add the case of `cstack/test/doctor.test.ts` that the Decisions describe ("never runs graphify and never prints Graphify"). Run it: it fails because doctor runs `graphify --version` and prints "Graphify (optional)".
- Minimum code: in `requirements.ts`, remove `GRAPHIFY_HINT` (lines 24 and 25) and the Graphify item of `requirements` (lines 155 to 162). Keep the `required` parameter of `simple()`. In `README.md`, remove the Graphify line of "Requirements" (line 14) and nothing else. In `doctor.test.ts`, make the changes the Decisions list: the answers table, the `ALLOWED` set, the expected lines of the first case, the deleted "missing Graphify" case, and the "answer without a version" case rewritten with Claude Code. Delete the fixture `graphify.txt`. Run `cstack/test/doctor.test.ts` and `cstack/test/readme-requirements.test.ts`.
- Refactor: none.
- Commit message: `feat(cli): stop checking Graphify in cstack doctor`
- Depends on: none.

### Unit 3: Remove cstack graph ensure from the command list — status: todo
- Files: `cstack/test/manifest.test.ts`, `cstack/src/manifest.ts`.
- Failing test: in `manifest.test.ts`, add the case "has no entry with the command words graph ensure", checking that no entry of `COMMANDS` has `commandWords` equal to `graph`, `ensure`. Change the counts case to ten built and four not built, with the title "holds ten built commands and four that are not built". Run it: both cases fail.
- Minimum code: delete the entry of `cstack graph ensure` (lines 174 to 182 of `manifest.ts`), and nothing else. Then run the whole file `manifest.test.ts`, whose mention scan must still pass, and `cstack/test/cli.test.ts`.
- Refactor: none.
- Commit message: `feat(cli): remove cstack graph ensure from the command list`
- Depends on: Unit 1, because the mention scan fails while a guide or a prompt still names `cstack graph ensure`.

### Unit 4: Update the specification page — status: todo
- Files: `docs/projects/skills-into-cli.md`.
- No test: the page is prose under `docs/`, the ticket asks no test for it, and the word scan of unit 1 covers only `cstack/`.
- Minimum code: make the four edits that the Decisions give for this page: the heading and the sentence of US-11, US-3 AC1 without Graphify, the Graphify bullet removed from "External tools", and the sentence added at the end of US-5 AC1. Change nothing else.
- Refactor: none.
- Commit message: `docs: mark US-11 as dropped and remove Graphify from the specification`
- Depends on: none.

After the four units, run `npm test` and `npm run typecheck` in `cstack/`, and check that `git diff origin/main --stat -- skills/` prints nothing.

## Documentation duties

- Comment on the ticket: applies, written to #45 on GitHub.
- Comment on the dependent ticket: applies, written to #23 on GitHub. It says that the shipped guides, prompts and settled decisions no longer name Graphify, that `cstack doctor` has no Graphify item, and that `cstack graph ensure` is gone from the command list.
- Architecture decision record: does not apply. The user chose no ADR; the new line of `cstack/skills/resolve-issue/settled-decisions.md` records the decision (unit 1).
- Specification page: applies, written to `docs/projects/skills-into-cli.md` (unit 4).
- README: applies, the Graphify line of "Requirements" leaves `README.md` (unit 2). The "Commands" section counts only built commands, so its number does not change unless a merge of `main` brings new ones.
- `WHY:` comments in the code: do not apply, because the change adds no code that a decision governs.

## Review log

## Briefing

## Open questions after the build

### Blocking

none

### Non-blocking

none

## Pull request

## Documentation

## Executor notes

## Hand-off log

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

<!-- The user answered on 2026-11-19 with the reason for dropping Graphify and accepted every item under "I will do this unless you say no". -->

The ticket is ready to plan. I need one answer from you.

**I need your answer before I plan**

**Why are we dropping Graphify?** The ticket asks for one sentence that says why, in US-11 of the specification. The new line of `settled-decisions.md` must also say what the decision protects. Neither the ticket, nor the closing comment of the ticket that was going to build `cstack graph ensure` (#19), nor its retrospective gives the reason. Whatever we write there becomes the official reason. I suggest: "Graphify is one more tool to install and keep fresh, and the new version must run on a machine that has only the required items." This is my guess, so replace it if the real reason is different.

**I will do this unless you say no**

- I put the new test that looks for the word "graphify" in its own file, `cstack/test/no-graphify.test.ts`. That keeps it away from `manifest.test.ts`, which the four other tickets of the wave change.
- The exception of that test for `settled-decisions.md` covers only the line of the new decision, not the whole file.
- The test only sees the word "graphify". After the edits, I also search for "graph" and "node ID" by hand. A sentence like "The graph does not follow edits" in `implementer.md` would slip past the test.
- Where the guides said `graphify affected`, the text search must also cover tests, fixtures, strings and Markdown files. That is what the Graphify command found and what a plain search for the name misses.
- In `doctor.test.ts`, the case "an answer without a version counts as present" uses Graphify. I rewrite it with Claude Code instead of deleting it, so that this path of the code stays tested.
- US-5 AC1 of the specification says the baseline repository has a Graphify graph, which is wrong. I keep the line, as the ticket asks, and add one sentence saying the baseline runs had no graph.
- No ADR for this choice and no bullet in section 10 of the specification. The guides say "search the code" without naming a tool, as the "Tool-agnostic wording" decision asks.

**I checked it myself**

- Dropping Graphify does not skew the token comparison. The closing comment of the baseline runs (#12) says they ran without a graph, and the new runs (#32) do the same.
- No test or CI job compares `cstack/skills/` with the frozen `skills/` folder, so changing one without the other breaks nothing.

#### Details

**The reason for dropping Graphify.** This question is blocking. The answer is text that this ticket writes into US-11 of `docs/projects/skills-into-cli.md` and into the new line of `cstack/skills/resolve-issue/settled-decisions.md`. Scope item 7 of the ticket asks for that sentence explicitly. The run cannot answer it with a test, so the user has to. I read the closing comment of #19, which says only that the maintainer dropped Graphify and that nothing replaces it. I also read the commit message of `1131c63` and the retrospective `docs/retros/2026-11-19-19.md` that it adds. They say the decision arrived at the question round, and they give no reason. The drafted recommendation is kept but presented as a guess. Each line of the settled list says what the decision protects, so the new line would say that it protects the runs from a missing or stale tool and keeps the install short. If nobody answers, the plan cannot write the sentence without inventing a reason that would then read as the maintainer's.

**Where the new scan test lives.** This question is non-blocking. I keep the drafted recommendation: a new file `cstack/test/no-graphify.test.ts`. Every ticket of the wave (#15, #17, #20, #24) changes `cstack/test/manifest.test.ts`, so a new file avoids one more merge conflict there.

**How wide the exception is.** This question is non-blocking. The acceptance criterion exempts the whole of `settled-decisions.md`. A whole-file exception would let an old mention survive in that file, for example in the models table on line 19 or in a future line. The test should allow the word only on the one line that records the new decision, for example by matching the line that starts with "Agents map the code themselves". This stays within the acceptance criterion, which names the exception but not its width.

**What the word scan cannot see.** This question is non-blocking. The scan looks for "graphify", ignoring case. It does not catch "the graph", "code graph" or "node ID". Today `implementer.md` line 24 says "The graph does not follow edits made during the session", and `code-map.md` steps 3 and 5 say "the graph". The build should run a manual search for `\bgraph\b` and `node ID` over `cstack/guides/` and `cstack/skills/` after the edits and before the review. Turning that into a test was rejected, because "graph" is an ordinary word and the test would be fragile.

**What replaces `graphify affected`.** This question is non-blocking. In `review.md` step 2, `pr-reviewer.md` line 21, `implementer.md` line 23 and `code-reviewer-simplicity.md` line 32, the Graphify command listed every dependent of a symbol, tests included. A plain search for the symbol name misses re-exports, mentions inside strings and fixtures, and mentions in Markdown. This repository depends on such mentions: the mention scan of `manifest.test.ts` reads `cstack <words>` inside the Markdown of the skills and guides. `code-reviewer-simplicity.md` line 32 already words it well ("search the whole repository for the symbol, including tests, fixtures and references inside strings"), and the other replacements should reuse that wording. Without this, the review loses the part of the impact check that Graphify did best.

**The doctor case "reports an answer without a version as present".** This question is non-blocking. `cstack/test/doctor.test.ts` lines 157 to 162 test the fallback of `parse()` in `cstack/src/doctor/requirements.ts` with `graphify --version`. Deleting the case with the Graphify item would leave that fallback untested. Rewriting it with `claude --version` answering `hello` keeps the coverage. The case "prints how to install Graphify when it is missing" can go, because the Orca case already covers a missing optional item. The `required` parameter of `simple()` becomes `true` for every caller after the removal. Keep the parameter anyway: removing it widens the diff in a file that #24 also changes, and the simplicity reviewer may flag it, so the plan should say why it stays.

**US-5 AC1 of the specification.** This question is non-blocking. Line 98 says "Its repository has a Graphify graph". The closing comment of #12 says the opposite: "The runs used no Graphify graph, because the original work on that ticket had none, and the runs of #32 will do the same." The ticket asks to leave line 98, because it describes the past. Adding one sentence after it that records what happened keeps the past intact and stops a reader from thinking the baseline had a graph. The `no-graphify` scan does not cover `docs/`, so nothing else would catch this. Line 310 (open question 4) is a recommendation from before the runs and stays.

**No ADR, no bullet in section 10, no named search tool.** These three questions are non-blocking, and I keep the drafted recommendations. The maintainer took the decision, the ticket asks for none of these, and the new settled line with the note on US-11 records it where the next run looks. The settled decision "Tool-agnostic wording" asks the guides to name roles, not tools, so they say "search the code for the name of the symbol". The `git log` commands that the guides already name stay, because git is not a harness tool.

**The token comparison stays fair.** Checked by reading #12 and #32 with `gh issue view`. The baseline runs used the frozen prose skill without a Graphify graph, and #32 step 5 says "Do not build a code graph. The baseline runs had none, and the new version does not use Graphify." So dropping Graphify does not change the conditions of the milestone 4 comparison. The old settled line claimed Graphify protected the context budget, which would have mattered if the baseline had used it.

**The frozen skills are not coupled.** Checked by searching `cstack/test/`, `cstack/src/` and `.github/workflows/` for the tag `prose-skills-final` and for paths into the top-level `skills/` folder. Nothing reads or compares them, so the ticket can change `cstack/skills/` alone, as ADR-SIC-E requires.

Locked decisions cited and not reopened: the drop of Graphify itself (maintainer, 2026-11-19, closing comment of #19), ADR-SIC-E (never edit `skills/`), ADR-SIC-C (skills and guides live in `cstack/`), and the coordinator's rules on merging `origin/main` and on #24's changes to `cstack doctor`. The ordering constraint from the mention scan is already in the code mapping and is not repeated here. I checked security, the data model, scale, failure and rollback, user-facing edge cases, operations and cost, and reversibility, and found nothing beyond the points above: the change only removes text and an unbuilt command, `cstack doctor` has no machine-readable output that anyone parses, and every edit can be reverted with git.

### Open questions and answers

1. **Why was Graphify dropped?** Label: blocking. Only the user can answer. The ticket asks the specification to mark US-11 as dropped "with one sentence that says why", and each line of `settled-decisions.md` says what its decision protects. Neither the ticket, the closing comment of #19 nor the retrospective of #19 gives the reason. Recommended answer, to be confirmed or replaced by the user: "Graphify is one more tool to install and keep fresh, and the new version must run on a machine that has only the required items." The new settled line would then say that the decision protects the runs from a missing or stale tool and keeps the install short. **Answer (the user, 2026-11-19):** Graphify is dropped because nothing has shown that tools of this kind find code better than a plain agent, or that they save tokens. The recommended guess was not kept.
2. **Should this ticket write an ADR for dropping Graphify?** Label: non-blocking. Recommended answer: no. The maintainer took the decision, the ticket does not ask for an ADR, and the new line of `settled-decisions.md` with the note on US-11 records it where the next run will find it. **Answer:** accepted by the user on 2026-11-19.
3. **Where does the new test that scans for the word "graphify" live?** Label: non-blocking. Recommended answer: in a new file, `cstack/test/no-graphify.test.ts`, so that it stays away from `manifest.test.ts`, which every ticket of this wave changes. **Answer:** accepted by the user on 2026-11-19.
4. **Should section 10 "Challenged choices" of the specification get a bullet for Graphify?** Label: non-blocking. Recommended answer: no. The ticket asks only for the note on US-11, and one place for the reason is enough. **Answer:** accepted by the user on 2026-11-19.
5. **Should the guides name a specific search command, such as `git grep`?** Label: non-blocking. Recommended answer: no. The settled decision "Tool-agnostic wording" asks the guides to stay independent of the harness, so they say "search the code for the name of the symbol" and let the harness pick its tool. **Answer:** accepted by the user on 2026-11-19.

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. No new decision since phase 4, so the advisor was not called again.
