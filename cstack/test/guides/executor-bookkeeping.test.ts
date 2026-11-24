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

const CLOSE_SENTENCES = [
  "Each answer that you give makes the model read your whole context again, so never spend an answer only on closing a phase.",
  "Run the close in the same shell call as a command of the phase, joined with `&&`, for example `git add <plan file> && git commit -m \"<message>\" && cstack next --done <phase> --plan <plan file>`.",
  "The close then runs only when the command before it succeeds.",
  "Never put a pipe in a command that you join to the close, because a pipe keeps only the exit code of its last part.",
  "For example, `<test command> | tail -5 && cstack next --done review` closes the phase even when the tests fail.",
  "When the phase ends with an edit of the plan file, send the close in the same answer, as a second tool call right after the edit.",
  "The close then runs even when the edit fails, so read the result of the edit, and redo the edit in your next answer when it failed.",
  "When the output of a joined call is cut, run `cstack next --plan <plan file>` to print the guide again, and never read the saved output in full.",
];

describe("the close rules of the executor prompt", () => {
  it.each(CLOSE_SENTENCES)("holds the sentence %s", (sentence) => {
    expect(howYouWork()).toContain(sentence);
  });
});

const GUIDES = new URL("../../guides/resolve-issue/", import.meta.url);

function guideText(phase: string): string {
  return readFileSync(new URL(`${phase}.md`, GUIDES), "utf8");
}

const PHASE_GUIDES = [
  "build",
  "review",
  "independent-review",
  "update-branch",
  "document",
  "briefing",
  "after-build-questions",
];

describe("the end of each executor guide points to the close rule", () => {
  it.each(PHASE_GUIDES)("%s: holds the new close sentence", (phase) => {
    expect(guideText(phase)).toContain(
      `Run \`cstack next --done ${phase} --plan <plan file>\` in the same shell call as the last command of the phase, or in the same answer as its last edit, as your prompt says.`,
    );
  });

  it("ready: step 2 joins the commit of the plan file to the close", () => {
    expect(guideText("ready")).toContain(
      "2. Commit the plan file in the same shell call as the close of step 1, joined after it with `&&`. The done report is refused while the plan file has an uncommitted change.",
    );
  });

  it("publish: step 3 joins the close to the submit", () => {
    expect(guideText("publish")).toContain(
      "Run `cstack next --done publish --plan <plan file>` in the same shell call as the submit of step 4, joined before it with `&&`.",
    );
  });
});

const EXECUTOR_GUIDES = [...PHASE_GUIDES, "ready", "publish"];

describe("the block of mandatory steps of each executor guide", () => {
  it.each(EXECUTOR_GUIDES)("%s: still holds the line that closes its phase", (phase) => {
    const text = guideText(phase);
    const block = text.slice(text.indexOf("<!-- mandatory steps"), text.indexOf("-->"));
    expect(block).toContain(`command: cstack next --done ${phase} --plan <plan file>`);
  });
});
