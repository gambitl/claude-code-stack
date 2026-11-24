/** The single list of cstack commands. Every other file refers to it. */

export const EXIT = {
  /** The command did its job. */
  ok: 0,
  /** Refused: a rule that cstack enforces said no. A crash also exits with 1. */
  refused: 1,
  /** Usage error: the command line is wrong. */
  usage: 2,
  /** Invalid input: the plan file, the settings file or the run state cannot be used. */
  invalidInput: 3,
  /** Missing tool: a tool that the command needs is not installed or not logged in. */
  missingTool: 4,
  /** A tool that cstack ran failed for a reason outside cstack's rules. */
  toolFailed: 5,
} as const;

export interface CommandEntry {
  /** The usage line, starting with `cstack`. */
  usage: string;
  summary: string;
  /** The flags in long form. */
  flags: string[];
  /** Exit codes with their meaning. */
  exitCodes: Record<number, string>;
  /** The file under `cstack/src/commands/` that implements the command. */
  file: string;
  /** The ticket, or the tickets, that build the command. */
  ticket: number | number[];
  built: boolean;
  /** Flags of a built command that are not built yet, with the ticket that builds each. */
  notBuiltFlags?: Record<string, number | number[]>;
}

const OK = "The command did its job.";
const REFUSED = "Refused: a rule said no, and the message names it.";
const USAGE = "Usage error: the command line is wrong.";
const INVALID = "Invalid input: the plan file, the settings file or the run state cannot be used.";
const NO_TOOL = "Missing tool: a tool that the command needs is not installed or not logged in.";
const TOOL_FAILED = "A tool that cstack ran failed.";
const PLAN = "--plan";

function planCommand(
  entry: Omit<CommandEntry, "flags" | "built"> & { flags?: string[]; built?: boolean },
): CommandEntry {
  return { ...entry, flags: [...(entry.flags ?? []), PLAN], built: entry.built ?? false };
}

