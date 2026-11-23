# ADR-SIC-G: Continue or stop

Status: accepted, 2026-11-20.
Ticket: https://github.com/gambitl/claude-code-stack/issues/33

## Context

The project "Skills into CLI" moves the mechanical steps of the `resolve-issue` skill into `cstack`, a command-line tool. Section 2 of the specification sets five success measures. Milestone 4 compares the new version with today's prose skill, called the baseline, on one copy of a real development ticket. Two baseline runs were made with ticket #12, and two runs of the new version with ticket #32. The new version is `cstack` 0.3.1, where the executor and each implementer run as Orca workers.

The four runs used the same ticket text, the same starting commit, the same model and the same effort level. Each run stopped after its retrospective. Ticket #32 lists the small differences of setup. All four runs were measured with `cstack measure` 0.3.1, from a copy of each run's session files only.

This record gives the token and time results, as the specification allows. For every other measure, it says only in words whether the measure was met.

## Results

### Tokens

| Kind of token | Baseline run 1 | Baseline run 2 | Baseline average | New run 3 | New run 4 | New average |
|---|---|---|---|---|---|---|
| Input | 558 | 568 | 563 | 614 | 614 | 614 |
| Cache creation | 1,303,293 | 1,517,789 | 1,410,541 | 1,559,552 | 1,568,313 | 1,563,933 |
| Cache read | 24,987,467 | 26,477,343 | 25,732,405 | 33,430,585 | 31,834,097 | 32,632,341 |
| Output | 209,814 | 212,788 | 211,301 | 231,759 | 221,751 | 226,755 |

Each new run uses more tokens than the baseline average, for each of the four kinds. The Opus tokens are about the same in both versions. Most of the extra tokens are Sonnet tokens, and Sonnet is the model of the executor and the implementers.

The cause is visible in the session files. In the baseline runs, the executor and the implementers are sub-agents inside one Claude Code session. A sub-agent starts with about 46,000 to 51,000 tokens of context. In the new runs, they are Orca workers, and each worker is a full Claude Code session. A worker starts with about 60,000 to 66,000 tokens of context, and it reads that context again at every call. Over the Sonnet calls of one new run, this alone adds about 2.3 million cache read tokens.

**Correction on 2026-11-23.** An earlier version of this record said about 4.5 million tokens here. That estimate counted the lines of the session files, but Claude Code writes one answer of the model on several lines. Counted once per answer, as `cstack measure` counts, the figure is about 2.3 million. #87 gives the whole split of the gap.

The instructions that a run loads at its start had to shrink to less than a fifth. The prose skill loads `SKILL.md` and `writing.md`, which hold 7,259 words at the tag `prose-skills-final`. A fifth is 1,451 words. The new version loads its `SKILL.md` and the guide of its first phase, which hold 1,444 words. So this part is met, by a small margin.

### Waiting time

| Run | Minutes from approval to ready for review |
|---|---|
| Baseline run 1 | 14 |
| Baseline run 2 | 17 |
| Baseline average | 15.5 |
| New run 3 | 19 |
| New run 4 | 23 |
| New average | 21 |

The new version writes its approval time before the executor starts. For the baseline, `cstack measure` takes the first commit of the plan file, which comes a little later. So the new runs are measured over a slightly longer window. The new runs also split the ticket into more units than the baseline runs.

### The five measures

1. **Quota: not met.** Every kind of token went up. The size of the instructions at the start of a run is met.
2. **Waiting time: not met.**
3. **Reliability: checked later**, after ten runs of a release, as the specification says.
4. **Testability: met.** Every command has automated tests. `cstack/test/manifest.test.ts` fails when a skill or a guide names a command that does not exist. CI is green on `main`.
5. **Quality: half met.** A fresh Claude Code session reviewed the four branches without knowing which version made which. The two versions tied. The new version made both the best branch and the weakest one. The number of judgment problems per retrospective went up slightly, so the second part of this measure is not met.

## Why one new run made the weakest branch

The two new runs had the same version, the same ticket and the same answers. Their plan files show three differences, and each one is a judgment step that nothing caught.

