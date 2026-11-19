import { PassThrough } from "node:stream";
import { setImmediate as tick } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";
import { openAnswers } from "../../src/wave/answers.js";

function setup() {
  const input = new PassThrough();
  const ignored = vi.fn();
  const ended = vi.fn();
  const answers = openAnswers(input, { ignored, ended });
  return { input, ignored, ended, answers };
}

describe("openAnswers", () => {
  it("drops a line written before next() and does not give it to a later next()", async () => {
    const { input, ignored, answers } = setup();
    input.write("y\n");
    await tick();
    expect(ignored).toHaveBeenCalledTimes(1);
    const controller = new AbortController();
    const waiting = answers.next(controller.signal);
    controller.abort();
    expect(await waiting).toBeUndefined();
    answers.close();
  });

  it("resolves a line written after next()", async () => {
    const { input, ignored, answers } = setup();
    const waiting = answers.next(new AbortController().signal);
    input.write("yes\n");
    expect(await waiting).toBe("yes");
    expect(ignored).not.toHaveBeenCalled();
    answers.close();
  });

  it("resolves undefined when the signal aborts", async () => {
    const { answers } = setup();
    const controller = new AbortController();
    const waiting = answers.next(controller.signal);
    controller.abort();
    expect(await waiting).toBeUndefined();
    answers.close();
  });

  it("calls ended when the stream ends and resolves every later next() with undefined", async () => {
    const { input, ended, answers } = setup();
    const waiting = answers.next(new AbortController().signal);
    input.end();
    expect(await waiting).toBeUndefined();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(await answers.next(new AbortController().signal)).toBeUndefined();
  });

  it("leaves no data or end listener after close()", () => {
    const { input, answers } = setup();
    answers.close();
    expect(input.listenerCount("data")).toBe(0);
    expect(input.listenerCount("end")).toBe(0);
  });
});
