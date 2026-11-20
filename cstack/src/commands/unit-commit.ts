import { spawnSync } from "node:child_process";
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { withCommitLock } from "../commit-lock.js";
import type { Io } from "../io.js";
import { locatePlan, PlanLocationError } from "../plan/locate.js";
import { listUnitCommits } from "../plan/commits.js";
import { PlanFormatError, readPlan, type PlanRead, type PlanUnit } from "../plan/read.js";
import { gitFolders, runFolder, RunStateError } from "../run-state.js";
import { readSavedRun } from "../saved-runs.js";
import { readSettings, SettingsError } from "../settings.js";

export const UNIT_COMMIT_USAGE = "Usage: cstack unit commit <n> [--message <subject>] [--plan <file>]";

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

const isLink = (root: string, path: string) => {
  const parts = path.split("/").slice(0, -1);
  return parts.some((_, i) => {
    try {
      return lstatSync(join(root, ...parts.slice(0, i + 1))).isSymbolicLink();
    } catch {
      return false;
    }
  });
};

interface Entry {
  staged: boolean;
  unstaged: boolean;
  path: string;
}

// Collects every broken rule before anything is staged. A saved run that cannot be read throws a RunStateError.
// It also returns the unit's own paths in lower case, because git paths are compared without case.
function checkUnit(
  root: string,
  plan: PlanRead,
  unit: PlanUnit,
  runDir: string,
  message: string | undefined,
): { problems: string[]; entries: Entry[]; own: Set<string> } {
  const problems: string[] = [];
  const n = unit.number;
  const own = new Set(unit.files.map((f) => f.toLowerCase()));
  const unitCommits = listUnitCommits(root, plan.header["Target branch"]).units;
  const committed = new Set(Object.keys(unitCommits).map(Number));

  if (unit.blocked) problems.push(`Unit ${n} is blocked: ${unit.blocked}`);

  if (unit.test) {
    const red = readSavedRun(runDir, n, "red");
    const green = readSavedRun(runDir, n, "green");
    if (!green) problems.push(`Unit ${n} has a Test line but no saved passing run. Run its test and see it pass first.`);
    else if (red && Date.parse(green.time) <= Date.parse(red.time)) {
      problems.push(`Unit ${n} has no saved passing run that is newer than its saved failing run.`);
    }
  }

  const earlier = unitCommits[n] ?? [];
  if (earlier.length > 0) {
    // git log ends each entry with a newline after its NUL, so the last item is a lone newline that trims to "".
    const subjects = nulList(git(root, ["log", "--no-walk", "--format=%s%x00", "--end-of-options", ...earlier]).stdout)
      .map((t) => t.trim())
      .filter((s) => s !== "");
    const quoted = subjects.map((s) => `"${s}"`).join(", ");
    const help = `Run cstack unit commit ${n} --message "<subject>" with a subject that says what this commit changes.`;
    if (message === undefined) {
      problems.push(`Unit ${n} already has a commit, with the subject ${quoted}. Give this commit a subject of its own. ${help}`);
    } else if (subjects.some((s) => s.toLowerCase() === message.toLowerCase())) {
      problems.push(`Unit ${n} already has a commit with the subject "${message}". Earlier subjects: ${quoted}. Give this commit a different subject. ${help}`);
    }
  }

  for (const dep of unit.dependsOn.filter((d) => !committed.has(d))) {
    problems.push(`Unit ${n} depends on unit ${dep}, which has no commit yet.`);
  }

  const staged = nulList(git(root, ["diff", "--cached", "--name-only", "-z", "--no-renames"]).stdout);
  for (const file of staged.filter((f) => !own.has(f.toLowerCase()))) {
    problems.push(`${file} is staged but is not a file of unit ${n}. cstack never unstages it, because it may be another unit's work.`);
  }

  for (const other of plan.units) {
    if (other.number === n || committed.has(other.number)) continue;
    const shared = other.files.filter((f) => own.has(f.toLowerCase()));
    if (shared.length > 0 && readSavedRun(runDir, other.number, "red")) {
      problems.push(`Another unit shares ${shared.join(", ")} with unit ${n} and has started without a commit: unit ${other.number}.`);
    }
  }

  const usable = unit.files.filter((f) => {
    if (isLink(root, f)) {
      problems.push(`${f} is under a folder that is a symbolic link, so git cannot stage it.`);
      return false;
    }
    if (git(root, ["check-ignore", "-q", "--", f]).ok) {
      problems.push(`${f} is ignored by git, so it cannot be committed.`);
      return false;
    }
    return true;
  });

  // Each status entry is "XY path". X is the state in the index, Y the state in the working tree.
  const entries: Entry[] =
    usable.length === 0
      ? []
      : nulList(
          git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames", "--", ...usable]).stdout,
        ).map((e) => ({ staged: e[0] !== " " && e[0] !== "?", unstaged: e[1] !== " ", path: e.slice(3) }));
  if (entries.length === 0) problems.push(`Unit ${n} has no changed file.`);
  return { problems, entries, own };
}

