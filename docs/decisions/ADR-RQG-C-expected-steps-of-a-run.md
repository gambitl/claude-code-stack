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

A condition says how often a step applies. Only these eight are accepted.

- `each-unit` repeats the step once for each unit of the plan.
- `each-unit-with-test` repeats it for each unit that has a `Test` line.
- `each-stuck-unit` repeats it for each unit that an implementer reported stuck.
- `each-negative-criterion` repeats it for each negative criterion that a unit covers. It matches nothing until the plan format that ticket #98 builds exists.
- `each-dependent-ticket` repeats it for each ticket that the "Feeds" part of the ticket footer names.
- `user-interface` applies the step once when a unit has a `Design specification` line.
- `new-structural-decision` applies the step once when the plan does not hold the sentence "No new decision since the question round".
- `big-decision` applies the step once when a line of the `Documentation duties` section of the plan says that a decision record applies. The section "How the audit checks the big decisions" below explains it.

In an `each-` step, `<n>` stands for the number of the unit.

The blocks will name no `resolve-issue:code-explorer` step and no `resolve-issue:code-architect` step. Whether a ticket needs them is a judgment, so a block cannot list them as mandatory. The independent review is written with no condition, because the acceptance criteria expect it whatever the reviewer.

The reader is `readSteps()` in `cstack/src/guide-steps.ts`. It takes the text of a guide and a name for its messages, never a path, so the audit can read a guide from an older commit. It stops at the first problem and says the line of that problem. The same module checks that each command exists and that each helper has a prompt.

`cstack guide` and `cstack next` leave the block out when they print a guide, because the block is for programs and not for the agent that reads the guide. When the block never closes, they print nothing on standard output and exit with code 3. They do not check the steps, so that a run never gets stuck on a guide that it cannot print.

## How a block chooses its steps

This section was added when ticket #88 wrote the real blocks. It adds to the record above and changes none of its decisions.

A block lists every `cstack` command that the prose of its guide requires. It also lists every named helper that the prose requires.

A block adds one `action` step for each other deed that someone can check later. A deed can be checked later in three cases. It writes something, such as a plan section, a file or a commit. It runs a check that the guide requires, such as the tests or the fetch of the target branch. Or it stops and waits for the answer of the user.

Reading, searching and looking at the history are not steps. They leave nothing behind, and how much to read is a judgment. Telling the user something without waiting for an answer is not a step either. A note that records another step belongs to that step.

A block describes a run that reaches the end of its phase on the normal path. On that path, each command succeeds, no unit is stuck and the user approves. A step that belongs to another path is left out. For example, a command that exits with another code, a command that refuses, a stop, and an open blocker all belong to other paths.

A step that the prose makes conditional is left out. The one exception is a step whose condition is one of the conditions listed in the Decision section above. So a block never lists a step for a condition that the format cannot say.

A block writes each command as the prose of its guide writes it, with the same placeholders. It lists the steps in the order in which a run does them.

When two guides name the same step at the same point of a run, the step goes only into the block of the guide that the run follows at that point. For example, the start and the wait of the helper that runs the publish phase go into the block of the retro guide, and not into the block of the plan guide.

The `cstack helper start` commands stand for the executor and the implementers until milestone R2 of the epic that ticket #88 belongs to. A sub-agent starts only when that command exits with code 6, and with Orca the helper is a worker instead. So the blocks list the commands and no `helper:` step for these helpers. Milestone R2 replaces the commands with `helper:` steps.

The block of the build guide lists `cstack unit red`, `cstack unit green` and `cstack unit commit` in their short form, with `<n>` and without the extra flags. The audit checks exactly these three commands for each unit.

## Consequences

The expected steps now live in the guides, next to the prose, and a test fails when a block names a command or a helper that does not exist. Ticket #88 writes the real blocks. Ticket #90 evaluates the conditions.

A person who edits a guide must keep its block true. The test catches a missing command or helper, but it cannot tell that a step is no longer needed.

Some tests read the raw guides, so they will see the blocks once ticket #88 adds them. Ticket #88 must check them.

## How the audit judges helper steps and conditions

This section was added when ticket #90 made `cstack audit` evaluate the helper steps and the conditions. It adds to the record above and changes none of its decisions.

The audit prints one line for each helper step whose condition holds. Only a launch of the named sub-agent proves a helper step. A plan section never proves it. A launch of another type, and a message sent to a running sub-agent, never count, because the guides ask for a fresh launch. When the setting `review.agent` is not `claude`, the independent review also accepts an Orca worker launch.

The audit never prints a line for a step of the `action` kind, except for two steps of a big decision. See the section "How the audit checks the big decisions" below. The close of most phases already refuses an empty plan section, so the audit does not repeat that check.

The audit lists a step only when its condition holds. The condition `each-dependent-ticket` repeats the step once for each ticket that the `Feeds:` line of the ticket names. The conditions `user-interface`, `new-structural-decision` and `big-decision` list the step once, or not at all. The conditions `each-stuck-unit` and `each-negative-criterion` count as false for now, so their steps are never listed.

One call or one launch serves at most one line. This stops a single wait or a single launch from proving several steps. The phase lines take no call, so a phase line and the `cstack next --done` step of the same phase still share their call.

Two limits are known. The sentence "No new decision since the question round" is searched in the whole plan text, so a plan that only quotes it hides the step. The time windows of two phases can overlap, so a missing launch can be blamed on a neighbouring line. The exit code is still 1 in that case.

## How the audit treats the phases that are not over

