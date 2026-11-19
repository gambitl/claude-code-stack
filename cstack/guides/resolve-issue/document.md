# Document

In this phase you write down what happened, in the ticket, in the dependent tickets and in the documentation tool. An undocumented ticket is not done. The settings that `cstack next` printed above this guide apply. They win over any default here. Write every text as the writing guide asks, in the `recordsLanguage` setting.

You write in the tracker and the documentation tool, through their direct connections. These writes are not commits, so they start no checks.

## Write back into the ticket

Add one comment to the ticket. Someone who opens the ticket in six months should understand what happened without reading the code. Say what the pull request body will carry, what was left out of scope, and anything that differs from what the ticket asked for. If the tracker has a field for a resolution note, fill it too.

## Hand the context down

Read the ticket's `Feeds` footer and the "blocks" relations of the tracker. For every ticket that depends on this one, add a comment that helps it start well. Name the interfaces, schemas, functions or files it will build on, and where they are. Name the decisions that constrain it, and the assumptions it must not break. Add any follow-up from the "Review log" that lands in its area. Write it for the person or agent who will resolve that ticket, and do not copy the first comment. If its description is now wrong because of what was built, say so, and fix the description when the tracker allows it.

## Record every big decision

A big decision is the architecture choice, every line of "Decisions" that changed the design, and any decision taken from a needs-decision report. Each one becomes a decision record, or an update to an existing one, where the plan file says the records live. A record holds the context, the options, the choice, the reason, the consequences and a link to the ticket. The `publish` phase adds the pull request link later.

Also write each decision next to the code it governs, as a `WHY:` comment that names the record, for example `WHY: ADR-157 ...`. The next ticket's code mapping then finds it.

Then update the pages that this change made wrong, runbooks and glossary included. The plan's "Documentation duties" lists them. If there is no documentation tool at all, the records go into `docs/decisions/` in the repository. Commit them on the branch.

## Record the places

Write every place you wrote to, with its link, into the plan file's "Documentation" section.

## End of the phase

Run `cstack next --done document --plan <plan file>`.
