// The whole resolve-issue skill, run as Claude would run it: every command is the built cstack in a child process,
// the remote is a bare repository and gh is a fake. Nothing here needs Claude, the network or the real home folder.
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readPlan } from "../../src/plan/read.js";
import { writeFakePrograms } from "../helpers/publish-env.js";

const CSTACK = join(import.meta.dirname, "..", "..");
const FIXTURES = join(import.meta.dirname, "..", "fixtures", "e2e");
const GUIDES = join(CSTACK, "guides", "resolve-issue");
const PLAN = "docs/plans/e2e-math.md";
const BRANCH = "feature/multiply-divide";
const REMOTE_URL = "https://github.com/o/r.git";
const LINK = "https://github.com/o/r/pull/1";
const SETTINGS = ".cstack/settings.json";
const PHASE_COUNT = 15;
// Flags that a guide does not name but the test needs. The fake gh reports its checks at once, so no grace period is needed.
const EXTRA_FLAGS = [["--grace", "0"]];

const read = (...parts: string[]) => readFileSync(join(...parts), "utf8");
const SKILL = read(CSTACK, "skills", "resolve-issue", "SKILL.md");
const IMPLEMENTER = read(CSTACK, "skills", "resolve-issue", "agents", "implementer.md");
const EXECUTOR = read(CSTACK, "skills", "resolve-issue", "agents", "executor.md");
const READY_GUIDE = read(GUIDES, "ready.md");
const RETRO_GUIDE = read(GUIDES, "retro.md");
const PLAN_GUIDE = read(GUIDES, "plan.md");

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

let temp: string;
let bin: string;
let project: string;
let bare: string;
let fakes: string;
let home: string;
let env: NodeJS.ProcessEnv;
// The text of the guide that the last `cstack next` printed.
let lastGuide = "";

// The id that `cstack helper start` printed on its last line.
let helperId = "";

function startExecutor(): void {
  const started = follow(PLAN_GUIDE, ["helper", "start", "executor", "--plan", PLAN]);
  expect(started.code, started.stderr).toBe(6);
  expect(started.stdout).toContain("Sub-agent: resolve-issue:executor");
  helperId = started.stdout.trim().split("\n").pop()!.replace("Helper id: ", "");
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: project, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function run(args: string[], input?: string): Result {
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: project, env, input, encoding: "utf8", timeout: 60_000 });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** The command as a guide writes it: the plan path, the unit number and the section name become placeholders. */
function written(args: string[]): string {
  let words = [...args];
  for (const extra of EXTRA_FLAGS) {
    const at = words.findIndex((w, i) => w === extra[0] && words[i + 1] === extra[1]);
    if (at >= 0) words.splice(at, extra.length);
  }
  words = words.map((w) => (w === PLAN ? "<plan file>" : w));
  if (words[0] === "helper" && words[1] === "wait") words[2] = "<helper id>";
  const helperAt = words.indexOf("--helper");
  if (words[0] === "helper" && words[1] === "done" && helperAt >= 0) words[helperAt + 1] = "<helper id>";
  if (words[0] === "unit" && ["red", "green", "commit"].includes(words[1])) words[2] = "<n>";
  if (words[0] === "plan" && words[1] === "section") words[2] = "<name>";
  return `cstack ${words.join(" ")}`;
}

/** Runs a cstack command after checking that the text it comes from names it. */
function follow(source: string, args: string[], input?: string): Result {
  expect(source, `no text names "${written(args)}"`).toContain(written(args));
  const result = run(args, input);
  if (args[0] === "next" && result.code === 0 && /^Run: /.test(result.stdout)) lastGuide = result.stdout;
  return result;
}

const guideNames = () => readdirSync(GUIDES).map((f) => f.slice(0, -3));

/** US-6: the output is the run line, the settings block and the text of exactly one real guide. */
function expectGuide(result: Result, name: string): void {
  expect(result.stderr).toBe("");
  expect(result.code).toBe(0);
  const guide = read(GUIDES, `${name}.md`);
  expect(result.stdout.endsWith(guide)).toBe(true);
  const head = result.stdout.slice(0, -guide.length);
  expect(head).toMatch(
    new RegExp(`^Run: .*\\. Phase \\d+ of ${PHASE_COUNT}: ${name}, in the (main conversation|executor)\\.\\nSettings of this repository \\(\\.cstack/settings\\.json\\):\\n(- .*\\n)+\\n$`),
  );
  for (const other of guideNames().filter((n) => n !== name)) {
    expect(result.stdout, `the guide ${other} must not be printed`).not.toContain(read(GUIDES, `${other}.md`));
  }
}

