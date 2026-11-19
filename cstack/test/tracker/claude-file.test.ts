import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claudeFileTracker } from "../../src/tracker/claude-file.js";
import { InvalidFileError, NoClientError } from "../../src/tracker/errors.js";
import type { Ticket } from "../../src/tracker/types.js";
import { FakeTracker } from "../fakes/tracker.js";

const ticket = (key: string, extra: Partial<Ticket> = {}): Ticket => ({
  key,
  title: "t",
  body: "b",
  url: `https://example.test/${key}`,
  stateName: "Todo",
  stateKind: "todo",
  blockers: [{ key: "ABC-1", stateKind: "finished" }],
  ...extra,
});

function write(content: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "cstack-file-")), "tickets.json");
  writeFileSync(path, JSON.stringify(content));
  return path;
}
const file = (over: Record<string, unknown> = {}) => ({
  format: "cstack-tracker/1",
  tracker: "jira",
  group: { milestone: "M3" },
  tickets: [ticket("ABC-2")],
  ...over,
});

describe("file that Claude writes", () => {
  it("refuses an unknown key and names it", async () => {
    const tracker = claudeFileTracker(write(file({ extra: 1 })), "jira");
    const error = await tracker.readTicket("ABC-2").catch((e) => e);
    expect(error).toBeInstanceOf(InvalidFileError);
    expect(error.exitCode).toBe(3);
    expect(error.message).toContain("extra");
  });

  it("refuses an unknown key inside a ticket and a blocker", async () => {
    const bad = ticket("ABC-2") as unknown as Record<string, unknown>;
    bad.colour = "red";
    await expect(claudeFileTracker(write(file({ tickets: [bad] })), "jira").readTicket("ABC-2")).rejects.toThrow(/colour/);
    const bad2 = ticket("ABC-2", { blockers: [{ key: "ABC-1", stateKind: "todo", more: 1 } as never] });
    await expect(claudeFileTracker(write(file({ tickets: [bad2] })), "jira").readTicket("ABC-2")).rejects.toThrow(/more/);
  });

  it("refuses an unknown format version", async () => {
    await expect(claudeFileTracker(write(file({ format: "cstack-tracker/2" })), "jira").readTicket("ABC-2")).rejects.toThrow(
      /cstack-tracker\/2/,
    );
  });

  it("refuses a file written for another tracker", async () => {
    await expect(claudeFileTracker(write(file({ tracker: "linear" })), "jira").readTicket("ABC-2")).rejects.toThrow(/linear/);
  });

  it("lists only for its own group", async () => {
    const path = write(file());
    const tracker = claudeFileTracker(path, "jira");
    expect((await tracker.listGroup({ milestone: "M3" })).map((t) => t.key)).toEqual(["ABC-2"]);
    await expect(tracker.listGroup({ milestone: "M4" })).rejects.toBeInstanceOf(InvalidFileError);
    await expect(tracker.listGroup({ epic: "ABC-9" })).rejects.toBeInstanceOf(InvalidFileError);
    const noGroup = claudeFileTracker(write(file({ group: undefined })), "jira");
    await expect(noGroup.listGroup({ milestone: "M3" })).rejects.toBeInstanceOf(InvalidFileError);
    expect((await noGroup.readTicket("ABC-2")).key).toBe("ABC-2");
  });

  it("skips a ticket with a bad key and warns", async () => {
    const warnings: string[] = [];
    const tracker = claudeFileTracker(write(file({ tickets: [ticket("ABC-2"), ticket("bad key")] })), "jira", (m) => warnings.push(m));
    expect((await tracker.listGroup({ milestone: "M3" })).map((t) => t.key)).toEqual(["ABC-2"]);
    expect(warnings).toHaveLength(1);
  });

  it("skips a ticket with a bad blocker key and warns", async () => {
    const warnings: string[] = [];
    const hostile = ticket("ABC-3", { blockers: [{ key: "ABC-1 $(x)", stateKind: "todo" }] });
    const tracker = claudeFileTracker(write(file({ tickets: [ticket("ABC-2"), hostile] })), "jira", (m) => warnings.push(m));
    expect((await tracker.listGroup({ milestone: "M3" })).map((t) => t.key)).toEqual(["ABC-2"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("blocker");
    await expect(tracker.readTicket("ABC-3")).rejects.toBeInstanceOf(InvalidFileError);
  });

  it("raises the no-client error for a move and a comment", async () => {
    const tracker = claudeFileTracker(write(file()), "jira");
    await expect(tracker.moveState("ABC-2", "Done")).rejects.toThrow(NoClientError);
    await expect(tracker.moveState("ABC-2", "Done")).rejects.toThrow(/ABC-2.*Done/);
    await expect(tracker.addComment("ABC-2", "/tmp/b.md")).rejects.toThrow(/\/tmp\/b\.md/);
  });

  it("gives the same tickets as the fake tracker", async () => {
    const tickets = [ticket("ABC-2"), ticket("ABC-3", { blockers: "unknown" })];
    const fake = new FakeTracker({ tickets, groups: [{ group: { milestone: "M3" }, keys: ["ABC-2", "ABC-3"] }] });
    const real = claudeFileTracker(write(file({ tickets })), "jira");
    expect(await real.listGroup({ milestone: "M3" })).toEqual(await fake.listGroup({ milestone: "M3" }));
    expect(await real.readTicket("ABC-3")).toEqual(await fake.readTicket("ABC-3"));
  });
});
