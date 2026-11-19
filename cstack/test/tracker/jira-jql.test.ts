import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../src/orca/run.js";
import { RefusedArgumentError } from "../../src/tracker/errors.js";
import { jiraGroupQuery, jiraOrcaTracker } from "../../src/tracker/jira-orca.js";
import { fakeOrcaRun } from "../fakes/orca-run.js";

const dir = join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263");
const fixture = (file: string): RunResult => ({ kind: "ok", stdout: readFileSync(join(dir, file), "utf8") });

function list(keys: string[]): RunResult {
  const answer = JSON.parse(readFileSync(join(dir, "jira-search.epic.json"), "utf8"));
  const template = answer.result[0];
  answer.result = keys.map((key) => ({ ...template, key, description: `Text of ${key}.` }));
  return { kind: "ok", stdout: JSON.stringify(answer) };
}

describe("jira group query", () => {
  it("builds the two queries", () => {
    expect(jiraGroupQuery({ milestone: "M3" })).toBe('fixVersion = "M3" ORDER BY key');
    expect(jiraGroupQuery({ epic: "EXA-9" })).toBe("parent = EXA-9 ORDER BY key");
  });

  it.each([
    ["a double quote", 'M3 "x"'],
    ["a backslash", "M3\\x"],
    ["a newline", "M3\nx"],
    ["an empty name", ""],
    ["101 characters", "a".repeat(101)],
  ])("refuses a milestone with %s before any Orca call", async (_why, milestone) => {
    const { run, calls } = fakeOrcaRun({});
    await expect(jiraOrcaTracker(run, {}).listGroup({ milestone })).rejects.toBeInstanceOf(RefusedArgumentError);
    expect(calls).toEqual([]);
  });

  it("runs the epic query as one argument", async () => {
    const { run, calls } = fakeOrcaRun({
      "jira search parent = EXA-9 ORDER BY key --limit 100 --json": fixture("jira-search.epic.json"),
      "jira issue EXA-2 --json": fixture("jira-issue.done.json"),
    });
    const tickets = await jiraOrcaTracker(run, {}).listGroup({ epic: "EXA-9" });
    expect(calls[0]).toEqual(["jira", "search", "parent = EXA-9 ORDER BY key", "--limit", "100", "--json"]);
    expect(tickets.map((t) => t.key)).toEqual(["EXA-2", "EXA-3"]);
  });

  it("refuses an answer of 100 tickets", async () => {
    const keys = Array.from({ length: 100 }, (_, i) => `EXA-${i + 1}`);
    const { run } = fakeOrcaRun({ 'jira search fixVersion = "M3" ORDER BY key --limit 100 --json': list(keys) });
    const promise = jiraOrcaTracker(run, {}).listGroup({ milestone: "M3" });
    await expect(promise).rejects.toThrow(/more tickets than cstack reads through Orca/);
    await expect(promise).rejects.toBeInstanceOf(RefusedArgumentError);
  });

  it("refuses a milestone list with two project prefixes", async () => {
    const { run } = fakeOrcaRun({ 'jira search fixVersion = "M3" ORDER BY key --limit 100 --json': list(["EXA-1", "OTH-2"]) });
    await expect(jiraOrcaTracker(run, {}).listGroup({ milestone: "M3" })).rejects.toBeInstanceOf(RefusedArgumentError);
  });

  it("refuses an empty epic list and names the Epic Link field", async () => {
    const { run } = fakeOrcaRun({ "jira search parent = EXA-9 ORDER BY key --limit 100 --json": list([]) });
    await expect(jiraOrcaTracker(run, {}).listGroup({ epic: "EXA-9" })).rejects.toThrow(/Epic Link/);
  });

  it("takes the state of a blocker from the same list and reads the others once", async () => {
    const answer = JSON.parse(readFileSync(join(dir, "jira-search.epic.json"), "utf8"));
    answer.result[0].description = "x\n**Size: S** · Blocked by: EXA-3, EXA-7";
    answer.result[1].description = "y\n**Size: S** · Blocked by: EXA-7";
    const { run, calls } = fakeOrcaRun({
      "jira search parent = EXA-9 ORDER BY key --limit 100 --json": { kind: "ok", stdout: JSON.stringify(answer) },
      "jira issue EXA-7 --json": fixture("jira-issue.done.json"),
    });
    const tickets = await jiraOrcaTracker(run, {}).listGroup({ epic: "EXA-9" });
    expect(tickets[0].blockers).toEqual([
      { key: "EXA-3", stateKind: tickets[1].stateKind },
      { key: "EXA-7", stateKind: "finished" },
    ]);
    expect(calls.filter((c) => c[2] === "EXA-7")).toHaveLength(1);
  });
});
