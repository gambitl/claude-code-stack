# Skills into CLI

Epic: https://github.com/gambitl/claude-code-stack/issues/6

## 1. Context and problem

This project moves the mechanical steps of two Claude Code skills out of long prose and into a tested command-line tool. A skill is a markdown file of instructions that Claude loads when a task matches it. The two skills are `resolve-issue`, first, and `create-tickets`, second. The tool is called `cstack`. Claude keeps every step that needs judgment, such as asking questions, planning, writing code, reviewing and documenting. `cstack` takes the steps whose correct result is fully decided by their inputs. Checking that a file has all its sections and pushing a branch only once are examples of such steps.

A short reminder of how `resolve-issue` works helps to read this page. The skill takes one ticket from the tracker, which is the tool that holds the tickets, to a pull request. It writes everything about the ticket into a markdown file in the repository, called the plan file. The plan splits the work into small units, and each unit has its own test and its own commit. The main conversation asks the user questions, writes the plan and waits for the user's approval. Then it hands the build to helpers that start with an empty context. Claude Code starts these helpers as sub-agents. The executor is the helper that runs the build, and it starts one implementer per unit of the plan. At the end of every run, the skill writes a short retrospective that records what went wrong.

Two kinds of people run these skills. The maintainer of this repository writes and improves them. A small team of solution engineers, the maintainer included, runs them every day on client tickets. Everyone on the team works on macOS. Everyone also uses Orca, a desktop app that runs several coding agents side by side. Orca gives each agent its own git worktree, which is a second working folder of the same repository.

The work starts now because of three problems. First, a run of `resolve-issue` uses a large share of the Claude subscription quota, and it takes a long time. Part of the reason is that the model reads several thousand words of instructions, and many of them describe steps that a script could do. Second, the skills cannot be tested. Every change to a skill is a risk, because nothing tells the maintainer whether it broke something. Third, the retrospectives of past runs show that the most frequent problems are mechanical. The paragraph below lists them.

An executor reports before its implementers have finished. A test is never seen failing before its code is written. The plan file no longer matches what git holds. Implementers that run in parallel collide in the same worktree. A rule of the skill contradicts the conventions of the repository. A write to the tracker is refused, even after the user approved it.

The idea came from a suggestion that skills could be replaced by a command-line tool. This project does not take that idea as a goal. It tests the idea with a measured comparison on a real ticket. It then decides from the result whether to continue.

The expected outcome is a short skill that calls `cstack` for every mechanical step. That skill reads its instructions one phase at a time instead of all at once. The code behind it has tests that run on every pull request. When Orca is available, `cstack` uses Orca's own command-line tool. When Orca is not there, `cstack` falls back to plain Claude Code.

## 2. Success measures

The project succeeds when the five measures below are met. Milestone 4 checks all of them except reliability. Reliability needs ten runs after the first release, so it is checked later.

The measures compare two versions of `resolve-issue` on the same ticket. Milestone 1 copies a real development ticket, called the comparison ticket. It then runs today's skill twice on that copy. These two runs are the baseline runs. Milestone 4 runs the new version twice on the same copy.

1. **Quota.** On the comparison ticket, a run of the new version uses fewer tokens than the average of the two baseline runs. Claude Code records four kinds of tokens, which are input, cache creation, cache read and output. The comparison checks each kind on its own, because they do not weigh the same on the quota. The instructions that a run loads at its start also shrink to less than a fifth of their size today.
2. **Waiting time.** The time from the user's approval of the plan to the "ready for review" state is shorter than the average of the two baseline runs.
3. **Reliability.** The ten runs that follow the first release have at least half as many mechanical problems per retrospective as the retrospectives written before `cstack`.
4. **Testability.** Every `cstack` command has automated tests. They run in continuous integration (CI), the service that checks every pull request. CI also fails when a skill or a phase guide names a `cstack` command that does not exist.
5. **Quality.** A fresh reviewer compares the branches of the old and the new version without knowing which version made which branch. The reviewer judges the new version at least as good as the old one. The number of judgment problems per retrospective does not go up.

The token and time results are published in this repository. No other figure taken from work is published, as the public text rule of section 5 says.

## 3. Personas

**The maintainer.** The maintainer owns this repository and writes the skills. They want to change a skill without the fear of breaking it. They also want numbers that say whether a change helped.

