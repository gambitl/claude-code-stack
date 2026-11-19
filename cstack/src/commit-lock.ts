import { linkSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const POLL_MS = 200;
// A lock file that cannot be read is taken over only after this long without a change.
const UNREADABLE_STALE_MS = 5_000;

// The refusal names the unit and the process when the lock file can be read.
export type LockResult<T> =
  | { ok: true; value: T }
  | { ok: false; unit?: number; pid?: number; message: string };

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

function readText(lockPath: string): string | undefined {
  try {
    return readFileSync(lockPath, "utf8");
  } catch {
    return undefined;
  }
}

function isOld(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > UNREADABLE_STALE_MS;
  } catch {
    return false;
  }
}

// WHY: the lock appears already filled. It is written to a temporary file first, then
// linked to the lock path, and the link fails with EEXIST when the lock is taken. With an
// empty lock created first, another process could read it before the write, call it
// unreadable, delete it and take the lock, and two commits would then run at once.
function tryCreate(lockPath: string, body: string): boolean {
  const temporary = `${lockPath}.${process.pid}.tmp`;
  writeFileSync(temporary, body);
  try {
    linkSync(temporary, lockPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    rmSync(temporary, { force: true });
  }
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
 * A lock whose process has ended is taken over at once. A lock file that
 * cannot be read is taken over once it is five seconds old.
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
    const body = JSON.stringify({ unit, pid: process.pid, time: new Date().toISOString() });
    if (tryCreate(lockPath, body)) {
      try {
        return { ok: true, value: await fn() };
      } finally {
        // Another holder may have taken over the lock in the meantime. Its lock stays.
        if (readText(lockPath) === body) rmSync(lockPath, { force: true });
      }
    }
    const holder = readHolder(lockPath);
    if (holder === "gone") continue;
    const stale = holder === "unreadable" ? isOld(lockPath) : !isRunning(holder.pid);
    if (stale) {
      rmSync(lockPath, { force: true });
      continue;
    }
    if (Date.now() >= deadline) {
      if (holder === "unreadable") {
        return { ok: false, message: "Another unit commit holds the lock, and its lock file cannot be read yet." };
      }
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
