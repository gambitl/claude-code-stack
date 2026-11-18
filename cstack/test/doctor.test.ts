import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { doctor } from "../src/commands/doctor.js";
import {
  nodeIsTooOld,
  type DoctorInput,
} from "../src/doctor/requirements.js";
import type { RunResult } from "../src/doctor/runner.js";
import type { Io } from "../src/io.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/doctor/${name}.txt`, import.meta.url), "utf8");

const ok = (name: string): RunResult => ({ kind: "ok", stdout: fixture(name) });

const json = (name: string): RunResult => ({
  kind: "ok",
  stdout: readFileSync(new URL(`./fixtures/doctor/${name}.json`, import.meta.url), "utf8"),
});

const answers: Record<string, RunResult> = {
  "sw_vers -productVersion": ok("sw_vers"),
  "xcode-select -p": ok("xcode-select"),
  "git --version": ok("git"),
  "graphify --version": ok("graphify"),
  "gh --version": ok("gh"),
  "glab --version": ok("glab"),
  "claude --version": ok("claude"),
  "orca --version": { kind: "missing" },
};

const STATUS = "orca status --json";
const JIRA = "orca jira connection --json";
const LINEAR = "orca linear team list --workspace all --json";

// The answers of an Orca that runs and has Jira and Linear.
const orcaConnected: Record<string, RunResult> = {
  "orca --version": ok("orca-version"),
  [STATUS]: json("orca-status-running"),
  [JIRA]: json("orca-jira-connected"),
  [LINEAR]: json("orca-linear-connected"),
};

const ALLOWED = new Set([
  "sw_vers -productVersion",
  "xcode-select -p",
  "git --version",
  "graphify --version",
  "gh --version",
  "glab --version",
  "claude --version",
  "orca --version",
  STATUS,
  JIRA,
  LINEAR,
]);

const orcaLine = (stdout: string) =>
  stdout.split("\n").find((l) => l.startsWith("Orca")) ?? "";

function setup(
  overrides: Record<string, RunResult> = {},
  input: Partial<DoctorInput> = {},
) {
  const calls: string[] = [];
  const table = { ...answers, ...overrides };
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (t) => {
      out.stdout += t;
    },
    stderr: (t) => {
      out.stderr += t;
    },
  };
  const full: DoctorInput = {
    run: async (command, args) => {
      const key = [command, ...args].join(" ");
      calls.push(key);
      return table[key] ?? { kind: "missing" };
    },
    timeoutMs: 5000,
    nodeVersion: "18.2.0",
    enginesNode: ">=18",
    findOnPath: () => "/opt/homebrew/bin/git",
    ...input,
  };
  return { calls, out, io, full };
}

describe("doctor", () => {
  it("prints one line per item and returns 0 when every item is present", async () => {
    const { out, io, full } = setup(orcaConnected);
    const code = await doctor(io, full);
    const lines = out.stdout.trimEnd().split("\n");
    expect(lines).toEqual([
      "macOS: 27.0.1",
      "Node: 18.2.0",
      "git: 2.55.0",
      "Graphify (optional): 0.9.112",
      "Forge client: gh 2.101.0, glab 1.119.0",
      "Claude Code: 2.1.327",
      "Orca (optional): 1.4.262, running. Trackers: Jira, Linear",
      "Every required item is present.",
    ]);
    expect(code).toBe(0);
  });

  it("prints how to install Graphify when it is missing and still returns 0", async () => {
    const { out, io, full } = setup({ "graphify --version": { kind: "missing" } });
    const code = await doctor(io, full);
    expect(out.stdout).toContain("uv tool install graphifyy");
    expect(code).toBe(0);
  });

  it("prints how to install git when it is missing and returns 1", async () => {
    const { out, io, full } = setup({ "git --version": { kind: "missing" } });
    const code = await doctor(io, full);
    expect(out.stdout).toContain("git: missing. Run \"xcode-select --install\".");
    expect(out.stdout).toContain("1 required item needs attention.");
    expect(code).toBe(1);
  });

  it("returns 1 when neither gh nor glab is present", async () => {
    const { out, io, full } = setup({
      "gh --version": { kind: "missing" },
      "glab --version": { kind: "missing" },
    });
    const code = await doctor(io, full);
    expect(out.stdout).toContain("Forge client: gh missing, glab missing.");
    expect(code).toBe(1);
  });

  it("accepts one forge client", async () => {
    const { out, io, full } = setup({ "glab --version": { kind: "missing" } });
    const code = await doctor(io, full);
    expect(out.stdout).toContain("Forge client: gh 2.101.0, glab missing\n");
    expect(code).toBe(0);
  });

  it("reports a Node version below engines.node as too old", async () => {
    const { out, io, full } = setup({}, { nodeVersion: "16.1.0" });
    const code = await doctor(io, full);
    expect(out.stdout).toContain("Node: 16.1.0 is too old. cstack needs >=18.");
    expect(code).toBe(1);
  });

  it("reports a command that never answers and checks the next items", async () => {
    const { out, io, full, calls } = setup({ "claude --version": { kind: "timeout" } });
    const code = await doctor(io, full);
    expect(out.stdout).toContain("Claude Code: did not answer within 5 seconds");
    expect(calls).toContain("orca --version");
    expect(code).toBe(1);
  });

  it("reports an answer without a version as present", async () => {
    const { out, io, full } = setup({
      "graphify --version": { kind: "ok", stdout: "hello\n" },
    });
    await doctor(io, full);
    expect(out.stdout).toContain("Graphify (optional): present, version unknown");
  });

  it("never runs git when the developer tools are missing and git is /usr/bin/git", async () => {
    const { out, io, full, calls } = setup(
      { "xcode-select -p": { kind: "failed", exitCode: 2 } },
      { findOnPath: () => "/usr/bin/git" },
    );
    const code = await doctor(io, full);
    expect(calls).not.toContain("git --version");
    expect(out.stdout).toContain("git: missing. Run \"xcode-select --install\".");
    expect(code).toBe(1);
  });

  it("runs git when the developer tools are missing but git is elsewhere", async () => {
    const { out, io, full, calls } = setup({
      "xcode-select -p": { kind: "failed", exitCode: 2 },
    });
    const code = await doctor(io, full);
    expect(calls).toContain("git --version");
    expect(out.stdout).toContain("git: 2.55.0");
    expect(code).toBe(0);
  });
});

