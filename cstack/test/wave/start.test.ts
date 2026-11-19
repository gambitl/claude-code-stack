import { describe, expect, it } from "vitest";
import { startTicket, type StartContext } from "../../src/wave/start.js";
import type { Runner } from "../../src/orca/run.js";
import type { Tracker } from "../../src/tracker/types.js";
import { ticket } from "../helpers/wave.js";

function setup(found: ReturnType<typeof ticket>, options: { branchExists?: boolean; signal?: AbortSignal } = {}) {
  const started: unknown[][] = [];
  const reader = { readTicket: async () => found } as unknown as Tracker;
  const run: Runner = async () => (options.branchExists ? { kind: "ok", stdout: "" } : { kind: "failed", stderr: "", code: 1 } as never);
  const context: StartContext = {
    reader,
    check: { check: async () => ({ found: false }) },
    start: async (...args) => {
      started.push(args);
      return { kind: "started", line: "started it" };
    },
    run,
    root: "/nowhere",
    tracker: "jira",
    signal: options.signal,
  };
  return { context, started };
}

describe("startTicket", () => {
  it("skips a ticket that is no longer ready and never calls the starter", async () => {
    const { context, started } = setup(
      ticket("ABC-12", { blockers: [{ key: "ABC-1", stateKind: "todo" }] }),
    );
    expect(await startTicket("ABC-12", context)).toEqual({
      kind: "skipped",
      line: "ABC-12  skipped, it is no longer ready (blocked by ABC-1 (to do)).\n",
    });
    expect(started).toEqual([]);
  });

  it("rejects with an AbortError when the stop signal is already aborted", async () => {
    const { context, started } = setup(ticket("ABC-12"), { signal: AbortSignal.abort() });
    await expect(startTicket("ABC-12", context)).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toEqual([]);
  });

  it("gives the key, the short name and the url to the starter when the branch does not exist", async () => {
    const found = ticket("ABC-12");
    const { context, started } = setup(found);
    const report = await startTicket("ABC-12", context);
    expect(started).toEqual([["ABC-12", "abc-12", found.url]]);
    expect(report).toEqual({ kind: "started", line: "ABC-12  started it\n" });
  });
});
