import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { next } from "../src/commands/next.js";
import { readState, runFolder, currentRunPath } from "../src/run-state.js";
import { collect, commitPlan, makeRepo } from "./helpers/plan-repo.js";

const packageRoot = join(import.meta.dirname, "fixtures/next");
const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures/plans", name), "utf8");
const NOW = () => new Date("2026-11-19T09:00:00.000Z");

async function run(cwd: string, ...args: string[]) {
  const { out, io } = collect();
  const code = await next(args, io, { cwd, packageRoot, now: NOW });
  return { code, ...out };
}
const markers = (text: string) => text.match(/marker-[a-z-]+/g) ?? [];

describe("cstack next", () => {
  it("refuses --phase briefing while document is not done", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--phase", "briefing");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("document");
    expect(result.stdout).toBe("");
  });

  it("prints the run line and one guide in a fresh repository and records nothing", async () => {
    const dir = makeRepo();
    const result = await run(dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Run: none yet. Phase 1 of 15: ticket, in the main conversation.");
    expect(markers(result.stdout)).toEqual(["marker-ticket"]);
    expect(existsSync(join(dir, ".git", "cstack"))).toBe(false);
  });

  it("starts at build for an approved plan and records startedAt", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    const result = await run(dir, "--plan", "docs/plans/x.md");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Phase 6 of 15: build, in the executor.");
    expect(markers(result.stdout)).toEqual(["marker-build"]);
    expect(readState(dir, "docs/plans/x.md")?.phases.build?.startedAt).toBe("2026-11-19T09:00:00.000Z");
  });

  it("uses the current run without --plan", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir);
    expect(result.stdout).toContain("Run: docs/plans/x.md. Phase 6 of 15: build");
  });

  it("refuses an unknown phase with exit 2 and lists the names", async () => {
    const dir = makeRepo();
    const result = await run(dir, "--phase", "deploy");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("ticket, dependencies, code-map");
  });

  it("exits with 3 on an unknown plan format", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("format-2.md"), "docs/plans/x.md");
    const result = await run(dir, "--plan", "docs/plans/x.md");
    expect(result.code).toBe(3);
    expect(result.stderr).toContain("9.0.0");
  });

  it("refuses a plan path outside the repository", async () => {
    const dir = makeRepo();
    expect((await run(dir, "--plan", "../other/plan.md")).code).toBe(2);
    expect((await run(dir, "--plan", "/etc/hosts")).code).toBe(2);
  });

  it("--new deletes current-run, keeps the run folder and prints the ticket guide", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--new");
    expect(result.code).toBe(0);
    expect(markers(result.stdout)).toEqual(["marker-ticket"]);
    expect(existsSync(currentRunPath(dir))).toBe(false);
    expect(existsSync(runFolder(dir, "docs/plans/x.md"))).toBe(true);
  });

  it("refuses with 1 when the start condition of the next phase fails", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--phase", "publish");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("The phase ready is not done.");
    expect(readState(dir, "docs/plans/x.md")?.phases.publish?.startedAt).toBeUndefined();
  });

  it("treats mixed flags as usage errors", async () => {
    const dir = makeRepo();
    expect((await run(dir, "--done", "ticket", "--phase", "ticket")).code).toBe(2);
    expect((await run(dir, "--new", "--plan", "x.md")).code).toBe(2);
  });
});
