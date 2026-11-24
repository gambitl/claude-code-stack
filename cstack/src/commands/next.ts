import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { localTime } from "../local-time.js";
import { PHASES, type PhaseName } from "../phases.js";
import { setHeaderValues } from "../plan/header-write.js";
import { factProblems } from "../plan/approval.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan } from "../plan/read.js";
import { clearCurrentRun, isDone, markDone, markStarted, missingToStart, nextPhase, phaseContext } from "../run-progress.js";
import { createRun, cstackVersion, readCurrentRun, readState, RunStateError, writeCurrentRun, writeFileAtomic } from "../run-state.js";
import { readSettings } from "../settings.js";
import { settingsBlock } from "../settings-block.js";
import { failWith } from "./errors.js";
import { withoutBlock } from "../guide-steps.js";
import { readGuide } from "./guide.js";

const USAGE = "Usage: cstack next [--done <phase>] [--phase <phase>] [--plan <file>] [--new]\n";
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

/** Prints the run line, the settings block and the guide, as three writes. */
function printGuide(io: Io, packageRoot: string, file: string | undefined, name: PhaseName, block: string): number {
  const guide = readGuide(packageRoot, SKILL, name);
  if (!guide.ok) {
    io.stderr(guide.message);
    return 1;
  }
  const body = withoutBlock(guide.text, `guides/${SKILL}/${name}.md`);
  if (!body.ok) {
    io.stderr(`cstack: ${body.message}\n`);
    return 3;
  }
  io.stdout(runLine(file, name));
  io.stdout(block);
  io.stdout(body.text);
  return 0;
}

const placeOf = (name: PhaseName) => PHASES.find((p) => p.name === name)?.runsIn;

/** The header lines that the `writes` list of a phase names, with their new values. */
function headerValues(writes: string[], now: Date): Record<string, string> {
  const values: Record<string, string> = {};
  for (const entry of writes) {
    const colon = entry.indexOf(": ");
    if (entry === "Written by") values[entry] = `cstack ${cstackVersion()}`;
    else if (colon > 0) values[entry.slice(0, colon)] = entry.slice(colon + 2);
    else values[entry] = localTime(now);
  }
  return values;
}

/** The notice that comes after `--done retro` when ten or more retrospectives wait. */
function digestNotice(root: string): string {
  let count = 0;
  try {
    count = readdirSync(join(root, "docs", "retros"), { withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".md"),
    ).length;
  } catch {
    // A missing folder counts as zero.
  }
  if (count < 10) return "";
  return `\n## Digest due\n\n${count} retrospectives are waiting in docs/retros/. Run the digest-retros skill in a fresh session.\n`;
}

function repositoryRoot(cwd: string): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  const root = result.stdout?.trim();
  if (result.status !== 0 || !root) throw new RunStateError(`"${cwd}" is not inside a git repository.`);
  return root;
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
  if (values.done === "ticket" && values.plan === undefined) {
    return usageError(io, "--done ticket needs --plan <file>");
  }

  const now = options.now ?? (() => new Date());
  try {
    // WHY: the settings are read before any state is written, so an invalid file stops every call at once (plan of ticket #23).
    const block = settingsBlock(readSettings(repositoryRoot(options.cwd)));
    if (values.new) {
      clearCurrentRun(options.cwd);
      return printGuide(io, options.packageRoot, undefined, "ticket", block);
    }
    const wantsRun =
      values.plan !== undefined ||
      values.phase !== undefined ||
      values.done !== undefined ||
      readCurrentRun(options.cwd) !== undefined;
    if (!wantsRun) return printGuide(io, options.packageRoot, undefined, "ticket", block);

    const located = locatePlan(options.cwd, values.plan);
    const planText = readFileSync(located.path, "utf8");
    const plan = readPlan(planText);
    let state = readState(located.root, located.relative);
    if (values.plan !== undefined) {
      state = createRun(located.root, located.relative, plan);
      writeCurrentRun(located.root, located.relative);
    }
    if (!state) state = createRun(located.root, located.relative, plan);
    const context = phaseContext(located.root, located.relative, plan, state);

    let notice = "";
    let after: PhaseName | undefined;
    let closedNow = false;
    if (values.done !== undefined) {
      const closed = values.done as PhaseName;
      const phase = PHASES.find((p) => p.name === closed);
      if (isDone(state, closed) && closed !== "retro") {
        io.stdout(`${closed} is already done.\n`);
      } else {
        const missing = [...missingToStart(closed, state, context), ...(phase?.done?.(context) ?? []), ...(closed === "plan" ? factProblems(located.root, plan.facts) : [])];
        if (missing.length > 0) {
          io.stderr(`cstack: the phase ${closed} cannot be closed.\n${missing.map((m) => `${m}\n`).join("")}`);
          return 1;
        }
        // WHY: the header lines are written first and the phase is marked done second. A crash in between leaves the phase open, and the next --done writes the same lines again.
        if (phase?.writes?.length) {
          writeFileAtomic(located.path, setHeaderValues(planText, headerValues(phase.writes, now())));
        }
        markDone(located.root, located.relative, closed, now());
        state = readState(located.root, located.relative) ?? state;
        closedNow = true;
      }
      after = closed;
      if (closed === "retro") notice = digestNotice(located.root);
    }

    const name = (values.phase as PhaseName | undefined) ?? nextPhase(state);
    if (after === "retro" && !isDone(state, "ready")) {
      io.stdout("The run stopped. Run cstack next later to resume it.\n");
      io.stdout(notice);
      return 0;
    }
    if (name === undefined) {
      if (after !== undefined) io.stdout("The run is finished. Submit your published report with cstack helper done published --helper <helper id>.\n");
      else io.stdout(`Run: ${located.relative}. The run is finished.\n`);
      return 0;
    }
    const missing = missingToStart(name, state, phaseContext(located.root, located.relative, plan, state));
    if (missing.length > 0) {
      if (closedNow) io.stdout(`${after} is done.\n`);
      io.stderr(`cstack: the phase ${name} cannot start.\n${missing.map((m) => `${m}\n`).join("")}`);
      return 1;
    }
    if (after !== undefined && placeOf(name) !== placeOf(after)) {
      io.stdout(
        placeOf(name) === "executor"
          ? `The next phase, ${name}, runs in the executor. Launch the executor with the plan file path.\n`
          : `The next phase, ${name}, runs in the main conversation. Finish this guide, then submit your report.\n`,
      );
      io.stdout(notice);
      return 0;
    }
    const code = printGuide(io, options.packageRoot, located.relative, name, block);
    if (code === 0) markStarted(located.root, located.relative, name, now());
    io.stdout(notice);
    return code;
  } catch (error) {
    return failWith(error, io, "cstack: ");
  }
}
