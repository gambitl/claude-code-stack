import { NoClientError } from "../../src/tracker/errors.js";
import type { Group, Ticket, Tracker } from "../../src/tracker/types.js";

export type Capability = "read" | "list" | "move" | "comment";

export interface FakeTrackerOptions {
  tickets?: Ticket[];
  groups?: { group: Group; keys: string[] }[];
  /** Capabilities that behave as if no client existed. */
  off?: Capability[];
}

/** A tracker in memory. It records every move and comment. */
export class FakeTracker implements Tracker {
  readonly tickets = new Map<string, Ticket>();
  readonly groups: { group: Group; keys: string[] }[];
  readonly off: Set<Capability>;
  readonly moves: { key: string; stateName: string }[] = [];
  readonly comments: { key: string; bodyFile: string }[] = [];

  constructor(options: FakeTrackerOptions = {}) {
    for (const ticket of options.tickets ?? []) this.tickets.set(ticket.key, ticket);
    this.groups = options.groups ?? [];
    this.off = new Set(options.off ?? []);
  }

  async readTicket(key: string): Promise<Ticket> {
    if (this.off.has("read")) throw NoClientError.forRead(`ticket ${key}`);
    return this.get(key);
  }

  async listGroup(group: Group): Promise<Ticket[]> {
    if (this.off.has("list")) throw NoClientError.forRead("a group of tickets");
    const same = JSON.stringify(group);
    const found = this.groups.find((g) => JSON.stringify(g.group) === same);
    return (found?.keys ?? []).map((key) => this.get(key));
  }

  async moveState(key: string, stateName: string): Promise<void> {
    if (this.off.has("move")) throw NoClientError.forMove(key, stateName);
    const ticket = this.get(key);
    this.moves.push({ key, stateName });
    this.tickets.set(key, { ...ticket, stateName });
  }

  async addComment(key: string, bodyFile: string): Promise<void> {
    if (this.off.has("comment")) throw NoClientError.forComment(key, bodyFile);
    this.comments.push({ key, bodyFile });
  }

  private get(key: string): Ticket {
    const ticket = this.tickets.get(key);
    if (!ticket) throw new Error(`The fake tracker has no ticket ${key}.`);
    return ticket;
  }
}
