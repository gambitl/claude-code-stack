#!/usr/bin/env node
// WHY: ADR-SIC-H. This is the only file that touches the process. It sets
// process.exitCode and never calls process.exit(), because on macOS that can
// cut the output of a command whose output goes into a pipe.
import { run } from "./cli.js";

try {
  process.exitCode = await run(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`cstack: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
