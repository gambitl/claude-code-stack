# Phase `dependencies`: check what blocks the ticket

This phase reads the blockers of the ticket. It writes the result under `## Dependencies` in the plan file.

List the blockers from the relations of the tracker. When the tracker has none, list them from the "Blocked by" part of the ticket footer. Then fetch the status of each blocker.

A blocker that is done, cancelled or a duplicate is satisfied. A blocker with any other status is open.

When nothing blocks the ticket, write `clear` under `## Dependencies`. Then run `cstack next --done dependencies`.

When at least one blocker is open, stop and tell the user about each one. For each open blocker, give its status in plain words. Say also what could go wrong if the work starts now. Then ask the user to choose one of three answers:

- Switch to the most upstream blocker.
- Go on anyway, because the dependency is soft.
- Stop.

When the user goes on anyway, write the open blockers and that decision under `## Dependencies`. Record it as a risk in the plan file. Keep it for the pull request too. Then run `cstack next --done dependencies`.

When the user chooses to switch, or to stop, keep the plan file. Do not commit it and do not delete it. Tell the user the path of the plan file, so that `cstack next` can resume the run later. Then run `cstack next --phase retro`.
