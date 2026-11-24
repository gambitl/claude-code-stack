import { readFileSync } from "node:fs";
import { readLines } from "../measure/sessions.js";
import { commandsOf, cstackCommands } from "./shell.js";

export type Call = { time: number; args: string[]; file: number; helper: boolean };
export type Launch =
  | { time: number; file: number; helper: boolean; kind: "sub-agent"; type: string; transcript?: number }
  | { time: number; file: number; helper: boolean; kind: "orca worker" };

// Reads the cstack commands of the Bash calls of the session files, once per tool call id, sorted by time.
export async function readCalls(files: { path: string; helper: boolean }[]): Promise<{ calls: Call[]; launches: Launch[]; unreadableFiles: number }> {
  const calls: Call[] = [];
  const launches: Launch[] = [];
  const seen = new Set<string>();
  const launchIds = new Map<Launch, string>();
  const transcriptOf = new Map<string, number>();
  let unreadableFiles = 0;
  for (const [index, file] of files.entries()) {
    if (file.helper) {
      try {
        const id = (JSON.parse(readFileSync(file.path.replace(/\.jsonl$/, ".meta.json"), "utf8")) as { toolUseId?: unknown } | null)?.toolUseId;
        if (typeof id === "string" && !transcriptOf.has(id)) transcriptOf.set(id, index);
      } catch {
        // A missing or broken meta file links no launch and is not an unreadable session file.
      }
    }
    try {
      await readLines(file.path, (line) => {
        if (line.type !== "assistant") return;
        const time = typeof line.timestamp === "string" ? Date.parse(line.timestamp) : NaN;
        if (Number.isNaN(time)) return;
        const content = (line.message as { content?: unknown } | undefined)?.content;
        if (!Array.isArray(content)) return;
        for (const item of content as Record<string, unknown>[]) {
          if (item?.type !== "tool_use") continue;
          const input = item.input as { command?: unknown; subagent_type?: unknown } | undefined;
          const isBash = item.name === "Bash" && typeof input?.command === "string";
          const isAgent = (item.name === "Agent" || item.name === "Task") && typeof input?.subagent_type === "string";
          if (!isBash && !isAgent) continue;
          if (typeof item.id === "string") {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
          }
          const origin = { time, file: index, helper: file.helper };
          if (isAgent) {
            const launch: Launch = { ...origin, kind: "sub-agent", type: input!.subagent_type as string };
            if (typeof item.id === "string") launchIds.set(launch, item.id);
            launches.push(launch);
            continue;
          }
          const command = input!.command as string;
          for (const args of cstackCommands(command)) calls.push({ time, args, file: index, helper: file.helper });
          for (const args of commandsOf(command, ["orca", "orca-dev", "orca-ide"])) {
            if (args[0] === "orchestration" && args[1] === "worker-start") launches.push({ ...origin, kind: "orca worker" });
          }
        }
      });
    } catch {
      unreadableFiles++;
    }
  }
  for (const [launch, id] of launchIds) {
    const transcript = transcriptOf.get(id);
    if (launch.kind === "sub-agent" && transcript !== undefined) launch.transcript = transcript;
  }
  calls.sort((a, b) => a.time - b.time);
  launches.sort((a, b) => a.time - b.time);
  return { calls, launches, unreadableFiles };
}
