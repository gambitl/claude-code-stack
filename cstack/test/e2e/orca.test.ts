// The Orca features of cstack, run as the guides run them. Every cstack command is the built cstack in a child process,
// except the wave, which runs in process. The `orca` and `gh` that cstack reaches are the fake programs of test/e2e/bin.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChain, type Chain, type Waiter } from "./chain.js";

const CSTACK = join(import.meta.dirname, "..", "..");
const GUIDES = join(CSTACK, "guides", "resolve-issue");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");
const TICKET_GUIDE = read(GUIDES, "ticket.md");
const BUILD_GUIDE = read(GUIDES, "build.md");
const DOCUMENT_GUIDE = read(GUIDES, "document.md");
const PUBLISH_GUIDE = read(GUIDES, "publish.md");
const EXECUTOR = read(CSTACK, "skills", "resolve-issue", "agents", "executor.md");
const IMPLEMENTER = read(CSTACK, "skills", "resolve-issue", "agents", "implementer.md");

const TICKET_URL = "https://github.com/example-owner/example-repo/issues/4";
const REPO = "github.com/example-owner/example-repo";

let chain: Chain;

beforeAll(async () => {
  chain = await createChain({ orca: true });
}, 180_000);

afterAll(() => chain?.cleanup());

describe("the fake Orca", { timeout: 120_000 }, () => {
  it("is the orca that the environment of a child process reaches", () => {
    expect(Object.keys(chain.env).filter((name) => name.startsWith("ORCA_"))).toEqual([]);
    const version = chain.exec("orca", ["--version"]);
    expect(version.stdout.trim()).toBe("1.4.263");
    expect(chain.orcaCalls().map((c) => c.args)).toEqual([["--version"]]);
  });
});

describe("cstack wave, with Orca", { timeout: 120_000 }, () => {
  const wave = ["--milestone", "cstack recording", "--tracker", "github"];

  it("starts nothing when the answer is no", async () => {
    const out = await chain.wave(wave, "n");
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout).toContain("Started nothing.");
    expect(chain.orcaCalls().filter((c) => c.args[0] === "worktree")).toEqual([]);
  });

  it("creates one Orca worktree for the one ready ticket after the answer yes (US-14 AC3)", async () => {
    const out = await chain.wave(wave, "y");
    expect(out.code, out.stderr).toBe(0);
    expect(out.stdout, out.stderr).toContain("#4");
    const created = chain.orcaCalls().filter((c) => c.args.slice(0, 2).join(" ") === "worktree create");
    expect(created).toHaveLength(1);
    const args = created[0].args;
    const after = (flag: string) => args[args.indexOf(flag) + 1];
    expect(after("--reference")).toBe(TICKET_URL);
    expect(after("--agent")).toBe("claude");
    expect(after("--prompt")).toBe("/resolve-issue #4");
    expect(chain.orcaCalls().filter((c) => c.args.slice(0, 2).join(" ") === "reference find").map((c) => c.args[2])).toContain(TICKET_URL);
    // The tickets that wait for #4 start nothing, and the wave writes nothing in the tracker.
    expect(chain.ghCalls().filter((c) => c.args[0] === "issue" && ["edit", "comment"].includes(c.args[1]))).toEqual([]);
  });
});

