import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RunResult, Runner } from "../../src/orca/run.js";
import { githubGhTracker } from "../../src/tracker/github-gh.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures", "gh", "2.101.0");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf8");
const ok = (name: string): RunResult => ({ kind: "ok", stdout: fixture(name) });

const REPO = "github.com/example-owner/example-repo";
const FIELDS = "number,title,body,url,state,stateReason,labels,blockedBy";

type Answer = RunResult | ((args: string[]) => RunResult);

/** A fake runner. It answers `git config` itself and records every `gh` call. */
function fake(answers: Record<string, Answer>) {
  const calls: string[][] = [];
  const runner: Runner = async (command, args) => {
    if (command === "git") return { kind: "ok", stdout: "https://github.com/example-owner/example-repo.git\n" };
    expect(command).toBe("gh");
    calls.push(args);
    const answer = answers[args.join(" ")];
    if (answer === undefined) throw new Error(`unexpected call: gh ${args.join(" ")}`);
    return typeof answer === "function" ? answer(args) : answer;
  };
  const warnings: string[] = [];
  return { tracker: githubGhTracker(runner, "/repo", (m) => warnings.push(m)), calls, warnings };
}

const view = (n: number, fields = FIELDS) => `issue view ${n} --repo ${REPO} --json ${fields}`;
const stateCall = (n: number) => view(n, "number,state,labels");

describe("githubGhTracker.listGroup with a milestone", () => {
  it("makes one call and takes the blocker state from the group", async () => {
    const list = `issue list --repo ${REPO} --milestone cstack recording --state all --limit 500 --json ${FIELDS}`;
    const { tracker, calls } = fake({ [list]: ok("issue-list.milestone.json") });
    const tickets = await tracker.listGroup({ milestone: "cstack recording" });
    expect(calls).toEqual([["issue", "list", "--repo", REPO, "--milestone", "cstack recording", "--state", "all", "--limit", "500", "--json", FIELDS]]);
    const blocked = tickets.find((t) => t.key === "#5");
    expect(blocked?.blockers).toEqual([{ key: "#4", stateKind: "todo" }]);
    expect(tickets.find((t) => t.key === "#6")?.blockers).toEqual([{ key: "#4", stateKind: "todo" }]);
    expect(blocked).toMatchObject({ stateName: "open", stateKind: "todo", title: "Recording blocked issue" });
  });

  it("refuses an answer of 500 issues with exit 1", async () => {
    const many = JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ number: i + 1, title: "t", body: "", url: `https://github.com/example-owner/example-repo/issues/${i + 1}`, state: "CLOSED", labels: [], blockedBy: { nodes: [], totalCount: 0 } })));
    const { tracker } = fake({ [`issue list --repo ${REPO} --milestone m --state all --limit 500 --json ${FIELDS}`]: { kind: "ok", stdout: many } });
    await expect(tracker.listGroup({ milestone: "m" })).rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining("more tickets than cstack reads") });
  });
});

