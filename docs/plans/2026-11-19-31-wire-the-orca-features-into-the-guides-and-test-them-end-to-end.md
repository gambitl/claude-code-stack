# Plan: #31 — M3-8: Wire the Orca features into the guides and test them end to end

Format: cstack-plan/1
Written by: cstack 0.2.0
Date: 2026-11-19
Ticket: https://github.com/gambitl/claude-code-stack/issues/31
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/wire-orca-guides
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-19T21:39:17+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** This ticket makes the Orca features work inside real runs of the `resolve-issue` skill, then publishes them in a new version of cstack.

- **What the title means**: cstack is the command-line tool that this project builds. `resolve-issue` is a skill, a file of instructions that Claude loads to take one ticket all the way to a pull request. Orca is a desktop app that runs several coding agents side by side. The guides are the short instruction files that cstack shows Claude one phase at a time during a run of `resolve-issue`. "Wire the Orca features into the guides" means that the guides now tell Claude to use the new cstack commands for helpers, worktrees and the tracker. "End to end" means that we test the whole chain on a real repository, not one piece at a time.
- **Why we are doing it**: Each earlier ticket of this milestone tested its own piece with recorded answers. Only a run on a real machine shows that the pieces fit together, and that Orca behaves as its recorded answers say.
- **For the user**: A solution engineer installs one release and gets the Orca features in their next run. When Orca is not there, the same release still works.

**Goal.** This ticket updates the guides of #21 and #22 so that they use the commands of milestone 3. It makes `cstack measure` count the helpers that worked in child worktrees, so that the comparison of #32 counts every token. It tests US-13 to US-16 end to end, with and without Orca, and publishes a release of cstack.

### Where things are today (read first)

* **Guides and prompts**: By the time this ticket starts, #21 has written the short skill and the planning guides. #22 has written the build guides and the executor and implementer prompts. They live in `cstack/skills/resolve-issue/` and `cstack/guides/resolve-issue/`. They replace the parts of the frozen prose skill listed below. Read those parts to know which steps change.
* **Reading the ticket**: `skills/resolve-issue/SKILL.md` (line 62): Phase 1 fetches the ticket through the direct connection to the tracker. Line 74 lists its blockers. Line 16 detects the tracker from the ticket id or URL, or from the conventions file. `skills/resolve-issue/templates/plan.md` (line 5) records the tracker in the header of the plan file.
* **Starting the helpers**: `skills/resolve-issue/SKILL.md` (line 158): The main conversation launches the executor as a fresh sub-agent and waits. `skills/resolve-issue/agents/executor.md` (lines 40 and 41) launches one implementer per unit, and an escalation when a unit is stuck.
* **Tracker writes and the branch**: `skills/resolve-issue/agents/executor.md` (line 37): Phase 6 moves the ticket to "in progress". Line 38 creates the branch. Lines 83 and 85 comment on the ticket and on its dependent tickets. Line 109 moves the ticket to "in review".
* **The criteria carried here**: `docs/projects/skills-into-cli.md` (line 171): This line holds US-13 AC1, about Orca waking the coordinating conversation. Line 182 holds US-14 AC3, about Claude starting in the new Orca worktree.
* **Measuring a run**: #11 writes `cstack measure`. It counts a session file of Claude Code when one of its lines has a `cwd`, the working folder, inside the repository root, and when its time span overlaps the run. #23 makes it read the two moments of the run from the plan file header. An implementer that works as an Orca worker in a child worktree has another working folder, so this rule misses its tokens. Other tickets of a wave may run in other worktrees of the same repository at the same time. So a rule that counted every worktree of the repository would count their tokens too.
* **Child worktrees in the plan**: #28 writes the line `- Worktree: <absolute path>` into each unit that ran in a child worktree. #24 adds this line to the plan format of #13, and the plan reader returns it.
* **Release**: #9 wrote the release workflow `.github/workflows/release.yml`, which runs on tags `v*`. It runs `npm pack` in `cstack/` and attaches `cstack-<version>.tgz` to a GitHub release (decision 3). #23 made the last release and added the test that every command in `cstack/src/manifest.ts` is implemented.

### Scope

1. Update the planning guides of #21.
   - Phase 1 reads the ticket with `cstack tracker read <key> --tracker <tracker>`. The tracker comes from the `Tracker:` line of the plan header.
   - When cstack exits with `4`, the guide tells Claude to read the ticket with its own connection. Claude writes the file of format `cstack-tracker/1`, then runs the same command again with `--from-file`.
2. Update the build guides and the prompts of #22.
   - Phase 6 moves the ticket with `cstack tracker move <key> --to "<name>"`. When cstack refuses the name, Claude picks one of the names it prints.
   - Phase 6 keeps the current branch when its name is the short name that `cstack wave` gave the ticket, such as `abc-12` or `issue-12`. Otherwise it creates the branch as today.
   - The main conversation starts the executor with `cstack helper start executor --plan <file>`. When that command exits with `6`, it starts `resolve-issue:executor` with the inputs that cstack printed, as today.
   - In both cases, the main conversation then runs `cstack helper wait <helper id>`, which replaces `cstack report check` of #16 in this guide. When the wait exits with `6`, the helper is still working, and the main conversation ends its turn. When it exits with `1`, the main conversation launches the executor again with the same inputs.
   - The executor reads the batches of `cstack unit order` of #18. It starts each implementer with `cstack helper start implementer --plan <file> --unit <n>`, and adds `--child-worktree` when the batch holds more than one unit. It waits for each one with `cstack helper wait`. Once every unit of the batch has reported, it runs `cstack unit collect <n>...`. A stuck unit goes to `cstack helper start implementer-escalation`.
   - Every helper prompt ends with `cstack helper done <kind> --helper <helper id>`, with the report on standard input. In the executor prompt, this command replaces `cstack report submit <kind>` of #16, because it runs the same check.
   - The comments of phase 10.3 go through `cstack tracker comment <key> --body-file <file>`. Phase 12 moves the ticket to "in review" with `cstack tracker move`.
   - When a tracker command exits with `4`, the guide tells Claude to make that write with its own connection, as today.
3. Update the README. It says what `cstack wave` and `cstack wave --watch` do, that Orca is optional, and which Orca version is the minimum. Keep the "Requirements" section in line with `cstack doctor`, so that the test of #10 passes.
4. Make `cstack measure` count the helpers that worked in other folders.
   - A session file counts when its `cwd` is inside the repository root, as #11 does today. It also counts when its `cwd` is inside one of the `Worktree` paths of the plan file. The time span rule of #11 stays for both.
   - The Orca workers of the run that work in the ticket worktree, such as the executor, are main session files in that folder. The rule of #11 already counts them. Add a test that proves it.
   - A child worktree is usually removed by the time you measure. Compare its path as the plan file writes it, and resolve symbolic links only for folders that still exist.
   - Never count a session of another worktree of the same repository whose path the plan file does not name. A session of another ticket of the wave works in such a folder. This holds even when that worktree sits inside the repository folder, so check the `cwd` against `git worktree list --porcelain` first.
   - `cstack measure` still prints numbers only. It never prints a path from the plan file or from a session file.
5. Write `cstack/test/manifest-placeholders.test.ts`. It fails when a command of `cstack/src/manifest.ts` still has a placeholder handler from #24.
6. Write the automated end-to-end tests.
   - Each test creates a small repository in a temporary folder, with a plan file whose two units can run at the same time.
   - Write fake `orca` and `gh` programs in `cstack/test/e2e/bin/`. They replay the recorded answers of #24 and #26 and log their arguments. The tests put them first on `PATH`.
   - `cstack/test/e2e/orca.test.ts` runs the whole chain with the fake Orca. It covers the wave, the executor as a worker, the two implementers in child worktrees, the collect in plan order, and the tracker writes.
   - `cstack/test/e2e/no-orca.test.ts` runs the same chain three times. First there is no `orca` on `PATH`. Then the fake Orca says it is too old. Last, it says that the app does not run.
7. Run the chain by hand, as the maintainer, on a small test repository.
   - Create a repository on GitHub that holds no work data, with one milestone of three tickets. Ticket two is blocked by ticket one.
   - With Orca running, run `cstack wave --milestone <name>` and answer yes. Check the Orca worktree of ticket one and the first message of Claude there.
   - Take ticket one to the approval gate and approve it. Check in Orca that the executor and the implementers run as workers, and that the main conversation gets no message before the executor's `worker_done`.
   - In another terminal, run `cstack wave --watch` on the milestone. Merge the pull request of ticket one, then check the notification and the question about ticket two.
   - When ticket one is ready for review, run `cstack measure` on its plan file. Check that the number of main sessions includes one session for each implementer that ran in a child worktree.
   - Quit Orca. Run `cstack wave` on a second milestone, and check the git worktrees and the printed commands. Run `resolve-issue` there, and check that the helpers run as sub-agents.
   - Test Jira and Linear through Orca only on a sandbox project that holds no work data. If you have no such sandbox, say in the pull request that these two paths are covered only by recorded answers. Never run this ticket against a work tracker.
   - Write in the pull request what you ran and what you saw. Write no work name, no work ticket key and no count from work.
8. Publish the release. Raise the version in `cstack/package.json`, then push the tag `v<version>`. Install the release with `npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/cstack-<version>.tgz`, then run `cstack skills install` and `cstack doctor`.

### Acceptance (TDD)

* US-13 AC1: "When Orca is available, the executor and each implementer run as Orca workers. An Orca worker ends with an explicit final report, and Orca wakes the coordinating conversation only then." In `cstack/test/e2e/orca.test.ts`, write first a case where the fake Orca sends the executor's `worker_done` only after both implementers have sent theirs. See `cstack helper wait` for the executor return only after that last message. The run by hand of step 7 confirms it in a real Orca, and the pull request says what you saw.
* US-14 AC3: "After the user says yes, and when Orca is available, each ready ticket gets an Orca worktree linked to its ticket key. Claude starts in that worktree with `/resolve-issue <key>`." In `cstack/test/e2e/orca.test.ts`, write first a case where the user answers yes. See the fake Orca log one `worktree create` with `--reference <ticket URL>`, `--agent claude` and `--prompt "/resolve-issue <key>"`. In the run by hand, `orca reference find <ticket URL>` lists the new worktree, and Claude's first message there is `/resolve-issue <key>`.
* `cstack/test/e2e/no-orca.test.ts`: Write first a case with no `orca` on `PATH`, and see the wave create git worktrees and print one command per ticket. Then `cstack helper start` asks for a sub-agent, and the tracker commands go through `gh`. Without `gh`, they exit with `4`. The same chain works when the fake Orca is too old, and when it does not run.
* `cstack/test/measure-worktrees.test.ts`: This test uses hand-written session files in `cstack/test/fixtures/measure/`, never real ones. Write first a case where a worker session works in a child worktree named by a `Worktree` line of the plan file, inside the time span of the run. See its tokens counted. Then a session of another ticket's worktree of the same repository, in the same time span, adds nothing. A worker session in the ticket worktree, such as the executor's, is counted once. A child worktree folder that no longer exists still matches its `Worktree` line. The output holds no path.
* `cstack/test/manifest-placeholders.test.ts`: Write first a case with one placeholder handler left, and see the test fail. Then no placeholder is left. The tests of #13 and #23 pass, so every command that a guide names exists, and every listed command is implemented.
* After the release, `npm install -g <release link>` installs the new version, and `cstack --version` prints it. `cstack doctor` lists the Orca features of #24.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* No recorded answer, no file of the test repository and no text of the pull request holds a work name, a work ticket key, a count from work, or a path from the maintainer's machine. The test of #24 on recorded answers passes.

**Size: M** · Blocked by: #25, #26, #27, #28, #29, #30, #23 · Feeds: #32

### Ticket comments

Comment of 2026-11-19T10:53:51Z:

This is a hand-down from #23 for whoever resolves this ticket.

The scripted end-to-end test lives in `cstack/test/e2e/resolve-issue.test.ts`, with its fixtures in `cstack/test/fixtures/e2e/`. It builds `cstack/src` once into a temporary folder with the repository's TypeScript compiler, and it never writes to the real `cstack/dist/`. It then runs each command as `node <temporary folder>/dist/bin.js` in a child process. The environment of those processes is built from scratch, with a temporary home folder, so the test never touches the real `~/.claude`.

