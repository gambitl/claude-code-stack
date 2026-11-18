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
    expect(plan.sections[0]).toMatchObject({ name: "Ticket", first: 15, last: 27, filled: true });
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

describe("the units, the questions and the pull request", () => {
  const approved = readPlan(fixture("approved"));

  it("reads the units with their files, tests and dependencies", () => {
    expect(approved.units.map((unit) => unit.number)).toEqual([1, 2, 3]);
    expect(approved.units[0]).toMatchObject({
      number: 1,
      name: "Thing 1",
      line: 37,
      files: ["src/a1.ts", "test/a1.test.ts"],
      test: { file: "test/a1.test.ts", case: "the case 1 fails" },
      commitMessage: "feat(cli): add a1",
      dependsOn: [],
    });
    expect(approved.units[0].noTest).toBeUndefined();
  });

  it("reads a unit with no test, a continued field and a dependency", () => {
    expect(approved.units[1]).toMatchObject({
      noTest: "The unit changes prose only.",
      minimumCode: "Write the page, then link it from the index.",
      dependsOn: [1],
    });
    expect(approved.units[1].test).toBeUndefined();
  });

  it("reads the optional lines of a unit", () => {
    expect(approved.units[2]).toMatchObject({
      dependsOn: [1, 2],
      designSpecification: "none",
      blocked: "waiting for a decision",
    });
  });

  it("reads the blocking questions, one open and one answered", () => {
    expect(approved.blockingQuestions).toEqual([
      {
        number: 1,
        title: "Which flag",
        line: 71,
        text: "Should the flag be long?",
        for: "the maintainer",
        answer: "Yes, long. The maintainer, 2026-11-18.",
        open: false,
      },
      expect.objectContaining({ number: 2, answer: "open", open: true }),
    ]);
    expect(approved.pullRequest).toBeUndefined();
  });

  it("reads a ready plan: no questions, and the title and body of the pull request", () => {
    const ready = readPlan(fixture("ready-for-review"));
    expect(ready.blockingQuestions).toEqual([]);
    expect(ready.pullRequest?.title).toBe("feat(cli): read the plan file");
    expect(ready.pullRequest?.body).toContain("```bash\n## not a heading of the plan\nnpm test\n```");
    expect(ready.pullRequest?.body).toContain("\n## Summary\n");
    expect(ready.pullRequest?.body).not.toContain("````");
  });

  it("reads a plan with no units and the word none as no questions", () => {
    const plan = readPlan(fixture("ticket-with-code-block"));
    expect(plan.units).toEqual([]);
    expect(plan.blockingQuestions).toEqual([]);
  });

  it.each([
    ["unit-no-test", 39, "Test"],
    ["unit-test-not-in-files", 39, "Files"],
    ["path-dotdot", 38, ".."],
    ["path-dotgit", 38, ".git"],
    ["path-absolute", 38, "/"],
    ["path-dash", 38, "-"],
    ["path-semicolon", 38, "path"],
    ["path-dollar", 38, "path"],
    ["path-space", 38, "path"],
    ["unit-gap", 45, "Unit 2"],
    ["depends-missing", 43, "Unit 4"],
    ["question-no-answer", 71, "Answer"],
    ["question-none-with-question", 71, "none"],
    ["pr-no-block", 85, "four"],
  ])("flags %s at line %i", (name, line, word) => {
    const found = failure(name).problems;
    expect(found).toContainEqual(
      expect.objectContaining({ line, rule: expect.stringContaining(word) }),
    );
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
