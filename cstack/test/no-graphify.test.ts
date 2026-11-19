import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url).pathname;
const EXCEPTION_FILE = "skills/resolve-issue/settled-decisions.md";
const EXCEPTION_START = "- Agents map the code themselves";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

// Lists "file:line" for every line that names Graphify, except the one line that records the decision.
export function graphifyHits(): string[] {
  const hits: string[] = [];
  for (const folder of ["guides", "skills"]) {
    for (const file of files(join(root, folder))) {
      const name = relative(root, file);
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (!/graphify/i.test(line)) return;
          if (name === EXCEPTION_FILE && line.startsWith(EXCEPTION_START)) return;
          hits.push(`${name}:${index + 1}`);
        });
    }
  }
  return hits;
}

describe("the guides and the skills that cstack ships", () => {
  it("never name Graphify, except the line that records the decision to drop it", () => {
    expect(graphifyHits()).toEqual([]);
  });
});
