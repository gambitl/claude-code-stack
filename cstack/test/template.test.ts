import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HEADER_KEYS, PLAN_FORMAT, SECTION_NAMES, readPlan } from "../src/plan/read.js";

const template = readFileSync(
  new URL("../skills/resolve-issue/templates/plan.md", import.meta.url),
  "utf8",
);
const lines = template.split("\n");
const firstSection = lines.findIndex((line) => line.startsWith("## "));
const headerLines = lines
  .slice(1, firstSection)
  .filter((line) => /^[A-Z][A-Za-z ]*:/.test(line));

describe("the plan template", () => {
  it("has the header keys of the format in order", () => {
    expect(headerLines.map((line) => line.split(":")[0])).toEqual([...HEADER_KEYS]);
  });

  it("has the level-2 sections of the format in order", () => {
    const names = lines.filter((line) => line.startsWith("## ")).map((line) => line.slice(3));
    expect(names).toEqual([...SECTION_NAMES]);
  });

  it("names the format and starts every cstack write as not yet", () => {
    const value = (key: string) => headerLines.find((line) => line.startsWith(`${key}:`))?.slice(key.length + 1).trim();
    expect(value("Format")).toBe(PLAN_FORMAT);
    expect(value("Written by")).toBe("not yet");
    expect(value("Status")).toBe("draft");
    expect(value("Approved at")).toBe("not yet");
    expect(value("Ready for review at")).toBe("not yet");
  });

  it("has no unit heading", () => {
    expect(template).not.toMatch(/^### Unit /m);
  });

  it("is read by the plan reader once its header placeholders are filled in", () => {
    const filled = lines
      .map((line, index) => {
        if (index === 0 || index >= firstSection) return line;
        const parsed = /^([A-Z][A-Za-z ]*):\s*(<.*>.*)$/.exec(line);
        if (!parsed) return line;
        const values: Record<string, string> = {
          Date: "2026-11-18",
          "Branch": "feature/x",
          "Target branch": "main",
        };
        return `${parsed[1]}: ${values[parsed[1]] ?? "something"}`;
      })
      .join("\n");
    expect(() => readPlan(filled)).not.toThrow();
  });
});
