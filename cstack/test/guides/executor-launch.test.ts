import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const GUIDES = new URL("../../guides/resolve-issue/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, GUIDES), "utf8");

/** The text of a section: from its heading to the next heading of the same level. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`## ${heading}\n`);
  expect(start, `no section "${heading}"`).toBeGreaterThanOrEqual(0);
  const rest = text.slice(start + 1);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

/** The block of mandatory steps at the top of a guide. */
const block = (text: string) => text.slice(0, text.indexOf("-->"));

const SENTENCES = [
  "Then start a fresh sub-agent of type `resolve-issue:executor`.",
  "Give it these four inputs and nothing from the conversation: the repository path, the plan file path, the conventions file path, and the path of `writing.md` in the skill folder.",
  "Wait until the executor returns, and never start a second executor while one still runs.",
  "Its final message is its report: the first line names the kind of the report, and the report follows.",
  "When the result of a sub-agent that the executor started reaches you instead of the executor, send it to the executor in a message.",
  "When the final message names no kind, or says that cstack refused the report, first send a message to the same executor, which keeps its context, and ask it to finish its phase and submit its report.",
];

describe("how the guides start the executor and read its report", () => {
  const places: [string, string][] = [
    ["Hand off to the executor", "plan.md"],
    ["The report of the publish phase", "plan.md"],
    ["Hand over", "retro.md"],
  ];

  it.each(places)("the section %s of %s names no cstack helper and no cstack report check", (heading, file) => {
    const text = section(read(file), heading);
    expect(text).not.toContain("cstack helper");
    expect(text).not.toContain("cstack report check");
  });

  it("the section Hand off to the executor names the sub-agent type, the four inputs and nothing from the conversation", () => {
    const text = section(read("plan.md"), "Hand off to the executor");
    expect(text).toContain("resolve-issue:executor");
    expect(text).toContain("four inputs");
    expect(text).toContain("nothing from the conversation");
  });

  it.each(SENTENCES)("the section Hand off to the executor holds the sentence: %s", (sentence) => {
    expect(section(read("plan.md"), "Hand off to the executor")).toContain(sentence);
  });

  it("says that a failed resume starts a fresh executor once, and that a second failure stops the run", () => {
    const text = section(read("plan.md"), "Hand off to the executor");
    expect(text).toMatch(/fresh executor with the same four inputs, once/);
    expect(text).toMatch(/stop and tell the user/);
  });

  it("the section Hand over of the retro guide names the executor and the plan guide section", () => {
    const text = section(read("retro.md"), "Hand over");
    expect(text).toContain("resolve-issue:executor");
    expect(text).toContain("Hand off to the executor");
  });

  it("the ready guide names cstack report submit done", () => {
    expect(read("ready.md")).toContain("cstack report submit done --plan <plan file>");
  });

  it("the publish guide names cstack report submit published and failed", () => {
    const text = read("publish.md");
    expect(text).toContain("cstack report submit published --plan <plan file>");
    expect(text).toContain("cstack report submit failed --plan <plan file>");
  });

  it("the bullet Order of the plan guide runs the units one after the other", () => {
    const bullet = read("plan.md").split("\n").find((l) => l.startsWith("- **Order.**"))!;
    expect(bullet).toContain("one after the other");
    expect(bullet).toContain("cstack unit order");
    expect(bullet).not.toContain("in parallel");
  });

  it("the blocks of mandatory steps name the executor and the report commands", () => {
    expect(block(read("plan.md"))).toContain("helper: resolve-issue:executor");
    expect(block(read("retro.md"))).toContain("helper: resolve-issue:executor");
    expect(block(read("ready.md"))).toContain("command: cstack report submit done --plan <plan file>");
    expect(block(read("publish.md"))).toContain("command: cstack report submit published --plan <plan file>");
  });
});
