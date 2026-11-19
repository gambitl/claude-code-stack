import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Io } from "../../src/io.js";

export const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd, encoding: "utf8" },
  ).trim();

/** A temporary repository on main with one first commit. */
export function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "cstack-plan-"));
  git(dir, "init", "-b", "main");
  writeFileSync(join(dir, "README.md"), "start\n");
  git(dir, "add", "README.md");
  git(dir, "commit", "-m", "chore: start");
  return dir;
}

/** Writes a plan file and commits it. Returns the path relative to the repository. */
export function commitPlan(dir: string, text: string, path = "docs/plans/full.md"): string {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
  git(dir, "add", path);
  git(dir, "commit", "-m", "docs: add the plan");
  return path;
}

/** Commits changes to the given files, with a Cstack-Unit trailer in the final paragraph when a unit is given. */
export function commitFiles(dir: string, files: string[], unit?: number): string {
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), `${Math.random()}\n`);
  }
  git(dir, "add", ...files);
  const message = unit === undefined ? "chore: change" : `feat(cli): unit ${unit}\n\nCstack-Unit: ${unit}`;
  git(dir, "commit", "-m", message);
  return git(dir, "rev-parse", "HEAD");
}

export function collect() {
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (t) => {
      out.stdout += t;
    },
    stderr: (t) => {
      out.stderr += t;
    },
  };
  return { out, io };
}
