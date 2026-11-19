// WHY: a child worktree starts from the last commit of the ticket branch. These checks make sure that commit holds everything the worker needs, and that no plan text reaches the Orca command line: the branch and the hash come from git.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { withoutWorktreeLines } from "../plan/unit-line.js";

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
