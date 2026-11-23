<!-- mandatory steps
action: check-the-settings-file
helper: resolve-issue:pr-reviewer
command: cstack next --done independent-review --plan <plan file>
-->

# Independent review

In this phase a reviewer who saw nothing of this run reads the finished branch. The settings that `cstack next` printed above this guide apply. They win over any default here.

## Check the settings first

The settings are read from the file on disk, not from a committed copy. A branch that edits `.cstack/settings.json` could choose its own reviewer. So first run `git diff --name-only <target branch> -- .cstack/settings.json`. It compares the target branch with your working tree, so it also shows changes that are not committed. Also run `git status --porcelain -- .cstack/settings.json`, which shows a file that git does not track yet.

When either command prints something, look in "Decisions" for a line that accepts this change. If there is none, return a needs-decision report. Name the change, and ask the user to confirm it.

## Launch the reviewer

The `review` setting names the agent and the model of the review.

- When the agent is `claude`, launch `resolve-issue:pr-reviewer`. Pass a model only when `.cstack/settings.json` has a `review` key. When it has none, pass no model, so the header of the prompt decides.
- Any other agent name is started only through a launcher that the harness offers for that exact agent, such as an Orca worker. Never run the name as a command. When the harness offers no launcher for it, return a needs-decision report that names the agent.

Give the reviewer only the repository path, the branch name, the plan file path and the conventions file path. It reviews the local branch against its target, because the pull request does not exist yet.

## After the review

1. Read its report.
2. If it changed code, run the commands of the `testCommands` setting again, and update the "Review log".
3. Write the judgment calls it raises into the "Review log". They go into the pull request body.

## End of the phase

Run `cstack next --done independent-review --plan <plan file>`.
