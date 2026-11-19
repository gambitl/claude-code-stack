// WHY: `worker-show` is the only proof of the state of a worker. The `check` call is only a signal to look again, so its answer is never read.
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { parseAnswer } from "../orca/answer.js";
import { callOrca } from "../orca/call.js";
import type { Runner, RunResult } from "../orca/run.js";
import { checkShape } from "../orca/shapes.js";
import { locatePlan } from "../plan/locate.js";
import { latestUnitReport, takeOldestUnreadReport } from "../report/reports.js";
import { runFolder } from "../run-state.js";
import { HELPER_EXIT_PENDING, HelperError, readRecord, type HelperRecord } from "./record.js";

export interface WaitDeps {
  cwd: string;
  env: Record<string, string | undefined>;
  createRunner: (timeoutMs: number) => Runner;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
}

const DEADLINE_MS = 9 * 60_000;
const CHECK_MAX_MS = 60_000;
const SHOW_TIMEOUT_MS = 30_000;
const CHECK_GRACE_MS = 30_000;
const MIN_TURN_MS = 5_000;

interface ShowAnswer {
  ok?: unknown;
  error?: { message?: unknown };
  result?: {
    dispatch?: { status?: string };
    projection?: { liveness?: { verdict?: string } };
    observation?: { agentWait?: unknown };
  };
}

/** The report of a finished helper, as `<kind>`, a newline and the text. Exits with 1 when there is none. */
function printReport(record: HelperRecord, where: { root: string; planFile: string }, io: Io): number {
  const report =
    record.unit === null
      ? takeOldestUnreadReport(where)
      : latestUnitReport(where, record.unit, record.id);
  if (!report) {
    io.stderr(`The helper ${record.id} finished without an accepted report. Launch the helper again with the same inputs.\n`);
    return 1;
  }
  io.stdout(`${report.kind}\n${report.text}`);
  return 0;
}

export async function waitHelper(helper: string, io: Io, deps: WaitDeps): Promise<number> {
  const located = locatePlan(deps.cwd, undefined);
  const where = { root: located.root, planFile: located.relative };
  const record = readRecord(runFolder(located.root, located.relative), helper);
  if (record.mode !== "orca-worker") return printReport(record, where, io);

  const deadline = deps.now().getTime() + DEADLINE_MS;
  for (;;) {
    const shown = await callOrca(deps.createRunner(SHOW_TIMEOUT_MS), deps.env, ["orchestration", "worker-show", "--dispatch", record.dispatchId ?? "", "--full"]);
    const answer = parseAnswer<ShowAnswer>(shown);
    try {
      if (shown.kind !== "ok" || answer === undefined) throw new Error("no answer");
      checkShape("orca orchestration worker-show --full --json", answer, "unknown", "read");
    } catch {
      const said = typeof answer?.error?.message === "string" ? ` Orca said: ${answer.error.message}` : "";
      throw new HelperError(`\`orca orchestration worker-show\` did not give a readable answer.${said}`, EXIT.toolFailed);
    }
    const status = answer.result?.dispatch?.status;
    const verdict = answer.result?.projection?.liveness?.verdict;
    if (status === "completed" || status === "failed" || (status === "dispatched" && (verdict === "exited" || verdict === "lost"))) {
      return printReport(record, where, io);
    }
    const wait = answer.result?.observation?.agentWait;
    if (typeof wait === "object" && wait !== null) {
      io.stdout("The helper waits on a question that only a person can answer. Answer it in Orca, then run `cstack helper wait` again.\n");
      return HELPER_EXIT_PENDING;
    }
    const left = deadline - deps.now().getTime();
    if (left <= 0) {
      io.stdout("The helper is still working. Orca wakes the conversation when its report arrives. Run `cstack helper wait` again to keep waiting.\n");
      return HELPER_EXIT_PENDING;
    }
    const timeout = Math.min(left, CHECK_MAX_MS);
    const started = deps.now().getTime();
    await callOrca(deps.createRunner(timeout + CHECK_GRACE_MS), deps.env, ["orchestration", "check", "--peek", "--wait", "--types", "worker_done", "--timeout-ms", String(timeout)]);
    const took = deps.now().getTime() - started;
    if (took < MIN_TURN_MS) await deps.sleep(MIN_TURN_MS - took);
  }
}
