import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { localTime } from "../src/local-time.js";
import { PHASES } from "../src/phases.js";
import { commitFiles, commitPlan, git, makeRepo } from "./helpers/plan-repo.js";

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

const PLANNING = ["ticket", "dependencies", "code-map", "questions", "plan"];
const at = (minutes: number, seconds = 0): string => new Date(Date.UTC(2026, 10, 23, 10, 0, 0) + (minutes * 60 + seconds) * 1000).toISOString();

// A full run: phase i closes at minute i+1, and a phase that is not a planning phase starts 30 seconds before.
function fullPhases(): Record<string, { startedAt?: string; doneAt: string }> {
  const phases: Record<string, { startedAt?: string; doneAt: string }> = {};
  PHASES.forEach(({ name }, i) => {
    phases[name] = PLANNING.includes(name) ? { doneAt: at(i + 1) } : { startedAt: at(i + 1, -30), doneAt: at(i + 1) };
  });
  return phases;
}
type Call = { time: string; command: string };
// The lines of the block of a guide, as the test guides write them.
function blockOf(name: string): string[] {
  if (name !== "build") return BLOCKS[name] ?? [`command: cstack next --done ${name}`];
  const text = readFileSync(join(fixtures, "steps-block", "guides", "resolve-issue", "build.md"), "utf8");
  return text.split("\n").slice(1, text.split("\n").indexOf("-->"));
}
const UNITS = [1, 2, 3];
const WITH_TEST = [1, 2];
// The command steps that the audit lists, with `<n>` replaced by a unit number in the order of the plan, and the other placeholders by a sample word.
function stepTexts(name: string): { text: string; unit?: number }[] {
  const listed = blockOf(name)
    .filter((line) => line.startsWith("command: "))
    .map((line) => {
      const [text, condition] = line.slice("command: ".length).split(" | ");
      return { text: text!, condition };
    })
    .filter((step) => step.condition === undefined || step.condition.startsWith("each-unit"));
  const out: { text: string; unit?: number }[] = [];
  let group: typeof listed = [];
  const flush = () => {
    for (const unit of UNITS) {
      for (const step of group) {
        if (step.condition === "each-unit-with-test" && !WITH_TEST.includes(unit)) continue;
        out.push({ text: step.text.replace(/<n>/g, String(unit)), unit });
      }
    }
    group = [];
  };
  for (const step of listed) {
    if (step.condition === undefined) {
      flush();
      out.push({ text: step.text });
    } else group.push(step);
  }
  flush();
  return out;
}
// One call for every step, with the phase it belongs to: the calls of a phase come in the last minute before its close, and the ones after `cstack next --done` just after it.
function taggedCalls(): (Call & { phase: string })[] {
  const calls: (Call & { phase: string })[] = [];
  PHASES.forEach(({ name }, i) => {
    let after = false;
    stepTexts(name).forEach((step, k) => {
      const done = step.text.startsWith("cstack next --done");
      if (done) after = true;
      calls.push({
        phase: name,
        time: done ? at(i + 1) : after ? at(i + 1, 5 + k * 2) : at(i, 5 + k * 2),
        command: step.text.replace(/<plan file>/g, "docs/plans/audit.md").replace(/<[^<>]+>/g, "x"),
      });
    });
  });
  return calls;
}
function fullCalls(): Call[] {
  return taggedCalls().map(({ time, command }) => ({ time, command }));
}
const buildAt = PHASES.findIndex((p) => p.name === "build");
const retroAt = PHASES.findIndex((p) => p.name === "retro");
const without = (calls: Call[], text: string): Call[] => calls.filter((c) => c.command !== text);

type Setup = { repo: string; home: string; guides: string; plan: string; pkg: string };

