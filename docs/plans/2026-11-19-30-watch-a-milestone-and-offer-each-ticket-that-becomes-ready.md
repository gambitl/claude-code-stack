# Plan: #30 — M3-7: Watch a milestone and offer each ticket that becomes ready

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/30
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/wave-watch
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T17:48:36+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** cstack keeps an eye on a milestone and tells the user, with a Mac notification, as soon as a blocked ticket can start. It then asks whether to start it.

- **What the title means**: cstack is the command-line tool that this project builds. A milestone is a group of tickets that a team plans together. "Watch" means that cstack reads the tracker, the tool that holds the tickets, again every few minutes. A ticket becomes ready when every ticket that blocks it is finished. In practice, a blocker is finished when its pull request, the proposed change to the code, has been merged. "Offer" means that cstack asks the user before it starts anything.
- **Why we are doing it**: Today, the user must check the tracker by hand to see when a blocker is merged. They may notice it late, and the next ticket then waits for nothing.
- **For the user**: A solution engineer leaves one terminal open, the text window where they type commands. They get a notification when the next ticket can start, and they answer yes or no in that terminal.

**Goal.** This ticket delivers `cstack wave --watch` (US-15). It reads the tracker at the interval that the settings file sets, and it offers each ticket that becomes ready. Greenfield: nothing exists yet.

### Where things are today (read first)

* **cstack**: Greenfield: no existing surface. When this ticket was written, cstack did not exist yet. #29 writes `cstack wave`, the check "has a worktree", the start of one ticket and the printing of titles. #14 writes the reading of the settings file.
* **The story**: `docs/projects/skills-into-cli.md` (lines 190 to 194): These lines hold US-15. Line 313 sets the default interval to five minutes. It recommends a key of the settings file, so that a team can lower the load on its tracker. Line 354 defines a tracker client as a command-line tool that is already logged in to a tracker, such as `orca`, `glab` or `gh`.
* **macOS notifications**: `/usr/bin/osascript` runs AppleScript, the scripting language of macOS. AppleScript can show a notification. A script that starts with `on run argv` receives the arguments given after the script on the command line. So the text of the notification never has to be part of the script.
* **Contract**: #24 writes the ready rule, which #29 and this ticket both call. A ticket is ready when each of its blockers is finished, when it is not in progress, and when it has no worktree yet. A blocker in review is not finished. #24 also says when a tracker client exists. Orca must be connected to the tracker, or `gh` or `glab` must be logged in for GitHub or GitLab. The file that Claude writes is not a client. #29 gives the check "has a worktree", the function that starts one ticket after checking the rule again, and the printing of titles without control characters. #14 gives the key `watchIntervalMinutes` of `.cstack/settings.json`, with the default 5 (decision 8).

### Scope

1. Add `--watch` to `cstack wave`, in `cstack/src/wave/watch.ts`. The watch runs in the foreground of a terminal. When the command does not run in an interactive terminal, cstack refuses and says why.
2. At the start, cstack checks that a tracker client exists for the tracker (US-15 AC4). When none exists, cstack says so and says to run `cstack wave` again by hand. With Claude's help, that run can use `--from-file`. Then cstack exits with `4`, the common code of #13 for a missing tool. `--watch` together with `--from-file` is refused, because a file never changes.
3. The first round works like `cstack wave`. cstack prints the three groups and asks about the tickets that are ready now.
4. Then cstack reads the group again every `watchIntervalMinutes` minutes, from the settings file of #14 (US-15 AC1).
5. A ticket that was not ready in the previous round and is ready now has just become ready. For each such ticket, cstack does two things (US-15 AC2).
   - It sends a macOS notification. It runs `osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title "cstack"' -e 'end run' "<text>"`, with a list of arguments and no shell. The text is "Ticket <key> is ready. Answer in the cstack terminal." It holds the checked key and fixed words only.
   - It asks in the terminal "Start <key> now? [y/N]". On a yes, it starts the ticket with the start function of #29, which checks the rule again first. On any other answer, it does not ask about that ticket again during this watch.
6. While a question waits for an answer, no new round starts. The next round starts after the answer.
7. After each round, cstack prints one short line with the time and the number of tickets in each group, so that you can see that it still works.
8. When a read of the tracker fails, cstack prints the error and tries again at the next round. After three failed rounds in a row, it stops and says why.
9. When `osascript` fails, for example because notifications are turned off, cstack says so once. It keeps asking its questions in the terminal.
10. The watch ends when no ticket of the group is ready or blocked anymore, or when you press Control-C. Control-C during a question starts nothing.
11. Replace the placeholder handler of `cstack wave --watch`.

### Acceptance (TDD)

* `cstack/test/wave/watch-interval.test.ts`: This test carries US-15 AC1: "`cstack wave --watch` reads the tracker at a regular interval. The settings file sets that interval." Write first a case with a fake clock and a settings file that sets `watchIntervalMinutes` to 2. See the fake tracker read at minutes 0, 2 and 4. Without that key, the reads happen every 5 minutes.
* `cstack/test/wave/watch-ready.test.ts`: This test carries US-15 AC2: "When a ticket becomes ready, it sends a macOS notification and asks whether to start that ticket." Write first a case where a blocker moves to done between two rounds. See one `osascript` call and one question about the blocked ticket. When the blocker moves to in review instead, nothing happens. After a "no", cstack does not ask about that ticket again.
* `cstack/test/wave/watch-no-client.test.ts`: This test carries US-15 AC4: "It needs a tracker client on the machine. Without one, it says so, and the user runs `cstack wave` again by hand." Write first a case with no Orca connection, no `gh` and no `glab`. See the message, the exit code `4`, and no second read of anything. `--watch` with `--from-file` is refused.
* `cstack/test/wave/watch-confirm.test.ts`: This test carries the negative criterion of US-15: "It never starts a ticket before the user says yes." Write first a case where the answer is `n`, and see no worktree created and no `orca worktree create` call. An empty answer and Control-C start nothing either.
* `cstack/test/wave/watch-errors.test.ts`: Write first a case where the tracker read fails three rounds in a row, and see the watch stop with the reason. One failed read followed by a good one keeps the watch going.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* The `osascript` call holds fixed script lines, and the notification text is a separate argument. A test uses a ticket whose title holds a double quote and `& do shell script "rm -rf ~"`, and checks that no part of the title appears in any argument. The ticket title never appears in a notification.

**Size: M** · Blocked by: #29, #14 · Feeds: #31

---

### CTO review — ticket text never reaches a shell command, a prompt or a script string (2026-11-17)

1. The notification text reaches `osascript` as an argument that `on run argv` reads. The script lines are fixed strings in cstack, and no ticket data ever goes into them.
2. The notification holds only the checked key and fixed words. It never holds the title or the body of a ticket.
3. A ticket started from the watch goes through the same start function as in #29, with the same checks of the key, the URL and the ready rule.

### Ticket comments

Comment of 2026-11-18T09:10:58Z:

Ticket #14 adds `readSettings(root)` in `cstack/src/settings.ts`. The key `watchIntervalMinutes` is a whole number from 1 to 1440, and the default is 5. The result also tells you whether the value comes from the file or from the default.

Comment of 2026-11-19T14:07:14Z:

Ticket #29 built `cstack wave` on the branch `gambitl/cstack-wave`. This comment lists what you can reuse for `--watch`.

- The check "has a worktree" is in `cstack/src/wave/worktrees.ts`. Call `loadWorktreeCheck({ run, env, root, tracker, orca })` once, then `check(ticket)` for each ticket. It answers `{ found: false }` or `{ found: true, reason }`. It reads three sources: `git worktree list --porcelain`, the folders under `<common git folder>/cstack/runs/` whose name starts with a date and the ticket id, and, only when `orca` is true, `orca reference find <ticket URL>`. It throws a `WaveError` with exit code `5` when Orca fails.
- The three groups are in `cstack/src/wave/groups.ts`. `groupTickets` applies `readyState` and `formatGroups` prints them. `blockedReason` gives the reason of a ticket that is not ready.
- The names are in `cstack/src/wave/names.ts`: `shortName(tracker, key)` and `runTicketId(tracker, key)`.
- The cleaning of text before it is printed is in `cstack/src/wave/title.ts`: `printableTitle` and `printableText`. Print every title and every text from Orca or the tracker through them.
- The command is `cstack/src/commands/wave.ts`. It takes its dependencies as one object (`WaveDeps`), so a test can pass a fake tracker, a runner and a scripted answer. The `--watch` flag is still in `notBuiltFlags` of the manifest with your ticket number.
- Rules to keep: a start never happens before a yes, every program runs without a shell, and the only ticket data that reaches a program is the checked key, the short name and the checked URL.

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

- ADR-SIC-A, how the helpers run: `docs/decisions/ADR-SIC-A-helpers.md`.
- ADR-SIC-B, where the run state lives and how its format is versioned: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how `cstack` ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-D, the settings file and the models of the agents: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final`.
- ADR-SIC-F, how `cstack` reaches trackers and forges: `docs/decisions/ADR-SIC-F-tracker-access.md`. `cstack` never holds credentials.
- ADR-SIC-H, how a `cstack` command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`. A command prints through `io`, returns its exit code, and never calls `process.exit()`.

