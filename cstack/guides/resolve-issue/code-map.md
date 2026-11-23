<!-- mandatory steps
action: write-code-mapping
command: cstack next --done code-map
-->

# Map the code

You use this guide in the `code-map` phase. It uses the sections "Where things are today" and "Scope" of the plan file.

You map the code with search and file reads. No code graph tool is used.

Work from the cheapest call to the most expensive.

1. **Orientation.** Do this only if the area is unfamiliar. List the files of the area by name, and read its README once.
2. **Questions.** For every "how does X work" or "where is Y handled" that the ticket raises, search the code for the names and words that the question uses. Open only the lines that the matches point to. Send a "why is Z like this" question to step 4.
3. **The symbols to change.** Take the symbols the ticket names and the ones you expect to modify.
   - For each one, search the whole repository for its name, including its callers, its tests, fixtures, and mentions inside strings and Markdown files. This shows what depends on it.
   - For each file to modify, run `git log --oneline -n 10 -- <file>` to see its recent changes and earlier bug fixes.
   - Also run `git log --full-diff --format= --name-only -n 30 -- <file> | sort | uniq -c | sort -rn` to see the files that usually change with it.
   - Put many dependents, or a file that was fixed again and again, into the plan as a risk.
4. **Governing decisions.** Look for the decisions already taken upstream, the ADRs they name, and the `WHY:` and `DECISION:` comments in the files to modify. A text search for `WHY:`, `DECISION:` and the names of the ADRs finds them. They count as decisions already taken in the `questions` phase.
5. **Source, only what is needed.** Read the lines that the search pointed to, with an offset and a limit. Never read a file from start to end when a few symbols answer the question.
6. **Wider exploration.** Do this only when the ticket has no file map or the area is large. Launch one to three fresh agents of type `resolve-issue:code-explorer`. Give each one a different angle: the most similar existing feature, the architecture of the area, and the testing patterns around it. They follow the same steps and return the symbols and files that matter.

If a later phase raises a question about the code, come back to these steps instead of guessing.

Write the patterns, entry points, constraints, risks and governing decisions you found into the plan file, under "Code mapping". Then run `cstack next --done code-map`.
