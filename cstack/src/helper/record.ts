// WHY: a helper id becomes part of a file path and of a command line, so it is checked against one strict pattern before any file is read.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT } from "../manifest.js";
import { writeFileAtomic } from "../run-state.js";

/** The exit code of `helper start` (start a sub-agent) and of `helper wait` (still working). */
export const HELPER_EXIT_PENDING = 6;

export type HelperRole = "executor" | "implementer" | "implementer-escalation";

export interface HelperRecord {
  format: "cstack-helper/1";
  id: string;
  role: HelperRole;
  unit: number | null;
  startedAt: string;
  mode: "orca-worker" | "sub-agent";
  dispatchId?: string;
  reason?: string;
  report?: string;
  sent?: boolean;
  /** The child worktree of the helper, when it has one. */
  worktree?: { path: string; branch: string };
  released?: boolean;
  collectedAt?: string;
}

/** An error about a helper. It knows the exit code of the command. */
export class HelperError extends Error {
  constructor(message: string, readonly exitCode: number) {
    super(message);
    this.name = "HelperError";
  }
}

const ID_PATTERN = /^\d{8}-\d{9}-(executor|implementer|implementer-escalation)(?:-([1-9]\d{0,3}))?$/;

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/** `<UTC date>-<UTC time with milliseconds>-<role>`, with `-<unit>` after an implementer role. */
export function makeHelperId(role: HelperRole, unit: number | null, now: Date = new Date()): string {
  const date = `${pad(now.getUTCFullYear(), 4)}${pad(now.getUTCMonth() + 1, 2)}${pad(now.getUTCDate(), 2)}`;
  const time = `${pad(now.getUTCHours(), 2)}${pad(now.getUTCMinutes(), 2)}${pad(now.getUTCSeconds(), 2)}${pad(now.getUTCMilliseconds(), 3)}`;
  return `${date}-${time}-${role}${unit === null ? "" : `-${unit}`}`;
}

/** Returns the role and the unit of a valid helper id. Any other value is refused with exit code 2. */
export function checkHelperId(id: string): { role: HelperRole; unit: number | null } {
  const match = ID_PATTERN.exec(id);
  const role = match?.[1] as HelperRole | undefined;
  const hasUnit = match?.[2] !== undefined;
  if (!match || !role || (role === "executor") === hasUnit) {
    throw new HelperError("This is not a helper id. It looks like 20261119-143205123-executor.", EXIT.usage);
  }
  return { role, unit: hasUnit ? Number(match[2]) : null };
}

export function helperRecordPath(runFolder: string, id: string): string {
  return join(runFolder, "helpers", `${id}.json`);
}

export function helperSpecPath(runFolder: string, id: string): string {
  return join(runFolder, "helpers", `${id}.spec.md`);
}

/** Creates the record. It never replaces the record of another helper. */
export function createRecord(runFolder: string, record: HelperRecord): void {
  checkHelperId(record.id);
  mkdirSync(join(runFolder, "helpers"), { recursive: true });
  try {
    writeFileSync(helperRecordPath(runFolder, record.id), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new HelperError(`The helper ${record.id} already has a record. cstack never replaces it.`, EXIT.refused);
    }
    throw error;
  }
}

export function readRecord(runFolder: string, id: string): HelperRecord {
  checkHelperId(id);
  const path = helperRecordPath(runFolder, id);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new HelperError(`The run has no helper ${id}.`, EXIT.refused);
    }
    throw error;
  }
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("not an object");
    return value as HelperRecord;
  } catch {
    throw new HelperError(`The record ${path} is not valid JSON.`, EXIT.invalidInput);
  }
}

/** Merges the fields into the record and writes it again, whole. */
export function updateRecord(runFolder: string, id: string, fields: Partial<HelperRecord>): HelperRecord {
  const updated = { ...readRecord(runFolder, id), ...fields };
  writeFileAtomic(helperRecordPath(runFolder, id), `${JSON.stringify(updated, null, 2)}\n`);
  return updated;
}

/** The helper records of a unit, oldest start first. The id breaks a tie. A file that cannot be read is skipped. */
export function unitRecords(runFolder: string, unit: number): HelperRecord[] {
  const folder = join(runFolder, "helpers");
  if (!existsSync(folder)) return [];
  const found: HelperRecord[] = [];
  for (const name of readdirSync(folder).filter((n) => n.endsWith(".json"))) {
    try {
      const value: unknown = JSON.parse(readFileSync(join(folder, name), "utf8"));
      if (typeof value === "object" && value !== null && !Array.isArray(value) && (value as HelperRecord).unit === unit) found.push(value as HelperRecord);
    } catch {
      // a record that cannot be read is not a record of the unit
    }
  }
  return found.sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The latest helper record of a unit, or nothing. It is the newest start, and the id breaks a tie. */
export function latestUnitRecord(runFolder: string, unit: number): HelperRecord | undefined {
  return unitRecords(runFolder, unit).at(-1);
}
