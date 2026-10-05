---
name: create-tickets
description: Turn an existing project in the team's tracker (Linear, Jira, GitLab, GitHub) and its specification page into a full, dependency-wired set of tickets, decomposed for parallel work (one contract per story, then per-layer tickets, then one integration ticket), grouped by milestone as waves, with bodies in the fixed shape the resolve-issue skill expects. Use it whenever the user gives a project name, URL or id and asks to "create the tickets", "ticketize the project", "decompose the project", "fill the project" or "write the issues". Two gates: the skeleton table first, the full bodies after.
argument-hint: project name, URL or id
---

# Create tickets from a project

Turn a **project** that `design-project` framed into its full set of **tickets**: decomposed for parallel work, grouped by milestone, wired with blocking relations, and written in the one body shape that `resolve-issue` reads. The project and its specification page are the source of truth; this skill adds nothing to them except the ADRs it opens and the links to them.

The skill is conversational and gated. The most important gate is between the **skeleton table** (every ticket as one row) and the **full bodies**, because a fifteen-ticket decomposition inferred from a half-read specification is expensive to redo.

## Vocabulary

- **The conventions file**: the markdown file at the repository root that says how the team works, usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`. If there is none, or several and it is unclear which applies, ask the user.
- **The tracker**: the tool that holds the project and the tickets (Linear, Jira, GitLab, GitHub or another), reached through an MCP server or a command-line client such as `gh` or `glab`. Never search the web or scrape a page for its content.
- **The documentation tool**: where the team keeps long-lived documentation outside the code (Notion, Confluence, a wiki, or a `docs/` folder when there is nothing else). The specification page and the architecture decision records (ADRs) live there.
- **The layers**: the split the conventions file names, typically front, back or API, data, infra. Never hard-code another split.
- **A fresh sub-agent**: a helper that starts with an empty context and receives only the prompt and inputs you give it.
- **The harness's question tool**: whatever the current harness offers to ask a structured question with options. If there is none, ask in plain text.

## Phase 0: Find out where things live

Read the conventions file once and extract: the tracker and team; the layers and the real label set; the test policy and test commands; the design rule for user interfaces (an external design stage such as open-design that every screen goes through before coding); where ADRs live; the language (default English). If anything is missing, ask for all the missing points in one round of the harness's question tool, and offer once to record the answers in the conventions file under "Where things live". Write there only if the user says yes.

Preflight the tracker with cheap reads: the real state names, the real labels, and whether it supports native blocking relations between tickets (Linear and Jira do; GitLab and GitHub depend on the plan and the tool version). New tickets land in the backlog state unless the user says otherwise. Never invent a label or a state; if a layer label is missing, offer to create it. If the documentation tool is unreachable, say that ADRs will be skipped and continue.

Close with a read-back of three to five lines: tracker and team, project found, states and labels seen, native relations available or not, documentation tool available or not.

## Phase 1: Fetch the project and the specification, on a sub-agent

Resolve the project from the argument. If it is empty or ambiguous, ask; never guess. From the project capture the name, summary, description, milestones with their order, labels and the **Open questions and decisions** block with the ADRs it names. Find the specification page URL in the project description; if it is not there, ask once.

Send a fresh sub-agent to read both sources and return a **brief of 300 to 500 words**: the goal, the user stories with their acceptance criteria and the layers each one touches, the milestone structure, the named decisions and ADR candidates, the design surfaces, the challenged choices, and the explicit technical constraints. Do not read the full page in the main context. The brief, not the raw content, is what you carry forward.

**Earlier runs.** List the tickets the project already has, including archived or closed ones. If there are some, this run is a top-up: match on title and propose only the difference, never duplicates.

## Phase 2: Decompose, then stop

### 2a. The skeleton table

Decompose the scope into tickets with these rules.

**Milestones are the waves.** Reuse the project's milestones in their order; a milestone that blocks the others is the foundation. If the project has none and the scope has phases, propose milestones and create them only after the skeleton is approved.

**Split for parallel work.** The team wants several people or agents working at the same time, so a story that touches more than one layer is cut per layer, on one condition: the interface between the layers is decided before anyone starts. For such a story, produce:

1. a **contract ticket**, size S, that delivers the agreed interface and nothing else: the endpoint or event shape, the schema or migration, the shared types, and a fixture or mock that the other layers can test against. It blocks every layer ticket of the story. When the interface is trivial and already decided in the specification, skip the ticket and write the contract verbatim into each layer ticket instead;
2. one **layer ticket per layer**, each blocked only by the contract ticket and, for a user-interface ticket, by its design ticket. Each must be testable alone against the fixture or mock. A layer ticket that cannot be tested alone is merged back into its neighbour;
3. one **integration ticket**, size S, that wires the layers together, removes the mock, and runs the story's end-to-end acceptance. It is blocked by every layer ticket of the story and is the only ticket that makes the story demonstrable.

A story that touches one layer is one ticket, with no contract or integration ceremony. Say so in the table rather than padding.

**Design first for every screen.** When the conventions file routes design through an external stage, every user-interface ticket has a **design ticket** that blocks it. The design tool reads code, so the design ticket tells it where to start reading rather than describing the codebase to it (see phase 3).

**Wide refactors are the exception.** A mechanical change whose blast radius covers the codebase (a rename, a retype of a shared symbol) cannot land green in one ticket. Sequence it as expand, migrate in batches sized by blast radius, contract: add the new form beside the old, move the callers over batch by batch, delete the old form last. Run `graphify affected "<symbol>"` on the touched symbols to size the batches: it lists every caller and dependent, tests included.

**Size** is S (one day or less), M (one to three days) or L (three to five days). An honest L is flagged with a proposed split; never disguise an L as an M. **INVEST** applies to every ticket in full: Independent, Negotiable, Valuable, Estimable, Small, Testable; say which letter fails and why, in batch. **The security lens** applies silently: any ticket touching user-scoped data, authentication or external input inherits a negative acceptance criterion (the wrong tenant or role is refused).

Present the table, one row per ticket:

```
| # | Title | Story | Kind | Milestone | Layer labels | Size | Blocked by | Goal (one line) |
```

Kind is one of contract, layer, integration, design, refactor, single. Use the project's title convention when it has one, otherwise `<milestone code>-<n>: <title>`. Below the table, add a **parallelism report** of two lines: the longest chain of blocked tickets (the critical path), and the largest number of tickets that can run at the same time in each milestone. If a milestone allows only one ticket at a time, say why and whether a contract ticket would open it up.

### 2b. "Questions you may not be asking"

Same shape as in `design-project`: for a non-expert reader, at most five numbered points, each with the decision, what it is about in plain words, why it matters here, what happens if ignored, the default and its cost, and your recommendation. Do not reopen decisions the project or the specification already locked (the Open questions and decisions block, the ADRs, the challenged choices). Lenses: security and authorisation, data-model lock-in, scale and performance, failure modes and rollback, user-experience edge cases, operations and cost, reversibility, hidden coupling, plus what the stack calls for. A genuine trade-off with two or more options becomes an ADR to write in phase 4.

**Stop here. This is the gate.** Tell the user: "Skeleton of N tickets across K milestones, with the parallelism report and the structural questions a CTO would raise. Challenge the granularity, the splits, the blocking edges, the milestones and the sizes now. I will write the full bodies and push them only once this is frozen." Ask the three questions from the interview discipline, with your recommended answer under each: does the granularity feel right, is every blocking edge a real one, should any ticket be merged or split. Proceed only on an explicit approval such as "go", "ok", "approved". The possibly edited skeleton is then frozen input.

## Phase 3: Write the full bodies

Every ticket body has **exactly** this shape, with these heading strings unchanged, in this order, because `resolve-issue` matches them literally and refuses a ticket with a missing section:

```markdown
## Why this matters (plain language)

