import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { isTestFile, readUnitStatus } from "../src/unit-files.js";

describe("isTestFile", () => {
  it("accepts the file of the Test line without regard to case", () => {
    expect(isTestFile("Src/Odd.ts", "src/odd.TS")).toBe(true);
  });

  it.each(["test", "tests", "__tests__", "fixtures", "spec", "specs", "__mocks__", "__snapshots__", "testdata"])(
    "accepts a path with the folder %s at any depth",
    (folder) => {
      expect(isTestFile(`${folder}/a.ts`, "x/y.ts")).toBe(true);
      expect(isTestFile(`cstack/${folder.toUpperCase()}/deep/a.ts`, "x/y.ts")).toBe(true);
    },
  );

  it.each(["a.test.ts", "a.spec.js", "a_test.go", "a_spec.rb", "test_a.py", "src/A.TEST.ts"])(
    "accepts the name %s",
    (name) => {
      expect(isTestFile(name, "x/y.ts")).toBe(true);
    },
  );

  it.each(["src/a.ts", "cstack/src/test-run.ts", "src/contest.ts", "docs/testing.md", "src/latest/a.ts"])(
    "rejects %s",
    (path) => {
      expect(isTestFile(path, "x/y.ts")).toBe(false);
    },
  );
});

describe("readUnitStatus", () => {
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" });
  const write = (root: string, path: string, text = "x") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const repo = () => {
    const root = mkdtempSync(join(tmpdir(), "cstack-unit-files-"));
    git(root, "init", "-q");
    git(root, "config", "user.email", "a@users.noreply.github.com");
    git(root, "config", "user.name", "a");
    write(root, "src/kept.ts");
    write(root, "src/changed.ts");
    write(root, "src/gone.ts");
    git(root, "add", ".");
    git(root, "commit", "-q", "-m", "first");
    return root;
  };

  it("reports changed, new, intent-to-add and deleted files, and nothing else", () => {
    const root = repo();
    write(root, "src/changed.ts", "changed");
    rmSync(join(root, "src/gone.ts"));
    write(root, "src/fresh.ts");
    write(root, "newdir/deep/fresh.ts");
    write(root, "src/marked.ts");
    git(root, "add", "-N", "src/marked.ts");
    const files = ["src/kept.ts", "src/changed.ts", "src/gone.ts", "src/fresh.ts", "newdir", "src/marked.ts", "src/missing.ts"];
    const result = readUnitStatus(root, files);
    expect(result).toEqual({
      entries: expect.any(Array),
    });
    const sorted = (result as { entries: { path: string; state: string }[] }).entries.sort((a, b) => a.path.localeCompare(b.path));
    expect(sorted).toEqual([
      { path: "newdir/deep/fresh.ts", state: "new" },
      { path: "src/changed.ts", state: "changed" },
      { path: "src/fresh.ts", state: "new" },
      { path: "src/gone.ts", state: "deleted" },
      { path: "src/marked.ts", state: "new" },
    ]);
  });

  it("returns an empty list for an empty list of files", () => {
    expect(readUnitStatus(repo(), [])).toEqual({ entries: [] });
  });

  it("returns the message of git when git status fails", () => {
    const root = repo();
    writeFileSync(join(root, ".git/index"), "damaged");
    const result = readUnitStatus(root, ["src/kept.ts"]);
    expect(result).toEqual({ error: expect.stringMatching(/\S/) });
  });
});
