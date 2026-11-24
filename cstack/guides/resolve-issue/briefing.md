<!-- mandatory steps
helper: resolve-issue:cto-review after-build
command: cstack next --done briefing --plan <plan file>
-->

# Briefing

In this phase the CTO advisor writes the briefing of what was built. The settings that `cstack next` printed above this guide apply. They win over any default here. The briefing runs after the documentation, so it can name the places where the work was documented.

## Launch the advisor

Launch `resolve-issue:cto-review` with the moment `after-build`. Give it the plan file path, the conventions file path, the writing guide path and the `recordsLanguage` setting.

It writes the block "What you should know about what was built" into the plan file's "Briefing" section. The block has a short version and the details. It returns the short version in the conversation language. Keep it unchanged for your report.

## A trade-off that needs a record

The advisor may raise a trade-off that needs a decision record. Write that record now, as the `document` guide says for a decision, and add its place to the "Documentation" section.

## End of the phase

The "Briefing" section must be filled. Run `cstack next --done briefing --plan <plan file>` in the same shell call as the last command of the phase, or in the same answer as its last edit, as your prompt says.
