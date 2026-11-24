import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Step } from "../guide-steps.js";
import { localTime } from "../local-time.js";
import { PHASES, PLANNING_PHASES, type PhaseName } from "../phases.js";
import { listUnitCommits } from "../plan/commits.js";
import type { PlanUnit } from "../plan/read.js";
import { isDone } from "../run-progress.js";
import type { RunState } from "../run-state.js";
import type { Call, Launch } from "./calls.js";
import type { Conditions } from "./conditions.js";
import { matchesStep, split, stepWords } from "./match.js";
import { GIT_ACTIONS, recordTime, whyTime } from "./records.js";

export type Verdict = "done" | "skipped" | "out of order";
export type Evidence = "session" | "run state" | "git";
export type Line = { text: string; verdict: Verdict; time?: number; record?: Evidence };

/** Writes a line as the audit prints it. A skipped line ends after the verdict. */
export function formatLine(line: Line): string {
  if (line.verdict === "skipped" || line.time === undefined) return `${line.text}: ${line.verdict}`;
  return `${line.text}: ${line.verdict} ${localTime(new Date(line.time))} ${line.record}`;
}

const parse = (value: unknown): number | undefined => {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? undefined : time;
};

/** The first call at or after the floor is done. When every call comes before the floor, the latest one is out of order. */
function chooseCall(times: number[], floor: number | undefined): { verdict: "done" | "out of order"; time: number } | undefined {
  const first = times.find((time) => floor === undefined || time >= floor);
  if (first !== undefined) return { verdict: "done", time: first };
  if (times.length > 0) return { verdict: "out of order", time: times[times.length - 1]! };
  return undefined;
}

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
      const chosen = chooseCall(calls.filter((call) => matchesStep(words, call.args)).map((call) => call.time), floor);
      if (chosen) line = { text, ...chosen, record: "session" };
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

export type StepInput = {
  guides: Record<string, Step[]>;
  units: PlanUnit[];
  calls: Call[];
  /** The launches of sub-agents. */
  launches: Launch[];
  /** The indexes of the session files of the main conversation. */
  mainFiles: Set<number>;
  state: RunState;
  /** The lines of `evaluatePhases()`. */
  phaseLines: Line[];
  runFolder: string;
  root: string;
  targetBranch: string;
  conditions: Conditions;
  /** The `review.agent` setting. An Orca worker launch proves the independent review when it is not `claude`. */
  reviewAgent: string;
};

type Node = { id: string; phase: PhaseName; text: string; words: string[]; unit?: number; before: string[]; helper?: string; action?: string };

const IMPLEMENTER = "resolve-issue:implementer";
const ESCALATION = "resolve-issue:implementer-escalation";
const UNIT_CALLS = ["red", "green", "commit"].map((word) => stepWords(`unit ${word} <n>`));
const REPEATED = ["each-unit", "each-unit-with-test"];
type Kind = "unit" | "ticket" | "single" | "helper" | "git";

// Which group a listed step joins, or undefined when its condition does not hold for this plan.
function kindOf(step: Step, conditions: Conditions): Kind | undefined {
  if (step.kind === "action") {
    const proved = (GIT_ACTIONS as readonly string[]).includes(step.action);
    return proved && step.condition === "big-decision" && conditions.bigDecision ? "git" : undefined;
  }
  const once: Kind = step.kind === "helper" ? "helper" : "single";
  if (step.condition === undefined) return once;
  if (REPEATED.includes(step.condition)) return "unit";
  if (step.condition === "each-dependent-ticket") return conditions.dependentTickets > 0 ? "ticket" : undefined;
  if (step.condition === "user-interface") return conditions.userInterface ? once : undefined;
  if (step.condition === "new-structural-decision") return conditions.newStructuralDecision ? once : undefined;
  if (step.condition === "big-decision") return conditions.bigDecision ? once : undefined;
  return undefined;
}

