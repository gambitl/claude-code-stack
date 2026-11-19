import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Io } from "../src/io.js";
import { skills } from "../src/commands/skills.js";

const realRoot = new URL("..", import.meta.url).pathname;

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

let base: string;
let home: string;
let file: string;
beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "cstack-perm-"));
  home = join(base, "home");
  mkdirSync(join(home, ".claude"), { recursive: true });
  file = join(home, ".claude", "settings.json");
});
afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const now = () => new Date(2026, 10, 19, 10, 0, 0);
const run = (args: string[]) => {
  const { out, io } = collect();
  return skills(["install", ...args], io, { home, packageRoot: realRoot, now }).then(
    (code) => ({ code, out }),
  );
};
const backups = () =>
  readdirSync(join(home, ".claude")).filter((n) => n.startsWith("settings.json.backup-"));

describe("cstack skills install and the permission rule", () => {
  it("only prints the rule, the file and the option when the rule is missing", async () => {
    const old = '{"model":"x"}';
    writeFileSync(file, old);
    const { code, out } = await run([]);
    expect(code).toBe(0);
    expect(out.stderr).toContain("Bash(cstack *)");
    expect(out.stderr).toContain(file);
    expect(out.stderr).toContain("--add-permission");
    expect(readFileSync(file, "utf8")).toBe(old);
    expect(backups()).toEqual([]);
  });

  it("adds the rule once, keeps the other entries in order and keeps a copy", async () => {
    const old = '{"b":1,"permissions":{"allow":["Read","Edit"],"deny":["X"]},"a":2}';
    writeFileSync(file, old);
    const first = await run(["--add-permission"]);
    expect(first.code).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(
      JSON.stringify(
        { b: 1, permissions: { allow: ["Read", "Edit", "Bash(cstack *)"], deny: ["X"] }, a: 2 },
        null,
        2,
      ) + "\n",
    );
    expect(backups()).toEqual(["settings.json.backup-2026-11-19-100000"]);
    expect(readFileSync(join(home, ".claude", backups()[0]!), "utf8")).toBe(old);
    const after = readFileSync(file, "utf8");
    const second = await run(["--add-permission"]);
    expect(second.code).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(after);
    expect(backups()).toHaveLength(1);
  });

  it.each([
    ["not json", "{nope"],
    ["allow not a list", '{"permissions":{"allow":"x"}}'],
    ["permissions not an object", '{"permissions":[]}'],
  ])("exits 3 and changes nothing when the file is invalid (%s)", async (_n, text) => {
    writeFileSync(file, text);
    const { code } = await run(["--add-permission"]);
    expect(code).toBe(3);
    expect(readFileSync(file, "utf8")).toBe(text);
    expect(backups()).toEqual([]);
    expect(existsSync(join(home, ".claude", "skills"))).toBe(false);
  });

  it("keeps the copy private with mode 0600", async () => {
    writeFileSync(file, '{"model":"x"}', { mode: 0o600 });
    chmodSync(file, 0o600);
    expect((await run(["--add-permission"])).code).toBe(0);
    expect(statSync(join(home, ".claude", backups()[0]!)).mode & 0o777).toBe(0o600);
  });

  it("does not print the content of an invalid file", async () => {
    writeFileSync(file, '{"token": "s3cret-value" nope}');
    const { code, out } = await run(["--add-permission"]);
    expect(code).toBe(3);
    expect(out.stderr).toContain("not valid JSON");
    expect(out.stderr).not.toContain("s3cret-value");
    expect(out.stderr).not.toContain("token");
  });

  it("creates a missing file with only the rule and no copy", async () => {
    const { code } = await run(["--add-permission"]);
    expect(code).toBe(0);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      permissions: { allow: ["Bash(cstack *)"] },
    });
    expect(backups()).toEqual([]);
  });

  it("keeps a symbolic link as a link", async () => {
    const real = join(base, "real.json");
    writeFileSync(real, "{}");
    symlinkSync(real, file);
    const { code } = await run(["--add-permission"]);
    expect(code).toBe(0);
    expect(lstatSync(file).isSymbolicLink()).toBe(true);
    expect(JSON.parse(readFileSync(real, "utf8")).permissions.allow).toEqual([
      "Bash(cstack *)",
    ]);
  });
});
