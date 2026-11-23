import { readLines } from "../measure/sessions.js";
import { cstackCommands } from "./shell.js";

export type Call = { time: number; args: string[] };

// Reads the cstack commands of the Bash calls of the session files, once per tool call id, sorted by time.
export async function readCalls(files: string[]): Promise<{ calls: Call[]; unreadableFiles: number }> {
  const calls: Call[] = [];
  const seen = new Set<string>();
  let unreadableFiles = 0;
  for (const file of files) {
    try {
      await readLines(file, (line) => {
        if (line.type !== "assistant") return;
        const time = typeof line.timestamp === "string" ? Date.parse(line.timestamp) : NaN;
        if (Number.isNaN(time)) return;
        const content = (line.message as { content?: unknown } | undefined)?.content;
        if (!Array.isArray(content)) return;
        for (const item of content as Record<string, unknown>[]) {
          if (item?.type !== "tool_use" || item.name !== "Bash") continue;
          const command = (item.input as { command?: unknown } | undefined)?.command;
          if (typeof command !== "string") continue;
          if (typeof item.id === "string") {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
          }
          for (const args of cstackCommands(command)) calls.push({ time, args });
        }
      });
    } catch {
      unreadableFiles++;
    }
  }
  calls.sort((a, b) => a.time - b.time);
  return { calls, unreadableFiles };
}
