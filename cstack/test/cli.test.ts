import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HANDLERS, dispatchSubcommand, run } from "../src/cli.js";
import { COMMANDS, commandWords } from "../src/manifest.js";
import type { Io } from "../src/io.js";

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

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("run", () => {
  it("prints the version of package.json with --version", async () => {
    const { out, io } = collect();
    const code = await run(["--version"], io);
    expect(out.stdout).toBe(`${pkg.version}\n`);
    expect(out.stderr).toBe("");
    expect(code).toBe(0);
  });

  it("prints the usage and returns 2 with no argument", async () => {
    const { out, io } = collect();
    const code = await run([], io);
    expect(out.stderr.startsWith("Usage: cstack")).toBe(true);
    expect(out.stdout).toBe("");
    expect(code).toBe(2);
  });

  it("names an unknown command, prints the usage and returns 2", async () => {
    const { out, io } = collect();
    const code = await run(["nope"], io);
    const [first, ...rest] = out.stderr.split("\n");
    expect(first).toContain("nope");
    expect(rest.join("\n")).toContain("Usage: cstack");
    expect(out.stdout).toBe("");
    expect(code).toBe(2);
  });

  it("names an unknown option, prints the usage and returns 2", async () => {
    const { out, io } = collect();
    const code = await run(["--nope"], io);
    const [first, ...rest] = out.stderr.split("\n");
    expect(first).toContain("--nope");
    expect(rest.join("\n")).toContain("Usage: cstack");
    expect(out.stdout).toBe("");
    expect(code).toBe(2);
  });

  it("lets a crash inside a command reach the caller instead of printing the usage", async () => {
    const io: Io = {
      stdout: () => {
        throw new Error("boom");
      },
      stderr: () => {},
    };
    await expect(run(["--version"], io)).rejects.toThrow("boom");
  });

  it("refuses an argument after doctor, prints the usage and returns 2", async () => {
    const { out, io } = collect();
    const code = await run(["doctor", "--nope"], io);
    expect(out.stderr).toContain("Usage: cstack");
    expect(out.stdout).toBe("");
    expect(code).toBe(2);
  });

  it("installs cstack-example into the home folder with skills install", async () => {
    const home = mkdtempSync(join(tmpdir(), "cstack-cli-home-"));
    const oldHome = process.env.HOME;
    process.env.HOME = home;
    try {
      expect(homedir()).toBe(home);
      const { io } = collect();
      expect(await run(["skills", "install"], io)).toBe(0);
      expect(existsSync(join(home, ".claude", "skills", "cstack-example", ".cstack-managed"))).toBe(true);
    } finally {
      process.env.HOME = oldHome;
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("returns 2 and prints the usage for skills without a valid subcommand", async () => {
    for (const args of [["skills"], ["skills", "nope"]]) {
      const { out, io } = collect();
      expect(await run(args, io)).toBe(2);
      expect(out.stderr).toContain("Usage: cstack skills install");
    }
  });
  it("answers that a command of the list is not built yet, with exit code 1", async () => {
    const { out, io } = collect();
    const code = await run(["next"], io);
    expect(out.stderr).toContain("not built in this version yet");
    expect(out.stdout).toBe("");
    expect(code).toBe(1);
  });

  it("refuses every unbuilt command and every unbuilt flag with exit code 1 and its tickets", async () => {
    const tickets = (t: number | number[]) => [t].flat().map((n) => `#${n}`);
    for (const entry of COMMANDS.filter((e) => !e.built)) {
      const { out, io } = collect();
      expect(await run(commandWords(entry), io), entry.usage).toBe(1);
      for (const t of tickets(entry.ticket)) expect(out.stderr, entry.usage).toContain(t);
    }
    for (const entry of COMMANDS.filter((e) => e.notBuiltFlags !== undefined))
      for (const [flag, ticket] of Object.entries(entry.notBuiltFlags ?? {})) {
        const { out, io } = collect();
        expect(await run([...commandWords(entry), flag], io), flag).toBe(1);
        for (const t of tickets(ticket)) expect(out.stderr, flag).toContain(t);
      }
  });

  it("prints the usage line of every built entry and of no other entry", async () => {
    const { out, io } = collect();
    await run([], io);
    for (const entry of COMMANDS) {
      expect(out.stderr.includes(entry.usage)).toBe(entry.built);
    }
  });

  it("has a handler for every built entry and an entry for every handler", () => {
    const builtWords = new Set(COMMANDS.filter((e) => e.built).map((e) => commandWords(e)[0]));
    expect([...builtWords].sort()).toEqual(Object.keys(HANDLERS).sort());
  });

  it("prints the usage line of the list when a built command gets an unknown flag", async () => {
    for (const entry of COMMANDS.filter((e) => e.built)) {
      const { out, io } = collect();
      const code = await run([...commandWords(entry), "--cstack-unknown-flag"], io);
      expect(code, entry.usage).toBe(2);
      expect(out.stderr, entry.usage).toContain(entry.usage);
    }
  });

  it("routes the unit group and lists its words when the second word is missing or unknown", async () => {
    for (const args of [["unit"], ["unit", "nope", "1"]]) {
      const { out, io } = collect();
      expect(await run(args, io)).toBe(2);
      expect(out.stderr).toContain("order");
      expect(out.stderr).toContain("commit");
    }
  });
});

describe("the plan and report groups", () => {
  it("returns 2 and lists the second words of the group when the second word is missing or unknown", async () => {
    for (const [args, words] of [
      [["plan"], "status|section"],
      [["report", "nope"], "submit|check"],
    ] as const) {
      const { out, io } = collect();
      expect(await run([...args], io)).toBe(2);
      expect(out.stderr).toContain(words);
    }
  });
});

describe("dispatchSubcommand", () => {
  it("sends the arguments after the second word to its handler and returns its exit code", async () => {
    const { out, io } = collect();
    let received: string[] = [];
    const fake = async (args: string[]) => {
      received = args;
      return 7;
    };
    const code = await dispatchSubcommand("plan", ["status", "--json"], io, { status: fake });
    expect(received).toEqual(["--json"]);
    expect(code).toBe(7);
    expect(out.stderr).toBe("");
  });

  it("prints a usage line and returns 2 when the second word is missing or unknown", async () => {
    for (const args of [[], ["nope"]]) {
      const { out, io } = collect();
      const code = await dispatchSubcommand("plan", args, io, { status: async () => 0 });
      expect(code).toBe(2);
      expect(out.stderr).toContain("plan");
      expect(out.stderr).toContain("status");
      expect(out.stdout).toBe("");
    }
  });
});
