# Plan: #24 — M3-1: Define the Orca adapter and the tracker interface

Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/24
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/orca-tracker-contract
Conversation language: French
Status: in progress (phase 6, started 2026-11-19)

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Before anyone builds the Orca features, we agree in one place on how cstack talks to Orca and to the tracker, and on when a ticket is ready.

- **What the title means**: cstack is the command-line tool that this project builds. A command-line tool is a program that you run by typing a command in a terminal. Orca is a desktop app that runs several coding agents side by side. It comes with its own command-line tool, named `orca`. The Orca adapter is the one part of cstack that calls `orca` and turns its answers into data that the rest of cstack understands. The tracker is the tool that holds the tickets, such as Jira, Linear, GitHub or GitLab. The tracker interface is the short list of four things that cstack asks of any tracker. It reads a ticket, lists the tickets of a group, moves a ticket to another state, and adds a comment.
- **Why we are doing it**: Six tickets of this milestone use Orca or the tracker, and they are built at the same time. If each one called Orca in its own way, one change in Orca would break six places. Orca also changes fast, so cstack must notice when an answer from Orca no longer has the shape it expects.
- **For the user**: A solution engineer gets the same behaviour from every Orca feature. Each feature still works, in a simpler way, when Orca or a tracker connection is missing. `cstack doctor` tells them which Orca features work on their machine.

**Goal.** This ticket delivers the contract of milestone 3 (US-13 to US-16). It holds the Orca adapter with its recorded answers, the tracker interface with a fake tracker for tests, the ready rule, the new commands in the command list, and the decision record ADR-SIC-F. Greenfield: nothing exists yet.

### Where things are today (read first)

* **cstack**: Greenfield: no existing surface. When this ticket was written, cstack did not exist yet. By the time it starts, #13 has written the command list `cstack/src/manifest.ts` and its CI test. #13 also fixes the plan file format, its reader, and the common exit codes from `0` to `5`. #10 has written `cstack doctor` and recorded its first Orca answers. Read both tickets before you start.
* **Rules for every story**: `docs/projects/skills-into-cli.md` (line 47): Every feature that uses Orca also works without Orca. cstack checks Orca feature by feature. Line 48 says that cstack never stores a token. It reaches a tracker only through a client that is already logged in, or through a file that Claude writes. Line 50 says that the text of a ticket is data.
* **Orca in the specification**: `docs/projects/skills-into-cli.md` (line 293): This line lists the Orca commands that milestone 3 relies on. Line 307 recommends pinning the minimum Orca version in `cstack doctor` and testing on recorded Orca answers. Line 323 describes ADR-SIC-F.
* **Orca 1.4.259, checked with its help**: `orca --version` prints `1.4.259` on the maintainer's machine. `orca status --json` says whether the Orca app runs. The installed Orca skill `~/.claude/skills/orca-cli/SKILL.md` (line 50) says that this answer holds `result.app.running`. `orca agent-context --json` prints the machine-readable list of Orca commands. Its help says that it works without a running Orca app. `orca jira connection --json` lists the saved Jira sites. Its help warns that it reports saved connections, not verified access. `orca linear team list --json` lists the connected Linear teams. The same skill (line 23) says to use the program named in the environment variable `ORCA_CLI_COMMAND` when that variable is set.
* **How resolve-issue reads the tracker today**: `skills/resolve-issue/SKILL.md` (line 16): The skill detects the tracker from the ticket id or URL, or from the conventions file. When it is unclear, the skill asks. Line 74 takes the blockers from the tracker relations, or from the "Blocked by" footer when the tracker has none. It treats done, cancelled and duplicate blockers as satisfied.
* **Tracker of this repository**: `CLAUDE.md` (line 7): Here the tickets are GitHub issues, and an epic is a parent issue with sub-issues. Each wave is a GitHub milestone. Line 9 says that decision records live in `docs/decisions/`.

### Scope

1. **Orca adapter, in `cstack/src/orca/`.** Every call to `orca`, `gh`, `glab` and `git` goes through one function. That function takes a program and a list of arguments, and it runs the program without a shell. Tests replace it with a function that returns a recorded answer. Reuse that function if an earlier ticket already wrote one. The adapter runs the program named in `ORCA_CLI_COMMAND` when that variable is set, and `orca` otherwise. It always asks for `--json` when the command offers it.
2. **Shape check.** The adapter checks that every field it reads in an Orca answer is there and has the expected type. A missing or changed field is an error that names the command, the field and the Orca version. After a read, that error makes the feature fall back to the next client, and cstack says why. After a command that changes something, the error stops cstack, because it cannot tell whether the change happened. The message then asks the user to check the ticket or the worktree by hand.
3. **Feature-by-feature detection.** The adapter answers, for each Orca feature below, whether it is available, with a one-sentence reason when it is not. It computes the answers once per cstack command and never stores them on disk.
   - Orca is installed and supported when `orca --version` prints at least the minimum version.
   - Orca runs when `orca status --json` says that the app runs.
   - Orca workers are available when Orca runs and `orca agent-context --json` lists `orchestration worker-start`, `orchestration worker-show`, `orchestration send` and `orchestration check`.
   - Child worktrees are available when Orca workers are available, because they use `worker-start --worktree new-child`.
   - Worktrees linked to tickets are available when Orca runs and the command list holds `worktree create` and `reference find`.
   - Jira through Orca is available when Orca runs, the command list holds the `jira` commands, and `orca jira connection --json` lists exactly one site. With several sites, the reason says that cstack cannot choose a site on its own.
   - Linear through Orca is available when Orca runs, the command list holds the `linear` commands, and `orca linear team list --json` lists at least one team.
4. **Minimum Orca version.** The minimum is `1.4.259`, the version installed when milestone 3 starts, as line 307 of the specification recommends. With an older Orca, every Orca feature falls back. With an Orca newer than the newest recorded answers, cstack still uses Orca. `cstack doctor` then says that this version has not been tested, and the shape check of step 2 protects the run.
5. **`cstack doctor`.** #10 already reports Orca, its version and its connected trackers. Add the minimum version, whether the installed version is supported, and one line per feature of step 3 with its reason. Update the Orca line of the "Requirements" section of the README. The CI test of #10 compares that section with `cstack doctor`, and it must keep passing.
6. **Recorded Orca answers.** Store them in `cstack/test/fixtures/orca/1.4.259/`, with one file per command and case. The folder is named after the Orca version that gave the answers. Move there the Orca answers that #10 recorded, so that one folder holds them all. Write the script `cstack/scripts/record-orca.ts`, which `npm run record:orca` runs. On a machine where Orca runs, it records again the answers of the read-only commands. Some commands change something, such as `worker-start`, `jira status set` or `worktree create`. Record their answers once by hand, on a sandbox that holds no work data, and store them in the same folder. Before it writes a file, the script replaces every home folder path, host name, site name, workspace name, email address, ticket key and URL with a placeholder. Do the same by hand for the answers you record by hand. Every adapter test reads its Orca answers from these files.
7. **Tracker interface, in `cstack/src/tracker/types.ts`.** The interface has exactly four methods. Each method may use a different client, because cstack checks each capability on its own. Each answer says which client it used.

   ```ts
   type TrackerName = "jira" | "linear" | "github" | "gitlab";
   type StateKind = "todo" | "in-progress" | "finished" | "unknown";
   interface TicketRef { key: string; stateKind: StateKind }
   interface Ticket {
     key: string;        // checked against the key pattern
     title: string;      // data only
     body: string;       // data only
     url: string;        // checked https URL
     stateName: string;  // the exact name the tracker uses
     stateKind: StateKind;
     blockers: TicketRef[] | "unknown";
   }
   type Group = { milestone: string } | { epic: string };
   interface Tracker {
     readTicket(key: string): Promise<Ticket>;
     listGroup(group: Group): Promise<Ticket[]>;
     moveState(key: string, stateName: string): Promise<void>;
     addComment(key: string, bodyFile: string): Promise<void>;
   }
   ```

