import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
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

/** An error about finding the plan file. Exit code 2 is a usage problem, and 3 is an input problem. */
export class PlanLocationError extends Error {
  readonly exitCode: 2 | 3;
  constructor(message: string, exitCode: 2 | 3) {
    super(message);
    this.name = "PlanLocationError";
    this.exitCode = exitCode;
  }
}

function insideRoot(root: string, path: string): string | undefined {
  const rel = relative(root, path);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
  return rel.split(sep).join("/");
}

function realOrUndefined(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

/**
 * Finds the plan file: `--plan <file>` wins, then the plan of the current run of this worktree.
 * It only reads. Pointing the current run at a plan is the job of `cstack next`.
 */
export function locatePlan(cwd: string, planFlag: string | undefined): LocatedPlan {
  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (top.status !== 0 || !top.stdout.trim()) {
    throw new PlanLocationError(`"${cwd}" is not inside a git repository.`, 2);
  }
  const root = realpathSync(top.stdout.trim());

  let candidate: string;
  if (planFlag !== undefined) {
    candidate = resolve(realpathSync(cwd), planFlag);
  } else {
    const name = readCurrentRun(cwd);
    if (name === undefined) {
      throw new PlanLocationError("There is no current run in this worktree. Give the plan file with --plan <file>.", 2);
    }
    const state = readState(cwd, name);
    if (state === undefined) {
      throw new PlanLocationError(`The current run "${name}" has no state file. Give the plan file with --plan <file>.`, 3);
    }
    candidate = join(root, state.plan);
  }

  const real = realOrUndefined(candidate);
  const rel = insideRoot(root, real ?? candidate);
  if (rel === undefined) {
    throw new PlanLocationError(`The plan file "${candidate}" is outside the repository "${root}".`, planFlag !== undefined ? 2 : 3);
  }
  try {
    if (real === undefined) throw new Error("missing");
    readFileSync(real);
  } catch {
    throw new PlanLocationError(`The plan file "${rel}" does not exist or cannot be read.`, 3);
  }
  return { root, path: real, relative: rel };
}
