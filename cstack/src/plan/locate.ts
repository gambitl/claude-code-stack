// WHY: every plan command finds its plan file here, from --plan or from the current run. It only reads, and it compares real paths because macOS gives /private/var where Node gives /var.
import { spawnSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { readCurrentRun, readState } from "../run-state.js";

export interface LocatedPlan {
  /** The real path of the repository root. */
  root: string;
  /** The absolute real path of the plan file. */
  path: string;
  /** The path from `root`, with forward slashes. */
  relative: string;
}

/** Exit code 2 is a usage problem. Exit code 3 is a file or a run that cannot be used. */
export class PlanLocationError extends Error {
  readonly exitCode: 2 | 3;
  constructor(message: string, exitCode: 2 | 3) {
    super(message);
    this.name = "PlanLocationError";
    this.exitCode = exitCode;
  }
}

const isInside = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
};

function repositoryRoot(cwd: string): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  const top = result.stdout?.trim();
  if (result.status !== 0 || !top) throw new PlanLocationError(`"${cwd}" is not inside a git repository.`, 2);
  return realpathSync(top);
}

function locateFile(root: string, absolute: string, label: string): LocatedPlan {
  let real: string;
  try {
    real = realpathSync(absolute);
    if (!statSync(real).isFile()) throw new Error("not a file");
  } catch {
    // The path does not exist. A path that is lexically outside the repository is still a usage problem.
    if (!isInside(root, absolute)) {
      throw new PlanLocationError(`The plan file ${label} is outside the repository.`, 2);
    }
    throw new PlanLocationError(`The plan file ${label} does not exist or cannot be read.`, 3);
  }
  if (!isInside(root, real)) {
    throw new PlanLocationError(`The plan file ${label} points outside the repository.`, 2);
  }
  return { root, path: real, relative: relative(root, real).split(sep).join("/") };
}

export function locatePlan(cwd: string, planFlag: string | undefined): LocatedPlan {
  const root = repositoryRoot(cwd);
  if (planFlag !== undefined) {
    return locateFile(root, resolve(realpathSync(cwd), planFlag), planFlag);
  }
  const name = readCurrentRun(cwd);
  if (name === undefined) {
    throw new PlanLocationError("No run is current in this worktree. Pass the plan file with --plan <file>.", 2);
  }
  const state = readState(cwd, name);
  if (state === undefined) {
    throw new PlanLocationError(`The run of ${name} has no state.json. Pass the plan file with --plan <file>.`, 3);
  }
  return locateFile(root, join(root, state.plan), state.plan);
}
