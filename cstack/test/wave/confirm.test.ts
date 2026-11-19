import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { wave, type WaveDeps } from "../../src/commands/wave.js";
import { readAnswer } from "../../src/wave/confirm.js";
import { checkedTracker } from "../../src/tracker/checked.js";
import { FakeTracker } from "../fakes/tracker.js";
import { collect } from "../helpers/plan-repo.js";
import { makeClone, makeRunner, orcaAnswers, ticket } from "../helpers/wave.js";

describe("readAnswer", () => {
  it("resolves the first line and leaves no listener on the stream", async () => {
    const input = new PassThrough();
    const answer = readAnswer(input);
    input.write("n\n");
    expect(await answer).toBe("n");
    expect(input.listenerCount("data")).toBe(0);
    expect(input.listenerCount("end")).toBe(0);
  });

  it("resolves an empty answer when the stream ends without a line", async () => {
    const input = new PassThrough();
    const answer = readAnswer(input);
    input.end();
    expect(await answer).toBe("");
    expect(input.listenerCount("data")).toBe(0);
    expect(input.listenerCount("end")).toBe(0);
  });
});

function setup(options: { answer?: string; terminal?: boolean; orca?: boolean; onAsk?: (fake: FakeTracker) => void } = {}) {
  const clone = makeClone();
  const recorded = makeRunner(options.orca ? orcaAnswers() : {});
  const { out, io } = collect();
  const tickets = [ticket("ABC-12")];
  const fake = new FakeTracker({ tickets, groups: [{ group: { milestone: "M3" }, keys: ["ABC-12"] }] });
  let asked = 0;
  const deps: WaveDeps = {
    cwd: clone.root,
    env: {},
    run: recorded.run,
    runLong: recorded.run,
    isTerminal: () => options.terminal ?? true,
    readAnswer: async () => {
      asked++;
      options.onAsk?.(fake);
      return options.answer ?? "y";
    },
    openTracker: async (_c, o) => checkedTracker(fake, o.tracker ?? "jira", o.warn),
  };
  const started = () =>
    recorded.calls.filter(
      (c) => (c.command === "git" && c.args.includes("add") && c.args[0] !== "show-ref" && c.args.includes("worktree")) ||
        (c.command !== "git" && c.args.slice(0, 2).join(" ") === "worktree create"),
    );
  const folder = join(dirname(clone.root), `${basename(clone.root)}-worktrees`, "abc-12");
  return { out, io, deps, started, asked: () => asked, folder };
}

const args = ["--milestone", "M3", "--tracker", "jira"];

describe("cstack wave never starts a ticket without a yes", () => {
  for (const orca of [false, true]) {
    for (const answer of ["n", "", "maybe"]) {
      it(`starts nothing on the answer ${JSON.stringify(answer)} (orca ${orca})`, async () => {
        const { out, io, deps, started, folder } = setup({ answer, orca });
        expect(await wave(args, io, deps)).toBe(0);
        expect(started()).toEqual([]);
        expect(existsSync(folder)).toBe(false);
        expect(out.stdout).toContain("Started nothing.");
      });
    }
  }

  it("starts nothing and asks nothing without a terminal", async () => {
    const { out, io, deps, started, asked } = setup({ terminal: false });
    expect(await wave(args, io, deps)).toBe(0);
    expect(asked()).toBe(0);
    expect(started()).toEqual([]);
    expect(out.stdout).toContain("needs a terminal");
  });

  it("skips a ticket that became blocked between the list and the yes, and says why", async () => {
    const { out, io, deps, started, folder } = setup({
      onAsk: (fake) => {
        fake.tickets.set("ABC-12", ticket("ABC-12", { blockers: [{ key: "ABC-1", stateKind: "todo" }] }));
      },
    });
    expect(await wave(args, io, deps)).toBe(0);
    expect(started()).toEqual([]);
    expect(existsSync(folder)).toBe(false);
    expect(out.stdout).toContain("ABC-12  skipped, it is no longer ready.");
  });
});
