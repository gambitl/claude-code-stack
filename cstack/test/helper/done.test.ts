import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reportCheck } from "../../src/commands/report-check.js";
import { helperDone } from "../../src/commands/helper-done.js";
import { createRecord, type HelperRole } from "../../src/helper/record.js";
import type { Runner, RunResult } from "../../src/orca/run.js";
import { runFolder } from "../../src/run-state.js";
import { collect, commitFiles, commitPlan, git, makeRepo } from "../helpers/plan-repo.js";

const PKG = join(import.meta.dirname, "..", "..");
const fixtures = join(PKG, "test", "fixtures", "orca", "1.4.263");
const fixture = (file: string) => readFileSync(join(fixtures, file), "utf8");
const full = readFileSync(join(PKG, "test", "fixtures", "plans", "full.md"), "utf8");
const PLAN = "docs/plans/full.md";
const DISPATCH = "ctx_000000000001";

interface Options {
  text?: string;
  units?: number[];
  role?: HelperRole;
  unit?: number | null;
  mode?: "orca-worker" | "sub-agent";
  env?: Record<string, string>;
}

function setup(options: Options = {}) {
  const dir = makeRepo();
  commitPlan(dir, options.text ?? full);
  git(dir, "checkout", "-b", "feature");
  for (const unit of options.units ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) commitFiles(dir, [`src/u${unit}.ts`], unit);
  const role = options.role ?? "executor";
  const unit = options.unit ?? null;
  const id = `20261119-143205123-${role}${unit === null ? "" : `-${unit}`}`;
  const mode = options.mode ?? "orca-worker";
  createRecord(runFolder(dir, PLAN), {
    format: "cstack-helper/1",
    id,
    role,
    unit,
    startedAt: "2026-11-19T14:32:05.123Z",
    mode,
    ...(mode === "orca-worker" ? { dispatchId: DISPATCH } : { reason: "CSTACK_ORCA_WORKERS is off." }),
  });
  const calls: string[][] = [];
  const results: { send: RunResult } = { send: { kind: "ok", stdout: fixture("orchestration-send.sent.json") } };
  const runner: Runner = async (_command, args) => {
    calls.push(args);
    if (args[1] === "worker-show") return { kind: "ok", stdout: fixture("orchestration-worker-show.working.json") };
    if (args[1] === "send") return results.send;
    return { kind: "missing" };
  };
  const { out, io } = collect();
  const run = (args: string[], text = "") =>
    helperDone(args, io, {
      cwd: dir,
      env: options.env ?? {},
      createRunner: () => runner,
      now: () => new Date("2026-11-19T14:40:00.000Z"),
      readInput: () => Buffer.from(text),
    });
  const record = () => JSON.parse(readFileSync(join(runFolder(dir, PLAN), "helpers", `${id}.json`), "utf8"));
  const files = (...parts: string[]) => {
    const folder = join(runFolder(dir, PLAN), ...parts);
    return existsSync(folder) ? readdirSync(folder).map((n) => join(folder, n)) : [];
  };
  const sends = () => calls.filter((a) => a[1] === "send");
  return { dir, id, calls, out, run, record, files, sends, results };
}

const emptyBriefing = full.replace("The build is done. Every unit has its commit.", "<what was built>");

