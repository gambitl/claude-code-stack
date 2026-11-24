import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSteps, withoutBlock } from "../../src/guide-steps.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const raw = readFileSync(`${packageRoot}/guides/resolve-issue/retro.md`, "utf8");
const FENCE = "`".repeat(3);

function steps() {
  const result = readSteps(raw, "retro.md");
  if (!result.ok) throw new Error(result.message);
  return result.steps;
}

function prose(): string {
  const result = withoutBlock(raw, "retro.md");
  if (!result.ok) throw new Error(result.message);
  return result.text;
}

describe("the retro guide runs the audit", () => {
  it("the block holds the command step cstack audit <plan file>", () => {
    const found = steps().filter((step) => step.kind === "command" && step.command === "cstack audit <plan file>");
    expect(found).toHaveLength(1);
  });

  it("the audit step comes before the action step write-retrospective", () => {
    const list = steps();
    const audit = list.findIndex((step) => step.kind === "command" && step.command === "cstack audit <plan file>");
    const write = list.findIndex((step) => step.kind === "action" && step.action === "write-retrospective");
    expect(audit).toBeGreaterThanOrEqual(0);
    expect(write).toBeGreaterThan(audit);
  });

  it("the prose names the command cstack audit <plan file>", () => {
    expect(prose()).toContain("cstack audit <plan file>");
  });

  it("the prose names the section ## Steps", () => {
    expect(prose()).toContain("## Steps");
  });

  it("the prose asks for a code block that opens with three backticks and the word text", () => {
    expect(prose()).toContain(`${FENCE}text`);
  });
});
