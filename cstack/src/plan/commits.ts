import { spawnSync } from "node:child_process";
import { PlanFormatError, isBranchName } from "./read.js";

export interface UnitCommits {
  /** Commit hashes by unit number, oldest last as `git log` prints them. */
  units: Record<number, string[]>;
  /** Trailer values that are not a positive whole number. */
  invalid: string[];
}

function git(cwd: string, args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/**
 * Lists the commits of HEAD that are not on the target branch, grouped by the
 * `Cstack-Unit` trailers of their messages. The target branch is compared by
 * its upstream when it has one, and by the local branch otherwise.
 */
export function listUnitCommits(repoDir: string, targetBranch: string): UnitCommits {
  if (!isBranchName(targetBranch)) {
    throw new PlanFormatError(`"${targetBranch}" is not a valid branch name.`);
  }
  const exists = git(repoDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${targetBranch}`]);
  if (exists.status !== 0) {
    throw new PlanFormatError(`The target branch "${targetBranch}" does not exist.`);
  }
  const upstream = git(repoDir, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    `${targetBranch}@{upstream}`,
  ]);
  const base = upstream.status === 0 && upstream.stdout.trim() ? upstream.stdout.trim() : targetBranch;
  const log = git(repoDir, [
    "log",
    "--format=%H%x1f%(trailers:key=Cstack-Unit,valueonly,separator=%x1f)%x1e",
    "--end-of-options",
    `${base}..HEAD`,
  ]);
  if (log.status !== 0) {
    throw new PlanFormatError(`git log failed: ${log.stderr.trim()}`);
  }
  const result: UnitCommits = { units: {}, invalid: [] };
  for (const record of log.stdout.split("\x1e")) {
    const [hash, ...rest] = record.trim().split("\x1f");
    if (!hash) continue;
    for (const raw of rest.join("\x1f").split(/[\x1f\n]/)) {
      const value = raw.trim();
      if (!value) continue;
      const unit = /^[1-9][0-9]*$/.test(value) ? Number(value) : NaN;
      if (Number.isSafeInteger(unit)) (result.units[unit] ??= []).push(hash);
      else result.invalid.push(value);
    }
  }
  return result;
}

/**
 * Lists the files that each commit changes, sorted. A renamed file counts with
 * both its old and its new path. The `-z` flag keeps non-ASCII names unquoted.
 */
export function listCommitFiles(repoDir: string, hashes: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const hash of hashes) {
    const out = git(repoDir, [
      "diff-tree",
      "-r",
      "-z",
      "--name-only",
      "--no-renames",
      "--no-commit-id",
      "--end-of-options",
      hash,
    ]);
    if (out.status !== 0) {
      throw new PlanFormatError(`git diff-tree failed: ${out.stderr.trim()}`);
    }
    result[hash] = out.stdout.split("\0").filter(Boolean).sort();
  }
  return result;
}
