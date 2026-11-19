import { describe, expect, it } from "vitest";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_TEST_TIMEOUT_MS,
  MAX_OUTPUT_BYTES,
  lastLines,
  runTests,
  testScript,
} from "../src/test-run.js";

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

describe("runTests", () => {
  const dir = () => realpathSync(mkdtempSync(join(tmpdir(), "run-tests-")));

  it("keeps the output in order and passes the test file as the first argument", async () => {
    const script = `echo one; echo two >&2; echo three; printf '%s\\n' "$1"`;
    const run = await runTests(dir(), script, "a b;$x.ts");
    expect(run.exitCode).toBe(0);
    expect(run.timedOut).toBe(false);
    expect(run.script).toBe(script);
    expect(run.output).toBe("one\ntwo\nthree\na b;$x.ts\n");
  });

  it("runs from the given folder", async () => {
    const root = dir();
    expect((await runTests(root, "pwd", undefined)).output).toBe(root + "\n");
  });

  it("returns the exit code, 127 for a missing command, and closes standard input", async () => {
    expect((await runTests(dir(), "exit 3", undefined)).exitCode).toBe(3);
    expect((await runTests(dir(), "nosuchcommand-xyz", undefined)).exitCode).toBe(127);
    expect((await runTests(dir(), "cat", undefined)).exitCode).toBe(0);
  });

  it("kills the whole process group at the timeout", async () => {
    const root = dir();
    const run = await runTests(root, "sleep 30 & echo $! > pid; wait", undefined, 300);
    expect(run.timedOut).toBe(true);
    expect(run.exitCode).toBeUndefined();
    const { readFileSync } = await import("node:fs");
    const pid = Number(readFileSync(join(root, "pid"), "utf8"));
    await new Promise((r) => setTimeout(r, 200));
    expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
  });

  it("gives 128 plus the signal number when the shell is killed by a signal", async () => {
    const run = await runTests(dir(), "kill -TERM $$", undefined);
    expect(run.exitCode).toBe(143);
    expect(run.timedOut).toBe(false);
  });

  it("keeps at most the last megabyte, starting at the beginning of a line", async () => {
    const run = await runTests(dir(), "yes 0123456789abcdef | head -n 200000; echo last", undefined);
    expect(Buffer.byteLength(run.output)).toBeLessThanOrEqual(MAX_OUTPUT_BYTES);
    expect(run.output.endsWith("last\n")).toBe(true);
    expect(run.output.startsWith("0123456789abcdef\n")).toBe(true);
  });
});
