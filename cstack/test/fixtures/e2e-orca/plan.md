# Plan: #4 — Add square and cube
Format: cstack-plan/1
Written by: not yet
Date: 2026-11-19
Ticket: #4
Tracker: github
Documentation tool: docs folder
Branch: issue-4
Target branch: main
Conversation language: English
Status: approved
Approved at: 2026-11-19T12:00:00+00:00
Ready for review at: not yet

## Ticket

Add the functions square and cube to the tiny math library.

## Dependencies

None.

## Code mapping

Each function has its own source file and its own test file.

## Decisions

- Each function lives in its own file, so that the two units share no file.

## Architecture

The functions are independent. Each one is exported by name.

## Implementation units

### Unit 1: Add square
- Files: `src/square.js`, `test/square.test.js`
- Test: `test/square.test.js`: square returns the product of a number and itself
- Minimum code: Add the function square in `src/square.js`.
- Refactor: None.
- Commit message: `feat(math): add square to the math library`
- Depends on: none

### Unit 2: Add cube
- Files: `src/cube.js`, `test/cube.test.js`
- Test: `test/cube.test.js`: cube returns the number multiplied by itself twice
- Minimum code: Add the function cube in `src/cube.js`.
- Refactor: None.
- Commit message: `feat(math): add cube to the math library`
- Depends on: none

## Documentation duties

None.

## Blocking questions

none

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

Nothing yet.
