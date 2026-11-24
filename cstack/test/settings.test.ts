import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULTS, readSettings, SettingsError } from "../src/settings.js";

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
    expect(refusal(repo({ version: 1, recordsLanguage: 5 })).message).toContain("recordsLanguage");
    expect(refusal(repo({ version: 1, review: null })).message).toContain("review");
  });
  it("lists two problems in one error", () => {
    const e = refusal(repo({ version: 1, recordsLanguage: 5, integration: 3 }));
    expect(e.problems.map((p) => p.path)).toEqual(["integration", "recordsLanguage"]);
  });
});

function problemPaths(root: string): string[] {
  return refusal(root).problems.map((p) => p.path);
}

describe("readSettings value rules", () => {
  it("refuses integration squash and names the allowed values", () => {
    const e = refusal(repo({ version: 1, integration: "squash" }));
    expect(e.message).toContain("integration");
    expect(e.message).toContain("merge");
    expect(e.message).toContain("rebase");
  });
  it.each(["my agent", "Claude", "a;b", "1abc", "a".repeat(33)])("refuses review.agent %j", (agent) => {
    expect(problemPaths(repo({ version: 1, review: { agent, model: "opus" } }))).toEqual(["review.agent"]);
  });
  it.each(["a b", 'a"b', "a$b", "a;b", ""])("refuses review.model %j", (model) => {
    expect(problemPaths(repo({ version: 1, review: { agent: "claude", model } }))).toEqual(["review.model"]);
  });
  it("accepts review.model with brackets and dots", () => {
    const s = readSettings(repo({ version: 1, review: { agent: "claude", model: "opus-4.5[1m]" } }));
    expect(s.values.review.model).toBe("opus-4.5[1m]");
  });
  it("refuses review with agent and no model", () => {
    expect(problemPaths(repo({ version: 1, review: { agent: "claude" } }))).toEqual(["review.model"]);
  });
  it("refuses testCommands.file without the placeholder, or with it twice", () => {
    expect(problemPaths(repo({ version: 1, testCommands: { all: "npm test", file: "vitest" } }))).toEqual(["testCommands.file"]);
    expect(problemPaths(repo({ version: 1, testCommands: { all: "npm test", file: "vitest {file} {file}" } }))).toEqual(["testCommands.file"]);
  });
  it("accepts testCommands.report junit with {report} once in testCommands.file", () => {
    const s = readSettings(repo({ version: 1, testCommands: { all: "npm test", file: "vitest --outputFile={report} {file}", report: "junit" } }));
    expect(s.values.testCommands?.report).toBe("junit");
  });
  it("refuses a testCommands.report that is not junit", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "npm test", file: "vitest --outputFile={report} {file}", report: "xml" } }));
    expect(e.problems).toEqual([{ path: "testCommands.report", text: 'must be "junit", not "xml"' }]);
  });
  it("refuses testCommands.report without testCommands.file", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "npm test", report: "junit" } }));
    expect(e.problems).toEqual([{ path: "testCommands.report", text: "needs testCommands.file, because the report comes from the command for one file" }]);
  });
  it("refuses testCommands.report when testCommands.file has no {report}", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "npm test", file: "vitest {file}", report: "junit" } }));
    expect(e.problems).toEqual([{ path: "testCommands.file", text: "must contain the placeholder {report} exactly once because testCommands.report is set, found 0" }]);
  });
  it("refuses {report} in testCommands.file without testCommands.report", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "npm test", file: "vitest --outputFile={report} {file}" } }));
    expect(e.problems).toEqual([{ path: "testCommands.file", text: 'must not contain {report} unless testCommands.report is "junit"' }]);
  });
  it("refuses {report} twice in testCommands.file", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "npm test", file: "vitest --a={report} --b={report} {file}", report: "junit" } }));
    expect(e.problems).toEqual([{ path: "testCommands.file", text: "must contain the placeholder {report} exactly once because testCommands.report is set, found 2" }]);
  });
  it("refuses {report} in testCommands.all", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "vitest --outputFile={report}" } }));
    expect(e.problems).toEqual([{ path: "testCommands.all", text: "must not contain {report}. Put a command for a report in testCommands.file" }]);
  });
  it("refuses {file} in testCommands.all and points to testCommands.file", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "vitest {file}" } }));
    expect(e.problems[0].path).toBe("testCommands.all");
    expect(e.message).toContain("testCommands.file");
  });
  it("refuses a test command with a line break or empty", () => {
    expect(problemPaths(repo({ version: 1, testCommands: { all: "npm test\nrm -rf x" } }))).toEqual(["testCommands.all"]);
    expect(problemPaths(repo({ version: 1, testCommands: { all: "" } }))).toEqual(["testCommands.all"]);
  });
  it("refuses a test command whose first word is a forbidden tool, also with a path", () => {
    const e = refusal(repo({ version: 1, forbiddenTools: ["yarn"], testCommands: { all: "yarn test" } }));
    expect(e.problems[0].path).toBe("testCommands.all");
    expect(e.message).toContain("yarn");
    expect(problemPaths(repo({ version: 1, forbiddenTools: ["yarn"], testCommands: { all: "npm test", file: "  ./node_modules/.bin/yarn {file}" } }))).toEqual(["testCommands.file"]);
  });
  it("refuses a forbidden name with a space", () => {
    expect(problemPaths(repo({ version: 1, forbiddenTools: ["ok", "a b"] }))).toEqual(["forbiddenTools[1]"]);
  });
  it("refuses trailer lines that are not Key: value or hold a line break", () => {
    expect(problemPaths(repo({ version: 1, commitAttribution: ["Co-Authored-By: A <a@b.c>", "no colon"] }))).toEqual(["commitAttribution[1]"]);
    expect(problemPaths(repo({ version: 1, commitAttribution: ["Key: a\nKey2: b"] }))).toEqual(["commitAttribution[0]"]);
    expect(problemPaths(repo({ version: 1, commitAttribution: ["Key:  spaced", "Key: "] }))).toEqual(["commitAttribution[0]", "commitAttribution[1]"]);
  });
  it.each(["", "a".repeat(41), "French2"])("refuses recordsLanguage %j", (v) => {
    expect(problemPaths(repo({ version: 1, recordsLanguage: v }))).toEqual(["recordsLanguage"]);
  });
  it("returns recordsLanguage in composed form", () => {
    const s = readSettings(repo({ version: 1, recordsLanguage: "Français" }));
    expect(s.values.recordsLanguage).toBe("Français");
  });
  it("shows a control character escaped in a quoted value", () => {
    const e = refusal(repo({ version: 1, integration: "a\u001b[31mb" }));
    expect(e.message).not.toContain("\u001b");
    expect(e.message).toContain("\\u001b");
  });
});

