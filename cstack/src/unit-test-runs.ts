import { rmSync } from "node:fs";
import { join } from "node:path";
import type { CaseOutcome } from "./junit-report.js";
import { writeFileAtomic, type SavedTestRun } from "./run-state.js";

/** Why a run checked the whole test file instead of each case. The messages and notes use these words only. */
export const FALLBACK_REASONS = {
  "no-report": "the settings declare no per-case report",
  missing: "the test command wrote no report file",
  malformed: "the report file is not a JUnit report that cstack can read",
} as const;

export type Fallback = keyof typeof FALLBACK_REASONS;

/** A saved run of a unit's test, with the hash of the test file at the time of the run. */
export interface SavedUnitRun extends SavedTestRun {
  testFileSha256: string;
  /** How the cases were checked. Older files lack it. A later field is one more optional key here. */
  caseCheck?: "cases" | "file";
  /** With caseCheck "file": why the whole file was checked. */
  fallback?: Fallback;
  /** With caseCheck "cases": every case of the report in report order. It never holds a failure message. */
  cases?: Array<{ name: string; outcome: CaseOutcome }>;
}

/** A failing run. startedAt is the moment `cstack unit red` read the status of the unit's files, as an ISO 8601 time. */
export interface FailingUnitRun extends SavedUnitRun {
  startedAt: string;
}

const unitFolder = (runDir: string, unit: number) => join(runDir, "units", String(unit));

const write = (runDir: string, unit: number, kind: "red" | "green", run: SavedUnitRun, log: string) => {
  const base = join(unitFolder(runDir, unit), kind);
  writeFileAtomic(`${base}.log`, log);
  writeFileAtomic(`${base}.json`, `${JSON.stringify(run, null, 2)}\n`);
};

/** Deletes the saved passing run of a unit, if there is one. */
export function deletePassingRun(runDir: string, unit: number): void {
  const folder = unitFolder(runDir, unit);
  rmSync(join(folder, "green.json"), { force: true });
  rmSync(join(folder, "green.log"), { force: true });
}

/** Saves a failing run. It deletes the passing run first, and writes red.json last. */
export function saveFailingRun(runDir: string, unit: number, run: FailingUnitRun, log: string): void {
  deletePassingRun(runDir, unit);
  write(runDir, unit, "red", run, log);
}

/** Saves a passing run. The failing run stays. */
export function savePassingRun(runDir: string, unit: number, run: SavedUnitRun, log: string): void {
  write(runDir, unit, "green", run, log);
}
