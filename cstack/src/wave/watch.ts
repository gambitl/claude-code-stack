import { setTimeout as delay } from "node:timers/promises";
import type { Io } from "../io.js";
import { EXIT } from "../manifest.js";
import { readSettings, SettingsError } from "../settings.js";
import { NoClientError } from "../tracker/errors.js";
import type { OpenTrackerOptions } from "../tracker/open.js";
import type { Group } from "../tracker/types.js";
import type { WaveDeps } from "../commands/wave.js";

/** What the watch needs from the outside. Tests give a fake clock, a fake Control-C hook and their own input. */
export interface WatchDeps {
  now(): Date;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
  /** Calls `listener` on Control-C. Returns the function that removes the listener. */
  onInterrupt(listener: () => void): () => void;
  input(): NodeJS.ReadableStream;
}

export function defaultWatchDeps(): WatchDeps {
  return {
    now: () => new Date(),
    sleep: (ms, signal) => delay(ms, undefined, { signal }).catch(() => undefined),
    onInterrupt: (listener) => {
      process.on("SIGINT", listener);
      return () => void process.off("SIGINT", listener);
    },
    input: () => process.stdin,
  };
}

const NO_CLIENT =
  "cstack: the watch needs a tracker client: Orca connected to the tracker, or gh or glab logged in. Run cstack wave again by hand. Claude can read the tracker with its own connection and write a file for --from-file <path>.\n";

/** Watches a group. For now it only checks that a watch can run. */
export async function watchWave(
  _group: Group,
  root: string,
  trackerOptions: OpenTrackerOptions,
  deps: WaveDeps,
  _watch: WatchDeps,
  io: Io,
): Promise<number> {
  try {
    readSettings(root);
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    io.stderr(`cstack: ${error.message}\n`);
    return EXIT.invalidInput;
  }
  if (!deps.isTerminal()) {
    io.stderr("cstack: the watch asks its questions in a terminal, so run it in an interactive terminal.\n");
    return EXIT.refused;
  }
  try {
    await deps.openTracker("list", trackerOptions);
    await deps.openTracker("read", trackerOptions);
  } catch (error) {
    if (!(error instanceof NoClientError)) throw error;
    io.stderr(NO_CLIENT);
    return EXIT.missingTool;
  }
  return EXIT.ok;
}
