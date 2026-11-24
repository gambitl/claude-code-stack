import { readFileSync, rmSync } from "node:fs";
import type { Io } from "./io.js";
import { join } from "node:path";
import type { CaseOutcome } from "./junit-report.js";
import { caseName } from "./unit-test-command.js";
import { withCommitLock } from "./commit-lock.js";
import { readPlan } from "./plan/read.js";
import { gitFolders, writeFileAtomic, type SavedTestRun } from "./run-state.js";
import type { ReportResult } from "./test-run.js";

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

/**
 * Tells the user that the whole test file was checked, and why.
 * Without a declared report it writes on standard output. With a declared report that gave none, it writes a warning on standard error.
 */
export function printFallback(io: Io, kind: "red" | "green", unit: number, fallback: Fallback, problem?: string): void {
  const prefix = `cstack unit ${kind}: `;
  if (fallback === "no-report") {
    io.stdout(`${prefix}The settings declare no per-case report, so cstack checked the whole test file. The plan file notes this under unit ${unit}.\n`);
    return;
  }
  io.stderr(
    `${prefix}Warning: ${FALLBACK_REASONS[fallback]}, so cstack checked the whole test file. Check that testCommands.file in .cstack/settings.json makes the test tool write a JUnit report to {report}. The plan file notes this under unit ${unit}.\n`,
  );
  if (fallback === "malformed" && problem !== undefined) io.stderr(`The reader of the report says: ${problem}\n`);
}

const noteStart = (kind: "red" | "green") => `Note of cstack unit ${kind}: `;

/**
 * Returns the plan text with the note of one command in one unit. The old note of that command goes first.
 * A new note goes after the last line of the unit that is not empty. Without a note, the old one is only removed.
 * The unit runs from its heading to the line before the next heading.
 */
export function setUnitNote(text: string, unit: number, kind: "red" | "green", note: string | undefined): string {
  const { lines, start, end } = unitRange(text, unit);
  const kept = lines.slice(start, end).filter((line) => !line.startsWith(noteStart(kind)));
  let last = kept.length - 1;
  while (last >= 0 && kept[last].trim() === "") last--;
  if (note !== undefined) kept.splice(last + 1, 0, note);
  return [...lines.slice(0, start), ...kept, ...lines.slice(end)].join("\n");
}

function unitRange(text: string, unit: number) {
  const plan = readPlan(text);
  const target = plan.units.find((u) => u.number === unit);
  if (!target) throw new Error(`The plan has no unit ${unit}.`);
  const lines = text.split("\n");
  const next = plan.headings.find((heading) => heading.line > target.line);
  return { lines, start: target.line, end: next ? next.line - 1 : lines.length };
}

/** Writes the note into the plan file, inside the commit lock of the plan file. It returns a message when it fails. */
export async function writeUnitNote(
  root: string,
  planPath: string,
  unit: number,
  kind: "red" | "green",
  note: string | undefined,
): Promise<string | undefined> {
  const lockPath = join(gitFolders(root).gitDir, "cstack", "plan-file.lock");
  try {
    const locked = await withCommitLock(lockPath, unit, 60_000, () =>
      writeFileAtomic(planPath, setUnitNote(readFileSync(planPath, "utf8"), unit, kind, note)),
    );
    return locked.ok ? undefined : locked.message;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Builds the note of a run: the passing unnamed cases (red only), or the fallback, or none. */
export function buildNote(kind: "red" | "green", fallback: Fallback | undefined, unnamed: string[] = []): string | undefined {
  if (fallback !== undefined) return `${noteStart(kind)}the whole test file was checked, because ${FALLBACK_REASONS[fallback]}.`;
  if (unnamed.length === 0) return undefined;
  const shown = unnamed.slice(0, 10).map(caseName).join(", ");
  const rest = unnamed.length > 10 ? `, and ${unnamed.length - 10} more.` : ".";
  return `${noteStart(kind)}these cases are not named in this unit, and they passed before the code existed: ${shown}${rest}`;
}

/** Prints the failure to write the note, and returns the exit code 5. */
export function noteFailed(io: Io, kind: "red" | "green", unit: number, message: string): number {
  io.stderr(
    `cstack unit ${kind}: The ${kind === "red" ? "failing" : "passing"} run is saved, but cstack could not write the note of unit ${unit} into the plan file: ${message.replace(/\.$/, "")}. Run \`cstack unit ${kind} ${unit}\` again.\n`,
  );
  return 5;
}

/** The texts that say why a named case is a problem. Only the text of a wrong case differs between red and green. */
export function caseProblemText(kind: "red" | "green"): Record<"wrong" | "missing" | "skipped", string> {
  return {
    wrong: kind === "red" ? "passed." : "failed.",
    missing: "is not in the test report.",
    skipped: "was skipped, so it never ran. A failing beforeAll hook is a common cause.",
  };
}

/** What a run saves about its cases, and the message of the report's problem when the report gave no cases. */
export function describeReport(report: ReportResult | undefined): { caseRun: Pick<SavedUnitRun, "caseCheck" | "fallback" | "cases">; problem?: string } {
  if (report === undefined) return { caseRun: { caseCheck: "file", fallback: "no-report" } };
  if ("cases" in report) return { caseRun: { caseCheck: "cases", cases: report.cases.map((c) => ({ name: c.name, outcome: c.outcome })) } };
  return { caseRun: { caseCheck: "file", fallback: report.problem === "malformed" ? "malformed" : "missing" }, problem: report.message };
}
