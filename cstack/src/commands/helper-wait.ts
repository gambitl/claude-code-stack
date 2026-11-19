// WHY: the helper id becomes part of a file path, so it is checked against one strict pattern before any file is read.
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { checkHelperId } from "../helper/record.js";
import { waitHelper, type WaitDeps } from "../helper/wait.js";
import { createRunner } from "../orca/run.js";
import { failWith } from "./errors.js";

export const HELPER_WAIT_USAGE = "Usage: cstack helper wait <helper id>";

export async function helperWait(args: string[], io: Io, deps: Partial<WaitDeps> = {}): Promise<number> {
  const prefix = "cstack helper wait: ";
  let parsed;
  try {
    parsed = parseArgs({ args, options: {}, strict: true, allowPositionals: true });
  } catch (error) {
    io.stderr(`${prefix}${(error as Error).message}. ${HELPER_WAIT_USAGE}\n`);
    return 2;
  }
  const helper = parsed.positionals[0];
  if (parsed.positionals.length !== 1 || helper === undefined) {
    io.stderr(`${HELPER_WAIT_USAGE}\n`);
    return 2;
  }
  try {
    checkHelperId(helper);
    return await waitHelper(helper, io, {
      cwd: process.cwd(),
      env: process.env,
      createRunner,
      now: () => new Date(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      ...deps,
    });
  } catch (error) {
    return failWith(error, io, prefix);
  }
}
