import type { PlanRead } from "../plan/read.js";

export interface Conditions {
  dependentTickets: number;
  userInterface: boolean;
  newStructuralDecision: boolean;
  bigDecision: boolean;
  recordFiles: string[];
  recordNames: string[];
}

interface Records {
  bigDecision: boolean;
  recordFiles: string[];
  recordNames: string[];
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

/** Reads the decision records that the lines of the `Documentation duties` section name. */
function records(planText: string, plan: PlanRead): Records {
  const result: Records = { bigDecision: false, recordFiles: [], recordNames: [] };
  const section = plan.sections.find((s) => s.name === "Documentation duties");
  if (!section) return result;
  const add = (list: string[], value: string): void => {
    if (!list.includes(value)) list.push(value);
  };
  for (const line of planText.split("\n").slice(section.first, section.last)) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const before = line.slice(0, colon);
    if (!/\badrs?\b|\bdecision records?\b/i.test(before)) continue;
    if (!/^\s*applies/i.test(line.slice(colon + 1))) continue;
    result.bigDecision = true;
    const files = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1]!).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      add(result.recordFiles, file);
      const base = file.slice(file.lastIndexOf("/") + 1);
      const name = (/^[A-Z0-9-]+/.exec(base)?.[0] ?? "").replace(/-+$/, "");
      add(result.recordNames, name !== "" ? name : before.replace(/^\s*[-*]\s+/, "").trim());
    }
    if (files.length === 0) add(result.recordNames, before.replace(/^\s*[-*]\s+/, "").trim());
  }
  return result;
}

/** Reads the facts that decide which conditional steps of a guide apply. It reads no file. */
export function readConditions(planText: string, plan: PlanRead): Conditions {
  const flat = planText.replace(/\s+/g, " ").toLowerCase();
  return {
    dependentTickets: dependentTickets(planText, plan),
    userInterface: plan.units.some((unit) => unit.designSpecification !== undefined),
    newStructuralDecision: !flat.includes(NO_NEW_DECISION),
    ...records(planText, plan),
  };
}
