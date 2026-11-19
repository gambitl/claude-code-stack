// WHY: ADR-SIC-F. One place that picks the client for a capability and puts the checks around it.
import { readFileSync } from "node:fs";
import { orcaFeatures } from "../orca/features.js";
import type { Runner } from "../orca/run.js";
import { checkedTracker } from "./checked.js";
import { checkStateName } from "./states.js";
import { claudeFileTracker } from "./claude-file.js";
import { createClientChooser, trackerFromRemote, type Capability } from "./choose.js";
import { NoClientError } from "./errors.js";
import { originRepo } from "./forge.js";
import { githubGhTracker } from "./github-gh.js";
import { gitlabGlabTracker } from "./gitlab-glab.js";
import { jiraOrcaTracker } from "./jira-orca.js";
import { linearOrcaTracker } from "./linear-orca.js";
import type { Tracker, TrackerName } from "./types.js";

export interface OpenTrackerOptions {
  root: string;
  tracker?: TrackerName;
  fromFile?: string;
  run: Runner;
  env: Record<string, string | undefined>;
  warn: (message: string) => void;
}

const TRACKER_NAMES: TrackerName[] = ["jira", "linear", "github", "gitlab"];

/**
 * The tracker name of a command. `--tracker` wins. Then, with `--from-file`, the "tracker" field of a
 * readable file in the format cstack-tracker/1. Only then does cstack read the origin remote, so a
 * clone with no origin still works with a file.
 */
export async function resolveTrackerName(
  options: Pick<OpenTrackerOptions, "root" | "tracker" | "fromFile" | "run">,
): Promise<TrackerName> {
  if (options.tracker) return options.tracker;
  if (options.fromFile) {
    try {
      const raw = JSON.parse(readFileSync(options.fromFile, "utf8")) as { format?: unknown; tracker?: unknown };
      if (raw.format === "cstack-tracker/1" && (TRACKER_NAMES as unknown[]).includes(raw.tracker)) return raw.tracker as TrackerName;
    } catch {
      // An unreadable file is reported later, by the file tracker.
    }
  }
  return trackerFromRemote(`https://${(await originRepo(options.run, options.root)).host}/`);
}

/**
 * Handles a move or a comment when no client is logged in. The key and the argument are still checked,
 * so a bad one exits with 1 before the exit code 4. It always throws.
 */
export async function refuseWithoutClient(
  error: NoClientError,
  options: Pick<OpenTrackerOptions, "root" | "tracker" | "run" | "warn">,
  write: { move: { key: string; stateName: string } } | { comment: { key: string; path: string } },
): Promise<never> {
  const name = await resolveTrackerName(options);
  const reject = () => Promise.reject(error);
  const tracker = checkedTracker(
    {
      readTicket: reject,
      listGroup: reject,
      async moveState(k, s) {
        // Jira and Linear offer their own state names, which cstack cannot list without a client.
        if (name === "github" || name === "gitlab") checkStateName(name, s);
        throw NoClientError.forMove(k, s);
      },
      async addComment(k, file) {
        throw NoClientError.forComment(k, file);
      },
    },
    name,
    options.warn,
  );
  if ("move" in write) await tracker.moveState(write.move.key, write.move.stateName);
  else await tracker.addComment(write.comment.key, write.comment.path);
  throw error;
}

/** Opens the tracker that serves one capability, inside the key and argument checks. */
export async function openTracker(capability: Capability, options: OpenTrackerOptions): Promise<Tracker> {
  const { root, run, warn } = options;
  const reads = capability === "read" || capability === "list";
  // The origin remote is read at most once.
  let origin: ReturnType<typeof originRepo> | undefined;
  const readOrigin = () => (origin ??= originRepo(run, root));
  if (options.fromFile && reads) {
    const fileName = await resolveTrackerName(options);
    return checkedTracker(claudeFileTracker(options.fromFile, fileName, warn), fileName, warn);
  }
  const name = options.tracker ?? trackerFromRemote(`https://${(await readOrigin()).host}/`);
  if (name === "jira" || name === "linear") {
    // Jira and Linear go through Orca only, so the origin remote plays no part here.
    const feature = await orcaFeatures(run, options.env).get(name);
    const client = await createClientChooser({ tracker: name, orcaAvailable: feature.available, runner: run })(capability);
    if (client === "orca") {
      const adapter = name === "jira" ? jiraOrcaTracker(run, options.env) : linearOrcaTracker(run, options.env);
      return checkedTracker(adapter, name, warn);
    }
    const reason = feature.available ? "" : ` ${feature.reason}`;
    throw new NoClientError(
      reads
        ? `Orca cannot reach ${name}.${reason} Ask Claude to read the tracker with its own connection and write a file in the format cstack-tracker/1, then pass it with --from-file <path>.`
        : `Orca cannot reach ${name}.${reason} So cstack cannot change the tracker.`,
    );
  }

  const { host } = await readOrigin();
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
