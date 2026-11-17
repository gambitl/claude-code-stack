# cstack and my Claude Code setup

This repository is the source of `cstack`, a command-line tool for working with Claude Code. It also holds the skills that `cstack` ships, and the older prose skills that I froze. Finally, it keeps a copy of my personal Claude Code configuration in the `config` folder. The `sync.sh` script refreshes that copy.

The live setup stays in `~/.claude`. The `config` folder is only a copy. Editing a file there does not change how Claude Code behaves.

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

The install steps of `cstack` itself are documented separately, when that part of the tool ships.

## What is in here

`INVENTORY.md` is the best place to start. It is a readable summary of every hook, plugin, MCP server and skill, and the sync script rebuilds it each time. (MCP, the Model Context Protocol, is how Claude Code connects to outside tools such as Linear or GitHub.)

The `config` folder holds the raw files:

- `CLAUDE.md` holds my global instructions, the ones Claude reads in every project.
- `settings.json` holds my settings. The hooks are defined inside this file, under the `hooks` key.
- `statusline-command.sh` draws the status line at the bottom of the terminal.
- `installed-plugins.json` records which plugins are installed and at which version.
- `mcp-servers.json` lists the MCP servers declared at user level, with every secret value replaced by `<redacted>`.

The `skills` folder holds the frozen prose skills I wrote, with their agent prompts and templates.

The `cstack` folder holds the code of the command-line tool and the skills that it ships. It arrives with its own pull request.

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
