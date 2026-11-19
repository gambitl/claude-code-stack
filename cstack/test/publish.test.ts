import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPlan } from "../src/plan/read.js";
import { runFolder } from "../src/run-state.js";
import { detectForge } from "../src/publish/forge.js";
import { publish } from "../src/commands/publish.js";
import { PLAN_PATH, makePublishEnv, type PublishEnv } from "./helpers/publish-env.js";
import { collect, commitFiles, commitPlan, git } from "./helpers/plan-repo.js";

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

describe("cstack publish finds the forge", () => {
  const setRemote = (env: PublishEnv, url: string) => git(env.repo, "config", "remote.origin.url", url);

  it("gives 4 when gh is not logged in for github.com", async () => {
    const env = makePublishEnv();
    env.scenario({ "gh auth status": { code: 1 } });
    const { code, out } = await run(env);
    expect(code).toBe(4);
    expect(out.stderr).toContain("github.com");
    expect(out.stderr).toContain("gh");
    expect(env.pushes()).toEqual([]);
  });

  it("gives 4 for an unknown host, names both clients and hides the credentials", async () => {
    const env = makePublishEnv();
    setRemote(env, "https://user:secret-token@gitlab.example.org/group/r.git");
    env.scenario({ "gh auth status": { code: 1 }, "glab auth status": { code: 1 } });
    const { code, out } = await run(env);
    expect(code).toBe(4);
    expect(out.stderr).toContain("gitlab.example.org");
    expect(out.stderr).toContain("gh is not logged in");
    expect(out.stderr).toContain("glab is not logged in");
    expect(out.stderr).not.toContain("secret-token");
    expect(env.pushes()).toEqual([]);
  });

  it("gives 4 and names the remote when it is a local path", async () => {
    const env = makePublishEnv();
    setRemote(env, "/tmp/some-bare.git");
    const { code, out } = await run(env);
    expect(code).toBe(4);
    expect(out.stderr).toContain("/tmp/some-bare.git");
    expect(env.pushes()).toEqual([]);
  });

  it("asks ssh for the real host of an alias, and finds GitLab", () => {
    const env = makePublishEnv();
    setRemote(env, "git@work-alias:group/r.git");
    env.scenario({
      "gh auth status": { code: 1 },
      "glab auth status --hostname gitlab.example.org": { code: 0 },
      "glab auth status": { code: 1 },
      "ssh -G work-alias": { stdout: "user git\nhostname gitlab.example.org\n" },
    });
    expect(detectForge(env.repo, env.deps.env)).toEqual({
      ok: true,
      kind: "gitlab",
      host: "gitlab.example.org",
      repoArg: "https://gitlab.example.org/group/r",
    });
    expect(env.calls().some((c) => c.program === "ssh" && c.args.join(" ") === "-G work-alias")).toBe(true);
  });

  it("uses gh on github.com with the repository argument", () => {
    const env = makePublishEnv();
    expect(detectForge(env.repo, env.deps.env)).toEqual({ ok: true, kind: "github", host: "github.com", repoArg: "github.com/o/r" });
    expect(env.calls().map((c) => c.program)).toEqual(["gh"]);
  });
});

