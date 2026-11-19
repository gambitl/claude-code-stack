import { type CommandEntry, commandWords } from "../../src/manifest.js";

function tickets(ticket: number | number[]): string {
  return [ticket].flat().map((t) => `#${t}`).join(", ");
}

/** One sentence for each command or flag of the entries that still has a placeholder handler. */
export function placeholderProblems(entries: CommandEntry[]): string[] {
  const problems: string[] = [];
  for (const entry of entries) {
    const name = `cstack ${commandWords(entry).join(" ")}`;
    if (!entry.built) problems.push(`The command "${name}" is not built. Ticket ${tickets(entry.ticket)} builds it.`);
    for (const [flag, ticket] of Object.entries(entry.notBuiltFlags ?? {}))
      problems.push(`The flag ${flag} of "${name}" is not built. Ticket ${tickets(ticket)} builds it.`);
  }
  return problems;
}
