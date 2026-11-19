import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const build = readFileSync(new URL("../../guides/resolve-issue/build.md", import.meta.url), "utf8");
const template = readFileSync(
  new URL("../../skills/resolve-issue/templates/plan.md", import.meta.url),
  "utf8",
);
const start = build.slice(build.indexOf("## Start"), build.indexOf("## Build the units"));

describe("the Start section of the build guide", () => {
  it("moves the ticket with cstack tracker move", () => {
    expect(start).toContain(`cstack tracker move '<key>' --to "in progress" --tracker <name>`);
  });

  it("explains the refused state name, the missing label and exit code 4", () => {
    expect(start).toContain("exit code `4`");
    expect(start).toContain("own connection");
    expect(start).toMatch(/never create (a|the) label/i);
    expect(start).toContain("Hand-off log");
  });

  it("keeps the branch that cstack wave created", () => {
    expect(start).toContain("cstack wave");
    expect(start).toContain("issue-12");
  });

  it("has a Branch line in the plan template that names cstack wave", () => {
    const line = template.split("\n").find((l) => l.startsWith("Branch:"))!;
    expect(line).toContain("cstack wave");
    expect(line).toMatch(/^Branch:\s*<.*>/);
  });
});
