import type { RunResult } from "./run.js";

/** Turns the output of an Orca command into a JSON object. Returns nothing when there is no output or it is not a JSON object. */
export function parseAnswer<T extends object = Record<string, unknown>>(result: RunResult): T | undefined {
  const text = result.kind === "ok" || result.kind === "failed" ? result.stdout : undefined;
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}
