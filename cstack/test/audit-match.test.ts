import { describe, expect, it } from "vitest";
import { matchesStep, stepWords } from "../src/audit/match.js";

const w = (text: string) => stepWords(text);

describe("stepWords", () => {
  it("keeps a placeholder with a space as one word", () => {
    expect(w("cstack unit red <n> --plan <plan file>")).toEqual(["unit", "red", "<n>", "--plan", "<plan file>"]);
  });
  it("removes the quotes of a key and of a value", () => {
    expect(w(`cstack tracker move '<key>' --to "in progress"`)).toEqual([
      "tracker", "move", "<key>", "--to", "in progress",
    ]);
  });
});

describe("matchesStep accepts", () => {
  it("equal words", () => {
    expect(matchesStep(w("cstack next"), ["next"])).toBe(true);
  });
  it("a placeholder for any word", () => {
    expect(matchesStep(w("cstack tracker move '<key>'"), ["tracker", "move", "#12"])).toBe(true);
  });
  it("<n> with unit 2 against 2", () => {
    expect(matchesStep(w("cstack unit red <n>"), ["unit", "red", "2"], 2)).toBe(true);
  });
  it("<n>... with unit 2 against 1 2", () => {
    expect(matchesStep(w("cstack unit red <n>..."), ["unit", "red", "1", "2"], 2)).toBe(true);
  });
  it("<n>... with no unit against 3", () => {
    expect(matchesStep(w("cstack unit red <n>..."), ["unit", "red", "3"])).toBe(true);
  });
  it("--done build against --done=build", () => {
    expect(matchesStep(w("cstack next --done build"), ["next", "--done=build"])).toBe(true);
    expect(matchesStep(w("cstack next --done build"), ["next", "--done", "build"])).toBe(true);
  });
  it("a call without a placeholder flag", () => {
    expect(matchesStep(w("cstack next --done build --plan <plan file>"), ["next", "--done", "build"])).toBe(true);
  });
  it("an extra flag in the call", () => {
    expect(matchesStep(w("cstack next"), ["next", "--timeout", "9"])).toBe(true);
  });
});

describe("matchesStep refuses", () => {
  it("a different word", () => {
    expect(matchesStep(w("cstack next"), ["done"])).toBe(false);
  });
  it("<n> with unit 2 against 3", () => {
    expect(matchesStep(w("cstack unit red <n>"), ["unit", "red", "3"], 2)).toBe(false);
  });
  it("<n>... with unit 2 against 1 3", () => {
    expect(matchesStep(w("cstack unit red <n>..."), ["unit", "red", "1", "3"], 2)).toBe(false);
  });
  it("<n>... against no word", () => {
    expect(matchesStep(w("cstack unit red <n>..."), ["unit", "red"])).toBe(false);
  });
  it("a missing fixed flag", () => {
    expect(matchesStep(w("cstack next --done build"), ["next"])).toBe(false);
    expect(matchesStep(w("cstack next --force"), ["next"])).toBe(false);
  });
  it("a fixed flag with another value", () => {
    expect(
      matchesStep(w(`cstack tracker move '<key>' --to "in progress"`), ["tracker", "move", "k", "--to", "in review"]),
    ).toBe(false);
  });
  it("one word more or one word less before the first flag", () => {
    expect(matchesStep(w("cstack unit red <n>"), ["unit", "red", "1", "2"])).toBe(false);
    expect(matchesStep(w("cstack unit red <n>"), ["unit", "red"])).toBe(false);
  });
  const repeated = 'cstack helper start implementer --plan <plan file> --unit <n>';
  it("a flag with the number of another unit", () => {
    expect(
      matchesStep(w(repeated), ["helper", "start", "implementer", "--plan", "p.md", "--unit", "3"], 2),
    ).toBe(false);
  });
  it("a call without the flag that holds the unit number", () => {
    expect(matchesStep(w(repeated), ["helper", "start", "implementer", "--plan", "p.md"], 2)).toBe(false);
  });
});
