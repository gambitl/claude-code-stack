# cstack and my Claude Code setup

This repository is the source of `cstack`, a command-line tool for working with Claude Code. It also holds the skills that `cstack` ships, and the older prose skills that I froze. Finally, it keeps a copy of my personal Claude Code configuration in the `config` folder. The `sync.sh` script refreshes that copy.

The live setup stays in `~/.claude`. The `config` folder is only a copy. Editing a file there does not change how Claude Code behaves.

## Requirements

`cstack` needs the items below on your Mac. Run `cstack doctor` to check them. It prints one line for each item and tells you how to install what is missing.

- **macOS**: required. `cstack` runs only on macOS.
- **Node**: required. Install the current long-term support release from https://nodejs.org. The exact minimum is the `engines.node` field in `cstack/package.json`.
- **git**: required. Run `xcode-select --install` to get it.
- **Forge client**: required. You need one of two tools. Install `gh` with `brew install gh` for GitHub. Install `glab` with `brew install glab` for GitLab.
- **Claude Code**: required. Install it with `curl -fsSL https://claude.ai/install.sh | bash`.
- **Orca**: optional. Download it from https://github.com/stablyai/orca/releases. The minimum Orca version is `1.4.259`. `cstack doctor` prints the minimum Orca version. It also says which Orca features work on your Mac, and why a feature does not.

## Install cstack

`cstack` is not on the npm registry. You install it from a release file on GitHub. Replace `<version>` with the version you want, for example the latest release:

```sh
npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/gambitl-cstack-<version>.tgz
cstack skills install
```

The first command installs the `cstack` command. The second command copies the skills that this version ships into `~/.claude/skills`. Run it without `sudo`, because the skills belong in your own home folder.

To update, run the same two commands with the link of the newer release. Do not use `npm update -g`. It cannot update `cstack`, and it stops with a 404 error.

To go back to an older release, install it the same way. Then run `cstack skills install` again.

Version `0.1.0` does not ship the `resolve-issue` skill. If you install it and run `cstack skills install`, `cstack` removes your `resolve-issue` skill. It saves the folder in `~/.claude/skill-backups/` first.

To get the prose skill back, you have two ways. The first way is to run `./pull-skills.sh --apply` from this repository. It copies the frozen prose skill into `~/.claude/skills`. The second way is to move the saved prose folder back by hand.

If you choose the second way, first move the current `~/.claude/skills/resolve-issue` folder away. The `mv` command puts the backup inside an existing folder instead of replacing it. After either way, `~/.claude/skills/resolve-issue` has no `.cstack-managed` file. So a later `cstack skills install` needs `--adopt resolve-issue` again.

Each skill that `cstack` installs holds a file named `.cstack-managed`. This file tells `cstack` that it owns the folder. If a folder of the same name has no such file, `cstack` skips it and leaves it as it is. To let `cstack` take it over, run `cstack skills install --adopt <name>`.

Before `cstack` replaces, removes or adopts a folder, it saves the old folder in `~/.claude/skill-backups/<date-time>/<name>`. This place is outside the skills folder, so Claude Code does not load the backups.

`cstack skills install` also looks at your Claude Code settings. It checks for the permission rule `Bash(cstack *)`. This rule lets Claude run any `cstack` command without asking you each time. The rule also lets Claude run `cstack skills install` without asking. If the rule is missing, `cstack` prints the rule and the path of the settings file. To add the rule yourself, run `cstack skills install --add-permission`. Before it changes the settings file, `cstack` keeps a copy of the old file next to it.

The rule only covers `cstack` commands. If no client can reach your tracker, Claude still writes to it with its own connection. The client is `gh` for GitHub, `glab` for GitLab, and Orca for Jira and Linear. The rule does not cover that connection, so Claude may ask you first.

## Commands

`cstack` has twenty-four commands. Run `cstack` with no argument to see how to call each one.

