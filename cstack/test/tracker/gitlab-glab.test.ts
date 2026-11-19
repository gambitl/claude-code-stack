import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RunResult, Runner } from "../../src/orca/run.js";
import { gitlabGlabTracker } from "../../src/tracker/gitlab-glab.js";

const dir = new URL("../fixtures/glab/1.119.0/", import.meta.url);
const fixture = (name: string) => readFileSync(new URL(name, dir), "utf8");
const R = "https://gitlab.com/example-group/example-project";
const API = "projects/example-group%2Fexample-project";

const ok = (stdout: string): RunResult => ({ kind: "ok", stdout });
const issue = (iid: number, over: Record<string, unknown> = {}) => ({
  iid, title: `t${iid}`, description: "", state: "opened", labels: [],
  web_url: `https://gitlab.com/example-group/example-project/-/issues/${iid}`, ...over,
});
const link = (iid: number, type: string, over: Record<string, unknown> = {}) => ({
  ...issue(iid), link_type: type, references: { full: `example-group/example-project#${iid}` }, ...over,
});

/** A fake runner: `answers` maps the joined command line to a result. Every call is recorded. */
function fake(answers: Record<string, RunResult | ((n: number) => RunResult)>) {
  const calls: string[] = [];
  const runner: Runner = async (command, args, cwd) => {
    const line = [command, ...args].join(" ");
    calls.push(line);
    if (line === "git config --get remote.origin.url") return ok("https://gitlab.com/example-group/example-project.git\n");
    expect(cwd).toBe("/root");
    const a = answers[line];
    if (a === undefined) return { kind: "failed", exitCode: 1, stderr: `unexpected call: ${line}` };
    return typeof a === "function" ? a(calls.length) : a;
  };
  return { runner, calls, glab: () => calls.filter((c) => c.startsWith("glab")) };
}
const view = (n: number) => `glab issue view ${n} -R ${R} --output json`;
const links = (n: number) => `glab api --hostname gitlab.com ${API}/issues/${n}/links`;
const list = (page: number) => `glab issue list --milestone cstack recording -R ${R} --output json --per-page 100 --page ${page}`;

describe("gitlabGlabTracker readTicket", () => {
  it("reads the issue and its links, and takes the blocker from the is_blocked_by link and the footer", async () => {
    const warnings: string[] = [];
    const { runner, glab } = fake({
      [view(7)]: ok(fixture("issue-view.opened.json")),
      [links(7)]: ok(fixture("api-issue-links.blocked-by.json")),
      [view(3)]: ok(JSON.stringify(issue(3, { state: "closed" }))),
    });
    const t = await gitlabGlabTracker(runner, "/root", (m) => warnings.push(m)).readTicket("#7");
    expect(glab()).toEqual([view(7), links(7), view(3)]);
    expect(t).toMatchObject({
      key: "#7", title: "Show the first page", stateName: "opened", stateKind: "todo",
      url: "https://gitlab.com/example-group/example-project/-/issues/7",
    });
    expect(t.blockers).toEqual([{ key: "#5", stateKind: "todo" }, { key: "#3", stateKind: "finished" }]);
    expect(warnings).toEqual([]);
  });

  it("takes the blockers from the footer when the links hold only relates_to", async () => {
    const { runner } = fake({
      [view(7)]: ok(fixture("issue-view.opened.json")),
      [links(7)]: ok(fixture("api-issue-links.relates-to.json")),
      [view(3)]: ok(JSON.stringify(issue(3))),
    });
    const t = await gitlabGlabTracker(runner, "/root", () => {}).readTicket("#7");
    expect(t.blockers).toEqual([{ key: "#3", stateKind: "todo" }]);
  });

  it("makes the blockers unknown and warns for an open blocker of another project, and drops a closed one", async () => {
    const warnings: string[] = [];
    const other = (iid: number, state: string) =>
      link(iid, "is_blocked_by", { state, references: { full: `other-group/other#${iid}` }, web_url: `https://gitlab.com/other-group/other/-/issues/${iid}` });
    const body = JSON.stringify(issue(7));
    const a = fake({ [view(7)]: ok(body), [links(7)]: ok(JSON.stringify([other(2, "opened")])) });
    const open = await gitlabGlabTracker(a.runner, "/root", (m) => warnings.push(m)).readTicket("#7");
    expect(open.blockers).toBe("unknown");
    expect(warnings[0]).toContain("https://gitlab.com/other-group/other/-/issues/2");
    const b = fake({ [view(7)]: ok(body), [links(7)]: ok(JSON.stringify([other(2, "closed")])) });
    expect((await gitlabGlabTracker(b.runner, "/root", () => {}).readTicket("#7")).blockers).toEqual([]);
  });

  it("names the in review and in progress states, and closed", async () => {
    const t = async (over: Record<string, unknown>) => {
      const { runner } = fake({ [view(7)]: ok(JSON.stringify(issue(7, over))), [links(7)]: ok("[]") });
      return gitlabGlabTracker(runner, "/root", () => {}).readTicket("#7");
    };
    expect(await t({ labels: ["In Progress", "in review"] })).toMatchObject({ stateName: "in review", stateKind: "in-progress" });
    expect(await t({ labels: ["in progress"] })).toMatchObject({ stateName: "in progress", stateKind: "in-progress" });
    expect(await t({ state: "closed" })).toMatchObject({ stateName: "closed", stateKind: "finished" });
  });

  it("maps a 401 to exit 4 and another failure to exit 5", async () => {
    const f = (stderr: string) => fake({ [view(7)]: { kind: "failed", exitCode: 1, stderr } });
    await expect(gitlabGlabTracker(f("HTTP 401 Unauthorized").runner, "/root", () => {}).readTicket("#7")).rejects.toMatchObject({ exitCode: 4 });
    await expect(gitlabGlabTracker(f("boom").runner, "/root", () => {}).readTicket("#7")).rejects.toMatchObject({ exitCode: 5 });
  });
});

