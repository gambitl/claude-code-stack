import { spawnSync } from "node:child_process";
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

/** Like Orca, a worktree rm removes the worktree folder. Only a clean worktree goes, as without --force. */
function removeWorktree(_dir: string | undefined, args: string[]): boolean {
  const target = args[args.indexOf("--worktree") + 1]!.replace(/^path:/, "");
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: target, encoding: "utf8" }).stdout.trim();
  return spawnSync("git", [`--git-dir=${common}`, "worktree", "remove", target]).status === 0;
}

function orca(_dir?: string) {
  const calls: string[] = [];
  const run: Runner = async (_command, args) => {
    calls.push(args.join(" "));
    if (args[0] === "worktree" && !removeWorktree(undefined, args)) return { kind: "failed", exitCode: 1 };
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

  it("skips a second attempt that has not reported, and releases and removes nothing", async () => {
    const { dir } = setup({ 1: "done" });
    expect((await collectAll(dir, orca().run, "1")).code).toBe(0);
    const fresh = `${dir}-child-1b`;
    made.push(fresh);
    git(dir, "worktree", "add", "-b", "child-1b", fresh, "HEAD");
    commitFiles(fresh, ["src/1.ts"], 1);
    const at = new Date(Date.now() + 5000);
    createRecord(runFolder(dir, "docs/plan.md"), {
      format: "cstack-helper/1",
      id: makeHelperId("implementer", 1, at),
      role: "implementer",
      unit: 1,
      startedAt: at.toISOString(),
      mode: "orca-worker",
      dispatchId: "ctx_1b",
      worktree: { path: fresh, branch: "child-1b" },
    });
    const head = git(dir, "rev-parse", "HEAD");
    const fake = orca();
    const result = await collectAll(dir, fake.run, "1");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("its helper has not reported");
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
    expect(fake.calls).toEqual([]);
  });

  it("keeps the child worktree of a second attempt whose new commit was refused", async () => {
    const { dir } = setup({ 1: "done" });
    expect((await collectAll(dir, orca().run, "1")).code).toBe(0);
    const fresh = `${dir}-child-1c`;
    made.push(fresh);
    git(dir, "worktree", "add", "-b", "child-1c", fresh, "HEAD");
    commitFiles(fresh, ["src/2.ts"], 1);
    const at = new Date(Date.now() + 5000);
    const id = makeHelperId("implementer", 1, at);
    createRecord(runFolder(dir, "docs/plan.md"), {
      format: "cstack-helper/1",
      id,
      role: "implementer",
      unit: 1,
      startedAt: at.toISOString(),
      mode: "orca-worker",
      dispatchId: "ctx_1c",
      worktree: { path: fresh, branch: "child-1c" },
    });
    saveUnitReport({ root: dir, planFile: "docs/plan.md" }, 1, { kind: "done", text: "ok", helper: id });
    const head = git(dir, "rev-parse", "HEAD");
    const fake = orca();
    const result = await collectAll(dir, fake.run, "1");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("nothing was applied");
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
    expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
    expect(readRecord(runFolder(dir, "docs/plan.md"), id).collectedAt).toBeUndefined();
  });

  describe("a child worktree whose folder is gone", () => {
    /** A first collect applies the commits, but Orca fails to remove the worktree, so the worktree stays. */
    async function keptAfterFirstCollect() {
      const made = setup({ 1: "done" });
      const failing: Runner = async (_c, args) => (args[0] === "worktree" ? { kind: "failed", exitCode: 1 } : { kind: "ok", stdout: '{"ok":true}' });
      expect((await collectAll(made.dir, failing, "1")).code).toBe(5);
      return made;
    }
    const listed = (dir: string) => git(dir, "worktree", "list", "--porcelain");

    it("counts the worktree as removed when its folder was deleted by hand, and drops the entry of git", async () => {
      const { dir, children, ids } = await keptAfterFirstCollect();
      rmSync(children[1]!, { recursive: true, force: true });
      expect(listed(dir)).toContain(children[1]!);
      const head = git(dir, "rev-parse", "HEAD");
      const fake = orca();
      const result = await collectAll(dir, fake.run, "1");
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("no longer exists");
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
      expect(listed(dir)).not.toContain(children[1]!);
      expect(git(dir, "rev-parse", "HEAD")).toBe(head);
      const record = readRecord(runFolder(dir, "docs/plan.md"), ids[1]!);
      expect(record.released).toBe(true);
      expect(record.collectedAt).toBe("2026-11-19T10:00:00.000Z");
    });

    it("counts the worktree as removed when it was removed with git", async () => {
      const { dir, children, ids } = await keptAfterFirstCollect();
      git(dir, "worktree", "remove", "--force", children[1]!);
      const fake = orca();
      const result = await collectAll(dir, fake.run, "1");
      expect(result.code).toBe(0);
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
      const record = readRecord(runFolder(dir, "docs/plan.md"), ids[1]!);
      expect(record.released).toBe(true);
      expect(record.collectedAt).toBe("2026-11-19T10:00:00.000Z");
    });

    it("keeps a folder that exists but is not a worktree of this repository", async () => {
      const { dir, children, ids } = await keptAfterFirstCollect();
      git(dir, "worktree", "remove", "--force", children[1]!);
      mkdirSync(children[1]!, { recursive: true });
      writeFileSync(join(children[1]!, "other.txt"), "x");
      const fake = orca();
      const result = await collectAll(dir, fake.run, "1");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("not a git worktree of this repository");
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
      expect(readFileSync(join(children[1]!, "other.txt"), "utf8")).toBe("x");
      const record = readRecord(runFolder(dir, "docs/plan.md"), ids[1]!);
      expect(record.released).toBe(true);
      expect(record.collectedAt).toBeUndefined();
    });
  });

  describe("a child branch that is gone", () => {
    const failingRm: Runner = async (_c, args) => (args[0] === "worktree" ? { kind: "failed", exitCode: 1 } : { kind: "ok", stdout: '{"ok":true}' });

    it("accepts a gone branch after the first collect applied its commits", async () => {
      const { dir, children, ids } = setup({ 1: "done" });
      writeFileSync(join(children[1]!, "left.txt"), "x");
      expect((await collectAll(dir, orca().run, "1")).code).toBe(1);
      const folder = runFolder(dir, "docs/plan.md");
      expect(readRecord(folder, ids[1]!).appliedAt).toBe("2026-11-19T10:00:00.000Z");
      git(dir, "worktree", "remove", "--force", children[1]!);
      git(dir, "branch", "-D", "child-1");
      const head = git(dir, "rev-parse", "HEAD");
      const fake = orca();
      const result = await collectAll(dir, fake.run, "1");
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('the branch "child-1" no longer exists');
      expect(git(dir, "rev-parse", "HEAD")).toBe(head);
      expect(readRecord(folder, ids[1]!).collectedAt).toBe("2026-11-19T10:00:00.000Z");
    });

    it("refuses a gone branch of a second attempt that was never applied", async () => {
      const { dir } = setup({ 1: "done" });
      expect((await collectAll(dir, orca().run, "1")).code).toBe(0);
      const fresh = `${dir}-child-1d`;
      made.push(fresh);
      git(dir, "worktree", "add", "-b", "child-1d", fresh, "HEAD");
      commitFiles(fresh, ["src/1.ts"], 1);
      const at = new Date(Date.now() + 5000);
      const id = makeHelperId("implementer", 1, at);
      createRecord(runFolder(dir, "docs/plan.md"), {
        format: "cstack-helper/1",
        id,
        role: "implementer",
        unit: 1,
        startedAt: at.toISOString(),
        mode: "orca-worker",
        dispatchId: "ctx_1d",
        worktree: { path: fresh, branch: "child-1d" },
      });
      saveUnitReport({ root: dir, planFile: "docs/plan.md" }, 1, { kind: "done", text: "ok", helper: id });
      git(dir, "worktree", "remove", "--force", fresh);
      git(dir, "branch", "-D", "child-1d");
      const head = git(dir, "rev-parse", "HEAD");
      const result = await collectAll(dir, orca().run, "1");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("no record that its commits were applied");
      expect(git(dir, "rev-parse", "HEAD")).toBe(head);
      expect(readRecord(runFolder(dir, "docs/plan.md"), id).collectedAt).toBeUndefined();
    });

    it("writes appliedAt too when the collect runs without Orca", () => {
      const { dir, ids } = setup({ 1: "done" });
      const { io } = collect();
      expect(unitCollect(["1", "--plan", "docs/plan.md"], io, { cwd: dir })).toBe(0);
      expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).appliedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("keeps working with a failing Orca: the record has appliedAt before the clean-up", async () => {
      const { dir, ids } = setup({ 1: "done" });
      expect((await collectAll(dir, failingRm, "1")).code).toBe(5);
      expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).appliedAt).toBeDefined();
    });
  });

  it("removes a child worktree whose copy of the plan file holds uncommitted changes, as after a second attempt", async () => {
    const { dir, children, ids } = setup({ 1: "done" });
    // The second attempt copies the current plan file into the child, so the child holds an uncommitted plan file.
    writeFileSync(join(children[1]!, "docs/plan.md"), `${readFileSync(join(dir, "docs/plan.md"), "utf8")}\nA note.\n`);
    // Like Orca without --force, the fake refuses to remove a worktree that is not clean.
    const calls: string[] = [];
    const run: Runner = async (_c, args) => {
      calls.push(args.join(" "));
      if (args[0] === "worktree" && !removeWorktree(undefined, args)) return { kind: "failed", exitCode: 1 };
      return { kind: "ok", stdout: '{"ok":true}' };
    };
    const result = await collectAll(dir, run, "1");
    expect(result.code).toBe(0);
    expect(calls.some((c) => c.startsWith("worktree rm"))).toBe(true);
    expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).collectedAt).toBe("2026-11-19T10:00:00.000Z");
  });

  describe("the child branch", () => {
    const branchTip = (dir: string, name: string) => spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], { cwd: dir, encoding: "utf8" }).stdout.trim();

    it("deletes the child branch after a clean collect and names its old tip", async () => {
      const { dir, children } = setup({ 1: "done" });
      const tip = git(children[1]!, "rev-parse", "HEAD");
      const result = await collectAll(dir, orca(dir).run, "1");
      expect(result.code).toBe(0);
      expect(branchTip(dir, "child-1")).toBe("");
      expect(result.stdout).toContain("its branch child-1 was deleted");
      expect(result.stdout).toContain(tip.slice(0, 7));
    });

    it("deletes the branch on a second collect after the folder was deleted by hand", async () => {
      const { dir, children } = setup({ 1: "done" });
      writeFileSync(join(children[1]!, "left.txt"), "x");
      expect((await collectAll(dir, orca(dir).run, "1")).code).toBe(1);
      rmSync(children[1]!, { recursive: true, force: true });
      const result = await collectAll(dir, orca(dir).run, "1");
      expect(result.code).toBe(0);
      expect(branchTip(dir, "child-1")).toBe("");
      expect(result.stdout).toContain("child-1 was deleted");
    });

    it("accepts a branch that Orca already deleted together with the worktree", async () => {
      const { dir, children, ids } = setup({ 1: "done" });
      const run: Runner = async (_c, args) => {
        if (args[0] === "worktree") {
          removeWorktree(dir, args);
          git(dir, "branch", "-D", "child-1");
        }
        return { kind: "ok", stdout: '{"ok":true}' };
      };
      const result = await collectAll(dir, run, "1");
      expect(result.code).toBe(0);
      expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).collectedAt).toBe("2026-11-19T10:00:00.000Z");
    });

    it("keeps the branch when it holds a change that the ticket branch lacks", async () => {
      const { dir, children } = setup({ 1: "done" });
      const run: Runner = async (_c, args) => {
        if (args[0] === "worktree") {
          commitFiles(children[1]!, ["src/extra.ts"], 9);
          removeWorktree(dir, args);
        }
        return { kind: "ok", stdout: '{"ok":true}' };
      };
      const result = await collectAll(dir, run, "1");
      expect(result.code).toBe(0);
      expect(branchTip(dir, "child-1")).not.toBe("");
      expect(result.stdout).toContain("holds a change that the ticket branch lacks");
    });
  });

  describe("--discard-untracked", () => {
    const branchGone = (dir: string, name: string) =>
      spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`], { cwd: dir }).status !== 0;

    it("removes a child worktree whose only change is an untracked file, and names the file", async () => {
      const { dir, children, ids } = setup({ 1: "done" });
      writeFileSync(join(children[1]!, "package-lock.json"), "{}");
      const fake = orca(dir);
      const result = await collectAll(dir, fake.run, "1", "--discard-untracked");
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("package-lock.json");
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(true);
      expect(readRecord(runFolder(dir, "docs/plan.md"), ids[1]!).collectedAt).toBe("2026-11-19T10:00:00.000Z");
      expect(branchGone(dir, "child-1")).toBe(true);
    });

    it("keeps a child worktree with a changed tracked file, even with the option", async () => {
      const { dir, children } = setup({ 1: "done" });
      writeFileSync(join(children[1]!, "src/1.ts"), "changed\n");
      writeFileSync(join(children[1]!, "left.txt"), "x");
      const fake = orca(dir);
      const result = await collectAll(dir, fake.run, "1", "--discard-untracked");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("src/1.ts");
      expect(result.stderr).toContain("cannot remove it");
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
      expect(readFileSync(join(children[1]!, "left.txt"), "utf8")).toBe("x");
    });

    it("names the untracked file and the exact command when the option is missing", async () => {
      const { dir, children } = setup({ 1: "done" });
      writeFileSync(join(children[1]!, "left.txt"), "x");
      const result = await collectAll(dir, orca(dir).run, "1");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("left.txt");
      expect(result.stderr).toContain("cstack unit collect 1 --discard-untracked --plan docs/plan.md");
    });

    it("keeps the worktree when an untracked file is one of the Files of the unit", async () => {
      const { dir, children } = setup({ 1: "done" });
      writeFileSync(join(dir, "docs/plan.md"), readFileSync(join(dir, "docs/plan.md"), "utf8").replace("- Files: `src/1.ts`", "- Files: `src/1.ts`, `extra.txt`"));
      git(dir, "add", "docs/plan.md");
      git(dir, "commit", "-m", "docs: more files");
      writeFileSync(join(children[1]!, "Extra.txt"), "forgotten");
      const fake = orca(dir);
      const result = await collectAll(dir, fake.run, "1", "--discard-untracked");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Extra.txt");
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
      expect(readFileSync(join(children[1]!, "Extra.txt"), "utf8")).toBe("forgotten");
    });

    it("keeps the worktree when git lists a whole folder, such as a nested repository", async () => {
      const { dir, children } = setup({ 1: "done" });
      mkdirSync(join(children[1]!, "nested"));
      git(join(children[1]!, "nested"), "init", "-q");
      writeFileSync(join(children[1]!, "left.txt"), "x");
      const fake = orca(dir);
      const result = await collectAll(dir, fake.run, "1", "--discard-untracked");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("nested/");
      expect(fake.calls.some((c) => c.startsWith("worktree rm"))).toBe(false);
      expect(readFileSync(join(children[1]!, "left.txt"), "utf8")).toBe("x");
    });
  });
});
