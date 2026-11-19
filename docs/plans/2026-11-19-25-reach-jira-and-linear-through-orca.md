# Plan: #25 — M3-2: Reach Jira and Linear through Orca

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/25
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/tracker-jira-linear
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T14:25:34+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** When Orca is connected to a team's Jira or Linear, cstack updates the tickets through Orca, so these updates are no longer refused.

- **What the title means**: cstack is the command-line tool that this project builds, a program that you run by typing a command in a terminal. Jira and Linear are two trackers, the tools that hold a team's tickets. Orca is a desktop app that runs several coding agents side by side. Once the user has connected Orca to Jira or Linear, its command-line tool `orca` can read and update their tickets. "Reach Jira and Linear through Orca" means that cstack uses those `orca` commands to read a ticket, list the tickets of a group, move a ticket to another state, and add a comment.
- **Why we are doing it**: `resolve-issue` is the skill that takes one ticket all the way to a pull request. Past runs of it saw a write to the tracker refused, even after the user had approved it. Orca already holds a working connection to Jira and Linear, and cstack can use it. A permission rule is a line in the settings of Claude Code that lets Claude run a command without asking. One such rule then covers every write that cstack makes.
- **For the user**: A solution engineer on Jira or Linear sees the ticket moved and commented without being asked for permission again and again. A run no longer stops halfway because of a refused write.

**Goal.** This ticket makes the tracker interface of #24 work for Jira and Linear through Orca, as US-16 asks. Greenfield: nothing exists yet.

### Where things are today (read first)

* **cstack**: Greenfield: no existing surface. When this ticket was written, cstack did not exist yet. #24 writes the tracker interface, the Orca adapter and the recorded Orca answers that this ticket builds on.
* **The problem**: `docs/projects/skills-into-cli.md` (line 15): The retrospectives report that a write to the tracker is refused, even after the user approved it. Line 200 holds US-16 AC1. Line 308 says that `orca jira` cannot link two issues, and that Claude creates such links with its own connection.
* **Tracker writes today**: `skills/resolve-issue/agents/executor.md` (line 21): The executor reaches the tracker through an MCP server, which is a connector that gives Claude access to a tool, or through a command-line client. Line 37 moves the ticket to "in progress" with its exact state name. Lines 83 and 85 add a comment on the ticket and on each dependent ticket. Line 109 moves the ticket to "in review".
* **What the run reads from a ticket**: `skills/resolve-issue/SKILL.md` (line 62): Phase 1 captures the title, the full body, the status, the labels, the parent, the relations to other tickets and the branch name the tracker suggests.
* **Orca Jira commands, version 1.4.259 (from `orca jira --help` and its subcommands)**: `orca jira issue <key> [--site <id>] --json` reads one issue. `orca jira search <jql> [--limit <n>] --json` searches with JQL, the query language of Jira. `orca jira status list <key> --json` lists the transitions that the issue offers. `orca jira status set <key> --to <name>` moves the issue. `orca jira comment add <key> --body-file <path>` adds a comment read from a file. `orca jira connection --json` lists the saved sites. No subcommand links two issues.
* **Orca Linear commands, version 1.4.259 (from `orca linear --help` and its subcommands)**: `orca linear issue <id> --relations --json` reads one issue. The option `--relations` adds its blocking, related and duplicate links. `orca linear list-issues` filters with `--project <project>` and `--parent-id <issue>`. Its help says that it returns every match when `--limit` is left out. It also says that the JSON answer sets `result.truncated` when a cap held results back. `orca linear team states --team <key> --json` lists the workflow states of a team. `orca linear status set <id> --to <state>` takes the exact name of a state. `orca linear comment add <id> --body-file <path>` adds a comment read from a file.
* **Contract**: #24 defines the four methods `readTicket`, `listGroup`, `moveState` and `addComment`, with the `Ticket` shape and the state kinds `todo`, `in-progress`, `finished` and `unknown`. Jira maps its status category: "To Do" is `todo`, "In Progress" is `in-progress`, and "Done" is `finished`. Linear maps its state type: triage, backlog and unstarted are `todo`, started is `in-progress`, and completed and canceled are `finished`. A key must match `^[A-Z][A-Z0-9_]+-[1-9][0-9]*$` before cstack uses it. The Orca adapter runs every call without a shell and checks the shape of each answer. Jira through Orca is available only when Orca has exactly one saved Jira site. Linear through Orca is available only when Orca has at least one connected Linear team. When the feature is not available, reads fall back to the file that Claude writes. Writes then exit with `4`, the common code of #13 for a missing tool, which tells Claude to use its own connection. `moveState` refuses a name that the tracker does not offer, and lists the names it offers.

### Scope

1. Record the answers first. On a Jira sandbox and a Linear sandbox that hold no work data, record the answer of each command listed above, with the script and the placeholders of #24. Store them in `cstack/test/fixtures/orca/1.4.259/`. Check in the recorded answers whether `orca jira issue --json` carries the status category and the issue links. If it does not, the Jira capability that needs the missing field falls back, and the reason says which field is missing.
2. Write the Jira adapter in `cstack/src/tracker/jira-orca.ts`.
   - `readTicket` runs `orca jira issue <key> --json`. It maps the status category to a state kind. It takes the blockers from the issue links of type "is blocked by". When the issue has no links, it uses the footer function of #24.
   - `listGroup` runs `orca jira search` with a JQL query. A milestone becomes `fixVersion = "<name>"`, and an epic becomes `parent = <key>`. The query ends with `ORDER BY key`.
   - Before it builds the query, cstack checks the milestone name. It refuses an empty name, a name longer than 100 characters, and a name with a double quote, a backslash or a control character.
   - `listGroup` passes `--limit 200`. When the answer holds 200 tickets, cstack refuses the list and says that the group has more tickets than it reads.
   - `moveState` first runs `orca jira status list <key> --json`. When the name is not one of the transitions, it refuses and prints the names it found. Otherwise it runs `orca jira status set <key> --to <name>`.
   - `addComment` runs `orca jira comment add <key> --body-file <path>`.
3. Write the Linear adapter in `cstack/src/tracker/linear-orca.ts`.
   - `readTicket` runs `orca linear issue <key> --relations --json`. It maps the state type to a state kind. It takes the blockers from the "blocked by" relations. When the issue has no relations, it uses the footer function.
   - `listGroup` runs `orca linear list-issues --json` without `--limit`. An epic becomes `--parent-id <key>`. A milestone becomes `--project <name>`, because a Linear project is the closest group that this command filters on. When the answer sets `result.truncated`, cstack refuses the list.
   - When the list answer has no relations, `listGroup` reads each ticket with `readTicket` to get its blockers.
   - `moveState` reads the states of the team with `orca linear team states --team <team key> --json`. The team key is the part of the ticket key before the hyphen. When the name is not one of those states, cstack refuses and prints them. Otherwise it runs `orca linear status set <key> --to <name>`.
   - `addComment` runs `orca linear comment add <key> --body-file <path>`.
4. After a command that changes something, an answer with an unexpected shape stops cstack, as #24 says. The message says that cstack cannot tell whether the change happened, and asks you to check the ticket in the tracker.
5. Plug both adapters into the tracker choice of #24, so that `cstack tracker read`, `list`, `move` and `comment` use them with `--tracker jira` or `--tracker linear`. Replace the placeholder handlers of these four commands for Jira and Linear.
6. Leave links between two tickets out of scope. Line 308 of the specification gives that job to Claude.

### Acceptance (TDD)

* `cstack/test/tracker/jira-orca.test.ts`: This test carries US-16 AC1: "When Orca is connected to the tracker, `cstack` reads tickets, moves their state and adds comments through Orca. Orca supports Jira and Linear today." Write first a case where Orca is connected to one Jira site, and see `cstack tracker read` run `orca jira issue` and print the state kind and the blockers from the recorded answer. Then `cstack tracker move` runs `status list` and then `status set`, and `cstack tracker comment` runs `comment add --body-file`. A state name that is not a transition is refused with the list of transitions, and no `status set` runs. With two saved Jira sites, cstack falls back and says why. An issue without links takes its blockers from the footer.
* `cstack/test/tracker/linear-orca.test.ts`: Write first a case where `cstack tracker list --epic <key> --tracker linear` runs `list-issues --parent-id`, and see each ticket with its state kind and its blockers. A recorded answer with `result.truncated` set is refused. A state name that the team does not have is refused with the list of states.
* `cstack/test/tracker/jira-jql.test.ts`: Write first a case where the milestone name holds a double quote, and see cstack refuse it before any `orca` call. A name with a backslash, a newline or more than 100 characters is refused too. A list that reaches 200 tickets is refused.
* `cstack/test/tracker/orca-write-shape.test.ts`: Write first a case where the recorded answer of `status set` has a changed shape, and see cstack stop with the message that asks the user to check the ticket. No second write follows.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A ticket title and body that hold `$(rm -rf ~)`, backticks and a line that asks the reader to run a command appear only in the JSON that cstack prints. They appear in no argument of any `orca` call, which the fake run function of #24 records.

