# Refocus and quality guards

Epic: https://github.com/gambitl/claude-code-stack/issues/84

## 1. Context and problem

This project follows epic #6, "Skills into CLI". That epic built `cstack`, a command-line tool that runs the mechanical steps of the `resolve-issue` skill. A skill is a markdown file of instructions that Claude loads when a task matches it. `resolve-issue` takes one ticket from the tracker, which is the tool that holds the tickets, to a pull request. It writes everything about the ticket into a markdown file in the repository, called the plan file. The plan splits the work into small units, and each unit has its own test and its own commit. At the end of every run, the skill writes a short retrospective that records what went wrong.

Inside a ticket, the skill starts helpers. A helper is a fresh agent that does one job, such as building or reviewing the code. The executor is the helper that runs the build, and it starts one implementer for each unit.

Milestone 4 of epic #6 compared `cstack` 0.3.1 with the old prose skill on a copy of a real ticket. The two runs of the prose skill are the baseline runs, called runs 1 and 2. The two runs of 0.3.1 are runs 3 and 4. An architecture decision record (ADR) is a short page that explains one technical choice and its reasons. [ADR-SIC-G](../decisions/ADR-SIC-G-continue-or-stop.md) records the results of the comparison and the decision.

Runs 3 and 4 used more tokens than the baseline, for each of the four kinds of tokens. They also took longer. On average, 21 minutes passed from the approval of the plan to "ready for review", against 15.5 minutes for the baseline. In a blind review, the reviewer does not know which version made which branch. The quality tied in that review. But one of the two new runs made the weakest branch, for three reasons that nothing in the run caught.

The cause of the extra cost is known. In 0.3.1, the helpers of a ticket run as Orca workers. Orca is a desktop app that runs several coding agents side by side. Orca gives each agent its own workspace, which is a second working folder of the same git repository. An Orca worker is a full Claude Code session that Orca starts and supervises. It starts with about 60,000 to 66,000 tokens of context. A Claude Code sub-agent starts with about 46,000 to 51,000 tokens. The model reads that context again at every call.

ADR-SIC-G decided to continue with two changes, and this project carries both. The first change is a refocus of `cstack`. The second change is three guards that make the quality of a run depend less on luck.

On 2026-11-23, the maintainer set the rule of the refocus. Everything that Orca already does leaves `cstack`. The only purpose of `cstack` is to turn the steps of `resolve-issue` into commands that check and record each step. Orchestration stays with Orca. So these eight needs go through Orca, and `cstack` no longer handles them:

1. start an agent for each ticket, in its own workspace;
2. start a helper inside a ticket;
3. know that an agent has finished;
4. carry the final report of an agent;
5. respect the order of the blocking relations between tickets;
6. tell the user that a ticket has a question;
7. watch the tracker;
8. link a workspace to a ticket.

Two of these needs work in a particular way. Claude Code starts the helpers inside a ticket, not Orca. And the user answers questions in each ticket's own chat. Orca only tells the coordinator that a ticket waits for the user.

The target use case is the flow that works today with Orca and the prose skill. The new version keeps it. In this flow, a wave is the set of tickets that can start at the same time, because nothing blocks them.

1. The maintainer talks to Claude in the main Orca workspace, which acts as the coordinator. They say "let's start the next wave of tickets with resolve-issue".
2. The coordinator follows Orca's orchestration guide. It opens one workspace for each ready ticket, with Claude inside and a first prompt `/resolve-issue <ticket>`.
3. In each workspace, Claude Code manages its helpers on its own. The skill guides it, and recommends a model for each task.
4. When a ticket has questions, its worker asks them in its own chat. The coordinator tells the maintainer "go to worker X, it has questions for you". The maintainer answers in the worker's chat.
5. At the end of the ticket, the worker pushes the branch and opens the pull request. Once the pull request is open with no conflict, the worker reports to the coordinator. The coordinator tells the maintainer "the workspace of ticket X is done, its pull request is open".
6. When several tickets finish at about the same time, the coordinator checks whether their pull requests conflict with each other.
7. The maintainer merges, then asks for the next tickets. The coordinator only starts a ticket whose blockers are all merged.