This section was added when ticket #91 made the retro phase run `cstack audit`. It adds to the record above and changes none of its decisions. See the ticket at https://github.com/gambitl/claude-code-stack/issues/91.

When the retro phase runs the audit, the retro phase and the publish phase are not closed yet. The time window of a phase ends at the next close of a later phase. So the window of retro never ends. A call of an earlier phase can then show up as a step of retro, and the audit printed a false "done" for it in an earlier run.

The audit now leaves out every line of the phases that are not over. These phases are the first phase, in the order of the phase list, that the run state does not mark as done, and every phase after it. When at least one phase is left out, the audit prints one fixed sentence on standard error that names them. The exit code looks only at the lines that were printed. A finished run is audited as before.

The options were these. The audit could print the left-out lines with a fourth verdict, "not checked yet". The retro guide could ask the agent to remove the lines by hand. Or nothing could change. We rejected the fourth verdict, because the line format is an interface that `digest-retros` will read. We rejected the removal by hand, because it breaks "the lines as the command printed them", and an agent can copy a long list wrongly. We chose to leave the lines out.

The filter runs after the lines are computed, in `cstack/src/commands/audit.ts`, and does not change the time windows in `cstack/src/audit/evaluate.ts`. This is safe, because the phases are evaluated in order and one call serves one line only. So a later phase never takes a call away from an earlier one. It also keeps away from the code where most recent commits were fixes for those windows.

The filter finds the phase of a line from the text of the line. A line belongs to the phase when its text is the phase line, the start line, or starts with the phase name, a colon and a space. A later change could give each line a phase field instead.

One limit is known. A run that stops for good never closes its last phase, so the audit never shows the steps of that phase. The sentence on standard error makes this gap visible.

## How the audit checks the big decisions

This section was added when ticket #118 made the audit check the big decisions of a run. It changes two rules of this record. The list of conditions now has eight, because of `big-decision`. And the audit no longer never prints a line for an `action` step, because it now prints one for two of them.

A big decision is a decision that the plan says it records. The plan says so in its `Documentation duties` section. The condition `big-decision` holds when one line of that section names a decision record before its first colon and says "applies" right after that colon. The line names a record when the text before the colon holds the word "ADR" or "decision record", in any case, as whole words. A plural counts too. The line says "applies" when the text after the colon starts with that word, in any case. A line of another section never makes the condition hold. The placeholder of the plan template never makes it hold either.

The document guide has two `action` steps with this condition, `write-decision-record` and `write-why-comment`. The audit prints a line for them only when the condition holds. It proves them with git, not with a call, because both are deeds that leave a commit.

The record counts as written when a commit of the branch adds or changes a `.md` file that the duty line names in backticks. The commits of the branch are the commits of HEAD that are not on the target branch. When the line names no such file, the record lives outside the repository, git cannot check it, and the audit prints no line for it. A file that does not exist at HEAD still counts as a file to look for. So a run that promised a record and never wrote it shows "skipped".

The `WHY:` comment counts as written when a commit of the branch adds a line that holds `WHY:` and the name of a record. The file of that line must not end in `.md`. A removed line never counts.

The name of a record comes from the `.md` file of the duty line. It is the leading part of the file name that is made of capital letters, digits and dashes, without its trailing dashes. So `docs/decisions/ADR-RQG-C-expected-steps-of-a-run.md` gives `ADR-RQG-C`. When the line names no such file, the name is the text before the first colon of the line.

The two lines take no part in the order of the phase. They set no floor for a later step, no earlier step sets a floor for them, and no time window limits them. The reason is that a record is often committed by a unit during the build, long before the document phase starts. With a window, that run would show "out of order" for good work. So the lines print among the command lines, in the order of the block, before the helper lines.

When git fails, for example because the target branch does not exist, both lines are skipped. The audit does not stop for that.

One limit is known. The audit still lists the `WHY:` step for a decision that governs no code, such as a change to a guide only. The retrospective judges a "skipped" there. Another limit is that the words "applies", "ADR" and "decision record" are English.

## How the executor closes a phase

Each answer of the executor makes the model read its whole context again. So the executor does not spend an answer only on closing a phase. It runs `cstack next --done <phase> --plan <plan file>` in the same shell call as the last command of the phase, joined with `&&`. When the phase ends with an edit of the plan file, it sends the close in the same answer, as a second tool call right after the edit.

The audit still finds such a close. Its shell reader ends a simple command at `&&`, so a joined close is one `cstack` call of its own. The test file `cstack/test/audit-chained-close.test.ts` proves it with two cases. In the first, a commit and the close of review share one call. In the second, the close of publish and the submit of the report share one call.

This section adds to the record and changes none of its decisions. The command of each block of mandatory steps stays the same.

## How the audit reports the check of the whole test file

This section was added when ticket #100 made `cstack unit red` and `cstack unit green` check each named test case. A run checks the whole test file instead when the settings declare no per-case report, or when the report is missing or cannot be read. The saved run then records this and the reason.

The audit prints one line for each unit that used this check. The line says which run it was and gives the reason. These lines are a new kind of line. They are not part of the blocks of mandatory steps, so no step of a guide asks for them.

These lines have no verdict. The audit never marks them as done, skipped or out of order, and they never change the exit code. The reason is that a repository without a per-case report always uses the whole test file. If the lines had a verdict, every audit of such a repository would fail. The check of the whole test file is a known and allowed fallback, so the audit only shows it.

The code is in `cstack/src/audit/whole-file.ts`. The sentence "The exit code looks only at the printed lines" in the README stays true, because these lines are not verdict lines.
