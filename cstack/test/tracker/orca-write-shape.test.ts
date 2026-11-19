import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../src/orca/run.js";
import { TrackerError, WriteShapeError } from "../../src/tracker/errors.js";
import { jiraOrcaTracker } from "../../src/tracker/jira-orca.js";
import { fakeOrcaRun } from "../fakes/orca-run.js";

const dir = join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263");
const text = (file: string) => readFileSync(join(dir, file), "utf8");

const LIST = { kind: "ok", stdout: text("jira-status-list.current.json") } as RunResult;
const VERSION = { kind: "ok", stdout: text("version.current.txt") } as RunResult;

describe("jira write answers with a wrong shape or a failure", () => {
  it("throws WriteShapeError with exit 5 when status set lost its ok field, and calls nothing after", async () => {
    const { run, calls } = fakeOrcaRun({
      "jira status list EXA-1 --json": LIST,
      "jira status set EXA-1 --to-id 31 --json": { kind: "ok", stdout: JSON.stringify({ ok: true, result: {} }) },
      "--version": VERSION,
    });
    const e = await jiraOrcaTracker(run, {}).moveState("EXA-1", "Done").catch((x) => x);
    expect(e).toBeInstanceOf(WriteShapeError);
    expect(e.exitCode).toBe(5);
    expect(e.message).toContain("Check the ticket");
    expect(calls.at(-1)).toEqual(["--version"]);
  });

  it("gives exit 5, never 4, when status set fails with exit code 1", async () => {
    const { run } = fakeOrcaRun({
      "jira status list EXA-1 --json": LIST,
      "jira status set EXA-1 --to-id 31 --json": { kind: "failed", exitCode: 1 } as RunResult,
    });
    const e = await jiraOrcaTracker(run, {}).moveState("EXA-1", "Done").catch((x) => x);
    expect(e).toBeInstanceOf(TrackerError);
    expect(e.exitCode).toBe(5);
    expect(e.message).toContain("Check the ticket");
  });
});
