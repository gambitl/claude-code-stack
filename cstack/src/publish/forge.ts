import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PublishFailure } from "./branch.js";
import { runProgram, type ProgramResult } from "./program.js";
import { parseRemote, redact } from "./remote.js";

export type ForgeKind = "github" | "gitlab";

export type ForgeFound =
  | {
      ok: true;
      kind: ForgeKind;
      host: string;
      /** The value for `--repo` of `gh` (`<host>/<path>`) or for `-R` of `glab` (`https://<host>/<path>`). */
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
      repoArg: kind === "github" ? `${host}/${remote.path}` : `https://${host}/${remote.path}`,
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
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): string | undefined {
  const r = runProgram(
    "gh",
    ["pr", "list", "--repo", forge.repoArg, "--head", branch, "--state", "open", "--json", "url,headRefOid,isCrossRepository"],
    options,
  );
  if (!r.ok) throw new PublishFailure(`gh pr list failed: ${redact(r.stderr.trim())}`, 5);
  let list: { url: string; isCrossRepository: boolean }[];
  try {
    list = JSON.parse(r.stdout);
  } catch {
    throw new PublishFailure("gh pr list did not give JSON.", 5);
  }
  return list.find((p) => p.isCrossRepository === false)?.url;
}

/** Creates the pull request. The title is passed as `--title=<title>`, so that a title that starts with a dash stays a value. */
export function createGithubPullRequest(
  forge: { repoArg: string },
  input: { branch: string; target: string; title: string; body: string },
  options: { cwd: string; env?: NodeJS.ProcessEnv },
): string {
  const folder = mkdtempSync(join(tmpdir(), "cstack-pr-"));
  try {
    const bodyFile = join(folder, "body.md");
    writeFileSync(bodyFile, input.body);
    const r = runProgram(
      "gh",
      ["pr", "create", "--repo", forge.repoArg, "--base", input.target, "--head", input.branch, `--title=${input.title}`, "--body-file", bodyFile],
      options,
    );
    if (!r.ok) throw new PublishFailure(`gh pr create failed: ${redact(r.stderr.trim())}`, 5);
    const link = r.stdout.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("http")).pop();
    if (!link) throw new PublishFailure("gh pr create gave no link.", 5);
    return link;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

export interface CheckState {
  name: string;
  link: string;
  /** `pass`, `fail`, `pending` and so on, as `gh pr checks` gives it. */
  bucket: string;
}

/** The commit that the pull request shows as its head. */
export function readGithubHead(forge: { repoArg: string }, url: string, options: { cwd: string; env?: NodeJS.ProcessEnv }): string {
  const r = runProgram("gh", ["pr", "view", url, "--repo", forge.repoArg, "--json", "headRefOid"], options);
  if (!r.ok) throw new PublishFailure(`gh pr view failed: ${redact(r.stderr.trim())}`, 5);
  try {
    return String(JSON.parse(r.stdout).headRefOid);
  } catch {
    throw new PublishFailure("gh pr view did not give JSON.", 5);
  }
}

/**
 * The checks of the pull request, judged by standard output and not by the exit code,
 * because `gh pr checks` exits with 8 while a check is pending. An empty list means no check yet.
 */
export function readGithubChecks(forge: { repoArg: string }, url: string, options: { cwd: string; env?: NodeJS.ProcessEnv }): CheckState[] {
  const r = runProgram("gh", ["pr", "checks", url, "--repo", forge.repoArg, "--json", "name,state,bucket,link"], options);
  let list: unknown;
  try {
    list = JSON.parse(r.stdout);
  } catch {
    if (/no checks reported/i.test(r.stderr)) return [];
    throw new PublishFailure(`gh pr checks failed: ${redact(r.stderr.trim())}`, 5);
  }
  if (!Array.isArray(list)) throw new PublishFailure("gh pr checks did not give a list.", 5);
  return list.map((c) => ({ name: String(c.name), link: String(c.link ?? ""), bucket: String(c.bucket) }));
}