**Size: M** · Blocked by: #24 · Feeds: #31

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

ADRs that already exist and that this ticket must respect:

- ADR-SIC-B, where the run state lives and how its format is versioned: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how `cstack` ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-D, the settings file and the models of the agents: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final`.
- ADR-SIC-F, how `cstack` reaches trackers and forges: `docs/decisions/ADR-SIC-F-tracker-access.md`. `cstack` never holds credentials. It uses command-line clients that are already logged in, or data that Claude hands over in a file.
- ADR-SIC-H, how a `cstack` command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`. A command prints through `io`, returns its exit code, and never calls `process.exit()`.


## Dependencies

clear

The only blocker is #24, "M3-1: Define the Orca adapter and the tracker interface". It is closed as completed, and its code is on `main`.

## Code mapping

**Entry points of #24 that this ticket builds on**

- `cstack/src/tracker/types.ts` defines `Ticket`, `TicketRef`, `Group`, `StateKind` and the `Tracker` interface with `readTicket`, `listGroup`, `moveState` and `addComment`. The two new adapters implement this interface.
- `cstack/src/orca/run.ts` defines `Runner` and `RunResult`. A failed result carries only `exitCode` and `stderr`, not the standard output.
- `cstack/src/orca/call.ts` has `callOrca(run, env, args)`. It runs `ORCA_CLI_COMMAND` or `orca`, and adds `--json` to every command except `--version`. The adapters must not add `--json` themselves.
- `cstack/src/orca/shapes.ts` has the shape table `SHAPES`, `checkShape(command, answer, version, mode)` and `commandOfFixture(file)`. A fixture `jira-issue.one.json` maps to the table key whose words before ` --` are `jira issue`. In "write" mode, `checkShape` already appends "cstack cannot tell whether the change happened. Check the ticket or the worktree by hand." `WriteShapeError` in `cstack/src/tracker/errors.ts` appends the same sentence, so wrapping a write-mode message in `WriteShapeError` would print it twice.
- `cstack/src/orca/features.ts` has `orcaFeatures(run, env).get("jira" | "linear")`. It already decides when Jira and Linear through Orca are available: exactly one saved Jira site, at least one Linear team, and the six commands of each tracker listed by `agent-context`. The adapters do not repeat this check. `openTracker` of #26 uses it.
- `cstack/src/tracker/states.ts` has `jiraStateKind(category)`, which accepts the category name or key (`new`, `indeterminate`, `done`), `linearStateKind(type)`, and `checkStateName(tracker, name, offered)`, which refuses with exit `1` and lists the offered names.
- `cstack/src/tracker/blockers.ts` has `footerBlockers(tracker, body)` and `mergeBlockers(relations, footer)`. A footer-only blocker comes back with the state kind `unknown`, and ADR-SIC-F says the adapter must look up its real state.
- `cstack/src/tracker/keys.ts` has `isValidKey`, `isValidUrl` and `isSafeArgument`. `cstack/src/tracker/checked.ts` wraps any adapter. It checks keys, state names and the body file path before the adapter runs, makes the body path absolute, and checks the key and URL of every returned ticket.
- `cstack/src/tracker/errors.ts` has `TrackerError`, `RefusedArgumentError` (exit `1`), `NoClientError` (exit `4`), `WriteShapeError` and `UnconfirmedWriteError` (exit `5`). Nothing uses the last two yet.
- `cstack/src/tracker/choose.ts` has `createClientChooser`. For Jira and Linear it answers `orca` when the Orca feature is available, the file for reads otherwise, and "none" for writes otherwise.

**Test patterns**

- Tests fake the runner with a map from `args.join(" ")` to a recorded answer, as in `cstack/test/orca/features.test.ts`. No shared fake runner exists yet.
- Recorded answers live in `cstack/test/fixtures/orca/1.4.263/`. The plan of #24 decided that the folder is named after the installed Orca version, `1.4.263`, not `1.4.259`.
- `cstack/test/orca/shapes.test.ts` checks every `.json` fixture of that folder against its shape in read mode. So every new fixture file needs a shape entry, and an answer with a changed shape must be built inside a test, not stored as a fixture.
- `cstack/test/fixtures-public.test.ts` refuses any fixture with a home path, an email outside the reserved domains, or a URL host that is not reserved. Ticket URLs must use `https://jira.example.com` and `https://linear.example.com`.
- `cstack/test/fixtures/orca/README.md` lists which files were recorded and which were written by hand.

**What the installed Orca 1.4.263 really answers**

These facts come from the code of the installed Orca app, read locally under `/Applications/Orca.app`. No command reached Jira or Linear.

- With `--json`, a successful answer is `{"ok": true, "result": …}`. A failure prints `{"ok": false, "error": {"code", "message", "data"}}` on the standard output and exits with `1`. The runner of #24 drops the standard output of a failed run, so cstack cannot read the error code or Orca's retry id today.
- `orca jira issue <key> --json` gives `result` = one issue with `key`, `title`, `description` (text, Markdown-like), `url` (`<site>/browse/<key>`), `status` = `{id, name, categoryKey, categoryName, colorName}`, `parent` = `{key, title, issueTypeName}` and other fields. The status category is there. **The issue links are not**: Orca never reads the Jira `issuelinks` field.
- `orca jira search <jql> --limit <n> --json` gives `result` = a list of issues of the same shape. **Orca caps the limit at 100** (`Math.min(Math.max(1, limit), 100)`), so `--limit 200` returns at most 100 issues. The answer has no "truncated" flag.
- `orca jira status list <key> --json` gives `result` = a list of transitions `{id, name, to: {id, name, categoryKey, categoryName}}`. A transition name, such as "Start progress", is often not the name of the status it leads to, such as "In Progress".
- `orca jira status set <key> --to <name>` lists the transitions itself and accepts a name that matches, without case, either a transition name or its target status name, when exactly one transition matches. Success gives `result` = `{ok: true, …}`. A runtime timeout becomes the error `jira_write_unverified`, which says the change may have happened.
- `orca jira comment add <key> --body-file <path>` reads the body from the file, up to 100,000 characters. Success gives `result` = `{ok: true, …}`.
- `orca linear issue <key> --relations --json` gives `result` = `{issue, relations, meta}`. `issue` has `identifier`, `title`, `url`, `description`, `state` = `{name, type, color}` and `team` = `{id, name, key}`. Each relation is `{id, type, direction, relationship, relatedIssue: {id, identifier, title, url}}`, and `relationship` is `blockedBy` for a blocker. A relation carries no state, so each blocker needs its own read. `meta.includeErrors` lists a section that failed to load, and `meta.sections.relations.hasMore` says the list was cut at 100.
- `orca linear list-issues --json` gives `result` = `{issues, truncated, meta: {limit, returned, hasMore, partial, workspaceErrors}}`. Each issue has the same fields as above, with `state.type`, but no relations. Without `--limit`, Orca reads page after page until it ends or a deadline passes, and `truncated` is then `true`. `meta.partial` is `true` when a Linear workspace failed to answer.
- `orca linear team states --team <key> --json` gives `result` = `{team, states: [{id, name, type}]}`.
- `orca linear status set <key> --to <state> --json` gives `result` = `{issue, state, meta: {alreadyInState}}`.
- `orca linear comment add <key> --body-file <path> --json` gives `result` = `{comment: {id}, issue: {identifier}, meta: {deduplicated}}`. An unconfirmed write gives the error `linear_write_unconfirmed`, with `error.data.writeId` when Orca can replay it.

**Files to create**

- `cstack/src/tracker/jira-orca.ts` and `cstack/src/tracker/linear-orca.ts`, with the factories `jiraOrcaTracker(run, env)` and `linearOrcaTracker(run, env)` that the coordinator fixed.
- The tests `cstack/test/tracker/jira-orca.test.ts`, `linear-orca.test.ts`, `jira-jql.test.ts` and `orca-write-shape.test.ts`, and the fixtures of the ten commands in `cstack/test/fixtures/orca/1.4.263/`.