describe("githubGhTracker.readTicket", () => {
  it("takes the blocker from blockedBy and looks up its labels", async () => {
    const { tracker, calls } = fake({ [view(5)]: ok("issue-view.blocked-by.json"), [stateCall(4)]: ok("issue-view.state.json") });
    const ticket = await tracker.readTicket("#5");
    expect(ticket.blockers).toEqual([{ key: "#4", stateKind: "todo" }]);
    expect(calls).toHaveLength(2);
  });

  it("takes the blocker from the footer and looks up its state", async () => {
    const { tracker } = fake({ [view(6)]: ok("issue-view.footer-only.json"), [stateCall(4)]: ok("issue-view.state.json") });
    expect((await tracker.readTicket("#6")).blockers).toEqual([{ key: "#4", stateKind: "todo" }]);
  });

  it("names the progress label as the state", async () => {
    const { tracker } = fake({ [view(5)]: ok("issue-view.in-progress.json"), [stateCall(4)]: ok("issue-view.state.json") });
    expect(await tracker.readTicket("#5")).toMatchObject({ stateName: "in progress", stateKind: "in-progress" });
  });

  it("drops a closed blocker in another repository and keeps an open one as unknown with a warning", async () => {
    const withBlocker = (state: string) =>
      JSON.stringify({ ...JSON.parse(fixture("issue-view.blocked-by.json")), blockedBy: { nodes: [{ number: 7, state, url: "https://github.com/other-owner/other-repo/issues/7" }], totalCount: 1 } });
    const closed = fake({ [view(5)]: { kind: "ok", stdout: withBlocker("CLOSED") } });
    expect((await closed.tracker.readTicket("#5")).blockers).toEqual([]);
    const open = fake({ [view(5)]: { kind: "ok", stdout: withBlocker("OPEN") } });
    expect((await open.tracker.readTicket("#5")).blockers).toBe("unknown");
    expect(open.warnings.join("\n")).toContain("https://github.com/other-owner/other-repo/issues/7");
  });

  it("gives unknown blockers when blockedBy holds fewer nodes than its total", async () => {
    const short = JSON.stringify({ ...JSON.parse(fixture("issue-view.blocked-by.json")), blockedBy: { nodes: [], totalCount: 3 } });
    const { tracker, warnings } = fake({ [view(5)]: { kind: "ok", stdout: short } });
    expect((await tracker.readTicket("#5")).blockers).toBe("unknown");
    expect(warnings).toHaveLength(1);
  });

  it("maps a failed call to exit 5 and a missing gh to exit 4", async () => {
    const failed = fake({ [view(9999)]: { kind: "failed", exitCode: 1, stderr: fixture("issue-view.not-found.txt") } });
    await expect(failed.tracker.readTicket("#9999")).rejects.toMatchObject({ exitCode: 5 });
    const missing = fake({ [view(5)]: { kind: "missing" } });
    await expect(missing.tracker.readTicket("#5")).rejects.toMatchObject({ exitCode: 4 });
  });
});

describe("githubGhTracker.listGroup with an epic", () => {
  const subs = view(3, "subIssues");
  const search = `issue list --repo ${REPO} --search parent-issue:example-owner/example-repo#3 --state all --limit 500 --json ${FIELDS}`;

  it("reads subIssues, then one search, and reads alone each number the search missed", async () => {
    const onlyFive = JSON.stringify(JSON.parse(fixture("issue-list.parent-issue.json")).slice(0, 1));
    const { tracker, calls } = fake({
      [subs]: ok("issue-view.sub-issues.json"),
      [search]: { kind: "ok", stdout: onlyFive },
      [view(4)]: { kind: "ok", stdout: JSON.stringify(JSON.parse(fixture("issue-list.milestone.json"))[2]) },
    });
    const tickets = await tracker.listGroup({ epic: "#3" });
    expect(tickets.map((t) => t.key)).toEqual(["#5", "#4"]);
    expect(calls.map((c) => c.slice(0, 2).join(" "))).toEqual(["issue view", "issue list", "issue view"]);
    expect(tickets[0].blockers).toEqual([{ key: "#4", stateKind: "todo" }]);
  });

  it("refuses when the nodes differ from totalCount", async () => {
    const bad = JSON.stringify({ subIssues: { nodes: [], totalCount: 2 } });
    const { tracker, calls } = fake({ [subs]: { kind: "ok", stdout: bad } });
    await expect(tracker.listGroup({ epic: "#3" })).rejects.toMatchObject({ exitCode: 1 });
    expect(calls).toHaveLength(1);
  });

  it("skips a sub-issue of another repository with a warning", async () => {
    const other = JSON.stringify({ subIssues: { nodes: [{ number: 8, state: "OPEN", url: "https://github.com/other-owner/other-repo/issues/8" }], totalCount: 1 } });
    const { tracker, warnings, calls } = fake({ [subs]: { kind: "ok", stdout: other } });
    expect(await tracker.listGroup({ epic: "#3" })).toEqual([]);
    expect(warnings.join("\n")).toContain("other-repo/issues/8");
    expect(calls).toHaveLength(1);
  });
});
