// WHY: the report text is external input. It is checked and saved as JSON, and it reaches Orca only as the path of the saved file, never as an argument.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { parseAnswer } from "../orca/answer.js";
import { callOrca } from "../orca/call.js";
import type { Runner } from "../orca/run.js";
import { checkShape, ShapeError } from "../orca/shapes.js";
import { parseVersion } from "../orca/version.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan } from "../plan/read.js";
import { checkReport, saveReport, saveUnitReport } from "../report/reports.js";
import { runFolder, type SavedReport } from "../run-state.js";
import { HelperError, readRecord, updateRecord, type HelperRecord } from "./record.js";

export interface DoneDeps {
  cwd: string;
  env: Record<string, string | undefined>;
  createRunner: (timeoutMs: number) => Runner;
  now: () => Date;
}

export interface DoneRequest {
  kind: string;
  helper: string;
  text: string;
  plan: string | undefined;
}

const CALL_TIMEOUT_MS = 30_000;
const HANDLE = /^term_[A-Za-z0-9-]+$/;

function readSavedKind(file: string): string {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    const kind = typeof value === "object" && value !== null ? (value as { kind?: unknown }).kind : undefined;
    if (typeof kind === "string") return kind;
  } catch {
    // Handled below.
  }
  throw new HelperError(`The saved report ${file} cannot be read, so cstack cannot tell its kind.`, EXIT.refused);
}

/** Reads the task id of the Dispatch, then sends the `worker_done` message. Throws a HelperError with exit code 5 on any failure. */
async function sendReport(record: HelperRecord, kind: string, file: string, deps: DoneDeps): Promise<void> {
  const again = `The report is saved in ${file}. Run the same \`cstack helper done\` command once more to send it.`;
  const call = (args: string[]) => callOrca(deps.createRunner(CALL_TIMEOUT_MS), deps.env, args);
  const fail = async (command: string, error: unknown, answer?: { error?: { message?: unknown } }): Promise<never> => {
    let detail = typeof answer?.error?.message === "string" ? ` Orca said: ${answer.error.message}` : "";
    if (error instanceof ShapeError) {
      const version = await call(["--version"]);
      detail = ` ${error.message.replace("(Orca unknown)", `(Orca ${(version.kind === "ok" && parseVersion(version.stdout)) || "unknown"})`)}`;
    }
    throw new HelperError(`\`${command}\` did not work.${detail} ${again}`, EXIT.toolFailed);
  };

  const showArgs = ["orchestration", "worker-show", "--dispatch", record.dispatchId ?? "", "--full"];
  const shown = await call(showArgs);
  const shownAnswer = parseAnswer<{ ok?: unknown; result?: unknown; error?: { message?: unknown } }>(shown);
  let taskId: string;
  try {
    if (shown.kind !== "ok" || shownAnswer === undefined) throw new Error("no answer");
    checkShape("orca orchestration worker-show --full --json", shownAnswer, "unknown", "read");
    taskId = (shownAnswer as { result: { dispatch: { taskId: string } } }).result.dispatch.taskId;
  } catch (error) {
    return fail("orca orchestration worker-show", error, shownAnswer);
  }

  const handle = deps.env["ORCA_TERMINAL_HANDLE"];
  const outcome = kind === "failed" || kind === "stuck" ? "failed" : "succeeded";
  const sent = await call([
    "orchestration", "send",
    "--type", "worker_done",
    "--outcome", outcome,
    "--report-path", file,
    "--subject", `${record.role} report`,
    "--task-id", taskId,
    "--dispatch-id", record.dispatchId ?? "",
    ...(handle !== undefined && HANDLE.test(handle) ? ["--from", handle] : []),
  ]);
  const sentAnswer = parseAnswer<{ ok?: unknown; result?: unknown; error?: { message?: unknown } }>(sent);
  try {
    if (sent.kind !== "ok" || sentAnswer === undefined) throw new Error("no answer");
    checkShape("orca orchestration send --json", sentAnswer, "unknown", "write");
    if (sentAnswer.ok !== true) throw new Error("refused");
  } catch (error) {
    return fail("orca orchestration send", error, sentAnswer);
  }
}

const MAX_LISTED = 20;

