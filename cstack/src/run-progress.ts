import { rmSync } from "node:fs";
import { PHASES, type PhaseContext, type PhaseName } from "./phases.js";
import { listUnitCommits } from "./plan/commits.js";
import type { PlanRead } from "./plan/read.js";
import { lastAcceptedDoneReportAt } from "./report/reports.js";
import { RunStateError, currentRunPath, readState, writeState, type RunState } from "./run-state.js";

/**
 * A phase is done when `state.json` holds a done time for it.
 * WHY: a retrospective done before `ready` was done at an earlier stop of the run. After `ready`, it must be done again, so that `publish` waits for a fresh one. The times are compared as dates, never as strings.
 */
export function isDone(state: RunState, name: PhaseName): boolean {
  const doneAt = state.phases[name]?.doneAt;
  if (!doneAt) return false;
  const readyAt = state.phases.ready?.doneAt;
  if (name === "retro" && readyAt) return Date.parse(doneAt) > Date.parse(readyAt);
  return true;
}

/** The first phase that is not done and whose dependencies are all done. */
export function nextPhase(state: RunState): PhaseName | undefined {
  return PHASES.find(
    (phase) => !isDone(state, phase.name) && phase.dependsOn.every((dependency) => isDone(state, dependency)),
  )?.name;
}

/** The check context of a run. The unit commits and the last done report are read only when a check asks for them. */
export function phaseContext(cwd: string, planFile: string, plan: PlanRead, state: RunState): PhaseContext {
  const doneAt: PhaseContext["doneAt"] = {};
  for (const [name, times] of Object.entries(state.phases)) {
    if (times?.doneAt) doneAt[name as PhaseName] = times.doneAt;
  }
  const context = { plan, doneAt } as PhaseContext;
  Object.defineProperty(context, "commits", {
    enumerable: true,
    get: () => listUnitCommits(cwd, plan.header["Target branch"]),
  });
  Object.defineProperty(context, "lastAcceptedDoneReportAt", {
    enumerable: true,
    get: () => lastAcceptedDoneReportAt({ root: cwd, planFile }),
  });
  return context;
}

/** What stops a phase from starting: its dependencies that are not done, then its own start check. An empty list means it can start. */
export function missingToStart(name: PhaseName, state: RunState, context: PhaseContext): string[] {
  const phase = PHASES.find((p) => p.name === name);
  if (!phase) return [`The phase ${name} does not exist.`];
  const missing = phase.dependsOn
    .filter((dependency) => !isDone(state, dependency))
    .map((dependency) =>
      dependency === "retro" && state.phases.retro?.doneAt
        ? "The phase retro was done before ready. Run cstack next --phase retro to do it again."
        : `The phase ${dependency} is not done.`,
    );
  return [...missing, ...(phase.start?.(context) ?? [])];
}

function update(cwd: string, planFile: string, name: PhaseName, key: "startedAt" | "doneAt", now: Date): void {
  const state = readState(cwd, planFile);
  if (!state) throw new RunStateError(`The run of ${planFile} does not exist.`);
  state.phases[name] = { ...state.phases[name], [key]: now.toISOString() };
  writeState(cwd, planFile, state);
}

export const markStarted = (cwd: string, planFile: string, name: PhaseName, now: Date): void =>
  update(cwd, planFile, name, "startedAt", now);

export const markDone = (cwd: string, planFile: string, name: PhaseName, now: Date): void =>
  update(cwd, planFile, name, "doneAt", now);

/** Removes the `current-run` file of this worktree. Every run folder stays. */
export function clearCurrentRun(cwd: string): void {
  rmSync(currentRunPath(cwd), { force: true });
}
