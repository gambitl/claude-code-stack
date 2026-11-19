import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { helperStart } from "../../src/commands/helper-start.js";
import type { Runner } from "../../src/orca/run.js";
import { updateRecord } from "../../src/helper/record.js";
import { collect, commitFiles, commitPlan, git, makeRepo } from "../helpers/plan-repo.js";

const PKG = join(import.meta.dirname, "..", "..");
const fixtures = join(PKG, "test", "fixtures", "orca", "1.4.263");
const fixture = (file: string) => readFileSync(join(fixtures, file), "utf8");
const PLAN = "docs/plans/full.md";
// Units 1 and 2 share no file and no dependency, so both are in the first batch.
const full = readFileSync(join(PKG, "test", "fixtures", "plans", "full.md"), "utf8").replace("- Depends on: 1\n", "- Depends on: none\n");

function setup(options: { plan?: string; env?: Record<string, string>; features?: boolean } = {}) {
  const dir = makeRepo();
  commitPlan(dir, options.plan ?? full);
  writeFileSync(join(dir, "CLAUDE.md"), "rules\n");
  git(dir, "add", "CLAUDE.md");
  git(dir, "commit", "-m", "docs: rules");
  git(dir, "checkout", "-b", "gambitl/full-example");
  const calls: { command: string; args: string[] }[] = [];
  const context = fixture("agent-context.current.json");
  const answers: Record<string, string> = {
    "--version": fixture("version.current.txt"),
    "status --json": fixture("status.running.json"),
    "agent-context --json": options.features === false ? context.replace(/"orchestration worker-release"/g, '"x"') : context,
  };
  const runner: Runner = async (command, args) => {
    calls.push({ command, args });
    if (args[0] === "orchestration" && args[1] === "worker-start") {
      const path = `${dir}-child-${args[args.indexOf("--name") + 1]}`;
      const base = args[args.indexOf("--base-branch") + 1]!;
      if (args[args.indexOf("--worktree") + 1] === "new-child") git(dir, "worktree", "add", "-b", `child/${args[args.indexOf("--name") + 1]}`, path, base);
      return { kind: "ok", stdout: fixture("orchestration-worker-start.new-child.json").replace("/placeholder/worktrees/child", path) };
    }
    const stdout = answers[args.join(" ")];
    return stdout === undefined ? { kind: "missing" } : { kind: "ok", stdout };
  };
  const { out, io } = collect();
  const run = (args: string[]) =>
    helperStart(args, io, { cwd: dir, env: options.env ?? {}, packageRoot: PKG, createRunner: () => runner, now: () => new Date("2026-11-19T14:32:05.123Z") });
  const starts = () => calls.filter((c) => c.args[1] === "worker-start");
  return { dir, calls, out, run, starts };
}

const arg = (args: string[], name: string) => args[args.indexOf(name) + 1];

