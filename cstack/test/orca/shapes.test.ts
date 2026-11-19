import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MIN_ORCA_VERSION,
  NEWEST_TESTED_ORCA_VERSION,
  compareVersions,
  parseVersion,
} from "../../src/orca/version.js";
import { ShapeError, checkShape, commandOfFixture } from "../../src/orca/shapes.js";

const root = join(import.meta.dirname, "..", "fixtures", "orca");
const dir = join(root, "1.4.263");

function load(file: string): unknown {
  return JSON.parse(readFileSync(join(dir, file), "utf8"));
}

describe("shape check", () => {
  it("names the command, the field and the version when a field is missing", () => {
    const answer = load("status.running.json") as any;
    const runtime = answer.result.runtime;
    runtime.reachability = runtime.reachable;
    delete runtime.reachable;
    let error: unknown;
    try {
      checkShape("orca status --json", answer, "1.4.263", "read");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ShapeError);
    const message = (error as Error).message;
    expect(message).toContain("orca status --json");
    expect(message).toContain("result.runtime.reachable");
    expect(message).toContain("1.4.263");
  });

  it("accepts every recorded JSON file", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(() => checkShape(commandOfFixture(file), load(file), "1.4.263", "read"), file).not.toThrow();
    }
  });

  it("reads the version of the recorded text file", () => {
    expect(parseVersion(readFileSync(join(dir, "version.current.txt"), "utf8"))).toBe("1.4.263");
  });

  it("refuses a field with another type and an element of an array", () => {
    const wrongType = load("status.running.json") as any;
    wrongType.result.runtime.reachable = "yes";
    expect(() => checkShape("orca status --json", wrongType, "1.4.263", "read")).toThrow(/boolean/);
    const ctx = load("agent-context.current.json") as any;
    ctx.commands[1] = { name: "x" };
    expect(() => checkShape("orca agent-context --json", ctx, "1.4.263", "read")).toThrow(/commands\[\]\.command/);
  });

  it("fails for a command that has no shape", () => {
    expect(() => checkShape("orca worktree create --json", {}, "1.4.263", "read")).toThrow(/no shape/);
    expect(() => commandOfFixture("worktree-create.ok.json")).toThrow(/no shape/);
  });

  it("does not call an answer with ok false a shape error", () => {
    expect(() => checkShape("orca jira connection --json", { ok: false, error: { message: "x" } }, "1.4.263", "read")).not.toThrow();
  });

  it("says that cstack cannot tell whether the change happened in write mode", () => {
    expect(() => checkShape("orca jira connection --json", { ok: true }, "1.4.263", "write")).toThrow(
      /cannot tell whether the change happened/,
    );
    expect(() => checkShape("orca jira connection --json", { ok: true }, "1.4.263", "read")).not.toThrow(
      /cannot tell/,
    );
  });
});

describe("orchestration shapes", () => {
  it("refuses a worker-start answer without a Dispatch id in write mode", () => {
    const answer = load("orchestration-worker-start.ready.json") as any;
    delete answer.result.dispatchId;
    let error: unknown;
    try {
      checkShape("orca orchestration worker-start --json", answer, "1.4.263", "write");
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ShapeError);
    const message = (error as Error).message;
    expect(message).toContain("orca orchestration worker-start --json");
    expect(message).toContain("result.dispatchId");
    expect(message).toContain("cannot tell whether the change happened");
  });
});

describe("Jira shapes", () => {
  it("accepts a Jira issue and names the status category when it is missing", () => {
    const answer = load("jira-issue.in-progress.json") as any;
    expect(() => checkShape("orca jira issue --json", answer, "1.4.263", "read")).not.toThrow();
    delete answer.result.status.categoryKey;
    expect(() => checkShape("orca jira issue --json", answer, "1.4.263", "read")).toThrow(
      /result\.status\.categoryKey/,
    );
  });

  it("refuses a search answer that has an element without a key", () => {
    const answer = load("jira-search.epic.json") as any;
    expect(() => checkShape("orca jira search --json", answer, "1.4.263", "read")).not.toThrow();
    delete answer.result[1].key;
    expect(() => checkShape("orca jira search --json", answer, "1.4.263", "read")).toThrow(/result\[\]\.key/);
  });
});

describe("Linear shapes", () => {
  it("accepts a Linear issue and names the identifier when it is missing", () => {
    const answer = load("linear-issue.blocked.json") as any;
    expect(() => checkShape("orca linear issue --relations --json", answer, "1.4.263", "read")).not.toThrow();
    delete answer.result.issue.identifier;
    expect(() => checkShape("orca linear issue --relations --json", answer, "1.4.263", "read")).toThrow(
      /result\.issue\.identifier/,
    );
  });

  it("refuses a list whose truncated flag is a string", () => {
    const answer = load("linear-list-issues.epic.json") as any;
    expect(() => checkShape("orca linear list-issues --json", answer, "1.4.263", "read")).not.toThrow();
    answer.result.truncated = "false";
    expect(() => checkShape("orca linear list-issues --json", answer, "1.4.263", "read")).toThrow(
      /result\.truncated/,
    );
  });
});

describe("versions", () => {
  it("compares as numbers", () => {
    expect(compareVersions("1.4.1000", "1.4.263")).toBeGreaterThan(0);
    expect(compareVersions("1.4.259", "1.4.259")).toBe(0);
    expect(compareVersions("1.3.999", "1.4.0")).toBeLessThan(0);
  });

  it("takes the first version of the text", () => {
    expect(parseVersion("1.4.263\n")).toBe("1.4.263");
    expect(parseVersion("orca 1.4.259 (build 2)")).toBe("1.4.259");
    expect(parseVersion("nothing")).toBeNull();
  });

  it("keeps the newest tested version equal to the newest fixture folder", () => {
    const folders = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    const newest = folders.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
    expect(NEWEST_TESTED_ORCA_VERSION).toBe(newest);
    expect(MIN_ORCA_VERSION).toBe("1.4.259");
  });
});
