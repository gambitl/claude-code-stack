import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commitPlan, git, makeRepo } from "./plan-repo.js";

const FIXTURE = join(import.meta.dirname, "..", "fixtures", "plans", "ready-for-review.md");

export const REMOTE_URL = "https://github.com/o/r.git";
export const PLAN_PATH = "docs/plans/ready.md";
export const BRANCH = "gambitl/units";

/** What a fake program answers. `stdout`, `stderr` and `code` are optional. */
export interface Answer {
  stdout?: string;
  stderr?: string;
  code?: number;
}

export interface Call {
  program: string;
  args: string[];
}

export interface PublishEnv {
  /** The fake home folder, inside the temporary base folder. */
  home: string;
  /** The working repository, on the feature branch. */
  repo: string;
  /** The bare repository that plays the remote. */
  bare: string;
  /** The answers the fake programs give. */
  scenario(answers: Record<string, Answer | Answer[]>): void;
  /** Every ref that the bare repository received after `main` was put there, as `<ref> <commit>`. */
  pushes(): string[];
  /** Every call to a fake program, in order. */
  calls(): Call[];
  /** The files that fake programs copied from `--body-file` and `--description-file`. */
  bodies(): string[];
  /** The arguments to pass to `publish`. */
  deps: { cwd: string; env: NodeJS.ProcessEnv; sleep: (ms: number) => Promise<void>; now: () => number };
  /** The fake clock, in milliseconds. */
  clock: { value: number };
}

const FAKE = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const dir = __dirname;
const program = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(path.join(dir, "calls.log"), JSON.stringify({ program, args }) + "\\n");
for (const flag of ["--body-file", "--description-file"]) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i + 1]) {
    const n = fs.readdirSync(dir).filter((f) => f.startsWith("body-")).length;
    fs.copyFileSync(args[i + 1], path.join(dir, "body-" + n));
  }
}
let scenario = {};
try { scenario = JSON.parse(fs.readFileSync(path.join(dir, "scenario.json"), "utf8")); } catch {}
const line = program + " " + args.join(" ");
const key = Object.keys(scenario).filter((k) => line === k || line.startsWith(k + " ")).sort((a, b) => b.length - a.length)[0];
let answer = key === undefined ? undefined : scenario[key];
if (Array.isArray(answer)) {
  // A list answers the first call with its first item, and so on. The last item repeats.
  const same = fs.readFileSync(path.join(dir, "calls.log"), "utf8").split("\\n").filter(Boolean).map((l) => JSON.parse(l))
    .filter((c) => { const t = c.program + " " + c.args.join(" "); return t === key || t.startsWith(key + " "); }).length;
  answer = answer[Math.min(same, answer.length) - 1];
}
if (answer === undefined) {
  const sub = program + " " + args.slice(0, 2).join(" ");
  if (sub === "gh auth status") answer = { code: 0 };
  else if (sub === "gh pr list" || sub === "glab mr list") answer = { stdout: "[]" };
  else if (sub === "gh pr view") {
    const head = execFileSync("git", ["--git-dir=" + process.env.FAKE_BARE, "rev-parse", "refs/heads/" + process.env.FAKE_BRANCH], { encoding: "utf8" }).trim();
    answer = { stdout: JSON.stringify({ headRefOid: head }) };
  } else if (sub === "gh pr checks") answer = { stderr: "no checks reported on the '" + process.env.FAKE_BRANCH + "' branch\\n", code: 1 };
  else answer = { stderr: program + ": no answer in the scenario for: " + line + "\\n", code: 1 };
}
process.stdout.write(answer.stdout || "");
process.stderr.write(answer.stderr || "");
process.exit(answer.code || 0);
`;

/** Writes the fake `gh`, `glab` and `ssh` into a folder. They log their calls and answer from `scenario.json`. */
export function writeFakePrograms(folder: string): void {
  for (const name of ["gh", "glab", "ssh"]) {
    writeFileSync(join(folder, name), FAKE);
    chmodSync(join(folder, name), 0o755);
  }
}

/** Options: `plan` replaces the text of the committed plan. */
export function makePublishEnv(options: { plan?: (text: string, home: string) => string } = {}): PublishEnv {
  const base = mkdtempSync(join(tmpdir(), "cstack-publish-"));
  const repo = makeRepo();
  const bare = join(base, "remote.git");
  const fakes = join(base, "fakes");
  const log = join(base, "pushes.log");
  mkdirSync(fakes);
  const home = join(base, "someone");
  mkdirSync(home);

  execFileSync("git", ["init", "--bare", "-b", "main", bare]);
  git(repo, "config", "user.name", "t");
  git(repo, "config", "user.email", "t@example.com");
  git(repo, "config", "commit.gpgsign", "false");
  git(repo, "remote", "add", "origin", REMOTE_URL);
  git(repo, "config", `url.${bare}.insteadOf`, REMOTE_URL);
  git(repo, "push", "origin", "main");
  git(repo, "fetch", "origin");
  // The hook is written after main arrived, so the log shows only the pushes of the test.
  const hook = join(bare, "hooks", "post-receive");
  writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do echo "$ref $new" >> "${log}"; done\n`);
  chmodSync(hook, 0o755);

  git(repo, "checkout", "-b", BRANCH);
  commitPlan(repo, options.plan ? options.plan(readFileSync(FIXTURE, "utf8"), home) : readFileSync(FIXTURE, "utf8"), PLAN_PATH);

  writeFakePrograms(fakes);
  const clock = { value: Date.parse("2026-11-19T12:00:00Z") };
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    PATH: `${fakes}:${process.env.PATH ?? ""}`,
    FAKE_BARE: bare,
    FAKE_BRANCH: BRANCH,
  };
  const lines = (file: string) => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : []);
  return {
    home,
    repo,
    bare,
    scenario: (answers) => writeFileSync(join(fakes, "scenario.json"), JSON.stringify(answers)),
    pushes: () => lines(log),
    calls: () => lines(join(fakes, "calls.log")).map((l) => JSON.parse(l) as Call),
    bodies: () =>
      readdirSync(fakes)
        .filter((f) => f.startsWith("body-"))
        .sort()
        .map((f) => readFileSync(join(fakes, f), "utf8")),
    deps: {
      cwd: repo,
      env,
      sleep: async (ms) => {
        clock.value += ms;
      },
      now: () => clock.value,
    },
    clock,
  };
}
