import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trackerMove } from "../../src/commands/tracker-move.js";
import { trackerRead } from "../../src/commands/tracker-read.js";
import type { RunResult, Runner } from "../../src/orca/run.js";

const dir = join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263");
const ok = (file: string): RunResult => ({ kind: "ok", stdout: readFileSync(join(dir, file), "utf8") });

// The answers that the Orca feature check needs, with one Jira site and one Linear team.
const FEATURES: Record<string, RunResult> = {
  "orca --version": ok("version.current.txt"),
  "orca status --json": ok("status.running.json"),
  "orca agent-context --json": ok("agent-context.current.json"),
  "orca jira connection --json": ok("jira-connection.one-site.json"),
  "orca linear team list --workspace all --json": ok("linear-team-list.connected.json"),
};

function setup(answers: Record<string, RunResult>) {
  const calls: string[] = [];
  const run: Runner = async (command, args) => {
    const line = [command, ...args].join(" ");
    calls.push(line);
    if (line === "git rev-parse --show-toplevel") return { kind: "ok", stdout: "/repo\n" };
    const answer = answers[line] ?? FEATURES[line];
    return answer ?? { kind: "failed", exitCode: 1, stderr: `unexpected call: ${line}` };
  };
  const out = { stdout: "", stderr: "" };
  const io = { stdout: (t: string) => void (out.stdout += t), stderr: (t: string) => void (out.stderr += t) };
  return { calls, out, io, deps: { cwd: "/repo", run, env: {} } };
}

describe("cstack tracker read reaches Jira and Linear through Orca", () => {
  it("reads a Jira ticket through the Jira adapter", async () => {
    const { calls, out, io, deps } = setup({ "orca jira issue EXA-2 --json": ok("jira-issue.in-progress.json") });
    expect(await trackerRead(["EXA-2", "--tracker", "jira"], io, deps)).toBe(0);
    expect(calls).toContain("orca jira issue EXA-2 --json");
    expect(calls.some((c) => c.startsWith("git config"))).toBe(false);
    const ticket = JSON.parse(out.stdout);
    expect(ticket.key).toBe("EXA-2");
    expect(ticket.stateName).toBe("In Progress");
    expect(ticket.stateKind).toBe("in-progress");
  });

  it("reads a Linear ticket through the Linear adapter", async () => {
    const { calls, out, io, deps } = setup({
      "orca linear issue EXA-1 --relations --json": ok("linear-issue.blocked.json"),
      "orca linear issue EXA-2 --relations --json": ok("linear-issue.done.json"),
    });
    expect(await trackerRead(["EXA-1", "--tracker", "linear"], io, deps)).toBe(0);
    expect(calls).toContain("orca linear issue EXA-1 --relations --json");
    const ticket = JSON.parse(out.stdout);
    expect(ticket.key).toBe("EXA-1");
    expect(ticket.blockers).toEqual([{ key: "EXA-2", stateKind: "finished" }]);
  });

  it("refuses a bad Jira key before any call to an issue", async () => {
    const { calls, io, deps } = setup({});
    expect(await trackerRead(["EXA-1; rm -rf ~", "--tracker", "jira"], io, deps)).toBe(1);
    expect(calls.some((c) => c.startsWith("orca jira issue"))).toBe(false);
  });

  it("exits with 4 and gives the reason when Orca cannot reach Jira", async () => {
    const { calls, out, io, deps } = setup({ "orca jira connection --json": ok("jira-connection.empty.json") });
    expect(await trackerRead(["EXA-2", "--tracker", "jira"], io, deps)).toBe(4);
    expect(out.stderr).toContain("Orca has no saved Jira site.");
    expect(out.stderr).toContain("--from-file");
    expect(out.stderr).not.toContain("#25");
    expect(calls.some((c) => c.startsWith("orca jira issue"))).toBe(false);
  });

  it("exits with 4 for a Linear move when Orca cannot reach Linear, and prints the key and the state", async () => {
    const { out, io, deps } = setup({ "orca linear team list --workspace all --json": ok("linear-team-list.empty.json") });
    expect(await trackerMove(["EXA-1", "--to", "Done", "--tracker", "linear"], io, deps)).toBe(4);
    expect(out.stderr).toContain("EXA-1");
    expect(out.stderr).toContain("Done");
  });
});
