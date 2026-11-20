import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const build = readFileSync(new URL("../../guides/resolve-issue/build.md", import.meta.url), "utf8");
const units = build.slice(build.indexOf("## Build the units"), build.indexOf("## User interface"));
const sentences = units.split(/(?<=[.!?])\s+/);

describe("the build sections of the build guide", () => {
  it("starts the implementers with cstack helper start", () => {
    expect(units).toContain("cstack helper start implementer --plan <plan file> --unit <n>");
    expect(units).toContain("cstack helper start implementer-escalation --plan <plan file> --unit <n>");
  });

  it("adds --child-worktree only for a batch of more than one unit", () => {
    const line = sentences.find((s) => s.includes("--child-worktree"));
    expect(line).toContain("more than one unit");
  });

  it("keeps the rule about testCommands.file and that the executor never builds a unit", () => {
    expect(units).toContain("testCommands.file");
    expect(units).toContain("Never build a unit yourself");
  });

  it("waits with cstack helper wait and a shell timeout of ten minutes", () => {
    expect(units).toContain("cstack helper wait <helper id>");
    expect(units).toContain("ten minutes");
    expect(units).toContain("returned");
  });

  it("saves a stuck report when a helper ended without a report", () => {
    expect(units).toContain("cstack helper done stuck --helper <helper id> --plan <plan file>");
  });

  it("collects the units of a batch and handles exit code 1", () => {
    expect(units).toContain("cstack unit collect <n>... --plan <plan file>");
    const line = sentences.find((s) => s.includes("exit code `1`") && s.includes("cstack unit collect"));
    expect(line, "no sentence about exit code 1 of cstack unit collect").toContain("needs-decision");
  });

  it("asks before a kept child worktree goes and never removes one with git", () => {
    const step = units.slice(units.indexOf("7. When every unit"), units.indexOf("8. "));
    expect(step).toContain("kept");
    expect(step).toContain("needs-decision");
    expect(step).toContain("quotes the message");
    expect(step).toMatch(/never remove a worktree or a branch with `git`/i);
    expect(step).toContain("--discard-untracked");
    expect(step).toContain("`## Decisions`");
  });

  it("commits the plan file at the end of the build because of the Worktree lines", () => {
    expect(units).toContain("Worktree");
  });
});
