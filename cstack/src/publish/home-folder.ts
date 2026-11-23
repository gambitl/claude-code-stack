import { realpathSync } from "node:fs";
import type { ProgramResult } from "./program.js";
import { redact } from "./remote.js";

type Git = (args: string[], maxBuffer?: number) => ProgramResult;

const MAX_PLACES = 20;
const MAX_PATH = 80;
const MAX_BUFFER = 256 * 1024 * 1024;

/** The home folder as given, and its real path when that is another value. */
function homeForms(home: string | undefined): string[] {
  if (home === undefined) return [];
  const forms = [home];
  try {
    const real = realpathSync(home);
    if (real !== home) forms.push(real);
  } catch {
    // The folder does not exist, so only the given form is used.
  }
  return forms;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Control characters could move the cursor or hide text in a terminal.
const plain = (text: string) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "");

/** Builds the function that shows the home folder path of a text, or undefined when the text holds none. */
function matcher(forms: string[]): (text: string) => string | undefined {
  const sorted = [...forms].sort((a, b) => b.length - a.length);
  const find = new RegExp(`(?:${sorted.map(escape).join("|")})(?=/|$|[^A-Za-z0-9_.-]|\\.(?![A-Za-z0-9_-]))`, "g");
  const replace = new RegExp(sorted.map(escape).join("|"), "g");
  return (text) => {
    const first = [...text.matchAll(find)][0];
    if (first === undefined) return undefined;
    const rest = text.slice(first.index);
    const end = rest.search(/[ \t"'`<>]/);
    const path = end === -1 ? rest : rest.slice(0, end);
    const short = plain(path.replace(replace, "~"));
    return short.length > MAX_PATH ? `${short.slice(0, MAX_PATH)}…` : short;
  };
}

/** Replaces every form of the home folder by `~` and removes control characters. */
const hideHome = (forms: string[], text: string) =>
  plain(text.replace(new RegExp([...forms].sort((a, b) => b.length - a.length).map(escape).join("|"), "g"), "~"));

interface Place {
  where: string;
  shown: string;
}

/** Reads the added lines of a patch, with the file name and the line number of each. */
function addedLines(patch: string): { file: string; line: number; text: string }[] {
  const found: { file: string; line: number; text: string }[] = [];
  const lines = patch.split("\n");
  let file: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    if (text.startsWith("+++ ")) {
      file = text === "+++ /dev/null" ? undefined : text.replace(/^\+\+\+ "?b\//, "").replace(/"$/, "");
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text);
    if (!hunk) continue;
    let removed = hunk[1] === undefined ? 1 : Number(hunk[1]);
    let added = hunk[3] === undefined ? 1 : Number(hunk[3]);
    let line = Number(hunk[2]);
    while ((removed > 0 || added > 0) && i + 1 < lines.length) {
      const body = lines[++i];
      if (body.startsWith("\\")) continue;
      if (body.startsWith("-")) removed--;
      else if (body.startsWith("+")) {
        added--;
        if (file !== undefined) found.push({ file, line, text: body.slice(1) });
        line++;
      }
    }
  }
  return found;
}

/** Gives the refusals for a push that would make a path of the home folder public. The list is empty when the push is fine. */
export function homeFolderProblems(git: Git, home: string | undefined, target: string): string[] {
  // brokenRules() refuses a checked-out branch that differs from the plan, so HEAD names the branch.
  const branch = git(["symbolic-ref", "--short", "-q", "HEAD"]).stdout.trim();
  const forms = homeForms(home);
  if (forms.length === 0) return [];
  const verify = (ref: string) => git(["rev-parse", "--verify", "-q", "--end-of-options", `${ref}^{commit}`]).ok;
  const ref = [`refs/remotes/origin/${target}`, `refs/heads/${target}`].find(verify);
  if (ref === undefined) {
    return [
      `cstack cannot tell which commits the push would send, because neither \`origin/${target}\` nor \`${target}\` exists. Run \`git fetch origin ${target}\`, then run \`cstack publish\` again.`,
    ];
  }
  const log = git(
    [
      "-c", "core.quotePath=off", "log", "-p", "-U0", "--no-color", "--no-ext-diff", "--no-textconv", "--no-renames",
      "--no-show-signature", "--src-prefix=a/", "--dst-prefix=b/", "--format=%x00%h%x00%B%x00",
      "--end-of-options", "HEAD", `^${ref}`, ...(branch !== "" && verify(`refs/remotes/origin/${branch}`) ? [`^refs/remotes/origin/${branch}`] : []), "--",
    ],
    MAX_BUFFER,
  );
  const show = matcher(forms);
  if (!log.ok) {
    const reason = hideHome(forms, redact(log.stderr.split("\n")[0]));
    return [`cstack could not read the commits of the push to look for a path in your home folder: ${reason}.`];
  }
  const parts = log.stdout.split("\0");
  const commits: { id: string; message: string; patch: string }[] = [];
  for (let i = 1; i + 2 < parts.length; i += 3) commits.push({ id: parts[i], message: parts[i + 1], patch: parts[i + 2] });
  const places: Place[] = [];
  for (const { id, message, patch } of commits.reverse()) {
    const inMessage = show(message);
    if (inMessage !== undefined) places.push({ where: `the message of commit ${id}`, shown: inMessage });
    for (const added of addedLines(patch)) {
      const shown = show(added.text);
      if (shown !== undefined) places.push({ where: `\`${plain(added.file)}\` line ${added.line}, added by commit ${id}`, shown });
    }
  }
  if (places.length === 0) return [];
  const lines = places.slice(0, MAX_PLACES).map((p) => `  - ${p.where}: \`${p.shown}\``);
  if (places.length > MAX_PLACES) lines.push(`  - and ${places.length - MAX_PLACES} more places`);
  return [
    "These places hold a path in your home folder, which this push would make public. Remove the path from each place. A later commit that removes it is not enough, because the push still sends the commit that adds it, so rewrite that commit.\n" +
      lines.join("\n"),
  ];
}
