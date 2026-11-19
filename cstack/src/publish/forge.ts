import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PublishFailure } from "./branch.js";
import { runProgram, type ProgramOptions, type ProgramResult } from "./program.js";
import { parseRemote, redact } from "./remote.js";

export type ForgeKind = "github" | "gitlab";

export type ForgeFound =
  | {
      ok: true;
      kind: ForgeKind;
      host: string;
      /** The value for `--repo` of `gh` (`<host>/<path>`) or for `-R` of `glab` (`https://<host>[:<port>]/<path>`). */
      repoArg: string;
    }
  | { ok: false; reasons: string[] };

type Client = "gh" | "glab";

function loggedIn(client: Client, host: string, root: string, env?: NodeJS.ProcessEnv): string | undefined {
  const r: ProgramResult = runProgram(client, ["auth", "status", "--hostname", host], { cwd: root, env });
  if (r.ok) return undefined;
  if (r.missing) return `${client} is not installed`;
  return `${client} is not logged in for ${host}`;
}

/** Parses JSON, and gives undefined when the text is not JSON. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Runs a client that creates a request with a body file in a fresh temporary folder, and gives the last link it prints. */
function createRequest(client: Client, what: string, args: (bodyFile: string) => string[], body: string, options: ProgramOptions): string {
  const folder = mkdtempSync(join(tmpdir(), "cstack-request-"));
  try {
    const bodyFile = join(folder, "body.md");
    writeFileSync(bodyFile, body);
    const r = runProgram(client, args(bodyFile), options);
    if (!r.ok) throw new PublishFailure(`${client} ${what} failed: ${redact(r.stderr.trim())}`, 5);
    const link = r.stdout.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("http")).pop();
    if (!link) throw new PublishFailure(`${client} ${what} gave no link.`, 5);
    return link;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Finds the forge of `origin` and a client that is logged in for its host. */
export function detectForge(root: string, env?: NodeJS.ProcessEnv): ForgeFound {
  const url = runProgram("git", ["config", "--get", "remote.origin.url"], { cwd: root, env }).stdout.trim();
  const remote = url === "" ? undefined : parseRemote(url);
  if (!remote) {
    return {
      ok: false,
      reasons: [`The remote origin (${url === "" ? "not set" : redact(url)}) has no host, so cstack cannot find a forge.`],
    };
  }

  const reasons: string[] = [];
  const tryHost = (host: string): ForgeFound | undefined => {
    const found = (kind: ForgeKind): ForgeFound => ({
      ok: true,
      kind,
      host,
      repoArg: kind === "github" ? `${host}/${remote.path}` : `https://${host}${remote.port ? `:${remote.port}` : ""}/${remote.path}`,
    });
    const gh = loggedIn("gh", host, root, env);
    if (gh === undefined) return found("github");
    reasons.push(gh);
    if (host === "github.com") return undefined;
    const glab = loggedIn("glab", host, root, env);
    if (glab === undefined) return found("gitlab");
    reasons.push(glab);
    return undefined;
  };

  const first = tryHost(remote.host);
  if (first) return first;
  if (remote.ssh) {
    // An SSH alias in ~/.ssh/config can hide the real host name.
    const g = runProgram("ssh", ["-G", remote.host], { cwd: root, env });
    const real = /^hostname\s+(\S+)/im.exec(g.stdout)?.[1];
    if (g.ok && real && real !== remote.host) {
      const second = tryHost(real);
      if (second) return second;
    }
  }
  return {
    ok: false,
    reasons: [`No forge client is logged in for ${remote.host}.`, ...reasons.map((r) => `${r}.`)].map(redact),
  };
}

/** The open pull request of the branch in this repository, never one from a fork. */
export function findGithubPullRequest(
  forge: { repoArg: string },
  branch: string,
  options: ProgramOptions,
): string | undefined {
  const r = runProgram(
    "gh",
    ["pr", "list", "--repo", forge.repoArg, "--head", branch, "--state", "open", "--json", "url,headRefOid,isCrossRepository"],
    options,
  );
  if (!r.ok) throw new PublishFailure(`gh pr list failed: ${redact(r.stderr.trim())}`, 5);
  const list = parseJson(r.stdout) as { url: string; isCrossRepository: boolean }[] | undefined;
  if (list === undefined) throw new PublishFailure("gh pr list did not give JSON.", 5);
  return list.find((p) => p.isCrossRepository === false)?.url;
}

/** Creates the pull request. The title is passed as `--title=<title>`, so that a title that starts with a dash stays a value. */
export function createGithubPullRequest(
  forge: { repoArg: string },
  input: { branch: string; target: string; title: string; body: string },
  options: ProgramOptions,
): string {
  return createRequest(
    "gh",
    "pr create",
    (bodyFile) => ["pr", "create", "--repo", forge.repoArg, "--base", input.target, "--head", input.branch, `--title=${input.title}`, "--body-file", bodyFile],
    input.body,
    options,
  );
}

export interface CheckState {
  name: string;
  link: string;
  /** `pass`, `fail`, `pending` and so on, as `gh pr checks` gives it. */
  bucket: string;
}

/** The commit that the pull request shows as its head. */
export function readGithubHead(forge: { repoArg: string }, url: string, options: ProgramOptions): string {
  const r = runProgram("gh", ["pr", "view", url, "--repo", forge.repoArg, "--json", "headRefOid"], options);
  if (!r.ok) throw new PublishFailure(`gh pr view failed: ${redact(r.stderr.trim())}`, 5);
  const data = parseJson(r.stdout) as { headRefOid?: unknown } | undefined;
  if (data === undefined) throw new PublishFailure("gh pr view did not give JSON.", 5);
  return String(data.headRefOid);
}

/**
 * The checks of the pull request, judged by standard output and not by the exit code,
 * because `gh pr checks` exits with 8 while a check is pending. An empty list means no check yet.
 */
export function readGithubChecks(forge: { repoArg: string }, url: string, options: ProgramOptions): CheckState[] {
  const r = runProgram("gh", ["pr", "checks", url, "--repo", forge.repoArg, "--json", "name,state,bucket,link"], options);
  const list = parseJson(r.stdout);
  if (list === undefined) {
    if (/no checks reported/i.test(r.stderr)) return [];
    throw new PublishFailure(`gh pr checks failed: ${redact(r.stderr.trim())}`, 5);
  }
  if (!Array.isArray(list)) throw new PublishFailure("gh pr checks did not give a list.", 5);
  return list.map((c) => ({ name: String(c.name), link: String(c.link ?? ""), bucket: String(c.bucket) }));
}

/** The open merge request of the branch in this project, never one from a fork. */
export function findGitlabMergeRequest(forge: { repoArg: string }, branch: string, options: ProgramOptions): string | undefined {
  const r = runProgram("glab", ["mr", "list", "-R", forge.repoArg, "--source-branch", branch, "--output", "json"], options);
  if (!r.ok) throw new PublishFailure(`glab mr list failed: ${redact(r.stderr.trim())}`, 5);
  const list = parseJson(r.stdout) as { web_url: string; source_project_id: number; target_project_id: number }[] | undefined;
  if (list === undefined) throw new PublishFailure("glab mr list did not give JSON.", 5);
  return list.find((m) => m.source_project_id === m.target_project_id)?.web_url;
}

/** Creates the merge request. The title is passed as `--title=<title>`, so that a title that starts with a dash stays a value. */
export function createGitlabMergeRequest(
  forge: { repoArg: string },
  input: { branch: string; target: string; title: string; body: string },
  options: ProgramOptions,
): string {
  return createRequest(
    "glab",
    "mr create",
    (bodyFile) => [
      "mr", "create", "-R", forge.repoArg,
      "--source-branch", input.branch, "--target-branch", input.target,
      `--title=${input.title}`, "--description-file", bodyFile, "--yes",
    ],
    input.body,
    options,
  );
}

/** The number of a merge request, read from its link. */
export function gitlabIid(link: string): string {
  const iid = /\/-\/merge_requests\/(\d+)/.exec(link)?.[1];
  if (!iid) throw new PublishFailure(`The link of the merge request has no number: ${redact(link)}`, 5);
  return iid;
}

/**
 * The pipeline of the merge request as a list of checks, using the buckets of GitHub.
 * A pipeline of another commit, or no pipeline, gives an empty list. A failed pipeline lists its failed jobs.
 */
export function readGitlabChecks(forge: { repoArg: string }, iid: string, pushed: string, options: ProgramOptions): CheckState[] {
  const r = runProgram("glab", ["ci", "get", "-R", forge.repoArg, "--merge-request", iid, "--output", "json"], options);
  const data = parseJson(r.stdout) as
    | { sha?: string; status?: string; web_url?: string; jobs?: { name: string; status: string }[] }
    | undefined;
  if (data === undefined) {
    if (/no pipeline/i.test(r.stderr)) return [];
    throw new PublishFailure(`glab ci get failed: ${redact(r.stderr.trim())}`, 5);
  }
  if (data.sha !== pushed) return [];
  const link = data.web_url ?? "";
  switch (data.status) {
    case "success":
    case "skipped":
      return [{ name: "pipeline", link, bucket: "pass" }];
    case "failed":
    case "canceled": {
      const jobs = (data.jobs ?? []).filter((j) => j.status === "failed" || j.status === "canceled");
      return (jobs.length > 0 ? jobs.map((j) => j.name) : ["pipeline"]).map((name) => ({ name, link, bucket: "fail" }));
    }
    default:
      return [{ name: "pipeline", link, bucket: "pending" }];
  }
}
