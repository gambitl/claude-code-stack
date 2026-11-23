import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import type { Io } from "../src/io.js";

const FIXTURES = new URL("./fixtures/measure/", import.meta.url).pathname;
const made: string[] = [];

function tmp(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function collect() {
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (text) => {
      out.stdout += text;
    },
    stderr: (text) => {
      out.stderr += text;
    },
  };
  return { out, io };
}

function git(repo: string, args: string[], date?: string): string {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Test",
    GIT_AUTHOR_EMAIL: "test@example.invalid",
    GIT_COMMITTER_NAME: "Test",
    GIT_COMMITTER_EMAIL: "test@example.invalid",
  };
  if (date) {
    env.GIT_AUTHOR_DATE = date;
    env.GIT_COMMITTER_DATE = date;
  }
  return execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });
}

function makeRepo(): string {
  const repo = tmp("cstack-repo-");
  git(repo, ["init", "-q", "-b", "main"]);
  return repo;
}

function commitPlan(repo: string, status: string, date: string): void {
  mkdirSync(join(repo, "docs"), { recursive: true });
  writeFileSync(join(repo, "docs/plan.md"), `# Plan\n\nStatus: ${status}\n\n## Ticket\n`);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-q", "-m", `status ${status}`], date);
}

function copyScenario(name: string, home: string, repo: string): void {
  const copy = (from: string, to: string) => {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      const source = join(from, entry.name);
      const target = join(to, entry.name);
      if (entry.isDirectory()) copy(source, target);
      else {
        const text = readFileSync(source, "utf8");
        writeFileSync(target, text.replaceAll("{{REPO}}", JSON.stringify(repo).slice(1, -1)));
      }
    }
  };
  copy(join(FIXTURES, name), home);
}

