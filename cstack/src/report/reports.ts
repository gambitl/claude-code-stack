// WHY: the done check refuses any uncommitted change, not only a change to the plan file. The executor hands the branch to a reviewer, and a review fix or a new file left in the worktree would never reach the pull request. A plan file that is modified, staged or untracked would also make the plan on the branch differ from the plan the report describes.
import { spawnSync } from "node:child_process";
import { closeSync, linkSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeSync } from "node:fs";
import { join } from "node:path";
import { buildDone, noOpenQuestion, ticketCopied, type PhaseContext } from "../phases.js";
import { listUnitCommits } from "../plan/commits.js";
import { DONE_REPORT_SECTIONS, readPlan, type PlanRead } from "../plan/read.js";
import { RunStateError, runFolder, writeFileAtomic, type PublishRecord, type SavedReport } from "../run-state.js";

export type Role = "executor" | "implementer" | "implementer-escalation";

export const EXECUTOR_KINDS = ["done", "needs-decision", "failed", "published"] as const;
export const IMPLEMENTER_KINDS = ["done", "stuck"] as const;

export const KINDS_BY_ROLE: Record<Role, readonly string[]> = {
  executor: EXECUTOR_KINDS,
  implementer: IMPLEMENTER_KINDS,
  "implementer-escalation": IMPLEMENTER_KINDS,
};

export interface Report {
  role: Role;
  kind: string;
  text: string;
  unit?: number;
}

/** `root` is the repository root. `planFile` is the plan path from that root. */
export interface Where {
  root: string;
  planFile: string;
}

const MAX_PATHS = 10;

function git(cwd: string, args: string[]) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

/** The paths that `git status` reports, so a file covered by `.gitignore` never counts. */
function changedPaths(root: string): string[] {
  const status = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (status.status !== 0) throw new RunStateError(`git status failed: ${status.stderr.trim()}`);
  const paths: string[] = [];
  const entries = status.stdout.split("\0").filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    paths.push(entry.slice(3));
    // A rename or a copy is followed by its old path.
    if (/[RC]/.test(entry.slice(0, 2))) i++;
  }
  return paths;
}

function readPublish(folder: string): PublishRecord | undefined {
  const path = join(folder, "publish.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new RunStateError(`The file ${path} cannot be read.`);
  }
  try {
    return JSON.parse(text) as PublishRecord;
  } catch {
    throw new RunStateError(`The file ${path} is not valid JSON.`);
  }
}

function checkExecutor(report: Report, where: Where, plan: PlanRead): string[] {
  const reasons: string[] = [];
  const text = report.text.trim();
  if (report.kind === "needs-decision" || report.kind === "failed") {
    if (!text) reasons.push(`A ${report.kind} report needs a text that is not empty.`);
  } else if (report.kind === "done") {
    const context: PhaseContext = {
      plan,
      commits: listUnitCommits(where.root, plan.header["Target branch"]),
      doneAt: {},
    };
    for (const name of DONE_REPORT_SECTIONS) {
      if (name === "Ticket") reasons.push(...ticketCopied(context));
      else if (!plan.sections.find((s) => s.name === name)?.filled) reasons.push(`${name} is not filled.`);
    }
    reasons.push(...buildDone(context));
    reasons.push(...noOpenQuestion(context));
    if (plan.header["Ready for review at"] === "not yet") reasons.push("Ready for review at is still `not yet`.");
    const changed = changedPaths(where.root);
    if (changed.length > 0) {
      const shown = changed.slice(0, MAX_PATHS).join(", ");
      const more = changed.length > MAX_PATHS ? `, and ${changed.length - MAX_PATHS} more` : "";
      reasons.push(`The worktree has uncommitted changes: ${shown}${more}. Commit them first.`);
    }
  } else if (report.kind === "published") {
    const publish = readPublish(runFolder(where.root, where.planFile));
    const last = publish?.pushes?.at(-1);
    const head = git(where.root, ["rev-parse", "HEAD"]).stdout.trim();
    if (!publish) reasons.push("publish.json is missing in the run folder.");
    else if (!publish.pullRequest?.trim()) reasons.push("publish.json has no pull request link.");
    if (publish && !last) reasons.push("publish.json has no push.");
    else if (last && last.commit !== head) reasons.push("The last push is not the current HEAD. Push again.");
  }
  return reasons;
}

