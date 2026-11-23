import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function load() {
  return await import("../src/guide-steps.js");
}

const fixture = readFileSync(
  fileURLToPath(new URL("./fixtures/steps-block/guides/resolve-issue/build.md", import.meta.url)),
  "utf8",
);

async function refusal(text: string): Promise<string> {
  const { readSteps } = await load();
  const result = readSteps(text, "build.md");
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.message;
}

function block(...lines: string[]): string {
  return ["<!-- mandatory steps", ...lines, "-->", "", "# Phase"].join("\n");
}

describe("readSteps", () => {
  it("turns the block of the fixture guide into its 13 ordered steps", async () => {
    const { readSteps } = await load();
    const result = readSteps(fixture, "build.md");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.steps).toHaveLength(13);
    expect(result.steps[0]).toEqual({
      line: 2,
      kind: "command",
      command: "cstack tracker move '<key>' --to \"in progress\" --tracker <name>",
    });
    expect(result.steps[2]).toEqual({
      line: 4,
      kind: "helper",
      helper: "resolve-issue:implementer",
      condition: "each-unit",
    });
    expect(result.steps[3]).toEqual({
      line: 5,
      kind: "command",
      command: "cstack unit red <n>",
      condition: "each-unit-with-test",
    });
    expect(result.steps[6]).toMatchObject({ line: 8, condition: "each-unit" });
    expect(result.steps[9]).toEqual({
      line: 11,
      kind: "helper",
      helper: "resolve-issue:cto-review",
      word: "plan-delta",
      condition: "new-structural-decision",
    });
    expect(result.steps[10]).toEqual({
      line: 12,
      kind: "helper",
      helper: "resolve-issue:code-reviewer-deep",
      word: "security",
    });
    expect(result.steps[5]).toEqual({
      line: 7,
      kind: "action",
      action: "break-the-rule",
      condition: "each-negative-criterion",
    });
    expect(result.steps.map((step) => step.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("accepts all seven conditions and the three kinds from the exported lists", async () => {
    const { STEP_KINDS, CONDITIONS } = await load();
    expect([...STEP_KINDS]).toEqual(["command", "helper", "action"]);
    expect([...CONDITIONS]).toEqual([
      "each-unit",
      "each-unit-with-test",
      "each-stuck-unit",
      "each-negative-criterion",
      "each-dependent-ticket",
      "user-interface",
      "new-structural-decision",
    ]);
  });

  it("gives an empty list for a guide without a block", async () => {
    const { readSteps } = await load();
    expect(readSteps("# Phase\n\nSome text.\n", "build.md")).toEqual({ ok: true, steps: [] });
  });

  it("gives the same steps when the line ends are \\r\\n", async () => {
    const { readSteps } = await load();
    const result = readSteps(fixture.replace(/\n/g, "\r\n"), "build.md");
    expect(result).toEqual(readSteps(fixture, "build.md"));
    expect(result.ok && result.steps.length).toBe(13);
  });

  it("refuses an unknown kind", async () => {
    expect(await refusal(block("command: cstack next", "verb: x"))).toMatch(/^build\.md, line 3: /);
  });

  it("refuses an unknown condition", async () => {
    expect(await refusal(block("command: cstack next | sometimes"))).toMatch(/^build\.md, line 2: /);
  });

  it("refuses a line with no colon and space after its kind", async () => {
    expect(await refusal(block("command: cstack next", "command cstack next"))).toMatch(
      /^build\.md, line 3: .*colon and a space/,
    );
  });

  it("refuses a blank line inside the block", async () => {
    expect(await refusal(block("command: cstack next", "", "action: a-b"))).toMatch(
      /^build\.md, line 3: a blank line/,
    );
  });

  it("refuses a line with two separators", async () => {
    expect(await refusal(block("command: cstack next | each-unit | each-unit"))).toMatch(
      /^build\.md, line 2: /,
    );
  });

  it("refuses a command that does not start with cstack", async () => {
    expect(await refusal(block("command: npm test"))).toMatch(/^build\.md, line 2: /);
  });

  it("refuses a malformed helper", async () => {
    expect(await refusal(block("command: cstack next", "helper: implementer"))).toMatch(
      /^build\.md, line 3: /,
    );
    expect(await refusal(block("helper: a:b c d"))).toMatch(/^build\.md, line 2: /);
    expect(await refusal(block("helper: A:b"))).toMatch(/^build\.md, line 2: /);
  });

  it("refuses a malformed action", async () => {
    expect(await refusal(block("action: two words"))).toMatch(/^build\.md, line 2: /);
    expect(await refusal(block("action: Bad_Id"))).toMatch(/^build\.md, line 2: /);
  });

  it("refuses a line that holds the closing mark but is not exactly the closing mark", async () => {
    expect(await refusal(block("command: cstack next", "command: cstack next -->"))).toMatch(
      /^build\.md, line 3: .*closing mark/,
    );
  });

  it("refuses a block that never closes, at line 1", async () => {
    expect(await refusal("<!-- mandatory steps\ncommand: cstack next\n")).toMatch(/^build\.md, line 1: /);
  });

  it("refuses an empty block, at the line of the closing mark", async () => {
    expect(await refusal("<!-- mandatory steps\n-->\n")).toMatch(/^build\.md, line 2: /);
  });

  it("refuses an opening line after line 1", async () => {
    expect(await refusal("# Phase\n\n<!-- mandatory steps\ncommand: cstack next\n-->\n")).toMatch(
      /^build\.md, line 3: /,
    );
  });

  it("refuses a second opening line after a valid block", async () => {
    const text = "<!-- mandatory steps\ncommand: cstack next\n-->\n\n# Phase\n\n<!-- mandatory steps\naction: some-action\n-->\n";
    expect(await refusal(text)).toMatch(/^build\.md, line 7: .*open on line 1/);
  });
});
