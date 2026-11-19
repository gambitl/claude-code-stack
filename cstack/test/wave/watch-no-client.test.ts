import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wave } from "../../src/commands/wave.js";
import { watchSetup } from "../helpers/watch.js";

describe("cstack wave --watch without a tracker client", () => {
  it("exits with 4, names cstack wave and --from-file, and reads and listens to nothing", async () => {
    const s = watchSetup({ realTracker: true });
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(code).toBe(4);
    expect(s.out.stderr).toContain("cstack wave");
    expect(s.out.stderr).toContain("--from-file");
    expect(s.out.stdout).toBe("");
    expect(s.interrupts.size).toBe(0);
    expect(s.input.listenerCount("data")).toBe(0);
    expect(s.input.listenerCount("end")).toBe(0);
    expect(s.input.listenerCount("readable")).toBe(0);
  });

  it("refuses --watch with --from-file with exit code 2", async () => {
    const s = watchSetup();
    const code = await wave(["--milestone", "M3", "--from-file", "x.json", "--watch"], s.io, s.deps, s.watch);
    expect(code).toBe(2);
    expect(s.out.stderr).toContain("a file never changes");
  });

  it("refuses with exit code 1 without a terminal, before it opens the tracker", async () => {
    const s = watchSetup({ terminal: false });
    let opened = 0;
    const open = s.deps.openTracker;
    s.deps.openTracker = async (c, o) => {
      opened++;
      return open(c, o);
    };
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(code).toBe(1);
    expect(s.out.stderr).toContain("cstack: the watch asks its questions in a terminal, so run it in an interactive terminal.");
    expect(opened).toBe(0);
    expect(s.interrupts.size).toBe(0);
  });

  it("exits with 3 on a bad settings file, before it checks the terminal", async () => {
    const s = watchSetup({ terminal: false });
    mkdirSync(join(s.clone.root, ".cstack"), { recursive: true });
    writeFileSync(join(s.clone.root, ".cstack", "settings.json"), JSON.stringify({ version: 1, watchIntervalMinutes: 0 }));
    const code = await wave(["--milestone", "M3", "--tracker", "jira", "--watch"], s.io, s.deps, s.watch);
    expect(code).toBe(3);
    expect(s.out.stderr).toContain("watchIntervalMinutes");
    expect(s.out.stderr).not.toContain("terminal");
  });
});
