import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { requirements } from "../src/doctor/requirements.js";

// The bold names of the bullets under "## Requirements", in order.
function readmeNames(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.indexOf("## Requirements");
  if (start === -1) return [];
  const names: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) break;
    const match = /^- \*\*(.+?)\*\*/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

describe("README Requirements section", () => {
  it("lists the same items as cstack doctor, in the same order", () => {
    expect(readmeNames(readme)).toEqual(requirements.map((r) => r.name));
  });

  it("fails when an item is in only one of the two lists", () => {
    const sample = [
      "## Requirements",
      ...requirements.map((r) => `- **${r.name}**: text`),
      "- **Extra**: text",
      "## Next",
    ].join("\n");
    expect(readmeNames(sample)).not.toEqual(requirements.map((r) => r.name));
  });
});
