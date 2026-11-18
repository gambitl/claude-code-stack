import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reportCheck } from "../src/commands/report-check.js";
import { reportSubmit } from "../src/commands/report-submit.js";
import {
  checkReport,
  lastAcceptedDoneReportAt,
  saveReport,
  takeOldestUnreadReport,
} from "../src/report/reports.js";
import { runFolder } from "../src/run-state.js";
import { collect, commitFiles, commitPlan, git, makeRepo } from "./helpers/plan-repo.js";

const full = readFileSync(new URL("./fixtures/plans/full.md", import.meta.url), "utf8");
const PLAN = "docs/plans/full.md";

/** A repository on a branch with the plan committed and a commit for each given unit. */
function setup(options: { text?: string; units?: number[] } = {}) {
  const dir = makeRepo();
  commitPlan(dir, options.text ?? full);
  git(dir, "checkout", "-b", "feature");
  for (const unit of options.units ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) commitFiles(dir, [`src/u${unit}.ts`], unit);
  return { dir, where: { root: dir, planFile: PLAN } };
}

const done = { role: "executor", kind: "done", text: "" } as const;
const joined = (reasons: string[]) => reasons.join("\n");

describe("checkReport, executor done", () => {
  it("accepts a clean and complete repository", () => {
    const { where } = setup();
    expect(checkReport(done, where)).toEqual([]);
  });

  it("names the Briefing section when it holds only its placeholder", () => {
    const text = full.replace("The build is done. Every unit has its commit.", "<what was built>");
    const { where } = setup({ text });
    const reasons = checkReport(done, where);
    expect(joined(reasons)).toContain("Briefing");
  });

  it("names a unit without a commit, and gives both reasons when both fail", () => {
    const { where } = setup({ units: [1, 2, 4, 5, 6, 7, 8, 9, 10] });
    expect(joined(checkReport(done, where))).toContain("Unit 3");
    const text = full.replace("The build is done. Every unit has its commit.", "<what was built>");
    const both = setup({ text, units: [1, 2, 4, 5, 6, 7, 8, 9, 10] });
    const reasons = joined(checkReport(done, both.where));
    expect(reasons).toContain("Briefing");
    expect(reasons).toContain("Unit 3");
  });

  it("accepts a blocked unit with no commit", () => {
    const text = full.replace("- Depends on: 2\n", "- Depends on: 2\n- Blocked: waits for a decision\n");
    const { where } = setup({ text, units: [1, 2, 4, 5, 6, 7, 8, 9, 10] });
    expect(checkReport(done, where)).toEqual([]);
  });

  it("refuses an open blocking question", () => {
    const text = full.replace("- Answer: Yes, long. The maintainer, 2026-11-18.", "- Answer: open");
    const { where } = setup({ text });
    expect(joined(checkReport(done, where))).toContain("Blocking question 1");
  });

  it("refuses Ready for review at: not yet", () => {
    const text = full.replace("Ready for review at: 2026-11-18T18:05:40+01:00", "Ready for review at: not yet");
    const { where } = setup({ text });
    expect(joined(checkReport(done, where))).toContain("Ready for review at");
  });

  it("refuses an uncommitted change to the plan file", () => {
    const { dir, where } = setup();
    writeFileSync(join(dir, PLAN), `${full}\nmore\n`);
    expect(joined(checkReport(done, where))).toContain(PLAN);
  });

  it("refuses a staged change and an untracked plan file", () => {
    const { dir, where } = setup();
    writeFileSync(join(dir, PLAN), `${full}\nmore\n`);
    git(dir, "add", PLAN);
    expect(joined(checkReport(done, where))).toContain(PLAN);
    git(dir, "reset", "--hard");
    writeFileSync(join(dir, "docs/plans/other.md"), "x\n");
    expect(joined(checkReport(done, where))).toContain("docs/plans/other.md");
  });

  it("refuses an untracked file elsewhere, but not an ignored one", () => {
    const { dir, where } = setup();
    writeFileSync(join(dir, "scratch.txt"), "x\n");
    expect(joined(checkReport(done, where))).toContain("scratch.txt");
    git(dir, "reset", "--hard");
    git(dir, "clean", "-fd");
    writeFileSync(join(dir, ".gitignore"), "ignored.txt\n");
    git(dir, "add", ".gitignore");
    git(dir, "commit", "-m", "chore: ignore");
    writeFileSync(join(dir, "ignored.txt"), "x\n");
    expect(checkReport(done, where)).toEqual([]);
  });
});