describe("gitlabGlabTracker listGroup", () => {
  it("refuses an epic with exit 1 and makes no call", async () => {
    const { runner, calls } = fake({});
    const err = await gitlabGlabTracker(runner, "/root", () => {}).listGroup({ epic: "#1" }).catch((e) => e);
    expect(err.exitCode).toBe(1);
    expect(err.message).toContain("--milestone");
    expect(calls).toEqual([]);
  });

  it("reads the first page, and the links of the open issues only", async () => {
    const { runner, glab } = fake({
      [list(1)]: ok(fixture("issue-list.page-1.json")),
      [links(7)]: ok(fixture("api-issue-links.blocked-by.json")),
      [links(8)]: ok("[]"),
      [view(3)]: ok(JSON.stringify(issue(3))),
    });
    const tickets = await gitlabGlabTracker(runner, "/root", () => {}).listGroup({ milestone: "cstack recording" });
    expect(tickets.map((t) => t.key)).toEqual(["#7", "#8", "#5"]);
    const closed = tickets.find((t) => t.stateName === "closed");
    expect(closed).toBeDefined();
    const closedIid = Number(closed?.key.slice(1));
    expect(glab()).not.toContain(links(closedIid));
    expect(glab().filter((c) => c.includes("/links"))).toHaveLength(2);
  });

  it("reads pages of 100 until a short page", async () => {
    const page = (from: number, n: number) => ok(JSON.stringify(Array.from({ length: n }, (_, i) => issue(from + i, { state: "closed" }))));
    const { runner, glab } = fake({ [list(1)]: page(1, 100), [list(2)]: page(101, 30) });
    const tickets = await gitlabGlabTracker(runner, "/root", () => {}).listGroup({ milestone: "cstack recording" });
    expect(tickets).toHaveLength(130);
    expect(glab()).toEqual([list(1), list(2)]);
  });

  it("refuses at 500 issues", async () => {
    const page = (from: number) => ok(JSON.stringify(Array.from({ length: 100 }, (_, i) => issue(from + i, { state: "closed" }))));
    const { runner } = fake({ [list(1)]: page(1), [list(2)]: page(101), [list(3)]: page(201), [list(4)]: page(301), [list(5)]: page(401) });
    const err = await gitlabGlabTracker(runner, "/root", () => {}).listGroup({ milestone: "cstack recording" }).catch((e) => e);
    expect(err.exitCode).toBe(1);
    expect(err.message).toContain("more tickets than cstack reads");
  });
});