The project under test is a small Node project with a `main` branch. Its remote is a bare repository reached through git's `url.<path>.insteadOf` setting, and a `pre-receive` hook in it logs every push. The fake `gh`, `glab` and `ssh` come from `writeFakePrograms` in `cstack/test/helpers/publish-env.ts`, which `publish.test.ts` shares.

The test ties each command to its guide. For every `cstack` command it runs, it checks that the guide or prompt it follows names that command, with numbers and paths written back as `<n>` and `<plan file>`. The only extra flag it allows is `--grace 0` for `cstack publish`. You can extend the test by adding a step and its guide text in the same way.

One weak spot to know about: the step that resumes the retrospective checks the `cstack next` call against `plan.md`, which almost any guide would satisfy. Tighten it if your wiring changes that step.


Comment of 2026-11-19T14:03:08Z:

Ticket #25 is built on the branch `gambitl/tracker-jira-linear`. Here is what you can build on.

**Where things are.** `jiraOrcaTracker(run, env)` and `linearOrcaTracker(run, env)` are in `cstack/src/tracker/jira-orca.ts` and `cstack/src/tracker/linear-orca.ts`. The test fixtures are in `cstack/test/fixtures/orca/1.4.263/`. They were written by hand from the Orca code, not recorded.

**What an end-to-end run must expect.**
- A Jira list is refused when it holds 100 tickets or more.
- Jira blockers come from the footer of the description only.
- A Linear list by milestone exits with code 4, so Claude must write the file with its own connection. A Linear list by epic goes through Orca.
- A failed write exits with code 5. The message asks the user to check the ticket before trying again. Do not retry a write by hand.

**What to check on a real machine.** Two things were never verified without a sandbox. One is whether `orca linear list-issues --parent-id` accepts a key such as `EXA-9`, or needs the internal id. The other is whether Orca keeps the bold `**Size:` footer marker in a Jira Cloud description. Please check both when you run the real test.

**Wiring.** The adapters are not wired into `openTracker` yet. Whichever of #25 and #26 merges second does that and updates the command counts.


Comment of 2026-11-19T14:07:15Z:

Ticket #29 built `cstack wave` on the branch `gambitl/cstack-wave`. This comment tells you what the command creates, so the build guide and the end-to-end check can rely on it.

- Both ways create a branch and a worktree folder named after the short name. On Jira and Linear, it is the key in lower case, such as `abc-12`. On GitHub and GitLab, it is `issue-<number>`, such as `issue-12`. The build guide of #22 must keep a branch that `cstack wave` created.
- The Orca way runs `orca worktree create --repo path:<repository root> --name <short name> --branch <short name> --no-parent --reference <ticket URL> --agent claude --prompt "/resolve-issue <key>" --json`. The repository root is the main clone, which is the first entry of `git worktree list --porcelain`.
- The git way creates `<parent folder>/<repository folder name>-worktrees/<short name>` from `origin/<default branch>` and prints `cd '<folder>' && claude '/resolve-issue <key>'`.
- Before both ways, cstack skips a ticket whose branch `refs/heads/<short name>` exists. Orca would otherwise add a numeric suffix without saying so.
- The tests record the Orca answers by hand, because no real worktree may be created. US-14 AC3, Claude starting in the new worktree, is yours to check with a real Orca.

A question for the end-to-end check, word for word from the review before the plan: Orca starts the agent "as a chat or a terminal per your Chat | CLI choice for that agent", because the command does not give `--surface`. Please try `/resolve-issue <key>` in both the chat and the terminal surface, because nobody checked yet whether a slash command in `--prompt` runs the skill in the chat surface.


Comment of 2026-11-19T14:11:19Z:

Ticket #26 is built, so the guides can now call the tracker commands. This is what you build on.

The four commands are in `cstack/src/commands/tracker-read.ts`, `tracker-list.ts`, `tracker-move.ts` and `tracker-comment.ts`. The usage lines are in `cstack/src/manifest.ts`.

- `cstack tracker read '<key>'` prints one ticket as JSON.
- `cstack tracker list --milestone <name>` prints one JSON object with `format` (`cstack-tracker/1`), `tracker`, `group` and `tickets`. `--epic <key>` works on GitHub only. Because the output has the format of the file from Claude, it is also a valid `--from-file` input.
- `cstack tracker move '<key>' --to "in progress"` and `--to "in review"` are the only two states on GitHub and GitLab. It prints one line on success.
- `cstack tracker comment '<key>' --body-file <path>` adds a comment from a file.

Always write the key in single quotes, such as `'#12'`. The shell reads an unquoted `#12` as a comment, and the command then gets no key.

Exit code `4` means no client can serve the call. For `read` and `list`, Claude must then read the tracker with its own connection, write a file in the format `cstack-tracker/1`, and pass it with `--from-file <path>`. For `move` and `comment`, the message names the key and the state or the file, and Claude must make the change with its own connection. Exit code `1` means a bad key, a bad state name, a missing label or an unreadable file. A missing label prints the `gh label create` or `glab label create` command to run. `cstack` never creates a label.

`cstack skills install --add-permission` adds the rule `Bash(cstack *)` to `~/.claude/settings.json`. Without the option, the install prints the rule on standard error when it is missing. Do not change the install in a way that hides that hint.

Two limits to keep in mind. The rule does not cover writes that Claude makes with its own connection. It also lets Claude post a file as a comment, so `cstack tracker comment` accepts only a file inside the repository or a temporary folder, which is not empty and holds at most 65,536 bytes. Jira and Linear are not wired yet. `openTracker` refuses them with a message that names ticket #25.



Comment of 2026-11-19T14:17:01Z:

Ticket #27 built `cstack helper start`, `wait` and `done` on the branch `gambitl/helpers-orca-workers`. Your guides and prompts need to call them.

How the main conversation uses them: run `cstack helper start <role> --plan <file> [--unit <n>]`. Exit 0 means an Orca worker started, and the helper id is the first line of output. Exit 6 means Claude must start the named sub-agent, whose inputs are printed. Then run `cstack helper wait <helper id>` with a shell timeout of ten minutes, because it waits up to nine. Exit 0 prints the accepted report. Exit 6 means the helper still works, so end the turn, because Orca wakes the conversation. Exit 6 with a message about a question means a person must answer in Orca. Exit 1 means launch the helper again.

How a helper ends: it runs `cstack helper done <kind> --helper <helper id> --plan <file>` with the report on standard input. The spec file that `helper start` writes already says so. The prompts under `cstack/skills/resolve-issue/agents/` still end with `cstack report submit`, so change them. For a sub-agent, the main conversation must run `helper done` with the sub-agent's report text, then `helper wait`.

Please check against a real Orca: how long `worker-show` keeps a finished worker (a "not found" answer makes `helper wait` exit 5), and which status a stopped worker gets. The switch `CSTACK_ORCA_WORKERS=off` forces sub-agents. A worker is a full session and may use more tokens than a sub-agent.


Comment of 2026-11-19T16:29:41Z:

Ticket 28 is built on the branch `gambitl/child-worktrees`. This is what you can build on.

**Commands.** `cstack helper start implementer --unit <n> --child-worktree` starts an implementer in a new child worktree (code in `cstack/src/helper/start.ts` and `cstack/src/helper/child.ts`). `cstack unit collect <n>...` brings the commits back onto the ticket branch and then releases the workers and removes the clean child worktrees (code in `cstack/src/unit/collect.ts` and `cstack/src/commands/unit-collect.ts`). Both are built in the manifest.

**What the guides must tell the executor.** Start the units of a batch with `--child-worktree`. Start only the units of the first batch of `cstack unit order`, because the start refuses a unit that shares a file with a unit that is still running. After each batch, run `cstack unit collect` with the unit numbers, in any order. Before the final report, commit the plan file, because cstack writes a `- Worktree:` line under each unit that ran in a child worktree.

**Rules that you must not break.** A start with `--child-worktree` needs the ticket worktree to be on the branch of the plan and to have no uncommitted change outside the plan file. When only one unit can run, or when Orca lacks the feature, the helper starts in the current worktree and says so. A second attempt must use `implementer-escalation`, which reuses the same folder. A new `implementer` start for a unit that was not collected is refused.

**Things to check on the real run.** Orca must accept a commit hash as `--base-branch`. The `workspace` field of the `worker-start` answer must hold the path of the child worktree. Both rest on the recorded answers and on Orca 1.4.263.

**For `cstack measure`.** The helper records now have an optional `worktree` with its `path` and `branch`, and the fields `released` and `collectedAt`. Use them to count the helpers that worked in child worktrees.


Comment of 2026-11-19T17:13:15Z:

A heads-up for this ticket. Ticket #59 added a paragraph about the rules of a run's brief to `cstack/guides/resolve-issue/ticket.md`.

After that change, `cstack/test/skill-size.test.ts` has only 2 words of room left. The test counts the entry skill (836 words) plus the first guide, which is `ticket.md` (613 words). The sum is 1,449 words, and the limit is 1,451.

This ticket adds the `cstack tracker read` step and its fallback to the same guide. That needs far more than 2 words. So this ticket has to make room, either by shortening sentences of `ticket.md` or of the entry skill.

When you shorten the new paragraph, keep what `cstack/test/guides/brief-rules.test.ts` looks for in it: `## Decisions`, "from the brief of the run", "secret", "ask the user", "gate" and "settings file". The test checks these words inside one paragraph, not whole sentences.


Comment of 2026-11-19T17:23:13Z:

Ticket #30 built `cstack wave --watch`. This comment lists what you can rely on when you wire it into the guides and test it end to end.

- The code is in `cstack/src/wave/watch.ts`. The command `wave()` takes the watch dependencies (clock, sleep, Control-C hook, input stream) as a fourth parameter with a default value, so `cstack/src/cli.ts` did not change. Tests give a fake clock, as `cstack publish` does.
- `cstack/src/wave/start.ts` holds `startTicket`, the one function that starts a ticket. Both `cstack wave` and the watch call it. It checks the key, reads the ticket again, applies the ready rule again and checks that the branch does not exist.
- How the watch ends: after Control-C (exit 0), when standard input closes (exit 0), when no ticket is blocked and every ready ticket was offered (exit 0), or after three failed reads in a row (the exit code of the last error). Exit 5 means that a start failed, or that Control-C cut a start while the worktree was being created.
- Before each start, the watch runs exactly one `git fetch origin`. `cstack wave` without `--watch` still fetches once.
- A line typed while no question waits is ignored, and the watch prints one line that says so. A stray `y` cannot start a ticket. One small gap remains: a half-typed `y` without Enter stays in the terminal and counts if you press Enter at the next question.
- The notification uses `/usr/bin/osascript`, so it needs macOS. On another system the watch says once that the notification failed and asks in the terminal only. macOS must allow notifications for Script Editor. For your hand test in the scope, check the notification on a real Mac, because the tests never run `osascript`.
- Do not run `cstack wave --watch` against a work tracker. The watch needs an interactive terminal, so a pipe is refused.
- `--watch` is no longer an unbuilt flag. The wave entry of `cstack/src/manifest.ts` has no `notBuiltFlags`. The README has a sentence about `--watch`. You still have to keep the README in line with `cstack doctor`.
- Question for the Orca maintainers, word for word: "When `orca worktree create` gets no `--base-branch`, does it fetch the remote first, and does it branch from the remote default branch or from the local one?" Your end-to-end test with Orca can show the answer. If Orca does not fetch, a later ticket may need to pass `--base-branch`.



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

The tracker lists seven blockers: #23, #25, #26, #27, #28, #29 and #30. All seven are closed as completed.

## Code mapping

The map comes from reading the code on `main` at commit 94da8ba, and from two explorations: one of the tests that pin the text of the guides and prompts, and one of the fake programs and recorded answers.

### Scope item 1: the ticket guide

