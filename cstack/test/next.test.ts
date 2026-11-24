import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { next } from "../src/commands/next.js";
import { markDone } from "../src/run-progress.js";
import { readState, runFolder, currentRunPath } from "../src/run-state.js";
import { collect, commitFiles, commitPlan, git, makeRepo } from "./helpers/plan-repo.js";

const packageRoot = join(import.meta.dirname, "fixtures/next");
const packageVersion = (JSON.parse(readFileSync(join(import.meta.dirname, "../package.json"), "utf8")) as { version: string }).version;
const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures/plans", name), "utf8");
const NOW = () => new Date("2026-11-19T09:00:00.000Z");

async function run(cwd: string, ...args: string[]) {
  const { out, io } = collect();
  const code = await next(args, io, { cwd, packageRoot, now: NOW });
  return { code, ...out };
}
const markers = (text: string) => text.match(/marker-[a-z-]+/g) ?? [];

describe("cstack next", () => {
  it("refuses --phase briefing while document is not done", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--phase", "briefing");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("document");
    expect(result.stdout).toBe("");
  });

  it("prints the run line and one guide in a fresh repository and records nothing", async () => {
    const dir = makeRepo();
    const result = await run(dir);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Run: none yet. Phase 1 of 15: ticket, in the main conversation.");
    expect(markers(result.stdout)).toEqual(["marker-ticket"]);
    expect(existsSync(join(dir, ".git", "cstack"))).toBe(false);
  });

  it("prints the guide without its block of mandatory steps", async () => {
    const root = mkdtempSync(join(tmpdir(), "cstack-next-"));
    try {
      mkdirSync(join(root, "guides", "resolve-issue"), { recursive: true });
      writeFileSync(join(root, "guides", "resolve-issue", "ticket.md"), "<!-- mandatory steps\ncommand: cstack next\n-->\n\nGuide of ticket. marker-ticket\n");
      const dir = makeRepo();
      const { out, io } = collect();
      const code = await next([], io, { cwd: dir, packageRoot: root, now: NOW });
      expect(code).toBe(0);
      expect(out.stdout).toContain("Run: none yet.");
      expect(out.stdout).toContain("Guide of ticket. marker-ticket\n");
      expect(out.stdout).not.toContain("mandatory steps");
      expect(out.stdout).not.toContain("command: cstack next");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exits with 3 and names the guide when its block never closes", async () => {
    const root = mkdtempSync(join(tmpdir(), "cstack-next-"));
    try {
      mkdirSync(join(root, "guides", "resolve-issue"), { recursive: true });
      writeFileSync(join(root, "guides", "resolve-issue", "ticket.md"), "<!-- mandatory steps\ncommand: cstack next\n");
      const dir = makeRepo();
      const { out, io } = collect();
      const code = await next([], io, { cwd: dir, packageRoot: root, now: NOW });
      expect(code).toBe(3);
      expect(out.stdout).toBe("");
      expect(out.stderr).toContain("guides/resolve-issue/ticket.md");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("starts at build for an approved plan and records startedAt", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    const result = await run(dir, "--plan", "docs/plans/x.md");
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Phase 6 of 15: build, in the executor.");
    expect(markers(result.stdout)).toEqual(["marker-build"]);
    expect(readState(dir, "docs/plans/x.md")?.phases.build?.startedAt).toBe("2026-11-19T09:00:00.000Z");
  });

  it("uses the current run without --plan", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir);
    expect(result.stdout).toContain("Run: docs/plans/x.md. Phase 6 of 15: build");
  });

  it("refuses an unknown phase with exit 2 and lists the names", async () => {
    const dir = makeRepo();
    const result = await run(dir, "--phase", "deploy");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("ticket, dependencies, code-map");
  });

  it("exits with 3 on an unknown plan format", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("format-3.md"), "docs/plans/x.md");
    const result = await run(dir, "--plan", "docs/plans/x.md");
    expect(result.code).toBe(3);
    expect(result.stderr).toContain("9.0.0");
  });

  it("refuses a plan path outside the repository", async () => {
    const dir = makeRepo();
    expect((await run(dir, "--plan", "../other/plan.md")).code).toBe(2);
    expect((await run(dir, "--plan", "/etc/hosts")).code).toBe(2);
  });

  it("--new deletes current-run, keeps the run folder and prints the ticket guide", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--new");
    expect(result.code).toBe(0);
    expect(markers(result.stdout)).toEqual(["marker-ticket"]);
    expect(existsSync(currentRunPath(dir))).toBe(false);
    expect(existsSync(runFolder(dir, "docs/plans/x.md"))).toBe(true);
  });

  it("refuses with 1 when the start condition of the next phase fails", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--phase", "publish");
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("The phase ready is not done.");
    expect(readState(dir, "docs/plans/x.md")?.phases.publish?.startedAt).toBeUndefined();
  });

  it("treats mixed flags as usage errors", async () => {
    const dir = makeRepo();
    expect((await run(dir, "--done", "ticket", "--phase", "ticket")).code).toBe(2);
    expect((await run(dir, "--new", "--plan", "x.md")).code).toBe(2);
  });

  describe("--done", () => {
    const PLAN = "docs/plans/x.md";
    const at = (iso: string) => () => new Date(iso);
    async function runAt(cwd: string, iso: string, ...args: string[]) {
      const { out, io } = collect();
      const code = await next(args, io, { cwd, packageRoot, now: at(iso) });
      return { code, ...out };
    }
    const OFFSET = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d/;
    // A plan that is finished and approved, but whose planning phases are not done yet.
    const draft = () =>
      fixture("approved.md")
        .replace("Approved at: 2026-11-18T14:32:05+01:00", "Approved at: not yet")
        .replace("Written by: cstack 0.1.0", "Written by: cstack 0.0.0")
        .replace("- Answer: open", "- Answer: A short name. The maintainer, 2026-11-19.");
    const readyPlan = () =>
      fixture("ready-for-review.md")
        .replace("Status: ready for review", "Status: approved")
        .replace("Ready for review at: 2026-11-18T18:00:00+01:00", "Ready for review at: not yet");
    const planText = (dir: string) => readFileSync(join(dir, PLAN), "utf8");
    function startRun(dir: string, done: string[], iso = "2026-11-19T07:00:00.000Z") {
      const { io } = collect();
      next(["--plan", PLAN], io, { cwd: dir, packageRoot, now: at(iso) });
      for (const name of done) markDone(dir, PLAN, name as never, new Date(iso));
    }
    const FIRST_NINE = ["ticket", "dependencies", "code-map", "questions", "plan", "build", "review", "independent-review", "update-branch"];

    it("refuses --done briefing while document is not done", async () => {
      const dir = makeRepo();
      commitPlan(dir, fixture("approved.md"), PLAN);
      await run(dir, "--plan", PLAN);
      const result = await run(dir, "--done", "briefing");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("document");
      expect(readState(dir, PLAN)?.phases.briefing?.doneAt).toBeUndefined();
    });

    it("--done ticket without --plan exits with 2", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft(), PLAN);
      await run(dir, "--plan", PLAN);
      expect((await run(dir, "--done", "ticket")).code).toBe(2);
    });

    it("--done without any run exits with 2", async () => {
      const dir = makeRepo();
      expect((await run(dir, "--done", "plan")).code).toBe(2);
    });

    it("--done ticket creates the run, writes the version and prints only the dependencies guide", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft(), PLAN);
      const result = await run(dir, "--done", "ticket", "--plan", PLAN);
      expect(result.code).toBe(0);
      expect(planText(dir)).toContain(`Written by: cstack ${packageVersion}\n`);
      expect(result.stdout).toContain("Phase 2 of 15: dependencies, in the main conversation.");
      expect(markers(result.stdout)).toEqual(["marker-dependencies"]);
      expect(readState(dir, PLAN)?.phases.ticket?.doneAt).toBe("2026-11-19T09:00:00.000Z");
      expect(readState(dir, PLAN)?.phases.dependencies?.startedAt).toBe("2026-11-19T09:00:00.000Z");
    });

    it("--done plan names an open question and a Status that is not approved", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft().replace("- Answer: A short name. The maintainer, 2026-11-19.", "- Answer: open"), PLAN);
      startRun(dir, ["ticket", "dependencies", "code-map", "questions"]);
      const open = await run(dir, "--done", "plan");
      expect(open.code).toBe(1);
      expect(open.stderr).toContain("Blocking question 2");
      const dir2 = makeRepo();
      commitPlan(dir2, draft().replace("Status: approved", "Status: draft"), PLAN);
      startRun(dir2, ["ticket", "dependencies", "code-map", "questions"]);
      const status = await run(dir2, "--done", "plan");
      expect(status.code).toBe(1);
      expect(status.stderr).toContain("Status");
      expect(planText(dir2)).toContain("Approved at: not yet");
    });

    const withFact = (fact: string, base = draft()) => base.replace("## Facts\n\nnone", `## Facts\n\n${fact}`);
    const factLine = (text: string) => text.split("\n").findIndex((l) => l.startsWith("- The ")) + 1;
    const GOOD_FACT = '- The readme starts. Source: `README.md`, line 1: "start"';
    const BAD_FACT = '- The readme ends. Source: `README.md`, line 1: "finish"';
    const badMessage = (text: string) => `The fact at line ${factLine(text)} of the plan: line 1 of \`README.md\` does not hold the quoted text.`;
    const FOUR = ["ticket", "dependencies", "code-map", "questions"];

    it("--done plan passes a fact that points to its line and refuses one that does not", async () => {
      const dir = makeRepo();
      commitPlan(dir, withFact(GOOD_FACT), PLAN);
      startRun(dir, FOUR);
      expect((await run(dir, "--done", "plan")).code).toBe(0);
      const dir2 = makeRepo();
      const text = withFact(BAD_FACT);
      commitPlan(dir2, text, PLAN);
      startRun(dir2, FOUR);
      const result = await run(dir2, "--done", "plan");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("cstack: the phase plan cannot be closed.");
      expect(result.stderr).toContain(badMessage(text));
      expect(planText(dir2)).toContain("Approved at: not yet");
      expect(readState(dir2, PLAN)?.phases.plan?.doneAt).toBeUndefined();
    });

    it("--done plan lists a wrong fact next to a Status that is not approved", async () => {
      const dir = makeRepo();
      const text = withFact(BAD_FACT, draft().replace("Status: approved", "Status: draft"));
      commitPlan(dir, text, PLAN);
      startRun(dir, FOUR);
      const result = await run(dir, "--done", "plan");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("Status is not `approved`.");
      expect(result.stderr).toContain(badMessage(text));
    });

    it("--done plan refuses a user source whose date does not exist", async () => {
      const dir = makeRepo();
      const text = withFact("- The maintainer chose a long flag. Source: the user, on 2026-02-30");
      commitPlan(dir, text, PLAN);
      startRun(dir, FOUR);
      const result = await run(dir, "--done", "plan");
      expect(result.code).toBe(1);
      expect(result.stderr).toContain(`The fact at line ${factLine(text)} of the plan: its user source has no real date in the form YYYY-MM-DD.`);
    });

    it("--done plan writes Approved at with an offset and prints the executor line only", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft(), PLAN);
      startRun(dir, ["ticket", "dependencies", "code-map", "questions"]);
      const result = await run(dir, "--done", "plan");
      expect(result.code).toBe(0);
      expect(planText(dir)).toMatch(new RegExp(`Approved at: ${OFFSET.source}\\n`));
      expect(result.stdout).toBe("The next phase, build, runs in the executor. Launch the executor with the plan file path.\n");
    });

    it("a second --done plan says it is already done and keeps Approved at", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft(), PLAN);
      startRun(dir, ["ticket", "dependencies", "code-map", "questions"]);
      await run(dir, "--done", "plan");
      const before = planText(dir);
      const again = await runAt(dir, "2027-01-01T00:00:00.000Z", "--done", "plan");
      expect(again.code).toBe(0);
      expect(again.stdout).toContain("plan is already done.");
      expect(planText(dir)).toBe(before);
    });

    it("--done questions with an open question says it is done and exits 1 because plan cannot start", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft().replace("- Answer: A short name. The maintainer, 2026-11-19.", "- Answer: open"), PLAN);
      startRun(dir, ["ticket", "dependencies", "code-map"]);
      const result = await run(dir, "--done", "questions");
      expect(result.code).toBe(1);
      expect(result.stdout).toBe("questions is done.\n");
      expect(result.stderr).toContain("Blocking question 2");
      expect(readState(dir, PLAN)?.phases.questions?.doneAt).toBeDefined();
    });

    it("--done ready writes Status and the time and keeps every other byte", async () => {
      const dir = makeRepo();
      const crlf = readyPlan().replace(/\n/g, "\r\n");
      commitPlan(dir, crlf, PLAN);
      startRun(dir, [...FIRST_NINE, "document", "briefing", "after-build-questions"]);
      const result = await run(dir, "--done", "ready");
      expect(result.code).toBe(0);
      const after = planText(dir);
      expect(after).toMatch(new RegExp(`Ready for review at: ${OFFSET.source}\\r\\n`));
      expect(after).toContain("Status: ready for review\r\n");
      const normal = (t: string) => t.replace(/^(Status|Ready for review at):.*$/gm, "");
      expect(normal(after)).toBe(normal(crlf));
      expect(result.stdout).toBe("The next phase, retro, runs in the main conversation. Finish this guide, then submit your report.\n");
    });

    it("--done ready names retro when retro was done earlier", async () => {
      const dir = makeRepo();
      commitPlan(dir, readyPlan(), PLAN);
      startRun(dir, [...FIRST_NINE, "document", "briefing", "after-build-questions", "retro"], "2026-11-19T06:00:00.000Z");
      const result = await run(dir, "--done", "ready");
      expect(result.stdout).toContain("The next phase, retro, runs in the main conversation.");
    });

    it("--done retro hands over to publish when ready is done, and stops otherwise", async () => {
      const dir = makeRepo();
      commitPlan(dir, readyPlan(), PLAN);
      startRun(dir, [...FIRST_NINE, "document", "briefing", "after-build-questions", "ready"], "2026-11-19T06:00:00.000Z");
      const result = await run(dir, "--done", "retro");
      expect(result.code).toBe(0);
      expect(result.stdout).toBe("The next phase, publish, runs in the executor. Launch the executor with the plan file path.\n");
      const dir2 = makeRepo();
      commitPlan(dir2, readyPlan(), PLAN);
      startRun(dir2, ["ticket", "dependencies", "code-map", "questions", "plan"]);
      const stopped = await run(dir2, "--done", "retro");
      expect(stopped.code).toBe(0);
      expect(stopped.stdout).toBe("The run stopped. Run cstack next later to resume it.\n");
    });

    it("--done publish says that the run is finished", async () => {
      const dir = makeRepo();
      commitPlan(dir, readyPlan(), PLAN);
      startRun(dir, [...FIRST_NINE, "document", "briefing", "after-build-questions", "ready"], "2026-11-19T06:00:00.000Z");
      markDone(dir, PLAN, "retro", new Date("2026-11-19T07:00:00.000Z"));
      const result = await run(dir, "--done", "publish");
      expect(result.code).toBe(0);
      expect(result.stdout).toBe("The run is finished. Submit your published report with cstack report submit published --plan <plan file>.\n");
    });

    it("--done retro prints the digest notice with ten retros and none with nine", async () => {
      for (const [count, expected] of [[10, true], [9, false]] as const) {
        const dir = makeRepo();
        commitPlan(dir, readyPlan(), PLAN);
        mkdirSync(join(dir, "docs/retros/reviewed"), { recursive: true });
        for (let i = 0; i < count; i++) writeFileSync(join(dir, `docs/retros/r${i}.md`), "x\n");
        writeFileSync(join(dir, "docs/retros/notes.txt"), "x\n");
        for (let i = 0; i < 3; i++) writeFileSync(join(dir, `docs/retros/reviewed/o${i}.md`), "x\n");
        startRun(dir, ["ticket", "dependencies", "code-map", "questions", "plan"]);
        const result = await run(dir, "--done", "retro");
        expect(result.stdout.includes("## Digest due")).toBe(expected);
        if (expected) {
          expect(result.stdout).toContain("10 retrospectives are waiting in docs/retros/.");
          expect(result.stdout).toContain("Run the digest-retros skill in a fresh session.");
          expect(result.stdout.endsWith("fresh session.\n")).toBe(true);
        }
      }
    });

    it("a linked worktree joins the run with --plan and marks build done for the main worktree", async () => {
      const dir = makeRepo();
      commitPlan(dir, fixture("approved.md"), PLAN);
      const wt = join(dir, "..", `wt-${Date.now()}`);
      git(dir, "worktree", "add", "-b", "feature", wt);
      commitFiles(wt, ["src/a1.ts"], 1);
      commitFiles(wt, ["docs/x.md"], 2);
      const result = await run(wt, "--done", "build", "--plan", PLAN);
      expect(result.code).toBe(0);
      expect(readState(dir, PLAN)?.phases.build?.doneAt).toBe("2026-11-19T09:00:00.000Z");
    });

    it("changes only the header lines of the plan file across the whole sequence", async () => {
      const dir = makeRepo();
      commitPlan(dir, draft(), PLAN);
      await run(dir, "--done", "ticket", "--plan", PLAN);
      for (const name of ["dependencies", "code-map", "questions", "plan"]) await run(dir, "--done", name);
      expect(git(dir, "status", "--porcelain")).toBe(`M ${PLAN}`);
      const changed = git(dir, "diff", "-U0").split("\n").filter((l) => /^[+-][^+-]/.test(l));
      expect(changed.length).toBeGreaterThan(0);
      for (const line of changed) expect(line).toMatch(/^[+-](Written by|Approved at):/);
    });
  });
});
