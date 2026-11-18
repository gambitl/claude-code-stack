import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  HEADER_KEYS,
  PLAN_FORMAT,
  PlanFormatError,
  SECTION_NAMES,
  isBranchName,
  readPlan,
} from "../../src/plan/read.js";

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/plans/${name}.md`, import.meta.url), "utf8");

const failure = (name: string): PlanFormatError => {
  try {
    readPlan(fixture(name));
  } catch (error) {
    expect(error).toBeInstanceOf(PlanFormatError);
    return error as PlanFormatError;
  }
  throw new Error("the plan file was accepted");
};

describe("the format version", () => {
  it("refuses another format version and names the cstack that can read it", () => {
    const error = failure("format-2");
    expect(error.exitCode).toBe(3);
    expect(error.message).toContain("cstack-plan/1");
    expect(error.message).toContain("cstack 9.0.0");
  });

  it("refuses a file with no Format line and points to the prose skill", () => {
    const error = failure("no-format");
    expect(error.exitCode).toBe(3);
    expect(error.message).toContain("prose skill");
    expect(error.message).toContain("cstack-plan/1");
  });

  it("exports the format name", () => {
    expect(PLAN_FORMAT).toBe("cstack-plan/1");
  });
});

describe("a valid plan file", () => {
  const plan = readPlan(fixture("ticket-with-code-block"));

  it("reads the header values", () => {
    expect(plan.header["Target branch"]).toBe("main");
    expect(plan.header["Approved at"]).toBe("2026-11-18T14:32:05+01:00");
    expect(plan.header["Ready for review at"]).toBe("not yet");
    expect(Object.keys(plan.header)).toEqual([...HEADER_KEYS]);
  });

  it("does not read a line inside a fence or a comment as a heading", () => {
    const texts = plan.headings.map((heading) => heading.text);
    expect(texts).not.toContain("this is a shell comment, not a heading");
    expect(texts).not.toContain("Not a heading");
    expect(plan.headings.filter((heading) => heading.level === 3).map((h) => h.text)).toEqual([
      "Scope",
      "Decisions already taken upstream",
    ]);
  });

  it("gives the range and the filled flag of every section", () => {
    expect(plan.sections.map((section) => section.name)).toEqual([...SECTION_NAMES]);
    expect(plan.sections[0]).toEqual({ name: "Ticket", first: 15, last: 27, filled: true });
    const byName = Object.fromEntries(plan.sections.map((s) => [s.name, s]));
    expect(byName["Briefing"].filled).toBe(false);
    expect(byName["Hand-off log"].filled).toBe(false);
    expect(byName["History"].filled).toBe(true);
    expect(plan.sections.at(-1)!.last).toBe(readFileSync(
      new URL("../fixtures/plans/ticket-with-code-block.md", import.meta.url), "utf8",
    ).trimEnd().split("\n").length + 1);
  });
});

describe("a broken plan file", () => {
  const problems = (name: string) => failure(name).problems;

  it("flags a ticket heading left at level 2", () => {
    expect(problems("ticket-heading-level-2")).toContainEqual(
      expect.objectContaining({ line: 17, rule: expect.stringContaining("Scope") }),
    );
  });

  it("flags two sections in the wrong order", () => {
    const found = problems("sections-wrong-order");
    expect(found.some((p) => p.rule.includes("order"))).toBe(true);
  });

  it("flags a fence that never closes at the line where it opened", () => {
    expect(problems("fence-never-closes")).toContainEqual(
      expect.objectContaining({ line: 17, rule: expect.stringContaining("fence") }),
    );
  });

  it("flags an unknown Status", () => {
    expect(problems("unknown-status")).toContainEqual(
      expect.objectContaining({ line: 11, rule: expect.stringContaining("Status") }),
    );
  });

  it("flags a malformed Approved at", () => {
    expect(problems("bad-approved-at")).toContainEqual(
      expect.objectContaining({ line: 12, rule: expect.stringContaining("Approved at") }),
    );
  });

  it("flags a Target branch that starts with a dash", () => {
    expect(problems("target-branch-option")).toContainEqual(
      expect.objectContaining({ line: 9, rule: expect.stringContaining("Target branch") }),
    );
  });

  it("flags a header value left as a placeholder", () => {
    expect(problems("placeholder-value")).toContainEqual(
      expect.objectContaining({ line: 6, rule: expect.stringContaining("placeholder") }),
    );
  });

  it("puts every problem with its line in the message", () => {
    expect(failure("unknown-status").message).toContain("line 11");
  });
});

describe("isBranchName", () => {
  it.each(["main", "gambitl/plan-format", "release/1.2+x", "a_b"])("accepts %s", (name) => {
    expect(isBranchName(name)).toBe(true);
  });

  it.each([
    "",
    "-x",
    "/x",
    ".x",
    "x/",
    "x.",
    "x.lock",
    "a..b",
    "a//b",
    "a b",
    "café",
    "--upload-pack=x",
  ])("refuses %j", (name) => {
    expect(isBranchName(name)).toBe(false);
  });
});