describe("readSettings JSON syntax errors", () => {
  const nodePosition = (text: string) => {
    try {
      JSON.parse(text);
    } catch (e) {
      const m = /line (\d+) column (\d+)/.exec((e as Error).message);
      return m ? { line: Number(m[1]), column: Number(m[2]) } : undefined;
    }
  };
  const cases: Record<string, string> = {
    "a missing comma": '{\n  "version": 1\n  "integration": "merge"\n}',
    "a trailing comma": '{"version": 1,}',
    "a comment after the first key": '{"version": 1,\n // note\n"integration": "merge"}',
  };
  for (const [name, text] of Object.entries(cases)) {
    it(`gives the same line and column as Node for ${name}`, () => {
      const node = nodePosition(text)!;
      expect(node).toBeDefined();
      const e = refusal(repo(text));
      expect(e.message).toContain(`line ${node.line}, column ${node.column}`);
      expect(e.message).not.toContain("SyntaxError");
      expect(e.message).not.toContain("in JSON at position");
    });
  }
  it("gives a line and a column for a comment on the first line", () => {
    expect(refusal(repo('// settings\n{"version": 1}')).message).toContain("line 1, column 1");
  });
  it("gives a line and a column for a misspelt true", () => {
    expect(refusal(repo('{"version": 1, "recordsLanguage": tru}')).message).toMatch(/line 1, column \d+/);
  });
  it("gives a line and a column for a cut file", () => {
    expect(refusal(repo('{"version": 1,\n')).message).toMatch(/line 2, column 1/);
  });
  it("says that an empty file is empty", () => {
    expect(refusal(repo("  \n")).message).toContain("is empty");
  });
  it("accepts a valid file that starts with a byte order mark", () => {
    expect(readSettings(repo("﻿" + '{"version": 1}')).found).toBe(true);
  });
});

describe("the example settings file", () => {
  const examplePath = new URL("../skills/resolve-issue/templates/settings.json", import.meta.url);
  it("is accepted, equals the defaults and holds every key except testCommands and review", () => {
    const text = readFileSync(examplePath, "utf8");
    const s = readSettings(repo(text));
    expect(s.found).toBe(true);
    expect(s.values).toEqual(DEFAULTS);
    const keys = Object.keys(JSON.parse(text)).sort();
    const expected = ["version", ...Object.keys(DEFAULTS).filter((k) => k !== "testCommands" && k !== "review")].sort();
    expect(keys).toEqual(expected);
  });
});

