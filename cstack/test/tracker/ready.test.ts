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
    expect(readyState(t)).toEqual({
      kind: "blocked",
      reason: "blocked-by",
      blockers: ["ABC-2"],
    });
  });

  it("is ready when every blocker is finished", () => {
    const t = ticket("todo", [{ key: "ABC-2", stateKind: "finished" }]);
    expect(readyState(t)).toEqual({ kind: "ready" });
    expect(readyState(ticket("todo", []))).toEqual({ kind: "ready" });
  });

  it("calls a ticket in progress started", () => {
    expect(readyState(ticket("in-progress", []))).toEqual({ kind: "started" });
  });

  it("blocks unknown states and unknown blockers, never ready", () => {
    expect(readyState(ticket("unknown", []))).toEqual({
      kind: "blocked",
      reason: "unknown-state",
    });
    expect(readyState(ticket("todo", "unknown"))).toEqual({
      kind: "blocked",
      reason: "unknown-blockers",
    });
    const t = ticket("todo", [{ key: "ABC-2", stateKind: "unknown" }]);
    expect(readyState(t)).toEqual({
      kind: "blocked",
      reason: "blocked-by",
      blockers: ["ABC-2"],
    });
  });

  it("leaves out a finished ticket", () => {
    expect(readyState(ticket("finished", []))).toEqual({ kind: "left-out" });
  });

  it("takes only the ticket", () => {
    expect(readyState.length).toBe(1);
  });
});
