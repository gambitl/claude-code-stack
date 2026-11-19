# Plan: #29 — M3-6: Launch every ready ticket of a milestone with cstack wave

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/29
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/cstack-wave
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T14:25:32+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** One command shows which tickets of a milestone can start now and, after the user says yes, opens a working folder for each one and starts Claude there.

- **What the title means**: `cstack wave` is a command of cstack, the command-line tool that this project builds. A milestone is a group of tickets that a team plans together. A wave is the set of tickets of one milestone that can start at the same time, because nothing blocks them. A ticket is ready when every ticket that blocks it is finished, when nobody has started it, and when it has no working folder yet. A worktree is such a working folder. It is a second copy of the same git repository, on its own branch. Orca is a desktop app that runs several coding agents side by side, each in its own worktree.
- **Why we are doing it**: Today, a solution engineer checks each ticket by hand, creates each worktree, and starts Claude in each one. That is slow, and it is easy to start a ticket that is still blocked.
- **For the user**: A solution engineer starts a whole wave in one step. They see at a glance what is ready, what is blocked and by what, and what is already started.

**Goal.** This ticket delivers `cstack wave` (US-14). It lists the three groups of a milestone. After the user says yes, it starts every ready ticket, with Orca or with plain git worktrees. Greenfield: nothing exists yet.

### Where things are today (read first)

* **cstack**: Greenfield: no existing surface. When this ticket was written, cstack did not exist yet. #24 writes the tracker interface, the ready rule and the Orca adapter. #25 and #26 make the tracker interface work for each tracker.
* **The story**: `docs/projects/skills-into-cli.md` (lines 180 to 184): These lines hold US-14. Line 335 records that a wave launch which refuses to run without Orca was replaced by a fallback with git worktrees. Line 244 says that the wave launch is the first building block of a later coordinator for a whole epic. Line 349 defines a ready ticket.
* **Waves in this repository**: `CLAUDE.md` (line 7): Each wave is a GitHub milestone, and an epic is a parent issue with sub-issues.
* **Orca worktrees, version 1.4.259 (from `orca worktree create --help`)**: `orca worktree create` takes `--name`, `--repo <selector>`, `--branch <name>`, `--no-parent`, `--reference <url-or-jira-key>`, `--agent <id>`, `--prompt <text>` and `--json`. The help says that trackers other than Jira need a full URL with `--reference`. It also says that `--reference` cannot be combined with the older link options, such as `--issue`. By default, Orca records the new worktree as a child of the caller's worktree. The option `--no-parent` makes it independent. When `--base-branch` is left out, Orca starts from the default base of the repository.
* **Orca references, version 1.4.259 (from `orca reference find --help`)**: `orca reference find <url-or-issue-key> --json` finds the workspaces linked to a ticket. It reads stored references only. It does not support bare issue numbers, so a GitHub or GitLab ticket needs its full URL.
* **Starting Claude**: `claude --help` shows the form `claude [options] [command] [prompt]`. A prompt given this way is the first message of an interactive session.
* **Contract**: #24 defines the tracker interface, whose `listGroup` takes a milestone name or an epic key, and whose `readTicket` reads one ticket. Each ticket has a key, a title, a URL, a state kind and its blockers. Keys match `^[A-Z][A-Z0-9_]+-[1-9][0-9]*$` on Jira and Linear and `^#[1-9][0-9]*$` on GitHub and GitLab. URLs are checked `https` URLs. #24 also writes the ready rule (decision 9). A ticket is ready when each blocker is finished, when it is not in progress, and when it has no worktree yet. The rule takes "has a worktree" as an input, and this ticket computes that input. #24 adds `cstack wave (--milestone <name> | --epic <key>) [--tracker <name>] [--from-file <path>]` to the command list, and gives the feature "worktrees linked to tickets".

### Scope

1. Write `cstack wave` in `cstack/src/wave/`. It runs from the root of the repository. It reads the group with the tracker interface of #24, or from the file that Claude wrote when `--from-file` is given.
2. Write the check "has a worktree" in `cstack/src/wave/worktrees.ts`. #30 reuses it.
   - cstack always reads `git worktree list --porcelain`. A ticket has a worktree when a worktree's folder name or branch name is the ticket's short name (step 6). It also has one when a branch name contains the key as a separate word, in any case, which catches a ticket started by hand.
   - When worktrees linked to tickets are available, cstack also runs `orca reference find <ticket URL> --json` and ignores archived workspaces.
   - A ticket has a worktree when either source finds one.
3. Apply the ready rule of #24 and print the three groups (US-14 AC1).
   - "Ready" shows the key and the title of each ticket.
   - "Blocked" shows each ticket with the key and state of every open blocker, or with the reason when the blockers are unknown.
   - "Already started" shows each ticket with the reason, which is "in progress" or the path of its worktree.
   - One last line gives the number of finished tickets, which the groups leave out.
   - Before it prints a title, cstack removes its control characters, keeps one line and cuts it to 80 characters.
4. cstack then asks in the terminal "Start the N ready tickets? [y/N]". Only `y` or `yes` counts as yes. When the command does not run in an interactive terminal, cstack prints the groups, says that starting tickets needs a terminal, and starts nothing.
5. After the yes, cstack reads each ready ticket and its blockers again, and applies the rule again, just before it starts that ticket. A ticket that is no longer ready is skipped, with the reason.
6. Each ticket gets a short name for its worktree folder and its branch. On Jira and Linear, it is the key in lower case, such as `abc-12`. On GitHub and GitLab, it is `issue-<number>`, such as `issue-12`.
7. When worktrees linked to tickets are available, cstack runs `orca worktree create --repo path:<repository root> --name <short name> --branch <short name> --no-parent --reference <ticket URL> --agent claude --prompt "/resolve-issue <key>" --json`. It prints the result of each ticket.
8. Without that feature (US-14 AC4), cstack creates the worktree itself, outside the repository folder.
   - The folder is `<parent folder>/<repository folder name>-worktrees/<short name>`, next to the repository.
   - cstack runs `git fetch origin`, then `git worktree add -b <short name> <folder> origin/<default branch>`. The default branch comes from `refs/remotes/origin/HEAD`.
   - When the folder or the branch already exists, cstack skips that ticket and says why.
   - cstack prints one command per ticket for you to paste, in the form `cd '<folder>' && claude '/resolve-issue <key>'`. It quotes the folder for the shell. The key has already passed its pattern.
9. Both ways create a branch named after the short name. Today, the executor creates its own branch in phase 6 (`skills/resolve-issue/agents/executor.md`, line 38). So #31 updates the build guide of #22 to keep a branch that `cstack wave` created.
10. Replace the placeholder handler of `cstack wave`. Leave `--watch` to #30.

### Acceptance (TDD)

