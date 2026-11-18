import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSettings, SettingsError } from "../src/settings.js";

const roots: string[] = [];
function repo(content?: string | object): string {
  const root = mkdtempSync(join(tmpdir(), "cstack-settings-"));
  roots.push(root);
  if (content !== undefined) {
    mkdirSync(join(root, ".cstack"));
    const text = typeof content === "string" ? content : JSON.stringify(content);
    writeFileSync(join(root, ".cstack", "settings.json"), text);
  }
  return root;
}
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function refusal(root: string): SettingsError {
  try {
    readSettings(root);
  } catch (err) {
    expect(err).toBeInstanceOf(SettingsError);
    return err as SettingsError;
  }
  throw new Error("expected a SettingsError");
}

describe("readSettings unknown keys", () => {
  it("refuses an unknown top key and names it with the hint", () => {
    const e = refusal(repo({ version: 1, reviewer: "x" }));
    expect(e.message).toContain("reviewer");
    expect(e.message).toContain("If this key comes from a newer cstack, update cstack.");
  });
  it("names an unknown key inside review by its full path", () => {
    const e = refusal(repo({ version: 1, review: { agent: "claude", model: "opus", temperature: 1 } }));
    expect(e.message).toContain("review.temperature");
  });
  it("refuses constructor as an unknown key", () => {
    const e = refusal(repo('{"version": 1, "constructor": 1}'));
    expect(e.message).toContain("constructor");
  });
});

describe("readSettings results", () => {
  it("returns the defaults when there is no file", () => {
    const s = readSettings(repo());
    expect(s.found).toBe(false);
    expect(s.values.testCommands).toBeUndefined();
    expect(s.values.review).toEqual({ agent: "claude", model: "opus" });
    expect(Object.values(s.sources).every((v) => v === "default")).toBe(true);
  });
  it("gives every default for a file with only the version", () => {
    const s = readSettings(repo({ version: 1 }));
    expect(s.found).toBe(true);
    expect(s.values).toEqual({
      integration: "rebase",
      recordsLanguage: "English",
      forbiddenTools: [],
      commitAttribution: [],
      testCommands: undefined,
      review: { agent: "claude", model: "opus" },
      watchIntervalMinutes: 5,
    });
    expect(Object.values(s.sources).every((v) => v === "default")).toBe(true);
  });
  it("gives back every value of a full file, marked as from the file", () => {
    const full = {
      version: 1,
      integration: "merge",
      recordsLanguage: "French",
      forbiddenTools: ["yarn"],
      commitAttribution: ["Co-Authored-By: Claude <noreply@anthropic.com>"],
      testCommands: { all: "npm test", file: "npm test -- {file}" },
      review: { agent: "codex", model: "gpt-5" },
      watchIntervalMinutes: 10,
    };
    const s = readSettings(repo(full));
    const { version: _v, ...expected } = full;
    expect(s.values).toEqual(expected);
    expect(Object.values(s.sources).every((v) => v === "file")).toBe(true);
  });
});

describe("readSettings refusals of shape", () => {
  it("refuses a missing version and a version 2", () => {
    expect(refusal(repo({})).message).toContain("settings version 1");
    expect(refusal(repo({ version: 2 })).message).toContain("settings version 1");
  });
  it("refuses a top level array", () => {
    expect(refusal(repo("[]")).message).toContain("object");
  });
  it("refuses a folder at the path, not the defaults", () => {
    const root = repo();
    mkdirSync(join(root, ".cstack", "settings.json"), { recursive: true });
    refusal(root);
  });
  it("refuses wrong types with the key path", () => {
    expect(refusal(repo({ version: 1, watchIntervalMinutes: "5" })).message).toContain("watchIntervalMinutes");
    expect(refusal(repo({ version: 1, review: null })).message).toContain("review");
  });
  it("lists two problems in one error", () => {
    const e = refusal(repo({ version: 1, watchIntervalMinutes: "5", integration: 3 }));
    expect(e.problems.map((p) => p.path)).toEqual(["integration", "watchIntervalMinutes"]);
  });
});