- `cstack doctor` checks that your Mac has everything `cstack` needs. The "Requirements" section above lists these items.
- `cstack guide <phase>` prints the guide of one phase of a skill, at the version of `cstack` that you installed. It leaves out the block of mandatory steps at the top of a guide. It exits with code 3 when that block never closes. The skill is `resolve-issue` unless you add `--skill <name>`.
- `cstack measure <plan file>` prints how many tokens and how much time one run of `resolve-issue` used. The "Measure a run" section below explains it.
- `cstack audit <plan file>` says which phases, which required commands and which helper checks of one run were done, skipped or done out of order. It checks that its inputs can be used and exits with 3 when they cannot. The settings file of the repository is one of these inputs. Then it prints one line for each phase, each required command and each helper check. A helper check is a step that asks the main conversation or the executor to start a sub-agent, such as `resolve-issue:cto-review`. Its line reads `<phase>: <helper>`, followed by the word of the step when it has one. Only a launch of that sub-agent proves a helper check. A plan section never proves it. The launch must name the same sub-agent type as the step. A launch of another type, such as `general-purpose`, does not count. A `SendMessage` to a sub-agent does not count either, because the guides ask for a fresh launch. When the setting `review.agent` is not `claude`, the independent review also accepts an Orca worker. That is a Bash call to `orca`, `orca-dev` or `orca-ide` whose first two arguments are `orchestration` and `worker-start`. The audit does not check which agent the worker runs. The helper lines come after the command lines. Helper checks that follow each other, such as the four reviewers of the review phase, have no order among themselves. The audit does not print a step when its condition does not hold. A step for each unit with a test, or for each unit, is printed once for each of them. A step for each dependent ticket is printed once for each ticket that the `Feeds:` line of the ticket names. A user interface step is printed only when a unit of the plan has a `Design specification` line. A step for a new structural decision is printed only when the plan file does not hold the sentence "No new decision since the question round". The audit never prints a step that only asks you to do something, such as writing a plan section. The close of most phases already refuses an empty plan section. One call or one launch serves only one line of the audit. A phase line does not use a call, so a phase line and the `cstack next --done <phase>` line of the same phase still share their call. A line that says `done` or `out of order` ends with the time and with where the proof came from. A line that says `skipped` ends with that word. The steps of the phases that run in the main conversation count only the calls of its own session files. These phases are ticket, dependencies, code-map, questions, plan and retro. The audit finds those files from the call `cstack next --done ticket --plan <plan file>`, which the main conversation makes at the close of the ticket phase. It also counts a second session file of the main conversation, for example after a resume. Such a file holds a call that only the main conversation makes, such as `cstack next --done plan` or `cstack helper start executor`. The audit ignores a call that names a plan file with another file name. The transcripts of helpers and the session of an executor that runs as a worker never count as the main conversation. When no session file holds the close of the ticket phase, the audit still prints every line. Then it prints a sentence on standard error that says the steps of the main conversation may show the calls of another agent. The audit looks for the steps of a unit that was built after the build phase closed until the close of the phase that built it. It takes the build time of a unit from its `cstack unit commit` call, then from `units/<n>/red.json` in the run folder, then from its first git commit. A unit built after the build phase closed does not set the floor of the steps that follow its group. The audit exits with 0 when every line is done. It exits with 1 when a line is not done, a session file cannot be read, or no session file holds the close of the ticket phase. It reads the guides of the version of `cstack` that you installed. A run that another version wrote needs `--guides <folder>`, which holds the guides of the version that the run used, as `resolve-issue/<phase>.md`. Run `git archive <commit>:cstack/guides | tar -x -C <folder>` to fill such a folder. Add `--home <folder>` to read the session files from another home folder. The audit has limits. A guide with no block of mandatory steps makes it exit with 3. A session that holds two runs mixes their calls. A call that `cstack` refused still counts. A loop such as `for n in 1 2; do cstack unit red $n; done` matches no step. The audit never prints the steps for a stuck unit or for a negative criterion, because it does not read the stuck reports of the run folder and has no data for the criteria yet. A program that the `ORCA_CLI_COMMAND` variable names is not recognised as an Orca worker launch. The audit reads the settings as they are when it runs, so a change made after the run can change the result. The step for a new structural decision looks for one English sentence, so a plan that says it in other words shows the step.
- `cstack next` prints the guide of the next phase of your plan and records that this phase started. It keeps that record in the git folder of the repository, not in the plan file. Add `--done <phase>` to record that a phase is finished, or `--phase <phase>` to choose the phase yourself. It also leaves out the block of mandatory steps at the top of the guide. Above each guide, it prints the settings of the repository from `.cstack/settings.json`. It marks each value that comes from the default. If that file is invalid, it prints the reason and exits with code 3. It prints no guide in that case.
- `cstack skills install` copies the skills that this version of `cstack` ships into `~/.claude/skills`. The "Install cstack" section above explains what it does with a folder that it did not write.
- `cstack plan status` prints, for each unit of the plan, whether git has a commit for it. It exits with 1 when git and the plan disagree.
- `cstack plan section <name>` prints one section of the plan file and nothing else.
- `cstack report submit <kind>` reads the text of a helper's report on standard input. It saves the report only when the plan and git prove it.
- `cstack report check` prints the oldest accepted report that nobody has read yet.
- `cstack helper start <role>` starts a helper, which is a second Claude that does one job of your run. The role is `executor`, `implementer` or `implementer-escalation`. The two implementer roles also need `--unit <n>`. The command starts the helper as an Orca worker when Orca can run workers. Otherwise it prints the sub-agent that Claude needs to start itself, and it exits with 6. Add `--child-worktree` to start an implementer in its own child worktree, which is a separate copy of the ticket worktree, so that parallel implementers never share files. When `.cstack/settings.json` has a `setupCommand`, such as `npm ci`, the implementer runs it first in its child worktree. Without a `setupCommand`, the implementer installs the packages as the conventions file says, with a command that does not change the lock file.
- `cstack helper wait <helper id>` waits for the report of a helper. It stops after nine minutes. If the helper is still working, it exits with 6, and you run it again.
- `cstack helper done <kind> --helper <helper id>` is the command that a helper runs to end its work. It reads the report on standard input, checks it, saves it, and tells Orca that the helper is done. When the helper worked in a child worktree, the command refuses a `done` report while that worktree still holds an uncommitted change other than the plan file.
- `cstack` never needs Orca for the helpers. If you set `CSTACK_ORCA_WORKERS=off`, `cstack helper start` does not ask Orca, and it always uses a sub-agent.
- `cstack unit order [--json]` reads the plan file and tells you which units can run at the same time. A batch is a group of units that share no file and whose dependencies are done. The units of one batch can run together, and the next batch starts after it. Units that already have a commit, and units that are blocked, are listed apart.
- `cstack unit red <n>` runs the test command of unit `n` and saves the result, but only when the run fails. A failing run is a run where the test command exits with an error. It proves that the new test failed before the code existed. It does not prove that the test failed for the right reason, so you still need to read the saved output. It refuses to run when a file of unit `n` other than a test file differs from `HEAD`, because the test must fail before any code of the unit exists. A file counts as a test file when it is the file of the `Test` line of the unit. A file also counts as a test file when it sits in a folder such as `test`, `tests` or `fixtures`, or when its name ends with `.test.ts`, `.spec.ts` or `_test.ts`, or starts with `test_`.
- `cstack unit green <n>` runs the same test command and saves the result, but only when the run passes. A passing run is a run where the test command exits without an error. When the test does not pass, it deletes any passing run that an earlier call saved. This also happens when the test runs past the timeout or its command cannot start. This way, `cstack unit commit` cannot accept code whose test fails now. It refuses to run when unit `n` has no saved failing run. It also refuses when the test command or the test file path changed since the failing run, because a changed command could hide a test that never failed. It also refuses when a changed code file of the unit is older than the start of the latest failing run. This check is a safety net, not a proof, because a file written back with a new time still passes it.
- `cstack unit commit <n>` commits only the files that unit `n` lists in the plan, and it adds a `Cstack-Unit: <n>` line to the commit message. Right after that line, it adds each `commitAttribution` line of your settings, so that git reads them all as trailers. If your settings file is invalid, it exits with code 3 and stages nothing. It never commits a file of another unit. It refuses to commit when a rule of the plan or the test runs says no, and it lists every refusal at once. Two unit commits in one worktree wait for each other, so they never mix their files. When the unit already has a commit on the branch, the command asks for `--message` with a subject of its own, and it refuses a subject that the unit already used.
- `cstack unit collect <n>...` brings the commits of units from their child worktrees onto the ticket branch, in plan order. It stops at the first unit that fails a check or conflicts, and exits with 1. It then releases the Orca workers and removes the clean child worktrees. When a child worktree folder or a child branch is gone after the apply, it still finishes and records the unit as collected. Once every change of a child branch is on the ticket branch, it deletes that branch. It prints the old tip, so you can bring the branch back. A child worktree that holds only untracked files is kept. Untracked files are files that git does not track yet. The option `--discard-untracked` deletes those files and removes the worktree. It still keeps the worktree when an untracked file is a file of the unit, or a whole folder, because that is most likely work that was not committed. A worktree with a changed tracked file is always kept. Running it twice is safe.
- `cstack tracker read '<key>'`, `cstack tracker list --milestone <name>`, `cstack tracker move '<key>' --to "<state name>"` and `cstack tracker comment '<key>' --body-file <path>` read and write tickets through `gh` on GitHub and through `glab` on GitLab. On Jira and Linear, they go through Orca when Orca is connected to that tracker. `read` prints one ticket and `list` prints the tickets of a milestone or an epic, both as JSON. `cstack tracker list` with `--ready` keeps only the tickets that are open, not in progress, and whose blockers are all finished. The output keeps the same format. `--ready` leaves out a ticket when it cannot be sure that the ticket is ready. This happens when the state of the ticket is unknown, when its blockers are unknown, or when the state of a blocker is unknown. For each unknown thing, `--ready` prints one line on standard error that names the ticket. `--ready` does not check whether you already started a worktree for a ticket. To check that, run `orca reference find` yourself. `move` changes the state of a ticket, and `comment` adds the text of a file as a comment. A move needs only the label that it adds. When the label that it would remove does not exist, the move adds the new label and does not fail. Write a key in single quotes, such as `'#12'`, because the shell reads an unquoted `#` as the start of a comment and drops the rest of the line. On GitHub and GitLab, a key can also be a bare number, such as `12`, or the link of an issue of the origin project. A GitLab link may end in `/-/issues/12` or in `/-/work_items/12`. Put a link in single quotes too, because zsh stops on an unquoted `?`. A link to another project is refused. On Jira and Linear, a key looks like `'ABC-12'`. GitLab runs a quick action, such as `/close`, when it is found at the start of a line of a comment, so check the text before you post it. The comment file must be inside the repository or a temporary folder, must not be empty, and must hold at most 65,536 bytes.
- `cstack publish` publishes the branch of the plan with one push. It refuses to publish while the plan is not ready or a blocking question is open. It also refuses while a unit of the plan has no commit with its `Cstack-Unit` trailer and no `Blocked` line. It also refuses to push when a commit of the push, a commit message, or the pull request title or body holds the path of your home folder. It brings the branch up to date with its target branch and runs the tests. It pushes once. It opens the pull request or merge request with `gh` or `glab`. It then waits for the checks of the pushed commit.
- `cstack wave (--milestone <name> | --epic <key>)` lists the tickets of a wave, and starts a worktree for each ready ticket after you answer yes. It starts nothing when there is no terminal or when you answer anything else. Add `--tracker <name>` to choose the tracker, or `--from-file <path>` to read the tickets from a file.
  Add `--watch` to keep the command running in a terminal. It reads the wave again every `watchIntervalMinutes` minutes, which is five by default. It sends a macOS notification and asks you before it starts a ticket that became ready. Press Control-C to stop it. macOS shows the notification only when you allow notifications for Script Editor, in System Settings, then Notifications.

