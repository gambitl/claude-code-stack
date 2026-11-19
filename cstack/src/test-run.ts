import type { TestCommands } from "./settings.js";

/** The time a test run may take before cstack stops it: ten minutes. */
export const DEFAULT_TEST_TIMEOUT_MS = 600_000;

/** The result of one test run. */
export type TestRun = {
  /** The exact script handed to `/bin/sh -c`. */
  script: string;
  /** The exit code of the shell, or undefined when the run reached its timeout. */
  exitCode: number | undefined;
  /** True when the run was stopped because it reached its timeout. */
  timedOut: boolean;
  /** The output of the run, standard output and standard error in the order written. */
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
