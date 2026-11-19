import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { unitCollect } from "../../src/commands/unit-collect.js";
import { planStatus } from "../../src/commands/plan-status.js";
import { createRecord, makeHelperId } from "../../src/helper/record.js";
import { saveUnitReport } from "../../src/report/reports.js";
import { runFolder } from "../../src/run-state.js";
import { collect, commitFiles, git, makeRepo } from "../helpers/plan-repo.js";

const approved = readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8");
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function planText(): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const files = ["src/a.ts", "src/b.ts", "src/c.ts"];
  const body = files
    .map(
      (f, i) =>
        `### Unit ${i + 1}: Thing ${i + 1}\n- Files: \`${f}\`\n- No test: prose only.\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`feat(cli): add ${i + 1}\`\n- Depends on: none\n`,
    )
    .join("\n");
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

/** A ticket worktree on gambitl/units with the plan committed, and one child worktree per unit number. */
function setup(units: number[]) {
  const dir = realpathSync(makeRepo());
  made.push(dir);
  git(dir, "config", "user.name", "t");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "commit.gpgsign", "false");
  git(dir, "switch", "-c", "gambitl/units");
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs/plan.md"), planText());
  git(dir, "add", "docs/plan.md");
  git(dir, "commit", "-m", "docs: plan");
  const children: Record<number, string> = {};
  for (const n of units) {
    children[n] = `${dir}-child-${n}`;
    made.push(children[n]!);
    git(dir, "worktree", "add", "-b", `child-${n}`, children[n]!, "HEAD");
  }
  return { dir, children };
}

/** Writes the helper record and a report for a unit, as a helper that started in a child worktree would. */
function helped(dir: string, child: string, n: number, kind: "done" | "stuck" = "done") {
  const id = makeHelperId("implementer", n);
  createRecord(runFolder(dir, "docs/plan.md"), {
    format: "cstack-helper/1",
    id,
    role: "implementer",
    unit: n,
    startedAt: new Date().toISOString(),
    mode: "orca-worker",
    worktree: { path: child, branch: `child-${n}` },
  });
  saveUnitReport({ root: dir, planFile: "docs/plan.md" }, n, { kind, text: "ok", helper: id });
}

const run = (dir: string, ...args: string[]) => {
  const { out, io } = collect();
  const code = unitCollect([...args, "--plan", "docs/plan.md"], io, { cwd: dir });
  return { code, ...out };
};

const subjects = (dir: string) => git(dir, "log", "--format=%s", "main..HEAD").split("\n").reverse();

describe("cstack unit collect", () => {
  it("puts unit 1 before unit 2 and plan status reports both done", () => {
    const { dir, children } = setup([1, 2]);
    commitFiles(children[2]!, ["src/b.ts"], 2);
    commitFiles(children[1]!, ["src/a.ts"], 1);
    helped(dir, children[1]!, 1);
    helped(dir, children[2]!, 2);
    const result = run(dir, "2", "1");
    expect(result.code).toBe(0);
    expect(subjects(dir).filter((s) => s !== "docs: plan")).toEqual(["feat(cli): unit 1", "feat(cli): unit 2"]);
    const { out, io } = collect();
    expect(planStatus(["--plan", "docs/plan.md"], io, { cwd: dir })).toBe(0);
    expect(out.stdout).toMatch(/Unit 1: .*: done/);
    expect(out.stdout).toMatch(/Unit 2: .*: done/);
  });

  it("refuses a commit without the trailer and leaves the branch where it was", () => {
    const { dir, children } = setup([1]);
    commitFiles(children[1]!, ["src/a.ts"]);
    helped(dir, children[1]!, 1);
    const before = git(dir, "rev-parse", "HEAD");
    const result = run(dir, "1");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Cstack-Unit: 1");
    expect(git(dir, "rev-parse", "HEAD")).toBe(before);
  });

  it("refuses a commit that touches a file of another unit", () => {
    const { dir, children } = setup([1]);
    commitFiles(children[1]!, ["src/a.ts", "src/b.ts"], 1);
    helped(dir, children[1]!, 1);
    const before = git(dir, "rev-parse", "HEAD");
    const result = run(dir, "1");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("src/b.ts");
    expect(git(dir, "rev-parse", "HEAD")).toBe(before);
  });

  it("aborts a conflicting cherry-pick, keeps the branch and keeps the uncommitted plan change", () => {
    const { dir, children } = setup([1]);
    commitFiles(children[1]!, ["src/a.ts"], 1);
    helped(dir, children[1]!, 1);
    commitFiles(dir, ["src/a.ts"]);
    const before = git(dir, "rev-parse", "HEAD");
    writeFileSync(join(dir, "docs/plan.md"), `${planText()}\nnote\n`);
    const result = run(dir, "1");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("src/a.ts");
    expect(git(dir, "rev-parse", "HEAD")).toBe(before);
    expect(() => git(dir, "rev-parse", "--verify", "--quiet", "CHERRY_PICK_HEAD")).toThrow();
    expect(readFileSync(join(dir, "docs/plan.md"), "utf8")).toContain("\nnote\n");
  });

  it("skips and names a stuck unit, and still collects the others", () => {
    const { dir, children } = setup([1, 2]);
    commitFiles(children[1]!, ["src/a.ts"], 1);
    commitFiles(children[2]!, ["src/b.ts"], 2);
    helped(dir, children[1]!, 1, "stuck");
    helped(dir, children[2]!, 2);
    const result = run(dir, "1", "2");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Unit 1 was skipped: its helper reported stuck");
    expect(subjects(dir)).toContain("feat(cli): unit 2");
    expect(subjects(dir)).not.toContain("feat(cli): unit 1");
  });

  it("refuses with 1 when the worktree has an uncommitted change outside the plan file", () => {
    const { dir, children } = setup([1]);
    commitFiles(children[1]!, ["src/a.ts"], 1);
    helped(dir, children[1]!, 1);
    writeFileSync(join(dir, "stray.txt"), "x");
    const result = run(dir, "1");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("stray.txt");
  });

  it("refuses with 2 a number that is not a unit of the plan", () => {
    const { dir } = setup([]);
    expect(run(dir, "9").code).toBe(2);
  });

  it("does not apply a unit again when the ticket branch already has its commit", () => {
    const { dir, children } = setup([1]);
    commitFiles(children[1]!, ["src/a.ts"], 1);
    helped(dir, children[1]!, 1);
    expect(run(dir, "1").code).toBe(0);
    const head = git(dir, "rev-parse", "HEAD");
    const again = run(dir, "1");
    expect(again.code).toBe(0);
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
  });

  it("has no push, reset or force in its source", () => {
    const source = readFileSync(new URL("../../src/unit/collect.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/push|reset|--force/);
  });
});
