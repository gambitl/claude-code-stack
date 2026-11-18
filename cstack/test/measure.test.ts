import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
});
