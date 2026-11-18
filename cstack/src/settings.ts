import { readFileSync } from "node:fs";
import { locateJsonError } from "./json-position.js";
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

// A value quoted in a message: escaped by JSON.stringify and cut, so a terminal escape cannot get through.
function quote(v: unknown): string {
  let t = JSON.stringify(v) ?? String(v);
  t = t.replace(/[\u007f-\u009f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return t.length > 60 ? `${t.slice(0, 60)}...` : t;
}

function checkTestCommand(v: unknown, path: string, isFile: boolean, forbidden: string[], out: Problem[]): boolean {
  if (typeof v !== "string" || v.trim() === "" || /\p{Cc}/u.test(v)) {
    out.push({ path, text: `must be a non-empty one-line command with no control character, not ${quote(v)}` });
    return false;
  }
  const count = v.split("{file}").length - 1;
  if (isFile && count !== 1) {
    out.push({ path, text: `must contain the placeholder {file} exactly once, found ${count}` });
    return false;
  }
  if (!isFile && count > 0) {
    out.push({ path, text: "must not contain {file}. Put a command for one file in testCommands.file" });
    return false;
  }
  const word = v.trimStart().split(/[ \t]/)[0];
  const base = word.slice(word.lastIndexOf("/") + 1);
  const hit = forbidden.find((f) => f === word || f === base);
  if (hit !== undefined) {
    out.push({ path, text: `starts with ${quote(hit)}, which is in forbiddenTools` });
    return false;
  }
  return true;
}

function checkStringList(
  v: unknown,
  path: string,
  out: Problem[],
  item?: (value: string, path: string) => boolean,
): string[] | undefined {
  if (!Array.isArray(v)) {
    out.push({ path, text: "must be a list of strings" });
    return undefined;
  }
  let ok = true;
  v.forEach((entry, i) => {
    if (typeof entry !== "string") {
      out.push({ path: `${path}[${i}]`, text: "must be a string" });
      ok = false;
    } else if (item && !item(entry, `${path}[${i}]`)) ok = false;
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

  if (text.trim() === "") {
    throw new SettingsError([{ path: ".cstack/settings.json", text: "is empty" }]);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    const where = locateJsonError(text);
    throw new SettingsError([
      {
        path: ".cstack/settings.json",
        text: where
          ? `is not valid JSON, at line ${where.line}, column ${where.column}: ${where.reason}`
          : "is not valid JSON",
      },
    ]);
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

  const forbidden = Array.isArray(data.forbiddenTools)
    ? data.forbiddenTools.filter((x): x is string => typeof x === "string")
    : [];

  if (Object.hasOwn(data, "integration")) {
    const v = data.integration;
    if (v === "merge" || v === "rebase") set("integration", v);
    else problems.push({ path: "integration", text: `must be "merge" or "rebase", not ${quote(v)}` });
  }
  if (Object.hasOwn(data, "recordsLanguage")) {
    const v = typeof data.recordsLanguage === "string" ? data.recordsLanguage.normalize("NFC") : data.recordsLanguage;
    if (typeof v === "string" && /^\p{L}[\p{L} -]{0,39}$/u.test(v)) set("recordsLanguage", v);
    else problems.push({ path: "recordsLanguage", text: `must be 1 to 40 letters, spaces and hyphens, starting with a letter, not ${quote(v)}` });
  }
  if (Object.hasOwn(data, "forbiddenTools")) {
    const list = checkStringList(data.forbiddenTools, "forbiddenTools", problems, (item, path) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(item)) {
        problems.push({ path, text: `must be a command name of letters, digits, . _ + - (1 to 64 characters), not ${quote(item)}` });
        return false;
      }
      return true;
    });
    if (list) set("forbiddenTools", list);
  }
  if (Object.hasOwn(data, "commitAttribution")) {
    const list = checkStringList(data.commitAttribution, "commitAttribution", problems, (item, path) => {
      if (!/^[A-Za-z0-9][A-Za-z0-9-]*: [^ \p{Cc}][^\p{Cc}]*$/u.test(item)) {
        problems.push({ path, text: `must be one git trailer line of the form "Key: value", with no control character or line break, not ${quote(item)}` });
        return false;
      }
      return true;
    });
    if (list) set("commitAttribution", list);
  }
  if (Object.hasOwn(data, "testCommands")) {
    const o = checkObjectKeys(data.testCommands, "testCommands", TEST_KEYS, ["all"], problems);
    if (o) {
      let ok = true;
      for (const key of TEST_KEYS) {
        if (Object.hasOwn(o, key) && !checkTestCommand(o[key], `testCommands.${key}`, key === "file", forbidden, problems)) ok = false;
      }
      if (ok && typeof o.all === "string") set("testCommands", { ...o });
    }
  }
  if (Object.hasOwn(data, "review")) {
    const o = checkObjectKeys(data.review, "review", REVIEW_KEYS, REVIEW_KEYS, problems);
    if (o) {
      let ok = true;
      if (Object.hasOwn(o, "agent") && !(typeof o.agent === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(o.agent))) {
        problems.push({ path: "review.agent", text: `must match ^[a-z][a-z0-9-]{0,31}$ (lowercase letters, digits, hyphens), not ${quote(o.agent)}` });
        ok = false;
      }
      if (Object.hasOwn(o, "model") && !(typeof o.model === "string" && /^[A-Za-z0-9._\-[\]]+$/.test(o.model))) {
        problems.push({ path: "review.model", text: `must be a non-empty string of letters, digits and . _ - [ ], not ${quote(o.model)}` });
        ok = false;
      }
      if (ok && typeof o.agent === "string" && typeof o.model === "string") set("review", { agent: o.agent, model: o.model });
    }
  }
  if (Object.hasOwn(data, "watchIntervalMinutes")) {
    const v = data.watchIntervalMinutes;
    if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 1440) set("watchIntervalMinutes", v);
    else problems.push({ path: "watchIntervalMinutes", text: `must be a whole number from 1 to 1440, not ${quote(v)}` });
  }

  if (problems.length > 0) throw new SettingsError(problems);
  return result;
}
