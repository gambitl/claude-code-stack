import { execFile } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
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

// An error whose message is a fixed sentence, so no path or file text can leak through it.
export class MomentsError extends Error {}

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

// The header is every line before the first line that starts with "## ".
function hasFormatLine(text: string): boolean {
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) return false;
    if (line.startsWith("Format:")) return true;
  }
  return false;
}

export async function readMoments(planArgument: string): Promise<Moments> {
  let plan: string;
  let text: string;
  try {
    plan = realpathSync(resolve(planArgument));
    text = readFileSync(plan, "utf8");
  } catch {
    throw new MomentsError("the plan file does not exist or cannot be read.");
  }
  if (hasFormatLine(text)) {
    throw new MomentsError("this version of cstack measure reads only plan files made before cstack.");
  }
  let root: string;
  try {
    root = realpathSync((await git(dirname(plan), ["rev-parse", "--show-toplevel"])).trim());
  } catch {
    throw new MomentsError("the plan file is not inside a git repository.");
  }
  const path = relative(root, plan).split("\\").join("/");
  let added: string[] = [];
  try {
    added = (await git(root, ["log", "--diff-filter=A", "--format=%aI", "--", path])).trim().split("\n");
  } catch {
    // Treated below like a file that was never committed.
  }
  const last = added[added.length - 1];
  if (!last) throw new MomentsError("the plan file was never committed.");
  const approval = new Date(last);
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