- `cstack/guides/resolve-issue/ticket.md` line 9 still says "Fetch the ticket through the direct connection to the tracker". Nothing in the guides calls `cstack tracker read` yet.
- `cstack tracker read <key> [--tracker <name>] [--from-file <path>]` is built (`cstack/src/commands/tracker-read.ts`, `cstack/src/tracker/open.ts`). It prints one JSON object with `key`, `title`, `body`, `url`, `stateName`, `stateKind` and `blockers`. It does not print the labels, the parent, the comments or the suggested branch name, so the guide must still get those another way.
- `--tracker` takes only `jira`, `linear`, `github` or `gitlab`, in lower case. Without it, cstack reads the host of the origin remote, which gives `github` or `gitlab` and is wrong for Jira and Linear. The `Tracker:` line of the plan header holds a capitalised name such as `GitHub`, and the header is written after the ticket is read.
- Exit code 4 means no client can read the tracker. The message asks Claude to write a file in the format `cstack-tracker/1` and to pass it with `--from-file <path>`. The file format is documented nowhere for Claude. It is only in `cstack/src/tracker/claude-file.ts`: top keys `format`, `tracker`, `tickets` and an optional `group`; each ticket has exactly `key`, `title`, `body`, `url`, `stateName`, `stateKind` (`todo`, `in-progress`, `finished` or `unknown`) and `blockers` (a list of `{key, stateKind}` or the word `unknown`). Unknown keys are refused with exit code 3.
- `cstack/test/skill-size.test.ts` counts `cstack/skills/resolve-issue/SKILL.md` (836 words) plus `ticket.md` (578 words). The sum must stay at 1,451 or less, so 37 words are left.
- `cstack/test/guides/brief-rules.test.ts` takes the first paragraph of `ticket.md` that contains "brief" and checks six key words in it. A new paragraph above it that contains "brief" or "briefing" breaks the test.

### Scope item 2: the build guides and the prompts

- The executor is launched in `cstack/guides/resolve-issue/plan.md`, section "Hand off to the executor" (lines 47-60), as a sub-agent, then `cstack report check` reads its report. The same launch and check appear again in `cstack/guides/resolve-issue/retro.md` line 25, which relaunches the executor for the `publish` phase. `cstack/skills/resolve-issue/SKILL.md` line 22 names the heading "Hand off to the executor", so that heading must keep its name.
- `cstack/guides/resolve-issue/build.md` "Start" (lines 7-9) moves the ticket by hand and creates the branch named on the `Branch` line. "Build the units" (lines 11-16) launches `resolve-issue:implementer` sub-agents, one batch at a time, in one shared folder. "When a unit gets stuck" (lines 18-26) launches `resolve-issue:implementer-escalation`.
- `cstack/guides/resolve-issue/document.md` "Write back into the ticket" and "Hand the context down" (lines 9-15) write comments through the direct connection. In the old prose skill this was phase 10.3.
- The move to "in review" is step 1 of `cstack/guides/resolve-issue/publish.md`, exit code 0 (line 15). In the old prose skill this was phase 12. `ready.md` has no tracker write.
- `cstack/skills/resolve-issue/agents/executor.md` ends with four `cstack report submit <kind> --plan <plan file>` commands (lines 53-56). `implementer.md` and `implementer-escalation.md` end with a report returned as a message, with no command.
- `cstack helper start <role> --plan <file> [--unit <n>] [--child-worktree]` (`cstack/src/helper/start.ts`) refuses before approval. Exit 0 prints the helper id on the first line. Exit 6 prints "Sub-agent: resolve-issue:<role>", the inputs and a last line "Helper id: <id>", and records the helper in `sub-agent` mode.
- `cstack helper wait <helper id>` takes no `--plan` (`cstack/src/helper/wait.ts`). For a sub-agent helper it prints the saved report at once, or exits with 1 when none is saved. For an Orca worker it waits up to nine minutes, then exits with 6. It also exits with 6 when the worker waits on a person.
- `cstack helper done <kind> --helper <helper id> [--plan <file>]` (`cstack/src/helper/done.ts`) reads the report on standard input, runs the same checks as `cstack report submit`, saves it, and sends `worker_done` to Orca only for a worker. For a sub-agent it only saves. The spec text that Orca workers get (`cstack/src/helper/spec.ts` line 128) still says that a prompt may name `cstack report submit`.
- `cstack unit collect <n>... [--plan <file>]` (`cstack/src/unit/collect.ts`) cherry-picks the unit commits from the child worktrees in plan order, then releases the workers and removes the clean child worktrees.
- A start with `--child-worktree` refuses a unit outside the first batch of `cstack unit order`, and a unit that shares a file with a unit still running. It needs the ticket worktree on the plan's branch with no uncommitted change outside the plan file. When the unit is alone in its batch, or Orca lacks the feature, the helper runs in the current worktree and cstack says so. cstack writes a `- Worktree:` line under the unit in the plan file, so the plan file must be committed before the final report.
- `cstack wave` names the branch and the worktree after the key: `issue-<n>` on GitHub and GitLab, the key in lower case on Jira and Linear (`cstack/src/wave/names.ts`). `helper start` and `cstack publish` compare the current branch with the `Branch` line of the plan.
- On GitHub and GitLab, `cstack tracker move` accepts only "in progress" and "in review" (`cstack/src/tracker/states.ts`). On GitHub it adds one label and removes the other.

### Scope item 3: the README

- `README.md` "Requirements" already says that Orca is optional and that `cstack doctor` prints the minimum version. The minimum is `MIN_ORCA_VERSION = "1.4.259"` in `cstack/src/orca/version.ts`. `cstack/test/readme-requirements.test.ts` ties the bold names of that section to `requirements` of `cstack/src/doctor/requirements.ts`.
- "Commands" already describes `cstack wave` and `--watch` (lines 71-72). It says "twenty-three commands"; this ticket adds no command.
- "Measure a run" (lines 74-93) describes the rule of #11 and must describe the new rule of scope item 4.

### Scope item 4: `cstack measure`

- `cstack/src/measure/sessions.ts` `measureSessions(home, root, start, end)` counts a session file when one of its `cwd` values, resolved through `resolveLoose`, is the repository root or inside it, and its time span overlaps the run. It then adds the transcripts under `<session>/subagents/`. `root` is the real path of the top folder of the plan file's worktree (`cstack/src/measure/moments.ts`).
- The plan reader returns `unit.worktree` for a `- Worktree:` line (`cstack/src/plan/read.ts` line 392). `readMoments` reads the plan only for a version 1 plan file.
- No code reads `git worktree list --porcelain` in `measure`. Another worktree that sits inside the repository folder is counted today.
- The tests are in `cstack/test/measure.test.ts`, with hand-written session files under `cstack/test/fixtures/measure/<case>/.claude/projects/...` that use the placeholder `{{REPO}}`, replaced when the test copies them.

### Scope item 5: placeholder handlers

