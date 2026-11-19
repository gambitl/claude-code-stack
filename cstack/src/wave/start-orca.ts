import { callOrca } from "../orca/call.js";
import type { Runner } from "../orca/run.js";
import { checkShape, ShapeError } from "../orca/shapes.js";
import type { StartOutcome } from "./start-git.js";
import { mentionsLaunch, orcaErrorMessage } from "./orca-error.js";
import { printableText } from "./title.js";

export type OrcaOutcome = StartOutcome | { kind: "unknown"; reason: string };

const COMMAND = "orca worktree create --json";
const CHECK_ORCA = "Check Orca before running the wave again.";

/** Starts one ticket with `orca worktree create`. It never retries: a lost answer is an unknown outcome. */
export function startInOrca(runLong: Runner, env: Record<string, string | undefined>, root: string) {
  return async function start(key: string, short: string, url: string): Promise<OrcaOutcome> {
    const result = await callOrca(runLong, env, [
      "worktree", "create", "--repo", `path:${root}`, "--name", short, "--branch", short,
      "--no-parent", "--reference", url, "--agent", "claude", "--prompt", `/resolve-issue ${key}`,
    ]);
    switch (result.kind) {
      case "missing":
        return { kind: "failed", reason: "Orca is not installed" };
      case "failed": {
        const message = orcaErrorMessage(result.stdout);
        if (message !== undefined) {
          if (mentionsLaunch(message)) {
            return { kind: "unknown", reason: `the outcome is unknown, Orca said: ${message}. ${CHECK_ORCA}` };
          }
          return { kind: "failed", reason: `Orca refused: ${message}` };
        }
        const lines = (result.stderr ?? "").trim().split(/\r?\n/).filter((l) => l !== "").join(" ");
        return { kind: "failed", reason: `\`orca worktree create\` failed (exit code ${result.exitCode})${lines ? `: ${lines}` : ""}` };
      }
      case "timeout":
        return { kind: "unknown", reason: `the outcome is unknown, \`orca worktree create\` did not answer in time. ${CHECK_ORCA}` };
      case "too-large":
        return { kind: "unknown", reason: `the outcome is unknown, the answer was too large. ${CHECK_ORCA}` };
    }
    let answer: any;
    try {
      answer = JSON.parse(result.stdout);
    } catch {
      return { kind: "unknown", reason: `the outcome is unknown, the answer was not JSON. ${CHECK_ORCA}` };
    }
    try {
      checkShape(COMMAND, answer, "unknown", "write");
    } catch (error) {
      if (!(error instanceof ShapeError)) throw error;
      return { kind: "unknown", reason: `the outcome is unknown, ${error.message}` };
    }
    if (answer.ok === false) {
      const message = typeof answer.error?.message === "string" ? answer.error.message : "no message";
      return { kind: "failed", reason: `Orca refused: ${message}` };
    }
    const path = answer.result?.worktree?.path;
    return { kind: "started", line: typeof path === "string" ? `started in ${printableText(path)}` : "started in Orca" };
  };
}
