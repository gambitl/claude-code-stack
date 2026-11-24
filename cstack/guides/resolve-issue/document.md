<!-- mandatory steps
command: cstack tracker comment '<key>' --body-file <file> --tracker <name>
command: cstack tracker comment '<key>' --body-file <file> --tracker <name> | each-dependent-ticket
action: write-decision-record | big-decision
action: write-why-comment | big-decision
action: write-documentation-places
command: cstack next --done document --plan <plan file>
-->

# Document

In this phase you write down what happened, in the ticket, in the dependent tickets and in the documentation tool. An undocumented ticket is not done. The settings that `cstack next` printed above this guide apply. They win over any default here. Write every text as the writing guide asks, in the `recordsLanguage` setting.

You write in the tracker with `cstack tracker comment`, and in the documentation tool with your own connection. These writes are not commits, so they start no checks.

## Write back into the ticket

Add one comment to the ticket. Someone who opens the ticket in six months should understand what happened without reading the code. Say what the pull request body will carry, what was left out of scope, and anything that differs from what the ticket asked for. If the tracker has a field for a resolution note, fill it too.

Write the comment into a file in a temporary folder outside the repository. Then post it with `cstack tracker comment '<key>' --body-file <file> --tracker <name>`. Take `<name>` from the `Tracker:` line of the plan file, in lower case. If cstack exits with exit code `4`, no client can reach the tracker. Post the comment with your own connection instead.

## Hand the context down

Read the ticket's `Feeds` footer and the "blocks" relations of the tracker. For every ticket that depends on this one, add a comment that helps it start well. Name the interfaces, schemas, functions or files it will build on, and where they are. Name the decisions that constrain it, and the assumptions it must not break. Add any follow-up from the "Review log" that lands in its area. Write each comment into a file in a temporary folder outside the repository. Post it with `cstack tracker comment '<key>' --body-file <file> --tracker <name>`, where `<key>` is the dependent ticket. Post each comment with its own `cstack tracker comment` call. Never post several comments in one loop of the shell, because the audit counts one call for each comment. If cstack exits with exit code `4`, post it with your own connection instead. Write it for the person or agent who will resolve that ticket, and do not copy the first comment. If its description is now wrong because of what was built, say so, and fix the description when the tracker allows it.

## Record every big decision

A big decision is the architecture choice, every line of "Decisions" that changed the design, and any decision taken from a needs-decision report. Each one becomes a decision record, or an update to an existing one, where the plan file says the records live. A record holds the context, the options, the choice, the reason, the consequences and a link to the ticket. The `publish` phase adds the pull request link later.

Also write each decision next to the code it governs, as a `WHY:` comment that names the record, for example `WHY: ADR-157 ...`. Write the short name of the record on the same line as `WHY:`. The next ticket's code mapping then finds it.

The audit of the run checks both from the commits of the branch. It does so when a line of the plan's "Documentation duties" names a decision record before its colon and says "applies". The record counts when a commit of the branch changes a `.md` file that this line names in backticks. The `WHY:` comment counts when a commit of the branch adds it in a file that is not a Markdown file.

Then update the pages that this change made wrong, runbooks and glossary included. The plan's "Documentation duties" lists them. If there is no documentation tool at all, the records go into `docs/decisions/` in the repository. Commit them on the branch.

## Record the places

Write every place you wrote to, with its link, into the plan file's "Documentation" section.

## End of the phase

Run `cstack next --done document --plan <plan file>` in the same shell call as the last command of the phase, or in the same answer as its last edit, as your prompt says.
