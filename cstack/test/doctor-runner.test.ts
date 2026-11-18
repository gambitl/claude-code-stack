import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRunner, findOnPath } from "../src/doctor/runner.js";

describe("createRunner", () => {
  const runner = createRunner(200);

  it("returns ok with the stdout of a command that succeeds", async () => {
    expect(await runner("echo", ["hello"])).toEqual({
      kind: "ok",
      stdout: "hello\n",
    });
  });

  it("returns failed with the exit code", async () => {
    expect(await runner("sh", ["-c", "exit 3"])).toEqual({
      kind: "failed",
      exitCode: 3,
    });
  });

  it("returns missing when the command does not exist", async () => {
    expect(await runner("cstack-no-such-command", [])).toEqual({
      kind: "missing",
    });
  });

  it("returns timeout when the command is too slow", async () => {
    const start = Date.now();
    expect(await runner("sh", ["-c", "sleep 5"])).toEqual({ kind: "timeout" });
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("returns timeout when a child keeps the output open", async () => {
    const start = Date.now();
    expect(await runner("sh", ["-c", "sleep 5 & wait"])).toEqual({
      kind: "timeout",
    });
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("findOnPath", () => {
  it("returns the first folder entry that can be run", () => {
    const empty = mkdtempSync(join(tmpdir(), "cstack-path-"));
    const dir = mkdtempSync(join(tmpdir(), "cstack-path-"));
    const file = join(dir, "tool");
    writeFileSync(file, "#!/bin/sh\n");
    chmodSync(file, 0o755);
    expect(findOnPath("tool", `${empty}:${dir}`)).toBe(file);
    expect(findOnPath("other", `${empty}:${dir}`)).toBeUndefined();
  });

  it("skips a file that is not executable", () => {
    const dir = mkdtempSync(join(tmpdir(), "cstack-path-"));
    writeFileSync(join(dir, "tool"), "x");
    expect(findOnPath("tool", dir)).toBeUndefined();
  });
});

describe("a command that ignores the polite stop signal", () => {
  it("still gives timeout in under 2 seconds", async () => {
    const run = createRunner(200);
    const started = Date.now();
    const result = await run("sh", ["-c", "trap '' TERM; sleep 3"]);
    expect(result.kind).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
