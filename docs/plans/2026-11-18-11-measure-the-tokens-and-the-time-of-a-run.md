# Plan: #11 — M1-5: Measure the tokens and the time of a run with cstack measure

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/11
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in docs/projects/), ADRs in docs/decisions/
Branch: gambitl/cstack-measure
Conversation language: French
Status: ready for review

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Give the maintainer a command that says how much of the Claude subscription and how much time one run of the skill used, so that two versions of the skill can be compared with numbers.

- **What the title means**: A token is the unit in which Claude counts the text it reads and writes. The subscription quota is spent in tokens. A run is one use of the `resolve-issue` skill on one ticket, from the first question to the finished code. During a run, the skill writes a plan file that says what it will build, and the user approves it before the build starts. `cstack measure` is a new command of `cstack`, the command-line tool of this project. It reads the records that Claude Code keeps on the computer. It adds up the tokens of one run and of its helpers, which are the extra agents that the run starts. It also gives the time between the approval of the plan and the moment the work is ready for review.
- **Why we are doing it**: The project must show that the new version of the skill uses fewer tokens and less time than today's version. Without one command that measures both versions in the same way, the comparison would be guesswork.
- **For the user**: The maintainer gets the numbers of a run with one command. Nothing private leaves the computer, because the command prints numbers only.

**Goal.** This ticket adds `cstack measure <plan file>`, which prints the four kinds of tokens and the waiting time of one run, including runs made before `cstack` existed, for US-4. Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #7 creates the package and its entry point.
* **Session files (on the machine, not in this repository)**: Claude Code writes one file per conversation at `~/.claude/projects/<folder named after the working directory>/<session id>.jsonl`. The format is JSON Lines, which means one JSON object per line. The transcript of each helper sits at `~/.claude/projects/<same folder>/<session id>/subagents/agent-<agent id>.jsonl`, next to a file `agent-<agent id>.meta.json`. A helper started by another helper, such as an implementer started by the executor, sits in the same `subagents/` folder. Its meta file carries the keys `parentAgentId` and `spawnDepth`. These facts come from file names and key names on the maintainer's machine, not from any content.
* **Keys to read**: Each line has a `type`. A line whose `type` is `assistant` carries `message.id` and `message.usage`. The usage holds the four fields `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` and `output_tokens`. Lines also carry `cwd`, the working folder, and `timestamp`. Helper lines also carry `agentId` and `isSidechain`.
* **Traps in those files**: One answer of the model is often written on several lines that share the same `message.id`, and each line repeats its usage. When the repeats differ, only `output_tokens` grows, so keep the last one. In the main session, the `toolUseResult` of a helper call carries a `usage` and a `totalTokens` that repeat the helper's tokens. `usage.cache_creation`, `usage.iterations` and the `modelUsage` totals also repeat numbers that the four fields already hold. Count none of them.
* **Approval moment**: `skills/resolve-issue/agents/executor.md` (line 39): The executor commits the plan file as the first commit of the branch, right after the approval. `skills/resolve-issue/SKILL.md` (line 158) shows that the approval happens just before the executor starts.
* **Ready-for-review moment**: `skills/resolve-issue/agents/executor.md` (line 99): At the end of the build, the executor sets the Status of the plan to "ready for review" and commits it. `skills/resolve-issue/templates/plan.md` (line 9) lists the values of the `Status:` line in the plan header.
* **Rebase**: `skills/resolve-issue/agents/executor.md` (line 57): The executor may rebase the branch onto its target branch. A rebase keeps the author date of each commit but rewrites its committer date, so read the author date.
* **Plan file path**: `skills/resolve-issue/SKILL.md` (line 68): The plan file lives at `docs/plans/<YYYY-MM-DD>-<ticket-id>-<short-slug-of-the-title>.md`, in the repository of the ticket.
* **The story**: `docs/projects/skills-into-cli.md` (lines 85 to 92): US-4 lists the acceptance criteria, and this ticket carries all of them. Line 27 asks to compare each kind of token on its own. Line 295 names the four usage fields.

## Scope

1. Add `cstack measure <plan file>`. The plan file must be committed in a git repository. The repository root is the folder that `git rev-parse --show-toplevel` gives for it.
2. Read the approval moment from the git history of the plan file. It is the author date of the commit that added the file.
3. Read the ready-for-review moment from the same history. It is the author date of the earliest commit in which the `Status:` line of the plan file reads `ready for review`. Read each version of the file in memory with `git show`, and look only at that line.
4. When the header of the plan file holds a `Format:` line, stop with a message. The message says that this version of `cstack measure` reads only plan files made before `cstack`. #13 defines the new format, which records both moments directly.
5. Find the main session files of the run. A file directly under a folder of `~/.claude/projects/` counts when two things are true. First, one of its lines has a `cwd` equal to the repository root or inside it, after you resolve both paths through symbolic links. Second, the span from its first to its last `timestamp` overlaps the span from the approval to "ready for review".
6. Two runs in the same folder at the same time cannot be told apart by this rule. #12 therefore gives each run its own folder.
7. For each main session that counts, add every helper transcript in its `subagents/` folder. Nested helpers are already in that folder, so you do not need to follow `parentAgentId`.
8. Add up the four kinds of tokens over the lines whose `type` is `assistant`. Count each `message.id` once, and keep the usage of its last line. Ignore `toolUseResult`, `usage.cache_creation`, `usage.iterations` and `modelUsage`.
9. Read the files line by line, because a session file can be large. Skip a line that is not valid JSON, and count it.
10. Print fixed labels and numbers only, one per line. The lines give the number of main sessions, the number of helper transcripts, each of the four kinds of tokens, the minutes from approval to "ready for review", and the number of skipped lines. Never print a path under `~/.claude/projects/`, because its folder names hold the paths of working folders.
11. When a moment is missing, for example because the run never reached "ready for review", print the tokens anyway. Then say that the moment is missing, and exit with code 1.
12. The command takes the home folder as an input, so tests use a temporary folder.
13. Write the fixtures by hand in `cstack/test/fixtures/measure/`. Never copy a real session file into this repository, because real sessions hold work content.

## Acceptance (TDD)

* `cstack/test/measure.test.ts`: Write first the case "one main session, one helper and one nested helper". It fails, because the command does not exist yet. Then each of the four totals equals the sum in the fixture. The counts say 1 main session and 2 helper transcripts.
* Same file: an answer written on three lines with the same `message.id` counts once, with the `output_tokens` of its last line.
* Same file: a `toolUseResult` that carries `usage` and `totalTokens` adds nothing.
* Same file: a session whose `cwd` is another folder adds nothing. A session that starts after "ready for review" adds nothing either.
* Same file: the test builds a temporary git repository. A first commit adds the plan file with a set author date. A later commit sets its Status to "ready for review". The waiting time equals the difference in minutes. After a rebase that changes the committer dates, the result stays the same.
* Same file: a plan file that never reached "ready for review" prints the tokens, says that the moment is missing, and exits with code 1. A plan file with a `Format:` line is refused with the message of step 4.
* Same file, negative: the fixtures hold a unique marker string in message text, in `cwd`, in `gitBranch` and in a tool result. Neither standard output nor standard error ever holds that marker. Every output line is a fixed label followed by digits.
* Same file, negative: the temporary home folder holds exactly the same files before and after a run, so the command copies nothing. Another case reads the source files of the command and fails when they import a network module or call `fetch`.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: M** · Blocked by: #7 · Feeds: #12


