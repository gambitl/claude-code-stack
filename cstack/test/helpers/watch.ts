import { PassThrough } from "node:stream";
import type { WaveDeps } from "../../src/commands/wave.js";
import type { WatchDeps } from "../../src/wave/watch.js";
import { openTracker } from "../../src/tracker/open.js";
import { checkedTracker } from "../../src/tracker/checked.js";
import { FakeTracker } from "../fakes/tracker.js";
import { collect } from "./plan-repo.js";
import { makeClone, makeRunner, orcaAnswers } from "./wave.js";

export interface WatchSetupOptions {
  terminal?: boolean;
  orca?: boolean;
  /** Use the real `openTracker` instead of the fake tracker. */
  realTracker?: boolean;
  tickets?: Parameters<typeof FakeTracker.prototype.tickets.set>[1][];
  keys?: string[];
  group?: { milestone: string };
}

/** Builds the clone, the recorded runner, the fake tracker, the fake clock, the fake Control-C hook and the input of a watch test. */
export function watchSetup(options: WatchSetupOptions = {}) {
  const clone = makeClone();
  const recorded = makeRunner(options.orca ? orcaAnswers() : {});
  const { out, io } = collect();
  const fake = new FakeTracker({
    tickets: options.tickets ?? [],
    groups: [{ group: options.group ?? { milestone: "M3" }, keys: options.keys ?? [] }],
  });
  const input = new PassThrough();
  let time = Date.parse("2026-11-19T14:00:00");
  const sleeps: number[] = [];
  const interrupts = new Set<() => void>();
  const watch: WatchDeps = {
    now: () => new Date(time),
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
    onInterrupt: (listener) => {
      interrupts.add(listener);
      return () => void interrupts.delete(listener);
    },
    input: () => input,
  };
  const deps: WaveDeps = {
    cwd: clone.root,
    env: {},
    run: recorded.run,
    runLong: recorded.run,
    isTerminal: () => options.terminal ?? true,
    readAnswer: async () => {
      throw new Error("The watch must not use readAnswer.");
    },
    openTracker: options.realTracker
      ? openTracker
      : async (_c, o) => checkedTracker(fake, o.tracker ?? "jira", o.warn),
  };
  return { clone, recorded, out, io, fake, input, watch, deps, sleeps, interrupts, interrupt: () => [...interrupts].forEach((l) => l()) };
}