describe("cstack helper done", () => {
  it("refuses an executor done with an empty Briefing and sends nothing", async () => {
    const t = setup({ text: emptyBriefing });
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(1);
    expect(t.out.stderr).toContain("Briefing");
    expect(t.sends()).toEqual([]);
    expect(t.files("reports")).toEqual([]);
  });

  it("saves a valid executor done and sends worker_done", async () => {
    const t = setup({ env: { ORCA_TERMINAL_HANDLE: "term_abc-123" } });
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN], "all good\n")).toBe(0);
    const [saved] = t.files("reports");
    expect(saved).toBeDefined();
    const show = t.calls.find((a) => a[1] === "worker-show")!;
    expect(show).toEqual(expect.arrayContaining(["--dispatch", DISPATCH, "--full"]));
    const [send] = t.sends();
    const at = (flag: string) => send![send!.indexOf(flag) + 1];
    expect(send!.slice(0, 2)).toEqual(["orchestration", "send"]);
    expect(at("--type")).toBe("worker_done");
    expect(at("--outcome")).toBe("succeeded");
    expect(at("--report-path")).toBe(saved);
    expect(at("--task-id")).toBe("task_000000000001");
    expect(at("--dispatch-id")).toBe(DISPATCH);
    expect(at("--from")).toBe("term_abc-123");
    expect(send).not.toContain("--to");
    expect(JSON.stringify(send)).not.toContain("all good");
    expect(t.record()).toMatchObject({ report: saved, sent: true });
  });

  it("sends no --from without a terminal handle", async () => {
    const t = setup();
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(0);
    expect(t.sends()[0]).not.toContain("--from");
  });

  it("sends the outcome failed for a failed report", async () => {
    const t = setup();
    expect(await t.run(["failed", "--helper", t.id, "--plan", PLAN], "it broke")).toBe(0);
    const send = t.sends()[0]!;
    expect(send[send.indexOf("--outcome") + 1]).toBe("failed");
  });

  it("refuses an implementer done while the unit has no commit with its trailer", async () => {
    const t = setup({ role: "implementer", unit: 2, units: [1] });
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(1);
    expect(t.out.stderr).toContain("Cstack-Unit: 2");
    expect(t.sends()).toEqual([]);
  });

  it("refuses an implementer stuck with an empty text", async () => {
    const t = setup({ role: "implementer", unit: 2 });
    expect(await t.run(["stuck", "--helper", t.id, "--plan", PLAN], "  \n")).toBe(1);
    expect(t.sends()).toEqual([]);
  });

  it("saves an accepted implementer report under its unit, apart from report check", async () => {
    const t = setup({ role: "implementer", unit: 2 });
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(0);
    expect(t.files("reports")).toEqual([]);
    const [saved] = t.files("units", "2", "reports");
    expect(saved).toBeDefined();
    expect(JSON.parse(readFileSync(saved!, "utf8"))).toMatchObject({ kind: "done", text: "", helper: t.id });
    const check = collect();
    expect(await reportCheck(["--plan", PLAN], check.io, { cwd: t.dir })).toBe(1);
    expect(check.out.stdout).toBe("");
    expect(t.sends()[0]).toContain("succeeded");
  });

  it("exits with 5 when the send fails, and a second call only sends", async () => {
    const t = setup();
    t.results.send = { kind: "timeout" };
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(5);
    const [saved] = t.files("reports");
    expect(t.out.stderr).toContain(saved!);
    expect(t.record()).toMatchObject({ report: saved, sent: false });
    t.results.send = { kind: "ok", stdout: fixture("orchestration-send.sent.json") };
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(0);
    expect(t.files("reports")).toEqual([saved]);
    expect(t.sends()).toHaveLength(2);
    expect(t.record().sent).toBe(true);
  });

  it("refuses a call after the report was sent", async () => {
    const t = setup();
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(0);
    const [saved] = t.files("reports");
    const before = t.calls.length;
    expect(await t.run(["done", "--helper", t.id, "--plan", PLAN])).toBe(1);
    expect(t.out.stderr).toContain(saved!);
    expect(t.calls).toHaveLength(before);
  });

  it("exits with 2 on a bad command line and on a helper id that is not valid", async () => {
    const t = setup();
    expect(await t.run(["--helper", t.id])).toBe(2);
    expect(await t.run(["done"])).toBe(2);
    expect(await t.run(["done", "--helper", "nope"])).toBe(2);
    expect(await t.run(["done", "--helper", t.id, "--nope"])).toBe(2);
  });
});
