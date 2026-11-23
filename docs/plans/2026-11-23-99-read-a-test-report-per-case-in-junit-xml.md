# Plan: #99 — R3-2: Read a test report per case in JUnit XML

Format: cstack-plan/1
Written by: cstack 0.3.2
Date: 2026-11-23
Ticket: https://github.com/gambitl/claude-code-stack/issues/99
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/refocus-and-quality-guards.md`), ADRs in `docs/decisions/`
Branch: gambitl/junit-per-case
Target branch: main
Conversation language: French
Status: approved
Approved at: 2026-11-23T20:53:10+01:00
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

### Why this matters (plain language)

**In plain terms:** Let `cstack` read the result of each test case on its own, instead of only knowing whether the whole test file passed or failed.

- **What the title means**: A test file holds several test cases. Today `cstack` only sees the exit code of the test command, which says whether the whole run passed. A report per case gives the result of each case. JUnit XML is a common format for such a report, and both pytest and vitest can write it.
- **Why we are doing it**: In one earlier run, a new test passed before its code existed, and nobody saw it, because another case of the same file failed. Two guards need per-case results: each new case must fail first, and the test of a negative criterion must fail when its rule is broken.
- **For the user**: `cstack` can tell exactly which test case proved what.

**Goal.** This ticket adds a settings option for a test report per case, and a reader of JUnit XML reports, so that a test run returns the result of each case.

### Where things are today (read first)

* **The settings**: `cstack/src/settings.ts` → `TestCommands = { all; file? }` (line 34) and `TEST_KEYS` (line 72). `checkTestCommand()` (lines 106 to 129) requires `{file}` exactly once in the `file` command (line 113) and forbids it in `all` (line 117). The test commands are read at lines 264 to 273. `unknownKeys()` (lines 88 to 97) refuses an unknown key. The comment at lines 11 and 12 says that a new key keeps settings version 1.
* **Running the tests**: `cstack/src/test-run.ts` → `testScript()` (lines 34 to 39) replaces `{file}` with `"$1"` (line 36). `runTests()` (lines 77 to 128) returns a `TestRun` (lines 14 to 27) with `exitCode`, `timedOut` and `output`, and nothing per case.
* **No XML today**: no code in `cstack/src/` reads XML. `cstack/package.json` has no runtime dependency. Its development dependencies are `@types/node`, `typescript` and `vitest`.
* **The release rule**: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` explains that an older `cstack` refuses a new settings key. So no repository may use the new key before a release ships it. #104 prepares that release.
* **Tests**: `cstack/test/settings.test.ts` (its `repo()` helper is at line 9) and `cstack/test/test-run.test.ts`.
* **The README**: `README.md` has no settings section. It mentions the settings only in the command list.

### Scope

1. Add an optional way to declare a per-case report for the `file` test command. One option is a `{report}` placeholder, which `cstack` replaces with a path in the run folder. The command then writes its report there, for example with `vitest --reporter=junit --outputFile={report}` or `pytest --junitxml={report}`.
2. Write a small reader of JUnit XML with no new runtime dependency. It returns each case with its name, its file or class, and its outcome: passed, failed, error or skipped. It handles the reports of vitest and pytest.
3. Make `runTests()` return the per-case results when the settings declare the report, and nothing new otherwise.
4. Refuse a malformed or missing report with a clear message.
5. Document the option in the README, with one example for vitest and one for pytest. Say that a repository can use it only after the release that ships it.

### Acceptance (TDD)

* A new reader test with fixture reports from vitest and pytest: write first a case with one passed, one failed, one error and one skipped case, and check the four outcomes. See it fail, then pass.
* The same file: a malformed report is refused with a clear message.
* `cstack/test/settings.test.ts`: the report placeholder is accepted once in the `file` command, and refused in `all`.
* `cstack/test/test-run.test.ts`: a fake test command that writes a report returns its cases. Without the option, `runTests()` returns the same result as today.
* `npm test` and `npm run typecheck` pass in `cstack/`.

**Size: S** · Blocked by: #92, #87 · Feeds: #100, #101

### Decisions already taken upstream

This is the decisions block of epic #84, "Refocus and quality guards" (https://github.com/gambitl/claude-code-stack/issues/84). Its specification is `docs/projects/refocus-and-quality-guards.md`.

**Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`.

- ADR-RQG-A, how helpers and units run inside a ticket, is to create. The design chose sub-agents that the ticket's session starts one after the other. It replaces ADR-SIC-A. The ticket of US-3 writes it.
- ADR-RQG-B, version 2 of the plan format, is to create. The design chose a fixed "Facts" list that `cstack` checks, and named test cases in each unit. The ticket of US-8 writes it.
- ADR-RQG-C, how the audit knows the expected steps, is to create. The design chose a block of mandatory steps at the top of each phase guide. The ticket of US-1 writes it.

**Rules for every ticket of this epic.** Orchestration stays with Orca, so no ticket adds a `cstack` command that starts an agent, waits for it or sends it a message. Inside a ticket, the helpers are Claude Code sub-agents. The only exception is a review agent other than Claude, which runs as an Orca worker. Every `cstack` command works without Orca. `cstack` never stores a credential. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

**Acceptance criterion of US-6 that this ticket carries.** The specification lists it in section 4, under "US-6: Each new test case fails first". The other criteria of US-6 belong to the tickets that this one feeds, #100 and #101.

- AC1: The settings file can declare a report per test case for each test command. The report uses the JUnit XML format, which pytest and vitest can both write.

**Open question 5 of the specification, with its default.** The report per case and the step that breaks a rule add test runs. If nobody decides, each step runs the test command of the settings file.

The ADRs that this block and the ticket name:

- [ADR-RQG-C: How the audit knows the expected steps](../decisions/ADR-RQG-C-expected-steps-of-a-run.md). #86 wrote it, so it is no longer "to create".
- [ADR-SIC-A: How the helpers run](../decisions/ADR-SIC-A-helpers.md), which ADR-RQG-A will replace.
- [ADR-SIC-D: The settings file and the review model](../decisions/ADR-SIC-D-settings-file-and-review-model.md), which explains why an older `cstack` refuses a new settings key.
- [ADR-SIC-G: Continue or stop](../decisions/ADR-SIC-G-continue-or-stop.md), which decided this epic and its three guards.

## Dependencies

clear

## Code mapping

The ticket's file map is right, with one small shift: `checkTestCommand()` starts at line 107 of `cstack/src/settings.ts`, after its comment at line 106. The area is small, so no wider exploration was needed.

**The settings.** `TestCommands` is `{ all: string; file?: string }` (`cstack/src/settings.ts`, line 34). `TEST_KEYS` is `["all", "file"]` (line 72). `unknownKeys()` (line 88) refuses any other key inside `testCommands`, with the hint "If this key comes from a newer cstack, update cstack." `checkTestCommand()` counts `{file}` with `v.split("{file}").length - 1` (line 112). It refuses a `file` command without exactly one `{file}` (line 114), and an `all` command with any `{file}` (line 118). The same function checks `setupCommand` with `isFile` set to `null`, so `setupCommand` ignores the placeholder (`cstack/test/settings.test.ts`, lines 304 and 305). The test commands are read at lines 264 to 273, and `set("testCommands", { ...o })` at line 271 copies every accepted key into the value.

**Running the tests.** `testScript()` (`cstack/src/test-run.ts`, lines 34 to 39) replaces `{file}` with `"$1"` (line 36), so the path reaches the shell as an argument and never as shell text. `runTests(root, script, testFile, timeoutMs)` (lines 77 to 128) makes a temporary folder `cstack-test-run-*` (line 85). It writes both output streams into `output.log` in that folder (line 86). It passes the test file as `$1` (line 89). It deletes the folder at the end, even after an error (line 126). `runTests()` never reads the settings: it gets a finished script. So the caller must tell it whether a report is expected.

**The callers.** `cstack unit red` calls `runTests(root, testScript(commands, testFile), testFile, timeoutMs)` (`cstack/src/commands/unit-red.ts`, line 37). `cstack unit green` builds the script at line 30 and runs it at line 77 of `cstack/src/commands/unit-green.ts`. It also compares the script with the command saved by the red run (line 31). `cstack publish` runs the whole suite with `testScript(settings.testCommands)` and no test file (`cstack/src/commands/publish.ts`, line 206). `prepareUnitTest()` reads the test commands from the settings (`cstack/src/unit-test-command.ts`, line 100). #100 changes `cstack unit red` and `cstack unit green` to use the per-case results, and #114 owns `publish.ts` in this wave.

**The settings shown by `cstack next`.** `cstack next` prints `testCommands` as JSON (`cstack/test/next-settings.test.ts`, line 45), so a new key or placeholder shows there with no change.

**What JUnit XML looks like.** The real `vitest` 5.1.0 of this repository wrote a sample report in a scratch folder, outside the repository. Its root is `<testsuites name="vitest tests">`, with one `<testsuite>` per file. Each `<testcase>` has `classname` set to the test file path relative to the vitest root, and `name` set to the describe titles and the test title joined by " > ". A failed case holds a `<failure message="..." type="...">` element. A thrown `TypeError` is also a `<failure>`, not an `<error>`. A skipped case and a `todo` case both hold `<skipped/>`. A file that cannot load gives one `<testcase>` named after the file, with a `<failure>`. Attribute values use the entities `&lt;`, `&gt;`, `&amp;`, `&quot;` and `&apos;`. The failure message holds the absolute path of the test file, so a committed fixture must never be a copy of a real report. pytest is not installed on this machine. Its JUnit report is known from its documentation: each `<testcase>` has `classname` set to the dotted module and class path and `name` set to the test function, and an error during setup or teardown gives an `<error>` element.

**No XML reader exists.** No code in `cstack/src/` reads XML, and Node has no built-in XML parser. `cstack/package.json` has no runtime dependency. Its development dependencies are `@types/node`, `typescript` (line 26) and `vitest` (line 27). The reader must be written by hand.

**Risks.** Both files to change are small and stable. `cstack/src/settings.ts` had six commits, each with `cstack/test/settings.test.ts`. `cstack/src/test-run.ts` had three commits, each with `cstack/test/test-run.test.ts`. An older `cstack` reads `{report}` as plain text, because it only counts `{file}` (line 112). So an older `cstack` would run a command with a literal `{report}` path instead of refusing the settings file. A new key inside `testCommands` would be refused by an older `cstack` (line 88). Until #100 is merged, `cstack unit red` and `cstack unit green` do not ask `runTests()` for a report.

**Governing decisions.** ADR-SIC-D (`docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`, line 30) says that a new key keeps version 1, and that a reader refuses an unknown key. The comment at lines 11 and 12 of `cstack/src/settings.ts` says the same. The comment at lines 14 to 17 says that `{file}` is never replaced by a path, but by `"$1"`. The `WHY:` comments of `cstack/src/test-run.ts` explain the single output file (line 83), the path passed as an argument (line 88) and the process group (line 90).

## Decisions

- This ticket adds no runtime dependency and no development dependency. Never run `npm install <package>`. Install the packages with `npm ci` only. (2026-11-23, from the brief of the run)
- Never change `.cstack/settings.json`. An older `cstack` refuses a settings key that it does not know, as ADR-SIC-D explains, so this repository cannot use the new option before the release that ships it. Build and test the option with settings files that the tests write in temporary folders. (2026-11-23, from the brief of the run)
- The tests may run the real `vitest` of this repository to produce a sample report, but the committed fixtures are written by hand. If a fixture comes from a real pytest report, write it again by hand with sample names. (2026-11-23, from the brief of the run)
- This ticket works only in `cstack/src/settings.ts`, `cstack/src/test-run.ts`, a new module for the report, their tests and fixtures, and a new paragraph of `README.md` about the option. The plan file and the retrospective of this run are added too. In `cstack/src/manifest.ts` and `README.md`, change only the entry and the paragraph of this ticket's own option. (2026-11-23, from the brief of the run)
- Three other tickets of epic #84 run at the same time, each in its own worktree. #91 works in `cstack/guides/resolve-issue/retro.md`, the retrospective template, `cstack/src/commands/audit.ts`, the `cstack audit` paragraph of `README.md` and ADR-RQG-C. #98 works in `cstack/src/plan/`, the plan template `cstack/skills/resolve-issue/templates/plan.md`, the plan fixtures and tests, a new ADR-RQG-B and section 9 of the specification. #114 works in `cstack/src/commands/publish.ts`, `cstack/src/phases.ts`, the publish tests, the guide `cstack/guides/resolve-issue/publish.md` and the `cstack publish` paragraph of `README.md`. Never change their files. When this ticket needs one of them, the main conversation asks the coordinator first. (2026-11-23, from the brief of the run)
- Do not change the version in `cstack/package.json` or `cstack/package-lock.json`. The release of this epic comes at the end of milestone R3. (2026-11-23, from the brief of the run)
- `cstack/guides/resolve-issue/ticket.md` and `SKILL.md` have almost no margin left in `cstack/test/skill-size.test.ts`. If a sentence is added to `ticket.md`, remove words elsewhere in the same file or in `SKILL.md`. (2026-11-23, from the brief of the run)
- Start every helper with `CSTACK_ORCA_WORKERS=off` in front of the command, for example `CSTACK_ORCA_WORKERS=off cstack helper start executor --plan <plan file>`. The README describes this switch at line 63. With it, `cstack helper start` never asks Orca. It exits with 6 and names the sub-agent to start, with its inputs, as step 3 of the build guide says. (2026-11-23, from the brief of the run)
- Never add `--child-worktree`. Run the units one at a time, in the order that `cstack unit order` prints: start one implementer, wait for it with `cstack helper wait`, then start the next one. (2026-11-23, from the brief of the run)
- Never pipe `cstack helper start` or `cstack helper wait` into another command, such as `grep`. Read their whole output instead. (2026-11-23, from the brief of the run)
- The executor starts the implementers, so it follows the same three rules above about `CSTACK_ORCA_WORKERS=off`, `--child-worktree` and pipes. The main conversation puts those three rules, word for word, in the prompt of the executor. (2026-11-23, from the brief of the run)
- Nobody runs `orca orchestration`, `orca worktree create` or `orca worktree rm` during this run, except the main conversation, which uses `orca orchestration` only to ask the coordinator about coordination and to send the final `worker_done`. (2026-11-23, from the brief of the run)
- Each new test case fails first. After `cstack unit red` saves a failing run, the implementer reads its output and checks that every new test case of the unit is among the failures. When a new test case already passes before the code exists, the implementer changes the test so that it fails first, for example by checking the exact message or exit code. Then it runs `cstack unit red` again. A test file that fails as a whole is not enough. (2026-11-23, from the coordinator of the wave)
- A negative test proves its rule by breaking it. For each test that checks a refusal, the implementer breaks that rule in the code on purpose, for example by commenting out the check. It runs the test and sees it fail. Then it restores the code exactly, and `git diff` shows nothing left from the break. It writes in its report which rule it broke and which test failed. It never commits the break, and it never uses `git stash`. (2026-11-23, from the coordinator of the wave)
- A fact in the plan names its source. A line of `## Decisions` that states a fact about the code names the file and the line that show it. A change to something that the ticket fixes, such as a function signature or a message, is a blocking question for the user, never an assumption accepted by default. (2026-11-23, from the coordinator of the wave)
- The executor copies rules 1 to 3 of these guards, word for word, into the prompt of each implementer that it starts. (2026-11-23, from the coordinator of the wave)
- A line of `## Decisions` that says what a function must not do needs a test case of its own. Otherwise nothing fails when a later unit breaks it. (2026-11-23, from the retrospective of #86, `docs/retros/2026-11-23-86.md`)
- When the `Test` line of a unit lists several refusals, each refusal needs its own test case. The implementer checks this before it runs `cstack unit red`. (2026-11-23, from the retrospective of #86)
- Never use `git commit -a` for a fix. Commit the code and the documentation separately, because `cstack plan status` refuses a commit that mixes them under one `Cstack-Unit` trailer. (2026-11-23, from the retrospective of #86)
- In vitest, a test file that imports a module that does not exist yet fails as a whole, so no single case fails first. Import a new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does. (2026-11-23, from the retrospective of #86)
- An implementer saves the failing run with `cstack unit red` before it writes any source file of the unit. (2026-11-23, from the retrospective of #89, `docs/retros/2026-11-23-89.md`)
- `cstack helper wait` takes no `--plan`. Run it only after the sub-agent has returned. (2026-11-23, from the retrospective of #89)
- A rule that depends on the order of the calls in a run must be checked against the real order of one run in the same mode, before the approval gate. (2026-11-23, from the retrospective of #89)
- A decision about a placeholder, such as `<n>`, needs a test case for each place where the placeholder can stand. (2026-11-23, from the retrospective of #89)
- Before `cstack publish`, run `cstack plan status`, and check that every unit is done or has a `- Blocked:` line. `cstack publish` does not check it yet. (2026-11-23, from the retrospective of #89)
- Every stop of the skill goes to the user in the chat. These stops are a blocked ticket, the question round, the approval gate and the questions after the build. Nobody answers them on the user's behalf, and they never go to the coordinator. A French "oui", "ok" or "go" counts as approval at the gate. (2026-11-23, from the brief of the run)
- The conversation with the user is in French. Everything written in the repository and on GitHub is in English. (2026-11-23, from the brief of the run)
- Never merge the pull request. The user merges it. (2026-11-23, from the brief of the run)
- A helper that may read session files, such as the CTO advisor or a reviewer, gets this line in its prompt: it may read only the session files of this run. Never read the private work data of the comparison runs or their session files. (2026-11-23, from the brief of the run)
- Never install Graphify or Repowise. Never call a Jira or Linear connection, and never run `glab`. (2026-11-23, from the brief of the run)
- Never run `cstack wave` or `cstack wave --watch` for real. Tests use fake programs, never the real `osascript`, `orca`, `gh`, `glab` or `npm`. Run `git worktree add` only inside a temporary test repository. (2026-11-23, from the brief of the run)
- Never run `npm install -g`, `npm link` or `cstack skills install`, and never change the installed skills. To try the code, use the tests, or run `npm run build` in `cstack/` and then `node cstack/dist/bin.js` from the worktree. The changes of this branch do not change the guides that this run reads, because they come from the installed 0.3.2. (2026-11-23, from the brief of the run)
- When the skill or the installed `cstack` 0.3.2 does something wrong during this run, do not patch it in place. Work around it, tell the user, and write it in the retrospective with the tag `[skill]`. (2026-11-23, from the brief of the run)
- This repository is public. Never write the name of an employer or a client, a work ticket key, a count from work retrospectives or a path from this machine. This covers files, commits, the pull request, ticket comments, this plan file and the retrospective. A test fails on a home folder path in `docs/plans/` or `docs/retros/`. Test data and examples use the sample names `user`, `someone` or `runner`. (2026-11-23, from the conventions file and the brief of the run)
- Before `cstack publish`, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into a temporary file outside the repository, then run `python3 -B scripts/private_names.py check <that file>`, which must exit with 0. Never print the private list. (2026-11-23, from the brief of the run)
- Before the pull request opens, the update-branch phase rebases this branch on `main`, as the settings say. After the pull request is open, wait until the coordinator asks for an update. Then merge `origin/main` into this branch with a merge commit, keep both changes, and push with a plain `git push`, without force. (2026-11-23, from the brief of the run)
- Before you commit a rebase or a merge, search every file that had a conflict for a leftover conflict marker. Keep the author dates of the commits, so never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`. (2026-11-23, from the brief of the run)
- Never edit anything under the top-level `skills/` folder, which is frozen. Skill files go under `cstack/skills/` and `cstack/guides/`. Never push a tag that starts with `v`. (2026-11-23, from the brief of the run)
- If the `cstack` check on GitHub is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`. (2026-11-23, from the brief of the run)
- A repository declares the report with the key `testCommands.report`, whose only accepted value is the string `"junit"`, together with the placeholder `{report}` exactly once in `testCommands.file`. An older `cstack` then refuses the settings file with "unknown key", as ADR-SIC-D wants (`docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`, line 30). `TestCommands` gets the optional field `report` (`cstack/src/settings.ts`, line 34), and `TEST_KEYS` gets `"report"` (line 72). (2026-11-23, the user's answer to blocking question 1)
- The settings file is refused in each of these cases, with a message that names the key, and each case has its own test: the value of `testCommands.report` is not `"junit"`; `testCommands.report` exists without `testCommands.file`; `testCommands.report` exists and `file` has no `{report}`; `file` has `{report}` without `testCommands.report`; `{report}` appears more than once in `file`; `{report}` appears in `all`. (2026-11-23, the user's answer to blocking question 1)
- `runTests()` writes the report path in the temporary folder that it already makes for each run (`cstack/src/test-run.ts`, line 85), as `report.xml` next to `output.log`. The report is deleted with that folder at the end of the run (line 126). A new folder for each run means that an old report is never read as the current one. (2026-11-23, the user's answer to blocking question 2)
- When the caller asks for the report, the result of `runTests()` gets one field, `report`. It holds either the list of cases, or a problem with its kind and a clear message. The kinds are `missing` (no regular file at the report path), `malformed` (the reader refused the file, with the reader's message, which names the line when it can) and `timed-out` (the run reached its timeout, so no report was read). `runTests()` never throws because of a report: the caller still gets the exit code and the output. (2026-11-23, the user's answer to blocking question 3)
- The reader throws a clear error for a malformed report, as the acceptance of the ticket asks. `runTests()` catches only that error and turns it into the `malformed` problem. (2026-11-23, the user's answer to blocking question 3)
- `{report}` becomes `"$2"` in the script, never the real path. `cstack unit red` saves `run.script` (`cstack/src/commands/unit-red.ts`, line 58), and `cstack unit green` refuses the unit when its script differs from the saved one (`cstack/src/commands/unit-green.ts`, lines 30 and 31). A path that changes on every run would make every green run fail that check. (2026-11-23, accepted by default by the user)
- The reader decodes the five named entities (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&apos;`) and the numeric references `&#N;` and `&#xH;`. It refuses an unknown named entity and a reference to a code point that XML forbids. The pytest fixture holds a failure message with `&#10;`, because pytest writes a newline in an attribute that way. (2026-11-23, accepted by default by the user)
- The reader skips the `<?xml ...?>` declaration, other processing instructions and comments. It reads a CDATA section as text. Each of these has a test case. (2026-11-23, from the advisor, accepted by default by the user)
- A message of the reader that quotes text from the report escapes control characters and cuts long values, as `quote()` does in `cstack/src/settings.ts` (line 100). (2026-11-23, from the advisor, accepted by default by the user)
- The reader keeps two cases with the same name as two entries, in the order of the report. #100 decides how to match them. (2026-11-23, from the advisor, accepted by default by the user)
- The reader lives in `cstack/src/junit-report.ts`. It exports `type CaseOutcome = "passed" | "failed" | "error" | "skipped"`, `interface TestCase { name: string; classname?: string; file?: string; outcome: CaseOutcome }`, `class ReportError extends Error`, and `readJUnitReport(xml: string): TestCase[]`. `classname` and `file` are present only when the report writes them. Its test file is `cstack/test/junit-report.test.ts`, and its hand-written fixtures go under `cstack/test/fixtures/junit/`. #100 and #101 build on these names, so keep them. (2026-11-23, assumption not asked)
- `cstack/src/test-run.ts` exports `type ReportResult = { cases: TestCase[] } | { problem: "missing" | "malformed" | "timed-out"; message: string }`. `TestRun` gets the optional field `report?: ReportResult`. `runTests()` gets an optional fifth argument `options: { report?: boolean } = {}`. `testScript()` keeps its signature (`cstack/src/test-run.ts`, line 34). `usesReport(commands: TestCommands, testFile?: string): boolean` is true only when `testFile` is given, `commands.file` exists and `commands.report` is `"junit"`. #100 calls `runTests(root, testScript(commands, testFile), testFile, timeoutMs, { report: usesReport(commands, testFile) })`. (2026-11-23, assumption not asked)
- `runTests()` throws a plain `Error` before it starts the shell when the caller asks for a report without a test file. The report path is always the second argument of the script, so the test file must be the first. (2026-11-23, assumption not asked)
- The test case that checks that `runTests()` without the request returns exactly what it returns today passes before the code exists, by nature: it guards what must not change. This is the only allowed exception to "each new test case fails first". The implementer names it in its report as that exception, and proves it by breaking the rule on purpose, for example by making `runTests()` always add the `report` field. (2026-11-23, assumption not asked)
- A refusal test of the settings checks the exact path and the new text of the message, never only that a refusal happened. Today `cstack` already refuses `testCommands.report` as an unknown key (`cstack/src/settings.ts`, line 88), so a test that only expects a refusal would pass before the code exists. (2026-11-23, assumption not asked)
- This ticket does not change `cstack unit red`, `cstack unit green` or `cstack publish`. #100 makes the two unit commands ask for the report, and #114 owns `cstack/src/commands/publish.ts` in this wave. Until #100 is merged, a settings file that declares the report would give those commands an empty report path. No repository can use the option before the release, which ships #100 too. (2026-11-23, assumption not asked)
- Without the request for a report, `runTests()` returns exactly what it returns today, with no new field at all. A test checks that the result has no report field. (2026-11-23, assumption not asked)
- The reader returns each case with its `name`, its `classname` and its `file` when the report writes them, and its outcome: `passed`, `failed`, `error` or `skipped`. It keeps the values as the report writes them, after decoding the XML entities. It does not change a path. (2026-11-23, assumption not asked)
- A case with an `<error>` element is `error`. Otherwise a case with a `<failure>` element is `failed`. Otherwise a case with a `<skipped>` element is `skipped`. Otherwise it is `passed`. Other child elements, such as `<system-out>` or `<properties>`, do not change the outcome. (2026-11-23, assumption not asked)
- The reader finds the cases in any `<testsuite>`, at any depth, under a `<testsuites>` or `<testsuite>` root. (2026-11-23, assumption not asked)
- The reader refuses a report with a clear message in each of these cases, and each case has its own test: an empty text, an unclosed tag, an end tag that does not match, text other than spaces outside the root, a `<!DOCTYPE>`, an unknown named entity, a reference to a code point that XML forbids, a root that is neither `<testsuites>` nor `<testsuite>`, or a `<testcase>` without `name`. The message names the line of the problem when there is one. A report with no case at all is accepted, and gives an empty list. (2026-11-23, assumption not asked)
- vitest 5.1.0 writes a thrown error as `<failure>`, never as `<error>` (checked on a sample run of the real vitest of this repository, outside the repository). So the first reader test uses a hand-written pytest report that holds one passed, one failed, one error and one skipped case. A second test uses a hand-written vitest report with a passed, a failed and a skipped case, and a name that holds " > " and XML entities. (2026-11-23, assumption not asked)
- The `{report}` placeholder is refused in `testCommands.all`, as the ticket says, even though the specification says that each test command can declare a report (section 4, US-6, AC1). No consumer needs a report from `all`: #100 and #101 run one test file, and `cstack publish` needs no result per case. The places where the placeholder can stand are `file` and `all`, and each has its own test case. No test is added for `setupCommand`, because #97 removes that key and its tests (`cstack/test/settings.test.ts`, lines 286 to 305). (2026-11-23, accepted by default by the user)
- The README gets one short new section about the option, `## A test report per case`, placed just before `## Measure a run`. It does not change the paragraphs of the other commands, which other tickets of this wave edit. Its vitest example keeps the usual console output with `--reporter=default --reporter=junit --outputFile.junit={report}`, which vitest 5.1.0 accepts (checked on the same sample run). Its pytest example is `pytest --junitxml={report} {file}`. The section says that a repository can use the option only after the release that ships it. (2026-11-23, assumption not asked)

## Architecture

The approach is locked by the answers of the question round, and the change is small. No new decision since the question round.

A new module, `cstack/src/junit-report.ts`, reads a JUnit XML report into a list of test cases with a small hand-written parser and no dependency. The settings accept the key `testCommands.report` with the value `"junit"`, together with the placeholder `{report}` exactly once in `testCommands.file`. `testScript()` replaces `{report}` with `"$2"`. When the caller asks, `runTests()` passes `report.xml` in its own temporary folder as the second argument of the script, reads that file after the run, and returns the cases or the reason they could not be read. Nothing changes for a caller that does not ask.

Security: the only outside input is the report file that the test command writes. The reader refuses a `<!DOCTYPE>`, so no entity can expand, and it escapes control characters in any text that it quotes. The report path reaches the shell as an argument, never as shell text. There is no endpoint, query or secret.

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

### Unit 1: Read a JUnit XML report into test cases
- Files: `cstack/src/junit-report.ts`, `cstack/test/junit-report.test.ts`, `cstack/test/fixtures/junit/pytest.xml`, `cstack/test/fixtures/junit/vitest.xml`
- Test: `cstack/test/junit-report.test.ts`: `readJUnitReport()` reads the pytest fixture into one `passed`, one `failed`, one `error` and one `skipped` case, with their names and classnames; it reads the vitest fixture with names that hold " > " and decoded entities, and a `todo` case as `skipped`; a case with both `<failure>` and `<error>` is `error`; it finds cases in a nested `<testsuite>` and under a `<testsuite>` root; it keeps two cases with the same name; it decodes `&#10;` and `&#x41;`; it skips the XML declaration, a processing instruction and a comment, and reads a CDATA section as text; it keeps `file` when the report writes it; it returns an empty list for a report with no case; it throws `ReportError` with a clear message for each of these, each in its own case: an empty text, an unclosed tag, an end tag that does not match (the message names its line), text outside the root, a `<!DOCTYPE>`, an unknown named entity, a reference to a code point that XML forbids, a root that is neither `<testsuites>` nor `<testsuite>`, a `<testcase>` without `name`, and a very long or control-character value, which the message escapes and cuts.
- Minimum code: Write `cstack/src/junit-report.ts` with a single linear pass over the text that tracks the line number, an element stack, attribute parsing, entity decoding, and the outcome rule: error, then failed, then skipped, then passed.
- Refactor: None.
- Commit message: feat(cli): read a JUnit XML report into test cases
- Depends on: none

The test imports the new module with a dynamic `import()` inside each case, as `cstack/test/guide-steps.test.ts` does, so each case fails on its own before the module exists. The two fixtures are written by hand with sample names such as `user`, `someone` and `runner`, and hold no path of this machine. The pytest fixture follows the shape that pytest writes: a `<testsuites>` root, one `<testsuite name="pytest">`, `classname` as a dotted path such as `tests.test_sample.TestRunner`, a `<failure message="...">` whose message holds `&#10;`, an `<error message="failed on setup with ...">`, and a `<skipped type="pytest.skip" message="...">`. The vitest fixture follows the shape that the real vitest 5.1.0 wrote in a scratch folder: `<testsuites name="vitest tests">`, one `<testsuite>` per file, `classname` set to the test file path, `name` set to the describe titles and the test title joined by " > ", `<failure message="..." type="AssertionError">`, and `<skipped/>`. The edge cases use short XML strings written in the test.

### Unit 2: Accept testCommands.report and the {report} placeholder in the settings
- Files: `cstack/src/settings.ts`, `cstack/test/settings.test.ts`
- Test: `cstack/test/settings.test.ts`: a settings file with `testCommands.report` set to `"junit"` and `{report}` once in `testCommands.file` is accepted, and `values.testCommands.report` is `"junit"`; each of these is refused with the path and the new text of its message, each in its own case: `testCommands.report` is not `"junit"`; `testCommands.report` exists without `testCommands.file`; `testCommands.report` exists and `file` has no `{report}`; `file` has `{report}` without `testCommands.report`; `{report}` appears twice in `file`; `{report}` appears in `all`.
- Minimum code: Add `report?: "junit"` to `TestCommands`, `"report"` to `TEST_KEYS`, a count of `{report}` next to the count of `{file}` in `checkTestCommand()`, and the checks between `report` and `file` in the block that reads `testCommands`.
- Refactor: None.
- Commit message: feat(cli): accept testCommands.report and the {report} placeholder in the settings
- Depends on: none

`setupCommand` gets no `{report}` check and no new test. The existing tests of `cstack/test/settings.test.ts` and `cstack/test/next-settings.test.ts` must pass unchanged.

### Unit 3: Return the cases of the report from runTests
- Files: `cstack/src/test-run.ts`, `cstack/test/test-run.test.ts`
- Test: `cstack/test/test-run.test.ts`: `runTests()` with `{ report: true }` and the script `cp "$1" "$2"`, whose test file is the pytest fixture of unit 1, returns `report.cases` with its four cases; each of these is its own case: `testScript()` replaces `{report}` with `"$2"` and `{file}` with `"$1"`, and never writes a real path; `usesReport()` is true with a test file, a `file` command and `report: "junit"`, and false without the test file, without the `file` command, or without `report`; the second argument is `report.xml` in a fresh folder that no longer exists after the run; a script that writes no report gives the problem `missing`; a script that writes a malformed report gives the problem `malformed`, with the line of the reader's message; a run that reaches its timeout gives the problem `timed-out`; a report asked without a test file throws before the shell starts; without the request, the result has no `report` field and the script gets only one argument.
- Minimum code: In `testScript()`, also replace `{report}` with `"$2"`. Add `ReportResult`, the `report` field of `TestRun`, `usesReport()`, and the fifth argument of `runTests()`. When the report is asked, pass `join(dir, "report.xml")` as the second argument, then read it with `readJUnitReport()` before the folder is deleted.
- Refactor: None.
- Commit message: feat(cli): return the cases of a JUnit report from runTests
- Depends on: 1, 2

The case "without the request, the result has no `report` field and the script gets only one argument" passes before the code exists. It is the one allowed exception to "each new test case fails first", as `## Decisions` says, and the implementer proves it by breaking the rule. `cstack unit red`, `cstack unit green` and `cstack publish` do not change in this unit.

### Unit 4: Explain the test report per case in the README
- Files: `README.md`
- No test: this unit only adds documentation.
- Minimum code: Add the section `## A test report per case` just before `## Measure a run`. Say what the option gives, with one vitest example (`"file": "npx vitest run --reporter=default --reporter=junit --outputFile.junit={report} {file}"` with `"report": "junit"`) and one pytest example (`"file": "pytest --junitxml={report} {file}"` with `"report": "junit"`). Say that `cstack` replaces `{report}` with a path in a temporary folder of each run, and that the placeholder is refused in `all`. Say that a repository can use the option only after the release that ships it, because an older `cstack` refuses the key `testCommands.report`.
- Refactor: None.
- Commit message: docs: explain the test report per case in the README
- Depends on: 2, 3

Follow the documentation writing rules of the conventions file: one idea per sentence, plain words, and no machine path.

## Documentation duties

- The new section of `README.md` about the option: applies, written by unit 4.
- The comment on this ticket: applies, written in the document phase. It says how a repository declares the report, where the report goes, and what `runTests()` returns.
- The comments on the dependent tickets #100 and #101: applies, written in the document phase. They give the names that those tickets build on: `usesReport()`, the fifth argument of `runTests()`, `TestRun.report`, `ReportResult` and `TestCase`. They also say that `cstack unit red` and `cstack unit green` must pass the request, and that pytest gives `error` for a broken fixture.
- An ADR: does not apply. The choice of a key follows the rule of ADR-SIC-D, and the README and the ticket comments record it.
- The specification page `docs/projects/refocus-and-quality-guards.md`: does not apply. #98 edits it in this wave, and its acceptance criteria do not change.
- The entry of a command in `cstack/src/manifest.ts`: does not apply. This ticket adds an option, not a command.

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

### Question 1: How a repository declares the report
Should a repository declare the report with a new key `testCommands.report`, whose only value is `"junit"`, next to the `{report}` placeholder in `testCommands.file`? Or with the placeholder alone, as the ticket suggests? I recommend the key. I checked it with the installed `cstack` 0.3.2 in a temporary repository. It accepts a `file` command that holds `{report}` and prints it as it is, so it would run the command with a literal `{report}` path. The same `cstack` refuses `testCommands.report` with "unknown key. Allowed keys here: all, file. If this key comes from a newer cstack, update cstack." and exits with 3. So the key keeps the rule of ADR-SIC-D: an older `cstack` refuses a setting that it cannot honour. With the key, `{report}` must appear exactly once in `file`. It is refused in `file` without the key, and always refused in `all`.
- For: the user
- Answer: the key `testCommands.report` with the value `"junit"`, plus the `{report}` placeholder in `testCommands.file`, as recommended. The user, in the conversation, 2026-11-23.

### Question 2: Where the report file is written
The ticket suggests a path in the run folder. I recommend the temporary folder that `runTests()` already makes for the output of each run (`cstack/src/test-run.ts`, line 85), which it deletes at the end (line 126). `runTests()` does not know the plan, so it cannot find the run folder. `cstack publish` even runs tests with no plan unit at all. #100 saves the per-case results in `red.json` and `green.json`, so nothing is lost. Do you agree?
- For: the user
- Answer: the temporary folder of each test run, deleted with that folder, as recommended. The user, in the conversation, 2026-11-23.

### Question 3: What `runTests()` returns for a missing or malformed report
When the caller asks for the report, I recommend that `runTests()` adds one field to its result. That field holds either the list of cases or the reason why the report could not be read, such as "the report is missing" or "the report is not valid XML, at line 4". After a timeout, the field says that no report was read. `runTests()` never throws for a report, so the caller still gets the exit code and the output that it prints. The commands that #100 changes then refuse the unit with that reason. The reader itself throws a clear error on a malformed report, as the acceptance of the ticket asks. Do you agree?
- For: the user
- Answer: one field with the cases or the reason, with "missing" and "malformed at line n" kept apart, and no exception, as recommended. The user, in the conversation, 2026-11-23.

## Review log

<phase review>

## Briefing

<CTO advisor, moment after-build>

## Non-blocking questions

none

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request>

## Documentation

<phase document>

## Executor notes

<executor, before its report>

## Hand-off log

### 2026-11-23, executor run 1 (build)

- Moved ticket #99 to "in progress" with `cstack tracker move`.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan.**

**Declare the report with a new key `testCommands.report: "junit"`, next to `{report}` in the `file` command.** Once it ships, this key is part of the settings file, and renaming it later needs settings version 2. The installed `cstack` 0.3.2 treats an unknown `{report}` as plain text, so vitest would write a file named `{report}` in the repository. The same version refuses an unknown key, which is what ADR-SIC-D wants. I recommend the key. Its value is a string, so another format can come later without a rename. The key is refused when there is no `file` command.

**Write the report in the temporary folder that each test run already creates, and delete it with that folder.** `runTests()` does not know the plan, and `cstack publish` runs tests with no unit. A new folder for each run also means an old report can never be read as the current one. I recommend this folder. #100 keeps the cases in `red.json` and `green.json`.

**For a missing or malformed report, `runTests()` returns the reason in one field and never throws.** An exception would lose the exit code and the output that the caller prints. After a timeout, a half-written report would look malformed. I recommend the field, with "missing" and "malformed at line n" kept apart, because a missing report usually means the command crashed first.

**I will do this unless you say no.**

- The reader decodes numeric references such as `&#10;`, and the pytest fixture holds one. I checked that Python's XML library, which pytest uses, writes a newline in a failure message as `&#10;`. A reader that knows only the five named entities would refuse most real pytest reports. Accepted by default.
- `{report}` becomes `"$2"` in the script, never the real path. `cstack unit green` compares its script with the one saved by the red run, so a path that changes on every run would make it refuse every unit. Accepted by default.
- I add no `{report}` test for `setupCommand`, because the ticket that moves the setup command to an Orca hook (#97) removes that key. Accepted by default.
- `{report}` stays refused in the `all` command, as the ticket says, although the specification says "each test command". #100 and #101 only run one test file. Accepted by default.

**I checked it myself.**

- vitest 5.1.0 writes only the five named entities and never a CDATA section.

**Good to know.**

- Until #100 is merged, a settings file with the key would run the unit commands with an empty report path. No repository can use the key before the release, and that release ships #100 too.
- #100 counts `error` as a failure. With pytest, a broken fixture gives `error`, so a case can fail first for the wrong reason.

#### Details

How a repository declares the report is blocking, and it needs the user. The installed 0.3.2 behaviour was tested in a temporary repository, as the draft question says, but the choice itself is a person's. `checkTestCommand()` counts only `{file}` (`cstack/src/settings.ts`, line 112), so an older `cstack` would run a `file` command that holds a literal `{report}`. With the README's vitest example, that writes a stray file named `{report}` in the repository root, where it can be committed by mistake. `unknownKeys()` (line 88) refuses a new key inside `testCommands`, which keeps the rule of ADR-SIC-D (line 30). I rejected the placeholder alone for that reason, and a boolean value because a string such as `"junit"` leaves room for another format without renaming a released key. Each refusal gets its own test case. The settings file is refused when the value is not `"junit"`, or when the key exists without a `file` command. It is also refused when the key exists and `file` has no `{report}`, or when `file` has `{report}` without the key. Finally, it is refused when `{report}` appears more than once, or in `all`. If nobody decides, the ticket's text applies, which is the placeholder alone.

Where the report file is written is blocking, and it needs the user, because no test can settle a design choice. `runTests()` creates `cstack-test-run-*` (`cstack/src/test-run.ts`, line 85) and removes it even after an error (line 126). It never receives the plan or the run folder, and `cstack publish` calls it with no unit (`cstack/src/commands/publish.ts`, line 206). The ticket's "a path in the run folder" would mean passing the run folder into `runTests()` and cleaning old reports by hand. A new folder for each run removes the risk of reading a stale report from an earlier run as the current one. If nobody decides, the plan would follow the ticket's wording, which has no answer for `cstack publish`.

What `runTests()` returns for a missing or malformed report is blocking, and it needs the user, because #100 builds on that return shape. The reader itself throws on a malformed report, as the ticket's acceptance asks. `runTests()` catches that error and turns it into the reason. After a timeout, the process group is killed with SIGKILL (line 95), so a partly written report is likely, and the field says that no report was read. Keeping "the report is missing" apart from "the report is not valid XML, at line n" lets #100 tell a crashed command from a broken reporter. If nobody decides, an exception would cost #100 the exit code and the output that it prints today.

Numeric character references are non-blocking, and a test answered them. Python 3.11's `xml.etree.ElementTree` writes a newline in an attribute as `&#10;` and a tab as `&#09;`. This was checked by writing one element with that library. pytest has written its JUnit report with that library since version 6.0, from its changelog. pytest is not installed here, so pytest itself did not run. The reader decodes `&#N;` and `&#xH;`, and it refuses an unknown named entity or a reference to a code point that XML forbids. The pytest fixture holds a failure message with `&#10;`, because hand-written fixtures would otherwise hide the problem. If nobody decides, a strict reader would refuse most real pytest reports, since failure messages are usually several lines long.

Replacing `{report}` with `"$2"` is non-blocking, and this plan keeps the assumption already in `## Decisions`. `cstack unit red` saves `run.script` in `red.json` (`cstack/src/commands/unit-red.ts`, line 58). `cstack unit green` refuses the unit when its script differs from the saved one (`cstack/src/commands/unit-green.ts`, lines 30 and 31). A temporary path written into the script would change on every run, so every green run would be refused. The path also never becomes shell text, like `{file}` (`cstack/src/test-run.ts`, line 88).

No `{report}` test for `setupCommand` is non-blocking. The ticket that moves the setup command to an Orca hook (#97, milestone R2) removes `setupCommand` from `cstack/src/settings.ts` and from `cstack/test/settings.test.ts` (lines 286 to 305). A new case there would only add a merge conflict and then be deleted. The rule from the retrospective of #89, one test case for each place where a placeholder can stand, applies to the places that stay, which are `file` and `all`. If nobody decides, the assumption in `## Decisions` adds that case.

Refusing `{report}` in `all` is non-blocking. The specification says that "each test command" can declare a report (section 4, US-6, AC1), and the ticket refuses it in `all`. #100 uses the report with the `file` command. #101 says in its scope, item 4, "Run only the test file of the negative test, with its per-case report." `cstack publish` runs `all` and needs no result per case. So no consumer needs a report from `all`, and the ticket's narrower rule is kept.

Error messages of the reader are non-blocking. A message that quotes text from the report escapes control characters and cuts long values, as `quote()` does in `cstack/src/settings.ts` (line 100). vitest already strips terminal control characters in its writer, but a malformed report can hold anything.

The CDATA check is non-blocking, and a test answered it. The bundled JUnit reporter of the repository's vitest 5.1.0 escapes values with only `&amp;`, `&quot;`, `&apos;`, `&lt;` and `&gt;`, and it strips control characters. It writes no CDATA section, and ElementTree never writes one either. A CDATA section is still well-formed XML, so the reader skips one instead of calling the report malformed. The reader also skips comments and the `<?xml ...?>` declaration.

For #100 and #101, a few facts are worth carrying. A report can hold two cases with the same name, because vitest allows the same title twice in one block. The reader keeps both, and #100 decides how to match them. pytest can put both a `<failure>` and an `<error>` in one case when the teardown fails after the test, and the order "error wins" covers that. #100 counts `error` as a failure in the red run, so a pytest case whose fixture breaks can pass the "fails first" check without testing the new code. Until #100 is merged, a settings file with the key makes `cstack unit red` and `cstack unit green` run the script with an empty `"$2"`, and no repository can use the key before the release.

I checked operations and cost, UX edge cases, and scale and performance, and found nothing beyond writing the reader as one linear pass over a report of a single test file.

### Open questions and answers

- Blocking question 1: how a repository declares the report. Recommended: the key `testCommands.report` with the value `"junit"`, plus the `{report}` placeholder. Checked with the installed `cstack` 0.3.2, as the question says. The user accepted the recommendation on 2026-11-23.
- Blocking question 2: where the report file is written. Recommended: the temporary folder of the test run. The user accepted the recommendation on 2026-11-23.
- Blocking question 3: what `runTests()` returns for a missing or malformed report. Recommended: one field with the cases or the reason, and no exception. The user accepted the recommendation on 2026-11-23.
- Non-blocking: who asks `runTests()` for the report. Recommended: an optional fifth argument of `runTests()`, and a small exported function that tells from the settings and the test file whether the report applies. `cstack unit red` and `cstack unit green` are not changed here, because #100 wires them. Answered as an assumption, see `## Decisions`.
- Non-blocking: the vitest fixture and the error outcome. vitest 5.1.0 never writes `<error>`, so the four outcomes come from a pytest report. Answered as an assumption, see `## Decisions`.
- Non-blocking: the outcome of a case with several outcome elements. Recommended: error wins over failed, failed over skipped, and skipped over passed. Answered as an assumption, see `## Decisions`.
- Non-blocking: what counts as a malformed report. Answered as an assumption, see `## Decisions`.
- Non-blocking: `{report}` in the `all` command. The specification says that each test command can declare a report (section 4, US-6, AC1), but the ticket refuses it in `all`. The ticket is more precise, so this plan follows it. Answered as an assumption, see `## Decisions`.
- Non-blocking: where the README paragraph goes, and which vitest example it gives. Answered as an assumption, see `## Decisions`.
- Non-blocking, from the advisor: numeric character references, `"$2"` in the script, no `{report}` test for `setupCommand`, and `{report}` refused in `all`. The user did not object, so all four are accepted by default on 2026-11-23.

### Architecture options

<phase plan>
