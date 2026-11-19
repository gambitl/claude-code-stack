import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { callOrca } from "./call.js";
import type { Runner } from "./run.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const URL_RE = /https?:\/\/[^\s"'<>]+/g;
const TICKET = /\b[A-Z][A-Z0-9]+-\d+\b/g;

export type PlaceholderContext = { home: string; host: string };

function placeholderUrl(url: string): string {
  const host = /^https?:\/\/([^/:?#]+)/.exec(url)?.[1] ?? "";
  if (/linear/i.test(host)) return "https://linear.example.com";
  if (/jira|atlassian/i.test(host)) return "https://jira.example.com";
  return "https://example.com";
}

function scrubString(text: string, ctx: PlaceholderContext, keys: Map<string, string>): string {
  let out = text;
  if (ctx.home) out = out.split(ctx.home).join("/home/user");
  if (ctx.host) out = out.split(ctx.host).join("host.example.com");
  out = out.replace(EMAIL, "person@example.com");
  out = out.replace(URL_RE, placeholderUrl);
  out = out.replace(UUID, ZERO_UUID);
  out = out.replace(TICKET, (key) => {
    if (!keys.has(key)) keys.set(key, `EXA-${keys.size + 1}`);
    return keys.get(key) as string;
  });
  return out;
}

// Replaces the private values of a parsed answer by the placeholders of the plan.
function walk(
  value: unknown,
  path: string[],
  ctx: PlaceholderContext,
  keys: Map<string, string>,
): unknown {
  if (Array.isArray(value))
    return value.map((item) => walk(item, path, ctx, keys));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [name, inner] of Object.entries(value)) {
      out[name] = walk(inner, [...path, name], ctx, keys);
    }
    return out;
  }
  const name = path[path.length - 1] ?? "";
  const parent = path[path.length - 2] ?? "";
  const hasParentList = path.includes("sites")
    ? "sites"
    : path.includes("teams")
      ? "teams"
      : "";
  if (typeof value === "number" && name === "pid") return 1;
  if (typeof value !== "string") return value;
  if (name === "id")
    return hasParentList === "sites" ? "site-1" : "id-placeholder";
  if (name === "accountId") return "account-1";
  if (name === "activeSiteId" || name === "selectedSiteId") return "site-1";
  if (name === "runtimeId") return ZERO_UUID;
  if (name === "displayName") return "Example Person";
  if (name === "key" && hasParentList === "teams") return "EXA";
  if (name === "name") {
    if (parent === "workspace") return "Example Workspace";
    if (hasParentList === "teams") return "Example Team";
    if (hasParentList === "sites") return "Example Site";
  }
  return scrubString(value, ctx, keys);
}

// The placeholder pass. It works on the text of an answer.
export function placeholders(text: string, ctx: PlaceholderContext): string {
  const keys = new Map<string, string>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return scrubString(text, ctx, keys);
  }
  return JSON.stringify(walk(parsed, [], ctx, keys), null, 2) + "\n";
}

type Body = Record<string, any>;

function trimAnswer(command: string, body: Body): Body {
  if (command === "agent-context")
    return {
      schemaVersion: body.schemaVersion,
      commandCount: body.commandCount,
      commands: (body.commands ?? []).map((c: Body) => ({ command: c.command })),
    };
  if (command === "status" && body.result?.runtime)
    return {
      ...body,
      result: { ...body.result, runtime: { ...body.result.runtime, capabilities: [] } },
    };
  return body;
}

// The case comes from the content, so a new recording never lands under a wrong name.
function pickCase(command: string, body: Body): string {
  const result = body.result ?? {};
  if (command === "status") return result.app?.running === true ? "running" : "closed";
  if (command === "jira-connection") {
    const n = Array.isArray(result.sites) ? result.sites.length : 0;
    return n === 0 ? "empty" : n === 1 ? "one-site" : "two-sites";
  }
  if (command === "linear-team-list") {
    if (Array.isArray(result.teams) && result.teams.length > 0) return "connected";
    const errors = result.meta?.workspaceErrors;
    return Array.isArray(errors) && errors.length > 0 ? "error" : "empty";
  }
  return "current";
}

const COMMANDS: { name: string; args: string[] }[] = [
  { name: "status", args: ["status"] },
  { name: "agent-context", args: ["agent-context"] },
  { name: "jira-connection", args: ["jira", "connection"] },
  { name: "linear-team-list", args: ["linear", "team", "list", "--workspace", "all"] },
];

export type RecordInput = {
  run: Runner;
  env: Record<string, string | undefined>;
  folder: string;
  home: string;
  host: string;
};

// Runs the read-only Orca commands and writes one file per answer under <folder>/<version>/.
export async function recordOrca(input: RecordInput): Promise<string[]> {
  const ctx = { home: input.home, host: input.host };
  const version = await callOrca(input.run, input.env, ["--version"]);
  if (version.kind !== "ok") throw new Error("orca --version gave no answer");
  const versionText = version.stdout.trim();
  const number = /(\d+\.\d+\.\d+\S*)/.exec(versionText)?.[1];
  if (!number) throw new Error("orca --version gave no version number");
  const dir = join(input.folder, number);
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  const put = (file: string, text: string) => {
    writeFileSync(join(dir, file), text);
    written.push(file);
  };
  put("version.current.txt", `${number}\n`);
  for (const { name, args } of COMMANDS) {
    const result = await callOrca(input.run, input.env, args);
    if (result.kind !== "ok") throw new Error(`orca ${args.join(" ")} gave no answer`);
    const body = trimAnswer(name, JSON.parse(result.stdout));
    put(`${name}.${pickCase(name, body)}.json`, placeholders(JSON.stringify(body), ctx));
  }
  return written;
}
