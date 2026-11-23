import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trackerList } from "../../src/commands/tracker-list.js";
import type { RunResult, Runner } from "../../src/orca/run.js";

const orcaDir = join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263");
const fixture = (file: string): RunResult => ({ kind: "ok", stdout: readFileSync(join(orcaDir, file), "utf8") });
const json = (value: unknown): RunResult => ({ kind: "ok", stdout: JSON.stringify(value) });
const FEATURES: Record<string, RunResult> = {
  "orca --version": fixture("version.current.txt"),
  "orca status --json": fixture("status.running.json"),
  "orca agent-context --json": fixture("agent-context.current.json"),
  "orca jira connection --json": fixture("jira-connection.one-site.json"),
  "orca linear team list --workspace all --json": fixture("linear-team-list.connected.json"),
};

const FOOTER_NONE = "**Size: S** · Blocked by: none · Feeds: none";

/** Runs trackerList() with a fake runner. `tracker` answers the calls of one tracker. Every call is recorded. */
async function run(args: string[], tracker: (command: string, args: string[]) => RunResult | undefined, remote = "https://github.com/user/repo.git") {
  const calls: string[] = [];
  const runner: Runner = async (command, a) => {
    const line = [command, ...a].join(" ");
    calls.push(line);
    if (line === "git rev-parse --show-toplevel") return { kind: "ok", stdout: "/repo\n" };
    if (command === "git") return { kind: "ok", stdout: `${remote}\n` };
    if (a[0] === "auth") return { kind: "ok", stdout: "" };
    const answer = FEATURES[line] ?? tracker(command, a);
    return answer ?? { kind: "failed", exitCode: 1, stderr: `unexpected call: ${line}` };
  };
  const out = { stdout: "", stderr: "" };
  const io = { stdout: (t: string) => void (out.stdout += t), stderr: (t: string) => void (out.stderr += t) };
  const code = await trackerList(args, io, { cwd: "/repo", run: runner, env: {} });
  return { code, out, calls };
}

const keysOf = (stdout: string): string[] => JSON.parse(stdout).tickets.map((t: { key: string }) => t.key);

// GitHub
const ghIssue = (n: number, over: Record<string, unknown> = {}) => ({
  number: n, title: `t${n}`, body: "", url: `https://github.com/user/repo/issues/${n}`, state: "OPEN", stateReason: "", labels: [],
  blockedBy: { nodes: [], totalCount: 0 }, ...over,
});
const blockedBy = (url: string, n: number) => ({ nodes: [{ id: "x", number: n, state: "OPEN", title: "b", url }], totalCount: 1 });
const label = (name: string) => [{ name }];
const ghTracker = (issues: unknown[], extra: (a: string[]) => RunResult | undefined = () => undefined) => (_c: string, a: string[]): RunResult | undefined => {
  const special = extra(a);
  if (special) return special;
  if (a[0] === "issue" && a[1] === "list") return json(issues);
  return undefined;
};
const three = [
  ghIssue(1),
  ghIssue(2, { blockedBy: blockedBy("https://github.com/user/repo/issues/4", 4) }),
  ghIssue(3, { labels: label("in progress") }),
  ghIssue(4, { labels: label("in review") }),
];

