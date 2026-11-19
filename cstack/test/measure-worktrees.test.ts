import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import type { Io } from "../src/io.js";

const FIXTURES = new URL("./fixtures/measure/worktrees/", import.meta.url).pathname;
const PLAN = readFileSync(new URL("./fixtures/plans/full.md", import.meta.url), "utf8");
const made: string[] = [];

function tmp(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.invalid",
    },
  });
}

function copyWithPaths(from: string, to: string, values: Record<string, string>): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, entry);
    if (statSync(source).isDirectory()) copyWithPaths(source, target, values);
    else {
      let text = readFileSync(source, "utf8");
      for (const [key, value] of Object.entries(values)) text = text.replaceAll(`{{${key}}}`, JSON.stringify(value).slice(1, -1));
      writeFileSync(target, text);
    }
  }
}

// A repository with a child worktree that the plan names, and two worktrees that it does not name.
function setup(): { repo: string; home: string; plan: string; child: string } {
  const repo = tmp("cstack-wt-repo-");
  const base = tmp("cstack-wt-more-");
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["commit", "-q", "--allow-empty", "-m", "start"]);
  const [child, other, sibling] = ["child", "other", "sibling"].map((name) => join(base, name));
  git(repo, ["worktree", "add", "-q", "-b", "child", child as string]);
  git(repo, ["worktree", "add", "-q", "-b", "other", other as string]);
  git(repo, ["worktree", "add", "-q", "-b", "sibling", sibling as string]);
  const home = tmp("cstack-wt-home-");
  copyWithPaths(FIXTURES, home, { REPO: repo, CHILD: child as string, OTHER: other as string, SIBLING: sibling as string });
  mkdirSync(join(repo, "docs"), { recursive: true });
  const plan = join(repo, "docs/plan.md");
  writeFileSync(
    plan,
    PLAN.replace(/^Approved at: .*$/m, "Approved at: 2026-03-01T10:00:00+00:00")
      .replace(/^Ready for review at: .*$/m, "Ready for review at: 2026-03-01T12:00:00+00:00")
      .replace(/^(### Unit 1: .*\n(?:- .*\n)+)/m, `$1- Worktree: ${child}\n`),
  );
  return { repo, home, plan, child: child as string };
}

async function measure(plan: string, home: string) {
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => void (out.stdout += t), stderr: (t) => void (out.stderr += t) };
  const code = await run(["measure", plan, "--home", home], io);
  return { out, code };
}

describe("cstack measure with child worktrees", () => {
  it("counts a session in a child worktree that the plan names, and no other worktree", async () => {
    const { home, plan } = setup();
    const { out, code } = await measure(plan, home);
    expect(out.stderr).toBe("");
    expect(out.stdout).toContain("main sessions: 3\n");
    expect(out.stdout).toContain("input tokens: 111\n");
    expect(code).toBe(0);
  });

  it("still counts the session of a child worktree that was removed", async () => {
    const { repo, home, plan, child } = setup();
    git(repo, ["worktree", "remove", "--force", child]);
    const { out, code } = await measure(plan, home);
    expect(out.stdout).toContain("main sessions: 3\n");
    expect(out.stdout).toContain("input tokens: 111\n");
    expect(code).toBe(0);
  });
});
