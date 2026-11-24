import type { PlanRead } from "./read.js";

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
