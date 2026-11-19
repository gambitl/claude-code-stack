import { execFile } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { PlanFormatError, readPlan } from "../plan/read.js";

const execFileAsync = promisify(execFile);
const GIT_OPTIONS = ["--literal-pathspecs", "-c", "color.ui=never", "-c", "log.showSignature=false", "-c", "log.follow=false"];

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", [...GIT_OPTIONS, ...args], {
    cwd,
    maxBuffer: 256 * 1024 * 1024,
  });
  return stdout;
}

// An error whose message is a fixed sentence, so no path or file text can leak through it.
export class MomentsError extends Error {}

export type Moments = {
  root: string;
  approval: Date;
  ready: Date | undefined;
  // Where the two moments come from: the header of a version 1 plan file, or the git history.
  source: "header" | "history";
};

// "not yet" is a missing moment. Any other value was checked by the plan reader.
const headerMoment = (value: string): Date | undefined => (value === "not yet" ? undefined : new Date(value));

// The header is every line before the first line that starts with "## ".
// Returns the text after the first "<key>:" line of the header, or undefined when there is none.
function headerValue(text: string, key: string): string | undefined {
  for (const line of text.split("\n")) {
    if (line.startsWith("## ")) return undefined;
    if (line.startsWith(`${key}:`)) return line.slice(key.length + 1).trim();
  }
  return undefined;
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
  let root: string;
  try {
    root = realpathSync((await git(dirname(plan), ["rev-parse", "--show-toplevel"])).trim());
  } catch {
    throw new MomentsError("the plan file is not inside a git repository.");
  }
  // WHY: ADR-SIC-B (docs/decisions/ADR-SIC-B-run-state.md). A version 1 plan file records both moments in its
  // own header, so they are read from there and never from the git history.
  if (headerValue(text, "Format") !== undefined) {
    let header;
    try {
      header = readPlan(text).header;
    } catch (error) {
      if (!(error instanceof PlanFormatError)) throw error;
      throw new MomentsError("the plan file is not a valid cstack plan file.");
    }
    const approval = headerMoment(header["Approved at"]);
    if (!approval) throw new MomentsError("the plan file has no approval moment yet.");
    const ready = headerMoment(header["Ready for review at"]);
    if (ready && ready.getTime() < approval.getTime()) {
      throw new MomentsError("the ready moment of the plan file comes before its approval moment.");
    }
    return { root, approval, ready, source: "header" };
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
  let commits: string[];
  try {
    commits = (await git(root, ["log", "--reverse", "--format=%H %aI", "--", path])).trim().split("\n");
  } catch {
    throw new MomentsError("the history of the plan file cannot be read.");
  }
  let ready: Date | undefined;
  for (const entry of commits) {
    const [hash, date] = entry.split(" ") as [string, string];
    try {
      if (headerValue(await git(root, ["show", `${hash}:${path}`]), "Status")?.toLowerCase() === "ready for review") {
        ready = new Date(date);
        break;
      }
    } catch {
      // The file does not exist in this commit, so skip it.
    }
  }
  return { root, approval, ready, source: "history" };
}