describe("checkReport, other kinds", () => {
  it("refuses the kind complete and lists the allowed kinds", () => {
    const { where } = setup();
    const reason = joined(checkReport({ role: "executor", kind: "complete", text: "" }, where));
    for (const kind of ["done", "needs-decision", "failed", "published"]) expect(reason).toContain(kind);
  });

  it("refuses needs-decision and failed with a blank text", () => {
    const { where } = setup();
    for (const kind of ["needs-decision", "failed"]) {
      expect(checkReport({ role: "executor", kind, text: "" }, where)).not.toEqual([]);
      expect(checkReport({ role: "executor", kind, text: " \n " }, where)).not.toEqual([]);
      expect(checkReport({ role: "executor", kind, text: "Why." }, where)).toEqual([]);
    }
  });

  it("checks published against publish.json and HEAD", () => {
    const { dir, where } = setup();
    const published = { role: "executor", kind: "published", text: "" } as const;
    expect(checkReport(published, where)).not.toEqual([]);
    const head = git(dir, "rev-parse", "HEAD");
    const file = join(runFolder(dir, PLAN), "publish.json");
    mkdirSync(runFolder(dir, PLAN), { recursive: true });
    writeFileSync(file, JSON.stringify({ pullRequest: "https://example.com/pr/1", pushes: [{ commit: "0".repeat(40), time: "2026-11-18T10:00:00Z" }] }));
    expect(checkReport(published, where)).not.toEqual([]);
    writeFileSync(file, JSON.stringify({ pullRequest: "", pushes: [{ commit: head, time: "2026-11-18T10:00:00Z" }] }));
    expect(checkReport(published, where)).not.toEqual([]);
    writeFileSync(file, JSON.stringify({ pullRequest: "https://example.com/pr/1", pushes: [{ commit: head, time: "2026-11-18T10:00:00Z" }] }));
    expect(checkReport(published, where)).toEqual([]);
    writeFileSync(file, "not json");
    expect(() => checkReport(published, where)).toThrow(/JSON/);
  });
});

describe("checkReport, implementer", () => {
  it("refuses done without a commit, and accepts it with the commit and a saved failing run", () => {
    const { dir, where } = setup({ units: [] });
    const report = (unit: number, kind = "done") => ({ role: "implementer" as const, kind, text: "", unit });
    expect(joined(checkReport(report(2), where))).toContain("Unit 2");
    commitFiles(dir, ["src/u2.ts"], 2);
    expect(checkReport(report(2), where)).toEqual([]);
    commitFiles(dir, ["src/u1.ts"], 1);
    expect(joined(checkReport(report(1), where))).toContain("red.json");
    const red = join(runFolder(dir, PLAN), "units", "1", "red.json");
    mkdirSync(join(runFolder(dir, PLAN), "units", "1"), { recursive: true });
    writeFileSync(red, "{}");
    expect(checkReport(report(1), where)).toEqual([]);
  });

  it("refuses needs-decision, an empty stuck, a missing unit and an unknown unit", () => {
    const { where } = setup();
    expect(checkReport({ role: "implementer", kind: "needs-decision", text: "x", unit: 2 }, where)).not.toEqual([]);
    expect(checkReport({ role: "implementer", kind: "stuck", text: "  ", unit: 2 }, where)).not.toEqual([]);
    expect(checkReport({ role: "implementer", kind: "stuck", text: "why", unit: 2 }, where)).toEqual([]);
    expect(checkReport({ role: "implementer", kind: "done", text: "" }, where)).not.toEqual([]);
    expect(checkReport({ role: "implementer-escalation", kind: "done", text: "", unit: 99 }, where)).not.toEqual([]);
  });
});

describe("saving and reading reports", () => {
  const at = new Date("2026-11-18T10:15:30.123Z");

  it("saves, then takes a report once and sets readAt", () => {
    const { dir, where } = setup();
    const path = saveReport(where, { kind: "done", text: "Hello $(x)" }, at);
    expect(path).toContain("2026-11-18T10-15-30.123Z-done.json");
    const taken = takeOldestUnreadReport(where);
    expect(taken).toMatchObject({ kind: "done", text: "Hello $(x)", time: at.toISOString() });
    expect(JSON.parse(readFileSync(path, "utf8")).readAt).toBeTruthy();
    expect(takeOldestUnreadReport(where)).toBeUndefined();
    expect(dir).toBeTruthy();
  });

  it("returns two reports oldest first", () => {
    const { where } = setup();
    saveReport(where, { kind: "failed", text: "later" }, new Date("2026-11-18T11:00:00Z"));
    saveReport(where, { kind: "done", text: "earlier" }, new Date("2026-11-18T10:00:00Z"));
    expect(takeOldestUnreadReport(where)?.text).toBe("earlier");
    expect(takeOldestUnreadReport(where)?.text).toBe("later");
  });

  it("never replaces a report saved at the same time", () => {
    const { dir, where } = setup();
    saveReport(where, { kind: "done", text: "a" }, at);
    saveReport(where, { kind: "done", text: "b" }, at);
    expect(readdirSync(join(runFolder(dir, PLAN), "reports")).filter((n) => n.endsWith(".json"))).toHaveLength(2);
    expect([takeOldestUnreadReport(where)?.text, takeOldestUnreadReport(where)?.text].sort()).toEqual(["a", "b"]);
  });

  it("returns the time of the latest done report", () => {
    const { where } = setup();
    expect(lastAcceptedDoneReportAt(where)).toBeUndefined();
    saveReport(where, { kind: "done", text: "" }, new Date("2026-11-18T10:00:00Z"));
    saveReport(where, { kind: "failed", text: "x" }, new Date("2026-11-18T12:00:00Z"));
    saveReport(where, { kind: "done", text: "" }, new Date("2026-11-18T11:00:00Z"));
    expect(lastAcceptedDoneReportAt(where)).toBe("2026-11-18T11:00:00.000Z");
  });
});

