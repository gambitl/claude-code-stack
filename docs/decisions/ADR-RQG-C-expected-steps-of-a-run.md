# ADR-RQG-C: How the audit knows the expected steps

Status: accepted, 2026-11-23.
Ticket: https://github.com/gambitl/claude-code-stack/issues/86

## Context

A later audit will compare what a run did with what it should have done. To do that, the audit needs a list of the steps that a run must not skip. We call them the mandatory steps. Each phase of the `resolve-issue` skill has its own mandatory steps.

The audit also reads guides from older commits. So the list has to live where the guide lives, and a program has to be able to read it without guessing.

## Options

1. Keep a list in the code of `cstack`. It is easy to read, but it drifts. A person edits a guide and forgets to edit the list, and nothing tells them.
2. Read the prose of the guides. Nobody has to keep a second list, but the prose was written for people. A change of wording could silently change the expected steps.
3. Put a block of steps at the top of each phase guide. The list sits next to the prose it describes, and a program reads it with a few fixed rules. This is the option we chose.

## Decision

We use option 3. The block sits at the very top of a phase guide.

- Line 1 is exactly `<!-- mandatory steps`. The first later line that is exactly `-->` closes the block. Because the block is inside an HTML comment, a Markdown viewer does not show it.
- Each line between them is one step, written `<kind>: <text>`. A step can end with ` | <condition>`.
- A guide that does not open with that line has no block. Reading it gives an empty list. An empty block is refused, because every phase ends with at least `cstack next --done <phase>`.

A step has one of three kinds.

- A `command` step names a `cstack` command. Its text starts with `cstack ` and keeps the placeholders that the guides use, such as `<n>` and `<plan file>`.
- A `helper` step names a helper prompt, written `<skill>:<name>`, for example `resolve-issue:cto-review`. It can be followed by one space and one word for the moment or the focus of the helper.
- An `action` step is one id, such as `approval-gate`, for a step that is not a command and not a helper.

A condition says how often a step applies. Only these seven are accepted.

- `each-unit` repeats the step once for each unit of the plan.
- `each-unit-with-test` repeats it for each unit that has a `Test` line.
- `each-stuck-unit` repeats it for each unit that an implementer reported stuck.
- `each-negative-criterion` repeats it for each negative criterion that a unit covers. It matches nothing until the plan format that ticket #98 builds exists.
- `each-dependent-ticket` repeats it for each ticket that the "Feeds" part of the ticket footer names.
- `user-interface` applies the step once when a unit has a `Design specification` line.
- `new-structural-decision` applies the step once when the plan does not hold the sentence "No new decision since the question round".

In an `each-` step, `<n>` stands for the number of the unit.

The blocks will name no `resolve-issue:code-explorer` step and no `resolve-issue:code-architect` step. Whether a ticket needs them is a judgment, so a block cannot list them as mandatory. The independent review is written with no condition, because the acceptance criteria expect it whatever the reviewer.

The reader is `readSteps()` in `cstack/src/guide-steps.ts`. It takes the text of a guide and a name for its messages, never a path, so the audit can read a guide from an older commit. It stops at the first problem and says the line of that problem. The same module checks that each command exists and that each helper has a prompt.

`cstack guide` and `cstack next` leave the block out when they print a guide, because the block is for programs and not for the agent that reads the guide. When the block is not valid, they print nothing on standard output and exit with code 3.

## Consequences

The expected steps now live in the guides, next to the prose, and a test fails when a block names a command or a helper that does not exist. Ticket #88 writes the real blocks. Ticket #90 evaluates the conditions.

A person who edits a guide must keep its block true. The test catches a missing command or helper, but it cannot tell that a step is no longer needed.

Some tests read the raw guides, so they will see the blocks once ticket #88 adds them. Ticket #88 must check them.
