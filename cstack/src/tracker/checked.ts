import { isAbsolute, resolve } from "node:path";
import { RefusedArgumentError } from "./errors.js";
import { isSafeArgument, isValidKey, isValidUrl } from "./keys.js";
import type { Group, Ticket, Tracker, TrackerName } from "./types.js";

/**
 * Put the key, URL and argument checks around any tracker adapter.
 * A refused value never reaches the adapter, so it never reaches a program.
 */
export function checkedTracker(adapter: Tracker, name: TrackerName, warn: (message: string) => void = () => {}): Tracker {
  const key = (value: string): string => {
    if (!isValidKey(name, value)) {
      throw new RefusedArgumentError(`"${printable(value)}" is not a valid ${name} ticket key.`);
    }
    return value;
  };
  const argument = (value: string, what: string): string => {
    if (!isSafeArgument(value)) {
      throw new RefusedArgumentError(`The ${what} "${printable(value)}" is empty, starts with "-" or holds a control character.`);
    }
    return value;
  };
  const badField = (ticket: Ticket): string | undefined => {
    if (!isValidKey(name, ticket?.key)) return `key "${printable(String(ticket?.key))}"`;
    if (!isValidUrl(ticket.url)) return `URL "${printable(String(ticket.url))}"`;
    return undefined;
  };

  return {
    async readTicket(k) {
      const ticket = await adapter.readTicket(key(k));
      const bad = badField(ticket);
      if (bad) throw new RefusedArgumentError(`The tracker returned a ticket with a bad ${bad}.`);
      return ticket;
    },
    async listGroup(group) {
      const checkedGroup: Group =
        "epic" in group ? { epic: key(group.epic) } : { milestone: argument(group.milestone, "milestone name") };
      const kept: Ticket[] = [];
      for (const ticket of await adapter.listGroup(checkedGroup)) {
        const bad = badField(ticket);
        if (bad) warn(`Skipped a ticket with a bad ${bad}.`);
        else kept.push(ticket);
      }
      return kept;
    },
    async moveState(k, stateName) {
      return adapter.moveState(key(k), argument(stateName, "state name"));
    },
    async addComment(k, bodyFile) {
      const file = argument(bodyFile, "body file path");
      return adapter.addComment(key(k), isAbsolute(file) ? file : resolve(file));
    },
  };
}

function printable(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "?");
}
