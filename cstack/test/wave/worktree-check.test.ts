import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WaveError } from "../../src/wave/errors.js";
import { loadWorktreeCheck } from "../../src/wave/worktrees.js";
import { git } from "../helpers/plan-repo.js";
import { fixture, makeClone, makeRunner, ticket } from "../helpers/wave.js";

const env = {};

async function checker(root: string, tracker: "jira" | "github" = "jira", orca: Record<string, string> | null = null) {
  const { run, calls } = makeRunner(orca ?? {});
  const check = await loadWorktreeCheck({ run, env, root, tracker, orca: orca !== null });
  return { check, calls };
}

describe("worktree check", () => {
  it("counts a worktree on the branch abc-12", async () => {
    const { root } = makeClone();
    const dir = join(root, "..", "wt-abc-12");
    git(root, "worktree", "add", "-b", "abc-12", dir);
    const { check } = await checker(root);
    const answer = await check.check(ticket("ABC-12"));
    expect(answer.found && answer.reason).toContain("wt-abc-12");
  });

  it("counts feature/ABC-12-login but not abc-120", async () => {
    const { root } = makeClone();
    git(root, "worktree", "add", "-b", "feature/ABC-12-login", join(root, "..", "w1"));
    git(root, "worktree", "add", "-b", "abc-120", join(root, "..", "w2"));
    const { check } = await checker(root);
    expect((await check.check(ticket("ABC-12"))).found).toBe(true);
    const other = makeClone();
    git(other.root, "worktree", "add", "-b", "abc-120", join(other.root, "..", "w2"));
    expect((await (await checker(other.root)).check.check(ticket("ABC-12"))).found).toBe(false);
  });

  it("counts a folder named abc-12 on another branch", async () => {
    const { root } = makeClone();
    git(root, "worktree", "add", "-b", "other", join(root, "..", "abc-12"));
    const { check } = await checker(root);
    expect((await check.check(ticket("ABC-12"))).found).toBe(true);
  });

  it("uses the Orca answer, and ignores an archived workspace", async () => {
    const { root } = makeClone();
    const one = await checker(root, "jira", { "reference find": fixture("reference-find.one-worktree.json") });
    const answer = await one.check.check(ticket("ABC-12"));
    expect(answer).toEqual({ found: true, reason: "/home/user/work/example-worktrees/abc-12" });
    const archived = await checker(root, "jira", { "reference find": fixture("reference-find.archived.json") });
    expect(await archived.check.check(ticket("ABC-12"))).toEqual({ found: false });
  });

  it("does not run Orca when orca is false", async () => {
    const { root } = makeClone();
    const { check, calls } = await checker(root);
    await check.check(ticket("ABC-12"));
    expect(calls.some((c) => c.command !== "git")).toBe(false);
  });

  it("throws a WaveError with exit 5 for ok: false", async () => {
    const { root } = makeClone();
    const { check } = await checker(root, "jira", { "reference find": JSON.stringify({ ok: false, error: { message: "no" } }) });
    const error = await check.check(ticket("ABC-12")).catch((e) => e);
    expect(error).toBeInstanceOf(WaveError);
    expect(error.exitCode).toBe(5);
    expect(error.message).toMatch(/^ABC-12: /);
  });

  it("reads the error that Orca writes to standard output, with the ticket key in front", async () => {
    const { root } = makeClone();
    const stdout = JSON.stringify({ ok: false, error: { message: "no such repo" } });
    const real = makeRunner({});
    const run: typeof real.run = async (c, a, cwd) =>
      c === "git" ? real.run(c, a, cwd) : { kind: "failed", exitCode: 1, stdout };
    const check = await loadWorktreeCheck({ run, env, root, tracker: "jira", orca: true });
    const error = await check.check(ticket("ABC-12")).catch((e) => e);
    expect(error).toBeInstanceOf(WaveError);
    expect(error.message).toBe("ABC-12: Orca refused `orca reference find`: no such repo.");
    expect(error.exitCode).toBe(5);
  });

  it("finds run folders", async () => {
    const { root } = makeClone();
    const runs = join(root, ".git", "cstack", "runs");
    mkdirSync(join(runs, "2026-11-19-ABC-12-some-slug"), { recursive: true });
    mkdirSync(join(runs, "2026-11-19-ABC-120-x"), { recursive: true });
    mkdirSync(join(runs, "2026-11-19-29-x"), { recursive: true });
    const jira = await checker(root);
    const found = await jira.check.check(ticket("ABC-12"));
    expect(found.found && found.reason).toContain("2026-11-19-ABC-12-some-slug");
    expect((await jira.check.check(ticket("ABC-13"))).found).toBe(false);
    const gh = await checker(root, "github");
    const hub = await gh.check.check(ticket("#29"));
    expect(hub.found && hub.reason).toContain("2026-11-19-29-x");
    expect((await gh.check.check(ticket("#2"))).found).toBe(false);
  });

  it("counts a GitHub branch feature/issue-29-x", async () => {
    const { root } = makeClone();
    git(root, "worktree", "add", "-b", "feature/issue-29-x", join(root, "..", "w"));
    const { check } = await checker(root, "github");
    expect((await check.check(ticket("#29"))).found).toBe(true);
  });
});
