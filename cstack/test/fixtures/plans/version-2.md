# Plan: #2 — A plan with units
Format: cstack-plan/2
Written by: cstack 0.1.0
Date: 2026-11-18
Ticket: #2
Tracker: GitHub issues
Documentation tool: docs folder
Branch: gambitl/units
Target branch: main
Conversation language: English
Status: approved
Approved at: 2026-11-18T14:32:05+01:00
Ready for review at: not yet

## Ticket

The ticket text.

## Negative criteria

1. The command never changes the plan file.
2. The reader never accepts a plan with no Format line.

## Dependencies

Text of dependencies.

## Code mapping

Text of code mapping.

## Facts

- The reader is in one file. Source: `src/plan/read.ts`, line 1: "export const PLAN_FORMAT"
- The maintainer chose a long flag. Source: the user, on 2026-11-18

## Decisions

Text of decisions.

## Architecture

Text of architecture.

## Implementation units

### Unit 1: Thing 1
- Files: `src/a1.ts`, `test/a1.test.ts`
- Test: `test/a1.test.ts`: the case 1 fails
- Test: `test/a1.test.ts`: the case 1b fails
  and it fails for a second reason
- Negative criterion 1: the case 1 fails
- Negative criterion 2: the case 1b fails
  and it fails for a second reason
- Minimum code: Write a1.
- Refactor: None.
- Commit message: `feat(cli): add a1`
- Depends on: none

### Unit 2: Docs only
- Files: `docs/x.md`
- No test: The unit changes prose only.
- Minimum code: Write the page,
  then link it from the index.
- Refactor: None.
- Commit message: `docs: add x`
- Depends on: 1

### Unit 3: Thing 3
- Files: `src/a3.ts`, `test/a3.test.ts`
- Test: `test/a3.test.ts`: the case 3 fails
- Minimum code: Write a3.
- Refactor: None.
- Commit message: `feat(cli): add a3`
- Depends on: 1, 2
- Design specification: none
- Blocked: waiting for a decision
A free note.

## Documentation duties

Text of duties.

## Blocking questions

### Question 1: Which flag
Should the flag be long?
- For: the maintainer
- Answer: Yes, long. The maintainer, 2026-11-18.

### Question 2: Which name
What is the name?
- For: the maintainer
- Answer: open

## Changes to what the ticket fixes

- The flag is long, not short. Blocking question: 1

## Review log

<!-- later -->

## Briefing

<!-- later -->

## Non-blocking questions

<!-- later -->

## Pull request

<!-- not yet -->

## Documentation

<!-- later -->

## Executor notes

<!-- later -->

## Hand-off log

<!-- later -->

## History

Text of history.
