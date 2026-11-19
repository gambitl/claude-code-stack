import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { HelperError, type HelperRole } from "../helper/record.js";
import { startHelper, type StartDeps } from "../helper/start.js";
import { createRunner } from "../orca/run.js";
import { TrackerError } from "../tracker/errors.js";
import { failWith } from "./errors.js";

export const HELPER_START_USAGE =
  "Usage: cstack helper start <executor|implementer|implementer-escalation> [--unit <n>] [--plan <file>]";

const ROLES: readonly string[] = ["executor", "implementer", "implementer-escalation"];

// The package root holds skills/. This file is in src/commands/ or dist/commands/.
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function helperStart(args: string[], io: Io, deps: Partial<StartDeps> = {}): Promise<number> {
  const prefix = "cstack helper start: ";
  let parsed;
  try {
    parsed = parseArgs({ args, options: { unit: { type: "string" }, plan: { type: "string" } }, strict: true, allowPositionals: true });
  } catch (error) {
    io.stderr(`${prefix}${(error as Error).message}. ${HELPER_START_USAGE}\n`);
    return 2;
  }
  const role = parsed.positionals[0];
  if (parsed.positionals.length !== 1 || role === undefined || !ROLES.includes(role)) {
    io.stderr(`${HELPER_START_USAGE}\n`);
    return 2;
  }
  const rawUnit = parsed.values.unit;
  if (rawUnit !== undefined && !/^[1-9]\d{0,3}$/.test(rawUnit)) {
    io.stderr(`${prefix}--unit takes a whole number from 1. ${HELPER_START_USAGE}\n`);
    return 2;
  }
  if ((role === "executor") !== (rawUnit === undefined)) {
    io.stderr(`${prefix}${role === "executor" ? "The executor takes no --unit." : "This role needs --unit <n>."} ${HELPER_START_USAGE}\n`);
    return 2;
  }
  try {
    return await startHelper(
      { role: role as HelperRole, unit: rawUnit === undefined ? null : Number(rawUnit), plan: parsed.values.plan },
      io,
      {
        cwd: process.cwd(),
        env: process.env,
        packageRoot: PACKAGE_ROOT,
        createRunner,
        now: () => new Date(),
        ...deps,
      },
    );
  } catch (error) {
    if (error instanceof HelperError || error instanceof TrackerError) {
      io.stderr(`${prefix}${error.message}\n`);
      return error.exitCode;
    }
    return failWith(error, io, prefix);
  }
}
