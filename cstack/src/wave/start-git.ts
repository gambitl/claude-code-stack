import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { EXIT } from "../manifest.js";
import type { Runner } from "../orca/run.js";
import { WaveError } from "./errors.js";

export type StartOutcome =
  | { kind: "started"; line: string }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; reason: string };

/** Quotes one argument for a shell with single quotes. Each `'` inside becomes `'\''`. */
export const shellQuote = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** Fetches origin and reads origin/HEAD once. It throws before any ticket when either fails. */
export async function prepareGitStart(run: Runner, root: string) {
  const fetched = await run("git", ["fetch", "origin"], root);
  if (fetched.kind !== "ok") throw new WaveError("`git fetch origin` failed, so cstack started nothing.", EXIT.toolFailed);
  const head = await run("git", ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], root);
  const ref = head.kind === "ok" ? head.stdout.trim().replace(/^refs\/remotes\//, "") : "";
  if (ref === "") {
    throw new WaveError(
      "The clone has no refs/remotes/origin/HEAD, so cstack does not know the default branch. Run `git remote set-head origin --auto` and try again.",
      EXIT.refused,
    );
  }
  const parent = join(dirname(root), `${basename(root)}-worktrees`);

  return async function startInGit(key: string, short: string): Promise<StartOutcome> {
    const folder = join(parent, short);
    if (existsSync(folder)) return { kind: "skipped", reason: `the folder ${folder} already exists` };
    // WHY: --no-track, because a branch that tracks the default branch lets a plain `git push` send the ticket's commits there.
    const added = await run("git", ["worktree", "add", "--no-track", "-b", short, folder, ref], root);
    if (added.kind !== "ok") {
      const why = added.kind === "failed" ? `exit code ${added.exitCode}` : added.kind;
      return { kind: "failed", reason: `\`git worktree add\` failed (${why})` };
    }
    return { kind: "started", line: `cd ${shellQuote(folder)} && claude ${shellQuote(`/resolve-issue ${key}`)}` };
  };
}
