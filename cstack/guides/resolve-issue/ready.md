<!-- mandatory steps
action: draft-pull-request
action: write-executor-notes
command: cstack next --done ready --plan <plan file>
action: commit-plan-file
command: cstack helper done done --helper <helper id> --plan <plan file>
-->

# Ready for review

In this phase you draft the pull request and close the build. You can start it only when no blocking question is open. The settings that `cstack next` printed above this guide apply. They win over any default here.

## Draft the pull request

Fill the plan file's "Pull request" section with a `Title:` line, then the body in a fenced block that opens with four backticks and the word `markdown`, and closes with four backticks. The title follows the commit format of the conventions file.

Write the body as the writing guide asks, for a reviewer who did not follow the session. Keep it short, because the reviewer reads it before the diff. It says what was built, the key decisions and why, the files touched, and any risk accepted at the dependency gate. It adds the judgment calls from the independent review, the review findings left as follow-ups, and the plan file path. It ends with the closing reference that the tracker understands: `Fixes ENG-123` for Linear, `Fixes #123` for GitHub, `Closes #123` for GitLab. If the conventions file says that this reference does not fire on the target branch, say that the ticket must be closed by hand after the merge.

When non-blocking questions stay open, add one heading, "Open questions, not needed for this pull request", and use the forge's own word, "merge request" on GitLab. Say in one sentence that it can be merged without their answers. Copy each question with who it is for. If there is none, leave the heading out.

## Close the build

1. Write the executor notes and a dated entry in the "Hand-off log", as your prompt says. Then run `cstack next --done ready --plan <plan file>`. It needs the "Pull request" and "Executor notes" sections filled. It writes the Status `ready for review` and its time into the plan file.
2. Commit the plan file. The done report is refused while the plan file has an uncommitted change.
3. Submit the done report with `cstack helper done done --helper <helper id> --plan <plan file>`.
