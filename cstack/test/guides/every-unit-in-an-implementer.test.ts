import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const build = readFileSync(new URL("../../guides/resolve-issue/build.md", import.meta.url), "utf8");
const plan = readFileSync(new URL("../../guides/resolve-issue/plan.md", import.meta.url), "utf8");
const step3 = build.split("\n").find((line) => line.startsWith("3. For each unit, start a fresh sub-agent")) ?? "";
const testsBullet = plan.split("\n").find((line) => line.startsWith("- **Tests.**")) ?? "";

describe("every unit is built by an implementer", () => {
  it("ends step 3 of the build guide with the rule for a unit with no test and for a check", () => {
    expect(step3).toContain("Never build a unit yourself");
    expect(step3.endsWith(
      "An implementer also builds a unit with a `No test` line, which has no test to fail first. When a unit asks for a check, such as a run on real data, its implementer runs the check before the commit of the unit and gives the result in its report.",
    )).toBe(true);
  });

  it("ends the Tests bullet of the plan guide with the rule that a check is never a unit of its own", () => {
    expect(testsBullet.endsWith(
      "A check that changes no file, such as a run on real data, is never a unit of its own, because every unit needs a commit. Put the check in the unit whose code it checks, before the commit of that unit. When it checks the whole build, put it in the last unit.",
    )).toBe(true);
  });
});
