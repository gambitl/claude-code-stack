import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunResult } from "../../src/orca/run.js";
import { TrackerError, WriteShapeError } from "../../src/tracker/errors.js";
import { linearOrcaTracker } from "../../src/tracker/linear-orca.js";
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

describe("linear write answers with a wrong shape or a failure", () => {
  const issue = { kind: "ok", stdout: text("linear-issue.blocked.json") } as RunResult;
  const states = { kind: "ok", stdout: text("linear-team-states.current.json") } as RunResult;

  it("throws WriteShapeError with exit 5 when status set has no result.state", async () => {
    const ok = JSON.parse(text("linear-status-set.ok.json"));
    delete ok.result.state;
    const { run } = fakeOrcaRun({
      "linear issue EXA-1 --relations --json": issue,
      "linear team states --team EXA --json": states,
      "linear status set EXA-1 --to In Review --json": { kind: "ok", stdout: JSON.stringify(ok) },
      "--version": VERSION,
    });
    const e = await linearOrcaTracker(run, {}).moveState("EXA-1", "In Review").catch((x) => x);
    expect(e).toBeInstanceOf(WriteShapeError);
    expect(e.exitCode).toBe(5);
  });

  it("gives exit 5 and asks to check the ticket when comment add times out", async () => {
    const p = join(mkdtempSync(join(tmpdir(), "linear-shape-")), "body.md");
    writeFileSync(p, "Hello");
    const { run } = fakeOrcaRun({
      [`linear comment add EXA-1 --body-file ${p} --json`]: { kind: "timeout" } as RunResult,
    });
    const e = await linearOrcaTracker(run, {}).addComment("EXA-1", p).catch((x) => x);
    expect(e.exitCode).toBe(5);
    expect(e.message).toContain("Check the ticket");
  });
});