The maintainer also asked a new question: do the runs really follow every step of `resolve-issue` and of its commands? This project adds an audit of the steps that answers it.

The project ends with runs 5 and 6. They use the new version on the same ticket copy as runs 1 to 4, and they are measured and reviewed blind in the same way.

Epic #6 measures reliability over the ten runs that follow its first release. This project changes how every run works. So those ten runs are counted after the release that this project ships. This page records that rule, and epic #6 does not change.

## 2. Success measures

The project succeeds when the five measures below are met by runs 5 and 6. The first three measures are the ones of epic #6, so that the results stay comparable.

1. **Tokens.** Each run uses fewer tokens than the average of runs 1 and 2, for each of the four kinds of tokens. The four kinds are input, cache creation, cache read and output.
2. **Waiting time.** The time from the approval of the plan to "ready for review" is shorter than the average of runs 1 and 2, which is 15.5 minutes.
3. **Quality.** In the blind review of section 4 (US-9), runs 5 and 6 rank at least as well as runs 1 and 2. The number of judgment problems per retrospective does not go up.
4. **Steps.** The audit of US-1 shows that runs 5 and 6 did every mandatory step that their plans make applicable.
5. **Guards.** None of the three causes of the weakest branch comes back in run 5 or run 6. A negative test checks that something forbidden is refused. The first cause is a new test that passes before its code exists. The second is a negative test that proves the wrong rule. The third is a fact without a source, or an unrequested change, in the plan.

Only the token and time results are published as figures. The other measures are published in words, as met or not met, because this repository is public.

**The decision rule, written before the runs.** ADR-SIC-G had to explain why its decision did not follow the measures. This time, the next step is decided in advance.

- When the cache creation, cache read or output tokens stay above the baseline, the project stops and rethinks. No new feature epic starts before the cause is understood.
- The input tokens are reported, but they cannot trigger that stop on their own. A baseline run has about 560 input tokens, against about 25.7 million cache read tokens, and the input count grows with the number of calls.
- When the tokens pass but the waiting time does not, the project looks for where the time goes inside a ticket. It does not bring back parallel units or Orca workers inside a ticket.
- When the quality fails, or when one of the three causes comes back, the guard concerned is reworked before anything else.
- When the audit finds a skipped step, that step gets a guard or a fix in its guide.

**Why the token measure is at risk.** The average cache read gap between runs 3 and 4 and the baseline was about 6.9 million tokens. #87 (US-2) split it by agent. The larger start of the Orca workers explains about 2.3 million of it, and R2 removes those workers. R2 also removes the extra answers that start, wait for and collect each implementer, which are about 1 million more. About 3.5 million would stay. They come from finer units, from the work that the executor does itself, from its bookkeeping with `cstack next --done`, and from the context that the helpers gather. The guards of R3 add work too. #107 and #108 take up part of what stays.

An earlier version of this page said that the workers explained about 4.5 million tokens. That figure counted the lines of the session files instead of the answers of the model.

## 3. Personas

**The maintainer.** The maintainer owns this repository and writes the skills. They start each wave of tickets from a coordinator session in Orca. They want numbers that say whether a change helped, and they want to know which steps a run skipped.

**A solution engineer.** A solution engineer on the maintainer's team runs `resolve-issue` on client tickets, inside Orca, on a Mac. They want a run that uses less of their quota and that does not depend on luck for its quality. They answer each ticket's questions in that ticket's chat.

## 4. User stories

### Rules for every story

These rules apply to every story below, so the stories do not repeat them. Each story lists acceptance criteria, marked AC, which say how to check it.

