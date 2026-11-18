import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { withCommitLock } from "../commit-lock.js";
import type { Io } from "../io.js";
import { locatePlan, PlanLocationError } from "../plan/locate.js";
import { PlanFormatError, readPlan, type PlanUnit } from "../plan/read.js";
import { gitFolders, RunStateError } from "../run-state.js";

export const UNIT_COMMIT_USAGE = "Usage: cstack unit commit <n> [--plan <file>]";

// WHY: the lock lives in the git folder of this worktree, not in the run folder.
// The run folder sits in the common git folder and is shared by every worktree,
// but the index that this lock protects belongs to one worktree. A lock in the
// run folder would make commits in two different worktrees wait for each other for no reason.
const LOCK_FILE = "unit-commit.lock";
const DEFAULT_LOCK_WAIT_MS = 120_000;

function git(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const gitOutput = (r: { stdout: string; stderr: string }) => `${r.stdout}${r.stderr}`;

const nulList = (text: string) => text.split("\0").filter((s) => s !== "");

type Outcome = { code: number; stdout?: string; stderr?: string };

function commitUnit(root: string, unit: PlanUnit): Outcome {
  const problems: string[] = [];
  const own = new Set(unit.files.map((f) => f.toLowerCase()));

  const staged = nulList(git(root, ["diff", "--cached", "--name-only", "-z", "--no-renames"]).stdout);
  for (const file of staged.filter((f) => !own.has(f.toLowerCase()))) {
    problems.push(`${file} is staged but is not a file of unit ${unit.number}. cstack never unstages it, because it may be another unit's work.`);
  }

  // Each status entry is "XY path". X is the state in the index.
  const entries = nulList(
    git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames", "--", ...unit.files]).stdout,
  ).map((e) => ({ staged: e[0] !== " " && e[0] !== "?", path: e.slice(3) }));
  if (entries.length === 0) problems.push(`Unit ${unit.number} has no changed file.`);

  if (problems.length > 0) return { code: 1, stderr: `${problems.join("\n")}\n` };

  const paths = entries.map((e) => e.path);
  // Only paths that this call staged are unstaged after a failure.
  const stagedByUs = entries.filter((e) => !e.staged).map((e) => e.path);
  const undo = () => {
    if (stagedByUs.length > 0) git(root, ["reset", "-q", "--", ...stagedByUs]);
  };

  const add = git(root, ["add", "--", ...paths]);
  if (!add.ok) {
    undo();
    return { code: 5, stderr: gitOutput(add) };
  }
  const after = nulList(git(root, ["diff", "--cached", "--name-only", "-z", "--no-renames"]).stdout);
  const stray = after.filter((f) => !own.has(f.toLowerCase()));
  if (stray.length > 0) {
    undo();
    return { code: 1, stderr: `${stray.join(", ")} is staged but is not a file of unit ${unit.number}.\n` };
  }

  const folder = mkdtempSync(join(tmpdir(), "cstack-commit-"));
  try {
    const file = join(folder, "message.txt");
    // The trailer must be the last paragraph, because git reads trailers only there.
    writeFileSync(file, `${unit.commitMessage}\n\nCstack-Unit: ${unit.number}\n`);
    // WHY: --only commits exactly these paths. Without it, git would also commit any
    // other file that is staged in this worktree, which may be the work of another unit.
    const commit = git(root, ["commit", "-F", file, "--only", "--", ...paths]);
    if (!commit.ok) {
      undo();
      return { code: 5, stderr: gitOutput(commit) };
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
  return { code: 0, stdout: `${git(root, ["rev-parse", "--short", "HEAD"]).stdout.trim()}\n` };
}

export async function unitCommit(
  args: string[],
  io: Io,
  cwd: string = process.cwd(),
  lockWaitMs: number = DEFAULT_LOCK_WAIT_MS,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { plan: { type: "string" } }, strict: true, allowPositionals: true });
    if (parsed.positionals.length !== 1) throw new Error("give exactly one unit number");
  } catch (error) {
    io.stderr(`cstack unit commit: ${error instanceof Error ? error.message : String(error)}\n${UNIT_COMMIT_USAGE}\n`);
    return 2;
  }
  try {
    const located = locatePlan(cwd, parsed.values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    const n = Number(parsed.positionals[0]);
    const unit = Number.isInteger(n) && n > 0 ? plan.units.find((u) => u.number === n) : undefined;
    if (!unit) {
      io.stderr(
        `cstack unit commit: "${parsed.positionals[0]}" is not a unit of the plan. The plan has units ${plan.units.map((u) => u.number).join(", ")}.\n`,
      );
      return 2;
    }
    const lockPath = join(gitFolders(located.root).gitDir, "cstack", LOCK_FILE);
    const result = await withCommitLock(lockPath, unit.number, lockWaitMs, () => commitUnit(located.root, unit));
    if (!result.ok) {
      io.stderr(`cstack unit commit: ${result.message}\n`);
      return 1;
    }
    const { code, stdout, stderr } = result.value;
    if (stdout) io.stdout(stdout);
    if (stderr) io.stderr(code === 0 ? stderr : `cstack unit commit: ${stderr}`);
    return code;
  } catch (error) {
    if (error instanceof PlanFormatError || error instanceof RunStateError || error instanceof PlanLocationError) {
      io.stderr(`cstack unit commit: ${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
}
