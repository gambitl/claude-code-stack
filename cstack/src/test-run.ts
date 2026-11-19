import { spawn } from "node:child_process";
import { closeSync, fstatSync, mkdtempSync, openSync, readSync, rmSync } from "node:fs";
import { constants, tmpdir } from "node:os";
import { join } from "node:path";
import type { TestCommands } from "./settings.js";

/** The time a test run may take before cstack stops it: ten minutes. */
export const DEFAULT_TEST_TIMEOUT_MS = 600_000;

/** The most output bytes that a run keeps: the last megabyte. */
export const MAX_OUTPUT_BYTES = 1_048_576;

/** The result of one test run. */
export type TestRun = {
  /** The exact script handed to `/bin/sh -c`. */
  script: string;
  /** The exit code of the shell, or undefined when the run reached its timeout. */
  exitCode: number | undefined;
  /** True when the run was stopped because it reached its timeout. */
  timedOut: boolean;
  /**
   * The output of the run, standard output and standard error in the order written.
   * It keeps at most the last `MAX_OUTPUT_BYTES` bytes. When the output is longer,
   * the kept part starts just after the first line break inside that last megabyte.
   */
  output: string;
};

/**
 * Returns the script that runs the tests. With a test file and a `file` command,
 * `{file}` becomes `"$1"`, so the path reaches the shell as an argument and never
 * appears in the script text. Otherwise the whole-suite command is returned.
 */
export function testScript(commands: TestCommands, testFile?: string): string {
  if (commands.file !== undefined && testFile !== undefined) {
    return commands.file.replace("{file}", () => '"$1"');
  }
  return commands.all;
}

/**
 * Returns the last `count` lines of an output. A final line break does not count
 * as an extra empty line. An output with fewer lines comes back whole.
 */
export function lastLines(output: string, count = 40): string {
  const body = output.endsWith("\n") ? output.slice(0, -1) : output;
  const lines = body.split("\n");
  if (lines.length <= count) return output;
  return lines.slice(-count).join("\n") + (output.endsWith("\n") ? "\n" : "");
}

/** Kills a whole process group. The pid must be a whole number above 1. */
function killGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  // WHY: process.kill(-0) or a missing pid would kill the group of cstack itself.
  if (pid === undefined || !Number.isInteger(pid) || pid <= 1) return;
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function readTail(fd: number): string {
  const size = fstatSync(fd).size;
  const length = Math.min(size, MAX_OUTPUT_BYTES);
  const buffer = Buffer.alloc(length);
  readSync(fd, buffer, 0, length, size - length);
  if (size <= MAX_OUTPUT_BYTES) return buffer.toString("utf8");
  const newline = buffer.indexOf(10);
  return buffer.subarray(newline === -1 ? length : newline + 1).toString("utf8");
}

/**
 * Runs the script with `/bin/sh -c` from `root`. The test file, when given, is the
 * first argument of the script (`$1`). The run stops at the timeout.
 */
export async function runTests(
  root: string,
  script: string,
  testFile: string | undefined,
  timeoutMs: number = DEFAULT_TEST_TIMEOUT_MS,
): Promise<TestRun> {
  // WHY: one file for both streams keeps their order, and a stray child of the
  // shell cannot keep a file open the way it keeps a pipe open.
  const dir = mkdtempSync(join(tmpdir(), "cstack-test-run-"));
  const fd = openSync(join(dir, "output.log"), "w+");
  try {
    // WHY: the script gets the path as "$1", so the path is never parsed as shell text.
    const args = ["-c", script, "cstack", ...(testFile === undefined ? [] : [testFile])];
    // WHY: a shell that leads its own process group lets us kill its children too.
    const child = spawn("/bin/sh", args, { cwd: root, detached: true, stdio: ["ignore", fd, fd] });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid, "SIGKILL");
    }, timeoutMs);
    const [code, signal] = await new Promise<[number | null, NodeJS.Signals | null]>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (c, s) => resolve([c, s]));
    }).finally(() => clearTimeout(timer));
    const exitCode = timedOut
      ? undefined
      : (code ?? 128 + (signal === null ? 0 : (constants.signals[signal] ?? 0)));
    return { script, exitCode, timedOut, output: readTail(fd) };
  } finally {
    closeSync(fd);
    rmSync(dir, { recursive: true, force: true });
  }
}
