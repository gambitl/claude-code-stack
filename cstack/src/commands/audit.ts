import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readCalls } from "../audit/calls.js";
import { mainFiles } from "../audit/main-session.js";
import { evaluatePhases, evaluateSteps, formatLine } from "../audit/evaluate.js";
import { readSteps, type Step } from "../guide-steps.js";
import type { Io } from "../io.js";
import { MomentsError, readMoments, worktreeFolders } from "../measure/moments.js";
import { findRunFiles } from "../measure/sessions.js";
import { PHASES } from "../phases.js";
import { PlanFormatError, readPlan, type PlanRead } from "../plan/read.js";
import { cstackVersion, planFileName, runFolder, readState, RunStateError, type RunState } from "../run-state.js";

export const AUDIT_USAGE = "Usage: cstack audit <plan file> [--home <folder>] [--guides <folder>]";
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+[0-9A-Za-z.+-]*$/;

export async function audit(args: string[], io: Io, options: { packageRoot: string }): Promise<number> {
  const fail = (code: number, sentence: string): number => {
    io.stderr(`cstack audit: ${sentence}\n`);
    return code;
  };
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { home: { type: "string" }, guides: { type: "string" } },
      strict: true,
      allowPositionals: true,
    });
  } catch {
    io.stderr(`cstack audit: the command line is wrong.\n${AUDIT_USAGE}\n`);
    return 2;
  }
  const [planArgument, ...extra] = parsed.positionals;
  if (planArgument === undefined || extra.length > 0) {
    io.stderr(`cstack audit: give exactly one plan file.\n${AUDIT_USAGE}\n`);
    return 2;
  }
  let moments;
  try {
    moments = await readMoments(planArgument);
  } catch (error) {
    if (!(error instanceof MomentsError)) throw error;
    return fail(3, error.message);
  }
  let plan: PlanRead;
  try {
    plan = readPlan(readFileSync(planArgument, "utf8"));
  } catch (error) {
    if (!(error instanceof PlanFormatError)) throw error;
    return fail(3, "the plan file is not a valid cstack plan file.");
  }
  let state: RunState | undefined;
  try {
    planFileName(planArgument);
    state = readState(moments.root, planArgument);
  } catch (error) {
    if (!(error instanceof RunStateError)) throw error;
    return fail(3, "the run state of this plan file cannot be used.");
  }
  if (state === undefined) return fail(3, "this plan file has no run state, so cstack next never ran it.");
  const times = Object.values(state.phases ?? {})
    .flatMap((phase) => [phase?.startedAt, phase?.doneAt])
    .flatMap((value) => (typeof value === "string" ? [Date.parse(value)] : []))
    .filter((time) => !Number.isNaN(time));
  if (times.length === 0) return fail(3, "the run state of this plan file cannot be used.");

  const guidesFolder = parsed.values.guides;
  if (guidesFolder === undefined && state.writtenBy !== cstackVersion()) {
    const writer = typeof state.writtenBy === "string" && VERSION.test(state.writtenBy) ? `cstack ${state.writtenBy}` : "another version of cstack";
    return fail(1, `${writer} wrote this run, and this is cstack ${cstackVersion()}. Give the guides of the run with --guides <folder>.`);
  }
  const guides = join(guidesFolder ?? join(options.packageRoot, "guides"), "resolve-issue");
  const guideSteps: Record<string, Step[]> = {};
  for (const { name } of PHASES) {
    let text: string;
    try {
      text = readFileSync(join(guides, `${name}.md`), "utf8");
    } catch {
      return fail(3, `the guide of the phase ${name} is missing.`);
    }
    const steps = readSteps(text, `the guide of the phase ${name}`);
    if (!steps.ok) return fail(3, steps.message);
    if (steps.steps.length === 0) return fail(3, `the guide of the phase ${name} has no block of mandatory steps.`);
    guideSteps[name] = steps.steps;
  }

  let folders;
  try {
    folders = await worktreeFolders(moments.root, moments.worktrees);
  } catch {
    return fail(5, "git cannot list the worktrees of the repository.");
  }
  const found = await findRunFiles(
    parsed.values.home ?? homedir(),
    moments.root,
    new Date(Math.min(...times)),
    new Date(Math.max(...times)),
    folders.listed,
    folders.planned,
  );
  if (!found.files.some((file) => !file.helper)) return fail(3, "no session file of this run was found.");
  const read = await readCalls(found.files);
  const main = mainFiles(read.calls, planArgument);
  const phaseLines = evaluatePhases(state, read.calls);
  const stepLines = evaluateSteps({
    guides: guideSteps,
    units: plan.units,
    calls: read.calls,
    mainFiles: main.files,
    state,
    phaseLines,
    runFolder: runFolder(moments.root, planArgument),
    root: moments.root,
    targetBranch: plan.header["Target branch"],
  });
  const lines = [...phaseLines, ...stepLines];
  for (const line of lines) io.stdout(`${formatLine(line)}\n`);
  const unreadable = found.unreadableFiles + read.unreadableFiles > 0;
  if (unreadable) io.stderr("cstack audit: some session files could not be read, so some steps may show as skipped.\n");
  if (main.fallback) {
    io.stderr("cstack audit: no session file holds the close of the ticket phase, so the steps of the main conversation may show the calls of another agent.\n");
  }
  return unreadable || main.fallback || lines.some((line) => line.verdict !== "done") ? 1 : 0;
}
