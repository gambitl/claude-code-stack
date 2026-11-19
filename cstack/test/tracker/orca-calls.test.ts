import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXIT } from "../../src/manifest.js";
import { NoClientError, RefusedArgumentError, TrackerError, WriteShapeError } from "../../src/tracker/errors.js";
import { checkCommentBody, orcaRead, orcaWrite } from "../../src/tracker/orca-calls.js";
import { fakeOrcaRun } from "../fakes/orca-run.js";

const SHAPE = "orca jira connection --json";
const ARGS = ["jira", "connection"];
const KEY = "jira connection --json";
const good = JSON.stringify({ ok: true, result: { sites: [] } });

async function fails(p: Promise<unknown>): Promise<TrackerError> {
  try {
    await p;
  } catch (e) {
    return e as TrackerError;
  }
  throw new Error("expected a failure");
}

describe("orca calls", () => {
  it("returns the answer of a good read and write", async () => {
    const { run, calls } = fakeOrcaRun({ [KEY]: { kind: "ok", stdout: good } });
    expect(await orcaRead(run, {}, SHAPE, ARGS)).toMatchObject({ ok: true });
    expect(await orcaWrite(run, {}, SHAPE, ARGS)).toMatchObject({ ok: true });
    expect(calls).toEqual([["jira", "connection", "--json"], ["jira", "connection", "--json"]]);
  });

  it("gives exit 5 with the command name for a failed read", async () => {
    const { run } = fakeOrcaRun({ [KEY]: { kind: "failed", exitCode: 1 } });
    const e = await fails(orcaRead(run, {}, SHAPE, ARGS));
    expect(e.exitCode).toBe(EXIT.toolFailed);
    expect(e.message).toContain("jira connection");
    expect(e.message).not.toContain("cannot tell");
  });

  it("says cstack cannot tell for a failed write, once", async () => {
    const { run } = fakeOrcaRun({ [KEY]: { kind: "failed", exitCode: 1 } });
    const e = await fails(orcaWrite(run, {}, SHAPE, ARGS));
    expect(e.exitCode).toBe(5);
    expect(e.message.match(/cannot tell whether the change happened/g)).toHaveLength(1);
  });

  it("gives NoClientError on a missing Orca for both", async () => {
    const { run } = fakeOrcaRun({ [KEY]: { kind: "missing" } });
    const r = await fails(orcaRead(run, {}, SHAPE, ARGS));
    const w = await fails(orcaWrite(run, {}, SHAPE, ARGS));
    expect(r).toBeInstanceOf(NoClientError);
    expect(w).toBeInstanceOf(NoClientError);
    expect(r.exitCode).toBe(4);
    expect(w.exitCode).toBe(4);
    expect(w.message).not.toContain("can read");
    expect(w.message).toContain("With your own connection");
  });

  it("treats timeout, text, ok false as exit 5", async () => {
    for (const result of [
      { kind: "timeout" },
      { kind: "too-large" },
      { kind: "ok", stdout: "not json" },
      { kind: "ok", stdout: JSON.stringify({ ok: false, error: { message: "no" } }) },
    ] as const) {
      const { run } = fakeOrcaRun({ [KEY]: result });
      expect((await fails(orcaRead(run, {}, SHAPE, ARGS))).exitCode).toBe(5);
      const w = await fails(orcaWrite(run, {}, SHAPE, ARGS));
      expect(w.exitCode).toBe(5);
      expect(w.message).toContain("cannot tell");
    }
  });

  it("reports a shape error with the Orca version, and wraps it for a write", async () => {
    const bad = JSON.stringify({ ok: true, result: {} });
    const { run, calls } = fakeOrcaRun({
      [KEY]: { kind: "ok", stdout: bad },
      "--version": { kind: "ok", stdout: "1.4.263\n" },
    });
    const r = await fails(orcaRead(run, {}, SHAPE, ARGS));
    expect(r.exitCode).toBe(5);
    expect(r.message).toContain("1.4.263");
    const w = await fails(orcaWrite(run, {}, SHAPE, ARGS));
    expect(w).toBeInstanceOf(WriteShapeError);
    expect(w.message.match(/cannot tell whether the change happened/g)).toHaveLength(1);
    expect(calls.filter((c) => c[0] === "--version")).toHaveLength(2);
  });
});

describe("comment body check", () => {
  const dir = mkdtempSync(join(tmpdir(), "orca-calls-"));
  const file = (text: string) => {
    const p = join(dir, `${Math.random()}.md`);
    writeFileSync(p, text);
    return p;
  };
  it("accepts a normal body and refuses the bad ones with exit 1", () => {
    expect(() => checkCommentBody(file("hello"), 10)).not.toThrow();
    for (const p of [file("  \n"), file("x".repeat(11)), join(dir, "missing.md")]) {
      expect(() => checkCommentBody(p, 10)).toThrow(RefusedArgumentError);
    }
  });
});
