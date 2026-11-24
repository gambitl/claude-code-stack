# Plan: #97 — R2-3: Move the setup command of a new workspace to an Orca setup hook

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-24
Ticket: https://github.com/gambitl/claude-code-stack/issues/97
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/orca-setup-hook
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-24T11:17:25+01:00
Ready for review at: not yet

## Ticket

### Why this matters (plain language)

**In plain terms:** Stop `cstack` from carrying the command that installs the packages of a new workspace, and let Orca run it when it creates the workspace.

- **What the title means**: A workspace is a second working folder of the same git repository. A new one has no installed packages, so a command such as `npm ci` must run first. Today the settings file of `cstack` has a key, `setupCommand`, for that command. Orca, the desktop app that runs several coding agents side by side, can run a setup hook of its own when it creates a workspace.
- **Why we are doing it**: Everything that Orca already does leaves `cstack`. `setupCommand` only served the child worktrees of parallel implementers, which no longer exist.
- **For the user**: A new workspace of a ticket gets its packages from Orca, before Claude starts working in it.

**Goal.** This ticket removes the `setupCommand` key from `cstack` and from the settings of this repository, and it declares `cd cstack && npm ci` as the Orca setup hook of this repository.

### Where things are today (read first)

* **The key**: `cstack/src/settings.ts` declares `setupCommand` (line 43), sets its default (line 63), mentions it in a comment (line 106) and checks it (lines 274 and 275). `cstack` never runs it. Only the helper code that #95 removes read it.
* **The refusal of unknown keys**: `cstack/src/settings.ts` → `unknownKeys()` (lines 88 to 97) refuses an unknown key and names it (line 93). After this ticket, a settings file that still holds `setupCommand` is refused.
* **Its tests**: `cstack/test/settings.test.ts` (lines 66, 80, 227 to 233 and 286 to 305) and `cstack/test/next-settings.test.ts` (lines 55 and 67).
* **The README**: `README.md` (line 60) describes the key.
* **This repository**: `.cstack/settings.json` (line 7) holds `"setupCommand": "cd cstack && npm ci"`, added by commit `a88c5f5`. `CLAUDE.md` says that a new worktree has no `node_modules`, so `npm ci` runs there before the first test.
* **Orca**: `orca worktree create` and `orca orchestration worker-start` take `--setup run|skip|inherit`. Orca's own guide says that this option "controls repo setup hooks", and that the default `inherit` "follows the repo's setup policy". Nobody has checked yet where a repository declares its setup hook. This repository has no `orca.yaml` file.
* **The settings rules**: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` explains the settings file and its keys.

### Scope

1. Find where Orca declares the setup hook of a repository: a file in the repository, such as `orca.yaml`, or the repository settings of the app. Write the answer in this ticket and in the README.
2. Declare `cd cstack && npm ci` as the setup hook of this repository. Prefer a file in the repository when Orca allows it, so that the hook is versioned and reviewed.
3. Remove `setupCommand` from `cstack/src/settings.ts`, from its tests and from the README.
4. Remove `setupCommand` from `.cstack/settings.json` in the same commit, because the new `cstack` refuses the key.
5. When the conventions file needs a sentence about the Orca setup hook, propose it in the plan.

### Acceptance (TDD)

* `cstack/test/settings.test.ts`: write first a case where a settings file with `setupCommand` is refused, and the message names the key. It fails on today's code, which accepts the key. Then make it pass.
* `.cstack/settings.json` holds no `setupCommand`, and `cstack next` reads it without an error.
* A new Orca workspace of this repository gets `cstack/node_modules` from the hook. Check it once by hand, and write the result in the ticket.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #95 · Feeds: #104

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**An open question of the epic that this ticket answers.** The epic says: "Orca runs the setup hooks of a repository when it creates a workspace. Nobody knows yet where those hooks are declared. By default, the ticket of US-3 finds out." This ticket is that ticket.

The ADRs that this block names now all exist:

- [ADR-RQG-A: helpers and units inside a ticket](../decisions/ADR-RQG-A-helpers-and-units-inside-a-ticket.md), which #93 wrote. It replaces [ADR-SIC-A: helpers](../decisions/ADR-SIC-A-helpers.md).
- [ADR-RQG-B: plan format version 2](../decisions/ADR-RQG-B-plan-format-version-2.md), which #98 wrote.
- [ADR-RQG-C: expected steps of a run](../decisions/ADR-RQG-C-expected-steps-of-a-run.md), which #86 wrote.

The ticket also names [ADR-SIC-D: settings file and review model](../decisions/ADR-SIC-D-settings-file-and-review-model.md), which explains the settings file and its keys.

**Rules of the specification for every story** (`docs/projects/refocus-and-quality-guards.md`, section 4, "Rules for every story"). No story adds a `cstack` command that starts an agent, waits for it, sends it a message, or watches the tracker. Inside a ticket, Claude Code starts its helpers as sub-agents, as the skill guides it. When the settings file of the repository names another agent than Claude for the independent review, that helper runs as an Orca worker, because only Orca can start another agent. The units of a ticket run one after the other, and each unit runs in a sub-agent, in the workspace of the ticket. Every `cstack` command works without Orca. A change to a phase guide also updates the block of mandatory steps of that guide.

**The story that this ticket carries in part.** The specification lists it in section 4, under "US-3: Remove the orchestration layer from cstack". #93 carried the guides and the prompts, and #95 carried the commands. This ticket carries the `setupCommand` setting and the Orca setup hook.

- AC6: The settings key `setupCommand` leaves the code and the `.cstack/settings.json` file of this repository in the same change, because `cstack` refuses a settings file with an unknown key.
- AC7: This repository declares `cd cstack && npm ci` as an Orca setup hook instead. Orca runs the setup hooks of a repository when it creates a workspace. The ticket finds where Orca declares such a hook and writes it down.

## Dependencies

clear. The only blocker, #95, is closed and merged into `main` by pull request #127.

## Code mapping

The map below was made on 2026-11-24 from `main` at f34b586. Line numbers are those of that commit. Some line numbers of the ticket moved since it was written, and the map gives the current ones.

**Where Orca declares the setup hook.** Orca reads a file `orca.yaml` at the root of the repository. The key `scripts.setup` holds the setup script, and Orca runs it in each new worktree when setup is enabled. Orca's public documentation page `docs/site/content/docs/model/orca-yaml.mdx` in the repository `stablyai/orca` says so, and Orca's own repository has an `orca.yaml` with `scripts.setup` at its root. The guide that `orca skills get orca-per-workspace-env` prints (Orca 1.4.272) names "the `orca.yaml` setup script" and `scripts.setup` too. These facts from that documentation page matter here:

- Orca reads the setup script from the `orca.yaml` of the new worktree, so it follows the branch that the new worktree checks out. A worktree made from a branch without the file gets no setup.
- The setting **Settings → Repository** of the Orca app decides whether setup runs: automatically, after asking, or never. A new repository runs setup by default. `--setup run|skip|inherit` on the command line overrides it, and `inherit` follows that setting.
- A second setting, "Command source & orca.yaml", chooses between the hook of `orca.yaml` and a local hook typed in the app. When nothing is saved and the local hook is empty, Orca uses only the hook of `orca.yaml`.
- A valid `orca.yaml` does not skip Orca's approval of a shared command. The first time, Orca asks the user to trust the script, and it can reuse that trust later.
- On macOS, Orca runs the script in a "Setup" terminal, as a Bash script with `set -e`.
- The key `setupAgentStartupPolicy` takes `start-immediately` (the default) or `wait-for-setup`. With `wait-for-setup`, the agent starts only after the setup succeeded. With the default, the agent starts beside the setup.
- Unknown keys do nothing, and invalid YAML or a duplicate key makes Orca ignore the whole file.

`orca repo show --json` for this repository says that its app settings are `setupRunPolicy: run-by-default`, `setupAgentStartupPolicy: start-immediately`, and an empty local setup script. So the user has nothing to change in the app for the hook of `orca.yaml` to run. This repository has no `orca.yaml` and no `.worktreeinclude` today.

**The key `setupCommand` in `cstack/src/settings.ts`.** The type `SettingValues` declares it at line 43 and `DEFAULTS` sets it to `undefined` at line 63. Line 106 names it in the comment of `checkTestCommand()`, whose `isFile` value `null` serves only `setupCommand`. Lines 295 to 297 check it. No code of `cstack/src/` reads `values.setupCommand` any more. `settingsBlock()` in `cstack/src/settings-block.ts` (line 8) prints one line per key of `DEFAULTS`, so the line `- setupCommand: ...` that `cstack next` prints leaves by itself.

**The key `watchIntervalMinutes` in `cstack/src/settings.ts`.** The type declares it at line 45, `DEFAULTS` sets it to 5 at line 67, and lines 313 to 317 check it. No code of `cstack/src/` reads it since `cstack wave` left with #95.

**The refusal of an unknown key.** `TOP_KEYS` (line 70) is `version` plus the keys of `DEFAULTS`. `unknownKeys()` (lines 88 to 97) pushes the problem with the text `unknown key. Allowed keys here: <keys>. If this key comes from a newer cstack, update cstack.` (lines 93 and 74). So once the two keys leave `DEFAULTS`, a file that holds either of them is refused with that text. `cstack next` prints it as `cstack: <key>: unknown key. ...` on standard error and exits with 3 (checked with the installed 0.3.2 on a key `setupCommandX`). The hint "If this key comes from a newer cstack" is wrong for a key that an older `cstack` accepted.

**The version rule of the settings file.** `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`, line 30, says: "A new key keeps version 1. A key that is renamed, removed or changed in meaning moves the format to version 2." The comment of `cstack/src/settings.ts`, lines 11 and 12, says the same. The reader accepts only `"version": 1` (line 215 and 216). The installed `cstack` 0.3.2 refuses any other version. So a move to version 2 would make every run of this machine refuse the settings file of `main`, and the brief allows no other change in `.cstack/settings.json`. This conflict is a governing decision for the question round.

**The tests of the settings.** `cstack/test/settings.test.ts` names `setupCommand` at lines 66, 80, 255, 261 and in the block "setupCommand" (lines 314 to 335). It names `watchIntervalMinutes` at lines 68, 82, 105, 109, 110 and in the case "refuses watchIntervalMinutes %s" (lines 125 to 129). Lines 105 and 109 to 110 use `watchIntervalMinutes` only as a sample of a wrong type, so they need another key. The case "the example settings file" (lines 253 to 264) checks that the template `cstack/skills/resolve-issue/templates/settings.json` equals `DEFAULTS` and holds every key except `testCommands`, `setupCommand` and `review`. The template holds `"watchIntervalMinutes": 5` at line 7. `cstack/test/next-settings.test.ts` lists the printed keys at lines 49 to 58 and checks `- setupCommand: not set (default)` at line 67. No other test file, fixture, guide or agent prompt names either key.

**The argument `hasWorktree` of `readyState()`.** `cstack/src/tracker/ready.ts`, line 11, declares `readyState(ticket: Ticket, hasWorktree: boolean)`, and line 14 reads it. Its only caller, `keepReady()` in `cstack/src/commands/tracker-list.ts` (line 48), passes `false`. `cstack/test/tracker/ready.test.ts` passes `true` at lines 38 and 59, and `false` everywhere else. The case "calls a ticket in progress or with a worktree started" (lines 36 to 39) tests the argument. `tracker-list.ts` is not in the file list of the brief.

**The field `readAt` of `SavedReport`.** `cstack/src/run-state.ts`, lines 47 and 48, declares the optional field and its comment. No code of `cstack/src/` or `cstack/test/` reads or writes it since #95 removed `takeOldestUnreadReport()`. A report file written by an older `cstack` may still hold it. `readReports()` in `cstack/src/report/reports.ts` (line 156) casts the parsed JSON, so an extra field is ignored. The format version of ADR-SIC-B covers `state.json` and the plan file, not the shape of a report file, and no reader checks that field. So the removal changes no format.

**The README.** `README.md` no longer names `setupCommand` or `watchIntervalMinutes`. Commit 6a4dd9d of #95 removed the sentence about `setupCommand` with the paragraph of `cstack helper start`. The ticket says line 60, but that line is gone. The README has no paragraph that lists the keys of the settings file. The Orca line of "## Requirements" is line 16. Line 67, a paragraph of #95, says which commands left `cstack`. So the answer of where Orca declares the hook needs a new paragraph.

**The conventions file.** `CLAUDE.md`, line 20, says: "A new worktree has no `node_modules`, so run `npm ci` there before the first type check or test run." Scope item 5 asks the plan to propose a sentence about the Orca setup hook.

**This repository's settings.** `.cstack/settings.json` holds `version`, `testCommands` and, at line 7, `"setupCommand": "cd cstack && npm ci"`. It holds no `watchIntervalMinutes`. Line 6 ends with a comma, so removing line 7 also removes that comma.

**The continuous integration.** `.github/workflows/ci.yml` runs `npm ci` itself in `cstack/` and never reads the settings file. The follow-up of #102 changes that file in this wave, so this ticket does not touch it.

**History and risk.** `cstack/src/settings.ts` changed in 8 commits, always with `cstack/test/settings.test.ts`. Commit 0120f03 added `setupCommand`. The settings reader is read by `next.ts`, `publish.ts`, `unit-commit.ts`, `audit.ts` and `unit-test-command.ts`, but they read only `testCommands`, `commitAttribution` and `review.agent`. `cstack/src/tracker/ready.ts` has one commit. The risk of the ticket is outside the code. Once merged, `cstack` from `main` refuses every settings file that still holds either key, including files copied from the old template. And a new workspace gets its packages only from Orca, so a workspace made from a branch without `orca.yaml`, or with the setup skipped, has no `node_modules`.

**Governing decisions.** ADR-SIC-D (line 30) sets the version rule of the settings file. ADR-SIC-B (line 47) says that a change of the plan or run state format needs a new version number. The removal of `readAt` changes neither. `cstack/src/run-state.ts` (line 1) has a `WHY:` comment that points to ADR-SIC-B. The only other `WHY:` comment of the files to change is `cstack/src/settings.ts`, line 174, about reading a pipe, which this ticket does not touch. The rules of epic #84 say that every `cstack` command works without Orca, which stays true: `orca.yaml` is read by Orca, never by `cstack`.

## Decisions

- Remove `watchIntervalMinutes` together with `setupCommand`, from `cstack/src/settings.ts`, from its tests and from the settings template `cstack/skills/resolve-issue/templates/settings.json` (line 7). Its only reader, `cstack wave --watch`, left with #95, and `cstack` would refuse every settings file copied from a template that still holds it. (2026-11-24, from the comments of the #95 run on the ticket and the brief of the run)
- Remove the argument `hasWorktree` of `cstack/src/tracker/ready.ts`, which only `cstack wave` set, and the field `readAt` of `SavedReport` in `cstack/src/run-state.ts`, which only `cstack report check` wrote, with their tests. (2026-11-24, from the comment of the #95 run on the ticket and the brief of the run)
- Since #95, `cstack helper start` is gone, so no `cstack` command sets up a new workspace any more. The Orca setup hook is the only place for that setup. The fake Orca in `cstack/test/e2e/bin/orca` answers only `--version`, `status --json` and `agent-context --json`, so a test that needs more must add the answer. (2026-11-24, from the comment of the #95 run on the ticket)
- This ticket is the one exception to the rule that a branch never changes `.cstack/settings.json`. It removes `setupCommand` from that file in the same commit as the code that refuses the key, and it changes nothing else in that file. (2026-11-24, from the brief of the run)
- To find where Orca declares its setup hook, read Orca's help and guides, for example with `orca --help` or `orca skills get orca-cli`. Never run `orca orchestration`, `orca worktree create` or `orca worktree rm`. If the hook lives in the settings of the Orca app and not in a file of the repository, do not change the app: the plan says what the user must do there, and the question round puts it to the user. (2026-11-24, from the brief of the run)
- This ticket works only in `cstack/src/settings.ts` and its tests, `.cstack/settings.json`, the settings template `cstack/skills/resolve-issue/templates/settings.json`, `cstack/src/tracker/ready.ts`, `cstack/src/run-state.ts` for the field `readAt` only, the file that declares the Orca setup hook, and the paragraphs of `README.md` about the settings and the setup. In `cstack/src/manifest.ts` and `README.md`, change only the entries and the paragraphs of this ticket. (2026-11-24, from the brief of the run)
- Other tickets of epic #84 run at the same time, each in its own worktree. #107 works in `cstack/skills/resolve-issue/agents/executor.md`, in the end of the phase guides that the executor follows, maybe in the output of `cstack next --done` in `cstack/src/commands/next.ts`, and in their tests. #100 works in `cstack/src/commands/unit-red.ts`, `cstack/src/commands/unit-green.ts`, `cstack/src/unit-test-command.ts`, `cstack/src/unit-test-runs.ts`, `cstack/src/saved-runs.ts`, `cstack/src/audit/` for one unit, their tests and their paragraphs of `README.md`. The follow-up of #96 changes the paragraphs about the user's answers in the guides `questions.md`, `plan.md` and `dependencies.md`. The follow-up of #102 changes `.github/workflows/ci.yml`. (2026-11-24, from the brief of the run)
- When this ticket needs a file of another ticket of this wave, the main conversation asks the coordinator before anyone changes it. (2026-11-24, from the brief of the run)
- On `main`, #93, #95, #96 and #102 are merged. `cstack wave`, the `cstack helper` commands, `cstack unit collect` and `cstack report check` are gone from the source, and `cstack next --done plan` checks the facts of a plan. The installed `cstack` 0.3.2 that this run uses still has the old commands and does not check those facts. (2026-11-24, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`, and add no runtime dependency. The release of this epic comes at the end of milestone R3. (2026-11-24, from the brief of the run)
- Do not change the plan format, which #98 defined as version 2 in ADR-RQG-B. When the plan needs a new line or a new section, put it to the user as a blocking question, and ask the coordinator before you plan it. This plan file stays in format `cstack-plan/1`, because the installed `cstack` 0.3.2 writes and reads it. Any plan fixture that this branch adds is in version 2. (2026-11-24, from the brief of the run)
- `cstack/test/guides/helpers-are-sub-agents.test.ts` reads every guide, skill and agent prompt. It refuses a sentence that tells Claude to start an Orca worker, except in `independent-review.md`. Text that describes an Orca worker without telling Claude to start one passes. (2026-11-24, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `cstack/skills/resolve-issue/SKILL.md` have almost no margin left in `cstack/test/skill-size.test.ts`. If a sentence is added to either file, remove words elsewhere in the same file or in the other one. (2026-11-24, from the brief of the run)
- This branch changes only the source. The installed `cstack` 0.3.2 still reads `setupCommand` and accepts a settings file without it. `cstack` from this branch refuses both removed keys, so `.cstack/settings.json` loses `setupCommand` in the same commit as the code. To try the code of this branch, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-24, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-24, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-24, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-24, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. The main conversation puts those three rules, word for word, in the prompt of the executor. (2026-11-24, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-24, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-24, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-24, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-24, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-24, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must not do needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-24, from the retrospective of #86, `docs/retros/2026-11-23-86.md`)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-24, from the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-24, from the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-24, from the retrospective of #86)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-24, from the retrospective of #89, `docs/retros/2026-11-23-89.md`)
- `cstack helper wait` takes no `--plan`. Run it only after the sub-agent has returned. (2026-11-24, from the retrospective of #89)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-24, from the retrospective of #89)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-24, from the retrospective of #89)
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. The installed `cstack` 0.3.2 does not check it in `cstack publish`. (2026-11-24, from the retrospective of #89)
- A deliberate break of the code can make a test loop forever. Run each break with a time limit, for example `perl -e 'alarm 300; exec @ARGV' npx vitest run <test file>`. If a vitest process of this worktree still runs after that, stop it. Never stop a process of another worktree. (2026-11-24, from the run of #99)
- When the plan asks a test to check a message, the plan gives the exact words of that message. Otherwise the implementer chooses its own words. (2026-11-24, from the runs of #91, #99 and #114)
- A question for the user reaches a ticket only after the user saw it, word for word, in the chat of the main conversation. (2026-11-24, from the run of #99)
- If a result of a sub-agent reaches the main conversation instead of the executor that started it, the main conversation sends it to the executor in a message. (2026-11-24, from the run of #91)
- Several runs share this machine. If the full `npm test` fails on a 5-second timeout, run the failing test file alone before you conclude that the code is wrong. (2026-11-24, from the runs of #91, #99 and #114, and the conventions file)
- If the run stops on a usage limit, resume the same executor, with its context, when you can. Never start a second executor on the same branch. (2026-11-24, from the brief of the run)
- A line of `## Decisions` that says how a function behaves needs a test case of its own too, not only a line that says what it must not do. (2026-11-24, from the run of #118)
- When a unit has several refusals, the implementer breaks each refusal on its own, one at a time, and sees its own test fail. (2026-11-24, from the run of #98)
- A fix commit after a review keeps the scope of the commit messages, such as `fix(cli):` or `fix(skill):`. (2026-11-24, from the runs of #98 and #118)
- The executor waits for the notification that a sub-agent finished. Only then does it run `cstack helper wait` for that unit, because a wait while the sub-agent still runs exits with 1. (2026-11-24, from the runs of #95, #96 and #102)
- Before an implementer commits, it reads every line of `## Decisions` that names one of its files, and it checks that the code follows each one. (2026-11-24, from the run of #102)
- When `## Decisions` fixes the text of a comment for another ticket, the document phase posts that text word for word. (2026-11-24, from the runs of #95, #96 and #102)
- `cstack tracker comment` once printed a 504 error from GitHub, yet the comment was posted. Before you post a comment again after an error, read the ticket to see whether it is already there. (2026-11-24, from the runs of #95, #96 and #102)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-24, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-24, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-24, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. Never read the private work data of the comparison runs or their session files. (2026-11-24, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-24, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-24, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-24, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-24, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-24, from the brief of the run and the conventions file)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and nobody prints the private list. (2026-11-24, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep every change of both sides, and push with a plain `git push`, without force. (2026-11-24, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-24, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-24, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-24, from the brief of the run)
- `checkTestCommand()` in `cstack/src/settings.ts` (line 107) takes `isFile: boolean` once `setupCommand` leaves, because the value `null` served only that key. Its comment at line 106 leaves too. (2026-11-24, an assumption not asked)
- The cases of `cstack/test/settings.test.ts` that use `watchIntervalMinutes` only as a sample of a wrong type (lines 105, 109 and 110) use `recordsLanguage: 5` instead. The case at line 109 then expects the paths `["integration", "recordsLanguage"]`, because the reader checks `integration` before `recordsLanguage` (`cstack/src/settings.ts`, lines 230 and 235). (2026-11-24, an assumption not asked)
- `readyState()` in `cstack/src/tracker/ready.ts` takes only the ticket. A ticket is "started" only when its state is in progress. The case "calls a ticket in progress or with a worktree started" of `cstack/test/tracker/ready.test.ts` (lines 36 to 39) keeps only its first line, and its name says "in progress" only. The other calls drop their second argument. (2026-11-24, an assumption not asked)
- The field `readAt` and its comment leave `SavedReport` in `cstack/src/run-state.ts` (lines 47 and 48). No code reads or writes it, so `npm run typecheck` is the proof, and no test is added. A report file of an older `cstack` that holds the field is still read, because `readReports()` casts the parsed JSON (`cstack/src/report/reports.ts`, line 156). (2026-11-24, an assumption not asked)
- The user accepts that this ticket removes `"setupCommand": "cd cstack && npm ci"` (line 7) from `.cstack/settings.json`, with the comma at the end of line 6, in the same commit as the code that refuses the key. Nothing else in that file changes, so the file keeps `"version": 1` and `testCommands` exactly as they are. (2026-11-24, from the user's answer in the question round, as the brief asks)
- The settings file keeps version 1 after the removal of `setupCommand` and `watchIntervalMinutes`. The reader still accepts only `"version": 1` (`cstack/src/settings.ts`, lines 215 and 216). (2026-11-24, from the user's answer in the question round)
- `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` gets a new last section, `## Amendment, 2026-11-24`, with this text, word for word: "Ticket #97 removed the keys `setupCommand` and `watchIntervalMinutes`, and the settings file kept version 1. A key that no `cstack` command reads any more can leave without a new version, on one condition. The reader refuses a file that still holds that key, with a message that names the key and says what to do. So no key changes meaning without the user knowing. A key that is renamed, or that changes meaning, still moves the format to version 2." The rest of the ADR does not change. (2026-11-24, from the user's answer in the question round)
- The comment of `cstack/src/settings.ts` at lines 11 and 12 becomes, word for word: "Version rule: the format stays at version 1 when a later ticket adds a key. It also stays at version 1 when a key that no command reads any more leaves, because the reader refuses that key with a message of its own. It moves to version 2 only when a key is renamed or changes meaning. ADR-SIC-D records this rule." (2026-11-24, from the user's answer in the question round)
- `setupCommand` and `watchIntervalMinutes` leave the type `SettingValues`, `DEFAULTS` and the checks of `cstack/src/settings.ts` (lines 43, 45, 63, 67, 295 to 297 and 313 to 317). So `TOP_KEYS` (line 70) and the line of allowed keys in the message of any unknown key no longer name them, and `cstack next` no longer prints a line for them. (2026-11-24, from the ticket and its comments)
- A settings file that holds `setupCommand` at its top level is refused with one problem whose path is `setupCommand` and whose text is exactly `was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository.` So `cstack next` prints exactly `cstack: setupCommand: was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository.` and a newline on standard error, prints nothing on standard output, and exits with 3 (`cstack/src/commands/next.ts`, line 207, and `cstack/src/commands/errors.ts`, lines 15 to 17). This holds whatever the value of the key is. (2026-11-24, from the user's answer in the question round)
- A settings file that holds `watchIntervalMinutes` at its top level is refused with one problem whose path is `watchIntervalMinutes` and whose text is exactly `was removed from cstack with cstack wave. Remove this key.` This holds whatever the value of the key is. (2026-11-24, from the user's answer in the question round)
- The two messages of the removed keys apply only at the top level of the settings file. A key named `setupCommand` or `watchIntervalMinutes` inside `review` or `testCommands` keeps the message of any unknown key, which starts with `unknown key. Allowed keys here:`. Any other unknown key at the top level also keeps that message, with its hint `If this key comes from a newer cstack, update cstack.` (2026-11-24, from the user's answer in the question round)
- The settings template `cstack/skills/resolve-issue/templates/settings.json` loses its line `"watchIntervalMinutes": 5` (line 7) and the comma at the end of line 6. It keeps `version`, `integration`, `recordsLanguage`, `forbiddenTools` and `commitAttribution`. The case "the example settings file" of `cstack/test/settings.test.ts` (lines 253 to 264) then expects every key of `DEFAULTS` except `testCommands` and `review`. (2026-11-24, from the comments of the #95 run on the ticket)
- `cstack/test/settings.test.ts` gets a case that reads the settings file of this repository, `.cstack/settings.json`, with `readSettings()`, and expects no error. It proves that the file and the code change in the same commit. (2026-11-24, an assumption not asked, from the acceptance of the ticket)
- The file `orca.yaml` at the root of the repository declares the Orca setup hook. Its content is exactly these six lines: `# Orca runs this setup script in each new workspace of this repository.`, `# The section "Set up a new workspace" of README.md explains it.`, `scripts:`, `  setup: |`, `    cd cstack && npm ci`, `setupAgentStartupPolicy: wait-for-setup`. The script is a YAML block scalar, as in Orca's own example. With `wait-for-setup`, Orca starts the agent of a new workspace only after the setup succeeded. No automated test reads `orca.yaml`, because `cstack` has no YAML parser and this ticket adds no dependency. (2026-11-24, from the user's answers in the question round)
- Orca reads `orca.yaml`, never `cstack`. Every `cstack` command still works without Orca and without `orca.yaml`. (2026-11-24, from the rules of epic #84)
- The check by hand of the acceptance happens once the pull request is open. The user creates one workspace in the Orca app that starts from the branch `gambitl/orca-setup-hook`, because git refuses a branch that another worktree already holds. Orca makes a new branch on top of it and asks once to trust the setup script. The user reports whether `cstack/node_modules` exists in that workspace, then removes the workspace and its new branch. The comment on #97 in the document phase gives that result. Nobody in this run runs `orca worktree create` or `orca worktree rm`. (2026-11-24, from the user's answer in the question round)
- Beyond the files that the brief names, the user approved these files for this ticket: `cstack/src/commands/tracker-list.ts`, `cstack/test/tracker/ready.test.ts`, `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` and `CLAUDE.md`. `cstack/test/next-settings.test.ts` is one of the settings tests that the brief names. (2026-11-24, from the user's answer in the question round)
- In `CLAUDE.md`, line 20, the sentence "A new worktree has no `node_modules`, so run `npm ci` there before the first type check or test run." becomes, word for word: "When Orca creates a new worktree, the setup hook in `orca.yaml` runs `npm ci` in `cstack/`. If `cstack/node_modules` is missing, for example because the setup was skipped or the worktree was made with `git worktree add`, run `npm ci` there before the first type check or test run." The rest of `CLAUDE.md` does not change. (2026-11-24, accepted by default in the question round)
- `README.md` gets a new section, `## Set up a new workspace`, right after the section `## Install cstack` and before `## Commands`. Its text is the one under "README section" in the notes of Unit 3, word for word. No other paragraph of `README.md` changes. (2026-11-24, accepted by default in the question round)
- No changelog entry and no release note in this branch, because #104 writes the release notes of the epic. The comment for #104 in the document phase lists what left: the two settings keys, the argument `hasWorktree` and the field `readAt`. (2026-11-24, from the ticket footer "Feeds: #104")

## Architecture

The change is small, and the ticket and the answers of the question round lock the approach. Security: the change adds no endpoint, query or secret to `cstack`, so there is no security surface in the code. The trust of the setup script that Orca runs is explained in the README section of Unit 3.

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
- Worktree: <path, with ~/ in place of the home folder>, optional, written by cstack when a unit runs in a child worktree, never by a person
Free notes come after these lines.
Each unit commit carries the trailer "Cstack-Unit: <n>" in the final paragraph of its message, together with any other trailer such as Co-Authored-By. git does not read a trailer outside the final paragraph. A commit with two Cstack-Unit lines counts for both units. -->

### Unit 1: Remove setupCommand and watchIntervalMinutes from the settings, and declare the Orca setup hook
- Files: `cstack/src/settings.ts`, `cstack/test/settings.test.ts`, `cstack/test/next-settings.test.ts`, `cstack/skills/resolve-issue/templates/settings.json`, `.cstack/settings.json`, `orca.yaml`
- Test: `cstack/test/settings.test.ts`: a file with `setupCommand` is refused with the problem `{ path: "setupCommand", text: "was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository." }`; a file with `watchIntervalMinutes` is refused with the problem `{ path: "watchIntervalMinutes", text: "was removed from cstack with cstack wave. Remove this key." }`; a key `setupCommand` inside `review` is refused with a text that starts with `unknown key. Allowed keys here:`; the settings file of this repository holds only the keys `version` and `testCommands`, and `readSettings()` reads it without an error
- Minimum code: In `cstack/src/settings.ts`, remove both keys from `SettingValues`, `DEFAULTS` and the checks (lines 43, 45, 63, 67, 295 to 297 and 313 to 317). Add a table of the two removed keys and their texts, and make the top-level check of unknown keys use the text of the table for those two keys, and the usual text for any other key. Rewrite the version comment of lines 11 and 12 as `## Decisions` says. Remove `"setupCommand"` (line 7) and the comma of line 6 from `.cstack/settings.json`. Remove `"watchIntervalMinutes": 5` (line 7) and the comma of line 6 from the template `cstack/skills/resolve-issue/templates/settings.json`. Write `orca.yaml` with the six lines that `## Decisions` gives.
- Refactor: `checkTestCommand()` takes `isFile: boolean`, and the comment of line 106 leaves. In `cstack/test/settings.test.ts`, remove the block "setupCommand" (lines 314 to 335), the case "refuses watchIntervalMinutes %s" (lines 125 to 129), and both keys from the expected objects (lines 66, 68, 80 and 82). Lines 105, 109 and 110 use `recordsLanguage: 5` in place of `watchIntervalMinutes: "5"`, as `## Decisions` says. The case "the example settings file" expects every key of `DEFAULTS` except `testCommands` and `review`, and its name says so. In `cstack/test/next-settings.test.ts`, the list of printed keys (lines 49 to 58) loses `setupCommand` and `watchIntervalMinutes`, and the check of line 67 leaves.
- Commit message: feat(cli): refuse setupCommand and watchIntervalMinutes in the settings and declare the setup in orca.yaml
- Depends on: none

Run `cstack unit red` before you change `.cstack/settings.json`. The case about the settings file of this repository fails only while that file still holds `setupCommand`. `.cstack/settings.json` and `orca.yaml` go in this unit's commit with the code, because `cstack` from this branch refuses the key as soon as the code changes, and the setup of a new workspace moves from one file to the other. For the rule that a negative test proves its rule by breaking it, break each of the three refusals on its own: remove the entry of `setupCommand` from the table, then the entry of `watchIntervalMinutes`, then make the table apply inside `review` too.

### Unit 2: Remove hasWorktree and readAt, which only the removed commands used
- Files: `cstack/src/tracker/ready.ts`, `cstack/src/commands/tracker-list.ts`, `cstack/test/tracker/ready.test.ts`, `cstack/src/run-state.ts`
- Test: `cstack/test/tracker/ready.test.ts`: `readyState` takes only the ticket, so `readyState.length` is 1
- Minimum code: In `cstack/src/tracker/ready.ts`, remove the parameter `hasWorktree` (line 11) and `|| hasWorktree` (line 14). In `cstack/src/commands/tracker-list.ts`, line 48 calls `readyState(ticket)`. In `cstack/src/run-state.ts`, remove the field `readAt` of `SavedReport` and its comment (lines 47 and 48).
- Refactor: In `cstack/test/tracker/ready.test.ts`, every call passes only the ticket. The case "calls a ticket in progress or with a worktree started" (lines 36 to 39) keeps only its first line and becomes "calls a ticket in progress started". The call of line 59 passes only the ticket.
- Commit message: refactor(cli): remove hasWorktree and readAt, which only the removed commands used
- Depends on: none

The removal of `readAt` has no test of its own, because no code reads or writes the field. `npm run typecheck` proves it.

### Unit 3: Explain the Orca setup hook in the README, CLAUDE.md and ADR-SIC-D
- Files: `README.md`, `CLAUDE.md`, `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`
- No test: the unit changes only prose. The commit of Unit 1 carries `orca.yaml`, and the user checks it by hand once the pull request is open.
- Minimum code: Add the section below to `README.md`, right after the section `## Install cstack` and before `## Commands`. Replace the sentence of `CLAUDE.md`, line 20, as `## Decisions` says. Add the section `## Amendment, 2026-11-24` at the end of ADR-SIC-D, with the text that `## Decisions` gives.
- Refactor: none
- Commit message: docs(cli): explain the Orca setup hook and the removed settings keys
- Depends on: 1

README section, word for word:

```markdown
## Set up a new workspace

A workspace is a second working folder of the same git repository. Orca creates one for each ticket, for example. A new workspace has no installed packages, so a command such as `npm ci` must run there before the first test.

`cstack` does not run that command. Orca runs it, as the setup hook of the repository. You declare the hook in a file named `orca.yaml`, at the root of the repository. Its key `scripts.setup` holds the commands to run. Orca reads `orca.yaml` from the branch that the new workspace starts from, so a workspace that starts from a branch without the file gets no setup. With the key `setupAgentStartupPolicy: wait-for-setup`, Orca starts the agent only after the setup succeeded. When the setup fails, the agent does not start. Orca's page about [`orca.yaml`](https://github.com/stablyai/orca/blob/main/docs/site/content/docs/model/orca-yaml.mdx) describes every key.

The first time, Orca asks you to trust the setup script. After that, Orca runs the `orca.yaml` of any branch of the repository without asking again. So before you open a workspace on a pull request from someone else, read its `orca.yaml` and its `package.json`. You can also create that workspace with its setup skipped. The setting **Settings → Repository** of the Orca app decides whether the setup runs by itself, asks each time, or is skipped.

This repository declares `cd cstack && npm ci` as its setup hook, and its agents wait for it.

The settings file `.cstack/settings.json` no longer accepts the keys `setupCommand` and `watchIntervalMinutes`. `setupCommand` named the command for a new workspace, which Orca now runs. `watchIntervalMinutes` served `cstack wave`, which left `cstack`. When your settings file still holds one of them, `cstack` refuses the file, and the message tells you to remove the line. A settings file copied from an older template holds `watchIntervalMinutes`, so remove that line after you update `cstack`.
```

## Documentation duties

- `README.md`: applies, written by Unit 3 as the new section `## Set up a new workspace`.
- `CLAUDE.md`: applies, written by Unit 3 in the paragraph of `## Commands`.
- ADR: applies, written by Unit 3 as the amendment of 2026-11-24 at the end of `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`. No new ADR, because the version rule is amended, not replaced.
- Specification page: applies, written in the document phase. The first open question of `docs/projects/refocus-and-quality-guards.md` asks where Orca declares the setup hooks of a repository. Its answer is `scripts.setup` in `orca.yaml` at the root of the repository, as this ticket found.
- Ticket #97: applies, written in the document phase as one comment. It says where Orca declares the setup hook (scope item 1 asks for it in the ticket), what changed, and the result of the check by hand in a new Orca workspace.
- Ticket #104, which writes the release notes: applies, written in the document phase as one comment. It lists what left `cstack` in this ticket: the settings keys `setupCommand` and `watchIntervalMinutes`, with their new messages, the argument `hasWorktree` of `readyState()` and the field `readAt` of `SavedReport`. It also says that a settings file copied from the old template must lose its `watchIntervalMinutes` line after the upgrade.
- Changelog: does not apply, because #104 writes the release notes of the epic.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Remove setupCommand from this repository's settings file
This ticket removes the line `"setupCommand": "cd cstack && npm ci"` (line 7) from `.cstack/settings.json`, and the comma at the end of line 6, in the same commit as the code that refuses the key. It changes nothing else in that file. Branches normally never change that file, and the independent review refuses a branch that does, so this exception needs your explicit yes. Do you accept this change?
- For: the user
- Answer: yes. The user accepts that this ticket removes `setupCommand` from `.cstack/settings.json`, and nothing else in that file. (the user, in the question round, 2026-11-24)

### Question 2: Version of the settings file after the removal
ADR-SIC-D (line 30) and the comment of `cstack/src/settings.ts` (lines 11 and 12) say that removing a key moves the settings file to version 2. A move to version 2 would make the installed `cstack` 0.3.2 refuse the settings file of `main`, and the brief allows no other change in `.cstack/settings.json`. I recommend keeping version 1. The ADR would get a short dated amendment: removing a key that no `cstack` command reads any more keeps version 1, and the reader refuses that key with a message that says what replaces it. The comment of `settings.ts` would say the same. Do you agree to keep version 1 and amend ADR-SIC-D this way?
- For: the user
- Answer: yes. Keep version 1 and add a dated amendment to ADR-SIC-D, and update the comment of `cstack/src/settings.ts`. (the user, in the question round, 2026-11-24)

### Question 3: The message for a removed key
Today a key that `cstack` does not know is refused with `<key>: unknown key. Allowed keys here: <keys>. If this key comes from a newer cstack, update cstack.` That last sentence is wrong for a key that an older `cstack` accepted. I recommend a message of its own for each of the two removed keys, still with exit code 3. `cstack` would print exactly `cstack: setupCommand: was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository.` and `cstack: watchIntervalMinutes: was removed from cstack with cstack wave. Remove this key.` Any other unknown key keeps today's message. Do you want these two messages, or the generic message for every unknown key?
- For: the user
- Answer: yes, one message of its own for each removed key, with the text of the review of the questions for `setupCommand`. The exact texts are in the question above. (the user, in the question round, 2026-11-24)

### Question 4: Wait for the setup before the agent starts
By default, Orca starts the agent of a new workspace at the same time as the setup script. Claude could then run the tests before `npm ci` ends. The key `setupAgentStartupPolicy: wait-for-setup` in `orca.yaml` makes Orca start the agent only after the setup succeeded. I recommend this content for `orca.yaml`: `scripts.setup` set to `cd cstack && npm ci`, and `setupAgentStartupPolicy: wait-for-setup`. Do you want the agent to wait for the setup?
- For: the user
- Answer: yes. `orca.yaml` sets `setupAgentStartupPolicy: wait-for-setup`. (the user, in the question round, 2026-11-24)

### Question 5: Who checks a new Orca workspace by hand, and when
The ticket asks for one check by hand that a new Orca workspace of this repository gets `cstack/node_modules` from the hook, with the result written in the ticket. I must not create a workspace myself. Orca reads the hook from the `orca.yaml` of the new workspace's branch, so the check needs a workspace made from this branch. git refuses a branch that another worktree already holds, so the new workspace must start from the branch `gambitl/orca-setup-hook`, and Orca makes a new branch on top of it. I recommend this: once the pull request is open, you create one workspace in the Orca app that starts from the branch `gambitl/orca-setup-hook`. Orca asks you once to trust the setup script. You tell me whether `cstack/node_modules` exists in it, and then you remove that workspace and its new branch. I write the result in the comment on the ticket. Do you agree to do this check?
- For: the user
- Answer: yes. The user creates the workspace in the Orca app once the pull request is open, starting from the branch `gambitl/orca-setup-hook`, and reports the result. (the user, in the question round, 2026-11-24)

### Question 6: Files beyond the list of the brief
The brief lists the files of this ticket. The removal needs four more files, and none of them belongs to another ticket of this wave. `cstack/src/commands/tracker-list.ts` is the only caller of `readyState()`, at line 48. `cstack/test/tracker/ready.test.ts` tests the argument `hasWorktree`. `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` gets the amendment of question 2. `CLAUDE.md` gets the sentence about the Orca setup hook that scope item 5 asks for. Do you approve these four files for this ticket?
- For: the user
- Answer: yes. The four files are approved for this ticket. (the user, in the question round, 2026-11-24)

## Review log

Impact notes: a search of the whole repository finds `setupCommand`, `watchIntervalMinutes`, `hasWorktree` and `readAt` only in the refusal table, the tests, the README section, the ADR amendment and older project documents. `readyState` has one caller, `cstack/src/commands/tracker-list.ts`. The settings reader is used by commands that read only other keys. Companion files checked: the settings template, `.cstack/settings.json` and `next-settings.test.ts`, all changed.

Correctness reviewer: no bug. It noted that the repository-root path in the new settings test breaks for a checkout path with spaces. This is not fixed, because no checkout path has spaces and the other tests use the same style.
Security reviewer: one finding. The README said Orca never asks again after the first trust. Orca asks again when `orca.yaml` changes, and the real gap is `cstack/package.json` and `cstack/package-lock.json`. Fixed in a `fix(cli)` commit.
Conventions reviewer: nothing found.
Simplicity reviewer: nothing to cut.
Tests: typecheck and the full `npm test` pass (103 files, 1738 tests) after the fix.

Independent review: no code changed. Judgment calls for the pull request body. First, no test runs `cstack next` itself on a file with `setupCommand`; the refusal uses the same error path that an existing `next-settings.test.ts` case covers. Second, a newer `cstack` refuses any settings file that still holds `setupCommand` or `watchIntervalMinutes`, on purpose, so the release notes of #104 should say it clearly. Third, the repository-root path in the new settings test breaks for a checkout path with a space, which was left as it is. The hand check of `orca.yaml` in a new Orca workspace is still open for the user.

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

none

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

- 2026-11-24, executor build: moved #97 to "in progress" with cstack tracker move. Branch gambitl/orca-setup-hook was already checked out.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

Five decisions before the plan, each with a recommendation, so "ok" is enough.

**I need your answer before I plan**

**Keep version 1 of the settings file, and amend ADR-SIC-D (question 2).** The ADR says that removing a key moves the format to version 2. But the installed cstack 0.3.2 would then refuse the settings file of `main`. I recommend version 1 with a dated amendment: removing a key that nothing reads keeps version 1, because the refusal names the key and says what to do.

**One message of its own for each removed key (question 3).** This matters most for `watchIntervalMinutes`. The old template wrote it into every settings file, so every repository set up with cstack will exit with 3 after the next upgrade, until the line goes. I agree with both messages, with one change. cstack works without Orca, so the `setupCommand` message must not require Orca: `setupCommand: was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository.`

**`wait-for-setup` in `orca.yaml` (question 4).** I confirm it, for one more reason. Without the wait, Claude reads `CLAUDE.md` and starts its own `npm ci` while Orca's still runs, and two `npm ci` in one folder break each other. The cost: if `npm ci` fails, Orca starts no agent at all. I checked this in Orca's code.

**The check by hand (question 5).** Yes, with one detail. git refuses the same branch in two worktrees, and this worktree holds the branch. In Orca, start the new workspace from the branch `gambitl/orca-setup-hook`. Orca then makes a new branch on top of it and reads its `orca.yaml`. Remove the workspace and that branch afterwards.

**Four files beyond the list of the brief (question 6).** Each follows from a decision already taken, and no other ticket of the wave touches them. I recommend yes.

**I will do this unless you say no**

- The exception for `.cstack/settings.json` (question 1) is already in the decisions of the brief, so I record it as answered instead of asking again.
- In `CLAUDE.md`, the sentence depends on what the agent can see: "If `cstack/node_modules` is missing, run `npm ci`". An agent cannot tell who created its worktree.
- I write the script as a YAML block (`|`), like Orca's example. Invalid YAML makes Orca ignore the whole file without a visible error.

**Good to know**

- Once you approve one script for this repository, Orca runs the scripts of other branches without asking again. The repository is public, so before you open a workspace on a stranger's pull request, read its `orca.yaml` and `cstack/package.json`, or skip the setup.

#### Details

Question 1, the removal of `setupCommand` from `.cstack/settings.json`, is already settled. The line of `## Decisions` dated 2026-11-24 "from the brief of the run" says: "This ticket is the one exception to the rule that a branch never changes `.cstack/settings.json`." The independent review reads `## Decisions`, so it sees the exception there. I relabel the question non-blocking and recommend that the question round records its answer as "settled by the brief, 2026-11-24" rather than asking the user a second time. If nobody decides, the change happens as the brief says.

Question 2, the version of the settings file, is blocking, and only the user can answer it. ADR-SIC-D says "A key that is renamed, removed or changed in meaning moves the format to version 2", and the comment of `cstack/src/settings.ts` (lines 11 and 12) says the same. The reader accepts only `"version": 1` (lines 215 and 216), so version 2 would make the installed 0.3.2 refuse the settings file of `main` and of every repository that upgrades. I rejected version 2 for that reason. I also rejected accepting the old keys with a warning, because the acceptance of the ticket says that a file with `setupCommand` is refused. ADR-SIC-D already has a precedent: its "Consequences" section says a settled decision "is amended, not removed". The amendment should tie the exception to the refusal: a removed key keeps version 1 only because a file that still holds it is refused with a message that names the key, so nothing changes meaning silently. If nobody decides, the code and the ADR contradict each other after the merge.

Question 3, the message for a removed key, is blocking, because the plan must give the exact words. Today `unknownKeys()` adds the hint "If this key comes from a newer cstack, update cstack." (`cstack/src/settings.ts`, lines 74 and 93), which is wrong for a key that an older cstack accepted. The template `cstack/skills/resolve-issue/templates/settings.json` holds `"watchIntervalMinutes": 5` at line 7, so every repository whose settings file was copied from it holds the key. After the release of milestone R3, every command that reads the settings (`next`, `publish`, `unit commit`, `audit` and the unit test commands) exits with 3 in those repositories until the line is removed. A message that says "Remove this key" makes that fix one line. I agree with the dedicated messages and keep the drafted text for `watchIntervalMinutes`. I change the text for `setupCommand`, because the rules of epic #84 say that every cstack command works without Orca, and the drafted text tells every user to write an `orca.yaml`. My proposed text is: `setupCommand: was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository.` The main conversation should update the text of question 3 before it asks. Each removed key needs its own test case, and any other unknown key keeps today's message, which needs a case too. If nobody decides, both keys get the generic message with its wrong hint.

Question 4, the startup policy, is blocking, and part of it was answered by reading Orca's documentation and source. The documentation page `docs/site/content/docs/model/orca-yaml.mdx` of `stablyai/orca` says that "either the YAML or local wait setting enables it", so the app setting `start-immediately` of this repository does not cancel `wait-for-setup` in the file. In Orca's source, a comment of `src/shared/agent-launch/startup/setup-wait-output-gate.ts` says that when setup fails or times out, no agent starts. `src/shared/agent-launch/startup/setup-agent-sequencing.ts` sets the wait limit to two hours. For a worker that the coordinator starts, `src/main/runtime/rpc/methods/orchestration/worker/start/readiness/worker-setup-gate.ts` records the stage `setup_failed`. The extra reason for the wait is a race. `CLAUDE.md` line 20 tells an agent in a new worktree to run `npm ci`. With `start-immediately`, the agent can run its own `npm ci` while Orca's still runs, and `npm ci` deletes `node_modules` before it installs, so the two runs break each other. Or the agent can see a half-filled `node_modules` and run tests on it. The lock file lists about 90 packages, so the wait is short. If nobody decides, Orca uses `start-immediately` and the race can happen.

Question 5, the check by hand, is blocking, and only the user can do it, because the brief forbids `orca worktree create`. git refuses to check out a branch that another worktree already holds, and this worktree holds `gambitl/orca-setup-hook`. Orca's page `docs/site/content/docs/model/worktrees.mdx` lists "Another local branch" in its start-from picker, which makes a new branch on top of the chosen one. Orca reads the setup script from the new worktree's `orca.yaml`, so that new worktree has the hook. Orca asks once to trust the script. On this machine Node comes from Homebrew, so the setup terminal must find `npm` on its path. If the check fails with "npm: command not found", that is the cause, and the hook itself is fine. Afterwards the user removes the workspace and the extra branch. I rejected a check after the merge, from `main`, because the ticket closes with the pull request and the acceptance asks for the result in the ticket. If nobody decides, the acceptance of the ticket stays unchecked.

Question 6, the four files beyond the list of the brief, is blocking, because the brief fixes the file list. Each file follows from a decision already taken. `cstack/src/commands/tracker-list.ts` (line 48) is the only caller of `readyState()`. `cstack/test/tracker/ready.test.ts` tests the argument that leaves. ADR-SIC-D gets the amendment of question 2. `CLAUDE.md` gets the sentence of scope item 5. No other ticket of the wave names them in the brief. `cstack/test/next-settings.test.ts` is already in this ticket's list as a test of the settings, but #107 may change the output of `cstack next --done`. If both branches change that file, the main conversation asks the coordinator first, as the decisions say. If nobody decides, the removal of `hasWorktree` cannot be done.

Item 7 of the round, the sentence of `CLAUDE.md`, is non-blocking. I would change the drafted sentence so that it depends on what an agent can see, because an agent cannot tell whether Orca or `git worktree add` created its worktree, or whether the setup was skipped. My proposed text is: "When Orca creates a new worktree, the setup hook in `orca.yaml` runs `npm ci` in `cstack/`. If `cstack/node_modules` is missing, for example because the setup was skipped or the worktree was made with `git worktree add`, run `npm ci` there before the first type check or test run." The test `cstack/test/prompts.test.ts` (line 48) checks the install rule of `implementer.md`, not `CLAUDE.md`, so it is not affected. If nobody decides, the drafted sentence goes in.

Item 8 of the round, the new README section, is non-blocking, and I agree with it. The section should also say that Orca runs the setup script of the branch the new workspace starts from, and that a repository whose settings file holds either removed key must delete that line after the upgrade. If nobody decides, the drafted section goes in.

The form of `orca.yaml` is non-blocking. `cd cstack && npm ci` is valid as a plain YAML value, but a block scalar (`|`) is what Orca's documentation shows and it stays valid when a later line is added. Orca ignores the whole file on invalid YAML or a duplicate key, and the user sees only that setup did not run. cstack has no YAML parser among its dependencies, and the brief allows no new runtime dependency, so no automated test checks the file. The check by hand of question 5 is its proof. The script runs with the new worktree as its working folder, so a relative `cd cstack` works. If nobody decides, I write it as a block scalar.

The trust of the setup script is non-blocking, and I read it in Orca's source. In `src/shared/workspace-setup/hooks/orca-hook-trust-entries.ts`, `isOrcaHookRepoTrusted()` returns true on a single host once any hook of the repository was approved. Then `confirmScriptContent()` in `src/renderer/src/runtime/repo-hooks/hook-script-confirmation.ts` runs a script without asking. So after the first approval, a workspace started from any branch runs that branch's `orca.yaml` without a prompt. `npm ci` also runs the lifecycle scripts of `cstack/package.json`, such as a `postinstall`. This repository is public, so a pull request from someone else can change either file, and the code runs on the maintainer's Mac when a workspace is created on that branch. Before this ticket, `npm ci` ran only when someone typed it. The answer is to read both files of an outside pull request before opening a workspace on it, or to create that workspace with setup skipped. If nobody decides, nothing in the code changes, and the README section can carry one sentence about it.

Once merged, `orca.yaml` also changes the workspaces that the coordinator creates for later tickets from `main`. Their setup runs by default, the first one may ask the user to trust the script in the app, and with `wait-for-setup` a failed `npm ci` leaves that worker without an agent and with the stage `setup_failed`.

I checked scale and performance, the data model beyond the version rule, recurring cost and user-interface edge cases, and found nothing in this ticket.

The user answered "ok pour tout, oui pour la question 1" on 2026-11-24. Every item that the short version lists under "Je fais ceci sauf si tu dis non" is accepted by default: the sentence of `CLAUDE.md` that depends on whether `cstack/node_modules` is missing, and the setup script written as a YAML block scalar. The exception of question 1 was accepted explicitly, as the brief asks.

### Open questions and answers

These are the questions of the round of 2026-11-24, each with my recommended answer.

1. Removing `setupCommand` from `.cstack/settings.json` is an exception to the rules of the brief. Blocking question 1. Recommended: yes, as the brief asks. The review of the questions proposed to treat it as settled by the brief, but the brief asks for the user's explicit acceptance, written as a line of `## Decisions`, so it stays a question for the user.
2. The version rule of ADR-SIC-D asks for version 2 when a key is removed. Blocking question 2. Recommended: keep version 1 and add a dated amendment to ADR-SIC-D.
3. The refusal of a removed key carries a wrong hint today. Blocking question 3. Recommended: one message of its own for each removed key, with the exact words of the question.
4. Orca starts the agent beside the setup by default. Blocking question 4. Recommended: `setupAgentStartupPolicy: wait-for-setup`.
5. The acceptance needs one check by hand in a new Orca workspace, which I must not create. Blocking question 5. Recommended: the user does it once the pull request is open.
6. Four files beyond the list of the brief. Blocking question 6. Recommended: approve them. Answer: see blocking question 6.
7. Non-blocking. The sentence of `CLAUDE.md` about the Orca setup hook. Recommended: replace "A new worktree has no `node_modules`, so run `npm ci` there before the first type check or test run." (line 20) with "When Orca creates a new worktree, the setup hook in `orca.yaml` runs `npm ci` in `cstack/`. If `cstack/node_modules` is missing, for example because the setup was skipped or the worktree was made with `git worktree add`, run `npm ci` there before the first type check or test run." This text comes from the review of the questions, because an agent cannot tell who created its worktree. I will do this unless the user says no. Answer: accepted by default, the user said "ok pour tout" (2026-11-24).
8. Non-blocking. Where the README says where Orca declares the hook. Recommended: a short new section "## Set up a new workspace" right after "## Install cstack". It says that `cstack` no longer runs a setup command, that Orca runs `scripts.setup` of `orca.yaml` in each new workspace, what this repository declares there, and that `cstack` refuses `setupCommand` and `watchIntervalMinutes`. I will do this unless the user says no. Answer: accepted by default, the user said "ok pour tout" (2026-11-24).

### Architecture options

No real choice remained after the question round, so no blueprint was drawn. No new decision since the question round.
