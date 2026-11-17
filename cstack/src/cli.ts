import { parseArgs } from "node:util";
import { version } from "./commands/version.js";
import { type Io, processIo } from "./io.js";

const USAGE = `Usage: cstack --version

Options:
  --version  Print the version of cstack.

No command exists yet.
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
  if (!first.startsWith("-")) return fail(io, `unknown command "${first}"`);
  try {
    const { values } = parseArgs({
      args,
      options: { version: { type: "boolean" } },
      strict: true,
      allowPositionals: false,
    });
    if (values.version) return version(io);
    return fail(io, "no command given");
  } catch (error) {
    return fail(io, error instanceof Error ? error.message : String(error));
  }
}
