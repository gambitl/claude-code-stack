import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRunner } from "../../src/orca/run.js";
import type { Runner } from "../../src/orca/run.js";
import type { Ticket } from "../../src/tracker/types.js";
import { git } from "./plan-repo.js";

export function ticket(key: string, extra: Partial<Ticket> = {}): Ticket {
  const number = key.replace(/\D/g, "");
  return {
    key,
    title: `Title of ${key}`,
    body: "",
    url: `https://github.com/example/repo/issues/${number}`,
    stateName: "Todo",
    stateKind: "todo",
    blockers: [],
    ...extra,
  };
}

/** A clone of a bare local origin, so that origin/HEAD exists and nothing reaches the network. */
export function makeClone(): { root: string; origin: string } {
  const base = mkdtempSync(join(tmpdir(), "cstack-wave-"));
  const origin = join(base, "origin.git");
  const seed = join(base, "seed");
  const root = join(base, "repo");
  execFileSync("git", ["init", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", origin, seed], { stdio: "ignore" });
  git(seed, "checkout", "-b", "main");
  execFileSync("git", ["-C", seed, "commit", "--allow-empty", "-m", "chore: start", "--author=t <t@example.com>"], {
    env: { ...process.env, GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
    stdio: "ignore",
  });
  git(seed, "push", "origin", "main");
  execFileSync("git", ["clone", origin, root], { stdio: "ignore" });
  git(root, "remote", "set-head", "origin", "--auto");
  return { root, origin };
}

export function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, "..", "fixtures", "orca", "1.4.263", name), "utf8");
}

/** Runs git for real and answers Orca from recorded files. It records every call. */
export function makeRunner(orca: Record<string, string> = {}) {
  const calls: { command: string; args: string[] }[] = [];
  const real = createRunner(120_000);
  const run: Runner = async (command, args, cwd) => {
    calls.push({ command, args });
    if (command === "git") return real(command, args, cwd);
    const key = args.slice(0, 2).join(" ");
    const answer = orca[key];
    return answer === undefined ? { kind: "missing" } : { kind: "ok", stdout: answer };
  };
  return { run, calls };
}

/** Recorded answers that make Orca count as running, at 1.4.263, with `worktree create` and `reference find`. */
export function orcaAnswers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "--version": fixture("version.current.txt"),
    "status --json": fixture("status.running.json"),
    "agent-context --json": fixture("agent-context.current.json"),
    "reference find": fixture("reference-find.none.json"),
    "worktree create": fixture("worktree-create.started.json"),
    ...extra,
  };
}
