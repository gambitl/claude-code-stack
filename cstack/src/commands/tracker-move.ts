import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { checkedTracker } from "../tracker/checked.js";
import { NoClientError } from "../tracker/errors.js";
import { trackerFromRemote } from "../tracker/choose.js";
import { originRepo } from "../tracker/forge.js";
import { openTracker } from "../tracker/open.js";
import { checkStateName } from "../tracker/states.js";
import { KEY_HINT, type TrackerDeps, failTracker, findRoot, parseTrackerArgs, trackerName, usageError, warnTo } from "./tracker-common.js";

/** `cstack tracker move <key> --to <state name>`: moves a ticket to a state. */
export async function trackerMove(args: string[], io: Io, deps: TrackerDeps): Promise<number> {
  const parsed = parseTrackerArgs(args, { to: { type: "string" }, tracker: { type: "string" } });
  if ("problem" in parsed) return usageError(io, "move", parsed.problem);
  const [key, ...extra] = parsed.positionals;
  if (key === undefined) return usageError(io, "move", "the ticket key is missing.", KEY_HINT);
  if (extra.length > 0) return usageError(io, "move", `unexpected argument "${extra[0]}".`, KEY_HINT);
  const stateName = parsed.values.to;
  if (stateName === undefined) return usageError(io, "move", "--to <state name> is missing.");
  const tracker = trackerName(parsed.values.tracker);
  if (tracker === "bad") return usageError(io, "move", "--tracker must be jira, linear, github or gitlab.");
  try {
    const root = await findRoot(deps);
    const warn = warnTo(io);
    let opened;
    try {
      opened = await openTracker("move", { root, tracker, run: deps.run, env: deps.env, warn });
    } catch (error) {
      if (!(error instanceof NoClientError)) throw error;
      // With no client, the key and the state name are still checked, so a bad one exits with 1 before the exit code 4.
      const name = tracker ?? trackerFromRemote(`https://${(await originRepo(deps.run, root)).host}/`);
      await checkedTracker(
        {
          readTicket: () => Promise.reject(error),
          listGroup: () => Promise.reject(error),
          addComment: () => Promise.reject(error),
          async moveState(k, s) {
            checkStateName(name, s);
            throw NoClientError.forMove(k, s);
          },
        },
        name,
        warn,
      ).moveState(key, stateName);
      throw error;
    }
    await opened.moveState(key, stateName);
    io.stdout(`Moved '${key}' to "${stateName}".\n`);
    return EXIT.ok;
  } catch (error) {
    return failTracker(error, io);
  }
}
