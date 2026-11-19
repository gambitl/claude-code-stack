import { describe, expect, it } from "vitest";
import { NoClientError } from "../../src/tracker/errors.js";
import type { Ticket } from "../../src/tracker/types.js";
import { FakeTracker } from "../fakes/tracker.js";

const ticket = (key: string, stateName = "Todo"): Ticket => ({
  key,
  title: "t",
  body: "b",
  url: `https://example.test/${key}`,
  stateName,
  stateKind: "todo",
  blockers: [],
});

describe("fake tracker", () => {
  it("reads back a move with its key and state name", async () => {
    const fake = new FakeTracker({ tickets: [ticket("ABC-1")] });
    await fake.moveState("ABC-1", "Done");
    expect(fake.moves).toEqual([{ key: "ABC-1", stateName: "Done" }]);
    expect((await fake.readTicket("ABC-1")).stateName).toBe("Done");
  });

  it("reads back comments", async () => {
    const fake = new FakeTracker({ tickets: [ticket("ABC-1")] });
    await fake.addComment("ABC-1", "/tmp/body.md");
    expect(fake.comments).toEqual([{ key: "ABC-1", bodyFile: "/tmp/body.md" }]);
  });

  it("lists the tickets of a group", async () => {
    const fake = new FakeTracker({
      tickets: [ticket("ABC-1"), ticket("ABC-2")],
      groups: [{ group: { milestone: "Wave 1" }, keys: ["ABC-2"] }],
    });
    expect((await fake.listGroup({ milestone: "Wave 1" })).map((t) => t.key)).toEqual(["ABC-2"]);
    expect(await fake.listGroup({ epic: "ABC-9" })).toEqual([]);
  });

  it("raises the no-client error for a capability switched off", async () => {
    const fake = new FakeTracker({ tickets: [ticket("ABC-1")], off: ["move", "comment", "read", "list"] });
    for (const call of [
      () => fake.moveState("ABC-1", "Done"),
      () => fake.addComment("ABC-1", "f.md"),
      () => fake.readTicket("ABC-1"),
      () => fake.listGroup({ milestone: "m" }),
    ]) {
      const error = await call().catch((e) => e);
      expect(error).toBeInstanceOf(NoClientError);
      expect(error.exitCode).toBe(4);
    }
    expect(fake.moves).toEqual([]);
  });
});
