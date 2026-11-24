import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// WHY: inside a ticket, Claude Code starts its helpers as sub-agents. No guide, skill or prompt
// may send Claude back to the helper commands or to an Orca worker, except for the independent
// review by another agent than Claude.

const ROOT = new URL("../../", import.meta.url).pathname;
const REVIEW_GUIDE = "guides/resolve-issue/independent-review.md";

// The files that a later unit of ticket #93 still rewrites. Unit 3 removes this list and its use.
const NOT_YET_REWRITTEN = [
  "guides/resolve-issue/plan.md",
  "guides/resolve-issue/retro.md",
  "guides/resolve-issue/ready.md",
  "guides/resolve-issue/publish.md",
  "skills/resolve-issue/agents/executor.md",
];

function markdownFiles(folder: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) found.push(...markdownFiles(path));
    else if (entry.name.endsWith(".md")) found.push(relative(ROOT, path));
  }
  return found;
}

const files = [...markdownFiles(join(ROOT, "guides")), ...markdownFiles(join(ROOT, "skills"))].sort();
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

function places(text: string): string[] {
  const found: string[] = [];
  for (const file of files) {
    if (NOT_YET_REWRITTEN.includes(file)) continue;
    read(file)
      .split("\n")
      .forEach((line, index) => {
        if (line.includes(text)) found.push(`${file}:${index + 1}`);
      });
  }
  return found;
}

/** The sentences of a file that tell Claude to start an Orca worker, each with its line number. */
function orcaWorkerSentences(file: string): { line: number; sentence: string }[] {
  const text = read(file);
  const found: { line: number; sentence: string }[] = [];
  let offset = 0;
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const at = text.indexOf(sentence, offset);
    offset = at + sentence.length;
    const startsWorker =
      /orca workers?/i.test(sentence) && /\b(start|starts|started|starting|launch|launches|launched|launcher)\b/i.test(sentence);
    if (startsWorker || sentence.includes("worker-start")) {
      found.push({ line: text.slice(0, at).split("\n").length, sentence });
    }
  }
  return found;
}

describe("the guides, the skills and the agent prompts start their helpers as sub-agents", () => {
  for (const text of ["cstack helper", "cstack unit collect", "cstack wave", "cstack report check", "--child-worktree"]) {
    it(`never name ${text}`, () => {
      const found = places(text);
      expect(found, `${text} is named in:\n${found.join("\n")}`).toEqual([]);
    });
  }

  it("never tell Claude to start an Orca worker, except in the independent review guide", () => {
    const found: string[] = [];
    for (const file of files) {
      if (file === REVIEW_GUIDE || NOT_YET_REWRITTEN.includes(file)) continue;
      for (const { line } of orcaWorkerSentences(file)) found.push(`${file}:${line}`);
    }
    expect(found, `a sentence starts an Orca worker in:\n${found.join("\n")}`).toEqual([]);
  });

  it("keeps the sentence of the independent review guide about a launcher for another agent", () => {
    expect(orcaWorkerSentences(REVIEW_GUIDE).length).toBeGreaterThan(0);
  });
});