describe("cstack tracker list --ready", () => {
  it("keeps only the ready ticket of a GitHub milestone, and lists the others without --ready", async () => {
    const issues = [ghIssue(1), ghIssue(2, { blockedBy: blockedBy("https://github.com/user/repo/issues/9", 9) }), ghIssue(3, { labels: label("in progress") }), ghIssue(9)];
    const group = { milestone: "m" };
    const all = await run(["--milestone", "m"], ghTracker(issues));
    expect(all.code).toBe(0);
    const tickets = JSON.parse(all.out.stdout).tickets;
    expect(all.out.stdout).toBe(`${JSON.stringify({ format: "cstack-tracker/1", tracker: "github", group, tickets }, null, 2)}\n`);
    expect(keysOf(all.out.stdout)).toEqual(["#1", "#2", "#3", "#9"]);
    const ready = await run(["--milestone", "m", "--ready"], ghTracker(issues));
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["#1", "#9"]);
    expect(ready.out.stdout).toBe(`${JSON.stringify({ format: "cstack-tracker/1", tracker: "github", group, tickets: tickets.filter((t: { key: string }) => t.key === "#1" || t.key === "#9") }, null, 2)}\n`);
  });

  it("keeps only the ready sub-issue of a GitHub epic", async () => {
    const issues = [ghIssue(1), ghIssue(2, { blockedBy: blockedBy("https://github.com/user/repo/issues/1", 1) })];
    const extra = (a: string[]) =>
      a[0] === "issue" && a[1] === "view" && a[3] === "--repo" && a.includes("subIssues")
        ? json({ subIssues: { nodes: issues.map((i) => ({ url: i.url })), totalCount: 2 } })
        : undefined;
    const ready = await run(["--epic", "#9", "--ready"], ghTracker(issues, extra));
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["#1"]);
    expect(JSON.parse(ready.out.stdout).group).toEqual({ epic: "#9" });
  });

  it("never lists a ticket whose only blocker is an open issue with the label in review", async () => {
    const issues = [ghIssue(5, { blockedBy: blockedBy("https://github.com/user/repo/issues/4", 4) }), ghIssue(4, { labels: label("in review") })];
    const ready = await run(["--milestone", "m", "--ready"], ghTracker(issues));
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual([]);
    expect(keysOf((await run(["--milestone", "m"], ghTracker(three))).out.stdout)).toContain("#2");
  });

  it("never lists a ticket whose blockers are unknown", async () => {
    const issues = [ghIssue(1), ghIssue(2, { blockedBy: blockedBy("https://github.com/someone/other/issues/7", 7) })];
    const ready = await run(["--milestone", "m", "--ready"], ghTracker(issues));
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["#1"]);
  });

  const fromFile = (tickets: unknown[]) => {
    const file = join(mkdtempSync(join(tmpdir(), "cstack-")), "t.json");
    writeFileSync(file, JSON.stringify({ format: "cstack-tracker/1", tracker: "github", group: { milestone: "m" }, tickets }));
    return file;
  };
  const fileTicket = (key: string, stateKind: string, blockers: unknown = []) => ({
    key, title: "T", body: "B", url: `https://github.com/user/repo/issues/${key.slice(1)}`, stateName: "s", stateKind, blockers,
  });

  it("never lists a ticket whose own state is unknown", async () => {
    const file = fromFile([fileTicket("#1", "todo"), fileTicket("#2", "unknown")]);
    const ready = await run(["--milestone", "m", "--from-file", file, "--ready"], () => undefined);
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["#1"]);
  });

  it("never lists a finished ticket", async () => {
    const file = fromFile([fileTicket("#1", "finished"), fileTicket("#2", "todo")]);
    const ready = await run(["--milestone", "m", "--from-file", file, "--ready"], () => undefined);
    expect(keysOf(ready.out.stdout)).toEqual(["#2"]);
  });

  it("prints the same format with an empty list when no ticket is ready", async () => {
    const file = fromFile([fileTicket("#1", "finished"), fileTicket("#2", "in-progress")]);
    const ready = await run(["--milestone", "m", "--from-file", file, "--ready"], () => undefined);
    expect(ready.code).toBe(0);
    expect(ready.out.stdout).toBe(`${JSON.stringify({ format: "cstack-tracker/1", tracker: "github", group: { milestone: "m" }, tickets: [] }, null, 2)}\n`);
  });

  it("keeps only the ready tickets of a file given with --from-file", async () => {
    const file = fromFile([fileTicket("#1", "todo"), fileTicket("#2", "todo", [{ key: "#3", stateKind: "todo" }]), fileTicket("#3", "todo"), fileTicket("#4", "todo", "unknown")]);
    const ready = await run(["--milestone", "m", "--from-file", file, "--ready"], () => undefined);
    expect(keysOf(ready.out.stdout)).toEqual(["#1", "#3"]);
  });
});

// GitLab
const GL = { host: "gitlab.com", remote: "https://gitlab.com/user/project.git" };
const glIssue = (iid: number, over: Record<string, unknown> = {}) => ({
  iid, title: `t${iid}`, description: "", state: "opened", labels: [], web_url: `https://gitlab.com/user/project/-/issues/${iid}`, ...over,
});
const glLink = (iid: number) => ({ ...glIssue(iid), link_type: "is_blocked_by", references: { full: `user/project#${iid}` } });
const glabTracker = (command: string, a: string[]): RunResult | undefined => {
  if (command !== "glab") return undefined;
  if (a[0] === "issue" && a[1] === "list") {
    return json([glIssue(1), glIssue(2), glIssue(3, { labels: ["in progress"] })]);
  }
  const m = /issues\/(\d+)\/links$/.exec(a[a.length - 1] ?? "");
  if (m) return json(m[1] === "2" ? [glLink(3)] : []);
  return undefined;
};

