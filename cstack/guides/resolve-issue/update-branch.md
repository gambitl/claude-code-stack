<!-- mandatory steps
action: fetch-the-target-branch
command: cstack next --done update-branch --plan <plan file>
-->

# Update the branch

In this phase you bring the branch up to date with its target. The settings that `cstack next` printed above this guide apply. They win over any default here. The `integration` setting says how.

## Update

1. Fetch the target branch.
2. If it did not move since the branch was created, there is nothing to update.
3. If it moved, follow the `integration` setting. With `rebase`, rebase the branch onto the target branch. With `merge`, merge the target branch into the branch.
4. Resolve each conflicting file by keeping the intent of the feature branch on top of the target. Apply any rule that the conventions file gives for files that conflict often. Then continue the rebase or finish the merge.
5. Run the commands of the `testCommands` setting again.

Nothing is pushed yet, so a rebase needs no forced update of a remote branch.

## A conflict that is ambiguous

A conflict is ambiguous when both sides changed the same logic in ways that cannot both hold. Do not guess. Describe the hunks in the plan file, in the "Hand-off log". Then return a needs-decision report.

## Checks before the push

Run every check that the conventions file asks for before a push, such as formatters and linters. Fix what they report. The one push of the `publish` phase should be green the first time.

## End of the phase

Run `cstack next --done update-branch --plan <plan file>` in the same shell call as the last command of the phase, or in the same answer as its last edit, as your prompt says.
