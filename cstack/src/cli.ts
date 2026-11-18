import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { doctor } from "./commands/doctor.js";
import { guide } from "./commands/guide.js";
import { measure } from "./commands/measure.js";
import { skills } from "./commands/skills.js";
import { version } from "./commands/version.js";
import { type Io, processIo } from "./io.js";

const USAGE = `Usage: cstack --version
       cstack doctor
       cstack guide <phase> [--skill <name>]
       cstack measure <plan file> [--home <folder>]
       cstack skills install [--adopt <name>]...

Commands:
  doctor     Check that the machine has what cstack needs.
  guide      Print a phase guide of the installed version.
  measure    Print the tokens and the waiting time of one run.
  skills     Install the skills that this version ships.

Options:
  --version  Print the version of cstack.
`;

function fail(io: Io, problem: string): number {
  io.stderr(`cstack: ${problem}\n${USAGE}`);
  return 2;
}

export async function run(args: string[], io: Io = processIo): Promise<number> {
  const first = args[0];
  if (first === undefined) {
    io.stderr(USAGE);
    return 2;
  }
  if (first === "doctor")
    return args.length > 1 ? fail(io, "doctor takes no argument") : doctor(io);
  if (first === "guide")
    return guide(args.slice(1), io, { packageRoot: fileURLToPath(new URL("..", import.meta.url)) });
  if (first === "skills")
    return skills(args.slice(1), io, {
      home: homedir(),
      packageRoot: fileURLToPath(new URL("..", import.meta.url)),
    });
  if (first === "measure") return measure(args.slice(1), io);
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