**Files to change**

- `cstack/src/orca/shapes.ts` gains one shape per new command. Its only commit so far is the one of #24, so it is stable.
- `cstack/test/fixtures/orca/README.md` gains the list of the new files and how they were made.
- This ticket does not touch `cstack/src/manifest.ts`, `cstack/src/cli.ts` or the command files, because #26 owns them in this wave. Only the branch that merges second between #25 and #26 wires the adapters into `openTracker`.

**Risks**

- Jira blockers cannot come from issue links through Orca 1.4.263, so they come from the ticket footer alone. Each footer blocker then needs one more `orca jira issue` call to learn its state.
- A Jira group of 100 tickets or more cannot be read whole through Orca 1.4.263.
- Linear relations carry no state, so a list of N tickets costs one list call, N issue reads for the relations, and one read for each blocker whose state is not already known.
- No Jira or Linear sandbox may be reached from this machine, because the Orca connections here reach work trackers. Every answer must be written by hand from the Orca code above, unless the user names a sandbox.
- `cstack/src/orca/run.ts` and `cstack/src/tracker/errors.ts` are shared with #26, #27 and #29. A change there risks a merge conflict.

**Governing decisions**

- ADR-SIC-F: cstack holds no credential, uses the clients that are already logged in, and refuses a write with exit `4` when no client is left. Every key, state name and path is checked before a program runs, and text from a ticket never becomes a command. An adapter must look up the real state of a footer-only blocker.
- ADR-SIC-H: a command prints through `io`, returns its exit code, and never calls `process.exit()`.
- ADR-SIC-E: nothing under the top-level `skills/` folder changes.
- The plan of #24: the recorded answers live in `1.4.263/`; only read-only Orca commands ever run on this machine; a fixture whose command has no shape fails the shape test; a shape error after a write stops cstack with exit `5`.
- The spec, line 308, and ADR-SIC-F: links between two tickets stay with Claude.
- The `WHY:` comments in `choose.ts` and `claude-file.ts` restate ADR-SIC-F.

## Decisions

