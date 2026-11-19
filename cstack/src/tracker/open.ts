// WHY: ADR-SIC-F. One place that picks the client for a capability and puts the checks around it.
import type { Runner } from "../orca/run.js";
import { EXIT } from "../manifest.js";
import { checkedTracker } from "./checked.js";
import { claudeFileTracker } from "./claude-file.js";
import { createClientChooser, trackerFromRemote, type Capability } from "./choose.js";
import { NoClientError, TrackerError } from "./errors.js";
import { originRepo } from "./forge.js";
import { githubGhTracker } from "./github-gh.js";
import { gitlabGlabTracker } from "./gitlab-glab.js";
import type { Tracker, TrackerName } from "./types.js";

export interface OpenTrackerOptions {
  root: string;
  tracker?: TrackerName;
  fromFile?: string;
  run: Runner;
  env: Record<string, string | undefined>;
  warn: (message: string) => void;
}

/** Opens the tracker that serves one capability, inside the key and argument checks. */
export async function openTracker(capability: Capability, options: OpenTrackerOptions): Promise<Tracker> {
  const { root, run, warn } = options;
  const reads = capability === "read" || capability === "list";
  // The origin remote is read at most once.
  const origin = originRepo(run, root);
  const name = options.tracker ?? trackerFromRemote(`https://${(await origin).host}/`);

  if (options.fromFile && reads) {
    return checkedTracker(claudeFileTracker(options.fromFile, name, warn), name, warn);
  }
  if (name === "jira" || name === "linear") {
    throw new TrackerError(`cstack cannot reach ${name} yet. Ticket #25 builds it.`, EXIT.refused);
  }

  const { host } = await origin;
  const client = await createClientChooser({ tracker: name, orcaAvailable: false, runner: run, host })(capability);
  if (client === "gh") return checkedTracker(githubGhTracker(run, root, warn), name, warn);
  if (client === "glab") return checkedTracker(gitlabGlabTracker(run, root, warn), name, warn);
  const forge = name === "github" ? "gh" : "glab";
  throw new NoClientError(
    reads
      ? `${forge} is not logged in for ${host}. Ask Claude to read the tracker with its own connection and write a file in the format cstack-tracker/1, then pass it with --from-file <path>.`
      : `${forge} is not logged in for ${host}, so cstack cannot change the tracker.`,
  );
}
