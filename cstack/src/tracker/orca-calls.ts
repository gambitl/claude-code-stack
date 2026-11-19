import { readFileSync } from "node:fs";
import { EXIT } from "../manifest.js";
import { callOrca } from "../orca/call.js";
import { checkShape, ShapeError } from "../orca/shapes.js";
import type { Runner } from "../orca/run.js";
import { parseVersion } from "../orca/version.js";
import { NoClientError, RefusedArgumentError, TrackerError, WriteShapeError } from "./errors.js";

type Env = Record<string, string | undefined>;

const CANNOT_TELL =
  "cstack cannot tell whether the change happened. Check the ticket in the tracker by hand before you try again.";

// Reads Orca's version, only when a shape error must be reported.
async function orcaVersion(run: Runner, env: Env): Promise<string> {
  const result = await callOrca(run, env, ["--version"]);
  return (result.kind === "ok" ? parseVersion(result.stdout) : null) ?? "of unknown version";
}

async function call(
  run: Runner,
  env: Env,
  shape: string,
  args: string[],
  mode: "read" | "write",
): Promise<unknown> {
  const name = `orca ${args.join(" ")}`;
  // Once a write has run, every failure means that cstack cannot tell what happened.
  const fail = (why: string): TrackerError =>
    new TrackerError(mode === "write" ? `${why} ${CANNOT_TELL}` : why, EXIT.toolFailed);

  const result = await callOrca(run, env, args);
  if (result.kind === "missing") {
    throw NoClientError.forRead(`${name}, because Orca is not installed`);
  }
  if (result.kind === "failed") throw fail(`\`${name}\` failed with exit code ${result.exitCode}.`);
  if (result.kind === "timeout") throw fail(`\`${name}\` took too long.`);
  if (result.kind === "too-large") throw fail(`\`${name}\` printed too much output.`);

  let body: unknown;
  try {
    body = JSON.parse(result.stdout);
  } catch {
    throw fail(`\`${name}\` did not print JSON.`);
  }
  if ((body as { ok?: unknown } | null)?.ok === false) {
    throw fail(`\`${name}\` answered with ok: false.`);
  }
  try {
    checkShape(shape, body, "", "read");
  } catch (first) {
    if (!(first instanceof ShapeError)) throw first;
    // The version is read only now, so that a normal call costs no extra Orca call.
    let message = first.message;
    try {
      checkShape(shape, body, await orcaVersion(run, env), "read");
    } catch (e) {
      if (!(e instanceof ShapeError)) throw e;
      message = e.message;
    }
    if (mode === "write") throw new WriteShapeError(message);
    throw new TrackerError(message, EXIT.toolFailed);
  }
  return body;
}

// Runs an Orca command that only reads. Any failure gives exit 5.
export function orcaRead(run: Runner, env: Env, shape: string, args: string[]): Promise<unknown> {
  return call(run, env, shape, args, "read");
}

// Runs an Orca command that changes something. Once it ran, every failure gives exit 5.
export function orcaWrite(run: Runner, env: Env, shape: string, args: string[]): Promise<unknown> {
  return call(run, env, shape, args, "write");
}

// Refuses a comment body file that cannot be read, is blank, or is longer than cap characters.
export function checkCommentBody(path: string, cap: number): void {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new RefusedArgumentError(`cstack cannot read the comment file ${path}.`);
  }
  if (text.trim() === "") throw new RefusedArgumentError(`The comment file ${path} is blank.`);
  if (text.length > cap) {
    throw new RefusedArgumentError(`The comment file ${path} has ${text.length} characters, and the limit is ${cap}.`);
  }
}
