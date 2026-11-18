import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planSection } from "../src/commands/plan-section.js";
import { collect, commitPlan, makeRepo } from "./helpers/plan-repo.js";

const text = readFileSync(new URL("./fixtures/plans/full.md", import.meta.url), "utf8");

async function run(args: string[], planText = text) {
  const dir = makeRepo();
  commitPlan(dir, planText);
  const { out, io } = collect();
  const code = await planSection(["--plan", "docs/plans/full.md", ...args], io, { cwd: dir });
  return { code, ...out };
}

describe("cstack plan section", () => {
  it("prints the level-2 Decisions section and nothing of the upstream one", async () => {
    const r = await run(["Decisions"]);
    expect(r.code).toBe(0);
    expect(r.stdout.startsWith("## Decisions\n")).toBe(true);
    expect(r.stdout).not.toContain("Decisions already taken upstream");
    expect(r.stdout).not.toContain("### Unit 3: fake");
    expect(r.stdout.endsWith("\n")).toBe(true);
    expect(r.stdout.endsWith("\n\n")).toBe(false);
  });

  it("does not match a longer heading that only starts with the name", async () => {
    const arch = await run(["Architecture"]);
    expect(arch.stdout).not.toContain("Architecture options");
    const doc = await run(["Documentation"]);
    expect(doc.stdout.startsWith("## Documentation\n")).toBe(true);
    expect(doc.stdout).not.toContain("Documentation duties");
  });

  it("prints unit 1 and not unit 10", async () => {
    const r = await run(["Unit 1"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("### Unit 1: Thing 1");
    expect(r.stdout).not.toContain("Unit 10");
    expect(r.stdout).not.toContain("### Unit 2");
  });

  it("prints Scope and Acceptance from the ticket", async () => {
    expect(( await run(["Scope"])).stdout.startsWith("### Scope\n")).toBe(true);
    expect(( await run(["Acceptance"])).stdout.startsWith("### Acceptance (TDD)\n")).toBe(true);
  });

  it("never matches a heading inside a fenced block", async () => {
    const r = await run(["Scope"]);
    expect(r.stdout).toContain("## Decisions");
    const d = await run(["Decisions"]);
    expect(d.stdout).not.toContain("fake");
  });

  it("lists the headings and exits with 2 for an unknown name", async () => {
    const r = await run(["Nothing here"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("## Decisions");
    expect(r.stderr).toContain("### Unit 3: Thing 3");
    expect(r.stderr).not.toContain("# Plan:");
  });

  it("exits with 2 when no name is given", async () => {
    expect((await run([])).code).toBe(2);
  });

  it("exits with 3 for a name that matches two headings of the same level", async () => {
    const r = await run(["Details"]);
    expect(r.code).toBe(3);
    expect(r.stderr).toMatch(/\d+/);
  });

  it("prefers the level-2 heading over a ticket heading with the same name", async () => {
    const changed = text.replace("### Scope\n", "### Documentation\n\nTicket words.\n\n### Scope\n");
    const r = await run(["Documentation"], changed);
    expect(r.code).toBe(0);
    expect(r.stdout.startsWith("## Documentation\n")).toBe(true);
    expect(r.stdout).not.toContain("Ticket words");
  });

  it("accepts a name in two words", async () => {
    const r = await run(["Code", "mapping"]);
    expect(r.code).toBe(0);
    expect(r.stdout.startsWith("## Code mapping\n")).toBe(true);
  });

  it("exits with 3 for two Unit 3 headings", async () => {
    const changed = text.replace("### Unit 4: Thing 4", "### Unit 3: Thing 4");
    expect((await run(["Unit 3"], changed)).code).toBe(3);
  });

  it("exits with 3 when the reader refuses the plan", async () => {
    const r = await run(["Decisions"], "not a plan\n");
    expect(r.code).toBe(3);
  });
});
