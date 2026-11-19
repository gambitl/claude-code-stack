import { spawnSync } from "node:child_process";

export type UnitFileState = "changed" | "new" | "deleted";
export type UnitFileEntry = { path: string; state: UnitFileState };

const TEST_FOLDERS = new Set(["test", "tests", "__tests__", "fixtures", "spec", "specs", "__mocks__", "__snapshots__", "testdata"]);
const TEST_NAME = /(\.(test|spec)|_(test|spec))\.[^.]+$|^test_/;

/** True when the path is the file of the unit's Test line, is under a test folder, or has a test file name. */
export function isTestFile(path: string, testFile: string): boolean {
  const lower = path.toLowerCase();
  if (lower === testFile.toLowerCase()) return true;
  const parts = lower.split("/");
  const name = parts.pop() ?? "";
  return parts.some((p) => TEST_FOLDERS.has(p)) || TEST_NAME.test(name);
}

/**
 * Reads the git status of the files of a unit. The git command is the same as the one in
 * checkUnit() of unit-commit.ts. A path that does not exist and is not tracked gives no entry.
 * When git fails, the result holds the message of git, so that the caller can exit with 5.
 */
export function readUnitStatus(root: string, files: string[]): { entries: UnitFileEntry[] } | { error: string } {
  if (files.length === 0) return { entries: [] };
  const r = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames", "--", ...files], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.error) return { error: r.error.message };
  if (r.status !== 0) return { error: (r.stderr || r.stdout || `git status exited with ${r.status}`).trim() };
  const entries = r.stdout
    .split("\0")
    .filter((e) => e.length > 0)
    .map((e): UnitFileEntry => {
      const xy = e.slice(0, 2);
      const state = xy === "??" || xy.includes("A") ? "new" : xy.includes("D") ? "deleted" : "changed";
      return { path: e.slice(3), state };
    });
  return { entries };
}

/** The text that tells the implementer how to start unit <n> again. Three refusals use it. */
export function restartText(n: number): string {
  return (
    `If you made these changes yourself in this unit, discard them. Use \`git restore -- <file>\` for a changed or deleted file, and delete a new file. ` +
    `Then run \`cstack unit red ${n}\` again, and write the code only after it saved the failure. ` +
    `If you did not make these changes, they may be the work of another unit, so do not discard them. Report the unit as stuck with this message.`
  );
}