function commitUnit(root: string, plan: PlanRead, unit: PlanUnit, runDir: string, attribution: string[], message: string | undefined): Outcome {
  const { problems, entries, own } = checkUnit(root, plan, unit, runDir, message);

  if (problems.length > 0) return { code: 1, stderr: `${problems.join("\n")}\n` };

  const paths = entries.map((e) => e.path);
  // Only paths that this call staged are unstaged after a failure.
  const stagedByUs = entries.filter((e) => !e.staged).map((e) => e.path);
  const undo = () => {
    if (stagedByUs.length > 0) git(root, ["reset", "-q", "--", ...stagedByUs]);
  };

  // WHY: only paths with a change in the working tree go to git add. A deletion or
  // a rename that git rm or git mv already staged leaves a path that exists nowhere,
  // and git add refuses such a path. git commit --only still takes every path.
  const toAdd = entries.filter((e) => e.unstaged).map((e) => e.path);
  const add = toAdd.length > 0 ? git(root, ["add", "--", ...toAdd]) : { ok: true, stdout: "", stderr: "" };
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
    // The attribution lines follow it with no blank line, so git reads them as trailers too.
    writeFileSync(file, `${message ?? unit.commitMessage}\n\nCstack-Unit: ${unit.number}\n${attribution.map((l) => `${l}\n`).join("")}`);
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
    parsed = parseArgs({ args, options: { plan: { type: "string" }, message: { type: "string" } }, strict: true, allowPositionals: true });
    if (parsed.positionals.length !== 1) throw new Error("give exactly one unit number");
    const given = parsed.values.message;
    if (given !== undefined && (given.trim() === "" || /[\r\n]/.test(given.trim()))) {
      throw new Error("--message needs a subject that is not empty and has one line");
    }
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
    const message = parsed.values.message?.trim();
    const attribution = readSettings(located.root).values.commitAttribution;
    const lockPath = join(gitFolders(located.root).gitDir, "cstack", LOCK_FILE);
    const result = await withCommitLock(lockPath, unit.number, lockWaitMs, () => commitUnit(located.root, plan, unit, runFolder(located.root, located.relative), attribution, message));
    if (!result.ok) {
      io.stderr(`cstack unit commit: ${result.message}\n`);
      return 1;
    }
    const { code, stdout, stderr } = result.value;
    if (stdout) io.stdout(stdout);
    if (stderr) io.stderr(code === 0 ? stderr : `cstack unit commit: ${stderr}`);
    return code;
  } catch (error) {
    if (error instanceof SettingsError) {
      io.stderr(`cstack unit commit: ${error.message}\n`);
      return 3;
    }
    if (error instanceof PlanFormatError || error instanceof RunStateError || error instanceof PlanLocationError) {
      io.stderr(`cstack unit commit: ${error.message}\n`);
      return error.exitCode;
    }
    throw error;
  }
}
