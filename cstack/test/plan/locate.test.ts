import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlanLocationError, locatePlan } from "../../src/plan/locate.js";
import { RunStateError, createRun, writeCurrentRun, writeState } from "../../src/run-state.js";
import { readPlan } from "../../src/plan/read.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf8",
  }).trim();

const PLAN = "docs/plans/x.md";

function setup() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "cstack-locate-")));
  const repo = join(base, "repo");
  mkdirSync(join(repo, "docs", "plans"), { recursive: true });
  mkdirSync(join(repo, "sub"));
  git(repo, "init", "-b", "main");
  writeFileSync(join(repo, PLAN), "# plan\n");
  writeFileSync(join(repo, "docs", "plans", "y.md"), "# other\n");
  writeFileSync(join(base, "outside.md"), "# outside\n");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "chore: start");
  return { base, repo, sub: join(repo, "sub") };
}

function failure(fn: () => unknown): Error & { exitCode?: number } {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected an error");
}

describe("locatePlan", () => {
  it("asks for --plan when there is no flag and no current run", () => {
    const { repo } = setup();
    const error = failure(() => locatePlan(repo, undefined));
    expect(error).toBeInstanceOf(PlanLocationError);
    expect((error as PlanLocationError).exitCode).toBe(2);
    expect(error.message).toContain("--plan <file>");
  });

  it("returns the real root, the real path and a relative path with forward slashes", () => {
    const { repo, sub } = setup();
    writeFileSync(join(sub, "p.md"), "# p\n");
    const found = locatePlan(sub, "../docs/plans/x.md");
    expect(found).toEqual({ root: repo, path: join(repo, PLAN), relative: PLAN });
    expect(locatePlan(sub, "p.md").relative).toBe("sub/p.md");
  });

  it("follows symbolic links before it compares paths", () => {
    const { base, repo } = setup();
    symlinkSync(join(base, "outside.md"), join(repo, "link.md"));
    expect((failure(() => locatePlan(repo, "link.md")) as PlanLocationError).exitCode).toBe(2);
    symlinkSync(repo, join(base, "alias"));
    expect(locatePlan(join(base, "alias"), PLAN).path).toBe(join(repo, PLAN));
  });

  it("refuses a plan path outside the repository with exit code 2", () => {
    const { base, repo } = setup();
    expect((failure(() => locatePlan(repo, "../outside.md")) as PlanLocationError).exitCode).toBe(2);
    expect((failure(() => locatePlan(repo, join(base, "outside.md"))) as PlanLocationError).exitCode).toBe(2);
    expect((failure(() => locatePlan(repo, "../missing.md")) as PlanLocationError).exitCode).toBe(2);
  });

  it("gives exit code 3 for a missing or unreadable plan file inside the repository", () => {
    const { repo } = setup();
    expect((failure(() => locatePlan(repo, "docs/plans/none.md")) as PlanLocationError).exitCode).toBe(3);
    expect((failure(() => locatePlan(repo, "docs")) as PlanLocationError).exitCode).toBe(3);
  });

  it("reads the plan path from the state of the current run", () => {
    const { repo, sub } = setup();
    const plan = readPlan(readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8"));
    createRun(repo, PLAN, plan);
    writeCurrentRun(repo, PLAN);
    expect(locatePlan(sub, undefined)).toEqual({ root: repo, path: join(repo, PLAN), relative: PLAN });
  });

  it("lets --plan win over the current run", () => {
    const { repo } = setup();
    const plan = readPlan(readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8"));
    createRun(repo, PLAN, plan);
    writeCurrentRun(repo, PLAN);
    expect(locatePlan(repo, "docs/plans/y.md").relative).toBe("docs/plans/y.md");
  });

  it("gives exit code 3 when the current run has no state file", () => {
    const { repo } = setup();
    writeCurrentRun(repo, PLAN);
    const error = failure(() => locatePlan(repo, undefined));
    expect(error).toBeInstanceOf(PlanLocationError);
    expect((error as PlanLocationError).exitCode).toBe(3);
  });

  it("keeps the RunStateError of a state file that cannot be read", () => {
    const { repo } = setup();
    const plan = readPlan(readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8"));
    const state = createRun(repo, PLAN, plan);
    writeState(repo, PLAN, { ...state, format: "cstack-run/9" as never });
    writeCurrentRun(repo, PLAN);
    expect(failure(() => locatePlan(repo, undefined))).toBeInstanceOf(RunStateError);
  });
});
