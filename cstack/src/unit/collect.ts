import { spawnSync } from "node:child_process";
import { existsSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Io } from "../io.js";
import { listWorktrees } from "../helper/child.js";
import { latestUnitRecord, unitRecords, updateRecord } from "../helper/record.js";
import { callOrca } from "../orca/call.js";
import { parseAnswer } from "../orca/answer.js";
import type { Runner } from "../orca/run.js";
import { listUnitCommits, listCommitFiles } from "../plan/commits.js";
import type { LocatedPlan } from "../plan/locate.js";
import type { PlanRead, PlanUnit } from "../plan/read.js";
import { latestUnitReport } from "../report/reports.js";
import { runFolder } from "../run-state.js";

const samePath = (a: string, b: string) => {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return a === b;
  }
};

function git(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: (r.stderr ?? "").trim() };
}

interface Touched {
  number: number;
  collected: boolean;
}

const nulList = (text: string) => text.split("\0").filter((s) => s !== "");

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
// Cstack-Unit trailer and not by their hash.
// For the same reason, the list of the commits to bring back compares changes and not hashes (git rev-list --cherry-pick):
// a commit that was cherry-picked before has a new hash on the ticket branch, so a list by hash would offer it again.
// A commit whose change is already on the ticket branch is left out, unless it comes after a new commit: that case is refused.
// A merge commit for each unit was rejected,
// because it would add one commit per unit that carries no change of its own.
// All the commits of one unit go in one cherry-pick call, so that `git cherry-pick --abort`
// puts the branch back to where it was before that unit.
function applyUnits(located: LocatedPlan, plan: PlanRead, numbers: number[], io: Io, now: () => Date): { code: number; touched: Touched[] } {
  const touched: Touched[] = [];
  const code = applyInto(located, plan, numbers, io, touched, now);
  return { code, touched };
}

