import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { git, makeRepo } from "./helpers/plan-repo.js";

const RECORD = "docs/decisions/ADR-SAMPLE-A-sample.md";
const LINE = "// WHY: ADR-SAMPLE-A, the reason.\n";

/** Commits a file with a fixed author time, in seconds. */
function commitAt(dir: string, file: string, text: string, seconds: number): void {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
  git(dir, "add", file);
  const date = `${seconds} +0000`;
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", "commit", "-m", "change"],
    { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } },
  );
}

const load = () => import("../src/audit/records.js");

describe("records", () => {
  it("exports the two actions that git proves", async () => {
    const { GIT_ACTIONS } = await load();
    expect([...GIT_ACTIONS]).toEqual(["write-decision-record", "write-why-comment"]);
  });

  it("gives the author time of the oldest branch commit that changes a record file", async () => {
    const { recordTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, RECORD, "one\n", 1_700_000_000);
    commitAt(dir, RECORD, "two\n", 1_700_000_500);
    expect(recordTime(dir, "main", [RECORD])).toBe(1_700_000_000_000);
  });

  it("gives undefined when only the target branch changed the record file", async () => {
    const { recordTime } = await load();
    const dir = makeRepo();
    commitAt(dir, RECORD, "one\n", 1_700_000_000);
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", "x\n", 1_700_000_500);
    expect(recordTime(dir, "main", [RECORD])).toBeUndefined();
  });

  it("gives undefined when no branch commit changes a record file", async () => {
    const { recordTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", "x\n", 1_700_000_500);
    expect(recordTime(dir, "main", [RECORD])).toBeUndefined();
  });

  it("gives the author time of the oldest branch commit that adds a WHY line naming a record", async () => {
    const { whyTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", LINE, 1_700_000_300);
    expect(whyTime(dir, "main", ["ADR-SAMPLE-A"])).toBe(1_700_000_300_000);
  });

  it("gives undefined for a WHY line that names no record", async () => {
    const { whyTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", "// WHY: a local reason.\n", 1_700_000_300);
    expect(whyTime(dir, "main", ["ADR-SAMPLE-A"])).toBeUndefined();
  });

  it("gives undefined for a WHY line in a Markdown file", async () => {
    const { whyTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "docs/notes.md", "WHY: ADR-SAMPLE-A, the reason.\n", 1_700_000_300);
    expect(whyTime(dir, "main", ["ADR-SAMPLE-A"])).toBeUndefined();
  });

  it("gives undefined for a WHY line that the branch only removes", async () => {
    const { whyTime } = await load();
    const dir = makeRepo();
    commitAt(dir, "src/a.ts", LINE, 1_700_000_000);
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", "// nothing\n", 1_700_000_300);
    expect(whyTime(dir, "main", ["ADR-SAMPLE-A"])).toBeUndefined();
  });

  it("gives undefined when the name is on another line than WHY:", async () => {
    const { whyTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", "// WHY: the reason.\n// See ADR-SAMPLE-A.\n", 1_700_000_300);
    expect(whyTime(dir, "main", ["ADR-SAMPLE-A"])).toBeUndefined();
  });

  it("gives undefined from both functions when the target branch does not exist", async () => {
    const { recordTime, whyTime } = await load();
    const dir = makeRepo();
    git(dir, "checkout", "-b", "feature");
    commitAt(dir, "src/a.ts", LINE, 1_700_000_300);
    expect(recordTime(dir, "missing", [RECORD])).toBeUndefined();
    expect(whyTime(dir, "missing", ["ADR-SAMPLE-A"])).toBeUndefined();
  });
});
