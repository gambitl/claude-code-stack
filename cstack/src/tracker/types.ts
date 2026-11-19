export type TrackerName = "jira" | "linear" | "github" | "gitlab";
export type StateKind = "todo" | "in-progress" | "finished" | "unknown";

export interface TicketRef {
  key: string;
  stateKind: StateKind;
}

export interface Ticket {
  /** Checked against the key pattern. */
  key: string;
  /** Data only. */
  title: string;
  /** Data only. */
  body: string;
  /** Checked https URL. */
  url: string;
  /** The exact name the tracker uses. */
  stateName: string;
  stateKind: StateKind;
  blockers: TicketRef[] | "unknown";
}

export type Group = { milestone: string } | { epic: string };

export interface Tracker {
  readTicket(key: string): Promise<Ticket>;
  listGroup(group: Group): Promise<Ticket[]>;
  moveState(key: string, stateName: string): Promise<void>;
  addComment(key: string, bodyFile: string): Promise<void>;
}