**A solution engineer.** A solution engineer on the maintainer's team runs `resolve-issue` and `create-tickets` on client tickets, inside Orca, on a Mac. They want a run to finish without stopping halfway. They want a run to use less of their quota. They want to install and update the tools in one step.

## 4. User stories

### Rules for every story

These rules apply to every story below, so the stories do not repeat them.

- **Orca when available, with a fallback.** Every feature that uses Orca also works without Orca. `cstack` checks Orca feature by feature. For example, when Orca runs but is not connected to the tracker, only the tracker access falls back.
- **No credentials in `cstack`.** `cstack` never stores a token or a password. It reaches a tracker or a forge only through a command-line client that is already logged in on the machine, such as `orca`, `glab` or `gh`. When no such client exists, Claude reads the tracker with its own connection, and it hands the data to `cstack` as a file.
- **Tool-agnostic.** No story assumes one specific tracker or forge. The tracker can be Jira, GitLab, GitHub or Linear. The forge, which hosts the code and the pull requests, can be GitLab or GitHub.
- **Ticket text is data.** `cstack` treats the text of a ticket, a comment or a plan as data. It never runs a command because such a text asks for it.
- **Claude is the only default agent.** Another agent can be used only where the settings file of the repository names it.
- **macOS only.** No story supports another operating system.
- **Public text.** Every text in this repository or in its issues follows the public text rule of section 5.

### Milestone 1: Foundation and baseline

#### US-1: The repository becomes the source of the skills and of `cstack`

As the maintainer, I want this repository to hold the original of the skills and of `cstack`, with tests and CI, so that code can live here and be tested.

- AC1: The `cstack` code, its tests and its own skills live in one folder of the repository. CI runs the tests on every pull request.
- AC2: `sync.sh` keeps copying the personal configuration from `~/.claude`. It no longer deletes or copies the `skills/` folder.
- AC3: The prose skills stay in `skills/` as they are today. A git tag marks their last version. The README says that they are frozen and no longer improved.
- AC4: The README explains the new role of the repository. It says that the repository is public, and it replaces the section that calls it private.
- AC (negative): A run of `sync.sh` never overwrites a file in the `cstack` folder or in `skills/`.

#### US-2: Install `cstack` and its skills in one step

As a solution engineer, I want to install `cstack` and its skills with one command and to update both together, so that a skill never names a command that my `cstack` does not have.

- AC1: Each version of `cstack` is published as a GitHub release with a packaged file attached. The command `npm install -g <release link>` installs it.
- AC2: `cstack skills install` writes the short skills and the agent prompts where Claude Code loads them.
- AC3: `cstack guide <phase>` prints the guide of one phase, at the version of `cstack` that is installed.
- AC4: Installing the previous release brings back the previous `cstack` and its skills together.
- AC (negative): `cstack skills install` never overwrites a skill folder that it did not write. It skips that folder and says so.

#### US-3: Know what is missing on the machine

As a solution engineer, I want one command that checks everything `cstack` needs, so that I know what to install before a run fails.

- AC1: `cstack doctor` checks macOS, Node, git, Graphify, the forge client (`gh` or `glab`) and Claude Code. Graphify is the code graph tool that `resolve-issue` reads to map the code. For each requirement, `cstack doctor` prints whether it is present and its version. It also prints how to install it when it is missing.
- AC2: `cstack doctor` reports whether Orca is available and whether its version is supported. It also lists the trackers that Orca is connected to.
- AC3: The README has a "Requirements" section with the same list. A CI test fails when the list in the README and the list in `cstack doctor` differ.

#### US-4: Measure a run

As the maintainer, I want to measure the tokens and the time of a `resolve-issue` run, so that I can compare two versions with numbers.

- AC1: `cstack measure <plan file>` finds the Claude Code session files of the run, its helpers included. It prints the four kinds of tokens separately.
- AC2: It prints the time from the approval of the plan to the "ready for review" state. It reads both moments from the plan file.
- AC3: It works on runs made before `cstack` existed, so that the baseline runs can be measured.
- AC (negative): It prints only numbers. It never prints, copies or sends the content of a session.

#### US-5: Baseline runs of today's skill

As the maintainer, I want two runs of today's `resolve-issue` on a copy of a real development ticket, so that the comparison has a reference.

