// WHY: this is a temporary copy of the file that ticket #26 owns. Whichever of #26 and #29 merges second keeps the version of #26 and deletes this copy.
import type { Runner } from "../orca/run.js";
import { checkedTracker } from "./checked.js";
import { claudeFileTracker } from "./claude-file.js";
import { trackerFromRemote, type Capability } from "./choose.js";
import { NoClientError } from "./errors.js";
import type { Tracker, TrackerName } from "./types.js";

export interface OpenTrackerOptions {
  root: string;
  tracker?: TrackerName;
  fromFile?: string;
  run: Runner;
  env: NodeJS.ProcessEnv;
  warn: (message: string) => void;
}

/** Opens the tracker for one capability. This copy serves only the file from Claude. */
export async function openTracker(capability: Capability, options: OpenTrackerOptions): Promise<Tracker> {
  const { root, fromFile, run, warn } = options;
  let name = options.tracker;
  if (!name) {
    const result = await run("git", ["remote", "get-url", "origin"], root);
    if (result.kind !== "ok") throw new NoClientError("cstack cannot read the origin remote. Pass --tracker <jira|linear|github|gitlab>.");
    name = trackerFromRemote(result.stdout);
  }
  const reads = capability === "read" || capability === "list";
  if (fromFile && reads) return checkedTracker(claudeFileTracker(fromFile, name, warn), name, warn);
  if (reads) throw NoClientError.forRead(capability === "list" ? "a group of tickets" : "a ticket");
  throw new NoClientError(`No client can ${capability === "move" ? "move tickets" : "add comments"} here.`);
}
