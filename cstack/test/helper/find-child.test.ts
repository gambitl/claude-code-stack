import { realpathSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findChildWorktree, listWorktrees } from "../../src/helper/child.js";
import { git, makeRepo } from "../helpers/plan-repo.js";

function repo() {
  const dir = realpathSync(makeRepo());
  const other = `${dir}-other`;
  git(dir, "worktree", "add", "-b", "other", other, "HEAD");
  const before = listWorktrees(dir);
  const child = `${dir}-child`;
  git(dir, "worktree", "add", "-b", "child/unit-1-abc", child, "HEAD");
  return { dir, other, child, before };
}

describe("findChildWorktree", () => {
  it("takes the path of the answer when it is a new worktree", () => {
    const t = repo();
    expect(findChildWorktree(t.dir, t.before, `repo::${t.child}`, "unit-1-abc")).toEqual({ path: realpathSync(t.child), branch: "child/unit-1-abc" });
  });

  it("ignores an answer that names the ticket worktree and uses the one new worktree with the name", () => {
    const t = repo();
    expect(findChildWorktree(t.dir, t.before, `repo::${t.dir}`, "unit-1-abc")?.path).toBe(realpathSync(t.child));
  });

  it("ignores an answer that names a worktree that existed before", () => {
    const t = repo();
    expect(findChildWorktree(t.dir, t.before, `repo::${t.other}`, "unit-1-abc")?.path).toBe(realpathSync(t.child));
  });

  it("finds nothing when the answer names the ticket worktree and no new worktree has the name", () => {
    const t = repo();
    expect(findChildWorktree(t.dir, t.before, `repo::${t.dir}`, "unit-9-zzz")).toBeUndefined();
  });
});
