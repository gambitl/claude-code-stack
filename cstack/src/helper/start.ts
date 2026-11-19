// WHY: ADR-SIC-A and ADR-SIC-F. no ticket title, plan text or report text reaches an Orca command line. The worker reads the plan file itself, from the path in its spec.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { parseAnswer } from "../orca/answer.js";
import { callOrca } from "../orca/call.js";
import { orcaFeatures } from "../orca/features.js";
import type { Runner, RunResult } from "../orca/run.js";
import { checkShape, ShapeError } from "../orca/shapes.js";
import { parseVersion } from "../orca/version.js";
import { listUnitCommits } from "../plan/commits.js";
import { locatePlan } from "../plan/locate.js";
import { orderUnits } from "../plan/order.js";
import { readPlan } from "../plan/read.js";
import { latestStuckReportPath } from "../report/reports.js";
import { setUnitWorktree } from "../plan/unit-line.js";
import { gitFolders, runFolder, writeCurrentRun, writeFileAtomic } from "../run-state.js";
import { withCommitLock } from "../commit-lock.js";
import { WriteShapeError } from "../tracker/errors.js";
import {
  createRecord,
  HELPER_EXIT_PENDING,
  HelperError,
  helperSpecPath,
  makeHelperId,
  type HelperRole,
} from "./record.js";
import { childName, currentBranch, findChildWorktree, headHash, latestUnitRecord, listWorktrees, ticketWorktreeProblems, type ListedWorktree } from "./child.js";
import { buildSpec, findInputs, type HelperInputs } from "./spec.js";

export interface StartDeps {
  cwd: string;
  env: Record<string, string | undefined>;
  packageRoot: string;
  createRunner: (timeoutMs: number) => Runner;
  now: () => Date;
}

export interface StartRequest {
  role: HelperRole;
  unit: number | null;
  plan: string | undefined;
  childWorktree?: boolean;
}

const START_COMMAND = "orca orchestration worker-start --json";
const START_TIMEOUT_MS = 240_000;
const FEATURE_TIMEOUT_MS = 30_000;

const CHECK_WORKERS =
  "cstack cannot tell whether Orca started a worker. Check `orca orchestration worker-list` in Orca before you start this helper again.";

/** The fields of an Orca answer that cstack looks at. */
interface Answer {
  ok?: unknown;
  result?: unknown;
  error?: Record<string, unknown>;
  [key: string]: unknown;
}

const STAGE_FIELDS = ["failedStage", "stage", "effects", "residualResources"];

/** A clear refusal proves that no worker started. */
function clearRefusal(answer: Answer | undefined): { code: string; message: string } | undefined {
  if (answer === undefined || answer.ok !== false || "result" in answer) return undefined;
  const error = answer.error;
  if (typeof error !== "object" || error === null || typeof error["code"] !== "string") return undefined;
  if (STAGE_FIELDS.some((field) => field in answer || field in error)) return undefined;
  return { code: error["code"], message: typeof error["message"] === "string" ? error["message"] : "" };
}

async function fallback(
  role: HelperRole,
  inputs: HelperInputs,
  reason: string,
  runDir: string,
  deps: StartDeps,
  io: Io,
  worktree?: { path: string; branch: string },
): Promise<number> {
  createRecord(runDir, {
    format: "cstack-helper/1",
    id: inputs.helperId,
    role,
    unit: inputs.unit ?? null,
    startedAt: deps.now().toISOString(),
    mode: "sub-agent",
    reason,
    ...(worktree !== undefined ? { worktree } : {}),
  });
  const lines = [
    `${reason} Start a sub-agent instead.`,
    `Sub-agent: resolve-issue:${role}`,
    `- Repository root: ${inputs.repoRoot}`,
    `- Plan file: ${inputs.planFile}`,
    `- Conventions file: ${inputs.conventionsFile}`,
    ...(inputs.writingGuide ? [`- Writing guide: ${inputs.writingGuide}`] : []),
    ...(inputs.unit !== undefined ? [`- Unit number: ${inputs.unit}`] : []),
    ...(inputs.stuckReport ? [`- Stuck report: ${inputs.stuckReport}`] : []),
    `Helper id: ${inputs.helperId}`,
  ];
  io.stdout(`${lines.join("\n")}\n`);
  return HELPER_EXIT_PENDING;
}

async function unknownOutcome(result: RunResult, answer: Answer | undefined, deps: StartDeps): Promise<never> {
  const message = typeof answer?.error?.["message"] === "string" ? ` Orca said: ${answer.error["message"]}` : "";
  if (result.kind === "ok" && answer?.ok === true) {
    // ok: true without a Dispatch id. The shape check names the missing field and the Orca version.
    const version = await callOrca(deps.createRunner(FEATURE_TIMEOUT_MS), deps.env, ["--version"]);
    const found = (version.kind === "ok" && parseVersion(version.stdout)) || "unknown";
    try {
      checkShape(START_COMMAND, answer, found, "read");
    } catch (error) {
      if (error instanceof ShapeError) throw new WriteShapeError(`${error.message} ${CHECK_WORKERS}`);
      throw error;
    }
  }
  throw new HelperError(`${CHECK_WORKERS}${message}`, EXIT.toolFailed);
}

