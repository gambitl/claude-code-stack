# Plan: <ticket id> — <ticket title>

Date: <YYYY-MM-DD>
Ticket: <link>
Tracker: <Linear | Jira | GitLab | GitHub | other>
Documentation tool: <Notion | Confluence | wiki | docs/ folder | other>, ADRs in <place>
Branch: <branch name>
Status: draft | waiting for answers | questions answered | approved | in progress | review | ready for review

## Questions you may not be asking

<CTO advisor, moment before-plan; plan-delta points appended under "Added after the plan was drafted">

## Ticket

<the ticket body, copied verbatim, every section, including the CTO review block when there is one>

### Decisions already taken upstream

<the parent project's decisions block and the ADRs it names, with links>

## Dependencies

<"clear", or the open blockers and the user's decision>

## Code mapping

<phase 3>

## Open questions and answers

<phase 4.1: each question with its label (blocking or non-blocking) and the recommended answer, then one of: the tested answer with its evidence; the user's answer; or, for someone else, the question word for word, who it goes to, the channel, and the answer with its source and date once it arrives. Phase 5 starts only when every blocking question has an answer.>

## Architecture

<phase 5.1>

## Implementation units

### Unit 1: <name> — status: todo | in progress | done | blocked
- Failing test:
- Minimum code:
- Refactor:
- Commit message:
- Depends on: <unit numbers or none>
- Design specification: <open-design reference, user-interface units only>

### Unit 2: ...

## Documentation duties

<phase 5.2: each duty "applies, written to <place>" or "does not apply">

## Decisions

<every answer the user gave, dated>

## Review log

<phase 7 findings and fixes; phase 8 independent review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build>

## Open questions after the build

<phase 10.2: the questions raised by the reviews or the briefing and not answered yet, word for word, each with who it is for>

### Blocking

<each one stops the pull request until it is answered; its answer, source and date go here and into "Decisions". "none" when empty.>

### Non-blocking

<these go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them. "none" when empty.>

## Pull request

<phase 10.4: the drafted title and body, with the closing reference. Phase 12 opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase 10.3: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

<one entry per executor run, dated, with the user's answer for needs-decision>
