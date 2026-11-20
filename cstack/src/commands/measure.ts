import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { git, MomentsError, readMoments } from "../measure/moments.js";
import { measureSessions, type Totals } from "../measure/sessions.js";
import { parseWorktreeList } from "../wave/worktrees.js";

export const MEASURE_USAGE = "Usage: cstack measure <plan file> [--home <folder>]";

function totalLines(suffix: string, t: Totals): string[] {
  return [
    `input tokens${suffix}: ${t.input}`,
    `cache creation input tokens${suffix}: ${t.cacheCreation}`,
    `cache read input tokens${suffix}: ${t.cacheRead}`,
    `output tokens${suffix}: ${t.output}`,
  ];
}

export async function measure(args: string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: { home: { type: "string" } },
      strict: true,
      allowPositionals: true,
    });
  } catch {
    io.stderr(`cstack measure: the command line is wrong.\n${MEASURE_USAGE}\n`);
    return 2;
  }
  const [plan, ...extra] = parsed.positionals;
  if (plan === undefined || extra.length > 0) {
    io.stderr(`cstack measure: give exactly one plan file.\n${MEASURE_USAGE}\n`);
    return 2;
  }
  let moments;
  try {
    moments = await readMoments(plan);
  } catch (error) {
    if (!(error instanceof MomentsError)) throw error;
    io.stderr(`cstack measure: ${error.message}\n`);
    return 1;
  }
  let listed: string[];
  try {
    listed = parseWorktreeList(await git(moments.root, ["worktree", "list", "--porcelain"])).map((entry) => entry.path);
  } catch {
    io.stderr("cstack measure: git cannot list the worktrees of the repository.\n");
    return 1;
  }
  const worktrees = moments.worktrees.map((path) => (path.startsWith("~/") ? join(homedir(), path.slice(2)) : path));
  const end = moments.ready ?? new Date();
  const result = await measureSessions(parsed.values.home ?? homedir(), moments.root, moments.approval, end, listed, worktrees);
  const lines = [
    `main sessions: ${result.mainSessions}`,
    `helper transcripts: ${result.helperTranscripts}`,
    ...totalLines("", result.totals),
  ];
  const names = [...result.perModel.keys()];
  const models = [...names.filter((name) => name !== "other model").sort(), ...names.filter((name) => name === "other model")];
  for (const model of models) lines.push(...totalLines(` ${model}`, result.perModel.get(model) as Totals));
  const wait = moments.ready ? moments.ready.getTime() - moments.approval.getTime() : undefined;
  if (wait !== undefined && (moments.source === "header" || wait >= 60000)) {
    lines.push(`minutes from approval to ready for review: ${Math.round(wait / 60000)}`);
  }
  lines.push(`skipped lines: ${result.skippedLines}`, `unreadable files: ${result.unreadableFiles}`);
  io.stdout(`${lines.join("\n")}\n`);
  let code = 0;
  if (wait === undefined) {
    io.stderr("cstack measure: the plan file never reached ready for review, so the ready moment is missing.\n");
    code = 1;
  } else if (moments.source === "history" && wait < 60000) {
    io.stderr("cstack measure: the ready moment is less than a minute after the approval, so the history looks rewritten.\n");
    code = 1;
  }
  if (result.unreadableFiles > 0) {
    io.stderr("cstack measure: some files could not be read and were left out of the counts.\n");
    code = 1;
  }
  if (result.mainSessions === 0) {
    io.stderr("cstack measure: no main session of this run was found.\n");
    code = 1;
  }
  return code;
}
