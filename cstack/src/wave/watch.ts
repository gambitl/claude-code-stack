import { setTimeout as delay } from "node:timers/promises";
import type { Io } from "../io.js";
import { orcaFeatures } from "../orca/features.js";
import { EXIT } from "../manifest.js";
import { readSettings, SettingsError } from "../settings.js";
import { NoClientError, TrackerError } from "../tracker/errors.js";
import type { OpenTrackerOptions } from "../tracker/open.js";
import type { Group } from "../tracker/types.js";
import type { WaveDeps } from "../commands/wave.js";
import { openAnswers } from "./answers.js";
import { WaveError } from "./errors.js";
import { formatGroups, groupTickets } from "./groups.js";
import { printableText } from "./title.js";
import { loadWorktreeCheck } from "./worktrees.js";

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

const MAX_FAILED_ROUNDS = 3;

const NO_CLIENT =
  "cstack: the watch needs a tracker client: Orca connected to the tracker, or gh or glab logged in. Run cstack wave again by hand. Claude can read the tracker with its own connection and write a file for --from-file <path>.\n";

/** Watches a group. For now it only checks that a watch can run. */
export async function watchWave(
  group: Group,
  root: string,
  trackerOptions: OpenTrackerOptions,
  deps: WaveDeps,
  watch: WatchDeps,
  io: Io,
): Promise<number> {
  let interval: number;
  try {
    interval = readSettings(root).values.watchIntervalMinutes;
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    io.stderr(`cstack: ${error.message}\n`);
    return EXIT.invalidInput;
  }
  if (!deps.isTerminal()) {
    io.stderr("cstack: the watch asks its questions in a terminal, so run it in an interactive terminal.\n");
    return EXIT.refused;
  }
  let lister;
  try {
    lister = await deps.openTracker("list", trackerOptions);
    await deps.openTracker("read", trackerOptions);
  } catch (error) {
    if (!(error instanceof NoClientError)) throw error;
    io.stderr(NO_CLIENT);
    return EXIT.missingTool;
  }
  const orca = (await orcaFeatures(deps.run, deps.env).get("ticket-worktrees")).available;
  const name = trackerOptions.tracker!;

  const interrupted = new AbortController();
  const inputEnded = new AbortController();
  const stop = AbortSignal.any([interrupted.signal, inputEnded.signal]);
  const removeInterrupt = watch.onInterrupt(() => interrupted.abort());
  const answers = openAnswers(watch.input(), {
    ignored: () => io.stdout("Ignored a line typed while no question was waiting.\n"),
    ended: () => inputEnded.abort(),
  });
  try {
    const label = "milestone" in group ? group.milestone : group.epic;
    io.stdout(`Watching ${printableText(label)} every ${interval} minutes. Press Control-C to stop.\n`);
    let first = true;
    let failedInARow = 0;
    while (!stop.aborted) {
      const started = watch.now().getTime();
      let groups;
      try {
        const tickets = await lister.listGroup(group);
        const check = await loadWorktreeCheck({ run: deps.run, env: deps.env, root, tracker: name, orca });
        groups = await groupTickets(tickets, check);
      } catch (error) {
        if (!(error instanceof WaveError || error instanceof TrackerError)) throw error;
        if (stop.aborted) break;
        failedInARow++;
        io.stderr(`cstack: ${printableText(error.message)}\n`);
        if (failedInARow >= MAX_FAILED_ROUNDS) {
          io.stderr(`cstack: the last ${MAX_FAILED_ROUNDS} reads of the wave failed, so the watch stopped.\n`);
          return error.exitCode;
        }
        await watch.sleep(Math.max(0, started + interval * 60_000 - watch.now().getTime()), stop);
        continue;
      }
      failedInARow = 0;
      if (stop.aborted) break;
      if (first) io.stdout(formatGroups(groups));
      first = false;
      const time = watch.now();
      const hhmm = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
      io.stdout(
        `${hhmm}  ${groups.ready.length} ready, ${groups.blocked.length} blocked, ${groups.started.length} already started, ${groups.finished} finished.\n`,
      );
      if (groups.ready.length === 0 && groups.blocked.length === 0) {
        io.stdout("No ticket is blocked anymore and every ready ticket was offered, so the watch ended.\n");
        return EXIT.ok;
      }
      await watch.sleep(Math.max(0, started + interval * 60_000 - watch.now().getTime()), stop);
    }
    io.stdout(interrupted.signal.aborted ? "\nStopped the watch.\n" : "\nStandard input closed, so the watch stopped.\n");
    return EXIT.ok;
  } finally {
    removeInterrupt();
    answers.close();
  }
}
