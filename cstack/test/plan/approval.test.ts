import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PlanFact } from "../../src/plan/read.js";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cstack-facts-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src", "a.ts"), "export const one = 1;\n    const two = 2;  \n// the end\n");
});

afterEach(() => {
  try {
    chmodSync(join(root, "src", "locked.ts"), 0o644);
  } catch {
    // The file exists only in one case.
  }
  rmSync(root, { recursive: true, force: true });
});

function file(path: string, line: number, quote: string, planLine = 40): PlanFact {
  return { line: planLine, text: "a fact", source: { kind: "file", path, line, quote } };
}

function user(date: string, planLine: number): PlanFact {
  return { line: planLine, text: "a fact", source: { kind: "user", date } };
}

async function check(facts: PlanFact[]): Promise<string[]> {
  const { factProblems } = await import("../../src/plan/approval.js");
  return factProblems(root, facts);
}

const wrong = (line: number, path = "src/a.ts") => `The fact at line 40 of the plan: line ${line} of \`${path}\` does not hold the quoted text.`;
const ends = (line: number, path = "src/a.ts") => `The fact at line 40 of the plan: the file \`${path}\` ends before line ${line}.`;

describe("factProblems()", () => {
  it("passes a fact whose quote is a part of its line", async () => {
    expect(await check([file("src/a.ts", 1, "const one")])).toEqual([]);
  });

  it("ignores the spaces at the two ends of the line and of the quote", async () => {
    expect(await check([file("src/a.ts", 2, " const two = 2; ")])).toEqual([]);
  });

  it("refuses a fact whose quote is not on its line", async () => {
    expect(await check([file("src/a.ts", 2, "the end")])).toEqual([wrong(2)]);
  });

  it("compares the quote with its case", async () => {
    expect(await check([file("src/a.ts", 1, "Export const")])).toEqual([wrong(1)]);
  });

  it("refuses a quote that holds only spaces", async () => {
    expect(await check([file("src/a.ts", 1, "   ")])).toEqual(["The fact at line 40 of the plan: its quoted text holds only spaces."]);
  });

  it("refuses a fact whose file does not exist", async () => {
    expect(await check([file("src/missing-zq7.ts", 1, "x")])).toEqual(["The fact at line 40 of the plan: the file `src/missing-zq7.ts` does not exist."]);
  });

  it("refuses a line past the end of the file", async () => {
    expect(await check([file("src/a.ts", 4, "x")])).toEqual([ends(4)]);
  });

  it("refuses a folder", async () => {
    expect(await check([file("src", 1, "x")])).toEqual(["The fact at line 40 of the plan: `src` is not a regular file."]);
  });

  it("refuses a named pipe without reading it", async () => {
    execFileSync("mkfifo", [join(root, "src", "pipe")]);
    expect(await check([file("src/pipe", 1, "x")])).toEqual(["The fact at line 40 of the plan: `src/pipe` is not a regular file."]);
  });

  it("refuses a file that cannot be read", async (ctx) => {
    if (process.getuid?.() === 0) ctx.skip();
    writeFileSync(join(root, "src", "locked.ts"), "x\n");
    chmodSync(join(root, "src", "locked.ts"), 0);
    const result = await check([file("src/locked.ts", 1, "x")]);
    expect(result).toEqual(["The fact at line 40 of the plan: the file `src/locked.ts` cannot be read."]);
    expect(result.join("\n")).not.toContain(root);
  });

  it("follows a symbolic link that stays inside the repository", async () => {
    symlinkSync("a.ts", join(root, "src", "link.ts"));
    expect(await check([file("src/link.ts", 1, "const one")])).toEqual([]);
  });

  it("matches a file with Windows line endings", async () => {
    writeFileSync(join(root, "src", "crlf.ts"), "first\r\nsecond\r\n");
    expect(await check([file("src/crlf.ts", 2, "second")])).toEqual([]);
    expect(await check([file("src/crlf.ts", 3, "x")])).toEqual([ends(3, "src/crlf.ts")]);
  });

  it("refuses a user source without a real date", async () => {
    expect(await check([user("", 40), user("2026-02-30", 41), user("2026-11-24", 42)])).toEqual([
      "The fact at line 40 of the plan: its user source has no real date in the form YYYY-MM-DD.",
      "The fact at line 41 of the plan: its user source has no real date in the form YYYY-MM-DD.",
    ]);
  });

  it("lists one message per wrong fact, in the order of the facts", async () => {
    const result = await check([file("src/missing-zq7.ts", 1, "x", 45), file("src/a.ts", 2, "the end", 43), file("src/a.ts", 1, "const one", 44)]);
    expect(result).toEqual([
      "The fact at line 45 of the plan: the file `src/missing-zq7.ts` does not exist.",
      "The fact at line 43 of the plan: line 2 of `src/a.ts` does not hold the quoted text.",
    ]);
  });
});
