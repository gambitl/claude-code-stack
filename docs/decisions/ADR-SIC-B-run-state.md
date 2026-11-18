# ADR-SIC-B: Where the run state lives and how its formats are versioned

Status: accepted, 2026-11-18.
Ticket: https://github.com/gambitl/claude-code-stack/issues/13
Specification: [`docs/projects/skills-into-cli.md`](../projects/skills-into-cli.md)

## Context

A run is one trip of a ticket through the build loop. While it goes on, `cstack` needs to remember some facts. It needs to know which phases started and which are done. It needs the test runs of each unit, the reports of the agents, and the pull request. Some of these facts are useful to people. Others only matter to `cstack`.

The plan file is a Markdown file that lives in the repository and travels with the branch. People read it, review it and comment on it. We had to decide where each fact goes.

## Options

1. Put all the run state in a header of the plan file. People see everything in one place. But the file fills up with test output and timestamps that nobody wants to read. Test output would also be committed to the repository. Several units can run in parallel, and they would all edit the same file at the same time.
2. Put all the run state in a separate state file that is not in the repository. The plan file stays clean. But facts that must travel with the branch would be lost when someone else checks it out, and a reviewer could not see them.
3. Use both, and split the data by who reads it. The plan file keeps what people read and what must travel with the branch. A separate run state keeps what only `cstack` needs.

## Decision

We use option 3.

The plan file keeps four kinds of facts. These are the format version, the two timestamps `Approved at` and `Ready for review at`, the units with their files, and the blocking questions. The status of a unit is not written anywhere. `cstack` reads it from the commits, which carry the line `Cstack-Unit: <n>`.

The run state keeps everything else. It lives under the common git folder, in `<common git folder>/cstack/runs/<plan file name>/`. The common git folder is the one that all worktrees of a repository share. A small file named `current-run` in the git folder of each worktree says which run that worktree works on.

Both formats carry a version, so that an old `cstack` never reads a file it does not understand.

- The plan file starts with `Format: cstack-plan/1`. The line `Written by: cstack <version>` says which `cstack` wrote it.
- The run state file `state.json` holds `"format": "cstack-run/1"` and `"writtenBy"` with the `cstack` version.
- When a `cstack` meets a format it does not know, it refuses with exit code 3. The message names the format it reads and, when the file says it, the `cstack` version that can read the file.

## Reasons

The plan file stays readable. It holds only what a person wants to read in a review.

Test output never enters the repository. The saved test runs and their logs stay in the git folder.

Parallel units write separate files. Each unit saves its test runs in its own folder, so two units never write to the same file.

Every worktree of the repository sees the same run. A child worktree that works on one unit finds the same run folder as the main worktree, because the folder is under the common git folder.

## Consequences

The cost is that the run state lives only in the clone. When someone deletes the clone, the saved test runs and the phase marks are lost. The planning phases come back, because `cstack` marks them done from `Approved at` in the plan file. The unit status also comes back, because it comes from the commits. The saved test runs do not come back, and the agents have to run those tests again.

Changing either format later needs a new version number and a decision. Both versions start at 1. The refusal of an unknown version is the only protection, so it must stay in the reader of the plan file and in the code of the run state.
