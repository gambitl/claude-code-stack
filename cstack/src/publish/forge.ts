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
