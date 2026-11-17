# Plan: #8 — M1-2: Make the repository the source of the skills and of cstack

Date: 2026-11-17
Ticket: https://github.com/gambitl/claude-code-stack/issues/8
Tracker: GitHub
Documentation tool: docs/ folder (specification pages in docs/projects/), ADRs in docs/decisions/
Branch: gambitl/repo-source-history
Conversation language: French
Status: in progress (phase 6)

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

<!-- PRIVACY RULE FOR THIS FILE. This repository is public. No name of the maintainer's private list (employer, clients, work projects, work host names, work ticket prefixes, the work email address) may ever be written in this file, in a commit, in the pull request or in a ticket comment. Refer to such a name only as "a name of the private list" or by its place in a file. -->

## Ticket

## Why this matters (plain language)

**In plain terms:** Turn this repository from a backup copy of the maintainer's setup into the place where the skills and `cstack` are written, and freeze today's skills so that they stop changing.

- **What the title means**: A skill is a folder of written instructions that Claude loads when a task matches it. `cstack` is the command-line tool that this project builds, which is a program you run by typing its name in a terminal. "The source" means the original that people edit, as opposed to a copy. Today the repository is only a copy, because a script named `sync.sh` overwrites it with the files of the maintainer's computer.
- **Why we are doing it**: On every run, `sync.sh` deletes the `skills/` folder and copies it again from the computer. Once people write code and skills here, a sync could wipe out their work. The README also still says that the repository is private, but it is public. Some names from the maintainer's job are already in its files and in its git history, which is the list of every past version of every file. Anyone can read that history on GitHub.
- **For the user**: The maintainer can write `cstack` and its skills here safely. People who prefer today's skills, which are long prose instructions, can still install them. They get a fixed version that will not change under them.

**Goal.** This ticket gives the repository its new role for US-1. `sync.sh` stops touching the skills, the prose skills are frozen at a git tag (a fixed name on one commit), the README describes the new role, and a decision record explains why. The ticket also creates the maintainer's private list of names to hide, removes those names from the files and from the whole git history, and keeps the repository public.

## Where things are today (read first)

* **Sync script, skills part**: `sync.sh` (lines 43 to 56): Step 3 runs `rm -rf skills` at line 47, then copies every folder of `~/.claude/skills` into `skills/`. It skips the folder `synced`, folders that carry the marker file `.superset-managed`, and folders whose name ends in `-workspace`. This is the part to remove.
* **Sync script, secret check**: `sync.sh` (lines 61 to 67): The check searches `config`, `skills` and `INVENTORY.md` for strings that look like tokens or private keys (line 64). Once the script no longer writes `skills/`, the check only needs the paths that the script writes.
* **Sync script, commit**: `sync.sh` (line 69): The script stages every change of the repository with `git add -A`. With `--commit`, lines 77 to 80 then commit and push. Today that is harmless, because the script wrote every change itself. Once people write code here, a sync would sweep their unfinished work in `cstack/` or `skills/` into a sync commit.
* **Sync script, header**: `sync.sh` (lines 1 to 8): The comment says that the script copies the maintainer's whole Claude Code setup into the repository.
* **Pull script**: `pull-skills.sh` (lines 2 to 4): The comment calls it "the reverse of sync.sh". Line 22 sets the source to `origin/main`, and lines 30 to 33 read the `skills/` folder from there. Lines 64 to 73 reuse the filters of `sync.sh`, and their comment says so. Lines 85 to 94 move each replaced skill into a dated folder under `~/.claude/skill-backups` before they copy the new one.
* **README, role**: `README.md` (lines 1 to 5): The title and the opening say that the repository is only a copy of the maintainer's setup, and that editing it changes nothing.
* **README, skills**: `README.md` (lines 18 to 29): This section explains `pull-skills.sh`. Line 27 says that it always reads `main`. Line 29 tells people to run it before `sync.sh`, so that a sync does not undo newer skills. Line 43 says that `skills/` holds "the skills I wrote myself". Line 51 lists the skills that other tools install.
* **README, privacy**: `README.md` (lines 55 to 57): The section "Why this repository is private" says that the repository is private. GitHub shows it as public.
* **Inventory**: `scripts/build_inventory.py` (lines 123 to 145): It lists the skills found in `~/.claude/skills` under the heading "My own skills (copied into `skills/`)" at line 128. Lines 136 to 142 skip `synced`, list folders marked `.superset-managed` as installed by another tool, and skip `-workspace` folders. `INVENTORY.md` (lines 67 to 81) is its output, with the same heading at line 71. The file is generated, so you change the script and not the file.
* **Work references already public**: `config/settings.json` and `skills/linear-release-note/SKILL.md` hold names from the maintainer's job. `skills/resolve-issue/writing.md` (lines 27 and 41) and `skills/resolve-issue/SKILL.md` (line 211) hold ticket keys and a count from work. They have been public since the first commit, on 2026-10-05. This ticket never quotes them.
* **History on GitHub**: GitHub holds six branches besides `main`, and five closed pull requests, #1 to #5. Each closed pull request keeps a hidden reference to its old commits, and every commit holds a full copy of the files at that time. A force-push cannot change those hidden references, so only GitHub Support can remove them. Nobody has forked the repository.
* **History tool**: `git filter-repo` rewrites every commit of a repository, for example to replace a word everywhere. It is not installed on the maintainer's machine. Install it with `brew install git-filter-repo`.
* **Conventions file**: `CLAUDE.md` (line 9): Architecture decision records (ADRs) live in `docs/decisions/`. An ADR is a short page that explains one technical choice and its reasons. The folder does not exist yet, so this ticket creates it. Lines 14 to 16 hold the public text rule.
* **Specification**: `docs/projects/skills-into-cli.md` (lines 57 to 65): US-1 lists the acceptance criteria. This ticket carries AC2, AC3, AC4 and the negative criterion. #7 carries AC1. Line 273 describes what `sync.sh` does today. Line 322 describes ADR-SIC-E. Line 338 says that the repository stays public by choice.

## Scope

