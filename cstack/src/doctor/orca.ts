import type { DoctorInput, Outcome } from "./requirements.js";

export const ORCA_HINT =
  "Download it from https://github.com/stablyai/orca/releases.";

// Reads the JSON answer of an Orca command. Anything unusual gives undefined.
async function answer(
  input: DoctorInput,
  args: string[],
): Promise<Record<string, any> | undefined> {
  const result = await input.run("orca", args);
  if (result.kind !== "ok") return undefined;
  try {
    const body = JSON.parse(result.stdout);
    return body?.ok === true ? (body.result ?? {}) : undefined;
  } catch {
    return undefined;
  }
}

const hasItems = (value: unknown) => Array.isArray(value) && value.length > 0;

async function trackers(input: DoctorInput): Promise<string[]> {
  const found: string[] = [];
  const jira = await answer(input, ["jira", "connection", "--json"]);
  if (hasItems(jira?.sites)) found.push("Jira");
  const linear = await answer(input, [
    "linear",
    "team",
    "list",
    "--workspace",
    "all",
    "--json",
  ]);
  if (hasItems(linear?.teams)) found.push("Linear");
  else if (hasItems(linear?.meta?.workspaceErrors))
    found.push("Linear (connection error)");
  return found;
}

// Orca has three parts: is it available, which version, which trackers.
// Only the tracker names and the version are printed, never an Orca answer.
export async function checkOrca(
  input: DoctorInput,
  install: string,
): Promise<Outcome> {
  const version = await input.run("orca", ["--version"]);
  if (version.kind === "missing")
    return { ok: false, text: `Orca is not installed. ${install}` };
  if (version.kind === "timeout")
    return {
      ok: false,
      text: `did not answer within ${Math.round(input.timeoutMs / 1000)} seconds`,
    };
  if (version.kind === "failed")
    return { ok: false, text: `failed with exit code ${version.exitCode}` };
  const shown =
    /(\d+\.\d+\.\d+\S*)/.exec(version.stdout)?.[1] ?? "present, version unknown";

  const status = await answer(input, ["status", "--json"]);
  if (status?.runtime?.reachable !== true)
    return {
      ok: true,
      text: `${shown}, installed but not running. Trackers were not checked.`,
    };
  const found = await trackers(input);
  return {
    ok: true,
    text: `${shown}, running. Trackers: ${found.length ? found.join(", ") : "none"}`,
  };
}
