import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { orcaFeatures } from "../../src/orca/features.js";
import type { RunResult, Runner } from "../../src/orca/run.js";

const dir = join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263");
const text = (file: string) => readFileSync(join(dir, file), "utf8");

const STATUS = "status --json";
const JIRA = "jira connection --json";
const LINEAR = "linear team list --workspace all --json";

function setup(over: Record<string, string> = {}) {
  const answers: Record<string, string> = {
    "--version": text("version.current.txt"),
    [STATUS]: text("status.running.json"),
    "agent-context --json": text("agent-context.current.json"),
    [JIRA]: text("jira-connection.one-site.json"),
    [LINEAR]: text("linear-team-list.connected.json"),
    ...over,
  };
  const calls: string[] = [];
  const run: Runner = async (_c, args): Promise<RunResult> => {
    const key = args.join(" ");
    calls.push(key);
    const stdout = answers[key];
    return stdout === undefined ? { kind: "missing" } : { kind: "ok", stdout };
  };
  return { features: orcaFeatures(run, {}), calls };
}

const ALL = ["workers", "child-worktrees", "ticket-worktrees", "jira", "linear"] as const;

describe("orca features", () => {
  it("makes every feature unavailable below the minimum version", async () => {
    const { features } = setup({ "--version": "1.4.258\n" });
    for (const name of ALL) {
      const f = await features.get(name);
      expect(f.available).toBe(false);
      expect(f.available === false && f.reason).toContain("1.4.259");
    }
  });

  it("makes every feature available with the recorded answers", async () => {
    const { features } = setup();
    for (const name of ALL) expect(await features.get(name)).toEqual({ available: true });
  });

  it("makes every feature unavailable when Orca is closed", async () => {
    const { features } = setup({ [STATUS]: text("status.closed.json") });
    for (const name of ALL) expect((await features.get(name)).available).toBe(false);
  });

  it("makes only Jira unavailable with no Jira site", async () => {
    const { features } = setup({ [JIRA]: text("jira-connection.empty.json") });
    const jira = await features.get("jira");
    expect(jira.available === false && jira.reason).toContain("no saved Jira site");
    expect((await features.get("linear")).available).toBe(true);
    expect((await features.get("workers")).available).toBe(true);
  });

  it("explains two Jira sites", async () => {
    const { features } = setup({ [JIRA]: text("jira-connection.two-sites.json") });
    const jira = await features.get("jira");
    expect(jira.available === false && jira.reason).toMatch(/2 .*cannot choose a site/);
  });

  it("explains several saved Linear workspaces", async () => {
    const { features } = setup({ [LINEAR]: text("linear-team-list.two-workspaces.json") });
    const linear = await features.get("linear");
    expect(linear.available).toBe(false);
    expect(linear.available === false && linear.reason).toMatch(
      /2 .*workspaces.*cannot choose a workspace/,
    );
  });

  it("explains a Linear connection error and no team", async () => {
    const { features } = setup({ [LINEAR]: text("linear-team-list.error.json") });
    const linear = await features.get("linear");
    expect(linear.available).toBe(false);
    const empty = setup({ [LINEAR]: text("linear-team-list.empty.json") });
    expect((await empty.features.get("linear")).available).toBe(false);
  });

  it("names a renamed field", async () => {
    const answer = JSON.parse(text("status.running.json"));
    answer.result.runtime.reachability = answer.result.runtime.reachable;
    delete answer.result.runtime.reachable;
    const { features } = setup({ [STATUS]: JSON.stringify(answer) });
    const f = await features.get("workers");
    expect(f.available === false && f.reason).toContain("result.runtime.reachable");
  });

  it("runs only what is needed, and each command once", async () => {
    const { features, calls } = setup();
    await features.get("jira");
    await features.get("jira");
    expect(calls).not.toContain(LINEAR);
    await features.get("linear");
    await features.get("workers");
    for (const c of new Set(calls)) expect(calls.filter((x) => x === c)).toHaveLength(1);
  });
});
