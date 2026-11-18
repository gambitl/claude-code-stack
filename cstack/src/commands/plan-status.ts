import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { failWith } from "./errors.js";
import { listCommitFiles, listUnitCommits } from "../plan/commits.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan } from "../plan/read.js";
import { runFolder } from "../run-state.js";

export const PLAN_STATUS_USAGE = "Usage: cstack plan status [--plan <file>] [--json]";

interface Problem {
  kind: "unknown-unit" | "invalid-trailer" | "file-outside-unit";
  message: string;
  commit?: string;
  units?: number[];
  value?: string;
  file?: string;
}

const short = (hash: string) => hash.slice(0, 7);

export function planStatus(args: string[], io: Io, env: { cwd: string }): number {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { plan: { type: "string" }, json: { type: "boolean" } },
      strict: true,
      allowPositionals: false,
    });
  } catch {
    io.stderr(`cstack plan status: the command line is wrong.\n${PLAN_STATUS_USAGE}\n`);
    return 2;
  }
  try {
    const located = locatePlan(env.cwd, parsed.values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    const found = listUnitCommits(located.root, plan.header["Target branch"]);
    const folder = join(runFolder(located.root, located.relative), "units");

    const commitUnits = new Map<string, number[]>();
    for (const [unit, hashes] of Object.entries(found.units)) {
      for (const hash of hashes) commitUnits.set(hash, [...(commitUnits.get(hash) ?? []), Number(unit)]);
    }
    const files = listCommitFiles(located.root, [...commitUnits.keys()]);

    const units = plan.units.map((unit) => ({
      number: unit.number,
      name: unit.name,
      done: (found.units[unit.number] ?? []).length > 0,
      commits: found.units[unit.number] ?? [],
      blocked: unit.blocked ?? null,
      failingRunSaved: existsSync(join(folder, String(unit.number), "red.json")),
      passingRunSaved: existsSync(join(folder, String(unit.number), "green.json")),
    }));

    const problems: Problem[] = [];
    for (const [hash, numbers] of commitUnits) {
      const known = numbers.filter((n) => plan.units.some((u) => u.number === n));
      for (const n of numbers.filter((n) => !known.includes(n))) {
        problems.push({
          kind: "unknown-unit",
          message: `Commit ${short(hash)} names unit ${n}, and the plan has no such unit.`,
          commit: hash,
          units: [n],
        });
      }
      if (known.length === 0) continue;
      const allowed = new Set(plan.units.filter((u) => known.includes(u.number)).flatMap((u) => u.files));
      for (const file of files[hash] ?? []) {
        if (allowed.has(file)) continue;
        problems.push({
          kind: "file-outside-unit",
          message: `Commit ${short(hash)} of unit ${known.join(", ")} changes ${file}, which is not in the Files of that unit.`,
          commit: hash,
          units: known,
          file,
        });
      }
    }
    for (const value of found.invalid) {
      problems.push({
        kind: "invalid-trailer",
        message: `A commit has "Cstack-Unit: ${value}", and the value is not a unit number.`,
        value,
      });
    }

    if (parsed.values.json) {
      io.stdout(`${JSON.stringify({ units, problems }, null, 2)}\n`);
    } else {
      for (const unit of units) {
        const parts = [unit.done ? `done (${unit.commits.map(short).join(", ")})` : "not done"];
        if (unit.blocked !== null) parts.push(`blocked: ${unit.blocked}`);
        if (unit.failingRunSaved) parts.push("failing run saved");
        if (unit.passingRunSaved) parts.push("passing run saved");
        io.stdout(`Unit ${unit.number}: ${unit.name}: ${parts.join(", ")}\n`);
      }
      for (const problem of problems) io.stderr(`${problem.message}\n`);
    }
    return problems.length > 0 ? 1 : 0;
  } catch (error) {
    return failWith(error, io, "cstack plan status: ");
  }
}