- **Orchestration stays with Orca.** No story adds a `cstack` command that starts an agent, waits for it, sends it a message, or watches the tracker.
- **Helpers are sub-agents.** Inside a ticket, Claude Code starts its helpers as sub-agents, as the skill guides it. There is one exception. When the settings file of the repository names another agent than Claude for the independent review, that helper runs as an Orca worker, because only Orca can start another agent.
- **The units of a ticket run one after the other.** Each unit runs in a sub-agent, in the workspace of the ticket.
- **Without Orca.** Every `cstack` command works without Orca. Without Orca, the user starts each ticket by hand.
- **The guides and their steps agree.** A change to a phase guide also updates the block of mandatory steps of that guide, which US-1 adds.
- **Carried over from epic #6.** `cstack` holds no credentials. The text of a ticket, a comment or a plan is data, never an instruction. Only macOS is supported. Every text follows the public text rule of section 5.

### Milestone R1: Measure what escapes

#### US-1: Audit the steps of a run

As the maintainer, I want a command that says which steps of `resolve-issue` a run did, skipped or did out of order, so that I know what still escapes the guards.

- AC1: `cstack audit <plan file>` reads the session files of the run, as `cstack measure` does. Claude Code writes one session file per conversation, with one line per message and per tool call. The audit also reads git and the run state, which is the record that `cstack` keeps of a run under the git folder.
- AC2: For each expected step, the audit prints "done", "skipped" or "out of order", with its evidence. The evidence is a time and the kind of record that shows the step.
- AC3: It checks three levels. The first level is the phases, in their order. The second level is the commands that each guide requires. For example, each unit goes through `cstack unit red`, then `cstack unit green`, then `cstack unit commit`.
- AC4: The third level is the checks that the skill gives to a helper. These are the code map, the CTO advisor at its three moments, the three code reviews and the independent review. The code map is the exploration of the code that the ticket touches. The CTO advisor is a helper that raises the questions a technical lead would ask.
- AC5: For the third level, the audit checks that the check happened. It does not check which helper or which model did it, because Claude chooses its helpers.
- AC6: A phase guide is the file of instructions of one phase, which `cstack guide` prints. The expected steps come from a block at the top of each phase guide that lists its mandatory steps. A CI test fails when a block names a command that does not exist. No second list of steps exists in the code.
- AC7: A step that the plan makes not applicable is not expected. For example, a ticket with no negative criterion has no "break the rule" step.
- AC8: For the five planning phases, the evidence comes from the session files only. The run state marks those phases as done at the approval time (`cstack/src/run-state.ts`, line 165), so it proves nothing about them.
- AC9: The `retro` phase runs the audit and writes its result in the retrospective. `digest-retros` is the skill that turns retrospectives into improvements, and it then reads that result.
- AC10: The coordinator runs the audit first on runs 3 and 4, in the private sandbox, and reports the result in words. When it finds no skipped step, the audit is kept but not extended.
- AC (negative): The audit never prints, copies or sends the content of a session. It prints step names, verdicts and times only. A test checks this.
- AC (negative): The audit does not check orchestration, which belongs to Orca.

#### US-2: Find where the rest of the extra tokens came from

As the maintainer, I want to know where the extra cache read tokens of runs 3 and 4 came from, beyond the Orca workers, so that I know before building whether the token measure can be met.

- AC1: The coordinator compares runs 3 and 4 with runs 1 and 2, by agent and by phase, in the private sandbox. It uses `cstack measure`, or counts by hand from copies of the session files.
- AC2: The outcome comment of the ticket says in words where the remaining tokens came from. It says whether milestones R2 and R3 touch that cause. It gives no figure other than token and time results.
- AC3: When the cause lies outside what this project changes, the ticket says so. The maintainer then decides whether milestone R2 starts.
- This story has no code.

### Milestone R2: Refocus cstack on resolve-issue

#### US-3: Remove the orchestration layer from cstack

As a solution engineer, I want `cstack` to stop starting, waiting for and collecting helpers and tickets, so that a run pays for no extra Orca session and Orca alone organises the agents.

