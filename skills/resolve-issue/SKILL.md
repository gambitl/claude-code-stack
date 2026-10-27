---
name: resolve-issue
description: Take one ticket, from any tracker (Linear, Jira, GitLab, GitHub), all the way to a merge-ready pull request, then document the outcome in the ticket, its dependent tickets and the team's documentation tool. Use it whenever the user gives a ticket id or URL and asks to "resolve", "implement", "take", "start" or "work on" it.
argument-hint: ticket id or URL
---

# Resolve Issue

You are taking one ticket all the way to a pull request or merge request that is ready to review. The user has provided: $ARGUMENTS

Phases 0 to 5 run in this conversation and end with an approved plan. Phases 6 to 10 run in a fresh sub-agent, the executor, whose prompt is `agents/executor.md`; it receives only the plan file and reports back. All that work stays on the local branch. Phase 11, the retrospective, runs back in this conversation after every ending of the skill, whatever the ending was. Phase 12 launches the executor once more to publish: one push that opens a pull request that is already final. The conversation may then close with a visible notice that the digest is due. The planned stops for the user are three: a blocked ticket (phase 2), the question round (phase 4) and the approval gate (phase 5). Two more stops happen only when they are needed: waiting in phase 4 for the answer to a blocking question that nobody in the conversation can answer, and a blocking question found after the build, which stops the run before the pull request opens (phase 5.4). Two blocks are always shown to the user in full, because they teach them what they could not know to ask: "Questions you may not be asking" in phase 4 and "What you should know about what was built" at the end. Track the phases with whatever task list the harness offers.

## Vocabulary

