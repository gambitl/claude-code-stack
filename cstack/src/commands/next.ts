import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { PHASES, type PhaseName } from "../phases.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan } from "../plan/read.js";
import { clearCurrentRun, markStarted, missingToStart, nextPhase, phaseContext } from "../run-progress.js";
import { createRun, readCurrentRun, readState, writeCurrentRun } from "../run-state.js";
import { failWith } from "./errors.js";
import { readGuide } from "./guide.js";

const USAGE = "Usage: cstack next [--done <phase> | --phase <phase> | --new] [--plan <file>]\n";
const SKILL = "resolve-issue";

export interface NextOptions {
  cwd: string;
  packageRoot: string;
  now?: () => Date;
}

function usageError(io: Io, problem: string): number {
  io.stderr(`cstack: ${problem}\n${USAGE}`);
  return 2;
}

function runLine(file: string | undefined, name: PhaseName): string {
  const index = PHASES.findIndex((p) => p.name === name);
  const place = PHASES[index]?.runsIn;
  return `Run: ${file ?? "none yet"}. Phase ${index + 1} of ${PHASES.length}: ${name}, in the ${place}.\n`;
}

/** Prints the run line and then the guide, as two writes, so that a later ticket can print between them. */
function printGuide(io: Io, packageRoot: string, file: string | undefined, name: PhaseName): number {
  const guide = readGuide(packageRoot, SKILL, name);
  if (!guide.ok) {
    io.stderr(guide.message);
    return 1;
  }
  io.stdout(runLine(file, name));
  io.stdout(guide.text);
  return 0;
}

export function next(args: string[], io: Io, options: NextOptions): number {
  let values;
  try {
    values = parseArgs({
      args,
      options: {
        done: { type: "string" },
        phase: { type: "string" },
        new: { type: "boolean" },
        plan: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    return usageError(io, error instanceof Error ? error.message : String(error));
  }
  if (values.done !== undefined && values.phase !== undefined) {
    return usageError(io, "--done and --phase cannot be used together");
  }
  if (values.new && Object.keys(values).length > 1) return usageError(io, "--new cannot be used with another flag");
  for (const name of [values.done, values.phase]) {
    if (name !== undefined && !PHASES.some((p) => p.name === name)) {
      return usageError(io, `unknown phase "${name}". The phases are: ${PHASES.map((p) => p.name).join(", ")}`);
    }
  }
  if (values.done !== undefined) return usageError(io, "--done is not built yet");

  const now = options.now ?? (() => new Date());
  try {
    if (values.new) {
      clearCurrentRun(options.cwd);
      return printGuide(io, options.packageRoot, undefined, "ticket");
    }
    const wantsRun = values.plan !== undefined || values.phase !== undefined || readCurrentRun(options.cwd) !== undefined;
    if (!wantsRun) return printGuide(io, options.packageRoot, undefined, "ticket");

    const located = locatePlan(options.cwd, values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    let state = readState(located.root, located.relative);
    if (values.plan !== undefined) {
      state = createRun(located.root, located.relative, plan);
      writeCurrentRun(located.root, located.relative);
    }
    if (!state) state = createRun(located.root, located.relative, plan);

    const name = (values.phase as PhaseName | undefined) ?? nextPhase(state);
    if (name === undefined) {
      io.stdout(`Run: ${located.relative}. The run is finished.\n`);
      return 0;
    }
    const missing = missingToStart(name, state, phaseContext(located.root, located.relative, plan, state));
    if (missing.length > 0) {
      io.stderr(`cstack: the phase ${name} cannot start.\n${missing.map((m) => `${m}\n`).join("")}`);
      return 1;
    }
    const code = printGuide(io, options.packageRoot, located.relative, name);
    if (code === 0) markStarted(located.root, located.relative, name, now());
    return code;
  } catch (error) {
    return failWith(error, io, "cstack: ");
  }
}