- AC1: The maintainer picks a ticket of medium size that already has the standard ticket shape. Its repository has a Graphify graph.
- AC2: The ticket is copied into a private sandbox repository. The runs use a copy of the code repository whose conventions file sends every external write to that sandbox.
- AC3: Each run stops before publication, so nothing is pushed to the real forge.
- AC4: Both runs start from the same commit. `cstack measure` records the measures of each run.
- AC (negative): No run writes to the real tracker, the real forge or the real documentation tool.

### Milestone 2: Reliable build loop

#### US-6: Know where the run stands, one phase at a time

As a solution engineer, I want `cstack` to keep the state of the run and to give Claude only the instructions of the next phase, so that no step is skipped and the model reads less.

- AC1: `cstack next` reads the state of the run and prints only the guide of the next phase.
- AC2: `cstack next` refuses to start a phase before the phases it depends on are done. For example, it refuses to start the briefing before the documentation step is done. The briefing is the summary of what was built, which the user reads at the end of the run.
- AC3: The plan file states its format version in its header. `cstack` refuses a plan file whose version it does not know, and it says which version of `cstack` can read it.
- AC4: The short skill that starts a run is less than a fifth of the size of today's main skill file and writing guide together.

#### US-7: Trust the plan file

As a solution engineer, I want the status of each unit to come from git, so that a "done" report is never false.

- AC1: `cstack plan status` derives the status of each unit from the commits that name that unit.
- AC2: `cstack plan section <name>` prints exactly one section, even when another heading starts with the same words.
- AC3: `cstack` refuses a "done" report while a required section is missing or a unit has no commit.

#### US-8: Prove that each test failed first

As a solution engineer, I want `cstack` to record that the test of each unit failed before its code was written, so that test-first really happens.

- AC1: `cstack unit red <n>` runs the test command of the repository. It requires a failure, and it saves the output.
- AC2: `cstack unit green <n>` refuses the code of a unit that has no saved failing run.
- AC3: A unit without a test, such as a documentation change, is accepted only when the plan marks it "no test" and gives a reason.

#### US-9: Trust the reports of the helpers

As a solution engineer, I want `cstack` to refuse an incomplete report from a helper, so that a run does not stop halfway.

- AC1: The executor has four allowed reports, which are done, needs-decision, failed and published. `cstack` accepts a report from the executor only when it is one of them. It refuses any other report with a clear message.
- AC2: `cstack` compares the files that each unit plans to touch. It runs units that share a file one after the other.
- AC3: Each unit commits through `cstack unit commit`, which stages only the files of that unit.
- AC (negative): A commit of one unit never includes a file of another unit.

#### US-10: Follow the rules of the repository

As a solution engineer, I want one settings file per repository that states the rules the skill must follow there, so that the skill stops contradicting the repository.

- AC1: The settings file states whether the repository merges or rebases, the language of the written records, the forbidden tools, the commit attribution rule and the test commands. It also states the agent and the model of the independent review.
- AC2: `cstack` reads the settings file at the start of a run, and every phase guide applies it.
- AC3: The review agent is Claude when the settings file says nothing.
- AC (negative): `cstack` refuses a settings file that has an unknown key, and it names that key.

#### US-11: Keep the code graph fresh

As a solution engineer, I want `cstack` to check that the Graphify graph matches the current commit, so that the code mapping and the reviews never use old data.

- AC1: `cstack graph ensure` compares the graph with the current branch and commit. It runs `graphify update .` when they differ.
- AC2: When Graphify is missing, it says how to install it. The run then continues with search and file reads, as it does today.

#### US-12: Publish with one push

As a solution engineer, I want `cstack` to push the branch only once the work is finished, so that CI runs once and nothing leaves the machine too early.

- AC1: `cstack publish` refuses to push while a blocking question has no answer. A blocking question is a question whose answer can change what the ticket builds. `cstack publish` also refuses while the plan is not "ready for review".
- AC2: It brings the branch up to date and pushes it once. It opens the pull request or merge request with the title and the body drafted in the plan file. Then it waits for the checks.
- AC3: It reads the checks only after the last push.
- AC4: It works with GitHub through `gh` and with GitLab through `glab`.

### Milestone 3: Orca integration

#### US-13: Helpers that finish before they report

As a solution engineer, I want the executor and the implementers to run as Orca workers when Orca is available, so that the main conversation acts only when their work is really done.

