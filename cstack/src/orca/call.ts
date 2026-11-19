import type { Runner, RunResult } from "./run.js";

// The program that cstack runs for Orca. ORCA_CLI_COMMAND names one program.
// It is never split into words.
export function orcaProgram(env: Record<string, string | undefined>): string {
  const named = env["ORCA_CLI_COMMAND"];
  return named !== undefined && named !== "" ? named : "orca";
}

// Runs one Orca command. Every command except --version gets --json.
export function callOrca(
  run: Runner,
  env: Record<string, string | undefined>,
  args: string[],
): Promise<RunResult> {
  const full = args.includes("--version") ? args : [...args, "--json"];
  return run(orcaProgram(env), full);
}
