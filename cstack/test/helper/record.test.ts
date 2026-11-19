import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HELPER_EXIT_PENDING,
  HelperError,
  checkHelperId,
  createRecord,
  helperRecordPath,
  helperSpecPath,
  latestUnitRecord,
  makeHelperId,
  readRecord,
  updateRecord,
} from "../../src/helper/record.js";

const NOW = new Date("2026-11-19T14:32:05.123Z");
let folder: string;
beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "helper-record-"));
});
afterEach(() => rmSync(folder, { recursive: true, force: true }));

describe("helper ids", () => {
  it("refuses bad ids with exit code 2", () => {
    for (const bad of [
      "../../x",
      "20261119-143205123-executor\nx",
      "20261119-143205123-executor-2",
      "20261119-143205123-implementer",
    ]) {
      try {
        checkHelperId(bad);
        throw new Error("not refused");
      } catch (error) {
        expect(error).toBeInstanceOf(HelperError);
        expect((error as HelperError).exitCode).toBe(2);
      }
    }
  });

  it("makes ids for each role and unit at a fixed time", () => {
    expect(makeHelperId("executor", null, NOW)).toBe("20261119-143205123-executor");
    expect(makeHelperId("implementer", 3, NOW)).toBe("20261119-143205123-implementer-3");
    expect(makeHelperId("implementer-escalation", 12, NOW)).toBe("20261119-143205123-implementer-escalation-12");
    expect(checkHelperId("20261119-143205123-implementer-escalation-12")).toEqual({
      role: "implementer-escalation",
      unit: 12,
    });
    expect(checkHelperId("20261119-143205123-executor")).toEqual({ role: "executor", unit: null });
  });

  it("puts the record and the spec in the helpers folder", () => {
    const id = makeHelperId("executor", null, NOW);
    expect(helperRecordPath(folder, id)).toBe(join(folder, "helpers", `${id}.json`));
    expect(helperSpecPath(folder, id)).toBe(join(folder, "helpers", `${id}.spec.md`));
  });

  it("reads no file for a refused id", () => {
    expect(() => readRecord(folder, "../../x")).toThrow(HelperError);
  });
});

describe("records", () => {
  const record = () => ({
    format: "cstack-helper/1" as const,
    id: makeHelperId("executor", null, NOW),
    role: "executor" as const,
    unit: null,
    startedAt: NOW.toISOString(),
    mode: "orca-worker" as const,
    dispatchId: "d1",
  });

  it("round trips and updates", () => {
    createRecord(folder, record());
    expect(readRecord(folder, record().id)).toEqual(record());
    const updated = updateRecord(folder, record().id, { report: "/x/r.json", sent: false });
    expect(updated.report).toBe("/x/r.json");
    expect(readRecord(folder, record().id).sent).toBe(false);
  });

  it("never replaces a record", () => {
    createRecord(folder, record());
    expect(() => createRecord(folder, record())).toThrow(HelperError);
  });

  it("exits with 1 for an unknown id", () => {
    try {
      readRecord(folder, "20261119-143205123-executor");
      throw new Error("no error");
    } catch (error) {
      expect((error as HelperError).exitCode).toBe(1);
    }
  });

  it("exits with 3 for a record that is not JSON", () => {
    const id = "20261119-143205123-executor";
    mkdirSync(join(folder, "helpers"), { recursive: true });
    writeFileSync(helperRecordPath(folder, id), "not json");
    try {
      readRecord(folder, id);
      throw new Error("no error");
    } catch (error) {
      expect((error as HelperError).exitCode).toBe(3);
    }
    expect(readFileSync(helperRecordPath(folder, id), "utf8")).toBe("not json");
  });

  it("exports the exit code 6", () => {
    expect(HELPER_EXIT_PENDING).toBe(6);
  });
});

describe("latestUnitRecord", () => {
  const make = (id: string, startedAt: string, unit = 2) =>
    createRecord(folder, { format: "cstack-helper/1", id, role: "implementer", unit, startedAt, mode: "sub-agent" });

  it("compares the start times as dates, not as text", () => {
    // 10:00 at +01:00 is 09:00 UTC, so it is earlier than 09:30 UTC, although its text is larger.
    make("20261119-090000000-implementer-2", "2026-11-19T10:00:00+01:00");
    make("20261119-093000000-implementer-2", "2026-11-19T09:30:00Z");
    expect(latestUnitRecord(folder, 2)?.id).toBe("20261119-093000000-implementer-2");
  });

  it("breaks a tie with the id", () => {
    make("20261119-100000001-implementer-2", "2026-11-19T10:00:00Z");
    make("20261119-100000002-implementer-2", "2026-11-19T10:00:00Z");
    expect(latestUnitRecord(folder, 2)?.id).toBe("20261119-100000002-implementer-2");
  });

  it("skips a record that cannot be read and the records of other units", () => {
    make("20261119-100000001-implementer-2", "2026-11-19T10:00:00Z");
    make("20261119-110000000-implementer-3", "2026-11-19T11:00:00Z", 3);
    writeFileSync(join(folder, "helpers", "20261119-120000000-implementer-2.json"), "{not json");
    expect(latestUnitRecord(folder, 2)?.id).toBe("20261119-100000001-implementer-2");
  });

  it("finds nothing when there is no helpers folder", () => {
    expect(latestUnitRecord(folder, 2)).toBeUndefined();
  });
});
