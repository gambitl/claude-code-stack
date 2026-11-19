import type { CheckState } from "./forge.js";

export type ChecksOutcome =
  | { kind: "passed" }
  | { kind: "none" }
  | { kind: "failed"; failed: CheckState[]; running: CheckState[] }
  | { kind: "timeout"; running: CheckState[] }
  | { kind: "stale" };

export interface WaitInput {
  /** The commit that the pull request shows, and its checks (an empty list when none exists yet). */
  read: () => { head: string; checks: () => CheckState[] };
  pushed: string;
  timeoutMs: number;
  pollMs: number;
  graceMs: number;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

const failedBucket = (c: CheckState) => c.bucket === "fail" || c.bucket === "cancel";
const passedBucket = (c: CheckState) => c.bucket === "pass" || c.bucket === "skipping";

/** Waits until the checks of the pushed commit are known, the grace period is over, or the timeout comes. */
export async function waitForChecks(input: WaitInput): Promise<ChecksOutcome> {
  const start = input.now();
  let graceStart: number | undefined;
  for (;;) {
    const seen = input.read();
    const timedOut = input.now() - start >= input.timeoutMs;
    if (seen.head !== input.pushed) {
      if (timedOut) return { kind: "stale" };
    } else {
      graceStart ??= input.now();
      const graceOver = input.now() - graceStart >= input.graceMs;
      const checks = seen.checks();
      const failed = checks.filter(failedBucket);
      const running = checks.filter((c) => !failedBucket(c) && !passedBucket(c));
      if (checks.length === 0) {
        if (graceOver || timedOut) return { kind: "none" };
      } else if (running.length === 0 && failed.length > 0) {
        return { kind: "failed", failed, running };
      } else if (running.length === 0) {
        if (graceOver || timedOut) return { kind: "passed" };
      } else if (timedOut) {
        return failed.length > 0 ? { kind: "failed", failed, running } : { kind: "timeout", running };
      }
    }
    await input.sleep(input.pollMs);
  }
}
