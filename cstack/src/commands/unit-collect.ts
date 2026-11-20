import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan } from "../plan/read.js";
import type { CollectOrca } from "../unit/collect.js";
import { collectUnits } from "../unit/collect.js";
import { failWith } from "./errors.js";

export const UNIT_COLLECT_USAGE = "Usage: cstack unit collect <n>... [--discard-untracked] [--plan <file>]";

// With an Orca runner in the deps, the command also cleans up and returns a promise. Without one, it only applies the commits.
export function unitCollect(args: string[], io: Io, deps?: { cwd: string }): number;
export function unitCollect(args: string[], io: Io, deps: { cwd: string; orca: CollectOrca }): Promise<number>;
export function unitCollect(args: string[], io: Io, deps: { cwd: string; orca?: CollectOrca } = { cwd: process.cwd() }): number | Promise<number> {
  const prefix = "cstack unit collect: ";
  let parsed;
  try {
    parsed = parseArgs({ args, options: { plan: { type: "string" }, "discard-untracked": { type: "boolean" } }, strict: true, allowPositionals: true });
  } catch (error) {
    io.stderr(`${prefix}${(error as Error).message}\n${UNIT_COLLECT_USAGE}\n`);
    return 2;
  }
  if (parsed.positionals.length === 0 || parsed.positionals.some((p) => !/^[1-9][0-9]*$/.test(p))) {
    io.stderr(`${prefix}Give one or more unit numbers.\n${UNIT_COLLECT_USAGE}\n`);
    return 2;
  }
  try {
    const located = locatePlan(deps.cwd, parsed.values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    const numbers = parsed.positionals.map(Number);
    const unknown = numbers.filter((n) => !plan.units.some((u) => u.number === n));
    if (unknown.length > 0) {
      io.stderr(`${prefix}The plan has no unit ${unknown.join(", ")}.\n${UNIT_COLLECT_USAGE}\n`);
      return 2;
    }
    if (!deps.orca) return collectUnits(located, plan, numbers, io);
    return collectUnits(located, plan, numbers, io, deps.orca, { discardUntracked: parsed.values["discard-untracked"] === true }).catch((error) => failWith(error, io, prefix));
  } catch (error) {
    return failWith(error, io, prefix);
  }
}
