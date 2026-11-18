import { homedir } from "node:os";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { readMoments } from "../measure/moments.js";
import { measureSessions, type Totals } from "../measure/sessions.js";

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
  let parsed: ReturnType<typeof parseArgs<{ options: { home: { type: "string" } }; allowPositionals: true }>>;
  try {
    parsed = parseArgs({
      args,
      options: { home: { type: "string" } },
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    io.stderr(`cstack measure: ${error instanceof Error ? error.message : String(error)}\n${MEASURE_USAGE}\n`);
    return 2;
  }
  const [plan, ...extra] = parsed.positionals;
  if (plan === undefined || extra.length > 0) {
    io.stderr(`cstack measure: give exactly one plan file.\n${MEASURE_USAGE}\n`);
    return 2;
  }
  const moments = await readMoments(plan);
  const end = moments.ready ?? new Date();
  const result = await measureSessions(parsed.values.home ?? homedir(), moments.root, moments.approval, end);
  const lines = [
    `main sessions: ${result.mainSessions}`,
    `helper transcripts: ${result.helperTranscripts}`,
    ...totalLines("", result.totals),
  ];
  const models = [...result.perModel.keys()].sort((a, b) =>
    a === "other model" ? 1 : b === "other model" ? -1 : a < b ? -1 : a > b ? 1 : 0,
  );
  for (const model of models) lines.push(...totalLines(` ${model}`, result.perModel.get(model) as Totals));
  if (moments.ready) {
    const minutes = Math.round((moments.ready.getTime() - moments.approval.getTime()) / 60000);
    lines.push(`minutes from approval to ready for review: ${minutes}`);
  }
  lines.push(`skipped lines: ${result.skippedLines}`, `unreadable files: ${result.unreadableFiles}`);
  io.stdout(`${lines.join("\n")}\n`);
  if (result.mainSessions === 0) {
    io.stderr("cstack measure: no main session of this run was found.\n");
    return 1;
  }
  return 0;
}
