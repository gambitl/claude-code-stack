import type { Runner } from "../orca/run.js";
import { readyState } from "../tracker/ready.js";
import type { Tracker, TrackerName } from "../tracker/types.js";
import { blockedReason } from "./groups.js";
import { shortName } from "./names.js";
import type { OrcaOutcome } from "./start-orca.js";
import { printableText } from "./title.js";
import type { WorktreeCheck } from "./worktrees.js";

/** Starts one ticket, in git or in Orca. */
export type Starter = (key: string, short: string, url: string) => Promise<OrcaOutcome>;

export interface StartContext {
  /** Reads the ticket again, just before the start. */
  reader: Tracker;
  /** The worktree check, loaded after the answer. */
  check: WorktreeCheck;
  start: Starter;
  run: Runner;
  root: string;
  tracker: TrackerName;
  /** When it is aborted, nothing is created. `cstack wave` gives none. */
  signal?: AbortSignal;
}

export interface StartReport {
  kind: "started" | "skipped" | "failed" | "unknown";
  /** The printable line, with its key in front and a line break at the end. */
  line: string;
}

/** Reads the ticket again, applies the ready rule again, checks the branch, and starts the ticket. */
export async function startTicket(listedKey: string, context: StartContext): Promise<StartReport> {
  const { reader, check, start, run, root, tracker, signal } = context;
  const key = printableText(listedKey);
  const ticket = await reader.readTicket(listedKey);
  if (ticket.key !== listedKey) {
    return { kind: "skipped", line: `${key}  skipped, the tracker answered with the ticket ${printableText(ticket.key)} instead.\n` };
  }
  const found = ticket.stateKind === "todo" ? await check.check(ticket) : { found: false as const };
  const state = readyState(ticket, found.found);
  if (state.kind !== "ready") {
    let why: string;
    if (state.kind === "blocked") why = blockedReason(ticket, state);
    else if (state.kind === "started") why = found.found ? found.reason : "in progress";
    else why = "done";
    return { kind: "skipped", line: `${key}  skipped, it is no longer ready (${why}).\n` };
  }
  const short = shortName(tracker, ticket.key);
  const branch = await run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${short}`], root);
  if (branch.kind === "ok") return { kind: "skipped", line: `${key}  skipped, the branch ${short} already exists.\n` };
  // WHY: Control-C also stops `git show-ref`, so a cut call looks like "no branch". The stop signal tells them apart.
  signal?.throwIfAborted();
  const outcome = await start(ticket.key, short, ticket.url);
  if (outcome.kind === "started") return { kind: "started", line: `${key}  ${printableText(outcome.line)}\n` };
  if (outcome.kind === "skipped") return { kind: "skipped", line: `${key}  skipped, ${printableText(outcome.reason)}.\n` };
  if (outcome.kind === "unknown") return { kind: "unknown", line: `${key}  ${printableText(outcome.reason)}\n` };
  return { kind: "failed", line: `${key}  failed, ${printableText(outcome.reason)}.\n` };
}
