import { lstat, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

// The rule that lets Claude Code run every cstack command without asking.
export const PERMISSION_RULE = "Bash(cstack *)";

export type SettingsState =
  | { kind: "missing"; path: string }
  | { kind: "invalid"; path: string; reason: string }
  | {
      kind: "ok";
      path: string;
      text: string;
      data: Record<string, unknown>;
      hasRule: boolean;
    };

export function settingsPath(home: string): string {
  return join(home, ".claude", "settings.json");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Reads the settings file and says whether cstack can edit it. It never writes.
export async function readSettings(home: string): Promise<SettingsState> {
  const path = settingsPath(home);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { kind: "missing", path };
    }
    return { kind: "invalid", path, reason: (error as Error).message };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { kind: "invalid", path, reason: `not valid JSON (${(error as Error).message})` };
  }
  if (!isObject(data)) {
    return { kind: "invalid", path, reason: "the top level is not an object" };
  }
  const permissions = data.permissions;
  if (permissions !== undefined) {
    if (!isObject(permissions)) {
      return { kind: "invalid", path, reason: "permissions is not an object" };
    }
    const allow = permissions.allow;
    if (allow !== undefined && !Array.isArray(allow)) {
      return { kind: "invalid", path, reason: "permissions.allow is not a list" };
    }
    return { kind: "ok", path, text, data, hasRule: (allow ?? []).includes(PERMISSION_RULE) };
  }
  return { kind: "ok", path, text, data, hasRule: false };
}

export function backupPath(path: string, stamp: string): string {
  return `${path}.backup-${stamp}`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

// True when the copy that the write needs is already taken.
export async function backupTaken(state: SettingsState, stamp: string): Promise<boolean> {
  return state.kind === "ok" && !state.hasRule && (await exists(backupPath(state.path, stamp)));
}

// Adds the rule. Writes in place with writeFile so a symbolic link stays a link.
// Returns the path of the copy of the old bytes, or undefined when none was needed.
export async function addRule(
  state: SettingsState,
  stamp: string,
): Promise<string | undefined> {
  if (state.kind === "invalid") throw new Error(state.reason);
  if (state.kind === "missing") {
    await mkdir(dirname(state.path), { recursive: true });
    await writeFile(state.path, `${JSON.stringify({ permissions: { allow: [PERMISSION_RULE] } }, null, 2)}\n`);
    return undefined;
  }
  if (state.hasRule) return undefined;
  const copy = backupPath(state.path, stamp);
  await writeFile(copy, state.text, { flag: "wx" });
  const data = state.data;
  const permissions = (isObject(data.permissions) ? data.permissions : {}) as Record<string, unknown>;
  const allow = Array.isArray(permissions.allow) ? permissions.allow : [];
  permissions.allow = [...allow, PERMISSION_RULE];
  data.permissions = permissions;
  await writeFile(state.path, `${JSON.stringify(data, null, 2)}\n`);
  return copy;
}
