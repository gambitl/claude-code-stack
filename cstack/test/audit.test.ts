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
// A call with `launch` is a launch of a sub-agent of that type, written as the tool `tool` (default `Agent`).
type Call = { time: string; command: string; launch?: string; tool?: string };
const item = (call: Call, id: string) =>
  call.launch === undefined
    ? { type: "tool_use", id, name: "Bash", input: { command: call.command } }
    : { type: "tool_use", id, name: call.tool ?? "Agent", input: { description: "sample description", prompt: "sample prompt", subagent_type: call.launch } };
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
    // One launch for every helper step of the test guides, in the window of its phase and after the calls before it.
    const launch = (type: string, second: number): void => {
      calls.push({ phase: name, time: at(i, second), command: "", launch: type });
    };
    if (name === "questions") launch("resolve-issue:cto-review", 4);
    if (name === "build") {
      for (const _unit of UNITS) launch("resolve-issue:implementer", 8);
      launch("resolve-issue:cto-review", 30);
      launch("resolve-issue:code-reviewer-deep", 31);
    }
  });
  return calls;
}
function fullCalls(): Call[] {
  return taggedCalls().map(({ phase: _phase, ...call }) => call);
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
      message: { content: [item(call, `t${i}`)] },
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
        message: { content: [item(call, `${extra.file}#${i}`)] },
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

  it("does not print action steps or steps whose condition is false", async () => {
    const s = setup();
    const r = await run(s);
    expect(r.stdout).toContain("build: cstack unit order --plan <plan file>: done ");
    expect(r.stdout).toContain("build: resolve-issue:implementer: done ");
    expect(r.stdout).not.toContain("implementer-escalation");
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
    const worker = tagged.filter((t) => runsIn(t.phase) === "executor").map(({ phase: _phase, ...call }) => call);
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
    const first = tagged.filter((t) => early.includes(t.phase)).map(({ phase: _phase, ...call }) => call);
    const second = mainCalls().filter((c) => !first.some((f) => f.time === c.time && f.command === c.command && f.launch === c.launch));
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

  it("prints the sentence about unreadable files before the sentence about the missing close of the ticket phase", async () => {
    const calls = mainCalls().filter((c) => c.command !== "cstack next --done ticket --plan docs/plans/audit.md");
    const s = setup({ calls });
    mkdirSync(join(s.home, ".claude", "projects", "p", "dir.jsonl"));
    const r = await run(s);
    expect(r.stderr).toBe(
      "cstack audit: some session files could not be read, so some steps may show as skipped.\n" +
        "cstack audit: no session file holds the close of the ticket phase, so the steps of the main conversation may show the calls of another agent.\n",
    );
    expect(r.code).toBe(1);
  });
});

describe("cstack audit units built after the build phase", () => {
  const PLAN = "docs/plans/audit.md";
  const BUILD = [
    "command: cstack tracker move '<key>' --to \"in progress\" --tracker <name>",
    "command: cstack unit order --plan <plan file>",
    "command: cstack helper start implementer --plan <plan file> --unit <n> | each-unit",
    "command: cstack unit red <n> | each-unit-with-test",
    "command: cstack unit green <n> | each-unit-with-test",
    "command: cstack unit commit <n> | each-unit",
    "command: cstack helper wait <helper id> | each-unit",
    "command: cstack unit collect <n>... --plan <plan file>",
    "command: cstack plan status --plan <plan file>",
    "command: cstack next --done build --plan <plan file>",
  ];
  const WAIT = "cstack helper wait x";
  const startText = (n: number) => `build: cstack helper start implementer --plan <plan file> --unit ${n}`;
  const WAIT_LINE = "build: cstack helper wait <helper id>";
  const readyAt = PHASES.findIndex((p) => p.name === "ready");
  const publishAt = PHASES.findIndex((p) => p.name === "publish");
  const abqAt = PHASES.findIndex((p) => p.name === "after-build-questions");
  const runsIn = (phase: string) => PHASES.find((p) => p.name === phase)!.runsIn;
  const run = async (s: Setup) => await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
  const done = (text: string, time: string, record = "session") => `${text}: done ${localTime(new Date(time))} ${record}\n`;

  // The calls of one unit: its helper start, red, green, commit and wait, two seconds apart.
  function unitCalls(n: number, minute: number, second: number, skip: string[] = []): Call[] {
    const steps: [string, string][] = [
      ["start", `cstack helper start implementer --plan ${PLAN} --unit ${n}`],
      ["red", `cstack unit red ${n}`],
      ["green", `cstack unit green ${n}`],
      ["commit", `cstack unit commit ${n}`],
      ["wait", WAIT],
    ];
    return steps
      .map(([kind, command], k) => ({ kind, call: { time: at(minute, second + 2 * k), command } }))
      .filter(({ kind }) => !skip.includes(kind) && !(n === 3 && (kind === "red" || kind === "green")))
      .map(({ call }) => call);
  }
  const before = (): Call[] => [
    { time: at(buildAt, 1), command: "cstack tracker move 'x' --to \"in progress\" --tracker x" },
    { time: at(buildAt, 2), command: `cstack unit order --plan ${PLAN}` },
  ];
  const after = (): Call[] => [
    { time: at(buildAt, 50), command: `cstack unit collect 1 2 3 --plan ${PLAN}` },
    { time: at(buildAt, 52), command: `cstack plan status --plan ${PLAN}` },
    { time: at(buildAt + 1), command: `cstack next --done build --plan ${PLAN}` },
  ];
  const collectLines = (stdout: string) =>
    stdout.split("\n").filter((l) => /^build: (cstack unit collect|cstack plan status|cstack next --done build)/.test(l));
  // The main conversation: its own calls, with its waits after the close of ready and after the close of publish.
  function mainCalls(): Call[] {
    const tagged = taggedCalls();
    let seen = 0;
    return fullCalls()
      .map((c) => (c.command === WAIT ? { ...c, time: seen++ === 0 ? at(readyAt + 1, 5) : at(publishAt + 1, 5) } : c))
      .filter((_, i) => runsIn(tagged[i]!.phase) === "main conversation");
  }
  function build(executor: Call[]): Setup {
    const s = setup({ calls: mainCalls(), files: [{ file: "s/subagents/agent-1.jsonl", calls: executor, sidechain: true }] });
    writeGuides(s.guides, { build: `<!-- mandatory steps\n${BUILD.join("\n")}\n-->\n\n${MARKER}\n` });
    return s;
  }
  function commitOn(s: Setup, unit: number, time: string): void {
    git(s.repo, "checkout", "-b", "feature");
    process.env.GIT_AUTHOR_DATE = time;
    try {
      commitFiles(s.repo, [`u${unit}.txt`], unit);
    } finally {
      delete process.env.GIT_AUTHOR_DATE;
    }
  }
  const early = (): Call[] => [...before(), ...unitCalls(1, buildAt, 10), ...unitCalls(2, buildAt, 20)];
  const waitLines = (stdout: string) => stdout.split("\n").filter((l) => l.startsWith(`${WAIT_LINE}: `));

  it("finds the steps of a unit built during after-build-questions, and keeps the steps after the group done", async () => {
    const s = build([...early(), ...unitCalls(3, abqAt, 10), ...after()]);
    commitOn(s, 3, at(buildAt, 40));
    const r = await run(s);
    expect(r.stdout).toContain(done(startText(3), at(abqAt, 10)));
    expect(r.stdout).toContain(done("build: cstack unit commit 3", at(abqAt, 16)));
    expect(r.stdout.split("\n").filter((l) => l.startsWith("build: cstack helper wait <helper id>: "))[2]! + "\n").toBe(done(WAIT_LINE, at(abqAt, 18)));
    expect(collectLines(r.stdout)).toHaveLength(3);
    for (const line of collectLines(r.stdout)) expect(line, line).toContain(": done ");
  });

  it("finds the steps of a unit whose build time comes from its saved failing run", async () => {
    const late = [
      { time: at(buildAt + 1, 10), command: `cstack helper start implementer --plan ${PLAN} --unit 2` },
      { time: at(buildAt + 1, 30), command: WAIT },
    ];
    const s = build([...before(), ...unitCalls(1, buildAt, 10), ...late, ...unitCalls(3, buildAt, 30), ...after()]);
    const common = git(s.repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
    const folder = join(common, "cstack", "runs", "audit", "units", "2");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "red.json"), JSON.stringify({ time: at(buildAt + 1, 20) }));
    commitOn(s, 2, at(buildAt, 45));
    const r = await run(s);
    expect(r.stdout).toContain(done(startText(2), at(buildAt + 1, 10)));
    expect(r.stdout).toContain(done("build: cstack unit red 2", at(buildAt + 1, 20), "run state"));
    expect(waitLines(r.stdout)[1]! + "\n").toBe(done(WAIT_LINE, at(buildAt + 1, 30)));
    for (const line of collectLines(r.stdout)) expect(line, line).toContain(": done ");
  });

  it("finds the steps of a unit whose build time comes from git, after the close of build", async () => {
    const s = build([...early(), ...unitCalls(3, buildAt + 1, 20, ["commit"]), ...after()]);
    commitOn(s, 3, at(buildAt + 1, 24));
    const r = await run(s);
    expect(r.stdout).toContain(done(startText(3), at(buildAt + 1, 20)));
    expect(collectLines(r.stdout)).toHaveLength(3);
    for (const line of collectLines(r.stdout)) expect(line, line).toContain(": done ");
  });

  it("looks with no end for the steps of a unit built after the close of the last phase", async () => {
    const s = build([...early(), ...unitCalls(3, publishAt + 1, 10), ...after()]);
    const r = await run(s);
    expect(r.stdout).toContain(done(startText(3), at(publishAt + 1, 10)));
    expect(r.stdout).toContain(done("build: cstack unit commit 3", at(publishAt + 1, 16)));
    expect(waitLines(r.stdout)[2]! + "\n").toBe(done(WAIT_LINE, at(publishAt + 1, 18)));
    for (const line of collectLines(r.stdout)) expect(line, line).toContain(": done ");
  });

  it("keeps the floor of the step before the group for the steps after it when every unit is late", async () => {
    // A collect call before the order of the units must not count for the step after the group.
    const early = { time: at(buildAt, 1), command: `cstack unit collect 1 2 3 --plan ${PLAN}` };
    const late = [...unitCalls(1, abqAt, 10), ...unitCalls(2, abqAt, 20), ...unitCalls(3, abqAt, 30)];
    const s = build([early, ...before(), ...late, ...after()]);
    const r = await run(s);
    expect(r.stdout).toContain(done("build: cstack unit collect <n>... --plan <plan file>", at(buildAt, 50)));
    expect(r.stdout).toContain(done("build: cstack plan status --plan <plan file>", at(buildAt, 52)));
    expect(r.stdout).toContain(done("build: cstack next --done build --plan <plan file>", at(buildAt + 1)));
  });

  it("never takes the wait of the main conversation for a unit whose wait was never run", async () => {
    const s = build([...early(), ...unitCalls(3, abqAt, 10, ["wait"]), ...after()]);
    const r = await run(s);
    expect(waitLines(r.stdout)[2]).toBe(`${WAIT_LINE}: skipped`);
  });

  it("lets the one wait call of the build serve only the wait line of unit 1", async () => {
    const calls = [...before(), ...unitCalls(1, buildAt, 10, ["wait"]), ...unitCalls(2, buildAt, 20, ["wait"]), ...unitCalls(3, buildAt, 30, ["wait"]), { time: at(buildAt, 40), command: WAIT }, ...after()];
    const r = await run(build(calls));
    expect(waitLines(r.stdout)).toEqual([`${WAIT_LINE}: done ${localTime(new Date(at(buildAt, 40)))} session`, `${WAIT_LINE}: skipped`, `${WAIT_LINE}: skipped`]);
  });

  it("marks the wait line of unit 1 out of order and skips the others when the only wait comes before the commit", async () => {
    const calls = [...before(), { time: at(buildAt, 5), command: WAIT }, ...unitCalls(1, buildAt, 10, ["wait"]), ...unitCalls(2, buildAt, 20, ["wait"]), ...unitCalls(3, buildAt, 30, ["wait"]), ...after()];
    const r = await run(build(calls));
    expect(waitLines(r.stdout)).toEqual([`${WAIT_LINE}: out of order ${localTime(new Date(at(buildAt, 5)))} session`, `${WAIT_LINE}: skipped`, `${WAIT_LINE}: skipped`]);
  });

  it("skips the wait line of the retro when the main conversation has only its plan wait", async () => {
    const tagged = taggedCalls();
    const calls = fullCalls()
      .map((c) => (c.command === WAIT ? { ...c, time: at(readyAt + 1, 5) } : c))
      .filter((c, i) => runsIn(tagged[i]!.phase) === "main conversation" && !(c.command === WAIT && tagged[i]!.phase === "retro"));
    const s = setup({ calls, files: [{ file: "s/subagents/agent-1.jsonl", calls: [...early(), ...unitCalls(3, buildAt, 30), ...after()], sidechain: true }] });
    const r = await run(s);
    expect(r.stdout).toContain(`plan: cstack helper wait <helper id>: done ${localTime(new Date(at(readyAt + 1, 5)))} session\n`);
    expect(r.stdout).toContain("retro: cstack helper wait <helper id>: skipped\n");
  });
});

