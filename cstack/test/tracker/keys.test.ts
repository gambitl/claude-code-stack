import { isAbsolute } from "node:path";
import { describe, expect, it } from "vitest";
import { checkedTracker } from "../../src/tracker/checked.js";
import { InvalidFileError, NoClientError, RefusedArgumentError, UnconfirmedWriteError, WriteShapeError } from "../../src/tracker/errors.js";
import type { Remote } from "../../src/publish/remote.js";
import { isValidKey, isValidUrl, keyForms, keyOfLink, keyOfNumber, looksLikeLink } from "../../src/tracker/keys.js";
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

  it("skips a ticket in a list when one of its blocker keys is bad, and warns", async () => {
    const hostile = { ...ticket("ABC-3"), blockers: [{ key: "ABC-1; rm -rf ~", stateKind: "todo" as const }] };
    const fine = { ...ticket("ABC-4"), blockers: [{ key: "ABC-1", stateKind: "finished" as const }] };
    const { adapter } = spy([ticket("ABC-1"), hostile, fine]);
    const warnings: string[] = [];
    const list = await checkedTracker(adapter, "jira", (m) => warnings.push(m)).listGroup({ epic: "ABC-9" });
    expect(list.map((x) => x.key)).toEqual(["ABC-1", "ABC-4"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("blocker");
    expect(warnings[0]).toContain("ABC-1; rm -rf ~");
  });

  it("refuses a single read when one of the blocker keys is bad", async () => {
    const hostile = { ...ticket("ABC-3"), blockers: [{ key: "bad key", stateKind: "todo" as const }] };
    const { adapter } = spy([hostile]);
    await expect(checkedTracker(adapter, "jira").readTicket("ABC-3")).rejects.toBeInstanceOf(RefusedArgumentError);
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

describe("ticket keys written as a number or a link", () => {
  const remote: Remote = { host: "gitlab.com", path: "example-group/example-project", ssh: false };
  const forgeEnd = "Write it as '#12', as 12, or as the link of an issue of this project.";
  const project = "https://gitlab.com/example-group/example-project";

  function origin(value: Remote | Error = remote) {
    const state = { calls: 0 };
    const read = async () => {
      state.calls += 1;
      if (value instanceof Error) throw value;
      return value;
    };
    return { read, state };
  }

  it("turns 12 into #12 for every operation and never reads origin", async () => {
    const { adapter, calls } = spy([ticket("#12", "https://gitlab.com/x")]);
    const o = origin();
    const t = checkedTracker(adapter, "gitlab", () => {}, o.read);
    await t.readTicket("12");
    await t.moveState("12", "Done");
    await t.addComment("12", "/tmp/c.md");
    await t.listGroup({ epic: "12" });
    expect(calls).toEqual(["read #12", "move #12 Done", "comment #12 /tmp/c.md", "list"]);
    expect(o.state.calls).toBe(0);
  });

  it("passes the key of a group list as #12 to the adapter", async () => {
    const seen: unknown[] = [];
    const adapter: Tracker = { ...spy().adapter, async listGroup(g) { seen.push(g); return []; } };
    await checkedTracker(adapter, "gitlab").listGroup({ epic: "12" });
    expect(seen).toEqual([{ epic: "#12" }]);
  });

  it("accepts the links of an issue of the origin project", async () => {
    const links = [
      `${project}/-/issues/12`,
      `${project}/-/work_items/12`,
      `${project}/-/issues/12/`,
      `${project}/-/issues/12?foo=1#note_5`,
      `${project}/-/issues/12#note_5`,
      "https://GitLab.com/Example-Group/Example-Project/-/issues/12",
    ];
    for (const link of links) {
      const { adapter, calls } = spy();
      await checkedTracker(adapter, "gitlab", () => {}, origin().read).readTicket(link);
      expect(calls).toEqual(["read #12"]);
    }
  });

  it("accepts the link of a GitHub issue", async () => {
    const { adapter, calls } = spy();
    const gh: Remote = { host: "github.com", path: "example-owner/example-repo", ssh: false };
    await checkedTracker(adapter, "github", () => {}, origin(gh).read).readTicket("https://github.com/example-owner/example-repo/issues/12");
    expect(calls).toEqual(["read #12"]);
  });

  it("refuses a link to another project, host or kind of page, and names the origin project", async () => {
    const links = [
      "https://gitlab.com/other-group/example-project/-/issues/12",
      "https://example.org/example-group/example-project/-/issues/12",
      `${project}/-/merge_requests/12`,
      `${project}/-/issues/12/extra`,
      `${project}/-/issues/012`,
    ];
    for (const link of links) {
      const { adapter, calls } = spy();
      const error = await checkedTracker(adapter, "gitlab", () => {}, origin().read).readTicket(link).catch((e) => e);
      expect(error).toBeInstanceOf(RefusedArgumentError);
      expect(error.exitCode).toBe(1);
      expect(error.message).toBe(
        `cstack only reads the issues of gitlab.com/example-group/example-project, the origin project, and ${link} is not the link of one of its issues. Write the key as '#12'.`,
      );
      expect(calls).toEqual([]);
    }
  });

  it("refuses a GitHub pull request link", async () => {
    const { adapter, calls } = spy();
    const gh: Remote = { host: "github.com", path: "example-owner/example-repo", ssh: false };
    const link = "https://github.com/example-owner/example-repo/pull/12";
    const error = await checkedTracker(adapter, "github", () => {}, origin(gh).read).readTicket(link).catch((e) => e);
    expect(error.exitCode).toBe(1);
    expect(error.message).toContain("github.com/example-owner/example-repo");
    expect(error.message).toContain("'#12'");
    expect(calls).toEqual([]);
  });

  it("shows the port of the origin in the refusal", async () => {
    const { adapter } = spy();
    const withPort: Remote = { host: "git.example.org", port: "8443", path: "g/p", ssh: false };
    const error = await checkedTracker(adapter, "gitlab", () => {}, origin(withPort).read).readTicket("https://git.example.org/g/p/-/issues/12").catch((e) => e);
    expect(error.message).toContain("issues of git.example.org:8443/g/p, the origin");
    const { adapter: a2, calls } = spy();
    await checkedTracker(a2, "gitlab", () => {}, origin(withPort).read).readTicket("https://git.example.org:8443/g/p/-/issues/12");
    expect(calls).toEqual(["read #12"]);
  });

  it("refuses an http link and a link with user information without printing the secret", async () => {
    for (const link of ["http://gitlab.com/example-group/example-project/-/issues/12", `https://user:secret@gitlab.com/example-group/example-project/-/issues/12`]) {
      const { adapter, calls } = spy();
      const error = await checkedTracker(adapter, "gitlab", () => {}, origin().read).readTicket(link).catch((e) => e);
      expect(error.exitCode).toBe(1);
      expect(error.message).toContain("is not the link of one of its issues");
      expect(error.message).not.toContain("secret");
      expect(calls).toEqual([]);
    }
  });

  it("refuses other bad forge keys with the three forms", async () => {
    for (const value of ["#0", "0", "012", "-12", "12abc"]) {
      const { adapter, calls } = spy();
      const error = await checkedTracker(adapter, "gitlab", () => {}, origin().read).readTicket(value).catch((e) => e);
      expect(error.exitCode).toBe(1);
      expect(error.message).toBe(`"${value}" is not a valid gitlab ticket key. ${forgeEnd}`);
      expect(error.message.endsWith(forgeEnd)).toBe(true);
      expect(calls).toEqual([]);
    }
  });

  it("gives the Jira form for a bad Jira key and still refuses 12 there", async () => {
    for (const tracker of ["jira", "linear"] as const) {
      const { adapter, calls } = spy();
      const error = await checkedTracker(adapter, tracker, () => {}, origin().read).readTicket("12").catch((e) => e);
      expect(error.message).toBe(`"12" is not a valid ${tracker} ticket key. Write it as 'ABC-12'.`);
      expect(calls).toEqual([]);
    }
  });

  it("asks for the #12 form when the clone has no origin, and still converts 12", async () => {
    const { adapter, calls } = spy();
    const o = origin(new RefusedArgumentError("no origin"));
    const t = checkedTracker(adapter, "gitlab", () => {}, o.read);
    const link = `${project}/-/issues/12`;
    const error = await t.readTicket(link).catch((e) => e);
    expect(error.exitCode).toBe(1);
    expect(error.message).toBe(`cstack cannot check the link "${link}", because this repository has no origin remote. Write the key as '#12'.`);
    await t.readTicket("12");
    expect(calls).toEqual(["read #12"]);
  });

  it("throws again any other error of the origin function", async () => {
    const { adapter } = spy();
    const boom = new Error("boom");
    const error = await checkedTracker(adapter, "gitlab", () => {}, origin(boom).read).readTicket(`${project}/-/issues/12`).catch((e) => e);
    expect(error).toBe(boom);
  });

  it("refuses a link with the key refusal when no origin function is given", async () => {
    const { adapter, calls } = spy();
    const link = `${project}/-/issues/12`;
    const error = await checkedTracker(adapter, "gitlab").readTicket(link).catch((e) => e);
    expect(error.message).toBe(`"${link}" is not a valid gitlab ticket key. ${forgeEnd}`);
    expect(calls).toEqual([]);
  });

  it("has pure helpers for the three forms", () => {
    expect(looksLikeLink("HTTPS://x")).toBe(true);
    expect(looksLikeLink("12")).toBe(false);
    expect(keyOfNumber("12")).toBe("#12");
    expect(keyOfNumber("012")).toBeUndefined();
    expect(keyOfLink("gitlab", `${project}/-/issues/12`, remote)).toBe("#12");
    expect(keyOfLink("gitlab", `${project}/-/issues/12`, { ...remote, path: "a/b" })).toBeUndefined();
    expect(keyForms("jira")).toBe("Write it as 'ABC-12'.");
    expect(keyForms("github")).toBe(forgeEnd);
  });
});
