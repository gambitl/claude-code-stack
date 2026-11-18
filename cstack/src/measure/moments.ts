import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const GIT_OPTIONS = ["-c", "color.ui=never", "-c", "log.showSignature=false", "-c", "log.follow=false"];

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...GIT_OPTIONS, ...args], {
    cwd,
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

export type Moments = { root: string; approval: Date; ready: Date | undefined };

// A version reads "ready for review" when the first Status line of its header says so.
function isReady(text: string): boolean {
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) return false;
    if (line.startsWith("Status:")) {
      return line.slice("Status:".length).trim().toLowerCase() === "ready for review";
    }
  }
  return false;
}

export async function readMoments(planArgument: string): Promise<Moments> {
  const plan = realpathSync(resolve(planArgument));
  const folder = dirname(plan);
  const root = realpathSync((await git(folder, ["rev-parse", "--show-toplevel"])).trim());
  const path = relative(root, plan).split("\\").join("/");
  const added = (await git(root, ["log", "--diff-filter=A", "--format=%aI", "--", path]))
    .trim()
    .split("\n");
  const approval = new Date(added[added.length - 1] as string);
  const commits = (await git(root, ["log", "--reverse", "--format=%H %aI", "--", path]))
    .trim()
    .split("\n");
  let ready: Date | undefined;
  for (const entry of commits) {
    const [hash, date] = entry.split(" ") as [string, string];
    try {
      if (isReady(await git(root, ["show", `${hash}:${path}`]))) {
        ready = new Date(date);
        break;
      }
    } catch {
      // The file does not exist in this commit, so skip it.
    }
  }
  return { root, approval, ready };
}
