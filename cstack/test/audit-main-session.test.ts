import { describe, expect, it } from "vitest";

async function load() {
  return await import("../src/audit/main-session.js");
}

type C = { time: number; args: string[]; file: number; helper: boolean };
let t = 0;
function call(file: number, line: string, helper = false): C {
  return { time: ++t, args: line.split(" "), file, helper };
}

const PLAN = "docs/plans/a.md";

describe("mainFiles", () => {
  it("counts a main session that holds the close of the ticket phase for the plan", async () => {
    const { mainFiles } = await load();
    const r = mainFiles([call(0, "next --done ticket --plan docs/plans/a.md")], PLAN);
    expect([...r.files]).toEqual([0]);
    expect(r.fallback).toBe(false);
  });

  it("counts a second main session that holds next --done plan with no --plan", async () => {
    const { mainFiles } = await load();
    const r = mainFiles([call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "next --done plan")], PLAN);
    expect([...r.files].sort()).toEqual([0, 1]);
  });

  it("counts a second main session that holds next --phase retro with an absolute path", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "next --phase retro --plan /home/user/x/docs/plans/a.md")],
      PLAN,
    );
    expect([...r.files].sort()).toEqual([0, 1]);
  });

  it("counts a second main session that holds helper start executor with --plan=", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "helper start executor --plan=docs/plans/a.md")],
      PLAN,
    );
    expect([...r.files].sort()).toEqual([0, 1]);
  });

  it("does not count a main session that holds only next --done build", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "next --done build --plan docs/plans/a.md")],
      PLAN,
    );
    expect([...r.files]).toEqual([0]);
  });

  it("does not count a session whose only call is next --done ticket for another plan", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "next --done ticket --plan docs/plans/b.md")],
      PLAN,
    );
    expect([...r.files]).toEqual([0]);
  });

  it("does not count a session whose only call is next --done plan for another plan", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "next --done plan --plan docs/plans/b.md")],
      PLAN,
    );
    expect([...r.files]).toEqual([0]);
  });

  it("does not count a helper transcript that holds next --done plan", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done ticket --plan docs/plans/a.md"), call(1, "next --done plan", true)],
      PLAN,
    );
    expect([...r.files]).toEqual([0]);
  });

  it("falls back to every file that is not a helper transcript when no close of the ticket phase exists", async () => {
    const { mainFiles } = await load();
    const r = mainFiles(
      [call(0, "next --done plan"), call(1, "next --done ticket --plan docs/plans/b.md"), call(2, "next --done ticket --plan docs/plans/a.md", true)],
      PLAN,
    );
    expect([...r.files].sort()).toEqual([0, 1]);
    expect(r.fallback).toBe(true);
  });
});
