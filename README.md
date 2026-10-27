# My Claude Code setup

This repository keeps a history of how I have set up Claude Code: my global instructions, my settings and hooks, my status line, the plugins I use, and the skills I wrote myself. Each sync takes a fresh copy, so the git history shows how my setup changed over time.

The live setup stays in `~/.claude`. This repository is only a copy. Editing a file here does not change how Claude Code behaves.

## How to update it

Run the sync script from the repository folder:

```sh
./sync.sh            # copy the files and show what changed
./sync.sh --commit   # copy, then commit and push if anything changed
```

The script copies the files, rebuilds `INVENTORY.md`, and then searches the copy for anything that looks like a token or a private key. If it finds one, it stops before committing anything.

## How to bring the skills onto another computer

When I use several computers, one of them can have older skills than the ones on GitHub. The `pull-skills.sh` script does the reverse of the sync: it copies my skills from GitHub into `~/.claude/skills`.

```sh
./pull-skills.sh           # show which skills would change, write nothing
./pull-skills.sh --apply   # replace those skills, after backing them up
```

The script always reads the `main` branch as it is on GitHub, whatever branch is checked out in this folder. It only replaces the skills that the repository holds, and it moves the old version of each one into a dated folder under `~/.claude/skill-backups` first. Skills installed by other tools, and local skills that GitHub does not have yet, stay as they are. It only handles skills: the settings and the other config files hold paths and permissions that belong to one computer, so they are not copied back.

On a computer that is behind, run `pull-skills.sh --apply` before `sync.sh`. Otherwise the sync would copy the older skills into the repository and undo the newer ones on GitHub.

## What is in here

`INVENTORY.md` is the best place to start. It is a readable summary of every hook, plugin, MCP server and skill, and the sync script rebuilds it each time. (MCP, the Model Context Protocol, is how Claude Code connects to outside tools such as Linear or GitHub.)

The `config` folder holds the raw files:

- `CLAUDE.md` holds my global instructions, the ones Claude reads in every project.
- `settings.json` holds my settings. The hooks are defined inside this file, under the `hooks` key.
- `statusline-command.sh` draws the status line at the bottom of the terminal.
- `installed-plugins.json` records which plugins are installed and at which version.
- `mcp-servers.json` lists the MCP servers declared at user level, with every secret value replaced by `<redacted>`.

The `skills` folder holds the skills I wrote myself, with their agent prompts and templates.

## What is left out on purpose

Some things stay out of the repository because they are private, very large, or owned by another tool:

- Conversation history, session transcripts, file backups, caches and telemetry.
- The rest of `~/.claude.json`, because it holds login state and per-project data.
- Skills that other tools install and update themselves, namely the ones synced from claude.ai and the ones managed by the Superset app. `INVENTORY.md` lists their names so I still know they are there.
- The skill-creator evaluation folders (the ones ending in `-workspace`), because they hold test runs and not skills.
- My memory files under `~/.claude/projects`, because they contain notes about work projects.

## Why this repository is private

The settings name clients and internal tools from my work, and they contain paths from my laptop. None of this is a secret like a password, but it is not meant for the public either.