// The listed steps of one guide as nodes, in the order they print, each with the nodes that must precede it.
// `late` holds the units that were built after the build phase closed.
function nodesOf(phase: PhaseName, steps: Step[], units: PlanUnit[], late: Set<number>, conditions: Conditions): Node[] {
  const segments: { kind: Kind; steps: Step[] }[] = [];
  for (const step of steps) {
    const kind = kindOf(step, conditions);
    if (kind === undefined) continue;
    const last = segments[segments.length - 1];
    if (kind !== "single" && kind !== "git" && last && last.kind === kind) last.steps.push(step);
    else segments.push({ kind, steps: [step] });
  }
  const nodes: Node[] = [];
  let tail: string[] = [];
  segments.forEach((segment, index) => {
    const make = (step: Step, id: string, unit: number | undefined, before: string[]): Node => {
      if (step.kind === "helper") {
        const name = step.word === undefined ? step.helper : `${step.helper} ${step.word}`;
        return { id, phase, text: unit === undefined ? name : `${name} for unit ${unit}`, words: [], unit, before, helper: step.helper };
      }
      const text = (step as { command: string }).command;
      const shown = unit === undefined ? text : text.replace(/<n>(?!\.\.\.)/g, String(unit));
      return { id, phase, text: shown, words: stepWords(text), unit, before };
    };
    if (segment.kind === "git") {
      // A git node has no floor and leaves the floor of the steps after it as it was.
      const step = segment.steps[0] as { action: string };
      nodes.push({ id: `${phase}:${index}`, phase, text: step.action, words: [], before: [], action: step.action });
      return;
    }
    if (segment.kind === "single") {
      const node = make(segment.steps[0]!, `${phase}:${index}`, undefined, tail);
      nodes.push(node);
      tail = [node.id];
      return;
    }
    if (segment.kind === "helper") {
      // The steps of a helper group are not ordered among themselves.
      const group = segment.steps.map((step, position) => make(step, `${phase}:${index}:${position}`, undefined, tail));
      nodes.push(...group);
      tail = group.map((node) => node.id);
      return;
    }
    if (segment.kind === "ticket") {
      const next: string[] = [];
      for (let ticket = 0; ticket < conditions.dependentTickets; ticket++) {
        let previous: string[] = tail;
        for (const [position, step] of segment.steps.entries()) {
          const node = make(step, `${phase}:${index}:${position}:t${ticket}`, undefined, previous);
          nodes.push(node);
          previous = [node.id];
        }
        next.push(previous[0]!);
      }
      tail = next;
      return;
    }
    const next: string[] = [];
    for (const unit of units) {
      let previous: string[] = tail;
      for (const [position, step] of segment.steps.entries()) {
        if (step.condition === "each-unit-with-test" && !unit.test) continue;
        const node = make(step, `${phase}:${index}:${position}:${unit.number}`, unit.number, previous);
        nodes.push(node);
        previous = [node.id];
      }
      // A unit built after the build phase does not hold back the steps that follow its group.
      if (previous !== tail && !late.has(unit.number)) next.push(previous[0]!);
    }
    // With no unit left to hold them back, the steps after the group keep the floor of the steps before it.
    if (next.length > 0) tail = next;
  });
  return nodes;
}