export const COMMANDS: CommandEntry[] = [
  {
    usage: "cstack doctor",
    summary: "Check that the machine has what cstack needs.",
    flags: [],
    exitCodes: { 0: "Every required item is present.", 1: "A required item is missing.", 2: USAGE },
    file: "doctor.ts",
    ticket: 10,
    built: true,
  },
  {
    usage: "cstack guide <phase> [--skill <name>]",
    summary: "Print a phase guide of the installed version.",
    flags: ["--skill"],
    exitCodes: { 0: OK, 1: "The skill or the phase is unknown.", 2: USAGE, 3: "A guide opens a block of mandatory steps that never closes." },
    file: "guide.ts",
    ticket: 9,
    built: true,
  },
  {
    usage: "cstack measure <plan file> [--home <folder>]",
    summary: "Print the tokens and the waiting time of one run.",
    flags: ["--home"],
    exitCodes: { 0: OK, 1: "The plan file cannot be used, a moment is missing or the numbers are incomplete.", 2: USAGE },
    file: "measure.ts",
    ticket: 11,
    built: true,
  },
  {
    usage: "cstack audit <plan file> [--home <folder>] [--guides <folder>]",
    summary: "Say which phases, required commands and helper checks of one run were done, skipped or done out of order.",
    flags: ["--home", "--guides"],
    exitCodes: {
      0: "Every phase that is over, with its required commands and helper checks, was done.",
      1: "A phase that is over, one of its commands or one of its helper checks was skipped or done out of order, a session file could not be read, no session file holds the close of the ticket phase, or the run needs the guides of another version.",
      2: USAGE,
      3: "The plan file, the run state, a guide, the settings file or the session files cannot be used.",
      5: "git cannot list the worktrees of the repository.",
    },
    file: "audit.ts",
    ticket: 89,
    built: true,
  },
  {
    usage: "cstack skills install [--adopt <name>]... [--add-permission]",
    summary: "Install the skills that this version ships.",
    flags: ["--adopt", "--add-permission"],
    exitCodes: {
      0: "Every shipped skill is in place.",
      1: "A skill was skipped, the user is root or a backup copy already exists.",
      2: USAGE,
      3: "The settings file cannot be edited, so nothing was changed.",
    },
    file: "skills.ts",
    ticket: 9,
    built: true,
  },
  planCommand({
    usage: "cstack next [--done <phase>] [--phase <phase>] [--plan <file>] [--new]",
    summary: "Print the guide of the next phase and record that it started.",
    flags: ["--done", "--phase", "--new"],
    exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID },
    file: "next.ts",
    ticket: 15,
    built: true,
  }),
  planCommand({
    usage: "cstack plan status [--plan <file>] [--json]",
    summary: "Print the status of each unit, taken from the commits.",
    flags: ["--json"],
    exitCodes: { 0: OK, 1: "Git and the plan disagree: a commit names a unit that the plan does not have, or a unit commit changes a file outside its Files.", 2: USAGE, 3: INVALID },
    file: "plan-status.ts",
    ticket: 16,
    built: true,
  }),
  planCommand({
    usage: "cstack plan section <name> [--plan <file>]",
    summary: "Print exactly one section of the plan file.",
    exitCodes: { 0: OK, 2: "No heading matches the name.", 3: "Two headings match, or the plan file is invalid." },
    file: "plan-section.ts",
    ticket: 16,
    built: true,
  }),
  planCommand({
    usage: "cstack report submit <kind> [--plan <file>]",
    summary: "Check and save the report of the executor.",
    exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID },
    file: "report-submit.ts",
    ticket: 16,
    built: true,
  }),
  {
    ...planCommand({
      usage: "cstack unit order [--json]",
      summary: "Print the units in batches that can run in parallel.",
      flags: ["--json"],
      exitCodes: { 0: OK, 1: "The Depends on lines form a cycle.", 2: USAGE, 3: INVALID },
      file: "unit-order.ts",
      ticket: 18,
    }),
    built: true,
  },
  planCommand({
    built: true,
    usage: "cstack unit red <n> [--timeout <minutes>]",
    summary: "Run the test of a unit, require a failure and save the run.",
    flags: ["--timeout"],
    exitCodes: {
      0: OK,
      1: "The test passes, the unit has no test, its test file cannot be used, or a file of the unit that is not a test changed before the run.",
      2: USAGE,
      3: INVALID,
      5: "The test command cannot start, runs past the timeout, or git cannot read the status of the unit's files.",
    },
    file: "unit-red.ts",
    ticket: 17,
  }),
  planCommand({
    built: true,
    usage: "cstack unit green <n> [--timeout <minutes>]",
    summary: "Run the test of a unit, require success and save the run.",
    flags: ["--timeout"],
    exitCodes: {
      0: OK,
      1: "No failing run is saved, the test command changed since it, a changed code file is older than the latest failing run, or the test still fails.",
      2: USAGE,
      3: INVALID,
      5: "The test command cannot start, runs past the timeout, or git cannot read the status of the unit's files.",
    },
    file: "unit-green.ts",
    ticket: 17,
  }),
  {
    ...planCommand({
      usage: "cstack unit commit <n> [--message <subject>]",
      flags: ["--message"],
      summary: "Commit the files of a unit with its message and trailer.",
      exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID, 5: "git commit failed, for example because of a commit hook." },
      file: "unit-commit.ts",
      ticket: 18,
    }),
    built: true,
  },
  planCommand({
    usage: "cstack publish [--timeout <minutes>] [--poll <seconds>] [--grace <seconds>]",
    summary: "Push once, open the pull request and wait for its checks.",
    flags: ["--timeout", "--poll", "--grace"],
    exitCodes: {
      0: OK,
      1: "Refused before any push.",
      2: USAGE,
      3: INVALID,
      4: NO_TOOL,
      5: TOOL_FAILED,
      6: "A check failed on the pushed commit.",
      7: "Checks still run at the timeout.",
      8: "The update onto the target branch conflicts. The branch was put back as it was.",
    },
    file: "publish.ts",
    ticket: 20,
    built: true,
  }),
  {
    usage: "cstack tracker read <key> [--tracker <name>] [--from-file <path>]",
    summary: "Print one ticket as JSON.",
    flags: ["--tracker", "--from-file"],
    exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID, 4: NO_TOOL, 5: TOOL_FAILED },
    file: "tracker-read.ts",
    ticket: [25, 26],
    built: true,
  },
  {
    usage: "cstack tracker list (--milestone <name> | --epic <key>) [--ready] [--tracker <name>] [--from-file <path>]",
    summary: "Print the tickets of a group with their states and blockers.",
    flags: ["--milestone", "--epic", "--ready", "--tracker", "--from-file"],
    exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID, 4: NO_TOOL, 5: TOOL_FAILED },
    file: "tracker-list.ts",
    ticket: [25, 26],
    built: true,
  },
  {
    usage: "cstack tracker move <key> --to <state name> [--tracker <name>]",
    summary: "Move a ticket to a state.",
    flags: ["--to", "--tracker"],
    exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID, 4: NO_TOOL, 5: TOOL_FAILED },
    file: "tracker-move.ts",
    ticket: [25, 26],
    built: true,
  },
  {
    usage: "cstack tracker comment <key> --body-file <path> [--tracker <name>]",
    summary: "Add a comment to a ticket.",
    flags: ["--body-file", "--tracker"],
    exitCodes: { 0: OK, 1: REFUSED, 2: USAGE, 3: INVALID, 4: NO_TOOL, 5: TOOL_FAILED },
    file: "tracker-comment.ts",
    ticket: [25, 26],
    built: true,
  },
];

