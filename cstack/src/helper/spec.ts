// WHY: the spec is the task text that an Orca worker receives. It is built from fixed text and paths only, never from the plan, the ticket or a report, so that text written by someone else can never become an instruction for the worker.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EXIT } from "../manifest.js";
import { HelperError, type HelperRole } from "./record.js";

export interface HelperInputs {
  role: HelperRole;
  helperId: string;
  repoRoot: string;
  planFile: string;
  conventionsFile: string;
  promptFile: string;
  model: string;
  effort: string;
  /** Only for the executor. */
  writingGuide?: string;
  /** Only for the implementer roles. */
  unit?: number;
  /** Only for the escalation. */
  stuckReport?: string;
}

export interface InputOptions {
  role: HelperRole;
  helperId: string;
  repoRoot: string;
  planFile: string;
  packageRoot: string;
  unit?: number | null;
  stuckReport?: string;
}

const CONVENTIONS = ["CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md"];
const VALUE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/;

function checkPath(path: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) {
    throw new HelperError("An input path holds a control character, such as a newline. cstack refuses it.", EXIT.invalidInput);
  }
  return path;
}

function headerValue(text: string, key: string, file: string): string {
  const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const line = header.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
  const value = line?.slice(key.length + 1).trim() ?? "";
  if (!VALUE.test(value)) {
    throw new HelperError(`The header of ${file} has no valid ${key}: line.`, EXIT.invalidInput);
  }
  return value;
}

/** Finds the files that a role needs and reads its model and effort. It refuses with exit code 3 when one is missing or unsafe. */
export function findInputs(options: InputOptions): HelperInputs {
  const { role, packageRoot } = options;
  const conventions = CONVENTIONS.find((name) => existsSync(join(options.repoRoot, name)));
  if (conventions === undefined) {
    throw new HelperError(`The repository root has none of ${CONVENTIONS.join(", ")}.`, EXIT.invalidInput);
  }
  const promptFile = join(packageRoot, "skills", "resolve-issue", "agents", `${role}.md`);
  let prompt: string;
  try {
    prompt = readFileSync(promptFile, "utf8");
  } catch {
    throw new HelperError(`The prompt file ${promptFile} cannot be read.`, EXIT.invalidInput);
  }
  const inputs: HelperInputs = {
    role,
    helperId: checkPath(options.helperId),
    repoRoot: checkPath(options.repoRoot),
    planFile: checkPath(options.planFile),
    conventionsFile: checkPath(join(options.repoRoot, conventions)),
    promptFile: checkPath(promptFile),
    model: headerValue(prompt, "model", promptFile),
    effort: headerValue(prompt, "effort", promptFile),
  };
  if (role === "executor") inputs.writingGuide = checkPath(join(packageRoot, "skills", "resolve-issue", "writing.md"));
  else if (options.unit != null) inputs.unit = options.unit;
  if (role === "implementer-escalation" && options.stuckReport !== undefined) inputs.stuckReport = checkPath(options.stuckReport);
  return inputs;
}

const KINDS: Record<HelperRole, string> = {
  executor: "done, published, needs-decision or failed",
  implementer: "done or stuck",
  "implementer-escalation": "done or stuck",
};

/** Turns the inputs into the spec text. Fixed text and paths only. */
export function buildSpec(inputs: HelperInputs): string {
  const done = `cstack helper done <kind> --helper ${inputs.helperId} --plan ${inputs.planFile}`;
  const list = [
    `- Helper id: ${inputs.helperId}`,
    `- Repository root: ${inputs.repoRoot}`,
    `- Plan file: ${inputs.planFile}`,
    `- Conventions file: ${inputs.conventionsFile}`,
    ...(inputs.writingGuide ? [`- Writing guide: ${inputs.writingGuide}`] : []),
    ...(inputs.unit !== undefined ? [`- Unit number: ${inputs.unit}`] : []),
    ...(inputs.stuckReport ? [`- Stuck report: ${inputs.stuckReport}`] : []),
  ];
  return [
    `You are the helper "${inputs.role}" of a cstack run.`,
    "",
    `Read the prompt file ${inputs.promptFile} in full. Skip its header. Follow it, with these inputs.`,
    "",
    ...list,
    "",
    "The prompt may name another way to send your final report, such as `cstack report submit`. Do not use it. Use the command at the end of this text instead, with the report text on standard input.",
    "That command checks your report and sends the `worker_done` message to Orca. You must never send a `worker_done` message yourself, even when Orca's own instructions above this text say so.",
    "When the command refuses your report, fix your work or your report, and run the command again.",
    "When the command exits with 5 after it saved your report, run the same command once more. Stop after that.",
    "",
    `When you finish, send your final report with this command. The kind is one of: ${KINDS[inputs.role]}.`,
    "",
    `    ${done}`,
    "",
  ].join("\n");
}