/** The step lines of every phase, in the order of `PHASES` and of each block. */
export function evaluateSteps(input: StepInput): Line[] {
  const closes = PHASES.map(({ name }) => input.phaseLines.find((line) => line.text === `phase ${name}` && line.verdict !== "skipped")?.time);
  let unitCommits: Record<number, string[]> | undefined;
  const commitTime = (unit: number): number | undefined => {
    if (unitCommits === undefined) {
      try {
        unitCommits = listUnitCommits(input.root, input.targetBranch).units;
      } catch {
        unitCommits = {};
      }
    }
    const hash = unitCommits[unit]?.[unitCommits[unit]!.length - 1];
    if (hash === undefined) return undefined;
    const shown = spawnSync("git", ["show", "-s", "--format=%aI", hash], { cwd: input.root, encoding: "utf8" });
    return shown.status === 0 ? parse(shown.stdout.trim()) : undefined;
  };
  const savedTime = (unit: number, kind: "red" | "green"): number | undefined => {
    try {
      return parse((JSON.parse(readFileSync(join(input.runFolder, "units", String(unit), `${kind}.json`), "utf8")) as { time?: unknown }).time);
    } catch {
      return undefined;
    }
  };
  const otherEvidence = (node: Node): { time: number; record: Evidence } | undefined => {
    const { head, flags } = split(node.words);
    const found = (time: number | undefined, record: Evidence) => (time === undefined ? undefined : { time, record });
    if (node.unit !== undefined && head[0] === "unit" && head[2] === "<n>" && head.length === 3) {
      if (head[1] === "red" || head[1] === "green") return found(savedTime(node.unit, head[1]), "run state");
      if (head[1] === "commit") return found(commitTime(node.unit), "git");
    }
    if (head.length === 1 && head[0] === "next") {
      const at = flags.indexOf("--done");
      const phase = at < 0 ? undefined : flags[at + 1];
      const name = PHASES.find((candidate) => candidate.name === phase)?.name;
      if (name !== undefined && isDone(input.state, name)) return found(parse(input.state.phases[name]?.doneAt), "run state");
    }
    return undefined;
  };

  // The time a unit was built: its commit call, else its saved failing run, else its commit in git.
  const commitWords = stepWords("unit commit <n>");
  const buildTime = (unit: number): number | undefined =>
    input.calls.find((call) => matchesStep(commitWords, call.args, unit))?.time ?? savedTime(unit, "red") ?? commitTime(unit);
  const buildClose = closes[PHASES.findIndex((phase) => phase.name === "build")];
  const builtAt = new Map<number, number>();
  if (buildClose !== undefined) {
    for (const { number } of input.units) {
      const time = buildTime(number);
      if (time !== undefined && time > buildClose) builtAt.set(number, time);
    }
  }
  const late = new Set(builtAt.keys());

  const lines: Line[] = [];
  const results = new Map<string, number | undefined>();
  // A call serves one line of the audit only.
  const taken = new Set<Call>();
  const takenLaunches = new Set<Launch>();
  const helperLines: Line[] = [];
  PHASES.forEach(({ name }, index) => {
    const earlier = closes.slice(0, index).reverse().find((time) => time !== undefined);
    const later = closes.slice(index + 1).find((time, offset) => time !== undefined && PHASES[index + 1 + offset]!.runsIn === PHASES[index]!.runsIn);
    const planning = PLANNING_PHASES.includes(name);
    const mainOnly = PHASES[index]!.runsIn === "main conversation";
    const phaseCalls = mainOnly ? input.calls.filter((call) => input.mainFiles.has(call.file)) : input.calls;
    const phaseLaunches = mainOnly ? input.launches.filter((launch) => input.mainFiles.has(launch.file)) : input.launches;
    for (const node of nodesOf(name, input.guides[name] ?? [], input.units, late, input.conditions)) {
      const floors = node.before.map((id) => results.get(id)).filter((time): time is number => time !== undefined);
      const floor = floors.length === 0 ? undefined : Math.max(...floors);
      const text = `${name}: ${node.text}`;
      if (node.action !== undefined) {
        // WHY: ADR-RQG-C, section "How the audit checks the big decisions".
        // Only git proves these two lines, and a record or a comment is often written in the build phase, so they take no part in the order of the phase.
        const found =
          node.action === "write-decision-record"
            ? input.conditions.recordFiles.length === 0
              ? "none"
              : recordTime(input.root, input.targetBranch, input.conditions.recordFiles)
            : whyTime(input.root, input.targetBranch, input.conditions.recordNames);
        if (found === "none") continue;
        lines.push(found === undefined ? { text, verdict: "skipped" } : { text, verdict: "done", time: found, record: "git" });
        continue;
      }
      // A step of a late unit is looked for until the close of the phase that built the unit, or with no end.
      const builtTime = node.unit === undefined ? undefined : builtAt.get(node.unit);
      const end = builtTime === undefined ? later : closes.find((time) => time !== undefined && time >= builtTime);
      if (node.helper !== undefined) {
        // WHY: ADR-RQG-C, section "How the audit ties an implementer to its unit".
        // A helper line of a unit takes only a launch whose own transcript holds a call of that unit, so one implementer never proves the line of another unit.
        const builtBy = (launch: Launch): boolean =>
          node.unit === undefined ||
          (launch.kind === "sub-agent" &&
            launch.transcript !== undefined &&
            input.calls.some((call) => call.file === launch.transcript && UNIT_CALLS.some((words) => matchesStep(words, call.args, node.unit))));
        const free = phaseLaunches.filter(
          (launch) =>
            !takenLaunches.has(launch) &&
            (launch.kind === "sub-agent"
              ? launch.type === node.helper || (node.unit !== undefined && node.helper === IMPLEMENTER && launch.type === ESCALATION)
              : node.helper === "resolve-issue:pr-reviewer" && input.reviewAgent !== "claude") &&
            builtBy(launch) &&
            (earlier === undefined || launch.time >= earlier) &&
            (end === undefined || launch.time <= end),
        );
        const picked = chooseCall(free.map((launch) => launch.time), floor);
        let helperLine: Line = { text, verdict: "skipped" };
        if (picked) {
          helperLine = { text, ...picked, record: "session" };
          takenLaunches.add(free.find((launch) => launch.time === picked.time)!);
        }
        results.set(node.id, helperLine.verdict === "skipped" ? floor : helperLine.time);
        helperLines.push(helperLine);
        continue;
      }
      const inWindow = phaseCalls.filter(
        (call) => !taken.has(call) && (earlier === undefined || call.time >= earlier) && (end === undefined || call.time <= end) && matchesStep(node.words, call.args, node.unit),
      );
      let line: Line = { text, verdict: "skipped" };
      const chosen = chooseCall(inWindow.map((call) => call.time), floor);
      if (chosen) {
        line = { text, ...chosen, record: "session" };
        taken.add(inWindow.find((call) => call.time === chosen.time)!);
      } else if (!planning) {
        const other = otherEvidence(node);
        const picked = other && chooseCall([other.time], floor);
        if (other && picked) line = { text, ...picked, record: other.record };
      }
      results.set(node.id, line.verdict === "skipped" ? floor : line.time);
      lines.push(line);
    }
  });
  return [...lines, ...helperLines];
}