describe("doctor and Orca", () => {
  it("lists Jira and Linear when Orca runs and is connected to both", async () => {
    const { out, io, full } = setup(orcaConnected);
    const code = await doctor(io, full);
    expect(orcaLine(out.stdout)).toBe(
      "Orca (optional): 1.4.262, running. Trackers: Jira, Linear",
    );
    expect(code).toBe(0);
  });

  it("says that Orca is not installed and returns 0", async () => {
    const { out, io, full } = setup();
    const code = await doctor(io, full);
    expect(orcaLine(out.stdout)).toContain("Orca is not installed.");
    expect(orcaLine(out.stdout)).toContain("https://github.com/stablyai/orca/releases");
    expect(code).toBe(0);
  });

  it("prints the version and skips the trackers when Orca is not running", async () => {
    const { out, io, full, calls } = setup({
      ...orcaConnected,
      [STATUS]: json("orca-status-closed"),
    });
    const code = await doctor(io, full);
    expect(orcaLine(out.stdout)).toBe(
      "Orca (optional): 1.4.262, installed but not running. Trackers were not checked.",
    );
    expect(calls).not.toContain(JIRA);
    expect(calls).not.toContain(LINEAR);
    expect(code).toBe(0);
  });

  it("treats a failed status command as not running", async () => {
    const { out, io, full, calls } = setup({
      ...orcaConnected,
      [STATUS]: { kind: "failed", exitCode: 1 },
    });
    await doctor(io, full);
    expect(orcaLine(out.stdout)).toContain("installed but not running");
    expect(calls).not.toContain(JIRA);
  });

  it("adds no tracker for empty connection lists", async () => {
    const { out, io, full } = setup({
      ...orcaConnected,
      [JIRA]: json("orca-jira-empty"),
      [LINEAR]: json("orca-linear-empty"),
    });
    await doctor(io, full);
    expect(orcaLine(out.stdout)).toBe("Orca (optional): 1.4.262, running. Trackers: none");
  });

  it("prints Linear (connection error) when no team comes with a workspace error", async () => {
    const { out, io, full } = setup({
      ...orcaConnected,
      [JIRA]: json("orca-jira-empty"),
      [LINEAR]: json("orca-linear-error"),
    });
    await doctor(io, full);
    expect(orcaLine(out.stdout)).toBe(
      "Orca (optional): 1.4.262, running. Trackers: Linear (connection error)",
    );
  });

  it("adds no tracker for an answer that is not valid JSON or has ok false", async () => {
    const { out, io, full } = setup({
      ...orcaConnected,
      [JIRA]: { kind: "ok", stdout: "not json" },
      [LINEAR]: { kind: "ok", stdout: '{"ok":false,"result":{"teams":[{"key":"A"}]}}' },
    });
    await doctor(io, full);
    expect(orcaLine(out.stdout)).toBe("Orca (optional): 1.4.262, running. Trackers: none");
  });

  it("runs only version, status and list commands", async () => {
    const { io, full, calls } = setup(orcaConnected);
    await doctor(io, full);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(ALLOWED.has(call)).toBe(true);
    expect(calls.join("\n")).not.toMatch(/orca (open|serve)|install/);
  });

  it("never prints a site, email, team or workspace from an answer or stderr", async () => {
    const { out, io, full } = setup(orcaConnected);
    await doctor(io, full);
    const all = out.stdout + out.stderr;
    for (const secret of [
      "example.atlassian.net",
      "person@example.com",
      "Example Person",
      "Example Team",
      "Example Workspace",
      "EXA",
    ])
      expect(all).not.toContain(secret);
  });
});

describe("nodeIsTooOld", () => {
  it("compares major, minor and patch", () => {
    expect(nodeIsTooOld("17.9.9", ">=18")).toBe(true);
    expect(nodeIsTooOld("18.0.0", ">=18")).toBe(false);
    expect(nodeIsTooOld("18.1.0", ">=18.2")).toBe(true);
    expect(nodeIsTooOld("18.2.0", ">=18.2")).toBe(false);
    expect(nodeIsTooOld("18.2.3", ">=18.2.4")).toBe(true);
    expect(nodeIsTooOld("19.0.0", ">=18.2.4")).toBe(false);
  });

  it("throws on a form it does not understand", () => {
    expect(() => nodeIsTooOld("18.0.0", "^18")).toThrow();
    expect(() => nodeIsTooOld("18.0.0", ">=18 <28")).toThrow();
  });

  it("understands the engines.node of the real package.json", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { engines: { node: string } };
    expect(() => nodeIsTooOld("99.0.0", pkg.engines.node)).not.toThrow();
  });
});
