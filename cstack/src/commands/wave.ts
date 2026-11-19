import { parseArgs } from "node:util";
import type { Io } from "../io.js";
import { COMMANDS, commandWords, EXIT } from "../manifest.js";
import { orcaFeatures } from "../orca/features.js";
import { createRunner, type Runner } from "../orca/run.js";
import { readyState } from "../tracker/ready.js";
import { trackerFromRemote } from "../tracker/choose.js";
import { TrackerError } from "../tracker/errors.js";
import { openTracker, type openTracker as OpenTracker } from "../tracker/open.js";
import type { Group, TrackerName } from "../tracker/types.js";
import { isYes, readAnswer } from "../wave/confirm.js";
import { WaveError } from "../wave/errors.js";
import { blockedReason, formatGroups, groupTickets } from "../wave/groups.js";
import { shortName } from "../wave/names.js";
import { prepareGitStart } from "../wave/start-git.js";
import { startInOrca, type OrcaOutcome } from "../wave/start-orca.js";
import { printableText } from "../wave/title.js";
import { loadWorktreeCheck, parseWorktreeList } from "../wave/worktrees.js";

/** What `wave` needs from the outside. Tests give a fake tracker, a fake Orca and a scripted answer. */
export interface WaveDeps {
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Runs a program with the short timeout. */
  run: Runner;
  /** Runs a program with the long timeout, for `orca worktree create`. */
  runLong: Runner;
  isTerminal(): boolean;
  /** Reads one line from standard input. */
  readAnswer(): Promise<string>;
  openTracker: typeof OpenTracker;
}

/** The real dependencies of `wave`. */
export function defaultWaveDeps(): WaveDeps {
  return {
    cwd: process.cwd(),
    env: process.env,
    run: createRunner(120_000),
    runLong: createRunner(600_000),
    isTerminal: () => process.stdin.isTTY === true,
    readAnswer: () => readAnswer(process.stdin),
    openTracker,
  };
}

const TRACKERS: TrackerName[] = ["jira", "linear", "github", "gitlab"];
const usage = () => COMMANDS.find((e) => commandWords(e)[0] === "wave")!.usage;

export async function wave(args: string[], io: Io, deps: WaveDeps): Promise<number> {
  let values: { milestone?: string; epic?: string; tracker?: string; "from-file"?: string };
  try {
    ({ values } = parseArgs({
      args,
      options: {
        milestone: { type: "string" },
        epic: { type: "string" },
        tracker: { type: "string" },
        "from-file": { type: "string" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    io.stderr(`cstack: ${error instanceof Error ? error.message : String(error)}\nUsage: ${usage()}\n`);
    return EXIT.usage;
  }
  if ((values.milestone === undefined) === (values.epic === undefined)) {
    io.stderr(`cstack: give exactly one of --milestone and --epic.\nUsage: ${usage()}\n`);
    return EXIT.usage;
  }
  if (values.tracker !== undefined && !TRACKERS.includes(values.tracker as TrackerName)) {
    io.stderr(`cstack: --tracker takes ${TRACKERS.join(", ")}, not "${printableText(values.tracker)}".\nUsage: ${usage()}\n`);
    return EXIT.usage;
  }
  const group: Group = values.milestone !== undefined ? { milestone: values.milestone } : { epic: values.epic! };

  try {
    const listing = await deps.run("git", ["worktree", "list", "--porcelain"], deps.cwd);
    if (listing.kind !== "ok") {
      throw new WaveError("cstack cannot read `git worktree list`. Run it inside a git clone.", EXIT.refused);
    }
    const main = parseWorktreeList(listing.stdout)[0];
    if (main === undefined) throw new WaveError("`git worktree list` gave no worktree.", EXIT.refused);
    if (main.bare) {
      throw new WaveError("The main entry of this clone is a bare repository, so cstack cannot start worktrees from it.", EXIT.refused);
    }
    const root = main.path;

    let name = values.tracker as TrackerName | undefined;
    if (name === undefined) {
      const origin = await deps.run("git", ["remote", "get-url", "origin"], root);
      if (origin.kind === "ok") name = trackerFromRemote(origin.stdout);
    }
    const trackerOptions = {
      root,
      tracker: name,
      fromFile: values["from-file"],
      run: deps.run,
      env: deps.env,
      warn: (message: string) => io.stderr(`${printableText(message)}\n`),
    };
    const tracker = await deps.openTracker("list", trackerOptions);
    const tickets = await tracker.listGroup(group);
    const orca = (await orcaFeatures(deps.run, deps.env).get("ticket-worktrees")).available;
    const checkArgs = { run: deps.run, env: deps.env, root, tracker: name!, orca };
    const check = await loadWorktreeCheck(checkArgs);
    const groups = await groupTickets(tickets, check);
    io.stdout(formatGroups(groups));

    if (groups.ready.length === 0) return EXIT.ok;
    if (!deps.isTerminal()) {
      io.stdout("\nStarting tickets needs a terminal, so cstack started nothing.\n");
      return EXIT.ok;
    }
    const n = groups.ready.length;
    io.stdout(`\nStart the ${n} ready ${n === 1 ? "ticket" : "tickets"}? [y/N] `);
    if (!isYes(await deps.readAnswer())) {
      io.stdout("\nStarted nothing.\n");
      return EXIT.ok;
    }
    io.stdout("\n");

    const reader = await deps.openTracker("read", trackerOptions);
    const fresh = await loadWorktreeCheck(checkArgs);
    const start: (key: string, short: string, url: string) => Promise<OrcaOutcome> = orca
      ? startInOrca(deps.runLong, deps.env, root)
      : await prepareGitStart(deps.run, root);
    let failures = 0;
    for (const { ticket: listed } of groups.ready) {
      const key = printableText(listed.key);
      const ticket = await reader.readTicket(listed.key);
      if (ticket.key !== listed.key) {
        io.stdout(`${key}  skipped, the tracker answered with the ticket ${printableText(ticket.key)} instead.\n`);
        continue;
      }
      const found = ticket.stateKind === "todo" ? await fresh.check(ticket) : { found: false as const };
      const state = readyState(ticket, found.found);
      if (state.kind !== "ready") {
        let why: string;
        if (state.kind === "blocked") why = blockedReason(ticket, state);
        else if (state.kind === "started") why = found.found ? found.reason : "in progress";
        else why = "done";
        io.stdout(`${key}  skipped, it is no longer ready (${why}).\n`);
        continue;
      }
      const short = shortName(name!, ticket.key);
      const branch = await deps.run("git", ["show-ref", "--verify", "--quiet", `refs/heads/${short}`], root);
      if (branch.kind === "ok") {
        io.stdout(`${key}  skipped, the branch ${short} already exists.\n`);
        continue;
      }
      const outcome = await start(ticket.key, short, ticket.url);
      if (outcome.kind === "started") io.stdout(`${key}  ${printableText(outcome.line)}\n`);
      else if (outcome.kind === "skipped") io.stdout(`${key}  skipped, ${printableText(outcome.reason)}.\n`);
      else if (outcome.kind === "unknown") {
        failures++;
        io.stdout(`${key}  ${printableText(outcome.reason)}\n`);
      } else {
        failures++;
        io.stdout(`${key}  failed, ${printableText(outcome.reason)}.\n`);
      }
    }
    return failures > 0 ? EXIT.toolFailed : EXIT.ok;
  } catch (error) {
    if (error instanceof WaveError || error instanceof TrackerError) {
      io.stderr(`cstack: ${printableText(error.message)}\n`);
      return error.exitCode;
    }
    throw error;
  }
}
