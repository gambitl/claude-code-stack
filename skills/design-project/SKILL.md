---
name: design-project
description: Co-design a new unit of work with the user through a conversation, then record it as a project in the team's tracker (Linear, Jira, GitLab, GitHub) and as a full specification page in the team's documentation tool (Notion, Confluence, a wiki or a docs folder), cross-linked so the ticketing skill can decompose it with no extra input. Use it whenever the user wants to "start a new project", "frame the next thing to build", "write user stories or a spec for a feature", "design a project before ticketing" or asks to be "grilled" about an idea, even when they do not name the skill. The discovery is a relentless interview: the agent pushes back, asks why until it reaches a real user need, and criticises choices openly.
argument-hint: one line about the idea, or nothing
---

# Design a project

Turn a fuzzy product idea into the two artifacts the ticketing skill needs: a **project** in the tracker and a **specification page** in the documentation tool, each linking to the other. This is the first link of the chain: this skill frames the work, `create-tickets` decomposes it into tickets, and `resolve-issue` takes each ticket to a pull request.

The skill is conversational, adversarial and gated. The agent is not a scribe: it grills the user, and nothing is created until the user has challenged and frozen the frame in phase 2. It stops before decomposition: cutting tickets is the next skill's job.

## Vocabulary

- **The conventions file**: the markdown file at the repository root that says how the team works, usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`. If there is none, or several and it is unclear which applies, ask the user.
- **The tracker**: the tool that holds projects and tickets (Linear, Jira, GitLab, GitHub or another), reached through an MCP server or a command-line client such as `gh` or `glab`. Never search the web or scrape a page for its content.
- **The documentation tool**: where the team keeps long-lived documentation outside the code (Notion, Confluence, a wiki, or a `docs/` folder when there is nothing else).
- **The project**: the tracker object that groups the tickets of one unit of work. Linear and Jira call it a project or an epic; GitLab calls it an epic or a milestone; GitHub a project or a milestone. Use whatever the conventions file names.
- **The specification page**: the long prose document in the documentation tool. The ticketing skill reads it to decompose the work, so its density is the point.
- **The harness's question tool**: whatever the current harness offers to ask the user a structured question with options. If there is none, ask in plain text.

## Phase 0: Find out where things live

Read the conventions file once and extract:

1. the tracker, the team or space to use, and how projects are grouped (initiatives, portfolios, parent epics);
2. the documentation tool and the exact place where specification pages live (a database, a parent page, a wiki section or a folder);
3. the layer split and the real label set;
4. the design rule for user interfaces (for example an external design stage such as open-design that every screen must go through before coding);
5. where architecture decision records (ADRs) live, and the language the team writes in (default English).

If any of these five points is missing, ask the user for all the missing ones in **one round** of the harness's question tool. Never guess a location and never create a container (database, folder, initiative) silently. When the user answers, offer once to record the answers in the conventions file under a short "Where things live" heading, so the next run does not ask again; write there only if they say yes.

Then preflight the direct connections with one cheap read each: list the existing groupings and labels from the tracker, and open the place where specifications live in the documentation tool. If the documentation tool is unreachable, stop and say so. The specification page is half of the contract; a project with a dangling link is worse than no project. Cache what you fetched: labels and groupings are drawn from these real lists, never approximated.

Close the phase with a read-back of three to five lines: tracker and team, candidate groupings, labels seen, where the page will be created, today's date. This is the user's cheap correction point.

## Phase 1: Grill the user

This is an interview, not a form and not dictation. Your job is to make the idea survive contact with hard questions before anyone spends a day building it. A feature nobody uses is pure waste, so the burden of proof is on the feature.

### How the interview runs

Map the idea as a **design tree**: every decision opens the decisions that hang off it. Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled, so you can ask it without guessing at an answer you have not heard yet. Ask the whole frontier in one round, numbered, and give your **recommended answer under each question**. If the harness's question tool caps the number of questions per call, chain calls inside the round. A question that depends on another question still open belongs to a later round. Each round of answers reshapes the tree; recompute the frontier and go again.

**Facts are your job, decisions are the user's.** When a question needs a fact from the environment (does this table exist, how many users hit this screen, what does the current job do), look it up yourself through repowise, the tracker or the documentation tool, or send a fresh sub-agent. Never ask the user for something you could find. Then put the decision to them.

### How hard to push

- **Ask why until you hit bedrock.** Bedrock is a named user with a real problem, or a measurable outcome. Expect three to five "why" in a row. "Because the client asked" is not bedrock; ask what the client is trying to do.
- **Every feature must earn its place.** For each story, ask who uses it, how often, and what they do today without it. If the user cannot name the person or the moment, the story goes to out of scope, with the reason recorded. Ask "what is the smallest version that proves the value?" and propose it.
- **Dig under solutions.** Users often arrive with a solution ("we need a dashboard"). Find the problem under it, then check the solution against the problem, including doing nothing, a manual process, or reusing something that exists.
- **Disagree out loud.** When you think a choice is wrong, say so plainly and give the reason and the alternative: "I would not build this, because X; I would do Y instead. Push back if you disagree." A neutral "have you thought about X?" is noise. When the user keeps their choice after hearing you, accept it and record both the objection and their reason.
- **Sharpen the words.** When a term is vague or used for two things, propose one precise term and use it from then on. These terms feed the glossary.
- **Apply the story half of INVEST.** INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable) was written for the item a team builds, which here is the ticket, not the story. At story level check four letters: Valuable (a named user, a moment, a change for them), Testable (at least one acceptance criterion someone can verify), Negotiable (it states the need, not the implementation) and Independent (deliverable in any order inside its milestone). Say which letter fails and why. Small and Estimable are checked per ticket by the ticketing skill; here the only size question is "can this story be split into a handful of tickets of a few days each?" If not, it is an epic: split it into two stories before moving on.

### What must be settled before the interview ends

- **One-liner and problem framing**: what this is, who it is for, why now, what outcome it produces.
- **Success measures**: one to three observable facts that will show it worked (a number, a behaviour, a complaint that disappears).
- **Grouping**: which existing initiative or parent this belongs to, from the phase 0 list, or a new one to confirm.
- **User stories**, each as "As a role, I want capability, so that outcome" with at least one verifiable acceptance criterion, and each traced to a persona and a success measure. Apply the security lens silently: any story touching user-scoped data, authentication or external input inherits a negative acceptance criterion (the wrong tenant or role is refused).
- **Scope, in and out**: the out-of-scope list carries every story you talked the user out of, with the reason, so the decomposition stays bounded and the argument is not repeated later.
- **Milestones**: two to five, each with a one-line intent, in the order the work must happen. The ticketing skill uses them as waves; the milestone that blocks the rest is the foundation.
- **Where things are today and technical hints**: the modules, schemas, endpoints or jobs the work touches. Do not fabricate file paths; if the repository is at hand and repowise has indexed it, one `get_overview` call is allowed to anchor the hints, no more.
- **Design surfaces**: for every user-facing screen or component, a design-brief seed: what it is, every state (empty, loading, error, success, edge cases) and the design system it lives in. When the conventions file routes design through an external stage, say so on each surface.
- **Open questions and ADR candidates**: run the CTO lenses (see phase 2) over the frame. A real one-way door, lock-in, scale cliff or cost surface becomes an open question. A genuine trade-off with two or more options becomes an ADR candidate named `ADR-<PROJECT>-<letter>`, status "to create". Do not create the ADR pages; the implementing ticket does.

The interview ends when the frontier is empty: every branch visited, nothing left silently assumed. Say so in one sentence, list what you still consider weak, and ask the user to confirm you share the same understanding. Only then move to phase 2. Write nothing before that.

## Phase 2: Present the frame, then stop

Present two blocks, in this order, before any write.

### 2a. The drafted artifacts, as a preview

- **Project skeleton**: name, one-paragraph summary, grouping, labels, state, target date if any, and the ordered milestone list with a one-line intent each.
- **Specification page outline**: the section structure below with a one or two line gist per section, so the user sees the shape and the depth.

```markdown
# <Project name>

