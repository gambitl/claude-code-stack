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
import { moveFolder, skills } from "../src/commands/skills.js";

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
    expect(out.stdout).toBe("installed cstack-example\ninstalled resolve-issue\n");
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

  it("never removes an unshipped folder without the marker, nor a link to a marked one", async () => {
    const pkg = fakePackage(base, "1.0.0", { a: { "SKILL.md": "a" } });
    mkdirSync(join(skillsDir, "local"), { recursive: true });
    writeFileSync(join(skillsDir, "local", "SKILL.md"), "mine");
    const elsewhere = join(base, "elsewhere");
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, ".cstack-managed"), "0.9.0\n");
    symlinkSync(elsewhere, join(skillsDir, "linked"));
    const { out, io } = collect();
    const code = await skills(["install"], io, { home, packageRoot: pkg });
    expect(code).toBe(0);
    expect(out.stdout).toBe("installed a\n");
    expect(tree(join(skillsDir, "local"))).toEqual(["SKILL.md=mine"]);
    expect(lstatSync(join(skillsDir, "linked")).isSymbolicLink()).toBe(true);
    expect(tree(elsewhere)).toEqual([".cstack-managed=0.9.0\n"]);
    expect(existsSync(join(home, ".claude", "skill-backups"))).toBe(false);
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

describe("cstack skills install --adopt", () => {
  const pkgWith = () =>
    fakePackage(base, "1.0.0", {
      a: { "SKILL.md": "new a" },
      b: { "SKILL.md": "new b" },
    });
  const mine = (name: string) => {
    mkdirSync(join(skillsDir, name), { recursive: true });
    writeFileSync(join(skillsDir, name, "SKILL.md"), `mine ${name}`);
  };

  it("moves the old folder to the backup, installs the new one and prints the path", async () => {
    const pkg = pkgWith();
    mine("a");
    const { out, io } = collect();
    const code = await skills(["install", "--adopt", "a"], io, {
      home,
      packageRoot: pkg,
      now: at(4),
    });
    expect(code).toBe(0);
    const backup = join(home, ".claude", "skill-backups", "2026-11-18-090504", "a");
    expect(out.stdout).toContain(`replaced a, backup in ${backup}`);
    expect(readFileSync(join(backup, "SKILL.md"), "utf8")).toBe("mine a");
    expect(readFileSync(join(skillsDir, "a", "SKILL.md"), "utf8")).toBe("new a");
    expect(existsSync(join(skillsDir, "a", ".cstack-managed"))).toBe(true);
  });

  it("adopts two folders into one backup folder", async () => {
    const pkg = pkgWith();
    mine("a");
    mine("b");
    const code = await skills(
      ["install", "--adopt", "a", "--adopt", "b"],
      collect().io,
      { home, packageRoot: pkg, now: at(5) },
    );
    expect(code).toBe(0);
    const root = join(home, ".claude", "skill-backups");
    expect(readdirSync(root)).toEqual(["2026-11-18-090505"]);
    expect(readdirSync(join(root, "2026-11-18-090505")).sort()).toEqual(["a", "b"]);
  });

  it("refuses a name that this version does not ship with code 2 and changes nothing", async () => {
    const pkg = pkgWith();
    mine("a");
    const before = tree(home);
    const { out, io } = collect();
    const code = await skills(["install", "--adopt", "zzz"], io, {
      home,
      packageRoot: pkg,
    });
    expect(code).toBe(2);
    expect(out.stderr).toContain("zzz");
    expect(out.stderr).toContain("Usage");
    expect(tree(home)).toEqual(before);
  });

  it("refuses a bad name with code 2", async () => {
    const { io } = collect();
    expect(
      await skills(["install", "--adopt", "../x"], io, {
        home,
        packageRoot: pkgWith(),
      }),
    ).toBe(2);
    expect(existsSync(join(home, ".claude"))).toBe(false);
  });

  it("moves a symbolic link as a link and leaves the folder it points to", async () => {
    const pkg = pkgWith();
    const elsewhere = join(base, "elsewhere");
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, "f"), "keep");
    mkdirSync(skillsDir, { recursive: true });
    symlinkSync(elsewhere, join(skillsDir, "a"));
    const code = await skills(["install", "--adopt", "a"], collect().io, {
      home,
      packageRoot: pkg,
      now: at(6),
    });
    expect(code).toBe(0);
    const moved = join(home, ".claude", "skill-backups", "2026-11-18-090506", "a");
    expect(lstatSync(moved).isSymbolicLink()).toBe(true);
    expect(tree(elsewhere)).toEqual(["f=keep"]);
    expect(lstatSync(join(skillsDir, "a")).isDirectory()).toBe(true);
  });

  it("returns 1 as root and leaves the home folder empty", async () => {
    const { out, io } = collect();
    const code = await skills(["install"], io, {
      home,
      packageRoot: pkgWith(),
      uid: 0,
    });
    expect(code).toBe(1);
    expect(out.stderr).toContain("sudo");
    expect(readdirSync(home)).toEqual([]);
  });

  it("returns 1 and moves nothing when a backup target already exists", async () => {
    const pkg = pkgWith();
    mine("a");
    const existing = join(home, ".claude", "skill-backups", "2026-11-18-090507", "a");
    mkdirSync(existing, { recursive: true });
    const before = tree(home);
    const { out, io } = collect();
    const code = await skills(["install", "--adopt", "a"], io, {
      home,
      packageRoot: pkg,
      now: at(7),
    });
    expect(code).toBe(1);
    expect(out.stderr).toContain("already exists");
    expect(tree(home)).toEqual(before);
  });
});

describe("moveFolder", () => {
  it("copies, then deletes, when the rename fails with EXDEV", async () => {
    const from = join(base, "from");
    mkdirSync(join(from, "sub"), { recursive: true });
    writeFileSync(join(from, "sub", "f"), "data");
    const to = join(base, "to");
    const failing = (async () => {
      throw Object.assign(new Error("cross-device"), { code: "EXDEV" });
    }) as never;
    await moveFolder(from, to, failing);
    expect(existsSync(from)).toBe(false);
    expect(tree(to)).toEqual(["sub/", "sub/f=data"]);
  });

  it("rethrows any other rename error", async () => {
    const boom = (async () => {
      throw Object.assign(new Error("nope"), { code: "EACCES" });
    }) as never;
    await expect(moveFolder(base, join(base, "x"), boom)).rejects.toThrow("nope");
  });
});
