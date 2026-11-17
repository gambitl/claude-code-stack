import { parseArgs } from "node:util";
import { version } from "./commands/version.js";
import { type Io, processIo } from "./io.js";

export async function run(args: string[], io: Io = processIo): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { version: { type: "boolean" } },
    strict: true,
    allowPositionals: false,
  });
  if (values.version) return version(io);
  return 0;
}
