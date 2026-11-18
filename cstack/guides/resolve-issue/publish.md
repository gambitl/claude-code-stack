# Publish

In this phase you push the branch once, open the pull request, and wait for the checks. The settings that `cstack next` printed above this guide apply. They win over any default here. Only `cstack publish` pushes. Read only these sections of the plan file: its header, "Blocking questions", "Pull request", "Documentation" and "Executor notes".

Run `cstack publish --plan <plan file>`. It refuses before a push when something is wrong, brings the branch up to date, pushes, opens the pull request with the title and body of the plan file, and waits for the checks. Act on its exit code.

## Exit code 0

The checks are green.

1. Move the ticket to the tracker's "in review" state, if the forge did not do it already.
2. Add the pull request link to every decision record written in the `document` and `briefing` phases. These are edits in the documentation tool, not commits.
3. Run `cstack next --done publish --plan <plan file>`.
4. Submit the report with `cstack report submit published --plan <plan file>`.

## Exit code 6

A check failed. Fix it test-first, in a new commit. In the same commit, add one line about it to the plan file's "Executor notes", and one item to the retrospective's "Improve" heading, following the rules of the retrospective template. Fix a real security finding the same way. Document a false positive in the pull request body. Then run `cstack publish --plan <plan file>` again. If you cannot make a check green, submit a failed report that names it.

## Exit code 7

The checks still run. Submit the `published` report as above, and say that the checks still run.

## Exit code 8

The target branch moved and the update conflicts. Resolve the conflict as the `update-branch` guide says, and commit. On an ambiguous conflict, return a needs-decision report. Then run `cstack publish --plan <plan file>` again.

## Exit code 1

Read the reasons. A blocking question that is still open leads to a needs-decision report that lists it. Fix any other reason, and run the command again.

## Exit codes 4 and 5

Exit code `4` means that the forge client is missing. Exit code `5` means that a push or a forge call failed. Submit a failed report that names the problem with `cstack report submit failed --plan <plan file>`.

## The plan file

In this phase, write to the plan file only inside a fix commit that you push. Any other edit would stay unpushed after the run.