// A file name written in a message: control characters are escaped, so a terminal escape cannot get through.
const shown = (name: string) => name.replace(/\p{Cc}/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const shellQuote = (name: string) => `'${shown(name).replaceAll("'", "'\\''")}'`;

/**
 * Lists what `cstack unit collect` would refuse to leave in a child worktree: the same git status, and the same exception for the plan file.
 * Throws a HelperError with exit code 1 when files remain, and with exit code 5 when git cannot read the folder.
 */
function checkChildWorktree(folder: string, planFile: string, unitFiles: string[], unit: number | undefined): void {
  const status = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all", "--no-renames"], { cwd: folder, encoding: "utf8" });
  if (status.error !== undefined || status.status !== 0) {
    const why = status.error?.message ?? status.stderr.trim();
    throw new HelperError(`git cannot read the child worktree ${folder}, so cstack cannot check it: ${why} The report is not saved.`, EXIT.toolFailed);
  }
  const entries = status.stdout.split("\0").filter((entry) => entry !== "").map((entry) => ({ code: entry.slice(0, 2), file: entry.slice(3) }));
  const stray = entries.filter((entry) => entry.file !== planFile);
  if (stray.length === 0) return;
  const lines = stray.slice(0, MAX_LISTED).map(({ code, file }) => {
    if (unitFiles.includes(file)) {
      return `- ${shown(file)}: it belongs to the unit. Commit it with \`cstack unit commit ${unit} --message "<subject>"\`, or undo it.`;
    }
    return code === "??" ? `- ${shown(file)}: run \`rm -- ${shellQuote(file)}\`.` : `- ${shown(file)}: run \`git restore -- ${shellQuote(file)}\`.`;
  });
  const more = stray.length > MAX_LISTED ? [`There are ${stray.length - MAX_LISTED} more.`] : [];
  throw new HelperError(
    [
      `The child worktree ${folder} has uncommitted files, and \`cstack unit collect\` would keep it. The report is not saved.`,
      ...lines,
      ...more,
      "A file that git ignores can stay. Fix the files above, then run this command again.",
    ].join("\n"),
    EXIT.refused,
  );
}

export async function doneHelper(request: DoneRequest, io: Io, deps: DoneDeps): Promise<number> {
  const located = locatePlan(deps.cwd, request.plan);
  const where = { root: located.root, planFile: located.relative };
  const runDir = runFolder(located.root, located.relative);
  const record = readRecord(runDir, request.helper);

  if (record.report !== undefined) {
    if (record.mode !== "orca-worker" || record.sent !== false) {
      throw new HelperError(`The helper ${record.id} already has an accepted report, saved in ${record.report}. One helper has only one report.`, EXIT.refused);
    }
    // The saved report decides the kind, so a stuck or failed report never goes out as succeeded.
    const saved = readSavedKind(record.report);
    await sendReport(record, saved, record.report, deps);
    updateRecord(runDir, record.id, { sent: true });
    io.stdout(`The report in ${record.report} was sent.\n`);
    return 0;
  }

  const unit = record.unit ?? undefined;
  if (record.worktree !== undefined && request.kind === "done") {
    const planned = readPlan(readFileSync(located.path, "utf8")).units.find((u) => u.number === unit);
    checkChildWorktree(record.worktree.path, located.relative, planned?.files ?? [], unit);
  }
  const reasons = checkReport({ role: record.role, kind: request.kind, text: request.text, ...(unit !== undefined ? { unit } : {}) }, where);
  if (reasons.length > 0) {
    io.stderr(`${reasons.join("\n")}\n`);
    return 1;
  }
  const file =
    unit === undefined
      ? saveReport(where, { kind: request.kind as SavedReport["kind"], text: request.text }, deps.now())
      : saveUnitReport(where, unit, { kind: request.kind as "done" | "stuck", text: request.text, helper: record.id }, deps.now());
  updateRecord(runDir, record.id, { report: file, sent: false });
  if (record.mode !== "orca-worker") {
    io.stdout(`The ${request.kind} report was accepted and saved in ${file}.\n`);
    return 0;
  }
  await sendReport(record, request.kind, file, deps);
  updateRecord(runDir, record.id, { sent: true });
  io.stdout(`The ${request.kind} report was accepted, saved in ${file} and sent.\n`);
  return 0;
}
