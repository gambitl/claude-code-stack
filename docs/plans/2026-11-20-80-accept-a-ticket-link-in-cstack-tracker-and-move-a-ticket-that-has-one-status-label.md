# Plan: #80 — M3-18: Accept a ticket link in cstack tracker, and move a ticket that has one status label

Format: cstack-plan/1
Written by: cstack 0.3.1
Date: 2026-11-20
Ticket: https://github.com/gambitl/claude-code-stack/issues/80
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/tracker-links
Target branch: main
Conversation language: French
Status: ready for review
Approved at: 2026-11-23T09:56:15+01:00
Ready for review at: 2026-11-23T10:18:17+01:00

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** `cstack` reads a GitHub or GitLab ticket from its link, and it can move a ticket to "in progress" in a project that has only that one status label.

- **What the title means**: A ticket link is the web address of an issue, such as `https://gitlab.com/group/project/-/issues/12`. Today `cstack tracker` only accepts the short key `#12`. A status label is a label such as "in progress" or "in review", which `cstack` uses as the state of a ticket on GitHub and GitLab, because issues there have no such state.
- **Why we are doing it**: Both comparison runs of #32 lost calls on these two points. Each run first gave `cstack tracker read` the link of its issue, then the form `<group>/<project>#<number>`, and only found the form `#<number>` after up to three failed calls. Then `cstack tracker move` to "in progress" failed in both runs, because the project had an "in progress" label but no "in review" label. So the tickets never moved. The same problem with a bare number such as `10` was seen three times before.
- **For the user**: A run starts from the link the user gives, and the ticket shows "in progress" while the run works on it, as the old skill did.

**Goal.** This ticket makes `cstack tracker` accept the link and the bare number of a GitHub or GitLab issue of the origin project, and makes a move need only the label it adds.

### Where things are today (read first)

* **The key check**: `cstack/src/tracker/keys.ts` → `isValidKey()` (line 10) accepts `#<number>` for GitHub and GitLab, and `<PROJECT>-<number>` for Jira and Linear. `cstack/src/tracker/checked.ts` → `checkedTracker()` (line 10) refuses any other value with `"<value>" is not a valid <tracker> ticket key.` before it reaches `gh` or `glab`. Keep that check, so that no value ever reaches a program unchecked.
* **The commands**: `cstack/src/commands/tracker-read.ts` (line 10), `tracker-move.ts` and `tracker-comment.ts` take the key as their first argument. `KEY_HINT` in `cstack/src/commands/tracker-common.ts` (line 18) only explains the single quotes around `#12`.
* **The origin project**: `cstack/src/tracker/forge.ts` → `originRepo()` (line 11) reads the host and the path of the `origin` remote. A link must point to that host and that path. A link to another project is refused, because `cstack` only reads the origin project.
* **The GitLab move**: `cstack/src/tracker/gitlab-glab.ts` → `moveState()` (line 131) checks that both status labels exist before it moves the ticket. The comment explains why: GitLab creates a missing label without a word when an update adds it. That reason applies only to the label that the move adds. The label that the move removes does not need to exist.
* **The GitHub move**: `cstack/src/tracker/github-gh.ts` → `moveState()` (line 152) runs `gh issue edit` with `--add-label` and `--remove-label`, and reports a missing label from the error of `gh`. Check what `gh` does when only the removed label is missing, and make both forges behave the same way.
* **The ticket guide**: `cstack/guides/resolve-issue/ticket.md` (line 9) says to run `cstack tracker read '<key>'`, without saying which forms a key may take. Line 11 asks for the labels, the parent, the comments and the relations, which `tracker read` does not return. In #32, each run found that out by itself and read them with `glab`.
* **The tests**: `cstack/test/tracker/keys.test.ts`, `gitlab-glab.test.ts` and `github-gh.test.ts` use fake programs, never the real `gh` or `glab`.

### Scope

1. For GitHub and GitLab, accept three forms of key in `read`, `move` and `comment`: `#<number>`, a bare number such as `12`, and the link of an issue of the origin project. On GitLab, accept the links that end in `/-/issues/<number>` and in `/-/work_items/<number>`. Turn each form into `#<number>` before `checkedTracker()` checks it.
2. Refuse a link to another host or another project. The message names the origin project and gives the key form, such as `'#12'`.
3. When a key is refused, the message gives the accepted forms for that tracker.
4. On both forges, a move needs only the label that it adds. When the label that it would remove does not exist, the move adds the new label and does not fail. A missing label to add still stops the move, with today's message.
5. In `cstack/guides/resolve-issue/ticket.md`, say which forms of key `cstack tracker read` accepts for each tracker. Also say that its answer holds the key, the title, the body, the link, the state and the blockers only, so the labels, the parent and the comments come from the tracker's own tool.
6. Update the `cstack tracker` part of `README.md`.
7. Jira and Linear keys do not change in this ticket.

### Acceptance (TDD)

* `cstack/test/tracker/keys.test.ts`, or a new test of the key forms: write first a case where `12` and the GitLab link of issue 12 of the origin project both become `#12`. See it fail on today's code, then pass. A link that ends in `/-/work_items/12` also becomes `#12`.
* The same file: a link to another project, a link to another host and a link to a merge request are refused, and the message names the origin project. `#0`, `-12` and `12abc` are still refused.
* `cstack/test/tracker/gitlab-glab.test.ts`: write first a case where the project has "in progress" and no "in review". `moveState('#4', "in progress")` adds "in progress" and exits with 0. A project without "in progress" still refuses the move, and the fake `glab` never receives an update.
* `cstack/test/tracker/github-gh.test.ts`: the same two cases for GitHub.
* A command test: `cstack tracker read 12` and `cstack tracker read '<link>'` print the same ticket as `cstack tracker read '#12'`.
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