describe("cstack report submit and report check", () => {
  const submit = async (kind: string, dir: string, input: Buffer | undefined, extra: string[] = []) => {
    const { out, io } = collect();
    const code = await reportSubmit([kind, "--plan", PLAN, ...extra], io, { cwd: dir, readInput: async () => input });
    return { code, ...out };
  };
  const check = async (dir: string) => {
    const { out, io } = collect();
    const code = await reportCheck(["--plan", PLAN], io, { cwd: dir });
    return { code, ...out };
  };

  it("refuses done when the Briefing holds only its placeholder", async () => {
    const text = full.replace("The build is done. Every unit has its commit.", "<what was built>");
    const { dir } = setup({ text });
    const r = await submit("done", dir, Buffer.from(""));
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("Briefing");
  });

  it("refuses an unknown kind and lists the four kinds", async () => {
    const { dir } = setup();
    const r = await submit("complete", dir, Buffer.from("x"));
    expect(r.code).toBe(1);
    for (const kind of ["done", "needs-decision", "failed", "published"]) expect(r.stderr).toContain(kind);
  });

  it("refuses an empty needs-decision, a text over 65536 bytes and invalid UTF-8", async () => {
    const { dir } = setup();
    expect((await submit("needs-decision", dir, Buffer.from(""))).code).toBe(1);
    expect((await submit("failed", dir, Buffer.alloc(65537, "a"))).code).toBe(1);
    expect((await submit("failed", dir, Buffer.alloc(65536, "a"))).code).toBe(0);
    expect((await submit("failed", dir, Buffer.from([0xff, 0xfe, 0x41]))).code).toBe(1);
  });

  it("exits with 2 when there is no input, and on an unknown flag or a missing kind", async () => {
    const { dir } = setup();
    expect((await submit("done", dir, undefined)).code).toBe(2);
    expect((await submit("done", dir, Buffer.from(""), ["--nope"])).code).toBe(2);
    const { io } = collect();
    expect(await reportSubmit(["--plan", PLAN], io, { cwd: dir, readInput: async () => Buffer.from("") })).toBe(2);
  });

  it("accepts a report, saves it, and report check shows it once", async () => {
    const { dir } = setup();
    const r = await submit("done", dir, Buffer.from("all good\n"));
    expect(r.code).toBe(0);
    expect(r.stdout.trim().split("\n")).toHaveLength(1);
    expect(readdirSync(join(runFolder(dir, PLAN), "reports"))).toHaveLength(1);
    const first = await check(dir);
    expect(first.code).toBe(0);
    expect(first.stdout).toBe("done\nall good\n");
    const second = await check(dir);
    expect(second.code).toBe(1);
    expect(second.stderr).toContain("Launch the executor again");
  });

  it("shows two accepted reports oldest first", async () => {
    const { dir } = setup();
    await submit("failed", dir, Buffer.from("first"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await submit("needs-decision", dir, Buffer.from("second"));
    expect((await check(dir)).stdout).toBe("failed\nfirst");
    expect((await check(dir)).stdout).toBe("needs-decision\nsecond");
  });

  it("saves and prints shell text byte for byte and runs nothing", async () => {
    const { dir } = setup();
    const text = "$(touch pwned) `touch pwned` ; rm -rf ~\n";
    expect((await submit("done", dir, Buffer.from(text))).code).toBe(0);
    expect((await check(dir)).stdout).toBe(`done\n${text}`);
    expect(existsSync(join(dir, "pwned"))).toBe(false);
    expect(existsSync(join(process.cwd(), "pwned"))).toBe(false);
  });
});
