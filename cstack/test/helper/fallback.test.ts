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

type Answers = Record<string, RunResult>;

function setup(options: { answers?: Answers; start?: RunResult; env?: Record<string, string> } = {}) {
  const dir = makeRepo();
  commitPlan(dir, full);
  writeFileSync(join(dir, "CLAUDE.md"), "rules\n");
  git(dir, "checkout", "-b", "feature");
  const calls: string[][] = [];
  const answers: Answers = {
    "--version": { kind: "ok", stdout: fixture("version.current.txt") },
    "status --json": { kind: "ok", stdout: fixture("status.running.json") },
    "agent-context --json": { kind: "ok", stdout: fixture("agent-context.current.json") },
    ...options.answers,
  };
  const runner: Runner = async (_command, args) => {
    calls.push(args);
    if (args[1] === "worker-start") return options.start ?? { kind: "ok", stdout: fixture("orchestration-worker-start.ready.json") };
    return answers[args.join(" ")] ?? { kind: "missing" };
  };
  const { out, io } = collect();
  const run = (args: string[]) =>
    helperStart(args, io, { cwd: dir, env: options.env ?? {}, packageRoot: PKG, createRunner: () => runner, now: () => new Date("2026-11-19T14:32:05.123Z") });
  const record = () => {
    const folder = join(runFolder(dir, PLAN), "helpers");
    const names = existsSync(folder) ? readdirSync(folder).filter((n) => n.endsWith(".json")) : [];
    expect(names).toHaveLength(1);
    return JSON.parse(readFileSync(join(folder, names[0]!), "utf8"));
  };
  return { calls, out, run, record };
}

function expectFallback(t: ReturnType<typeof setup>, reason: RegExp) {
  const text = t.out.stdout;
  expect(text).toMatch(reason);
  expect(text).toContain("Sub-agent: resolve-issue:executor");
  expect(text).toContain("- Plan file:");
  expect(text).toContain("- Conventions file:");
  expect(text).toContain("- Repository root:");
  expect(text.trimEnd().split("\n").pop()).toBe("Helper id: 20261119-143205123-executor");
  expect(t.record()).toMatchObject({ mode: "sub-agent", role: "executor", unit: null });
  expect(t.record().reason).toMatch(reason);
}

describe("cstack helper start fallback to a sub-agent", () => {
  it("falls back when there is no orca program", async () => {
    const t = setup({ answers: { "--version": { kind: "missing" }, "status --json": { kind: "missing" }, "agent-context --json": { kind: "missing" } } });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(6);
    expectFallback(t, /Orca/);
    expect(t.calls.some((a) => a[1] === "worker-start")).toBe(false);
  });

  it("falls back when Orca is too old", async () => {
    const t = setup({ answers: { "--version": { kind: "ok", stdout: "1.4.258\n" } } });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(6);
    expectFallback(t, /1\.4\.258/);
  });

  it("falls back when Orca does not run", async () => {
    const t = setup({ answers: { "status --json": { kind: "ok", stdout: fixture("status.closed.json") } } });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(6);
    expectFallback(t, /Orca/);
  });

  it("falls back with the message of a refusal", async () => {
    const t = setup({ start: { kind: "failed", exitCode: 1, stdout: fixture("orchestration-worker-start.refused.json") } });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(6);
    expectFallback(t, /The nesting limit of workers is reached\./);
  });

  it("makes no call at all when CSTACK_ORCA_WORKERS is off", async () => {
    const t = setup({ env: { CSTACK_ORCA_WORKERS: "off" } });
    expect(await t.run(["executor", "--plan", PLAN])).toBe(6);
    expect(t.calls).toEqual([]);
    expectFallback(t, /CSTACK_ORCA_WORKERS is off\./);
  });

  it("names the unit of an implementer", async () => {
    const t = setup({ env: { CSTACK_ORCA_WORKERS: "off" } });
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN])).toBe(6);
    expect(t.out.stdout).toContain("Sub-agent: resolve-issue:implementer");
    expect(t.out.stdout).toContain("- Unit number: 2");
    expect(t.record()).toMatchObject({ mode: "sub-agent", unit: 2 });
  });
});
