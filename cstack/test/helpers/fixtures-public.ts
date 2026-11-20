const RESERVED = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;
const ALLOWED_HOSTS = new Set(["github.com", "gitlab.com"]);

function reserved(host: string): boolean {
  return RESERVED.test(host) || ALLOWED_HOSTS.has(host.toLowerCase());
}

const RESERVED_NAMES = new Set(["user", "someone", "runner"]);

/** Lists the paths under /Users/ or /home/ whose name is not a reserved sample name. */
export function findHomePaths(text: string): string[] {
  const found: string[] = [];
  const rule = /\/(?:Users|home)\/([A-Za-z0-9_](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?)(?:\/[^\s"'<>]*)?/g;
  for (const m of text.matchAll(rule)) {
    if (!RESERVED_NAMES.has(m[1])) found.push(m[0]);
  }
  return found;
}

/** Lists what a fixture text holds that must not be public. */
export function findPrivateText(text: string): string[] {
  const found: string[] = [];
  for (const path of findHomePaths(text)) found.push(`home path ${path}`);
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) {
    if (!RESERVED.test(m[1])) found.push(`email ${m[0]}`);
  }
  for (const m of text.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
    if (!reserved(m[1])) found.push(`host ${m[1]}`);
  }
  return found;
}
