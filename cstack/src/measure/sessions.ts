import { createReadStream } from "node:fs";
import { readdir, realpath } from "node:fs/promises";
import { basename, dirname, join, sep } from "node:path";
import { createInterface } from "node:readline";

export type Totals = { input: number; cacheCreation: number; cacheRead: number; output: number };
export type Result = {
  mainSessions: number;
  helperTranscripts: number;
  totals: Totals;
  perModel: Map<string, Totals>;
  skippedLines: number;
  unreadableFiles: number;
};

const addTotals = (target: Totals, source: Totals): void => {
  target.input += source.input;
  target.cacheCreation += source.cacheCreation;
  target.cacheRead += source.cacheRead;
  target.output += source.output;
};
const empty = (): Totals => ({ input: 0, cacheCreation: 0, cacheRead: 0, output: 0 });
const MODEL = /^claude-[a-z0-9.-]+$/;

// Resolve a path through symbolic links. When the path is gone, resolve its nearest parent that exists.
async function resolveLoose(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    const parent = dirname(path);
    if (parent === path) return path;
    return join(await resolveLoose(parent), basename(path));
  }
}

async function readLines(
  file: string,
  onLine: (value: Record<string, unknown>) => void,
): Promise<number> {
  let skipped = 0;
  const lines = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    if (typeof value === "object" && value !== null) onLine(value as Record<string, unknown>);
  }
  return skipped;
}

// Returns undefined when the folder is gone. Any other failure is counted by the caller as an unreadable file.
async function listDir(path: string, onError: () => void): Promise<string[] | undefined> {
  try {
    return await readdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") onError();
    return undefined;
  }
}

export async function measureSessions(
  home: string,
  root: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<Result> {
  const result: Result = {
    mainSessions: 0,
    helperTranscripts: 0,
    totals: empty(),
    perModel: new Map(),
    skippedLines: 0,
    unreadableFiles: 0,
  };
  const projects = join(home, ".claude", "projects");
  const unreadable = () => {
    result.unreadableFiles++;
  };
  const inside = async (cwd: string): Promise<boolean> => {
    const resolved = await resolveLoose(cwd);
    return resolved === root || resolved.startsWith(root + sep);
  };
  // One answer is written on several lines with the same id. Only output_tokens grows, so keep the largest.
  // A line without an id gets a key of its own, so it is always counted.
  const answers = new Map<string, { model: string; totals: Totals }>();
  let anonymous = 0;
  const add = (line: Record<string, unknown>) => {
    if (line.type !== "assistant") return;
    const message = line.message as { id?: unknown; model?: unknown; usage?: Record<string, unknown> } | undefined;
    const usage = message?.usage;
    if (!usage) return;
    const n = (key: string) => (typeof usage[key] === "number" ? (usage[key] as number) : 0);
    const model = typeof message.model === "string" && MODEL.test(message.model) ? message.model : "other model";
    const answer = {
      model,
      totals: {
        input: n("input_tokens"),
        cacheCreation: n("cache_creation_input_tokens"),
        cacheRead: n("cache_read_input_tokens"),
        output: n("output_tokens"),
      },
    };
    const key = typeof message.id === "string" ? `id:${message.id}` : `line:${anonymous++}`;
    const seen = answers.get(key);
    if (!seen || answer.totals.output > seen.totals.output) answers.set(key, answer);
  };

  async function addFile(file: string): Promise<void> {
    try {
      result.skippedLines += await readLines(file, add);
    } catch {
      result.unreadableFiles++;
    }
  }

  async function scan(): Promise<void> {
    const entries = await readdir(projects, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") unreadable();
      return [];
    });
    for (const folder of entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
      const names = await listDir(join(projects, folder), unreadable);
      for (const name of (names ?? []).filter((entry) => entry.endsWith(".jsonl"))) {
        const file = join(projects, folder, name);
        const cwds = new Set<string>();
        let first = Infinity;
        let last = -Infinity;
        try {
          await readLines(file, (line) => {
            if (typeof line.cwd === "string") cwds.add(line.cwd);
            const time = typeof line.timestamp === "string" ? Date.parse(line.timestamp) : NaN;
            if (!Number.isNaN(time)) {
              first = Math.min(first, time);
              last = Math.max(last, time);
            }
          });
        } catch {
          unreadable();
          continue;
        }
        if (first > windowEnd.getTime() || last < windowStart.getTime()) continue;
        let counts = false;
        for (const cwd of cwds) if (await inside(cwd)) counts = true;
        if (!counts) continue;
        result.mainSessions++;
        await addFile(file);
        const helpers = join(projects, folder, name.slice(0, -".jsonl".length), "subagents");
        for (const helper of (await listDir(helpers, unreadable)) ?? []) {
          if (!helper.endsWith(".jsonl")) continue;
          result.helperTranscripts++;
          await addFile(join(helpers, helper));
        }
      }
    }
  }

  await scan();
  for (const answer of answers.values()) {
    let bucket = result.perModel.get(answer.model);
    if (!bucket) result.perModel.set(answer.model, (bucket = empty()));
    addTotals(result.totals, answer.totals);
    addTotals(bucket, answer.totals);
  }
  return result;
}