/** The command words of an entry: its usage words, without `cstack`, before the first `<`, `[` or `(`. */
export function commandWords(entry: CommandEntry): string[] {
  const words: string[] = [];
  for (const token of entry.usage.split(/\s+/).slice(1)) {
    if (token.startsWith("<") || token.startsWith("[") || token.startsWith("(") || token.startsWith("-")) break;
    words.push(token);
  }
  return words;
}

export type MentionMatch =
  | { ok: true; entry: CommandEntry }
  | { ok: false; reason: string };

/**
 * Match what follows `cstack ` in a mention, for example `unit red 3 --timeout 5`.
 * The words are the tokens before the first token that starts with `-`.
 * The flags are the tokens that start with `-`, cut at the first `=`.
 */
export function matchMention(text: string, entries: CommandEntry[] = COMMANDS): MentionMatch {
  const tokens = text.trim().split(/\s+/).filter((t) => t !== "");
  const firstFlag = tokens.findIndex((t) => t.startsWith("-"));
  const words = firstFlag === -1 ? tokens : tokens.slice(0, firstFlag);
  const flags = tokens.filter((t) => t.startsWith("-")).map((t) => t.split("=")[0]);

  let best: CommandEntry | undefined;
  let bestLength = 0;
  for (const entry of entries) {
    const fixed = commandWords(entry);
    if (fixed.length > words.length || fixed.length <= bestLength) continue;
    if (fixed.every((w, i) => words[i] === w)) {
      best = entry;
      bestLength = fixed.length;
    }
  }
  if (best === undefined) return { ok: false, reason: `no command starts with "cstack ${words.join(" ")}"` };
  for (const flag of flags) {
    if (!best.flags.includes(flag)) {
      return { ok: false, reason: `"${flag}" is not a flag of "cstack ${commandWords(best).join(" ")}"` };
    }
  }
  return { ok: true, entry: best };
}

/** The tickets as a phrase and the verb that agrees with them, for example `Tickets #25 and #26 build it.` */
function builtBy(tickets: number[]): string {
  const unique = [...new Set(tickets)].sort((a, b) => a - b).map((n) => `#${n}`);
  if (unique.length === 1) return `Ticket ${unique[0]} builds it.`;
  const last = unique[unique.length - 1];
  return `Tickets ${unique.slice(0, -1).join(", ")} and ${last} build it.`;
}

/**
 * The message that refuses a command or a flag that the list holds but that is not built.
 * It names every ticket that builds it. It is undefined when the arguments are built.
 */
export function unbuiltRefusal(args: string[], entries: CommandEntry[] = COMMANDS): string | undefined {
  const firstFlag = args.findIndex((t) => t.startsWith("-"));
  const words = firstFlag === -1 ? args : args.slice(0, firstFlag);
  let best: CommandEntry | undefined;
  let bestLength = 0;
  for (const entry of entries) {
    const fixed = commandWords(entry);
    if (fixed.length > words.length || fixed.length <= bestLength) continue;
    if (fixed.every((w, i) => words[i] === w)) {
      best = entry;
      bestLength = fixed.length;
    }
  }
  if (best === undefined) {
    // No entry matches fully. When the first word belongs only to unbuilt entries, name all their tickets.
    const group = words.length === 0 ? [] : entries.filter((e) => commandWords(e)[0] === words[0]);
    if (group.length === 0 || group.some((e) => e.built)) return undefined;
    const tickets = group.flatMap((e) => [e.ticket, ...Object.values(e.notBuiltFlags ?? {})].flat());
    return `cstack ${words[0]} is not built in this version yet. ${builtBy(tickets)}`;
  }
  const name = `cstack ${commandWords(best).join(" ")}`;
  if (!best.built) return `${name} is not built in this version yet. ${builtBy([best.ticket].flat())}`;
  for (const arg of args.filter((t) => t.startsWith("-")).map((t) => t.split("=")[0])) {
    const ticket = best.notBuiltFlags?.[arg];
    if (ticket !== undefined) return `${arg} of ${name} is not built in this version yet. ${builtBy([ticket].flat())}`;
  }
  return undefined;
}