## A test report per case

By default, `cstack` knows only whether a test command passed or failed. A test report per case tells `cstack` the result of each test case. A test case is one test, such as one `it(...)` in vitest or one test function in pytest. The report uses the JUnit XML format, which both vitest and pytest can write.

You turn the option on in the `testCommands` of `.cstack/settings.json`. First, you write the placeholder `{report}` once in `testCommands.file`. Then you add the key `"report": "junit"`. The value `"junit"` is the only one that `cstack` accepts.

Here is an example for vitest. It keeps the usual console output and also writes the report.

```json
{
  "testCommands": {
    "file": "npx vitest run --reporter=default --reporter=junit --outputFile.junit={report} {file}",
    "report": "junit"
  }
}
```

Here is an example for pytest.

```json
{
  "testCommands": {
    "file": "pytest --junitxml={report} {file}",
    "report": "junit"
  }
}
```

For each run, `cstack` replaces `{report}` with a path in a temporary folder of that run. It deletes the folder when the run ends, so a report from an old run is never read as the current one. If the report is missing, or if it is not valid JUnit XML, the run still keeps its exit code and its output. The problem is reported next to them.

`cstack` refuses the settings file in these cases. The `report` value is not `"junit"`. The `report` key exists without `file`. The `report` key exists, but `file` has no `{report}`. The `file` command has `{report}`, but there is no `report` key. The `{report}` placeholder appears more than once in `file`. The placeholder appears in `all`.