// Jira, through Orca
const jiraIssue = (key: string, description: string, categoryKey: string) => ({
  key, title: key, description, url: `https://jira.example.com/browse/${key}`, status: { id: "x", name: "S", categoryKey, categoryName: "S" },
});
const JIRA = [jiraIssue("EXA-1", FOOTER_NONE, "new"), jiraIssue("EXA-2", "**Size: S** · Blocked by: EXA-3 · Feeds: none", "new"), jiraIssue("EXA-3", FOOTER_NONE, "indeterminate")];
const jiraTracker = (command: string, a: string[]): RunResult | undefined => {
  if (command !== "orca") return undefined;
  if (a[0] === "jira" && a[1] === "search") return json({ ok: true, result: JIRA });
  if (a[0] === "jira" && a[1] === "issue") return json({ ok: true, result: JIRA.find((i) => i.key === a[2]) });
  return undefined;
};

// Linear, through Orca
const UUID = "123e4567-e89b-42d3-a456-426614174000";
const linIssue = (identifier: string, type: string) => ({
  id: UUID, identifier, title: identifier, url: `https://linear.example.com/x/issue/${identifier}`, description: FOOTER_NONE,
  state: { name: "S", type }, team: { key: "EXA" },
});
const LIN: Record<string, { type: string; blockedBy?: string }> = { "EXA-1": { type: "unstarted" }, "EXA-2": { type: "unstarted", blockedBy: "EXA-3" }, "EXA-3": { type: "started" } };
const linearTracker = (command: string, a: string[]): RunResult | undefined => {
  if (command !== "orca" || a[0] !== "linear") return undefined;
  if (a[1] === "list-issues") {
    return json({ ok: true, result: { issues: ["EXA-1", "EXA-2", "EXA-3"].map((k) => linIssue(k, LIN[k].type)), truncated: false, meta: { partial: false } } });
  }
  if (a[1] === "issue") {
    const key = a[2];
    const spec = LIN[key] ?? { type: "unstarted" };
    const relations = spec.blockedBy ? [{ relationship: "blockedBy", relatedIssue: { identifier: spec.blockedBy } }] : [];
    return json({ ok: true, result: { issue: linIssue(key, spec.type), relations, meta: { includeErrors: [], sections: { relations: { hasMore: false } } } } });
  }
  return undefined;
};

describe("cstack tracker list --ready with each tracker", () => {
  it("keeps only the ready ticket of a GitLab milestone", async () => {
    const ready = await run(["--milestone", "m", "--ready"], glabTracker, GL.remote);
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["#1"]);
    expect(keysOf((await run(["--milestone", "m"], glabTracker, GL.remote)).out.stdout)).toEqual(["#1", "#2", "#3"]);
  });

  it("keeps only the ready ticket of a Jira milestone", async () => {
    const ready = await run(["--milestone", "m", "--tracker", "jira", "--ready"], jiraTracker);
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["EXA-1"]);
    expect(keysOf((await run(["--milestone", "m", "--tracker", "jira"], jiraTracker)).out.stdout)).toEqual(["EXA-1", "EXA-2", "EXA-3"]);
  });

  it("keeps only the ready ticket of a Linear epic", async () => {
    const ready = await run(["--epic", "EXA-10", "--tracker", "linear", "--ready"], linearTracker);
    expect(ready.code).toBe(0);
    expect(keysOf(ready.out.stdout)).toEqual(["EXA-1"]);
    expect(keysOf((await run(["--epic", "EXA-10", "--tracker", "linear"], linearTracker)).out.stdout)).toEqual(["EXA-1", "EXA-2", "EXA-3"]);
  });

  it("adds no call, on each of the four trackers", async () => {
    const cases: [string[], (c: string, a: string[]) => RunResult | undefined, string?][] = [
      [["--milestone", "m"], ghTracker(three)],
      [["--milestone", "m"], glabTracker, GL.remote],
      [["--milestone", "m", "--tracker", "jira"], jiraTracker],
      [["--epic", "EXA-10", "--tracker", "linear"], linearTracker],
    ];
    for (const [args, tracker, remote] of cases) {
      const without = await run(args, tracker, remote);
      const withReady = await run([...args, "--ready"], tracker, remote);
      expect(withReady.code).toBe(0);
      expect(without.calls.length).toBeGreaterThan(1);
      expect(withReady.calls).toEqual(without.calls);
    }
  });

  const USAGE = "Usage: cstack tracker list (--milestone <name> | --epic <key>) [--ready] [--tracker <name>] [--from-file <path>]";

  it("refuses --ready=x with exit 2 and makes no tracker call", async () => {
    const result = await run(["--milestone", "m", "--ready=x"], ghTracker(three));
    expect(result.code).toBe(2);
    expect(result.out.stderr).toContain(USAGE);
    expect(result.calls).toEqual([]);
  });

  it("refuses --no-ready with exit 2 and makes no tracker call", async () => {
    const result = await run(["--milestone", "m", "--no-ready"], ghTracker(three));
    expect(result.code).toBe(2);
    expect(result.out.stderr).toContain(USAGE);
    expect(result.calls).toEqual([]);
  });
});
