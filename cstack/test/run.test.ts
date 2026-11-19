import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { createRunner, findOnPath } from "../src/orca/run.js";

describe("createRunner", () => {
  const runner = createRunner(200);

  it("returns ok with the stdout of a command that succeeds", async () => {
    expect(await runner("echo", ["hello"])).toEqual({
      kind: "ok",
      stdout: "hello\n",
      stderr: "",
    });
  });

  it("returns failed with the exit code", async () => {
    expect(await runner("sh", ["-c", "exit 3"])).toEqual({
      kind: "failed",
      exitCode: 3,
      stderr: "",
    });
  });

  it("keeps the standard output of a program that fails", async () => {
    expect(await runner("sh", ["-c", `printf '{"ok":false}'; exit 1`])).toEqual({
      kind: "failed",
      exitCode: 1,
      stdout: '{"ok":false}',
      stderr: "",
    });
  });

  it("returns missing when the command does not exist", async () => {
    expect(await runner("cstack-no-such-command", [])).toEqual({
      kind: "missing",
    });
  });

  it("returns timeout when the command is too slow", async () => {
    const start = Date.now();
    expect(await runner("sh", ["-c", "sleep 5"])).toEqual({ kind: "timeout" });
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it("returns timeout when a child keeps the output open", async () => {
    const start = Date.now();
    expect(await runner("sh", ["-c", "sleep 5 & wait"])).toEqual({
      kind: "timeout",
    });
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe("createRunner safety and options", () => {
  const runner = createRunner(2000);

  it("passes an argument with shell characters unchanged and runs nothing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cstack-pwn-"));
    const arg = `x; touch ${join(dir, "pwned")}`;
    expect(await runner("printf", ["%s", arg])).toEqual({
      kind: "ok",
      stdout: arg,
      stderr: "",
    });
    expect(existsSync(join(dir, "pwned"))).toBe(false);
  });

  it("runs the program in the working folder", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "cstack-cwd-")));
    const result = await runner("pwd", [], dir);
    expect(result).toMatchObject({ kind: "ok" });
    expect(result.kind === "ok" && result.stdout.trim()).toBe(dir);
  });

  it("returns the standard error with ok and with failed", async () => {
    expect(await runner("sh", ["-c", "echo warn >&2"])).toEqual({
      kind: "ok",
      stdout: "",
      stderr: "warn\n",
    });
    expect(await runner("sh", ["-c", "echo bad >&2; exit 4"])).toEqual({
      kind: "failed",
      exitCode: 4,
      stderr: "bad\n",
    });
  });

  it("returns too-large when the answer is over the output limit", async () => {
    const big = createRunner(10000);
    const result = await big("sh", ["-c", "head -c 17000000 /dev/zero"]);
    expect(result).toEqual({ kind: "too-large" });
  });
});

describe("findOnPath", () => {
  it("returns the first folder entry that can be run", () => {
    const empty = mkdtempSync(join(tmpdir(), "cstack-path-"));
    const dir = mkdtempSync(join(tmpdir(), "cstack-path-"));
    const file = join(dir, "tool");
    writeFileSync(file, "#!/bin/sh\n");
    chmodSync(file, 0o755);
    expect(findOnPath("tool", `${empty}:${dir}`)).toBe(file);
    expect(findOnPath("other", `${empty}:${dir}`)).toBeUndefined();
  });

  it("skips a file that is not executable", () => {
    const dir = mkdtempSync(join(tmpdir(), "cstack-path-"));
    writeFileSync(join(dir, "tool"), "x");
    expect(findOnPath("tool", dir)).toBeUndefined();
  });
});

describe("a command that ignores the polite stop signal", () => {
  it("still gives timeout in under 2 seconds", async () => {
    const run = createRunner(200);
    const started = Date.now();
    const result = await run("sh", ["-c", "trap '' TERM; sleep 3"]);
    expect(result.kind).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

// Ticket #17 runs the user's own testCommands from .cstack/settings.json
// through /bin/sh on purpose, so that one file is allowed to use a shell.
const SHELL_ALLOWED = new Set(["test-run.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) return sourceFiles(file);
    return file.endsWith(".ts") ? [file] : [];
  });
}

describe("no program runs through a shell", () => {
  const src = join(__dirname, "..", "src");
  const files = sourceFiles(src);

  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("uses no exec, execSync, shell option or shell program name", () => {
    const problems: string[] = [];
    for (const file of files) {
      const name = relative(src, file);
      if (SHELL_ALLOWED.has(name)) continue;
      const text = readFileSync(file, "utf8");
      const imports = [
        ...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']node:child_process["']/g),
      ].flatMap((m) => m[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/)[0]));
      if (imports.includes("exec") || imports.includes("execSync"))
        problems.push(`${name}: imports exec or execSync`);
      if (/\bshell\s*:/.test(text)) problems.push(`${name}: shell option`);
      if (/["'`](\/bin\/)?(sh|bash|zsh)["'`]/.test(text))
        problems.push(`${name}: names a shell program`);
    }
    expect(problems).toEqual([]);
  });
});
