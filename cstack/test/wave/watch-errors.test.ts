import { describe, expect, it } from "vitest";
import { wave } from "../../src/commands/wave.js";
import { TrackerError } from "../../src/tracker/errors.js";
import { watchSetup } from "../helpers/watch.js";
import { ticket } from "../helpers/wave.js";

const ARGS = ["--milestone", "M3", "--tracker", "jira", "--watch"];

/** A blocked ticket, and a fake tracker whose nth read (counting from 1) runs `behave`. */
function setup(behave: (n: number, s: ReturnType<typeof watchSetup>) => void) {
  const s = watchSetup({
    tickets: [
      ticket("ABC-1", { stateName: "In Progress", stateKind: "in-progress" }),
      ticket("ABC-2", { blockers: [{ key: "ABC-1", stateKind: "in-progress" }] }),
    ],
    keys: ["ABC-2"],
  });
  let reads = 0;
  const original = s.fake.listGroup.bind(s.fake);
  s.fake.listGroup = async (group) => {
    reads++;
    behave(reads, s);
    return original(group);
  };
  return { s, reads: () => reads };
}

const down = () => {
  throw new TrackerError("the tracker did not answer", 5);
};

describe("cstack wave --watch after a failed read", () => {
  it("stops after three failed reads in a row with the exit code of the last error", async () => {
    const { s, reads } = setup((n) => {
      if (n >= 2 && n <= 4) down();
    });
    const code = await wave(ARGS, s.io, s.deps, s.watch);
    expect(code).toBe(5);
    expect(reads()).toBe(4);
    expect(s.out.stderr.match(/the tracker did not answer/g)).toHaveLength(3);
    expect(s.out.stderr).toContain("the watch stopped, because 3 reads in a row failed.");
    expect(s.out.stderr).toContain("(2 of 3 in a row)");
  });

  it("keeps going after one failure, a good read and two failures", async () => {
    const { s, reads } = setup((n) => {
      if (n === 1 || n === 3 || n === 4) down();
      if (n === 5) s.interrupt();
    });
    const code = await wave(ARGS, s.io, s.deps, s.watch);
    expect(code).toBe(0);
    expect(reads()).toBe(5);
    expect(s.out.stdout).toContain("Stopped the watch.");
  });

  it("prints the groups in the first good round after a failed first read", async () => {
    const { s } = setup((n) => {
      if (n === 1) down();
      if (n === 3) s.interrupt();
    });
    await wave(ARGS, s.io, s.deps, s.watch);
    expect(s.out.stdout).toMatch(/^Blocked \(/m);
  });

  it("does not count a failure that comes after Control-C", async () => {
    const { s } = setup((n) => {
      if (n === 1) {
        s.interrupt();
        down();
      }
    });
    const code = await wave(ARGS, s.io, s.deps, s.watch);
    expect(code).toBe(0);
    expect(s.out.stdout).toContain("Stopped the watch.");
    expect(s.out.stderr).not.toContain("the tracker did not answer");
  });

  it("throws again an error that is not a wave or tracker error", async () => {
    const { s } = setup(() => {
      throw new Error("bug");
    });
    await expect(wave(ARGS, s.io, s.deps, s.watch)).rejects.toThrow("bug");
    expect(s.interrupts.size).toBe(0);
  });
});
