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
});
