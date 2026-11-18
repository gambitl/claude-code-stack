import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { unitCommit } from "../src/commands/unit-commit.js";
import type { Io } from "../src/io.js";

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  ).trim();

const approved = readFileSync(new URL("./fixtures/plans/approved.md", import.meta.url), "utf8");

interface U {
  files: string[];
  message?: string;
}

function planText(units: U[]): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const body = units
    .map(
      (u, i) =>
        `### Unit ${i + 1}: Thing ${i + 1}\n- Files: ${u.files.map((f) => `\`${f}\``).join(", ")}\n- No test: prose only.\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`${u.message ?? `feat(cli): add ${i + 1}`}\`\n- Depends on: none\n`,
    )
    .join("\n");
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

function setup(units: U[]) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "cstack-commit-")));
  made.push(dir);
  git(dir, "init", "-b", "main");
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/old.ts"), "old");
  writeFileSync(join(dir, "start.txt"), "x");
  git(dir, "add", ".");
  git(dir, "commit", "-m", "chore: start");
  git(dir, "switch", "-c", "feature");
  writeFileSync(join(dir, "plan.md"), planText(units));
  git(dir, "add", "plan.md");
  git(dir, "commit", "-m", "docs: plan");
  return dir;
}

const write = (dir: string, file: string, text = "changed") => writeFileSync(join(dir, file), text);

async function commit(dir: string, n = "1", wait = 300) {
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => (out.stdout += t), stderr: (t) => (out.stderr += t) };
  const code = await unitCommit([n, "--plan", "plan.md"], io, dir, wait);
  return { code, ...out };
}

const two: U[] = [{ files: ["src/a.ts"] }, { files: ["src/b.ts"] }];

describe("cstack unit commit", () => {
  it("commits only the files of the unit, with its message and trailer", async () => {
    const dir = setup(two);
    write(dir, "src/a.ts");
    write(dir, "src/b.ts");
    const r = await commit(dir);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(git(dir, "rev-parse", "--short", "HEAD"));
    expect(git(dir, "show", "--name-only", "--format=", "HEAD")).toBe("src/a.ts");
    const message = git(dir, "log", "-1", "--format=%B");
    expect(message).toBe("feat(cli): add 1\n\nCstack-Unit: 1");
    expect(git(dir, "log", "-1", "--format=%(trailers:key=Cstack-Unit,valueonly)").trim()).toBe("1");
    expect(git(dir, "status", "--porcelain")).toBe("?? src/b.ts");
    expect(existsSync(join(dir, ".git/cstack/unit-commit.lock"))).toBe(false);
  });

  it("refuses when a file of another unit is already staged, and keeps it staged", async () => {
    const dir = setup(two);
    write(dir, "src/a.ts");
    write(dir, "src/b.ts");
    git(dir, "add", "src/b.ts");
    const head = git(dir, "rev-parse", "HEAD");
    const r = await commit(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/b.ts");
    expect(git(dir, "rev-parse", "HEAD")).toBe(head);
    expect(git(dir, "diff", "--cached", "--name-only")).toBe("src/b.ts");
  });

  it("refuses a unit with no changed file", async () => {
    const dir = setup(two);
    write(dir, "src/b.ts");
    const r = await commit(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("no changed file");
  });

  it("lists every broken rule at once", async () => {
    const dir = setup(two);
    git(dir, "add", "plan.md");
    write(dir, "src/b.ts");
    git(dir, "add", "src/b.ts");
    const r = await commit(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("src/b.ts");
    expect(r.stderr).toContain("no changed file");
  });

  it("commits a new file and a deleted file of the unit", async () => {
    const dir = setup([{ files: ["src/new.ts", "src/old.ts"] }]);
    write(dir, "src/new.ts");
    rmSync(join(dir, "src/old.ts"));
    const r = await commit(dir);
    expect(r.code).toBe(0);
    expect(git(dir, "show", "--name-status", "--format=", "HEAD").split("\n").sort()).toEqual([
      "A\tsrc/new.ts",
      "D\tsrc/old.ts",
    ]);
  });

  it("exits with 5 and prints the output of a failing hook, and unstages what it staged", async () => {
    const dir = setup(two);
    write(dir, "src/a.ts");
    const hook = join(dir, ".git/hooks/pre-commit");
    mkdirSync(dirname(hook), { recursive: true });
    writeFileSync(hook, "#!/bin/sh\necho hook says no\nexit 1\n");
    chmodSync(hook, 0o755);
    const r = await commit(dir);
    expect(r.code).toBe(5);
    expect(r.stderr + r.stdout).toContain("hook says no");
    expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
    expect(git(dir, "status", "--porcelain")).toBe("?? src/a.ts");
    expect(existsSync(join(dir, ".git/cstack/unit-commit.lock"))).toBe(false);
  });

  it("keeps a message with shell characters byte for byte", async () => {
    const dir = setup([{ files: ["src/a.ts"], message: "feat(cli): $(touch pwned) `touch pwned2`" }]);
    write(dir, "src/a.ts");
    const r = await commit(dir);
    expect(r.code).toBe(0);
    expect(git(dir, "log", "-1", "--format=%s")).toBe("feat(cli): $(touch pwned) `touch pwned2`");
    expect(existsSync(join(dir, "pwned"))).toBe(false);
    expect(existsSync(join(dir, "pwned2"))).toBe(false);
  });

  it("exits with 1 and names the holder when the lock is taken", async () => {
    const dir = setup(two);
    write(dir, "src/a.ts");
    mkdirSync(join(dir, ".git/cstack"), { recursive: true });
    writeFileSync(join(dir, ".git/cstack/unit-commit.lock"), JSON.stringify({ unit: 2, pid: process.pid }));
    const r = await commit(dir);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("unit 2");
  });

  it("exits with 2 for a unit the plan does not have", async () => {
    const dir = setup(two);
    for (const n of ["3", "0", "x"]) expect((await commit(dir, n)).code).toBe(2);
  });
});
