export type FieldType = "boolean" | "string" | "array" | "object";

interface Field {
  path: string;
  type: FieldType;
}

// The fields that cstack reads from each Orca answer. A path may go through
// an array, as in commands[].command.
const SHAPES: Record<string, Field[]> = {
  "orca status --json": [
    { path: "ok", type: "boolean" },
    { path: "result.app.running", type: "boolean" },
    { path: "result.runtime.reachable", type: "boolean" },
  ],
  "orca agent-context --json": [{ path: "commands[].command", type: "string" }],
  "orca jira connection --json": [
    { path: "ok", type: "boolean" },
    { path: "result.sites", type: "array" },
  ],
  "orca jira issue --json": [
    { path: "ok", type: "boolean" },
    { path: "result.key", type: "string" },
    { path: "result.title", type: "string" },
    { path: "result.description", type: "string" },
    { path: "result.url", type: "string" },
    { path: "result.status.name", type: "string" },
    { path: "result.status.categoryKey", type: "string" },
  ],
  "orca jira search --json": [
    { path: "ok", type: "boolean" },
    { path: "result[].key", type: "string" },
    { path: "result[].title", type: "string" },
    { path: "result[].description", type: "string" },
    { path: "result[].url", type: "string" },
    { path: "result[].status.name", type: "string" },
    { path: "result[].status.categoryKey", type: "string" },
  ],
  "orca jira status list --json": [
    { path: "ok", type: "boolean" },
    { path: "result[].id", type: "string" },
    { path: "result[].name", type: "string" },
    { path: "result[].to.name", type: "string" },
  ],
  "orca jira status set --json": [
    { path: "ok", type: "boolean" },
    { path: "result.ok", type: "boolean" },
  ],
  "orca jira comment add --json": [
    { path: "ok", type: "boolean" },
    { path: "result.ok", type: "boolean" },
  ],
  "orca linear team list --workspace all --json": [
    { path: "ok", type: "boolean" },
    { path: "result.teams", type: "array" },
    { path: "result.meta.workspaceErrors", type: "array" },
  ],
  "orca orchestration worker-start --json": [
    { path: "ok", type: "boolean" },
    { path: "result.dispatchId", type: "string" },
  ],
  "orca orchestration worker-show --full --json": [
    { path: "ok", type: "boolean" },
    { path: "result.dispatch.taskId", type: "string" },
    { path: "result.dispatch.status", type: "string" },
    { path: "result.observation", type: "object" },
  ],
  "orca orchestration send --json": [{ path: "ok", type: "boolean" }],
  "orca orchestration check --json": [{ path: "ok", type: "boolean" }],
};

export class ShapeError extends Error {}

// The command of a fixture file such as "linear-team-list.connected.json".
export function commandOfFixture(file: string): string {
  const name = file.split(".")[0] ?? "";
  for (const command of Object.keys(SHAPES)) {
    const words = command.replace(/^orca /, "").split(" --")[0]!.replaceAll(" ", "-");
    if (words === name) return command;
  }
  throw new ShapeError(`The fixture ${file} has no shape in cstack/src/orca/shapes.ts.`);
}

function typeOf(value: unknown): string {
  return Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
}

// Returns the type of the first bad value, "missing" for a missing field, or null when all is well.
function problem(value: unknown, parts: string[], type: FieldType): string | null {
  if (parts.length === 0) {
    const found = typeOf(value);
    return found === type ? null : found;
  }
  const [head, ...rest] = parts;
  if (head!.endsWith("[]")) {
    const list = head!.slice(0, -2);
    const array = list === "" ? value : (value as Record<string, unknown> | null | undefined)?.[list];
    if (!Array.isArray(array)) return "missing";
    for (const item of array) {
      const bad = problem(item, rest, type);
      if (bad !== null) return bad;
    }
    return null;
  }
  if (typeof value !== "object" || value === null || !(head! in value)) return "missing";
  return problem((value as Record<string, unknown>)[head!], rest, type);
}

// Checks that an Orca answer has the fields cstack reads. An answer with ok: false
// is a failure of the tool, not a shape error. After "write", a shape error means
// that cstack cannot tell whether the change happened.
export function checkShape(
  command: string,
  answer: unknown,
  version: string,
  mode: "read" | "write",
): void {
  const fields = SHAPES[command];
  if (fields === undefined) {
    throw new ShapeError(`There is no shape for "${command}" in cstack/src/orca/shapes.ts.`);
  }
  const failed = (answer as { ok?: unknown } | null)?.ok === false;
  for (const field of fields) {
    if (failed && field.path !== "ok") continue;
    const bad = problem(answer, field.path.split("."), field.type);
    if (bad === null) continue;
    const what = bad === "missing" ? "is missing" : `has type ${bad}`;
    const tail =
      mode === "write"
        ? " cstack cannot tell whether the change happened. Check the ticket or the worktree by hand."
        : "";
    throw new ShapeError(
      `The answer of \`${command}\` (Orca ${version}) is not what cstack expects: the field ${field.path} ${what}, and it should be ${field.type}.${tail}`,
    );
  }
}
