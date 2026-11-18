// WHY: the report text is external input. It is read from standard input, checked, saved as JSON and never passed to a shell or a command line.
import type { Io } from "../io.js";
import { locatePlan, PlanLocationError } from "../plan/locate.js";
import { PlanFormatError } from "../plan/read.js";
import { EXECUTOR_KINDS, checkReport, saveReport } from "../report/reports.js";
import { RunStateError, type SavedReport } from "../run-state.js";

const MAX_BYTES = 65_536;
const USAGE = "Usage: cstack report submit <kind> [--plan <file>]\n";

/** Reads all of standard input. Returns nothing when standard input is a terminal. */
export async function readStdin(): Promise<Buffer | undefined> {
  if (process.stdin.isTTY) return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function reportSubmit(
  args: string[],
  io: Io,
  options: { cwd: string; readInput: () => Promise<Buffer | undefined> | Buffer | undefined },
): Promise<number> {
  let planFlag: string | undefined;
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--plan") {
      planFlag = args[++i];
      if (planFlag === undefined) {
        io.stderr("The flag --plan needs a file.\n");
        return 2;
      }
    } else if (arg.startsWith("--plan=")) planFlag = arg.slice("--plan=".length);
    else if (arg.startsWith("--")) {
      io.stderr(`Unknown option ${arg}. ${USAGE}`);
      return 2;
    } else words.push(arg);
  }
  if (words.length !== 1) {
    io.stderr(USAGE);
    return 2;
  }
  const kind = words[0]!;

  const input = await options.readInput();
  if (input === undefined) {
    io.stderr("There is no report text. Pipe the text of the report into this command.\n");
    return 2;
  }
  if (input.length > MAX_BYTES) {
    io.stderr(`The report text is ${input.length} bytes. The limit is ${MAX_BYTES} bytes.\n`);
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
    io.stdout(`The ${kind} report was accepted and saved. Allowed kinds: ${EXECUTOR_KINDS.join(", ")}.\n`);
    return 0;
  } catch (error) {
    if (error instanceof PlanLocationError) {
      io.stderr(`${error.message}\n`);
      return error.exitCode;
    }
    if (error instanceof PlanFormatError) {
      io.stderr(`${error.message}\n${error.problems.map((p) => `line ${p.line}: ${p.rule}`).join("\n")}\n`);
      return 3;
    }
    if (error instanceof RunStateError) {
      io.stderr(`${error.message}\n`);
      return 3;
    }
    throw error;
  }
}
