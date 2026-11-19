// WHY: no ticket title, plan text or report text reaches an Orca command line. The worker reads the plan file itself, from the path in its spec.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { callOrca } from "../orca/call.js";
import { orcaFeatures } from "../orca/features.js";
import type { Runner, RunResult } from "../orca/run.js";
import { checkShape, ShapeError } from "../orca/shapes.js";
import { parseVersion } from "../orca/version.js";
import { locatePlan } from "../plan/locate.js";
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

function parseAnswer(result: RunResult): Answer | undefined {
  const text = result.kind === "ok" || result.kind === "failed" ? result.stdout : undefined;
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Answer) : undefined;
  } catch {
    return undefined;
  }
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
    "--worktree", "current",
    "--task-title", title,
  ]);
  const answer = parseAnswer(result);

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
    io.stdout(`${inputs.helperId}\nRun \`cstack helper wait ${inputs.helperId}\` to wait for its report.\n`);
    return 0;
  }
  return unknownOutcome(result, answer, deps);
}
