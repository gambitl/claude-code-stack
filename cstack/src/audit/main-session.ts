import { basename } from "node:path";
import { PHASES } from "../phases.js";
import type { Call } from "./calls.js";
import { matchesStep, stepWords } from "./match.js";

const CLOSE_TICKET = stepWords("next --done ticket");
const EXECUTOR_START = stepWords("helper start executor");
const MAIN_ONLY = PHASES.filter((p) => p.runsIn === "main conversation").flatMap((p) => [
  stepWords(`next --done ${p.name}`),
  stepWords(`next --phase ${p.name}`),
]);

// The value of --plan or --plan=, or undefined when the call has none.
function planOf(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--plan") return args[i + 1];
    if (args[i].startsWith("--plan=")) return args[i].slice("--plan=".length);
  }
  return undefined;
}

// Finds the session files of the main conversation, from the calls alone.
export function mainFiles(calls: Call[], planFile: string): { files: Set<number>; fallback: boolean } {
  const name = basename(planFile);
  const planName = (c: Call) => {
    const p = planOf(c.args);
    return p === undefined ? undefined : basename(p);
  };
  const forThisPlan = (c: Call) => (planName(c) ?? name) === name;
  const notHelper = calls.filter((c) => !c.helper);
  const closed = notHelper.some(
    (c) => matchesStep(CLOSE_TICKET, c.args) && planName(c) === name,
  );
  if (!closed) return { files: new Set(notHelper.map((c) => c.file)), fallback: true };
  const files = new Set<number>();
  for (const c of notHelper) {
    if (!forThisPlan(c)) continue;
    if (MAIN_ONLY.some((s) => matchesStep(s, c.args)) || matchesStep(EXECUTOR_START, c.args)) files.add(c.file);
  }
  return { files, fallback: false };
}
