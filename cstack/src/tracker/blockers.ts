import { isValidKey } from "./keys.js";
import type { TicketRef, TrackerName } from "./types.js";

const MARKER = "Blocked by:";

/**
 * Reads the keys after `Blocked by:` in the footer line, which is the last line
 * of the body that starts with `**Size:`. Only the part up to the next ` · ` is read.
 */
export function footerBlockers(tracker: TrackerName, body: string): string[] | "unknown" {
  const line = body.split(/\r?\n/).filter((l) => l.startsWith("**Size:")).pop();
  if (line === undefined) return "unknown";
  const start = line.indexOf(MARKER);
  if (start < 0) return "unknown";
  const part = line.slice(start + MARKER.length).split(" · ")[0].trim();
  if (part === "" || part.toLowerCase() === "none") return [];
  const keys = part.split(/[\s,]+/).filter((token) => isValidKey(tracker, token));
  return keys.length > 0 ? [...new Set(keys)] : "unknown";
}

/**
 * Merges the tracker relations with the footer keys. A footer key that the
 * relations do not carry has the state kind `unknown`.
 */
export function mergeBlockers(relations: TicketRef[] | undefined, footer: string[] | "unknown"): TicketRef[] | "unknown" {
  if (relations === undefined) {
    return footer === "unknown" ? "unknown" : footer.map((key) => ({ key, stateKind: "unknown" as const }));
  }
  const merged = [...relations];
  if (footer !== "unknown") {
    for (const key of footer) {
      if (!merged.some((r) => r.key === key)) merged.push({ key, stateKind: "unknown" });
    }
  }
  return merged;
}
