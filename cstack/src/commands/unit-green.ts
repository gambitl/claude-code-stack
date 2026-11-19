import type { Io } from "../io.js";
import { readSavedRun } from "../saved-runs.js";
import { lastLines, runTests, testScript } from "../test-run.js";
import { fileSha256, headCommit, prepareUnitTest } from "../unit-test-command.js";
import { savePassingRun } from "../unit-test-runs.js";
import { failWith } from "./errors.js";

export async function unitGreen(args: string[], io: Io, cwd: string = process.cwd()): Promise<number> {
  const prefix = "cstack unit green: ";
  const context = prepareUnitTest("green", args, io, cwd, ({ runDir, unit }) => {
    if (readSavedRun(runDir, unit.number, "red")) return undefined;
    io.stderr(
      `${prefix}Unit ${unit.number} has no saved failing run. Write the test, run \`cstack unit red ${unit.number}\`, and only then write the code.\n`,
    );
    return 1;
  });
  if (typeof context === "number") return context;
  const { root, runDir, unit, testFile, commands, timeoutMs } = context;

  let saved;
  try {
    saved = readSavedRun(runDir, unit.number, "red");
  } catch (error) {
    return failWith(error, io, prefix);
  }
  const script = testScript(commands, testFile);
  if (!saved || saved.command !== script || saved.testFile !== testFile) {
    io.stderr(
      `${prefix}The test command changed since the failing run of unit ${unit.number}. Set the code aside, run \`cstack unit red ${unit.number}\` again, then bring the code back.\n`,
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
  const run = await runTests(root, script, testFile, timeoutMs);
  io.stdout(lastLines(run.output));

  if (run.timedOut) {
    io.stderr(`${prefix}The test did not end within ${timeoutMs / 60_000} minutes, so cstack stopped it. Nothing is saved.\n`);
    return 5;
  }
  if (run.exitCode === 126 || run.exitCode === 127) {
    io.stderr(`${prefix}The test command could not start (exit code ${run.exitCode}). Nothing is saved.\n`);
    return 5;
  }
  if (run.exitCode !== 0) {
    io.stderr(`${prefix}The test of unit ${unit.number} still fails (exit code ${run.exitCode}). Nothing is saved.\n`);
    return 1;
  }
  try {
    savePassingRun(
      runDir,
      unit.number,
      { time: new Date().toISOString(), command: run.script, exitCode: 0, commit, testFile, testFileSha256 },
      run.output,
    );
  } catch (error) {
    return failWith(error, io, prefix);
  }
  const savedSha = (saved as { testFileSha256?: string }).testFileSha256;
  if (savedSha !== undefined && savedSha !== testFileSha256) {
    io.stderr(`${prefix}Warning: the test file ${testFile} changed since the failing run of unit ${unit.number}.\n`);
  }
  io.stdout(`${prefix}Unit ${unit.number} passes. The passing run is saved in ${runDir}/units/${unit.number}/green.json.\n`);
  return 0;
}
