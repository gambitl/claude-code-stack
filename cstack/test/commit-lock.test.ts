import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withCommitLock } from "../src/commit-lock.js";

let dir: string;
let lock: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cstack-lock-"));
  lock = join(dir, "cstack", "unit-commit.lock");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function writeLock(unit: number, pid: number): void {
  const folder = join(dir, "cstack");
  spawnSync("mkdir", ["-p", folder]);
  writeFileSync(lock, JSON.stringify({ unit, pid, time: new Date().toISOString() }));
}

function endedPid(): number {
  const child = spawnSync(process.execPath, ["-e", "0"]);
  return child.pid;
}

describe("withCommitLock", () => {
  it("refuses when a running process holds the lock, and never runs the function", async () => {
    writeLock(2, process.pid);
    let ran = false;
    const result = await withCommitLock(lock, 1, 300, () => {
      ran = true;
    });
    expect(ran).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.unit).toBe(2);
      expect(result.pid).toBe(process.pid);
      expect(result.message).toContain("unit 2");
      expect(result.message).toContain(String(process.pid));
    }
  });

  it("holds the lock while the function runs and removes it afterwards", async () => {
    let during = false;
    const result = await withCommitLock(lock, 1, 300, () => {
      during = existsSync(lock);
      return 7;
    });
    expect(during).toBe(true);
    expect(result).toEqual({ ok: true, value: 7 });
    expect(existsSync(lock)).toBe(false);
  });

  it("removes the lock when the function throws", async () => {
    await expect(
      withCommitLock(lock, 1, 300, () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(existsSync(lock)).toBe(false);
  });

  it("writes the unit, the process id and the time", async () => {
    await withCommitLock(lock, 3, 300, () => {
      const body = JSON.parse(readFileSync(lock, "utf8"));
      expect(body.unit).toBe(3);
      expect(body.pid).toBe(process.pid);
      expect(typeof body.time).toBe("string");
    });
  });

  it("takes over a lock whose process has ended", async () => {
    writeLock(2, endedPid());
    const result = await withCommitLock(lock, 1, 300, () => "ran");
    expect(result).toEqual({ ok: true, value: "ran" });
  });

  it("takes over a lock file that is not valid JSON", async () => {
    writeLock(2, process.pid);
    writeFileSync(lock, "not json");
    const result = await withCommitLock(lock, 1, 300, () => "ran");
    expect(result).toEqual({ ok: true, value: "ran" });
  });

  it("runs when the lock is released during the wait", async () => {
    writeLock(2, process.pid);
    setTimeout(() => rmSync(lock), 100);
    const result = await withCommitLock(lock, 1, 1000, () => "ran");
    expect(result).toEqual({ ok: true, value: "ran" });
  });
});