function fill(section: string, file: string): void {
  const path = join(project, PLAN);
  const pattern = new RegExp(`(^## ${section}\\n\\n)<!--[^\\n]*-->\\n`, "m");
  const text = readFileSync(path, "utf8");
  expect(text, `section ${section} is not a placeholder`).toMatch(pattern);
  writeFileSync(path, text.replace(pattern, (_, head: string) => head + read(FIXTURES, "sections", file)));
}

function editPlan(from: string | RegExp, to: string): void {
  const path = join(project, PLAN);
  const text = readFileSync(path, "utf8");
  expect(text).toMatch(from);
  writeFileSync(path, text.replace(from, () => to));
}

const copyFromUnit = (unit: number, ...files: string[]) => {
  for (const file of files) cpSync(join(FIXTURES, "units", String(unit), file + (file.includes(".test.") ? ".fixture" : "")), join(project, file));
};

const pushes = () => {
  const log = join(temp, "pushes.log");
  return existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
};
const ghCalls = () =>
  (existsSync(join(fakes, "calls.log")) ? readFileSync(join(fakes, "calls.log"), "utf8") : "")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { program: string; args: string[] })
    .filter((c) => c.program === "gh");
const ghCall = (sub: string) => ghCalls().filter((c) => c.args.slice(0, 2).join(" ") === sub);

const UNIT_FILES: Record<number, string[]> = {
  1: ["src/math.js", "test/multiply.test.js"],
  2: ["src/math.js", "test/divide.test.js"],
  3: ["README.md"],
};
const UNIT_TEST: Record<number, string> = { 1: "test/multiply.test.js", 2: "test/divide.test.js" };
const TRAILER = "Cstack-Unit: ";
const ATTRIBUTION = "Assisted-by: cstack end-to-end test";