- AC1: When Orca is available, the executor and each implementer run as Orca workers. An Orca worker ends with an explicit final report, and Orca wakes the coordinating conversation only then.
- AC2: When Orca is available, each implementer that runs in parallel works in its own child worktree.
- AC3: Without Orca, the helpers stay Claude Code sub-agents, and `cstack` checks their reports as US-9 describes.
- AC4: Tests check `cstack` against recorded answers of Orca, so that a change in the output of Orca fails CI.

#### US-14: Launch a wave of tickets

As a solution engineer, I want one command that starts every ticket of a milestone that is ready now, each in its own worktree, so that I start a whole wave in one step.

- AC1: `cstack wave --milestone <name>` lists three groups. The first group holds the tickets that are ready. The second holds the blocked tickets, each with what blocks it. The third holds the tickets already started.
- AC2: A ticket is ready when three things are true. All its blockers are done, cancelled or duplicates. It is not in progress. It has no worktree yet.
- AC3: After the user says yes, and when Orca is available, each ready ticket gets an Orca worktree linked to its ticket key. Claude starts in that worktree with `/resolve-issue <key>`.
- AC4: Without Orca, `cstack` creates a git worktree for each ready ticket. It prints one command per ticket, which the user pastes to start Claude there.
- AC (negative): `cstack wave` never starts a ticket before the user says yes. It never starts a blocked ticket.

#### US-15: Be told when a ticket becomes ready

As a solution engineer, I want `cstack` to watch the tracker and to tell me when a blocked ticket becomes ready, so that I do not have to check by hand.

- AC1: `cstack wave --watch` reads the tracker at a regular interval. The settings file sets that interval.
- AC2: When a ticket becomes ready, it sends a macOS notification and asks whether to start that ticket.
- AC3: A blocker counts as done only when its ticket is in a done state. In practice, its pull request has been merged.
- AC4: It needs a tracker client on the machine. Without one, it says so, and the user runs `cstack wave` again by hand.
- AC (negative): It never starts a ticket before the user says yes.

#### US-16: Reach the tracker through Orca when Orca supports it

As a solution engineer, I want `cstack` to read and write the tracker through Orca when Orca supports that tracker, so that writes made by helpers stop being refused.

- AC1: When Orca is connected to the tracker, `cstack` reads tickets, moves their state and adds comments through Orca. Orca supports Jira and Linear today.
- AC2: When Orca does not support the tracker, `cstack` uses the command-line client of the tracker, such as `glab` or `gh`.
- AC3: When no client exists, Claude reads and writes the tracker with its own connection, as it does today.
- AC4: One permission rule in Claude Code allows `cstack`, and it covers every tracker write that goes through `cstack`.

### Milestone 4: Comparison and decision

#### US-17: Compare the two versions and decide

As the maintainer, I want two runs of the new version on the same ticket copy, compared with the baseline, so that I decide with evidence whether to continue.

- AC1: The two new runs use the same ticket copy, the same starting commit and the same sandbox as the baseline runs.
- AC2: A fresh reviewer compares the four branches without knowing which version made which branch. The reviewer says which branch is better, and why.
- AC3: The comparison reports every measure of section 2 except reliability, which needs more runs.
- AC4: An architecture decision record (ADR) records the decision to continue or to stop, with the token and time results. An ADR is a short page that explains one technical choice and its reasons.

### Milestone 5: create-tickets push

#### US-18: Push an approved ticket skeleton

As a solution engineer, I want `cstack` to create every ticket of an approved skeleton in one command, so that `create-tickets` stops spending tokens and making mistakes on bulk writes.

- AC1: The skeleton is the table of tickets that the user approves in `create-tickets`. Claude writes the approved skeleton and the full ticket bodies into a file. `cstack tickets push <file>` creates the tickets with their labels, their milestones and their blocking relations.
- AC2: Some tracker clients cannot link two tickets. In that case, `cstack` lists the missing links, and Claude creates them with its own connection.
- AC3: Running the same file a second time creates no duplicate.
- AC4: This milestone starts only if the decision of milestone 4 is to continue.

## 5. Scope

**In scope**

1. The mechanical steps of `resolve-issue` move into `cstack`. Its instructions are served one phase at a time.
2. The bulk creation of tickets that `create-tickets` does after its skeleton is approved moves into `cstack`.
3. The repository gets its new role, the install of `cstack` and its skills, and the machine check.
4. `cstack` uses Orca when it is available, with a fallback for every feature.
5. The project measures runs and compares the two versions on a copy of a real ticket.

**Out of scope**