Ticket comment by the maintainer (2026-11-17), copied verbatim:

> Ticket #7 is done. Here is the shape of the code you add to.
> 
> A command is a function that prints through an `io` argument and returns its exit code. The top-level function is `run(args, io)` in `cstack/src/cli.ts`, and `io` has `stdout` and `stderr`. Each command gets its own file in `cstack/src/commands/`, and parses its own options. Exit code 2 means a usage error and exit code 1 means a crash. No code calls `process.exit()`, because on macOS it can cut output that goes into a pipe. Tests call `run` with a fake `io`, as `cstack/test/cli.test.ts` shows. The compiled command starts from `dist/bin.js`.
> 

### Decisions already taken upstream

From the epic "Skills into CLI" (#6), block "Open questions and decisions", the parts that concern this ticket, copied verbatim:

> **Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

> - ADR-SIC-B, where the run state lives and how its format is versioned, is to create. This choice is still open. Ticket #13 writes it.

The epic's open questions 1 to 8 concern other tickets. Question 6 (the minimum Node version) is already settled by #7: it lives only in `engines.node` of `cstack/package.json`.

ADRs that govern this ticket:

- ADR-SIC-H, how a `cstack` command starts and ends: [`docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`](../decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md). `src/bin.ts` is the only file that touches the process. `run(args, io)` is asynchronous, prints through `io` and returns the exit code. A usage error returns 2, a crash gives 1. No code calls `process.exit()`.
- ADR-SIC-E, the new role of the repository: [`docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`](../decisions/ADR-SIC-E-new-role-of-the-repository.md). The repository is public and is the source of `cstack`.

The specification is `docs/projects/skills-into-cli.md`. US-4 is at lines 85 to 92, the success measures at lines 21 to 33 (line 27 compares each kind of token on its own), and the four usage fields at line 295.

## Dependencies

Dependencies: clear. The only blocker is #7, which is closed (checked 2026-11-18 through GitHub's "blocked by" relation and the footer). Tickets #9 and #10 of the same wave run at the same time in other worktrees. All three add a command file in `cstack/src/commands/` and register it in `cstack/src/cli.ts`, and #9 and #10 also edit `cstack/package.json` and `README.md`.

## Code mapping

Graphify is not installed on this machine (`which graphify` finds nothing), so the code was mapped by reading files. The `cstack` package is small: four source files and one test file, all read in full.

**`cstack/src/cli.ts`** (40 lines). `run(args, io = processIo)` returns a `Promise<number>`. With no argument it prints `USAGE` to stderr and returns 2. Any first argument that does not start with `-` is refused as `unknown command "<name>"` with exit code 2 (line 26), so a new command must be dispatched before that line. `USAGE` (lines 5 to 11) ends with the sentence "No command exists yet.", which this ticket must change. `parseArgs` from `node:util` parses the options in strict mode. The comment at lines 37 to 38 says the command runs outside the `try` block, so a crash reaches `bin.ts` as exit code 1 and is not taken for a usage error.

**`cstack/src/io.ts`**: `type Io = { stdout(text): void; stderr(text): void }` and `processIo`, which writes to the process streams. **`cstack/src/bin.ts`**: the entry point, which sets `process.exitCode` and prints `cstack: <message>` on a throw. **`cstack/src/commands/version.ts`**: the only command today, `version(io)`, which reads `package.json` at run time.

**`cstack/test/cli.test.ts`**: a `collect()` helper builds a fake `io` that gathers stdout and stderr into strings. Tests call `run([...], io)` and check the text and the exit code. There is no vitest config file, so vitest uses its defaults and finds `test/*.test.ts`.

**Configuration.** `cstack/package.json` has no runtime dependency, `"type": "module"`, `engines.node` `>=26`, and the scripts `test` (vitest run), `typecheck` (tsc --noEmit) and `build`. `tsconfig.json` is strict, `module` and `moduleResolution` are `nodenext`, so relative imports need the `.js` extension. Node on this machine is v26.10.0 and git is 2.55.0.

**CI.** `.github/workflows/ci.yml` runs one job, `cstack`, on `macos-latest`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, then `node dist/bin.js --version`. So the tests run on macOS with git available.

**The skill moments.** In `skills/resolve-issue/agents/executor.md`, line 39 commits the plan file as the first commit of the branch, line 57 may rebase the branch, and line 99 sets the Status to "ready for review" and commits it. `skills/resolve-issue/templates/plan.md` line 9 is the template's Status line. It reads `Status: draft | waiting for answers | questions answered | approved | in progress | review | ready for review`, so a plan file that still holds the template line contains the words "ready for review" without being ready. The two plan files in `docs/plans/` both hold `Status: ready for review` on line 9, in the header, before the first `## ` heading.

**Session files on this machine** (counts only, read with a throwaway script that printed numbers and nothing else, 2026-11-18). `~/.claude/projects/` holds 1.7 GB in 143 folders, with 147 main session files (555 MB) and 1,143 helper transcripts. Reading and parsing every file took 36 seconds. Out of 60,068 `assistant` lines, every one has a `message.id` and a `message.usage`. 30,753 message ids are unique. 4 message ids appear in more than one file, and 1 of them appears both in a main session file and in a helper transcript. Lines that share a `message.id` in the same file never differ in their input, cache creation or cache read fields, and their `output_tokens` never shrink. 13 lines are not valid JSON. No line of a main session file has `isSidechain: true`. `CLAUDE_CONFIG_DIR` is not set.

**Governing decisions.** ADR-SIC-H (exit codes, no `process.exit()`, printing through `io`). The public text rule of `CLAUDE.md`. The minimum Node version lives only in `engines.node`. Upstream, ADR-SIC-B is still open and #13 owns the new plan format with its `Format:` line.

**Risks.** `cli.ts`, its `USAGE` text, `README.md` and `package.json` are edited by three tickets of the same wave at once, so conflicts are expected at the update before the push. On macOS, `os.tmpdir()` is under `/var/folders/...`, which is a symbolic link to `/private/var/...`, and `git rev-parse --show-toplevel` returns the resolved path. A test that writes the unresolved temporary path into a fixture's `cwd` therefore exercises the symbolic link rule of scope step 5 from the first test. A machine whose global git config signs commits or sets hooks could break the test repositories unless the tests disable them.

## Decisions

**Rules of the repository and of the wave**

- Work from the `cstack/` folder. `npm ci` installs, `npm test` runs the tests, `npm run typecheck` checks the types, `npm run build` compiles. All four must pass before the push. (2026-11-18, conventions file)
- A command prints only through the `io` argument and returns its exit code. No code calls `process.exit()`. A usage error returns 2. (2026-11-18, ADR-SIC-H)
- Do not write the minimum Node version anywhere except `engines.node` in `cstack/package.json`. Add no dependency, so `cstack/package.json` and `package-lock.json` stay unchanged. (2026-11-18, conventions file and assumption not asked)
- Tickets #9 and #10 also register a command in `cstack/src/cli.ts` and edit `README.md`. Keep this ticket's change to `cli.ts` to the dispatch of `measure` and its line in the usage text, and keep the README change to one new section of its own. When a conflict appears at the update onto `origin/main`, keep both sides. (2026-11-18, coordinator's brief)
- The fixtures under `cstack/test/fixtures/measure/` are written by hand in the shape of a Claude Code session file. Never copy a real session file of this machine, or any extract of one, into the repository. Tests never read the real home folder: each test builds its own temporary home folder and passes it with `--home`. (2026-11-18, ticket and coordinator's brief)
- Never run `cstack skills install` against the real home folder and never change anything under `~/.claude/skills/`. (2026-11-18, coordinator's brief)
- The repository is public. No employer or client name, no work ticket key and no count from work retrospectives may appear in a file, a commit, the pull request, a ticket comment, this plan or the retrospective. Never change `user.email` in git config and never pass `--author`. (2026-11-18, conventions file and coordinator's brief)

- The branch `gambitl/cstack-measure` already exists in this worktree and is checked out. Work on it. (2026-11-18, coordinator's brief)
- Never merge the pull request. The user merges it. (2026-11-18, coordinator's brief)
- Before the push of phase 12, run two checks and push only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 scripts/private_names.py check <that file>`, which must exit 0. Never print the private list. (2026-11-18, coordinator's brief)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is a shortage of macOS runners, not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-18, coordinator's brief)

**The command line**

- The command is `cstack measure <plan file> [--home <folder>]`. `cli.ts` dispatches the first argument `measure` to `measure(args.slice(1), io)` in `cstack/src/commands/measure.ts`, before the line that refuses an unknown command. The signature `run(args, io)` does not change. (2026-11-18, user's answer)
- `--home` defaults to `os.homedir()`. The command reads the session files under `<home>/.claude/projects/`. `CLAUDE_CONFIG_DIR` is ignored. (2026-11-18, user's answer)
- The top-level usage text of `cli.ts` keeps its first line `Usage: cstack --version` and gains one line for `cstack measure <plan file> [--home <folder>]`. The sentence "No command exists yet." is removed. `measure` parses its own options with `parseArgs` in strict mode. (2026-11-18, assumption not asked)

**Output and exit codes**

- Standard output holds only lines of the form `<label>: <digits>`, in this order: `main sessions`, `helper transcripts`, `input tokens`, `cache creation input tokens`, `cache read input tokens`, `output tokens`, then the lines per model, then `minutes from approval to ready for review`, then `skipped lines`, then `unreadable files`. (2026-11-18, ticket and user's answer)
- The lines per model come after the four totals. For each model, in the order of the model names, they are `input tokens <model>`, `cache creation input tokens <model>`, `cache read input tokens <model>` and `output tokens <model>`. The model is the `message.model` of the `assistant` line. A model name that does not match `^claude-[a-z0-9.-]+$`, such as `<synthetic>`, or a missing model, is counted under the fixed name `other model`, which comes last. (2026-11-18, user's answer; `message.model` is on every `assistant` line of this machine, checked with a counts-only script)
- The minutes line is left out when the waiting time is missing. Every other line is always printed, with 0 when there is nothing. (2026-11-18, assumption not asked)
- The waiting time is the ready moment minus the approval moment, in whole minutes, rounded to the nearest minute. When the ready moment is missing, or when it is less than one minute after the approval (or before it), the waiting time is missing. (2026-11-18, user's answer)
- Every message goes to standard error as one fixed English sentence that starts with `cstack measure: `. A message never holds a path, a file name, a session id or any text read from a session file or from the plan file. (2026-11-18, user's answer)
- Exit code 2 means the command line is wrong: no plan file argument, more than one, an unknown option, or `--home` without a value. The message is followed by the usage line of `measure`. (2026-11-18, ADR-SIC-H and user's answer)
- Exit code 1 without any count means the plan file stops the command before any session is read: the file does not exist, it is not inside a git repository, it was never committed, or its header has a `Format:` line. (2026-11-18, ticket and user's answer)
- Exit code 1 with the counts printed means the result is incomplete: the plan never reached "ready for review"; or it reached it less than one minute after the approval, and the message then says that the history looks rewritten; or no main session was found; or at least one file could not be read. Each case has its own sentence on standard error, and several can be printed together. (2026-11-18, ticket and user's answer)
- Exit code 0 means every line was printed and none of the cases above happened. (2026-11-18, assumption not asked)
- The `Format:` refusal says that this version of `cstack measure` reads only plan files made before `cstack`. (2026-11-18, ticket)

**The two moments, read from git**

- Resolve the plan file argument against the current folder, then through symbolic links. The repository root is `git rev-parse --show-toplevel`, run in the folder of the resolved plan file. Git paths are relative to the root, with `/` separators. (2026-11-18, ticket)
- The header of a plan file is every line before the first line that starts with `## `. (2026-11-18, assumption not asked)
- The `Format:` check reads the header of the file on disk. Any header line that starts with `Format:` refuses the plan file, before git is called for the history. (2026-11-18, ticket)
- The approval moment is the author date (`%aI`) of the oldest commit that added the file: `git log --diff-filter=A --format=%aI -- <path>`, last line. (2026-11-18, ticket)
- The ready moment is the author date of the first commit, oldest first (`git log --reverse`), whose version of the file reads "ready for review". Read each version in memory with `git show <commit>:<path>`, and skip a commit where that fails. (2026-11-18, ticket)
- A version reads "ready for review" when the first header line that starts with `Status:` has, after `Status:` and once trimmed, exactly the value `ready for review`, ignoring case. A template line that lists every value, or a value with a suffix such as `in progress (phase 6)`, does not count. (2026-11-18, tested by reading the template, line 9)
- Never read the committer date, because a rebase rewrites it. (2026-11-18, ticket)
- Run git with `execFile` and an argument list, never through a shell. Put `--` before every path. Add `-c color.ui=never -c log.showSignature=false -c log.follow=false`, so the user's git config cannot add lines to the output or follow renames. Give `execFile` a `maxBuffer` large enough for a plan file of several megabytes. (2026-11-18, assumption not asked, security)

**Which session files count**

- A main session file is a `*.jsonl` file directly inside a folder directly under `<home>/.claude/projects/`. (2026-11-18, ticket)
- A main session file counts when two things are true. First, at least one of its lines has a `cwd` equal to the repository root or inside it. Second, the span from its earliest to its latest `timestamp` overlaps the window: the earliest is not after the window's end, and the latest is not before the approval. (2026-11-18, ticket)
- The window runs from the approval moment to the ready moment. When the ready moment is missing, it runs to the moment the command runs. When the ready moment is less than one minute after the approval, the window still ends at the ready moment as read. (2026-11-18, user's answer)
- To compare a `cwd` with the root, resolve both through symbolic links. When a `cwd` no longer exists, resolve its nearest existing parent folder and add back the missing part. A `cwd` is inside the root when it equals the root or starts with the root followed by `/`, so a sibling such as `/repo-other` never matches `/repo`. (2026-11-18, user's answer)
- A line without a valid `timestamp` string does not change the span. A file with no timestamp never counts. (2026-11-18, assumption not asked)
- For each main session that counts, every `*.jsonl` file directly in `<session folder>/<session id>/subagents/` is a helper transcript of the run, without any check of `cwd` or time. Nested helpers are already in that folder, so `parentAgentId` and the meta files are not read. (2026-11-18, ticket)

**Adding up the tokens**

- Read every file line by line with `readline` over a read stream. Ignore a blank line. A line that is not valid JSON is skipped and counted. Skipped lines are reported only for the files of the run: the main sessions that count and their helper transcripts. (2026-11-18, ticket and assumption not asked)
- Only lines whose `type` is `assistant` add tokens, and only through `message.usage`: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` and `output_tokens`. A missing field counts as 0. `toolUseResult`, `totalTokens`, `usage.cache_creation`, `usage.iterations` and `modelUsage` are never read. (2026-11-18, ticket)
- Count each `message.id` once over all the files of the run, not once per file. Keep the line with the largest `output_tokens` for that id, with the other three fields and the model of that same line. An `assistant` line without `message.id` counts on its own. (2026-11-18, tested: on this machine, 4 message ids appear in more than one file and 1 appears in a main session and a helper transcript)
- Every error of the file system, such as a folder or file that cannot be listed, opened or read, is caught inside the command. The file is left out and counted in `unreadable files`. A missing `<home>/.claude/projects/` folder is not an error: no main session is found. No Node error message reaches `bin.ts`, because those messages hold paths. (2026-11-18, user's answer)

**Tests**

- All the tests of this ticket are in `cstack/test/measure.test.ts`. They call `run(["measure", ...], io)` with the fake `io` pattern of `cli.test.ts`. (2026-11-18, ticket)
- Each fixture scenario is a folder under `cstack/test/fixtures/measure/` that mirrors the inside of `.claude/projects/`. The test copies a scenario into a temporary home folder. While copying, it replaces the placeholder `{{REPO}}` with the JSON-escaped path of the temporary repository, written as the test knows it (on macOS, the unresolved `/var/...` path, which exercises the symbolic link rule). It can replace other placeholders, such as `{{OTHER}}`, the same way. Fixture timestamps are fixed, and the test sets the commit dates to match them. (2026-11-18, assumption not asked)
- The test git repositories run git with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`. Author, committer and dates are set with the `GIT_AUTHOR_*` and `GIT_COMMITTER_*` variables, never with git config. (2026-11-18, user's answer)
- The rebase test sets `GIT_COMMITTER_DATE` to another value during the rebase. It first checks that the committer dates (`%ct`) changed, then that the minutes stay the same. (2026-11-18, user's answer)
- Session fixtures use synthetic text only. Model names in fixtures are real product names such as `claude-opus-5-5` and `claude-sonnet-5-5`, plus `<synthetic>`. (2026-11-18, assumption not asked)

**After the build**

- Once this plan reaches "ready for review", the built command runs once on this run itself, with the real home folder, and the numbers are shown to the user in the conversation only. They never go into the repository, the pull request or a ticket. (2026-11-18, user's answer)

## Architecture

The approach is locked by the ticket and the answers above, so there was no choice to make between designs. The code splits into three files so that each part stays small and testable through the command. `cstack/src/commands/measure.ts` parses the arguments, calls the two parts below, decides the exit code and prints the lines. `cstack/src/measure/moments.ts` reads the plan file header and its git history, and returns the repository root and the two moments. `cstack/src/measure/sessions.ts` finds the main sessions and their helper transcripts and adds up the tokens, with the counts of files, skipped lines and unreadable files. `cstack/src/cli.ts` only gains the dispatch and one usage line. The units run one after the other, because they all add cases to the same test file.

No new decision since phase 4: the split by model and the guard against a rewritten history were settled in the question round.

## Implementation units

### Unit 1: The first case, one main session with one helper and one nested helper — status: done
- Failing test: in `cstack/test/measure.test.ts`, build a temporary home folder and a temporary git repository with test helpers (see Decisions, Tests). Commit a plan file whose header reads `Status: approved` with a set author date, then a commit that sets it to `Status: ready for review` 95 minutes later. Copy the fixture scenario `basic` (one main session, one helper transcript and one nested helper transcript, whose meta file has `parentAgentId` and `spawnDepth`, all with one model and no repeated `message.id`). Run `cstack measure <plan> --home <home>`. Expect exit code 0, empty standard error, `main sessions: 1`, `helper transcripts: 2`, each of the four totals equal to the sum written in the fixture, the four lines of that model, `minutes from approval to ready for review: 95`, `skipped lines: 0` and `unreadable files: 0`. It fails because `measure` is an unknown command.
- Minimum code: the dispatch and the usage line in `cli.ts`; `commands/measure.ts` with the argument parsing and the output; `measure/moments.ts` with the repository root, the approval moment and the ready moment as the Decisions describe; `measure/sessions.ts` with the scan of main sessions, the `cwd` match through symbolic links, the helper transcripts, the sums of the four fields and the lines per model.
- Refactor: none expected.
- Commit message: `feat: add cstack measure for the tokens and the waiting time of a run`
- Depends on: none

### Unit 2: The traps in the token counts — status: done
- Failing test: new scenarios in the same test file. An answer written on three lines with the same `message.id` counts once, with the `output_tokens` of its last line, which is the largest. The same `message.id` in a main session and in a helper transcript counts once. A `user` line with a `toolUseResult` that carries `usage` and `totalTokens`, and an `assistant` usage with `cache_creation`, `iterations` and a `modelUsage` key nearby, add nothing beyond the four fields. Two lines that are not valid JSON give `skipped lines: 2`, and a blank line is not counted. Two models plus a `<synthetic>` line give the lines of both models and of `other model`, in that order, and the lines per model add up to the totals.
- Minimum code: in `measure/sessions.ts`, the map of `message.id` over the whole run that keeps the largest `output_tokens`, the count of skipped lines for the files of the run, and the `other model` rule.
- Refactor: none expected.
- Commit message: `feat: count each answer once and report skipped lines in cstack measure`
- Depends on: 1

### Unit 3: Which session files belong to the run — status: done
- Failing test: a session whose only `cwd` is another folder adds nothing. A session whose `cwd` is a sibling folder whose name starts with the root's name adds nothing. A session that starts after "ready for review" adds nothing, and one that ends before the approval adds nothing. A session whose `cwd` is a subfolder of the root counts. A session whose `cwd` is a subfolder that does not exist on disk counts. When no main session matches, every count is printed as 0, standard error holds the fixed sentence about no main session, and the exit code is 1. When `<home>/.claude/projects/` does not exist, the result is the same.
- Minimum code: in `measure/sessions.ts`, the overlap test with the window, the match on the root followed by `/`, the resolution of the nearest existing parent of a `cwd`; in `commands/measure.ts`, the no-session sentence and exit code.
- Refactor: none expected.
- Commit message: `feat: pick the sessions of a run by folder and time window in cstack measure`
- Depends on: 2

### Unit 4: The moments, the refusals and the usage errors — status: done
- Failing test: after a rebase onto a new base commit with a different `GIT_COMMITTER_DATE`, the committer dates changed and the minutes stay the same. A plan file that never reached "ready for review" prints every count but no minutes line, says on standard error that the ready moment is missing, counts a session that started after the approval with no end, and exits with 1. A plan whose ready commit is 30 seconds after the approval prints the counts without the minutes line, says that the history looks rewritten, and exits with 1. A plan whose Status line is still the template's list of values never counts as ready. A plan file with a `Format:` line in its header is refused with the message of the Decisions, prints no count and exits with 1, while a `Format:` line after the first `## ` heading does not refuse it. A plan file that does not exist, one outside any git repository, and one that is not committed each print one fixed sentence, no count, and exit with 1. No argument, two plan files, an unknown option and `--home` without a value each exit with 2 and print the usage line of `measure`.
- Minimum code: in `measure/moments.ts`, the header parsing, the `Format:` check and the errors for a missing file, no repository and no commit; in `commands/measure.ts`, the missing and rewritten waiting time, the open window and the exit codes.
- Refactor: none expected.
- Commit message: `feat: refuse new plan formats and report a missing moment in cstack measure`
- Depends on: 3

### Unit 5: Nothing private leaves the command — status: done
- Failing test: a scenario holds the unique marker string in message text, in `cwd` (a subfolder of the repository named with the marker), in `gitBranch`, in a tool result and in `message.model`. Neither standard output nor standard error ever holds the marker. Every standard output line matches either `^(main sessions|helper transcripts|minutes from approval to ready for review|skipped lines|unreadable files): \d+$` or `^(input tokens|cache creation input tokens|cache read input tokens|output tokens)( (claude-[a-z0-9.-]+|other model))?: \d+$`. A helper transcript with file mode `000` gives `unreadable files: 1`, the fixed sentence about unreadable files, exit code 1, and no path, folder name or marker in either stream. The temporary home folder holds exactly the same files with the same contents before and after a run. A last case reads every source file of the command (`src/commands/measure.ts` and `src/measure/*.ts`) and fails when one imports `http`, `https`, `http2`, `net`, `tls`, `dgram`, `dns` or `undici`, with or without the `node:` prefix, or calls `fetch`.
- Minimum code: the catch of every file system error in `measure/sessions.ts`, the `unreadable files` count and its sentence in `commands/measure.ts`.
- Refactor: none expected.
- Commit message: `test: prove that cstack measure prints numbers only and changes nothing`
- Depends on: 4

No user interface and no design specification apply. The security points (git called without a shell, no network, no content in the output, file errors caught) are in the Decisions and are tested in unit 5.

## Documentation duties

- The README: applies. Add one new section of its own to `README.md`, "Measure a run", that says what `cstack measure` prints, how it finds the sessions, that it must run in the folder of the run before that folder is removed and before a squash merge, and what exit code 1 means. Keep it short and away from the sections that #9 and #10 add.
- The comment on this ticket (#11): applies, written as a GitHub comment on #11. It says what was built, the lines per model and the guard against a rewritten history, which go beyond the ticket text.
- The comment on the ticket that it feeds, the baseline runs (#12): applies, written as a GitHub comment on #12. It gives the exact command, the output lines, the meaning of exit code 1, and the advice to measure once the run's session has ended, because anything said later in a session that counts adds to the totals.
- ADR: does not apply. The rules come from the ticket and from the answers in this plan, and none of them is a structural choice for other commands.
- The specification page: does not apply.

## Review log

Impact notes (graphify is not installed, so these come from reading). The branch changed only one existing symbol, `run` in `cstack/src/cli.ts`, by adding a dispatch for `measure` and one usage line. Its dependents are `cstack/src/bin.ts` and `cstack/test/cli.test.ts`; the usage text no longer ends with "No command exists yet.", and `cli.test.ts` was run in the full suite and passes. Usual companions: `README.md` (gets its section in phase 10.3, per the plan's documentation duties) and `cstack/package.json` (no change needed, no dependency added).

Phase 7 findings (four reviewers, 2026-11-18). Two bugs, both fixed in one follow-up commit: a plain file such as `.DS_Store` in the projects folder was counted as an unreadable file, and a helper folder that could not be listed was dropped silently with exit code 0. Two hardening items, both fixed: the second `git log` call was not wrapped in a fixed error, and the plan path was read as a git pathspec with wildcards (now `--literal-pathspecs`). Simplicity findings, all applied: one map for answers, no try/finally, one header helper, simpler type annotations and model sort, one copy of the usage line where simple. Conventions review found no rule broken. The README section is pending for phase 10.3.

## Briefing

### What you should know about what was built

`cstack measure <plan file>` is built and does what the ticket asks. It prints the four kinds of tokens, the same four per model, and the minutes from approval to "ready for review", with numbers only. I ran the 25 tests and the type check myself, and both pass.

**What you need to do**

**Merge this pull request with "Create a merge commit", not with "Squash and merge".** The repository allows all three buttons. A squash folds the plan's commits into one, so the command can no longer find the approval and the ready moment on `main`. It then refuses with "the history looks rewritten". The earlier pull requests used merge commits.

**What to watch**

- The command reads the internal format of Claude Code's session files, which is not documented. If an update moves the helper transcripts or renames the usage fields, the numbers drop without any error. The sign is `helper transcripts: 0` on a run that you know started helpers. The baseline ticket (#12) already writes down the Claude Code version, so compare runs made on the same version when you can.
- The command only sees the sessions whose working folder is inside the repository of the plan, and the helpers of those sessions. If the new version of the skill starts Orca workers in other folders, their tokens are missing. The comparison would then favour the new version for the wrong reason.
- A run folder must not contain other worktrees. Claude Code puts its own worktrees in `.claude/worktrees/` inside the repository, and their sessions would count too. Orca's sibling folders and the fresh clones of #12 are safe.

#### Details

**Merge button.** `gh repo view` shows `squashMergeAllowed`, `mergeCommitAllowed` and `rebaseMergeAllowed` all true. A squash merge creates one commit whose author date is the merge time, so on `main` the plan file is added and reaches "ready for review" in the same commit. The wait is then under one minute, the guard of the Decisions fires, and the command prints no minutes and exits with 1. A rebase merge keeps author dates and would work. This ticket's own numbers are taken in the worktree before the merge, so they are not at risk, but every later reading from `main` is. The earlier merges `ecaec53` and `4bc2bcb` are merge commits. If nobody decides, GitHub may offer the squash button, because all three are allowed.

**Session file format.** `cstack/src/measure/sessions.ts` relies on four facts: main sessions are `*.jsonl` files directly under a project folder, helpers sit in `<session id>/subagents/`, `assistant` lines carry `message.id`, `message.model` and `message.usage`, and lines carry `cwd` and `timestamp`. None of this is a public contract. A counts-only check on this machine (2026-11-18) found 147 main session files, none named `agent-*`, and 1,188 helper files, all named `agent-<id>.jsonl`, so today's layout matches. If a future layout moves helpers elsewhere, they are not counted and nothing fails. Step 12 of the scope of #12 already records the Claude Code version with each measurement, which is enough to spot a change. No code change is proposed now.

**Tokens outside the run folder.** The window and the `cwd` rule (Decisions, "Which session files count") pick only sessions working inside the repository root, plus their `subagents/` folder. Work started by Orca as a separate Claude Code session in another worktree, or a coordinator session in the main checkout, is invisible. Today's skill runs everything as Claude Code helpers, so the baseline is complete. The epic rule says every feature that uses Orca also works without Orca, so a fair comparison can run the new version without Orca, or the ticket that adds the new plan format (#13) can record the extra folders. Non-blocking question for the maintainer, to place in #13 or in the comparison ticket (#33), in English: "When the new version of the skill runs part of a ticket in Orca workers, how will `cstack measure` count the tokens of those workers, so that the comparison with the baseline stays fair?" If nobody decides, the comparison may report a saving that only comes from tokens the command cannot see.

**Nested worktrees.** `inside()` in `sessions.ts` accepts any `cwd` under the root followed by `/`. That is correct for subfolders, but a worktree nested inside the measured checkout also matches. `git worktree list` here shows the Orca worktrees as siblings under `~/orca/workspaces/claude-code-stack/`, and #12 uses a fresh clone per run, so neither case is affected. It matters only if someone measures a plan in a checkout that holds other worktrees inside it, during the same window.

**Earlier questions, resolved.** All ten draft questions and the two advisor questions were built as answered. The home folder is `--home` with `os.homedir()` as default. Each `message.id` is counted once over the run, keeping the largest `output_tokens` (`sessions.ts`, the `answers` map). The open window runs to now. The exit codes follow the Decisions, including exit 1 for no main session and for unreadable files. The Status line is read from the header only, as an exact value (`headerValue` in `moments.ts`). Minutes are rounded, and a wait under one minute prints the "history looks rewritten" sentence. A missing `cwd` is resolved through its nearest existing parent (`resolveLoose`). There is no scan shortcut. The split by model uses `other model` for names outside `^claude-[a-z0-9.-]+$`. The try on this run is still to do, after the plan reaches "ready for review", with numbers in the conversation only. The fixes of the code review (stray files, unlisted helper folders, the second `git log`, `--literal-pathspecs`) stay inside the Decisions, so nothing changed since the plan.

I checked data model lock-in, security and leaks (fixed sentences only, `execFile` without a shell, no network module, the marker test), scale (a full scan, measured at 36 seconds), failure handling and reversibility, and found nothing new in them. The command is local, stores nothing and has no dependency.

## Open questions after the build

### Blocking

none

### Non-blocking

When the new version of the skill runs part of a ticket in Orca workers, how will `cstack measure` count the tokens of those workers, so that the comparison with the baseline stays fair? For the maintainer, to place in the ticket for the new plan format (#13) or in the comparison ticket (#33).

## Pull request

Title: feat: add cstack measure for the tokens and the waiting time of a run

Body:

This adds `cstack measure <plan file>`, which tells you how many tokens and how many minutes one run of the `resolve-issue` skill used. It reads the session records that Claude Code keeps on your computer and prints labels and numbers only. Run it on the plan file of a run, from the repository of that run, to get the totals that the baseline comparison needs.

The command takes the approval moment and the "ready for review" moment from the author dates in the git history of the plan file, so a rebase does not change them. It counts every main session that worked inside the repository during that window, plus all their helper transcripts. Each answer of the model is counted once, even when it is written on several lines or appears in two files. It prints the four kinds of tokens as totals and for each model. The README has a new section, "Measure a run", and one list of every `cstack` command after the update onto `main`.

The code is in `cstack/src/commands/measure.ts`, `cstack/src/measure/moments.ts` and `cstack/src/measure/sessions.ts`. `cstack/src/cli.ts` only gains the dispatch and one usage line. All tests are in `cstack/test/measure.test.ts`, with hand-written fixtures in `cstack/test/fixtures/measure/`. No dependency was added. The command runs git without a shell, uses no network, never prints a path or text read from a session, and the tests check each of these points.

Beyond the ticket text, the lines per model and a guard for a rewritten history were added. When "ready for review" is under one minute after the approval, which a squash merge produces, the command says the history looks rewritten, prints no minutes and exits with 1. Please merge this pull request with "Create a merge commit". A squash would make every later reading from `main` fail in this way.

Judgment calls from the independent review, kept as they are. A model name in the output is printed only when it looks like `claude-...`, which is a small loosening of "a fixed label followed by digits". For repeated answers the code keeps the line with the largest `output_tokens`, which equals the last line in every file checked. A missing or uncommitted plan file exits with 1, not 2. The code review also found and fixed a stray `.DS_Store` file being counted as unreadable, an unlisted helper folder being dropped silently, and git reading a plan file name as a wildcard pattern.

Known limits, not fixed here. The command cannot see sessions that run in folders outside the repository, and it would also count a worktree nested inside the measured folder. Both are noted in the README and in the ticket comments.

The plan is `docs/plans/2026-11-18-11-measure-the-tokens-and-the-time-of-a-run.md`.

Open questions, not needed for this pull request. The pull request can be merged without their answers.

When the new version of the skill runs part of a ticket in Orca workers, how will `cstack measure` count the tokens of those workers, so that the comparison with the baseline stays fair? This is for the maintainer, to place in the ticket for the new plan format (#13) or in the comparison ticket (#33).

Fixes #11

## Documentation

- README.md: new section "Measure a run" (committed on the branch).
- Comment on #11: https://github.com/gambitl/claude-code-stack/issues/11#issuecomment-6973275826
- Comment on #12, the ticket it feeds: https://github.com/gambitl/claude-code-stack/issues/12#issuecomment-6973276211
- No ADR and no specification page change, as the plan's Documentation duties say. The tracker is GitHub, which has no in-progress state or resolution field, so no state change was made.

## Executor notes

- `gh label list` has no "in progress" label and GitHub issues have no state beyond open and closed, so step 6.1 (move the ticket to in progress) was not possible and nothing was changed.
- The review found two real bugs that the unit tests missed (a `.DS_Store` file counted as unreadable, an unreadable helper folder dropped silently), so one follow-up commit was needed after phase 7.
- Unit 5's implementer added its source change before running the new tests, so one test was not seen failing first. The other three new cases passed at once because earlier units already covered them.
- Graphify is not installed, so impact notes were made by reading.

## Hand-off log

2026-11-18: done. All five units built, two review rounds and one independent review finished, README and the comments on #11 and #12 written, status set to ready for review. One non-blocking question is open (Orca workers and the comparison). Nothing pushed yet; phase 12 publishes.

2026-11-18: published. The branch was rebased onto `main` with the `doctor` command of #10 kept next to `measure` in `cstack/src/cli.ts`, pushed once, and pull request #37 opened with the `cstack` check green.

2026-11-18: updated onto `main` after the merge of #9 (`cstack skills install`, `cstack guide` and the release workflow), at the coordinator's request. The rebase kept every author date. The conflicts in `cstack/src/cli.ts` and `README.md` were resolved by keeping both sides: the usage text lists `doctor`, `guide`, `measure` and `skills install`, and the README puts "Requirements" before "Install cstack" and adds one "Commands" list for the four commands. `npm test` (85 tests) and `npm run typecheck` pass.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

**Should the command also split the tokens by model?** Today's skill runs the executor and the implementers on Sonnet, the deep reviewers on Opus, and the main conversation on the model you pick. An Opus token weighs much more on the quota than a Sonnet token. If the new version changes that mix, the four totals can go down while the quota use goes up. I recommend one extra line per model and per kind of token, because the reference runs (#12) are measured once with this command. This adds to the output that the ticket describes, so I need your yes.

**What should the command do when the history of the plan file was rewritten?** I checked this repository. The seven commits of the plan of the scaffold ticket (#7) all carry the same author date, within one second. A rewrite that resets author dates gives 0 minutes. Worse, the command then counts the session that was running at that second, and says nothing. I recommend this: when the wait is under one minute, treat it as missing, say the history looks rewritten, and exit with code 1. The plan of #8 gives a plausible 22 minutes.

**I will do this unless you say no**

- An option `--home <folder>`, which defaults to your home folder. The signature of `run` stays as it is, because #9 and #10 edit `cli.ts` at the same time.
- Without "ready for review", the window runs from the approval to the moment the command runs.
- Standard output holds only "label: digits" lines. Every message goes to standard error as one fixed sentence with no path. Exit code 2 means a wrong command line. Exit code 1 means the plan or its history stops the command, or no main session was found. Without that last case, measuring from the wrong folder prints zeros that look like a success.
- The command catches every file error itself. Otherwise a Node error carries its path under `~/.claude/projects/`, and `bin.ts` prints it.
- Minutes are rounded to the nearest minute. A `cwd` that no longer exists is compared as written, and `/repo-other` never matches `/repo`.
- The test git repositories ignore the global git config. The rebase test forces a new committer date, otherwise it runs within the same second and proves nothing.
- Once this plan reaches "ready for review", I run the command on this run and show you the numbers in the conversation only.

**I checked it myself**

- One `message.id` appears in several files, so I count it once over the whole run. I keep its largest `output_tokens`, not "the last line read", because the order of the files is not fixed.
- The plan template itself contains the words "ready for review", so I read only the `Status:` line of the header, as an exact value.
- Reading every session file takes 36 seconds here, so no shortcut is needed.

**Good to know**

- Measure in the run folder, before you remove it and before a squash merge, which folds both moments into one commit.

#### Details

**Split by model (blocking, needs the user).** The frontmatter of the agents in `skills/resolve-issue/agents/` sets `model: sonnet` for `executor.md`, `implementer.md`, `code-reviewer.md` and `code-reviewer-simplicity.md`. It sets `model: opus` for `code-reviewer-deep.md`, `pr-reviewer.md`, `implementer-escalation.md` and `cto-review.md`, and `code-explorer.md` and `code-architect.md` inherit. The spec (line 27) compares each kind of token on its own because the kinds do not weigh the same on the quota, and the models do not weigh the same either. The model is in `message.model` of each `assistant` line, because Claude Code records the API message as it came back. The executor should confirm that key with the same counts-only script before relying on it. If you say yes, add lines such as `output tokens claude-opus-…: <digits>`. Accept only model names that match `^claude-[a-z0-9.-]+$`, and count any other name, such as `<synthetic>`, under a fixed label `other model`. The negative test then allows exactly that shape and nothing else. I rejected weighting the totals by price, because the quota weights are not published. If nobody decides, the command prints the four totals only, as the ticket says, and the comparison of #33 cannot see a shift between models.

**Rewritten history (blocking, checked in part, needs the user for the threshold).** `git log --format='%h %aI %cI' -- docs/plans/2026-11-17-7-scaffold-the-cstack-command-line-tool.md` gives seven commits, from 17:24:24 to 17:24:25 on 2026-11-17, with author date equal to committer date. Their history was rebuilt with fresh dates. The plan of #8 shows the normal case: added at 17:21:30, "ready for review" first at commit `541bae0` at 17:43:19, so 22 minutes. Its first five commits have committer date 17:37:00, which shows a rebase that kept the author dates, as the ticket expects. With the plan of #7, the window would be one second long, and the session that rewrote the history would match it. I rejected a cross-check against session spans, because the rewriting session does overlap that second. I rejected reading tool calls in the session content to find the commit, because it reads content and is fragile. The baseline runs of #12 do not push or rewrite, so they are not at risk. The guard protects every other use. By default the command prints 0 minutes and the wrong tokens.

**Home folder (draft question 1, blocking, recommendation kept).** `--home <folder>` with `os.homedir()` as default keeps `run(args, io)` unchanged. `CLAUDE_CONFIG_DIR` is not set on this machine and stays ignored.

**Window without "ready for review" (draft question 3, blocking, recommendation kept).** The window runs from the approval to now. #12 gives each run its own folder, so a long window does not mix runs.

**Messages and exit codes (draft questions 4 and 5, blocking, recommendation kept, one case added).** ADR-SIC-H is locked: 2 for a usage error, 1 for a crash, no `process.exit()`. The ticket itself asks for code 1 when a moment is missing. I add one case: zero main sessions found gives a fixed sentence and exit code 1, while the counts are still printed. The default would print zeros with exit code 0. That happens when someone measures from the main checkout instead of the run's worktree, because `git rev-parse --show-toplevel` then returns another folder than the session `cwd`.

**Paths in error messages (my point, blocking for the negative acceptance, testable).** `cstack/src/bin.ts` prints `cstack: <error.message>` for any throw. Node file errors such as `EACCES` and `ENOENT` put the full path in the message, and a path under `~/.claude/projects/` holds the names of working folders. The command must catch every file system error inside `measure`, and replace it with a fixed sentence or a skipped-file count. A test can create a session file with mode `000` in the temporary home folder and check that the marker string and the folder name never appear. The CI runner on macOS does not run as root, so the mode is respected.

**Rounding and paths (draft questions 7 and 8, blocking, recommendations kept).** Round to the nearest whole minute. A ready moment earlier than the approval counts as missing. Resolve each path through symbolic links when it exists, and compare it as written otherwise. Match on equality or on the root followed by `/`.

**Test git repositories (my point, non-blocking).** Run git in the tests with `GIT_CONFIG_GLOBAL=/dev/null` and `GIT_CONFIG_NOSYSTEM=1`. Set the author and committer through `GIT_AUTHOR_*` and `GIT_COMMITTER_*` variables, never through git config. For the rebase case, set `GIT_COMMITTER_DATE` to another value during the rebase, and assert that `%ct` changed before asserting the result. Otherwise the whole test runs within one second, and a version that reads the committer date passes too.

**Trying the command on this run (draft question 10, non-blocking, recommendation kept).** The numbers stay in the conversation. This run is in the public repository, but the numbers are not part of the comparison.

**`message.id` across files (draft question 2, blocking, checked, recommendation corrected).** The count in the code mapping shows 4 message ids in more than one file, one of them in a main session and a helper transcript. Count each id once over the whole run. Keep the largest `output_tokens`, together with the other three fields of that line. Within a file this equals the last line, because `output_tokens` never shrinks there. Across files, "the last line read" depends on the order in which the directory listing returns files, so the result would not be stable.

**Status line (draft question 6, blocking, checked).** `skills/resolve-issue/templates/plan.md` line 9 lists every Status value, "ready for review" included. Reading the header only and taking the exact trimmed value is correct. The two plans in `docs/plans/` also show values with a suffix, such as `in progress (phase 6)`, which the exact match rightly rejects.

**Scan time (draft question 9, non-blocking, checked).** 36 seconds for 1.7 GB, of which the main session files are 555 MB. I considered skipping files whose modification time is before the approval. It is safe, because the last line is written before the modification time, but it is not needed at today's size.

**Where and when to measure (good to know).** The cwd rule in the ticket scope (step 5) stays as it is. #12 already measures in the run folder right after the run, keeps the folders, and warns about `cleanupPeriodDays`. Outside #12, a squash merge folds the add commit and the ready commit into one, so the history on the target branch gives no wait. This repository merges with merge commits (`ecaec53`, `4bc2bcb`), and `git log -- <file>` then follows the branch side.

The locked decisions cited and not reopened are ADR-SIC-H, the public text rule of `CLAUDE.md`, and the ticket's own scope. I checked authorization and isolation between users, data model lock-in, operations and cost, and reversibility, and found nothing in them: the command is local, has no dependency and no network, stores nothing, and can be changed freely.

### Open questions and answers

Draft of phase 4.1, 2026-11-18. Each question has its label, my recommended answer, and the evidence when I checked it myself.

1. **How does the command get the home folder?** Blocking, the user decides. The ticket says only that the home folder is an input. Recommended: an option `--home <folder>` of `cstack measure`, which defaults to `os.homedir()`. The command then reads `<home>/.claude/projects/`. The shared `run(args, io)` signature stays unchanged, which matters because #9 and #10 edit `cli.ts` at the same time. `CLAUDE_CONFIG_DIR`, the environment variable with which Claude Code can move its folder, is ignored, because it is not set here and the team does not use it.

2. **Is a `message.id` counted once per file, or once across all the files of the run?** Blocking, checked. Evidence: on this machine, 4 message ids appear in more than one session file, and 1 of them appears both in a main session file and in a helper transcript (throwaway count script, 2026-11-18, printed numbers only). Recommended: count each `message.id` once across all the files of the run, and keep the usage of the last line read for it. Within one file, repeated lines only differ in `output_tokens`, which never shrinks, so "the last line" is also the largest.

3. **Which window picks the sessions when "ready for review" is missing?** Blocking, the user decides. The ticket asks to print the tokens anyway but does not say which sessions count. Recommended: the window runs from the approval to the moment the command runs, so every session in the folder that overlaps the time after the approval counts.

4. **What happens when the plan file is outside a git repository, or was never committed?** Blocking, the user decides. Without the approval moment, no window exists, so no session can be picked. Recommended: print no token, write one fixed sentence to stderr, and exit with code 1.

5. **Which exit codes and which stream for each message?** Blocking, the user decides. Recommended: stdout holds only the lines "label: digits". Every message goes to stderr as one fixed sentence that starts with `cstack measure:` and holds no path. Exit code 2 means the command line is wrong (no plan file argument, an unknown option, an extra argument). Exit code 1 means the command ran but the plan file or its history stops it: the file does not exist, it is outside git, it was never committed, it has a `Format:` line, or a moment is missing. Exit code 0 means everything was printed.

6. **When does the Status line read "ready for review"?** Blocking, checked by reading the template. The template's own Status line lists every value, "ready for review" included, so a substring test would take an unfilled template for a ready plan. Recommended: in each version of the file, look only at the header, which is the part before the first line that starts with `## `. Take its first line that starts with `Status:`. It reads "ready for review" when the text after `Status:`, trimmed, equals `ready for review`, ignoring case. The `Format:` check reads the same header of the file on disk.

7. **How are the minutes rounded, and what if the ready moment comes before the approval?** Blocking, the user decides. Recommended: whole minutes, rounded to the nearest minute. When the ready moment is earlier than the approval, which only a wrong clock can cause, the waiting time counts as missing.

8. **Does a `cwd` that no longer exists still match?** Blocking, the user decides. A worktree removed after the run has no real path to resolve. Recommended: resolve each path through symbolic links when it exists, and compare it as written when it does not. A `cwd` matches when it equals the repository root or starts with the root followed by `/`, so `/repo-other` never matches `/repo`.

9. **Is a full scan of every main session file fast enough?** Non-blocking, checked. Evidence: reading and parsing all 1.7 GB of `~/.claude/projects/` took 36 seconds on this machine, and the main session files are 555 MB of it. Recommended: no shortcut, such as skipping files by modification time, in this ticket. The command reads every main session file line by line.

10. **Do we try `cstack measure` on a real run before the pull request?** Non-blocking, the user decides. Recommended: once this ticket's own plan reaches "ready for review", run the built command on this run itself and show the numbers in the conversation only. Nothing of it goes into the repository, the pull request or the ticket.

Answers of the question round, 2026-11-18. The user replied "ok go" to the short version of "Questions you may not be asking". That accepts both recommendations of its first group, the split of the tokens by model and the guard against a rewritten history, and every item of its second group by default.

- Question 1, the home folder: `--home <folder>`, default `os.homedir()`. Accepted by default.
- Question 2, `message.id` across files: count once over the whole run, keep the largest `output_tokens` (the advisor's correction of my draft, because the order of files is not fixed). Checked, and shown to the user.
- Question 3, the window without "ready for review": from the approval to now. Accepted by default.
- Questions 4 and 5, exit codes and streams: as recommended, plus exit code 1 when no main session is found and when a file cannot be read. Accepted by default.
- Question 6, the Status line: exact trimmed value in the header. Checked, and shown to the user.
- Question 7, rounding: nearest whole minute. A wait under one minute, or a negative one, counts as missing and says that the history looks rewritten, with exit code 1. The user's answer.
- Question 8, a `cwd` that no longer exists: compared through its nearest existing parent, which is the precise form of "compared as written" that works with the `/var` symbolic link of macOS. Accepted by default.
- Question 9, the scan time: no shortcut. Checked, and shown to the user.
- Question 10, a try on this run: yes, numbers shown in the conversation only. Accepted by default.
- The advisor's question on the split by model: yes, one line per model and per kind of token, with `other model` for names outside `^claude-[a-z0-9.-]+$`. The user's answer. Checked before planning: every `assistant` line on this machine has `message.model`, and one non-Claude name, `<synthetic>`, exists.
- The advisor's question on a rewritten history: yes, as written under question 7. The user's answer.

### Architecture options

No real choice between designs: the approach is locked by the ticket and the answers above.
