import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { locatePlan } from "../plan/locate.js";
import { readPlan, type PlanRead } from "../plan/read.js";
import { pushBranch, PublishFailure, remoteBranchHead, updateBranch } from "../publish/branch.js";
import { waitForChecks, type ChecksOutcome } from "../publish/checks.js";
import {
  createGithubPullRequest,
  createGitlabMergeRequest,
  detectForge,
  type ForgeKind,
  findGithubPullRequest,
  findGitlabMergeRequest,
  gitlabIid,
  readGithubChecks,
  readGithubHead,
  readGitlabChecks,
} from "../publish/forge.js";
import { readPublishRecord, readTestMarker, removeTestMarker, writePublishRecord, writeTestMarker } from "../publish/record.js";
import { homeFolderProblems } from "../publish/home-folder.js";
import { runProgram } from "../publish/program.js";
import { redact } from "../publish/remote.js";
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

const pushesLine = (record: PublishRecord, madeNow: number) =>
  `Pushes: ${record.pushes.length} in total, ${madeNow} by this run.\n`;

const summary = (record: PublishRecord, madeNow: number) =>
  `Pull request: ${record.pullRequest === "" ? "none yet" : record.pullRequest}\n${pushesLine(record, madeNow)}`;

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
  const git = (args: string[], maxBuffer?: number) => runProgram("git", args, { cwd: root, env: deps.env, maxBuffer });
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

  const entries = git(["status", "--porcelain=v1", "-z", "--untracked-files=no"]).stdout.split("\0").filter((e) => e !== "");
  const changed: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const path = entries[i].slice(3);
    // A rename or a copy is followed by one more entry, the original name, which has no status letters.
    if (/[RC]/.test(entries[i].slice(0, 2)) && i + 1 < entries.length) changed.push(`${path} (from ${entries[++i]})`);
    else changed.push(path);
  }
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

  const home = deps.env ? deps.env.HOME : homedir();
  problems.push(...homeFolderProblems(git, home, target));
  return problems;
}

// A check name comes from a forge and may hold terminal escape codes. C0 and C1 control characters are removed.
const plain = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");
const names = (list: { name: string }[]) => list.map((c) => plain(c.name)).join(", ");
const listChecks = (list: { name: string; link: string }[]) => list.map((c) => `  - ${plain(c.name)} ${plain(c.link)}`.trimEnd()).join("\n");

function describeOutcome(outcome: ChecksOutcome, pushed: string, kind: ForgeKind): { exitCode: number; message: string; record: string } {
  switch (outcome.kind) {
    case "passed":
      return { exitCode: 0, message: "All checks passed.", record: "passed" };
    case "none":
      return {
        exitCode: 0,
        message:
          "The checks are done: no check ran." +
          (kind === "gitlab" ? " cstack does not recognise merged results pipelines, which run on a temporary merge commit." : ""),
        record: "no check ran",
      };
    case "failed": {
      const running = outcome.running.length > 0 ? `\nThese checks were still running at the timeout:\n${listChecks(outcome.running)}` : "";
      return {
        exitCode: 6,
        message: `These checks failed:\n${listChecks(outcome.failed)}${running}`,
        record: `failed: ${names(outcome.failed)}`,
      };
    }
    case "timeout":
      return {
        exitCode: 7,
        message: `The timeout came while these checks were still running:\n${listChecks(outcome.running)}`,
        record: `timed out: ${names(outcome.running)}`,
      };
    case "stale":
      return {
        exitCode: 7,
        message: `The timeout came and the pull request never showed the pushed commit ${pushed.slice(0, 7)}.`,
        record: "timed out: the pull request never showed the pushed commit",
      };
  }
}

export async function publish(args: string[], io: Io, deps: PublishDeps = defaultPublishDeps()): Promise<number> {
  let parsed;
  let timeoutMinutes: number;
  let pollSeconds: number;
  let graceSeconds: number;
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
    timeoutMinutes = readNumber(parsed.values.timeout, 30, 1, "--timeout");
    pollSeconds = readNumber(parsed.values.poll, 15, 1, "--poll");
    graceSeconds = readNumber(parsed.values.grace, 120, 0, "--grace");
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
              `cstack publish: ${why} Nothing was pushed. The branch now holds the update, and the next run will test again.\n${redact(lastLines(tests.output))}\n${summary(record, madeNow)}`,
            );
            return 1;
          }
          removeTestMarker(folder);
        }
      }
      const pushed = pushBranch(plan.header.Branch, options);
      if (pushed !== undefined) {
        record.pushes.push({ commit: pushed, time: new Date(deps.now()).toISOString() });
        // The checks result belongs to the last push, so the result of the previous push no longer applies.
        delete record.checks;
        writePublishRecord(folder, record);
        madeNow += 1;
      }
      const github = forge.kind === "github";
      const found = github ? findGithubPullRequest(forge, plan.header.Branch, options) : findGitlabMergeRequest(forge, plan.header.Branch, options);
      const create = github ? createGithubPullRequest : createGitlabMergeRequest;
      record.pullRequest =
        found ??
        create(
          forge,
          { branch: plan.header.Branch, target: plan.header["Target branch"], title: plan.pullRequest!.title, body: plan.pullRequest!.body },
          options,
        );
      writePublishRecord(folder, record);

      const pushedCommit = runProgram("git", ["rev-parse", "--verify", "HEAD"], options).stdout.trim();
      const url = record.pullRequest;
      // On GitLab the pipeline carries its own commit, so the checks are empty until it shows the pushed one.
      const iid = github ? "" : gitlabIid(url);
      const outcome = await waitForChecks({
        read: () =>
          github
            ? { head: readGithubHead(forge, url, options), checks: () => readGithubChecks(forge, url, options) }
            : { head: pushedCommit, checks: () => readGitlabChecks(forge, iid, pushedCommit, options) },
        pushed: pushedCommit,
        timeoutMs: timeoutMinutes * 60_000,
        pollMs: pollSeconds * 1000,
        graceMs: graceSeconds * 1000,
        sleep: deps.sleep,
        now: deps.now,
      });
      const verdict = describeOutcome(outcome, pushedCommit, forge.kind);
      record.checks = verdict.record;
      writePublishRecord(folder, record);
      if (verdict.exitCode !== 0) {
        io.stderr(`cstack publish: ${verdict.message}\n${summary(record, madeNow)}`);
        return verdict.exitCode;
      }
      io.stdout(`${record.pullRequest}\n${verdict.message}\n${pushesLine(record, madeNow)}`);
      return 0;
    } catch (error) {
      if (!(error instanceof PublishFailure)) throw error;
      io.stderr(`cstack publish: ${error.message}\n${summary(record, madeNow)}`);
      return error.exitCode;
    }
  } catch (error) {
    if (error instanceof SettingsError) {
      io.stderr(`cstack publish: ${error.message}\n`);
      return 3;
    }
    return failWith(error, io, "cstack publish: ");
  }
}
