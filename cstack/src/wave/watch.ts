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
import { isYes, startAllQuestion } from "./confirm.js";
import { notifyReady } from "./notify.js";
import { WaveError } from "./errors.js";
import { formatGroups, groupTickets } from "./groups.js";
import { printableText } from "./title.js";
import { loadWorktreeCheck } from "./worktrees.js";
import { startInOrca } from "./start-orca.js";
import { FETCH_FAILED, fetchOrigin, prepareGitStart } from "./start-git.js";
import { startTicket, type Starter } from "./start.js";

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
  let reader;
  try {
    lister = await deps.openTracker("list", trackerOptions);
    reader = await deps.openTracker("read", trackerOptions);
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
    io.stdout("macOS shows the notifications of the watch only if it allows notifications for Script Editor.\n");
    const lastReady = new Set<string>();
    const declined = new Set<string>();
    const offered = new Set<string>();
    let notifyWarned = false;
    let first = true;
    let failedInARow = 0;
    let badStarts = 0;
    /** Starts one ticket with a fresh fetch and a fresh worktree check, and prints one line. */
    const startOne = async (key: string): Promise<void> => {
      const shown = printableText(key);
      const notStarted = () => io.stdout(`${shown}  not started, because you stopped the watch.\n`);
      const failed = (why: string) => {
        badStarts++;
        io.stdout(`${shown}  failed, ${printableText(why)}.\n`);
      };
      try {
        // WHY: each start runs exactly one `git fetch origin`. The git way fetches inside prepareGitStart.
        let start: Starter;
        if (orca) {
          await fetchOrigin(deps.run, root);
          start = startInOrca(deps.runLong, deps.env, root);
        } else {
          start = await prepareGitStart(deps.run, root);
        }
        const check = await loadWorktreeCheck({ run: deps.run, env: deps.env, root, tracker: name, orca });
        const report = await startTicket(key, { reader: reader!, check, start, run: deps.run, root, tracker: name, signal: stop });
        if (stop.aborted && report.kind !== "started" && report.kind !== "skipped") {
          badStarts++;
          io.stdout(`${shown}  the outcome is unknown, because Control-C also stopped the program that was starting it. Check ${shown} by hand.\n`);
          return;
        }
        io.stdout(report.line);
        if (report.kind === "failed" || report.kind === "unknown") badStarts++;
      } catch (error) {
        if (stop.aborted && (error instanceof WaveError || error instanceof TrackerError || (error as Error)?.name === "AbortError")) {
          notStarted();
        } else if (error instanceof WaveError && error.message === FETCH_FAILED) {
          failed("`git fetch origin` failed");
        } else if (error instanceof WaveError || error instanceof TrackerError) {
          failed(error.message);
        } else {
          throw error;
        }
      }
    };
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
      const time = watch.now();
      const hhmm = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
      io.stdout(
        `${hhmm}  ${groups.ready.length} ready, ${groups.blocked.length} blocked, ${groups.started.length} already started, ${groups.finished} finished.\n`,
      );
      const readyKeys = groups.ready.map((t) => t.ticket.key);
      let toOffer: string[];
      if (first) {
        toOffer = [];
        if (readyKeys.length > 0) {
          const line = answers.next(stop);
          io.stdout(`\n\u0007${startAllQuestion(readyKeys.length)}`);
          const answer = await line;
          if (answer === undefined) break;
          for (const key of readyKeys) {
            offered.add(key);
            if (!isYes(answer)) declined.add(key);
          }
          if (isYes(answer)) {
            for (const key of readyKeys) {
              if (stop.aborted) break;
              await startOne(key);
            }
          }
        }
      } else {
        toOffer = readyKeys.filter((key) => !lastReady.has(key) && !declined.has(key));
      }
      first = false;
      for (const key of toOffer) {
        if (!(await notifyReady(deps.run, key)) && !notifyWarned) {
          notifyWarned = true;
          io.stderr("cstack: the macOS notification failed, so the watch asks in this terminal only.\n");
        }
        const line = answers.next(stop);
        io.stdout(`\n\u0007Start ${printableText(key)} now? [y/N] `);
        const answer = await line;
        if (answer === undefined) break;
        offered.add(key);
        if (!isYes(answer)) {
          declined.add(key);
          io.stdout(`\nNot started. The watch will not ask about ${printableText(key)} again.\n`);
        } else {
          io.stdout("\n");
          await startOne(key);
        }
        if (stop.aborted) break;
      }
      lastReady.clear();
      for (const key of readyKeys) lastReady.add(key);
      if (stop.aborted) break;
      if (groups.blocked.length === 0 && readyKeys.every((key) => offered.has(key))) {
        io.stdout("No ticket is blocked anymore and every ready ticket was offered, so the watch ended.\n");
        return badStarts > 0 ? EXIT.toolFailed : EXIT.ok;
      }
      await watch.sleep(Math.max(0, started + interval * 60_000 - watch.now().getTime()), stop);
    }
    io.stdout(interrupted.signal.aborted ? "\nStopped the watch.\n" : "\nStandard input closed, so the watch stopped.\n");
    return badStarts > 0 ? EXIT.toolFailed : EXIT.ok;
  } finally {
    removeInterrupt();
    answers.close();
  }
}
