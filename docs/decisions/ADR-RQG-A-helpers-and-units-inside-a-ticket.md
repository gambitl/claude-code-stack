# ADR-RQG-A: How helpers and units run inside a ticket

Status: accepted, 2026-11-24.
Ticket: https://github.com/gambitl/claude-code-stack/issues/93

## Context

A helper is an agent that does one job for the session that works on a ticket. The executor is one helper. It runs the build, review and publish phases from an approved plan. Each implementer is another helper. It builds one unit of that plan.

Until now, every helper could run as an Orca worker. An Orca worker is a full Claude Code session in its own terminal. It starts with about 60,000 to 66,000 tokens of context. A sub-agent starts with about 46,000 to 51,000 tokens. The model reads that starting context again at every call, so a full session costs more on every step of its work.

An Orca worker also needs extra machinery. Parallel units need a child worktree each. The session then has to wait for each worker and collect its result.

## Options

1. Orca workers. Each helper runs in its own session. This is what we had. It costs the most tokens, and it needs the wait and collect steps.
2. Sub-agents, each in its own worktree. The context is smaller, but the child worktrees and the collect step stay.
3. Sub-agents one after the other, in the workspace of the ticket. The session of the ticket starts one sub-agent for each unit, waits for it, and then starts the next one. This is the option we chose.

## Decision

We use option 3. The session of the ticket starts the executor and every implementer as a fresh Claude Code sub-agent. The units run one after the other, each in a sub-agent, in the workspace of the ticket.

There is one exception. A review agent other than Claude runs as an Orca worker, because only Orca can start another agent.

This decision replaces ADR-SIC-A.

## Consequences

- The units take longer from start to end, because none of them run at the same time. We accept this because the cost in tokens is lower and the run is simpler.
- No child worktree and no collect step remain.
- The executor reports with `cstack report submit`. It then returns the same report as its final message.
- The executor keeps its turn while an implementer runs. It does not end its turn to wait.
- Ticket #95 removes the old commands that started and waited for helpers.
