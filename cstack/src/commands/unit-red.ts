import type { Io } from "../io.js";
import { runTests, testScript } from "../test-run.js";
import { fileSha256, headCommit, prepareUnitTest, printTestOutput } from "../unit-test-command.js";
import { saveFailingRun } from "../unit-test-runs.js";
import { failWith } from "./errors.js";

export async function unitRed(args: string[], io: Io, cwd: string = process.cwd()): Promise<number> {
  const prefix = "cstack unit red: ";
  const context = prepareUnitTest("red", args, io, cwd);
  if (typeof context === "number") return context;
  const { root, runDir, unit, testFile, commands, timeoutMs } = context;

  // WHY: the commit and the fingerprint are read just before the test runs, so they describe what ran.
  const commit = headCommit(root);
  if (commit === undefined) {
    io.stderr(`${prefix}git could not give the commit of HEAD.\n`);
    return 5;
  }
  const testFileSha256 = fileSha256(root, testFile);
  const run = await runTests(root, testScript(commands, testFile), testFile, timeoutMs);
  printTestOutput(io, run.output);

  if (run.timedOut) {
    io.stderr(`${prefix}The test did not end within ${timeoutMs / 60_000} minutes, so cstack stopped it. Nothing is saved.\n`);
    return 5;
  }
  if (run.exitCode === 126 || run.exitCode === 127) {
    io.stderr(`${prefix}The test command could not start (exit code ${run.exitCode}). Nothing is saved.\n`);
    return 5;
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
      { time: new Date().toISOString(), command: run.script, exitCode: run.exitCode!, commit, testFile, testFileSha256 },
      run.output,
    );
  } catch (error) {
    return failWith(error, io, prefix);
  }
  io.stdout(`${prefix}Unit ${unit.number} fails as it should (exit code ${run.exitCode}). The failing run is saved in ${runDir}/units/${unit.number}/red.json.\n`);
  if (commands.file === undefined) {
    io.stdout(
      `The whole test suite ran. Check in red.log that the test of unit ${unit.number} is the one that fails.\n`,
    );
  }
  return 0;
}
