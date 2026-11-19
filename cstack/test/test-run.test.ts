import { describe, expect, it } from "vitest";
import { DEFAULT_TEST_TIMEOUT_MS, lastLines, testScript } from "../src/test-run.js";

describe("testScript", () => {
  const commands = { all: "npm test", file: "npx vitest run {file}" };

  it("puts the test file as the first argument of the file command", () => {
    expect(testScript(commands, "test/a.test.ts")).toBe('npx vitest run "$1"');
  });

  it("returns the whole-suite command without a file command or without a test file", () => {
    expect(testScript({ all: "npm test" }, "test/a.test.ts")).toBe("npm test");
    expect(testScript(commands)).toBe("npm test");
  });

  it("never writes the test file path into the script", () => {
    const paths = ["a b;$x.ts", "$(touch pwned).ts", "it's.ts", "`id`.ts", "--help.ts"];
    for (const path of paths) {
      const script = testScript(commands, path);
      expect(script).toBe('npx vitest run "$1"');
      expect(script).not.toContain(path);
    }
  });

  it("has a default timeout of ten minutes", () => {
    expect(DEFAULT_TEST_TIMEOUT_MS).toBe(600_000);
  });
});

describe("lastLines", () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i + 1}`);

  it("keeps the last 40 lines by default", () => {
    const result = lastLines(lines(50).join("\n"));
    expect(result.split("\n")).toEqual(lines(50).slice(10));
  });

  it("keeps the last count lines", () => {
    expect(lastLines(lines(10).join("\n"), 3)).toBe("line 8\nline 9\nline 10");
  });

  it("does not count a final line break as a line", () => {
    expect(lastLines("a\nb\nc\n", 2)).toBe("b\nc\n");
  });

  it("returns a short output whole", () => {
    expect(lastLines("a\nb\n")).toBe("a\nb\n");
    expect(lastLines("")).toBe("");
  });
});
