# Build

In this phase you start the work and build every unit of the plan. The settings that `cstack next` printed above this guide apply. They win over any default here.

## Start

1. Move the ticket to "in progress". Run `cstack tracker move '<key>' --to "in progress" --tracker <name>`. Write the ticket key in single quotes, because the shell reads an unquoted `#12` as a comment. Take `<name>` from the `Tracker:` line of the plan file, in lower case. Then write in the plan file's "Hand-off log" that you did it.
   - If cstack refuses the state name, it prints the names that the tracker accepts. Run the command again with one of those names.
   - If cstack exits with 1 because a label is missing, it prints the command that creates the label. You never create a label. Write in the "Hand-off log" that the ticket could not be moved, and copy the printed command there. Then go on.
   - If cstack exits with exit code `4`, no client can reach the tracker. Move the ticket with your own connection to the tracker instead. Write in the "Hand-off log" that you did it that way.
2. Check out the branch of the plan file. If you are already on a branch whose name is the short name that `cstack wave` gave the ticket, such as `issue-12` or `abc-12`, keep that branch and do not create a new one. Otherwise create the branch named on the `Branch` line of the plan file, and check it out. Never work on the default branch. If the branch already exists, check it out and keep going.
3. Commit the plan file as the first commit of the branch, unless it is already committed.

## Build the units

1. Run `cstack unit order --plan <plan file>`. It prints the units in batches. A batch holds units that do not depend on each other.
2. Launch one `resolve-issue:implementer` for each unit of the first batch. Give each one the plan file path, its unit number and the conventions file path. Never build a unit yourself, even one of a few lines, unless the harness cannot launch sub-agents. An implementer runs `cstack unit red` and `cstack unit green`, which prove that its test failed first.
3. Run the units of a batch in parallel only when the settings give `testCommands.file`. Otherwise, launch one unit at a time. The units of a batch share one folder. A test run of the whole suite would see the test of another unit that is red on purpose.
4. Wait for every report of the batch. Then run `cstack plan status --plan <plan file>`. It shows which units are done. Start the next batch.

## When a unit gets stuck

When an implementer reports stuck, launch the same unit again with `resolve-issue:implementer-escalation`. Give it the same inputs and the stuck report. Write under the unit, in the plan file, that it was escalated, and every departure from the unit as written that the second attempt reports.

Sometimes the second attempt needs a file outside the `Files` line of its unit. Check this case first. When no unfinished unit lists that file, add it to the `Files` line with a short note. Run `cstack unit order --plan <plan file>` again. Then launch the unit again with `resolve-issue:implementer-escalation`. When an unfinished unit does list the file, the unit is blocked.

When the second attempt is stuck for any other reason, or the unit is blocked, add a `- Blocked:` line to the unit, with the reason. Finish every unit that does not depend on it. Then return a needs-decision report.

A unit can stop because `cstack unit red` or `cstack unit green` exited with `3`, since the settings have no test command. Do not escalate it. Return a needs-decision report that quotes the message.

## User interface

When a unit changed a user interface, open or refresh the page with the browser tools of the harness. Walk the affected flow. Check it against the acceptance criteria and the approved design. Read the console. Repeat until it is right.

## End of the phase

Every unit needs a commit with its `Cstack-Unit` trailer, or a `- Blocked:` line. Run `cstack next --done build --plan <plan file>`.
