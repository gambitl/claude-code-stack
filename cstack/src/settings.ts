import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reader of the per-repository settings file, `.cstack/settings.json`.
 *
 * The caller gives the repository root. A command finds it with
 * `git rev-parse --show-toplevel`. The reader never runs a command, git included.
 *
 * Version rule: the format stays at version 1 when a later ticket adds a key.
 * It moves to version 2 only when a key is renamed, removed or changes meaning.
 *
 * Test commands are code of the repository, like a script in its package.json,
 * because the team writes and commits them. The ticket that runs them (#17) runs
 * them through `/bin/sh -c`. `{file}` is never replaced by a path: #17 replaces it
 * with `"$1"` and passes the path as a separate argument.
 *
 * `[` and `]` are glob characters for a shell, so a caller passes `review.model`
 * as a separate argument, never through a shell.
 */

export type Problem = { path: string; text: string };

// A failure to read or check the file. Every command turns it into exit code 3.
export class SettingsError extends Error {
  readonly problems: Problem[];
  constructor(problems: Problem[]) {
    super(problems.map((p) => `${p.path}: ${p.text}`).join("\n"));
    this.problems = problems;
  }
}

export type TestCommands = { all: string; file?: string };
export type Review = { agent: string; model: string };

export type SettingValues = {
  integration: "merge" | "rebase";
  recordsLanguage: string;
  forbiddenTools: string[];
  commitAttribution: string[];
  testCommands: TestCommands | undefined;
  review: Review;
  watchIntervalMinutes: number;
};

export type SettingKey = keyof SettingValues;
export type Source = "file" | "default";

export type Settings = {
  found: boolean;
  values: SettingValues;
  sources: Record<SettingKey, Source>;
};

export const DEFAULTS: SettingValues = {
  integration: "rebase",
  recordsLanguage: "English",
  forbiddenTools: [],
  commitAttribution: [],
  testCommands: undefined,
  // "opus" copies the header of skills/resolve-issue/agents/pr-reviewer.md (line 4).
  // The ticket that launches the review (#22) passes a model only when the source of `review` is "file".
  review: { agent: "claude", model: "opus" },
  watchIntervalMinutes: 5,
};

const TOP_KEYS = ["version", ...Object.keys(DEFAULTS)];
const REVIEW_KEYS = ["agent", "model"];
const TEST_KEYS = ["all", "file"];

const HINT = "If this key comes from a newer cstack, update cstack.";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function allDefaults(found: boolean): Settings {
  const values = structuredClone(DEFAULTS);
  const sources = Object.fromEntries(
    Object.keys(DEFAULTS).map((k) => [k, "default"]),
  ) as Record<SettingKey, Source>;
  return { found, values, sources };
}

function unknownKeys(obj: Record<string, unknown>, allowed: string[], prefix: string, out: Problem[]): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      out.push({
        path: prefix + key,
        text: `unknown key. Allowed keys here: ${allowed.join(", ")}. ${HINT}`,
      });
    }
  }
}

function checkStringList(v: unknown, path: string, out: Problem[]): string[] | undefined {
  if (!Array.isArray(v)) {
    out.push({ path, text: "must be a list of strings" });
    return undefined;
  }
  let ok = true;
  v.forEach((item, i) => {
    if (typeof item !== "string") {
      out.push({ path: `${path}[${i}]`, text: "must be a string" });
      ok = false;
    }
  });
  return ok ? (v as string[]) : undefined;
}

function checkObjectKeys(
  v: unknown,
  path: string,
  allowed: string[],
  required: string[],
  out: Problem[],
): Record<string, unknown> | undefined {
  if (!isObject(v)) {
    out.push({ path, text: `must be an object with the keys ${allowed.join(", ")}` });
    return undefined;
  }
  unknownKeys(v, allowed, `${path}.`, out);
  for (const key of required) {
    if (!Object.hasOwn(v, key)) out.push({ path: `${path}.${key}`, text: "is required" });
  }
  return v;
}

export function readSettings(root: string): Settings {
  const file = join(root, ".cstack", "settings.json");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return allDefaults(false);
    throw new SettingsError([
      { path: ".cstack/settings.json", text: `cannot be read (${(err as NodeJS.ErrnoException).code ?? "error"})` },
    ]);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SettingsError([{ path: ".cstack/settings.json", text: "is not valid JSON" }]);
  }
  if (!isObject(data)) {
    throw new SettingsError([{ path: ".cstack/settings.json", text: "must hold a JSON object at the top level" }]);
  }

  const problems: Problem[] = [];
  unknownKeys(data, TOP_KEYS, "", problems);
  if (data.version !== 1) {
    problems.push({ path: "version", text: "is required and must be the number 1. This cstack reads settings version 1." });
  }

  const result = allDefaults(true);
  const values = result.values as Record<string, unknown>;
  const set = (key: SettingKey, value: unknown): void => {
    values[key] = value;
    result.sources[key] = "file";
  };

  if (Object.hasOwn(data, "integration")) {
    if (typeof data.integration === "string") set("integration", data.integration);
    else problems.push({ path: "integration", text: "must be a string" });
  }
  if (Object.hasOwn(data, "recordsLanguage")) {
    if (typeof data.recordsLanguage === "string") set("recordsLanguage", data.recordsLanguage);
    else problems.push({ path: "recordsLanguage", text: "must be a string" });
  }
  for (const key of ["forbiddenTools", "commitAttribution"] as const) {
    if (Object.hasOwn(data, key)) {
      const list = checkStringList(data[key], key, problems);
      if (list) set(key, list);
    }
  }
  if (Object.hasOwn(data, "testCommands")) {
    const o = checkObjectKeys(data.testCommands, "testCommands", TEST_KEYS, ["all"], problems);
    if (o) {
      let ok = true;
      for (const key of TEST_KEYS) {
        if (Object.hasOwn(o, key) && typeof o[key] !== "string") {
          problems.push({ path: `testCommands.${key}`, text: "must be a string" });
          ok = false;
        }
      }
      if (ok && typeof o.all === "string") set("testCommands", { ...o });
    }
  }
  if (Object.hasOwn(data, "review")) {
    const o = checkObjectKeys(data.review, "review", REVIEW_KEYS, REVIEW_KEYS, problems);
    if (o) {
      let ok = true;
      for (const key of REVIEW_KEYS) {
        if (Object.hasOwn(o, key) && typeof o[key] !== "string") {
          problems.push({ path: `review.${key}`, text: "must be a string" });
          ok = false;
        }
      }
      if (ok && typeof o.agent === "string" && typeof o.model === "string") set("review", { agent: o.agent, model: o.model });
    }
  }
  if (Object.hasOwn(data, "watchIntervalMinutes")) {
    if (typeof data.watchIntervalMinutes === "number") set("watchIntervalMinutes", data.watchIntervalMinutes);
    else problems.push({ path: "watchIntervalMinutes", text: "must be a number" });
  }

  if (problems.length > 0) throw new SettingsError(problems);
  return result;
}
