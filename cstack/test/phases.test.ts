import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PHASES,
  PLANNING_PHASES,
  checkPhaseList,
  type Phase,
  type PhaseContext,
  type PhaseName,
} from "../src/phases.js";
import { readPlan } from "../src/plan/read.js";

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/plans/${name}.md`, import.meta.url), "utf8");

function context(text: string, overrides: Partial<PhaseContext> = {}): PhaseContext {
  return { plan: readPlan(text), commits: { units: {}, invalid: [] }, doneAt: {}, ...overrides };
}
const phase = (name: PhaseName) => PHASES.find((p) => p.name === name)!;
const answered = (text: string) => text.replace("- Answer: open", "- Answer: Yes. The maintainer.");

describe("the phase list", () => {
  it("has the fifteen phases in order, with their places and dependencies", () => {
    expect(PHASES.map((p) => [p.name, p.today, p.runsIn, p.dependsOn])).toEqual([
      ["ticket", "0 and 1", "main conversation", []],
      ["dependencies", "2", "main conversation", ["ticket"]],
      ["code-map", "3", "main conversation", ["dependencies"]],
      ["questions", "4", "main conversation", ["code-map"]],
      ["plan", "5", "main conversation", ["questions"]],
      ["build", "6", "executor", ["plan"]],
      ["review", "7", "executor", ["build"]],
      ["independent-review", "8", "executor", ["review"]],
      ["update-branch", "9", "executor", ["independent-review"]],
      ["document", "10.3", "executor", ["update-branch"]],
      ["briefing", "10.1", "executor", ["document"]],
      ["after-build-questions", "10.2", "executor", ["briefing"]],
      ["ready", "10.4", "executor", ["after-build-questions"]],
      ["retro", "11", "main conversation", []],
      ["publish", "12", "executor", ["ready", "retro"]],
    ]);
  });

  it("names the five planning phases", () => {
    expect(PLANNING_PHASES).toEqual(["ticket", "dependencies", "code-map", "questions", "plan"]);
  });

  it("passes its own checks", () => {
    expect(checkPhaseList(PHASES)).toEqual([]);
  });

  it("fails when briefing does not depend on document", () => {
    const list = PHASES.map((p) => (p.name === "briefing" ? { ...p, dependsOn: ["update-branch" as PhaseName] } : p));
    expect(checkPhaseList(list).join("\n")).toContain("briefing");
  });

  it("fails on an unknown dependency, a wrong order, a cycle and a bad name", () => {
    const base = (name: string, dependsOn: string[]) =>
      ({ name, today: "x", runsIn: "executor", dependsOn }) as unknown as Phase;
    expect(checkPhaseList([base("a", ["zzz"])]).join()).toContain("zzz");
    expect(checkPhaseList([base("a", ["b"]), base("b", [])]).join()).toContain("before");
    expect(checkPhaseList([base("a", ["b"]), base("b", ["a"])]).join()).toContain("cycle");
    expect(checkPhaseList([base("Bad Name", [])]).join()).toContain("Bad Name");
  });
});

describe("the done checks and start conditions", () => {
  it("plan fails while a blocking question is open and passes when answered", () => {
    const text = fixture("approved");
    expect(phase("plan").start!(context(text))).not.toEqual([]);
    expect(phase("plan").done!(context(text))).not.toEqual([]);
    expect(phase("plan").done!(context(answered(text)))).toEqual([]);
    expect(phase("plan").start!(context(answered(text)))).toEqual([]);
  });

  describe("the changes to what the ticket fixes", () => {
    const withChanges = (text: string, lines: string[]) =>
      text.replace("## Changes to what the ticket fixes\n\nnone", `## Changes to what the ticket fixes\n\n${lines.join("\n")}`);
    const lineOf = (text: string, needle: string) => text.split("\n").findIndex((l) => l === needle) + 1;
    const doneOf = (text: string) => phase("plan").done!(context(text));

    it("plan refuses a change whose blocking question does not exist", () => {
      const change = "- The flag is long. Blocking question: 3";
      const text = withChanges(answered(fixture("approved")), [change]);
      expect(doneOf(text)).toContain(
        `The change at line ${lineOf(text, change)} of the plan: blocking question 3 does not exist.`,
      );
    });

    it("plan refuses a change whose blocking question is still open", () => {
      const change = "- The name is short. Blocking question: 2";
      const text = withChanges(fixture("approved"), [change]);
      expect(doneOf(text)).toContain(
        `The change at line ${lineOf(text, change)} of the plan: blocking question 2 has no answer yet.`,
      );
    });

    it("plan refuses a change whose blocking question has an empty answer", () => {
      const change = "- The name is short. Blocking question: 2";
      const text = withChanges(fixture("approved").replace("- Answer: open", "- Answer: "), [change]);
      expect(doneOf(text)).toContain(
        `The change at line ${lineOf(text, change)} of the plan: blocking question 2 has no answer yet.`,
      );
    });

    it("plan passes a change whose blocking question is answered", () => {
      const one = "- The flag is long. Blocking question: 1";
      const two = "- The name is short. Blocking question: 2";
      const base = answered(fixture("approved"));
      expect(doneOf(withChanges(base, [one]))).toEqual([]);
      const text = withChanges(fixture("approved"), [one, two]);
      const messages = doneOf(text).filter((m) => m.startsWith("The change at line"));
      expect(messages).toEqual([
        `The change at line ${lineOf(text, two)} of the plan: blocking question 2 has no answer yet.`,
      ]);
    });
  });

  it("plan fails when the status is not approved", () => {
    const text = answered(fixture("approved")).replace("Status: approved", "Status: draft");
    expect(phase("plan").done!(context(text))).not.toEqual([]);
  });

  it("build fails for a unit without a commit and passes with a commit or a Blocked line", () => {
    const text = fixture("approved");
    expect(phase("build").done!(context(text, { commits: { units: { 1: ["a"] }, invalid: [] } }))).toEqual([
      expect.stringContaining("Unit 2"),
    ]);
    // Unit 3 has a Blocked line, so it needs no commit.
    const all = { units: { 1: ["a"], 2: ["b"] }, invalid: [] };
    expect(phase("build").done!(context(text, { commits: all }))).toEqual([]);
  });

  it("ready needs the Pull request and Executor notes sections", () => {
    expect(phase("ready").done!(context(fixture("approved"))).length).toBe(2);
    expect(phase("ready").done!(context(fixture("ready-for-review")))).toEqual([]);
  });

  it("publish needs the retro to be done after the last accepted done report", () => {
    const text = fixture("approved");
    const at = (retro: string | undefined) =>
      context(text, { doneAt: retro ? { retro } : {}, lastAcceptedDoneReportAt: "2026-11-18T10:00:00+01:00" });
    expect(phase("publish").start!(at("2026-11-18T09:00:00+01:00"))).not.toEqual([]);
    expect(phase("publish").start!(at(undefined))).not.toEqual([]);
    expect(phase("publish").start!(at("2026-11-18T11:00:00+01:00"))).toEqual([]);
  });

  it("the section checks follow the filled sections", () => {
    expect(phase("ticket").done!(context(fixture("approved")))).toEqual([]);
    expect(phase("review").done!(context(fixture("approved")))).not.toEqual([]);
  });
});