- AC1: `cstack wave`, `cstack helper start`, `cstack helper wait`, `cstack helper done`, `cstack unit collect` and `cstack report check` leave the manifest, the code and the tests.
- AC2: The guides and the agent prompts start the executor, the implementers and the escalation implementer as fresh Claude Code sub-agents. `cstack/test/manifest.test.ts` already fails when a skill or a guide names a command that does not exist.
- AC3: The `build` guide runs the units one after the other, each in a sub-agent, in the workspace of the ticket.
- AC4: `cstack unit order` prints the order of the units. It no longer speaks of batches that can run in parallel.
- AC5: `cstack report submit` stays. The executor runs it before it returns, and it still refuses a "done" report while a unit has no commit.
- AC6: The settings key `setupCommand` leaves the code and the `.cstack/settings.json` file of this repository in the same change, because `cstack` refuses a settings file with an unknown key.
- AC7: This repository declares `cd cstack && npm ci` as an Orca setup hook instead. Orca runs the setup hooks of a repository when it creates a workspace. The ticket finds where Orca declares such a hook and writes it down.
- AC8: The README and the release notes list what left, and they say what to use instead.
- AC9: ADR-RQG-A records how helpers and units run inside a ticket. It replaces ADR-SIC-A.
- AC (negative): No guide, skill or agent prompt tells Claude to start an Orca worker inside a ticket, except for the independent review by another agent than Claude.

#### US-4: List the ready tickets

As a solution engineer who runs a wave from the coordinator, I want `cstack tracker list` to give only the tickets that can start now, so that the coordinator never starts a ticket before its blockers are merged.

- AC1: `cstack tracker list --milestone <name> --ready` prints only the tickets that are open, that are not "in progress", and whose blockers are all done, cancelled or duplicates. `--epic <key> --ready` works the same way.
- AC2: It works for the four trackers that `cstack tracker list` supports.
- AC3: Whether a ticket already has a workspace is a question for Orca, through `orca reference find`. This option does not answer it.
- AC (negative): A ticket with one open blocker is never listed. A blocker whose pull request is open but not merged still counts as open.

#### US-5: A ticket worker asks in its own chat and reports its pull request

As a solution engineer who runs a wave in Orca, I want each ticket's worker to ask its questions in its own chat and to tell the coordinator when its pull request is open, so that the wave runs as it does today with the prose skill.

- AC1: The `questions` and `plan` guides say that the user answers in the chat of the ticket, also when the session is an Orca worker.
- AC2: When a worker stops without its final report, Orca wakes the coordinator, and the coordinator sends the user to that chat. The ticket checks this on a real worker.
- AC3: The `publish` guide says what an Orca worker does once `cstack publish` has opened the pull request. It sends `worker_done` with the link of the pull request.
- AC (negative): A worker never sends `worker_done` before its pull request is open, and it never sends it twice.

### Milestone R3: Quality guards

#### US-6: Each new test case fails first

As a solution engineer, I want `cstack` to check each new test case on its own, so that a unit is refused when one of its new cases passed before its code existed.

- AC1: The settings file can declare a report per test case for each test command. The report uses the JUnit XML format, which pytest and vitest can both write.
- AC2: Each unit of the plan names its new test cases.
- AC3: `cstack unit red` requires each named case to fail. `cstack unit green` requires each named case to pass.
- AC4: When a case that the plan does not name passes in the red run, `cstack` writes a warning in the plan.
- AC5: Without a report per case, `cstack` falls back to today's check of the whole test file. It writes that fallback in the plan, and the audit reports it.
- AC (negative): A unit whose named case passes before the code exists is refused, even when another case of the same file fails. This is the second cause in ADR-SIC-G.

#### US-7: A negative test proves its rule by breaking it

As a solution engineer, I want `cstack` to break each rule that a negative test protects and to see that test fail, so that a negative test can no longer prove the wrong rule.

