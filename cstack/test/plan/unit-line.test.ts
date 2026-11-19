import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readPlan } from "../../src/plan/read.js";
import { setUnitWorktree, withoutWorktreeLines } from "../../src/plan/unit-line.js";

const approved = readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8");
const BLOCKED = "- Blocked: waiting for a decision";
const worktreeOf = (text: string, unit: number) => readPlan(text).units.find((u) => u.number === unit)?.worktree;

describe("setUnitWorktree", () => {
  it("adds the line after Blocked and before the free notes, and readPlan reads it", () => {
    const text = setUnitWorktree(approved, 3, "/tmp/unit-3");
    expect(text).toContain(`${BLOCKED}\n- Worktree: /tmp/unit-3\nA free note.`);
    expect(worktreeOf(text, 3)).toBe("/tmp/unit-3");
  });

  it("replaces an existing line", () => {
    const once = setUnitWorktree(approved, 3, "/tmp/a");
    const twice = setUnitWorktree(once, 3, "/tmp/b");
    expect(twice.match(/- Worktree:/g)).toHaveLength(1);
    expect(worktreeOf(twice, 3)).toBe("/tmp/b");
  });

  it("adds the line after Depends on for a unit without a Blocked line", () => {
    const text = setUnitWorktree(approved, 1, "/tmp/unit-1");
    expect(worktreeOf(text, 1)).toBe("/tmp/unit-1");
    expect(worktreeOf(text, 3)).toBeUndefined();
  });

  it("keeps Windows line endings and throws for a missing unit", () => {
    const crlf = approved.replace(/\n/g, "\r\n");
    const text = setUnitWorktree(crlf, 2, "/tmp/unit-2");
    expect(text.replace(/\r\n/g, "\n")).toBe(setUnitWorktree(approved, 2, "/tmp/unit-2"));
    expect(() => setUnitWorktree(approved, 99, "/tmp/x")).toThrow(/no unit 99/);
  });
});

describe("withoutWorktreeLines", () => {
  it("removes the worktree lines and returns the original text", () => {
    expect(withoutWorktreeLines(setUnitWorktree(approved, 2, "/tmp/unit-2"))).toBe(approved);
  });
});
