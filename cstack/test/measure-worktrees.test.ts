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

  it("adds nothing for a worktree nested inside the repository that the plan does not name", async () => {
    const { repo, home, plan } = setup();
    const nested = join(repo, "nested-worktree");
    git(repo, ["worktree", "add", "-q", "-b", "nested", nested]);
    const folder = join(home, ".claude/projects/-nested");
    mkdirSync(folder, { recursive: true });
    const line = (extra: object) => JSON.stringify({ cwd: nested, timestamp: "2026-03-01T10:30:00.000Z", ...extra });
    writeFileSync(
      join(folder, "nested.jsonl"),
      [
        line({ type: "user", message: { role: "user", content: "Synthetic question." } }),
        line({
          type: "assistant",
          message: { id: "msg_nested", model: "claude-opus-5-5", usage: { input_tokens: 100000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 }, content: [{ type: "text", text: "Synthetic answer." }] },
        }),
      ].join("\n") + "\n",
    );
    const { out, code } = await measure(plan, home);
    expect(out.stdout).toContain("main sessions: 3\n");
    expect(out.stdout).toContain("input tokens: 111\n");
    expect(code).toBe(0);
  });

  it("prints no path, and counts the executor session once", async () => {
    const { repo, home, plan, child } = setup();
    const { out } = await measure(plan, home);
    expect(out.stdout.match(/main sessions: \d+/g)).toHaveLength(1);
    for (const path of [repo, home, child, tmpdir()]) {
      expect(out.stdout).not.toContain(path);
      expect(out.stderr).not.toContain(path);
    }
  });

  it("exits with 1 and a fixed sentence without a path when git cannot list the worktrees", async () => {
    const { repo, home, plan } = setup();
    const bin = tmp("cstack-wt-bin-");
    const real = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
    const stub = join(bin, "git");
    writeFileSync(stub, `#!/bin/sh\nif [ "$1" = "worktree" ]; then echo "fatal: ${repo}" >&2; exit 128; fi\nexec "${real}" "$@"\n`, { mode: 0o755 });
    const saved = process.env.PATH;
    process.env.PATH = `${bin}:${saved}`;
    try {
      const { out, code } = await measure(plan, home);
      expect(code).toBe(1);
      expect(out.stdout).toBe("");
      expect(out.stderr).toBe("cstack measure: git cannot list the worktrees of the repository.\n");
      for (const path of [repo, home, bin]) expect(out.stderr).not.toContain(path);
    } finally {
      process.env.PATH = saved;
    }
  });
});
