# Phase `questions`: one round of questions

You use this guide in the `questions` phase. It reads the "Scope" and "Decisions already taken upstream" parts of the plan file, and the "Code mapping" section.

First, read `writing.md` in the skill folder in full. This round is the first long text the user reads, so it must follow that guide.

The user is a developer of the team. They know the stack, but they have not read what this run read. Give them everything they need to decide well, once, in a message short enough to read to the end.

## Draft the open questions

Compare the ticket with the code. List what is genuinely undecided, such as edge cases, error handling, integration points, scope boundaries, backward compatibility and performance needs.

Filter hard. Drop a question when any of these answers it:

- The ticket, its CTO review block or its Contract line.
- The decisions of the parent project, or a linked decision record.
- A decision recorded in the code that the code mapping found.

When a question has an obvious default, do not ask it. Write the default under `## Decisions` as an assumption not asked.

When the conventions file names no documentation tool, add the question of where decisions and documentation are written.

Write the surviving questions under "Open questions and answers", in the History part of the plan file. Give each one your recommended answer. Keep the whole round there.

## Label each question

Label every question as blocking or non-blocking. A blocking question is one whose answer can change what you build.

For each blocking question, do two things. First, write it under `## Blocking questions`, in the shape of the comment in the template. Write `- Answer: open` until the question has its answer, its source and its date. Second, refer to it in "Open questions and answers" as "Blocking question <n>".

Then handle each blocking question before you go on.

- **The run can test it.** Test it now. Write the tested answer next to the question, with its evidence, such as the command, the run, or the file and lines you read. The question still goes to the user, as answered, so they can challenge the evidence.
- **The run cannot test it.** Write who can answer it. When it is someone else, such as another team, draft the question word for word for that person. Name the channel the conventions file gives for such questions. When it gives none, ask the user which channel to use.

A non-blocking question stays in the list with its label. It is either answered in this round, or recorded as "open, not needed for this ticket".

When the run has no blocking question, write the single word `none` under `## Blocking questions`. The command that closes this phase needs that section filled.

## Call the CTO advisor

Launch a fresh sub-agent, `resolve-issue:cto-review`, with the moment `before-plan`. Give it the plan file path, the conventions file path and the path of `writing.md`.

The advisor merges your draft questions with the blind spots the user is not asking about. It writes the block "Questions you may not be asking" in the History part of the plan file. It returns a short version in the conversation language.

## Ask once

Show the short version to the user exactly as the advisor returned it. Then wait. You may add one sentence of your own before it.

Do not list the questions again, before or after it. The block already holds each question once, sorted by what the user must do about it.

Treat the user's replies in this way. If the user says "whatever you think is best", state your recommendations and get an explicit yes. An item under "I will do this unless you say no" counts as answered when the reply does not object to it. Write "accepted by default" next to it in the plan file.

Write every answer into the plan file next to its question. For a blocking question, write the answer, its source and its date after `- Answer:`. If there is no question at all, show the short version, which then says so, and go on without stopping.

## Questions for someone else

A question for another person or team, blocking or not, reaches a pull request, a ticket or a message only if the user saw it word for word in this round. The user must also have seen whether it needs an answer before the plan or can wait. The same rule holds for the questions that the build raises later. Never let such a question appear for the first time in a recommendation, a briefing or a pull request body.

## No plan while a blocking question is open

cstack refuses the `plan` phase while any answer under `## Blocking questions` is open.

When the answer must come from someone else, the user sends the drafted question, or approves sending it through the channel you named. Then the run waits. Write "waiting for answers" in the Status line of the plan file.

When the user brings the answer back, write it next to its question with its source and its date. Check whether it changes other answers or assumptions. Then go on.

When the session has to end before the answer arrives, keep the plan file. Do not commit it and do not delete it. Say plainly what is waiting and for whom. Record the question where the conventions file says open questions are tracked. Tell the user the path of the plan file, so that `cstack next` can resume the run later. Then run `cstack next --phase retro`.

## Close the phase

When every blocking question has its answer, or the section holds `none`, run `cstack next --done questions`.
