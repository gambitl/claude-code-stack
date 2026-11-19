# Recorded answers of Orca

Each folder is named after the Orca version that gave the answers. The answers are recorded with `npm run record:orca` from the `cstack/` folder. That command runs only read-only Orca commands. A placeholder pass replaces every private value before a file is written.

## Recorded files in `1.4.263/`

These five files come straight from Orca on a real machine, after the placeholder pass. The `agent-context` answer keeps only `schemaVersion`, `commandCount` and the `command` field of each entry. The `status` answer has an empty list of capabilities.

- `version.current.txt`
- `status.running.json`
- `agent-context.current.json`
- `jira-connection.empty.json`
- `linear-team-list.empty.json`

## Files written by hand in `1.4.263/`

The recording machine has no Jira site and no Linear team, and its Orca app was running. So these files are built by hand from the recorded answers and from the answers that `cstack doctor` first recorded.

- `status.closed.json` is the running answer with the app stopped.
- `jira-connection.one-site.json` and `jira-connection.two-sites.json` hold one and two Jira sites.
- `linear-team-list.connected.json` holds one Linear team.
- `linear-team-list.error.json` holds a Linear connection error.
