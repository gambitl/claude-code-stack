// WHY: This is the temporary copy of the test runner for ticket #20. Ticket #17 owns this file,
// and the copy of ticket #17 replaces this one at the merge without any change to an import.
// This is the one file of cstack/src/ that runs a shell on purpose, because `testCommands`
// is a shell command line by design.
import { spawn } from "node:child_process";
import type { TestCommands } from "./settings.js";

/** Ten minutes, the default timeout of a test run. */
export const DEFAULT_TEST_TIMEOUT_MS = 600_000;

export interface TestRun {
  /** The script given to `/bin/sh -c`. */
  script: string;
  /** The exit code of `/bin/sh`. It is undefined when the run was stopped at the timeout. */
  exitCode: number | undefined;
  timedOut: boolean;
  /** Standard output and standard error together, in the order they were written. */
  output: string;
}

/** `testCommands.file` with `{file}` replaced by `"$1"` when it is set and `testFile` is given. Otherwise `testCommands.all`. */
export function testScript(commands: TestCommands, testFile?: string): string {
  if (commands.file !== undefined && testFile !== undefined) {
    return commands.file.split("{file}").join('"$1"');
  }
  return commands.all;
}

/** Runs `/bin/sh -c <script> cstack [testFile]` from `root`, with no other shell, and waits until it ends or times out. */
export function runTests(
  root: string,
  script: string,
  testFile: string | undefined,
  timeoutMs: number = DEFAULT_TEST_TIMEOUT_MS,
): Promise<TestRun> {
  return new Promise((resolve) => {
    const args = ["-c", script, "cstack", ...(testFile === undefined ? [] : [testFile])];
    const child = spawn("/bin/sh", args, {
      cwd: root,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let timedOut = false;
    let settled = false;
    const killGroup = (): void => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        // The group is already gone.
      }
    };
    const onSignal = (signal: NodeJS.Signals): void => {
      killGroup();
      cleanup();
      process.kill(process.pid, signal);
    };
    const onInt = (): void => onSignal("SIGINT");
    const onTerm = (): void => onSignal("SIGTERM");
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);
    function cleanup(): void {
      clearTimeout(timer);
      process.removeListener("SIGINT", onInt);
      process.removeListener("SIGTERM", onTerm);
    }
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    const finish = (code: number | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        script,
        exitCode: timedOut || code === null ? undefined : code,
        timedOut,
        output,
      });
    };
    child.on("error", (error) => {
      output += String(error);
      finish(1);
    });
    child.on("close", finish);
  });
}

/** The last `count` lines of the output, 40 by default. */
export function lastLines(output: string, count = 40): string {
  const lines = output.replace(/\n$/, "").split("\n");
  return lines.slice(-count).join("\n");
}
