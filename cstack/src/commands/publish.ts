import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan, type PlanRead } from "../plan/read.js";
import { pushBranch, PublishFailure, remoteBranchHead, updateBranch } from "../publish/branch.js";
import { createGithubPullRequest, detectForge, findGithubPullRequest } from "../publish/forge.js";
import { readPublishRecord, readTestMarker, removeTestMarker, writePublishRecord, writeTestMarker } from "../publish/record.js";
import { runProgram } from "../publish/program.js";
import { runFolder, type PublishRecord } from "../run-state.js";
import { readSettings, SettingsError } from "../settings.js";
import { lastLines, runTests, testScript } from "../test-run.js";
import { failWith } from "./errors.js";

export const PUBLISH_USAGE =
  "Usage: cstack publish [--timeout <minutes>] [--poll <seconds>] [--grace <seconds>] [--plan <file>]";

/** What `publish` needs from the outside. Tests give a fake `PATH`, a fake clock and a sleep that moves it. */
export interface PublishDeps {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export const defaultPublishDeps = (): PublishDeps => ({
  cwd: process.cwd(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
});

const summary = (record: PublishRecord, madeNow: number) =>
  `Pull request: ${record.pullRequest === "" ? "none yet" : record.pullRequest}\nPushes: ${record.pushes.length} in total, ${madeNow} by this run.\n`;

const WHOLE = /^\d+$/;

function readNumber(value: string | undefined, fallback: number, min: number, flag: string): number {
  if (value === undefined) return fallback;
  if (!WHOLE.test(value) || Number(value) < min) {
    throw new Error(`${flag} takes a whole number of at least ${min}, not "${value}"`);
  }
  return Number(value);
}

/** Every broken rule that stops the command before any push. The list is empty when the plan can be published. */
function brokenRules(root: string, plan: PlanRead, deps: PublishDeps): string[] {
  const git = (args: string[]) => runProgram("git", args, { cwd: root, env: deps.env });
  const problems: string[] = [];
  const branch = plan.header.Branch;
  const target = plan.header["Target branch"];

  for (const q of plan.blockingQuestions.filter((q) => q.open)) {
    problems.push(`Blocking question ${q.number} (${q.title}) is still open.`);
  }
  if (plan.header.Status !== "ready for review") {
    problems.push(`Status is \`${plan.header.Status}\`, not \`ready for review\`.`);
  }
  if (Number.isNaN(Date.parse(plan.header["Ready for review at"]))) {
    problems.push("`Ready for review at` does not hold a time.");
  }

  const changed = git(["status", "--porcelain=v1", "-z", "--untracked-files=no"]).stdout
    .split("\0")
    .filter((e) => e !== "")
    .map((e) => e.slice(3));
  if (changed.length > 0) {
    problems.push(`These tracked files have uncommitted changes, and they would not leave with the push: ${changed.join(", ")}.`);
  }

  if (!plan.pullRequest || plan.pullRequest.title.trim() === "" || plan.pullRequest.body.trim() === "") {
    problems.push("The `## Pull request` section needs a title and a body that is not empty.");
  }

  const current = git(["symbolic-ref", "--short", "-q", "HEAD"]);
  if (!current.ok) {
    problems.push(`HEAD is detached, but the plan names the branch ${branch}. Check out that branch.`);
  } else if (current.stdout.trim() !== branch) {
    problems.push(`The checked-out branch is ${current.stdout.trim()}, but the plan names the branch ${branch}.`);
  }

  for (const [label, name] of [["Branch", branch], ["Target branch", target]]) {
    if (name.startsWith("-") || !git(["check-ref-format", "--branch", name]).ok) {
      problems.push(`The ${label} line holds "${name}", which git does not accept as a branch name.`);
    }
  }
  if (branch === target) problems.push(`The Branch line and the Target branch line name the same branch, ${branch}.`);
  return problems;
}

export async function publish(args: string[], io: Io, deps: PublishDeps = defaultPublishDeps()): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        timeout: { type: "string" },
        poll: { type: "string" },
        grace: { type: "string" },
        plan: { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    });
    readNumber(parsed.values.timeout, 30, 1, "--timeout");
    readNumber(parsed.values.poll, 15, 1, "--poll");
    readNumber(parsed.values.grace, 120, 0, "--grace");
  } catch (error) {
    io.stderr(`cstack publish: ${error instanceof Error ? error.message : String(error)}\n${PUBLISH_USAGE}\n`);
    return 2;
  }

  try {
    const located = locatePlan(deps.cwd, parsed.values.plan);
    const plan = readPlan(readFileSync(located.path, "utf8"));
    const settings = readSettings(located.root).values;
    const problems = brokenRules(located.root, plan, deps);
    if (problems.length > 0) {
      io.stderr(`cstack publish: nothing was pushed, because ${problems.length} rule(s) are broken.\n${problems.map((p) => `- ${p}\n`).join("")}`);
      return 1;
    }
    const forge = detectForge(located.root, deps.env);
    if (!forge.ok) {
      io.stderr(`cstack publish: nothing was pushed.\n${forge.reasons.map((r) => `- ${r}\n`).join("")}`);
      return 4;
    }
    if (forge.kind !== "github") {
      io.stderr("cstack publish: the GitLab path is not built yet. Nothing was pushed.\n");
      return 5;
    }
    const options = { cwd: located.root, env: deps.env };
    const folder = runFolder(located.root, located.relative);
    const record = readPublishRecord(folder) ?? { pullRequest: "", pushes: [] };
    let madeNow = 0;
    try {
      const branch = plan.header.Branch;
      const updated = remoteBranchHead(branch, options) === undefined && updateBranch(plan.header["Target branch"], settings.integration, options);
      if (updated || readTestMarker(folder) !== undefined) {
        if (settings.testCommands === undefined) {
          io.stdout("The tests did not run because .cstack/settings.json has no testCommands.\n");
          removeTestMarker(folder);
        } else {
          const tests = await runTests(located.root, testScript(settings.testCommands), undefined);
          if (tests.exitCode !== 0) {
            const commit = runProgram("git", ["rev-parse", "--verify", "HEAD"], options).stdout.trim();
            writeTestMarker(folder, { commit, time: new Date(deps.now()).toISOString() });
            const why = tests.timedOut ? "The tests timed out." : "The tests failed.";
            io.stderr(
              `cstack publish: ${why} Nothing was pushed. The branch now holds the update, and the next run will test again.\n${lastLines(tests.output)}\n${summary(record, madeNow)}`,
            );
            return 1;
          }
          removeTestMarker(folder);
        }
      }
      const pushed = pushBranch(plan.header.Branch, options);
      if (pushed !== undefined) {
        record.pushes.push({ commit: pushed, time: new Date(deps.now()).toISOString() });
        writePublishRecord(folder, record);
        madeNow += 1;
      }
      const found = findGithubPullRequest(forge, plan.header.Branch, options);
      record.pullRequest =
        found ??
        createGithubPullRequest(
          forge,
          { branch: plan.header.Branch, target: plan.header["Target branch"], title: plan.pullRequest!.title, body: plan.pullRequest!.body },
          options,
        );
      writePublishRecord(folder, record);
    } catch (error) {
      if (!(error instanceof PublishFailure)) throw error;
      io.stderr(`cstack publish: ${error.message}\n${summary(record, madeNow)}`);
      return error.exitCode;
    }
    io.stdout(`${record.pullRequest}\n${summary(record, madeNow)}`);
    return 0;
  } catch (error) {
    if (error instanceof SettingsError) {
      io.stderr(`cstack publish: ${error.message}\n`);
      return 3;
    }
    return failWith(error, io, "cstack publish: ");
  }
}
