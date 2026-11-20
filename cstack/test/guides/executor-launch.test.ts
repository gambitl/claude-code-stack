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

const START = "cstack helper start executor --plan <plan file>";
const WAIT = "cstack helper wait <helper id>";

describe("how the guides start and wait for the executor", () => {
  const places: [string, string, string][] = [
    ["plan", "Hand off to the executor", "plan.md"],
    ["plan", "The report of the publish phase", "plan.md"],
    ["retro", "Hand over", "retro.md"],
  ];

  it.each(places)("the %s guide, section %s, waits with cstack helper wait and never with cstack report check", (_name, heading, file) => {
    const text = section(read(file), heading);
    expect(text).toContain(WAIT);
    expect(text).not.toContain("cstack report check");
  });

  it("starts the executor with cstack helper start in the plan guide and in the retro guide", () => {
    expect(section(read("plan.md"), "Hand off to the executor")).toContain(START);
    expect(section(read("retro.md"), "Hand over")).toContain(START);
  });

  it("says what exit codes 0, 6 and 1 mean, the shell timeout, and when to wait for a sub-agent", () => {
    const text = section(read("plan.md"), "Hand off to the executor");
    expect(text).toMatch(/exit code `0`/i);
    expect(text).toMatch(/exit code `6`/i);
    expect(text).toMatch(/exit code `1`/i);
    expect(text).toContain("ten minutes");
    expect(text).toMatch(/only after (it|the sub-agent) (has )?returned/);
  });
});
