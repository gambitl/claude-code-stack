import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { listUnitCommits } from "../plan/commits.js";
import { locatePlan, PlanLocationError } from "../plan/locate.js";
import { orderUnits, type UnitOrder } from "../plan/order.js";
import { PlanFormatError, readPlan } from "../plan/read.js";
import { RunStateError } from "../run-state.js";

export const UNIT_ORDER_USAGE = "Usage: cstack unit order [--json] [--plan <file>]";

const list = (numbers: number[]) => (numbers.length === 1 ? `unit ${numbers[0]}` : `units ${numbers.join(", ")}`);

function text(order: UnitOrder): string {
  const lines: string[] = [];
  if (order.batches.length === 0) lines.push("No unit is left to run.");
  order.batches.forEach((batch, i) => lines.push(`Batch ${i + 1}: ${list(batch)}`));
  for (const w of order.waits) lines.push(`Unit ${w.unit} waits: ${w.reason}.`);
  for (const s of order.setAside) lines.push(`Unit ${s.unit} is set aside: ${s.reason}.`);
  if (order.committed.length === 1) lines.push(`Unit ${order.committed[0]} already has a commit.`);
  else if (order.committed.length > 1) lines.push(`Units ${order.committed.join(", ")} already have a commit.`);
  return `${lines.join("\n")}\n`;
}

export async function unitOrder(args: string[], io: Io, cwd: string = process.cwd()): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { json: { type: "boolean" }, plan: { type: "string" } },
      strict: true,
      allowPositionals: false,
    });
  } catch (error) {
    io.stderr(`cstack unit order: ${error instanceof Error ? error.message : String(error)}\n${UNIT_ORDER_USAGE}\n`);
    return 2;
  }
  try {
    const located = locatePlan(cwd, parsed.values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    const commits = listUnitCommits(located.root, plan.header["Target branch"]);
    const committed = new Set(Object.keys(commits.units).map(Number));
    const result = orderUnits(plan.units, committed);
    if (!result.ok) {
      const steps = result.cycle.map((n, i) => `unit ${n} depends on unit ${result.cycle[(i + 1) % result.cycle.length]}`);
      const last = steps.pop() as string;
      io.stderr(
        `cstack unit order: The Depends on lines form a cycle: ${steps.length ? `${steps.join(", ")}, and ` : ""}${last}.\n`,
      );
      return 1;
    }
    io.stdout(parsed.values.json ? `${JSON.stringify(result.order)}\n` : text(result.order));
    return 0;
  } catch (error) {
    if (error instanceof PlanFormatError || error instanceof RunStateError || error instanceof PlanLocationError) {
      io.stderr(`cstack unit order: ${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
}
