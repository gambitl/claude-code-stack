import { callOrca } from "../orca/call.js";
import { orcaFeatures, type OrcaFeatureName } from "../orca/features.js";
import type { Runner } from "../orca/run.js";
import {
  MIN_ORCA_VERSION,
  NEWEST_TESTED_ORCA_VERSION,
  compareVersions,
  parseVersion,
} from "../orca/version.js";
import type { DoctorInput, Outcome } from "./requirements.js";

export const ORCA_HINT =
  "Download it from https://github.com/stablyai/orca/releases.";

const FEATURE_LABELS: [OrcaFeatureName, string][] = [
  ["workers", "Orca workers"],
  ["child-worktrees", "Child worktrees"],
  ["ticket-worktrees", "Worktrees linked to tickets"],
  ["jira", "Jira through Orca"],
  ["linear", "Linear through Orca"],
];

// Runs each command once, so doctor and the feature detection share their answers.
function remember(run: Runner): Runner {
  const seen = new Map<string, ReturnType<Runner>>();
  return (command, args, cwd) => {
    const key = [command, ...args].join(" ");
    if (!seen.has(key)) seen.set(key, run(command, args, cwd));
    return seen.get(key)!;
  };
}

// Prints the version, the minimum, whether the version is supported, and one
// line per feature. Only features and reasons are printed, never an Orca answer.
export async function checkOrca(
  input: DoctorInput,
  install: string,
): Promise<Outcome> {
  const run = remember(input.run);
  const version = await callOrca(run, process.env, ["--version"]);
  if (version.kind === "missing")
    return { ok: false, text: `Orca is not installed. ${install}` };
  if (version.kind === "timeout")
    return {
      ok: false,
      text: `did not answer within ${Math.round(input.timeoutMs / 1000)} seconds`,
    };
  if (version.kind === "too-large")
    return { ok: false, text: "gave more output than cstack reads" };
  if (version.kind === "failed")
    return { ok: false, text: `failed with exit code ${version.exitCode}` };
  const found = parseVersion(version.stdout);
  if (found === null) return { ok: true, text: "present, version unknown" };

  const supported = compareVersions(found, MIN_ORCA_VERSION) >= 0;
  let first = `${found}, minimum ${MIN_ORCA_VERSION}, ${supported ? "supported" : "not supported"}`;
  if (supported && compareVersions(found, NEWEST_TESTED_ORCA_VERSION) > 0)
    first += `. This version has not been tested, and cstack still uses it`;
  const features = orcaFeatures(run, process.env);
  if (!supported) first += ".";
  else {
    const running = await features.running();
    first += running.available ? ", running." : `. ${running.reason}`;
  }
  const lines = [first];
  for (const [name, label] of FEATURE_LABELS) {
    const feature = await features.get(name);
    lines.push(
      `  ${label}: ${feature.available ? "available" : `not available. ${feature.reason}`}`,
    );
  }
  return { ok: true, text: lines.join("\n") };
}
