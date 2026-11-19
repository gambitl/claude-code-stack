import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { planStatus } from "../../src/commands/plan-status.js";
import { unitCollect } from "../../src/commands/unit-collect.js";
import { unitRed } from "../../src/commands/unit-red.js";
import { createRecord, makeHelperId } from "../../src/helper/record.js";
import { saveUnitReport } from "../../src/report/reports.js";
import { runFolder } from "../../src/run-state.js";
import { collect, git, makeRepo } from "../helpers/plan-repo.js";

const approved = readFileSync(new URL("../fixtures/plans/approved.md", import.meta.url), "utf8");
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function planText(): string {
  const head = approved.slice(0, approved.indexOf("## Implementation units"));
  const tail = approved.slice(approved.indexOf("## Documentation duties"));
  const body =
    "### Unit 1: Thing 1\n- Files: `src/a.ts`, `test/a.test.ts`\n- Test: `test/a.test.ts`: a case.\n- Minimum code: Write it.\n- Refactor: None.\n- Commit message: `feat(cli): add 1`\n- Depends on: none\n";
  return `${head}## Implementation units\n\n${body}\n${tail}`;
}

// WHY: ADR-SIC-B puts the run folder under the common git folder, so a child worktree and the ticket worktree
// share it. This test shows that a failing run saved in a child worktree is seen by the ticket worktree, before
// and after the collect, with no copy of any file.
describe("saved test runs and child worktrees", () => {
  it("shows a failing run saved in a child worktree to the ticket worktree after the collect", async () => {
    const dir = realpathSync(makeRepo());
    made.push(dir);
    git(dir, "config", "user.name", "t");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "switch", "-c", "gambitl/units");
    mkdirSync(join(dir, "docs"), { recursive: true });
    mkdirSync(join(dir, ".cstack"), { recursive: true });
    writeFileSync(join(dir, "docs/plan.md"), planText());
    writeFileSync(join(dir, ".cstack/settings.json"), JSON.stringify({ version: 1, testCommands: { all: "false" } }));
    git(dir, "add", "docs/plan.md", ".cstack/settings.json");
    git(dir, "commit", "-m", "docs: plan");
    const child = `${dir}-child-1`;
    made.push(child);
    git(dir, "worktree", "add", "-b", "child-1", child, "HEAD");

    mkdirSync(join(child, "test"), { recursive: true });
    writeFileSync(join(child, "test/a.test.ts"), "x\n");
    const red = collect();
    expect(await unitRed(["1", "--plan", "docs/plan.md"], red.io, child)).toBe(0);

    const folder = runFolder(dir, "docs/plan.md");
    expect(runFolder(child, "docs/plan.md")).toBe(folder);
    expect(existsSync(join(folder, "units/1/red.json"))).toBe(true);
    expect(existsSync(join(child, ".git/cstack"))).toBe(false);

    mkdirSync(join(child, "src"), { recursive: true });
    writeFileSync(join(child, "src/a.ts"), "y\n");
    git(child, "add", "src/a.ts", "test/a.test.ts");
    git(child, "commit", "-m", "feat(cli): add 1\n\nCstack-Unit: 1");

    const id = makeHelperId("implementer", 1);
    createRecord(folder, {
      format: "cstack-helper/1",
      id,
      role: "implementer",
      unit: 1,
      startedAt: new Date().toISOString(),
      mode: "orca-worker",
      worktree: { path: child, branch: "child-1" },
    });
    saveUnitReport({ root: dir, planFile: "docs/plan.md" }, 1, { kind: "done", text: "ok", helper: id });
    const picked = collect();
    expect(unitCollect(["1", "--plan", "docs/plan.md"], picked.io, { cwd: dir })).toBe(0);

    const status = collect();
    expect(planStatus(["--plan", "docs/plan.md", "--json"], status.io, { cwd: dir })).toBe(0);
    const unit = JSON.parse(status.out.stdout).units[0];
    expect(unit.done).toBe(true);
    expect(unit.failingRunSaved).toBe(true);
    expect(existsSync(join(dir, ".git/cstack/runs/plan/units/1/red.json"))).toBe(true);
    expect(existsSync(join(dir, "test/a.test.ts"))).toBe(true);
  });
});