function checkImplementer(report: Report, where: Where, plan: PlanRead): string[] {
  const unit = plan.units.find((u) => u.number === report.unit);
  if (report.unit === undefined || !unit) {
    return [`The report needs the number of a unit of the plan, and ${report.unit ?? "no unit"} is not one.`];
  }
  if (report.kind === "stuck") return report.text.trim() ? [] : ["A stuck report needs a text that is not empty."];
  const reasons: string[] = [];
  const commits = listUnitCommits(where.root, plan.header["Target branch"]);
  if (!commits.units[unit.number]?.length) reasons.push(`Unit ${unit.number} has no commit with Cstack-Unit: ${unit.number}.`);
  if (unit.test) {
    const red = join(runFolder(where.root, where.planFile), "units", String(unit.number), "red.json");
    try {
      readFileSync(red);
    } catch {
      reasons.push(`Unit ${unit.number} has a Test line, and its failing run (${red}) is not saved.`);
    }
  }
  return reasons;
}

/**
 * Returns every reason to refuse a report. An empty list means it is accepted.
 * It throws PlanFormatError or RunStateError (exit code 3) when the plan or the run cannot be read.
 */
export function checkReport(report: Report, where: Where): string[] {
  const allowed = KINDS_BY_ROLE[report.role];
  if (!allowed.includes(report.kind)) {
    return [`The kind ${report.kind} is not allowed for the role ${report.role}. Allowed kinds: ${allowed.join(", ")}.`];
  }
  const plan = readPlan(readFileSync(join(where.root, where.planFile), "utf8"));
  return report.role === "executor" ? checkExecutor(report, where, plan) : checkImplementer(report, where, plan);
}

const reportsFolder = (where: Where) => join(runFolder(where.root, where.planFile), "reports");

/** Writes `reports/<time>-<kind>.json`. It never replaces a report that exists. Returns the path. */
export function saveReport(where: Where, report: { kind: SavedReport["kind"]; text: string }, now = new Date()): string {
  const folder = reportsFolder(where);
  mkdirSync(folder, { recursive: true });
  const time = now.toISOString();
  const content = `${JSON.stringify({ kind: report.kind, text: report.text, time }, null, 2)}\n`;
  const temporary = join(folder, `.${process.pid}-${Date.now()}.tmp`);
  const fd = openSync(temporary, "wx");
  try {
    writeSync(fd, content);
  } finally {
    closeSync(fd);
  }
  try {
    const stem = `${time.replace(/:/g, "-")}-${report.kind}`;
    for (let counter = 0; ; counter++) {
      const target = join(folder, `${stem}${counter ? `-${counter + 1}` : ""}.json`);
      try {
        // A hard link fails when the name exists, so two saves at the same time never overwrite each other.
        linkSync(temporary, target);
        return target;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
  } finally {
    rmSync(temporary, { force: true });
  }
}

function readReports(where: Where): { path: string; report: SavedReport }[] {
  const folder = reportsFolder(where);
  let names: string[];
  try {
    names = readdirSync(folder).filter((name) => name.endsWith(".json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return names.sort().map((name) => {
    const path = join(folder, name);
    try {
      return { path, report: JSON.parse(readFileSync(path, "utf8")) as SavedReport };
    } catch {
      throw new RunStateError(`The report file ${path} is not valid JSON.`);
    }
  });
}

/** Returns the oldest report that was not shown yet, and marks it as shown. Returns nothing when there is none. */
export function takeOldestUnreadReport(where: Where): SavedReport | undefined {
  const unread = readReports(where)
    .filter(({ report }) => !report.readAt)
    .sort((a, b) => Date.parse(a.report.time) - Date.parse(b.report.time) || (a.path < b.path ? -1 : 1));
  const oldest = unread[0];
  if (!oldest) return undefined;
  const shown = { ...oldest.report, readAt: new Date().toISOString() };
  writeFileAtomic(oldest.path, `${JSON.stringify(shown, null, 2)}\n`);
  return shown;
}

/** The time of the latest saved done report, or nothing. */
export function lastAcceptedDoneReportAt(where: Where): string | undefined {
  return readReports(where)
    .filter(({ report }) => report.kind === "done")
    .map(({ report }) => report.time)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1);
}
