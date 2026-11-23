<!-- mandatory steps
action: write-retrospective
action: commit-retrospective
command: cstack next --done retro --plan <plan file>
command: cstack helper start executor --plan <plan file>
command: cstack helper wait <helper id>
-->

# Retrospective

This phase runs in the main conversation, not in the executor. The settings that `cstack next` printed above this guide apply. They win over any default here. You write down what this run learned, as evidence and nothing else. You never edit a skill, an agent prompt or the conventions file here. The `digest-retros` skill does that later, with the user's approval.

## Write the retrospective

Write `docs/retros/<YYYY-MM-DD>-<ticket id>.md` from `templates/retro.md`. Use four sources and no other. The first is the plan file, in particular its "Executor notes", "Review log" and "Hand-off log" sections and its History part. The second is the git log of the branch, where a fix commit after a review means a unit missed something. The third is the executor's reports. The fourth is what you saw of the user in this conversation: a correction, a question that had to be asked twice, a recommendation the user rejected, or a place where the user needed an explanation.

- Every heading stays. An empty heading reads "nothing this time". Never invent an item to fill one.
- Every item names a phase, a commit or a line of the plan file. Quote the plan file or a commit, never a person. Describe a correction without saying who made it.
- Every "Improve" item ends with one tag: `[skill]`, `[agent prompt]`, `[conventions file]`, `[ticket template]` or `[one-off]`.
- Write at most three "Protect" items, each a specific behaviour that visibly helped, with its evidence.
- Keep the prose under fifteen lines, in full sentences.

## Commit it

Commit the file on the current branch with a `docs` commit. If the run stopped before a branch existed, leave the file uncommitted and say so.

## The closing notice

`cstack` may print a "Digest due" notice. Keep it, and show it to the user as the very last thing of the run, after everything else. Do not run the digest in this session.

## Hand over

Run `cstack next --done retro --plan <plan file>`. When it says that `publish` comes next, run `cstack helper start executor --plan <plan file>`. The plan file now says "ready for review", so the executor runs only the `publish` phase. Start and wait for it as the `plan` guide says in "Hand off to the executor". Run `cstack helper wait <helper id>` with a shell timeout of ten minutes. Handle the report as the `plan` guide says.
