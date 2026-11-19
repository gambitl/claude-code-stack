import { RefusedArgumentError } from "./errors.js";
import type { StateKind, TrackerName } from "./types.js";

/** The only state names that a move accepts on GitHub and GitLab. */
export const FORGE_STATE_NAMES = ["in progress", "in review"] as const;

const JIRA: Record<string, StateKind> = {
  "to do": "todo", new: "todo",
  "in progress": "in-progress", indeterminate: "in-progress",
  done: "finished",
};

const LINEAR: Record<string, StateKind> = {
  triage: "todo", backlog: "todo", unstarted: "todo",
  started: "in-progress",
  completed: "finished", canceled: "finished",
};

/** Maps a Jira status category (its name or its key). */
export function jiraStateKind(category: string): StateKind {
  return JIRA[category.toLowerCase()] ?? "unknown";
}

/** Maps a Linear state type. */
export function linearStateKind(type: string): StateKind {
  return LINEAR[type.toLowerCase()] ?? "unknown";
}

/** Maps a GitHub or GitLab issue: closed is finished, a work label means in-progress. */
export function forgeStateKind(issue: { open: boolean; labels: string[] }): StateKind {
  if (!issue.open) return "finished";
  const labels = issue.labels.map((l) => l.toLowerCase());
  return FORGE_STATE_NAMES.some((n) => labels.includes(n)) ? "in-progress" : "todo";
}

/** Refuses a state name that the tracker does not offer. `offered` is the list the tracker gave (Jira and Linear). */
export function checkStateName(tracker: TrackerName, stateName: string, offered: readonly string[] = []): void {
  const names: readonly string[] = tracker === "github" || tracker === "gitlab" ? FORGE_STATE_NAMES : offered;
  if (!names.includes(stateName)) {
    throw new RefusedArgumentError(`"${stateName}" is not a state of ${tracker}. The offered names are: ${names.join(", ")}.`);
  }
}
