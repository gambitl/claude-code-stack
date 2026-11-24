import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSteps } from "../../src/guide-steps.js";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const raw = readFileSync(`${packageRoot}/guides/resolve-issue/document.md`, "utf8");

function steps() {
  const result = readSteps(raw, "document.md");
  if (!result.ok) throw new Error(result.message);
  return result.steps;
}

function section(heading: string): string {
  const start = raw.indexOf(heading);
  expect(start).toBeGreaterThan(-1);
  const next = raw.indexOf("\n## ", start + heading.length);
  return raw.slice(start, next === -1 ? undefined : next);
}

describe("the document guide", () => {
  it("lists each action of GIT_ACTIONS with the condition big-decision", async () => {
    const { GIT_ACTIONS } = await import("../../src/audit/records.js");
    for (const id of GIT_ACTIONS) {
      const found = steps().filter((s) => s.kind === "action" && s.action === id && s.condition === "big-decision");
      expect(found.length).toBe(1);
    }
  });

  it("puts the two steps after the dependent-ticket comments and before write-documentation-places", () => {
    const list = steps();
    const at = (pred: (s: (typeof list)[number]) => boolean) => list.findIndex(pred);
    const comments = at((s) => s.kind === "command" && s.condition === "each-dependent-ticket");
    const record = at((s) => s.kind === "action" && s.action === "write-decision-record");
    const why = at((s) => s.kind === "action" && s.action === "write-why-comment");
    const places = at((s) => s.kind === "action" && s.action === "write-documentation-places");
    expect(comments).toBeGreaterThan(-1);
    expect(record).toBeGreaterThan(comments);
    expect(why).toBeGreaterThan(record);
    expect(places).toBeGreaterThan(why);
  });

  it("asks for one call per comment", () => {
    const text = section("## Hand the context down");
    expect(text).toContain("Post each comment with its own `cstack tracker comment` call.");
    expect(text).toContain(
      "Never post several comments in one loop of the shell, because the audit counts one call for each comment.",
    );
  });

  it("says that the audit checks the record and the WHY comment from the commits of the branch", () => {
    const text = section("## Record every big decision");
    expect(text).toContain("Write the short name of the record on the same line as `WHY:`.");
    expect(text).toContain("The audit of the run checks both from the commits of the branch.");
  });
});
