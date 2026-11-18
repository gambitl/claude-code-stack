// WHY: prints the oldest accepted report that the main conversation has not seen yet, exactly as it was saved.
import type { Io } from "../io.js";
import { locatePlan, PlanLocationError } from "../plan/locate.js";
import { takeOldestUnreadReport } from "../report/reports.js";
import { RunStateError } from "../run-state.js";

const USAGE = "Usage: cstack report check [--plan <file>]\n";

export async function reportCheck(args: string[], io: Io, options: { cwd: string }): Promise<number> {
  let planFlag: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--plan") {
      planFlag = args[++i];
      if (planFlag === undefined) {
        io.stderr("The flag --plan needs a file.\n");
        return 2;
      }
    } else if (arg.startsWith("--plan=")) planFlag = arg.slice("--plan=".length);
    else {
      io.stderr(`Unexpected argument ${arg}. ${USAGE}`);
      return 2;
    }
  }

  try {
    const located = locatePlan(options.cwd, planFlag);
    const report = takeOldestUnreadReport({ root: located.root, planFile: located.relative });
    if (!report) {
      io.stderr(
        "The executor returned without an accepted report. Launch the executor again with the same inputs. It resumes from the plan file.\n",
      );
      return 1;
    }
    io.stdout(`${report.kind}\n${report.text}`);
    return 0;
  } catch (error) {
    if (error instanceof PlanLocationError) {
      io.stderr(`${error.message}\n`);
      return error.exitCode;
    }
    if (error instanceof RunStateError) {
      io.stderr(`${error.message}\n`);
      return 3;
    }
    throw error;
  }
}
