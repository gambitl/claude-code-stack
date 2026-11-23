import { isAbsolute, resolve } from "node:path";
import { RefusedArgumentError } from "./errors.js";
import { redact } from "../publish/remote.js";
import type { Remote } from "../publish/remote.js";
import { isSafeArgument, isValidKey, isValidUrl, keyForms, keyOfLink, keyOfNumber, looksLikeLink } from "./keys.js";
import type { Group, Ticket, Tracker, TrackerName } from "./types.js";

/**
 * Put the key, URL and argument checks around any tracker adapter.
 * A refused value never reaches the adapter, so it never reaches a program.
 */
export function checkedTracker(
  adapter: Tracker,
  name: TrackerName,
  warn: (message: string) => void = () => {},
  origin?: () => Promise<Remote>,
): Tracker {
  const refuseKey = (value: string): RefusedArgumentError =>
    new RefusedArgumentError(`"${shown(value)}" is not a valid ${name} ticket key. ${keyForms(name)}`);
  const key = async (value: string): Promise<string> => {
    let result = value;
    if (name === "github" || name === "gitlab") {
      if (!looksLikeLink(value)) result = keyOfNumber(value) ?? value;
      else if (origin) {
        let remote: Remote;
        try {
          remote = await origin();
        } catch (error) {
          if (error instanceof RefusedArgumentError) {
            throw new RefusedArgumentError(
              `cstack cannot check the link "${shown(value)}", because this repository has no origin remote. Write the key as '#12'.`,
            );
          }
          throw error;
        }
        const found = keyOfLink(name, value, remote);
        if (!found) {
          const where = `${remote.host}${remote.port ? `:${remote.port}` : ""}/${remote.path}`;
          throw new RefusedArgumentError(
            `cstack only reads the issues of ${where}, the origin project, and ${shown(value)} is not the link of one of its issues. Write the key as '#12'.`,
          );
        }
        result = found;
      }
    }
    if (!isValidKey(name, result)) throw refuseKey(value);
    return result;
  };
  const argument = (value: string, what: string): string => {
    if (!isSafeArgument(value)) {
      throw new RefusedArgumentError(`The ${what} "${printable(value)}" is empty, starts with "-" or holds a control character.`);
    }
    return value;
  };
  const badField = (ticket: Ticket): string | undefined => {
    if (!isValidKey(name, ticket.key)) return `key "${printable(ticket.key)}"`;
    if (!isValidUrl(ticket.url)) return `URL "${printable(ticket.url)}"`;
    if (Array.isArray(ticket.blockers)) {
      for (const blocker of ticket.blockers) {
        if (!isValidKey(name, blocker?.key)) return `blocker key "${printable(String(blocker?.key))}"`;
      }
    }
    return undefined;
  };

  return {
    async readTicket(k) {
      const ticket = await adapter.readTicket(await key(k));
      const bad = badField(ticket);
      if (bad) throw new RefusedArgumentError(`The tracker returned a ticket with a bad ${bad}.`);
      return ticket;
    },
    async listGroup(group) {
      const checkedGroup: Group =
        "epic" in group ? { epic: await key(group.epic) } : { milestone: argument(group.milestone, "milestone name") };
      const kept: Ticket[] = [];
      for (const ticket of await adapter.listGroup(checkedGroup)) {
        const bad = badField(ticket);
        if (bad) warn(`Skipped a ticket with a bad ${bad}.`);
        else kept.push(ticket);
      }
      return kept;
    },
    async moveState(k, stateName) {
      return adapter.moveState(await key(k), argument(stateName, "state name"));
    },
    async addComment(k, bodyFile) {
      const file = argument(bodyFile, "body file path");
      return adapter.addComment(await key(k), isAbsolute(file) ? file : resolve(file));
    },
  };
}

const shown = (value: string): string => printable(redact(value));

function printable(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "?");
}
