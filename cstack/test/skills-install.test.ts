import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { skills } from "../src/commands/skills.js";

const realRoot = new URL("..", import.meta.url).pathname;
const realVersion = (
  JSON.parse(readFileSync(join(realRoot, "package.json"), "utf8")) as {
    version: string;
  }
).version;

function collect() {
  const out = { stdout: "", stderr: "" };
  const io: Io = {
    stdout: (t) => {
      out.stdout += t;
    },
    stderr: (t) => {
      out.stderr += t;
    },
  };
  return { out, io };
}

// A fake package: { skillName: { relativeFile: content } }
function fakePackage(
  base: string,
  version: string,
  content: Record<string, Record<string, string>>,
): string {
  const root = mkdtempSync(join(base, "pkg-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ version }));
  for (const [name, files] of Object.entries(content)) {
    for (const [file, text] of Object.entries(files)) {
      const path = join(root, "skills", name, file);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, text);
    }
  }
  return root;
}

function tree(dir: string, prefix = ""): string[] {
  const result: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const rel = `${prefix}${e.name}`;
    if (e.isDirectory()) {
      result.push(`${rel}/`, ...tree(join(dir, e.name), `${rel}/`));
    } else {
      result.push(`${rel}=${readFileSync(join(dir, e.name), "utf8")}`);
    }
  }
  return result;
}

let base: string;
let home: string;
let skillsDir: string;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "cstack-skills-"));
  home = join(base, "home");
  mkdirSync(home);
  skillsDir = join(home, ".claude", "skills");
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const at = (n: number) => () => new Date(2026, 10, 18, 9, 5, n);

describe("cstack skills install", () => {
  it("installs into an empty home", async () => {
    const { out, io } = collect();
    const code = await skills(["install"], io, {
      home,
      packageRoot: realRoot,
    });
    expect(code).toBe(0);
    expect(out.stdout).toBe("installed cstack-example\n");
    const dir = join(skillsDir, "cstack-example");
    expect(existsSync(join(dir, ".claude-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(dir, "agents", "check.md"))).toBe(true);
    expect(readFileSync(join(dir, ".cstack-managed"), "utf8")).toBe(
      `${realVersion}\n`,
    );
  });

  it("says unchanged on a second install and makes no backup", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "a" } });
    await skills(["install"], collect().io, { home, packageRoot: pkg });
    const { out, io } = collect();
    const code = await skills(["install"], io, { home, packageRoot: pkg });
    expect(code).toBe(0);
    expect(out.stdout).toBe("unchanged a\n");
    expect(existsSync(join(home, ".claude", "skill-backups"))).toBe(false);
  });

  it("goes 1.0.0, 1.1.0, 1.0.0 and ends exactly as 1.0.0", async () => {
    const v1 = fakePackage(base, "1.0.0", {
      a: { "SKILL.md": "a1", "agents/x.md": "x" },
      b: { "SKILL.md": "b1" },
    });
    const v11 = fakePackage(base, "1.1.0", {
      a: { "SKILL.md": "a1", "agents/x.md": "x" },
      b: { "SKILL.md": "b2" },
      c: { "SKILL.md": "c1" },
    });
    await skills(["install"], collect().io, { home, packageRoot: v1 });
    const first = tree(skillsDir);
    const up = collect();
    expect(
      await skills(["install"], up.io, {
        home,
        packageRoot: v11,
        now: at(1),
      }),
    ).toBe(0);
    expect(up.out.stdout).toMatch(/^replaced a\b.*\nreplaced b\b.*\ninstalled c\n$/s);
    const down = collect();
    expect(
      await skills(["install"], down.io, {
        home,
        packageRoot: v1,
        now: at(2),
      }),
    ).toBe(0);
    expect(down.out.stdout).toMatch(/^replaced a\b.*\nreplaced b\b.*\nremoved c\b.*\n$/s);
    expect(tree(skillsDir)).toEqual(first);
    const backups = join(home, ".claude", "skill-backups");
    expect(tree(join(backups, "2026-11-18-090501"))).toContain("b/");
    expect(tree(join(backups, "2026-11-18-090502"))).toContain("c/");
    expect(
      readFileSync(
        join(backups, "2026-11-18-090502", "c", ".cstack-managed"),
        "utf8",
      ),
    ).toBe("1.1.0\n");
  });

  it("skips a folder without the marker and leaves it unchanged", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "new" } });
    mkdirSync(join(skillsDir, "a"), { recursive: true });
    writeFileSync(join(skillsDir, "a", "SKILL.md"), "mine");
    const before = tree(skillsDir);
    const { out, io } = collect();
    const code = await skills(["install"], io, { home, packageRoot: pkg });
    expect(code).toBe(1);
    expect(out.stdout).toMatch(/^skipped a\b.*no marker.*--adopt a/);
    expect(tree(skillsDir)).toEqual(before);
  });

  it("skips a symbolic link and leaves its target unchanged", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "new" } });
    const elsewhere = join(base, "elsewhere");
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, ".cstack-managed"), "9\n");
    writeFileSync(join(elsewhere, "f"), "keep");
    mkdirSync(skillsDir, { recursive: true });
    symlinkSync(elsewhere, join(skillsDir, "a"));
    const { out, io } = collect();
    const code = await skills(["install"], io, { home, packageRoot: pkg });
    expect(code).toBe(1);
    expect(out.stdout).toMatch(/^skipped a\b.*symbolic link/);
    expect(lstatSync(join(skillsDir, "a")).isSymbolicLink()).toBe(true);
    expect(tree(elsewhere)).toEqual([".cstack-managed=9\n", "f=keep"]);
  });

  it("skips a plain file at the target", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "new" } });
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(join(skillsDir, "a"), "plain");
    const { out, io } = collect();
    expect(await skills(["install"], io, { home, packageRoot: pkg })).toBe(1);
    expect(out.stdout).toMatch(/^skipped a\b.*not a folder/);
    expect(readFileSync(join(skillsDir, "a"), "utf8")).toBe("plain");
  });

  it("moves a marked folder that is no longer shipped into the backup", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "a" } });
    mkdirSync(join(skillsDir, "old"), { recursive: true });
    writeFileSync(join(skillsDir, "old", ".cstack-managed"), "0.9.0\n");
    writeFileSync(join(skillsDir, "old", "SKILL.md"), "old");
    const { out, io } = collect();
    const code = await skills(["install"], io, {
      home,
      packageRoot: pkg,
      now: at(3),
    });
    expect(code).toBe(0);
    expect(out.stdout).toMatch(/^installed a\nremoved old\b.*2026-11-18-090503/);
    expect(existsSync(join(skillsDir, "old"))).toBe(false);
    expect(
      readFileSync(
        join(home, ".claude", "skill-backups", "2026-11-18-090503", "old", "SKILL.md"),
        "utf8",
      ),
    ).toBe("old");
  });

  it("leaves no temporary folder and nothing but skills behind", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "a" } });
    await skills(["install"], collect().io, { home, packageRoot: pkg });
    expect(readdirSync(skillsDir)).toEqual(["a"]);
    expect(readdirSync(join(home, ".claude"))).toEqual(["skills"]);
  });

  it("refuses a missing or unknown subcommand with code 2", async () => {
    const { out, io } = collect();
    expect(await skills([], io, { home, packageRoot: realRoot })).toBe(2);
    expect(out.stderr).toContain("Usage");
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });
});
