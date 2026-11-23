import { localTime } from "../local-time.js";
import { PHASES, PLANNING_PHASES } from "../phases.js";
import { isDone } from "../run-progress.js";
import type { RunState } from "../run-state.js";
import type { Call } from "./calls.js";
import { matchesStep, stepWords } from "./match.js";

export type Verdict = "done" | "skipped" | "out of order";
export type Evidence = "session" | "run state" | "git";
export type Line = { text: string; verdict: Verdict; time?: number; record?: Evidence };

/** Writes a line as the audit prints it. A skipped line ends after the verdict. */
export function formatLine(line: Line): string {
  if (line.verdict === "skipped" || line.time === undefined) return `${line.text}: ${line.verdict}`;
  return `${line.text}: ${line.verdict} ${localTime(new Date(line.time))} ${line.record}`;
}

const parse = (value: string | undefined): number | undefined => {
  const time = value === undefined ? NaN : Date.parse(value);
  return Number.isNaN(time) ? undefined : time;
};

/** The start line and the phase line of every phase, in the order of `PHASES`. */
export function evaluatePhases(state: RunState, calls: Call[]): Line[] {
  const lines: Line[] = [];
  let floor: number | undefined;
  for (const { name } of PHASES) {
    if (!PLANNING_PHASES.includes(name)) {
      const startedAt = parse(state.phases[name]?.startedAt);
      lines.push(
        startedAt === undefined
          ? { text: `phase ${name} started`, verdict: "skipped" }
          : { text: `phase ${name} started`, verdict: "done", time: startedAt, record: "run state" },
      );
    }
    const text = `phase ${name}`;
    let line: Line = { text, verdict: "skipped" };
    if (PLANNING_PHASES.includes(name)) {
      const words = stepWords(`next --done ${name}`);
      const matching = calls.filter((call) => matchesStep(words, call.args));
      const first = matching.find((call) => floor === undefined || call.time >= floor);
      if (first) line = { text, verdict: "done", time: first.time, record: "session" };
      else if (matching.length > 0) line = { text, verdict: "out of order", time: matching[matching.length - 1]!.time, record: "session" };
    } else {
      const doneAt = parse(state.phases[name]?.doneAt);
      if (doneAt !== undefined && isDone(state, name)) {
        line = { text, verdict: floor !== undefined && doneAt < floor ? "out of order" : "done", time: doneAt, record: "run state" };
      }
    }
    if (line.verdict !== "skipped") floor = line.time;
    lines.push(line);
  }
  return lines;
}
