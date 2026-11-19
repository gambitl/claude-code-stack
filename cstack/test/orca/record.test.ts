import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { callOrca } from "../../src/orca/call.js";
import { placeholders, recordOrca } from "../../src/orca/record.js";
import type { Runner } from "../../src/orca/run.js";

const ctx = { home: "/Users/jane", host: "janes-mac.local" };

describe("placeholders", () => {
  it("leaves none of the original values", () => {
    const sample = JSON.stringify({
      id: "req-8f2",
      result: {
        path: "/Users/jane/work/repo",
        machine: "janes-mac.local",
        note: "mail jane@corp.io about ACME-42 and ACME-43 at https://acme.atlassian.net/browse/ACME-42",
        viewer: { accountId: "5b10ac8d", displayName: "Jane Doe", email: "jane@corp.io" },
        sites: [{ id: "abc123", name: "Acme Site", siteUrl: "https://acme.atlassian.net" }],
        teams: [{ key: "ACM", name: "Acme Team", workspace: { name: "Acme Workspace" } }],
        runtimeId: "8f14e45f-ceea-467f-a0e6-7b0f1a2b3c4d",
        pid: 4821,
      },
    });
    const out = placeholders(sample, ctx);
    for (const secret of [
      "/Users/jane", "janes-mac", "jane@", "corp.io", "ACME-4", "acme", "Acme", "Jane Doe",
      "5b10ac8d", "abc123", "ACM", "8f14e45f", "4821", "req-8f2",
    ])
      expect(out).not.toContain(secret);
    const parsed = JSON.parse(out);
    expect(parsed.result.note).toContain("EXA-1 and EXA-2");
    expect(parsed.result.teams[0].key).toBe("EXA");
    expect(parsed.result.pid).toBe(1);
  });
});

describe("callOrca", () => {
  it("uses ORCA_CLI_COMMAND and adds --json except for --version", async () => {
    const calls: string[][] = [];
    const run: Runner = async (c, a) => {
      calls.push([c, ...a]);
      return { kind: "ok", stdout: "" };
    };
    await callOrca(run, { ORCA_CLI_COMMAND: "/x/fake orca" }, ["status"]);
    await callOrca(run, { ORCA_CLI_COMMAND: "" }, ["--version"]);
    expect(calls).toEqual([["/x/fake orca", "status", "--json"], ["orca", "--version"]]);
  });
});

describe("recordOrca", () => {
  it("writes one trimmed file per command under the version folder", async () => {
    const folder = mkdtempSync(join(tmpdir(), "rec-"));
    const wrap = (result: unknown) => JSON.stringify({ id: "x", ok: true, result });
    const answers: Record<string, string> = {
      "--version": "orca 1.4.263\n",
      "status --json": wrap({ app: { running: true, pid: 9 }, runtime: { capabilities: ["a", "b"] } }),
      "agent-context --json": JSON.stringify({
        schemaVersion: 1, commandCount: 1, commands: [{ command: "status", summary: "long text" }],
      }),
      "jira connection --json": wrap({ sites: [] }),
      "linear team list --workspace all --json": wrap({ teams: [], meta: { workspaceErrors: [] } }),
    };
    const run: Runner = async (_c, a) => ({ kind: "ok", stdout: answers[a.join(" ")] ?? "" });
    await recordOrca({ run, env: {}, folder, home: ctx.home, host: ctx.host });
    const dir = join(folder, "1.4.263");
    expect(readdirSync(dir).sort()).toEqual([
      "agent-context.current.json", "jira-connection.empty.json",
      "linear-team-list.empty.json", "status.running.json", "version.current.txt",
    ]);
    expect(JSON.parse(readFileSync(join(dir, "status.running.json"), "utf8")).result.runtime.capabilities).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, "agent-context.current.json"), "utf8")).commands).toEqual([{ command: "status" }]);
  });
});
