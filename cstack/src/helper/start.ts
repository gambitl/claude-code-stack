// WHY: ADR-SIC-A and ADR-SIC-F. no ticket title, plan text or report text reaches an Orca command line. The worker reads the plan file itself, from the path in its spec.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
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
import { runFolder } from "../run-state.js";
import { WriteShapeError } from "../tracker/errors.js";
import {
  createRecord,
  HELPER_EXIT_PENDING,
  HelperError,
  helperSpecPath,
  makeHelperId,
  type HelperRole,
} from "./record.js";
import { childName, currentBranch, headHash, ticketWorktreeProblems } from "./child.js";
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

async function fallback(role: HelperRole, inputs: HelperInputs, reason: string, runDir: string, deps: StartDeps, io: Io): Promise<number> {
  createRecord(runDir, {
    format: "cstack-helper/1",
    id: inputs.helperId,
    role,
    unit: inputs.unit ?? null,
    startedAt: deps.now().toISOString(),
    mode: "sub-agent",
    reason,
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

/** True when the first batch of `cstack unit order` holds only one unit. */
function firstBatchIsOneUnit(plan: ReturnType<typeof readPlan>, root: string): boolean {
  const order = orderOf(plan, root);
  return order.ok && order.order.batches[0]?.length === 1;
}

/** The checks before a new child worktree. They refuse with 1 and start nothing. */
function checkChildStart(plan: ReturnType<typeof readPlan>, unit: number, located: { root: string; relative: string }): void {
  const order = orderOf(plan, located.root);
  if (!order.ok) throw new HelperError(`The Depends on lines form a cycle: units ${order.cycle.join(", ")}.`, EXIT.refused);
  if (!order.order.batches[0]?.includes(unit)) {
    const reason =
      order.order.waits.find((w) => w.unit === unit)?.reason ??
      order.order.setAside.find((s) => s.unit === unit)?.reason ??
      (order.order.committed.includes(unit) ? "it already has a commit" : "it is not in a batch");
    throw new HelperError(`Unit ${unit} is not in the first batch of \`cstack unit order\`: ${reason}. A parallel start needs a unit of the first batch.`, EXIT.refused);
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
  let child = request.childWorktree === true && role === "implementer" && unit !== null;
  if (child) checkChildStart(plan, unit as number, located);
  const inputs = findInputs({
    role,
    helperId: makeHelperId(role, unit, deps.now()),
    repoRoot: located.root,
    planFile: located.path,
    packageRoot: deps.packageRoot,
    unit,
    ...(stuckReport !== undefined ? { stuckReport } : {}),
  });

  if (deps.env["CSTACK_ORCA_WORKERS"] === "off") {
    return fallback(role, inputs, "CSTACK_ORCA_WORKERS is off.", runDir, deps, io);
  }
  const feature = await orcaFeatures(deps.createRunner(FEATURE_TIMEOUT_MS), deps.env).get("workers");
  if (!feature.available) return fallback(role, inputs, feature.reason, runDir, deps, io);

  let note = "";
  let base = "";
  if (child) {
    const alone = firstBatchIsOneUnit(plan, located.root);
    const childFeature = await orcaFeatures(deps.createRunner(FEATURE_TIMEOUT_MS), deps.env).get("child-worktrees");
    if (alone) {
      child = false;
      note = "Unit " + unit + " is the only unit of the first batch, so it runs in the current worktree.";
    } else if (!childFeature.available) {
      child = false;
      note = `${childFeature.reason} The helper runs in the current worktree.`;
    } else {
      base = headHash(located.root);
      inputs.childWorktree = true;
    }
  }

  const specFile = helperSpecPath(runDir, inputs.helperId);
  mkdirSync(dirname(specFile), { recursive: true });
  writeFileSync(specFile, buildSpec(inputs));
  const title = unit === null ? role : `${role} unit ${unit}`;
  const result = await callOrca(deps.createRunner(START_TIMEOUT_MS), deps.env, [
    "orchestration", "worker-start",
    "--spec-file", specFile,
    "--agent", "claude",
    "--model", inputs.model,
    "--effort", inputs.effort,
    ...(child
      ? ["--worktree", "new-child", "--base-branch", base, "--name", childName(currentBranch(located.root) as string, unit as number, inputs.helperId), "--setup", "skip"]
      : ["--worktree", "current"]),
    "--task-title", title,
  ]);
  const answer = parseAnswer<Answer>(result);

  const refusal = clearRefusal(answer);
  if (refusal !== undefined) {
    if (/model/i.test(refusal.code) || /model/i.test(refusal.message)) {
      throw new HelperError(`Orca refused the model of this helper: ${refusal.message || refusal.code}`, EXIT.toolFailed);
    }
    return fallback(role, inputs, `Orca refused to start a worker: ${refusal.message || refusal.code}`, runDir, deps, io);
  }
  const dispatchId = (answer?.result as { dispatchId?: unknown } | undefined)?.dispatchId;
  if (result.kind === "ok" && answer?.ok === true && typeof dispatchId === "string") {
    createRecord(runDir, {
      format: "cstack-helper/1",
      id: inputs.helperId,
      role,
      unit,
      startedAt: deps.now().toISOString(),
      mode: "orca-worker",
      dispatchId,
    });
    io.stdout(`${inputs.helperId}\n${note === "" ? "" : `${note}\n`}Run \`cstack helper wait ${inputs.helperId}\` to wait for its report.\n`);
    return 0;
  }
  return unknownOutcome(result, answer, deps);
}
