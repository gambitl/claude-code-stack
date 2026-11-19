# Plan: <ticket id> — <ticket title>

Format: cstack-plan/1
Written by: not yet
Date: <YYYY-MM-DD>
Ticket: <link>
Tracker: <Linear | Jira | GitLab | GitHub | other>
Documentation tool: <Notion | Confluence | wiki | docs/ folder | other>, ADRs in <place>
Branch: <the current branch when its name is the short name that `cstack wave` gives the ticket, such as `issue-12` or `abc-12`; otherwise a new branch name>
Target branch: <the branch that the pull request goes into>
Conversation language: <the language the user writes in; the conversation uses it, and every record uses the recordsLanguage of .cstack/settings.json, which is English by default>
Status: draft
Approved at: not yet
Ready for review at: not yet

<!-- The header keys come in this order and cannot be reordered. Allowed values of Status: draft, waiting for answers, questions answered, approved, in progress, review, ready for review. Written by holds "not yet" until cstack registers this file and writes its own version there. Approved at and Ready for review at hold "not yet" or a time such as 2026-11-17T14:32:05+01:00. cstack writes both, so do not edit them by hand. -->

<!-- This file has two parts. The sections before "History" are the working part: they say what to build and what was decided, and each helper reads only the sections its prompt names. "History" keeps how the decisions were reached. Helpers skip it unless their prompt says otherwise. The level-2 headings are fixed: no other level-2 heading is allowed. -->

## Ticket

<the ticket body, copied word for word, every section, including the CTO review block when there is one. Move each heading of the ticket down one level, so that its "## Scope" becomes "### Scope" here. The words do not change.>

### Decisions already taken upstream

<the parent project's decisions block and the ADRs it names, with links>

## Dependencies

<"clear", or the open blockers and the user's decision>

## Code mapping

<phase code-map>

## Decisions

<The one place where every helper learns what was decided for this ticket. Write one line per decision, as a rule that someone can apply without reading anything else in this file. Include the changes of scope from the ticket comments and the upstream decisions this ticket must respect, because implementers do not read those parts. Never write "as in question 3", "A2" or "Part 2, point 2". End each line with its date and its source: the user's answer, an assumption not asked, a tested answer, or the answer of someone else. When a later answer changes a decision, rewrite its line in place with the new date, and do not keep the old wording here. What happened during a run is not a decision; it goes in the Hand-off log.>

## Architecture

<the approach the plan follows, in a few sentences, or one line saying the approach is locked or the change is small. The full blueprints go in "History".>

## Implementation units

<!-- Phase plan writes the units here. Until then this section holds no unit. Every unit has the heading "### Unit <n>: <name>", numbered 1, 2, 3 with no gap. The heading carries no status, because the status comes from git. The lines of a unit come in this order:
- Files: one or more paths in backticks, separated by ", ". A path is relative to the repository root.
- Test: `<test file>`: <the failing case it checks>   or   - No test: <reason>
  The test file of a Test line also appears in Files.
- Minimum code:
- Refactor:
- Commit message: on one line only
- Depends on: unit numbers separated by ", ", or the word none
- Design specification: optional, for user-interface units only
- Blocked: <reason>, optional, written by the executor
- Worktree: <absolute path>, optional, written by cstack when a unit runs in a child worktree, never by a person
Free notes come after these lines.
Each unit commit carries the trailer "Cstack-Unit: <n>" in the final paragraph of its message, together with any other trailer such as Co-Authored-By. git does not read a trailer outside the final paragraph. A commit with two Cstack-Unit lines counts for both units. -->

## Documentation duties

<phase document: each duty "applies, written to <place>" or "does not apply">

## Blocking questions

<!-- Write the single word "none" when the run has no blocking question. Otherwise write every blocking question of the run, from the question round and from after the build, each with this shape:
### Question <n>: <a few words>
<the question, word for word>
- For: <who can answer it>
- Answer: <the answer, its source and its date>
Write "- Answer: open" until someone answers. Number the questions from 1 with no gap. -->

<"none", or the questions>

## Review log

<phase review findings and fixes; phase independent-review: fixes and judgment calls>

## Briefing

<CTO advisor, moment after-build: the short version shown to the user, then "Details">

## Non-blocking questions

<phase plan: the non-blocking questions of the question round that stay open. Phase after-build-questions: the questions raised by the reviews or the briefing that do not stop the pull request. Each one word for word, with who it is for, or "none". They go into the pull request body under "Open questions, not needed for this pull request", after the user has seen them.>

## Pull request

<!-- Once filled, this section holds a line "Title: <title>", then the body inside a fenced block that opens with four backticks and the word markdown and closes with four backticks. The four backticks let the body hold ordinary code blocks and headings. -->

<phase pull-request: the drafted title and body, with the closing reference. Phase publish opens the pull request with them. The link is not written here, because that would need another push; the forge, the ticket and the decision records carry it.>

## Documentation

<phase document: ticket comment, dependent ticket comments, ADRs and pages, with links>

## Executor notes

<executor, before its report: what stumbled on its side, with evidence, or "nothing this time">

## Hand-off log

<one entry per executor run, dated: what the run did and which report it returned. The user's answers go in "Decisions", not here.>

## History

<!-- How the decisions were reached. Helpers skip this part unless their prompt says otherwise. -->

### Questions you may not be asking

<CTO advisor, moment before-plan: the short version shown to the user, then "Details". Plan-delta points are appended under "Added after the plan was drafted".>

### Open questions and answers

<phase questions: each question with its label (blocking or non-blocking) and the recommended answer, then one of: the tested answer with its evidence; the user's answer; or, for someone else, who it goes to, the channel, and the answer with its source and date once it arrives. The text and the answer of a blocking question live only under "Blocking questions"; refer to it here as "Blocking question <n>". The plan phase starts only when every blocking question has an answer. Each final answer is also written as a rule in "Decisions" when the plan is written.>

### Architecture options

<phase plan: the architecture blueprints, with the recommendation marked and the approach the user chose, or nothing when there was no real choice>
