import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readSteps } from "../../src/guide-steps.js";

const GUIDE = new URL("../../guides/resolve-issue/independent-review.md", import.meta.url);

function guideText(): string {
  return readFileSync(GUIDE, "utf8");
}

describe("the entry of the independent review", () => {
  it("independent-review.md gives the fixed first line of the entry", () => {
    const text = guideText();
    expect(text).toContain("The first line of the entry starts with `Independent review:`, word for word.");
    expect(text).toContain(
      "When the reviewer changed nothing and raised no judgment call, that first line is `Independent review: none`.",
    );
    expect(text).toContain(
      "`cstack next --done independent-review` refuses to close the phase while the \"Review log\" has no line that starts with `Independent review:`.",
    );
  });

  it("the block of mandatory steps writes the entry between the reviewer and the close", () => {
    const result = readSteps(guideText(), "independent-review.md");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kinds = result.steps.map((step) =>
      step.kind === "command" ? [step.kind, step.command] : step.kind === "helper" ? [step.kind, step.helper] : [step.kind, step.action],
    );
    expect(kinds).toEqual([
      ["action", "check-the-settings-file"],
      ["helper", "resolve-issue:pr-reviewer"],
      ["action", "write-independent-review-entry"],
      ["command", "cstack next --done independent-review --plan <plan file>"],
    ]);
  });
});
