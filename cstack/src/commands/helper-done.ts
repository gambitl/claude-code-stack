// WHY: the report text is external input. It is read from standard input, checked, saved as JSON and never passed to a shell or a command line.
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { doneHelper, type DoneDeps } from "../helper/done.js";
import { checkHelperId } from "../helper/record.js";
import { createRunner } from "../orca/run.js";
import { failWith } from "./errors.js";
import { MAX_BYTES, readStdin } from "./report-submit.js";

export const HELPER_DONE_USAGE = "Usage: cstack helper done <kind> --helper <helper id> [--plan <file>]";

export async function helperDone(
  args: string[],
  io: Io,
  deps: Partial<DoneDeps> & { readInput?: () => Promise<Buffer | undefined> | Buffer | undefined } = {},
): Promise<number> {
  const prefix = "cstack helper done: ";
  let parsed;
  try {
    parsed = parseArgs({ args, options: { helper: { type: "string" }, plan: { type: "string" } }, strict: true, allowPositionals: true });
  } catch (error) {
    io.stderr(`${prefix}${(error as Error).message}. ${HELPER_DONE_USAGE}\n`);
    return 2;
  }
  const helper = parsed.values.helper;
  if (parsed.positionals.length !== 1 || helper === undefined) {
    io.stderr(`${HELPER_DONE_USAGE}\n`);
    return 2;
  }
  try {
    checkHelperId(helper);
    const input = await (deps.readInput ?? (() => readStdin()))();
    if (input === undefined) {
      io.stderr("There is no report text. Pipe the text of the report into this command.\n");
      return 2;
    }
    if (input.length > MAX_BYTES) {
      io.stderr(`The report text is more than ${MAX_BYTES} bytes, which is the limit.\n`);
      return 1;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(input);
    } catch {
      io.stderr("The report text is not valid UTF-8.\n");
      return 1;
    }
    return await doneHelper(
      { kind: parsed.positionals[0]!, helper, text, plan: parsed.values.plan },
      io,
      { cwd: process.cwd(), env: process.env, createRunner, now: () => new Date(), ...deps },
    );
  } catch (error) {
    return failWith(error, io, prefix);
  }
}
