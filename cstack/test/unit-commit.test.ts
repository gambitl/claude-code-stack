import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { matchMention } from "../src/manifest.js";
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
  test?: boolean;
  dependsOn?: number[];
  blocked?: string;
}

function planText(units: U[]): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const body = units
    .map(
      (u, i) =>
        `### Unit ${i + 1}: Thing ${i + 1}\n- Files: ${u.files.map((f) => `\`${f}\``).join(", ")}\n${u.test ? `- Test: \`${u.files[0]}\`: a case.` : "- No test: prose only."}\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: \`${u.message ?? `feat(cli): add ${i + 1}`}\`\n- Depends on: ${u.dependsOn?.join(", ") ?? "none"}\n${u.blocked ? `- Blocked: ${u.blocked}\n` : ""}`,
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

async function commit(dir: string, n = "1", wait = 300, extra: string[] = []) {
  const out = { stdout: "", stderr: "" };
  const io: Io = { stdout: (t) => (out.stdout += t), stderr: (t) => (out.stderr += t) };
  const code = await unitCommit([n, ...extra, "--plan", "plan.md"], io, dir, wait);
  return { code, ...out };
}

function saveRun(dir: string, n: number, kind: "red" | "green", time: string) {
  const folder = join(dir, ".git/cstack/runs/plan/units", String(n));
  mkdirSync(folder, { recursive: true });
  const raw = time.startsWith("{") ? time : JSON.stringify({ time, command: "t", exitCode: 0, commit: "x", testFile: "t" });
  writeFileSync(join(folder, `${kind}.json`), raw);
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

  it("commits a deletion that git rm already staged", async () => {
    const dir = setup([{ files: ["src/new.ts", "src/old.ts"] }]);
    write(dir, "src/new.ts");
    git(dir, "rm", "-q", "src/old.ts");
    const r = await commit(dir);
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    expect(git(dir, "show", "--name-status", "--format=", "HEAD").split("\n").sort()).toEqual([
      "A\tsrc/new.ts",
      "D\tsrc/old.ts",
    ]);
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("commits a rename that git mv already staged, when the unit lists both paths", async () => {
    const dir = setup([{ files: ["src/old.ts", "src/moved.ts"] }]);
    git(dir, "mv", "src/old.ts", "src/moved.ts");
    const r = await commit(dir);
    expect(r.stderr).toBe("");
    expect(r.code).toBe(0);
    expect(git(dir, "show", "--name-status", "--no-renames", "--format=", "HEAD").split("\n").sort()).toEqual([
      "A\tsrc/moved.ts",
      "D\tsrc/old.ts",
    ]);
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("unstages only what it staged when the hook fails after a git rm", async () => {
    const dir = setup([{ files: ["src/new.ts", "src/old.ts"] }]);
    write(dir, "src/new.ts");
    git(dir, "rm", "-q", "src/old.ts");
    const hook = join(dir, ".git/hooks/pre-commit");
    mkdirSync(dirname(hook), { recursive: true });
    writeFileSync(hook, "#!/bin/sh\nexit 1\n");
    chmodSync(hook, 0o755);
    const r = await commit(dir);
    expect(r.code).toBe(5);
    expect(git(dir, "status", "--porcelain", "--untracked-files=all").split("\n").sort()).toEqual(["?? src/new.ts", "D  src/old.ts"]);
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

  const saveSettings = (dir: string, text: string) => {
    mkdirSync(join(dir, ".cstack"));
    writeFileSync(join(dir, ".cstack/settings.json"), text);
  };
  const body = (dir: string) => git(dir, "log", "-1", "--format=%B").trimEnd().split("\n");

  it("adds the attribution lines right after the trailer, and git still reads them as trailers", async () => {
    const dir = setup(two);
    saveSettings(dir, JSON.stringify({ version: 1, commitAttribution: ["Assisted-by: test agent <agent@example.com>"] }));
    write(dir, "src/a.ts");
    const r = await commit(dir);
    expect(r.code).toBe(0);
    expect(body(dir).slice(-2)).toEqual(["Cstack-Unit: 1", "Assisted-by: test agent <agent@example.com>"]);
    expect(git(dir, "log", "-1", "--format=%(trailers:key=Cstack-Unit,valueonly)").trim()).toBe("1");
    expect(git(dir, "log", "-1", "--format=%(trailers:key=Assisted-by,valueonly)").trim()).toBe("test agent <agent@example.com>");
  });

  it("keeps the unit trailer last with no settings file or an empty list", async () => {
    const dir = setup(two);
    write(dir, "src/a.ts");
    expect((await commit(dir)).code).toBe(0);
    expect(body(dir).at(-1)).toBe("Cstack-Unit: 1");
    saveSettings(dir, JSON.stringify({ version: 1, commitAttribution: [] }));
    write(dir, "src/b.ts");
    expect((await commit(dir, "2")).code).toBe(0);
    expect(body(dir).at(-1)).toBe("Cstack-Unit: 2");
  });

  it("exits with 3 and stages nothing when the settings file is invalid", async () => {
    const dir = setup(two);
    saveSettings(dir, JSON.stringify({ reviewer: "x" }));
    write(dir, "src/a.ts");
    const r = await commit(dir);
    expect(r.code).toBe(3);
    expect(r.stderr).toContain("cstack unit commit: ");
    expect(r.stderr).toContain("reviewer");
    expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
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

  describe("refusals before staging", () => {
    const tested: U[] = [{ files: ["src/a.ts"], test: true }];

    it("refuses a Test unit with a failing run and no passing run", async () => {
      const dir = setup(tested);
      write(dir, "src/a.ts");
      saveRun(dir, 1, "red", "2026-01-01T10:00:00Z");
      const r = await commit(dir);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("passing run");
      expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
    });

    it("refuses a passing run older than the failing run, and accepts a newer one", async () => {
      const dir = setup(tested);
      write(dir, "src/a.ts");
      saveRun(dir, 1, "red", "2026-01-01T10:00:00Z");
      saveRun(dir, 1, "green", "2026-01-01T09:00:00Z");
      expect((await commit(dir)).code).toBe(1);
      saveRun(dir, 1, "green", "2026-01-01T11:00:00Z");
      expect((await commit(dir)).code).toBe(0);
    });

    it("exits with 3 when a saved run is not valid JSON", async () => {
      const dir = setup(tested);
      write(dir, "src/a.ts");
      saveRun(dir, 1, "red", "{not json");
      expect((await commit(dir)).code).toBe(3);
    });

    it("refuses a unit whose dependency has no commit", async () => {
      const dir = setup([{ files: ["src/a.ts"] }, { files: ["src/b.ts"], dependsOn: [1] }]);
      write(dir, "src/b.ts");
      const r = await commit(dir, "2");
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("unit 1");
    });

    it("refuses while another unit that shares a file has started without a commit", async () => {
      const dir = setup([{ files: ["src/a.ts"] }, { files: ["src/a.ts"], test: true }]);
      write(dir, "src/a.ts");
      saveRun(dir, 2, "red", "2026-01-01T10:00:00Z");
      const r = await commit(dir);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("unit 2");
      expect(r.stderr).toContain("src/a.ts");
    });

    it("refuses a blocked unit with its reason", async () => {
      const dir = setup([{ files: ["src/a.ts"], blocked: "waiting for the design" }]);
      write(dir, "src/a.ts");
      const r = await commit(dir);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("waiting for the design");
    });

    it("refuses a path under a symbolic link and a path that git ignores", async () => {
      const dir = setup([{ files: ["lnk/z.ts", "src/skip.ts", "src/a.ts"] }]);
      mkdirSync(join(dir, "real"));
      symlinkSync(join(dir, "real"), join(dir, "lnk"));
      writeFileSync(join(dir, ".gitignore"), "src/skip.ts\n");
      write(dir, "src/skip.ts");
      write(dir, "src/a.ts");
      const r = await commit(dir);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("lnk/z.ts");
      expect(r.stderr).toContain("src/skip.ts");
      expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
    });

    it("lists two broken rules in one message", async () => {
      const dir = setup([{ files: ["src/a.ts"], test: true, blocked: "later" }]);
      write(dir, "src/a.ts");
      saveRun(dir, 1, "red", "2026-01-01T10:00:00Z");
      const r = await commit(dir);
      expect(r.stderr).toContain("later");
      expect(r.stderr).toContain("passing run");
    });
  });

  describe("--message", () => {
    const subject = (dir: string, rev = "HEAD") => git(dir, "log", "-1", "--format=%s", rev);
    const second = async (dir: string, extra: string[] = []) => {
      write(dir, "src/a.ts", "one");
      expect((await commit(dir)).code).toBe(0);
      write(dir, "src/a.ts", "two");
      return commit(dir, "1", 300, extra);
    };

    it("refuses a second commit of a unit without --message and commits nothing", async () => {
      const dir = setup(two);
      write(dir, "src/a.ts", "one");
      await commit(dir);
      write(dir, "src/a.ts", "two");
      const head = git(dir, "rev-parse", "HEAD");
      const r = await commit(dir);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("--message");
      expect(r.stderr).toContain("feat(cli): add 1");
      expect(r.stderr).toContain('cstack unit commit 1 --message "');
      expect(git(dir, "rev-parse", "HEAD")).toBe(head);
      expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
    });

    it("gives a second commit the subject of --message, with the trailer last", async () => {
      const dir = setup(two);
      const r = await second(dir, ["--message", "fix: add the missing cases"]);
      expect(r.code).toBe(0);
      expect(git(dir, "log", "-1", "--format=%B")).toBe("fix: add the missing cases\n\nCstack-Unit: 1");
    });

    it("keeps the subject of the plan on a first commit without --message", async () => {
      const dir = setup(two);
      write(dir, "src/a.ts");
      expect((await commit(dir)).code).toBe(0);
      expect(subject(dir)).toBe("feat(cli): add 1");
    });

    it("uses --message on a first commit, trimmed at both ends", async () => {
      const dir = setup(two);
      write(dir, "src/a.ts");
      expect((await commit(dir, "1", 300, ["--message", "  fix: own subject  "])).code).toBe(0);
      expect(git(dir, "log", "-1", "--format=%B")).toBe("fix: own subject\n\nCstack-Unit: 1");
    });

    it("refuses a --message equal to an earlier subject, also in another case or with spaces", async () => {
      for (const same of ["feat(cli): add 1", "  FEAT(cli): Add 1  "]) {
        const dir = setup(two);
        const r = await second(dir, ["--message", same]);
        expect(r.code).toBe(1);
        expect(r.stderr).toContain("feat(cli): add 1");
        expect(r.stderr).toContain("cstack unit commit 1 --message");
        expect(subject(dir)).toBe("feat(cli): add 1");
        expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
      }
    });

    it("rejects an empty value, spaces only and a line break with exit 2 and stages nothing", async () => {
      for (const bad of ["", "   ", "a\nb"]) {
        const dir = setup(two);
        write(dir, "src/a.ts");
        const r = await commit(dir, "1", 300, ["--message", bad]);
        expect(r.code).toBe(2);
        expect(r.stderr).toContain("Usage: cstack unit commit <n> [--message <subject>] [--plan <file>]");
        expect(git(dir, "diff", "--cached", "--name-only")).toBe("");
      }
    });

    it("lists the missing --message together with another broken rule", async () => {
      const dir = setup([{ files: ["src/a.ts"] }, { files: ["src/b.ts"] }]);
      write(dir, "src/a.ts", "one");
      await commit(dir);
      write(dir, "src/a.ts", "two");
      write(dir, "src/b.ts");
      git(dir, "add", "src/b.ts");
      const r = await commit(dir);
      expect(r.code).toBe(1);
      expect(r.stderr).toContain("--message");
      expect(r.stderr).toContain("src/b.ts is staged");
    });

    it("is accepted in a mention of the command list", () => {
      expect(matchMention('unit commit 1 --message "x" --plan plan.md').ok).toBe(true);
    });
  });
});