- **The conventions file**: the markdown file at the repository root that says how the team works there, usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`. If there is none, or several and it is unclear which applies, ask the user.
- **The tracker** and its **direct connection**: the tool that holds the ticket (Linear, Jira, GitLab, GitHub or another), reached through an MCP server or a command-line client such as `gh` or `glab`. Detect it from the ticket id or URL, or from the conventions file; if unclear, ask. Never search the web or scrape a page for ticket content.
- **The forge**: the service hosting the code and the pull requests, such as GitHub or GitLab.
- **A fresh sub-agent**: a helper that starts with an empty context and receives only the prompt and inputs you give it. If the harness has no sub-agents, open a fresh session with the prompt file and paste its inputs. The prompts live in `agents/` next to this file, and each one is launched with the model and thinking level of its role (see below).
- **The plan file**: the markdown file in the repository that records everything about this ticket's resolution. It is the only thing that crosses from the first half of the workflow to the second, so it must always be complete enough to resume from.
- **The documentation tool**: where the team keeps long-lived documentation outside the code (Notion, Confluence, a wiki, or a `docs/` folder when there is nothing else).
- **A blocking question**: a question whose answer can change what the ticket builds or writes, or whether its acceptance criteria are met. A question whose answer leaves the ticket complete and correct either way is **non-blocking**. When in doubt, treat the question as blocking.
- **A tested answer**: an answer the run produces itself, with evidence, instead of asking someone: running the code or the tests, a free sandbox or staging call that the conventions file allows, or reading the source of the system involved. A paid or production call is never a test the run may do on its own; it needs the user's go.
- **The retrospective file**: the short markdown file written at the end of every run under `docs/retros/` in the repository, from `templates/retro.md`. It records evidence about how the run went, never opinions, and the `digest-retros` skill reads it later to propose changes to this skill or to the conventions file.

## Models and thinking levels

Each prompt in `agents/` starts with a header that names the model and the thinking level of its role. The split is deliberate. Roles where a missed problem would ship, or whose output the user reads, run on the strongest model. Roles that follow a precise, approved plan run on a faster model with less thinking. This conversation, which does the planning, keeps the user's own session settings.

| Role | Prompt | Model | Thinking level |
|---|---|---|---|
| Executor (phases 6 to 10 and phase 12, including documenting and publishing) | `executor.md` | Sonnet | medium |
| One implementation unit | `implementer.md` | Sonnet | medium |
| Second attempt at a unit that got stuck | `implementer-escalation.md` | Opus | high |
| Code review, conventions focus | `code-reviewer.md` | Sonnet | medium |
| Code review, simplicity focus | `code-reviewer-simplicity.md` | Sonnet | medium |
| Code review, correctness focus and security focus | `code-reviewer-deep.md` | Opus | high |
| Independent review of the finished branch | `pr-reviewer.md` | Opus | high |
| CTO advisor, at all three moments | `cto-review.md` | Opus | high |
| Wider code exploration (phase 3) and architecture blueprints (phase 5) | `code-explorer.md`, `code-architect.md` | the session's model | the session's level |

When the harness can load these prompts as named agents, launch the named agent and do not pass a model, so the header decides. In Claude Code this folder loads as the plugin `resolve-issue`, and the agents are named `resolve-issue:<name>`, for example `resolve-issue:cto-review`. When the harness cannot, launch a fresh sub-agent with the prompt file, and use the table's model and level if the harness lets you choose them. Never launch one of these roles as a generic sub-agent with a model of your own choosing. The reshaping of a hand-written ticket in phase 1 has no prompt file and uses a generic fresh sub-agent.

## Pushes

Nothing is pushed until the work is finished. Commit each logical unit as soon as it is done, but keep every commit on the local branch: the implementation, both reviews, the update onto the target branch, the documentation notes and the retrospective. Phase 12 then makes one push, which opens a pull request that is already final.

The reason is cost. On many forges, every push to a branch with an open pull request starts the checks again. The forge also picks which checks to run by looking at every file in the whole pull request, not only the files in the new commits. So twenty commits pushed one by one start the checks twenty times, and a commit that only changes the plan file still starts every check. Pushed together, they start them once. The checks still catch errors: they run on that one push, and phase 12 waits for them.

Two exceptions push again or earlier. A red check on the open pull request is fixed and pushed right away. And when the approved plan needs a pipeline run as evidence, for example to prove that a new check fails on a real mistake, the plan says so and the push happens then. The conventions file can override this section, for example in a repository that requires a push after every commit.

## Phase 0: Read the conventions

Read the conventions file: test policy, layer split, commit format, test commands, and repository-specific traps (ports, worktrees, files that conflict often, deploy-on-push). This skill applies those rules; it never restates them. Note the documentation tool it names and where architecture decision records (ADRs) live.

## Phase 1: Fetch the ticket

If `$ARGUMENTS` is empty, stop and ask for a ticket id or URL.

Fetch the ticket through the direct connection. Capture its title, full body, status, labels, parent (project, epic or milestone), relations to other tickets when the tracker exposes them, and the branch name the tracker suggests when it has one.

**The ticket shape.** Tickets come from the `create-tickets` skill and share one structure whatever the tracker, with these literal headings, in this order: `## Why this matters (plain language)`, ending with a line that starts with `**Goal.**`; `## Where things are today (read first)`, the relevant files with line numbers, or the word greenfield when nothing exists yet, and, on tickets cut per layer, a `**Contract**` line that states the interface already agreed; `## Scope`; `## Acceptance (TDD)`; then one footer line of the form `**Size: S/M/L** · Blocked by: … · Feeds: …`; and, only when a structural lens fired on that ticket, a final `## CTO review — …` block with decisions already locked. Most tickets have no CTO review block; that is normal, not a defect. Decisions taken for the whole batch live in the parent project's **Open questions and decisions** block and in the linked ADRs. Do not summarise the ticket: read it once, in full.

**Hand-written tickets.** If the body does not have those sections, have a fresh sub-agent reshape it into them, except the optional CTO review block, quoting the original wording and marking every section it could not fill or had to guess. Then, with no exception: if any section is missing or the sub-agent had any doubt about what the ticket means, stop. Tell the user which sections are missing or unclear and ask them to fix the ticket in the tracker before running this skill again. Do not fill the gaps yourself, do not ask the user to fill them in the conversation, and do not continue with a partial ticket.

**The plan file.** Create it from `templates/plan.md` at `docs/plans/<YYYY-MM-DD>-<ticket-id>-<short-slug-of-the-title>.md`. Copy the ticket into it verbatim, and add under "Decisions already taken upstream" the parent project's decisions block and the titles and links of the ADRs it names. From here on every phase writes its results into this file and every helper reads from it. If the workflow stops before phase 6, delete it.

