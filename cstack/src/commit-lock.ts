import { mkdirSync, openSync, closeSync, readFileSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";

const POLL_MS = 200;

export type LockResult<T> =
  | { ok: true; value: T }
  | { ok: false; unit: number; pid: number; message: string };

interface Holder {
  unit: number;
  pid: number;
}

function readHolder(lockPath: string): Holder | "gone" | "unreadable" {
  let text: string;
  try {
    text = readFileSync(lockPath, "utf8");
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? "gone" : "unreadable";
  }
  try {
    const body = JSON.parse(text) as Partial<Holder>;
    if (Number.isInteger(body.pid) && Number.isInteger(body.unit)) {
      return { unit: body.unit as number, pid: body.pid as number };
    }
  } catch {
    // fall through: a lock file that cannot be parsed is taken over
  }
  return "unreadable";
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `fn` while holding the unit-commit lock of one worktree. When another
 * live process holds the lock, it checks again every 200 ms for up to
 * `waitMs`, then returns a refusal that names the unit and the process.
 */
export async function withCommitLock<T>(
  lockPath: string,
  unit: number,
  waitMs: number,
  fn: () => T | Promise<T>,
): Promise<LockResult<T>> {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + waitMs;
  for (;;) {
    let fd: number | undefined;
    try {
      fd = openSync(lockPath, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    if (fd !== undefined) {
      try {
        writeSync(fd, JSON.stringify({ unit, pid: process.pid, time: new Date().toISOString() }));
        closeSync(fd);
        fd = undefined;
        return { ok: true, value: await fn() };
      } finally {
        if (fd !== undefined) closeSync(fd);
        rmSync(lockPath, { force: true });
      }
    }
    const holder = readHolder(lockPath);
    if (holder === "unreadable" || (holder !== "gone" && !isRunning(holder.pid))) {
      rmSync(lockPath, { force: true });
      continue;
    }
    if (holder !== "gone") {
      if (Date.now() >= deadline) {
        return {
          ok: false,
          unit: holder.unit,
          pid: holder.pid,
          message: `Another unit commit holds the lock: unit ${holder.unit}, process ${holder.pid}.`,
        };
      }
      await sleep(Math.min(POLL_MS, Math.max(1, deadline - Date.now())));
    }
  }
}
