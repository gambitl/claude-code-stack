import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_FORMAT, PlanFormatError, readPlan } from "../../src/plan/read.js";

const approved = readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8");
const BLOCKED = "- Blocked: waiting for a decision";

const withWorktree = (value: string) => approved.replace(BLOCKED, `${BLOCKED}\n- Worktree: ${value}`);

const problemsOf = (text: string) => {
  try {
    readPlan(text);
  } catch (error) {
    expect(error).toBeInstanceOf(PlanFormatError);
    return (error as PlanFormatError).problems;
  }
  throw new Error("the plan file was accepted");
};

describe("the Worktree line of a unit", () => {
  it("returns the path for the unit that holds the line", () => {
    const plan = readPlan(withWorktree("/tmp/repo-unit-2"));
    expect(plan.units.find((unit) => unit.worktree)?.worktree).toBe("/tmp/repo-unit-2");
    expect(plan.format).toBe(PLAN_FORMAT);
  });

  it("reads a plan without the line, and its units have no worktree", () => {
    const plan = readPlan(approved);
    expect(plan.units.every((unit) => unit.worktree === undefined)).toBe(true);
  });

  it("refuses a relative path", () => {
    expect(problemsOf(withWorktree("repo-unit-2"))).toContainEqual(
      expect.objectContaining({ rule: expect.stringContaining("Worktree") }),
    );
  });

  it("refuses a control character in the path", () => {
    expect(problemsOf(withWorktree("/tmp/repo\u0007unit"))).toContainEqual(
      expect.objectContaining({ rule: expect.stringContaining("Worktree") }),
    );
  });
});
