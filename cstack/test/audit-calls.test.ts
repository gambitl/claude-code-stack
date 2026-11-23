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
    const result = await readCalls([file]);
    expect(result).toEqual({
      calls: [{ time: Date.parse("2026-11-23T10:00:00.000Z"), args: ["unit", "red", "2", "--plan", "p.md"] }],
      unreadableFiles: 0,
    });
  });

  it("ignores a blob line without timestamp", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [
      bash("t1", "cstack next"),
      { type: "api-request-blob", message: { content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "cstack next" } }] } },
    ]);
    expect((await readCalls([file])).calls).toHaveLength(1);
  });

  it("counts a tool call id once across files", async () => {
    const { readCalls } = await load();
    const a = write("a.jsonl", [bash("t1", "cstack next")]);
    const b = write("b.jsonl", [bash("t1", "cstack next")]);
    expect((await readCalls([a, b])).calls).toHaveLength(1);
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
    expect((await readCalls([file])).calls).toEqual([]);
  });

  it("gives two commands of one tool call in the order of the text", async () => {
    const { readCalls } = await load();
    const file = write("a.jsonl", [bash("t1", "cstack unit red 1 && cstack unit green 1")]);
    const { calls } = await readCalls([file]);
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
    const result = await readCalls([file, join(folders[0]!, "missing.jsonl")]);
    expect(result.calls.map((c) => c.args[0])).toEqual(["a", "b"]);
    expect(result.unreadableFiles).toBe(1);
  });
});
