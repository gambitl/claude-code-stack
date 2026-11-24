import type { Ticket } from "./types.js";

export type ReadyState =
  | { kind: "left-out" }
  | { kind: "started" }
  | { kind: "ready" }
  | { kind: "blocked"; reason: "unknown-state" | "unknown-blockers" }
  | { kind: "blocked"; reason: "blocked-by"; blockers: string[] };

/** Decide, in a fixed order, whether a ticket is ready, started or blocked. */
export function readyState(ticket: Ticket): ReadyState {
  if (ticket.stateKind === "finished") return { kind: "left-out" };
  if (ticket.stateKind === "unknown") return { kind: "blocked", reason: "unknown-state" };
  if (ticket.stateKind === "in-progress") return { kind: "started" };
  if (ticket.blockers === "unknown") return { kind: "blocked", reason: "unknown-blockers" };
  const open = ticket.blockers.filter((b) => b.stateKind !== "finished").map((b) => b.key);
  if (open.length > 0) return { kind: "blocked", reason: "blocked-by", blockers: open };
  return { kind: "ready" };
}