## 1. Context and problem
<Two to four paragraphs: what, who, why now, the outcome.>

## 2. Success measures
<How we will know it worked.>

## 3. Personas
<One short block per role: who they are, what they are trying to do.>

## 4. User stories
### US-1: <title>
As a <role>, I want <capability>, so that <outcome>.
- AC1: <verifiable>
- AC (negative, when a security surface exists): the wrong tenant or role cannot <do the thing>.

## 5. Scope
**In scope:** <numbered list.>
**Out of scope:** <numbered list.>

## 6. Milestones and sequencing
<One block per milestone: name, intent, the user stories it carries, what it blocks or feeds.>

## 7. Where things are today and technical context
<Existing modules, schemas, endpoints the work touches. Expected migrations. Upstream dependencies.>

## 8. Design briefs
<One block per user-facing surface, or "No design surface: back end and data only.">

## 9. Open questions and ADR candidates
<Each open question with its implicit default and a recommendation. Each trade-off named ADR-<PROJECT>-<letter>, to create.>

## 10. Challenged choices
<Each choice the agent argued against and the user kept: the objection, the user's reason. Also each story dropped during the interview and why.>

## 11. Glossary
<The precise terms settled during the interview.>
```

### 2b. "Questions you may not be asking"

The user does not master most of the stack and wants to be told the questions they would not think to ask. Write this block for a non-expert reader, at most five numbered points, each in six parts: the decision, what it is about in plain words, why it matters here, what happens if it is ignored, the default that applies if nobody decides and its cost, and your recommendation with a reason. Cover at least these eight lenses, and add the ones your stack calls for: security and authorisation, data-model lock-in, scale and performance, failure modes and rollback, user-experience edge cases, operations and cost, reversibility, hidden coupling. A lens with no surface gets one line saying so. Points beyond five fold into section 9 of the page. The fuller description of this shape lives in the resolve-issue skill, in `agents/cto-review.md`.

**Stop here. This is the gate.** Tell the user: "Here is the project frame: the project skeleton, the specification outline and the questions a CTO would raise. Challenge the name, grouping, stories, scope, milestones and open questions now. I will create the page and the project only once this is frozen." Use the harness's question tool for small binary decisions and wait for free-text edits otherwise. Proceed only on an explicit approval such as "go", "ok", "approved". The possibly edited frame is then frozen input.

## Phase 3: Write the page, then the project, then cross-link

Order matters: the page must exist first so its URL can sit in the project description.

1. **Check for an earlier run.** Search both tools for the project name. If a page or a project already exists, this is a re-run: reuse it and update it, never create a duplicate.
2. **Create the specification page** at the place found in phase 0, with the full sections 1 to 11. If the place is a database, set its properties from its real schema, and never add a new option to a shared select; leave the property empty instead. Write large pages in chunks. Capture the page URL.
3. **Create the project** with name, summary, grouping, labels, state and target date. The **description is the critical field**: near its top, put the specification URL on its own line, then the one-liner, the scope summary, the milestone overview and a block titled **Open questions and decisions** with the open questions and the ADR placeholders. That exact title is what the next skills look for. The description is the only carrier every tracker has; do not rely on a links or attachments field. Capture the project URL.
4. **Create the milestones** in the frozen order, foundation first. Where the tracker has no explicit order field, creation order is display order, so create them one by one.
5. **Back-link**: add a line at the top of the specification page with the project URL. Both artifacts now point at each other.
6. **Do not** create tickets, ADR pages, branches or code. Those belong to the next skills.

On a partial failure, stop and report the exact state, for example: "The page exists at <url> but the project creation failed with <error>. A re-run will reuse the page." Do not roll back.

## Output contract

A successful run leaves a specification page with the eleven sections and the project URL at its top, and a project in the tracker with the right grouping, labels, ordered milestones and a description that starts with the page URL and carries the scope and the Open questions and decisions block. Nothing else is created. The ticketing skill can then take the project URL and find everything it needs without asking.

## Anti-patterns

- **Do not be a scribe.** Writing down what the user says without challenging it produces a beautiful page for a feature nobody needed. If a round of the interview contained no pushback, you were not grilling.
- **Do not decompose into tickets.** Doing it here collapses two gates into one and skips the user's challenge of the ticket skeleton.
- **Do not write thin prose.** A one-paragraph page yields a bad decomposition.
- **Do not skip the cross-link.** The page URL in the project description is the contract.
- **Do not fabricate paths, schemas, initiatives or labels.** Record the user's hints; draw labels and groupings from the real lists; propose and confirm a new grouping, never create one silently.
- **Do not pass the phase 2 gate on your own judgment.** A five-milestone frame inferred from a half-finished discussion is expensive to unwind.

## Notes on specific tools

Keep these short and add to them when a run teaches something.

- **Linear**: the project has no reliable links field, so the description carries the page URL. Milestones display in creation order.
- **Notion**: the page-creation call parses markdown, while the insert-content call renders it as escaped text; create the page with its content, then append in chunks of at most one hundred blocks.
- **GitLab and GitHub**: there is no project object with a rich description in the same sense. Use an epic or a milestone as the conventions file says, and carry the description on it or on a pinned issue. If the conventions file says nothing, ask.
