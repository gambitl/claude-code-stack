<!-- mandatory steps
command: cstack publish --plan <plan file>
command: cstack next --done publish --plan <plan file>
command: cstack report submit published --plan <plan file>
-->

# Publish

In this phase you push the branch once, open the pull request, and wait for the checks. The settings that `cstack next` printed above this guide apply. They win over any default here. Only `cstack publish` pushes. Read only these sections of the plan file: its header, "Blocking questions", "Pull request", "Documentation" and "Executor notes". The part "Exit code 1" below names more sections for one case.

## The plan file

In this phase, write to the plan file only inside a fix commit that you push. Any other edit would stay unpushed after the run.

Run `cstack publish --plan <plan file>`. It refuses before a push when something is wrong, brings the branch up to date, pushes, opens the pull request with the title and body of the plan file, and waits for the checks. Act on its exit code.

## Exit code 0

The checks are green.

1. Move the ticket to "in review", if the forge did not do it already. Run `cstack tracker move '<key>' --to "in review" --tracker <name>`. Write the key in single quotes. Take `<name>` from the `Tracker:` line of the plan file, in lower case.
   - If cstack refuses the state name, it prints the names that the tracker accepts. Run the command again with one of those names.
   - If cstack exits with 1 because a label is missing, it prints the command that creates it. You never create a label. Say in your published report that the ticket could not be moved, and copy the printed command.
   - If cstack exits with exit code `4`, no client can reach the tracker. Move the ticket with your own connection instead.
2. Add the pull request link to every decision record written in the `document` and `briefing` phases that lives in a documentation tool. These are edits in that tool, not commits. A record that lives in the repository does not get the link, because that would need another push. The forge and the ticket carry the link for it.
3. Run `cstack next --done publish --plan <plan file>` in the same shell call as the submit of step 4, joined before it with `&&`.
4. Submit the report with `cstack report submit published --plan <plan file>`, with the report on standard input. Then end with the same report as your final message. The report gives the pull request link and the state of the checks, because the main conversation passes them on.

## Exit code 6

A check failed. Fix it test-first, in a new commit. In the same commit, add one line about it to the plan file's "Executor notes", and one item to the retrospective's "Improve" heading, following the rules of the retrospective template. Fix a real security finding the same way. Document a false positive in the pull request body. Then run `cstack publish --plan <plan file>` again. If you cannot make a check green, submit a failed report that names it.

## Exit code 7

The checks still run. Submit the `published` report as above, and say that the checks still run.

## Exit code 8

The target branch moved and the update conflicts. You did not read the `update-branch` guide in this run, so print it with `cstack guide update-branch`. Resolve the conflict as it says, and commit. On an ambiguous conflict, return a needs-decision report. Then run `cstack publish --plan <plan file>` again.

## Exit code 1

Read the reasons. A blocking question that is still open leads to a needs-decision report that lists it. Fix any other reason, and run the command again.

A reason can say that a unit has no commit with its trailer and no Blocked line. Then the plan has a unit that nobody built or blocked. Read `## Decisions`, `## Implementation units`, "Review log" and "Briefing" in the plan file. Build that unit with an implementer, as `cstack guide build` says. Run the reviews that the change calls for on the new commits only, as `cstack guide review` says. Write them into the "Review log". Correct the body under `## Pull request` and the "Briefing", because both were written before the unit existed. In one more commit, add one line about the unit to "Executor notes". In the same commit, add one item to the "Improve" heading of the retrospective, following the rules of the retrospective template. Then run `cstack publish --plan <plan file>` again. If you cannot build the unit, return a needs-decision report. Name the unit in it, and ask the user whether to block it.

## Exit codes 4 and 5

Exit code `4` means that the forge client is missing. Exit code `5` means that a push or a forge call failed. Submit a failed report that names the problem with `cstack report submit failed --plan <plan file>`.

When `cstack publish` exits with `0`, finish with `cstack next --done publish --plan <plan file>` and the `published` report.
