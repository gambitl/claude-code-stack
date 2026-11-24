# Plan: #1 — Add multiply and divide
Format: cstack-plan/2
Written by: not yet
Date: 2026-11-19
Ticket: #1
Tracker: GitHub issues
Documentation tool: docs folder
Branch: feature/multiply-divide
Target branch: main
Conversation language: English
Status: draft
Approved at: not yet
Ready for review at: not yet

## Ticket

Add the functions multiply and divide to the tiny math library, and describe all four functions in the README.

## Negative criteria

none

## Dependencies

<!-- later -->

## Code mapping

<!-- later -->

## Facts

none

## Decisions

- The function divide throws a RangeError when the divisor is zero.

## Architecture

All four functions live in `src/math.js`. Each function has its own test file.

## Implementation units

### Unit 1: Add multiply
- Files: `src/math.js`, `test/multiply.test.js`
- Test: `test/multiply.test.js`: multiply returns the product
- Minimum code: Add the function multiply to `src/math.js`.
- Refactor: None.
- Commit message: `feat(math): add multiply to the math library`
- Depends on: none

### Unit 2: Add divide
- Files: `src/math.js`, `test/divide.test.js`
- Test: `test/divide.test.js`: divide returns the quotient and refuses zero
- Minimum code: Add the function divide to `src/math.js`.
- Refactor: None.
- Commit message: `feat(math): add divide to the math library`
- Depends on: none

### Unit 3: Describe the functions in the README
- Files: `README.md`
- No test: The unit changes prose only.
- Minimum code: Add a section that lists the four functions.
- Refactor: None.
- Commit message: `docs: describe the four functions in the README`
- Depends on: none

## Documentation duties

The README describes the functions.

## Blocking questions

<!-- later -->

## Changes to what the ticket fixes

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
