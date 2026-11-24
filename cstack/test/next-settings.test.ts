import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { next } from "../src/commands/next.js";
import { readState } from "../src/run-state.js";
import { collect, commitPlan, makeRepo } from "./helpers/plan-repo.js";

const packageRoot = join(import.meta.dirname, "fixtures/next");
const fixture = (name: string) => readFileSync(join(import.meta.dirname, "fixtures/plans", name), "utf8");
const NOW = () => new Date("2026-11-19T09:00:00.000Z");

async function run(cwd: string, ...args: string[]) {
  const { out, io } = collect();
  const code = await next(args, io, { cwd, packageRoot, now: NOW });
  return { code, ...out };
}

function writeSettings(dir: string, value: unknown): void {
  mkdirSync(join(dir, ".cstack"), { recursive: true });
  writeFileSync(join(dir, ".cstack", "settings.json"), JSON.stringify({ version: 1, ...(value as object) }));
}

describe("cstack next and the settings", () => {
  it("exits with 3 on an invalid settings file and prints nothing else", async () => {
    const dir = makeRepo();
    writeSettings(dir, { reviewer: "x" });
    const result = await run(dir);
    expect(result.code).toBe(3);
    expect(result.stderr).toContain("reviewer");
    expect(result.stdout).toBe("");
    expect(existsSync(join(dir, ".git", "cstack", "current-run"))).toBe(false);
  });

  it("prints the run line, then the settings block, then the guide", async () => {
    const dir = makeRepo();
    writeSettings(dir, { testCommands: { all: "npm test" }, commitAttribution: ["Co-Authored-By: A <a@example.com>"] });
    const { stdout, code } = await run(dir);
    expect(code).toBe(0);
    const run1 = stdout.indexOf("Run: none yet.");
    const block = stdout.indexOf("Settings of this repository (.cstack/settings.json):");
    const guide = stdout.indexOf("marker-ticket");
    expect(run1).toBeGreaterThanOrEqual(0);
    expect(block).toBeGreaterThan(run1);
    expect(guide).toBeGreaterThan(block);
    expect(stdout).toContain('- testCommands: {"all":"npm test"}\n');
    expect(stdout).toContain('- commitAttribution: ["Co-Authored-By: A <a@example.com>"]\n');
    expect(stdout).toContain('- integration: "rebase" (default)\n');
    const keys = [...stdout.matchAll(/^- (\w+):/gm)].map((m) => m[1]);
    expect(keys).toEqual([
      "integration",
      "recordsLanguage",
      "forbiddenTools",
      "commitAttribution",
      "testCommands",
      "review",
    ]);
    expect(stdout).toContain("\n\n");
  });

  it("says that testCommands is not set when the file leaves it out", async () => {
    const dir = makeRepo();
    writeSettings(dir, { integration: "merge" });
    const { stdout } = await run(dir);
    expect(stdout).toContain("- testCommands: not set (default)\n");
    expect(stdout).toContain('- integration: "merge"\n');
  });

  it("says that the file is missing", async () => {
    const dir = makeRepo();
    const { stdout } = await run(dir);
    expect(stdout).toContain(
      "Settings of this repository: there is no .cstack/settings.json, so every value is the default.\n",
    );
  });

  it("does not mark a phase done or write a header line when the file is invalid", async () => {
    const dir = makeRepo();
    const plan = fixture("approved.md");
    commitPlan(dir, plan, "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    writeSettings(dir, { reviewer: "x" });
    const result = await run(dir, "--done", "build", "--plan", "docs/plans/x.md");
    expect(result.code).toBe(3);
    expect(readState(dir, "docs/plans/x.md")?.phases.build?.doneAt).toBeUndefined();
    expect(readFileSync(join(dir, "docs/plans/x.md"), "utf8")).toBe(plan);
  });

  it("does not clear the current run with --new when the file is invalid", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    writeSettings(dir, { reviewer: "x" });
    const result = await run(dir, "--new");
    expect(result.code).toBe(3);
    expect(existsSync(join(dir, ".git", "cstack", "current-run"))).toBe(true);
  });

  it("prints no block for a one-line answer", async () => {
    const dir = makeRepo();
    commitPlan(dir, fixture("approved.md"), "docs/plans/x.md");
    await run(dir, "--plan", "docs/plans/x.md");
    const result = await run(dir, "--done", "build");
    expect(result.stdout).not.toContain("Settings of this repository");
  });
});