## Phase 2: Dependency gate

Consumes: the tracker relations and the "Blocked by" part of the footer.

List the blockers from the tracker relations, or from the footer when the tracker has none, and fetch each one's status. Done, cancelled or duplicate blockers are satisfied; any other status is an open blocker.

If there is at least one open blocker, stop and present them plainly, with each blocker's status and what could go wrong if we start now. Ask the user whether to switch to the most upstream blocker, to proceed anyway because the dependency is soft (record this as a risk in the plan file and in the pull request), or to stop.

If nothing blocks the ticket, write "Dependencies: clear" in the plan file and continue.

## Phase 3: Map the code

Consumes: **Where things are today** and **Scope**.

Graphify, the code graph built for the repository, is the first and main source. It knows every symbol, its source file and line, what calls it and what depends on it, and it answers with the few symbols that matter instead of whole files. Use its command line, and open a source file only to read the lines the graph pointed you to. If `graphify-out/graph.json` is missing, run `graphify update .` once and wait for it: it parses the code locally, with no AI model, in about a minute. If the `graphify` command itself is missing, tell the user, suggest `uv tool install graphifyy`, and map the code with search and file reads instead.

Work from the cheapest call to the most expensive:

1. **Orientation**, only if the area is unfamiliar: the top of `graphify-out/GRAPH_REPORT.md`, which lists the most-connected symbols and the subsystems, once.
2. **Questions**: for every "how does X work" or "where is Y handled" that the ticket raises, run `graphify query "<question>"`. It returns the symbols and files involved, each with its source line; open only the ones that answer the question. A "why is Z like this" question goes to step 4.
3. **The symbols the ticket names, and the ones you expect to modify**: `graphify explain "<symbol>"` for each one gives its source line, its callers and what it calls, and `graphify affected "<symbol>"` lists everything that depends on it, tests included. When a name matches several symbols, use the node ID that `graphify explain` prints. The graph holds no history, so run `git log --oneline -n 10 -- <file>` on each file to modify for its recent changes and earlier bug fixes, and `git log --full-diff --format= --name-only -n 30 -- <file> | sort | uniq -c | sort -rn` for the files that usually change with it. Many dependents, or a file fixed again and again, goes into the plan as a risk.
4. **Governing decisions**: the decisions already taken upstream, the ADRs they name, and the `WHY:` and `DECISION:` comments and ADR references in the files to modify. `graphify explain` shows the ones the graph linked to a symbol; a text search finds the rest. They count as decisions already taken (phase 4).
5. **Source, only what is needed**: read the symbols the graph pointed to, from the line it gives, with an offset and a limit. Never read a file end to end when a few symbols answer the question.
6. **Wider exploration**, only when the ticket has no file map or the area is large: one to three fresh sub-agents with `agents/code-explorer.md`, each with a different angle (the most similar existing feature, the architecture of the area, the testing patterns around it). They follow the same graph-first path and return the symbols and files that matter.

If a later phase raises a question about the code, come back to these tools instead of guessing. Write the patterns, entry points, constraints, risks and governing decisions you found into the plan file under "Code mapping".

## Phase 4: One round of questions, including the ones the user is not asking

Consumes: **Goal**, **Scope**, the decisions already taken upstream, the decisions recorded in the code, and the code mapping.

The user does not master most of the stack, so everything they need to decide well is given to them here, in the conversation, once.

### 4.1 Draft the open questions

Compare the ticket with the code and list what is genuinely undecided: edge cases, error handling, integration points, scope boundaries, backward compatibility, performance needs. Filter hard: drop anything the ticket answers, anything locked in its CTO review block or its Contract line, in the parent project's decisions, in a linked ADR or in a decision recorded in the code that the code mapping found, and anything with an obvious default, writing that default into the plan file as an assumption. If the conventions file named no documentation tool, add the question of where decisions and documentation should be written. Write the surviving questions under "Open questions and answers", each with your recommended answer.

Then label each question **blocking** or **non-blocking** (see Vocabulary), and handle every blocking question before going further:

