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
Status: ready for review
Approved at: 2026-11-18T14:32:05+01:00
Ready for review at: 2026-11-18T18:00:00+01:00

## Ticket

The ticket text.

## Negative criteria

none

## Dependencies

Text of dependencies.

## Code mapping

Text of code mapping.

## Facts

none

## Decisions

Text of decisions.

## Architecture

Text of architecture.

## Implementation units

### Unit 1: Thing 1
- Files: `src/a1.ts`, `test/a1.test.ts`
- Test: `test/a1.test.ts`: the case 1 fails
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

none

## Changes to what the ticket fixes

none

## Review log

Text of the review log.

Independent review: none

## Briefing

Text of the briefing.

## Non-blocking questions

Text of the questions.

## Pull request

Title: feat(cli): read the plan file

````markdown
Some words.

```bash
## not a heading of the plan
npm test
```

## Summary

It reads the plan.
````


## Documentation

Text of the documentation.

## Executor notes

Text of the notes.

## Hand-off log

<!-- later -->

## History

Text of history.
