import { describe, expect, it } from "vitest";
import type { Runner } from "../../src/orca/run.js";
import { NoClientError, RefusedArgumentError } from "../../src/tracker/errors.js";
import { openTracker } from "../../src/tracker/open.js";

function setup(origin: string | undefined, loggedIn = true) {
  const calls: string[] = [];
  const run: Runner = async (command, args) => {
    const line = [command, ...args].join(" ");
    calls.push(line);
    if (command === "git") return origin ? { kind: "ok", stdout: `${origin}\n` } : { kind: "failed", exitCode: 1 };
    if (args[0] === "auth") return loggedIn ? { kind: "ok", stdout: "" } : { kind: "failed", exitCode: 1 };
    return { kind: "failed", exitCode: 1, stderr: "should not be called" };
  };
  const warnings: string[] = [];
  return { calls, options: { root: "/repo", run, env: {}, warn: (m: string) => void warnings.push(m) } };
}

describe("openTracker", () => {
  it("opens GitHub from origin, checks the login of the host, and refuses a bad key before any issue call", async () => {
    const { calls, options } = setup("git@github.com:o/r.git");
    const tracker = await openTracker("read", options);
    expect(calls).toContain("gh auth status --hostname github.com");
    await expect(tracker.readTicket("not a key")).rejects.toBeInstanceOf(RefusedArgumentError);
    expect(calls.some((c) => c.startsWith("gh issue"))).toBe(false);
  });

  it("opens GitLab from a GitLab origin", async () => {
    const { calls, options } = setup("https://gitlab.com/o/r.git");
    await openTracker("move", options);
    expect(calls).toContain("glab auth status --hostname gitlab.com");
  });

  it("lets --tracker win over origin", async () => {
    const { calls, options } = setup("https://gitlab.com/o/r.git");
    await openTracker("read", { ...options, tracker: "github" });
    expect(calls).toContain("gh auth status --hostname gitlab.com");
  });

  it("reads a file with --tracker and no origin, and never reads origin", async () => {
    const { calls, options } = setup(undefined);
    await openTracker("read", { ...options, tracker: "linear", fromFile: "/x.json" });
    expect(calls).toEqual([]);
  });

  it("runs no client with --from-file for read and list", async () => {
    const { calls, options } = setup("https://github.com/o/r.git");
    await openTracker("read", { ...options, fromFile: "/x.json" });
    await openTracker("list", { ...options, fromFile: "/x.json" });
    expect(calls.filter((c) => !c.startsWith("git"))).toEqual([]);
  });

  it("throws NoClientError with exit 4 when the forge is not logged in", async () => {
    for (const capability of ["read", "list", "move", "comment"] as const) {
      const { options } = setup("https://github.com/o/r.git", false);
      const error = await openTracker(capability, options).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NoClientError);
      expect((error as NoClientError).exitCode).toBe(4);
    }
    const { options } = setup("https://github.com/o/r.git", false);
    await expect(openTracker("read", options)).rejects.toThrow(/cstack-tracker\/1.*--from-file/);
  });

  it("exits with 4 for Jira and Linear when Orca cannot reach them, except a read from a file", async () => {
    const { calls, options } = setup("https://github.com/o/r.git");
    const error = await openTracker("read", { ...options, tracker: "jira" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NoClientError);
    expect((error as NoClientError).exitCode).toBe(4);
    expect((error as Error).message).toContain("--from-file");
    expect((error as Error).message).not.toContain("#25");
    expect(calls.some((c) => c.startsWith("git config"))).toBe(false);
    await expect(openTracker("move", { ...options, tracker: "linear", fromFile: "/x.json" })).rejects.toBeInstanceOf(NoClientError);
    await expect(openTracker("read", { ...options, tracker: "linear", fromFile: "/x.json" })).resolves.toBeDefined();
  });
});
