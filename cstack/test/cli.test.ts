import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { run } from "../src/cli.js";
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
});
