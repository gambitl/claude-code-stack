// WHY: a child worktree starts from the last commit of the ticket branch. These checks make sure that commit holds everything the worker needs, and that no plan text reaches the Orca command line: the branch and the hash come from git.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { withoutWorktreeLines } from "../plan/unit-line.js";
import type { HelperRecord } from "./record.js";

function git(cwd: string, args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/** The branch checked out in the worktree, or undefined on a detached HEAD. */
export function currentBranch(root: string): string | undefined {
  const result = git(root, ["symbolic-ref", "--short", "-q", "HEAD"]);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

/** The hash of the last commit of the worktree. */
export function headHash(root: string): string {
  return git(root, ["rev-parse", "HEAD"]).stdout.trim();
}

/** Lists what stops a child worktree from starting: changes outside the plan file, and a plan file that differs from the committed one. */
export function ticketWorktreeProblems(root: string, planFile: string): string[] {
  const problems: string[] = [];
  const status = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).stdout.split("\0");
  for (let i = 0; i < status.length; i++) {
    const entry = status[i] as string;
    if (entry.length < 4) continue;
    if (entry[0] === "R" || entry[0] === "C") i++;
    const path = entry.slice(3);
    if (path !== planFile) problems.push(path);
  }
  const committed = git(root, ["show", `HEAD:${planFile}`]);
  if (committed.status !== 0) {
    problems.push(`${planFile} (not tracked at HEAD)`);
  } else if (withoutWorktreeLines(committed.stdout) !== withoutWorktreeLines(readFileSync(join(root, planFile), "utf8"))) {
    problems.push(`${planFile} (differs from its committed version outside the Worktree lines)`);
  }
  return problems;
}

/** `<last part of the branch>-unit-<n>-<first six digits of the time of the helper id>`. */
export function childName(branch: string, unit: number, helperId: string): string {
  return `${branch.split("/").pop()}-unit-${unit}-${helperId.split("-")[1]!.slice(0, 6)}`;
}

export interface ListedWorktree {
  path: string;
  /** The branch without `refs/heads/`, or undefined on a detached HEAD. */
  branch: string | undefined;
}

/** The worktrees that `git worktree list --porcelain` lists. */
export function listWorktrees(root: string): ListedWorktree[] {
  const found: ListedWorktree[] = [];
  for (const block of git(root, ["worktree", "list", "--porcelain"]).stdout.split("\n\n")) {
    const lines = block.split("\n");
    const path = lines.find((l) => l.startsWith("worktree "))?.slice(9);
    if (path === undefined) continue;
    const branch = lines.find((l) => l.startsWith("branch "))?.slice(7).replace(/^refs\/heads\//, "");
    found.push({ path, branch });
  }
  return found;
}

/**
 * Finds the child worktree that a worker start made. The first choice is the path in the `workspace`
 * field of the answer, when it is not a worktree that existed before and is not the ticket worktree. The second is the one new worktree whose branch ends with the name that cstack passed.
 */
export function findChildWorktree(root: string, before: ListedWorktree[], workspace: unknown, name: string): { path: string; branch: string } | undefined {
  const now = listWorktrees(root);
  const fromAnswer = typeof workspace === "string" && workspace.includes("::") ? workspace.slice(workspace.indexOf("::") + 2) : undefined;
  const known = new Set(before.map((w) => w.path));
  const same = (a: string, b: string) => {
    try {
      return realpathSync(a) === realpathSync(b);
    } catch {
      return a === b;
    }
  };
  // The answer counts only when it names a new worktree: never one that existed before, and never the ticket worktree.
  const usable = fromAnswer !== undefined && !same(fromAnswer, root) && !before.some((w) => same(w.path, fromAnswer));
  let match = usable ? now.find((w) => same(w.path, fromAnswer)) : undefined;
  if (match === undefined) {
    const fresh = now.filter((w) => !known.has(w.path) && w.branch !== undefined && w.branch.endsWith(name));
    if (fresh.length === 1) match = fresh[0];
  }
  if (match === undefined || match.branch === undefined) return undefined;
  let path = match.path;
  try {
    path = realpathSync(path);
  } catch {
    // keep the listed path
  }
  return { path, branch: match.branch };
}

/** The record with the latest `startedAt` among the helpers of the unit, or nothing. */
export function latestUnitRecord(runDir: string, unit: number): HelperRecord | undefined {
  const folder = join(runDir, "helpers");
  if (!existsSync(folder)) return undefined;
  let latest: HelperRecord | undefined;
  for (const name of readdirSync(folder).filter((n) => n.endsWith(".json"))) {
    try {
      const record = JSON.parse(readFileSync(join(folder, name), "utf8")) as HelperRecord;
      if (record.unit === unit && (latest === undefined || record.startedAt > latest.startedAt)) latest = record;
    } catch {
      // a record that cannot be read is not the latest one
    }
  }
  return latest;
}
