<!-- mandatory steps
action: write-non-blocking-questions
command: cstack next --done after-build-questions --plan <plan file>
-->

# Questions after the build

In this phase you sort the questions that the build raised and nobody has answered. The settings that `cstack next` printed above this guide apply. They win over any default here.

## Collect

Collect every open question from the reviews of the `review` and `independent-review` phases and from the briefing. The briefing's questions are in its details, in the plan file. Include every "ask R&D" or "ask the other team" that a reviewer or the advisor recommends.

Label each question with the plan's definition.

- A question is blocking when its answer can change what was built or written, or whether the acceptance criteria are met.
- A question is non-blocking when the work stays complete and correct whatever the answer.
- When in doubt, the question is blocking.

## Blocking questions

If you can test the question, test it. You can run the code or the tests, make a free sandbox or staging call that the conventions file allows, or read the source of the system involved. Never make a paid or production call. Record the evidence in the "Review log", apply the result with a commit, and the question is closed.

If you cannot test it, add it under `## Blocking questions`. If the section holds the word "none", remove that word first. Write a heading `### Question <n>: <a few words>` with the next free number. Under it, write the question word for word, with its context. Then write a line `- For: <who can answer it>` and a line `- Answer: open`. Finish every part of the build that does not depend on the answer. Do not run `cstack next --done after-build-questions` as if nothing was open. Return a needs-decision report that starts by saying these are blocking questions found after the build, and gives each question word for word.

## When you come back with answers

You run this phase again after a needs-decision report, once the answers are under `## Blocking questions`. Apply each answer first. When an answer needs code, add a unit for it, and build it with an implementer as `cstack guide build` says. Then run the reviews that the change calls for, as `cstack guide review` says, on the new commits only, and write them into the "Review log". Last, correct each sentence of the "Briefing" that the answers made wrong.

## Non-blocking questions

Add each one under `## Non-blocking questions`, word for word, with who it is for. When there is none, write the word "none". These questions go into the pull request body under its own heading, and into your done report. Never add a question for someone else anywhere else.

## End of the phase

Run `cstack next --done after-build-questions --plan <plan file>` in the same shell call as the last command of the phase, or in the same answer as its last edit, as your prompt says. It needs the "Non-blocking questions" section filled.
