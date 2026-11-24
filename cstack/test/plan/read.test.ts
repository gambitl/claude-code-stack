import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
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

const failureOf = (text: string): PlanFormatError => {
  try {
    readPlan(text);
  } catch (error) {
    expect(error).toBeInstanceOf(PlanFormatError);
    return error as PlanFormatError;
  }
  throw new Error("the plan file was accepted");
};

describe("the format version", () => {
  it("refuses a version 1 plan and names the version that wrote it, with the two steps to go back", () => {
    const error = failure("version-1");
    expect(error.exitCode).toBe(3);
    expect(error.message).toBe(
      "This plan file has the format cstack-plan/1. This cstack reads cstack-plan/2. cstack 0.3.1 can read it. To finish this run, install that release, then run `cstack skills install` again.",
    );
  });

  it("refuses a version 1 plan that was never registered and names cstack 0.3.2", () => {
    const text = fixture("version-1").replace(/^Written by: .*$/m, "Written by: not yet");
    const error = failureOf(text);
    expect(error.exitCode).toBe(3);
    expect(error.message).toBe(
      "This plan file has the format cstack-plan/1. This cstack reads cstack-plan/2. cstack 0.3.2 is the last version that reads cstack-plan/1. To finish this run, install that release, then run `cstack skills install` again.",
    );
  });

  it("refuses another unknown version and names the cstack that can read it", () => {
    const error = failure("format-3");
    expect(error.exitCode).toBe(3);
    expect(error.message).toBe(
      "This plan file has the format cstack-plan/3. This cstack reads cstack-plan/2. cstack 9.0.0 can read it.",
    );
  });

  it("never names cstack 0.3.2 for another unknown version that was never registered", () => {
    const text = fixture("format-3").replace(/^Written by: .*$/m, "Written by: not yet");
    const error = failureOf(text);
    expect(error.exitCode).toBe(3);
    expect(error.message).toBe(
      "This plan file has the format cstack-plan/3. This cstack reads cstack-plan/2. The file does not name the cstack version that can read it.",
    );
    expect(error.message).not.toContain("0.3.2");
  });

  it("refuses a file with no Format line and points to the prose skill", () => {
    const error = failure("no-format");
    expect(error.exitCode).toBe(3);
    expect(error.message).toContain("prose skill");
    expect(error.message).toContain("cstack-plan/2");
  });

  it("exports the format name", () => {
    expect(PLAN_FORMAT).toBe("cstack-plan/2");
  });
});

describe("the sections of version 2", () => {
  it("reads the version 2 example", () => {
    const plan = readPlan(fixture("version-2"));
    expect(plan.sections.map((section) => section.name)).toEqual([...SECTION_NAMES]);
    for (const name of ["Negative criteria", "Facts", "Changes to what the ticket fixes"]) {
      expect(plan.sections.find((section) => section.name === name)?.filled).toBe(true);
    }
    expect(plan.units.map((unit) => unit.test?.file)).toEqual(["test/a1.test.ts", undefined, "test/a3.test.ts"]);
  });

  it.each(["Negative criteria", "Facts", "Changes to what the ticket fixes"])(
    "refuses a version 2 plan that has no section %s",
    (name) => {
      const text = fixture("version-2").replace(new RegExp(`^## ${name}$`, "m"), "## Notes");
      const found = failureOf(text).problems;
      expect(found).toContainEqual(
        expect.objectContaining({ rule: `The section ${name} is missing.` }),
      );
    },
  );
});

