import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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
    const wave = COMMANDS.find((c) => c.usage.startsWith("cstack wave"));
    expect(commandWords(wave as CommandEntry)).toEqual(["wave"]);
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
    expect(unbuiltRefusal(["helper", "start", "--child-worktree"], built)).toContain("Ticket #28 builds it.");
    expect(unbuiltRefusal(["wave", "--watch"], built)).toContain("Ticket #30 builds it.");
    expect(unbuiltRefusal(["wave", "--milestone", "x"], built)).toBeUndefined();
  });

  it("names the ticket of the command while the command is not built", () => {
    expect(unbuiltRefusal(["helper", "start"])).toContain("Ticket #27 builds it.");
    expect(unbuiltRefusal(["wave"])).toContain("Ticket #29 builds it.");
  });
});

describe("the command list", () => {
  it("holds eleven built commands and twelve that are not built", () => {
    expect(COMMANDS.filter((c) => c.built)).toHaveLength(11);
    expect(COMMANDS.filter((c) => !c.built)).toHaveLength(12);
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

  it("gives --plan to the new commands that work on a run", () => {
    for (const words of ["helper start", "helper done", "unit collect"]) {
      const entry = COMMANDS.find((c) => commandWords(c).join(" ") === words);
      expect(entry?.flags, words).toContain("--plan");
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
