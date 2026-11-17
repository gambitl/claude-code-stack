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
});