- The recorded or hand-written answers live in `cstack/test/fixtures/orca/1.4.263/`, not `1.4.259/`, because the folder is named after the installed Orca version. Wherever the ticket says `1.4.259/`, read `1.4.263/`. (2026-11-19, upstream decision of #24)
- Never run `orca jira` or `orca linear` on this machine, except `--help`, and never record anything from the Jira or Linear connections here, because they reach work trackers. Reading the code of the installed Orca app is allowed. (2026-11-19, user's brief)
- #25 writes only `cstack/src/tracker/jira-orca.ts` and `cstack/src/tracker/linear-orca.ts`, with their tests and answers. It exports `jiraOrcaTracker(run, env)` and `linearOrcaTracker(run, env)`, each returning a `Tracker`. It does not create `cstack/src/tracker/open.ts`, the four `tracker-*.ts` command files, or their manifest entries, which #26 owns. (2026-11-19, coordinator's brief)
- The adapters are tested directly, through their factory functions and a fake runner that answers with the recorded answers. Wherever the acceptance says that `cstack tracker read`, `list`, `move` or `comment` runs an Orca command, the test calls `readTicket`, `listGroup`, `moveState` or `addComment` of the adapter instead. (2026-11-19, coordinator's brief)
- Whichever of #25 and #26 merges second wires `jiraOrcaTracker` and `linearOrcaTracker` into `openTracker`, removes the refusal that names #25, and adds a test that `cstack tracker read <key> --tracker jira` reaches the Jira adapter with the recorded answers. If #26 merges before this branch opens its pull request, this branch does that work and updates the counts of built and unbuilt commands. (2026-11-19, coordinator's brief)
- The interface of `openTracker` and the four factory functions do not change. A change needs the coordinator first. (2026-11-19, coordinator's brief)
- This ticket builds no command, so the counts of built and unbuilt commands in `cstack/test/manifest.test.ts` and `README.md` do not change, unless this branch does the wiring above. (2026-11-19, assumption not asked)
- The adapters do not check whether the Orca feature is available. `openTracker` does that with `orcaFeatures` and `createClientChooser` of #24. The test of the fallback with two saved Jira sites composes those two functions. (2026-11-19, assumption not asked)
- The adapters run Orca only through `callOrca` of #24, which adds `--json`. They never add `--json` themselves and never start a shell. (2026-11-19, upstream decision of #24)
- A Linear list whose answer sets `result.truncated` is refused with exit `1`, because the group has more tickets than Orca returned. A Linear list whose answer sets `result.meta.partial` stops with exit `5`, because a Linear workspace did not answer. (2026-11-19, assumption not asked)
- A Linear issue whose relations did not load whole, because `meta.includeErrors` names them or `meta.sections.relations.hasMore` is `true`, is treated as an issue without relations. Its blockers then come from the footer alone. (2026-11-19, assumption not asked)
- A blocker whose state is unknown after the merge of #24 is read with `orca jira issue <key>` or `orca linear issue <key> --relations`, unless the same call of `listGroup` already knows its state. Each adapter keeps a map from key to state for the length of one `listGroup` call, so a blocker is read at most once. A blocker that cannot be read keeps the state kind `unknown`, which the ready rule treats as not finished. (2026-11-19, assumption not asked, accepted by default)
- A key that comes from a tracker answer, such as a Linear relation, goes into an Orca argument only after it passes `isValidKey`. A bad key is left in the ticket unread, so that the checked wrapper of #24 refuses or skips that ticket. (2026-11-19, assumption not asked)
- The answers of the ten Orca commands are written by hand from the code of the installed Orca 1.4.263, because the user has no Jira or Linear sandbox. This plan and `cstack/test/fixtures/orca/README.md` say that these files were written by hand and not recorded, and the README names the Orca code each shape comes from. (2026-11-19, user's answer)
- Every hand-written answer uses only placeholder values: ticket keys such as `EXA-1`, `https://jira.example.com` and `https://linear.example.com` URLs, `Example Person`, `Example Team` and `id-placeholder`. Run `python3 scripts/private_names.py check cstack/test/fixtures` before committing a fixture. (2026-11-19, upstream decision of #24)
- A Jira list runs `orca jira search <jql> --limit 100`, because Orca 1.4.263 caps the limit at 100. cstack refuses the list with exit `1` when the answer holds 100 tickets or more, and says that the group has more tickets than cstack reads through Orca. This replaces the ticket's `--limit 200` and its refusal at 200. (2026-11-19, user's answer)
- A milestone name for a Jira query is refused with exit `1`, before any Orca call, when it is empty, longer than 100 characters, or holds a double quote, a backslash or a control character. A milestone becomes `fixVersion = "<name>" ORDER BY key`, and an epic becomes `parent = <key> ORDER BY key`. (2026-11-19, ticket)
- A Jira list by milestone is refused with exit `1` when the returned keys have more than one project prefix, because a Jira version belongs to one project and the same name can exist in several projects. (2026-11-19, assumption accepted by default)
- A Jira list by epic that returns no ticket is refused with exit `1`. The message says that the epic has no child through `parent =`, which happens on Jira Server and Data Center, where epic children hang on the Epic Link field. (2026-11-19, assumption accepted by default)
- Jira blockers come from the footer line of the ticket alone, because Orca 1.4.263 never returns Jira issue links. Before calling `footerBlockers`, the adapter removes the backslash escapes that Orca adds to plain text, such as `\*`. `Ticket.body` keeps the description exactly as Orca gave it. Each footer blocker is then read to learn its state. This follows ADR-SIC-F instead of the ticket's fallback to the file. (2026-11-19, user's answer)
- A Jira ticket maps `status.categoryKey` with `jiraStateKind` of #24, and keeps `status.name` as `stateName`. (2026-11-19, ticket and code mapping)
- A Jira move reads the transitions with `orca jira status list <key>`. It accepts a name that is exactly a transition name or the name of the status that a transition leads to. When exactly one transition matches, it runs `orca jira status set <key> --to-id <transition id>`. When none or several match, it refuses with exit `1` before any write, and lists the names it found. The transition id must be digits only before it becomes an argument. (2026-11-19, assumption accepted by default)
- Before refusing a Jira move, the adapter reads the issue. When its status name already equals the target name, compared without case, the move succeeds without any write, so that a resumed run is not refused. (2026-11-19, assumption accepted by default)
- A Linear list by milestone throws `NoClientError.forRead`, which exits with `4`, and its message says that Orca cannot filter Linear issues by project milestone. Claude then writes the file with its own connection. A Linear list by epic runs `orca linear list-issues --parent-id <key>` without `--limit`. (2026-11-19, user's answer)
- When a Linear list answer has no relations, `listGroup` reads each ticket with `orca linear issue <key> --relations` to get its blockers. (2026-11-19, ticket)
- Every Linear issue read uses `orca linear issue <key> --relations`, including the read of a blocker, so that one shape and one fixture name cover every Linear issue answer. (2026-11-19, assumption accepted by default)
- A Linear ticket maps `issue.state.type` with `linearStateKind` of #24, and keeps `issue.state.name` as `stateName`. A relation is a blocker when its `relationship` is `blockedBy`, and its key is `relatedIssue.identifier`. (2026-11-19, ticket and code mapping)
- A Linear move first reads the issue with `orca linear issue <key> --relations` and takes the team key from `issue.team.key`, not from the prefix of the ticket key, because Linear keeps old keys working after a team is renamed. The team key must match `^[A-Z][A-Z0-9_]*$` before it becomes an argument. The move then runs `orca linear team states --team <team key>`, refuses with exit `1` a name that is not one of the states and lists them, and otherwise runs `orca linear status set <key> --to <name>`. (2026-11-19, assumption accepted by default)
- A comment runs `orca jira comment add <key> --body-file <path>` or `orca linear comment add <key> --body-file <path>`. Before any call, the adapter reads the body file as UTF-8 and refuses with exit `1` a file that cannot be read, a body that is blank, or a body longer than 100,000 characters on Jira or 65,000 on Linear, counted as JavaScript string length. (2026-11-19, assumption accepted by default)
- A read that Orca answers with a failure, a timeout, too much output, text that is not JSON, `ok: false` or a bad shape stops with exit `5`, and the message names the command. When Orca is not installed at all (the runner result `missing`), a read or a write throws `NoClientError` with exit `4`, because nothing ran. (2026-11-19, assumption not asked)
- Once Orca has run a write, every failure gives exit `5` and never exit `4`, because exit `4` asks Claude to do the write itself, and a comment would then appear twice. The runner results `failed`, `timeout` and `too-large`, an answer that is not JSON, `ok: false`, and a shape error all give exit `5`. The message says that cstack cannot tell whether the change happened, and asks the user to check the ticket in the tracker before trying again. Only the runner result `missing`, where Orca did not run at all, gives exit `4`. (2026-11-19, assumption accepted by default)
- The exit `5` errors reuse `WriteShapeError` and `TrackerError` with `EXIT.toolFailed` of #24. No new error class goes into `cstack/src/tracker/errors.ts`, and `cstack/src/orca/run.ts` does not change, because #26, #27 and #29 share these files. cstack does not show Orca's retry id. (2026-11-19, assumption accepted by default)
- To report a shape error, the adapter reads `orca --version` only at that moment, so that a normal call costs no extra Orca call. (2026-11-19, assumption not asked)
- The shape table of `cstack/src/orca/shapes.ts` gains one entry for each of the ten commands. The fixture names are `jira-issue`, `jira-search`, `jira-status-list`, `jira-status-set`, `jira-comment-add`, `linear-issue`, `linear-list-issues`, `linear-team-states`, `linear-status-set` and `linear-comment-add`, each followed by a case and `.json`. An answer with a changed shape is built inside a test, never stored as a fixture. (2026-11-19, assumption not asked)
- The pull request says in one line that Jira blockers come from the footer, as ADR-SIC-F says, and not from a fallback to the file. It also lists the question for the Orca maintainers as an open question that this pull request does not need. (2026-11-19, user's answer)
- The title and the body of a ticket are data only. They never appear in an argument of an Orca call. (2026-11-19, ticket and ADR-SIC-F)
- After a write, a shape error is reported with `WriteShapeError` of #24, built from the read-mode message of `checkShape`, so that the sentence "cstack cannot tell whether the change happened" appears once. (2026-11-19, assumption not asked)
- Links between two tickets stay out of scope, because the spec gives that job to Claude. (2026-11-19, ticket and ADR-SIC-F)
- Never edit anything under the top-level `skills/` folder, never change `.cstack/settings.json`, never change anything under `~/.claude/skills/`, and never run `npm install -g`, `npm link` or `cstack skills install`. (2026-11-19, user's brief)
- Never change the git `user.email` of the repository. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never push a tag that starts with `v`. Never merge the pull request. (2026-11-19, user's brief)
- Before `cstack publish`, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`, and `python3 scripts/private_names.py check` exits `0` on a temporary file outside the repository that holds `git log -p origin/main..HEAD` and the drafted pull request title and body. (2026-11-19, user's brief)
- On GitHub, "in progress" is the label `in progress`, and "in review" means removing `in progress` and adding `in review`. (2026-11-19, user's brief)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure: rerun it with `gh run rerun <run id>`. (2026-11-19, user's brief)
- After the pull request is open, take `origin/main` with a merge commit only when the coordinator asks, keep both changes, push without force, update the command counts, run the whole suite, and look for a function that git kept twice in `cli.ts`. (2026-11-19, user's brief)

## Architecture

The approach is locked by the ticket, the coordinator's split and the answers. Two adapters implement the `Tracker` interface of #24: `jiraOrcaTracker(run, env)` in `cstack/src/tracker/jira-orca.ts` and `linearOrcaTracker(run, env)` in `cstack/src/tracker/linear-orca.ts`. Both call Orca through one small new file, `cstack/src/tracker/orca-calls.ts`. It runs a command with `callOrca`, parses the JSON, checks `ok` and the shape, and turns every failure into the right error: exit `5` for a failed read, exit `5` with "cstack cannot tell whether the change happened" for a failed write, and exit `4` only when Orca is not installed. It also checks a comment body file before any write. The shape of each answer is declared in `cstack/src/orca/shapes.ts`. No shared file of the wave changes, apart from that shape table and the fixture README.

No new decision since the question round.

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

Security: this work has no endpoint, no database and no secret. Its external input is the text of a ticket and the answers of Orca. The checks against injection are tests of units 4, 5 and 7: a ticket title or body never reaches an Orca argument, a milestone name with a quote or a backslash never reaches a JQL query, and a key from a tracker answer reaches an argument only after `isValidKey`.

### Unit 1: Shapes and hand-written answers of the Jira commands
- Files: `cstack/src/orca/shapes.ts`, `cstack/test/orca/shapes.test.ts`, `cstack/test/fixtures/orca/1.4.263/jira-issue.in-progress.json`, `cstack/test/fixtures/orca/1.4.263/jira-issue.done.json`, `cstack/test/fixtures/orca/1.4.263/jira-search.epic.json`, `cstack/test/fixtures/orca/1.4.263/jira-status-list.current.json`, `cstack/test/fixtures/orca/1.4.263/jira-status-set.ok.json`, `cstack/test/fixtures/orca/1.4.263/jira-comment-add.ok.json`, `cstack/test/fixtures/orca/README.md`
- Test: `cstack/test/orca/shapes.test.ts`: `checkShape("orca jira issue --json", …)` accepts `jira-issue.in-progress.json` and throws a `ShapeError` naming `result.status.categoryKey` when that field is removed; `checkShape("orca jira search --json", …)` throws when an element of `result` has no `key`.
- Minimum code: add to `SHAPES` the entries `orca jira issue --json` (`ok` boolean; `result.key`, `result.title`, `result.description`, `result.url`, `result.status.name`, `result.status.categoryKey` strings), `orca jira search --json` (`ok`; `result[].key`, `result[].title`, `result[].description`, `result[].url`, `result[].status.name`, `result[].status.categoryKey`), `orca jira status list --json` (`ok`; `result[].id`, `result[].name`, `result[].to.name`), `orca jira status set --json` (`ok`; `result.ok` boolean) and `orca jira comment add --json` (`ok`; `result.ok` boolean). Write the six answers by hand.
- Refactor: none.
- Commit message: feat(cli): declare the shapes of the Orca Jira answers and write those answers by hand
- Depends on: none

The answers copy the envelope of `jira-connection.one-site.json`: `id`, `ok`, `result` and `_meta`. The issue shape is the one Orca builds: `id`, `key`, `siteId`, `siteName`, `title`, `description`, `url` (`https://jira.example.com/browse/<key>`), `project`, `issueType`, `status` (`id`, `name`, `categoryKey`, `categoryName`, `colorName`), `labels`, `assignee`, `reporter`, `priority`, `parent`, `createdAt` and `updatedAt`. `jira-issue.in-progress.json` is `EXA-1`, status "In Progress", category key `indeterminate`, and its description ends with the footer line `**Size: M** · Blocked by: EXA-2 · Feeds: EXA-3`. `jira-issue.done.json` is `EXA-2`, status "Done", category key `done`, with a footer `Blocked by: none`. `jira-search.epic.json` holds two issues of project `EXA`, `EXA-1` and `EXA-4`. `jira-status-list.current.json` holds three transitions: id `21` "Start progress" to "In Progress", id `31` "Ask for review" to "In Review", id `41` "Finish" to "Done". `jira-status-set.ok.json` and `jira-comment-add.ok.json` have `result` = `{"ok": true}`. Use only placeholder values. The README gains a section that lists these files as written by hand from the code of the installed Orca 1.4.263, not recorded, because there is no Jira sandbox and the connections of the recording machine reach work trackers. Run `python3 scripts/private_names.py check cstack/test/fixtures` before the commit.

### Unit 2: Shapes and hand-written answers of the Linear commands
- Files: `cstack/src/orca/shapes.ts`, `cstack/test/orca/shapes.test.ts`, `cstack/test/fixtures/orca/1.4.263/linear-issue.blocked.json`, `cstack/test/fixtures/orca/1.4.263/linear-issue.done.json`, `cstack/test/fixtures/orca/1.4.263/linear-list-issues.epic.json`, `cstack/test/fixtures/orca/1.4.263/linear-list-issues.truncated.json`, `cstack/test/fixtures/orca/1.4.263/linear-team-states.current.json`, `cstack/test/fixtures/orca/1.4.263/linear-status-set.ok.json`, `cstack/test/fixtures/orca/1.4.263/linear-comment-add.ok.json`, `cstack/test/fixtures/orca/README.md`
- Test: `cstack/test/orca/shapes.test.ts`: `checkShape("orca linear issue --relations --json", …)` accepts `linear-issue.blocked.json` and throws naming `result.issue.identifier` when it is removed; `checkShape("orca linear list-issues --json", …)` throws when `result.truncated` is a string.
- Minimum code: add to `SHAPES` the entries `orca linear issue --relations --json` (`ok`; `result.issue.identifier`, `result.issue.title`, `result.issue.url` strings; `result.meta.includeErrors` array), `orca linear list-issues --json` (`ok`; `result.issues[].identifier`, `result.issues[].title`, `result.issues[].url`; `result.truncated` boolean; `result.meta.partial` boolean), `orca linear team states --json` (`ok`; `result.states[].name`), `orca linear status set --json` (`ok`; `result.issue.identifier`, `result.state.name`) and `orca linear comment add --json` (`ok`; `result.comment.id`, `result.issue.identifier`). Write the seven answers by hand.
- Refactor: none.
- Commit message: feat(cli): declare the shapes of the Orca Linear answers and write those answers by hand
- Depends on: 1

`description`, `state`, `team` and `relations` can be `null` or missing in a real Linear answer, so the shape does not list them, and the adapter checks them when it reads them. The issue context is `{issue, relations, meta}`. `issue` has `id`, `identifier`, `title`, `url` (`https://linear.example.com/…`), `description`, `state` (`name`, `type`, `color`), `team` (`id`, `name`, `key`), `project`, `labels`, `priority`, `branchName`, `createdAt` and `updatedAt`. Each relation is `{id, type, direction, relationship, relatedIssue: {id, identifier, title, url}}`. `meta` has `requested`, `resolved`, `partial`, `includeErrors` and `sections` (`relations`: `{returned, limit, hasMore}`). `linear-issue.blocked.json` is `EXA-1` in state "In Progress" of type `started`, with one relation whose `relationship` is `blockedBy` and whose related issue is `EXA-2`. `linear-issue.done.json` is `EXA-2` in state "Done" of type `completed`, with no relation. `linear-list-issues.epic.json` holds `EXA-1` and `EXA-3`, `truncated: false` and `meta.partial: false`. `linear-list-issues.truncated.json` is the same with `truncated: true`. `linear-team-states.current.json` is team `EXA` with the states Backlog (`backlog`), Todo (`unstarted`), In Progress (`started`), In Review (`started`), Done (`completed`) and Canceled (`canceled`). `linear-status-set.ok.json` is `{issue, state, meta: {alreadyInState: false}}`, and `linear-comment-add.ok.json` is `{comment: {id}, issue: {identifier}, meta: {deduplicated: false}}`. The README lists these files as written by hand, like the Jira ones. Run `python3 scripts/private_names.py check cstack/test/fixtures` before the commit.

### Unit 3: One helper that calls Orca and maps its failures
- Files: `cstack/src/tracker/orca-calls.ts`, `cstack/test/tracker/orca-calls.test.ts`, `cstack/test/fakes/orca-run.ts`
- Test: `cstack/test/tracker/orca-calls.test.ts`: a write whose runner result is `failed` throws an error with exit code `5` whose message says that cstack cannot tell whether the change happened, while the same result on a read gives exit `5` with the command name, and a `missing` result gives `NoClientError` (exit `4`) on both.
- Minimum code: `orcaRead(run, env, shape, args)` and `orcaWrite(run, env, shape, args)` call `callOrca`, parse the JSON, treat `ok: false` as a failure, and check the shape with `checkShape(shape, body, version, "read")`. A write wraps a shape error in `WriteShapeError`. Any other write failure throws `TrackerError` with `EXIT.toolFailed` and the same "cannot tell" sentence. The Orca version for a message is read with `orca --version` only when a shape error must be reported. `checkCommentBody(path, cap)` reads the file as UTF-8 and throws `RefusedArgumentError` when it cannot be read, is blank, or is longer than `cap` characters. `cstack/test/fakes/orca-run.ts` exports a fake runner that answers from a map keyed by `args.join(" ")`, records every call with its arguments, and throws on a call it has no answer for.
- Refactor: none.
- Commit message: feat(cli): add one helper that calls Orca for the trackers and maps each failure to its exit code
- Depends on: none

No new class goes into `cstack/src/tracker/errors.ts`, and `cstack/src/orca/run.ts` does not change. The helper never adds `--json`, because `callOrca` adds it. A key in the fake runner therefore ends with `--json`, as in `jira issue EXA-1 --json`.

### Unit 4: Read one Jira ticket through Orca
- Files: `cstack/src/tracker/jira-orca.ts`, `cstack/test/tracker/jira-orca.test.ts`
- Test: `cstack/test/tracker/jira-orca.test.ts`: `jiraOrcaTracker(run, env).readTicket("EXA-1")` runs `jira issue EXA-1 --json`, then `jira issue EXA-2 --json`, and returns the state kind `in-progress`, the state name "In Progress", and the blockers `[{key: "EXA-2", stateKind: "finished"}]`.
- Minimum code: export `jiraOrcaTracker(run, env)`. `readTicket` reads the issue with `orcaRead` and the shape `orca jira issue --json`, maps `status.categoryKey` with `jiraStateKind`, keeps the description as `body`, and takes the blockers with `footerBlockers("jira", unescaped body)` and `mergeBlockers(undefined, …)`. It then reads the state of each blocker whose key passes `isValidKey`. A blocker that cannot be read keeps `unknown`.
- Refactor: none.
- Commit message: feat(cli): read a Jira ticket through Orca with the blockers of its footer
- Depends on: 1, 3

More cases of the same test file. A description whose footer is escaped as `\*\*Size: S\*\* · Blocked by: EXA-2` gives the same blocker. A description without a footer gives the blockers `unknown` and no second call. A title and a body that hold `$(rm -rf ~)`, backticks and a line asking the reader to run a command come back unchanged in the ticket, and appear in no argument of any recorded call. With two saved Jira sites, `orcaFeatures(run, env).get("jira")` of #24 says Jira is not available and why, and `createClientChooser` gives the file for a read and "none" for a move. Build these variants inside the test from the unit 1 answers.

### Unit 5: List a Jira group through Orca, with the checks of the query
- Files: `cstack/src/tracker/jira-orca.ts`, `cstack/test/tracker/jira-jql.test.ts`
- Test: `cstack/test/tracker/jira-jql.test.ts`: `listGroup({milestone: 'M3 "x"'})` throws `RefusedArgumentError` before any Orca call.
- Minimum code: export `jiraGroupQuery(group)`. It refuses an empty milestone name, a name longer than 100 characters, and a name with a double quote, a backslash or a control character. It returns `fixVersion = "<name>" ORDER BY key` or `parent = <key> ORDER BY key`. `listGroup` runs `jira search <query> --limit 100` with the shape `orca jira search --json`, refuses an answer of 100 tickets or more, refuses a milestone list whose keys have more than one project prefix, and refuses an empty epic list with a message about the Epic Link field of Jira Server. Each ticket is built as in `readTicket`. A blocker found in the same list takes its state from there, and the other blockers are read once each.
- Refactor: share the building of a ticket from an Orca issue between `readTicket` and `listGroup`.
- Commit message: feat(cli): list a Jira group through Orca with a checked JQL query and a cap of 100 tickets
- Depends on: 4

More cases of the same test file. A name with a backslash, a newline, or 101 characters is refused with no Orca call. An answer of 100 tickets is refused, and the message says that the group has more tickets than cstack reads through Orca. A milestone list that returns `EXA-1` and `OTH-2` is refused. An empty epic list is refused. The epic list of `jira-search.epic.json` runs `jira search parent = EXA-9 ORDER BY key --limit 100 --json` as separate arguments, with the query as one argument.

### Unit 6: Move and comment a Jira ticket through Orca
- Files: `cstack/src/tracker/jira-orca.ts`, `cstack/test/tracker/jira-orca.test.ts`, `cstack/test/tracker/orca-write-shape.test.ts`
- Test: `cstack/test/tracker/jira-orca.test.ts`: `moveState("EXA-1", "In Review")` runs `jira status list EXA-1 --json`, then `jira status set EXA-1 --to-id 31 --json`, and nothing else.
- Minimum code: `moveState` reads the transitions and keeps those whose name or target status name equals the asked name exactly. With exactly one match, whose id is digits only, it writes with `orcaWrite`, the shape `orca jira status set --json` and `--to-id <id>`. With none or several, it reads the issue, returns without writing when its status name equals the asked name without case, and otherwise refuses with `checkStateName("jira", name, offered)`, where `offered` holds every transition name and target status name. `addComment` calls `checkCommentBody(path, 100000)`, then writes `jira comment add <key> --body-file <path>` with the shape `orca jira comment add --json`.
- Refactor: none.
- Commit message: feat(cli): move and comment a Jira ticket through Orca
- Depends on: 5

More cases. The transition name "Start progress" also works. A name that is not offered is refused with the list of names, and no `status set` runs. A ticket already in "In Review" asked to move to "in review" succeeds with no write. `addComment` runs `jira comment add EXA-1 --body-file <path> --json`. A blank body and a body of 100,001 characters are refused with no Orca call. In `cstack/test/tracker/orca-write-shape.test.ts`, an answer of `status set` whose `result` lost its `ok` field makes `moveState` throw `WriteShapeError` with exit `5` and the message asking to check the ticket, and the fake runner records no call after that write. A `status set` that fails with exit code `1` gives exit `5` and the same message, never exit `4`.

### Unit 7: Read one Linear ticket through Orca
- Files: `cstack/src/tracker/linear-orca.ts`, `cstack/test/tracker/linear-orca.test.ts`
- Test: `cstack/test/tracker/linear-orca.test.ts`: `linearOrcaTracker(run, env).readTicket("EXA-1")` runs `linear issue EXA-1 --relations --json`, then `linear issue EXA-2 --relations --json`, and returns the state kind `in-progress` and the blockers `[{key: "EXA-2", stateKind: "finished"}]`.
- Minimum code: export `linearOrcaTracker(run, env)`. `readTicket` reads the issue with the shape `orca linear issue --relations --json`, maps `issue.state.type` with `linearStateKind`, or `unknown` when the state is missing, and uses an empty string for a missing description. The relations count only when `result.relations` is a list, `meta.includeErrors` names no `relations` section, and `meta.sections.relations.hasMore` is not `true`. The blocker keys are the `relatedIssue.identifier` of the relations whose `relationship` is `blockedBy`. They are merged with `mergeBlockers` and `footerBlockers("linear", body)`, and each blocker with an unknown state and a valid key is read once.
- Refactor: none.
- Commit message: feat(cli): read a Linear ticket through Orca with its blocking relations
- Depends on: 2, 3

More cases. When `meta.includeErrors` names the relations, the blockers come from the footer alone. A relation whose identifier fails `isValidKey` is never passed to Orca. A title and a body that hold `$(rm -rf ~)` and backticks appear in no argument of any call.

### Unit 8: List a Linear group through Orca
- Files: `cstack/src/tracker/linear-orca.ts`, `cstack/test/tracker/linear-orca.test.ts`
- Test: `cstack/test/tracker/linear-orca.test.ts`: `listGroup({epic: "EXA-9"})` runs `linear list-issues --parent-id EXA-9 --json` with no `--limit`, then reads each listed ticket, and returns each one with its state kind and its blockers.
- Minimum code: `listGroup` with an epic runs `list-issues --parent-id <key>` with the shape `orca linear list-issues --json`. It refuses with exit `1` an answer with `truncated: true`, and stops with exit `5` on `meta.partial: true`. It reads each listed ticket as `readTicket` does, with a map from key to state that holds the states of the list, so that each blocker is read at most once. `listGroup` with a milestone throws `NoClientError`, whose message says that Orca cannot filter Linear issues by project milestone, before any Orca call.
- Refactor: none.
- Commit message: feat(cli): list the tickets of a Linear epic through Orca and send milestones back to Claude
- Depends on: 7

More cases. `linear-list-issues.truncated.json` is refused. An answer with `meta.partial: true` stops with exit `5`. A milestone list throws `NoClientError` with exit `4` and runs no Orca call. A blocker that is also in the list is not read a second time.

### Unit 9: Move and comment a Linear ticket through Orca
- Files: `cstack/src/tracker/linear-orca.ts`, `cstack/test/tracker/linear-orca.test.ts`, `cstack/test/tracker/orca-write-shape.test.ts`
- Test: `cstack/test/tracker/linear-orca.test.ts`: `moveState("EXA-1", "Blocked")` runs `linear issue EXA-1 --relations --json` and `linear team states --team EXA --json`, then refuses with exit `1` and the list of states, and runs no `status set`.
- Minimum code: `moveState` reads the issue, takes `issue.team.key`, checks it against `^[A-Z][A-Z0-9_]*$`, reads the team states, refuses with `checkStateName("linear", name, names)`, and otherwise writes `linear status set <key> --to <name>` with the shape `orca linear status set --json`. `addComment` calls `checkCommentBody(path, 65000)`, then writes `linear comment add <key> --body-file <path>` with the shape `orca linear comment add --json`.
- Refactor: none.
- Commit message: feat(cli): move and comment a Linear ticket through Orca
- Depends on: 6, 8

More cases. `moveState("EXA-1", "In Review")` runs `linear status set EXA-1 --to In Review --json`, with "In Review" as one argument. The team comes from the answer even when the ticket key has another prefix. `addComment` runs `linear comment add EXA-1 --body-file <path> --json`. A body of 65,001 characters is refused with no call. In `cstack/test/tracker/orca-write-shape.test.ts`, an answer of `linear status set` with no `result.state` gives `WriteShapeError` with exit `5`, and a `comment add` that times out gives exit `5` with the message asking to check the ticket.

## Documentation duties

- The fixture README `cstack/test/fixtures/orca/README.md`: applies, written in units 1 and 2. It says which answers were written by hand and from which Orca code.
- The specification page `docs/projects/skills-into-cli.md`: applies, written in the documentation phase. Under US-16 or in section 7, it says what Orca 1.4.263 cannot do and how cstack copes: Jira blockers come from the footer, a Jira group is read up to 99 tickets, and a Linear list by milestone goes back to Claude with exit `4`.
- A new ADR: does not apply. ADR-SIC-F already decides how cstack reaches the trackers, and this ticket follows it.
- The repository `README.md`: does not apply, because this ticket builds no command. It applies only if this branch wires the adapters into `openTracker`, and then only for the counts of built and unbuilt commands.
- A comment on this ticket and on the ticket it feeds (#31): applies, written in the documentation phase.

## Blocking questions

### Question 1: Where the Jira and Linear answers come from
Which Jira site and which Linear workspace, holding no work data, may I record the Orca answers from? If you have none, may I write the answers by hand from the code of the installed Orca 1.4.263? Its `--help` gives the commands and flags but not the shape of the JSON answers, while its code gives every field. The plan and the fixture folder would then say that these answers were written by hand and not recorded.
- For: the user
- Answer: The user has no Jira or Linear sandbox. Write the answers by hand from the code of the installed Orca 1.4.263, and say so in this plan and in the fixture README. (user's answer, 2026-11-19)

### Question 2: A Jira group is read up to 100 tickets, not 200
Orca 1.4.263 caps `orca jira search --limit` at 100, so `--limit 200` returns at most 100 tickets and the refusal at 200 would never happen. May cstack pass `--limit 100` and refuse a Jira list when the answer holds 100 tickets, saying that the group has more tickets than cstack reads through Orca?
- For: the user
- Answer: Yes. Pass `--limit 100` and refuse when the answer holds 100 tickets. (user's answer, 2026-11-19)

### Question 3: Jira blockers come from the footer, because Orca gives no issue links
`orca jira issue --json` carries the status category but never the issue links. May Jira reads and lists through Orca take the blockers from the footer line of the ticket alone, and read the state of each blocker with one more `orca jira issue` call? The other choice is that Jira reads and lists through Orca fall back to the file that Claude writes, with a reason that names the missing links.
- For: the user
- Answer: Yes. Take the Jira blockers from the footer alone, and read the state of each blocker with `orca jira issue`. (user's answer, 2026-11-19)

### Question 4: A Linear list by milestone does not go through Orca
The ticket turns a milestone into `--project <name>`, but `create-tickets` puts each wave in a Linear project milestone, inside a project. With `--project`, a wave would show the tickets of every wave of the project. Orca 1.4.263 cannot filter by project milestone, and its issues do not carry their milestone. May `listGroup` with a milestone on Linear exit with code 4, so that Claude writes the file with its own connection, while a list by epic keeps using Orca with `--parent-id`?
- For: the user
- Answer: Yes. A Linear list by milestone exits with code 4, and a list by epic uses `--parent-id`. (user's answer, 2026-11-19)

## Review log

### Impact notes

The branch only adds code. Four new source files exist (`jira-orca.ts`, `linear-orca.ts`, `orca-calls.ts` and the test fake). The only existing file that changed is `cstack/src/orca/shapes.ts`, which gained ten entries, so no existing symbol changed or was deleted. Nothing outside the branch calls the new functions yet, because `openTracker` belongs to #26. The files that usually change with `shapes.ts` are its test and the fixture README, and both were updated. No `WHY:` or `DECISION:` comment conflicts with the change.

### Findings and fixes

Correctness. A Jira list lost every footer blocker, because real Orca returns an empty description in a search. Fixed: `listGroup` now reads each hit again with `orca jira issue`, and the search fixture and the README say the description is empty. Also fixed: the `meta.includeErrors` check now reads the object shape that Orca uses, and an unreadable Linear blocker is stored as unknown, so it is read once.

Security. A key from a Linear list answer reached an Orca argument without `isValidKey`. Fixed: a bad key now stops the list with exit 1 before any Orca call.

Conventions and simplicity. The bare block in `readOne` was flattened and `COMMENT_CAP` was named on the Linear side.

Follow-ups, not done. The blocker loop is nearly the same in both adapters, and a shared helper could remove it. A Linear epic list that returns nothing is not refused, and Orca may need the internal id for `--parent-id`, which nobody could check without a Linear workspace. A Jira search that returns a short page is not detected.

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

- The worktree had no `node_modules`, so `npm run typecheck` failed with "Cannot find type definition file for 'node'" in unit 3. I ran `npm ci` in `cstack/` and it passed.
- Several implementers wrote the code before the red run, so they moved the source aside to get a real red run (units 4, 6, 8, 9).
- The first full `npm test` run showed 1 failed test out of 873 while it ran next to other work. A second and a third run passed all 873. I did not find the cause.

## Hand-off log

- 2026-11-19, executor, phase build: added the label `in progress` to ticket 25 (GitHub has no state field), committed the plan file, and built units 1 to 9 in five batches. Typecheck and the whole suite pass (873 tests).

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

1. **A Linear list by milestone should not go through Orca.** The ticket turns a milestone into `--project <name>`. But `create-tickets` puts each wave in a Linear project milestone, not in a project. So `cstack wave` would take every wave of the project for one. Orca 1.4.263 cannot filter by project milestone. I recommend exit code 4 for this case, which asks Claude to write the file with its own connection. Lists by epic stay on Orca.

2. **On Jira, a group is read up to 100 tickets, not 200.** Orca caps `jira search` at 100 without saying so, so the ticket's refusal at 200 would never happen. This changes an acceptance criterion. I recommend `--limit 100` and a refusal as soon as the answer holds 100 tickets.

3. **Do you have a Jira site and a Linear workspace with no work data?** The Orca connections of this machine reach work trackers, so I record nothing here. I recommend writing the answers by hand from the code of Orca 1.4.263, and saying so in the README of the answers, unless you give me a sandbox.

**I will do this unless you say no**

- I take the Jira blockers from the footer line of the ticket, because Orca does not return Jira issue links. ADR-SIC-F already says this, even though the ticket talked about falling back to the file. I first remove the backslashes from that line, because Orca escapes a `*` typed as plain text.
- For a Jira move, I accept the name of a transition or of the status it leads to, then I write with `--to-id` (checked in 1.4.263). If the ticket is already in that status, I succeed without writing, so that a resumed run is not refused.
- A write that Orca attempted and that fails exits with code 5, "check the ticket", never with code 4. Code 4 would make Claude redo the write, so the comment would appear twice. Before any call, I refuse an empty comment or one that is too long: Orca refuses more than 100,000 characters on Jira and 65,000 on Linear.
- For a Linear move, I take the team from the answer of `orca linear issue`, not from the prefix of the key. An old key keeps working after a team is renamed.
- I refuse a Jira list by milestone that mixes several projects, because a `fixVersion` belongs to one project. I also refuse an empty epic list, because on Jira Server `parent =` does not find the children of an epic.

**A question for other people that can wait**

For the Orca maintainers, in English: "Could `orca jira issue --json` include the issue links, `orca jira search` page past 100 results, and `orca linear list-issues` filter by project milestone?"

**Good to know**

- Answers written by hand prove that the code follows my reading of Orca, not Orca itself. The first real run on Jira or Linear will be the real test.
- A Linear list costs one Orca call per ticket, for its relations, plus one per blocker whose state is unknown. I keep the states already read during the list.

#### Details

The Linear milestone mapping is a blocking question, and only the user can settle it, because it changes item 3 of the ticket's scope. The evidence is partly tested by reading code. `skills/create-tickets/SKILL.md` line 44 says that milestones are the waves, and line 126 creates every ticket "with team, project, milestone", which on Linear means a project milestone inside a Linear project. The help of `orca linear list-issues` in 1.4.263 offers `--team`, `--cycle`, `--label`, `--project`, `--release` and `--parent-id`, but no project milestone filter. In the Orca app code (`out/main/index.js`), `projectMilestones` appears only in the project read, never on an issue, so cstack cannot filter on its side either. Keeping `--project` would show every wave of the project as one wave, which is exactly what ADR-SIC-F's `group` key is meant to stop ("This stops cstack from showing the tickets of the wrong wave"). I rejected a client-side filter, because no issue carries its milestone, and reading the project first, because the project read gives milestone names without their issues. The recommendation is that `listGroup({ milestone })` in `cstack/src/tracker/linear-orca.ts` throws `NoClientError.forRead(...)` from `cstack/src/tracker/errors.ts`, which exits with 4. Its message names the missing filter. `listGroup({ epic })` keeps using `--parent-id`. This touches the work of the ticket that writes the tracker commands (#26): its `cstack tracker list` must pass that exit 4 through for a read, so the merge that wires `openTracker` should test it. If nobody decides, the ticket's text applies and a Linear wave shows the whole project.

The Jira cap is a blocking question, answered by a test (reading the Orca code), and it needs the user's "ok" because it changes the acceptance line "A list that reaches 200 tickets is refused" in `cstack/test/tracker/jira-jql.test.ts`. In `out/main/index.js`, `jiraSearchIssues` calls the search with `Math.min(Math.max(1, t), 100)`, and the answer has no truncated flag. A group of exactly 100 tickets is refused too, which is the safe side. If nobody decides, `--limit 200` silently returns 100 tickets and a large wave is read incomplete without any refusal.

The sandbox is a blocking question that only the user can answer. The plan's Decisions already forbid any `orca jira` or `orca linear` call on this machine except `--help`. Without a sandbox, the fixtures in `cstack/test/fixtures/orca/1.4.263/` are written by hand from the Orca code listed under "What the installed Orca 1.4.263 really answers", and `cstack/test/fixtures/orca/README.md` says so for each file. If nobody decides, the answers are written by hand, which is complete and correct for the tests but proves nothing about real Orca answers.

The Jira blockers question was drafted as blocking, but ADR-SIC-F already settles it: "Some trackers give no relations. For those, the footer alone answers." The ticket's scope item 1 asked for a fallback when a field is missing, and this plan follows the ADR instead, so the PR should say so in one line. I checked it in the Orca code: the Jira field list (`qDt`, `GDt` and `attachment`) never asks for `issuelinks`, and the issue mapper `PD` has no links. I also checked how the description reaches cstack. Orca turns Jira rich text into Markdown, and a real bold mark becomes `**` (the `strong` case of `_D`), so the footer `**Size: M** · Blocked by: …` written by `create-tickets` survives. But plain text goes through `aDt`, which escapes `\`, backtick, `*`, `_`, `~`, `[`, `<` and `>`. So a footer typed as plain text, with literal asterisks, comes back as `\*\*Size:`, and `footerBlockers` would return `unknown`. The adapter should remove backslash escapes from the body it passes to `footerBlockers`, and keep `Ticket.body` as Orca gave it. A key that Jira stored as a smart link comes back as a URL and is missed, so that ticket's blockers stay `unknown`, which the ready rule treats as blocked: that is safe, and no extra work is planned for it. This is non-blocking now.

The Jira transition choice is non-blocking, from draft item 4, and I agree with it. I checked that `orca jira status set` accepts `--to-id` in 1.4.263 (its `--help`, and `out/cli/jira/jira-write.js` around line 60, which matches `entry.id === explicit`). Without `--to-id`, Orca matches the name without case against both transition names and target status names. It refuses unless exactly one matches, and cstack would then report that refusal as an unconfirmed write. My addition is the already-there case. A Jira workflow seldom offers a transition from a status to itself, so moving an "In Progress" ticket to "In Progress" again, as a resumed `resolve-issue` run does, would be refused with exit 1. The adapter should read the issue first, or after no transition matched, and return without writing when its status name already equals the target, compared without case. Linear needs nothing here, because `team states` lists the current state and Orca answers `meta.alreadyInState`.

The failed write rule is non-blocking, from draft item 5, and I agree with it. My additions are two. First, once Orca has run a write, no outcome may become exit 4, because ADR-SIC-F makes exit 4 mean "Claude, do it with your own connection", and Claude would then post the comment a second time. Only the runner result `missing`, where nothing ran, may stay exit 4. The results `failed`, `timeout` and `too-large`, and a shape error, give exit 5. Second, the adapter refuses with exit 1 before any call a body file that is blank or longer than the Orca cap, because Orca refuses these too and cstack would otherwise report them as "cannot tell whether the change happened". The caps are 100,000 characters on Jira (`out/cli/jira/jira-write.js` line 80, code `jira_body_too_large`) and 65,000 on Linear (`LINEAR_WRITE_BODY_CAP` in `out/shared/linear/agent-access.js` line 16). Orca counts JavaScript string length, so cstack should read the file as UTF-8 and use `.length`. To avoid a merge conflict with #26, #27 and #29, the exit 5 error should reuse `TrackerError` with `EXIT.toolFailed` or `WriteShapeError`, without a new class in `errors.ts`.

The Linear team for a move is non-blocking. The plan drafted the team key as the part of the ticket key before the hyphen. Linear keeps old identifiers working after a team key is renamed or an issue moves to another team, so the prefix can name a team that no longer exists or the wrong team. The answer of `orca linear issue` carries `issue.team.key`, so `moveState` should read the issue (one call, with `--relations` so that one shape covers every Linear issue read) and use that key for `team states`. A related trap supports `--relations` everywhere: `commandOfFixture` in `cstack/src/orca/shapes.ts` maps a fixture to the first shape whose words before ` --` match, so `orca linear issue --json` and `orca linear issue --relations --json` would both claim `linear-issue.*.json`. If nobody decides, a renamed team gives a false "not a state" refusal or a failed read.

The Jira list guards are non-blocking. A Jira version belongs to one project, so `fixVersion = "M3"` returns the issues of every project on the site that has a version with that name, and the Group type of #24 carries no project to scope the query. The adapter should refuse the list when the returned keys have more than one project prefix. Orca also supports Jira Server and Data Center (the `authType === "server"` branch of `ND` in `out/main/index.js`). There, epic children hang on the Epic Link field, so `parent = <key>` returns nothing, and an empty epic list should be refused with a message that names this case rather than shown as an empty wave. On Server, Orca also sends comments as raw text, so Markdown shows as typed, which is acceptable. If nobody decides, a milestone name shared by two projects mixes their tickets into one wave.

The question for the Orca maintainers is non-blocking and goes to them, in English, word for word: "Could `orca jira issue --json` include the issue links, `orca jira search` page past 100 results, and `orca linear list-issues` filter by project milestone?" Each of these would remove one limit that this ticket works around.

The hand-written answers are worth keeping in mind because the tests then check the adapters against my reading of the Orca code, not against Orca. A change in Orca's answers shows up only in a real run, as a shape error. The Linear list cost comes from list answers that carry no relations. A list of N tickets costs one list call, N issue reads and one read for each blocker whose state the list did not give. `orca --version` takes about 0.2 seconds on this machine, and each tracker call adds network time on top. The adapter should keep a map from key to state for the length of one `listGroup` call, so that a blocker is read at most once.

Locked decisions I did not reopen: ADR-SIC-F (no credential, the clients already logged in, links between tickets stay with Claude), the coordinator's split between this ticket and #26, and the `1.4.263/` fixture folder from the plan of #24. I checked security and authorization, data model lock-in, operations and cost, and reversibility, and found nothing beyond what ADR-SIC-F and the checked wrapper of #24 already cover.

### Open questions and answers

1. Blocking question 1, where the Jira and Linear answers come from. Recommended answer: write them by hand from the code of the installed Orca 1.4.263, because the Orca connections of this machine reach work trackers and must not be used. The fixture README and this plan say that the answers were written by hand. I checked what the code gives: see "What the installed Orca 1.4.263 really answers" under "Code mapping". The `--help` of each command gives only its flags.
2. Blocking question 2, the Jira cap of 100. Recommended answer: pass `--limit 100` and refuse a Jira list when the answer holds 100 tickets. I checked it in the Orca code: `jiraSearchIssues` calls the search with `Math.min(Math.max(1, limit), 100)`, and the answer has no truncated flag. A group of exactly 100 tickets is refused too, which is the safe side.
3. Blocking question 3, Jira blockers without issue links. Recommended answer: take the blockers from the footer alone, then read the state of each blocker with `orca jira issue <key> --json`. Every ticket that `create-tickets` writes has the footer. A ticket without a footer gets the blockers `unknown`, so the ready rule keeps it blocked, which is safe. Falling back to the file would make Jira reads through Orca useless. I checked it in the Orca code: the Jira issue mapper never reads the `issuelinks` field.
4. Non-blocking, how a Jira move picks its transition. Recommended answer, done unless the user says no: cstack accepts a name that is exactly a transition name or the name of the status that a transition leads to, because the skill moves a ticket to a status name such as "In Progress" while the transition may be called "Start progress". When exactly one transition matches, cstack runs `orca jira status set <key> --to-id <transition id>`, so that Orca cannot pick another transition by its own case-insensitive match. When none or several match, cstack refuses before any write and lists the names it found.
5. Non-blocking, what a failed write says. Recommended answer, done unless the user says no: when `status set` or `comment add` fails, times out or gives an answer of an unexpected shape, cstack stops with exit `5`. The message says that cstack cannot tell whether the change happened, and asks the user to check the ticket in the tracker before trying again. cstack does not show Orca's retry id, because the runner of #24 drops the standard output of a failed run, and changing that shared runner is not needed for a safe answer.
6. Blocking question 4, a Linear list by milestone, raised by the review before the plan. Recommended answer: exit with code 4, because Orca 1.4.263 cannot filter by project milestone and `--project` would mix every wave of the project.

Answers of the user, 2026-11-19. Blocking question 1: no sandbox, so the answers are written by hand from the Orca code. Blocking questions 2, 3 and 4: the user agrees with the recommended answers. Items 4 and 5 above, and every item of "I will do this unless you say no" in "Questions you may not be asking": accepted by default, because the user agreed with the rest. The question for the Orca maintainers, "Could `orca jira issue --json` include the issue links, `orca jira search` page past 100 results, and `orca linear list-issues` filter by project milestone?", is open, not needed for this ticket. It goes into the pull request body as an open question.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
