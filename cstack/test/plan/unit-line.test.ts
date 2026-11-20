import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPlan } from "../../src/plan/read.js";
import { homePathWarning, setUnitWorktree, withoutWorktreeLines, worktreeValue } from "../../src/plan/unit-line.js";

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

describe("worktreeValue", () => {
  const made: string[] = [];
  const temp = () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "unit-line-")));
    made.push(dir);
    return dir;
  };
  afterEach(() => {
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("writes ~/ for a path inside the home folder, and readPlan reads it back", () => {
    const home = temp();
    const text = setUnitWorktree(approved, 3, worktreeValue(join(home, "work", "unit-3"), home));
    expect(text).toContain("- Worktree: ~/work/unit-3\n");
    expect(worktreeOf(text, 3)).toBe("~/work/unit-3");
  });

  it("replaces an existing ~/ line", () => {
    const home = temp();
    const once = setUnitWorktree(approved, 3, worktreeValue(join(home, "a"), home));
    const twice = setUnitWorktree(once, 3, worktreeValue(join(home, "b"), home));
    expect(twice.match(/- Worktree:/g)).toHaveLength(1);
    expect(worktreeOf(twice, 3)).toBe("~/b");
  });

  it("keeps a path outside the home folder, or equal to it", () => {
    const home = temp();
    const other = temp();
    expect(worktreeValue(join(other, "x"), home)).toBe(join(other, "x"));
    expect(worktreeValue(home, home)).toBe(home);
    expect(worktreeValue(`${home}-sibling/x`, home)).toBe(`${home}-sibling/x`);
  });

  it("never gives ~/ for an empty or root home folder", () => {
    expect(worktreeValue("/tmp/x", "")).toBe("/tmp/x");
    expect(worktreeValue("/tmp/x", "/")).toBe("/tmp/x");
  });

  it("handles a home folder given through a symbolic link", () => {
    const real = temp();
    const holder = temp();
    const link = join(holder, "link");
    symlinkSync(real, link);
    mkdirSync(join(real, "w"));
    expect(worktreeValue(join(real, "w"), link)).toBe("~/w");
  });
});

describe("homePathWarning", () => {
  it("warns for a value that starts with /Users/ or /home/", () => {
    const expected =
      "The Worktree line of unit 2 still starts with /Users/ or /home/, so the plan file holds a home folder path. Check HOME before you commit the plan file.\n";
    expect(homePathWarning(2, "/Users/jane/x")).toBe(expected);
    expect(homePathWarning(2, "/home/jane/x")).toBe(expected);
  });

  it("returns undefined for ~/ and for other paths", () => {
    expect(homePathWarning(2, "~/x")).toBeUndefined();
    expect(homePathWarning(2, join(tmpdir(), "x"))).toBeUndefined();
  });
});
