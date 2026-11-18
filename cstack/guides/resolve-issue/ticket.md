# Phase `ticket`: fetch the ticket

In this phase you read the ticket and create the plan file. No run exists yet, so a stop here is handled differently from a later stop.

If the user did not give a ticket id or URL, this is not a stop. Ask the user for one, then go on.

## Fetch the ticket

Fetch the ticket through the direct connection to the tracker. Capture its title, full body, status, labels and parent (project, epic or milestone). Also capture its relations to other tickets when the tracker shows them, and the branch name that the tracker suggests, if any.

Read the ticket once, in full. Do not summarise it.

## The ticket shape

Tickets come from the `create-tickets` skill. They have these headings, in this order:

- `## Why this matters (plain language)`, which ends with a line that starts with `**Goal.**`.
- `## Where things are today (read first)`, with files and line numbers, or the word greenfield. A ticket cut per layer also has a `**Contract**` line.
- `## Scope`.
- `## Acceptance (TDD)`.
- A footer line: `**Size: S/M/L** · Blocked by: … · Feeds: …`.
- Sometimes a last `## CTO review — …` block. Most tickets have none, and that is normal.

## Hand-written tickets

If a section is missing, start a fresh sub-agent. Ask it to reshape the ticket into these sections, except the CTO review block. It must quote the original wording and mark every section it could not fill or had to guess.

Then stop if a section is still missing, or if the sub-agent had any doubt about what the ticket means. Tell the user which sections are missing or unclear. Ask the user to fix the ticket in the tracker and to run the skill again.

Do not fill the gaps yourself. Do not ask the user to fill them in the conversation. Do not go on with a partial ticket.

## Create the plan file

Copy `templates/plan.md` from the skill folder to `docs/plans/<YYYY-MM-DD>-<ticket-id>-<short-slug-of-the-title>.md`.

Fill the header. Write the language that the user writes in on the `Conversation language` line. Write the default branch of the repository on `Target branch`, unless the ticket or the conventions file names another branch.

Copy the ticket under `## Ticket`, word for word. Move each of its headings down one level, so `## Scope` becomes `### Scope`. Change no word.

Under `### Decisions already taken upstream`, write the decisions block of the parent project. Add the titles and links of the ADRs that it names.

From now on every phase writes its results into this file.

## Close the phase

When the plan file is ready, run `cstack next --done ticket --plan <plan file>`.

## When you stop

No run exists yet, so print the retrospective guide with `cstack guide retro` and follow it. Skip its last step, which is `cstack next --done retro`, because there is no run to close.

Keep the plan file if you created it, and tell the user its path.
