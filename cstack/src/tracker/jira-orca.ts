// WHY: ADR-SIC-F. Orca 1.4.263 never returns Jira issue links, so the blockers come from the footer of the ticket.
import type { Runner } from "../orca/run.js";
import { footerBlockers, mergeBlockers } from "./blockers.js";
import { isValidKey } from "./keys.js";
import { orcaRead } from "./orca-calls.js";
import { jiraStateKind } from "./states.js";
import { RefusedArgumentError } from "./errors.js";
import type { Group, StateKind, Ticket, TicketRef, Tracker } from "./types.js";

type Env = Record<string, string | undefined>;

interface JiraIssue {
  key: string;
  title: string;
  description: string;
  url: string;
  status: { name: string; categoryKey: string };
}

const SHAPE = "orca jira issue --json";
const SEARCH_SHAPE = "orca jira search --json";

// Orca writes plain text with backslash escapes such as `\*`. The footer is read without them.
const unescape = (text: string): string => text.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, "$1");

const LIMIT = 100;

/** Builds the JQL of a group, or refuses a name that could change the query. */
export function jiraGroupQuery(group: Group): string {
  if ("epic" in group) {
    if (!isValidKey("jira", group.epic)) throw new RefusedArgumentError(`"${group.epic}" is not a Jira key.`);
    return `parent = ${group.epic} ORDER BY key`;
  }
  const name = group.milestone;
  if (name === "") throw new RefusedArgumentError("The milestone name is empty.");
  if (name.length > 100) throw new RefusedArgumentError("The milestone name is longer than 100 characters.");
  if (/["\\\u0000-\u001f\u007f]/.test(name)) {
    throw new RefusedArgumentError("The milestone name holds a double quote, a backslash or a control character.");
  }
  return `fixVersion = "${name}" ORDER BY key`;
}

export function jiraOrcaTracker(run: Runner, env: Env): Tracker {
  const readIssue = async (key: string): Promise<JiraIssue> =>
    ((await orcaRead(run, env, SHAPE, ["jira", "issue", key])) as { result: JiraIssue }).result;

  // `states` maps a key to its state kind. It lives for one call, so a blocker is read once.
  const toTicket = async (issue: JiraIssue, states: Map<string, StateKind>): Promise<Ticket> => {
    const body = issue.description;
    const merged = mergeBlockers(undefined, footerBlockers("jira", unescape(body)));
    let blockers: TicketRef[] | "unknown" = merged;
    if (merged !== "unknown") {
      blockers = [];
      for (const blocker of merged) {
        let stateKind = states.get(blocker.key) ?? "unknown";
        if (!states.has(blocker.key) && isValidKey("jira", blocker.key)) {
          try {
            stateKind = jiraStateKind((await readIssue(blocker.key)).status.categoryKey);
          } catch {
            // A blocker that cannot be read keeps the state kind unknown.
          }
          states.set(blocker.key, stateKind);
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
  };

  return {
    readTicket: async (key: string): Promise<Ticket> => toTicket(await readIssue(key), new Map()),
    async listGroup(group: Group): Promise<Ticket[]> {
      const query = jiraGroupQuery(group);
      const issues = (
        (await orcaRead(run, env, SEARCH_SHAPE, ["jira", "search", query, "--limit", String(LIMIT)])) as {
          result: JiraIssue[];
        }
      ).result;
      if (issues.length >= LIMIT) {
        throw new RefusedArgumentError(
          `The group has more tickets than cstack reads through Orca: the answer holds ${issues.length}, and Orca returns at most ${LIMIT}.`,
        );
      }
      if ("epic" in group && issues.length === 0) {
        throw new RefusedArgumentError(
          `The epic ${group.epic} has no child through \`parent =\`. This happens on Jira Server and Data Center, where the children hang on the Epic Link field.`,
        );
      }
      if ("milestone" in group && new Set(issues.map((i) => i.key.split("-")[0])).size > 1) {
        throw new RefusedArgumentError(
          `The milestone "${group.milestone}" returned tickets of more than one project. A Jira version belongs to one project, and the same name can exist in several.`,
        );
      }
      const states = new Map<string, StateKind>(issues.map((i) => [i.key, jiraStateKind(i.status.categoryKey)]));
      const tickets: Ticket[] = [];
      for (const issue of issues) tickets.push(await toTicket(issue, states));
      return tickets;
    },
    async moveState(): Promise<void> {
      throw new Error("Not built yet.");
    },
    async addComment(): Promise<void> {
      throw new Error("Not built yet.");
    },
  };
}
