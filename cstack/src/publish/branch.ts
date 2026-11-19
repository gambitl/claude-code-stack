import { runProgram } from "./program.js";
import { redact } from "./remote.js";

export class PublishFailure extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
  ) {
    super(message);
  }
}

type Options = { cwd: string; env?: NodeJS.ProcessEnv };

/** The commit of the branch on `origin`, or undefined when the branch is not there yet. */
export function remoteBranchHead(branch: string, options: Options): string | undefined {
  const r = runProgram("git", ["ls-remote", "--heads", "origin", `refs/heads/${branch}`], options);
  if (!r.ok) throw new PublishFailure(`Reading the branch on origin failed: ${redact(r.stderr.trim())}`, 5);
  return r.stdout.trim().split(/\s+/)[0] || undefined;
}

/**
 * Pushes `HEAD` as the branch, only when the remote branch is missing or is an ancestor of `HEAD`.
 * Gives the pushed commit, or undefined when the remote already has `HEAD`.
 */
export function pushBranch(branch: string, options: Options): string | undefined {
  const git = (args: string[]) => runProgram("git", args, options);
  const head = git(["rev-parse", "--verify", "HEAD"]).stdout.trim();
  const remote = remoteBranchHead(branch, options);
  if (remote === head) return undefined;
  if (remote !== undefined) {
    const fetched = git(["fetch", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`]);
    if (!fetched.ok) throw new PublishFailure(`Fetching the branch from origin failed: ${redact(fetched.stderr.trim())}`, 5);
    if (!git(["merge-base", "--is-ancestor", "--end-of-options", remote, "HEAD"]).ok) {
      throw new PublishFailure(
        `The branch ${branch} on origin has a commit that your local branch does not have. cstack never forces a push, so nothing was pushed. Bring the remote commits into your branch first.`,
        1,
      );
    }
  }
  const ref = `refs/heads/${branch}:refs/heads/${branch}`;
  const pushed = git(["push", ...(remote === undefined ? ["--set-upstream"] : []), "--no-follow-tags", "origin", ref]);
  if (!pushed.ok) throw new PublishFailure(`The push failed: ${redact(pushed.stderr.trim())}`, 5);
  return head;
}