8. **State kinds.** Each adapter maps the state of the tracker to one kind. Jira maps its status category: "To Do" is `todo`, "In Progress" is `in-progress`, and "Done" is `finished`. Linear maps its state type: triage, backlog and unstarted are `todo`, started is `in-progress`, and completed and canceled are `finished`. On GitHub and GitLab, a closed issue is `finished`, whatever the reason it was closed. An open issue with the label `in progress` or `in review` is `in-progress`, and any other open issue is `todo`. Any state the adapter cannot map is `unknown`. A ticket in review is `in-progress`, not `finished`.
9. **State names on GitHub and GitLab.** Their issues are only open or closed. So the contract fixes two state names, `in progress` and `in review`. #26 implements them as labels. `moveState` refuses any other name on these two trackers. On every tracker, `moveState` refuses a name that the tracker does not offer, and the error lists the names it offers.
10. **Ticket keys and URLs (decision 14).** cstack checks a key before it uses it anywhere. Jira and Linear keys match `^[A-Z][A-Z0-9_]+-[1-9][0-9]*$`. GitHub and GitLab keys match `^#[1-9][0-9]*$` and name an issue of the repository of the `origin` remote. No key is longer than 32 characters. A ticket URL must be an `https` URL without spaces, quotes or control characters. A key or URL from a tracker answer that fails its check makes cstack skip that ticket and say so.
11. **Blockers from the footer.** Write one function that reads the line `Blocked by: …` of a ticket body, keeps only the keys that pass the key check, and ignores everything else. Adapters use it when the tracker has no relations for a ticket, as `skills/resolve-issue/SKILL.md` (line 74) does today. When neither the relations nor the footer give an answer, the blockers are `"unknown"`.
12. **Choice of tracker and client (decision 10).** The tracker commands take `--tracker <jira|linear|github|gitlab>`. Without it, the tracker is the forge of the `origin` remote, GitHub or GitLab. The guides pass the value of the `Tracker:` line of the plan file header. For each capability, cstack first tries Orca, when the Orca feature for that tracker is available. Then it tries `gh` for GitHub or `glab` for GitLab, when that client is logged in (`gh auth status`, `glab auth status`). Last, it uses a file that Claude writes.
13. **The file that Claude writes.** It is a JSON file with `"format": "cstack-tracker/1"`, the tracker name, and a list of tickets in the shape of `Ticket`. cstack refuses an unknown key and names it. It also refuses an unknown format version. The file serves reads only. When no client can make a write, the tracker command makes no change and exits with `4`, the common code of #13 for a tool that is missing or not logged in. It prints what Claude must write with its own connection. For a move, it prints the ticket key and the state name. For a comment, it prints the ticket key and the path of the comment file.
14. **Fake tracker, in `cstack/test/fakes/tracker.ts`.** It implements the same four methods in memory. A test can set tickets, states and blockers, read back every move and comment, and make any capability behave as if no client existed.
15. **Ready rule (decision 9), in `cstack/src/tracker/ready.ts`.** Write one pure function that takes a ticket, the state kinds of its blockers, and whether the ticket has a worktree. A ticket that is `finished` is left out of every group. A ticket that is `in-progress` or has a worktree is "already started". A ticket is "blocked" in three cases. Its own state is `unknown`, its blockers are `"unknown"`, or one of its blockers is not `finished`. The function returns the reason, or the list of open blockers. Every other ticket is "ready". #29 answers whether a ticket has a worktree, and both `cstack wave` and `cstack wave --watch` call this one function.
16. **New commands in `cstack/src/manifest.ts` (decision 7).** Add each command below with its flags and exit codes, following the scheme of #13. Give each one a placeholder handler that refuses to run, exits with `1`, and names the ticket that builds it. The CI test of #13 then accepts the guides that name these commands. #31 checks that no placeholder is left.
    - `cstack tracker read <key> [--tracker <name>] [--from-file <path>]` prints one ticket as JSON (#25, #26).
    - `cstack tracker list (--milestone <name> | --epic <key>) [--tracker <name>] [--from-file <path>]` prints the tickets of a group with their states and blockers (#25, #26).
    - `cstack tracker move <key> --to <state name> [--tracker <name>]` moves a ticket (#25, #26).
    - `cstack tracker comment <key> --body-file <path> [--tracker <name>]` adds a comment (#25, #26).
    - `cstack skills install --add-permission` adds the Claude Code permission rule for cstack (#26).
    - `cstack helper start <executor|implementer|implementer-escalation> --plan <file> [--unit <n>] [--child-worktree]` starts a helper (#27, #28).
    - `cstack helper wait <helper id>` waits for a helper's final report (#27).
    - `cstack helper done <kind> --helper <helper id>` reads a helper's report on standard input, checks it, saves it and ends the helper (#27). For the executor, it reuses the check of `cstack report submit` of #16.
    - `cstack unit collect <n>...` brings the commits of units from their child worktrees onto the ticket branch (#28).
    - `cstack wave (--milestone <name> | --epic <key>) [--tracker <name>] [--from-file <path>] [--watch]` lists a wave and starts its ready tickets (#29, #30).

    The exit codes follow the common codes of #13. A tracker command that has no client for its step exits with `4`, and Claude then does the step with its own connection. `cstack wave --watch` also exits with `4` when no tracker client exists. Two codes belong to one command each. `cstack helper start` exits with `6` when Orca workers are not available, and Claude then starts a sub-agent. `cstack helper wait` exits with `6` when the helper is still working.
17. **A plan line for child worktrees.** Add the optional unit line `- Worktree: <absolute path>` to the plan format of #13, and teach its reader to return it. cstack writes this line, never a person, when #28 starts a unit in a child worktree. The format version stays `cstack-plan/1`, because the format of #13 already lets notes follow a unit's lines. #31 makes `cstack measure` read this line.
18. **ADR-SIC-F, in `docs/decisions/ADR-SIC-F-tracker-access.md`.** Write the context, the options and the choice. The first option is a token that cstack stores. The second is a token that cstack reads from the environment and sends to the tracker's web interface. The third is the clients that are already logged in, plus a file from Claude. The choice is the third option, in the order of step 12. Write the consequences too. cstack holds no credential. A write with no client goes back to Claude. `orca jira` cannot link two tickets, so Claude creates such links with its own connection, as line 308 of the specification says.

### Acceptance (TDD)

* `cstack/test/orca/features.test.ts`: Write first a case where the recorded `orca --version` answer is `1.4.258`. See every Orca feature reported as unavailable, with a reason that names the minimum `1.4.259`. Then, with the recorded answers of `1.4.259`, each feature of step 3 is available. When `orca status` says the app does not run, every feature that needs a running Orca is unavailable. When Orca runs but has no Jira site, only Jira through Orca is unavailable.
* `cstack/test/orca/shapes.test.ts`: This test carries US-13 AC4: "Tests check `cstack` against recorded answers of Orca, so that a change in the output of Orca fails CI." Write first a case that loads a copy of a recorded answer with one field renamed, and see the error name the command, the field and the version. Then every file in `cstack/test/fixtures/orca/1.4.259/` passes the shape check.
* `cstack/test/fixtures-public.test.ts`: Write first a case with a recorded answer that holds a path under `/Users/`, and see the test fail. The test reads every file under `cstack/test/fixtures/`, so it also covers the answers of `gh` and `glab` that #26 records. It fails on a path under `/Users/`, an email address, or a host name that is not a placeholder.
* `cstack/test/tracker/keys.test.ts`: Write first a case where the key `ABC-12; rm -rf ~` is refused before any program runs. Then valid Jira, Linear and GitHub keys pass. A key with a space, a newline, `$(`, a backtick, a leading dash or more than 32 characters is refused.
* `cstack/test/tracker/claude-file.test.ts`: Write first a case where a file holds an unknown key, and see cstack refuse it and name that key. A file with an unknown format version is refused. A valid file gives the same tickets as the fake tracker would.
* `cstack/test/tracker/ready.test.ts`: This test carries US-14 AC2: "A ticket is ready when three things are true. All its blockers are done, cancelled or duplicates. It is not in progress. It has no worktree yet." It also carries US-15 AC3: "A blocker counts as done only when its ticket is in a done state. In practice, its pull request has been merged." Write first a case where the only blocker is in review, and see the ticket reported as blocked by that blocker. Then a ticket whose blockers are all `finished` is ready. A ticket in progress, or with a worktree, is already started. A ticket whose blockers are `"unknown"`, or whose own state is `unknown`, is blocked with its reason, never ready.
* `cstack/test/doctor-orca.test.ts`: Write first a case where `cstack doctor` runs with the recorded answers of `1.4.259`, and see the minimum version, "supported", and one line per feature. With a newer recorded version, it also says that this version has not been tested.
* The manifest test of #13 passes with the new commands. Each new command, run now, exits with `1` and names the ticket that builds it.
* `cstack/test/plan/worktree-line.test.ts`: Write first a case with a plan file whose unit 2 holds `- Worktree: /tmp/repo-unit-2`, and see the reader return that path for unit 2. A plan without the line still reads, and its units have no worktree. The format version stays `cstack-plan/1`.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* `cstack/test/run.test.ts`: No call to `orca`, `gh`, `glab` or `git` goes through a shell. Write first a case that passes the argument `x; touch <temporary folder>/pwned` to the run function. See the program receive it as one argument, unchanged, and see that no file was created. The run function has no option that turns a shell on. #25, #26 and #29 use this same function to check that no ticket title or body reaches an argument.

**Size: M** · Blocked by: #10, #13 · Feeds: #25, #26, #27, #29

---

### CTO review — one ready rule for the wave and the watch (2026-11-17)

1. The ready rule lives in one function, in `cstack/src/tracker/ready.ts`. #29 and #30 call it and never write a second version of any part of it.
2. A blocker counts only when it is finished, which means done, cancelled or a duplicate. A blocker in review is not finished. When cstack cannot tell the state of a ticket or of its blockers, the ticket is blocked, never ready.
3. #29 writes the only check of "has a worktree", in git and in Orca, and #30 reuses it. So the wave and the watch always agree on which tickets are already started.


### Ticket comments

Comment of 2026-11-18T08:24:13Z:

`cstack doctor` (ticket #10) already reports Orca, so this ticket can build on it. The Orca check is in `cstack/src/doctor/orca.ts`. It runs `orca --version`, then `orca status --json`, and only when Orca answers as reachable it runs `orca jira connection --json` and `orca linear team list --workspace all --json`.

The recorded answers are in `cstack/test/fixtures/doctor/orca-*.json`. I recorded the real empty answers of one machine and replaced every id with a placeholder. I then built the connected Jira, connected Linear, Linear error and closed Orca answers from them, using only the fields that Orca's code writes. The recorded version is 1.4.262.

Doctor prints the Orca version but does not judge it. When you add the minimum, keep it in one place only, and let doctor read it from there. The Orca check reads only `result.runtime.reachable`, `result.sites`, `result.teams` and `result.meta.workspaceErrors`. A renamed field would look like "installed but not running" or "no tracker", and the recorded answers would not show it. Your contract tests should catch that shape change. If your adapter replaces these reads, please let doctor use it.


Comment of 2026-11-18T09:23:26Z:

Ticket #13 made `cstack/src/manifest.ts` the single list of commands. The code is in the pull request of branch `gambitl/plan-format`, and it is not on `main` until that merges.

To add a command, add one entry there. An entry gives the usage line, a one-sentence summary, its flags in long form, its exit codes, the file under `cstack/src/commands/` that implements it, the ticket that builds it, and whether it is built. The command words are the words of the usage line before the first `<` or `[`. Use the common exit codes `0` to `5`: done, refused, usage error, invalid input, missing tool and tool failed. Codes `6` and above belong to one command, which lists them. When the command is built, set `built: true` and add its handler to the `HANDLERS` record of `cstack/src/cli.ts`. Tests check that both agree and that each command's usage error contains its usage line. A command that works on a run also takes `--plan <file>`.



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
- ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
- ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.

**Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.






ADRs that already exist and that this ticket must respect:

- ADR-SIC-B, where the run state lives and how its format is versioned: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how `cstack` ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-D, the settings file and the models of the agents: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final`.
- ADR-SIC-H, how a `cstack` command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`. A command prints through `io`, returns its exit code, and never calls `process.exit()`.

## Dependencies

Clear. Both blockers are closed as completed: #10 (`cstack doctor`) and #13 (the plan file format and the command list).

## Code mapping

Graphify is not installed on this machine, on purpose, so the mapping used `grep`, `git log` and file reads. The user dropped Graphify from the new version of the skills: #19 (`cstack graph ensure`) is closed as not planned, and ticket #45 removes Graphify from cstack, its doctor check and its guides. This ticket neither builds on Graphify nor removes it (coordinator message, 2026-11-19).

**The program runner.** `cstack/src/doctor/runner.ts` holds `createRunner(timeoutMs)` and `findOnPath`. `createRunner` runs a program with `execFile`, which uses no shell. It returns `ok` with the standard output, `failed` with the exit code, `missing` or `timeout`. It has no option for a working folder, and it drops the standard error. Its tests are in `cstack/test/doctor-runner.test.ts`. Six other places run `git` directly with `spawnSync` or `execFile`, all without a shell: `src/run-state.ts:83`, `src/plan/locate.ts:44`, `src/plan/commits.ts:12`, `src/measure/moments.ts:10`, `src/report/reports.ts:37` and `src/commands/unit-commit.ts:24`. Ticket #20, built at the same time, adds its own helper for `git`, `gh` and `glab` in `cstack publish`, and the brief says not to touch it.

**Doctor and Orca today.** `cstack/src/doctor/orca.ts` runs `orca --version`, then `orca status --json`, and reads only `result.runtime.reachable`. When Orca is reachable, it runs `orca jira connection --json` (reads `result.sites`) and `orca linear team list --workspace all --json` (reads `result.teams` and `result.meta.workspaceErrors`). It prints one line, for example `Orca (optional): 1.4.262, running. Trackers: Jira, Linear`. `cstack/src/doctor/requirements.ts` lists the items, and `cstack/src/commands/doctor.ts` prints them. `cstack/test/doctor.test.ts` answers each command from `cstack/test/fixtures/doctor/orca-*.json` and `orca-version.txt` (version `1.4.262`, recorded by #10, with hand-built variants). `cstack/test/readme-requirements.test.ts` checks that the bold names under "## Requirements" in `README.md` match the doctor items, in order. Only the names are compared, so the text of the Orca line can change freely.

**Orca on this machine, read-only checks.** `orca --version` prints `1.4.263` today, not `1.4.259` as the ticket says. `ORCA_CLI_COMMAND` is not set here. `orca status --json` answers `{id, ok, result: {target, app: {running, pid, desktopWindowStatus}, runtime: {state, reachable, connectionState, runtimeId, appVersion, remoteUpdateSupport, capabilities[]}, graph}, _meta}`. `orca agent-context --json` is not wrapped in `ok` and `result`. It answers `{schemaVersion, commandCount, commands: [{command, path, aliases, argumentMode, summary, usage, flags, positionalArgs, repeatableFlags, examples, notes}]}`, with 340 commands and 325 kB of text. It lists `orchestration worker-start`, `worker-show`, `send`, `check`, `worktree create`, `reference find`, and the `jira` and `linear` commands that #25 plans to use. `orca jira connection --json` and `orca linear team list --workspace all --json` answer with no site and no team on this machine. So the connected Jira and Linear answers can only be written by hand, as #10 did.

**The command list.** `cstack/src/manifest.ts` holds `COMMANDS`, the common exit codes `EXIT` (0 to 5), `commandWords` and `matchMention`. `commandWords` takes the usage words before the first `<` or `[`. A usage line such as `cstack tracker list (--milestone <name> | --epic <key>)` would make `(--milestone` a command word, so `commandWords` must also stop at `(`. The field `ticket` is one number, but the tracker commands are built by two tickets, #25 and #26. `cstack/test/manifest.test.ts:116` counts ten built and five unbuilt commands. `README.md:40` says "`cstack` has ten commands" and lists only built commands, so it does not change.

**The command line.** `cstack/src/cli.ts` sends a command to `HANDLERS` by its first word. A first word that is in the list but has no built entry prints `"<word>" is not built in this version yet.` and returns `2`. A built group with an unbuilt second word, such as `cstack unit red 1`, goes to `dispatchSubcommand` and returns `2` with the group's usage. The ticket asks that each new command exits with `1` and names the ticket that builds it. `cstack unit collect` is in the built `unit` group, so a check on the first word alone cannot do that. `cstack/test/cli.test.ts:103` expects `2` for `cstack next`, and `cli.test.ts:134` expects `2` for `cstack unit red 1`. Tickets #15 and #17, built at the same time, will change these same tests when they build `next` and `unit red`.

**The plan reader.** `cstack/src/plan/read.ts` reads unit lines in a fixed order through `UNIT_FIELDS` and `FIELD_LINE` (line 286 to 297). After `- Depends on:`, the optional lines `- Design specification:` and `- Blocked:` follow, then free notes. `PlanUnit` (line 87) has no worktree field. The unit lines are also documented in a comment of `cstack/skills/resolve-issue/templates/plan.md` (line 46 to 56).

**Public fixtures.** The current fixtures hold one email (`person@example.com`, twice) and two hosts: `example.atlassian.net` in `orca-jira-connected.json`, and `github.com` in `fixtures/doctor/gh.txt`, which is the real `gh --version` answer. No fixture holds a path under `/Users/`. `scripts/private_names.py check <path>` is the second check, with the private list kept outside the repository.

**Scripts and the build.** `cstack/package.json` has no `record:orca` script and no `scripts/` folder. Node runs `.ts` files directly since Node 23.6, and `engines.node` is `>=26`. But the files in `src/` import each other with `.js` names, so a script cannot import them from `src/` without the build. `tsconfig.json` includes only `src` and `test`, so a file in `cstack/scripts/` is not type checked unless it is added there.

**Risks.** `cli.ts`, `manifest.ts`, `manifest.test.ts`, `cli.test.ts` and `README.md` are changed by every ticket of this wave. In wave 4, a merge kept two copies of one function in `cli.ts` without a conflict marker. Keep the changes to these files small and grouped. The ticket is large for its "M" size: it has eighteen scope points and eleven acceptance tests.

**Tickets that build on this one.** #25 (Jira and Linear through Orca) and #26 (GitHub and GitLab through `gh` and `glab`) both name the folder `cstack/test/fixtures/orca/1.4.259/` in their text. #25 uses `orca jira issue`, `jira search`, `jira status list`, `jira status set`, `jira comment add`, `linear issue`, `linear list-issues`, `linear team states`, `linear status set` and `linear comment add`.

## Decisions

**Versions and recorded answers**

- The recorded Orca answers live in `cstack/test/fixtures/orca/1.4.263/`, not `1.4.259/`, because the folder is named after the Orca version that gave the answers and `1.4.263` is the version installed. Wherever the ticket says "the recorded answers of `1.4.259`", read `1.4.263`. (2026-11-19, user's answer)
- The minimum Orca version stays `1.4.259`. It is written once, in `cstack/src/orca/version.ts`, and `cstack doctor` reads it from there. The README does not repeat the number. (2026-11-19, ticket and user's answer)
- The newest tested Orca version, `1.4.263`, is a second constant of `cstack/src/orca/version.ts`. A test fails when it differs from the newest version folder under `cstack/test/fixtures/orca/`. (2026-11-19, user's answer)
- Versions compare as numbers, part by part, so `1.4.1000` is newer than `1.4.263`. The reader of `orca --version` takes the first `<number>.<number>.<number>` of the answer and accepts a trailing newline. (2026-11-19, assumption not asked)
- This ticket records no answer of an Orca command that changes something, such as `worker-start`, `jira status set` or `worktree create`. Each later ticket writes the answers of the write commands it calls. The "write" mode of the shape check is tested with a small answer built inside the test. (2026-11-19, user's answer)
- Only read-only Orca commands are ever run on this machine: `--version`, `status --json`, `agent-context --json`, `jira connection --json` and `linear team list --workspace all --json`, plus `--help`. Never run an Orca command that changes something, and never touch the orchestration run `run_29e70c826058`. (2026-11-19, user's brief)
- The record script runs those five read-only commands. Jira and Linear have no site and no team on this machine, so the answers with a Jira site, with two Jira sites, with a Linear team, with a Linear connection error, and the answer of a closed Orca are written by hand from the recorded answers and from the hand-made answers of #10. `cstack/test/fixtures/orca/README.md` lists which files were recorded and which were written by hand. (2026-11-19, user's brief)
- The record script keeps each answer whole, with two exceptions. For `agent-context`, it keeps only `schemaVersion`, `commandCount` and the `command` field of each entry. For `status`, it empties `result.runtime.capabilities`, because cstack does not read it and it holds 320 internal names. (2026-11-19, user's answer, accepted by default)
- Fixture file names are `<command words joined by "-">.<case>.<json or txt>`, for example `version.current.txt`, `status.running.json`, `status.closed.json`, `agent-context.current.json`, `jira-connection.empty.json`, `jira-connection.one-site.json`, `jira-connection.two-sites.json`, `linear-team-list.empty.json`, `linear-team-list.connected.json` and `linear-team-list.error.json`. The record script picks the case from the content of the answer, so that a new recording never puts a connected answer under an "empty" name. (2026-11-19, assumption not asked)
- Placeholders are realistic reserved values, so that adapters can still parse them. An email becomes `person@example.com`. A URL becomes an `https://` URL on an `example.com` host, such as `https://jira.example.com`. The home folder becomes `/home/user`. The machine's host name becomes `host.example.com`. A ticket key becomes `EXA-1`, `EXA-2` and so on. A person's name becomes `Example Person`. Site, workspace and team names become `Example Site`, `Example Workspace` and `Example Team`, and a team key becomes `EXA`. An id becomes a fixed placeholder, as in #10: `id-placeholder`, `account-1`, `site-1`, the all-zero UUID for runtime ids, and `1` for a process id. (2026-11-19, user's answer, accepted by default)
- Before any fixture file is committed, run `python3 scripts/private_names.py check cstack/test/fixtures` from the repository root, and commit only when it exits `0`. It never prints a private name, and nobody prints the private list. (2026-11-19, user's brief)
- `example.atlassian.net`, used by #10, is not a reserved name, so the hand-written Jira answers use `https://jira.example.com` instead. (2026-11-19, user's answer, accepted by default)
- The answers that #10 recorded in `cstack/test/fixtures/doctor/orca-*.json` and `orca-version.txt` move into `cstack/test/fixtures/orca/1.4.263/`, rebuilt at `1.4.263`, and the old files are deleted. The other files of `cstack/test/fixtures/doctor/` stay. (2026-11-19, ticket and user's answer)

**Running programs**

- The single runner moves from `cstack/src/doctor/runner.ts` to `cstack/src/orca/run.ts`, with `findOnPath`. `cstack doctor` keeps working and uses it. The old file and `cstack/test/doctor-runner.test.ts` are deleted, and their tests move to `cstack/test/run.test.ts`. (2026-11-19, user's brief)
- The runner takes a program, a list of arguments and an optional working folder. It runs the program with `execFile`, never through a shell, and has no option that turns a shell on. A successful answer carries the standard output and the standard error. A failed answer carries the exit code and the standard error. (2026-11-19, ticket and assumption not asked)
- The runner sets an explicit output limit of 16 MiB. An answer larger than that is reported as its own kind, `too-large`, not as a failure, so that the reason is never misleading. (2026-11-19, user's answer, accepted by default)
- The six direct `git` calls in `run-state.ts`, `plan/locate.ts`, `plan/commits.ts`, `measure/moments.ts`, `report/reports.ts` and `commands/unit-commit.ts` stay as they are. Every new call to `orca`, `gh`, `glab` or `git` in this ticket goes through the runner. (2026-11-19, user's answer)
- `cstack/test/run.test.ts` scans every `.ts` file under `cstack/src/` and fails when one runs a program through a shell. A shell call is a use of `exec` or `execSync` from `node:child_process`, a `shell` option, or a string literal that names a shell program (`sh`, `bash`, `zsh`, with or without `/bin/`). `execFile`, `execFileSync`, `spawn` and `spawnSync` without a shell pass. The scan looks at what a file imports from `node:child_process`, so the `.exec(` method of a regular expression, used in `plan/read.ts` and `json-position.ts`, never counts as a shell. The file `cstack/src/test-run.ts` is allowed by name, whatever its content, with a comment that says why: ticket #17 runs the user's own `testCommands` from `.cstack/settings.json` through `/bin/sh` on purpose. The test must not accept only some forms of shell call in that file. (2026-11-19, user's answer and coordinator's message)
- `orca` is called through one helper in `cstack/src/orca/call.ts`. It runs the program named in the environment variable `ORCA_CLI_COMMAND` when that variable is set and not empty, and `orca` otherwise. The value names one program and is never split into words. The helper adds `--json` to every command that offers it, which is every command this ticket calls except `--version`. (2026-11-19, ticket and assumption not asked)
- `ORCA_ENVIRONMENT` and `ORCA_PAIRING_CODE`, which send Orca commands to another Orca server, are not handled in this ticket. (2026-11-19, assumption not asked)

**Shape check and Orca features**

- The shape check lives in `cstack/src/orca/shapes.ts`. For each Orca command it lists the fields cstack reads, each with a path and a type. A path can go through arrays, such as `commands[].command`. A missing field, or a field with another type, is an error that names the command, the field and the Orca version. (2026-11-19, ticket)
- After a read, a shape error makes the feature fall back, and the reason of the feature is the error message. After a command that changes something, a shape error stops cstack, and the message says that cstack cannot tell whether the change happened and asks the user to check the ticket or the worktree by hand. (2026-11-19, ticket)
- An Orca answer with `ok: false` is not a shape error. It is a failure of the tool, and after a read the feature falls back with a reason that says Orca answered with an error. (2026-11-19, assumption not asked)
- The fields read are: `ok` and `result.app.running` and `result.runtime.reachable` for `status --json`; `commands[].command` for `agent-context --json`, which has no `ok` and no `result`; `ok` and `result.sites` for `jira connection --json`; `ok`, `result.teams` and `result.meta.workspaceErrors` for `linear team list --workspace all --json`; and a version in the text of `--version`. (2026-11-19, code mapping)
- A fixture file whose command has no entry in the shape table fails the shape test, so later tickets must declare the shape of every answer they record. (2026-11-19, assumption not asked)
- Orca is installed and supported when `orca --version` gives at least `1.4.259`. With an older version, every Orca feature is unavailable, and the reason names the minimum `1.4.259`. (2026-11-19, ticket)
- Orca runs when `result.app.running` and `result.runtime.reachable` are both `true` in `orca status --json`. (2026-11-19, assumption not asked)
- Orca workers are available when Orca runs and `agent-context` lists `orchestration worker-start`, `orchestration worker-show`, `orchestration send` and `orchestration check`. Child worktrees are available when Orca workers are. Worktrees linked to tickets are available when Orca runs and the list holds `worktree create` and `reference find`. (2026-11-19, ticket)
- Jira through Orca is available when Orca runs, the list holds `jira connection`, `jira issue`, `jira search`, `jira status list`, `jira status set` and `jira comment add`, and `jira connection --json` lists exactly one site. With no site, the reason says Orca has no saved Jira site. With several, the reason says how many and that cstack cannot choose a site on its own. (2026-11-19, ticket, with the command list of #25 as an assumption not asked)
- Linear through Orca is available when Orca runs, the list holds `linear team list`, `linear issue`, `linear list-issues`, `linear team states`, `linear status set` and `linear comment add`, and `linear team list --workspace all --json` lists at least one team. With no team and a workspace error, the reason says Orca reports a connection error for a Linear workspace. (2026-11-19, ticket, with the command list of #25 as an assumption not asked)
- The detection is lazy and cached for the life of one cstack command. Each Orca command runs at most once per cstack command, only when a feature asked for needs it, and nothing is written to disk. For example, asking only for Jira through Orca never runs `linear team list`. (2026-11-19, ticket and user's answer, accepted by default)

**Doctor and the README**

- `cstack doctor` uses the feature detection instead of its own reads. Its Orca line gives the version, the minimum and whether the version is supported, then whether Orca runs. Under it, one line per feature, indented by two spaces, gives "available" or "not available" with the reason, for Orca workers, child worktrees, worktrees linked to tickets, Jira through Orca and Linear through Orca. (2026-11-19, ticket and assumption not asked)
- When Orca is not installed, doctor prints only the Orca line, as today. When the installed version is newer than `1.4.263`, the Orca line also says that this version has not been tested and that cstack still uses it. The Orca item stays optional, so it never changes the exit code of doctor. (2026-11-19, ticket and assumption not asked)
- The doctor tests of Orca move to `cstack/test/doctor-orca.test.ts` and read their answers from `cstack/test/fixtures/orca/1.4.263/`. The test that doctor never runs `orca open`, `orca serve` or an install command stays, and the list of commands doctor may run gains `orca agent-context --json`. (2026-11-19, ticket)
- The Orca line of the README "Requirements" section says that `cstack doctor` prints the minimum Orca version and which Orca features work on the Mac. It does not write the number. The bold name `Orca` stays, so `readme-requirements.test.ts` keeps passing. (2026-11-19, ticket and assumption not asked)

**The tracker contract**

- `cstack/src/tracker/types.ts` holds the types of the ticket exactly as written in scope 7: `TrackerName`, `StateKind`, `TicketRef`, `Ticket`, `Group` and `Tracker` with its four methods. (2026-11-19, ticket)
- A Jira or Linear key matches `^[A-Z][A-Z0-9_]+-[1-9][0-9]*$`. A GitHub or GitLab key matches `^#[1-9][0-9]*$`. No key is longer than 32 characters. A ticket URL is an `https` URL without spaces, quotes or control characters. (2026-11-19, ticket)
- A wrapper in `cstack/src/tracker/checked.ts` puts these checks around any tracker adapter. It checks every key before it calls the adapter, so a refused key never reaches a program. It refuses a state name or a body file path that is empty, starts with `-`, or holds a control character, before any program runs, and it makes the body file path absolute. It checks the key and the URL of every ticket an adapter returns. In a list, a ticket that fails is skipped and a warning names it. A single read that fails is refused. (2026-11-19, ticket and user's answer, accepted by default)
- `cstack/src/tracker/errors.ts` holds the error types of the contract, each with its exit code. A refused key, state name or path exits with `1`. An invalid file from Claude exits with `3`. A step that no client can do exits with `4`, and its message says what Claude must do with its own connection: the key and the state name for a move, the key and the path of the comment file for a comment. A shape error after a write, and a write that Orca reports as unconfirmed, exit with `5`. For an unconfirmed write, the message gives the retry id that Orca printed and asks the user to check the ticket, and cstack never retries on its own. (2026-11-19, ticket and user's answer, accepted by default)
- State kinds live in `cstack/src/tracker/states.ts`. Jira maps its status category: "To Do" or `new` is `todo`, "In Progress" or `indeterminate` is `in-progress`, "Done" or `done` is `finished`. Linear maps its state type: `triage`, `backlog` and `unstarted` are `todo`, `started` is `in-progress`, `completed` and `canceled` are `finished`. On GitHub and GitLab, a closed issue is `finished` whatever the reason, an open issue with the label `in progress` or `in review` is `in-progress`, and any other open issue is `todo`. The labels are compared without case. Anything else is `unknown`. (2026-11-19, ticket, with the Jira category keys and the case rule as assumptions not asked)
- The state names on GitHub and GitLab are exactly `in progress` and `in review`. A move to any other name is refused on these two trackers. On every tracker, a move to a name the tracker does not offer is refused, and the error lists the names it offers. (2026-11-19, ticket)
- The blockers of the footer are read by one function in `cstack/src/tracker/blockers.ts`. It reads only the footer line, which is the last line of the body that starts with `**Size:`. In that line it takes only the part between `Blocked by:` and the next ` · `, or the end of the line. The word `none`, in any case, or an empty part gives an empty list. At least one key that passes the key check gives those keys, and the other words are ignored. A part with text but no valid key gives `"unknown"`. A body without a footer line, or a footer without `Blocked by:`, gives `"unknown"`. (2026-11-19, user's answer)
- A second function in the same file merges the two sources. When the tracker read its relations, even an empty list, the blockers are those relations plus the footer keys, without duplicates. When the tracker has no relations, the footer alone answers, and `"unknown"` stays `"unknown"`. (2026-11-19, user's answer)
- The ready rule is one pure function in `cstack/src/tracker/ready.ts`, with the ticket and whether it has a worktree as input. It checks in this order. A `finished` ticket is left out. A ticket whose own state is `unknown` is blocked, with that reason. A ticket that is `in-progress` or has a worktree is already started. A ticket whose blockers are `"unknown"` is blocked, with that reason. A ticket with a blocker that is not `finished` is blocked, and the answer lists those blockers. Every other ticket is ready. A blocker in review is `in-progress`, so it is not finished. (2026-11-19, ticket and its CTO review block)
- The fake tracker in `cstack/test/fakes/tracker.ts` implements the four methods in memory. A test can set tickets, their groups, states and blockers, read back every move and comment, and make any of the four capabilities behave as if no client existed, which raises the "no client" error. (2026-11-19, ticket)
- The file that Claude writes has the keys `format` (always `cstack-tracker/1`), `tracker`, `tickets` and the optional `group`, which is `{"milestone": "<name>"}` or `{"epic": "<key>"}`. Each ticket has exactly the keys of `Ticket`, and each blocker exactly `key` and `stateKind`. Any other key, at any level, is refused, and the error names it. An unknown format version is refused. A list refuses a file without a group or with another group. A read ignores the group. The file serves reads only, and a move or a comment raises the "no client" error. (2026-11-19, ticket and user's answer, accepted by default)
- The tracker choice lives in `cstack/src/tracker/choose.ts`. Without `--tracker`, the tracker comes from the host of the `origin` remote: `github.com` gives GitHub, a host that contains `gitlab` gives GitLab, and any other host is a usage error that asks for `--tracker`. Both `https` and `git@host:` remote forms are read. (2026-11-19, ticket and assumption not asked)
- For each capability, the client is chosen in this order: Orca, when the Orca feature of that tracker is available (Jira and Linear only); then `gh` for GitHub or `glab` for GitLab, when `gh auth status` or `glab auth status` succeeds; then the file that Claude writes, for reads only. When nothing is left for a move or a comment, the answer is "no client". The forge clients are checked through the runner, lazily, once per cstack command. (2026-11-19, ticket)
- No cstack code and no test ever changes a real tracker. Tracker answers in tests come from the fake tracker. (2026-11-19, user's brief)

**The command list**

- Every unbuilt command exits with `1` and names the ticket or tickets that build it, for example `cstack: "cstack unit collect" is not built yet. Ticket #28 builds it.`. This holds for the old unbuilt commands too (`next`, `unit red`, `unit green`, `graph ensure`, `publish`). The check uses the longest entry whose command words start the command line, so `cstack unit collect` is caught although `unit` is a built group. When the first word belongs only to unbuilt entries and no entry matches fully, as in `cstack tracker`, cstack also exits with `1` and names their tickets. The two tests of `cli.test.ts` that expect `2` for `cstack next` and `cstack unit red 1` change to `1`. (2026-11-19, user's answer)
- An entry of `COMMANDS` may list flags that are not built yet, each with the ticket that builds it, in a new optional field `notBuiltFlags`. Such a flag on the command line also exits with `1` and names its ticket, before the handler runs. (2026-11-19, user's answer, accepted by default)
- The `ticket` field of an entry may hold one number or a list, because the tracker commands are built by #25 and #26 together. (2026-11-19, user's answer, accepted by default)
- `commandWords` stops at the first token that starts with `<`, `[`, `(` or `-`, so that a usage line such as `cstack wave (--milestone <name> | --epic <key>)` keeps `wave` as its only word. (2026-11-19, assumption not asked)
- The new entries use the usage lines of scope 16, word for word. Their files under `cstack/src/commands/` are `tracker-read.ts`, `tracker-list.ts`, `tracker-move.ts`, `tracker-comment.ts`, `helper-start.ts`, `helper-wait.ts`, `helper-done.ts`, `unit-collect.ts` and `wave.ts`. No placeholder handler file is written: the refusal comes from the generic check, and `HANDLERS` keeps one handler per built first word. (2026-11-19, assumption not asked)
- The tickets are: #25 and #26 for the four tracker commands; #27 for `helper start`, with `--child-worktree` not built and built by #28; #27 for `helper wait` and `helper done`; #28 for `unit collect`; #29 for `wave`, with `--watch` not built and built by #30. `skills install` gains the flag `--add-permission`, not built and built by #26. (2026-11-19, ticket)
- `helper done` and `unit collect` work on a run, so they also take `--plan`, like the other commands of a run. `helper start` already names `--plan <file>` in its usage. The tracker commands, `helper wait` and `wave` do not take `--plan`. (2026-11-19, assumption not asked)
- The exit codes of the new entries use the common codes of #13. The four tracker commands use `0`, `1`, `2`, `3`, `4` and `5`. `helper start` adds `6`: Orca workers are not available, so Claude starts a sub-agent. `helper wait` adds `6`: the helper is still working. `wave` uses `4` when no tracker client exists. (2026-11-19, ticket)
- On this branch, the counts become ten built commands and fourteen unbuilt ones. When another ticket of the wave merges first, take `origin/main` with a merge commit, keep both changes, update the counts in `cstack/test/manifest.test.ts`, and look for a function that git kept twice in `cli.ts` without a conflict marker. (2026-11-19, user's brief)

**The plan format**

- A unit may end with the optional line `- Worktree: <absolute path>`, after `- Blocked:` in the fixed order of the unit lines. The reader returns it as the unit's worktree. A path that is not absolute, or that holds a control character, is a problem of the plan. The format version stays `cstack-plan/1`. The comment of `cstack/skills/resolve-issue/templates/plan.md` that lists the unit lines gains one line saying that cstack writes this line when a unit runs in a child worktree, never a person. (2026-11-19, ticket)

**Rules of this run**

- Never edit anything under the top-level `skills/` folder, which is frozen at the tag `prose-skills-final`. (2026-11-19, user's brief)
- Do not change `cstack publish` or any file of ticket #20. Do not build on Graphify or `cstack graph ensure`, and do not remove them either: ticket #45 removes Graphify. (2026-11-19, user's brief and coordinator's message)
- Never run `cstack skills install` against the real home folder, never change anything under `~/.claude/skills/`, never install Graphify, and never read anything under `~/comparison/`. Tests use a temporary home folder. (2026-11-19, user's brief)
- Never change the git `user.email` of the repository, and never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. Never push a tag that starts with `v`. (2026-11-19, user's brief)
- The usual GitHub comments of the skill are allowed: on this ticket, on the tickets it feeds, and the ADR-SIC-F line of epic #6. Run `python3 scripts/private_names.py check` on each text before posting it. (2026-11-19, coordinator's answer)
- Before the push, `git log --format='%ae %ce' origin/main..HEAD` must show only the address that ends in `@users.noreply.github.com`, and `python3 scripts/private_names.py check` must exit `0` on a temporary file, outside the repository, that holds `git log -p origin/main..HEAD` and the drafted pull request title and body. (2026-11-19, user's brief)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure: rerun it with `gh run rerun <run id>`, and report it if it still did not run. Never merge the pull request. (2026-11-19, user's brief)

## Architecture

The approach is locked by the ticket, which names every file, and by the answers above. The contract is split into two small folders. `cstack/src/orca/` holds the runner, the Orca call helper, the version constants, the shape check, the feature detection and the record logic. `cstack/src/tracker/` holds the types, the key checks and their wrapper, the errors, the state kinds, the blockers, the ready rule, the file from Claude and the tracker choice. Every piece is a pure function or takes the runner as an argument, so tests never start a real program except in `run.test.ts`. The shared files `manifest.ts`, `cli.ts`, `manifest.test.ts`, `cli.test.ts` and `README.md` change in one unit each, in one place, to keep merges with the other tickets of the wave small.

No new decision since phase 4.

## Implementation units

### Unit 1: One runner for every program — status: todo
- Failing test: `cstack/test/run.test.ts` passes the single argument `x; touch <temporary folder>/pwned` to the runner with `printf '%s'` as the program. The program must print the argument unchanged, and the file `pwned` must not exist. Write it first against `cstack/src/orca/run.ts` so it fails because the module does not exist. Then add the cases moved from `cstack/test/doctor-runner.test.ts`, a case for the working folder option, a case where the standard error comes back, a case where an answer over the output limit gives `too-large`, and the scan of `cstack/src/` for shell calls described in "Decisions", with `cstack/src/test-run.ts` allowed by name and the comment that says why.
- Minimum code: move `createRunner` and `findOnPath` to `cstack/src/orca/run.ts`. Add the optional working folder, keep the standard error in `ok` and `failed`, set the 16 MiB limit and report `too-large`. Update the imports in `cstack/src/commands/doctor.ts`, `cstack/src/doctor/requirements.ts`, `cstack/src/doctor/orca.ts` and `cstack/test/doctor.test.ts`. Delete `cstack/src/doctor/runner.ts` and `cstack/test/doctor-runner.test.ts`.
- Refactor: none.
- Commit message: `refactor(cli): move the program runner into cstack/src/orca and refuse any shell`
- Depends on: none

### Unit 2: Ticket keys, errors and the checked tracker — status: todo
- Failing test: `cstack/test/tracker/keys.test.ts`. The first case wraps a spy adapter, whose methods call a fake runner, with the checked wrapper, and calls `readTicket("ABC-12; rm -rf ~")`. It must be refused with exit code `1` and the fake runner must never be called. Then valid Jira, Linear and GitHub keys pass. A key with a space, a newline, `$(`, a backtick, a leading dash or more than 32 characters is refused. A URL that is not `https`, or holds a space, a quote or a control character, is refused. A state name or a body file that is empty, starts with `-` or holds a control character is refused before the adapter is called, and a relative body file reaches the adapter as an absolute path. In a list, a returned ticket with a bad key or URL is skipped and the warning names it. Each error type of "Decisions" carries its exit code, and the unconfirmed-write message holds the retry id.
- Minimum code: `cstack/src/tracker/types.ts` with the types of scope 7, `cstack/src/tracker/keys.ts`, `cstack/src/tracker/errors.ts` and `cstack/src/tracker/checked.ts`, as "Decisions" describes them.
- Refactor: none.
- Commit message: `feat(cli): check ticket keys, URLs and arguments before any tracker client runs`
- Depends on: none

### Unit 3: State kinds and state names — status: todo
- Failing test: `cstack/test/tracker/states.test.ts`. First case: a GitHub issue that is open with the label `in review` is `in-progress`, not `finished`. Then the Jira, Linear and forge mappings of "Decisions", `unknown` for anything else, and the check of a state name: `in progress` and `in review` only on GitHub and GitLab, and an unknown name refused with the list of offered names.
- Minimum code: `cstack/src/tracker/states.ts`.
- Refactor: none.
- Commit message: `feat(cli): map the states of each tracker to four state kinds`
- Depends on: 2

### Unit 4: Blockers from the footer and the relations — status: todo
- Failing test: `cstack/test/tracker/blockers.test.ts`. First case: the body of ticket #24 itself, which quotes `Blocked by: …` in its scope before its footer `**Size: M** · Blocked by: #10, #13 · Feeds: #25, #26, #27, #29`, gives exactly `#10` and `#13` for GitHub. Then `none` gives an empty list, text without a valid key gives `"unknown"`, no footer gives `"unknown"`, the Feeds part is never read, and invalid tokens next to valid keys are ignored. For the merge: relations plus footer keys without duplicates, an empty relation list plus an unknown footer gives an empty list, and no relations plus an unknown footer gives `"unknown"`.
- Minimum code: `cstack/src/tracker/blockers.ts` with the two functions of "Decisions".
- Refactor: none.
- Commit message: `feat(cli): read the blockers from the ticket footer and merge them with the tracker relations`
- Depends on: 2

### Unit 5: The ready rule — status: todo
- Failing test: `cstack/test/tracker/ready.test.ts`. First case: a ticket whose only blocker is in review (`in-progress`) is blocked by that blocker. Then a ticket whose blockers are all `finished` is ready, a ticket in progress or with a worktree is already started, a ticket whose blockers are `"unknown"` or whose own state is `unknown` is blocked with its reason and never ready, and a `finished` ticket is left out.
- Minimum code: `cstack/src/tracker/ready.ts`, one pure function in the order of "Decisions".
- Refactor: none.
- Commit message: `feat(cli): decide whether a ticket is ready, started or blocked in one function`
- Depends on: 2

### Unit 6: The fake tracker — status: todo
- Failing test: `cstack/test/tracker/fake-tracker.test.ts`. First case: a move made through the fake tracker can be read back with its key and state name. Then comments are read back, a group lists its tickets, and a capability switched off raises the "no client" error with exit code `4`.
- Minimum code: `cstack/test/fakes/tracker.ts`.
- Refactor: none.
- Commit message: `test(tests): add a fake tracker that records moves and comments in memory`
- Depends on: 2

### Unit 7: The file that Claude writes — status: todo
- Failing test: `cstack/test/tracker/claude-file.test.ts`. First case: a file that holds an unknown key is refused, with exit code `3`, and the error names that key. Then an unknown format version is refused, a list refuses a file without a group or with another group, a ticket with a bad key is skipped with a warning, a move or a comment raises the "no client" error whose message tells Claude what to do, and a valid file gives the same tickets as the fake tracker filled with the same data.
- Minimum code: `cstack/src/tracker/claude-file.ts`.
- Refactor: none.
- Commit message: `feat(cli): read the tickets of a group from a file that Claude writes`
- Depends on: 2, 6

### Unit 8: The choice of tracker and client — status: todo
- Failing test: `cstack/test/tracker/choose.test.ts`. First case: for a Jira move with the Jira feature of Orca not available, the answer is "no client". Then the order Orca, then `gh` or `glab`, then the file for reads; the tracker from an `https` and a `git@` remote of GitHub and GitLab; a usage error for any other host; and the forge clients checked with `gh auth status` or `glab auth status` through a fake runner, at most once.
- Minimum code: `cstack/src/tracker/choose.ts`.
- Refactor: none.
- Commit message: `feat(cli): choose the tracker and the client for each capability`
- Depends on: 1, 2

### Unit 9: Record the Orca answers — status: todo
- Failing test: `cstack/test/orca/record.test.ts`. First case: the placeholder pass turns a sample answer that holds a home folder path, the machine's host name, an email, a URL, a ticket key, a site, workspace and team name, and ids, into the placeholders of "Decisions", and none of the original values is left. Then the recorder, run with a fake runner, writes one file per command under `<folder>/<version>/` with the file names and the trimming of "Decisions", and uses `ORCA_CLI_COMMAND` when it is set.
- Minimum code: `cstack/src/orca/call.ts` (program choice and `--json`), `cstack/src/orca/record.ts`, `cstack/scripts/record-orca.ts` (calls the recorder from `dist/`), and the script `"record:orca": "npm run build && node scripts/record-orca.ts"` in `cstack/package.json`. Then run `npm run record:orca` once on this machine, which runs only the five read-only Orca commands. Write the hand-made answers listed in "Decisions" and `cstack/test/fixtures/orca/README.md`. Run `python3 scripts/private_names.py check cstack/test/fixtures` from the repository root and commit only when it exits `0`.
- Refactor: none.
- Commit message: `test(tests): record the answers of the read-only Orca commands with placeholders`
- Depends on: 1

### Unit 10: The version constants and the shape check — status: todo
- Failing test: `cstack/test/orca/shapes.test.ts`. First case: a copy of `status.running.json` with `reachable` renamed is checked, and the error names `orca status --json`, the field `result.runtime.reachable` and the version `1.4.263`. Then every file of `cstack/test/fixtures/orca/1.4.263/` passes, a file of an unknown command fails, a shape error in "write" mode says that cstack cannot tell whether the change happened, versions compare as numbers, and the newest tested constant equals the newest version folder.
- Minimum code: `cstack/src/orca/version.ts` and `cstack/src/orca/shapes.ts`.
- Refactor: none.
- Commit message: `feat(cli): check the shape of every Orca answer that cstack reads`
- Depends on: 9

### Unit 11: Detect the Orca features — status: todo
- Failing test: `cstack/test/orca/features.test.ts`. First case: with the recorded `orca --version` answer changed to `1.4.258`, every Orca feature is unavailable, with a reason that names the minimum `1.4.259`. Then, with the recorded answers of `1.4.263`, the hand-made one-site Jira answer and the connected Linear answer, every feature is available. With `status.closed.json`, every feature that needs a running Orca is unavailable. With a running Orca and no Jira site, only Jira through Orca is unavailable. Two Jira sites give the reason of "Decisions". A renamed field gives a reason that names it. Asking only for Jira never runs `linear team list`, and each command runs at most once.
- Minimum code: `cstack/src/orca/features.ts`.
- Refactor: none.
- Commit message: `feat(cli): detect each Orca feature once per command, with a reason when it is missing`
- Depends on: 1, 9, 10

### Unit 12: Doctor reports the Orca features — status: todo
- Failing test: `cstack/test/doctor-orca.test.ts`. First case: `cstack doctor` with the recorded answers of `1.4.263` prints the minimum `1.4.259`, "supported", and one line per feature. Then a recorded version newer than `1.4.263` also says that this version has not been tested, an older version says it is not supported, a closed Orca gives every feature as not available, a missing Orca prints only the Orca line, and doctor never runs `orca open`, `orca serve` or an install command.
- Minimum code: rewrite `cstack/src/doctor/orca.ts` on the feature detection. Move the Orca cases of `cstack/test/doctor.test.ts` to the new test file, point the doctor tests at `cstack/test/fixtures/orca/1.4.263/`, delete `cstack/test/fixtures/doctor/orca-*.json` and `orca-version.txt`, and update the Orca line of the "Requirements" section of `README.md`.
- Refactor: none.
- Commit message: `feat(cli): show the minimum Orca version and each Orca feature in cstack doctor`
- Depends on: 11

### Unit 13: Keep the fixtures public — status: todo
- Failing test: `cstack/test/fixtures-public.test.ts`. First case: the checker, given a sample answer that holds a path under `/Users/`, reports it. Then it reports an email outside the reserved example domains and a URL host that is neither a reserved example name nor `github.com` or `gitlab.com`. Hosts are found only in URLs and email addresses, never in version strings or file names. Last, every file under `cstack/test/fixtures/` passes.
- Minimum code: the test file and its small checker.
- Refactor: none.
- Commit message: `test(tests): fail when a fixture holds a home path, an email or a private host name`
- Depends on: 12

### Unit 14: The new commands in the command list — status: todo
- Failing test: in `cstack/test/cli.test.ts`, a case that runs every unbuilt entry of `COMMANDS` with its command words, and every flag of `notBuiltFlags` on its command, and expects exit code `1` with every ticket number of the entry or the flag in the message. It fails first because `cstack unit collect` does not exist and because `cstack next` gives `2`. Then, in `cstack/test/manifest.test.ts`, the counts become ten built and fourteen unbuilt, `commandWords` of `cstack wave (--milestone <name> | --epic <key>) ...` is `["wave"]`, and the guides scan still passes.
- Minimum code: the nine entries, the `--add-permission` flag of `skills install`, the field `notBuiltFlags` and the wider `ticket` field in `cstack/src/manifest.ts`, and the generic refusal in `run` of `cstack/src/cli.ts`. Change the two old tests of `cli.test.ts` that expect `2` for `cstack next` and `cstack unit red 1`. Keep the change of `cli.ts` in one place inside `run`.
- Refactor: none.
- Commit message: `feat(cli): list the tracker, helper, unit collect and wave commands, and refuse every unbuilt command with its ticket`
- Depends on: none

### Unit 15: The worktree line of a plan unit — status: todo
- Failing test: `cstack/test/plan/worktree-line.test.ts`. First case: a plan file whose unit 2 holds `- Worktree: /tmp/repo-unit-2` gives that path for unit 2. Then a plan without the line still reads and its units have no worktree, a relative path or a control character is a plan problem, and the format version stays `cstack-plan/1`.
- Minimum code: the `Worktree` field in `UNIT_FIELDS`, `FIELD_LINE` and `PlanUnit` of `cstack/src/plan/read.ts`, and one line in the unit-lines comment of `cstack/skills/resolve-issue/templates/plan.md`.
- Refactor: none.
- Commit message: `feat(cli): read the worktree line of a plan unit`
- Depends on: none

### Unit 16: Record ADR-SIC-F — status: todo
- No test: it is a decision record and one line of the specification page.
- Minimum code: write `docs/decisions/ADR-SIC-F-tracker-access.md` with the context, the three options of scope 18, the choice of the third option in the order of the tracker choice, and the consequences: cstack holds no credential, a write with no client goes back to Claude with exit code `4`, `orca jira` cannot link two tickets so Claude creates such links with its own connection, the file from Claude carries a `group` key, and the blockers are the tracker relations plus the footer keys. In section 9 of `docs/projects/skills-into-cli.md`, point the ADR-SIC-F line at the record.
- Refactor: none.
- Commit message: `docs: record how cstack reaches trackers and forges (ADR-SIC-F)`
- Depends on: 4, 7, 8

Security by design: this ticket has no endpoint, no database query and no credential. Its external inputs are ticket text, keys, URLs, Orca answers and the file from Claude. Units 1, 2, 7 and 13 cover them, and each of those units writes its security test first.

## Documentation duties

- Decision record: applies, written to `docs/decisions/ADR-SIC-F-tracker-access.md` (unit 16).
- Specification page: applies, the ADR-SIC-F line of section 9 of `docs/projects/skills-into-cli.md` (unit 16).
- README: applies, the Orca line of the "Requirements" section (unit 12). The command list of the README does not change, because the new commands are not built.
- Fixture notes: applies, `cstack/test/fixtures/orca/README.md` lists the recorded and the hand-written answers (unit 9).
- Epic #6: applies, the ADR-SIC-F line of its "Open questions and decisions" block says the record exists, in phase 10.
- Ticket comments: applies, on #24, and on the tickets that build on it: #25, #26, #27, #28 and #29. They give the folder `1.4.263/`, the shape table, the checked wrapper and the errors, the footer and merge rule, the `group` key, the not-built flags, and the worktree line, each to the ticket that needs it.
- Conventions file: does not apply.

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

**I need your answer before I plan.**

1. **The recorded Orca answers go in `cstack/test/fixtures/orca/1.4.263/`, and the minimum stays `1.4.259`.** The ticket names the folder after the Orca version that gave the answers. Nobody can record `1.4.259` any more: this machine runs `1.4.263`, and #10 recorded `1.4.262`. A folder named `1.4.259/` would claim answers that nobody saw. Two acceptance tests, and the tickets for Jira and Linear through Orca (#25) and for GitHub and GitLab (#26), name `1.4.259/`, so I will tell those two tickets in a comment. I recommend this because the folder name must stay true.

2. **Every command that is not built yet exits with `1` and names its ticket, not only the new ones.** Today such a command exits with `2`. A check on the first word cannot catch `cstack unit collect`, because `unit` is already built. I recommend one rule on the full command words, flags included, because two behaviours for the same case would confuse the guides. Two tests in `cli.test.ts` change, and the tickets that build `cstack next` (#15) and `cstack unit red` (#17) touch the same lines, so expect a small merge conflict.

3. **The blockers come only from the "Blocked by" part of the footer, and they add up with the tracker relations.** Every footer looks like `**Size: M** · Blocked by: #29, #14 · Feeds: #31`. A function that reads "the line with `Blocked by:`" to its end counts the Feeds keys as blockers. It also stops early on this very ticket, whose scope point 11 quotes `Blocked by: …` in prose. I recommend this: read only the footer line, up to the next `·`. The word `none` gives no blocker, and text without a valid key gives "unknown". When the tracker gives relations, cstack adds the footer keys to them. "Unknown" stays for a ticket with neither. Read literally, the ticket would block forever a Jira ticket that has no links and no footer.

4. **This ticket records no answer of an Orca command that changes something.** The ticket asks for them, but it calls none of those commands. The tickets that use them (#25, #27, #29) know which fields they read, and they write those answers by hand from `--help`. An answer written now would fix a shape that no code checks. The shape check still gets its mode for commands that change something, tested with a small answer written inside the test.

**I will do this unless you say no.**

- I leave the six direct `git` calls alone, and I add a test that fails when a file of `cstack/src/` uses a shell. I will warn the ticket that adds `cstack publish` (#20), because its new helper must pass that test.
- The recorded command list keeps only the command names. Placeholders use reserved names, such as `person@example.com`, `jira.example.com` and `EXA-1`.
- The file that Claude writes gets an optional `group` key, so a file written for one milestone cannot answer for another.
- cstack refuses a state name or a file path that starts with `-`. With no shell, `--to --json` would still be read as a flag, and Orca reads `--body-file -` as standard input.
- Orca's Linear writes can answer "unconfirmed", with a retry id. The contract treats that as "the change may have happened", so cstack stops and never posts a comment twice.
- The runner gets an explicit output limit. Node cuts the output of `execFile` at 1 MB by default, and the Orca command list is already 325 kB.
- The `ticket` field of the command list accepts several tickets, because #25 and #26 build the tracker commands together.
- I post the usual comments on this ticket, on the tickets it feeds and on the epic (#6), once `private_names.py check` passes on each text. Your rule about trackers covers cstack's code and tests, not these comments.

**I checked it myself.**

- `orca jira comment add` and `orca linear comment add` both take `--body-file`, so `addComment(key, bodyFile)` fits Orca as it is.
- The footers of issues #7 to #33 all have the `Size · Blocked by · Feeds` form, with `none` for an empty list.

**Good to know.**

- Orca's help mentions `ORCA_ENVIRONMENT` and `ORCA_PAIRING_CODE`, which send commands to a paired Orca server. I have not checked what cstack would then act on.

#### Details

**Folder of recorded answers (blocking, answered by reading the machine, no one to ask).** The ticket (scope 4 and 6, acceptance of `features.test.ts` and `shapes.test.ts`) names `cstack/test/fixtures/orca/1.4.259/` and says that the folder carries the version that gave the answers. `orca --version` prints `1.4.263` today (checked again in this review), and the comment of #10 says its doctor fixtures were recorded at `1.4.262`. No `1.4.259` binary is available, so a `1.4.259/` folder would be mislabelled. I keep the draft recommendation. The minimum stays `1.4.259`, as scope 4 and line 307 of the specification decided. The folder is `1.4.263/`. The newest tested version lives in one constant of `cstack/src/orca/`, and a test compares it with the newest folder name. The acceptance case "with the recorded answers of `1.4.259`, each feature is available" then reads "with the recorded answers of `1.4.263`". The version comparison must be numeric, part by part, so that `1.4.1000` counts as newer than `1.4.263`. The parser of `orca --version` must also accept a trailing newline. I rejected raising the minimum to `1.4.262` or `1.4.263`. It would be more honest about what was tested, but it changes a number the ticket fixed and its `1.4.258` acceptance case. The shape check already protects the untested versions in between. If nobody decides, the acceptance text cannot be met literally, so this needs an answer. #25 and #26 both quote the old folder name, so the hand-down comments must give the new one.

**Rule for unbuilt commands (blocking, the developer decides).** `cstack/src/cli.ts:67-70` checks only the first word and prints `"<word>" is not built in this version yet.` with exit `2`. `cstack unit collect` belongs to the built `unit` group (`cli.ts:58`), so it would reach `dispatchSubcommand` and print the group usage with `2`. The ticket asks for `1` and the ticket number for the new commands. I keep the draft: one rule for every unbuilt command, checked on the full command words. The flags `--add-permission` (#26) and `--watch` (#30) belong to commands whose words already exist or will, and the manifest has no per-flag build state today, so the plan must add a small list of unbuilt flags per entry. `cstack/test/cli.test.ts:103` (`cstack next`) and `:134` (`cstack unit red 1`) change to `1`; #15 and #17 rewrite those same lines in this wave, so the conflict is certain but small. The rejected option keeps `2` for old commands and `1` for new ones, which gives the guides two meanings for one situation. The manifest `ticket` field (`manifest.ts:29`) is one number; the tracker commands are built by #25 and #26 together, so it becomes `number | number[]`, and the message names both.

**Blockers from the footer and from relations (blocking, answered by reading the tickets).** `skills/create-tickets/SKILL.md:119` says the footer is always present, on one line, in the form `**Size: S/M/L** · Blocked by: … · Feeds: …`, with "none" for an empty list. I checked the bodies of issues #7 to #33 with `gh issue list`: every footer has that form, for example #30 `**Size: M** · Blocked by: #29, #14 · Feeds: #31`. The body of #24 itself holds "reads the line `Blocked by: …` of a ticket body" in scope point 11, before its footer, so a function that takes the first line containing `Blocked by:` would read prose and, under the draft rule, return "unknown". A function that reads to the end of the line would take `#31` from Feeds as a blocker. The parser must therefore select the footer line (a line that starts with `**Size:`, the last one when there are several) and take the segment between `Blocked by:` and the next ` · `. The draft answer to its question 6 stays: `none` or empty gives `[]`, at least one valid key gives those keys, text without a valid key gives `"unknown"`. I disagree with one part of the draft and of scope 11: "use the footer only when the tracker has no relations" plus "no footer gives unknown" means that a hand-written Jira or Linear ticket with no links and no footer is blocked forever, and `cstack wave` starts nothing on such a project. A ticket whose relations were not wired (pass 2 of create-tickets can fail) but whose footer lists blockers would, under "relations first", look ready. I recommend the union of both sources. When the tracker read its relations successfully, the blockers are those relations plus the footer keys. When the tracker has no relations, the footer alone gives the blockers. The blockers are `"unknown"` only when neither source answers. This respects the locked CTO review of the ticket (item 2: unknown means blocked), because a successful relation read is a known answer. It changes what the ready rule returns, so the developer must confirm it. If nobody decides, the executor follows the literal ticket text.

**Answers of commands that change something (blocking, the developer decides).** Scope 6 asks to record by hand the answers of `worker-start`, `jira status set` and `worktree create` in a sandbox. This ticket calls none of them: #25 calls the Jira and Linear writes, #27 calls `worker-start`, #29 calls `worktree create`. The user's constraint for this run forbids running any Orca command that changes something, so these answers could only be written from `--help`, which gives usage, not the JSON shape. I keep the draft recommendation: no such fixture here. The shape check gets a mode for commands that change something (an error stops cstack and asks the user to check by hand), tested with a small answer built inside the test. Each later ticket writes the answers it reads, by hand from `--help`, and says so in its plan. This removes part of scope 6, so it needs the developer's yes.

**Direct git calls (non-blocking).** The six calls listed in the code mapping (`src/run-state.ts:83`, `src/plan/locate.ts:44`, `src/plan/commits.ts:12`, `src/measure/moments.ts:10`, `src/report/reports.ts:37`, `src/commands/unit-commit.ts:24`) already use `spawnSync` or `execFile` without a shell. Scope 1 says every call goes through one function, but moving them touches files that #17 and #20 change in this wave. I keep the draft: leave them, route every new call through the runner, and add a test that scans `cstack/src/` for `exec(`, `execSync(`, `shell:` and `spawn` with a shell option. The scan must not flag `execFile`. #20 adds its own helper for `git`, `gh` and `glab` in `cstack publish` in this wave; whichever branch merges second meets this test, so the hand-down comment to #20 should say: "#24 adds a test that fails if any file under `cstack/src/` runs a program through a shell (`exec`, `execSync`, or a `shell` option). Please make sure the helper of `cstack publish` uses `execFile` or `spawn` without `shell`."

**Recorded command list and placeholders (non-blocking).** `orca agent-context --json` is 325 kB with 340 commands, help text, URLs and examples. cstack reads only the `command` field of each entry, so the record script keeps `schemaVersion`, `commandCount` and the list of `command` values. Placeholders follow the draft question 8: reserved names (`example.com` hosts, `person@example.com`, `/home/user`, `EXA-1`, `Example Site`). `example.atlassian.net` in `fixtures/doctor/orca-jira-connected.json` changes to `jira.example.com`. The public test must detect hosts precisely (URL hosts and email domains), because a broad "word.word" pattern would also match version strings and file names. It accepts `github.com` and `gitlab.com`, which tools print.

**Group key in the file that Claude writes (non-blocking for the build, part of the contract).** Without it, `cstack tracker list --milestone M4` reads a file written for M3 without complaint. I keep the draft: an optional `group` key; `listGroup` refuses a file without it or with another group; `readTicket` ignores it. The format stays `cstack-tracker/1` because the key is part of the first version.

**Arguments that start with a dash (non-blocking, security).** Running without a shell stops shell injection, but not argument injection. `orca jira status set <key> --to <name>` and `orca linear status set` take the state name as the next argument (checked with `--help`); a state name such as `--json` or `--to-id` would be read as a flag. `orca jira comment add` and `orca linear comment add` read `--body-file -` as standard input. The key check already refuses a leading dash. The state name of `moveState` and the `bodyFile` of `addComment` must be refused when they start with `-`, and a body file path must be made absolute before use. The `moveState` check against the names the tracker offers covers most of it, but the check must run before any program runs.

**Unconfirmed writes (non-blocking for this ticket, part of the error contract).** `orca linear comment add --help` shows `--write-id <uuid>`, "Retry id from linear_write_unconfirmed". Orca therefore has a result where a Linear write may or may not have happened. Scope 2 already says that a shape error after a write stops cstack. The contract should name a third outcome, besides success and shape error: Orca reported the write as unconfirmed. cstack stops, prints the retry id and asks the user to check the ticket, and never retries on its own, so a comment is never posted twice. #25 implements it; this ticket only fixes the error type.

**Output limit and cost of detection (non-blocking).** `createRunner` in `cstack/src/doctor/runner.ts` calls `execFile` without `maxBuffer`, so Node's default of 1 MiB applies. The command list is 325 kB today and grows with Orca. Past the limit, `execFile` kills the child and the runner returns `failed`, so every Orca feature would fall back with a misleading reason. The runner should set an explicit limit, such as 16 MB, and report an overflow as its own kind. The detection should also be lazy and cached per command run: `cstack tracker read` needs only the Jira or Linear feature, not `agent-context` parsing for workers. The runner also drops standard error today; the code mapping already plans to keep it.

**GitHub comments during this run (non-blocking).** The user's rule forbids cstack code and tests from changing a real tracker. The documentation step of the skill posts comments on this ticket, on #25, #26, #27 and #29, and updates the ADR line of the epic #6, as earlier tickets did. I treat these as allowed, after `python3 scripts/private_names.py check` passes on each text, unless the developer objects.

**Remote Orca server (non-blocking, not checked).** Orca's help for the write commands mentions `--environment`, `--pairing-code`, `ORCA_ENVIRONMENT` and `ORCA_PAIRING_CODE`, which run commands against a paired Orca server. If one of these variables is set in the user's terminal, `orca status` and the writes may act on another machine. I did not run anything to confirm it. A later ticket could make `cstack doctor` say when such a variable is set.

**Locked decisions cited, not reopened.** The CTO review block of the ticket (2026-11-17) fixes one ready function, "finished" as done, cancelled or duplicate, and "unknown means blocked". ADR-SIC-H fixes how a command ends. The epic fixes "no credentials in cstack", and ADR-SIC-F records it.

I checked data model lock-in, scale, UX edge cases, operations and cost, and reversibility, and found nothing beyond the points above: the `cstack-tracker/1` format and the `Tracker` interface are versioned or internal, no recurring cost or new service appears, and nothing here deletes data.

### Open questions and answers

1. **Which version names the folder of recorded Orca answers?** Blocking. The ticket says `cstack/test/fixtures/orca/1.4.259/`, and that the folder is named after the Orca version that gave the answers. The Orca installed today is `1.4.263`, and #10 recorded `1.4.262`. Nobody can record a `1.4.259` answer any more. Recommendation: keep the minimum at `1.4.259`, as the ticket decided. Name the folder `1.4.263/`, record the read-only answers again at `1.4.263`, and rebuild the hand-made variants of #10 from them. Keep the newest tested version, `1.4.263`, in one constant of `src/orca/`, and let a test check that it matches the newest folder. Tell #25 and #26 the new folder name in the ticket comments. Answer (user, 2026-11-19): agreed with the recommendation. The folder is `1.4.263/` and the minimum stays `1.4.259`.

2. **Should every unbuilt command exit with `1` and name its ticket, or only the new ones?** Blocking, because it changes what exists. Today an unbuilt command exits with `2` and says "not built in this version yet". The ticket asks for `1` and the ticket number for the new commands. Recommendation: one rule for all unbuilt commands, checked on the full command words, so that `cstack unit collect` and `cstack unit red` are caught too. The tests of `cli.test.ts` that expect `2` change. A not-built flag, such as `--add-permission` (#26) and `--watch` (#30), follows the same rule. Answer (user, 2026-11-19): agreed. One rule for every unbuilt command, checked on the full command words.

3. **Should the six existing direct `git` calls move onto the single runner in this ticket?** Blocking, because it changes the scope. They already run without a shell. Moving them touches files that #17 and #20 change at the same time. Recommendation: leave them. Every new call goes through the runner. A test scans `cstack/src/` and fails if any file uses `exec`, `execSync` or a `shell` option, so the "no shell" promise covers every file today. A later ticket can move the six calls. Answer (user, 2026-11-19, as part of the default list): agreed. The six calls stay, and a test scans `cstack/src/` for any shell use, with `cstack/src/test-run.ts` allowed by name.

4. **Does this ticket write the answers of commands that change something?** Blocking, because it changes the scope. The ticket names `worker-start`, `jira status set` and `worktree create`, but this ticket calls none of them. #25 records its Jira and Linear answers itself, and #27 and #29 call the others. Recommendation: no such fixture in this ticket. The shape check gets a "this command changes something" mode, tested with a small answer written inside the test. Each later ticket writes the answer of the write commands it calls. Answer (user, 2026-11-19): agreed. No fixture of a command that changes something in this ticket.

5. **May the recorded command list keep only the command names?** Non-blocking. `orca agent-context --json` is 325 kB of help text with many URLs and examples. Recommendation: the record script keeps `schemaVersion`, `commandCount` and the `command` field of each entry. That is all cstack reads, and it keeps the placeholder pass and the public check simple. Answer (user, 2026-11-19, accepted by default): the command list keeps only the command names.

6. **What does a `Blocked by:` footer with text but no valid key mean?** Blocking, because it changes the ready rule. The ticket says "keep only the keys that pass the check and ignore everything else". Read literally, `Blocked by: the login ticket` would give no blocker, and the ticket would look ready. Recommendation: the word `none` (or no text) gives an empty list. At least one valid key gives those keys. Text without any valid key gives `"unknown"`, so the ticket is blocked and the reason says why. A ticket without any `Blocked by:` line also gives `"unknown"`. Answer (user, 2026-11-19): agreed with the rule of the advisor's block. Only the `Blocked by:` part of the footer line is read, and the footer keys are added to the tracker relations.

7. **How does the file that Claude writes say which group it holds?** Non-blocking for the build, but it is part of the contract. The ticket lists `format`, `tracker` and `tickets`, and refuses any other key. With only these keys, `cstack tracker list --milestone M4` would happily read a file that Claude wrote for M3. Recommendation: add an optional `group` key, `{"milestone": "<name>"}` or `{"epic": "<key>"}`. `listGroup` refuses a file without a group or with another group. `readTicket` ignores the group. Answer (user, 2026-11-19, accepted by default): the optional `group` key is added.

8. **What do placeholders look like in the recorded answers?** Non-blocking. Recommendation: realistic reserved values, so that adapters can still parse them. Emails become `person@example.com`. URLs and hosts use `example.com` names, such as `https://jira.example.com`. The home folder becomes `/home/user`. Ticket keys become `EXA-1`, `EXA-2`. Site, workspace and team names become `Example Site`, `Example Workspace` and `Example Team`. Ids become fixed placeholder values. The public test accepts only reserved example names and two public hosts that tools print, `github.com` and `gitlab.com`. #10's `example.atlassian.net` changes to `jira.example.com`. Answer (user, 2026-11-19, accepted by default): reserved example values, as recommended.

9. **May this run comment on GitHub issues?** Blocking for the documentation step. The brief says never to call a tracker to change anything. The skill normally leaves a comment on this ticket and on the tickets it feeds (#25, #26, #27, #29), and updates the ADR line of the epic #6. Recommendation: this rule is about cstack's code and tests, which never reach a real tracker. The run still posts these GitHub comments in this public repository, as the earlier tickets of the epic did. Answer (from the coordinator of this wave, 2026-11-19): the reading is right. The rule covers cstack's code, its tests and its recordings, which never change a real tracker. The usual comments on this ticket, on the tickets it feeds, and the ADR line of epic #6 are allowed. Run `python3 scripts/private_names.py check` on each comment before posting it.

Assumptions not asked, written as decisions in phase 5:

- The runner moves to `cstack/src/orca/run.ts`, gets a working folder option, keeps the standard error, and `cstack doctor` uses it.
- "Orca runs" means `result.app.running` and `result.runtime.reachable` are both `true`. Doctor reads `reachable` today, and the Orca commands need the runtime.
- The Jira commands that the Jira feature needs are the five #25 uses, plus `jira connection`. The same holds for Linear with its five commands plus `linear team list`. The feature check uses `--workspace all`, like doctor.
- `ORCA_CLI_COMMAND` names one program. cstack never splits it into words.
- The default tracker comes from the host of `origin`: `github.com` gives GitHub, a host that contains `gitlab` gives GitLab, and anything else stops with a usage error that asks for `--tracker`.
- On GitHub and GitLab, the labels `in progress` and `in review` are compared without case.
- The record script logic lives in `cstack/src/orca/record.ts`, where it is tested. `cstack/scripts/record-orca.ts` only calls it from `dist/`, after `npm run build`.
- Doctor prints the Orca line with the version, the minimum and "supported", then one indented line per feature with its reason.

Coordination message from the coordinator of this wave, 2026-11-19: ticket #17 writes `cstack/src/test-run.ts`, which runs `/bin/sh -c <script> cstack <test file>` on purpose, because the script is the user's own `testCommands` value from `.cstack/settings.json`. The no-shell test of this ticket must allow `cstack/src/test-run.ts` by name, with a comment that explains why, and refuse a shell everywhere else. It must not accept only some forms of shell call, because the code of #17 is not on main yet.

### Architecture options