- [ADR-SIC-A, how the helpers run](../decisions/ADR-SIC-A-helpers.md). ADR-SIC-G changed it on 2026-11-20: inside a ticket, the helpers run as sub-agents again, and an Orca worker is used only for units that run in parallel.
- [ADR-SIC-B, where the run state lives and how its format is versioned](../decisions/ADR-SIC-B-run-state.md).
- [ADR-SIC-C, how cstack ships its skills](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md). `cstack` ships the skills and their guides, and serves them at its own version.
- [ADR-SIC-D, the settings file and the model of the review agent](../decisions/ADR-SIC-D-settings-file-and-review-model.md).
- [ADR-SIC-E, the new role of the repository](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The prose skills in `skills/` are frozen at the tag `prose-skills-final` and are never edited.
- [ADR-SIC-F, how cstack reaches trackers and forges](../decisions/ADR-SIC-F-tracker-access.md). `cstack` never holds credentials.
- [ADR-SIC-G, continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md). The project continues with a refocus and three quality guards. It names tickets #79 and #80 as the two fixes that ship before the next measure.
- [ADR-SIC-H, how a cstack command starts and ends](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md).

## Dependencies

clear

The tracker lists no blocker for this ticket, and its footer says "Blocked by: none". Ticket #79 runs at the same time in another worktree. It is not a blocker, because the two tickets change different files.

## Code mapping

All paths below are relative to the repository root. Line numbers are those of `main` at commit `eb7cc03`.

**The key check.** `cstack/src/tracker/keys.ts` holds three pure functions. `isValidKey()` (line 10) accepts `#<number>` for GitHub and GitLab (`FORGE_KEY`, line 5) and `<PROJECT>-<number>` for Jira and Linear (`BOARD_KEY`, line 4), with at most 32 characters (line 3). `isValidUrl()` (line 16) accepts an https URL without spaces, quotes or control characters. `isSafeArgument()` (line 21) refuses an empty value, a leading dash and a control character.

**Other users of `isValidKey()`.** `isValidKey()` must keep its meaning, because four other places rely on it. `cstack/src/tracker/blockers.ts` line 17 keeps only the valid keys among the words of a ticket's "Blocked by" footer, so a bare number there must never become a key. `cstack/src/tracker/claude-file.ts` lines 79 and 82 check the keys of a file that Claude wrote. `cstack/src/wave/names.ts` line 6 checks the key of `cstack wave`, with its own copy of today's message. `cstack/src/tracker/jira-orca.ts` line 38 and `cstack/src/tracker/linear-orca.ts` lines 56 and 115 check Jira and Linear keys. So the new forms need a separate function that turns a link or a bare number into `#<number>`, and `isValidKey()` stays as it is.

**Where the check runs.** `cstack/src/tracker/checked.ts` → `checkedTracker(adapter, name, warn)` (line 10) wraps every adapter. Its inner `key()` (lines 11 to 16) throws `RefusedArgumentError` with `"<value>" is not a valid <tracker> ticket key.` (line 13), which gives exit code 1. `readTicket` (line 35), `moveState` (line 52) and `addComment` (line 55) call `key()` first. `listGroup` (line 43) also calls `key()` for the epic of `cstack tracker list --epic`. `badField()` (lines 23 to 32) checks the keys that come back from an adapter with `isValidKey()`.

**Who builds the checked tracker.** `cstack/src/tracker/open.ts` → `openTracker()` (line 81) is the only place that calls `checkedTracker()` for a real command. It wraps the file tracker of `--from-file` (line 89), the Jira and Linear adapters (line 98), and the `gh` and `glab` adapters (lines 110 and 111). It already reads the `origin` remote at most once, through `readOrigin` (line 86), but the file branch (line 87) does not read it, so a clone with no `origin` still works with a file (comment on lines 29 to 31). `refuseWithoutClient()` (line 52) builds a second checked tracker, so that a bad key still exits with 1 before exit code 4 when no client is logged in. Tests build checked trackers directly in `cstack/test/tracker/keys.test.ts` and in five files under `cstack/test/wave/` and `cstack/test/helpers/watch.ts`, always with three arguments. So a new parameter of `checkedTracker()` must be optional.

**The origin project.** `cstack/src/tracker/forge.ts` → `originRepo(run, root)` (line 11) runs `git config --get remote.origin.url` and returns a `Remote` from `parseRemote()` in `cstack/src/publish/remote.ts` (line 12): `host`, `port` (kept only for an https remote), `path` and `ssh`. When there is no origin, it throws `RefusedArgumentError` with a message that suggests `--from-file` (lines 15 to 17). `cstack/src/publish/remote.ts` belongs to the publish modules that ticket #79 may change, so this branch only imports `parseRemote()` and `redact()` from it and does not edit it. `redact()` (line 30) removes the user information from a URL.

**How each adapter compares links today.** `cstack/src/tracker/github-gh.ts` lines 27 to 31 build the issue URL prefix of the origin as `https://<host>[:<port>]/<path>/issues/`, in lower case, and `localNumber()` (lines 44 to 48) takes the number after that prefix. `cstack/src/tracker/gitlab-glab.ts` line 63 compares project paths without case, which commit `ed49762` added. A new link check should follow the same rules: same host, same port as an https origin, same path without case.

**The commands.** `cstack/src/commands/tracker-read.ts` (line 7), `tracker-move.ts` (line 8) and `tracker-comment.ts` (line 54) take the key as their first positional argument and pass it unchanged to the tracker. `tracker-move.ts` line 29 prints `Moved '<key>' to "<state>".` and `tracker-comment.ts` line 87 prints `Added the text of <path> as a comment on '<key>'.`, both with the key as the user typed it. `KEY_HINT` in `cstack/src/commands/tracker-common.ts` (line 18) is printed with the usage errors of a missing key or an extra argument, in `read`, `move`, `comment` and `list`. The `cstack tracker` entries of `cstack/src/manifest.ts` (lines 204 to 238) hold the usage lines, and their text `<key>` needs no change.

**The GitLab move.** `cstack/src/tracker/gitlab-glab.ts` → `moveState()` (line 131) checks the state name (line 132), then asks `glab api --hostname <host> projects/<path>/labels/<name>` for both labels (lines 136 to 145). A `404` refuses the move with `The label "<name>" does not exist in this project, so cstack did not move the ticket. cstack never creates a label. To create it, run: glab label create --name "<name>" -R <repo>` (line 141). Any other failure goes through `forgeFailure(..., true)`. Then it runs `glab issue update <n> -R <repo> --label <state> --unlabel <other>` (line 146). The comment on line 135 gives the reason for the check: GitLab creates a missing label silently when an update adds it.

**The GitHub move.** `cstack/src/tracker/github-gh.ts` → `moveState()` (line 152) runs one `gh issue edit <n> --repo <repo> --add-label <add> --remove-label <remove>` (line 156). On exit code 1, it takes the label name from `'<name>' not found` in the error of `gh` (line 158) and refuses with `The label "<name>" does not exist in <repo>. cstack never creates a label. Run this command, then move the ticket again: gh label create "<name>" --repo <repo>` (line 161). The recorded answer `cstack/test/fixtures/gh/2.101.0/issue-edit.missing-label.txt` shows that `gh` 2.101.0 fails with exit code 1 and `'in review' not found` when the label to remove does not exist. Its README says that the answer names only the first missing label that `gh` finds. So today a GitHub project without "in review" cannot move a ticket to "in progress", which is the bug of the ticket.

**The tests.** `cstack/test/tracker/keys.test.ts` tests `isValidKey()`, `isValidUrl()` and `checkedTracker()` with a spy adapter. `cstack/test/tracker/github-gh.test.ts` uses a fake runner keyed by the joined `gh` arguments (lines 20 to 32), the edit helper `edit(add, remove)` (line 133), and a command test of `trackerMove` (lines 212 to 227). `cstack/test/tracker/gitlab-glab.test.ts` uses a fake runner keyed by the whole command line (lines 24 to 37), the helpers `label()`, `update()` and `failed()` (lines 169 to 171), and a command test of `trackerRead` (line 243). The GitLab fixtures in `cstack/test/fixtures/glab/1.119.0/` were written by hand, and `issue-update.ok.txt` is the answer of `glab issue update 7 --label "in progress"` without `--unlabel`. The GitHub fixtures in `cstack/test/fixtures/gh/2.101.0/` were recorded on a private sandbox. `cstack/test/tracker/claude-file-fallback.test.ts` tests `trackerRead` with `--from-file`. `cstack/test/guides/ticket-read.test.ts` (lines 10 to 16) requires one paragraph of the ticket guide to hold `cstack tracker read '<key>' --tracker <name>`, `` `4` ``, `templates/tracker-file.json` and `--from-file <file>`.

**The ticket guide and its word budget.** `cstack/guides/resolve-issue/ticket.md` line 9 gives the read command, and line 11 asks for the labels, the parent, the comments, the relations and the suggested branch name. `cstack/test/skill-size.test.ts` (lines 15 to 21 and 41 to 44) requires the words of `cstack/skills/resolve-issue/SKILL.md` plus the first guide, which is `ticket.md`, to stay under a fifth of the frozen prose skill. Today they hold 836 + 608 = 1,444 words, and the limit is under 1,451.8 words (a fifth of 7,259). So `ticket.md` can grow by 7 words at most. The new text about key forms and about what `cstack tracker read` returns must replace words, not only add them.

**The README.** `README.md` line 69 is the `cstack tracker` paragraph. It says to write a key in single quotes, such as `'#12'`, and says nothing about links or bare numbers.

**Governing decisions.** ADR-SIC-F (`docs/decisions/ADR-SIC-F-tracker-access.md`) says that `cstack` never holds credentials and reaches GitHub and GitLab only through `gh` and `glab`, through the runner. The `WHY:` comment on line 1 of `cstack/src/tracker/open.ts` makes `openTracker()` the one place that puts the checks around a client. The `WHY:` comment on line 1 of `cstack/src/commands/tracker-common.ts` keeps the messages and exit codes of the four tracker commands equal.

**History and risks.** `keys.ts` changed once (`7730b82`) and `checked.ts` three times, last with `fd19196`, which skips a ticket whose blocker key is bad. `gitlab-glab.ts` had one fix commit (`ed49762`) after its two feature commits. No file here was fixed again and again. The main risks are these. First, the word budget of the ticket guide. Second, a change of `isValidKey()` would silently change the footer parser and the file reader. Third, a link check that differs from the URL rules of the adapters would accept a link that the adapter then reads from another project.

## Decisions

- Raise the version to `0.3.2` in `cstack/package.json` and `cstack/package-lock.json` in this branch, for example with `npm version 0.3.2 --no-git-tag-version` run in `cstack/`. Only this ticket changes the version. (2026-11-20, from the brief of the run)
- Ticket #79 runs at the same time in another worktree. It changes `cstack/src/commands/publish.ts`, any module under `cstack/src/publish/`, the publish tests in `cstack/test/` such as `publish.test.ts`, and the `cstack publish` paragraph of `README.md`. Do not change any of them in this branch. (2026-11-20, from the brief of the run)
- This ticket works in `cstack/src/tracker/` (mainly `keys.ts`, `checked.ts`, `gitlab-glab.ts` and `github-gh.ts`), the files `cstack/src/commands/tracker-*.ts`, the tests under `cstack/test/tracker/`, the guide `cstack/guides/resolve-issue/ticket.md`, and the `cstack tracker` paragraph of `README.md`. In `README.md`, change only the `cstack tracker` paragraph. In `cstack/src/manifest.ts`, change only the entries of `cstack tracker`. (2026-11-20, from the brief of the run)
- Nobody pushes a tag, and never push a tag that starts with `v`. The coordinator pushes `v0.3.2` once the pull requests of #79 and #80 are both merged. (2026-11-20, from the brief of the run)
- In a child worktree, never run `npm install`, because it can rewrite `package-lock.json`. Run the setup command of the settings, or `npm ci` in `cstack/`. (2026-11-20, from the brief of the run)
- When `cstack unit collect` keeps a child worktree, or fails, never remove a worktree or a branch with `git`. Follow step 7 of the build guide. When it asks for a decision, the main conversation tells the user in the chat and tells the coordinator with `ask`. (2026-11-20, from the brief of the run)
- `cstack helper start`, `cstack helper wait` and `cstack unit collect` call Orca themselves, and that is expected. Nobody runs `orca worktree create` or `orca worktree rm`. Only the main conversation runs `orca orchestration`, and only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-20, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-20, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-20, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-20, from the coordinator of the wave)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-20, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-20, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-20, from the brief of the run)
- Never read, run or change anything under `~/comparison/` or `~/review-candidates/`, which hold private work data. Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-20, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-20, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-20, from the brief of the run)
- Never change `.cstack/settings.json` in this branch, because the independent review refuses a branch that changes it. (2026-11-20, from the brief of the run)
- When the skill or the installed `cstack` 0.3.1 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-20, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data uses the sample names `user`, `someone` or `runner`. (2026-11-20, from the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-20, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep both changes, and push with a plain `git push`, without force. (2026-11-20, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-20, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. (2026-11-20, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-20, from the brief of the run)
- `isValidKey()` in `cstack/src/tracker/keys.ts` (line 10) keeps its meaning. The footer parser (`cstack/src/tracker/blockers.ts` line 17), the file reader (`cstack/src/tracker/claude-file.ts` lines 79 and 82) and `cstack wave` (`cstack/src/wave/names.ts` line 6) rely on it, so a bare number in a footer never becomes a key. A new function turns a GitHub or GitLab key given as a link or a bare number into `#<number>`. (2026-11-20, assumption not asked)
- After the conversion, `checkedTracker()` still checks the result with `isValidKey()` (`cstack/src/tracker/checked.ts` line 12), so no value reaches `gh` or `glab` unchecked, as the ticket asks. (2026-11-20, from the ticket)
- A bare number matches `^[1-9][0-9]*$` and becomes `#<number>`. So `#0`, `0`, `012`, `-12` and `12abc` are refused, as `FORGE_KEY` refuses `#0` today (`cstack/src/tracker/keys.ts` line 5). (2026-11-20, assumption not asked)
- A link is accepted only when it starts with `https://`, passes `isValidUrl()` (`cstack/src/tracker/keys.ts` line 16), has no user information, and has the host and the path of the `origin` remote, both compared without case. A link carries a port only when an https `origin` has one, as the GitHub adapter builds its URL prefix (`cstack/src/tracker/github-gh.ts` line 30). On GitHub, the path then ends in `/issues/<number>`. On GitLab, it ends in `/-/issues/<number>` or `/-/work_items/<number>`. Any other link, such as a pull request or a merge request, is refused. (2026-11-20, assumption not asked)
- A refused link that cstack prints goes through `redact()` (`cstack/src/publish/remote.ts` line 30) and through `printable()` (`cstack/src/tracker/checked.ts` line 62), so a token in the user part of a link or a control character never reaches the terminal. (2026-11-20, assumption not asked)
- `cstack/src/publish/remote.ts` is not changed in this branch, because it is a publish module that ticket #79 may change. This branch only imports `parseRemote()` and `redact()` from it. (2026-11-20, from the brief of the run)
- Jira and Linear keys do not change, and their refusal only gains the sentence that gives their accepted form. (2026-11-20, from the ticket)
- `cstack/test/skill-size.test.ts` (lines 41 to 44) keeps `cstack/skills/resolve-issue/SKILL.md` plus `cstack/guides/resolve-issue/ticket.md` under 1,451.8 words, and they hold 1,444 today. So the new text of `ticket.md` replaces words: it can grow by 7 words at most. Do not change `SKILL.md` to make room. The paragraph of `ticket.md` that names `cstack tracker read '<key>' --tracker <name>` must still hold `` `4` ``, `templates/tracker-file.json` and `--from-file <file>` (`cstack/test/guides/ticket-read.test.ts` lines 10 to 16). (2026-11-20, assumption not asked)
- The tests of the GitHub move use recorded or hand-written answers of `gh`, never the real `gh`. The answers of `gh api` 2.101.0 for a label are: exit 0 and the label as JSON when it exists, and exit 1 with `gh: Not Found (HTTP 404)` on standard error when it does not. They were checked read only on this public repository on 2026-11-20. A new fixture file in `cstack/test/fixtures/gh/2.101.0/` replaces the owner and the repository with `example-owner/example-repo` and every id with `id-placeholder`, and its README says where it comes from. (2026-11-20, tested answer)
- On GitHub, `moveState()` first checks both labels with `gh api --hostname <host> repos/<path>/labels/<name>`, with the name passed through `encodeURIComponent`, as the GitLab move does (`cstack/src/tracker/gitlab-glab.ts` lines 136 to 145). Exit 1 with `HTTP 404` on standard error means that the label is missing. Any other failure goes through `forgeFailure("gh", result, true)` (`cstack/src/tracker/forge.ts` line 68). (2026-11-23, the user's answer)
- On both forges, a missing label to add stops the move before any edit, with today's message, word for word. On GitHub it is `The label "<name>" does not exist in <repo>. cstack never creates a label. Run this command, then move the ticket again: gh label create "<name>" --repo <repo>` (`cstack/src/tracker/github-gh.ts` line 161). On GitLab it is the message of `cstack/src/tracker/gitlab-glab.ts` line 141. (2026-11-23, from the ticket)
- On both forges, a missing label to remove is left out of the edit. GitHub then runs `gh issue edit <n> --repo <repo> --add-label <label>` without `--remove-label`. GitLab then runs `glab issue update <n> -R <repo> --label <label>` without `--unlabel`. When both labels exist, the edit is the same as today. (2026-11-23, the user's answer)
- `checkedTracker()` (`cstack/src/tracker/checked.ts` line 10) gets a fourth, optional parameter: a function that returns the `origin` remote as a `Remote`. Its inner `key()` becomes async. For GitHub and GitLab, it turns a bare number or a link into `#<number>`, and it calls the function only when the key is a link. It then checks the result with `isValidKey()`, as today. Jira and Linear keys skip the conversion. The pure conversion lives in `cstack/src/tracker/keys.ts` and takes the `Remote` as an argument, so its tests need no runner. (2026-11-23, the user's answer)
- `openTracker()` passes its `readOrigin` (`cstack/src/tracker/open.ts` line 86) to the `gh` and `glab` branches (lines 110 and 111) and to the file branch (line 89), where `origin` is read only when the key is a link. `refuseWithoutClient()` (line 59) passes `() => originRepo(run, root)` too, so a link given to `move` or `comment` with no logged-in client still ends with exit code 4, and a bad key still ends with exit code 1 first. (2026-11-23, the user's answer)
- When a link needs `origin` and the clone has none, the key is refused with exit code 1, and the message asks for the `'#12'` form. A bare number and `'#12'` never read `origin`. (2026-11-23, accepted by default in the question round)
- The refusal of a GitHub or GitLab key reads `"<value>" is not a valid <tracker> ticket key. Write it as '#12', as 12, or as the link of an issue of this project.` The refusal of a Jira or Linear key reads `"<value>" is not a valid <tracker> ticket key. Write it as 'ABC-12'.` The key refusal never needs `origin`. (2026-11-23, the user's answer)
- The refusal of a link to another host, another project, a pull request or a merge request reads `cstack only reads the issues of <host>/<path>, the origin project, and <link> is not the link of one of its issues. Write the key as '#12'.` Here `<host>/<path>` comes from `origin`, and `<link>` goes through `redact()` and `printable()`. (2026-11-23, the user's answer)
- `KEY_HINT` (`cstack/src/commands/tracker-common.ts` line 18) keeps its sentence and gains a second one: `You can also write 12, or the link of the issue in single quotes.` The message of `cstack wave` (`cstack/src/wave/names.ts` line 6) keeps today's text. (2026-11-23, the user's answer)
- `cstack tracker list --epic` accepts the same three forms, because `listGroup` calls the same `key()` (`cstack/src/tracker/checked.ts` line 43). (2026-11-23, accepted by default in the question round)
- A link may end with `/`, a query or a fragment, such as `#issuecomment-5` or `#note_5`, after the number. Any other text after the number is refused. (2026-11-23, accepted by default in the question round)
- `move` and `comment` keep printing the key as the user typed it (`cstack/src/commands/tracker-move.ts` line 29 and `cstack/src/commands/tracker-comment.ts` line 87). (2026-11-23, accepted by default in the question round)
- The `cstack tracker` paragraph of `README.md` (line 69) says which key forms each tracker accepts, and tells the reader to put a link in single quotes too. In zsh, an unquoted word with `?` stops with `no matches found` before cstack starts, and an unquoted `#` starts a comment in bash and zsh. (2026-11-23, accepted by default in the question round)
- When a link needs `origin` and the function that reads it throws a `RefusedArgumentError`, because the clone has no `origin` remote, the key check refuses with exit code 1 and this message: `cstack cannot check the link "<link>", because this repository has no origin remote. Write the key as '#12'.` Here `<link>` goes through `redact()` and `printable()`. Any other error of that function is thrown again unchanged. (2026-11-23, assumption not asked)
- In the link refusal, `<host>/<path>` is the `host` of the `Remote`, followed by `:<port>` when the `Remote` has a port, then `/` and its `path`. The key refusal prints `<value>` through `redact()` and `printable()`, so a token in the user part of a link never reaches the terminal. (2026-11-23, assumption not asked)
- When `checkedTracker()` gets no function that reads `origin`, as in the tests under `cstack/test/wave/`, a link is refused with the key refusal, and a bare number is still converted. (2026-11-23, assumption not asked)
- The new GitHub answers of `gh api` come from two new fixture files, `cstack/test/fixtures/gh/2.101.0/api-label.found.json` and `cstack/test/fixtures/gh/2.101.0/api-label.not-found.txt`. The first holds `{"id":1,"node_id":"id-placeholder","url":"https://api.github.com/repos/example-owner/example-repo/labels/in%20progress","name":"in progress","color":"FBCA04","default":false,"description":"Work has started","archived_at":null,"archived_by":null}` and a final newline. The second holds `gh: Not Found (HTTP 404)` and a final newline. (2026-11-23, tested answer)
- The text of `cstack/guides/resolve-issue/ticket.md` changes in three places, word for word, and nowhere else. Line 9 becomes: "Read the ticket with `cstack tracker read '<key>' --tracker <name>`. The name is `jira`, `linear`, `github` or `gitlab`. The key is `ABC-12` on Jira and Linear, and `'#12'`, `12` or the issue link on GitHub and GitLab. On exit code `4`, read the ticket with your own connection and fill `templates/tracker-file.json` from the skill folder. Run the same command again with `--from-file <file>`." Line 11 becomes: "Its answer holds only the key, title, body, link, state and blockers. Read the labels, parent, comments, relations and branch name with the tracker's own tool." Line 24 loses its last sentence and becomes: "- Sometimes a last `## CTO review — …` block." The word "Sometimes" already says the block is optional. With these texts, `SKILL.md` and `ticket.md` hold 836 + 614 = 1,450 words, under the limit of 1,451.8. (2026-11-23, assumption not asked)

## Architecture

The approach is locked by the answers of the question round, so there was no real choice to compare. The conversion of a key is a pure function in `cstack/src/tracker/keys.ts`, which takes the `origin` remote as an argument. `checkedTracker()` calls it inside its key check, before `isValidKey()`, and reads `origin` through an optional fourth parameter only when the key is a link. `openTracker()` and `refuseWithoutClient()` pass that parameter, so `cstack/src/tracker/open.ts` stays the one place that puts the checks around a client. Both forge moves check the label to add and the label to remove before they edit. A missing label to add stops the move, and a missing label to remove is left out of the edit. No new decision since the question round.

## Implementation units

### Unit 1: Turn a bare number or a link of the origin project into a forge key

- Files: `cstack/src/tracker/keys.ts`, `cstack/src/tracker/checked.ts`, `cstack/test/tracker/keys.test.ts`
- Test: `cstack/test/tracker/keys.test.ts`: on GitLab, `12` and the link of issue 12 of the origin project both reach the adapter as `#12`, and a link to another project is refused with exit code 1 and a message that names the origin project.
- Minimum code: In `keys.ts`, add pure functions and leave `isValidKey()`, `isValidUrl()` and `isSafeArgument()` unchanged. `looksLikeLink(value)` is true when the value starts with a scheme and `://`, such as `https://` or `http://`, without case. `keyOfNumber(value)` returns `#<number>` when the value matches `^[1-9][0-9]*$`, else `undefined`. `keyOfLink(tracker, link, origin)` takes `"github"` or `"gitlab"`, a link and a `Remote` (import the type from `cstack/src/publish/remote.ts`). It returns `#<number>` or `undefined`, following the link rules of `## Decisions`. Parse the link with `new URL()`. Ignore the query and the fragment, allow one trailing `/`, compare the host and the origin path without case, and match the rest of the path exactly. `keyForms(tracker)` returns the second sentence of the key refusal of `## Decisions`. In `checked.ts`, add the optional fourth parameter `origin?: () => Promise<Remote>` and make the inner `key()` async. For GitHub and GitLab only, a value that looks like a link goes through `keyOfLink()`, and any other value through `keyOfNumber()`. Then check the result with `isValidKey()`, as today. Write the three refusal messages of `## Decisions` exactly. `readTicket`, `listGroup`, `moveState` and `addComment` await `key()`.
- Refactor: none.
- Commit message: `feat(cli): accept a bare number or the link of an issue as a GitHub or GitLab key`
- Depends on: none

Write the cases with the spy adapter of `keys.test.ts` and a `Remote` such as `{ host: "gitlab.com", path: "example-group/example-project", ssh: false }`. Pass `async () => remote` as the fourth argument, and count its calls. Check these cases. `12` reaches the adapter as `#12` in `readTicket`, `moveState`, `addComment` and `listGroup({ epic })`, and the origin function is never called. The links that end in `/-/issues/12` and `/-/work_items/12` reach it as `#12`, and so do the same links with a trailing `/`, a query and a fragment, and with the path in other letter case. On GitHub, `https://github.com/example-owner/example-repo/issues/12` reaches it as `#12`. A link to another project, to another host and to a merge request (`/-/merge_requests/12`) is refused with exit code 1, and the adapter is never called. The message holds `gitlab.com/example-group/example-project` and `'#12'`. On GitHub, a link to a pull request (`/pull/12`) is refused the same way. An `http://` link and a link with a user part, such as `https://user:secret@gitlab.com/...`, are refused, and the message never holds `secret`. `#0`, `0`, `012`, `-12` and `12abc` are refused with the message that ends with `Write it as '#12', as 12, or as the link of an issue of this project.` A bad Jira key gets the message that ends with `Write it as 'ABC-12'.`, and `12` is still refused on Jira. When the origin function throws a `RefusedArgumentError`, a link gets the message about the missing origin remote, and `12` still reaches the adapter as `#12`. When no origin function is given, a link gets the key refusal. Each case checks the exact message or the exact key that reaches the adapter, so that it fails before the code exists. For the rule that refuses another project, break the path comparison in `keyOfLink()` on purpose, run the test, see it fail, then restore the code exactly.

### Unit 2: Give the origin remote to the key check of every tracker command

- Files: `cstack/src/tracker/open.ts`, `cstack/src/commands/tracker-common.ts`, `cstack/test/tracker/tracker-key-forms.test.ts`
- Test: `cstack/test/tracker/tracker-key-forms.test.ts`: `cstack tracker read 5` and `cstack tracker read 'https://github.com/example-owner/example-repo/issues/5'` print the same ticket as `cstack tracker read '#5'`.
- Minimum code: In `open.ts`, pass `readOrigin` as the fourth argument of `checkedTracker()` in the file branch (line 89) and in the `gh` and `glab` branches (lines 110 and 111). Leave the Jira and Linear branch (line 98) without it. In `refuseWithoutClient()` (line 59), pass `() => originRepo(options.run, options.root)`. Keep the comment on lines 29 to 31 true: the file branch reads `origin` only when the key is a link. In `tracker-common.ts`, add the second sentence of `KEY_HINT` that `## Decisions` gives, after today's sentence, with one space between them.
- Refactor: none.
- Commit message: `feat(cli): check a ticket link against the origin project in every tracker command`
- Depends on: 1

Write the file in the style of `cstack/test/tracker/github-gh.test.ts`: a fake runner answers `git config --get remote.origin.url` with `https://github.com/example-owner/example-repo.git`, `git rev-parse --show-toplevel` with `/repo`, `gh auth status --hostname github.com` with exit code 0, and the `gh issue view` calls with the recorded fixtures of `cstack/test/fixtures/gh/2.101.0/` for issue 5 and its blocker, issue 4. Write four cases. First, one case runs `trackerRead` with `5`, with the link and with `#5`, and checks that the three outputs are equal and that each one exits with 0. Second, `trackerMove` with the link and `--to "in progress"`, when `gh auth status` fails, exits with 4, and its standard error names `#5`. Third, `trackerRead` with the link and `--from-file <file>`, in a clone where `git config --get remote.origin.url` fails and the file says `"tracker": "github"`, exits with 1, and its standard error holds `no origin remote` and `'#12'`. Fourth, `trackerRead` with no key exits with 2, and its standard error holds the new sentence of `KEY_HINT`. Each case fails before the code of this unit, because unit 1 alone refuses a link when no origin function is given, and today's `KEY_HINT` lacks the sentence. For the rule of the third case, remove on purpose the catch of the missing origin in `checked.ts`, run the test, see it fail, then restore the code exactly.

### Unit 3: Move a GitHub ticket when only the label to add exists

- Files: `cstack/src/tracker/github-gh.ts`, `cstack/test/tracker/github-gh.test.ts`, `cstack/test/fixtures/gh/2.101.0/api-label.found.json`, `cstack/test/fixtures/gh/2.101.0/api-label.not-found.txt`, `cstack/test/fixtures/gh/2.101.0/README.md`
- Test: `cstack/test/tracker/github-gh.test.ts`: in a repository that has "in progress" and no "in review", `moveState("#4", "in progress")` runs `gh issue edit 4 --repo <repo> --add-label "in progress"` without `--remove-label`, and resolves.
- Minimum code: Add `host` (the `host` of the `Remote`, without the port, as `openTracker()` passes it to `gh auth status --hostname`) to the context that `where()` builds. In `moveState()`, after `checkStateName()`, check the label to add, then the label to remove, with `gh api --hostname <host> repos/<path>/labels/<encodeURIComponent(name)>`. Exit 0 means that the label exists. Exit 1 with `HTTP 404` in standard error means that it is missing. Any other answer throws `forgeFailure("gh", result, true)`. When the label to add is missing, throw today's `RefusedArgumentError` of line 161, word for word, before any `gh issue edit`. When the label to remove is missing, leave `--remove-label <label>` out of the edit. Keep the handling of `'<name>' not found` after the edit (lines 158 to 163) as it is.
- Refactor: none.
- Commit message: `fix(cli): move a GitHub issue when the label to remove does not exist`
- Depends on: none

Create the two fixture files with the exact content that `## Decisions` gives. In the fixture `README.md`, add one short paragraph after the list of files. It says that `api-label.found.json` is the standard output of `gh api --hostname github.com repos/<repo>/labels/in%20progress`, with exit code 0. It says that `api-label.not-found.txt` is the standard error of the same command for a label that does not exist, with exit code 1. It also says that both were recorded on 2026-11-20 with read-only calls on the public repository of this project, not on the sandbox, and that the placeholder pass wrote the numeric id as `1`. Add a helper such as `labelCall(name)` next to `edit()`, and give the label answers to the existing move tests so that they still pass. Replace the test "refuses a missing label with exit 1 and the command that creates it": a repository without "in progress" now refuses with exit code 1 and the message `gh label create "in progress" --repo github.com/example-owner/example-repo`, and the fake records no `issue edit` call. Add a case where the label check answers exit code 4, and check that the move exits with 4 and runs no edit. For the rule that refuses a missing label to add, comment out that check on purpose, run the test, see it fail, then restore the code exactly.

### Unit 4: Move a GitLab ticket when only the label to add exists

- Files: `cstack/src/tracker/gitlab-glab.ts`, `cstack/test/tracker/gitlab-glab.test.ts`
- Test: `cstack/test/tracker/gitlab-glab.test.ts`: in a project that has "in progress" and no "in review", `moveState("#7", "in progress")` runs `glab issue update 7 -R <repo> --label in progress` without `--unlabel`, and resolves.
- Minimum code: In `moveState()` (line 131), keep the label check of lines 137 to 144 as a small inner function that returns true or false. Check the label to add first. When it is missing, throw today's `RefusedArgumentError` of line 141, word for word. Then check the label to remove. When it is missing, leave `--unlabel <other>` out of `glab issue update`. Rewrite the comment of line 135 so that it says why each label is checked: GitLab creates a missing label silently when an update adds it, and cstack never sends `--unlabel` for a label that does not exist.
- Refactor: none.
- Commit message: `fix(cli): move a GitLab issue when the label to remove does not exist`
- Depends on: none

Change the existing test "refuses a missing label, prints the create command and runs no update" so that "in progress" is the missing label. It then checks `glab label create --name "in progress" -R <repo>` in the message and no `glab issue update` call. This case keeps today's behaviour, so it passes before and after the code. That is expected: it is an existing test that changes its data, and its rule is proven by breaking it. Comment out the refusal of a missing label to add on purpose, run the test, see it fail, then restore the code exactly. The new case of the `Test` line fails before the code, because today's code refuses the move.

### Unit 5: Say in the ticket guide and the README which keys cstack tracker accepts

- Files: `cstack/guides/resolve-issue/ticket.md`, `cstack/test/guides/ticket-read.test.ts`, `README.md`
- Test: `cstack/test/guides/ticket-read.test.ts`: the paragraph of the ticket guide that names `cstack tracker read '<key>' --tracker <name>` also names `` `'#12'` ``, `` `12` ``, "the issue link" and `` `ABC-12` ``, and the next paragraph says that the answer holds only the key, title, body, link, state and blockers.
- Minimum code: Change `cstack/guides/resolve-issue/ticket.md` in the three places that `## Decisions` gives, word for word. Then run `cstack/test/skill-size.test.ts` and check that it passes. In `README.md`, change only the `cstack tracker` paragraph (line 69). After the sentence about single quotes, add these sentences: "On GitHub and GitLab, a key can also be a bare number, such as `12`, or the link of an issue of the origin project. A GitLab link may end in `/-/issues/12` or in `/-/work_items/12`. Put a link in single quotes too, because zsh stops on an unquoted `?`. A link to another project is refused. On Jira and Linear, a key looks like `'ABC-12'`." After the sentence about `move`, add: "A move needs only the label that it adds. When the label that it would remove does not exist, the move adds the new label and does not fail."
- Refactor: none.
- Commit message: `docs(skill): say which ticket keys cstack tracker read accepts and what it returns`
- Depends on: none

### Unit 6: Raise the version of cstack to 0.3.2

- Files: `cstack/package.json`, `cstack/package-lock.json`
- No test: the unit changes only the version number, and `npm version` writes both files.
- Minimum code: Run `npm version 0.3.2 --no-git-tag-version` in `cstack/`. Check with `git diff` that only the version lines of the two files changed.
- Refactor: none.
- Commit message: `chore(cli): raise the version of cstack to 0.3.2`
- Depends on: none

## Documentation duties

- The `cstack tracker` paragraph of `README.md`: applies, written by unit 5.
- The ticket guide `cstack/guides/resolve-issue/ticket.md`: applies, written by unit 5.
- The README of the `gh` fixtures, `cstack/test/fixtures/gh/2.101.0/README.md`: applies, written by unit 3.
- The `cstack tracker` entries of `cstack/src/manifest.ts`: does not apply. Their usage lines say `<key>`, which stays true, and no exit code changes.
- A decision record: does not apply. The change follows ADR-SIC-F, and it adds no new choice about how cstack reaches trackers.
- The specification page `docs/projects/skills-into-cli.md`: does not apply. The page does not describe the forms of a ticket key or the status labels.
- A comment on this ticket, #80: applies, written in the document phase.
- Comments on dependent tickets: does not apply. The footer says "Feeds: none", and the tracker lists no ticket that this one blocks.

## Blocking questions

### Question 1: How the GitHub move skips a missing label
On GitHub, how should `cstack tracker move` behave when the label to remove does not exist? First way: check both labels before the edit with `gh api --hostname <host> repos/<path>/labels/<name>`, as the GitLab move already does. A missing label to add then stops the move before any edit, with today's message. A missing label to remove is left out of `gh issue edit`. Second way: keep one `gh issue edit` with both labels. When `gh` answers `'<label to remove>' not found`, run `gh issue edit <n> --add-label <label>` alone.
- For: the user
- Answer: the first way, a check of both labels with `gh api` before the edit, as recommended. Source: the user's answer ("ok go"), 2026-11-23.

### Question 2: Where the conversion of a link runs
May `checkedTracker()` (`cstack/src/tracker/checked.ts` line 10) get a fourth, optional parameter, a function that returns the `origin` remote, so that its key check turns a link or a bare number into `#<number>`? `openTracker()` and `refuseWithoutClient()` in `cstack/src/tracker/open.ts` (lines 59, 89, 110 and 111) would pass it, and it would read `origin` only when the key is a link.
- For: the user
- Answer: yes, an optional fourth parameter, wired in `openTracker()` and in `refuseWithoutClient()`, as recommended. Source: the user's answer ("ok go"), 2026-11-23.

### Question 3: The text of the refusal messages and of the key hint
Are these texts right? A refused GitHub or GitLab key: `"<value>" is not a valid gitlab ticket key. Write it as '#12', as 12, or as the link of an issue of this project.` For Jira and Linear, the end becomes `Write it as 'ABC-12'.` A refused link: `cstack only reads the issues of <host>/<path>, the origin project, and <link> is not the link of one of its issues. Write the key as '#12'.` The hint for a missing key (`KEY_HINT`, `cstack/src/commands/tracker-common.ts` line 18) keeps its sentence and gains `You can also write 12, or the link of the issue in single quotes.` The message of `cstack wave` (`cstack/src/wave/names.ts` line 6) keeps today's text.
- For: the user
- Answer: yes, these texts, as recommended. Source: the user's answer ("ok go"), 2026-11-23.

## Review log

Impact notes. The functions of `keys.ts` that the branch added have no other caller than `checked.ts`. `isValidKey()` did not change, so its other callers (`blockers.ts`, `claude-file.ts` and the Jira and Linear adapters) behave as before. `checkedTracker()` is called in `open.ts` only, and Jira and Linear get no origin function on purpose. Two tests, the fake `gh` and the public-text check had to learn the new behaviour, and they were fixed in the test commit.

Correctness review: no finding. It noted three small things. The link rule does not call `isValidUrl()`, which cannot let a bad value through because only `#<number>` comes out. A self-hosted GitLab over plain `http://` refuses every link. The key hint also shows on Jira and Linear. All three follow the approved decisions, so I changed nothing.

Security review: no finding. Only `#<number>` reaches `gh` or `glab`, and the label names are fixed strings. Error messages hide user information.

Conventions review: no finding. The only note was that the test suite is red between the commit of unit 3 and the test fix commit. The final tree is green, so I left it.

Simplicity review: six suggestions, none applied. Replacing the two label checks by one edit call, and keeping the original origin error, would go against decisions the user approved in questions 1 and 3. The version bump is unit 6 of the plan. The change of the ticket guide text is given word for word in the decisions.

Independent review: no bug, no security problem and no broken convention. It changed nothing. The type check and the full `npm test` pass. It raised three judgment calls for the pull request. First, on GitHub any HTTP 404 from the label check reads as "label missing", so a repository that `gh` cannot see gives a misleading message. Second, a clone whose origin uses an SSH host alias refuses every link, so the user writes `'#12'`. Third, the test fix commit uses the scope `test(cli)`, which differs from an older commit.

## Briefing

### What you should know about what was built

`cstack tracker read`, `move`, `comment` and `list --epic` now accept `12` and the link of an issue of the `origin` project, as well as `'#12'`. A link to another project, a pull request or a merge request is refused, and the message names the `origin` project. On GitHub and GitLab, a move now needs only the label that it adds. The build does what the ticket asked: each acceptance line has its test, and I ran the type check and the 248 tracker and guide tests again myself, all green.

**What you need to do.**

1. When the pull request is open, you merge it yourself, and you push no tag. The tag `v0.3.2` starts the release, which checks that the tag matches the version in `cstack/package.json`. The coordinator pushes it once the pull request of the ticket that makes `cstack publish` refuse the home folder path (#79) is merged too.
2. Install `cstack` 0.3.2 from that release before the next comparison measure. The decision to continue (ADR-SIC-G) wants both fixes in the measured version, and the installed version here is still 0.3.1.

**What to watch.**

1. Nobody ran the real `glab`, so the GitLab move is tested only with hand-written answers. At the first real move on GitLab, such as in the next measure, check that the ticket shows "in progress" and that no "in review" label appeared.
2. On GitHub, any 404 answer to the label check reads as "the label does not exist". If the `gh` account cannot see the repository, the message says to create the label instead of talking about access. If someone reports that message while the label exists, this is the cause.

**What changed since the plan.**

One existing test used `12` as a bad key, and the fake `gh` had no answer for the label check. A separate test commit fixes both. So the commit of the GitHub move, taken alone, has a red test suite.

#### Details

The build matches the approved plan. The conversion lives in `cstack/src/tracker/keys.ts` (`looksLikeLink()`, `keyOfNumber()`, `keyOfLink()`, `keyForms()`), and `checkedTracker()` in `cstack/src/tracker/checked.ts` takes the optional fourth parameter `origin` and checks every converted key with `isValidKey()`, which did not change. `openTracker()` passes `readOrigin` to the file, `gh` and `glab` branches, and `refuseWithoutClient()` passes `() => originRepo(options.run, options.root)` (`cstack/src/tracker/open.ts`). Both forge moves check the label to add first, refuse with today's message when it is missing, and leave the label to remove out of the edit when it is missing (`cstack/src/tracker/github-gh.ts` `moveState()`, `cstack/src/tracker/gitlab-glab.ts` `moveState()`). On 2026-11-23 I ran `npm run typecheck` and `npx vitest run test/tracker test/guides test/skill-size.test.ts` in `cstack/`: the type check passed, and 32 files with 248 tests passed. The full `npm test` result (1505 tests) comes from the executor and the independent review, and I did not run it again.

The merge and the tag are actions only the user can take, as the decisions of the run say: the user merges, and the coordinator pushes `v0.3.2` after #79 and #80 are both merged. `.github/workflows/release.yml` runs on a tag that starts with `v` and fails when the tag differs from the version in `cstack/package.json`. Only this branch raises the version, so a tag pushed before this branch is merged would fail the release. The recent merges on `main` (for example `eb7cc03`) are merge commits, so the usual merge button fits. A merge commit keeps the red intermediate commit described below in the history of `main`, and a squash would hide it. Neither choice changes the code. Default if nobody decides: the usual merge commit.

Installing 0.3.2 before the next measure matters because `docs/decisions/ADR-SIC-G-continue-or-stop.md` line 95 says that #79 and #80 ship before the next measure. Agents in this run may not install `cstack` globally, so only the user can do it. Default if nobody does it: the next measure runs on 0.3.1 and loses calls on the same two problems again.

The GitLab move was never run against a real GitLab, because the run never runs `glab`. The tests in `cstack/test/tracker/gitlab-glab.test.ts` use the hand-written fixtures of `cstack/test/fixtures/glab/1.119.0/`. The risky case is the label check: when `glab api .../labels/<name>` answers in a way that the `\b404\b` test does not match, the move fails through `forgeFailure()` instead of skipping the label. A failure is loud, not silent, so the fallback is a visible error, not a wrong label. GitLab also looks labels up by their exact title, so a project whose label is "In Progress" would be refused, as it was before this ticket.

On GitHub, `moveState()` treats exit code 1 with `HTTP 404` as a missing label. GitHub also answers 404 for a private repository that the token cannot see. The independent review raised the same point in `## Review log`. The message then tells the user to run `gh label create`, which fails with its own 404, so the user finds the real cause on the next step. I do not recommend a change in this branch, because question 1 of the round approved this check, and the case needs a logged-in `gh` that cannot see the repository it works in.

Between commit `11642d2` (the GitHub move) and commit `446fde5` (the test fix), the full test suite is red. `446fde5` updates `cstack/test/e2e/bin/gh` with an answer for the label check, adds `api.github.com` to the allowed hosts of `cstack/test/helpers/fixtures-public.ts`, and changes `cstack/test/tracker/claude-file-fallback.test.ts` to use `12abc` as a bad key, because `12` is now valid. The conventions review accepted this. The only cost is a `git bisect` that lands on one of those commits. The allowed host is a public GitHub host, so the public-text check keeps its purpose.

All earlier questions are resolved as answered. Question 1 (how the GitHub move skips a missing label) is built as the check of both labels with `gh api` before the edit. Question 2 (where the conversion runs) is built as the optional fourth parameter of `checkedTracker()`, wired in `openTracker()` and in `refuseWithoutClient()`. Question 3 (the texts) is built word for word: the key refusal, the link refusal, the missing-origin refusal and the second sentence of `KEY_HINT` match `## Decisions`. The questions accepted by default are built too. `list --epic` accepts the new forms. A link may end with `/`, a query or a fragment. `move` and `comment` print the key as typed. GitLab leaves out `--unlabel` for a missing label. A link given with `--from-file` in a clone without `origin` exits with 1.

I found no new question. Two small limits stay, and neither needs an answer. First, a clone whose `origin` uses an SSH host alias, such as `git@github-alias:owner/repo.git`, refuses every link. That clone already fails to reach `gh` with that host name, so the link rule adds nothing new there. Second, an https `origin` that writes the default port, such as `https://github.com:443/...`, would refuse every link, because `new URL()` drops a default port, while the `Remote` may keep it. The user then writes `'#12'`. The key hint also shows on Jira and Linear, as the correctness review noted.

I checked security and isolation between projects (only `#<number>` reaches `gh` or `glab`, and a link to another project is refused before any program runs), scale (two read calls more per move), hidden coupling (`isValidKey()` is unchanged, so the footer parser, the file reader and `cstack wave` keep today's rule), the data model, reversibility, and operations and cost, and found nothing else to raise.

## Non-blocking questions

none

## Pull request

Title: feat(cli): accept a ticket link in cstack tracker and move a ticket that has one status label

````markdown
This change lets `cstack tracker` take a ticket key in three forms on GitHub and GitLab, and lets `cstack tracker move` work in a project that has only one status label.

You can now write `'#12'`, the bare number `12`, or the link of an issue of the origin project. A GitLab link may end in `/-/issues/12` or in `/-/work_items/12`. Each form becomes `#12` before it reaches `gh` or `glab`. A link to another project, another host, a merge request or a pull request is refused, and the message names the origin project. Jira and Linear keep their own key form.

A move now needs only the label that it adds. When the label that it would remove does not exist, the move adds the new label and does not fail. When the label to add does not exist, the move stops before any edit and prints the command that creates it. The GitHub move checks both labels with `gh api` first, as the GitLab move already did. I chose this with the maintainer because it keeps one rule for both forges.

The conversion is a pure function in `cstack/src/tracker/keys.ts`. `checkedTracker()` gets an optional fourth parameter that reads the origin remote, and it reads the remote only when the key is a link. I also updated the ticket guide, the README paragraph for `cstack tracker`, and the fixtures README, and raised the version to 0.3.2.

Three judgment calls from the independent review. On GitHub, any HTTP 404 from the label check reads as "label missing", so a repository that `gh` cannot see gives a misleading message. A clone whose origin uses an SSH host alias refuses every link, and the user writes `'#12'`. The test fix commit uses the scope `test(cli)`.

The type check and the full test run pass, with 1505 tests. The plan is in `docs/plans/2026-11-20-80-accept-a-ticket-link-in-cstack-tracker-and-move-a-ticket-that-has-one-status-label.md`.

Fixes #80
````

## Documentation

- A comment on ticket #80 (https://github.com/gambitl/claude-code-stack/issues/80), posted with `cstack tracker comment`.
- `README.md`, the `cstack tracker` paragraph, written by unit 5.
- `cstack/guides/resolve-issue/ticket.md`, written by unit 5.
- `cstack/test/fixtures/gh/2.101.0/README.md`, written by unit 3.
- No decision record and no dependent ticket comment, as the documentation duties say.

## Executor notes

- `cstack helper start implementer` for unit 3 started a worker for units 3, 4, 5 and 6 in a loop whose output I piped to `grep`, and the loop exited with 1. I started unit 3 a second time, so two workers reported for it. Both reports succeeded and no file was damaged.
- The first full `npm test` showed nine failures: the fake `gh` of the end-to-end tests had no answer for `gh api .../labels/...`, the public-text check did not know the `api.github.com` host of the new fixture, and one test used `12` as a bad key. A second commit fixed these three causes, and the second full run passed (1505 tests).
- One end-to-end failure said `This is not a helper id. It looks like 20261119-143205123-executor`. It disappeared in the second run, so I think it came from the outer cstack run that I work inside.

## Hand-off log

- 2026-11-23: Executor moved ticket #80 to "in progress" with `cstack tracker move`. The branch `gambitl/tracker-links` was already checked out.
- 2026-11-23: Executor built units 1 to 6 (commits c3c1633, 302dfed, 11642d2, b7bffe7, b8f7b48, 1d824f2) and added one test fix commit. The type check and the full `npm test` pass.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

1. **On GitHub, the move checks both labels with `gh api` before it edits the ticket.** The other way keeps one `gh issue edit` and runs it again without `--remove-label` when `gh` says the label to remove does not exist. But that way still sends an edit when the label to add is missing, and the acceptance says the fake program then receives no edit. I recommend the check before the edit. Both forges then follow the same rule, for two small read calls per move.
2. **`checkedTracker()` gets a fourth, optional parameter that reads the `origin` remote only when the key is a link.** The conversion needs the origin project, and `checkedTracker()` does not know it today. There is a trap: `refuseWithoutClient()` builds its own checked tracker. If we forget it, `move <link>` with no logged-in client exits with 1 instead of 4. I recommend the optional parameter, wired in `openTracker()` and in `refuseWithoutClient()`. So `open.ts` stays the one place that puts the checks, and the tests that pass three arguments do not change.
3. **The exact text of the refusal messages and of the key hint.** The ticket says what they must say, so here is the text. A refused GitHub or GitLab key: `"<value>" is not a valid gitlab ticket key. Write it as '#12', as 12, or as the link of an issue of this project.` For Jira and Linear, the end becomes `Write it as 'ABC-12'.` A refused link: `cstack only reads the issues of <host>/<path>, the origin project, and <link> is not the link of one of its issues. Write the key as '#12'.` The hint for a missing key gains one sentence: `You can also write 12, or the link of the issue in single quotes.` I recommend these texts. The message of `cstack wave` keeps today's text, because `cstack wave` does not accept the new forms.

**I will do this unless you say no.**

- `cstack tracker list --epic` also accepts a link and a bare number. This differs from the draft. The conversion lives in the one key check, and leaving `list` out would need a second code path.
- A link may end with `/`, a query or a fragment such as `#note_5`. Anything else after the number is refused.
- `move` and `comment` print the key as the user typed it.
- On GitLab, the move leaves out `--unlabel` when the label to remove does not exist, instead of relying on GitLab to ignore it.
- With `--from-file` in a clone without `origin`, `12` and `'#12'` work, and a link is refused with exit code 1.

**I checked it myself.**

- No test checks today's text of the key refusal, so changing it breaks only the new tests.
- The answers of `gh api` 2.101.0 for a label were checked read only on this public repository: exit 0 and JSON when the label exists, exit 1 and `HTTP 404` when it does not, and the lookup ignores case.

**Good to know.**

- In zsh, an unquoted link that holds `?` fails with `no matches found` before cstack even starts. The README and the hint must say to quote the link.
- The ticket guide can grow by 7 words at most, so its new text must replace words.

#### Details

The way the GitHub move skips a missing label is a blocking question for the user. No test can settle it, because it is a design choice. The draft's first way calls `gh api --hostname <host> repos/<path>/labels/<name>` for both labels, with the name passed through `encodeURIComponent`, then runs `gh issue edit` with `--remove-label` only when that label exists. The second way keeps today's single call (`cstack/src/tracker/github-gh.ts` line 156) and retries without `--remove-label` when the error names the label to remove. I reject the second way because a missing label to add still produces one `gh issue edit` call, which breaks the acceptance line "the fake program never receives an update" applied to GitHub. It also depends on parsing the error text of `gh` twice, and the fixture README says that text names only the first missing label. The draft also argues that `gh` may change one label before it refuses the edit. I could not confirm that: as far as I know, `gh issue edit` turns label names into ids before it sends any change, so a missing label fails before any write. The recommendation does not rest on that argument. Default if nobody decides: the first way, as the draft recommends.

The place where the conversion runs is a blocking question for the user, because it changes the signature of a function that the ticket names. `checkedTracker(adapter, name, warn)` (`cstack/src/tracker/checked.ts` line 10) has no access to the origin remote, and a link needs it. The proposal is a fourth parameter, an optional function that returns the origin `Remote`. The inner `key()` becomes async, converts a bare number or a link into `#<number>` for GitHub and GitLab only, and then checks the result with `isValidKey()` as today (line 12). The pure conversion lives in `cstack/src/tracker/keys.ts` and takes the `Remote` as an argument, so its tests need no runner. `openTracker()` passes its `readOrigin` (`cstack/src/tracker/open.ts` line 86) for the `gh` and `glab` branches (lines 110 and 111). The file branch (line 89) passes a getter that calls `originRepo()` only when the key is a link, which keeps the comment on lines 29 to 31 true. `refuseWithoutClient()` (line 59) must pass the same getter. Without it, a link given to `move` or `comment` when no client is logged in would exit with 1 ("not a valid key") instead of 4, which breaks the order that its comment on lines 49 and 50 promises. I rejected a conversion inside each command, because the commands would need the tracker name before `openTracker()` resolves it, and they would read the origin twice. Default if nobody decides: the optional parameter.

The wording of the messages is a blocking question for the user, because the ticket fixes what these messages say. The texts are in the short version. The key refusal must not depend on the origin, because the file branch and `refuseWithoutClient()` may not have read it. So it says "this project" and does not name the host. The link refusal goes through `redact()` (`cstack/src/publish/remote.ts` line 30) and `printable()` (`cstack/src/tracker/checked.ts` line 62), as `## Decisions` already says. `KEY_HINT` (`cstack/src/commands/tracker-common.ts` line 18) keeps its first sentence and gains one. `cstack/src/wave/names.ts` line 6 keeps its own copy of today's message on purpose, because `cstack wave` keeps today's key rule. A search of `cstack/test`, `cstack/guides` and `cstack/skills` for "is not a valid" finds no test or guide that quotes the key refusal, so no existing test breaks. Default if nobody decides: the texts above.

Whether `cstack tracker list --epic` accepts the new forms is a non-blocking question. The draft said no. I prefer yes, because `listGroup` calls the same `key()` (`cstack/src/tracker/checked.ts` line 43), and keeping the old rule there needs a second key function in the checked tracker. On GitHub and GitLab an epic is an issue of the same project, so a link to it is a natural input. The acceptance does not change either way.

The other draft questions are all non-blocking, and I keep their recommendations. A link with a trailing slash, a query or a fragment is accepted. `move` and `comment` print the key as typed, at `cstack/src/commands/tracker-move.ts` line 29 and `cstack/src/commands/tracker-comment.ts` line 87. The GitLab move leaves out `--unlabel` for a missing label, because this run cannot run `glab` to see what it does with an unknown label. With `--from-file`, cstack reads `origin` only when the key is a link.

The answers of `gh api` for a label were checked by the run on 2026-11-20, read only, on this public repository, and `## Decisions` records them. I checked that record against the draft text and they agree. The new fixture follows the naming rule in `## Decisions`.

An unquoted link is a trap in zsh. The maintainer's shell is zsh, where an unquoted word that holds `?` or `*` is a glob pattern. With no match, zsh stops with `no matches found` and never starts the program. A link copied from a browser often carries `?` or `#`, and an unquoted `#` starts a comment in both bash and zsh. So the README paragraph (`README.md` line 69) and the hint should tell the reader to put a link in single quotes, as they already do for `'#12'`.

The ticket guide has a word budget. `cstack/test/skill-size.test.ts` lines 41 to 44 leave 7 words of room in `cstack/guides/resolve-issue/ticket.md`, as `## Decisions` records. `cstack/guides/resolve-issue/build.md` line 7 still tells the reader to quote `#12`, which stays correct, so it needs no change in this ticket.

I checked security and tenant isolation (a link to another project is refused before any program runs, and only `#<number>` reaches `gh` or `glab`), scale (two read calls more per move), the data model, reversibility, operations and cost, and found nothing else to raise.

### Open questions and answers

1. Blocking question 1. Recommended answer: the first way, a check of both labels before the edit. Both forges then follow the same rule in the same order, and a missing label to add stops the move before any change. The acceptance asks that the fake program "never receives an update" when the label to add is missing, and the second way still sends one edit that `gh` refuses. As far as I know, `gh` resolves the two labels in parallel, so a refused edit may already have changed one of them. The cost is two small read calls per move, and a run moves its ticket twice. I checked the answers of `gh api` 2.101.0 on this public repository, read only, on 2026-11-20. `gh api --hostname github.com repos/<owner>/<repo>/labels/in%20progress` exits with 0 and prints the label as JSON. The same call with `In%20Progress` finds the same label, so the lookup ignores case. A label that does not exist exits with 1 and prints `gh: Not Found (HTTP 404)` on standard error. I did not test `gh issue edit` with a missing label to remove, because it would change a real issue. The recorded answer `cstack/test/fixtures/gh/2.101.0/issue-edit.missing-label.txt` already shows that `gh` refuses the whole command with exit code 1.
2. Non-blocking. Should a link with a trailing `/`, a query such as `?foo=1`, or a fragment such as `#issuecomment-5` or `#note_5` be accepted? Recommended answer: yes, because it still names the same issue, and a link copied from a browser often carries a fragment. Anything else after the number is refused.
3. Non-blocking. Should `cstack tracker list --epic` accept a link or a bare number too? Recommended answer: no. The ticket names `read`, `move` and `comment` only, so the epic key keeps today's check.
4. Non-blocking. Should `move` and `comment` print the key in the `#12` form when the user gave a link? Recommended answer: no. They keep printing the key as the user typed it (`cstack/src/commands/tracker-move.ts` line 29 and `cstack/src/commands/tracker-comment.ts` line 87), so no message changes beyond what the ticket asks.
5. Non-blocking. On GitLab, should the move keep asking whether the label to remove exists? Recommended answer: yes, and it leaves out `--unlabel` when that label is missing, instead of relying on GitLab to ignore an unknown label. I cannot check what `glab issue update --unlabel` does with an unknown label, because this run never runs `glab`. The hand-written fixture `issue-update.ok.txt` already covers an update with `--label` only.
6. Non-blocking. What happens to a link with `--from-file` in a clone without an `origin` remote? Recommended answer: cstack reads `origin` only when the key is a link. Without `origin`, it refuses the link with exit code 1 and asks for the `'#12'` form. A bare number and `'#12'` still work without `origin`.

Answers of the round, 2026-11-23. Blocking questions 1, 2 and 3 were answered by the user with "ok go", which accepts each recommended answer. The advisor added Blocking questions 2 and 3. Question 2 above: accepted by default. Question 3 above changed after the advisor's review: `cstack tracker list --epic` accepts the same forms, because `listGroup` calls the same `key()` (`cstack/src/tracker/checked.ts` line 43); accepted by default. Questions 4, 5 and 6 above: accepted by default.

### Architecture options