- **If the run can test it**, test it now and write the tested answer next to the question, with its evidence (the command, the run, the file and lines read). The question still goes to the user in 4.3, as answered, so that they see every blocking point and can challenge the evidence.
- **If the run cannot test it**, it has to be asked. Write who can answer it: the user, or someone else, such as another team. For someone else, draft the question word for word, for that person, and name the channel the conventions file gives for such questions; if it gives none, the channel is a question for the user.

A non-blocking question stays in the list with its label. It is either answered in 4.3 or recorded as "open, not needed for this ticket".

### 4.2 Call the CTO advisor

Launch a fresh sub-agent with `agents/cto-review.md`, moment `before-plan`, with the plan file path and the conventions file path. It rewrites your draft questions for a reader who does not know the technology and adds the blind spots the user is not asking about; its prompt defines the rest. It writes the block "Questions you may not be asking" at the top of the plan file and returns it in full.

### 4.3 Ask, once

Show the block to the user unabridged and wait. Before the block, list the blocking questions in a few lines, each with its state: answered by a test (with the answer), to be answered by the user, or to be asked to someone else (with the drafted question, who it goes to and through which channel). If the user says "whatever you think is best", state your recommendations and get an explicit yes. Write every answer into the plan file next to its question. If there is no question at all, write "No open questions", show the advisor's skip lines, and continue without stopping.

**No plan on an open blocking question.** Phase 5 starts only when every blocking question has an answer. When one must come from someone else, the user sends the drafted question, or approves sending it through the channel named, and the run waits. Write "waiting for answers" in the plan file's Status line. When the user brings the answer back, write it next to its question with its source and date, check whether it changes other answers or assumptions, and only then go on to phase 5. If the session has to end before the answer arrives, treat it like a stop in phase 2: say plainly what is waiting and for whom, record the question where the conventions file says open questions are tracked, delete the plan file, and run phase 11.

**Every question meant for someone else is shown here, labelled.** A question to another person or team, blocking or not, reaches a pull request, a ticket or a message only if the user saw it word for word in this round, with its label. The same holds for the questions that the build raises later (phase 5.4). Never let such a question appear for the first time inside a recommendation, a briefing or a pull request body.

## Phase 5: Write the plan and get it approved

### 5.1 Architecture, only when there is a real choice

If two or more approaches with different trade-offs remain that neither the ticket, the upstream decisions nor the phase 4 answers settled, launch two fresh sub-agents with `agents/code-architect.md` and different briefs: the smallest change with maximum reuse, and the cleanest structure. Write both into the plan file under "Architecture" with your recommendation marked. Otherwise write one line saying the approach is locked or the change is small.

If the plan introduces a structural decision that did not exist in phase 4, for example a trade-off between two architectures, call the advisor again with moment `plan-delta`. Otherwise write "No new decision since phase 4".

### 5.2 Implementation units

Write the implementation as numbered units in the plan file. Each unit is small enough for one fresh sub-agent and states the failing test to write first, the minimum code to make it pass, the refactor if any, and the commit message. Rules:

- **Test first.** Every new function, route or component starts with a failing test.
- **Security by design.** If the change touches an endpoint, a database query or external input, a unit placed before the implementation covers: a negative-authorization test (an authenticated but unauthorized actor gets a 403 or 404 and never the data), parameterised SQL, transactions and idempotency on multi-table writes, no hardcoded secrets, no stack traces in error responses. If none applies, write "no security surface, skip".
- **Front end needs an approved design.** Any unit that creates or changes a user interface must point to the approved design specification produced by the open-design tool, which is external to this harness and referenced by the ticket or its paired design ticket. Without it you cannot and must not code that unit: mark it "blocked, waiting for the open-design specification", say so at the approval gate, and plan the other units normally. Never invent a design, never sketch one yourself.
- **Documentation.** List the documentation duties of phase 10.3 for this ticket and where each is written, as "applies, written to <place>" or "does not apply". Documentation is not optional and is not conditional on the conventions file mentioning it.
- **Commits.** One commit per unit, Conventional Commits form (`feat`, `fix`, `refactor`, `test`, `chore`) with the scopes of the conventions file.
- **Independent units run in parallel**, dependent units are ordered, and no unit is coded in the main context.

### 5.3 The approval gate

