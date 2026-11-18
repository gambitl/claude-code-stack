// WHY: prints the oldest accepted report that the main conversation has not seen yet, exactly as it was saved.
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { locatePlan } from "../plan/locate.js";
import { takeOldestUnreadReport } from "../report/reports.js";
import { failWith } from "./errors.js";

const USAGE = "Usage: cstack report check [--plan <file>]";

export async function reportCheck(args: string[], io: Io, options: { cwd: string }): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args, options: { plan: { type: "string" } }, strict: true, allowPositionals: false });
  } catch (error) {
    io.stderr(`${(error as Error).message}. ${USAGE}\n`);
    return 2;
  }

  try {
    const located = locatePlan(options.cwd, parsed.values.plan);
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
    return failWith(error, io);
  }
}