describe("the executor and two implementers as Orca workers (US-13 AC1)", { timeout: 180_000 }, () => {
  let executorId = "";
  let waiter: Waiter;
  const implementers: { unit: number; id: string; path: string }[] = [];

  const idOf = (stdout: string) => stdout.split("\n")[0];

  it("reads the ticket, moves it to in progress and starts the executor as an Orca worker", () => {
    // The ticket worktree that the wave started has the branch of the ticket.
    chain.git("checkout", "-b", "issue-4");
    // The executor's first command sets the current run of the worktree, which `cstack helper wait` reads.
    const next = chain.follow(EXECUTOR, ["next", "--plan", chain.plan]);
    expect(next.code, next.stderr).toBe(0);
    expect(chain.git("status", "--porcelain")).toBe("");

    const ticket = chain.follow(TICKET_GUIDE, ["tracker", "read", "#4", "--tracker", "github"]);
    expect(ticket.code, ticket.stderr).toBe(0);
    expect(ticket.stdout).toContain("Recording blocker");

    const moved = chain.follow(BUILD_GUIDE, ["tracker", "move", "#4", "--to", "in progress", "--tracker", "github"]);
    expect(moved.code, moved.stderr).toBe(0);
    const edits = chain.ghCalls().filter((c) => c.args[0] === "issue" && c.args[1] === "edit");
    expect(edits.map((c) => c.args)).toEqual([["issue", "edit", "4", "--repo", REPO, "--add-label", "in progress", "--remove-label", "in review"]]);

    const started = chain.run(["helper", "start", "executor", "--plan", chain.plan]);
    expect(started.code, started.stderr).toBe(0);
    executorId = idOf(started.stdout);
    expect(executorId).toMatch(/-executor$/);
    expect(started.stdout).toContain(`cstack helper wait ${executorId}`);
    const start = chain.orcaCalls().filter((c) => c.args.slice(0, 2).join(" ") === "orchestration worker-start");
    expect(start).toHaveLength(1);
    expect(start[0].args).toContain("current");
  });

  it("waits for the executor, which stays pending while the implementers work", () => {
    waiter = chain.runInBackground(["helper", "wait", executorId]);
    expect(waiter.exitCode()).toBeNull();
  });

  it("starts both units of the one batch, each in its own child worktree", () => {
    const order = chain.follow(BUILD_GUIDE, ["unit", "order", "--plan", chain.plan]);
    expect(order.code, order.stderr).toBe(0);
    expect(order.stdout).toMatch(/^Batch 1: units 1, 2$/m);
    for (const unit of [1, 2]) {
      const started = chain.run(["helper", "start", "implementer", "--plan", chain.plan, "--unit", String(unit), "--child-worktree"]);
      expect(started.code, started.stderr).toBe(0);
      const path = chain.childPath(unit);
      expect(path).toBeDefined();
      implementers.push({ unit, id: idOf(started.stdout), path: path! });
    }
    expect(implementers[0].path).not.toBe(implementers[1].path);
    // cstack wrote a Worktree line under each unit in the plan file of the ticket worktree.
    const plan = read(chain.project, chain.plan);
    for (const { path } of implementers) expect(plan).toContain(path);
    expect(chain.orcaCalls().filter((c) => c.args.slice(0, 2).join(" ") === "orchestration worker-start")).toHaveLength(3);
  });

  it("lets each implementer prove its test first, commit, and send its report from its own child worktree", () => {
    for (const { unit, id, path } of implementers) {
      const name = unit === 1 ? "square" : "cube";
      chain.copyUnitFile(unit, `test/${name}.test.js`, path);
      const red = chain.follow(IMPLEMENTER, ["unit", "red", String(unit), "--plan", chain.plan], { cwd: path });
      expect(red.code, red.stderr).toBe(0);
      chain.copyUnitFile(unit, `src/${name}.js`, path);
      const green = chain.follow(IMPLEMENTER, ["unit", "green", String(unit), "--plan", chain.plan], { cwd: path });
      expect(green.code, green.stderr).toBe(0);
      const commit = chain.follow(IMPLEMENTER, ["unit", "commit", String(unit), "--plan", chain.plan], { cwd: path });
      expect(commit.code, commit.stderr).toBe(0);
      const done = chain.run(["helper", "done", "done", "--helper", id, "--plan", chain.plan], { input: `Unit ${unit} is committed.\n`, cwd: path });
      expect(done.code, done.stderr).toBe(0);
    }
  });

  it("keeps the executor waiting after both implementers have sent their reports", () => {
    expect(chain.sentDispatches()).toHaveLength(2);
    expect(waiter.exitCode()).toBeNull();
    for (const { unit, id } of implementers) {
      const waited = chain.run(["helper", "wait", id]);
      expect(waited.code, waited.stderr).toBe(0);
      expect(waited.stdout).toBe(`done\nUnit ${unit} is committed.\n`);
    }
    expect(waiter.exitCode()).toBeNull();
  });

  it("collects both units onto the ticket branch and removes the child worktrees", () => {
    const collected = chain.run(["unit", "collect", "1", "2", "--plan", chain.plan]);
    expect(collected.code, collected.stderr).toBe(0);
    expect(collected.stdout).toContain("Unit 1: applied 1 commit.");
    expect(collected.stdout).toContain("Unit 2: applied 1 commit.");
    expect(existsSync(join(chain.project, "src", "square.js"))).toBe(true);
    expect(existsSync(join(chain.project, "src", "cube.js"))).toBe(true);
    const trailers = chain.git("log", "--format=%(trailers:key=Cstack-Unit,valueonly)", "main..HEAD").split("\n").filter(Boolean).sort();
    expect(trailers).toEqual(["1", "2"]);
    const calls = chain.orcaCalls().map((c) => c.args.join(" "));
    for (const { id, path } of implementers) {
      expect(calls).toContain(`orchestration worker-release --dispatch ${chain.dispatchOf(id)} --json`);
      expect(calls.some((c) => c.startsWith("worktree rm --worktree path:") && c.includes(path))).toBe(true);
      expect(existsSync(path)).toBe(false);
    }
    const status = chain.follow(BUILD_GUIDE, ["plan", "status", "--plan", chain.plan]);
    expect(status.code, status.stderr).toBe(0);
    expect(status.stdout).toMatch(/^Unit 1: .*: done \(/m);
    expect(status.stdout).toMatch(/^Unit 2: .*: done \(/m);
  });

  it("posts a comment and moves the ticket to in review through gh", () => {
    const file = join(chain.temp, "comment.md");
    writeFileSync(file, "The squares are in place.\n");
    const posted = chain.follow(DOCUMENT_GUIDE, ["tracker", "comment", "#4", "--body-file", file, "--tracker", "github"]);
    expect(posted.code, posted.stderr).toBe(0);
    expect(chain.ghBodies()).toEqual(["The squares are in place.\n"]);
    const moved = chain.follow(PUBLISH_GUIDE, ["tracker", "move", "#4", "--to", "in review", "--tracker", "github"]);
    expect(moved.code, moved.stderr).toBe(0);
    const edits = chain.ghCalls().filter((c) => c.args[0] === "issue" && c.args[1] === "edit");
    expect(edits.at(-1)!.args).toEqual(["issue", "edit", "4", "--repo", REPO, "--add-label", "in review", "--remove-label", "in progress"]);
  });

  it("returns the wait of the executor only after the last worker_done, with its needs-decision report", async () => {
    expect(waiter.exitCode()).toBeNull();
    const report = "Question: should the cube also be exported as a default?\n";
    const done = chain.run(["helper", "done", "needs-decision", "--helper", executorId, "--plan", chain.plan], { input: report });
    expect(done.code, done.stderr).toBe(0);
    const ended = await waiter.finished(90_000);
    expect(ended.code, ended.stderr).toBe(0);
    expect(ended.stdout).toBe(`needs-decision\n${report}`);

    // In the log of the fake Orca, both implementers send first, then the executor sends, then the executor shows as completed.
    const events = chain.orcaCalls().flatMap((c) => {
      const command = c.args.slice(0, 2).join(" ");
      if (command === "orchestration send") return [`send ${c.args[c.args.indexOf("--dispatch-id") + 1]}`];
      if (command === "orchestration worker-show" && c.status === "completed") return [`completed ${c.args[c.args.indexOf("--dispatch") + 1]}`];
      return [];
    });
    const executor = chain.dispatchOf(executorId);
    const at = (event: string) => events.indexOf(event);
    expect(at(`send ${executor}`)).toBeGreaterThanOrEqual(0);
    for (const { id } of implementers) expect(at(`send ${chain.dispatchOf(id)}`)).toBeLessThan(at(`send ${executor}`));
    expect(at(`completed ${executor}`)).toBeGreaterThan(at(`send ${executor}`));
    expect(events.filter((e) => e === `send ${executor}`)).toHaveLength(1);
  });

  it("never reached the real home folder or a real program", () => {
    expect(existsSync(join(chain.home, ".claude"))).toBe(false);
    expect(chain.pathPrograms()).toEqual(["gh", "git", "node", "orca"]);
  });
});