1. `design-project`, `digest-retros` and `linear-release-note` stay as they are. They are mostly judgment, so code would bring little. They can be looked at after the decision of milestone 4.
2. The judgment problems that the retrospectives report stay out. An example is a fact in a plan that nobody checked. Code cannot fix such problems, which need work on the prose.
3. No agent other than Claude is used by default. Another agent is possible only through the settings file of the repository.
4. No system configures every role of every agent. Only the review agent and its model can change, in the settings file. Nobody needs more today.
5. No program runs the whole workflow with the Claude Agent SDK. The Claude Agent SDK is a code library that lets a program call Claude. Such a program would lose the conversation with the user. It would also lose the independence from the harness, which is the app that runs Claude, such as Claude Code or Orca.
6. No coordinator develops a whole epic from the main Orca workspace. An epic is a group of tickets that together deliver one project. Such a coordinator would gather the questions of every ticket and start the next ticket after each merge. It will be the next epic, designed after the decision of milestone 4. The wave launch of milestone 3 is its first building block.
7. No Orca panel shows the runs. A future panel is the reason the code is in TypeScript, but this project does not build it.
8. No operating system other than macOS is supported. The whole team works on macOS.
9. The new skill has no prose fallback for when `cstack` is missing. Such a fallback would keep the long prose and lose the token gain. People who do not want `cstack` keep the frozen prose skills instead.
10. The prose skills get no further improvement. They are frozen at a tag.

**Public text rule**

This repository is public. No text in it or in its issues names an employer or a client. No text quotes a ticket key from work. No text gives a count taken from work retrospectives. The token and time results of the comparison are the only figures from work that are published. The copy of the work ticket lives only in a private sandbox repository.

## 6. Milestones and sequencing

**M1 Foundation and baseline.** This milestone makes the repository the source of the skills and of `cstack`, and it measures today's skill before anything changes. It carries US-1 to US-5. It blocks every other milestone. The baseline runs must happen before milestone 2 changes the skill.

**M2 Reliable build loop.** This milestone moves the mechanical steps of the build into `cstack`, with the checks that make them reliable. It carries US-6 to US-12. Milestone 1 feeds it, and it feeds milestones 3 and 4.

**M3 Orca integration.** This milestone uses Orca for the helpers, the wave launch and the tracker, with a fallback for each. It carries US-13 to US-16. It needs the report checks and the plan state of milestone 2. It feeds milestone 4.

**M4 Comparison and decision.** This milestone compares the new version with the baseline and records the decision to continue or to stop. It carries US-17. It needs milestones 1 to 3. Its decision opens or closes milestone 5 and the next epic.

**M5 create-tickets push.** This milestone moves the bulk creation of tickets into `cstack`. It carries US-18. It starts only after a decision to continue.

## 7. Where things are today and technical context

**This repository.** Before this project, the repository is a copy of the personal Claude Code setup. Editing a file here does not change how Claude Code behaves.

- `config/` holds a copy of the global instructions, the settings, the status line and the list of plugins.
- `scripts/` holds two Python helpers that `sync.sh` uses.
- `skills/` holds five skills, which are `create-tickets`, `design-project`, `digest-retros`, `linear-release-note` and `resolve-issue`.
- `sync.sh` copies the setup from `~/.claude` into the repository. On each run, it deletes `skills/` and copies it again from `~/.claude/skills`. US-1 changes this.
- `pull-skills.sh` copies the skills from the `main` branch on GitHub into `~/.claude/skills`, after it backs up the old ones.
- `INVENTORY.md` is a summary that `sync.sh` rebuilds on each run.
- The repository has no tests and no CI. Its conventions file, `CLAUDE.md` at the root, arrives with this page.

**`resolve-issue` today.** The skill is the largest one, at about 17,400 words in total. `SKILL.md` has about 6,100 words, and `writing.md`, the writing guide, has about 1,100 words. The main conversation loads both at the start of a run. The executor prompt, `agents/executor.md`, has about 3,400 words. The other agent prompts and the two templates make up the rest. Claude Code loads the folder as a plugin named `resolve-issue`, and its agents are named `resolve-issue:<name>`.

`resolve-issue` has a list of settled decisions. This project touches four of them.

- The skill stays independent of the harness and the tracker. The fallback rule of section 4 keeps that decision.
- The model and the thinking level of each role are set in the header of each agent prompt. The settings file of US-10 can change the review agent and its model, so this decision is reopened in an ADR.
- Every commit stays on the local branch until one final push. `cstack publish` keeps that decision and enforces it.
- One approval gate stops the run before the build. This project does not change it.

