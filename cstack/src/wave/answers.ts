import { createInterface } from "node:readline";

/** One reader of standard input for a whole watch. */
export interface Answers {
  /** Resolves the next line typed after this call, or `undefined` when the signal aborts or the input ended. */
  next(signal: AbortSignal): Promise<string | undefined>;
  close(): void;
}

export interface AnswersHooks {
  /** Called for a line that arrives while no `next()` waits. The line is dropped. */
  ignored(): void;
  /** Called once when the input ends by itself. */
  ended(): void;
}

/**
 * Opens one `readline` reader on `input`, without an output stream. So the terminal is never put in raw mode,
 * and Control-C still reaches the process as `SIGINT`. The caller must call `next()` before it prints the question,
 * in the same synchronous step, because the `line` event can fire inside a `write` call.
 */
export function openAnswers(input: NodeJS.ReadableStream, hooks: AnswersHooks): Answers {
  const reader = createInterface({ input });
  let waiting: ((line: string | undefined) => void) | undefined;
  let finished = false;

  reader.on("line", (line) => {
    if (waiting === undefined) {
      hooks.ignored();
      return;
    }
    const resolve = waiting;
    waiting = undefined;
    resolve(line);
  });
  reader.on("close", () => {
    const wasClosedByUs = finished;
    finished = true;
    const resolve = waiting;
    waiting = undefined;
    resolve?.(undefined);
    if (!wasClosedByUs) hooks.ended();
  });

  return {
    next(signal) {
      if (finished || signal.aborted) return Promise.resolve(undefined);
      return new Promise((resolve) => {
        const done = (line: string | undefined): void => {
          signal.removeEventListener("abort", onAbort);
          resolve(line);
        };
        const onAbort = (): void => {
          waiting = undefined;
          done(undefined);
        };
        signal.addEventListener("abort", onAbort, { once: true });
        waiting = done;
      });
    },
    close() {
      finished = true;
      reader.close();
    },
  };
}
