# Build

In this phase you start the work and build every unit of the plan. The settings that `cstack next` printed above this guide apply. They win over any default here.

## Start

1. Move the ticket to the tracker's "in progress" state. Use the exact state name that the tracker gives. Write in the plan file's "Hand-off log" that you did it. If the tracker has no such state, write that instead.
2. Create the branch named on the `Branch` line of the plan file, and check it out. Never work on the default branch. If the branch already exists, check it out and keep going.
3. Commit the plan file as the first commit of the branch, unless it is already committed.

## Build the units

1. Run `cstack unit order --plan <plan file>`. It prints the units in batches. A batch holds units that do not depend on each other.
2. Launch one `resolve-issue:implementer` for each unit of the first batch. Give each one the plan file path, its unit number and the conventions file path.
3. Run the units of a batch in parallel only when the settings give `testCommands.file`. Otherwise, launch one unit at a time. The units of a batch share one folder. A test run of the whole suite would see the test of another unit that is red on purpose.
4. Wait for every report of the batch. Then run `cstack plan status --plan <plan file>`. It shows which units are done. Start the next batch.

## When a unit gets stuck

When an implementer reports stuck, launch the same unit again with `resolve-issue:implementer-escalation`. Give it the same inputs and the stuck report. Write under the unit, in the plan file, that it was escalated, and every departure from the unit as written that the second attempt reports.

The second attempt may need a file outside the `Files` line of its unit. Add that file to the line, with a short note, only when no unfinished unit lists it. Then run `cstack unit order --plan <plan file>` again.

If the second attempt is also stuck, add a `- Blocked:` line to the unit, with the reason. Finish every unit that does not depend on it. Then return a needs-decision report.

A unit can stop because `cstack unit red` or `cstack unit green` exited with `3`, since the settings have no test command. Do not escalate it. Return a needs-decision report that quotes the message.

## User interface

When a unit changed a user interface, open or refresh the page with the browser tools of the harness. Walk the affected flow. Check it against the acceptance criteria and the approved design. Read the console. Repeat until it is right.

## End of the phase

Every unit needs a commit with its `Cstack-Unit` trailer, or a `- Blocked:` line. Run `cstack next --done build --plan <plan file>`.