**`create-tickets` today.** `SKILL.md` has about 2,700 words. After the user approves the skeleton of tickets, Claude creates each ticket one by one through the connection of the tracker.

**External tools.**

- Graphify is a code graph tool written in Python and installed with `uv`. `resolve-issue` uses its commands `graphify update`, `graphify query`, `graphify explain` and `graphify affected`.
- `gh` is the GitHub command-line client, and `glab` is the GitLab one.
- Orca has a command-line tool named `orca`, at version 1.4 when this page was written. `orca status` says whether Orca runs. `orca worktree create` creates a worktree. Its `--reference` option links the worktree to a ticket. Its `--agent` option starts an agent in the worktree. `orca orchestration worker-start` starts a worker, which ends with a `worker_done` report. `orca reference find` finds the workspaces linked to a ticket. `orca jira` and `orca linear` read and write those two trackers. `orca jira` has no command to link two issues.
- Orca ships its own skills with its command-line tool, through `orca skills install` and `orca skills get`. The installed skill is a short entry point, and the full guide comes from the tool at its own version. `cstack` follows the same pattern.
- Claude Code writes one session file per conversation, in JSON Lines format, under `~/.claude/projects/`. Each answer of the model records its usage in four fields, which are `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` and `output_tokens`.

**Language.** `cstack` is written in TypeScript and runs on Node.

## 8. Design briefs

This project has no design surface. It builds a command-line tool and prose only. An Orca panel is out of scope, as section 5 says.

## 9. Open questions and ADR candidates

**Open questions**

1. **Minimum Orca version.** Orca changes fast, and some of its commands are already marked as retired. If nobody decides, the minimum is the version installed when milestone 3 starts. The recommendation is to pin that version in `cstack doctor` and to keep the tests on recorded Orca answers.
2. **Links between tickets.** Some tracker clients cannot link two tickets, and `orca jira` is one of them. If nobody decides, Claude creates the missing links with its own connection, as US-18 says. The recommendation is to keep that default.
3. **Token target.** The success measure asks for fewer tokens than the baseline, with no percentage. If nobody decides, that stays the target. The recommendation is to keep it, and to add a percentage after the baseline runs only if the maintainer wants one.
4. **Comparison ticket.** The ticket is not chosen yet. If nobody decides, the maintainer picks it at the start of milestone 1. The recommendation is a ticket of medium size, in the standard shape, in a repository with a Graphify graph.
5. **Units without a test.** Some units, such as documentation changes, have no test. If nobody decides, the plan marks such a unit "no test" with a reason, as US-8 says. The recommendation is to keep that default.
6. **Node version.** If nobody decides, `cstack` targets the current long-term support release of Node. The recommendation is to state the minimum in `package.json` and in the README.
7. **Watch interval.** `cstack wave --watch` reads the tracker at a regular interval. If nobody decides, the interval is five minutes. The recommendation is to make it a key of the settings file, so that a team can lower the load on its tracker.
8. **Sandbox repository.** The baseline runs need a private sandbox. If nobody decides, `cstack` uses a private GitHub repository that the maintainer approves at the start of milestone 1. The recommendation is to keep that default.

**ADR candidates, to create**

