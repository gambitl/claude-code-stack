import { spawnSync } from "node:child_process";

/** The actions that only git can prove. */
export const GIT_ACTIONS = ["write-decision-record", "write-why-comment"] as const;

/** The branch that the commits are compared with: the upstream of the target branch when it has one, else the target branch. */
function baseOf(root: string, targetBranch: string): string {
  const run = spawnSync("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", `${targetBranch}@{upstream}`], {
    cwd: root,
    encoding: "utf8",
  });
  return run.status === 0 && run.stdout.trim() !== "" ? run.stdout.trim() : targetBranch;
}

/** The output of `git log` over the commits of the branch, or undefined when git fails. */
function logOf(root: string, targetBranch: string, args: string[], tail: string[] = []): string | undefined {
  const run = spawnSync(
    "git",
    ["-c", "core.quotepath=false", "log", ...args, "--end-of-options", `${baseOf(root, targetBranch)}..HEAD`, ...tail],
    { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  return run.status === 0 ? run.stdout : undefined;
}

const oldest = (times: number[]): number | undefined => (times.length > 0 ? Math.min(...times) * 1000 : undefined);

/** The author time, in milliseconds, of the oldest branch commit that changes one of the files. */
export function recordTime(root: string, targetBranch: string, files: string[]): number | undefined {
  if (files.length === 0) return undefined;
  const out = logOf(root, targetBranch, ["--format=%at"], ["--", ...files.map((file) => `:(literal)${file}`)]);
  if (out === undefined) return undefined;
  return oldest(out.split("\n").filter((line) => line !== "").map(Number));
}

/** The author time, in milliseconds, of the oldest branch commit that adds a `WHY:` line naming one of the records, outside Markdown files. */
export function whyTime(root: string, targetBranch: string, names: string[]): number | undefined {
  const out = logOf(root, targetBranch, ["-p", "-U0", "--no-color", "--no-ext-diff", "--no-textconv", "-G", "WHY:", "--format=@@commit %at"]);
  if (out === undefined) return undefined;
  const times: number[] = [];
  let time = 0;
  let file = "";
  for (const line of out.split("\n")) {
    if (line.startsWith("@@commit ")) time = Number(line.slice(9));
    else if (line.startsWith("+++ ")) file = line.slice(4);
    else if (line.startsWith("+") && !file.endsWith(".md") && line.includes("WHY:") && names.some((name) => line.includes(name))) {
      times.push(time);
    }
  }
  return oldest(times);
}
