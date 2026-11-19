import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runProgram } from "../src/publish/program.js";
import { parseRemote, redact } from "../src/publish/remote.js";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

describe("parseRemote", () => {
  it("reads the host and the path of an https URL", () => {
    expect(parseRemote("https://github.com/o/r.git")).toEqual({ host: "github.com", path: "o/r", ssh: false });
  });
  it("drops the user information and keeps the port of an https URL apart from the host", () => {
    expect(parseRemote("https://user:secret@example.org:8443/group/sub/r.git")).toEqual({
      host: "example.org",
      port: "8443",
      path: "group/sub/r",
      ssh: false,
    });
  });
  it("gives no port for an SSH URL, because it is not the port of the web site", () => {
    expect(parseRemote("ssh://git@example.org:2222/group/r.git")?.port).toBeUndefined();
  });
  it("refuses a host that starts with a dash", () => {
    expect(parseRemote("https://-oProxyCommand/o/r.git")).toBeUndefined();
    expect(parseRemote("ssh://git@-oProxy/o/r.git")).toBeUndefined();
    expect(parseRemote("git@-oProxy:o/r.git")).toBeUndefined();
  });
  it("reads an ssh:// URL and flags it as SSH", () => {
    expect(parseRemote("ssh://git@example.org:2222/group/r.git")).toEqual({
      host: "example.org",
      path: "group/r",
      ssh: true,
    });
  });
  it("reads the short SSH form", () => {
    expect(parseRemote("git@github.com:o/r.git")).toEqual({ host: "github.com", path: "o/r", ssh: true });
  });
  it("gives no host for a local path or a file URL", () => {
    expect(parseRemote("/tmp/bare.git")).toBeUndefined();
    expect(parseRemote("file:///tmp/bare.git")).toBeUndefined();
  });
});

describe("redact", () => {
  it("removes the user information from a URL in a text", () => {
    const out = redact("fatal: unable to access 'https://user:secret-token@example.org/o/r.git/'");
    expect(out).toContain("https://example.org/o/r.git/");
    expect(out).not.toContain("secret-token");
  });
  it("leaves the short SSH form as it is", () => {
    expect(redact("git@github.com:o/r.git")).toBe("git@github.com:o/r.git");
  });
});

describe("runProgram", () => {
  it("passes an argument byte for byte, without a shell", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cstack-program-"));
    roots.push(cwd);
    const r = runProgram("printf", ["%s", "$(touch pwned)"], { cwd });
    expect(r.ok).toBe(true);
    expect(r.stdout).toBe("$(touch pwned)");
    expect(existsSync(join(cwd, "pwned"))).toBe(false);
  });
  it("reports a missing program", () => {
    const r = runProgram("cstack-no-such-program", [], { cwd: tmpdir() });
    expect(r.missing).toBe(true);
    expect(r.ok).toBe(false);
  });
  it("passes the given env", () => {
    const r = runProgram("/bin/sh", ["-c", 'printf "%s" "$CSTACK_X"'], { cwd: tmpdir(), env: { CSTACK_X: "yes" } });
    expect(r.stdout).toBe("yes");
  });
});
