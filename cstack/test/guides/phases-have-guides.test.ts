import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PHASES } from "../../src/phases.js";

const realGuides = fileURLToPath(new URL("../../guides/resolve-issue/", import.meta.url));
const fixtureGuides = fileURLToPath(new URL("../fixtures/guides/extra-guide/", import.meta.url));

/** Returns one sentence for each phase without a guide and each guide without a phase. */
function guideProblems(phaseNames: string[], folder: string): string[] {
  const files = readdirSync(folder).filter((file) => file.endsWith(".md"));
  const wanted = new Set(phaseNames.map((phase) => `${phase}.md`));
  return [
    ...phaseNames.filter((phase) => !files.includes(`${phase}.md`)).map((phase) => `phase ${phase} has no guide`),
    ...files.filter((file) => !wanted.has(file)).map((file) => `guide ${file} belongs to no phase`),
  ];
}

describe("guides and phases", () => {
  it("names a guide that belongs to no phase", () => {
    expect(guideProblems(["ticket"], fixtureGuides)).toEqual(["guide deploy.md belongs to no phase"]);
  });

  it("names a phase that has no guide", () => {
    expect(guideProblems(["ticket", "build"], fixtureGuides)).toContain("phase build has no guide");
  });

  it("finds no problem in the real phases and guides", () => {
    expect(guideProblems(PHASES.map((phase) => phase.name), realGuides)).toEqual([]);
  });
});
