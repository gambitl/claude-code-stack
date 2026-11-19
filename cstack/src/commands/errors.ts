// WHY: the four plan and report commands end the same way when the plan or the run cannot be used. One helper keeps their messages and exit codes the same.
import type { Io } from "../io.js";
import { PlanLocationError } from "../plan/locate.js";
import { PlanFormatError } from "../plan/read.js";
import { RunStateError } from "../run-state.js";
import { SettingsError } from "../settings.js";

/** Prints the message of a known error on standard error and returns its exit code. It throws any other error again. */
export function failWith(error: unknown, io: Io, prefix = ""): number {
  if (error instanceof PlanLocationError || error instanceof RunStateError) {
    io.stderr(`${prefix}${error.message}\n`);
    return error.exitCode;
  }
  if (error instanceof SettingsError) {
    io.stderr(`${prefix}${error.message}\n`);
    return 3;
  }
  if (error instanceof PlanFormatError) {
    const lines = error.problems.map((p) => `line ${p.line}: ${p.rule}\n`).join("");
    io.stderr(`${prefix}${error.message}\n${lines}`);
    return error.exitCode;
  }
  throw error;
}
