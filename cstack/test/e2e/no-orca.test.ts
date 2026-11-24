// The chain of orca.test.ts, run without a usable Orca: with no `orca` program, with an Orca older than the minimum, and with an Orca that is closed.
// Every cstack command is the built cstack in a child process, except the wave, which runs in process. The `gh` that cstack reaches is the fake program of test/e2e/bin.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createChain, type Chain } from "./chain.js";

const CSTACK = join(import.meta.dirname, "..", "..");
const GUIDES = join(CSTACK, "guides", "resolve-issue");
const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");
const TICKET_GUIDE = read(GUIDES, "ticket.md");
const PLAN_GUIDE = read(GUIDES, "plan.md");
const BUILD_GUIDE = read(GUIDES, "build.md");
const DOCUMENT_GUIDE = read(GUIDES, "document.md");
const PUBLISH_GUIDE = read(GUIDES, "publish.md");
const EXECUTOR = read(CSTACK, "skills", "resolve-issue", "agents", "executor.md");
const IMPLEMENTER = read(CSTACK, "skills", "resolve-issue", "agents", "implementer.md");

const REPO = "github.com/example-owner/example-repo";
const idOf = (stdout: string) => /^Helper id: (.+)$/m.exec(stdout)![1];

const runs = [
  { name: "no orca on the PATH", options: { orca: false } },
  { name: "an Orca older than 1.4.259", options: { orca: true, orcaMode: "old" as const } },
  { name: "a closed Orca", options: { orca: true, orcaMode: "closed" as const } },
];

describe.each(runs)("the chain with $name", ({ options }) => {
  let chain: Chain;

  beforeAll(async () => {
    chain = await createChain(options);
  }, 180_000);

  afterAll(() => chain?.cleanup());

  it("creates one git worktree after the answer yes and prints the command that starts the ticket", async () => {
    chain.git("remote", "set-head", "origin", "main");
    const out = await chain.wave(["--milestone", "cstack recording", "--tracker", "github"], "y");
    expect(out.code, out.stderr).toBe(0);
    const folder = join(chain.temp, "project-worktrees", "issue-4");
    const commands = out.stdout.match(/cd '[^\n]*' && claude '[^\n]*'/g);
    expect(commands).toEqual([`cd '${folder}' && claude '/resolve-issue #4'`]);
    expect(chain.git("worktree", "list", "--porcelain").split("\n").filter((l) => l.startsWith("worktree "))).toHaveLength(2);
    expect(chain.orcaCalls().filter((c) => c.args[0] === "worktree")).toEqual([]);
    // The rest of the chain plays the ticket worktree in the project folder, so the worktree of the wave goes away.
    chain.git("worktree", "remove", folder);
    chain.git("branch", "-D", "issue-4");
  }, 120_000);

  it("answers the helpers with the sub-agent and its inputs, and runs the two implementers one after the other", () => {
    chain.git("checkout", "-b", "issue-4");
    expect(chain.follow(EXECUTOR, ["next", "--plan", chain.plan]).code).toBe(0);
    const executor = chain.follow(PLAN_GUIDE, ["helper", "start", "executor", "--plan", chain.plan]);
    expect(executor.code, executor.stderr).toBe(6);
    expect(executor.stdout).toContain("Sub-agent: resolve-issue:executor");
    expect(executor.stdout).toContain("- Plan file:");

    for (const unit of [1, 2]) {
      const name = unit === 1 ? "square" : "cube";
      const started = chain.run(["helper", "start", "implementer", "--plan", chain.plan, "--unit", String(unit), "--child-worktree"]);
      expect(started.code, started.stderr).toBe(6);
      expect(started.stdout).toContain("Sub-agent: resolve-issue:implementer");
      expect(started.stdout).toContain(`- Unit number: ${unit}`);
      expect(chain.childPath(unit)).toBeUndefined();

      // The implementer works in the ticket worktree, one unit after the other.
      chain.copyUnitFile(unit, `test/${name}.test.js`, chain.project);
      expect(chain.follow(IMPLEMENTER, ["unit", "red", String(unit), "--plan", chain.plan]).code).toBe(0);
      chain.copyUnitFile(unit, `src/${name}.js`, chain.project);
      expect(chain.follow(IMPLEMENTER, ["unit", "green", String(unit), "--plan", chain.plan]).code).toBe(0);
      const commit = chain.follow(IMPLEMENTER, ["unit", "commit", String(unit), "--plan", chain.plan]);
      expect(commit.code, commit.stderr).toBe(0);
      const id = idOf(started.stdout);
      const done = chain.run(["helper", "done", "done", "--helper", id, "--plan", chain.plan], { input: `Unit ${unit} is committed.\n` });
      expect(done.code, done.stderr).toBe(0);
      const waited = chain.run(["helper", "wait", id]);
      expect(waited.code, waited.stderr).toBe(0);
      expect(waited.stdout).toBe(`done\nUnit ${unit} is committed.\n`);
    }
  }, 150_000);

  it("skips both units in the collect, because no unit ran in a child worktree", () => {
    const collected = chain.run(["unit", "collect", "1", "2", "--plan", chain.plan]);
    expect(collected.code, collected.stderr).toBe(0);
    expect(collected.stdout).toContain("Unit 1 was skipped");
    expect(collected.stdout).toContain("Unit 2 was skipped");
    expect(chain.orcaCalls().filter((c) => c.args[0] === "worktree" || c.args[1] === "worker-start")).toEqual([]);
  });

  it("reads, comments and moves the ticket through the fake gh", () => {
    const ticket = chain.follow(TICKET_GUIDE, ["tracker", "read", "#4", "--tracker", "github"]);
    expect(ticket.code, ticket.stderr).toBe(0);
    const file = join(chain.temp, "comment.md");
    writeFileSync(file, "The squares are in place.\n");
    const posted = chain.follow(DOCUMENT_GUIDE, ["tracker", "comment", "#4", "--body-file", file, "--tracker", "github"]);
    expect(posted.code, posted.stderr).toBe(0);
    const moved = chain.follow(PUBLISH_GUIDE, ["tracker", "move", "#4", "--to", "in review", "--tracker", "github"]);
    expect(moved.code, moved.stderr).toBe(0);
    const edits = chain.ghCalls().filter((c) => c.args[0] === "issue" && c.args[1] === "edit");
    expect(edits.at(-1)!.args).toEqual(["issue", "edit", "4", "--repo", REPO, "--add-label", "in review", "--remove-label", "in progress"]);
  });
});

describe("the tracker commands with no gh on the PATH", { timeout: 120_000 }, () => {
  let chain: Chain;

  beforeAll(async () => {
    chain = await createChain({ orca: false, gh: false });
  }, 180_000);

  afterAll(() => chain?.cleanup());

  it("exits with 4 for read, move and comment", () => {
    expect(chain.pathPrograms()).toEqual(["git", "node"]);
    const file = join(chain.temp, "comment.md");
    writeFileSync(file, "A comment.\n");
    for (const args of [
      ["tracker", "read", "#4", "--tracker", "github"],
      ["tracker", "move", "#4", "--to", "in review", "--tracker", "github"],
      ["tracker", "comment", "#4", "--body-file", file, "--tracker", "github"],
    ]) {
      const result = chain.run(args);
      expect(result.code, `${args.join(" ")}: ${result.stderr}`).toBe(4);
    }
  });
});
