// WHY: the four tracker commands parse the same options, find the same root and end the same way. One file keeps their messages and exit codes equal.
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { COMMANDS, EXIT } from "../manifest.js";
import type { Runner } from "../orca/run.js";
import { TrackerError } from "../tracker/errors.js";
import type { TrackerName } from "../tracker/types.js";

/** What a tracker command needs from the outside. Tests pass a fake runner. */
export interface TrackerDeps {
  cwd: string;
  run: Runner;
  env: Record<string, string | undefined>;
}

const TRACKERS: TrackerName[] = ["jira", "linear", "github", "gitlab"];

export const KEY_HINT = "A key such as #12 must be written in single quotes, as '#12', because the shell reads an unquoted #12 as a comment.";

/** The manifest usage line of a tracker command, such as "read". */
export function trackerUsage(word: string): string {
  return (COMMANDS.find((e) => e.usage.startsWith(`cstack tracker ${word} `)) as { usage: string }).usage;
}

/** Prints a usage error with the usage line of the command and returns exit code 2. */
export function usageError(io: Io, word: string, problem: string, hint = ""): number {
  io.stderr(`cstack tracker ${word}: ${problem}\n${hint ? `${hint}\n` : ""}Usage: ${trackerUsage(word)}\n`);
  return EXIT.usage;
}

/** Reads the command line. A wrong line gives a message for a usage error, not an exception. */
export function parseTrackerArgs<T extends Record<string, { type: "string" }>>(
  args: string[],
  options: T,
): { values: { [K in keyof T]?: string }; positionals: string[] } | { problem: string } {
  try {
    const { values, positionals } = parseArgs({ args, options, strict: true, allowPositionals: true });
    return { values: values as { [K in keyof T]?: string }, positionals };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
}

/** `--tracker` accepts only the four tracker names. */
export function trackerName(value: string | undefined): TrackerName | undefined | "bad" {
  if (value === undefined) return undefined;
  return (TRACKERS as string[]).includes(value) ? (value as TrackerName) : "bad";
}

/** The repository root, found with git through the runner. When git fails, it is the current folder. */
export async function findRoot(deps: TrackerDeps): Promise<string> {
  const result = await deps.run("git", ["rev-parse", "--show-toplevel"], deps.cwd);
  const top = result.kind === "ok" ? result.stdout.trim() : "";
  return top === "" ? deps.cwd : top;
}

/** A warning goes to standard error and starts with `cstack: `. */
export function warnTo(io: Io): (message: string) => void {
  return (message) => io.stderr(`${message.startsWith("cstack: ") ? "" : "cstack: "}${message}\n`);
}

/** Prints a tracker error with its exit code. Any other error is thrown again. */
export function failTracker(error: unknown, io: Io): number {
  if (error instanceof TrackerError) {
    io.stderr(`cstack: ${error.message}\n`);
    return error.exitCode;
  }
  throw error;
}
