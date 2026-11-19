import type { Runner } from "../orca/run.js";
import { EXIT } from "../manifest.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { footerBlockers, mergeBlockers } from "./blockers.js";
import { RefusedArgumentError, TrackerError } from "./errors.js";
import { MAX_GROUP, forgeFailure, forgeStateName, originRepo, settleBlockers } from "./forge.js";
import { checkStateName, forgeStateKind } from "./states.js";
import type { Group, StateKind, Ticket, TicketRef, Tracker } from "./types.js";

const FIELDS = "number,title,body,url,state,stateReason,labels,blockedBy";
const STATE_FIELDS = "number,state,labels";

const TOO_MANY = `The group has more tickets than cstack reads (the limit is ${MAX_GROUP}).`;

type Json = Record<string, unknown>;

const shapeError = (what: string) => new TrackerError(`gh gave an answer of an unexpected shape for ${what}.`, EXIT.toolFailed);
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const labelNames = (issue: Json): string[] =>
  (Array.isArray(issue.labels) ? issue.labels : []).flatMap((l) => (isObject(l) && typeof l.name === "string" ? [l.name] : []));

/** Reads tickets and groups of the `origin` repository on GitHub through `gh`. Moves a ticket with labels and adds comments. */
export function githubGhTracker(run: Runner, root: string, warn: (message: string) => void = (m) => void process.stderr.write(`${m}\n`)): Tracker {
  let context: Promise<{ repo: string; path: string; urlPrefix: string }> | undefined;
  const where = () =>
    (context ??= originRepo(run, root).then((r) => ({
      repo: `${r.host}/${r.path}`,
      path: r.path,
      urlPrefix: `https://${r.host}${r.port ? `:${r.port}` : ""}/${r.path}/issues/`.toLowerCase(),
    })));

  async function gh(args: string[]): Promise<unknown> {
    const result = await run("gh", args, root);
    if (result.kind !== "ok") throw forgeFailure("gh", result, false);
    try {
      return JSON.parse(result.stdout);
    } catch {
      throw shapeError(`gh ${args[0]} ${args[1]}`);
    }
  }

  /** The number in the URL of an issue of this repository, or undefined for another repository. */
  const localNumber = (url: unknown, urlPrefix: string): number | undefined => {
    if (typeof url !== "string" || !url.toLowerCase().startsWith(urlPrefix)) return undefined;
    const rest = url.slice(urlPrefix.length);
    return /^[1-9][0-9]*$/.test(rest) ? Number(rest) : undefined;
  };

  function toTicket(issue: unknown, urlPrefix: string): Ticket {
    if (!isObject(issue) || !Number.isInteger(issue.number) || typeof issue.title !== "string" || typeof issue.url !== "string" || typeof issue.state !== "string") {
      throw shapeError("an issue");
    }
    const key = `#${issue.number}`;
    const body = typeof issue.body === "string" ? issue.body : "";
    const open = issue.state.toUpperCase() === "OPEN";
    const labels = labelNames(issue);
    return {
      key,
      title: issue.title,
      body,
      url: issue.url,
      stateName: forgeStateName("github", { open, labels }),
      stateKind: forgeStateKind({ open, labels }),
      blockers: blockersOf(issue, key, body, urlPrefix),
    };
  }

  function blockersOf(issue: Json, key: string, body: string, urlPrefix: string): TicketRef[] | "unknown" {
    const blocked = isObject(issue.blockedBy) ? issue.blockedBy : { nodes: [], totalCount: 0 };
    const nodes = Array.isArray(blocked.nodes) ? blocked.nodes : [];
    if (nodes.length < Number(blocked.totalCount ?? 0)) {
      warn(`cstack: gh gave ${nodes.length} of ${String(blocked.totalCount)} blockers of ${key}, so its blockers are unknown.`);
      return "unknown";
    }
    const relations: TicketRef[] = [];
    let foreignOpen = false;
    for (const node of nodes) {
      if (!isObject(node)) throw shapeError("a blocker");
      const closed = String(node.state).toUpperCase() !== "OPEN";
      const number = localNumber(node.url, urlPrefix);
      if (number === undefined) {
        if (!closed) {
          foreignOpen = true;
          warn(`cstack: ${key} is blocked by an open issue in another repository, ${String(node.url)}, so its blockers are unknown.`);
        }
        continue;
      }
      relations.push({ key: `#${number}`, stateKind: closed ? "finished" : "unknown" });
    }
    return foreignOpen ? "unknown" : mergeBlockers(relations, footerBlockers("github", body));
  }

  async function settle(tickets: Ticket[], repo: string): Promise<Ticket[]> {
    const lookup = async (key: string): Promise<StateKind> => {
      const issue = await gh(["issue", "view", key.slice(1), "--repo", repo, "--json", STATE_FIELDS]);
      if (!isObject(issue) || typeof issue.state !== "string") throw shapeError(`issue ${key}`);
      return forgeStateKind({ open: issue.state.toUpperCase() === "OPEN", labels: labelNames(issue) });
    };
    return settleBlockers(tickets, lookup, warn);
  }

  return {
    async readTicket(key) {
      const { repo, urlPrefix } = await where();
      const issue = await gh(["issue", "view", key.slice(1), "--repo", repo, "--json", FIELDS]);
      return (await settle([toTicket(issue, urlPrefix)], repo))[0];
    },

    async listGroup(group: Group) {
      const { repo, path, urlPrefix } = await where();
      const list = async (extra: string[]): Promise<unknown[]> => {
        const issues = await gh(["issue", "list", "--repo", repo, ...extra, "--state", "all", "--limit", String(MAX_GROUP), "--json", FIELDS]);
        if (!Array.isArray(issues)) throw shapeError("a list");
        if (issues.length >= MAX_GROUP) throw new RefusedArgumentError(TOO_MANY);
        return issues;
      };

      if ("milestone" in group) {
        const issues = await list(["--milestone", group.milestone]);
        return settle(issues.map((i) => toTicket(i, urlPrefix)), repo);
      }

      const epic = group.epic.slice(1);
      const subs = await gh(["issue", "view", epic, "--repo", repo, "--json", "subIssues"]);
      const sub = isObject(subs) && isObject(subs.subIssues) ? subs.subIssues : undefined;
      if (!sub || !Array.isArray(sub.nodes)) throw shapeError("the sub-issues");
      if (sub.nodes.length !== sub.totalCount) {
        throw new RefusedArgumentError(`gh gave ${sub.nodes.length} of ${String(sub.totalCount)} sub-issues of ${group.epic}, so cstack cannot list the epic.`);
      }
      const numbers: number[] = [];
      for (const node of sub.nodes) {
        const number = isObject(node) ? localNumber(node.url, urlPrefix) : undefined;
        if (number === undefined) warn(`cstack: skipped the sub-issue ${isObject(node) ? String(node.url) : "?"} of ${group.epic}, because it is in another repository.`);
        else numbers.push(number);
      }
      if (numbers.length === 0) return [];
      const found = new Map<number, Ticket>();
      for (const issue of await list(["--search", `parent-issue:${path}#${epic}`])) {
        const ticket = toTicket(issue, urlPrefix);
        found.set(Number(ticket.key.slice(1)), ticket);
      }
      const tickets: Ticket[] = [];
      for (const number of numbers) {
        let ticket = found.get(number);
        if (!ticket) ticket = toTicket(await gh(["issue", "view", String(number), "--repo", repo, "--json", FIELDS]), urlPrefix);
        tickets.push(ticket);
      }
      return settle(tickets, repo);
    },

    async moveState(key, stateName) {
      checkStateName("github", stateName);
      const [add, remove] = stateName === "in progress" ? ["in progress", "in review"] : ["in review", "in progress"];
      const { repo } = await where();
      const result = await run("gh", ["issue", "edit", key.slice(1), "--repo", repo, "--add-label", add, "--remove-label", remove], root);
      if (result.kind === "ok") return;
      const missing = result.kind === "failed" && result.exitCode === 1 ? /'([^']+)' not found/.exec(result.stderr ?? "")?.[1] : undefined;
      if (missing) {
        throw new RefusedArgumentError(
          `The label "${missing}" does not exist in ${repo}. cstack never creates a label. Run this command, then move the ticket again: gh label create "${missing}" --repo ${repo}`,
        );
      }
      throw forgeFailure("gh", result, true);
    },

    async addComment(key, bodyFile) {
      const path = resolve(bodyFile);
      try {
        readFileSync(path);
      } catch {
        throw new RefusedArgumentError(`cstack cannot read the comment file ${path}.`);
      }
      const { repo } = await where();
      const result = await run("gh", ["issue", "comment", key.slice(1), "--repo", repo, "--body-file", path], root);
      if (result.kind !== "ok") throw forgeFailure("gh", result, true);
    },
  };
}
