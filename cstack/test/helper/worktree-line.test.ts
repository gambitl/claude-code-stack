import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { unitCollect } from "../../src/commands/unit-collect.js";
import { saveUnitReport } from "../../src/report/reports.js";
import { helperStart } from "../../src/commands/helper-start.js";
import type { Runner } from "../../src/orca/run.js";
import { runFolder, readCurrentRun } from "../../src/run-state.js";
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


afterEach(() => vi.unstubAllEnvs());

describe("the Worktree line of a child worktree", () => {
  it("writes a child worktree inside the home folder as ~/ and keeps the absolute path in the record", async () => {
    const t = setup();
    vi.stubEnv("HOME", realpathSync(tmpdir()));
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(0);
    const args = t.starts()[0]!.args;
    const child = realpathSync(`${t.dir}-child-${args[args.indexOf("--name") + 1]}`);
    const unit2 = readFileSync(join(t.dir, PLAN), "utf8").split("### Unit 2")[1]!;
    expect(unit2).toContain(`- Worktree: ~/${basename(child)}\n`);
    const id = t.out.stdout.split("\n")[0]!;
    const record = JSON.parse(readFileSync(join(runFolder(t.dir, PLAN), "helpers", `${id}.json`), "utf8"));
    expect(record.worktree.path).toBe(child);
    expect(t.out.stderr).toBe("");
  });

  it("records the child in the plan, the helper record and the current run of the child", async () => {
    const t = setup();
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(0);
    const args = t.starts()[0]!.args;
    const name = args[args.indexOf("--name") + 1]!;
    const child = realpathSync(`${t.dir}-child-${name}`);
    const unit2 = readFileSync(join(t.dir, PLAN), "utf8").split("### Unit 2")[1]!;
    expect(unit2).toContain(`- Worktree: ${child}`);
    const id = t.out.stdout.split("\n")[0]!;
    const record = JSON.parse(readFileSync(join(runFolder(t.dir, PLAN), "helpers", `${id}.json`), "utf8"));
    expect(record.worktree).toEqual({ path: child, branch: `child/${name}` });
    expect(readCurrentRun(child)).toBe("full.md");
    expect(await t.run(["implementer", "--unit", "1", "--plan", PLAN, "--child-worktree"])).toBe(0);
  });

  it("keeps the line in the plan after the collect and the removal of the child worktree", async () => {
    const t = setup();
    expect(await t.run(["implementer", "--unit", "2", "--plan", PLAN, "--child-worktree"])).toBe(0);
    const args = t.starts()[0]!.args;
    const child = realpathSync(`${t.dir}-child-${args[args.indexOf("--name") + 1]}`);
    const id = t.out.stdout.split("\n")[0]!;
    const file = /### Unit 2[\s\S]*?- Files: `([^`]+)`/.exec(full)![1]!;
    commitFiles(child, [file], 2);
    saveUnitReport({ root: t.dir, planFile: PLAN }, 2, { kind: "done", text: "ok", helper: id });
    const { io } = collect();
    const run: Runner = async () => ({ kind: "ok", stdout: '{"ok":true}' });
    expect(await unitCollect(["2", "--plan", PLAN], io, { cwd: t.dir, orca: { run, env: {} } })).toBe(0);
    expect(readFileSync(join(t.dir, PLAN), "utf8").split("### Unit 2")[1]).toContain(`- Worktree: ${child}`);
  });
});
