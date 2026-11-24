import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

async function load() {
  return await import("../src/audit/calls.js");
}

const folders: string[] = [];
afterEach(() => {
  while (folders.length > 0) rmSync(folders.pop()!, { recursive: true, force: true });
});

function write(name: string, lines: unknown[]): string {
  let folder = folders[0];
  if (folder === undefined) {
    folder = mkdtempSync(join(tmpdir(), "audit-calls-"));
    folders.push(folder);
  }
  const path = join(folder, name);
  writeFileSync(path, lines.map((l) => (typeof l === "string" ? l : JSON.stringify(l))).join("\n") + "\n");
  return path;
}

function bash(id: string, command: string, timestamp: string | null = "2026-11-23T10:00:00.000Z") {
  const line: Record<string, unknown> = {
    type: "assistant",
    message: { content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
  };
  if (timestamp !== null) line.timestamp = timestamp;
  return line;
}

describe("readCalls", () => {
  it("gives the time and arguments of a Bash call", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("t1", "cstack unit red 2 --plan p.md")]);
    const result = await readCalls([{ path: file, helper: false }]);
    expect(result).toEqual({
      calls: [{ time: Date.parse("2026-11-23T10:00:00.000Z"), args: ["unit", "red", "2", "--plan", "p.md"], file: 0, helper: false }],
      launches: [],
      unreadableFiles: 0,
    });
  });

  it("ignores a blob line without timestamp", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [
      bash("t1", "cstack next"),
      { type: "api-request-blob", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "cstack next" } }] } },
    ]);
    expect((await readCalls([{ path: file, helper: false }])).calls).toHaveLength(1);
  });

  it("counts a tool call id once across files", async () => {
    const { readCalls } = await load();
    const a = write("a.jsonl", [bash("t1", "cstack next")]);
    const b = write("b.jsonl", [bash("t1", "cstack next")]);
    expect((await readCalls([{ path: a, helper: false }, { path: b, helper: true }])).calls).toHaveLength(1);
  });

  it("ignores an Agent call, a user line and a bad timestamp", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [
      { type: "assistant", timestamp: "2026-11-23T10:00:00.000Z", message: { content: [{ type: "tool_use", id: "a1", name: "Agent", input: { prompt: "run cstack next --done plan", command: "cstack next --done plan" } }] } },
      { type: "user", timestamp: "2026-11-23T10:00:00.000Z", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "cstack unit red 2" }] } },
      bash("t2", "cstack next", "not a date"),
      bash("t3", "cstack next", null),
      bash("t4", "echo hello"),
    ]);
    expect((await readCalls([{ path: file, helper: false }])).calls).toEqual([]);
  });

  it("gives two commands of one tool call in the order of the text", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("t1", "cstack unit red 1 && cstack unit green 1")]);
    const { calls } = await readCalls([{ path: file, helper: false }]);
    expect(calls.map((c) => c.args.slice(0, 2))).toEqual([["unit", "red"], ["unit", "green"]]);
    expect(calls[0]!.time).toBe(calls[1]!.time);
  });

  it("sorts calls by time and counts an unreadable file", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [
      bash("t1", "cstack b", "2026-11-23T11:00:00.000Z"),
      "not json",
      bash("t2", "cstack a", "2026-11-23T10:00:00.000Z"),
    ]);
    const result = await readCalls([{ path: file, helper: false }, { path: join(folders[0]!, "missing.jsonl"), helper: true }]);
    expect(result.calls.map((c) => c.args[0])).toEqual(["a", "b"]);
    expect(result.unreadableFiles).toBe(1);
  });

  it("gives file 0 and helper false to a call of a main session", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("t1", "cstack next")]);
    const { calls } = await readCalls([{ path: file, helper: false }]);
    expect(calls[0]).toMatchObject({ file: 0, helper: false });
  });

  it("gives the index of the file and helper true to a call of a helper transcript", async () => {
    const { readCalls } = await load();
    const a = write("a.jsonl", [bash("t1", "cstack next", "2026-11-23T10:00:00.000Z")]);
    const b = write("b.jsonl", [bash("t2", "cstack unit red 1", "2026-11-23T11:00:00.000Z")]);
    const { calls } = await readCalls([{ path: a, helper: false }, { path: b, helper: true }]);
    expect(calls.map((c) => [c.file, c.helper])).toEqual([[0, false], [1, true]]);
  });

  it("keeps the origin of the first file of the list for a repeated tool call id", async () => {
    const { readCalls } = await load();
    const a = write("a.jsonl", [bash("t1", "cstack next")]);
    const b = write("b.jsonl", [bash("t1", "cstack next")]);
    const { calls } = await readCalls([{ path: a, helper: false }, { path: b, helper: true }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ file: 0, helper: false });
  });

  it("keeps no path in a call", async () => {
    const { readCalls } = await load();
    const a = write("a.jsonl", [bash("t1", "cstack next")]);
    const { calls } = await readCalls([{ path: a, helper: false }]);
    expect(Object.keys(calls[0]!).sort()).toEqual(["args", "file", "helper", "time"]);
  });
});

