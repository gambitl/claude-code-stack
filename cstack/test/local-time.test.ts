import { describe, expect, it } from "vitest";
import { localTime } from "../src/local-time.js";

const PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const base = new Date("2026-11-19T09:04:05.678Z");

describe("localTime", () => {
  it.each([
    [60, "2026-11-19T10:04:05+01:00"],
    [-150, "2026-11-19T06:34:05-02:30"],
    [330, "2026-11-19T14:34:05+05:30"],
    [0, "2026-11-19T09:04:05+00:00"],
  ])("writes offset %i", (offset, expected) => {
    const result = localTime(base, offset);
    expect(result).toBe(expected);
    expect(result).toMatch(PATTERN);
    expect(Date.parse(result)).toBe(Math.floor(base.getTime() / 1000) * 1000);
  });

  it("moves a date near midnight to the right day", () => {
    expect(localTime(new Date("2026-11-19T23:30:00Z"), 60)).toBe("2026-11-20T00:30:00+01:00");
    expect(localTime(new Date("2026-11-19T00:30:00Z"), -60)).toBe("2026-11-18T23:30:00-01:00");
  });

  it("takes the offset from getTimezoneOffset with the opposite sign", () => {
    const d = new Date(base);
    const offset = -d.getTimezoneOffset();
    expect(localTime(d)).toBe(localTime(d, offset));
    expect(localTime(d)).toMatch(PATTERN);
  });
});