A repository can use this option only after the release that ships it. An older `cstack` refuses the key `testCommands.report`, because it does not know that key.

## Measure a run

`cstack measure <plan file>` tells you how many tokens and how much time one run of the `resolve-issue` skill used. A token is the unit in which Claude counts the text it reads and writes. The command reads the session records that Claude Code keeps on your computer, and it prints numbers only.

You run it from the repository of the run, on the plan file that the run committed. Add `--home <folder>` if your session records are not under your home folder.

The command prints one line per number, in this order. It gives the number of main sessions and of helper transcripts. It gives the four kinds of tokens: input, cache creation input, cache read input and output. It repeats the four kinds for each Claude model. It gives the minutes from the approval of the plan to "ready for review". It ends with the number of skipped lines and of unreadable files.

The command finds the sessions in two steps. It takes the commit dates of the plan file from git as the start and the end of the run. Then it counts every session whose working folder is the repository, or a folder inside it, and that was active between those two dates. A session also counts when its working folder is a child worktree that a `- Worktree:` line of the plan names. The command reads a `~/` at the start of that line as the home folder of the account that runs it, never as the `--home` folder. A session in any other worktree of the repository never counts, even when that worktree is inside the repository folder. The command asks `git worktree list` for the worktrees, so it exits with 1 when git cannot list them. It also counts all the helpers of those sessions. It counts each answer of the model once.

