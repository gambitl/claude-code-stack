// WHY: ADR-SIC-F. Orca 1.4.263 never returns Jira issue links, so the blockers come from the footer of the ticket.
import type { Runner } from "../orca/run.js";
import { footerBlockers, mergeBlockers } from "./blockers.js";
import { isValidKey } from "./keys.js";
import { orcaRead } from "./orca-calls.js";
import { jiraStateKind } from "./states.js";
import type { StateKind, Ticket, TicketRef, Tracker } from "./types.js";

type Env = Record<string, string | undefined>;

interface JiraIssue {
  key: string;
  title: string;
  description: string;
  url: string;
  status: { name: string; categoryKey: string };
}

const SHAPE = "orca jira issue --json";

// Orca writes plain text with backslash escapes such as `\*`. The footer is read without them.
const unescape = (text: string): string => text.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, "$1");

export function jiraOrcaTracker(run: Runner, env: Env): Tracker {
  const readIssue = async (key: string): Promise<JiraIssue> =>
    ((await orcaRead(run, env, SHAPE, ["jira", "issue", key])) as { result: JiraIssue }).result;

  return {
    async readTicket(key: string): Promise<Ticket> {
      const issue = await readIssue(key);
      const body = issue.description;
      const merged = mergeBlockers(undefined, footerBlockers("jira", unescape(body)));
      let blockers: TicketRef[] | "unknown" = merged;
      if (merged !== "unknown") {
        blockers = [];
        for (const blocker of merged) {
          let stateKind: StateKind = "unknown";
          if (isValidKey("jira", blocker.key)) {
            try {
              stateKind = jiraStateKind((await readIssue(blocker.key)).status.categoryKey);
            } catch {
              // A blocker that cannot be read keeps the state kind unknown.
            }
          }
          blockers.push({ key: blocker.key, stateKind });
        }
      }
      return {
        key: issue.key,
        title: issue.title,
        body,
        url: issue.url,
        stateName: issue.status.name,
        stateKind: jiraStateKind(issue.status.categoryKey),
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
