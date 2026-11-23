import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutBlock } from "../src/guide-steps.js";
import { PHASES } from "../src/phases.js";

// Counts words like `wc -w`: split on ASCII whitespace only.
const countWords = (text: string): number => text.split(/[ \t\n\r\f\v]+/).filter(Boolean).length;
const words = (path: string): number => countWords(readFileSync(path, "utf8"));

const root = new URL("../", import.meta.url).pathname;
const repo = new URL("../../", import.meta.url).pathname;

// The entry skill and the first guide must stay under a fifth of the frozen prose skill.
function checkSize(entrySkill: string, firstGuide: string, frozen: string[]): string[] {
  // The guide is counted as `cstack guide` prints it, without its block of mandatory steps.
  const prose = withoutBlock(readFileSync(firstGuide, "utf8"), firstGuide);
  if (!prose.ok) throw new Error(prose.message);
  const sum = words(entrySkill) + countWords(prose.text);
  const limit = frozen.reduce((total, file) => total + words(file), 0);
  return sum * 5 >= limit
    ? [`The entry skill and the first guide hold ${sum} words. The limit is under ${limit / 5} words (a fifth of ${limit}).`]
    : [];
}

const frozen = [join(repo, "skills/resolve-issue/SKILL.md"), join(repo, "skills/resolve-issue/writing.md")];

describe("the size of the entry skill", () => {
  it("reports an entry skill of 1,500 words as over the limit", () => {
    const dir = mkdtempSync(join(tmpdir(), "skill-size-"));
    try {
      const skill = join(dir, "SKILL.md");
      const guide = join(dir, "guide.md");
      writeFileSync(skill, Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" "));
      writeFileSync(guide, "A short guide.");
      const problems = checkSize(skill, guide, frozen);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain("1503 words");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the real entry skill and the first guide under a fifth of the frozen files", () => {
    const guide = join(root, "guides/resolve-issue", `${PHASES[0].name}.md`);
    expect(checkSize(join(root, "skills/resolve-issue/SKILL.md"), guide, frozen)).toEqual([]);
  });
});
