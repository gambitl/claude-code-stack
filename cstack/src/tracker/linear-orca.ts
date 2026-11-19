import type { Runner } from "../orca/run.js";
import { footerBlockers, mergeBlockers } from "./blockers.js";
import { isValidKey } from "./keys.js";
import { orcaRead } from "./orca-calls.js";
import { linearStateKind } from "./states.js";
import type { StateKind, Ticket, TicketRef, Tracker } from "./types.js";

type Env = Record<string, string | undefined>;

interface LinearAnswer {
  issue: {
    identifier: string;
    title: string;
    description?: string | null;
    url: string;
    state?: { name: string; type: string };
  };
  relations?: unknown;
  meta?: {
    includeErrors?: string[];
    sections?: { relations?: { hasMore?: boolean } };
  };
}

const SHAPE = "orca linear issue --relations --json";

export function linearOrcaTracker(run: Runner, env: Env): Tracker {
  const readIssue = async (key: string): Promise<LinearAnswer> =>
    ((await orcaRead(run, env, SHAPE, ["linear", "issue", key, "--relations"])) as { result: LinearAnswer }).result;

  return {
    async readTicket(key: string): Promise<Ticket> {
      const result = await readIssue(key);
      const { issue, meta } = result;
      const body = issue.description ?? "";
      const countable =
        Array.isArray(result.relations) &&
        !(meta?.includeErrors ?? []).includes("relations") &&
        meta?.sections?.relations?.hasMore !== true;
      const relations = countable
        ? (result.relations as { relationship?: string; relatedIssue?: { identifier?: string } }[])
            .filter((r) => r.relationship === "blockedBy" && typeof r.relatedIssue?.identifier === "string")
            .map((r): TicketRef => ({ key: r.relatedIssue!.identifier!, stateKind: "unknown" }))
        : undefined;
      const merged = mergeBlockers(relations, footerBlockers("linear", body));
      let blockers: TicketRef[] | "unknown" = merged;
      if (merged !== "unknown") {
        blockers = [];
        for (const blocker of merged) {
          let stateKind: StateKind = blocker.stateKind;
          if (stateKind === "unknown" && isValidKey("linear", blocker.key)) {
            try {
              const state = (await readIssue(blocker.key)).issue.state;
              stateKind = state ? linearStateKind(state.type) : "unknown";
            } catch {
              // A blocker that cannot be read keeps the state kind unknown.
            }
          }
          blockers.push({ key: blocker.key, stateKind });
        }
      }
      return {
        key: issue.identifier,
        title: issue.title,
        body,
        url: issue.url,
        stateName: issue.state?.name ?? "",
        stateKind: issue.state ? linearStateKind(issue.state.type) : "unknown",
        blockers,
      };
    },
    async listGroup(): Promise<Ticket[]> {
      throw new Error("Not built yet.");
    },
    async moveState(): Promise<void> {
      throw new Error("Not built yet.");
    },
    async addComment(): Promise<void> {
      throw new Error("Not built yet.");
    },
  };
}
