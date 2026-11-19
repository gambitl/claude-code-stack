import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { checkedTracker } from "../../src/tracker/checked.js";
import { InvalidFileError, NoClientError, RefusedArgumentError, UnconfirmedWriteError, WriteShapeError } from "../../src/tracker/errors.js";
import { isValidKey, isValidUrl } from "../../src/tracker/keys.js";
import type { Ticket, Tracker, TrackerName } from "../../src/tracker/types.js";

function ticket(key: string, url = "https://example.com/t/1"): Ticket {
  return { key, title: "t", body: "b", url, stateName: "To Do", stateKind: "todo", blockers: [] };
}

function spy(tickets: Ticket[] = []) {
  const calls: string[] = [];
  const runner = (...args: string[]) => calls.push(args.join(" "));
  const adapter: Tracker = {
    async readTicket(k) { runner("read", k); return tickets[0] ?? ticket(k); },
    async listGroup() { runner("list"); return tickets; },
    async moveState(k, s) { runner("move", k, s); },
    async addComment(k, f) { runner("comment", k, f); },
  };
  return { adapter, calls };
}

describe("checked tracker", () => {
  it("refuses a hostile key and never calls the runner", async () => {
    const { adapter, calls } = spy();
    const t = checkedTracker(adapter, "jira");
    const error = await t.readTicket("ABC-12; rm -rf ~").catch((e) => e);
    expect(error).toBeInstanceOf(RefusedArgumentError);
    expect(error.exitCode).toBe(1);
    expect(calls).toEqual([]);
  });

  it("accepts valid keys and refuses bad ones", () => {
    for (const [tracker, key] of [["jira", "ABC-12"], ["linear", "ENG_1-7"], ["github", "#42"], ["gitlab", "#1"]] as [TrackerName, string][]) {
      expect(isValidKey(tracker, key)).toBe(true);
    }
    const bad = ["AB C-1", "ABC-1\n", "ABC-$(x)-1", "ABC-`x`", "-ABC-1", "ABC-0", `A${"B".repeat(31)}-1`];
    for (const key of bad) expect(isValidKey("jira", key)).toBe(false);
    for (const key of ["#0", "# 1", "#1\n", "-#1", "#" + "1".repeat(32), "ABC-1"]) expect(isValidKey("github", key)).toBe(false);
    expect(isValidKey("jira", "#1")).toBe(false);
  });

  it("checks URLs", () => {
    expect(isValidUrl("https://example.com/a?b=1")).toBe(true);
    for (const url of ["http://example.com", "https://exa mple.com", "https://e.com/\"x", "https://e.com/'x", "https://e.com/\u0007", "ftp://e.com", ""]) {
      expect(isValidUrl(url)).toBe(false);
    }
  });

  it("refuses unsafe state names and body files before the adapter, and makes the path absolute", async () => {
    const { adapter, calls } = spy();
    const t = checkedTracker(adapter, "jira");
    for (const name of ["", "--json", "a\nb", "a\u0000b"]) {
      await expect(t.moveState("ABC-1", name)).rejects.toBeInstanceOf(RefusedArgumentError);
    }
    for (const file of ["", "-x.md", "a\u0007.md"]) {
      await expect(t.addComment("ABC-1", file)).rejects.toBeInstanceOf(RefusedArgumentError);
    }
    expect(calls).toEqual([]);
    await t.moveState("ABC-1", "In Progress");
    await t.addComment("ABC-1", "notes/body.md");
    expect(calls[0]).toBe("move ABC-1 In Progress");
    expect(isAbsolute(calls[1].split(" ")[2])).toBe(true);
  });

  it("skips bad tickets in a list and names them in the warning", async () => {
    const { adapter } = spy([ticket("ABC-1"), ticket("bad key"), ticket("ABC-2", "http://x.com")]);
    const warnings: string[] = [];
    const list = await checkedTracker(adapter, "jira", (m) => warnings.push(m)).listGroup({ epic: "ABC-9" });
    expect(list.map((x) => x.key)).toEqual(["ABC-1"]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("bad key");
    expect(warnings[1]).toContain("http://x.com");
  });

  it("refuses a single read with a bad key", async () => {
    const { adapter } = spy([ticket("nope")]);
    await expect(checkedTracker(adapter, "jira").readTicket("ABC-1")).rejects.toBeInstanceOf(RefusedArgumentError);
  });
});

describe("tracker errors", () => {
  it("carry their exit codes and messages", () => {
    expect(new RefusedArgumentError("x").exitCode).toBe(1);
    expect(new InvalidFileError("x").exitCode).toBe(3);
    expect(NoClientError.forMove("ABC-1", "Done").exitCode).toBe(4);
    expect(NoClientError.forMove("ABC-1", "Done").message).toContain("ABC-1");
    expect(NoClientError.forMove("ABC-1", "Done").message).toContain("Done");
    expect(NoClientError.forComment("ABC-1", "/tmp/c.md").message).toContain("/tmp/c.md");
    expect(new WriteShapeError("shape").exitCode).toBe(5);
    const unconfirmed = new UnconfirmedWriteError("retry-77");
    expect(unconfirmed.exitCode).toBe(5);
    expect(unconfirmed.message).toContain("retry-77");
  });
});
