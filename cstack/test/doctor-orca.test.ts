import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { doctor } from "../src/commands/doctor.js";
import type { DoctorInput } from "../src/doctor/requirements.js";
import type { RunResult } from "../src/orca/run.js";
import type { Io } from "../src/io.js";

const orcaDir = join(import.meta.dirname, "fixtures", "orca", "1.4.263");
const doctorDir = join(import.meta.dirname, "fixtures", "doctor");
const orcaText = (file: string): RunResult => ({
  kind: "ok",
  stdout: readFileSync(join(orcaDir, file), "utf8"),
});
const tool = (name: string): RunResult => ({
  kind: "ok",
  stdout: readFileSync(join(doctorDir, `${name}.txt`), "utf8"),
});

const STATUS = "orca status --json";
const CONTEXT = "orca agent-context --json";
const JIRA = "orca jira connection --json";
const LINEAR = "orca linear team list --workspace all --json";

const others: Record<string, RunResult> = {
  "sw_vers -productVersion": tool("sw_vers"),
  "xcode-select -p": tool("xcode-select"),
  "git --version": tool("git"),
  "graphify --version": tool("graphify"),
  "gh --version": tool("gh"),
  "glab --version": tool("glab"),
  "claude --version": tool("claude"),
};

const connected: Record<string, RunResult> = {
  "orca --version": orcaText("version.current.txt"),
  [STATUS]: orcaText("status.running.json"),
  [CONTEXT]: orcaText("agent-context.current.json"),
  [JIRA]: orcaText("jira-connection.one-site.json"),
  [LINEAR]: orcaText("linear-team-list.connected.json"),
};

const ALLOWED = new Set([
  "orca --version",
  STATUS,
  CONTEXT,
  JIRA,
  LINEAR,
  ...Object.keys(others),
]);

async function run(overrides: Record<string, RunResult> = {}, withOrca = true) {
  const table = { ...others, ...(withOrca ? connected : {}), ...overrides };
  const calls: string[] = [];
  let stdout = "";
  const io: Io = { stdout: (t) => void (stdout += t), stderr: () => {} };
  const input: DoctorInput = {
    run: async (command, args) => {
      const key = [command, ...args].join(" ");
      calls.push(key);
      return table[key] ?? { kind: "missing" };
    },
    timeoutMs: 5000,
    nodeVersion: "26.0.0",
    enginesNode: ">=26",
    findOnPath: () => "/opt/homebrew/bin/git",
  };
  const code = await doctor(io, input);
  const lines = stdout.split("\n");
  const at = lines.findIndex((l) => l.startsWith("Orca"));
  const orca = [lines[at]];
  for (let i = at + 1; lines[i]?.startsWith("  "); i++) orca.push(lines[i]);
  return { code, calls, stdout, orca };
}

const version = (v: string): RunResult => ({ kind: "ok", stdout: `${v}\n` });

describe("doctor and Orca", () => {
  it("prints the minimum, supported, and one line per feature", async () => {
    const { orca, code } = await run();
    expect(orca).toEqual([
      "Orca (optional): 1.4.263, minimum 1.4.259, supported, running.",
      "  Orca workers: available",
      "  Child worktrees: available",
      "  Worktrees linked to tickets: available",
      "  Jira through Orca: available",
      "  Linear through Orca: available",
    ]);
    expect(code).toBe(0);
  });

  it("says that a newer version has not been tested", async () => {
    const { orca } = await run({ "orca --version": version("1.4.1000") });
    expect(orca[0]).toContain("supported");
    expect(orca[0]).toContain("has not been tested");
    expect(orca[0]).toContain("cstack still uses it");
  });

  it("says that an older version is not supported", async () => {
    const { orca, code } = await run({ "orca --version": version("1.4.258") });
    expect(orca[0]).toContain("1.4.258, minimum 1.4.259, not supported");
    expect(orca).toHaveLength(6);
    for (const line of orca.slice(1)) expect(line).toContain("not available");
    expect(code).toBe(0);
  });

  it("gives every feature as not available when Orca is closed", async () => {
    const { orca, code } = await run({ [STATUS]: orcaText("status.closed.json") });
    expect(orca[0]).toContain("not running");
    expect(orca).toHaveLength(6);
    for (const line of orca.slice(1)) expect(line).toContain("not available");
    expect(code).toBe(0);
  });

  it("gives the reason of a feature that is not available", async () => {
    const { orca } = await run({ [JIRA]: orcaText("jira-connection.empty.json") });
    expect(orca).toContain("  Jira through Orca: not available. Orca has no saved Jira site.");
  });

  it("prints only the Orca line when Orca is not installed", async () => {
    const { orca, code } = await run({}, false);
    expect(orca).toHaveLength(1);
    expect(orca[0]).toContain("Orca is not installed.");
    expect(code).toBe(0);
  });

  it("runs only read commands and never opens, serves or installs", async () => {
    const { calls } = await run();
    for (const call of calls) expect(ALLOWED.has(call)).toBe(true);
    expect(calls.join("\n")).not.toMatch(/orca (open|serve)|install/);
  });

  it("never prints a site, email or team from an answer", async () => {
    const { stdout } = await run();
    for (const secret of ["jira.example.com", "person@example.com", "Example Person", "Example Team"])
      expect(stdout).not.toContain(secret);
  });
});