* `cstack/test/wave/groups.test.ts`: This test carries US-14 AC1: "`cstack wave --milestone <name>` lists three groups. The first group holds the tickets that are ready. The second holds the blocked tickets, each with what blocks it. The third holds the tickets already started." Write first a case with the fake tracker of #24 and five tickets. One is ready, one is blocked by an open ticket, one is in progress, one has a worktree, and one is done. See the three groups, the blocker of the blocked ticket, and "1 finished".
* `cstack/test/wave/worktree-check.test.ts`: This test uses real git in a temporary repository. Write first a case where a worktree is on the branch `abc-12`, and see ticket `ABC-12` reported as already started. A branch named `feature/ABC-12-login` also counts. A branch named `abc-120` does not count for `ABC-12`. With a recorded `reference find` answer that names a workspace, the ticket counts as started too.
* `cstack/test/wave/start-git.test.ts`: This test carries US-14 AC4: "Without Orca, `cstack` creates a git worktree for each ready ticket. It prints one command per ticket, which the user pastes to start Claude there." Write first a case without Orca where the user answers yes. See a git worktree at `<parent folder>/<repository>-worktrees/abc-12` on the branch `abc-12`, and the printed command. When that folder already exists, the ticket is skipped with its reason.
* `cstack/test/wave/start-orca.test.ts`: Write first a case with the recorded Orca answers and a yes. See `orca worktree create` called with exactly the arguments of step 7. The prompt is `/resolve-issue ABC-12`, and nothing else from the ticket appears.
* `cstack/test/wave/confirm.test.ts`: This test carries the negative criterion of US-14: "`cstack wave` never starts a ticket before the user says yes. It never starts a blocked ticket." Write first a case where the answer is `n`, and see no `git worktree add` and no `orca worktree create`. An empty answer, any other answer, and a run without a terminal start nothing either. A ticket that becomes blocked between the list and the yes is not started.
* US-14 AC3 is checked end to end in #31, because only a real Orca shows Claude starting in the new worktree.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A ticket title that holds `'; rm -rf ~; '`, backticks, `$(…)`, an escape sequence for the terminal, and the words "ignore your instructions" never reaches an argument, the prompt or the printed command. In the printed groups, it shows without its escape sequence. A key from the tracker that fails its pattern makes cstack skip that ticket and say so.

**Size: M** · Blocked by: #24 · Feeds: #30, #31

---

### CTO review — ticket text never reaches a shell command, a prompt or a script string (2026-11-17)

1. The only ticket data that cstack passes on is the key after its pattern check, the short name built from the key, and the URL after its check. The title and the body stay in cstack's own output.
2. Every program runs with a list of arguments and no shell. The one shell line that cstack prints for the user holds only the quoted folder and the checked key.
3. cstack removes control characters from a title before it prints it, so a title cannot move the cursor or hide text in the terminal. #30 prints titles the same way.

### Ticket comments

Comment of 2026-11-19T08:56:35Z:

Ticket #24 is built on the branch `gambitl/orca-tracker-contract`. This comment tells you what you can build on for `cstack wave`.

The ready rule is one pure function, `readyState(ticket, hasWorktree)` in `cstack/src/tracker/ready.ts`. It returns `left-out`, `started`, `ready`, or `blocked` with a reason (`unknown-state`, `unknown-blockers`, or the list of open blockers). Never write a second version of it. You write the only check of "has a worktree", in git and in Orca, and #30 reuses it.

A blocker counts only when it is `finished`. A blocker in review is `in-progress`, so it blocks. A blocker that only the ticket footer names has the state `unknown` until an adapter looks it up, so it also blocks. Read the lists with `listGroup`, or from the file that Claude writes (`cstack/src/tracker/claude-file.ts`, which needs a `group` key that matches). Choose the client with `createClientChooser` in `cstack/src/tracker/choose.ts`.

The command `wave` is in `cstack/src/manifest.ts` and exits with `1` until you build it. `--watch` is in `notBuiltFlags` with ticket #30. `wave` exits with `4` when no tracker client exists. The fake tracker in `cstack/test/fakes/tracker.ts` lets you test a wave without a real tracker.

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
- ADR-SIC-F, how `cstack` reaches trackers and forges: `docs/decisions/ADR-SIC-F-tracker-access.md`. `cstack` never holds credentials.
- ADR-SIC-H, how a `cstack` command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`. A command prints through `io`, returns its exit code, and never calls `process.exit()`.

## Dependencies

clear

The only blocker is #24, which is closed as completed. Its code is on `main`.

## Code mapping

### What #24 left on `main` for this ticket

- `cstack/src/tracker/types.ts` defines `Tracker` (`readTicket`, `listGroup`, `moveState`, `addComment`), `Ticket` (key, title, body, url, stateName, stateKind, blockers) and `Group` (`{ milestone }` or `{ epic }`). A blocker is a `TicketRef` with a key and a state kind, or the whole list is `"unknown"`.
- `cstack/src/tracker/ready.ts` holds the only ready rule, `readyState(ticket, hasWorktree)`. It answers `left-out` (finished), `started` (in progress or has a worktree), `ready`, or `blocked` with the reason `unknown-state`, `unknown-blockers` or `blocked-by` and the open blocker keys. The order matters: an unknown state blocks before "started" is tested. The wave must never write a second version of this rule.
- `cstack/src/tracker/keys.ts` checks keys (`isValidKey`), URLs (`isValidUrl`) and single arguments (`isSafeArgument`). `cstack/src/tracker/checked.ts` wraps any adapter. Its `listGroup` drops a ticket with a bad key, URL or blocker key and warns. Its `readTicket` refuses one with `RefusedArgumentError` (exit 1).
- `cstack/src/tracker/choose.ts` has `trackerFromRemote(remoteUrl)`, which returns `github` or `gitlab` from the origin URL, or throws `TrackerChoiceError` (exit 2). It also has `createClientChooser`, which picks Orca, then `gh` or `glab`, then the file from Claude for reads.
- `cstack/src/tracker/claude-file.ts` has `claudeFileTracker(path, name, warn)`. It reads a `cstack-tracker/1` file and refuses a list when the file's `group` key is missing or differs (exit 3).
- `cstack/src/tracker/errors.ts` has `TrackerError` with an `exitCode`, and `NoClientError` (exit 4), `RefusedArgumentError` (exit 1), `InvalidFileError` (exit 3), `WriteShapeError` and `UnconfirmedWriteError` (exit 5).
- `cstack/src/orca/run.ts` has the `Runner` type and `createRunner(timeoutMs)`. It runs a program with `execFile`, never a shell, and returns `ok`, `failed`, `missing`, `timeout` or `too-large`.
- `cstack/src/orca/call.ts` has `callOrca(run, env, args)`, which adds `--json` to every Orca command except `--version`, and honours `ORCA_CLI_COMMAND`.
- `cstack/src/orca/features.ts` has `orcaFeatures(run, env).get("ticket-worktrees")`. That feature is available when Orca is at least 1.4.259, is running, and lists the commands `worktree create` and `reference find`.
- `cstack/src/orca/shapes.ts` holds the fields that cstack reads from each Orca answer, and `checkShape(command, answer, version, "read" | "write")`. `cstack/test/orca/shapes.test.ts` checks every JSON file in `cstack/test/fixtures/orca/1.4.263/` against a shape, and `commandOfFixture` throws for a fixture whose command has no shape.
- `cstack/test/fakes/tracker.ts` has `FakeTracker`, a tracker in memory with tickets and groups. `cstack/test/helpers/plan-repo.ts` has `makeRepo()` and `git()`, which build a temporary repository for tests, and `collect()`, which captures the output of a command.

### Entry points and patterns to follow

- `cstack/src/manifest.ts` already has the `wave` entry with `built: false`, the file `wave.ts`, the ticket 29 and `notBuiltFlags: { "--watch": 30 }`. Building it means `built: true` and a handler named `wave` in `HANDLERS` of `cstack/src/cli.ts`. Tests check that the built entries and the handlers agree.
- A command is a function `(args, io, deps) => Promise<number>`. It parses its flags with `parseArgs` of `node:util` in strict mode, prints through `io`, and returns its exit code (ADR-SIC-H). `cstack/src/commands/publish.ts` is the nearest example with injected dependencies. `cstack/src/commands/doctor.ts` builds its real dependencies in a `realInput()` function.
- Commands find the repository root with `git rev-parse --show-toplevel` (`cstack/src/commands/next.ts:80`).
- No command of cstack asks a question in the terminal today. The only check of a terminal is `stream.isTTY` in `cstack/src/commands/report-submit.ts:13`. The wave is the first command that reads an answer, so the prompt and the terminal check must be injected to stay testable.
- A title from a forge is cleaned with the regular expression `/[\u0000-\u001f\u007f-\u009f]/g` in `cstack/src/commands/publish.ts:111`. That pattern removes the C0 and C1 control characters.

### What Orca 1.4.263 answers (read on this machine)

- `orca worktree create --help` confirms every flag of scope step 7: `--repo path:<root>`, `--name`, `--branch`, `--no-parent`, `--reference`, `--agent`, `--prompt` and `--json`. The help says that `--branch` gives a name without the configured prefix, and that "a taken name gets a numeric suffix". It also says: "After a lost agent launch reply, re-issue the same command ... with --retry-launch <operationId>. Never retry as a fresh launch."
- With `--agent` and `--json`, the answer of `worktree create` holds `result.worktree` (with `path`, `branch`, `id` and `displayName`) when Orca could show the new worktree, and `result.launch` with what started. An older host returns `result.worktree` and `result.agentTerminalHandle`. The code that builds this answer is in Orca's `out/cli/workspaces/worktree-create-agent-launch.js`.
- `orca reference find <url> --json` answers `{ ok, result: { kind: "reference_matches", query, scope, truncated, matches } }`. Each match is `{ reference, workspace: { id, name, repo, kind, archived, hostId? }, agents }`. Orca skips archived workspaces unless `--include-archived` is given. A worktree id has the form `<repo id>::<path>`, so the path of a matched worktree is the part after `::`. No ticket on this machine has a stored reference, so a recorded answer with a match must be written by hand from these fields.

### Shared files and risks

- `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts`, `cstack/test/cli.test.ts` and `README.md` change in every ticket of this wave. They also change together in most past commits: `cli.ts` changed with `cli.test.ts` 12 times and with `manifest.test.ts` 7 times in its last 30 commits. A merge in wave 4 silently kept two copies of one function in `cli.ts`. Keep the changes small and in one place.
- Two existing tests name ticket #29 for the unbuilt `wave`. They are `cstack/test/manifest.test.ts:135` (`unbuiltRefusal(["wave"])`) and `cstack/test/cli.test.ts:170` (`wave --watch` names `#29`). Once `wave` is built, `--watch` names #30, so both tests change.
- The count test `cstack/test/manifest.test.ts:140` expects 14 built and 9 unbuilt commands. `README.md:45` says "fourteen commands" and lists each built command. Building `wave` makes 15 and 8, before the other tickets of the wave merge.
- `cstack/src/orca/shapes.ts` and `cstack/test/fixtures/orca/README.md` may also change in #25 and #27, which add their own Orca answers.
- `cstack/src/tracker/open.ts` belongs to #26. This branch keeps a temporary copy with the same exports, which serves only `--from-file`. Whichever of #26 and #29 merges second deletes the copy.

