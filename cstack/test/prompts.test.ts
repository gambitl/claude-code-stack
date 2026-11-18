import { readFileSync } from "node:fs";
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
