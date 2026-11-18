import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPlan } from "../src/plan/read.js";
import {
  RUN_FORMAT,
  RunStateError,
  createRun,
  currentRunPath,
  readCurrentRun,
  readState,
  runFolder,
  writeCurrentRun,
  writeFileAtomic,
} from "../src/run-state.js";

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  ).trim();

const PLAN = "docs/plans/2026-11-18-13-example.md";

function setup() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "cstack-run-")));
  const main = join(base, "main");
  mkdirSync(main);
  git(main, "init", "-b", "main");
  writeFileSync(join(main, "f.txt"), "x");
  git(main, "add", "f.txt");
  git(main, "commit", "-m", "chore: start");
  const linked = join(base, "linked");
  git(main, "worktree", "add", "-b", "other", linked);
  mkdirSync(join(main, "sub"));
  return { main, linked, sub: join(main, "sub") };
}

const approved = () => readPlan(readFileSync(new URL("./fixtures/plans/approved.md", import.meta.url), "utf8"));
const ready = () => readPlan(readFileSync(new URL("./fixtures/plans/ready-for-review.md", import.meta.url), "utf8"));

describe("run folder and current-run file", () => {
  it("gives one run folder to every worktree and a current-run file to each", () => {
    const { main, linked, sub } = setup();
    const a = runFolder(main, PLAN);
    expect(runFolder(sub, PLAN)).toBe(a);
    expect(runFolder(linked, PLAN)).toBe(a);
    expect(a).toBe(join(main, ".git", "cstack", "runs", "2026-11-18-13-example"));
    const c1 = currentRunPath(main);
    const c2 = currentRunPath(linked);
    expect(c1).not.toBe(c2);
    expect(currentRunPath(sub)).toBe(c1);
    writeCurrentRun(main, PLAN);
    expect(readCurrentRun(main)).toBe("2026-11-18-13-example.md");
    expect(readCurrentRun(linked)).toBeUndefined();
    writeCurrentRun(linked, "other.md");
    expect(readCurrentRun(linked)).toBe("other.md");
    expect(readCurrentRun(sub)).toBe("2026-11-18-13-example.md");
  });

  it("refuses a plan file name with a space or without .md", () => {
    const { main } = setup();
    for (const bad of ["docs/plans/a b.md", "docs/plans/a.txt", "docs/plans/a", "docs/plans/.md", "docs/plans/-a.md"]) {
      expect(() => runFolder(main, bad)).toThrow(RunStateError);
    }
    try {
      runFolder(main, "docs/plans/a b.md");
    } catch (e) {
      expect((e as RunStateError).exitCode).toBe(3);
    }
  });

  it("refuses to run outside a git repository", () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cstack-nogit-")));
    expect(() => runFolder(dir, PLAN)).toThrow(RunStateError);
  });
});

describe("state file", () => {
  it("refuses another format and names the cstack version that wrote it", () => {
    const { main } = setup();
    const dir = runFolder(main, PLAN);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "state.json"),
      JSON.stringify({ format: "cstack-run/2", writtenBy: "9.0.0", plan: PLAN, phases: {} }),
    );
    let error: unknown;
    try {
      readState(main, PLAN);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(RunStateError);
    expect((error as RunStateError).exitCode).toBe(3);
    expect((error as RunStateError).message).toContain("cstack 9.0.0");
    expect((error as RunStateError).message).toContain(RUN_FORMAT);
  });

  it("refuses a state file that is not valid JSON", () => {
    const { main } = setup();
    const dir = runFolder(main, PLAN);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "state.json"), "{nope");
    expect(() => readState(main, PLAN)).toThrow(RunStateError);
  });

  it("returns undefined when the run does not exist", () => {
    const { main } = setup();
    expect(readState(main, PLAN)).toBeUndefined();
  });
});

describe("createRun", () => {
  it("marks the five planning phases done at the approval time", () => {
    const { main } = setup();
    const state = createRun(main, PLAN, approved());
    expect(state.format).toBe(RUN_FORMAT);
    expect(state.plan).toBe(PLAN);
    expect(Object.keys(state.phases)).toEqual(["ticket", "dependencies", "code-map", "questions", "plan"]);
    for (const phase of Object.values(state.phases)) {
      expect(phase.doneAt).toBe("2026-11-18T14:32:05+01:00");
    }
    expect(readState(main, PLAN)).toEqual(state);
  });

  it("starts with no phase done when the plan is not approved", () => {
    const { main } = setup();
    const plan = approved();
    plan.header["Approved at"] = "not yet";
    expect(createRun(main, PLAN, plan).phases).toEqual({});
  });

  it("keeps a run that already exists", () => {
    const { main, linked } = setup();
    const first = createRun(main, PLAN, approved());
    const again = createRun(linked, PLAN, ready());
    expect(again).toEqual(first);
  });

  it("leaves no temporary file behind", () => {
    const { main } = setup();
    createRun(main, PLAN, approved());
    writeCurrentRun(main, PLAN);
    writeFileAtomic(join(runFolder(main, PLAN), "units", "1", "red.log"), "log");
    expect(readdirSync(runFolder(main, PLAN))).toEqual(["state.json", "units"]);
    expect(readdirSync(join(runFolder(main, PLAN), "units", "1"))).toEqual(["red.log"]);
    expect(readdirSync(join(main, ".git", "cstack"))).toEqual(["current-run", "runs"]);
  });
});
