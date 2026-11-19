# Settled decisions and models

This file holds the models of each role, the decisions that the user settled on purpose, and the lessons applied by the digest. Claude does not load it at the start of a run.

## Models and thinking levels

Each prompt in `agents/` starts with a header that names the model and the thinking level of its role. The split is deliberate. Roles where a missed problem would ship, or whose output the user reads, run on the strongest model. Roles that follow a precise, approved plan run on a faster model with less thinking. This conversation, which does the planning, keeps the user's own session settings.

| Role | Prompt | Model | Thinking level |
|---|---|---|---|
| Executor (the build, the documentation and the `publish` phase) | `executor.md` | Sonnet | medium |
| One implementation unit | `implementer.md` | Sonnet | medium |
| Second attempt at a unit that got stuck | `implementer-escalation.md` | Opus | high |
| Code review, conventions focus | `code-reviewer.md` | Sonnet | medium |
| Code review, simplicity focus | `code-reviewer-simplicity.md` | Sonnet | medium |
| Code review, correctness focus and security focus | `code-reviewer-deep.md` | Opus | high |
| Independent review of the finished branch | `pr-reviewer.md` | Opus | high |
| CTO advisor, at all three moments | `cto-review.md` | Opus | high |
| Wider code exploration (`code-map` phase) and architecture blueprints (`plan` phase) | `code-explorer.md`, `code-architect.md` | the session's model | the session's level |

When the harness can load these prompts as named agents, launch the named agent and do not pass a model, so the header decides. In Claude Code this folder loads as the plugin `resolve-issue`, and the agents are named `resolve-issue:<name>`, for example `resolve-issue:cto-review`. When the harness cannot, launch a fresh sub-agent with the prompt file, and use the table's model and level if the harness lets you choose them. Never launch one of these roles as a generic sub-agent with a model of your own choosing. The reshaping of a hand-written ticket in the `ticket` phase has no prompt file and uses a generic fresh sub-agent.

## Settled decisions

The choices below were settled by the user on purpose. The `digest-retros` skill never rewrites one of them as an ordinary change. When the retrospectives challenge one, the digest presents the evidence and what the decision protects, and asks the user; reopening a settled decision is always the user's call, and it is a legitimate call when the evidence is strong. Each line says what the decision protects.

- One approval gate, in the `plan` phase, with explicit approval only. It protects the user from a build started on a half-understood plan.
- The executor hand-off of the `plan` phase, with three reports and no conversation with the user. It protects the main context from filling up, because a skill cannot compact the conversation on its own.
- The hard stop on hand-written tickets that miss a section, in the `ticket` phase. It protects the plan from guesses nobody reviewed.
- Agents map the code themselves with search and file reads, and no code graph tool is used (settled 2026-11-19, replacing the Graphify-first decision of 2026-10-05). Nothing has shown that a code graph tool finds code better than an agent that searches and reads files on its own, or that it saves tokens. It protects the runs and the install from a tool whose benefit was never proven.
- Tool-agnostic wording: the conventions file, the tracker, the forge, a fresh sub-agent, the harness's question tool. It protects the portability of the skill across harnesses and trackers.
- Two blocks always shown in full, "Questions you may not be asking" and "What you should know about what was built". Each block has a short version of about 400 words, which is the one shown, and its details stay in the plan file (settled 2026-11-03, after the team said they could not read the long blocks to the end). They protect a developer who has not read what the run read. Showing a block in full only protects anyone when it is short enough to be read to the end.
- The ticket is copied verbatim into the plan file, never summarised. It protects the plan from a lossy reading of the ticket.
- The plan file has a working part and a History part, "Decisions" is the one list of what was decided, and each helper reads only the sections its prompt names (settled 2026-11-03). It protects the cost and the focus of the helpers. Before this, every implementer read the whole plan, of which its unit needed only a small part, and the same question could appear four times in it.
- Front-end units need an approved design specification or are blocked. It protects the product from designs invented by the agent.
- The conversation follows the user's language, and every record that stays uses the records language of the settings, which is English by default. Records are the plan file, the pull request and the ticket comments (settled 2026-11-03, replacing "English only, everywhere"). It protects the readability of the record for the whole team, and it lets each developer read the questions in their own language.
- Every text a person reads follows the writing guide, `writing.md` (settled 2026-11-03). It protects the team from texts too long and too formal to be read, which was the main complaint after heavy use of this skill. A change to the guide is an ordinary change for the digest, but removing it is not.
- The model and thinking level of each role, set in the headers of `agents/` and listed under "Models and thinking levels" (settled 2026-10-04). It protects quality where a miss would ship or where the user reads the output, while keeping routine work fast and cheap. Retrospectives that show a faster role repeatedly missing what a later step caught are the evidence for raising that one role. Amendment: the settings file can change the agent and the model of the independent review only, and its thinking level stays in the header. The reasons are in ADR-SIC-D, at `https://github.com/gambitl/claude-code-stack/blob/main/docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`.
- Blocking questions are answered before the plan, by a test when the run can do one and by asking otherwise, and the plan waits for the answers. A blocking question found after the build stops the run before the pull request opens. A non-blocking question appears in the pull request only under the heading "Open questions, not needed for this pull request", after the user has seen it (settled 2026-10-22, after a merge request that carried many questions to another team that the user had never seen as such). It protects the user from questions sent in their name without their knowledge, and the plan from being built on an unanswered question.
- Every commit stays on the local branch until the `publish` phase, which makes one push that opens a pull request that is already final (settled 2026-10-05). The command `cstack publish` now enforces this single push. The independent review therefore reviews the local branch, and the retrospective is written before the push. It protects the forge's CI minutes, because every push to an open pull request starts the checks again for the whole pull request.
- The guides come from cstack one phase at a time, and the skill has no prose fallback when cstack is missing (settled 2026-11-18). It protects the size of the entry skill and the single source of the phase rules, because a copy of the guides in the skill would drift from the real ones.

## Lessons applied

One line per change applied by `digest-retros`, dated, newest last. The text before and after each change lives in the digest file that applied it, under `docs/retros/reviewed/` in the repository where it ran; that file is the undo.

- 2026-11-19: the `plan` guide and the plan template copy each open non-blocking question of the question round under `## Non-blocking questions`. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `questions` guide and the advisor's prompt put each blocking point of the advisor under `## Blocking questions`. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `questions` guide says that a default about another tool, another command or two processes at once is never obvious. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `plan` guide gives each behaviour and its test to the same unit. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `plan` guide puts on the `Files` line the files that the tests of every command or every skill will change. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `plan` guide writes the coordinator's messages into `## Decisions` before the approval gate. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `build` guide says that the executor never builds a unit itself. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `after-build-questions` guide says what to do when the run comes back with answers. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the executor's prompt writes each Hand-off log entry and each executor note only once. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the implementer's prompt forbids source code before `cstack unit red` and forbids moving code aside to get a failure. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the implementer's prompt accepts a missing new module as the expected first failure. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the implementer's prompt asks for a test case for each behaviour, exit code and message. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the implementer's prompt forbids `git stash` and `git commit --amend`. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
- 2026-11-19: the `ticket` guide loses three sentences that other parts already say, which frees room for ticket #31. It comes from `docs/retros/reviewed/2026-11-19-digest.md`.
