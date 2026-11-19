import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
        r.meta.includeErrors = [{ include: "relations", code: "ERR", message: "failed" }];
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

describe("linear through orca: list", () => {
  const list = "linear list-issues --parent-id EXA-9 --json";
  const three = "linear issue EXA-3 --relations --json";

  it("lists an epic without a limit, then reads each ticket", async () => {
    const { run, calls } = fakeOrcaRun({
      [list]: answer("linear-list-issues.epic.json"),
      [one]: answer("linear-issue.blocked.json"),
      [two]: answer("linear-issue.done.json"),
      [three]: answer("linear-issue.done.json", (r) => {
        r.issue.identifier = "EXA-3";
        r.relations = [];
      }),
    });
    const tickets = await linearOrcaTracker(run, {}).listGroup({ epic: "EXA-9" });
    expect(calls[0]).toEqual(["linear", "list-issues", "--parent-id", "EXA-9", "--json"]);
    expect(calls.flat()).not.toContain("--limit");
    expect(tickets.map((t) => t.key)).toEqual(["EXA-1", "EXA-3"]);
    expect(tickets[0]!.stateKind).toBe("in-progress");
    expect(tickets[0]!.blockers).toEqual([{ key: "EXA-2", stateKind: "finished" }]);
  });

  it("reads a blocker that is also in the list from the list, not again", async () => {
    const { run, calls } = fakeOrcaRun({
      [list]: answer("linear-list-issues.epic.json", (r) => {
        r.issues[1].identifier = "EXA-2";
      }),
      [one]: answer("linear-issue.blocked.json"),
      [two]: answer("linear-issue.done.json"),
    });
    const tickets = await linearOrcaTracker(run, {}).listGroup({ epic: "EXA-9" });
    expect(calls.filter((c) => c.join(" ") === two)).toHaveLength(1);
    expect(tickets[0]!.blockers).toEqual([{ key: "EXA-2", stateKind: "todo" }]);
  });

  it("refuses a listed identifier that is not a key, with no Orca call for it", async () => {
    const { run, calls } = fakeOrcaRun({
      [list]: answer("linear-list-issues.epic.json", (r) => {
        r.issues[0].identifier = "--bad";
      }),
    });
    await expect(linearOrcaTracker(run, {}).listGroup({ epic: "EXA-9" })).rejects.toMatchObject({ exitCode: 1 });
    expect(calls.map((c) => c.join(" ")).filter((c) => c.startsWith("linear issue"))).toEqual([]);
  });

  it("reads a blocker that cannot be read only once", async () => {
    const { run, calls } = fakeOrcaRun({
      [list]: answer("linear-list-issues.epic.json"),
      [one]: answer("linear-issue.blocked.json"),
      [two]: { kind: "failed", exitCode: 1 },
      [three]: answer("linear-issue.blocked.json", (r) => {
        r.issue.identifier = "EXA-3";
      }),
    });
    const tickets = await linearOrcaTracker(run, {}).listGroup({ epic: "EXA-9" });
    expect(tickets.map((t) => t.blockers)).toEqual([[{ key: "EXA-2", stateKind: "unknown" }], [{ key: "EXA-2", stateKind: "unknown" }]]);
    expect(calls.filter((c) => c.join(" ") === two)).toHaveLength(1);
  });

  it("refuses a truncated list with exit 1", async () => {
    const { run } = fakeOrcaRun({ [list]: answer("linear-list-issues.truncated.json") });
    await expect(linearOrcaTracker(run, {}).listGroup({ epic: "EXA-9" })).rejects.toMatchObject({ exitCode: 1 });
  });

  it("stops with exit 5 on a partial answer", async () => {
    const { run } = fakeOrcaRun({
      [list]: answer("linear-list-issues.epic.json", (r) => {
        r.meta.partial = true;
      }),
    });
    await expect(linearOrcaTracker(run, {}).listGroup({ epic: "EXA-9" })).rejects.toMatchObject({ exitCode: 5 });
  });

  it("sends a milestone back to Claude before any Orca call", async () => {
    const { run, calls } = fakeOrcaRun({});
    await expect(linearOrcaTracker(run, {}).listGroup({ milestone: "Wave 1" })).rejects.toMatchObject({
      exitCode: 4,
      message: expect.stringContaining("milestone"),
    });
    expect(calls).toHaveLength(0);
  });
});

