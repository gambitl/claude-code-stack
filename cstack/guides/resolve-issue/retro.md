<!-- mandatory steps
command: cstack audit <plan file>
action: write-retrospective
action: commit-retrospective
command: cstack next --done retro --plan <plan file>
command: cstack helper start executor --plan <plan file>
command: cstack helper wait <helper id>
-->

# Retrospective

This phase runs in the main conversation, not in the executor. The settings that `cstack next` printed above this guide apply. They win over any default here. You write down what this run learned, as evidence and nothing else. You never edit a skill, an agent prompt or the conventions file here. The `digest-retros` skill does that later, with the user's approval.

## Run the audit

Run `cstack audit <plan file>` before you write anything. It checks the steps of the phases that are over.

The audit leaves out the phases that are not over yet. At this point, these are retro and publish. It prints one sentence on standard error to say so.

Paste every line of its standard output into the section `## Steps` of the retrospective. Put the lines inside a code block that opens with three backticks and the word `text`, like this:

````
```text
phase ticket: done
```
````

Copy the lines as they were printed. Do not change them.

When no line came out, write one plain sentence in `## Steps` instead. It says that the audit printed no line, and why. Do not write a path in it.

Under the code block, copy each sentence from standard error that starts with the words cstack audit and a colon. Copy it as printed, inside inline code, so that GitHub does not hide a placeholder such as `<folder>`. If standard error holds any other text, such as a stack trace, do not copy it. Write only that the audit stopped with an unexpected error.

The run goes on whatever the exit code is. Rely on the lines that the audit printed, never on its exit code.

## Write the retrospective

Write `docs/retros/<YYYY-MM-DD>-<ticket id>.md` from `templates/retro.md`. Use five sources and no other. The first is the plan file, in particular its "Executor notes", "Review log" and "Hand-off log" sections and its History part. The second is the git log of the branch, where a fix commit after a review means a unit missed something. The third is the executor's reports. The fourth is what you saw of the user in this conversation: a correction, a question that had to be asked twice, a recommendation the user rejected, or a place where the user needed an explanation. The fifth is the output of `cstack audit <plan file>`.

- Every heading stays. An empty heading reads "nothing this time". Never invent an item to fill one.
- Every item names a phase, a commit or a line of the plan file. Quote the plan file or a commit, never a person. Describe a correction without saying who made it.
- Every "Improve" item ends with one tag: `[skill]`, `[agent prompt]`, `[conventions file]`, `[ticket template]` or `[one-off]`.
- Write at most three "Protect" items, each a specific behaviour that visibly helped, with its evidence.
- Give one item under `## Improve` for each line of `## Steps` that says `skipped` or `out of order`. The item names the phase and the step. It says what the run did instead, when the plan file or the git log shows it. It ends with one tag, like every item.
- Keep the prose under fifteen lines, in full sentences. The code block of `## Steps` and the items that come from its lines do not count toward the fifteen lines.

## Commit it

Commit the file on the current branch with a `docs` commit. If the run stopped before a branch existed, leave the file uncommitted and say so.

## The closing notice

`cstack` may print a "Digest due" notice. Keep it, and show it to the user as the very last thing of the run, after everything else. Do not run the digest in this session.

## Hand over

Run `cstack next --done retro --plan <plan file>`. When it says that `publish` comes next, run `cstack helper start executor --plan <plan file>`. The plan file now says "ready for review", so the executor runs only the `publish` phase. Start and wait for it as the `plan` guide says in "Hand off to the executor". Run `cstack helper wait <helper id>` with a shell timeout of ten minutes. Handle the report as the `plan` guide says.
