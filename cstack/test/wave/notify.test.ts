import { describe, expect, it } from "vitest";
import type { RunResult, Runner } from "../../src/orca/run.js";
import { notifyReady } from "../../src/wave/notify.js";

function recorder(answer: RunResult) {
  const calls: { command: string; args: string[] }[] = [];
  const run: Runner = async (command, args) => {
    calls.push({ command, args });
    return answer;
  };
  return { run, calls };
}

describe("notifyReady", () => {
  it("runs osascript once with fixed script lines and the key as an argument", async () => {
    const { run, calls } = recorder({ kind: "ok", stdout: "" });
    expect(await notifyReady(run, "#31")).toBe(true);
    expect(calls).toEqual([
      {
        command: "/usr/bin/osascript",
        args: [
          "-e",
          "on run argv",
          "-e",
          'display notification (item 1 of argv) with title "cstack"',
          "-e",
          "end run",
          "Ticket #31 is ready. Answer in the cstack terminal.",
        ],
      },
    ]);
  });

  it.each<RunResult>([{ kind: "missing" }, { kind: "failed", exitCode: 1 }, { kind: "timeout" }])(
    "returns false for $kind",
    async (answer) => {
      expect(await notifyReady(recorder(answer).run, "#31")).toBe(false);
    },
  );
});
