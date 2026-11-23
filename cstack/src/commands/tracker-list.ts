import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { openTracker, resolveTrackerName } from "../tracker/open.js";
import { readyState } from "../tracker/ready.js";
import type { Group } from "../tracker/types.js";
import { KEY_HINT, type TrackerDeps, failTracker, findRoot, parseTrackerArgs, trackerName, usageError, warnTo } from "./tracker-common.js";

/** `cstack tracker list`: prints the tickets of a milestone or an epic in the format of the file from Claude. */
export async function trackerList(args: string[], io: Io, deps: TrackerDeps): Promise<number> {
  const parsed = parseTrackerArgs(args, {
    milestone: { type: "string" },
    epic: { type: "string" },
    tracker: { type: "string" },
    "from-file": { type: "string" },
    ready: { type: "boolean" },
  });
  if ("problem" in parsed) return usageError(io, "list", parsed.problem);
  if (parsed.positionals.length > 0) return usageError(io, "list", `unexpected argument "${parsed.positionals[0]}".`, KEY_HINT);
  const { milestone, epic } = parsed.values;
  if ((milestone === undefined) === (epic === undefined)) return usageError(io, "list", "give exactly one of --milestone and --epic.", KEY_HINT);
  const tracker = trackerName(parsed.values.tracker);
  if (tracker === "bad") return usageError(io, "list", "--tracker must be jira, linear, github or gitlab.");
  const group: Group = milestone !== undefined ? { milestone } : { epic: epic as string };
  try {
    const root = await findRoot(deps);
    const fromFile = parsed.values["from-file"];
    const name = await resolveTrackerName({ root, tracker, fromFile, run: deps.run });
    const opened = await openTracker("list", {
      root,
      tracker: name,
      fromFile,
      run: deps.run,
      env: deps.env,
      warn: warnTo(io),
    });
    const listed = await opened.listGroup(group);
    const tickets = parsed.values.ready ? listed.filter((t) => readyState(t, false).kind === "ready") : listed;
    io.stdout(`${JSON.stringify({ format: "cstack-tracker/1", tracker: name, group, tickets }, null, 2)}\n`);
    return EXIT.ok;
  } catch (error) {
    return failTracker(error, io);
  }
}
