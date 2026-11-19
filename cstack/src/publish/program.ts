import { spawnSync } from "node:child_process";

// WHY: every git, gh, glab and ssh call of `cstack publish` goes through this one
// function, and it never starts a shell. Ticket #24 can then switch all of them onto
// the common program runner by changing only this file.
export interface ProgramResult {
  ok: boolean;
  code: number | undefined;
  stdout: string;
  stderr: string;
  missing: boolean;
}

export function runProgram(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): ProgramResult {
  const r = spawnSync(command, args, { cwd: options.cwd, env: options.env, encoding: "utf8" });
  const missing = (r.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
  return {
    ok: r.status === 0,
    code: r.status ?? undefined,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    missing,
  };
}