- AC1: The plan says which negative acceptance criteria of the ticket each unit covers.
- AC2: For each of these criteria, the implementer writes a small patch that breaks the rule. A patch is a file that describes a change to other files.
- AC3: A new `cstack` command applies the patch and runs the test file of the negative test. It checks that this negative test fails, then it removes the patch.
- AC4: The step comes after `cstack unit green` and before `cstack unit commit`. `cstack unit commit` refuses the unit while this step is missing for one of its negative criteria.
- AC5: Only the test file of the negative test runs under the patch, to keep the cost low.
- AC6: The command starts only on a clean workspace. It puts the files back before it exits, even after a failure. When it cannot, it stops and names the files.
- AC (negative): When another test fails under the patch, but not the negative test of that criterion, the step is refused. When the patch breaks no test, the step is refused too. This is the first cause in ADR-SIC-G.

#### US-8: A fact in the plan names its source

As a solution engineer, I want every fact in the plan to name where it comes from, so that an unchecked claim can never become a decision by default.

- AC1: The plan has a "Facts" list. Each line names its source, either as a file and a line or as "the user, on <date>".
- AC2: A file source also quotes the short text that it relies on. `cstack` checks that the file exists and that the quoted text is on that line.
- AC3: `cstack` refuses a fact line without a source, or with a source that does not match.
- AC4: A fact that no file shows, for example a fact about production, becomes a blocking question.
- AC5: A change to something that the ticket fixes goes in a fixed section of the plan. `cstack` refuses the approval of the plan while such a change is not linked to an answered blocking question.
- AC6: The `questions` guide, the `plan` guide and the CTO advisor prompt say to put every fact in the list. This part stays a rule in prose, which the CTO advisor and the reviews check.
- AC7: The format version of the plan goes up once for US-6 and US-8 together. ADR-RQG-B records the new format.
- AC (negative): A plan with an item in the section of changes to what the ticket fixes, and no answered question linked to it, cannot be approved. This is the third cause in ADR-SIC-G.

### Milestone R4: Runs 5 and 6 and decision

#### US-9: Run the new version twice and decide

As the maintainer, I want two runs of the new version on the same ticket copy, measured and reviewed blind like runs 1 to 4, so that I decide with evidence what comes next.

- AC1: Both runs use the same ticket copy, the same starting commit, the same sandbox and the same answers as runs 1 to 4. Each run stops after its retrospective.
- AC2: The runs use the version that this project releases, installed as a user installs it.
- AC3: The maintainer's current coordinator writes a prompt that starts a special coordinator. The special coordinator only serves runs 5 and 6. It starts each run as an Orca worker in its own workspace.
- AC4: Each run is measured from a copy of its own session files only, as runs 3 and 4 were. The whole session of the special coordinator is measured too. Its tokens are published next to the runs, not added to them, because in real use a coordinator serves a whole wave.
- AC5: The audit of US-1 runs on runs 3, 4, 5 and 6.
- AC6: A fresh reviewer ranks the six branches together, blind, with the same brief as for runs 1 to 4. The quality measure compares runs 5 and 6 with runs 1 and 2 in that ranking. Runs 3 and 4 show whether the guards fixed the weakest branch.
- AC7: The guard of US-8 can raise questions that runs 1 to 4 did not have. They are answered with what the text of the original ticket supports, and each one is recorded in the sandbox.
- AC8: New baseline runs are made only when the model or the effort level changed. A change of Claude Code version is recorded as a limit.
- AC9: An ADR applies the decision rule of section 2 and records the token and time results.
- AC (negative): No figure from work other than the token and time results is published. No text names an employer, a client or a work ticket.

## 5. Scope

**In scope**

