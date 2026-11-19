import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DONE_REPORT_SECTIONS, readPlan } from "../../src/plan/read.js";
import { commitPlan, git, makeRepo } from "../helpers/plan-repo.js";

const text = readFileSync(new URL("../fixtures/plans/full.md", import.meta.url), "utf8");

describe("the full example plan", () => {
  it("reads as a complete plan", () => {
    const plan = readPlan(text);
    expect(plan.units).toHaveLength(10);
    expect(plan.header["Ready for review at"]).not.toBe("not yet");
    for (const name of DONE_REPORT_SECTIONS) {
      expect(plan.sections.find((s) => s.name === name)?.filled).toBe(true);
    }
    expect(plan.sections.find((s) => s.name === "Ticket")!.bodyLines).toBeGreaterThan(0);
    expect(plan.blockingQuestions.some((q) => q.open)).toBe(false);
  });

  it("makes a clean repository with no unit commit", () => {
    const dir = makeRepo();
    commitPlan(dir, text);
    expect(git(dir, "status", "--porcelain")).toBe("");
    expect(git(dir, "log", "--format=%B")).not.toContain("Cstack-Unit");
    expect(readFileSync(join(dir, "docs/plans/full.md"), "utf8")).toBe(text);
  });
});
