import { rmSync } from "node:fs";
import { join } from "node:path";
import { writeFileAtomic, type SavedTestRun } from "./run-state.js";

/** A saved run of a unit's test, with the hash of the test file at the time of the run. */
export interface SavedUnitRun extends SavedTestRun {
  testFileSha256: string;
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
export function saveFailingRun(runDir: string, unit: number, run: SavedUnitRun, log: string): void {
  deletePassingRun(runDir, unit);
  write(runDir, unit, "red", run, log);
}

/** Saves a passing run. The failing run stays. */
export function savePassingRun(runDir: string, unit: number, run: SavedUnitRun, log: string): void {
  write(runDir, unit, "green", run, log);
}
