# Plan: #14 — M2-2: Read and check the per-repository settings file

Date: 2026-11-18
Ticket: https://github.com/gambitl/claude-code-stack/issues/14
Tracker: GitHub
Documentation tool: the `docs/` folder of this repository (specification page `docs/projects/skills-into-cli.md`), ADRs in `docs/decisions/`
Branch: gambitl/settings-file
Conversation language: French
Status: in progress

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Each code repository gets one small settings file that states its own rules, and `cstack` reads that file and refuses it when it holds a mistake.

- **What the title means**: A repository is the folder of code and its history that a team works on. The per-repository settings file is a file inside that repository, at `.cstack/settings.json`. It holds the rules that a run of the `resolve-issue` skill must follow there. Examples are how the team brings finished work into the main branch, which language the written records use, and which command runs the tests. To read and check the file means that `cstack`, the command-line tool of this project, loads it and refuses it when a value is wrong or unknown.
- **Why we are doing it**: Today these rules live only in the conventions file, which is prose that Claude reads and can misread. The retrospectives of past runs show that a rule of the skill sometimes contradicts the rules of the repository. A file that a program checks removes that doubt.
- **For the user**: A solution engineer writes the rules of a repository once, and every run follows them. A typo in the file is caught at once, with a message that names the wrong key.

**Goal.** This ticket delivers the reader and checker of `.cstack/settings.json` with its defaults, an example file, and ADR-SIC-D, the short decision record that lets the settings file change the review agent and its model (US-10). Greenfield: nothing exists yet.

## Where things are today (read first)

* **cstack**: Greenfield: no existing surface. #7 creates the `cstack/` package with its tests and CI. It is not in the repository yet.
* **Models of the roles**: `skills/resolve-issue/SKILL.md` (lines 26 to 42): the section "Models and thinking levels" says that the header of each agent prompt sets the model and the thinking level of its role. Line 38 gives the independent review of the finished branch to Opus with a high thinking level. Line 42 says to launch the named agent without a model, so that the header decides.
* **The settled decision**: `skills/resolve-issue/SKILL.md` (line 210): "The model and thinking level of each role, set in the headers of `agents/`" is a settled decision since 2026-10-04. A settled decision is one that the user fixed on purpose, and the skill never changes it as an ordinary change. ADR-SIC-D reopens it for one role only.
* **The reviewer's header**: `skills/resolve-issue/agents/pr-reviewer.md` (lines 4 and 5): the header says `model: opus` and `effort: high`. This is the default that the settings file can override.
* **Rules that live in prose today**: `skills/resolve-issue/SKILL.md` (line 54) reads the test commands and the commit format from the conventions file. Line 152 writes every record in English unless the conventions file says otherwise. `skills/resolve-issue/agents/executor.md` (line 57) always rebases onto the target branch.
* **Specification**: `docs/projects/skills-into-cli.md` (lines 144 to 147) holds the criteria of US-10. Line 242 says that only the review agent and its model can change. Line 313 sets the default watch interval to five minutes. Line 321 describes ADR-SIC-D.

## Scope

1. Ship `cstack/src/settings.ts` with one function that reads `.cstack/settings.json` at the root of the repository. The root is the folder that `git rev-parse --show-toplevel` prints. The function returns every key with its value, and it says for each key whether the value comes from the file or from the default. A failure is a typed error, which every command turns into exit code 3, as the command list of #13 says.
2. Accept exactly these keys, with these rules and defaults.

   | Key | What it holds | Default when the key is absent |
   |---|---|---|
   | `version` | The number `1`. It is required whenever the file exists. | none |
   | `integration` | `merge` or `rebase`, which says how the branch catches up with its target branch. | `rebase`, which is what the skill does today. |
   | `recordsLanguage` | The language of every written record, such as `English` or `French`. It holds letters, spaces and hyphens, up to 40 characters. | `English` |
   | `forbiddenTools` | A list of command names that a run must never use in this repository, such as `yarn` in a repository that uses npm. | an empty list |
   | `commitAttribution` | A list of git trailer lines that cstack adds to every commit it makes, such as `Co-Authored-By: Claude <noreply@anthropic.com>`. | an empty list, so cstack adds no attribution |
   | `testCommands` | An object with `all`, the command that runs the whole test suite, and an optional `file`, a command that runs one test file. `file` must contain the placeholder `{file}` exactly once. | absent, so a command that runs tests exits with code 3 and names `testCommands.all` |
   | `review` | An object with `agent` and `model`, for the independent review of the finished branch. | `agent` is `claude`, and `model` is `opus`, the model in the header of `pr-reviewer.md` |
   | `watchIntervalMinutes` | A whole number from 1 to 1440, used by the watch of milestone 3. | `5` |

3. Refuse the file, with a message that names the key by its full path and says what is allowed, in each of these cases.
   - The file has an unknown key, at the top or inside `review` or `testCommands` (US-10 negative). For example, the message names `review.temperature`.
   - `version` is missing or is not `1`. The message says that this cstack reads settings version 1.
   - A value has the wrong type, or is outside its allowed values.
   - A trailer line of `commitAttribution` does not have the form `Key: value`, or holds a line break.
   - `review.agent` does not match `^[a-z][a-z0-9-]{0,31}$`, or `review.model` holds a character other than letters, digits, `.`, `_`, `-`, `[` and `]`.
   - The first word of a test command is in `forbiddenTools`.
   - The file is not valid JSON. The message gives the line and the column.