describe("cstack publish pushes once and opens the pull request on GitHub", () => {
  const LINK = "https://github.com/o/r/pull/7";
  const branchRef = "refs/heads/gambitl/units";
  const head = (env: PublishEnv) => git(env.repo, "rev-parse", "HEAD");
  const record = (env: PublishEnv) =>
    JSON.parse(readFileSync(join(runFolder(env.repo, PLAN_PATH), "publish.json"), "utf8"));
  const creates = (env: PublishEnv) => env.calls().filter((c) => c.program === "gh" && c.args.slice(0, 2).join(" ") === "pr create");
  const created = { "gh pr create": { stdout: `Creating pull request\n${LINK}\n` } };

  it("makes one push, creates the pull request once and records both", async () => {
    const env = makePublishEnv();
    env.scenario(created);
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(env.pushes()).toEqual([`${branchRef} ${head(env)}`]);
    const plan = readPlan(readFileSync(join(env.repo, PLAN_PATH), "utf8"));
    expect(creates(env)).toHaveLength(1);
    const args = creates(env)[0].args;
    expect(args).toEqual(expect.arrayContaining(["--base", "main", "--head", "gambitl/units", `--title=${plan.pullRequest!.title}`]));
    expect(env.bodies()).toEqual([plan.pullRequest!.body]);
    for (const c of env.calls().filter((c) => c.program === "gh" && c.args[0] === "pr")) {
      expect(c.args.join(" ")).toContain("--repo github.com/o/r");
    }
    expect(record(env)).toMatchObject({ pullRequest: LINK, pushes: [{ commit: head(env) }] });
    expect(out.stdout).toContain(LINK);
  });

  it("opens no second pull request after a new commit, and pushes once more", async () => {
    const env = makePublishEnv();
    env.scenario(created);
    await run(env, ["--grace", "0"]);
    commitFiles(env.repo, ["a.txt"]);
    env.scenario({ "gh pr list": { stdout: JSON.stringify([{ url: LINK, headRefOid: "x", isCrossRepository: false }]) } });
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(creates(env)).toHaveLength(1);
    expect(env.pushes()).toHaveLength(2);
    expect(record(env).pushes).toHaveLength(2);
    expect(record(env).pullRequest).toBe(LINK);
  });

  it("makes no push when nothing is new", async () => {
    const env = makePublishEnv();
    env.scenario(created);
    await run(env, ["--grace", "0"]);
    env.scenario({ "gh pr list": { stdout: JSON.stringify([{ url: LINK, headRefOid: "x", isCrossRepository: false }]) } });
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(env.pushes()).toHaveLength(1);
  });

  it("never forces a push when the remote branch has a commit that the local branch lacks", async () => {
    const env = makePublishEnv();
    env.scenario(created);
    git(env.repo, "checkout", "-q", "-b", "other", "main");
    commitFiles(env.repo, ["other.txt"]);
    git(env.repo, "push", "-q", "origin", `other:${branchRef}`);
    git(env.repo, "checkout", "-q", "gambitl/units");
    const before = env.pushes().length;
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(1);
    expect(out.stderr).toContain("never forces a push");
    expect(env.pushes()).toHaveLength(before);
    expect(creates(env)).toHaveLength(0);
  });

  it("passes a hostile title and a body with backticks byte for byte, and runs no shell", async () => {
    const env = makePublishEnv({
      plan: (t) => t.replace("Title: feat(cli): read the plan file", "Title: x $(touch pwned) `id`").replace("It reads the plan.", "Body `touch pwned2` $(touch pwned3)"),
    });
    env.scenario(created);
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(creates(env)[0].args).toContain("--title=x $(touch pwned) `id`");
    expect(env.bodies()[0]).toContain("Body `touch pwned2` $(touch pwned3)");
    for (const f of ["pwned", "pwned2", "pwned3"]) expect(existsSync(join(env.repo, f))).toBe(false);
  });

  it("never pushes a tag, even with push.followTags", async () => {
    const env = makePublishEnv();
    env.scenario(created);
    git(env.repo, "tag", "v9.9.9");
    git(env.repo, "config", "push.followTags", "true");
    await run(env, ["--grace", "0"]);
    expect(env.pushes()).toEqual([`${branchRef} ${head(env)}`]);
  });

  it("ignores a pull request from another repository", async () => {
    const env = makePublishEnv();
    env.scenario({ ...created, "gh pr list": { stdout: JSON.stringify([{ url: "https://github.com/o/r/pull/1", headRefOid: "x", isCrossRepository: true }]) } });
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(creates(env)).toHaveLength(1);
    expect(out.stdout).toContain(LINK);
  });

  it("gives 5 when the pull request cannot be created, and keeps the push on record", async () => {
    const env = makePublishEnv();
    env.scenario({ "gh pr create": { code: 1, stderr: "boom https://user:tok@github.com/x\n" } });
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(5);
    expect(out.stderr).toContain("boom");
    expect(out.stderr).not.toContain("tok@");
    expect(record(env)).toMatchObject({ pullRequest: "", pushes: [{ commit: head(env) }] });
  });
});