describe("linear through orca: write", () => {
  const states = "linear team states --team EXA --json";
  const issueOne = () => answer("linear-issue.blocked.json");
  const states_ = () => ({ kind: "ok", stdout: readFileSync(join(dir, "linear-team-states.current.json"), "utf8") }) as RunResult;
  const setIt = "linear status set EXA-1 --to In Review --json";
  const setOk = () => ({ kind: "ok", stdout: readFileSync(join(dir, "linear-status-set.ok.json"), "utf8") }) as RunResult;
  const body = (content: string): string => {
    const p = join(mkdtempSync(join(tmpdir(), "linear-comment-")), "body.md");
    writeFileSync(p, content);
    return p;
  };

  it("refuses a state that the team does not have, lists the states, and runs no status set", async () => {
    const { run, calls } = fakeOrcaRun({ [one]: issueOne(), [states]: states_() });
    const e = await linearOrcaTracker(run, {}).moveState("EXA-1", "Blocked").catch((x) => x);
    expect(e.exitCode).toBe(1);
    expect(e.message).toContain("In Review");
    expect(calls).toEqual([
      ["linear", "issue", "EXA-1", "--relations", "--json"],
      ["linear", "team", "states", "--team", "EXA", "--json"],
    ]);
  });

  it("sets a known state with the name as one argument", async () => {
    const { run, calls } = fakeOrcaRun({ [one]: issueOne(), [states]: states_(), [setIt]: setOk() });
    await linearOrcaTracker(run, {}).moveState("EXA-1", "In Review");
    expect(calls.at(-1)).toEqual(["linear", "status", "set", "EXA-1", "--to", "In Review", "--json"]);
  });

  it("takes the team from the answer, not from the key", async () => {
    const { run, calls } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json", (r) => {
        r.issue.team.key = "OTH";
      }),
      "linear team states --team OTH --json": states_(),
      [setIt]: setOk(),
    });
    await linearOrcaTracker(run, {}).moveState("EXA-1", "In Review");
    expect(calls[1]).toEqual(["linear", "team", "states", "--team", "OTH", "--json"]);
  });

  it("refuses a team key that is not safe, with no states call", async () => {
    const { run, calls } = fakeOrcaRun({
      [one]: answer("linear-issue.blocked.json", (r) => {
        r.issue.team.key = "--bad";
      }),
    });
    await expect(linearOrcaTracker(run, {}).moveState("EXA-1", "In Review")).rejects.toMatchObject({ exitCode: 1 });
    expect(calls).toHaveLength(1);
  });

  it("adds a comment from a file", async () => {
    const p = body("Hello");
    const { run, calls } = fakeOrcaRun({
      [`linear comment add EXA-1 --body-file ${p} --json`]: {
        kind: "ok",
        stdout: readFileSync(join(dir, "linear-comment-add.ok.json"), "utf8"),
      } as RunResult,
    });
    await linearOrcaTracker(run, {}).addComment("EXA-1", p);
    expect(calls).toEqual([["linear", "comment", "add", "EXA-1", "--body-file", p, "--json"]]);
  });

  it("refuses a body of 65001 characters with no call", async () => {
    const { run, calls } = fakeOrcaRun({});
    await expect(linearOrcaTracker(run, {}).addComment("EXA-1", body("x".repeat(65001)))).rejects.toMatchObject({ exitCode: 1 });
    expect(calls).toEqual([]);
  });
});
