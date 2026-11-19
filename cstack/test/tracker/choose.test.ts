import { describe, expect, it } from "vitest";
import type { Runner } from "../../src/orca/run.js";
import { createClientChooser, trackerFromRemote } from "../../src/tracker/choose.js";

function fake(ok: boolean) {
  const calls: string[] = [];
  const runner: Runner = async (command, args) => {
    calls.push([command, ...args].join(" "));
    return ok ? { kind: "ok", stdout: "" } : { kind: "failed", exitCode: 1 };
  };
  return { runner, calls };
}

describe("client choice", () => {
  it("answers no client for a Jira move when the Orca Jira feature is off", async () => {
    const { runner, calls } = fake(true);
    const choose = createClientChooser({ tracker: "jira", orcaAvailable: false, runner });
    expect(await choose("move")).toBe("none");
    expect(await choose("comment")).toBe("none");
    expect(calls).toEqual([]);
  });

  it("uses Orca first, then the file for reads", async () => {
    const { runner } = fake(true);
    expect(await createClientChooser({ tracker: "linear", orcaAvailable: true, runner })("move")).toBe("orca");
    const off = createClientChooser({ tracker: "linear", orcaAvailable: false, runner });
    expect(await off("read")).toBe("file");
    expect(await off("list")).toBe("file");
  });

  it("uses gh or glab when logged in, and checks once", async () => {
    const gh = fake(true);
    const chooseGh = createClientChooser({ tracker: "github", orcaAvailable: true, runner: gh.runner });
    expect(await chooseGh("move")).toBe("gh");
    expect(await chooseGh("read")).toBe("gh");
    expect(gh.calls).toEqual(["gh auth status"]);
    const gl = fake(true);
    expect(await createClientChooser({ tracker: "gitlab", orcaAvailable: false, runner: gl.runner })("comment")).toBe("glab");
    expect(gl.calls).toEqual(["glab auth status"]);
  });

  it("falls back to the file for reads and no client for writes when the forge is not logged in", async () => {
    const { runner, calls } = fake(false);
    const choose = createClientChooser({ tracker: "github", orcaAvailable: false, runner });
    expect(await choose("read")).toBe("file");
    expect(await choose("move")).toBe("none");
    expect(calls).toHaveLength(1);
  });
});

describe("tracker from the origin remote", () => {
  it("reads https and git@ forms", () => {
    expect(trackerFromRemote("https://github.com/a/b.git")).toBe("github");
    expect(trackerFromRemote("git@github.com:a/b.git")).toBe("github");
    expect(trackerFromRemote("https://gitlab.com/a/b.git")).toBe("gitlab");
    expect(trackerFromRemote("git@gitlab.example.org:a/b.git")).toBe("gitlab");
  });

  it("refuses any other host with a usage error", () => {
    for (const url of ["https://bitbucket.org/a/b.git", "git@example.com:a/b.git", "nonsense"]) {
      try {
        trackerFromRemote(url);
        throw new Error("should refuse");
      } catch (e) {
        expect((e as { exitCode?: number }).exitCode).toBe(2);
        expect((e as Error).message).toContain("--tracker");
      }
    }
  });
});
