import { describe, expect, it } from "vitest";
import { COMMANDS, type CommandEntry } from "../src/manifest.js";
import { placeholderProblems } from "./helpers/manifest-placeholders.js";

function entry(extra: Partial<CommandEntry>): CommandEntry {
  return {
    usage: "cstack frobnicate [--later]",
    summary: "A command that no ticket builds.",
    flags: ["--later"],
    exitCodes: { 0: "The command did its job." },
    file: "frobnicate.ts",
    ticket: 998,
    built: true,
    ...extra,
  };
}

describe("placeholderProblems", () => {
  it("names a command that is not built and its ticket", () => {
    const problems = placeholderProblems([entry({ built: false })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("frobnicate");
    expect(problems[0]).toContain("#998");
  });

  it("names a flag that is not built and its ticket", () => {
    const problems = placeholderProblems([entry({ notBuiltFlags: { "--later": 999 } })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("--later");
    expect(problems[0]).toContain("#999");
  });

  it("finds no problem in the real manifest", () => {
    expect(placeholderProblems(COMMANDS)).toEqual([]);
  });
});
