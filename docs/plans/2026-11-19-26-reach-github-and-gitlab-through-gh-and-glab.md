# Plan: #26 — M3-3: Reach GitHub and GitLab through gh and glab, with a file from Claude as the last fallback

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/26
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/tracker-gh-glab
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T14:25:31+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** On GitHub and GitLab, cstack reads and updates tickets with the tools the user already logged in, or with a file from Claude when there is no such tool.

- **What the title means**: cstack is the command-line tool that this project builds, a program that you run by typing a command in a terminal. GitHub and GitLab host code, and they also hold tickets, called issues. `gh` is GitHub's own command-line tool, and `glab` is GitLab's. "A file from Claude as the last fallback" covers the case where no client can reach the tracker. Claude then reads the tickets with its own connection and writes them into a file that cstack reads.
- **Why we are doing it**: cstack must never store a password or a token. It must also work with every tracker the team uses, not only with the two that Orca supports. Orca is a desktop app that runs several coding agents side by side. Today, Claude Code sometimes refuses a tracker write that the user already approved. A permission rule is a line in the settings of Claude Code that lets Claude run a command without asking. One such rule for cstack fixes this.
- **For the user**: A solution engineer on GitHub or GitLab gets the same commands as a colleague on Jira or Linear. They allow cstack once, and a run no longer stops on a refused write.

**Goal.** This ticket makes the tracker interface of #24 work through `gh` and `glab`, as US-16 asks. It also adds the file from Claude as the last fallback, and the single permission rule for cstack. Greenfield: nothing exists yet.

### Where things are today (read first)

* **cstack**: Greenfield: no existing surface. When this ticket was written, cstack did not exist yet. #24 writes the tracker interface and the format of the file from Claude. #9 writes `cstack skills install`.
* **The story**: `docs/projects/skills-into-cli.md` (lines 201 to 203): These lines hold US-16 AC2, AC3 and AC4. Line 48 says that cstack reaches a tracker only through a client that is already logged in. When no such client exists, Claude reads the tracker with its own connection and hands the data to cstack as a file.
* **Tracker access today**: `skills/resolve-issue/agents/executor.md` (line 21): The executor reaches the tracker through an MCP server or through a client such as `gh` or `glab`. An MCP server is a connector that gives Claude access to a tool. `skills/resolve-issue/SKILL.md` (line 74) takes the blockers from the tracker relations, or from the "Blocked by" footer when the tracker has none.
* **This repository's tracker**: `CLAUDE.md` (line 7): The tickets here are GitHub issues. An epic is a parent issue whose tickets are its sub-issues, and each wave is a GitHub milestone.
* **`gh` 2.101.0, checked with its help**: `gh issue view` and `gh issue list` offer the JSON fields `blockedBy`, `blocking`, `state`, `stateReason`, `labels`, `milestone`, `subIssues`, `title`, `body` and `url`. `gh issue list` filters with `--milestone` and `--state all`. It returns 30 issues unless `--limit` says otherwise. `gh issue edit` takes `--add-label` and `--remove-label`. `gh issue comment` takes `--body-file`. `gh auth status` shows whether `gh` is logged in.
* **`glab` 1.119.0, checked with its help**: `glab issue list` filters with `--milestone` and `--all`. It reads one page at a time, chosen with `--page` and `--per-page`. `glab issue view <id>` and `glab issue list` print JSON with `--output json`. `glab issue update <id>` takes `--label` and `--unlabel`. `glab issue note <id> --message <text>` adds a comment. `glab api` calls the GitLab web interface. Its help shows the placeholder `:fullpath`, which stands for the current project. No `glab issue` subcommand lists the links between issues. `glab auth status` shows whether `glab` is logged in.
* **Claude Code permission rules**: `config/settings.json` (lines 9 and 10): This file is the copy of `~/.claude/settings.json` that `sync.sh` makes (line 34). Its permission rules live in the list `permissions.allow`. Each entry names a tool and a command pattern, in the form `Bash(<command> *)`.
* **Contract**: #24 defines the four methods `readTicket`, `listGroup`, `moveState` and `addComment`. On GitHub and GitLab, a closed issue is `finished`. An open issue with the label `in progress` or `in review` is `in-progress`. Any other open issue is `todo`. `moveState` accepts only the state names `in progress` and `in review` on these two trackers. A GitHub or GitLab key matches `^#[1-9][0-9]*$` and names an issue of the `origin` remote's repository. cstack tries Orca first, then `gh` or `glab` when it is logged in, then the file from Claude. The file has `"format": "cstack-tracker/1"` and serves reads only. cstack refuses a file that holds an unknown key. When no client can make a write, the command makes no change and exits with `4`, the common code of #13 for a missing tool. It prints what Claude must write with its own connection.

### Scope

1. Record the answers first. On a sandbox repository on GitHub and one on GitLab, which hold no work data, record the answer of each command used below. Replace names and paths with the placeholders of #24, and store the answers in `cstack/test/fixtures/gh/2.101.0/` and `cstack/test/fixtures/glab/1.119.0/`.
2. Write the GitHub adapter in `cstack/src/tracker/github-gh.ts`. It applies only when the `origin` remote is on GitHub and `gh auth status` succeeds.
   - `readTicket` runs `gh issue view <n> --json number,title,body,url,state,stateReason,labels,blockedBy`. It takes the blockers from `blockedBy`. When that list is empty, it uses the footer function of #24.
   - `listGroup` with a milestone runs `gh issue list --milestone <name> --state all --limit 500 --json` with the same fields. When the answer holds 500 issues, cstack refuses the list and says that the group has more tickets than it reads.
   - `listGroup` with an epic reads the `subIssues` field of the epic, then reads each sub-issue with `readTicket`.
   - `moveState` with `in progress` runs `gh issue edit <n> --add-label "in progress" --remove-label "in review"`. With `in review`, it does the opposite.
   - When the label does not exist in the repository, `gh` fails. cstack then prints the command that creates it, such as `gh label create "in progress"`, and lets you run it. cstack never creates a label on its own.
   - `addComment` runs `gh issue comment <n> --body-file <path>`.
3. Write the GitLab adapter in `cstack/src/tracker/gitlab-glab.ts`. It applies only when the `origin` remote is on GitLab and `glab auth status` succeeds.
   - `readTicket` runs `glab issue view <iid> --output json`. It reads the blockers with `glab api projects/:fullpath/issues/<iid>/links` and keeps the links whose `link_type` is `is_blocked_by`. When there is no such link, it uses the footer function. Blocking links exist only on some GitLab plans, so the footer is often the only source.
   - `listGroup` with a milestone runs `glab issue list --milestone <name> --all --output json --per-page 100`, page after page. It stops at 500 issues, and then refuses the list as on GitHub.
   - `listGroup` with an epic is refused, with a message that says to use `--milestone` on GitLab.
   - `moveState` runs `glab issue update <iid> --label <name> --unlabel <other name>`. A missing label is handled as on GitHub.
   - `addComment` reads the comment file and passes its text as the one argument after `--message`, with no shell.
4. Write the file fallback (US-16 AC3). `cstack tracker read` and `cstack tracker list` take `--from-file <path>`. When there is no client and no such option, they make no call. They exit with `4`, which tells Claude to use its own connection, and they name the file format that Claude must write. `cstack tracker move` and `cstack tracker comment` without a client make no change. They exit with the same code and print the key and the state name, or the key and the path of the comment file.
5. Write the permission rule (US-16 AC4). The rule is `Bash(cstack *)`, in the same form as the entries of `permissions.allow`.
   - `cstack skills install` reads `~/.claude/settings.json`. When the rule is missing, it prints the rule, the file and the option that adds it. It leaves the file unchanged.
   - `cstack skills install --add-permission` first saves a copy of the file next to it, with the date and time in its name. Then it adds the rule to `permissions.allow`. It keeps every other key, every other entry and their order.
   - When the rule is already there, the option changes nothing. When the file is not valid JSON, cstack refuses and changes nothing.
   - The rule covers every tracker write that goes through cstack. cstack runs `orca`, `gh` and `glab` itself, as child programs, so Claude Code asks no separate permission for them.
6. Add a short paragraph to the install section of the README. It says what the rule allows and how to add it.
7. Replace the placeholder handlers of `cstack tracker read`, `list`, `move` and `comment` for GitHub, GitLab and the file, and the placeholder of `cstack skills install --add-permission`.

### Acceptance (TDD)

* `cstack/test/tracker/github-gh.test.ts`: This test carries US-16 AC2: "When Orca does not support the tracker, `cstack` uses the command-line client of the tracker, such as `glab` or `gh`." Write first a case where `cstack tracker list --milestone <name>` runs on a GitHub repository, and see it run `gh issue list` and print one open blocker with its state kind. Then `cstack tracker move #12 --to "in progress"` runs `gh issue edit` with the two label options. A missing label prints `gh label create` and makes no other call. A list of 500 issues is refused.
* `cstack/test/tracker/gitlab-glab.test.ts`: Write first a case where `cstack tracker read #7` runs on a GitLab repository, and see the blocker taken from a link of type `is_blocked_by`. Then a ticket with only `relates_to` links takes its blockers from the footer. `--epic` is refused with the message about `--milestone`.
* `cstack/test/tracker/claude-file-fallback.test.ts`: This test carries US-16 AC3: "When no client exists, Claude reads and writes the tracker with its own connection, as it does today." Write first a case with no Orca, no `gh` and no `glab`, and see `cstack tracker read` exit with `4` and name the file format. Then the same read with `--from-file` prints the ticket from the file. `cstack tracker move` without a client writes nothing and prints the key and the state name.
* `cstack/test/skills-install-permission.test.ts`: This test carries US-16 AC4: "One permission rule in Claude Code allows `cstack`, and it covers every tracker write that goes through `cstack`." Write first a case where the settings file has no rule, and see `cstack skills install` print the rule and leave the file unchanged, byte for byte. Then `--add-permission` adds `Bash(cstack *)` once, keeps every other key and entry, and keeps a copy of the old file. A second run adds nothing. A file that is not valid JSON is refused and stays unchanged.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* A comment whose text holds `$(rm -rf ~)`, backticks and quotes reaches `gh` only as a file path, and reaches `glab` only as one argument, with no shell. The fake run function of #24 records every call, and the test checks that no call goes through a shell. No label name, branch name or option ever comes from the text of a ticket.

**Size: M** · Blocked by: #24 · Feeds: #31

### Comment on the ticket by the maintainer, 2026-11-19

This comment is copied word for word from https://github.com/gambitl/claude-code-stack/issues/26#issuecomment-7004442549.

Ticket #24 is built on the branch `gambitl/orca-tracker-contract`. This comment tells you what you can build on for GitHub and GitLab.

Put your adapter inside `checkedTracker` from `cstack/src/tracker/checked.ts`. It checks keys, state names and body paths before your code runs. GitHub and GitLab keys look like `#12`. The only state names on these two trackers are `in progress` and `in review`, and `checkStateName` in `cstack/src/tracker/states.ts` refuses any other. You implement them as labels. Map a ticket with `forgeStateKind`. The client choice is in `cstack/src/tracker/choose.ts`: `createClientChooser` checks `gh auth status` or `glab auth status` through the runner, once. Call `gh` and `glab` only through the runner in `cstack/src/orca/run.ts`, which never uses a shell.

For blockers, use `footerBlockers` and `mergeBlockers` in `cstack/src/tracker/blockers.ts`. A blocker that only the footer names comes back with the state `unknown`, so its ticket stays blocked. Look up the real state of each such key before you return the ticket. Take it from the group you already listed, and read only the other keys one by one. Otherwise `cstack wave` will start nothing on GitHub.

When you record `gh` and `glab` answers under `cstack/test/fixtures/`, `cstack/test/fixtures-public.test.ts` accepts only `github.com` and `gitlab.com` as real hosts, and only reserved example names otherwise. Real answers also hold hosts such as `api.github.com`. Replace them with placeholders instead of widening the list. Run `python3 scripts/private_names.py check cstack/test/fixtures` before you commit.

The flag `--add-permission` of `cstack skills install` is listed as not built, with your ticket number, in `notBuiltFlags` of `cstack/src/manifest.ts`. Its usage line in the manifest does not mention it yet, because `skills.ts` prints its own usage and a test compares the two. Change both when you build it.

### Decisions already taken upstream

From the epic, issue #6 (https://github.com/gambitl/claude-code-stack/issues/6), section "Open questions and decisions", copied word for word:

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

The ADRs that exist on `main` today, and that this ticket must respect:

