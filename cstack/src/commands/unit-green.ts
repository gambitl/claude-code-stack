import { statSync } from "node:fs";
import { join } from "node:path";
import type { Io } from "../io.js";
import { readSavedRun } from "../saved-runs.js";
import { runTests, testScript } from "../test-run.js";
import { fileSha256, headCommit, prepareUnitTest, printTestOutput } from "../unit-test-command.js";
import { isTestFile, readUnitStatus, restartText } from "../unit-files.js";
import { deletePassingRun, savePassingRun, type SavedUnitRun } from "../unit-test-runs.js";
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

  // WHY: red.json is written by saveFailingRun, so it has the fields of a SavedUnitRun. An older file may lack the hash.
  let saved: (Partial<SavedUnitRun> & { startedAt?: string }) | undefined;
  try {
    saved = readSavedRun(runDir, unit.number, "red");
  } catch (error) {
    return failWith(error, io, prefix);
  }
  const script = testScript(commands, testFile);
  if (!saved || saved.command !== script || saved.testFile !== testFile) {
    io.stderr(
      `${prefix}The test command changed since the failing run of unit ${unit.number}. ${restartText(unit.number)}\n`,
    );
    return 1;
  }

  // WHY: this check is a safety net, not a proof. A file written back with a new modification time, for example by
  // `git stash pop`, `git checkout` or a plain `cp`, still passes it. Only `mv` and copies that keep the time are caught.
  const status = readUnitStatus(root, unit.files);
  if ("error" in status) {
    io.stderr(`${prefix}git could not give the status of the files of unit ${unit.number}: ${status.error}\n`);
    return 5;
  }
  const reference = Date.parse(saved.startedAt ?? saved.time ?? "");
  const stale = Number.isNaN(reference)
    ? []
    : status.entries.filter((e) => {
        if (e.state === "deleted" || isTestFile(e.path, testFile)) return false;
        try {
          return statSync(join(root, e.path)).mtimeMs < reference - 2_000;
        } catch {
          return false;
        }
      });
  if (stale.length > 0) {
    try {
      deletePassingRun(runDir, unit.number);
    } catch (error) {
      return failWith(error, io, prefix);
    }
    io.stderr(
      `${prefix}These files of unit ${unit.number} are not test files, and they are older than the latest failing run:\n` +
        stale.map((e) => `  ${e.path}\n`).join("") +
        `The code was written before the test failed. No test ran, nothing is saved, and any earlier passing run is deleted.\n${restartText(unit.number)}\n`,
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
  printTestOutput(io, run.output);

  if (run.exitCode !== 0) {
    // WHY: a passing run saved before this run would let `cstack unit commit` accept code whose test does not pass now.
    // A timeout and a command that cannot start do not pass either.
    try {
      deletePassingRun(runDir, unit.number);
    } catch (error) {
      return failWith(error, io, prefix);
    }
  }
  if (run.timedOut) {
    io.stderr(
      `${prefix}The test did not end within ${timeoutMs / 60_000} minutes, so cstack stopped it. Nothing is saved, and any earlier passing run is deleted.\n`,
    );
    return 5;
  }
  if (run.exitCode === 126 || run.exitCode === 127) {
    io.stderr(
      `${prefix}The test command could not start (exit code ${run.exitCode}). Nothing is saved, and any earlier passing run is deleted.\n`,
    );
    return 5;
  }
  if (run.exitCode !== 0) {
    io.stderr(
      `${prefix}The test of unit ${unit.number} still fails (exit code ${run.exitCode}). Nothing is saved, and any earlier passing run is deleted.\n`,
    );
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
  if (saved.testFileSha256 !== undefined && saved.testFileSha256 !== testFileSha256) {
    io.stderr(`${prefix}Warning: the test file ${testFile} changed since the failing run of unit ${unit.number}. Say in your report what changed in the test and why.\n`);
  }
  io.stdout(`${prefix}Unit ${unit.number} passes. The passing run is saved in ${runDir}/units/${unit.number}/green.json.\n`);
  return 0;
}