// A repository with the plan committed, a run state, a home folder with one session, and guides.
function setup(options: {
  writtenBy?: string;
  state?: string;
  session?: boolean;
  plan?: string;
  phases?: Record<string, { startedAt?: string; doneAt?: string }>;
  calls?: Call[];
  extraFile?: string;
  // More session files of the project folder, for example a helper transcript under `s/subagents/`.
  files?: { file: string; calls: Call[]; sidechain?: boolean }[];
} = {}): Setup {
  const repo = makeRepo();
  folders.push(repo);
  const text = options.plan ?? readFileSync(join(fixtures, "audit", "plan.md"), "utf8");
  const plan = join(repo, commitPlan(repo, text, "docs/plans/audit.md"));
  const common = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const stateFile = join(common, "cstack", "runs", "audit", "state.json");
  mkdirSync(dirname(stateFile), { recursive: true });
  const phases = options.phases ?? fullPhases();
  writeFileSync(
    stateFile,
    options.state ??
      JSON.stringify({ format: "cstack-run/1", writtenBy: options.writtenBy ?? version, plan: "docs/plans/audit.md", phases }),
  );
  const home = tmp("audit-home-");
  if (options.session !== false) {
    const folder = join(home, ".claude", "projects", "p");
    mkdirSync(folder, { recursive: true });
    const lines = (options.calls ?? fullCalls()).map((call, i) => ({
      type: "assistant",
      cwd: repo,
      timestamp: call.time,
      message: { content: [{ type: "tool_use", id: `t${i}`, name: "Bash", input: { command: call.command } }] },
    }));
    writeFileSync(join(folder, "s.jsonl"), lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
    if (options.extraFile !== undefined) writeFileSync(join(folder, "bad.jsonl"), options.extraFile);
    for (const extra of options.files ?? []) {
      mkdirSync(dirname(join(folder, extra.file)), { recursive: true });
      const text = extra.calls.map((call, i) => ({
        type: "assistant",
        cwd: repo,
        ...(extra.sidechain ? { isSidechain: true } : {}),
        timestamp: call.time,
        message: { content: [{ type: "tool_use", id: `${extra.file}#${i}`, name: "Bash", input: { command: call.command } }] },
      }));
      writeFileSync(join(folder, extra.file), text.map((l) => `${JSON.stringify(l)}\n`).join(""));
    }
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

  it("prints every start line and every phase line as done for a full run", async () => {
    const s = setup();
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    const expected: string[] = [];
    PHASES.forEach(({ name }, i) => {
      const planning = PLANNING.includes(name);
      if (!planning) expected.push(`phase ${name} started: done ${localTime(new Date(at(i + 1, -30)))} run state`);
      expected.push(`phase ${name}: done ${localTime(new Date(at(i + 1)))} ${planning ? "session" : "run state"}`);
    });
    expect(expected).toHaveLength(25);
    expect(r.stdout.split("\n").filter((l) => l.startsWith("phase "))).toEqual(expected);
  });

  it("prints a planning phase as skipped when no session shows its close", async () => {
    const s = setup({ calls: fullCalls().filter((c) => !c.command.includes("code-map")) });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("phase code-map: skipped\n");
    expect(r.stdout).toContain("phase questions: done ");
  });

  it("prints a planning phase as out of order when its call comes before the call of the phase before it", async () => {
    const calls = fullCalls().map((c) => (c.command.includes("dependencies") ? { ...c, time: at(7) } : c));
    const s = setup({ calls });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`phase code-map: out of order ${localTime(new Date(at(3)))} session\n`);
  });

  it("prints a start as skipped when the run state has no startedAt", async () => {
    const phases = fullPhases();
    delete phases.review!.startedAt;
    const s = setup({ phases });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("phase review started: skipped\n");
    expect(r.stdout).toContain("phase review: done ");
  });

  it("prints retro as skipped when it was done before ready", async () => {
    const phases = fullPhases();
    phases.retro!.doneAt = at(1);
    const s = setup({ phases });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("phase retro: skipped\n");
  });

  it("prints a phase done before the phase before it as out of order", async () => {
    const phases = fullPhases();
    phases.briefing!.doneAt = at(1);
    const s = setup({ phases });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`phase briefing: out of order ${localTime(new Date(at(1)))} run state\n`);
  });

  it("prints a phase as skipped when the run state says it is done but no call shows it", async () => {
    const s = setup({ calls: [{ time: at(1), command: "cstack next --done ticket" }] });
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("phase dependencies: skipped\n");
  });

  it("still prints every line when a session file cannot be read, with a fixed sentence and no path", async () => {
    const s = setup();
    const folder = join(s.home, ".claude", "projects", "p");
    mkdirSync(join(folder, "dir.jsonl"));
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.code).toBe(1);
    expect(r.stderr).toBe("cstack audit: some session files could not be read, so some steps may show as skipped.\n");
    noPath(r.stderr, s);
    expect(r.stdout.split("\n").filter((l) => l.startsWith("phase "))).toHaveLength(25);
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

describe("cstack audit command steps", () => {
  const run = async (s: Setup) => await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
  const stepLines = (stdout: string) => stdout.split("\n").filter((l) => l !== "" && !l.startsWith("phase "));

  it("prints every command line as done for a full run", async () => {
    const s = setup();
    const r = await run(s);
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    const lines = stepLines(r.stdout);
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.every((l) => / done \d{4}-\d\d-\d\dT[^ ]+ session$|: done /.test(l))).toBe(true);
    expect(lines.some((l) => l.startsWith("build: cstack unit red 2: done "))).toBe(true);
    expect(lines.some((l) => l.startsWith("ticket: cstack tracker read '<key>' --tracker <name>: done "))).toBe(true);
  });

  it("prints a step with no call as skipped", async () => {
    const s = setup({ calls: without(fullCalls(), "cstack unit red 2") });
    const r = await run(s);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("build: cstack unit red 2: skipped\n");
    expect(r.stdout).toContain("build: cstack unit red 1: done ");
  });

  it("prints a planning step with no call as skipped", async () => {
    const s = setup({ calls: fullCalls().filter((c) => !c.command.startsWith("cstack tracker read")) });
    const r = await run(s);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("ticket: cstack tracker read '<key>' --tracker <name>: skipped\n");
  });

  it("prints a step out of order when green comes before red", async () => {
    const calls = fullCalls().map((c) => (c.command === "cstack unit green 2" ? { ...c, time: at(buildAt, 1) } : c));
    const s = setup({ calls });
    const r = await run(s);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain(`build: cstack unit green 2: out of order ${localTime(new Date(at(buildAt, 1)))} session\n`);
  });

  it("gives unit 3, which has no test, a commit line and no red or green line", async () => {
    const s = setup();
    const r = await run(s);
    expect(r.stdout).toContain("build: cstack unit commit 3: done ");
    expect(r.stdout).not.toContain("cstack unit red 3");
    expect(r.stdout).not.toContain("cstack unit green 3");
  });

  it("does not print helper steps, action steps or steps with another condition", async () => {
    const s = setup();
    const r = await run(s);
    expect(r.stdout).toContain("build: cstack unit order --plan <plan file>: done ");
    expect(r.stdout).not.toContain("implementer");
    expect(r.stdout).not.toContain("approval-gate");
    expect(r.stdout).not.toContain("break-the-rule");
    expect(r.stdout).not.toContain("tracker comment");
  });

  it("counts the second cstack helper start executor for the retro phase", async () => {
    const calls = fullCalls().filter((c) => !(c.command.startsWith("cstack helper start executor") && new Date(c.time) > new Date(at(retroAt))));
    const s = setup({ calls });
    const r = await run(s);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("plan: cstack helper start executor --plan <plan file>: done ");
    expect(r.stdout).toContain("retro: cstack helper start executor --plan <plan file>: skipped\n");
  });

  it("takes the second cstack next --done build, the one after the unit steps", async () => {
    const calls = [...fullCalls(), { time: at(buildAt, 1), command: "cstack next --done build" }];
    const s = setup({ calls });
    const r = await run(s);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(`build: cstack next --done build --plan <plan file>: done ${localTime(new Date(at(buildAt + 1)))} session\n`);
    const early = [...without(fullCalls(), "cstack next --done build --plan docs/plans/audit.md"), { time: at(buildAt, 1), command: "cstack next --done build" }];
    const only = setup({ calls: early.filter((c) => c.command !== "cstack next --done build --plan docs/plans/audit.md") });
    const r2 = await run(only);
    expect(r2.stdout).toContain(`build: cstack next --done build --plan <plan file>: out of order ${localTime(new Date(at(buildAt, 1)))} session\n`);
  });

  it("counts a helper wait that comes after the closes of the phases that the executor runs", async () => {
    const readyAt = PHASES.findIndex((p) => p.name === "ready");
    const publishAt = PHASES.findIndex((p) => p.name === "publish");
    const planAt = PHASES.findIndex((p) => p.name === "plan");
    const calls = fullCalls().map((c) => {
      if (c.command !== "cstack helper wait x") return c;
      return { ...c, time: new Date(c.time) < new Date(at(planAt + 2)) ? at(readyAt + 1, 5) : at(publishAt + 1, 5) };
    });
    const s = setup({ calls });
    const r = await run(s);
    expect(r.stderr).toBe("");
    expect(r.stdout).toContain(`plan: cstack helper wait <helper id>: done ${localTime(new Date(at(readyAt + 1, 5)))} session\n`);
    expect(r.stdout).toContain(`retro: cstack helper wait <helper id>: done ${localTime(new Date(at(publishAt + 1, 5)))} session\n`);
    expect(r.code).toBe(0);
  });

  it("uses the saved failing run of a unit when no call shows it", async () => {
    const s = setup({ calls: without(fullCalls(), "cstack unit red 1") });
    const common = git(s.repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
    const folder = join(common, "cstack", "runs", "audit", "units", "1");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "red.json"), JSON.stringify({ time: at(buildAt, 11) }));
    const r = await run(s);
    expect(r.stdout).toContain(`build: cstack unit red 1: done ${localTime(new Date(at(buildAt, 11)))} run state\n`);
  });

  it("uses a commit with the Cstack-Unit trailer when no call shows it", async () => {
    const s = setup({ calls: without(fullCalls(), "cstack unit commit 1") });
    git(s.repo, "checkout", "-b", "feature");
    process.env.GIT_AUTHOR_DATE = at(buildAt, 40);
    try {
      commitFiles(s.repo, ["a.txt"], 1);
    } finally {
      delete process.env.GIT_AUTHOR_DATE;
    }
    const r = await run(s);
    expect(r.stdout).toContain(`build: cstack unit commit 1: done ${localTime(new Date(at(buildAt, 40)))} git\n`);
  });
});

