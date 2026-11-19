import { mkdirSync, rmSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { trackerComment } from "../../src/commands/tracker-comment.js";
import type { Io } from "../../src/io.js";
import type { Runner } from "../../src/orca/run.js";

function setup(root: string | undefined, cwd: string) {
  const calls: { command: string; args: string[] }[] = [];
  const run: Runner = async (command, args) => {
    calls.push({ command, args });
    if (command === "git" && args[0] === "rev-parse") return root === undefined ? { kind: "failed", exitCode: 128 } : { kind: "ok", stdout: `${root}\n` };
    if (command === "git") return { kind: "ok", stdout: "https://github.com/o/r.git\n" };
    return { kind: "ok", stdout: "" };
  };
  const out = { stderr: "" };
  const io = { stdout: () => undefined, stderr: (t: string) => void (out.stderr += t) } as Io;
  return { calls, out, io, deps: { cwd, run, env: {} } };
}
const posted = (c: { command: string }[]) => c.some((x) => x.command === "gh" || x.command === "glab");
// A folder that is neither temporary nor a repository: it sits in the home folder.
const made: string[] = [];
const outside = () => {
  const d = mkdtempSync(join(homedir(), ".cstack-check-"));
  made.push(d);
  return d;
};
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("the check of the comment file", () => {
  it("accepts a file inside the repository", async () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), "repo-")));
    const f = join(repo, "c.md");
    writeFileSync(f, "hello");
    const s = setup(repo, repo);
    expect(await trackerComment(["#1", "--body-file", f], s.io, s.deps)).toBe(0);
    expect(posted(s.calls)).toBe(true);
  });

  it("refuses a symbolic link inside the repository that points outside", async () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), "repo-")));
    const out = outside();
    writeFileSync(join(out, "secret"), "secret");
    const link = join(repo, "link.md");
    symlinkSync(join(out, "secret"), link);
    const s = setup(repo, repo);
    expect(await trackerComment(["#1", "--body-file", link], s.io, s.deps)).toBe(1);
    expect(posted(s.calls)).toBe(false);
  });

  it("refuses a file outside the repository and the temporary folders", async () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), "repo-")));
    const out = outside();
    writeFileSync(join(out, "f.md"), "x");
    const s = setup(repo, repo);
    expect(await trackerComment(["#1", "--body-file", join(out, "f.md")], s.io, s.deps)).toBe(1);
    expect(s.out.stderr).toContain("repository");
    expect(posted(s.calls)).toBe(false);
  });

  it("refuses a folder whose name only starts like the repository", async () => {
    const out = outside();
    mkdirSync(join(out, "repo"));
    mkdirSync(join(out, "repo-other"));
    writeFileSync(join(out, "repo-other", "f.md"), "x");
    const s = setup(join(out, "repo"), out);
    expect(await trackerComment(["#1", "--body-file", join(out, "repo-other", "f.md")], s.io, s.deps)).toBe(1);
    expect(posted(s.calls)).toBe(false);
  });

  it("refuses an empty file and a file of 65,537 bytes, and accepts 65,536", async () => {
    const dir = mkdtempSync(join(tmpdir(), "c-"));
    writeFileSync(join(dir, "e.md"), "");
    writeFileSync(join(dir, "big.md"), "a".repeat(65537));
    writeFileSync(join(dir, "ok.md"), "a".repeat(65536));
    for (const [name, code] of [["e.md", 1], ["big.md", 1], ["ok.md", 0]] as const) {
      const s = setup(undefined, dir);
      expect(await trackerComment(["#1", "--body-file", join(dir, name)], s.io, s.deps)).toBe(code);
      if (code === 1) expect(posted(s.calls)).toBe(false);
    }
  });

  it("accepts only temporary folders without a real repository", async () => {
    const out = outside();
    writeFileSync(join(out, "f.md"), "x");
    const s = setup(undefined, out);
    expect(await trackerComment(["#1", "--body-file", join(out, "f.md")], s.io, s.deps)).toBe(1);
    expect(posted(s.calls)).toBe(false);
  });

  it("checks the file before the exit 4 of the no-client path", async () => {
    const out = outside();
    writeFileSync(join(out, "f.md"), "x");
    const s = setup(undefined, out);
    s.deps.run = async (c) => (c === "git" ? { kind: "failed", exitCode: 128 } : { kind: "failed", exitCode: 1 });
    expect(await trackerComment(["#1", "--body-file", join(out, "f.md")], s.io, s.deps)).toBe(1);
  });
});
