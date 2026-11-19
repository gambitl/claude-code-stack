import type { Runner } from "../orca/run.js";
import { redact, type Remote } from "../publish/remote.js";
import { EXIT } from "../manifest.js";
import { footerBlockers, mergeBlockers } from "./blockers.js";
import { RefusedArgumentError, TrackerError } from "./errors.js";
import { MAX_GROUP, forgeFailure, forgeStateName, originRepo, settleBlockers } from "./forge.js";
import { forgeStateKind } from "./states.js";
import type { Group, StateKind, Ticket, TicketRef, Tracker } from "./types.js";

const PAGE_SIZE = 100;

/** The fields of a GitLab issue that cstack reads. */
interface GlabIssue {
  iid: number;
  title: string;
  description: string | null;
  state: string;
  labels: string[];
  web_url: string;
  link_type?: string;
  references?: { full?: string };
}

const isOpen = (issue: GlabIssue): boolean => issue.state === "opened";
const kindOf = (issue: GlabIssue): StateKind => forgeStateKind({ open: isOpen(issue), labels: issue.labels ?? [] });

/**
 * Reads GitLab issues through `glab`. Every call names the project of `origin`, so a clone
 * with several remotes stays on that project.
 * WHY: ADR-SIC-F. cstack holds no credential, and every call goes through the runner.
 */
export function gitlabGlabTracker(run: Runner, root: string, warn: (message: string) => void = () => {}): Tracker {
  const target = async (): Promise<{ remote: Remote; repo: string; host: string; api: string }> => {
    const remote = await originRepo(run, root);
    const host = remote.port ? `${remote.host}:${remote.port}` : remote.host;
    return { remote, host, repo: `https://${host}/${remote.path}`, api: `projects/${encodeURIComponent(remote.path)}` };
  };

  /** Runs glab from the repository root and parses its JSON answer. A failure of a read gives exit 5, or 4 for a 401. */
  const json = async <T>(args: string[]): Promise<T> => {
    const result = await run("glab", args, root);
    if (result.kind !== "ok") throw forgeFailure("glab", result, false);
    try {
      return JSON.parse(result.stdout) as T;
    } catch {
      throw new TrackerError("glab gave an answer that is not JSON.", EXIT.toolFailed);
    }
  };

  const viewIssue = (t: { repo: string }, iid: string | number): Promise<GlabIssue> =>
    json<GlabIssue>(["issue", "view", String(iid), "-R", t.repo, "--output", "json"]);

  /** The blockers that the issue links give. `unknown` when an open blocker lives in another project. */
  const linkBlockers = async (t: Awaited<ReturnType<typeof target>>, iid: number): Promise<TicketRef[] | "unknown"> => {
    const found = await json<GlabIssue[]>(["api", "--hostname", t.host, `${t.api}/issues/${iid}/links`]);
    const refs: TicketRef[] = [];
    let unknown = false;
    for (const l of found) {
      if (l.link_type !== "is_blocked_by") continue;
      const sameProject = l.references?.full?.startsWith(`${t.remote.path}#`) ?? false;
      if (!sameProject) {
        if (isOpen(l)) {
          unknown = true;
          warn(`cstack: the issue #${iid} is blocked by ${redact(l.web_url)}, which is in another project. cstack does not read it, so the blockers are unknown.`);
        }
        continue;
      }
      refs.push({ key: `#${l.iid}`, stateKind: kindOf(l) });
    }
    return unknown ? "unknown" : refs;
  };

  const toTicket = (issue: GlabIssue, blockers: TicketRef[] | "unknown" | undefined): Ticket => {
    const body = issue.description ?? "";
    const footer = footerBlockers("gitlab", body);
    return {
      key: `#${issue.iid}`,
      title: issue.title,
      body,
      url: issue.web_url,
      stateName: forgeStateName("gitlab", { open: isOpen(issue), labels: issue.labels ?? [] }),
      stateKind: kindOf(issue),
      blockers: blockers === "unknown" ? "unknown" : mergeBlockers(blockers, footer),
    };
  };

  const settle = (t: Awaited<ReturnType<typeof target>>, tickets: Ticket[]): Promise<Ticket[]> =>
    settleBlockers(tickets, async (key) => kindOf(await viewIssue(t, key.slice(1))), warn);

  return {
    async readTicket(key) {
      const t = await target();
      const issue = await viewIssue(t, key.slice(1));
      const blockers = await linkBlockers(t, issue.iid);
      return (await settle(t, [toTicket(issue, blockers)]))[0];
    },

    async listGroup(group: Group) {
      if (!("milestone" in group)) {
        throw new RefusedArgumentError("GitLab has no epic list here. Use --milestone to list a group of tickets on GitLab.");
      }
      const t = await target();
      const issues: GlabIssue[] = [];
      for (let page = 1; ; page++) {
        const batch = await json<GlabIssue[]>([
          "issue", "list", "--milestone", group.milestone, "-R", t.repo, "--output", "json", "--per-page", String(PAGE_SIZE), "--page", String(page),
        ]);
        issues.push(...batch);
        if (issues.length >= MAX_GROUP) {
          throw new RefusedArgumentError(`This group has more tickets than cstack reads. cstack reads at most ${MAX_GROUP} tickets of a group.`);
        }
        if (batch.length < PAGE_SIZE) break;
      }
      // A closed issue keeps the blockers of its footer, because the ready rule leaves it out before it looks at blockers.
      const tickets = await Promise.all(
        issues.map(async (issue) => toTicket(issue, isOpen(issue) ? await linkBlockers(t, issue.iid) : undefined)),
      );
      return settle(t, tickets);
    },

    async moveState() {
      throw new TrackerError("cstack cannot move GitLab issues yet.", EXIT.refused);
    },

    async addComment() {
      throw new TrackerError("cstack cannot comment on GitLab issues yet.", EXIT.refused);
    },
  };
}
