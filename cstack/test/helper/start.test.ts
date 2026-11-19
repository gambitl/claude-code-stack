import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { helperStart } from "../../src/commands/helper-start.js";
import type { Runner, RunResult } from "../../src/orca/run.js";
import { runFolder } from "../../src/run-state.js";
import { collect, commitPlan, git, makeRepo } from "../helpers/plan-repo.js";

const PKG = join(import.meta.dirname, "..", "..");
const fixtures = join(PKG, "test", "fixtures", "orca", "1.4.263");
const fixture = (file: string) => readFileSync(join(fixtures, file), "utf8");
const full = readFileSync(join(PKG, "test", "fixtures", "plans", "full.md"), "utf8");
const PLAN = "docs/plans/full.md";

function setup(options: { plan?: string; start?: RunResult | string; env?: Record<string, string> } = {}) {
  const dir = makeRepo();
  commitPlan(dir, options.plan ?? full);
  writeFileSync(join(dir, "CLAUDE.md"), "rules\n");
  git(dir, "checkout", "-b", "feature");
  const calls: { command: string; args: string[] }[] = [];
  const startAnswer = options.start ?? fixture("orchestration-worker-start.ready.json");
  const answers: Record<string, string> = {
    "--version": fixture("version.current.txt"),
    "status --json": fixture("status.running.json"),
    "agent-context --json": fixture("agent-context.current.json"),
  };
  const runner: Runner = async (command, args) => {
    calls.push({ command, args });
    if (args[0] === "orchestration" && args[1] === "worker-start") {
      return typeof startAnswer === "string" ? { kind: "ok", stdout: startAnswer } : startAnswer;
    }
    const stdout = answers[args.join(" ")];
    return stdout === undefined ? { kind: "missing" } : { kind: "ok", stdout };
  };
  const { out, io } = collect();
  const run = (args: string[]) =>
    helperStart(args, io, { cwd: dir, env: options.env ?? {}, packageRoot: PKG, createRunner: () => runner, now: () => new Date("2026-11-19T14:32:05.123Z") });
  const records = () => {
    const folder = join(runFolder(dir, PLAN), "helpers");
    return existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith(".json")) : [];
  };
  const starts = () => calls.filter((c) => c.args[1] === "worker-start");
  return { dir, calls, out, run, records, starts };
}

describe("cstack helper start", () => {
  it("starts an executor as an Orca worker and records the Dispatch id", async () => {
    const t = setup();
    expect(await t.run(["executor", "--plan", PLAN])).toBe(0);
    const [start] = t.starts();
    expect(start!.command).toBe("orca");
    const a = start!.args;
    expect(a.slice(0, 2)).toEqual(["orchestration", "worker-start"]);
    expect(a[a.indexOf("--agent") + 1]).toBe("claude");
    expect(a[a.indexOf("--worktree") + 1]).toBe("current");
    expect(a[a.indexOf("--model") + 1]).toBe("sonnet");
    expect(a[a.indexOf("--effort") + 1]).toBe("medium");
    expect(a[a.indexOf("--task-title") + 1]).toBe("executor");
    const spec = a[a.indexOf("--spec-file") + 1]!;
    expect(readFileSync(spec, "utf8")).toContain("cstack helper done");
    const id = t.out.stdout.split("\n")[0]!;
    expect(id).toBe("20261119-143205123-executor");
    expect(t.out.stdout).toContain(`cstack helper wait ${id}`);
    const record = JSON.parse(readFileSync(join(runFolder(t.dir, PLAN), "helpers", `${id}.json`), "utf8"));
    expect(record).toMatchObject({ mode: "orca-worker", dispatchId: "ctx_000000000001", role: "executor", unit: null });
    expect(JSON.stringify(a)).not.toContain("Thing 1");
  });

  it("starts an implementer for a unit of the plan", async () => {
    const t = setup();
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN])).toBe(0);
    const a = t.starts()[0]!.args;
    expect(a[a.indexOf("--task-title") + 1]).toBe("implementer unit 2");
    expect(t.out.stdout.split("\n")[0]).toBe("20261119-143205123-implementer-2");
  });

  it("refuses a plan that is not approved, with no Orca call", async () => {
    const t = setup({ plan: full.replace(/^Approved at: .*$/m, "Approved at: not yet") });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(1);
    expect(t.calls).toEqual([]);
  });

  it("refuses a unit that is not in the plan, and a missing or extra --unit", async () => {
    const t = setup();
    expect(await t.run(["implementer", "--unit", "99", "--plan", PLAN])).toBe(2);
    expect(await t.run(["implementer", "--plan", PLAN])).toBe(2);
    expect(await t.run(["executor", "--unit", "1", "--plan", PLAN])).toBe(2);
    expect(await t.run(["reviewer", "--plan", PLAN])).toBe(2);
    expect(t.calls).toEqual([]);
  });

  it("stops with 5 and no record when Orca refuses the model", async () => {
    const t = setup({ start: { kind: "failed", exitCode: 1, stdout: fixture("orchestration-worker-start.model-refused.json") } });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(5);
    expect(t.records()).toEqual([]);
  });

  it("stops with 5 and no record on a failed stage and on a timeout", async () => {
    const failed = setup({ start: { kind: "failed", exitCode: 1, stdout: fixture("orchestration-worker-start.failed-stage.json") } });
    expect(await failed.run(["executor", "--plan", PLAN])).toBe(5);
    expect(failed.records()).toEqual([]);
    const slow = setup({ start: { kind: "timeout" } });
    expect(await slow.run(["executor", "--plan", PLAN])).toBe(5);
    expect(slow.records()).toEqual([]);
  });

  it("falls back to a sub-agent with exit code 6 when workers are off or Orca refuses", async () => {
    const off = setup({ env: { CSTACK_ORCA_WORKERS: "off" } });
    expect(await off.run(["executor", "--plan", PLAN])).toBe(6);
    expect(off.calls).toEqual([]);
    expect(off.out.stdout).toContain("resolve-issue:executor");
    expect(off.records()).toHaveLength(1);
    const nested = setup({ start: { kind: "failed", exitCode: 1, stdout: fixture("orchestration-worker-start.refused.json") } });
    expect(await nested.run(["executor", "--plan", PLAN])).toBe(6);
    expect(nested.out.stdout).toContain("Orca refused to start a worker");
  });
});
