import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trackerMove } from "../../src/commands/tracker-move.js";
import { trackerRead } from "../../src/commands/tracker-read.js";
import type { RunResult, Runner } from "../../src/orca/run.js";

const FIXTURES = join(import.meta.dirname, "..", "fixtures", "gh", "2.101.0");
const ok = (name: string): RunResult => ({ kind: "ok", stdout: readFileSync(join(FIXTURES, name), "utf8") });

const REPO = "github.com/example-owner/example-repo";
const FIELDS = "number,title,body,url,state,stateReason,labels,blockedBy";
const LINK = "https://github.com/example-owner/example-repo/issues/5";

/** A fake runner. It answers git, the login check and the recorded `gh issue view` calls. */
function setup(options: { loggedIn?: boolean; origin?: boolean } = {}) {
  const { loggedIn = true, origin = true } = options;
  const run: Runner = async (command, args) => {
    const line = [command, ...args].join(" ");
    if (line === "git config --get remote.origin.url") {
      return origin ? { kind: "ok", stdout: "https://github.com/example-owner/example-repo.git\n" } : { kind: "failed", exitCode: 1 };
    }
    if (line === "git rev-parse --show-toplevel") return { kind: "ok", stdout: "/repo\n" };
    if (line === "gh auth status --hostname github.com") return loggedIn ? { kind: "ok", stdout: "" } : { kind: "failed", exitCode: 1 };
    if (line === `gh issue view 5 --repo ${REPO} --json ${FIELDS}`) return ok("issue-view.blocked-by.json");
    if (line === `gh issue view 4 --repo ${REPO} --json number,state,labels`) return ok("issue-view.state.json");
    return { kind: "failed", exitCode: 1, stderr: `unexpected call: ${line}` };
  };
  const out = { stdout: "", stderr: "" };
  const io = { stdout: (t: string) => void (out.stdout += t), stderr: (t: string) => void (out.stderr += t) };
  return { out, io, deps: { cwd: "/repo", run, env: {} } };
}

async function read(key: string) {
  const { out, io, deps } = setup();
  const code = await trackerRead([key], io, deps);
  return { code, stdout: out.stdout, stderr: out.stderr };
}

describe("the forms of a ticket key in every tracker command", () => {
  it("reads a bare number and a link as the same ticket as '#5'", async () => {
    const hash = await read("#5");
    expect(hash.code).toBe(0);
    expect(JSON.parse(hash.stdout)).toMatchObject({ key: "#5" });
    const bare = await read("5");
    const link = await read(LINK);
    expect(bare).toEqual(hash);
    expect(link).toEqual(hash);
  });

  it("moves with a link and exits with 4 when no client is logged in, and names '#5'", async () => {
    const { out, io, deps } = setup({ loggedIn: false });
    expect(await trackerMove([LINK, "--to", "in progress"], io, deps)).toBe(4);
    expect(out.stderr).toContain("#5");
  });

  it("refuses a link with exit 1 when the clone has no origin remote, even with a file", async () => {
    const { out, io, deps } = setup({ origin: false });
    const file = join(mkdtempSync(join(tmpdir(), "cstack-")), "t.json");
    writeFileSync(file, JSON.stringify({ format: "cstack-tracker/1", tracker: "github", tickets: [] }));
    expect(await trackerRead([LINK, "--from-file", file], io, deps)).toBe(1);
    expect(out.stderr).toContain("no origin remote");
    expect(out.stderr).toContain("'#12'");
  });

  it("explains the other forms of a key when the key is missing", async () => {
    const { out, io, deps } = setup();
    expect(await trackerRead([], io, deps)).toBe(2);
    expect(out.stderr).toContain("You can also write 12, or the link of the issue in single quotes.");
  });
});