1. **The reviews of one run found nothing.** In the other run, the code reviewers found a negative test that proved the wrong rule, and the run fixed it. The weakest branch kept the same flaw, because its reviewers missed it. The quality of a run depended on the luck of its reviews.
2. **A test passed before its code existed, and the run still went on.** `cstack unit red` accepts a unit as soon as the test file fails as a whole. In the weakest branch, new negative tests of a route passed before the route existed, because a missing route gives the same error. Another test of the same file failed, so the unit was accepted.
3. **The plan held an unchecked claim and an unrequested change.** An advisor of the run stated a false fact about the database security in production, and the plan accepted it by default. The claim then became a wrong code comment. The plan also changed the signature of a function that the ticket had fixed, as an assumption that nobody asked the user about.

## Decision

The project continues, with two changes of direction.

**First, `cstack` becomes the command-line tool of `resolve-issue`, and Orca organises the agents.** `cstack` turns each step of the skill into a command that checks the step and records it, so that no agent can skip a step or change their order. `cstack` does not rebuild what Orca already does. The target use case starts in the main workspace. The maintainer asks Claude to develop the next wave of tickets. Claude then follows Orca's own orchestration guide: each ticket runs as an Orca worker in its own workspace, in the order of the blocking relations. Each worker resolves its ticket with the `cstack` commands. The maintainer's session is the coordinator. In practice:

- `cstack` gives the coordinator the list of tickets that are ready, as a command. It no longer launches the workspaces itself, as `cstack wave` does today.
- Inside a ticket, the executor and the implementers run as sub-agents again, as in the baseline runs. An Orca worker is used only for units that really run in parallel, in a child worktree. Such workers use Orca's own messages, such as `worker_done` and `ask`, and not the reports and the waiting of `cstack helper`.
- This changes ADR-SIC-A, which made every helper an Orca worker whenever Orca is available.

**Second, `cstack` adds three guards that make the quality of a run depend less on luck.**

- **Each new test case must fail first.** `cstack unit red` records which test cases fail, and `cstack unit green` refuses a unit when one of its new test cases already passed before the code. The test command must then give a result for each case. pytest and vitest both can.
- **A negative test must prove its rule by breaking it.** For each negative test that a ticket asks for, the implementer writes a small patch that breaks the rule. A `cstack` command applies the patch, checks that a test fails, and removes the patch.
- **A fact in the plan must name its source.** A decision that states a fact about the code or about production names the file and the line that show it. A plan check refuses such a decision without a source. A change to something that the ticket fixes becomes a question for the user, and never an assumption accepted by default.

## Why the decision does not follow the measures

The measures alone would say stop: the new version costs more and takes longer. They also show where the extra cost comes from. It comes from the full Orca sessions that version 0.3.1 adds inside each ticket, not from the commands that check the steps. The first change removes those sessions. On quality, the new version tied with the baseline, and it made the best branch. The causes of its weakest branch are known, and the second change addresses each one.

**Correction on 2026-11-23.** #87 split the extra cache read tokens by agent. The full Orca sessions, and the commands that start them and wait for them, explain about half of the gap. The other half comes from finer units, from the work that the executor does itself, from its bookkeeping with `cstack next --done`, and from the context that the helpers gather. The decision to continue stands. #107 and #108 take up part of that other half.

## Limits of the comparison

- Each version ran only twice, on one ticket. A single run can be lucky or unlucky.
- Claude Code moved from 2.1.327 to 2.1.329 between the baseline runs and the new runs. The model and the effort level stayed the same.
- The baseline runs had a code-search plugin loaded. It added about 200 characters of context to each run, and no run used it. It was removed before the new runs.
- The new runs needed two extra settings that the baseline runs did not need: an untracked `.cstack/settings.json`, and an `origin` remote that names the private sandbox. Neither one changed the starting commit.
- The two measures of time do not start at the same moment, as the waiting time section explains.
- No unit of the new runs ran in a child worktree, so this comparison says nothing about child worktrees.
- The fresh reviewer was a Claude Code session, not a person.

## Consequences

- The next epic carries both changes. It ends with a new measure on the same ticket copy, made and measured the same way as these four runs. That measure checks the quota, the waiting time and the quality again.
- The coordinator of a whole epic, which section 5 of the specification left for the next epic, becomes smaller. It is a recipe for Orca's coordinator, plus the command that lists the ready tickets.
- Milestone 5, which moves the bulk creation of tickets into `cstack`, opens as the specification says. It runs after the next epic, because the next epic changes how every run works.
- Tickets #79 and #80 fix two problems found by the new runs. They ship before the next measure.
