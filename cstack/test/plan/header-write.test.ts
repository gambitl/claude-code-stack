import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { setHeaderValues } from "../../src/plan/header-write.js";
import { readPlan } from "../../src/plan/read.js";

const approved = readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8");
const changes = { "Approved at": "2026-11-19T10:04:05+01:00", Status: "ready for review" };

function changedLines(before: string, after: string): number[] {
  const a = before.split("\n");
  const b = after.split("\n");
  expect(b.length).toBe(a.length);
  return a.flatMap((line, index) => (line === b[index] ? [] : [index]));
}

describe("setHeaderValues", () => {
  it("changes only the named header lines", () => {
    const result = setHeaderValues(approved, changes);
    const lines = result.split("\n");
    const changed = changedLines(approved, result);
    expect(changed).toHaveLength(2);
    expect(lines).toContain("Approved at: 2026-11-19T10:04:05+01:00");
    expect(lines).toContain("Status: ready for review");
    expect(readPlan(result).header.Status).toBe("ready for review");
  });

  it("keeps Windows line endings on every line", () => {
    const windows = approved.replace(/\n/g, "\r\n");
    const result = setHeaderValues(windows, changes);
    expect(result.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(result.split("\r\n")).toContain("Status: ready for review");
    expect(changedLines(windows, result)).toHaveLength(2);
    readPlan(result);
  });

  it("leaves Status lines in a header comment and in later sections alone", () => {
    const text = approved
      .replace("Status: approved\n", "<!--\nStatus: example\n-->\nStatus: approved\n")
      .replace("Text of decisions.", "Status: in a section");
    const result = setHeaderValues(text, { Status: "ready for review" });
    expect(result).toContain("<!--\nStatus: example\n-->");
    expect(result).toContain("Status: in a section");
    expect(result).toContain("\nStatus: ready for review\n");
  });

  it("throws when a key is not in the header", () => {
    expect(() => setHeaderValues(approved, { "Nope key": "x" })).toThrow(/Nope key/);
  });
});
