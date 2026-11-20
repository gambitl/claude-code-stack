import { realpathSync } from "node:fs";
import { readPlan } from "./read.js";

const WORKTREE_LINE = /^- Worktree:/;
const ANY_FIELD = /^- (?:Files|Test|No test|Minimum code|Refactor|Commit message|Depends on|Design specification|Blocked|Worktree):/;

// Returns the 0-based line index range [start, end) of the body of one unit.
function unitRanges(text: string): Array<{ number: number; start: number; end: number }> {
  const plan = readPlan(text);
  const total = text.split("\n").length;
  return plan.units.map((unit) => {
    const next = plan.headings.find((heading) => heading.line > unit.line);
    return { number: unit.number, start: unit.line, end: next ? next.line - 1 : total };
  });
}

// Writes `- Worktree: <path>` as the last unit line of one unit. Every other byte stays the same.
export function setUnitWorktree(text: string, unit: number, path: string): string {
  const range = unitRanges(text).find((candidate) => candidate.number === unit);
  if (!range) throw new Error(`The plan has no unit ${unit}.`);
  const lines = text.split("\n");
  const ending = (line: string) => (line.endsWith("\r") ? "\r" : "");

  let last = -1;
  let existing = -1;
  for (let index = range.start; index < range.end; index++) {
    const line = lines[index];
    if (!ANY_FIELD.test(line)) continue;
    last = index;
    if (WORKTREE_LINE.test(line)) existing = index;
    while (index + 1 < range.end && lines[index + 1].startsWith("  ") && lines[index + 1].trim() !== "") index++;
    if (existing === last) last = index;
  }
  if (existing >= 0) {
    lines[existing] = `- Worktree: ${path}${ending(lines[existing])}`;
    return lines.join("\n");
  }
  if (last < 0) throw new Error(`Unit ${unit} has no unit lines.`);
  lines.splice(last + 1, 0, `- Worktree: ${path}${ending(lines[last])}`);
  return lines.join("\n");
}

// Returns the plan text without the `- Worktree:` lines of its units.
export function withoutWorktreeLines(text: string): string {
  const drop = new Set<number>();
  for (const range of unitRanges(text)) {
    const lines = text.split("\n");
    for (let index = range.start; index < range.end; index++) {
      if (WORKTREE_LINE.test(lines[index])) drop.add(index);
    }
  }
  return text.split("\n").filter((_, index) => !drop.has(index)).join("\n");
}

// Returns the path with `~/` in place of the home folder when the path is inside it.
// The home folder is checked as given and with symbolic links resolved.
export function worktreeValue(path: string, home: string): string {
  if (home === "" || home === "/") return path;
  let resolved = home;
  try {
    resolved = realpathSync(home);
  } catch {
    // The given form is the fallback.
  }
  for (const candidate of new Set([home, resolved])) {
    if (candidate === "" || candidate === "/") continue;
    const prefix = candidate.endsWith("/") ? candidate : `${candidate}/`;
    if (path.startsWith(prefix) && path.length > prefix.length) return `~/${path.slice(prefix.length)}`;
  }
  return path;
}

// Returns the warning line for a Worktree value that still holds a home folder path.
export function homePathWarning(unit: number, value: string): string | undefined {
  if (!/^\/(?:Users|home)\//.test(value)) return undefined;
  return `The Worktree line of unit ${unit} still starts with /Users/ or /home/, so the plan file holds a home folder path. Check HOME before you commit the plan file.\n`;
}
