import type { UnitCommits } from "./plan/commits.js";
import { changeProblems } from "./plan/approval.js";
import type { PlanRead, SectionName } from "./plan/read.js";

export type PhaseName =
  | "ticket"
  | "dependencies"
  | "code-map"
  | "questions"
  | "plan"
  | "build"
  | "review"
  | "independent-review"
  | "update-branch"
  | "document"
  | "briefing"
  | "after-build-questions"
  | "ready"
  | "retro"
  | "publish";

/** What a start condition or a done check can see. */
export interface PhaseContext {
  plan: PlanRead;
  commits: UnitCommits;
  /** ISO time at which each phase was last marked done. */
  doneAt: Partial<Record<PhaseName, string>>;
  /** ISO time of the last accepted done report of the executor. */
  lastAcceptedDoneReportAt?: string;
}

/** A check returns the missing parts. An empty list means it passes. */
export type PhaseCheck = (context: PhaseContext) => string[];

export interface Phase {
  name: PhaseName;
  /** The phase of today's skill that this phase replaces. */
  today: string;
  runsIn: "main conversation" | "executor";
  dependsOn: PhaseName[];
  start?: PhaseCheck;
  done?: PhaseCheck;
  /** What cstack writes in the plan file when the phase is done. #15 performs the writes. */
  writes?: string[];
}

const filled =
  (...names: SectionName[]): PhaseCheck =>
  ({ plan }) =>
    names
      .filter((name) => !plan.sections.find((section) => section.name === name)?.filled)
      .map((name) => `${name} is not filled.`);

// The Ticket section always holds the heading "Decisions already taken upstream",
// so a heading alone must not count as a copied ticket.
export const ticketCopied: PhaseCheck = ({ plan }) =>
  (plan.sections.find((section) => section.name === "Ticket")?.bodyLines ?? 0) > 0
    ? []
    : ["Ticket is not filled."];

export const noOpenQuestion: PhaseCheck = ({ plan }) =>
  plan.blockingQuestions.filter((q) => q.open).map((q) => `Blocking question ${q.number} is still open.`);

const planDone: PhaseCheck = (context) => {
  const { plan } = context;
  const missing = noOpenQuestion(context);
  if (plan.header.Status !== "approved") missing.push("Status is not `approved`.");
  if (plan.units.length === 0) missing.push("The plan has no unit.");
  missing.push(...changeProblems(plan));
  return missing;
};

export const buildDone = ({ plan, commits }: Pick<PhaseContext, "plan" | "commits">): string[] =>
  plan.units
    .filter((unit) => unit.blocked === undefined && !commits.units[unit.number]?.length)
    .map((unit) => `Unit ${unit.number} has no commit with its trailer and no Blocked line.`);

const publishStart: PhaseCheck = ({ doneAt, lastAcceptedDoneReportAt }) => {
  if (!doneAt.retro) return ["The retro phase is not done."];
  if (lastAcceptedDoneReportAt && Date.parse(doneAt.retro) <= Date.parse(lastAcceptedDoneReportAt)) {
    return ["The retro phase was done before the last accepted done report. Do it again."];
  }
  return [];
};

const phase = (
  name: PhaseName,
  today: string,
  runsIn: Phase["runsIn"],
  dependsOn: PhaseName[],
  extra: Partial<Pick<Phase, "start" | "done" | "writes">> = {},
): Phase => ({ name, today, runsIn, dependsOn, ...extra });

const MAIN = "main conversation";
const EXEC = "executor";

export const PHASES: readonly Phase[] = [
  phase("ticket", "0 and 1", MAIN, [], { done: ticketCopied, writes: ["Written by"] }),
  phase("dependencies", "2", MAIN, ["ticket"], { done: filled("Dependencies") }),
  phase("code-map", "3", MAIN, ["dependencies"], { done: filled("Code mapping") }),
  phase("questions", "4", MAIN, ["code-map"], { done: filled("Blocking questions") }),
  phase("plan", "5", MAIN, ["questions"], { start: noOpenQuestion, done: planDone, writes: ["Approved at"] }),
  phase("build", "6", EXEC, ["plan"], { done: buildDone }),
  phase("review", "7", EXEC, ["build"], { done: filled("Review log") }),
  phase("independent-review", "8", EXEC, ["review"]),
  phase("update-branch", "9", EXEC, ["independent-review"]),
  phase("document", "10.3", EXEC, ["update-branch"], { done: filled("Documentation") }),
  phase("briefing", "10.1", EXEC, ["document"], { done: filled("Briefing") }),
  phase("after-build-questions", "10.2", EXEC, ["briefing"], { done: filled("Non-blocking questions") }),
  phase("ready", "10.4", EXEC, ["after-build-questions"], {
    start: noOpenQuestion,
    done: filled("Pull request", "Executor notes"),
    writes: ["Status: ready for review", "Ready for review at"],
  }),
  phase("retro", "11", MAIN, []),
  phase("publish", "12", EXEC, ["ready", "retro"], { start: publishStart }),
];

export const PLANNING_PHASES: readonly PhaseName[] = ["ticket", "dependencies", "code-map", "questions", "plan"];

const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** Checks a phase list and returns its problems. An empty list means it is sound. */
export function checkPhaseList(phases: readonly Phase[]): string[] {
  const problems: string[] = [];
  const index = new Map(phases.map((p, i) => [p.name as string, i]));
  for (const [i, p] of phases.entries()) {
    if (!NAME.test(p.name)) problems.push(`"${p.name}" is not a valid file name for a phase.`);
    if (index.get(p.name) !== i) problems.push(`The phase "${p.name}" appears twice.`);
    for (const dep of p.dependsOn) {
      const at = index.get(dep);
      if (at === undefined) problems.push(`"${p.name}" depends on the unknown phase "${dep}".`);
      else if (at >= i) problems.push(`"${p.name}" depends on "${dep}", which does not come before it.`);
    }
  }
  const state = new Map<string, "open" | "done">();
  const visit = (name: string): boolean => {
    if (state.get(name) === "open") return true;
    if (state.get(name) === "done") return false;
    state.set(name, "open");
    const cyclic = (phases[index.get(name) ?? -1]?.dependsOn ?? []).some(visit);
    state.set(name, "done");
    return cyclic;
  };
  if (phases.some((p) => visit(p.name))) problems.push("The dependencies of the phases make a cycle.");
  const briefing = phases.find((p) => p.name === "briefing");
  if (briefing && !briefing.dependsOn.includes("document")) {
    problems.push('"briefing" must depend on "document", so that the briefing can say where the work was documented.');
  }
  return problems;
}
