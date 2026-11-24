import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const text = readFileSync(
  new URL("../skills/resolve-issue/templates/retro.md", import.meta.url),
  "utf8",
);
const lines = text.split("\n");

function headings(): string[] {
  return lines.filter((l) => l.startsWith("## ")).map((l) => l.slice(3).trim());
}

function stepsSection(): string {
  const start = lines.findIndex((l) => l.trim() === "## Steps");
  if (start < 0) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

describe("retrospective template", () => {
  it("has the level-2 headings Steps, Protect, Improve and Trap hit, in this order", () => {
    expect(headings()).toEqual(["Steps", "Protect", "Improve", "Trap hit"]);
  });

  it("puts Steps after the header lines Date, Plan file and Outcome", () => {
    const steps = lines.findIndex((l) => l.trim() === "## Steps");
    expect(steps).toBeGreaterThan(-1);
    for (const name of ["Date:", "Plan file:", "Outcome:"]) {
      const at = lines.findIndex((l) => l.startsWith(name));
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(steps);
    }
  });

  it("holds a code block that opens with three backticks and the word text in Steps", () => {
    expect(stepsSection()).toMatch(/^```text$/m);
  });

  it("says in the closing comment that the code block of Steps does not count toward the fifteen lines", () => {
    const comment = text.slice(text.lastIndexOf("<!--"));
    expect(comment).toMatch(
      /code block of `## Steps`[\s\S]*do(es)? not count toward the fifteen lines of prose/,
    );
  });
});