This is a mandatory stop that overrides any auto, accept-edits or "no questions" mode of the harness. Tell the user the plan file path. Show any `plan-delta` points in full. Then give a digest of at most ten lines: how the phase 4 answers shaped the plan, the number of units, the blocked units, and your recommendation where alternatives exist. If non-blocking questions stay open, name them in the digest and say that they will appear in the pull request under the heading "Open questions, not needed for this pull request". Do not paste the rest of the plan; the user reads the file. Never open the gate while a blocking question has no answer.

Ask for approval with the harness's question tool, or in plain chat. Accept explicit approval only, in English: "go", "ok", "approved", "ship it". The whole workflow, including the plan file, the pull request and every question to the user, is in English. Every answer the user gives is written into the plan file's "Decisions" section. Do not proceed on your own judgment, even if the harness tells you to keep going.

In this phase you may only present, ask, answer follow-ups, and edit the plan file. You may not create branches, other files or commits, spawn implementation sub-agents, or run any command that changes state.

### 5.4 Hand off to the executor

Once the user has approved, write "approved" in the plan file's Status line. Launch a fresh sub-agent with `agents/executor.md` and the inputs its prompt lists. Pass nothing from the conversation, then wait and do not touch the repository while it runs. It cannot talk to the user and ends with one of three reports:

- **done**: show the briefing it returns to the user unabridged, then what the independent reviewer changed and what remains to decide, in a few sentences. Then list, word for word, the non-blocking questions that the build raised and that will appear in the pull request under the heading "Open questions, not needed for this pull request", each with who it is for, or say that there are none. Then run phase 11 and phase 12. Nothing is pushed yet at this point.
- **needs-decision**: ask the user the question it returns, write the answer into the plan file's "Decisions" section, and relaunch the executor with the same inputs; it resumes from the plan file.
- **needs-decision, for blocking questions found after the build**: the reviews or the briefing raised a question that can change what was built, and that the executor could not answer with a test. The pull request is not opened. Show each question to the user, word for word, with its context and who can answer it. When the answer must come from someone else, the user sends the question, or approves sending it through the channel the conventions file names, and the run waits, as in phase 4.3. Write each answer into the plan file's "Decisions" section with its source and date, then relaunch the executor with the same inputs: it applies the answers to the units concerned, reruns the reviews that the change calls for, and reports again. Phase 12 runs only when no blocking question is left open.
- **failed**: report what it returns to the user plainly and stop.

## Phase 11: Retrospective

This phase runs in this conversation after every ending of the skill: after the executor's done report has been shown, after a failed report, after a needs-decision round that ends the session, and also after a stop in phase 1 (malformed ticket) or phase 2 (open blocker). It records evidence and nothing else. It never edits this skill, its agent prompts or the conventions file; the `digest-retros` skill does that later, with the user's approval, once enough retrospectives have accumulated.

Write `docs/retros/<YYYY-MM-DD>-<ticket-id>.md` from `templates/retro.md`. Use four sources of evidence and no other: the plan file, in particular its "Executor notes", "Review log" and "Hand-off log" sections; the git log of the branch, where a fix commit after a review means a unit missed something and a relaunched executor means a needs-decision round; the executor's reports; and what this conversation saw of the user, meaning a correction, a question that had to be asked twice, a recommendation the user rejected, or a place where the user needed an explanation the skill should have given.

Rules for the content:

- **Empty headings are normal.** Every heading stays, and an empty heading reads "nothing this time". Never invent an item to fill a heading; a retrospective whose three headings are all empty is a valid retrospective. The digest relies on every item being real.
- **Evidence, not opinion.** Every item names a phase, a commit or a line of the plan file. Quote the plan file or a commit, never a person. Describe a correction, for example "the recommendation on the archive path was rejected in phase 4", without saying who made it. The file lands in the repository and its readers are not only the user.
- **One tag per "Improve" item**, from this fixed set: `[skill]`, `[agent prompt]`, `[conventions file]`, `[ticket template]`, `[one-off]`. The tag says where a fix would go, not who is responsible.
- **At most three "Protect" items**, each a specific behaviour that visibly helped this run, with its evidence. General praise is not an item.
- **Under fifteen lines of prose**, in full sentences.

