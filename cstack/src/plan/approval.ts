import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { PlanFact, PlanRead } from "./read.js";

/** One message for each change to what the ticket fixes whose blocking question is missing or unanswered. */
export function changeProblems(plan: PlanRead): string[] {
  const problems: string[] = [];
  for (const change of plan.ticketChanges) {
    const question = plan.blockingQuestions.find((q) => q.number === change.question);
    const where = `The change at line ${change.line} of the plan: blocking question ${change.question}`;
    if (!question) problems.push(`${where} does not exist.`);
    else if (question.open || question.answer.trim() === "") problems.push(`${where} has no answer yet.`);
  }
  return problems;
}

/** One message for each negative criterion that no unit names on a `- Negative criterion <k>:` line. */
export function uncoveredCriteria(plan: PlanRead): string[] {
  const covered = new Set(plan.units.flatMap((unit) => unit.negativeCriteria.map((c) => c.criterion)));
  return plan.negativeCriteria
    .map((_, index) => index + 1)
    .filter((k) => !covered.has(k))
    .map((k) => `Negative criterion ${k} is covered by no unit. Add a \`- Negative criterion ${k}:\` line to the unit whose test proves it.`);
}

function realDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === date;
}

/** One message for each fact whose source is not a real date, or not a real line of a real file inside the repository. */
export function factProblems(root: string, facts: PlanFact[]): string[] {
  const problems: string[] = [];
  for (const fact of facts) {
    const where = `The fact at line ${fact.line} of the plan:`;
    const source = fact.source;
    if (source.kind === "user") {
      if (!realDate(source.date)) problems.push(`${where} its user source has no real date in the form YYYY-MM-DD.`);
      continue;
    }
    const unreadable = `${where} the file \`${source.path}\` cannot be read.`;
    let message: string | undefined;
    try {
      message = fileProblem(root, where, source);
    } catch {
      message = unreadable;
    }
    if (message) problems.push(message);
  }
  return problems;
}

function fileProblem(root: string, where: string, source: { path: string; line: number; quote: string }): string | undefined {
  if (source.quote.trim() === "") return `${where} its quoted text holds only spaces.`;
  const unreadable = `${where} the file \`${source.path}\` cannot be read.`;
  let real: string;
  try {
    real = realpathSync(resolve(realpathSync(root), source.path));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? `${where} the file \`${source.path}\` does not exist.` : unreadable;
  }
  if (!statSync(real).isFile()) return `${where} \`${source.path}\` is not a regular file.`;
  const lines = readFileSync(real, "utf8").split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  if (lines.length < source.line) return `${where} the file \`${source.path}\` ends before line ${source.line}.`;
  if (!lines[source.line - 1]!.trim().includes(source.quote.trim())) {
    return `${where} line ${source.line} of \`${source.path}\` does not hold the quoted text.`;
  }
  return undefined;
}
