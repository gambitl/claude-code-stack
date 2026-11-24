import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readSavedRun } from "../src/saved-runs.js";
import { noteFailed, saveFailingRun, savePassingRun, type FailingUnitRun } from "../src/unit-test-runs.js";

const run = (over: Partial<FailingUnitRun> = {}): FailingUnitRun => ({
  time: "2026-11-19T10:00:00.000Z",
  startedAt: "2026-11-19T09:59:59.000Z",
  command: 'npx vitest run "$1"',
  exitCode: 1,
  commit: "abc123",
  testFile: "cstack/test/a.test.ts",
  testFileSha256: "f".repeat(64),
  ...over,
});

const tempRunDir = () => join(mkdtempSync(join(tmpdir(), "cstack-runs-")), "run-not-yet");

describe("saving the runs of a unit", () => {
  it("saves a failing run into a run folder that does not exist yet", () => {
    const dir = tempRunDir();
    saveFailingRun(dir, 1, run(), "boom output");
    expect(existsSync(join(dir, "units/1/red.json"))).toBe(true);
    expect(readFileSync(join(dir, "units/1/red.log"), "utf8")).toBe("boom output");
    expect(readSavedRun(dir, 1, "red")).toEqual(run());
    expect(readdirSync(join(dir, "units/1")).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("deletes the passing run when a failing run is saved", () => {
    const dir = tempRunDir();
    savePassingRun(dir, 1, run({ exitCode: 0 }), "ok");
    expect(existsSync(join(dir, "units/1/green.json"))).toBe(true);
    saveFailingRun(dir, 1, run(), "boom");
    expect(existsSync(join(dir, "units/1/green.json"))).toBe(false);
    expect(existsSync(join(dir, "units/1/green.log"))).toBe(false);
  });

  it("keeps the failing run when a passing run is saved", () => {
    const dir = tempRunDir();
    saveFailingRun(dir, 1, run(), "boom");
    savePassingRun(dir, 1, run({ exitCode: 0 }), "ok");
    expect(existsSync(join(dir, "units/1/red.json"))).toBe(true);
    expect(existsSync(join(dir, "units/1/red.log"))).toBe(true);
    expect(readFileSync(join(dir, "units/1/green.log"), "utf8")).toBe("ok");
    expect(readSavedRun(dir, 1, "green")?.exitCode).toBe(0);
    expect(readdirSync(join(dir, "units/1")).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("does not touch the folder of another unit", () => {
    const dir = tempRunDir();
    saveFailingRun(dir, 1, run(), "one");
    mkdirSync(join(dir, "units/2"), { recursive: true });
    writeFileSync(join(dir, "units/2/green.json"), "keep");
    saveFailingRun(dir, 3, run(), "three");
    expect(readFileSync(join(dir, "units/2/green.json"), "utf8")).toBe("keep");
    expect(readFileSync(join(dir, "units/1/red.log"), "utf8")).toBe("one");
  });
});

describe("the message when the note cannot be written", () => {
  it("ends the reason with one period only", () => {
    let text = "";
    const code = noteFailed({ stdout: () => {}, stderr: (t: string) => { text += t; } } as never, "red", 2, "The lock is busy.");
    expect(code).toBe(5);
    expect(text).toContain("into the plan file: The lock is busy. Run");
    expect(text).not.toContain("..");
  });
});
