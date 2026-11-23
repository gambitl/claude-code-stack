import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { audit } from "../src/commands/audit.js";
import { collect, commitPlan, makeRepo } from "./helpers/plan-repo.js";

const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) rmSync(folders.pop()!, { recursive: true, force: true });
});

describe("cstack audit and a plan in format cstack-plan/1", () => {
  it("reads a cstack-plan/1 plan and stops only because the plan has no run state", async () => {
    const repo = makeRepo();
    folders.push(repo);
    const text = readFileSync(join(import.meta.dirname, "fixtures", "plans", "version-1.md"), "utf8");
    const path = commitPlan(repo, text, "docs/plans/version-1.md");
    const { out, io } = collect();
    const code = await audit([join(repo, path)], io, { packageRoot: repo });
    expect(code).toBe(3);
    expect(out.stderr).toContain("this plan file has no run state, so cstack next never ran it.");
    expect(out.stderr).not.toContain("the plan file is not a valid cstack plan file.");
  });
});