Run the command before you remove the folder of the run, and before a squash merge, because both erase what the command reads. Run it after the session has ended, because anything said later in a session that counts adds to the totals.

Exit code 0 means every number is complete. Exit code 1 means the plan file could not be used, or the numbers may be incomplete. The reason is printed on standard error. Exit code 2 means the command line is wrong.

The command measures a plan file in one of two ways. A plan file with a `Format:` line comes from the newer skill. For that file, the command reads the approval time from the `Approved at` line and the ready time from the `Ready for review at` line. It does not read the git history. The command refuses the file when it cannot read it, when `Approved at` says `not yet`, or when the ready time is before the approval time.

A plan file without a `Format:` line keeps the method that the paragraphs above describe.

The two ways do not start at the same moment. The newer skill writes the approval time before the executor starts. The older method takes the first commit of the plan, which comes after the executor started. So a run of the newer skill is measured over a slightly longer window. Keep this in mind when you compare the two.

## How to update the copy of my configuration

Run the sync script from the repository folder:

```sh
./sync.sh            # copy the files and show what changed
./sync.sh --commit   # copy, then commit and push if anything changed
```

The script copies my personal configuration into `config/` and rebuilds `INVENTORY.md`. It never touches `cstack/` or `skills/`. A sync commit holds only `config/` and `INVENTORY.md`, even if you staged other files before.

