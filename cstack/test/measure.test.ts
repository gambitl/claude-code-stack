import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import type { Io } from "../src/io.js";

const FIXTURES = new URL("./fixtures/measure/", import.meta.url).pathname;
const made: string[] = [];

function tmp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function collect() {
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (text) => {
      out.stdout += text;
    },
    stderr: (text) => {
      out.stderr += text;
    },
  };
  return { out, io };
}

function git(repo: string, args: string[], date?: string): string {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  if (date) {
    env.GIT_AUTHOR_DATE = date;
    env.GIT_COMMITTER_DATE = date;
  }
  return execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
}

function makeRepo(): string {
  const repo = tmp("cstack-repo-");
  git(repo, ["init", "-q", "-b", "main"]);
  return repo;
}

function commitPlan(repo: string, status: string, date: string): void {
  mkdirSync(join(repo, "docs"), { recursive: true });
  writeFileSync(join(repo, "docs/plan.md"), `# Plan\n\nStatus: ${status}\n\n## Ticket\n`);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", `status ${status}`], date);
}

function copyScenario(name: string, home: string, repo: string): void {
  const copy = (from: string, to: string) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const source = join(from, entry.name);
      const target = join(to, entry.name);
      if (entry.isDirectory()) copy(source, target);
      else {
        const text = readFileSync(source, "utf8");
        writeFileSync(target, text.replaceAll("{{REPO}}", JSON.stringify(repo).slice(1, -1)));
      }
    }
  };
  copy(join(FIXTURES, name), home);
}

describe("cstack measure", () => {
  it("adds one main session, one helper and one nested helper", async () => {
    const repo = makeRepo();
    commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
    commitPlan(repo, "ready for review", "2026-03-01T11:35:00+00:00");
    const home = tmp("cstack-home-");
    copyScenario("basic", home, repo);
    const { out, io } = collect();
    const code = await run(["measure", join(repo, "docs/plan.md"), "--home", home], io);
    expect(out.stderr).toBe("");
    expect(out.stdout.split("\n")).toEqual([
      "main sessions: 1",
      "helper transcripts: 2",
      "input tokens: 27",
      "cache creation input tokens: 175",
      "cache read input tokens: 3400",
      "output tokens: 74",
      "input tokens claude-opus-5-5: 27",
      "cache creation input tokens claude-opus-5-5: 175",
      "cache read input tokens claude-opus-5-5: 3400",
      "output tokens claude-opus-5-5: 74",
      "minutes from approval to ready for review: 95",
      "skipped lines: 0",
      "unreadable files: 0",
      "",
    ]);
    expect(code).toBe(0);
  });

  it("counts each answer once and ignores the repeated totals", async () => {
    const repo = makeRepo();
    commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
    commitPlan(repo, "ready for review", "2026-03-01T11:35:00+00:00");
    const home = tmp("cstack-home-");
    copyScenario("traps", home, repo);
    const { out, io } = collect();
    const code = await run(["measure", join(repo, "docs/plan.md"), "--home", home], io);
    expect(out.stderr).toBe("");
    expect(out.stdout.split("\n")).toEqual([
      "main sessions: 1",
      "helper transcripts: 1",
      "input tokens: 20",
      "cache creation input tokens: 122",
      "cache read input tokens: 1203",
      "output tokens: 65",
      "input tokens claude-opus-5-5: 16",
      "cache creation input tokens claude-opus-5-5: 120",
      "cache read input tokens claude-opus-5-5: 1200",
      "output tokens claude-opus-5-5: 54",
      "input tokens claude-sonnet-5-5: 3",
      "cache creation input tokens claude-sonnet-5-5: 0",
      "cache read input tokens claude-sonnet-5-5: 0",
      "output tokens claude-sonnet-5-5: 7",
      "input tokens other model: 1",
      "cache creation input tokens other model: 2",
      "cache read input tokens other model: 3",
      "output tokens other model: 4",
      "minutes from approval to ready for review: 95",
      "skipped lines: 2",
      "unreadable files: 0",
      "",
    ]);
    expect(code).toBe(0);
  });

  describe("which sessions belong to the run", () => {
    // Writes one hand-made main session whose lines carry the given folder and times.
    function session(home: string, id: string, cwd: string, times: string[]): void {
      const dir = join(home, ".claude", "projects", "-some-folder");
      mkdirSync(dir, { recursive: true });
      const lines = times.map((timestamp, i) =>
        JSON.stringify({
          type: "assistant",
          cwd,
          timestamp,
          message: {
            id: `${id}_${i}`,
            model: "claude-opus-5-5",
            usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 },
          },
        }),
      );
      writeFileSync(join(dir, `${id}.jsonl`), `${lines.join("\n")}\n`);
    }

    async function measureWith(setup: (home: string, repo: string) => void) {
      const repo = realpathSync(makeRepo());
      commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
      commitPlan(repo, "ready for review", "2026-03-01T11:00:00+00:00");
      const home = tmp("cstack-home-");
      setup(home, repo);
      const { out, io } = collect();
      const code = await run(["measure", join(repo, "docs/plan.md"), "--home", home], io);
      return { out, code };
    }

    const inWindow = ["2026-03-01T10:10:00.000Z", "2026-03-01T10:20:00.000Z"];

    it("counts a session in a subfolder of the root, even one that is gone", async () => {
      const { out, code } = await measureWith((home, repo) => {
        session(home, "a", join(repo, "docs"), inWindow);
        session(home, "b", join(repo, "deleted", "folder"), inWindow);
      });
      expect(out.stdout).toContain("main sessions: 2\n");
      expect(code).toBe(0);
    });

    it("ignores another folder and a sibling whose name starts with the root's name", async () => {
      const { out, code } = await measureWith((home, repo) => {
        session(home, "a", tmp("cstack-other-"), inWindow);
        session(home, "b", `${repo}-other`, inWindow);
      });
      expect(out.stdout).toContain("main sessions: 0\n");
      expect(out.stdout).toContain("output tokens: 0\n");
      expect(out.stderr).toBe("cstack measure: no main session of this run was found.\n");
      expect(code).toBe(1);
    });

    it("ignores a session after the ready moment and one before the approval", async () => {
      const { out } = await measureWith((home, repo) => {
        session(home, "late", repo, ["2026-03-01T11:30:00.000Z", "2026-03-01T11:40:00.000Z"]);
        session(home, "early", repo, ["2026-03-01T08:00:00.000Z", "2026-03-01T09:59:00.000Z"]);
        session(home, "span", repo, ["2026-03-01T09:00:00.000Z", "2026-03-01T12:00:00.000Z"]);
      });
      expect(out.stdout).toContain("main sessions: 1\n");
    });

    it("prints zeros and exits with 1 when the projects folder does not exist", async () => {
      const { out, code } = await measureWith(() => {});
      expect(out.stdout).toContain("main sessions: 0\n");
      expect(out.stdout).toContain("unreadable files: 0\n");
      expect(out.stderr).toBe("cstack measure: no main session of this run was found.\n");
      expect(code).toBe(1);
    });
  });
});
