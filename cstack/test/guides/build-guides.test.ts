import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHASES } from "../../src/phases.js";

const BUILD_PHASES = PHASES.slice(PHASES.findIndex((p) => p.name === "build")).map((p) => p.name);

// Returns the build phases that have no guide in the folder.
export function missingBuildGuides(folder: string): string[] {
  return BUILD_PHASES.filter((name) => !existsSync(join(folder, `${name}.md`)));
}

describe("the guides of the build phases", () => {
  it("names the phase whose guide is missing", () => {
    const folder = new URL("../fixtures/build-guides/", import.meta.url).pathname;
    const missing = missingBuildGuides(folder);
    expect(missing).toEqual(["publish"]);
    expect(missing.map((name) => `${name}.md is missing`).join("\n")).toContain("publish.md");
  });

  it("has a guide for each phase from build to publish, retro included", () => {
    const folder = new URL("../../guides/resolve-issue/", import.meta.url).pathname;
    expect(BUILD_PHASES).toContain("retro");
    expect(missingBuildGuides(folder)).toEqual([]);
  });
});
