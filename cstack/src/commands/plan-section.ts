// WHY: prints exactly one section of a plan, using the headings that the reader found, so a heading inside a code block never matches.
import { readFileSync } from "node:fs";
import type { Io } from "../io.js";
import { locatePlan, PlanLocationError } from "../plan/locate.js";
import { PlanFormatError, readPlan, type PlanHeading } from "../plan/read.js";

const matches = (heading: PlanHeading, name: string): boolean =>
  heading.level > 1 &&
  (heading.text === name || [":", " (", " —"].some((end) => heading.text.startsWith(name + end)));

export async function planSection(args: string[], io: Io, options: { cwd: string }): Promise<number> {
  let planFlag: string | undefined;
  const words: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--plan") {
      planFlag = args[++i];
      if (planFlag === undefined) {
        io.stderr("The flag --plan needs a file.\n");
        return 2;
      }
    } else if (arg.startsWith("--plan=")) planFlag = arg.slice("--plan=".length);
    else if (arg.startsWith("--")) {
      io.stderr(`Unknown option ${arg}. Usage: cstack plan section <name> [--plan <file>]\n`);
      return 2;
    } else words.push(arg);
  }
  const name = words.join(" ");
  if (name === "") {
    io.stderr("Usage: cstack plan section <name> [--plan <file>]\n");
    return 2;
  }

  try {
    const located = locatePlan(options.cwd, planFlag);
    const text = readFileSync(located.path, "utf8");
    const plan = readPlan(text);
    const found = plan.headings.filter((heading) => matches(heading, name));
    const level2 = found.filter((heading) => heading.level === 2);
    const chosen = level2.length === 1 ? level2[0] : found.length === 1 ? found[0] : undefined;

    if (found.length === 0) {
      const list = plan.headings.filter((h) => h.level > 1).map((h) => `${"#".repeat(h.level)} ${h.text}`);
      io.stderr(`No heading matches "${name}". The headings of this plan are:\n${list.join("\n")}\n`);
      return 2;
    }
    if (!chosen) {
      const list = found.map((h) => `line ${h.line}: ${"#".repeat(h.level)} ${h.text}`);
      io.stderr(`"${name}" matches more than one heading:\n${list.join("\n")}\n`);
      return 3;
    }

    const lines = text.split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    const next = plan.headings.find((h) => h.line > chosen.line && h.level <= chosen.level);
    let end = next ? next.line - 1 : lines.length;
    while (end > chosen.line && lines[end - 1]!.trim() === "") end--;
    io.stdout(`${lines.slice(chosen.line - 1, end).join("\n")}\n`);
    return 0;
  } catch (error) {
    if (error instanceof PlanLocationError) {
      io.stderr(`${error.message}\n`);
      return error.exitCode;
    }
    if (error instanceof PlanFormatError) {
      io.stderr(`${error.message}\n${error.problems.map((p) => `line ${p.line}: ${p.rule}`).join("\n")}\n`);
      return 3;
    }
    throw error;
  }
}
