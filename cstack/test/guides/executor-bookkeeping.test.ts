import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PROMPT = new URL("../../skills/resolve-issue/agents/executor.md", import.meta.url);

/** The part "How you work" of the executor prompt. */
function howYouWork(): string {
  const text = readFileSync(PROMPT, "utf8");
  const start = text.indexOf("## How you work\n");
  expect(start, "no section How you work").toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 1);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

const SENTENCES = [
  "When your context already shows the text of the conventions file, as Claude Code shows the `CLAUDE.md` of the repository, do not read it again.",
  "Otherwise, read it once.",
  "Read the plan file once, when you start, with the Read tool and a limit that stops before the line of `## History`.",
  "`grep -n '^## History' <plan file>` gives that line.",
  "After that, never read the whole plan file again.",
  "When you need a section again, or a section of the History part that a guide asks for, print it with `cstack plan section <name> --plan <plan file>`.",
  "When the Edit tool asks you to read the plan file again, read only the lines of the section that you change, with an offset and a limit.",
];

describe("the bookkeeping rules of the executor prompt", () => {
  it.each(SENTENCES)("holds the sentence %s", (sentence) => {
    expect(howYouWork()).toContain(sentence);
  });

  it("no longer tells the executor to read the conventions file before it runs cstack next", () => {
    expect(howYouWork()).not.toContain("Read the conventions file, then run");
  });
});
