import type { RunResult, Runner } from "../orca/run.js";
import { parseRemote, redact, type Remote } from "../publish/remote.js";
import { NoClientError, RefusedArgumentError, TrackerError, WriteShapeError } from "./errors.js";
import { EXIT } from "../manifest.js";
import type { StateKind, Ticket } from "./types.js";

/** A list reads at most this many issues. A larger group is refused. */
export const MAX_GROUP = 500;

/** Reads the host and path of the `origin` remote, with the repository root as working folder. */
export async function originRepo(run: Runner, root: string): Promise<Remote> {
  const result = await run("git", ["config", "--get", "remote.origin.url"], root);
  const remote = result.kind === "ok" ? parseRemote(result.stdout) : undefined;
  if (!remote) {
    throw new RefusedArgumentError(
      "cstack cannot find the origin remote of this repository. Run the command inside a clone that has an origin remote, or pass --from-file <path> for a read.",
    );
  }
  return remote;
}

/** The state name of a GitHub or GitLab issue. A review label wins over a progress label. */
export function forgeStateName(tracker: "github" | "gitlab", issue: { open: boolean; labels: string[] }): string {
  if (!issue.open) return "closed";
  const labels = issue.labels.map((l) => l.toLowerCase());
  if (labels.includes("in review")) return "in review";
  if (labels.includes("in progress")) return "in progress";
  return tracker === "github" ? "open" : "opened";
}

/**
 * Gives every blocker with the state kind `unknown` its real state kind.
 * The state comes from a ticket of the group when it is there, else from one lookup per key.
 * A lookup that fails leaves the kind `unknown` and warns.
 */
export async function settleBlockers(
  tickets: Ticket[],
  lookup: (key: string) => Promise<StateKind>,
  warn: (message: string) => void,
): Promise<Ticket[]> {
  const known = new Map<string, StateKind>(tickets.map((t) => [t.key, t.stateKind]));
  const pending = new Map<string, Promise<StateKind>>();
  const settle = (key: string): Promise<StateKind> => {
    const inGroup = known.get(key);
    if (inGroup !== undefined && inGroup !== "unknown") return Promise.resolve(inGroup);
    let p = pending.get(key);
    if (!p) {
      p = lookup(key).catch((error: unknown) => {
        warn(`cstack: cannot read the state of blocker ${key}: ${error instanceof Error ? redact(error.message) : String(error)}`);
        return "unknown" as StateKind;
      });
      pending.set(key, p);
    }
    return p;
  };
  return Promise.all(
    tickets.map(async (t) => {
      if (t.blockers === "unknown") return t;
      const blockers = await Promise.all(
        t.blockers.map(async (b) => (b.stateKind === "unknown" ? { key: b.key, stateKind: await settle(b.key) } : b)),
      );
      return { ...t, blockers };
    }),
  );
}

/** Turns a failed call of `gh` or `glab` into the error of the command. `write` is true for a move or a comment. */
export function forgeFailure(tool: "gh" | "glab", result: Exclude<RunResult, { kind: "ok" }>, write: boolean): TrackerError {
  if (result.kind === "missing") return new NoClientError(`${tool} is not installed.`);
  if (result.kind === "failed") {
    const text = redact(result.stderr?.trim() ?? "");
    if ((tool === "gh" && result.exitCode === 4) || (tool === "glab" && /\b401\b/.test(text))) {
      return new NoClientError(`${tool} is not logged in or its token expired. ${text}`.trim());
    }
    return new TrackerError(`${tool} failed with exit code ${result.exitCode}. ${text}`.trim(), EXIT.toolFailed);
  }
  const what = result.kind === "timeout" ? "ran out of time" : "gave an answer that is too large";
  if (write) return new WriteShapeError(`${tool} ${what}.`);
  return new TrackerError(`${tool} ${what}.`, EXIT.toolFailed);
}

