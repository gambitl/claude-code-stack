// WHY: ADR-SIC-F. This file serves reads only, so a move or a comment goes back to Claude with exit code 4.
import { readFile } from "node:fs/promises";
import { InvalidFileError, NoClientError } from "./errors.js";
import { isValidKey, isValidUrl } from "./keys.js";
import type { Group, StateKind, Ticket, Tracker, TrackerName } from "./types.js";

const FORMAT = "cstack-tracker/1";
const KINDS: StateKind[] = ["todo", "in-progress", "finished", "unknown"];
const TOP_KEYS = ["format", "tracker", "tickets", "group"];
const TICKET_KEYS = ["key", "title", "body", "url", "stateName", "stateKind", "blockers"];

interface Loaded {
  group?: Group;
  tickets: Ticket[];
}

/**
 * A tracker that reads the file Claude wrote with its own connection.
 * It serves reads only. A move or a comment goes back to Claude.
 */
export function claudeFileTracker(path: string, name: TrackerName, warn: (message: string) => void = () => {}): Tracker {
  let loaded: Promise<Loaded> | undefined;
  const load = () => (loaded ??= read(path, name, warn));

  return {
    async readTicket(key) {
      const ticket = (await load()).tickets.find((t) => t.key === key);
      if (!ticket) throw new InvalidFileError(`The file ${path} has no ticket ${key}.`);
      return ticket;
    },
    async listGroup(group) {
      const file = await load();
      if (!file.group) {
        throw new InvalidFileError(`The file ${path} has no "group" key, so cstack cannot tell which group it holds. Ask Claude to write it again with the group.`);
      }
      if (JSON.stringify(file.group) !== JSON.stringify(group)) {
        throw new InvalidFileError(`The file ${path} holds the group ${JSON.stringify(file.group)}, not ${JSON.stringify(group)}.`);
      }
      return file.tickets;
    },
    async moveState(key, stateName) {
      throw NoClientError.forMove(key, stateName);
    },
    async addComment(key, bodyFile) {
      throw NoClientError.forComment(key, bodyFile);
    },
  };
}

async function read(path: string, name: TrackerName, warn: (message: string) => void): Promise<Loaded> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new InvalidFileError(`Cannot read the tracker file ${path}: ${(error as Error).message}`);
  }
  const top = object(raw, "the file", path);
  noUnknownKeys(top, TOP_KEYS, "the file", path);
  if (top.format !== FORMAT) throw new InvalidFileError(`The file ${path} has the format ${JSON.stringify(top.format)}. cstack reads only ${FORMAT}.`);
  if (top.tracker !== name) {
    throw new InvalidFileError(`The file ${path} is written for the tracker ${JSON.stringify(top.tracker)}, not ${name}.`);
  }
  if (!Array.isArray(top.tickets)) throw new InvalidFileError(`The file ${path} needs a "tickets" list.`);

  let group: Group | undefined;
  if (top.group !== undefined) {
    const g = object(top.group, "group", path);
    noUnknownKeys(g, ["milestone", "epic"], "group", path);
    const keys = Object.keys(g);
    if (keys.length !== 1 || typeof g[keys[0]] !== "string") {
      throw new InvalidFileError(`The group in ${path} must be {"milestone": "<name>"} or {"epic": "<key>"}.`);
    }
    group = g as unknown as Group;
  }

  const tickets: Ticket[] = [];
  for (const item of top.tickets) {
    const ticket = parseTicket(item, path);
    if (!isValidKey(name, ticket.key)) warn(`Skipped a ticket with a bad key in ${path}.`);
    else if (!isValidUrl(ticket.url)) warn(`Skipped ticket ${ticket.key} with a bad URL in ${path}.`);
    else {
      const badBlocker = Array.isArray(ticket.blockers) ? ticket.blockers.find((b) => !isValidKey(name, b.key)) : undefined;
      if (badBlocker) warn(`Skipped ticket ${ticket.key} with a bad blocker key in ${path}.`);
      else tickets.push(ticket);
    }
  }
  return { group, tickets };
}

function parseTicket(item: unknown, path: string): Ticket {
  const t = object(item, "a ticket", path);
  noUnknownKeys(t, TICKET_KEYS, "a ticket", path);
  for (const field of ["key", "title", "body", "url", "stateName"]) {
    if (typeof t[field] !== "string") throw new InvalidFileError(`A ticket in ${path} needs a text "${field}".`);
  }
  if (!KINDS.includes(t.stateKind as StateKind)) {
    throw new InvalidFileError(`A ticket in ${path} has a bad "stateKind". Use one of ${KINDS.join(", ")}.`);
  }
  if (t.blockers !== "unknown") {
    if (!Array.isArray(t.blockers)) throw new InvalidFileError(`A ticket in ${path} needs "blockers" as a list or "unknown".`);
    for (const blocker of t.blockers) {
      const b = object(blocker, "a blocker", path);
      noUnknownKeys(b, ["key", "stateKind"], "a blocker", path);
      if (typeof b.key !== "string" || !KINDS.includes(b.stateKind as StateKind)) {
        throw new InvalidFileError(`A blocker in ${path} needs a text "key" and a valid "stateKind".`);
      }
    }
  }
  return t as unknown as Ticket;
}

function object(value: unknown, what: string, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InvalidFileError(`${what} in ${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function noUnknownKeys(value: Record<string, unknown>, allowed: string[], what: string, path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new InvalidFileError(`Unknown key "${key}" in ${what} of ${path}.`);
  }
}
