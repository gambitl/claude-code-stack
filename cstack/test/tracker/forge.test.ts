import { describe, expect, it } from "vitest";
import type { RunResult, Runner } from "../../src/orca/run.js";
import { NoClientError, RefusedArgumentError, TrackerError, WriteShapeError } from "../../src/tracker/errors.js";
import { MAX_GROUP, forgeStateName, forgeFailure, originRepo, settleBlockers } from "../../src/tracker/forge.js";
import type { StateKind, Ticket } from "../../src/tracker/types.js";

const ticket = (key: string, stateKind: StateKind, blockers: Ticket["blockers"] = []): Ticket => ({
  key, title: "t", body: "", url: "https://github.com/example-owner/example-repo/issues/1", stateName: "open", stateKind, blockers,
});

describe("settleBlockers", () => {
  it("takes the state of a blocker from the group without a lookup", async () => {
    const lookups: string[] = [];
    const lookup = async (key: string): Promise<StateKind> => { lookups.push(key); return "todo"; };
    const a = ticket("#1", "todo", [{ key: "#2", stateKind: "unknown" }]);
    const b = ticket("#2", "finished");
    const out = await settleBlockers([a, b], lookup, () => {});
    expect(out[0].blockers).toEqual([{ key: "#2", stateKind: "finished" }]);
    expect(lookups).toEqual([]);
  });

  it("looks up a blocker outside the group once, even when two tickets name it", async () => {
    const lookups: string[] = [];
    const lookup = async (key: string): Promise<StateKind> => { lookups.push(key); return "in-progress"; };
    const ref = [{ key: "#9", stateKind: "unknown" as const }];
    const out = await settleBlockers([ticket("#1", "todo", ref), ticket("#2", "todo", ref)], lookup, () => {});
    expect(lookups).toEqual(["#9"]);
    expect(out.map((t) => t.blockers)).toEqual([[{ key: "#9", stateKind: "in-progress" }], [{ key: "#9", stateKind: "in-progress" }]]);
  });

  it("keeps unknown and warns when a lookup fails, and leaves known kinds and unknown lists alone", async () => {
    const warnings: string[] = [];
    const lookup = async (): Promise<StateKind> => { throw new Error("boom"); };
    const a = ticket("#1", "todo", [{ key: "#9", stateKind: "unknown" }, { key: "#8", stateKind: "todo" }]);
    const b = ticket("#2", "todo", "unknown");
    const out = await settleBlockers([a, b], lookup, (m) => warnings.push(m));
    expect(out[0].blockers).toEqual([{ key: "#9", stateKind: "unknown" }, { key: "#8", stateKind: "todo" }]);
    expect(out[1].blockers).toBe("unknown");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("#9");
  });
});

describe("originRepo", () => {
  const runner = (result: RunResult, calls: unknown[][] = []): Runner => async (...args) => { calls.push(args); return result; };

  it("runs git config in the root and reads https and git@ URLs", async () => {
    const calls: unknown[][] = [];
    const https = await originRepo(runner({ kind: "ok", stdout: "https://github.com/example-owner/example-repo.git\n" }, calls), "/root");
    expect(calls).toEqual([["git", ["config", "--get", "remote.origin.url"], "/root"]]);
    expect(https).toMatchObject({ host: "github.com", path: "example-owner/example-repo" });
    const ssh = await originRepo(runner({ kind: "ok", stdout: "git@gitlab.com:group/sub/repo.git\n" }), "/root");
    expect(ssh).toMatchObject({ host: "gitlab.com", path: "group/sub/repo" });
  });

  it("refuses with exit 1 when origin is missing or has no host", async () => {
    for (const r of [{ kind: "failed", exitCode: 1 }, { kind: "ok", stdout: "\n" }, { kind: "ok", stdout: "/some/path" }, { kind: "missing" }] as RunResult[]) {
      const err = await originRepo(runner(r), "/root").catch((e) => e);
      expect(err).toBeInstanceOf(RefusedArgumentError);
      expect(err.exitCode).toBe(1);
      expect(err.message).toContain("--from-file");
    }
  });
});

describe("failure mapping", () => {
  const fail = (tool: "gh" | "glab", r: Exclude<RunResult, { kind: "ok" }>, write: boolean) => forgeFailure(tool, r, write);

  it("maps a missing program and an authentication failure to no client (4)", () => {
    expect(fail("gh", { kind: "missing" }, false)).toBeInstanceOf(NoClientError);
    expect(fail("gh", { kind: "failed", exitCode: 4, stderr: "x" }, true)).toBeInstanceOf(NoClientError);
    expect(fail("glab", { kind: "failed", exitCode: 1, stderr: "HTTP 401 Unauthorized" }, false)).toBeInstanceOf(NoClientError);
    expect(fail("glab", { kind: "failed", exitCode: 4, stderr: "x" }, false)).not.toBeInstanceOf(NoClientError);
    expect(fail("gh", { kind: "missing" }, true).exitCode).toBe(4);
  });

  it("gives exit 5 on reads for a timeout, a too-large answer or another failure, with the redacted text", () => {
    for (const r of [{ kind: "timeout" }, { kind: "too-large" }] as const) {
      const e = fail("gh", r, false);
      expect(e).not.toBeInstanceOf(WriteShapeError);
      expect(e.exitCode).toBe(5);
    }
    const e = fail("gh", { kind: "failed", exitCode: 1, stderr: "cannot reach https://user:tok@github.com/x\n" }, false);
    expect(e.exitCode).toBe(5);
    expect(e.message).toContain("https://github.com/x");
    expect(e.message).not.toContain("tok");
  });

  it("gives a write-shape error for a timeout or too-large answer on writes, and exit 5 for other failures", () => {
    for (const r of [{ kind: "timeout" }, { kind: "too-large" }] as const) {
      const e = fail("glab", r, true);
      expect(e).toBeInstanceOf(WriteShapeError);
      expect(e.exitCode).toBe(5);
    }
    const e = fail("glab", { kind: "failed", exitCode: 1, stderr: "nope" }, true);
    expect(e).toBeInstanceOf(TrackerError);
    expect(e).not.toBeInstanceOf(WriteShapeError);
    expect(e.exitCode).toBe(5);
    expect(e.message).toContain("nope");
  });
});

describe("state name and limit", () => {
  it("follows the rule of the plan", () => {
    expect(MAX_GROUP).toBe(500);
    expect(forgeStateName("github", { open: true, labels: ["In Review", "in progress"] })).toBe("in review");
    expect(forgeStateName("github", { open: true, labels: ["In Progress"] })).toBe("in progress");
    expect(forgeStateName("github", { open: true, labels: [] })).toBe("open");
    expect(forgeStateName("gitlab", { open: true, labels: [] })).toBe("opened");
    expect(forgeStateName("gitlab", { open: false, labels: ["in review"] })).toBe("closed");
  });
});