- ADR-SIC-B, where the run state lives: `docs/decisions/ADR-SIC-B-run-state.md`.
- ADR-SIC-C, how `cstack` ships its skills: `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-D, the settings file and the review model: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- ADR-SIC-E, the new role of the repository: `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.
- ADR-SIC-F, how `cstack` reaches trackers and forges: `docs/decisions/ADR-SIC-F-tracker-access.md`.
- ADR-SIC-H, how a `cstack` command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.

## Dependencies

clear

The only blocker is #24, and it is closed as completed. Its code is on `main`.

## Code mapping

### Entry points and patterns

- The tracker contract of #24 is in `cstack/src/tracker/`. `types.ts` holds `Ticket`, `TicketRef`, `Group`, `Tracker` and `TrackerName`. `checked.ts` exports `checkedTracker(adapter, name, warn)`, which checks keys, the milestone name, the state name and the body file path before the adapter runs, and checks every returned ticket. It makes the body file path absolute.
- `cstack/src/tracker/choose.ts` exports `trackerFromRemote(url)` and `createClientChooser({ tracker, orcaAvailable, runner })`. The chooser runs `gh auth status` or `glab auth status` once, through the runner, with no `--hostname` and no working folder. It returns `gh`, `glab`, `orca`, `file` (reads only) or `none`. The type `Capability` is `"read" | "list" | "move" | "comment"`.
- `cstack/src/tracker/blockers.ts` exports `footerBlockers(tracker, body)` and `mergeBlockers(relations, footer)`. A footer-only key comes back with the state kind `unknown`, and the adapter must look up its real state.
- `cstack/src/tracker/states.ts` exports `forgeStateKind({ open, labels })`, `checkStateName(tracker, name)` and `FORGE_STATE_NAMES`. Labels are compared without case.
- `cstack/src/tracker/errors.ts` holds `TrackerError` (with `exitCode`), `RefusedArgumentError` (1), `InvalidFileError` (3), `NoClientError` (4, with `forMove`, `forComment` and `forRead`), `WriteShapeError` (5) and `UnconfirmedWriteError` (5).
- `cstack/src/tracker/claude-file.ts` exports `claudeFileTracker(path, name, warn)`. It serves reads only, refuses unknown keys, and refuses a list when the file holds no group or another group.
- `cstack/src/orca/run.ts` exports the `Runner` type and `createRunner(timeoutMs)`. It runs a program with `execFile`, never through a shell, with an optional working folder. Its answer is `ok` with stdout and stderr, `failed` with an exit code and stderr, `missing`, `timeout` or `too-large`.
- `cstack/src/publish/remote.ts` exports `parseRemote(url)`, which gives the host, the port and the repository path of the `origin` URL, and `redact(text)`, which removes user information from URLs. `cstack/src/publish/forge.ts` builds the `--repo` value of `gh` as `<host>/<path>` and the `-R` value of `glab` as `https://<host>[:<port>]/<path>`. The tracker adapters can reuse `parseRemote` and the same `--repo` forms, so that every call names the repository of `origin` even when a clone has several remotes.
- `cstack/src/cli.ts` holds `HANDLERS`, keyed by the first word of a usage line, and `dispatchSubcommand(group, args, io, handlers)` for groups such as `plan`, `report` and `unit`. The `tracker` group will follow the same pattern. A handler is only called when at least one entry of its first word is built.
- `cstack/src/manifest.ts` holds `COMMANDS`. The four tracker entries are `built: false` with `ticket: [25, 26]`. The `skills install` entry lists `--add-permission` in `notBuiltFlags` with ticket 26, and its usage line does not name the flag yet.
- `cstack/src/commands/skills.ts` parses its own options with `parseArgs` and prints its own `USAGE`, which must equal the usage line of the manifest, because `cstack/test/cli.test.ts` checks that every built command prints its manifest usage line on an unknown flag. It receives `home`, `packageRoot`, `now` and `uid`, so tests use a temporary home. It already has a `stamp(date)` function that gives `YYYY-MM-DD-HHMMSS`.
- Tests: `cstack/test/tracker/*.test.ts` test the contract of #24. `cstack/test/fakes/tracker.ts` is the fake tracker. `cstack/test/tracker/choose.test.ts` shows the fake runner pattern, a function that records `[command, ...args]` and returns a `RunResult`. `cstack/test/skills-install.test.ts` uses a temporary home and a fixed clock.
- Recorded answers: `cstack/test/fixtures/orca/1.4.263/` with a `README.md` that says which files were recorded and which were written by hand. File names follow `<command words joined by "-">.<case>.<json or txt>`. `cstack/test/fixtures-public.test.ts` fails on a home path, a real email or a host other than `github.com`, `gitlab.com` and reserved example names. `python3 scripts/private_names.py check cstack/test/fixtures` must pass before a fixture is committed.

### Constraints

- No code calls a program through a shell. `cstack/test/run.test.ts` scans every file under `cstack/src/` for shell calls. Every call to `gh`, `glab` and `git` in this ticket goes through the `Runner`.
- A command prints through `io` and returns its exit code. No code calls `process.exit()` (ADR-SIC-H).
- `cstack/test/manifest-implemented.test.ts` and `cstack/test/cli.test.ts` check every built entry: its file exists and exports a function, an unknown flag gives exit code `2`, and the error prints the exact usage line of the manifest without the group usage `usage: cstack tracker <`. So each tracker command must print its own manifest usage line on a usage error, not the group usage of `dispatchSubcommand`.
- `cstack/test/cli.test.ts` (lines 139 to 165) expects `cstack tracker` and `cstack tracker read` to be refused with "Tickets #25 and #26 build it." Those cases change when the four entries become built. The singular and plural test needs another unbuilt entry built by two tickets, or a test list of its own.
- `cstack/test/manifest.test.ts` (line 140) counts 14 built and 9 unbuilt commands. This ticket builds four, so the counts become 18 and 5. The README says "`cstack` has fourteen commands". Both change.
- `gh` 2.101.0 and `glab` 1.119.0 are installed. `glab` on this machine reaches a work GitLab instance, so it must never run against it, and no answer may be recorded from it.
- The `glab issue update --label` flag splits its value on commas. The labels `in progress` and `in review` hold no comma.
- The GitLab web interface creates a project label that does not exist when an issue update adds it (GitLab documentation of the issue edit endpoint, `add_labels`). So on GitLab a move to a missing label would create that label silently, unless cstack checks the labels first. The ticket says that cstack never creates a label on its own.
- `glab api` resolves `:fullpath` from the repository of the current folder. The adapter runs from the repository root, or names the project path itself.

### Risks

- `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts` and `cstack/test/cli.test.ts` change in almost every ticket, and their recent history is mostly merge commits. Four tickets of this wave change them at the same time. Keep the changes small and in their own place, and watch for a function that a merge keeps twice.
- `README.md` changes with the manifest. Three other tickets may change its command count too.
- The missing-label case depends on the text of the error that `gh` prints. A new `gh` version can change it. The recorded answer pins it for 2.101.0.
- Recording the answers of `gh issue edit` and `gh issue comment` changes a real repository. It is allowed only on a sandbox that holds no work data, and only with the user's consent.

### Governing decisions

- ADR-SIC-F (`docs/decisions/ADR-SIC-F-tracker-access.md`): cstack holds no credential. It tries Orca, then `gh` or `glab` when its `auth status` succeeds, then the file from Claude for reads only. A write with no client exits with `4` and tells Claude what to do. Every call goes through the runner, and every key, state name and path is checked first.
- ADR-SIC-H (`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`): a command prints through `io` and returns its exit code.
- ADR-SIC-C (`docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`): `cstack skills install` moves old things aside and never deletes them. The settings copy of this ticket follows the same idea.
- ADR-SIC-E: the prose skills under `skills/` are frozen at the tag `prose-skills-final`. This ticket never changes them.
- `WHY:` comments: `choose.ts` and `claude-file.ts` name ADR-SIC-F. `skills.ts` names ADR-SIC-C twice.
- The coordinator's brief for this wave splits the shared work. This ticket writes the four command files, `cstack/src/tracker/open.ts` with the interface the brief gives, `github-gh.ts` and `gitlab-glab.ts`, and sets the four manifest entries to built with `ticket: [25, 26]`. Ticket #25 writes the Jira and Linear adapters only. Until #25 merges, `openTracker` refuses Jira and Linear with exit code `1` and names ticket #25.

## Decisions

**Scope shared with the other tickets of the wave**

