import { accessSync, constants, statSync } from "node:fs";
import { resolve } from "node:path";
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { checkedTracker } from "../tracker/checked.js";
import { NoClientError } from "../tracker/errors.js";
import { trackerFromRemote } from "../tracker/choose.js";
import { originRepo } from "../tracker/forge.js";
import { openTracker } from "../tracker/open.js";
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
  try {
    const root = await findRoot(deps);
    const warn = warnTo(io);
    let opened;
    try {
      opened = await openTracker("comment", { root, tracker, run: deps.run, env: deps.env, warn });
    } catch (error) {
      if (!(error instanceof NoClientError)) throw error;
      // With no client, the key is still checked, so a bad one exits with 1 before the exit code 4.
      const name = tracker ?? trackerFromRemote(`https://${(await originRepo(deps.run, root)).host}/`);
      await checkedTracker(
        {
          readTicket: () => Promise.reject(error),
          listGroup: () => Promise.reject(error),
          moveState: () => Promise.reject(error),
          async addComment(k, file) {
            throw NoClientError.forComment(k, file);
          },
        },
        name,
        warn,
      ).addComment(key, path);
      throw error;
    }
    await opened.addComment(key, path);
    io.stdout(`Added the text of ${path} as a comment on '${key}'.\n`);
    return EXIT.ok;
  } catch (error) {
    return failTracker(error, io);
  }
}
