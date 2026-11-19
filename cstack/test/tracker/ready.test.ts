import { describe, expect, it } from "vitest";
import { readyState } from "../../src/tracker/ready.js";
import type { StateKind, Ticket } from "../../src/tracker/types.js";

function ticket(
  stateKind: StateKind,
  blockers: Ticket["blockers"],
): Ticket {
  return {
    key: "ABC-1",
    title: "t",
    body: "",
    url: "https://example.com/ABC-1",
    stateName: "x",
    stateKind,
    blockers,
  };
}

describe("readyState", () => {
  it("blocks a ticket whose only blocker is in review", () => {
    const t = ticket("todo", [{ key: "ABC-2", stateKind: "in-progress" }]);
    expect(readyState(t, false)).toEqual({
      kind: "blocked",
      reason: "blocked-by",
      blockers: ["ABC-2"],
    });
  });

  it("is ready when every blocker is finished", () => {
    const t = ticket("todo", [{ key: "ABC-2", stateKind: "finished" }]);
    expect(readyState(t, false)).toEqual({ kind: "ready" });
    expect(readyState(ticket("todo", []), false)).toEqual({ kind: "ready" });
  });

  it("calls a ticket in progress or with a worktree started", () => {
    expect(readyState(ticket("in-progress", []), false)).toEqual({ kind: "started" });
    expect(readyState(ticket("todo", []), true)).toEqual({ kind: "started" });
  });

  it("blocks unknown states and unknown blockers, never ready", () => {
    expect(readyState(ticket("unknown", []), false)).toEqual({
      kind: "blocked",
      reason: "unknown-state",
    });
    expect(readyState(ticket("todo", "unknown"), false)).toEqual({
      kind: "blocked",
      reason: "unknown-blockers",
    });
    const t = ticket("todo", [{ key: "ABC-2", stateKind: "unknown" }]);
    expect(readyState(t, false)).toEqual({
      kind: "blocked",
      reason: "blocked-by",
      blockers: ["ABC-2"],
    });
  });

  it("leaves out a finished ticket", () => {
    expect(readyState(ticket("finished", []), true)).toEqual({ kind: "left-out" });
  });
});
