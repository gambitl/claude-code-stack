import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { helperWait } from "../../src/commands/helper-wait.js";
import { createRecord, type HelperRole } from "../../src/helper/record.js";
import type { Runner, RunResult } from "../../src/orca/run.js";
import { readPlan } from "../../src/plan/read.js";
import { saveReport, saveUnitReport } from "../../src/report/reports.js";
import { createRun, runFolder, writeCurrentRun } from "../../src/run-state.js";
import { collect, commitPlan, git, makeRepo } from "../helpers/plan-repo.js";

const PKG = join(import.meta.dirname, "..", "..");
const fixtures = join(PKG, "test", "fixtures", "orca", "1.4.263");
const fixture = (file: string) => readFileSync(join(fixtures, file), "utf8");
const full = readFileSync(join(PKG, "test", "fixtures", "plans", "full.md"), "utf8");
const PLAN = "docs/plans/full.md";
const DISPATCH = "ctx_000000000001";
const MINUTE = 60_000;

interface Options {
  role?: HelperRole;
  unit?: number | null;
  mode?: "orca-worker" | "sub-agent";
  /** The answers of worker-show, one per call. The last one repeats. */
  shows: string[];
  /** How long a check call takes, in milliseconds. */
  checkTakes?: number;
  checkAnswer?: string;
}

function setup(options: Options) {
  const dir = makeRepo();
  commitPlan(dir, full);
  git(dir, "checkout", "-b", "feature");
  createRun(dir, PLAN, readPlan(full));
  writeCurrentRun(dir, PLAN);
  const role = options.role ?? "executor";
  const unit = options.unit ?? null;
  const id = `20261119-143205123-${role}${unit === null ? "" : `-${unit}`}`;
  const mode = options.mode ?? "orca-worker";
  createRecord(runFolder(dir, PLAN), {
    format: "cstack-helper/1", id, role, unit, startedAt: "2026-11-19T14:32:05.123Z", mode,
    ...(mode === "orca-worker" ? { dispatchId: DISPATCH } : { reason: "CSTACK_ORCA_WORKERS is off." }),
  });
  const where = { root: dir, planFile: PLAN };
  const clock = { ms: Date.parse("2026-11-19T14:40:00.000Z") };
  const calls: string[][] = [];
  const sleeps: number[] = [];
  let shown = 0;
  const runner: Runner = async (_command, args) => {
    calls.push(args);
    if (args[1] === "worker-show") {
      const file = options.shows[Math.min(shown++, options.shows.length - 1)]!;
      return { kind: "ok", stdout: fixture(file) } satisfies RunResult;
    }
    if (args[1] === "check") {
      clock.ms += options.checkTakes ?? 0;
      return { kind: "ok", stdout: options.checkAnswer ?? fixture("orchestration-check.empty.json") };
    }
    return { kind: "missing" };
  };
  const { out, io } = collect();
  const run = (args: string[] = [id]) =>
    helperWait(args, io, {
      cwd: dir,
      env: {},
      createRunner: () => runner,
      now: () => new Date(clock.ms),
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock.ms += ms;
      },
    });
  const checks = () => calls.filter((a) => a[1] === "check");
  const shows = () => calls.filter((a) => a[1] === "worker-show");
  return { dir, id, where, out, run, calls, checks, shows, sleeps };
}

describe("cstack helper wait", () => {
  it("keeps waiting after a worker_done for another Dispatch, then prints the report", async () => {
    const t = setup({ shows: ["orchestration-worker-show.working.json", "orchestration-worker-show.working.json", "orchestration-worker-show.completed.json"], checkAnswer: fixture("orchestration-check.worker-done.json") });
    saveReport(t.where, { kind: "done", text: "The build is done.\n" }, new Date("2026-11-19T14:41:00.000Z"));
    expect(await t.run()).toBe(0);
    expect(t.out.stdout).toBe("done\nThe build is done.\n");
    expect(t.shows()).toHaveLength(3);
    expect(t.checks()).toHaveLength(2);
    expect(await t.run()).toBe(1);
  });

  it("exits with 1 for a finished worker without an accepted report", async () => {
    const t = setup({ shows: ["orchestration-worker-show.completed.json"] });
    expect(await t.run()).toBe(1);
    expect(t.out.stderr).toContain("Launch the helper again");
  });

  it("exits with 1 for a failed worker without a report", async () => {
    const t = setup({ shows: ["orchestration-worker-show.failed.json"] });
    expect(await t.run()).toBe(1);
  });

  it("prints the report of an exited worker, or exits with 1", async () => {
    const t = setup({ shows: ["orchestration-worker-show.exited.json"] });
    expect(await t.run()).toBe(1);
    saveReport(t.where, { kind: "failed", text: "It broke.\n" }, new Date("2026-11-19T14:41:00.000Z"));
    expect(await t.run()).toBe(0);
    expect(t.out.stdout).toBe("failed\nIt broke.\n");
  });

  it("exits with 6 at the deadline", async () => {
    const t = setup({ shows: ["orchestration-worker-show.working.json"], checkTakes: MINUTE });
    expect(await t.run()).toBe(6);
    expect(t.out.stdout).toContain("still working");
    expect(t.checks()).toHaveLength(9);
  });

  it("says that a person must answer a question in Orca, with exit 6", async () => {
    const t = setup({ shows: ["orchestration-worker-show.waiting.json"] });
    expect(await t.run()).toBe(6);
    expect(t.out.stdout).toMatch(/person/);
    expect(t.out.stdout).toContain("in Orca");
    expect(t.checks()).toHaveLength(0);
  });

  it("sleeps the rest of five seconds when check answers at once", async () => {
    const t = setup({ shows: ["orchestration-worker-show.working.json", "orchestration-worker-show.completed.json"], checkTakes: 1000 });
    await t.run();
    expect(t.sleeps).toEqual([4000]);
  });

  it("asks check to peek and wait, never to ack, with at most 60 seconds", async () => {
    const t = setup({ shows: ["orchestration-worker-show.working.json", "orchestration-worker-show.completed.json"] });
    await t.run();
    const check = t.checks()[0]!;
    expect(check).toEqual(expect.arrayContaining(["--peek", "--wait", "--types", "worker_done", "--timeout-ms", "60000"]));
    expect(t.calls.flat()).not.toContain("--ack");
    expect(t.shows()[0]).toEqual(["orchestration", "worker-show", "--dispatch", DISPATCH, "--full", "--json"]);
  });

  it("prints the latest report of the implementer's own helper id", async () => {
    const t = setup({ role: "implementer", unit: 2, shows: ["orchestration-worker-show.completed.json"] });
    saveUnitReport(t.where, 2, { kind: "stuck", text: "old\n", helper: t.id }, new Date("2026-11-19T14:41:00.000Z"));
    saveUnitReport(t.where, 2, { kind: "done", text: "new\n", helper: t.id }, new Date("2026-11-19T14:42:00.000Z"));
    saveUnitReport(t.where, 2, { kind: "done", text: "other\n", helper: "20261119-150000000-implementer-2" }, new Date("2026-11-19T14:43:00.000Z"));
    expect(await t.run()).toBe(0);
    expect(t.out.stdout).toBe("done\nnew\n");
  });

  it("refuses a bad helper id with 2 and an unknown helper with 1", async () => {
    const t = setup({ shows: ["orchestration-worker-show.working.json"] });
    expect(await t.run(["nope"])).toBe(2);
    expect(await t.run(["20261119-143205123-executor-3"])).toBe(2);
    expect(await t.run(["20261119-143205124-executor"])).toBe(1);
    expect(t.calls).toEqual([]);
  });
});