function applyInto(located: LocatedPlan, plan: PlanRead, numbers: number[], io: Io, touched: Touched[], now: () => Date): number {
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
    const record = latestUnitRecord(folder, number);
    if (!record?.worktree) {
      skip(number, "it has no child worktree on record, so its commits are already on the ticket branch");
      continue;
    }
    const report = latestUnitReport(where, number, record.id);
    if (!report) {
      skip(number, "its helper has not reported");
      continue;
    }
    touched[touched.length] = { number, collected: false };
    if (report.kind === "stuck") {
      skip(number, "its helper reported stuck");
      continue;
    }
    const child = record.worktree.branch.replace(/^refs\/heads\//, "");
    const markCollected = () => {
      touched[touched.length - 1]!.collected = true;
      updateRecord(folder, record.id, { appliedAt: now().toISOString() });
    };
    if (!git(root, ["rev-parse", "--verify", "--quiet", `refs/heads/${child}`]).ok) {
      // WHY: a branch that is gone proves nothing by itself. Only the time that cstack wrote after it applied the commits does.
      // The same worktree path can hold several attempts, so the records of the other attempts count too.
      const applied = unitRecords(folder, number).some((r) => r.worktree?.path === record.worktree?.path && r.appliedAt);
      if (!applied) {
        io.stderr(
          `Unit ${number}: the branch "${child}" no longer exists, and cstack has no record that its commits were applied to the ticket branch. Nothing was changed.\n`,
        );
        return 1;
      }
      touched[touched.length - 1]!.collected = true;
      io.stdout(`Unit ${number}: the branch "${child}" no longer exists, and its commits were applied before.\n`);
      continue;
    }
    const byHash = git(root, ["rev-list", "--reverse", `HEAD..refs/heads/${child}`, "--"]);
    const list = git(root, ["rev-list", "--reverse", "--right-only", "--cherry-pick", `HEAD...refs/heads/${child}`, "--"]);
    if (!byHash.ok || !list.ok) {
      io.stderr(`Unit ${number}: git cannot list the commits of the branch "${child}": ${byHash.ok ? list.stderr : byHash.stderr}\n`);
      return 1;
    }
    const commits = list.stdout.split("\n").filter(Boolean);
    if (commits.length === 0) {
      if ((listUnitCommits(root, plan.header["Target branch"]).units[number] ?? []).length > 0) {
        markCollected();
      }
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
    const kept = new Set(commits);
    const all = byHash.stdout.split("\n").filter(Boolean);
    const leftOut = all.slice(all.indexOf(commits[0]!)).find((h) => !kept.has(h));
    if (leftOut) {
      io.stderr(
        `Unit ${number}: nothing was applied. The commit ${leftOut.slice(0, 7)} has a change that the ticket branch already has, but it comes after a commit that is new.\n`,
      );
      return 1;
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
    markCollected();
    io.stdout(`Unit ${number}: applied ${commits.length === 1 ? "1 commit" : `${commits.length} commits`}.\n`);
  }
  return 0;
}

/** Calls Orca and says whether it answered ok. */
async function orcaOk(run: Runner, env: Record<string, string | undefined>, args: string[]): Promise<boolean> {
  const result = await callOrca(run, env, args);
  return result.kind === "ok" && parseAnswer(result)?.["ok"] !== false;
}

export interface CollectOptions {
  discardUntracked?: boolean;
}

const DISCARD = "--discard-untracked";

export interface CollectOrca {
  run: Runner;
  env: Record<string, string | undefined>;
  now?: () => Date;
}

/**
 * Deletes the child branch once its worktree is gone. Says what happened in one line, and returns false when git could not delete it.
 * WHY: `git branch -d` always refuses after a cherry-pick, because the copies on the ticket branch have new hashes.
 * So the check is by change: the branch goes only when every change of it is on the ticket branch. The old tip is printed so that it can come back.
 */
function deleteChildBranch(root: string, number: number, path: string, branch: string, how: string, io: Io): boolean {
  const ref = `refs/heads/${branch}`;
  const tip = git(root, ["rev-parse", "--verify", "--quiet", ref]);
  if (!tip.ok) {
    io.stdout(`Unit ${number}: the child worktree ${path} ${how}, and its branch ${branch} is already gone.\n`);
    return true;
  }
  const lacking = git(root, ["rev-list", "--right-only", "--cherry-pick", `HEAD...${ref}`]);
  if (!lacking.ok || lacking.stdout.trim() !== "") {
    io.stdout(`Unit ${number}: the child worktree ${path} ${how}. Its branch ${branch} was kept, because it holds a change that the ticket branch lacks.\n`);
    return true;
  }
  // Drops the entries of worktrees whose folder is gone, because git refuses to delete a branch that such an entry still names.
  git(root, ["worktree", "prune"]);
  const deleted = git(root, ["branch", "-D", branch]);
  if (!deleted.ok) {
    io.stderr(`Unit ${number}: git could not delete the branch ${branch}: ${deleted.stderr}\n`);
    return false;
  }
  const old = tip.stdout.trim();
  io.stdout(`Unit ${number}: the child worktree ${path} ${how}, and its branch ${branch} was deleted. It pointed to ${old.slice(0, 7)}. Run "git branch ${branch} ${old}" to bring it back.\n`);
  return true;
}

// WHY: the commits are on the ticket branch after the collect, so the workers are done and the clean child worktrees are no use.
// No force is used for the worktree. The child branch is deleted only when every change of it is on the ticket branch, so nothing that is not applied is lost.
async function cleanUp(located: LocatedPlan, plan: PlanRead, touched: Touched[], io: Io, orca: CollectOrca, options: CollectOptions): Promise<number> {
  const folder = runFolder(located.root, located.relative);
  let dirtyFound = false;
  let orcaFailed = false;
  for (const { number, collected } of touched) {
    const latest = latestUnitRecord(folder, number);
    if (!latest?.worktree) continue;
    for (const record of unitRecords(folder, number)) {
      if (record.worktree?.path !== latest.worktree.path || record.released || !record.dispatchId) continue;
      if (await orcaOk(orca.run, orca.env, ["orchestration", "worker-release", "--dispatch", record.dispatchId])) {
        updateRecord(folder, record.id, { released: true });
      } else {
        orcaFailed = true;
        io.stderr(`Unit ${number}: Orca could not release the worker ${record.dispatchId}.\n`);
      }
    }
    if (!collected || latest.collectedAt) continue;
    const path = latest.worktree.path;
    // WHY: a folder that is gone is never read with git status, because git would climb to a parent repository or fail.
    // Git may still list it. Removing a listed folder that does not exist only drops git's entry.
    const listedAs = listWorktrees(located.root).find((w) => samePath(w.path, path))?.path;
    if (!existsSync(path)) {
      if (listedAs !== undefined) {
        const dropped = git(located.root, ["worktree", "remove", listedAs]);
        if (!dropped.ok) {
          // Without this, the record would say collected and the branch could never be deleted by a later run.
          orcaFailed = true;
          io.stderr(`Unit ${number}: git could not drop its entry of the missing child worktree ${path}: ${dropped.stderr}\n`);
          continue;
        }
      }
      updateRecord(folder, latest.id, { collectedAt: (orca.now?.() ?? new Date()).toISOString() });
      if (!deleteChildBranch(located.root, number, path, latest.worktree.branch, "no longer exists, so it counts as removed", io)) orcaFailed = true;
      continue;
    }
    if (listedAs === undefined) {
      dirtyFound = true;
      io.stderr(`Unit ${number}: the folder ${path} was kept, because it is not a git worktree of this repository.\n`);
      continue;
    }
    const status = git(path, ["status", "--porcelain", "-z", "--untracked-files=all", "--no-renames"]);
    if (!status.ok) {
      orcaFailed = true;
      io.stderr(`Unit ${number}: git cannot read the child worktree ${path}: ${status.stderr}\n`);
      continue;
    }
    const entries = nulList(status.stdout).filter((entry) => entry.slice(3) !== located.relative);
    const tracked = entries.filter((entry) => !entry.startsWith("??")).map((entry) => entry.slice(3));
    const untracked = entries.filter((entry) => entry.startsWith("??")).map((entry) => entry.slice(3));
    if (tracked.length > 0) {
      dirtyFound = true;
      io.stderr(
        `Unit ${number}: the child worktree ${path} was kept, because it has changed tracked files: ${tracked.join(", ")}. ${DISCARD} cannot remove it.\n`,
      );
      continue;
    }
    if (untracked.length > 0) {
      const own = new Set((plan.units.find((u) => u.number === number)?.files ?? []).map((f) => f.toLowerCase()));
      // WHY: an untracked file of the unit is most likely work that was not committed. A path that ends in "/" is a whole folder, such as a nested repository.
      const blockers = untracked.filter((file) => own.has(file.toLowerCase()) || file.endsWith("/"));
      if (!options.discardUntracked || blockers.length > 0) {
        dirtyFound = true;
        const why = options.discardUntracked
          ? `${DISCARD} does not remove ${blockers.join(", ")}, because it is a file of the unit or a whole folder`
          : `it has uncommitted changes: ${untracked.join(", ")}. To delete them and remove the worktree, run: cstack unit collect ${number} ${DISCARD} --plan ${located.relative}`;
        io.stderr(`Unit ${number}: the child worktree ${path} was kept, because ${why}.\n`);
        continue;
      }
      for (const file of untracked) rmSync(join(path, file), { force: true });
      io.stdout(`Unit ${number}: deleted the untracked files ${untracked.join(", ")} from the child worktree ${path}.\n`);
    }
    // A second attempt copies the plan file into the child. Orca refuses to remove a worktree that is not clean, so only that file is restored.
    if (git(path, ["ls-files", "--error-unmatch", "--", located.relative]).ok) {
      git(path, ["checkout", "--", located.relative]);
    } else {
      rmSync(join(path, located.relative), { force: true });
    }
    if (await orcaOk(orca.run, orca.env, ["worktree", "rm", "--worktree", `path:${path}`])) {
      updateRecord(folder, latest.id, { collectedAt: (orca.now?.() ?? new Date()).toISOString() });
      if (!deleteChildBranch(located.root, number, path, latest.worktree.branch, "was removed", io)) orcaFailed = true;
    } else {
      orcaFailed = true;
      io.stderr(`Unit ${number}: Orca could not remove the child worktree ${path}.\n`);
    }
  }
  return dirtyFound ? 1 : orcaFailed ? 5 : 0;
}

/** Applies the commits, as before. With an Orca runner, it then releases the workers and removes the clean child worktrees. */
export function collectUnits(located: LocatedPlan, plan: PlanRead, numbers: number[], io: Io): number;
export function collectUnits(located: LocatedPlan, plan: PlanRead, numbers: number[], io: Io, orca: CollectOrca, options?: CollectOptions): Promise<number>;
export function collectUnits(located: LocatedPlan, plan: PlanRead, numbers: number[], io: Io, orca?: CollectOrca, options: CollectOptions = {}): number | Promise<number> {
  const { code, touched } = applyUnits(located, plan, numbers, io, orca?.now ?? (() => new Date()));
  if (!orca) return code;
  return cleanUp(located, plan, touched, io, orca, options).then((after) => (code !== 0 ? code : after));
}
