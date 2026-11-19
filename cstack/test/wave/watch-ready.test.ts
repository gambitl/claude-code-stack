import { describe, expect, it } from "vitest";
import { wave } from "../../src/commands/wave.js";
import { answerQuestion, watchSetup } from "../helpers/watch.js";
import { ticket } from "../helpers/wave.js";

const ARGS = ["--milestone", "M3", "--tracker", "jira", "--watch"];
const inProgress = { stateKind: "in-progress" } as const;
const done = { stateKind: "finished" } as const;

describe("cstack wave --watch offers each ticket that becomes ready", () => {
  it("notifies and asks once for each ticket, then ends on its own", async () => {
    const s = watchSetup({
      tickets: [
        ticket("ABC-13", { blockers: [{ key: "ABC-1", ...inProgress }] }),
        ticket("ABC-14", { blockers: [{ key: "ABC-2", ...inProgress }] }),
      ],
      keys: ["ABC-13", "ABC-14"],
    });
    let reads = 0;
    const original = s.fake.listGroup.bind(s.fake);
    s.fake.listGroup = async (group) => {
      reads++;
      if (reads === 2) s.fake.tickets.set("ABC-13", ticket("ABC-13", { blockers: [{ key: "ABC-1", ...done }] }));
      if (reads === 3) s.fake.tickets.set("ABC-14", ticket("ABC-14", { blockers: [{ key: "ABC-2", ...done }] }));
      return original(group);
    };
    const q13 = "\u0007Start ABC-13 now? [y/N] ";
    const q14 = "\u0007Start ABC-14 now? [y/N] ";
    const code = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "n"), answerQuestion(s, q14, "n")]).then(
      ([c]) => c,
    );
    const osascript = s.recorded.calls.filter((c) => c.command === "/usr/bin/osascript");
    expect(osascript.map((c) => c.args.at(-1))).toEqual([
      "Ticket ABC-13 is ready. Answer in the cstack terminal.",
      "Ticket ABC-14 is ready. Answer in the cstack terminal.",
    ]);
    expect(osascript[0]!.args.slice(0, 6)).toEqual([
      "-e",
      "on run argv",
      "-e",
      'display notification (item 1 of argv) with title "cstack"',
      "-e",
      "end run",
    ]);
    expect(s.out.stdout.split(q13)).toHaveLength(2);
    expect(s.out.stdout.split(q14)).toHaveLength(2);
    expect(s.out.stdout).toContain("Script Editor");
    expect(s.out.stderr.match(/notification failed/g)).toHaveLength(1);
    expect(reads).toBe(3);
    expect(code).toBe(0);
    expect(s.interrupts.size).toBe(0);
  });

  it("sends no notification and asks nothing when the blocker moves to in review", async () => {
    const s = watchSetup({
      tickets: [ticket("ABC-13", { blockers: [{ key: "ABC-1", stateKind: "todo" }] })],
      keys: ["ABC-13"],
    });
    let reads = 0;
    const original = s.fake.listGroup.bind(s.fake);
    s.fake.listGroup = async (group) => {
      reads++;
      // An "In Review" state has the kind in-progress, so the blocker is still not finished.
      if (reads === 2) s.fake.tickets.set("ABC-13", ticket("ABC-13", { blockers: [{ key: "ABC-1", ...inProgress }] }));
      if (reads === 3) s.interrupt();
      return original(group);
    };
    const code = await wave(ARGS, s.io, s.deps, s.watch);
    expect(reads).toBe(3);
    expect(s.recorded.calls.filter((c) => c.command === "/usr/bin/osascript")).toHaveLength(0);
    expect(s.out.stdout).not.toContain("[y/N]");
    expect(s.out.stdout).toContain("Stopped the watch.");
    expect(code).toBe(0);
  });

  it("never puts any part of the title in an argument or a question", async () => {
    const title = 'Fix the "quote" & do shell script "rm -rf ~"';
    const s = watchSetup({
      tickets: [ticket("ABC-13", { title, blockers: [{ key: "ABC-1", ...inProgress }] })],
      keys: ["ABC-13"],
    });
    let reads = 0;
    const original = s.fake.listGroup.bind(s.fake);
    s.fake.listGroup = async (group) => {
      reads++;
      if (reads === 2) s.fake.tickets.set("ABC-13", ticket("ABC-13", { title, blockers: [{ key: "ABC-1", ...done }] }));
      return original(group);
    };
    const q13 = "\u0007Start ABC-13 now? [y/N] ";
    const [code] = await Promise.all([wave(ARGS, s.io, s.deps, s.watch), answerQuestion(s, q13, "n")]);
    const osascript = s.recorded.calls.filter((c) => c.command === "/usr/bin/osascript");
    expect(osascript).toHaveLength(1);
    expect(osascript[0]!.args.at(-1)).toBe("Ticket ABC-13 is ready. Answer in the cstack terminal.");
    for (const call of s.recorded.calls) {
      for (const arg of call.args) {
        for (const part of ["do shell script", "rm -rf", '"quote"', "Fix the"]) expect(arg).not.toContain(part);
      }
    }
    const question = s.out.stdout.slice(s.out.stdout.indexOf(q13), s.out.stdout.indexOf(q13) + q13.length + 80);
    expect(question).not.toContain("do shell script");
    expect(code).toBe(0);
  });
});
