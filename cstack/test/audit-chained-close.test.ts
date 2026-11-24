// WHY: ADR-RQG-C — the executor joins the close of a phase to another command in one shell call, and the audit must still find that close.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { localTime } from "../src/local-time.js";
import { PHASES } from "../src/phases.js";
import { commitPlan, git, makeRepo } from "./helpers/plan-repo.js";

const fixtures = join(import.meta.dirname, "fixtures");
const version = (JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as { version: string }).version;
const PLANNING = ["ticket", "dependencies", "code-map", "questions", "plan"];

const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) rmSync(folders.pop()!, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  folders.push(folder);
  return folder;
}

const at = (minutes: number, seconds = 0): string => new Date(Date.UTC(2026, 10, 23, 10, 0, 0) + (minutes * 60 + seconds) * 1000).toISOString();
const indexOf = (name: string): number => PHASES.findIndex((p) => p.name === name);

// A finished run: phase i closes at minute i+1, and a phase that is not a planning phase starts 30 seconds before.
function fullPhases(): Record<string, { startedAt?: string; doneAt: string }> {
  const phases: Record<string, { startedAt?: string; doneAt: string }> = {};
  PHASES.forEach(({ name }, i) => {
    phases[name] = PLANNING.includes(name) ? { doneAt: at(i + 1) } : { startedAt: at(i + 1, -30), doneAt: at(i + 1) };
  });
  return phases;
}

// Guides whose block holds the close of the phase, as the real guides write it. The publish guide also holds the submit of the report.
function writeGuides(folder: string): void {
  mkdirSync(join(folder, "resolve-issue"), { recursive: true });
  for (const { name } of PHASES) {
    const steps = [`command: cstack next --done ${name} --plan <plan file>`];
    if (name === "publish") steps.push("command: cstack report submit published --plan <plan file>");
    writeFileSync(join(folder, "resolve-issue", `${name}.md`), `<!-- mandatory steps\n${steps.join("\n")}\n-->\n\nThis file is a test fixture, not a real guide.\n`);
  }
}

// A repository with the plan committed, a finished run state, and a home folder with one session that holds the given Bash calls.
function setup(calls: { time: string; command: string }[]) {
  const repo = makeRepo();
  folders.push(repo);
  commitPlan(repo, readFileSync(join(fixtures, "audit", "plan.md"), "utf8"), "docs/plans/audit.md");
  const common = git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir");
  const stateFile = join(common, "cstack", "runs", "audit", "state.json");
  mkdirSync(dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify({ format: "cstack-run/1", writtenBy: version, plan: "docs/plans/audit.md", phases: fullPhases() }));
  const home = tmp("audit-home-");
  const folder = join(home, ".claude", "projects", "p");
  mkdirSync(folder, { recursive: true });
  const lines = calls.map((call, i) => ({
    type: "assistant",
    cwd: repo,
    timestamp: call.time,
    message: { content: [{ type: "tool_use", id: `t${i}`, name: "Bash", input: { command: call.command } }] },
  }));
  writeFileSync(join(folder, "s.jsonl"), lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
  const pkg = tmp("audit-pkg-");
  writeGuides(join(pkg, "guides"));
  return { repo, home, pkg };
}

async function audit(s: ReturnType<typeof setup>) {
  const { audit } = await import("../src/commands/audit.js");
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (t) => {
      out.stdout += t;
    },
    stderr: (t) => {
      out.stderr += t;
    },
  };
  const code = await audit([join(s.repo, "docs/plans/audit.md"), "--home", s.home], io, { packageRoot: s.pkg });
  return { code, ...out };
}

describe("cstack audit finds a close that shares a shell call", () => {
  it("prints the close of review as done from the session when a commit and the close share one Bash call", async () => {
    const time = at(indexOf("review") + 1);
    const s = setup([
      {
        time,
        command: "git add docs/plans/audit.md && git commit -m \"docs: update the plan\" && cstack next --done review --plan docs/plans/audit.md",
      },
    ]);
    const r = await audit(s);
    expect(r.stdout).toContain(`review: cstack next --done review --plan <plan file>: done ${localTime(new Date(time))} session\n`);
  });

  it("prints the close of publish and the submit of the report as done, in order, when they share one Bash call", async () => {
    const time = at(indexOf("publish") + 1);
    const s = setup([
      {
        time,
        command:
          "cstack next --done publish --plan docs/plans/audit.md && cstack report submit published --plan docs/plans/audit.md <<'EOF'\nThe pull request is open.\nEOF",
      },
    ]);
    const r = await audit(s);
    const done = `publish: cstack next --done publish --plan <plan file>: done ${localTime(new Date(time))} session\n`;
    const submit = `publish: cstack report submit published --plan <plan file>: done ${localTime(new Date(time))} session\n`;
    expect(r.stdout).toContain(done);
    expect(r.stdout).toContain(submit);
    expect(r.stdout.indexOf(done)).toBeLessThan(r.stdout.indexOf(submit));
  });
});