## Dependencies

clear

The tracker names two blockers, #14 and #29. Both are closed as completed. #14 merged with pull request #39, and #29 merged with pull request #56, so their code is on `main`.

## Code mapping

**Entry point.** `cstack wave` is `wave(args, io, deps)` in `cstack/src/commands/wave.ts` (172 lines). `cstack/src/cli.ts` (line 68) calls it with `defaultWaveDeps()`. The function parses `--milestone`, `--epic`, `--tracker` and `--from-file` with `parseArgs` in strict mode (lines 51 to 75). It has no `--watch` option yet. Today the flag never reaches it, because `unbuiltRefusal` in `cstack/src/manifest.ts` refuses `--watch` first with exit code `1` and "Ticket #30 builds it."

**Dependencies object.** `WaveDeps` (lines 21 to 32) holds `cwd`, `env`, `run` (two-minute timeout), `runLong` (ten-minute timeout, for `orca worktree create`), `isTerminal()`, `readAnswer()` and `openTracker`. Tests build their own `WaveDeps`. The `--watch` code adds a clock, a sleep and a way to see Control-C to this object, the way `cstack/src/commands/publish.ts` (lines 31 to 42) takes `sleep` and `now` so that its tests move a fake clock.

**One round of `cstack wave` today** (lines 78 to 109). cstack reads `git worktree list --porcelain` to find the root of the main worktree. It takes the tracker name from `--tracker`, or from the origin remote with `trackerFromRemote`. It opens the tracker with `deps.openTracker("list", options)`, then calls `listGroup(group)`. It asks Orca once whether the feature "ticket-worktrees" exists, loads the check "has a worktree" with `loadWorktreeCheck`, sorts the tickets with `groupTickets`, and prints them with `formatGroups`.

**The start of tickets is inline, not a function** (lines 124 to 163). After the yes, cstack opens the tracker again with the capability `read`, loads a fresh worktree check, and picks the start function: `startInOrca(runLong, env, root)` or `await prepareGitStart(run, root)`. `prepareGitStart` runs `git fetch origin` and reads `origin/HEAD` once. Then, for each ready ticket, it reads the ticket again, refuses a ticket whose key changed, applies `readyState` again, refuses a ticket whose branch already exists (`git show-ref`), and starts it. The ticket says "the start function of #29", but no such function exists. So this ticket must move this loop into a function in `cstack/src/wave/` that both `cstack wave` and the watch call. That move must not change what `cstack wave` prints, because `cstack/test/wave/confirm.test.ts`, `start-git.test.ts` and `start-orca.test.ts` check those lines.

**The no-client case.** `openTracker` in `cstack/src/tracker/open.ts` (lines 81 to 118) throws `NoClientError` (exit code `4`, from `cstack/src/tracker/errors.ts`) for the capability `list` when Orca cannot reach Jira or Linear, or when `gh` or `glab` is not logged in for the host. Its message tells the user to pass a file with `--from-file`. The watch must catch this error and print its own message, which says to run `cstack wave` again by hand. With `--from-file`, `openTracker` never checks a client, which is one more reason why `--watch` with `--from-file` is refused before anything is read.

**Reused pieces, all on `main` from #29 and #24.** The ready rule is `readyState(ticket, hasWorktree)` in `cstack/src/tracker/ready.ts`. A blocker in review has the kind `in-progress`, so it blocks. The groups come from `groupTickets` and `formatGroups` in `cstack/src/wave/groups.ts`, and `Groups` already holds the counts that the status line of each round needs. The worktree check is `loadWorktreeCheck` in `cstack/src/wave/worktrees.ts`. It reads the git list and the run folders once, so each round must load it again. `printableText` and `printableTitle` in `cstack/src/wave/title.ts` clean every text from a tracker before it is printed. `isYes` and `readAnswer` in `cstack/src/wave/confirm.ts` read the answer. Only `y` and `yes` count. `readAnswer` creates a `readline` reader on standard input without an output stream, so the reader does not put the terminal in raw mode, and Control-C reaches the process as the signal `SIGINT`. Node 26 is the minimum (`engines.node`), so `AbortSignal` and the `signal` option of `readline` exist.

**Settings.** `readSettings(root)` in `cstack/src/settings.ts` (line 166) returns `values.watchIntervalMinutes`, a whole number from 1 to 1440 with the default 5, and its source. It throws `SettingsError` for a bad file, and every command turns that error into exit code `3`. `cstack wave` does not read the settings today.

**Programs run without a shell.** `createRunner` in `cstack/src/orca/run.ts` uses `execFile`, so the arguments of `osascript` never pass through a shell. A program that does not exist answers `{ kind: "missing" }`. The test runner `makeRunner` in `cstack/test/helpers/wave.ts` runs git for real in a temporary clone and answers every other program from recorded Orca answers, or with `missing`. The watch tests need a runner that also records the `osascript` calls.

**Test fakes.** `FakeTracker` in `cstack/test/fakes/tracker.ts` holds tickets in memory, and a test can change them between two calls. It has no record of the calls to `listGroup` and no way to fail a read on purpose, so the interval test and the error test need a small wrapper or a new option. `makeClone()` in `cstack/test/helpers/wave.ts` builds a clone of a bare local origin, so no test reaches the network. `ticket(key, extra)` builds a ticket.

**Manifest and command list.** The entry of `cstack wave` (`cstack/src/manifest.ts`, lines 282 to 291) already lists `--watch` in its usage line and its flags. Only `notBuiltFlags: { "--watch": 30 }` must go. The counts stay at 22 built commands and 1 not built, because this ticket builds a flag. `cstack/test/manifest.test.ts` (lines 125 to 137) names `--watch` and #30 in two cases. `cstack/test/cli.test.ts` (lines 123 to 137) loops over the `notBuiltFlags` of the real list. Ticket #28 removes its own `--child-worktree` case in the same places, so these lines will meet in a merge.

**Documentation.** `README.md` (line 70) describes `cstack wave` and needs one sentence about `--watch`. `docs/projects/skills-into-cli.md` (lines 188 to 196) holds US-15, and line 322 holds the watch interval. `cstack/skills/resolve-issue/templates/settings.json` already shows `watchIntervalMinutes`.

**Governing decisions.** ADR-SIC-H says a command prints through `io`, returns its exit code, and never calls `process.exit()`. ADR-SIC-F says cstack holds no credential and picks a client per capability. The CTO review of the ticket says that ticket data never reaches a script string, and that the notification holds only the checked key and fixed words. The only `WHY:` comment in the area is in `cstack/src/wave/start-git.ts` (line 32), about `--no-track`.

**Risks.** `cstack/src/commands/wave.ts` changed in five commits during #29, and one of them fixed how an Orca error is read. Moving the start loop into a function can change a printed line by accident, and three test files check those lines. `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/test/cli.test.ts` are shared with #28, which runs at the same time. Control-C needs care: a `SIGINT` listener replaces the default end of the process, so it must be removed when the watch ends, as `cstack/src/test-run.ts` (lines 100 to 111) does. A `readline` reader that stays open keeps the process alive after the watch ends.

## Decisions

