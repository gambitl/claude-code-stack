// WHY: ADR-SIC-B (docs/decisions/ADR-SIC-B-run-state.md). The run state lives under the common git folder, not in the plan file, and carries its own format version.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PLANNING_PHASES, type PhaseName } from "./phases.js";
import type { PlanRead } from "./plan/read.js";

export const RUN_FORMAT = "cstack-run/1";

/** An error about the run state. Its exit code is 3, and its message holds no stack trace. */
export class RunStateError extends Error {
  readonly exitCode = 3;
  constructor(message: string) {
    super(message);
    this.name = "RunStateError";
  }
}

export interface PhaseTimes {
  startedAt?: string;
  doneAt?: string;
}

export interface RunState {
  format: typeof RUN_FORMAT;
  /** The cstack version that wrote the file. */
  writtenBy: string;
  /** The plan file path from the repository root. */
  plan: string;
  phases: Partial<Record<PhaseName, PhaseTimes>>;
}

/** One saved test run, in `units/<n>/red.json` or `units/<n>/green.json`. The log is next to it. */
export interface SavedTestRun {
  time: string;
  command: string;
  exitCode: number;
  commit: string;
  testFile: string;
}

/** One accepted report, in `reports/<time>-<kind>.json`. */
export interface SavedReport {
  kind: "done" | "needs-decision" | "failed" | "published";
  text: string;
  time: string;
  /** Set once the main conversation was shown the report. */
  readAt?: string;
}

/** `publish.json`. */
export interface PublishRecord {
  pullRequest: string;
  pushes: { commit: string; time: string }[];
  /** The result of the checks on the last push. */
  checks?: string;
}

const PLAN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function cstackVersion(): string {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
  return pkg.version;
}

/** The plan file name, checked: it ends with `.md` and the rest is a safe file name. */
export function planFileName(planFile: string): string {
  const name = basename(planFile);
  if (!name.endsWith(".md") || !PLAN_NAME.test(name.slice(0, -3))) {
    throw new RunStateError(
      `"${name}" is not a usable plan file name. It must end with .md and use only letters, digits, dots, dashes and underscores.`,
    );
  }
  return name;
}

export interface GitFolders {
  gitDir: string;
  commonDir: string;
}

export function gitFolders(cwd: string): GitFolders {
  const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"], {
    cwd,
    encoding: "utf8",
  });
  const [gitDir, commonDir] = result.stdout?.split("\n") ?? [];
  if (result.status !== 0 || !gitDir || !commonDir) {
    throw new RunStateError(`"${cwd}" is not inside a git repository.`);
  }
  return { gitDir, commonDir };
}

/** `<common git folder>/cstack/runs/<plan file name without .md>`, the same for every worktree. */
export function runFolder(cwd: string, planFile: string): string {
  return join(gitFolders(cwd).commonDir, "cstack", "runs", planFileName(planFile).slice(0, -3));
}

/** `<worktree git folder>/cstack/current-run`, one per worktree. */
export function currentRunPath(cwd: string): string {
  return join(gitFolders(cwd).gitDir, "cstack", "current-run");
}

/** Writes the file whole, through a temporary file in the same folder and a rename. */
export function writeFileAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, content);
  renameSync(temporary, path);
}

export function writeCurrentRun(cwd: string, planFile: string): void {
  writeFileAtomic(currentRunPath(cwd), `${planFileName(planFile)}\n`);
}

/** The plan file name this worktree works on, or undefined when it has none. */
export function readCurrentRun(cwd: string): string | undefined {
  try {
    return planFileName(readFileSync(currentRunPath(cwd), "utf8").trim());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Reads `state.json`. It returns undefined when the run does not exist. */
export function readState(cwd: string, planFile: string): RunState | undefined {
  const path = join(runFolder(cwd, planFile), "state.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new RunStateError(`The run state file ${path} cannot be read.`);
  }
  let data: Partial<RunState>;
  try {
    data = JSON.parse(text) as Partial<RunState>;
  } catch {
    throw new RunStateError(`The run state file ${path} is not valid JSON.`);
  }
  if (data === null || typeof data !== "object" || data.format !== RUN_FORMAT) {
    const writer = typeof data?.writtenBy === "string" ? `cstack ${data.writtenBy} wrote it and can read it.` : "The file does not name the cstack version that wrote it.";
    throw new RunStateError(
      `The run state file ${path} has the format ${String(data?.format)}. This cstack reads ${RUN_FORMAT}. ${writer}`,
    );
  }
  return data as RunState;
}

export function writeState(cwd: string, planFile: string, state: RunState): void {
  writeFileAtomic(join(runFolder(cwd, planFile), "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * Creates the run of a plan file. A run that already exists is read and kept.
 * When the plan has an `Approved at` time, the planning phases are done at that time.
 */
export function createRun(cwd: string, planFile: string, plan: PlanRead): RunState {
  const existing = readState(cwd, planFile);
  if (existing) return existing;
  const approvedAt = plan.header["Approved at"];
  const phases: RunState["phases"] = {};
  if (approvedAt && approvedAt !== "not yet") {
    for (const name of PLANNING_PHASES) phases[name] = { startedAt: approvedAt, doneAt: approvedAt };
  }
  const state: RunState = { format: RUN_FORMAT, writtenBy: cstackVersion(), plan: planFile, phases };
  writeState(cwd, planFile, state);
  return state;
}
