import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Io } from "../io.js";
import { readRecord, type HelperRecord } from "../helper/record.js";
import { listUnitCommits, listCommitFiles } from "../plan/commits.js";
import type { LocatedPlan } from "../plan/locate.js";
import type { PlanRead, PlanUnit } from "../plan/read.js";
import { latestUnitReport } from "../report/reports.js";
import { runFolder } from "../run-state.js";

function git(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: (r.stderr ?? "").trim() };
}

const nulList = (text: string) => text.split("\0").filter((s) => s !== "");

/** The latest helper record of a unit, or nothing. It is the newest start, and the id breaks a tie. */
function latestRecord(folder: string, unit: number): HelperRecord | undefined {
  let names: string[];
  try {
    names = readdirSync(join(folder, "helpers")).filter((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return names
    .map((name) => readRecord(folder, name.slice(0, -".json".length)))
    .filter((record) => record.unit === unit)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || (a.id < b.id ? -1 : 1))
    .at(-1);
}

/** The reason why a commit cannot be applied for a unit, or nothing when it can. */
function commitProblem(root: string, unit: PlanUnit, hash: string): string | undefined {
  const trailers = git(root, [
    "log",
    "-1",
    "--format=%(trailers:key=Cstack-Unit,valueonly,separator=%x1f)",
    "--end-of-options",
    hash,
  ]).stdout.trim();
  const values = trailers.split("\x1f").map((v) => v.trim()).filter(Boolean);
  if (values.length === 0 || values.some((v) => v !== String(unit.number))) {
    return `it does not carry the trailer Cstack-Unit: ${unit.number}`;
  }
  const own = new Set(unit.files.map((f) => f.toLowerCase()));
  const outside = (listCommitFiles(root, [hash])[hash] ?? []).filter((f) => !own.has(f.toLowerCase()));
  if (outside.length > 0) return `it changes ${outside.join(", ")}, which is not in the Files of unit ${unit.number}`;
  return undefined;
}

// WHY: the specification does not say how the work of a child worktree comes back.
// This function copies the commits of each unit onto the ticket branch with git cherry-pick, in plan order.
// The branch then reads as if the units had run one after the other, with the commits of each unit together.
// The commit hashes change on the way, but `cstack plan status` finds the commits of a unit by their
// Cstack-Unit trailer and not by their hash. A merge commit for each unit was rejected,
// because it would add one commit per unit that carries no change of its own.
// All the commits of one unit go in one cherry-pick call, so that `git cherry-pick --abort`
// puts the branch back to where it was before that unit.
export function collectUnits(located: LocatedPlan, plan: PlanRead, numbers: number[], io: Io): number {
  const root = located.root;
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  if (branch !== plan.header["Branch"]) {
    io.stderr(`The ticket worktree is on "${branch}", and the Branch of the plan is "${plan.header["Branch"]}". Nothing was changed.\n`);
    return 1;
  }
  const status = git(root, ["status", "--porcelain", "-z", "--untracked-files=all", "--no-renames"]);
  const dirty = nulList(status.stdout).map((entry) => entry.slice(3)).filter((path) => path !== located.relative);
  if (dirty.length > 0) {
    io.stderr(`The ticket worktree has uncommitted changes outside the plan file: ${dirty.join(", ")}. Commit them first. Nothing was changed.\n`);
    return 1;
  }

  const folder = runFolder(root, located.relative);
  const where = { root, planFile: located.relative };
  const skip = (unit: number, why: string) => io.stdout(`Unit ${unit} was skipped: ${why}.\n`);

  for (const number of [...new Set(numbers)].sort((a, b) => a - b)) {
    const unit = plan.units.find((u) => u.number === number) as PlanUnit;
    const record = latestRecord(folder, number);
    if (!record?.worktree) {
      skip(number, "it has no child worktree on record, so its commits are already on the ticket branch");
      continue;
    }
    if ((listUnitCommits(root, plan.header["Target branch"]).units[number] ?? []).length > 0) {
      skip(number, "the ticket branch already has a commit of this unit");
      continue;
    }
    const report = latestUnitReport(where, number, record.id);
    if (!report) {
      skip(number, "its helper has not reported");
      continue;
    }
    if (report.kind === "stuck") {
      skip(number, "its helper reported stuck");
      continue;
    }
    const child = record.worktree.branch.replace(/^refs\/heads\//, "");
    const list = git(root, ["rev-list", "--reverse", `HEAD..refs/heads/${child}`, "--"]);
    if (!list.ok) {
      io.stderr(`Unit ${number}: git cannot list the commits of the branch "${child}": ${list.stderr}\n`);
      return 1;
    }
    const commits = list.stdout.split("\n").filter(Boolean);
    if (commits.length === 0) {
      skip(number, `the branch "${child}" has no commit that the ticket branch lacks`);
      continue;
    }
    for (const hash of commits) {
      const problem = commitProblem(root, unit, hash);
      if (problem) {
        io.stderr(`Unit ${number}: nothing was applied. The commit ${hash.slice(0, 7)} was refused because ${problem}.\n`);
        return 1;
      }
    }
    const pick = git(root, ["cherry-pick", ...commits]);
    if (!pick.ok) {
      const files = nulList(git(root, ["diff", "--name-only", "-z", "--diff-filter=U"]).stdout);
      if (git(root, ["rev-parse", "--verify", "--quiet", "CHERRY_PICK_HEAD"]).ok) git(root, ["cherry-pick", "--abort"]);
      io.stderr(
        `Unit ${number}: the cherry-pick stopped and was aborted. ${files.length > 0 ? `Conflicting files: ${files.join(", ")}.` : pick.stderr}\n`,
      );
      return 1;
    }
    io.stdout(`Unit ${number}: applied ${commits.length === 1 ? "1 commit" : `${commits.length} commits`}.\n`);
  }
  return 0;
}