**In plain terms:** <one sentence a non-engineer could act on>.

- **What the title means**: <decode every technical term of the title in plain words>.
- **Why we are doing it**: <the problem or risk, in business terms>.
- **For the user**: <the concrete benefit, in the user's language>.

**Goal.** <one sentence: what this ticket delivers>. <"Greenfield: nothing exists yet" when true.>

## Where things are today (read first)

* **<area>**: `path/to/file` → `symbol()` does X (~line). <what the implementer must know>
* **Contract**: <on tickets cut per layer only: the agreed interface this ticket implements or consumes, verbatim or by link to the contract ticket>.

## Scope

1. <concrete numbered step>

## Acceptance (TDD)

* <test file>: <failing case first> → <expected>; <edge case>.
* <the conventions file's test commands> green.
* <negative criterion when a security surface exists>.

**Size: S/M/L** · Blocked by: <titles, resolved to ids in phase 4> · Feeds: <titles of the tickets that depend on this one>.

---

## CTO review — <one-line decision> (<date>)      ← only when a lens fired on THIS ticket

<one to three numbered decisions locked for this ticket, cross-linking sibling tickets>
```

Rules that are not negotiable:

- **"Why this matters" opens every ticket** and must be readable by someone who does not read code: zero unexplained acronyms or library names in that block. A body that starts with technical content is a bug.
- **"Where things are today" cites real files and symbols.** Send one fresh sub-agent per milestone cluster to anchor them, with the Graphify code graph first: `graphify-out/GRAPH_REPORT.md` if the area is unfamiliar, `graphify query "<question>"` for each "where is" question, `graphify explain "<symbol>"` for the exact file and line of each symbol named, `graphify affected "<symbol>"` for what depends on it, and the `WHY:` and `DECISION:` comments in those files for the decisions recorded in the code. Never invent a path or a line. When nothing exists yet, write "greenfield: no existing surface".
- **Contract tickets** carry the full interface in Scope and a fixture or mock in Acceptance. **Layer tickets** restate the contract they code against and test alone. **Integration tickets** carry the story's end-to-end acceptance criteria, copied from the specification.
- **Design tickets** are written for a design tool that reads code. Their "Where things are today" section is a reading entry point, not a description: the route or page file where the surface lands, the shell or layout component it sits in, the sibling component closest to what is wanted, the design tokens file (colours, fonts, spacing) and the component library folder, each as a real path found by the scout, or "greenfield: no existing surface". Their Scope says what to design and every state to cover (empty, loading, error, success, edge cases), and their Acceptance names the approved artifact and forbids production code. The paired build ticket references the approved design and never redesigns.
 - **The footer is always present and on one line**, in the exact form `**Size: S/M/L** · Blocked by: … · Feeds: …`, with "none" when a list is empty, even when the tracker has native relations, so the graph survives a tracker without them.
- **CTO review only where a lens fired.** Never pad.

Keep the drafts in a scratch list, not in the tracker, and move to phase 4 without a new approval; the gate was 2a.

## Phase 4: Write to the tracker, then document

**Pass 1: create every ticket** in dependency order, blockers first, with team, project, milestone, backlog state, real layer labels, and the full body. Do not assign anyone unless asked. Collect the map from title to identifier.

**Pass 2: wire the graph.** Where the tracker has native blocking relations, set them from the map. Everywhere, rewrite the footer's "Blocked by" and "Feeds" and any in-body cross-reference from titles to identifiers.

**Document.** For each trade-off that became a real ADR in 2b, create the record in the documentation tool, or under `docs/decisions/` when there is nothing else, with status proposed, and replace its placeholder in the project's Open questions and decisions block with the live link. Do not modify a pre-existing shared ADR; surface it instead. Add one comment on the project summarising the batch: number of tickets, milestones, the critical path and the ADRs opened.

On a partial failure, stop and report exactly: "Created N of M tickets. Failed at <title> with <error>. Created: <identifiers>." Do not roll back; a re-run is a top-up thanks to phase 1.

## Output contract

The project holds N tickets in the backlog, grouped by milestone, each with the full body shape, real labels, an always-present Blocked by and Feeds footer, and native relations where the tracker has them. Multi-layer stories are split contract, layers, integration, so several tickets of each wave can start at once. ADRs opened are linked from the project. No other artifact is created. Each ticket can now be handed to `resolve-issue`.

## Anti-patterns

- **Do not write bodies before the skeleton is approved.** The gate is the point.
- **Do not split a layer that cannot be tested alone.** Parallelism bought with untestable tickets is paid back at integration time.
- **Do not skip the integration ticket** on a multi-layer story: without it nobody owns "does the story actually work end to end".
- **Do not fabricate paths, lines, labels or states.** Scout with the Graphify code graph or write greenfield; draw labels from the real list.
- **Do not open a body with jargon.** If a non-engineer cannot tell what the ticket does and why from the first block, it failed.
- **Do not duplicate on re-run.** Match by title and propose only the difference.
- **Do not pad every ticket with a CTO review block.**

## Notes on specific tools

Keep these short and add to them when a run teaches something.

- **Linear**: blocking relations are append-only, so wiring once is safe. The default ticket listing can hide backlog tickets; retry including archived ones before concluding the project is empty.
- **GitLab**: blocking links are a paid-tier feature and may be unavailable; the footer text is then the only graph. Closing keywords only fire on the default branch.
- **GitHub**: use sub-issues or task lists as the conventions file says; the footer text remains the reference.