function orderOf(plan: ReturnType<typeof readPlan>, root: string) {
  const commits = listUnitCommits(root, plan.header["Target branch"]);
  return orderUnits(plan.units, new Set(Object.keys(commits.units).map(Number)));
}

/** The other units of the plan that still run in a child worktree: their latest helper record has a worktree and no `collectedAt`. */
function runningUnits(plan: ReturnType<typeof readPlan>, runDir: string, except: number): ReturnType<typeof readPlan>["units"] {
  return plan.units.filter((u) => {
    if (u.number === except) return false;
    const record = latestUnitRecord(runDir, u.number);
    return record?.worktree !== undefined && record.collectedAt === undefined;
  });
}

/** True when the first batch of `cstack unit order` holds only one unit. */
function firstBatchIsOneUnit(plan: ReturnType<typeof readPlan>, root: string): boolean {
  const order = orderOf(plan, root);
  return order.ok && order.order.batches[0]?.length === 1;
}

/** The checks before a new child worktree. They refuse with 1 and start nothing. */
function checkChildStart(plan: ReturnType<typeof readPlan>, unit: number, located: { root: string; relative: string }, running: ReturnType<typeof readPlan>["units"]): void {
  const order = orderOf(plan, located.root);
  if (!order.ok) throw new HelperError(`The Depends on lines form a cycle: units ${order.cycle.join(", ")}.`, EXIT.refused);
  if (!order.order.batches[0]?.includes(unit)) {
    const reason =
      order.order.waits.find((w) => w.unit === unit)?.reason ??
      order.order.setAside.find((s) => s.unit === unit)?.reason ??
      (order.order.committed.includes(unit) ? "it already has a commit" : "it is not in a batch");
    throw new HelperError(`Unit ${unit} is not in the first batch of \`cstack unit order\`: ${reason}. A parallel start needs a unit of the first batch.`, EXIT.refused);
  }
  const mine = new Set((plan.units.find((u) => u.number === unit)?.files ?? []).map((f) => f.toLowerCase()));
  for (const other of running) {
    const shared = other.files.filter((f) => mine.has(f.toLowerCase()));
    if (shared.length > 0) {
      throw new HelperError(`Unit ${unit} shares ${shared.map((f) => `\`${f}\``).join(", ")} with unit ${other.number}, which still runs in a child worktree. Collect unit ${other.number} first.`, EXIT.refused);
    }
  }
  const branch = currentBranch(located.root);
  if (branch !== plan.header["Branch"]) {
    throw new HelperError(`The ticket worktree is on ${branch ?? "no branch"}, and the plan names another branch. Check out the branch of the plan first.`, EXIT.refused);
  }
  const problems = ticketWorktreeProblems(located.root, located.relative);
  if (problems.length > 0) {
    throw new HelperError(`A child worktree starts from the last commit, so commit these first: ${problems.join(", ")}.`, EXIT.refused);
  }
}

export async function startHelper(request: StartRequest, io: Io, deps: StartDeps): Promise<number> {
  const { role, unit } = request;
  const located = locatePlan(deps.cwd, request.plan);
  const plan = readPlan(readFileSync(located.path, "utf8"));
  const where = { root: located.root, planFile: located.relative };
  if (plan.header["Approved at"] === "not yet") {
    throw new HelperError("The plan is not approved yet (`Approved at` reads `not yet`). cstack starts no helper before it is approved.", EXIT.refused);
  }
  let stuckReport: string | undefined;
  if (unit !== null) {
    if (!plan.units.some((u) => u.number === unit)) {
      throw new HelperError(`The plan has no unit ${unit}.`, EXIT.usage);
    }
    if (role === "implementer-escalation") {
      stuckReport = latestStuckReportPath(where, unit);
      if (stuckReport === undefined) {
        throw new HelperError(`Unit ${unit} has no saved stuck report, so there is nothing to escalate.`, EXIT.refused);
      }
    }
  }
  const runDir = runFolder(located.root, located.relative);
  // A unit whose child worktree is not collected yet keeps it: only the escalation runs there again.
  let reuse: { path: string; branch: string } | undefined;
  const latest = unit !== null && role !== "executor" ? latestUnitRecord(runDir, unit) : undefined;
  if (latest?.worktree !== undefined && latest.collectedAt === undefined) {
    if (role === "implementer") {
      throw new HelperError(`Unit ${unit} still has its child worktree ${latest.worktree.path}. Run \`cstack unit collect ${unit}\` first.`, EXIT.refused);
    }
    if (!existsSync(latest.worktree.path)) {
      throw new HelperError(`The child worktree ${latest.worktree.path} of unit ${unit} no longer exists.`, EXIT.refused);
    }
    reuse = latest.worktree;
  }
  let child = request.childWorktree === true && role === "implementer" && unit !== null;
  const running = child ? runningUnits(plan, runDir, unit as number) : [];
  if (child) checkChildStart(plan, unit as number, located, running);
  const inputs = findInputs({
    role,
    helperId: makeHelperId(role, unit, deps.now()),
    repoRoot: located.root,
    planFile: located.path,
    packageRoot: deps.packageRoot,
    unit,
    ...(stuckReport !== undefined ? { stuckReport } : {}),
  });

  let fallbackInputs = inputs;
  if (reuse !== undefined) {
    const inChild = (path: string) => join(reuse.path, relative(located.root, path));
    copyFileSync(located.path, inChild(located.path));
    inputs.childWorktree = true;
    fallbackInputs = { ...inputs, repoRoot: reuse.path, planFile: inChild(inputs.planFile), conventionsFile: inChild(inputs.conventionsFile) };
  }

  if (deps.env["CSTACK_ORCA_WORKERS"] === "off") {
    return fallback(role, fallbackInputs, "CSTACK_ORCA_WORKERS is off.", runDir, deps, io, reuse);
  }
  const feature = await orcaFeatures(deps.createRunner(FEATURE_TIMEOUT_MS), deps.env).get("workers");
  if (!feature.available) return fallback(role, fallbackInputs, feature.reason, runDir, deps, io, reuse);

  let note = "";
  let base = "";
  let before: ListedWorktree[] = [];
  if (child) {
    const alone = running.length === 0 && firstBatchIsOneUnit(plan, located.root);
    const childFeature = await orcaFeatures(deps.createRunner(FEATURE_TIMEOUT_MS), deps.env).get("child-worktrees");
    if (alone) {
      child = false;
      note = "Unit " + unit + " is the only unit of the first batch, so it runs in the current worktree.";
    } else if (!childFeature.available) {
      child = false;
      note = `${childFeature.reason} The helper runs in the current worktree.`;
    } else {
      base = headHash(located.root);
      before = listWorktrees(located.root);
      inputs.childWorktree = true;
    }
  }

  const specFile = helperSpecPath(runDir, inputs.helperId);
  mkdirSync(dirname(specFile), { recursive: true });
  writeFileSync(specFile, buildSpec(inputs));
  const name = child ? childName(currentBranch(located.root) as string, unit as number, inputs.helperId) : "";
  const title = unit === null ? role : `${role} unit ${unit}`;
  const result = await callOrca(deps.createRunner(START_TIMEOUT_MS), deps.env, [
    "orchestration", "worker-start",
    "--spec-file", specFile,
    "--agent", "claude",
    "--model", inputs.model,
    "--effort", inputs.effort,
    ...(child
      ? ["--worktree", "new-child", "--base-branch", base, "--name", name, "--setup", "skip"]
      : ["--worktree", reuse !== undefined ? `path:${reuse.path}` : "current"]),
    "--task-title", title,
  ]);
  const answer = parseAnswer<Answer>(result);

  const refusal = clearRefusal(answer);
  if (refusal !== undefined) {
    if (/model/i.test(refusal.code) || /model/i.test(refusal.message)) {
      throw new HelperError(`Orca refused the model of this helper: ${refusal.message || refusal.code}`, EXIT.toolFailed);
    }
    return fallback(role, fallbackInputs, `Orca refused to start a worker: ${refusal.message || refusal.code}`, runDir, deps, io, reuse);
  }
  const dispatchId = (answer?.result as { dispatchId?: unknown } | undefined)?.dispatchId;
  if (result.kind === "ok" && answer?.ok === true && typeof dispatchId === "string") {
    const found = child ? findChildWorktree(located.root, before, (answer.result as { workspace?: unknown }).workspace, name) : undefined;
    createRecord(runDir, {
      format: "cstack-helper/1",
      id: inputs.helperId,
      role,
      unit,
      startedAt: deps.now().toISOString(),
      mode: "orca-worker",
      dispatchId,
      ...(found !== undefined || reuse !== undefined ? { worktree: found ?? reuse } : {}),
    });
    if (child && found === undefined) {
      throw new HelperError(`The worker ${inputs.helperId} runs, but cstack found no child worktree for it, so none is on record. Check \`git worktree list\`.`, EXIT.toolFailed);
    }
    if (found !== undefined) {
      writeCurrentRun(found.path, located.relative);
      const lockPath = join(gitFolders(located.root).gitDir, "cstack", "plan-file.lock");
      const locked = await withCommitLock(lockPath, unit as number, 60_000, () =>
        writeFileAtomic(located.path, setUnitWorktree(readFileSync(located.path, "utf8"), unit as number, found.path)),
      );
      if (!locked.ok) throw new HelperError(`cstack could not write the Worktree line of unit ${unit} into the plan file: ${locked.message}.`, EXIT.toolFailed);
    }
    io.stdout(`${inputs.helperId}\n${note === "" ? "" : `${note}\n`}Run \`cstack helper wait ${inputs.helperId}\` to wait for its report.\n`);
    return 0;
  }
  return unknownOutcome(result, answer, deps);
}
