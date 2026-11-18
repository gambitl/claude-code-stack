// WHY: the report text is external input. It is read from standard input, checked, saved as JSON and never passed to a shell or a command line.
import type { Io } from "../io.js";
import { parseArgs } from "node:util";
import { locatePlan } from "../plan/locate.js";
import { checkReport, saveReport } from "../report/reports.js";
import type { SavedReport } from "../run-state.js";
import { failWith } from "./errors.js";

const MAX_BYTES = 65_536;
const USAGE = "Usage: cstack report submit <kind> [--plan <file>]";

/** Reads standard input, and stops as soon as more than the limit has arrived. Returns nothing when standard input is a terminal. */
export async function readStdin(stream: NodeJS.ReadableStream & { isTTY?: boolean } = process.stdin): Promise<Buffer | undefined> {
  if (stream.isTTY) return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
    size += chunks.at(-1)!.length;
    if (size > MAX_BYTES) break;
  }
  return Buffer.concat(chunks);
}

export async function reportSubmit(
  args: string[],
  io: Io,
  options: { cwd: string; readInput: () => Promise<Buffer | undefined> | Buffer | undefined },
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { plan: { type: "string" } }, strict: true, allowPositionals: true });
  } catch (error) {
    io.stderr(`${(error as Error).message}. ${USAGE}\n`);
    return 2;
  }
  const planFlag = parsed.values.plan;
  if (parsed.positionals.length !== 1) {
    io.stderr(`${USAGE}\n`);
    return 2;
  }
  const kind = parsed.positionals[0]!;

  const input = await options.readInput();
  if (input === undefined) {
    io.stderr("There is no report text. Pipe the text of the report into this command.\n");
    return 2;
  }
  if (input.length > MAX_BYTES) {
    // readStdin stops reading past the limit, so input.length is not the real size of the text.
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

  try {
    const located = locatePlan(options.cwd, planFlag);
    const where = { root: located.root, planFile: located.relative };
    const reasons = checkReport({ role: "executor", kind, text }, where);
    if (reasons.length > 0) {
      io.stderr(`${reasons.join("\n")}\n`);
      return 1;
    }
    saveReport(where, { kind: kind as SavedReport["kind"], text });
    io.stdout(`The ${kind} report was accepted and saved.\n`);
    return 0;
  } catch (error) {
    return failWith(error, io);
  }
}
