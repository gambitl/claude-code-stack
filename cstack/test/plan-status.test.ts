import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { planStatus } from "../src/commands/plan-status.js";
import { runFolder } from "../src/run-state.js";
import { collect, commitFiles, commitPlan, git, makeRepo } from "./helpers/plan-repo.js";

const text = readFileSync(new URL("./fixtures/plans/full.md", import.meta.url), "utf8");

/** A repository with the plan on main, a unit commit on main, and a feature branch. */
function setup() {
  const dir = makeRepo();
  const plan = commitPlan(dir, text);
  commitFiles(dir, ["src/u1.ts"], 1);
  git(dir, "checkout", "-b", "feature");
  return { dir, plan };
}

const status = (dir: string, ...args: string[]) => {
  const { out, io } = collect();
  const code = planStatus(["--plan", "docs/plans/full.md", ...args], io, { cwd: dir });
  return { code, out };
};

describe("cstack plan status", () => {
  it("says which units are done, with the short hash, and ignores a commit on main", () => {
    const { dir } = setup();
    const hash = commitFiles(dir, ["src/u2.ts"], 2);
    const { code, out } = status(dir);
    expect(code).toBe(0);
    expect(out.stdout).toContain("Unit 1: Thing 1: not done\n");
    expect(out.stdout).toContain(`Unit 2: Thing 2: done (${hash.slice(0, 7)})\n`);
    expect(out.stderr).toBe("");
  });

  it("exits with 1 and names a commit of a unit that the plan does not have, after the statuses", () => {
    const { dir } = setup();
    const hash = commitFiles(dir, ["src/u2.ts"], 77);
    const { code, out } = status(dir);
    expect(code).toBe(1);
    expect(out.stdout).toContain("Unit 10:");
    expect(out.stderr).toContain(hash.slice(0, 7));
    expect(out.stderr).toContain("77");
  });

  it("exits with 1 and names a file outside the Files of the unit", () => {
    const { dir } = setup();
    commitFiles(dir, ["src/u2.ts", "src/other.ts"], 2);
    const { code, out } = status(dir);
    expect(code).toBe(1);
    expect(out.stderr).toContain("src/other.ts");
  });

  it("exits with 1 on a trailer that is not a number", () => {
    const { dir } = setup();
    writeFileSync(join(dir, "x.txt"), "x\n");
    git(dir, "add", "x.txt");
    git(dir, "commit", "-m", "feat: x\n\nCstack-Unit: abc");
    const { code, out } = status(dir);
    expect(code).toBe(1);
    expect(out.stderr).toContain("abc");
  });

  it("shows saved test runs", () => {
    const { dir, plan } = setup();
    const folder = join(runFolder(dir, plan), "units", "1");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "red.json"), "{}");
    let { out } = status(dir);
    expect(out.stdout).toContain("Unit 1: Thing 1: not done, failing run saved\n");
    writeFileSync(join(folder, "green.json"), "{}");
    ({ out } = status(dir));
    expect(out.stdout).toContain("not done, failing run saved, passing run saved\n");
  });

  it("shows a Blocked line with its reason", () => {
    const dir = makeRepo();
    const blocked = text.replace("- Depends on: none", "- Depends on: none\n- Blocked: waiting for a decision");
    commitPlan(dir, blocked);
    const { code, out } = status(dir);
    expect(code).toBe(0);
    expect(out.stdout).toContain("blocked: waiting for a decision");
  });

  it("gives the same data with --json", () => {
    const { dir } = setup();
    const hash = commitFiles(dir, ["src/u2.ts", "src/other.ts"], 2);
    const { code, out } = status(dir, "--json");
    expect(code).toBe(1);
    const data = JSON.parse(out.stdout);
    expect(data.units[1]).toEqual({
      number: 2,
      name: "Thing 2",
      done: true,
      commits: [hash],
      blocked: null,
      failingRunSaved: false,
      passingRunSaved: false,
    });
    expect(data.problems).toEqual([
      expect.objectContaining({ kind: "file-outside-unit", commit: hash, units: [2], file: "src/other.ts" }),
    ]);
  });

  it("exits with 2 on a wrong option and 3 on a plan that cannot be read", () => {
    const { dir } = setup();
    expect(status(dir, "--nope").code).toBe(2);
    const { out, io } = collect();
    expect(planStatus(["--plan", "docs/plans/missing.md"], io, { cwd: dir })).toBe(3);
    expect(out.stderr).toContain("missing.md");
  });
});