describe("a valid plan file", () => {
  let plan: ReturnType<typeof readPlan>;
  beforeAll(() => {
    plan = readPlan(fixture("ticket-with-code-block"));
  });

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
  let approved: ReturnType<typeof readPlan>;
  beforeAll(() => {
    approved = readPlan(fixture("approved"));
  });

  it("reads the units with their files, tests and dependencies", () => {
    expect(approved.units.map((unit) => unit.number)).toEqual([1, 2, 3]);
    expect(approved.units[0]).toMatchObject({
      number: 1,
      name: "Thing 1",
      line: 45,
      files: ["src/a1.ts", "test/a1.test.ts"],
      test: { file: "test/a1.test.ts", cases: ["the case 1 fails"] },
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

  it("refuses an empty Blocked line, because a unit is blocked only with a reason", () => {
    const text = fixture("approved").replace("- Blocked: waiting for a decision", "- Blocked:");
    let error: unknown;
    try {
      readPlan(text);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(PlanFormatError);
    expect((error as PlanFormatError).problems).toContainEqual(
      expect.objectContaining({ line: 70, rule: expect.stringContaining("Blocked") }),
    );
  });

  it("reads the blocking questions, one open and one answered", () => {
    expect(approved.blockingQuestions).toEqual([
      {
        number: 1,
        title: "Which flag",
        line: 79,
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
    ["unit-no-test", 47, "Test"],
    ["unit-test-not-in-files", 47, "Files"],
    ["path-dotdot", 46, ".."],
    ["path-dotgit", 46, ".git"],
    ["path-absolute", 46, "/"],
    ["path-dash", 46, "-"],
    ["path-semicolon", 46, "path"],
    ["path-dollar", 46, "path"],
    ["path-space", 46, "path"],
    ["unit-gap", 53, "Unit 2"],
    ["depends-missing", 51, "Unit 4"],
    ["question-no-answer", 79, "Answer"],
    ["question-none-with-question", 79, "none"],
    ["pr-no-block", 97, "four"],
  ])("flags %s at line %i", (name, line, word) => {
    const found = failure(name).problems;
    expect(found).toContainEqual(
      expect.objectContaining({ line, rule: expect.stringContaining(word) }),
    );
  });
});

describe("the Test lines of a unit", () => {
  const withUnit1 = (from: string, to: string) => {
    const text = fixture("version-2").replace(from, to);
    expect(text).not.toBe(fixture("version-2"));
    return text;
  };

  it("reads every Test line of a unit as one case of the same test file", () => {
    const plan = readPlan(fixture("version-2"));
    expect(plan.units[0].test).toEqual({
      file: "test/a1.test.ts",
      cases: ["the case 1 fails", "the case 1b fails and it fails for a second reason"],
    });
  });

  it("reads a unit with one Test line as a list of one case", () => {
    const plan = readPlan(fixture("version-2"));
    expect(plan.units[2].test).toEqual({ file: "test/a3.test.ts", cases: ["the case 3 fails"] });
  });

  it("continues the case of a Test line on a line that starts with two spaces", () => {
    const text = withUnit1(
      "- Test: `test/a3.test.ts`: the case 3 fails\n",
      "- Test: `test/a3.test.ts`: the case 3 fails\n  and goes on\n",
    );
    expect(readPlan(text).units[2].test?.cases).toEqual(["the case 3 fails and goes on"]);
  });

  it("refuses a Test line that names another test file than the first one", () => {
    const text = withUnit1(
      "- Test: `test/a1.test.ts`: the case 1b fails",
      "- Test: `test/other.test.ts`: the case 1b fails",
    );
    const error = failureOf(text);
    expect(error.message).toContain("line 50");
    expect(error.message).toContain("same test file");
  });

  it("refuses the same case named twice in one unit", () => {
    const text = withUnit1("the case 1b fails\n  and it fails for a second reason", "the case 1 fails");
    const error = failureOf(text);
    expect(error.message).toContain("line 50");
    expect(error.message).toContain("twice");
  });
});

describe("the negative criteria and the units that cover them", () => {
  const base = fixture("version-2");
  const swap = (from: string, to: string) => {
    const text = base.replace(from, to);
    expect(text).not.toBe(base);
    return text;
  };
  const lineOf = (text: string, needle: string) => text.split("\n").findIndex((row) => row.includes(needle)) + 1;
  const noUnitLines = (text: string) => text.replace(/^- Negative criterion .*\n(  .*\n)*/gm, "");
  const CRITERIA = "1. The command never changes the plan file.\n2. The reader never accepts a plan with no Format line.";

  it("reads the numbered negative criteria", () => {
    const plan = readPlan(base);
    expect(plan.negativeCriteria).toEqual([
      { number: 1, line: lineOf(base, "1. The command never"), text: "The command never changes the plan file." },
      { number: 2, line: lineOf(base, "2. The reader never"), text: "The reader never accepts a plan with no Format line." },
    ]);
  });

  it("reads the word none as no negative criterion", () => {
    const plan = readPlan(noUnitLines(swap(CRITERIA, "none")));
    expect(plan.negativeCriteria).toEqual([]);
  });

  it("refuses a criterion line that is not in the form <k>. <criterion>", () => {
    const text = noUnitLines(swap("2. The reader never", "- The reader never"));
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "- The reader never")}:`);
    expect(error.message).toContain("<k>. <criterion>");
  });

  it("refuses a criterion whose number is out of place", () => {
    const text = noUnitLines(swap("2. The reader never", "3. The reader never"));
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "3. The reader never")}: Negative criterion 3 is out of place`);
    expect(error.message).toContain("number 2 comes here");
  });

  it("refuses the word none next to a criterion", () => {
    const text = noUnitLines(swap(CRITERIA, `${CRITERIA}\nnone`));
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "2. The reader never") + 1}:`);
    expect(error.message).toContain("The word `none` cannot sit next to a negative criterion");
  });

  it("reads the criteria that a unit covers, with the case that proves each one", () => {
    const plan = readPlan(base);
    expect(plan.units[0].negativeCriteria).toEqual([
      { criterion: 1, case: "the case 1 fails" },
      { criterion: 2, case: "the case 1b fails and it fails for a second reason" },
    ]);
    expect(plan.units[1].negativeCriteria).toEqual([]);
    expect(plan.units[2].negativeCriteria).toEqual([]);
  });

  it("refuses a unit that names a negative criterion that does not exist", () => {
    const text = swap("- Negative criterion 1: the case 1 fails", "- Negative criterion 7: the case 1 fails");
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "Negative criterion 7")}:`);
    expect(error.message).toContain("Unit 1 names the negative criterion 7, which is not in `## Negative criteria`");
  });

  it("refuses a Negative criterion line whose case is not a case of the unit", () => {
    const text = swap("- Negative criterion 1: the case 1 fails", "- Negative criterion 1: a case nobody wrote");
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "a case nobody wrote")}:`);
    expect(error.message).toContain('The case "a case nobody wrote" of negative criterion 1 is not one of the cases');
  });

  it("refuses a Negative criterion line in a unit with no test", () => {
    const text = swap("- No test: The unit changes prose only.", "- No test: The unit changes prose only.\n- Negative criterion 1: the case 1 fails");
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "Docs only") + 3}:`);
    expect(error.message).toContain("Unit 2 has a `- No test:` line, so it cannot name a negative criterion");
  });

  it("refuses a Negative criterion line in a unit whose Test line is not in its form, and never says the unit has no test", () => {
    const text = swap(
      "- Test: `test/a1.test.ts`: the case 1 fails\n- Test: `test/a1.test.ts`: the case 1b fails\n  and it fails for a second reason\n",
      "- Test: test/a1.test.ts: the case 1 fails\n",
    );
    const error = failureOf(text);
    expect(error.message).toContain(
      `line ${lineOf(text, "- Negative criterion 1:")}: Unit 1 has no \`- Test:\` line in its fixed form, so it cannot name a negative criterion. Fix the \`- Test:\` line first.`,
    );
    expect(error.message).not.toContain("has a `- No test:` line");
  });

  it("refuses the same criterion twice in one unit", () => {
    const text = swap("- Negative criterion 2: the case 1b fails", "- Negative criterion 1: the case 1b fails");
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, "- Negative criterion 1: the case 1b fails")}: Unit 1 names`);
    expect(error.message).toContain("Unit 1 names the negative criterion 1 twice");
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

describe("Windows line endings", () => {
  it("reads a plan with CRLF line endings like the same plan with LF", () => {
    const text = fixture("approved");
    expect(readPlan(text.replace(/\n/g, "\r\n"))).toEqual(readPlan(text));
  });
});

describe("the facts and their sources", () => {
  const base = fixture("version-2");
  const FILE_FACT = '- The reader is in one file. Source: `src/plan/read.ts`, line 1: "export const PLAN_FORMAT"';
  const USER_FACT = "- The maintainer chose a long flag. Source: the user, on 2026-11-18";
  const swap = (from: string, to: string) => {
    const text = base.replace(from, to);
    expect(text).not.toBe(base);
    return text;
  };
  const lineOf = (text: string, needle: string) => text.split("\n").findIndex((row) => row.includes(needle)) + 1;
  const refused = (replacement: string, message: string) => {
    const text = swap(FILE_FACT, replacement);
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, replacement)}: `);
    expect(error.message).toContain(message);
  };

  it("reads a fact with a file source, its line and its quoted text", () => {
    const plan = readPlan(base);
    expect(plan.facts[0]).toEqual({
      line: lineOf(base, "The reader is in one file."),
      text: "The reader is in one file.",
      source: { kind: "file", path: "src/plan/read.ts", line: 1, quote: "export const PLAN_FORMAT" },
    });
  });

  it("reads a fact with a user source and its date", () => {
    const plan = readPlan(base);
    expect(plan.facts[1]).toEqual({
      line: lineOf(base, "The maintainer chose"),
      text: "The maintainer chose a long flag.",
      source: { kind: "user", date: "2026-11-18" },
    });
    expect(plan.facts).toHaveLength(2);
  });

  it("reads the word none as no fact", () => {
    const plan = readPlan(swap(`${FILE_FACT}\n${USER_FACT}`, "none"));
    expect(plan.facts).toEqual([]);
  });

  it("reads a quoted text that holds Source: and double quotes", () => {
    const text = swap(FILE_FACT, '- The reader says Source: here. Source: `src/plan/read.ts`, line 5: "a \\"x\\" Source: `a.ts`, line 2: \\"y\\" end"');
    const plan = readPlan(text);
    expect(plan.facts[0]).toEqual({
      line: lineOf(text, "The reader says"),
      text: "The reader says Source: here.",
      source: { kind: "file", path: "src/plan/read.ts", line: 5, quote: 'a \\"x\\" Source: `a.ts`, line 2: \\"y\\" end' },
    });
  });

  it("ignores spaces at the end of a fact line", () => {
    expect(readPlan(swap(USER_FACT, `${USER_FACT}   `)).facts[1].source).toEqual({ kind: "user", date: "2026-11-18" });
  });

  it("refuses a fact line with no source", () => {
    refused("- The reader is in one file.", "has no ` Source: `");
  });

  it("refuses a file source with no quoted text", () => {
    refused("- The reader is in one file. Source: `src/plan/read.ts`, line 1", "quoted text");
    refused('- The reader is in one file. Source: `src/plan/read.ts`, line 1: ""', "quoted text");
  });

  it("refuses a source line number of 0", () => {
    refused('- The reader is in one file. Source: `src/plan/read.ts`, line 0: "x"', "from 1");
  });

  it("refuses a user source with no date", () => {
    refused("- The maintainer chose a long flag. Source: the user", "the user, on <YYYY-MM-DD>");
  });

  it("refuses a user date that is not YYYY-MM-DD", () => {
    refused("- The maintainer chose a long flag. Source: the user, on 18/11/2026", "YYYY-MM-DD");
  });

  it("refuses an absolute source path", () => {
    refused('- The reader is in one file. Source: `/src/plan/read.ts`, line 1: "x"', "starts with /");
  });

  it("refuses a source path with a .. part", () => {
    refused('- The reader is in one file. Source: `../src/read.ts`, line 1: "x"', ".. part");
  });

  it("refuses a fact line that does not start with - ", () => {
    refused('The reader is in one file. Source: `a.ts`, line 1: "x"', "- <the fact> Source:");
  });

  it("refuses the word none next to a fact", () => {
    const text = swap(USER_FACT, `${USER_FACT}\nnone`);
    const error = failureOf(text);
    expect(error.message).toContain(`line ${lineOf(text, USER_FACT) + 1}: The word \`none\` cannot sit next to a fact`);
  });
});