- Every entry of `COMMANDS` in `cstack/src/manifest.ts` has `built: true` today. `cstack/test/manifest-implemented.test.ts` (from #23) checks that each listed command is implemented. A placeholder handler is a handler that refuses with "is not built in this version yet" (`unbuiltRefusal` in `cstack/src/manifest.ts`), or a `notBuiltFlags` entry.

### Scope item 6: the end-to-end tests

- `cstack/test/e2e/resolve-issue.test.ts` (from #23) compiles `cstack/src` once with `tsc` into a temporary folder, links `guides`, `skills` and `package.json` there, and runs `node <temp>/dist/bin.js` in child processes. It builds their environment from scratch, with a temporary home folder. It ties each command it runs to the text of its guide with `written()` and `follow()`. Its functions use module-level variables, so another test file cannot import them.
- `writeFakePrograms` in `cstack/test/helpers/publish-env.ts` writes fake `gh`, `glab` and `ssh` scripts that log their calls and answer from `scenario.json`. It writes no `orca`.
- Orca fakes elsewhere are in-process runners (`cstack/test/fakes/orca-run.ts`, `cstack/test/helpers/wave.ts`). In the helper tests, the fake runner itself runs `git worktree add` to create the child worktree, then answers `new-child.json` with the path (`cstack/test/helper/child-worktree.test.ts` lines 31-37).
- cstack runs `orca` from `PATH`, or the program in `ORCA_CLI_COMMAND` (`cstack/src/orca/call.ts`). It adds `--json` to every call except `--version`. Feature detection runs `orca --version` (too old below 1.4.259), then `orca status --json` (the app does not run when `result.app.running` or `result.runtime.reachable` is not `true`), then `orca agent-context --json`.
- The recorded Orca answers are in `cstack/test/fixtures/orca/1.4.263/`. Every `.json` file there needs a shape in `cstack/src/orca/shapes.ts` (`cstack/test/orca/shapes.test.ts`). There is no recorded answer for `orchestration worker-release` or `worktree rm`, and all `worker-start` answers use the same dispatch id. The recorded `gh` answers are in `cstack/test/fixtures/gh/2.101.0/`, for the repository `example-owner/example-repo`. Its milestone list has two ready tickets, #3 and #4.
- `cstack wave` asks its question only when standard input is a terminal (`cstack/src/commands/wave.ts` line 41). Its dependencies (`WaveDeps`) take `isTerminal`, `readAnswer`, `run` and `runLong`, so a test can call it in process with a scripted "y".
- `cstack/test/fixtures-public.test.ts` scans only `cstack/test/fixtures/` for `/Users/` paths, private emails and private hosts.

### Patterns and constraints

- A command prints through `io`, returns its exit code and never calls `process.exit()` (ADR-SIC-H).
- A key such as `#12` is always written in single quotes, as `'#12'`, because the shell reads an unquoted `#12` as a comment.
- `cstack/test/manifest.test.ts` scans every guide and prompt for `cstack ...` mentions. The leading words must name a command, and every flag must belong to it. It ignores flags written after a `<placeholder>`.
- `cstack/test/guides/settings-applied.test.ts` refuses words such as "npm test", "vitest run" and any word starting with "rebas" in a guide or prompt, unless the file names the `integration` setting.
- `cstack/test/prompts.test.ts` pins the prompts: `executor.md` must hold exactly the four commands `cstack report submit done`, `failed`, `needs-decision` and `published`; `implementer.md` must name `cstack unit red` before `cstack unit green`, and `cstack unit commit` not before `cstack unit green`; exactly one sentence of all guides and prompts names "git push".
- `cstack/test/e2e/resolve-issue.test.ts` pins `cstack report submit done --plan <plan file>` in `ready.md` (lines 153 and 353), `cstack report check --plan <plan file>` in `retro.md` (line 359), and `cstack publish --plan <plan file>` and `report submit published` in `publish.md`.
- `cstack/test/helper/spec.test.ts` pins the `model:` and `effort:` lines of the three helper prompts.

### Risks

- The 37 words of room in the ticket guide are far too few for the new read step and its fallback. Words must move to another file.
- `cstack/test/e2e/resolve-issue.test.ts` and `cstack/test/prompts.test.ts` break as soon as the executor's report moves to `cstack helper done`. Each unit that changes a pinned sentence must change its test in the same unit.
- On this machine, a real Orca is on `PATH`, and the shell sets `ORCA_TERMINAL_HANDLE` and other `ORCA_*` variables. A test that copies `process.env`, or keeps the real `PATH` without a fake `orca` first, would call the real app.
- `cstack/package.json` says `"type": "module"`. An extensionless script that uses `require` fails under `cstack/test/e2e/bin/`.
- `gh`, `node` and `git` live in the same Homebrew folder on this machine, so a `PATH` that drops `gh` also drops `node`.
- Each end-to-end file compiles cstack on its own, and vitest runs files in parallel. Two more compiling files slow the suite.
- `cstack helper wait` makes each turn last at least five seconds of real time, so an end-to-end wait that loops costs real seconds.
- `cstack/src/measure/sessions.ts` was fixed twice after #11 (`1b14cb2`, `3cea4ab`), for double counting and for unreadable folders.

### Governing decisions

- ADR-SIC-A (`docs/decisions/ADR-SIC-A-helpers.md`): helpers are Orca workers when Orca offers workers, and sub-agents otherwise. Both ways use the same report check. `CSTACK_ORCA_WORKERS=off` forces sub-agents. "The prompts of the helpers, the plan and the report check stay the same."
- ADR-SIC-F (`docs/decisions/ADR-SIC-F-tracker-access.md`): cstack never holds credentials. When no client can serve a call, Claude uses its own connection.
- ADR-SIC-H: commands print through `io` and return their exit code.
- `WHY:` comments in `cstack/src/helper/spec.ts`, `start.ts` and `done.ts`: no ticket, plan or report text ever reaches an Orca command line.

## Decisions

- This run builds the first half of ticket #31. That half is scope items 1 to 6, and the version raise of item 8. The version becomes `0.3.0` in `cstack/package.json` and `cstack/package-lock.json`, for example with `npm version 0.3.0 --no-git-tag-version` in `cstack/`. All of it goes into one pull request. (2026-11-19, from the coordinator of the wave)
- The coordinator does the second half after the merge, with the user's approval at each step. That half is the run by hand of scope item 7, the tag `v0.3.0`, and the install of item 8. This run never pushes a tag, never installs anything, and never runs the steps of item 7. (2026-11-19, from the coordinator of the wave)
- Some acceptance criteria need a real Orca or a real release. Examples are the run by hand of US-13 AC1, `orca reference find` for US-14 AC3, and the install. Check every other part of the acceptance with tests. The pull request lists what the coordinator still checks by hand. (2026-11-19, from the coordinator of the wave)
- The pull request body says "Part of #31". It never says "Closes #31", "Fixes #31" or "Resolves #31", because the ticket stays open until the coordinator's run by hand. The body has a short paragraph titled "After the merge" that lists the coordinator's steps, as pull request #51 did for #23. (2026-11-19, from the coordinator of the wave)
- Tickets #21 to #30 are all merged. Some steps of scope items 1 and 2 may already be done, so build on what `main` holds, not on what the ticket says. (2026-11-19, from the coordinator of the wave)
- `main` holds the paragraph of #59 in the `ticket` guide, and the 14 changes of the retrospective digest (pull request #62) in the guides and prompts. Keep all of them when you change the same files. The file `docs/retros/reviewed/2026-11-19-digest.md` lists them. (2026-11-19, from the coordinator of the wave)
- `cstack/test/skill-size.test.ts` counts the words of `cstack/skills/resolve-issue/SKILL.md` and `cstack/guides/resolve-issue/ticket.md` together. The digest left 37 words of room for the change to the `ticket` guide. If the change needs more, move details into another guide, or shorten a sentence that another part already says. Never raise the limit of the test without asking the user. (2026-11-19, from the coordinator of the wave)
- This run follows the guides of the installed `cstack` 0.2.0, which `cstack next` prints. This branch changes the source of those guides and prompts. Keep following the installed guides during this run, and never install this branch's version. (2026-11-19, from the coordinator of the wave)
- Every sentence added to a guide, a prompt, the README or a documentation file follows the documentation writing rules. Put one idea in each sentence, and give each sentence a subject and a verb. Keep sentences under about 25 words, and never follow a colon or a dash with a fragment. (2026-11-19, from the coordinator of the wave and the documentation writing rules of the session)
- Ticket #64 adds one or two sentences to step 7 of `cstack/skills/resolve-issue/agents/implementer.md`, about `cstack unit commit --message`. It also changes the usage line of `cstack unit commit` in `cstack/src/manifest.ts`. Leave those two places to #64. (2026-11-19, from the coordinator of the wave)
- Ticket #63 changes what `cstack unit red` and `cstack unit green` refuse. If an end-to-end test runs these commands or `cstack unit commit`, write it the way an honest implementer works. The test file comes first, then the failing run, then the code. Whoever merges second runs the tests of both branches. (2026-11-19, from the coordinator of the wave)
- Ticket #65 changes `cstack/test/report.test.ts` and one sentence of `CLAUDE.md`. Leave both to #65. (2026-11-19, from the coordinator of the wave)
- The end-to-end tests use fake `orca` and `gh` programs in `cstack/test/e2e/bin/`. A test never calls the real `orca`, `gh`, `glab` or `osascript`. (2026-11-19, from the coordinator of the wave)
- Only this ticket changes the version in `cstack/package.json` and `cstack/package-lock.json`. Nobody in this run pushes a tag. Never push a tag that starts with `v`. (2026-11-19, from the coordinator of the wave)
- Give each behaviour and its test to the same unit. When an earlier unit already builds what a later unit's test checks, that test passes at once, and the later unit cannot prove that its test failed first. (2026-11-19, from the coordinator of the wave)
- Some tests check every command or every shipped skill: `cstack/test/cli.test.ts`, `cstack/test/manifest-implemented.test.ts` and `cstack/test/skills-install.test.ts`. When a unit adds or changes a command or a skill, read those tests. Put on the unit's `Files` line the files they make you change. (2026-11-19, from the coordinator of the wave)
- Copy each open non-blocking question of the question round under `## Non-blocking questions`, word for word, with who it is for. (2026-11-19, from the coordinator of the wave)
- When the coordinator sends a new message before the approval gate, write each rule or answer it gives into `## Decisions` too. (2026-11-19, from the coordinator of the wave)
- The executor never builds a unit itself, even one of a few lines. Each unit goes to an implementer, which runs `cstack unit red` and `cstack unit green`. (2026-11-19, from the coordinator of the wave)
- The executor writes each Hand-off log entry and each line of Executor notes only once. (2026-11-19, from the coordinator of the wave)
- Before `cstack unit red` has saved a failure, an implementer changes only test files and their fixtures. It writes no source code before that. It never moves code aside to get a failure. A new module that does not exist yet is a fine first failure. (2026-11-19, from the coordinator of the wave)
- An implementer writes a test case for each behaviour, exit code and message that the unit or a line of `## Decisions` asks for. (2026-11-19, from the coordinator of the wave)
- An implementer never runs `git add`, `git commit`, `git commit --amend` or `git stash`. The stash is shared by every worktree of this repository, so another run could take the changes. (2026-11-19, from the coordinator of the wave)
- A new worktree has no `node_modules`. Run `npm ci` in `cstack/` before the first type check or test run. (2026-11-19, from the coordinator of the wave)
- The full `npm test` takes about 90 seconds. Give the shell call a timeout above two minutes. When the machine is busy, `cstack/test/report.test.ts` can pass the five-second timeout of vitest. When only that file fails, run it alone before you look for a bug. (2026-11-19, from the coordinator of the wave)
- On macOS, an in-place edit with `sed` needs an empty suffix, as in `sed -i ''`. (2026-11-19, from the coordinator of the wave)
- The stops of the skill are the blocked ticket, the question round, the approval gate of the plan and the questions after the build. Each stop goes to the user in the chat of the main conversation, and never to the coordinator. Nobody answers a stop in the user's place. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-19, from the coordinator of the wave)
- Only the main conversation talks to the coordinator, and only about coordination, such as the state of another ticket of the wave. (2026-11-19, from the coordinator of the wave)
- The conversation with the user is in French. Everything written in the repository and on GitHub stays in English. (2026-11-19, from the coordinator of the wave)
- Never merge the pull request, because the user merges it. Never read, run or change anything under `~/comparison/`, which holds private work data. Never install Graphify or Repowise. (2026-11-19, from the coordinator of the wave)
- Never call a Jira or Linear connection, and never run `glab`, because they reach work trackers. (2026-11-19, from the coordinator of the wave)
- Never run real `orca orchestration` commands that start, message or release workers. Never run `orca worktree create` or `orca worktree rm`. Never run `cstack wave` or `cstack wave --watch` for real. Run `git worktree add` only inside a temporary test repository. (2026-11-19, from the coordinator of the wave)
- Never run `npm install -g`, `npm link` or `cstack skills install` on this machine, and never change anything under `~/.claude/skills/`. Any of these would change the tool and the skill that every worker of this wave runs right now. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. (2026-11-19, from the coordinator of the wave)
- Never change `.cstack/settings.json` in this branch. The test commands come from that file on `main`, and the independent review refuses a branch that changes it, because the file names the reviewer. (2026-11-19, from the coordinator of the wave)
- If the skill or `cstack` 0.2.0 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-19, from the coordinator of the wave)
- This repository is public. Never write the name of an employer or a client, a work ticket key, or a count from work retrospectives. Never write a path from the maintainer's machine, such as one that starts with `/Users/`. This covers files, test fixtures, commits, the pull request, ticket comments, the plan file and the retrospective. (2026-11-19, from the coordinator of the wave)
- The history of this repository was rewritten on 2026-11-18 to remove private names, so do not undo that work. Every commit carries the GitHub no-reply address, the one that ends in `@users.noreply.github.com`, as author and as committer. (2026-11-19, from the coordinator of the wave)
- Before `cstack publish`, run two checks, and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository. Then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. It never prints a name, and you must never print the private list yourself. (2026-11-19, from the coordinator of the wave)
- Before the pull request opens, the "update branch" phase brings `main` into the branch with a rebase, as the settings say. (2026-11-19, from the coordinator of the wave)
- After the pull request is open, wait until the coordinator asks for an update. Then take `origin/main` into the branch with a merge commit, and keep both changes. Push it with a plain `git push`, without force. (2026-11-19, from the coordinator of the wave)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. In wave 7, one branch pushed a commit that still held conflict markers. (2026-11-19, from the coordinator of the wave)
- When you update the branch onto `main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates in the plan file and in the commits. (2026-11-19, from the coordinator of the wave)
- The prose skills in the top-level `skills/` folder are frozen at the tag `prose-skills-final` (ADR-SIC-E). Read them as the reference for the old behaviour, but never edit anything under `skills/`. New skill files go under `cstack/skills/` and `cstack/guides/`. (2026-11-19, from the coordinator of the wave)
- When the `cstack` check of continuous integration is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-19, from the coordinator of the wave)
- Every guide and prompt writes a ticket key in single quotes, such as `cstack tracker move '#12' --to "in progress"`. The shell reads an unquoted `#12` as a comment. (2026-11-19, assumption not asked)
- When a guide changes a sentence that a test pins, the same unit changes that test. The pinning tests are `cstack/test/prompts.test.ts`, `cstack/test/e2e/resolve-issue.test.ts`, `cstack/test/guides/brief-rules.test.ts`, `cstack/test/skill-size.test.ts`, `cstack/test/manifest.test.ts` and `cstack/test/guides/settings-applied.test.ts`. (2026-11-19, assumption not asked)
- A guide or prompt that runs `cstack helper wait` tells the reader to give that shell call a timeout of ten minutes, because the command waits up to nine. (2026-11-19, assumption not asked)
- When the `Tracker:` line names a tracker that cstack does not know, the guides tell the reader to use their own connection for every read and write of the tracker, as before. (2026-11-19, assumption not asked)
- `cstack report submit` and `cstack report check` stay built and keep their README lines. No guide or prompt names them after this ticket, but this ticket removes no command. (2026-11-19, assumption not asked)
- This ticket does not change `cstack/src/helper/spec.ts`. Its sentence that a prompt "may name another way to send your final report" stays as a guard. (2026-11-19, assumption not asked)
- When `git worktree list --porcelain` fails, `cstack measure` exits with 1 and prints a fixed sentence on standard error, with no path. It never falls back to the old rule, because that rule can count the sessions of another ticket. (2026-11-19, assumption not asked)
- The new placeholder check lives in a test helper, `cstack/test/helpers/manifest-placeholders.ts`, and not in `cstack/src/manifest.ts`, which #64 changes at the same time. A placeholder is an entry of `COMMANDS` with `built: false`, or with a `notBuiltFlags` entry. (2026-11-19, assumption not asked)
- Phase 1 reads the ticket with `cstack tracker read '<key>' --tracker <name>`. The name is `jira`, `linear`, `github` or `gitlab`, taken from the ticket URL or id, or from the conventions file. Phase 1 writes the same tracker on the `Tracker:` line of the plan header. (2026-11-19, the user's answer, accepted by default)
- Every later guide passes `--tracker <name>` to a `cstack tracker` command, where the name is the `Tracker:` line of the plan header in lower case. Without `--tracker`, cstack guesses from the origin remote, which is wrong for Jira and Linear. (2026-11-19, the user's answer, accepted by default)
- `cstack tracker read` prints only the key, title, body, URL, state and blockers. So the ticket guide still asks the reader to capture the labels, the parent, the comments, the relations and the suggested branch name with their own connection. (2026-11-19, assumption not asked)
- When `cstack tracker read` exits with 4, the reader reads the ticket with their own connection, fills the example file `templates/tracker-file.json` of the skill folder, and runs the same command again with `--from-file <file>`. The example file is `cstack/skills/resolve-issue/templates/tracker-file.json`, in the format `cstack-tracker/1`, with one ticket. A test runs it through the file reader of `cstack/src/tracker/claude-file.ts`. (2026-11-19, the user's answer, accepted by default)
- The change to `cstack/guides/resolve-issue/ticket.md` adds at most 37 words net, so that `cstack/test/skill-size.test.ts` passes without a new limit. No new sentence above the paragraph about the brief of the run contains the words "brief" or "briefing", because `cstack/test/guides/brief-rules.test.ts` reads the first paragraph that contains "brief". (2026-11-19, from the coordinator of the wave and the code mapping)
- The comment of the `Branch` line in `cstack/skills/resolve-issue/templates/plan.md` tells the reader to write the current branch when its name is the short name that `cstack wave` gives the ticket, such as `issue-12` or `abc-12`. Otherwise the reader writes a new branch name. The build guide keeps that branch instead of creating one. (2026-11-19, the user's answer, accepted by default)
- A helper always ends with `cstack helper done <kind> --helper <helper id> --plan <plan file>`, with the report on standard input. This holds whether it runs as an Orca worker or as a sub-agent. A second `cstack helper done` for the same helper is refused, so the main conversation never runs it for a helper. (2026-11-19, the user's answer, accepted by default)
- When `cstack helper start` exits with 6, the reader starts the sub-agent that cstack names, with the inputs that cstack printed. The helper id that cstack printed on its last line is one of those inputs. (2026-11-19, the user's answer, accepted by default)
- For a helper that runs as a sub-agent, the reader runs `cstack helper wait <helper id>` only after the sub-agent has returned. On a sub-agent that still runs, the wait exits with 1, and exit 1 means "start the helper again", which would start a second helper on the same branch. (2026-11-19, the user's answer, accepted by default)
- A second `cstack helper wait` after an accepted report also exits with 1, because cstack marked the report as read. That exit is not a reason to start the helper again. (2026-11-19, the user's answer, accepted by default)
- The main conversation starts the executor with `cstack helper start executor --plan <plan file>`. Then it runs `cstack helper wait <helper id>` with a shell timeout of ten minutes. Exit 0 prints the kind of the report on its first line, then the report, which the guide handles as before. Exit 6 means the helper still works, so the main conversation ends its turn, and Orca wakes it when the report arrives. Exit 1 means no accepted report, so it starts the executor again with the same command, once. When the second executor also ends without an accepted report, it stops and tells the user. (2026-11-19, from the ticket)
- The `retro` guide relaunches the executor for the `publish` phase in the same way, with `cstack helper start executor` and `cstack helper wait`, and no longer names `cstack report check`. (2026-11-19, the user's answer, accepted by default)
- The heading "Hand off to the executor" of `cstack/guides/resolve-issue/plan.md` keeps its name, because `cstack/skills/resolve-issue/SKILL.md` names it. (2026-11-19, assumption not asked)
- The executor prompt lists the helper id among its inputs. Its four report commands become `cstack helper done done`, `cstack helper done published`, `cstack helper done needs-decision` and `cstack helper done failed`, each with `--helper <helper id> --plan <plan file>`. The `ready` and `publish` guides name the same commands. (2026-11-19, from the ticket)
- The executor reads the batches of `cstack unit order --plan <plan file>`. For each unit of the first batch, it runs `cstack helper start implementer --plan <plan file> --unit <n>`, and adds `--child-worktree` when the batch holds more than one unit. When cstack says that the helper runs in the current worktree, or when the helper runs as a sub-agent, the units of the batch share one folder. Then they run in parallel only when the settings give `testCommands.file`, as before. (2026-11-19, from the ticket)
- The executor waits for each implementer with `cstack helper wait <helper id>`, with a shell timeout of ten minutes. On exit 6, it runs the same wait again. (2026-11-19, from the ticket and assumption not asked)
- When `cstack helper wait` exits with 1 for an implementer, the helper ended without a report. The executor then saves a stuck report for it with `cstack helper done stuck --helper <helper id> --plan <plan file>`, saying that the helper ended without a report. Then it escalates the unit as for any stuck unit. A new `implementer` start would be refused while the unit's child worktree is not collected. (2026-11-19, assumption not asked)
- A stuck unit goes to `cstack helper start implementer-escalation --plan <plan file> --unit <n>`. cstack finds the stuck report itself and reuses the unit's child worktree. (2026-11-19, from the ticket)
- Once every unit of the batch has reported, the executor runs `cstack unit collect <n>... --plan <plan file>` with the unit numbers of the batch. A unit without a child worktree is skipped, so the command is safe for every batch. When it exits with 1, the executor returns a needs-decision report that quotes the message. Then it runs `cstack plan status --plan <plan file>` and starts the next batch. (2026-11-19, from the ticket and assumption not asked)
- The executor commits the plan file at the end of the build, because cstack writes a `- Worktree:` line under each unit that ran in a child worktree. (2026-11-19, from the comment of #28 on the ticket)
- The implementer prompt lists the helper id among its inputs, and its report ends with `cstack helper done <kind> --helper <helper id> --plan <plan file>`, where the kind is `done` or `stuck`. The escalation prompt says that the second attempt uses its own helper id. Neither change touches step 7 of `cstack/skills/resolve-issue/agents/implementer.md`, which #64 changes. (2026-11-19, from the ticket and from the coordinator of the wave)
- The build guide moves the ticket with `cstack tracker move '<key>' --to "in progress" --tracker <name>`. The `publish` guide moves it with `cstack tracker move '<key>' --to "in review" --tracker <name>`. When cstack refuses the state name, the reader picks one of the names that cstack prints. (2026-11-19, from the ticket)
- When `cstack tracker move` exits with 1 because a GitHub or GitLab label is missing, cstack prints the command that creates it. The reader never creates the label. In the build, the executor writes in the Hand-off log that the ticket could not be moved, with that command, and goes on. In the `publish` phase, it says so in its published report. (2026-11-19, the user's answer, accepted by default)
- The `document` guide writes each comment into a file in a temporary folder outside the repository, then posts it with `cstack tracker comment '<key>' --body-file <file> --tracker <name>`. This holds for the ticket and for each dependent ticket. (2026-11-19, from the ticket and assumption not asked)
- When a `cstack tracker` command that writes exits with 4, the reader makes that write with their own connection, as before. (2026-11-19, from the ticket)
- The "Requirements" section of `README.md` says that the minimum Orca version is `1.4.259`. `cstack/test/readme-requirements.test.ts` fails when that number differs from `MIN_ORCA_VERSION` in `cstack/src/orca/version.ts`. (2026-11-19, the user's answer, accepted by default)
- `cstack measure` counts a session file in this way. It reads the worktrees of the repository with `git worktree list --porcelain`, run in the measured root. For each `cwd` of the session, it takes the deepest listed worktree that holds it. The session counts when that worktree is the measured root, or when its path matches a `Worktree` line of the plan file. When no listed worktree holds the `cwd`, the session counts only when the path of a `Worktree` line holds it. The time span rule of #11 still applies to every session. (2026-11-19, the user's answer, accepted by default)
- `cstack measure` compares a `Worktree` path as the plan file writes it. It resolves symbolic links only for a folder that still exists. It compares both the `cwd` as written and the `cwd` resolved. A `prunable` entry of `git worktree list --porcelain` is still a listed worktree. (2026-11-19, from the ticket and the user's answer, accepted by default)
- The test of a removed child worktree writes the resolved path of the temporary folder in the `Worktree` line, as cstack does. On macOS, `/var` is a symbolic link to `/private/var`. (2026-11-19, the user's answer, accepted by default)
- `cstack measure` still prints numbers only. It never prints a path of the plan file or of a session file, and its error messages are fixed sentences. (2026-11-19, from the ticket)
- `cstack/test/fixtures-public.test.ts` also scans `cstack/test/e2e/`, where the fake programs live. (2026-11-19, the user's answer, accepted by default)
- The end-to-end tests never reach the real Orca or the real `gh`. Each test builds the environment of its child processes from scratch. It copies no `ORCA_*` variable and no `ORCA_TERMINAL_HANDLE`. Its `PATH` is a temporary folder that holds the fakes and links to `node` and `git`, followed by `/usr/bin:/bin`. Its first check proves that the `orca` it reaches is the fake, through the fake's version answer and its call log. (2026-11-19, the user's answer, accepted by default)
- `cstack/test/e2e/resolve-issue.test.ts` sets `CSTACK_ORCA_WORKERS=off` and points `ORCA_CLI_COMMAND` at a program that does not exist in its temporary folder, from the moment it runs `cstack helper start`. Its `PATH` keeps the real folders today, and the real Orca is on it on this machine. (2026-11-19, assumption not asked)
- The end-to-end tests call `cstack wave` in process, from the built `dist` folder, with `isTerminal` true, `readAnswer` giving "y", and a runner that passes the explicit environment to `execFile`. The wave asks its question only on a terminal. Every other command runs as a child process of the built cstack. (2026-11-19, the user's answer, accepted by default)
- The fake programs are extensionless executable scripts in `cstack/test/e2e/bin/`, written as ES modules, because `cstack/package.json` says `"type": "module"`. They log each call with its arguments to a file in the test's temporary folder, and they keep their state there. (2026-11-19, assumption not asked)
- The fake `orca` replays the recorded answers of `cstack/test/fixtures/orca/1.4.263/`. It gives each `orchestration worker-start` its own dispatch id. For `--worktree new-child`, it creates the child worktree with `git worktree add` and returns its path in `workspace`. It answers `orchestration worker-release` and `worktree rm` with `{"ok":true}`, built in the script, and removes the worktree. It adds no JSON file to `cstack/test/fixtures/orca/1.4.263/`, because every file there needs a shape. (2026-11-19, assumption not asked)
- The fake `gh` replays the recorded answers of `cstack/test/fixtures/gh/2.101.0/`. Its milestone list keeps only tickets #4, #5 and #6 of the recorded list, so that exactly one ticket, #4, is ready, and #5 and #6 wait for it. (2026-11-19, assumption not asked)
- In the end-to-end tests, the executor's final report is a needs-decision report. The test of #23 already covers the checks of a done report. (2026-11-19, assumption not asked)
- The end-to-end tests check each `cstack` command they run, except the wave, against the text of the guide or prompt that names it, as `cstack/test/e2e/resolve-issue.test.ts` does. A placeholder such as `<helper id>`, `'<key>'`, `<n>`, `<name>` or `<file>` stands for the value. (2026-11-19, assumption not asked)
- Each new end-to-end file compiles cstack once, through a shared helper module in `cstack/test/e2e/` whose name does not end in `.test.ts`. `cstack/test/e2e/resolve-issue.test.ts` keeps its own build. (2026-11-19, assumption not asked)

## Architecture

The approach is locked by the ticket and by the answers of the question round, so no blueprint was drawn. No new decision appeared since the question round. The guides and prompts change first, one concern per unit, and each unit updates the tests that pin its sentences (units 1 to 6). The README gets the minimum Orca version (unit 7). `cstack measure` learns the worktrees of the repository and the `Worktree` lines of the plan (unit 8). A small test guards against placeholder handlers (unit 9). The two end-to-end tests come last, because they check each command against the wired guides (units 10 and 11). The version moves to 0.3.0 (unit 12).

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

### Unit 1: Read the ticket with cstack tracker read in the ticket guide
- Files: `cstack/guides/resolve-issue/ticket.md`, `cstack/skills/resolve-issue/templates/tracker-file.json`, `cstack/test/guides/ticket-read.test.ts`, `cstack/test/skills-package.test.ts`, `cstack/test/pack.test.ts`
- Test: `cstack/test/guides/ticket-read.test.ts`: the paragraph of the ticket guide that names `cstack tracker read '<key>' --tracker <name>` also names exit code `4`, `templates/tracker-file.json` and `--from-file <file>`, and the example file is read back by the file reader of cstack
- Minimum code: In "Fetch the ticket" of `ticket.md`, replace the first three sentences with the read step. Say that the name is `jira`, `linear`, `github` or `gitlab`, as the ticket URL or the conventions file shows. Say that on exit code `4` the reader reads the ticket with their own connection, fills `templates/tracker-file.json` from the skill folder, and runs the same command again with `--from-file <file>`. Then ask them to capture the labels, the parent (project, epic or milestone), the comments, the relations to other tickets and the suggested branch name. Write `tracker-file.json` with the keys `format` (`cstack-tracker/1`), `tracker` (`github`) and `tickets`, holding one ticket with exactly `key`, `title`, `body`, `url`, `stateName`, `stateKind` and `blockers`. Use placeholder values on `example.com` hosts. Add the new file to the lists of `cstack/test/skills-package.test.ts` and `cstack/test/pack.test.ts`.
- Refactor: none.
- Commit message: `feat(skill): read the ticket with cstack tracker read, with a file from Claude as the fallback`
- Depends on: none

The test has these cases. The paragraph case splits the guide on blank lines, like `cstack/test/guides/brief-rules.test.ts`. A second case runs the example file through `claudeFileTracker` of `cstack/src/tracker/claude-file.ts` with its own tracker name, and `readTicket` returns its one ticket. A third case checks that the guide no longer says "direct connection to the tracker". `cstack/test/skill-size.test.ts` and `cstack/test/guides/brief-rules.test.ts` must still pass, so count the words before the commit.

### Unit 2: Start the build with cstack tracker move and keep the branch of cstack wave
- Files: `cstack/guides/resolve-issue/build.md`, `cstack/skills/resolve-issue/templates/plan.md`, `cstack/test/guides/build-start.test.ts`
- Test: `cstack/test/guides/build-start.test.ts`: the "Start" section of the build guide names `cstack tracker move '<key>' --to "in progress" --tracker <name>` and the branch that `cstack wave` created, and the `Branch` line of the plan template names `cstack wave`
- Minimum code: Rewrite step 1 of "Start" in `build.md` with the move command, the name taken from the `Tracker:` line in lower case, a refused state name, a missing label and exit code `4`, as "Decisions" says. Rewrite step 2 so that the current branch is kept when its name is the short name that `cstack wave` gives the ticket, such as `issue-12` or `abc-12`. Change the placeholder of the `Branch` line in the plan template, as "Decisions" says.
- Refactor: none.
- Commit message: `feat(skill): move the ticket with cstack tracker move and keep the branch of cstack wave`
- Depends on: none

The test checks, inside the "Start" section: the move command, "exit code `4`" with "own connection", a sentence that says never to create a label and to write the printed command in the Hand-off log, and the words `cstack wave` and `issue-12`. It also checks that `cstack/test/template.test.ts` still reads the template, by running the plan reader on the filled template as that test does.

### Unit 3: Start and wait for the executor with cstack helper in the plan and retro guides
- Files: `cstack/guides/resolve-issue/plan.md`, `cstack/guides/resolve-issue/retro.md`, `cstack/test/guides/executor-launch.test.ts`, `cstack/test/e2e/resolve-issue.test.ts`
- Test: `cstack/test/guides/executor-launch.test.ts`: the "Hand off to the executor" section of the plan guide and the "Hand over" section of the retro guide name `cstack helper start executor --plan <plan file>` and `cstack helper wait <helper id>`, and neither guide names `cstack report check`
- Minimum code: In "Hand off to the executor" of `plan.md`, replace the sub-agent launch and `cstack report check` with the start and the wait, as "Decisions" says. Keep the heading. Say what exit codes 0, 6 and 1 of the wait mean, that the wait gets a shell timeout of ten minutes, and that a sub-agent is waited for only after it returned. Do the same in "The report of the publish phase" of `plan.md` and in "Hand over" of `retro.md`. In `cstack/test/e2e/resolve-issue.test.ts`, follow the new commands: start the executor with `cstack helper start executor --plan <plan file>`, read the helper id from the last line, and replace each `cstack report check` with `cstack helper wait <helper id>`. Teach `written()` the placeholder `<helper id>`. Set `CSTACK_ORCA_WORKERS=off` and point `ORCA_CLI_COMMAND` at a missing program in the test's environment.
- Refactor: none.
- Commit message: `feat(skill): start and wait for the executor with cstack helper start and cstack helper wait`
- Depends on: none

The new test has a case for each of these words inside the plan guide's section: "exit code `6`" with "ends its turn" or "end your turn", "exit code `1`" with "again", "ten minutes", `resolve-issue:executor`, and "returned". The end-to-end test still submits the executor's reports with `cstack report submit` in this unit, because unit 4 changes those prompts. `cstack helper wait` reads a report that `cstack report submit` saved, because both save it in the same folder.

### Unit 4: End the executor's reports with cstack helper done
- Files: `cstack/skills/resolve-issue/agents/executor.md`, `cstack/guides/resolve-issue/ready.md`, `cstack/guides/resolve-issue/publish.md`, `cstack/test/prompts.test.ts`, `cstack/test/e2e/resolve-issue.test.ts`
- Test: `cstack/test/prompts.test.ts`: the matches of `cstack helper done (\S+) --helper <helper id> --plan <plan file>` in `executor.md` are exactly `done`, `failed`, `needs-decision` and `published`, `executor.md` no longer names `cstack report submit`, and its inputs name the helper id
- Minimum code: Add the helper id to the inputs of `executor.md`, and say that `cstack helper start` gives it. Replace the four `cstack report submit <kind> --plan <plan file>` commands with `cstack helper done <kind> --helper <helper id> --plan <plan file>`. Do the same in step 3 of "Close the build" of `ready.md`, and in every report command of `publish.md`. In `cstack/test/e2e/resolve-issue.test.ts`, submit the done and published reports with `cstack helper done done --helper <helper id> --plan <plan file>` and `cstack helper done published --helper <helper id> --plan <plan file>`, with the helper id of the start of unit 3. Keep its check that the done report is refused before unit 3 of the fixture is committed.
- Refactor: none.
- Commit message: `feat(skill): end the executor's reports with cstack helper done`
- Depends on: 3

The old case of `cstack/test/prompts.test.ts` that requires `cstack report submit` in `executor.md` changes to require `cstack helper done`. Its case that pins "cstack next" stays.

### Unit 5: Start, wait for and collect the implementers with cstack helper and cstack unit collect
- Files: `cstack/guides/resolve-issue/build.md`, `cstack/skills/resolve-issue/agents/implementer.md`, `cstack/skills/resolve-issue/agents/implementer-escalation.md`, `cstack/test/guides/build-helpers.test.ts`, `cstack/test/prompts.test.ts`, `cstack/test/e2e/resolve-issue.test.ts`
- Test: `cstack/test/guides/build-helpers.test.ts`: the "Build the units" and "When a unit gets stuck" sections of the build guide name `cstack helper start implementer --plan <plan file> --unit <n>`, `--child-worktree`, `cstack helper wait <helper id>`, `cstack unit collect <n>... --plan <plan file>`, `cstack helper done stuck --helper <helper id> --plan <plan file>` and `cstack helper start implementer-escalation --plan <plan file> --unit <n>`
- Minimum code: Rewrite "Build the units" and "When a unit gets stuck" of `build.md` as "Decisions" says. Keep the sentence that the executor never builds a unit itself, and the rule about `testCommands.file` for units that share one folder. Say to commit the plan file at the end of the build, because of the `- Worktree:` lines. In `implementer.md`, add the helper id to "Inputs", and end "Your report" with `cstack helper done <kind> --helper <helper id> --plan <plan file>`, where the kind is `done` or `stuck`, with the report on standard input. Do not touch step 7. In `implementer-escalation.md`, say that the second attempt uses its own helper id, which it receives with its inputs. In `cstack/test/prompts.test.ts`, require that `implementer.md` names `cstack helper done` after its first `cstack unit commit`. In `cstack/test/e2e/resolve-issue.test.ts`, start each implementer with `cstack helper start implementer --plan <plan file> --unit <n>`, end it with `cstack helper done done --helper <helper id> --plan <plan file>`, wait for it with `cstack helper wait <helper id>`, and run `cstack unit collect <n>... --plan <plan file>` after each batch.
- Refactor: none.
- Commit message: `feat(skill): start, wait for and collect the implementers with cstack helper and cstack unit collect`
- Depends on: 2, 4

The new test also checks these words inside the two sections: "more than one unit" in the sentence that names `--child-worktree`, `testCommands.file`, "ten minutes", "returned", "needs-decision" in the sentence about an exit code `1` of `cstack unit collect`, and "Worktree". The units of the fixture of `cstack/test/e2e/resolve-issue.test.ts` run in separate batches, so no `--child-worktree` appears there, and `cstack unit collect` skips each unit with exit code 0.

### Unit 6: Write the tracker comments and the move to "in review" with cstack tracker
- Files: `cstack/guides/resolve-issue/document.md`, `cstack/guides/resolve-issue/publish.md`, `cstack/test/guides/tracker-writes.test.ts`
- Test: `cstack/test/guides/tracker-writes.test.ts`: the document guide names `cstack tracker comment '<key>' --body-file <file> --tracker <name>` in both "Write back into the ticket" and "Hand the context down", and step 1 of exit code 0 in the publish guide names `cstack tracker move '<key>' --to "in review" --tracker <name>`
- Minimum code: In `document.md`, say to write each comment into a file in a temporary folder outside the repository, then to post it with the comment command. Say that on exit code `4` the reader posts it with their own connection. Change the sentence that says the writes go "through their direct connections", because the tracker writes now go through cstack first. In `publish.md`, rewrite step 1 with the move command, a refused state name, a missing label and exit code `4`, as "Decisions" says.
- Refactor: none.
- Commit message: `feat(skill): post the ticket comments and move the ticket to in review with cstack tracker`
- Depends on: 4

The test also checks, in each place, the words "exit code `4`" with "own connection", and in the publish guide the sentence that says never to create a label.

### Unit 7: Name the minimum Orca version in the README
- Files: `README.md`, `cstack/test/readme-requirements.test.ts`
- Test: `cstack/test/readme-requirements.test.ts`: the Orca bullet of the "Requirements" section holds `MIN_ORCA_VERSION` of `cstack/src/orca/version.ts`
- Minimum code: In the Orca bullet of "Requirements", add one sentence that says the minimum Orca version is `1.4.259`. Keep the sentence that `cstack doctor` prints it.
- Refactor: none.
- Commit message: `docs: name the minimum Orca version in the README and tie it to the code`
- Depends on: none

### Unit 8: Count the helpers of child worktrees in cstack measure
- Files: `cstack/src/measure/sessions.ts`, `cstack/src/measure/moments.ts`, `cstack/src/commands/measure.ts`, `cstack/test/measure-worktrees.test.ts`, `cstack/test/fixtures/measure/worktrees/.claude/projects/-repo/main.jsonl`, `cstack/test/fixtures/measure/worktrees/.claude/projects/-repo/executor.jsonl`, `cstack/test/fixtures/measure/worktrees/.claude/projects/-child/implementer.jsonl`, `cstack/test/fixtures/measure/worktrees/.claude/projects/-other/other-ticket.jsonl`, `cstack/test/fixtures/measure/worktrees/.claude/projects/-sibling/sibling-ticket.jsonl`, `README.md`
- Test: `cstack/test/measure-worktrees.test.ts`: a worker session whose `cwd` is a child worktree named by a `Worktree` line, inside the time span of the run, adds its tokens and one main session
- Minimum code: `readMoments` also returns the `Worktree` paths of the units of a version 1 plan file. `cstack measure` reads `git worktree list --porcelain` in the measured root, and exits with 1 and a fixed sentence when git fails. `measureSessions` applies the rule of "Decisions" to each `cwd`. In the "Measure a run" section of `README.md`, describe the new rule in a few sentences: a session also counts when its folder is a child worktree named by the plan, and a session of another worktree of the repository never counts.
- Refactor: keep `resolveLoose` as the one way to resolve a path that may be gone.
- Commit message: `feat(cli): count the helpers that worked in child worktrees in cstack measure`
- Depends on: 7

The test copies the fixtures into a temporary home folder and replaces `{{REPO}}`, `{{CHILD}}`, `{{OTHER}}` and `{{SIBLING}}` with real folders, as `cstack/test/measure.test.ts` does with `{{REPO}}`. It builds a real repository with a version 1 plan file, approved and ready for review, with a `Worktree` line. Write a case for each of these behaviours, after the first one. A session of another worktree of the same repository, nested inside the repository folder and not named by the plan, adds nothing in the same time span. A session of another worktree next to the repository adds nothing either. The executor's session, whose `cwd` is the ticket worktree, counts once. A child worktree removed with `git worktree remove` before the measure still matches its `Worktree` line. When `git worktree list --porcelain` fails, the command exits with 1 and its message is a fixed sentence. No output line and no error line holds a path. The resolved path of the temporary folder goes into the `Worktree` line.

### Unit 9: Check that no command keeps a placeholder handler
- Files: `cstack/test/manifest-placeholders.test.ts`, `cstack/test/helpers/manifest-placeholders.ts`
- Test: `cstack/test/manifest-placeholders.test.ts`: a list of entries with one entry that has `built: false` gives one problem that names that command and its ticket
- Minimum code: Write `placeholderProblems(entries)` in `cstack/test/helpers/manifest-placeholders.ts`. It returns one sentence for each entry with `built: false`, and one for each `notBuiltFlags` entry, each naming the command and the ticket.
- Refactor: none.
- Commit message: `test(tests): fail when a command of the manifest keeps a placeholder handler`
- Depends on: none

Write a case for each of these behaviours. A built entry with a `notBuiltFlags` entry gives one problem that names the flag and its ticket. The real `COMMANDS` of `cstack/src/manifest.ts` give no problem.

### Unit 10: Run the whole chain end to end with a fake Orca
- Files: `cstack/test/e2e/orca.test.ts`, `cstack/test/e2e/chain.ts`, `cstack/test/e2e/bin/orca`, `cstack/test/e2e/bin/gh`, `cstack/test/fixtures/e2e-orca/plan.md`, `cstack/test/fixtures/e2e-orca/units/1/src/square.js`, `cstack/test/fixtures/e2e-orca/units/1/test/square.test.js.fixture`, `cstack/test/fixtures/e2e-orca/units/2/src/cube.js`, `cstack/test/fixtures/e2e-orca/units/2/test/cube.test.js.fixture`, `cstack/test/fixtures-public.test.ts`
- Test: `cstack/test/e2e/orca.test.ts`: the fake Orca sends the executor's `worker_done` only after both implementers have sent theirs, and `cstack helper wait <helper id>` for the executor returns only after that last message
- Minimum code: Write the fake `orca` and `gh` programs and the shared helper `cstack/test/e2e/chain.ts`, as "Decisions" says. The helper compiles cstack once into a temporary folder, as `cstack/test/e2e/resolve-issue.test.ts` does. It builds the environment from scratch, makes the temporary `PATH` folder, sets up the project from `cstack/test/fixtures/e2e/project` with a bare remote, and checks each command against its guide. The plan fixture is a version 1 plan file for ticket `#4`, on the branch `issue-4`, with two units that share no file and depend on nothing, so that they form one batch. Extend `cstack/test/fixtures-public.test.ts` so that it also scans `cstack/test/e2e/`.
- Refactor: none.
- Commit message: `test(tests): run the wave, the helpers, the collect and the tracker writes end to end with a fake Orca`
- Depends on: 1, 2, 3, 4, 5, 6

The first failing run comes from the missing fake programs. The test file is written first, then `cstack unit red`, then the fakes and the helper. Write a case for each of these behaviours, after the first one. US-14 AC3: the wave, answered yes, makes the fake Orca log exactly one `worktree create` with `--reference <ticket URL>`, `--agent claude` and `--prompt "/resolve-issue #4"`. The executor starts as an Orca worker with `--worktree current`. The two implementers start with `--worktree new-child`, each in its own child worktree, and cstack writes a `- Worktree:` line under each unit. Each implementer runs `cstack unit red`, then `cstack unit green`, then `cstack unit commit`, then `cstack helper done done`, in its own child worktree. When unit 2 reports before unit 1, `cstack unit collect 1 2` still puts the commit of unit 1 first on the ticket branch, and the fake logs one `worker-release` for each implementer. `cstack tracker read '#4' --tracker github`, the move to "in progress", the comment and the move to "in review" each make the fake `gh` log the expected call. The first check of the file proves that the `orca` on the test's `PATH` is the fake. For the first case, start `cstack helper wait <helper id>` of the executor as a child process in the background. Check that it has not ended after each implementer's `cstack helper done`. Check that it ends with exit code 0 and prints the needs-decision report only after the executor's `cstack helper done needs-decision`. The fake answers `working` for the executor's dispatch until its call log holds the executor's `worker_done`, and it refuses that `worker_done` while an implementer's `worker_done` is missing. Give each child process and each test an explicit timeout, because `cstack helper wait` makes each turn last at least five seconds.

### Unit 11: Run the same chain without a usable Orca
- Files: `cstack/test/e2e/no-orca.test.ts`, `cstack/test/e2e/chain.ts`, `cstack/test/e2e/bin/orca`
- Test: `cstack/test/e2e/no-orca.test.ts`: with no `orca` on `PATH`, the wave answered yes creates one git worktree and prints one `cd '<folder>' && claude '/resolve-issue #4'` command
- Minimum code: Let the helper of `cstack/test/e2e/chain.ts` build a `PATH` folder without `orca`, and one without `gh`. Give the fake `orca` two modes, chosen by a variable of the test's environment: one whose `--version` answers a version below 1.4.259, and one whose `status` answers `status.closed.json`.
- Refactor: none.
- Commit message: `test(tests): run the same chain end to end without Orca, with an old Orca and with a closed Orca`
- Depends on: 10

Write the chain once and run it three times: with no `orca` on `PATH`, with the old fake, and with the closed fake. In each run, after the wave, `cstack helper start executor` and `cstack helper start implementer --unit <n> --child-worktree` exit with 6 and print the sub-agent and its inputs. The two implementers then run one after the other in the ticket worktree, `cstack helper done` saves each report, `cstack helper wait` prints it at once, and `cstack unit collect` skips both units with exit code 0. The tracker commands go through the fake `gh`. With a `PATH` that has no `gh`, `cstack tracker read`, `cstack tracker move` and `cstack tracker comment` each exit with 4. The first failing run comes from the missing modes of the fake: with the fake of unit 10, Orca still looks usable, so the wave starts no git worktree.

### Unit 12: Raise the version of cstack to 0.3.0
- Files: `cstack/package.json`, `cstack/package-lock.json`
- No test: the unit changes the version number only. `cstack/test/next.test.ts` already reads the expected version from `cstack/package.json`.
- Minimum code: run `npm version 0.3.0 --no-git-tag-version` in `cstack/`. It sets the version in `cstack/package.json` and in both version fields of `cstack/package-lock.json`, and makes no tag and no commit. Run the full test command before the commit.
- Refactor: none.
- Commit message: `chore(cli): raise the version of cstack to 0.3.0`
- Depends on: none

## Documentation duties

- Ticket comment on #31: applies, written to issue #31. It says what this pull request built, and that the run by hand of scope item 7, the tag `v0.3.0` and the install stay open for the coordinator.
- Comment on the dependent ticket #32: applies, written to issue #32. It says how `cstack measure` now counts the sessions of child worktrees, and what the comparison must run before a child worktree folder or a session record is removed.
- ADR-SIC-A, `docs/decisions/ADR-SIC-A-helpers.md`: applies. Its consequence "The prompts of the helpers, the plan and the report check stay the same" is no longer true. Add a dated paragraph that says the prompts now end with `cstack helper done`, in both modes, and that the helper always runs it itself.
- `README.md`: applies, written by units 7 and 8.
- `docs/projects/skills-into-cli.md`: applies only if a sentence there is now wrong. Check it in the `document` phase.
- New ADR: does not apply. No new architecture choice was made.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

none

## Review log

<phase review>

## Briefing

<phase after-build>

## Non-blocking questions

For the coordinator of the wave, from the question round, word for word. These checks need a real Orca, so they belong to the run by hand of scope item 7:

- Does `orca linear list-issues --parent-id` accept a key such as `EXA-9`, or does it need the internal id? Does Orca keep the bold `**Size:` footer marker in a Jira Cloud description? (from #25)
- How long does `worker-show` keep a finished worker, and which status does a stopped worker get? (from #27)
- Does Orca accept a commit hash as `--base-branch`, and does the `workspace` field of the `worker-start` answer hold the path of the child worktree? (from #28)
- Does `/resolve-issue <key>` in `--prompt` run the skill in both the chat surface and the terminal surface? (from #29)
- When `orca worktree create` gets no `--base-branch`, does it fetch the remote first, and does it branch from the remote default branch or from the local one? (from #30)

For the coordinator of the wave, from the question round, word for word:

- From the next run with Orca in this repository, cstack writes `- Worktree: <absolute path>` lines into the plan file, and the executor commits them. These paths start with `/Users/`, which the public text rule forbids, and the private-names check does not catch them. Should a later ticket write them relative to the home folder, or should this repository stop committing plan files?

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request>

## Documentation

<phase document>

## Executor notes

<executor, before its report>

## Hand-off log

<one entry per executor run>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

Nothing here needs an answer before the plan. What stays open needs a real Orca and does not change this pull request.

**I will do this unless you say no.**

- When `cstack tracker read` exits with 4, Claude must write a file in the exact format of cstack. I ship an example file in the skill's templates, with a test that cstack accepts it, because the ticket guide has only 37 words of room.
- Phase 1 takes the tracker from the ticket URL or the conventions file, and passes it in lower case to `--tracker`. Without the option, cstack guesses from the remote, which is wrong for Jira and Linear.
- The plan template says to keep the branch that `cstack wave` created, such as `issue-12`, on the `Branch` line. Otherwise `cstack helper start` and `cstack publish` refuse the branch.
- The started helper always runs `cstack helper done` itself, as an Orca worker and as a sub-agent. The `retro` guide, which starts the executor again, changes the same way.
- The README writes the minimum Orca version, 1.4.259, and a test compares it with `MIN_ORCA_VERSION`.
- When the `in progress` or `in review` label is missing, the executor writes the `gh label create` command that cstack printed into the plan file and goes on. It never creates the label.
- For a sub-agent, `cstack helper wait` answers at once, and without a report it says to start the helper again. Sub-agents now run in the background, so a wait sent too early would start a second executor on the same branch. The guides will say to run the wait only after the sub-agent has returned.
- The test that answers yes to `cstack wave` runs it inside the vitest process, and the default runner inherits that environment. On this machine it has the real `orca` on `PATH` and 27 `ORCA_*` variables. The test gets its own runner with an explicit environment, and first fails if `orca` resolves to the real app.
- `cstack measure` gives each session to the deepest listed worktree that holds its folder. Claude Code creates its own worktrees under `.claude/worktrees/`, inside the repository, so "inside the root" is not enough.
- The test that looks for private paths in fixtures will also scan `cstack/test/e2e/`, where the fake `orca` and `gh` will live.

**I checked it myself.**

A second `cstack helper done` for the same helper is refused (`cstack/src/helper/done.ts`, lines 96 to 99), so only one side can run it.

**Questions for other people that can wait.**

- For the coordinator of the wave, the five checks on a real Orca asked by #25, #27, #28, #29 and #30, word for word in question 9 of "Open questions and answers".
- For the coordinator of the wave: "From the next run with Orca in this repository, cstack writes `- Worktree: <absolute path>` lines into the plan file, and the executor commits them. These paths start with `/Users/`, which the public text rule forbids, and the private-names check does not catch them. Should a later ticket write them relative to the home folder, or should this repository stop committing plan files?"

**Good to know.**

- On macOS the temporary folder goes through a symbolic link, from `/var` to `/private/var`. The test of a removed child worktree must write the resolved path, as cstack does.
- Each end-to-end file compiles cstack on its own. Two more files make the five-second timeout of `cstack/test/report.test.ts` more likely under load.

#### Details

The draft question about the format of the fallback file is non-blocking. I keep its recommendation: an example file at `cstack/skills/resolve-issue/templates/tracker-file.json`, a test that runs it through the reader of `cstack/src/tracker/claude-file.ts`, and one sentence in `cstack/guides/resolve-issue/ticket.md` that points to it. The reader refuses unknown keys with exit code 3. A hand-written example that drifts from the code would fail at run time, and the test catches that drift. A README section was rejected because Claude does not read the README during a run. A longer exit-4 message was rejected because it changes the tracker code of #25 and #26 for a documentation need. Check that `cstack/test/skills-install.test.ts` does not list template files one by one before adding the file. By default, without this file, Claude would guess the format and hit exit code 3.

The draft question about where phase 1 takes the tracker name is non-blocking, and I keep its recommendation. `--tracker` takes only lower-case names (`cstack/src/tracker/open.ts`), while the `Tracker:` header holds `GitHub`. Phase 1 runs before the header exists, so the ticket's own wording cannot hold for that phase. When the `Tracker:` line names an unknown tracker, the decision already in `## Decisions` sends Claude to its own connection.

The draft question about the `Branch` line is non-blocking, and I keep its recommendation. `cstack helper start` and `cstack publish` compare the current branch with the `Branch` line, so a plan that names another branch would make the first child-worktree start refuse with 1. The template does not count against `cstack/test/skill-size.test.ts`, so the words go there.

The draft question about who runs `cstack helper done` for a sub-agent is non-blocking. It was answered by reading the code: `doneHelper` in `cstack/src/helper/done.ts` (lines 96 to 99) throws "One helper has only one report" when a record already has a report, except for an Orca worker whose report was not sent. So the comment of #27 and the scope of this ticket cannot both hold. I keep the recommendation that the helper always runs it, because ADR-SIC-A says the prompts stay the same in both modes. The draft question about `retro.md` line 25 is non-blocking, and I keep its recommendation for the same reason.

The draft question about the README is non-blocking, and I keep its recommendation. The rule in `CLAUDE.md` that a number lives in one place covers the Node version only. A test that ties the README to `MIN_ORCA_VERSION` in `cstack/src/orca/version.ts` keeps the two from drifting.

The draft question about a missing GitHub label is non-blocking, and I keep its recommendation. This repository has both labels, so the case only matters for other repositories. `cstack` never creates a label (comment of #26).

The early wait on a sub-agent is a point of my own, non-blocking, answered by reading the code. `waitHelper` in `cstack/src/helper/wait.ts` (line 55) calls `printReport` at once when the record is not an Orca worker. `printReport` (lines 38 to 48) exits with 1 and prints "Launch the helper again with the same inputs" when no report is saved. The scope tells the main conversation to start the executor again on exit 1. Claude Code now runs sub-agents in the background and sends a notice when they finish. A main conversation that runs `cstack helper wait` right after starting the sub-agent would then start a second executor on the same branch, and the same holds for the executor and its implementers. The guides and the executor prompt must say that for a sub-agent, the wait comes after the sub-agent has returned. The same text should say that a second wait after an accepted report also exits with 1, because `takeOldestUnreadReport` marks the report as read, and that this exit is not a reason to start again. The other way, a change to `cstack helper wait` so that a sub-agent without a report exits with 6, was rejected because it changes the code of #27 in a ticket about wiring. By default, nothing stops the duplicate start.

The environment of the in-process wave test is a point of my own, non-blocking, answered by reading the code. `createRunner` in `cstack/src/orca/run.ts` calls `execFile` without an `env` option, so the child inherits the environment of the vitest process. `defaultWaveDeps` in `cstack/src/commands/wave.ts` (line 38) passes `process.env`. On this machine the shell has a real `orca` on `PATH` and 27 `ORCA_*` variables. A test that reuses `createRunner` or `defaultWaveDeps` would call the real Orca, and `startInOrca` runs `orca worktree create`, which the decisions forbid. I recommend a test runner that passes an explicit environment to `execFile`. The test builds `deps.env` from scratch, with `ORCA_CLI_COMMAND` set to the absolute path of the fake. Its first assertion checks that the fake answers `orca --version`. The draft question about how the tests answer yes stays non-blocking, and I keep its recommendation with this addition.

The deepest-worktree rule in `cstack measure` is a point of my own, non-blocking, and the run can test it. The scope says to check a session's folder against `git worktree list --porcelain` first. A plain "is it inside one of these paths" check is wrong because worktrees nest. Claude Code puts its own isolated worktrees under `<repository>/.claude/worktrees/`, and the main clone holds every such worktree. The rule I recommend is this. Take the deepest listed worktree that holds the session's folder. Count the session when that worktree is the measured root, or when its path matches a `Worktree` line. When no listed worktree holds the folder, count it only when a `Worktree` line's path holds it, compared as written. A `prunable` entry of the porcelain output is still a listed worktree. By default, a session of another ticket in a nested worktree is counted, which is the bug the scope names.

The wider public scan is a point of my own, non-blocking. `cstack/test/fixtures-public.test.ts` (line 6) scans only `cstack/test/fixtures/`. The fake programs and any recorded logs under `cstack/test/e2e/bin/` would escape it. Extending the scan root costs one line.

The question about real Orca checks is non-blocking, and the run cannot test it, because the decisions forbid real Orca workers and worktrees. It goes to the coordinator of the wave word for word as written in question 9 of "Open questions and answers", under `## Non-blocking questions`.

The question about absolute paths in committed plan files is non-blocking for this pull request, and someone has to be asked. #28 writes `- Worktree: <absolute path>` with symbolic links resolved and tells the executor to commit the plan file. This repository commits its plan files under `docs/plans/`. The public text rule of the coordinator forbids paths that start with `/Users/`, and `scripts/private_names.py` matches only the names of the private list, so it catches such a path only when the user name is on that list. The format is locked by the contract ticket (#24), and the CTO block of #28 declined to reopen it, so I do not reopen it either. This ticket is the one that makes the guides start child worktrees, so the first run with Orca in this repository after it will hit the rule. The question for the coordinator is the one written above, in English.

The symbolic link of the macOS temporary folder is a fact for the tests of `cstack measure`. `os.tmpdir()` returns a path under `/var/folders`, which resolves to `/private/var/folders`. #28 writes the resolved path, and the session files record the resolved folder. A fixture that writes the unresolved path in the `Worktree` line of a removed folder would fail for a reason that has nothing to do with the rule.

The compile cost is a fact for the plan. `cstack/test/e2e/resolve-issue.test.ts` compiles cstack once per file, and vitest runs files in parallel. Two more compiling files add load, and `CLAUDE.md` already says that `cstack/test/report.test.ts` times out under load. A shared build through a vitest global setup is an option, but it changes the test file of #23, so I leave the choice to the plan.

I relied on four locked decisions and did not reopen them. They are ADR-SIC-A for the two modes of helpers, ADR-SIC-F for Claude's own connection on exit 4, the `Worktree` line format of #24, and the split of the ticket in `## Decisions`.

I checked security, data model lock-in, scale, failure modes, user-facing edge cases, operations and cost, reversibility and hidden coupling. I found nothing more in scale, operations and cost, or reversibility, because the version raise pushes no tag and the ticket adds no command.

### Open questions and answers

None of these questions is blocking. Each one has a recommended answer that keeps the ticket's acceptance criteria met.

1. **How Claude learns the format of the fallback file (non-blocking).** When `cstack tracker read` exits with 4, Claude must write a file in the format `cstack-tracker/1`. That format is documented only in `cstack/src/tracker/claude-file.ts`, and the reader refuses any unknown key. The ticket guide has 37 words of room, which is not enough to describe the format. Recommended: ship an example file, `cstack/skills/resolve-issue/templates/tracker-file.json`, with one ticket in it, and add a test that the file reader of cstack accepts it. The ticket guide then says to fill that file. The other ways are a README section, which Claude does not read during a run, or a longer exit-4 message in the tracker code of #25 and #26.
2. **Where phase 1 takes the tracker name from (non-blocking).** The ticket says that the tracker comes from the `Tracker:` line of the plan header. But phase 1 reads the ticket before it writes that header. Recommended: phase 1 takes the tracker from the ticket URL or id, or from the conventions file, and passes it in lower case, such as `--tracker github`. It then writes the same tracker on the `Tracker:` line. Every later phase passes `--tracker` with the `Tracker:` line in lower case. Without `--tracker`, cstack guesses from the origin remote, which is wrong for Jira and Linear.
3. **Where the branch that `cstack wave` created reaches the `Branch` line (non-blocking).** `cstack helper start --child-worktree` and `cstack publish` compare the current branch with the `Branch` line. So the plan must name the branch of the wave, such as `issue-12`, before the approval. Recommended: the comment of the `Branch` line in `cstack/skills/resolve-issue/templates/plan.md` says to write the current branch when its name is the short name that `cstack wave` gives the ticket. The template does not count against the size test. The build guide also says to keep that branch, as the scope asks.
4. **Who runs `cstack helper done` when a helper runs as a sub-agent (non-blocking).** The comment of #27 says that the main conversation pipes the sub-agent's report into `cstack helper done`. The scope of this ticket says that every helper prompt ends with `cstack helper done`. Both cannot hold, because a second `helper done` for the same helper is refused. I checked it in `cstack/src/helper/done.ts` lines 98-102: "One helper has only one report." Recommended: the helper always runs `cstack helper done` itself. The main conversation passes it the helper id that `cstack helper start` printed, as one more input. The main conversation then runs `cstack helper wait`, which prints the saved report at once for a sub-agent.
5. **The relaunch of the executor in the `retro` guide (non-blocking).** `cstack/guides/resolve-issue/retro.md` line 25 launches the executor again for the `publish` phase, then runs `cstack report check`. The ticket names only the `plan` guide. Recommended: change `retro.md` the same way, with `cstack helper start executor` and `cstack helper wait`, so that the two guides agree.
6. **The minimum Orca version in the README (non-blocking).** Today the README says that `cstack doctor` prints the minimum version. The ticket asks the README to say which version it is. The number lives in one place, `MIN_ORCA_VERSION` in `cstack/src/orca/version.ts`. Recommended: write `1.4.259` in the README, and extend `cstack/test/readme-requirements.test.ts` so that it fails when the README and `MIN_ORCA_VERSION` differ.
7. **How the end-to-end tests answer yes to `cstack wave` (non-blocking).** The wave asks its question only when standard input is a terminal, so a child process with a piped "y" starts nothing. The run of #29 found that a pseudo-terminal made with `script` is unreliable on macOS. Recommended: the test calls the built wave command in process, with a scripted "y" and a runner whose environment puts the fake `orca` and `gh` first on `PATH`. Every other command runs as a child process of the built cstack.
8. **A missing `in progress` or `in review` label on GitHub (non-blocking).** `cstack tracker move` then exits with 1 and prints the `gh label create` command. It never creates a label. Recommended: the executor writes in the Hand-off log that the ticket could not be moved, with the command that cstack printed, and goes on. It never creates the label itself.
9. **The checks that only a real Orca can make (non-blocking, open, not needed for this pull request).** The comments of #25, #27, #28, #29 and #30 ask for checks on a real machine. They belong to the run by hand of scope item 7, which the coordinator does after the merge. They go to the pull request under "Open questions, not needed for this pull request", for the coordinator of the wave:
   - Does `orca linear list-issues --parent-id` accept a key such as `EXA-9`, or does it need the internal id? Does Orca keep the bold `**Size:` footer marker in a Jira Cloud description? (from #25)
   - How long does `worker-show` keep a finished worker, and which status does a stopped worker get? (from #27)
   - Does Orca accept a commit hash as `--base-branch`, and does the `workspace` field of the `worker-start` answer hold the path of the child worktree? (from #28)
   - Does `/resolve-issue <key>` in `--prompt` run the skill in both the chat surface and the terminal surface? (from #29)
   - When `orca worktree create` gets no `--base-branch`, does it fetch the remote first, and does it branch from the remote default branch or from the local one? (from #30)

Answers. The user saw the short version of the advisor's block and replied "go" on 2026-11-19. So questions 1 to 8 are answered with their recommendation, accepted by default. The four points that the advisor added in its group "I will do this unless you say no" are also accepted by default: the wait on a sub-agent comes only after it returned, the in-process wave test uses a runner with an explicit environment, `cstack measure` uses the deepest listed worktree, and the public scan of the fixtures also covers `cstack/test/e2e/`. Question 9 stays open, not needed for this ticket, for the coordinator of the wave. The advisor's question about absolute paths in committed plan files also stays open, not needed for this ticket, for the coordinator of the wave.

### Architecture options

<phase plan>