describe("cstack helper start --child-worktree", () => {
  it("starts each unit of the first batch in a new child worktree", async () => {
    const t = setup();
    const base = git(t.dir, "rev-parse", "HEAD");
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(0);
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(0);
    const [one, two] = t.starts().map((c) => c.args);
    expect(arg(one!, "--worktree")).toBe("new-child");
    expect(arg(one!, "--setup")).toBe("skip");
    expect(arg(one!, "--base-branch")).toBe(base);
    expect(arg(one!, "--name")).toBe("full-example-unit-1-143205");
    expect(arg(two!, "--name")).toBe("full-example-unit-2-143205");
    expect(readFileSync(arg(one!, "--spec-file")!, "utf8")).toContain("Plan file: docs/plans/full.md");
    expect(t.out.stdout.split("\n")[0]).toBe("20261119-143205123-implementer-1");
  });

  it("refuses a unit that is not in the first batch", async () => {
    const shared = full.replace("- Files: `src/u2.ts`", "- Files: `src/u1.ts`");
    const t = setup({ plan: shared });
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(1);
    expect(t.out.stderr).toContain("src/u1.ts");
    expect(t.starts()).toEqual([]);
  });

  it("refuses and starts no worker when a file outside the plan file is uncommitted", async () => {
    const t = setup();
    writeFileSync(join(t.dir, "stray.txt"), "x\n");
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(1);
    expect(t.out.stderr).toContain("stray.txt");
    expect(t.starts()).toEqual([]);
  });

  it("refuses and starts no worker when the checked out branch is not the branch of the plan", async () => {
    const t = setup();
    git(t.dir, "checkout", "-b", "other");
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(1);
    expect(t.starts()).toEqual([]);
  });

  // The checks of the ticket worktree protect a new child worktree only. Without one, the start stays as in #27.
  it("starts in the current worktree without the feature, even with an uncommitted file", async () => {
    const t = setup({ features: false });
    writeFileSync(join(t.dir, "stray.txt"), "x\n");
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(0);
    expect(arg(t.starts()[0]!.args, "--worktree")).toBe("current");
  });

  it("prints the sub-agent with CSTACK_ORCA_WORKERS off, even with an uncommitted file", async () => {
    const t = setup({ env: { CSTACK_ORCA_WORKERS: "off" } });
    writeFileSync(join(t.dir, "stray.txt"), "x\n");
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(6);
    expect(t.out.stdout).toContain("Sub-agent: resolve-issue:implementer");
  });

  it("refuses the executor with 2", async () => {
    const t = setup();
    expect(await t.run(["executor", "--plan", PLAN, "--child-worktree"])).toBe(2);
    expect(t.calls).toEqual([]);
  });

  it("starts in the current worktree without the feature", async () => {
    const t = setup({ features: false });
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(0);
    expect(arg(t.starts()[0]!.args, "--worktree")).toBe("current");
    expect(t.out.stdout.split("\n")[0]).toBe("20261119-143205123-implementer-1");
    expect(t.out.stdout.split("\n")[1]).toMatch(/current worktree/);
  });

  it("starts no worker with CSTACK_ORCA_WORKERS off", async () => {
    const t = setup({ env: { CSTACK_ORCA_WORKERS: "off" } });
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(6);
    expect(t.starts()).toEqual([]);
  });

  it("starts in the current worktree when the first batch holds only that unit", async () => {
    const t = setup({ plan: readFileSync(join(PKG, "test", "fixtures", "plans", "full.md"), "utf8") });
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(0);
    expect(arg(t.starts()[0]!.args, "--worktree")).toBe("current");
    expect(t.out.stdout.split("\n")[1]).toMatch(/only/);
  });

  it("refuses a unit that shares a file with a unit still running in a child worktree, also after another unit is collected", async () => {
    const text = full.slice(0, full.indexOf("### Unit 1:")) + [
      ["1", "src/a.ts", "none"],
      ["2", "src/f.ts", "1"],
      ["3", "src/f.ts`, `src/g.ts", "none"],
    ].map(([n, files, dep]) => `### Unit ${n}: Thing ${n}\n- Files: \`${files}\`\n- No test: prose only.\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`feat(cli): add ${n}\`\n- Depends on: ${dep}\n`).join("\n") + "\n" + full.slice(full.indexOf("## Documentation duties"));
    const t = setup({ plan: text });
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(0);
    expect(await t.run(["implementer", "--unit", "3", "--plan", PLAN, "--child-worktree"])).toBe(0);
    // Unit 1 is collected: its commit is on the ticket branch and its record says so.
    commitFiles(t.dir, ["src/a.ts"], 1);
    const folder = join(t.dir, ".git", "cstack", "runs", "full");
    const first = readdirSync(join(folder, "helpers")).find((n) => n.endsWith("-implementer-1.json"))!;
    updateRecord(folder, first.slice(0, -5), { collectedAt: "2026-11-19T15:00:00.000Z" });
    git(t.dir, "add", "-A");
    git(t.dir, "commit", "-m", "docs: plan lines");
    const before = t.starts().length;
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(1);
    expect(t.out.stderr).toContain("src/f.ts");
    expect(t.out.stderr).toContain("unit 3");
    expect(t.starts()).toHaveLength(before);
  });
});
