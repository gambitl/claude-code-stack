# Map the code

You use this guide in the `code-map` phase. It uses the sections "Where things are today" and "Scope" of the plan file.

Start with `cstack graph ensure`. It checks that the code graph of the repository exists, and it builds the graph when it is missing. Graphify is the tool that builds this graph.

If the command exits with `4`, Graphify is not installed. Pass its install message to the user. Then map the code with search and file reads instead, and follow the same steps below.

When Graphify is installed, it is the first and main source. It knows every symbol, its source file and line, what calls it and what depends on it. It answers with the few symbols that matter, so you do not need to read whole files. Use its command line, and open a source file only to read the lines the graph pointed to.

Work from the cheapest call to the most expensive.

1. **Orientation.** Do this only if the area is unfamiliar. Read the top of `graphify-out/GRAPH_REPORT.md` once. It lists the most-connected symbols and the subsystems.
2. **Questions.** For every "how does X work" or "where is Y handled" that the ticket raises, run `graphify query "<question>"`. It returns the symbols and files involved, each with its source line. Open only the ones that answer the question. Send a "why is Z like this" question to step 4.
3. **The symbols to change.** Take the symbols the ticket names and the ones you expect to modify.
   - Run `graphify explain "<symbol>"` for each one. It gives the source line, the callers and what the symbol calls.
   - Run `graphify affected "<symbol>"` to list everything that depends on it, tests included.
   - When a name matches several symbols, use the node ID that `graphify explain` prints.
   - The graph holds no history. For each file to modify, run `git log --oneline -n 10 -- <file>` to see its recent changes and earlier bug fixes.
   - Also run `git log --full-diff --format= --name-only -n 30 -- <file> | sort | uniq -c | sort -rn` to see the files that usually change with it.
   - Put many dependents, or a file that was fixed again and again, into the plan as a risk.
4. **Governing decisions.** Look for the decisions already taken upstream, the ADRs they name, and the `WHY:` and `DECISION:` comments in the files to modify. `graphify explain` shows the ones the graph linked to a symbol. A text search finds the rest. They count as decisions already taken in the `questions` phase.
5. **Source, only what is needed.** Read the symbols the graph pointed to, from the line it gives, with an offset and a limit. Never read a file from start to end when a few symbols answer the question.
6. **Wider exploration.** Do this only when the ticket has no file map or the area is large. Launch one to three fresh agents of type `resolve-issue:code-explorer`. Give each one a different angle: the most similar existing feature, the architecture of the area, and the testing patterns around it. They follow the same path and return the symbols and files that matter.

If a later phase raises a question about the code, come back to these tools instead of guessing.

Write the patterns, entry points, constraints, risks and governing decisions you found into the plan file, under "Code mapping". Then run `cstack next --done code-map`.