- **ADR-SIC-A, how the helpers run.** The options are Orca workers, Claude Code sub-agents, or both. The interview chose Orca workers when Orca is available and sub-agents otherwise.
- **ADR-SIC-B, where the run state lives and how its format is versioned.** The options are a header in the plan file, a separate state file, or both. Ticket #13 chose both: the plan file keeps what people read and what must travel with the branch, and the run state under the common git folder keeps what only `cstack` needs. The record is in [`docs/decisions/ADR-SIC-B-run-state.md`](../decisions/ADR-SIC-B-run-state.md).
- **ADR-SIC-C, how `cstack` ships its skills.** There are three options. `cstack` can ship and serve the skills itself. A Claude Code plugin marketplace can ship them, with a separate install of `cstack`. The skill sharing link of Orca can ship them too. The interview chose skills shipped and served by `cstack`, because the skill and the tool can then never drift apart. The record is in [`docs/decisions/ADR-SIC-C-how-cstack-ships-its-skills.md`](../decisions/ADR-SIC-C-how-cstack-ships-its-skills.md).
- **ADR-SIC-D, the settings file and the models of the agents.** The settings file can change the review agent and its model, which the agent headers set today. This reopens a settled decision of `resolve-issue`. The record is in [`docs/decisions/ADR-SIC-D-settings-file-and-review-model.md`](../decisions/ADR-SIC-D-settings-file-and-review-model.md).
- **ADR-SIC-E, the new role of the repository.** The repository becomes the source of the skills and of `cstack`. The personal configuration is still copied from `~/.claude`. The record is in [`docs/decisions/ADR-SIC-E-new-role-of-the-repository.md`](../decisions/ADR-SIC-E-new-role-of-the-repository.md).
- **ADR-SIC-F, how `cstack` reaches trackers and forges.** `cstack` uses command-line clients that are already logged in, or data that Claude hands over in a file. It never holds credentials.
- **ADR-SIC-G, continue or stop.** Milestone 4 creates this record with the results of the comparison.
- **ADR-SIC-H, how a `cstack` command starts and ends.** The options are one entry file that does everything, or a separate entry file with an asynchronous `run` function that other code and tests can call. Ticket #7 chose the separate entry file. The record is `docs/decisions/ADR-SIC-H-how-a-cstack-command-starts-and-ends.md`.

## 10. Challenged choices

- **TypeScript instead of Python.** The interview recommended Python, because the existing scripts are in Python and Graphify installs with `uv`. The maintainer kept TypeScript, because Orca plugins are written in TypeScript and a future Orca panel could then share the code.
- **"As much code as possible."** The first request was to turn the skills into code as much as possible. The interview argued that code which tries to replace judgment does worse than the prose. The goal became to move only the mechanical steps.
- **Testing a friend's idea.** Testing the suggestion that skills can be replaced was proposed as a goal. The interview argued that it is not a problem to solve. It became the measured comparison of milestone 4.
- **Reliability as a goal.** The maintainer first named quota, waiting time and testability as the problems. The retrospectives showed that mechanical problems are the most frequent ones, so reliability was added as a measured goal.
- **A second review by another model family.** A review by a non-Claude agent was proposed. It was dropped, because the team uses only Claude. The review agent stays configurable in the settings file.
- **A full configuration system for the agents.** It was reduced to the review agent and its model, because nobody needs more today.
- **A command that launches one ticket.** It was dropped, because it saves only a few clicks compared with the Orca interface. The wave launch replaced it.
- **A wave launch that refuses to run without Orca.** It was replaced by a fallback that creates git worktrees and prints one command per ticket.
- **A program in charge, built on the Claude Agent SDK.** It was rejected, because Claude would lose the conversation with the user. The skill would also lose its independence from the harness.
- **A coordinator for a whole epic.** It was moved to the next epic, because it needs the verdict of milestone 4 and touches the approval gate.
- **A private repository.** The repository stays public by choice. The public text rule of section 5 protects work information instead.
- **A prose fallback inside the new skill.** It was rejected, because it would keep the long prose. The frozen prose skills serve the people who do not want `cstack`.

## 11. Glossary

- **`cstack`** is the command-line tool that this project builds. It does the mechanical steps of the skills. It also installs and serves the skills.
- **A phase guide** holds the instructions of one phase of `resolve-issue`. `cstack guide <phase>` and `cstack next` print one guide at a time.
- **A run** is one execution of `resolve-issue` on one ticket, from the question round to the pull request.
- **The plan file** is the markdown file in which `resolve-issue` records everything about one ticket.
- **A helper** is a fresh agent that `resolve-issue` starts for one job. The executor and the implementers are helpers.
- **A wave** is the set of tickets of one milestone that can start at the same time, because nothing blocks them.
- **A ready ticket** has all its blockers done, cancelled or marked as duplicates. It is not in progress, and it has no worktree yet.
- **An Orca worker** is an agent that Orca starts and supervises. It ends with an explicit final report.
- **A baseline run** is a run of today's `resolve-issue` on the comparison ticket, made before any change.
- **A mechanical problem** happens in a step whose correct result is fully decided by its inputs. Code could do such a step right every time.
- **A judgment problem** is about the quality of a decision or of a text, such as a weak plan or an unclear question.
- **A tracker client** is a command-line tool that is already logged in to a tracker, such as `orca`, `glab` or `gh`.
- **The settings file** is the file in each repository that states the rules a run must follow there.
