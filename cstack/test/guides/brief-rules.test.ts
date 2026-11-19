import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guide = readFileSync(new URL("../../guides/resolve-issue/ticket.md", import.meta.url), "utf8");

describe("the ticket guide and the brief of a run", () => {
  it("has one paragraph about the rules of the brief", () => {
    const paragraph = guide.split(/\n\s*\n/).find((text) => text.includes("brief"));
    expect(paragraph, "no paragraph of the ticket guide mentions the brief").toBeDefined();
    for (const word of ["## Decisions", "from the brief of the run", "secret", "ask the user", "gate", "settings file"]) {
      expect(paragraph).toContain(word);
    }
  });

  it("keeps only the decisions of the parent project under the upstream heading", () => {
    const sentences = guide.split(/(?<=[.!?])\s+/).filter((text) => text.includes("Decisions already taken upstream"));
    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence).toContain("parent project");
      expect(sentence).not.toContain("brief");
    }
  });
});
