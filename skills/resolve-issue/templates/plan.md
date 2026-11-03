# Plan: <ticket id> — <ticket title>

Date: <YYYY-MM-DD>
Ticket: <link>
Tracker: <Linear | Jira | GitLab | GitHub | other>
Documentation tool: <Notion | Confluence | wiki | docs/ folder | other>, ADRs in <place>
Branch: <branch name>
Conversation language: <the language the user writes in; the conversation uses it, and every record stays in English>
Status: draft | waiting for answers | questions answered | approved | in progress | review | ready for review

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. -->

## Ticket

<the ticket body, copied verbatim, every section, including the CTO review block when there is one>

### Decisions already taken upstream

<the parent project's decisions block and the ADRs it names, with links>

## Dependencies

<"clear", or the open blockers and the user's decision>

## Code mapping

<phase 3>

## Decisions

<The one place where every helper learns what was decided for this ticket. Write one line per decision, as a rule that someone can apply without reading anything else in this file. Include the changes of scope from the ticket comments and the upstream decisions this ticket must respect, because implementers do not read those parts. Never write "as in question 3", "A2" or "Part 2, point 2". End each line with its date and its source: the user's answer, an assumption not asked, a tested answer, or the answer of someone else. When a later answer changes a decision, rewrite its line in place with the new date, and do not keep the old wording here. What happened during a run is not a decision; it goes in the Hand-off log.>

## Architecture

<the approach the plan follows, in a few sentences, or one line saying the approach is locked or the change is small. The full blueprints go in "History".>

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

## Review log

<phase 7 findings and fixes; phase 8 independent review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Open questions after the build

<phase 10.2: the questions raised by the reviews or the briefing and not answered yet, word for word, each with who it is for>

### Blocking

<each one stops the pull request until it is answered. Once answered, write "answered on <date>" next to it, and write the answer itself in "Decisions". "none" when empty.>

### Non-blocking

<these go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them. "none" when empty.>

## Pull request

<phase 10.4: the drafted title and body, with the closing reference. Phase 12 opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase 10.3: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

<CTO advisor, moment before-plan: the short version shown to the user, then "Details". Plan-delta points are appended under "Added after the plan was drafted".>

### Open questions and answers

<phase 4.1: each question with its label (blocking or non-blocking) and the recommended answer, then one of: the tested answer with its evidence; the user's answer; or, for someone else, the question word for word, who it goes to, the channel, and the answer with its source and date once it arrives. Phase 5 starts only when every blocking question has an answer. Each final answer is also written as a rule in "Decisions" when the plan is written.>

### Architecture options

<phase 5.1: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
