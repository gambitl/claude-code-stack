import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { openTracker } from "../tracker/open.js";
import { KEY_HINT, type TrackerDeps, failTracker, findRoot, parseTrackerArgs, trackerName, usageError, warnTo } from "./tracker-common.js";

/** `cstack tracker read <key>`: prints one ticket as JSON. */
export async function trackerRead(args: string[], io: Io, deps: TrackerDeps): Promise<number> {
  const parsed = parseTrackerArgs(args, { tracker: { type: "string" }, "from-file": { type: "string" } });
  if ("problem" in parsed) return usageError(io, "read", parsed.problem);
  const [key, ...extra] = parsed.positionals;
  if (key === undefined) return usageError(io, "read", "the ticket key is missing.", KEY_HINT);
  if (extra.length > 0) return usageError(io, "read", `unexpected argument "${extra[0]}".`, KEY_HINT);
  const tracker = trackerName(parsed.values.tracker);
  if (tracker === "bad") return usageError(io, "read", "--tracker must be jira, linear, github or gitlab.");
  try {
    const opened = await openTracker("read", {
      root: await findRoot(deps),
      tracker,
      fromFile: parsed.values["from-file"],
      run: deps.run,
      env: deps.env,
      warn: warnTo(io),
    });
    io.stdout(`${JSON.stringify(await opened.readTicket(key), null, 2)}\n`);
    return EXIT.ok;
  } catch (error) {
    return failTracker(error, io);
  }
}