describe("cstack audit conditional command steps", () => {
  const block = (lines: string[]) => `<!-- mandatory steps\n${lines.join("\n")}\n-->\n\n${MARKER}\n`;
  const COMMENT = "cstack tracker comment '<key>' --body-file <file> --tracker <name>";
  const basePlan = () => readFileSync(join(fixtures, "audit", "plan.md"), "utf8");
  const withFeeds = (feeds: string) => basePlan().replace("The ticket text starts here.", `The ticket text starts here.\n\n**Size: M** · Blocked by: #89 · Feeds: ${feeds}`);
  const withDesign = (text: string) => text.replace("- Depends on: none", "- Depends on: none\n- Design specification: a sample");
  const withDecisionSentence = (text: string) => text.replace("## Architecture\n", "## Architecture\n\nNo new decision since the question round.\n");
  const run = async (plan: string, guides: Record<string, string[]>, extra: Call[] = [], prepare?: (s: Setup) => void) => {
    const s = setup({ plan, calls: [...fullCalls(), ...extra] });
    writeGuides(s.guides, Object.fromEntries(Object.entries(guides).map(([name, lines]) => [name, block(lines)])));
    prepare?.(s);
    return await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
  };
  const phaseIndex = (name: string) => PHASES.findIndex((p) => p.name === name);
  const only = (stdout: string, prefix: string) => stdout.split("\n").filter((l) => l.startsWith(prefix));
  const DOCUMENT = {
    document: [`command: ${COMMENT}`, `command: ${COMMENT} | each-dependent-ticket`, "command: cstack next --done document"],
  };
  const commentCalls = (count: number): Call[] =>
    Array.from({ length: count }, (_, k) => ({ time: at(phaseIndex("document"), 10 + k), command: "cstack tracker comment x --body-file x --tracker x" }));
  const commentLines = (stdout: string) => only(stdout, `document: ${COMMENT}: `);

  it("prints the ticket comment and one line for each dependent ticket, all done with three calls", async () => {
    const r = await run(withFeeds("#91, #92"), DOCUMENT, commentCalls(3));
    const lines = commentLines(r.stdout);
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line).toContain(": done ");
  });

  it("marks the two last of three comment lines skipped when only one call was made", async () => {
    const r = await run(withFeeds("#91, #92"), DOCUMENT, commentCalls(1));
    const lines = commentLines(r.stdout);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain(": done ");
    expect(lines[1]).toBe(`document: ${COMMENT}: skipped`);
    expect(lines[2]).toBe(`document: ${COMMENT}: skipped`);
  });

  it("prints one dependent-ticket line for Feeds with one ticket", async () => {
    const r = await run(withFeeds("#91"), DOCUMENT, commentCalls(2));
    expect(commentLines(r.stdout)).toHaveLength(2);
  });

  it("prints no dependent-ticket line for Feeds: none", async () => {
    const one = await run(withFeeds("#91"), DOCUMENT, commentCalls(2));
    expect(commentLines(one.stdout)).toHaveLength(2);
    const none = await run(withFeeds("none"), DOCUMENT, commentCalls(2));
    expect(commentLines(none.stdout)).toHaveLength(1);
  });

  const UI = { ready: ["command: cstack next --done ready", "command: cstack plan status --plan <plan file> | user-interface"] };
  const UI_LINE = "ready: cstack plan status --plan <plan file>: ";
  it("prints a user-interface step only when a unit has a design specification", async () => {
    const yes = await run(withDesign(basePlan()), UI);
    expect(only(yes.stdout, UI_LINE)).toHaveLength(1);
    expect(only(yes.stdout, "ready: cstack next --done ready")).toHaveLength(1);
    const no = await run(basePlan(), UI);
    expect(only(no.stdout, "ready: cstack next --done ready")).toHaveLength(1);
    expect(only(no.stdout, UI_LINE)).toHaveLength(0);
  });

  const DECISION = { ready: ["command: cstack next --done ready", "command: cstack plan status --plan <plan file> | new-structural-decision"] };
  it("prints a new-structural-decision step only when the plan lacks the sentence", async () => {
    const lacks = await run(basePlan(), DECISION);
    expect(only(lacks.stdout, UI_LINE)).toHaveLength(1);
    const holds = await run(withDecisionSentence(basePlan()), DECISION);
    expect(only(holds.stdout, "ready: cstack next --done ready")).toHaveLength(1);
    expect(only(holds.stdout, UI_LINE)).toHaveLength(0);
  });

  it("prints a new-structural-decision step once when it follows a step with each-unit", async () => {
    const guides = {
      build: [
        "command: cstack unit order --plan <plan file>",
        "command: cstack unit commit <n> | each-unit",
        "command: cstack plan status --plan <plan file> | new-structural-decision",
        "command: cstack next --done build --plan <plan file>",
      ],
    };
    const r = await run(basePlan(), guides);
    expect(only(r.stdout, "build: cstack unit commit ")).toHaveLength(3);
    expect(only(r.stdout, "build: cstack plan status --plan <plan file>: ")).toHaveLength(1);
  });

  it("lists only the dependent-ticket step among that step, a stuck-unit step and a negative-criterion step", async () => {
    const guides = {
      build: [
        `command: ${COMMENT} | each-dependent-ticket`,
        "command: cstack unit green <n> | each-stuck-unit",
        "command: cstack unit red <n> | each-negative-criterion",
        "command: cstack next --done build --plan <plan file>",
      ],
    };
    const prepare = (s: Setup) => {
      const common = git(s.repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
      const folder = join(common, "cstack", "runs", "audit", "units", "1", "reports");
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "2026-11-23T10-00-00-stuck.json"), "{}");
    };
    const r = await run(withFeeds("#91"), guides, [], prepare);
    const lines = only(r.stdout, "build: ");
    expect(lines.filter((l) => l.startsWith(`build: ${COMMENT}: `))).toHaveLength(1);
    expect(lines.filter((l) => l.includes("cstack unit green") || l.includes("cstack unit red"))).toHaveLength(0);
    expect(lines).toHaveLength(2);
  });
});