### Governing decisions found in the code

- `cstack/src/tracker/choose.ts:1` and `cstack/src/tracker/claude-file.ts:1` carry `WHY: ADR-SIC-F`. cstack holds no credential, and the file from Claude serves reads only.
- `cstack/src/publish/program.ts:3` says every program runs without a shell.
- ADR-SIC-H: a command prints through `io`, returns its code and never calls `process.exit()`.

## Decisions

### Rules from the coordinator of this wave (2026-11-19, the answer of someone else: the brief of the wave coordinator)

- The wave reads the group with `openTracker("list", …)` and each ticket again with `openTracker("read", …)`, both from `cstack/src/tracker/open.ts`. (2026-11-19, the wave coordinator)
- Ticket #26 owns `cstack/src/tracker/open.ts`. Until #26 merges, this branch keeps a temporary copy with exactly the same exports: `OpenTrackerOptions` (`root`, `tracker?`, `fromFile?`, `run`, `env`, `warn`) and `openTracker(capability, options): Promise<Tracker>`. The copy serves only `--from-file`, through `claudeFileTracker` of #24 wrapped in `checkedTracker`. In every other case it throws `NoClientError` (exit 4). Never change this interface. (2026-11-19, the wave coordinator)
- Without `--tracker`, the tracker name comes from the `origin` remote with `trackerFromRemote` of #24. (2026-11-19, the wave coordinator)
- Change only the `wave` entry of `cstack/src/manifest.ts`. Keep the changes to `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts`, `cstack/test/cli.test.ts` and `README.md` small and in one place, because the other tickets of the wave change them too. (2026-11-19, the wave coordinator)
- After building `wave`, the command list holds 15 built commands and 8 that are not built. Update `cstack/test/manifest.test.ts` and the sentence "`cstack` has fourteen commands" of `README.md` to match. (2026-11-19, the wave coordinator)
- Never edit anything under the top-level `skills/` folder, which is frozen at the tag `prose-skills-final` (ADR-SIC-E). Never change `.cstack/settings.json`. (2026-11-19, the wave coordinator)
- A test never runs the real `orca`, `gh` or `glab`, and never reaches the network. A test runs `git worktree add` only inside a temporary repository that it created. Orca is always faked through the `Runner` of #24 with recorded answers. (2026-11-19, the wave coordinator)

### Answers of the user (2026-11-19)

