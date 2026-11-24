import { callOrca } from "./call.js";
import type { Runner, RunResult } from "./run.js";
import { checkShape, ShapeError } from "./shapes.js";
import { MIN_ORCA_VERSION, compareVersions, parseVersion } from "./version.js";

export type OrcaFeatureName =
  | "jira"
  | "linear";

export type Feature = { available: true } | { available: false; reason: string };

const STATUS = "orca status --json";
const CONTEXT = "orca agent-context --json";
const JIRA = "orca jira connection --json";
const LINEAR = "orca linear team list --workspace all --json";

const JIRA_COMMANDS = [
  "jira connection",
  "jira issue",
  "jira search",
  "jira status list",
  "jira status set",
  "jira comment add",
];
const LINEAR_COMMANDS = [
  "linear team list",
  "linear issue",
  "linear list-issues",
  "linear team states",
  "linear status set",
  "linear comment add",
];

// Thrown inside the detection to carry the reason of an unavailable feature.
class Unavailable extends Error {}

function describeFailure(command: string, result: RunResult): string {
  switch (result.kind) {
    case "missing":
      return "Orca is not installed.";
    case "timeout":
      return `\`${command}\` did not answer in time.`;
    case "too-large":
      return `\`${command}\` gave more output than cstack reads.`;
    case "failed":
      return `\`${command}\` failed with exit code ${result.exitCode}.`;
    default:
      return `\`${command}\` gave no answer.`;
  }
}

// Detects each Orca feature lazily. Each Orca command runs at most once per
// object, and only when a feature that is asked for needs it. Nothing is written to disk.
export function orcaFeatures(
  run: Runner,
  env: Record<string, string | undefined>,
): { get(name: OrcaFeatureName): Promise<Feature>; running(): Promise<Feature> } {
  const cache = new Map<string, Promise<any>>();
  const once = <T>(key: string, make: () => Promise<T>): Promise<T> => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key)!;
  };

  const version = () =>
    once("version", async () => {
      const result = await callOrca(run, env, ["--version"]);
      if (result.kind !== "ok") throw new Unavailable(describeFailure("orca --version", result));
      const found = parseVersion(result.stdout);
      if (found === null) throw new Unavailable("`orca --version` did not print a version.");
      if (compareVersions(found, MIN_ORCA_VERSION) < 0)
        throw new Unavailable(
          `Orca ${found} is older than the minimum ${MIN_ORCA_VERSION}.`,
        );
      return found;
    });

  // Runs a command after the version check, checks its shape and returns the body.
  const read = (command: string, args: string[]): Promise<any> =>
    once(command, async () => {
      const v = await version();
      const result = await callOrca(run, env, args);
      if (result.kind !== "ok") throw new Unavailable(describeFailure(command, result));
      let body: unknown;
      try {
        body = JSON.parse(result.stdout);
      } catch {
        throw new Unavailable(`The answer of \`${command}\` (Orca ${v}) is not JSON.`);
      }
      if ((body as { ok?: unknown } | null)?.ok === false)
        throw new Unavailable(`Orca answered with an error to \`${command}\`.`);
      try {
        checkShape(command, body, v, "read");
      } catch (e) {
        if (e instanceof ShapeError) throw new Unavailable(e.message);
        throw e;
      }
      return body;
    });

  const running = () =>
    once("running", async () => {
      const body = await read(STATUS, ["status"]);
      if (body.result.app.running !== true || body.result.runtime.reachable !== true)
        throw new Unavailable("Orca is installed but not running.");
    });

  const commands = async (needed: string[]) => {
    await running();
    const body = await read(CONTEXT, ["agent-context"]);
    const listed = new Set<string>(body.commands.map((c: { command: string }) => c.command));
    const missing = needed.filter((c) => !listed.has(c));
    if (missing.length > 0)
      throw new Unavailable(`This Orca does not have the commands ${missing.join(", ")}.`);
  };

  const detect: Record<OrcaFeatureName, () => Promise<void>> = {
    jira: async () => {
      await commands(JIRA_COMMANDS);
      const body = await read(JIRA, ["jira", "connection"]);
      const sites = body.result.sites as unknown[];
      if (sites.length === 0) throw new Unavailable("Orca has no saved Jira site.");
      if (sites.length > 1)
        throw new Unavailable(
          `Orca has ${sites.length} saved Jira sites, and cstack cannot choose a site on its own.`,
        );
    },
    linear: async () => {
      await commands(LINEAR_COMMANDS);
      const body = await read(LINEAR, ["linear", "team", "list", "--workspace", "all"]);
      // A workspace that answered with an error is still saved, so it counts.
      // A team without a workspace is the single legacy connection.
      const workspaces = new Set<string>();
      const add = (w: { id?: unknown; name?: unknown } | undefined) =>
        workspaces.add(String(w?.id ?? w?.name ?? "legacy"));
      for (const t of body.result.teams) add(t.workspace);
      for (const e of body.result.meta.workspaceErrors) add(e.workspace);
      if (workspaces.size > 1)
        throw new Unavailable(
          `Orca has ${workspaces.size} saved Linear workspaces, and cstack cannot choose a workspace on its own.`,
        );
      if (body.result.teams.length > 0) return;
      throw new Unavailable(
        body.result.meta.workspaceErrors.length > 0
          ? "Orca reports a connection error for a Linear workspace."
          : "Orca has no Linear team.",
      );
    },
  };

  const asFeature = async (check: () => Promise<void>): Promise<Feature> => {
    try {
      await check();
      return { available: true };
    } catch (e) {
      if (e instanceof Unavailable) return { available: false, reason: e.message };
      throw e;
    }
  };

  return {
    get: (name) => asFeature(detect[name]),
    // Is Orca running? The reason says why not, including a status answer of the wrong shape.
    running: () => asFeature(running),
  };
}
