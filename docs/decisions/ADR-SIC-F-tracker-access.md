# ADR-SIC-F: How cstack reaches trackers and forges

Status: accepted, 2026-11-19.
Ticket: https://github.com/gambitl/claude-code-stack/issues/24

## Context

`cstack` needs to read tickets, move them to another state and add comments. The tickets live in Jira, Linear, GitHub or GitLab. Orca, the app that manages the worktrees, can already talk to Jira and Linear. The `gh` and `glab` programs can talk to GitHub and GitLab. Claude also has its own connections to the trackers.

The question is how `cstack` should get access without becoming a new place where secrets are kept.

## Options

1. `cstack` stores a token for each tracker. This works everywhere. But `cstack` then holds a secret, and it must handle login, expiry and storage.
2. `cstack` reads a token from the environment and sends it to the web interface of the tracker. Nothing is stored. But the token still passes through `cstack`, and `cstack` must know every web interface of every tracker.
3. `cstack` uses the clients that are already logged in. These are Orca for Jira and Linear, `gh` for GitHub and `glab` for GitLab. When none of them can do a read, `cstack` reads a file that Claude writes from its own connection.

## Decision

We use option 3.

For each capability, `cstack` picks the client in this order. First comes Orca, when it offers that tracker. Then comes `gh` or `glab`, when its `auth status` command succeeds. Then comes the file from Claude, which can serve reads only.

When no client is left for a move or a comment, `cstack` does nothing. It exits with code `4` and tells Claude what to do with its own connection. For a move, the message gives the ticket key and the state name. For a comment, it gives the key and the path of the comment file.

## Consequences

`cstack` holds no credential. It never reads a token and never sends one.

A write with no client goes back to Claude with exit code `4`. Claude then does the step itself.

`orca jira` cannot link two tickets. So when a plan needs such a link, Claude creates it with its own connection.

The file from Claude carries a `group` key, which is either a milestone name or an epic key. A list read refuses a file that has no group, or another group. This stops `cstack` from showing the tickets of the wrong wave.

The blockers of a ticket are the relations that the tracker reports, plus the keys written in the footer line of the ticket body. Some trackers give no relations. For those, the footer alone answers.

Every call to a client goes through one runner that never starts a shell. Every key, state name and path is checked before any program runs. This keeps text from a ticket from turning into a command.
