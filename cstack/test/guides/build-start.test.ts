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

  it("keeps the current branch when git rev-list shows no commit that the target branch lacks", () => {
    expect(start).toContain("git rev-list --count <target branch>..HEAD");
    expect(start).not.toContain("cstack wave");
  });

  it("has a Branch line in the plan template that names git rev-list and not cstack wave", () => {
    const line = template.split("\n").find((l) => l.startsWith("Branch:"))!;
    expect(line).toContain("git rev-list --count <target branch>..HEAD");
    expect(line).not.toContain("cstack wave");
    expect(line).toMatch(/^Branch:\s*<.*>/);
  });

  it("keeps another branch only when it is not the default branch either", () => {
    const sentence = start.split(/(?<=[.!?])\s+/).find((s) => s.includes("git rev-list --count <target branch>..HEAD"));
    expect(sentence, "no sentence of the Start section names git rev-list").toBeDefined();
    expect(sentence).toContain("neither the target branch nor the default branch");
  });

  it("has a Branch line in the plan template that leaves out the default branch", () => {
    const line = template.split("\n").find((l) => l.startsWith("Branch:"))!;
    expect(line).toContain("neither the target branch nor the default branch");
  });
});
