import { execFile } from "node:child_process";
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";

export type RunResult =
  | { kind: "ok"; stdout: string }
  | { kind: "failed"; exitCode: number }
  | { kind: "missing" }
  | { kind: "timeout" };

export type Runner = (command: string, args: string[]) => Promise<RunResult>;

export function createRunner(timeoutMs: number): Runner {
  return (command, args) =>
    new Promise((resolve) => {
      execFile(
        command,
        args,
        { timeout: timeoutMs, encoding: "utf8" },
        (error, stdout) => {
          if (!error) {
            resolve({ kind: "ok", stdout });
            return;
          }
          const e = error as NodeJS.ErrnoException & { killed?: boolean };
          if (e.code === "ENOENT") resolve({ kind: "missing" });
          else if (e.killed) resolve({ kind: "timeout" });
          else
            resolve({
              kind: "failed",
              exitCode: typeof e.code === "number" ? e.code : 1,
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