describe("cstack audit steps of the main conversation", () => {
  const run = async (s: Setup) => await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
  const readyAt = PHASES.findIndex((p) => p.name === "ready");
  const publishAt = PHASES.findIndex((p) => p.name === "publish");
  const planAt = PHASES.findIndex((p) => p.name === "plan");
  const WAIT = "cstack helper wait x";
  const wait = (time: string): Call => ({ time, command: WAIT });
  const planWait = (time: string) => `plan: cstack helper wait <helper id>: done ${localTime(new Date(time))} session\n`;
  const retroWait = (time: string) => `retro: cstack helper wait <helper id>: done ${localTime(new Date(time))} session\n`;
  // The calls of the main conversation, with its two waits after the close of ready and after the close of publish.
  const mainCalls = (): Call[] => {
    let seen = 0;
    return fullCalls().map((c) => (c.command === WAIT ? wait(seen++ === 0 ? at(readyAt + 1, 5) : at(publishAt + 1, 5)) : c));
  };
  const runsIn = (phase: string) => PHASES.find((p) => p.name === phase)!.runsIn;

  it("shows the wait of the main session when the executor is a sub-agent that waited for its implementers", async () => {
    const helper = [wait(at(buildAt, 20)), wait(at(buildAt, 25)), wait(at(buildAt, 30))];
    const s = setup({ calls: mainCalls(), files: [{ file: "s/subagents/agent-1.jsonl", calls: helper, sidechain: true }] });
    const r = await run(s);
    expect(r.stdout).toContain(planWait(at(readyAt + 1, 5)));
    expect(r.stdout).toContain(retroWait(at(publishAt + 1, 5)));
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
  });

  it("keeps the executor phases done and the plan wait of the first main session when the executor is an Orca worker", async () => {
    const tagged = taggedCalls();
    const retimed = mainCalls();
    const main = retimed.filter((_, i) => runsIn(tagged[i]!.phase) === "main conversation");
    const worker = tagged.filter((t) => runsIn(t.phase) === "executor").map(({ time, command }) => ({ time, command }));
    const s = setup({ calls: main, files: [{ file: "worker.jsonl", calls: [...worker, wait(at(buildAt, 50))] }] });
    const r = await run(s);
    const executorLines = r.stdout.split("\n").filter((l) => PHASES.some((p) => p.runsIn === "executor" && l.startsWith(`${p.name}: `)));
    expect(executorLines.length).toBeGreaterThan(5);
    expect(executorLines.every((l) => / done /.test(l))).toBe(true);
    expect(r.stdout).toContain(planWait(at(readyAt + 1, 5)));
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
  });

  it("shows the waits of the second main session when the main conversation resumed there", async () => {
    const tagged = taggedCalls();
    const early = ["ticket", "dependencies", "code-map", "questions"];
    const first = tagged.filter((t) => early.includes(t.phase)).map(({ time, command }) => ({ time, command }));
    const second = mainCalls().filter((c) => !first.some((f) => f.time === c.time && f.command === c.command));
    const helper = [wait(at(buildAt, 20)), wait(at(publishAt + 1, 2))];
    const s = setup({
      calls: first,
      files: [
        { file: "s2.jsonl", calls: second },
        { file: "s/subagents/agent-1.jsonl", calls: helper, sidechain: true },
      ],
    });
    const r = await run(s);
    expect(r.stdout).toContain(planWait(at(readyAt + 1, 5)));
    expect(r.stdout).toContain(retroWait(at(publishAt + 1, 5)));
    expect(r.code).toBe(0);
  });

  it("does not take a wait of a main session that belongs to another plan", async () => {
    const other = [
      { time: at(planAt, 1), command: "cstack next --done ticket --plan docs/plans/other.md" },
      { time: at(planAt + 1, 4), command: "cstack helper start executor --plan docs/plans/other.md" },
      wait(at(planAt + 1, 8)),
    ];
    const s = setup({ calls: mainCalls(), files: [{ file: "other.jsonl", calls: other }] });
    const r = await run(s);
    const own = mainCalls().find((c) => c.command === WAIT)!;
    expect(r.stdout).toContain(planWait(own.time));
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
  });

  it("falls back to every file that is not a helper transcript when no session holds the close of the ticket phase", async () => {
    const calls = mainCalls().filter((c) => c.command !== "cstack next --done ticket --plan docs/plans/audit.md");
    const helper = [wait(at(planAt, 1))];
    const s = setup({ calls, files: [{ file: "s/subagents/agent-1.jsonl", calls: helper, sidechain: true }] });
    const r = await run(s);
    const own = calls.find((c) => c.command === WAIT)!;
    expect(r.stdout).toContain(planWait(own.time));
    expect(r.stderr).toBe(
      "cstack audit: no session file holds the close of the ticket phase, so the steps of the main conversation may show the calls of another agent.\n",
    );
    expect(r.code).toBe(1);
    noPath(r.stderr, s);
    for (const line of r.stdout.split("\n").filter((l) => l !== "")) {
      expect(/^(phase [a-z-]+( started)?|[a-z-]+: .+): (done \S+ (session|run state|git)|skipped|out of order \S+ (session|run state|git))$/.test(line), line).toBe(true);
    }
    noPath(r.stdout, s);
  });
});

