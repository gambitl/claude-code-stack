import type { Runner } from "../orca/run.js";
import { footerBlockers, mergeBlockers } from "./blockers.js";
import { EXIT } from "../manifest.js";
import { NoClientError, RefusedArgumentError, TrackerError } from "./errors.js";
import { isValidKey } from "./keys.js";
import { checkCommentBody, orcaRead, orcaWrite } from "./orca-calls.js";
import { checkStateName, linearStateKind } from "./states.js";
import type { Group, StateKind, Ticket, TicketRef, Tracker } from "./types.js";

type Env = Record<string, string | undefined>;

interface LinearAnswer {
  issue: {
    identifier: string;
    title: string;
    description?: string | null;
    url: string;
    state?: { name: string; type: string };
    team?: { key?: string };
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
    readTicket: (key: string) => readOne(key, new Map()),
    async listGroup(group: Group): Promise<Ticket[]> {
      if (!("epic" in group)) {
        throw new NoClientError(
          "Orca cannot filter Linear issues by project milestone. With your own connection, list the issues of that milestone and write the file yourself.",
        );
      }
      const name = `orca linear list-issues --parent-id ${group.epic}`;
      const answer = (
        (await orcaRead(run, env, "orca linear list-issues --json", ["linear", "list-issues", "--parent-id", group.epic])) as {
          result: { issues: { identifier: string; state?: { type: string } }[]; truncated: boolean; meta: { partial: boolean } };
        }
      ).result;
      if (answer.truncated) {
        throw new RefusedArgumentError(`\`${name}\` returned only some of the tickets, because the group has more tickets than Orca returned.`);
      }
      if (answer.meta.partial) {
        throw new TrackerError(`\`${name}\` answered only for some Linear workspaces.`, EXIT.toolFailed);
      }
      const known = new Map<string, StateKind>();
      for (const issue of answer.issues) {
        known.set(issue.identifier, issue.state ? linearStateKind(issue.state.type) : "unknown");
      }
      const tickets: Ticket[] = [];
      for (const issue of answer.issues) tickets.push(await readOne(issue.identifier, known));
      return tickets;
    },
    async moveState(key: string, stateName: string): Promise<void> {
      const team = (await readIssue(key)).issue.team?.key;
      if (typeof team !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(team)) {
        throw new RefusedArgumentError(`Orca answered with a team key for ${key} that cstack does not accept.`);
      }
      const { states } = (
        (await orcaRead(run, env, "orca linear team states --json", ["linear", "team", "states", "--team", team])) as {
          result: { states: { name: string }[] };
        }
      ).result;
      checkStateName("linear", stateName, states.map((s) => s.name));
      await orcaWrite(run, env, "orca linear status set --json", ["linear", "status", "set", key, "--to", stateName]);
    },
    async addComment(key: string, bodyFile: string): Promise<void> {
      checkCommentBody(bodyFile, 65000);
      await orcaWrite(run, env, "orca linear comment add --json", ["linear", "comment", "add", key, "--body-file", bodyFile]);
    },
  };

  async function readOne(key: string, known: Map<string, StateKind>): Promise<Ticket> {
    {
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
          let stateKind: StateKind = known.get(blocker.key) ?? blocker.stateKind;
          if (stateKind === "unknown" && !known.has(blocker.key) && isValidKey("linear", blocker.key)) {
            try {
              const state = (await readIssue(blocker.key)).issue.state;
              stateKind = state ? linearStateKind(state.type) : "unknown";
              known.set(blocker.key, stateKind);
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
    }
  }
}
