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

These four files hold the answers of `orca reference find` and `orca worktree create`. They are written by hand from the fields that Orca 1.4.263 writes in its code. No ticket on the recording machine had a stored reference. No test may create a real Orca worktree.

- `reference-find.none.json` is the empty answer of a ticket that has no workspace.
- `reference-find.one-worktree.json` holds one match, a worktree that is not archived.
- `reference-find.archived.json` holds the same match with `archived: true`.
- `worktree-create.started.json` is the answer of a worktree that Orca created and an agent that started in it.

## Orchestration files in `1.4.263/`

Orca 1.4.263 has the `orchestration` commands. Three answers were recorded from a real machine, after the placeholder pass. The terminal preview, the title, the branch name and the Orca ids were replaced by hand. The answers of `worker-start` and `send` are never recorded, because recording them would start a worker or send a message.

Recorded files:

- `orchestration-worker-show.working.json` is the full answer of `worker-show --full` for a worker that is working.
- `orchestration-worker-show.not-found.json` is the error answer for a Dispatch that does not exist.
- `orchestration-check.empty.json` is the answer of `check --all` when there is no message.

Files written by hand:

- `orchestration-worker-show.completed.json` and `orchestration-worker-show.failed.json` are the working answer with the status `completed` or `failed` and a `completedAt` time.
- `orchestration-worker-show.waiting.json` is the working answer with `observation.agentWait` set to an object that has an `evidence` field.
- `orchestration-worker-show.exited.json` keeps the status `dispatched` and sets `result.projection.liveness.verdict` to `exited`.
- `orchestration-worker-start.ready.json` is the answer of a worker that started, with a `dispatchId`.
- `orchestration-worker-start.refused.json` is a clear refusal with the code `invalid_argument`.
- `orchestration-worker-start.model-refused.json` is a clear refusal whose message names the model.
- `orchestration-worker-start.failed-stage.json` is a failed start whose `error` also holds `failedStage`, `effects` and `residualResources`.
- `orchestration-send.sent.json` is the answer of a message that was sent, with a message `id`.
- `orchestration-check.worker-done.json` is the answer of `check` with one `worker_done` message.
