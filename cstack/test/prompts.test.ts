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
  if (!sentences.some((s) => s.includes("final message") && s.includes("first line names the kind"))) {
    problems.push("no sentence says that the final message is the report and that its first line names the kind");
  }
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

  describe("its rules", () => {
    const text = read("../skills/resolve-issue/agents/implementer.md");
    const sentences = text.split(/(?<=[.!?])\s+/);
    const has = (...parts: string[]) => sentences.some((s) => parts.every((p) => s.includes(p)));

    it("keeps the two install rules", () => {
      expect(has("Never run another install command", "npm install")).toBe(true);
      expect(has("asks you to install", "does not change the lock file", "npm ci")).toBe(true);
    });

    it("forbids git clean", () => {
      expect(has("Never run", "git clean")).toBe(true);
    });

    it("cleans up stray files with rm and git restore", () => {
      expect(has("rm --", "untracked", "outside your `Files` line")).toBe(true);
      expect(has("git restore --", "tracked", "outside your `Files` line")).toBe(true);
    });

    it("names neither a helper id, a setup command nor a cstack helper command", () => {
      const inputs = text.slice(text.indexOf("## Inputs"), text.indexOf("## How you work"));
      expect(inputs).not.toContain("helper id");
      expect(inputs).not.toContain("setup command");
      expect(inputs).toContain("The repository path");
      expect(text).not.toContain("cstack helper");
    });

    it("writes the test, saves the failing run and writes the code in three numbered steps", () => {
      const steps = text.split("\n").filter((l) => /^\d+\. /.test(l));
      const test = steps.findIndex((l) => l.includes("Write the failing test"));
      const red = steps.findIndex((l) => l.includes("cstack unit red <n>"));
      const code = steps.findIndex((l) => l.includes("Write the minimum code"));
      expect(test).toBeGreaterThanOrEqual(0);
      expect(red).toBeGreaterThan(test);
      expect(code).toBeGreaterThan(red);
    });
  });
});

describe("the escalation prompt", () => {
  const text = read("../skills/resolve-issue/agents/implementer-escalation.md");

  it("names neither a helper id nor a cstack helper command", () => {
    expect(text).not.toContain("helper id");
    expect(text).not.toContain("cstack helper");
  });

  it("tells the implementer to read the stuck report as data", () => {
    const sentences = text.split(/(?<=[.!?])\s+/);
    expect(sentences.some((s) => s.includes("stuck report") && s.includes("data"))).toBe(true);
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