1. Everything that Orca already does leaves `cstack`: `cstack wave`, the three `cstack helper` commands, `cstack unit collect`, `cstack report check` and the `setupCommand` key.
2. The guides and agent prompts start every helper as a sub-agent, and the units of a ticket run one after the other.
3. `cstack tracker list` gets a `--ready` option.
4. The guides tell a ticket worker how to ask its questions and how to report its pull request.
5. Three guards: each new test case fails first, a negative test proves its rule by breaking it, and a fact in the plan names its source.
6. An audit of the steps of a run.
7. An investigation of the extra tokens of runs 3 and 4.
8. Runs 5 and 6, their blind review and the decision.
9. A lighter executor, with fewer answers spent on bookkeeping and less reading (#107).
10. Every unit built by an implementer, including a unit with no test, and an audit that reports a unit that no implementer ran (#108).

**Out of scope**

1. The bulk creation of tickets by `cstack`, which is milestone 5 of epic #6. It is very secondary for now, and it waits.
2. A guide or a command for the coordinator. Orca's orchestration already runs a wave well today.
3. Parallel units inside a ticket, with Orca workers or with sub-agents in their own worktrees.
4. Orca's task graph for the order of tickets. Orca counts a task as finished when its worker reports, which happens when the pull request opens, before the merge.
5. Any watching of the tracker. The coordinator reads the ready tickets when the maintainer asks for the next ones.
6. Any change to Orca itself.
7. The other skills, and the frozen prose skills in `skills/`.
8. Any change to epic #6 or to its page.
9. Any agent other than Claude by default, except the review exception of section 4. Any operating system other than macOS.

**Public text rule**

This repository is public. No text in it or in its issues names an employer or a client. No text quotes a ticket key from work. No text gives a count taken from work retrospectives. The token and time results of a comparison are the only figures from work that are published. The copy of the work ticket lives only in a private sandbox.

## 6. Milestones and sequencing

**R1 Measure what escapes.** This milestone builds the audit and finds where the rest of the extra tokens came from, before anything changes. It carries US-1 and US-2. The audit must judge runs 3 and 4 against the steps of the current guides, so it comes before the refocus changes those steps. Both results can change the next milestones. For example, a step that runs 3 and 4 skipped may need one more guard in R3. R1 starts from `main`, which already holds version 0.3.2 with #79 and #80. R1 blocks R2.

**R2 Refocus cstack on resolve-issue.** This milestone removes the orchestration layer and adapts the guides to the flow of section 1. It carries US-3, US-4 and US-5, and the two tickets that #87 added, #107 and #108. It needs R1.

**R3 Quality guards.** This milestone adds the three guards. It carries US-6, US-7 and US-8. Its code tickets need only R1, so they can start while R2 runs. Its last ticket changes the `build` and `plan` guides, so that ticket waits for the guide tickets of R2. R3 ends with the release that runs 5 and 6 use. It blocks R4.

**R4 Runs 5 and 6 and decision.** This milestone runs the new version twice, reviews the six branches blind and records the decision. It carries US-9. It needs R1 to R3.

## 7. Where things are today and technical context

**The commands of `cstack`.** `cstack/src/manifest.ts` lists 23 commands at version 0.3.2. Eighteen of them are the steps of one ticket and work without Orca. Five of them are the Orca layer that 0.3.x added: `cstack helper start`, `cstack helper wait`, `cstack helper done`, `cstack unit collect` and `cstack wave`.

After R2, 17 commands remain: `doctor`, `skills install`, `guide`, `next`, `plan status`, `plan section`, `report submit`, `unit order`, `unit red`, `unit green`, `unit commit`, `publish`, `measure`, and the four `tracker` commands. R1 and R3 add the audit and the command that breaks a rule.

**The code that leaves.** The Orca layer lives in `cstack/src/helper/`, `cstack/src/wave/` and `cstack/src/unit/collect.ts`, with their commands in `cstack/src/commands/`. `cstack/src/orca/` stays, because `cstack tracker` reaches Jira and Linear through Orca, and `cstack doctor` checks Orca. `cstack/src/settings.ts` reads `setupCommand` at line 274.

**The texts that name the commands that leave.** These guides name them: `build.md`, `plan.md`, `publish.md`, `ready.md` and `retro.md`, in `cstack/guides/resolve-issue/`. These agent prompts name them too: `executor.md`, `implementer.md` and `implementer-escalation.md`, in `cstack/skills/resolve-issue/agents/`. The other guides already say "fresh sub-agent" for the helpers they start. The vocabulary of `cstack/skills/resolve-issue/SKILL.md` defines that term at line 47.

**The review exception.** `cstack/guides/resolve-issue/independent-review.md`, line 16, starts a review agent other than Claude through a launcher that the harness offers, such as an Orca worker. That line stays.

**The run state.** The run state lives under the common git folder, as [ADR-SIC-B](../decisions/ADR-SIC-B-run-state.md) says. `cstack/src/phases.ts` defines 15 phases, and line 117 names the five planning phases. When a run is created, `cstack/src/run-state.ts` marks those five phases as done at the approval time, at line 165.

**This repository's settings.** `.cstack/settings.json` sets `setupCommand` to `cd cstack && npm ci` since commit `a88c5f5`. A new worktree has no `node_modules`, which is why that command exists.

**Orca.** These facts come from Orca 1.4.269 and from its orchestration guide, which `orca skills get orchestration` prints.

- `orca orchestration worker-start --worktree new-top-level` starts a worker in a new workspace. A worker in a new workspace stays open after it finishes, so the user keeps its chat.
- `orca reference add <link> --worktree <workspace>` links a workspace to a ticket.
- A worker ends with `worker_done`, and Orca then wakes the coordinator.
- When a worker stops without `worker_done`, Orca wakes the coordinator with an escalation. An escalation is a message that says the worker stopped or is blocked.
- Orca puts a preamble before the task of each worker. That preamble tells the worker to ask its questions through the coordinator, not in its own chat. Section 1 keeps the maintainer's habit of answering in the worker's chat, which works today.
- `orca orchestration task-create --deps` and `task-list --ready` order tasks. A task counts as finished at `worker_done`.
- `orca worktree create` and `worker-start` take a `--setup` option. By default, it follows the setup policy of the repository.
- Orca has no command for GitHub or GitLab issues. `orca jira` has no command that links two issues.

**Measures.** `cstack measure` reads the Claude Code session files of a run. Each answer of the model records its usage in four fields: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` and `output_tokens`. Today it only counts the sessions that belong to a plan file.

**The comparison material.** It is private, and the maintainer's coordinator keeps it until runs 5 and 6 are compared. The public protocol is in the comments of #32 and #33.

## 8. Design briefs

No design surface. This project changes a command-line tool and prose only.

## 9. Open questions and ADR candidates

**Open questions**

1. **Where Orca declares a setup hook.** Orca runs the setup hooks of a repository when it creates a workspace, but this page does not say where they are declared. If nobody decides, the US-3 ticket finds out. The recommendation is to declare the hook in a file of the repository if Orca allows it, so that it is versioned.
2. **Questions in the worker's chat.** Orca's worker preamble says to ask through the coordinator, while the maintainer answers in the worker's chat. If nobody decides, the guides keep today's habit. The recommendation is that the US-5 ticket checks it on a real worker before it closes.
3. **How to measure the special coordinator.** `cstack measure` only counts the sessions of a plan file. If nobody decides, the coordinator's tokens are counted by hand, with the same four kinds. The recommendation is to decide in the US-9 ticket, and to add an option to `cstack measure` only if the count by hand is error-prone.
4. **Runs in progress during an upgrade.** R2 removes commands, and R3 changes the plan format. A run started with 0.3.x and resumed after an upgrade would find missing commands, and `cstack` would refuse its plan. If nobody decides, `cstack` refuses a plan whose format it does not know, and it names the version that reads it. The recommendation is to finish every run in progress before an upgrade, and to say so in the release notes. Installing the previous release brings back the previous `cstack` and its skills together.
5. **The cost of the guards.** The report per case and the step that breaks a rule add test runs. If nobody decides, each step runs the test command of the settings file. The recommendation is that the step that breaks a rule runs only the test file of the negative test, as US-7 says.

**ADR candidates, to create**

- **ADR-RQG-A, how helpers and units run inside a ticket.** The options are Orca workers, sub-agents in their own worktrees, or sub-agents one after the other in the ticket's workspace. The interview chose sub-agents, one after the other, chosen by the ticket's session as the skill guides it. This replaces ADR-SIC-A. The US-3 ticket writes it.
- **ADR-RQG-B, version 2 of the plan format.** The options for facts are free prose checked by the reviews, or a fixed list that `cstack` checks. The interview chose the fixed list, plus the named test cases of US-6. The US-8 ticket writes it.
- **ADR-RQG-C, how the audit knows the expected steps.** The options are a list in the code, a reading of the prose of the guides, or a block of steps in each guide. The interview chose the block in each guide. The US-1 ticket writes it.

## 10. Challenged choices

- **Orca workers for the helpers of a ticket.** Version 0.3.1 ran them as Orca workers. The maintainer chose to let Claude Code start its own helpers as sub-agents, as with the prose skill.
- **Parallel units with Orca workers in child workspaces.** The agent proposed them as a later option. The maintainer refused: inside a ticket, Claude works with its sub-agents only. The coordinator's first draft also proposed sub-agents in their own worktrees, which was dropped for the same reason.
- **A guide for the coordinator, served by `cstack guide`.** The agent proposed it. The maintainer dropped it, because Orca's orchestration already runs a wave well. The guide comes back if the coordinator starts a ticket before its blocker is merged.
- **Questions through the coordinator, with `orca orchestration ask`.** It was considered. The maintainer keeps answering in each worker's chat, which works today.
- **Orca's task graph for the order of tickets.** It was considered. It is not used, because a worker reports when its pull request opens, before the merge.
- **A sentence in the skill that says the helpers are sub-agents.** The agent proposed it, to stop a Claude from starting Orca workers by mistake. It was dropped, because the guides already say "fresh sub-agent" at each step where they start a helper.
- **The coordinator's tokens added to each run.** The agent first proposed it. It became a separate figure, because a coordinator serves a whole wave in real use.
- **An audit that stops a run.** It was rejected. The guides and the commands already stop a run, and the audit measures what still escapes them.
- **A new command that lists the ready tickets.** It became an option of `cstack tracker list`, because listing tickets is a tracker read.
- **Input tokens as a reason to stop.** The token measure keeps the four kinds, but the input tokens alone cannot trigger the stop.
- **Fewer units per plan.** #87 found that the finer units of runs 3 and 4 cost about 1.2 million cache read tokens per run. The maintainer kept the size of the units, because the blind review does not show that fewer units would be better. Run 3 ranked first and run 4 last, with the same number of units.

## 11. Glossary

- **The coordinator** is the Claude session in the main Orca workspace. The maintainer talks to it to start a wave. It starts one worker per ticket and reports to the maintainer.
- **The special coordinator** is a coordinator that only serves runs 5 and 6, so that its tokens can be measured on their own.
- **A ticket worker** is the Orca worker that resolves one ticket with `/resolve-issue`, in its own workspace.
- **A helper** is a fresh agent that `resolve-issue` starts inside a ticket for one job. The executor and the implementers are helpers.
- **A sub-agent** is a helper that Claude Code starts inside its own session, with its Agent tool.
- **An Orca worker** is a full Claude Code session that Orca starts and supervises. It ends with an explicit final report, `worker_done`.
- **A ready ticket** is open and not "in progress", and all its blockers are done, cancelled or duplicates.
- **A wave** is the set of tickets that can start at the same time, because nothing blocks them. Each wave is a GitHub milestone.
- **The CTO advisor** is a helper of `resolve-issue` that raises the questions a technical lead would ask, at three moments of a run.
- **A step** is one thing that `resolve-issue` requires: a phase, a command that a guide requires, or a check that the skill gives to a helper.
- **The audit** is the `cstack` command that says which steps a run did, skipped or did out of order.
- **A fact line** is one line of the "Facts" list of a plan. It states a fact and names its source.
- **A breaking patch** is a small change that breaks the rule that a negative test protects. `cstack` applies it, checks that the negative test fails, and removes it.
- **A report per case** is a test report that gives a result for each test case, in the JUnit XML format.
- **Runs 1 and 2** are the baseline runs of the prose skill. **Runs 3 and 4** are the runs of `cstack` 0.3.1. **Runs 5 and 6** are the runs of the version that this project releases.
