import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
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

  it("takes over a lock file that is not valid JSON once it is a minute old", async () => {
    writeLock(2, process.pid);
    writeFileSync(lock, "not json");
    const minuteAgo = new Date(Date.now() - 60_000);
    utimesSync(lock, minuteAgo, minuteAgo);
    const result = await withCommitLock(lock, 1, 300, () => "ran");
    expect(result).toEqual({ ok: true, value: "ran" });
  });

  it("waits on a fresh lock file that cannot be read, and refuses at the deadline", async () => {
    writeLock(2, process.pid);
    writeFileSync(lock, "");
    let ran = false;
    const result = await withCommitLock(lock, 1, 300, () => {
      ran = true;
    });
    expect(ran).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("cannot be read");
    expect(existsSync(lock)).toBe(true);
  });

  it("keeps a lock that another holder wrote while the function ran", async () => {
    const other = JSON.stringify({ unit: 9, pid: process.pid, time: new Date().toISOString() });
    await withCommitLock(lock, 1, 300, () => writeFileSync(lock, other));
    expect(readFileSync(lock, "utf8")).toBe(other);
  });

  it("leaves no temporary file next to the lock", async () => {
    await withCommitLock(lock, 1, 300, () => "ran");
    writeLock(2, process.pid);
    await withCommitLock(lock, 1, 50, () => "ran");
    expect(readdirSync(join(dir, "cstack"))).toEqual(["unit-commit.lock"]);
  });

  it("never runs the functions of several processes at the same time", async () => {
    const log = join(dir, "log.txt");
    const source = new URL("../src/commit-lock.ts", import.meta.url).href;
    const child = `
      import { appendFileSync } from "node:fs";
      import { withCommitLock } from ${JSON.stringify(source)};
      const [lock, log, unit] = process.argv.slice(1);
      const result = await withCommitLock(lock, Number(unit), 30000, async () => {
        appendFileSync(log, "start " + unit + "\\n");
        await new Promise((resolve) => setTimeout(resolve, 30));
        appendFileSync(log, "end " + unit + "\\n");
      });
      if (!result.ok) process.exitCode = 1;
    `;
    const units = [1, 2, 3, 4, 5, 6];
    const codes = await Promise.all(
      units.map(
        (unit) =>
          new Promise<number | null>((resolve) => {
            spawn(process.execPath, ["--input-type=module", "-e", child, lock, log, String(unit)], { stdio: "inherit" }).on(
              "exit",
              resolve,
            );
          }),
      ),
    );
    expect(codes).toEqual(units.map(() => 0));
    const lines = readFileSync(log, "utf8").trim().split("\n");
    expect(lines).toHaveLength(units.length * 2);
    for (let i = 0; i < lines.length; i += 2) {
      const unit = lines[i].split(" ")[1];
      expect([lines[i], lines[i + 1]]).toEqual([`start ${unit}`, `end ${unit}`]);
    }
    expect(existsSync(lock)).toBe(false);
  }, 30_000);

  it("runs when the lock is released during the wait", async () => {
    writeLock(2, process.pid);
    setTimeout(() => rmSync(lock), 100);
    const result = await withCommitLock(lock, 1, 1000, () => "ran");
    expect(result).toEqual({ ok: true, value: "ran" });
  });
});
