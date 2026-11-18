import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RunStateError, type SavedTestRun } from "./run-state.js";

/**
 * Reads `units/<n>/red.json` or `units/<n>/green.json` of a run folder.
 * It returns undefined when the file does not exist. A file that cannot be read,
 * is not valid JSON or has no valid `time` raises a RunStateError (exit code 3).
 */
export function readSavedRun(runDir: string, unit: number, kind: "red" | "green"): SavedTestRun | undefined {
  const path = join(runDir, "units", String(unit), `${kind}.json`);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new RunStateError(`The saved test run ${path} cannot be read.`);
  }
  let data: Partial<SavedTestRun> | null;
  try {
    data = JSON.parse(text) as Partial<SavedTestRun> | null;
  } catch {
    throw new RunStateError(`The saved test run ${path} is not valid JSON.`);
  }
  if (!data || typeof data.time !== "string" || Number.isNaN(Date.parse(data.time))) {
    throw new RunStateError(`The saved test run ${path} has no valid time.`);
  }
  return data as SavedTestRun;
}