describe("readCalls launches", () => {
  const T = "2026-11-23T10:00:00.000Z";
  function tool(id: string, name: string, input: Record<string, unknown>, timestamp: string | null = T) {
    const line: Record<string, unknown> = {
      type: "assistant",
      message: { content: [{ type: "tool_use", id, name, input }] },
    };
    if (timestamp !== null) line.timestamp = timestamp;
    return line;
  }

  it("returns a sub-agent launch for an Agent call", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [tool("a1", "Agent", { subagent_type: "resolve-issue:cto-review", prompt: "secret" })]);
    const { launches } = await readCalls([{ path: file, helper: false }]);
    expect(launches).toEqual([{ time: Date.parse(T), file: 0, helper: false, kind: "sub-agent", type: "resolve-issue:cto-review" }]);
  });

  it("returns a sub-agent launch for a Task call", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [tool("a1", "Task", { subagent_type: "general-purpose" })]);
    const { launches } = await readCalls([{ path: file, helper: true }]);
    expect(launches).toEqual([{ time: Date.parse(T), file: 0, helper: true, kind: "sub-agent", type: "general-purpose" }]);
  });

  it("returns no launch for a SendMessage call", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [tool("a1", "SendMessage", { subagent_type: "resolve-issue:cto-review" })]);
    expect((await readCalls([{ path: file, helper: false }])).launches).toEqual([]);
  });

  it("returns no launch for an Agent call without subagent_type", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [tool("a1", "Agent", { prompt: "x" })]);
    expect((await readCalls([{ path: file, helper: false }])).launches).toEqual([]);
  });

  it("returns no launch for an Agent call whose subagent_type is not a string", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [tool("a1", "Agent", { subagent_type: 7 })]);
    expect((await readCalls([{ path: file, helper: false }])).launches).toEqual([]);
  });

  it("returns no launch for an Agent call on a line with no valid timestamp", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [
      tool("a1", "Agent", { subagent_type: "x" }, null),
      tool("a2", "Agent", { subagent_type: "x" }, "not a date"),
    ]);
    expect((await readCalls([{ path: file, helper: false }])).launches).toEqual([]);
  });

  it.each(["orca", "orca-dev", "orca-ide"])("returns an Orca worker launch for %s orchestration worker-start", async (program) => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("b1", `${program} orchestration worker-start --agent codex`)]);
    const { launches, calls } = await readCalls([{ path: file, helper: false }]);
    expect(launches).toEqual([{ time: Date.parse(T), file: 0, helper: false, kind: "orca worker" }]);
    expect(calls).toEqual([]);
  });

  it.each([
    "echo orca orchestration worker-start",
    "orca orchestration check",
    "'orca' orchestration worker-start",
  ])("returns no launch for %s", async (command) => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("b1", command)]);
    expect((await readCalls([{ path: file, helper: false }])).launches).toEqual([]);
  });

  it("returns a launch whose tool call id is in two files once, with the origin of the first file", async () => {
    const { readCalls } = await load();
    const a = write("a.jsonl", [tool("a1", "Agent", { subagent_type: "x" })]);
    const b = write("b.jsonl", [tool("a1", "Agent", { subagent_type: "x" })]);
    const { launches } = await readCalls([{ path: a, helper: false }, { path: b, helper: true }]);
    expect(launches).toHaveLength(1);
    expect(launches[0]).toMatchObject({ file: 0, helper: false });
  });

  it("gives the same calls as before and one launch for a file with a cstack call and a launch", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("t1", "cstack next"), tool("a1", "Agent", { subagent_type: "x" }, "2026-11-23T10:00:01.000Z")]);
    const { calls, launches } = await readCalls([{ path: file, helper: false }]);
    expect(calls).toEqual([{ time: Date.parse(T), args: ["next"], file: 0, helper: false }]);
    expect(launches).toHaveLength(1);
  });

  it("sorts launches by time", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [
      tool("a1", "Agent", { subagent_type: "late" }, "2026-11-23T11:00:00.000Z"),
      tool("a2", "Agent", { subagent_type: "early" }, "2026-11-23T10:00:00.000Z"),
    ]);
    const { launches } = await readCalls([{ path: file, helper: false }]);
    expect(launches.map((l) => (l as { type: string }).type)).toEqual(["early", "late"]);
  });

  describe("transcript link", () => {
    const meta = (transcript: string, content: unknown) =>
      writeFileSync(transcript.replace(/\.jsonl$/, ".meta.json"), typeof content === "string" ? content : JSON.stringify(content));

    it("gives a launch the index of the transcript whose meta file holds its tool call id", async () => {
      const { readCalls } = await load();
      const main = write("main.jsonl", [tool("a1", "Agent", { subagent_type: "x" })]);
      const helper = write("agent-1.jsonl", [bash("t1", "cstack next")]);
      meta(helper, { toolUseId: "a1" });
      const { launches, unreadableFiles } = await readCalls([{ path: main, helper: false }, { path: helper, helper: true }]);
      expect(launches).toEqual([{ time: Date.parse(T), file: 0, helper: false, kind: "sub-agent", type: "x", transcript: 1 }]);
      expect(unreadableFiles).toBe(0);
    });

    it("gives each of two launches its own transcript", async () => {
      const { readCalls } = await load();
      const main = write("main.jsonl", [
        tool("a1", "Agent", { subagent_type: "first" }, "2026-11-23T10:00:00.000Z"),
        tool("a2", "Agent", { subagent_type: "second" }, "2026-11-23T11:00:00.000Z"),
      ]);
      const one = write("agent-1.jsonl", [bash("t1", "cstack next")]);
      const two = write("agent-2.jsonl", [bash("t2", "cstack next")]);
      meta(one, { toolUseId: "a2" });
      meta(two, { toolUseId: "a1" });
      const { launches } = await readCalls([{ path: main, helper: false }, { path: one, helper: true }, { path: two, helper: true }]);
      expect(launches.map((l) => [(l as { type: string }).type, (l as { transcript?: number }).transcript])).toEqual([["first", 2], ["second", 1]]);
    });

    it.each([
      ["has no meta file", null],
      ["has a meta file that is not valid JSON", "{not json"],
      ["has a meta file whose toolUseId is not a string", { toolUseId: 7 }],
    ])("links no launch for a transcript that %s, and leaves unreadableFiles at 0", async (_name, content) => {
      const { readCalls } = await load();
      const main = write("main.jsonl", [
        tool("7", "Agent", { subagent_type: "bad" }, "2026-11-23T10:00:00.000Z"),
        tool("a2", "Agent", { subagent_type: "good" }, "2026-11-23T11:00:00.000Z"),
      ]);
      const bad = write("agent-bad.jsonl", [bash("t1", "cstack next")]);
      const good = write("agent-good.jsonl", [bash("t2", "cstack next")]);
      if (content !== null) meta(bad, content);
      meta(good, { toolUseId: "a2" });
      const { launches, unreadableFiles } = await readCalls([{ path: main, helper: false }, { path: bad, helper: true }, { path: good, helper: true }]);
      expect(launches.map((l) => (l as { transcript?: number }).transcript)).toEqual([undefined, 2]);
      expect("transcript" in launches[0]!).toBe(false);
      expect(unreadableFiles).toBe(0);
    });
  });
});
