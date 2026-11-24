import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, isAbsolute, sep } from "node:path";
import { parseArgs } from "node:util";
import { failWith } from "./commands/errors.js";
import type { Io } from "./io.js";
import type { TestCase } from "./junit-report.js";
import { locatePlan } from "./plan/locate.js";
import { readPlan, type PlanUnit } from "./plan/read.js";
import { runFolder } from "./run-state.js";
import { readSettings, SettingsError, type TestCommands } from "./settings.js";
import { DEFAULT_TEST_TIMEOUT_MS, lastLines } from "./test-run.js";

/** What `cstack unit red` and `cstack unit green` know once the shared checks pass. */
export interface UnitTestContext {
  root: string;
  runDir: string;
  unit: PlanUnit;
  /** The path of the plan file. */
  planPath: string;
  /** The path of the unit's `Test` line, as the plan writes it. */
  testFile: string;
  commands: TestCommands;
  timeoutMs: number;
}

const MAX_TIMEOUT_MINUTES = 1440;

/**
 * Runs the checks that both commands share, in the order of the plan: the arguments, the plan, the unit,
 * the `No test` line, then the settings and the test file. `beforeSettings` is the place of the checks that
 * only one command has, such as the saved failing run of `cstack unit green`.
 * It returns the context, or the exit code after it printed the reason on standard error.
 */
export function prepareUnitTest(
  name: "red" | "green",
  args: string[],
  io: Io,
  cwd: string,
  beforeSettings?: (context: Pick<UnitTestContext, "root" | "runDir" | "unit" | "planPath">) => number | undefined,
): UnitTestContext | number {
  const prefix = `cstack unit ${name}: `;
  const usage = `Usage: cstack unit ${name} <n> [--timeout <minutes>] [--plan <file>]`;
  const usageError = (message: string) => {
    io.stderr(`${prefix}${message}\n${usage}\n`);
    return 2;
  };
  const refuse = (message: string, code: number) => {
    io.stderr(`${prefix}${message}\n`);
    return code;
  };

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { plan: { type: "string" }, timeout: { type: "string" } },
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    return usageError(error instanceof Error ? error.message : String(error));
  }
  if (parsed.positionals.length !== 1) return usageError("give exactly one unit number");

  let timeoutMs = DEFAULT_TEST_TIMEOUT_MS;
  const rawTimeout = parsed.values.timeout;
  if (rawTimeout !== undefined) {
    const minutes = /^\d+(\.\d+)?$/.test(rawTimeout) ? Number(rawTimeout) : NaN;
    if (!(minutes > 0 && minutes <= MAX_TIMEOUT_MINUTES)) {
      return usageError(`--timeout takes a number of minutes above 0 and at most ${MAX_TIMEOUT_MINUTES}, not "${rawTimeout}".`);
    }
    timeoutMs = minutes * 60_000;
  }

  try {
    const located = locatePlan(cwd, parsed.values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    const n = Number(parsed.positionals[0]);
    const unit = Number.isInteger(n) && n > 0 ? plan.units.find((u) => u.number === n) : undefined;
    if (!unit) {
      return refuse(
        `"${parsed.positionals[0]}" is not a unit of the plan. The plan has units ${plan.units.map((u) => u.number).join(", ")}.`,
        2,
      );
    }
    if (unit.noTest !== undefined) {
      if (unit.noTest.trim() === "") return refuse(`Unit ${n} has a \`No test\` line with no reason.`, 3);
      return refuse(
        `Unit ${n} has no test: ${unit.noTest} Commit it directly with \`cstack unit commit ${n}\`.`,
        1,
      );
    }
    if (!unit.test) return refuse(`Unit ${n} has neither a \`Test\` line nor a \`No test\` line.`, 3);

    const base = { root: located.root, runDir: runFolder(located.root, located.relative), unit, planPath: located.path };
    const early = beforeSettings?.(base);
    if (early !== undefined) return early;

    let commands: TestCommands | undefined;
    try {
      commands = readSettings(located.root).values.testCommands;
    } catch (error) {
      if (!(error instanceof SettingsError)) throw error;
      return refuse(error.problems.map((p) => `${p.path}: ${p.text}`).join(`\n${prefix}`), 3);
    }
    if (!commands) {
      return refuse("The settings have no `testCommands.all`. Add it to `.cstack/settings.json`.", 3);
    }

    const testFile = unit.test.file;
    let real: string;
    try {
      real = realpathSync(join(located.root, testFile));
    } catch {
      return refuse(`The test file ${testFile} of unit ${n} does not exist. Write the test first.`, 1);
    }
    const rel = relative(located.root, real);
    if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      return refuse(`The test file ${testFile} of unit ${n} leads outside the work tree.`, 1);
    }
    if (!statSync(real).isFile()) {
      return refuse(`The test path ${testFile} of unit ${n} is not a file. The \`Test\` line must name one test file.`, 1);
    }
    return { ...base, testFile, commands, timeoutMs };
  } catch (error) {
    return failWith(error, io, prefix);
  }
}

