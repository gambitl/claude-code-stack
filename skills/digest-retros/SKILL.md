---
name: digest-retros
description: Read the retrospectives that the resolve-issue skill wrote under docs/retros/ in the repository, group what they report, and propose, one change at a time and only with explicit approval, the edits to the skills, their agent prompts, their templates and the repository's conventions file that those retrospectives justify. Use it when the user asks to "digest the retros", "run the digest", "improve the skill from the retrospectives", or when a resolve-issue run ended with a "Digest due" notice.
argument-hint: nothing, or the minimum number of retrospectives to require instead of ten
---

# Digest the retrospectives

The `resolve-issue` skill writes one short retrospective file per ticket under `docs/retros/`. This skill reads the ones that no digest has covered yet, finds what several of them say, and turns that into concrete edits of the workflow: the skill files, their agent prompts and templates, and the conventions file of the repository. It is the only place where those files change because of what happened in a run. It changes nothing without the user's explicit approval, change by change, and it never scores anything.

## Vocabulary

- **The conventions file**: the markdown file at the repository root that says how the team works there, usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`. If there are several, ask which one applies.
- **The skills folder**: where the harness keeps the user's skills. In Claude Code it is `~/.claude/skills/`. Each skill is a folder with a `SKILL.md` file and, for `resolve-issue`, an `agents/` folder and a `templates/` folder.
- **A pending retrospective**: a file directly in `docs/retros/`. A file in `docs/retros/reviewed/` was covered by an earlier digest.
- **The digest file**: the record this skill writes at `docs/retros/reviewed/<YYYY-MM-DD>-digest.md`. It carries the text before and after every change applied, so it is also the undo, since the skills folder is not under version control.
- **A settled decision**: a line of the "Settled decisions" section at the bottom of the resolve-issue skill file. Each one says what it protects.
- **The harness's question tool**: whatever the harness offers to ask a structured question with options; plain text otherwise.

## Phase 0: Find what there is

List the pending retrospectives. If there are fewer than ten, or fewer than the number given in `$ARGUMENTS`, say how many there are and ask the user whether to continue anyway; never continue on your own. Then read, in full: every pending retrospective, the "Watching" section of the most recent digest file if one exists, the conventions file, and the resolve-issue skill folder (`SKILL.md`, every file in `agents/` and `templates/`), including its "Settled decisions" and "Lessons applied" sections. Read the other skills of the skills folder only when a retrospective points at them, for example with the tag `[ticket template]`, which points at `create-tickets`.

Close the phase with a read-back of three lines: how many retrospectives are pending and their date range, how many items are carried over from the previous digest's "Watching" section, and which files may be changed.

## Phase 1: Group the evidence

Build one list of subjects. A subject is one thing the retrospectives report, for example "the branch was created from the wrong base" or "the executor's tests were run without the environment named in the conventions file". For each subject record: the tag, the retrospectives that mention it, whether one of them ties it to a failed run or to a needs-decision round, and whether it appeared in the previous digest's "Watching" section. Collect the "Protect" items separately; they are constraints on what may be proposed, not subjects.

Check every subject against the current text of the file its tag points at. A retrospective written before the previous digest may describe something already fixed, and a trap may already be in the conventions file under other words. An item already handled is closed with a note, not proposed again.

## Phase 2: Decide what has enough substance

A subject becomes a **proposal** when at least two retrospectives report it, counting a mention carried over from the previous "Watching" section as one, or when a single retrospective ties it to a failed run or a needs-decision round. Every other subject goes to **watching** and is carried forward to the next digest. A subject tagged `[one-off]` is never proposed; it is listed under "dropped" so that the user sees it once.

Apply the filter of what never enters a skill file or a conventions file: facts obvious from the code, generic good practice, a fix that cannot recur, and long explanations where one sentence does the job. A proposal must respect every "Protect" item: never propose a change that removes or weakens a behaviour a retrospective asked to protect, unless another retrospective reports the opposite, in which case the conflict is presented to the user as such.

## Phase 3: Check the settled decisions

For every proposal, check whether it touches a settled decision. If it does, it is not written as a diff. It becomes a **challenged decision** block with five parts: the decision as written in the skill, what it protects, the evidence from the retrospectives (which ones, what happened, how often), what would change if the decision were reopened and what could go wrong, and your honest recommendation with its reason. Ten retrospectives that point at the same gate are a reason to analyse the gate seriously, not a reason to drop the subject; the user decides.

## Phase 4: Present, then stop

Present, in this order, in full sentences:

1. **The proposals**, one block each, numbered. Each block gives the target file and section, a "Why" of one or two sentences that names the retrospectives as evidence, the current text, and the proposed text. The proposed text is written in the style of the target file: the skill files are written for an agent in plain instructions, and the conventions file follows the writing rules of the repository, which on this user's repositories means complete natural sentences, never telegraphic notes.
2. **The challenged decisions**, one block each, as described in phase 3.
3. **The watching list**, one line per subject, with the number of mentions so far.
4. **The dropped one-off items**, one line each.

Then stop. Ask for a decision on each proposal and each challenged decision, with the harness's question tool when it exists, otherwise in plain chat. Accept explicit approval only, in English: "go", "ok", "approved", "apply". For a challenged decision, the possible answers are to keep the decision, to reopen it with the change the user describes, or to keep watching it. Record the user's reason for every rejection; it goes into the digest file so that the same proposal is not made again next time.

In this phase you may only present, ask, and answer follow-up questions. You change no file.

## Phase 5: Apply and record

Once every decision is taken:

1. Apply each approved edit to the skill files in place, exactly as approved. For each one, add a dated line to the "Lessons applied" section of the resolve-issue skill file that names the digest file which carried it.
2. Apply each approved edit to the conventions file as one separate commit on the current branch, of the form `docs: <what the conventions file now says>`, in full sentences.
3. Write the digest file at `docs/retros/reviewed/<YYYY-MM-DD>-digest.md` with: the list of the retrospectives it covers; each proposal with its decision (applied, rejected with the user's reason, or turned into a watching item); for every applied change, the file, the text before and the text after, so that the change can be undone by hand; each challenged decision with the user's answer; the watching list carried forward; the dropped one-off items.
4. Move the covered retrospectives into `docs/retros/reviewed/` with `git mv`, then commit the digest file and the moves together, with a `docs` commit.
5. Push following the conventions file's rule on pushes, like the retrospective phase of resolve-issue does.

End with a short report in plain sentences: how many retrospectives were digested, how many changes were applied and to which files, which decisions were challenged and what the user decided, and how many subjects are being watched. If the user rejected everything, that is a valid outcome; the digest file is still written and the retrospectives still move, so that the same evidence is not digested twice.

## Anti-patterns

- **Do not apply anything before phase 4 ends.** A proposal that the user has not approved is not a change.
- **Do not rewrite the structure of a skill.** The digest edits lines and paragraphs; a reorganisation of the phases is a project of its own, to be proposed as one and done by hand with the user.
- **Do not silently edit a settled decision.** It is always a challenged decision block and a question.
- **Do not score or grade anything.** There is no quality report here; the evidence is the retrospectives and nothing else.
- **Do not touch the user's global instructions file** (in Claude Code, `~/.claude/CLAUDE.md`). It describes the user, not the workflow. If a retrospective points there, say so in the report and stop there.
- **Do not fill a digest with subjects that have one mention.** They wait in the watching list; that is what keeps the rewrites rare.
- **Do not invent evidence.** If a proposal cannot name the retrospectives behind it, it does not exist.
