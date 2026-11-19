import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PLANNING_PHASES } from "../../src/phases.js";

const realGuides = fileURLToPath(new URL("../../guides/resolve-issue/", import.meta.url));
const fixtureGuides = fileURLToPath(new URL("../fixtures/guides/planning-missing-questions/", import.meta.url));

/** Returns the planning phases that have no guide file in the folder. */
function missingGuides(folder: string): string[] {
  return PLANNING_PHASES.filter((phase) => !existsSync(`${folder}${phase}.md`));
}

function assertAllGuides(folder: string): void {
  const missing = missingGuides(folder);
  if (missing.length > 0) {
    throw new Error(`Missing guide for the planning phase: ${missing.join(", ")}`);
  }
}

describe("planning guides", () => {
  it("fails and names the phase when a guide is missing", () => {
    expect(() => assertAllGuides(fixtureGuides)).toThrow(/questions/);
  });

  it("has a guide for each planning phase", () => {
    expect(() => assertAllGuides(realGuides)).not.toThrow();
  });
});
