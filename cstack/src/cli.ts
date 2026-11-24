import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { doctor } from "./commands/doctor.js";
import { helperDone } from "./commands/helper-done.js";
import { helperStart } from "./commands/helper-start.js";
import { helperWait } from "./commands/helper-wait.js";
import { guide } from "./commands/guide.js";
import { audit } from "./commands/audit.js";
import { measure } from "./commands/measure.js";
import { next } from "./commands/next.js";
import { publish } from "./commands/publish.js";
import { planSection } from "./commands/plan-section.js";
import { planStatus } from "./commands/plan-status.js";
import { reportCheck } from "./commands/report-check.js";
import { readStdin, reportSubmit } from "./commands/report-submit.js";
import { skills } from "./commands/skills.js";
import { trackerComment } from "./commands/tracker-comment.js";
import { trackerList } from "./commands/tracker-list.js";
import { trackerMove } from "./commands/tracker-move.js";
import { trackerRead } from "./commands/tracker-read.js";
import { unitCommit } from "./commands/unit-commit.js";
import { unitGreen } from "./commands/unit-green.js";
import { unitOrder } from "./commands/unit-order.js";
import { unitRed } from "./commands/unit-red.js";
import { version } from "./commands/version.js";
import { type Io, processIo } from "./io.js";
import { COMMANDS, type CommandEntry, EXIT, commandWords, unbuiltRefusal } from "./manifest.js";
import { createRunner } from "./orca/run.js";

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
  audit: (args, io) => audit(args, io, { packageRoot }),
  next: (args, io) => next(args, io, { cwd: process.cwd(), packageRoot }),
  skills: (args, io) => skills(args, io, { home: homedir(), packageRoot }),
  plan: (args, io) =>
    dispatchSubcommand("plan", args, io, {
      status: async (a, i) => planStatus(a, i, { cwd: process.cwd() }),
      section: (a, i) => planSection(a, i, { cwd: process.cwd() }),
    }),
  publish: (args, io) => publish(args, io),
  report: (args, io) =>
    dispatchSubcommand("report", args, io, {
      submit: (a, i) => reportSubmit(a, i, { cwd: process.cwd(), readInput: readStdin }),
      check: (a, i) => reportCheck(a, i, { cwd: process.cwd() }),
    }),
  helper: (args, io) =>
    dispatchSubcommand("helper", args, io, {
      start: (a, i) => helperStart(a, i),
      wait: (a, i) => helperWait(a, i),
      done: (a, i) => helperDone(a, i),
    }),
  tracker: (args, io) => {
    const deps = { cwd: process.cwd(), run: createRunner(60000), env: process.env };
    return dispatchSubcommand("tracker", args, io, {
      read: (a, i) => trackerRead(a, i, deps),
      list: (a, i) => trackerList(a, i, deps),
      move: (a, i) => trackerMove(a, i, deps),
      comment: (a, i) => trackerComment(a, i, deps),
    });
  },
  unit: (args, io) =>
    dispatchSubcommand("unit", args, io, {
      order: (a, i) => unitOrder(a, i), commit: (a, i) => unitCommit(a, i),
      red: (a, i) => unitRed(a, i),
      green: (a, i) => unitGreen(a, i),
    }),
};

/** `commands` decides which commands are not built yet. Tests pass their own list. */
export async function run(
  args: string[],
  io: Io = processIo,
  commands: CommandEntry[] = COMMANDS,
): Promise<number> {
  const first = args[0];
  if (first === undefined) {
    io.stderr(USAGE);
    return EXIT.usage;
  }
  const refusal = unbuiltRefusal(args, commands);
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
