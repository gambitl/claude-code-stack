import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { PHASES } from "../src/phases.js";
import { commitPlan, git, makeRepo } from "./helpers/plan-repo.js";

async function load() {
  return await import("../src/commands/audit.js");
}

const fixtures = join(import.meta.dirname, "fixtures");
const version = (JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { version: string }).version;
const USAGE = "Usage: cstack audit <plan file> [--home <folder>] [--guides <folder>]";
const MARKER = "This file is a test fixture, not a real guide.";

const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) rmSync(folders.pop()!, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  folders.push(folder);
  return folder;
}

const BLOCKS: Record<string, string[]> = {
  ticket: ["command: cstack tracker read '<key>' --tracker <name>", "command: cstack next --done ticket --plan <plan file>"],
  questions: ["helper: resolve-issue:cto-review before-plan", "command: cstack next --done questions"],
  plan: [
    "action: approval-gate",
    "command: cstack next --done plan",
    "command: cstack helper start executor --plan <plan file>",
    "command: cstack helper wait <helper id>",
  ],
  document: [
    "command: cstack tracker comment '<key>' --body-file <file> --tracker <name> | each-dependent-ticket",
    "command: cstack next --done document",
  ],
  ready: ["command: cstack tracker move '<key>' --to \"in review\" --tracker <name>", "command: cstack next --done ready"],
  retro: [
    "command: cstack next --done retro --plan <plan file>",
    "command: cstack helper start executor --plan <plan file>",
    "command: cstack helper wait <helper id>",
  ],
  publish: ["command: cstack publish --plan <plan file>", "command: cstack next --done publish"],
};

function writeGuides(folder: string, override: Record<string, string> = {}): void {
  mkdirSync(join(folder, "resolve-issue"), { recursive: true });
  for (const { name } of PHASES) {
    const file = join(folder, "resolve-issue", `${name}.md`);
    if (name === "build") {
      cpSync(join(fixtures, "steps-block", "guides", "resolve-issue", "build.md"), file);
      continue;
    }
    const steps = BLOCKS[name] ?? [`command: cstack next --done ${name}`];
    writeFileSync(file, `<!-- mandatory steps\n${steps.join("\n")}\n-->\n\n${MARKER}\n`);
  }
  for (const [name, text] of Object.entries(override)) writeFileSync(join(folder, "resolve-issue", `${name}.md`), text);
}

type Setup = { repo: string; home: string; guides: string; plan: string; pkg: string };

// A repository with the plan committed, a run state, a home folder with one session, and guides.
function setup(options: { writtenBy?: string; state?: string; session?: boolean; plan?: string } = {}): Setup {
  const repo = makeRepo();
  folders.push(repo);
  const text = options.plan ?? readFileSync(join(fixtures, "audit", "plan.md"), "utf8");
  const plan = join(repo, commitPlan(repo, text, "docs/plans/audit.md"));
  const common = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const stateFile = join(common, "cstack", "runs", "audit", "state.json");
  mkdirSync(dirname(stateFile), { recursive: true });
  const phases = { ticket: { startedAt: "2026-11-23T10:00:00+00:00", doneAt: "2026-11-23T10:05:00+00:00" } };
  writeFileSync(
    stateFile,
    options.state ??
      JSON.stringify({ format: "cstack-run/1", writtenBy: options.writtenBy ?? version, plan: "docs/plans/audit.md", phases }),
  );
  const home = tmp("audit-home-");
  if (options.session !== false) {
    const folder = join(home, ".claude", "projects", "p");
    mkdirSync(folder, { recursive: true });
    const line = {
      type: "assistant",
      cwd: repo,
      timestamp: "2026-11-23T10:01:00.000Z",
      message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "cstack next" } }] },
    };
    writeFileSync(join(folder, "s.jsonl"), `${JSON.stringify(line)}\n`);
  }
  const guides = tmp("audit-guides-");
  writeGuides(guides);
  const pkg = tmp("audit-pkg-");
  writeGuides(join(pkg, "guides"));
  return { repo, home, guides, plan, pkg };
}

async function audit(args: string[], pkg: string) {
  const { audit } = await load();
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (t) => {
      out.stdout += t;
    },
    stderr: (t) => {
      out.stderr += t;
    },
  };
  const code = await audit(args, io, { packageRoot: pkg });
  return { code, ...out };
}

function noPath(stderr: string, s: Setup): void {
  for (const path of [s.repo, s.home, s.guides, s.pkg]) expect(stderr).not.toContain(path);
}

