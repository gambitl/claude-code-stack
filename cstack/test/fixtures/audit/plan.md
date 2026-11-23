# Plan: #99 — An audit example plan
Format: cstack-plan/1
Written by: cstack 0.1.0
Date: 2026-11-18
Ticket: #99
Tracker: GitHub issues
Documentation tool: docs folder
Branch: gambitl/audit-example
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
- Files: `src/u2.ts`, `test/u2.test.ts`
- Test: `test/u2.test.ts`: the case 2 fails
- Minimum code: Write the thing 2.
- Refactor: None.
- Commit message: `feat(cli): add thing 2`
- Depends on: 1

### Unit 3: Thing 3
- Files: `src/u3.ts`
- No test: The unit changes a constant only.
- Minimum code: Write the thing 3.
- Refactor: None.
- Commit message: `feat(cli): add thing 3`
- Depends on: 2

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