- The "has a worktree" check has three sources, and a ticket counts as started when any of them finds something. The first is `git worktree list --porcelain` of the clone. The second is `orca reference find <ticket URL> --json`, only when the Orca feature `ticket-worktrees` is available. The third is the folders under `<common git folder>/cstack/runs/`. (2026-11-19, the user's answer)
- A run folder counts for a ticket when its name starts with a date `YYYY-MM-DD`, then a dash, then the ticket id, then a dash, ignoring case. The ticket id is the key without `#` on GitHub and GitLab, such as `29`, and the key itself on Jira and Linear, such as `ABC-12`. The "Already started" line then says that a resolve-issue run exists and names the folder, so the user knows which folder to remove when the run was abandoned. (2026-11-19, the user's answer)
- Before both ways of starting, cstack checks whether `refs/heads/<short name>` exists in the clone. When it does, cstack skips that ticket and says that the branch already exists. (2026-11-19, the user's answer)
- When `orca reference find` fails for any ticket, whether Orca fails, times out, answers `ok: false` or answers with a wrong shape, cstack starts nothing. It prints the ticket and the reason and exits with `5`, before it asks the question. (2026-11-19, the user's answer: accepted by default)
- When one start fails, or its outcome is unknown, cstack prints the reason and goes on with the next ticket. It never retries a start. It exits with `5` at the end when at least one start failed or has an unknown outcome. For an unknown outcome, the message tells the user to check Orca before running the wave again. A ticket that cstack skipped, because it is no longer ready or its folder or branch exists, is not a failure. (2026-11-19, the user's answer: accepted by default)
- `orca worktree create` runs with a timeout of 10 minutes. Every other program runs with a timeout of 120 seconds. (2026-11-19, the user's answer: accepted by default)
- The real prompt reads exactly one line from standard input and then closes its reader, so the process can end without `process.exit()`. The end of input (Ctrl-D) counts as no. (2026-11-19, the user's answer: accepted by default)
- When the first entry of `git worktree list --porcelain` is a bare repository, cstack refuses with exit `1` and a clear message, before it lists anything. It never passes that path to Orca and never builds a folder next to it. (2026-11-19, the user's answer: accepted by default, from the review before the plan)
- The repository root is the folder of the first entry of `git worktree list --porcelain`, which is the main worktree. cstack uses it for `--repo path:` and for the folder of the git way, wherever the command runs inside the clone. (2026-11-19, tested answer, see "Blocking questions")

### Assumptions not asked (2026-11-19)

- A command exits with `0` when the user answers anything but `y` or `yes`, when there is no terminal, and when no ticket is ready. In those cases it starts nothing and asks nothing more. (2026-11-19, assumption not asked)
- "An interactive terminal" means that standard input is a terminal (`isTTY`). The answer is one line read from standard input, trimmed and compared in lower case with `y` and `yes`. The prompt and the terminal check are passed in as dependencies, so tests never need a real terminal. (2026-11-19, assumption not asked)
- A title is printed in this way: cstack keeps its first line, removes whole terminal escape sequences (CSI and OSC sequences, with ESC or their C1 forms), then removes every remaining C0 and C1 control character and the Unicode bidirectional controls U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069. It then cuts the result to 80 characters, with `…` as the 80th character when it cuts. The function lives in its own file under `cstack/src/wave/`, so #30 can reuse it. (2026-11-19, assumption not asked)
- Other text from Orca or from the tracker that cstack prints, such as an Orca error message or a workspace name, goes through the same cleaning. (2026-11-19, assumption not asked)
- After the yes, cstack re-reads each ready ticket once with `readTicket`, and trusts the blocker states that the adapter returns with it. It runs the "has a worktree" check again, then applies `readyState`. A ticket that is no longer ready is skipped with its reason. (2026-11-19, assumption not asked)
- In the git way, `git fetch origin` runs once, before the first worktree, not once per ticket. When it fails, cstack starts nothing and exits with `5`. (2026-11-19, assumption not asked)
- In the git way, when `refs/remotes/origin/HEAD` does not exist, cstack starts nothing and exits with `1`. Its message tells the user to run `git remote set-head origin --auto`. (2026-11-19, assumption not asked)
- In the "has a worktree" check, a key is a separate word when the character before it and the character after it are the start, the end, or anything other than a letter or a digit. The match ignores case. So `feature/ABC-12-login` counts for `ABC-12`, and `abc-120` does not. On GitHub and GitLab a branch rarely holds `#`, so the check also looks for the short name `issue-<n>` as a separate word. (2026-11-19, assumption not asked)
- A worktree that `git worktree list --porcelain` marks as prunable still counts, because git still holds its branch. A bare entry is ignored. A detached worktree counts by its folder name only. (2026-11-19, assumption not asked)
- When only Orca finds a worktree, the "Already started" line shows the path that follows `::` in the workspace id. For a workspace that is not a worktree, it shows the workspace name instead. A match with `archived: true` is ignored, even though Orca already leaves archived workspaces out by default. (2026-11-19, assumption not asked)
- The Orca way is used when the Orca feature `ticket-worktrees` of #24 is available. Otherwise the git way is used. The git check of "has a worktree" always runs. The Orca check runs only when that feature is available. (2026-11-19, assumption not asked)
- The tickets start one after another, in the order of the list. (2026-11-19, assumption not asked)
- Every program runs through the `Runner` of #24, never through a shell. That covers git and Orca. (2026-11-19, assumption not asked)
- The recorded answers of `orca reference find` and `orca worktree create` are written by hand, from the fields that Orca 1.4.263 writes in its code. No ticket on this machine has a stored reference, and no test may create a real Orca worktree. They go in `cstack/test/fixtures/orca/1.4.263/`, with their shapes in `cstack/src/orca/shapes.ts`, and under "Files written by hand" in `cstack/test/fixtures/orca/README.md`. (2026-11-19, assumption not asked)
- `--milestone` and `--epic` both work. Exactly one of them is required, or the command exits with `2`. (2026-11-19, assumption not asked)
- `README.md` gets one bullet for `cstack wave` in its "Commands" list. (2026-11-19, assumption not asked)

## Architecture

The approach is locked by the ticket and the answers of the question round. No new decision since the question round.

The command lives in `cstack/src/commands/wave.ts` and takes its dependencies as one object, so tests give a fake tracker, a fake Orca, a temporary git repository and a scripted answer. The pieces it calls live in `cstack/src/wave/`, one file per job: cleaning text for the terminal, names, the "has a worktree" check, the three groups, the question, the git way and the Orca way. #30 reuses the check, the names and the cleaning, so they never print or read the terminal themselves. The group is read through `openTracker` of `cstack/src/tracker/open.ts`. This branch keeps a temporary copy of that file until #26 merges its own.

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

### Unit 1: Clean text before cstack prints it
- Files: `cstack/src/wave/title.ts`, `cstack/test/wave/title.test.ts`
- Test: `cstack/test/wave/title.test.ts`: a title that holds a terminal escape sequence that clears the screen, an OSC sequence, a line break followed by more text, a right-to-left override and 100 letters prints as one line of exactly 80 characters, without any of those sequences, ending with `…`.
- Minimum code: export `printableTitle(text)` and `printableText(text)`. `printableText` removes whole CSI sequences (`ESC [` or the C1 form `\u009b`, then parameter and intermediate bytes, then one final byte) and whole OSC sequences (`ESC ]` or `\u009d`, up to BEL or `ESC \\`). It then removes every remaining C0 control character, DEL, every C1 control character, and the Unicode bidirectional controls U+200E, U+200F, U+202A to U+202E and U+2066 to U+2069. `printableTitle` first keeps the text before the first line break, then applies `printableText`, trims it, and cuts it to 80 characters. When it cuts, the 80th character is `…`.
- Refactor: none.
- Commit message: feat(cli): clean ticket titles and tracker text before cstack prints them
- Depends on: none

The functions never print and never read anything. #30 reuses them, so keep their names and their file.

### Unit 2: The short name and the run id of a ticket
- Files: `cstack/src/wave/names.ts`, `cstack/test/wave/names.test.ts`
- Test: `cstack/test/wave/names.test.ts`: `shortName("jira", "ABC-12")` and `shortName("linear", "ABC-12")` give `abc-12`, `shortName("github", "#12")` and `shortName("gitlab", "#12")` give `issue-12`, `runTicketId("github", "#29")` gives `29` and `runTicketId("jira", "ABC-12")` gives `ABC-12`.
- Minimum code: export `shortName(tracker, key)` and `runTicketId(tracker, key)`. Both take a key that already passed `isValidKey` of #24. They throw a `RefusedArgumentError` of #24 when it did not, so a bad key never becomes a folder or a branch name.
- Refactor: none.
- Commit message: feat(cli): name the worktree and the branch of a ticket after its key
- Depends on: none

### Unit 3: Record the Orca answers that the wave reads
- Files: `cstack/src/orca/shapes.ts`, `cstack/test/orca/shapes.test.ts`, `cstack/test/fixtures/orca/1.4.263/reference-find.none.json`, `cstack/test/fixtures/orca/1.4.263/reference-find.one-worktree.json`, `cstack/test/fixtures/orca/1.4.263/reference-find.archived.json`, `cstack/test/fixtures/orca/1.4.263/worktree-create.started.json`, `cstack/test/fixtures/orca/README.md`
- Test: `cstack/test/orca/shapes.test.ts`: `checkShape("orca reference find --json", <reference-find.one-worktree.json>, "1.4.263", "read")` does not throw. The same answer with `workspace.id` removed from its match throws a `ShapeError` that names `result.matches[].workspace.id`. `checkShape("orca worktree create --json", <worktree-create.started.json>, "1.4.263", "write")` does not throw.
- Minimum code: add two entries to `SHAPES`. `"orca reference find --json"` reads `ok` (boolean), `result.matches` (array), and for each match `workspace.id`, `workspace.kind` and `workspace.name` (string) and `workspace.archived` (boolean). `"orca worktree create --json"` reads `ok` (boolean) and `result` (object). `commandOfFixture` then maps `reference-find.*.json` and `worktree-create.*.json` to these commands, and the existing test "accepts every recorded JSON file" covers the four new files.
- Refactor: none.
- Commit message: feat(cli): add the shapes and the recorded answers of orca reference find and orca worktree create
- Depends on: none

Write the four answers by hand from the fields that Orca 1.4.263 writes, as the code mapping describes. `reference-find.none.json` follows the real empty answer of this machine: `{ id, ok: true, result: { kind: "reference_matches", query, scope: { source: "stored-metadata", includeArchived: false }, truncated: false, matches: [] }, _meta: { runtimeId } }`. `reference-find.one-worktree.json` holds one match whose `workspace` is `{ id: "repo-1::/home/user/work/example-worktrees/abc-12", name: "abc-12", repo: "example", kind: "worktree", archived: false, hostId: "local" }`, with a `reference` and an empty `agents` list. `reference-find.archived.json` holds the same match with `archived: true`. `worktree-create.started.json` is `{ id, ok: true, result: { worktree: { id, path: "/home/user/work/example-worktrees/abc-12", branch: "abc-12", displayName: "abc-12" }, lineage: null, launch: { ... } } }`. Use only placeholder values: `/home/user/...` paths, `https://github.com/example/repo/issues/12` URLs, the zero UUID and `id-placeholder`. The test "every fixture" of `cstack/test/fixtures-public.test.ts` refuses any other host or home path. List the four files under "Files written by hand" in `cstack/test/fixtures/orca/README.md`, and say why: no ticket on the recording machine had a stored reference, and no test may create a real Orca worktree. Tickets #25 and #27 may add their own lines to these two shared files, so keep your additions in their own lines.

### Unit 4: A temporary copy of openTracker for the file from Claude
- Files: `cstack/src/tracker/open.ts`, `cstack/test/wave/open-from-file.test.ts`
- Test: `cstack/test/wave/open-from-file.test.ts`: in a temporary repository whose `origin` is `https://github.com/example/repo.git`, `openTracker("list", { root, fromFile, run, env: {}, warn })` without `tracker` returns a tracker whose `listGroup({ milestone: "M3" })` gives the tickets of a `cstack-tracker/1` file written for `github` with the group `{ "milestone": "M3" }`. A second case passes `tracker: "jira"` and a file written for `jira`, and `readTicket("ABC-12")` returns that ticket.
- Minimum code: export `OpenTrackerOptions` and `openTracker` with exactly the interface of the decisions. Without `tracker`, read the origin URL with `run("git", ["remote", "get-url", "origin"], root)` and pass it to `trackerFromRemote` of #24. With `fromFile` and the capability `read` or `list`, return `checkedTracker(claudeFileTracker(fromFile, name, warn), name, warn)`. In every other case, throw `NoClientError.forRead(...)` for a read or a list, and `NoClientError` with a plain message for a move or a comment.
- Refactor: none.
- Commit message: feat(cli): add a temporary openTracker that reads the file from Claude
- Depends on: none

Start the file with a `WHY:` comment that says it is a temporary copy of the file that #26 owns, and that whichever of #26 and #29 merges second keeps the version of #26 and deletes this copy. Do not test the case without `--from-file` in this file: the version of #26 answers it differently, and the command test of unit 6 covers it.

### Unit 5: Find out whether a ticket has a worktree
- Files: `cstack/src/wave/worktrees.ts`, `cstack/src/wave/errors.ts`, `cstack/test/wave/worktree-check.test.ts`, `cstack/test/helpers/wave.ts`
- Test: `cstack/test/wave/worktree-check.test.ts`: real git in a temporary repository. A worktree on the branch `abc-12` makes ticket `ABC-12` count as started, with the worktree path as the reason. A branch `feature/ABC-12-login` also counts. A branch `abc-120` does not count for `ABC-12`. A worktree folder named `abc-12` on another branch counts. With the recorded `reference-find.one-worktree.json` answer, the ticket counts as started, and the reason holds `/home/user/work/example-worktrees/abc-12`. With `reference-find.archived.json`, it does not count. A folder `2026-11-19-ABC-12-some-slug` under `<common git folder>/cstack/runs/` counts and is named in the reason. A folder `2026-11-19-ABC-120-x` does not count. For GitHub, a run folder `2026-11-19-29-x` counts for `#29`, and a branch `feature/issue-29-x` counts too. A `reference find` answer with `ok: false` throws a `WaveError` with exit code `5`.
- Minimum code: in `errors.ts`, export `WaveError(message, exitCode)`. In `worktrees.ts`, export `parseWorktreeList(text)`, which returns one entry per block of `git worktree list --porcelain` with its path, its branch without `refs/heads/`, and whether it is bare, detached or prunable. Export `loadWorktreeCheck({ run, env, root, tracker, orca })`, which reads the git list and the run folders once and returns `check(ticket)`. `check` answers `{ found: false }` or `{ found: true, reason }`. It asks Orca once per ticket, only when `orca` is true, with `callOrca(run, env, ["reference", "find", ticket.url])`, and runs `checkShape` on the answer. The rules of the decisions say what counts. The run folders come from `git rev-parse --path-format=absolute --git-common-dir`, run in `root`. A missing `cstack/runs` folder means no run.
- Refactor: none.
- Commit message: feat(cli): check whether a ticket already has a worktree, an Orca workspace or a resolve-issue run
- Depends on: 1, 2, 3

`cstack/test/helpers/wave.ts` starts here. It holds a ticket builder, a temporary clone with a bare local `origin` (so `origin/HEAD` exists and no test reaches the network), and a runner that runs git for real through `createRunner` and answers Orca from the recorded files. The runner records every call, so later tests can say that a program never ran. Every reason that holds text from Orca goes through `printableText` of unit 1.

### Unit 6: List the three groups of a wave
- Files: `cstack/src/wave/groups.ts`, `cstack/src/commands/wave.ts`, `cstack/test/wave/groups.test.ts`, `cstack/test/helpers/wave.ts`
- Test: `cstack/test/wave/groups.test.ts`: `wave(["--milestone", "M3"], io, deps)` with the fake tracker of #24 and five tickets, run without a terminal. One ticket is ready, one is blocked by an open ticket, one is in progress, one has a worktree in the temporary repository, and one is done. The output holds the three groups, the key and the state of the blocker, "1 finished", and the sentence that starting tickets needs a terminal. No `git worktree add` runs, and the exit code is `0`.
- Minimum code: `groups.ts` exports `groupTickets(tickets, check)`, which applies `readyState` of #24 with the answer of the check, and `formatGroups(groups)`, which returns the text. `commands/wave.ts` exports `wave(args, io, deps)` and the `WaveDeps` type: `cwd`, `env`, `run`, `runLong`, `isTerminal()`, `readAnswer()` and `openTracker`. The command parses its flags with `parseArgs` in strict mode, finds the root with `parseWorktreeList` (the first entry, refused when it is bare), opens the tracker with the capability `list`, lists the group, loads the check, prints the groups, and stops when no ticket is ready or there is no terminal.
- Refactor: none.
- Commit message: feat(cli): list the ready, blocked and started tickets of a wave
- Depends on: 1, 2, 4, 5

The output has a heading line per group with its count, such as `Ready (1):`. Each ticket line starts with two spaces, the key, two spaces and the title from `printableTitle`, then its reason. A blocked ticket names every open blocker with its state, such as `blocked by ABC-13 (to do)`. A ticket with unknown blockers says so, and a ticket with an unknown state gives its state name through `printableText`. A started ticket says `in progress`, or gives the reason of the check. The last line gives the number of finished tickets, such as `1 finished ticket is not listed.`. The same test file also checks these cases. A title with an escape sequence prints without it. A ticket whose key fails its pattern is skipped and named on standard error, through the `warn` of `checkedTracker`. No group flag, or both, exits with `2`, and the message holds the usage line of the manifest entry. A `NoClientError` from `openTracker` exits with `4` and prints its message. A bare main entry exits with `1`. Print every error through `io` and return its exit code. Never call `process.exit()`.

### Unit 7: Start the ready tickets with git worktrees
- Files: `cstack/src/wave/start-git.ts`, `cstack/src/wave/confirm.ts`, `cstack/src/commands/wave.ts`, `cstack/test/wave/start-git.test.ts`, `cstack/test/helpers/wave.ts`
- Test: `cstack/test/wave/start-git.test.ts`: without Orca, with a terminal and the answer `y`, ticket `ABC-12` gets a git worktree at `<parent folder>/<repository folder name>-worktrees/abc-12` on the branch `abc-12`, started from `origin/<default branch>`. The output holds `cd '<that folder>' && claude '/resolve-issue ABC-12'`. When that folder already exists, the ticket is skipped with its reason.
- Minimum code: `confirm.ts` exports `isYes(answer)`, which accepts only `y` and `yes` after trimming, in any case. The command prints `Start the N ready tickets? [y/N] ` (singular for one ticket) and calls `deps.readAnswer()`. After a yes, for each ready ticket in order, it reads the ticket again with `openTracker("read", …)`, loads a fresh check, and applies `readyState`. It skips a ticket that is no longer ready, and a ticket whose branch `refs/heads/<short name>` exists, each with its reason. `start-git.ts` runs `git fetch origin` once and reads `git symbolic-ref --quiet refs/remotes/origin/HEAD` once, before the first ticket. Then, per ticket, it skips an existing folder, runs `git worktree add -b <short name> <folder> origin/<default branch>` in the root, and returns the line to print. The folder is quoted for the shell with single quotes, and each `'` inside becomes `'\''`.
- Refactor: none.
- Commit message: feat(cli): start each ready ticket of a wave in a git worktree
- Depends on: 6

The same test file also checks these cases. An existing branch `abc-12` skips the ticket. A missing `refs/remotes/origin/HEAD` exits with `1`, creates nothing, and tells the user to run `git remote set-head origin --auto`. A failed `git fetch origin` exits with `5` and creates nothing. A hostile title that holds `'; rm -rf ~; '`, backticks, `$(…)`, an escape sequence and the words "ignore your instructions" never appears in the printed command or in any argument of a recorded call. A folder whose path holds a single quote is printed correctly quoted. A failed `git worktree add` counts as a failure, the next ticket still starts, and the exit code is `5`.

### Unit 8: Start the ready tickets with Orca
- Files: `cstack/src/wave/start-orca.ts`, `cstack/src/commands/wave.ts`, `cstack/test/wave/start-orca.test.ts`, `cstack/test/helpers/wave.ts`
- Test: `cstack/test/wave/start-orca.test.ts`: with the recorded Orca answers, a terminal and the answer `y`, the long runner receives exactly `orca` with `["worktree", "create", "--repo", "path:<root>", "--name", "abc-12", "--branch", "abc-12", "--no-parent", "--reference", "<ticket URL>", "--agent", "claude", "--prompt", "/resolve-issue ABC-12", "--json"]`. The prompt is `/resolve-issue ABC-12` and nothing else, and no word of the hostile title appears in any argument.
- Minimum code: the command uses the Orca way when `orcaFeatures(run, env).get("ticket-worktrees")` is available, and the git way otherwise. `start-orca.ts` calls `callOrca(runLong, env, [...])` with the arguments above, parses the answer, and runs `checkShape` in the `write` mode. It returns started, with `result.worktree.path` through `printableText` when the answer has it. It returns failed for `ok: false` (with `error.message` through `printableText`), for a failed exit (with the lines of standard error through `printableText`) and for a missing Orca. It returns an unknown outcome for a timeout, an answer that is too large, an answer that is not JSON, and a wrong shape.
- Refactor: none.
- Commit message: feat(cli): start each ready ticket of a wave in an Orca worktree with Claude
- Depends on: 3, 7

The same test file also checks these cases. An answer with `ok: false` prints the failure, the next ticket still starts, and the exit code is `5`. A timeout prints that the outcome is unknown and that the user must check Orca before running the wave again. It never calls `worktree create` a second time for that ticket, and the exit code is `5`. An existing branch skips the ticket without calling Orca. The real `cstack wave` passes a runner with a 10-minute timeout as `runLong` and a 120-second runner as `run`, and only `worktree create` uses `runLong`.

### Unit 9: Never start a ticket before the user says yes
- Files: `cstack/src/wave/confirm.ts`, `cstack/test/wave/confirm.test.ts`, `cstack/test/helpers/wave.ts`
- Test: `cstack/test/wave/confirm.test.ts`: `readAnswer(stream)` on a stream that sends `n` and a line break resolves `n`, and leaves no `data` or `end` listener on the stream. On a stream that ends without a line, it resolves an empty answer.
- Minimum code: `confirm.ts` exports `readAnswer(input)`. It opens a `readline` interface on `input` without output, resolves the first line, resolves `""` on `close`, and closes the interface in both cases.
- Refactor: none.
- Commit message: feat(cli): read one answer from the terminal and never start a wave without a yes
- Depends on: 8

The same test file carries the negative criterion of US-14 at the level of the command. The answers `n`, an empty line and `maybe`, and a run without a terminal, start nothing: the recorded calls hold no `git worktree add` and no `orca worktree create`. A ticket that becomes blocked between the list and the yes is not started: the test changes the fake tracker inside `readAnswer`, and the output gives the reason of the skip.

### Unit 10: Make cstack wave a built command
- Files: `cstack/src/manifest.ts`, `cstack/src/cli.ts`, `cstack/src/commands/wave.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts`, `README.md`
- Test: `cstack/test/manifest.test.ts`: the command list holds fifteen built commands and eight that are not built. `unbuiltRefusal(["wave"])` is undefined, and `unbuiltRefusal(["wave", "--watch"])` names ticket #30.
- Minimum code: set `built: true` on the `wave` entry only, and keep its `notBuiltFlags`. Add the handler `wave` to `HANDLERS` in `cli.ts`. In `commands/wave.ts`, add `defaultWaveDeps()`, which uses `process.cwd()`, `process.env`, `createRunner(120_000)` as `run`, `createRunner(600_000)` as `runLong`, `process.stdin.isTTY === true` as the terminal check, `readAnswer(process.stdin)` as the answer and `openTracker` of `cstack/src/tracker/open.ts`. In `cstack/test/cli.test.ts`, `wave --watch` now names `#30`. In `README.md`, write "fifteen commands" and add one bullet for `cstack wave`.
- Refactor: none.
- Commit message: feat(cli): make cstack wave a built command
- Depends on: 9

Change only the `wave` lines in the shared files, and keep each change in one place, because the other tickets of the wave change the same files. After this unit, build with `npm run build` in `cstack/` and run the real command once in a temporary clone with a tracker file: `node <worktree>/cstack/dist/bin.js wave --milestone M3 --from-file <file>`. Run it once without a terminal, and once with a terminal through `script -q /dev/null`, answering `n`. Check that both runs end on their own. Never answer yes there, and never run `cstack wave` in this repository.

## Documentation duties

- README: applies, the "Commands" section of `README.md` gets "fifteen commands" and one bullet for `cstack wave` (unit 10).
- Fixture notes: applies, `cstack/test/fixtures/orca/README.md` lists the four hand-written answers (unit 3).
- Specification page: does not apply. US-14 is built as written, and the answers of this run are details of the command.
- Decision record: does not apply. No new architectural decision; the rules live in this plan and in the ticket comments.
- Ticket comments: applies, in phase 10. On #29, the outcome. On #30, the check, the names and the cleaning it reuses, with their files and the run folder source. On #31, the branch and folder names that `cstack wave` creates, and the question about the chat and the terminal surfaces of Orca, word for word as the review before the plan wrote it. On #26, the temporary `cstack/src/tracker/open.ts` and who deletes it.
- Epic #6: does not apply.
- Conventions file: does not apply.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: Which folder is the repository root
The ticket says that `cstack wave` runs from the root of the repository, and passes that root to Orca as `--repo path:<repository root>`. When the command runs inside a linked worktree, `git rev-parse --show-toplevel` gives the linked worktree, not the main clone. Which folder should cstack use as the repository root?
- For: the run can test it, then the user can challenge it.
- Answer: tested on 2026-11-19. Orca 1.4.263 accepts only the main clone. `orca worktree list --repo path:<main clone> --limit 1 --json` exits with 0, and the same command with the path of this linked worktree exits with 1. So cstack takes the first entry of `git worktree list --porcelain`, which is always the main worktree, as the repository root. It uses that folder for `--repo path:` and for the folder of the git way, wherever the command runs inside the repository. Source: the tested answer, 2026-11-19.

### Question 2: Count a started resolve-issue run as already started
The planned "has a worktree" check misses a ticket that someone started by hand on a branch without its key, such as `gambitl/<slug>`, before the build phase sets "in progress". Should the check also count a ticket as already started when the folder `<common git folder>/cstack/runs/` holds a run whose name starts with the date, then the ticket id, then a dash?
- For: the user.
- Answer: yes, add the run folders as a third source of the check. The user's answer ("ok") in the conversation, 2026-11-19.

### Question 3: A branch with the short name already exists
Orca 1.4.263 gives a taken branch name a numeric suffix without a word, so the build guide of #31 would not find the branch `issue-<n>`. Should cstack check `refs/heads/<short name>` before both ways of starting, and skip the ticket with its reason when the branch exists?
- For: the user.
- Answer: yes, check the branch before both ways and skip the ticket with its reason. The user's answer ("ok") in the conversation, 2026-11-19.


## Review log

### Impact notes (phase review)

- Changed shared symbols: the `wave` entry of `cstack/src/manifest.ts`, the `HANDLERS` map of `cstack/src/cli.ts`, and `SHAPES` in `cstack/src/orca/shapes.ts`. Their tests (`manifest.test.ts`, `cli.test.ts`, `orca/shapes.test.ts`) changed in the same branch and pass. No other file in `cstack/src` names `wave`.
- Usual companions of `manifest.ts` and `cli.ts` are their two tests and `README.md`. All three changed. `cstack/test/measure.test.ts` also changes with `cli.ts` in past commits. It was not touched, and the full suite passes, so it is fine.
- `cstack/src/tracker/open.ts` is a temporary copy that ticket #26 owns. Its `WHY:` comment says who deletes it.
- No decision record is named in the changed files except ADR-SIC-F and ADR-SIC-H, through `WHY:` comments of the tracker files. The command prints through `io` and never calls `process.exit()`.
- Full suite after the build: 68 test files, 863 tests, and the typecheck is clean.

### Reviewers (phase review)

Four fresh reviewers read the branch diff. All fixes are in commit 8665e54.

- Correctness: real Orca writes `--json` errors to standard output with exit code 1, and the runner dropped them, so the user never saw the reason. Fixed: the runner keeps stdout on a failed exit, and a new `cstack/src/wave/orca-error.ts` reads the error. A message about a retry or a launch becomes an unknown outcome. A ticket skipped after the yes now says why. Errors of `orca reference find` now name the ticket.
- Security: no finding at confidence 80 or more. Cheap hardening done: a ticket whose fresh key differs from the listed key is skipped, and the git start line goes through `printableText`. Not done: the Arabic letter mark U+061C is not removed by `printableText`, because its effect is very small.
- Conventions: `EXIT.toolFailed` replaces the literal 5 in `worktrees.ts`. The finding about `--watch` was not a bug, because the dispatcher already answers "Ticket #30 builds it" (checked by running the built command).
- Simplicity: removed the unused `detached` and `prunable` fields, merged the repeated option objects in `wave.ts`, and made the Orca command string one constant.
- After the fixes: typecheck clean, 68 test files and 867 tests pass.

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

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

- Units 2, 4 and 5 were written before the red run, so `cstack unit red` refused. The implementers moved the source file away to record a red run. The saved failure in those units only says the module is missing.
- Unit 1: the test first put the 100 letters after the line break, so it could not pass. `cstack unit green` warned that the test changed after the red run.
- Unit 4 reported `tsc` failing with "Cannot find type definition file for 'node'". The cause was a missing `npm ci` in this worktree. After `npm ci`, the typecheck passed.
- Unit 5 passes the Orca version "unknown" to `checkShape`, because the check does not receive a version. This was kept in units 7 and 8.
- Unit 10: the first full `npm test` ran past the 120 second shell limit because the publish tests are slow. A later run passed with 863 tests.

## Hand-off log

2026-11-19, run 1: moved issue #29 to the state "in progress" by adding the label `in progress`. The branch `gambitl/cstack-wave` was already checked out. Build started. All ten units are committed with their trailers, and the full suite and the typecheck pass. The report to the main conversation moves on to the next phase.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**Count a ticket as already started when this clone holds a `resolve-issue` run for it.** I checked it on this machine. The tickets for Jira and Linear (#25), GitHub and GitLab (#26) and the Orca workers (#27), and this ticket, are all being worked on. The planned check sees none of them. Their branches are `gambitl/<slug>` with no number, they have no Orca reference, and the "in progress" label only comes at the build phase. So `cstack wave` on this milestone today would offer to start all four again. I recommend a third source for the check: the folders under `<common git folder>/cstack/runs/`, whose names hold the ticket id (`2026-11-19-29-…`) for every tracker.

**I will do this unless you say no**

- Before both ways of starting, I check that the branch `issue-12` does not exist yet. Otherwise Orca silently creates `issue-12-1`, and the build guide of the end-to-end ticket (#31) cannot find the branch.
- When `orca reference find` fails for one ticket, I start nothing and exit with `5`.
- When one start fails or its outcome is unknown, I go on with the next ticket, never retry, and exit with `5` at the end.
- `orca worktree create` gets its own timeout of 10 minutes instead of 120 seconds. Orca may run the repository's setup scripts, and a killed call leaves an unknown outcome that must not be retried.
- After the answer, I close the terminal reader. Otherwise Node keeps waiting for input and the command never ends, because nothing calls `process.exit()`. End of input (Ctrl-D) counts as no.

**I checked it myself**

- Orca accepts only the main clone for `--repo path:`: the call exits with `0` on the main clone and `1` on this worktree. The first entry of `git worktree list --porcelain` is the right root.

**Good to know**

- Every check is local. A colleague on another machine can start the same ticket until someone sets "in progress".
- Orca starts Claude as a chat or in a terminal, following each person's setting. The end-to-end ticket (#31) should try `/resolve-issue` in both.

#### Details

The planned "has a worktree" check misses every ticket started the way this team starts tickets today. This point is blocking, and the developer decides it. I ran `git worktree list --porcelain` in this clone on 2026-11-19. The worktrees of #25, #26, #27 and #29 sit in folders named `tracker-jira-linear`, `tracker-gh-glab`, `helpers-orca-workers` and `cstack-wave`, on branches `gambitl/<same slug>`. None holds the key, and none holds `issue-<n>`. `orca reference find https://github.com/gambitl/claude-code-stack/issues/29 --json` returned `matches: []`. `gh issue list` on the milestone shows no "in progress" label on any of them. The reason is in `cstack/guides/resolve-issue/build.md` line 7: the ticket moves to "in progress" only at the build phase, after the question round and the plan, which can take hours. `forgeStateKind` in `cstack/src/tracker/states.ts` reads that label only. During that window, `readyState` returns `ready`, and the wave would create a second worktree and start a second Claude on the same ticket. A reliable local signal already exists. ADR-SIC-B puts the run state at `<common git folder>/cstack/runs/<plan file name without .md>` (`cstack/src/run-state.ts` line 94), shared by every worktree of the clone. The phase guide `ticket.md` line 34 names the plan file `<YYYY-MM-DD>-<ticket-id>-<slug>.md`, so the folder name holds `29` on GitHub and GitLab and `ABC-12` on Jira and Linear. The folder `runs/` of this clone holds exactly the four tickets of this wave today. The recommendation is to match the folder names against the date, then the ticket id, then a dash, ignoring case, and to print "a resolve-issue run exists (<plan name>)" as the reason. The options I rejected are matching the bare number in branch names, which gives false matches, and asking the team to rename branches, which does not cover tickets already started. If nobody decides, the wave ships with a false "ready" for any ticket in its question round or plan, and #30 inherits the same blind spot, because it reuses this check. A run folder left behind by an abandoned run keeps its ticket in "Already started" until someone removes the folder. The printed plan name tells the user which folder to remove.

Draft question 2, about a branch `issue-<n>` that already exists, is relabelled blocking. Without the check, Orca 1.4.263 silently adds a numeric suffix ("a taken name gets a numeric suffix" in `orca worktree create --help`), so the build guide of #31 would not find the branch. The work would then be wrong, not only different. The developer answers it, and the recommendation stays: check `refs/heads/<short name>` before both ways and skip the ticket with its reason. Draft questions 3 and 4 stay non-blocking, with their recommendations unchanged. A failing `reference find` most likely means Orca itself is broken, so stopping everything is the safer choice. Never retrying matches the Orca help ("Never retry as a fresh launch").

The timeout of `orca worktree create` should differ from the 120 seconds of the reads. `createRunner(timeoutMs)` in `cstack/src/orca/run.ts` sends `SIGKILL` on timeout. The help says repository setup hooks follow the repository's setup policy, so a repository with a slow install step may exceed 120 seconds. A killed call is the worst case: the worktree may exist, Claude may be running, and the operation id that `--retry-launch` needs is lost. The recommendation is a second runner with a 10-minute timeout, used only for `worktree create`. If nobody decides, slow repositories get "unknown outcome" on every ticket of a wave.

The terminal prompt is the first in cstack (`cstack/src/commands/report-submit.ts` line 13 only reads `isTTY`). Under ADR-SIC-H, no command calls `process.exit()`, so the process ends only when the event loop is empty. A `readline` interface that stays open, or a `process.stdin` left flowing, keeps the process alive after the wave has finished. The real prompt dependency must close its interface after one line, and must resolve to "no" on `close` (end of input). A test cannot see this hang through the injected fake, so the build should run the real command once with `printf 'n\n' | ...` and with a terminal.

The tested answer to blocking question 1 holds. I ran it again on 2026-11-19 with Orca 1.4.263. `orca worktree list --repo path:/Users/distefano/orca/claude-code-stack --limit 1 --json` exited with `0`, and the same call with this worktree's path exited with `1`. One edge case remains. In a clone set up as a bare repository with linked worktrees, the first porcelain entry is marked `bare` and has no working folder. cstack should then refuse with a clear message rather than pass that path to Orca or build `<parent>-worktrees` next to it.

Every check is local to one machine. The Orca references, the git worktrees and the run folders all live on the machine that runs the wave. Two people on two machines can start the same ticket until the build phase sets "in progress". Making the wave set "in progress" itself would close that gap, but it adds a tracker write, which needs a write-capable client under ADR-SIC-F and which `--from-file` cannot do. I do not recommend it in this ticket. It fits better in the epic coordinator that the specification page moves to the next epic (line 244).

Orca starts the agent "as a chat or a terminal per your Chat | CLI choice for that agent" (`orca worktree create --help`), unless `--surface` is given. The ticket fixes the exact arguments of step 7 and leaves `--surface` out. I did not check whether a slash command in `--prompt` runs the skill in the chat surface, because that needs a real launch. This is non-blocking for this ticket, because US-14 AC3 is checked end to end in #31. The question for #31, word for word: "Does `orca worktree create --agent claude --prompt "/resolve-issue <key>"` start the skill both when the user's setting is Chat and when it is CLI? If the chat surface does not run slash commands, should `cstack wave` pass `--surface terminal`?" It is for whoever builds #31.

I also checked security and authorization (the ticket's own CTO review already locks how ticket text is handled, and nothing here changes it), data model lock-in, scale, operations and cost, and reversibility, and found nothing to add. The branch name `issue-<n>` becomes a convention that #31 relies on, which the ticket already states in scope step 9.

### Open questions and answers

1. Blocking question 1 (which folder is the repository root). Recommended answer: the main worktree. Tested on 2026-11-19, see "Blocking questions".
2. Blocking question 3 (a branch with the short name already exists), relabelled blocking by the review before the plan. Recommended answer: check `refs/heads/<short name>` before both ways, and skip the ticket with its reason. The user answered "ok" on 2026-11-19.
3. Non-blocking, accepted by default on 2026-11-19 (the user answered "ok"). When `orca reference find` fails for one ticket, cstack cannot tell whether that ticket has a worktree. Recommended answer: cstack stops before the question, starts nothing, names the ticket and the failure, and exits with `5`.
4. Non-blocking, accepted by default on 2026-11-19 (the user answered "ok"). When one start fails, or its outcome is unknown, such as a timeout or an answer of the wrong shape, cstack goes on with the next ticket. It never retries, because Orca's help says a lost launch must never be retried as a fresh launch. At the end it exits with `5`, and for an unknown outcome it tells the user to check Orca before running the wave again. Recommended answer: as described.
5. Blocking question 2 (count a started resolve-issue run as already started), raised by the review before the plan. Recommended answer: yes, as a third source of the check. The user answered "ok" on 2026-11-19.

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
