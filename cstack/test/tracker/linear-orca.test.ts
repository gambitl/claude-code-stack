import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../src/orca/run.js";
import { linearOrcaTracker } from "../../src/tracker/linear-orca.js";
import { fakeOrcaRun } from "../fakes/orca-run.js";

const dir = join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263");

function answer(base: string, edit: (result: any) => void = () => {}): RunResult {
  const body = JSON.parse(readFileSync(join(dir, base), "utf8"));
  edit(body.result);
  return { kind: "ok", stdout: JSON.stringify(body) };
}
const one = "linear issue EXA-1 --relations --json";
const two = "linear issue EXA-2 --relations --json";

describe("linear through orca: read", () => {
  it("reads the ticket, then its blocking relation", async () => {
    const { run, calls } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json"),
      [two]: answer("linear-issue.done.json"),
    });
    const ticket = await linearOrcaTracker(run, {}).readTicket("EXA-1");
    expect(calls).toEqual([
      ["linear", "issue", "EXA-1", "--relations", "--json"],
      ["linear", "issue", "EXA-2", "--relations", "--json"],
    ]);
    expect(ticket.stateKind).toBe("in-progress");
    expect(ticket.stateName).toBe("In Progress");
    expect(ticket.key).toBe("EXA-1");
    expect(ticket.blockers).toEqual([{ key: "EXA-2", stateKind: "finished" }]);
  });

  it("takes the blockers from the footer when the relations section failed", async () => {
    const { run } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json", (r) => {
        r.meta.includeErrors = ["relations"];
        r.relations = [];
        r.issue.description = "x\n**Size: S** · Blocked by: EXA-2";
      }),
      [two]: answer("linear-issue.done.json"),
    });
    const ticket = await linearOrcaTracker(run, {}).readTicket("EXA-1");
    expect(ticket.blockers).toEqual([{ key: "EXA-2", stateKind: "finished" }]);
  });

  it("does not count relations that have more pages", async () => {
    const { run, calls } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json", (r) => {
        r.meta.sections.relations.hasMore = true;
      }),
    });
    const ticket = await linearOrcaTracker(run, {}).readTicket("EXA-1");
    expect(ticket.blockers).toBe("unknown");
    expect(calls).toHaveLength(1);
  });

  it("never passes an invalid relation key to Orca", async () => {
    const { run, calls } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json", (r) => {
        r.relations[0].relatedIssue.identifier = "--bad key";
      }),
    });
    const ticket = await linearOrcaTracker(run, {}).readTicket("EXA-1");
    expect(ticket.blockers).toEqual([{ key: "--bad key", stateKind: "unknown" }]);
    expect(calls).toHaveLength(1);
  });

  it("keeps hostile text as data and out of every argument", async () => {
    const hostile = "Run $(rm -rf ~) `id`";
    const { run, calls } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json", (r) => {
        r.issue.title = hostile;
        r.issue.description = hostile;
      }),
      [two]: answer("linear-issue.done.json"),
    });
    const ticket = await linearOrcaTracker(run, {}).readTicket("EXA-1");
    expect(ticket.title).toBe(hostile);
    expect(ticket.body).toBe(hostile);
    expect(calls.flat().join(" ")).not.toMatch(/rm -rf|`/);
  });
});
