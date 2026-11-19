import { mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { helperStart } from "../../src/commands/helper-start.js";
import type { Runner } from "../../src/orca/run.js";
import { saveUnitReport } from "../../src/report/reports.js";
import { collect, commitPlan, git, makeRepo } from "../helpers/plan-repo.js";

const PKG = join(import.meta.dirname, "..", "..");
const fixtures = join(PKG, "test", "fixtures", "orca", "1.4.263");
const fixture = (file: string) => readFileSync(join(fixtures, file), "utf8");
const PLAN = "docs/plans/full.md";
// Units 1 and 2 share no file and no dependency, so both are in the first batch.
const full = readFileSync(join(PKG, "test", "fixtures", "plans", "full.md"), "utf8").replace("- Depends on: 1\n", "- Depends on: none\n");

function setup(options: { workers?: boolean } = {}) {
  const dir = makeRepo();
  commitPlan(dir, full);
  writeFileSync(join(dir, "CLAUDE.md"), "rules\n");
  git(dir, "add", "CLAUDE.md");
  git(dir, "commit", "-m", "docs: rules");
  git(dir, "checkout", "-b", "gambitl/full-example");
  const calls: { args: string[] }[] = [];
  const answers: Record<string, string> = {
    "--version": fixture("version.current.txt"),
    "status --json": fixture("status.running.json"),
    "agent-context --json": fixture("agent-context.current.json"),
  };
  const runner: Runner = async (_command, args) => {
    calls.push({ args });
    if (args[0] === "orchestration" && args[1] === "worker-start") {
      if (args[args.indexOf("--worktree") + 1] === "new-child") {
        const name = args[args.indexOf("--name") + 1]!;
        const path = `${dir}-child-${name}`;
        git(dir, "worktree", "add", "-b", `child/${name}`, path, args[args.indexOf("--base-branch") + 1]!);
        return { kind: "ok", stdout: fixture("orchestration-worker-start.new-child.json").replace("/placeholder/worktrees/child", path) };
      }
      return { kind: "ok", stdout: fixture("orchestration-worker-start.ready.json") };
    }
    const stdout = answers[args.join(" ")];
    return stdout === undefined ? { kind: "missing" } : { kind: "ok", stdout };
  };
  const { out, io } = collect();
  let minute = 5;
  const run = (args: string[], env: Record<string, string> = {}) =>
    helperStart(args, io, {
      cwd: dir,
      env,
      packageRoot: PKG,
      createRunner: () => runner,
      now: () => new Date(`2026-11-19T14:${String(minute++).padStart(2, "0")}:05.123Z`),
    });
  const starts = () => calls.filter((c) => c.args[1] === "worker-start");
  return { dir, out, run, starts };
}

async function stuckChild() {
  const t = setup();
  expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(0);
  const args = t.starts()[0]!.args;
  const child = realpathSync(`${t.dir}-child-${args[args.indexOf("--name") + 1]}`);
  saveUnitReport({ root: t.dir, planFile: PLAN }, 2, { kind: "stuck", text: "blocked\n", helper: "20261119-143205123-implementer-2" }, new Date("2026-11-19T14:41:00.000Z"));
  return { ...t, child };
}

describe("the second attempt of a stuck unit in a child worktree", () => {
  it("copies the plan file into the child and starts the worker there", async () => {
    const t = await stuckChild();
    writeFileSync(join(t.dir, PLAN), `${readFileSync(join(t.dir, PLAN), "utf8")}\nA note.\n`);
    expect(await t.run(["implementer-escalation", "--unit", "2", "--plan", PLAN])).toBe(0);
    expect(readFileSync(join(t.child, PLAN), "utf8")).toBe(readFileSync(join(t.dir, PLAN), "utf8"));
    const args = t.starts()[1]!.args;
    expect(args[args.indexOf("--worktree") + 1]).toBe(`path:${t.child}`);
    for (const flag of ["--name", "--base-branch", "--setup"]) expect(args).not.toContain(flag);
    const id = t.out.stdout.trim().split("\n").filter((l) => /^\d{8}-/.test(l)).pop()!;
    const record = JSON.parse(readFileSync(join(t.dir, ".git", "cstack", "runs", "full", "helpers", `${id}.json`), "utf8"));
    expect(record.worktree.path).toBe(t.child);
  });

  it("refuses a new implementer while the child is not collected", async () => {
    const t = await stuckChild();
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN])).toBe(1);
    expect(t.starts()).toHaveLength(1);
  });

  it("refuses when the recorded child folder is gone", async () => {
    const t = await stuckChild();
    rmSync(t.child, { recursive: true });
    expect(await t.run(["implementer-escalation", "--unit", "2", "--plan", PLAN])).toBe(1);
    expect(t.starts()).toHaveLength(1);
  });

  it("refuses to copy the plan file over a symbolic link in the child", async () => {
    const t = await stuckChild();
    const target = join(t.dir, "elsewhere.md");
    writeFileSync(target, "keep\n");
    rmSync(join(t.child, PLAN));
    symlinkSync(target, join(t.child, PLAN));
    expect(await t.run(["implementer-escalation", "--unit", "2", "--plan", PLAN])).toBe(1);
    expect(readFileSync(target, "utf8")).toBe("keep\n");
    expect(t.starts()).toHaveLength(1);
  });

  it("refuses when the recorded folder exists but git no longer lists it as a worktree", async () => {
    const t = await stuckChild();
    git(t.dir, "worktree", "remove", "--force", t.child);
    mkdirSync(join(t.child, "docs"), { recursive: true });
    expect(await t.run(["implementer-escalation", "--unit", "2", "--plan", PLAN])).toBe(1);
    expect(t.starts()).toHaveLength(1);
  });

  it("names the child worktree as the repository root in the sub-agent fallback", async () => {
    const t = await stuckChild();
    expect(await t.run(["implementer-escalation", "--unit", "2", "--plan", PLAN], { CSTACK_ORCA_WORKERS: "off" })).toBe(6);
    expect(t.out.stdout).toContain(`- Repository root: ${t.child}`);
    expect(t.out.stdout).toContain(`- Plan file: ${join(t.child, PLAN)}`);
  });
});