describe("nothing private leaves the command", () => {
  const MARK = "SECRET_MARKER_4821";
  const withMarker = (s: Setup) => {
    const file = join(s.home, ".claude", "projects", "p", "s.jsonl");
    const extra = [
      { type: "assistant", cwd: s.repo, timestamp: at(1), message: { content: [{ type: "text", text: `answer ${MARK}` }, { type: "tool_use", id: "m1", name: "Bash", input: { command: `echo ${MARK} && cstack tracker read ${MARK}` } }] } },
      { type: "user", cwd: s.repo, timestamp: at(1), message: { content: [{ type: "tool_result", tool_use_id: "m1", content: MARK }] } },
    ];
    writeFileSync(file, readFileSync(file, "utf8") + extra.map((l) => `${JSON.stringify(l)}\n`).join(""));
  };
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const texts = PHASES.flatMap(({ name }) => stepTexts(name).map((step) => `${name}: ${escape(step.text).replace(/\d+/g, "\\d+")}`));
  const verdict = "(done \\S+ (session|run state|git)|skipped|out of order \\S+ (session|run state|git))";
  const allowed = [
    new RegExp(`^phase [a-z-]+ started: ${verdict}$`),
    new RegExp(`^phase [a-z-]+: ${verdict}$`),
    new RegExp(`^(${texts.join("|")}): ${verdict}$`),
  ];

  it("prints only the allowed lines and never the marker", async () => {
    const s = setup();
    withMarker(s);
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.stdout + r.stderr).not.toContain(MARK);
    const lines = r.stdout.split("\n").filter((l) => l !== "");
    expect(lines.filter((l) => !l.startsWith("phase ")).length).toBeGreaterThan(0);
    for (const line of lines) expect(allowed.some((pattern) => pattern.test(line)), line).toBe(true);
  });

  it("never prints the repository, the home or the guide folder", async () => {
    const s = setup();
    withMarker(s);
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    for (const path of [s.repo, s.home, s.guides]) expect(r.stdout + r.stderr).not.toContain(path);
  });
});
