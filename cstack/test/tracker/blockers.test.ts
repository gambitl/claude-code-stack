import { describe, expect, it } from "vitest";
import { footerBlockers, mergeBlockers } from "../../src/tracker/blockers.js";

const footer = (part: string) => `Some text.\n\n**Size: M** · ${part}`;

describe("footerBlockers", () => {
  it("reads the footer of ticket 24, not the quote in its scope", () => {
    const body = [
      "11. **Blockers from the footer.** Write one function that reads the line `Blocked by: …` of a ticket body,",
      "keeps only the keys that pass the key check, and ignores everything else.",
      "",
      "**Size: M** · Blocked by: #10, #13 · Feeds: #25, #26, #27, #29",
    ].join("\n");
    expect(footerBlockers("github", body)).toEqual(["#10", "#13"]);
  });
  it("gives an empty list for none in any case, or an empty part", () => {
    expect(footerBlockers("github", footer("Blocked by: none · Feeds: #2"))).toEqual([]);
    expect(footerBlockers("github", footer("Blocked by: NONE"))).toEqual([]);
    expect(footerBlockers("github", footer("Blocked by:  · Feeds: #2"))).toEqual([]);
  });
  it("gives unknown for text without a valid key", () => {
    expect(footerBlockers("github", footer("Blocked by: the other team"))).toBe("unknown");
  });
  it("gives unknown without a footer or without Blocked by", () => {
    expect(footerBlockers("github", "Blocked by: #3")).toBe("unknown");
    expect(footerBlockers("github", footer("Feeds: #4"))).toBe("unknown");
  });
  it("never reads the Feeds part", () => {
    expect(footerBlockers("github", footer("Blocked by: #1 · Feeds: #4"))).toEqual(["#1"]);
    expect(footerBlockers("github", footer("Feeds: #4 · Blocked by: none"))).toEqual([]);
  });
  it("ignores invalid tokens next to valid keys", () => {
    expect(footerBlockers("github", footer("Blocked by: #1, foo, PROJ-2, #0"))).toEqual(["#1"]);
    expect(footerBlockers("linear", footer("Blocked by: ABC-12, #3"))).toEqual(["ABC-12"]);
  });
  it("uses the last footer line", () => {
    expect(footerBlockers("github", "**Size: S** · Blocked by: #1\n**Size: M** · Blocked by: #2")).toEqual(["#2"]);
  });
});

describe("mergeBlockers", () => {
  const rel = [{ key: "#1", stateKind: "finished" as const }];
  it("joins relations and footer keys without duplicates", () => {
    expect(mergeBlockers(rel, ["#1", "#2"])).toEqual([
      { key: "#1", stateKind: "finished" },
      { key: "#2", stateKind: "unknown" },
    ]);
  });
  it("gives an empty list for empty relations and an unknown footer", () => {
    expect(mergeBlockers([], "unknown")).toEqual([]);
  });
  it("gives unknown without relations and an unknown footer", () => {
    expect(mergeBlockers(undefined, "unknown")).toBe("unknown");
  });
  it("lets the footer answer alone without relations", () => {
    expect(mergeBlockers(undefined, ["#2"])).toEqual([{ key: "#2", stateKind: "unknown" }]);
  });
});
