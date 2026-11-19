import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readPlan } from "../src/plan/read.js";
import { runFolder } from "../src/run-state.js";
import { detectForge } from "../src/publish/forge.js";
import { publish } from "../src/commands/publish.js";
import { PLAN_PATH, makePublishEnv, type Answer, type PublishEnv } from "./helpers/publish-env.js";
import { collect, commitFiles, commitPlan, git } from "./helpers/plan-repo.js";

// Every fake gh, glab and git call starts a process, so a full run needs more than the default 5 seconds.
vi.setConfig({ testTimeout: 30_000 });

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

  it("names both full file names of a staged rename", async () => {
    const env = makePublishEnv();
    commitFiles(env.repo, ["original-name.txt"]);
    git(env.repo, "mv", "original-name.txt", "renamed-name.txt");
    const { code, out } = await run(env);
    expect(code).toBe(1);
    expect(out.stderr).toContain("renamed-name.txt");
    expect(out.stderr).toContain("original-name.txt");
    expect(env.pushes()).toEqual([]);
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

  it("keeps the port of an https remote for glab -R, but not for gh --repo, and not for auth status", () => {
    const glab = makePublishEnv();
    setRemote(glab, "https://gitlab.example.org:8443/group/r.git");
    glab.scenario({ "gh auth status": { code: 1 }, "glab auth status": { code: 0 } });
    expect(detectForge(glab.repo, glab.deps.env)).toEqual({
      ok: true,
      kind: "gitlab",
      host: "gitlab.example.org",
      repoArg: "https://gitlab.example.org:8443/group/r",
    });
    expect(glab.calls().every((c) => c.args.join(" ") === "auth status --hostname gitlab.example.org")).toBe(true);

    const gh = makePublishEnv();
    setRemote(gh, "https://ghe.example.org:8443/o/r.git");
    expect(detectForge(gh.repo, gh.deps.env)).toEqual({ ok: true, kind: "github", host: "ghe.example.org", repoArg: "ghe.example.org/o/r" });
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

  it("hides the credentials of a URL in the printed test output", async () => {
    const env = makePublishEnv();
    env.scenario(scenario);
    settings(env, { testCommands: { all: "echo https://user:tok-secret@example.org/x; exit 1" } });
    moveMain(env);
    const { out } = await run(env, ["--grace", "0"]);
    expect(out.stderr).toContain("https://example.org/x");
    expect(out.stderr).not.toContain("tok-secret");
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

describe("cstack publish waits for the checks of the pushed commit on GitHub", () => {
  const LINK = "https://github.com/o/r/pull/7";
  const head = (env: PublishEnv) => git(env.repo, "rev-parse", "HEAD");
  const record = (env: PublishEnv) =>
    JSON.parse(readFileSync(join(runFolder(env.repo, PLAN_PATH), "publish.json"), "utf8"));
  const view = (oid: string) => ({ stdout: JSON.stringify({ headRefOid: oid }) });
  const check = (name: string, bucket: string) => ({ name, state: bucket.toUpperCase(), bucket, link: `https://ci.example/${name}` });
  const checks = (...list: ReturnType<typeof check>[]) => ({ stdout: JSON.stringify(list), code: list.some((c) => c.bucket === "pending") ? 8 : 0 });
  const base = { "gh pr create": { stdout: `${LINK}\n` } };
  const SECOND = 1000;

  it("waits for the pushed commit, never reports the old failure, and exits with 0", async () => {
    const env = makePublishEnv();
    const first = (await import("node:child_process")).execFileSync("git", ["-C", env.repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    env.scenario({
      ...base,
      "gh pr view": [view("0".repeat(40)), view(first)],
      "gh pr checks": checks(check("build", "pass")),
    });
    const { code, out } = await run(env, ["--grace", "0", "--poll", "20"]);
    expect(code).toBe(0);
    expect(out.stdout + out.stderr).not.toContain("old-failure");
    expect(env.calls().filter((c) => c.args.slice(0, 2).join(" ") === "pr checks")).toHaveLength(1);
    expect(record(env).checks).toMatch(/passed/);
    for (const c of env.calls().filter((c) => c.args.slice(0, 2).join(" ") === "pr view")) {
      expect(c.args).toEqual(expect.arrayContaining(["--repo", "github.com/o/r", "--json", "headRefOid"]));
    }
  });

  it("gives 6 with the name and link of a failed check", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": checks(check("lint", "fail"), check("build", "pass")) });
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(6);
    expect(out.stderr).toContain("lint");
    expect(out.stderr).toContain("https://ci.example/lint");
    expect(record(env).checks).toMatch(/failed/);
  });

  it("strips control characters from the names of the checks", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": checks(check("bad\u001b[31mname\u009b", "fail")) });
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(6);
    expect(out.stderr).toContain("bad[31mname");
    expect(out.stderr).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
  });

  it("gives 6 for a cancelled check", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": checks(check("deploy", "cancel")) });
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(6);
    expect(out.stderr).toContain("deploy");
  });

  it("gives 7 and names the checks that are still pending at the timeout", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": checks(check("slow", "pending"), check("build", "pass")) });
    const { code, out } = await run(env, ["--grace", "0", "--timeout", "1", "--poll", "20"]);
    expect(code).toBe(7);
    expect(out.stderr).toContain("slow");
    expect(out.stderr).not.toContain("build");
    expect(record(env).checks).toMatch(/timed out/);
  });

  it("gives 6 and names both when one check failed and one is pending at the timeout", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": checks(check("lint", "fail"), check("slow", "pending")) });
    const { code, out } = await run(env, ["--grace", "0", "--timeout", "1", "--poll", "20"]);
    expect(code).toBe(6);
    expect(out.stderr).toContain("lint");
    expect(out.stderr).toContain("slow");
  });

  it("says that no check ran, and exits with 0, when none appears within the grace period", async () => {
    const env = makePublishEnv();
    env.scenario(base);
    const start = env.clock.value;
    const { code, out } = await run(env, ["--grace", "30", "--poll", "10"]);
    expect(code).toBe(0);
    expect(out.stdout).toContain("no check ran");
    expect(out.stdout).not.toContain("merged results");
    expect(env.clock.value - start).toBeGreaterThanOrEqual(30 * SECOND);
    expect(record(env).checks).toMatch(/no check ran/);
  });

  it("does not end before the grace period, even when every check already passed", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": checks(check("build", "pass")) });
    const start = env.clock.value;
    const { code } = await run(env, ["--grace", "60", "--poll", "20"]);
    expect(code).toBe(0);
    expect(env.clock.value - start).toBeGreaterThanOrEqual(60 * SECOND);
  });

  it("waits exactly --poll seconds between two reads", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": [checks(check("build", "pending")), checks(check("build", "pass"))] });
    const start = env.clock.value;
    const { code } = await run(env, ["--grace", "0", "--poll", "20"]);
    expect(code).toBe(0);
    expect(env.clock.value - start).toBe(20 * SECOND);
  });

  it("gives 7 when the pull request never shows the pushed commit", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr view": view("0".repeat(40)) });
    const { code, out } = await run(env, ["--grace", "0", "--timeout", "1", "--poll", "20"]);
    expect(code).toBe(7);
    expect(out.stderr).toContain(head(env).slice(0, 7));
    expect(env.calls().filter((c) => c.args.slice(0, 2).join(" ") === "pr checks")).toHaveLength(0);
  });

  it("gives 5 when gh pr checks fails without JSON and without the no checks message", async () => {
    const env = makePublishEnv();
    env.scenario({ ...base, "gh pr checks": { stderr: "boom\n", code: 1 } });
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(5);
  });
});

describe("cstack publish on GitLab", () => {
  const HOST_URL = "https://gitlab.example.org/group/sub/r.git";
  const LINK = "https://gitlab.example.org/group/sub/r/-/merge_requests/12";
  const head = (env: PublishEnv) => git(env.repo, "rev-parse", "HEAD");
  const record = (env: PublishEnv) =>
    JSON.parse(readFileSync(join(runFolder(env.repo, PLAN_PATH), "publish.json"), "utf8"));
  const glabCalls = (env: PublishEnv, sub: string) =>
    env.calls().filter((c) => c.program === "glab" && c.args.slice(0, 2).join(" ") === sub);
  const pipeline = (sha: string, status: string, jobs: { name: string; status: string }[] = []) => ({
    stdout: JSON.stringify({ id: 5, sha, status, web_url: "https://gitlab.example.org/group/sub/r/-/pipelines/5", jobs }),
  });
  const SECOND = 1000;

  const scenarioOf = (_env: PublishEnv) => ({
    "gh auth status": { code: 1 },
    "glab auth status": { code: 0 },
    "glab mr create": { stdout: `Creating merge request\n${LINK}\n` },
  });

  function gitlabEnv(answers: Record<string, Answer | Answer[]> = {}) {
    const env = makePublishEnv();
    git(env.repo, "config", "remote.origin.url", HOST_URL);
    git(env.repo, "config", `url.${env.bare}.insteadOf`, HOST_URL);
    env.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr create": { stdout: `Creating merge request\n${LINK}\n` },
      ...answers,
    });
    return env;
  }

  it("creates the merge request with glab and passes the title and the body", async () => {
    const env = gitlabEnv();
    env.scenario({ ...scenarioOf(env), "glab ci get": pipeline(head(env), "success") });
    const { code } = await run(env, ["--grace", "0"]);
    const plan = readPlan(readFileSync(join(env.repo, PLAN_PATH), "utf8"));
    expect(code).toBe(0);
    expect(env.pushes()).toHaveLength(1);
    const create = glabCalls(env, "mr create");
    expect(create).toHaveLength(1);
    expect(create[0].args).toEqual(
      expect.arrayContaining(["--source-branch", "gambitl/units", "--target-branch", "main", `--title=${plan.pullRequest!.title}`, "--yes"]),
    );
    expect(env.bodies()).toEqual([plan.pullRequest!.body]);
    expect(record(env)).toMatchObject({ pullRequest: LINK });
    expect(env.calls().filter((c) => c.program === "gh" && c.args[0] !== "auth")).toEqual([]);
  });

  it("carries -R with the full URL on every repository call of glab", async () => {
    const env = gitlabEnv();
    env.scenario({ ...scenarioOf(env), "glab ci get": pipeline(head(env), "success") });
    await run(env, ["--grace", "0"]);
    const repoCalls = env.calls().filter((c) => c.program === "glab" && c.args[0] !== "auth");
    expect(repoCalls.length).toBeGreaterThanOrEqual(3);
    for (const c of repoCalls) expect(c.args).toEqual(expect.arrayContaining(["-R", "https://gitlab.example.org/group/sub/r"]));
    for (const c of env.calls().filter((c) => c.program === "glab" && c.args[0] === "auth")) {
      expect(c.args).toEqual(["auth", "status", "--hostname", "gitlab.example.org"]);
    }
  });

  it("reads the pipeline with --merge-request and never with --branch", async () => {
    const env = gitlabEnv();
    env.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr create": { stdout: `${LINK}\n` },
      "glab ci get": { stderr: "no pipeline found\n", code: 1 },
    });
    await run(env, ["--grace", "0"]);
    const ci = glabCalls(env, "ci get");
    expect(ci.length).toBeGreaterThan(0);
    expect(ci[0].args).toEqual(expect.arrayContaining(["--merge-request", "12", "--output", "json"]));
    expect(ci[0].args).not.toContain("--branch");
  });

  it("ignores the pipeline of an older commit, then gives 0 on success", async () => {
    const env = gitlabEnv();
    const sha = () => head(env);
    env.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr create": { stdout: `${LINK}\n` },
      "glab ci get": [pipeline("0".repeat(40), "failed", [{ name: "old-failure", status: "failed" }]), pipeline(sha(), "success")],
    });
    // The grace period starts with the wait on GitLab, so it must be long enough to see the second pipeline.
    const { code, out } = await run(env, ["--grace", "30", "--poll", "20"]);
    expect(code).toBe(0);
    expect(out.stdout + out.stderr).not.toContain("old-failure");
    expect(glabCalls(env, "ci get").length).toBeGreaterThanOrEqual(2);
    expect(record(env).checks).toMatch(/passed/);
  });

  it("gives 6 with the pipeline link and the names of the failed jobs", async () => {
    const env = gitlabEnv();
    env.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr create": { stdout: `${LINK}\n` },
      "glab ci get": pipeline(head(env), "failed", [
        { name: "unit", status: "failed" },
        { name: "lint", status: "success" },
        { name: "e2e", status: "failed" },
      ]),
    });
    const { code, out } = await run(env, ["--grace", "0"]);
    expect(code).toBe(6);
    expect(out.stderr).toContain("unit");
    expect(out.stderr).toContain("e2e");
    expect(out.stderr).not.toContain("lint");
    expect(out.stderr).toContain("https://gitlab.example.org/group/sub/r/-/pipelines/5");
  });

  it("gives 7 when the pipeline is still running at the timeout, and counts manual as running", async () => {
    for (const status of ["running", "manual"]) {
      const env = gitlabEnv();
      env.scenario({
        "gh auth status": { code: 1 },
        "glab auth status": { code: 0 },
        "glab mr create": { stdout: `${LINK}\n` },
        "glab ci get": pipeline(head(env), status),
      });
      const { code } = await run(env, ["--grace", "0", "--timeout", "1", "--poll", "20"]);
      expect(code).toBe(7);
    }
  });

  it("passes on skipped, and fails on canceled", async () => {
    const skipped = gitlabEnv();
    skipped.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr create": { stdout: `${LINK}\n` },
      "glab ci get": pipeline(head(skipped), "skipped"),
    });
    expect((await run(skipped, ["--grace", "0"])).code).toBe(0);
    const canceled = gitlabEnv();
    canceled.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr create": { stdout: `${LINK}\n` },
      "glab ci get": pipeline(head(canceled), "canceled"),
    });
    expect((await run(canceled, ["--grace", "0"])).code).toBe(6);
  });

  it("says that no check ran after the whole grace period without a pipeline", async () => {
    const env = gitlabEnv({ "glab ci get": { stderr: "No pipeline found for merge request\n", code: 1 } });
    const start = env.clock.value;
    const { code, out } = await run(env, ["--grace", "30", "--poll", "10"]);
    expect(code).toBe(0);
    expect(out.stdout).toContain("no check ran");
    expect(env.clock.value - start).toBeGreaterThanOrEqual(30 * SECOND);
    expect(out.stdout).toMatch(/does not recognise merged results pipelines/);
  });

  it("gives 5 when glab ci get fails for another reason", async () => {
    const env = gitlabEnv({ "glab ci get": { stderr: "boom\n", code: 1 } });
    expect((await run(env, ["--grace", "0"])).code).toBe(5);
  });

  it("reuses a merge request of this project and ignores one from a fork", async () => {
    const env = gitlabEnv();
    const fork = { web_url: "https://gitlab.example.org/fork/r/-/merge_requests/3", iid: 3, source_project_id: 9, target_project_id: 1 };
    const mine = { web_url: LINK, iid: 12, source_project_id: 1, target_project_id: 1 };
    env.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr list": { stdout: JSON.stringify([fork, mine]) },
      "glab ci get": pipeline(head(env), "success"),
    });
    const { code } = await run(env, ["--grace", "0"]);
    expect(code).toBe(0);
    expect(glabCalls(env, "mr create")).toHaveLength(0);
    expect(glabCalls(env, "mr list")[0].args).toEqual(expect.arrayContaining(["--source-branch", "gambitl/units", "--output", "json"]));
    expect(glabCalls(env, "ci get")[0].args).toEqual(expect.arrayContaining(["--merge-request", "12"]));

    const only = gitlabEnv();
    only.scenario({
      "gh auth status": { code: 1 },
      "glab auth status": { code: 0 },
      "glab mr list": { stdout: JSON.stringify([fork]) },
      "glab mr create": { stdout: `${LINK}\n` },
      "glab ci get": pipeline(head(only), "success"),
    });
    await run(only, ["--grace", "0"]);
    expect(glabCalls(only, "mr create")).toHaveLength(1);
  });

  it("gives 4 when neither client is logged in", async () => {
    const env = gitlabEnv({ "glab auth status": { code: 1 } });
    const { code } = await run(env);
    expect(code).toBe(4);
    expect(env.pushes()).toEqual([]);
  });
});
