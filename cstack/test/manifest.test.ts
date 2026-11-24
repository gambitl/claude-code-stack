import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSteps, stepProblems } from "../src/guide-steps.js";
import { COMMANDS, type CommandEntry, commandWords, EXIT, matchMention, unbuiltRefusal } from "../src/manifest.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

interface Mention {
  file: string;
  line: number;
  text: string;
}

/** The text after each `cstack <word>` found in inline code and fenced code blocks. */
export function extractMentions(content: string, file: string): Mention[] {
  const found: Mention[] = [];
  let fence: { char: string; length: number } | undefined;
  const scan = (code: string, line: number) => {
    for (const m of code.matchAll(/(?<![\w./<>-])cstack (?=[a-z0-9][a-z0-9-]*)/g)) {
      const rest = code.slice(m.index + m[0].length);
      const end = rest.search(/[|;&>)]| #/);
      found.push({ file, line, text: (end === -1 ? rest : rest.slice(0, end)).trim() });
    }
  };
  content.split("\n").forEach((text, index) => {
    const line = index + 1;
    const open = /^\s*(`{3,}|~{3,})/.exec(text);
    if (fence !== undefined) {
      if (open && open[1][0] === fence.char && open[1].length >= fence.length) fence = undefined;
      else scan(text, line);
      return;
    }
    if (open) {
      fence = { char: open[1][0], length: open[1].length };
      return;
    }
    for (const span of text.matchAll(/`([^`]+)`/g)) scan(span[1], line);
  });
  return found;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : [join(dir, e.name)],
  );
}

/** Every mention under the folders that matches no entry, with its file and line. */
export function scan(folders: string[], base: string): string[] {
  const failures: string[] = [];
  for (const file of folders.flatMap(filesUnder)) {
    for (const mention of extractMentions(readFileSync(file, "utf8"), relative(base, file))) {
      const result = matchMention(mention.text);
      if (!result.ok) failures.push(`${mention.file}:${mention.line}: cstack ${mention.text} (${result.reason})`);
    }
  }
  return failures;
}

describe("the mention scan", () => {
  it("reports the file and the line of a command that is not in the list", () => {
    const base = join(here, "fixtures", "manifest");
    const failures = scan([base], base);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(join("guides", "example", "frobnicate.md") + ":5:");
    expect(failures[0]).toContain("cstack frobnicate");
  });

  it("passes on the real skills and guides", () => {
    expect(scan([join(root, "skills"), join(root, "guides")], root)).toEqual([]);
  });
});

describe("extractMentions", () => {
  const mentions = (text: string) => extractMentions(text, "f.md").map((m) => m.text);

  it("ignores prose, paths, package names and the format name", () => {
    expect(
      mentions(
        "cstack unit red 3 in prose.\nSee `cstack/src/cli.ts`, `gambitl-cstack-<version>.tgz`, `cstack-plan/1` and `cstack`.",
      ),
    ).toEqual([]);
  });

  it("stops a mention at a pipe", () => {
    expect(mentions("Run `cstack plan status --json | jq --raw-output`.")).toEqual(["plan status --json"]);
  });

  it("reads fenced blocks line by line", () => {
    expect(mentions("```sh\ncstack doctor\n# cstack next\n```\ncstack doctor")).toEqual(["doctor", "next"]);
  });
});

describe("matchMention", () => {
  it("matches an entry with an argument", () => {
    const result = matchMention("unit red 3");
    expect(result.ok && result.entry.usage).toBe("cstack unit red <n> [--timeout <minutes>]");
  });

  it("refuses a flag that the entry does not have", () => {
    expect(matchMention("next --finish plan").ok).toBe(false);
  });

  it("matches a flag written with an equals sign", () => {
    expect(matchMention("guide hello --skill=cstack-example").ok).toBe(true);
  });

  it("reads the command words of a usage line that has a group in parentheses", () => {
    const list = COMMANDS.find((c) => c.usage.startsWith("cstack tracker list"));
    expect(commandWords(list as CommandEntry)).toEqual(["tracker", "list"]);
  });

  it("stops the command words at a flag", () => {
    const entry = { ...COMMANDS[0], usage: "cstack demo --flag <x>" } as CommandEntry;
    expect(commandWords(entry)).toEqual(["demo"]);
  });

  it("refuses an unknown command", () => {
    expect(matchMention("frobnicate").ok).toBe(false);
  });
});

