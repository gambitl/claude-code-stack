import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

  it("replaces {report} with \"$2\" and {file} with \"$1\", and never writes a real path", () => {
    const withReport = { all: "npm test", file: "pytest --junitxml={report} {file}", report: "junit" as const };
    expect(testScript(withReport, "test/a b.py")).toBe('pytest --junitxml="$2" "$1"');
    expect(testScript(withReport, "test/a b.py")).not.toContain("a b.py");
  });

  it("has a default timeout of ten minutes", () => {
    expect(DEFAULT_TEST_TIMEOUT_MS).toBe(600_000);
  });
});

describe("usesReport", () => {
  const commands = { all: "npm test", file: "pytest --junitxml={report} {file}", report: "junit" as const };
  const call = async (c: typeof commands | { all: string; file?: string; report?: "junit" }, f?: string) => {
    const mod = (await import("../src/test-run.js")) as { usesReport: (c: unknown, f?: string) => boolean };
    return mod.usesReport(c, f);
  };

  it("is true with a test file, a file command and report junit", async () => {
    expect(await call(commands, "test/a.py")).toBe(true);
  });

  it("is false without the test file", async () => {
    expect(await call(commands)).toBe(false);
  });

  it("is false without the file command", async () => {
    expect(await call({ all: "npm test", report: "junit" }, "test/a.py")).toBe(false);
  });

  it("is false without the report key", async () => {
    expect(await call({ all: "npm test", file: "pytest {file}" }, "test/a.py")).toBe(false);
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

  describe("when cstack is interrupted", () => {
    const interrupt = async (signal: "SIGINT" | "SIGTERM") => {
      const root = dir();
      const source = new URL("../src/test-run.ts", import.meta.url).href;
      const code = `
        import { runTests } from ${JSON.stringify(source)};
        await runTests(process.argv[1], "sleep 30 & echo $! > pid; wait", undefined);
      `;
      const child = spawn(process.execPath, ["--input-type=module", "-e", code, root], { stdio: "inherit" });
      const ended = new Promise<NodeJS.Signals | null>((resolve) => child.on("exit", (_c, s) => resolve(s)));
      for (let i = 0; i < 200 && !existsSync(join(root, "pid")); i++) await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => setTimeout(r, 100));
      child.kill(signal);
      expect(await ended).toBe(signal);
      const pid = Number(readFileSync(join(root, "pid"), "utf8"));
      await new Promise((r) => setTimeout(r, 200));
      expect(() => process.kill(pid, 0)).toThrow(/ESRCH/);
    };

    it("stops the sleep process and ends with SIGINT", () => interrupt("SIGINT"), 30_000);
    it("stops the sleep process and ends with SIGTERM", () => interrupt("SIGTERM"), 30_000);

    it("removes its signal listeners after a normal run", async () => {
      const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
      await runTests(dir(), "true", undefined);
      expect([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")]).toEqual(before);
    });
  });
});

describe("runTests with a report", () => {
  const dir = () => realpathSync(mkdtempSync(join(tmpdir(), "run-report-")));
  const fixture = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "junit", "pytest.xml");
  const ask = { report: true };

  it("returns the four cases of the report that the script wrote", async () => {
    const run = await runTests(dir(), 'cp "$1" "$2"', fixture, undefined, ask);
    expect(run.exitCode).toBe(0);
    const report = run.report as { cases: { name: string; outcome: string }[] };
    expect(report.cases.map((c) => [c.name, c.outcome])).toEqual([
      ["test_adds_item", "passed"],
      ["test_removes_item", "failed"],
      ["test_total", "error"],
      ["test_later", "skipped"],
    ]);
  });

  it("passes report.xml in a fresh folder as the second argument, and deletes the folder", async () => {
    const root = dir();
    const script = 'printf "%s\\n" "$2" > path; cp "$1" "$2"';
    await runTests(root, script, fixture, undefined, ask);
    const first = readFileSync(join(root, "path"), "utf8").trim();
    await runTests(root, script, fixture, undefined, ask);
    const second = readFileSync(join(root, "path"), "utf8").trim();
    expect(first.endsWith("/report.xml")).toBe(true);
    expect(dirname(first)).not.toBe(dirname(second));
    expect(existsSync(dirname(first))).toBe(false);
    expect(existsSync(dirname(second))).toBe(false);
  });

  it("gives the problem missing when the script writes no report", async () => {
    const run = await runTests(dir(), "true", fixture, undefined, ask);
    expect(run.report).toMatchObject({ problem: "missing" });
    expect((run.report as { message: string }).message).not.toBe("");
  });

  it("gives the problem malformed, with the message of the reader, for a broken report", async () => {
    const run = await runTests(dir(), 'printf "<testsuites>\\n<testsuite>\\n" > "$2"', fixture, undefined, ask);
    const { readJUnitReport } = await import("../src/junit-report.js");
    let expected = "";
    try {
      readJUnitReport("<testsuites>\n<testsuite>\n");
    } catch (error) {
      expected = (error as Error).message;
    }
    expect(expected).not.toBe("");
    expect(run.exitCode).toBe(0);
    expect(run.report).toEqual({ problem: "malformed", message: expected });
  });

  it("gives the problem timed-out when the run reaches its timeout", async () => {
    const run = await runTests(dir(), "sleep 30", fixture, 300, ask);
    expect(run.timedOut).toBe(true);
    expect(run.report).toMatchObject({ problem: "timed-out" });
  });

  it("throws before the shell starts when the report is asked without a test file", async () => {
    const root = dir();
    await expect(runTests(root, "touch started", undefined, undefined, ask)).rejects.toThrow(/test file/);
    expect(existsSync(join(root, "started"))).toBe(false);
  });

  it("without the request, has no report field and gives the script one argument", async () => {
    const root = dir();
    const run = await runTests(root, 'printf "%s\\n" "$#"', fixture);
    expect(run.output).toBe("1\n");
    expect("report" in run).toBe(false);
    expect("report" in (await runTests(root, "true", fixture, undefined, { report: false }))).toBe(false);
  });
});