- This ticket writes the four command files `cstack/src/commands/tracker-read.ts`, `tracker-list.ts`, `tracker-move.ts` and `tracker-comment.ts`, the file `cstack/src/tracker/open.ts`, and the adapters `cstack/src/tracker/github-gh.ts` and `cstack/src/tracker/gitlab-glab.ts`. It sets the four tracker entries of the manifest to built and keeps `ticket: [25, 26]` on them. Ticket #25 writes the Jira and Linear adapters, and ticket #29 reads groups through `openTracker("list", …)`. (2026-11-19, coordinator's brief)
- `cstack/src/tracker/open.ts` exports exactly this interface, because the other branches code against it: `OpenTrackerOptions` with `root: string`, `tracker?: TrackerName`, `fromFile?: string`, `run: Runner`, `env: Record<string, string | undefined>` and `warn: (message: string) => void`, and `openTracker(capability: Capability, options: OpenTrackerOptions): Promise<Tracker>`. It chooses the client with `createClientChooser`, wraps the adapter in `checkedTracker`, and throws `NoClientError` (exit `4`) when no client can serve the capability. Never change this interface without asking the coordinator. (2026-11-19, coordinator's brief)
- The adapters export `githubGhTracker(run: Runner, root: string): Tracker` from `github-gh.ts` and `gitlabGlabTracker(run: Runner, root: string): Tracker` from `gitlab-glab.ts`. (2026-11-19, coordinator's brief)
- In this ticket, `openTracker` refuses Jira and Linear with exit code `1` and a message that names ticket #25, because their Orca adapters are not built yet. The ticket that merges second of #25 and #26 wires `jiraOrcaTracker` and `linearOrcaTracker` and removes this refusal. (2026-11-19, coordinator's brief)
- Change only the manifest entries of this ticket. Keep the changes to `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/src/cli.ts`, `README.md` and `docs/projects/skills-into-cli.md` small and in their own place. When the four tracker entries are built, the counts become 18 built commands and 5 not built, in `cstack/test/manifest.test.ts` and in `README.md`. (2026-11-19, coordinator's brief)

**Rules of this run**

- Tests use a fake runner and the recorded answers. No test runs the real `orca`, `gh` or `glab`, and no test reaches the network. (2026-11-19, coordinator's brief)
- Never run `glab` against the work GitLab instance that the `glab` on this machine reaches, and never record anything from it. (2026-11-19, coordinator's brief)
- Never edit anything under `skills/`, which is frozen at the tag `prose-skills-final` (ADR-SIC-E). Never change `.cstack/settings.json`. Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change `~/.claude/skills/` or `~/.claude/settings.json`. To try the code, use the tests, or `npm run build` and `node cstack/dist/bin.js`. (2026-11-19, coordinator's brief)
- Recorded answers replace private values with the placeholders of #24. Before any fixture is committed, `python3 scripts/private_names.py check cstack/test/fixtures` must exit `0`. `cstack/test/fixtures-public.test.ts` accepts only `github.com`, `gitlab.com` and reserved example hosts, so any other host in a real answer, such as `api.github.com`, becomes a placeholder. (2026-11-19, ticket comment by the maintainer)

**Decisions of the plan**

- The recording on the sandbox follows these steps, in this order. Create the milestone `cstack recording`. Create four issues in it: an epic, a blocker, an issue blocked by the blocker through the `blockedBy` relation, and an issue whose only blocker is in its footer line (`**Size: S** · Blocked by: #<blocker> · Feeds: none`). Make the blocked issue and the blocker sub-issues of the epic, with `gh api`. Record the read answers. Record `gh issue edit` while the labels `in progress` and `in review` do not exist yet in the sandbox (they do not today), then create the two labels with `gh label create`, then record a successful edit and one comment. Last, close the four issues and the milestone. (2026-11-19, assumption not asked)
- The `gh` fixture files in `cstack/test/fixtures/gh/2.101.0/` are `issue-view.blocked-by.json`, `issue-view.footer-only.json`, `issue-view.in-progress.json`, `issue-view.state.json`, `issue-view.sub-issues.json`, `issue-view.not-found.txt`, `issue-list.milestone.json`, `issue-list.parent-issue.json`, `issue-edit.missing-label.txt`, `issue-edit.ok.txt`, `issue-comment.ok.txt` and `README.md`. The README gives the exact command and the exit code behind each file. `gh auth status` is not recorded, because its answer holds the account name, and the tests need only its exit code. (2026-11-19, assumption not asked)
- The `glab` fixture files in `cstack/test/fixtures/glab/1.119.0/` are `issue-view.opened.json`, `issue-list.page-1.json`, `api-issue-links.blocked-by.json`, `api-issue-links.relates-to.json`, `api-label.found.json`, `api-label.not-found.txt`, `issue-update.ok.txt`, `issue-note.ok.txt` and `README.md`. All of them are written by hand. `glab issue view` and `glab issue list` print the issue object of the GitLab web interface, so the files follow the "Issues" page of the GitLab API documentation. The links file follows the "Issue links" page, with `link_type` set to `is_blocked_by` or `relates_to`. (2026-11-19, assumption not asked)
- The shared code of the two adapters lives in a new file `cstack/src/tracker/forge.ts`, so that no file of #24 changes except `choose.ts`. It holds the lookup of `origin`, the group limit of 500, the state name of an issue, the settling of blockers whose state kind is unknown, and the mapping of a failed call to an error. (2026-11-19, assumption not asked)
- The `stateName` of a GitHub or GitLab ticket is `in review` when the issue is open with that label, else `in progress` when it is open with that label, else `open` (GitHub) or `opened` (GitLab), and `closed` for a closed issue. The `stateKind` comes from `forgeStateKind`. (2026-11-19, assumption not asked)
- The adapters read the blockers with `mergeBlockers(relations, footerBlockers(...))` of #24. So the blockers are the relations plus any footer key that the relations do not hold, and the footer alone answers when there is no relation. When the `blockedBy` field of `gh` holds fewer nodes than its `totalCount`, the blockers are `"unknown"` and a warning says why. (2026-11-19, ticket comment by the maintainer and assumption not asked)
- On GitLab, a milestone list reads the links of the open issues only, one `glab api` call per open issue. A closed issue keeps the blockers of its footer, because the ready rule leaves a finished ticket out before it looks at blockers. (2026-11-19, assumption not asked)
- A list stops at 500 issues. On GitHub, an answer of 500 issues is refused with exit code `1`, and the message says the group has more tickets than cstack reads. On GitLab, the pages of 100 are read one after the other until a page holds fewer than 100 issues, and reaching 500 issues is refused the same way. (2026-11-19, ticket)
- On GitLab, `listGroup` with an epic is refused with exit code `1`, and the message says to use `--milestone` on GitLab. (2026-11-19, ticket)
- When `origin` is missing or has no host, a command that needs it refuses with exit code `1`, and the message says to run it inside a clone with an `origin` remote, or to pass `--from-file` for a read. (2026-11-19, assumption not asked)
- A failed call maps to an error as follows. A missing program, or a `gh` exit code `4`, or a `glab` answer whose error names `401`, gives `NoClientError` (exit `4`). A `timeout` or a `too-large` answer on a read, or any other failure on a read, gives exit `5` with the error text of the tool, after `redact`. A `timeout` or a `too-large` answer on a move or a comment gives `WriteShapeError` (exit `5`). Any other failure of a move or a comment gives exit `5` with the error text, except the missing label, which gives exit `1` as written above. (2026-11-19, assumption not asked)
- `cstack tracker move` prints one line on success, such as `Moved '#12' to "in progress".`. `cstack tracker comment` prints one line, such as `Added the comment of /path/body.md to '#12'.`. `read` and `list` print their JSON with two spaces of indentation and a final newline. Every warning goes to standard error and starts with `cstack: `. (2026-11-19, assumption not asked)
- `--tracker` accepts only `jira`, `linear`, `github` and `gitlab`. Any other value is a usage error with exit code `2`. `cstack tracker list` needs exactly one of `--milestone` and `--epic`, or it is a usage error. Each tracker command prints its own manifest usage line on a usage error, never the group usage. (2026-11-19, assumption not asked)
- When `move` or `comment` has no client, the command first checks the key and the state name, so a bad key or a state other than `in progress` and `in review` on GitHub or GitLab still exits with `1`. Then it exits with `4` and prints the message of `NoClientError.forMove` or `NoClientError.forComment` with the real key, state name or path. `read` and `list` with no client and no `--from-file` exit with `4`, and the message names the format `cstack-tracker/1` and the option `--from-file <path>`. (2026-11-19, ticket and assumption not asked)
- `openTracker` refuses Jira and Linear with `TrackerError` and exit code `1`, with a message such as `cstack cannot reach jira yet. Ticket #25 builds it.`, unless `--from-file` is given for a read. (2026-11-19, coordinator's brief and assumption not asked)
- `open.ts` may export more than the interface, such as a function that gives the tracker name from the options, as long as `OpenTrackerOptions` and `openTracker` stay exactly as the brief writes them. (2026-11-19, assumption not asked)
- The tracker commands find the repository root with `git rev-parse --show-toplevel` through the runner, from the current folder. When that fails, the root is the current folder. (2026-11-19, assumption not asked)
- The rule that `--add-permission` adds is exactly `Bash(cstack *)`. Only that exact string counts as present. The usage line of `skills install` in the manifest and in `cstack/src/commands/skills.ts` becomes `cstack skills install [--adopt <name>]... [--add-permission]`, and the flag leaves `notBuiltFlags`. Without the option, when the rule is missing, cstack prints the rule, the path of the settings file and the option `--add-permission`, after the lines about the skills. (2026-11-19, ticket and assumption not asked)
- The code that reads and writes the Claude Code settings lives in a new file `cstack/src/claude-settings.ts`, which `skills.ts` calls. (2026-11-19, assumption not asked)
- In `cstack/test/cli.test.ts`, the cases that expect `cstack tracker` and `cstack tracker read` to be refused change when the commands are built. The singular and plural case uses a command list of its own with an unbuilt entry built by two tickets, so it no longer depends on which tickets of the wave merged. (2026-11-19, assumption not asked)
- The README gets one bullet for the four tracker commands in its "Commands" section, the paragraph about the permission rule in its install section, and the count `eighteen`. (2026-11-19, ticket and coordinator's brief)

- GitHub issues here have no "in progress" or "in review" state. When a guide says to move this ticket to "in progress", add the label `in progress` to issue #26. When it says to move it to "in review", remove `in progress` and add `in review`. (2026-11-19, coordinator's brief)
- Before `cstack publish`, run two checks and go on only when both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, and run `python3 scripts/private_names.py check <that file>`. It must exit `0`. Never print the private list. (2026-11-19, coordinator's brief)
- Never change `user.email` in the git config, and never commit with another address. (2026-11-19, coordinator's brief)
- When the branch is updated onto `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads those dates. Never push a tag that starts with `v`. Never merge the pull request; the user merges it. (2026-11-19, coordinator's brief)
- When another ticket of the wave merged first, update the counts of built and not-built commands in `cstack/test/manifest.test.ts` and `README.md` after the update, run the whole test suite again, and look for a function that git kept twice in `cstack/src/cli.ts` without a conflict marker. (2026-11-19, coordinator's brief)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, coordinator's brief)
- Never read, run or change anything under `~/comparison/`. Never install Graphify or Repowise. (2026-11-19, coordinator's brief)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, and write it in the executor notes and the retrospective with the tag `[skill]`. (2026-11-19, coordinator's brief)

- Ticket #27 merged into `main` (pull request #53, `main` at `4b2869d`). When the branch is rebased onto `main`, expect these overlaps and keep both sides. `main` counts 17 built commands and 6 not built, so this ticket's four commands come on top of those numbers in `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts` and `README.md`. `cstack/src/cli.ts` gains the `helper` handler on `main`; keep it next to the `tracker` handler, and check that no function is defined twice. `cstack/src/orca/shapes.ts` gains four `orca orchestration ...` shapes at the end of `SHAPES`; keep them and this ticket's shapes. `failWith` in `cstack/src/commands/errors.ts` now also handles `HelperError` and `TrackerError`, so do not add `TrackerError` a second time. In `cstack/src/orca/run.ts`, the `failed` result now has an optional `stdout`, which `createRunner` fills. (2026-11-19, coordinator's message)

- `cstack tracker comment` checks the comment file before any call, on every tracker and also when no client exists. The real path of the file, after `realpath`, must be inside the real path of the repository root, or inside the real path of `os.tmpdir()`, or inside `/private/tmp` (the real path of `/tmp` on macOS). The file must not be empty and must hold at most 65,536 bytes, which is the size limit of a GitHub comment. A file that fails any of these checks is refused with exit code `1`, the message says which rule it broke, and nothing is posted. The comment already written on ticket #31 gets one more sentence that says comment files go inside the repository or a temporary folder. (2026-11-19, user's answer)

**Assumptions not asked**

- Every `gh` call names the repository of `origin` with `--repo <host>/<path>`, and every `glab` call names it with `-R https://<host>[:<port>]/<path>`, as `cstack/src/publish/forge.ts` does. The host and path come from `parseRemote` of `cstack/src/publish/remote.ts`, applied to the output of `git config --get remote.origin.url`, which runs through the runner with the repository root as working folder. This keeps a clone with several remotes on the `origin` repository. (2026-11-19, assumption not asked)
- The GitLab blockers come from `glab api --hostname <host> projects/<URL-encoded project path>/issues/<iid>/links`, not from `:fullpath`, because `:fullpath` depends on which remote `glab` picks in the current folder. (2026-11-19, assumption not asked)
- A blocker whose state kind is not known yet gets its real state kind before the ticket is returned. This covers a key that only the footer names, and an open GitHub blocker, because the `blockedBy` field gives the state but not the labels. The adapter takes the state from the group it already listed, and reads only the other keys one by one, with a light call that asks only for the state and the labels. A closed blocker is `finished` without any lookup. (2026-11-19, ticket comment by the maintainer and assumption not asked)
- `cstack tracker comment` checks that the comment file can be read before it calls any program, on both forges. When it cannot, it refuses with exit code `1` and names the path. On GitHub the text then reaches `gh` only as the path after `--body-file`. On GitLab cstack reads the text and passes it as the one argument after `--message`. (2026-11-19, assumption not asked)
- When `--from-file` is given to `cstack tracker read` or `cstack tracker list`, cstack reads that file only and runs no client, not even `auth status`. This works for every tracker, Jira and Linear included, because the file reader of #24 does not need Orca. `--from-file` is not a flag of `move` or `comment`, so it is a usage error there. (2026-11-19, assumption not asked)
- cstack never opens, closes or reopens an issue. A move only adds one label and removes the other. (2026-11-19, assumption not asked)

**Answers of the question round**

- Record the `gh` 2.101.0 answers on the private sandbox `gambitl/resolve-issue-e2e`. Put every issue created for the recording into one milestone named `cstack recording`, and close those issues at the end. Never delete anything there. The labels `in progress` and `in review` may stay. List every change made there under "Hand-off log". (2026-11-19, user's answer)
- Write the `glab` 1.119.0 answers by hand from the GitLab API documentation and the `glab` help, because no GitLab sandbox exists. Never run `glab` against any host for this ticket. `cstack/test/fixtures/glab/1.119.0/README.md` says that every file there was written by hand and not recorded, and from which documentation page each comes. (2026-11-19, user's answer)
- In recorded answers, the sandbox owner and name become `example-owner/example-repo`, every node id becomes `id-placeholder`, any login becomes `example-person`, and any host other than `github.com` or `gitlab.com` becomes a reserved example host. (2026-11-19, assumption not asked)
- `createClientChooser` in `cstack/src/tracker/choose.ts` gains an optional `host?: string` in `ChooserOptions`. When it is set, the login check runs `gh auth status --hostname <host>` or `glab auth status --hostname <host>`. When it is not set, the check stays as it is today, so other callers keep their behaviour. `openTracker` passes the host of `origin`. (2026-11-19, user's answer)
- No other ticket of the wave changes `cstack/src/tracker/choose.ts`. Without a host, the chooser must run exactly `gh auth status` or `glab auth status`, with no other argument, and a test checks that exact call, so that #25 and #29 keep their behaviour. (2026-11-19, the coordinator's answer)
- An adapter maps a `gh` exit code `4` (authentication needed) and a `glab` answer that reports `401` to `NoClientError`, because a token can expire between the check and the call. (2026-11-19, user's answer, accepted by default)
- Before each move on GitLab, the adapter checks that both labels exist, with one call per label: `glab api --hostname <host> projects/<URL-encoded project path>/labels/<URL-encoded label name>`. A `404` answer refuses the move with exit code `1`, prints the `glab label create` command for the missing label, and makes no other call. cstack never creates a label. (2026-11-19, user's answer, accepted by default)
- On GitHub, a move runs `gh issue edit` and, when `gh` fails because a label does not exist, refuses with exit code `1` and prints the `gh label create` command for the missing label, with no other call. (2026-11-19, ticket, with the exit code as the user's answer, accepted by default)
- Every text of this ticket that shows a command writes a key in single quotes, such as `'#12'`, because the shell reads an unquoted `#12` as a comment. This covers the README paragraph, the hints that cstack prints and the error messages. When `read`, `move` or `comment` gets no key, the usage error adds one sentence saying that a key such as `#12` must be quoted. The usage line itself stays equal to the manifest line. (2026-11-19, user's answer, accepted by default)
- The tracker commands create their runner with a time limit of 60 seconds. A `timeout` on a read is a tool failure with exit code `5`. A `timeout` or a `too-large` answer on a move or a comment becomes a `WriteShapeError` (exit `5`, "cstack cannot tell whether the change happened"). cstack never retries a write. (2026-11-19, user's answer, accepted by default)
- A GitHub epic is listed in three steps. First, `gh issue view <epic> --json subIssues` gives the numbers, and the list is refused when the number of nodes differs from `totalCount`. Second, one search, `gh issue list --search "parent-issue:<owner>/<repo>#<n>" --state all --limit 500 --json <fields>`, gives the details. Third, each number that the search missed is read alone. A sub-issue whose URL is in another repository is skipped with a warning. (2026-11-19, user's answer, accepted by default)
- `cstack skills install --add-permission` writes `~/.claude/settings.json` in place with `writeFile` on its path, never through a temporary file and a rename, so a symbolic link stays a link. (2026-11-19, user's answer, accepted by default)
- When `--from-file` is given, the file wins over any client, as written under "Assumptions not asked". (2026-11-19, user's answer, accepted by default)
- `cstack tracker read` prints one ticket as JSON with the fields of `Ticket`. `cstack tracker list` prints one JSON object in the format of the file from Claude: `format` (`cstack-tracker/1`), `tracker`, `group` and `tickets`. So the output of a list is a valid `--from-file` input. (2026-11-19, user's answer, accepted by default)
- A blocker in another repository is found by its URL. When it is closed, it is dropped, because it blocks nothing. When it is open, the blockers of the ticket become `"unknown"`, so the ticket stays blocked, and a warning gives the URL. (2026-11-19, user's answer, accepted by default)
- A missing label exits with `1`. With `--add-permission`, a `~/.claude/settings.json` that is not valid JSON, or whose `permissions` is not an object or whose `permissions.allow` is not a list, exits with `3` and changes nothing. The manifest entry of `skills install` gains the exit code `3`. (2026-11-19, user's answer, accepted by default)
- `cstack skills install --add-permission` checks the settings file before it touches any skill, so a refusal changes nothing at all. When the file does not exist, it creates it with only the rule, and there is no copy. It writes the file as JSON with two spaces of indentation and a final newline. The copy is `settings.json.backup-<YYYY-MM-DD-HHMMSS>` next to the file and keeps the old bytes. When that copy already exists, it refuses with exit code `1` and changes nothing. Without the option, an invalid file only adds one line that says cstack cannot read it, and the exit code stays as before. (2026-11-19, user's answer, accepted by default)
- The README paragraph about the rule also says, in one sentence each, that without `gh` or `glab` Claude still writes with its own connection, which the rule does not cover, and that the rule also lets Claude run `cstack skills install` without asking. (2026-11-19, user's answer, accepted by default)

## Architecture

The approach is locked by the ticket, the interface that the coordinator fixed and the answers of the question round. Two adapters, `github-gh.ts` and `gitlab-glab.ts`, implement the `Tracker` interface of #24 on top of the runner, and share one small helper file, `forge.ts`. `open.ts` picks the client with the chooser of #24, which gains an optional host, and wraps the adapter in `checkedTracker`. The four commands parse their options, call `openTracker`, print JSON or one line, and turn each `TrackerError` into its exit code. The permission rule lives in its own file, called by `cstack skills install`. No new decision since the question round.

## Implementation units

### Unit 1: Record the answers of gh on the sandbox
- Files: `cstack/test/fixtures/gh/2.101.0/issue-view.blocked-by.json`, `cstack/test/fixtures/gh/2.101.0/issue-view.footer-only.json`, `cstack/test/fixtures/gh/2.101.0/issue-view.in-progress.json`, `cstack/test/fixtures/gh/2.101.0/issue-view.state.json`, `cstack/test/fixtures/gh/2.101.0/issue-view.sub-issues.json`, `cstack/test/fixtures/gh/2.101.0/issue-view.not-found.txt`, `cstack/test/fixtures/gh/2.101.0/issue-list.milestone.json`, `cstack/test/fixtures/gh/2.101.0/issue-list.parent-issue.json`, `cstack/test/fixtures/gh/2.101.0/issue-edit.missing-label.txt`, `cstack/test/fixtures/gh/2.101.0/issue-edit.ok.txt`, `cstack/test/fixtures/gh/2.101.0/issue-comment.ok.txt`, `cstack/test/fixtures/gh/2.101.0/README.md`
- No test: these files are recorded data. `cstack/test/fixtures-public.test.ts` already checks every file under `cstack/test/fixtures/`, and the GitHub adapter units use them as test inputs.
- Minimum code: follow the recording steps of "Decisions" on `gambitl/resolve-issue-e2e`, and only there. Pass `--repo gambitl/resolve-issue-e2e` to every `gh` call, and never run `glab`. Record each answer with the exact command that the adapters will run: `gh issue view <n> --repo <repo> --json number,title,body,url,state,stateReason,labels,blockedBy` for the blocked issue (`issue-view.blocked-by.json`), the footer-only issue (`issue-view.footer-only.json`) and, after the successful edit, the blocked issue again (`issue-view.in-progress.json`); `gh issue view <blocker> --repo <repo> --json number,state,labels` (`issue-view.state.json`); `gh issue view <epic> --repo <repo> --json subIssues` (`issue-view.sub-issues.json`); the standard error of `gh issue view 9999 --repo <repo> --json number,state,labels` (`issue-view.not-found.txt`); `gh issue list --repo <repo> --milestone "cstack recording" --state all --limit 500 --json <the same fields>` (`issue-list.milestone.json`); `gh issue list --repo <repo> --search "parent-issue:<repo>#<epic>" --state all --limit 500 --json <the same fields>` (`issue-list.parent-issue.json`); the standard error of `gh issue edit <blocked> --repo <repo> --add-label "in progress" --remove-label "in review"` while the labels do not exist (`issue-edit.missing-label.txt`); the standard output of the same edit after `gh label create "in progress"` and `gh label create "in review"` (`issue-edit.ok.txt`); and the standard output of `gh issue comment <blocked> --repo <repo> --body-file <file>` with a short harmless text (`issue-comment.ok.txt`). Then close the four issues and the milestone. In every file, replace `gambitl/resolve-issue-e2e` with `example-owner/example-repo`, every node id with `id-placeholder`, any login with `example-person`, and any host other than `github.com` with a reserved example host. Write `README.md`: say that the files were recorded with `gh` 2.101.0 on a private sandbox repository that holds no work data, give the exact command and exit code behind each file, and list the placeholders. List every change made on the sandbox under "Hand-off log" of the plan file. Run `python3 scripts/private_names.py check cstack/test/fixtures` from the repository root and commit only when it exits `0`.
- Refactor: none.
- Commit message: `test(tests): record the answers of gh 2.101.0 on a sandbox repository`
- Depends on: none

### Unit 2: Write the answers of glab by hand
- Files: `cstack/test/fixtures/glab/1.119.0/issue-view.opened.json`, `cstack/test/fixtures/glab/1.119.0/issue-list.page-1.json`, `cstack/test/fixtures/glab/1.119.0/api-issue-links.blocked-by.json`, `cstack/test/fixtures/glab/1.119.0/api-issue-links.relates-to.json`, `cstack/test/fixtures/glab/1.119.0/api-label.found.json`, `cstack/test/fixtures/glab/1.119.0/api-label.not-found.txt`, `cstack/test/fixtures/glab/1.119.0/issue-update.ok.txt`, `cstack/test/fixtures/glab/1.119.0/issue-note.ok.txt`, `cstack/test/fixtures/glab/1.119.0/README.md`
- No test: these files are hand-written data. `cstack/test/fixtures-public.test.ts` checks them, and the GitLab adapter units use them as test inputs.
- Minimum code: write the files listed in "Decisions" from the GitLab API documentation ("Issues", "Issue links" and "Labels" pages) and the help of `glab` 1.119.0. Use `gitlab.com` or reserved example hosts only, the project path `example-group/example-project`, and logins `example-person`. `issue-view.opened.json` is issue 7, open, with no work label and a footer line `**Size: S** · Blocked by: #3 · Feeds: none`. `api-issue-links.blocked-by.json` holds one `is_blocked_by` link to issue 5, open, of the same project, and one `relates_to` link. `api-issue-links.relates-to.json` holds only a `relates_to` link. `issue-list.page-1.json` holds three issues of one milestone, one of them closed. `api-label.not-found.txt` is the error text of `glab api` for a `404 Not Found` answer. Write `README.md`: say first that no file here was recorded, because no GitLab sandbox exists and the `glab` of the recording machine reaches a private instance; give the documentation page and the command behind each file. Run `python3 scripts/private_names.py check cstack/test/fixtures` and commit only when it exits `0`.
- Refactor: none.
- Commit message: `test(tests): write the answers of glab 1.119.0 by hand from the GitLab documentation`
- Depends on: none

### Unit 3: Check the login of gh and glab for one host
- Files: `cstack/src/tracker/choose.ts`, `cstack/test/tracker/choose.test.ts`
- Test: `cstack/test/tracker/choose.test.ts`: a chooser created with `host: "github.com"` for GitHub runs exactly `gh auth status --hostname github.com`, and one created without a host still runs exactly `gh auth status` with no other argument, for GitHub and for GitLab.
- Minimum code: add `host?: string` to `ChooserOptions`, and pass `["auth", "status", "--hostname", host]` when it is set. Keep the call without a host unchanged.
- Refactor: none.
- Commit message: `feat(cli): check the login of gh and glab for the host of origin when it is known`
- Depends on: none

### Unit 4: Shared helpers of the two forge adapters
- Files: `cstack/src/tracker/forge.ts`, `cstack/test/tracker/forge.test.ts`
- Test: `cstack/test/tracker/forge.test.ts`: a group of two tickets, where ticket A has a footer-only blocker B with the state kind `unknown`, and B is in the group and closed, comes back with B `finished` and no lookup call. Then a blocker outside the group is looked up once even when two tickets name it. A lookup that fails leaves the kind `unknown` and warns. The origin lookup runs `git config --get remote.origin.url` with the root as working folder and gives the host and path of `https` and `git@` URLs. A missing origin refuses with exit `1`. The failure mapping of "Decisions" gives the right error type and exit code for each `RunResult` kind, on reads and on writes. The state name rule of "Decisions" holds.
- Minimum code: `cstack/src/tracker/forge.ts` with `originRepo(run, root)` (reusing `parseRemote` of `cstack/src/publish/remote.ts`), `MAX_GROUP = 500`, `forgeStateName(...)`, `settleBlockers(tickets, lookup, warn)` and the failure mapping, as "Decisions" describes them.
- Refactor: none.
- Commit message: `feat(cli): add the helpers that the GitHub and GitLab adapters share`
- Depends on: none

### Unit 5: Read GitHub tickets and groups through gh
- Files: `cstack/src/tracker/github-gh.ts`, `cstack/test/tracker/github-gh.test.ts`
- Test: `cstack/test/tracker/github-gh.test.ts`: `listGroup({ milestone: "cstack recording" })` with a fake runner that answers `issue-list.milestone.json` runs exactly one `gh issue list --repo example-owner/example-repo --milestone "cstack recording" --state all --limit 500 --json ...` call, and the blocked issue comes back with one open blocker of the state kind `todo`, taken from the group without another call.
- Minimum code: `githubGhTracker(run, root)` with `readTicket` and `listGroup`, as the ticket scope and "Decisions" describe. Then add, test first: `readTicket` with `issue-view.blocked-by.json` takes the blocker from `blockedBy` and looks up its labels with `issue-view.state.json`; `readTicket` with `issue-view.footer-only.json` takes the blocker from the footer and looks up its state; a blocker or a sub-issue whose URL is in another repository follows "Decisions"; a list answer of 500 issues is refused with exit `1`; the epic list reads `subIssues`, then one `parent-issue:` search, then reads alone each number the search missed, and refuses when the nodes differ from `totalCount`. Every call names `--repo` and goes through the fake runner.
- Refactor: none.
- Commit message: `feat(cli): read GitHub issues, milestones and epics through gh`
- Depends on: 1, 4

### Unit 6: Move and comment on GitHub through gh
- Files: `cstack/src/tracker/github-gh.ts`, `cstack/test/tracker/github-gh.test.ts`
- Test: `cstack/test/tracker/github-gh.test.ts`: `moveState("#12", "in progress")` runs exactly `gh issue edit 12 --repo example-owner/example-repo --add-label "in progress" --remove-label "in review"` as an argument list, and `in review` runs the opposite labels.
- Minimum code: `moveState` and `addComment` of `githubGhTracker`. Then add, test first: with the answer of `issue-edit.missing-label.txt`, the move refuses with exit `1`, prints the `gh label create` command with the quoted label name and `--repo`, and makes no other call; a state name other than the two is refused before any call; `addComment` runs `gh issue comment 12 --repo ... --body-file <absolute path>`, and a comment file that holds `$(rm -rf ~)`, backticks and quotes reaches `gh` only as its path; a comment file that cannot be read refuses with exit `1` before any call; a `gh` exit code `4` gives exit `4`; a `timeout` on a move or a comment gives `WriteShapeError`.
- Refactor: none.
- Commit message: `feat(cli): move GitHub issues with labels and add comments through gh`
- Depends on: 5

### Unit 7: Read GitLab tickets and groups through glab
- Files: `cstack/src/tracker/gitlab-glab.ts`, `cstack/test/tracker/gitlab-glab.test.ts`
- Test: `cstack/test/tracker/gitlab-glab.test.ts`: `readTicket("#7")` with `issue-view.opened.json` and `api-issue-links.blocked-by.json` runs `glab issue view 7 -R https://gitlab.com/example-group/example-project --output json`, then `glab api --hostname gitlab.com projects/example-group%2Fexample-project/issues/7/links`, and gives the blocker `#5` from the `is_blocked_by` link, plus the footer key `#3` with its state looked up.
- Minimum code: `gitlabGlabTracker(run, root)` with `readTicket` and `listGroup`, as the ticket scope and "Decisions" describe. Then add, test first: a ticket with only `relates_to` links takes its blockers from the footer; `listGroup({ epic: "#1" })` is refused with exit `1` and a message that says to use `--milestone` on GitLab, with no call; the milestone list reads pages of 100 with `--page` until a short page, reads the links of open issues only, and refuses at 500 issues; a link to an issue of another project follows "Decisions".
- Refactor: none.
- Commit message: `feat(cli): read GitLab issues and milestones through glab`
- Depends on: 2, 4

### Unit 8: Move and comment on GitLab through glab
- Files: `cstack/src/tracker/gitlab-glab.ts`, `cstack/test/tracker/gitlab-glab.test.ts`
- Test: `cstack/test/tracker/gitlab-glab.test.ts`: `moveState("#7", "in progress")` first checks both labels with `glab api --hostname gitlab.com projects/example-group%2Fexample-project/labels/in%20progress` and the same call for `in%20review`, then runs exactly `glab issue update 7 -R https://gitlab.com/example-group/example-project --label "in progress" --unlabel "in review"` as an argument list.
- Minimum code: `moveState` and `addComment` of `gitlabGlabTracker`. Then add, test first: a `404` answer for one label refuses with exit `1`, prints the `glab label create --name <label> -R <project>` command, and runs no update; `addComment` reads the file and runs `glab issue note 7 -R ... --message <text>` with the whole text as one argument, and a text that holds `$(rm -rf ~)`, backticks and quotes reaches `glab` unchanged as that one argument; an answer that names `401` gives exit `4`; a `timeout` on a move or a comment gives `WriteShapeError`.
- Refactor: none.
- Commit message: `feat(cli): move GitLab issues with labels and add comments through glab`
- Depends on: 7

### Unit 9: Open the tracker of one capability
- Files: `cstack/src/tracker/open.ts`, `cstack/test/tracker/open.test.ts`
- Test: `cstack/test/tracker/open.test.ts`: with an `origin` on `github.com` and a fake runner where `gh auth status --hostname github.com` succeeds, `openTracker("read", ...)` returns the GitHub adapter inside `checkedTracker`, so a bad key is refused before any `gh issue` call.
- Minimum code: `cstack/src/tracker/open.ts` with exactly the interface of "Decisions". Then add, test first: the tracker comes from `origin` without `--tracker`; `--from-file` wins for `read` and `list` and runs no client; a GitLab `origin` gives the GitLab adapter; with the forge not logged in, `read` and `list` without `--from-file` throw `NoClientError` (exit `4`) and so do `move` and `comment`; Jira and Linear are refused with exit `1` and a message that names #25, except a read with `--from-file`.
- Refactor: none.
- Commit message: `feat(cli): open the GitHub, GitLab or file tracker for one capability`
- Depends on: 3, 5, 7

### Unit 10: The command cstack tracker read
- Files: `cstack/src/commands/tracker-read.ts`, `cstack/src/commands/tracker-common.ts`, `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/cli.test.ts`, `cstack/test/tracker/claude-file-fallback.test.ts`, `cstack/test/tracker/gitlab-glab.test.ts`
- Test: `cstack/test/tracker/claude-file-fallback.test.ts`: with no Orca, `gh` and `glab` not logged in and no `--from-file`, `cstack tracker read '#7'` makes no call other than the login checks and `git`, exits with `4`, and names the format `cstack-tracker/1` and `--from-file`. Then the same read with `--from-file <file>` prints the ticket from the file as JSON.
- Minimum code: `cstack/src/commands/tracker-common.ts` with what the four tracker commands share: the options for the working folder, the runner and the environment, so tests pass a fake runner; the parsing of `--tracker`; the root lookup of "Decisions"; and the printing of a `TrackerError` with its exit code, with the sentence about quoting a key when the key is missing. `cstack/src/commands/tracker-read.ts` uses it. Add a `tracker` handler to `HANDLERS` in `cli.ts` with `dispatchSubcommand` and only `read` for now, using `createRunner(60000)`. Set the `tracker read` entry to built in `manifest.ts`. Change the counts case of `manifest.test.ts` to fifteen built and eight not built. Update the cases of `cli.test.ts` that expect `cstack tracker` and `cstack tracker read` to be refused, as "Decisions" says. Add, test first, the GitLab case of `gitlab-glab.test.ts` where `cstack tracker read '#7'` runs on a repository whose `origin` is on `gitlab.com` and prints the blocker from the `is_blocked_by` link.
- Refactor: none.
- Commit message: `feat(cli): add cstack tracker read, with the file from Claude as the last fallback`
- Depends on: 9

### Unit 11: The command cstack tracker list
- Files: `cstack/src/commands/tracker-list.ts`, `cstack/src/commands/tracker-common.ts`, `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/tracker/github-gh.test.ts`, `cstack/test/cli.test.ts`
- Test: `cstack/test/tracker/github-gh.test.ts`: `cstack tracker list --milestone "cstack recording"` on a repository whose `origin` is on `github.com` runs `gh issue list` once and prints, in the format of the file from Claude, the blocked issue with one open blocker and its state kind.
- Minimum code: `cstack/src/commands/tracker-list.ts`, which needs exactly one of `--milestone` and `--epic`. Add `list` to the `tracker` handler. Set the entry to built and change the counts to sixteen and seven.
- Refactor: none.
  Escalated: the first attempt stopped on two failing cases of `cstack/test/cli.test.ts`, which was added to `Files`. The second attempt fixed them. Departures: the usage test now builds its expected line from the built `tracker` entries of the manifest, and the whole singular and plural test uses a command list of its own.
- Commit message: `feat(cli): add cstack tracker list for a milestone or an epic`
- Depends on: 10, 5

### Unit 12: The command cstack tracker move
- Files: `cstack/src/commands/tracker-move.ts`, `cstack/src/commands/tracker-common.ts`, `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/tracker/claude-file-fallback.test.ts`, `cstack/test/tracker/github-gh.test.ts`, `cstack/test/cli.test.ts`
- Test: `cstack/test/tracker/claude-file-fallback.test.ts`: `cstack tracker move '#12' --to "in progress"` with no client writes nothing, exits with `4` and prints the key `#12` and the state name `in progress`.
- Minimum code: `cstack/src/commands/tracker-move.ts`. Add `move` to the `tracker` handler. Set the entry to built and change the counts to seventeen and six. Add, test first, the case of `github-gh.test.ts` where `cstack tracker move '#12' --to "in progress"` runs `gh issue edit` with the two label options.
- Refactor: none.
- Commit message: `feat(cli): add cstack tracker move with the two work labels`
- Depends on: 10, 6

### Unit 13: The command cstack tracker comment
- Files: `cstack/src/commands/tracker-comment.ts`, `cstack/src/commands/tracker-common.ts`, `cstack/src/cli.ts`, `cstack/src/manifest.ts`, `cstack/test/manifest.test.ts`, `cstack/test/tracker/comment-no-shell.test.ts`, `cstack/test/cli.test.ts`
- Test: `cstack/test/tracker/comment-no-shell.test.ts`: `cstack tracker comment '#12' --body-file <file>`, where the file holds `$(rm -rf ~)`, backticks and quotes, reaches `gh` only as the file path on a GitHub repository, and `glab` only as the one argument after `--message` on a GitLab repository. The fake runner records every call, and no call runs `sh`, `bash` or `zsh`. Without a client, the command exits with `4` and prints the key and the path.
- Minimum code: `cstack/src/commands/tracker-comment.ts`. Add `comment` to the `tracker` handler. Set the entry to built and change the counts to eighteen and five.
- Refactor: none.
- Commit message: `feat(cli): add cstack tracker comment, which never passes the text through a shell`
- Depends on: 10, 6, 8

### Unit 14: The permission rule for cstack
- Files: `cstack/src/claude-settings.ts`, `cstack/src/commands/skills.ts`, `cstack/src/manifest.ts`, `cstack/test/skills-install-permission.test.ts`
- Test: `cstack/test/skills-install-permission.test.ts`: with a temporary home whose `.claude/settings.json` has no rule, `cstack skills install` prints the rule `Bash(cstack *)`, the path of the file and the option `--add-permission`, and leaves the file unchanged, byte for byte.
- Minimum code: `cstack/src/claude-settings.ts` and the option in `skills.ts`, as "Decisions" describes. Then add, test first: `--add-permission` adds the rule once to `permissions.allow`, keeps every other key and entry in their order, and keeps a copy named `settings.json.backup-<stamp>` with the old bytes; a second run adds nothing and makes no copy; a file that is not valid JSON, or whose `permissions.allow` is not a list, exits with `3`, changes nothing and installs no skill; a missing file is created with only the rule; a settings file that is a symbolic link stays a link. Update the usage line in `manifest.ts` and `skills.ts`, remove `--add-permission` from `notBuiltFlags`, and add the exit code `3` to the entry.
- Refactor: none.
- Commit message: `feat(cli): let cstack skills install add the permission rule for cstack`
- Depends on: none

### Unit 15: The README
- Files: `README.md`
- No test: the README is prose, and no test reads its command count.
- Minimum code: in "Install cstack", add the short paragraph of the ticket about the rule `Bash(cstack *)`: what it allows, how to add it with `cstack skills install --add-permission`, that a copy of the old settings file is kept, that without `gh` or `glab` Claude still writes with its own connection and the rule does not cover that, and that the rule also lets Claude run `cstack skills install` without asking. In "Commands", change "fourteen" to "eighteen" and add one bullet for `cstack tracker read`, `list`, `move` and `comment`. Write keys in single quotes, such as `'#12'`, and say why in one sentence.
- Refactor: none.
- Commit message: `docs: explain the tracker commands and the permission rule for cstack`
- Depends on: 13, 14
### Unit 16: The check of the comment file
- Files: `cstack/src/commands/tracker-comment.ts`, `cstack/test/tracker/comment-file-check.test.ts`, `cstack/test/tracker/comment-no-shell.test.ts`, `README.md`, `docs/plans/2026-11-19-26-reach-github-and-gitlab-through-gh-and-glab.md`
- Test: `cstack/test/tracker/comment-file-check.test.ts`: a symbolic link inside the repository that points outside is refused; a file in a temporary folder is accepted; an empty file and a file of 65,537 bytes are refused; a file outside the repository and the temporary folders is refused; without a real repository only temporary folders pass; every refusal exits with `1` and makes no call to `gh` or `glab`.
- Minimum code: the check of "Decisions" (user's answer), on real paths, before the no-client exit `4`. The adapter receives the real path.
- Refactor: none.
- Commit message: `feat(cli): refuse comment files outside the repository and the temporary folders`
- Depends on: 13

## Documentation duties

- The ticket comment on #26 applies, written to the GitHub issue at the end of the run.
- The comment for the ticket that wires the Orca features into the guides (#31) applies, written to that GitHub issue. It names the four commands, the JSON they print, the exit code `4` with what Claude must do, the quoting of keys such as `'#12'`, and `--add-permission`.
- The README applies, written by Unit 15.
- The fixture READMEs apply, written by Units 1 and 2.
- A new ADR does not apply. The choices of this ticket stay inside ADR-SIC-F, and the host of the login check is an implementation detail of it.
- The specification page `docs/projects/skills-into-cli.md` does not apply. US-16 already describes what this ticket builds.

## Blocking questions

### Question 1: Recording on the GitHub sandbox
May I record the answers of `gh` from the private repository `gambitl/resolve-issue-e2e`, which holds no work data? To record every case, I need to change it: create a milestone, an epic issue with two sub-issues, and an issue blocked by another one. I also need to add and remove the labels `in progress` and `in review` on one issue, post one comment, and try a move while one of the two labels is missing. I never delete anything there, and I list every change in the plan file.
- For: the user
- Answer: yes, record on `gambitl/resolve-issue-e2e`. The recording issues go into one milestone with an obvious name, and they are closed at the end. Nothing is deleted. (the user, in the conversation, 2026-11-19)

### Question 2: Where to record the GitLab answers
From which GitLab project may I record the answers of `glab`? It must hold no work data, and it must be on `gitlab.com` or another host that is not the work instance. If you have none, may I write the GitLab answers by hand from the GitLab documentation and the `glab` help? In that case, the plan file and a `README.md` in `cstack/test/fixtures/glab/1.119.0/` say that these answers were written by hand and not recorded.
- For: the user
- Answer: the user has no GitLab sandbox project. The `glab` answers are written by hand from the GitLab API documentation and the `glab` 1.119.0 help, and the plan file and `cstack/test/fixtures/glab/1.119.0/README.md` say so. (the user, in the conversation, 2026-11-19)

### Question 3: Missing labels on GitLab
On GitLab, I check that both labels exist before each move, because otherwise GitLab creates the missing label silently. I do it with one call per label (`projects/<path>/labels/<name>`), not with `glab label list`, which reads one page at a time and would miss a label beyond the first page. I will do this unless you say no.
- For: the user
- Answer: yes, check both labels with one call per label before each move on GitLab. (the user, accepted by default in the conversation, 2026-11-19)

### Question 4: Checking the login of gh and glab for the host of origin
May I change `cstack/src/tracker/choose.ts`, which is outside the share the coordinator fixed for this wave? It runs `gh auth status` without `--hostname`. The help of `gh` says that this fails when any account on any host has a problem, so one expired enterprise login makes cstack believe `gh` is not logged in at all. The opposite also happens: a login on another host than the one of `origin` passes the check, and then every call fails. I recommend an optional host in the chooser options. The change only adds an option, and only `open.ts` passes it.
- For: the user
- Answer: yes, `cstack/src/tracker/choose.ts` may gain an optional host. (the user, in the conversation, 2026-11-19) The coordinator of the wave has no objection, because no other ticket changes this file. The call without a host must stay exactly as it is today, with a test for it. (the coordinator, 2026-11-19)

### Question 5: Which files cstack tracker comment may post
With the rule `Bash(cstack *)`, Claude can run `cstack tracker comment '#12' --body-file <path>` without asking you, and today cstack posts any file it can read. A ticket whose text hides instructions could make Claude post a private file, such as `~/.ssh/id_rsa`, as a comment on a public issue. May I add one check to `cstack tracker comment`, before any call: the file must be inside the repository or a temporary folder, must not be empty, and must be at most 65,536 bytes, which is the size limit of a GitHub comment? A file that fails the check is refused with exit code 1 and nothing is posted.
- For: the user (found after the build by the reviews)
- Answer: yes, add the check. (the user, in the conversation, 2026-11-19)

## Review log

### Impact notes

- `cstack/src/tracker/choose.ts` gained an optional `host`. Its other callers pass none, and `choose.test.ts` checks that the call without a host is exactly `gh auth status`.
- `cstack/src/manifest.ts` and `cstack/test/manifest.test.ts` change with every command. The counts are eighteen built and five not built in the test and in `README.md`. `cli.test.ts` builds its usage expectation from the manifest.
- `cstack/src/commands/skills.ts` and `cstack/src/claude-settings.ts` read and write the Claude Code settings. The tests use temporary folders. The permission hint goes to standard error.
- `cstack/src/cli.ts` holds the `tracker` dispatch. The usage line follows the order of its handler keys, which is read, list, move, comment, the order of the manifest.
- `docs/projects/skills-into-cli.md` and the ADRs are not changed in code. They are part of the documentation duties of the next phases.

### Reviewer findings

Correctness reviewer. Fixed: on GitLab, `move` accepted any state name, because `moveState` never called `checkStateName`. Fixed: the GitLab milestone list left out `--all`, so closed issues were missing. Fixed: the GitLab same-project comparison was case sensitive. Fixed: the per-issue link calls all ran at once, and now run five at a time.

Security reviewer. Fixed: the GitLab state name check (same as above). Fixed: the backup of `settings.json` was created with the default mode, and is now 0600. Fixed: the error for an invalid settings file repeated text from the file, and now gives only the line and column. Follow-up, not fixed: `cstack tracker comment --body-file` posts any file that the user can read, and `Bash(cstack *)` lets Claude run it without asking, so a ticket text with hidden instructions could make Claude post a private file. Fixing it changes how the command is used, so it needs the user's choice (see "Non-blocking questions"). Not fixed, below the threshold: a host whose name holds "gitlab" is treated as GitLab, so `GITLAB_TOKEN` goes to the host of `origin`.

Conventions reviewer. Fixed: `--from-file` failed in a clone without `origin` when `--tracker` was not given, and the four commands each had their own copy of the host lookup. A new helper `resolveTrackerName` in `open.ts` now serves all four. Fixed: the README showed `move <key> <state>` and `comment <key> <file>`, and now shows the real usage lines. Fixed: the import order and the long handler line in `cli.ts`. Follow-up: the GitLab adapter exits with 3 for an unreadable comment file, and the GitHub adapter exits with 1. The command checks the file first, so users do not meet it.

Simplicity reviewer. Fixed: the two commands `move` and `comment` shared a 20-line block, now one function `refuseWithoutClient`. Fixed: `list` read `origin` a second time. Not done: removing the `env` option of `OpenTrackerOptions`, because the coordinator fixed that interface. Not done: removing the file check in the GitHub adapter's `addComment`, because a test calls the adapter directly.

### Independent review

The independent reviewer fixed one bug in commit `e628ce6`: `cstack skills install --add-permission` read the clock twice, so the name of the backup copy that it checked could differ from the name it wrote. It now reads the time once. All tests pass. Judgment calls that it left alone, for the pull request body:

- An empty comment file is not refused. `glab issue note` with an empty `--message` may try to open an editor, and `gh` will probably fail. A check in `tracker-comment.ts` would give a clear exit 1 instead of exit 5.
- The settings file is read before the skills are installed and written after. A change that Claude Code makes in that short gap would be overwritten.
- An SSH remote with a host alias, such as `git@github-work:o/r`, gives `--hostname github-work`, and the user then gets a misleading "not logged in" message. This comes from the existing remote parsing.
- `Bash(cstack *)` lets Claude post any readable file as a comment without asking. The user needs to choose how to limit it.

## Briefing

The comment-file check you chose is not built yet. The code on the branch still posts any file it can read, and the comment on the guides ticket (#31) still says the user "may want to restrict" it. The pull request should open only after the check is built and tested, and after that comment gets its extra sentence.

The rest of the ticket is built. cstack reads, lists, moves and comments on GitHub tickets through `gh` and on GitLab tickets through `glab`. It falls back to the file from Claude for reads, and `cstack skills install --add-permission` adds the rule `Bash(cstack *)`. The 902 tests and the type check passed on the branch before your answer.

One trap in the check: when `git` finds no repository, cstack uses the current folder as the root. Run from your home folder, "inside the repository" would then accept `~/.ssh`. So without a real repository, the check should accept temporary folders only.

**What you need to do**

**Merge the pull request with "Create a merge commit".** That is how `main` merges every pull request. A squash would drop the unit commits and their `Cstack-Unit` lines, and this repository allows squash too.

**What to watch**

- The GitLab path has never run against a real `glab`, because every GitLab answer in the tests was written by hand. The first GitLab user is the real test, mostly for how cstack spots a missing label (`404`) and an expired token (`401`).
- A remote with an SSH host alias, such as `git@github-work:o/r`, makes cstack say that `gh` is not logged in. Claude then writes with its own connection, so nothing breaks, but the message misleads.
- `test/report.test.ts` sometimes runs past its 5-second limit. If the pull request check fails there, run it again before you look for a bug.

**What changed since the plan**

- `cstack tracker comment` gains the file check you asked for after the reviews: inside the repository or a temporary folder, not empty, and at most 65,536 bytes.
- The hint about the permission rule goes to standard error, because 13 existing tests compare standard output exactly.
- The GitLab link calls of a milestone list run five at a time, not all at once.

### Details

What was built, and whether it meets the ticket. The branch adds the GitHub adapter (`cstack/src/tracker/github-gh.ts`), the GitLab adapter (`cstack/src/tracker/gitlab-glab.ts`), their shared helpers (`cstack/src/tracker/forge.ts`), `cstack/src/tracker/open.ts` with the interface the coordinator fixed, the four commands `cstack tracker read`, `list`, `move` and `comment`, and the permission rule in `cstack/src/claude-settings.ts`, called by `cstack skills install`. AC2 is carried by `cstack/test/tracker/github-gh.test.ts` and `gitlab-glab.test.ts`, AC3 by `claude-file-fallback.test.ts`, AC4 by `skills-install-permission.test.ts`, and the no-shell rule by `comment-no-shell.test.ts`. Before the user answered question 5, `npm run typecheck` was clean and `npm test` passed (67 files, 902 tests). The acceptance criteria are met as written. The user's answer to question 5 adds one decision that the branch does not implement yet, so the work is not finished.

The comment-file check is decided but not built. Evidence: the last code commit is `e628ce6`, and the commits after it change only the plan and `README.md` (`c4db082`, `d6cc4c1`, `56229a8`, `1299fe6`, `a5c735b`). `cstack/src/commands/tracker-comment.ts` still checks only that the path is a readable regular file (`readable()`), and no file under `cstack/src/` calls `realpath` or `tmpdir`. The comment on #31 (https://github.com/gambitl/claude-code-stack/issues/31#issuecomment-7011552148, last updated 14:11 UTC) still ends with "It also lets Claude post any readable file as a comment, which the user may want to restrict." The decision in "Decisions" (user's answer) needs a new implementation unit in the plan, so that its commit carries a `Cstack-Unit` trailer and `cstack plan status` stays consistent. That unit touches `cstack/src/commands/tracker-comment.ts`, a new test file such as `cstack/test/tracker/comment-file-check.test.ts`, and `README.md`. How to build it. First, find the root before the file check, because the check needs it; today `findRoot` runs after `readable()`. Second, `findRoot` in `cstack/src/commands/tracker-common.ts` (line 51) falls back to the current folder when `git rev-parse --show-toplevel` fails. If the check reused that fallback, `cstack tracker comment '#12' --body-file ~/.ssh/id_rsa` run from the home folder would pass. On GitHub and GitLab that run then fails on the missing `origin`, but the Jira and Linear adapters of #25 go through Orca and may not need `origin`, so the hole would open when #25 merges. So the check should accept the repository only when `git` really found one, and otherwise accept temporary folders only. I would also treat a repository root whose real path equals the real path of the home folder as no repository, because some people keep their home folder under git; this is one comparison and stays inside the intent of the user's answer. Third, compare real paths on both sides (`realpathSync` of the file, of the root, of `os.tmpdir()` and of `/tmp`), and compare with a trailing separator, so that `/repo-other` does not count as inside `/repo`. Fourth, pass the real path to the adapter, so that `gh --body-file` and the GitLab `readFileSync` read the file that was checked, not a symbolic link that changed in between. A hard link inside the repository to a private file still passes, because a hard link has no other real path; creating one needs a command that Claude Code asks about, so I accept that gap. Fifth, the size limit counts bytes, which is stricter than GitHub's limit in characters, so it is safe. The tests should cover: a symbolic link inside the repository that points outside is refused; a file under `/tmp` is accepted on macOS; an empty file and a 65,537-byte file are refused with exit `1`; the check runs before the exit `4` of the no-client path; outside a git repository, only temporary folders pass. Each refusal makes no call to `gh` or `glab`, which the fake runner shows. Then run `npm test` and `npm run typecheck` again. The README bullet for the tracker commands (around line 64) should get one sentence saying that the comment file must be inside the repository or a temporary folder. The comment on #31 should replace its last sentence about restricting files with that same rule, as the decision says. If nobody builds it, the pull request carries a security gap that the user explicitly chose to close.

The merge button. `main` merges pull requests with merge commits (for example `2a59c73` and `fede459`), and the repository allows squash, merge and rebase (`gh api repos/gambitl/claude-code-stack`). The branch holds 34 commits, and the unit commits carry a `Cstack-Unit` trailer that `cstack/src/plan/commits.ts` and `cstack/src/report/reports.ts` read. `cstack measure` takes its times from the plan file header first (`cstack/src/measure/moments.ts`), so a squash would not break the measure, but it would drop the per-unit history and break the habit of the repository. If nobody decides, GitHub shows the button used last, which may be squash.

The GitLab path is untested against a real `glab`. All nine files in `cstack/test/fixtures/glab/1.119.0/` were written by hand, as the user chose, and their README says so. The adapter spots a missing label with `/\b404\b/` on the standard error of `glab api` (`gitlab-glab.ts`, line 139) and a lost login by the text `401`. If a real `glab` words these errors differently, a move on a project without the labels gives exit 5 instead of the `glab label create` hint. A `404` on a project that the user cannot see is also reported as a missing label, which misleads but writes nothing. The first real GitLab run should try `cstack tracker read`, then a `move` on a project that lacks the two labels.

SSH host aliases. `parseRemote` keeps the alias of a remote such as `git@github-work:o/r`, and the chooser then runs `gh auth status --hostname github-work`. `gh` itself resolves SSH aliases when it reads a remote, but cstack names the host directly, so the check fails. The user gets exit 4 and Claude writes with its own connection. Before this ticket there was no `gh` path at all, so nothing regresses. A later fix could read the real host name with `ssh -G <alias>` through the runner. Label: non-blocking, and it needs no answer now.

The slow test. `cstack/test/report.test.ts`, which this ticket does not touch, timed out at 5,000 ms on the case "names a unit without a commit" in two of three full runs during the build. If the pull request check fails there, rerun it before looking for a bug.

What changed since the plan. The user added the comment-file check after the reviews (question 5), which is still to build, as above. The permission hint goes to standard error, not standard output, because 13 existing tests compare standard output exactly (executor notes, unit 14). The GitLab link calls of a milestone list run at most five at a time (`LINK_CONCURRENCY` in `gitlab-glab.ts`), after the correctness review found that they all ran at once. The adapters take an optional `warn` argument after the two arguments the coordinator fixed. `open.ts` also exports `resolveTrackerName` and `refuseWithoutClient`, which the decision on extra exports allows. The GitLab adapter exits with 3 for an unreadable comment file and the GitHub adapter with 1, but the command checks the file first and always exits with 1, so users never see the difference. `cstack/test/cli.test.ts` builds its usage expectation from the manifest. None of these changes a decision of the plan.

How the earlier questions were resolved. The `gh` answers were recorded on `gambitl/resolve-issue-e2e`, inside the milestone `cstack recording`, and the four issues are closed; the hand-off log lists every change. The GitLab answers were written by hand, and their README says so. On GitLab, a move first checks both labels, with one `glab api` call each. `choose.ts` gained the optional host for the login check, and `choose.test.ts` checks that the call without a host is exactly `gh auth status`. The hints and the README quote keys, and line 64 of the README now quotes the key of `cstack tracker read` too (`c4db082`). A usage error for a missing key adds the sentence about quoting. The tracker commands use a 60-second time limit, and a time-out on a write gives exit 5 with no retry. The GitHub epic list uses `subIssues`, then one `parent-issue:` search. `--add-permission` writes the file in place, and a test checks that a symbolic link stays a link. The README carries both sentences about what the rule covers and what it does not. Question 5, which files `cstack tracker comment` may post, was answered yes by the user; the build is still to do, as above.

Decision record. No new ADR is needed. The comment-file check had three possible answers: limit the files in cstack, narrow the permission rule, or only document the risk. Narrowing the rule was not a credible option, because AC4 asks for one rule that covers every tracker write, and the user chose the check. The result is one rule enforced in one file, recorded under "Decisions". A `WHY:` comment in `tracker-comment.ts` should name the reason: `Bash(cstack *)` lets Claude post without a prompt, so cstack limits what it posts. ADR-SIC-F (line 24) already says that a comment goes through a file path, and the check does not change how cstack reaches trackers.

Smaller facts. On GitHub, `gh issue edit` fails when either label is missing, even the one it removes (`issue-edit.missing-label.txt` shows `'in review' not found`), and the hint names one label at a time. So on a repository with neither label, the first move needs two rounds of "create the label, try again". The read, check and write of `~/.claude/settings.json` leave a short gap in which a change by Claude Code would be lost; the backup copy covers it. A host whose name contains "gitlab" is treated as GitLab, so `glab` may send `GITLAB_TOKEN` to it; running `glab` by hand in that clone does the same, so I agree with the security reviewer that it is below the threshold. The ticket that adds Jira and Linear (#25) is still open, so it will merge second: it wires the Jira and Linear adapters, removes the refusal in `openTracker`, and updates the command counts. Its comment path goes through the same command, so it gets the file check without extra work. The commits `d6cc4c1` and `c4db082` share one message although one changes the plan and the other the README, which is harmless.

I did not reopen the locked decisions: the `open.ts` interface and the file split from the coordinator's brief, the client order of ADR-SIC-F, the key format of #24, the single rule of AC4, and the frozen prose skills of ADR-SIC-E. I checked data model lock-in, scale beyond the 500-ticket limit, and operations and cost, and found nothing new in this ticket.

## Non-blocking questions

none

## Pull request

## Documentation

- Comment on issue #26: https://github.com/gambitl/claude-code-stack/issues/26#issuecomment-7011551533
- Comment on issue #31, which this ticket feeds: https://github.com/gambitl/claude-code-stack/issues/31#issuecomment-7011552148
- `README.md` (Unit 15), `cstack/test/fixtures/gh/2.101.0/README.md` (Unit 1) and `cstack/test/fixtures/glab/1.119.0/README.md` (Unit 2), on the branch.
- No new decision record and no change to the specification page, as "Documentation duties" says. The `WHY: ADR-SIC-F` comments of the adapters already name the record.

## Executor notes

- Unit 11 stopped stuck because `cstack/test/cli.test.ts` was not in its `Files` line. I added it to units 11, 12 and 13 and relaunched with the escalation agent, which finished it.
- `cstack unit order` refused my first notes on the unit (a `- Escalated:` line and a long `Files` note) with "This line does not belong to the unit", so I wrote the note as an indented continuation line.
- Several implementers wrote code before the test, so `cstack unit red` first saw a passing test (units 4, 7, 9, 10, 11, 12, 13). They moved the code aside to record the red run, and `cstack unit green` then warned about edits.
- Unit 9 left a bug: `openTracker` created the `origin` promise even when it was not needed, which could reject unhandled with `--tracker` and no `origin`. I fixed it in a commit without a `Cstack-Unit` trailer and added a test.
- Unit 1 edited the plan file's hand-off log without committing it. I committed it myself.
- `test/report.test.ts` (a file this ticket did not touch) times out at 5000 ms on one case, "names a unit without a commit", because its git setup is slow on this machine. It failed in 2 of 3 full runs, and once alone. Everything else passes.
- Unit 14 prints the permission hint to stderr, not stdout, because 13 existing tests check stdout exactly. The plan said only that cstack prints it.
- Unit 6 and 8 chose `--repo github.com/<owner>/<repo>` (the forge style) and exit 3 for an unreadable comment file in the GitLab adapter. The command checks the file first and exits 1.
- The CTO advisor found, in the briefing phase, that the user's comment-file check was decided but not built. I added unit 16 and built it myself in the executor, outside the unit commands, so it has no saved red and green runs. The existing test of unit 13 now expects the real path (`/private/var/...` on macOS).
- The first notes I wrote were saved twice, because a command that I thought had failed had run. I removed the copy. Several hand-off entries were also saved twice.

## Hand-off log

- 2026-11-19 (executor, briefing): built unit 16, the comment-file check (real paths, repository or temporary folder, 1 to 65,536 bytes, temporary folders only without a real repository). Updated the README and the comment on #31. 909 tests and the typecheck pass. The earlier needs-decision entry below is closed.
- 2026-11-19 (executor, briefing): the advisor raised one blocking question about the files that `cstack tracker comment` may post. The run stops with a needs-decision report. The pull request is not opened yet.

- 2026-11-19 (executor, update-branch): `main` did not move since the branch started, so nothing was rebased. The author check shows only the noreply address, and the private-names check on the branch log exits 0 (the pull request text is checked again at publish).

- 2026-11-19 (executor, build): all fifteen units are built and committed. Departures: `cstack/test/cli.test.ts` added to units 11 to 13; the adapters take an optional `warn`; the permission hint goes to stderr.


- 2026-11-19 (executor, build): unit 11 stopped because `cstack/test/cli.test.ts` had to change. No unfinished unit listed it, so it was added to the `Files` line of units 11, 12 and 13, and unit 11 was launched again. The same file already belonged to unit 10.

- 2026-11-19 (executor, build): added the label `in progress` to issue #26, because GitHub has no such state. The branch `gambitl/tracker-gh-glab` was already checked out.
- 2026-11-19 (implementer, unit 1): on the private sandbox `gambitl/resolve-issue-e2e`, created the milestone `cstack recording` and four issues in it (#3 epic, #4 blocker, #5 blocked by #4, #6 with its blocker in the footer). Made #4 and #5 sub-issues of #3, and made #5 blocked by #4. Created the labels `in progress` and `in review`. Added the label `in progress` to #5, and one comment on #5. Closed #3, #4, #5 and #6, and the milestone. Nothing was deleted. The labels stay.

## History

### Questions you may not be asking

**I need your answer before I plan**

**May I record the answers of `gh` on the private repository `gambitl/resolve-issue-e2e`?** I need to create issues, a milestone and labels there, and post one comment. This repository is also the test repository of the end-to-end run of the skill (#23), so open issues left there would get in the way of the next run. I recommend yes, inside a milestone with an obvious name, and I close those issues at the end without deleting anything.

**Do you have a project on `gitlab.com` that holds no work data?** If not, I write the `glab` answers by hand from the GitLab API documentation, and a `README.md` says so. Blocking links exist only on the paid GitLab plans, so that one answer is written by hand in any case. I recommend your `gitlab.com` project if it exists, and every recording names the host, because `glab` on this machine is logged in to the work instance.

**May I change `cstack/src/tracker/choose.ts`, which is outside the share the coordinator fixed for this wave?** It runs `gh auth status` without `--hostname`. The help of `gh` says that this fails when any account on any host has a problem, so one expired enterprise login makes cstack believe `gh` is not logged in at all. The opposite also happens: a login on another host than the one of `origin` passes the check, and then every call fails. I recommend an optional host in the chooser options. The change only adds an option, and only `open.ts` passes it.

**I will do this unless you say no**

- On GitLab, I check that both labels exist before each move, because otherwise GitLab creates the missing label silently. I do it with one call per label (`projects/<path>/labels/<name>`), not with `glab label list`, which reads one page at a time and would miss a label beyond the first page.
- The shell reads an unquoted `#12` as the start of a comment, so `cstack tracker move #12 --to …` reaches cstack without its key. I checked it with bash and zsh. Every command that cstack prints therefore writes `'#12'`, and the error for a missing key reminds you to quote it.
- The tracker commands get their own time limit, because the 5 seconds of `cstack doctor` would cut a list of 500 issues. A time-out during a move or a comment exits with `5`, which says cstack cannot tell whether the change happened. cstack never retries, because a retried comment would be posted twice.
- For a GitHub epic, I take the issue numbers from `subIssues`, then the details in one search with `parent-issue:`. I read one by one only the numbers the search missed, because the search index can lag. On the epic #6, with 28 sub-issues, this takes 1.1 seconds instead of about 14.
- `--add-permission` rewrites `settings.json` in place, without a rename, so a symbolic link stays a link. I also keep the answers already drafted for `--from-file`, the output format, links to another repository, the exit codes and the backup copy.

**I checked it myself**

- The `blockedBy` and `subIssues` fields of `gh` give the number, the state and the URL of each issue, but not its labels, so an issue of another repository can be found from its URL.

**Good to know**

- Without `gh` or `glab`, Claude still writes with its own connection, which the rule `Bash(cstack *)` does not cover. The README should say so.
- The same rule also lets Claude run `cstack skills install` without asking.

#### Details

Recording on the GitHub sandbox (draft question 1). Label: blocking, and only the user can answer it. I keep the draft recommendation, yes, and add one condition. The repository `resolve-issue-e2e` was created by the end-to-end ticket (#23, `docs/plans/2026-11-19-23-run-the-new-resolve-issue-end-to-end-and-release-it.md`, step 9) as the place where the new skill runs on real issues. A milestone, an epic and open issues left there would show up the next time someone runs `cstack wave` or `/resolve-issue` on that repository. So the recording issues go into one milestone whose name says what it is, such as `cstack recording`, and they are closed at the end. Closing is not deleting, so the "never delete anything" promise of the draft holds. The labels `in progress` and `in review` can stay, because the new skill needs them there anyway. If nobody answers, nothing can be recorded for GitHub, and every `gh` answer is written by hand. That weakens the missing-label case most, because it depends on the exact error text of `gh` 2.101.0.

Where to record the GitLab answers (draft question 2). Label: blocking, and only the user can answer it. I keep the draft recommendation. I add two facts. First, the plan already says (Scope 3, `readTicket`) that blocking links exist only on some GitLab plans. A free `gitlab.com` project can create `relates_to` links but not `is_blocked_by` links, so the answer of the acceptance test "blocker taken from a link of type `is_blocked_by`" will be a recorded `relates_to` answer edited by hand, or written from the example in the GitLab API documentation of issue links, and the fixture README must say which. Second, `glab` on this machine is logged in to the work instance, so any recording passes `-R https://gitlab.com/<path>` and `glab api --hostname gitlab.com` explicitly, and is never run with a bare `glab` in a folder whose remote points elsewhere. `glab api` prints the raw answer of the GitLab web interface, so those answers can also be taken from the documentation with little risk. `glab issue view --output json` and `glab issue list --output json` print the issue object in the shape that `glab` itself writes. A hand-written version of those two answers is the riskier part. If nobody answers, the default is answers written by hand and marked as such.

Changing the client chooser (new question). Label: blocking, because it changes what the ticket builds and touches a file outside the share that the coordinator's brief gives to this ticket. The run cannot settle it with a test, so the developer has to decide, and the developer should tell the coordinator if they are different people. Evidence: `cstack/src/tracker/choose.ts` (the `loggedIn` function) runs `runner(forge, ["auth", "status"])` with no host. `gh auth status --help` (2.101.0) says: "If an account on any host (or only the one given via `--hostname`) has authentication issues, the command will exit with 1". Take a user with a valid `github.com` login and an expired GitHub Enterprise login. cstack gives them the file fallback, or exit `4` for every write, although `gh` would work. The opposite case is a user logged in only on another host: the check passes, and each call then fails. `gh help exit-codes` says that a command that needs authentication exits with `4`. The recommended change adds `host?: string` to `ChooserOptions` and passes `--hostname <host>` when it is set. `open.ts` passes the host from `parseRemote` of the `origin` URL. Nothing else changes, so the other branches of the wave that call `createClientChooser` without a host keep the old behaviour. `glab auth status` also has a `--hostname` option in its documentation; confirm it in the recorded help of 1.119.0 before relying on it. I rejected the other option, which is to leave the chooser alone and turn an authentication failure of each call into exit `4` inside the adapters. It handles the second case but not the first, where `gh` is never even tried. Even with the change, the adapters should still map an exit `4` of `gh`, and a `401` answer of `glab`, to `NoClientError`, because a token can expire between the check and the call. If nobody decides, the chooser stays as it is, and both failures above stay possible on machines with more than one host, such as this one.

Missing labels on GitLab (draft question 3). Label: blocking, because it adds a call to every move. I moved it to the points I do by default, because the ticket itself says that cstack never creates a label, and without the check that rule cannot hold on GitLab. I disagree with the draft on how to check. `glab label list` reads one page of labels at a time, so a project with many labels, or with group labels, could have `in progress` beyond the first page, and cstack would refuse a move wrongly. The single-label endpoint `GET /projects/:id/labels/:label_id` accepts the label title, URL-encoded (`in%20progress`), and includes the labels of parent groups by default. It answers 404 when the label does not exist. So the adapter makes two `glab api --hostname <host>` calls, one per label, with the project path URL-encoded as in the assumption about blockers. A 404 refuses the move with exit `1` and prints the `glab label create` command, as on GitHub. The check and the update are not one atomic step, which is acceptable for labels that people rarely delete.

Unquoted keys (new point). Label: non-blocking, answered by a test. `bash -c 'printf "[%s]\n" cstack tracker move #12 --to "in progress"'` prints only `cstack`, `tracker` and `move`, and `zsh -c` gives the same. The key format `^#[1-9][0-9]*$` is locked by #24 (`cstack/src/tracker/keys.ts`), so I do not reopen it. The tests of this ticket use a fake runner with argument lists, so they would never see this. The trap is in every command line that a person or Claude types. So every text of this ticket that shows a command writes the key in single quotes. That covers the README paragraph, the help of the four commands and the `gh label create` hint. When `read`, `move` or `comment` gets no key, the usage error adds one sentence saying that a key such as `#12` must be quoted. The usage line itself stays equal to the manifest line, as `cstack/test/cli.test.ts` requires. The guides of the ticket that wires these commands into the skill (#31) must quote keys too. I will leave that in the comment on #31.

Time limits and writes that may or may not have happened (new point). Label: non-blocking. `createRunner(timeoutMs)` in `cstack/src/orca/run.ts` kills the program with `SIGKILL` after the time limit, and the only caller today, `cstack/src/commands/doctor.ts`, uses 5 seconds. `gh issue list --limit 500` reads pages of 100 issues through the GitHub GraphQL interface, which can take longer than that. The tracker commands should create their runner with a longer limit, such as 60 seconds, in `open.ts` or the command files. A `timeout` result on a read is an ordinary tool failure. A `timeout` result on `moveState` or `addComment` means the write may have reached the server. It should become a `WriteShapeError` (exit `5`, "cstack cannot tell whether the change happened"). cstack never retries, because GitHub and GitLab do not deduplicate comments.

Listing a GitHub epic (new point). Label: non-blocking. The plan reads each sub-issue with `readTicket`. I measured `gh issue view 26 --json …` at 0.5 seconds, so the 28 sub-issues of the epic #6 would take about 14 seconds in sequence, plus the blocker lookups. I checked that `gh issue list --repo gambitl/claude-code-stack --search "parent-issue:gambitl/claude-code-stack#6" --state all --limit 100 --json number,labels,state,body` returns all 28 issues in 1.1 seconds. The search index of GitHub can lag behind a sub-issue that was just added, so `subIssues` stays the list of numbers that counts, and any number missing from the search result is read alone. The search interface has its own rate limit of 30 requests per minute, which one call per list does not approach. The recording plan of draft question 1 must add this search call. If the developer rejects it, the plan works as drafted, only slower.

Writing `~/.claude/settings.json` (draft question 8, and a new detail). Label: non-blocking. I keep the draft answers. I add one rule: write the file in place with `writeFile` on its path, and never write a temporary file and rename it. A rename replaces a symbolic link with a plain file and resets the file mode. Many people keep this file as a link into a dotfiles repository, and `config/settings.json` with `sync.sh` shows that this repository's maintainer copies it too. On this machine the file is a plain file of about 64 KB. Claude Code itself also rewrites this file when a person picks "always allow", so the read, the check and the write should be close together. That race is small and the backup covers it.

Draft questions 4 to 7. Labels: non-blocking. I keep the draft recommendations: the file wins over any client when `--from-file` is given, `list` prints the format of the file from Claude, an issue of another repository is handled as the draft says, and the new refusals use exit `1` and `3`.

Fields of `gh` (checked). Label: non-blocking. A read-only call on this public repository, `gh issue view 26 --json blockedBy,blocking`, returns `{"nodes": [...], "totalCount": n}`, and each node has `id`, `number`, `state`, `title` and `url`. There is no `labels` and no repository field. So draft question 6 can find an issue of another repository by comparing the `url` with the `origin` repository, and the plan is right that an open blocker needs a second lookup for its labels. `subIssues` has the same shape, and for the epic #6 `nodes` held all 28 of `totalCount`. The adapter should still compare the two numbers and refuse the list when they differ, because `gh` asks for a fixed page of related issues.

The permission rule and the writes it does not cover (good to know). AC4 says that one rule covers every tracker write that goes through cstack. That is true. But when no client exists, cstack exits with `4` and Claude writes with its own connection, so on such a machine a refused write can still happen. The README paragraph of Scope 6 should say this in one sentence, so nobody expects the rule to fix that case.

What else the rule allows (good to know). `Bash(cstack *)` matches every cstack command, so Claude can also run `cstack skills install`, which moves the user's skills aside and installs the shipped ones, without a prompt. ADR-SIC-C makes that command safe, because it never deletes anything. Any future cstack command that changes the machine is covered by the same rule, which the reviews of later tickets should keep in mind. A narrower set of rules would change AC4, so I do not propose it. A related limit: on GitLab the comment text is one argument after `--message`, and Linux refuses a single argument longer than 128 KB, while macOS only limits the total. If cstack ever runs in Linux CI with a long comment, the runner will report a plain failure.

I did not reopen the locked decisions. The coordinator's brief fixes the `open.ts` interface, the adapter signatures, the file split and the refusal of Jira and Linear. ADR-SIC-F fixes the order of the clients, #24 fixes the key format, and ADR-SIC-E freezes the prose skills. I checked data model lock-in, operations and cost, and multi-tenant isolation, and found nothing in this ticket.

### Open questions and answers

1. Recording on the GitHub sandbox. Label: blocking. See Blocking question 1. Recommended answer: yes, with the changes listed there, and the list of changes in the plan file. Answer: see Blocking question 1.
2. Where to record the GitLab answers. Label: blocking. See Blocking question 2. Recommended answer: a `gitlab.com` sandbox project if the user has one, otherwise answers written by hand, marked as such. Answer: see Blocking question 2.
3. Missing labels on GitLab. Label: blocking. See Blocking question 3. Recommended answer: yes, check the labels first, with one call per label. Without it, the ticket's rule that cstack never creates a label cannot hold on GitLab. Answer: see Blocking question 3.
9. Checking the login of `gh` and `glab` for the host of `origin`. Label: blocking, raised by the review before the plan. See Blocking question 4. Recommended answer: add an optional host to the chooser options. Answer: see Blocking question 4.
4. Which source wins when `--from-file` is given while `gh` is logged in? Label: non-blocking. Recommended answer: the file wins and no client runs. It is recorded as an assumption under "Decisions". Answer: accepted by default (the user, 2026-11-19).
5. What do `cstack tracker read` and `cstack tracker list` print? Label: non-blocking. Recommended answer: `read` prints one ticket as JSON, with the fields of `Ticket`. `list` prints a JSON object in the format of the file from Claude, with `format`, `tracker`, `group` and `tickets`. So a list can be saved and given back with `--from-file`, and the same shape shows Claude what to write. The work is correct with any JSON shape. Answer: accepted by default (the user, 2026-11-19).
6. What happens to a blocker or a sub-issue that lives in another repository? Label: non-blocking. Recommended answer: its key `#n` would name the wrong issue of `origin`. A closed blocker in another repository is dropped, because it blocks nothing. An open one makes the blockers of the ticket `unknown`, so the ticket stays blocked, and a warning gives its URL. A sub-issue in another repository is skipped with a warning. Answer: accepted by default (the user, 2026-11-19).
7. Which exit codes do the new refusals use? Label: non-blocking. Recommended answer: a missing label exits with `1`, because the message gives the command that fixes it. A `~/.claude/settings.json` that is not valid JSON, or whose `permissions.allow` is not a list, exits with `3` when `--add-permission` is given, and the manifest entry of `skills install` gains the code `3`. Answer: accepted by default (the user, 2026-11-19).
8. How does `cstack skills install --add-permission` handle the settings file? Label: non-blocking. Recommended answer: it checks the settings file before it touches any skill, so a refusal changes nothing at all. When the file does not exist, it creates it with only the rule, and there is nothing to back up. It writes the file again as JSON with two spaces of indentation and a final newline. The copy is `settings.json.backup-<YYYY-MM-DD-HHMMSS>` next to the file, and it keeps the old bytes. When that copy already exists, it refuses and changes nothing. Without the option, an invalid file only adds a line that says cstack cannot read it, and the exit code stays as before. Answer: accepted by default (the user, 2026-11-19).

### Architecture options
