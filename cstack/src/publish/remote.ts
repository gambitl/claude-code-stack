export interface Remote {
  host: string;
  /** The port of an https URL. An SSH port is never kept, because it is not the port of the web site. */
  port?: string;
  path: string;
  ssh: boolean;
}

const stripGit = (path: string) => path.replace(/^\/+/, "").replace(/\.git\/?$/, "").replace(/\/+$/, "");

/** Reads the host and the repository path from a raw remote URL. Gives undefined when there is no host. */
export function parseRemote(url: string): Remote | undefined {
  const text = url.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    let u: URL;
    try {
      u = new URL(text);
    } catch {
      return undefined;
    }
    if (!u.hostname || u.hostname.startsWith("-")) return undefined;
    const ssh = u.protocol === "ssh:";
    return { host: u.hostname, port: ssh || !u.port ? undefined : u.port, path: stripGit(decodeURIComponent(u.pathname)), ssh };
  }
  const short = /^[^@/:\s]+@([^:/\s]+):(.+)$/.exec(text);
  return short && !short[1].startsWith("-") ? { host: short[1], path: stripGit(short[2]), ssh: true } : undefined;
}

/** Removes the user information, everything between `://` and `@`, from every URL in a text. */
export const redact = (text: string): string => text.replace(/(:\/\/)[^\s/]*@/g, "$1");
