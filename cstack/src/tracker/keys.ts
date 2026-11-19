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
