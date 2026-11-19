import { RefusedArgumentError } from "../tracker/errors.js";
import { isValidKey } from "../tracker/keys.js";
import type { TrackerName } from "../tracker/types.js";

function checked(tracker: TrackerName, key: string): void {
  if (!isValidKey(tracker, key)) throw new RefusedArgumentError(`"${key}" is not a valid ${tracker} ticket key.`);
}

/** The name of the worktree folder and of the branch of a ticket. */
export function shortName(tracker: TrackerName, key: string): string {
  checked(tracker, key);
  return key.startsWith("#") ? `issue-${key.slice(1)}` : key.toLowerCase();
}

/** The ticket id that a resolve-issue run folder carries in its name. */
export function runTicketId(tracker: TrackerName, key: string): string {
  checked(tracker, key);
  return key.startsWith("#") ? key.slice(1) : key;
}
