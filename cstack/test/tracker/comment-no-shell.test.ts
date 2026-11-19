import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { trackerComment } from "../../src/commands/tracker-comment.js";
import type { Io } from "../../src/io.js";
import type { Runner } from "../../src/orca/run.js";

const NASTY = "$(rm -rf ~)\n`id` \"quoted\" 'single'\n";

function setup(origin: string, loggedIn = true) {
  const dir = mkdtempSync(join(tmpdir(), "cstack-comment-"));
  const file = join(dir, "body.md");
  writeFileSync(file, NASTY);
  const calls: { command: string; args: string[] }[] = [];
  const run: Runner = async (command, args) => {
    calls.push({ command, args });
    if (command === "git") return { kind: "ok", stdout: `${origin}\n` };
    if (args[0] === "auth") return loggedIn ? { kind: "ok", stdout: "" } : { kind: "failed", exitCode: 1 };
    return { kind: "ok", stdout: "" };
  };
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => void (out.stdout += t), stderr: (t) => void (out.stderr += t) } as Io;
  return { file, calls, out, io, deps: { cwd: dir, run, env: {} } };
}

describe("cstack tracker comment", () => {
  it("gives gh only the file path on a GitHub repository", async () => {
    const s = setup("https://github.com/o/r.git");
    expect(await trackerComment(["#12", "--body-file", s.file], s.io, s.deps)).toBe(0);
    const post = s.calls.find((c) => c.command === "gh" && c.args[0] === "issue")!;
    expect(post.args).toEqual(["issue", "comment", "12", "--repo", "github.com/o/r", "--body-file", realpathSync(s.file)]);
    expect(s.calls.some((c) => ["sh", "bash", "zsh"].includes(c.command))).toBe(false);
    expect(JSON.stringify(s.calls)).not.toContain("rm -rf");
  });

  it("gives glab the text as the one argument after --message on a GitLab repository", async () => {
    const s = setup("https://gitlab.com/o/r.git");
    expect(await trackerComment(["#12", "--body-file", s.file], s.io, s.deps)).toBe(0);
    const post = s.calls.find((c) => c.command === "glab" && c.args[0] === "issue")!;
    expect(post.args.slice(-2)).toEqual(["--message", NASTY]);
    expect(post.args.filter((a) => a.includes("rm -rf"))).toHaveLength(1);
    expect(s.calls.some((c) => ["sh", "bash", "zsh"].includes(c.command))).toBe(false);
  });

  it("exits with 4 and prints the key and the path when no client is logged in", async () => {
    const s = setup("https://github.com/o/r.git", false);
    expect(await trackerComment(["#12", "--body-file", s.file], s.io, s.deps)).toBe(4);
    expect(s.out.stderr).toContain(`add the text of ${s.file} as a comment on #12`);
  });

  it("exits with 1 naming the path, and calls no program, when the file cannot be read", async () => {
    const s = setup("https://gitlab.com/o/r.git");
    const missing = join(s.deps.cwd, "missing.md");
    expect(await trackerComment(["#12", "--body-file", missing], s.io, s.deps)).toBe(1);
    expect(s.out.stderr).toContain(missing);
    expect(s.calls).toEqual([]);
  });

  it("exits with 2 when --body-file is missing", async () => {
    const s = setup("https://github.com/o/r.git");
    expect(await trackerComment(["#12"], s.io, s.deps)).toBe(2);
  });
});