/** What an implementer does for one unit, with the commands of its prompt. */
function implement(unit: number): void {
  if (unit === 3) {
    copyFromUnit(3, "README.md");
  } else {
    copyFromUnit(unit, UNIT_TEST[unit]);
    if (unit === 1) {
      // US-8: a passing run is refused before a failing run is saved.
      const early = follow(IMPLEMENTER, ["unit", "green", "1", "--plan", PLAN]);
      expect(early.code).toBe(1);
      expect(early.stderr).toContain("no saved failing run");
    }
    const red = follow(IMPLEMENTER, ["unit", "red", String(unit), "--plan", PLAN]);
    expect(red.code, red.stderr).toBe(0);
    copyFromUnit(unit, "src/math.js");
    const green = follow(IMPLEMENTER, ["unit", "green", String(unit), "--plan", PLAN]);
    expect(green.code, green.stderr).toBe(0);
  }
  if (unit === 3) {
    // US-7: the done report is refused while unit 3 has no commit, and the message names it.
    startExecutor();
    const early = follow(READY_GUIDE, ["helper", "done", "done", "--helper", helperId, "--plan", PLAN], "A done report.\n");
    expect(early.code).toBe(1);
    expect(early.stderr).toContain("Unit 3 has no commit");
  }
  const commit = follow(IMPLEMENTER, ["unit", "commit", String(unit), "--plan", PLAN]);
  expect(commit.code, commit.stderr).toBe(0);

  // US-9: the commit holds the files of its unit only, then the trailer, then the attribution line.
  expect(git("show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual([...UNIT_FILES[unit]].sort());
  const message = git("log", "-1", "--format=%B").split("\n");
  expect(message.slice(-2)).toEqual([`${TRAILER}${unit}`, ATTRIBUTION]);
  expect(message.filter((l) => l.startsWith(TRAILER))).toHaveLength(1);
}

beforeAll(() => {
  temp = mkdtempSync(join(tmpdir(), "cstack-e2e-"));
  // The real cstack/dist is never used. The compiler writes into the temporary folder, next to links to the shipped files.
  execFileSync(join(CSTACK, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.build.json", "--outDir", join(temp, "dist")], { cwd: CSTACK });
  for (const name of ["guides", "skills", "package.json"]) symlinkSync(join(CSTACK, name), join(temp, name));
  bin = join(temp, "dist", "bin.js");

  home = join(temp, "home");
  // WHY: the fake programs are CommonJS. They must not sit under the link to package.json, which says "type": "module".
  fakes = mkdtempSync(join(tmpdir(), "cstack-e2e-fakes-"));
  bare = join(temp, "remote.git");
  project = join(temp, "project");
  for (const dir of [home, project]) mkdirSync(dir);
  writeFakePrograms(fakes);
  // The environment is built from scratch, so nothing of the test process (GIT_DIR, XDG_CONFIG_HOME and so on) reaches a child.
  env = {
    PATH: `${fakes}:${process.env.PATH ?? ""}`,
    HOME: home,
    TZ: "UTC",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ALLOW_PROTOCOL: "file",
    FAKE_BARE: bare,
    FAKE_BRANCH: BRANCH,
    // No Orca worker runs in this test, so `cstack helper start` falls back to a sub-agent and never reaches the real Orca.
    CSTACK_ORCA_WORKERS: "off",
    ORCA_CLI_COMMAND: join(temp, "no-such-orca"),
  };

  execFileSync("git", ["init", "--bare", "-b", "main", bare], { env, stdio: "ignore" });
  // WHY: the test files of the fixtures end in .fixture, so that Vitest does not run them as tests of cstack.
  cpSync(join(FIXTURES, "project"), project, { recursive: true });
  for (const name of ["add", "subtract"]) renameSync(join(project, "test", `${name}.test.js.fixture`), join(project, "test", `${name}.test.js`));
  git("init", "-b", "main");
  git("config", "user.name", "e2e");
  git("config", "user.email", "e2e@example.com");
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", REMOTE_URL);
  git("config", `url.${bare}.insteadOf`, REMOTE_URL);
  git("add", ".");
  git("commit", "-m", "chore: start the project");
  git("push", "-u", "origin", "main");
  // The hook is written after main arrived, so the log holds only the pushes of the run.
  // WHY: a pre-receive hook runs before git accepts the push, so it logs a push attempt that git then refuses too.
  const hook = join(bare, "hooks", "pre-receive");
  writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do echo "$ref $new" >> "${join(temp, "pushes.log")}"; done\n`);
  chmodSync(hook, 0o755);
  writeFileSync(
    join(fakes, "scenario.json"),
    JSON.stringify({
      "gh pr create": { stdout: `Creating pull request\n${LINK}\n` },
      "gh pr checks": { stdout: JSON.stringify([{ name: "ci", state: "SUCCESS", bucket: "pass", link: "https://github.com/o/r/actions/runs/1" }]) },
    }),
  );
}, 180_000);

afterAll(() => {
  for (const dir of [temp, fakes]) if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("the resolve-issue skill, end to end", { timeout: 120_000 }, () => {
  it("stops the first cstack next on an unknown key of the settings, and prints no guide (US-10)", () => {
    const file = join(project, SETTINGS);
    const good = readFileSync(file, "utf8");
    writeFileSync(file, good.replace('"version": 1,', '"version": 1,\n  "reviewer": "claude",'));
    try {
      const result = follow(SKILL, ["next"]);
      expect(result.code).toBe(3);
      expect(result.stderr).toContain("reviewer");
      expect(result.stdout).toBe("");
    } finally {
      writeFileSync(file, good);
    }
    expect(git("status", "--porcelain")).toBe("");
  });

  it("prints the ticket guide with the settings above it, and shows the review agent claude (US-6, US-10)", () => {
    const result = follow(SKILL, ["next"]);
    expectGuide(result, "ticket");
    expect(result.stdout).toContain('- review: {"agent":"claude","model":"opus"} (default)');
    expect(result.stdout).toContain('- commitAttribution: ["Assisted-by: cstack end-to-end test"]\n');
  });

  it("goes through the planning phases, one guide each, and hands over to the executor (US-6)", () => {
    mkdirSync(join(project, "docs", "plans"), { recursive: true });
    cpSync(join(FIXTURES, "plan.md"), join(project, PLAN));

    expectGuide(follow(lastGuide, ["next", "--done", "ticket", "--plan", PLAN]), "dependencies");

    // The phase list is enforced: the briefing cannot start before the document phase is done.
    const early = run(["next", "--phase", "briefing"]);
    expect(early.code).toBe(1);
    expect(early.stderr).toContain("The phase document is not done.");
    expect(early.stdout).toBe("");

    // A plan file of another format is refused, and the current run stays as it was.
    const current = join(git("rev-parse", "--path-format=absolute", "--git-dir"), "cstack", "current-run");
    const before = readFileSync(current, "utf8");
    writeFileSync(join(project, "docs", "plans", "format2.md"), read(FIXTURES, "plan.md").replace("Format: cstack-plan/1", "Format: cstack-plan/2"));
    const other = run(["next", "--plan", "docs/plans/format2.md"]);
    rmSync(join(project, "docs", "plans", "format2.md"));
    expect(other.code).toBe(3);
    expect(other.stdout).toBe("");
    expect(readFileSync(current, "utf8")).toBe(before);

    fill("Dependencies", "dependencies.md");
    expectGuide(follow(lastGuide, ["next", "--done", "dependencies"]), "code-map");
    fill("Code mapping", "code-mapping.md");
    expectGuide(follow(lastGuide, ["next", "--done", "code-map"]), "questions");
    fill("Blocking questions", "blocking-questions.md");
    expectGuide(follow(lastGuide, ["next", "--done", "questions"]), "plan");

    editPlan("Status: draft", "Status: approved");
    const approved = follow(lastGuide, ["next", "--done", "plan"]);
    expect(approved.code, approved.stderr).toBe(0);
    expect(approved.stdout).toContain("runs in the executor");
    expect(readPlan(read(project, PLAN)).header["Approved at"]).not.toBe("not yet");
  });

  it("builds every unit with the commands of the build guide and the implementer prompt (US-7, US-8, US-9)", () => {
    expectGuide(follow(EXECUTOR, ["next", "--plan", PLAN]), "build");

    git("checkout", "-b", BRANCH);
    git("add", PLAN);
    git("commit", "-m", "docs: add the plan");

    const order = follow(lastGuide, ["unit", "order", "--plan", PLAN]);
    expect(order.code, order.stderr).toBe(0);
    const batches = [...order.stdout.matchAll(/^Batch \d+: units? (.*)$/gm)].map((m) => m[1].split(", ").map(Number));
    const batchOf = (n: number) => batches.findIndex((b) => b.includes(n));
    // US-9: units 1 and 2 share src/math.js, so they run one after the other.
    expect(batchOf(1)).toBeGreaterThanOrEqual(0);
    expect(batchOf(2)).toBeGreaterThanOrEqual(0);
    expect(batchOf(1)).not.toBe(batchOf(2));
    expect(batches.flat().sort()).toEqual([1, 2, 3]);

    const committed: number[] = [];
    for (const batch of batches) {
      for (const unit of batch) {
        implement(unit);
        committed.push(unit);
      }
      const status = follow(lastGuide, ["plan", "status", "--plan", PLAN]);
      expect(status.code, status.stderr).toBe(0);
      for (const n of [1, 2, 3]) {
        expect(status.stdout).toMatch(new RegExp(`^Unit ${n}: .*: ${committed.includes(n) ? "done \\(" : "not done"}`, "m"));
      }
    }
    // Unit 3 has no test, so it left no saved run.
    const runs = join(git("rev-parse", "--path-format=absolute", "--git-common-dir"), "cstack", "runs", "e2e-math", "units");
    expect(existsSync(join(runs, "3"))).toBe(false);
    expect(existsSync(join(runs, "1", "red.json"))).toBe(true);
    expect(existsSync(join(runs, "2", "red.json"))).toBe(true);
    expect(git("status", "--porcelain", "--untracked-files=no", "--", "src", "test", "README.md")).toBe("");
  });

  it("prints one section of the plan and nothing else (US-7)", () => {
    const result = follow(IMPLEMENTER, ["plan", "section", "Decisions", "--plan", PLAN]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toBe("## Decisions\n\n- The function divide throws a RangeError when the divisor is zero.\n");
  });

  it("goes through the executor phases to ready, then accepts the done report (US-6, US-7, US-9)", () => {
    expectGuide(follow(lastGuide, ["next", "--done", "build", "--plan", PLAN]), "review");
    fill("Review log", "review-log.md");
    expectGuide(follow(lastGuide, ["next", "--done", "review", "--plan", PLAN]), "independent-review");
    expectGuide(follow(lastGuide, ["next", "--done", "independent-review", "--plan", PLAN]), "update-branch");
    expectGuide(follow(lastGuide, ["next", "--done", "update-branch", "--plan", PLAN]), "document");
    fill("Documentation", "documentation.md");
    expectGuide(follow(lastGuide, ["next", "--done", "document", "--plan", PLAN]), "briefing");
    fill("Briefing", "briefing.md");
    expectGuide(follow(lastGuide, ["next", "--done", "briefing", "--plan", PLAN]), "after-build-questions");
    fill("Non-blocking questions", "non-blocking-questions.md");
    expectGuide(follow(lastGuide, ["next", "--done", "after-build-questions", "--plan", PLAN]), "ready");
    fill("Pull request", "pull-request.md");
    fill("Executor notes", "executor-notes.md");
    fill("Hand-off log", "executor-notes.md");
    const guide = lastGuide;
    const ready = follow(guide, ["next", "--done", "ready", "--plan", PLAN]);
    expect(ready.code, ready.stderr).toBe(0);
    expect(ready.stdout).toContain("runs in the main conversation");
    const plan = readPlan(read(project, PLAN));
    expect(plan.header.Status).toBe("ready for review");
    expect(plan.header["Ready for review at"]).not.toBe("not yet");

    git("add", PLAN);
    git("commit", "-m", "docs: mark the plan ready for review");

    // The executor was started at unit 3 of the build, so its helper id is still the one in use.
    // The guide that was printed last is the ready guide, and it names the report command.
    const submitted = follow(guide, ["helper", "done", "done", "--helper", helperId, "--plan", PLAN], "Two functions and a README section were added.\n");
    expect(submitted.code, submitted.stderr).toBe(0);
    const wrong = run(["report", "submit", "complete", "--plan", PLAN], "Finished.\n");
    expect(wrong.code).toBe(1);
    expect(wrong.stderr).toContain("complete");

    const checked = follow(PLAN_GUIDE, ["helper", "wait", helperId]);
    expect(checked.code, checked.stderr).toBe(0);
    expect(checked.stdout).toBe("done\nTwo functions and a README section were added.\n");
  });

  it("writes the retrospective, then refuses to publish while a blocking question is open (US-6, US-12)", () => {
    expectGuide(follow(read(GUIDES, "plan.md"), ["next"]), "retro");
    mkdirSync(join(project, "docs", "retros"), { recursive: true });
    cpSync(join(FIXTURES, "retro.md"), join(project, "docs", "retros", "2026-11-19-1.md"));
    git("add", "docs/retros/2026-11-19-1.md");
    git("commit", "-m", "docs: add the retrospective");

    const retro = follow(lastGuide, ["next", "--done", "retro", "--plan", PLAN]);
    expect(retro.code, retro.stderr).toBe(0);
    expect(retro.stdout).toContain("publish, runs in the executor");
    // The retro guide starts the executor again for the publish phase.
    const again = follow(RETRO_GUIDE, ["helper", "start", "executor", "--plan", PLAN]);
    expect(again.code, again.stderr).toBe(6);
    helperId = again.stdout.trim().split("\n").pop()!.replace("Helper id: ", "");
    expectGuide(follow(EXECUTOR, ["next", "--plan", PLAN]), "publish");

    // US-12: the answer is set back to open in the working tree, so nothing may leave the machine.
    const answer = /- Answer: Yes, throw a RangeError\. The maintainer, 2026-11-19\./;
    editPlan(answer, "- Answer: open");
    const refused = follow(lastGuide, ["publish", "--grace", "0", "--plan", PLAN]);
    git("checkout", "--", PLAN);
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("Blocking question 1 (Should divide refuse zero?) is still open.");
    expect(pushes()).toEqual([]);
    expect(ghCall("pr create")).toHaveLength(0);
  });

  it("publishes once, opens one pull request with the title of the plan and reads the checks of the pushed commit (US-12)", () => {
    const published = follow(lastGuide, ["publish", "--grace", "0", "--plan", PLAN]);
    expect(published.code, published.stderr).toBe(0);
    expect(published.stdout).toContain(LINK);

    const head = git("rev-parse", "HEAD");
    expect(pushes()).toEqual([`refs/heads/${BRANCH} ${head}`]);
    expect(git("--git-dir", bare, "rev-parse", `refs/heads/${BRANCH}`)).toBe(head);

    const title = readPlan(read(project, PLAN)).pullRequest!.title;
    const created = ghCall("pr create");
    expect(created).toHaveLength(1);
    expect(created[0].args).toContain(`--title=${title}`);

    // gh pr view answered with the head of the branch in the bare repository, which is the pushed commit, before any check was read.
    const order = ghCalls().map((c) => c.args.slice(0, 2).join(" "));
    expect(order.indexOf("pr view")).toBeGreaterThan(order.indexOf("pr create"));
    expect(order.indexOf("pr view")).toBeLessThan(order.indexOf("pr checks"));

    const done = follow(lastGuide, ["next", "--done", "publish", "--plan", PLAN]);
    expect(done.code, done.stderr).toBe(0);
    expect(done.stdout).toContain("The run is finished");
    const report = follow(lastGuide, ["helper", "done", "published", "--helper", helperId, "--plan", PLAN], `Pull request: ${LINK}\n`);
    expect(report.code, report.stderr).toBe(0);
    const waited = follow(PLAN_GUIDE, ["helper", "wait", helperId]);
    expect(waited.code, waited.stderr).toBe(0);
    expect(waited.stdout).toBe(`published\nPull request: ${LINK}\n`);
  });

  it("never touched the home folder", () => {
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });
});
