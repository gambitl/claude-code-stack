import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Runner } from "../../src/orca/run.js";
import { openTracker } from "../../src/tracker/open.js";

const dir = mkdtempSync(join(tmpdir(), "cstack-open-"));
const ticket = (key: string) => ({
  key,
  title: "t",
  body: "b",
  url: `https://example.test/${key}`,
  stateName: "Todo",
  stateKind: "todo",
  blockers: [],
});
function write(name: string, tracker: string, group: unknown, keys: string[]): string {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify({ format: "cstack-tracker/1", tracker, group, tickets: keys.map(ticket) }));
  return path;
}
const run: Runner = async (command, args) =>
  command === "git" && args.join(" ") === "remote get-url origin"
    ? { kind: "ok", stdout: "https://github.com/example/repo.git\n" }
    : { kind: "missing" };

describe("openTracker with a file from Claude", () => {
  it("takes the tracker from the origin remote and lists the group", async () => {
    const fromFile = write("gh.json", "github", { milestone: "M3" }, ["#1", "#2"]);
    const tracker = await openTracker("list", { root: dir, fromFile, run, env: {}, warn: () => {} });
    const tickets = await tracker.listGroup({ milestone: "M3" });
    expect(tickets.map((t) => t.key)).toEqual(["#1", "#2"]);
  });

  it("reads a ticket of a named tracker", async () => {
    const fromFile = write("jira.json", "jira", { milestone: "M3" }, ["ABC-12"]);
    const tracker = await openTracker("read", { root: dir, tracker: "jira", fromFile, run, env: {}, warn: () => {} });
    expect((await tracker.readTicket("ABC-12")).key).toBe("ABC-12");
  });
});
