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
- **Orca**: optional. Download it from https://github.com/stablyai/orca/releases. `cstack doctor` prints the minimum Orca version. It also says which Orca features work on your Mac, and why a feature does not.

## Install cstack

`cstack` is not on the npm registry. You install it from a release file on GitHub. Replace `<version>` with the version you want, for example the latest release:

```sh
npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/gambitl-cstack-<version>.tgz
cstack skills install
```

The first command installs the `cstack` command. The second command copies the skills that this version ships into `~/.claude/skills`. Run it without `sudo`, because the skills belong in your own home folder.

To update, run the same two commands with the link of the newer release. Do not use `npm update -g`. It cannot update `cstack`, and it stops with a 404 error.

To go back, install the previous release the same way. Then run `cstack skills install` again.

Each skill that `cstack` installs holds a file named `.cstack-managed`. This file tells `cstack` that it owns the folder. If a folder of the same name has no such file, `cstack` skips it and leaves it as it is. To let `cstack` take it over, run `cstack skills install --adopt <name>`.

Before `cstack` replaces, removes or adopts a folder, it saves the old folder in `~/.claude/skill-backups/<date-time>/<name>`. This place is outside the skills folder, so Claude Code does not load the backups.

## Commands

`cstack` has fourteen commands. Run `cstack` with no argument to see how to call each one.

- `cstack doctor` checks that your Mac has everything `cstack` needs. The "Requirements" section above lists these items.
- `cstack guide <phase>` prints the guide of one phase of a skill, at the version of `cstack` that you installed. The skill is `resolve-issue` unless you add `--skill <name>`.
- `cstack measure <plan file>` prints how many tokens and how much time one run of `resolve-issue` used. The "Measure a run" section below explains it.
- `cstack next` prints the guide of the next phase of your plan and records that this phase started. It keeps that record in the git folder of the repository, not in the plan file. Add `--done <phase>` to record that a phase is finished, or `--phase <phase>` to choose the phase yourself.
- `cstack skills install` copies the skills that this version of `cstack` ships into `~/.claude/skills`. The "Install cstack" section above explains what it does with a folder that it did not write.
- `cstack plan status` prints, for each unit of the plan, whether git has a commit for it. It exits with 1 when git and the plan disagree.
- `cstack plan section <name>` prints one section of the plan file and nothing else.
- `cstack report submit <kind>` reads the text of a helper's report on standard input. It saves the report only when the plan and git prove it.
- `cstack report check` prints the oldest accepted report that nobody has read yet.
- `cstack unit order [--json]` reads the plan file and tells you which units can run at the same time. A batch is a group of units that share no file and whose dependencies are done. The units of one batch can run together, and the next batch starts after it. Units that already have a commit, and units that are blocked, are listed apart.
- `cstack unit red <n>` runs the test command of unit `n` and saves the result, but only when the run fails. A failing run is a run where the test command exits with an error. It proves that the new test failed before the code existed. It does not prove that the test failed for the right reason, so you still need to read the saved output.
- `cstack unit green <n>` runs the same test command and saves the result, but only when the run passes. A passing run is a run where the test command exits without an error. When the test does not pass, it deletes any passing run that an earlier call saved. This also happens when the test runs past the timeout or its command cannot start. This way, `cstack unit commit` cannot accept code whose test fails now. It refuses to run when unit `n` has no saved failing run. It also refuses when the test command or the test file path changed since the failing run, because a changed command could hide a test that never failed.
- `cstack unit commit <n>` commits only the files that unit `n` lists in the plan, and it adds a `Cstack-Unit: <n>` line to the commit message. It never commits a file of another unit. It refuses to commit when a rule of the plan or the test runs says no, and it lists every refusal at once. Two unit commits in one worktree wait for each other, so they never mix their files.
- `cstack publish` publishes the branch of the plan with one push. It refuses to publish while the plan is not ready or a blocking question is open. It brings the branch up to date with its target branch and runs the tests. It pushes once. It opens the pull request or merge request with `gh` or `glab`. It then waits for the checks of the pushed commit.

## Measure a run

`cstack measure <plan file>` tells you how many tokens and how much time one run of the `resolve-issue` skill used. A token is the unit in which Claude counts the text it reads and writes. The command reads the session records that Claude Code keeps on your computer, and it prints numbers only.

You run it from the repository of the run, on the plan file that the run committed. Add `--home <folder>` if your session records are not under your home folder.

The command prints one line per number, in this order. It gives the number of main sessions and of helper transcripts. It gives the four kinds of tokens: input, cache creation input, cache read input and output. It repeats the four kinds for each Claude model. It gives the minutes from the approval of the plan to "ready for review". It ends with the number of skipped lines and of unreadable files.

The command finds the sessions in two steps. It takes the commit dates of the plan file from git as the start and the end of the run. Then it counts every session whose working folder is the repository, or a folder inside it, and that was active between those two dates. It also counts all the helpers of those sessions. It counts each answer of the model once.

Run the command before you remove the folder of the run, and before a squash merge, because both erase what the command reads. Run it after the session has ended, because anything said later in a session that counts adds to the totals.

Exit code 0 means every number is complete. Exit code 1 means the plan file could not be used, or the numbers may be incomplete. The reason is printed on standard error. Exit code 2 means the command line is wrong. A plan file made with the newer `Format:` line is refused, because this version reads only plan files made before `cstack`.

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
