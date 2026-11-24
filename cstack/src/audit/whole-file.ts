import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FALLBACK_REASONS, type Fallback } from "../unit-test-runs.js";

/** The reason of a saved run that checked the whole test file, or undefined for any other run. */
function wholeFileReason(runDir: string, unit: number, kind: "red" | "green"): string | undefined {
  try {
    const run: unknown = JSON.parse(readFileSync(join(runDir, "units", String(unit), `${kind}.json`), "utf8"));
    if (typeof run !== "object" || run === null) return undefined;
    const { caseCheck, fallback } = run as { caseCheck?: unknown; fallback?: unknown };
    if (caseCheck !== "file" || typeof fallback !== "string" || !Object.hasOwn(FALLBACK_REASONS, fallback)) return undefined;
    return FALLBACK_REASONS[fallback as Fallback];
  } catch {
    return undefined;
  }
}

// WHY: ADR-RQG-C, section "How the audit reports the check of the whole test file". These lines carry no verdict, because the check of the whole test file is a known and allowed fallback, so it must not change the exit code.
export function wholeFileLines(runDir: string, units: number[]): string[] {
  const lines: string[] = [];
  for (const unit of units) {
    const red = wholeFileReason(runDir, unit, "red");
    const green = wholeFileReason(runDir, unit, "green");
    const head = `build: unit ${unit}: the whole test file was checked in the`;
    if (red !== undefined && green !== undefined) {
      lines.push(
        red === green
          ? `${head} red run and the green run, because ${red}`
          : `${head} red run, because ${red}, and in the green run, because ${green}`,
      );
    } else if (red !== undefined) lines.push(`${head} red run, because ${red}`);
    else if (green !== undefined) lines.push(`${head} green run, because ${green}`);
  }
  return lines;
}
