import type { RunResult, Runner } from "../../src/orca/run.js";

// A runner that answers from a map keyed by args.join(" "), for example
// "jira issue EXA-1 --json". It records every call and throws on an unknown one.
export function fakeOrcaRun(answers: Record<string, RunResult>): {
  run: Runner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const run: Runner = async (_command, args) => {
    calls.push(args);
    const answer = answers[args.join(" ")];
    if (answer === undefined) {
      throw new Error(`The fake Orca runner has no answer for: ${args.join(" ")}`);
    }
    return answer;
  };
  return { run, calls };
}
