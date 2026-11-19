import { execFile } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";

export type RunResult =
  | { kind: "ok"; stdout: string; stderr?: string }
  | { kind: "failed"; exitCode: number; stderr?: string }
  | { kind: "missing" }
  | { kind: "timeout" }
  | { kind: "too-large" };

export type Runner = (
  command: string,
  args: string[],
  cwd?: string,
) => Promise<RunResult>;

// Node cuts the output of execFile at 1 MiB by default. The Orca command
// list alone is larger than that, so the limit is explicit.
export const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

// The only way cstack runs a program. It never uses a shell.
export function createRunner(timeoutMs: number): Runner {
  return (command, args, cwd) =>
    new Promise((resolve) => {
      execFile(
        command,
        args,
        {
          timeout: timeoutMs,
          killSignal: "SIGKILL",
          encoding: "utf8",
          maxBuffer: MAX_OUTPUT_BYTES,
          ...(cwd ? { cwd } : {}),
        },
        (error, stdout, stderr) => {
          if (!error) {
            resolve({ kind: "ok", stdout, stderr });
            return;
          }
          const e = error as NodeJS.ErrnoException & { killed?: boolean };
          if (e.code === "ENOENT") resolve({ kind: "missing" });
          else if (e.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER")
            resolve({ kind: "too-large" });
          else if (e.killed) resolve({ kind: "timeout" });
          else
            resolve({
              kind: "failed",
              exitCode: typeof e.code === "number" ? e.code : 1,
              stderr,
            });
        },
      );
    });
}

export function findOnPath(
  command: string,
  pathString: string,
): string | undefined {
  for (const dir of pathString.split(delimiter)) {
    if (!dir) continue;
    const file = join(dir, command);
    try {
      if (!statSync(file).isFile()) continue;
      accessSync(file, constants.X_OK);
      return file;
    } catch {
      continue;
    }
  }
  return undefined;
}