describe("the changes to what the ticket fixes", () => {
  const base = fixture("version-2");
  const CHANGE = "- The flag is long, not short. Blocking question: 1";
  const swap = (from: string, to: string) => {
    const text = base.replace(from, to);
    expect(text).not.toBe(base);
    return text;
  };
  const lineOf = (text: string, needle: string) => text.split("\n").findIndex((row) => row.includes(needle)) + 1;

  it("reads each change with the number of its blocking question", () => {
    const text = swap(CHANGE, `${CHANGE}\n- The name is short. Blocking question: 2   `);
    const plan = readPlan(text);
    expect(plan.ticketChanges).toEqual([
      { line: lineOf(text, "The flag is long"), text: "The flag is long, not short.", question: 1 },
      { line: lineOf(text, "The name is short"), text: "The name is short.", question: 2 },
    ]);
  });

  it("reads the word none as no change", () => {
    expect(readPlan(swap(CHANGE, "none")).ticketChanges).toEqual([]);
  });

  it("refuses a change line with no blocking question number", () => {
    for (const row of ["- The flag is long, not short.", "- The flag is long. Blocking question: x", "- The flag is long. Blocking question: 0", "The flag is long. Blocking question: 1"]) {
      const text = swap(CHANGE, row);
      const error = failureOf(text);
      expect(error.message).toBe(
        `line ${lineOf(text, row)}: A change line is \`- <the change> Blocking question: <n>\`, with <n> the number of a blocking question. Write the word \`none\` when the plan changes nothing that the ticket fixes.`,
      );
    }
  });

  it("refuses the word none next to a change", () => {
    const text = swap(CHANGE, `${CHANGE}\nnone`);
    const error = failureOf(text);
    expect(error.message).toBe(
      `line ${lineOf(text, CHANGE) + 1}: The word \`none\` cannot sit next to a change. Remove it.`,
    );
  });
});
