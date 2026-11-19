import type { Io } from "../io.js";
import { readSavedRun } from "../saved-runs.js";
import { prepareUnitTest } from "../unit-test-command.js";

export async function unitGreen(args: string[], io: Io, cwd: string = process.cwd()): Promise<number> {
  const context = prepareUnitTest("green", args, io, cwd, ({ runDir, unit }) => {
    if (readSavedRun(runDir, unit.number, "red")) return undefined;
    io.stderr(
      `cstack unit green: Unit ${unit.number} has no saved failing run. Write the test, run \`cstack unit red ${unit.number}\`, and only then write the code.\n`,
    );
    return 1;
  });
  if (typeof context === "number") return context;
  // WHY: running the test and saving the passing run come in a later unit of the plan.
  io.stderr("cstack unit green: running the test is not built yet.\n");
  return 5;
}