- `cstack wave --watch` checks, in this order, before it reads any tracker: the flags, then the settings file, then the terminal. A bad settings file exits with `3`. Without an interactive terminal, cstack refuses with exit code `1` and says that the watch asks its questions in a terminal. (2026-11-19, assumption not asked)
- `--watch` together with `--from-file` exits with the usage code `2`, like the other flag combinations of `cstack wave`, and the message says that a file never changes. (2026-11-19, assumption not asked)
- When no tracker client exists, the watch catches the `NoClientError` of `openTracker`, prints its own message, and exits with `4`. The message says that the watch needs a tracker client, and that you can run `cstack wave` again by hand, with `--from-file` and a file that Claude writes. Nothing else is read after that. (2026-11-19, assumption not asked)
- The first round asks one question for all the tickets that are ready now, with the words of `cstack wave`: "Start the N ready tickets? [y/N]". It sends no notification. Every ticket of a first round that gets any answer other than yes counts as declined for the rest of the watch. (2026-11-19, assumption not asked, from scope item 3)
- The watch starts every ticket through one start function that both `cstack wave` and the watch call. That function reads the ticket again, checks its key, applies `readyState` again, checks that its branch does not exist, and starts it with Orca or with git. Moving this code out of `cstack/src/commands/wave.ts` must not change any line that `cstack wave` prints. (2026-11-19, assumption not asked, from the CTO review block of the ticket)
- A round reads the group, loads the worktree check again, and sorts the tickets with `groupTickets`. A ticket has just become ready when it is ready in this round and was not ready in the last round that succeeded. (2026-11-19, assumption not asked)
- When several tickets become ready in the same round, cstack handles them one by one, in the order of the group. For each one, it sends the notification first, then asks "Start <key> now? [y/N]". Only `y` or `yes` counts as yes, as in `cstack wave`. (2026-11-19, assumption not asked)
- The notification runs `/usr/bin/osascript` with the arguments `-e`, `on run argv`, `-e`, `display notification (item 1 of argv) with title "cstack"`, `-e`, `end run`, and the text `Ticket <key> is ready. Answer in the cstack terminal.` The full path keeps another program named `osascript` on the `PATH` from receiving the text. The key is the checked key, and nothing else from the ticket goes into any argument. (2026-11-19, assumption not asked)
- When the notification fails for any reason, including a machine that is not a Mac, cstack prints one line that says so, the first time only. It goes on asking its questions in the terminal. (2026-11-19, assumption not asked, from scope item 9)
- The reads follow a fixed schedule. The next round starts `watchIntervalMinutes` minutes after the start of the previous round. When a question or a start takes longer than that, the next round starts right after it ends. (2026-11-19, assumption not asked)
- After each round, cstack prints one line with the local time in hours and minutes and the size of each group, for example `14:05  1 ready, 2 blocked, 1 already started, 3 finished.` (2026-11-19, assumption not asked)
- A round fails when reading the group, the git list of worktrees or the Orca references fails. cstack prints the error and keeps the result of the last good round. After three failed rounds in a row, the watch stops, says why, and exits with the exit code of the last error. One good round sets the count back to zero. (2026-11-19, assumption not asked)
- A start that fails or whose outcome is unknown does not stop the watch. It counts for the exit code `5` at the end, like a failed start of `cstack wave`. (2026-11-19, assumption not asked)
- Control-C ends the watch at any moment. cstack prints "Stopped the watch." and exits with `0`, because Control-C is the normal way to end a watch, unless a start failed or was cut, as the rule about the exit code says. Control-C during a question starts nothing. cstack removes its own `SIGINT` listener and closes its reader on standard input before it returns. (2026-11-19, assumption not asked)
- When Control-C arrives while a ticket is being started, the terminal also stops the `git` or `orca` program that cstack runs. So cstack reports the outcome of that ticket as unknown, tells you to check it by hand, and the watch exits with `5`. (2026-11-19, the user's answer: accepted by default)
- The watch ends on its own when no ticket of the group is blocked and every ready ticket was already offered, whatever the answer was. A ticket whose start was skipped or failed also counts as offered. A blocked ticket whose state or blockers are unknown keeps the watch running. When the watch ends this way, cstack says so and exits with `0`, or with `5` when a start failed. (2026-11-19, the user's answer to blocking question 1)
- The watch keeps one reader on standard input for its whole life. A line that arrives while no question waits is thrown away, and cstack prints one short line that says it ignored it. Only a line that arrives after a question is printed answers that question. The watch does not use `readAnswer` of `cstack/src/wave/confirm.ts`, which reads one line and closes its reader. (2026-11-19, the user's answer to blocking question 2)
- When standard input ends, for example with Control-D or a closed terminal, the watch stops, says that standard input closed, and starts nothing more. It exits with `0`, or with `5` when a start failed. (2026-11-19, the user's answer: accepted by default)
- Before each start in the watch, cstack runs `git fetch origin` again, both when it starts with git and when it starts with Orca. A watch runs for hours, and the ticket became ready because a blocker just merged, so an old copy of the default branch would lack that merge. When this fetch fails, only that start fails, and the watch goes on. `cstack wave` without `--watch` keeps its single fetch. (2026-11-19, the user's answer: accepted by default)
- Each question of the watch writes the terminal bell character before its text. At its start, the watch prints one line that says macOS must allow notifications for Script Editor, because `osascript` may report success even when notifications are blocked. The bell and that line hold no ticket data. (2026-11-19, the user's answer: accepted by default)
- The first round of the watch is the first round that succeeds. When the very first read fails, it counts as a failed round, and the watch tries again at the next round. The first good round prints the groups and asks the one question for all the ready tickets. (2026-11-19, assumption not asked, from the architecture review)
- The exit code of the watch follows one rule, whatever ends it. After three failed rounds in a row, it is the exit code of the last error. Otherwise it is `5` when at least one start failed, had an unknown outcome, or was cut by Control-C while `git worktree add` or `orca worktree create` ran, and `0` in every other case. This covers the end on its own, Control-C and the end of standard input. (2026-11-19, assumption not asked, from the architecture review)
- At its start, after the settings and the terminal, the watch opens the tracker once with the capability `list` and once with the capability `read`. A `NoClientError` from either one gives the watch's own message and exit code `4`. The watch also asks Orca once, at its start, whether the feature "ticket-worktrees" exists, and keeps that answer for the whole watch. (2026-11-19, assumption not asked, from the architecture review)
- The watch reads `.cstack/settings.json` from the root of the main worktree, the same root that `cstack wave` uses for everything else. (2026-11-19, assumption not asked)
- The shared start function takes an optional stop signal. Right before it creates a worktree, with git or with Orca, it checks that signal and creates nothing when the watch was stopped. Control-C also stops `git show-ref`, so without this check a cut `git show-ref` would look like "no branch" and the start would go on. `cstack wave` passes no signal, so nothing changes for it. (2026-11-19, assumption not asked, from the architecture review)
- In `cstack/test/cli.test.ts`, the case `[["wave", "--watch"], "#30"]` of the test "names the ticket of the command for the flags of unbuilt commands" is deleted. In `cstack/test/manifest.test.ts`, the two lines that expect `unbuiltRefusal(["wave", "--watch"])` to name #30 now expect `undefined`. When ticket #28 has already merged and removed its own case, the test of `cli.test.ts` gets its own small list of made-up commands with an unbuilt flag, as the test of unbuilt first words does, and the test "names the ticket of the flag once the command is built" of `manifest.test.ts` does the same. (2026-11-19, from the brief of the coordinator)
- When Control-C arrives during a start but before `git worktree add` or `orca worktree create` began, for example during the fetch, the re-read of the ticket or `git show-ref`, nothing can exist yet. The watch prints `<key>  not started, because you stopped the watch.`, and that ticket does not count for the exit code `5`. The `AbortError` that `startTicket` throws at its stop check is caught by the watch and never reaches `bin.ts`. Only a Control-C during the creation itself gives the "outcome unknown" line and the exit code `5`. (2026-11-19, the user's answer at the approval gate: accepted by default)
- Each start of the watch runs exactly one `git fetch origin`. In the git way, it is the fetch inside `prepareGitStart`. In the Orca way, the watch calls `fetchOrigin` before `startInOrca`. When that fetch fails, the watch prints its own line `<key>  failed, \`git fetch origin\` failed.`, counts a failed start, and goes on. (2026-11-19, the user's answer at the approval gate: accepted by default)
- Tests never wait for real minutes. The watch takes `now()` and a `sleep` that a test replaces with a fake clock, as `cstack publish` does. Tests never run the real `osascript`, `orca`, `gh` or `glab`. (2026-11-19, from the brief of the coordinator and the conventions of the repository)
- The manifest change is only the removal of `notBuiltFlags: { "--watch": 30 }` from the entry of `cstack wave`. The counts stay at 22 built commands and 1 not built. In `cstack/test/manifest.test.ts`, only the lines that name `--watch` and #30 change. (2026-11-19, from the brief of the coordinator)
- Never run `cstack wave` or `cstack wave --watch` for real, against any tracker, from this repository or any other. Never run `osascript`, `orca worktree create`, or `git worktree add` outside a temporary test folder. Never read a tracker from work. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` in a temporary clone, never with a yes and never with `--watch` against a tracker. (2026-11-19, from the brief of the coordinator)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change anything under `~/.claude/skills/`, because other runs on this machine use the installed `cstack` 0.2.0 right now. Never change `.cstack/settings.json`, and never edit anything under the top-level `skills/` folder, which is frozen at the tag `prose-skills-final`. Never read, run or change anything under `~/comparison/`. (2026-11-19, from the brief of the coordinator)
- A new worktree has no `node_modules`, so `npm ci` runs in `cstack/` before the first test. The full suite takes about 90 to 100 seconds, so give it a timeout above 120 seconds or run it in the background. The test "names a unit without a commit" in `cstack/test/report.test.ts` sometimes passes its 5-second timeout in a full run, and other slow tests can fail once when several suites run on this machine. Run the suite again before you look for a bug, and say so in the executor notes when it happens. (2026-11-19, from the brief of the coordinator)
- When the branch is brought up to date with `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never change `user.email` in the git config, and never push a tag that starts with `v`. Before a rebase or a merge is committed, search every file that had a conflict for a leftover conflict marker and for a function or a shape that git kept twice. Then check the counts of built and not-built commands and run the whole suite again. (2026-11-19, from the brief of the coordinator)
- The repository is public. Never write the name of an employer or a client, a ticket key from work, or a count from work retrospectives, in files, commits, the pull request, ticket comments, this plan or the retrospective. Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD`, the drafted title and the drafted body of the pull request into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`, which must exit with `0`. Never print the private list. (2026-11-19, from the brief of the coordinator)
- Ticket #28 merged on main (6f989c3, green CI) while this build runs. Main now counts 23 built commands and 0 not built, so after the rebase the counts stay at 23 and 0, and the lines above that say 22 and 1 describe the old main. In `cstack/test/cli.test.ts`, the test "names the ticket of the command for the flags of unbuilt commands" then has no real unbuilt flag left, so unit 10 gives it its own small list of made-up commands with an unbuilt flag, as the test of unbuilt first words does. Unit 10 does the same in `cstack/test/manifest.test.ts` for the test "names the ticket of the flag once the command is built", if #28 removed its own line there. Unit 10 also checks that `notBuiltFlags` is gone from the wave entry of `cstack/src/manifest.ts` and that no test still expects a refusal for `--watch`. Before a rebase is committed, search every conflicted file for leftover conflict markers and for a function or shape that git kept twice, then run the whole suite. (2026-11-19, from a message of the coordinator)
- On GitHub, the ticket states are labels. "In progress" means the label `in progress`, and "in review" means removing `in progress` and adding `in review`. Never merge the pull request; the user merges it. When the `cstack` check of the pull request is cancelled with "The job was not acquired by Runner", it is not a code failure: rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the brief of the coordinator)

## Architecture

The watch is one plain loop, in a new file `cstack/src/wave/watch.ts`, that does one thing at a time: read, print, offer, check the end, sleep. `wave()` in `cstack/src/commands/wave.ts` keeps what both modes share, which is the flags, the root, the tracker name and the tracker options. With `--watch`, it hands over to `watch()` right after it builds the tracker options. The watch takes its clock, its sleep, its Control-C hook and its input stream as a fourth parameter of `wave()`, `watch: WatchDeps = defaultWatchDeps()`, the way `cstack publish` takes its own dependencies with a default value. So `cstack/src/cli.ts` and the four existing wave test files do not change, and those test files keep proving that `cstack wave` prints the same lines.

Three small modules hold one rule each. `cstack/src/wave/start.ts` holds `startTicket(key, context)`, which is the per-ticket body of the start loop of `wave.ts`, moved word for word, plus one check of an optional stop signal right before the start. `cstack/src/wave/answers.ts` holds the one reader of standard input, which drops every line that arrives while no question waits. `cstack/src/wave/notify.ts` holds the `osascript` call with its fixed script lines. `cstack/src/wave/start-git.ts` gets `fetchOrigin(run, root)`, taken out of `prepareGitStart`, so the watch can fetch before every start. `cstack/src/wave/confirm.ts` gets `startAllQuestion(n)`, so the first round of the watch asks with the exact words of `cstack wave`.

Stopping uses the standard `AbortController`. One controller is aborted by Control-C, and another by the end of standard input. `AbortSignal.any` joins them into one stop signal that wakes the sleep, answers a waiting question, and reaches `startTicket`. The sleep is `setTimeout` from `node:timers/promises` with that signal, so no timer stays alive after the watch returns. A `try`/`finally` around the rounds always removes the `SIGINT` listener and closes the reader.

The watch keeps a few plain values between rounds: the keys that were ready in the last good round, the keys that got an answer other than yes, the keys that were offered, the count of failed rounds in a row, whether a start failed, and whether the "notification failed" line was already printed. A ticket is offered when it is ready now, was not ready in the last good round, and was not declined. The watch ends on its own when no ticket is blocked and every ready ticket was offered.

The lines that the watch prints are these. Tests check parts of them, so keep these words.

| When | Stream | Text |
|---|---|---|
| Start of the watch | stdout | `Watching <milestone or epic> every <n> minutes. Press Control-C to stop.` then `macOS shows the notifications of the watch only if it allows notifications for Script Editor.` |
| First good round | stdout | The output of `formatGroups`, then the status line, then, when a ticket is ready, `\n\u0007` and `startAllQuestion(n)`. After the answer, the lines of `cstack wave`: `\nStarted nothing.\n`, or `\n` and one start line per ticket. |
| Every good round | stdout | `HH:MM  R ready, B blocked, S already started, F finished.` |
| A ticket just became ready | stdout | `\n\u0007Start <key> now? [y/N] `. Any answer other than yes prints `\nNot started. The watch will not ask about <key> again.\n`. |
| The notification failed, the first time only | stderr | `cstack: the macOS notification failed, so the watch asks in this terminal only.` |
| A start failed because of an error | stdout | `<key>  failed, <message>.` |
| Control-C during a start | stdout | `<key>  the outcome is unknown, because Control-C also stopped the program that was starting it. Check <key> by hand.` |
| Control-C during a start, before anything was created | stdout | `<key>  not started, because you stopped the watch.` |
| The fetch before a start failed | stdout | `<key>  failed, \`git fetch origin\` failed.` |
| A line typed while no question waits | stdout | `Ignored a line typed while no question was waiting.` |
| A failed round | stderr | `cstack: HH:MM  the read failed (<n> of 3 in a row): <message>` |
| The third failure in a row | stderr | `cstack: the watch stopped, because 3 reads in a row failed.` |
| The watch ends on its own | stdout | `No ticket is blocked anymore and every ready ticket was offered, so the watch ended.` |
| Control-C | stdout | `\nStopped the watch.` |
| Standard input ended | stdout | `\nStandard input closed, so the watch stopped.` |
| No terminal | stderr | `cstack: the watch asks its questions in a terminal, so run it in an interactive terminal.` |
| No tracker client | stderr | `cstack: the watch needs a tracker client: Orca connected to the tracker, or gh or glab logged in. Run cstack wave again by hand. Claude can read the tracker with its own connection and write a file for --from-file <path>.` |
| `--watch` with `--from-file` | stderr | `cstack: --watch cannot use --from-file, because a file never changes.` then the usage line. |

Every key and every message from a tracker or from Orca goes through `printableText` before it is printed. Titles appear only through `formatGroups`.

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

### Unit 1: Share the start of one ticket between cstack wave and the watch
- Files: `cstack/src/wave/start.ts`, `cstack/src/wave/confirm.ts`, `cstack/src/commands/wave.ts`, `cstack/test/wave/start.test.ts`
- Test: `cstack/test/wave/start.test.ts`: with a fake reader whose ticket `ABC-12` is now blocked by `ABC-1` (to do), `startTicket("ABC-12", context)` returns `{ kind: "skipped", line: "ABC-12  skipped, it is no longer ready (blocked by ABC-1 (to do)).\n" }` and never calls the starter. With a ready ticket and a stop signal that is already aborted, the call rejects with an `AbortError` and never calls the starter. With a ready ticket and a runner where `git show-ref` fails, the starter receives `("ABC-12", "abc-12", <url>)`.
- Minimum code: export from `start.ts` the type `Starter`, the interface `StartContext` (`reader`, `check`, `start`, `run`, `root`, `tracker`, optional `signal`), the interface `StartReport` (`kind`, and `line` ending with a line break), and `startTicket(key, context)`. Move the body of the loop of `cstack/src/commands/wave.ts` (lines 130 to 162) into it, with the same strings. Add `context.signal?.throwIfAborted()` right before the call to `start`. In `wave.ts`, loop over `startTicket`, print each line, and count a failure for the kinds `failed` and `unknown`. In `confirm.ts`, export `startAllQuestion(n)`, which returns `Start the N ready tickets? [y/N] ` with the singular for one ticket, and use it in `wave.ts`.
- Refactor: none.
- Commit message: refactor(cli): move the start of one ticket of a wave into a shared function
- Depends on: none

This unit must not change any line that `cstack wave` prints. `cstack unit green` runs only `start.test.ts`, so run `cd cstack && npx vitest run test/wave/` yourself before the commit. `confirm.test.ts`, `start-git.test.ts`, `start-orca.test.ts` and `groups.test.ts` must pass without any edit.

### Unit 2: One reader of standard input for the whole watch
- Files: `cstack/src/wave/answers.ts`, `cstack/test/wave/answers.test.ts`
- Test: `cstack/test/wave/answers.test.ts`: on a `PassThrough` stream, the line `y` written before `next()` calls `ignored` once, and a later `next()` does not receive it. A line written after `next()` resolves it. Aborting the signal resolves `undefined`. Ending the stream calls `ended`, and every later `next()` resolves `undefined`. After `close()`, the stream has no `data` or `end` listener left.
- Minimum code: export the interface `Answers` (`next(signal)` and `close()`) and `openAnswers(input, { ignored, ended })`. It creates one `readline` interface on `input` without an output stream, so the terminal is never put in raw mode and Control-C still reaches the process as `SIGINT`. A line that arrives while no `next()` waits calls `ignored` and is dropped. When the input closes, a waiting `next()` resolves `undefined` and `ended` is called. `close()` closes the reader.
- Refactor: none.
- Commit message: feat(cli): read standard input with one reader for the whole watch and drop the lines typed outside a question
- Depends on: none

The caller must call `next()` before it prints the question, in the same synchronous step, because the `line` event can fire inside a `write` call.

### Unit 3: Send the macOS notification with fixed script lines
- Files: `cstack/src/wave/notify.ts`, `cstack/test/wave/notify.test.ts`
- Test: `cstack/test/wave/notify.test.ts`: `notifyReady(run, "#31")` calls the recorded runner once with the command `/usr/bin/osascript` and exactly the arguments `["-e", "on run argv", "-e", "display notification (item 1 of argv) with title \"cstack\"", "-e", "end run", "Ticket #31 is ready. Answer in the cstack terminal."]`, and returns `true` for an `ok` answer. It returns `false` for `missing`, `failed` and `timeout`.
- Minimum code: export `notifyReady(run, key): Promise<boolean>`. Start the file with a `WHY:` comment that says the script lines are fixed, and that the text reaches AppleScript only as an argument that `on run argv` reads.
- Refactor: none.
- Commit message: feat(cli): send a macOS notification with fixed script lines and the ticket key as an argument
- Depends on: none

### Unit 4: Refuse a watch that cannot run, before any tracker read
- Files: `cstack/src/commands/wave.ts`, `cstack/src/wave/watch.ts`, `cstack/test/helpers/watch.ts`, `cstack/test/wave/watch-no-client.test.ts`
- Test: `cstack/test/wave/watch-no-client.test.ts`: with the real `openTracker`, `--tracker jira` and a runner where `orca`, `gh` and `glab` are missing, `wave(["--milestone", "M3", "--tracker", "jira", "--watch"], io, deps, watch)` exits with `4`. Standard error names `cstack wave` and `--from-file`. No group is read, no `SIGINT` listener is added, and the input stream has no listener.
- Minimum code: add `watch: { type: "boolean" }` to the options of `parseArgs`. Refuse `--watch` together with `--from-file` with exit code `2`, after the existing flag checks. Add the fourth parameter `watch: WatchDeps = defaultWatchDeps()` to `wave()`. After the tracker options are built, hand over with `if (values.watch) return await watchWave(...)`. In `watch.ts`, export `WatchDeps` (`now()`, `sleep(ms, signal)`, `onInterrupt(listener)` that returns its remover, `input()`), `defaultWatchDeps()` and `watchWave`. `watchWave` reads the settings (exit `3` on a `SettingsError`), then checks the terminal (exit `1`), then opens the tracker for `list` and for `read` and turns a `NoClientError` into the message of the watch (exit `4`). For now it returns `0` after these checks. In `cstack/test/helpers/watch.ts`, start `watchSetup(options)`, which builds the clone, the recorded runner, the fake tracker, the fake clock, the fake Control-C hook and a `PassThrough` input.
- Refactor: none.
- Commit message: feat(cli): refuse cstack wave --watch without a tracker client, a terminal or a valid settings file
- Depends on: 1

The same test file also checks these cases. Linear behaves like Jira. GitHub, with an `https://github.com/...` origin and no `gh`, exits with `4`. `--watch --from-file <file>` exits with `2`, says that a file never changes, and runs no program after the flag checks. No terminal exits with `1` and its message, before `openTracker` is called. A bad settings file together with no terminal exits with `3`, which proves that the settings come first.

### Unit 5: Read the wave again at the interval of the settings file
- Files: `cstack/src/wave/watch.ts`, `cstack/test/helpers/watch.ts`, `cstack/test/wave/watch-interval.test.ts`
- Test: `cstack/test/wave/watch-interval.test.ts`: with one ticket that stays blocked and a settings file `{"version": 1, "watchIntervalMinutes": 2}`, the fake tracker is read at minutes 0, 2 and 4. Control-C at the third read prints `Stopped the watch.` and the exit code is `0`.
- Minimum code: the two `AbortController`s and their joined signal, the `SIGINT` listener and the reader of unit 2, set up and released in a `try`/`finally`. The start lines. The loop with its fixed schedule: each round notes its start time, and the sleep lasts until that time plus the interval, or not at all when that time has passed. The read of a round: `listGroup`, a fresh `loadWorktreeCheck`, and `groupTickets`. The groups printed in the first good round, and the status line in every good round. The end on Control-C and on the end of standard input. The end on its own when no ticket is ready or blocked.
- Refactor: none.
- Commit message: feat(cli): read the wave again every watchIntervalMinutes minutes with cstack wave --watch
- Depends on: 2, 4

The same test file also checks these cases. Without the key, the reads happen at minutes 0, 5 and 10. A read that moves the clock by 3 minutes, with an interval of 2, gives reads at 0, 3 and 5. Each good round prints one line that matches `^\d\d:\d\d  0 ready, 1 blocked, 0 already started, 0 finished\.$`. After the watch returns, no `SIGINT` listener is left and the input has no listener. When the input ends during a sleep, the watch prints `Standard input closed` and exits with `0`. A group with nothing ready and nothing blocked ends the watch with exit code `0`. `defaultWatchDeps().sleep(60_000, signal)` resolves soon after the signal aborts and does not reject. `defaultWatchDeps().onInterrupt(listener)` adds exactly one `SIGINT` listener, and the returned function removes it. That test never sends a real signal.

### Unit 6: Go on after a failed read, and stop after three in a row
- Files: `cstack/src/wave/watch.ts`, `cstack/test/wave/watch-errors.test.ts`
- Test: `cstack/test/wave/watch-errors.test.ts`: reads 2, 3 and 4 throw `new TrackerError("the tracker did not answer", 5)`. The watch prints three failure lines and the line that it stopped, exits with `5`, and never reads a fifth time.
- Minimum code: count the failed rounds in a row, print each failure, set the count back to zero after a good round, and return the exit code of the last error at the third. A `WaveError` or a `TrackerError` counts as a failed round. Any other error is thrown again after the `finally`. A failure that happens after Control-C is not counted.
- Refactor: none.
- Commit message: feat(cli): go on after a failed read of the wave and stop after three in a row
- Depends on: 5

The same test file also checks these cases. One failure, then a good read, then two failures keep the watch going. When the first read fails and the second succeeds, the second read prints the groups. When Control-C arrives during a read that then fails, the watch prints `Stopped the watch.`, no failure line, and exits with `0`. An Orca error from `reference find` also counts as a failed round.

### Unit 7: Offer each ticket that becomes ready
- Files: `cstack/src/wave/watch.ts`, `cstack/test/helpers/watch.ts`, `cstack/test/wave/watch-ready.test.ts`
- Test: `cstack/test/wave/watch-ready.test.ts`: `ABC-13` is blocked by `ABC-1`, and `ABC-14` is blocked by `ABC-2`. At read 2, `ABC-1` moves to done. The watch records exactly one call to `/usr/bin/osascript` with the arguments of unit 3, and asks `\u0007Start ABC-13 now? [y/N] ` once. The test answers `n`. At read 3, `ABC-13` is not asked about again, and `ABC-2` moves to done. `ABC-14` is offered and declined, and the watch then ends on its own with exit code `0`.
- Minimum code: the line about Script Editor at the start. The question of the first round, after the bell, where any answer other than yes declines every ticket of that round. The values `lastReady`, `declined` and `offered`. The offer of each ticket that just became ready, in the order of the group: the notification, then the question. The "notification failed" line, printed once. The end on its own when no ticket is blocked and every ready ticket was offered. A yes is not handled yet in this unit.
- Refactor: none.
- Commit message: feat(cli): notify and ask about each ticket of the wave that becomes ready
- Depends on: 3, 6

The same test file also checks these cases. When the blocker moves to an in-review state instead, no notification is sent and no question is asked. A ticket whose title holds `"` and `& do shell script "rm -rf ~"` never puts `do shell script` or `rm -rf` in any argument of any call, nor in a question. When `osascript` answers `missing`, the failure line appears once for two notifications, and both questions are still asked. When two tickets become ready in the same round, the order is the notification and the question of the first ticket of the group, then those of the second. A first round with two ready tickets asks `Start the 2 ready tickets? [y/N] ` once, after the bell, and sends no notification. After `n`, neither ticket is asked about again. When the question of the first round takes 7 minutes and the interval is 5, the next read happens at minute 7.

### Unit 8: Start a ticket after a yes, with a fresh fetch
- Files: `cstack/src/wave/start-git.ts`, `cstack/src/wave/watch.ts`, `cstack/test/helpers/watch.ts`, `cstack/test/wave/watch-start.test.ts`
- Test: `cstack/test/wave/watch-start.test.ts`: in the git way, the test pushes a new commit to the local origin after read 1. At read 2, the blocker is done and the answer is `y`. The last commit of the new worktree is the pushed commit, and the output holds `cd '<folder>' && claude '/resolve-issue ABC-13'`.
- Minimum code: export `fetchOrigin(run, root)` from `start-git.ts`, made from its lines 17 and 18 with the same message, and call it in `prepareGitStart`. In the watch, each start runs exactly one `git fetch origin`. In the git way, that fetch is the one inside `prepareGitStart`, which also reads `origin/HEAD`. In the Orca way, the watch calls `fetchOrigin` before `startInOrca`. When that fetch fails, the watch prints its own line `<key>  failed, \`git fetch origin\` failed.` and goes on; it does not print the message of `cstack wave`, which says that cstack started nothing. Then the start loads a fresh worktree check, calls `startTicket` with the stop signal, and prints the returned line. When `startTicket` rejects with an `AbortError`, because Control-C came before anything was created, the watch prints `<key>  not started, because you stopped the watch.`, and that ticket does not count for the exit code `5`. A `WaveError` or `TrackerError` during a start becomes the "failed" line, and the watch goes on. When Control-C arrived during the start and the ticket was neither started nor skipped, the line becomes the "outcome unknown" line. Any failed, unknown or cut start makes the final exit code `5`. After a yes in the first round, the tickets start one by one, and the watch checks the stop signal between two starts.
- Refactor: none.
- Commit message: feat(cli): start a ticket from the watch after a yes, with a fresh fetch of origin
- Depends on: 1, 7

The same test file also checks these cases. A yes in the first round for two tickets runs two `git fetch origin`. In the Orca way, `git fetch origin` is recorded before `orca worktree create`, and the create call has exactly the arguments of `cstack wave`. A failed fetch fails only that start, the watch reaches its next read, and the final exit code is `5`. Control-C during `git worktree add` prints the "outcome unknown" line and the exit code is `5`. The second ticket of a first-round yes is then not started. Control-C during `git show-ref` prints the "not started" line, creates no worktree and no branch, and the exit code is `0`. In the git way, one start records exactly one `git fetch origin`.

### Unit 9: Never start a ticket from the watch without a yes
- Files: `cstack/src/wave/watch.ts`, `cstack/test/wave/watch-confirm.test.ts`
- Test: `cstack/test/wave/watch-confirm.test.ts`: in the round where `ABC-13` becomes ready, the test types `y` before the question appears. The output holds `Ignored a line typed while no question was waiting.`, the question still waits, the scripted answer is `n`, and the recorded calls hold no `git worktree add` and no `orca worktree create`.
- Minimum code: print the "Ignored" line from the `ignored` callback of the reader.
- Refactor: none.
- Commit message: feat(cli): never start a ticket from the watch without a yes typed after its question
- Depends on: 8

The same test file also checks these cases. The answers `n`, an empty line and `maybe` start nothing, in the first round and in a later round, in the git way and in the Orca way, and no worktree folder appears. Control-C during a question prints `Stopped the watch.`, starts nothing, and exits with `0`. The end of standard input during a question prints `Standard input closed` and starts nothing.

Escalated: the first attempt was stuck because the test of this unit already passed. Units 2 and 7 had already put the `ignored` callback in place, so the unit adds no production code. The second attempt, `implementer-escalation`, kept the test file as written. It got an honest red run by turning the `ignored` callback off for a moment, then restored `watch.ts` and committed only the test file.

### Unit 10: Make --watch a built flag of cstack wave
- Files: `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts`, `README.md`
- Test: `cstack/test/manifest.test.ts`: `unbuiltRefusal(["wave", "--watch"])` is `undefined`, both with the real list and with every command built.
- Minimum code: delete `notBuiltFlags: { "--watch": 30 }` from the entry of `cstack wave`. In `cstack/test/cli.test.ts`, delete the case `[["wave", "--watch"], "#30"]`. In `README.md`, after the bullet of `cstack wave`, add a few short sentences. They say that `--watch` keeps the command running in a terminal, reads the wave again every `watchIntervalMinutes` minutes (five by default), sends a macOS notification and asks before it starts a ticket that became ready, and stops with Control-C.
- Refactor: none.
- Commit message: feat(cli): make cstack wave --watch a built flag
- Depends on: 9

The counts stay at 22 built commands and 1 not built. Change only the lines that name `--watch` or #30, because ticket #28 changes its own lines next to them. If #28 has already merged on the branch and its case is gone, follow the decision about the made-up commands. `cstack unit green` runs only `manifest.test.ts`, so run `cd cstack && npx vitest run test/cli.test.ts test/manifest-implemented.test.ts test/readme-requirements.test.ts` yourself before the commit. After this unit, build with `npm run build` in `cstack/` and run `node cstack/dist/bin.js wave --milestone M3 --from-file <file> --watch` once in a temporary clone, and check that it refuses with exit code `2`. Never run the watch for real against a tracker, and never run `osascript`.

## Documentation duties

- README: applies, written to `README.md`, a few sentences about `--watch` after the bullet of `cstack wave` (unit 10).
- Specification page: does not apply. US-15 is built as written in `docs/projects/skills-into-cli.md`, and the answers of this run are details of the command.
- Decision record: does not apply. No new architectural decision; the rules live in this plan and in the ticket comments.
- Ticket comments: applies, in phase 10. On #30, the outcome. On #31, how the watch ends, the fetch before each start, the lines typed outside a question, the Script Editor hint, and the question for the Orca maintainers about the base branch, word for word.
- Epic #6: does not apply.
- Conventions file: does not apply.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: when the watch ends
The ticket says the watch ends when no ticket of the group is ready or blocked anymore. A ticket that you declined stays ready, so the watch would never end on its own after a single "no". Should the watch end when no ticket is blocked and no ready ticket is still waiting to be offered?
- For: the user
- Answer: yes. The user accepted the recommendation in the conversation ("ok super"), on 2026-11-19.

### Question 2: lines typed before a question
While the watch waits between two rounds, a line that you type in the terminal stays in the input buffer. The next question would read it at once as its answer, so a stray `y` could start a ticket you never saw offered. Should cstack throw away every line typed while no question is waiting, and count only a line typed after the question appears?
- For: the user
- Answer: yes. The user accepted the recommendation in the conversation ("ok super"), on 2026-11-19.

## Review log

### Impact notes (phase review)

The branch adds `start.ts`, `answers.ts`, `notify.ts` and `watch.ts` in `cstack/src/wave/`, and changes `wave.ts`, `confirm.ts`, `start-git.ts` and `manifest.ts`. The changed or new symbols are `startTicket`, `startAllQuestion`, `fetchOrigin`, `watchWave`, `openAnswers`, `notifyReady` and the removed `notBuiltFlags` of the wave entry. Their callers and tests are in `cstack/src/commands/wave.ts`, `cstack/test/wave/`, `cstack/test/manifest.test.ts` and `cstack/test/cli.test.ts`. The tests of `cstack wave` (`confirm`, `start-git`, `start-orca`, `groups`) passed without any edit. The files that usually change with `wave.ts` are the wave tests and `README.md`; `README.md` is in the diff. The usual companions of `manifest.ts` are `cli.ts`, `cli.test.ts` and `manifest.test.ts`; `cli.ts` needs no change, because `wave()` takes the watch dependencies as a fourth parameter with a default. The only `WHY:` comment in the area is in `start-git.ts` (`--no-track`), and the branch does not touch it. The `WHY:` comment of `notify.ts` is new.


### Findings of the four reviewers (phase review)

Correctness: no critical bug. Three findings, all fixed. The lines of a failed read did not use the words of the architecture table, so they now read `cstack: HH:MM  the read failed (n of 3 in a row): <message>` and `cstack: the watch stopped, because 3 reads in a row failed.`, and the test checks "(2 of 3 in a row)". The first round printed nothing after the answer, so it now prints `Started nothing.` after a no and a line break before the starts after a yes. A "failed" line could end with two periods, so one trailing period is removed first.

Security: nothing at confidence 80 or above. One risk below that: a half-typed `y` without Enter stays in the terminal and could answer a later question when the user presses Enter. Fixing it needs raw mode, which the plan rejected on purpose. Recorded as a follow-up.

Conventions: the doc comment of `watchWave` was stale, now fixed. Two follow-ups: the start code finds the fetch failure by comparing the message with `FETCH_FAILED`, which a dedicated error class would make safer; and the two commits of unit 8 have the same subject, which is kept because the history is not rewritten.

Simplicity: the repeated delay computation and the hand-built `HH:MM` are now one local function each, and the stale comment and the one-use `notStarted` helper are gone. Not applied: the rewrite of the `toOffer` block and `toTimeString`, which save little.

Wording slip, not fixed: when standard input ends during a start that then fails, the unknown-outcome line still blames Control-C.

Tests: `npm run typecheck` is clean and `npm test` passed, 97 files and 1166 tests.

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

- Unit 9 was stuck: its test already passed because units 2 and 7 had put the `ignored` callback in place, so `cstack unit red 9` refused. The escalation got a red run by turning the callback off for a moment.
- Units 7 and 10 wrote production code before `cstack unit red`, so `cstack unit green` warned that the test changed after the red run. Unit 7 also fixed a bug of its own (`t.key` instead of `t.ticket.key`) after the red run.
- Unit 8 first skipped three tests the plan lists and used its own wording for the "outcome unknown" line. I sent it back, and the follow-up commit `ae65657` fixed both.
- Unit 6 used `git stash` briefly, although the stash stack is shared with other worktrees. It dropped only its own entry.
- The plan says the failure lines of a failed round go to standard error, and unit 6 did that, but the unit text itself did not say which stream. Unit 10 left the counts of built commands untouched, because #28 is not merged on this branch yet; the rebase in the update-branch phase has to apply the coordinator's decision line.

## Hand-off log

2026-11-19, executor run 1: moved ticket #30 to in progress by adding the label `in progress`. The branch `gambitl/wave-watch` already existed and was checked out. Started the build phase.

2026-11-19, executor run 1, build phase finished: units 1 to 10 are committed (unit 9 after one escalation, unit 8 after one follow-up commit). The full suite and the typecheck passed on unit 9. The branch is not yet rebased on main.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**When does the watch end on its own?** The ticket says it ends when no ticket is ready or blocked anymore. A ticket you declined stays ready, so a single "no" would keep the watch running until Control-C. I recommend ending it when no ticket is blocked and every ready ticket was already offered, because nothing else can happen after that.

**Should cstack throw away the lines you type while no question is waiting?** I checked it: with the reader that `cstack wave` uses today, a `y` typed between two rounds answered the next question after 0 ms. So a stray key could start a ticket you never saw offered. I recommend one reader for the whole watch, which drops any line that arrives outside a question and says so in one line.

**I will do this unless you say no**

- Before each start, I fetch origin again, in the git way and in the Orca way. `cstack wave` fetches only once. A watch runs for hours, so the new branch would start from an old copy of the default branch. That copy lacks the blocker's merge, which is the very reason the ticket became ready. A failed fetch fails that one start, not the whole watch.
- If you press Control-C while a ticket starts, I report that ticket as "outcome unknown, check it" and exit with 5 instead of 0. The Control-C also stops git or Orca, and the runner would call that a plain failure, although Orca may already have made the worktree.
- When standard input ends, with Control-D or a closed terminal, the watch stops and says why. Otherwise every later question would read an empty answer and quietly decline every ticket.
- Each question also rings the terminal bell, and the watch prints once at the start that macOS must allow notifications for Script Editor. As far as I know, `osascript` reports success even when notifications are blocked, so the "notification failed" line will rarely show.

**I checked it myself**

A program that cstack starts receives your Control-C too. In a test with Node 26, the child stopped after 0.3 seconds, while the parent, which had a listener, kept running.

**Questions for other people that can wait**

For the Orca maintainers: "When `orca worktree create` gets no `--base-branch`, does it fetch the remote first, and does it branch from the remote default branch or from the local one?"

**Good to know**

- Three failed rounds in a row stop the watch. At a one-minute interval, that is three minutes without network, for example after the Mac wakes up on another Wi-Fi.

#### Details

When the watch ends. Blocking, and only the user can answer it, because it changes item 10 of the ticket's scope. The ready rule in `cstack/src/tracker/ready.ts` (lines 11 to 19) keeps a declined ticket in the "ready" group, since nothing about it changes on the tracker. With the ticket's wording, the end test "no ticket is ready or blocked" is never true after a decline, so the watch waits for Control-C even though it can never offer anything again. I keep the drafted recommendation: the watch ends when the blocked group is empty and every ready ticket was already offered, whatever the answer. A ticket whose start was skipped or failed also counts as offered, so it cannot keep the watch alive either. A blocked ticket whose reason is "unknown state" or "blockers unknown" keeps the watch running, which is right, because a later read may settle it. If nobody decides, the plan follows the ticket's text and the watch only ends with Control-C after any decline.

Lines typed before a question. Blocking, and only the user can answer it, because it protects the negative criterion of US-15 ("never starts a ticket before the user says yes"). I checked the drafted evidence and rely on it. `readAnswer` in `cstack/src/wave/confirm.ts` (lines 10 to 19) creates a reader, reads one line and closes it, which pauses standard input. The kernel then keeps every line typed later, and the next reader receives it at once. The drafted test in a pseudo-terminal showed a `y` typed 2.5 seconds before the question answered it after 0 ms. I keep the drafted fix: one reader for the life of the watch, which drops and reports any line that arrives while no question waits. I rejected flushing the terminal buffer just before each question, because Node has no `tcflush`, and a native module is too much for this. The one reader keeps the event loop alive, so it must be closed on every exit path, which the decisions already say. If nobody decides, the watch reuses `readAnswer` and a stray `y` can start a ticket.

Fetch before each start. This is my own point, non-blocking, and I will apply it unless the user objects. `prepareGitStart` in `cstack/src/wave/start-git.ts` (lines 16 to 27) runs `git fetch origin` and reads `refs/remotes/origin/HEAD` once, and the #29 plan made that choice on purpose for one pass (its decision "In the git way, `git fetch origin` runs once"). For `cstack wave`, the fetch happens seconds before the starts, so it is fresh. In the watch, a ticket becomes ready precisely because a blocker has just merged, often hours after the watch began. If the shared start function prepared the git start once at the beginning, `git worktree add ... origin/<default>` would branch from a stale ref that lacks that merge. So the watch calls `prepareGitStart` again for each round that has a yes. `prepareGitStart` throws a `WaveError` when the fetch fails, and the watch must turn that into a failed start for that ticket, to respect the decision "a start that fails does not stop the watch". In the Orca way, `startInOrca` (`cstack/src/wave/start-orca.ts`, lines 14 to 19) passes no `--base-branch`, and the #29 plan quotes Orca's help: "When `--base-branch` is left out, Orca starts from the default base of the repository". Whether Orca fetches first is not recorded anywhere in this repository, and I may not run Orca. Running `git fetch origin` before `orca worktree create` is cheap and helps if Orca branches from the remote ref. I rejected adding `--base-branch` to the Orca call, because that call is shared with `cstack wave` and checked argument by argument in `cstack/test/wave/start-orca.test.ts`, and a user may have set a different base in Orca on purpose. The question to the Orca maintainers below would settle it. If nobody decides, I apply the fetch.

Control-C during a start. My own point, non-blocking. `createRunner` in `cstack/src/orca/run.ts` (lines 23 to 55) uses `execFile` with no `detached` option, so every child shares the foreground process group of the terminal, and Control-C reaches it. I checked it: a Node 26.10.0 script with a `SIGINT` listener started `sleep 3` through `execFile`, then sent `SIGINT` to its own process group, as the terminal does. The child ended after 305 ms with the signal `SIGINT`, and the parent kept running. The script is in the scratch folder of the session, under `sigint/child-group.mjs`, and it ran with `perl -e 'setpgrp(0,0); exec @ARGV' node child-group.mjs`. The runner maps a child killed by a signal it did not send to `{ kind: "failed", exitCode: 1 }`, because `e.killed` is false and `e.code` is not a number. `startInOrca` then returns "failed", although the Orca app may already have created the worktree. A `git worktree add` cut in the middle can also leave a branch or a folder behind. In `cstack wave` this never shows, because cstack has no listener and dies with its child. The watch has a listener, so it would print a false "failed". So when a `SIGINT` arrived while a start ran, the watch reports that ticket's outcome as unknown, tells the user to check it, and exits with `5`. This narrows the decision "Control-C exits with 0" to the case where no start was cut. I rejected starting children in their own process group, because the runner is shared by every command, and a detached `orca worktree create` would keep running after the user asked to stop. If nobody decides, the watch prints a misleading "failed" line.

End of standard input. My own point, non-blocking. With one reader for the whole watch, the end of input closes the reader for good. `readAnswer` today turns a closed input into an empty answer, which means "no". If the watch kept that behaviour, it would decline every later ticket in silence and could never offer anything again. So the end of input stops the watch, with one line that says standard input closed, and exit code `0` unless a start failed. If nobody decides, the watch runs on and declines everything.

Notifications. My own point, non-blocking, and partly unverified. I could not run `osascript`, because the brief forbids it. From what I know of macOS, `display notification` run through `osascript` shows under the name Script Editor, and when notifications are blocked for it, `osascript` still exits with `0`. If that holds, scope item 9 ("when `osascript` fails, say so once") only fires on a machine without `osascript`, and a user with notifications off simply sees nothing. So the watch prints one line at its start saying that macOS must allow notifications for Script Editor, and it writes the terminal bell character before each question. Most terminals mark the tab or bounce the dock on a bell, which gives a second signal that needs no permission. The bell is a fixed character, so the CTO review rule that no ticket data reaches a script is untouched. A test can check the hint line and the bell in the recorded output. If nobody decides, the watch relies on a notification that may never show.

Question for the Orca maintainers. Non-blocking: the watch is complete and correct for its acceptance criteria whatever the answer, because it fetches before each start. The answer decides whether a later ticket should pass `--base-branch`. Word for word, in English for the tracker of this repository: "When `orca worktree create` gets no `--base-branch`, does it fetch the remote first, and does it branch from the remote default branch or from the local one?"

Three failed rounds. Good to know, no decision. Scope item 8 counts rounds, not time, and `watchIntervalMinutes` can be 1 (`cstack/src/settings.ts`). A short loss of network, such as after the Mac wakes up, can then stop the watch within three minutes. The watch says why, and the user runs it again. Timers also do not advance while a Mac sleeps, so the first round after a wake can come up to one interval late. I did not raise this to a decision, because the ticket fixes the rule of three rounds and the cost is one command to type again.

Locked decisions I respected and did not reopen: the CTO review of the ticket (no ticket data in a script string, the notification holds only the checked key and fixed words, starts go through the #29 checks), ADR-SIC-F (no credentials, a client per capability) and ADR-SIC-H (print through `io`, return the exit code). The drafted decisions in "Decisions" look right to me, and I only narrow the Control-C exit code as described above. I checked security and authorization, data model lock-in, scale and the load on the tracker, reversibility and hidden coupling, and found nothing more to raise. A round on GitHub costs one `gh issue list` plus one `gh issue view` per open blocker, which stays far below the rate limit even at one minute. The overlap with #28 in `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `cstack/test/cli.test.ts` is already in the code mapping.

#### Added after the plan was drafted

**I will do this unless you say no**

- If you press Control-C while the watch starts a ticket, but before it creates the worktree, I print "<key>  not started, because you stopped the watch." This case does not make the exit code 5. Today the plan checks the stop signal right before the creation, and that check throws an `AbortError`. Nothing in the plan catches it, so the watch would end with "cstack: This operation was aborted" and exit code 1. Only a Control-C during `git worktree add` or `orca worktree create` keeps "outcome unknown, check it by hand" and the exit code 5. I add a test where Control-C arrives during `git show-ref`.
- Each start in the watch runs `git fetch origin` exactly once. As unit 8 is written, the git way would fetch twice, because `prepareGitStart` also calls `fetchOrigin`. When that fetch fails, the watch prints its own short line. Reusing the message of `cstack wave` would print "so cstack started nothing.." with two periods, and that is false while the watch goes on.

**Good to know**

- The watch asks once, at its start, whether Orca can create worktrees, and keeps that answer for hours. If you quit Orca during the watch, every round fails and the watch stops after three rounds. If you open Orca only after the watch started, it starts tickets with git.

##### Details

Control-C before the creation of a worktree. This point is non-blocking, and I apply it unless the user objects. Unit 1 makes `startTicket` reject with an `AbortError` when the stop signal is aborted right before the start (plan, unit 1 test). Unit 6 throws again every error that is not a `WaveError` or a `TrackerError`, and unit 8 turns only those two into a "failed" line. An `AbortError` is a `DOMException`, so it escapes both. It then reaches `cstack/src/bin.ts` (lines 13 to 16), which prints "cstack: This operation was aborted" and sets exit code `1`, instead of "Stopped the watch." and no line for the ticket. The tests of units 8 and 9 put Control-C only during `git worktree add` and during a question, so no planned test reaches this check. The rule I propose is this. The watch wraps the starter that it passes in `StartContext`, so it knows whether the creation began. After Control-C, a ticket whose creation never began prints `<key>  not started, because you stopped the watch.` and does not count toward exit code `5`. This covers the `AbortError` of the check, and also a cut fetch, a cut re-read of the ticket and a cut `git show-ref`, because none of them can leave a worktree behind. A cut during `git worktree add` or `orca worktree create` keeps the "outcome unknown" line and exit code `5`, as the decisions say. This narrows "cut by Control-C" in the decision about the exit code to a cut during the creation. I rejected keeping "outcome unknown" for every cut: it is safe, but it sends the user to check a ticket where nothing can exist, and it gives exit code `5` for a clean stop. Catching the error inside `startTicket` and returning a new kind would also work. The executor may choose that way, because `cstack wave` passes no signal and does not change. The new case goes in `cstack/test/wave/watch-start.test.ts`: Control-C during `git show-ref` records no `git worktree add`, prints the "not started" line and "Stopped the watch.", exits with `0`, and leaves no `SIGINT` listener. If nobody decides, Control-C at that moment ends the watch with a confusing message and exit code `1`.

One fetch per start, and its message. This point is non-blocking, and I apply it unless the user objects. Unit 8 says to call `fetchOrigin` inside `prepareGitStart`, and then, in the watch, to run `fetchOrigin` and then `prepareGitStart` for the git way. That runs `git fetch origin` twice per start, while the unit's own test expects two fetches for two tickets. So the git way calls only `prepareGitStart`, which fetches, and the Orca way calls only `fetchOrigin`. The message today is "`git fetch origin` failed, so cstack started nothing." (`cstack/src/wave/start-git.ts`, line 18). The "failed" line of the architecture table adds a period after the message, which gives two periods, and "started nothing" is false in a watch that goes on. So the watch prints `<key>  failed, \`git fetch origin\` failed.` for a failed fetch, and `cstack wave` keeps its message unchanged. More generally, the "failed" line of the watch does not add a period when the message already ends with one, because the messages of `prepareGitStart` and of the Orca check also end with a period. No test of `cstack wave` checks the fetch message today. If nobody decides, the git way fetches twice and the failed line reads badly.

The answer about Orca is kept for the whole watch. This is good to know and needs no decision. The decision that the watch asks Orca once at its start whether "ticket-worktrees" exists means the watch keeps one boolean for hours. With that boolean true, `loadWorktreeCheck` runs `orca reference find` for each ticket in the "to do" state (`cstack/src/wave/worktrees.ts`, line 86) and throws a `WaveError` with exit code `5` when Orca fails. Unit 6 counts that as a failed round, so quitting Orca stops the watch after three rounds, with Orca's message and exit code `5`. With that boolean false, the watch starts every ticket with git, even after Orca opens. Those starts are still valid, and `git worktree list` still sees worktrees that Orca made. I rejected asking Orca again at each round: it costs one more call per round, and a start mode that changes in the middle of a watch is harder to understand.

I created no ADR, because none of these points is a trade-off between credible options. The choice between a fourth parameter of `wave()` and extending `WaveDeps` is local and already recorded under "Architecture options". I checked that reusing one tracker object across rounds sees fresh states: `githubGhTracker` caches only the origin repository (`cstack/src/tracker/github-gh.ts`, lines 24 to 30), and the Jira and Linear adapters build new maps on each call. I also checked, with Node 26.10.0, that `setTimeout` of `node:timers/promises` leaves no `abort` listener on the joined signal after twenty normal sleeps, and that it rejects with an `AbortError` when the signal aborts. Unit 5 already requires the sleep of `defaultWatchDeps()` to resolve instead, so the plan covers it. Node 26 prints no warning when many listeners are added to an `AbortSignal`, so a forgotten listener would grow quietly, but at one question per offer that stays tiny. In what the plan added, I checked security, the data model, scale, failure modes, user-facing cases, operations, reversibility and hidden coupling, and found nothing more to raise.

### Open questions and answers

Blocking question 1, about when the watch ends. Recommended answer: yes. The user answered yes on 2026-11-19. The watch ends when no ticket is blocked and every ready ticket was already offered, whatever the answer was. A ticket that you declined cannot be offered again during this watch, so nothing more can happen except Control-C.

Blocking question 2, about lines typed before a question. Recommended answer: yes. The user answered yes on 2026-11-19. The watch keeps one reader on standard input for its whole life. A line that arrives while no question waits is thrown away, and cstack prints one short line that says it ignored it. Only a line that arrives after a question is printed answers that question. This protects the rule "never start a ticket before the user says yes".

I checked the problem itself on 2026-11-19 in a real pseudo-terminal. A copy of `readAnswer` from `cstack/src/wave/confirm.ts` read a first answer, then waited 2.5 seconds while the line `y` was typed. The next question printed "Start #31 now? [y/N]" and received the answer `"y"` after 0 ms. The command was `(printf 'n\n'; sleep 1; printf 'y\n'; sleep 4) | script -q /dev/null node typeahead.mjs`, with the script kept in the scratch folder of the session. So the problem is real with the reader of `cstack wave` today. Only the choice of the fix is left to the user.

The four points that the advisor listed as "I will do this unless you say no" were accepted by default on 2026-11-19, because the user's reply ("ok super") did not object to any of them. They are the fetch before each start, the unknown outcome after Control-C during a start, the stop at the end of standard input, and the terminal bell with the hint about Script Editor. Each one is a line under "Decisions".

Non-blocking question for the Orca maintainers, open, not needed for this ticket. The user saw it word for word on 2026-11-19, and it can wait: "When `orca worktree create` gets no `--base-branch`, does it fetch the remote first, and does it branch from the remote default branch or from the local one?" The watch is correct whatever the answer, because it fetches before each start. The answer only decides whether a later ticket should pass `--base-branch`.

### Architecture options

Two architecture blueprints were made on 2026-11-19, one with the brief "the smallest change with the most reuse" and one with the brief "the cleanest structure". Both agree on the main shape: the start loop of `cstack/src/commands/wave.ts` moves into a shared function without changing a printed line, the watch is a new file `cstack/src/wave/watch.ts`, the fetch is taken out of `prepareGitStart` as `fetchOrigin`, stopping uses `AbortController` and `setTimeout` of `node:timers/promises`, and the manifest change is one deleted line. Both also found the case of `cstack/test/cli.test.ts` (line 191) that the code mapping missed.

The smallest-change blueprint keeps everything for the watch inside `watch.ts`: the reader of standard input, the notification and a wrapper around the start function. It moves the whole start loop into `startTickets(ready, context, io, prepare)`, where `prepare` is a callback that each caller gives. The watch's dependencies come in a fourth parameter of `wave()` with a default value, so `cstack/src/cli.ts` and the four existing wave test files do not change. It offers a ticket when it is ready now and was never offered, which differs from the written decision in one rare case: a started ticket whose worktree was later removed is never offered again. It has nine units.

The cleanest-structure blueprint gives each rule its own small file: `answers.ts` for the one reader, `notify.ts` for the fixed `osascript` lines, and `start.ts` with `startTicket(key, context)` for one ticket, with a check of the stop signal right before the start. It adds `startAllQuestion(n)` to `confirm.ts`, so both modes ask with the same words. It makes `WaveDeps` extend a new `WatchDeps`, which adds one spread line to each of the four existing wave test files. It follows the written decision for "just became ready", with the keys of the last good round and the declined keys. It has ten units.

Recommended, and written under "Architecture": the cleanest structure, with one change taken from the smallest-change blueprint. The watch's dependencies come as a fourth parameter of `wave()` with a default value, instead of extending `WaveDeps`. The small files make each security rule easy to find and to test on its own, and the per-ticket `startTicket` with its stop check closes the case where a cut `git show-ref` looks like "no branch". The fourth parameter keeps the four existing wave test files byte for byte, which is the best proof that `cstack wave` did not change. The smallest-change blueprint would be the better choice if the reviewer wants fewer files. Extending `WaveDeps` would be the better choice if `cstack wave` itself needed the clock later.