/** Writes a case name for a message: JSON-escaped, C1 control characters escaped, never cut. */
export function caseName(name: string): string {
  return JSON.stringify(name).replace(/[\u007f-\u009f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

/** A named case that does not have the outcome the run needs. */
export interface CaseProblem {
  name: string;
  /** "wrong" is the opposite outcome: passed in a red run, failed or error in a green run. */
  kind: "wrong" | "missing" | "skipped";
}

/**
 * Compares the cases that a unit names with the cases of a report, in the order of the plan.
 * A named case matches every report case with exactly its name. With want "fail", each match must be failed or error.
 * With want "pass", each match must be passed. A wrong outcome is reported before a skipped one.
 */
export function checkNamedCases(named: string[], cases: TestCase[], want: "fail" | "pass"): CaseProblem[] {
  const problems: CaseProblem[] = [];
  for (const name of named) {
    const matches = cases.filter((c) => c.name === name);
    const good = (c: TestCase) => (want === "pass" ? c.outcome === "passed" : c.outcome === "failed" || c.outcome === "error");
    if (matches.length === 0) problems.push({ name, kind: "missing" });
    else if (matches.some((c) => c.outcome !== "skipped" && !good(c))) problems.push({ name, kind: "wrong" });
    else if (matches.some((c) => c.outcome === "skipped")) problems.push({ name, kind: "skipped" });
  }
  return problems;
}

/** Returns the commit of `HEAD`, or undefined when git cannot give it. Git runs without a shell. */
export function headCommit(root: string): string | undefined {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

/** Returns the hexadecimal SHA-256 of the content of a file of the work tree. */
export function fileSha256(root: string, file: string): string {
  return createHash("sha256").update(readFileSync(join(root, file))).digest("hex");
}

/** Prints the last lines of a test output, and ends them with a line break so the verdict starts its own line. */
export function printTestOutput(io: Io, output: string): void {
  const tail = lastLines(output);
  io.stdout(tail === "" || tail.endsWith("\n") ? tail : `${tail}\n`);
}

/** Returns the test file as HEAD has it, or undefined when git cannot give it. Git runs without a shell. */
export function headTestFile(root: string, testFile: string): string | undefined {
  const result = spawnSync("git", ["show", `HEAD:${testFile}`], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout : undefined;
}

/**
 * Returns the names of the passed cases that the unit does not name and whose title (the part after the last " > ")
 * is not in the test file at HEAD. When HEAD has no such file, every passed unnamed case is kept.
 */
export function unnamedPassingCases(named: string[], cases: TestCase[], headText: string | undefined): string[] {
  return cases
    .filter((c) => c.outcome === "passed" && !named.includes(c.name))
    .filter((c) => headText === undefined || !headText.includes(c.name.slice(c.name.lastIndexOf(" > ") === -1 ? 0 : c.name.lastIndexOf(" > ") + 3)))
    .map((c) => c.name);
}
