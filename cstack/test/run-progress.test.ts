import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PhaseName } from "../src/phases.js";
import { readPlan } from "../src/plan/read.js";
import {
  clearCurrentRun,
  isDone,
  markDone,
  markStarted,
  missingToStart,
  nextPhase,
  phaseContext,
} from "../src/run-progress.js";
import { RUN_FORMAT, createRun, currentRunPath, runFolder, writeCurrentRun, type RunState } from "../src/run-state.js";
import { commitPlan, makeRepo } from "./helpers/plan-repo.js";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures/plans", name), "utf8");
const T = (n: number) => `2026-11-19T0${n}:00:00.000Z`;

function state(done: Partial<Record<PhaseName, string>>): RunState {
  const phases: RunState["phases"] = {};
  for (const [name, doneAt] of Object.entries(done)) phases[name as PhaseName] = { doneAt };
  return { format: RUN_FORMAT, writtenBy: "0.0.0", plan: "docs/plans/full.md", phases };
}

const PLANNING = { ticket: T(1), dependencies: T(1), "code-map": T(1), questions: T(1), plan: T(1) };
const UP_TO_READY = {
  ...PLANNING,
  build: T(2),
  review: T(2),
  "independent-review": T(2),
  "update-branch": T(2),
  document: T(2),
  briefing: T(2),
  "after-build-questions": T(2),
};

describe("the retro rule", () => {
  it("does not count a retro done before ready", () => {
    const s = state({ ...UP_TO_READY, retro: T(3), ready: T(4) });
    expect(isDone(s, "retro")).toBe(false);
    expect(nextPhase(s)).toBe("retro");
  });
  it("counts a retro done after ready, and publish comes next", () => {
    const s = state({ ...UP_TO_READY, ready: T(4), retro: T(5) });
    expect(isDone(s, "retro")).toBe(true);
    expect(nextPhase(s)).toBe("publish");
  });
  it("counts a retro done while ready is not done", () => {
    expect(isDone(state({ retro: T(3) }), "retro")).toBe(true);
  });
  it("compares times as dates, not as strings", () => {
    const s = state({ ready: "2026-11-19T10:00:00+01:00", retro: "2026-11-19T09:30:00.000Z" });
    expect(isDone(s, "retro")).toBe(true);
  });
});

describe("nextPhase", () => {
  it("starts with ticket on an empty state", () => {
    expect(nextPhase(state({}))).toBe("ticket");
  });
  it("gives undefined when every phase is done", () => {
    const s = state({ ...UP_TO_READY, ready: T(4), retro: T(5), publish: T(6) });
    expect(nextPhase(s)).toBeUndefined();
  });
});

describe("missingToStart", () => {
  const plan = readPlan(fixture("approved.md"));
  const context = { plan, commits: { units: {}, invalid: [] }, doneAt: {} };

  it("names a dependency that is not done", () => {
    expect(missingToStart("briefing", state({}), context)).toEqual(["The phase document is not done."]);
  });
  it("names a stale retro for publish", () => {
    const s = state({ ...UP_TO_READY, retro: T(3), ready: T(4) });
    expect(missingToStart("publish", s, context)).toContain(
      "The phase retro was done before ready. Run cstack next --phase retro to do it again.",
    );
  });
  it("includes the open blocking question for plan", () => {
    const open = plan;
    const missing = missingToStart("plan", state({ questions: T(1) }), { ...context, plan: open });
    expect(missing).toEqual([expect.stringMatching(/^Blocking question \d+ is still open\.$/)]);
  });
});

describe("state.json writes", () => {
  it("marks started and done, keeping the other phases", () => {
    const repo = makeRepo();
    const planFile = commitPlan(repo, fixture("approved.md"));
    createRun(repo, planFile, readPlan(fixture("approved.md")));
    markStarted(repo, planFile, "build", new Date(T(2)));
    markDone(repo, planFile, "build", new Date(T(3)));
    const saved = JSON.parse(readFileSync(join(runFolder(repo, planFile), "state.json"), "utf8")) as RunState;
    expect(saved.phases.build).toEqual({ startedAt: T(2), doneAt: T(3) });
    expect(saved.phases.ticket?.doneAt).toBeDefined();
  });
  it("clearCurrentRun removes current-run and keeps the run folder", () => {
    const repo = makeRepo();
    const planFile = commitPlan(repo, fixture("approved.md"));
    createRun(repo, planFile, readPlan(fixture("approved.md")));
    writeCurrentRun(repo, planFile);
    clearCurrentRun(repo);
    expect(existsSync(currentRunPath(repo))).toBe(false);
    expect(existsSync(runFolder(repo, planFile))).toBe(true);
  });
});

describe("phaseContext", () => {
  it("reads the unit commits only when a check asks for them", () => {
    const repo = makeRepo();
    const plan = readPlan(fixture("approved.md"));
    const planFile = commitPlan(repo, fixture("approved.md"));
    const s = createRun(repo, planFile, { ...plan, header: { ...plan.header, "Target branch": "no-such-branch" } });
    const context = phaseContext(repo, planFile, { ...plan, header: { ...plan.header, "Target branch": "no-such-branch" } }, s);
    expect(context.doneAt.ticket).toBeDefined();
    expect(() => context.commits).toThrow(/does not exist/);
    expect(context.lastAcceptedDoneReportAt).toBeUndefined();
  });
});
