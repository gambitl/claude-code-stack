import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
import type { Io } from "../src/io.js";
import { COMMANDS, type CommandEntry, commandWords } from "../src/manifest.js";

const commandsFolder = fileURLToPath(new URL("../src/commands/", import.meta.url));

function collect() {
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (text) => {
      out.stdout += text;
    },
    stderr: (text) => {
      out.stderr += text;
    },
  };
  return { out, io };
}

/**
 * Lists what is wrong with the entries, one sentence each. Each sentence starts with the
 * command, so a failing test names it. An empty list means every built entry is implemented
 * and every other entry refuses with its tickets.
 */
async function implementationProblems(
  entries: CommandEntry[],
  folder: string = commandsFolder,
): Promise<string[]> {
  const problems: string[] = [];
  for (const entry of entries) {
    const words = commandWords(entry);
    const name = `cstack ${words.join(" ")}`;
    const { out, io } = collect();
    if (entry.built) {
      const path = join(folder, entry.file);
      if (!existsSync(path)) {
        problems.push(`${name}: the file ${entry.file} does not exist`);
        continue;
      }
      const module = (await import(path)) as Record<string, unknown>;
      if (!Object.values(module).some((value) => typeof value === "function"))
        problems.push(`${name}: ${entry.file} exports no function`);
      const code = await run([...words, "--cstack-unknown-flag"], io, entries);
      if (code !== 2) problems.push(`${name}: an unknown flag gave exit code ${code}, not 2`);
      if (!out.stderr.includes(entry.usage)) problems.push(`${name}: it does not print its own usage line`);
      if (out.stderr.includes("unknown command")) problems.push(`${name}: it says "unknown command"`);
      if (out.stderr.includes(`usage: cstack ${words[0]} <`))
        problems.push(`${name}: it prints the usage of its command group`);
    } else {
      const code = await run(words, io, entries);
      if (code !== 1) problems.push(`${name}: it exited with ${code}, not 1`);
      for (const ticket of [entry.ticket].flat())
        if (!out.stderr.includes(`#${ticket}`)) problems.push(`${name}: the refusal does not name #${ticket}`);
    }
  }
  return problems;
}

describe("implementationProblems", () => {
  it("names a built entry whose file does not exist", async () => {
    const fixture: CommandEntry[] = [
      {
        usage: "cstack frobnicate",
        summary: "Does nothing.",
        flags: [],
        exitCodes: { 0: "ok" },
        file: "frobnicate.ts",
        ticket: 1,
        built: true,
      },
    ];
    const problems = await implementationProblems(fixture);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("cstack frobnicate");
    expect(problems[0]).toContain("frobnicate.ts");
  });

  it("gives no problem for the real list of commands", async () => {
    expect(await implementationProblems(COMMANDS)).toEqual([]);
  });
});
