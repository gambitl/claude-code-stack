import type { StateKind, Ticket } from "../tracker/types.js";
import { readyState, type ReadyState } from "../tracker/ready.js";
import { printableText, printableTitle } from "./title.js";
import type { WorktreeCheck } from "./worktrees.js";

export interface Listed {
  ticket: Ticket;
  /** Why the ticket is in its group. Empty for a ready ticket. */
  reason: string;
}

export interface Groups {
  ready: Listed[];
  blocked: Listed[];
  started: Listed[];
  /** The number of finished tickets, which are not listed. */
  finished: number;
}

const KIND_NAMES: Record<StateKind, string> = {
  todo: "to do",
  "in-progress": "in progress",
  finished: "done",
  unknown: "unknown state",
};

/** Why a blocked ticket is blocked, in words. */
export function blockedReason(ticket: Ticket, state: Extract<ReadyState, { kind: "blocked" }>): string {
  if (state.reason === "unknown-state") return `unknown state "${printableText(ticket.stateName)}"`;
  if (state.reason !== "blocked-by") return "blockers unknown";
  const open = Array.isArray(ticket.blockers) ? ticket.blockers : [];
  const named = state.blockers.map((key) => {
    const kind = open.find((b) => b.key === key)?.stateKind ?? "unknown";
    return `${printableText(key)} (${KIND_NAMES[kind]})`;
  });
  return `blocked by ${named.join(", ")}`;
}

/** Sorts the tickets with the one ready rule of the tracker. Only a ticket that is to do needs the worktree check. */
export async function groupTickets(tickets: Ticket[], check: WorktreeCheck): Promise<Groups> {
  const groups: Groups = { ready: [], blocked: [], started: [], finished: 0 };
  for (const ticket of tickets) {
    const answer = ticket.stateKind === "todo" ? await check.check(ticket) : { found: false as const };
    const state = readyState(ticket, answer.found);
    switch (state.kind) {
      case "left-out":
        groups.finished++;
        break;
      case "ready":
        groups.ready.push({ ticket, reason: "" });
        break;
      case "started":
        groups.started.push({ ticket, reason: answer.found ? answer.reason : "in progress" });
        break;
      case "blocked": {
        const reason = blockedReason(ticket, state);
        groups.blocked.push({ ticket, reason });
        break;
      }
    }
  }
  return groups;
}

function section(title: string, items: Listed[]): string {
  const lines = items.map(({ ticket, reason }) => {
    const head = `  ${printableText(ticket.key)}  ${printableTitle(ticket.title)}`;
    return reason === "" ? head : `${head}  ${reason}`;
  });
  return [`${title} (${items.length}):`, ...lines].join("\n");
}

export function formatGroups(groups: Groups): string {
  const parts = [section("Ready", groups.ready), section("Blocked", groups.blocked), section("Started", groups.started)];
  let text = `${parts.join("\n\n")}\n`;
  if (groups.finished > 0) {
    const n = groups.finished;
    text += `\n${n} finished ${n === 1 ? "ticket is" : "tickets are"} not listed.\n`;
  }
  return text;
}
