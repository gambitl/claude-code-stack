# Review

In this phase you review the whole diff of the branch against its target. The settings that `cstack next` printed above this guide apply. They win over any default here.

## Impact notes

1. Run `cstack graph ensure`. It brings the code graph up to date. When it exits with `4`, Graphify is missing. Keep its install message for your report, and continue with search and file reads.
2. For every symbol the branch changed or deleted, run `graphify affected "<symbol>"`. What depends on it outside the diff breaks if the change is wrong. The tests in that list exercise the change. Without the graph, search the code for the callers.
3. For every changed file, run `git log --full-diff --format= --name-only -n 30 -- <file> | sort | uniq -c | sort -rn`. It lists the files that usually change with it.
4. Check each outside dependent and each usual companion that the branch left untouched. Fix it or explain why it is fine.
5. Read the `WHY:` and `DECISION:` comments and the decision records named in the changed files. A conflict with a recorded decision is a finding.
6. Write the impact notes into the plan file's "Review log".

## Four reviewers

Launch four fresh reviewers. Give each one the conventions file path, the whole branch diff against its target, the impact notes and one focus.

- `resolve-issue:code-reviewer-deep`, with the focus correctness and bugs.
- `resolve-issue:code-reviewer-deep`, with the focus security. It checks authorization on every new or modified endpoint, parameterised queries, transactions and idempotency, no secrets, and no stack traces in error responses.
- `resolve-issue:code-reviewer`, with the focus conventions and abstractions.
- `resolve-issue:code-reviewer-simplicity`, which looks for code the change did not need. Give it the plan file path too, so it knows what the ticket asks for.

Write their findings into the plan file's "Review log".

## Fix

Fix every bug, security issue and broken convention. Fix the other findings when the fix is cheap. Most simplicity findings are cheap, because they remove code. Record the rest as follow-ups.

The fixes are ordinary commits, written in the commit format of the conventions file. They do not carry the `Cstack-Unit` trailer, because they are not units.

Then run the tests. Run first the tests that the impact notes list. Then run the commands of the `testCommands` setting. Review tools of the harness may run in addition, and never instead.

## End of the phase

The "Review log" must be filled. Run `cstack next --done review --plan <plan file>`.
