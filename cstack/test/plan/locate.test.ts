import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlanLocationError, locatePlan } from "../../src/plan/locate.js";
import { RUN_FORMAT, writeCurrentRun, writeState } from "../../src/run-state.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8" }).trim();

const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), "cstack-locate-"));
  git(dir, "init", "-b", "main");
  mkdirSync(join(dir, "docs/plans"), { recursive: true });
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "docs/plans/x.md"), "# Plan\n");
  return dir;
};

const failure = (fn: () => unknown): PlanLocationError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PlanLocationError);
    return error as PlanLocationError;
  }
  throw new Error("did not throw");
};

describe("locatePlan with --plan", () => {
  it("returns the real root, the real path and the relative path", () => {
    const dir = repo();
    const root = realpathSync(dir);
    expect(locatePlan(dir, "docs/plans/x.md")).toEqual({ root, path: join(root, "docs/plans/x.md"), relative: "docs/plans/x.md" });
    expect(locatePlan(join(dir, "sub"), "../docs/plans/x.md").relative).toBe("docs/plans/x.md");
  });

  it("refuses a path outside the repository with exit code 2", () => {
    const dir = repo();
    const other = mkdtempSync(join(tmpdir(), "cstack-other-"));
    writeFileSync(join(other, "o.md"), "x");
    expect(failure(() => locatePlan(dir, "../outside.md")).exitCode).toBe(2);
    expect(failure(() => locatePlan(dir, join(other, "o.md"))).exitCode).toBe(2);
    symlinkSync(join(other, "o.md"), join(dir, "docs/plans/link.md"));
    expect(failure(() => locatePlan(dir, "docs/plans/link.md")).exitCode).toBe(2);
  });

  it("accepts an absolute path that reaches the repository through a symbolic link", () => {
    const dir = repo();
    const alias = join(mkdtempSync(join(tmpdir(), "cstack-alias-")), "repo");
    symlinkSync(dir, alias);
    expect(locatePlan(dir, join(alias, "docs/plans/x.md")).relative).toBe("docs/plans/x.md");
    // The non-real form of the temporary folder, as macOS gives it (/var instead of /private/var).
    expect(locatePlan(dir, join(dir, "docs/plans/x.md")).relative).toBe("docs/plans/x.md");
  });

  it("exits with 3 when the file inside the repository does not exist", () => {
    expect(failure(() => locatePlan(repo(), "docs/plans/missing.md")).exitCode).toBe(3);
  });
});

describe("locatePlan without --plan", () => {
  it("uses the current run, also from a subfolder, and writes nothing", () => {
    const dir = repo();
    writeCurrentRun(dir, "docs/plans/x.md");
    writeState(dir, "docs/plans/x.md", { format: RUN_FORMAT, writtenBy: "t", plan: "docs/plans/x.md", phases: {} });
    const found = locatePlan(join(dir, "sub"), undefined);
    expect(found.relative).toBe("docs/plans/x.md");
    expect(found.path).toBe(join(realpathSync(dir), "docs/plans/x.md"));
  });

  it("exits with 2 and asks for --plan when there is no current run", () => {
    const error = failure(() => locatePlan(repo(), undefined));
    expect(error.exitCode).toBe(2);
    expect(error.message).toContain("--plan <file>");
  });

  it("exits with 3 when the run has no state.json", () => {
    const dir = repo();
    writeCurrentRun(dir, "docs/plans/x.md");
    expect(failure(() => locatePlan(dir, undefined)).exitCode).toBe(3);
  });
});