1. In `sync.sh`, remove step 3, the part that deletes and copies `skills/`. Keep steps 1 and 2, which copy the personal configuration from `~/.claude` into `config/`. Keep step 4, which rebuilds `INVENTORY.md`.
2. In the secret check of `sync.sh`, search only the paths that the script writes. These are `config` and `INVENTORY.md`.
3. Replace `git add -A` with a command that stages only `config` and `INVENTORY.md`. A sync then never commits or pushes a file of `cstack/` or `skills/`, even when someone has unfinished work there.
4. Update the header comment of `sync.sh`. It now says that the script copies the personal configuration only, and that it never touches `cstack/` or `skills/`.
5. Create the private list of names at `~/.config/claude-code-stack/private-names.txt`, on the maintainer's machine. The file lives outside the repository, and nobody ever commits it. Each line holds one name to hide. A line may add `==>` and a replacement, such as `ACME-==>PROJ-`. Without a replacement, the name becomes `<private>`. A line that starts with `#` is a comment. To fill the list, look for candidates in the current files, in every past commit with `git grep -i <word> $(git rev-list --all)`, and in `~/.claude/settings.json`. Candidates are the names of the employer, of clients and of work projects, the host names of work tools, and the prefixes of work ticket keys. Show the candidates to the maintainer in the conversation only, and write the names that the maintainer confirms. Give the file the permission `600`, so that only the maintainer can read it.
6. Before the merge, remove every work reference from `skills/` and `config/`, as the public text rule of `CLAUDE.md` says. A work reference is the name of an employer, a client or a work project, a ticket key from a work tracker, or a figure taken from work. Some are there today, in the prose skills and in the copied settings. Replace each one with a neutral example, such as `PROJ-12`. Use the private list of the step before. The maintainer reads the diff before the merge.
7. Make `sync.sh` protect the public text rule on every sync. It reads a private list of names from `~/.config/claude-code-stack/private-names.txt`, which is outside the repository. In each file it writes, it replaces each name of the list with the placeholder `<private>`. Then it stops, like the secret check, if a name of the list is still there. When the list file does not exist, it stops, writes nothing, and says how to create the file.
8. Write `scripts/rewrite_history.sh`. It removes the names of the private list from every commit, branch and tag, and it keeps the repository public. It takes the source repository and the list as inputs, with `--source <url>` and `--list <path>`. By default, they are the `origin` of the working copy and the private list. It refuses to run when the list is missing or empty, or when `git filter-repo` is not installed. It makes a fresh mirror clone of the source in a temporary folder, outside the working copy, and never touches the working copy. It saves a git bundle of the old history in the maintainer's home folder, outside any repository, so that a failed push can be undone. It turns the list into the replacement file of `git filter-repo --replace-text`, in the same temporary folder, and runs it on every branch and tag. Then it searches every commit of the rewritten clone for each name of the list, and it stops if one is still there. Without `--push`, it stops at this point and prints what it would push. With `--push`, it force-pushes every branch and tag of the rewritten clone to the source. At the end, it deletes the temporary folder. It never prints a name of the list.
9. Make `pull-skills.sh` read the skills at the tag `prose-skills-final` instead of `origin/main`, and make it fetch the tags first. Everything else stays the same. It still writes nothing without `--apply`, and it still backs up each skill before it replaces it. Rewrite its comments at lines 2 to 13 and at lines 64 to 65, which describe it as the reverse of `sync.sh`.
10. Rewrite the opening of the README for the new role. Say that the repository is the source of `cstack`, of the skills that `cstack` ships, and of the frozen prose skills. Say that it still keeps a copy of the maintainer's personal configuration in `config/`, which `sync.sh` refreshes.
11. Replace the section "Why this repository is private" with a section that says the repository is public. State the public text rule of `CLAUDE.md` in plain words. Add that `sync.sh` copies the personal configuration into this public place, so you read the diff before you run `./sync.sh --commit`.
12. Rewrite the README sections about skills. Say that the prose skills in `skills/` are frozen at the tag `prose-skills-final` and are no longer improved. Say that `pull-skills.sh` installs them for people who want them. Warn that it also replaces a `resolve-issue` skill that `cstack` installed, after a backup. Remove the advice of line 29, because `sync.sh` no longer copies skills. Add the `cstack/` and `docs/` folders to "What is in here". #9 adds the install steps of `cstack` itself.
13. In `scripts/build_inventory.py`, rename the heading of line 128 to "My own skills", because nothing is copied into `skills/` any more. List a folder that carries the marker file `.cstack-managed` under "Skills installed by other tools", as installed and updated by `cstack`. Treat it the way lines 138 to 139 treat `.superset-managed`. `INVENTORY.md` changes at the next sync, so do not edit it by hand.
14. Write ADR-SIC-E in `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. It says that the repository becomes the source of the skills and of `cstack`, and that the personal configuration is still copied from `~/.claude`. It names the options considered, at least a separate repository for `cstack` and this repository as the source, with the reasons for the choice. It records that the repository stays public by choice, and that the public text rule protects work information. Link it from the ADR-SIC-E line of section 9 of the specification.
15. After the merge, the maintainer runs these steps in this order, because each one changes what the next one sees.
   - Delete the six old branches on GitHub whose pull requests are closed, after checking that nothing on them is missing from `main`.
   - Check that no other branch of this repository is in progress. A branch that started before the rewrite must not be pushed as it is. Rebase it onto the new `main` with `git rebase --onto`.
   - Run `scripts/rewrite_history.sh` and read its summary. Then run it again with `--push`.
   - Create the annotated git tag `prose-skills-final` on the rewritten `main`, on the last commit that changed `skills/`. You find that commit with `git log -1 --format=%H origin/main -- skills`. Push the tag.
   - Ask GitHub Support to remove the cached views and the hidden pull request references that still hold the old commits. Follow GitHub's guide "Removing sensitive data from a repository". Give commit hashes and pull request numbers in the request, never a name.
   - In every local copy of the repository, including the one where `sync.sh` runs and every Orca worktree, run `git fetch`, then `git reset --hard origin/main`, or clone the repository again. An old copy would push the old history back.
   - Once a fresh clone shows no name of the list in any commit, delete the git bundle of the old history.

## Acceptance (TDD)

* `scripts/test_sync.sh` (new): Write it first and watch it fail on today's `sync.sh`. It clones the repository into a temporary folder and adds a sentinel file in `skills/` and in `cstack/` of that clone. It runs `sync.sh` there with `HOME` set to a temporary fake home. The fake home holds the files that `sync.sh` reads, and a `skills/` folder whose content differs from the repository. Today the run deletes the sentinel in `skills/`, so the test fails. After the change, both sentinels are still there, and `skills/` matches the repository byte for byte.
* `scripts/test_sync.sh`: In the same run, `config/` holds the fake home's `CLAUDE.md` and `settings.json`, so the personal configuration is still copied. `git diff --cached --name-only` lists only paths under `config/` and `INVENTORY.md`.
* `scripts/test_sync.sh`: A fake token planted in the fake home's `settings.json` still stops the script with a non-zero exit code, so the secret check keeps working.
* `scripts/test_sync.sh`: A fake private list names `Acme`, and the fake home's `settings.json` holds `Acme`. Write this case first and watch it fail. After the change, `config/settings.json` holds `<private>` and no `Acme`. Without the list file, the script stops with a non-zero exit code and writes nothing to `config/`.
* `scripts/test_rewrite_history.sh` (new): Write it first and watch it fail, because the rewrite script does not exist yet. It builds a throwaway repository in a temporary folder, with three commits, a second branch and a tag. A fake name `Acme` appears in a file of the first commit and in the message of the second commit. It runs the rewrite script with `--source` set to that repository and `--list` set to a fake list that names `Acme`. Without `--push`, the throwaway repository is unchanged. With `--push`, no commit, message, branch or tag holds `Acme`, the files hold `<private>` instead, and the number of commits is the same.
* `scripts/test_rewrite_history.sh`: A missing or empty list stops the script with a non-zero exit code before any change. The output of every run never shows `Acme`.
* After the rewrite and the push, a fresh clone from GitHub shows no name of the private list in any commit, branch or tag.
* After the merge, a search of `skills/` and `config/` for every name of the maintainer's private list finds nothing, at the tag `prose-skills-final` too.
* The test never touches the real `~/.claude`, the real working copy or GitHub, and it never passes `--commit`.
* If `.github/workflows/ci.yml` from #7 exists on `main` when you start, add a step that runs `scripts/test_sync.sh`. If it does not exist yet, say in the pull request that the script runs by hand for now.
* After the merge, `git diff prose-skills-final origin/main -- skills` prints nothing. `./pull-skills.sh` without `--apply` reads the tag and writes nothing.
* The README says that the repository is public and that the prose skills are frozen. It no longer holds the section that calls the repository private.
* Negative: a run of `sync.sh` never overwrites, deletes, stages or commits a file in `cstack/` or in `skills/`.
* Negative: no new text names an employer, a client or a work project, as the public text rule of `CLAUDE.md` says.
* Negative: no name of the private list appears in a file of the repository, in the plan file, in the retrospective, in a commit message, in the pull request or in a ticket comment. The private list itself is never committed.
* Negative: the repository stays public. Nobody changes its visibility.

**Size: L** · Blocked by: none · Feeds: #12

---

## CTO review — The history is rewritten once, after the merge, and the repository stays public (2026-11-17)

1. Rewriting the history of a public repository cannot be fully undone for people who already copied it. So the rewrite runs once, after the merge, from a mirror clone, and it pushes only with `--push`. The git bundle of the old history is the only way back if the push fails. Delete it once a fresh clone is clean, because it still holds the names.
2. The repository stays public. A force-push does not reach the hidden references of the closed pull requests #1 to #5, nor GitHub's cached views. Until GitHub Support removes them, old commits stay readable by their hash.
3. Every branch and every local copy made before the rewrite holds the old history. Pushing one of them would bring the names back. Tickets that run at the same time as this one, such as #7, rebase onto the new `main` before they push.


### Decisions already taken upstream

From the epic "Skills into CLI" (#6), block "Open questions and decisions", copied verbatim:

> **Decisions taken during the design.** An architecture decision record (ADR) explains one technical choice and its reasons. These ADRs are still to create, in `docs/decisions/`. Each one is written by the ticket named on its line.
>
> - ADR-SIC-A, how the helpers run, is to create. The design chose Orca workers when Orca is available and Claude Code sub-agents otherwise. Ticket #27 writes it.
> - ADR-SIC-B, where the run state lives and how its format is versioned, is to create. This choice is still open. Ticket #13 writes it.
> - ADR-SIC-C, how `cstack` ships its skills, is to create. The design chose skills that `cstack` ships and serves at its own version. Ticket #9 writes it.
> - ADR-SIC-D, the settings file and the models of the agents, is to create. The settings file can change the review agent and its model, which reopens a settled decision of `resolve-issue`. Ticket #14 writes it.
> - ADR-SIC-E, the new role of the repository, is to create. The repository becomes the source of the skills and of `cstack`. Ticket #8 writes it.
> - ADR-SIC-F, how `cstack` reaches trackers and forges, is to create. `cstack` never holds credentials. Ticket #24 writes it.
> - ADR-SIC-G, continue or stop, is to create in milestone 4. Ticket #33 writes it.
>
> **Rules for every ticket of this epic.** Every feature that uses Orca also works without Orca. `cstack` never stores a credential. No ticket assumes a specific tracker or forge. The tracker, which holds the tickets, can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code, can be GitLab or GitHub. Claude is the only default agent. This repository is public, so no text names an employer or a client, quotes a ticket key from work, or gives a count from work retrospectives. The token and time results of the comparison are the only figures from work that are published.

The epic's open questions 1 to 8 concern later milestones and do not touch this ticket.

Epic comment, change from the specification that concerns this ticket: "Ticket #8 also removes the work references that are already in `skills/` and `config/` before it freezes the prose skills. It makes `sync.sh` replace them on every sync. After its merge, it removes them from the whole git history too, and the repository stays public."

No ADR exists yet in `docs/decisions/`. The specification is `docs/projects/skills-into-cli.md`: US-1 at lines 57 to 65, ADR-SIC-E at line 322, and "A private repository" under section 10, "Challenged choices", which says the repository stays public by choice.

## Dependencies

Dependencies: clear. The ticket's footer says "Blocked by: none" and GitHub lists no blocking relation (checked 2026-11-17). Ticket #7 runs at the same time in another worktree. It creates `cstack/` and `.github/workflows/ci.yml`, and this ticket must not edit them.

## Code mapping

Graphify is not installed on this machine, so the code was mapped with search and file reads. The repository is small: three shell scripts, two Python helpers, prose skills and copied configuration.

**`sync.sh`** (83 lines, verified against the ticket's line numbers). It needs Python, found as `python3` or `python` (lines 17 to 27). Steps 1 and 2 (lines 31 to 41) copy `$HOME/.claude/CLAUDE.md`, `settings.json`, `statusline-command.sh` and `plugins/installed_plugins.json` into `config/`, and run `scripts/export_mcp_servers.py "$HOME/.claude.json"` into `config/mcp-servers.json`. Step 3 (lines 43 to 56) deletes and recopies `skills/`. Step 4 (line 59) runs `scripts/build_inventory.py "$HOME/.claude"`, which also reads `$HOME/.claude/skills` and `$HOME/.claude/plugins`. The secret check (lines 61 to 67) greps `config skills INVENTORY.md` and prints the matching lines. Line 69 runs `git add -A`, and lines 77 to 80 commit and push with `--commit`. So a fake home for a test needs `.claude/CLAUDE.md`, `.claude/settings.json`, `.claude/statusline-command.sh`, `.claude/plugins/installed_plugins.json`, `.claude/skills/` and `.claude.json`.

**`pull-skills.sh`** (98 lines). Line 22 sets `BRANCH="origin/main"`. Line 30 runs `git fetch -q origin`, which does not fetch a tag that points outside the fetched branches, so the tag needs `--tags`. Line 33 runs `git archive "$BRANCH" skills`. The comments at lines 2 to 13 and 64 to 65 describe it as the reverse of `sync.sh`. It writes only with `--apply` (line 80) and backs up each replaced skill (lines 85 to 94).

**`README.md`** (57 lines): the role at lines 1 to 5, the sync at lines 7 to 16, the skills section at lines 18 to 29, "What is in here" at lines 31 to 43, what is left out at lines 45 to 53, and "Why this repository is private" at lines 55 to 57.

**`scripts/build_inventory.py`**: the heading "My own skills (copied into `skills/`)" at line 128, the filters at lines 136 to 142 (`synced` skipped, `.superset-managed` listed as installed by the Superset app at lines 138 to 140, `-workspace` skipped), and the heading "Skills installed by other tools (listed, not copied)" at line 158.

**Tests and CI.** The repository has no test and no CI on `main` today (`git ls-tree origin/main` shows no `.github/` and no `cstack/`, checked 2026-11-17). Ticket #7 adds them in parallel.

**Git history.** `main` has 13 commits. GitHub holds six branches besides `main`, each with a merged pull request (#1 to #5), and the hidden references `refs/pull/1/head` to `refs/pull/5/head`. No tag exists. Seven commits carry the maintainer's work email address as author and as committer, and the domain of that address is a name of the private list. This working copy's `git config user.email` is the same work address, so every new commit would carry it too.

**Work references found today** (places only, never the names). `config/settings.json` holds names in its permission rules and in `autoMode.environment`. `skills/linear-release-note/SKILL.md` holds names and a work ticket prefix on about fifteen lines. `skills/resolve-issue/writing.md` holds work ticket keys at lines 27 and 41, and its example at lines 52 to 70 comes from a real work plan, with a work ticket key and counts. `skills/resolve-issue/SKILL.md` holds a count from work runs at line 206, and a work ticket key with a count at line 211. `INVENTORY.md` line 76 holds a work ticket prefix, generated from the description of the live `linear-release-note` skill. The messages of commits `c758a65` and `92e9816` hold names. The bodies of pull requests #1, #3 and #4 on GitHub hold names, and a git history rewrite cannot reach them. Issues #6 to #33 and their comments hold none (checked 2026-11-17). The live `~/.claude/settings.json` holds more names than the repository copy, such as client names in permission rules, and the next sync would copy them. The skills in `skills/` are identical to `~/.claude/skills` today (`diff -rq` is empty), so the frozen prose skills are the ones the baseline runs of #12 use.

**`git filter-repo`**, from its documentation, to verify once it is installed. `--replace-text <file>` rewrites file contents only. Each line is `literal`, `literal==>replacement`, `regex:<pattern>==>replacement` or `glob:<pattern>==>replacement`, and the default replacement is `***REMOVED***`. Literal matches are case-sensitive, and `regex:(?i)...` makes one case-insensitive. Lines apply in the order of the file. Commit and tag messages need `--replace-message <file>`, with the same format. Author and committer names and emails need `--name-callback` and `--email-callback`, or `--mailmap`. After a rewrite, it removes the `origin` remote, so the push must name the source explicitly. GitHub refuses pushes to `refs/pull/*`, so the push names `refs/heads/*` and `refs/tags/*` only.

**Governing decisions.** The public text rule of `CLAUDE.md` (lines 14 to 16). ADR-SIC-E in section 9 of the specification (line 322). Section 10 of the specification: the repository stays public by choice. The ticket's CTO review block: the rewrite runs once, after the merge, from a mirror clone, and pushes only with `--push`; the git bundle is the only way back.

**Risks.** A history rewrite of a public repository cannot be undone for people who already copied it. A redaction based on a list hides only the names on the list, so a new name in the live configuration leaks unless the maintainer adds it or reads the diff. The after-merge sequence must run in order, and every copy made before the rewrite must be reset.

## Decisions

**Privacy**

- Never write a name of the private list anywhere: not in a file of the repository, not in this plan file (review log, executor notes and hand-off log included), not in a commit message, a code comment, a test, the pull request, a ticket comment or the retrospective. Refer to one as "a name of the private list" or by its line number in the list. Tests use the fake name `Acme` only. (2026-11-17, ticket and user's answer)
- The maintainer's private list already exists at `~/.config/claude-code-stack/private-names.txt`, with permission 600, outside the repository. Read it when you need the names, never print it, never copy it into the repository, and never commit it. (2026-11-17, user's answer)
- Every commit uses the no-reply address that the repository's git config now holds as `user.email`. Never change git config and never pass `--author`. Before the push, check that every commit of `origin/main..HEAD` has the no-reply address as author and as committer. (2026-11-17, user's answer)
- Before the push, and before any text is posted to GitHub, run the helper's check on every file of the branch, on the messages and authorship of `origin/main..HEAD`, and on the drafted pull request body and ticket comments. It must find nothing. (2026-11-17, assumption not asked)

**The private list and its helper**

- The list format is one entry per line. Blank lines and lines that start with `#` are ignored. `name==>replacement` sets the replacement, and a line without `==>` uses `<private>`. Spaces around the name and the replacement are trimmed. (2026-11-17, ticket)
- Entries apply from top to bottom, like `git filter-repo` does, so a longer entry that contains a shorter one must come first. The README says so. (2026-11-17, assumption not asked)
- Matching ignores case everywhere: in the sync redaction, in the rewrite, and in every check. (2026-11-17, user's answer)
- No script ever prints a name or the text it matched. A check that finds a remaining name prints the line number of the list entry and where it was found, such as a file path or "commit message". (2026-11-17, ticket and assumption not asked)
- One Python helper, `scripts/private_names.py`, standard library only, holds the list parsing, the redaction of files, the check of files, the generation of the `git filter-repo` expressions file and mailmap, and the scan of a repository. `sync.sh` and `scripts/rewrite_history.sh` both call it with the same Python detection as `sync.sh` today. (2026-11-17, assumption not asked)
- A missing list, or a list without any entry, makes the helper exit with a non-zero code and a message that gives the path, the format and the `chmod 600` command. (2026-11-17, ticket and assumption not asked)

**`sync.sh`**

- `sync.sh` keeps steps 1, 2 and 4, which copy the personal configuration into `config/` and rebuild `INVENTORY.md`. It no longer deletes, copies or writes anything in `skills/`. (2026-11-17, ticket)
- `sync.sh` checks the list before it writes anything. When the list is missing or empty, it stops with a non-zero exit code and `config/` and `INVENTORY.md` stay unchanged. (2026-11-17, ticket)
- `sync.sh` builds the config files and the inventory in a temporary folder, redacts them with the list, then runs the secret check and the name check on that folder. It copies the files into `config/` and `INVENTORY.md` only when both checks pass. On any stop, the working tree stays unchanged. (2026-11-17, user's answer)
- The secret check keeps its pattern and searches only the files the script writes. (2026-11-17, ticket)
- `sync.sh` stages with `git add -A -- config INVENTORY.md`, tests for changes with `git diff --cached --quiet -- config INVENTORY.md`, shows the stat for those paths only, and commits with `git commit -m ... -- config INVENTORY.md`. So a file staged earlier in `cstack/` or `skills/` never enters a sync commit. (2026-11-17, user's answer)
- The header comment of `sync.sh` says that it copies the personal configuration only, replaces the names of the private list, and never touches `cstack/` or `skills/`. (2026-11-17, ticket)

**`scripts/rewrite_history.sh`**

- It takes `--source <url>`, `--list <path>` and `--push`. By default, the source is `git remote get-url origin` of the working copy and the list is the private list. (2026-11-17, ticket)
- It refuses to run, with a non-zero exit code and before any change, when the list is missing or empty, or when `git filter-repo` is not installed. (2026-11-17, ticket)
- It clones the source with `git clone --mirror --no-local` into a new temporary folder outside the working copy, never touches the working copy, and deletes the temporary folder when it ends, also on failure. (2026-11-17, ticket and user's answer)
- Before the rewrite, it saves `git bundle create "$HOME/claude-code-stack-old-history-<YYYYmmdd-HHMMSS>.bundle" --all` from the clone and prints the bundle path. (2026-11-17, ticket and assumption not asked)
- Before the rewrite, it prints for each line of the list how many matches the clone holds, by line number only, so that the maintainer spots a short entry that hits ordinary words. (2026-11-17, user's answer)
- It writes, in the temporary folder, one expressions file with one line `regex:(?i)<the name, escaped>==><replacement>` per entry, in list order, and passes it to both `--replace-text` and `--replace-message`. (2026-11-17, user's answer, options checked in `git filter-repo` 2.47.0)
- It writes, in the temporary folder, a mailmap with one line `<replacement> <name>` for each entry whose name and replacement are both email addresses, and passes it to `--mailmap`, which rewrites author, committer and tagger emails. (2026-11-17, user's answer, option checked in `git filter-repo` 2.47.0)
- After the rewrite, it scans every reachable object of the clone (file contents, file paths, commit and tag messages, author, committer and tagger lines) and every ref name. It stops with a non-zero exit code if any entry still matches, or if the number of commits changed. (2026-11-17, ticket)
- Without `--push`, it prints the branches and tags it would push and changes nothing in the source. With `--push`, it runs `git push --force <source> 'refs/heads/*:refs/heads/*' 'refs/tags/*:refs/tags/*'`. It never pushes `refs/pull/*` and never uses `--mirror` for the push. (2026-11-17, ticket and assumption not asked)

**Other scripts**

- `pull-skills.sh` runs `git fetch -q --tags origin` and reads the skills at the tag `prose-skills-final`. When the tag does not exist yet, it stops with a non-zero exit code and a message that says the tag is created after the history rewrite. Everything else stays as it is. Its comments at lines 2 to 13 and 64 to 65 no longer call it the reverse of `sync.sh`. (2026-11-17, ticket and assumption not asked)
- `scripts/build_inventory.py` names the heading "My own skills". It lists a folder that holds the marker file `.cstack-managed` under "Skills installed by other tools", as installed and updated by `cstack`, the same way it treats `.superset-managed`. Do not edit `INVENTORY.md` for this; the next sync rebuilds it. (2026-11-17, ticket)
- The marker file of skills that `cstack` installs is named `.cstack-managed`. ADR-SIC-E records the name, and a comment on the ticket that ships the skills (#9) asks it to use the same name. (2026-11-17, user's answer)

**Tests**

- The test scripts are plain bash, in `scripts/`, with no test framework. They print one line per case and exit with a non-zero code when a case fails. (2026-11-17, assumption not asked)
- Every test works only in temporary folders and sets `HOME` to a fake home. It never touches the real `~/.claude`, the real working copy, the real private list or GitHub, and it never passes `--commit` or `--apply`. (2026-11-17, ticket)
- `.github/workflows/ci.yml` does not exist on `main` at the start (checked 2026-11-17), so do not add a CI step. The pull request says that the test scripts run by hand for now. Never edit `cstack/` or `.github/workflows/ci.yml`, which ticket #7 creates. (2026-11-17, ticket)

**Cleanup of the work references**

- Run the helper's redaction on every file of `config/` and on `INVENTORY.md`, without running the real `sync.sh`. (2026-11-17, user's answer)
- In `skills/`, replace each name of the list and each work ticket key by hand with a neutral example that reads naturally, such as `PROJ-12`, "the project" or "a work repository". Use `<private>` only where nothing reads better. Change nothing else in the prose skills. (2026-11-17, ticket and user's answer)
- In `skills/resolve-issue/SKILL.md`, replace the count of plan sizes at line 206 and the count of questions at line 211 with neutral words. In `skills/resolve-issue/writing.md`, replace the work ticket keys at lines 27 and 41 and the ticket key of the example, and keep the other numbers of the example. Old commits keep their counts. (2026-11-17, user's answer)
- After the cleanup, the helper's check on `skills`, `config` and `INVENTORY.md` with the real list finds nothing. (2026-11-17, ticket)
- Never change anything under `~/.claude/skills/`, never run `cstack skills install`, and never run `pull-skills.sh --apply`. The baseline runs of ticket #12 need today's prose skills unchanged. (2026-11-17, coordinator's brief)

**README and decision record**

- The README opening says that the repository is the source of `cstack`, of the skills that `cstack` ships, and of the frozen prose skills, and that it still keeps a copy of the maintainer's personal configuration in `config/`, refreshed by `sync.sh`. (2026-11-17, ticket)
- The section "Why this repository is private" is replaced by a section that says the repository is public, states the public text rule in plain words, explains the private list (where it lives, its format, the order of entries, permission 600, never committed), and tells the reader to read the diff before `./sync.sh --commit`. (2026-11-17, ticket)
- The README says that the prose skills in `skills/` are frozen at the tag `prose-skills-final` and no longer improved, that `pull-skills.sh` installs them, and that it also replaces a `resolve-issue` skill that `cstack` installed, after a backup. It removes the advice of line 29 and adds `cstack/` and `docs/` to "What is in here". The install steps of `cstack` belong to ticket #9. (2026-11-17, ticket)
- ADR-SIC-E lives at `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`. It gives the options (a separate repository for `cstack`, this repository as the source, a private repository) with the reasons for the choice, records that the repository stays public by choice and that the public text rule and the private list protect work information, describes the history rewrite after the merge, names the marker `.cstack-managed`, and links ticket #8. The ADR-SIC-E line of section 9 of the specification links to it. (2026-11-17, ticket)

**After the merge (written in the pull request, never run in this ticket)**

- This ticket never deletes a branch, never runs the rewrite with `--push`, never creates or pushes a tag, never contacts GitHub Support, never force-pushes, never changes the repository's visibility, and never merges the pull request. (2026-11-17, coordinator's brief)
- The pull request body lists the after-merge steps of the ticket's scope item 15 in their order, with three additions. First, edit the descriptions of pull requests #1, #3 and #4, then delete their old revisions from the edit history. Second, put the number of this pull request in the request to GitHub Support, with the request text drafted under "Questions you may not be asking" in History. Third, if GitHub Support refuses, recreate the repository under the same name, still public, after moving the issues with `gh issue transfer`; milestones and possibly sub-issue links then need rebuilding, and deleting the old repository cannot be undone. (2026-11-17, user's answer)
- The pull request body reminds the maintainer to reset the local `main` first, because Orca starts new worktrees from it, and that the merge commits lose their "Verified" badge after the rewrite. (2026-11-17, user's answer)

## Architecture

The approach is locked by the ticket and the answers above, and the change is small. One Python helper, `scripts/private_names.py`, holds everything about the private list, so that the sync, the rewrite and the checks read the list the same way. The shell scripts stay thin and call it.

## Implementation units

### Unit 1: The private list helper — status: done (35708ac)
- Failing test: `scripts/test_private_names.sh` (new). With a fake list in a temporary folder, it checks that comments and blank lines are ignored, that a line without `==>` becomes `<private>`, that `name==>replacement` is honoured, that entries apply top to bottom, that redaction ignores case (`Acme`, `acme`, `ACME`), that the check exits non-zero on a remaining name and prints the list line number but never `Acme`, that a missing or empty list exits non-zero with the path in the message, that the expressions file holds `regex:(?i)` lines in list order, and that the mailmap holds a line only for an email-to-email entry.
- Minimum code: `scripts/private_names.py` with subcommands for redaction of files, check of paths, writing the expressions file, writing the mailmap, and scanning a git repository (reachable objects and ref names) with counts per list line.
- Refactor: none expected.
- Commit message: `feat: add a helper that reads the private list of names to hide`
- Depends on: none

### Unit 2: `sync.sh` copies the personal configuration only — status: done (07eeb4e)
- Failing test: `scripts/test_sync.sh` (new), with every case of the ticket's acceptance for `sync.sh`. It clones the repository into a temporary folder, adds a sentinel file in `skills/` and in `cstack/`, stages one more sentinel in `cstack/`, and runs `sync.sh` with `HOME` set to a fake home that holds `.claude/CLAUDE.md`, `.claude/settings.json`, `.claude/statusline-command.sh`, `.claude/plugins/installed_plugins.json`, `.claude/skills/` with content that differs from the clone, `.claude.json`, and `.config/claude-code-stack/private-names.txt` naming `Acme`. It checks that both sentinels survive, that `skills/` matches the clone byte for byte, that `config/` holds the fake `CLAUDE.md` and `settings.json`, that the files staged by the sync are only under `config/` and `INVENTORY.md`, that the staged `cstack/` sentinel is still staged and untouched, that `config/settings.json` holds `<private>` and no `Acme` in any case, that a fake token stops the script with a non-zero exit code and leaves `config/` unchanged, and that a missing list, then an empty list, stop the script and leave `config/` unchanged. Watch it fail on today's `sync.sh`.
- Minimum code: change `sync.sh` as "Decisions" says: list check first, temporary folder, redaction, both checks, copy into place, staging and commit limited to `config` and `INVENTORY.md`, new header comment, step 3 removed.
- Refactor: none expected.
- Commit message: `feat: make sync.sh copy the personal configuration only and hide private names`
- Depends on: 1

### Unit 3: The history rewrite script — status: done (e08a7d4)
- Failing test: `scripts/test_rewrite_history.sh` (new). It builds a throwaway repository in a temporary folder with three commits, a second branch and an annotated tag. `Acme` appears in a file of the first commit, in the message of the second commit, and in the author email of one commit (such as `dev@acme.example`). The fake list maps that full email to `dev@users.noreply.example` on its first line and names `Acme` on its second line. `HOME` points to a temporary folder. Without `--push`, the throwaway repository is unchanged (same refs and hashes), a bundle exists in the fake home, and the output shows a count per list line. With `--push`, no commit content, message, author, committer, branch name or tag holds `Acme` in any case, the files hold `<private>`, the author email is the no-reply one, and the number of commits is the same. A missing list, then an empty list, stop the script with a non-zero exit code before any change. No output of any run shows `Acme` in any case. Watch it fail, because the script does not exist yet.
- Minimum code: `scripts/rewrite_history.sh` as "Decisions" says.
- Refactor: none expected.
- Commit message: `feat: add a script that removes the private names from the whole git history`
- Depends on: 1

### Unit 4: `pull-skills.sh` reads the frozen tag — status: done (2e24972)
- Failing test: `scripts/test_pull_skills.sh` (new). It builds a throwaway origin with a `skills/` folder, a tag `prose-skills-final`, and a later commit on `main` that changes a skill. It clones it, copies `pull-skills.sh` into the clone, and runs it without `--apply`, with `HOME` set to a fake home. It checks that the output compares against the tagged skills and not `main`, that nothing is written in the fake home, and that a run against an origin without the tag stops with a non-zero exit code and a clear message.
- Minimum code: fetch tags, read `prose-skills-final`, stop clearly when the tag is missing, rewrite the comments at lines 2 to 13 and 64 to 65.
- Refactor: none expected.
- Commit message: `feat: make pull-skills.sh install the prose skills frozen at prose-skills-final`
- Depends on: none

### Unit 5: The inventory knows `cstack` skills — status: done (f3fa430)
- Failing test: a new case in `scripts/test_sync.sh`. The fake home holds a skill folder with `.cstack-managed`. After the sync, `INVENTORY.md` has the heading "My own skills", does not list that folder there, and lists it under "Skills installed by other tools" as installed and updated by `cstack`.
- Minimum code: change the heading at line 128 of `scripts/build_inventory.py` and treat `.cstack-managed` like `.superset-managed`.
- Refactor: none expected.
- Commit message: `feat: list the skills that cstack installs as installed by another tool`
- Depends on: 2

### Unit 6: Remove the work references from `skills/`, `config/` and `INVENTORY.md` — status: done (35cbed6)
- Failing test: no test file, because this unit changes content only. The check is the helper run with the real private list on `skills`, `config` and `INVENTORY.md`: it must report matches before the change and nothing after.
- Minimum code: as "Decisions" says under "Cleanup of the work references".
- Refactor: none.
- Commit message: `docs: replace the work references in the prose skills and the copied configuration`
- Depends on: 1

### Unit 7: The README describes the new role — status: done (e7c5f59)
- Failing test: no test, documentation only.
- Minimum code: as "Decisions" says under "README and decision record".
- Refactor: none.
- Commit message: `docs: describe the repository as the public source of cstack and the frozen prose skills`
- Depends on: 2, 3, 4, 5

### Unit 8: ADR-SIC-E and the link from the specification — status: done (5aafa08)
- Failing test: no test, documentation only.
- Minimum code: as "Decisions" says under "README and decision record".
- Refactor: none.
- Commit message: `docs: record ADR-SIC-E, the new role of the repository`
- Depends on: 2, 3

Units 1 and 4 can start at the same time. Units 2, 3 and 6 can run in parallel once unit 1 is done. Security: no endpoint, no database and no external input beyond the maintainer's own files, so the security unit does not apply. The privacy rules above play that role.

## Documentation duties

- Decision record: applies, written to `docs/decisions/ADR-SIC-E-new-role-of-the-repository.md` by unit 8.
- Specification: applies, the ADR-SIC-E line of section 9 of `docs/projects/skills-into-cli.md` links to the record, by unit 8.
- README: applies, by unit 7.
- Comment on this ticket (#8): applies, on GitHub, with what was built and the after-merge steps, without any name of the list.
- Comment on the ticket of the baseline runs (#12): applies. It says that the prose skills in `skills/` are frozen and that `~/.claude/skills` was not changed.
- Comment on the ticket that ships the skills (#9): applies. It asks for the marker name `.cstack-managed`.
- Comment on the ticket that adds `cstack/` and CI (#7): applies. It says that after the history rewrite its branch must be rebased onto the new `main` with `git rebase --onto`, and that the test scripts of this ticket could get a CI step.
- `INVENTORY.md`: does not apply by hand; unit 6 redacts it and the next sync rebuilds it.
- Runbooks and glossary: do not apply; the repository has none.

## Review log

### Impact notes (phase 7)

Graphify is not installed, so impact was checked with search. `sync.sh` is called by no other script. The README and ADR-SIC-E describe it, and both were updated. `scripts/build_inventory.py` is called only by `sync.sh`, and `scripts/test_sync.sh` covers it. `scripts/private_names.py` is called by `sync.sh` and `scripts/rewrite_history.sh`, and has its own test. `pull-skills.sh` is described by the README, which was updated. Usual companions of `sync.sh` (README, INVENTORY.md) were checked: INVENTORY.md is generated at the next sync and was redacted by unit 6. All four test scripts pass after units 1 to 8. The private-name check finds nothing in the files, commit messages and authorship of origin/main..HEAD (all 11 commits use the no-reply address).

### Review findings (phase 7, four reviewers)

Fixed: the scan after the rewrite missed a path name that held a private name when the same content sat under two paths (critical). The rewrite now also renames such paths, keeps the commit count stable, and pushes atomically with one lease per ref, after checking that the source did not change. `check` no longer prints a path that holds a name. The list is read with `utf-8-sig`. `sync.sh` stages only the files it wrote and also runs the secret check before redaction. A first cleanup missed a work ticket prefix, a workspace name and a database id in `config/settings.json` and the `linear-release-note` skill; they are now removed (commit 67a43fe). Small simplifications were applied to the helper.

Follow-ups, not done: the four test scripts use two slightly different styles (`check` with `eval` against `expect`). The name check cannot catch accented names in a different case, and spelling variants, because it uses the same pattern as the redaction. Two paths that collide after renaming are not handled by the rewrite. The lease rejection and the race were not exercised by a test. The private list lacks entries for the work ticket prefix and the workspace name that the first cleanup missed; the maintainer should add them (the list entries cannot be named here). One sentence of `skills/resolve-issue/SKILL.md` still describes the original incident in neutral words; it was left as is.

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

- 2026-11-17: Phase 6 started. GitHub issues have no "in progress" state, so the ticket stays open and unchanged. Branch gambitl/repo-source-history already existed and is checked out.

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

**I need your answer before I plan**

1. **Install `git filter-repo` on your machine.** The rewrite script and its test cannot run without it, and I will not install software for you. I recommend `brew install git-filter-repo` now.

2. **Confirm which names go on the private list.** The list drives the sync, the rewrite and the cleanup, so a name you leave out stays public. I will show you the candidates here only. I recommend the employer and its domain, the clients, the work projects and the work ticket prefixes, with a neutral replacement where `<private>` would read badly.

3. **Set this repository's `user.email` to your GitHub no-reply address before the first commit.** Seven local commits carry your work address, and its domain is on the list. The text replacement does not touch authorship, so the rewrite would leave it. I recommend the no-reply address, plus one line on the list that maps the work address to it.

4. **Decide now what you do if GitHub Support says no.** Their guide says they "won't remove non-sensitive data", and names are not credentials. The closed pull requests #1 to #5, and this one, would then keep showing the names in their "Files changed" tab, to any visitor. The clone check of the ticket would still pass. I recommend asking Support first, and recreating the repository under the same name if they refuse, after moving the issues. Deleting a repository cannot be undone, so I want your yes before it goes in the after-merge steps.

**I will do this unless you say no**

- Names match without regard to case. The dry run prints, for each line of the list, how many places matched, so you spot a short name that eats ordinary words before you push.
- `sync.sh --commit` commits with a path filter on `config` and `INVENTORY.md`, because a plain commit takes everything already staged.
- `sync.sh` builds the files in a temporary folder and copies them into `config/` only once both checks pass.
- The rewrite also cleans messages and authorship, and clones with `--no-local`, which the tool needs for a local source.
- This pull request's number goes in the Support request, because its diff lists every removed name.
- The pull request descriptions of #1, #3 and #4, the cleanup of the work keys, `INVENTORY.md`, and the warning to the ticket that adds the CI (#7) follow the draft answers.
- I name the marker file `.cstack-managed` in the decision record, and tell the ticket that ships the skills (#9) to write the same name.

**I checked it myself**

- A plain `git commit` took a file of `cstack/` that was staged earlier. A commit with a path filter left it out.
- The merges made with GitHub's button carry no-reply addresses. So only the seven local commits carry the work address.
- No file path in the history holds a work name, so nothing needs renaming.

**Questions for other people that can wait**

For GitHub Support, after the push: "Hello. We rewrote the history of the public repository gambitl/claude-code-stack to remove client and employer names that were committed by mistake. The old commits are still reachable through the closed pull requests #1 to #5 and #<this pull request>, and through cached views. Could you dereference those pull requests, remove the cached views and run a garbage collection? The affected commits are: <hashes>. These are names, not credentials, so rotating anything is not possible."

**Good to know**

- The rewrite drops GitHub's signatures, so the merge commits lose their "Verified" badge.
- All Orca worktrees share one `.git`. Reset the local `main` first, because new worktrees start from it.
- If the CI ever runs the rewrite test, its runner needs `git filter-repo` too.

#### Details

**Install `git filter-repo`** (draft question 1, blocking, someone has to be asked). `command -v git-filter-repo` returned nothing on 2026-11-17. The rewrite script refuses to run without it, and `scripts/test_rewrite_history.sh` cannot pass. Installing software on the maintainer's machine is the maintainer's call. If nobody decides, the rewrite test is written but never seen passing, and the pull request cannot claim the acceptance criteria on the rewrite. I keep the draft recommendation.

**Names on the private list** (draft question 2, blocking, someone has to be asked). The list is the single input of the sync redaction, the rewrite and the cleanup of `skills/` and `config/`. Any name left off it stays in every place, and the final checks cannot catch it, because they only search for names on the list. The candidates are shown in the conversation only. I keep the draft recommendation. I add that the maintainer should also consider the author name of commit `92e9816`, which belongs to another person with a personal address. It is not a work name, so the default is to leave it.

**Work email in authorship** (draft question 3, blocking, someone has to be asked). I checked with `git log --all --format` that commits `9d7a5f4`, `3e1843c`, `806c781`, `e95af2d`, `c758a65`, `e686ca0` and `abf199f` carry the address set in this copy's `user.email`, as author and committer. The five merge commits made on GitHub carry a no-reply author and GitHub's own committer address, so the merge button does not add the work address. Commit `92e9816` has another author with a personal webmail address. `git filter-repo --replace-text` rewrites file contents only, and its manual says `--mailmap` rewrites author, committer and tagger names and emails. I recommend a generated mailmap file in the temporary folder, rather than `--email-callback` code, because it is simpler to test. The explicit line that maps the full work address must come first, because a later line that replaces only the domain would produce an address like `name@<private>`. The final check of the rewrite searches authorship as well as contents and messages. If nobody decides, the commits of this ticket add the address again, and the rewrite leaves all of them in place.

**What happens if GitHub Support refuses** (my point, blocking, someone has to be asked, because it touches something that cannot be undone). GitHub's guide "Removing sensitive data from a repository", read on 2026-11-17, says "GitHub Support won't remove non-sensitive data" and helps only "in cases where we determine the risk can't be mitigated by rotating affected credentials". Employer and client names are not credentials, so a refusal is likely. The ticket's CTO review assumes Support removes the references ("until GitHub Support removes them"). It does not say what happens if they refuse, so this point does not reopen it. If they refuse, `refs/pull/1/head` to `refs/pull/5/head`, and the reference of this ticket's pull request, keep the old commits. The "Files changed" tab of each closed pull request then shows the names to any visitor, not only to someone who knows a hash. The acceptance criterion "a fresh clone shows no name" still passes, because a clone does not fetch `refs/pull/*`. So the ticket can look done while its goal is not reached. The options are: accept the remaining exposure; or create a new repository, push the rewritten history, move issues #6 to #33 with `gh issue transfer`, delete the old repository and give the new one the old name. GitHub's documentation says a transferred issue keeps its comments, labels and assignees, but not its milestone. I have not verified whether sub-issue links survive a transfer. So the waves (milestones) and possibly the epic links would need rebuilding. Deleting the repository also removes the pull request bodies of #1, #3 and #4, which settles draft question 7. I recommend asking Support first and recreating only on refusal. Deleting a repository cannot be undone, so it needs the maintainer's explicit yes before it is written into the after-merge steps. If nobody decides, the after-merge steps end at the Support request, and a refusal leaves the names readable.

**Matching case** (draft question 4, blocking, the run can settle it with the tests). I keep case-insensitive matching everywhere. I add a safeguard for the rewrite, which cannot be undone once pushed. Plain substring matching without regard to case can hit ordinary words when a list entry is short, such as a three-letter ticket prefix. It would then silently change code and prose in every past commit. Word boundaries would miss names glued to other words, so I reject them as the default. Instead, the dry run, without `--push`, prints one count per line number of the list: how many blobs, messages and authorship fields matched. It never prints the name or the matched text. An unusually high count tells the maintainer to make that line more precise, for example with a `regex:` line. The test checks that the counts appear and that `Acme` does not.

**Commit and tag messages** (draft question 5, blocking, checked by reading the manual). The manual of `git filter-repo`, read on 2026-11-17, says that `--replace-message` takes "expressions that, if found in commit or tag messages, will be replaced", with "the same syntax as --replace-text". So the script passes the same generated file to both options. The manual does not say whether `--replace-text` skips binary files. This repository has none, so it does not matter here. The manual also says that literal lines are matched as written, so the generated file uses `regex:(?i)` with the escaped name to get case-insensitive matching.

**Local source and the fresh clone check** (my point, the run settles it with the test). The manual says `git filter-repo` aborts when the repository is not a fresh clone. It also says "You should pass `--no-local` if the repository you are cloning from is on the local filesystem." The test passes a local throwaway repository as `--source`. Without `--no-local`, the tool refuses to run, and the only other way out is `--force`, which disables the safety check. So the script clones with `git clone --mirror --no-local`. The flag does nothing for a URL source. The manual also warns that refs deleted by the rewrite stay on the server unless the push prunes them. Here the plan deletes the six old branches before the rewrite, and the push names `refs/heads/*` and `refs/tags/*`, so that is already covered.

**What `sync.sh --commit` really commits** (my point, non-blocking for the plan, settled by a test). I tested in a throwaway repository in the scratchpad. A file in `cstack/` was staged, then `config/` was staged and `git commit -m` ran. The commit contained both. With `git commit -m ... -- config`, the commit held only `config/s`, and the other file stayed staged. So replacing `git add -A` with `git add config INVENTORY.md`, as the ticket's scope item 3 says, is not enough for the negative acceptance criterion "never commits a file in `cstack/`". A developer who staged work in progress and then runs `./sync.sh --commit` would publish it. The fix is `git add -A -- config INVENTORY.md`, then `git diff --cached --quiet -- config INVENTORY.md`, then `git commit -m ... -- config INVENTORY.md`. The `-A` keeps deletions. The test cannot run `--commit`, because the ticket forbids it and the push would reach the working copy. So the test stages a sentinel in `cstack/` before the sync. It then checks that the paths of `config/` and `INVENTORY.md` are staged as expected, and that the sentinel is still staged but not mixed into the sync's own staging. The commit path filter is checked by reading the diff.

**Where `sync.sh` writes before it checks** (my point, non-blocking). Today steps 1 to 4 write into `config/` and `INVENTORY.md`, and the secret check runs afterwards. When the check stops the script, the suspicious files stay in the working tree, ready for a commit by hand. The README will now tell people to read the diff and commit, which makes that path more likely. With the redaction, the same holds for a name that the replacement missed. I recommend building the five config files and the inventory in a temporary folder, redacting them, running both checks there, and copying them into place only when both pass. This also gives "writes nothing to `config/`" for free in every stop case, not only when the list is missing. The scope of the ticket allows this, because it does not fix the order of the steps.

**This pull request's own diff** (my point, non-blocking). Scope item 6 removes the names from `skills/` and `config/` in this pull request. Its "Files changed" tab therefore shows every removed name in red, and `refs/pull/<number>/head` keeps them after the rewrite, like #1 to #5. I considered leaving the names to the rewrite, so that this diff holds none. I rejected it, because it changes the order of the scope and of the acceptance criteria, and because #1 to #5 already expose the same names, so the extra exposure is small. Its number must be in the Support request, which is the default I take. If Support refuses, the fallback above covers this pull request too.

**Draft questions 6 to 9.** I keep the draft answers. Question 6 (the work keys and counts in `skills/resolve-issue/writing.md` and `skills/resolve-issue/SKILL.md`) is blocking for the cleanup and is settled by the draft rule. Question 7 (pull request descriptions of #1, #3 and #4) is blocking for what the pull request body writes. Its answer adds an after-merge step: edit those three descriptions, then delete their old revisions from the edit history. GitHub's guide also says that dereferencing a pull request does not remove data quoted in its body or comments, which confirms that step is needed even if Support agrees. Question 8 (`INVENTORY.md`) is non-blocking. Question 9 (the ticket that adds the CI, #7, and the work address) is non-blocking. The warning to that ticket never names the address.

**The marker file `.cstack-managed`** (my point, non-blocking, hidden coupling). Scope item 13 makes `scripts/build_inventory.py` list folders with `.cstack-managed` as installed by `cstack`. The name appears only in this plan. The specification (`docs/projects/skills-into-cli.md`, line 75) requires that `cstack skills install` never overwrites a folder it did not write, which the ticket that ships the skills (#9) will implement, probably with a marker. If #9 picks another file name, the inventory silently lists `cstack`'s skills as the maintainer's own. I recommend naming the marker in ADR-SIC-E and leaving a comment on #9 so it uses the same name. This also has a good side effect that the README can mention. After `pull-skills.sh` replaces a `resolve-issue` skill that `cstack` installed, the new folder has no marker, so `cstack skills install` will skip it and say so.

**No file names to rewrite** (checked). `git log --all --name-only` lists 33 paths over the whole history. None of them holds a work name: they are skill names, script names and configuration file names. `--replace-text` does not rename files, so no path rename option is needed. The final check of the rewrite can still search paths, at no cost.

**Good to know.** The manual says that signatures on commits and tags "are just removed" by a rewrite. The five merge commits made on GitHub are signed by GitHub today, so they lose their "Verified" badge. Nothing depends on it. Orca worktrees of this repository share one `.git` folder, so one `git fetch` serves them all. Each worktree's branch still has to be reset or rebased, and the local `main` must be reset first, because Orca starts new worktrees from it. If the CI of #7 runs `scripts/test_rewrite_history.sh` one day, the runner needs `pip install git-filter-repo` first. Until then the script runs by hand, as the draft assumptions say.

**Locked decisions cited.** The ticket's CTO review: one rewrite after the merge, from a mirror clone, pushed only with `--push`, with the bundle as the only way back. Section 10 of the specification: the repository stays public. ADR-SIC-E is written by this ticket. None of them is reopened here. Recreating the repository on refusal keeps it public and keeps the rewrite as designed.

I checked scale and performance, the user-facing edge cases of the command-line output, and new recurring costs, and found nothing in them for this ticket.

### Open questions and answers

1. **Install `git filter-repo`.** Blocking: the rewrite script and its test need it, and it is not installed. Recommended answer: install it now with `brew install git-filter-repo`. The run cannot decide this, because it installs software on the maintainer's machine.

2. **Which candidate names go into the private list.** Blocking: the list decides what the sync hides, what the rewrite removes, and what the cleanup of `skills/` and `config/` replaces. The candidates were found in the current files, in every past commit, in commit messages, in commit authorship, in pull request bodies and in the live `~/.claude/settings.json`. They are shown to the maintainer in the conversation only and are never written here. Recommended answer: the employer's name and its web domain, the client names, the work project names and the work ticket prefixes, each with a neutral replacement where a placeholder would read badly.

3. **The work email address in commit authorship.** Blocking: seven commits carry it as author and committer, and its domain is a name of the list. `--replace-text` does not touch authorship, so the rewrite as the ticket describes it would leave the name in the history. This working copy's `user.email` is the same address, so the commits of this ticket would add it again. Recommended answer: before the first commit, set `user.email` of this repository to the GitHub no-reply address of the maintainer's account. The rewrite script also applies the list to author and committer names and emails, and its final check covers them. The maintainer adds a line to the list that maps the full work address to the no-reply address.

4. **Matching case.** Blocking: it changes what the scripts replace and what the checks find. Recommended answer: match every name of the list without regard to case, in the sync, in the rewrite and in every check, because a name often appears in lower case in a host name or a path.

5. **Commit and tag messages in the rewrite.** Blocking for the acceptance, which requires clean messages. Answer by reading the documentation: `--replace-text` does not touch messages, so the script also passes the same expressions to `--replace-message`. To verify with `git filter-repo --help` once installed.

6. **Work references that are not names.** Non-blocking for the scripts, blocking for the cleanup of `skills/`. Recommended answer: replace the work ticket keys of `writing.md` (lines 27, 41 and the key in the example) with neutral keys such as `PROJ-12`, replace the counts from work runs at lines 206 and 211 of `SKILL.md` with neutral words, and keep the numbers of the `writing.md` example, which come from a plan and not from a retrospective and name nothing. Counts stay in the old commits, because they name nothing.

7. **The bodies of pull requests #1, #3 and #4 on GitHub.** Blocking for what the pull request writes. They hold names, and neither the rewrite nor GitHub Support's cleanup of git objects reaches them. GitHub keeps the old revisions of an edited description. Recommended answer: do not edit them in this run, and add one step to the after-merge sequence in the pull request body: edit those three descriptions, then delete their old revisions from the edit history.

8. **`INVENTORY.md`.** Non-blocking. It holds a work ticket prefix, and the ticket says not to edit it by hand. Recommended answer: run the new redaction helper on it once in this pull request, so that the file is clean before the tag. The next sync keeps it clean.

9. **Ticket #7 and the work email.** Non-blocking for this ticket. Ticket #7's commits may carry the same work address, and a rebase keeps it. Recommended answer: tell the coordinator, without naming the address, so that #7 sets the no-reply address before it pushes.

**Answers, 2026-11-17.** The maintainer answered "ok" to the recommendations of the question round, which covers questions 1 to 9, the four points of the advisor's first group, and every point of its second group, accepted by default. A personal project name is also on the list: the maintainer said one candidate is a personal project and asked to hide it too. The maintainer also asked, in their own words, that the rewrite cover commit messages and the author email, for example with `--replace-message` and `--mailmap`; the plan follows that wording.

- Question 1: `git filter-repo` 2.47.0 was installed with Homebrew on 2026-11-17. Its `--help` lists `--replace-message`, which uses the same syntax as `--replace-text`, and `--mailmap`, which rewrites author, committer and tagger names and emails. This also settles question 5 with a tested answer.
- Question 2: the maintainer confirmed eight entries in the conversation: the work email address mapped to the GitHub no-reply address, the employer, two clients, a personal project, its ticket prefix, a work repository name and a work package name. The names are only in the private list file.
- Question 3: the repository's `user.email` (in the shared `.git/config`, so every worktree of this repository) was set to the GitHub no-reply address on 2026-11-17. The address came from the global git config before.
- Question 4 and the advisor's point on GitHub Support: accepted. The after-merge steps ask Support first and, if Support refuses, recreate the repository under the same name after moving the issues. The maintainer runs those steps, not this ticket.
- Question 9: ticket #7 has two local commits with the work address (checked 2026-11-17 with `git log`). The coordinator is told, without the address, so that #7 rewrites the author of those commits before it pushes. The coordinator replied on 2026-11-17: #7 has not pushed, only its first two commits use the work address, and its worker will rewrite their author before its single push.

Assumptions not asked, written into "Decisions" when the plan is written: the scripts never print a name and report a remaining name by file and line of the list; lines of the list apply top to bottom, so longer names go first; an empty list stops the sync like a missing one; the rewrite pushes only `refs/heads/*` and `refs/tags/*`, with `--force`, to the source URL; the bundle goes to `$HOME/claude-code-stack-old-history-<timestamp>.bundle`; `pull-skills.sh` stops with a clear message when the tag does not exist yet; one Python helper in `scripts/` parses the list for both shell scripts; `.github/workflows/ci.yml` does not exist on `main` at the start, so the pull request says the test scripts run by hand for now.

### Architecture options

No real choice between architectures: the ticket and the answers lock the approach. No new decision since phase 4.
