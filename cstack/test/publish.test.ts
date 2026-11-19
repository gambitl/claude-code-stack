import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publish } from "../src/commands/publish.js";
import { PLAN_PATH, makePublishEnv, type PublishEnv } from "./helpers/publish-env.js";
import { collect, commitPlan, git } from "./helpers/plan-repo.js";

async function run(env: PublishEnv, args: string[] = []) {
  const { out, io } = collect();
  const code = await publish(["--plan", PLAN_PATH, ...args], io, env.deps);
  return { code, out };
}

const refused = (env: PublishEnv) => {
  expect(env.pushes()).toEqual([]);
  expect(env.calls().filter((c) => c.program !== "ssh")).toEqual([]);
};

describe("cstack publish refusals before any push", () => {
  it("refuses a plan whose blocking question is open, and names the question", async () => {
    const env = makePublishEnv({
      plan: (t) =>
        t.replace("## Blocking questions\n\nnone", "## Blocking questions\n\n### Question 1: Which flag\nLong?\n- For: the maintainer\n- Answer: open"),
    });
    const { code, out } = await run(env);
    expect(code).toBe(1);
    expect(out.stderr).toContain("Blocking question 1 (Which flag)");
    expect(env.pushes()).toEqual([]);
  });

  it("refuses a plan whose Status is not ready for review", async () => {
    const env = makePublishEnv({ plan: (t) => t.replace("Status: ready for review", "Status: review") });
    const { code, out } = await run(env);
    expect(code).toBe(1);
    expect(out.stderr).toContain("Status is `review`");
    expect(env.pushes()).toEqual([]);
  });

  it("lists every broken rule in one message", async () => {
    const env = makePublishEnv({
      plan: (t) =>
        t
          .replace("Branch: gambitl/units", "Branch: other/branch")
          .replace("Some words.", "")
          .replace("```bash\n## not a heading of the plan\nnpm test\n```\n\n## Summary\n\nIt reads the plan.\n", ""),
    });
    writeFileSync(join(env.repo, "README.md"), "changed\n");
    const { code, out } = await run(env);
    expect(code).toBe(1);
    expect(out.stderr).toContain("README.md");
    expect(out.stderr).toContain("other/branch");
    expect(out.stderr).toMatch(/body/i);
    expect(env.pushes()).toEqual([]);
  });

  it("refuses when Branch equals Target branch", async () => {
    const env = makePublishEnv({ plan: (t) => t.replace("Target branch: main", "Target branch: gambitl/units") });
    const { code, out } = await run(env);
    expect(code).toBe(1);
    expect(out.stderr).toContain("same branch");
    expect(env.pushes()).toEqual([]);
  });

  it("refuses a detached HEAD", async () => {
    const env = makePublishEnv();
    git(env.repo, "checkout", "--detach");
    const { code, out } = await run(env);
    expect(code).toBe(1);
    expect(out.stderr).toContain("detached");
  });

  it("does not touch a forge client before the rules pass", async () => {
    const env = makePublishEnv({ plan: (t) => t.replace("Status: ready for review", "Status: review") });
    await run(env);
    refused(env);
  });
});

describe("cstack publish input errors", () => {
  it("gives 3 for a broken settings file", async () => {
    const env = makePublishEnv();
    commitPlan(env.repo, "{", ".cstack/settings.json");
    const { code, out } = await run(env);
    expect(code).toBe(3);
    expect(out.stderr).toContain("settings.json");
  });

  it("gives 3 for a missing plan file", async () => {
    const env = makePublishEnv();
    const { out, io } = collect();
    expect(await publish(["--plan", "docs/plans/none.md"], io, env.deps)).toBe(3);
    expect(out.stderr).not.toBe("");
  });

  it.each([["--timeout", "0"], ["--poll", "abc"], ["--poll", "0"], ["--grace", "-1"], ["--timeout", "1.5"]])(
    "gives 2 for %s %s",
    async (flag, value) => {
      const env = makePublishEnv();
      const { code, out } = await run(env, [flag, value]);
      expect(code).toBe(2);
      expect(out.stderr).toContain("Usage: cstack publish");
    },
  );

  it("gives 2 for an unknown positional argument", async () => {
    const env = makePublishEnv();
    expect((await run(env, ["now"])).code).toBe(2);
  });
});
