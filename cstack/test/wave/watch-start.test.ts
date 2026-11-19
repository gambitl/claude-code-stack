import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wave } from "../../src/commands/wave.js";
import { answerQuestion, watchSetup } from "../helpers/watch.js";
import { git } from "../helpers/plan-repo.js";
import { ticket } from "../helpers/wave.js";

const ARGS = ["--milestone", "M3", "--tracker", "jira", "--watch"];
const inProgress = { stateKind: "in-progress" } as const;
const done = { stateKind: "finished" } as const;
const q13 = "\u0007Start ABC-13 now? [y/N] ";

/** A watch whose ABC-13 is blocked at read 1 and ready at read 2. `onRead2` runs just before read 2 answers. */
function blockedThenReady(options: Parameters<typeof watchSetup>[0] = {}, onRead2: () => void = () => {}) {
  const s = watchSetup({
    ...options,
    tickets: [ticket("ABC-13", { blockers: [{ key: "ABC-1", ...inProgress }] })],
    keys: ["ABC-13"],
  });
  let reads = 0;
  const original = s.fake.listGroup.bind(s.fake);
  s.fake.listGroup = async (group) => {
    reads++;
    if (reads === 2) {
      onRead2();
      s.fake.tickets.set("ABC-13", ticket("ABC-13", { blockers: [{ key: "ABC-1", ...done }] }));
    }
    return original(group);
  };
  return s;
}

describe("cstack wave --watch starts a ticket after a yes", () => {
  it("starts the ticket from a fresh fetch of origin, in the git way", async () => {
    let pushed = "";
    const s = blockedThenReady({}, () => {
      const other = mkdtempSync(join(tmpdir(), "cstack-push-"));
      execFileSync("git", ["clone", s.clone.origin, other], { stdio: "ignore" });
      execFileSync("git", ["-C", other, "commit", "--allow-empty", "-m", "chore: pushed after read 1", "--author=t <t@example.com>"], {
        env: { ...process.env, GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
        stdio: "ignore",
      });
      git(other, "push", "origin", "main");
      pushed = git(other, "rev-parse", "HEAD").trim();
    });
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "y")]);
    const match = s.out.stdout.match(/cd '([^']+)' && claude '\/resolve-issue ABC-13'/);
    expect(match).not.toBeNull();
    expect(git(match![1]!, "rev-parse", "HEAD").trim()).toBe(pushed);
    expect(s.recorded.calls.filter((c) => c.command === "git" && c.args.join(" ") === "fetch origin")).toHaveLength(1);
    expect(code).toBe(0);
  });

  it("runs one fetch for each ticket after a yes in the first round", async () => {
    const s = watchSetup({ tickets: [ticket("ABC-13"), ticket("ABC-14")], keys: ["ABC-13", "ABC-14"] });
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, "[y/N] ", "y")]);
    expect(s.recorded.calls.filter((c) => c.command === "git" && c.args.join(" ") === "fetch origin")).toHaveLength(2);
    expect(s.out.stdout).toContain("/resolve-issue ABC-13'");
    expect(s.out.stdout).toContain("/resolve-issue ABC-14'");
    expect(code).toBe(0);
  });

  it("fails only that start when the fetch fails, and the exit code is 5", async () => {
    const s = blockedThenReady({}, () => git(s.clone.root, "remote", "set-url", "origin", "/nonexistent/origin.git"));
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "y")]);
    expect(s.out.stdout).toContain("ABC-13  failed, `git fetch origin` failed.");
    expect(s.out.stdout).not.toContain("started nothing");
    expect(code).toBe(5);
  });

  it("fetches before orca worktree create, with the arguments of cstack wave", async () => {
    const s = blockedThenReady({ orca: true });
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "y")]);
    const names = s.recorded.calls.map((c) => (c.command === "git" ? c.args.join(" ") : c.args.slice(0, 2).join(" ")));
    expect(names.indexOf("fetch origin")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("fetch origin")).toBeLessThan(names.indexOf("worktree create"));
    expect(names.filter((n) => n === "fetch origin")).toHaveLength(1);
    const create = s.recorded.calls.find((c) => c.args[0] === "worktree" && c.args[1] === "create");
    expect(create!.args).toEqual([
      "worktree", "create", "--repo", `path:${realpathSync(s.clone.root)}`, "--name", "abc-13", "--branch", "abc-13",
      "--no-parent", "--reference", "https://github.com/example/repo/issues/13", "--agent", "claude", "--prompt", "/resolve-issue ABC-13", "--json",
    ]);
    expect(code).toBe(0);
  });

  it("reports an unknown outcome when Control-C cuts git worktree add, and starts no second ticket", async () => {
    const s = watchSetup({ tickets: [ticket("ABC-13"), ticket("ABC-14")], keys: ["ABC-13", "ABC-14"] });
    const run = s.deps.run;
    s.deps.run = async (c, a, cwd) => {
      if (c === "git" && a[0] === "worktree" && a[1] === "add") {
        s.interrupt();
        return { kind: "failed", exitCode: 130 };
      }
      return run(c, a, cwd);
    };
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, "[y/N] ", "y")]);
    expect(s.out.stdout).toContain(
      "ABC-13  the outcome is unknown, because Control-C also stopped the program that was starting it. Check ABC-13 by hand.",
    );
    expect(s.out.stdout).toContain("Stopped the watch.");
    expect(s.recorded.calls.filter((c) => c.args[0] === "worktree" && c.args[1] === "add")).toHaveLength(0);
    expect(s.out.stdout).not.toMatch(/ABC-14  (started|skipped|failed|not started|the outcome)/);
    expect(s.out.stdout).not.toContain("/resolve-issue ABC-14");
    expect(code).toBe(5);
  });

  it("reports not started when Control-C cuts git show-ref, and creates nothing", async () => {
    const s = blockedThenReady();
    const run = s.deps.run;
    s.deps.run = async (c, a, cwd) => {
      if (c === "git" && a[0] === "show-ref") {
        s.interrupt();
        return { kind: "failed", exitCode: 130 };
      }
      return run(c, a, cwd);
    };
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "y")]);
    expect(s.out.stdout).toContain("ABC-13  not started, because you stopped the watch.");
    expect(s.recorded.calls.some((c) => c.args[0] === "worktree" && c.args[1] === "add")).toBe(false);
    expect(git(s.clone.root, "branch", "--list", "abc-13")).toBe("");
    expect(existsSync(`${s.clone.root}-worktrees/abc-13`)).toBe(false);
    expect(s.interrupts.size).toBe(0);
    expect(code).toBe(0);
  });
});