Before it writes anything, the script replaces every name of the private list with its replacement. Then it searches the new files for anything that looks like a token or a private key. It also checks that no name of the private list is left. If one of these checks fails, it stops and leaves the working tree unchanged. If the private list is missing or empty, it stops at once.

Read the diff before you run `./sync.sh --commit`. The redaction only knows the names on the list.

## How to bring the prose skills onto another computer

The skills in the `skills` folder are frozen. They match the tag `prose-skills-final`, and I no longer improve them here. The `pull-skills.sh` script installs them into `~/.claude/skills`, for example on a computer that has older skills.

```sh
./pull-skills.sh           # show which skills would change, write nothing
./pull-skills.sh --apply   # replace those skills, after backing them up
```

The script reads the skills from the tag as it is on GitHub, whatever branch is checked out in this folder. The tag is created after the history rewrite, so the script stops with a message until then.

The script only replaces the skills that the tag holds. It moves the old version of each one into a dated folder under `~/.claude/skill-backups` first. This includes a `resolve-issue` skill that `cstack` installed: it is replaced too, after the backup. Skills installed by other tools, and local skills that the tag does not have, stay as they are. The script only handles skills. The settings and the other config files belong to one computer, so it does not copy them.

## What is in here

`INVENTORY.md` is the best place to start. It is a readable summary of every hook, plugin, MCP server and skill, and the sync script rebuilds it each time. (MCP, the Model Context Protocol, is how Claude Code connects to outside tools such as Linear or GitHub.)

The `config` folder holds the raw files:

- `CLAUDE.md` holds my global instructions, the ones Claude reads in every project.
- `settings.json` holds my settings. The hooks are defined inside this file, under the `hooks` key.
- `statusline-command.sh` draws the status line at the bottom of the terminal.
- `installed-plugins.json` records which plugins are installed and at which version.
- `mcp-servers.json` lists the MCP servers declared at user level, with every secret value replaced by `<redacted>`.

The `skills` folder holds the frozen prose skills I wrote, with their agent prompts and templates.

The `cstack` folder holds the code of the command-line tool and the skills that it ships.

The `docs` folder holds the project specifications in `docs/projects`, the plans in `docs/plans`, and the architecture decision records in `docs/decisions`. An architecture decision record is a short page that explains one technical choice and its reasons.

The `scripts` folder holds the helper scripts and their tests. They are plain bash scripts. Run them by hand for now, for example `scripts/test_sync.sh`.

## What is left out on purpose

Some things stay out of the repository because they are private, very large, or owned by another tool:

- Conversation history, session transcripts, file backups, caches and telemetry.
- The rest of `~/.claude.json`, because it holds login state and per-project data.
- Skills that other tools install and update themselves. These are the ones synced from claude.ai, the ones managed by the Superset app, and the ones installed by `cstack`. `INVENTORY.md` lists their names so I still know they are there.
- The skill-creator evaluation folders (the ones ending in `-workspace`), because they hold test runs and not skills.
- My memory files under `~/.claude/projects`, because they contain notes about work projects.

## This repository is public

This repository is public on purpose. Anyone can read it, so it must never hold work information.

The rule is simple. Never write the name of an employer or a client here, in a file or in an issue. Never quote a ticket key from work. Never give a count taken from work retrospectives.

To enforce this, I keep a private list of names outside the repository, at `~/.config/claude-code-stack/private-names.txt`. The file must have permission 600, and it is never committed. It has one entry per line. Blank lines and lines that start with `#` are ignored.

An entry is either `name` or `name==>replacement`. A line without `==>` uses `<private>` as the replacement. Matching ignores case. Entries apply from top to bottom, so a longer entry that contains a shorter one must come first.

Three scripts read this list. The `sync.sh` script replaces the names before it writes a file. The `scripts/rewrite_history.sh` script removes the names from the whole git history, and it saves a bundle of the old history in your home folder first. Without `--push`, it only shows what it would push. The `scripts/private_names.py` helper checks files for remaining names. No script prints a name from the list. They print the line number of the entry instead.