describe("cstack audit inputs", () => {
  it("refuses an unknown flag", async () => {
    const s = setup();
    const r = await audit([s.plan, "--nope"], s.pkg);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe(`cstack audit: the command line is wrong.\n${USAGE}\n`);
  });

  it("refuses a missing plan file", async () => {
    const s = setup();
    const r = await audit(["--home", s.home], s.pkg);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe(`cstack audit: give exactly one plan file.\n${USAGE}\n`);
  });

  it("refuses two plan files", async () => {
    const s = setup();
    const r = await audit([s.plan, s.plan], s.pkg);
    expect(r.code).toBe(2);
    expect(r.stderr).toBe(`cstack audit: give exactly one plan file.\n${USAGE}\n`);
  });

  it("refuses a plan file that does not exist", async () => {
    const s = setup();
    const r = await audit([join(s.repo, "docs/plans/none.md"), "--home", s.home], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the plan file does not exist or cannot be read.\n");
    noPath(r.stderr, s);
  });

  it("refuses a plan that is not approved", async () => {
    const text = readFileSync(join(fixtures, "audit", "plan.md"), "utf8").replace(/^Approved at:.*$/m, "Approved at: not yet");
    const s = setup({ plan: text });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the plan file has no approval moment yet.\n");
    noPath(r.stderr, s);
  });

  it("refuses a plan with no run state", async () => {
    const s = setup();
    rmSync(join(git(s.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "cstack", "runs"), { recursive: true });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: this plan file has no run state, so cstack next never ran it.\n");
    noPath(r.stderr, s);
  });

  it("refuses a run state that is not valid JSON, with no path", async () => {
    const s = setup({ state: "{ not json" });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the run state of this plan file cannot be used.\n");
    noPath(r.stderr, s);
  });

  it("refuses a run state that holds no valid time", async () => {
    const state = JSON.stringify({ format: "cstack-run/1", writtenBy: version, plan: "p", phases: { ticket: { doneAt: "never" } } });
    const s = setup({ state });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the run state of this plan file cannot be used.\n");
  });

  it("refuses a run state of another version without --guides", async () => {
    const s = setup({ writtenBy: "0.0.1" });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe(
      `cstack audit: cstack 0.0.1 wrote this run, and this is cstack ${version}. Give the guides of the run with --guides <folder>.\n`,
    );
    noPath(r.stderr, s);
  });

  it("says another version of cstack when the written version has no usual shape", async () => {
    const s = setup({ writtenBy: "dev build" });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cstack audit: another version of cstack wrote this run, and this is");
  });

  it("accepts a run state of another version with --guides", async () => {
    const s = setup({ writtenBy: "0.0.1" });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
  });

  it("refuses a missing guide", async () => {
    const s = setup();
    rmSync(join(s.guides, "resolve-issue", "retro.md"));
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the guide of the phase retro is missing.\n");
    noPath(r.stderr, s);
  });

  it("refuses a guide whose block holds an unknown kind", async () => {
    const s = setup();
    writeGuides(s.guides, { ready: "<!-- mandatory steps\ncommand: cstack next --done ready\nwish: something\n-->\n" });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("the guide of the phase ready");
    expect(r.stderr).toContain("line 3");
    noPath(r.stderr, s);
  });

  it("refuses a guide with no block", async () => {
    const s = setup();
    writeGuides(s.guides, { document: "# Phase document\n\nNo block here.\n" });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the guide of the phase document has no block of mandatory steps.\n");
    noPath(r.stderr, s);
  });

  it("refuses a run with no session file", async () => {
    const s = setup({ session: false });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: no session file of this run was found.\n");
    noPath(r.stderr, s);
  });

  it("refuses a plan file that is not a valid plan", async () => {
    const s = setup({ plan: "# Plan\n\nStatus: ready for review\n\n## Ticket\n" });
    const r = await audit([s.plan, "--home", s.home], s.pkg);
    expect(r.code).toBe(3);
    expect(r.stderr).toBe("cstack audit: the plan file is not a valid cstack plan file.\n");
    noPath(r.stderr, s);
  });

  it("exits with 5 when git cannot list the worktrees", async () => {
    const s = setup();
    const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
    const fake = tmp("audit-fake-");
    const program = join(fake, "git");
    writeFileSync(program, `#!/bin/sh\nfor a in "$@"; do [ "$a" = worktree ] && exit 1; done\nexec ${realGit} "$@"\n`);
    chmodSync(program, 0o755);
    const before = process.env.PATH;
    process.env.PATH = `${fake}:${before}`;
    try {
      const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
      expect(r.code).toBe(5);
      expect(r.stderr).toBe("cstack audit: git cannot list the worktrees of the repository.\n");
      noPath(r.stderr, s);
    } finally {
      process.env.PATH = before;
    }
  });
});