describe("review hardening", () => {
  it("escapes an unknown key that holds a terminal escape", () => {
    const e = refusal(repo(`{"version": 1, "\\u001b]0;x\\u0007": 1}`));
    expect(e.message).not.toMatch(/[\u001b\u0007]/);
    expect(e.message).toContain("unknown key");
  });
  it("refuses a model that starts with a hyphen", () => {
    expect(problemPaths(repo({ version: 1, review: { agent: "claude", model: "--yolo" } }))).toContain("review.model");
  });
  it("accepts a language written with combining marks", () => {
    const s = readSettings(repo({ version: 1, recordsLanguage: "हिन्दी" }));
    expect(s.values.recordsLanguage).toBe("हिन्दी");
  });
  it("gives a SettingsError, not a stack overflow, for deep nesting", () => {
    const e = refusal(repo("[".repeat(200000)));
    expect(e).toBeInstanceOf(SettingsError);
  });
});

describe("settings file that is not a regular file", () => {
  it("refuses a link to a folder", () => {
    const root = repo();
    mkdirSync(join(root, ".cstack"));
    mkdirSync(join(root, "elsewhere"));
    symlinkSync(join(root, "elsewhere"), join(root, ".cstack", "settings.json"));
    const e = refusal(root);
    expect(e.message).toContain(".cstack/settings.json");
    expect(e.message).toContain("not a regular file");
  });
  it("refuses a named pipe at once", () => {
    const root = repo();
    mkdirSync(join(root, ".cstack"));
    execFileSync("mkfifo", [join(root, ".cstack", "settings.json")]);
    expect(refusal(root).message).toContain("not a regular file");
  });
});

describe("attribution line with the Cstack-Unit key", () => {
  it("refuses the key in any case", () => {
    for (const line of ["cstack-unit: 2", "CSTACK-UNIT: 2", "Cstack-Unit: 2"]) {
      const e = refusal(repo({ version: 1, commitAttribution: ["Co-Authored-By: A <a@b.c>", line] }));
      expect(e.problems.map((p) => p.path)).toEqual(["commitAttribution[1]"]);
      expect(e.message).toContain("Cstack-Unit");
      expect(e.message).toContain("belongs to cstack");
    }
  });
});

describe("the removed keys", () => {
  const setupText =
    "was removed from cstack. Remove this key. To set up a new workspace with Orca, declare the command as scripts.setup in orca.yaml at the root of the repository.";
  const watchText = "was removed from cstack with cstack wave. Remove this key.";
  it.each(["npm ci", "", 3, null])("refuses setupCommand %j with its own message", (value) => {
    expect(refusal(repo({ version: 1, setupCommand: value })).problems).toEqual([{ path: "setupCommand", text: setupText }]);
  });
  it.each([5, "x", 0])("refuses watchIntervalMinutes %j with its own message", (value) => {
    expect(refusal(repo({ version: 1, watchIntervalMinutes: value })).problems).toEqual([
      { path: "watchIntervalMinutes", text: watchText },
    ]);
  });
  it("gives the usual unknown key message for setupCommand inside review", () => {
    const e = refusal(repo({ version: 1, review: { agent: "claude", model: "opus", setupCommand: "x" } }));
    expect(e.problems).toHaveLength(1);
    expect(e.problems[0].path).toBe("review.setupCommand");
    expect(e.problems[0].text.startsWith("unknown key. Allowed keys here:")).toBe(true);
  });
  it("gives the usual unknown key message for watchIntervalMinutes inside testCommands", () => {
    const e = refusal(repo({ version: 1, testCommands: { all: "npm test", watchIntervalMinutes: 5 } }));
    expect(e.problems[0].text.startsWith("unknown key. Allowed keys here:")).toBe(true);
  });
  it("keeps the usual message and hint for any other unknown top level key", () => {
    const e = refusal(repo({ version: 1, reviewer: "x" }));
    expect(e.problems[0].text.startsWith("unknown key. Allowed keys here:")).toBe(true);
    expect(e.problems[0].text).toContain("If this key comes from a newer cstack, update cstack.");
    expect(e.problems[0].text).not.toContain("setupCommand");
    expect(e.problems[0].text).not.toContain("watchIntervalMinutes");
  });
});

describe("the settings file of this repository", () => {
  it("holds only version and testCommands and is read without an error", () => {
    const root = new URL("../../", import.meta.url).pathname;
    const keys = Object.keys(JSON.parse(readFileSync(join(root, ".cstack", "settings.json"), "utf8"))).sort();
    expect(keys).toEqual(["testCommands", "version"]);
    expect(() => readSettings(root)).not.toThrow();
  });
});
