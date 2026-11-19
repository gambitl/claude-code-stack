import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trackerMove } from "../../src/commands/tracker-move.js";
import { trackerList } from "../../src/commands/tracker-list.js";
import { trackerRead } from "../../src/commands/tracker-read.js";
import type { Runner } from "../../src/orca/run.js";

function setup() {
  const calls: string[] = [];
  const run: Runner = async (command, args) => {
    const line = [command, ...args].join(" ");
    calls.push(line);
    if (line === "git config --get remote.origin.url") return { kind: "ok", stdout: "https://github.com/example-org/example-repo.git\n" };
    if (line === "git rev-parse --show-toplevel") return { kind: "ok", stdout: "/repo\n" };
    if (command === "gh" && args[0] === "auth") return { kind: "failed", exitCode: 1 };
    if (command === "orca") return { kind: "missing" };
    return { kind: "failed", exitCode: 1, stderr: `unexpected call: ${line}` };
  };
  const out = { stdout: "", stderr: "" };
  const io = { stdout: (t: string) => void (out.stdout += t), stderr: (t: string) => void (out.stderr += t) };
  return { calls, run, out, io, deps: { cwd: "/repo", run, env: {} } };
}

describe("cstack tracker read with no client", () => {
  it("exits with 4 and names the file format, after only login checks and git", async () => {
    const { calls, out, io, deps } = setup();
    expect(await trackerRead(["#7"], io, deps)).toBe(4);
    expect(calls.filter((c) => !c.startsWith("git "))).toEqual(["gh auth status --hostname github.com"]);
    expect(out.stderr).toContain("cstack-tracker/1");
    expect(out.stderr).toContain("--from-file");
    expect(out.stdout).toBe("");
  });

  it("prints the ticket from --from-file as JSON, with no client call", async () => {
    const { calls, out, io, deps } = setup();
    const file = join(mkdtempSync(join(tmpdir(), "cstack-")), "t.json");
    const ticket = { key: "#7", title: "T", body: "B", url: "https://github.com/example-org/example-repo/issues/7", stateName: "open", stateKind: "todo", blockers: [] };
    writeFileSync(file, JSON.stringify({ format: "cstack-tracker/1", tracker: "github", tickets: [ticket] }));
    expect(await trackerRead(["#7", "--from-file", file], io, deps)).toBe(0);
    expect(JSON.parse(out.stdout)).toEqual(ticket);
    expect(out.stdout.endsWith("}\n")).toBe(true);
    expect(calls.some((c) => c.startsWith("gh"))).toBe(false);
  });

  it("reads and lists from --from-file with no --tracker in a clone that has no origin", async () => {
    const calls: string[] = [];
    const run: Runner = async (command, args) => {
      calls.push([command, ...args].join(" "));
      return command === "git" && args[0] === "config" ? { kind: "failed", exitCode: 1 } : { kind: "failed", exitCode: 1, stderr: "unexpected" };
    };
    const out = { stdout: "", stderr: "" };
    const io = { stdout: (t: string) => void (out.stdout += t), stderr: (t: string) => void (out.stderr += t) };
    const file = join(mkdtempSync(join(tmpdir(), "cstack-")), "t.json");
    const ticket = { key: "#7", title: "T", body: "B", url: "https://github.com/example-org/example-repo/issues/7", stateName: "open", stateKind: "todo", blockers: [] };
    writeFileSync(file, JSON.stringify({ format: "cstack-tracker/1", tracker: "github", group: { milestone: "m" }, tickets: [ticket] }));
    const deps = { cwd: "/repo", run, env: {} };
    expect(await trackerRead(["#7", "--from-file", file], io, deps)).toBe(0);
    expect(await trackerList(["--milestone", "m", "--from-file", file], io, deps)).toBe(0);
    expect(out.stderr).toBe("");
    expect(calls.filter((c) => c.startsWith("git config"))).toEqual([]);
  });

  it("gives a usage error with the quoting hint when the key is missing, and for a bad --tracker", async () => {
    const { out, io, deps } = setup();
    expect(await trackerRead([], io, deps)).toBe(2);
    expect(out.stderr).toContain("'#12'");
    expect(out.stderr).toContain("Usage: cstack tracker read <key>");
    expect(await trackerRead(["#7", "--tracker", "svn"], io, deps)).toBe(2);
  });
});

describe("cstack tracker move with no client", () => {
  it("writes nothing, exits with 4 and names the key and the state name", async () => {
    const { calls, out, io, deps } = setup();
    expect(await trackerMove(["#12", "--to", "in progress"], io, deps)).toBe(4);
    expect(out.stderr).toContain("#12");
    expect(out.stderr).toContain("in progress");
    expect(out.stdout).toBe("");
    expect(calls.some((c) => c.startsWith("gh issue"))).toBe(false);
  });

  it("still exits with 1 for a bad key or a bad state name, and with 2 for a missing key or --to", async () => {
    const { out, io, deps } = setup();
    expect(await trackerMove(["12", "--to", "in progress"], io, deps)).toBe(1);
    expect(await trackerMove(["#12", "--to", "done"], io, deps)).toBe(1);
    expect(await trackerMove([], io, deps)).toBe(2);
    expect(out.stderr).toContain("'#12'");
    expect(await trackerMove(["#12"], io, deps)).toBe(2);
    expect(await trackerMove(["#12", "--to", "in progress", "--from-file", "x"], io, deps)).toBe(2);
  });
});
