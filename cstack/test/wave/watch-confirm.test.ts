import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wave } from "../../src/commands/wave.js";
import { answerQuestion, watchSetup } from "../helpers/watch.js";
import { ticket } from "../helpers/wave.js";

const ARGS = ["--milestone", "M3", "--tracker", "jira", "--watch"];
const inProgress = { stateKind: "in-progress" } as const;
const done = { stateKind: "finished" } as const;
const q13 = "\u0007Start ABC-13 now? [y/N] ";
const IGNORED = "Ignored a line typed while no question was waiting.";

/** A watch whose ABC-13 is blocked at read 1 and ready at read 2. `onRead2` runs just before read 2 answers. */
function blockedThenReady(options: Parameters<typeof watchSetup>[0] = {}, onRead2: () => Promise<void> | void = () => {}) {
  const s = watchSetup({
    ...options,
    tickets: [ticket("ABC-13", { blockers: [{ key: "ABC-1", ...inProgress }] })],
    keys: ["ABC-13"],
  });
  let reads = 0;
  const original = s.fake.listGroup.bind(s.fake);
  s.fake.listGroup = async (group) => {
    reads++;
    if (reads === 2) {
      await onRead2();
      s.fake.tickets.set("ABC-13", ticket("ABC-13", { blockers: [{ key: "ABC-1", ...done }] }));
    }
    return original(group);
  };
  return s;
}

function startedNothing(s: ReturnType<typeof watchSetup>): void {
  const names = s.recorded.calls.map((c) => c.args.slice(0, 2).join(" "));
  expect(names).not.toContain("worktree add");
  expect(names).not.toContain("worktree create");
  expect(existsSync(`${s.clone.root}-worktrees/abc-13`)).toBe(false);
}

describe("cstack wave --watch never starts a ticket without a yes typed after its question", () => {
  it("ignores a y typed before the question and starts nothing", async () => {
    const s = blockedThenReady({}, async () => {
      s.input.write("y\n");
      await new Promise((r) => setTimeout(r, 30));
    });
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "n")]);
    expect(s.out.stdout).toContain(IGNORED);
    expect(s.out.stdout.indexOf(IGNORED)).toBeLessThan(s.out.stdout.indexOf(q13));
    expect(s.out.stdout).toContain("Not started.");
    startedNothing(s);
    expect(code).toBe(0);
  });

  for (const orca of [false, true]) {
    for (const answer of ["n", "", "maybe"]) {
      const way = orca ? "the Orca way" : "the git way";
      it(`starts nothing for the answer "${answer}" in the first round, in ${way}`, async () => {
        const s = watchSetup({ orca, tickets: [ticket("ABC-13")], keys: ["ABC-13"] });
        const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, "[y/N] ", answer)]);
        startedNothing(s);
        expect(s.out.stdout).not.toContain("/resolve-issue ABC-13'");
        expect(code).toBe(0);
      });
      it(`starts nothing for the answer "${answer}" in a later round, in ${way}`, async () => {
        const s = blockedThenReady({ orca });
        const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, answer)]);
        startedNothing(s);
        expect(s.out.stdout).not.toContain("/resolve-issue ABC-13'");
        expect(code).toBe(0);
      });
    }
  }

  it("stops on Control-C during a question and starts nothing", async () => {
    const s = blockedThenReady();
    const wait = (async () => {
      const until = Date.now() + 2000;
      while (!s.out.stdout.includes(q13) && Date.now() < until) await new Promise((r) => setTimeout(r, 2));
      s.interrupt();
    })();
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), wait]);
    expect(s.out.stdout).toContain("Stopped the watch.");
    startedNothing(s);
    expect(code).toBe(0);
  });

  it("starts nothing when standard input ends during a question", async () => {
    const s = blockedThenReady();
    const wait = (async () => {
      const until = Date.now() + 2000;
      while (!s.out.stdout.includes(q13) && Date.now() < until) await new Promise((r) => setTimeout(r, 2));
      s.input.end();
    })();
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), wait]);
    expect(s.out.stdout).toContain("Standard input closed");
    startedNothing(s);
    expect(code).toBe(0);
  });
});
