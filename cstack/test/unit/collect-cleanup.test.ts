import { readFileSync, realpathSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { unitCollect } from "../../src/commands/unit-collect.js";
import { createRecord, makeHelperId, readRecord } from "../../src/helper/record.js";
import type { Runner } from "../../src/orca/run.js";
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
  const body = [1, 2]
    .map(
      (n) =>
        `### Unit ${n}: Thing ${n}\n- Files: \`src/${n}.ts\`\n- No test: prose only.\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`feat(cli): add ${n}\`\n- Depends on: none\n`,
    )
    .join("\n");
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

/** A ticket worktree with one child worktree per unit, a helper record with a dispatch id, and a report. */
function setup(kinds: Record<number, "done" | "stuck">) {
  const dir = realpathSync(makeRepo());
  made.push(dir);
  git(dir, "switch", "-c", "gambitl/units");
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs/plan.md"), planText());
  git(dir, "add", "docs/plan.md");
  git(dir, "commit", "-m", "docs: plan");
  const children: Record<number, string> = {};
  const ids: Record<number, string> = {};
  for (const [key, kind] of Object.entries(kinds)) {
    const n = Number(key);
    children[n] = `${dir}-child-${n}`;
    made.push(children[n]!);
    git(dir, "worktree", "add", "-b", `child-${n}`, children[n]!, "HEAD");
    commitFiles(children[n]!, [`src/${n}.ts`], n);
    ids[n] = makeHelperId("implementer", n);
    createRecord(runFolder(dir, "docs/plan.md"), {
      format: "cstack-helper/1",
      id: ids[n]!,
      role: "implementer",
      unit: n,
      startedAt: new Date().toISOString(),
      mode: "orca-worker",
      dispatchId: `ctx_${n}`,
      worktree: { path: children[n]!, branch: `child-${n}` },
    });
    saveUnitReport({ root: dir, planFile: "docs/plan.md" }, n, { kind, text: "ok", helper: ids[n]! });
  }
  return { dir, children, ids };
}

function orca() {
  const calls: string[] = [];
  const run: Runner = async (_command, args) => {
    calls.push(args.join(" "));
    return { kind: "ok", stdout: '{"ok":true}' };
  };
  return { calls, run };
}

const collectAll = async (dir: string, run: Runner, ...units: string[]) => {
  const { out, io } = collect();
  const code = await unitCollect([...units, "--plan", "docs/plan.md"], io, { cwd: dir, orca: { run, env: {}, now: () => new Date("2026-11-19T10:00:00Z") } });
  return { code, ...out };
};

describe("cstack unit collect, clean-up", () => {
  it("releases the worker, removes the clean child worktree and records it", async () => {
    const { dir, children, ids } = setup({ 1: "done" });
    const fake = orca();
    const result = await collectAll(dir, fake.run, "1");
    expect(result.code).toBe(0);
    expect(fake.calls).toEqual([
      "orchestration worker-release --dispatch ctx_1 --json",
      `worktree rm --worktree path:${children[1]} --json`,
    ]);
    const record = readRecord(runFolder(dir, "docs/plan.md"), ids[1]!);
    expect(record.released).toBe(true);
    expect(record.collectedAt).toBe("2026-11-19T10:00:00.000Z");
  });

  it("keeps a child worktree with an uncommitted file and exits with 1", async () => {
    const { dir, children, ids } = setup({ 1: "done" });
    writeFileSync(join(children[1]!, "left.txt"), "x");
    const fake = orca();
    const result = await collectAll(dir, fake.run, "1");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("left.txt");
    expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
    expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).collectedAt).toBeUndefined();
  });

  it("releases the worker of a stuck unit and keeps its worktree", async () => {
    const { dir, ids } = setup({ 1: "stuck", 2: "done" });
    const fake = orca();
    const result = await collectAll(dir, fake.run, "1", "2");
    expect(result.code).toBe(0);
    expect(fake.calls).toContain("orchestration worker-release --dispatch ctx_1 --json");
    expect(fake.calls.filter((c) => c.startsWith("worktree rm")).length).toBe(1);
    const record = readRecord(runFolder(dir, "docs/plan.md"), ids[1]!);
    expect(record.released).toBe(true);
    expect(record.collectedAt).toBeUndefined();
  });

  it("finishes the clean-up on a second run without applying anything again", async () => {
    const { dir } = setup({ 1: "done" });
    const failing: Runner = async (_c, args) => (args[0] === "worktree" ? { kind: "failed", exitCode: 1 } : { kind: "ok", stdout: '{"ok":true}' });
    const first = await collectAll(dir, failing, "1");
    expect(first.code).toBe(5);
    const head = git(dir, "rev-parse", "HEAD");
    const fake = orca();
    const second = await collectAll(dir, fake.run, "1");
    expect(second.code).toBe(0);
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
    expect(fake.calls.map((c) => c.split(" ")[1])).toEqual(["rm"]);
  });

  it("removes a child worktree whose copy of the plan file holds uncommitted changes, as after a second attempt", async () => {
    const { dir, children, ids } = setup({ 1: "done" });
    // The second attempt copies the current plan file into the child, so the child holds an uncommitted plan file.
    writeFileSync(join(children[1]!, "docs/plan.md"), `${readFileSync(join(dir, "docs/plan.md"), "utf8")}\nA note.\n`);
    // Like Orca without --force, the fake refuses to remove a worktree that is not clean.
    const calls: string[] = [];
    const run: Runner = async (_c, args) => {
      calls.push(args.join(" "));
      if (args[0] === "worktree" && git(children[1]!, "status", "--porcelain") !== "") return { kind: "failed", exitCode: 1 };
      return { kind: "ok", stdout: '{"ok":true}' };
    };
    const result = await collectAll(dir, run, "1");
    expect(result.code).toBe(0);
    expect(calls.some((c) => c.startsWith("worktree rm"))).toBe(true);
    expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).collectedAt).toBe("2026-11-19T10:00:00.000Z");
  });
});
