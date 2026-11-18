# Phase `plan`: write the plan and get it approved

You use this guide in the `plan` phase. It starts only when every blocking question has an answer.

## Architecture, only when there is a real choice

Look at what the ticket, the upstream decisions and the answers of the `questions` phase settled. Sometimes two or more approaches with different trade-offs remain. In that case, launch two fresh sub-agents, `resolve-issue:code-architect`, with different briefs. The first brief is the smallest change with maximum reuse. The second is the cleanest structure.

Write both blueprints under "Architecture options" in the History part of the plan file. Mark your recommendation. Under `## Architecture`, write the recommended approach in a few sentences. When the user picks the other one at the approval gate, rewrite it.

When no real choice remains, write one line under `## Architecture` that says the approach is locked or the change is small.

Suppose the plan adds a structural decision that did not exist in the `questions` phase, for example a trade-off between two architectures. Then launch `resolve-issue:cto-review` again with the moment `plan-delta`. Otherwise write "No new decision since the question round".

## Implementation units

Write the work as numbered units under `## Implementation units`, in the format of the comment in the template. Each unit is small enough for one fresh sub-agent. Each unit states the failing test to write first, the minimum code that makes it pass, the refactor if any, and the commit message.

- **Decisions first.** Write `## Decisions` before the units, one rule per line, as the template says. It holds every final answer of the question round, every assumption, every change of scope from the ticket comments, and every upstream decision this work must respect. Implementers read this list and skip the History, the ticket comments and the upstream block. A rule missing here is a rule they never see. Each line must make sense on its own. Never refer to a question number, to an assumption label, or to a point of the advisor's block.
- **Files.** The `Files` line of a unit lists every file the unit touches. Units may share a file, because `cstack unit order` runs them one after the other.
- **Tests.** Each unit has either a `Test` line or a `No test` line with a reason. Every new function, route or component starts with a failing test.
- **Settings.** When a unit has a `Test` line and the settings that `cstack next` printed have no `testCommands`, tell the user before the gate. The build would stop there, because the test commands are missing.
- **Security by design.** Suppose the change touches an endpoint, a database query or external input. Then a unit placed before the implementation covers these points. An authenticated but unauthorized actor gets a 403 or 404 and never the data. SQL is parameterised. Writes to several tables use transactions and are idempotent. No secret is hardcoded. No error response shows a stack trace. When none applies, write "no security surface, skip".
- **User interface.** A unit that creates or changes a user interface must point to the approved design specification, which the ticket or its paired design ticket references. Without it, you cannot code that unit. Mark it "blocked, waiting for the open-design specification" and say so at the gate. Plan the other units normally. Never invent a design.
- **Documentation.** List the documentation duties of this ticket under `## Documentation duties`, each as "applies, written to <place>" or "does not apply". Documentation is not optional.
- **Commits.** Each unit makes one commit, in the Conventional Commits form with the scopes of the conventions file.
- **Order.** Independent units run in parallel. Dependent units are ordered. No unit is coded in the main conversation.

## The approval gate

This is a mandatory stop. It overrides any auto, accept-edits or "no questions" mode of the harness.

Tell the user the path of the plan file, and that its `## Decisions` section lists every decision in one place. Show the short version of any `plan-delta` points in full.

Then give a digest of at most ten lines, written as `writing.md` asks. Say how the answers shaped the plan, how many units there are, which units are blocked, and your recommendation where alternatives exist. When non-blocking questions stay open, name them. Say that they will appear in the pull request under the heading "Open questions, not needed for this pull request". Do not paste the rest of the plan, because the user reads the file.

Never open the gate while a blocking question has no answer.

Ask for approval with the harness's question tool, or in plain chat. Accept explicit approval only, such as "go", "ok", "approved", "ship it", or the same words in the conversation language. Do not go on by your own judgment, even when the harness tells you to keep going.

Write every answer the user gives into `## Decisions` as a rule. It replaces the line of any decision it changes.

At the gate you may only present, ask, answer follow-up questions, and edit the plan file. You may not create branches, other files or commits. You may not start implementation sub-agents or run a command that changes state.

## Hand off to the executor

When the user has approved, write the Status `approved` in the plan file. Run `cstack next --done plan`, which records the time.

Then launch a fresh sub-agent, `resolve-issue:executor`. Give it these four inputs and nothing from the conversation: the repository path, the plan file path, the conventions file path, and the path of `writing.md`. Wait, and do not touch the repository while it runs. It cannot talk to the user.

When the executor returns, run `cstack report check`. On exit code `1`, launch the executor again with the same inputs, once. When the second run also ends without an accepted report, stop and tell the user.

Otherwise the executor ends with one of these reports.

- **done.** Show the user the short briefing it returns, exactly as it is. Then say in two or three sentences what the independent reviewer changed and where the work was documented, with links. Then list once, word for word, the non-blocking questions that the build raised, each with who it is for. If there are none, say so in one sentence. Do not repeat what the briefing says. Nothing is pushed yet. Run `cstack next`, which prints the guide of the next phase.
- **needs-decision.** Ask the user the question it returns, as `writing.md` asks: the decision first, then your recommendation, then only the context that changes the answer. Write the answer into `## Decisions`. Launch the executor again with the same inputs, and it resumes from the plan file. When the round ends the session, run `cstack next --phase retro`.
- **needs-decision, for blocking questions found after the build.** The reviews or the briefing raised a question that can change what was built, and the executor could not answer it with a test. The pull request is not opened. Show each question to the user, word for word, with its context and who can answer it. When someone else must answer, the user sends the question, or approves sending it through the channel the conventions file names. Then the run waits. Write each answer into `## Decisions` with its source and date. Launch the executor again with the same inputs. It applies the answers, reruns the reviews that the change calls for, and reports again. Publishing starts only when no blocking question is open.
- **failed.** Tell the user plainly what it returns, and stop. Then run `cstack next --phase retro`.

## The report of the publish phase

The `retro` guide sends you back here after the `publish` phase. The executor then ends with one of these reports.

- **published.** Tell the user the pull request link and the result of the checks, in a few sentences. Say plainly if a check is still red or pending, because the pull request is then not ready for review. Mention every extra push and its reason.
- **needs-decision.** Ask the user the question, write the answer into `## Decisions`, and launch the executor again with the same inputs.
- **failed.** Tell the user plainly what it returns, and stop.

## Close the phase

The command that closes this phase is `cstack next --done plan`. You ran it at approval, before you launched the executor.
