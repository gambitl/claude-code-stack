import type { PlanRead } from "../plan/read.js";

export interface Conditions {
  dependentTickets: number;
  userInterface: boolean;
  newStructuralDecision: boolean;
}

const NO_NEW_DECISION = "no new decision since the question round";

/** Counts the tickets that the last `Feeds:` line of the `Ticket` section names. */
function dependentTickets(planText: string, plan: PlanRead): number {
  const section = plan.sections.find((s) => s.name === "Ticket");
  if (!section) return 0;
  const lines = planText.split("\n").slice(section.first - 1, section.last);
  const feeds = lines.filter((line) => line.includes("Feeds:")).pop();
  if (feeds === undefined) return 0;
  return feeds
    .slice(feeds.indexOf("Feeds:") + "Feeds:".length)
    .split(",")
    .map((item) => item.replaceAll("**", "").trim())
    .filter((item) => item !== "" && item.toLowerCase() !== "none").length;
}

/** Reads the facts that decide which conditional steps of a guide apply. It reads no file. */
export function readConditions(planText: string, plan: PlanRead): Conditions {
  const flat = planText.replace(/\s+/g, " ").toLowerCase();
  return {
    dependentTickets: dependentTickets(planText, plan),
    userInterface: plan.units.some((unit) => unit.designSpecification !== undefined),
    newStructuralDecision: !flat.includes(NO_NEW_DECISION),
  };
}
