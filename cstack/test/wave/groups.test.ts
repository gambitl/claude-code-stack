import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { wave, type WaveDeps } from "../../src/commands/wave.js";
import { NoClientError } from "../../src/tracker/errors.js";
import { checkedTracker } from "../../src/tracker/checked.js";
import { FakeTracker } from "../fakes/tracker.js";
import { collect, git } from "../helpers/plan-repo.js";
import { makeClone, makeRunner, ticket } from "../helpers/wave.js";

function setup(tickets: ReturnType<typeof ticket>[], options: { terminal?: boolean; cwd?: string } = {}) {
  const clone = options.cwd === undefined ? makeClone() : undefined;
  const { run, calls } = makeRunner();
  const { out, io } = collect();
  const fake = new FakeTracker({ tickets, groups: [{ group: { milestone: "M3" }, keys: tickets.map((t) => t.key) }] });
  const deps: WaveDeps = {
    cwd: options.cwd ?? clone!.root,
    env: {},
    run,
    runLong: run,
    isTerminal: () => options.terminal ?? false,
    readAnswer: async () => "",
    openTracker: async (_capability, o) => checkedTracker(fake, o.tracker ?? "github", o.warn),
  };
  return { clone, calls, out, io, deps };
}

const args = ["--milestone", "M3", "--tracker", "github"];

describe("cstack wave: the three groups", () => {
  it("lists ready, blocked and started tickets and starts nothing without a terminal", async () => {
    const { clone, calls, out, io, deps } = setup([
      ticket("#1"),
      ticket("#2", { blockers: [{ key: "#6", stateKind: "todo" }] }),
      ticket("#3", { stateName: "In progress", stateKind: "in-progress" }),
      ticket("#4"),
      ticket("#5", { stateName: "Done", stateKind: "finished" }),
    ]);
    git(clone!.root, "worktree", "add", "-b", "issue-4", join(clone!.root, "..", "wt-4"));
    const code = await wave(args, io, deps);
    expect(code).toBe(0);
    expect(out.stdout).toContain("Ready (1):\n  #1  Title of #1");
    expect(out.stdout).toContain("Blocked (1):\n  #2  Title of #2  blocked by #6 (to do)");
    expect(out.stdout).toContain("Already started (2):");
    expect(out.stdout).toContain("  #3  Title of #3  in progress");
    expect(out.stdout).toMatch(/  #4  Title of #4  .*wt-4/);
    expect(out.stdout).toContain("1 finished ticket is not listed.");
    expect(out.stdout).toContain("needs a terminal");
    expect(calls.some((c) => c.command === "git" && c.args[0] === "worktree" && c.args[1] === "add")).toBe(false);
  });

  it("says when the blockers or the state are unknown, and cleans the title", async () => {
    const { out, io, deps } = setup([
      ticket("#1", { blockers: "unknown" }),
      ticket("#2", { stateName: "Weird\u001b[31m", stateKind: "unknown" }),
      ticket("#3", { title: "Fix \u001b[31mred\u001b[0m thing" }),
    ]);
    expect(await wave(args, io, deps)).toBe(0);
    expect(out.stdout).toContain("#1  Title of #1  blockers unknown");
    expect(out.stdout).toContain('#2  Title of #2  unknown state "Weird"');
    expect(out.stdout).toContain("#3  Fix red thing");
  });

  it("skips a ticket whose key is bad and names it on standard error", async () => {
    const { out, io, deps } = setup([ticket("#1"), ticket("not a key")]);
    const err = collect();
    const code = await wave(args, { stdout: io.stdout, stderr: err.io.stderr }, deps);
    expect(code).toBe(0);
    expect(out.stdout).toContain("Ready (1):");
    expect(err.out.stderr).toContain("not a key");
  });

  it("exits with 2 and shows the usage line when no group flag, or both, is given", async () => {
    for (const a of [["--tracker", "github"], ["--milestone", "M3", "--epic", "#1"]]) {
      const { out, io, deps } = setup([ticket("#1")]);
      expect(await wave(a, io, deps)).toBe(2);
      expect(out.stderr).toContain("cstack wave (--milestone <name> | --epic <key>)");
    }
  });

  it("exits with 4 and prints the message when no client exists", async () => {
    const { out, io, deps } = setup([ticket("#1")]);
    deps.openTracker = async () => {
      throw NoClientError.forRead("a group of tickets");
    };
    expect(await wave(args, io, deps)).toBe(4);
    expect(out.stderr).toContain("group of tickets");
  });

  it("exits with 1 when the main entry is a bare repository", async () => {
    const bare = mkdtempSync(join(tmpdir(), "cstack-bare-"));
    execFileSync("git", ["init", "--bare", "-b", "main", bare], { stdio: "ignore" });
    const { out, io, deps } = setup([ticket("#1")], { cwd: bare });
    expect(await wave(args, io, deps)).toBe(1);
    expect(out.stderr).toContain("bare");
  });
});