describe("cstack audit helper steps", () => {
  const block = (lines: string[]) => `<!-- mandatory steps\n${lines.join("\n")}\n-->\n\n${MARKER}\n`;
  const CTO = "resolve-issue:cto-review";
  const DEEP = "resolve-issue:code-reviewer-deep";
  const CONVENTIONS = "resolve-issue:code-reviewer";
  const SIMPLICITY = "resolve-issue:code-reviewer-simplicity";
  const REVIEWERS = [
    `helper: ${DEEP} correctness`,
    `helper: ${DEEP} security`,
    `helper: ${CONVENTIONS} conventions`,
    `helper: ${SIMPLICITY}`,
  ];
  const GUIDES = {
    questions: [`helper: ${CTO} before-plan`, "command: cstack next --done questions"],
    plan: [`helper: ${CTO} plan-delta | new-structural-decision`, "command: cstack next --done plan"],
    review: [...REVIEWERS, "command: cstack next --done review"],
    "independent-review": ["helper: resolve-issue:pr-reviewer", "command: cstack next --done independent-review"],
    briefing: [`helper: ${CTO} after-build`, "command: cstack next --done briefing"],
    // The guide of the build phase of the other tests holds helper steps, and they would take the launches of the review phase.
    build: ["command: cstack next --done build --plan <plan file>"],
  };
  const index = (phase: string) => PHASES.findIndex((p) => p.name === phase);
  const launch = (phase: string, type: string, second: number, tool?: string): Call => ({
    time: at(index(phase), second),
    command: "",
    launch: type,
    ...(tool === undefined ? {} : { tool }),
  });
  const run = async (launches: Call[], files: { file: string; calls: Call[]; sidechain?: boolean }[] = [], guides: Record<string, string[]> = GUIDES, plan?: string) => {
    const s = setup({ calls: [...fullCalls().filter((c) => c.launch === undefined), ...launches], files, ...(plan === undefined ? {} : { plan }) });
    writeGuides(s.guides, Object.fromEntries(Object.entries(guides).map(([name, lines]) => [name, block(lines)])));
    return await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
  };
  const helperFile = (calls: Call[]) => [{ file: "s/subagents/agent-1.jsonl", calls, sidechain: true }];
  const doneLine = (text: string, time: string) => `${text}: done ${localTime(new Date(time))} session\n`;
  const LINES = {
    before: `questions: ${CTO} before-plan`,
    delta: `plan: ${CTO} plan-delta`,
    after: `briefing: ${CTO} after-build`,
    correctness: `review: ${DEEP} correctness`,
    security: `review: ${DEEP} security`,
    conventions: `review: ${CONVENTIONS} conventions`,
    simplicity: `review: ${SIMPLICITY}`,
  };

  it("prints the three lines of the CTO advisor as done, from the main conversation and from a helper transcript", async () => {
    const before = launch("questions", CTO, 10);
    const delta = launch("plan", CTO, 10);
    const after = launch("briefing", CTO, 10);
    const r = await run([before, delta], helperFile([after]));
    expect(r.stdout).toContain(doneLine(LINES.before, before.time));
    expect(r.stdout).toContain(doneLine(LINES.delta, delta.time));
    expect(r.stdout).toContain(doneLine(LINES.after, after.time));
  });

  it("prints the four review lines as skipped when no code reviewer was launched", async () => {
    const r = await run([launch("questions", CTO, 10)]);
    for (const key of ["correctness", "security", "conventions", "simplicity"] as const) expect(r.stdout).toContain(`${LINES[key]}: skipped\n`);
    expect(r.stdout).toContain(doneLine(LINES.before, launch("questions", CTO, 10).time));
  });

  it("lets one launch of the deep reviewer serve only the correctness line", async () => {
    const deep = launch("review", DEEP, 10);
    const r = await run([deep]);
    expect(r.stdout).toContain(doneLine(LINES.correctness, deep.time));
    expect(r.stdout).toContain(`${LINES.security}: skipped\n`);
  });

  it("prints the four review lines as done when the reviewers were launched in the reverse order of the block", async () => {
    const calls = [launch("review", SIMPLICITY, 10), launch("review", CONVENTIONS, 12), launch("review", DEEP, 14), launch("review", DEEP, 16)];
    const r = await run(calls);
    expect(r.stdout).toContain(doneLine(LINES.simplicity, calls[0]!.time));
    expect(r.stdout).toContain(doneLine(LINES.conventions, calls[1]!.time));
    expect(r.stdout).toContain(doneLine(LINES.correctness, calls[2]!.time));
    expect(r.stdout).toContain(doneLine(LINES.security, calls[3]!.time));
  });

  it("leaves the questions line skipped for a launch of the CTO advisor in a helper transcript", async () => {
    const after = launch("briefing", CTO, 10);
    const r = await run([], helperFile([launch("questions", CTO, 10), after]));
    expect(r.stdout).toContain(`${LINES.before}: skipped\n`);
    expect(r.stdout).toContain(doneLine(LINES.after, after.time));
  });

  it("leaves the questions line skipped for a launch of a general-purpose sub-agent", async () => {
    const after = launch("briefing", CTO, 10);
    const r = await run([launch("questions", "general-purpose", 10)], helperFile([after]));
    expect(r.stdout).toContain(`${LINES.before}: skipped\n`);
    expect(r.stdout).toContain(doneLine(LINES.after, after.time));
  });

  it("leaves the plan-delta line skipped for a SendMessage call", async () => {
    const before = launch("questions", CTO, 10);
    const r = await run([before, launch("plan", CTO, 10, "SendMessage")]);
    expect(r.stdout).toContain(`${LINES.delta}: skipped\n`);
    expect(r.stdout).toContain(doneLine(LINES.before, before.time));
  });

  it("prints every helper line after every command line", async () => {
    const r = await run([launch("questions", CTO, 10), launch("review", DEEP, 10)]);
    const lines = r.stdout.split("\n").filter((l) => l !== "" && !l.startsWith("phase "));
    const isHelper = (l: string) => /^[a-z-]+: resolve-issue:/.test(l);
    expect(lines.some(isHelper)).toBe(true);
    expect(lines.some((l) => !isHelper(l))).toBe(true);
    expect(lines.findIndex(isHelper)).toBeGreaterThan(lines.map((l, i) => (isHelper(l) ? -1 : i)).reduce((a, b) => Math.max(a, b)));
  });

  it("prints only the first helper step of a block that holds a helper, an action and a helper with a false condition", async () => {
    const guides = { questions: [`helper: ${CTO} before-plan`, "action: approval-gate", `helper: ${CTO} plan-delta | each-stuck-unit`, "command: cstack next --done questions"] };
    const before = launch("questions", CTO, 10);
    const r = await run([before], [], guides);
    expect(r.stdout).toContain(doneLine(LINES.before, before.time));
    expect(r.stdout).not.toContain("questions: resolve-issue:cto-review plan-delta");
    expect(r.stdout).not.toContain("approval-gate");
  });

  it("prints no helper line for a step whose condition is false", async () => {
    const withSentence = readFileSync(join(fixtures, "audit", "plan.md"), "utf8").replace("## Architecture\n", "## Architecture\n\nNo new decision since the question round.\n");
    const before = launch("questions", CTO, 10);
    const r = await run([before], [], GUIDES, withSentence);
    expect(r.stdout).toContain(doneLine(LINES.before, before.time));
    expect(r.stdout).not.toContain(LINES.delta);
  });

  it("prints a helper line with only a fixed text, a verdict, a time and a record, whatever the launch holds", async () => {
    const MARK = "SECRET_MARKER_4821";
    const s = setup({ calls: fullCalls().filter((c) => c.launch === undefined) });
    writeGuides(s.guides, Object.fromEntries(Object.entries(GUIDES).map(([name, lines]) => [name, block(lines)])));
    const file = join(s.home, ".claude", "projects", "p", "s.jsonl");
    const extra = {
      type: "assistant",
      cwd: s.repo,
      timestamp: at(index("questions"), 10),
      message: { content: [{ type: "tool_use", id: "m2", name: "Agent", input: { description: MARK, prompt: `${MARK} ${s.repo}`, subagent_type: CTO } }] },
    };
    writeFileSync(file, readFileSync(file, "utf8") + `${JSON.stringify(extra)}\n`);
    const r = await audit([s.plan, "--home", s.home, "--guides", s.guides], s.pkg);
    expect(r.stdout + r.stderr).not.toContain(MARK);
    expect(r.stdout + r.stderr).not.toContain(s.repo);
    const helperLines = r.stdout.split("\n").filter((l) => /^[a-z-]+: resolve-issue:/.test(l));
    expect(helperLines.length).toBeGreaterThan(0);
    for (const line of helperLines) expect(line).toMatch(/^[a-z-]+: resolve-issue:[a-z-]+( [a-z-]+)?: (done \S+ session|skipped|out of order \S+ session)$/);
    expect(r.stdout).toContain(doneLine(LINES.before, at(index("questions"), 10)));
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
    new RegExp(`^[a-z-]+: resolve-issue:[a-z-]+( [a-z-]+)?: ${verdict}$`),
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