describe("cstack publish brings the branch up to date and runs the tests", () => {
  const LINK = "https://github.com/o/r/pull/7";
  const branchRef = "refs/heads/gambitl/units";
  const scenario = { "gh pr create": { stdout: `${LINK}\n` } };
  const head = (env: PublishEnv) => git(env.repo, "rev-parse", "HEAD");
  const branchPushes = (env: PublishEnv) => env.pushes().filter((p) => p.startsWith(branchRef));
  const marker = (env: PublishEnv) => join(runFolder(env.repo, PLAN_PATH), "publish-tests.json");
  const settings = (env: PublishEnv, value: object) => commitPlan(env.repo, JSON.stringify({ version: 1, ...value }), ".cstack/settings.json");
  /** Puts a new commit on main of the bare remote, then goes back to the feature branch. */
  const moveMain = (env: PublishEnv, file = "main.txt") => {
    git(env.repo, "checkout", "-q", "main");
    commitFiles(env.repo, [file]);
    git(env.repo, "push", "-q", "origin", "main");
    git(env.repo, "checkout", "-q", "gambitl/units");
  };
  const touching = { testCommands: { all: "touch tests-ran" } };

  it("rebases onto the moved target, runs the tests and pushes once", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    settings(env, touching);
    moveMain(env);
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(existsSync(join(env.repo, "tests-ran"))).toBe(true);
    expect(git(env.repo, "merge-base", "--is-ancestor", "origin/main", "HEAD")).toBe("");
    expect(git(env.repo, "rev-list", "--merges", "origin/main..HEAD")).toBe("");
    expect(branchPushes(env)).toEqual([`${branchRef} ${head(env)}`]);
  });

  it("adds a merge commit with the setting merge", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    settings(env, { ...touching, integration: "merge" });
    moveMain(env);
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(git(env.repo, "rev-list", "--merges", "origin/main..HEAD").split("\n")).toHaveLength(1);
    expect(existsSync(join(env.repo, "tests-ran"))).toBe(true);
    expect(branchPushes(env)).toHaveLength(1);
  });

  it("runs no test when the target did not move", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    settings(env, touching);
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(existsSync(join(env.repo, "tests-ran"))).toBe(false);
    expect(branchPushes(env)).toHaveLength(1);
  });

  for (const integration of ["rebase", "merge"]) {
    it(`gives 8 on a conflict with ${integration}, names the file and leaves the branch as it was`, async () => {
      const env = makePublishEnv();
      env.scenario(scenario);
      settings(env, { integration });
      commitFiles(env.repo, ["clash.txt"]);
      const before = head(env);
      moveMain(env, "clash.txt");
      const { code, out } = await run(env, ["--grace", "0"]);
      expect(code).toBe(8);
      expect(out.stderr).toContain("clash.txt");
      expect(head(env)).toBe(before);
      expect(existsSync(join(env.repo, ".git", "rebase-merge"))).toBe(false);
      expect(existsSync(join(env.repo, ".git", "MERGE_HEAD"))).toBe(false);
      expect(env.pushes().filter((p) => p.startsWith(branchRef))).toEqual([]);
    });
  }

  it("gives 1 with no push when the tests fail, and writes the marker", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    settings(env, { testCommands: { all: "echo boom-line; exit 1" } });
    moveMain(env);
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(1);
    expect(out.stderr).toContain("boom-line");
    expect(out.stderr).toContain("next run will test again");
    expect(branchPushes(env)).toEqual([]);
    expect(JSON.parse(readFileSync(marker(env), "utf8"))).toMatchObject({ commit: head(env) });
  });

  it("tests again on the next run, still pushes nothing, then pushes once after a fix", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    settings(env, { testCommands: { all: "test -f fixed.txt || { echo boom-line; exit 1; }" } });
    moveMain(env);
    await run(env, ["--grace", "0"]);
    const second = await run(env, ["--grace", "0"]);
    expect(second.code).toBe(1);
    expect(second.out.stderr).toContain("boom-line");
    expect(branchPushes(env)).toEqual([]);
    expect(existsSync(marker(env))).toBe(true);
    commitFiles(env.repo, ["fixed.txt"]);
    const third = await run(env, ["--grace", "0"]);
    expect(third.code).toBe(0);
    expect(existsSync(marker(env))).toBe(false);
    expect(branchPushes(env)).toHaveLength(1);
  });

  it("pushes anyway without testCommands, and says that the tests did not run", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    moveMain(env);
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(out.stdout + out.stderr).toContain("tests did not run because .cstack/settings.json has no testCommands");
    expect(branchPushes(env)).toHaveLength(1);
  });
});
