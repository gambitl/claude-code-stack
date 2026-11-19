export interface Remote {
  host: string;
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
    if (!u.hostname) return undefined;
    return { host: u.hostname, path: stripGit(decodeURIComponent(u.pathname)), ssh: u.protocol === "ssh:" };
  }
  const short = /^[^@/:\s]+@([^:/\s]+):(.+)$/.exec(text);
  return short ? { host: short[1], path: stripGit(short[2]), ssh: true } : undefined;
}

/** Removes the user information, everything between `://` and `@`, from every URL in a text. */
export const redact = (text: string): string => text.replace(/(:\/\/)[^\s/]*@/g, "$1");