4. When the file does not exist, return every default. A missing file is not an error, because only the commands that run tests need `testCommands`.
5. Treat the test commands as code of the repository, like a script in its `package.json`, because the team writes them and commits them. Document in the code that #17 runs them through `/bin/sh -c`. Document also that `{file}` is never replaced by a path. #17 replaces it with `"$1"` and passes the path as a separate argument.
6. Add the example file `cstack/skills/resolve-issue/templates/settings.json`, with every key and its default value. The guide of the `ticket` phase (#21) points to it when a repository has no settings file.
7. Write ADR-SIC-D in `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
   - The context cites the settled decision of `skills/resolve-issue/SKILL.md` (line 210), its table (lines 30 to 40) and its launch rule (line 42).
   - The ADR weighs three options. The first keeps the headers only. The second lets the settings file change the review agent and its model only. The third configures every role.
   - The choice is the second option, because nobody needs more today, as the specification says at line 242. Every other role keeps its header. The thinking level of the review stays in the header.
   - When the settings file says nothing, the review agent is Claude with the model of the header (US-10 AC3). Another agent runs only where the settings file of the repository names it.
   - The consequences say that the settled decision is amended, not removed. The header stays the default. #21 records the amendment next to the other settled decisions, and #22 tells the executor how to apply it.
   - Link the ADR to this ticket and to the specification.

## Acceptance (TDD)

* `cstack/test/settings.test.ts`: write first the case of a settings file with the unknown key `reviewer`. It must be refused, and the message must name `reviewer` (US-10 negative). Then an unknown key inside `review`, such as `temperature`, is refused and named `review.temperature`.
* `cstack/test/settings.test.ts`: a file with every key gives each value back (US-10 AC1). It states whether the repository merges or rebases, the records language, the forbidden tools, the commit attribution, the test commands, and the agent and model of the review.
* `cstack/test/settings.test.ts`: a file with only `"version": 1` gives the review agent `claude` and the model `opus` (US-10 AC3). It also gives every other default of the table. Each value is marked as coming from the default.
* `cstack/test/settings.test.ts`: with no file at all, the reader returns the defaults and no `testCommands`, without an error.
* `cstack/test/settings.test.ts`: each wrong value is refused with the key and the allowed values. The cases are `integration` set to `squash`, `version` set to `2`, `watchIntervalMinutes` set to `0`, `review.agent` set to `my agent`, `testCommands.file` without `{file}`, a trailer line without a colon, and a test command whose first word is in `forbiddenTools`. A file with a missing comma is refused with its line and column.
* `cstack/test/settings.test.ts`: the example file `cstack/skills/resolve-issue/templates/settings.json` passes the reader, and its values equal the defaults.
* A reviewer finds `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` with the three options, the choice, the default and the link to the settled decision.
* `npm test` and `npm run typecheck` pass in `cstack/`.
* Reading the settings file never runs a command. The patterns of `review.agent` and `review.model` refuse spaces, quotes, `$` and `;`, so these values can later reach a command line in milestone 3 without becoming shell code.

**Size: S** · Blocked by: #7 · Feeds: #17, #20, #23, #30


### Ticket comments

Comment by the maintainer on 2026-11-17, after ticket #7 closed:

Ticket #7 is done. Here is the shape of the code you add to.

A command is a function that prints through an `io` argument and returns its exit code. The top-level function is `run(args, io)` in `cstack/src/cli.ts`, and `io` has `stdout` and `stderr`. Each command gets its own file in `cstack/src/commands/`, and parses its own options. Exit code 2 means a usage error and exit code 1 means a crash. When you turn a settings failure into exit code 3, return it from the command like the other codes. No code calls `process.exit()`, because on macOS it can cut output that goes into a pipe.


### Decisions already taken upstream

From the specification page, `docs/projects/skills-into-cli.md`, section 4, "Rules for every story":

- **Orca when available, with a fallback.** Every feature that uses Orca also works without Orca. `cstack` checks Orca feature by feature. For example, when Orca runs but is not connected to the tracker, only the tracker access falls back.
- **No credentials in `cstack`.** `cstack` never stores a token or a password. It reaches a tracker or a forge only through a command-line client that is already logged in on the machine, such as `orca`, `glab` or `gh`. When no such client exists, Claude reads the tracker with its own connection, and it hands the data to `cstack` as a file.
- **Tool-agnostic.** No story assumes one specific tracker or forge. The tracker can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code and the pull requests, can be GitLab or GitHub.
- **Ticket text is data.** `cstack` treats the text of a ticket, a comment or a plan as data. It never runs a command because such a text asks for it.
- **Claude is the only default agent.** Another agent can be used only where the settings file of the repository names it.
- **macOS only.** No story supports another operating system.
- **Public text.** Every text in this repository or in its issues follows the public text rule of section 5.

From section 5 of the same page, "Out of scope", the items that touch this ticket:

- 3. No agent other than Claude is used by default. Another agent is possible only through the settings file of the repository.
- 4. No system configures every role of every agent. Only the review agent and its model can change, in the settings file. Nobody needs more today.

From section 9 of the same page, the items that touch this ticket:

- Open question 7. **Watch interval.** `cstack wave --watch` reads the tracker at a regular interval. If nobody decides, the interval is five minutes. The recommendation is to make it a key of the settings file, so that a team can lower the load on its tracker.
- **ADR-SIC-D, the settings file and the models of the agents.** The settings file can change the review agent and its model, which the agent headers set today. This reopens a settled decision of `resolve-issue`. This ticket writes it.

From the epic (#6), "Open questions and decisions": "ADR-SIC-D, the settings file and the models of the agents, is to create. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 writes it."

From ticket #13 (the plan file format, the phase order and the command list, in progress in parallel), the common exit codes of milestone 2: `0` did its job, `1` refused, `2` usage error, `3` invalid input (the plan file, the settings file or the run state is missing, cannot be read, breaks its format, or has a format version this cstack does not read), `4` missing tool, `5` tool failed.

Decision records:

- ADR-SIC-H, how a cstack command starts and ends: `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.
- ADR-SIC-C, how cstack ships its skills (any folder under `cstack/skills/` is a shipped skill): `docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`.
- ADR-SIC-E, the new role of the repository (the prose skills under `skills/` are frozen; the repository is public): `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`.

## Dependencies

Clear. The only blocker is #7, the ticket that scaffolds `cstack`, and it is closed as completed.

## Code mapping

Graphify is not installed on this machine (`graphify` is not on the PATH, and there is no `graphify-out/`). The package is small, so the mapping used search and file reads instead.

**Base.** The branch was fast-forwarded onto `origin/main` at `f1de136` (the merge of #37, `cstack measure`) before any work. Nothing is committed on it yet.

**Patterns to follow.**

- `cstack/src/cli.ts` (`run(args, io)`) dispatches to one file per command in `cstack/src/commands/`. Each command prints through `io` and returns its exit code. `bin.ts` is the only file that touches the process (ADR-SIC-H). This ticket adds no command, so `cli.ts` does not change.
- Typed errors already exist in the code: `cstack/src/measure/moments.ts` (line 18) declares `export class MomentsError extends Error {}`, and the command turns it into an exit code. A `SettingsError` follows the same shape.
- The repository root: `cstack/src/measure/moments.ts` (line 46) finds it with `git rev-parse --show-toplevel` through `execFile`, from inside the command. The command, not the reader, is the natural place for that call.
- File reads: `cstack/src/commands/guide.ts` reads files synchronously and treats `ENOENT` as "absent" (`listDir`, lines 14 to 21).
- Tests: `cstack/test/*.test.ts` use vitest, a `collect()` helper for a fake `io`, and temporary folders (`mkdtempSync`) with `afterEach` cleanup. TypeScript is strict, `module: nodenext`, imports end in `.js`.
- Commands: `npm test`, `npm run typecheck` and `npm run build`, from `cstack/`. CI runs the same on `macos-latest`, then `node dist/bin.js --version`.

**Files this ticket adds.** `cstack/src/settings.ts`, `cstack/test/settings.test.ts`, `cstack/skills/resolve-issue/templates/settings.json`, `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.

**Risks found.**

- Tested: adding any file under `cstack/skills/resolve-issue/` makes `resolve-issue` a shipped skill folder, because `cstack/src/commands/skills.ts` (lines 153 to 158) treats every folder under `cstack/skills/` as a skill. The test "installs into an empty home" in `cstack/test/skills-install.test.ts` (lines 87 to 94) then fails. It expects the real package to print exactly `installed cstack-example\n`, and it received a second line, `installed resolve-issue`. The run created `cstack/skills/resolve-issue/templates/settings.json`, ran that test alone, saw it fail, and removed the file. Ticket #13 also adds files under `cstack/skills/resolve-issue/templates/`, so it hits the same test.
- Until #21 adds `SKILL.md`, a release would ship a `resolve-issue` folder that holds only templates. `cstack skills install` would skip it on a machine where the prose skill sits in `~/.claude/skills/resolve-issue` without the marker, and exit with `1`. Releases are manual and #23 makes the first one of milestone 2, so this is only a note for #23.
- Tested: `JSON.parse` on Node 26.10 gives "(line X column Y)" for most syntax errors, such as a missing comma, an unterminated string or a trailing comma. It gives no position for a misspelt literal (`tru`, `nul`), a comment line (`// …`), a byte order mark, or an empty or cut file ("Unexpected end of JSON input").
- Shared files with the parallel tickets: `docs/projects/skills-into-cli.md` (section 9, line 321, the ADR-SIC-D line), `cstack/skills/resolve-issue/templates/`, `cstack/test/skills-install.test.ts`, and the epic body on GitHub (#13 also updates its ADR line there).

**Governing decisions.**

- The settled decision of the frozen skill, `skills/resolve-issue/SKILL.md` (line 210): the model and thinking level of each role are set in the headers of `agents/`. The table is at lines 30 to 40, and the launch rule at line 42. ADR-SIC-D amends it for the independent review only.
- `skills/resolve-issue/agents/pr-reviewer.md` (lines 4 and 5): `model: opus`, `effort: high`. These are the defaults of `review`.
- The frozen prose skills under `skills/` are never edited (ADR-SIC-E).
- Consumers of the reader: #17 runs `testCommands` through `/bin/sh -c` with `{file}` replaced by `"$1"`, and exits with `3` naming `testCommands.all` when it is missing. #18 adds the `commitAttribution` lines to commits. #20 publishes with `integration`. #21 points to the example file and records the amendment. #22 launches the review with `review` and passes a model only when it differs from the header. #23 makes `cstack next` exit with `3` on an invalid settings file and print the settings above each guide. #30 reads `watchIntervalMinutes`.

## Decisions

**The reader and its result**

- The reader lives in `cstack/src/settings.ts`. It exports one function, `readSettings(root: string)`, plus its types and the error class `SettingsError`. (2026-11-18, the ticket, Scope 1)
- `readSettings` takes the repository root folder as its argument and reads only `<root>/.cstack/settings.json`. It never runs a command, git included. Each command that calls it finds the root itself with `git rev-parse --show-toplevel`, as `cstack/src/measure/moments.ts` (line 46) does, and the doc comment of the function says so. (2026-11-18, accepted by default)
- The read is synchronous (`readFileSync`), like `cstack/src/commands/guide.ts`. (2026-11-18, assumption not asked)
- Only the error code `ENOENT` means "the file is absent", and then the reader returns every default without an error. Any other read error, such as `EACCES` or `EISDIR` (the path is a folder), is a `SettingsError`, never the defaults. (2026-11-18, accepted by default)
- The result says whether the file was found, so that #21 can point a repository without a file to the example. (2026-11-18, assumption not asked, from the contract of #21)
- The result gives the value of every key of the table except `version`. For each of those keys, it also says whether the value comes from the file or from the default. The source is per top-level key, so `review` and `testCommands` each have one source. (2026-11-18, assumption not asked)
- `version` is the format number of the file. The reader checks it and does not return it as a setting. (2026-11-18, assumption not asked)
- The defaults are exactly the table of the ticket: `integration` is `rebase`, `recordsLanguage` is `English`, `forbiddenTools` is an empty list, `commitAttribution` is an empty list, `testCommands` is absent, `review` is `{ agent: "claude", model: "opus" }`, and `watchIntervalMinutes` is `5`. (2026-11-18, the ticket, Scope 2)
- The default `opus` of `review.model` is a copy of the header of `skills/resolve-issue/agents/pr-reviewer.md` (line 4). A comment next to it says so, and says that the ticket that launches the review (#22) passes a model only when the source of `review` is the file. (2026-11-18, accepted by default)

**Refusals and messages**

- Every failure is a `SettingsError`, a class that extends `Error`, like `MomentsError` in `cstack/src/measure/moments.ts`. Every command turns it into exit code `3`. This ticket adds no command, so no code maps it yet. (2026-11-18, the ticket, Scope 1, and the exit codes of #13)
- The reader collects every problem it finds in the file and refuses the file once, with a message that lists each problem on its own line. The error also carries the problems as a list, each with its key path and its text. (2026-11-18, accepted by default)
- Each problem names its key by its full path, such as `review.temperature`, `testCommands.file` or `commitAttribution[1]`, and says what is allowed. List items are counted from zero. (2026-11-18, the ticket, Scope 3, and accepted by default)
- A value quoted back in a message is written with `JSON.stringify` and cut to about 60 characters, so a control character or a terminal escape is shown escaped. (2026-11-18, accepted by default)
- The message of an unknown key names the key, lists the allowed keys at that level, and adds: "If this key comes from a newer cstack, update cstack." (2026-11-18, the developer's answer)
- The key check uses a set of known names or `Object.hasOwn`, never the `in` operator, so that `constructor`, `toString` or `__proto__` is refused as an unknown key. A test uses the key `constructor`. (2026-11-18, accepted by default)
- The top level of the file must be a JSON object. An array, a string, a number or `null` is refused. (2026-11-18, assumption not asked)
- `version` is required whenever the file exists, and it must be the number `1`. When it is missing or different, the message says that this cstack reads settings version 1. (2026-11-18, the ticket, Scope 3)
- The settings format stays at version 1 when a later ticket adds a key. It moves to version 2 only when a key is renamed, removed or changes meaning. ADR-SIC-D and the doc comment of the reader record this rule. (2026-11-18, the developer's answer)

**The rules of each key**

- `integration` is the string `merge` or `rebase`. (2026-11-18, the ticket)
- `recordsLanguage` is a string. The reader first converts it to the composed Unicode form with `normalize("NFC")`, then checks it against `^\p{L}[\p{L} -]{0,39}$` with the `u` flag: it starts with a letter, holds only letters of any script, spaces and hyphens, and has 1 to 40 characters. The result holds the converted value. (2026-11-18, accepted by default)
- `forbiddenTools` is a list of strings. Each name matches `^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$`. A duplicate name is accepted. (2026-11-18, accepted by default)
- `commitAttribution` is a list of strings. Each line is a key of letters, digits and hyphens that starts with a letter or a digit, then a colon and one space, then a value that does not start with a space and is not empty. The line holds no control character at all, line breaks included. (2026-11-18, the ticket, Scope 3, and accepted by default)
- `testCommands` is an object with the required key `all` and the optional key `file`, and no other key. Both are non-empty strings with no control character, so each command is one line. (2026-11-18, the ticket, and accepted by default)
- `testCommands.file` contains the placeholder `{file}` exactly once. `testCommands.all` must not contain `{file}`, and its message points to `testCommands.file`. (2026-11-18, the ticket, and accepted by default)
- The first word of a test command is the text before its first space or tab, after leading spaces are removed. The command is refused when that word, or the part of it after its last `/`, equals a name in `forbiddenTools`. So `./node_modules/.bin/yarn test` is refused when `yarn` is forbidden. The check applies to `all` and to `file`. (2026-11-18, accepted by default)
- `review` is an object with the required keys `agent` and `model`, and no other key. When `review` is present, both keys must be there. (2026-11-18, accepted by default)
- `review.agent` matches `^[a-z][a-z0-9-]{0,31}$`. `review.model` is a non-empty string of letters, digits, `.`, `_`, `-`, `[` and `]`. So both refuse spaces, quotes, `$` and `;`. (2026-11-18, the ticket, Scope 3)
- `watchIntervalMinutes` is a whole number from 1 to 1440. (2026-11-18, the ticket)
- A JSON `null` is a wrong type for every key. (2026-11-18, assumption not asked)
- Duplicate keys in the JSON text are accepted, and the last value wins, because that is what `JSON.parse` does. (2026-11-18, accepted by default, left open)

**Test commands are code of the repository**

- The reader treats the test commands as code of the repository, like a script in its `package.json`, because the team writes and commits them. The doc comment says that #17 runs them through `/bin/sh -c`, that `{file}` is never replaced by a path, and that #17 replaces it with `"$1"` and passes the path as a separate argument. (2026-11-18, the ticket, Scope 5)
- The doc comment also says that `[` and `]` in `review.model` are glob characters for a shell, so a later caller passes the model as a separate argument, never through a shell. (2026-11-18, assumption not asked)
- Reading the settings file never runs a command. No code path of the reader starts a process. (2026-11-18, the ticket, Acceptance)

**JSON syntax errors**

- `JSON.parse` alone decides whether the text is valid JSON. The reader removes one leading byte order mark (U+FEFF) before it parses. (2026-11-18, accepted by default)
- An empty file, or a file of only spaces and line breaks, is refused with its own message: the file is empty. (2026-11-18, accepted by default)
- When `JSON.parse` fails, a small locator walks the text, finds the offset of the first syntax error and turns it into a line and a column, both counted from 1. The message gives that line and column and a short reason that cstack writes. (2026-11-18, accepted by default)
- If the locator finds no error, the message gives the reason without a position, never a wrong position. (2026-11-18, accepted by default)
- The message never contains the text of Node's own `SyntaxError`, because that text can copy the content of the file. (2026-11-18, accepted by default)
- A test checks that the locator gives the same line and column as Node wherever Node gives one: a missing comma, a trailing comma, and a comment after the first key. Other tests cover a comment on the first line, a misspelt `true`, and an empty file. (2026-11-18, accepted by default)

**The example file and the install test**

- The example file is `cstack/skills/resolve-issue/templates/settings.json`. It holds `"version": 1` and every other key with its default value, and it leaves out `testCommands`, because the default of `testCommands` is "absent". A test checks that the reader accepts it and that its values equal the defaults. (2026-11-18, the ticket, Scope 6, and accepted by default)
- The test "installs into an empty home" in `cstack/test/skills-install.test.ts` (line 94) expects the literal output `installed cstack-example\ninstalled resolve-issue\n`. Write it literally, never from a listing of the folder. Ticket #13 makes the same edit, so the two merge cleanly. Change nothing else in that test file. (2026-11-18, accepted by default)

**ADR-SIC-D**

- Write `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` in the shape of `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`: a title, a Status line with the date 2026-11-18, a Ticket line, then Context, Options, Decision and Consequences. (2026-11-18, the ticket, Scope 7)
- Its context cites the settled decision of `skills/resolve-issue/SKILL.md` at line 210, the table at lines 30 to 40 and the launch rule at line 42. It cites line 210 only, and never copies the neighbouring settled decisions of that list. (2026-11-18, the ticket, and accepted by default)
- It weighs three options: the headers only, the settings file changing the review agent and its model only, and every role configured. It chooses the second option, because nobody needs more today (specification line 242). Every other role keeps its header, and the thinking level of the review stays in the header. (2026-11-18, the ticket)
- It says that when the settings file says nothing, the review agent is Claude with the model of the header (US-10 AC3), and that another agent runs only where the settings file of the repository names it. (2026-11-18, the ticket)
- Its consequences say that the settled decision is amended, not removed, that the header stays the default, that #21 records the amendment next to the other settled decisions, and that #22 tells the executor how to apply it. They also give the version rule: a new key keeps version 1, and a rename, removal or change of meaning moves to version 2. (2026-11-18, the ticket and the developer's answer)
- It links to the ticket, `https://github.com/gambitl/claude-code-stack/issues/14`, and to the specification, `docs/projects/skills-into-cli.md`. (2026-11-18, the ticket)
- In `docs/projects/skills-into-cli.md`, change only line 321, the ADR-SIC-D line of section 9, to add one sentence with the link to the record, as line 320 does for ADR-SIC-C. Never touch line 320 or line 319, which ticket #13 changes. (2026-11-18, accepted by default)

**Rules of this run, from the developer's brief**

- Never edit anything under the top-level `skills/` folder. It is frozen at the tag `prose-skills-final` (ADR-SIC-E). New skill files go under `cstack/skills/` and `cstack/guides/`. (2026-11-18, the developer's brief)
- Never run `cstack skills install` against the real home folder, and never change anything under `~/.claude/skills/`. Tests use a temporary home folder. (2026-11-18, the developer's brief)
- The repository is public. No file, commit, comment, pull request or retrospective names an employer or a client, quotes a work ticket key, or gives a count from work retrospectives. (2026-11-18, the conventions file)
- Never change the git `user.email` of the repository, and never commit with another address. (2026-11-18, the developer's brief)
- When the branch is brought up to date with `origin/main`, keep the author dates of the commits. Never use `--reset-author`, `--ignore-date` or `--committer-date-is-author-date`, because `cstack measure` reads the dates of the plan commits. (2026-11-18, the developer's brief)
- Keep the changes to shared files small and in their own place: `docs/projects/skills-into-cli.md`, `cstack/skills/resolve-issue/templates/`, `cstack/test/skills-install.test.ts`, and the epic body on GitHub. When another ticket merged first and a conflict appears, keep both changes. (2026-11-18, the developer's brief)
- Before the push, run two checks and go on only if both pass. First, `git log --format='%ae %ce' origin/main..HEAD` shows only the address that ends in `@users.noreply.github.com`. Second, write `git log -p origin/main..HEAD` and the drafted pull request title and body into one temporary file outside the repository, run `python3 scripts/private_names.py check <that file>`, and require exit code 0. Never print the private list. (2026-11-18, the developer's brief)
- If the `cstack` check is cancelled with "The job was not acquired by Runner", it is not a code failure. Rerun it with `gh run rerun <run id>`, and say so in the report if it still did not run. (2026-11-18, the developer's brief)
- Never merge the pull request. The developer merges it. (2026-11-18, the developer's brief)

## Architecture

The change is small and the approach is locked by the ticket and the answers above. One new module, `cstack/src/settings.ts`, reads and checks the file with plain TypeScript and no new dependency. The JSON error locator lives in its own small module, `cstack/src/json-position.ts`, with one exported function that takes the text and returns the line, the column and a short reason of the first syntax error, or nothing. No command and no change to `cstack/src/cli.ts`.

## Implementation units

### Unit 1: The reader, its defaults and the unknown keys — status: done
- Files: `cstack/src/settings.ts`, `cstack/test/settings.test.ts`
- Failing test: in `cstack/test/settings.test.ts`, write first a file `{"version": 1, "reviewer": "x"}` in a temporary root. `readSettings` throws a `SettingsError` whose message names `reviewer` and holds the hint "If this key comes from a newer cstack, update cstack." Then `{"version": 1, "review": {"agent": "claude", "model": "opus", "temperature": 1}}` is refused and the message names `review.temperature`. Then the key `constructor` at the top is refused as unknown. Then add: with no file at all, the result says the file was not found, gives every default, no `testCommands`, and every source is the default. A file with only `"version": 1` gives the review agent `claude` and the model `opus` and every other default, each marked as coming from the default (US-10 AC3). A file with every key gives each value back, each marked as coming from the file (US-10 AC1). `version` missing or set to `2` is refused with a message that says this cstack reads settings version 1. A top level that is an array is refused. A folder at the path `.cstack/settings.json` is refused with a `SettingsError`, not the defaults. A wrong type, such as `"watchIntervalMinutes": "5"` or `"review": null`, is refused with the key path. Two problems in one file give one error that lists both.
- Minimum code: `cstack/src/settings.ts` with the types, the defaults of the table, `SettingsError` with its list of problems, `readSettings(root)` that reads the file synchronously, treats only `ENOENT` as absent, removes a leading byte order mark, parses with `JSON.parse` (a parse failure is a `SettingsError` with a plain reason for now; unit 3 adds the line and the column), checks the top-level object, `version`, the known keys at the top and inside `review` and `testCommands` with a set of names, and the type of each value. Write the doc comments that the Decisions ask for: the root comes from the caller, the reader never runs a command, the version rule, the source of `review.model` for #22, and the test commands as code of the repository with `/bin/sh -c` and `"$1"`.
- Refactor: none expected.
- Commit message: `feat(cli): read .cstack/settings.json with its defaults and refuse unknown keys`
- Depends on: none

### Unit 2: The rules of each value — status: done
- Files: `cstack/src/settings.ts`, `cstack/test/settings.test.ts`
- Failing test: each wrong value is refused, and the message names the key and what is allowed. The cases of the ticket are `integration` set to `squash`, `watchIntervalMinutes` set to `0`, `review.agent` set to `my agent`, `testCommands.file` without `{file}`, a trailer line without a colon, and a test command whose first word is in `forbiddenTools`. Add: `watchIntervalMinutes` set to `1441` or `2.5`; `review.model` holding a space, a quote, `$` or `;`; `review` with `agent` and no `model`; `testCommands.file` with `{file}` twice; `testCommands.all` holding `{file}`; a test command with a line break; `./node_modules/.bin/yarn test` with `yarn` forbidden; a forbidden name with a space; a trailer line with a line break; `recordsLanguage` empty, longer than 40 characters, or holding a digit. `recordsLanguage` set to `Français` in decomposed form is accepted and returned in composed form. A message that quotes a value with a control character shows it escaped.
- Minimum code: the value rules of the Decisions section, each adding its problem to the list with the full key path and what is allowed.
- Refactor: if the checks repeat, group them in small helpers in the same file.
- Commit message: `feat(cli): check every value of the settings file and name the key that breaks a rule`
- Depends on: 1

### Unit 3: Line and column of a JSON syntax error — status: done
- Files: `cstack/src/json-position.ts`, `cstack/src/settings.ts`, `cstack/test/settings.test.ts`
- Failing test: a settings file with a missing comma is refused, and the message gives its line and column (the ticket's case). Add: a comment `// …` on the first line, a misspelt `tru`, and a cut file each give a line and a column. An empty file gives the message that the file is empty. For a missing comma, a trailing comma and a comment after the first key, the line and column equal the ones in Node's own message. No message holds the text of Node's `SyntaxError`. A file that starts with a byte order mark and is otherwise valid is accepted.
- Minimum code: `cstack/src/json-position.ts` with one exported function that walks the text as JSON and returns the line, the column and a short reason of the first syntax error, or nothing. `readSettings` calls it only after `JSON.parse` fails, and gives the reason without a position when the locator returns nothing.
- Refactor: none expected.
- Commit message: `feat(cli): give the line and the column of a JSON error in the settings file`
- Depends on: 1

### Unit 4: The example settings file and the install test — status: done
- Files: `cstack/skills/resolve-issue/templates/settings.json`, `cstack/test/settings.test.ts`, `cstack/test/skills-install.test.ts`
- Failing test: in `cstack/test/settings.test.ts`, copy `cstack/skills/resolve-issue/templates/settings.json` into a temporary root as `.cstack/settings.json`. The reader accepts it, every value equals the default, and the file holds every key of the table except `testCommands`.
- Minimum code: the example file, with `"version": 1` and every other key at its default value, formatted with two spaces. Then change only the expected output at `cstack/test/skills-install.test.ts` line 94 to the literal `installed cstack-example\ninstalled resolve-issue\n`. Run the whole suite, because the install test fails as soon as the example file exists.
- Refactor: none.
- Commit message: `feat(skill): add the example settings file of resolve-issue`
- Depends on: 1

### Unit 5: ADR-SIC-D and the link in the specification — status: done
- Files: `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`, `docs/projects/skills-into-cli.md`
- No test: documentation only. The reviewer checks the content against the ticket's acceptance line on the ADR.
- Minimum code: write the ADR as the Decisions section says, then add one sentence with its link to line 321 of the specification, and nothing else in that file.
- Refactor: none.
- Commit message: `docs: record ADR-SIC-D, the settings file and the review model`
- Depends on: none

Units 2, 3 and 4 all touch `cstack/src/settings.ts` or `cstack/test/settings.test.ts`, so they run one after the other, after unit 1. Unit 5 can run in parallel with any of them.

Security by design: the change has no endpoint, no database and no network. The external input is the settings file. The rules that matter are already units: no command runs while reading (unit 1), the patterns of `review.agent` and `review.model` refuse shell characters (unit 2), values are quoted escaped in messages (unit 2), and Node's message, which can copy the file, is never printed (unit 3). No secret is involved.

## Documentation duties

- ADR-SIC-D: applies, written to `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` (unit 5).
- The specification: applies, one sentence with the link on line 321 of `docs/projects/skills-into-cli.md` (unit 5).
- The epic (#6): applies. Its "Open questions and decisions" block says that ADR-SIC-D "is to create". Change only that line, so that it says the record exists at `docs/decisions/ADR-SIC-D-settings-file-and-review-model.md` and that ticket #14 wrote it, as the ADR-SIC-C line does. Re-read the body just before the edit, because #13 edits the same body.
- The doc comments of `cstack/src/settings.ts`: applies, as the Decisions say (units 1 and 2).
- A comment on this ticket (#14): applies, with what was built and the link to the pull request.
- Comments on the tickets that this one feeds or that use it: applies. #17 gets the shape of `testCommands`, the rule that a missing `testCommands` makes the command exit with `3` and name `testCommands.all`, and the warning that the reader reads the file on disk, so a build that edits it can change the test commands. #20 gets the `integration` value. #23 gets `readSettings(root)`, the mapping of `SettingsError` to exit code `3`, the `commitAttribution` lines, and the release note that until #21 adds `SKILL.md`, the package ships a `resolve-issue` folder that holds only templates. #30 gets `watchIntervalMinutes`. #13 gets the exact new line of the install test. #21 gets the example file without `testCommands` and the hint that its `ticket` guide tells the user to add `testCommands`. #22 gets the rule that it passes a model only when the source of `review` is the file, and the warning about the file on disk.
- README: does not apply. No command uses the settings yet, and #21 and #23 document how a run applies them.
- The conventions file: does not apply.

## Review log

### Impact notes (phase 7)

Graphify is not installed, so these notes come from search. The branch adds new files and changes one assertion in an existing test.

- `cstack/src/settings.ts` and `cstack/src/json-position.ts` are new. Nothing imports them yet, so no outside code depends on them. The only dependents are their own tests.
- `cstack/test/skills-install.test.ts` (line 94) now expects `installed cstack-example\ninstalled resolve-issue\n`. The full suite passes (132 tests), and `cstack/test/pack.test.ts` uses `toContain`, so it does not break.
- `docs/projects/skills-into-cli.md` changed on line 321 only. Lines 319 and 320 are untouched.
- No `WHY:` or `DECISION:` comment exists in the changed files that conflicts with the branch.

## Briefing

## Open questions after the build

### Blocking

### Non-blocking

## Pull request

## Documentation

## Executor notes

## Hand-off log

- 2026-11-18: phase 6 started. GitHub issues have no "in progress" state, so the ticket stays open and the branch `gambitl/settings-file` (already checked out) marks the start.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

One decision is yours. I will do the rest unless you say no.

**I need your answer before I plan**

**When a later ticket adds a key to the settings file, does `version` stay at 1?** Teams commit this file in their repositories, so its format cannot be taken back once it is out. Every unknown key is refused, so a teammate with an older cstack gets every run blocked with exit code 3. The message "unknown key" does not tell them what to do. I recommend keeping `version: 1` when a key is added, and moving to 2 only when a key is renamed, removed or changes meaning. The unknown-key message would add "if this key comes from a newer cstack, update cstack". I will write this rule in ADR-SIC-D.

**I will do this unless you say no**

- For the install test that breaks, I write the new expected output literally: `installed cstack-example`, then `installed resolve-issue`. The ticket of the plan file format (#13) needs exactly the same line, and two identical edits merge without a conflict.
- `JSON.parse` decides whether the file is valid, and the small locator only finds the line and the column. I drop a leading byte order mark instead of refusing it. I never print Node's own message, because it copies the file's content.
- The reader checks keys with `Object.hasOwn`, never with `in`. With `in`, a key named `constructor` would pass as known.
- I convert `recordsLanguage` to the composed Unicode form (NFC) before the pattern. Otherwise a `Français` typed in decomposed form is refused.
- The example file leaves out `testCommands`, because its default is "absent". Otherwise the test "the example equals the defaults" cannot pass.
- The default `opus` of `review.model` copies the header of `pr-reviewer.md`. The code comment says that the ticket that launches the review (#22) passes a model only when the value comes from the file.
- I re-read the epic body just before I edit it and change only the ADR-SIC-D line, because #13 edits it too.
- The other draft answers stay as they are.

**I checked it myself**

- The ADR-SIC-B line and the ADR-SIC-D line of the specification, changed on two branches, merge without a conflict.

**Good to know**

- The reader reads the file as it is on disk. An agent that edits it during a build changes the test commands and the reviewer, which matters for #17 and #22.

#### Details

**Format version rule (blocking, someone has to answer: the developer).** The settings file is committed in every repository that uses cstack. So its key names and its `version` number behave like a public interface. The negative criterion of US-10 makes every unknown key a refusal. #23 turns that refusal into exit code 3 for `cstack next`, so an older cstack blocks the whole run. Two rules are possible. The first rule bumps `version` for every new key. An old cstack then says "this cstack reads settings version 1", which is clear. The cost is that every repository must edit its file, even when it uses none of the new keys. The second rule keeps `version: 1` when a key is added, and bumps it only for a rename, a removal or a change of meaning. Its cost is that the unknown-key message must hint at an update. I recommend the second rule. `watchIntervalMinutes`, which #30 needs, is already in this ticket, so no addition is planned yet. If nobody decides, no rule is written, and the first person who adds a key picks one alone. The rule goes in the consequences of ADR-SIC-D and in the doc comment of the reader.

**The install test (draft question 1, blocking, tested).** I disagree with the draft recommendation, which builds the expected output from a listing of the real `cstack/skills/`. That copies the logic of `cstack/src/commands/skills.ts` (lines 153 to 158) into the test, so the test can no longer catch a change in which folders are shipped. Both this ticket and #13 add files under the same folder, `cstack/skills/resolve-issue/templates/`, so both produce exactly the same output, `installed cstack-example\ninstalled resolve-issue\n`. If both tickets make the same literal edit at `cstack/test/skills-install.test.ts` line 94, git merges them cleanly; I checked this with two branches that make the identical change in a scratch repository. The plan of #13 (in the worktree `plan-format`) does not mention this test yet, so the comment on #13 should give the exact line. `cstack/test/pack.test.ts` lists only required paths with `toContain`, so it does not break.

**Where the root comes from (draft question 2, blocking).** I keep the draft recommendation: the exported function takes the root folder and only reads `<root>/.cstack/settings.json`. Only `ENOENT` means "absent". `EACCES`, `EISDIR` and any other read error is a `SettingsError`, never the defaults, otherwise a broken file silently gives the defaults.

**Line and column of a JSON error (draft question 3, blocking, tested).** I keep the locator, with three guards. First, `JSON.parse` stays the only judge of validity, and the locator only places the error. If the locator finds nothing, the message gives the reason without a position, never a wrong position. Second, a test checks that the locator gives the same line and column as Node wherever Node gives one. The inputs are a missing comma, a trailing comma and a comment after the first key. Third, the reader removes a leading byte order mark before parsing, as npm does for `package.json`. An empty file gets its own message, "the file is empty". I ran Node 26.10 again. A comment at the very start, `tru` and a byte order mark give the form `Unexpected token 'X', "<file text>" is not valid JSON`, with no position. A comment after a key gives "(line 2 column 2)". Node's message copies the file text, so the reader never forwards it as it is.

**Unknown keys and the prototype (new, non-blocking).** I ran `'toString' in {version: 1}` and `'constructor' in …`, and both are `true`. A check written with `in` would accept `constructor`, `toString` or `__proto__` as known keys. `JSON.parse('{"__proto__": …}')` creates an own key, so `Object.keys` sees it, and the check must use a `Set` of names or `Object.hasOwn`. A test with the key `constructor` guards this.

**`recordsLanguage` and Unicode (draft question 6, blocking).** I keep "any Unicode letter" (`\p{L}` with the `u` flag). I tested that `Français`, the decomposed form, fails `^\p{L}[\p{L} -]{0,39}$` while the composed form passes. The reader converts the value with `normalize("NFC")` before the pattern and the length check, and returns the converted value.

**Error messages (draft question 5, non-blocking).** I keep "every problem in one message". Each value quoted back is written with `JSON.stringify`, so a control character or a terminal escape is shown escaped, and it is cut at about 60 characters. A list item is named with its index, such as `commitAttribution[1]`, counted from zero like the JSON path convention.

**The example file (new, blocking).** Scope 6 asks for "every key and its default value", and the acceptance asks that the example's values equal the defaults. `testCommands` has no default value, so it cannot be in the file without breaking that test. I recommend leaving it out, and the comment on #21 says that the guide of the `ticket` phase tells the user to add `testCommands`. The file still holds `"version": 1` and every other key. By default, an executor would add `testCommands` with a made-up command, which is worse: in a repository that is not npm, `npm test` fails, and #17 could read that failure as the red step of a test.

**The default model of the review (new, non-blocking).** The default `opus` is a copy of the header of `skills/resolve-issue/agents/pr-reviewer.md` (line 4). The acceptance asks for it, so it stays. If a later header changes to another model, a caller that compares the value with the header would then pass `opus` and override the header without anyone choosing it. The reader already marks the source of each value, so the doc comment says that #22 passes a model only when the source is the file. The note goes in the comment on #22.

**The epic body (new, non-blocking).** `gh issue edit --body` replaces the whole body. #13 also changes its ADR line in the epic body. A body read at the start of the run and written at the end would erase the other ticket's change. The executor re-reads the body just before the edit and changes only the ADR-SIC-D line.

**The specification line (tested).** Lines 319 (ADR-SIC-B, changed by #13) and 321 (ADR-SIC-D, changed here) are separated by line 320. I changed each on its own branch in a scratch copy and the merge succeeded without a conflict. It stays clean as long as neither ticket touches line 320.

**Draft questions 4, 7, 8, 9, 10 and 11.** I keep each recommendation as drafted and each label. Both keys of `review` are required. The pattern of `forbiddenTools`, the rule that the first word of a test command is matched with and without its path, the trailer rule, and the rules of `testCommands` stay as written. Duplicate keys and words before the tool (`CI=1 yarn test`) stay accepted and open; both are non-blocking.

**The file on disk (new, non-blocking).** The reader reads the working-tree copy, which is right for this ticket. During a build, an implementer can edit `.cstack/settings.json`. It could then change `testCommands.all` to a command that always fails or always passes, which defeats the red-then-green proof of #17, or change `review` before #22 launches the review. The comments on #17 and #22 should say so. A simple guard there is to refuse a run whose diff touches `.cstack/settings.json` unless the ticket asks for it, or to read the copy of the target branch.

**Release note for #23.** Already in the code mapping: until #21 adds `SKILL.md`, a release ships a `resolve-issue` folder with only templates. ADR-SIC-C already says that the new skill and the prose skill cannot live side by side, so `cstack skills install` skips it with exit `1`, and `--adopt resolve-issue` would replace the working prose skill on that machine (with a backup). This is for #23.

**Public text.** The ADR cites the settled decision of `skills/resolve-issue/SKILL.md` at line 210. The neighbouring settled decisions in that list name a ticket key; the ADR must cite line 210 only and not copy the list.

Locked decisions I did not reopen: ADR-SIC-C (shipping), ADR-SIC-E (frozen prose skills, public repository), ADR-SIC-H (command shape and exit codes), the exit code 3 of #13, the keys and defaults of the ticket's table, and section 5 items 3 and 4 of the specification. I checked scale and performance, operations and cost, and the multi-tenant and mobile cases, and found nothing.

### Open questions and answers

Draft of phase 4.1, before the advisor. Each question has its label and the recommended answer.

1. **The example file breaks an existing test.** Blocking. Tested: adding `cstack/skills/resolve-issue/templates/settings.json` makes `resolve-issue` a shipped skill folder, and `cstack/test/skills-install.test.ts` ("installs into an empty home", lines 87 to 94) fails, because it expects exactly `installed cstack-example\n` (evidence in "Code mapping"). Recommended answer: change that one assertion so that the expected output is built from the folders that the real `cstack/skills/` holds, one `installed <name>` line per folder in sorted order. Ticket #13 adds files to the same folder in parallel and hits the same test, so whichever ticket merges second keeps one of the two fixes. The alternative, putting the example file elsewhere, contradicts the ticket (Scope 6) and the contract of #21.
2. **Where the repository root comes from.** Blocking. Scope 1 says that the root is the folder that `git rev-parse --show-toplevel` prints. The acceptance says that reading the settings file never runs a command. Recommended answer: the exported function takes the root folder as its argument and only reads `<root>/.cstack/settings.json`. Each command that calls it runs `git rev-parse --show-toplevel` itself, as `cstack measure` already does in `cstack/src/measure/moments.ts` (line 46). The doc comment of the function says so. This ticket adds no command, so no code runs git.
3. **Line and column for every JSON syntax error.** Blocking. Tested: on Node 26.10, `JSON.parse` gives "(line X column Y)" for a missing comma, but no position for a comment line, a misspelt `true` or `null`, a byte order mark, or an empty file. Recommended answer: when `JSON.parse` fails, a small locator of about 60 to 80 lines walks the text and finds the offset of the first syntax error, then turns it into a line and a column. The message also keeps the reason. The alternative is to use the position that Node gives when it gives one, and to say "at the end of the file" for an empty or cut file. That alternative is smaller but leaves a comment line or a misspelt literal without a position.
4. **When `review` is present, are both `agent` and `model` required?** Blocking. The table marks only `testCommands.file` as optional, so both keys of `review` are required. Recommended answer: yes, both are required. A file that names `"agent": "codex"` with no model would otherwise get `opus`, which means nothing for that agent.
5. **One problem or every problem in one message.** Non-blocking. Recommended answer: the reader collects every problem it finds and the error message lists each on its own line, each with its key path. A user then fixes the whole file in one go.
6. **What "letters" means in `recordsLanguage`.** Blocking. Recommended answer: any Unicode letter, so `Français` and `Español` pass, plus spaces and hyphens. The value starts with a letter and has 1 to 40 characters.
7. **What a name in `forbiddenTools` may hold, and how a test command matches it.** Blocking. Recommended answer: each name matches `^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$`, because the guides of #23 print these values for Claude, and a pattern keeps free text out. The first word of a test command is the text before its first space or tab. It matches when it equals a forbidden name, or when the part after its last `/` equals one, so `./node_modules/.bin/yarn` is caught too. A duplicate name is accepted.
8. **What a valid trailer line of `commitAttribution` is.** Blocking. Recommended answer: a key of letters, digits and hyphens that starts with a letter or a digit, then `: `, then a value that does not start with a space. The line holds no control character at all, line breaks included.
9. **Extra rules on `testCommands`.** Blocking. Recommended answer: `all` and `file` are non-empty strings with no control character, so each is one line. `all` must not contain `{file}`, because #17 never replaces it there, and the message points to `testCommands.file`.
10. **Duplicate keys in the JSON text.** Non-blocking. `JSON.parse` keeps the last value without a word. Recommended answer: accept it, and leave it open.
11. **Words before the tool in a test command.** Non-blocking. With the first-word rule, `CI=1 yarn test` or `npx yarn test` is not caught. Recommended answer: keep the rule of the ticket, and leave this open.
12. **When a later ticket adds a key, does `version` stay at 1?** Blocking, added by the advisor. Recommended answer: keep `version: 1` when a key is added, and move to `2` only when a key is renamed, removed or changes meaning. The unknown-key message adds a hint to update cstack. ADR-SIC-D records the rule.

Answers, given in the conversation on 2026-11-18. The developer replied "ok super" to the short version of the advisor's block.

- Question 12: accepted as recommended. The version stays at 1 when a key is added, and the unknown-key message carries the update hint.
- Question 1: the advisor's version is accepted by default. The expected output of the install test is written literally, `installed cstack-example\ninstalled resolve-issue\n`, instead of being built from a folder listing.
- Questions 2 to 9: accepted by default, as drafted and as refined in "Details" (the root as an argument, the locator with its three guards, both keys of `review` required, every problem in one message, Unicode letters with NFC, the patterns of `forbiddenTools` and of the trailer lines, the rules of `testCommands`).
- The advisor's other points under "I will do this unless you say no" are accepted by default: `Object.hasOwn` or a set of names for the key check, the byte order mark removed, Node's message never forwarded, the example file without `testCommands`, the doc comment on the source of `review.model`, and the epic body re-read before its edit.
- Questions 10 and 11: open, not needed for this ticket. They go into the pull request under "Open questions, not needed for this pull request".

### Architecture options

No real choice remained after phase 4, so no blueprints were drawn. No new structural decision since phase 4, so the advisor was not called again.
