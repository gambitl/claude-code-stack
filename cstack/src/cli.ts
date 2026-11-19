import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { doctor } from "./commands/doctor.js";
import { guide } from "./commands/guide.js";
import { measure } from "./commands/measure.js";
import { planSection } from "./commands/plan-section.js";
import { planStatus } from "./commands/plan-status.js";
import { reportCheck } from "./commands/report-check.js";
import { readStdin, reportSubmit } from "./commands/report-submit.js";
import { skills } from "./commands/skills.js";
import { unitCommit } from "./commands/unit-commit.js";
import { unitOrder } from "./commands/unit-order.js";
import { version } from "./commands/version.js";
import { type Io, processIo } from "./io.js";
import { COMMANDS, type CommandEntry, EXIT, commandWords, unbuiltRefusal } from "./manifest.js";

const BUILT = COMMANDS.filter((entry) => entry.built);

const USAGE = `Usage: cstack --version
${BUILT.map((entry) => `       ${entry.usage}`).join("\n")}

Commands:
${[...new Set(BUILT.map((entry) => commandWords(entry)[0]))]
  .map((word) => {
    const entry = BUILT.find((e) => commandWords(e)[0] === word) as CommandEntry;
    return `  ${word.padEnd(10)} ${entry.summary}`;
  })
  .join("\n")}

Options:
  --version  Print the version of cstack.
`;

function fail(io: Io, problem: string): number {
  io.stderr(`cstack: ${problem}\n${USAGE}`);
  return EXIT.usage;
}

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

/** The calls to the built commands, keyed by the first word of their usage line. */
export const HANDLERS: Record<string, (args: string[], io: Io) => number | Promise<number>> = {
  doctor: (args, io) => (args.length > 0 ? fail(io, "doctor takes no argument") : doctor(io)),
  guide: (args, io) => guide(args, io, { packageRoot }),
  measure: (args, io) => measure(args, io),
  skills: (args, io) => skills(args, io, { home: homedir(), packageRoot }),
  plan: (args, io) =>
    dispatchSubcommand("plan", args, io, {
      status: async (a, i) => planStatus(a, i, { cwd: process.cwd() }),
      section: (a, i) => planSection(a, i, { cwd: process.cwd() }),
    }),
  report: (args, io) =>
    dispatchSubcommand("report", args, io, {
      submit: (a, i) => reportSubmit(a, i, { cwd: process.cwd(), readInput: readStdin }),
      check: (a, i) => reportCheck(a, i, { cwd: process.cwd() }),
    }),
  unit: (args, io) => dispatchSubcommand("unit", args, io, { order: (a, i) => unitOrder(a, i), commit: (a, i) => unitCommit(a, i) }),
};

export async function run(args: string[], io: Io = processIo): Promise<number> {
  const first = args[0];
  if (first === undefined) {
    io.stderr(USAGE);
    return EXIT.usage;
  }
  const refusal = unbuiltRefusal(args);
  if (refusal !== undefined) {
    io.stderr(`cstack: ${refusal}\n`);
    return EXIT.refused;
  }
  if (Object.hasOwn(HANDLERS, first) && BUILT.some((e) => commandWords(e)[0] === first))
    return HANDLERS[first](args.slice(1), io);
  if (!first.startsWith("-")) return fail(io, `unknown command "${first}"`);
  let values: { version?: boolean };
  try {
    ({ values } = parseArgs({
      args,
      options: { version: { type: "boolean" } },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    return fail(io, error instanceof Error ? error.message : String(error));
  }
  // The command runs outside the try block, so a crash in it reaches bin.ts
  // (exit code 1) and is not mistaken for a usage error (exit code 2).
  if (values.version) return version(io);
  return fail(io, "no command given");
}

/** Sends `cstack <group> <word> ...` to the handler of the second word. */
export async function dispatchSubcommand(
  group: string,
  args: string[],
  io: Io,
  handlers: Record<string, (args: string[], io: Io) => Promise<number>>,
): Promise<number> {
  const word = args[0];
  if (word !== undefined && Object.hasOwn(handlers, word)) return handlers[word](args.slice(1), io);
  io.stderr(`cstack: usage: cstack ${group} <${Object.keys(handlers).join("|")}>\n`);
  return EXIT.usage;
}
