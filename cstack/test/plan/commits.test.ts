import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PlanFormatError } from "../../src/plan/read.js";
import { listUnitCommits } from "../../src/plan/commits.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  ).trim();

const tmp = () => mkdtempSync(join(tmpdir(), "cstack-commits-"));

const commit = (dir: string, message: string) => {
  writeFileSync(join(dir, "f.txt"), `${Math.random()}`);
  git(dir, "add", "f.txt");
  git(dir, "commit", "-m", message);
  return git(dir, "rev-parse", "HEAD");
};

const repo = () => {
  const dir = tmp();
  git(dir, "init", "-b", "main");
  commit(dir, "chore: start");
  return dir;
};

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PlanFormatError);
    return (error as PlanFormatError).exitCode;
  }
  throw new Error("did not throw");
};

describe("listUnitCommits", () => {
  it("ignores a trailer that is already on the target branch", () => {
    const dir = repo();
    commit(dir, "feat: old\n\nCstack-Unit: 2");
    git(dir, "switch", "-c", "work");
    const hash = commit(dir, "feat: new\n\nCstack-Unit: 3");
    commit(dir, "feat: plain");
    const result = listUnitCommits(dir, "main");
    expect(result.units).toEqual({ 3: [hash] });
    expect(result.invalid).toEqual([]);
  });

  it("compares with origin/main when the local main is stale", () => {
    const remote = tmp();
    git(remote, "init", "--bare", "-b", "main");
    const dir = repo();
    git(dir, "remote", "add", "origin", remote);
    git(dir, "push", "-u", "origin", "main");
    git(dir, "switch", "-c", "work");
    commit(dir, "feat: a\n\nCstack-Unit: 2");
    git(dir, "push", "origin", "work:main");
    git(dir, "fetch", "origin");
    const hash = commit(dir, "feat: b\n\nCstack-Unit: 4");
    expect(listUnitCommits(dir, "main").units).toEqual({ 4: [hash] });
  });

  it("compares with the local branch when there is no remote", () => {
    const dir = repo();
    git(dir, "switch", "-c", "work");
    const hash = commit(dir, "feat: a\n\nCstack-Unit: 1");
    expect(listUnitCommits(dir, "main").units).toEqual({ 1: [hash] });
  });

  it("does not find a trailer separated from the final paragraph", () => {
    const dir = repo();
    git(dir, "switch", "-c", "work");
    commit(dir, "feat: a\n\nCstack-Unit: 2\n\nCo-Authored-By: A <a@example.com>");
    expect(listUnitCommits(dir, "main")).toEqual({ units: {}, invalid: [] });
  });

  it("counts a commit with two trailers for both units", () => {
    const dir = repo();
    git(dir, "switch", "-c", "work");
    const hash = commit(dir, "feat: a\n\nCstack-Unit: 1\nCstack-Unit: 2\nCo-Authored-By: A <a@example.com>");
    expect(listUnitCommits(dir, "main").units).toEqual({ 1: [hash], 2: [hash] });
  });

  it("returns an invalid trailer value in its own list", () => {
    const dir = repo();
    git(dir, "switch", "-c", "work");
    commit(dir, "feat: a\n\nCstack-Unit: abc");
    expect(listUnitCommits(dir, "main")).toEqual({ units: {}, invalid: ["abc"] });
  });

  it("refuses a bad target branch name with exit code 3", () => {
    mkdirSync(join(tmp(), "none"));
    expect(code(() => listUnitCommits("/nonexistent-folder", "--output=x"))).toBe(3);
  });

  it("refuses a target branch that does not exist with exit code 3", () => {
    expect(code(() => listUnitCommits(repo(), "nope"))).toBe(3);
  });
});