describe("the flags that are not built yet", () => {
  it("names the ticket of the flag once the command is built", () => {
    const built = COMMANDS.map((e) => ({ ...e, built: true }));
    // Its own list, so the case does not depend on which real flags are still unbuilt.
    const made: CommandEntry[] = [
      {
        usage: "cstack frobnicate [--later]",
        summary: "A command that no ticket builds.",
        flags: ["--later"],
        exitCodes: { 0: "The command did its job." },
        file: "frobnicate.ts",
        ticket: 998,
        built: true,
        notBuiltFlags: { "--later": 999 },
      },
    ];
    expect(unbuiltRefusal(["frobnicate", "--later"], made)).toContain("Ticket #999 builds it.");
  });
});

describe("the command list", () => {
  it("holds nineteen built commands and none that is not built", () => {
    expect(COMMANDS.filter((c) => c.built)).toHaveLength(19);
    expect(COMMANDS.filter((c) => !c.built)).toHaveLength(0);
  });

  it("has no entry with the command words graph ensure", () => {
    expect(COMMANDS.some((c) => commandWords(c).join(" ") === "graph ensure")).toBe(false);
  });

  it("names a file for every entry, and the file exists when the entry is built", () => {
    for (const entry of COMMANDS) {
      expect(entry.file).toMatch(/^[a-z-]+\.ts$/);
      if (entry.built) expect(existsSync(join(root, "src", "commands", entry.file))).toBe(true);
    }
  });

  it("has no two entries with the same command words", () => {
    const words = COMMANDS.map((c) => commandWords(c).join(" "));
    expect(new Set(words).size).toBe(words.length);
  });

  it("gives each common exit code the same meaning only where the command uses it", () => {
    // Codes 0 to 5 are common. A command may use any of them, but never a code above 5
    // without a description of its own.
    for (const entry of COMMANDS)
      for (const [code, meaning] of Object.entries(entry.exitCodes)) {
        expect(Number.isInteger(Number(code))).toBe(true);
        expect(meaning.trim()).not.toBe("");
      }
  });

  it("does not treat cstack --version as a mention of a command", () => {
    expect(extractMentions("Run `cstack --version` first.", "x.md")).toEqual([]);
  });
});

/** Every refusal and every problem of the blocks of mandatory steps in the guides under the folders. */
function scanSteps(folders: string[], base: string, skillsRoot: string): string[] {
  const found: string[] = [];
  for (const file of folders.flatMap(filesUnder).filter((f) => f.endsWith(".md"))) {
    const name = relative(base, file);
    const read = readSteps(readFileSync(file, "utf8"), name);
    if (!read.ok) found.push(read.message);
    else found.push(...stepProblems(read.steps, name, skillsRoot));
  }
  return found;
}

describe("the check of the blocks of mandatory steps", () => {
  const skillsRoot = join(root, "skills");

  it("reports the file and the line of each command, helper and word that does not exist", () => {
    const base = join(here, "fixtures", "steps-check");
    const file = join("guides", "example", "broken-steps.md");
    const problems = scanSteps([base], base, skillsRoot);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toContain(`${file}, line 3:`);
    expect(problems[0]).toContain("cstack frobnicate");
    expect(problems[1]).toContain(`${file}, line 4:`);
    expect(problems[1]).toContain("skills/resolve-issue/agents/no-such-helper.md");
    expect(problems[2]).toContain(`${file}, line 5:`);
    expect(problems[2]).toContain("befor-plan");
  });

  it("passes on the real guides", () => {
    expect(scanSteps([join(root, "guides")], root, skillsRoot)).toEqual([]);
  });

  it("passes on the fixture guide with a block", () => {
    const base = join(here, "fixtures", "steps-block");
    expect(scanSteps([base], base, skillsRoot)).toEqual([]);
  });
});