describe("cstack measure", () => {
  it("adds one main session, one helper and one nested helper", async () => {
    const repo = makeRepo();
    commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
    commitPlan(repo, "ready for review", "2026-03-01T11:35:00+00:00");
    const home = tmp("cstack-home-");
    copyScenario("basic", home, repo);
    const { out, io } = collect();
    const code = await run(["measure", join(repo, "docs/plan.md"), "--home", home], io);
    expect(out.stderr).toBe("");
    expect(out.stdout.split("\n")).toEqual([
      "main sessions: 1",
      "helper transcripts: 2",
      "input tokens: 27",
      "cache creation input tokens: 175",
      "cache read input tokens: 3400",
      "output tokens: 74",
      "input tokens claude-opus-5-5: 27",
      "cache creation input tokens claude-opus-5-5: 175",
      "cache read input tokens claude-opus-5-5: 3400",
      "output tokens claude-opus-5-5: 74",
      "minutes from approval to ready for review: 95",
      "skipped lines: 0",
      "unreadable files: 0",
      "",
    ]);
    expect(code).toBe(0);
  });

  it("counts each answer once and ignores the repeated totals", async () => {
    const repo = makeRepo();
    commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
    commitPlan(repo, "ready for review", "2026-03-01T11:35:00+00:00");
    const home = tmp("cstack-home-");
    copyScenario("traps", home, repo);
    const { out, io } = collect();
    const code = await run(["measure", join(repo, "docs/plan.md"), "--home", home], io);
    expect(out.stderr).toBe("");
    expect(out.stdout.split("\n")).toEqual([
      "main sessions: 1",
      "helper transcripts: 1",
      "input tokens: 20",
      "cache creation input tokens: 122",
      "cache read input tokens: 1203",
      "output tokens: 65",
      "input tokens claude-opus-5-5: 16",
      "cache creation input tokens claude-opus-5-5: 120",
      "cache read input tokens claude-opus-5-5: 1200",
      "output tokens claude-opus-5-5: 54",
      "input tokens claude-sonnet-5-5: 3",
      "cache creation input tokens claude-sonnet-5-5: 0",
      "cache read input tokens claude-sonnet-5-5: 0",
      "output tokens claude-sonnet-5-5: 7",
      "input tokens other model: 1",
      "cache creation input tokens other model: 2",
      "cache read input tokens other model: 3",
      "output tokens other model: 4",
      "minutes from approval to ready for review: 95",
      "skipped lines: 2",
      "unreadable files: 0",
      "",
    ]);
    expect(code).toBe(0);
  });

  describe("which sessions belong to the run", () => {
    // Writes one hand-made main session whose lines carry the given folder and times.
    function session(home: string, id: string, cwd: string, times: string[]): void {
      const dir = join(home, ".claude", "projects", "-some-folder");
      mkdirSync(dir, { recursive: true });
      const lines = times.map((timestamp, i) =>
        JSON.stringify({
          type: "assistant",
          cwd,
          timestamp,
          message: {
            id: `${id}_${i}`,
            model: "claude-opus-5-5",
            usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 },
          },
        }),
      );
      writeFileSync(join(dir, `${id}.jsonl`), `${lines.join("\n")}\n`);
    }

    async function measureWith(setup: (home: string, repo: string) => void) {
      const repo = realpathSync(makeRepo());
      commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
      commitPlan(repo, "ready for review", "2026-03-01T11:00:00+00:00");
      const home = tmp("cstack-home-");
      setup(home, repo);
      const { out, io } = collect();
      const code = await run(["measure", join(repo, "docs/plan.md"), "--home", home], io);
      return { out, code };
    }

    const inWindow = ["2026-03-01T10:10:00.000Z", "2026-03-01T10:20:00.000Z"];

    it("ignores a plain file inside the projects folder", async () => {
      const { out, code } = await measureWith((home, repo) => {
        session(home, "a", repo, inWindow);
        writeFileSync(join(home, ".claude", "projects", ".DS_Store"), "x");
      });
      expect(out.stdout).toContain("unreadable files: 0\n");
      expect(code).toBe(0);
    });

    it("counts a helper folder it cannot open as an unreadable file", async () => {
      let helpers = "";
      try {
        const { out, code } = await measureWith((home, repo) => {
          session(home, "a", repo, inWindow);
          helpers = join(home, ".claude", "projects", "-some-folder", "a", "subagents");
          mkdirSync(helpers, { recursive: true });
          chmodSync(helpers, 0o000);
        });
        expect(out.stdout).toContain("unreadable files: 1\n");
        expect(code).toBe(1);
      } finally {
        if (helpers) chmodSync(helpers, 0o755);
      }
    });

    it("counts a session in a subfolder of the root, even one that is gone", async () => {
      const { out, code } = await measureWith((home, repo) => {
        session(home, "a", join(repo, "docs"), inWindow);
        session(home, "b", join(repo, "deleted", "folder"), inWindow);
      });
      expect(out.stdout).toContain("main sessions: 2\n");
      expect(code).toBe(0);
    });

    it("ignores another folder and a sibling whose name starts with the root's name", async () => {
      const { out, code } = await measureWith((home, repo) => {
        session(home, "a", tmp("cstack-other-"), inWindow);
        session(home, "b", `${repo}-other`, inWindow);
      });
      expect(out.stdout).toContain("main sessions: 0\n");
      expect(out.stdout).toContain("output tokens: 0\n");
      expect(out.stderr).toBe("cstack measure: no main session of this run was found.\n");
      expect(code).toBe(1);
    });

    it("ignores a session after the ready moment and one before the approval", async () => {
      const { out } = await measureWith((home, repo) => {
        session(home, "late", repo, ["2026-03-01T11:30:00.000Z", "2026-03-01T11:40:00.000Z"]);
        session(home, "early", repo, ["2026-03-01T08:00:00.000Z", "2026-03-01T09:59:00.000Z"]);
        session(home, "span", repo, ["2026-03-01T09:00:00.000Z", "2026-03-01T12:00:00.000Z"]);
      });
      expect(out.stdout).toContain("main sessions: 1\n");
    });

    it("prints zeros and exits with 1 when the projects folder does not exist", async () => {
      const { out, code } = await measureWith(() => {});
      expect(out.stdout).toContain("main sessions: 0\n");
      expect(out.stdout).toContain("unreadable files: 0\n");
      expect(out.stderr).toBe("cstack measure: no main session of this run was found.\n");
      expect(code).toBe(1);
    });
  });

  describe("the moments, the refusals and the usage errors", () => {
    function oneSession(home: string, repo: string, start: string, end: string): void {
      const dir = join(home, ".claude", "projects", "-some-folder");
      mkdirSync(dir, { recursive: true });
      const line = (timestamp: string, id: string) =>
        JSON.stringify({
          type: "assistant",
          cwd: repo,
          timestamp,
          message: { id, model: "claude-opus-5-5", usage: { input_tokens: 1, output_tokens: 4 } },
        });
      writeFileSync(join(dir, "s.jsonl"), `${line(start, "m1")}\n${line(end, "m2")}\n`);
    }

    async function measureRepo(repo: string, home: string, plan = "docs/plan.md") {
      const { out, io } = collect();
      const code = await run(["measure", join(repo, plan), "--home", home], io);
      return { out, code };
    }

    it("reads a plan file name with wildcard characters literally", async () => {
      const repo = realpathSync(makeRepo());
      writeFileSync(join(repo, "planX.md"), "# Other\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-q", "-m", "other"], "2026-03-01T09:00:00+00:00");
      writeFileSync(join(repo, "plan*.md"), "# Plan\n\nStatus: approved\n\n## Ticket\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-q", "-m", "approved"], "2026-03-01T10:00:00+00:00");
      writeFileSync(join(repo, "plan*.md"), "# Plan\n\nStatus: ready for review\n\n## Ticket\n");
      git(repo, ["commit", "-q", "-am", "ready"], "2026-03-01T11:00:00+00:00");
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T10:10:00.000Z", "2026-03-01T10:20:00.000Z");
      const { out } = await measureRepo(repo, home, "plan*.md");
      expect(out.stdout).toContain("minutes from approval to ready for review: 60\n");
    });

    it("keeps the minutes after a rebase that changes the committer dates", async () => {
      const repo = realpathSync(makeRepo());
      writeFileSync(join(repo, "base.txt"), "base\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-q", "-m", "base"], "2026-03-01T09:00:00+00:00");
      git(repo, ["checkout", "-q", "-b", "work"]);
      commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
      commitPlan(repo, "ready for review", "2026-03-01T11:35:00+00:00");
      git(repo, ["checkout", "-q", "main"]);
      writeFileSync(join(repo, "newer.txt"), "newer\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-q", "-m", "newer"], "2026-03-02T09:00:00+00:00");
      git(repo, ["checkout", "-q", "work"]);
      const before = git(repo, ["log", "--format=%ct"]);
      git(repo, ["rebase", "-q", "main"], "2026-04-01T00:00:00+00:00");
      expect(git(repo, ["log", "--format=%ct"])).not.toBe(before);
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T10:10:00.000Z", "2026-03-01T10:20:00.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("minutes from approval to ready for review: 95\n");
      expect(code).toBe(0);
    });

    it("prints the counts but no minutes when the plan never reached ready for review", async () => {
      const repo = realpathSync(makeRepo());
      commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T10:10:00.000Z", "2026-03-01T10:20:00.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("main sessions: 1\n");
      expect(out.stdout).toContain("output tokens: 8\n");
      expect(out.stdout).not.toContain("minutes");
      expect(out.stderr).toBe(
        "cstack measure: the plan file never reached ready for review, so the ready moment is missing.\n",
      );
      expect(code).toBe(1);
    });

    it("says the history looks rewritten when ready comes 30 seconds after the approval", async () => {
      const repo = realpathSync(makeRepo());
      commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
      commitPlan(repo, "ready for review", "2026-03-01T10:00:30+00:00");
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T10:00:10.000Z", "2026-03-01T10:00:20.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("main sessions: 1\n");
      expect(out.stdout).not.toContain("minutes");
      expect(out.stderr).toBe(
        "cstack measure: the ready moment is less than a minute after the approval, so the history looks rewritten.\n",
      );
      expect(code).toBe(1);
    });

    it("never counts the template list of values as ready", async () => {
      const repo = realpathSync(makeRepo());
      commitPlan(repo, "draft | approved | ready for review", "2026-03-01T10:00:00+00:00");
      commitPlan(repo, "ready for review (soon)", "2026-03-01T12:00:00+00:00");
      const { out, code } = await measureRepo(repo, tmp("cstack-home-"));
      expect(out.stderr).toContain("ready moment is missing");
      expect(out.stdout).not.toContain("minutes");
      expect(code).toBe(1);
    });

    const PLAN_V1 = readFileSync(new URL("./fixtures/plans/full.md", import.meta.url), "utf8");

    function writePlanV1(repo: string, approved: string, ready: string, text = PLAN_V1): void {
      mkdirSync(join(repo, "docs"), { recursive: true });
      writeFileSync(
        join(repo, "docs/plan.md"),
        text
          .replace(/^Approved at: .*$/m, `Approved at: ${approved}`)
          .replace(/^Ready for review at: .*$/m, `Ready for review at: ${ready}`),
      );
    }

    it("reads both moments from the header of a version 1 plan, without the git history", async () => {
      const repo = realpathSync(makeRepo());
      writePlanV1(repo, "2026-03-01T10:00:00+01:00", "2026-03-01T12:30:00+01:00");
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T09:10:00.000Z", "2026-03-01T09:20:00.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("main sessions: 1\n");
      expect(out.stdout).toContain("minutes from approval to ready for review: 150\n");
      expect(out.stderr).toBe("");
      expect(code).toBe(0);
    });

    it("reads both moments from the header of a cstack-plan/1 plan that cstack 0.3.1 wrote", async () => {
      const repo = realpathSync(makeRepo());
      const version1 = readFileSync(new URL("./fixtures/plans/version-1.md", import.meta.url), "utf8");
      writePlanV1(repo, "2026-03-01T10:00:00+01:00", "2026-03-01T12:30:00+01:00", version1);
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T09:10:00.000Z", "2026-03-01T09:20:00.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("minutes from approval to ready for review: 150\n");
      expect(out.stderr).toBe("");
      expect(code).toBe(0);
    });

    it("prints the minutes of a version 1 plan even when they are under one minute", async () => {
      const repo = realpathSync(makeRepo());
      writePlanV1(repo, "2026-03-01T10:00:00+01:00", "2026-03-01T10:00:30+01:00");
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T09:00:10.000Z", "2026-03-01T09:00:20.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("minutes from approval to ready for review: 1\n");
      expect(out.stderr).toBe("");
      expect(code).toBe(0);
    });

    it("reports a missing ready moment of a version 1 plan", async () => {
      const repo = realpathSync(makeRepo());
      writePlanV1(repo, "2026-03-01T10:00:00+01:00", "not yet");
      const home = tmp("cstack-home-");
      oneSession(home, repo, "2026-03-01T09:10:00.000Z", "2026-03-01T09:20:00.000Z");
      const { out, code } = await measureRepo(repo, home);
      expect(out.stdout).toContain("main sessions: 1\n");
      expect(out.stdout).not.toContain("minutes");
      expect(out.stderr).toBe(
        "cstack measure: the plan file never reached ready for review, so the ready moment is missing.\n",
      );
      expect(code).toBe(1);
    });

    it("prints one fixed sentence for a version 1 plan that cannot be measured", async () => {
      const cases: [string, string, string, string][] = [
        ["not yet", "not yet", PLAN_V1, "the plan file has no approval moment yet."],
        [
          "2026-03-01T12:00:00+01:00",
          "2026-03-01T10:00:00+01:00",
          PLAN_V1,
          "the ready moment of the plan file comes before its approval moment.",
        ],
        [
          "2026-03-01T10:00:00+01:00",
          "2026-03-01T12:00:00+01:00",
          PLAN_V1.replace("Format: cstack-plan/2", "Format: ZQ7-SECRET-FORMAT"),
          "the plan file is not a valid cstack plan file.",
        ],
        // The plan reader checks the shape of a time only, so an hour of 25 reaches the measure.
        ["2026-03-01T25:00:00+01:00", "2026-03-01T12:00:00+01:00", PLAN_V1, "the plan file holds a time that does not exist."],
        ["2026-03-01T10:00:00+01:00", "2026-13-01T12:00:00+01:00", PLAN_V1, "the plan file holds a time that does not exist."],
      ];
      for (const [approved, ready, text, sentence] of cases) {
        const repo = realpathSync(makeRepo());
        writePlanV1(repo, approved, ready, text);
        const { out, code } = await measureRepo(repo, tmp("cstack-home-"));
        expect(out.stdout).toBe("");
        expect(out.stderr).toBe(`cstack measure: ${sentence}\n`);
        expect(code).toBe(1);
      }
    });

    it("keeps the history for a plan whose Format line comes after a heading", async () => {
      const repo = realpathSync(makeRepo());
      mkdirSync(join(repo, "docs"));
      writeFileSync(join(repo, "docs/plan.md"), "# Plan\n\nStatus: approved\n\n## Ticket\n\nFormat: 2\n");
      git(repo, ["add", "."]);
      git(repo, ["commit", "-q", "-m", "plan"], "2026-03-01T10:00:00+00:00");
      const allowed = await measureRepo(repo, tmp("cstack-home-"));
      expect(allowed.out.stdout).toContain("main sessions: 0\n");
    });

    it("prints one fixed sentence and no count for a missing, outside or uncommitted plan", async () => {
      const repo = realpathSync(makeRepo());
      const missing = await measureRepo(repo, tmp("cstack-home-"));
      expect(missing.out.stdout).toBe("");
      expect(missing.out.stderr).toBe("cstack measure: the plan file does not exist or cannot be read.\n");
      expect(missing.code).toBe(1);

      const outside = tmp("cstack-outside-");
      writeFileSync(join(outside, "plan.md"), "# Plan\n\nStatus: approved\n");
      const noRepo = await measureRepo(outside, tmp("cstack-home-"), "plan.md");
      expect(noRepo.out.stdout).toBe("");
      expect(noRepo.out.stderr).toBe("cstack measure: the plan file is not inside a git repository.\n");
      expect(noRepo.code).toBe(1);

      mkdirSync(join(repo, "docs"));
      writeFileSync(join(repo, "docs/plan.md"), "# Plan\n\nStatus: approved\n");
      const uncommitted = await measureRepo(repo, tmp("cstack-home-"));
      expect(uncommitted.out.stdout).toBe("");
      expect(uncommitted.out.stderr).toBe("cstack measure: the plan file was never committed.\n");
      expect(uncommitted.code).toBe(1);
    });

    it("exits with 2 and the usage line for a wrong command line", async () => {
      for (const args of [
        ["measure"],
        ["measure", "a.md", "b.md"],
        ["measure", "a.md", "--nope"],
        ["measure", "a.md", "--home"],
      ]) {
        const { out, io } = collect();
        const code = await run(args, io);
        expect(code).toBe(2);
        expect(out.stdout).toBe("");
        expect(out.stderr).toContain("Usage: cstack measure <plan file> [--home <folder>]\n");
      }
    });
  });

  describe("nothing private leaves the command", () => {
    const MARKER = "ZQ7-PRIVATE-MARKER-41";
    const ALLOWED = [
      /^(main sessions|helper transcripts|minutes from approval to ready for review|skipped lines|unreadable files): \d+$/,
      /^(input tokens|cache creation input tokens|cache read input tokens|output tokens)( (claude-[a-z0-9.-]+|other model))?: \d+$/,
    ];

    function setup(): { repo: string; home: string; plan: string } {
      const repo = makeRepo();
      commitPlan(repo, "approved", "2026-03-01T10:00:00+00:00");
      commitPlan(repo, "ready for review", "2026-03-01T11:35:00+00:00");
      const home = tmp("cstack-home-");
      copyScenario("private", home, repo);
      return { repo, home, plan: join(repo, "docs/plan.md") };
    }

    function listing(dir: string): Record<string, string> {
      const found: Record<string, string> = {};
      const walk = (path: string) => {
        for (const entry of readdirSync(path, { withFileTypes: true })) {
          const full = join(path, entry.name);
          if (entry.isDirectory()) walk(full);
          else found[full.slice(dir.length)] = readFileSync(full, "utf8");
        }
      };
      walk(dir);
      return found;
    }

    it("prints only fixed labels and digits, and never the marker", async () => {
      const { home, plan } = setup();
      const { out, io } = collect();
      const code = await run(["measure", plan, "--home", home], io);
      expect(code).toBe(0);
      expect(out.stdout + out.stderr).not.toContain(MARKER);
      const lines = out.stdout.trimEnd().split("\n");
      expect(lines.length).toBeGreaterThan(5);
      for (const line of lines) expect(ALLOWED.some((pattern) => pattern.test(line))).toBe(true);
      expect(out.stdout).toContain("input tokens other model: 4");
    });

    it("counts an unreadable helper, says so in a fixed sentence and leaks no path", async () => {
      const { home, plan } = setup();
      const helper = join(home, ".claude/projects/-repo/main1/subagents/agent-p2.jsonl");
      chmodSync(helper, 0o000);
      try {
        const { out, io } = collect();
        const code = await run(["measure", plan, "--home", home], io);
        expect(code).toBe(1);
        expect(out.stdout).toContain("unreadable files: 1");
        expect(out.stderr).toBe("cstack measure: some files could not be read and were left out of the counts.\n");
        for (const text of [out.stdout, out.stderr]) {
          expect(text).not.toContain(MARKER);
          expect(text).not.toContain("agent-p2");
          expect(text).not.toContain("-repo");
          expect(text).not.toContain(home);
        }
      } finally {
        chmodSync(helper, 0o644);
      }
    });

    it("leaves the home folder exactly as it was", async () => {
      const { home, plan } = setup();
      const before = listing(home);
      const { io } = collect();
      await run(["measure", plan, "--home", home], io);
      expect(listing(home)).toEqual(before);
    });

    it("has no network module and no fetch call in its sources", () => {
      const root = new URL("../src/", import.meta.url).pathname;
      const files = [join(root, "commands/measure.ts")];
      for (const name of readdirSync(join(root, "measure"))) files.push(join(root, "measure", name));
      expect(files.length).toBeGreaterThanOrEqual(3);
      const modules = ["http", "https", "http2", "net", "tls", "dgram", "dns", "undici"];
      for (const file of files) {
        const text = readFileSync(file, "utf8");
        for (const name of modules) {
          expect(text).not.toMatch(new RegExp(`(from|import)\\s*\\(?\\s*["'](node:)?${name}(/[^"']*)?["']`));
          expect(text).not.toMatch(new RegExp(`require\\(\\s*["'](node:)?${name}["']`));
        }
        expect(text).not.toMatch(/\bfetch\s*\(/);
      }
    });
  });
});
