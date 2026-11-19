import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { callOrca } from "../orca/call.js";
import type { Runner, RunResult } from "../orca/run.js";
import { checkShape, ShapeError } from "../orca/shapes.js";
import type { TrackerName } from "../tracker/types.js";
import { EXIT } from "../manifest.js";
import { WaveError } from "./errors.js";
import { runTicketId, shortName } from "./names.js";
import { mentionsLaunch, orcaErrorMessage } from "./orca-error.js";
import { printableText } from "./title.js";

export interface WorktreeEntry {
  path: string;
  /** The branch without refs/heads/. Empty when the worktree has none. */
  branch: string;
  bare: boolean;
}

export type WorktreeAnswer = { found: false } | { found: true; reason: string };

export interface WorktreeCheck {
  check(ticket: { key: string; url: string }): Promise<WorktreeAnswer>;
}

/** One entry per block of `git worktree list --porcelain`. */
export function parseWorktreeList(text: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const entry: WorktreeEntry = { path: "", branch: "", bare: false };
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) entry.path = line.slice("worktree ".length);
      else if (line.startsWith("branch ")) entry.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
      else if (line === "bare") entry.bare = true;
    }
    if (entry.path !== "") entries.push(entry);
  }
  return entries;
}

const FIND_COMMAND = "orca reference find --json";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when `word` stands alone in `text`: no letter or digit on either side, any case. */
function hasWord(text: string, word: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escape(word)}($|[^a-z0-9])`, "i").test(text);
}

function failed(what: string, result: RunResult): never {
  const why = result.kind === "failed" ? `exit code ${result.exitCode}` : result.kind;
  throw new WaveError(`${what} failed (${why}).`, EXIT.toolFailed);
}

async function git(run: Runner, root: string, args: string[]): Promise<string> {
  const result = await run("git", args, root);
  if (result.kind !== "ok") return failed(`\`git ${args.join(" ")}\``, result);
  return result.stdout;
}

function runFolders(common: string): string[] {
  try {
    return readdirSync(join(common, "cstack", "runs"));
  } catch {
    return [];
  }
}

/** Reads the git list and the run folders once. `check` then answers per ticket. */
export async function loadWorktreeCheck(options: {
  run: Runner;
  env: Record<string, string | undefined>;
  root: string;
  tracker: TrackerName;
  orca: boolean;
}): Promise<WorktreeCheck> {
  const { run, env, root, tracker, orca } = options;
  const entries = parseWorktreeList(await git(run, root, ["worktree", "list", "--porcelain"])).filter((e) => !e.bare);
  const common = (await git(run, root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim();
  const folders = runFolders(common);

  async function viaOrca(key: string, url: string): Promise<WorktreeAnswer> {
    const fail = (message: string): never => {
      throw new WaveError(`${printableText(key)}: ${message}`, EXIT.toolFailed);
    };
    const result = await callOrca(run, env, ["reference", "find", url]);
    if (result.kind === "failed") {
      const message = orcaErrorMessage(result.stdout);
      if (message !== undefined) {
        const hint = mentionsLaunch(message) ? " Check Orca before running the wave again." : "";
        return fail(`Orca refused \`orca reference find\`: ${message}.${hint}`);
      }
    }
    if (result.kind !== "ok") {
      try {
        return failed("`orca reference find`", result);
      } catch (error) {
        if (error instanceof WaveError) return fail(error.message);
        throw error;
      }
    }
    let answer: unknown;
    try {
      answer = JSON.parse(result.stdout);
    } catch {
      return fail("`orca reference find` did not answer with JSON.");
    }
    try {
      checkShape(FIND_COMMAND, answer, "unknown", "read");
    } catch (error) {
      if (error instanceof ShapeError) return fail(printableText(error.message));
      throw error;
    }
    const body = answer as { ok: boolean; result?: { matches: { workspace: { id: string; name: string; kind: string; archived: boolean } }[] } };
    if (!body.ok) return fail("`orca reference find` answered ok: false.");
    for (const { workspace } of body.result!.matches) {
      if (workspace.archived) continue;
      const at = workspace.id.indexOf("::");
      const reason = workspace.kind === "worktree" && at >= 0 ? workspace.id.slice(at + 2) : workspace.name;
      return { found: true, reason: printableText(reason) };
    }
    return { found: false };
  }

  return {
    async check(ticket) {
      const short = shortName(tracker, ticket.key);
      const words = [ticket.key, short];
      for (const entry of entries) {
        const folder = basename(entry.path).toLowerCase();
        if (folder === short || words.some((w) => hasWord(entry.branch, w))) {
          return { found: true, reason: printableText(entry.path) };
        }
      }
      const prefix = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escape(runTicketId(tracker, ticket.key))}-`, "i");
      const folder = folders.find((f) => prefix.test(f));
      if (folder !== undefined) {
        return { found: true, reason: `a resolve-issue run exists in ${printableText(join(common, "cstack", "runs", folder))}` };
      }
      return orca ? viaOrca(ticket.key, ticket.url) : { found: false };
    },
  };
}