Then commit the file on the current branch with a `docs` commit, and do not push it (see "Pushes"). If the executor's report was done, go on to phase 12. Otherwise the commit waits on the local branch for the run to resume. If no branch exists because the run stopped before phase 6, leave the file uncommitted and say so.

## Phase 12: Publish

This phase runs only after a done report and a committed retrospective, and only when the plan file holds no blocking question without an answer. Launch the executor again with the same inputs. Its plan file now says "ready for review", so it runs only its phase 12. It brings the branch up to date one last time, pushes it once, opens the pull request with the title and body drafted in the plan file, and waits for the checks. If a check fails, it fixes it, notes it in the plan file and in the retrospective in the same commit, and pushes again. It also adds the pull request link to the decision records.

It ends with one report:

- **published**: tell the user the pull request link and the result of the checks, in a few sentences. Say plainly if a check is still red or pending, because the pull request is then not ready for review. Mention every extra push and its reason.
- **needs-decision**: ask the user the question, write the answer into the plan file's "Decisions" section, and launch the executor again with the same inputs.
- **failed**: report what it returns to the user plainly and stop.

## Closing notice

At the very end of the run, after phase 12, or after phase 11 when the run ended without a done report, count the files directly in `docs/retros/`, ignoring the `reviewed/` folder. If there are ten or more, close the conversation with a notice set apart from everything else: a blank line, a heading "Digest due", then two sentences saying how many retrospectives are waiting and that the user should run `digest-retros` in a fresh session. Do not run the digest here; this session is already long and the digest deserves an empty context.

## Settled decisions

The choices below were settled by the user on purpose. The `digest-retros` skill never rewrites one of them as an ordinary change. When the retrospectives challenge one, the digest presents the evidence and what the decision protects, and asks the user; reopening a settled decision is always the user's call, and it is a legitimate call when the evidence is strong. Each line says what the decision protects.

- One approval gate, in phase 5.3, with explicit approval only. It protects the user from a build started on a half-understood plan.
- The executor hand-off of phase 5.4, with three reports and no conversation with the user. It protects the main context from filling up, because a skill cannot compact the conversation on its own.
- The hard stop on hand-written tickets that miss a section, in phase 1. It protects the plan from guesses nobody reviewed.
- Graphify first in code mapping, in phase 3 (settled 2026-10-05, replacing repowise). It protects the context budget, because the graph answers with the few symbols that matter instead of whole files.
- Tool-agnostic wording: the conventions file, the tracker, the forge, a fresh sub-agent, the harness's question tool. It protects the portability of the skill across harnesses and trackers.
- Two blocks always shown in full, "Questions you may not be asking" and "What you should know about what was built". They protect a user who does not master the stack.
- The ticket is copied verbatim into the plan file, never summarised. It protects the plan from a lossy reading of the ticket.
- Front-end units need an approved design specification or are blocked. It protects the product from designs invented by the agent.
- English only, everywhere: plan file, pull request, questions. It protects the readability of the record for the whole team.
- The model and thinking level of each role, set in the headers of `agents/` and listed under "Models and thinking levels" (settled 2026-10-04). It protects quality where a miss would ship or where the user reads the output, while keeping routine work fast and cheap. Retrospectives that show a faster role repeatedly missing what a later step caught are the evidence for raising that one role.
- Blocking questions are answered before the plan, by a test when the run can do one and by asking otherwise, and the plan waits for the answers. A blocking question found after the build stops the run before the pull request opens. A non-blocking question appears in the pull request only under the heading "Open questions, not needed for this pull request", after the user has seen it (settled 2026-10-22, after ticket mintlify#12, whose merge request carried seven questions to R&D that the user had never seen as such). It protects the user from questions sent in their name without their knowledge, and the plan from being built on an unanswered question.
- Every commit stays on the local branch until phase 12, which makes one push that opens a pull request that is already final, as described under "Pushes" (settled 2026-10-05). The independent review therefore reviews the local branch, and the retrospective is written before the push. It protects the forge's CI minutes, because every push to an open pull request starts the checks again for the whole pull request.

## Lessons applied

One line per change applied by `digest-retros`, dated, newest last. The text before and after each change lives in the digest file that applied it, under `docs/retros/reviewed/` in the repository where it ran; that file is the undo.

- None yet.
