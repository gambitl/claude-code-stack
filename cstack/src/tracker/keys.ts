import type { Remote } from "../publish/remote.js";
import type { TrackerName } from "./types.js";

const MAX_KEY_LENGTH = 32;
const BOARD_KEY = /^[A-Z][A-Z0-9_]+-[1-9][0-9]*$/;
const FORGE_KEY = /^#[1-9][0-9]*$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const URL_FORBIDDEN = /[\s"'\u0000-\u001f\u007f]/;

/** True when the key matches the pattern of its tracker and is short enough. */
export function isValidKey(tracker: TrackerName, key: string): boolean {
  if (typeof key !== "string" || key.length > MAX_KEY_LENGTH) return false;
  return (tracker === "jira" || tracker === "linear" ? BOARD_KEY : FORGE_KEY).test(key);
}

/** True for an https URL without spaces, quotes or control characters. */
export function isValidUrl(url: string): boolean {
  return typeof url === "string" && url.startsWith("https://") && url.length > 8 && !URL_FORBIDDEN.test(url);
}

/** True for a value that is safe as one argument: not empty, no leading dash, no control character. */
export function isSafeArgument(value: string): boolean {
  return typeof value === "string" && value !== "" && !value.startsWith("-") && !CONTROL.test(value);
}

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const NUMBER = /^[1-9][0-9]*$/;

/** True when the value starts with a scheme and `://`, such as `https://`. */
export function looksLikeLink(value: string): boolean {
  return SCHEME.test(value);
}

/** `#12` for the bare number `12`, else undefined. */
export function keyOfNumber(value: string): string | undefined {
  return NUMBER.test(value) ? `#${value}` : undefined;
}

/** `#12` for the https link of issue 12 of the origin project, else undefined. */
export function keyOfLink(tracker: "github" | "gitlab", link: string, origin: Remote): string | undefined {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.username || url.password) return undefined;
  if (url.hostname.toLowerCase() !== origin.host.toLowerCase() || url.port !== (origin.port ?? "")) return undefined;
  const path = url.pathname.replace(/\/$/, "").toLowerCase();
  const base = `/${origin.path}`.toLowerCase();
  const kinds = tracker === "github" ? ["issues"] : ["-/issues", "-/work_items"];
  for (const kind of kinds) {
    const prefix = `${base}/${kind}/`;
    if (path.startsWith(prefix) && NUMBER.test(path.slice(prefix.length))) return `#${path.slice(prefix.length)}`;
  }
  return undefined;
}

/** The sentence of a key refusal that tells which forms of a key the tracker accepts. */
export function keyForms(tracker: TrackerName): string {
  return tracker === "jira" || tracker === "linear"
    ? "Write it as 'ABC-12'."
    : "Write it as '#12', as 12, or as the link of an issue of this project.";
}
