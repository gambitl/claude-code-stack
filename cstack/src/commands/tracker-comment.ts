import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { resolve, sep } from "node:path";
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { NoClientError } from "../tracker/errors.js";
import { openTracker, refuseWithoutClient } from "../tracker/open.js";
import { KEY_HINT, type TrackerDeps, failTracker, findRoot, parseTrackerArgs, trackerName, usageError, warnTo } from "./tracker-common.js";

/** True when the path is a file that cstack can read. */
function readable(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

const MAX_BYTES = 65_536;

function real(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

function inside(file: string, folder: string): boolean {
  return file.startsWith(folder.endsWith(sep) ? folder : folder + sep);
}

/**
 * Returns the problem with a comment file, or undefined when it may be posted.
 * WHY: with the rule `Bash(cstack *)`, a ticket that hides instructions could make Claude post a private file
 * on a public issue. So the real path must be in the repository (when git really found one, and it is not the
 * home folder) or in a temporary folder, and the size must fit a GitHub comment.
 */
function problemWith(path: string, gitRoot: string | undefined): string | undefined {
  const file = real(path);
  if (file === undefined) return undefined;
  const roots = [real(tmpdir()), real("/tmp"), real("/private/tmp")].filter((r): r is string => r !== undefined);
  const repo = gitRoot === undefined ? undefined : real(gitRoot);
  if (repo !== undefined && repo !== real(homedir())) roots.push(repo);
  if (!roots.some((r) => inside(file, r))) return `the comment file ${path} must be inside the repository or a temporary folder.`;
  const size = statSync(file).size;
  if (size === 0) return `the comment file ${path} is empty.`;
  if (size > MAX_BYTES) return `the comment file ${path} is larger than ${MAX_BYTES} bytes.`;
  return undefined;
}

/** `cstack tracker comment <key> --body-file <path>`: adds the text of a file as a comment. The text never goes through a shell. */
export async function trackerComment(args: string[], io: Io, deps: TrackerDeps): Promise<number> {
  const parsed = parseTrackerArgs(args, { "body-file": { type: "string" }, tracker: { type: "string" } });
  if ("problem" in parsed) return usageError(io, "comment", parsed.problem);
  const [key, ...extra] = parsed.positionals;
  if (key === undefined) return usageError(io, "comment", "the ticket key is missing.", KEY_HINT);
  if (extra.length > 0) return usageError(io, "comment", `unexpected argument "${extra[0]}".`, KEY_HINT);
  const bodyFile = parsed.values["body-file"];
  if (bodyFile === undefined) return usageError(io, "comment", "--body-file <path> is missing.");
  const tracker = trackerName(parsed.values.tracker);
  if (tracker === "bad") return usageError(io, "comment", "--tracker must be jira, linear, github or gitlab.");
  // The file is checked before any program runs, so an unreadable file always exits with 1.
  const path = resolve(deps.cwd, bodyFile);
  if (!readable(path)) {
    io.stderr(`cstack: cstack cannot read the comment file ${path}.\n`);
    return EXIT.refused;
  }
  const top = await deps.run("git", ["rev-parse", "--show-toplevel"], deps.cwd);
  const problem = problemWith(path, top.kind === "ok" && top.stdout.trim() !== "" ? top.stdout.trim() : undefined);
  if (problem !== undefined) {
    io.stderr(`cstack: ${problem}\n`);
    return EXIT.refused;
  }
  try {
    const root = await findRoot(deps);
    const warn = warnTo(io);
    let opened;
    try {
      opened = await openTracker("comment", { root, tracker, run: deps.run, env: deps.env, warn });
    } catch (error) {
      if (!(error instanceof NoClientError)) throw error;
      throw await refuseWithoutClient(error, { root, tracker, run: deps.run, warn }, { comment: { key, path } });
    }
    await opened.addComment(key, real(path) ?? path);
    io.stdout(`Added the text of ${path} as a comment on '${key}'.\n`);
    return EXIT.ok;
  } catch (error) {
    return failTracker(error, io);
  }
}
