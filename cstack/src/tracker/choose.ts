import type { Runner } from "../orca/run.js";
import { EXIT } from "../manifest.js";
import { TrackerError } from "./errors.js";
import type { TrackerName } from "./types.js";

export type Capability = "read" | "list" | "move" | "comment";
export type Client = "orca" | "gh" | "glab" | "file" | "none";

/** A usage error: cstack cannot tell which tracker to use. */
export class TrackerChoiceError extends TrackerError {
  constructor(message: string) {
    super(message, EXIT.usage);
  }
}

/** The tracker is the forge of the origin remote, read from an https or a git@host: URL. */
export function trackerFromRemote(remoteUrl: string): TrackerName {
  const host = /^https?:\/\/(?:[^/@]*@)?([^/:]+)/i.exec(remoteUrl.trim())?.[1] ?? /^[^@\s/]+@([^:\s/]+):/.exec(remoteUrl.trim())?.[1];
  const lower = host?.toLowerCase();
  if (lower === "github.com") return "github";
  if (lower?.includes("gitlab")) return "gitlab";
  throw new TrackerChoiceError(
    `cstack cannot tell the tracker from the origin remote${lower ? ` host "${lower}"` : ""}. Pass --tracker <jira|linear|github|gitlab>.`,
  );
}

export interface ChooserOptions {
  tracker: TrackerName;
  /** Whether the Orca feature for this tracker is available. Only Jira and Linear use it. */
  orcaAvailable: boolean;
  runner: Runner;
}

/** Choose the client of each capability: Orca, then gh or glab, then the file (reads only). */
export function createClientChooser({ tracker, orcaAvailable, runner }: ChooserOptions): (capability: Capability) => Promise<Client> {
  const forge = tracker === "github" ? "gh" : tracker === "gitlab" ? "glab" : undefined;
  let forgeLoggedIn: Promise<boolean> | undefined;
  // Checked lazily and at most once.
  const loggedIn = (): Promise<boolean> => {
    forgeLoggedIn ??= runner(forge as string, ["auth", "status"]).then((result) => result.kind === "ok");
    return forgeLoggedIn;
  };

  return async (capability) => {
    if (!forge && orcaAvailable) return "orca";
    if (forge && (await loggedIn())) return forge;
    return capability === "read" || capability === "list" ? "file" : "none";
  };
}
