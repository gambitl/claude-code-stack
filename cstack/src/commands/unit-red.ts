import type { Io } from "../io.js";
import { runTests, testScript, usesReport } from "../test-run.js";
import { caseName, checkNamedCases, fileSha256, headCommit, headTestFile, prepareUnitTest, printTestOutput, unnamedPassingCases } from "../unit-test-command.js";
import { isTestFile, readUnitStatus, restartText } from "../unit-files.js";
import { buildNote, caseProblemText, describeReport, noteFailed, printFallback, saveFailingRun, writeUnitNote } from "../unit-test-runs.js";
import { failWith } from "./errors.js";

export async function unitRed(args: string[], io: Io, cwd: string = process.cwd()): Promise<number> {
  const prefix = "cstack unit red: ";
  const context = prepareUnitTest("red", args, io, cwd);
  if (typeof context === "number") return context;
  const { root, runDir, unit, testFile, commands, timeoutMs, planPath } = context;

  const startedAt = new Date().toISOString();
  const status = readUnitStatus(root, unit.files);
  if ("error" in status) {
    io.stderr(`${prefix}git could not give the status of the files of unit ${unit.number}: ${status.error}\n`);
    return 5;
  }
  const code = status.entries.filter((e) => !isTestFile(e.path, testFile));
  if (code.length > 0) {
    io.stderr(
      `${prefix}These files of unit ${unit.number} are not test files, and they already differ from HEAD:\n` +
        code.map((e) => `  ${e.path} (${e.state})\n`).join("") +
        `The test must fail before any code of the unit exists, and moving code aside to get a failure is not allowed. Nothing is saved.\n${restartText(unit.number)}\n`,
    );
    return 1;
  }

  // WHY: the commit and the fingerprint are read just before the test runs, so they describe what ran.
  const commit = headCommit(root);
  if (commit === undefined) {
    io.stderr(`${prefix}git could not give the commit of HEAD.\n`);
    return 5;
  }
  const testFileSha256 = fileSha256(root, testFile);
  const run = await runTests(root, testScript(commands, testFile), testFile, timeoutMs, {
    report: usesReport(commands, testFile),
  });
  printTestOutput(io, run.output);

  if (run.timedOut) {
    io.stderr(`${prefix}The test did not end within ${timeoutMs / 60_000} minutes, so cstack stopped it. Nothing is saved.\n`);
    return 5;
  }
  if (run.exitCode === 126 || run.exitCode === 127) {
    io.stderr(`${prefix}The test command could not start (exit code ${run.exitCode}). Nothing is saved.\n`);
    return 5;
  }
  const report = run.report;
  const { caseRun, problem: reportProblem } = describeReport(report);
  if (report !== undefined && "cases" in report) {
    const problems = checkNamedCases(unit.test!.cases, report.cases, "fail");
    if (problems.length > 0) {
      const text = caseProblemText("red");
      io.stderr(
        `${prefix}These cases that unit ${unit.number} names do not fail before the code exists:\n` +
          problems.map((p) => `  ${caseName(p.name)} ${text[p.kind]}\n`).join("") +
          'Each case that the plan names must fail before the code exists. Write each case name exactly as the test report names it. For vitest, that is the titles of the describe blocks and the title of the test, joined by " > ". Nothing is saved.\n',
      );
      return 1;
    }
  }
  if (run.exitCode === 0) {
    io.stderr(
      `${prefix}The test passes, and a passing test proves nothing yet. The test must fail before the code exists. Nothing is saved.\n`,
    );
    return 1;
  }
  try {
    saveFailingRun(
      runDir,
      unit.number,
      { time: new Date().toISOString(), startedAt, command: run.script, exitCode: run.exitCode!, commit, testFile, testFileSha256, ...caseRun },
      run.output,
    );
  } catch (error) {
    return failWith(error, io, prefix);
  }
  io.stdout(`${prefix}Unit ${unit.number} fails as it should (exit code ${run.exitCode}). The failing run is saved in ${runDir}/units/${unit.number}/red.json.\n`);
  if (caseRun.caseCheck === "file") printFallback(io, "red", unit.number, caseRun.fallback!, reportProblem);
  let unnamed: string[] = [];
  if (report !== undefined && "cases" in report) {
    unnamed = unnamedPassingCases(unit.test!.cases, report.cases, headTestFile(root, testFile));
    if (unnamed.length > 0) {
      io.stdout(
        `${prefix}Warning: these cases of ${testFile} are not named in unit ${unit.number}, and they passed before the code existed:\n` +
          unnamed.map((n) => `  ${caseName(n)}\n`).join("") +
          `If one of them is new, name it on a \`- Test:\` line of the unit and make it fail first. The plan file notes this under unit ${unit.number}.\n`,
      );
    }
  }
  const problem = await writeUnitNote(root, planPath, unit.number, "red", buildNote("red", caseRun.fallback, unnamed));
  if (problem !== undefined) return noteFailed(io, "red", unit.number, problem);
  if (commands.file === undefined) {
    io.stdout(
      `The whole test suite ran. Check in red.log that the test of unit ${unit.number} is the one that fails.\n`,
    );
  }
  return 0;
}
