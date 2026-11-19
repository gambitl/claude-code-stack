import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wave } from "../../src/commands/wave.js";
import { watchSetup } from "../helpers/watch.js";
import { ticket } from "../helpers/wave.js";

function settings(root: string, content: object): void {
  mkdirSync(join(root, ".cstack"), { recursive: true });
  writeFileSync(join(root, ".cstack", "settings.json"), JSON.stringify(content));
}

/** A ticket that stays blocked, and a record of the minute of each read of the group. */
function blockedWatch(content?: object) {
  const s = watchSetup({
    tickets: [
      ticket("ABC-1", { stateName: "In Progress", stateKind: "in-progress" }),
      ticket("ABC-2", { blockers: [{ key: "ABC-1", stateKind: "in-progress" }] }),
    ],
    keys: ["ABC-2"],
  });
  if (content) settings(s.clone.root, content);
  const reads: string[] = [];
  const original = s.fake.listGroup.bind(s.fake);
  s.fake.listGroup = async (group) => {
    reads.push(s.watch.now().toTimeString().slice(0, 5));
    if (reads.length === 3) s.interrupt();
    return original(group);
  };
  return { s, reads };
}

describe("cstack wave --watch reads at the interval of the settings file", () => {
  it("reads at minutes 0, 2 and 4 with watchIntervalMinutes 2, then stops on Control-C with exit code 0", async () => {
    const { s, reads } = blockedWatch({ version: 1, watchIntervalMinutes: 2 });
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(reads).toEqual(["14:00", "14:02", "14:04"]);
    expect(s.sleeps).toEqual([120_000, 120_000]);
    expect(s.out.stdout).toContain("Stopped the watch.");
    expect(s.out.stdout).toContain("Watching M3 every 2 minutes. Press Control-C to stop.");
    expect(s.out.stdout).toContain("14:00  0 ready, 1 blocked, 0 already started, 0 finished.");
    expect(code).toBe(0);
    expect(s.interrupts.size).toBe(0);
  });

  it("reads every 5 minutes without the key", async () => {
    const { s, reads } = blockedWatch();
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(reads).toEqual(["14:00", "14:05", "14:10"]);
    expect(code).toBe(0);
  });

  it("prints the groups once, in the first good round", async () => {
    const { s } = blockedWatch();
    await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(s.out.stdout.match(/^Blocked \(/gm)).toHaveLength(1);
  });

  it("ends on its own when no ticket is ready or blocked", async () => {
    const s = watchSetup({ tickets: [ticket("ABC-1", { stateName: "Done", stateKind: "finished" })], keys: ["ABC-1"] });
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(code).toBe(0);
    expect(s.sleeps).toEqual([]);
    expect(s.interrupts.size).toBe(0);
  });

  it("stops when standard input ends", async () => {
    const s = watchSetup({ tickets: [ticket("ABC-2", { stateName: "Todo", blockers: "unknown" as never })], keys: ["ABC-2"] });
    s.watch.sleep = async () => {
      s.input.end();
      await new Promise((r) => setTimeout(r, 20));
    };
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(s.out.stdout).toContain("Standard input closed, so the watch stopped.");
    expect(code).toBe(0);
  });
});
