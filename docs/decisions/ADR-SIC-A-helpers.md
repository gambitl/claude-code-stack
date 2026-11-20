# ADR-SIC-A: How the helpers run

Status: accepted, 2026-11-19. Partly changed by [ADR-SIC-G](ADR-SIC-G-continue-or-stop.md) on 2026-11-20: inside a ticket, the helpers run as sub-agents again, and an Orca worker is used only for units that run in parallel.
Ticket: https://github.com/gambitl/claude-code-stack/issues/27

## Context

A helper is a fresh agent that `resolve-issue` starts for one job. The executor is the helper that runs the build. It starts one implementer for each unit of the plan.

Past retrospectives report an executor that said it was done before its implementers had finished. The conversation then went on with work that was not ready.

Orca is the app that manages the worktrees. It can start a worker, which is a full Claude Code session. It can also wake the conversation when that worker is done. Claude Code sub-agents are the other way to start a helper. They need no app, but nothing wakes the conversation for them.

## Options

1. Every helper is an Orca worker. The conversation is woken only when a worker is really done. But nothing works for a person who does not use Orca.
2. Every helper is a Claude Code sub-agent. This works everywhere and is how the helpers run today. But it does not solve the early "done" report.
3. Helpers are Orca workers when Orca workers are available, and sub-agents otherwise.

## Decision

We use option 3.

The executor and the implementers run as Orca workers when Orca runs and offers the worker commands. In every other case, they run as sub-agents, as they do today. Both ways use the same check on the final report, so a report that is not complete is refused whatever way the helper ran.

A person can force the sub-agent way by setting `CSTACK_ORCA_WORKERS=off`. Any other value of that variable is ignored.

The reviewers and the advisor stay sub-agents. The specification names only the executor and the implementers.

## Consequences

The model and the effort of a helper no longer come from the header of its agent file when it runs as a worker. `cstack helper start` passes them to the `worker-start` call of Orca. If Orca refuses the model, `cstack` stops and prints Orca's message. It never picks another model on its own.

An Orca worker is a full Claude Code session. It may use more tokens than a sub-agent that does the same job.

A worker that waits for an answer to a permission question stalls the run, because nobody answers it. So the permission rule of the ticket that handles the forges (#26) matters here. When `cstack` sees that a worker waits for a person, it says so and tells the person to answer in Orca.

The way of starting a helper is the only thing that changes. The prompts of the helpers, the plan and the report check stay the same. This is why the fallback to sub-agents costs nothing.

Update of 2026-11-20, from ticket #31. The last paragraph above is no longer true as written. The prompts of the helpers now end with `cstack helper done <kind> --helper <helper id> --plan <plan file>`, in both modes. The command runs the same check as `cstack report submit`, and it also sends `worker_done` to Orca when the helper is a worker. The helper always runs this command itself, so the main conversation never runs it for a helper. The fallback to sub-agents still costs nothing, because both ways use the same prompt and the same check.
