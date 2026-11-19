# Plan: #99 — A full example plan
Format: cstack-plan/1
Written by: cstack 0.1.0
Date: 2026-11-18
Ticket: #99
Tracker: GitHub issues
Documentation tool: docs folder
Branch: gambitl/full-example
Target branch: main
Conversation language: English
Status: ready for review
Approved at: 2026-11-18T14:32:05+01:00
Ready for review at: 2026-11-18T18:05:40+01:00

## Ticket

The ticket text starts here.

### Why this matters (plain language)

People need a full example of a plan.

### Where things are today (read first)

The reader exists and the commands do not.

### Scope

1. Read the plan.
2. Print one section.

```markdown
## Decisions
### Unit 3: fake
```

### Acceptance (TDD)

The status of each unit is true.

### Decisions already taken upstream

The maintainer chose a long flag.

## Dependencies

None.

## Code mapping

The reader is in `src/plan/read.ts`.

## Decisions

1. Read the plan with the existing reader.

## Architecture

One function per command.

## Implementation units

### Unit 1: Thing 1
- Files: `src/u1.ts`, `test/u1.test.ts`
- Test: `test/u1.test.ts`: the case 1 fails
- Minimum code: Write the thing 1.
- Refactor: None.
- Commit message: `feat(cli): add thing 1`
- Depends on: none

### Unit 2: Thing 2
- Files: `src/u2.ts`
- No test: The unit changes a constant only.
- Minimum code: Write the thing 2.
- Refactor: None.
- Commit message: `feat(cli): add thing 2`
- Depends on: 1

### Unit 3: Thing 3
- Files: `src/u3.ts`, `test/u3.test.ts`
- Test: `test/u3.test.ts`: the case 3 fails
- Minimum code: Write the thing 3.
- Refactor: None.
- Commit message: `feat(cli): add thing 3`
- Depends on: 2

### Unit 4: Thing 4
- Files: `src/u4.ts`
- No test: The unit changes a constant only.
- Minimum code: Write the thing 4.
- Refactor: None.
- Commit message: `feat(cli): add thing 4`
- Depends on: 3

### Unit 5: Thing 5
- Files: `src/u5.ts`, `test/u5.test.ts`
- Test: `test/u5.test.ts`: the case 5 fails
- Minimum code: Write the thing 5.
- Refactor: None.
- Commit message: `feat(cli): add thing 5`
- Depends on: 4

### Unit 6: Thing 6
- Files: `src/u6.ts`
- No test: The unit changes a constant only.
- Minimum code: Write the thing 6.
- Refactor: None.
- Commit message: `feat(cli): add thing 6`
- Depends on: 5

### Unit 7: Thing 7
- Files: `src/u7.ts`, `test/u7.test.ts`
- Test: `test/u7.test.ts`: the case 7 fails
- Minimum code: Write the thing 7.
- Refactor: None.
- Commit message: `feat(cli): add thing 7`
- Depends on: 6

### Unit 8: Thing 8
- Files: `src/u8.ts`
- No test: The unit changes a constant only.
- Minimum code: Write the thing 8.
- Refactor: None.
- Commit message: `feat(cli): add thing 8`
- Depends on: 7

### Unit 9: Thing 9
- Files: `src/u9.ts`, `test/u9.test.ts`
- Test: `test/u9.test.ts`: the case 9 fails
- Minimum code: Write the thing 9.
- Refactor: None.
- Commit message: `feat(cli): add thing 9`
- Depends on: 8

### Unit 10: Thing 10
- Files: `src/u10.ts`
- No test: The unit changes a constant only.
- Minimum code: Write the thing 10.
- Refactor: None.
- Commit message: `feat(cli): add thing 10`
- Depends on: 9

## Documentation duties

Write the page of the command.

## Blocking questions

### Question 1: Which flag
Should the flag be long?
- For: the maintainer
- Answer: Yes, long. The maintainer, 2026-11-18.

## Review log

The review found nothing blocking.

## Briefing

The build is done. Every unit has its commit.

## Non-blocking questions

none

## Pull request

Title: feat(cli): add the full example

````markdown
This pull request adds a full example.
````

## Documentation

The page of the command is written.

## Executor notes

The build ran without a stop.

## Hand-off log

The executor handed the plan to the reviewer.

## History

### Questions you may not be asking

Some text.

#### Details

Some details.

### Architecture options

Option one and option two.

#### Details

More details.
