import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

// Returns what is wrong with an implementer prompt. An empty list means it is right.
export function implementerProblems(text: string): string[] {
  const problems: string[] = [];
  const at = (command: string) => text.indexOf(`cstack unit ${command}`);
  const red = at("red");
  const green = at("green");
  const commit = at("commit");
  if (red < 0) problems.push("it never names cstack unit red");
  if (green < 0) problems.push("it never names cstack unit green");
  if (commit < 0) problems.push("it never names cstack unit commit");
  if (red >= 0 && green >= 0 && red > green) problems.push("cstack unit red comes after cstack unit green");
  if (green >= 0 && commit >= 0 && commit < green) {
    problems.push("cstack unit commit comes before the first cstack unit green");
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (!sentences.some((s) => s.includes("No test") && s.includes("cstack unit commit"))) {
    problems.push("no sentence says that a No test unit goes straight to cstack unit commit");
  }
  return problems;
}

describe("the implementer prompt", () => {
  it("reports a prompt that commits before the first green run", () => {
    const problems = implementerProblems(read("./fixtures/prompts/implementer-commit-before-green.md"));
    expect(problems.join("\n")).toContain("comes before the first cstack unit green");
  });

  it("names red, green and commit in order and sends a No test unit straight to commit", () => {
    const text = read("../skills/resolve-issue/agents/implementer.md");
    expect(implementerProblems(text)).toEqual([]);
  });
});

describe("the executor prompt", () => {
  const text = read("../skills/resolve-issue/agents/executor.md");

  it("names cstack next and cstack helper done, and no longer cstack report submit", () => {
    expect(text).toContain("cstack next");
    expect(text).toContain("cstack helper done");
    expect(text).not.toContain("cstack report submit");
  });

  it("names the helper id among its inputs and says that cstack helper start gives it", () => {
    const inputs = text.slice(text.indexOf("## Inputs"), text.indexOf("## Vocabulary"));
    expect(inputs).toContain("helper id");
    expect(inputs).toContain("cstack helper start");
  });

  it("submits exactly the four kinds of report, and no other", () => {
    const kinds = new Set([...text.matchAll(/cstack helper done (\S+) --helper <helper id> --plan <plan file>/g)].map((m) => m[1]));
    expect([...kinds].sort()).toEqual(["done", "failed", "needs-decision", "published"]);
  });

  it("tells the executor not to follow a guide whose run line says in the main conversation", () => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    expect(sentences.some((s) => s.includes("in the main conversation") && s.includes("run line") && s.includes("do not follow"))).toBe(true);
  });
});

describe("the short skill", () => {
  it("tells the main conversation not to follow a guide whose run line says in the executor", () => {
    const text = read("../skills/resolve-issue/SKILL.md");
    const sentences = text.split(/(?<=[.!?])\s+/);
    expect(sentences.some((s) => s.includes("in the executor") && s.includes("run line") && s.includes("do not follow"))).toBe(true);
  });
});

describe("the push rule", () => {
  const folders = ["../guides/resolve-issue/", "../skills/resolve-issue/agents/"];
  const mentions: { file: string; sentence: string }[] = [];
  for (const folder of folders) {
    const dir = new URL(folder, import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const text = readFileSync(new URL(file, dir), "utf8");
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        if (sentence.includes("git push")) mentions.push({ file: `${folder}${file}`, sentence });
      }
    }
  }

  it("names a push in exactly one sentence, in the executor prompt", () => {
    expect(mentions.map((m) => m.file)).toEqual(["../skills/resolve-issue/agents/executor.md"]);
  });

  it("makes that sentence about a pipeline run asked for by a line of Decisions", () => {
    expect(mentions[0]?.sentence).toContain("pipeline run");
    expect(mentions[0]?.sentence).toContain("Decisions");
  });
});
